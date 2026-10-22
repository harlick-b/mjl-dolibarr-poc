"""Admin-only ordinary invitations; A1 owns credentials, proofs and delivery."""

from datetime import datetime
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import APIKeyCookie
from pydantic import Field, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.auth.dto import BusinessRole, ErrorResponse, Identity, Role
from app.auth.models import Audit, Invitation, User
from app.auth.policy import synthetic_email
from app.auth.routes import Auth, Input, evidence
from app.auth.service import AuthError, AuthService

router = APIRouter(
    prefix="/api/v1/access",
    tags=["account administration"],
    dependencies=[
        Depends(
            APIKeyCookie(
                name="mjl_local",
                scheme_name="LocalSession",
                auto_error=False,
                description="OTP-verified Admin; isolated loopback HTTP only.",
            )
        ),
        Depends(
            APIKeyCookie(
                name="__Host-mjl",
                scheme_name="SecureSession",
                auto_error=False,
                description="Active OTP-verified Admin session over HTTPS.",
            )
        ),
    ],
    responses={
        status: {"model": ErrorResponse}
        for status in (401, 403, 404, 409, 422, 429, 503)
    },
)


MUTATION_HEADERS = {
    "parameters": [
        {
            "in": "header",
            "name": name,
            "required": True,
            "schema": {"type": "string"},
            "description": description,
        }
        for name, description in (
            ("X-CSRF-Token", "Token bound to the current A1 session."),
            ("Origin", "Must exactly match the configured synthetic browser origin."),
        )
    ]
}


class UserItem(Identity):
    state: Literal["pending", "active", "inactive"]
    version: int


class InvitationItem(Input):
    id: str
    user_id: str
    email: str
    role: Role
    state: Literal["prepared", "delivered", "consumed", "revoked"]
    delivery_status: Literal["delivered", "failed", "unconfirmed"]
    expires_at: datetime
    version: int


class Users(Input):
    items: list[UserItem]
    total: int
    page: int
    size: int


class Invitations(Input):
    items: list[InvitationItem]
    total: int
    page: int
    size: int


class Invite(Input):
    email: str = Field(max_length=254)
    role: BusinessRole

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        return synthetic_email(value)


class Version(Input):
    expected_version: int = Field(gt=0, strict=True)


def admin(db: Session, auth: AuthService, request: Request) -> User:
    secret, csrf = evidence(request, auth)
    actor = auth.principal(db, secret)
    if actor.role != "ADMIN_PLATEFORME":
        raise AuthError(403, "admin_required")
    if request.method != "GET":
        auth.guard(db, secret, csrf)
    return actor


def invitation_item(db: Session, user: User, invitation: Invitation) -> InvitationItem:
    outcome = db.scalar(
        select(Audit.outcome)
        .where(
            Audit.action == "invitation_delivery",
            Audit.target == user.id,
            Audit.details["generation"].astext == invitation.generation,
        )
        .order_by(Audit.id.desc())
        .limit(1)
    )
    return InvitationItem(
        id=invitation.id,
        user_id=user.id,
        email=user.email,
        role=cast(Role, user.role),
        state=cast(
            Literal["prepared", "delivered", "consumed", "revoked"], invitation.state
        ),
        expires_at=invitation.expires_at,
        version=invitation.version,
        delivery_status="delivered"
        if outcome == "sent"
        else "failed"
        if outcome == "failed"
        else "unconfirmed",
    )


class UserFilters(Input):
    page: int = Field(default=1, ge=1, le=1000000)
    size: int = Field(default=20, ge=1, le=50)
    email: str = Field(default="", max_length=254)
    role: Role | None = None
    state: Literal["pending", "active", "inactive"] | None = None


class InvitationFilters(Input):
    page: int = Field(default=1, ge=1, le=1000000)
    size: int = Field(default=20, ge=1, le=50)
    email: str = Field(default="", max_length=254)
    state: Literal["prepared", "delivered", "consumed", "revoked"] | None = None


@router.get("/users", response_model=Users)
def users(
    request: Request, auth: Auth, filters: Annotated[UserFilters, Query()]
) -> Users:
    with Session(auth.engine) as db, db.begin():
        admin(db, auth, request)
        query = select(User).where(
            User.email.contains(filters.email.strip().lower(), autoescape=True)
        )
        if filters.role:
            query = query.where(User.role == filters.role)
        if filters.state:
            query = query.where(User.state == filters.state)
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = db.scalars(
            query.order_by(User.id)
            .offset((filters.page - 1) * filters.size)
            .limit(filters.size)
        )
        return Users(
            items=[
                UserItem(
                    id=u.id,
                    email=u.email,
                    role=cast(Role, u.role),
                    state=cast(Literal["pending", "active", "inactive"], u.state),
                    version=u.version,
                )
                for u in rows
            ],
            total=total,
            page=filters.page,
            size=filters.size,
        )


@router.get("/invitations", response_model=Invitations)
def invitations(
    request: Request, auth: Auth, filters: Annotated[InvitationFilters, Query()]
) -> Invitations:
    with Session(auth.engine) as db, db.begin():
        admin(db, auth, request)
        query = (
            select(User, Invitation)
            .join(Invitation, Invitation.user_id == User.id)
            .where(User.email.contains(filters.email.strip().lower(), autoescape=True))
        )
        if filters.state:
            query = query.where(Invitation.state == filters.state)
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        rows = db.execute(
            query.order_by(Invitation.id)
            .offset((filters.page - 1) * filters.size)
            .limit(filters.size)
        )
        return Invitations(
            items=[invitation_item(db, u, i) for u, i in rows],
            total=total,
            page=filters.page,
            size=filters.size,
        )


@router.post(
    "/invitations",
    status_code=201,
    response_model=InvitationItem,
    openapi_extra=MUTATION_HEADERS,
)
def invite(body: Invite, request: Request, auth: Auth) -> InvitationItem:
    with Session(auth.engine) as db, db.begin():
        db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
        actor = admin(db, auth, request)
        if db.scalar(select(User.id).where(User.email == body.email)):
            raise AuthError(409, "account_exists")
        user = User(email=body.email, role=body.role)
        db.add(user)
        db.flush()
        invitation = Invitation(user_id=user.id)
        db.add(invitation)
        delivery = auth.prepare_invitation(
            db, user, invitation, actor.id, "invitation_create"
        )
    auth.deliver_invitation(*delivery)
    return current_invitation(request, auth, delivery[1])


def current_invitation(
    request: Request, auth: AuthService, identifier: str
) -> InvitationItem:
    with Session(auth.engine) as db, db.begin():
        admin(db, auth, request)
        invitation = db.get(Invitation, identifier)
        assert invitation
        user = db.get(User, invitation.user_id)
        assert user
        return invitation_item(db, user, invitation)


def change_invitation(
    identifier: str, body: Version, request: Request, auth: AuthService, *, revoke: bool
) -> InvitationItem:
    delivery = None
    with Session(auth.engine) as db, db.begin():
        db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
        actor = admin(db, auth, request)
        target = db.scalar(
            select(Invitation.user_id).where(Invitation.id == identifier)
        )
        user = db.get(User, target, with_for_update=True) if target else None
        invitation = db.get(Invitation, identifier, with_for_update=True)
        if not user or not invitation:
            raise AuthError(404, "invitation_not_found")
        if user.role == "ADMIN_PLATEFORME":
            raise AuthError(403, "admin_target_forbidden")
        if revoke and invitation.state == "revoked":
            return invitation_item(db, user, invitation)
        if user.state != "pending" or invitation.state in {"consumed", "revoked"}:
            raise AuthError(409, "invitation_terminal")
        if invitation.version != body.expected_version:
            raise AuthError(409, "invitation_stale")
        if revoke:
            previous = invitation.state
            invitation.state = "revoked"
            invitation.version += 1
            auth.audit(
                db,
                "invitation_revoke",
                actor.id,
                user.id,
                details=auth.invitation_facts(user, invitation, previous),
            )
            result = invitation_item(db, user, invitation)
        else:
            delivery = auth.prepare_invitation(
                db, user, invitation, actor.id, "invitation_reissue"
            )
    if delivery:
        auth.deliver_invitation(*delivery)
        return current_invitation(request, auth, identifier)
    return result


@router.post(
    "/invitations/{identifier}/resend",
    response_model=InvitationItem,
    openapi_extra=MUTATION_HEADERS,
)
def resend(
    identifier: str, body: Version, request: Request, auth: Auth
) -> InvitationItem:
    return change_invitation(identifier, body, request, auth, revoke=False)


@router.post(
    "/invitations/{identifier}/revoke",
    response_model=InvitationItem,
    openapi_extra=MUTATION_HEADERS,
)
def revoke(
    identifier: str, body: Version, request: Request, auth: Auth
) -> InvitationItem:
    return change_invitation(identifier, body, request, auth, revoke=True)


class RoleChange(Version):
    role: BusinessRole


class Deactivation(Version):
    deactivate: bool = Field(strict=True)

    @field_validator("deactivate")
    @classmethod
    def only_deactivate(cls, value: bool) -> bool:
        if not value:
            raise ValueError("Only deactivation is supported")
        return value


@router.patch(
    "/users/{identifier}",
    response_model=UserItem,
    openapi_extra=MUTATION_HEADERS,
    description=(
        "Restricted synthetic ordinary active accounts only. Exactly one role change "
        "or deactivation. 409 for stale/ineligible state or eligibility_unverified. "
        "Requires operator-verified auth-only database; never enables PTA lifecycle."
    ),
)
def lifecycle(
    identifier: str, body: RoleChange | Deactivation, request: Request, auth: Auth
) -> UserItem:
    with Session(auth.engine) as db, db.begin():
        db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
        actor = admin(db, auth, request)
        user = db.get(User, identifier, with_for_update=True)
        if not user:
            raise AuthError(404, "account_not_found")
        if user.id == actor.id or user.role == "ADMIN_PLATEFORME":
            raise AuthError(403, "admin_target_forbidden")
        auth.lifecycle_eligible(db)
        if user.state != "active":
            raise AuthError(409, "account_ineligible")
        if user.version != body.expected_version:
            raise AuthError(409, "account_stale")
        invitation = db.scalar(
            select(Invitation).where(Invitation.user_id == user.id).with_for_update()
        )
        changed = not isinstance(body, RoleChange) or body.role != user.role
        if changed:
            facts: dict[str, str | int] = {
                "before_role": user.role,
                "before_user_state": user.state,
                "before_user_version": user.version,
            }
            if isinstance(body, RoleChange):
                user.role = body.role
                action = "account_role_change"
            else:
                user.state = "inactive"
                action = "account_deactivate"
                if invitation and invitation.state in {"prepared", "delivered"}:
                    facts.update(
                        {
                            "invitation_id": invitation.id,
                            "generation": invitation.generation,
                            "before_state": invitation.state,
                            "before_version": invitation.version,
                        }
                    )
                    invitation.state = "revoked"
                    invitation.version += 1
                    facts.update(
                        {"after_state": invitation.state, "version": invitation.version}
                    )
            user.version += 1
            facts.update(
                {
                    "role": user.role,
                    "user_state": user.state,
                    "user_version": user.version,
                }
            )
            auth.audit(db, action, actor.id, user.id, details=facts)
        return UserItem(
            id=user.id,
            email=user.email,
            role=cast(Role, user.role),
            state=cast(Literal["pending", "active", "inactive"], user.state),
            version=user.version,
        )
