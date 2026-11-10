# ruff: noqa: F401, F811
import pytest

from tests.auth.test_access import admin
from tests.auth.test_auth import messages
from tests.execution.test_execution import approved_execution_activity
from tests.planning.test_amendments import open_amendment
from tests.planning.test_planning import patch, planning, post, references


def detail(clients, activity):
    response = clients["agent"].get(f"/api/v1/activities/{activity['id']}")
    assert response.status_code == 200, response.text
    return response.json()


def increase(clients, activity, increment=20000):
    opened = open_amendment(clients, detail(clients, activity))
    operations = [
        {k: row[k] for k in ("id", "name", "type_id", "allocation")}
        for row in opened["operations"]
    ]
    operations[0]["allocation"] = str(int(operations[0]["allocation"]) + increment)
    changed = patch(
        clients["agent"],
        f"/api/v1/activities/{activity['id']}",
        {
            **{
                k: opened[k]
                for k in ("name", "description", "planned_start", "planned_end")
            },
            "expected_version": opened["version"],
            "allocation": str(int(opened["allocation"]) + increment),
            "operations": operations,
        },
    )
    assert changed.status_code == 200, changed.text
    revision = post(
        clients["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": changed.json()["version"]},
    )
    assert revision.status_code == 201, revision.text
    value = revision.json()
    for role, decision in [("supervisor", "prevalidate"), ("validator", "approve")]:
        response = post(
            clients[role],
            f"/api/v1/activities/{activity['id']}/revisions/{revision.json()['id']}/decisions",
            {"expected_version": value["activity_version"], "decision": decision},
        )
        assert response.status_code == 201, response.text
        value = response.json()
    return detail(clients, activity)


def test_forecast_increase_requires_separate_exact_funding(planning):
    activity = approved_execution_activity(planning)
    activity = increase(planning, activity)
    response = planning["agent"].get(
        f"/api/v1/activities/{activity['id']}/funding-requests"
    )
    assert response.status_code == 200, response.text
    execution = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert execution["pause_reason"] == "funding_required"
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/funding-requests",
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert submitted.status_code == 201, submitted.text
    request = submitted.json()
    assert set(request["snapshot"]) == {"old_allocation", "new_allocation"}
    assert request["amount"] == "20000"
    for role, decision in [("supervisor", "prevalidate"), ("validator", "approve")]:
        approved = post(
            planning[role],
            f"/api/v1/activities/{activity['id']}/funding-requests/{request['id']}/decisions",
            {"expected_version": request["activity_version"], "decision": decision},
        )
        assert approved.status_code == 201, approved.text
        request = approved.json()
    assert request["state"] == "approved"
    execution = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert not execution["execution_paused"]


def path(activity):
    return f"/api/v1/activities/{activity['id']}/funding-requests"


def submit(clients, activity):
    current = detail(clients, activity)
    response = post(
        clients["agent"],
        path(activity),
        {
            "expected_version": current["version"],
            "expected_approved_revision_id": current["approved_revision_id"],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def decide(clients, activity, request, role, decision, **extra):
    return post(
        clients[role],
        f"{path(activity)}/{request['id']}/decisions",
        {
            "expected_version": request["activity_version"],
            "decision": decision,
            **extra,
        },
    )


def authorize(clients, activity):
    request = submit(clients, activity)
    for role, decision in [("supervisor", "prevalidate"), ("validator", "approve")]:
        response = decide(clients, activity, request, role, decision)
        assert response.status_code == 201, response.text
        request = response.json()
    return request


def execution(clients, activity):
    response = clients["agent"].get(f"/api/v1/activities/{activity['id']}/execution")
    assert response.status_code == 200, response.text
    return response.json()


def test_funding_notifications_follow_the_available_reviewer(planning):
    activity = increase(planning, approved_execution_activity(planning))
    request = submit(planning, activity)

    supervisor_notice = next(
        row
        for row in planning["supervisor"].get("/api/v1/notifications").json()[
            "data"
        ]
        if row["kind"] == "financial_review"
        and row["request_id"] == request["id"]
    )
    assert supervisor_notice["request_kind"] == "funding"
    assert supervisor_notice["stage"] == "supervisor"
    assert not any(
        row.get("request_id") == request["id"]
        for row in planning["validator"].get("/api/v1/notifications").json()["data"]
    )

    prevalidated = decide(
        planning, activity, request, "supervisor", "prevalidate"
    )
    assert prevalidated.status_code == 201, prevalidated.text
    request = prevalidated.json()
    validator_notice = next(
        row
        for row in planning["validator"].get("/api/v1/notifications").json()["data"]
        if row["kind"] == "financial_review"
        and row["request_id"] == request["id"]
    )
    assert validator_notice["stage"] == "validator"

    returned = decide(
        planning,
        activity,
        request,
        "validator",
        "return",
        reason="Justification du financement à préciser.",
    )
    assert returned.status_code == 201, returned.text
    correction = next(
        row
        for row in planning["agent"].get("/api/v1/notifications").json()["data"]
        if row["kind"] == "financial_correction"
        and row["request_id"] == request["id"]
    )
    assert correction["reason"] == "Justification du financement à préciser."
    mail_kinds = {row["kind"] for row in messages(planning["auth"].mail.directory)}
    assert {
        "financial_review_supervisor",
        "financial_review_validator",
        "financial_correction",
    } <= mail_kinds
    correction_mail = next(
        row
        for row in messages(planning["auth"].mail.directory)
        if row["kind"] == "financial_correction"
    )
    for content in (correction_mail["html"], correction_mail["text"]):
        assert content is not None
        assert "une nouvelle soumission" in content
        assert activity["reference"] in content
        assert f"/execution/activities/{activity['id']}" in content


@pytest.mark.parametrize("release", ["return", "cancel"])
def test_return_cancel_retains_pause_and_requires_fresh_decisions(planning, release):
    activity = increase(planning, approved_execution_activity(planning))
    request = submit(planning, activity)
    if release == "return":
        response = decide(
            planning,
            activity,
            request,
            "supervisor",
            "return",
            reason="Justification à revoir.",
        )
    else:
        response = post(
            planning["agent"],
            f"{path(activity)}/{request['id']}/cancellation",
            {
                "expected_version": request["activity_version"],
                "reason": "Nouvelle demande nécessaire.",
            },
        )
    assert response.status_code == 201, response.text
    assert execution(planning, activity)["pause_reason"] == "funding_required"
    notice = next(
        row
        for row in planning["supervisor"].get("/api/v1/notifications").json()["data"]
        if row.get("request_id") == request["id"]
    )
    assert notice["handled_at"] is not None
    assert notice["read_at"] is None
    assert (
        decide(planning, activity, response.json(), "validator", "approve").status_code
        == 409
    )
    fresh = authorize(planning, activity)
    assert fresh["id"] != request["id"]
    assert not execution(planning, activity)["execution_paused"]
    assert planning["agent"].get(path(activity)).json()["count"] == 2


def test_repeated_increases_and_later_decrease_do_not_erase_obligations(planning):
    activity = increase(planning, approved_execution_activity(planning), 20000)
    first = authorize(planning, activity)
    activity = increase(planning, activity, 30000)
    activity = increase(planning, activity, -10000)
    pending = planning["agent"].get(path(activity)).json()["pending"]
    assert [p["amount"] for p in pending] == ["30000"]
    assert execution(planning, activity)["execution_paused"]
    second = authorize(planning, activity)
    assert second["amount"] == "30000"
    assert first["approved_revision_id"] != second["approved_revision_id"]
    assert not execution(planning, activity)["execution_paused"]


@pytest.mark.parametrize("corrected", [195000, 205000])
def test_actual_shortfall_correction_history_and_finance_gate(planning, corrected):
    from tests.execution.test_disbursement import collection, finish_activity
    from tests.execution.test_execution import execution_path

    current = finish_activity(planning, amounts=(100000, 210000))
    assert current["pause_reason"] == "funding_required"
    operation = current["operations"][1]
    body = {
        "action": "record",
        "expected_version": current["version"],
        "expected_approved_revision_id": current["approved_revision_id"],
        "actual_spent": str(corrected),
        "execution_completed": True,
        "execution_observation": "Montant réel rectifié.",
        "correction_reason": "Erreur de saisie.",
    }
    response = patch(planning["agent"], execution_path(current, operation), body)
    assert response.status_code == 200, response.text
    current = response.json()
    assert current["operations"][1]["actual_spent"] == str(corrected)
    assert current["pause_reason"] == "funding_required"
    denied = post(
        planning["agent"],
        collection(current),
        {
            "expected_version": current["version"],
            "expected_approved_revision_id": current["approved_revision_id"],
        },
    )
    assert denied.status_code == 409
    current = increase(planning, current, 20000)
    authorize(planning, current)
    current = execution(planning, current)
    assert not current["execution_paused"]
    submitted = post(
        planning["agent"],
        collection(current),
        {
            "expected_version": current["version"],
            "expected_approved_revision_id": current["approved_revision_id"],
        },
    )
    assert submitted.status_code == 201, submitted.text
    assert submitted.json()["amount"] == str(100000 + corrected)
    assert (
        post(
            planning["agent"],
            path(current),
            {
                "expected_version": submitted.json()["activity_version"],
                "expected_approved_revision_id": current["approved_revision_id"],
            },
        ).status_code
        == 409
    )
    history = (
        planning["agent"]
        .get(f"/api/v1/activities/{current['id']}/execution/history")
        .json()["data"]
    )
    assert any(row["after"]["actual_spent"] == "210000" for row in history)


def test_authorization_stale_replay_and_openapi(planning):
    from tests.auth.test_access import headers

    activity = increase(planning, approved_execution_activity(planning))
    body = {
        "expected_version": activity["version"],
        "expected_approved_revision_id": activity["approved_revision_id"],
    }
    for role in ("admin", "supervisor", "validator"):
        assert post(planning[role], path(activity), body).status_code == 403
    assert planning["agent"].post(path(activity), json=body).status_code == 403
    assert (
        post(planning["agent"], path(activity), {**body, "amount": "1"}).status_code
        == 422
    )
    request = submit(planning, activity)
    assert post(planning["agent"], path(activity), body).status_code == 409
    assert (
        decide(planning, activity, request, "agent", "prevalidate").status_code == 403
    )
    assert (
        decide(planning, activity, request, "validator", "approve").status_code == 409
    )
    assert (
        decide(planning, activity, request, "supervisor", "return").status_code == 422
    )
    for limit in (0, 101):
        assert (
            planning["agent"].get(path(activity) + f"?limit={limit}").status_code == 422
        )
    schema = planning["agent"].get("/openapi.json").json()
    route = schema["paths"]["/api/v1/activities/{identifier}/funding-requests"]["post"]
    assert route["security"]
    assert "201" in route["responses"]


@pytest.mark.parametrize("failure", ["audit", "constraint", "commit"])
def test_funding_failure_rolls_back_request_version_and_audit(
    planning, monkeypatch, failure
):
    from sqlalchemy import select, text
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.orm import Session, SessionTransaction

    from app.auth.models import Audit
    from app.planning.models import Activity, FundingRequest

    activity = increase(planning, approved_execution_activity(planning))
    original = planning["auth"].business_audit
    original_commit = SessionTransaction.commit

    def audit(db, action, *args, **kwargs):
        original(db, action, *args, **kwargs)
        if action == "funding.submit":
            if failure == "audit":
                raise IntegrityError("test audit failure", {}, None)
            if failure == "constraint":
                db.execute(text("UPDATE pta_funding_request SET amount=0"))

    def commit(self, *args, **kwargs):
        if self.parent is None and any(
            isinstance(row, FundingRequest)
            for row in self.session.identity_map.values()
        ):
            raise IntegrityError("test commit failure", {}, None)
        return original_commit(self, *args, **kwargs)

    monkeypatch.setattr(planning["auth"], "business_audit", audit)
    if failure == "commit":
        monkeypatch.setattr(SessionTransaction, "commit", commit)
    current = detail(planning, activity)
    response = post(
        planning["agent"],
        path(activity),
        {
            "expected_version": current["version"],
            "expected_approved_revision_id": current["approved_revision_id"],
        },
    )
    assert response.status_code == 503, response.text
    with Session(planning["auth"].engine) as db:
        assert db.get(Activity, activity["id"]).version == activity["version"]
        assert db.scalar(select(FundingRequest.id)) is None
        assert (
            db.scalar(select(Audit.id).where(Audit.action == "funding.submit")) is None
        )


@pytest.mark.parametrize("other", ["amendment", "execution", "finance"])
def test_funding_approval_serializes_against_other_work(planning, other):
    from tests.execution.test_execution import execution_path
    from tests.planning.test_planning import ordered_advisory_race

    activity = increase(planning, approved_execution_activity(planning))
    request = submit(planning, activity)
    response = decide(planning, activity, request, "supervisor", "prevalidate")
    assert response.status_code == 201, response.text
    request = response.json()
    current = execution(planning, activity)
    version = request["activity_version"]

    def concurrent():
        body = {
            "expected_version": version,
            "expected_approved_revision_id": current["approved_revision_id"],
        }
        if other == "amendment":
            return post(
                planning["agent"],
                f"/api/v1/activities/{activity['id']}/amendments",
                {**body, "reason": "Proposition concurrente."},
            )
        if other == "execution":
            return patch(
                planning["agent"],
                execution_path(current, current["operations"][0]),
                {**body, "action": "start"},
            )
        return post(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/disbursement-requests",
            body,
        )

    won, lost = ordered_advisory_race(
        planning["auth"],
        lambda: decide(planning, activity, request, "validator", "approve"),
        concurrent,
    )
    assert won.status_code == 201, won.text
    assert lost.status_code == 409, lost.text
    assert lost.json()["code"] == "activity_stale"


def test_partner_and_changed_contributor_role_cannot_review(planning, auth_env):
    from contextlib import ExitStack

    from fastapi.testclient import TestClient
    from sqlalchemy.orm import Session

    from app.auth.models import User
    from tests.partner_portal.test_partner_portal import (
        activity_partner,
        invite_partner,
    )
    from tests.planning.test_planning import login_existing

    activity = increase(planning, approved_execution_activity(planning))
    request = submit(planning, activity)
    with ExitStack() as stack:
        partner, _, _ = invite_partner(
            planning,
            auth_env,
            stack,
            activity_partner(planning["auth"], activity["id"]),
            "fundingpartner@example.test",
        )
        assert partner.get(path(activity)).status_code == 403
        assert (
            post(
                partner,
                path(activity),
                {
                    "expected_version": request["activity_version"],
                    "expected_approved_revision_id": activity["approved_revision_id"],
                },
            ).status_code
            == 403
        )
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    with Session(planning["auth"].engine) as db, db.begin():
        db.get(User, agent_id).role = "AGENT_VERIFICATEUR"
    with TestClient(planning["admin"].app, base_url="http://localhost") as reviewer:
        reviewer.app.state.auth.policy = reviewer.app.state.auth.policy.model_copy(
            update={"resend_seconds": 0}
        )
        login_existing(reviewer, auth_env.mailbox, "agent@example.test")
        denied = post(
            reviewer,
            f"{path(activity)}/{request['id']}/decisions",
            {
                "expected_version": request["activity_version"],
                "decision": "prevalidate",
            },
        )
        assert denied.status_code == 409, denied.text


def test_sql_rejects_fabricated_approval_and_changed_basis(planning):
    from sqlalchemy.exc import DBAPIError
    from sqlalchemy.orm import Session

    from app.planning.models import FundingRequest

    activity = increase(planning, approved_execution_activity(planning))
    request = submit(planning, activity)
    for field, value in [("state", "approved"), ("amount", 1), ("snapshot", {})]:
        with pytest.raises(DBAPIError):
            with Session(planning["auth"].engine) as db, db.begin():
                row = db.get(FundingRequest, request["id"])
                setattr(row, field, value)
    assert (
        planning["agent"].get(f"{path(activity)}/{request['id']}").json()["state"]
        == "submitted"
    )


def test_migration_roundtrip_preserves_predecessor_and_refuses_frozen_increases(
    planning,
):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy.orm import Session

    from app.planning.models import DisbursementRequest
    from tests.execution.test_disbursement import finish_activity

    # Valid predecessor data without a funding obligation survives the roundtrip.
    activity = finish_activity(planning)
    config = Config("alembic.ini")
    command.downgrade(config, "0023_real_mail_accounts")
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    assert detail(planning, activity)["id"] == activity["id"]
    activity = increase(planning, activity)
    # Construct a predecessor-valid frozen request: the old version accepted
    # this exact finalized spend after a forecast increase.
    with Session(planning["auth"].engine) as db, db.begin():
        actor = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
        db.add(
            DisbursementRequest(
                context_id="MJL",
                activity_id=activity["id"],
                approved_revision_id=activity["approved_revision_id"],
                snapshot={
                    "allocation": "320000",
                    "operations": [
                        {
                            "id": row["id"],
                            "actual_spent": amount,
                            "approved_allocation": row["allocation"],
                        }
                        for row, amount in zip(
                            activity["operations"], ["100000", "200000"], strict=True
                        )
                    ],
                    "excluded_reviewer_ids": [actor],
                },
                amount=300000,
                submitter_id=actor,
                submitted_at=planning["auth"].now(db),
                state="submitted",
            )
        )
    command.downgrade(config, "0023_real_mail_accounts")
    from sqlalchemy.exc import DBAPIError

    with pytest.raises(DBAPIError, match="prior budget increase has frozen finance"):
        command.upgrade(config, "head")


@pytest.mark.parametrize("failure", ["audit", "constraint", "commit"])
def test_funding_approval_rollback_keeps_pause_and_prevalidation(
    planning, monkeypatch, failure
):
    from sqlalchemy import select, text
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.orm import Session, SessionTransaction

    from app.planning.models import FundingDecision, FundingRequest

    activity = increase(planning, approved_execution_activity(planning))
    request = submit(planning, activity)
    response = decide(planning, activity, request, "supervisor", "prevalidate")
    assert response.status_code == 201, response.text
    request = response.json()
    original = planning["auth"].business_audit
    original_commit = SessionTransaction.commit

    def audit(db, action, *args, **kwargs):
        original(db, action, *args, **kwargs)
        if action == "funding.approved":
            if failure == "audit":
                raise IntegrityError("injected audit failure", {}, None)
            if failure == "constraint":
                db.execute(text("UPDATE pta_funding_request SET amount=0"))

    def commit(self, *args, **kwargs):
        if self.parent is None and any(
            isinstance(row, FundingRequest) and row.state == "approved"
            for row in self.session.identity_map.values()
        ):
            raise IntegrityError("injected commit failure", {}, None)
        return original_commit(self, *args, **kwargs)

    monkeypatch.setattr(planning["auth"], "business_audit", audit)
    if failure == "commit":
        monkeypatch.setattr(SessionTransaction, "commit", commit)
    response = decide(planning, activity, request, "validator", "approve")
    assert response.status_code == 503, response.text
    with Session(planning["auth"].engine) as db:
        assert db.get(FundingRequest, request["id"]).state == "prevalidated"
        assert (
            db.scalar(
                select(FundingDecision.id).where(
                    FundingDecision.request_id == request["id"],
                    FundingDecision.stage == "validator",
                )
            )
            is None
        )
    assert execution(planning, activity)["pause_reason"] == "funding_required"


def test_funding_schema_drift_and_destructive_downgrade_fail_closed(planning):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError

    from app.auth.service import AuthError

    activity = increase(planning, approved_execution_activity(planning))
    authorize(planning, activity)
    with planning["auth"].engine.connect() as db:
        tx = db.begin()
        db.execute(
            text(
                "CREATE OR REPLACE FUNCTION pta_preserve_funding() RETURNS trigger "
                "LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$"
            )
        )
        with pytest.raises(AuthError, match="eligibility_unverified"):
            planning["auth"].environment_verified(db)
        tx.rollback()
    with pytest.raises(DBAPIError, match="Refusing destructive"):
        command.downgrade(Config("alembic.ini"), "0023_real_mail_accounts")
    assert not execution(planning, activity)["execution_paused"]
