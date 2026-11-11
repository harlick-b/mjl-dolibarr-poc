"""Admin-only ordinary invitations; A1 owns credentials, proofs and delivery."""

from datetime import datetime
from typing import Annotated, Literal, cast

from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import APIKeyCookie
from pydantic import Field, field_validator, model_validator
from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.auth.dto import BusinessRole, ErrorResponse, Identity, InvitableRole, Role
from app.auth.models import Audit, Invitation, User
from app.auth.policy import normalize_email, normalize_full_name
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
                description="OTP-verified Admin; loopback HTTP is local-only.",
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
            ("Origin", "Must exactly match the configured browser origin."),
        )
    ]
}


class InvitationSummary(Input):
    id: str
    state: Literal["prepared", "delivered", "revoked"]
    delivery_status: Literal["delivered", "failed", "unconfirmed"]
    expires_at: datetime
    version: int


class UserItem(Identity):
    full_name: str | None
    state: Literal["pending", "active", "inactive"]
    version: int
    invitation: InvitationSummary | None = None


class InvitationItem(Input):
    id: str
    email: str
    full_name: str | None
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
    full_name: str = Field(max_length=200)
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    role: InvitableRole
    partner_id: str | None = Field(default=None, max_length=36)

    @field_validator("email")
    @classmethod
    def normalized_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("full_name")
    @classmethod
    def normalized_full_name(cls, value: str) -> str:
        return normalize_full_name(value)

    @model_validator(mode="after")
    def binding_matches_role(self) -> "Invite":
        if self.first_name is not None or self.last_name is not None:
            if not self.first_name or not self.last_name:
                raise ValueError("Both names are required")
            self.first_name = normalize_full_name(self.first_name)
            self.last_name = normalize_full_name(self.last_name)
            if self.full_name != f"{self.first_name} {self.last_name}":
                raise ValueError("Names must match")
        if (self.role == "PARTENAIRE") != (self.partner_id is not None):
            raise ValueError("Partner binding must match role")
        return self


class Version(Input):
    expected_version: int = Field(gt=0, strict=True)


def admin(db: Session, auth: AuthService, request: Request) -> User:
    secret, csrf = evidence(request, auth)
    return auth.principal(
        db,
        secret,
        csrf=csrf,
        mutation=request.method != "GET",
        read_only=request.method == "GET",
        roles={"ADMIN_PLATEFORME"},
        forbidden="admin_required",
    )


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
        email=user.email,
        full_name=user.full_name,
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
    q: str = Field(default="", max_length=200)
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
        term = filters.q.strip().lower()
        if term:
            query = query.where(
                or_(
                    User.email.contains(term, autoescape=True),
                    func.lower(User.full_name).contains(term, autoescape=True),
                )
            )
        if filters.role:
            query = query.where(User.role == filters.role)
        if filters.state:
            query = query.where(User.state == filters.state)
        total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
        delivery = (
            select(Audit.outcome)
            .where(
                Audit.action == "invitation_delivery",
                Audit.target == User.id,
                Audit.details["generation"].astext == Invitation.generation,
            )
            .order_by(Audit.id.desc())
            .limit(1)
            .correlate(User, Invitation)
            .scalar_subquery()
        )
        created_at = (
            select(Audit.occurred_at)
            .where(
                Audit.action.in_(("bootstrap", "invitation_create")),
                Audit.target == User.id,
            )
            .order_by(Audit.occurred_at.asc(), Audit.id.asc())
            .limit(1)
            .correlate(User)
            .scalar_subquery()
        )
        rows = cast(
            list[tuple[User, Invitation | None, str | None]],
            db.execute(
                query.add_columns(Invitation, delivery)
                .outerjoin(Invitation, Invitation.user_id == User.id)
                .order_by(created_at.desc().nullslast(), User.id.desc())
                .offset((filters.page - 1) * filters.size)
                .limit(filters.size)
            ).all(),
        )
        return Users(
            items=[
                UserItem(
                    id=u.id,
                    email=u.email,
                    full_name=u.full_name,
                    role=cast(Role, u.role),
                    partner_id=u.partner_id,
                    state=cast(Literal["pending", "active", "inactive"], u.state),
                    version=u.version,
                    invitation=InvitationSummary(
                        id=invitation.id,
                        state=cast(
                            Literal["prepared", "delivered", "revoked"],
                            invitation.state,
                        ),
                        expires_at=invitation.expires_at,
                        version=invitation.version,
                        delivery_status="delivered"
                        if outcome == "sent"
                        else "failed"
                        if outcome == "failed"
                        else "unconfirmed",
                    )
                    if invitation
                    and u.state == "pending"
                    and invitation.state != "consumed"
                    else None,
                )
                for u, invitation, outcome in rows
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
        if body.partner_id:
            from app.planning.core.models import Partner

            partner = db.get(Partner, body.partner_id, with_for_update=True)
            if not partner or partner.context_id != "MJL":
                raise AuthError(404, "partner_not_found")
            if not partner.active:
                raise AuthError(409, "partner_inactive")
        if db.scalar(select(User.id).where(User.email == body.email)):
            raise AuthError(409, "account_exists")
        user = User(
            email=body.email,
            full_name=body.full_name,
            first_name=body.first_name,
            last_name=body.last_name,
            role=body.role,
            partner_id=body.partner_id,
        )
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
        "Restricted active accounts only. Exactly one ordinary internal "
        "role change or one ordinary/Partner deactivation; Partner role changes and "
        "rebinding are forbidden. 409 for stale/ineligible state or "
        "eligibility_unverified. "
        "Requires the exact operator-verified PTA schema and rejects current "
        "assignments."
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
        if isinstance(body, RoleChange) and user.role == "PARTENAIRE":
            raise AuthError(409, "account_ineligible")
        auth.lifecycle_eligible(db, user.id)
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
            partner_id=user.partner_id,
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=cast(Role, user.role),
            state=cast(Literal["pending", "active", "inactive"], user.state),
            version=user.version,
        )
