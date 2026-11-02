# ruff: noqa: F401, F811
from datetime import timedelta
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session, SessionTransaction
from test_access import headers
from test_amendments import open_amendment
from test_execution import approved_execution_activity, execution_path
from test_planning import (
    admin,
    login_existing,
    ordered_advisory_race,
    patch,
    planning,
    post,
    references,
)

from app.auth.models import Audit, User
from app.auth.service import AuthError
from app.planning.models import (
    Activity,
    DisbursementDecision,
    DisbursementRequest,
    Operation,
)


def finish_activity(
    clients, amounts=(100_000, 200_000), actor="agent", allocations=None
):
    activity = approved_execution_activity(clients, allocations=allocations)
    detail = (
        clients["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    for operation, amount in zip(detail["operations"], amounts, strict=True):
        started = patch(
            clients[actor],
            execution_path(detail, operation),
            {
                "action": "start",
                "expected_version": detail["version"],
                "expected_approved_revision_id": detail["approved_revision_id"],
            },
        )
        assert started.status_code == 200, started.text
        detail = started.json()
        recorded = patch(
            clients[actor],
            execution_path(detail, operation),
            {
                "action": "record",
                "expected_version": detail["version"],
                "expected_approved_revision_id": detail["approved_revision_id"],
                "actual_spent": str(amount),
                "execution_completed": True,
                "execution_observation": "Travaux terminés.",
            },
        )
        assert recorded.status_code == 200, recorded.text
        detail = recorded.json()
    return detail


def collection(activity):
    return f"/api/v1/activities/{activity['id']}/disbursement-requests"


def test_agent_submits_and_distinct_reviewers_authorize_disbursement(planning):
    activity = finish_activity(planning)
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert submitted.status_code == 201, submitted.text
    request = submitted.json()
    assert request["amount"] == "300000"
    assert request["state"] == "submitted"
    assert request["allowed_actions"] == ["read", "cancel"]
    frozen_execution = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert frozen_execution["mutation_unavailable_reason"] == "disbursement_frozen"
    assert all(not row["allowed_actions"] for row in frozen_execution["operations"])
    planning_detail = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
    )
    assert "open_amendment" not in planning_detail["allowed_actions"]

    denied = post(
        planning["admin"],
        f"{collection(activity)}/{request['id']}/decisions",
        {"expected_version": request["activity_version"], "decision": "prevalidate"},
    )
    assert denied.status_code == 403

    prevalidated = post(
        planning["supervisor"],
        f"{collection(activity)}/{request['id']}/decisions",
        {"expected_version": request["activity_version"], "decision": "prevalidate"},
    )
    assert prevalidated.status_code == 201, prevalidated.text
    approved = post(
        planning["validator"],
        f"{collection(activity)}/{request['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text
    assert approved.json()["state"] == "approved"
    assert [row["outcome"] for row in approved.json()["decisions"]] == [
        "prevalidated",
        "approved",
    ]
    assert approved.json()["allowed_actions"] == ["read"]
    assert (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/execution")
        .json()["mutation_unavailable_reason"]
        == "disbursement_frozen"
    )


def test_cancellation_releases_execution_for_correction_and_fresh_request(planning):
    activity = finish_activity(planning)
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    operation = activity["operations"][0]
    frozen = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": submitted["activity_version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "90000",
            "execution_completed": True,
            "execution_observation": "Travaux terminés.",
            "correction_reason": "Erreur de saisie.",
        },
    )
    assert frozen.status_code == 409

    cancelled = post(
        planning["agent2"],
        f"{collection(activity)}/{submitted['id']}/cancellation",
        {
            "expected_version": submitted["activity_version"],
            "reason": "Montant à corriger.",
        },
    )
    assert cancelled.status_code == 201, cancelled.text
    released = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert released["mutation_unavailable_reason"] is None
    assert released["operations"][0]["allowed_actions"] == ["record"]
    corrected = patch(
        planning["agent"],
        execution_path(activity, operation),
        {
            "action": "record",
            "expected_version": cancelled.json()["activity_version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": "90000",
            "execution_completed": True,
            "execution_observation": "Travaux terminés.",
            "correction_reason": "Erreur de saisie.",
        },
    )
    assert corrected.status_code == 200, corrected.text
    fresh = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": corrected.json()["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert fresh.status_code == 201, fresh.text
    assert fresh.json()["id"] != submitted["id"]
    stale = post(
        planning["agent"],
        f"{collection(activity)}/{submitted['id']}/cancellation",
        {
            "expected_version": fresh.json()["activity_version"],
            "reason": "Commande retardée visant l’ancienne demande.",
        },
    )
    assert stale.status_code == 409
    assert (
        planning["validator"]
        .get(f"{collection(activity)}/{fresh.json()['id']}")
        .json()["state"]
        == "submitted"
    )
    history = planning["validator"].get(collection(activity))
    assert history.status_code == 200
    assert history.json()["count"] == 2


def test_submission_rejects_incomplete_zero_and_overspent_activity(planning):
    activity = approved_execution_activity(planning)
    assert (
        post(
            planning["agent"],
            collection(activity),
            {
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
            },
        ).status_code
        == 409
    )
    zero = finish_activity(planning, amounts=(0, 0))
    assert (
        post(
            planning["agent"],
            collection(zero),
            {
                "expected_version": zero["version"],
                "expected_approved_revision_id": zero["approved_revision_id"],
            },
        ).status_code
        == 409
    )
    overspent = finish_activity(planning, amounts=(600_000, 600_000))
    assert (
        post(
            planning["agent"],
            collection(overspent),
            {
                "expected_version": overspent["version"],
                "expected_approved_revision_id": overspent["approved_revision_id"],
            },
        ).status_code
        == 409
    )


def test_positive_activity_total_accepts_an_individual_zero_operation(planning):
    one_zero = finish_activity(planning, amounts=(0, 200_000))
    accepted = post(
        planning["agent"],
        collection(one_zero),
        {
            "expected_version": one_zero["version"],
            "expected_approved_revision_id": one_zero["approved_revision_id"],
        },
    )
    assert accepted.status_code == 201, accepted.text


def test_submission_rejects_pending_amendment_and_inactive_project(planning):
    paused = finish_activity(planning)
    opened = open_amendment(planning, paused, "Modification en cours.")
    rejected = post(
        planning["agent"],
        collection(opened),
        {
            "expected_version": opened["version"],
            "expected_approved_revision_id": opened["approved_revision_id"],
        },
    )
    assert rejected.status_code == 409
    assert rejected.json()["code"] == "amendment_pending"

    inactive = finish_activity(planning)
    with Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text("UPDATE pta_project SET state='closed' WHERE id=:id"),
            {"id": inactive["project_id"]},
        )
    rejected = post(
        planning["agent"],
        collection(inactive),
        {
            "expected_version": inactive["version"],
            "expected_approved_revision_id": inactive["approved_revision_id"],
        },
    )
    assert rejected.status_code == 409
    assert rejected.json()["code"] == "project_inactive"


def test_duplicate_submission_is_serialized_and_planning_is_frozen(planning):
    activity = finish_activity(planning)
    body = {
        "expected_version": activity["version"],
        "expected_approved_revision_id": activity["approved_revision_id"],
    }
    first, second = ordered_advisory_race(
        planning["auth"],
        lambda: post(planning["agent"], collection(activity), body),
        lambda: post(planning["agent2"], collection(activity), body),
    )
    assert sorted((first.status_code, second.status_code)) == [201, 409]
    winner = first.json() if first.status_code == 201 else second.json()
    amendment = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/amendments",
        {
            "expected_version": winner["activity_version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Cette modification doit rester bloquée.",
        },
    )
    assert amendment.status_code == 409


def test_return_requires_reason_and_approved_request_is_final(planning):
    activity = finish_activity(planning)
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    path = f"{collection(activity)}/{submitted['id']}/decisions"
    missing_reason = post(
        planning["supervisor"],
        path,
        {"expected_version": submitted["activity_version"], "decision": "return"},
    )
    assert missing_reason.status_code == 422
    returned = post(
        planning["supervisor"],
        path,
        {
            "expected_version": submitted["activity_version"],
            "decision": "return",
            "reason": "Justifier les dépenses enregistrées.",
        },
    )
    assert returned.status_code == 201, returned.text
    assert returned.json()["state"] == "returned"
    assert (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/execution")
        .json()["mutation_unavailable_reason"]
        == "disbursement_frozen"
    )
    cancelled = post(
        planning["agent"],
        f"{collection(activity)}/{submitted['id']}/cancellation",
        {
            "expected_version": returned.json()["activity_version"],
            "reason": "Correction avant une nouvelle soumission.",
        },
    )
    assert cancelled.status_code == 201, cancelled.text
    fresh = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": cancelled.json()["activity_version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    path = f"{collection(activity)}/{fresh['id']}/decisions"
    prevalidated = post(
        planning["supervisor"],
        path,
        {
            "expected_version": fresh["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    approved = post(
        planning["validator"],
        path,
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    ).json()
    cancellation = post(
        planning["agent"],
        f"{collection(activity)}/{fresh['id']}/cancellation",
        {
            "expected_version": approved["activity_version"],
            "reason": "Une autorisation finale ne peut plus être annulée.",
        },
    )
    assert cancellation.status_code == 409


@pytest.mark.parametrize("missing_intermediate_approval", [False, True])
def test_historical_overspending_remains_blocked_after_budget_increase(
    planning, missing_intermediate_approval
):
    current = finish_activity(planning, amounts=(140_000, 140_000))

    def amend(first_allocation):
        nonlocal current
        opened = open_amendment(planning, current, "Modification du budget.")
        operations = [
            {
                "id": row["id"],
                "type_id": row["type_id"],
                "name": row["name"],
                "allocation": str(first_allocation)
                if index == 0
                else row["allocation"],
            }
            for index, row in enumerate(opened["operations"])
        ]
        allocation = sum(int(row["allocation"]) for row in operations)
        changed = patch(
            planning["agent2"],
            f"/api/v1/activities/{current['id']}",
            {
                "expected_version": opened["version"],
                "name": opened["name"],
                "description": opened["description"],
                "planned_start": opened["planned_start"],
                "planned_end": opened["planned_end"],
                "allocation": str(allocation),
                "operations": operations,
            },
        ).json()
        revision = post(
            planning["agent2"],
            f"/api/v1/activities/{current['id']}/submissions",
            {"expected_version": changed["version"]},
        ).json()
        prevalidated = post(
            planning["supervisor"],
            f"/api/v1/activities/{current['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        ).json()
        approved = post(
            planning["validator"],
            f"/api/v1/activities/{current['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        )
        assert approved.status_code == 201, approved.text
        current = (
            planning["agent"]
            .get(f"/api/v1/activities/{current['id']}/execution")
            .json()
        )
        return revision["id"]

    reduced_revision = amend(50_000)  # total 250,000 while spending remains 280,000
    amend(100_000)  # budget returns to 300,000
    if missing_intermediate_approval:
        with Session(planning["auth"].engine) as db, db.begin():
            db.execute(
                text("ALTER TABLE auth_audit DISABLE TRIGGER auth_audit_immutable")
            )
            db.execute(
                text(
                    "DELETE FROM auth_audit WHERE target=:activity_id "
                    "AND action='activity.approve' "
                    "AND business #>> '{revision,id}'=:revision_id"
                ),
                {
                    "activity_id": current["id"],
                    "revision_id": reduced_revision,
                },
            )
            db.execute(
                text("ALTER TABLE auth_audit ENABLE TRIGGER auth_audit_immutable")
            )
    rejected = post(
        planning["agent"],
        collection(current),
        {
            "expected_version": current["version"],
            "expected_approved_revision_id": current["approved_revision_id"],
        },
    )
    assert rejected.status_code == 409
    assert rejected.json()["code"] == (
        "execution_history_unverified"
        if missing_intermediate_approval
        else "historical_overspending"
    )


def test_audit_failure_rolls_back_each_mutation_and_activity_version(
    planning, monkeypatch
):
    activity = finish_activity(planning)
    original = planning["auth"].business_audit
    failed_action = ["disbursement.submit"]

    def fail(db, action, actor, target, business):
        if action == failed_action[0]:
            raise RuntimeError("synthetic audit failure")
        return original(db, action, actor, target, business)

    monkeypatch.setattr(planning["auth"], "business_audit", fail)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        post(
            planning["agent"],
            collection(activity),
            {
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
            },
        )
    assert planning["validator"].get(collection(activity)).json()["count"] == 0
    assert (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/execution")
        .json()["version"]
        == activity["version"]
    )

    failed_action[0] = "disbursement.prevalidated"
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    detail_path = f"{collection(activity)}/{submitted['id']}"
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        post(
            planning["supervisor"],
            f"{detail_path}/decisions",
            {
                "expected_version": submitted["activity_version"],
                "decision": "prevalidate",
            },
        )
    unchanged = planning["validator"].get(detail_path).json()
    assert unchanged["state"] == "submitted"
    assert unchanged["decisions"] == []
    assert unchanged["activity_version"] == submitted["activity_version"]

    failed_action[0] = "disbursement.cancel"
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        post(
            planning["agent"],
            f"{detail_path}/cancellation",
            {
                "expected_version": submitted["activity_version"],
                "reason": "Échec d’audit synthétique.",
            },
        )
    unchanged = planning["validator"].get(detail_path).json()
    assert unchanged["state"] == "submitted"
    assert unchanged["cancellation"] is None
    assert unchanged["activity_version"] == submitted["activity_version"]
    monkeypatch.setattr(planning["auth"], "business_audit", original)


@pytest.mark.parametrize("mutation", ["submit", "decision"])
@pytest.mark.parametrize("failure", ["constraint", "commit"])
def test_constraint_or_commit_failure_rolls_back_financial_transaction(
    planning, monkeypatch, mutation, failure
):
    activity = finish_activity(planning)
    request = None
    if mutation == "decision":
        request = post(
            planning["agent"],
            collection(activity),
            {
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
            },
        ).json()
    action = (
        "disbursement.submit" if mutation == "submit" else "disbursement.prevalidated"
    )
    with planning["auth"].engine.connect() as db:
        before = db.execute(
            text(
                "SELECT version,"
                "(SELECT count(*) FROM pta_disbursement_request WHERE activity_id=:id),"
                "(SELECT count(*) FROM pta_disbursement_decision "
                "WHERE activity_id=:id),"
                "(SELECT count(*) FROM auth_audit WHERE business->>'activity_id'=:id) "
                "FROM pta_activity WHERE id=:id"
            ),
            {"id": activity["id"]},
        ).one()
    original_audit = planning["auth"].business_audit

    def inject_failure(db, recorded_action, *args, **kwargs):
        result = original_audit(db, recorded_action, *args, **kwargs)
        if recorded_action == action:
            if failure == "constraint":
                db.execute(
                    text(
                        "INSERT INTO mjl_ownership_context(id,created_at) "
                        "VALUES ('BAD',clock_timestamp())"
                    )
                )
            else:
                db.info["fail_disbursement_commit"] = True
        return result

    monkeypatch.setattr(planning["auth"], "business_audit", inject_failure)
    if failure == "commit":
        original_commit = SessionTransaction.commit

        def fail_commit(transaction, *args, **kwargs):
            if transaction.session.info.pop("fail_disbursement_commit", False):
                raise IntegrityError(
                    "synthetic disbursement commit failure", {}, Exception()
                )
            return original_commit(transaction, *args, **kwargs)

        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    response = (
        post(
            planning["agent"],
            collection(activity),
            {
                "expected_version": activity["version"],
                "expected_approved_revision_id": activity["approved_revision_id"],
            },
        )
        if mutation == "submit"
        else post(
            planning["supervisor"],
            f"{collection(activity)}/{request['id']}/decisions",
            {
                "expected_version": request["activity_version"],
                "decision": "prevalidate",
            },
        )
    )
    assert response.status_code == 503
    with planning["auth"].engine.connect() as db:
        after = db.execute(
            text(
                "SELECT version,"
                "(SELECT count(*) FROM pta_disbursement_request WHERE activity_id=:id),"
                "(SELECT count(*) FROM pta_disbursement_decision "
                "WHERE activity_id=:id),"
                "(SELECT count(*) FROM auth_audit WHERE business->>'activity_id'=:id) "
                "FROM pta_activity WHERE id=:id"
            ),
            {"id": activity["id"]},
        ).one()
    assert after == before


def test_financial_evidence_refuses_destructive_downgrade(planning, auth_env):
    activity = finish_activity(planning)
    response = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert response.status_code == 201
    planning["auth"].engine.dispose()
    with pytest.raises(Exception, match="Refusing destructive PTA-3B downgrade"):
        command.downgrade(Config("alembic.ini"), "0010_pta3a")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0017_pta6a"
            )
    finally:
        engine.dispose()


def test_missing_execution_audits_fail_closed(planning):
    activity = approved_execution_activity(planning)
    with Session(planning["auth"].engine) as db, db.begin():
        rows = list(
            db.scalars(select(Operation).where(Operation.activity_id == activity["id"]))
        )
        now = planning["auth"].now(db)
        for row in rows:
            row.execution_started_at = now
            row.execution_completed = True
            row.actual_spent = row.allocation
            row.execution_observation = "Écriture directe synthétique."
    rejected = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert rejected.status_code == 409
    assert rejected.json()["code"] == "execution_history_unverified"


def test_replaced_audit_immutability_function_fails_schema_guard(planning):
    with planning["auth"].engine.connect() as db:
        transaction = db.begin()
        db.execute(
            text(
                "CREATE OR REPLACE FUNCTION auth_audit_immutable() RETURNS trigger "
                "LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$"
            )
        )
        with pytest.raises(AuthError, match="eligibility_unverified"):
            planning["auth"].environment_verified(db)
        transaction.rollback()


def test_execution_author_cannot_review_after_role_change(planning, auth_env):
    activity = finish_activity(planning, actor="agent2")
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    agent2_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]
    with Session(planning["auth"].engine) as db, db.begin():
        db.get(User, agent2_id, with_for_update=True).role = "AGENT_VERIFICATEUR"
    with TestClient(planning["admin"].app, base_url="http://localhost") as reviewer:
        reviewer.app.state.auth.policy = reviewer.app.state.auth.policy.model_copy(
            update={
                "lifecycle_database": reviewer.app.state.auth.engine.url.database,
                "resend_seconds": 0,
            }
        )
        login_existing(reviewer, auth_env.mailbox, "agent2@example.test")
        denied = post(
            reviewer,
            f"{collection(activity)}/{submitted['id']}/decisions",
            {
                "expected_version": submitted["activity_version"],
                "decision": "prevalidate",
            },
        )
        assert denied.status_code == 409


def test_approval_and_cancellation_race_has_one_final_outcome(planning):
    activity = finish_activity(planning)
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    decision_path = f"{collection(activity)}/{submitted['id']}/decisions"
    prevalidated = post(
        planning["supervisor"],
        decision_path,
        {
            "expected_version": submitted["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    approve, cancel = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["validator"],
            decision_path,
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        ),
        lambda: post(
            planning["agent2"],
            f"{collection(activity)}/{submitted['id']}/cancellation",
            {
                "expected_version": prevalidated["activity_version"],
                "reason": "Concurrence synthétique.",
            },
        ),
    )
    assert sorted((approve.status_code, cancel.status_code)) == [201, 409]


def test_submission_serializes_with_execution_correction_and_amendment(planning):
    correction_activity = finish_activity(planning)
    operation = correction_activity["operations"][0]
    body = {
        "expected_version": correction_activity["version"],
        "expected_approved_revision_id": correction_activity["approved_revision_id"],
    }
    submitted, correction = ordered_advisory_race(
        planning["auth"],
        lambda: post(planning["agent"], collection(correction_activity), body),
        lambda: patch(
            planning["agent2"],
            execution_path(correction_activity, operation),
            {
                "action": "record",
                **body,
                "actual_spent": "90000",
                "execution_completed": True,
                "execution_observation": "Correction concurrente.",
                "correction_reason": "Erreur synthétique.",
            },
        ),
    )
    assert (submitted.status_code, correction.status_code) == (201, 409)

    amendment_activity = finish_activity(planning)
    amendment, rejected = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent"],
            f"/api/v1/activities/{amendment_activity['id']}/amendments",
            {
                "expected_version": amendment_activity["version"],
                "expected_approved_revision_id": amendment_activity[
                    "approved_revision_id"
                ],
                "reason": "Modification concurrente.",
            },
        ),
        lambda: post(
            planning["agent2"],
            collection(amendment_activity),
            {
                "expected_version": amendment_activity["version"],
                "expected_approved_revision_id": amendment_activity[
                    "approved_revision_id"
                ],
            },
        ),
    )
    assert (amendment.status_code, rejected.status_code) == (201, 409)


def test_reviewer_deactivation_wins_before_financial_decision(planning):
    activity = finish_activity(planning)
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["email"] == "supervisor@example.test"
    )
    deactivated, denied = ordered_advisory_race(
        planning["auth"],
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{account['id']}",
            headers=headers(planning["admin"]),
            json={"expected_version": account["version"], "deactivate": True},
        ),
        lambda: post(
            planning["supervisor"],
            f"{collection(activity)}/{submitted['id']}/decisions",
            {
                "expected_version": submitted["activity_version"],
                "decision": "prevalidate",
            },
        ),
    )
    assert (deactivated.status_code, denied.status_code) == (200, 401)
    unchanged = (
        planning["validator"].get(f"{collection(activity)}/{submitted['id']}").json()
    )
    assert unchanged["state"] == "submitted"
    assert unchanged["decisions"] == []


def test_database_rejects_approval_without_valid_distinct_prevalidation(planning):
    activity = finish_activity(planning)
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    validator_id = (
        planning["validator"].get("/api/v1/auth/session").json()["user"]["id"]
    )
    supervisor_id = (
        planning["supervisor"].get("/api/v1/auth/session").json()["user"]["id"]
    )

    with pytest.raises(DBAPIError, match="state and decisions disagree"):
        with Session(planning["auth"].engine) as db, db.begin():
            request = db.get(DisbursementRequest, submitted["id"], with_for_update=True)
            now = planning["auth"].now(db)
            request.state = "prevalidated"
            prevalidation_id = str(uuid4())
            db.add(
                DisbursementDecision(
                    id=prevalidation_id,
                    activity_id=activity["id"],
                    request_id=request.id,
                    stage="supervisor",
                    outcome="prevalidated",
                    actor_id=validator_id,
                    actor_role="AGENT_VERIFICATEUR",
                    decided_at=now,
                    reason=None,
                    prevalidation_decision_id=None,
                )
            )
            db.flush()
            request.state = "approved"
            db.add(
                DisbursementDecision(
                    activity_id=activity["id"],
                    request_id=request.id,
                    stage="validator",
                    outcome="approved",
                    actor_id=validator_id,
                    actor_role="VALIDATEUR_DEFINITIF",
                    decided_at=now,
                    reason=None,
                    prevalidation_decision_id=prevalidation_id,
                )
            )

    with pytest.raises(DBAPIError, match="state and decisions disagree"):
        with Session(planning["auth"].engine) as db, db.begin():
            request = db.get(DisbursementRequest, submitted["id"], with_for_update=True)
            request.state = "returned"
            db.add(
                DisbursementDecision(
                    activity_id=activity["id"],
                    request_id=request.id,
                    stage="validator",
                    outcome="returned",
                    actor_id=validator_id,
                    actor_role="VALIDATEUR_DEFINITIF",
                    decided_at=planning["auth"].now(db),
                    reason="Retour sans prévalidation interdit.",
                    prevalidation_decision_id=None,
                )
            )

    with pytest.raises(DBAPIError, match="state and decisions disagree"):
        with Session(planning["auth"].engine) as db, db.begin():
            request = db.get(DisbursementRequest, submitted["id"], with_for_update=True)
            now = planning["auth"].now(db)
            request.state = "prevalidated"
            prevalidation_id = str(uuid4())
            db.add(
                DisbursementDecision(
                    id=prevalidation_id,
                    activity_id=activity["id"],
                    request_id=request.id,
                    stage="supervisor",
                    outcome="prevalidated",
                    actor_id=supervisor_id,
                    actor_role="AGENT_VERIFICATEUR",
                    decided_at=now,
                    reason=None,
                    prevalidation_decision_id=None,
                )
            )
            db.flush()
            request.state = "approved"
            db.add(
                DisbursementDecision(
                    activity_id=activity["id"],
                    request_id=request.id,
                    stage="validator",
                    outcome="approved",
                    actor_id=validator_id,
                    actor_role="VALIDATEUR_DEFINITIF",
                    decided_at=now - timedelta(seconds=1),
                    reason=None,
                    prevalidation_decision_id=prevalidation_id,
                )
            )

    with pytest.raises(DBAPIError, match="state and decisions disagree"):
        with Session(planning["auth"].engine) as db, db.begin():
            request = db.get(DisbursementRequest, submitted["id"], with_for_update=True)
            now = planning["auth"].now(db)
            request.state = "prevalidated"
            db.add(
                DisbursementDecision(
                    activity_id=activity["id"],
                    request_id=request.id,
                    stage="supervisor",
                    outcome="prevalidated",
                    actor_id=supervisor_id,
                    actor_role="AGENT_VERIFICATEUR",
                    decided_at=now,
                    reason=None,
                    prevalidation_decision_id=None,
                )
            )
            db.flush()
            request.state = "cancelled"
            request.cancelled_by_id = supervisor_id
            request.cancelled_at = now - timedelta(seconds=1)
            request.cancellation_reason = "Chronologie invalide."

    with pytest.raises(DBAPIError, match="state and decisions disagree"):
        with Session(planning["auth"].engine) as db, db.begin():
            request = db.get(DisbursementRequest, submitted["id"], with_for_update=True)
            request.state = "cancelled"
            request.cancelled_by_id = supervisor_id
            request.cancelled_at = request.submitted_at - timedelta(seconds=1)
            request.cancellation_reason = "Annulation antérieure à la soumission."


@pytest.mark.parametrize(
    ("state", "amount_delta", "omitted"),
    [
        ("approved", 0, None),
        ("submitted", 1, None),
        ("submitted", 0, "allocation"),
        ("submitted", 0, "approved_allocation"),
    ],
)
def test_database_rejects_invalid_initial_request_basis(
    planning, state, amount_delta, omitted
):
    activity = finish_activity(planning)
    actor_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    snapshot_operations = [
        {
            "id": row["id"],
            "approved_allocation": row["approved_allocation"],
            "actual_spent": row["actual_spent"],
            "execution_completed": True,
        }
        for row in activity["operations"]
    ]
    snapshot = {
        "allocation": activity["approved_allocation"],
        "operations": snapshot_operations,
        "excluded_reviewer_ids": [actor_id],
    }
    if omitted == "allocation":
        snapshot.pop("allocation")
    elif omitted == "approved_allocation":
        snapshot_operations[0].pop("approved_allocation")
    with pytest.raises(DBAPIError, match="initial disbursement|snapshot disagree"):
        with Session(planning["auth"].engine) as db, db.begin():
            db.add(
                DisbursementRequest(
                    context_id="MJL",
                    activity_id=activity["id"],
                    approved_revision_id=activity["approved_revision_id"],
                    snapshot=snapshot,
                    amount=sum(int(row["actual_spent"]) for row in snapshot_operations)
                    + amount_delta,
                    submitter_id=actor_id,
                    submitted_at=planning["auth"].now(db),
                    state=state,
                )
            )
            db.flush()


def test_routes_are_scoped_and_openapi_success_contracts_are_typed(planning):
    activity = finish_activity(planning)
    submitted = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    ).json()
    other = approved_execution_activity(planning)
    forged = planning["validator"].get(f"{collection(other)}/{submitted['id']}")
    assert forged.status_code == 404
    for query in ("limit=0", "limit=101", "cursor=malformed"):
        assert (
            planning["validator"].get(f"{collection(activity)}?{query}").status_code
            == 422
        )
    schema = planning["agent"].get("/openapi.json").json()
    paths = schema["paths"]
    base = "/api/v1/activities/{identifier}/disbursement-requests"
    responsibilities = {
        base: {"get", "post"},
        base + "/{request_id}": {"get"},
        base + "/{request_id}/decisions": {"post"},
        base + "/{request_id}/cancellation": {"post"},
    }
    for path, methods in responsibilities.items():
        assert methods <= set(paths[path])
        for method in methods:
            success = paths[path][method]["responses"][
                "200" if method == "get" else "201"
            ]
            assert success["content"]["application/json"]["schema"]


def test_mutation_routes_enforce_roles_and_csrf(planning):
    activity = finish_activity(planning)
    submit_body = {
        "expected_version": activity["version"],
        "expected_approved_revision_id": activity["approved_revision_id"],
    }
    assert (
        post(planning["supervisor"], collection(activity), submit_body).status_code
        == 403
    )
    missing_csrf = planning["agent"].post(
        collection(activity),
        headers={"Origin": "http://localhost"},
        json=submit_body,
    )
    assert missing_csrf.status_code == 403
    submitted = post(planning["agent"], collection(activity), submit_body).json()
    decision_path = f"{collection(activity)}/{submitted['id']}/decisions"
    decision_body = {
        "expected_version": submitted["activity_version"],
        "decision": "prevalidate",
    }
    assert post(planning["agent"], decision_path, decision_body).status_code == 403
    invalid_csrf = planning["supervisor"].post(
        decision_path,
        headers={"Origin": "http://localhost", "X-CSRF-Token": "invalid"},
        json=decision_body,
    )
    assert invalid_csrf.status_code == 403
    cancellation_path = f"{collection(activity)}/{submitted['id']}/cancellation"
    cancel_body = {
        "expected_version": submitted["activity_version"],
        "reason": "Annulation synthétique.",
    }
    assert (
        post(planning["validator"], cancellation_path, cancel_body).status_code == 403
    )
    invalid_csrf = planning["agent"].post(
        cancellation_path,
        headers={"Origin": "http://localhost", "X-CSRF-Token": "invalid"},
        json=cancel_body,
    )
    assert invalid_csrf.status_code == 403
