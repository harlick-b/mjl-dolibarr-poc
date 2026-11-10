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
from app.auth.models import Audit
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.execution import pause_reason
from app.planning.financial_notifications import (
    deliver_financial_notification,
    mark_review_handled,
    record_agent_notifications,
    record_review_notifications,
)
from app.planning.models import (
    Activity,
    ActivityContributor,
    FundingDecision,
    FundingRequest,
    Project,
)
from app.planning.routes import MUTATION_HEADERS, get_activity, get_activity_for_command
from app.planning.service import (
    CONTEXT,
    Cursor,
    is_assigned_agent,
    locked_mutation,
    principal,
)

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA funding authorization"],
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

    @field_validator("expected_approved_revision_id")
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


class RequestOutput(Input):
    id: str
    activity_id: str
    approved_revision_id: str
    amount: str
    state: str
    submitter_id: str
    submitted_at: str
    snapshot: dict[str, object]
    cancellation: CancellationOutput | None
    decisions: list[DecisionOutput]
    allowed_actions: list[str]


class MutationOutput(RequestOutput):
    activity_version: int


class ListOutput(Input):
    allowed_actions: list[str]
    pending: list[dict[str, str]]
    activity_version: int
    approved_revision_id: str | None
    object: Literal["list"]
    count: int
    data: list[RequestOutput]
    next: str | None
    previous: str | None


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


def decisions(db: Session, request_id: str) -> list[FundingDecision]:
    return list(
        db.scalars(
            select(FundingDecision)
            .where(FundingDecision.request_id == request_id)
            .order_by(FundingDecision.decided_at, FundingDecision.id)
        )
    )


def excluded_reviewers(db: Session, item: Activity, submitter_id: str) -> set[str]:
    result = {submitter_id}
    result.update(
        db.scalars(
            select(ActivityContributor.user_id).where(
                ActivityContributor.activity_id == item.id
            )
        )
    )
    audits = list(
        db.scalars(
            select(Audit).where(
                Audit.action.in_(
                    {
                        "operation.execution_started",
                        "operation.execution_recorded",
                        "operation.execution_corrected",
                    }
                ),
                Audit.business["activity_id"].as_string() == item.id,
            )
        )
    )
    result.update(row.actor for row in audits)
    return result


def allowed_actions(
    role: str,
    actor_id: str,
    request: FundingRequest,
    rows: list[FundingDecision],
) -> list[str]:
    result = ["read"]
    excluded = set(cast(list[str], request.snapshot.get("excluded_reviewer_ids", [])))
    if role == "AGENT_SAISIE" and request.state in {
        "submitted",
        "prevalidated",
    }:
        result.append("cancel")
    if actor_id in excluded:
        return result
    if role == "AGENT_VERIFICATEUR" and request.state == "submitted":
        result.extend(["prevalidate", "return"])
    if role == "VALIDATEUR_DEFINITIF" and request.state == "prevalidated":
        prevalidation = next((row for row in rows if row.stage == "supervisor"), None)
        if prevalidation and prevalidation.actor_id != actor_id:
            result.extend(["approve", "return"])
    return result


def output(
    db: Session,
    request: FundingRequest,
    role: str,
    actor_id: str,
    *,
    assigned: bool | None = None,
) -> dict[str, Any]:
    rows = decisions(db, request.id)
    return {
        "id": request.id,
        "activity_id": request.activity_id,
        "approved_revision_id": request.approved_revision_id,
        "amount": str(request.amount),
        "state": request.state,
        "submitter_id": request.submitter_id,
        "submitted_at": request.submitted_at.isoformat(),
        "snapshot": {
            key: request.snapshot[key] for key in ("old_allocation", "new_allocation")
        },
        "cancellation": (
            {
                "actor_id": request.cancelled_by_id,
                "occurred_at": request.cancelled_at.isoformat()
                if request.cancelled_at
                else None,
                "reason": request.cancellation_reason,
            }
            if request.state == "cancelled"
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
        "allowed_actions": (
            ["read"]
            if role == "AGENT_SAISIE"
            and not (
                is_assigned_agent(db, request.activity_id, actor_id)
                if assigned is None
                else assigned
            )
            else allowed_actions(role, actor_id, request, rows)
        ),
    }


def audit(
    auth: Auth,
    db: Session,
    action: str,
    actor_id: str,
    request: FundingRequest,
    before: str | None,
) -> None:
    reason = request.cancellation_reason if request.state == "cancelled" else None
    if request.state == "returned":
        reason = db.scalar(
            select(FundingDecision.reason).where(
                FundingDecision.request_id == request.id,
                FundingDecision.outcome == "returned",
            )
        )
    auth.business_audit(
        db,
        action,
        actor_id,
        request.id,
        {
            "reason": reason,
            "context_id": CONTEXT,
            "activity_id": request.activity_id,
            "request_id": request.id,
            "amount": str(request.amount),
            "before_state": before,
            "after_state": request.state,
        },
    )


@router.post(
    "/activities/{identifier}/funding-requests",
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
        if item.approved_revision_id != body.expected_approved_revision_id:
            raise AuthError(409, "approved_revision_stale")
        project = db.get(Project, item.request_project_id, with_for_update=True)
        reason = pause_reason(db, item, project, funding=False)
        if reason:
            raise AuthError(409, reason)
        from app.planning.disbursement import assert_disbursement_unfrozen
        from app.planning.funding_basis import funding_basis

        assert_disbursement_unfrozen(db, item.id)
        pending, _shortfall = funding_basis(db, item)
        if not pending:
            raise AuthError(409, "funding_not_required")
        basis = pending[0]
        if db.scalar(
            select(FundingRequest).where(
                FundingRequest.activity_id == item.id,
                FundingRequest.approved_revision_id == basis["approved_revision_id"],
                FundingRequest.state.not_in(("returned", "cancelled")),
            )
        ):
            raise AuthError(409, "funding_exists")
        excluded = excluded_reviewers(db, item, actor.id)
        now = auth.now(db)
        created = FundingRequest(
            context_id=CONTEXT,
            activity_id=item.id,
            approved_revision_id=basis["approved_revision_id"],
            snapshot={
                "base_revision_id": basis["base_revision_id"],
                "old_allocation": basis["old_allocation"],
                "new_allocation": basis["new_allocation"],
                "excluded_reviewer_ids": sorted(excluded),
            },
            amount=int(basis["amount"]),
            submitter_id=actor.id,
            submitted_at=now,
            state="submitted",
        )
        db.add(created)
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, "funding.submit", actor.id, created, None)
        notification_ids = record_review_notifications(
            db, auth, item, created, "funding", "supervisor"
        )
        for notification_id in notification_ids:
            background_tasks.add_task(
                deliver_financial_notification, auth, notification_id
            )
        result = output(db, created, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


def exact_request(
    db: Session, activity_id: str, request_id: str, *, lock: bool = False
) -> FundingRequest:
    try:
        request_id = str(UUID(request_id))
    except ValueError:
        raise AuthError(404, "funding_not_found") from None
    statement = select(FundingRequest).where(
        FundingRequest.id == request_id,
        FundingRequest.activity_id == activity_id,
    )
    if lock:
        statement = statement.with_for_update()
    result = db.scalar(statement)
    if not result:
        raise AuthError(404, "funding_not_found")
    return result


@router.post(
    "/activities/{identifier}/funding-requests/{request_id}/decisions",
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
        from app.planning.disbursement import assert_disbursement_unfrozen

        assert_disbursement_unfrozen(db, item.id)
        reason = pause_reason(
            db, item, db.get(Project, item.request_project_id), funding=False
        )
        if reason:
            raise AuthError(409, reason)
        if actor.id in excluded_reviewers(db, item, financial.submitter_id):
            raise AuthError(409, "decision_ineligible")
        rows = decisions(db, financial.id)
        actions = allowed_actions(actor.role, actor.id, financial, rows)
        if body.decision not in actions:
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
        db.add(
            FundingDecision(
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
        mark_review_handled(db, "funding", financial.id, stage, now)
        if outcome == "prevalidated":
            notification_ids = record_review_notifications(
                db,
                auth,
                item,
                financial,
                "funding",
                "validator",
                exclude_user_id=actor.id,
            )
        elif outcome == "returned":
            notification_ids = record_agent_notifications(
                db,
                auth,
                item,
                financial,
                "funding",
                kind="financial_correction",
                reason=body.reason,
            )
        else:
            notification_ids = record_agent_notifications(
                db,
                auth,
                item,
                financial,
                "funding",
                kind="financial_approved",
            )
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, f"funding.{outcome}", actor.id, financial, before)
        if outcome != "approved":
            for notification_id in notification_ids:
                background_tasks.add_task(
                    deliver_financial_notification, auth, notification_id
                )
        result = output(db, financial, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


@router.post(
    "/activities/{identifier}/funding-requests/{request_id}/cancellation",
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
            "funding",
            financial.id,
            "supervisor" if before == "submitted" else "validator",
            now,
        )
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, "funding.cancel", actor.id, financial, before)
        result = output(db, financial, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


@router.get(
    "/activities/{identifier}/funding-requests/{request_id}",
    response_model=MutationOutput,
)
def detail(
    identifier: str, request_id: str, request: Request, auth: Auth
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, shared=True)
        result = output(
            db, exact_request(db, item.id, request_id), actor.role, actor.id
        )
        result["activity_version"] = item.version
        return result


@router.get("/activities/{identifier}/funding-requests", response_model=ListOutput)
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
        cursor = Cursor(auth, "funding-requests", item.id, limit)
        marker, direction = cursor.decode(token)
        conditions = [FundingRequest.activity_id == item.id]
        if marker:
            try:
                marker_time_raw, marker_id_raw = marker.split("|", 1)
                marker_time = datetime.fromisoformat(marker_time_raw)
                marker_id = str(UUID(marker_id_raw))
            except (ValueError, TypeError):
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                tuple_(FundingRequest.submitted_at, FundingRequest.id)
                < tuple_(marker_time, marker_id)
                if direction == "next"
                else tuple_(FundingRequest.submitted_at, FundingRequest.id)
                > tuple_(marker_time, marker_id)
            )
        order = (
            (FundingRequest.submitted_at.desc(), FundingRequest.id.desc())
            if direction == "next"
            else (FundingRequest.submitted_at.asc(), FundingRequest.id.asc())
        )
        rows = list(
            db.scalars(
                select(FundingRequest)
                .where(*conditions)
                .order_by(*order)
                .limit(limit + 1)
            )
        )
        total = (
            db.scalar(
                select(func.count())
                .select_from(FundingRequest)
                .where(FundingRequest.activity_id == item.id)
            )
            or 0
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: FundingRequest, move: str) -> str:
            marker = f"{row.submitted_at.isoformat()}|{row.id}"
            query = urlencode({"limit": limit, "cursor": cursor.encode(marker, move)})
            base = f"{auth.policy.origin}/api/v1/activities/{item.id}/funding-requests"
            return f"{base}?{query}"

        from app.planning.funding_basis import funding_basis

        pending, _shortfall = funding_basis(db, item)
        from app.planning.disbursement import financial_freeze_reason

        assigned = actor.role == "AGENT_SAISIE" and is_assigned_agent(
            db, item.id, actor.id
        )
        can_submit = (
            assigned
            and bool(pending)
            and pause_reason(
                db, item, db.get(Project, item.request_project_id), funding=False
            )
            is None
            and financial_freeze_reason(db, item.id) is None
            and not db.scalar(
                select(FundingRequest.id).where(
                    FundingRequest.activity_id == item.id,
                    FundingRequest.approved_revision_id
                    == pending[0]["approved_revision_id"],
                    FundingRequest.state.not_in(("returned", "cancelled")),
                )
            )
        )
        return {
            "allowed_actions": ["submit"] if can_submit else [],
            "pending": pending,
            "activity_version": item.version,
            "approved_revision_id": item.approved_revision_id,
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
