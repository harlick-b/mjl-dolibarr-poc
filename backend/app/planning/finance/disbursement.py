from datetime import datetime
from typing import Annotated, Any, Literal, cast
from urllib.parse import urlencode
from uuid import UUID

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    Header,
    Query,
    Request,
    Response,
)
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import and_, func, or_, select, tuple_
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.auth.dto import ErrorResponse
from app.auth.models import Audit
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.core.models import (
    Activity,
    ActivityContributor,
    ActivityRevision,
    ActivityRevisionDecision,
    DisbursementDecision,
    DisbursementRequest,
    Operation,
    Project,
    Subtask,
)
from app.planning.core.service import (
    CONTEXT,
    Cursor,
    is_assigned_agent,
    locked_mutation,
    principal,
)
from app.planning.finance import actor_display_names
from app.planning.finance.request_attachments import (
    REQUEST_ATTACHMENT_OPENAPI,
    RequestAttachment,
    attachment_output,
    attachment_response,
    attachment_values,
    read_request_attachment,
)
from app.planning.notifications.financial_notifications import (
    deliver_financial_notification,
    mark_review_handled,
    record_agent_notifications,
    record_review_notifications,
)
from app.planning.operations.execution import (
    approved_operations,
    execution_facts,
    pause_reason,
)
from app.planning.routes import MUTATION_HEADERS, get_activity, get_activity_for_command

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA disbursement authorization"],
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
    amount: str = Field(pattern=r"^[1-9][0-9]*$")
    observation: str | None = Field(default=None, max_length=4000)

    @field_validator("expected_approved_revision_id")
    @classmethod
    def uuid(cls, value: str) -> str:
        return str(UUID(value))

    @field_validator("observation", mode="before")
    @classmethod
    def observation_text(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class AttachmentOutput(Input):
    name: str
    media_type: str
    size: int


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
    actor_name: str
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
    observation: str | None
    attachment: AttachmentOutput | None
    state: str
    submitter_id: str
    submitter_name: str
    submitted_at: str
    cancellation: CancellationOutput | None
    decisions: list[DecisionOutput]
    allowed_actions: list[str]


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
) -> DisbursementRequest | None:
    statement = (
        select(DisbursementRequest)
        .where(
            DisbursementRequest.activity_id == activity_id,
            DisbursementRequest.state.not_in(("returned", "cancelled")),
        )
        .order_by(
            DisbursementRequest.submitted_at.desc(), DisbursementRequest.id.desc()
        )
        .limit(1)
    )
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def pending_request(
    db: Session, activity_id: str, *, lock: bool = False
) -> DisbursementRequest | None:
    statement = select(DisbursementRequest).where(
        DisbursementRequest.activity_id == activity_id,
        DisbursementRequest.state.in_(("submitted", "prevalidated")),
    )
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def approved_amount(
    db: Session, activity_id: str, approved_revision_id: str, *, lock: bool = False
) -> int:
    statement = select(DisbursementRequest).where(
        DisbursementRequest.activity_id == activity_id,
        DisbursementRequest.approved_revision_id == approved_revision_id,
        DisbursementRequest.state == "approved",
    )
    if lock:
        statement = statement.with_for_update()
    return sum(row.amount for row in db.scalars(statement))


def financial_freeze_reason(
    db: Session, activity_id: str, *, lock: bool = False
) -> str | None:
    if active_request(db, activity_id, lock=lock):
        return "disbursement_frozen"
    from app.planning.finance.zero_spending import current_declaration

    if current_declaration(db, activity_id, lock=lock):
        return "zero_spending_frozen"
    return None


def assert_disbursement_unfrozen(db: Session, activity_id: str) -> None:
    reason = financial_freeze_reason(db, activity_id, lock=True)
    if reason:
        raise AuthError(409, reason)


def decisions(db: Session, request_id: str) -> list[DisbursementDecision]:
    return list(
        db.scalars(
            select(DisbursementDecision)
            .where(DisbursementDecision.request_id == request_id)
            .order_by(DisbursementDecision.decided_at, DisbursementDecision.id)
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
                        "subtask.execution_recorded",
                        "subtask.execution_corrected",
                    }
                ),
                Audit.business["activity_id"].as_string() == item.id,
            )
        )
    )
    if not audits:
        raise AuthError(409, "execution_history_unverified")
    result.update(row.actor for row in audits)
    return result


def verified_financial_basis(
    db: Session, item: Activity, *, lock: bool = True, allow_zero: bool = False
) -> tuple[int, list[dict[str, object]], set[str]]:
    from app.planning.finance.funding_basis import funding_reason

    reason = funding_reason(db, item)
    if reason:
        raise AuthError(409, reason)
    revision, approved = approved_operations(db, item, lock=lock)
    operation_statement = (
        select(Operation).where(Operation.activity_id == item.id).order_by(Operation.id)
    )
    if lock:
        operation_statement = operation_statement.with_for_update()
    all_rows = list(db.scalars(operation_statement))
    active_ids = {row.id for row in all_rows if row.removed_at is None}
    approved_ids = {row.id for row, _ in approved}
    approved_child_ids = {
        str(child["id"])
        for _row, fact in approved
        for child in fact.get("subtasks", [])
        if isinstance(child, dict) and isinstance(child.get("id"), str)
    }
    subtask_statement = (
        select(Subtask).where(Subtask.activity_id == item.id).order_by(Subtask.id)
    )
    if lock:
        subtask_statement = subtask_statement.with_for_update()
    all_children = list(db.scalars(subtask_statement))
    active_child_ids = {child.id for child in all_children if child.removed_at is None}
    removed_children = [child for child in all_children if child.removed_at is not None]
    removed = [row for row in all_rows if row.removed_at is not None]
    if (
        not all_rows
        or active_ids != approved_ids
        or active_child_ids != approved_child_ids
        or any(
            row.execution_started_at is not None
            or row.execution_completed
            or row.actual_spent is not None
            or bool(row.execution_observation)
            for row in removed
        )
        or any(
            child.execution_started_at is not None
            or child.execution_completed
            or child.actual_spent is not None
            or bool(child.execution_observation)
            for child in removed_children
        )
    ):
        raise AuthError(409, "execution_ineligible")
    if any(
        row.execution_started_at is None
        or not row.execution_completed
        or row.actual_spent is None
        for row, _ in approved
    ):
        raise AuthError(409, "execution_incomplete")
    operations = [
        {
            "id": row.id,
            "approved_allocation": cast(str, fact["allocation"]),
            "actual_spent": str(row.actual_spent),
            "execution_completed": row.execution_completed,
        }
        for row, fact in approved
    ]
    total = sum(cast(int, row.actual_spent) for row, _ in approved)
    allocation = int(cast(str, revision.snapshot["allocation"]))
    if total < 0 or total > allocation or (total == 0 and not allow_zero):
        raise AuthError(409, "spending_ineligible")

    events = list(
        db.scalars(
            select(Audit)
            .where(
                or_(
                    and_(
                        Audit.target == item.id,
                        Audit.action.in_(
                            {"activity.approve", "activity.transfer_approve"}
                        ),
                    ),
                    and_(
                        Audit.business["activity_id"].as_string() == item.id,
                        Audit.action.in_(
                            {
                                "operation.execution_started",
                                "operation.execution_recorded",
                                "operation.execution_corrected",
                                "subtask.execution_recorded",
                                "subtask.execution_corrected",
                            }
                        ),
                    ),
                ),
            )
            .order_by(Audit.id)
        )
    )
    if not events:
        raise AuthError(409, "execution_history_unverified")
    approved_revision_ids = list(
        db.scalars(
            select(ActivityRevisionDecision.revision_id)
            .join(
                ActivityRevision,
                ActivityRevision.id == ActivityRevisionDecision.revision_id,
            )
            .where(
                ActivityRevision.activity_id == item.id,
                ActivityRevisionDecision.stage == "validator",
                ActivityRevisionDecision.outcome == "approved",
            )
            .order_by(
                ActivityRevisionDecision.decided_at,
                ActivityRevisionDecision.id,
            )
        )
    )
    audited_revision_ids: list[str] = []
    empty_facts: dict[str, object] = {
        "execution_started_at": None,
        "execution_completed": False,
        "actual_spent": None,
        "execution_observation": "",
    }
    empty_task_facts = {**empty_facts, "progress": None}
    carried: dict[str, dict[str, object]] = {}
    child_carried: dict[str, dict[str, object]] = {}
    historical_allocation: int | None = None
    historical_revision_id: str | None = None
    revision_operation_allocations: dict[str, int] = {}
    revision_child_allocations: dict[str, int] = {}
    revision_task_children: dict[str, list[str]] = {}
    revision_child_tasks: dict[str, str] = {}
    authors: set[str] = set()
    started_ids: set[str] = set()
    child_started_ids: set[str] = set()

    def normalized_task_facts(value: object) -> dict[str, object] | None:
        if not isinstance(value, dict):
            return None
        if set(value) == set(empty_facts):
            return {**value, "progress": None}
        if set(value) == set(empty_task_facts):
            return cast(dict[str, object], value)
        return None

    def aggregate_task(task_id: str) -> None:
        child_ids = revision_task_children.get(task_id, [])
        if not child_ids:
            return
        states = [child_carried.get(child_id, empty_facts) for child_id in child_ids]
        starts = [
            cast(str, state["execution_started_at"])
            for state in states
            if isinstance(state.get("execution_started_at"), str)
        ]
        raw_amounts = [state.get("actual_spent") for state in states]
        amount = (
            str(sum(int(cast(str, value)) for value in raw_amounts))
            if all(isinstance(value, str) for value in raw_amounts)
            else None
        )
        carried[task_id] = {
            "execution_started_at": min(starts) if starts else None,
            "execution_completed": all(
                state.get("execution_completed") is True for state in states
            ),
            "actual_spent": amount,
            "execution_observation": "",
            "progress": None,
        }
        if starts:
            started_ids.add(task_id)
        else:
            started_ids.discard(task_id)

    for event in events:
        facts = event.business
        if not isinstance(facts, dict):
            raise AuthError(409, "execution_history_unverified")
        if event.action.startswith("operation.execution_"):
            operation_id = facts.get("operation_id")
            before = facts.get("before")
            after = facts.get("after")
            revision_id = facts.get("approved_revision_id")
            recorded_allocation = facts.get("approved_allocation")
            expected_before = carried.get(cast(str, operation_id), empty_task_facts)
            normalized_before = normalized_task_facts(before)
            normalized_after = normalized_task_facts(after)
            if (
                not isinstance(operation_id, str)
                or operation_id not in active_ids
                or revision_task_children.get(operation_id)
                or normalized_before is None
                or normalized_after is None
                or normalized_before != expected_before
                or normalized_before == normalized_after
                or revision_id != historical_revision_id
                or not isinstance(recorded_allocation, str)
                or not recorded_allocation.isascii()
                or not recorded_allocation.isdecimal()
                or int(recorded_allocation)
                != revision_operation_allocations.get(operation_id)
            ):
                raise AuthError(409, "execution_history_unverified")
            raw_amount = normalized_after.get("actual_spent")
            if raw_amount is not None and (
                not isinstance(raw_amount, str)
                or not raw_amount.isascii()
                or not raw_amount.isdecimal()
            ):
                raise AuthError(409, "execution_history_unverified")
            if event.action == "operation.execution_started":
                if (
                    operation_id in started_ids
                    or normalized_before != empty_task_facts
                    or not isinstance(normalized_after.get("execution_started_at"), str)
                ):
                    raise AuthError(409, "execution_history_unverified")
                started_ids.add(operation_id)
            elif operation_id not in started_ids:
                if (
                    event.action != "operation.execution_recorded"
                    or normalized_before != empty_task_facts
                    or not isinstance(normalized_after.get("execution_started_at"), str)
                ):
                    raise AuthError(409, "execution_history_unverified")
                started_ids.add(operation_id)
            carried[operation_id] = normalized_after
            authors.add(event.actor)
        elif event.action.startswith("subtask.execution_"):
            task_id = facts.get("task_id")
            child_id = facts.get("subtask_id")
            before = facts.get("before")
            after = facts.get("after")
            revision_id = facts.get("approved_revision_id")
            recorded_allocation = facts.get("approved_allocation")
            expected_before = child_carried.get(cast(str, child_id), empty_facts)
            if (
                not isinstance(task_id, str)
                or not isinstance(child_id, str)
                or revision_child_tasks.get(child_id) != task_id
                or not isinstance(before, dict)
                or not isinstance(after, dict)
                or set(before) != set(empty_facts)
                or set(after) != set(empty_facts)
                or before != expected_before
                or before == after
                or revision_id != historical_revision_id
                or not isinstance(recorded_allocation, str)
                or not recorded_allocation.isascii()
                or not recorded_allocation.isdecimal()
                or int(recorded_allocation) != revision_child_allocations.get(child_id)
            ):
                raise AuthError(409, "execution_history_unverified")
            raw_amount = after.get("actual_spent")
            if raw_amount is not None and (
                not isinstance(raw_amount, str)
                or not raw_amount.isascii()
                or not raw_amount.isdecimal()
            ):
                raise AuthError(409, "execution_history_unverified")
            if child_id not in child_started_ids:
                if (
                    event.action != "subtask.execution_recorded"
                    or before != empty_facts
                    or not isinstance(after.get("execution_started_at"), str)
                ):
                    raise AuthError(409, "execution_history_unverified")
                child_started_ids.add(child_id)
            child_carried[child_id] = cast(dict[str, object], after)
            aggregate_task(task_id)
            authors.add(event.actor)
        else:
            revision_facts = facts.get("revision")
            if not isinstance(revision_facts, dict) or not isinstance(
                revision_facts.get("id"), str
            ):
                raise AuthError(409, "execution_history_unverified")
            approved_revision = db.get(ActivityRevision, revision_facts["id"])
            if not approved_revision or approved_revision.activity_id != item.id:
                raise AuthError(409, "execution_history_unverified")
            audited_revision_ids.append(approved_revision.id)
            raw_allocation = approved_revision.snapshot.get("allocation")
            raw_operations = approved_revision.snapshot.get("operations")
            if (
                not isinstance(raw_allocation, str)
                or not raw_allocation.isascii()
                or not raw_allocation.isdecimal()
                or not isinstance(raw_operations, list)
            ):
                raise AuthError(409, "execution_history_unverified")
            allocation_map: dict[str, int] = {}
            child_allocation_map: dict[str, int] = {}
            task_children: dict[str, list[str]] = {}
            child_tasks: dict[str, str] = {}
            for operation in raw_operations:
                if not isinstance(operation, dict):
                    raise AuthError(409, "execution_history_unverified")
                operation_id = operation.get("id")
                operation_allocation = operation.get("allocation")
                if (
                    not isinstance(operation_id, str)
                    or not isinstance(operation_allocation, str)
                    or not operation_allocation.isascii()
                    or not operation_allocation.isdecimal()
                    or operation_id in allocation_map
                ):
                    raise AuthError(409, "execution_history_unverified")
                allocation_map[operation_id] = int(operation_allocation)
                raw_children = operation.get("subtasks", [])
                if not isinstance(raw_children, list):
                    raise AuthError(409, "execution_history_unverified")
                child_ids: list[str] = []
                for child in raw_children:
                    if not isinstance(child, dict):
                        raise AuthError(409, "execution_history_unverified")
                    child_id = child.get("id")
                    child_allocation = child.get("allocation")
                    if (
                        not isinstance(child_id, str)
                        or not isinstance(child_allocation, str)
                        or not child_allocation.isascii()
                        or not child_allocation.isdecimal()
                        or child_id in child_allocation_map
                    ):
                        raise AuthError(409, "execution_history_unverified")
                    child_ids.append(child_id)
                    child_allocation_map[child_id] = int(child_allocation)
                    child_tasks[child_id] = operation_id
                task_children[operation_id] = child_ids
            historical_allocation = int(raw_allocation)
            historical_revision_id = approved_revision.id
            revision_operation_allocations = allocation_map
            revision_child_allocations = child_allocation_map
            revision_task_children = task_children
            revision_child_tasks = child_tasks
            child_carried = {
                child_id: state
                for child_id, state in child_carried.items()
                if child_id in child_allocation_map
            }
            child_started_ids.intersection_update(child_allocation_map)
            for task_id in task_children:
                aggregate_task(task_id)
    persisted = {row.id: execution_facts(row) for row, _ in approved}
    persisted_children = {
        child.id: execution_facts(child)
        for child in all_children
        if child.removed_at is None
    }
    if (
        audited_revision_ids != approved_revision_ids
        or not approved_revision_ids
        or historical_revision_id != item.approved_revision_id
        or historical_allocation != allocation
        or started_ids != active_ids
        or carried != persisted
        or child_carried != persisted_children
    ):
        raise AuthError(409, "execution_history_unverified")
    return total, operations, authors


def allowed_actions(
    role: str,
    actor_id: str,
    request: DisbursementRequest,
    rows: list[DisbursementDecision],
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
    request: DisbursementRequest,
    role: str,
    actor_id: str,
    *,
    assigned: bool | None = None,
) -> dict[str, Any]:
    rows = decisions(db, request.id)
    actors = actor_display_names(
        db, [request.submitter_id, *(row.actor_id for row in rows)]
    )
    return {
        "id": request.id,
        "activity_id": request.activity_id,
        "approved_revision_id": request.approved_revision_id,
        "amount": str(request.amount),
        "observation": request.observation,
        "attachment": attachment_output(request),
        "state": request.state,
        "submitter_id": request.submitter_id,
        "submitter_name": actors.get(request.submitter_id, "Utilisateur indisponible"),
        "submitted_at": request.submitted_at.isoformat(),
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
                "actor_name": actors.get(row.actor_id, "Utilisateur indisponible"),
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
    request: DisbursementRequest,
    before: str | None,
) -> None:
    reason = request.cancellation_reason if request.state == "cancelled" else None
    if request.state == "returned":
        reason = db.scalar(
            select(DisbursementDecision.reason).where(
                DisbursementDecision.request_id == request.id,
                DisbursementDecision.outcome == "returned",
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


def _submit(
    identifier: str,
    body: SubmitInput,
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Auth,
    attachment: RequestAttachment | None = None,
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
        reason = pause_reason(db, item, project)
        if reason:
            raise AuthError(409, reason)
        if pending_request(db, item.id, lock=True):
            raise AuthError(409, "disbursement_exists")
        total, operations, authors = verified_financial_basis(db, item)
        amount = int(body.amount)
        remaining = total - approved_amount(
            db, item.id, body.expected_approved_revision_id, lock=True
        )
        if remaining <= 0:
            raise AuthError(409, "disbursement_fully_authorized")
        if amount > remaining:
            raise AuthError(422, "disbursement_amount_exceeds_spending")
        excluded = excluded_reviewers(db, item, actor.id) | authors
        now = auth.now(db)
        created = DisbursementRequest(
            context_id=CONTEXT,
            activity_id=item.id,
            approved_revision_id=item.approved_revision_id,
            snapshot={
                "allocation": str(item.allocation),
                "operations": operations,
                "excluded_reviewer_ids": sorted(excluded),
            },
            amount=amount,
            observation=body.observation,
            **attachment_values(attachment),
            submitter_id=actor.id,
            submitted_at=now,
            state="submitted",
        )
        db.add(created)
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, "disbursement.submit", actor.id, created, None)
        notification_ids = record_review_notifications(
            db, auth, item, created, "disbursement", "supervisor"
        )
        for notification_id in notification_ids:
            background_tasks.add_task(
                deliver_financial_notification, auth, notification_id
            )
        result = output(db, created, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


@router.post(
    "/activities/{identifier}/disbursement-requests",
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
    return _submit(identifier, body, request, background_tasks, auth)


@router.post(
    "/activities/{identifier}/disbursement-requests/with-attachment",
    status_code=201,
    response_model=MutationOutput,
    openapi_extra={**MUTATION_HEADERS, **REQUEST_ATTACHMENT_OPENAPI},
)
async def submit_with_attachment(
    identifier: str,
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Auth,
    x_request_metadata_length: Annotated[
        int, Header(alias="X-Request-Metadata-Length", ge=2, le=20000)
    ],
    x_expected_version: Annotated[int, Header(alias="X-Expected-Version", gt=0)],
    x_expected_approved_revision_id: Annotated[
        str, Header(alias="X-Expected-Approved-Revision-Id")
    ],
    x_request_amount: Annotated[
        str, Header(alias="X-Request-Amount", pattern=r"^[1-9][0-9]*$")
    ],
) -> dict[str, Any]:
    upload = await read_request_attachment(request, x_request_metadata_length)
    body = SubmitInput(
        expected_version=x_expected_version,
        expected_approved_revision_id=x_expected_approved_revision_id,
        amount=x_request_amount,
        observation=upload.observation,
    )
    return await run_in_threadpool(
        _submit,
        identifier,
        body,
        request,
        background_tasks,
        auth,
        upload.attachment,
    )


@router.get("/activities/{identifier}/disbursement-requests/{request_id}/attachment")
def download_attachment(
    identifier: str, request_id: str, request: Request, auth: Auth
) -> Response:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, actor=actor, shared=True)
        return attachment_response(exact_request(db, item.id, request_id))


def exact_request(
    db: Session, activity_id: str, request_id: str, *, lock: bool = False
) -> DisbursementRequest:
    try:
        request_id = str(UUID(request_id))
    except ValueError:
        raise AuthError(404, "disbursement_not_found") from None
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


@router.post(
    "/activities/{identifier}/disbursement-requests/{request_id}/decisions",
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
        rows = decisions(db, financial.id)
        actions = allowed_actions(actor.role, actor.id, financial, rows)
        if body.decision not in actions:
            raise AuthError(409, "decision_ineligible")
        if body.decision == "return" and not body.reason:
            raise AuthError(422, "reason_required")
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
            DisbursementDecision(
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
        mark_review_handled(db, "disbursement", financial.id, stage, now)
        if outcome == "prevalidated":
            notification_ids = record_review_notifications(
                db,
                auth,
                item,
                financial,
                "disbursement",
                "validator",
                exclude_user_id=actor.id,
            )
        elif outcome == "returned":
            notification_ids = record_agent_notifications(
                db,
                auth,
                item,
                financial,
                "disbursement",
                kind="financial_correction",
                reason=body.reason,
            )
        else:
            notification_ids = record_agent_notifications(
                db,
                auth,
                item,
                financial,
                "disbursement",
                kind="financial_approved",
            )
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, f"disbursement.{outcome}", actor.id, financial, before)
        if outcome != "approved":
            for notification_id in notification_ids:
                background_tasks.add_task(
                    deliver_financial_notification, auth, notification_id
                )
        result = output(db, financial, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


@router.post(
    "/activities/{identifier}/disbursement-requests/{request_id}/cancellation",
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
            "disbursement",
            financial.id,
            "supervisor" if before == "submitted" else "validator",
            now,
        )
        item.version += 1
        item.updated_at = now
        db.flush()
        audit(auth, db, "disbursement.cancel", actor.id, financial, before)
        result = output(db, financial, actor.role, actor.id)
        result["activity_version"] = item.version
        return result


@router.get(
    "/activities/{identifier}/disbursement-requests/{request_id}",
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


@router.get("/activities/{identifier}/disbursement-requests", response_model=ListOutput)
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
        cursor = Cursor(auth, "disbursement-requests", item.id, limit)
        marker, direction = cursor.decode(token)
        conditions = [DisbursementRequest.activity_id == item.id]
        if marker:
            try:
                marker_time_raw, marker_id_raw = marker.split("|", 1)
                marker_time = datetime.fromisoformat(marker_time_raw)
                marker_id = str(UUID(marker_id_raw))
            except (ValueError, TypeError):
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                tuple_(DisbursementRequest.submitted_at, DisbursementRequest.id)
                < tuple_(marker_time, marker_id)
                if direction == "next"
                else tuple_(DisbursementRequest.submitted_at, DisbursementRequest.id)
                > tuple_(marker_time, marker_id)
            )
        order = (
            (DisbursementRequest.submitted_at.desc(), DisbursementRequest.id.desc())
            if direction == "next"
            else (DisbursementRequest.submitted_at.asc(), DisbursementRequest.id.asc())
        )
        rows = list(
            db.scalars(
                select(DisbursementRequest)
                .where(*conditions)
                .order_by(*order)
                .limit(limit + 1)
            )
        )
        total = (
            db.scalar(
                select(func.count())
                .select_from(DisbursementRequest)
                .where(DisbursementRequest.activity_id == item.id)
            )
            or 0
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: DisbursementRequest, move: str) -> str:
            marker = f"{row.submitted_at.isoformat()}|{row.id}"
            query = urlencode({"limit": limit, "cursor": cursor.encode(marker, move)})
            base = (
                f"{auth.policy.origin}/api/v1/activities/{item.id}"
                "/disbursement-requests"
            )
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
