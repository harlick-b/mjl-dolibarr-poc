from datetime import datetime
from typing import Annotated, Any, Literal, cast
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.core.models import (
    Activity,
    ActivityContributor,
    DisbursementRequest,
    Project,
    ReversementDeclaration,
    VirementConfirmation,
    VirementDecision,
    VirementRequest,
)
from app.planning.core.service import (
    CONTEXT,
    Cursor,
    is_assigned_agent,
    locked_mutation,
    principal,
)
from app.planning.finance.disbursement import verified_financial_basis
from app.planning.notifications.financial_notifications import (
    deliver_financial_notification,
    mark_review_handled,
    record_agent_notifications,
    record_review_notifications,
)
from app.planning.operations.execution import pause_reason
from app.planning.routes import MUTATION_HEADERS, get_activity, get_activity_for_command

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA virement request authorization"],
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
    expected_disbursement_request_id: str = Field(max_length=36)

    @field_validator("expected_disbursement_request_id")
    @classmethod
    def uuid(cls, value: str) -> str:
        return str(UUID(value))


class DecisionInput(Input):
    expected_version: int = Field(gt=0, strict=True)
    decision: Literal["prevalidate", "approve", "return"]
    reason: str | None = Field(default=None, max_length=4000)

    @field_validator("reason", mode="before")
    @classmethod
    def reason_text(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class CancellationInput(Input):
    expected_version: int = Field(gt=0, strict=True)
    reason: str = Field(min_length=1, max_length=4000)

    @field_validator("reason", mode="before")
    @classmethod
    def reason_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class DecisionOutput(Input):
    id: str
    stage: str
    outcome: str
    actor_id: str
    actor_role: str
    decided_at: str
    reason: str | None
    prevalidation_decision_id: str | None


class CancellationOutput(Input):
    actor_id: str
    occurred_at: str
    reason: str


class ConfirmationOutput(Input):
    id: str
    revision: int
    amount: str
    transfer_date: str
    note: str | None
    actor_id: str
    recorded_at: str
    correction_reason: str | None


class ReversementDeclarationOutput(Input):
    id: str
    revision: int
    returned_amount: str
    return_date: str
    note: str | None
    actor_id: str
    recorded_at: str
    correction_reason: str | None


class ReversementOutput(Input):
    required_amount: str
    declared_amount: str
    status: Literal["not_required", "required", "declared"]
    current_declaration: ReversementDeclarationOutput | None
    allowed_actions: list[str]


class RequestOutput(Input):
    id: str
    activity_id: str
    disbursement_request_id: str
    approved_revision_id: str
    amount: str
    state: str
    submitter_id: str
    submitted_at: str
    cancellation: CancellationOutput | None
    decisions: list[DecisionOutput]
    allowed_actions: list[str]
    current_confirmation: ConfirmationOutput | None
    reversement: ReversementOutput | None


class MutationOutput(RequestOutput):
    activity_version: int


class ListOutput(Input):
    object: Literal["list"]
    count: int
    data: list[RequestOutput]
    next: str | None
    previous: str | None


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


def active_request(
    db: Session, activity_id: str, *, lock: bool = False
) -> VirementRequest | None:
    statement = select(VirementRequest).where(
        VirementRequest.activity_id == activity_id,
        VirementRequest.state.not_in(("returned", "cancelled")),
    )
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def request_decisions(db: Session, request_id: str) -> list[VirementDecision]:
    return list(
        db.scalars(
            select(VirementDecision)
            .where(VirementDecision.request_id == request_id)
            .order_by(VirementDecision.decided_at, VirementDecision.id)
        )
    )


def source_request(
    db: Session, activity_id: str, request_id: str, *, lock: bool = False
) -> DisbursementRequest:
    statement = select(DisbursementRequest).where(
        DisbursementRequest.id == request_id,
        DisbursementRequest.activity_id == activity_id,
    )
    if lock:
        statement = statement.with_for_update()
    result = db.scalar(statement)
    if not result:
        raise AuthError(404, "disbursement_not_found")
    return result


def verified_source(
    db: Session, item: Activity, request_id: str, *, lock: bool = False
) -> DisbursementRequest:
    project = db.get(Project, item.request_project_id, with_for_update=lock)
    reason = pause_reason(db, item, project)
    if reason:
        raise AuthError(409, reason)
    source = source_request(db, item.id, request_id, lock=lock)
    if source.state != "approved":
        raise AuthError(409, "disbursement_not_approved")
    total, operations, _authors = verified_financial_basis(db, item)
    if (
        source.approved_revision_id != item.approved_revision_id
        or source.amount != total
        or source.snapshot.get("allocation") != str(item.allocation)
        or source.snapshot.get("operations") != operations
    ):
        raise AuthError(409, "financial_basis_stale")
    return source


def exact_request(
    db: Session, activity_id: str, request_id: str, *, lock: bool = False
) -> VirementRequest:
    try:
        request_id = str(UUID(request_id))
    except ValueError:
        raise AuthError(404, "virement_not_found") from None
    statement = select(VirementRequest).where(
        VirementRequest.id == request_id,
        VirementRequest.activity_id == activity_id,
    )
    if lock:
        statement = statement.with_for_update()
    result = db.scalar(statement)
    if not result:
        raise AuthError(404, "virement_not_found")
    return result


def allowed_actions(
    role: str,
    actor_id: str,
    financial: VirementRequest,
    rows: list[VirementDecision],
) -> list[str]:
    result = ["read"]
    if role == "AGENT_SAISIE" and financial.state in {
        "submitted",
        "prevalidated",
    }:
        result.append("cancel")
    if actor_id in set(financial.excluded_reviewer_ids):
        return result
    if role == "AGENT_VERIFICATEUR" and financial.state == "submitted":
        result.extend(["prevalidate", "return"])
    if role == "VALIDATEUR_DEFINITIF" and financial.state == "prevalidated":
        prevalidation = next((row for row in rows if row.stage == "supervisor"), None)
        if prevalidation and prevalidation.actor_id != actor_id:
            result.extend(["approve", "return"])
    return result


def output(
    db: Session,
    financial: VirementRequest,
    role: str,
    actor_id: str,
    *,
    assigned: bool | None = None,
) -> dict[str, Any]:
    source = source_request(
        db, financial.activity_id, financial.disbursement_request_id
    )
    rows = request_decisions(db, financial.id)
    confirmation = db.scalar(
        select(VirementConfirmation)
        .where(VirementConfirmation.request_id == financial.id)
        .order_by(VirementConfirmation.revision.desc())
        .limit(1)
    )
    reversement = db.scalar(
        select(ReversementDeclaration)
        .where(ReversementDeclaration.request_id == financial.id)
        .order_by(ReversementDeclaration.revision.desc())
        .limit(1)
    )
    can_work = role == "AGENT_SAISIE" and (
        is_assigned_agent(db, financial.activity_id, actor_id)
        if assigned is None
        else assigned
    )
    actions = (
        ["read"]
        if role == "AGENT_SAISIE" and not can_work
        else allowed_actions(role, actor_id, financial, rows)
    )
    item = get_activity(db, financial.activity_id)
    project = db.get(Project, item.request_project_id)
    settlement_allowed = pause_reason(db, item, project) is None
    if can_work and financial.state == "approved" and settlement_allowed:
        if not confirmation:
            actions.append("declare_confirmation")
        elif not reversement:
            actions.append("correct_confirmation")
    reversement_output: dict[str, Any] | None = None
    if confirmation and financial.state == "approved":
        allocation = source.snapshot.get("allocation")
        if (
            not isinstance(allocation, str)
            or not allocation.isascii()
            or not allocation.isdecimal()
        ):
            raise AuthError(409, "financial_basis_stale")
        required = int(allocation) - source.amount
        if required < 0:
            raise AuthError(409, "financial_insufficiency_unresolved")
        reversement_actions = ["read"]
        if can_work and required > 0 and settlement_allowed:
            reversement_actions.append("correct" if reversement else "declare")
        reversement_output = {
            "required_amount": str(required),
            "declared_amount": str(reversement.amount) if reversement else "0",
            "status": (
                "not_required"
                if required == 0
                else "declared"
                if reversement
                else "required"
            ),
            "current_declaration": (
                {
                    "id": reversement.id,
                    "revision": reversement.revision,
                    "returned_amount": str(reversement.amount),
                    "return_date": reversement.return_date.isoformat(),
                    "note": reversement.note,
                    "actor_id": reversement.actor_id,
                    "recorded_at": reversement.recorded_at.isoformat(),
                    "correction_reason": reversement.correction_reason,
                }
                if reversement
                else None
            ),
            "allowed_actions": reversement_actions,
        }
    return {
        "id": financial.id,
        "activity_id": financial.activity_id,
        "disbursement_request_id": source.id,
        "approved_revision_id": source.approved_revision_id,
        "amount": str(source.amount),
        "state": financial.state,
        "submitter_id": financial.submitter_id,
        "submitted_at": financial.submitted_at.isoformat(),
        "cancellation": (
            {
                "actor_id": financial.cancelled_by_id,
                "occurred_at": financial.cancelled_at.isoformat()
                if financial.cancelled_at
                else None,
                "reason": financial.cancellation_reason,
            }
            if financial.state == "cancelled"
            else None
        ),
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
        "allowed_actions": actions,
        "current_confirmation": (
            {
                "id": confirmation.id,
                "revision": confirmation.revision,
                "amount": str(confirmation.amount),
                "transfer_date": confirmation.transfer_date.isoformat(),
                "note": confirmation.note,
                "actor_id": confirmation.actor_id,
                "recorded_at": confirmation.recorded_at.isoformat(),
                "correction_reason": confirmation.correction_reason,
            }
            if confirmation
            else None
        ),
        "reversement": reversement_output,
    }


def audit(
    auth: Auth,
    db: Session,
    action: str,
    actor_id: str,
    financial: VirementRequest,
    source: DisbursementRequest,
    before: str | None,
) -> None:
    reason = financial.cancellation_reason if financial.state == "cancelled" else None
    if financial.state == "returned":
        reason = db.scalar(
            select(VirementDecision.reason).where(
                VirementDecision.request_id == financial.id,
                VirementDecision.outcome == "returned",
            )
        )
    auth.business_audit(
        db,
        action,
        actor_id,
        financial.id,
        {
            "reason": reason,
            "context_id": CONTEXT,
            "activity_id": financial.activity_id,
            "request_id": financial.id,
            "disbursement_request_id": source.id,
            "amount": str(source.amount),
            "before_state": before,
            "after_state": financial.state,
        },
    )


@router.post(
    "/activities/{identifier}/virement-requests",
    status_code=201,
    response_model=MutationOutput,
    openapi_extra=MUTATION_HEADERS,
)
def submit(
    identifier: str,
    body: SubmitInput,
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Auth,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier, actor)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if active_request(db, item.id, lock=True):
            raise AuthError(409, "virement_exists")
        source = verified_source(
            db, item, body.expected_disbursement_request_id, lock=True
        )
        excluded = set(
            cast(list[str], source.snapshot.get("excluded_reviewer_ids", []))
        )
        excluded.update(
            db.scalars(
                select(ActivityContributor.user_id).where(
                    ActivityContributor.activity_id == item.id
                )
            )
        )
        excluded.add(actor.id)
        now = auth.now(db)
        created = VirementRequest(
            context_id=CONTEXT,
            activity_id=item.id,
            disbursement_request_id=source.id,
            excluded_reviewer_ids=sorted(excluded),
            submitter_id=actor.id,
            submitted_at=now,
            state="submitted",
        )
        db.add(created)
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, "virement.submit", actor.id, created, source, None)
        notification_ids = record_review_notifications(
            db, auth, item, created, "virement", "supervisor"
        )
        for notification_id in notification_ids:
            background_tasks.add_task(
                deliver_financial_notification, auth, notification_id
            )
        result = output(db, created, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


@router.post(
    "/activities/{identifier}/virement-requests/{request_id}/decisions",
    status_code=201,
    response_model=MutationOutput,
    openapi_extra=MUTATION_HEADERS,
)
def decide(
    identifier: str,
    request_id: str,
    body: DecisionInput,
    request: Request,
    background_tasks: BackgroundTasks,
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
        item = get_activity_for_command(db, identifier, actor)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        financial = exact_request(db, item.id, request_id, lock=True)
        source = verified_source(db, item, financial.disbursement_request_id, lock=True)
        rows = request_decisions(db, financial.id)
        if body.decision not in allowed_actions(actor.role, actor.id, financial, rows):
            raise AuthError(409, "decision_ineligible")
        if body.decision == "return" and not body.reason:
            raise AuthError(422, "reason_required")
        if body.decision != "return" and body.reason is not None:
            raise AuthError(422, "input_invalid")
        before = financial.state
        now = auth.now(db)
        if actor.role == "AGENT_VERIFICATEUR":
            stage = "supervisor"
            outcome = "prevalidated" if body.decision == "prevalidate" else "returned"
            financial.state = (
                "prevalidated" if outcome == "prevalidated" else "returned"
            )
            prevalidation_id = None
        else:
            stage = "validator"
            outcome = "approved" if body.decision == "approve" else "returned"
            financial.state = "approved" if outcome == "approved" else "returned"
            prevalidation = next(
                (row for row in rows if row.stage == "supervisor"), None
            )
            if not prevalidation:
                raise AuthError(409, "decision_ineligible")
            prevalidation_id = prevalidation.id
        db.add(
            VirementDecision(
                activity_id=item.id,
                request_id=financial.id,
                stage=stage,
                outcome=outcome,
                actor_id=actor.id,
                actor_role=actor.role,
                decided_at=now,
                reason=body.reason,
                prevalidation_decision_id=prevalidation_id,
            )
        )
        mark_review_handled(db, "virement", financial.id, stage, now)
        if outcome == "prevalidated":
            notification_ids = record_review_notifications(
                db,
                auth,
                item,
                financial,
                "virement",
                "validator",
                exclude_user_id=actor.id,
            )
        elif outcome == "returned":
            notification_ids = record_agent_notifications(
                db,
                auth,
                item,
                financial,
                "virement",
                kind="financial_correction",
                reason=body.reason,
            )
        else:
            notification_ids = record_agent_notifications(
                db,
                auth,
                item,
                financial,
                "virement",
                kind="financial_approved",
            )
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, f"virement.{outcome}", actor.id, financial, source, before)
        if outcome != "approved":
            for notification_id in notification_ids:
                background_tasks.add_task(
                    deliver_financial_notification, auth, notification_id
                )
        result = output(db, financial, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


@router.post(
    "/activities/{identifier}/virement-requests/{request_id}/cancellation",
    status_code=201,
    response_model=MutationOutput,
    openapi_extra=MUTATION_HEADERS,
)
def cancel(
    identifier: str,
    request_id: str,
    body: CancellationInput,
    request: Request,
    auth: Auth,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier, actor)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        financial = exact_request(db, item.id, request_id, lock=True)
        source = verified_source(db, item, financial.disbursement_request_id, lock=True)
        if financial.state not in {"submitted", "prevalidated"}:
            raise AuthError(409, "cancellation_ineligible")
        before = financial.state
        now = auth.now(db)
        financial.state = "cancelled"
        financial.cancelled_by_id = actor.id
        financial.cancelled_at = now
        financial.cancellation_reason = body.reason
        mark_review_handled(
            db,
            "virement",
            financial.id,
            "supervisor" if before == "submitted" else "validator",
            now,
        )
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, "virement.cancel", actor.id, financial, source, before)
        result = output(db, financial, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


@router.get(
    "/activities/{identifier}/virement-requests/{request_id}",
    response_model=MutationOutput,
)
def detail(
    identifier: str, request_id: str, request: Request, auth: Auth
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, actor=actor, shared=True)
        result = output(
            db, exact_request(db, item.id, request_id), actor.role, actor.id
        )
        result["activity_version"] = item.version
        return result


@router.get("/activities/{identifier}/virement-requests", response_model=ListOutput)
def listing(
    identifier: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, actor=actor, shared=True)
        limit, token = args
        cursor = Cursor(auth, "virement-requests", item.id, limit)
        marker, direction = cursor.decode(token)
        conditions = [VirementRequest.activity_id == item.id]
        if marker:
            try:
                marker_time_raw, marker_id_raw = marker.split("|", 1)
                marker_time = datetime.fromisoformat(marker_time_raw)
                marker_id = str(UUID(marker_id_raw))
            except (ValueError, TypeError):
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                tuple_(VirementRequest.submitted_at, VirementRequest.id)
                < tuple_(marker_time, marker_id)
                if direction == "next"
                else tuple_(VirementRequest.submitted_at, VirementRequest.id)
                > tuple_(marker_time, marker_id)
            )
        order = (
            (VirementRequest.submitted_at.desc(), VirementRequest.id.desc())
            if direction == "next"
            else (VirementRequest.submitted_at.asc(), VirementRequest.id.asc())
        )
        rows = list(
            db.scalars(
                select(VirementRequest)
                .where(*conditions)
                .order_by(*order)
                .limit(limit + 1)
            )
        )
        total = (
            db.scalar(
                select(func.count())
                .select_from(VirementRequest)
                .where(VirementRequest.activity_id == item.id)
            )
            or 0
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: VirementRequest, move: str) -> str:
            marker_value = f"{row.submitted_at.isoformat()}|{row.id}"
            query = urlencode(
                {"limit": limit, "cursor": cursor.encode(marker_value, move)}
            )
            base = f"{auth.policy.origin}/api/v1/activities/{item.id}/virement-requests"
            return f"{base}?{query}"

        assigned = actor.role == "AGENT_SAISIE" and is_assigned_agent(
            db, item.id, actor.id
        )
        return {
            "object": "list",
            "count": total,
            "data": [
                output(db, row, actor.role, actor.id, assigned=assigned) for row in rows
            ],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }
