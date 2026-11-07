# ruff: noqa: F401, F811
from concurrent.futures import ThreadPoolExecutor
from threading import Event, Lock
from time import monotonic
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy.orm.session import SessionTransaction

from app.auth.models import Audit
from tests.auth.test_access import headers
from tests.auth.test_recovery import NEW_PASSWORD, recovery_proof
from tests.auth.test_recovery import enable_recovery as enable_password_recovery
from tests.auth.test_recovery import request as request_password_recovery
from tests.planning.test_amendments import approved_activity
from tests.planning.test_planning import (  # noqa: F401
    admin,
    create_activity,
    ordered_advisory_race,
    patch,
    plan,
    planning,
    post,
    put,
    references,
)


def enable_withdrawals(clients):
    auth = clients["auth"]
    auth.policy = auth.policy.model_copy(
        update={"planning_lifecycle_fixture": "SYNTHETIC_EXECUTION_TEST_ONLY"}
    )


def test_w01_agent_requests_withdrawal_without_changing_approved_content(planning):
    approved, _operation_type = approved_activity(planning)
    enable_withdrawals(planning)

    response = post(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Le programme annuel ne permet plus cette activité.",
        },
    )

    assert response.status_code == 201, response.text
    revision = response.json()
    assert revision["snapshot"]["withdrawal"]["reason"] == (
        "Le programme annuel ne permet plus cette activité."
    )
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["state"] == "submitted"
    assert detail["execution_paused"] is True
    assert detail["approved"] == approved["approved"]
    assert detail["withdrawal"]["id"] == revision["snapshot"]["withdrawal"]["id"]

    history = (
        planning["agent"].get(f"/api/v1/activities/{approved['id']}/history").json()
    )
    assert (
        history["data"][0]["reason"]
        == "Le programme annuel ne permet plus cette activité."
    )


def request_withdrawal(clients, approved):
    enable_withdrawals(clients)
    response = post(
        clients["agent2"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Retrait synthétique vérifiable.",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_w02_fresh_two_stage_approval_withdraws_activity(planning):
    approved, _operation_type = approved_activity(planning)
    with Session(planning["auth"].engine) as db:
        agent_id = db.scalar(
            text("SELECT id FROM auth_user WHERE email='agent@example.test'")
        )
    assigned = planning["supervisor"].put(
        f"/api/v1/activities/{approved['id']}/assignments",
        headers=headers(planning["supervisor"]),
        json={"expected_version": approved["version"], "agent_ids": [agent_id]},
    )
    assert assigned.status_code == 200, assigned.text
    approved = assigned.json()
    revision = request_withdrawal(planning, approved)
    project_id = revision["snapshot"]["project"]["id"]
    pending_total = planning["agent"].get(f"/api/v1/projects/{project_id}/ptas/2027")
    assert pending_total.status_code == 200, pending_total.text
    assert pending_total.json()["approved_plan"] == {
        "as_of": pending_total.json()["approved_plan"]["as_of"],
        "activity_count": 1,
        "allocation": approved["allocation"],
    }
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    )
    assert prevalidated.status_code == 201, prevalidated.text
    accepted = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert accepted.status_code == 201, accepted.text
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["state"] == "withdrawn"
    assert detail["approved_revision_id"] == approved["approved_revision_id"]
    assert detail["execution_paused"] is False
    assert detail["allowed_actions"] == ["read"]
    assert detail["withdrawal"]["final_decision_at"]
    with Session(planning["auth"].engine) as db:
        ended = db.execute(
            text(
                "SELECT ended_at,ended_by_id FROM pta_activity_agent_assignment "
                "WHERE activity_id=:activity_id AND agent_id=:agent_id"
            ),
            {"activity_id": approved["id"], "agent_id": agent_id},
        ).one()
    assert ended.ended_at is not None
    assert ended.ended_by_id is not None
    final_total = planning["agent"].get(f"/api/v1/projects/{project_id}/ptas/2027")
    assert final_total.status_code == 200, final_total.text
    assert final_total.json()["summary"]["activities"] == 0
    assert final_total.json()["summary"]["approved_allocation"] == "0"
    assert (
        planning["agent"]
        .get(f"/api/v1/ptas/{approved['pta_id']}/activities")
        .json()["count"]
        == 1
    )
    assert final_total.json()["approved_plan"]["activity_count"] == 0
    assert final_total.json()["approved_plan"]["allocation"] == "0"
    historical_total = planning["agent"].get(
        f"/api/v1/projects/{project_id}/ptas/2027",
        params={"as_of": revision["submitted_at"]},
    )
    assert historical_total.status_code == 200, historical_total.text
    assert historical_total.json()["approved_plan"]["activity_count"] == 1
    assert (
        historical_total.json()["approved_plan"]["allocation"] == approved["allocation"]
    )
    project_close = patch(
        planning["validator"],
        f"/api/v1/projects/{project_id}",
        {"expected_version": 1, "action": "close"},
    )
    assert project_close.status_code == 200, project_close.text
    assert project_close.json()["state"] == "closed"


def test_w05_annual_history_tracks_amendment_then_withdrawal(planning):
    approved, operation_type = approved_activity(planning)
    with Session(planning["auth"].engine) as db:
        initial_effective_at = db.scalar(
            text(
                "SELECT decided_at FROM pta_activity_revision_decision "
                "WHERE revision_id=:revision_id AND stage='validator'"
            ),
            {"revision_id": approved["approved_revision_id"]},
        )
    opened = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Réviser le budget avant retrait.",
        },
    ).json()
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            operation_type,
            allocation="350000",
            operations=[
                {
                    **{key: value for key, value in row.items() if key != "position"},
                    "allocation": amount,
                }
                for row, amount in zip(
                    opened["operations"], ["150000", "200000"], strict=True
                )
            ],
            expected_version=opened["version"],
        ),
    ).json()
    amended_revision = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/submissions",
        {"expected_version": changed["version"]},
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/"
        f"{amended_revision['id']}/decisions",
        {
            "expected_version": amended_revision["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    final = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/"
        f"{amended_revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert final.status_code == 201, final.text
    amended = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    with Session(planning["auth"].engine) as db:
        amendment_effective_at = db.scalar(
            text(
                "SELECT decided_at FROM pta_activity_revision_decision "
                "WHERE revision_id=:revision_id AND stage='validator'"
            ),
            {"revision_id": amended["approved_revision_id"]},
        )
    withdrawal = request_withdrawal(planning, amended)
    project_id = withdrawal["snapshot"]["project"]["id"]
    withdrawal_prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{withdrawal['id']}/decisions",
        {
            "expected_version": withdrawal["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    withdrawal_final = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{withdrawal['id']}/decisions",
        {
            "expected_version": withdrawal_prevalidated["activity_version"],
            "decision": "approve",
        },
    )
    assert withdrawal_final.status_code == 201, withdrawal_final.text
    initial_total = (
        planning["agent"]
        .get(
            f"/api/v1/projects/{project_id}/ptas/2027",
            params={"as_of": initial_effective_at.isoformat()},
        )
        .json()["approved_plan"]
    )
    amended_total = (
        planning["agent"]
        .get(
            f"/api/v1/projects/{project_id}/ptas/2027",
            params={"as_of": amendment_effective_at.isoformat()},
        )
        .json()["approved_plan"]
    )
    current_total = (
        planning["agent"]
        .get(f"/api/v1/projects/{project_id}/ptas/2027")
        .json()["approved_plan"]
    )
    assert initial_total["allocation"] == "300000"
    assert amended_total["allocation"] == "350000"
    assert current_total["allocation"] == "0"

    for invalid in ("2027-01-01T00:00:00", "2999-01-01T00:00:00+00:00", "bad"):
        response = planning["agent"].get(
            f"/api/v1/projects/{project_id}/ptas/2027", params={"as_of": invalid}
        )
        assert response.status_code == 422


def test_w03_agent_can_cancel_pending_withdrawal_with_reason(planning):
    approved, _operation_type = approved_activity(planning)
    revision = request_withdrawal(planning, approved)
    request_id = revision["snapshot"]["withdrawal"]["id"]
    response = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/withdrawals/{request_id}/cancellation",
        {
            "expected_version": revision["activity_version"],
            "expected_revision_id": revision["id"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Le retrait n'est plus nécessaire.",
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["state"] == "approved"
    assert response.json()["withdrawal"] is None


@pytest.mark.parametrize(
    "phase", ["submitted", "prevalidated", "returned_supervisor", "returned_validator"]
)
def test_w03_cancellation_restores_approval_from_every_pending_phase(planning, phase):
    approved, _operation_type = approved_activity(planning)
    assigned_agent_id = None
    if phase == "prevalidated":
        assigned_agent_id = (
            planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]
        )
        approved = put(
            planning["validator"],
            f"/api/v1/activities/{approved['id']}/assignments",
            {
                "expected_version": approved["version"],
                "agent_ids": [assigned_agent_id],
            },
        ).json()
    revision = request_withdrawal(planning, approved)
    version = revision["activity_version"]
    decision_path = (
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions"
    )
    if phase == "returned_supervisor":
        version = post(
            planning["supervisor"],
            decision_path,
            {
                "expected_version": version,
                "decision": "return",
                "reason": "Retour synthétique.",
            },
        ).json()["activity_version"]
    elif phase in {"prevalidated", "returned_validator"}:
        version = post(
            planning["supervisor"],
            decision_path,
            {"expected_version": version, "decision": "prevalidate"},
        ).json()["activity_version"]
        if phase == "returned_validator":
            version = post(
                planning["validator"],
                decision_path,
                {
                    "expected_version": version,
                    "decision": "return",
                    "reason": "Retour final synthétique.",
                },
            ).json()["activity_version"]
    withdrawal_id = revision["snapshot"]["withdrawal"]["id"]
    cancelled = post(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}/withdrawals/{withdrawal_id}/cancellation",
        {
            "expected_version": version,
            "expected_revision_id": revision["id"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Annulation depuis chaque phase.",
        },
    )
    assert cancelled.status_code == 200, cancelled.text
    assert cancelled.json()["state"] == "approved"
    assert cancelled.json()["approved"] == approved["approved"]
    if phase == "prevalidated":
        with Session(planning["auth"].engine) as db:
            assignment = db.execute(
                text(
                    "SELECT agent_id,ended_at FROM pta_activity_agent_assignment "
                    "WHERE activity_id=:activity_id AND agent_id=:agent_id"
                ),
                {"activity_id": approved["id"], "agent_id": assigned_agent_id},
            ).one()
            contributor_ids = set(
                db.scalars(
                    text(
                        "SELECT user_id FROM pta_activity_contributor "
                        "WHERE activity_id=:activity_id"
                    ),
                    {"activity_id": approved["id"]},
                )
            )
        assert assignment.agent_id == assigned_agent_id
        assert assignment.ended_at is None
        assert assigned_agent_id in contributor_ids
        history = planning["agent"].get(
            f"/api/v1/activities/{approved['id']}/revisions"
        )
        assert history.status_code == 200, history.text
        entries = history.json()["data"]
        retained = next(row for row in entries if row["id"] == revision["id"])
        assert [(row["stage"], row["outcome"]) for row in retained["decisions"]] == [
            ("supervisor", "prevalidated")
        ]
        assert any(
            row["kind"] == "withdrawal_cancel" and row["withdrawal_id"] == withdrawal_id
            for row in entries
        )


def test_w04_guard_fails_closed_without_exact_fixture(planning):
    approved, _operation_type = approved_activity(planning)
    planning["auth"].policy = planning["auth"].policy.model_copy(
        update={"planning_lifecycle_fixture": None}
    )
    response = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Tentative sans provenance.",
        },
    )
    assert response.status_code == 409
    assert "eligibility_unverified" in response.text


def test_w01_w06_ineligible_activity_states_fail_closed(planning):
    enable_withdrawals(planning)
    _partner, operation_type, _project, draft, _ = create_activity(planning)
    draft_response = post(
        planning["agent"],
        f"/api/v1/activities/{draft['id']}/withdrawals",
        {
            "expected_version": draft["version"],
            "expected_approved_revision_id": str(uuid4()),
            "reason": "Un brouillon ne peut pas être retiré.",
        },
    )
    assert draft_response.status_code == 409
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{draft['id']}/submissions",
        {"expected_version": draft["version"]},
    ).json()
    initial_review = post(
        planning["agent"],
        f"/api/v1/activities/{draft['id']}/withdrawals",
        {
            "expected_version": submitted["activity_version"],
            "expected_approved_revision_id": str(uuid4()),
            "reason": "Une première validation ne peut pas être retirée.",
        },
    )
    assert initial_review.status_code == 409

    approved, _ = approved_activity(planning)
    opened = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Modification concurrente interdite.",
        },
    ).json()
    open_amendment = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": opened["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Retrait pendant modification.",
        },
    )
    assert open_amendment.status_code == 409

    other, _ = approved_activity(planning)
    with planning["auth"].engine.begin() as db:
        project_id = db.scalar(
            text(
                "SELECT p.project_id FROM pta_annual p "
                "JOIN pta_activity a ON a.pta_id=p.id WHERE a.id=:id"
            ),
            {"id": other["id"]},
        )
        db.execute(
            text("UPDATE pta_project SET state='closed' WHERE id=:id"),
            {"id": project_id},
        )
    closed = post(
        planning["agent2"],
        f"/api/v1/activities/{other['id']}/withdrawals",
        {
            "expected_version": other["version"],
            "expected_approved_revision_id": other["approved_revision_id"],
            "reason": "Projet fermé.",
        },
    )
    assert closed.status_code == 409


def test_c02_guard_is_rechecked_for_decision_cancellation_and_correction(planning):
    approved, _operation_type = approved_activity(planning)
    revision = request_withdrawal(planning, approved)
    decision_path = (
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions"
    )
    cancellation_path = (
        f"/api/v1/activities/{approved['id']}/withdrawals/"
        f"{revision['snapshot']['withdrawal']['id']}/cancellation"
    )
    planning["auth"].policy = planning["auth"].policy.model_copy(
        update={"planning_lifecycle_fixture": None}
    )
    assert (
        post(
            planning["supervisor"],
            decision_path,
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        ).status_code
        == 409
    )
    assert (
        post(
            planning["agent"],
            cancellation_path,
            {
                "expected_version": revision["activity_version"],
                "expected_revision_id": revision["id"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Garde absente.",
            },
        ).status_code
        == 409
    )
    enable_withdrawals(planning)
    returned = post(
        planning["supervisor"],
        decision_path,
        {
            "expected_version": revision["activity_version"],
            "decision": "return",
            "reason": "Correction demandée.",
        },
    ).json()
    planning["auth"].policy = planning["auth"].policy.model_copy(
        update={"planning_lifecycle_fixture": None}
    )
    correction = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": returned["activity_version"],
            "expected_revision_id": revision["id"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "withdrawal_id": revision["snapshot"]["withdrawal"]["id"],
            "reason": "Correction bloquée sans garde.",
        },
    )
    assert correction.status_code == 409


def persisted_withdrawal_state(planning, activity_id):
    with Session(planning["auth"].engine) as db:
        activity = db.execute(
            text(
                "SELECT state,version,current_revision_id,approved_revision_id,"
                "withdrawal_id FROM pta_activity WHERE id=:activity_id"
            ),
            {"activity_id": activity_id},
        ).one()
        related = {
            "pta": db.execute(
                text(
                    "SELECT p.* FROM pta_annual p JOIN pta_activity a ON a.pta_id=p.id "
                    "WHERE a.id=:id"
                ),
                {"id": activity_id},
            ).one(),
            "operations": list(
                db.execute(
                    text(
                        "SELECT id,removed_at,removed_by_id FROM pta_operation "
                        "WHERE activity_id=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                )
            ),
            "assignments": list(
                db.execute(
                    text(
                        "SELECT id,agent_id,ended_at,ended_by_id "
                        "FROM pta_activity_agent_assignment "
                        "WHERE activity_id=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                )
            ),
            "contributors": list(
                db.execute(
                    text(
                        "SELECT id,user_id,contributed_at "
                        "FROM pta_activity_contributor "
                        "WHERE activity_id=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                )
            ),
            "revisions": list(
                db.execute(
                    text(
                        "SELECT id,revision_number,snapshot::text,fingerprint,"
                        "submitter_id,submitted_at FROM pta_activity_revision "
                        "WHERE activity_id=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                )
            ),
            "decisions": list(
                db.execute(
                    text(
                        "SELECT id,revision_id,stage,outcome,actor_id,reason,"
                        "requested_amount,prevalidation_revision_id "
                        "FROM pta_activity_revision_decision "
                        "WHERE activity_id=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                )
            ),
            "audits": list(
                db.execute(
                    text(
                        "SELECT id,action,business::text FROM auth_audit "
                        "WHERE target=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                )
            ),
        }
        return activity, related


@pytest.mark.parametrize(
    "responsibility",
    [
        "request",
        "correction",
        "cancel",
        "return_supervisor",
        "prevalidate",
        "return_validator",
        "approve",
    ],
)
@pytest.mark.parametrize("failure", ["audit", "constraint", "commit"])
def test_c04_every_withdrawal_responsibility_rolls_back(
    planning, monkeypatch, responsibility, failure
):
    approved, _operation_type = approved_activity(planning)
    enable_withdrawals(planning)
    revision = None
    if responsibility != "request":
        revision = request_withdrawal(planning, approved)
    current_version = revision["activity_version"] if revision else approved["version"]
    if responsibility == "correction":
        returned = post(
            planning["supervisor"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": current_version,
                "decision": "return",
                "reason": "Correction avant rollback.",
            },
        ).json()
        current_version = returned["activity_version"]
    elif responsibility in {"return_validator", "approve"}:
        assert revision
        prevalidated = post(
            planning["supervisor"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        ).json()
        current_version = prevalidated["activity_version"]
    before = persisted_withdrawal_state(planning, approved["id"])
    auth = planning["auth"]
    original = auth.business_audit

    def fail_transaction(db, action, *args, **kwargs):
        if failure == "audit" and action.startswith("activity.withdrawal_"):
            raise IntegrityError("synthetic withdrawal audit failure", {}, Exception())
        result = original(db, action, *args, **kwargs)
        if action.startswith("activity.withdrawal_"):
            if failure == "constraint":
                db.execute(
                    text(
                        "INSERT INTO mjl_ownership_context (id,created_at) "
                        "VALUES ('NOT_MJL',clock_timestamp())"
                    )
                )
            elif failure == "commit":
                db.info["fail_withdrawal_commit"] = True
        return result

    monkeypatch.setattr(auth, "business_audit", fail_transaction)
    if failure == "commit":
        original_commit = SessionTransaction.commit

        def fail_commit(transaction, *args, **kwargs):
            if transaction.session.info.pop("fail_withdrawal_commit", False):
                raise IntegrityError(
                    "synthetic withdrawal commit failure", {}, Exception()
                )
            return original_commit(transaction, *args, **kwargs)

        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    if responsibility == "request":
        response = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/withdrawals",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Échec d'audit synthétique.",
            },
        )
    elif responsibility == "correction":
        assert revision
        response = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/withdrawals",
            {
                "expected_version": current_version,
                "expected_revision_id": revision["id"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "withdrawal_id": revision["snapshot"]["withdrawal"]["id"],
                "reason": "Correction annulée par rollback.",
            },
        )
    elif responsibility == "cancel":
        assert revision
        response = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/withdrawals/"
            f"{revision['snapshot']['withdrawal']['id']}/cancellation",
            {
                "expected_version": current_version,
                "expected_revision_id": revision["id"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Échec d'audit synthétique.",
            },
        )
    else:
        assert revision
        reviewer = (
            planning["validator"]
            if responsibility in {"return_validator", "approve"}
            else planning["supervisor"]
        )
        decision = (
            "approve"
            if responsibility == "approve"
            else "prevalidate"
            if responsibility == "prevalidate"
            else "return"
        )
        response = post(
            reviewer,
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": current_version,
                "decision": decision,
                **(
                    {"reason": "Retour annulé par rollback."}
                    if decision == "return"
                    else {}
                ),
            },
        )
    assert response.status_code == 503
    assert persisted_withdrawal_state(planning, approved["id"]) == before


def test_c01_only_agents_can_request_or_cancel_withdrawal(planning):
    approved, _operation_type = approved_activity(planning)
    enable_withdrawals(planning)
    body = {
        "expected_version": approved["version"],
        "expected_approved_revision_id": approved["approved_revision_id"],
        "reason": "Retrait autorisé aux seuls Agents.",
    }
    path = f"/api/v1/activities/{approved['id']}/withdrawals"
    for client in (planning["admin"], planning["supervisor"], planning["validator"]):
        assert post(client, path, body).status_code == 403
    revision = post(planning["agent"], path, body).json()
    withdrawal_id = revision["snapshot"]["withdrawal"]["id"]
    cancellation = {
        "expected_version": revision["activity_version"],
        "expected_revision_id": revision["id"],
        "expected_approved_revision_id": approved["approved_revision_id"],
        "reason": "Annulation strictement validée.",
    }
    cancel_path = f"{path}/{withdrawal_id}/cancellation"
    assert post(planning["validator"], cancel_path, cancellation).status_code == 403
    assert (
        post(
            planning["agent"],
            cancel_path,
            {**cancellation, "withdrawal_id": withdrawal_id},
        ).status_code
        == 422
    )


def test_c07_openapi_has_exact_withdrawal_contract(planning):
    document = planning["agent"].get("/openapi.json").json()
    paths = document["paths"]
    request_path = "/api/v1/activities/{identifier}/withdrawals"
    cancellation_path = (
        "/api/v1/activities/{identifier}/withdrawals/{withdrawal_id}/cancellation"
    )
    assert set(paths[request_path]) == {"post"}
    assert set(paths[cancellation_path]) == {"post"}
    for path in (request_path, cancellation_path):
        operation = paths[path]["post"]
        headers_present = {
            parameter["name"]
            for parameter in operation["parameters"]
            if parameter["in"] == "header"
        }
        assert headers_present == {"Origin", "X-CSRF-Token"}
    schemas = document["components"]["schemas"]
    for path in (request_path, cancellation_path):
        schema_ref = paths[path]["post"]["requestBody"]["content"]["application/json"][
            "schema"
        ]["$ref"]
        schema_name = schema_ref.rsplit("/", 1)[-1]
        assert schemas[schema_name]["additionalProperties"] is False
    assert set(schemas["ApprovedPlanOutput"]["required"]) == {
        "as_of",
        "activity_count",
        "allocation",
    }


def test_c01_c07_inactive_cross_resource_and_malformed_requests_deny(planning):
    approved, _operation_type = approved_activity(planning)
    other, _other_type = approved_activity(planning)
    enable_withdrawals(planning)
    path = f"/api/v1/activities/{approved['id']}/withdrawals"
    missing_activity = str(uuid4())
    missing_withdrawal = str(uuid4())
    assert (
        post(
            planning["agent"],
            f"/api/v1/activities/{missing_activity}/withdrawals",
            {
                "expected_version": 1,
                "expected_approved_revision_id": str(uuid4()),
                "reason": "Ressource inexistante.",
            },
        ).status_code
        == 404
    )
    assert (
        post(
            planning["agent"],
            f"/api/v1/activities/{missing_activity}/withdrawals/"
            f"{missing_withdrawal}/cancellation",
            {
                "expected_version": 1,
                "expected_revision_id": str(uuid4()),
                "expected_approved_revision_id": str(uuid4()),
                "reason": "Ressource inexistante.",
            },
        ).status_code
        == 404
    )
    assert (
        post(
            planning["agent"],
            path,
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
            },
        ).status_code
        == 422
    )
    revision = request_withdrawal(planning, approved)
    withdrawal_id = revision["snapshot"]["withdrawal"]["id"]
    cancellation = {
        "expected_version": revision["activity_version"],
        "expected_revision_id": revision["id"],
        "expected_approved_revision_id": approved["approved_revision_id"],
        "reason": "Chemin parent erroné.",
    }
    crossed = post(
        planning["agent"],
        f"/api/v1/activities/{other['id']}/withdrawals/{withdrawal_id}/cancellation",
        cancellation,
    )
    assert crossed.status_code == 409
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["withdrawal"]["id"] == withdrawal_id

    session = planning["agent"].get("/api/v1/auth/session").json()
    agent_id = session["user"]["id"]
    active_headers = {
        "Origin": "http://localhost",
        "X-CSRF-Token": session["csrf"],
    }
    with planning["auth"].engine.begin() as db:
        db.execute(
            text("UPDATE auth_user SET state='inactive' WHERE id=:id"),
            {"id": agent_id},
        )
    inactive = planning["agent"].post(
        f"/api/v1/activities/{approved['id']}/withdrawals/{withdrawal_id}/cancellation",
        headers=active_headers,
        json=cancellation,
    )
    assert inactive.status_code == 401


def test_w05_return_requires_reason_and_correction_gets_fresh_chain(planning):
    approved, _operation_type = approved_activity(planning)
    first = request_withdrawal(planning, approved)
    path = f"/api/v1/activities/{approved['id']}/revisions/{first['id']}/decisions"
    missing_reason = post(
        planning["supervisor"],
        path,
        {"expected_version": first["activity_version"], "decision": "return"},
    )
    assert missing_reason.status_code == 422
    returned = post(
        planning["supervisor"],
        path,
        {
            "expected_version": first["activity_version"],
            "decision": "return",
            "reason": "Préciser la justification.",
        },
    )
    assert returned.status_code == 201, returned.text
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    corrected = post(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": detail["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "expected_revision_id": first["id"],
            "withdrawal_id": detail["withdrawal"]["id"],
            "reason": "Justification corrigée du retrait.",
        },
    )
    assert corrected.status_code == 201, corrected.text
    second = corrected.json()
    assert second["id"] != first["id"]
    assert second["revision_number"] == first["revision_number"] + 1
    assert second["snapshot"]["withdrawal"]["id"] == detail["withdrawal"]["id"]
    obsolete = post(
        planning["validator"],
        path,
        {"expected_version": second["activity_version"], "decision": "approve"},
    )
    assert obsolete.status_code == 409


def test_w06_stale_replay_and_post_effect_cancellation_are_rejected(planning):
    approved, _operation_type = approved_activity(planning)
    revision = request_withdrawal(planning, approved)
    replay = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Retrait synthétique vérifiable.",
        },
    )
    assert replay.status_code == 409
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    final = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    ).json()
    terminal_request = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": final["activity_version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Une activité retirée reste terminale.",
        },
    )
    assert terminal_request.status_code == 409
    withdrawal_id = revision["snapshot"]["withdrawal"]["id"]
    cancellation = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/withdrawals/{withdrawal_id}/cancellation",
        {
            "expected_version": final["activity_version"],
            "expected_revision_id": revision["id"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Trop tard.",
        },
    )
    assert cancellation.status_code == 409


def test_c05_maximum_unicode_reason_and_canonical_group(planning):
    approved, _operation_type = approved_activity(planning)
    enable_withdrawals(planning)
    reason = "💶" * 4000
    requested = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/withdrawals",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": reason,
        },
    )
    assert requested.status_code == 201, requested.text
    revision = requested.json()
    assert revision["snapshot"]["withdrawal"]["reason"] == reason
    with pytest.raises(DBAPIError), Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text(
                "UPDATE pta_activity SET withdrawal_id='not-a-canonical-uuid' "
                "WHERE id=:id"
            ),
            {"id": approved["id"]},
        )


@pytest.mark.parametrize("approval_first", [True, False])
def test_c03_cancel_and_final_approval_have_one_serial_winner(planning, approval_first):
    approved, _operation_type = approved_activity(planning)
    revision = request_withdrawal(planning, approved)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    withdrawal_id = revision["snapshot"]["withdrawal"]["id"]
    approval_path = (
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions"
    )
    withdrawal_path = f"/api/v1/activities/{approved['id']}/withdrawals"
    cancellation_path = f"{withdrawal_path}/{withdrawal_id}/cancellation"

    def approve():
        return post(
            planning["validator"],
            approval_path,
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        )

    def cancel():
        return post(
            planning["agent"],
            cancellation_path,
            {
                "expected_version": prevalidated["activity_version"],
                "expected_revision_id": revision["id"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Décision concurrente synthétique.",
            },
        )

    first, second = ordered_advisory_race(
        planning["auth"],
        approve if approval_first else cancel,
        cancel if approval_first else approve,
    )
    assert first.status_code == (201 if approval_first else 200)
    assert second.status_code == 409
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["state"] in {"approved", "withdrawn"}


@pytest.mark.parametrize("first", ["withdrawal", "amendment"])
def test_c03_withdrawal_and_amendment_open_serialize(planning, first):
    approved, _operation_type = approved_activity(planning)
    enable_withdrawals(planning)

    def withdraw():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/withdrawals",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Retrait concurrent à une modification.",
            },
        )

    def amend():
        return post(
            planning["agent2"],
            f"/api/v1/activities/{approved['id']}/amendments",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Modification concurrente au retrait.",
            },
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        withdraw if first == "withdrawal" else amend,
        amend if first == "withdrawal" else withdraw,
    )
    assert first_response.status_code == 201
    assert second_response.status_code == 409


@pytest.mark.parametrize("first", ["withdrawal", "assignment"])
def test_c03_withdrawal_and_assignment_change_serialize(planning, first):
    approved, _operation_type = approved_activity(planning)
    enable_withdrawals(planning)
    agent_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]

    def withdraw():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/withdrawals",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Retrait concurrent à une affectation.",
            },
        )

    def assign():
        return put(
            planning["validator"],
            f"/api/v1/activities/{approved['id']}/assignments",
            {
                "expected_version": approved["version"],
                "agent_ids": [agent_id],
            },
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        withdraw if first == "withdrawal" else assign,
        assign if first == "withdrawal" else withdraw,
    )
    assert first_response.status_code in {200, 201}
    assert second_response.status_code == 409


@pytest.mark.parametrize("first", ["correction", "edit"])
def test_c03_withdrawal_correction_and_content_edit_serialize(planning, first):
    approved, operation_type = approved_activity(planning)
    revision = request_withdrawal(planning, approved)
    returned = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": revision["activity_version"],
            "decision": "return",
            "reason": "Correction avant concurrence.",
        },
    ).json()

    def correct():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/withdrawals",
            {
                "expected_version": returned["activity_version"],
                "expected_revision_id": revision["id"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "withdrawal_id": revision["snapshot"]["withdrawal"]["id"],
                "reason": "Motif corrigé pendant la concurrence.",
            },
        )

    def edit():
        return patch(
            planning["agent2"],
            f"/api/v1/activities/{approved['id']}",
            plan(
                operation_type,
                expected_version=returned["activity_version"],
                description="Contenu interdit pendant le retrait.",
            ),
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        correct if first == "correction" else edit,
        edit if first == "correction" else correct,
    )
    if first == "correction":
        assert (first_response.status_code, second_response.status_code) == (201, 409)
    else:
        assert (first_response.status_code, second_response.status_code) == (409, 201)


@pytest.mark.parametrize("first", ["withdrawal", "lifecycle"])
@pytest.mark.parametrize("action", ["role", "deactivate"])
def test_c03_withdrawal_request_and_agent_lifecycle_serialize(planning, first, action):
    approved, _operation_type = approved_activity(planning)
    enable_withdrawals(planning)
    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    account = next(row for row in users if row["email"] == "agent@example.test")
    lifecycle_body = (
        {"expected_version": account["version"], "role": "AGENT_VERIFICATEUR"}
        if action == "role"
        else {"expected_version": account["version"], "deactivate": True}
    )

    def withdraw():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/withdrawals",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Retrait concurrent au cycle du compte.",
            },
        )

    def lifecycle():
        return planning["admin"].patch(
            f"/api/v1/access/users/{account['id']}",
            headers=headers(planning["admin"]),
            json=lifecycle_body,
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        withdraw if first == "withdrawal" else lifecycle,
        lifecycle if first == "withdrawal" else withdraw,
    )
    if first == "withdrawal":
        assert (first_response.status_code, second_response.status_code) == (201, 200)
    else:
        assert first_response.status_code == 200
        assert second_response.status_code == 401


@pytest.mark.parametrize("first", ["withdrawal", "recovery"])
def test_c03_withdrawal_request_and_password_recovery_serialize(
    planning, auth_env, first
):
    approved, _operation_type = approved_activity(planning)
    enable_withdrawals(planning)
    enable_password_recovery(planning["agent2"])
    assert (
        request_password_recovery(planning["agent2"], "agent@example.test").status_code
        == 202
    )
    proof = recovery_proof(auth_env.mailbox, "agent@example.test")

    def withdraw():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/withdrawals",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Retrait concurrent à la récupération.",
            },
        )

    def recover():
        return planning["agent2"].post(
            "/api/v1/auth/password-reset/complete",
            headers=headers(planning["agent2"]),
            json={
                **proof,
                "password": NEW_PASSWORD,
                "confirmation": NEW_PASSWORD,
            },
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        withdraw if first == "withdrawal" else recover,
        recover if first == "withdrawal" else withdraw,
    )
    if first == "withdrawal":
        assert (first_response.status_code, second_response.status_code) == (201, 200)
    else:
        assert first_response.status_code == 200
        assert second_response.status_code == 401


@pytest.mark.parametrize("approval_first", [True, False])
def test_c03_final_assignment_ending_and_role_change_serialize(
    planning, approval_first
):
    approved, _operation_type = approved_activity(planning)
    assignee = planning["agent2"].get("/api/v1/auth/session").json()["user"]
    assigned = put(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/assignments",
        {"expected_version": approved["version"], "agent_ids": [assignee["id"]]},
    ).json()
    revision = request_withdrawal(planning, assigned)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["id"] == assignee["id"]
    )

    def approve():
        return post(
            planning["validator"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        )

    def change_role():
        return planning["admin"].patch(
            f"/api/v1/access/users/{assignee['id']}",
            headers=headers(planning["admin"]),
            json={
                "expected_version": account["version"],
                "role": "AGENT_VERIFICATEUR",
            },
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        approve if approval_first else change_role,
        change_role if approval_first else approve,
    )
    if approval_first:
        assert (first_response.status_code, second_response.status_code) == (201, 200)
    else:
        assert (first_response.status_code, second_response.status_code) == (409, 201)


def _wait_for_database_lock(engine, pid):
    deadline = monotonic() + 5
    while monotonic() < deadline:
        with engine.connect() as observer:
            if (
                observer.scalar(
                    text(
                        "SELECT wait_event_type='Lock' FROM pg_stat_activity "
                        "WHERE pid=:pid"
                    ),
                    {"pid": pid},
                )
                is True
            ):
                return
        Event().wait(0.01)
    pytest.fail("concurrent HTTP operation was not observed waiting on its lock")


def _assert_withdrawal_read(payload, resource, activity_id, revision_id, withdrawn):
    if resource == "context":
        assert payload["approved_plan"]["activity_count"] == (0 if withdrawn else 1)
        assert payload["approved_plan"]["allocation"] == (
            "0" if withdrawn else "300000"
        )
    elif resource == "list":
        activity = next(row for row in payload["data"] if row["id"] == activity_id)
        assert activity["state"] == ("withdrawn" if withdrawn else "prevalidated")
    elif resource == "detail":
        assert payload["state"] == ("withdrawn" if withdrawn else "prevalidated")
        assert payload["approved_revision_id"] != revision_id
    else:
        revision = next(row for row in payload["data"] if row["id"] == revision_id)
        assert len(revision["decisions"]) == (2 if withdrawn else 1)


@pytest.mark.parametrize("resource", ["context", "list", "detail", "history"])
@pytest.mark.parametrize("read_first", [True, False])
def test_c03_w05_withdrawal_finalization_and_http_reads_are_coherent(
    planning, resource, read_first
):
    approved, _operation_type = approved_activity(planning)
    revision = request_withdrawal(planning, approved)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    with planning["auth"].engine.connect() as db:
        project_id = db.scalar(
            text(
                "SELECT p.project_id FROM pta_annual p "
                "JOIN pta_activity a ON a.pta_id=p.id WHERE a.id=:id"
            ),
            {"id": approved["id"]},
        )
    paths = {
        "context": f"/api/v1/projects/{project_id}/ptas/2027",
        "list": f"/api/v1/ptas/{approved['pta_id']}/activities",
        "detail": f"/api/v1/activities/{approved['id']}",
        "history": f"/api/v1/activities/{approved['id']}/revisions",
    }
    reader = TestClient(planning["admin"].app, base_url="http://localhost")
    writer = TestClient(planning["admin"].app, base_url="http://localhost")
    reader.cookies.update(planning["agent"].cookies)
    writer.cookies.update(planning["validator"].cookies)
    engine = planning["auth"].engine
    entered, release, attempted = Event(), Event(), Event()
    waiting_pid = {"value": None}
    concurrent_statements = []
    claimed = False
    claim_lock = Lock()

    def read_lock(statement):
        normalized = statement.upper()
        if resource in {"context", "list"}:
            return "PG_ADVISORY_XACT_LOCK_SHARED(1843201)" in normalized
        return "FROM PTA_ACTIVITY" in normalized and "FOR SHARE" in normalized

    def write_wait_lock(statement):
        normalized = statement.upper()
        if resource in {"context", "list"}:
            return (
                "PG_ADVISORY_XACT_LOCK(1843201)" in normalized
                and "_SHARED" not in normalized
            )
        return "FROM PTA_ACTIVITY" in normalized and "FOR UPDATE" in normalized

    held_lock = read_lock if read_first else write_wait_lock

    def read_serialization_lock(statement):
        if read_lock(statement):
            return True
        normalized = statement.upper()
        return (
            not read_first
            and resource in {"detail", "history"}
            and "FROM AUTH_USER" in normalized
            and "FOR UPDATE" in normalized
        )

    waiting_lock = write_wait_lock if read_first else read_serialization_lock

    def hold_first(_conn, _cursor, statement, _parameters, _context, _many):
        nonlocal claimed
        if not read_first and resource in {"detail", "history"}:
            return
        if not held_lock(statement):
            return
        with claim_lock:
            if claimed:
                return
            claimed = True
        entered.set()
        assert release.wait(5), "bounded coherent HTTP release missing"

    def hold_writer_after_flush(session, _flush_context):
        nonlocal claimed
        if read_first or resource not in {"detail", "history"}:
            return
        if not any(
            isinstance(value, Audit)
            and value.target == approved["id"]
            and value.action == "activity.withdrawal_approve"
            for value in session.new
        ):
            return
        with claim_lock:
            if claimed:
                return
            claimed = True
        entered.set()
        assert release.wait(5), "bounded coherent HTTP release missing"

    def observe_waiter(conn, _cursor, statement, _parameters, _context, _many):
        if not entered.is_set():
            return
        concurrent_statements.append(" ".join(statement.split())[:240])
        if not waiting_lock(statement):
            return
        waiting_pid["value"] = conn.connection.driver_connection.info.backend_pid
        attempted.set()

    def approve():
        return post(
            writer,
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        )

    event.listen(engine, "after_cursor_execute", hold_first)
    event.listen(engine, "before_cursor_execute", observe_waiter)
    event.listen(Session, "after_flush", hold_writer_after_flush)
    try:
        with (
            ThreadPoolExecutor(
                max_workers=1, thread_name_prefix="coherent-first"
            ) as one,
            ThreadPoolExecutor(
                max_workers=1, thread_name_prefix="coherent-second"
            ) as two,
        ):
            first = (
                one.submit(reader.get, paths[resource])
                if read_first
                else one.submit(approve)
            )
            assert entered.wait(5), "first HTTP operation did not acquire its lock"
            second = (
                two.submit(approve)
                if read_first
                else two.submit(reader.get, paths[resource])
            )
            assert attempted.wait(5), (
                "second HTTP operation did not attempt its lock; observed: "
                f"{concurrent_statements}"
            )
            _wait_for_database_lock(engine, waiting_pid["value"])
            release.set()
            first_response = first.result(timeout=10)
            second_response = second.result(timeout=10)
    finally:
        release.set()
        event.remove(engine, "after_cursor_execute", hold_first)
        event.remove(engine, "before_cursor_execute", observe_waiter)
        event.remove(Session, "after_flush", hold_writer_after_flush)
        reader.close()
        writer.close()
    read_response = first_response if read_first else second_response
    write_response = second_response if read_first else first_response
    assert read_response.status_code == 200, read_response.text
    assert write_response.status_code == 201, write_response.text
    _assert_withdrawal_read(
        read_response.json(),
        resource,
        approved["id"],
        revision["id"],
        withdrawn=not read_first,
    )
    final = planning["agent2"].get(f"/api/v1/activities/{approved['id']}")
    assert final.status_code == 200
    assert final.json()["state"] == "withdrawn"


@pytest.mark.parametrize(
    "snapshot_expression",
    [
        "jsonb_set(snapshot, '{withdrawal,reason}', to_jsonb(repeat('x', 4001)))",
        "jsonb_set(snapshot, '{pta,year}', '2028'::jsonb)",
        "snapshot - 'withdrawal'",
        "jsonb_set(snapshot, '{withdrawal,id}', 'null'::jsonb)",
        "jsonb_set(snapshot, '{withdrawal,extra}', '\"x\"'::jsonb)",
        "jsonb_set(snapshot, '{withdrawal,base_approved_revision_id}', "
        "'\"cccccccc-cccc-4ccc-8ccc-cccccccccccc\"'::jsonb)",
    ],
)
def test_c05_database_rejects_corrupt_withdrawal_lineage(planning, snapshot_expression):
    approved, _operation_type = approved_activity(planning)
    revision = request_withdrawal(planning, approved)
    corrupt_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    with pytest.raises(DBAPIError), Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text(
                f"""
                INSERT INTO pta_activity_revision
                  (id,context_id,activity_id,revision_number,snapshot,fingerprint,
                   submitter_id,submitted_at)
                SELECT :corrupt_id,context_id,activity_id,revision_number+1,
                       {snapshot_expression},fingerprint,submitter_id,submitted_at
                FROM pta_activity_revision WHERE id=:revision_id
                """
            ),
            {"corrupt_id": corrupt_id, "revision_id": revision["id"]},
        )
        db.execute(
            text(
                "UPDATE pta_activity SET current_revision_id=:corrupt_id "
                "WHERE id=:activity_id"
            ),
            {"corrupt_id": corrupt_id, "activity_id": approved["id"]},
        )


def test_c05_withdrawal_revision_cannot_become_content_approval(planning):
    approved, _operation_type = approved_activity(planning)
    revision = request_withdrawal(planning, approved)
    with pytest.raises(DBAPIError), Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text(
                "UPDATE pta_activity SET state='approved',withdrawal_id=NULL,"
                "approved_revision_id=:revision WHERE id=:activity"
            ),
            {"revision": revision["id"], "activity": approved["id"]},
        )


def test_c05_database_rejects_withdrawal_approval_without_prevalidation(planning):
    approved, _operation_type = approved_activity(planning)
    revision = request_withdrawal(planning, approved)
    validator_id = (
        planning["validator"].get("/api/v1/auth/session").json()["user"]["id"]
    )
    with pytest.raises(DBAPIError), Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text(
                "INSERT INTO pta_activity_revision_decision "
                "(id,context_id,activity_id,revision_id,stage,outcome,actor_id,"
                "actor_role,decided_at,reason,requested_amount,"
                "prevalidation_revision_id) VALUES "
                "(:id,'MJL',:activity,:revision,'validator','approved',:actor,"
                "'VALIDATEUR_DEFINITIF',clock_timestamp(),NULL,NULL,:revision)"
            ),
            {
                "id": str(uuid4()),
                "activity": approved["id"],
                "revision": revision["id"],
                "actor": validator_id,
            },
        )
