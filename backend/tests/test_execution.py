# ruff: noqa: F401, F811, E501
from datetime import UTC, datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session, SessionTransaction
from test_access import headers
from test_amendments import cancel_amendment, open_amendment
from test_planning import (  # noqa: F401
    admin,
    ordered_advisory_race,
    patch,
    plan,
    planning,
    post,
    references,
)

from app.auth.models import Audit
from app.planning.models import Activity, Operation


def execution_path(activity, operation):
    return f"/api/v1/activities/{activity['id']}/operations/{operation['id']}/execution"


def approved_execution_activity(
    clients, *, planned_start=None, planned_end=None, allocations=None
):
    _partner, operation_type, project = references(clients)
    today = datetime.now(ZoneInfo("Africa/Porto-Novo")).date()
    plan_changes = {
        "planned_start": planned_start or today.isoformat(),
        "planned_end": planned_end or (today + timedelta(days=90)).isoformat(),
    }
    if allocations is not None:
        plan_changes.update(
            {
                "allocation": str(sum(allocations)),
                "operations": [
                    {
                        "type_id": operation_type["id"],
                        "name": f"Opération {position}",
                        "allocation": str(amount),
                    }
                    for position, amount in enumerate(allocations, 1)
                ],
            }
        )
    created = post(
        clients["agent"],
        f"/api/v1/projects/{project['id']}/ptas/{today.year}/activities",
        {
            **plan(operation_type, **plan_changes),
            "request_key": str(uuid4()),
        },
    ).json()
    revision = post(
        clients["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    prevalidated = post(
        clients["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    approved = post(
        clients["validator"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert approved.status_code == 201, approved.text
    return clients["agent"].get(f"/api/v1/activities/{created['id']}").json()


def test_agent_starts_records_and_corrects_operation_with_history(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]

    started = patch(
        planning["agent2"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert started.status_code == 200, started.text
    started_detail = started.json()
    assert started_detail["version"] == activity["version"] + 1
    assert started_detail["operations"][0]["execution_started_at"] is not None
    assert started_detail["operations"][0]["actual_spent"] is None
    assert started_detail["spending_total"] is None
    assert started_detail["completed_operations"] == 0

    recorded = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": started_detail["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "100000",
            "execution_completed": True,
            "execution_observation": "Opération terminée.",
        },
    )
    assert recorded.status_code == 200, recorded.text
    recorded_operation = recorded.json()["operations"][0]
    assert recorded_operation["actual_spent"] == "100000"
    assert recorded_operation["execution_completed"] is True

    rejected = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": recorded.json()["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": None,
            "execution_completed": False,
            "execution_observation": "",
        },
    )
    assert rejected.status_code == 422

    corrected = patch(
        planning["agent2"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": recorded.json()["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": None,
            "execution_completed": False,
            "execution_observation": "",
            "correction_reason": "Le montant et la fin ont été saisis trop tôt.",
        },
    )
    assert corrected.status_code == 200, corrected.text
    corrected_operation = corrected.json()["operations"][0]
    assert corrected_operation["actual_spent"] is None
    assert corrected_operation["execution_completed"] is False
    assert corrected_operation["execution_started_at"] is not None
    assert (
        post(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/withdrawals",
            {
                "expected_version": corrected.json()["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
                "reason": "Le démarrage conservé bloque ce retrait.",
            },
        ).status_code
        == 409
    )

    history = planning["supervisor"].get(
        f"/api/v1/activities/{activity['id']}/execution/history"
    )
    assert history.status_code == 200, history.text
    assert [row["action"] for row in history.json()["data"]] == [
        "operation.execution_started",
        "operation.execution_recorded",
        "operation.execution_corrected",
    ]
    assert history.json()["data"][-1]["correction_reason"] == (
        "Le montant et la fin ont été saisis trop tôt."
    )
    with Session(planning["auth"].engine) as db:
        audits = list(
            db.scalars(
                select(Audit).where(
                    Audit.target == operation["id"],
                    Audit.action.like("operation.execution_%"),
                )
            )
        )
        assert len(audits) == 3


def test_start_rejects_record_fields_even_when_explicitly_null(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    response = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": None,
            "execution_completed": None,
            "execution_observation": None,
            "correction_reason": None,
        },
    )
    assert response.status_code == 422


def test_execution_is_role_date_revision_and_workflow_guarded(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    body = {
        "action": "start",
        "expected_version": activity["version"],
        "expected_approved_revision_id": activity["approved_revision_id"],
    }
    original_clock = planning["auth"].clock
    planned_start = datetime.fromisoformat(activity["planned_start"]).replace(
        tzinfo=UTC
    )
    planning["auth"].clock = lambda: planned_start - timedelta(days=1)
    assert (
        patch(planning["agent"], execution_path(activity, operation), body).status_code
        == 409
    )
    planning["auth"].clock = original_clock
    eligible = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert eligible["mutation_unavailable_reason"] is None
    assert (
        patch(
            planning["supervisor"], execution_path(activity, operation), body
        ).status_code
        == 403
    )
    assert (
        patch(
            planning["validator"], execution_path(activity, operation), body
        ).status_code
        == 403
    )
    assert (
        patch(planning["admin"], execution_path(activity, operation), body).status_code
        == 403
    )
    stale = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            **body,
            "expected_approved_revision_id": "00000000-0000-4000-8000-000000000000",
        },
    )
    assert stale.status_code == 409

    today = datetime.now(ZoneInfo("Africa/Porto-Novo")).date()
    after_end = approved_execution_activity(
        planning,
        planned_start=(today - timedelta(days=2)).isoformat(),
        planned_end=(today - timedelta(days=1)).isoformat(),
    )
    after_end_operation = after_end["operations"][0]
    accepted = patch(
        planning["agent"],
        execution_path(after_end, after_end_operation),
        {
            "action": "start",
            "expected_version": after_end["version"],
            "expected_approved_revision_id": after_end["approved_revision_id"],
        },
    )
    assert accepted.status_code == 200, accepted.text


def test_execution_reads_are_scoped_paginated_and_read_only_for_reviewers(planning):
    activity = approved_execution_activity(planning)
    detail = planning["supervisor"].get(
        f"/api/v1/activities/{activity['id']}/execution"
    )
    assert detail.status_code == 200, detail.text
    assert detail.json()["operation_count"] == 2
    assert detail.json()["operations"][0]["allowed_actions"] == []
    assert detail.json()["mutation_unavailable_reason"] == "reviewer_read_only"
    listing = planning["validator"].get(
        f"/api/v1/ptas/{activity['pta_id']}/execution?limit=1"
    )
    assert listing.status_code == 200, listing.text
    assert listing.json()["object"] == "list"
    assert listing.json()["count"] == 1
    assert listing.json()["data"][0]["id"] == activity["id"]
    assert (
        planning["admin"]
        .get(f"/api/v1/activities/{activity['id']}/execution")
        .status_code
        == 403
    )
    assert (
        planning["agent"]
        .get("/api/v1/activities/00000000-0000-4000-8000-000000000000/execution")
        .status_code
        == 404
    )


def test_execution_mutation_rejects_parent_state_and_request_forgery(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    body = {
        "action": "start",
        "expected_version": activity["version"],
        "expected_approved_revision_id": activity["approved_revision_id"],
    }
    other = approved_execution_activity(planning)
    assert (
        patch(
            planning["agent"],
            execution_path(activity, other["operations"][0]),
            body,
        ).status_code
        == 404
    )
    assert (
        planning["agent"]
        .patch(execution_path(activity, operation), json=body)
        .status_code
        == 403
    )
    _partner, operation_type, project = references(planning)
    year = datetime.now(ZoneInfo("Africa/Porto-Novo")).year
    unapproved = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/{year}/activities",
        {
            **plan(
                operation_type,
                planned_start=f"{year}-01-01",
                planned_end=f"{year}-12-31",
            ),
            "request_key": str(uuid4()),
        },
    ).json()
    assert (
        patch(
            planning["agent"],
            execution_path(unapproved, unapproved["operations"][0]),
            {
                **body,
                "expected_version": unapproved["version"],
                "expected_approved_revision_id": str(uuid4()),
            },
        ).status_code
        == 409
    )
    agent2_session = planning["agent2"].get("/api/v1/auth/session").json()
    agent2_id = agent2_session["user"]["id"]
    with planning["auth"].engine.begin() as db:
        db.execute(
            text("UPDATE auth_context SET state='revoked' WHERE user_id=:id"),
            {"id": agent2_id},
        )
    assert (
        planning["agent2"]
        .patch(
            execution_path(activity, operation),
            headers={
                "Origin": "http://localhost",
                "X-CSRF-Token": agent2_session["csrf"],
            },
            json=body,
        )
        .status_code
        == 401
    )

    withdrawn = approved_execution_activity(planning)
    request = post(
        planning["agent"],
        f"/api/v1/activities/{withdrawn['id']}/withdrawals",
        {
            "expected_version": withdrawn["version"],
            "expected_approved_revision_id": withdrawn["approved_revision_id"],
            "reason": "Retrait synthétique avant réalisation.",
        },
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{withdrawn['id']}/revisions/{request['id']}/decisions",
        {"expected_version": request["activity_version"], "decision": "prevalidate"},
    ).json()
    assert (
        post(
            planning["validator"],
            f"/api/v1/activities/{withdrawn['id']}/revisions/{request['id']}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        ).status_code
        == 201
    )
    withdrawn = planning["agent"].get(f"/api/v1/activities/{withdrawn['id']}").json()
    assert (
        patch(
            planning["agent"],
            execution_path(withdrawn, withdrawn["operations"][0]),
            {
                **body,
                "expected_version": withdrawn["version"],
                "expected_approved_revision_id": withdrawn["approved_revision_id"],
            },
        ).status_code
        == 409
    )

    inactive = approved_execution_activity(planning)
    with planning["auth"].engine.begin() as db:
        db.execute(
            text("UPDATE pta_project SET state='closed' WHERE id=:id"),
            {"id": inactive["project_id"]},
        )
    assert (
        patch(
            planning["agent"],
            execution_path(inactive, inactive["operations"][0]),
            {
                **body,
                "expected_version": inactive["version"],
                "expected_approved_revision_id": inactive["approved_revision_id"],
            },
        ).status_code
        == 409
    )


def test_zero_overspend_and_variance_observation_rules(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    started = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    missing_observation = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": started["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "0",
            "execution_completed": True,
            "execution_observation": "",
        },
    )
    assert missing_observation.status_code == 422
    zero = patch(
        planning["agent2"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": started["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "0",
            "execution_completed": True,
            "execution_observation": "Aucune dépense nécessaire.",
        },
    )
    assert zero.status_code == 200, zero.text
    assert zero.json()["operations"][0]["actual_spent"] == "0"
    assert zero.json()["operations"][0]["variance"] == "-100000"
    second_started = patch(
        planning["agent"],
        execution_path(activity, activity["operations"][1]),
        {
            "action": "start",
            "expected_version": zero.json()["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    overflow = patch(
        planning["agent"],
        execution_path(activity, activity["operations"][1]),
        {
            "action": "record",
            "expected_version": second_started["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "9223372036854775808",
            "execution_completed": False,
            "execution_observation": "",
        },
    )
    assert overflow.status_code == 422


def test_blank_initial_reason_and_bounded_unicode_observation_are_accepted(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    started = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    response = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": started["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "100000",
            "execution_completed": True,
            "execution_observation": "🙂" * 4000,
            "correction_reason": "   ",
        },
    )
    assert response.status_code == 200, response.text


def test_started_activity_blocks_withdrawal_transfer_and_operation_removal(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    started = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    withdrawal = post(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/withdrawals",
        {
            "expected_version": started["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Retrait impossible après démarrage.",
        },
    )
    assert withdrawal.status_code == 409
    transfer = post(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/transfers",
        {
            "expected_version": started["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Transfert impossible après démarrage.",
            "planned_start": f"{int(activity['placement_year']) + 1}-01-01",
            "planned_end": f"{int(activity['placement_year']) + 1}-06-30",
        },
    )
    assert transfer.status_code == 409
    amendment = open_amendment(planning, started)
    remaining = amendment["operations"][1]
    removal = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}",
        {
            "expected_version": amendment["version"],
            "name": amendment["name"],
            "description": amendment["description"],
            "planned_start": amendment["planned_start"],
            "planned_end": amendment["planned_end"],
            "allocation": remaining["allocation"],
            "operations": [
                {
                    "id": remaining["id"],
                    "type_id": remaining["type_id"],
                    "name": remaining["name"],
                    "allocation": remaining["allocation"],
                }
            ],
        },
    )
    assert removal.status_code == 409


def test_amendment_pause_preserves_execution_and_cancellation_resumes(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    started = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    amended = open_amendment(planning, started)
    paused = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert paused["execution_paused"] is True
    assert paused["pause_reason"] == "amendment_pending"
    assert paused["operations"][0]["execution_started_at"] is not None
    assert (
        patch(
            planning["agent"],
            execution_path(activity, operation),
            {
                "action": "record",
                "expected_version": amended["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
                "actual_spent": "100000",
                "execution_completed": True,
                "execution_observation": "Terminé.",
            },
        ).status_code
        == 409
    )
    resumed = cancel_amendment(planning, amended)
    recorded = patch(
        planning["agent2"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": resumed["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "100000",
            "execution_completed": True,
            "execution_observation": "Terminé.",
        },
    )
    assert recorded.status_code == 200, recorded.text


def test_approved_budget_amendment_preserves_execution_and_recording_basis(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    started = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    recorded = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": started["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "110000",
            "execution_completed": True,
            "execution_observation": "Dépassement initial justifié.",
        },
    ).json()
    opened = open_amendment(planning, recorded)
    operations = [
        {
            "id": row["id"],
            "type_id": row["type_id"],
            "name": row["name"],
            "allocation": "120000"
            if row["id"] == operation["id"]
            else row["allocation"],
        }
        for row in opened["operations"]
    ]
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}",
        {
            "expected_version": opened["version"],
            "name": opened["name"],
            "description": opened["description"],
            "planned_start": opened["planned_start"],
            "planned_end": opened["planned_end"],
            "allocation": "320000",
            "operations": operations,
        },
    ).json()
    revision = post(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": changed["version"]},
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert approved.status_code == 201, approved.text
    execution = (
        planning["supervisor"]
        .get(f"/api/v1/activities/{activity['id']}/execution")
        .json()
    )
    assert execution["operations"][0]["actual_spent"] == "110000"
    assert execution["operations"][0]["execution_completed"] is True
    assert execution["operations"][0]["execution_observation"] == (
        "Dépassement initial justifié."
    )
    assert execution["operations"][0]["approved_allocation"] == "120000"
    history = (
        planning["validator"]
        .get(f"/api/v1/activities/{activity['id']}/execution/history")
        .json()["data"]
    )
    recorded_event = next(
        row for row in history if row["action"] == "operation.execution_recorded"
    )
    assert recorded_event["approved_revision_id"] == activity["approved_revision_id"]
    assert recorded_event["approved_allocation"] == "100000"


def test_execution_audit_failure_rolls_back_operation_and_activity(
    planning, monkeypatch
):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    original = planning["auth"].business_audit

    def fail_execution(db, action, actor, target, business):
        if action == "operation.execution_started":
            raise RuntimeError("synthetic audit failure")
        return original(db, action, actor, target, business)

    monkeypatch.setattr(planning["auth"], "business_audit", fail_execution)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        patch(
            planning["agent"],
            execution_path(activity, operation),
            {
                "action": "start",
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
            },
        )
    with Session(planning["auth"].engine) as db:
        persisted_operation = db.get(Operation, operation["id"])
        persisted_activity = db.get(Activity, activity["id"])
        assert persisted_operation.execution_started_at is None
        assert persisted_activity.version == activity["version"]
        assert not db.scalar(
            select(Audit.id).where(
                Audit.target == operation["id"],
                Audit.action == "operation.execution_started",
            )
        )


@pytest.mark.parametrize("failure", ["constraint", "commit"])
def test_execution_constraint_or_commit_failure_rolls_back(
    planning, monkeypatch, failure
):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    original_audit = planning["auth"].business_audit

    def mark_failure(db, action, *args, **kwargs):
        result = original_audit(db, action, *args, **kwargs)
        if action == "operation.execution_started":
            if failure == "constraint":
                db.execute(
                    text(
                        "INSERT INTO mjl_ownership_context (id,created_at) "
                        "VALUES ('NOT_MJL',clock_timestamp())"
                    )
                )
            else:
                db.info["fail_execution_commit"] = True
        return result

    monkeypatch.setattr(planning["auth"], "business_audit", mark_failure)
    if failure == "commit":
        original_commit = SessionTransaction.commit

        def fail_commit(transaction, *args, **kwargs):
            if transaction.session.info.pop("fail_execution_commit", False):
                raise IntegrityError(
                    "synthetic execution commit failure", {}, Exception()
                )
            return original_commit(transaction, *args, **kwargs)

        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    response = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert response.status_code == 503
    with Session(planning["auth"].engine) as db:
        persisted_operation = db.get(Operation, operation["id"])
        persisted_activity = db.get(Activity, activity["id"])
        assert persisted_operation.execution_started_at is None
        assert persisted_activity.version == activity["version"]
        assert not db.scalar(
            select(Audit.id).where(
                Audit.target == operation["id"],
                Audit.action == "operation.execution_started",
            )
        )


def test_start_and_amendment_race_serializes_without_lost_state(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    start_body = {
        "action": "start",
        "expected_version": activity["version"],
        "expected_approved_revision_id": activity["approved_revision_id"],
    }
    amendment_body = {
        "expected_version": activity["version"],
        "expected_approved_revision_id": activity["approved_revision_id"],
        "reason": "Ajustement concurrent.",
    }
    started, stale_amendment = ordered_advisory_race(
        planning["auth"],
        lambda: patch(
            planning["agent"], execution_path(activity, operation), start_body
        ),
        lambda: post(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}/amendments",
            amendment_body,
        ),
    )
    assert started.status_code == 200
    assert stale_amendment.status_code == 409
    current = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert current["operations"][0]["execution_started_at"] is not None
    assert current["execution_paused"] is False

    activity2 = approved_execution_activity(planning)
    operation2 = activity2["operations"][0]
    opened, blocked_start = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent2"],
            f"/api/v1/activities/{activity2['id']}/amendments",
            {
                **amendment_body,
                "expected_version": activity2["version"],
                "expected_approved_revision_id": activity2["approved_revision_id"],
            },
        ),
        lambda: patch(
            planning["agent"],
            execution_path(activity2, operation2),
            {
                **start_body,
                "expected_version": activity2["version"],
                "expected_approved_revision_id": activity2["approved_revision_id"],
            },
        ),
    )
    assert opened.status_code == 201
    assert blocked_start.status_code == 409
    paused = (
        planning["agent"].get(f"/api/v1/activities/{activity2['id']}/execution").json()
    )
    assert paused["execution_paused"] is True
    assert paused["operations"][0]["execution_started_at"] is None


@pytest.mark.parametrize("kind", ["withdrawals", "transfers"])
@pytest.mark.parametrize("first", ["execution", "lifecycle"])
def test_start_and_lifecycle_request_serialize(planning, kind, first):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]

    def execute():
        return patch(
            planning["agent"],
            execution_path(activity, operation),
            {
                "action": "start",
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
            },
        )

    def lifecycle():
        body = {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Concurrence synthétique contrôlée.",
        }
        if kind == "transfers":
            target_year = int(activity["placement_year"]) + 1
            body.update(
                planned_start=f"{target_year}-02-01",
                planned_end=f"{target_year}-08-31",
            )
        return post(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}/{kind}",
            body,
        )

    one, two = ordered_advisory_race(
        planning["auth"],
        execute if first == "execution" else lifecycle,
        lifecycle if first == "execution" else execute,
    )
    assert one.status_code in {200, 201}
    assert two.status_code == 409
    detail = planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
    execution = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    if first == "execution":
        assert execution["operations"][0]["execution_started_at"] is not None
        assert "request_withdrawal" not in detail["allowed_actions"]
        assert "request_transfer" not in detail["allowed_actions"]
    else:
        assert execution["execution_paused"] is True
        assert execution["operations"][0]["execution_started_at"] is None


def test_concurrent_execution_edits_reject_stale_second_write(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    started = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()

    def record(amount):
        return patch(
            planning["agent"],
            execution_path(activity, operation),
            {
                "action": "record",
                "expected_version": started["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
                "actual_spent": amount,
                "execution_completed": True,
                "execution_observation": "Résultat concurrent justifié.",
            },
        )

    first, second = ordered_advisory_race(
        planning["auth"], lambda: record("100000"), lambda: record("110000")
    )
    assert (first.status_code, second.status_code) == (200, 409)


def test_execution_openapi_exposes_only_the_four_contract_responsibilities(planning):
    paths = planning["agent"].app.openapi()["paths"]
    assert set(paths["/api/v1/ptas/{identifier}/execution"]) == {"get"}
    assert set(paths["/api/v1/activities/{identifier}/execution"]) == {"get"}
    history = "/api/v1/activities/{identifier}/execution/history"
    assert set(paths[history]) == {"get"}
    mutation = "/api/v1/activities/{identifier}/operations/{operation_id}/execution"
    assert set(paths[mutation]) == {"patch"}
    headers_present = {
        parameter["name"]
        for parameter in paths[mutation]["patch"]["parameters"]
        if parameter["in"] == "header"
    }
    assert headers_present == {"Origin", "X-CSRF-Token"}


def test_execution_audit_rejects_unbounded_or_unexpected_facts(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    facts = {
        "execution_started_at": None,
        "execution_completed": False,
        "actual_spent": None,
        "execution_observation": "",
    }
    invalid = {
        "context_id": "MJL",
        "activity_id": activity["id"],
        "operation_id": operation["id"],
        "approved_revision_id": activity["approved_revision_id"],
        "approved_allocation": operation["allocation"],
        "before": facts,
        "after": facts,
        "correction_reason": None,
        "unexpected": "not allowed",
    }
    with Session(planning["auth"].engine) as db, db.begin():
        with pytest.raises(ValueError, match="Invalid business audit facts"):
            planning["auth"].business_audit(
                db,
                "operation.execution_recorded",
                "actor",
                operation["id"],
                invalid,
            )
    with Session(planning["auth"].engine) as db:
        assert not db.scalar(
            select(Audit.id).where(
                Audit.target == operation["id"],
                Audit.action == "operation.execution_recorded",
            )
        )


def test_clean_predecessor_round_trip_preserves_approved_history(planning, auth_env):
    activity = approved_execution_activity(planning)
    amended = open_amendment(planning, activity, "Historique avant migration.")
    activity = cancel_amendment(planning, amended, "Conserver le plan approuvé.")
    withdrawal = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/withdrawals",
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Historique de retrait avant migration.",
        },
    ).json()
    activity = post(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/withdrawals/"
        f"{withdrawal['snapshot']['withdrawal']['id']}/cancellation",
        {
            "expected_version": withdrawal["activity_version"],
            "expected_revision_id": withdrawal["id"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Conserver l’Activité approuvée.",
        },
    ).json()
    target_year = int(activity["placement_year"]) + 1
    transfer = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/transfers",
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Historique de transfert avant migration.",
            "planned_start": f"{target_year}-02-01",
            "planned_end": f"{target_year}-08-31",
        },
    ).json()
    activity = post(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/transfers/"
        f"{transfer['snapshot']['transfer']['id']}/cancellation",
        {
            "expected_version": transfer["activity_version"],
            "expected_revision_id": transfer["id"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Conserver le calendrier approuvé.",
        },
    ).json()
    with planning["auth"].engine.connect() as db:
        before_activity = tuple(
            db.execute(
                text(
                    "SELECT id,state,current_revision_id,approved_revision_id,version "
                    "FROM pta_activity WHERE id=:id"
                ),
                {"id": activity["id"]},
            ).one()
        )
        before_revisions = tuple(
            db.execute(
                text(
                    "SELECT id,fingerprint,snapshot FROM pta_activity_revision "
                    "WHERE activity_id=:id ORDER BY revision_number"
                ),
                {"id": activity["id"]},
            ).all()
        )
        assert len(before_revisions) >= 3
        before_audits = tuple(
            db.execute(
                text(
                    "SELECT id,action,business FROM auth_audit "
                    "WHERE business IS NOT NULL ORDER BY id"
                )
            ).all()
        )
        assert {
            action.split("_")[0]
            for _identifier, action, _business in before_audits
            if action.startswith("activity.")
        } >= {"activity.amendment", "activity.withdrawal", "activity.transfer"}
    planning["auth"].engine.dispose()
    config = Config("alembic.ini")
    command.downgrade(config, "0009_pta2b2b")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0009_pta2b2b"
            )
    finally:
        engine.dispose()
    command.upgrade(config, "head")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert (
                tuple(
                    db.execute(
                        text(
                            "SELECT id,state,current_revision_id,approved_revision_id,version "
                            "FROM pta_activity WHERE id=:id"
                        ),
                        {"id": activity["id"]},
                    ).one()
                )
                == before_activity
            )
            assert (
                tuple(
                    db.execute(
                        text(
                            "SELECT id,fingerprint,snapshot FROM pta_activity_revision "
                            "WHERE activity_id=:id ORDER BY revision_number"
                        ),
                        {"id": activity["id"]},
                    ).all()
                )
                == before_revisions
            )
            assert (
                tuple(
                    db.execute(
                        text(
                            "SELECT id,action,business FROM auth_audit "
                            "WHERE business IS NOT NULL ORDER BY id"
                        )
                    ).all()
                )
                == before_audits
            )
            assert db.scalar(
                text(
                    "SELECT count(*) FROM pta_operation WHERE activity_id=:id "
                    "AND execution_started_at IS NULL AND execution_completed=false "
                    "AND actual_spent IS NULL AND execution_observation=''"
                ),
                {"id": activity["id"]},
            ) == len(activity["operations"])
    finally:
        engine.dispose()


def test_execution_evidence_refuses_destructive_downgrade(planning, auth_env):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    response = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert response.status_code == 200
    planning["auth"].engine.dispose()
    with pytest.raises(Exception, match="Refusing destructive PTA-3A downgrade"):
        command.downgrade(Config("alembic.ini"), "0009_pta2b2b")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0014_pta3e"
            )
            assert (
                db.scalar(
                    text(
                        "SELECT count(*) FROM pta_operation "
                        "WHERE activity_id=:id AND execution_started_at IS NOT NULL"
                    ),
                    {"id": activity["id"]},
                )
                == 1
            )
    finally:
        engine.dispose()


def test_reasoned_withdrawal_cancellation_preserves_late_execution_evidence(planning):
    activity = approved_execution_activity(planning)
    requested = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/withdrawals",
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Demande à annuler après constat.",
        },
    ).json()
    withdrawal = requested["snapshot"]["withdrawal"]
    operation = activity["operations"][0]
    with planning["auth"].engine.begin() as db:
        db.execute(
            text(
                "UPDATE pta_operation SET execution_started_at=clock_timestamp() "
                "WHERE id=:id"
            ),
            {"id": operation["id"]},
        )
    cancelled = post(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/withdrawals/"
        f"{withdrawal['id']}/cancellation",
        {
            "expected_version": requested["activity_version"],
            "expected_revision_id": requested["id"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Conserver l’activité et son travail enregistré.",
        },
    )
    assert cancelled.status_code == 200, cancelled.text
    execution = (
        planning["supervisor"]
        .get(f"/api/v1/activities/{activity['id']}/execution")
        .json()
    )
    assert execution["execution_paused"] is False
    assert execution["operations"][0]["execution_started_at"] is not None


def test_database_rejects_reset_removal_and_deletion_of_started_operation(planning):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    unstarted = activity["operations"][1]
    for statement in (
        "UPDATE pta_operation SET actual_spent=0 WHERE id=:id",
        "UPDATE pta_operation SET execution_observation='fait' WHERE id=:id",
        "UPDATE pta_operation SET execution_completed=true WHERE id=:id",
    ):
        with pytest.raises(DBAPIError):
            with Session(planning["auth"].engine) as db, db.begin():
                db.execute(text(statement), {"id": unstarted["id"]})
    started = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "start",
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert started.status_code == 200
    statements = (
        "UPDATE pta_operation SET execution_started_at=NULL WHERE id=:id",
        "UPDATE pta_operation SET removed_at=clock_timestamp() WHERE id=:id",
        "DELETE FROM pta_operation WHERE id=:id",
    )
    for statement in statements:
        with pytest.raises(DBAPIError):
            with Session(planning["auth"].engine) as db, db.begin():
                db.execute(text(statement), {"id": operation["id"]})
    with Session(planning["auth"].engine) as db:
        persisted = db.get(Operation, operation["id"])
        assert persisted is not None
        assert persisted.execution_started_at is not None
        assert persisted.removed_at is None


@pytest.mark.parametrize("first", ["execution", "deactivation"])
def test_execution_and_actor_deactivation_serialize(planning, first):
    activity = approved_execution_activity(planning)
    operation = activity["operations"][0]
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["email"] == "agent2@example.test"
    )

    def execute():
        return patch(
            planning["agent2"],
            execution_path(activity, operation),
            {
                "action": "start",
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
            },
        )

    def deactivate():
        return planning["admin"].patch(
            f"/api/v1/access/users/{account['id']}",
            headers=headers(planning["admin"]),
            json={"expected_version": account["version"], "deactivate": True},
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        execute if first == "execution" else deactivate,
        deactivate if first == "execution" else execute,
    )
    if first == "execution":
        assert (first_response.status_code, second_response.status_code) == (200, 200)
        with Session(planning["auth"].engine) as db:
            assert db.get(Operation, operation["id"]).execution_started_at is not None
    else:
        assert first_response.status_code == 200
        assert second_response.status_code == 401
        with Session(planning["auth"].engine) as db:
            assert db.get(Operation, operation["id"]).execution_started_at is None
