"""Narrow in-app and email delivery for newly assigned Agents."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.service import AuthService
from app.planning.models import (
    Activity,
    ActivityAssignment,
    ActivityAssignmentNotification,
    AnnualPTA,
    Project,
)
from app.planning.notification_delivery import attempt_notification_email
from app.planning.service import CONTEXT, locked_mutation


def record_assignment_notification(
    db: Session,
    auth: AuthService,
    assignment: ActivityAssignment,
) -> str:
    item = ActivityAssignmentNotification(
        context_id=CONTEXT,
        activity_id=assignment.activity_id,
        assignment_id=assignment.id,
        agent_id=assignment.agent_id,
        assigned_by_id=assignment.assigned_by_id,
        created_at=assignment.assigned_at,
        read_at=None,
        email_status="unconfirmed",
        email_completed_at=None,
        version=1,
    )
    db.add(item)
    db.flush()
    auth.audit(
        db,
        "assignment_notification.created",
        assignment.assigned_by_id,
        item.id,
        details={
            "activity_id": assignment.activity_id,
            "agent_id": assignment.agent_id,
        },
    )
    return item.id


def deliver_assignment_notification(auth: AuthService, identifier: str) -> str | None:
    delivery: tuple[str, dict[str, object]] | None = None
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        item = db.get(ActivityAssignmentNotification, identifier, with_for_update=True)
        if (
            not item
            or item.email_status != "unconfirmed"
            or item.email_completed_at is not None
        ):
            return None
        recipient = db.get(User, item.agent_id)
        assigner = db.get(User, item.assigned_by_id)
        activity = db.get(Activity, item.activity_id)
        assignment = db.get(ActivityAssignment, item.assignment_id)
        context = (
            db.execute(
                select(AnnualPTA.name, Project.name)
                .join(Project, Project.id == AnnualPTA.project_id)
                .where(AnnualPTA.id == activity.pta_id)
            ).one_or_none()
            if activity
            else None
        )
        if (
            recipient
            and recipient.state == "active"
            and recipient.role == "AGENT_SAISIE"
            and assigner
            and activity
            and assignment
            and context
        ):
            delivery = (
                recipient.email,
                {
                    "recipient_name": recipient.full_name,
                    "activity_reference": activity.reference,
                    "activity_name": activity.name,
                    "pta_name": context[0],
                    "project_name": context[1],
                    "assigner_name": assigner.full_name or assigner.email,
                },
            )
        item.email_completed_at = auth.now(db)
        if delivery is None:
            item.email_status = "skipped"
            auth.audit(
                db,
                "assignment_notification.email_delivery",
                "system:assignment",
                item.id,
                outcome="skipped",
                details={"email_status": "skipped"},
            )
            return "skipped"

    recipient_email, mail_context = delivery
    status, _provider_id = attempt_notification_email(
        auth, recipient_email, "activity_assignment", mail_context
    )
    with Session(auth.engine) as db, db.begin():
        item = db.get(ActivityAssignmentNotification, identifier, with_for_update=True)
        if not item or item.email_status != "unconfirmed":
            return None
        item.email_status = status
        auth.audit(
            db,
            "assignment_notification.email_delivery",
            "system:assignment",
            item.id,
            outcome=status,
            details={"email_status": status},
        )
    return status
