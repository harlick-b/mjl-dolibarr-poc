from datetime import datetime
from typing import Annotated, Any, Literal, cast
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.disbursement import excluded_reviewers, verified_financial_basis
from app.planning.execution import pause_reason
from app.planning.models import (
    Project,
    ZeroSpendingDecision,
    ZeroSpendingDeclaration,
)
from app.planning.routes import (
    MUTATION_HEADERS,
    created,
    get_activity,
    get_activity_for_command,
)
from app.planning.service import CONTEXT, Cursor, locked_mutation, principal

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA zero-spending validation"],
    dependencies=[
        Depends(APIKeyCookie(name="mjl_local", auto_error=False)),
        Depends(APIKeyCookie(name="__Host-mjl", auto_error=False)),
    ],
    responses={
        status: {"model": ErrorResponse}
        for status in (401, 403, 404, 409, 422, 429, 503)
    },
)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class SubmitInput(Input):
    expected_version: int = Field(gt=0, strict=True)
    expected_approved_revision_id: str = Field(max_length=36)
    reason: str = Field(min_length=1, max_length=4000)

    @field_validator("expected_approved_revision_id")
    @classmethod
    def uuid(cls, value: str) -> str:
        return str(UUID(value))

    @field_validator("reason", mode="before")
    @classmethod
    def reason_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class DecisionInput(Input):
    expected_version: int = Field(gt=0, strict=True)
    decision: Literal["prevalidate", "approve", "return"]
    reason: str | None = Field(default=None, max_length=4000)

    @field_validator("reason", mode="before")
    @classmethod
    def reason_text(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class DecisionOutput(Input):
    id: str
    stage: str
    outcome: str
    actor_id: str
    actor_role: str
    decided_at: str
    reason: str | None
    prevalidation_decision_id: str | None


class DeclarationOutput(Input):
    id: str
    activity_id: str
    approved_revision_id: str
    reason: str
    state: str
    submitter_id: str
    submitted_at: str
    decisions: list[DecisionOutput]
    allowed_actions: list[str]


class MutationOutput(DeclarationOutput):
    activity_version: int


class ListOutput(Input):
    object: Literal["list"]
    count: int
    data: list[DeclarationOutput]
    next: str | None
    previous: str | None


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


def current_declaration(
    db: Session, activity_id: str, *, lock: bool = False
) -> ZeroSpendingDeclaration | None:
    statement = select(ZeroSpendingDeclaration).where(
        ZeroSpendingDeclaration.activity_id == activity_id,
        ZeroSpendingDeclaration.state != "returned",
    )
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def decisions(db: Session, declaration_id: str) -> list[ZeroSpendingDecision]:
    return list(
        db.scalars(
            select(ZeroSpendingDecision)
            .where(ZeroSpendingDecision.declaration_id == declaration_id)
            .order_by(ZeroSpendingDecision.decided_at, ZeroSpendingDecision.id)
        )
    )


def allowed_actions(
    role: str,
    actor_id: str,
    declaration: ZeroSpendingDeclaration,
    rows: list[ZeroSpendingDecision],
) -> list[str]:
    result = ["read"]
    excluded = set(
        cast(list[str], declaration.snapshot.get("excluded_reviewer_ids", []))
    )
    if actor_id in excluded:
        return result
    if role == "AGENT_VERIFICATEUR" and declaration.state == "submitted":
        result.extend(["prevalidate", "return"])
    if role == "VALIDATEUR_DEFINITIF" and declaration.state == "prevalidated":
        prevalidation = next((row for row in rows if row.stage == "supervisor"), None)
        if prevalidation and prevalidation.actor_id != actor_id:
            result.extend(["approve", "return"])
    return result


def output(
    db: Session, declaration: ZeroSpendingDeclaration, role: str, actor_id: str
) -> dict[str, Any]:
    rows = decisions(db, declaration.id)
    return {
        "id": declaration.id,
        "activity_id": declaration.activity_id,
        "approved_revision_id": declaration.approved_revision_id,
        "reason": declaration.reason,
        "state": declaration.state,
        "submitter_id": declaration.submitter_id,
        "submitted_at": declaration.submitted_at.isoformat(),
        "decisions": [
            {
                "id": row.id,
                "stage": row.stage,
                "outcome": row.outcome,
                "actor_id": row.actor_id,
                "actor_role": row.actor_role,
                "decided_at": row.decided_at.isoformat(),
                "reason": row.reason,
                "prevalidation_decision_id": row.prevalidation_decision_id,
            }
            for row in rows
        ],
        "allowed_actions": allowed_actions(role, actor_id, declaration, rows),
    }


def audit(
    auth: Auth,
    db: Session,
    action: str,
    actor_id: str,
    declaration: ZeroSpendingDeclaration,
    before: str | None,
) -> None:
    reason = declaration.reason if declaration.state == "submitted" else None
    if declaration.state == "returned":
        reason = db.scalar(
            select(ZeroSpendingDecision.reason).where(
                ZeroSpendingDecision.declaration_id == declaration.id,
                ZeroSpendingDecision.outcome == "returned",
            )
        )
    auth.business_audit(
        db,
        action,
        actor_id,
        declaration.id,
        {
            "reason": reason,
            "context_id": CONTEXT,
            "activity_id": declaration.activity_id,
            "declaration_id": declaration.id,
            "approved_revision_id": declaration.approved_revision_id,
            "before_state": before,
            "after_state": declaration.state,
        },
    )


@router.post(
    "/activities/{identifier}/zero-spending-declarations",
    status_code=201,
    response_model=MutationOutput,
    openapi_extra=MUTATION_HEADERS,
)
def submit(
    identifier: str, body: SubmitInput, request: Request, auth: Auth
) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if item.approved_revision_id != body.expected_approved_revision_id:
            raise AuthError(409, "approved_revision_stale")
        project = db.get(Project, item.request_project_id, with_for_update=True)
        reason = pause_reason(db, item, project)
        if reason:
            raise AuthError(409, reason)
        if current_declaration(db, item.id, lock=True):
            raise AuthError(409, "zero_spending_exists")
        total, operations, authors = verified_financial_basis(db, item, allow_zero=True)
        if total != 0:
            raise AuthError(409, "zero_spending_ineligible")
        excluded = excluded_reviewers(db, item, actor.id) | authors
        now = auth.now(db)
        declaration = ZeroSpendingDeclaration(
            context_id=CONTEXT,
            activity_id=item.id,
            approved_revision_id=item.approved_revision_id,
            snapshot={
                "total": "0",
                "operations": operations,
                "excluded_reviewer_ids": sorted(excluded),
            },
            reason=body.reason,
            submitter_id=actor.id,
            submitted_at=now,
            state="submitted",
        )
        db.add(declaration)
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, "zero_spending.submit", actor.id, declaration, None)
        result = output(db, declaration, actor.role, actor.id)
        result["activity_version"] = item.version
        return created(
            request,
            f"/api/v1/activities/{item.id}/zero-spending-declarations/{declaration.id}",
            result,
        )


def exact_declaration(
    db: Session, activity_id: str, declaration_id: str, *, lock: bool = False
) -> ZeroSpendingDeclaration:
    try:
        declaration_id = str(UUID(declaration_id))
    except ValueError:
        raise AuthError(404, "zero_spending_not_found") from None
    statement = select(ZeroSpendingDeclaration).where(
        ZeroSpendingDeclaration.id == declaration_id,
        ZeroSpendingDeclaration.activity_id == activity_id,
    )
    if lock:
        statement = statement.with_for_update()
    declaration = db.scalar(statement)
    if not declaration:
        raise AuthError(404, "zero_spending_not_found")
    return declaration


@router.post(
    "/activities/{identifier}/zero-spending-declarations/{declaration_id}/decisions",
    status_code=201,
    response_model=MutationOutput,
    openapi_extra=MUTATION_HEADERS,
)
def decide(
    identifier: str,
    declaration_id: str,
    body: DecisionInput,
    request: Request,
    auth: Auth,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            *evidence(request, auth),
            roles={"AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        item = get_activity_for_command(db, identifier)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        declaration = exact_declaration(db, item.id, declaration_id, lock=True)
        rows = decisions(db, declaration.id)
        if body.decision not in allowed_actions(
            actor.role, actor.id, declaration, rows
        ):
            raise AuthError(409, "decision_ineligible")
        if body.decision == "return" and not body.reason:
            raise AuthError(422, "reason_required")
        if body.decision != "return" and body.reason is not None:
            raise AuthError(422, "input_invalid")
        before = declaration.state
        now = auth.now(db)
        if actor.role == "AGENT_VERIFICATEUR":
            stage = "supervisor"
            outcome = "prevalidated" if body.decision == "prevalidate" else "returned"
            prevalidation_id = None
        else:
            stage = "validator"
            outcome = "approved" if body.decision == "approve" else "returned"
            prevalidation = next(
                (
                    row
                    for row in rows
                    if row.stage == "supervisor" and row.outcome == "prevalidated"
                ),
                None,
            )
            if not prevalidation:
                raise AuthError(409, "decision_ineligible")
            prevalidation_id = prevalidation.id if outcome == "approved" else None
        declaration.state = outcome
        db.add(
            ZeroSpendingDecision(
                activity_id=item.id,
                declaration_id=declaration.id,
                stage=stage,
                outcome=outcome,
                actor_id=actor.id,
                actor_role=actor.role,
                decided_at=now,
                reason=body.reason,
                prevalidation_decision_id=prevalidation_id,
            )
        )
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, f"zero_spending.{outcome}", actor.id, declaration, before)
        result = output(db, declaration, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


@router.get(
    "/activities/{identifier}/zero-spending-declarations", response_model=ListOutput
)
def listing(
    identifier: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, shared=True)
        limit, token = args
        cursor = Cursor(auth, "zero-spending-declarations", item.id, limit)
        marker, direction = cursor.decode(token)
        conditions = [ZeroSpendingDeclaration.activity_id == item.id]
        if marker:
            try:
                marker_time_raw, marker_id_raw = marker.split("|", 1)
                marker_time = datetime.fromisoformat(marker_time_raw)
                marker_id = str(UUID(marker_id_raw))
            except (ValueError, TypeError):
                raise AuthError(422, "cursor_invalid") from None
            boundary = tuple_(
                ZeroSpendingDeclaration.submitted_at, ZeroSpendingDeclaration.id
            )
            conditions.append(
                boundary < tuple_(marker_time, marker_id)
                if direction == "next"
                else boundary > tuple_(marker_time, marker_id)
            )
        order = (
            (
                ZeroSpendingDeclaration.submitted_at.desc(),
                ZeroSpendingDeclaration.id.desc(),
            )
            if direction == "next"
            else (
                ZeroSpendingDeclaration.submitted_at.asc(),
                ZeroSpendingDeclaration.id.asc(),
            )
        )
        rows = list(
            db.scalars(
                select(ZeroSpendingDeclaration)
                .where(*conditions)
                .order_by(*order)
                .limit(limit + 1)
            )
        )
        total = (
            db.scalar(
                select(func.count())
                .select_from(ZeroSpendingDeclaration)
                .where(ZeroSpendingDeclaration.activity_id == item.id)
            )
            or 0
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: ZeroSpendingDeclaration, move: str) -> str:
            marker_value = f"{row.submitted_at.isoformat()}|{row.id}"
            query = urlencode(
                {"limit": limit, "cursor": cursor.encode(marker_value, move)}
            )
            base = (
                f"{auth.policy.origin}/api/v1/activities/{item.id}"
                "/zero-spending-declarations"
            )
            return f"{base}?{query}"

        return {
            "object": "list",
            "count": total,
            "data": [output(db, row, actor.role, actor.id) for row in rows],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }
