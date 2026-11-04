"""Funding obligations from immutable revisions and spending history."""

from typing import cast

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.auth.models import Audit
from app.auth.service import AuthError
from app.planning.models import (
    Activity,
    ActivityRevision,
    ActivityRevisionDecision,
    FundingRequest,
)


def approved_revisions(db: Session, item: Activity) -> list[ActivityRevision]:
    return list(
        db.scalars(
            select(ActivityRevision)
            .join(
                ActivityRevisionDecision,
                ActivityRevisionDecision.revision_id == ActivityRevision.id,
            )
            .where(
                ActivityRevision.activity_id == item.id,
                ActivityRevisionDecision.stage == "validator",
                ActivityRevisionDecision.outcome == "approved",
                ~ActivityRevision.snapshot.has_key("withdrawal"),
            )
            .order_by(ActivityRevision.revision_number)
        )
    )


def increments(revisions: list[ActivityRevision]) -> list[dict[str, str]]:
    result = []
    for old, new in zip(revisions, revisions[1:], strict=False):
        old_amount = int(cast(str, old.snapshot["allocation"]))
        new_amount = int(cast(str, new.snapshot["allocation"]))
        if new_amount > old_amount:
            result.append(
                {
                    "base_revision_id": old.id,
                    "approved_revision_id": new.id,
                    "old_allocation": str(old_amount),
                    "new_allocation": str(new_amount),
                    "amount": str(new_amount - old_amount),
                }
            )
    return result


def funding_basis(db: Session, item: Activity) -> tuple[list[dict[str, str]], bool]:
    revisions = approved_revisions(db, item)
    if not revisions:
        return [], False
    funded = set(
        db.scalars(
            select(FundingRequest.approved_revision_id).where(
                FundingRequest.activity_id == item.id,
                FundingRequest.state == "approved",
            )
        )
    )
    changes = increments(revisions)
    pending = [
        change for change in changes if change["approved_revision_id"] not in funded
    ]
    positions = {row.id: i for i, row in enumerate(revisions)}
    allocations = {
        row.id: int(cast(str, row.snapshot["allocation"])) for row in revisions
    }
    covers = [
        (positions[c["approved_revision_id"]], int(c["new_allocation"]))
        for c in changes
        if c["approved_revision_id"] in funded
    ]
    # Read original events: a later correction must not erase a genuine shortfall.
    events = db.scalars(
        select(Audit)
        .where(
            or_(
                and_(
                    Audit.target == item.id,
                    Audit.action.in_(["activity.approve", "activity.transfer_approve"]),
                ),
                and_(
                    Audit.business["activity_id"].as_string() == item.id,
                    Audit.action.in_(
                        [
                            "operation.execution_recorded",
                            "operation.execution_corrected",
                        ]
                    ),
                ),
            )
        )
        .order_by(Audit.id)
    )
    amounts: dict[str, int] = {}
    current: str | None = None
    audited = []
    unresolved = False
    for event in events:
        facts = event.business
        if not isinstance(facts, dict):
            raise AuthError(409, "execution_history_unverified")
        if event.action.startswith("activity."):
            revision = facts.get("revision")
            if not isinstance(revision, dict) or revision.get("id") not in positions:
                raise AuthError(409, "execution_history_unverified")
            current = cast(str, revision["id"])
            audited.append(current)
        else:
            after = facts.get("after")
            operation = facts.get("operation_id")
            if (
                not isinstance(after, dict)
                or not isinstance(operation, str)
                or current != facts.get("approved_revision_id")
            ):
                raise AuthError(409, "execution_history_unverified")
            raw = after.get("actual_spent")
            if raw is not None and (
                not isinstance(raw, str) or not raw.isascii() or not raw.isdecimal()
            ):
                raise AuthError(409, "execution_history_unverified")
            amounts[operation] = int(raw) if isinstance(raw, str) else 0
        spent = sum(amounts.values())
        if (
            current is not None
            and spent > allocations[current]
            and not any(
                position > positions[current] and allocation >= spent
                for position, allocation in covers
            )
        ):
            unresolved = True
    if audited != [row.id for row in revisions]:
        raise AuthError(409, "execution_history_unverified")
    return pending, unresolved


def funding_reason(db: Session, item: Activity) -> str | None:
    pending, unresolved = funding_basis(db, item)
    return "funding_required" if pending or unresolved else None
