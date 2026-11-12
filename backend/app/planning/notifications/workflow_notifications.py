"""Durable notifications for Activity review and Agent outcomes."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.service import AuthService
from app.planning.core.models import (
    Activity,
    ActivityAssignment,
    ActivityContributor,
    ActivityRevision,
    ActivityRevisionDecision,
    ActivityWorkflowNotification,
    AnnualPTA,
    Project,
)
from app.planning.core.service import CONTEXT, locked_mutation
from app.planning.notifications.notification_delivery import attempt_notification_email


def _record(
    db: Session,
    auth: AuthService,
    activity: Activity,
    revision: ActivityRevision,
    recipient_ids: list[str],
    *,
    kind: str,
    stage: str,
    reason: str | None = None,
) -> list[str]:
    now = auth.now(db)
    identifiers: list[str] = []
    for recipient_id in recipient_ids:
        item = ActivityWorkflowNotification(
            context_id=CONTEXT,
            activity_id=activity.id,
            revision_id=revision.id,
            recipient_id=recipient_id,
            kind=kind,
            stage=stage,
            reason=reason,
            created_at=now,
            read_at=None,
            handled_at=None,
            email_status="skipped" if kind == "activity_approved" else "unconfirmed",
            email_completed_at=now if kind == "activity_approved" else None,
            version=1,
        )
        db.add(item)
        db.flush()
        auth.audit(
            db,
            "activity_notification.created",
            "system:activity-notification",
            item.id,
            details={"activity_id": activity.id},
        )
        identifiers.append(item.id)
    return identifiers


def record_review_notifications(
    db: Session,
    auth: AuthService,
    activity: Activity,
    revision: ActivityRevision,
    stage: str,
    *,
    exclude_user_id: str | None = None,
) -> list[str]:
    role = "AGENT_VERIFICATEUR" if stage == "supervisor" else "VALIDATEUR_DEFINITIF"
    conditions = [User.role == role, User.state == "active"]
    if exclude_user_id:
        conditions.append(User.id != exclude_user_id)
    conditions.append(
        ~select(ActivityContributor.id)
        .where(
            ActivityContributor.activity_id == activity.id,
            ActivityContributor.user_id == User.id,
            ActivityContributor.kind == "content",
        )
        .exists()
    )
    recipient_ids = list(
        db.scalars(select(User.id).where(*conditions).order_by(User.id))
    )
    return _record(
        db,
        auth,
        activity,
        revision,
        recipient_ids,
        kind="activity_review",
        stage=stage,
    )


def record_agent_notifications(
    db: Session,
    auth: AuthService,
    activity: Activity,
    revision: ActivityRevision,
    *,
    kind: str,
    reason: str | None = None,
    recipient_ids: list[str] | None = None,
) -> list[str]:
    if recipient_ids is None:
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
    else:
        recipient_ids = list(
            db.scalars(
                select(User.id)
                .where(
                    User.id.in_(recipient_ids),
                    User.role == "AGENT_SAISIE",
                    User.state == "active",
                )
                .order_by(User.id)
            )
        )
    return _record(
        db,
        auth,
        activity,
        revision,
        recipient_ids,
        kind=kind,
        stage="agent",
        reason=reason,
    )


def mark_review_handled(
    db: Session, revision_id: str, stage: str, handled_at: datetime
) -> None:
    for item in db.scalars(
        select(ActivityWorkflowNotification)
        .where(
            ActivityWorkflowNotification.revision_id == revision_id,
            ActivityWorkflowNotification.kind == "activity_review",
            ActivityWorkflowNotification.stage == stage,
            ActivityWorkflowNotification.handled_at.is_(None),
        )
        .with_for_update()
    ):
        item.handled_at = handled_at


def _activity_action(revision: ActivityRevision) -> str:
    if isinstance(revision.snapshot.get("withdrawal"), dict):
        return "demande de retrait"
    if isinstance(revision.snapshot.get("transfer"), dict):
        return "demande de transfert annuel"
    if revision.snapshot.get("amendment_id"):
        return "modification d’activité"
    return "activité"


def _actor_id(
    db: Session,
    item: ActivityWorkflowNotification,
    revision: ActivityRevision,
) -> str | None:
    if item.stage == "supervisor" and item.kind == "activity_review":
        return revision.submitter_id
    if item.stage == "validator":
        return db.scalar(
            select(ActivityRevisionDecision.actor_id).where(
                ActivityRevisionDecision.revision_id == revision.id,
                ActivityRevisionDecision.stage == "supervisor",
                ActivityRevisionDecision.outcome == "prevalidated",
            )
        )
    if item.kind == "activity_correction":
        return db.scalar(
            select(ActivityRevisionDecision.actor_id)
            .where(
                ActivityRevisionDecision.revision_id == revision.id,
                ActivityRevisionDecision.outcome == "returned",
            )
            .order_by(ActivityRevisionDecision.decided_at.desc())
            .limit(1)
        )
    return None


def _mail_context(
    db: Session,
    auth: AuthService,
    item: ActivityWorkflowNotification,
    activity: Activity,
    revision: ActivityRevision,
    recipient: User,
) -> dict[str, object] | None:
    names = db.execute(
        select(AnnualPTA.name, Project.name)
        .join(Project, Project.id == AnnualPTA.project_id)
        .where(AnnualPTA.id == activity.pta_id)
    ).one_or_none()
    if names is None:
        return None
    actor_id = _actor_id(db, item, revision)
    actor = db.get(User, actor_id) if actor_id else None
    return {
        "recipient_name": recipient.full_name,
        "actor_name": actor.full_name if actor else None,
        "activity_action": _activity_action(revision),
        "activity_reference": activity.reference,
        "activity_name": activity.name,
        "pta_name": names[0],
        "project_name": names[1],
        "action_url": f"{auth.policy.origin}/activities/{activity.id}",
        **({"reason": item.reason} if item.kind == "activity_correction" else {}),
    }


def deliver_workflow_notification(auth: AuthService, identifier: str) -> str | None:
    delivery: tuple[str, str, dict[str, object]] | None = None
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        item = db.get(ActivityWorkflowNotification, identifier, with_for_update=True)
        if (
            not item
            or item.email_status != "unconfirmed"
            or item.email_completed_at is not None
        ):
            return None
        recipient = db.get(User, item.recipient_id)
        activity = db.get(Activity, item.activity_id)
        revision = db.get(ActivityRevision, item.revision_id)
        if recipient and recipient.state == "active" and activity and revision:
            mail_kind = (
                "activity_correction"
                if item.kind == "activity_correction"
                else "activity_review_supervisor"
                if item.stage == "supervisor"
                else "activity_review_validator"
            )
            context = _mail_context(db, auth, item, activity, revision, recipient)
            if context is not None:
                delivery = (recipient.email, mail_kind, context)
        item.email_completed_at = auth.now(db)
        if delivery is None:
            item.email_status = "skipped"
            return "skipped"

    recipient_email, mail_kind, context = delivery
    status, _provider_id = attempt_notification_email(
        auth, recipient_email, mail_kind, context
    )
    with Session(auth.engine) as db, db.begin():
        item = db.get(ActivityWorkflowNotification, identifier, with_for_update=True)
        if not item or item.email_status != "unconfirmed":
            return None
        item.email_status = status
        auth.audit(
            db,
            "activity_notification.email_delivery",
            "system:activity-notification",
            item.id,
            outcome=status,
            details={"email_status": status},
        )
    return status
