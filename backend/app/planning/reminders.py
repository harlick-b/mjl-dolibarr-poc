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
from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import User
from app.auth.policy import load_policy
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError, AuthService
from app.config import database_url
from app.database import make_engine
from app.planning.models import (
    Activity,
    ActivityAssignment,
    ActivityReminder,
    ActivityRevision,
)
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


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReadInput(Input):
    expected_version: int = Field(gt=0, strict=True)


class ReminderOutput(Input):
    id: str
    activity_id: str
    activity_reference: str
    activity_name: str
    planned_end: str
    due_on: str
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
    """Make the cycle's only mail attempt under the shared lifecycle lock."""
    try:
        with Session(auth.engine) as db, db.begin():
            locked_mutation(db)
            item = db.get(ActivityReminder, reminder_id, with_for_update=True)
            if not item or item.email_status != "unconfirmed":
                return None
            recipient = db.get(User, item.agent_id)
            activity = db.get(Activity, item.activity_id)
            revision = db.get(ActivityRevision, item.approved_revision_id)
            assignment = db.scalar(
                select(ActivityAssignment).where(
                    ActivityAssignment.activity_id == item.activity_id,
                    ActivityAssignment.agent_id == item.agent_id,
                    ActivityAssignment.ended_at.is_(None),
                )
            )
            status = "skipped"
            if (
                recipient is not None
                and recipient.state == "active"
                and recipient.role == "AGENT_SAISIE"
                and activity is not None
                and activity.state not in {"closed", "withdrawn"}
                and activity.approved_revision_id == item.approved_revision_id
                and revision is not None
                and assignment is not None
            ):
                name, _planned_end = _snapshot(revision)
                try:
                    message = (
                        f"{activity.reference} — {name} — échéance "
                        f"{item.planned_end.isoformat()}"
                    )
                    auth.mail.send(recipient.email, "activity_reminder", message)
                    status = "delivered"
                except OSError:
                    status = "failed"
            item.email_status = status
            item.email_completed_at = auth.now(db)
            auth.audit(
                db,
                "reminder.email_delivery",
                "system:pta5",
                item.id,
                outcome=status,
                details={"email_status": status},
            )
            return status
    except Exception:
        # A successful external send must never be repeated when persistence
        # cannot confirm it. The precommitted unconfirmed state is terminal.
        return None


def _output(db: Session, item: ActivityReminder) -> dict[str, Any]:
    activity = db.get(Activity, item.activity_id)
    revision = db.get(ActivityRevision, item.approved_revision_id)
    if not activity or not revision:
        raise AuthError(409, "reminder_source_invalid")
    name, _ = _snapshot(revision)
    return {
        "id": item.id,
        "activity_id": item.activity_id,
        "activity_reference": activity.reference,
        "activity_name": name,
        "planned_end": item.planned_end.isoformat(),
        "due_on": item.due_on.isoformat(),
        "created_at": item.created_at.isoformat(),
        "read_at": item.read_at.isoformat() if item.read_at else None,
        "email_status": item.email_status,
        "version": item.version,
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
        actor = principal(db, auth, evidence(request, auth)[0])
        limit, token, state = args
        cursor = Cursor(auth, "notifications", f"{actor.id}:{state}", limit)
        marker, direction = cursor.decode(token)
        base_conditions = [ActivityReminder.agent_id == actor.id]
        if state == "unread":
            base_conditions.append(ActivityReminder.read_at.is_(None))
        conditions = list(base_conditions)
        if marker:
            try:
                marker_time_raw, marker_id_raw = marker.split("|", 1)
                marker_time = datetime.fromisoformat(marker_time_raw)
                marker_id = str(UUID(marker_id_raw))
            except (ValueError, TypeError):
                raise AuthError(422, "cursor_invalid") from None
            pair = tuple_(ActivityReminder.created_at, ActivityReminder.id)
            conditions.append(
                pair < tuple_(marker_time, marker_id)
                if direction == "next"
                else pair > tuple_(marker_time, marker_id)
            )
        order = (
            (ActivityReminder.created_at.desc(), ActivityReminder.id.desc())
            if direction == "next"
            else (ActivityReminder.created_at.asc(), ActivityReminder.id.asc())
        )
        rows = list(
            db.scalars(
                select(ActivityReminder)
                .where(*conditions)
                .order_by(*order)
                .limit(limit + 1)
            )
        )
        total = (
            db.scalar(
                select(func.count())
                .select_from(ActivityReminder)
                .where(*base_conditions)
            )
            or 0
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: ActivityReminder, move: str) -> str:
            mark = f"{row.created_at.isoformat()}|{row.id}"
            query = urlencode(
                {"limit": limit, "state": state, "cursor": cursor.encode(mark, move)}
            )
            return f"{auth.policy.origin}/api/v1/notifications?{query}"

        return {
            "object": "list",
            "count": total,
            "data": [_output(db, row) for row in rows],
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
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        locked_mutation(db)
        item = db.get(ActivityReminder, identifier, with_for_update=True)
        if not item or item.agent_id != actor.id:
            raise AuthError(404, "notification_not_found")
        if item.version != body.expected_version or item.read_at is not None:
            raise AuthError(409, "version_conflict")
        item.read_at = auth.now(db)
        item.version += 1
        auth.audit(
            db,
            "reminder.read",
            actor.id,
            item.id,
            details={"before_version": body.expected_version, "version": item.version},
        )
        db.flush()
        return _output(db, item)


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
