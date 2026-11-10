"""Durable notifications for supported financial review workflows."""

from datetime import datetime
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.service import AuthService
from app.planning.models import (
    Activity,
    ActivityAssignment,
    DisbursementDecision,
    DisbursementRequest,
    FinancialWorkflowNotification,
    FundingDecision,
    FundingRequest,
    VirementDecision,
    VirementRequest,
    ZeroSpendingDecision,
    ZeroSpendingDeclaration,
)
from app.planning.notification_delivery import attempt_notification_email
from app.planning.service import CONTEXT, locked_mutation

FinancialRequest = (
    FundingRequest | DisbursementRequest | VirementRequest | ZeroSpendingDeclaration
)

REQUEST_LABELS = {
    "funding": "Demande de financement complémentaire",
    "disbursement": "Demande d’autorisation de décaissement",
    "virement": "Demande de virement",
    "zero_spending": "Déclaration sans dépense",
}

REQUEST_MODELS: dict[str, type[FinancialRequest]] = {
    "funding": FundingRequest,
    "disbursement": DisbursementRequest,
    "virement": VirementRequest,
    "zero_spending": ZeroSpendingDeclaration,
}

DECISION_MODELS: dict[str, Any] = {
    "funding": FundingDecision,
    "disbursement": DisbursementDecision,
    "virement": VirementDecision,
    "zero_spending": ZeroSpendingDecision,
}


def excluded_reviewer_ids(request: FinancialRequest) -> set[str]:
    if isinstance(request, VirementRequest):
        return set(request.excluded_reviewer_ids)
    return set(cast(list[str], request.snapshot.get("excluded_reviewer_ids", [])))


def _record(
    db: Session,
    auth: AuthService,
    activity: Activity,
    request: FinancialRequest,
    request_kind: str,
    recipient_ids: list[str],
    *,
    kind: str,
    stage: str,
    reason: str | None = None,
) -> list[str]:
    now = auth.now(db)
    identifiers: list[str] = []
    for recipient_id in recipient_ids:
        item = FinancialWorkflowNotification(
            context_id=CONTEXT,
            activity_id=activity.id,
            request_kind=request_kind,
            request_id=request.id,
            recipient_id=recipient_id,
            kind=kind,
            stage=stage,
            reason=reason,
            created_at=now,
            read_at=None,
            handled_at=None,
            email_status="skipped" if kind == "financial_approved" else "unconfirmed",
            email_completed_at=now if kind == "financial_approved" else None,
            version=1,
        )
        db.add(item)
        db.flush()
        auth.audit(
            db,
            "financial_notification.created",
            "system:financial-notification",
            item.id,
            details={"activity_id": activity.id},
        )
        identifiers.append(item.id)
    return identifiers


def record_review_notifications(
    db: Session,
    auth: AuthService,
    activity: Activity,
    request: FinancialRequest,
    request_kind: str,
    stage: str,
    *,
    exclude_user_id: str | None = None,
) -> list[str]:
    role = "AGENT_VERIFICATEUR" if stage == "supervisor" else "VALIDATEUR_DEFINITIF"
    excluded = excluded_reviewer_ids(request)
    if exclude_user_id:
        excluded.add(exclude_user_id)
    conditions = [User.role == role, User.state == "active"]
    if excluded:
        conditions.append(User.id.not_in(excluded))
    recipient_ids = list(
        db.scalars(select(User.id).where(*conditions).order_by(User.id))
    )
    return _record(
        db,
        auth,
        activity,
        request,
        request_kind,
        recipient_ids,
        kind="financial_review",
        stage=stage,
    )


def record_agent_notifications(
    db: Session,
    auth: AuthService,
    activity: Activity,
    request: FinancialRequest,
    request_kind: str,
    *,
    kind: str,
    reason: str | None = None,
) -> list[str]:
    recipient_ids = list(
        db.scalars(
            select(ActivityAssignment.agent_id)
            .join(User, User.id == ActivityAssignment.agent_id)
            .where(
                ActivityAssignment.activity_id == activity.id,
                ActivityAssignment.ended_at.is_(None),
                User.role == "AGENT_SAISIE",
                User.state == "active",
            )
            .order_by(ActivityAssignment.agent_id)
        )
    )
    return _record(
        db,
        auth,
        activity,
        request,
        request_kind,
        recipient_ids,
        kind=kind,
        stage="agent",
        reason=reason,
    )


def mark_review_handled(
    db: Session,
    request_kind: str,
    request_id: str,
    stage: str,
    handled_at: datetime,
) -> None:
    for item in db.scalars(
        select(FinancialWorkflowNotification)
        .where(
            FinancialWorkflowNotification.request_kind == request_kind,
            FinancialWorkflowNotification.request_id == request_id,
            FinancialWorkflowNotification.kind == "financial_review",
            FinancialWorkflowNotification.stage == stage,
            FinancialWorkflowNotification.handled_at.is_(None),
        )
        .with_for_update()
    ):
        item.handled_at = handled_at


def _request_amount(db: Session, source: FinancialRequest) -> int | None:
    if isinstance(source, (FundingRequest, DisbursementRequest)):
        return source.amount
    if isinstance(source, ZeroSpendingDeclaration):
        return 0
    if isinstance(source, VirementRequest):
        return db.scalar(
            select(DisbursementRequest.amount).where(
                DisbursementRequest.id == source.disbursement_request_id
            )
        )
    return None


def _actor_id(
    db: Session,
    item: FinancialWorkflowNotification,
    source: FinancialRequest,
) -> str | None:
    if item.stage == "supervisor" and item.kind == "financial_review":
        return source.submitter_id
    decision_model = DECISION_MODELS.get(item.request_kind)
    if decision_model is None:
        return None
    outcome = "prevalidated" if item.stage == "validator" else "returned"
    return db.scalar(
        select(decision_model.actor_id)
        .where(
            decision_model.request_id == source.id,
            decision_model.outcome == outcome,
        )
        .order_by(decision_model.decided_at.desc())
        .limit(1)
    )


def deliver_financial_notification(auth: AuthService, identifier: str) -> str | None:
    delivery: tuple[str, str, dict[str, object]] | None = None
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        item = db.get(FinancialWorkflowNotification, identifier, with_for_update=True)
        if (
            not item
            or item.email_status != "unconfirmed"
            or item.email_completed_at is not None
        ):
            return None
        recipient = db.get(User, item.recipient_id)
        activity = db.get(Activity, item.activity_id)
        model = REQUEST_MODELS.get(item.request_kind)
        source = cast(
            FinancialRequest | None,
            db.get(model, item.request_id) if model else None,
        )
        if recipient and recipient.state == "active" and activity and source:
            mail_kind = (
                "financial_correction"
                if item.kind == "financial_correction"
                else "financial_review_supervisor"
                if item.stage == "supervisor"
                else "financial_review_validator"
            )
            amount = _request_amount(db, source)
            actor_id = _actor_id(db, item, source)
            actor = db.get(User, actor_id) if actor_id else None
            if amount is not None:
                delivery = (
                    recipient.email,
                    mail_kind,
                    {
                        "recipient_name": recipient.full_name,
                        "actor_name": actor.full_name if actor else None,
                        "request_label": REQUEST_LABELS[item.request_kind],
                        "request_amount": f"{amount:,}".replace(",", " "),
                        "activity_reference": activity.reference,
                        "activity_name": activity.name,
                        "action_url": (
                            f"{auth.policy.origin}/execution/activities/{activity.id}"
                        ),
                        **(
                            {"reason": item.reason}
                            if item.kind == "financial_correction"
                            else {}
                        ),
                    },
                )
        item.email_completed_at = auth.now(db)
        if delivery is None:
            item.email_status = "skipped"
            return "skipped"

    recipient_email, mail_kind, context = delivery
    status, _provider_id = attempt_notification_email(
        auth, recipient_email, mail_kind, context
    )
    with Session(auth.engine) as db, db.begin():
        item = db.get(FinancialWorkflowNotification, identifier, with_for_update=True)
        if not item or item.email_status != "unconfirmed":
            return None
        item.email_status = status
        auth.audit(
            db,
            "financial_notification.email_delivery",
            "system:financial-notification",
            item.id,
            outcome=status,
            details={"email_status": status},
        )
    return status
