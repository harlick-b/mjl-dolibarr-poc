from __future__ import annotations

import hashlib
import re
from typing import Annotated, Any, Literal
from urllib.parse import quote, urlencode
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.partner_export import artifact as partner_csv
from app.partner_fiche import render_partner_fiche
from app.planning import annual_export as annual_csv
from app.planning.models import (
    Activity,
    ActivityDocument,
    ActivityDocumentWithdrawal,
    ActivityRevision,
    ActivityRevisionDecision,
    AnnualPTA,
    Operation,
    Partner,
    Project,
    ReversementDeclaration,
    VirementConfirmation,
    ZeroSpendingDeclaration,
)
from app.planning.routes import (
    MUTATION_HEADERS,
    annual_metrics_data,
    cutoff_value,
    locked_read,
)
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


class PDFResponse(Response):
    media_type = "application/pdf"


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


class ActivityContext(Output):
    partner: str
    project_reference: str
    project: str
    year: int


class OperationItem(Output):
    name: str
    description: str
    allocation: str
    final_spending: str | None


class FinalDecision(Output):
    kind: Literal["initial", "amendment", "transfer"]
    revision: int
    decided_at: str


class CompletedFinance(Output):
    approved_allocation: str
    final_spending: str
    zero_spending: bool
    confirmed_transfer_amount: str | None
    confirmed_transfer_date: str | None
    reversement_required: str
    reversement_amount: str | None
    reversement_date: str | None
    closed_at: str


class ActivityDetail(ActivityItem):
    description: str
    context: ActivityContext
    operations: list[OperationItem]
    decisions: list[FinalDecision]
    finance: CompletedFinance | None


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


def visible_activity(
    db: Session, partner: Partner, activity_id: str
) -> tuple[Activity, AnnualPTA, Project]:
    activity = db.get(Activity, activity_id)
    pta = db.get(AnnualPTA, activity.pta_id) if activity else None
    project = db.get(Project, pta.project_id) if pta else None
    if (
        not activity
        or activity.context_id != CONTEXT
        or not activity.approved_revision_id
        or activity.state == "withdrawn"
        or not pta
        or pta.context_id != CONTEXT
        or not project
        or project.context_id != CONTEXT
        or project.partner_id != partner.id
    ):
        raise AuthError(404, "portal_resource_not_found")
    return activity, pta, project


def decision_kind(revision: ActivityRevision) -> str:
    if isinstance(revision.snapshot.get("transfer"), dict):
        return "transfer"
    return "initial" if revision.revision_number == 1 else "amendment"


def activity_detail_data(
    db: Session,
    partner: Partner,
    activity: Activity,
    pta: AnnualPTA,
    project: Project,
) -> dict[str, Any]:
    revision = db.get(ActivityRevision, activity.approved_revision_id)
    if not revision or revision.activity_id != activity.id:
        raise AuthError(409, "portal_projection_unavailable")
    snapshot = revision.snapshot
    snapshot_operations = snapshot.get("operations")
    if not isinstance(snapshot_operations, list):
        raise AuthError(409, "portal_projection_unavailable")
    operation_ids = {
        str(row.get("id"))
        for row in snapshot_operations
        if isinstance(row, dict) and row.get("id")
    }
    current_operations = {
        row.id: row
        for row in db.scalars(
            select(Operation).where(
                Operation.activity_id == activity.id, Operation.id.in_(operation_ids)
            )
        )
    }
    operations = []
    for row in snapshot_operations:
        if not isinstance(row, dict):
            raise AuthError(409, "portal_projection_unavailable")
        current = current_operations.get(str(row.get("id")))
        operations.append(
            {
                "name": str(row.get("name") or ""),
                "description": str(row.get("description") or ""),
                "allocation": str(row.get("allocation") or "0"),
                "final_spending": (
                    str(current.actual_spent)
                    if activity.state == "closed"
                    and current
                    and current.actual_spent is not None
                    else None
                ),
            }
        )
    decision_rows = list(
        db.execute(
            select(ActivityRevisionDecision, ActivityRevision)
            .join(
                ActivityRevision,
                ActivityRevision.id == ActivityRevisionDecision.revision_id,
            )
            .where(
                ActivityRevisionDecision.activity_id == activity.id,
                ActivityRevisionDecision.stage == "validator",
                ActivityRevisionDecision.outcome == "approved",
            )
            .order_by(ActivityRevisionDecision.decided_at)
        )
    )
    decisions = [
        {
            "kind": decision_kind(item_revision),
            "revision": item_revision.revision_number,
            "decided_at": decision.decided_at.isoformat(),
        }
        for decision, item_revision in decision_rows
    ]
    finance = None
    if activity.state == "closed":
        spending = db.scalar(
            select(func.sum(Operation.actual_spent)).where(
                Operation.activity_id == activity.id, Operation.id.in_(operation_ids)
            )
        )
        if spending is None or activity.closed_at is None:
            raise AuthError(409, "portal_projection_unavailable")
        zero = db.scalar(
            select(ZeroSpendingDeclaration.id).where(
                ZeroSpendingDeclaration.activity_id == activity.id,
                ZeroSpendingDeclaration.state == "approved",
            )
        )
        confirmation = db.scalar(
            select(VirementConfirmation)
            .where(VirementConfirmation.activity_id == activity.id)
            .order_by(VirementConfirmation.revision.desc())
            .limit(1)
        )
        reversement = db.scalar(
            select(ReversementDeclaration)
            .where(ReversementDeclaration.activity_id == activity.id)
            .order_by(ReversementDeclaration.revision.desc())
            .limit(1)
        )
        allocation = int(str(snapshot.get("allocation")))
        required = 0 if zero else max(0, allocation - int(spending))
        finance = {
            "approved_allocation": str(allocation),
            "final_spending": str(spending),
            "zero_spending": bool(zero),
            "confirmed_transfer_amount": (
                str(confirmation.amount) if confirmation else None
            ),
            "confirmed_transfer_date": (
                confirmation.transfer_date.isoformat() if confirmation else None
            ),
            "reversement_required": str(required),
            "reversement_amount": str(reversement.amount) if reversement else None,
            "reversement_date": (
                reversement.return_date.isoformat() if reversement else None
            ),
            "closed_at": activity.closed_at.isoformat(),
        }
    return {
        "id": activity.id,
        "reference": activity.reference,
        "name": str(snapshot.get("name") or ""),
        "description": str(snapshot.get("description") or ""),
        "planned_start": str(snapshot.get("planned_start") or ""),
        "planned_end": str(snapshot.get("planned_end") or ""),
        "allocation": str(snapshot.get("allocation") or "0"),
        "state": "closed" if activity.state == "closed" else "approved",
        "approved_revision": revision.revision_number,
        "context": {
            "partner": partner.name,
            "project_reference": project.reference,
            "project": project.name,
            "year": pta.year,
        },
        "operations": operations,
        "decisions": decisions,
        "finance": finance,
    }


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


@router.get("/activities/{activity_id}", response_model=ActivityDetail)
def activity_detail(activity_id: str, request: Request, auth: Auth) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        _actor, partner = partner_principal(db, auth, request)
        activity, pta, project = visible_activity(db, partner, activity_id)
        return activity_detail_data(db, partner, activity, pta, project)


@router.get("/activities/{activity_id}/fiche.pdf", response_class=PDFResponse)
def activity_fiche(activity_id: str, request: Request, auth: Auth) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor, partner = partner_principal(db, auth, request)
        activity, pta, project = visible_activity(db, partner, activity_id)
        generated_at = auth.now(db)
        detail = activity_detail_data(db, partner, activity, pta, project)
        document = render_partner_fiche(detail, generated_at.isoformat())
        auth.audit(
            db,
            "activity.fiche_generated",
            actor.id,
            activity.id,
            details={"role": actor.role, "version": activity.version},
        )
        reference = activity.reference
    return PDFResponse(
        content=document,
        headers={
            "Content-Disposition": (
                f'attachment; filename="fiche-partenaire-{reference}.pdf"'
            ),
            "Content-Length": str(len(document)),
        },
    )


class SharedDocument(Output):
    id: str
    name: str
    media_type: str
    size: int


def shared_document_conditions(activity_id: str) -> tuple[Any, ...]:
    return (
        ActivityDocument.context_id == CONTEXT,
        ActivityDocument.activity_id == activity_id,
        ActivityDocument.partner_shared.is_(True),
        ~select(ActivityDocumentWithdrawal.document_id)
        .where(ActivityDocumentWithdrawal.document_id == ActivityDocument.id)
        .exists(),
    )


@router.get(
    "/activities/{activity_id}/documents", response_model=ListOutput[SharedDocument]
)
def shared_documents(
    activity_id: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor, partner = partner_principal(db, auth, request)
        visible_activity(db, partner, activity_id)
        limit, token = args
        cursor = Cursor(auth, "partner_documents", f"{actor.id}:{activity_id}", limit)
        marker, direction = cursor.decode(token)
        conditions = shared_document_conditions(activity_id)
        page_conditions = list(conditions)
        if marker:
            try:
                marker = str(UUID(marker))
            except ValueError:
                raise AuthError(422, "cursor_invalid") from None
            page_conditions.append(
                ActivityDocument.id > marker
                if direction == "next"
                else ActivityDocument.id < marker
            )
        rows = list(
            db.execute(
                select(
                    ActivityDocument.id,
                    ActivityDocument.display_name.label("name"),
                    ActivityDocument.media_type,
                    ActivityDocument.byte_size.label("size"),
                )
                .where(*page_conditions)
                .order_by(
                    ActivityDocument.id.asc()
                    if direction == "next"
                    else ActivityDocument.id.desc()
                )
                .limit(limit + 1)
            )
        )
        total = (
            db.scalar(
                select(func.count()).select_from(ActivityDocument).where(*conditions)
            )
            or 0
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: Any, move: str) -> str:
            query = urlencode({"limit": limit, "cursor": cursor.encode(row.id, move)})
            return (
                f"{auth.policy.origin}/api/v1/partner-portal/activities/"
                f"{activity_id}/documents?{query}"
            )

        return {
            "object": "list",
            "count": total,
            "data": [dict(row._mapping) for row in rows],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }


def shared_document_bytes(
    activity_id: str,
    document_id: str,
    request: Request,
    auth: Auth,
    *,
    inline: bool,
) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor, partner = partner_principal(db, auth, request)
        visible_activity(db, partner, activity_id)
        item = db.scalar(
            select(ActivityDocument).where(
                *shared_document_conditions(activity_id),
                ActivityDocument.id == document_id,
            )
        )
        if not item:
            raise AuthError(404, "portal_resource_not_found")
        if inline and item.media_type not in {"image/jpeg", "image/png"}:
            raise AuthError(422, "document_preview_unsupported")
        auth.audit(
            db,
            "document.preview" if inline else "document.download",
            actor.id,
            item.id,
            details={"activity_id": activity_id, "role": actor.role},
        )
        content, media_type, name = item.content, item.media_type, item.display_name
    fallback = re.sub(r"[^A-Za-z0-9._-]", "_", name) or "document"
    disposition = "inline" if inline else "attachment"
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'{disposition}; filename="{fallback}"; '
                f"filename*=UTF-8''{quote(name)}"
            ),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
            "Cross-Origin-Resource-Policy": "same-origin",
        },
    )


@router.get(
    "/activities/{activity_id}/documents/{document_id}/download",
    response_class=Response,
    responses={200: {"content": {"application/octet-stream": {}}}},
)
def shared_document_download(
    activity_id: str, document_id: str, request: Request, auth: Auth
) -> Response:
    return shared_document_bytes(activity_id, document_id, request, auth, inline=False)


@router.get(
    "/activities/{activity_id}/documents/{document_id}/preview",
    response_class=Response,
    responses={200: {"content": {"image/png": {}, "image/jpeg": {}}}},
)
def shared_document_preview(
    activity_id: str, document_id: str, request: Request, auth: Auth
) -> Response:
    return shared_document_bytes(activity_id, document_id, request, auth, inline=True)


class PartnerExportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    format: Literal["csv"]


@router.post(
    "/ptas/{pta_id}/exports",
    response_class=Response,
    openapi_extra=MUTATION_HEADERS,
    responses={
        200: {
            "content": {"text/csv": {"schema": {"type": "string", "format": "binary"}}}
        }
    },
)
def export_pta(
    pta_id: str, body: PartnerExportInput, request: Request, auth: Auth
) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        auth.guard(db, *evidence(request, auth))
        actor, partner = partner_principal(db, auth, request)
        pta = db.get(AnnualPTA, pta_id)
        project = db.get(Project, pta.project_id) if pta else None
        if (
            not pta
            or pta.context_id != CONTEXT
            or not project
            or project.context_id != CONTEXT
            or project.partner_id != partner.id
            or not db.scalar(select(visible_pta(pta.id)))
        ):
            raise AuthError(404, "portal_resource_not_found")
        rows = annual_csv.current_rows(db, pta)
        metrics = annual_metrics_data(db, pta, cutoff_value(db, None))
        export_id = str(uuid4())
        content = partner_csv(
            export_id=export_id,
            partner_name=partner.name,
            project_reference=project.reference,
            project_name=project.name,
            year=pta.year,
            metrics=metrics,
            rows=rows,
        )
        auth.audit(
            db,
            "pta.export",
            actor.id,
            export_id,
            details={
                "format": body.format,
                "role": actor.role,
                "pta_id": pta.id,
                "row_count": len(rows),
                "byte_size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "as_of": metrics["as_of"],
            },
        )
        filename = f"pta-partenaire-{pta.year}-{export_id}.csv"
    return Response(
        content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(content)),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
