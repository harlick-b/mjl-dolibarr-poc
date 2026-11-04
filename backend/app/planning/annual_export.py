from __future__ import annotations

import csv
import hashlib
from io import StringIO
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.annual_pdf import pdf_artifact
from app.planning.annual_report import XLSX_MEDIA_TYPE, workbook_artifact
from app.planning.models import (
    Activity,
    ActivityRevision,
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
from app.planning.service import BUSINESS_ROLES, CONTEXT, principal

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA annual export"],
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


class ExportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    format: Literal["csv", "xlsx", "pdf"]


STATE_LABELS = {
    "amendment_draft": "Modification en préparation",
    "submitted": "Soumise",
    "prevalidated": "Prévalidée",
    "returned_supervisor": "Retournée par le superviseur",
    "returned_validator": "Retournée par le validateur",
    "approved": "Approuvée",
    "closed": "Clôturée",
}
MAX_EXPORT_ROWS = 10_000


def csv_cell(value: object | None) -> str:
    result = "" if value is None else str(value)
    if result.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + result
    return result


def rate(numerator: int, denominator: int) -> str:
    if denominator == 0:
        return "Non calculable"
    tenths = (numerator * 1000 + denominator // 2) // denominator
    whole, decimal = divmod(tenths, 10)
    return f"{whole}{f',{decimal}' if decimal else ''} %"


def current_rows(db: Session, pta: AnnualPTA) -> list[dict[str, Any]]:
    activities = list(
        db.execute(
            select(
                Activity.id,
                Activity.reference,
                Activity.state,
                Activity.approved_revision_id,
                Activity.closed_at,
            )
            .where(
                Activity.context_id == CONTEXT,
                Activity.pta_id == pta.id,
                Activity.approved_revision_id.is_not(None),
                Activity.state != "withdrawn",
            )
            .order_by(Activity.planned_start, Activity.reference, Activity.id)
            .limit(MAX_EXPORT_ROWS + 1)
        )
    )
    if len(activities) > MAX_EXPORT_ROWS:
        raise AuthError(422, "selection_too_large")
    revision_ids = {
        item.approved_revision_id for item in activities if item.approved_revision_id
    }
    revisions = {
        item.id: item
        for item in db.execute(
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
                ActivityRevision.snapshot["allocation"].as_string().label("allocation"),
            ).where(ActivityRevision.id.in_(revision_ids))
        )
    }
    activity_ids = {item.id for item in activities}
    spending_by_activity = {
        item.activity_id: int(item.actual_spent or 0)
        for item in db.execute(
            select(
                Operation.activity_id,
                func.sum(Operation.actual_spent).label("actual_spent"),
            )
            .where(
                Operation.activity_id.in_(activity_ids), Operation.removed_at.is_(None)
            )
            .group_by(Operation.activity_id)
        )
    }
    confirmations = {
        item.activity_id: item
        for item in db.execute(
            select(
                VirementConfirmation.activity_id,
                VirementConfirmation.amount,
                VirementConfirmation.transfer_date,
                VirementConfirmation.revision,
            )
            .where(VirementConfirmation.activity_id.in_(activity_ids))
            .ext(distinct_on(VirementConfirmation.activity_id))
            .order_by(
                VirementConfirmation.activity_id, VirementConfirmation.revision.desc()
            )
        )
    }
    reversements = {
        item.activity_id: item
        for item in db.execute(
            select(
                ReversementDeclaration.activity_id,
                ReversementDeclaration.amount,
                ReversementDeclaration.return_date,
                ReversementDeclaration.revision,
            )
            .where(ReversementDeclaration.activity_id.in_(activity_ids))
            .ext(distinct_on(ReversementDeclaration.activity_id))
            .order_by(
                ReversementDeclaration.activity_id,
                ReversementDeclaration.revision.desc(),
            )
        )
    }
    zero_spending = set(
        db.scalars(
            select(ZeroSpendingDeclaration.activity_id).where(
                ZeroSpendingDeclaration.activity_id.in_(activity_ids),
                ZeroSpendingDeclaration.state == "approved",
            )
        )
    )
    result = []
    for activity in activities:
        revision = revisions.get(activity.approved_revision_id or "")
        if not revision:
            raise AuthError(409, "export_unavailable")
        closed = activity.state == "closed"
        spending = spending_by_activity.get(activity.id, 0) if closed else None
        confirmation = confirmations.get(activity.id) if closed else None
        reversement = reversements.get(activity.id) if closed else None
        required = None
        if closed:
            required = (
                0
                if activity.id in zero_spending
                else max(0, int(revision.allocation) - int(spending or 0))
            )
        result.append(
            {
                "id": activity.id,
                "reference": activity.reference,
                "name": revision.name,
                "revision": revision.revision_number,
                "start": revision.planned_start,
                "end": revision.planned_end,
                "state": STATE_LABELS.get(activity.state, activity.state),
                "allocation": revision.allocation,
                "spending": spending,
                "confirmation_amount": confirmation.amount if confirmation else None,
                "confirmation_date": confirmation.transfer_date
                if confirmation
                else None,
                "reversement_required": required,
                "reversement_amount": reversement.amount if reversement else None,
                "reversement_date": reversement.return_date if reversement else None,
                "closed_at": activity.closed_at.isoformat()
                if activity.closed_at
                else None,
            }
        )
    return sorted(
        result,
        key=lambda row: (str(row["start"]), str(row["reference"]), str(row["id"])),
    )


def export_metadata(
    *,
    export_id: str,
    generated_at: str,
    actor_email: str,
    partner: Partner,
    project: Project,
    pta: AnnualPTA,
    metrics: dict[str, Any],
    rows: list[dict[str, Any]],
) -> tuple[tuple[str, object], ...]:
    physical = metrics["physical"]
    financial = metrics["financial"]
    return (
        ("Identifiant export", export_id),
        ("Généré par", actor_email),
        ("Date de génération UTC", generated_at),
        ("Données capturées UTC", metrics["as_of"]),
        ("Partenaire", partner.name),
        ("Référence projet", project.reference),
        ("Projet", project.name),
        ("Identifiant PTA", pta.id),
        ("Exercice", pta.year),
        ("Activités clôturées", physical["closed_activities"]),
        ("Activités approuvées", physical["approved_activities"]),
        (
            "Exécution physique",
            rate(physical["closed_activities"], physical["approved_activities"]),
        ),
        ("Dépenses finales clôturées XOF", financial["closed_spending"]),
        ("Allocation approuvée XOF", financial["approved_allocation"]),
        (
            "Exécution financière",
            rate(
                int(financial["closed_spending"]),
                int(financial["approved_allocation"]),
            ),
        ),
    )


def artifact(
    metadata: tuple[tuple[str, object], ...], rows: list[dict[str, Any]]
) -> bytes:
    output = StringIO(newline="")
    writer = csv.writer(output, delimiter=";", lineterminator="\r\n")
    writer.writerows((csv_cell(key), csv_cell(value)) for key, value in metadata)
    writer.writerow(())
    writer.writerow(
        (
            "Identifiant activité",
            "Référence activité",
            "Nom activité",
            "Révision approuvée",
            "Début approuvé",
            "Fin approuvée",
            "État actuel",
            "Allocation approuvée XOF",
            "Dépense finale XOF",
            "Virement externe confirmé XOF",
            "Date du virement externe",
            "Reversement requis XOF",
            "Reversement déclaré XOF",
            "Date du reversement",
            "Date de clôture UTC",
        )
    )
    for row in rows:
        writer.writerow(tuple(csv_cell(value) for value in row.values()))
    return ("\ufeff" + output.getvalue()).encode("utf-8")


@router.post(
    "/ptas/{identifier}/exports",
    response_class=Response,
    openapi_extra=MUTATION_HEADERS,
    responses={
        200: {
            "description": "Export CSV ou rapport de travail Excel/PDF du PTA courant.",
            "content": {
                "text/csv": {"schema": {"type": "string", "format": "binary"}},
                XLSX_MEDIA_TYPE: {"schema": {"type": "string", "format": "binary"}},
                "application/pdf": {"schema": {"type": "string", "format": "binary"}},
            },
        }
    },
)
def annual_export(
    identifier: str, body: ExportInput, request: Request, auth: Auth
) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        secret, csrf = evidence(request, auth)
        actor = principal(
            db,
            auth,
            secret,
            csrf,
            roles=BUSINESS_ROLES,
            mutation=True,
        )
        pta = db.get(AnnualPTA, identifier)
        if not pta or pta.context_id != CONTEXT:
            raise AuthError(404, "pta_not_found")
        project = db.get(Project, pta.project_id)
        partner = db.get(Partner, project.partner_id) if project else None
        if not project or not partner or project.context_id != CONTEXT:
            raise AuthError(404, "pta_not_found")
        cutoff = cutoff_value(db, None)
        metrics = annual_metrics_data(db, pta, cutoff)
        rows = current_rows(db, pta)
        export_id = str(uuid4())
        generated_at = auth.now(db).isoformat()
        metadata = export_metadata(
            export_id=export_id,
            generated_at=generated_at,
            actor_email=actor.email,
            partner=partner,
            project=project,
            pta=pta,
            metrics=metrics,
            rows=rows,
        )
        if body.format == "csv":
            content = artifact(metadata, rows)
            media_type = "text/csv; charset=utf-8"
        elif body.format == "xlsx":
            content = workbook_artifact(metadata, rows)
            media_type = XLSX_MEDIA_TYPE
        else:
            content = pdf_artifact(metadata, rows)
            media_type = "application/pdf"
        auth.audit(
            db,
            "pta.export",
            actor.id,
            export_id,
            details={
                "format": body.format,
                "pta_id": pta.id,
                "row_count": len(rows),
                "byte_size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "as_of": metrics["as_of"],
            },
        )
        filename = f"pta-{pta.year}-{export_id}.{body.format}"
        return Response(
            content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(content)),
            },
        )
