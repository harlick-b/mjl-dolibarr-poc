import csv
import hashlib
from datetime import datetime
from io import StringIO
from typing import Annotated, Any, Literal, cast
from urllib.parse import urlencode
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import Audit, User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.models import Activity
from app.planning.service import CONTEXT, Cursor, page_rows, principal

router = APIRouter(
    prefix="/api/v1",
    tags=["Audit history"],
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
        status: {"model": ErrorResponse} for status in (401, 403, 422, 429, 503)
    },
)


class Output(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ActorOutput(Output):
    id: str
    email: str


class ActivityOutput(Output):
    id: str
    reference: str
    name: str


class AuditOutput(Output):
    id: int
    occurred_at: str
    action: str
    label: str
    outcome: str
    actor: ActorOutput | None
    activity: ActivityOutput | None


class AuditList(Output):
    object: Literal["list"]
    count: int
    data: list[AuditOutput]
    next: str | None
    previous: str | None


class ExportInput(Output):
    format: Literal["csv"]


ACTION_LABELS = {
    "abuse_limit": "Limite de sécurité atteinte",
    "access_denied": "Accès refusé",
    "account_deactivate": "Compte désactivé",
    "account_role_change": "Rôle du compte modifié",
    "audit.export": "Historique exporté",
    "activity.amendment_cancel": "Modification annulée",
    "activity.amendment_open": "Modification ouverte",
    "activity.approve": "Activité approuvée",
    "activity.assign_agents": "Affectations mises à jour",
    "activity.closed": "Activité clôturée",
    "activity.create": "Activité créée",
    "activity.fiche_generated": "Fiche récapitulative générée",
    "activity.prevalidate": "Activité prévalidée",
    "activity.replace": "Brouillon d’activité modifié",
    "activity.return_supervisor": "Activité retournée par le superviseur",
    "activity.return_validator": "Activité retournée par le validateur",
    "activity.submit": "Activité soumise",
    "activity.transfer_approve": "Transfert annuel approuvé",
    "activity.transfer_cancel": "Transfert annuel annulé",
    "activity.transfer_prevalidate": "Transfert annuel prévalidé",
    "activity.transfer_return_supervisor": "Transfert retourné par le superviseur",
    "activity.transfer_return_validator": "Transfert retourné par le validateur",
    "activity.transfer_submit": "Transfert annuel soumis",
    "activity.withdrawal_approve": "Retrait approuvé",
    "activity.withdrawal_cancel": "Retrait annulé",
    "activity.withdrawal_prevalidate": "Retrait prévalidé",
    "activity.withdrawal_return_supervisor": "Retrait retourné par le superviseur",
    "activity.withdrawal_return_validator": "Retrait retourné par le validateur",
    "activity.withdrawal_submit": "Retrait soumis",
    "bootstrap": "Compte Admin initial créé",
    "disbursement.approved": "Décaissement autorisé",
    "disbursement.cancel": "Demande de décaissement annulée",
    "disbursement.prevalidated": "Décaissement prévalidé",
    "disbursement.returned": "Décaissement retourné",
    "disbursement.submit": "Demande de décaissement soumise",
    "document.download": "Document téléchargé",
    "document.preview": "Document consulté",
    "document.upload": "Document ajouté",
    "invitation_accept": "Invitation acceptée",
    "invitation_delivery": "Invitation envoyée",
    "invitation_inspect": "Invitation consultée",
    "invitation_create": "Invitation créée",
    "invitation_reissue": "Invitation renouvelée",
    "invitation_revoke": "Invitation révoquée",
    "login": "Connexion demandée",
    "logout": "Déconnexion",
    "operation.execution_corrected": "Réalisation corrigée",
    "operation.execution_recorded": "Réalisation enregistrée",
    "operation.execution_started": "Réalisation commencée",
    "operation_type.create": "Type d’opération créé",
    "otp_delivery": "Code de vérification envoyé",
    "otp_prepare": "Code de vérification préparé",
    "otp_resend": "Code de vérification renvoyé",
    "otp_verify": "Code de vérification contrôlé",
    "ownership_context.provisioned": "Contexte MJL vérifié",
    "partner.create": "Partenaire créé",
    "project.close": "Projet clôturé",
    "project.create": "Projet créé",
    "recovery_complete": "Mot de passe réinitialisé",
    "recovery_delivery": "Lien de récupération envoyé",
    "recovery_notification": "Notification de réinitialisation envoyée",
    "recovery_prepare": "Récupération de compte préparée",
    "reminder.created": "Relance administrative créée",
    "reminder.email_delivery": "Courriel de relance traité",
    "reminder.read": "Relance marquée comme lue",
    "reversement.corrected": "Déclaration de reversement corrigée",
    "reversement.declared": "Reversement déclaré",
    "virement.approved": "Virement autorisé",
    "virement.cancel": "Demande de virement annulée",
    "virement.prevalidated": "Virement prévalidé",
    "virement.returned": "Virement retourné",
    "virement.submit": "Demande de virement soumise",
    "virement_confirmation.corrected": "Confirmation de virement corrigée",
    "virement_confirmation.declared": "Virement externe confirmé",
    "zero_spending.approved": "Dépense nulle validée",
    "zero_spending.prevalidated": "Dépense nulle prévalidée",
    "zero_spending.returned": "Déclaration sans dépense retournée",
    "zero_spending.submit": "Déclaration sans dépense soumise",
}


def args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


def activity_identifier(row: Audit) -> str | None:
    for facts in (row.business, row.details):
        value = facts.get("activity_id") if isinstance(facts, dict) else None
        if isinstance(value, str) and len(value) == 36:
            return value
    if row.action.startswith("activity.") and row.target and len(row.target) == 36:
        return row.target
    return None


def projected_rows(db: Session, rows: list[Audit]) -> list[dict[str, Any]]:
    actor_ids = {row.actor for row in rows if len(row.actor) == 36}
    users = {
        user.id: user for user in db.scalars(select(User).where(User.id.in_(actor_ids)))
    }
    activity_ids = {
        activity_id
        for row in rows
        if (activity_id := activity_identifier(row)) is not None
    }
    activities = {
        item.id: item
        for item in db.scalars(select(Activity).where(Activity.id.in_(activity_ids)))
    }
    data = []
    for row in rows:
        user = users.get(row.actor)
        activity = activities.get(activity_identifier(row) or "")
        data.append(
            {
                "id": row.id,
                "occurred_at": row.occurred_at.isoformat(),
                "action": row.action,
                "label": ACTION_LABELS.get(row.action, "Événement enregistré"),
                "outcome": row.outcome,
                "actor": ({"id": user.id, "email": user.email} if user else None),
                "activity": (
                    {
                        "id": activity.id,
                        "reference": activity.reference,
                        "name": activity.name,
                    }
                    if activity
                    else None
                ),
            }
        )
    return data


def csv_cell(value: object) -> str:
    result = "" if value is None else str(value)
    if result.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + result
    return result


def export_csv(
    rows: list[dict[str, Any]],
    export_id: str,
    snapshot_at: str,
    generated_at: str,
    actor_email: str,
) -> bytes:
    output = StringIO(newline="")
    writer = csv.writer(output, delimiter=";", lineterminator="\r\n")
    metadata = (
        ("Identifiant export", export_id),
        ("Généré par", actor_email),
        ("Date de génération UTC", generated_at),
        ("Données capturées UTC", snapshot_at),
        ("Périmètre", "Historique global MJL autorisé"),
    )
    writer.writerows((csv_cell(key), csv_cell(value)) for key, value in metadata)
    writer.writerow(())
    writer.writerow(
        (
            "Identifiant événement",
            "Date et heure UTC",
            "Action",
            "Résultat",
            "Identifiant acteur",
            "Courriel acteur",
            "Référence activité",
            "Nom activité",
        )
    )
    for row in rows:
        actor = row["actor"] or {}
        activity = row["activity"] or {}
        writer.writerow(
            tuple(
                csv_cell(value)
                for value in (
                    row["id"],
                    row["occurred_at"],
                    row["label"],
                    row["outcome"],
                    actor.get("id"),
                    actor.get("email"),
                    activity.get("reference"),
                    activity.get("name"),
                )
            )
        )
    return ("\ufeff" + output.getvalue()).encode("utf-8")


@router.get("/audit-events", response_model=AuditList)
def audit_events(
    request: Request,
    auth: Auth,
    pagination: Annotated[tuple[int, str | None], Depends(args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        principal(
            db,
            auth,
            evidence(request, auth)[0],
            roles={"VALIDATEUR_DEFINITIF", "ADMIN_PLATEFORME"},
        )
        limit, token = pagination
        cursor = Cursor(auth, "audit-events", CONTEXT, limit)
        marker, direction = cursor.decode(token)
        conditions: list[Any] = []
        if marker:
            try:
                marker_id = int(marker)
            except ValueError:
                raise AuthError(422, "cursor_invalid") from None
            if marker_id <= 0:
                raise AuthError(422, "cursor_invalid")
            conditions.append(
                Audit.id < marker_id if direction == "next" else Audit.id > marker_id
            )
        order = Audit.id.desc() if direction == "next" else Audit.id.asc()
        rows, total = page_rows(db, Audit, (), tuple(conditions), (order,), limit)
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: Audit, move: str) -> str:
            query = urlencode(
                {"limit": limit, "cursor": cursor.encode(str(row.id), move)}
            )
            return f"{auth.policy.origin}/api/v1/audit-events?{query}"

        return {
            "object": "list",
            "count": total,
            "data": projected_rows(db, rows),
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }


@router.post(
    "/reports/audit/exports",
    response_class=Response,
    responses={
        200: {
            "description": "Export CSV audité de l’historique global.",
            "content": {"text/csv": {"schema": {"type": "string", "format": "binary"}}},
        }
    },
)
def audit_export(body: ExportInput, request: Request, auth: Auth) -> Response:
    with Session(auth.engine) as db, db.begin():
        db.execute(text("SELECT pg_advisory_xact_lock_shared(1843201)"))
        secret, csrf = evidence(request, auth)
        actor = principal(
            db,
            auth,
            secret,
            csrf,
            roles={"VALIDATEUR_DEFINITIF", "ADMIN_PLATEFORME"},
            mutation=True,
        )
        raw_snapshot, raw_event_ids = db.execute(
            text(
                """
                /* audit_export_snapshot */
                SELECT statement_timestamp(),
                       COALESCE(
                         array_agg(selected.id ORDER BY selected.id),
                         ARRAY[]::bigint[]
                       )
                FROM (
                  SELECT id FROM auth_audit ORDER BY id LIMIT 10001
                ) AS selected
                """
            )
        ).one()
        snapshot = cast(datetime, raw_snapshot)
        event_ids = cast(list[int], raw_event_ids)
        # The IDs and advertised time come from one statement. Audit rows are
        # append-only; the shared lifecycle lock keeps their User/Activity
        # projections stable while they are materialized below.
        rows = (
            list(
                db.scalars(
                    select(Audit).where(Audit.id.in_(event_ids)).order_by(Audit.id)
                )
            )
            if event_ids
            else []
        )
        if len(rows) > 10_000:
            raise AuthError(422, "selection_too_large")
        snapshot_at = snapshot.isoformat()
        export_id = str(uuid4())
        generated_at = auth.now(db).isoformat()
        artifact = export_csv(
            projected_rows(db, rows),
            export_id,
            snapshot_at,
            generated_at,
            actor.email,
        )
        digest = hashlib.sha256(artifact).hexdigest()
        auth.audit(
            db,
            "audit.export",
            actor.id,
            export_id,
            details={
                "format": body.format,
                "row_count": len(rows),
                "byte_size": len(artifact),
                "sha256": digest,
                "as_of": snapshot_at,
            },
        )
        filename = f"historique-audit-{export_id}.csv"
        return Response(
            artifact,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(artifact)),
            },
        )
