from datetime import UTC, date, datetime
from typing import Annotated, Any, Literal, cast
from urllib.parse import urlencode
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import func, or_, select, text, tuple_
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import Audit, User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.models import (
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
)
from app.planning.presentation import (
    activity_rows,
    approved_plans,
    planning_state_counts,
    planning_summary,
)
from app.planning.service import (
    CONTEXT,
    Cursor,
    activity_item,
    assert_types,
    build_revision_snapshot,
    clean,
    fingerprint,
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
    validate_plan,
    xof,
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

    @field_validator("label", mode="before")
    @classmethod
    def normalized_label(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ProjectInput(NameInput):
    partner_id: str = Field(max_length=36)


class ProjectClose(Input):
    expected_version: int = Field(gt=0, strict=True)
    action: Literal["close"]


class OperationInput(Input):
    id: str | None = Field(default=None, max_length=36)
    type_id: str = Field(max_length=36)
    name: str = Field(min_length=1, max_length=200)
    allocation: str = Field(min_length=1, max_length=19, pattern=r"^[1-9][0-9]*$")

    @field_validator("name", mode="before")
    @classmethod
    def normalized_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PlanningInput(Input):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=4000)
    planned_start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned_end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    allocation: str = Field(min_length=1, max_length=19, pattern=r"^[1-9][0-9]*$")
    operations: list[OperationInput] = Field(min_length=1, max_length=100)

    @field_validator("name", "description", mode="before")
    @classmethod
    def normalized_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ActivityCreate(PlanningInput):
    request_key: str = Field(max_length=36)

    @field_validator("request_key")
    @classmethod
    def uuid_key(cls, value: str) -> str:
        return str(UUID(value))


class ActivityReplace(PlanningInput):
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


class TransferInput(AmendmentInput):
    planned_start: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    planned_end: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
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


class OperationTypeOutput(Input):
    id: str
    label: str
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


class OperationOutput(Input):
    id: str
    type_id: str
    name: str
    allocation: str
    position: int


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
    operations: list[OperationOutput]


class AmendmentOperationOutput(OperationOutput):
    type_label: str


class AmendmentPlanningProjection(Input):
    name: str
    description: str
    planned_start: str
    planned_end: str
    allocation: str
    operations: list[AmendmentOperationOutput]


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
    planned_start: str
    planned_end: str
    state: str
    operation_count: int
    agents: list[str]
    revision_number: int | None
    id: str
    reference: str
    name: str
    allocation: str


class ActivityOutput(Input):
    id: str
    pta_id: str
    project_id: str
    reference: str
    name: str
    description: str
    planned_start: str
    planned_end: str
    allocation: str
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
    candidate: PlanningProjection | None
    amendment: AmendmentOutput | None
    withdrawal: WithdrawalOutput | None
    transfer: TransferOutput | None
    placement_year: int
    execution_paused: bool
    correction: CorrectionOutput | None
    operations: list[OperationOutput]
    agent_ids: list[str]
    allowed_actions: list[str]
    closure: dict[str, str] | None


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


class AgentOutput(Input):
    id: str
    email: str


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


class SnapshotOperation(OperationOutput):
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
    operations: list[SnapshotOperation]
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


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


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


@router.get("/operation-types", response_model=ListOutput[OperationTypeOutput])
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
            "operation-types",
            CONTEXT,
            actor.role,
            *args,
            where=(OperationType.context_id == CONTEXT,),
        )


@router.post(
    "/operation-types",
    status_code=201,
    response_model=OperationTypeOutput,
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
            request, f"/api/v1/operation-types/{item.id}", type_item(item, actor.role)
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
                marker_year, marker_id = marker.split(":", 1)
                marker_value = (int(marker_year), str(UUID(marker_id)))
            except (ValueError, TypeError):
                raise AuthError(422, "cursor_invalid") from None
            pair = tuple_(AnnualPTA.year, AnnualPTA.id)
            conditions.append(
                pair > marker_value if direction == "next" else pair < marker_value
            )
        ordering = (
            (AnnualPTA.year.asc(), AnnualPTA.id.asc())
            if direction == "next"
            else (AnnualPTA.year.desc(), AnnualPTA.id.desc())
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
            value = cursor.encode(f"{row.year}:{row.id}", move)
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
        counts = planning_state_counts(db, [row.id for row in rows])
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
        counts = planning_state_counts(db, [pta.id] if pta else [])
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
                if pta and actor.role == "AGENT_SAISIE" and project.state == "active"
                else []
            ),
            "approved_plan": plan,
            "summary": planning_summary(
                counts.get(pta.id, {}) if pta else {},
                plan["allocation"],
            ),
        }


def normalized_body(body: PlanningInput) -> dict[str, Any]:
    return body.model_dump(mode="json", exclude={"expected_version", "request_key"})


@router.post(
    "/projects/{identifier}/ptas/{year}/activities",
    status_code=201,
    response_model=ActivityOutput,
    responses={200: {"model": ActivityOutput, "description": "Idempotent replay"}},
    openapi_extra=MUTATION_HEADERS,
)
def create_activity(
    identifier: str, year: int, body: ActivityCreate, request: Request, auth: Auth
) -> Response:
    payload = normalized_body(body)
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        project = get_project(db, identifier, lock=True)
        if project.state != "active":
            raise AuthError(409, "project_closed")
        plan, operations = validate_plan(payload, year)
        if any(row["id"] for row in operations):
            raise AuthError(422, "input_invalid")
        canonical = {
            **plan,
            "planned_start": plan["planned_start"].isoformat(),
            "planned_end": plan["planned_end"].isoformat(),
            "allocation": str(plan["allocation"]),
            "operations": [
                {
                    "type_id": row["type_id"],
                    "name": row["name"],
                    "allocation": str(row["allocation"]),
                    "position": row["position"],
                }
                for row in operations
            ],
        }
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
            db.add(
                Operation(
                    context_id=CONTEXT,
                    activity_id=item.id,
                    type_id=row["type_id"],
                    name=row["name"],
                    allocation=row["allocation"],
                    position=row["position"],
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
            )
        )
        db.add(
            ActivityAssignment(
                context_id=CONTEXT,
                activity_id=item.id,
                agent_id=actor.id,
                assigned_by_id=actor.id,
                assigned_at=now,
            )
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
        return created(request, f"/api/v1/activities/{item.id}", result)


def get_activity(
    db: Session, identifier: str, *, lock: bool = False, shared: bool = False
) -> Activity:
    if lock and shared:
        raise ValueError("Activity lock mode must be exclusive or shared")
    lock_mode: bool | dict[str, bool] = {"read": True} if shared else lock
    item = db.get(Activity, identifier, with_for_update=lock_mode)
    if not item or item.context_id != CONTEXT:
        raise AuthError(404, "activity_not_found")
    return item


def get_activity_for_command(db: Session, identifier: str, actor: User) -> Activity:
    item = get_activity(db, identifier)
    project = db.scalar(
        select(Project)
        .join(AnnualPTA, AnnualPTA.project_id == Project.id)
        .where(AnnualPTA.id == item.pta_id)
        .with_for_update()
    )
    if not project:
        raise AuthError(404, "activity_not_found")
    db.refresh(item, with_for_update=True)
    require_agent_assignment(db, item.id, actor)
    return item


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
    ] = "",
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        principal(db, auth, evidence(request, auth)[0])
        pta = db.get(AnnualPTA, identifier)
        if not pta or pta.context_id != CONTEXT:
            raise AuthError(404, "pta_not_found")
        limit, token = args
        q = q.strip()
        cursor = Cursor(auth, "pta-activities", f"{pta.id}:{q}:{state}", limit)
        marker, direction = cursor.decode(token)
        base = [Activity.pta_id == pta.id]
        if q:
            pattern = (
                "%"
                + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                + "%"
            )
            base.append(
                or_(Activity.name.ilike(pattern), Activity.reference.ilike(pattern))
            )
        if state:
            base.append(Activity.state == state)
        conditions = list(base)
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
            tuple(base),
            tuple(conditions),
            (order,),
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
            value = cursor.encode(row.id, move)
            query = urlencode({"limit": limit, "cursor": value, "q": q, "state": state})
            return f"{auth.policy.origin}/api/v1/ptas/{pta.id}/activities?{query}"

        return {
            "object": "list",
            "count": total,
            "data": activity_rows(db, rows),
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }


@router.get("/activities/{identifier}", response_model=ActivityOutput)
def activity_detail(identifier: str, request: Request, auth: Auth) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, shared=True)
        return activity_item(db, item, actor.role, actor.id)


def lifecycle_environment(auth: Auth) -> None:
    if auth.policy.planning_lifecycle_fixture != "SYNTHETIC_EXECUTION_TEST_ONLY":
        raise AuthError(409, "eligibility_unverified")


def lifecycle_eligible(db: Session, auth: Auth, item: Activity) -> None:
    from app.planning.execution import assert_never_started

    lifecycle_environment(auth)
    assert_never_started(db, item)


@router.post(
    "/activities/{identifier}/transfers",
    status_code=201,
    response_model=RevisionOutput,
    openapi_extra=MUTATION_HEADERS,
)
def request_transfer(
    identifier: str, body: TransferInput, request: Request, auth: Auth
) -> Response:
    import json

    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier, actor)
        lifecycle_eligible(db, auth, item)
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
            if (
                prior_transfer.get("reason") == body.reason
                and prior.snapshot.get("planned_start") == body.planned_start
                and prior.snapshot.get("planned_end") == body.planned_end
            ):
                raise AuthError(409, "correction_unchanged")
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
        now = auth.now(db)
        if not db.scalar(
            select(ActivityContributor.id).where(
                ActivityContributor.activity_id == item.id,
                ActivityContributor.user_id == actor.id,
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
        snapshot["pta"] = {"id": None, "year": target_year}
        snapshot["transfer"] = {
            "id": transfer_id,
            "reason": body.reason,
            "base_approved_revision_id": item.approved_revision_id,
            "source_pta": {"id": item.pta_id, "year": item.placement_year},
            "target_year": target_year,
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
        item.transfer_id = transfer_id
        item.current_revision_id = revision.id
        item.state = "submitted"
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        workflow_audit(
            auth, db, "activity.transfer_submit", actor, item, before, after, revision
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
        lifecycle_environment(auth)
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
    identifier: str, body: WithdrawalInput, request: Request, auth: Auth
) -> Response:
    import json

    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier, actor)
        lifecycle_eligible(db, auth, item)
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
        workflow_audit(
            auth, db, "activity.withdrawal_submit", actor, item, before, after, revision
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
        lifecycle_environment(auth)
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
        from app.planning.disbursement import assert_disbursement_unfrozen

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
                    [row["type_id"] for row in projection["operations"]]
                )
            )
        )
    }
    for operation in projection["operations"]:
        operation["type_label"] = labels[operation["type_id"]]
    return projection


def amendment_snapshot_projection(snapshot: dict[str, Any]) -> dict[str, Any]:
    projection = snapshot_projection(snapshot)
    snapshot_operations = {
        str(row["id"]): row
        for row in cast(list[dict[str, Any]], snapshot["operations"])
    }
    for operation in projection["operations"]:
        operation["type_label"] = str(
            snapshot_operations[operation["id"]]["type_label"]
        )
    return projection


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
        principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, shared=True)
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
        item = get_activity(db, identifier, lock=True)
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
        approved_ids = {str(row["id"]) for row in approved_operations}
        operations = {
            row.id: row
            for row in db.scalars(
                select(Operation)
                .where(Operation.activity_id == item.id)
                .order_by(Operation.id)
                .with_for_update()
            )
        }
        if not approved_ids.issubset(operations):
            raise AuthError(409, "amendment_base_invalid")
        for row in operations.values():
            if row.removed_at is None:
                row.position += 1000
        db.flush()
        for position, saved in enumerate(approved_operations, start=1):
            row = operations[str(saved["id"])]
            row.type_id = str(saved["type_id"])
            row.name = str(saved["name"])
            row.allocation = int(str(saved["allocation"]))
            row.position = int(saved.get("position", position))
            row.removed_at = None
            row.removed_by_id = None
            row.updated_by_id = actor.id
            row.updated_at = now
        for row in operations.values():
            if row.id not in approved_ids and row.removed_at is None:
                row.removed_at = now
                row.removed_by_id = actor.id
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


def workflow_audit(
    auth: Auth,
    db: Session,
    action: str,
    actor: User,
    item: Activity,
    before: dict[str, Any],
    after: dict[str, Any],
    revision: ActivityRevision,
    decision: ActivityRevisionDecision | None = None,
    ended_assignment_ids: list[str] | None = None,
) -> None:
    snapshot = cast(dict[str, Any], revision.snapshot)
    submitter = cast(dict[str, str], snapshot["submitter"])
    facts: dict[str, Any] = {
        "context_id": CONTEXT,
        "before": before,
        "after": after,
        "revision": {
            "id": revision.id,
            "revision_number": revision.revision_number,
            "fingerprint": revision.fingerprint,
            "actor_id": revision.submitter_id,
            "actor_role": submitter["role"],
            "submitted_at": revision.submitted_at.isoformat(),
        },
    }
    if snapshot.get("amendment_id"):
        facts["revision"].update(
            {
                "amendment_id": snapshot["amendment_id"],
                "base_approved_revision_id": snapshot["base_approved_revision_id"],
            }
        )
    withdrawal = snapshot.get("withdrawal")
    if isinstance(withdrawal, dict):
        facts["revision"].update(
            {
                "withdrawal_id": withdrawal["id"],
                "reason": withdrawal["reason"],
                "base_approved_revision_id": withdrawal["base_approved_revision_id"],
            }
        )
    transfer = snapshot.get("transfer")
    if isinstance(transfer, dict):
        facts["revision"].update(
            {
                "transfer_id": transfer["id"],
                "base_approved_revision_id": transfer["base_approved_revision_id"],
                "reason": transfer["reason"],
                "source_pta": transfer["source_pta"],
                "target_year": transfer["target_year"],
            }
        )
    if decision:
        facts["decision"] = {
            "id": decision.id,
            "stage": decision.stage,
            "outcome": decision.outcome,
            "reason": decision.reason,
            "requested_amount": str(decision.requested_amount)
            if decision.requested_amount is not None
            else None,
            "actor_id": decision.actor_id,
            "actor_role": decision.actor_role,
            "decided_at": decision.decided_at.isoformat(),
            "prevalidation_revision_id": decision.prevalidation_revision_id,
        }
    if ended_assignment_ids is not None:
        facts["ended_assignment_ids"] = ended_assignment_ids
    auth.business_audit(db, action, actor.id, item.id, facts)


@router.post(
    "/activities/{identifier}/submissions",
    status_code=201,
    response_model=RevisionOutput,
    openapi_extra=MUTATION_HEADERS,
)
def submit_activity(
    identifier: str, body: SubmissionInput, request: Request, auth: Auth
) -> Response:
    import json

    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity(db, identifier, lock=True)
        require_agent_assignment(db, item.id, actor)
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
            raise AuthError(409, "activity_not_submittable")
        before = activity_item(db, item, actor.role, actor.id)
        previous = (
            db.get(ActivityRevision, item.current_revision_id)
            if item.current_revision_id
            else None
        )
        current_structure = structural_content(db, item)
        if previous:
            previous_operations = cast(
                list[dict[str, str | int]], previous.snapshot["operations"]
            )
            previous_structure = {
                key: previous.snapshot[key]
                for key in (
                    "name",
                    "description",
                    "planned_start",
                    "planned_end",
                    "allocation",
                )
            }
            previous_structure["operations"] = [
                {
                    key: row[key]
                    for key in ("id", "type_id", "name", "allocation", "position")
                }
                for row in previous_operations
            ]
            if current_structure == previous_structure:
                raise AuthError(409, "correction_unchanged")
        now = auth.now(db)
        if not db.scalar(
            select(ActivityContributor.id).where(
                ActivityContributor.activity_id == item.id,
                ActivityContributor.user_id == actor.id,
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
        content_fingerprint = fingerprint(current_structure)
        snapshot["content_fingerprint"] = content_fingerprint
        if (
            len(json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode())
            > 1_048_576
        ):
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
            fingerprint=content_fingerprint,
            submitter_id=actor.id,
            submitted_at=now,
        )
        db.add(revision)
        db.flush()
        item.current_revision_id = revision.id
        item.state = "submitted"
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        workflow_audit(
            auth, db, "activity.submit", actor, item, before, after, revision
        )
        payload = revision_item(db, revision)
        payload["activity_version"] = item.version
        return created(
            request,
            f"/api/v1/activities/{item.id}/revisions/{revision.id}",
            payload,
        )


def decision_payload(row: ActivityRevisionDecision, version: int) -> dict[str, Any]:
    return {
        "id": row.id,
        "stage": row.stage,
        "outcome": row.outcome,
        "actor_id": row.actor_id,
        "actor_role": row.actor_role,
        "decided_at": row.decided_at.isoformat(),
        "reason": row.reason,
        "requested_amount": str(row.requested_amount)
        if row.requested_amount is not None
        else None,
        "prevalidation_revision_id": row.prevalidation_revision_id,
        "activity_version": version,
    }


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
    auth: Auth,
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
        preview = get_activity(db, identifier)
        preview_revision = db.scalar(
            select(ActivityRevision).where(
                ActivityRevision.id == revision_id,
                ActivityRevision.activity_id == preview.id,
            )
        )
        preview_transfer = (
            preview_revision.snapshot.get("transfer") if preview_revision else None
        )
        transfer_project: Project | None = None
        if preview.transfer_id and isinstance(preview_transfer, dict):
            transfer_project = db.get(
                Project, preview.request_project_id, with_for_update=True
            )
            target_year = preview_transfer.get("target_year")
            if not transfer_project or not isinstance(target_year, int):
                raise AuthError(409, "transfer_stale")
            list(
                db.scalars(
                    select(AnnualPTA)
                    .where(
                        AnnualPTA.project_id == preview.request_project_id,
                        AnnualPTA.year.in_([preview.placement_year, target_year]),
                    )
                    .order_by(AnnualPTA.id)
                    .with_for_update()
                )
            )
            db.refresh(preview, with_for_update=True)
            item = preview
        else:
            item = get_activity_for_command(db, identifier, actor)
        revision = db.scalar(
            select(ActivityRevision)
            .where(
                ActivityRevision.id == revision_id,
                ActivityRevision.activity_id == item.id,
            )
            .with_for_update()
        )
        if not revision:
            raise AuthError(404, "revision_not_found")
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        if item.current_revision_id != revision.id:
            raise AuthError(409, "revision_obsolete")
        snapshot = cast(dict[str, Any], revision.snapshot)
        withdrawal_request = cast(dict[str, str] | None, snapshot.get("withdrawal"))
        transfer_request = cast(dict[str, Any] | None, snapshot.get("transfer"))
        if item.withdrawal_id:
            lifecycle_eligible(db, auth, item)
            if (
                not withdrawal_request
                or withdrawal_request.get("id") != item.withdrawal_id
                or withdrawal_request.get("base_approved_revision_id")
                != item.approved_revision_id
            ):
                raise AuthError(409, "withdrawal_stale")
        if item.transfer_id:
            lifecycle_eligible(db, auth, item)
            if (
                not transfer_request
                or transfer_request.get("id") != item.transfer_id
                or transfer_request.get("base_approved_revision_id")
                != item.approved_revision_id
            ):
                raise AuthError(409, "transfer_stale")
        if item.amendment_id and (
            snapshot.get("amendment_id") != item.amendment_id
            or snapshot.get("base_approved_revision_id") != item.approved_revision_id
        ):
            raise AuthError(409, "amendment_stale")
        if db.scalar(
            select(ActivityContributor.id).where(
                ActivityContributor.activity_id == item.id,
                ActivityContributor.user_id == actor.id,
            )
        ):
            raise AuthError(409, "reviewer_contributed")
        if body.decision == "return" and not body.reason:
            raise AuthError(422, "reason_required")
        if body.decision != "return" and (
            body.reason is not None or body.requested_amount is not None
        ):
            raise AuthError(422, "input_invalid")
        if (
            withdrawal_request or transfer_request
        ) and body.requested_amount is not None:
            raise AuthError(422, "input_invalid")
        before = activity_item(db, item, actor.role, actor.id)
        now = auth.now(db)
        prevalidation_id = None
        ended_assignment_ids: list[str] | None = None
        if actor.role == "AGENT_VERIFICATEUR":
            if item.state != "submitted" or body.decision not in {
                "prevalidate",
                "return",
            }:
                raise AuthError(409, "decision_ineligible")
            stage = "supervisor"
            outcome = "prevalidated" if body.decision == "prevalidate" else "returned"
            item.state = (
                "prevalidated"
                if body.decision == "prevalidate"
                else "returned_supervisor"
            )
            action = (
                "activity.prevalidate"
                if body.decision == "prevalidate"
                else "activity.return_supervisor"
            )
            if withdrawal_request:
                action = (
                    "activity.withdrawal_prevalidate"
                    if body.decision == "prevalidate"
                    else "activity.withdrawal_return_supervisor"
                )
            elif transfer_request:
                action = (
                    "activity.transfer_prevalidate"
                    if body.decision == "prevalidate"
                    else "activity.transfer_return_supervisor"
                )
        else:
            if item.state != "prevalidated" or body.decision not in {
                "approve",
                "return",
            }:
                raise AuthError(409, "decision_ineligible")
            prevalidation = db.scalar(
                select(ActivityRevisionDecision).where(
                    ActivityRevisionDecision.revision_id == revision.id,
                    ActivityRevisionDecision.stage == "supervisor",
                    ActivityRevisionDecision.outcome == "prevalidated",
                )
            )
            if not prevalidation or prevalidation.actor_id == actor.id:
                raise AuthError(409, "decision_ineligible")
            stage = "validator"
            outcome = "approved" if body.decision == "approve" else "returned"
            if body.decision == "approve":
                if withdrawal_request:
                    item.state = "withdrawn"
                    ended_assignment_ids = []
                    now_for_assignments = now
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
                    for assignment in assignments:
                        assignment.ended_at = now_for_assignments
                        assignment.ended_by_id = actor.id
                        ended_assignment_ids.append(assignment.id)
                elif transfer_request:
                    if not transfer_project or transfer_project.state != "active":
                        raise AuthError(409, "transfer_ineligible")
                    target_year = int(transfer_request["target_year"])
                    target = db.scalar(
                        select(AnnualPTA).where(
                            AnnualPTA.project_id == item.request_project_id,
                            AnnualPTA.year == target_year,
                        )
                    )
                    if not target:
                        raise AuthError(409, "pta_required")
                    item.pta_id = target.id
                    item.placement_year = target_year
                    item.planned_start = date.fromisoformat(
                        cast(str, snapshot["planned_start"])
                    )
                    item.planned_end = date.fromisoformat(
                        cast(str, snapshot["planned_end"])
                    )
                    item.state = "approved"
                    item.approved_revision_id = revision.id
                    item.transfer_id = None
                else:
                    item.state = "approved"
                    item.approved_revision_id = revision.id
                    item.amendment_id = None
                    item.amendment_reason = None
                prevalidation_id = revision.id
                action = (
                    "activity.withdrawal_approve"
                    if withdrawal_request
                    else "activity.transfer_approve"
                    if transfer_request
                    else "activity.approve"
                )
            else:
                item.state = "returned_validator"
                action = (
                    "activity.withdrawal_return_validator"
                    if withdrawal_request
                    else "activity.transfer_return_validator"
                    if transfer_request
                    else "activity.return_validator"
                )
        requested = xof(body.requested_amount) if body.requested_amount else None
        if requested is not None and not (
            actor.role == "VALIDATEUR_DEFINITIF" and body.decision == "return"
        ):
            raise AuthError(422, "input_invalid")
        decision = ActivityRevisionDecision(
            context_id=CONTEXT,
            activity_id=item.id,
            revision_id=revision.id,
            stage=stage,
            outcome=outcome,
            actor_id=actor.id,
            actor_role=actor.role,
            decided_at=now,
            reason=body.reason,
            requested_amount=requested,
            prevalidation_revision_id=prevalidation_id,
        )
        db.add(decision)
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        workflow_audit(
            auth,
            db,
            action,
            actor,
            item,
            before,
            after,
            revision,
            decision,
            ended_assignment_ids,
        )
        return created(
            request,
            f"/api/v1/activities/{item.id}/revisions/{revision.id}",
            decision_payload(decision, item.version),
        )


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
        principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, shared=True)
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
        principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, shared=True)
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
        item = get_activity(db, identifier, lock=True)
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
        plan, incoming = validate_plan(payload, pta.year)
        assert_types(db, incoming)
        current = {
            row.id: row
            for row in db.scalars(
                select(Operation)
                .where(Operation.activity_id == item.id, Operation.removed_at.is_(None))
                .with_for_update()
            )
        }
        before_structure = structural_content(db, item)
        before = activity_item(db, item, actor.role, actor.id)
        if item.current_revision_id:
            revision = db.get(ActivityRevision, item.current_revision_id)
            assert revision
            submitted_operations = cast(
                list[dict[str, str | int]], revision.snapshot["operations"]
            )
            submitted_ids = {str(row["id"]) for row in submitted_operations}
            submitted_allocation = int(cast(str, revision.snapshot["allocation"]))
            incoming_ids = {row["id"] for row in incoming if row["id"]}
            if not submitted_ids.issubset(incoming_ids):
                raise AuthError(409, "submitted_operation_removal_forbidden")
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
                    for key in ("type_id", "name", "allocation", "position")
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
            operation.allocation = row["allocation"]
            operation.position = row["position"]
            operation.updated_by_id = actor.id
            operation.updated_at = now
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
    identifier: str, body: AssignmentReplace, request: Request, auth: Auth
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
        item = get_activity(db, identifier, lock=True)
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
        for agent_id in body.agent_ids:
            if agent_id not in current:
                db.add(
                    ActivityAssignment(
                        context_id=CONTEXT,
                        activity_id=item.id,
                        agent_id=agent_id,
                        assigned_by_id=actor.id,
                        assigned_at=now,
                    )
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
        return result


@router.get("/assignment-agents", response_model=ListOutput[AgentOutput])
def assignment_agents(
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        principal(
            db,
            auth,
            evidence(request, auth)[0],
            roles={"AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"},
        )
        limit, token = args
        cursor = Cursor(auth, "assignment-agents", CONTEXT, limit)
        marker, direction = cursor.decode(token)
        conditions = [User.role == "AGENT_SAISIE", User.state == "active"]
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
            (User.role == "AGENT_SAISIE", User.state == "active"),
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
            query = urlencode({"limit": limit, "cursor": value})
            return f"{auth.policy.origin}/api/v1/assignment-agents?{query}"

        return {
            "object": "list",
            "count": total,
            "data": [{"id": row.id, "email": row.email} for row in rows],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }
