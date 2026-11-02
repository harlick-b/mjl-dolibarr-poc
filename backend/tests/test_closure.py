# ruff: noqa: F401, F811
import os
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session, SessionTransaction
from test_access import headers
from test_disbursement import finish_activity
from test_execution import approved_execution_activity
from test_planning import admin, ordered_advisory_race, patch, planning, post, put
from test_reversement import confirmed_virement, reversement_path
from test_virement import approved_disbursement, approved_virement

from app.auth.models import Audit, User
from app.planning.models import Activity, ActivityAssignment, Operation


def close_path(activity):
    return f"/api/v1/activities/{activity['id']}/closure"


def settled_activity(clients, *, reversement=True):
    amounts = (80_000, 120_000) if reversement else (100_000, 200_000)
    activity, _source, request, confirmation, _ = confirmed_virement(
        clients, amounts=amounts, allocations=(100_000, 200_000)
    )
    version = confirmation["activity_version"]
    if reversement:
        declaration = post(
            clients["agent"],
            reversement_path(activity, request),
            {
                "expected_version": version,
                "return_date": "2026-10-28",
                "note": "REVERSEMENT-CLOTURE",
            },
        )
        assert declaration.status_code == 201, declaration.text
        version = declaration.json()["activity_version"]
    agent_id = clients["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    assigned = put(
        clients["supervisor"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": version, "agent_ids": [agent_id]},
    )
    assert assigned.status_code == 200, assigned.text
    version = assigned.json()["version"]
    return activity, request, version


def test_agent_closes_complete_activity_atomically(planning):
    activity, _request, version = settled_activity(planning)

    response = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["state"] == "closed"
    assert result["version"] == version + 1
    assert result["closure"]["closed_by_id"]
    assert result["closure"]["closed_at"]
    assert result["closure_blockers"] == []
    assert result["allowed_actions"] == ["read"]

    with Session(planning["auth"].engine) as db:
        stored = db.get(Activity, activity["id"])
        assert stored.state == "closed"
        assert stored.closed_at is not None
        assert stored.closed_by_id == result["closure"]["closed_by_id"]
        assert not list(
            db.scalars(
                select(ActivityAssignment).where(
                    ActivityAssignment.activity_id == activity["id"],
                    ActivityAssignment.ended_at.is_(None),
                )
            )
        )
        audit = db.scalar(
            select(Audit).where(
                Audit.action == "activity.closed", Audit.target == activity["id"]
            )
        )
        assert audit is not None

    replay = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert replay.status_code == 409


@pytest.mark.parametrize("first", ["activity", "project"])
def test_activity_and_project_closure_serialize(planning, first):
    activity, _request, version = settled_activity(planning)

    def close_activity():
        return post(
            planning["agent"], close_path(activity), {"expected_version": version}
        )

    def close_project():
        return patch(
            planning["validator"],
            f"/api/v1/projects/{activity['project_id']}",
            {"expected_version": 1, "action": "close"},
        )

    first_response, second_response = ordered_advisory_race(
        planning["auth"],
        close_activity if first == "activity" else close_project,
        close_project if first == "activity" else close_activity,
    )
    activity_response = first_response if first == "activity" else second_response
    project_response = second_response if first == "activity" else first_response
    assert activity_response.status_code == 200, activity_response.text
    assert project_response.status_code == (200 if first == "activity" else 409)


def test_terminal_activity_does_not_hide_unfinished_sibling(planning):
    activity, _request, version = settled_activity(planning)
    closed = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert closed.status_code == 200, closed.text
    terminal = planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
    operation_type = {"id": terminal["operations"][0]["type_id"]}
    draft = post(
        planning["agent2"],
        f"/api/v1/projects/{terminal['project_id']}/ptas/"
        f"{terminal['placement_year']}/activities",
        {
            "name": "Activité encore inachevée",
            "description": "Doit continuer à bloquer le Projet.",
            "planned_start": f"{terminal['placement_year']}-06-01",
            "planned_end": f"{terminal['placement_year']}-09-01",
            "allocation": "1000",
            "operations": [
                {
                    "type_id": operation_type["id"],
                    "name": "Travail restant",
                    "allocation": "1000",
                }
            ],
            "request_key": str(uuid4()),
        },
    )
    assert draft.status_code == 201, draft.text

    response = patch(
        planning["validator"],
        f"/api/v1/projects/{terminal['project_id']}",
        {"expected_version": 1, "action": "close"},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "project_not_empty"


def test_closure_accepts_zero_reversement_without_declaration(planning):
    activity, _request, version = settled_activity(planning, reversement=False)
    response = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert response.status_code == 200, response.text
    assert response.json()["state"] == "closed"


def test_closure_is_agent_only_and_requires_exact_version(planning):
    activity, _request, version = settled_activity(planning)
    path = close_path(activity)
    for client in (planning["supervisor"], planning["validator"], planning["admin"]):
        assert post(client, path, {"expected_version": version}).status_code in {
            401,
            403,
        }
    stale = post(planning["agent"], path, {"expected_version": version - 1})
    assert stale.status_code == 409
    assert (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/execution")
        .json()["state"]
        == "approved"
    )


@pytest.mark.parametrize("actor", ["anonymous", "pending", "inactive"])
def test_closure_rejects_unverified_actor_without_mutation(planning, actor):
    activity, _request, version = settled_activity(planning)
    auth = planning["auth"]
    if actor == "anonymous":
        client = TestClient(planning["admin"].app, base_url="http://localhost")
        close_client = client
        request_headers = {
            "Origin": "http://localhost",
            "X-CSRF-Token": "anonymous",
        }
    else:
        client = None
        close_client = planning["agent"]
        active_headers = headers(close_client)
        agent_id = close_client.get("/api/v1/auth/session").json()["user"]["id"]
        with Session(auth.engine) as db, db.begin():
            user = db.get(User, agent_id, with_for_update=True)
            if actor == "pending":
                context, secret = auth.new_context(db, user)
                context.state = "pending"
                csrf = auth.csrf_token(context.id)
            else:
                user.state = "inactive"
                secret = None
                csrf = None
        if actor == "pending":
            close_client.cookies.clear()
            close_client.cookies.set("mjl_local", secret)
            request_headers = {
                "Origin": "http://localhost",
                "X-CSRF-Token": csrf,
            }
        else:
            request_headers = active_headers
    try:
        response = close_client.post(
            close_path(activity),
            headers=request_headers,
            json={"expected_version": version},
        )
        assert response.status_code == 401
    finally:
        if client is not None:
            client.close()
    with Session(auth.engine) as db:
        stored = db.get(Activity, activity["id"])
        assert stored.state == "approved"
        assert stored.version == version
        assert (
            db.scalar(
                select(Audit.id).where(
                    Audit.action == "activity.closed", Audit.target == activity["id"]
                )
            )
            is None
        )


def test_closure_rejects_csrf_origin_and_guessed_resource(planning):
    activity, _request, version = settled_activity(planning)
    path = close_path(activity)
    body = {"expected_version": version}
    assert planning["agent"].post(path, json=body).status_code in {401, 403}
    assert planning["agent"].post(
        path,
        headers={"Origin": "https://foreign.example", "X-CSRF-Token": "wrong"},
        json=body,
    ).status_code in {401, 403}
    assert (
        post(
            planning["agent"],
            "/api/v1/activities/00000000-0000-4000-8000-000000000000/closure",
            body,
        ).status_code
        == 404
    )
    with Session(planning["auth"].engine) as db:
        stored = db.get(Activity, activity["id"])
        assert stored.state == "approved"
        assert stored.version == version


def test_closure_fails_closed_without_required_reversement(planning):
    activity, _source, _request, confirmation, _ = confirmed_virement(planning)
    response = post(
        planning["agent"],
        close_path(activity),
        {"expected_version": confirmation["activity_version"]},
    )
    assert response.status_code == 409
    assert response.json()["code"] == "reversement_not_settled"
    projection = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert projection["closure_blockers"] == ["reversement_not_settled"]


@pytest.mark.parametrize(
    ("stage", "expected"),
    [
        ("execution", "execution_incomplete"),
        ("disbursement", "disbursement_not_settled"),
        ("virement", "virement_not_settled"),
        ("confirmation", "virement_confirmation_required"),
    ],
)
def test_closure_reports_each_unsettled_stage_without_mutation(
    planning, stage, expected
):
    if stage == "execution":
        activity = approved_execution_activity(planning)
        version = activity["version"]
    elif stage == "disbursement":
        activity = finish_activity(planning)
        version = activity["version"]
    elif stage == "virement":
        activity, request = approved_disbursement(planning)
        version = request["activity_version"]
    else:
        activity, _source, request = approved_virement(planning)
        version = request["activity_version"]
    response = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert response.status_code == 409
    assert response.json()["code"] == expected
    with Session(planning["auth"].engine) as db:
        stored = db.get(Activity, activity["id"])
        assert stored.state == "approved"
        assert stored.closed_at is None


def test_closed_activity_rejects_execution_and_settlement_changes(planning):
    activity, request, version = settled_activity(planning)
    before = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    closed = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert closed.status_code == 200, closed.text
    operation = before["operations"][0]
    execution = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/operations/{operation['id']}/execution",
        {
            "action": "record",
            "expected_version": version + 1,
            "expected_approved_revision_id": activity["approved_revision_id"],
            "actual_spent": operation["actual_spent"],
            "execution_completed": True,
            "execution_observation": "Tentative après clôture.",
            "correction_reason": "La clôture doit bloquer cette correction.",
        },
    )
    assert execution.status_code == 409
    correction = post(
        planning["agent"],
        reversement_path(activity, request) + "/corrections",
        {
            "expected_version": version + 1,
            "return_date": "2026-10-29",
            "note": "Tentative après clôture",
            "reason": "La clôture doit bloquer cette correction.",
        },
    )
    assert correction.status_code == 409
    confirmation = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/virement-requests/"
        f"{request['id']}/confirmation/corrections",
        {
            "expected_version": version + 1,
            "transfer_date": "2026-10-26",
            "note": "Tentative après clôture",
            "reason": "La clôture doit bloquer cette correction.",
        },
    )
    assert confirmation.status_code == 409
    amendment = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/amendments",
        {
            "expected_version": version + 1,
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Tentative après clôture.",
        },
    )
    assert amendment.status_code == 409
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    assignment = put(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": version + 1, "agent_ids": [agent_id]},
    )
    assert assignment.status_code == 409
    planning_detail = planning["supervisor"].get(f"/api/v1/activities/{activity['id']}")
    assert planning_detail.status_code == 200
    assert planning_detail.json()["state"] == "closed"
    assert "assign_agents" not in planning_detail.json()["allowed_actions"]


def test_closed_activity_database_rejects_new_operation(planning):
    activity, _request, version = settled_activity(planning)
    closed = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert closed.status_code == 200, closed.text
    inserted_id = "ffffffff-ffff-4fff-8fff-ffffffffffff"
    with pytest.raises(DBAPIError), planning["auth"].engine.begin() as db:
        db.execute(
            text(
                "INSERT INTO pta_operation("
                "id,context_id,activity_id,type_id,name,allocation,position,"
                "creator_id,updated_by_id,created_at,updated_at,removed_at,"
                "removed_by_id,execution_started_at,execution_completed,"
                "actual_spent,execution_observation) "
                "SELECT :inserted_id,context_id,activity_id,type_id,"
                "'Ajout interdit après clôture',allocation,position+100,"
                "creator_id,updated_by_id,clock_timestamp(),clock_timestamp(),"
                "NULL,NULL,NULL,false,NULL,'' FROM pta_operation "
                "WHERE activity_id=:activity_id ORDER BY position LIMIT 1"
            ),
            {"inserted_id": inserted_id, "activity_id": activity["id"]},
        )
    with Session(planning["auth"].engine) as db:
        assert db.get(Operation, inserted_id) is None
        assert db.get(Activity, activity["id"]).state == "closed"


@pytest.mark.parametrize("failure", ["audit", "constraint", "commit"])
def test_closure_failure_rolls_back_state_and_assignments(
    planning, monkeypatch, failure
):
    activity, _request, version = settled_activity(planning)
    original = planning["auth"].business_audit

    def fail(db, action, actor, target, business):
        if action == "activity.closed" and failure == "audit":
            raise RuntimeError("synthetic closure audit failure")
        result = original(db, action, actor, target, business)
        if action == "activity.closed" and failure == "constraint":
            db.execute(
                text(
                    "INSERT INTO mjl_ownership_context(id,created_at) "
                    "VALUES ('BAD',clock_timestamp())"
                )
            )
        if action == "activity.closed" and failure == "commit":
            db.info["fail_closure_commit"] = True
        return result

    monkeypatch.setattr(planning["auth"], "business_audit", fail)
    if failure == "commit":
        original_commit = SessionTransaction.commit

        def fail_commit(transaction, *args, **kwargs):
            if transaction.session.info.pop("fail_closure_commit", False):
                raise IntegrityError(
                    "synthetic closure commit failure", {}, Exception()
                )
            return original_commit(transaction, *args, **kwargs)

        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    if failure == "audit":
        with pytest.raises(RuntimeError, match="synthetic closure audit failure"):
            post(
                planning["agent"],
                close_path(activity),
                {"expected_version": version},
            )
    else:
        assert (
            post(
                planning["agent"],
                close_path(activity),
                {"expected_version": version},
            ).status_code
            == 503
        )
    with Session(planning["auth"].engine) as db:
        stored = db.get(Activity, activity["id"])
        assert stored.state == "approved"
        assert stored.closed_at is None
        assert db.scalar(
            select(ActivityAssignment.id).where(
                ActivityAssignment.activity_id == activity["id"],
                ActivityAssignment.ended_at.is_(None),
            )
        )
        assert (
            db.scalar(
                select(Audit.id).where(
                    Audit.action == "activity.closed", Audit.target == activity["id"]
                )
            )
            is None
        )


def test_duplicate_closure_serializes_to_one_winner(planning):
    activity, _request, version = settled_activity(planning)

    def close():
        return post(
            planning["agent"], close_path(activity), {"expected_version": version}
        )

    first, second = ordered_advisory_race(planning["auth"], close, close)
    assert (first.status_code, second.status_code) == (200, 409)
    with Session(planning["auth"].engine) as db:
        assert (
            db.scalar(
                select(Audit.id).where(
                    Audit.action == "activity.closed",
                    Audit.target == activity["id"],
                )
            )
            is not None
        )


@pytest.mark.parametrize(
    "competing",
    ["operation", "confirmation", "reversement", "amendment", "assignment"],
)
def test_closure_serializes_before_adjacent_mutations(planning, competing):
    activity, request, version = settled_activity(planning)
    execution = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    operation = execution["operations"][0]

    def close():
        return post(
            planning["agent"], close_path(activity), {"expected_version": version}
        )

    if competing == "operation":

        def mutate():
            return patch(
                planning["agent"],
                f"/api/v1/activities/{activity['id']}/operations/"
                f"{operation['id']}/execution",
                {
                    "action": "record",
                    "expected_version": version,
                    "expected_approved_revision_id": activity["approved_revision_id"],
                    "actual_spent": operation["actual_spent"],
                    "execution_completed": True,
                    "execution_observation": "Correction concurrente.",
                    "correction_reason": "Vérification de la sérialisation.",
                },
            )
    elif competing == "confirmation":

        def mutate():
            return post(
                planning["agent"],
                f"/api/v1/activities/{activity['id']}/virement-requests/"
                f"{request['id']}/confirmation/corrections",
                {
                    "expected_version": version,
                    "transfer_date": "2026-10-26",
                    "note": "Correction concurrente",
                    "reason": "Vérification de la sérialisation.",
                },
            )
    elif competing == "reversement":

        def mutate():
            return post(
                planning["agent"],
                reversement_path(activity, request) + "/corrections",
                {
                    "expected_version": version,
                    "return_date": "2026-10-29",
                    "note": "Correction concurrente",
                    "reason": "Vérification de la sérialisation.",
                },
            )
    elif competing == "amendment":

        def mutate():
            return post(
                planning["agent"],
                f"/api/v1/activities/{activity['id']}/amendments",
                {
                    "expected_version": version,
                    "expected_approved_revision_id": activity["approved_revision_id"],
                    "reason": "Modification concurrente synthétique.",
                },
            )
    else:
        agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]

        def mutate():
            return put(
                planning["supervisor"],
                f"/api/v1/activities/{activity['id']}/assignments",
                {"expected_version": version, "agent_ids": [agent_id]},
            )

    closed, denied = ordered_advisory_race(planning["auth"], close, mutate)
    assert (closed.status_code, denied.status_code) == (200, 409)
    with Session(planning["auth"].engine) as db:
        stored = db.get(Activity, activity["id"])
        assert stored.state == "closed"
        assert stored.version == version + 1
        assert (
            len(
                list(
                    db.scalars(
                        select(Audit.id).where(
                            Audit.action == "activity.closed",
                            Audit.target == activity["id"],
                        )
                    )
                )
            )
            == 1
        )


def test_closure_serializes_with_account_lifecycle(planning):
    activity, _request, version = settled_activity(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    account = next(
        row
        for row in planning["admin"].get("/api/v1/access/users").json()["items"]
        if row["id"] == agent_id
    )
    closed, deactivated = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent"], close_path(activity), {"expected_version": version}
        ),
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{agent_id}",
            headers=headers(planning["admin"]),
            json={"expected_version": account["version"], "deactivate": True},
        ),
    )
    assert (closed.status_code, deactivated.status_code) == (200, 200)
    with Session(planning["auth"].engine) as db:
        assert db.get(Activity, activity["id"]).state == "closed"
        assert db.get(User, agent_id).state == "inactive"


def test_pta3f_migration_upgrades_clean_predecessor(auth_env, monkeypatch):
    config = Config("alembic.ini")
    base = make_url(os.environ["TEST_DATABASE_URL"])
    canonical_name = "mjl_test_" + uuid4().hex
    admin_engine = create_engine(base, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as db:
        db.execute(text(f"CREATE DATABASE {canonical_name}"))
    canonical_url = base.set(database=canonical_name).render_as_string(
        hide_password=False
    )
    monkeypatch.setenv("DATABASE_URL", canonical_url)
    command.upgrade(config, "0014_pta3e")
    canonical_engine = create_engine(canonical_url)
    try:
        with canonical_engine.connect() as db:
            canonical_trigger = db.scalar(
                text(
                    "SELECT pg_get_triggerdef(oid) FROM pg_trigger "
                    "WHERE tgname='operation_execution_immutable'"
                )
            )
            canonical_function = db.scalar(
                text(
                    "SELECT pg_get_functiondef("
                    "'pta_preserve_operation_execution()'::regprocedure)"
                )
            )
    finally:
        canonical_engine.dispose()
        with admin_engine.connect() as db:
            db.execute(text(f"DROP DATABASE {canonical_name} WITH (FORCE)"))
        admin_engine.dispose()
    monkeypatch.setenv("DATABASE_URL", auth_env.url)
    command.downgrade(config, "0014_pta3e")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0014_pta3e"
            )
            columns = {row["name"] for row in inspect(db).get_columns("pta_activity")}
            assert "closed_at" not in columns
            assert "closed_by_id" not in columns
            trigger = db.scalar(
                text(
                    "SELECT pg_get_triggerdef(oid) FROM pg_trigger "
                    "WHERE tgname='operation_execution_immutable'"
                )
            )
            function = db.scalar(
                text(
                    "SELECT pg_get_functiondef("
                    "'pta_preserve_operation_execution()'::regprocedure)"
                )
            )
            assert isinstance(trigger, str)
            assert isinstance(function, str)
            assert trigger == canonical_trigger
            assert function == canonical_function
            assert "INSERT" not in trigger
            assert "Closed Activity Operation is immutable" not in function
    finally:
        engine.dispose()
    command.upgrade(config, "head")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0016_pta5"
            )
            columns = {row["name"] for row in inspect(db).get_columns("pta_activity")}
            assert {"closed_at", "closed_by_id"} <= columns
            assert db.scalar(text("SELECT count(*) FROM pta_activity")) == 0
    finally:
        engine.dispose()


def test_closure_evidence_refuses_destructive_downgrade(planning, auth_env):
    activity, _request, version = settled_activity(planning)
    response = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert response.status_code == 200, response.text
    planning["auth"].engine.dispose()
    with pytest.raises(Exception, match="Refusing destructive PTA-3F downgrade"):
        command.downgrade(Config("alembic.ini"), "0014_pta3e")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0016_pta5"
            )
    finally:
        engine.dispose()


def test_closure_schema_guard_rejects_function_drift(planning):
    activity, _request, version = settled_activity(planning)
    with planning["auth"].engine.begin() as db:
        original = db.scalar(
            text(
                "SELECT pg_get_functiondef("
                "'pta_validate_activity_closure()'::regprocedure)"
            )
        )
        assert isinstance(original, str)
        db.execute(
            text(
                "CREATE OR REPLACE FUNCTION pta_validate_activity_closure() "
                "RETURNS trigger LANGUAGE plpgsql AS "
                "$$ BEGIN RETURN NEW; END $$"
            )
        )
    try:
        response = post(
            planning["agent"], close_path(activity), {"expected_version": version}
        )
        assert response.status_code == 409
        assert response.json()["code"] == "eligibility_unverified"
    finally:
        with planning["auth"].engine.begin() as db:
            db.execute(text(original))
    with Session(planning["auth"].engine) as db:
        stored = db.get(Activity, activity["id"])
        assert stored.state == "approved"
        assert stored.closed_at is None
