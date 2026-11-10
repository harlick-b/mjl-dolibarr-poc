"""Focused PTA-5 reminder dispatcher and recipient API."""

from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta
from typing import Annotated, Any, Literal
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, text, tuple_
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import User
from app.auth.policy import load_policy
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError, AuthService
from app.core.config import database_url
from app.core.database import make_engine
from app.planning.financial_notifications import REQUEST_MODELS
from app.planning.models import (
    Activity,
    ActivityAssignment,
    ActivityAssignmentNotification,
    ActivityReminder,
    ActivityRevision,
    ActivityWorkflowNotification,
    AnnualPTA,
    FinancialWorkflowNotification,
    Project,
)
from app.planning.notification_delivery import attempt_notification_email
from app.planning.service import CONTEXT, Cursor, locked_mutation, principal

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA reminders"],
    dependencies=[
        Depends(APIKeyCookie(name="mjl_local", auto_error=False)),
        Depends(APIKeyCookie(name="__Host-mjl", auto_error=False)),
    ],
    responses={
        status: {"model": ErrorResponse}
        for status in (401, 403, 404, 409, 422, 429, 503)
    },
)

FRENCH_MONTHS = (
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
)


def french_date(value: date) -> str:
    return f"{value.day} {FRENCH_MONTHS[value.month - 1]} {value.year}"


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReadInput(Input):
    expected_version: int = Field(gt=0, strict=True)


class ReminderOutput(Input):
    kind: Literal[
        "deadline",
        "assignment",
        "activity_review",
        "activity_correction",
        "activity_approved",
        "financial_review",
        "financial_correction",
        "financial_approved",
    ]
    id: str
    activity_id: str
    activity_reference: str
    activity_name: str
    pta_year: int
    planned_end: str | None
    due_on: str | None
    pta_name: str | None = None
    project_name: str | None = None
    assigned_by: str | None = None
    stage: str | None = None
    reason: str | None = None
    handled_at: str | None = None
    request_kind: str | None = None
    request_id: str | None = None
    created_at: str
    read_at: str | None
    email_status: str
    version: int


class ListOutput(Input):
    object: Literal["list"]
    count: int
    data: list[ReminderOutput]
    next: str | None
    previous: str | None


def _snapshot(revision: ActivityRevision) -> tuple[str, date]:
    name = revision.snapshot.get("name")
    raw_end = revision.snapshot.get("planned_end")
    if not isinstance(name, str) or not isinstance(raw_end, str):
        raise AuthError(409, "reminder_source_invalid")
    try:
        planned_end = date.fromisoformat(raw_end)
    except ValueError:
        raise AuthError(409, "reminder_source_invalid") from None
    return name, planned_end


def dispatch_due_reminders(auth: AuthService, today: date) -> int:
    """Create current cycles, then make each new cycle's only email attempt."""
    created_ids: list[str] = []
    with Session(auth.engine) as db, db.begin():
        auth.environment_verified(db)
        locked_mutation(db)
        rows = db.execute(
            select(Activity, ActivityRevision, ActivityAssignment, User)
            .join(
                ActivityRevision,
                ActivityRevision.id == Activity.approved_revision_id,
            )
            .join(
                ActivityAssignment,
                (ActivityAssignment.activity_id == Activity.id)
                & ActivityAssignment.ended_at.is_(None),
            )
            .join(User, User.id == ActivityAssignment.agent_id)
            .where(
                Activity.context_id == CONTEXT,
                Activity.state.not_in({"closed", "withdrawn"}),
                User.role == "AGENT_SAISIE",
                User.state == "active",
            )
        )
        now = auth.now(db)
        for activity, revision, assignment, _user in rows:
            _name, planned_end = _snapshot(revision)
            due_on = planned_end - timedelta(days=21)
            if not due_on <= today <= planned_end:
                continue
            exists = db.scalar(
                select(ActivityReminder.id).where(
                    ActivityReminder.activity_id == activity.id,
                    ActivityReminder.agent_id == assignment.agent_id,
                    ActivityReminder.planned_end == planned_end,
                )
            )
            if exists:
                continue
            reminder = ActivityReminder(
                context_id=CONTEXT,
                activity_id=activity.id,
                approved_revision_id=revision.id,
                agent_id=assignment.agent_id,
                planned_end=planned_end,
                due_on=due_on,
                created_at=now,
                read_at=None,
                email_status="unconfirmed",
                email_completed_at=None,
                version=1,
            )
            db.add(reminder)
            db.flush()
            auth.audit(
                db,
                "reminder.created",
                "system:pta5",
                reminder.id,
                details={
                    "activity_id": activity.id,
                    "agent_id": assignment.agent_id,
                    "planned_end": planned_end.isoformat(),
                },
            )
            created_ids.append(reminder.id)

    for reminder_id in created_ids:
        deliver_reminder(auth, reminder_id)
    return len(created_ids)


def deliver_reminder(auth: AuthService, reminder_id: str) -> str | None:
    """Claim once under the lifecycle lock, then send outside transactions."""
    try:
        delivery: tuple[str, dict[str, object]] | None = None
        with Session(auth.engine) as db, db.begin():
            locked_mutation(db)
            item = db.get(ActivityReminder, reminder_id, with_for_update=True)
            if (
                not item
                or item.email_status != "unconfirmed"
                or item.email_completed_at is not None
            ):
                return None
            recipient = db.get(User, item.agent_id)
            activity = db.get(Activity, item.activity_id)
            revision = (
                db.get(ActivityRevision, activity.approved_revision_id)
                if activity and activity.approved_revision_id
                else None
            )
            assignment = db.scalar(
                select(ActivityAssignment).where(
                    ActivityAssignment.activity_id == item.activity_id,
                    ActivityAssignment.agent_id == item.agent_id,
                    ActivityAssignment.ended_at.is_(None),
                )
            )
            if (
                recipient is not None
                and recipient.state == "active"
                and recipient.role == "AGENT_SAISIE"
                and activity is not None
                and activity.state not in {"closed", "withdrawn"}
                and revision is not None
                and assignment is not None
            ):
                name, planned_end = _snapshot(revision)
                if planned_end == item.planned_end:
                    delivery = (
                        recipient.email,
                        {
                            "recipient_name": recipient.full_name,
                            "activity_reference": activity.reference,
                            "activity_name": name,
                            "activity_end_date": french_date(item.planned_end),
                        },
                    )
            item.email_completed_at = auth.now(db)
            if delivery is None:
                item.email_status = "skipped"
                auth.audit(
                    db,
                    "reminder.email_delivery",
                    "system:pta5",
                    item.id,
                    outcome="skipped",
                    details={"email_status": "skipped"},
                )
                return "skipped"

        recipient_email, context = delivery
        status, provider_message_id = attempt_notification_email(
            auth, recipient_email, "activity_reminder", context
        )

        with Session(auth.engine) as db, db.begin():
            item = db.get(ActivityReminder, reminder_id, with_for_update=True)
            if (
                not item
                or item.email_status != "unconfirmed"
                or item.email_completed_at is None
            ):
                return None
            item.email_status = status
            auth.audit(
                db,
                "reminder.email_delivery",
                "system:pta5",
                item.id,
                outcome=status,
                details={
                    "email_status": status,
                    **(
                        {"provider_message_id": provider_message_id}
                        if provider_message_id is not None
                        else {}
                    ),
                },
            )
        return status
    except Exception:
        # The precommitted completion timestamp makes an unknown outcome terminal.
        return None


def _reminder_outputs(
    db: Session, items: list[ActivityReminder]
) -> dict[str, dict[str, Any]]:
    if not items:
        return {}
    contexts = {
        row.notification_id: row
        for row in db.execute(
            select(
                ActivityReminder.id.label("notification_id"),
                Activity.reference.label("activity_reference"),
                Activity.placement_year.label("pta_year"),
                ActivityRevision.snapshot.label("revision_snapshot"),
            )
            .select_from(ActivityReminder)
            .join(Activity, Activity.id == ActivityReminder.activity_id)
            .join(
                ActivityRevision,
                ActivityRevision.id == ActivityReminder.approved_revision_id,
            )
            .where(ActivityReminder.id.in_([item.id for item in items]))
        )
    }
    if len(contexts) != len(items):
        raise AuthError(409, "reminder_source_invalid")
    names: dict[str, str] = {}
    for notification_id, context in contexts.items():
        snapshot = context.revision_snapshot
        name = snapshot.get("name") if isinstance(snapshot, dict) else None
        if not isinstance(name, str):
            raise AuthError(409, "reminder_source_invalid")
        names[notification_id] = name
    return {
        item.id: {
            "kind": "deadline",
            "id": item.id,
            "activity_id": item.activity_id,
            "activity_reference": contexts[item.id].activity_reference,
            "activity_name": names[item.id],
            "pta_year": contexts[item.id].pta_year,
            "planned_end": item.planned_end.isoformat(),
            "due_on": item.due_on.isoformat(),
            "created_at": item.created_at.isoformat(),
            "read_at": item.read_at.isoformat() if item.read_at else None,
            "email_status": item.email_status,
            "version": item.version,
        }
        for item in items
    }


def _assignment_outputs(
    db: Session, items: list[ActivityAssignmentNotification]
) -> dict[str, dict[str, Any]]:
    if not items:
        return {}
    contexts = {
        row.notification_id: row
        for row in db.execute(
            select(
                ActivityAssignmentNotification.id.label("notification_id"),
                Activity.reference.label("activity_reference"),
                Activity.name.label("activity_name"),
                Activity.placement_year.label("pta_year"),
                User.full_name.label("assigner_name"),
                User.email.label("assigner_email"),
                AnnualPTA.name.label("pta_name"),
                Project.name.label("project_name"),
            )
            .select_from(ActivityAssignmentNotification)
            .join(Activity, Activity.id == ActivityAssignmentNotification.activity_id)
            .join(User, User.id == ActivityAssignmentNotification.assigned_by_id)
            .join(AnnualPTA, AnnualPTA.id == Activity.pta_id)
            .join(Project, Project.id == AnnualPTA.project_id)
            .where(ActivityAssignmentNotification.id.in_([item.id for item in items]))
        )
    }
    if len(contexts) != len(items):
        raise AuthError(409, "notification_source_invalid")
    return {
        item.id: {
            "kind": "assignment",
            "id": item.id,
            "activity_id": item.activity_id,
            "activity_reference": contexts[item.id].activity_reference,
            "activity_name": contexts[item.id].activity_name,
            "pta_year": contexts[item.id].pta_year,
            "planned_end": None,
            "due_on": None,
            "pta_name": contexts[item.id].pta_name,
            "project_name": contexts[item.id].project_name,
            "assigned_by": contexts[item.id].assigner_name
            or contexts[item.id].assigner_email,
            "created_at": item.created_at.isoformat(),
            "read_at": item.read_at.isoformat() if item.read_at else None,
            "email_status": item.email_status,
            "version": item.version,
        }
        for item in items
    }


def _workflow_outputs(
    db: Session, items: list[ActivityWorkflowNotification]
) -> dict[str, dict[str, Any]]:
    if not items:
        return {}
    activities = {
        row.id: row
        for row in db.scalars(
            select(Activity).where(
                Activity.id.in_({item.activity_id for item in items})
            )
        )
    }
    if any(item.activity_id not in activities for item in items):
        raise AuthError(409, "notification_source_invalid")
    return {
        item.id: {
            "kind": item.kind,
            "id": item.id,
            "activity_id": item.activity_id,
            "activity_reference": activities[item.activity_id].reference,
            "activity_name": activities[item.activity_id].name,
            "pta_year": activities[item.activity_id].placement_year,
            "planned_end": None,
            "due_on": None,
            "stage": item.stage,
            "reason": item.reason,
            "handled_at": item.handled_at.isoformat() if item.handled_at else None,
            "created_at": item.created_at.isoformat(),
            "read_at": item.read_at.isoformat() if item.read_at else None,
            "email_status": item.email_status,
            "version": item.version,
        }
        for item in items
    }


def _financial_outputs(
    db: Session, items: list[FinancialWorkflowNotification]
) -> dict[str, dict[str, Any]]:
    if not items:
        return {}
    activities = {
        row.id: row
        for row in db.scalars(
            select(Activity).where(
                Activity.id.in_({item.activity_id for item in items})
            )
        )
    }
    if any(item.activity_id not in activities for item in items):
        raise AuthError(409, "notification_source_invalid")
    source_activities: dict[tuple[str, str], str] = {}
    for kind, model in REQUEST_MODELS.items():
        request_ids = {item.request_id for item in items if item.request_kind == kind}
        if request_ids:
            source_activities.update(
                ((kind, row.id), row.activity_id)
                for row in db.execute(
                    select(model.id, model.activity_id).where(model.id.in_(request_ids))
                )
            )
    for item in items:
        if (
            source_activities.get((item.request_kind, item.request_id))
            != item.activity_id
        ):
            raise AuthError(409, "notification_source_invalid")
    return {
        item.id: {
            "kind": item.kind,
            "id": item.id,
            "activity_id": item.activity_id,
            "activity_reference": activities[item.activity_id].reference,
            "activity_name": activities[item.activity_id].name,
            "pta_year": activities[item.activity_id].placement_year,
            "planned_end": None,
            "due_on": None,
            "stage": item.stage,
            "reason": item.reason,
            "handled_at": item.handled_at.isoformat() if item.handled_at else None,
            "request_kind": item.request_kind,
            "request_id": item.request_id,
            "created_at": item.created_at.isoformat(),
            "read_at": item.read_at.isoformat() if item.read_at else None,
            "email_status": item.email_status,
            "version": item.version,
        }
        for item in items
    }


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60,
    cursor: str | None = None,
    state: Literal["all", "unread"] = "all",
) -> tuple[int, str | None, str]:
    return limit, cursor, state


@router.get("/notifications", response_model=ListOutput)
def listing(
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None, str], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        db.execute(text("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ"))
        actor = principal(db, auth, evidence(request, auth)[0])
        limit, token, state = args
        cursor = Cursor(auth, "notifications", f"{actor.id}:{state}", limit)
        marker, direction = cursor.decode(token)
        marker_time: datetime | None = None
        marker_id: str | None = None
        if marker:
            try:
                marker_time_raw, marker_id_raw = marker.split("|", 1)
                marker_time = datetime.fromisoformat(marker_time_raw)
                marker_id = str(UUID(marker_id_raw))
            except (ValueError, TypeError):
                raise AuthError(422, "cursor_invalid") from None
        rows: list[
            ActivityReminder
            | ActivityAssignmentNotification
            | ActivityWorkflowNotification
            | FinancialWorkflowNotification
        ] = []
        total = 0
        for model, recipient_column in (
            (ActivityReminder, ActivityReminder.agent_id),
            (ActivityAssignmentNotification, ActivityAssignmentNotification.agent_id),
            (ActivityWorkflowNotification, ActivityWorkflowNotification.recipient_id),
            (
                FinancialWorkflowNotification,
                FinancialWorkflowNotification.recipient_id,
            ),
        ):
            base_conditions = [recipient_column == actor.id]
            if state == "unread":
                base_conditions.append(model.read_at.is_(None))
            conditions = list(base_conditions)
            if marker_time and marker_id:
                pair = tuple_(model.created_at, model.id)
                conditions.append(
                    pair < tuple_(marker_time, marker_id)
                    if direction == "next"
                    else pair > tuple_(marker_time, marker_id)
                )
            order = (
                (model.created_at.desc(), model.id.desc())
                if direction == "next"
                else (model.created_at.asc(), model.id.asc())
            )
            rows.extend(
                db.scalars(
                    select(model).where(*conditions).order_by(*order).limit(limit + 1)
                )
            )
            total += int(
                db.scalar(
                    select(func.count()).select_from(model).where(*base_conditions)
                )
                or 0
            )
        rows.sort(
            key=lambda item: (item.created_at, item.id),
            reverse=direction == "next",
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(
            row: ActivityReminder
            | ActivityAssignmentNotification
            | ActivityWorkflowNotification
            | FinancialWorkflowNotification,
            move: str,
        ) -> str:
            mark = f"{row.created_at.isoformat()}|{row.id}"
            query = urlencode(
                {"limit": limit, "state": state, "cursor": cursor.encode(mark, move)}
            )
            return f"{auth.policy.origin}/api/v1/notifications?{query}"

        assignment_outputs = _assignment_outputs(
            db,
            [row for row in rows if isinstance(row, ActivityAssignmentNotification)],
        )
        workflow_outputs = _workflow_outputs(
            db,
            [row for row in rows if isinstance(row, ActivityWorkflowNotification)],
        )
        financial_outputs = _financial_outputs(
            db,
            [row for row in rows if isinstance(row, FinancialWorkflowNotification)],
        )
        reminder_outputs = _reminder_outputs(
            db, [row for row in rows if isinstance(row, ActivityReminder)]
        )
        return {
            "object": "list",
            "count": total,
            "data": [
                reminder_outputs[row.id]
                if isinstance(row, ActivityReminder)
                else assignment_outputs[row.id]
                if isinstance(row, ActivityAssignmentNotification)
                else workflow_outputs[row.id]
                if isinstance(row, ActivityWorkflowNotification)
                else financial_outputs[row.id]
                for row in rows
            ],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }


@router.patch("/notifications/{identifier}", response_model=ReminderOutput)
def mark_read(
    identifier: str, body: ReadInput, request: Request, auth: Auth
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(db, auth, *evidence(request, auth), mutation=True)
        item: (
            ActivityReminder
            | ActivityAssignmentNotification
            | ActivityWorkflowNotification
            | FinancialWorkflowNotification
            | None
        ) = db.get(ActivityReminder, identifier, with_for_update=True)
        if item is None:
            item = db.get(
                ActivityAssignmentNotification, identifier, with_for_update=True
            )
        if item is None:
            item = db.get(
                ActivityWorkflowNotification, identifier, with_for_update=True
            )
        if item is None:
            item = db.get(
                FinancialWorkflowNotification, identifier, with_for_update=True
            )
        recipient_id = (
            item.recipient_id
            if isinstance(
                item, (ActivityWorkflowNotification, FinancialWorkflowNotification)
            )
            else item.agent_id
            if item
            else None
        )
        if not item or recipient_id != actor.id:
            raise AuthError(404, "notification_not_found")
        if item.read_at is not None:
            return (
                _financial_outputs(db, [item])[item.id]
                if isinstance(item, FinancialWorkflowNotification)
                else _workflow_outputs(db, [item])[item.id]
                if isinstance(item, ActivityWorkflowNotification)
                else _reminder_outputs(db, [item])[item.id]
                if isinstance(item, ActivityReminder)
                else _assignment_outputs(db, [item])[item.id]
            )
        if item.version != body.expected_version:
            raise AuthError(409, "version_conflict")
        item.read_at = auth.now(db)
        item.version += 1
        auth.audit(
            db,
            "notification.read",
            actor.id,
            item.id,
            details={"before_version": body.expected_version, "version": item.version},
        )
        db.flush()
        return (
            _reminder_outputs(db, [item])[item.id]
            if isinstance(item, ActivityReminder)
            else _assignment_outputs(db, [item])[item.id]
            if isinstance(item, ActivityAssignmentNotification)
            else _workflow_outputs(db, [item])[item.id]
            if isinstance(item, ActivityWorkflowNotification)
            else _financial_outputs(db, [item])[item.id]
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--today", type=date.fromisoformat, default=date.today())
    args = parser.parse_args()
    url = database_url()
    policy = load_policy(url)
    if not policy:
        parser.exit(1, "Reminder dispatch refused.\n")
    engine = make_engine(url)
    try:
        count = dispatch_due_reminders(AuthService(engine, policy), args.today)
    finally:
        engine.dispose()
    print(f"{count} reminder cycle(s) created.")


if __name__ == "__main__":
    main()
