from typing import Annotated, Any, Literal
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.models import (
    Activity,
    ActivityAssignment,
    AnnualPTA,
    Operation,
    OperationType,
    Partner,
    Project,
)
from app.planning.service import (
    CONTEXT,
    Cursor,
    activity_item,
    assert_types,
    clean,
    fingerprint,
    list_rows,
    locked_mutation,
    page_rows,
    partner_item,
    principal,
    project_item,
    reference,
    type_item,
    validate_plan,
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
    agent_ids: list[str] = Field(max_length=100)

    @field_validator("agent_ids")
    @classmethod
    def distinct_ids(cls, values: list[str]) -> list[str]:
        normalized = [str(UUID(value)) for value in values]
        if len(set(normalized)) != len(normalized):
            raise ValueError("Duplicate Agent")
        return normalized


class PartnerOutput(Input):
    id: str
    name: str
    active: bool
    allowed_actions: list[str]


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


class OperationOutput(Input):
    id: str
    type_id: str
    name: str
    allocation: str
    position: int


class ActivityOutput(Input):
    id: str
    pta_id: str
    reference: str
    name: str
    description: str
    planned_start: str
    planned_end: str
    allocation: str
    state: Literal["draft"]
    version: int
    operations: list[OperationOutput]
    agent_ids: list[str]
    allowed_actions: list[str]


class PTAOutput(Input):
    id: str
    project_id: str
    year: int
    allowed_actions: list[str] = Field(default_factory=lambda: ["read"])


class PTAContextOutput(Input):
    project: ProjectOutput
    year: int
    pta: PTAOutput | None
    allowed_actions: list[str]


class AgentOutput(Input):
    id: str
    email: str


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
        actor = principal(db, auth, evidence(request, auth)[0])
        return list_rows(
            db,
            auth,
            Partner,
            "partners",
            CONTEXT,
            actor.role,
            *args,
            where=(Partner.context_id == CONTEXT,),
        )


@router.post(
    "/partners",
    status_code=201,
    response_model=PartnerOutput,
    openapi_extra=MUTATION_HEADERS,
)
def create_partner(body: NameInput, request: Request, auth: Auth) -> Response:
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
            roles={"VALIDATEUR_DEFINITIF"},
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
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        return list_rows(
            db,
            auth,
            Project,
            "projects",
            CONTEXT,
            actor.role,
            *args,
            where=(Project.context_id == CONTEXT,),
        )


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
    identifier: str, body: ProjectClose, request: Request, auth: Auth
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
        if item.state != "active":
            raise AuthError(409, "project_closed")
        if db.scalar(
            select(Activity.id)
            .join(AnnualPTA, Activity.pta_id == AnnualPTA.id)
            .where(AnnualPTA.project_id == item.id)
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


@router.get("/projects/{identifier}/ptas", response_model=ListOutput[PTAOutput])
def project_ptas(
    identifier: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        principal(db, auth, evidence(request, auth)[0])
        project = get_project(db, identifier)
        limit, token = args
        cursor = Cursor(auth, "project-ptas", project.id, limit)
        marker, direction = cursor.decode(token)
        conditions = [AnnualPTA.project_id == project.id]
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
            (AnnualPTA.project_id == project.id,),
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
            return f"{auth.policy.origin}/api/v1/projects/{project.id}/ptas?{query}"

        return {
            "object": "list",
            "count": total,
            "data": [
                {
                    "id": row.id,
                    "project_id": row.project_id,
                    "year": row.year,
                    "allowed_actions": ["read"],
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
    identifier: str, year: int, request: Request, auth: Auth
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        project = get_project(db, identifier)
        if not 2000 <= year <= 2200:
            raise AuthError(422, "input_invalid")
        pta = db.scalar(
            select(AnnualPTA).where(
                AnnualPTA.project_id == project.id, AnnualPTA.year == year
            )
        )
        return {
            "project": project_item(project, actor.role),
            "year": year,
            "pta": None
            if not pta
            else {
                "id": pta.id,
                "project_id": pta.project_id,
                "year": pta.year,
                "allowed_actions": ["read"],
            },
            "allowed_actions": ["read"]
            + (
                ["create_activity"]
                if actor.role == "AGENT_SAISIE" and project.state == "active"
                else []
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
                activity_item(db, existing, actor.role),
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
            pta = AnnualPTA(
                context_id=CONTEXT,
                project_id=project.id,
                year=year,
                creator_id=actor.id,
                created_at=now,
            )
            db.add(pta)
            db.flush()
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
        result = activity_item(db, item, actor.role)
        auth.business_audit(
            db,
            "activity.create",
            actor.id,
            item.id,
            {"context_id": CONTEXT, "after": result},
        )
        return created(request, f"/api/v1/activities/{item.id}", result)


def get_activity(db: Session, identifier: str, *, lock: bool = False) -> Activity:
    item = db.get(Activity, identifier, with_for_update=lock)
    if not item or item.context_id != CONTEXT:
        raise AuthError(404, "activity_not_found")
    return item


@router.get("/ptas/{identifier}/activities", response_model=ListOutput[ActivityOutput])
def activities(
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
        cursor = Cursor(auth, "pta-activities", pta.id, limit)
        marker, direction = cursor.decode(token)
        conditions = [Activity.pta_id == pta.id]
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
            (Activity.pta_id == pta.id,),
            tuple(conditions),
            (order,),
            limit,
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: Activity, move: str) -> str:
            value = cursor.encode(row.id, move)
            query = urlencode({"limit": limit, "cursor": value})
            return f"{auth.policy.origin}/api/v1/ptas/{pta.id}/activities?{query}"

        return {
            "object": "list",
            "count": total,
            "data": [activity_item(db, row, actor.role) for row in rows],
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
        return activity_item(db, get_activity(db, identifier), actor.role)


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
        pta = db.get(AnnualPTA, item.pta_id)
        assert pta
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
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
        before = activity_item(db, item, actor.role)
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
        after = activity_item(db, item, actor.role)
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
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
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
        before = activity_item(db, item, actor.role)
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
        result = activity_item(db, item, actor.role)
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
