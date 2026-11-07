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
from sqlalchemy import func, select, text, tuple_
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.audit.filters import filter_scope, history_conditions, history_filters
from app.auth.dto import ErrorResponse
from app.auth.models import Audit, User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.models import (
    Activity,
    ActivityRevision,
    OperationType,
    Partner,
    Project,
)
from app.planning.service import BUSINESS_ROLES, CONTEXT, Cursor, page_rows, principal

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
    full_name: str | None


class ChangeOutput(Output):
    field: str
    before: str | None
    after: str | None


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
    changes: list[ChangeOutput]
    subject: str | None
    reason: str | None
    milestone: bool
    amendment_id: str | None
    revision_id: str | None
    facts: list[ChangeOutput]


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
    "pta.export": "PTA exporté",
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
    "funding.submit": "Complément de financement demandé",
    "funding.prevalidated": "Complément de financement prévalidé",
    "funding.approved": "Complément de financement approuvé",
    "funding.returned": "Complément de financement retourné",
    "funding.cancel": "Demande de complément annulée",
    "disbursement.approved": "Décaissement autorisé",
    "disbursement.cancel": "Demande de décaissement annulée",
    "disbursement.prevalidated": "Décaissement prévalidé",
    "disbursement.returned": "Décaissement retourné",
    "disbursement.submit": "Demande de décaissement soumise",
    "document.download": "Document téléchargé",
    "document.preview": "Document consulté",
    "document.upload": "Document ajouté",
    "document.share": "Document partagé avec le Partenaire",
    "document.unshare": "Partage du document arrêté",
    "document.withdraw": "Document retiré",
    "invitation_accept": "Invitation acceptée",
    "invitation_delivery": "Invitation envoyée",
    "invitation_inspect": "Invitation consultée",
    "invitation_create": "Invitation créée",
    "profile_update": "Profil mis à jour",
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
    "partner.update": "Partenaire modifié",
    "project.update": "Projet modifié",
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


BUSINESS_ACTIONS = tuple(
    action
    for action in ACTION_LABELS
    if action.startswith(
        (
            "activity.",
            "operation.",
            "operation_type.",
            "partner.",
            "project.",
            "funding.",
            "disbursement.",
            "virement.",
            "virement_confirmation.",
            "reversement.",
            "zero_spending.",
        )
    )
    and action != "activity.fiche_generated"
) + (
    "bootstrap",
    "account_deactivate",
    "account_role_change",
    "invitation_create",
    "invitation_reissue",
    "invitation_revoke",
    "invitation_accept",
    "profile_update",
    "document.upload",
    "document.share",
    "document.unshare",
    "document.withdraw",
)


def visible_actions(role: str) -> tuple[str, ...]:
    if role == "ADMIN_PLATEFORME":
        return BUSINESS_ACTIONS
    return tuple(
        action
        for action in BUSINESS_ACTIONS
        if action.startswith(
            (
                "activity.",
                "operation.",
                "funding.",
                "disbursement.",
                "virement.",
                "virement_confirmation.",
                "reversement.",
                "zero_spending.",
            )
        )
    )


# Explicit public field projection: never return raw audit details or proof data.
CHANGE_FIELDS = {
    "user_state": "État du compte",
    "name": "Nom",
    "description": "Description",
    "label": "Libellé",
    "type_id": "Catégorie",
    "position": "Ordre",
    "placement_year": "Année du PTA",
    "full_name": "Nom complet",
    "first_name": "Prénoms",
    "last_name": "Nom",
    "state": "État",
    "role": "Rôle",
    "allocation": "Budget (F CFA)",
    "actual_spent": "Dépenses (F CFA)",
    "amount": "Montant (F CFA)",
    "planned_start": "Début prévu",
    "planned_end": "Fin prévue",
    "execution_completed": "Réalisation terminée",
    "execution_started_at": "Début de réalisation",
    "execution_observation": "Observation",
    "effective_date": "Date effective",
    "transfer_date": "Date du virement",
    "return_date": "Date du reversement",
    "note": "Note",
}


def public_changes(row: Audit) -> list[dict[str, str | None]]:
    facts = (
        row.business if isinstance(row.business, dict) and row.business else row.details
    )
    if not isinstance(facts, dict):
        return []
    before = facts.get("before") or {}
    after = facts.get("after") or {}
    if not isinstance(before, dict) or not isinstance(after, dict):
        return []
    before, after = dict(before), dict(after)
    before.update(before.pop("content", {}) or {})
    after.update(after.pop("content", {}) or {})
    for key, old_key, new_key in (
        ("state", "before_state", "after_state"),
        ("user_state", "before_user_state", "user_state"),
        ("role", "before_role", "role"),
        ("full_name", "before_full_name", "full_name"),
        ("first_name", "before_first_name", "first_name"),
        ("last_name", "before_last_name", "last_name"),
    ):
        if old_key in facts and new_key in facts:
            before[key], after[key] = facts[old_key], facts[new_key]
    result = []
    for key, label in CHANGE_FIELDS.items():
        old, new = before.get(key), after.get(key)
        if old != new and all(
            value is None or isinstance(value, (str, int, bool)) for value in (old, new)
        ):
            result.append(
                {
                    "field": label,
                    "before": display_value(old, key),
                    "after": display_value(new, key),
                }
            )
    for side in (before, after):
        if not isinstance(side.get("operations", []), list):
            side.pop("operations", None)
    old_ops = {
        item["id"]: item
        for item in before.get("operations", [])
        if isinstance(item, dict) and "id" in item
    }
    new_ops = {
        item["id"]: item
        for item in after.get("operations", [])
        if isinstance(item, dict) and "id" in item
    }
    for identifier in sorted(old_ops.keys() | new_ops.keys()):
        old, new = old_ops.get(identifier, {}), new_ops.get(identifier, {})
        for field in ("name", "type_id", "allocation", "position"):
            if old.get(field) != new.get(field):
                result.append(
                    {
                        "field": f"Opération {identifier} · {CHANGE_FIELDS[field]}",
                        "before": display_value(old.get(field), field),
                        "after": display_value(new.get(field), field),
                    }
                )
    if before.get("agent_ids") != after.get("agent_ids"):
        result.append(
            {
                "field": "Agents affectés",
                "before": ", ".join(before.get("agent_ids") or []),
                "after": ", ".join(after.get("agent_ids") or []),
            }
        )
    return result


def display_value(value: object, field: str) -> str | None:
    if value is None:
        return None
    if field not in {"state", "user_state", "role"} and not isinstance(value, bool):
        return str(value)
    return {
        "True": "Oui",
        "False": "Non",
        "active": "Actif",
        "inactive": "Inactif",
        "pending": "En attente",
        "submitted": "Soumis",
        "approved": "Approuvé",
        "prevalidated": "Prévalidé",
        "closed": "Clôturé",
        "draft": "Brouillon",
        "amendment_draft": "Modification en préparation",
        "returned": "Retourné",
        "returned_supervisor": "Retourné par le superviseur",
        "returned_validator": "Retourné par le validateur",
        "cancelled": "Annulé",
        "withdrawn": "Retiré",
        "AGENT_SAISIE": "Agent de saisie",
        "AGENT_VERIFICATEUR": "Superviseur",
        "VALIDATEUR_DEFINITIF": "Validateur définitif",
        "ADMIN_PLATEFORME": "Admin technique",
        "PARTENAIRE": "Partenaire",
        "delivered": "Envoyée",
        "revoked": "Révoquée",
        "prepared": "En préparation",
        "consumed": "Acceptée",
    }.get(str(value), str(value))


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


def event_reason(row: Audit) -> str | None:
    facts = row.business or row.details or {}
    for container in (
        facts,
        *(
            facts.get(key)
            for key in (
                "decision",
                "cancellation",
                "amendment",
                "revision",
                "withdrawal",
                "transfer",
            )
        ),
    ):
        if isinstance(container, dict):
            for key in ("reason", "correction_reason"):
                value = container.get(key)
                if isinstance(value, str) and value:
                    return value
    return None


def event_facts(row: Audit) -> list[dict[str, str | None]]:
    facts = row.business or {}
    labels = {
        "amount": "Montant (F CFA)",
        "approved_allocation": "Budget approuvé (F CFA)",
        "required_amount": "Reversement requis (F CFA)",
        "returned_amount": "Montant reversé (F CFA)",
    }
    return [
        {"field": label, "before": None, "after": value}
        for key, label in labels.items()
        if isinstance(value := facts.get(key), str)
    ]


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
    target_ids = {row.target for row in rows if row.target}
    subjects = {
        user.id: user.full_name or user.email
        for user in db.scalars(select(User).where(User.id.in_(target_ids)))
    }
    for model in (Project, Partner):
        subjects.update(
            {
                item.id: item.name
                for item in db.execute(
                    select(model.id, model.name).where(model.id.in_(target_ids))
                )
            }
        )
    subjects.update(
        {
            item.id: item.label
            for item in db.scalars(
                select(OperationType).where(OperationType.id.in_(target_ids))
            )
        }
    )
    # Older withdrawal events link an immutable revision that already contains
    # the reason. Read only that recorded scalar; never reconstruct it from state.
    withdrawal_revisions = {
        facts["revision"]["id"]
        for row in rows
        if row.action.startswith("activity.withdrawal_")
        and isinstance(facts := row.business, dict)
        and isinstance(facts.get("revision"), dict)
        and isinstance(facts["revision"].get("id"), str)
    }
    withdrawal_reasons: dict[str, str | None] = (
        dict(
            db.execute(
                select(
                    ActivityRevision.id,
                    ActivityRevision.snapshot["withdrawal"]["reason"].astext,
                ).where(
                    ActivityRevision.id.in_(withdrawal_revisions),
                    ActivityRevision.activity_id.in_(activity_ids),
                )
            ).all()
        )
        if withdrawal_revisions
        else {}
    )
    data = []
    for row in rows:
        user = users.get(row.actor)
        activity = activities.get(activity_identifier(row) or "")
        facts = row.business or {}
        revision = facts.get("revision")
        revision = revision if isinstance(revision, dict) else {}
        amendment = facts.get("amendment")
        amendment = amendment if isinstance(amendment, dict) else {}
        data.append(
            {
                "id": row.id,
                "occurred_at": row.occurred_at.isoformat(),
                "action": row.action,
                "label": ACTION_LABELS.get(row.action, "Événement enregistré"),
                "outcome": row.outcome,
                "actor": (
                    {"id": user.id, "email": user.email, "full_name": user.full_name}
                    if user
                    else None
                ),
                "changes": public_changes(row),
                "amendment_id": amendment.get("id"),
                "reason": event_reason(row)
                or withdrawal_reasons.get(str(revision.get("id", ""))),
                "facts": event_facts(row),
                "milestone": row.action
                not in {
                    "activity.replace",
                    "activity.assign_agents",
                    "operation.execution_corrected",
                    "virement_confirmation.corrected",
                    "reversement.corrected",
                }
                and not row.action.startswith("document."),
                "revision_id": revision.get("id"),
                "subject": activity.name
                if activity
                else subjects.get(row.target or ""),
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
            "Modifications (avant → après)",
            "Élément concerné",
            "Motif",
            "Informations",
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
                    " ; ".join(
                        f"{change['field']} : {change['before'] or '—'}"
                        f" → {change['after'] or '—'}"
                        for change in row["changes"]
                    ),
                    row["subject"],
                    row["reason"],
                    " ; ".join(
                        f"{fact['field']} : {fact['after']}" for fact in row["facts"]
                    ),
                )
            )
        )
    return ("\ufeff" + output.getvalue()).encode("utf-8")


@router.get("/audit-events", response_model=AuditList)
def audit_events(
    request: Request,
    auth: Auth,
    pagination: Annotated[tuple[int, str | None], Depends(args)],
    filters: Annotated[dict[str, str], Depends(history_filters)],
) -> dict[str, Any]:
    return history_page(request, auth, pagination, filters)


@router.get("/activities/{identifier}/history", response_model=AuditList)
def activity_history(
    identifier: str,
    request: Request,
    auth: Auth,
    pagination: Annotated[tuple[int, str | None], Depends(args)],
) -> dict[str, Any]:
    return history_page(
        request, auth, pagination, {"activity": identifier}, activity_id=identifier
    )


def history_page(
    request: Request,
    auth: Auth,
    pagination: tuple[int, str | None],
    filters: dict[str, str],
    *,
    activity_id: str | None = None,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(
            db,
            auth,
            evidence(request, auth)[0],
            roles=BUSINESS_ROLES
            if activity_id
            else {"VALIDATEUR_DEFINITIF", "ADMIN_PLATEFORME"},
            read_only=True,
        )
        if activity_id:
            from app.planning.routes import get_activity

            get_activity(db, activity_id, shared=True)
        actions = BUSINESS_ACTIONS if activity_id else visible_actions(actor.role)
        path = f"/activities/{activity_id}/history" if activity_id else "/audit-events"
        limit, token = pagination
        cursor = Cursor(
            auth, "audit-events", filter_scope(filters) + ":" + actor.role, limit
        )
        marker, direction = cursor.decode(token)
        base_conditions = history_conditions(filters, ACTION_LABELS, actions)
        conditions: list[Any] = list(base_conditions)
        if marker:
            try:
                timestamp, identifier = marker.rsplit("|", 1)
                marker_time = datetime.fromisoformat(timestamp)
                marker_id = int(identifier)
            except ValueError:
                raise AuthError(422, "cursor_invalid") from None
            if marker_id <= 0 or marker_time.tzinfo is None:
                raise AuthError(422, "cursor_invalid")
            conditions.append(
                tuple_(Audit.occurred_at, Audit.id) < (marker_time, marker_id)
                if direction == "next"
                else tuple_(Audit.occurred_at, Audit.id) > (marker_time, marker_id)
            )
        order = (
            (Audit.occurred_at.desc(), Audit.id.desc())
            if direction == "next"
            else (Audit.occurred_at.asc(), Audit.id.asc())
        )
        rows, total = page_rows(
            db,
            Audit,
            tuple(base_conditions),
            tuple(conditions),
            order,
            limit,
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: Audit, move: str) -> str:
            query = urlencode(
                {
                    **filters,
                    "limit": limit,
                    "cursor": cursor.encode(
                        f"{row.occurred_at.isoformat()}|{row.id}", move
                    ),
                }
            )
            return f"{auth.policy.origin}/api/v1{path}?{query}"

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
def audit_export(
    body: ExportInput,
    request: Request,
    auth: Auth,
    filters: Annotated[dict[str, str], Depends(history_filters)],
) -> Response:
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
        selected = (
            select(Audit.id)
            .where(
                *history_conditions(filters, ACTION_LABELS, visible_actions(actor.role))
            )
            .order_by(Audit.id)
            .limit(10001)
            .subquery()
        )
        raw_snapshot, raw_event_ids = db.execute(
            select(
                func.statement_timestamp(), func.array_agg(selected.c.id)
            ).prefix_with("/* audit_export_snapshot */")
        ).one()
        snapshot = cast(datetime, raw_snapshot)
        event_ids = cast(list[int], raw_event_ids or [])
        # The IDs and advertised time come from one statement. Audit rows are
        # append-only; the shared lifecycle lock keeps their User/Activity
        # projections stable while they are materialized below.
        rows = (
            list(
                db.scalars(
                    select(Audit)
                    .where(Audit.id.in_(event_ids))
                    .order_by(Audit.occurred_at.desc(), Audit.id.desc())
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


class FilterOption(Output):
    id: str
    label: str


class FilterOptions(Output):
    object: Literal["list"]
    count: int
    data: list[FilterOption]
    next: str | None
    previous: str | None


@router.get("/audit-events/filter-options", response_model=FilterOptions)
def audit_filter_options(
    request: Request,
    auth: Auth,
    pagination: Annotated[tuple[int, str | None], Depends(args)],
    kind: Literal["actor", "activity", "project", "action"],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(
            db,
            auth,
            evidence(request, auth)[0],
            roles={"ADMIN_PLATEFORME", "VALIDATEUR_DEFINITIF"},
            read_only=True,
        )
        limit, token = pagination
        cursor = Cursor(
            auth, "audit-filter-options", CONTEXT + ":" + kind + ":" + actor.role, limit
        )
        marker, direction = cursor.decode(token)
        actions = visible_actions(actor.role)
        if kind == "action":
            # The business action vocabulary is fixed and bounded, never event payloads.
            options = [{"id": key, "label": ACTION_LABELS[key]} for key in actions]
            options.sort(key=lambda row: row["id"])
            if marker:
                options = [
                    row
                    for row in options
                    if (
                        row["id"] > marker
                        if direction == "next"
                        else row["id"] < marker
                    )
                ]
            if direction == "previous":
                options.reverse()
            total = len(actions)
        else:
            from app.audit.filters import activity_match

            model: Any = {"actor": User, "activity": Activity, "project": Project}[kind]
            exists: ColumnElement[bool]
            if kind == "actor":
                exists = (
                    select(Audit.id)
                    .where(Audit.action.in_(actions), Audit.actor == model.id)
                    .exists()
                )
            elif kind == "activity":
                exists = (
                    select(Audit.id)
                    .where(Audit.action.in_(actions), activity_match())
                    .exists()
                )
            else:
                exists = (
                    select(Audit.id)
                    .where(Audit.action.in_(actions), Audit.target == model.id)
                    .exists()
                )
                activity_exists = (
                    select(Activity.id)
                    .where(
                        Activity.request_project_id == model.id,
                        select(Audit.id)
                        .where(Audit.action.in_(actions), activity_match())
                        .exists(),
                    )
                    .exists()
                )
                exists = exists | activity_exists
            conditions = [exists]
            if kind != "actor":
                conditions.append(model.context_id == CONTEXT)
            filtered = list(conditions)
            if marker:
                filtered.append(
                    model.id > marker if direction == "next" else model.id < marker
                )
            rows, total = page_rows(
                db,
                model,
                tuple(conditions),
                tuple(filtered),
                (model.id.asc() if direction == "next" else model.id.desc(),),
                limit,
            )
            options = [
                {
                    "id": row.id,
                    "label": (row.full_name or row.email)
                    if kind == "actor"
                    else row.name,
                }
                for row in rows
            ]
        more = len(options) > limit
        options = options[:limit]
        if direction == "previous":
            options.reverse()

        def link(row: dict[str, str], move: str) -> str:
            return (
                f"{auth.policy.origin}/api/v1/audit-events/filter-options?"
                + urlencode(
                    {
                        "kind": kind,
                        "limit": limit,
                        "cursor": cursor.encode(row["id"], move),
                    }
                )
            )

        return {
            "object": "list",
            "count": total,
            "data": options,
            "next": link(options[-1], "next")
            if options and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(options[0], "previous")
            if options
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }
