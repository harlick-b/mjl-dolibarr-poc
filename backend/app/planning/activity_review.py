"""Transactions for submitting and reviewing Activity revisions."""

import json
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Literal, cast

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.service import AuthError, AuthService
from app.planning.core.models import (
    Activity,
    ActivityAssignment,
    ActivityContributor,
    ActivityRevision,
    ActivityRevisionDecision,
    AnnualPTA,
    Operation,
    Project,
    Subtask,
)
from app.planning.core.service import (
    CONTEXT,
    activity_item,
    assert_types,
    build_revision_snapshot,
    fingerprint,
    get_activity,
    get_activity_for_command,
    locked_mutation,
    principal,
    require_agent_assignment,
    revision_item,
    structural_content,
    validate_plan,
    xof,
)
from app.planning.notifications.workflow_notifications import (
    mark_review_handled,
    record_agent_notifications,
    record_review_notifications,
)


@dataclass(frozen=True)
class ActivityReviewResult:
    payload: dict[str, Any]
    location: str
    notification_ids: tuple[str, ...]
    deliver_notifications: bool = True


def submit_activity(
    auth: AuthService,
    secret: str | None,
    csrf: str | None,
    identifier: str,
    expected_version: int,
) -> ActivityReviewResult:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            secret,
            csrf,
            roles={"AGENT_SAISIE"},
            mutation=True,
        )
        item = get_activity(db, identifier, actor=actor, lock=True)
        require_agent_assignment(db, item.id, actor)
        if item.version != expected_version:
            raise AuthError(409, "activity_stale")
        if item.withdrawal_id:
            raise AuthError(409, "withdrawal_pending")
        if item.transfer_id:
            raise AuthError(409, "transfer_pending")
        if item.state not in {
            "draft",
            "amendment_draft",
            "returned_supervisor",
            "returned_validator",
        }:
            raise AuthError(409, "activity_not_submittable")
        before = activity_item(db, item, actor.role, actor.id)
        previous = (
            db.get(ActivityRevision, item.current_revision_id)
            if item.current_revision_id
            else None
        )
        current_structure = structural_content(db, item)
        try:
            _, normalized = validate_plan(current_structure, item.placement_year)
            assert_types(db, normalized)
        except AuthError:
            raise AuthError(409, "activity_incomplete") from None
        if item.state == "amendment_draft" and previous:
            previous_operations = cast(
                list[dict[str, str | int]], previous.snapshot["operations"]
            )
            previous_structure = {
                key: previous.snapshot[key]
                for key in (
                    "name",
                    "description",
                    "planned_start",
                    "planned_end",
                    "allocation",
                )
            }
            previous_structure["operations"] = [
                {
                    "id": row["id"],
                    "type_id": row["type_id"],
                    "name": row["name"],
                    "description": row.get("description", ""),
                    "allocation": row["allocation"],
                    "weight": row.get("weight"),
                    "planned_start": row.get("planned_start"),
                    "planned_end": row.get("planned_end"),
                    "position": row["position"],
                    "subtasks": row.get("subtasks", []),
                }
                for row in previous_operations
            ]
            if current_structure == previous_structure:
                raise AuthError(409, "correction_unchanged")
        now = auth.now(db)
        if not db.scalar(
            select(ActivityContributor.id).where(
                ActivityContributor.activity_id == item.id,
                ActivityContributor.user_id == actor.id,
                ActivityContributor.kind == "content",
            )
        ):
            db.add(
                ActivityContributor(
                    context_id=CONTEXT,
                    activity_id=item.id,
                    user_id=actor.id,
                    contributed_at=now,
                )
            )
            db.flush()
        snapshot = build_revision_snapshot(db, item, actor, now)
        content_fingerprint = fingerprint(current_structure)
        snapshot["content_fingerprint"] = content_fingerprint
        if (
            len(json.dumps(snapshot, sort_keys=True, separators=(",", ":")).encode())
            > 1_048_576
        ):
            raise AuthError(422, "revision_too_large")
        revision = ActivityRevision(
            context_id=CONTEXT,
            activity_id=item.id,
            revision_number=(
                db.scalar(
                    select(func.max(ActivityRevision.revision_number)).where(
                        ActivityRevision.activity_id == item.id
                    )
                )
                or 0
            )
            + 1,
            snapshot=snapshot,
            fingerprint=content_fingerprint,
            submitter_id=actor.id,
            submitted_at=now,
        )
        db.add(revision)
        db.flush()
        item.current_revision_id = revision.id
        item.state = "submitted"
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        workflow_audit(
            auth, db, "activity.submit", actor, item, before, after, revision
        )
        notification_ids = record_review_notifications(
            db, auth, item, revision, "supervisor"
        )
        payload = revision_item(db, revision)
        payload["activity_version"] = item.version
        result = ActivityReviewResult(
            payload=payload,
            location=f"/api/v1/activities/{item.id}/revisions/{revision.id}",
            notification_ids=tuple(notification_ids),
        )
    return result


def decide_activity(
    auth: AuthService,
    secret: str | None,
    csrf: str | None,
    identifier: str,
    revision_id: str,
    expected_version: int,
    decision_value: Literal["prevalidate", "approve", "return"],
    reason: str | None,
    requested_amount: str | None,
) -> ActivityReviewResult:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            secret,
            csrf,
            roles={"AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        preview = get_activity(db, identifier, actor=actor)
        preview_revision = db.scalar(
            select(ActivityRevision).where(
                ActivityRevision.id == revision_id,
                ActivityRevision.activity_id == preview.id,
            )
        )
        preview_transfer = (
            preview_revision.snapshot.get("transfer") if preview_revision else None
        )
        transfer_project: Project | None = None
        if preview.transfer_id and isinstance(preview_transfer, dict):
            transfer_project = db.get(
                Project, preview.request_project_id, with_for_update=True
            )
            target_year = preview_transfer.get("target_year")
            if not transfer_project or not isinstance(target_year, int):
                raise AuthError(409, "transfer_stale")
            list(
                db.scalars(
                    select(AnnualPTA)
                    .where(
                        AnnualPTA.project_id == preview.request_project_id,
                        AnnualPTA.year.in_([preview.placement_year, target_year]),
                    )
                    .order_by(AnnualPTA.id)
                    .with_for_update()
                )
            )
            db.refresh(preview, with_for_update=True)
            item = preview
        else:
            item = get_activity_for_command(db, identifier, actor)
        revision = db.scalar(
            select(ActivityRevision)
            .where(
                ActivityRevision.id == revision_id,
                ActivityRevision.activity_id == item.id,
            )
            .with_for_update()
        )
        if not revision:
            raise AuthError(404, "revision_not_found")
        if item.version != expected_version:
            raise AuthError(409, "activity_stale")
        if item.current_revision_id != revision.id:
            raise AuthError(409, "revision_obsolete")
        snapshot = cast(dict[str, Any], revision.snapshot)
        withdrawal_request = cast(dict[str, str] | None, snapshot.get("withdrawal"))
        transfer_request = cast(dict[str, Any] | None, snapshot.get("transfer"))
        if item.withdrawal_id:
            lifecycle_eligible(db, auth, item)
            if (
                not withdrawal_request
                or withdrawal_request.get("id") != item.withdrawal_id
                or withdrawal_request.get("base_approved_revision_id")
                != item.approved_revision_id
            ):
                raise AuthError(409, "withdrawal_stale")
        if item.transfer_id:
            lifecycle_eligible(db, auth, item)
            if (
                not transfer_request
                or transfer_request.get("id") != item.transfer_id
                or transfer_request.get("base_approved_revision_id")
                != item.approved_revision_id
            ):
                raise AuthError(409, "transfer_stale")
        if item.amendment_id and (
            snapshot.get("amendment_id") != item.amendment_id
            or snapshot.get("base_approved_revision_id") != item.approved_revision_id
        ):
            raise AuthError(409, "amendment_stale")
        if db.scalar(
            select(ActivityContributor.id).where(
                ActivityContributor.activity_id == item.id,
                ActivityContributor.user_id == actor.id,
                ActivityContributor.kind == "content",
            )
        ):
            raise AuthError(409, "reviewer_contributed")
        if decision_value == "return" and not reason:
            raise AuthError(422, "reason_required")
        if reason is not None and not reason.strip():
            raise AuthError(422, "input_invalid")
        if decision_value != "return" and requested_amount is not None:
            raise AuthError(422, "input_invalid")
        if (withdrawal_request or transfer_request) and requested_amount is not None:
            raise AuthError(422, "input_invalid")
        before = activity_item(db, item, actor.role, actor.id)
        now = auth.now(db)
        prevalidation_id = None
        ended_assignment_ids: list[str] | None = None
        withdrawal_recipient_ids: list[str] | None = None
        if actor.role == "AGENT_VERIFICATEUR":
            if item.state != "submitted" or decision_value not in {
                "prevalidate",
                "return",
            }:
                raise AuthError(409, "decision_ineligible")
            stage = "supervisor"
            outcome = "prevalidated" if decision_value == "prevalidate" else "returned"
            item.state = (
                "prevalidated"
                if decision_value == "prevalidate"
                else "returned_supervisor"
            )
            action = (
                "activity.prevalidate"
                if decision_value == "prevalidate"
                else "activity.return_supervisor"
            )
            if withdrawal_request:
                action = (
                    "activity.withdrawal_prevalidate"
                    if decision_value == "prevalidate"
                    else "activity.withdrawal_return_supervisor"
                )
            elif transfer_request:
                action = (
                    "activity.transfer_prevalidate"
                    if decision_value == "prevalidate"
                    else "activity.transfer_return_supervisor"
                )
        else:
            if item.state != "prevalidated" or decision_value not in {
                "approve",
                "return",
            }:
                raise AuthError(409, "decision_ineligible")
            prevalidation = db.scalar(
                select(ActivityRevisionDecision).where(
                    ActivityRevisionDecision.revision_id == revision.id,
                    ActivityRevisionDecision.stage == "supervisor",
                    ActivityRevisionDecision.outcome == "prevalidated",
                )
            )
            if not prevalidation or prevalidation.actor_id == actor.id:
                raise AuthError(409, "decision_ineligible")
            stage = "validator"
            outcome = "approved" if decision_value == "approve" else "returned"
            if decision_value == "approve":
                if withdrawal_request:
                    item.state = "withdrawn"
                    ended_assignment_ids = []
                    withdrawal_recipient_ids = []
                    assignments = list(
                        db.scalars(
                            select(ActivityAssignment)
                            .where(
                                ActivityAssignment.activity_id == item.id,
                                ActivityAssignment.ended_at.is_(None),
                            )
                            .order_by(ActivityAssignment.id)
                            .with_for_update()
                        )
                    )
                    for assignment in assignments:
                        withdrawal_recipient_ids.append(assignment.agent_id)
                        assignment.ended_at = now
                        assignment.ended_by_id = actor.id
                        ended_assignment_ids.append(assignment.id)
                elif transfer_request:
                    if not transfer_project or transfer_project.state != "active":
                        raise AuthError(409, "transfer_ineligible")
                    target_year = int(transfer_request["target_year"])
                    target = db.scalar(
                        select(AnnualPTA).where(
                            AnnualPTA.project_id == item.request_project_id,
                            AnnualPTA.year == target_year,
                        )
                    )
                    if not target:
                        raise AuthError(409, "pta_required")
                    persist_transfer_dates(db, item, snapshot)
                    item.pta_id = target.id
                    item.placement_year = target_year
                    item.planned_start = date.fromisoformat(
                        cast(str, snapshot["planned_start"])
                    )
                    item.planned_end = date.fromisoformat(
                        cast(str, snapshot["planned_end"])
                    )
                    item.state = "approved"
                    item.approved_revision_id = revision.id
                    item.transfer_id = None
                else:
                    item.state = "approved"
                    item.approved_revision_id = revision.id
                    item.amendment_id = None
                    item.amendment_reason = None
                    recalculate_hierarchical_task_facts(
                        db,
                        cast(list[dict[str, Any]], snapshot["operations"]),
                    )
                prevalidation_id = revision.id
                action = (
                    "activity.withdrawal_approve"
                    if withdrawal_request
                    else "activity.transfer_approve"
                    if transfer_request
                    else "activity.approve"
                )
            else:
                item.state = "returned_validator"
                action = (
                    "activity.withdrawal_return_validator"
                    if withdrawal_request
                    else "activity.transfer_return_validator"
                    if transfer_request
                    else "activity.return_validator"
                )
        requested = xof(requested_amount) if requested_amount else None
        if requested is not None and not (
            actor.role == "VALIDATEUR_DEFINITIF" and decision_value == "return"
        ):
            raise AuthError(422, "input_invalid")
        decision = ActivityRevisionDecision(
            context_id=CONTEXT,
            activity_id=item.id,
            revision_id=revision.id,
            stage=stage,
            outcome=outcome,
            actor_id=actor.id,
            actor_role=actor.role,
            decided_at=now,
            reason=reason,
            requested_amount=requested,
            prevalidation_revision_id=prevalidation_id,
        )
        db.add(decision)
        mark_review_handled(db, revision.id, stage, now)
        if outcome == "prevalidated":
            notification_ids = record_review_notifications(
                db,
                auth,
                item,
                revision,
                "validator",
                exclude_user_id=actor.id,
            )
        elif outcome == "returned":
            notification_ids = record_agent_notifications(
                db,
                auth,
                item,
                revision,
                kind="activity_correction",
                reason=reason,
            )
        else:
            notification_ids = record_agent_notifications(
                db,
                auth,
                item,
                revision,
                kind="activity_approved",
                recipient_ids=withdrawal_recipient_ids,
            )
        item.version += 1
        item.updated_at = now
        db.flush()
        after = activity_item(db, item, actor.role, actor.id)
        workflow_audit(
            auth,
            db,
            action,
            actor,
            item,
            before,
            after,
            revision,
            decision,
            ended_assignment_ids,
        )
        result = ActivityReviewResult(
            payload=decision_payload(decision, item.version),
            location=f"/api/v1/activities/{item.id}/revisions/{revision.id}",
            notification_ids=tuple(notification_ids),
            deliver_notifications=outcome != "approved",
        )
    return result


def decision_payload(row: ActivityRevisionDecision, version: int) -> dict[str, Any]:
    return {
        "id": row.id,
        "stage": row.stage,
        "outcome": row.outcome,
        "actor_id": row.actor_id,
        "actor_role": row.actor_role,
        "decided_at": row.decided_at.isoformat(),
        "reason": row.reason,
        "requested_amount": str(row.requested_amount)
        if row.requested_amount is not None
        else None,
        "prevalidation_revision_id": row.prevalidation_revision_id,
        "activity_version": version,
    }


def workflow_audit(
    auth: AuthService,
    db: Session,
    action: str,
    actor: User,
    item: Activity,
    before: dict[str, Any],
    after: dict[str, Any],
    revision: ActivityRevision,
    decision: ActivityRevisionDecision | None = None,
    ended_assignment_ids: list[str] | None = None,
) -> None:
    snapshot = cast(dict[str, Any], revision.snapshot)
    submitter = cast(dict[str, str], snapshot["submitter"])
    facts: dict[str, Any] = {
        "context_id": CONTEXT,
        "before": before,
        "after": after,
        "revision": {
            "id": revision.id,
            "revision_number": revision.revision_number,
            "fingerprint": revision.fingerprint,
            "actor_id": revision.submitter_id,
            "actor_role": submitter["role"],
            "submitted_at": revision.submitted_at.isoformat(),
        },
    }
    if snapshot.get("amendment_id"):
        facts["revision"].update(
            {
                "amendment_id": snapshot["amendment_id"],
                "base_approved_revision_id": snapshot["base_approved_revision_id"],
            }
        )
    withdrawal = snapshot.get("withdrawal")
    if isinstance(withdrawal, dict):
        facts["revision"].update(
            {
                "withdrawal_id": withdrawal["id"],
                "reason": withdrawal["reason"],
                "base_approved_revision_id": withdrawal["base_approved_revision_id"],
            }
        )
    transfer = snapshot.get("transfer")
    if isinstance(transfer, dict):
        facts["revision"].update(
            {
                "transfer_id": transfer["id"],
                "base_approved_revision_id": transfer["base_approved_revision_id"],
                "reason": transfer["reason"],
                "source_pta": transfer["source_pta"],
                "target_year": transfer["target_year"],
            }
        )
    if decision:
        facts["decision"] = {
            "id": decision.id,
            "stage": decision.stage,
            "outcome": decision.outcome,
            "reason": decision.reason,
            "requested_amount": str(decision.requested_amount)
            if decision.requested_amount is not None
            else None,
            "actor_id": decision.actor_id,
            "actor_role": decision.actor_role,
            "decided_at": decision.decided_at.isoformat(),
            "prevalidation_revision_id": decision.prevalidation_revision_id,
        }
    if ended_assignment_ids is not None:
        facts["ended_assignment_ids"] = ended_assignment_ids
    auth.business_audit(db, action, actor.id, item.id, facts)


def lifecycle_environment(auth: AuthService) -> None:
    if auth.policy.planning_lifecycle_fixture != "SYNTHETIC_EXECUTION_TEST_ONLY":
        raise AuthError(409, "eligibility_unverified")


def lifecycle_eligible(db: Session, auth: AuthService, item: Activity) -> None:
    from app.planning.operations.execution import assert_never_started

    lifecycle_environment(auth)
    assert_never_started(db, item)


def shifted_date(value: object, delta: timedelta) -> str | None:
    if value in (None, ""):
        return None
    try:
        return (date.fromisoformat(cast(str, value)) + delta).isoformat()
    except (TypeError, ValueError):
        raise AuthError(409, "transfer_base_invalid") from None


def transfer_date_facts(operations: object) -> list[dict[str, Any]]:
    if not isinstance(operations, list):
        return []
    return [
        {
            "id": row.get("id"),
            "planned_start": row.get("planned_start"),
            "planned_end": row.get("planned_end"),
            "subtasks": [
                {
                    "id": child.get("id"),
                    "planned_start": child.get("planned_start"),
                    "planned_end": child.get("planned_end"),
                }
                for child in row.get("subtasks", [])
                if isinstance(child, dict)
            ],
        }
        for row in operations
        if isinstance(row, dict)
    ]


def persist_transfer_dates(
    db: Session, item: Activity, snapshot: dict[str, Any]
) -> None:
    transfer = snapshot.get("transfer")
    if not isinstance(transfer, dict):
        raise AuthError(409, "transfer_dates_invalid")
    operations = cast(list[dict[str, Any]], snapshot.get("operations", []))
    base = db.get(ActivityRevision, transfer.get("base_approved_revision_id"))
    if not base:
        raise AuthError(409, "transfer_base_invalid")
    try:
        source_start = date.fromisoformat(cast(str, base.snapshot["planned_start"]))
        target_start = date.fromisoformat(cast(str, snapshot["planned_start"]))
        base_operations = cast(list[dict[str, Any]], base.snapshot["operations"])
    except (KeyError, TypeError, ValueError):
        raise AuthError(409, "transfer_base_invalid") from None
    delta = target_start - source_start
    expected_dates = [
        {
            "id": row.get("id"),
            "planned_start": shifted_date(row.get("planned_start"), delta),
            "planned_end": shifted_date(row.get("planned_end"), delta),
            "subtasks": [
                {
                    "id": child.get("id"),
                    "planned_start": shifted_date(child.get("planned_start"), delta),
                    "planned_end": shifted_date(child.get("planned_end"), delta),
                }
                for child in row.get("subtasks", [])
                if isinstance(child, dict)
            ],
        }
        for row in base_operations
    ]
    if transfer_date_facts(operations) != expected_dates:
        raise AuthError(409, "transfer_dates_invalid")
    task_rows = {
        row.id: row
        for row in db.scalars(
            select(Operation)
            .where(
                Operation.activity_id == item.id,
                Operation.removed_at.is_(None),
            )
            .with_for_update()
        )
    }
    if set(task_rows) != {cast(str, row.get("id")) for row in operations}:
        raise AuthError(409, "transfer_hierarchy_stale")
    child_rows = {
        row.id: row
        for row in db.scalars(
            select(Subtask)
            .where(
                Subtask.activity_id == item.id,
                Subtask.removed_at.is_(None),
            )
            .with_for_update()
        )
    }
    snapshot_child_ids = {
        cast(str, child.get("id"))
        for operation in operations
        for child in operation.get("subtasks", [])
        if isinstance(child, dict)
    }
    if set(child_rows) != snapshot_child_ids:
        raise AuthError(409, "transfer_hierarchy_stale")
    activity_start = date.fromisoformat(cast(str, snapshot["planned_start"]))
    activity_end = date.fromisoformat(cast(str, snapshot["planned_end"]))
    for fact in operations:
        task = task_rows[cast(str, fact["id"])]
        task_start = (
            date.fromisoformat(cast(str, fact["planned_start"]))
            if fact.get("planned_start")
            else None
        )
        task_end = (
            date.fromisoformat(cast(str, fact["planned_end"]))
            if fact.get("planned_end")
            else None
        )
        if (task_start is None) != (task_end is None) or (
            task_start is not None
            and (task_start < activity_start or cast(date, task_end) > activity_end)
        ):
            raise AuthError(409, "transfer_dates_invalid")
        task.planned_start = task_start
        task.planned_end = task_end
        for child_fact in fact.get("subtasks", []):
            child = child_rows[cast(str, child_fact["id"])]
            if child.task_id != task.id:
                raise AuthError(409, "transfer_hierarchy_stale")
            child_start = (
                date.fromisoformat(cast(str, child_fact["planned_start"]))
                if child_fact.get("planned_start")
                else None
            )
            child_end = (
                date.fromisoformat(cast(str, child_fact["planned_end"]))
                if child_fact.get("planned_end")
                else None
            )
            if (child_start is None) != (child_end is None) or (
                child_start is not None
                and (
                    task_start is None
                    or task_end is None
                    or child_start < task_start
                    or cast(date, child_end) > task_end
                )
            ):
                raise AuthError(409, "transfer_dates_invalid")
            child.planned_start = child_start
            child.planned_end = child_end


def recalculate_hierarchical_task_facts(
    db: Session, task_facts: list[dict[str, Any]]
) -> None:
    task_ids = [str(row["id"]) for row in task_facts]
    tasks = {
        row.id: row
        for row in db.scalars(
            select(Operation)
            .where(Operation.id.in_(task_ids))
            .order_by(Operation.id)
            .with_for_update()
        )
    }
    child_ids = [
        str(child["id"])
        for task in task_facts
        for child in task.get("subtasks", [])
        if isinstance(child, dict)
    ]
    children = {
        row.id: row
        for row in db.scalars(
            select(Subtask)
            .where(Subtask.id.in_(child_ids))
            .order_by(Subtask.id)
            .with_for_update()
        )
    }
    if set(tasks) != set(task_ids) or set(children) != set(child_ids):
        raise AuthError(409, "amendment_base_invalid")
    for task_fact in task_facts:
        child_facts = cast(list[dict[str, Any]], task_fact.get("subtasks", []))
        if not child_facts:
            continue
        task = tasks[str(task_fact["id"])]
        task_children = [children[str(child["id"])] for child in child_facts]
        known = [child.actual_spent for child in task_children]
        task.actual_spent = (
            sum(cast(int, amount) for amount in known)
            if all(amount is not None for amount in known)
            else None
        )
        task.execution_completed = all(
            child.execution_completed for child in task_children
        )
        starts = [
            child.execution_started_at
            for child in task_children
            if child.execution_started_at is not None
        ]
        task.execution_started_at = min(starts) if starts else None
        task.manual_progress_basis_points = None
