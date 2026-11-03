from typing import Annotated, Any, Literal, cast
from urllib.parse import urlencode
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import Audit
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.models import (
    Activity,
    ActivityAssignment,
    ActivityRevision,
    AnnualPTA,
    DisbursementRequest,
    Operation,
    Project,
    ReversementDeclaration,
    VirementConfirmation,
    VirementRequest,
    ZeroSpendingDeclaration,
)
from app.planning.routes import MUTATION_HEADERS, get_activity, get_activity_for_command
from app.planning.service import CONTEXT, Cursor, locked_mutation, page_rows, principal

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA execution"],
    dependencies=[
        Depends(
            APIKeyCookie(name="mjl_local", scheme_name="LocalSession", auto_error=False)
        ),
        Depends(
            APIKeyCookie(
                name="__Host-mjl", scheme_name="SecureSession", auto_error=False
            )
        ),
    ],
    responses={
        status: {"model": ErrorResponse}
        for status in (401, 403, 404, 409, 422, 429, 503)
    },
)

PORTO_NOVO = ZoneInfo("Africa/Porto-Novo")
MAX_XOF = 9_223_372_036_854_775_807


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ExecutionMutation(Input):
    action: Literal["start", "record"]
    expected_version: int = Field(gt=0, strict=True)
    expected_approved_revision_id: str = Field(max_length=36)
    actual_spent: str | None = Field(
        default=None, max_length=19, pattern=r"^(0|[1-9][0-9]*)$"
    )
    execution_completed: bool | None = None
    execution_observation: str | None = Field(default=None, max_length=4000)
    correction_reason: str | None = Field(default=None, max_length=4000)

    @field_validator("expected_approved_revision_id")
    @classmethod
    def revision_uuid(cls, value: str) -> str:
        return str(UUID(value))

    @field_validator("execution_observation", mode="before")
    @classmethod
    def normalized_observation(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("correction_reason", mode="before")
    @classmethod
    def normalized_reason(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value

    @model_validator(mode="after")
    def action_shape(self) -> "ExecutionMutation":
        record_values = (
            self.actual_spent,
            self.execution_completed,
            self.execution_observation,
            self.correction_reason,
        )
        record_fields = {
            "actual_spent",
            "execution_completed",
            "execution_observation",
            "correction_reason",
        }
        if self.action == "start" and (
            any(value is not None for value in record_values)
            or bool(self.model_fields_set & record_fields)
        ):
            raise ValueError("Start accepts no execution result")
        if self.action == "record" and (
            self.execution_completed is None or self.execution_observation is None
        ):
            raise ValueError("Record requires its complete shape")
        if self.execution_completed and self.actual_spent is None:
            raise ValueError("Completion requires spending")
        return self


class ClosureInput(Input):
    expected_version: int = Field(gt=0, strict=True)


class ClosureOutput(Input):
    closed_by_id: str
    closed_at: str


class ExecutionOperationOutput(Input):
    id: str
    type_id: str
    type_label: str
    name: str
    approved_allocation: str
    position: int
    execution_started_at: str | None
    execution_completed: bool
    actual_spent: str | None
    execution_observation: str
    variance: str | None
    allowed_actions: list[str]


class VirementContextOutput(Input):
    disbursement_request_id: str | None
    amount: str | None
    current_request_id: str | None
    current_state: str | None
    can_submit: bool
    unavailable_reason: str | None
    confirmation_revision: int | None


class ExecutionDetailOutput(Input):
    id: str
    pta_id: str
    project_id: str
    reference: str
    name: str
    planned_start: str
    planned_end: str
    approved_allocation: str
    approved_revision_id: str
    version: int
    state: str
    closure: ClosureOutput | None
    closure_blockers: list[str]
    execution_paused: bool
    pause_reason: str | None
    mutation_unavailable_reason: str | None
    completed_operations: int
    operation_count: int
    works_completed: bool
    spending_total: str | None
    operations: list[ExecutionOperationOutput]
    virement_context: VirementContextOutput
    allowed_actions: list[str]


class ExecutionListItem(Input):
    id: str
    reference: str
    name: str
    planned_start: str
    planned_end: str
    approved_allocation: str
    approved_revision_id: str
    version: int
    state: str
    closure: ClosureOutput | None
    closure_blockers: list[str]
    execution_paused: bool
    pause_reason: str | None
    completed_operations: int
    operation_count: int
    works_completed: bool
    spending_total: str | None


class ExecutionHistoryItem(Input):
    id: str
    action: str
    actor_id: str
    occurred_at: str
    operation_id: str
    approved_revision_id: str
    approved_allocation: str
    before: dict[str, Any]
    after: dict[str, Any]
    correction_reason: str | None


class ListOutput[Item](Input):
    object: Literal["list"]
    count: int
    data: list[Item]
    next: str | None
    previous: str | None


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


def execution_facts(operation: Operation) -> dict[str, object]:
    return {
        "execution_started_at": (
            operation.execution_started_at.isoformat()
            if operation.execution_started_at
            else None
        ),
        "execution_completed": operation.execution_completed,
        "actual_spent": (
            str(operation.actual_spent) if operation.actual_spent is not None else None
        ),
        "execution_observation": operation.execution_observation,
    }


def approved_operations(
    db: Session, item: Activity, *, lock: bool = False
) -> tuple[ActivityRevision, list[tuple[Operation, dict[str, Any]]]]:
    if not item.approved_revision_id:
        raise AuthError(409, "execution_ineligible")
    revision = db.get(ActivityRevision, item.approved_revision_id)
    if not revision or revision.activity_id != item.id:
        raise AuthError(409, "execution_ineligible")
    snapshot = revision.snapshot
    raw = snapshot.get("operations")
    if not isinstance(raw, list) or not raw:
        raise AuthError(409, "execution_ineligible")
    facts = [cast(dict[str, Any], value) for value in raw if isinstance(value, dict)]
    ids = [value.get("id") for value in facts]
    if len(facts) != len(raw) or any(not isinstance(value, str) for value in ids):
        raise AuthError(409, "execution_ineligible")
    statement = select(Operation).where(
        Operation.activity_id == item.id, Operation.id.in_(cast(list[str], ids))
    )
    if lock:
        statement = statement.order_by(Operation.id).with_for_update()
    rows = {row.id: row for row in db.scalars(statement)}
    if len(rows) != len(ids) or len(set(ids)) != len(ids):
        raise AuthError(409, "execution_ineligible")
    result: list[tuple[Operation, dict[str, Any]]] = []
    for fact in sorted(facts, key=lambda value: int(value.get("position", 0))):
        operation = rows[cast(str, fact["id"])]
        if operation.removed_at is not None:
            raise AuthError(409, "execution_ineligible")
        result.append((operation, fact))
    return revision, result


def pause_reason(item: Activity, project: Project | None) -> str | None:
    if not project or project.state != "active":
        return "project_inactive"
    if item.state == "withdrawn":
        return "activity_withdrawn"
    if item.state == "closed":
        return "activity_closed"
    if item.amendment_id:
        return "amendment_pending"
    if item.withdrawal_id:
        return "withdrawal_pending"
    if item.transfer_id:
        return "transfer_pending"
    if item.state != "approved":
        return "activity_not_approved"
    return None


def closure_blockers(db: Session, item: Activity, *, lock: bool = False) -> list[str]:
    """Return server-owned closure blockers; every uncertainty fails closed."""
    if item.state == "closed":
        return []
    blockers: list[str] = []
    project = db.get(Project, item.request_project_id, with_for_update=lock)
    if pause_reason(item, project) is not None:
        blockers.append("planning_not_approved")
    try:
        from app.planning.disbursement import verified_financial_basis

        spent, operation_facts, _authors = verified_financial_basis(
            db, item, lock=lock, allow_zero=True
        )
    except AuthError as error:
        blockers.append(error.code)
        return list(dict.fromkeys(blockers))
    if spent == 0:
        zero_statement = select(ZeroSpendingDeclaration).where(
            ZeroSpendingDeclaration.activity_id == item.id,
            ZeroSpendingDeclaration.state == "approved",
            ZeroSpendingDeclaration.approved_revision_id == item.approved_revision_id,
        )
        if lock:
            zero_statement = zero_statement.with_for_update()
        zero_declaration = db.scalar(zero_statement)
        if (
            zero_declaration is None
            or zero_declaration.snapshot.get("total") != "0"
            or zero_declaration.snapshot.get("operations") != operation_facts
        ):
            blockers.append("zero_spending_not_approved")
        return list(dict.fromkeys(blockers))
    source_statement = select(DisbursementRequest).where(
        DisbursementRequest.activity_id == item.id,
        DisbursementRequest.state != "cancelled",
    )
    virement_statement = select(VirementRequest).where(
        VirementRequest.activity_id == item.id,
        VirementRequest.state != "cancelled",
    )
    if lock:
        source_statement = source_statement.with_for_update()
        virement_statement = virement_statement.with_for_update()
    source = db.scalar(source_statement)
    financial = db.scalar(virement_statement)
    if not source or source.state != "approved" or source.amount != spent:
        blockers.append("disbursement_not_settled")
    if (
        not financial
        or financial.state != "approved"
        or not source
        or financial.disbursement_request_id != source.id
    ):
        blockers.append("virement_not_settled")
        return list(dict.fromkeys(blockers))
    confirmation_statement = (
        select(VirementConfirmation)
        .where(VirementConfirmation.request_id == financial.id)
        .order_by(VirementConfirmation.revision.desc())
        .limit(1)
    )
    if lock:
        confirmation_statement = confirmation_statement.with_for_update()
    confirmation = db.scalar(confirmation_statement)
    if not confirmation or confirmation.amount != spent:
        blockers.append("virement_confirmation_required")
        return list(dict.fromkeys(blockers))
    required = item.allocation - spent
    if required < 0:
        blockers.append("financial_insufficiency_unresolved")
    elif required > 0:
        declaration_statement = (
            select(ReversementDeclaration)
            .where(ReversementDeclaration.request_id == financial.id)
            .order_by(ReversementDeclaration.revision.desc())
            .limit(1)
        )
        if lock:
            declaration_statement = declaration_statement.with_for_update()
        declaration = db.scalar(declaration_statement)
        if (
            not declaration
            or declaration.confirmation_id != confirmation.id
            or declaration.amount != required
        ):
            blockers.append("reversement_not_settled")
    return list(dict.fromkeys(blockers))


def execution_detail(db: Session, item: Activity, role: str) -> dict[str, Any]:
    revision, operations = approved_operations(db, item)
    project = db.get(Project, item.request_project_id)
    planning_reason = pause_reason(item, project)
    reason = planning_reason
    financial = db.scalar(
        select(DisbursementRequest).where(
            DisbursementRequest.activity_id == item.id,
            DisbursementRequest.state != "cancelled",
        )
    )
    zero_declaration = db.scalar(
        select(ZeroSpendingDeclaration).where(
            ZeroSpendingDeclaration.activity_id == item.id,
            ZeroSpendingDeclaration.state != "returned",
        )
    )
    approved_disbursement = db.scalar(
        select(DisbursementRequest).where(
            DisbursementRequest.activity_id == item.id,
            DisbursementRequest.state == "approved",
        )
    )
    current_virement = db.scalar(
        select(VirementRequest).where(
            VirementRequest.activity_id == item.id,
            VirementRequest.state != "cancelled",
        )
    )
    current_confirmation = (
        db.scalar(
            select(VirementConfirmation)
            .where(VirementConfirmation.request_id == current_virement.id)
            .order_by(VirementConfirmation.revision.desc())
            .limit(1)
        )
        if current_virement
        else None
    )
    if reason is None and financial is not None:
        reason = "disbursement_frozen"
    if reason is None and zero_declaration is not None:
        reason = "zero_spending_frozen"
    today = db.scalar(
        select(text("(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date"))
    )
    can_mutate = (
        role == "AGENT_SAISIE"
        and reason is None
        and today is not None
        and today >= item.planned_start
    )
    unavailable_reason = reason
    if unavailable_reason is None and role != "AGENT_SAISIE":
        unavailable_reason = "reviewer_read_only"
    elif unavailable_reason is None and (today is None or today < item.planned_start):
        unavailable_reason = "before_planned_start"
    projected: list[dict[str, Any]] = []
    complete = 0
    known_total = 0
    all_known = True
    for operation, fact in operations:
        if operation.execution_completed:
            complete += 1
        if operation.actual_spent is None:
            all_known = False
        else:
            known_total += operation.actual_spent
        allocation = int(cast(str, fact["allocation"]))
        actions: list[str] = []
        if can_mutate:
            if operation.execution_started_at is None:
                actions.append("start")
            else:
                actions.append("record")
        projected.append(
            {
                "id": operation.id,
                "type_id": cast(str, fact["type_id"]),
                "type_label": cast(str, fact.get("type_label", "")),
                "name": cast(str, fact["name"]),
                "approved_allocation": str(allocation),
                "position": cast(int, fact["position"]),
                **execution_facts(operation),
                "variance": (
                    str(operation.actual_spent - allocation)
                    if operation.actual_spent is not None
                    else None
                ),
                "allowed_actions": actions,
            }
        )
    blockers = closure_blockers(db, item)
    closure = (
        {
            "closed_by_id": item.closed_by_id,
            "closed_at": item.closed_at.isoformat(),
        }
        if item.closed_by_id and item.closed_at
        else None
    )
    actions = ["read"]
    if role == "AGENT_SAISIE" and item.state == "approved" and not blockers:
        actions.append("close")
    return {
        "id": item.id,
        "pta_id": item.pta_id,
        "project_id": item.request_project_id,
        "reference": item.reference,
        "name": cast(str, revision.snapshot["name"]),
        "planned_start": cast(str, revision.snapshot["planned_start"]),
        "planned_end": cast(str, revision.snapshot["planned_end"]),
        "approved_allocation": cast(str, revision.snapshot["allocation"]),
        "approved_revision_id": revision.id,
        "version": item.version,
        "state": item.state,
        "closure": closure,
        "closure_blockers": blockers,
        "execution_paused": reason is not None,
        "pause_reason": reason,
        "mutation_unavailable_reason": unavailable_reason,
        "completed_operations": complete,
        "operation_count": len(projected),
        "works_completed": complete == len(projected),
        "spending_total": str(known_total) if all_known else None,
        "operations": projected,
        "virement_context": {
            "disbursement_request_id": approved_disbursement.id
            if approved_disbursement
            else None,
            "amount": str(approved_disbursement.amount)
            if approved_disbursement
            else None,
            "current_request_id": current_virement.id if current_virement else None,
            "current_state": current_virement.state if current_virement else None,
            "can_submit": role == "AGENT_SAISIE"
            and approved_disbursement is not None
            and current_virement is None
            and planning_reason is None,
            "unavailable_reason": (
                "disbursement_required"
                if approved_disbursement is None
                else "virement_exists"
                if current_virement is not None
                else planning_reason
                if planning_reason is not None
                else "reviewer_read_only"
                if role != "AGENT_SAISIE"
                else None
            ),
            "confirmation_revision": current_confirmation.revision
            if current_confirmation
            else None,
        },
        "allowed_actions": actions,
    }


@router.post(
    "/activities/{identifier}/closure",
    response_model=ExecutionDetailOutput,
    openapi_extra=MUTATION_HEADERS,
)
def close_activity(
    identifier: str, body: ClosureInput, request: Request, auth: Auth
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        blockers = closure_blockers(db, item, lock=True)
        if blockers:
            raise AuthError(409, blockers[0])
        now = auth.now(db)
        assignments = list(
            db.scalars(
                select(ActivityAssignment)
                .where(
                    ActivityAssignment.activity_id == item.id,
                    ActivityAssignment.ended_at.is_(None),
                )
                .order_by(ActivityAssignment.id)
                .with_for_update()
            )
        )
        before_version = item.version
        item.state = "closed"
        item.closed_by_id = actor.id
        item.closed_at = now
        item.version += 1
        item.updated_at = now
        for assignment in assignments:
            assignment.ended_at = now
            assignment.ended_by_id = actor.id
        db.flush()
        auth.business_audit(
            db,
            "activity.closed",
            actor.id,
            item.id,
            {
                "context_id": CONTEXT,
                "activity_id": item.id,
                "approved_revision_id": item.approved_revision_id,
                "before_version": before_version,
                "version": item.version,
                "closed_by_id": actor.id,
                "closed_at": now.isoformat(),
                "ended_assignment_ids": [row.id for row in assignments],
            },
        )
        return execution_detail(db, item, actor.role)


def assert_never_started(db: Session, item: Activity) -> None:
    _revision, approved = approved_operations(db, item, lock=True)
    all_rows = list(
        db.scalars(
            select(Operation)
            .where(Operation.activity_id == item.id)
            .order_by(Operation.id)
            .with_for_update()
        )
    )
    approved_ids = {row.id for row, _fact in approved}
    active_ids = {row.id for row in all_rows if row.removed_at is None}
    if not all_rows or active_ids != approved_ids:
        raise AuthError(409, "eligibility_unverified")
    if any(
        row.execution_started_at is not None
        or row.execution_completed
        or row.actual_spent is not None
        or bool(row.execution_observation)
        for row in all_rows
    ):
        raise AuthError(409, "execution_already_started")


@router.get(
    "/ptas/{identifier}/execution", response_model=ListOutput[ExecutionListItem]
)
def execution_list(
    identifier: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        pta = db.get(AnnualPTA, identifier)
        if not pta or pta.context_id != CONTEXT:
            raise AuthError(404, "pta_not_found")
        limit, token = args
        cursor = Cursor(auth, "pta-execution", pta.id, limit)
        marker, direction = cursor.decode(token)
        conditions = [
            Activity.pta_id == pta.id,
            Activity.approved_revision_id.is_not(None),
            Activity.state != "withdrawn",
        ]
        if marker:
            try:
                marker = str(UUID(marker))
            except ValueError:
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                Activity.id > marker if direction == "next" else Activity.id < marker
            )
        order = Activity.id.asc() if direction == "next" else Activity.id.desc()
        rows, total = page_rows(
            db,
            Activity,
            (
                Activity.pta_id == pta.id,
                Activity.approved_revision_id.is_not(None),
                Activity.state != "withdrawn",
            ),
            tuple(conditions),
            (order,),
            limit,
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: Activity, move: str) -> str:
            query = urlencode({"limit": limit, "cursor": cursor.encode(row.id, move)})
            return f"{auth.policy.origin}/api/v1/ptas/{pta.id}/execution?{query}"

        details = [execution_detail(db, row, actor.role) for row in rows]
        fields = set(ExecutionListItem.model_fields)
        return {
            "object": "list",
            "count": total,
            "data": [
                {key: value for key, value in row.items() if key in fields}
                for row in details
            ],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }


@router.get("/activities/{identifier}/execution", response_model=ExecutionDetailOutput)
def execution_activity(identifier: str, request: Request, auth: Auth) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        return execution_detail(
            db, get_activity(db, identifier, shared=True), actor.role
        )


@router.patch(
    "/activities/{identifier}/operations/{operation_id}/execution",
    response_model=ExecutionDetailOutput,
    openapi_extra=MUTATION_HEADERS,
)
def change_execution(
    identifier: str,
    operation_id: str,
    body: ExecutionMutation,
    request: Request,
    auth: Auth,
) -> dict[str, Any]:
    try:
        operation_id = str(UUID(operation_id))
    except ValueError:
        raise AuthError(404, "operation_not_found") from None
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
        from app.planning.disbursement import assert_disbursement_unfrozen

        assert_disbursement_unfrozen(db, item.id)
        project = db.get(Project, item.request_project_id, with_for_update=True)
        reason = pause_reason(item, project)
        if reason:
            raise AuthError(409, reason)
        revision, operations = approved_operations(db, item, lock=True)
        approved_ids = {row.id for row, _fact in operations}
        active_ids = set(
            db.scalars(
                select(Operation.id)
                .where(
                    Operation.activity_id == item.id,
                    Operation.removed_at.is_(None),
                )
                .order_by(Operation.id)
                .with_for_update()
            )
        )
        if active_ids != approved_ids:
            raise AuthError(409, "execution_ineligible")
        selected = next(
            ((row, fact) for row, fact in operations if row.id == operation_id), None
        )
        if not selected:
            raise AuthError(404, "operation_not_found")
        operation, approved_fact = selected
        before = execution_facts(operation)
        now = auth.now(db)
        correction_reason = body.correction_reason
        if body.action == "start":
            if operation.execution_started_at is not None:
                raise AuthError(409, "execution_already_started")
            if now.astimezone(PORTO_NOVO).date() < item.planned_start:
                raise AuthError(409, "execution_too_early")
            operation.execution_started_at = now
            action = "operation.execution_started"
        else:
            if operation.execution_started_at is None:
                raise AuthError(409, "execution_not_started")
            assert body.execution_completed is not None
            assert body.execution_observation is not None
            actual = int(body.actual_spent) if body.actual_spent is not None else None
            if actual is not None and actual > MAX_XOF:
                raise AuthError(422, "input_invalid")
            approved_allocation = int(cast(str, approved_fact["allocation"]))
            if (
                body.execution_completed
                and actual != approved_allocation
                and not body.execution_observation
            ):
                raise AuthError(422, "variance_observation_required")
            changed_existing = (
                operation.actual_spent is not None
                and actual != operation.actual_spent
                or bool(operation.execution_observation)
                and body.execution_observation != operation.execution_observation
                or operation.execution_completed
                and not body.execution_completed
            )
            if changed_existing and not correction_reason:
                raise AuthError(422, "correction_reason_required")
            if correction_reason and not changed_existing:
                raise AuthError(422, "correction_reason_unexpected")
            operation.actual_spent = actual
            operation.execution_completed = body.execution_completed
            operation.execution_observation = body.execution_observation
            after_values = execution_facts(operation)
            if before == after_values:
                raise AuthError(409, "execution_unchanged")
            aggregate = sum(
                row.actual_spent or 0
                for row in db.scalars(
                    select(Operation).where(Operation.activity_id == item.id)
                )
            )
            if aggregate > MAX_XOF:
                raise AuthError(422, "amount_overflow")
            action = (
                "operation.execution_corrected"
                if changed_existing
                else "operation.execution_recorded"
            )
        item.version += 1
        item.updated_at = now
        db.flush()
        after = execution_facts(operation)
        auth.business_audit(
            db,
            action,
            actor.id,
            operation.id,
            {
                "context_id": CONTEXT,
                "activity_id": item.id,
                "operation_id": operation.id,
                "approved_revision_id": revision.id,
                "approved_allocation": cast(str, approved_fact["allocation"]),
                "before": before,
                "after": after,
                "correction_reason": correction_reason,
            },
        )
        return execution_detail(db, item, actor.role)


@router.get(
    "/activities/{identifier}/execution/history",
    response_model=ListOutput[ExecutionHistoryItem],
)
def execution_history(
    identifier: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        principal(db, auth, evidence(request, auth)[0])
        get_activity(db, identifier, shared=True)
        limit, token = args
        cursor = Cursor(auth, "execution-history", identifier, limit)
        marker, direction = cursor.decode(token)
        base = [
            Audit.action.in_(
                {
                    "operation.execution_started",
                    "operation.execution_recorded",
                    "operation.execution_corrected",
                }
            ),
            Audit.business["activity_id"].as_string() == identifier,
        ]
        conditions = list(base)
        if marker:
            try:
                marker_id = int(marker)
            except ValueError:
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                Audit.id > marker_id if direction == "next" else Audit.id < marker_id
            )
        order = Audit.id.asc() if direction == "next" else Audit.id.desc()
        rows = list(
            db.scalars(
                select(Audit).where(*conditions).order_by(order).limit(limit + 1)
            )
        )
        total = db.scalar(select(func.count()).select_from(Audit).where(*base)) or 0
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: Audit, move: str) -> str:
            query = urlencode(
                {"limit": limit, "cursor": cursor.encode(str(row.id), move)}
            )
            return (
                f"{auth.policy.origin}/api/v1/activities/{identifier}/execution/history?"
                f"{query}"
            )

        data = []
        for row in rows:
            facts = cast(dict[str, Any], row.business)
            data.append(
                {
                    "id": str(row.id),
                    "action": row.action,
                    "actor_id": row.actor,
                    "occurred_at": row.occurred_at.isoformat(),
                    "operation_id": facts["operation_id"],
                    "approved_revision_id": facts["approved_revision_id"],
                    "approved_allocation": facts["approved_allocation"],
                    "before": facts["before"],
                    "after": facts["after"],
                    "correction_reason": facts["correction_reason"],
                }
            )
        return {
            "object": "list",
            "count": total,
            "data": data,
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }
