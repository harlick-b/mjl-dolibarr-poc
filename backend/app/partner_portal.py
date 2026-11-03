from __future__ import annotations

from typing import Annotated, Any, Literal
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.models import Activity, ActivityRevision, AnnualPTA, Partner, Project
from app.planning.routes import annual_metrics_data, cutoff_value, locked_read
from app.planning.service import CONTEXT, Cursor, page_rows

router = APIRouter(
    prefix="/api/v1/partner-portal",
    tags=["Partner portal"],
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


class Output(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PartnerProfile(Output):
    id: str
    name: str


class ProjectItem(Output):
    id: str
    reference: str
    name: str
    state: Literal["active", "closed"]


class MetricPhysical(Output):
    closed_activities: int
    approved_activities: int


class MetricFinancial(Output):
    closed_spending: str
    approved_allocation: str


class Metrics(Output):
    pta_id: str
    as_of: str
    physical: MetricPhysical
    financial: MetricFinancial


class PTAItem(Output):
    id: str
    year: int
    metrics: Metrics


class ActivityItem(Output):
    id: str
    reference: str
    name: str
    planned_start: str
    planned_end: str
    allocation: str
    state: Literal["approved", "closed"]
    approved_revision: int


class ListOutput[Item](Output):
    object: Literal["list"]
    count: int
    data: list[Item]
    next: str | None
    previous: str | None


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


def partner_principal(
    db: Session, auth: Auth, request: Request
) -> tuple[User, Partner]:
    actor = auth.principal(db, evidence(request, auth)[0])
    if actor.role != "PARTENAIRE" or not actor.partner_id:
        raise AuthError(403, "partner_required")
    auth.environment_verified(db)
    partner = db.get(Partner, actor.partner_id)
    if not partner or partner.context_id != CONTEXT or not partner.active:
        raise AuthError(403, "partner_required")
    return actor, partner


def visible_pta(pta_id: Any) -> Any:
    return (
        select(Activity.id)
        .where(
            Activity.context_id == CONTEXT,
            Activity.pta_id == pta_id,
            Activity.approved_revision_id.is_not(None),
            Activity.state != "withdrawn",
        )
        .exists()
    )


def scoped_page(
    db: Session,
    auth: Auth,
    *,
    model: Any,
    resource: str,
    parent: str,
    conditions: tuple[Any, ...],
    limit: int,
    token: str | None,
) -> tuple[list[Any], int, str | None, str | None]:
    cursor = Cursor(auth, resource, parent, limit)
    marker, direction = cursor.decode(token)
    page_conditions = list(conditions)
    if marker:
        try:
            marker = str(UUID(marker))
        except ValueError:
            raise AuthError(422, "cursor_invalid") from None
        page_conditions.append(
            model.id > marker if direction == "next" else model.id < marker
        )
    ordering = (model.id.asc() if direction == "next" else model.id.desc(),)
    rows, total = page_rows(
        db, model, conditions, tuple(page_conditions), ordering, limit
    )
    more = len(rows) > limit
    rows = rows[:limit]
    if direction == "previous":
        rows.reverse()
    params: dict[str, int | str] = {"limit": limit}
    next_link = previous_link = None
    base = f"{auth.policy.origin}/api/v1/partner-portal/{resource}"
    if rows and ((direction == "next" and more) or direction == "previous"):
        params["cursor"] = cursor.encode(rows[-1].id, "next")
        next_link = f"{base}?{urlencode(params)}"
    if rows and (
        (direction == "previous" and more) or (direction == "next" and marker)
    ):
        params["cursor"] = cursor.encode(rows[0].id, "previous")
        previous_link = f"{base}?{urlencode(params)}"
    return rows, total, next_link, previous_link


@router.get("/profile", response_model=PartnerProfile)
def profile(request: Request, auth: Auth) -> PartnerProfile:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        _actor, partner = partner_principal(db, auth, request)
        return PartnerProfile(id=partner.id, name=partner.name)


@router.get("/projects", response_model=ListOutput[ProjectItem])
def projects(
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        _actor, partner = partner_principal(db, auth, request)
        rows, total, next_link, previous_link = scoped_page(
            db,
            auth,
            model=Project,
            resource="projects",
            parent=partner.id,
            conditions=(
                Project.context_id == CONTEXT,
                Project.partner_id == partner.id,
            ),
            limit=args[0],
            token=args[1],
        )
        return {
            "object": "list",
            "count": total,
            "data": [
                {
                    "id": row.id,
                    "reference": row.reference,
                    "name": row.name,
                    "state": row.state,
                }
                for row in rows
            ],
            "next": next_link,
            "previous": previous_link,
        }


@router.get("/projects/{project_id}/ptas", response_model=ListOutput[PTAItem])
def ptas(
    project_id: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        _actor, partner = partner_principal(db, auth, request)
        project = db.get(Project, project_id)
        if (
            not project
            or project.context_id != CONTEXT
            or project.partner_id != partner.id
        ):
            raise AuthError(404, "portal_resource_not_found")
        rows, total, next_link, previous_link = scoped_page(
            db,
            auth,
            model=AnnualPTA,
            resource=f"projects/{project.id}/ptas",
            parent=project.id,
            conditions=(
                AnnualPTA.context_id == CONTEXT,
                AnnualPTA.project_id == project.id,
                visible_pta(AnnualPTA.id),
            ),
            limit=args[0],
            token=args[1],
        )
        cutoff = cutoff_value(db, None)
        return {
            "object": "list",
            "count": total,
            "data": [
                {
                    "id": row.id,
                    "year": row.year,
                    "metrics": annual_metrics_data(db, row, cutoff),
                }
                for row in rows
            ],
            "next": next_link,
            "previous": previous_link,
        }


@router.get("/ptas/{pta_id}/activities", response_model=ListOutput[ActivityItem])
def activities(
    pta_id: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        _actor, partner = partner_principal(db, auth, request)
        pta = db.get(AnnualPTA, pta_id)
        project = db.get(Project, pta.project_id) if pta else None
        if (
            not pta
            or pta.context_id != CONTEXT
            or not project
            or project.partner_id != partner.id
            or not db.scalar(select(visible_pta(pta.id)))
        ):
            raise AuthError(404, "portal_resource_not_found")
        conditions = (
            Activity.context_id == CONTEXT,
            Activity.pta_id == pta.id,
            Activity.approved_revision_id.is_not(None),
            Activity.state != "withdrawn",
        )
        rows, total, next_link, previous_link = scoped_page(
            db,
            auth,
            model=Activity,
            resource=f"ptas/{pta.id}/activities",
            parent=pta.id,
            conditions=conditions,
            limit=args[0],
            token=args[1],
        )
        revision_ids = [row.approved_revision_id for row in rows]
        revisions = {
            row.id: row
            for row in db.execute(
                select(
                    ActivityRevision.id,
                    ActivityRevision.revision_number,
                    ActivityRevision.snapshot["name"].as_string().label("name"),
                    ActivityRevision.snapshot["planned_start"]
                    .as_string()
                    .label("planned_start"),
                    ActivityRevision.snapshot["planned_end"]
                    .as_string()
                    .label("planned_end"),
                    ActivityRevision.snapshot["allocation"]
                    .as_string()
                    .label("allocation"),
                ).where(ActivityRevision.id.in_(revision_ids))
            )
        }
        data = []
        for row in rows:
            revision = revisions.get(row.approved_revision_id or "")
            if not revision:
                raise AuthError(409, "portal_projection_unavailable")
            data.append(
                {
                    "id": row.id,
                    "reference": row.reference,
                    "name": revision.name,
                    "planned_start": revision.planned_start,
                    "planned_end": revision.planned_end,
                    "allocation": revision.allocation,
                    "state": "closed" if row.state == "closed" else "approved",
                    "approved_revision": revision.revision_number,
                }
            )
        return {
            "object": "list",
            "count": total,
            "data": data,
            "next": next_link,
            "previous": previous_link,
        }
