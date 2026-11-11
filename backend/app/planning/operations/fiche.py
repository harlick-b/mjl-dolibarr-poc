from __future__ import annotations

from datetime import date, datetime
from html import escape
from io import BytesIO
from typing import Any, cast

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import APIKeyCookie
from reportlab.lib import colors  # type: ignore[import-untyped]
from reportlab.lib.enums import TA_LEFT  # type: ignore[import-untyped]
from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore[import-untyped]
from reportlab.lib.units import mm  # type: ignore[import-untyped]
from reportlab.platypus import (  # type: ignore[import-untyped]
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
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

NAVY = colors.HexColor("#16324F")
BORDER = colors.HexColor("#C8D0D5")
PALE = colors.HexColor("#F5F7F8")

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
    "activity.submit": "Révision soumise",
    "activity.prevalidate": "Révision prévalidée",
    "activity.return_supervisor": "Révision retournée par le superviseur",
    "activity.approve": "Révision approuvée",
    "activity.return_validator": "Révision retournée par le validateur",
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
    execution_actions = {
        "operation.execution_started",
        "operation.execution_recorded",
        "operation.execution_corrected",
        "zero_spending.submit",
        "zero_spending.prevalidated",
        "zero_spending.returned",
        "zero_spending.approved",
    }
    audits = list(
        db.scalars(
            select(Audit)
            .where(
                or_(
                    Audit.target == activity.id,
                    and_(
                        Audit.action.in_(execution_actions),
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
    actors = {
        item.id: (
            f"{item.full_name or item.email} ({ROLE_LABELS.get(item.role, item.role)})"
        )
        for item in db.scalars(select(User).where(User.id.in_(actor_ids)))
    }
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


def render_fiche(data: dict[str, Any]) -> bytes:
    activity: Activity = data["activity"]
    snapshot: dict[str, Any] = data["snapshot"]
    actors: dict[str, str] = data["actors"]
    buffer = BytesIO()
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="FicheTitle",
            parent=styles["Title"],
            textColor=NAVY,
            fontSize=20,
            leading=24,
            alignment=TA_LEFT,
            spaceAfter=4 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading2"],
            textColor=NAVY,
            fontSize=12,
            leading=15,
            spaceBefore=5 * mm,
            spaceAfter=2 * mm,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            parent=styles["BodyText"],
            fontSize=8.5,
            leading=11,
        )
    )
    small = styles["Small"]
    story: list[Any] = [
        Paragraph("FICHE RÉCAPITULATIVE D’ACTIVITÉ", styles["FicheTitle"]),
        Paragraph(text(snapshot.get("name")), styles["Heading2"]),
        Paragraph(text(activity.reference), small),
        Spacer(1, 3 * mm),
    ]

    def section(title: str) -> None:
        story.append(Paragraph(title, styles["Section"]))

    def table(
        values: list[tuple[str, str]], widths: tuple[float, float] = (50 * mm, 120 * mm)
    ) -> None:
        result = Table(
            [
                [Paragraph(f"<b>{label}</b>", small), Paragraph(value, small)]
                for label, value in values
            ],
            colWidths=list(widths),
            repeatRows=0,
            splitInRow=1,
        )
        result.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), PALE),
                    ("TEXTCOLOR", (0, 0), (-1, -1), NAVY),
                    ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(result)

    def grid_table(
        headers: list[str], values: list[list[str]], widths: list[float]
    ) -> None:
        result = Table(
            [
                [Paragraph(f"<b>{heading}</b>", small) for heading in headers],
                *[[Paragraph(value, small) for value in row] for row in values],
            ],
            colWidths=widths,
            repeatRows=1,
            splitInRow=1,
        )
        result.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("TEXTCOLOR", (0, 1), (-1, -1), NAVY),
                    ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(result)

    section("Identité de l’activité")
    table(
        [
            ("Partenaire", text(data["partner"].name)),
            (
                "Projet",
                f"{text(data['project'].reference)} · {text(data['project'].name)}",
            ),
            ("PTA", str(data["pta"].year)),
            ("État", STATE_LABELS.get(activity.state, text(activity.state))),
            ("Générée le", day(data["generated_at"])),
        ]
    )

    section("Planification approuvée")
    assigned_agents = ", ".join(
        actors.get(item.agent_id, "Personne non disponible")
        for item in data["assignments"]
    )
    table(
        [
            ("Description", text(snapshot.get("description"))),
            (
                "Période",
                "{} au {}".format(
                    day(snapshot.get("planned_start")),
                    day(snapshot.get("planned_end")),
                ),
            ),
            ("Allocation approuvée", xof(snapshot.get("allocation"))),
            ("Révision approuvée", f"N° {data['revision'].revision_number}"),
            ("Agents affectés", text(assigned_agents)),
        ]
    )
    section("Budget et opérations")
    approved_revision_ids = {
        item.revision_id for item in data["decisions"] if item.outcome == "approved"
    }
    initial_revision = next(
        (item for item in data["revisions"] if item.id in approved_revision_ids),
        data["revision"],
    )
    approved_operation_ids = {
        str(item.get("id"))
        for item in snapshot.get("operations", [])
        if isinstance(item, dict)
    }
    approved_current_operations = [
        data["operations"].get(identifier) for identifier in approved_operation_ids
    ]
    spending_known = bool(approved_current_operations) and all(
        item is not None and item.actual_spent is not None
        for item in approved_current_operations
    )
    spent_total = (
        sum(item.actual_spent or 0 for item in approved_current_operations if item)
        if spending_known
        else None
    )
    budget_summary = Table(
        [
            [
                Paragraph("<b>Budget initial</b>", small),
                Paragraph("<b>Budget approuvé actuel</b>", small),
                Paragraph("<b>Dépenses enregistrées</b>", small),
            ],
            [
                Paragraph(xof(initial_revision.snapshot.get("allocation")), small),
                Paragraph(xof(snapshot.get("allocation")), small),
                Paragraph(xof(spent_total), small),
            ],
        ],
        colWidths=[170 * mm / 3] * 3,
    )
    budget_summary.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), PALE),
                ("TEXTCOLOR", (0, 0), (-1, -1), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 1), (-1, 1), "RIGHT"),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.extend([budget_summary, Spacer(1, 3 * mm)])
    operation_rows: list[list[Any]] = [
        [
            Paragraph("<b>Opération</b>", small),
            Paragraph("<b>Prévu</b>", small),
            Paragraph("<b>Réalisé</b>", small),
            Paragraph("<b>État</b>", small),
        ]
    ]
    current_operations: dict[str, Operation] = data["operations"]
    for operation in snapshot.get("operations", []):
        if not isinstance(operation, dict):
            continue
        current = current_operations.get(str(operation.get("id")))
        type_label = data["operation_types"].get(str(operation.get("type_id")), "")
        label = (
            f"{text(type_label)} — {text(operation.get('name'))}"
            if type_label
            else text(operation.get("name"))
        )
        status = (
            "Terminée"
            if current and current.execution_completed
            else (
                "En cours"
                if current and current.execution_started_at
                else "Non commencée"
            )
        )
        operation_rows.append(
            [
                Paragraph(label, small),
                Paragraph(xof(operation.get("allocation")), small),
                Paragraph(xof(current.actual_spent if current else None), small),
                Paragraph(status, small),
            ]
        )
    operation_rows.append(
        [
            Paragraph("<b>Total</b>", small),
            Paragraph(f"<b>{xof(snapshot.get('allocation'))}</b>", small),
            Paragraph(f"<b>{xof(spent_total)}</b>", small),
            Paragraph("", small),
        ]
    )
    operation_table = Table(
        operation_rows,
        colWidths=[82 * mm, 30 * mm, 30 * mm, 28 * mm],
        repeatRows=1,
        splitInRow=1,
    )
    operation_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.35, BORDER),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(operation_table)

    chronology: list[Any] = []
    decisions_by_revision: dict[str, list[ActivityRevisionDecision]] = {}
    for decision in data["decisions"]:
        decisions_by_revision.setdefault(decision.revision_id, []).append(decision)
    for revision in data["revisions"]:
        revision_actor = text(actors.get(revision.submitter_id, revision.submitter_id))
        submission_reason: object | None = None
        for key in ("withdrawal", "transfer"):
            request = revision.snapshot.get(key)
            if isinstance(request, dict) and request.get("reason"):
                submission_reason = request["reason"]
                break
        reason_suffix = (
            f" · Motif : {text(submission_reason)}" if submission_reason else ""
        )
        chronology.append(
            Paragraph(
                f"<b>Révision {revision.revision_number}</b> · soumise le "
                f"{day(revision.submitted_at)} par {revision_actor}{reason_suffix}",
                small,
            )
        )
        for decision in decisions_by_revision.get(revision.id, []):
            reason = f" · Motif : {text(decision.reason)}" if decision.reason else ""
            requested = (
                f" · Montant demandé : {xof(decision.requested_amount)}"
                if decision.requested_amount is not None
                else ""
            )
            role = text(ROLE_LABELS.get(decision.actor_role, decision.actor_role))
            outcome = text(OUTCOME_LABELS.get(decision.outcome, decision.outcome))
            decision_actor = text(actors.get(decision.actor_id, decision.actor_id))
            chronology.append(
                Paragraph(
                    f"{day(decision.decided_at)} · {role} · {outcome} · "
                    f"{decision_actor}{reason}{requested}",
                    small,
                )
            )
        chronology.append(Spacer(1, 1.5 * mm))
    validation_chronology = chronology

    section("Autorisations administratives")
    authorization_count = 0

    def authorization_table(
        title: str,
        request_state: str,
        submitter_id: str,
        submitted_at: datetime,
        decisions: list[Any],
        *,
        amount: str = "—",
        reason: str = "—",
        cancellation: str | None = None,
    ) -> None:
        nonlocal authorization_count
        authorization_count += 1
        story.append(Paragraph(f"<b>{title}</b>", small))
        summary = (
            f"{request_state} · {amount} · soumise le {day(submitted_at)} par "
            f"{text(actors.get(submitter_id, submitter_id))}"
        )
        if reason != "—":
            summary += f" · Motif : {reason}"
        if cancellation:
            summary += f" · {cancellation}"
        story.append(Paragraph(summary, small))
        rows = []
        for decision in decisions:
            rows.append(
                [
                    text(ROLE_LABELS.get(decision.actor_role, decision.actor_role)),
                    text(OUTCOME_LABELS.get(decision.outcome, decision.outcome)),
                    text(actors.get(decision.actor_id, decision.actor_id)),
                    day(decision.decided_at),
                    text(decision.reason),
                ]
            )
        if rows:
            grid_table(
                ["Étape", "Décision", "Responsable", "Date", "Motif"],
                rows,
                [34 * mm, 28 * mm, 42 * mm, 31 * mm, 35 * mm],
            )
        else:
            story.append(Paragraph("Aucune décision enregistrée.", small))
        story.append(Spacer(1, 3 * mm))

    for declaration in data["zero_declarations"]:
        state = STATE_LABELS.get(declaration.state, text(declaration.state))
        authorization_table(
            "Déclaration sans dépense — 0 F CFA",
            state,
            declaration.submitter_id,
            declaration.submitted_at,
            [
                item
                for item in data["zero_decisions"]
                if item.declaration_id == declaration.id
            ],
            amount=xof(0),
            reason=text(declaration.reason),
        )
    for request in data["funding_requests"]:
        state = STATE_LABELS.get(request.state, text(request.state))
        cancellation = None
        if request.cancelled_at:
            cancelled_by = text(
                actors.get(request.cancelled_by_id, request.cancelled_by_id)
            )
            cancellation = (
                f"Annulée le {day(request.cancelled_at)} par {cancelled_by} · "
                f"Motif : {text(request.cancellation_reason)}"
            )
        authorization_table(
            "Demande de financement complémentaire",
            state,
            request.submitter_id,
            request.submitted_at,
            [
                item
                for item in data["funding_decisions"]
                if item.request_id == request.id
            ],
            amount=xof(request.amount),
            cancellation=cancellation,
        )
    for request in data["disbursements"]:
        state = STATE_LABELS.get(request.state, text(request.state))
        cancellation = None
        if request.cancelled_at:
            cancelled_by = text(
                actors.get(request.cancelled_by_id, request.cancelled_by_id)
            )
            cancellation = (
                f"Annulée le {day(request.cancelled_at)} par {cancelled_by} · "
                f"Motif : {text(request.cancellation_reason)}"
            )
        authorization_table(
            "Demande de décaissement",
            state,
            request.submitter_id,
            request.submitted_at,
            [
                item
                for item in data["disbursement_decisions"]
                if item.request_id == request.id
            ],
            amount=xof(request.amount),
            cancellation=cancellation,
        )
    disbursement_amounts = {item.id: item.amount for item in data["disbursements"]}
    for request in data["virements"]:
        state = STATE_LABELS.get(request.state, text(request.state))
        amount = xof(disbursement_amounts.get(request.disbursement_request_id))
        cancellation = None
        if request.cancelled_at:
            cancelled_by = text(
                actors.get(request.cancelled_by_id, request.cancelled_by_id)
            )
            cancellation = (
                f"Annulée le {day(request.cancelled_at)} par {cancelled_by} · "
                f"Motif : {text(request.cancellation_reason)}"
            )
        authorization_table(
            "Demande de virement",
            state,
            request.submitter_id,
            request.submitted_at,
            [
                item
                for item in data["virement_decisions"]
                if item.request_id == request.id
            ],
            amount=amount,
            cancellation=cancellation,
        )
    if not authorization_count:
        story.append(Paragraph("Aucune autorisation financière enregistrée.", small))

    section("Déclarations externes et clôture")
    settlement: list[tuple[str, str]] = []
    for item in data["confirmations"]:
        correction = (
            f" · Correction : {text(item.correction_reason)}"
            if item.correction_reason
            else ""
        )
        settlement.append(
            (
                f"Confirmation virement · révision {item.revision}",
                f"{xof(item.amount)} · date externe {day(item.transfer_date)} · "
                f"saisie {day(item.recorded_at)} par "
                f"{text(actors.get(item.actor_id, item.actor_id))} · "
                f"{text(item.note)}{correction}",
            )
        )
    approved_ids = {
        str(operation.get("id"))
        for operation in snapshot.get("operations", [])
        if isinstance(operation, dict)
    }
    approved_operations = [
        current_operations.get(identifier) for identifier in approved_ids
    ]
    spending_final = bool(approved_operations) and all(
        item is not None and item.execution_completed and item.actual_spent is not None
        for item in approved_operations
    )
    required: int | None = None
    if spending_final:
        actual_total = sum(
            item.actual_spent or 0 for item in approved_operations if item
        )
        required = max(0, int(str(snapshot["allocation"])) - actual_total)
    settlement.append(
        (
            "Montant à reverser",
            xof(required) if required is not None else "Non renseigné",
        )
    )
    for item in data["reversements"]:
        correction = (
            f" · Correction : {text(item.correction_reason)}"
            if item.correction_reason
            else ""
        )
        settlement.append(
            (
                f"Reversement déclaré · révision {item.revision}",
                f"{xof(item.amount)} · date externe {day(item.return_date)} · "
                f"saisie {day(item.recorded_at)} par "
                f"{text(actors.get(item.actor_id, item.actor_id))} · "
                f"{text(item.note)}{correction}",
            )
        )
    current_return = data["reversements"][-1] if data["reversements"] else None
    returned = (
        xof(current_return.amount)
        if current_return
        else xof(0)
        if required == 0
        else "Non renseigné"
    )
    settlement.append(("Montant reversé", returned))
    closure_actor = text(actors.get(activity.closed_by_id or "", activity.closed_by_id))
    settlement.append(
        (
            "Clôture",
            f"{day(activity.closed_at)} · {closure_actor}"
            if activity.closed_at
            else "Activité non clôturée.",
        )
    )
    table(settlement)

    section("Pièces justificatives")
    documents_by_id = {item.id: item for item in data["documents"]}
    document_rows: list[list[str]] = []
    for document in data["documents"]:
        withdrawal = data["document_withdrawals"].get(document.id)
        uploader = text(actors.get(document.uploaded_by_id, document.uploaded_by_id))
        if withdrawal:
            withdrawer = text(
                actors.get(withdrawal.withdrawn_by_id, withdrawal.withdrawn_by_id)
            )
            replacement = documents_by_id.get(withdrawal.replacement_document_id)
            replacement_text = (
                f" · Remplacée par {text(replacement.display_name)}"
                if replacement
                else ""
            )
            document_rows.append(
                [
                    f"{text(document.display_name)}<br/><i>Retirée par "
                    f"{withdrawer} · Motif : {text(withdrawal.reason)}"
                    f"{replacement_text}</i>",
                    uploader,
                    f"Déposée le {day(document.uploaded_at)}<br/>Retirée le "
                    f"{day(withdrawal.withdrawn_at)}",
                ]
            )
        else:
            document_rows.append(
                [
                    f"{text(document.display_name)}<br/><i>Pièce actuelle</i>",
                    uploader,
                    day(document.uploaded_at),
                ]
            )
    if document_rows:
        grid_table(
            ["Document / Contexte", "Déposé par", "Date"],
            document_rows,
            [85 * mm, 50 * mm, 35 * mm],
        )
    else:
        story.append(Paragraph("Aucune pièce enregistrée.", small))

    section("Chronologie administrative")
    audit_lines: list[Any] = []
    validation_audit_actions = {
        "activity.submit",
        "activity.prevalidate",
        "activity.return_supervisor",
        "activity.approve",
        "activity.return_validator",
        "activity.withdrawal_submit",
        "activity.withdrawal_prevalidate",
        "activity.withdrawal_return_supervisor",
        "activity.withdrawal_approve",
        "activity.withdrawal_return_validator",
        "activity.transfer_submit",
        "activity.transfer_prevalidate",
        "activity.transfer_return_supervisor",
        "activity.transfer_approve",
        "activity.transfer_return_validator",
    }
    for item in data["audits"]:
        if item.action in validation_audit_actions:
            continue
        actor = text(actors.get(item.actor, item.actor))
        action = AUDIT_ACTION_LABELS.get(item.action, item.action)
        line = f"{day(item.occurred_at)} · {text(action)} · {actor}"
        facts = item.business if isinstance(item.business, dict) else {}
        if item.action.startswith("operation.execution_"):
            operation = current_operations.get(str(facts.get("operation_id")))
            operation_name = operation.name if operation else facts.get("operation_id")
            before_value = facts.get("before")
            after_value = facts.get("after")
            before = (
                cast(dict[str, Any], before_value)
                if isinstance(before_value, dict)
                else {}
            )
            after = (
                cast(dict[str, Any], after_value)
                if isinstance(after_value, dict)
                else {}
            )
            line += (
                f" · {text(operation_name)} · réalisé "
                f"{xof(before.get('actual_spent'))} → "
                f"{xof(after.get('actual_spent'))} · terminé "
                f"{'Oui' if before.get('execution_completed') else 'Non'} → "
                f"{'Oui' if after.get('execution_completed') else 'Non'}"
            )
            if before.get("execution_observation") != after.get(
                "execution_observation"
            ):
                line += (
                    f" · Observation : {text(before.get('execution_observation'))}"
                    f" → {text(after.get('execution_observation'))}"
                )
            if facts.get("correction_reason"):
                line += f" · Motif : {text(facts['correction_reason'])}"
        else:
            audit_reason: object | None = None
            for key in ("cancellation", "decision", "amendment", "revision"):
                nested = facts.get(key)
                if isinstance(nested, dict) and nested.get("reason"):
                    audit_reason = nested["reason"]
                    break
            if audit_reason:
                line += f" · Motif : {text(audit_reason)}"
        audit_lines.append(Paragraph(line, small))
    if validation_chronology:
        story.append(KeepTogether(validation_chronology[:3]))
        story.extend(validation_chronology[3:])
    if audit_lines:
        story.extend(audit_lines)
    elif not validation_chronology:
        story.append(Paragraph("Aucun événement enregistré.", small))

    generated_at: datetime = data["generated_at"]

    def decorate(canvas: Any, document: Any) -> None:
        canvas.saveState()
        canvas.setStrokeColor(NAVY)
        canvas.setLineWidth(1.2)
        canvas.setFont("Helvetica-Bold", 13)
        canvas.setFillColor(NAVY)
        canvas.drawString(20 * mm, A4[1] - 16 * mm, "MJL")
        canvas.setFont("Helvetica", 8)
        canvas.drawRightString(
            A4[0] - 20 * mm,
            A4[1] - 13 * mm,
            f"Référence : {activity.reference}",
        )
        canvas.drawRightString(
            A4[0] - 20 * mm,
            A4[1] - 18 * mm,
            f"Générée le {generated_at.strftime('%d/%m/%Y')}",
        )
        canvas.line(20 * mm, A4[1] - 22 * mm, A4[0] - 20 * mm, A4[1] - 22 * mm)
        canvas.drawString(
            20 * mm,
            10 * mm,
            f"MJL · {activity.reference} · {generated_at.strftime('%d/%m/%Y')}",
        )
        canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f"Page {document.page}")
        canvas.restoreState()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=28 * mm,
        bottomMargin=18 * mm,
        title=f"Fiche activité {activity.reference}",
        author="MJL",
        subject="Fiche récapitulative d’activité",
    )
    document.build(story, onFirstPage=decorate, onLaterPages=decorate)
    return buffer.getvalue()


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
