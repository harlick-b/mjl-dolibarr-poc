from datetime import date
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import distinct_on
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.service import AuthError
from app.planning.models import (
    Activity,
    ActivityAssignment,
    ActivityContributor,
    ActivityRevision,
    ActivityRevisionDecision,
    AnnualPTA,
    DisbursementDecision,
    DisbursementRequest,
    FundingDecision,
    FundingRequest,
    Operation,
    ReversementDeclaration,
    VirementConfirmation,
    VirementDecision,
    VirementRequest,
    ZeroSpendingDecision,
    ZeroSpendingDeclaration,
)
from app.planning.service import allowed


def dashboard_finance_data(
    db: Session, pta: AnnualPTA, metrics: dict[str, Any]
) -> dict[str, Any]:
    activities = list(
        db.execute(
            select(Activity.id, Activity.approved_revision_id).where(
                Activity.pta_id == pta.id,
                Activity.approved_revision_id.is_not(None),
                Activity.state != "withdrawn",
            )
        )
    )
    activity_ids = {row.id for row in activities}
    revision_ids = {
        cast(str, row.approved_revision_id)
        for row in activities
        if row.approved_revision_id
    }
    revisions = list(
        db.scalars(
            select(ActivityRevision).where(ActivityRevision.id.in_(revision_ids))
        )
    )
    approved_operation_ids = {
        cast(str, fact["id"])
        for revision in revisions
        for fact in cast(list[dict[str, object]], revision.snapshot["operations"])
    }
    operations = list(
        db.execute(
            select(Operation.id, Operation.actual_spent).where(
                Operation.activity_id.in_(activity_ids),
                Operation.id.in_(approved_operation_ids),
                Operation.removed_at.is_(None),
            )
        )
    )
    known = [row.actual_spent for row in operations if row.actual_spent is not None]

    confirmations = {
        row.activity_id: row
        for row in db.scalars(
            select(VirementConfirmation)
            .where(VirementConfirmation.activity_id.in_(activity_ids))
            .ext(distinct_on(VirementConfirmation.activity_id))
            .order_by(
                VirementConfirmation.activity_id,
                VirementConfirmation.revision.desc(),
            )
        )
    }
    declarations = {
        row.activity_id: row
        for row in db.scalars(
            select(ReversementDeclaration)
            .where(ReversementDeclaration.activity_id.in_(activity_ids))
            .ext(distinct_on(ReversementDeclaration.activity_id))
            .order_by(
                ReversementDeclaration.activity_id,
                ReversementDeclaration.revision.desc(),
            )
        )
    }
    allocations = {
        revision.activity_id: int(cast(str, revision.snapshot["allocation"]))
        for revision in revisions
    }
    required_total = 0
    declared_total = 0
    has_confirmed_basis = False
    has_confirmed_return = False
    for activity_id, confirmation in confirmations.items():
        has_confirmed_basis = True
        required = allocations[activity_id] - confirmation.amount
        if required < 0:
            raise AuthError(409, "financial_basis_stale")
        if required == 0:
            continue
        required_total += required
        declaration = declarations.get(activity_id)
        if (
            declaration
            and declaration.confirmation_id == confirmation.id
            and declaration.amount == required
        ):
            declared_total += declaration.amount
            has_confirmed_return = True

    return {
        "approved_allocation": metrics["financial"]["approved_allocation"],
        "recorded_spending": str(sum(known)) if known else None,
        "recorded_operations": len(known),
        "approved_operations": len(approved_operation_ids),
        "closed_spending": metrics["financial"]["closed_spending"],
        "reversement_due": (
            str(required_total - declared_total) if has_confirmed_basis else None
        ),
        "reversement_confirmed": (
            str(declared_total) if has_confirmed_return else None
        ),
    }


def dashboard_attention_data(
    db: Session, pta: AnnualPTA, actor: User
) -> dict[str, Any]:
    activities = {
        item.id: item
        for item in db.scalars(
            select(Activity).where(
                Activity.pta_id == pta.id,
                Activity.state.not_in(("withdrawn", "closed")),
            )
        )
    }
    if not activities:
        return {"count": 0, "items": []}
    activity_ids = set(activities)
    assigned = set(
        db.scalars(
            select(ActivityAssignment.activity_id).where(
                ActivityAssignment.activity_id.in_(activity_ids),
                ActivityAssignment.agent_id == actor.id,
                ActivityAssignment.ended_at.is_(None),
            )
        )
    )
    ranked: list[tuple[int, date, str, dict[str, str]]] = []

    def add(
        item: Activity,
        *,
        priority: int,
        reason: str,
        action: str,
        destination: str,
    ) -> None:
        ranked.append(
            (
                priority,
                item.planned_end or item.planned_start or date.max,
                item.id,
                {
                    "activity_id": item.id,
                    "reference": item.reference,
                    "name": item.name,
                    "reason": reason,
                    "action": action,
                    "destination": destination,
                },
            )
        )

    if actor.role == "AGENT_SAISIE":
        for item in activities.values():
            if (
                item.id in assigned
                and item.withdrawal_id is None
                and item.transfer_id is None
                and item.state
                in {
                    "draft",
                    "amendment_draft",
                    "returned_supervisor",
                    "returned_validator",
                }
            ):
                add(
                    item,
                    priority=0,
                    reason=(
                        "correction_requested"
                        if item.state.startswith("returned_")
                        else "draft_to_complete"
                    ),
                    action="review_planning",
                    destination="planning",
                )
        _add_reversement_attention(db, activities, assigned, add)
    else:
        _add_planning_reviews(db, activities, actor, add)
        _add_financial_reviews(db, activities, actor, add)

    selected: list[dict[str, str]] = []
    seen: set[str] = set()
    for _priority, _end, activity_id, payload in sorted(ranked):
        if activity_id in seen:
            continue
        seen.add(activity_id)
        selected.append(payload)
    return {"count": len(selected), "items": selected[:3]}


def _add_planning_reviews(
    db: Session,
    activities: dict[str, Activity],
    actor: User,
    add: Any,
) -> None:
    target_state = "submitted" if actor.role == "AGENT_VERIFICATEUR" else "prevalidated"
    candidates = [item for item in activities.values() if item.state == target_state]
    if not candidates:
        return
    candidate_ids = {item.id for item in candidates}
    contributed = set(
        db.scalars(
            select(ActivityContributor.activity_id).where(
                ActivityContributor.activity_id.in_(candidate_ids),
                ActivityContributor.user_id == actor.id,
                ActivityContributor.kind == "content",
            )
        )
    )
    prevalidated = set(
        db.scalars(
            select(ActivityRevisionDecision.revision_id).where(
                ActivityRevisionDecision.revision_id.in_(
                    [item.current_revision_id for item in candidates]
                ),
                ActivityRevisionDecision.stage == "supervisor",
                ActivityRevisionDecision.outcome == "prevalidated",
                ActivityRevisionDecision.actor_id == actor.id,
            )
        )
    )
    action = "prevalidate" if actor.role == "AGENT_VERIFICATEUR" else "approve"
    reason = (
        "planning_prevalidation"
        if actor.role == "AGENT_VERIFICATEUR"
        else "planning_approval"
    )
    for item in candidates:
        actions = allowed(
            actor.role,
            resource="activity",
            state=item.state,
            contributor=item.id in contributed,
            prevalidator=item.current_revision_id in prevalidated,
            amendment=item.amendment_id is not None,
            withdrawal=item.withdrawal_id is not None,
            transfer=item.transfer_id is not None,
        )
        if action in actions:
            add(
                item,
                priority=0,
                reason=reason,
                action="review_planning",
                destination="planning",
            )


def _add_financial_reviews(
    db: Session,
    activities: dict[str, Activity],
    actor: User,
    add: Any,
) -> None:
    target_state = "submitted" if actor.role == "AGENT_VERIFICATEUR" else "prevalidated"
    specs: tuple[tuple[Any, Any, str, str], ...] = (
        (FundingRequest, FundingDecision, "request_id", "funding"),
        (DisbursementRequest, DisbursementDecision, "request_id", "disbursement"),
        (
            ZeroSpendingDeclaration,
            ZeroSpendingDecision,
            "declaration_id",
            "zero_spending",
        ),
        (VirementRequest, VirementDecision, "request_id", "virement"),
    )
    for request_model, decision_model, decision_key, kind in specs:
        requests: list[Any] = list(
            db.scalars(
                select(request_model).where(
                    request_model.activity_id.in_(activities),
                    request_model.state == target_state,
                )
            )
        )
        if not requests:
            continue
        prevalidators: dict[str, str] = {}
        if actor.role == "VALIDATEUR_DEFINITIF":
            key = getattr(decision_model, decision_key)
            prevalidators = dict(
                db.execute(
                    select(key, decision_model.actor_id).where(
                        key.in_([request.id for request in requests]),
                        decision_model.stage == "supervisor",
                        decision_model.outcome == "prevalidated",
                    )
                ).all()
            )
        for request in requests:
            excluded = (
                request.excluded_reviewer_ids
                if isinstance(request, VirementRequest)
                else request.snapshot.get("excluded_reviewer_ids", [])
            )
            if (
                not isinstance(excluded, list)
                or actor.id in excluded
                or (
                    actor.role == "VALIDATEUR_DEFINITIF"
                    and (
                        request.id not in prevalidators
                        or prevalidators[request.id] == actor.id
                    )
                )
            ):
                continue
            stage = (
                "prevalidation" if actor.role == "AGENT_VERIFICATEUR" else "approval"
            )
            add(
                activities[request.activity_id],
                priority=1,
                reason=f"{kind}_{stage}",
                action="review_finance",
                destination="execution",
            )


def _add_reversement_attention(
    db: Session,
    activities: dict[str, Activity],
    assigned: set[str],
    add: Any,
) -> None:
    candidates = {
        item.id: item
        for item in activities.values()
        if item.id in assigned and item.state == "approved"
    }
    if not candidates:
        return
    confirmations = {
        row.activity_id: row
        for row in db.scalars(
            select(VirementConfirmation)
            .where(VirementConfirmation.activity_id.in_(candidates))
            .ext(distinct_on(VirementConfirmation.activity_id))
            .order_by(
                VirementConfirmation.activity_id,
                VirementConfirmation.revision.desc(),
            )
        )
    }
    if not confirmations:
        return
    declarations = {
        row.activity_id: row
        for row in db.scalars(
            select(ReversementDeclaration)
            .where(ReversementDeclaration.activity_id.in_(confirmations))
            .ext(distinct_on(ReversementDeclaration.activity_id))
            .order_by(
                ReversementDeclaration.activity_id,
                ReversementDeclaration.revision.desc(),
            )
        )
    }
    from app.planning.execution import closure_blockers

    for activity_id, confirmation in confirmations.items():
        item = candidates[activity_id]
        if item.allocation is None or item.allocation <= confirmation.amount:
            continue
        declaration = declarations.get(activity_id)
        if (
            declaration
            and declaration.confirmation_id == confirmation.id
            and declaration.amount == item.allocation - confirmation.amount
        ):
            continue
        if closure_blockers(db, item) == ["reversement_not_settled"]:
            add(
                item,
                priority=2,
                reason="reversement_required",
                action="declare_reversement",
                destination="execution",
            )
