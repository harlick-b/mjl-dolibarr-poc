from typing import Annotated, Any, Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
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


ACTION_LABELS = {
    "abuse_limit": "Limite de sécurité atteinte",
    "access_denied": "Accès refusé",
    "account_deactivate": "Compte désactivé",
    "account_role_change": "Rôle du compte modifié",
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

        actor_ids = {row.actor for row in rows if len(row.actor) == 36}
        users = {
            user.id: user
            for user in db.scalars(select(User).where(User.id.in_(actor_ids)))
        }
        activity_ids = {
            activity_id
            for row in rows
            if (activity_id := activity_identifier(row)) is not None
        }
        activities = {
            item.id: item
            for item in db.scalars(
                select(Activity).where(Activity.id.in_(activity_ids))
            )
        }

        def link(row: Audit, move: str) -> str:
            query = urlencode(
                {"limit": limit, "cursor": cursor.encode(str(row.id), move)}
            )
            return f"{auth.policy.origin}/api/v1/audit-events?{query}"

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
