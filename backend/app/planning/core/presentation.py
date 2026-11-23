"""Bounded read projections for internal planning tables; no workflow mutations."""

from datetime import datetime
from typing import Any

from sqlalchemy import bindparam, func, select, text
from sqlalchemy.orm import Session

from app.auth.models import User
from app.planning.core.models import (
    Activity,
    ActivityAssignment,
    ActivityContributor,
    ActivityRevision,
    ActivityRevisionDecision,
    Operation,
)
from app.planning.core.service import CONTEXT, visible_activity_condition


def approved_plans(
    db: Session, project_years: list[tuple[str, int]], cutoff: datetime
) -> dict[tuple[str, int], dict[str, int | str]]:
    """Resolve the latest effective approval once per Activity across the page."""
    if not project_years:
        return {}
    rows = db.execute(
        text(
            """
            WITH effective AS (
              SELECT DISTINCT ON (r.activity_id)
                p.project_id, r.activity_id, r.snapshot
              FROM pta_activity_revision r
              JOIN pta_activity_revision_decision d
                ON d.revision_id=r.id AND d.stage='validator' AND d.outcome='approved'
              JOIN pta_activity a ON a.id=r.activity_id
              JOIN pta_annual p ON p.id=a.pta_id
              WHERE p.project_id IN :project_ids AND p.context_id=:context_id
                AND d.decided_at<=:cutoff
              ORDER BY r.activity_id, r.revision_number DESC
            )
            SELECT project_id, (snapshot->'pta'->>'year')::integer AS year,
              count(*) AS activity_count,
              sum((snapshot->>'allocation')::numeric)::text AS allocation
            FROM effective
            WHERE NOT (snapshot ? 'withdrawal')
            GROUP BY project_id, (snapshot->'pta'->>'year')::integer
            """
        ).bindparams(bindparam("project_ids", expanding=True)),
        {
            "project_ids": sorted({project_id for project_id, _year in project_years}),
            "context_id": CONTEXT,
            "cutoff": cutoff,
        },
    ).all()
    totals = {(row.project_id, row.year): row for row in rows}
    return {
        key: {
            "as_of": cutoff.isoformat(),
            "activity_count": int(totals[key].activity_count) if key in totals else 0,
            "allocation": str(totals[key].allocation) if key in totals else "0",
        }
        for key in project_years
    }


def planning_state_counts(
    db: Session, pta_ids: list[str], actor_id: str
) -> dict[str, dict[str, int]]:
    counts: dict[str, dict[str, int]] = {}
    for pta_id, state, count in db.execute(
        select(Activity.pta_id, Activity.state, func.count())
        .where(
            Activity.pta_id.in_(pta_ids),
            Activity.state != "withdrawn",
            visible_activity_condition(actor_id),
        )
        .group_by(Activity.pta_id, Activity.state)
    ):
        counts.setdefault(pta_id, {})[state] = count
    return counts


def planning_summary(
    counts: dict[str, int], allocation: str | int
) -> dict[str, int | str]:
    return {
        "activities": sum(counts.values()),
        "approved": counts.get("approved", 0) + counts.get("closed", 0),
        "review": counts.get("submitted", 0) + counts.get("prevalidated", 0),
        "correction": counts.get("returned_supervisor", 0)
        + counts.get("returned_validator", 0),
        "draft": counts.get("draft", 0) + counts.get("amendment_draft", 0),
        "approved_allocation": str(allocation),
    }


def activity_review_action(
    *,
    role: str,
    state: str,
    activity_id: str,
    revision_id: str | None,
    contributor_ids: set[str],
    prevalidated_revision_ids: set[str],
) -> str | None:
    if activity_id in contributor_ids:
        return None
    if role == "AGENT_VERIFICATEUR" and state == "submitted":
        return "prevalidate"
    if (
        role == "VALIDATEUR_DEFINITIF"
        and state == "prevalidated"
        and revision_id not in prevalidated_revision_ids
    ):
        return "approve"
    return None


def activity_rows(
    db: Session,
    rows: list[Activity],
    *,
    actor_id: str,
    actor_role: str,
) -> list[dict[str, Any]]:
    ids = [row.id for row in rows]
    operations = dict(
        db.execute(
            select(Operation.activity_id, func.count())
            .where(Operation.activity_id.in_(ids), Operation.removed_at.is_(None))
            .group_by(Operation.activity_id)
        ).all()
    )
    names: dict[str, list[str]] = {}
    for activity_id, name, email in db.execute(
        select(ActivityAssignment.activity_id, User.full_name, User.email)
        .join(User, User.id == ActivityAssignment.agent_id)
        .where(
            ActivityAssignment.activity_id.in_(ids),
            ActivityAssignment.ended_at.is_(None),
        )
        .order_by(User.full_name, User.email)
    ):
        names.setdefault(activity_id, []).append(name or email)
    revisions = dict(
        db.execute(
            select(ActivityRevision.id, ActivityRevision.revision_number).where(
                ActivityRevision.id.in_(
                    [row.current_revision_id for row in rows if row.current_revision_id]
                )
            )
        ).all()
    )
    contributor_ids = set(
        db.scalars(
            select(ActivityContributor.activity_id).where(
                ActivityContributor.activity_id.in_(ids),
                ActivityContributor.user_id == actor_id,
                ActivityContributor.kind == "content",
            )
        )
    )
    prevalidated_revision_ids = set(
        db.scalars(
            select(ActivityRevisionDecision.revision_id).where(
                ActivityRevisionDecision.revision_id.in_(
                    [row.current_revision_id for row in rows if row.current_revision_id]
                ),
                ActivityRevisionDecision.stage == "supervisor",
                ActivityRevisionDecision.outcome == "prevalidated",
                ActivityRevisionDecision.actor_id == actor_id,
            )
        )
    )
    return [
        {
            "id": row.id,
            "reference": row.reference,
            "name": row.name,
            "allocation": str(row.allocation) if row.allocation is not None else None,
            "approved_revision_id": row.approved_revision_id,
            "planned_start": (
                row.planned_start.isoformat() if row.planned_start else None
            ),
            "planned_end": (row.planned_end.isoformat() if row.planned_end else None),
            "state": row.state,
            "operation_count": operations.get(row.id, 0),
            "agents": names.get(row.id, []),
            "revision_number": revisions.get(row.current_revision_id or ""),
            "review_action": activity_review_action(
                role=actor_role,
                state=row.state,
                activity_id=row.id,
                revision_id=row.current_revision_id,
                contributor_ids=contributor_ids,
                prevalidated_revision_ids=prevalidated_revision_ids,
            ),
        }
        for row in rows
    ]
