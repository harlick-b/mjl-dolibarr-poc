# ruff: noqa: F401, F811
from concurrent.futures import ThreadPoolExecutor
from threading import Event, Lock
from time import monotonic
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session, SessionTransaction
from test_access import headers
from test_amendments import approved_activity
from test_planning import (  # noqa: F401
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
from test_recovery import NEW_PASSWORD, recovery_proof
from test_recovery import enable_recovery as enable_password_recovery
from test_recovery import request as request_password_recovery
from test_withdrawals import persisted_withdrawal_state


def request_transfer(clients, approved, *, start="2028-02-01", end="2028-08-31"):
    response = post(
        clients["agent2"],
        f"/api/v1/activities/{approved['id']}/transfers",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Reporter l’activité au prochain programme annuel.",
            "planned_start": start,
            "planned_end": end,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def approve_transfer(clients, activity, revision):
    prevalidated = post(
        clients["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    )
    assert prevalidated.status_code == 201, prevalidated.text
    approved = post(
        clients["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text
    return clients["agent"].get(f"/api/v1/activities/{activity['id']}").json()


def test_transfer_preserves_source_until_distinct_two_stage_approval(planning):
    approved, _operation_type = approved_activity(planning)
    source_pta_id = approved["pta_id"]
    revision = request_transfer(planning, approved)

    pending = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert pending["pta_id"] == source_pta_id
    assert pending["planned_start"] == approved["planned_start"]
    assert pending["transfer"]["target_year"] == 2028
    assert pending["execution_paused"] is True
    assert revision["snapshot"]["pta"] == {"id": None, "year": 2028}

    moved = approve_transfer(planning, approved, revision)
    assert moved["pta_id"] != source_pta_id
    assert moved["placement_year"] == 2028
    assert moved["planned_start"] == "2028-02-01"
    assert moved["transfer"] is None
    assert moved["approved_revision_id"] == revision["id"]
    assert moved["operations"] == approved["operations"]


def test_agent_cancels_pending_transfer_without_creating_target_pta(planning):
    approved, _operation_type = approved_activity(planning)
    revision = request_transfer(planning, approved)
    transfer_id = revision["snapshot"]["transfer"]["id"]

    response = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/transfers/{transfer_id}/cancellation",
        {
            "expected_version": revision["activity_version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "expected_revision_id": revision["id"],
            "reason": "Le calendrier source est maintenu.",
        },
    )
    assert response.status_code == 200, response.text
    restored = response.json()
    assert restored["pta_id"] == approved["pta_id"]
    assert restored["state"] == "approved"
    assert restored["transfer"] is None
    with Session(planning["auth"].engine) as db:
        assert (
            db.execute(
                text("SELECT count(*) FROM pta_annual WHERE year=2028")
            ).scalar_one()
            == 0
        )


def test_transfer_authorization_versions_and_dates_fail_closed(planning):
    approved, _operation_type = approved_activity(planning)
    body = {
        "expected_version": approved["version"],
        "expected_approved_revision_id": approved["approved_revision_id"],
        "reason": "Contrôle de transfert.",
        "planned_start": "2028-01-01",
        "planned_end": "2028-02-01",
    }
    path = f"/api/v1/activities/{approved['id']}/transfers"
    assert post(planning["admin"], path, body).status_code == 403
    assert post(planning["supervisor"], path, body).status_code == 403
    assert post(planning["validator"], path, body).status_code == 403
    assert (
        post(
            planning["agent"],
            f"/api/v1/activities/{uuid4()}/transfers",
            body,
        ).status_code
        == 404
    )
    stale = post(planning["agent"], path, {**body, "expected_version": 999})
    assert stale.status_code == 409
    backward = post(
        planning["agent"],
        path,
        {**body, "planned_start": "2027-01-01", "planned_end": "2027-02-01"},
    )
    assert backward.status_code == 422
    out_of_range = post(
        planning["agent"],
        path,
        {**body, "planned_start": "2201-01-01", "planned_end": "2201-02-01"},
    )
    assert out_of_range.status_code == 422
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["version"] == approved["version"]
    assert detail["transfer"] is None


def test_returned_transfer_requires_changed_correction_and_fresh_review(planning):
    approved, _operation_type = approved_activity(planning)
    revision = request_transfer(planning, approved)
    returned = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": revision["activity_version"],
            "decision": "return",
            "reason": "Décaler la fin.",
        },
    ).json()
    unchanged = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/transfers",
        {
            "expected_version": returned["activity_version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "expected_revision_id": revision["id"],
            "transfer_id": revision["snapshot"]["transfer"]["id"],
            "reason": revision["snapshot"]["transfer"]["reason"],
            "planned_start": "2028-02-01",
            "planned_end": "2028-08-31",
        },
    )
    assert unchanged.status_code == 409
    corrected = post(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}/transfers",
        {
            "expected_version": returned["activity_version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "expected_revision_id": revision["id"],
            "transfer_id": revision["snapshot"]["transfer"]["id"],
            "reason": "Reporter avec une fin corrigée.",
            "planned_start": "2028-02-01",
            "planned_end": "2028-09-30",
        },
    )
    assert corrected.status_code == 201, corrected.text
    moved = approve_transfer(planning, approved, corrected.json())
    assert moved["planned_end"] == "2028-09-30"


def test_t05_amend_transfer_amend_withdraw_preserves_annual_history(planning):
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            **plan(
                operation_type,
                allocation="100",
                operations=[
                    {
                        "type_id": operation_type["id"],
                        "name": "Préparation",
                        "allocation": "40",
                    },
                    {
                        "type_id": operation_type["id"],
                        "name": "Exécution",
                        "allocation": "60",
                    },
                ],
            ),
            "request_key": str(uuid4()),
        },
    ).json()
    initial_revision = post(
        planning["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    approved = approve_transfer(planning, created, initial_revision)
    with Session(planning["auth"].engine) as db:
        initial_effective_at = db.scalar(
            text(
                "SELECT decided_at FROM pta_activity_revision_decision "
                "WHERE revision_id=:id AND stage='validator'"
            ),
            {"id": approved["approved_revision_id"]},
        )

    opened = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Porter le budget approuvé à 120.",
        },
    ).json()
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            operation_type,
            allocation="120",
            operations=[
                {
                    **{key: value for key, value in row.items() if key != "position"},
                    "allocation": amount,
                }
                for row, amount in zip(opened["operations"], ["50", "70"], strict=True)
            ],
            expected_version=opened["version"],
        ),
    ).json()
    amendment_revision = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/submissions",
        {"expected_version": changed["version"]},
    ).json()
    amended = approve_transfer(planning, approved, amendment_revision)
    with Session(planning["auth"].engine) as db:
        amendment_effective_at = db.scalar(
            text(
                "SELECT decided_at FROM pta_activity_revision_decision "
                "WHERE revision_id=:id AND stage='validator'"
            ),
            {"id": amended["approved_revision_id"]},
        )

    pending = request_transfer(planning, amended)
    pending_source = planning["agent"].get(
        f"/api/v1/projects/{project['id']}/ptas/2027"
    )
    assert pending_source.json()["approved_plan"]["allocation"] == "120"
    pending_target = planning["agent"].get(
        f"/api/v1/projects/{project['id']}/ptas/2028"
    )
    assert pending_target.status_code == 200
    assert pending_target.json()["approved_plan"]["allocation"] == "0"
    cancelled = post(
        planning["agent"],
        f"/api/v1/activities/{amended['id']}/transfers/"
        f"{pending['snapshot']['transfer']['id']}/cancellation",
        {
            "expected_version": pending["activity_version"],
            "expected_approved_revision_id": amended["approved_revision_id"],
            "expected_revision_id": pending["id"],
            "reason": "Vérifier le calendrier avant un nouvel envoi.",
        },
    ).json()
    assert cancelled["allocation"] == "120"

    transfer_revision = request_transfer(planning, cancelled)
    moved = approve_transfer(planning, cancelled, transfer_revision)
    with Session(planning["auth"].engine) as db:
        transfer_effective_at = db.scalar(
            text(
                "SELECT decided_at FROM pta_activity_revision_decision "
                "WHERE revision_id=:id AND stage='validator'"
            ),
            {"id": moved["approved_revision_id"]},
        )
    source_path = f"/api/v1/projects/{project['id']}/ptas/2027"
    target_path = f"/api/v1/projects/{project['id']}/ptas/2028"

    def total(path, instant=None):
        response = planning["agent"].get(
            path, params={"as_of": instant.isoformat()} if instant else None
        )
        assert response.status_code == 200, response.text
        return response.json()["approved_plan"]["allocation"]

    assert (total(source_path), total(target_path)) == ("0", "120")
    assert (
        total(source_path, initial_effective_at),
        total(target_path, initial_effective_at),
    ) == ("100", "0")
    assert (
        total(source_path, amendment_effective_at),
        total(target_path, amendment_effective_at),
    ) == ("120", "0")
    assert (
        total(source_path, transfer_effective_at),
        total(target_path, transfer_effective_at),
    ) == ("0", "120")

    later_open_response = post(
        planning["agent"],
        f"/api/v1/activities/{moved['id']}/amendments",
        {
            "expected_version": moved["version"],
            "expected_approved_revision_id": moved["approved_revision_id"],
            "reason": "Réviser le budget après transfert.",
        },
    )
    assert later_open_response.status_code == 201, later_open_response.text
    later_opened = later_open_response.json()
    later_changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{moved['id']}",
        plan(
            operation_type,
            planned_start="2028-03-01",
            planned_end="2028-09-30",
            allocation="140",
            operations=[
                {
                    **{key: value for key, value in row.items() if key != "position"},
                    "allocation": amount,
                }
                for row, amount in zip(
                    later_opened["operations"], ["60", "80"], strict=True
                )
            ],
            expected_version=later_opened["version"],
        ),
    ).json()
    assert total(target_path) == "120"
    later_revision = post(
        planning["agent"],
        f"/api/v1/activities/{moved['id']}/submissions",
        {"expected_version": later_changed["version"]},
    ).json()
    later_approved = approve_transfer(planning, moved, later_revision)
    assert later_approved["planned_start"] == "2028-03-01"
    assert later_approved["planned_end"] == "2028-09-30"
    assert total(target_path) == "140"
    withdrawal = post(
        planning["agent"],
        f"/api/v1/activities/{moved['id']}/withdrawals",
        {
            "expected_version": later_approved["version"],
            "expected_approved_revision_id": later_approved["approved_revision_id"],
            "reason": "Retrait après transfert et modification.",
        },
    )
    assert withdrawal.status_code == 201, withdrawal.text
    withdrawn = approve_transfer(planning, later_approved, withdrawal.json())
    assert withdrawn["state"] == "withdrawn"
    assert withdrawn["placement_year"] == 2028
    assert total(target_path) == "0"


def test_original_create_replay_returns_same_activity_after_transfer(planning):
    _partner, operation_type, project = references(planning)
    request_key = str(uuid4())
    body = {**plan(operation_type), "request_key": request_key}
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        body,
    ).json()
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    approved = approve_transfer(planning, created, submitted)
    transfer = request_transfer(planning, approved)
    moved_once = approve_transfer(planning, approved, transfer)
    second_transfer = request_transfer(
        planning, moved_once, start="2029-02-01", end="2029-08-31"
    )
    moved = approve_transfer(planning, moved_once, second_transfer)
    replay = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        body,
    )
    assert replay.status_code == 200, replay.text
    assert replay.json()["id"] == created["id"]
    assert replay.json()["pta_id"] == moved["pta_id"]
    assert replay.json()["placement_year"] == 2029


def test_database_rejects_provenance_and_transfer_lineage_tampering(planning):
    approved, _operation_type = approved_activity(planning)
    revision = request_transfer(planning, approved)
    with Session(planning["auth"].engine) as db:
        with pytest.raises(DBAPIError):
            with db.begin():
                db.execute(
                    text("UPDATE pta_activity SET request_year=2028 WHERE id=:id"),
                    {"id": approved["id"]},
                )
                db.flush()
        malformed_transfer_snapshots = (
            "jsonb_set(snapshot,'{transfer}','{}'::jsonb)",
            "snapshot #- '{transfer,source_pta,year}'",
            "jsonb_set(snapshot,'{transfer,base_approved_revision_id}',"
            "to_jsonb('00000000-0000-4000-8000-000000000000'::text))",
            "jsonb_set(snapshot,'{transfer,source_pta,year}','2026'::jsonb)",
            "jsonb_set(snapshot,'{pta,year}','2029'::jsonb)",
            "jsonb_set(snapshot,'{withdrawal}','{}'::jsonb)",
        )
        for snapshot_expression in malformed_transfer_snapshots:
            with pytest.raises(DBAPIError):
                with db.begin():
                    db.execute(
                        text(
                            "INSERT INTO pta_activity_revision "
                            "(id,context_id,activity_id,revision_number,snapshot,"
                            "fingerprint,submitter_id,submitted_at) "
                            "SELECT :new_id,context_id,activity_id,"
                            f"revision_number+102,{snapshot_expression},"
                            "fingerprint,submitter_id,submitted_at "
                            "FROM pta_activity_revision WHERE id=:id"
                        ),
                        {"new_id": str(uuid4()), "id": revision["id"]},
                    )
                    db.flush()
        with pytest.raises(DBAPIError):
            with db.begin():
                db.execute(
                    text(
                        "UPDATE pta_activity_revision SET snapshot=jsonb_set("
                        "snapshot,'{transfer,target_year}','2029'::jsonb) WHERE id=:id"
                    ),
                    {"id": revision["id"]},
                )
                db.flush()
        with pytest.raises(DBAPIError):
            with db.begin():
                db.execute(
                    text(
                        "INSERT INTO pta_activity_revision "
                        "(id,context_id,activity_id,revision_number,snapshot,"
                        "fingerprint,submitter_id,submitted_at) "
                        "SELECT :revision_id,context_id,activity_id,"
                        "revision_number+103,snapshot #- '{pta,id}',fingerprint,"
                        "submitter_id,submitted_at FROM pta_activity_revision "
                        "WHERE id=:id"
                    ),
                    {
                        "revision_id": str(uuid4()),
                        "id": approved["approved_revision_id"],
                    },
                )
                db.flush()
        with pytest.raises(DBAPIError):
            with db.begin():
                db.execute(
                    text(
                        "INSERT INTO pta_activity_revision "
                        "(id,context_id,activity_id,revision_number,snapshot,"
                        "fingerprint,submitter_id,submitted_at) "
                        "SELECT :new_id,context_id,activity_id,revision_number+101,"
                        "jsonb_set(snapshot,'{transfer,target_year}','2201'::jsonb),"
                        "fingerprint,submitter_id,submitted_at "
                        "FROM pta_activity_revision WHERE id=:id"
                    ),
                    {"new_id": str(uuid4()), "id": revision["id"]},
                )
                db.flush()
        with pytest.raises(DBAPIError):
            with db.begin():
                db.execute(
                    text(
                        "UPDATE pta_activity SET planned_start='2028-03-01', "
                        "planned_end='2028-09-30' WHERE id=:id"
                    ),
                    {"id": approved["id"]},
                )
                db.flush()
        with pytest.raises(DBAPIError):
            with db.begin():
                db.execute(
                    text(
                        "INSERT INTO pta_activity_revision "
                        "(id,context_id,activity_id,revision_number,snapshot,"
                        "fingerprint,submitter_id,submitted_at) "
                        "SELECT :revision_id,context_id,activity_id,"
                        "revision_number+100,"
                        "jsonb_set(snapshot,'{pta,id}','null'::jsonb),fingerprint,"
                        "submitter_id,submitted_at FROM pta_activity_revision "
                        "WHERE id=:id"
                    ),
                    {
                        "revision_id": str(uuid4()),
                        "id": approved["approved_revision_id"],
                    },
                )
                db.flush()


def test_database_rejects_placement_change_without_transfer(planning):
    approved, _operation_type = approved_activity(planning)
    target_pta_id = str(uuid4())
    with Session(planning["auth"].engine) as db:
        with pytest.raises(DBAPIError):
            with db.begin():
                facts = db.execute(
                    text(
                        "SELECT request_project_id,request_actor_id FROM pta_activity "
                        "WHERE id=:id"
                    ),
                    {"id": approved["id"]},
                ).one()
                db.execute(
                    text(
                        "INSERT INTO pta_annual "
                        "(id,context_id,project_id,year,creator_id,created_at) "
                        "VALUES (:id,'MJL',:project_id,2028,:creator_id,"
                        "clock_timestamp())"
                    ),
                    {
                        "id": target_pta_id,
                        "project_id": facts.request_project_id,
                        "creator_id": facts.request_actor_id,
                    },
                )
                db.execute(
                    text(
                        "UPDATE pta_activity SET pta_id=:pta_id,placement_year=2028,"
                        "planned_start='2028-01-01',planned_end='2028-06-30' "
                        "WHERE id=:id"
                    ),
                    {"pta_id": target_pta_id, "id": approved["id"]},
                )
                db.flush()


def test_concurrent_transfer_requests_serialize_to_one_current_request(planning):
    approved, _operation_type = approved_activity(planning)
    path = f"/api/v1/activities/{approved['id']}/transfers"

    def send(client, year):
        return post(
            client,
            path,
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": f"Transfert concurrent {year}.",
                "planned_start": f"{year}-01-01",
                "planned_end": f"{year}-06-30",
            },
        )

    first, second = ordered_advisory_race(
        planning["auth"],
        lambda: send(planning["agent"], 2028),
        lambda: send(planning["agent2"], 2029),
    )
    assert sorted([first.status_code, second.status_code]) == [201, 409]
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["transfer"]["target_year"] in {2028, 2029}


@pytest.mark.parametrize("first", ["transfer", "assignment"])
def test_transfer_request_and_assignment_change_serialize(planning, first):
    approved, _operation_type = approved_activity(planning)
    agent_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]

    def transfer():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/transfers",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Transfert concurrent à une affectation.",
                "planned_start": "2028-02-01",
                "planned_end": "2028-08-31",
            },
        )

    def assign():
        return put(
            planning["validator"],
            f"/api/v1/activities/{approved['id']}/assignments",
            {"expected_version": approved["version"], "agent_ids": [agent_id]},
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        transfer if first == "transfer" else assign,
        assign if first == "transfer" else transfer,
    )
    assert first_response.status_code in {200, 201}
    assert second_response.status_code == 409


@pytest.mark.parametrize("first", ["transfer", "project"])
def test_transfer_request_and_project_close_serialize(planning, first):
    approved, _operation_type = approved_activity(planning)

    def transfer():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/transfers",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Transfert concurrent à la clôture.",
                "planned_start": "2028-02-01",
                "planned_end": "2028-08-31",
            },
        )

    def close_project():
        return patch(
            planning["validator"],
            f"/api/v1/projects/{approved['project_id']}",
            {"expected_version": 1, "action": "close"},
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        transfer if first == "transfer" else close_project,
        close_project if first == "transfer" else transfer,
    )
    transfer_response = first_response if first == "transfer" else second_response
    close_response = second_response if first == "transfer" else first_response
    assert transfer_response.status_code == 201, transfer_response.text
    assert close_response.status_code == 409, close_response.text


@pytest.mark.parametrize("first", ["transfer", "lifecycle"])
@pytest.mark.parametrize("action", ["role", "deactivate"])
def test_transfer_request_and_agent_lifecycle_serialize(planning, first, action):
    approved, _operation_type = approved_activity(planning)
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["email"] == "agent@example.test"
    )
    lifecycle_body = (
        {"expected_version": account["version"], "role": "AGENT_VERIFICATEUR"}
        if action == "role"
        else {"expected_version": account["version"], "deactivate": True}
    )

    def transfer():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/transfers",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Transfert concurrent au cycle du compte.",
                "planned_start": "2028-02-01",
                "planned_end": "2028-08-31",
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
        transfer if first == "transfer" else lifecycle,
        lifecycle if first == "transfer" else transfer,
    )
    if first == "transfer":
        assert (first_response.status_code, second_response.status_code) == (201, 200)
    else:
        assert first_response.status_code == 200
        assert second_response.status_code == 401


@pytest.mark.parametrize("first", ["transfer", "recovery"])
def test_transfer_request_and_password_recovery_serialize(planning, auth_env, first):
    approved, _operation_type = approved_activity(planning)
    enable_password_recovery(planning["agent2"])
    assert (
        request_password_recovery(planning["agent2"], "agent@example.test").status_code
        == 202
    )
    proof = recovery_proof(auth_env.mailbox, "agent@example.test")

    def transfer():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/transfers",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Transfert concurrent à la récupération.",
                "planned_start": "2028-02-01",
                "planned_end": "2028-08-31",
            },
        )

    def recover():
        return planning["agent2"].post(
            "/api/v1/auth/password-reset/complete",
            headers=headers(planning["agent2"]),
            json={**proof, "password": NEW_PASSWORD, "confirmation": NEW_PASSWORD},
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        transfer if first == "transfer" else recover,
        recover if first == "transfer" else transfer,
    )
    if first == "transfer":
        assert (first_response.status_code, second_response.status_code) == (201, 200)
    else:
        assert first_response.status_code == 200
        assert second_response.status_code == 401


@pytest.mark.parametrize("approval_first", [True, False])
def test_transfer_approval_and_cancellation_have_one_serial_winner(
    planning, approval_first
):
    approved, _operation_type = approved_activity(planning)
    revision = request_transfer(planning, approved)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()

    def approval():
        return post(
            planning["validator"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        )

    def cancellation():
        return post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/transfers/"
            f"{revision['snapshot']['transfer']['id']}/cancellation",
            {
                "expected_version": prevalidated["activity_version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "expected_revision_id": revision["id"],
                "reason": "Choix concurrent synthétique.",
            },
        )

    first, second = ordered_advisory_race(
        planning["auth"],
        approval if approval_first else cancellation,
        cancellation if approval_first else approval,
    )
    assert first.status_code in {200, 201}
    assert second.status_code == 409
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["transfer"] is None
    assert detail["state"] == "approved"
    assert detail["placement_year"] == (2028 if approval_first else 2027)


def test_transfer_approval_rechecks_locked_project_state(planning):
    approved, _operation_type = approved_activity(planning)
    revision = request_transfer(planning, approved)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    with Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text("UPDATE pta_project SET state='closed' WHERE id=:id"),
            {"id": approved["project_id"]},
        )
    response = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert response.status_code == 409
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["placement_year"] == 2027
    assert detail["transfer"]["target_year"] == 2028


def _wait_for_transfer_database_lock(engine, pid):
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
    pytest.fail("concurrent transfer HTTP operation did not wait on its lock")


@pytest.mark.parametrize("resource", ["context", "list"])
@pytest.mark.parametrize("read_first", [True, False])
def test_transfer_activation_and_public_annual_reads_are_coherent(
    planning, resource, read_first
):
    approved, _operation_type = approved_activity(planning)
    revision = request_transfer(planning, approved)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    paths = {
        "context": f"/api/v1/projects/{approved['project_id']}/ptas/2027",
        "list": f"/api/v1/ptas/{approved['pta_id']}/activities",
    }
    reader = TestClient(planning["admin"].app, base_url="http://localhost")
    writer = TestClient(planning["admin"].app, base_url="http://localhost")
    reader.cookies.update(planning["agent"].cookies)
    writer.cookies.update(planning["validator"].cookies)
    engine = planning["auth"].engine
    entered, release, attempted = Event(), Event(), Event()
    waiting_pid = {"value": None}
    claimed = False
    claim_lock = Lock()

    def is_shared(statement):
        return "PG_ADVISORY_XACT_LOCK_SHARED(1843201)" in statement.upper()

    def is_exclusive(statement):
        normalized = statement.upper()
        return (
            "PG_ADVISORY_XACT_LOCK(1843201)" in normalized
            and "_SHARED" not in normalized
        )

    held_lock = is_shared if read_first else is_exclusive
    waiting_lock = is_exclusive if read_first else is_shared

    def hold_first(_conn, _cursor, statement, _parameters, _context, _many):
        nonlocal claimed
        if not held_lock(statement):
            return
        with claim_lock:
            if claimed:
                return
            claimed = True
        entered.set()
        assert release.wait(5), "bounded transfer read release missing"

    def observe_waiter(conn, _cursor, statement, _parameters, _context, _many):
        if not entered.is_set() or not waiting_lock(statement):
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
    try:
        with (
            ThreadPoolExecutor(max_workers=1) as one,
            ThreadPoolExecutor(max_workers=1) as two,
        ):
            first = (
                one.submit(reader.get, paths[resource])
                if read_first
                else one.submit(approve)
            )
            assert entered.wait(5), "first transfer operation did not acquire its lock"
            second = (
                two.submit(approve)
                if read_first
                else two.submit(reader.get, paths[resource])
            )
            assert attempted.wait(5), (
                "second transfer operation did not attempt its lock"
            )
            _wait_for_transfer_database_lock(engine, waiting_pid["value"])
            release.set()
            first_response = first.result(timeout=10)
            second_response = second.result(timeout=10)
    finally:
        release.set()
        event.remove(engine, "after_cursor_execute", hold_first)
        event.remove(engine, "before_cursor_execute", observe_waiter)
        reader.close()
        writer.close()
    read_response = first_response if read_first else second_response
    write_response = second_response if read_first else first_response
    assert read_response.status_code == 200, read_response.text
    assert write_response.status_code == 201, write_response.text
    if resource == "context":
        assert read_response.json()["approved_plan"]["activity_count"] == (
            1 if read_first else 0
        )
    else:
        rows = read_response.json()["data"]
        matching = [row for row in rows if row["id"] == approved["id"]]
        assert bool(matching) is read_first
        if matching:
            assert matching[0]["state"] == "prevalidated"
    final = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert final["placement_year"] == 2028


def test_two_forward_transfers_need_new_requests_and_preserve_both_histories(planning):
    approved, _operation_type = approved_activity(planning)
    first = request_transfer(planning, approved)
    moved_once = approve_transfer(planning, approved, first)
    second = request_transfer(
        planning, moved_once, start="2029-02-01", end="2029-08-31"
    )
    moved_twice = approve_transfer(planning, moved_once, second)
    assert moved_twice["placement_year"] == 2029
    stale = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/transfers/"
        f"{first['snapshot']['transfer']['id']}/cancellation",
        {
            "expected_version": moved_twice["version"],
            "expected_approved_revision_id": moved_twice["approved_revision_id"],
            "expected_revision_id": first["id"],
            "reason": "Ancienne commande refusée.",
        },
    )
    assert stale.status_code == 409
    with Session(planning["auth"].engine) as db:
        targets = set(
            db.scalars(
                text(
                    "SELECT (snapshot->'transfer'->>'target_year')::integer "
                    "FROM pta_activity_revision WHERE activity_id=:id "
                    "AND snapshot ? 'transfer'"
                ),
                {"id": approved["id"]},
            )
        )
    assert targets == {2028, 2029}


@pytest.mark.parametrize("creation_first", [True, False])
def test_transfer_and_ordinary_creation_share_one_missing_target_pta(
    planning, creation_first
):
    approved, operation_type = approved_activity(planning)
    revision = request_transfer(planning, approved)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()

    def approve():
        return post(
            planning["validator"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        )

    def create():
        return post(
            planning["agent2"],
            f"/api/v1/projects/{approved['project_id']}/ptas/2028/activities",
            {
                **plan(
                    operation_type,
                    planned_start="2028-04-01",
                    planned_end="2028-07-01",
                ),
                "request_key": str(uuid4()),
            },
        )

    first, second = ordered_advisory_race(
        planning["auth"],
        create if creation_first else approve,
        approve if creation_first else create,
    )
    assert first.status_code == 201
    assert second.status_code == 201
    with Session(planning["auth"].engine) as db:
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM pta_annual "
                    "WHERE project_id=:project_id AND year=2028"
                ),
                {"project_id": approved["project_id"]},
            )
            == 1
        )


def test_transfer_request_rolls_back_when_audit_fails(planning, monkeypatch):
    approved, _operation_type = approved_activity(planning)
    original = planning["auth"].business_audit

    def fail(db, action, *args, **kwargs):
        if action == "activity.transfer_submit":
            raise IntegrityError("synthetic transfer audit failure", {}, Exception())
        return original(db, action, *args, **kwargs)

    monkeypatch.setattr(planning["auth"], "business_audit", fail)
    response = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/transfers",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Rollback synthétique.",
            "planned_start": "2028-01-01",
            "planned_end": "2028-06-30",
        },
    )
    assert response.status_code == 503
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["version"] == approved["version"]
    assert detail["transfer"] is None


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
def test_every_transfer_responsibility_rolls_back(
    planning, monkeypatch, responsibility, failure
):
    approved, _operation_type = approved_activity(planning)
    revision = None
    if responsibility != "request":
        revision = request_transfer(planning, approved)
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
        prevalidated = post(
            planning["supervisor"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {"expected_version": current_version, "decision": "prevalidate"},
        ).json()
        current_version = prevalidated["activity_version"]
    before = persisted_withdrawal_state(planning, approved["id"])
    auth = planning["auth"]
    original = auth.business_audit

    def fail_transaction(db, action, *args, **kwargs):
        if failure == "audit" and action.startswith("activity.transfer_"):
            raise IntegrityError("synthetic transfer audit failure", {}, Exception())
        result = original(db, action, *args, **kwargs)
        if action.startswith("activity.transfer_"):
            if failure == "constraint":
                db.execute(
                    text(
                        "INSERT INTO mjl_ownership_context (id,created_at) "
                        "VALUES ('NOT_MJL',clock_timestamp())"
                    )
                )
            elif failure == "commit":
                db.info["fail_transfer_commit"] = True
        return result

    monkeypatch.setattr(auth, "business_audit", fail_transaction)
    if failure == "commit":
        original_commit = SessionTransaction.commit

        def fail_commit(transaction, *args, **kwargs):
            if transaction.session.info.pop("fail_transfer_commit", False):
                raise IntegrityError(
                    "synthetic transfer commit failure", {}, Exception()
                )
            return original_commit(transaction, *args, **kwargs)

        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    if responsibility == "request":
        response = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/transfers",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Échec synthétique.",
                "planned_start": "2028-02-01",
                "planned_end": "2028-08-31",
            },
        )
    elif responsibility == "correction":
        response = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/transfers",
            {
                "expected_version": current_version,
                "expected_revision_id": revision["id"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "transfer_id": revision["snapshot"]["transfer"]["id"],
                "reason": "Correction annulée par rollback.",
                "planned_start": "2028-03-01",
                "planned_end": "2028-09-30",
            },
        )
    elif responsibility == "cancel":
        response = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/transfers/"
            f"{revision['snapshot']['transfer']['id']}/cancellation",
            {
                "expected_version": current_version,
                "expected_revision_id": revision["id"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Annulation annulée par rollback.",
            },
        )
    else:
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


@pytest.mark.parametrize("preexisting_target", [False, True])
def test_transfer_approval_rolls_back_target_and_state_on_audit_failure(
    planning, monkeypatch, preexisting_target
):
    approved, operation_type = approved_activity(planning)
    if preexisting_target:
        created = post(
            planning["agent2"],
            f"/api/v1/projects/{approved['project_id']}/ptas/2028/activities",
            {
                **plan(
                    operation_type,
                    planned_start="2028-05-01",
                    planned_end="2028-08-01",
                ),
                "request_key": str(uuid4()),
            },
        )
        assert created.status_code == 201
    revision = request_transfer(planning, approved)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    original = planning["auth"].business_audit

    def fail(db, action, *args, **kwargs):
        if action == "activity.transfer_approve":
            raise IntegrityError("synthetic approval audit failure", {}, Exception())
        return original(db, action, *args, **kwargs)

    monkeypatch.setattr(planning["auth"], "business_audit", fail)
    response = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert response.status_code == 503
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["state"] == "prevalidated"
    assert detail["placement_year"] == 2027
    with Session(planning["auth"].engine) as db:
        assert db.scalar(
            text(
                "SELECT count(*) FROM pta_annual "
                "WHERE project_id=:project_id AND year=2028"
            ),
            {"project_id": approved["project_id"]},
        ) == int(preexisting_target)


def test_transfer_openapi_contract_is_two_strict_post_routes(planning):
    document = planning["agent"].get("/openapi.json").json()
    paths = document["paths"]
    request_path = "/api/v1/activities/{identifier}/transfers"
    cancellation_path = (
        "/api/v1/activities/{identifier}/transfers/{transfer_id}/cancellation"
    )
    assert set(paths[request_path]) == {"post"}
    assert set(paths[cancellation_path]) == {"post"}
    for path in (request_path, cancellation_path):
        headers_present = {
            parameter["name"]
            for parameter in paths[path]["post"]["parameters"]
            if parameter["in"] == "header"
        }
        assert headers_present == {"Origin", "X-CSRF-Token"}
    schemas = document["components"]["schemas"]
    assert schemas["TransferInput"]["additionalProperties"] is False
    assert schemas["TransferCancellationInput"]["additionalProperties"] is False


def test_used_transfer_database_refuses_destructive_downgrade(planning, auth_env):
    approved, _operation_type = approved_activity(planning)
    request_transfer(planning, approved)
    planning["auth"].engine.dispose()

    with pytest.raises(Exception, match="Refusing destructive PTA-2B.2B downgrade"):
        command.downgrade(Config("alembic.ini"), "0008_pta2b2a")

    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0012_pta3c"
            )
            assert (
                db.scalar(
                    text(
                        "SELECT count(*) FROM pta_activity "
                        "WHERE transfer_id IS NOT NULL"
                    )
                )
                == 1
            )
    finally:
        engine.dispose()
