from __future__ import annotations

from datetime import date, datetime
from html import escape
from io import BytesIO
from typing import Any, cast

from fastapi import APIRouter, Depends, Request, Response
from fastapi.security import APIKeyCookie
from reportlab.lib import colors  # type: ignore[import-untyped]
from reportlab.lib.enums import TA_CENTER  # type: ignore[import-untyped]
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
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import Audit, User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.models import (
    Activity,
    ActivityRevision,
    ActivityRevisionDecision,
    AnnualPTA,
    DisbursementDecision,
    DisbursementRequest,
    Operation,
    OperationType,
    Partner,
    Project,
    ReversementDeclaration,
    VirementConfirmation,
    VirementDecision,
    VirementRequest,
)
from app.planning.routes import get_activity, locked_read
from app.planning.service import principal

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

NAVY = colors.HexColor("#102A43")
GOLD = colors.HexColor("#D4A72C")
PALE = colors.HexColor("#F3F6F8")

ROLE_LABELS = {
    "AGENT_SAISIE": "Agent de saisie",
    "AGENT_VERIFICATEUR": "Agent vérificateur",
    "VALIDATEUR_DEFINITIF": "Validateur définitif",
}
STATE_LABELS = {
    "draft": "Brouillon",
    "amendment_draft": "Modification en préparation",
    "submitted": "Soumise",
    "prevalidated": "Prévalidée",
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
AUDIT_ACTION_LABELS = {**ACTIVITY_ACTION_LABELS, **EXECUTION_ACTION_LABELS}


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
    execution_actions = {
        "operation.execution_started",
        "operation.execution_recorded",
        "operation.execution_corrected",
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
            *(item.submitter_id for item in disbursements),
            *(item.cancelled_by_id for item in disbursements),
            *(item.actor_id for item in disbursement_decisions),
            *(item.submitter_id for item in virements),
            *(item.cancelled_by_id for item in virements),
            *(item.actor_id for item in virement_decisions),
            *(item.actor_id for item in confirmations),
            *(item.actor_id for item in reversements),
            *(item.actor for item in audits),
        ]
        if value
    }
    actors = {
        item.id: f"{item.email} ({ROLE_LABELS.get(item.role, item.role)})"
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
        "disbursements": disbursements,
        "disbursement_decisions": disbursement_decisions,
        "virements": virements,
        "virement_decisions": virement_decisions,
        "confirmations": confirmations,
        "reversements": reversements,
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
            alignment=TA_CENTER,
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
        Paragraph(
            f"{text(activity.reference)} · {text(snapshot.get('name'))}",
            styles["Heading2"],
        ),
        Paragraph(
            "Document administratif régénéré depuis les données autorisées de MJL.",
            small,
        ),
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
                    ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(result)

    section("1. Contexte")
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

    section("2. Planification approuvée")
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
        ]
    )
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
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(operation_table)

    section("3. Révisions et décisions")
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
    story.append(
        KeepTogether(chronology[:3])
        if chronology
        else Paragraph("Aucune révision.", small)
    )
    if len(chronology) > 3:
        story.extend(chronology[3:])

    section("4. Autorisations financières")
    financial: list[tuple[str, str]] = []
    for request in data["disbursements"]:
        state = STATE_LABELS.get(request.state, text(request.state))
        submitter = text(actors.get(request.submitter_id, request.submitter_id))
        financial.append(
            (
                "Demande de décaissement",
                f"{xof(request.amount)} · {state} · soumise le "
                f"{day(request.submitted_at)} par {submitter}",
            )
        )
        if request.cancelled_at:
            cancelled_by = text(
                actors.get(request.cancelled_by_id, request.cancelled_by_id)
            )
            financial.append(
                (
                    "Annulation décaissement",
                    f"{day(request.cancelled_at)} · {cancelled_by} · Motif : "
                    f"{text(request.cancellation_reason)}",
                )
            )
    for decision in data["disbursement_decisions"]:
        outcome = text(OUTCOME_LABELS.get(decision.outcome, decision.outcome))
        decision_actor = text(actors.get(decision.actor_id, decision.actor_id))
        role = text(ROLE_LABELS.get(decision.actor_role, decision.actor_role))
        reason = f" · Motif : {text(decision.reason)}" if decision.reason else ""
        financial.append(
            (
                "Décision décaissement",
                f"{outcome} · {role} · {decision_actor} · "
                f"{day(decision.decided_at)}{reason}",
            )
        )
    disbursement_amounts = {item.id: item.amount for item in data["disbursements"]}
    for request in data["virements"]:
        state = STATE_LABELS.get(request.state, text(request.state))
        amount = xof(disbursement_amounts.get(request.disbursement_request_id))
        submitter = text(actors.get(request.submitter_id, request.submitter_id))
        financial.append(
            (
                "Demande de virement",
                f"{amount} · {state} · soumise le {day(request.submitted_at)} "
                f"par {submitter}",
            )
        )
        if request.cancelled_at:
            cancelled_by = text(
                actors.get(request.cancelled_by_id, request.cancelled_by_id)
            )
            financial.append(
                (
                    "Annulation virement",
                    f"{day(request.cancelled_at)} · {cancelled_by} · Motif : "
                    f"{text(request.cancellation_reason)}",
                )
            )
    for decision in data["virement_decisions"]:
        outcome = text(OUTCOME_LABELS.get(decision.outcome, decision.outcome))
        decision_actor = text(actors.get(decision.actor_id, decision.actor_id))
        role = text(ROLE_LABELS.get(decision.actor_role, decision.actor_role))
        reason = f" · Motif : {text(decision.reason)}" if decision.reason else ""
        financial.append(
            (
                "Décision virement",
                f"{outcome} · {role} · {decision_actor} · "
                f"{day(decision.decided_at)}{reason}",
            )
        )
    table(financial or [("Situation", "Aucune autorisation financière enregistrée.")])

    section("5. Virements externes et reversement")
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
    table(settlement)

    section("6. Clôture et pièces justificatives")
    closure_actor = text(actors.get(activity.closed_by_id or "", activity.closed_by_id))
    table(
        [
            (
                "Clôture",
                f"{day(activity.closed_at)} · {closure_actor}"
                if activity.closed_at
                else "Activité non clôturée.",
            ),
            (
                "Pièces justificatives",
                "Aucune pièce enregistrée dans MJL. Les pièces restent facultatives "
                "et seront traitées dans une tranche distincte.",
            ),
        ]
    )

    section("7. Journal des événements")
    audit_lines: list[Any] = []
    for item in data["audits"]:
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
    story.extend(audit_lines or [Paragraph("Aucun événement enregistré.", small)])

    generated_at: datetime = data["generated_at"]

    def decorate(canvas: Any, document: Any) -> None:
        canvas.saveState()
        canvas.setStrokeColor(GOLD)
        canvas.setLineWidth(1.2)
        canvas.line(20 * mm, A4[1] - 14 * mm, A4[0] - 20 * mm, A4[1] - 14 * mm)
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(NAVY)
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
        topMargin=20 * mm,
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
        activity = get_activity(db, identifier, shared=True)
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
