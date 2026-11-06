"""Filter public business-history facts before cursor pagination."""

import hashlib
import json
from collections.abc import Sequence
from datetime import date, datetime, time, timedelta
from typing import Annotated
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import Query
from sqlalchemy import and_, or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.auth.models import Audit, User
from app.auth.service import AuthError
from app.planning.models import Activity, Partner, Project
from app.planning.service import CONTEXT


def history_filters(
    q: Annotated[str, Query(max_length=200)] = "",
    action: Annotated[str, Query(max_length=48)] = "",
    actor: UUID | None = None,
    activity: UUID | None = None,
    project: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> dict[str, str]:
    if date_from and date_to and date_from > date_to:
        raise AuthError(422, "input_invalid")
    return {
        key: str(value).strip()
        for key, value in locals().items()
        if value is not None and str(value).strip()
    }


def filter_scope(filters: dict[str, str]) -> str:
    return (
        CONTEXT
        + ":"
        + hashlib.sha256(json.dumps(filters, sort_keys=True).encode()).hexdigest()
    )


def activity_match() -> ColumnElement[bool]:
    return or_(
        Audit.business["activity_id"].astext == Activity.id,
        Audit.details["activity_id"].astext == Activity.id,
        and_(Audit.action.startswith("activity."), Audit.target == Activity.id),
    )


def history_conditions(
    filters: dict[str, str], labels: dict[str, str], actions: Sequence[str]
) -> list[ColumnElement[bool]]:
    conditions: list[ColumnElement[bool]] = [Audit.action.in_(actions)]
    if filters.get("action"):
        if filters["action"] not in actions:
            raise AuthError(422, "input_invalid")
        conditions.append(Audit.action == filters["action"])
    if filters.get("actor"):
        conditions.append(Audit.actor == filters["actor"])
    if filters.get("activity") or filters.get("project"):
        activity_conditions = [activity_match(), Activity.context_id == CONTEXT]
        if filters.get("activity"):
            activity_conditions.append(Activity.id == filters["activity"])
        if filters.get("project"):
            activity_conditions.append(
                Activity.request_project_id == filters["project"]
            )
        linked_activity = select(Activity.id).where(*activity_conditions).exists()
        conditions.append(
            or_(
                and_(
                    Audit.action.startswith("project."),
                    Audit.target == filters["project"],
                ),
                linked_activity,
            )
            if filters.get("project") and not filters.get("activity")
            else linked_activity
        )
    if filters.get("q"):
        query = filters["q"]
        matches: list[ColumnElement[bool]] = [
            Audit.action.in_(
                [
                    key
                    for key, label in labels.items()
                    if query.casefold() in label.casefold()
                ]
            )
        ]
        matches.append(
            select(User.id)
            .where(
                or_(User.id == Audit.actor, User.id == Audit.target),
                or_(
                    User.full_name.icontains(query, autoescape=True),
                    User.email.icontains(query, autoescape=True),
                ),
            )
            .exists()
        )
        matches.append(
            select(Activity.id)
            .where(
                activity_match(),
                Activity.context_id == CONTEXT,
                or_(
                    Activity.name.icontains(query, autoescape=True),
                    Activity.reference.icontains(query, autoescape=True),
                ),
            )
            .exists()
        )
        for model in (Project, Partner):
            matches.append(
                select(model.id)
                .where(
                    model.id == Audit.target,
                    model.context_id == CONTEXT,
                    model.name.icontains(query, autoescape=True),
                )
                .exists()
            )
        conditions.append(or_(*matches))
    zone = ZoneInfo("Africa/Porto-Novo")
    if filters.get("date_from"):
        conditions.append(
            Audit.occurred_at
            >= datetime.combine(
                date.fromisoformat(filters["date_from"]), time.min, zone
            )
        )
    if filters.get("date_to"):
        end = date.fromisoformat(filters["date_to"])
        if end == date.max:
            raise AuthError(422, "input_invalid")
        conditions.append(
            Audit.occurred_at
            < datetime.combine(end + timedelta(days=1), time.min, zone)
        )
    return conditions
