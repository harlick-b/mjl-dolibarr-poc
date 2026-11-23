from datetime import UTC, date, datetime
from typing import Annotated, Any, Literal, cast
from urllib.parse import urlencode
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, or_, select, text, tuple_
from sqlalchemy.orm import Session, aliased
from sqlalchemy.sql.elements import ColumnElement

from app.auth.dto import ErrorResponse
from app.auth.models import Audit, User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.core.pagination import list_args
from app.planning import activity_review
from app.planning.core.models import (
    Activity,
    ActivityAssignment,
    ActivityContributor,
    ActivityRevision,
    ActivityRevisionDecision,
    AnnualPTA,
    Operation,
    OperationType,
    Partner,
    Project,
    Subtask,
)
from app.planning.core.presentation import (
    activity_rows,
    approved_plans,
    planning_state_counts,
    planning_summary,
)
from app.planning.core.service import (
    CONTEXT,
    Cursor,
    activity_item,
    assert_types,
    build_revision_snapshot,
    clean,
    fingerprint,
    get_activity,
    get_activity_for_command,
    list_rows,
    locked_mutation,
    page_rows,
    partner_item,
    principal,
    project_item,
    reference,
    require_agent_assignment,
    revision_item,
    snapshot_projection,
    structural_content,
    type_item,
    validate_draft,
    visible_activity_condition,
)
from app.planning.core.task_hierarchy import percentage
from app.planning.dashboard import dashboard_attention_data, dashboard_finance_data
from app.planning.notifications.assignment_notifications import (
    deliver_assignment_notification,
    record_assignment_notification,
)
from app.planning.notifications.workflow_notifications import (
    deliver_workflow_notification,
    mark_review_handled,
    record_review_notifications,
)

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA planning"],
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

MUTATION_HEADERS = {
    "parameters": [
        {"in": "header", "name": name, "required": True, "schema": {"type": "string"}}
        for name in ("X-CSRF-Token", "Origin")
    ]
}


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class NameInput(Input):
    name: str = Field(min_length=1, max_length=200)

    @field_validator("name", mode="before")
    @classmethod
    def normalized_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PartnerInput(NameInput):
    description: str | None = Field(default=None, max_length=4000)

    @field_validator("description", mode="before")
    @classmethod
    def normalized_description(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class PTACreate(PartnerInput):
    year: int = Field(ge=2000, le=2200, strict=True)


class PTAUpdate(PartnerInput):
    expected_version: int = Field(gt=0, strict=True)


class PartnerUpdate(PartnerInput):
    expected: PartnerInput


class ProjectUpdate(NameInput):
    expected_version: int = Field(gt=0, strict=True)
    action: Literal["edit"]


class TypeInput(Input):
    label: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)

    @field_validator("label", mode="before")
    @classmethod
    def normalized_label(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("description", mode="before")
    @classmethod
    def normalized_description(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class ProjectInput(NameInput):
    partner_id: str = Field(max_length=36)


class ProjectClose(Input):
    expected_version: int = Field(gt=0, strict=True)
    action: Literal["close"]


class SubtaskInput(Input):
    id: str | None = Field(default=None, max_length=36)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    allocation: str = Field(min_length=1, max_length=19, pattern=r"^[1-9][0-9]*$")
    weight: str | None = Field(default=None, max_length=6)
    planned_start: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned_end: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")


class TaskInput(Input):
    id: str | None = Field(default=None, max_length=36)
    type_id: str | None = Field(default=None, max_length=36)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    allocation: str = Field(min_length=1, max_length=19, pattern=r"^[1-9][0-9]*$")
    weight: str | None = Field(default=None, max_length=6)
    planned_start: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned_end: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    subtasks: list[SubtaskInput] = Field(default_factory=list, max_length=100)

    @field_validator("name", mode="before")
    @classmethod
    def normalized_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PlanningInput(Input):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    planned_start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned_end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    allocation: str = Field(min_length=1, max_length=19, pattern=r"^[1-9][0-9]*$")
    tasks: list[TaskInput] = Field(min_length=1, max_length=100)

    @field_validator("name", "description", mode="before")
    @classmethod
    def normalized_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class DraftPlanningInput(Input):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    planned_start: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned_end: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    allocation: str | None = Field(
        default=None, max_length=19, pattern=r"^[1-9][0-9]*$"
    )
    tasks: list[TaskInput] = Field(default_factory=list, max_length=100)

    @field_validator("name", "description", mode="before")
    @classmethod
    def normalized_draft_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ActivityCreate(DraftPlanningInput):
    request_key: str = Field(max_length=36)

    @field_validator("request_key")
    @classmethod
    def uuid_key(cls, value: str) -> str:
        return str(UUID(value))


class ActivityBriefCreate(Input):
    request_key: str = Field(max_length=36)
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=4000)
    planned_start: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned_end: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    agent_ids: list[str] = Field(min_length=1, max_length=100)

    @field_validator("name", "description", mode="before")
    @classmethod
    def normalized_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("request_key")
    @classmethod
    def uuid_key(cls, value: str) -> str:
        return str(UUID(value))

    @field_validator("agent_ids")
    @classmethod
    def distinct_agents(cls, values: list[str]) -> list[str]:
        normalized = [str(UUID(value)) for value in values]
        if len(set(normalized)) != len(normalized):
            raise ValueError("Duplicate Agent")
        return sorted(normalized)


class ActivityReplace(DraftPlanningInput):
    expected_version: int = Field(gt=0, strict=True)


class AssignmentReplace(Input):
    expected_version: int = Field(gt=0, strict=True)
    agent_ids: list[str] = Field(min_length=1, max_length=100)

    @field_validator("agent_ids")
    @classmethod
    def distinct_ids(cls, values: list[str]) -> list[str]:
        normalized = [str(UUID(value)) for value in values]
        if len(set(normalized)) != len(normalized):
            raise ValueError("Duplicate Agent")
        return normalized


class SubmissionInput(Input):
    expected_version: int = Field(gt=0, strict=True)


class AmendmentInput(SubmissionInput):
    expected_approved_revision_id: str = Field(max_length=36)
    reason: str = Field(min_length=1, max_length=4000)

    @field_validator("expected_approved_revision_id")
    @classmethod
    def approved_uuid(cls, value: str) -> str:
        return str(UUID(value))

    @field_validator("reason", mode="before")
    @classmethod
    def normalized_reason(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class WithdrawalInput(AmendmentInput):
    withdrawal_id: str | None = Field(default=None, max_length=36)
    expected_revision_id: str | None = Field(default=None, max_length=36)

    @field_validator("withdrawal_id", "expected_revision_id")
    @classmethod
    def optional_uuid(cls, value: str | None) -> str | None:
        return str(UUID(value)) if value is not None else None


class WithdrawalCancellationInput(AmendmentInput):
    expected_revision_id: str = Field(max_length=36)

    @field_validator("expected_revision_id")
    @classmethod
    def revision_uuid(cls, value: str) -> str:
        return str(UUID(value))


class TransferSubtaskDates(Input):
    id: str = Field(max_length=36)
    planned_start: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned_end: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    @field_validator("id")
    @classmethod
    def identifier_uuid(cls, value: str) -> str:
        return str(UUID(value))

    @model_validator(mode="after")
    def complete_date_pair(self) -> "TransferSubtaskDates":
        if (self.planned_start is None) != (self.planned_end is None):
            raise ValueError("Transfer dates must be a complete pair")
        return self


class TransferTaskDates(TransferSubtaskDates):
    subtasks: list[TransferSubtaskDates] = Field(max_length=100)


class TransferInput(AmendmentInput):
    planned_start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned_end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    tasks: list[TransferTaskDates] = Field(max_length=100)
    transfer_id: str | None = Field(default=None, max_length=36)
    expected_revision_id: str | None = Field(default=None, max_length=36)

    @field_validator("transfer_id", "expected_revision_id")
    @classmethod
    def optional_uuid(cls, value: str | None) -> str | None:
        return str(UUID(value)) if value is not None else None


class TransferCancellationInput(WithdrawalCancellationInput):
    pass


class DecisionInput(Input):
    expected_version: int = Field(gt=0, strict=True)
    decision: Literal["prevalidate", "approve", "return"]
    reason: str | None = Field(default=None, max_length=4000)
    requested_amount: str | None = Field(
        default=None, max_length=19, pattern=r"^[1-9][0-9]*$"
    )

    @field_validator("reason", mode="before")
    @classmethod
    def normalized_reason(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PartnerOutput(Input):
    description: str | None
    id: str
    name: str
    active: bool
    allowed_actions: list[str]
    project_count: int | None = None


class TaskCategoryOutput(Input):
    id: str
    label: str
    description: str | None
    active: bool
    allowed_actions: list[str]


class ProjectOutput(Input):
    id: str
    partner_id: str
    reference: str
    name: str
    state: Literal["active", "closed"]
    version: int
    allowed_actions: list[str]
    partner_name: str | None = None


class SubtaskOutput(Input):
    id: str
    name: str
    description: str
    allocation: str
    weight: str | None
    planned_start: str | None
    planned_end: str | None
    position: int


class TaskOutput(Input):
    id: str
    type_id: str | None
    type_label: str | None = None
    name: str
    description: str = ""
    allocation: str
    weight: str | None = None
    planned_start: str | None = None
    planned_end: str | None = None
    position: int
    subtasks: list[SubtaskOutput] = Field(default_factory=list)


class CorrectionOutput(Input):
    actor_id: str
    actor_role: Literal["AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"]
    reason: str
    requested_amount: str | None


class PlanningProjection(Input):
    name: str
    description: str
    planned_start: str
    planned_end: str
    allocation: str
    tasks: list[TaskOutput]


class AmendmentTaskOutput(TaskOutput):
    type_label: str | None = None


class AmendmentPlanningProjection(Input):
    name: str
    description: str
    planned_start: str | None
    planned_end: str | None
    allocation: str | None
    tasks: list[AmendmentTaskOutput]


class AmendmentOutput(Input):
    id: str
    reason: str


class WithdrawalOutput(Input):
    id: str
    reason: str
    base_approved_revision_id: str
    current_revision_id: str
    status: Literal["pending", "withdrawn"]
    final_decision_at: str | None


class TransferSourceOutput(Input):
    id: str
    year: int


class TransferOutput(Input):
    id: str
    reason: str
    base_approved_revision_id: str
    source_pta: TransferSourceOutput
    target_year: int
    current_revision_id: str


class ActivityListItem(Input):
    planned_start: str | None
    planned_end: str | None
    state: str
    operation_count: int
    agents: list[str]
    revision_number: int | None
    id: str
    reference: str
    name: str
    allocation: str | None
    approved_revision_id: str | None
    review_action: Literal["prevalidate", "approve"] | None


class AgentOutput(Input):
    id: str
    email: str
    full_name: str | None


class ActivityAgentOption(Input):
    id: str
    label: str


class ActivityOutput(Input):
    id: str
    pta_id: str
    project_id: str
    reference: str
    name: str
    description: str
    planned_start: str | None
    planned_end: str | None
    allocation: str | None
    state: Literal[
        "draft",
        "amendment_draft",
        "submitted",
        "prevalidated",
        "returned_supervisor",
        "returned_validator",
        "approved",
        "withdrawn",
        "closed",
    ]
    version: int
    current_revision_id: str | None
    approved_revision_id: str | None
    approved_allocation: str | None
    approved: PlanningProjection | None
    candidate: AmendmentPlanningProjection | None
    amendment: AmendmentOutput | None
    withdrawal: WithdrawalOutput | None
    transfer: TransferOutput | None
    placement_year: int
    execution_paused: bool
    correction: CorrectionOutput | None
    tasks: list[TaskOutput]
    agent_ids: list[str]
    allowed_actions: list[str]
    closure: dict[str, str] | None


class ActivityDetailOutput(ActivityOutput):
    agents: list[AgentOutput]
    creator: AgentOutput
    current_revision_number: int | None
    current_submitter: AgentOutput | None
    latest_decision_actor: AgentOutput | None
    project_name: str
    partner_name: str
    pta_name: str


class PTAOutput(Input):
    name: str
    description: str | None
    version: int
    project_name: str | None = None
    partner_name: str | None = None
    project_state: str | None = None
    summary: dict[str, int | str] | None = None
    id: str
    project_id: str
    year: int
    allowed_actions: list[str] = Field(default_factory=lambda: ["read"])


class ApprovedPlanOutput(Input):
    as_of: str
    activity_count: int = Field(ge=0)
    allocation: str = Field(pattern=r"^(0|[1-9][0-9]*)$")


class PTAContextOutput(Input):
    summary: dict[str, int | str]
    project: ProjectOutput
    year: int
    pta: PTAOutput | None
    allowed_actions: list[str]
    approved_plan: ApprovedPlanOutput


class PhysicalMetricOutput(Input):
    closed_activities: int = Field(ge=0)
    approved_activities: int = Field(ge=0)


class FinancialMetricOutput(Input):
    closed_spending: str = Field(pattern=r"^(0|[1-9][0-9]*)$")
    approved_allocation: str = Field(pattern=r"^(0|[1-9][0-9]*)$")


class AnnualMetricsOutput(Input):
    pta_id: str
    as_of: str
    physical: PhysicalMetricOutput
    financial: FinancialMetricOutput


class DashboardFinanceOutput(Input):
    approved_allocation: str = Field(pattern=r"^(0|[1-9][0-9]*)$")
    recorded_spending: str | None = Field(pattern=r"^(0|[1-9][0-9]*)$")
    recorded_tasks: int = Field(ge=0)
    approved_tasks: int = Field(ge=0)
    closed_spending: str = Field(pattern=r"^(0|[1-9][0-9]*)$")
    reversement_due: str | None = Field(pattern=r"^(0|[1-9][0-9]*)$")
    reversement_confirmed: str | None = Field(pattern=r"^(0|[1-9][0-9]*)$")


class DashboardAttentionItem(Input):
    activity_id: str
    reference: str
    name: str
    reason: Literal[
        "draft_to_complete",
        "correction_requested",
        "planning_prevalidation",
        "planning_approval",
        "funding_prevalidation",
        "funding_approval",
        "disbursement_prevalidation",
        "disbursement_approval",
        "zero_spending_prevalidation",
        "zero_spending_approval",
        "virement_prevalidation",
        "virement_approval",
        "reversement_required",
    ]
    action: Literal["review_planning", "review_finance", "declare_reversement"]
    destination: Literal["planning", "execution"]


class DashboardAttentionOutput(Input):
    count: int = Field(ge=0)
    items: list[DashboardAttentionItem] = Field(max_length=3)


class DashboardOutput(AnnualMetricsOutput):
    finance: DashboardFinanceOutput
    attention: DashboardAttentionOutput


def annual_metrics_data(
    db: Session, pta: AnnualPTA, cutoff: datetime
) -> dict[str, Any]:
    plan = approved_plans(db, [(pta.project_id, pta.year)], cutoff)[
        (pta.project_id, pta.year)
    ]
    realized = db.execute(
        select(
            func.count(func.distinct(Activity.id)).label("activity_count"),
            func.coalesce(func.sum(Operation.actual_spent), 0).label("spending"),
        )
        .join(Operation, Operation.activity_id == Activity.id)
        .where(
            Activity.pta_id == pta.id,
            Activity.state == "closed",
            Operation.removed_at.is_(None),
        )
    ).one()
    return {
        "pta_id": pta.id,
        "as_of": plan["as_of"],
        "physical": {
            "closed_activities": int(realized.activity_count),
            "approved_activities": plan["activity_count"],
        },
        "financial": {
            "closed_spending": str(realized.spending),
            "approved_allocation": plan["allocation"],
        },
    }


def locked_read(db: Session) -> None:
    db.execute(text("SELECT pg_advisory_xact_lock_shared(1843201)"))


def cutoff_value(db: Session, raw: str | None) -> datetime:
    now = db.scalar(select(func.statement_timestamp()))
    assert isinstance(now, datetime)
    if raw is None:
        return now
    try:
        cutoff = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        raise AuthError(422, "as_of_invalid") from None
    if cutoff.tzinfo is None or cutoff.astimezone(UTC) > now.astimezone(UTC):
        raise AuthError(422, "as_of_invalid")
    return cutoff.astimezone(UTC)


class SnapshotIdentity(Input):
    id: str
    email: str
    role: Literal["AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"]


class SnapshotPartner(Input):
    id: str
    name: str


class SnapshotProject(Input):
    id: str
    reference: str
    name: str


class SnapshotPTA(Input):
    id: str | None
    year: int


class SnapshotActivity(Input):
    id: str
    reference: str


class SnapshotOperation(TaskOutput):
    type_label: str


class WithdrawalRevisionFacts(Input):
    id: str = Field(
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    )
    reason: str = Field(min_length=1, max_length=4000)
    base_approved_revision_id: str = Field(
        pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
    )


class TransferRevisionFacts(Input):
    id: str
    reason: str = Field(min_length=1, max_length=4000)
    base_approved_revision_id: str
    source_pta: TransferSourceOutput
    target_year: int = Field(ge=2000, le=2200)


class RevisionSnapshot(Input):
    context_id: Literal["MJL"]
    partner: SnapshotPartner
    project: SnapshotProject
    pta: SnapshotPTA
    activity: SnapshotActivity
    name: str
    description: str
    planned_start: str
    planned_end: str
    allocation: str
    tasks: list[SnapshotOperation]
    agent_ids: list[str]
    agents: list[SnapshotIdentity]
    submitter: SnapshotIdentity
    submitted_at: str
    contributors: list[SnapshotIdentity]
    amendment_id: str | None = None
    amendment_reason: str | None = None
    base_approved_revision_id: str | None = None
    withdrawal: WithdrawalRevisionFacts | None = None
    transfer: TransferRevisionFacts | None = None
    content_fingerprint: str = Field(pattern=r"^[0-9a-f]{64}$")

    @model_validator(mode="after")
    def transfer_pta_identity(self) -> "RevisionSnapshot":
        if (self.pta.id is None) != (self.transfer is not None):
            raise ValueError("PTA identity may be absent only for a transfer revision")
        return self


class AmendmentCancellationOutput(Input):
    reason: str
    actor_id: str
    occurred_at: str


class AmendmentDetailOutput(Input):
    id: str
    activity_id: str
    reason: str
    base_approved_revision_id: str
    opened_by_id: str
    opened_at: str
    status: Literal["active", "approved", "cancelled"]
    candidate: AmendmentPlanningProjection
    last_revision_id: str | None
    cancellation: AmendmentCancellationOutput | None


class RevisionDecisionOutput(Input):
    id: str
    stage: Literal["supervisor", "validator"]
    outcome: Literal["prevalidated", "approved", "returned"]
    actor_id: str
    actor_role: Literal["AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"]
    decided_at: str
    reason: str | None
    requested_amount: str | None
    prevalidation_revision_id: str | None


class RevisionOutput(Input):
    id: str
    activity_id: str
    revision_number: int
    fingerprint: str
    submitter_id: str
    submitted_at: str
    snapshot: RevisionSnapshot | None = None
    decisions: list[RevisionDecisionOutput]
    activity_version: int | None = None


class HistoryOutput(Input):
    id: str
    kind: Literal[
        "revision",
        "amendment_open",
        "amendment_cancel",
        "withdrawal_cancel",
        "transfer_cancel",
    ]
    occurred_at: str
    activity_id: str | None = None
    revision_number: int | None = None
    fingerprint: str | None = None
    submitter_id: str | None = None
    submitted_at: str | None = None
    decisions: list[RevisionDecisionOutput] = Field(default_factory=list)
    amendment_id: str | None = None
    withdrawal_id: str | None = None
    transfer_id: str | None = None
    reason: str | None = None
    actor_id: str | None = None


class DecisionOutput(Input):
    id: str
    stage: Literal["supervisor", "validator"]
    outcome: Literal["prevalidated", "approved", "returned"]
    actor_id: str
    actor_role: Literal["AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"]
    decided_at: str
    reason: str | None
    requested_amount: str | None
    prevalidation_revision_id: str | None
    activity_version: int


class ListOutput[Item](Input):
    object: Literal["list"]
    count: int
    data: list[Item]
    next: str | None
    previous: str | None


def created(
    request: Request, path: str, payload: dict[str, Any], status: int = 201
) -> Response:
    from fastapi.responses import JSONResponse

    response = JSONResponse(payload, status_code=status)
    if status == 201:
        response.headers["Location"] = f"{request.app.state.auth.policy.origin}{path}"
    return response


@router.get("/partners", response_model=ListOutput[PartnerOutput])
def partners(
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(
            db,
            auth,
            evidence(request, auth)[0],
            roles={
                "ADMIN_PLATEFORME",
                "AGENT_SAISIE",
                "AGENT_VERIFICATEUR",
                "VALIDATEUR_DEFINITIF",
            },
        )
        result = list_rows(
            db,
            auth,
            Partner,
            "partners",
            CONTEXT,
            actor.role,
            *args,
            where=(Partner.context_id == CONTEXT,),
        )
        ids = [row["id"] for row in result["data"]]
        counts = dict(
            db.execute(
                select(Project.partner_id, func.count())
                .where(Project.partner_id.in_(ids), Project.context_id == CONTEXT)
                .group_by(Project.partner_id)
            ).all()
        )
        for row in result["data"]:
            row["project_count"] = counts.get(row["id"], 0)
        return result


@router.post(
    "/partners",
    status_code=201,
    response_model=PartnerOutput,
    openapi_extra=MUTATION_HEADERS,
)
def create_partner(body: PartnerInput, request: Request, auth: Auth) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            *evidence(request, auth),
            roles={"VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        now = auth.now(db)
        item = Partner(
            context_id=CONTEXT,
            name=clean(body.name, 200),
            description=body.description,
            active=True,
            creator_id=actor.id,
            created_at=now,
            updated_at=now,
        )
        db.add(item)
        db.flush()
        auth.business_audit(
            db,
            "partner.create",
            actor.id,
            item.id,
            {"context_id": CONTEXT, "after": partner_item(item, actor.role)},
        )
        return created(
            request, f"/api/v1/partners/{item.id}", partner_item(item, actor.role)
        )


@router.patch(
    "/partners/{identifier}",
    response_model=PartnerOutput,
    openapi_extra=MUTATION_HEADERS,
)
def update_partner(
    identifier: str, body: PartnerUpdate, request: Request, auth: Auth
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            *evidence(request, auth),
            roles={"VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        item = db.get(Partner, identifier, with_for_update=True)
        if not item or item.context_id != CONTEXT:
            raise AuthError(404, "partner_not_found")
        if (item.name, item.description) != (
            body.expected.name,
            body.expected.description,
        ):
            raise AuthError(409, "partner_stale")
        if (item.name, item.description) != (body.name, body.description):
            before = partner_item(item, actor.role)
            item.name, item.description = body.name, body.description
            item.updated_at = auth.now(db)
            auth.business_audit(
                db,
                "partner.update",
                actor.id,
                item.id,
                {
                    "context_id": CONTEXT,
                    "before": before,
                    "after": partner_item(item, actor.role),
                },
            )
        return partner_item(item, actor.role)


@router.get("/task-categories", response_model=ListOutput[TaskCategoryOutput])
def operation_types(
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        return list_rows(
            db,
            auth,
            OperationType,
            "task-categories",
            CONTEXT,
            actor.role,
            *args,
            where=(OperationType.context_id == CONTEXT,),
        )


@router.post(
    "/task-categories",
    status_code=201,
    response_model=TaskCategoryOutput,
    openapi_extra=MUTATION_HEADERS,
)
def create_operation_type(body: TypeInput, request: Request, auth: Auth) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            *evidence(request, auth),
            roles={"AGENT_SAISIE", "VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        now = auth.now(db)
        item = OperationType(
            context_id=CONTEXT,
            label=clean(body.label, 200),
            description=body.description,
            active=True,
            creator_id=actor.id,
            created_at=now,
            updated_at=now,
        )
        db.add(item)
        db.flush()
        auth.business_audit(
            db,
            "operation_type.create",
            actor.id,
            item.id,
            {"context_id": CONTEXT, "after": type_item(item, actor.role)},
        )
        return created(
            request, f"/api/v1/task-categories/{item.id}", type_item(item, actor.role)
        )


@router.get("/projects", response_model=ListOutput[ProjectOutput])
def projects(
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
    state: Annotated[Literal["active", "closed"] | None, Query()] = None,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        result = list_rows(
            db,
            auth,
            Project,
            "projects",
            CONTEXT if state is None else f"{CONTEXT}:{state}",
            actor.role,
            *args,
            where=(
                Project.context_id == CONTEXT,
                *((Project.state == state,) if state else ()),
            ),
        )
        if state:
            for direction in ("next", "previous"):
                if result[direction]:
                    result[direction] += f"&state={state}"
        ids = {row["partner_id"] for row in result["data"]}
        names = dict(
            db.execute(
                select(Partner.id, Partner.name).where(
                    Partner.id.in_(ids), Partner.context_id == CONTEXT
                )
            ).all()
        )
        for row in result["data"]:
            row["partner_name"] = names.get(row["partner_id"])
        return result


@router.post(
    "/projects",
    status_code=201,
    response_model=ProjectOutput,
    openapi_extra=MUTATION_HEADERS,
)
def create_project(body: ProjectInput, request: Request, auth: Auth) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            *evidence(request, auth),
            roles={"VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        partner = db.get(Partner, body.partner_id, with_for_update=True)
        if not partner or partner.context_id != CONTEXT:
            raise AuthError(404, "partner_not_found")
        if not partner.active:
            raise AuthError(409, "partner_inactive")
        if db.scalar(
            select(Project.id).where(
                Project.partner_id == partner.id, Project.state == "active"
            )
        ):
            raise AuthError(409, "active_project_exists")
        now = auth.now(db)
        item = Project(
            context_id=CONTEXT,
            partner_id=partner.id,
            reference=reference(db, "pta_project_reference_seq", "PRJ"),
            name=clean(body.name, 200),
            state="active",
            version=1,
            creator_id=actor.id,
            created_at=now,
            updated_at=now,
        )
        db.add(item)
        db.flush()
        auth.business_audit(
            db,
            "project.create",
            actor.id,
            item.id,
            {"context_id": CONTEXT, "after": project_item(item, actor.role)},
        )
        return created(
            request, f"/api/v1/projects/{item.id}", project_item(item, actor.role)
        )


def get_project(db: Session, identifier: str, *, lock: bool = False) -> Project:
    item = db.get(Project, identifier, with_for_update=lock)
    if not item or item.context_id != CONTEXT:
        raise AuthError(404, "project_not_found")
    return item


@router.get("/projects/{identifier}", response_model=ProjectOutput)
def project_detail(identifier: str, request: Request, auth: Auth) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        return project_item(get_project(db, identifier), actor.role)


@router.patch(
    "/projects/{identifier}",
    response_model=ProjectOutput,
    openapi_extra=MUTATION_HEADERS,
)
def close_project(
    identifier: str, body: ProjectClose | ProjectUpdate, request: Request, auth: Auth
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            *evidence(request, auth),
            roles={"VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        item = get_project(db, identifier, lock=True)
        if item.version != body.expected_version:
            raise AuthError(409, "project_stale")
        if isinstance(body, ProjectUpdate):
            if item.name != body.name:
                before = project_item(item, actor.role)
                item.name = body.name
                item.version += 1
                item.updated_at = auth.now(db)
                auth.business_audit(
                    db,
                    "project.update",
                    actor.id,
                    item.id,
                    {
                        "context_id": CONTEXT,
                        "before": before,
                        "after": project_item(item, actor.role),
                    },
                )
            return project_item(item, actor.role)
        if item.state != "active":
            raise AuthError(409, "project_closed")
        if db.scalar(
            select(Activity.id)
            .join(AnnualPTA, Activity.pta_id == AnnualPTA.id)
            .where(
                AnnualPTA.project_id == item.id,
                Activity.state.notin_(("closed", "withdrawn")),
            )
            .limit(1)
        ):
            raise AuthError(409, "project_not_empty")
        before = project_item(item, actor.role)
        item.state = "closed"
        item.version += 1
        item.updated_at = auth.now(db)
        auth.business_audit(
            db,
            "project.close",
            actor.id,
            item.id,
            {
                "context_id": CONTEXT,
                "before": before,
                "after": project_item(item, actor.role),
            },
        )
        return project_item(item, actor.role)


def pta_metadata(item: AnnualPTA, role: str) -> dict[str, Any]:
    return {
        "id": item.id,
        "project_id": item.project_id,
        "year": item.year,
        "name": item.name,
        "description": item.description,
        "version": item.version,
        "allowed_actions": ["read", "edit"]
        if role in {"AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"}
        else ["read"],
    }


@router.post(
    "/projects/{identifier}/ptas",
    status_code=201,
    response_model=PTAOutput,
    openapi_extra=MUTATION_HEADERS,
)
def create_pta(
    identifier: str, body: PTACreate, request: Request, auth: Auth
) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            *evidence(request, auth),
            roles={"AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        project = get_project(db, identifier, lock=True)
        if project.state != "active":
            raise AuthError(409, "project_closed")
        if db.scalar(
            select(AnnualPTA.id).where(
                AnnualPTA.project_id == identifier, AnnualPTA.year == body.year
            )
        ):
            raise AuthError(409, "pta_exists")
        item = AnnualPTA(
            context_id=CONTEXT,
            project_id=identifier,
            year=body.year,
            name=body.name,
            description=body.description,
            version=1,
            creator_id=actor.id,
            created_at=auth.now(db),
        )
        db.add(item)
        db.flush()
        result = pta_metadata(item, actor.role)
        auth.business_audit(
            db,
            "pta.create",
            actor.id,
            item.id,
            {"context_id": CONTEXT, "after": result},
        )
        return created(
            request, f"/api/v1/projects/{identifier}/ptas/{body.year}", result
        )


@router.patch(
    "/ptas/{identifier}", response_model=PTAOutput, openapi_extra=MUTATION_HEADERS
)
def update_pta(
    identifier: str, body: PTAUpdate, request: Request, auth: Auth
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
        item = db.get(AnnualPTA, identifier, with_for_update=True)
        if not item or item.context_id != CONTEXT:
            raise AuthError(404, "pta_not_found")
        if item.version != body.expected_version:
            raise AuthError(409, "pta_stale")
        before = pta_metadata(item, actor.role)
        if item.name == body.name and item.description == body.description:
            return before
        item.name, item.description = body.name, body.description
        item.version += 1
        db.flush()
        result = pta_metadata(item, actor.role)
        auth.business_audit(
            db,
            "pta.update",
            actor.id,
            item.id,
            {"context_id": CONTEXT, "before": before, "after": result},
        )
        return result


@router.get("/ptas", response_model=ListOutput[PTAOutput])
@router.get("/projects/{identifier}/ptas", response_model=ListOutput[PTAOutput])
def project_ptas(
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
    identifier: str | None = None,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor = principal(db, auth, evidence(request, auth)[0])
        if identifier:
            get_project(db, identifier)
        limit, token = args
        cursor = Cursor(auth, "project-ptas", identifier or CONTEXT, limit)
        marker, direction = cursor.decode(token)
        base = (
            (AnnualPTA.project_id == identifier,)
            if identifier
            else (AnnualPTA.context_id == CONTEXT,)
        )
        conditions = list(base)
        if marker:
            try:
                marker_created_raw, marker_id_raw = marker.split("|", 1)
                marker_created = datetime.fromisoformat(marker_created_raw)
                marker_id = str(UUID(marker_id_raw))
            except ValueError:
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                tuple_(AnnualPTA.created_at, AnnualPTA.id)
                < tuple_(marker_created, marker_id)
                if direction == "next"
                else tuple_(AnnualPTA.created_at, AnnualPTA.id)
                > tuple_(marker_created, marker_id)
            )
        ordering = (
            (AnnualPTA.created_at.desc(), AnnualPTA.id.desc())
            if direction == "next"
            else (AnnualPTA.created_at.asc(), AnnualPTA.id.asc())
        )
        rows, total = page_rows(
            db,
            AnnualPTA,
            base,
            tuple(conditions),
            ordering,
            limit,
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: AnnualPTA, move: str) -> str:
            value = cursor.encode(f"{row.created_at.isoformat()}|{row.id}", move)
            query = urlencode({"limit": limit, "cursor": value})
            path = f"/projects/{identifier}/ptas" if identifier else "/ptas"
            return f"{auth.policy.origin}/api/v1{path}?{query}"

        project_rows = {
            p.id: p
            for p in db.scalars(
                select(Project).where(Project.id.in_([row.project_id for row in rows]))
            )
        }
        partner_names = dict(
            db.execute(
                select(Partner.id, Partner.name).where(
                    Partner.id.in_([p.partner_id for p in project_rows.values()])
                )
            ).all()
        )
        plans = approved_plans(
            db, [(row.project_id, row.year) for row in rows], auth.now(db)
        )
        counts = planning_state_counts(db, [row.id for row in rows], actor.id)
        return {
            "object": "list",
            "count": total,
            "data": [
                {
                    **pta_metadata(row, actor.role),
                    "project_name": project_rows[row.project_id].name,
                    "project_state": project_rows[row.project_id].state,
                    "partner_name": partner_names.get(
                        project_rows[row.project_id].partner_id
                    ),
                    "year": row.year,
                    "summary": planning_summary(
                        counts.get(row.id, {}),
                        plans[(row.project_id, row.year)]["allocation"],
                    ),
                }
                for row in rows
            ],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }


@router.get("/projects/{identifier}/ptas/{year}", response_model=PTAContextOutput)
def pta_context(
    identifier: str,
    year: int,
    request: Request,
    auth: Auth,
    as_of: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor = principal(db, auth, evidence(request, auth)[0])
        project = get_project(db, identifier)
        if not 2000 <= year <= 2200:
            raise AuthError(422, "input_invalid")
        pta = db.scalar(
            select(AnnualPTA).where(
                AnnualPTA.project_id == project.id, AnnualPTA.year == year
            )
        )
        cutoff = cutoff_value(db, as_of)
        plan = approved_plans(db, [(project.id, year)], cutoff)[(project.id, year)]
        counts = planning_state_counts(db, [pta.id] if pta else [], actor.id)
        return {
            "project": {
                **project_item(project, actor.role),
                "partner_name": db.scalar(
                    select(Partner.name).where(
                        Partner.id == project.partner_id, Partner.context_id == CONTEXT
                    )
                ),
            },
            "year": year,
            "pta": None if not pta else pta_metadata(pta, actor.role),
            "allowed_actions": ["read"]
            + (
                ["create_activity"]
                if pta
                and actor.role
                in {"AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"}
                and project.state == "active"
                else []
            ),
            "approved_plan": plan,
            "summary": planning_summary(
                counts.get(pta.id, {}) if pta else {},
                plan["allocation"],
            ),
        }


def normalized_body(body: PlanningInput | DraftPlanningInput) -> dict[str, Any]:
    return body.model_dump(mode="json", exclude={"expected_version", "request_key"})


@router.post(
    "/projects/{identifier}/ptas/{year}/activities",
    status_code=201,
    response_model=ActivityOutput,
    responses={200: {"model": ActivityOutput, "description": "Idempotent replay"}},
    openapi_extra=MUTATION_HEADERS,
)
def create_activity(
    identifier: str,
    year: int,
    body: ActivityCreate | ActivityBriefCreate,
    request: Request,
    auth: Auth,
    background_tasks: BackgroundTasks,
) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            *evidence(request, auth),
            roles={"AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        project = get_project(db, identifier, lock=True)
        if project.state != "active":
            raise AuthError(409, "project_closed")
        plan: dict[str, Any]
        operations: list[dict[str, Any]]
        brief = isinstance(body, ActivityBriefCreate)
        if brief == (actor.role == "AGENT_SAISIE"):
            raise AuthError(403, "business_forbidden")
        if isinstance(body, ActivityBriefCreate):
            try:
                start = (
                    date.fromisoformat(body.planned_start)
                    if body.planned_start
                    else None
                )
                end = date.fromisoformat(body.planned_end) if body.planned_end else None
            except ValueError:
                raise AuthError(422, "input_invalid") from None
            if (
                not 2000 <= year <= 2200
                or (start and start.year != year)
                or (start and end and end < start)
            ):
                raise AuthError(422, "input_invalid")
            plan = {
                "name": body.name,
                "description": body.description,
                "planned_start": start,
                "planned_end": end,
                "allocation": None,
            }
            operations = []
            agent_ids = body.agent_ids
        else:
            plan, operations = validate_draft(normalized_body(body), year)
            if any(row["id"] for row in operations):
                raise AuthError(422, "input_invalid")
            agent_ids = [actor.id]
        canonical = {
            **plan,
            "planned_start": (
                plan["planned_start"].isoformat() if plan["planned_start"] else None
            ),
            "planned_end": (
                plan["planned_end"].isoformat() if plan["planned_end"] else None
            ),
            "allocation": str(plan["allocation"])
            if plan["allocation"] is not None
            else None,
            "tasks": [
                {
                    "type_id": row["type_id"],
                    "name": row["name"],
                    "description": row["description"],
                    "allocation": str(row["allocation"]),
                    "weight_basis_points": row["weight_basis_points"],
                    "planned_start": row["planned_start"].isoformat()
                    if row["planned_start"]
                    else None,
                    "planned_end": row["planned_end"].isoformat()
                    if row["planned_end"]
                    else None,
                    "position": row["position"],
                    "subtasks": [
                        {
                            **child,
                            "allocation": str(child["allocation"]),
                            "planned_start": child["planned_start"].isoformat()
                            if child["planned_start"]
                            else None,
                            "planned_end": child["planned_end"].isoformat()
                            if child["planned_end"]
                            else None,
                        }
                        for child in row["subtasks"]
                    ],
                }
                for row in operations
            ],
        }
        if brief:
            canonical["agent_ids"] = agent_ids
        digest = fingerprint(canonical)
        existing = db.scalar(
            select(Activity).where(
                Activity.context_id == CONTEXT,
                Activity.request_actor_id == actor.id,
                Activity.request_project_id == project.id,
                Activity.request_year == year,
                Activity.request_key == body.request_key,
            )
        )
        if existing:
            if existing.request_fingerprint != digest:
                raise AuthError(409, "request_key_conflict")
            return created(
                request,
                f"/api/v1/activities/{existing.id}",
                activity_item(db, existing, actor.role, actor.id),
                200,
            )
        targets = list(
            db.scalars(
                select(User)
                .where(User.id.in_(agent_ids))
                .order_by(User.id)
                .with_for_update()
            )
        )
        if len(targets) != len(agent_ids) or any(
            user.role != "AGENT_SAISIE" or user.state != "active" for user in targets
        ):
            raise AuthError(409, "assignment_ineligible")
        assert_types(db, operations)
        pta = db.scalar(
            select(AnnualPTA)
            .where(AnnualPTA.project_id == project.id, AnnualPTA.year == year)
            .with_for_update()
        )
        now = auth.now(db)
        if not pta:
            raise AuthError(409, "pta_required")
        item = Activity(
            context_id=CONTEXT,
            pta_id=pta.id,
            reference=reference(db, "pta_activity_reference_seq", "ACT"),
            **plan,
            state="draft",
            version=1,
            creator_id=actor.id,
            request_actor_id=actor.id,
            request_project_id=project.id,
            request_year=year,
            placement_year=year,
            request_key=body.request_key,
            request_fingerprint=digest,
            created_at=now,
            updated_at=now,
        )
        db.add(item)
        db.flush()
        for row in operations:
            task = Operation(
                context_id=CONTEXT,
                activity_id=item.id,
                type_id=row["type_id"],
                name=row["name"],
                description=row["description"],
                allocation=row["allocation"],
                weight_basis_points=row["weight_basis_points"],
                planned_start=row["planned_start"],
                planned_end=row["planned_end"],
                position=row["position"],
                creator_id=actor.id,
                updated_by_id=actor.id,
                created_at=now,
                updated_at=now,
            )
            db.add(task)
            db.flush()
            for child in row["subtasks"]:
                db.add(
                    Subtask(
                        context_id=CONTEXT,
                        activity_id=item.id,
                        task_id=task.id,
                        name=child["name"],
                        description=child["description"],
                        allocation=child["allocation"],
                        weight_basis_points=child["weight_basis_points"],
                        planned_start=child["planned_start"],
                        planned_end=child["planned_end"],
                        position=child["position"],
                        creator_id=actor.id,
                        updated_by_id=actor.id,
                        created_at=now,
                        updated_at=now,
                    )
                )
        db.flush()
        db.add(
            ActivityContributor(
                context_id=CONTEXT,
                activity_id=item.id,
                user_id=actor.id,
                contributed_at=now,
                kind=(
                    "supervisor_creation"
                    if actor.role == "AGENT_VERIFICATEUR"
                    else "validator_creation"
                )
                if brief
                else "content",
            )
        )
        notification_ids: list[str] = []
        for agent_id in agent_ids:
            assignment = ActivityAssignment(
                context_id=CONTEXT,
                activity_id=item.id,
                agent_id=agent_id,
                assigned_by_id=actor.id,
                assigned_at=now,
            )
            db.add(assignment)
            db.flush()
            if brief:
                notification_ids.append(
                    record_assignment_notification(db, auth, assignment)
                )
        db.flush()
        result = activity_item(db, item, actor.role, actor.id)
        auth.business_audit(
            db,
            "activity.create",
            actor.id,
            item.id,
            {"context_id": CONTEXT, "after": result},
        )
        for notification_id in notification_ids:
            background_tasks.add_task(
                deliver_assignment_notification, auth, notification_id
            )
        return created(request, f"/api/v1/activities/{item.id}", result)


@router.get("/ptas/{identifier}/metrics", response_model=AnnualMetricsOutput)
def annual_metrics(identifier: str, request: Request, auth: Auth) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        principal(db, auth, evidence(request, auth)[0])
        pta = db.get(AnnualPTA, identifier)
        if not pta or pta.context_id != CONTEXT:
            raise AuthError(404, "pta_not_found")
        cutoff = cutoff_value(db, None)
        return annual_metrics_data(db, pta, cutoff)


@router.get("/ptas/{identifier}/dashboard", response_model=DashboardOutput)
def dashboard(identifier: str, request: Request, auth: Auth) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor = principal(
            db,
            auth,
            evidence(request, auth)[0],
            roles={"AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"},
        )
        pta = db.get(AnnualPTA, identifier)
        if not pta or pta.context_id != CONTEXT:
            raise AuthError(404, "pta_not_found")
        cutoff = cutoff_value(db, None)
        metrics = annual_metrics_data(db, pta, cutoff)
        return {
            **metrics,
            "finance": dashboard_finance_data(db, pta, metrics),
            "attention": dashboard_attention_data(db, pta, actor),
        }


@router.get(
    "/ptas/{identifier}/activities", response_model=ListOutput[ActivityListItem]
)
def activities(
    identifier: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
    q: Annotated[str, Query(max_length=200)] = "",
    state: Literal[
        "",
        "draft",
        "amendment_draft",
        "submitted",
        "prevalidated",
        "returned_supervisor",
        "returned_validator",
        "approved",
        "withdrawn",
        "closed",
        "returned",
    ] = "",
    review: Literal["", "mine"] = "",
    agent: UUID | None = None,
    period_from: Annotated[date | None, Query(alias="from")] = None,
    period_to: Annotated[date | None, Query(alias="to")] = None,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor = principal(db, auth, evidence(request, auth)[0])
        pta = db.get(AnnualPTA, identifier)
        if not pta or pta.context_id != CONTEXT:
            raise AuthError(404, "pta_not_found")
        limit, token = args
        q = q.strip()
        if period_from and period_to and period_from > period_to:
            raise AuthError(422, "period_invalid")
        filters = {
            key: value
            for key, value in {
                "q": q,
                "state": state,
                "review": review,
                "agent": str(agent) if agent else "",
                "from": period_from.isoformat() if period_from else "",
                "to": period_to.isoformat() if period_to else "",
            }.items()
            if value
        }
        scope = fingerprint({"pta": pta.id, **filters})
        cursor = Cursor(auth, "pta-activities", scope, limit)
        marker, direction = cursor.decode(token)
        base = [Activity.pta_id == pta.id, visible_activity_condition(actor.id)]
        if q:
            pattern = (
                "%"
                + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                + "%"
            )
            base.append(
                or_(Activity.name.ilike(pattern), Activity.reference.ilike(pattern))
            )
        if state == "returned":
            base.append(
                Activity.state.in_(("returned_supervisor", "returned_validator"))
            )
        elif state:
            base.append(Activity.state == state)
        if review == "mine":
            if actor.role == "AGENT_VERIFICATEUR":
                base.extend(
                    [
                        Activity.state == "submitted",
                        ~select(ActivityContributor.id)
                        .where(
                            ActivityContributor.activity_id == Activity.id,
                            ActivityContributor.user_id == actor.id,
                            ActivityContributor.kind == "content",
                        )
                        .exists(),
                    ]
                )
            elif actor.role == "VALIDATEUR_DEFINITIF":
                base.extend(
                    [
                        Activity.state == "prevalidated",
                        ~select(ActivityContributor.id)
                        .where(
                            ActivityContributor.activity_id == Activity.id,
                            ActivityContributor.user_id == actor.id,
                            ActivityContributor.kind == "content",
                        )
                        .exists(),
                        ~select(ActivityRevisionDecision.id)
                        .where(
                            ActivityRevisionDecision.revision_id
                            == Activity.current_revision_id,
                            ActivityRevisionDecision.stage == "supervisor",
                            ActivityRevisionDecision.outcome == "prevalidated",
                            ActivityRevisionDecision.actor_id == actor.id,
                        )
                        .exists(),
                    ]
                )
            else:
                raise AuthError(403, "role_forbidden")
        if agent:
            base.append(
                select(ActivityAssignment.id)
                .where(
                    ActivityAssignment.activity_id == Activity.id,
                    ActivityAssignment.agent_id == str(agent),
                    ActivityAssignment.ended_at.is_(None),
                )
                .exists()
            )
        if period_from:
            base.append(Activity.planned_start.is_not(None))
            base.append(
                func.coalesce(Activity.planned_end, Activity.planned_start)
                >= period_from
            )
        if period_to:
            base.append(Activity.planned_start <= period_to)
        conditions = list(base)
        if marker:
            try:
                marker_created_raw, marker_id_raw = marker.split("|", 1)
                marker_created = datetime.fromisoformat(marker_created_raw)
                marker_id = str(UUID(marker_id_raw))
            except ValueError:
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                tuple_(Activity.created_at, Activity.id)
                < tuple_(marker_created, marker_id)
                if direction == "next"
                else tuple_(Activity.created_at, Activity.id)
                > tuple_(marker_created, marker_id)
            )
        order = (
            (Activity.created_at.desc(), Activity.id.desc())
            if direction == "next"
            else (Activity.created_at.asc(), Activity.id.asc())
        )
        rows, total = page_rows(
            db,
            Activity,
            tuple(base),
            tuple(conditions),
            order,
            limit,
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()
        if rows:
            locked = {
                row.id: row
                for row in db.scalars(
                    select(Activity)
                    .where(Activity.id.in_([row.id for row in rows]))
                    .order_by(Activity.id)
                    .with_for_update(read=True)
                )
            }
            rows = [locked[row.id] for row in rows]

        def link(row: Activity, move: str) -> str:
            value = cursor.encode(f"{row.created_at.isoformat()}|{row.id}", move)
            query = urlencode({**filters, "limit": limit, "cursor": value})
            return f"{auth.policy.origin}/api/v1/ptas/{pta.id}/activities?{query}"

        return {
            "object": "list",
            "count": total,
            "data": activity_rows(db, rows, actor_id=actor.id, actor_role=actor.role),
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }


@router.get(
    "/ptas/{identifier}/activity-agents",
    response_model=ListOutput[ActivityAgentOption],
)
def activity_agents(
    identifier: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
    q: Annotated[str, Query(max_length=200)] = "",
    selected: UUID | None = None,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        pta = db.get(AnnualPTA, identifier)
        if not pta or pta.context_id != CONTEXT:
            raise AuthError(404, "pta_not_found")
        limit, token = args
        q = q.strip()
        scope = (
            pta.id
            if not q and not selected
            else fingerprint({"pta": pta.id, "q": q, "selected": str(selected or "")})
        )
        cursor = Cursor(auth, "pta-activity-agents", scope, limit)
        marker, direction = cursor.decode(token)
        listed_assignment = aliased(ActivityAssignment)
        assigned = (
            select(listed_assignment.id)
            .join(Activity, Activity.id == listed_assignment.activity_id)
            .where(
                Activity.pta_id == pta.id,
                visible_activity_condition(actor.id),
                listed_assignment.agent_id == User.id,
                listed_assignment.ended_at.is_(None),
            )
            .exists()
        )
        base: list[ColumnElement[bool]] = [assigned]
        if selected:
            base.append(User.id == str(selected))
        if q:
            base.append(
                func.lower(
                    func.coalesce(User.full_name, "") + " " + User.email
                ).contains(q.lower(), autoescape=True)
            )
        conditions = list(base)
        if marker:
            try:
                marker = str(UUID(marker))
            except ValueError:
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                User.id > marker if direction == "next" else User.id < marker
            )
        rows, total = page_rows(
            db,
            User,
            tuple(base),
            tuple(conditions),
            (User.id.asc() if direction == "next" else User.id.desc(),),
            limit,
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: User, move: str) -> str:
            query = urlencode(
                {
                    "limit": limit,
                    "cursor": cursor.encode(row.id, move),
                    **({"q": q} if q else {}),
                    **({"selected": str(selected)} if selected else {}),
                }
            )
            return f"{auth.policy.origin}/api/v1/ptas/{pta.id}/activity-agents?{query}"

        return {
            "object": "list",
            "count": total,
            "data": [
                {"id": row.id, "label": row.full_name or row.email} for row in rows
            ],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }


@router.get("/activities/{identifier}", response_model=ActivityDetailOutput)
def activity_detail(identifier: str, request: Request, auth: Auth) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, actor=actor, shared=True)
        return activity_item(db, item, actor.role, actor.id, presentation=True)


def _reviewed_transfer_dates(
    base_operations: list[dict[str, Any]],
    submitted: list[TransferTaskDates],
    *,
    source_start: date,
    target_start: date,
    target_end: date,
) -> dict[str, TransferTaskDates]:
    submitted_by_id = {row.id: row for row in submitted}
    if len(submitted_by_id) != len(submitted) or set(submitted_by_id) != {
        cast(str, row.get("id")) for row in base_operations
    }:
        raise AuthError(409, "transfer_hierarchy_stale")
    delta = target_start - source_start
    for fact in base_operations:
        task_id = cast(str, fact["id"])
        task = submitted_by_id[task_id]
        expected_start = activity_review.shifted_date(fact.get("planned_start"), delta)
        expected_end = activity_review.shifted_date(fact.get("planned_end"), delta)
        if (task.planned_start, task.planned_end) != (expected_start, expected_end):
            raise AuthError(422, "transfer_dates_invalid")
        if expected_start and (
            expected_start < target_start.isoformat()
            or cast(str, expected_end) > target_end.isoformat()
        ):
            raise AuthError(422, "transfer_dates_outside_activity")
        child_facts = [
            cast(dict[str, Any], child)
            for child in fact.get("subtasks", [])
            if isinstance(child, dict)
        ]
        children_by_id = {row.id: row for row in task.subtasks}
        if len(children_by_id) != len(task.subtasks) or set(children_by_id) != {
            cast(str, child.get("id")) for child in child_facts
        }:
            raise AuthError(409, "transfer_hierarchy_stale")
        for child_fact in child_facts:
            child = children_by_id[cast(str, child_fact["id"])]
            child_start = activity_review.shifted_date(
                child_fact.get("planned_start"), delta
            )
            child_end = activity_review.shifted_date(
                child_fact.get("planned_end"), delta
            )
            if (child.planned_start, child.planned_end) != (
                child_start,
                child_end,
            ):
                raise AuthError(422, "transfer_dates_invalid")
            if child_start and (
                expected_start is None
                or expected_end is None
                or child_start < expected_start
                or cast(str, child_end) > expected_end
            ):
                raise AuthError(422, "transfer_dates_outside_task")
    return submitted_by_id


def _apply_reviewed_transfer_dates(
    operations: list[dict[str, Any]], reviewed: dict[str, TransferTaskDates]
) -> None:
    for fact in operations:
        task = reviewed[cast(str, fact["id"])]
        fact["planned_start"] = task.planned_start
        fact["planned_end"] = task.planned_end
        children = {row.id: row for row in task.subtasks}
        for child in fact.get("subtasks", []):
            reviewed_child = children[cast(str, child["id"])]
            child["planned_start"] = reviewed_child.planned_start
            child["planned_end"] = reviewed_child.planned_end


@router.post(
    "/activities/{identifier}/transfers",
    status_code=201,
    response_model=RevisionOutput,
    openapi_extra=MUTATION_HEADERS,
)
def request_transfer(
    identifier: str,
    body: TransferInput,
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Auth,
) -> Response:
    import json

    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier, actor)
        activity_review.lifecycle_eligible(db, auth, item)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if item.approved_revision_id != body.expected_approved_revision_id:
            raise AuthError(409, "transfer_ineligible")
        try:
            planned_start = date.fromisoformat(body.planned_start)
            planned_end = date.fromisoformat(body.planned_end)
        except ValueError:
            raise AuthError(422, "input_invalid") from None
        target_year = planned_start.year
        if (
            planned_end < planned_start
            or target_year <= item.placement_year
            or target_year > 2200
        ):
            raise AuthError(422, "input_invalid")
        project = db.get(Project, item.request_project_id, with_for_update=True)
        if (
            not project
            or project.state != "active"
            or item.amendment_id
            or item.withdrawal_id
        ):
            raise AuthError(409, "transfer_ineligible")
        if not db.scalar(
            select(AnnualPTA.id).where(
                AnnualPTA.project_id == project.id, AnnualPTA.year == target_year
            )
        ):
            raise AuthError(409, "pta_required")
        correcting = item.transfer_id is not None
        prior: ActivityRevision | None = None
        prior_transfer: dict[str, Any] = {}
        if correcting:
            if (
                item.state not in {"returned_supervisor", "returned_validator"}
                or body.transfer_id != item.transfer_id
                or body.expected_revision_id != item.current_revision_id
            ):
                raise AuthError(409, "transfer_stale")
            prior = db.get(ActivityRevision, item.current_revision_id)
            if not prior or not isinstance(prior.snapshot.get("transfer"), dict):
                raise AuthError(409, "transfer_stale")
            prior_transfer = cast(dict[str, Any], prior.snapshot["transfer"])
            transfer_id = item.transfer_id
        else:
            if (
                item.state != "approved"
                or item.transfer_id
                or body.transfer_id is not None
                or body.expected_revision_id is not None
            ):
                raise AuthError(409, "transfer_ineligible")
            transfer_id = str(uuid4())
        approved = db.get(ActivityRevision, item.approved_revision_id)
        if not approved:
            raise AuthError(409, "transfer_base_invalid")
        try:
            source_start = date.fromisoformat(
                cast(str, approved.snapshot["planned_start"])
            )
            base_operations = cast(
                list[dict[str, Any]], approved.snapshot["operations"]
            )
        except (KeyError, TypeError, ValueError):
            raise AuthError(409, "transfer_base_invalid") from None
        reviewed_dates = _reviewed_transfer_dates(
            base_operations,
            body.tasks,
            source_start=source_start,
            target_start=planned_start,
            target_end=planned_end,
        )
        now = auth.now(db)
        if not db.scalar(
            select(ActivityContributor.id).where(
                ActivityContributor.activity_id == item.id,
                ActivityContributor.user_id == actor.id,
                ActivityContributor.kind == "content",
            )
        ):
            db.add(
                ActivityContributor(
                    context_id=CONTEXT,
                    activity_id=item.id,
                    user_id=actor.id,
                    contributed_at=now,
                )
            )
            db.flush()
        snapshot = build_revision_snapshot(db, item, actor, now)
        for key in (
            "amendment_id",
            "amendment_reason",
            "base_approved_revision_id",
            "withdrawal",
            "transfer",
        ):
            snapshot.pop(key, None)
        snapshot["planned_start"] = body.planned_start
        snapshot["planned_end"] = body.planned_end
        _apply_reviewed_transfer_dates(
            cast(list[dict[str, Any]], snapshot["operations"]), reviewed_dates
        )
        snapshot["pta"] = {"id": None, "year": target_year}
        snapshot["transfer"] = {
            "id": transfer_id,
            "reason": body.reason,
            "base_approved_revision_id": item.approved_revision_id,
            "source_pta": {"id": item.pta_id, "year": item.placement_year},
            "target_year": target_year,
        }
        if correcting and (
            prior_transfer.get("reason") == body.reason
            and prior is not None
            and prior.snapshot.get("planned_start") == body.planned_start
            and prior.snapshot.get("planned_end") == body.planned_end
            and activity_review.transfer_date_facts(prior.snapshot.get("operations"))
            == activity_review.transfer_date_facts(snapshot.get("operations"))
        ):
            raise AuthError(409, "correction_unchanged")
        fingerprint_value = fingerprint(snapshot)
        snapshot["content_fingerprint"] = fingerprint_value
        encoded = json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode()
        if len(encoded) > 1_048_576:
            raise AuthError(422, "revision_too_large")
        revision = ActivityRevision(
            context_id=CONTEXT,
            activity_id=item.id,
            revision_number=(
                db.scalar(
                    select(func.max(ActivityRevision.revision_number)).where(
                        ActivityRevision.activity_id == item.id
                    )
                )
                or 0
            )
            + 1,
            snapshot=snapshot,
            fingerprint=fingerprint_value,
            submitter_id=actor.id,
            submitted_at=now,
        )
        db.add(revision)
        db.flush()
        before = activity_item(db, item, actor.role, actor.id)
        item.transfer_id = transfer_id
        item.current_revision_id = revision.id
        item.state = "submitted"
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        activity_review.workflow_audit(
            auth, db, "activity.transfer_submit", actor, item, before, after, revision
        )
        notification_ids = record_review_notifications(
            db, auth, item, revision, "supervisor"
        )
        for notification_id in notification_ids:
            background_tasks.add_task(
                deliver_workflow_notification, auth, notification_id
            )
        payload = revision_item(db, revision)
        payload["activity_version"] = item.version
        return created(
            request,
            f"/api/v1/activities/{item.id}/revisions/{revision.id}",
            payload,
        )


@router.post(
    "/activities/{identifier}/transfers/{transfer_id}/cancellation",
    response_model=ActivityOutput,
    openapi_extra=MUTATION_HEADERS,
)
def cancel_transfer(
    identifier: str,
    transfer_id: str,
    body: TransferCancellationInput,
    request: Request,
    auth: Auth,
) -> dict[str, Any]:
    try:
        transfer_id = str(UUID(transfer_id))
    except ValueError:
        raise AuthError(409, "transfer_stale") from None
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        activity_review.lifecycle_environment(auth)
        item = get_activity_for_command(db, identifier, actor)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if (
            item.transfer_id != transfer_id
            or item.current_revision_id != body.expected_revision_id
            or item.approved_revision_id != body.expected_approved_revision_id
            or item.state
            not in {
                "submitted",
                "prevalidated",
                "returned_supervisor",
                "returned_validator",
            }
        ):
            raise AuthError(409, "transfer_stale")
        revision = db.get(ActivityRevision, item.current_revision_id)
        if not revision or not isinstance(revision.snapshot.get("transfer"), dict):
            raise AuthError(409, "transfer_stale")
        before = activity_item(db, item, actor.role, actor.id)
        now = auth.now(db)
        mark_review_handled(db, revision.id, "supervisor", now)
        mark_review_handled(db, revision.id, "validator", now)
        item.current_revision_id = item.approved_revision_id
        item.transfer_id = None
        item.state = "approved"
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        auth.business_audit(
            db,
            "activity.transfer_cancel",
            actor.id,
            item.id,
            {
                "context_id": CONTEXT,
                "before": before,
                "after": after,
                "transfer": revision.snapshot["transfer"],
                "current_revision_id": revision.id,
                "cancellation": {
                    "reason": body.reason,
                    "actor_id": actor.id,
                    "occurred_at": now.isoformat(),
                },
            },
        )
        return after


@router.post(
    "/activities/{identifier}/withdrawals",
    status_code=201,
    response_model=RevisionOutput,
    openapi_extra=MUTATION_HEADERS,
)
def request_withdrawal(
    identifier: str,
    body: WithdrawalInput,
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Auth,
) -> Response:
    import json

    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier, actor)
        activity_review.lifecycle_eligible(db, auth, item)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if item.approved_revision_id != body.expected_approved_revision_id:
            raise AuthError(409, "withdrawal_ineligible")
        project = db.scalar(
            select(Project)
            .join(AnnualPTA, AnnualPTA.project_id == Project.id)
            .where(AnnualPTA.id == item.pta_id)
        )
        if (
            not project
            or project.state != "active"
            or item.amendment_id
            or item.transfer_id
        ):
            raise AuthError(409, "withdrawal_ineligible")
        correcting = item.withdrawal_id is not None
        if correcting:
            if (
                item.state not in {"returned_supervisor", "returned_validator"}
                or body.withdrawal_id != item.withdrawal_id
                or body.expected_revision_id != item.current_revision_id
            ):
                raise AuthError(409, "withdrawal_stale")
            prior = db.get(ActivityRevision, item.current_revision_id)
            if not prior:
                raise AuthError(409, "withdrawal_stale")
            prior_request = cast(dict[str, str], prior.snapshot.get("withdrawal"))
            if prior_request.get("reason") == body.reason:
                raise AuthError(409, "correction_unchanged")
            withdrawal_id = item.withdrawal_id
        else:
            if (
                item.state != "approved"
                or item.withdrawal_id
                or body.withdrawal_id is not None
                or body.expected_revision_id is not None
            ):
                raise AuthError(409, "withdrawal_ineligible")
            withdrawal_id = str(uuid4())
        approved = db.get(ActivityRevision, item.approved_revision_id)
        if not approved:
            raise AuthError(409, "withdrawal_base_invalid")
        now = auth.now(db)
        if not db.scalar(
            select(ActivityContributor.id).where(
                ActivityContributor.activity_id == item.id,
                ActivityContributor.user_id == actor.id,
                ActivityContributor.kind == "content",
            )
        ):
            db.add(
                ActivityContributor(
                    context_id=CONTEXT,
                    activity_id=item.id,
                    user_id=actor.id,
                    contributed_at=now,
                )
            )
            db.flush()
        snapshot = build_revision_snapshot(db, item, actor, now)
        snapshot.pop("amendment_id", None)
        snapshot.pop("amendment_reason", None)
        snapshot.pop("base_approved_revision_id", None)
        snapshot["withdrawal"] = {
            "id": withdrawal_id,
            "reason": body.reason,
            "base_approved_revision_id": item.approved_revision_id,
        }
        fingerprint_value = fingerprint(snapshot)
        snapshot["content_fingerprint"] = fingerprint_value
        encoded = json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode()
        if len(encoded) > 1_048_576:
            raise AuthError(422, "revision_too_large")
        revision = ActivityRevision(
            context_id=CONTEXT,
            activity_id=item.id,
            revision_number=(
                db.scalar(
                    select(func.max(ActivityRevision.revision_number)).where(
                        ActivityRevision.activity_id == item.id
                    )
                )
                or 0
            )
            + 1,
            snapshot=snapshot,
            fingerprint=fingerprint_value,
            submitter_id=actor.id,
            submitted_at=now,
        )
        db.add(revision)
        db.flush()
        before = activity_item(db, item, actor.role, actor.id)
        item.withdrawal_id = withdrawal_id
        item.current_revision_id = revision.id
        item.state = "submitted"
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        activity_review.workflow_audit(
            auth, db, "activity.withdrawal_submit", actor, item, before, after, revision
        )
        notification_ids = record_review_notifications(
            db, auth, item, revision, "supervisor"
        )
        for notification_id in notification_ids:
            background_tasks.add_task(
                deliver_workflow_notification, auth, notification_id
            )
        payload = revision_item(db, revision)
        payload["activity_version"] = item.version
        return created(
            request,
            f"/api/v1/activities/{item.id}/revisions/{revision.id}",
            payload,
        )


@router.post(
    "/activities/{identifier}/withdrawals/{withdrawal_id}/cancellation",
    response_model=ActivityOutput,
    openapi_extra=MUTATION_HEADERS,
)
def cancel_withdrawal(
    identifier: str,
    withdrawal_id: str,
    body: WithdrawalCancellationInput,
    request: Request,
    auth: Auth,
) -> dict[str, Any]:
    try:
        withdrawal_id = str(UUID(withdrawal_id))
    except ValueError:
        raise AuthError(409, "withdrawal_stale") from None
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        activity_review.lifecycle_environment(auth)
        item = get_activity_for_command(db, identifier, actor)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if (
            item.withdrawal_id != withdrawal_id
            or item.current_revision_id != body.expected_revision_id
            or item.approved_revision_id != body.expected_approved_revision_id
            or item.state
            not in {
                "submitted",
                "prevalidated",
                "returned_supervisor",
                "returned_validator",
            }
        ):
            raise AuthError(409, "withdrawal_stale")
        revision = db.get(ActivityRevision, item.current_revision_id)
        if not revision or not isinstance(revision.snapshot.get("withdrawal"), dict):
            raise AuthError(409, "withdrawal_stale")
        before = activity_item(db, item, actor.role, actor.id)
        now = auth.now(db)
        mark_review_handled(db, revision.id, "supervisor", now)
        mark_review_handled(db, revision.id, "validator", now)
        item.current_revision_id = item.approved_revision_id
        item.withdrawal_id = None
        item.state = "approved"
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        auth.business_audit(
            db,
            "activity.withdrawal_cancel",
            actor.id,
            item.id,
            {
                "context_id": CONTEXT,
                "before": before,
                "after": after,
                "withdrawal": revision.snapshot["withdrawal"],
                "current_revision_id": revision.id,
                "cancellation": {
                    "reason": body.reason,
                    "actor_id": actor.id,
                    "occurred_at": now.isoformat(),
                },
            },
        )
        return after


@router.post(
    "/activities/{identifier}/amendments",
    status_code=201,
    response_model=ActivityOutput,
    openapi_extra=MUTATION_HEADERS,
)
def open_amendment(
    identifier: str, body: AmendmentInput, request: Request, auth: Auth
) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier, actor)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        from app.planning.finance.disbursement import assert_disbursement_unfrozen

        assert_disbursement_unfrozen(db, item.id)
        if (
            item.state != "approved"
            or item.amendment_id
            or item.withdrawal_id
            or item.transfer_id
            or item.approved_revision_id != body.expected_approved_revision_id
        ):
            raise AuthError(409, "amendment_ineligible")
        before = activity_item(db, item, actor.role, actor.id)
        now = auth.now(db)
        amendment_id = str(uuid4())
        item.amendment_id = amendment_id
        item.amendment_reason = body.reason
        item.state = "amendment_draft"
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        auth.business_audit(
            db,
            "activity.amendment_open",
            actor.id,
            item.id,
            {
                "context_id": CONTEXT,
                "before": before,
                "after": after,
                "amendment": {
                    "id": amendment_id,
                    "reason": body.reason,
                    "base_approved_revision_id": item.approved_revision_id,
                    "opened_by_id": actor.id,
                    "opened_at": now.isoformat(),
                },
            },
        )
        return created(
            request,
            f"/api/v1/activities/{item.id}/amendments/{amendment_id}",
            after,
        )


def amendment_audits(
    db: Session, item: Activity, amendment_id: str
) -> tuple[Audit, Audit | None]:
    rows = list(
        db.scalars(
            select(Audit)
            .where(
                Audit.target == item.id,
                Audit.action.in_(
                    ["activity.amendment_open", "activity.amendment_cancel"]
                ),
            )
            .order_by(Audit.occurred_at, Audit.id)
        )
    )
    matches = [
        row
        for row in rows
        if isinstance(row.business, dict)
        and isinstance(row.business.get("amendment"), dict)
        and row.business["amendment"].get("id") == amendment_id
    ]
    opened = next(
        (row for row in matches if row.action == "activity.amendment_open"), None
    )
    if not opened:
        raise AuthError(404, "amendment_not_found")
    cancelled = next(
        (row for row in matches if row.action == "activity.amendment_cancel"), None
    )
    return opened, cancelled


def amendment_projection(db: Session, item: Activity) -> dict[str, Any]:
    projection = structural_content(db, item)
    labels = {
        row.id: row.label
        for row in db.scalars(
            select(OperationType).where(
                OperationType.id.in_(
                    [
                        row["type_id"]
                        for row in projection["operations"]
                        if row["type_id"] is not None
                    ]
                )
            )
        )
    }
    for operation in projection["operations"]:
        operation["type_label"] = labels.get(operation["type_id"])
    projection["tasks"] = projection.pop("operations")
    return projection


def amendment_snapshot_projection(snapshot: dict[str, Any]) -> dict[str, Any]:
    projection = snapshot_projection(snapshot)
    snapshot_operations = {
        str(row["id"]): row
        for row in cast(list[dict[str, Any]], snapshot["operations"])
    }
    for operation in projection["tasks"]:
        operation["type_label"] = str(
            snapshot_operations[operation["id"]]["type_label"]
        )
    return projection


def restore_approved_hierarchy(
    db: Session,
    item: Activity,
    approved_tasks: list[dict[str, Any]],
    *,
    actor_id: str,
    now: datetime,
) -> None:
    approved_task_ids = {str(row["id"]) for row in approved_tasks}
    tasks = {
        row.id: row
        for row in db.scalars(
            select(Operation)
            .where(Operation.activity_id == item.id)
            .order_by(Operation.id)
            .with_for_update()
        )
    }
    if not approved_task_ids.issubset(tasks):
        raise AuthError(409, "amendment_base_invalid")
    children = {
        row.id: row
        for row in db.scalars(
            select(Subtask)
            .where(Subtask.activity_id == item.id)
            .order_by(Subtask.id)
            .with_for_update()
        )
    }
    approved_child_ids = {
        str(child["id"])
        for task in approved_tasks
        for child in task.get("subtasks", [])
        if isinstance(child, dict)
    }
    if not approved_child_ids.issubset(children):
        raise AuthError(409, "amendment_base_invalid")
    for task in tasks.values():
        if task.removed_at is None:
            task.position += 1000
    for child in children.values():
        if child.removed_at is None:
            child.position += 1000
    db.flush()

    for position, saved in enumerate(approved_tasks, start=1):
        task = tasks[str(saved["id"])]
        task.type_id = str(saved["type_id"])
        task.name = str(saved["name"])
        task.description = str(saved.get("description", ""))
        task.allocation = int(str(saved["allocation"]))
        task.weight_basis_points = percentage(saved.get("weight"), required=False)
        task.planned_start = (
            date.fromisoformat(str(saved["planned_start"]))
            if saved.get("planned_start")
            else None
        )
        task.planned_end = (
            date.fromisoformat(str(saved["planned_end"]))
            if saved.get("planned_end")
            else None
        )
        task.position = int(saved.get("position", position))
        task.removed_at = None
        task.removed_by_id = None
        task.updated_by_id = actor_id
        task.updated_at = now
        for child_position, child_saved in enumerate(
            cast(list[dict[str, Any]], saved.get("subtasks", [])), start=1
        ):
            child = children[str(child_saved["id"])]
            child.task_id = task.id
            child.name = str(child_saved["name"])
            child.description = str(child_saved.get("description", ""))
            child.allocation = int(str(child_saved["allocation"]))
            child.weight_basis_points = percentage(
                child_saved.get("weight"), required=False
            )
            child.planned_start = (
                date.fromisoformat(str(child_saved["planned_start"]))
                if child_saved.get("planned_start")
                else None
            )
            child.planned_end = (
                date.fromisoformat(str(child_saved["planned_end"]))
                if child_saved.get("planned_end")
                else None
            )
            child.position = int(child_saved.get("position", child_position))
            child.removed_at = None
            child.removed_by_id = None
            child.updated_by_id = actor_id
            child.updated_at = now

    for child in children.values():
        if child.id not in approved_child_ids and child.removed_at is None:
            if child.execution_started_at is not None:
                raise AuthError(409, "amendment_base_invalid")
            child.removed_at = now
            child.removed_by_id = actor_id
    for task in tasks.values():
        if task.id not in approved_task_ids and task.removed_at is None:
            if task.execution_started_at is not None:
                raise AuthError(409, "amendment_base_invalid")
            task.removed_at = now
            task.removed_by_id = actor_id
    activity_review.recalculate_hierarchical_task_facts(db, approved_tasks)


@router.get(
    "/activities/{identifier}/amendments/{amendment_id}",
    response_model=AmendmentDetailOutput,
)
def amendment_detail(
    identifier: str, amendment_id: str, request: Request, auth: Auth
) -> dict[str, Any]:
    try:
        amendment_id = str(UUID(amendment_id))
    except ValueError:
        raise AuthError(404, "amendment_not_found") from None
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, actor=actor, shared=True)
        opened, cancelled = amendment_audits(db, item, amendment_id)
        opened_business = cast(dict[str, Any], opened.business)
        cancelled_business = (
            cast(dict[str, Any], cancelled.business) if cancelled else None
        )
        amendment = cast(dict[str, Any], opened_business["amendment"])
        cancellation = None
        last_revision_id = None
        if cancelled_business:
            candidate = cast(dict[str, Any], cancelled_business["candidate"])
            status = "cancelled"
            facts = cast(dict[str, Any], cancelled_business["cancellation"])
            cancellation = facts
            last_revision_id = cast(str | None, cancelled_business["last_revision_id"])
        elif item.amendment_id == amendment_id:
            candidate = amendment_projection(db, item)
            status = "active"
            if item.current_revision_id != item.approved_revision_id:
                last_revision_id = item.current_revision_id
        else:
            completed = next(
                (
                    row
                    for row in db.scalars(
                        select(ActivityRevision)
                        .where(ActivityRevision.activity_id == item.id)
                        .order_by(ActivityRevision.revision_number.desc())
                    )
                    if cast(dict[str, Any], row.snapshot).get("amendment_id")
                    == amendment_id
                ),
                None,
            )
            if not completed:
                raise AuthError(404, "amendment_not_found")
            candidate = amendment_snapshot_projection(
                cast(dict[str, Any], completed.snapshot)
            )
            status = "approved"
            last_revision_id = completed.id
        return {
            "id": amendment_id,
            "activity_id": item.id,
            "reason": amendment["reason"],
            "base_approved_revision_id": amendment["base_approved_revision_id"],
            "opened_by_id": amendment["opened_by_id"],
            "opened_at": amendment["opened_at"],
            "status": status,
            "candidate": candidate,
            "last_revision_id": last_revision_id,
            "cancellation": cancellation,
        }


@router.post(
    "/activities/{identifier}/amendments/{amendment_id}/cancellation",
    response_model=ActivityOutput,
    openapi_extra=MUTATION_HEADERS,
)
def cancel_amendment(
    identifier: str,
    amendment_id: str,
    body: AmendmentInput,
    request: Request,
    auth: Auth,
) -> dict[str, Any]:
    try:
        amendment_id = str(UUID(amendment_id))
    except ValueError:
        raise AuthError(409, "amendment_stale") from None
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity(db, identifier, actor=actor, lock=True)
        require_agent_assignment(db, item.id, actor)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if (
            item.amendment_id != amendment_id
            or item.approved_revision_id != body.expected_approved_revision_id
            or item.state
            not in {
                "amendment_draft",
                "submitted",
                "prevalidated",
                "returned_supervisor",
                "returned_validator",
            }
        ):
            raise AuthError(409, "amendment_stale")
        approved = db.get(ActivityRevision, item.approved_revision_id)
        if not approved:
            raise AuthError(409, "amendment_base_invalid")
        before = activity_item(db, item, actor.role, actor.id)
        candidate = amendment_projection(db, item)
        now = auth.now(db)
        approved_operations = cast(
            list[dict[str, Any]], approved.snapshot["operations"]
        )
        restore_approved_hierarchy(
            db, item, approved_operations, actor_id=actor.id, now=now
        )
        item.name = str(approved.snapshot["name"])
        item.description = str(approved.snapshot["description"])
        item.planned_start = date.fromisoformat(str(approved.snapshot["planned_start"]))
        item.planned_end = date.fromisoformat(str(approved.snapshot["planned_end"]))
        item.allocation = int(str(approved.snapshot["allocation"]))
        last_revision_id = (
            item.current_revision_id
            if item.current_revision_id != item.approved_revision_id
            else None
        )
        if last_revision_id:
            mark_review_handled(db, last_revision_id, "supervisor", now)
            mark_review_handled(db, last_revision_id, "validator", now)
        item.current_revision_id = item.approved_revision_id
        item.state = "approved"
        item.amendment_id = None
        item.amendment_reason = None
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        _opened, cancelled = amendment_audits(db, item, amendment_id)
        if cancelled:
            raise AuthError(409, "amendment_stale")
        auth.business_audit(
            db,
            "activity.amendment_cancel",
            actor.id,
            item.id,
            {
                "context_id": CONTEXT,
                "before": before,
                "after": after,
                "amendment": {
                    "id": amendment_id,
                    "reason": before["amendment"]["reason"],
                    "base_approved_revision_id": item.approved_revision_id,
                },
                "candidate": candidate,
                "last_revision_id": last_revision_id,
                "cancellation": {
                    "reason": body.reason,
                    "actor_id": actor.id,
                    "occurred_at": now.isoformat(),
                },
            },
        )
        return after


@router.post(
    "/activities/{identifier}/submissions",
    status_code=201,
    response_model=RevisionOutput,
    openapi_extra=MUTATION_HEADERS,
)
def submit_activity(
    identifier: str,
    body: SubmissionInput,
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Auth,
) -> Response:
    secret, csrf = evidence(request, auth)
    result = activity_review.submit_activity(
        auth,
        secret,
        csrf,
        identifier,
        body.expected_version,
    )
    for notification_id in result.notification_ids:
        background_tasks.add_task(deliver_workflow_notification, auth, notification_id)
    return created(request, result.location, result.payload)


@router.post(
    "/activities/{identifier}/revisions/{revision_id}/decisions",
    status_code=201,
    response_model=DecisionOutput,
    openapi_extra=MUTATION_HEADERS,
)
def decide_activity(
    identifier: str,
    revision_id: str,
    body: DecisionInput,
    request: Request,
    background_tasks: BackgroundTasks,
    auth: Auth,
) -> Response:
    secret, csrf = evidence(request, auth)
    result = activity_review.decide_activity(
        auth,
        secret,
        csrf,
        identifier,
        revision_id,
        body.expected_version,
        body.decision,
        body.reason,
        body.requested_amount,
    )
    if result.deliver_notifications:
        for notification_id in result.notification_ids:
            background_tasks.add_task(
                deliver_workflow_notification, auth, notification_id
            )
    return created(request, result.location, result.payload)


@router.get(
    "/activities/{identifier}/revisions", response_model=ListOutput[HistoryOutput]
)
def activity_revisions(
    identifier: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, actor=actor, shared=True)
        limit, token = args
        cursor = Cursor(auth, "activity-revisions", item.id, limit)
        marker, direction = cursor.decode(token)
        history: list[dict[str, Any]] = []
        for revision in db.scalars(
            select(ActivityRevision).where(ActivityRevision.activity_id == item.id)
        ):
            payload = revision_item(db, revision, include_snapshot=False)
            history.append(
                {
                    "id": revision.id,
                    "kind": "revision",
                    "occurred_at": revision.submitted_at.isoformat(),
                    "activity_id": revision.activity_id,
                    "revision_number": revision.revision_number,
                    "fingerprint": revision.fingerprint,
                    "submitter_id": revision.submitter_id,
                    "submitted_at": revision.submitted_at.isoformat(),
                    "decisions": payload["decisions"],
                    "amendment_id": cast(dict[str, Any], revision.snapshot).get(
                        "amendment_id"
                    ),
                    "withdrawal_id": (
                        cast(dict[str, Any], revision.snapshot)
                        .get("withdrawal", {})
                        .get("id")
                    ),
                    "transfer_id": (
                        cast(dict[str, Any], revision.snapshot)
                        .get("transfer", {})
                        .get("id")
                    ),
                    "reason": None,
                    "actor_id": None,
                }
            )
        for audit in db.scalars(
            select(Audit).where(
                Audit.target == item.id,
                Audit.action.in_(
                    [
                        "activity.amendment_open",
                        "activity.amendment_cancel",
                        "activity.withdrawal_cancel",
                        "activity.transfer_cancel",
                    ]
                ),
            )
        ):
            facts = cast(dict[str, Any], audit.business)
            withdrawal_cancel = audit.action == "activity.withdrawal_cancel"
            transfer_cancel = audit.action == "activity.transfer_cancel"
            amendment = cast(
                dict[str, Any],
                facts["transfer"]
                if transfer_cancel
                else facts["withdrawal"]
                if withdrawal_cancel
                else facts["amendment"],
            )
            cancelled = audit.action == "activity.amendment_cancel"
            suffix = (
                "withdrawal-cancel"
                if withdrawal_cancel
                else "transfer-cancel"
                if transfer_cancel
                else "amendment-cancel"
                if cancelled
                else "amendment-open"
            )
            history.append(
                {
                    "id": f"{amendment['id']}:{suffix}",
                    "kind": (
                        "withdrawal_cancel"
                        if withdrawal_cancel
                        else "transfer_cancel"
                        if transfer_cancel
                        else "amendment_cancel"
                        if cancelled
                        else "amendment_open"
                    ),
                    "occurred_at": audit.occurred_at.isoformat(),
                    "revision_number": None,
                    "submitter_id": None,
                    "decisions": [],
                    "amendment_id": (
                        None
                        if withdrawal_cancel or transfer_cancel
                        else amendment["id"]
                    ),
                    "withdrawal_id": amendment["id"] if withdrawal_cancel else None,
                    "transfer_id": amendment["id"] if transfer_cancel else None,
                    "reason": (
                        facts["cancellation"]["reason"]
                        if cancelled or withdrawal_cancel or transfer_cancel
                        else amendment["reason"]
                    ),
                    "actor_id": audit.actor,
                }
            )

        def history_key(row: dict[str, Any]) -> tuple[str, str, str]:
            source = {
                "revision": "r",
                "amendment_open": "o",
                "amendment_cancel": "c",
                "withdrawal_cancel": "w",
                "transfer_cancel": "t",
            }[row["kind"]]
            return (row["occurred_at"], source, row["id"])

        history.sort(key=history_key, reverse=True)
        marker_key = None
        if marker:
            parts = marker.split("|", 2)
            if len(parts) != 3:
                raise AuthError(422, "cursor_invalid")
            marker_key = tuple(parts)
            history = [
                row
                for row in history
                if (
                    history_key(row) < marker_key
                    if direction == "next"
                    else history_key(row) > marker_key
                )
            ]
        if direction == "previous":
            history.reverse()
        total = (
            len(history)
            if marker_key is None
            else (
                db.scalar(
                    select(func.count())
                    .select_from(ActivityRevision)
                    .where(ActivityRevision.activity_id == item.id)
                )
                or 0
            )
            + (
                db.scalar(
                    select(func.count())
                    .select_from(Audit)
                    .where(
                        Audit.target == item.id,
                        Audit.action.in_(
                            [
                                "activity.amendment_open",
                                "activity.amendment_cancel",
                                "activity.withdrawal_cancel",
                                "activity.transfer_cancel",
                            ]
                        ),
                    )
                )
                or 0
            )
        )
        more = len(history) > limit
        rows = history[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: dict[str, Any], move: str) -> str:
            query = urlencode(
                {
                    "limit": limit,
                    "cursor": cursor.encode("|".join(history_key(row)), move),
                }
            )
            return f"{auth.policy.origin}/api/v1/activities/{item.id}/revisions?{query}"

        return {
            "object": "list",
            "count": int(total or 0),
            "data": rows,
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }


@router.get(
    "/activities/{identifier}/revisions/{revision_id}",
    response_model=RevisionOutput,
    response_model_exclude_unset=True,
)
def activity_revision_detail(
    identifier: str, revision_id: str, request: Request, auth: Auth
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, actor=actor, shared=True)
        revision = db.scalar(
            select(ActivityRevision).where(
                ActivityRevision.id == revision_id,
                ActivityRevision.activity_id == item.id,
            )
        )
        if not revision:
            raise AuthError(404, "revision_not_found")
        return revision_item(db, revision)


@router.patch(
    "/activities/{identifier}",
    response_model=ActivityOutput,
    openapi_extra=MUTATION_HEADERS,
)
def replace_activity(
    identifier: str, body: ActivityReplace, request: Request, auth: Auth
) -> dict[str, Any]:
    payload = normalized_body(body)
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity(db, identifier, actor=actor, lock=True)
        require_agent_assignment(db, item.id, actor)
        pta = db.get(AnnualPTA, item.pta_id)
        assert pta
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if item.withdrawal_id:
            raise AuthError(409, "withdrawal_pending")
        if item.transfer_id:
            raise AuthError(409, "transfer_pending")
        if item.state not in {
            "draft",
            "amendment_draft",
            "returned_supervisor",
            "returned_validator",
        }:
            raise AuthError(409, "activity_not_editable")
        plan, incoming = validate_draft(payload, pta.year)
        assert_types(db, incoming)
        current = {
            row.id: row
            for row in db.scalars(
                select(Operation)
                .where(Operation.activity_id == item.id, Operation.removed_at.is_(None))
                .with_for_update()
            )
        }
        current_subtasks = {
            row.id: row
            for row in db.scalars(
                select(Subtask)
                .where(
                    Subtask.activity_id == item.id,
                    Subtask.removed_at.is_(None),
                )
                .with_for_update()
            )
        }
        current_subtasks_by_task: dict[str, list[Subtask]] = {}
        for child in current_subtasks.values():
            current_subtasks_by_task.setdefault(child.task_id, []).append(child)
        before_structure = structural_content(db, item)
        before = activity_item(db, item, actor.role, actor.id)
        if item.current_revision_id:
            revision = db.get(ActivityRevision, item.current_revision_id)
            assert revision
            submitted_operations = cast(
                list[dict[str, Any]], revision.snapshot["operations"]
            )
            submitted_ids = {str(row["id"]) for row in submitted_operations}
            submitted_subtask_ids = {
                str(child["id"])
                for row in submitted_operations
                for child in row.get("subtasks", [])
                if isinstance(child, dict) and child.get("id")
            }
            submitted_allocation = int(cast(str, revision.snapshot["allocation"]))
            incoming_ids = {row["id"] for row in incoming if row["id"]}
            if not submitted_ids.issubset(incoming_ids):
                raise AuthError(409, "submitted_operation_removal_forbidden")
            incoming_subtask_ids = {
                child["id"]
                for row in incoming
                for child in row["subtasks"]
                if child["id"]
            }
            if not submitted_subtask_ids.issubset(incoming_subtask_ids):
                raise AuthError(409, "submitted_subtask_removal_forbidden")
            if (
                item.state == "returned_supervisor"
                and plan["allocation"] != submitted_allocation
            ):
                raise AuthError(409, "correction_total_locked")
            if item.state == "returned_validator":
                returned = db.scalar(
                    select(ActivityRevisionDecision).where(
                        ActivityRevisionDecision.revision_id == revision.id,
                        ActivityRevisionDecision.stage == "validator",
                        ActivityRevisionDecision.outcome == "returned",
                    )
                )
                assert returned
                if (
                    returned.requested_amount is None
                    and plan["allocation"] != submitted_allocation
                ):
                    raise AuthError(409, "correction_total_locked")
        if all(getattr(item, key) == value for key, value in plan.items()) and (
            len(incoming) == len(current)
            and all(
                row["id"] in current
                and all(
                    getattr(current[row["id"]], key) == row[key]
                    for key in (
                        "type_id",
                        "name",
                        "description",
                        "allocation",
                        "weight_basis_points",
                        "planned_start",
                        "planned_end",
                        "position",
                    )
                )
                and len(row["subtasks"])
                == len(current_subtasks_by_task.get(row["id"], []))
                and all(
                    child["id"] in current_subtasks
                    and current_subtasks[child["id"]].task_id == row["id"]
                    and all(
                        getattr(current_subtasks[child["id"]], key) == child[key]
                        for key in (
                            "name",
                            "description",
                            "allocation",
                            "weight_basis_points",
                            "planned_start",
                            "planned_end",
                            "position",
                        )
                    )
                    for child in row["subtasks"]
                )
                for row in incoming
            )
        ):
            return before
        now = auth.now(db)
        original_positions = {
            operation.id: operation.position for operation in current.values()
        }
        for existing_operation in current.values():
            existing_operation.position += 1000
        for existing_subtask in current_subtasks.values():
            existing_subtask.position += 1000
        db.flush()
        used: set[str] = set()
        removed_operations: list[dict[str, Any]] = []
        for row in incoming:
            current_operation = current.get(row["id"]) if row["id"] else None
            if row["id"] and not current_operation:
                raise AuthError(409, "operation_stale")
            if not current_operation:
                operation = Operation(
                    context_id=CONTEXT,
                    activity_id=item.id,
                    creator_id=actor.id,
                    created_at=now,
                )
                db.add(operation)
            else:
                operation = current_operation
                used.add(operation.id)
            operation.type_id = row["type_id"]
            operation.name = row["name"]
            operation.description = row["description"]
            operation.allocation = row["allocation"]
            operation.weight_basis_points = row["weight_basis_points"]
            operation.planned_start = row["planned_start"]
            operation.planned_end = row["planned_end"]
            operation.position = row["position"]
            operation.updated_by_id = actor.id
            operation.updated_at = now
            if current_operation is None:
                db.flush()
            previous_children = current_subtasks_by_task.get(operation.id, [])
            if (
                row["subtasks"]
                and not previous_children
                and (
                    operation.execution_started_at is not None
                    or operation.actual_spent is not None
                    or operation.manual_progress_basis_points is not None
                )
            ):
                raise AuthError(409, "started_task_subtasks_forbidden")
            child_used: set[str] = set()
            for child_row in row["subtasks"]:
                candidate_child = (
                    current_subtasks.get(child_row["id"]) if child_row["id"] else None
                )
                if child_row["id"] and (
                    not candidate_child or candidate_child.task_id != operation.id
                ):
                    raise AuthError(409, "subtask_stale")
                if candidate_child is None:
                    candidate_child = Subtask(
                        context_id=CONTEXT,
                        activity_id=item.id,
                        task_id=operation.id,
                        creator_id=actor.id,
                        created_at=now,
                    )
                    db.add(candidate_child)
                else:
                    child_used.add(candidate_child.id)
                candidate_child.name = child_row["name"]
                candidate_child.description = child_row["description"]
                candidate_child.allocation = child_row["allocation"]
                candidate_child.weight_basis_points = child_row["weight_basis_points"]
                candidate_child.planned_start = child_row["planned_start"]
                candidate_child.planned_end = child_row["planned_end"]
                candidate_child.position = child_row["position"]
                candidate_child.updated_by_id = actor.id
                candidate_child.updated_at = now
            for child in previous_children:
                if child.id not in child_used:
                    if child.execution_started_at is not None:
                        raise AuthError(409, "started_subtask_removal_forbidden")
                    child.removed_at = now
                    child.removed_by_id = actor.id
        for operation in current.values():
            if operation.id not in used:
                if operation.execution_started_at is not None:
                    raise AuthError(409, "started_operation_removal_forbidden")
                operation.removed_at = now
                operation.removed_by_id = actor.id
                operation.position = original_positions[operation.id]
                removed_operations.append(
                    {
                        "id": operation.id,
                        "position": operation.position,
                        "removed_at": now.isoformat(),
                        "removed_by_id": actor.id,
                    }
                )
        for key, value in plan.items():
            setattr(item, key, value)
        item.version += 1
        item.updated_at = now
        db.flush()
        after_structure = structural_content(db, item)
        if after_structure != before_structure and not db.scalar(
            select(ActivityContributor.id).where(
                ActivityContributor.activity_id == item.id,
                ActivityContributor.user_id == actor.id,
                ActivityContributor.kind == "content",
            )
        ):
            db.add(
                ActivityContributor(
                    context_id=CONTEXT,
                    activity_id=item.id,
                    user_id=actor.id,
                    contributed_at=now,
                )
            )
        after = activity_item(db, item, actor.role, actor.id)
        auth.business_audit(
            db,
            "activity.replace",
            actor.id,
            item.id,
            {
                "context_id": CONTEXT,
                "before": before,
                "after": after,
                "removed_operations": removed_operations,
            },
        )
        return after


@router.put(
    "/activities/{identifier}/assignments",
    response_model=ActivityOutput,
    openapi_extra=MUTATION_HEADERS,
)
def replace_assignments(
    identifier: str,
    body: AssignmentReplace,
    request: Request,
    auth: Auth,
    background_tasks: BackgroundTasks,
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
        targets = (
            list(
                db.scalars(
                    select(User)
                    .where(User.id.in_(body.agent_ids))
                    .order_by(User.id)
                    .with_for_update()
                )
            )
            if body.agent_ids
            else []
        )
        if len(targets) != len(body.agent_ids) or any(
            user.role != "AGENT_SAISIE" or user.state != "active" for user in targets
        ):
            raise AuthError(409, "assignment_ineligible")
        item = get_activity(db, identifier, actor=actor, lock=True)
        require_agent_assignment(db, item.id, actor)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if item.state in {"withdrawn", "closed"}:
            raise AuthError(409, "assignment_ineligible")
        current = {
            row.agent_id: row
            for row in db.scalars(
                select(ActivityAssignment)
                .where(
                    ActivityAssignment.activity_id == item.id,
                    ActivityAssignment.ended_at.is_(None),
                )
                .with_for_update()
            )
        }
        before = activity_item(db, item, actor.role, actor.id)
        if set(current) == set(body.agent_ids):
            return before
        now = auth.now(db)
        for agent_id, assignment in current.items():
            if agent_id not in body.agent_ids:
                assignment.ended_at = now
                assignment.ended_by_id = actor.id
        notification_ids: list[str] = []
        for agent_id in body.agent_ids:
            if agent_id not in current:
                assignment = ActivityAssignment(
                    context_id=CONTEXT,
                    activity_id=item.id,
                    agent_id=agent_id,
                    assigned_by_id=actor.id,
                    assigned_at=now,
                )
                db.add(assignment)
                db.flush()
                notification_ids.append(
                    record_assignment_notification(db, auth, assignment)
                )
        item.version += 1
        item.updated_at = now
        db.flush()
        result = activity_item(db, item, actor.role, actor.id)
        auth.business_audit(
            db,
            "activity.assign_agents",
            actor.id,
            item.id,
            {"context_id": CONTEXT, "before": before, "after": result},
        )
        for notification_id in notification_ids:
            background_tasks.add_task(
                deliver_assignment_notification, auth, notification_id
            )
        return result


@router.get("/assignment-agents", response_model=ListOutput[AgentOutput])
def assignment_agents(
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
    q: Annotated[str, Query(max_length=200)] = "",
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        principal(
            db,
            auth,
            evidence(request, auth)[0],
            roles={"AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"},
        )
        limit, token = args
        q = q.strip()
        cursor = Cursor(
            auth,
            "assignment-agents",
            CONTEXT if not q else fingerprint({"context": CONTEXT, "q": q}),
            limit,
        )
        marker, direction = cursor.decode(token)
        filters = [User.role == "AGENT_SAISIE", User.state == "active"]
        if q:
            filters.append(
                func.lower(
                    func.coalesce(User.full_name, "") + " " + User.email
                ).contains(q.lower(), autoescape=True)
            )
        conditions = list(filters)
        if marker:
            try:
                marker = str(UUID(marker))
            except ValueError:
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                User.id > marker if direction == "next" else User.id < marker
            )
        order = User.id.asc() if direction == "next" else User.id.desc()
        rows, total = page_rows(
            db,
            User,
            tuple(filters),
            tuple(conditions),
            (order,),
            limit,
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: User, move: str) -> str:
            value = cursor.encode(row.id, move)
            query = urlencode(
                {"limit": limit, "cursor": value, **({"q": q} if q else {})}
            )
            return f"{auth.policy.origin}/api/v1/assignment-agents?{query}"

        return {
            "object": "list",
            "count": total,
            "data": [
                {"id": row.id, "email": row.email, "full_name": row.full_name}
                for row in rows
            ],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }
