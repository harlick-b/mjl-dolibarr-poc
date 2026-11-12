from __future__ import annotations

from datetime import date, datetime
from html import escape
from typing import Any, cast

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import APIKeyCookie
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, load_only

from app.auth.dto import ErrorResponse
from app.auth.models import Audit, User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.core.models import (
    Activity,
    ActivityAssignment,
    ActivityDocument,
    ActivityDocumentWithdrawal,
    ActivityRevision,
    ActivityRevisionDecision,
    AnnualPTA,
    DisbursementDecision,
    DisbursementRequest,
    FundingDecision,
    FundingRequest,
    Operation,
    OperationType,
    Partner,
    Project,
    ReversementDeclaration,
    VirementConfirmation,
    VirementDecision,
    VirementRequest,
    ZeroSpendingDecision,
    ZeroSpendingDeclaration,
)
from app.planning.core.service import principal
from app.planning.reports.activity_fiche_pdf import render_activity_fiche
from app.planning.routes import get_activity, locked_read

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA Activity Fiche"],
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
        status: {"model": ErrorResponse} for status in (401, 403, 404, 409, 429, 503)
    },
)


ROLE_LABELS = {
    "AGENT_SAISIE": "Agent de saisie",
    "AGENT_VERIFICATEUR": "Agent superviseur et prévalidateur",
    "VALIDATEUR_DEFINITIF": "Validateur définitif",
}
STATE_LABELS = {
    "draft": "Brouillon",
    "amendment_draft": "Modification en préparation",
    "submitted": "Soumise pour prévalidation",
    "prevalidated": "Validation définitive attendue",
    "returned_supervisor": "Retournée par le superviseur",
    "returned_validator": "Retournée par le validateur",
    "returned": "Retournée",
    "approved": "Approuvée",
    "withdrawn": "Retirée",
    "closed": "Clôturée",
    "cancelled": "Annulée",
}
OUTCOME_LABELS = {
    "prevalidated": "Prévalidé",
    "approved": "Approuvé",
    "returned": "Retourné",
}
EXECUTION_ACTION_LABELS = {
    "operation.execution_started": "Exécution commencée",
    "operation.execution_recorded": "Réalisation enregistrée",
    "operation.execution_corrected": "Réalisation corrigée",
}
ACTIVITY_ACTION_LABELS = {
    "activity.create": "Activité créée",
    "activity.replace": "Brouillon modifié",
    "activity.assign_agents": "Agents assignés",
    "activity.submit": "Activité soumise pour examen",
    "activity.prevalidate": "Activité transmise pour approbation",
    "activity.return_supervisor": "Correction demandée par le Superviseur",
    "activity.approve": "Activité approuvée",
    "activity.return_validator": "Correction demandée par le Validateur",
    "activity.amendment_open": "Ouverture de modification",
    "activity.amendment_cancel": "Annulation de modification",
    "activity.withdrawal_submit": "Demande de retrait soumise",
    "activity.withdrawal_prevalidate": "Retrait prévalidé",
    "activity.withdrawal_return_supervisor": "Retrait retourné par le superviseur",
    "activity.withdrawal_approve": "Retrait approuvé",
    "activity.withdrawal_return_validator": "Retrait retourné par le validateur",
    "activity.withdrawal_cancel": "Annulation du retrait",
    "activity.transfer_submit": "Demande de transfert soumise",
    "activity.transfer_prevalidate": "Transfert prévalidé",
    "activity.transfer_return_supervisor": "Transfert retourné par le superviseur",
    "activity.transfer_approve": "Transfert approuvé",
    "activity.transfer_return_validator": "Transfert retourné par le validateur",
    "activity.transfer_cancel": "Annulation du transfert",
    "activity.closed": "Activité clôturée",
}
AUDIT_ACTION_LABELS = {
    **ACTIVITY_ACTION_LABELS,
    **EXECUTION_ACTION_LABELS,
    "zero_spending.submit": "Déclaration sans dépense soumise",
    "zero_spending.prevalidated": "Dépense nulle prévalidée",
    "zero_spending.returned": "Déclaration sans dépense retournée",
    "zero_spending.approved": "Dépense nulle validée",
    "funding.submit": "Demande de financement complémentaire soumise",
    "funding.prevalidated": "Financement complémentaire prévalidé",
    "funding.returned": "Financement complémentaire retourné",
    "funding.approved": "Financement complémentaire autorisé",
    "funding.cancel": "Demande de financement complémentaire annulée",
    "disbursement.submit": "Demande de décaissement soumise",
    "disbursement.prevalidated": "Décaissement prévalidé",
    "disbursement.returned": "Décaissement retourné",
    "disbursement.approved": "Décaissement autorisé",
    "disbursement.cancel": "Demande de décaissement annulée",
    "virement.submit": "Demande de virement soumise",
    "virement.prevalidated": "Virement prévalidé",
    "virement.returned": "Virement retourné",
    "virement.approved": "Virement autorisé",
    "virement.cancel": "Demande de virement annulée",
    "virement_confirmation.declared": "Virement externe confirmé",
    "virement_confirmation.corrected": "Confirmation de virement corrigée",
    "reversement.declared": "Reversement déclaré",
    "reversement.corrected": "Déclaration de reversement corrigée",
}


def text(value: object | None) -> str:
    if value is None or value == "":
        return "—"
    return escape(str(value)).replace("\n", "<br/>")


def day(value: date | datetime | object | None) -> str:
    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y à %H:%M")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10]).strftime("%d/%m/%Y")
        except ValueError:
            pass
    return text(value)


def xof(value: object | None) -> str:
    if value is None:
        return "—"
    try:
        amount = int(str(value))
    except ValueError:
        return text(value)
    return f"{amount:,}".replace(",", " ") + " F CFA"


def rows(db: Session, model: type[Any], activity_id: str, order: Any) -> list[Any]:
    return list(
        db.scalars(
            select(model).where(model.activity_id == activity_id).order_by(order)
        )
    )


def projection(
    db: Session, activity: Activity, generated_at: datetime
) -> dict[str, Any]:
    revision = db.get(ActivityRevision, activity.approved_revision_id)
    if not revision or revision.activity_id != activity.id:
        raise AuthError(409, "fiche_unavailable")
    pta = db.get(AnnualPTA, activity.pta_id)
    project = db.get(Project, pta.project_id) if pta else None
    partner = db.get(Partner, project.partner_id) if project else None
    if not pta or not project or not partner:
        raise AuthError(409, "fiche_unavailable")

    revisions = rows(
        db, ActivityRevision, activity.id, ActivityRevision.revision_number
    )
    decisions = rows(
        db, ActivityRevisionDecision, activity.id, ActivityRevisionDecision.decided_at
    )
    operations = rows(db, Operation, activity.id, Operation.position)
    operation_type_ids = {item.type_id for item in operations}
    snapshot_operations = revision.snapshot.get("operations", [])
    if isinstance(snapshot_operations, list):
        operation_type_ids.update(
            str(item["type_id"])
            for item in snapshot_operations
            if isinstance(item, dict) and item.get("type_id")
        )
    operation_types = {
        item.id: item.label
        for item in db.scalars(
            select(OperationType).where(OperationType.id.in_(operation_type_ids))
        )
    }
    disbursements = rows(
        db, DisbursementRequest, activity.id, DisbursementRequest.submitted_at
    )
    disbursement_ids = {item.id for item in disbursements}
    disbursement_decisions = list(
        db.scalars(
            select(DisbursementDecision)
            .where(DisbursementDecision.request_id.in_(disbursement_ids))
            .order_by(DisbursementDecision.decided_at)
        )
    )
    funding_requests = rows(
        db, FundingRequest, activity.id, FundingRequest.submitted_at
    )
    funding_ids = {item.id for item in funding_requests}
    funding_decisions = list(
        db.scalars(
            select(FundingDecision)
            .where(FundingDecision.request_id.in_(funding_ids))
            .order_by(FundingDecision.decided_at)
        )
    )
    virements = rows(db, VirementRequest, activity.id, VirementRequest.submitted_at)
    virement_ids = {item.id for item in virements}
    virement_decisions = list(
        db.scalars(
            select(VirementDecision)
            .where(VirementDecision.request_id.in_(virement_ids))
            .order_by(VirementDecision.decided_at)
        )
    )
    confirmations = rows(
        db, VirementConfirmation, activity.id, VirementConfirmation.recorded_at
    )
    reversements = rows(
        db, ReversementDeclaration, activity.id, ReversementDeclaration.recorded_at
    )
    zero_declarations = rows(
        db,
        ZeroSpendingDeclaration,
        activity.id,
        ZeroSpendingDeclaration.submitted_at,
    )
    zero_ids = {item.id for item in zero_declarations}
    zero_decisions = list(
        db.scalars(
            select(ZeroSpendingDecision)
            .where(ZeroSpendingDecision.declaration_id.in_(zero_ids))
            .order_by(ZeroSpendingDecision.decided_at)
        )
    )
    documents = list(
        db.scalars(
            select(ActivityDocument)
            .options(
                load_only(
                    ActivityDocument.id,
                    ActivityDocument.display_name,
                    ActivityDocument.media_type,
                    ActivityDocument.uploaded_by_id,
                    ActivityDocument.uploaded_at,
                    raiseload=True,
                )
            )
            .where(ActivityDocument.activity_id == activity.id)
            .order_by(ActivityDocument.uploaded_at)
        )
    )
    if activity.state == "closed" and activity.closed_at is not None:
        assignment_condition = ActivityAssignment.ended_at == activity.closed_at
    elif activity.state == "withdrawn":
        last_assignment_end = (
            select(func.max(ActivityAssignment.ended_at))
            .where(ActivityAssignment.activity_id == activity.id)
            .scalar_subquery()
        )
        assignment_condition = ActivityAssignment.ended_at == last_assignment_end
    else:
        assignment_condition = ActivityAssignment.ended_at.is_(None)
    assignments = list(
        db.scalars(
            select(ActivityAssignment)
            .where(
                ActivityAssignment.activity_id == activity.id,
                assignment_condition,
            )
            .order_by(ActivityAssignment.assigned_at, ActivityAssignment.id)
        )
    )
    document_ids = {item.id for item in documents}
    withdrawals = {
        item.document_id: item
        for item in db.scalars(
            select(ActivityDocumentWithdrawal).where(
                ActivityDocumentWithdrawal.document_id.in_(document_ids)
            )
        )
    }
    activity_linked_actions = {
        "operation.execution_started",
        "operation.execution_recorded",
        "operation.execution_corrected",
        "zero_spending.submit",
        "activity.amendment_open",
        "activity.amendment_cancel",
        *(
            action
            for action in ACTIVITY_ACTION_LABELS
            if action.startswith("activity.withdrawal_")
        ),
        *(
            action
            for action in ACTIVITY_ACTION_LABELS
            if action.startswith("activity.transfer_")
        ),
        "zero_spending.prevalidated",
        "zero_spending.returned",
        "zero_spending.approved",
        *(
            action
            for action in AUDIT_ACTION_LABELS
            if action.startswith(
                (
                    "funding.",
                    "disbursement.",
                    "virement.",
                    "virement_confirmation.",
                    "reversement.",
                )
            )
        ),
    }
    audits = list(
        db.scalars(
            select(Audit)
            .where(
                or_(
                    Audit.target == activity.id,
                    and_(
                        Audit.action.in_(activity_linked_actions),
                        Audit.business["activity_id"].as_string() == activity.id,
                    ),
                ),
                Audit.action != "activity.fiche_generated",
            )
            .order_by(Audit.occurred_at)
        )
    )
    actor_ids = {
        value
        for value in [
            activity.creator_id,
            activity.closed_by_id,
            *(item.submitter_id for item in revisions),
            *(item.actor_id for item in decisions),
            *(item.submitter_id for item in funding_requests),
            *(item.cancelled_by_id for item in funding_requests),
            *(item.actor_id for item in funding_decisions),
            *(item.submitter_id for item in disbursements),
            *(item.cancelled_by_id for item in disbursements),
            *(item.actor_id for item in disbursement_decisions),
            *(item.submitter_id for item in virements),
            *(item.cancelled_by_id for item in virements),
            *(item.actor_id for item in virement_decisions),
            *(item.actor_id for item in confirmations),
            *(item.actor_id for item in reversements),
            *(item.submitter_id for item in zero_declarations),
            *(item.actor_id for item in zero_decisions),
            *(item.uploaded_by_id for item in documents),
            *(item.agent_id for item in assignments),
            *(item.withdrawn_by_id for item in withdrawals.values()),
            *(item.actor for item in audits),
        ]
        if value
    }
    actor_rows = list(db.scalars(select(User).where(User.id.in_(actor_ids))))
    actors = {item.id: item.full_name or item.email for item in actor_rows}

    return {
        "activity": activity,
        "revision": revision,
        "snapshot": revision.snapshot,
        "pta": pta,
        "project": project,
        "partner": partner,
        "revisions": revisions,
        "decisions": decisions,
        "operations": {item.id: item for item in operations},
        "operation_types": operation_types,
        "funding_requests": funding_requests,
        "funding_decisions": funding_decisions,
        "disbursements": disbursements,
        "disbursement_decisions": disbursement_decisions,
        "virements": virements,
        "virement_decisions": virement_decisions,
        "confirmations": confirmations,
        "reversements": reversements,
        "zero_declarations": zero_declarations,
        "zero_decisions": zero_decisions,
        "documents": documents,
        "assignments": assignments,
        "document_withdrawals": withdrawals,
        "audits": audits,
        "actors": actors,
        "generated_at": generated_at,
    }


def _template_projection(data: dict[str, Any]) -> dict[str, Any]:
    activity: Activity = data["activity"]
    snapshot: dict[str, Any] = data["snapshot"]
    actors: dict[str, str] = data["actors"]
    approved_rows = [
        row for row in snapshot.get("operations", []) if isinstance(row, dict)
    ]
    current: dict[str, Operation] = data["operations"]
    operation_rows = [current.get(str(row.get("id"))) for row in approved_rows]
    spending_known = bool(operation_rows) and all(
        row is not None and row.actual_spent is not None for row in operation_rows
    )
    spent = (
        sum(row.actual_spent or 0 for row in operation_rows if row)
        if spending_known
        else None
    )
    authorized = int(str(snapshot.get("allocation", "0")))
    approved_zero = any(row.state == "approved" for row in data["zero_declarations"])
    approved_disbursement = any(
        row.state == "approved" for row in data["disbursements"]
    )
    all_completed = bool(operation_rows) and all(
        row is not None and row.execution_completed for row in operation_rows
    )
    any_started = any(
        row is not None and row.execution_started_at for row in operation_rows
    )
    first_approved_id = next(
        (
            row.revision_id
            for row in data["decisions"]
            if row.stage == "validator" and row.outcome == "approved"
        ),
        data["revision"].id,
    )
    first_approved = next(
        (row for row in data["revisions"] if row.id == first_approved_id),
        data["revision"],
    )
    first_approved_number = first_approved.revision_number
    state_labels = {
        "approved": "Autorisée",
        "submitted": "À examiner",
        "prevalidated": "Décision attendue",
        "returned": "À corriger",
        "cancelled": "Annulée",
    }
    requests: list[dict[str, Any]] = []
    for row in data["funding_requests"]:
        requests.append(
            {
                "date": row.submitted_at,
                "label": f"Financement complémentaire de {xof(row.amount)}",
                "state": state_labels.get(row.state, row.state),
            }
        )
    for row in data["disbursements"]:
        requests.append(
            {
                "date": row.submitted_at,
                "label": f"Décaissement de {xof(row.amount)}",
                "state": state_labels.get(row.state, row.state),
            }
        )
    source_amounts = {row.id: row.amount for row in data["disbursements"]}
    for row in data["virements"]:
        requests.append(
            {
                "date": row.submitted_at,
                "label": (
                    "Virement de "
                    f"{xof(source_amounts.get(row.disbursement_request_id))}"
                ),
                "state": state_labels.get(row.state, row.state),
            }
        )
    requests.sort(key=lambda row: row["date"])

    events: list[dict[str, Any]] = []
    decisions_by_revision: dict[str, list[ActivityRevisionDecision]] = {}
    revisions_by_id = {row.id: row for row in data["revisions"]}
    for decision in data["decisions"]:
        decisions_by_revision.setdefault(decision.revision_id, []).append(decision)
    for revision in data["revisions"]:
        initial_cycle = revision.revision_number <= first_approved_number
        events.append(
            {
                "date": revision.submitted_at,
                "title": (
                    "Programmation soumise"
                    if revision.revision_number == 1
                    else "Programmation corrigée et soumise"
                    if initial_cycle
                    else "Révision de programmation soumise"
                ),
                "detail": actors.get(revision.submitter_id, "Utilisateur indisponible"),
            }
        )
        for decision in decisions_by_revision.get(revision.id, []):
            if decision.outcome == "returned":
                title = "Révision retournée pour correction"
            elif decision.stage == "supervisor":
                title = (
                    "Prévalidation accordée" if initial_cycle else "Révision prévalidée"
                )
            else:
                title = (
                    "Programmation approuvée" if initial_cycle else "Révision approuvée"
                )
            detail = (
                f"{actors.get(decision.actor_id, 'Utilisateur indisponible')} · "
                f"{ROLE_LABELS.get(decision.actor_role, decision.actor_role)}"
            )
            decided_revision = revisions_by_id[decision.revision_id]
            detail += (
                f" · Révision {decided_revision.revision_number}"
                " · Montant autorisé : "
                f"{xof(decided_revision.snapshot.get('allocation'))}"
            )
            if decision.reason:
                detail += f" · Motif : {decision.reason}"
            if decision.requested_amount is not None:
                detail += f" · Montant demandé : {xof(decision.requested_amount)}"
            events.append(
                {"date": decision.decided_at, "title": title, "detail": detail}
            )
    disbursement_amounts = {row.id: row.amount for row in data["disbursements"]}
    financial_decision_groups = (
        (
            "Financement complémentaire",
            data["funding_decisions"],
            {row.id: row.amount for row in data["funding_requests"]},
            "request_id",
        ),
        (
            "Décaissement",
            data["disbursement_decisions"],
            disbursement_amounts,
            "request_id",
        ),
        (
            "Virement",
            data["virement_decisions"],
            {
                row.id: disbursement_amounts.get(row.disbursement_request_id)
                for row in data["virements"]
            },
            "request_id",
        ),
        (
            "Dépense nulle",
            data["zero_decisions"],
            {row.id: 0 for row in data["zero_declarations"]},
            "declaration_id",
        ),
    )
    outcome_titles = {
        "prevalidated": "Prévalidé",
        "approved": "Approuvé",
        "returned": "Retourné",
    }
    for category, decisions, amounts, source_attribute in financial_decision_groups:
        for decision in decisions:
            detail = (
                f"{actors.get(decision.actor_id, 'Utilisateur indisponible')} · "
                f"{ROLE_LABELS.get(decision.actor_role, decision.actor_role)}"
            )
            if decision.reason:
                detail += f" · Motif : {decision.reason}"
            source_id = getattr(decision, source_attribute)
            detail += f" · Montant : {xof(amounts.get(source_id))}"
            events.append(
                {
                    "date": decision.decided_at,
                    "title": (
                        f"{category} "
                        f"{outcome_titles.get(decision.outcome, decision.outcome)}"
                    ),
                    "detail": detail,
                }
            )
    audit_actions = {
        *EXECUTION_ACTION_LABELS,
        "funding.submit",
        "funding.cancel",
        "disbursement.submit",
        "disbursement.cancel",
        "virement.submit",
        "virement.cancel",
        "zero_spending.submit",
        "virement_confirmation.declared",
        "virement_confirmation.corrected",
        "reversement.declared",
        "reversement.corrected",
        "activity.amendment_open",
        "activity.amendment_cancel",
        *(
            action
            for action in ACTIVITY_ACTION_LABELS
            if action.startswith("activity.withdrawal_")
        ),
        *(
            action
            for action in ACTIVITY_ACTION_LABELS
            if action.startswith("activity.transfer_")
        ),
    }
    for audit in data["audits"]:
        if audit.action not in audit_actions:
            continue
        facts = audit.business if isinstance(audit.business, dict) else {}
        detail = actors.get(audit.actor, "Utilisateur indisponible")
        raw_before = facts.get("before")
        raw_after = facts.get("after")
        before: dict[str, Any] = (
            cast(dict[str, Any], raw_before) if isinstance(raw_before, dict) else {}
        )
        after: dict[str, Any] = (
            cast(dict[str, Any], raw_after) if isinstance(raw_after, dict) else {}
        )
        if audit.action.startswith("operation.execution_"):
            operation = current.get(str(facts.get("operation_id")))
            operation_name = operation.name if operation else "indisponible"
            detail += f" · Opération : {operation_name}"
            if before.get("actual_spent") != after.get("actual_spent"):
                detail += (
                    f" · Dépense finale : {xof(before.get('actual_spent'))}"
                    f" → {xof(after.get('actual_spent'))}"
                    if before.get("actual_spent") is not None
                    else f" · Dépense finale : {xof(after.get('actual_spent'))}"
                )
            if before.get("execution_completed") != after.get("execution_completed"):
                detail += (
                    " · Réalisation physique : "
                    f"{'terminée' if after.get('execution_completed') else 'rouverte'}"
                )
            if before.get("execution_observation") != after.get(
                "execution_observation"
            ):
                before_observation = before.get("execution_observation")
                after_observation = after.get("execution_observation")
                if before_observation and after_observation:
                    observation_change = f"{before_observation} → {after_observation}"
                    detail += f" · Observation : {observation_change}"
                elif after_observation:
                    detail += f" · Observation : {after_observation}"
                elif before_observation:
                    detail += f" · Observation supprimée : {before_observation}"
        elif audit.action.startswith(("virement_confirmation.", "reversement.")):
            reversement_action = audit.action.startswith("reversement.")
            amount_key = "returned_amount" if reversement_action else "amount"
            date_key = "return_date" if reversement_action else "transfer_date"
            date_label = (
                "Date du reversement" if reversement_action else "Date effective"
            )
            for label_value, key, formatter in (
                ("Montant", amount_key, xof),
                (date_label, date_key, day),
                ("Note", "note", text),
            ):
                if before.get(key) == after.get(key):
                    continue
                if before.get(key) is None:
                    detail += f" · {label_value} : {formatter(after.get(key))}"
                elif after.get(key) is None:
                    before_rendered = formatter(before.get(key))
                    detail += f" · {label_value} supprimée : {before_rendered}"
                else:
                    detail += (
                        f" · {label_value} : {formatter(before.get(key))}"
                        f" → {formatter(after.get(key))}"
                    )
        reasons = [facts.get("correction_reason") or facts.get("reason")]
        for nested_key in ("amendment", "revision", "decision", "cancellation"):
            nested = facts.get(nested_key)
            if isinstance(nested, dict):
                reasons.append(nested.get("reason"))
        for reason in dict.fromkeys(reason for reason in reasons if reason):
            detail += f" · Motif : {reason}"
        events.append(
            {
                "date": audit.occurred_at,
                "title": AUDIT_ACTION_LABELS[audit.action],
                "detail": detail,
            }
        )
    validation = next(
        (
            row
            for row in [*data["disbursement_decisions"], *data["zero_decisions"]]
            if row.outcome == "approved"
        ),
        None,
    )
    if validation:
        events.append(
            {
                "date": validation.decided_at,
                "title": "Réalisation validée",
                "detail": actors.get(validation.actor_id, "Utilisateur indisponible"),
            }
        )
    current_return = data["reversements"][-1] if data["reversements"] else None
    if current_return:
        events.append(
            {
                "date": current_return.recorded_at,
                "title": "Reversement enregistré",
                "detail": xof(current_return.amount),
            }
        )
    if activity.closed_at:
        events.append(
            {
                "date": activity.closed_at,
                "title": "Activité clôturée",
                "detail": "Clôture administrative",
            }
        )
    events.sort(key=lambda row: row["date"])
    return {
        "reference": activity.reference,
        "name": str(snapshot.get("name") or ""),
        "subtitle": (
            f"Projet {data['project'].name} / PTA {data['pta'].year} / "
            f"Partenaire : {data['partner'].name}"
        ),
        "version": "interne",
        "programming": "Approuvée",
        "realization": (
            "Validée"
            if approved_zero or approved_disbursement
            else "Terminée — validation attendue"
            if all_completed
            else "En cours"
            if any_started
            else "Non commencée"
        ),
        "period_start": snapshot.get("planned_start"),
        "period_end": snapshot.get("planned_end"),
        "budget": first_approved.snapshot.get("allocation"),
        "authorized": str(authorized),
        "spent": str(spent) if spent is not None else None,
        "balance": str(authorized - spent) if spent is not None else None,
        "returned": str(current_return.amount) if current_return else None,
        "operations": [
            {
                "name": row.get("name") or "",
                "authorized": row.get("allocation") or "0",
                "spent": str(current[str(row.get("id"))].actual_spent)
                if current.get(str(row.get("id"))) is not None
                and current[str(row.get("id"))].actual_spent is not None
                else None,
            }
            for row in approved_rows
        ],
        "requests": requests,
        "events": events,
        "documents": [
            {
                "name": row.display_name,
                "detail": f"{row.media_type} · {day(row.uploaded_at)}",
            }
            for row in data["documents"]
            if row.id not in data["document_withdrawals"]
        ],
        "generated_at": data["generated_at"],
    }


def render_fiche(data: dict[str, Any]) -> bytes:
    return render_activity_fiche(_template_projection(data))


class PDFResponse(Response):
    media_type = "application/pdf"


@router.get("/activities/{identifier}/fiche.pdf", response_class=PDFResponse)
def activity_fiche(identifier: str, request: Request, auth: Auth) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor = principal(db, auth, evidence(request, auth)[0])
        activity = get_activity(db, identifier, actor=actor, shared=True)
        if not activity.approved_revision_id:
            raise AuthError(409, "fiche_unavailable")
        generated_at = auth.now(db)
        document = render_fiche(projection(db, activity, generated_at))
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
            "Content-Disposition": f'attachment; filename="fiche-{reference}.pdf"',
            "Content-Length": str(len(document)),
        },
    )
