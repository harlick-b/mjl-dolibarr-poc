from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from threading import Barrier, Event, Lock
from time import monotonic
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, SessionTransaction
from test_access import activate, headers
from test_access import admin as admin_fixture

from app.auth.models import Audit, User
from app.auth.service import AuthError
from app.planning.models import (
    Activity,
    ActivityAssignment,
    AnnualPTA,
    Operation,
    Partner,
)

admin = admin_fixture


def invite(admin, auth_env, stack, email, role):
    response = admin.post(
        "/api/v1/access/invitations",
        headers=headers(admin),
        json={"email": email, "role": role},
    )
    assert response.status_code == 201, response.text
    client = stack.enter_context(TestClient(admin.app, base_url="http://localhost"))
    activate(client, auth_env.mailbox, email)
    return client


@pytest.fixture
def planning(admin, auth_env):
    with ExitStack() as stack:
        clients = {
            "admin": admin,
            "agent": invite(
                admin, auth_env, stack, "agent@example.test", "AGENT_SAISIE"
            ),
            "agent2": invite(
                admin, auth_env, stack, "agent2@example.test", "AGENT_SAISIE"
            ),
            "supervisor": invite(
                admin,
                auth_env,
                stack,
                "supervisor@example.test",
                "AGENT_VERIFICATEUR",
            ),
            "validator": invite(
                admin,
                auth_env,
                stack,
                "validator@example.test",
                "VALIDATEUR_DEFINITIF",
            ),
        }
        auth = admin.app.state.auth
        auth.policy = auth.policy.model_copy(
            update={"lifecycle_database": auth.engine.url.database}
        )
        auth.provision_context("test-operator", "PTA-1 integration tests")
        clients["auth"] = auth
        yield clients


def post(client, path, body):
    return client.post(path, headers=headers(client), json=body)


def put(client, path, body):
    return client.put(path, headers=headers(client), json=body)


def patch(client, path, body):
    return client.patch(path, headers=headers(client), json=body)


def ordered_advisory_race(auth, first, second):
    """Hold the first mutation after advisory acquisition; prove the second waits."""
    entered = Event()
    release = Event()
    claimed = False
    claim_lock = Lock()

    def hold(_conn, _cursor, statement, _parameters, _context, _many):
        nonlocal claimed
        if "pg_advisory_xact_lock(1843201)" not in statement:
            return
        with claim_lock:
            if claimed:
                return
            claimed = True
        if claimed:
            entered.set()
            assert release.wait(5), "bounded release missing"

    event.listen(auth.engine, "after_cursor_execute", hold)
    try:
        with (
            ThreadPoolExecutor(max_workers=1, thread_name_prefix="held-first") as one,
            ThreadPoolExecutor(
                max_workers=1, thread_name_prefix="waiting-second"
            ) as two,
        ):
            first_result = one.submit(first)
            assert entered.wait(5), "first mutation never acquired advisory lock"
            second_result = two.submit(second)
            deadline = monotonic() + 5
            waiting = False
            while monotonic() < deadline:
                with auth.engine.connect() as db:
                    waiting = bool(
                        db.scalar(
                            text(
                                "SELECT count(*) FROM pg_stat_activity "
                                "WHERE datname=current_database() "
                                "AND wait_event_type='Lock' "
                                "AND query LIKE '%pg_advisory_xact_lock(1843201)%'"
                            )
                        )
                    )
                if waiting:
                    break
                Event().wait(0.01)
            assert waiting, "second mutation did not block on the shared advisory lock"
            release.set()
            return first_result.result(timeout=10), second_result.result(timeout=10)
    finally:
        release.set()
        event.remove(auth.engine, "after_cursor_execute", hold)


def references(planning):
    validator = planning["validator"]
    partner = post(validator, "/api/v1/partners", {"name": "Partenaire test"})
    assert partner.status_code == 201, partner.text
    operation_type = post(validator, "/api/v1/operation-types", {"label": "Formation"})
    assert operation_type.status_code == 201, operation_type.text
    project = post(
        validator,
        "/api/v1/projects",
        {"partner_id": partner.json()["id"], "name": "Projet test"},
    )
    assert project.status_code == 201, project.text
    return partner.json(), operation_type.json(), project.json()


def plan(operation_type, **changes):
    body = {
        "name": "Activité synthétique",
        "description": "Planification complète de test",
        "planned_start": "2027-11-30",
        "planned_end": "2028-02-29",
        "allocation": "300000",
        "operations": [
            {
                "type_id": operation_type["id"],
                "name": "Préparation",
                "allocation": "100000",
            },
            {
                "type_id": operation_type["id"],
                "name": "Exécution",
                "allocation": "200000",
            },
        ],
    }
    body.update(changes)
    return body


def create_activity(planning):
    partner, operation_type, project = references(planning)
    body = {**plan(operation_type), "request_key": str(uuid4())}
    response = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        body,
    )
    assert response.status_code == 201, response.text
    return partner, operation_type, project, response.json(), body


def test_p01_provisioning_is_idempotent_audited_and_singleton(planning):
    auth = planning["auth"]
    auth.provision_context("second-operator", "safe retry")
    with Session(auth.engine) as db:
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM auth_audit "
                    "WHERE action='ownership_context.provisioned' AND outcome='ok'"
                )
            )
            == 1
        )
        audit = db.scalar(
            text(
                "SELECT details->>'reason' FROM auth_audit "
                "WHERE action='ownership_context.provisioned'"
            )
        )
        assert audit == "PTA-1 integration tests"
        with pytest.raises(IntegrityError):
            db.execute(
                text(
                    "INSERT INTO mjl_ownership_context(id,created_at) "
                    "VALUES ('BAD',clock_timestamp())"
                )
            )
        db.rollback()


def test_p01_p04_p06_complete_activity_replay_and_exact_attribution(planning):
    _, operation_type, project, activity, body = create_activity(planning)
    assert activity["allocation"] == "300000"
    assert len(activity["operations"]) == 2
    replay = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        body,
    )
    assert replay.status_code == 200
    assert replay.json()["id"] == activity["id"]
    altered = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**body, "name": "Payload différent"},
    )
    assert altered.status_code == 409
    second = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type, name="Seconde activité"), "request_key": str(uuid4())},
    )
    assert second.status_code == 201
    with Session(planning["auth"].engine) as db:
        assert db.query(AnnualPTA).count() == 1
        assert db.query(Activity).count() == 2


@pytest.mark.parametrize(
    "change",
    [
        {"allocation": "0"},
        {"allocation": "1.5"},
        {"allocation": "9223372036854775808"},
        {"operations": []},
        {
            "allocation": "300001",
        },
        {"planned_start": "2028-01-01"},
    ],
)
def test_p09_p10_invalid_planning_rolls_back(planning, change):
    _, operation_type, project = references(planning)
    response = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), **change, "request_key": str(uuid4())},
    )
    assert response.status_code == 422
    with Session(planning["auth"].engine) as db:
        assert db.query(Activity).count() == 0
        assert db.query(AnnualPTA).count() == 0


def test_p02_p12_p13_role_matrix_and_coordination_assignment(planning):
    partner, operation_type, project, activity, _ = create_activity(planning)
    admin = planning["admin"]
    read_paths = [
        "/api/v1/partners",
        "/api/v1/operation-types",
        "/api/v1/projects",
        f"/api/v1/projects/{project['id']}",
        f"/api/v1/projects/{project['id']}/ptas",
        f"/api/v1/projects/{project['id']}/ptas/2027",
        f"/api/v1/ptas/{activity['pta_id']}/activities",
        f"/api/v1/activities/{activity['id']}",
    ]
    for actor in ("agent", "supervisor", "validator"):
        for path in read_paths:
            assert planning[actor].get(path).status_code == 200, (actor, path)
    for path in [*read_paths, "/api/v1/assignment-agents"]:
        assert admin.get(path).status_code == 403, path
    assert planning["agent"].get("/api/v1/assignment-agents").status_code == 403
    for actor in ("supervisor", "validator"):
        assert planning[actor].get("/api/v1/assignment-agents").status_code == 200

    restricted_reference_writes = [
        ("/api/v1/partners", {"name": "Interdit"}),
        ("/api/v1/operation-types", {"label": "Interdit"}),
        (
            "/api/v1/projects",
            {"partner_id": partner["id"], "name": "Interdit"},
        ),
    ]
    for actor in ("agent", "supervisor"):
        for path, body in restricted_reference_writes:
            assert post(planning[actor], path, body).status_code == 403, (actor, path)
    for actor in ("supervisor", "validator"):
        assert (
            post(
                planning[actor],
                f"/api/v1/projects/{project['id']}/ptas/2027/activities",
                {**plan(operation_type), "request_key": str(uuid4())},
            ).status_code
            == 403
        )
        assert (
            patch(
                planning[actor],
                f"/api/v1/activities/{activity['id']}",
                {**plan(operation_type), "expected_version": activity["version"]},
            ).status_code
            == 403
        )
    empty_partner = post(
        planning["validator"], "/api/v1/partners", {"name": "À clore"}
    ).json()
    empty_projects = []
    for actor in ("agent", "supervisor", "validator"):
        candidate = post(
            planning["validator"],
            "/api/v1/projects",
            {"partner_id": empty_partner["id"], "name": f"Projet {actor}"},
        )
        if actor != "agent":
            # Only one active Project is allowed, so close before creating the next.
            assert candidate.status_code == 201
        else:
            assert candidate.status_code == 201
        empty_projects.append(candidate.json())
        result = patch(
            planning[actor],
            f"/api/v1/projects/{candidate.json()['id']}",
            {"expected_version": 1, "action": "close"},
        )
        assert result.status_code == (200 if actor == "validator" else 403)
        if actor != "validator":
            closed = patch(
                planning["validator"],
                f"/api/v1/projects/{candidate.json()['id']}",
                {"expected_version": 1, "action": "close"},
            )
            assert closed.status_code == 200
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    assigned = put(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": activity["version"], "agent_ids": [agent_id]},
    )
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()["agent_ids"] == [agent_id]
    validator_assigned = put(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": assigned.json()["version"], "agent_ids": [agent_id]},
    )
    assert validator_assigned.status_code == 200
    assert (
        put(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {
                "expected_version": validator_assigned.json()["version"],
                "agent_ids": [],
            },
        ).status_code
        == 403
    )
    edited = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}",
        {
            **plan(operation_type, name="Modifiée par un autre Agent"),
            "expected_version": validator_assigned.json()["version"],
        },
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["agent_ids"] == [agent_id]


def test_p08_p14_closure_and_stale_versions(planning):
    partner, operation_type, project = references(planning)
    empty_partner = post(
        planning["validator"], "/api/v1/partners", {"name": "Vide"}
    ).json()
    empty = post(
        planning["validator"],
        "/api/v1/projects",
        {"partner_id": empty_partner["id"], "name": "Projet vide"},
    ).json()
    closed = patch(
        planning["validator"],
        f"/api/v1/projects/{empty['id']}",
        {"expected_version": 1, "action": "close"},
    )
    assert closed.status_code == 200
    assert (
        patch(
            planning["validator"],
            f"/api/v1/projects/{empty['id']}",
            {"expected_version": 1, "action": "close"},
        ).status_code
        == 409
    )
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    assert (
        patch(
            planning["validator"],
            f"/api/v1/projects/{project['id']}",
            {"expected_version": 1, "action": "close"},
        ).status_code
        == 409
    )
    first = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}",
        {**plan(operation_type, name="Premier"), "expected_version": 1},
    )
    assert first.status_code == 200
    stale = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}",
        {**plan(operation_type, name="Perdu"), "expected_version": 1},
    )
    assert stale.status_code == 409


def test_p17_assignment_blocks_lifecycle_but_ended_history_does_not(planning):
    _, _, _, activity, _ = create_activity(planning)
    agent_session = planning["agent"].get("/api/v1/auth/session").json()
    agent_id = agent_session["user"]["id"]
    assigned = put(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": 1, "agent_ids": [agent_id]},
    ).json()
    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    user = next(row for row in users if row["id"] == agent_id)
    denied = planning["admin"].patch(
        f"/api/v1/access/users/{agent_id}",
        headers=headers(planning["admin"]),
        json={"deactivate": True, "expected_version": user["version"]},
    )
    assert denied.status_code == 409
    cleared = put(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": assigned["version"], "agent_ids": []},
    )
    assert cleared.status_code == 200
    accepted = planning["admin"].patch(
        f"/api/v1/access/users/{agent_id}",
        headers=headers(planning["admin"]),
        json={"deactivate": True, "expected_version": user["version"]},
    )
    assert accepted.status_code == 200
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityAssignment).count() == 1
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM pta_activity_agent_assignment "
                    "WHERE ended_at IS NULL"
                )
            )
            == 0
        )


def test_p20_openapi_cursors_and_no_review_surface(planning):
    references(planning)
    first = planning["agent"].get("/api/v1/partners?limit=1")
    assert first.status_code == 200
    assert first.json()["object"] == "list"
    tampered = first.json()["next"]
    if tampered:
        assert planning["agent"].get(tampered[:-1] + "x").status_code == 422
    assert planning["agent"].get("/api/v1/partners?limit=101").status_code == 422
    document = planning["agent"].get("/openapi.json").json()
    paths = document["paths"]
    assert not any("review" in path or "validat" in path for path in paths)
    planning_paths = [
        path
        for path in paths
        if path.startswith("/api/v1/")
        and any(
            word in path
            for word in (
                "partner",
                "project",
                "pta",
                "activit",
                "operation-type",
                "assignment-agent",
            )
        )
    ]
    assert all("context_id" not in str(paths[path]) for path in planning_paths)
    assert set(planning_paths) == {
        "/api/v1/partners",
        "/api/v1/operation-types",
        "/api/v1/projects",
        "/api/v1/projects/{identifier}",
        "/api/v1/projects/{identifier}/ptas",
        "/api/v1/projects/{identifier}/ptas/{year}",
        "/api/v1/projects/{identifier}/ptas/{year}/activities",
        "/api/v1/ptas/{identifier}/activities",
        "/api/v1/activities/{identifier}",
        "/api/v1/activities/{identifier}/assignments",
        "/api/v1/assignment-agents",
    }
    for path in planning_paths:
        for operation in paths[path].values():
            if not isinstance(operation, dict) or "responses" not in operation:
                continue
            assert {"401", "403", "404", "409", "422", "429", "503"} <= set(
                operation["responses"]
            )
            assert operation.get("security")


def test_p16_business_audit_contains_complete_bounded_facts(planning):
    _, _, _, activity, _ = create_activity(planning)
    with Session(planning["auth"].engine) as db:
        audit = db.query(Audit).filter(Audit.action == "activity.create").one()
        assert audit.business["context_id"] == "MJL"
        assert audit.business["after"]["id"] == activity["id"]
        assert len(audit.business["after"]["operations"]) == 2
        assert len(str(audit.business).encode()) < 1_048_576
        assert db.query(Operation).count() == 2
        assert db.query(User).filter(User.email.endswith("@example.test")).count() == 5


def test_p05_p07_concurrent_creates_keep_unique_parents(planning):
    _, operation_type, project = references(planning)
    competing_partner = post(
        planning["validator"], "/api/v1/partners", {"name": "Concurrent"}
    ).json()
    gate = Barrier(2)

    def activity(number):
        gate.wait()
        return post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {
                **plan(operation_type, name=f"Activité {number}"),
                "request_key": str(uuid4()),
            },
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(activity, (1, 2)))
    assert [response.status_code for response in results] == [201, 201]
    with Session(planning["auth"].engine) as db:
        assert db.query(AnnualPTA).count() == 1
        assert db.query(Activity).count() == 2

    gate = Barrier(2)

    def duplicate(number):
        gate.wait()
        return post(
            planning["validator"],
            "/api/v1/projects",
            {
                "partner_id": competing_partner["id"],
                "name": f"Concurrent {number}",
            },
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        duplicates = list(pool.map(duplicate, (1, 2)))
    assert sorted(response.status_code for response in duplicates) == [201, 409]


def test_p16_audit_failure_rolls_back_business_write(planning, monkeypatch):
    auth = planning["auth"]

    def fail(*_args, **_kwargs):
        raise IntegrityError("synthetic audit failure", {}, Exception())

    monkeypatch.setattr(auth, "business_audit", fail)
    response = post(
        planning["validator"], "/api/v1/partners", {"name": "Doit disparaître"}
    )
    assert response.status_code == 503
    with Session(auth.engine) as db:
        assert db.query(User).count() == 5
        assert db.scalar(text("SELECT count(*) FROM pta_partner")) == 0


@pytest.mark.parametrize(
    "mutation", ["create", "activity", "replace", "close", "assign"]
)
@pytest.mark.parametrize("failure", ["audit", "constraint", "commit"])
def test_p16_transaction_failure_rolls_back_each_mutation(
    planning, monkeypatch, mutation, failure
):
    operation_type = project = activity = None
    if mutation != "create":
        _, operation_type, project = references(planning)
    if mutation in {"replace", "assign"}:
        _, _, _, activity, _ = create_activity(planning)
    with Session(planning["auth"].engine) as db:
        before = {
            "partners": db.scalar(text("SELECT count(*) FROM pta_partner")),
            "activities": db.scalar(text("SELECT count(*) FROM pta_activity")),
            "assignments": db.scalar(
                text("SELECT count(*) FROM pta_activity_agent_assignment")
            ),
            "audits": db.scalar(
                text("SELECT count(*) FROM auth_audit WHERE business IS NOT NULL")
            ),
            "project": None
            if not project
            else db.execute(
                text("SELECT state,version FROM pta_project WHERE id=:id"),
                {"id": project["id"]},
            ).one(),
            "activity": None
            if not activity
            else db.execute(
                text("SELECT name,version FROM pta_activity WHERE id=:id"),
                {"id": activity["id"]},
            ).one(),
        }

    original_audit = planning["auth"].business_audit

    def fail(db, *args, **kwargs):
        if failure == "audit":
            raise IntegrityError("synthetic audit failure", {}, Exception())
        original_audit(db, *args, **kwargs)
        if failure == "constraint":
            db.execute(
                text(
                    "INSERT INTO mjl_ownership_context(id,created_at) "
                    "VALUES ('BAD',clock_timestamp())"
                )
            )
        else:
            db.info["fail_business_commit"] = True

    original_commit = SessionTransaction.commit

    def fail_commit(transaction, *args, **kwargs):
        if transaction.session.info.pop("fail_business_commit", False):
            raise IntegrityError("synthetic commit failure", {}, Exception())
        return original_commit(transaction, *args, **kwargs)

    monkeypatch.setattr(planning["auth"], "business_audit", fail)
    if failure == "commit":
        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    if mutation == "create":
        response = post(planning["validator"], "/api/v1/partners", {"name": "Rollback"})
    elif mutation == "activity":
        response = post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {**plan(operation_type), "request_key": str(uuid4())},
        )
    elif mutation == "replace":
        response = patch(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}",
            {**plan(operation_type, name="Rollback"), "expected_version": 1},
        )
    elif mutation == "close":
        response = patch(
            planning["validator"],
            f"/api/v1/projects/{project['id']}",
            {"expected_version": 1, "action": "close"},
        )
    else:
        agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
        response = put(
            planning["validator"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 1, "agent_ids": [agent_id]},
        )
    assert response.status_code == 503
    with Session(planning["auth"].engine) as db:
        assert db.scalar(text("SELECT count(*) FROM pta_partner")) == before["partners"]
        assert (
            db.scalar(text("SELECT count(*) FROM pta_activity")) == before["activities"]
        )
        assert (
            db.scalar(text("SELECT count(*) FROM pta_activity_agent_assignment"))
            == before["assignments"]
        )
        assert (
            db.scalar(
                text("SELECT count(*) FROM auth_audit WHERE business IS NOT NULL")
            )
            == before["audits"]
        )
        if project:
            assert (
                db.execute(
                    text("SELECT state,version FROM pta_project WHERE id=:id"),
                    {"id": project["id"]},
                ).one()
                == before["project"]
            )
        if activity:
            assert (
                db.execute(
                    text("SELECT name,version FROM pta_activity WHERE id=:id"),
                    {"id": activity["id"]},
                ).one()
                == before["activity"]
            )


def test_p24_weakened_schema_with_same_constraint_name_fails_closed(planning):
    auth = planning["auth"]
    with auth.engine.begin() as db:
        db.execute(
            text(
                "ALTER TABLE mjl_ownership_context "
                "DROP CONSTRAINT ownership_context_singleton"
            )
        )
        db.execute(
            text(
                "ALTER TABLE mjl_ownership_context ADD CONSTRAINT "
                "ownership_context_singleton CHECK (id IN ('MJL','BAD'))"
            )
        )
    assert planning["agent"].get("/api/v1/projects").status_code == 409


def test_p03_database_ancestry_and_client_context_fail_closed(planning):
    _, operation_type, first_project = references(planning)
    second_partner = post(
        planning["validator"], "/api/v1/partners", {"name": "Second partenaire"}
    ).json()
    second_project = post(
        planning["validator"],
        "/api/v1/projects",
        {"partner_id": second_partner["id"], "name": "Second projet"},
    ).json()
    created = post(
        planning["agent"],
        f"/api/v1/projects/{first_project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    )
    assert created.status_code == 201
    assert (
        post(
            planning["validator"],
            "/api/v1/partners",
            {"name": "Forgé", "context_id": "MJL"},
        ).status_code
        == 422
    )
    with Session(planning["auth"].engine) as db, pytest.raises(IntegrityError):
        row = db.get(Activity, created.json()["id"])
        assert row
        row.request_project_id = second_project["id"]
        db.commit()


def test_p06_p09_duplicate_operation_ids_and_normalized_replay(planning):
    _, operation_type, project, activity, body = create_activity(planning)
    replay = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            **body,
            "name": f"  {body['name']}  ",
            "description": f" {body['description']} ",
            "operations": [
                {**row, "name": f" {row['name']} "} for row in body["operations"]
            ],
        },
    )
    assert replay.status_code == 200
    duplicate_id = activity["operations"][0]["id"]
    replaced = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}",
        {
            **plan(
                operation_type,
                operations=[
                    {
                        "id": duplicate_id,
                        "type_id": operation_type["id"],
                        "name": "A",
                        "allocation": "100000",
                    },
                    {
                        "id": duplicate_id,
                        "type_id": operation_type["id"],
                        "name": "B",
                        "allocation": "200000",
                    },
                ],
            ),
            "expected_version": activity["version"],
        },
    )
    assert replaced.status_code == 422


def test_p17_assignment_lifecycle_race_serializes(planning):
    _, _, _, activity, _ = create_activity(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    agent2_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]
    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    user = next(row for row in users if row["id"] == agent_id)
    user2 = next(row for row in users if row["id"] == agent2_id)
    assigned, denied = ordered_advisory_race(
        planning["auth"],
        lambda: put(
            planning["validator"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 1, "agent_ids": [agent_id]},
        ),
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{agent_id}",
            headers=headers(planning["admin"]),
            json={"deactivate": True, "expected_version": user["version"]},
        ),
    )
    assert (assigned.status_code, denied.status_code) == (200, 409)
    deactivated, rejected = ordered_advisory_race(
        planning["auth"],
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{agent2_id}",
            headers=headers(planning["admin"]),
            json={"deactivate": True, "expected_version": user2["version"]},
        ),
        lambda: put(
            planning["validator"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 2, "agent_ids": [agent_id, agent2_id]},
        ),
    )
    assert (deactivated.status_code, rejected.status_code) == (200, 409)


def test_p05_p07_p08_p14_deterministic_mutation_orders(planning):
    _, operation_type, project = references(planning)
    first, second = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {**plan(operation_type, name="Première"), "request_key": str(uuid4())},
        ),
        lambda: post(
            planning["agent2"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {**plan(operation_type, name="Seconde"), "request_key": str(uuid4())},
        ),
    )
    assert (first.status_code, second.status_code) == (201, 201)
    with Session(planning["auth"].engine) as db:
        assert (
            db.query(AnnualPTA).filter(AnnualPTA.project_id == project["id"]).count()
            == 1
        )

    partner = post(planning["validator"], "/api/v1/partners", {"name": "Course"}).json()
    winner, loser = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["validator"],
            "/api/v1/projects",
            {"partner_id": partner["id"], "name": "Gagnant"},
        ),
        lambda: post(
            planning["validator"],
            "/api/v1/projects",
            {"partner_id": partner["id"], "name": "Perdant"},
        ),
    )
    assert (winner.status_code, loser.status_code) == (201, 409)

    def empty_project(name):
        parent = post(
            planning["validator"], "/api/v1/partners", {"name": f"Parent {name}"}
        ).json()
        return post(
            planning["validator"],
            "/api/v1/projects",
            {"partner_id": parent["id"], "name": name},
        ).json()

    close_first = empty_project("Clore avant")
    closed, create_denied = ordered_advisory_race(
        planning["auth"],
        lambda: patch(
            planning["validator"],
            f"/api/v1/projects/{close_first['id']}",
            {"expected_version": 1, "action": "close"},
        ),
        lambda: post(
            planning["agent"],
            f"/api/v1/projects/{close_first['id']}/ptas/2027/activities",
            {**plan(operation_type), "request_key": str(uuid4())},
        ),
    )
    assert (closed.status_code, create_denied.status_code) == (200, 409)
    create_first = empty_project("Créer avant")
    created, close_denied = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent"],
            f"/api/v1/projects/{create_first['id']}/ptas/2027/activities",
            {**plan(operation_type), "request_key": str(uuid4())},
        ),
        lambda: patch(
            planning["validator"],
            f"/api/v1/projects/{create_first['id']}",
            {"expected_version": 1, "action": "close"},
        ),
    )
    assert (created.status_code, close_denied.status_code) == (201, 409)

    activity = first.json()
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    edited, stale_assignment = ordered_advisory_race(
        planning["auth"],
        lambda: patch(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}",
            {**plan(operation_type, name="Éditée"), "expected_version": 1},
        ),
        lambda: put(
            planning["validator"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 1, "agent_ids": [agent_id]},
        ),
    )
    assert (edited.status_code, stale_assignment.status_code) == (200, 409)
    assigned, stale_edit = ordered_advisory_race(
        planning["auth"],
        lambda: put(
            planning["validator"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 2, "agent_ids": [agent_id]},
        ),
        lambda: patch(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}",
            {**plan(operation_type, name="Perdue"), "expected_version": 2},
        ),
    )
    assert (assigned.status_code, stale_edit.status_code) == (200, 409)


def test_p20_cursor_boundaries_counts_and_create_statuses(planning):
    for number in range(3):
        response = post(
            planning["validator"],
            "/api/v1/partners",
            {"name": f"Partenaire {number}"},
        )
        assert response.status_code == 201
        assert response.headers["location"].startswith("http://localhost/api/v1/")
    first = planning["agent"].get("/api/v1/partners?limit=1").json()
    assert first["count"] == 3 and first["previous"] is None and first["next"]
    cursor = first["next"].split("cursor=", 1)[1]
    assert (
        planning["agent"].get(f"/api/v1/partners?limit=2&cursor={cursor}").status_code
        == 422
    )
    assert (
        planning["agent"].get(f"/api/v1/projects?limit=1&cursor={cursor}").status_code
        == 422
    )
    second = planning["agent"].get(first["next"]).json()
    assert second["count"] == 3 and second["previous"] and second["next"]
    last = planning["agent"].get(second["next"]).json()
    assert last["count"] == 3 and last["previous"] and last["next"] is None
    back = planning["agent"].get(last["previous"]).json()
    assert back["data"][0]["id"] == second["data"][0]["id"]
    document = planning["agent"].get("/openapi.json").json()
    create = document["paths"]["/api/v1/projects/{identifier}/ptas/{year}/activities"][
        "post"
    ]["responses"]
    assert "201" in create and "200" in create


def test_p06_p10_direct_pta_duplicate_and_maximum_xof(planning):
    _, operation_type, project = references(planning)
    maximum = "9223372036854775807"
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            **plan(
                operation_type,
                allocation=maximum,
                operations=[
                    {
                        "type_id": operation_type["id"],
                        "name": "Maximum",
                        "allocation": maximum,
                    }
                ],
            ),
            "request_key": str(uuid4()),
        },
    )
    assert created.status_code == 201
    with Session(planning["auth"].engine) as db, pytest.raises(IntegrityError):
        existing = db.query(AnnualPTA).one()
        db.add(
            AnnualPTA(
                context_id="MJL",
                project_id=project["id"],
                year=2027,
                creator_id=existing.creator_id,
                created_at=existing.created_at,
            )
        )
        db.commit()


def test_p13_assignment_rejects_duplicate_inactive_and_wrong_role(planning):
    _, _, _, activity, _ = create_activity(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    validator_id = (
        planning["validator"].get("/api/v1/auth/session").json()["user"]["id"]
    )
    assert (
        put(
            planning["validator"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 1, "agent_ids": [agent_id, agent_id]},
        ).status_code
        == 422
    )
    assert (
        put(
            planning["validator"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 1, "agent_ids": [validator_id]},
        ).status_code
        == 409
    )
    with planning["auth"].engine.begin() as db:
        db.execute(
            text("UPDATE auth_user SET state='inactive' WHERE id=:id"), {"id": agent_id}
        )
    assert (
        put(
            planning["validator"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 1, "agent_ids": [agent_id]},
        ).status_code
        == 409
    )


def test_p15_p16_tombstones_contributors_and_exact_audit_shapes(planning):
    _, operation_type, _, activity, _ = create_activity(planning)
    removed = activity["operations"][1]
    kept = activity["operations"][0]
    response = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}",
        {
            **plan(
                operation_type,
                allocation="100000",
                operations=[
                    {
                        "id": kept["id"],
                        "type_id": kept["type_id"],
                        "name": kept["name"],
                        "allocation": "100000",
                    }
                ],
            ),
            "expected_version": 1,
        },
    )
    assert response.status_code == 200
    with Session(planning["auth"].engine) as db:
        tombstone = db.get(Operation, removed["id"])
        assert tombstone and tombstone.position == removed["position"]
        assert tombstone.removed_at and tombstone.removed_by_id
        audit = db.scalar(
            select(Audit)
            .where(Audit.action == "activity.replace")
            .order_by(Audit.occurred_at.desc())
        )
        assert audit and audit.business
        assert audit.business["removed_operations"] == [
            {
                "id": removed["id"],
                "position": removed["position"],
                "removed_at": tombstone.removed_at.isoformat(),
                "removed_by_id": tombstone.removed_by_id,
            }
        ]
        row = db.get(Activity, activity["id"])
        current = db.get(Operation, kept["id"])
        assert row and current
        assert row.creator_id != current.updated_by_id
        creator = db.get(User, row.creator_id)
        assert creator
        creator.role = "AGENT_VERIFICATEUR"
        db.flush()
        assert row.creator_id == creator.id and current.updated_by_id != creator.id
        with pytest.raises(ValueError):
            planning["auth"].business_audit(
                db,
                "activity.replace",
                row.creator_id,
                row.id,
                {
                    "context_id": "MJL",
                    "before": {"id": row.id},
                    "after": {"id": row.id},
                },
            )


@pytest.mark.parametrize("failure", ["audit", "constraint", "commit"])
def test_p01_p16_provisioning_failure_rolls_back(
    auth_env, caplog, monkeypatch, failure
):
    from app.auth.policy import Policy
    from app.auth.service import AuthService
    from app.database import make_engine

    engine = make_engine(auth_env.url)
    policy = Policy.model_validate(
        {**auth_env.config, "lifecycle_database": engine.url.database}
    )
    auth = AuthService(engine, policy)

    original_audit = auth.audit

    def fail(db, *args, **kwargs):
        if failure == "audit":
            raise IntegrityError("secret database detail", {}, Exception())
        original_audit(db, *args, **kwargs)
        if failure == "constraint":
            db.execute(
                text(
                    "INSERT INTO mjl_ownership_context(id,created_at) "
                    "VALUES ('BAD',clock_timestamp())"
                )
            )
        else:
            db.info["fail_provision_commit"] = True

    original_commit = SessionTransaction.commit

    def fail_commit(transaction, *args, **kwargs):
        if transaction.session.info.pop("fail_provision_commit", False):
            raise IntegrityError("synthetic commit failure", {}, Exception())
        return original_commit(transaction, *args, **kwargs)

    monkeypatch.setattr(auth, "audit", fail)
    if failure == "commit":
        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    with pytest.raises(IntegrityError):
        auth.provision_context("test-operator", "bounded synthetic reason")
    with Session(engine) as db:
        assert db.scalar(text("SELECT count(*) FROM mjl_ownership_context")) == 0
        assert db.scalar(text("SELECT count(*) FROM auth_audit")) == 0
    message = caplog.text
    assert "test-operator" in message and "bounded synthetic reason" in message
    assert "secret database detail" not in message
    assert "synthetic commit failure" not in message
    engine.dispose()


def test_p01_missing_context_denies_business_writes(planning):
    with planning["auth"].engine.begin() as db:
        db.execute(text("DELETE FROM mjl_ownership_context"))
    response = post(planning["validator"], "/api/v1/partners", {"name": "Refusé"})
    assert response.status_code == 409
    with Session(planning["auth"].engine) as db:
        assert db.query(Partner).count() == 0
        assert db.query(Audit).filter(Audit.action == "partner.create").count() == 0


def responsibility_cases(planning):
    partner, operation_type, project, activity, _ = create_activity(planning)
    empty_partner = post(
        planning["validator"], "/api/v1/partners", {"name": "Matrice vide"}
    ).json()
    empty_project = post(
        planning["validator"],
        "/api/v1/projects",
        {"partner_id": empty_partner["id"], "name": "Projet matrice vide"},
    ).json()
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    pta_id = activity["pta_id"]
    paths = [
        "/api/v1/partners",
        "/api/v1/operation-types",
        "/api/v1/projects",
        f"/api/v1/projects/{project['id']}",
        f"/api/v1/projects/{project['id']}/ptas",
        f"/api/v1/projects/{project['id']}/ptas/2027",
        f"/api/v1/ptas/{pta_id}/activities",
        f"/api/v1/activities/{activity['id']}",
        "/api/v1/assignment-agents",
    ]
    mutations = [
        ("POST", "/api/v1/partners", {"name": "Refusé"}),
        ("POST", "/api/v1/operation-types", {"label": "Refusé"}),
        (
            "POST",
            "/api/v1/projects",
            {"partner_id": partner["id"], "name": "Refusé"},
        ),
        (
            "PATCH",
            f"/api/v1/projects/{empty_project['id']}",
            {"expected_version": 1, "action": "close"},
        ),
        (
            "POST",
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {**plan(operation_type), "request_key": str(uuid4())},
        ),
        (
            "PATCH",
            f"/api/v1/activities/{activity['id']}",
            {**plan(operation_type), "expected_version": 1},
        ),
        (
            "PUT",
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 1, "agent_ids": [agent_id]},
        ),
    ]
    return paths, mutations


def business_snapshot(auth):
    with Session(auth.engine) as db:
        return {
            "partners": db.scalar(text("SELECT count(*) FROM pta_partner")),
            "types": db.scalar(text("SELECT count(*) FROM pta_operation_type")),
            "projects": list(
                db.execute(text("SELECT id,state,version FROM pta_project ORDER BY id"))
            ),
            "ptas": db.scalar(text("SELECT count(*) FROM pta_annual")),
            "activities": list(
                db.execute(text("SELECT id,name,version FROM pta_activity ORDER BY id"))
            ),
            "operations": db.scalar(text("SELECT count(*) FROM pta_operation")),
            "assignments": db.scalar(
                text("SELECT count(*) FROM pta_activity_agent_assignment")
            ),
            "audits": db.scalar(
                text("SELECT count(*) FROM auth_audit WHERE business IS NOT NULL")
            ),
        }


@pytest.mark.parametrize(
    "context_state", ["unauthenticated", "anonymous", "pending", "expired", "revoked"]
)
def test_p02_every_responsibility_rejects_invalid_context(planning, context_state):
    paths, mutations = responsibility_cases(planning)
    auth = planning["auth"]
    owned_client = context_state in {"unauthenticated", "anonymous"}
    client = (
        TestClient(planning["admin"].app, base_url="http://localhost")
        if owned_client
        else planning["agent"]
    )
    try:
        if context_state == "unauthenticated":
            csrf = "invalid"
        elif context_state == "anonymous":
            csrf = client.get("/api/v1/auth/session").json()["csrf"]
        else:
            session = client.get("/api/v1/auth/session").json()
            csrf = session["csrf"]
            user_id = session["user"]["id"]
            with auth.engine.begin() as db:
                if context_state == "expired":
                    db.execute(
                        text(
                            "UPDATE auth_context SET expires_at="
                            "clock_timestamp()-interval '1 second' "
                            "WHERE user_id=:user"
                        ),
                        {"user": user_id},
                    )
                else:
                    db.execute(
                        text(
                            "UPDATE auth_context SET state=:state WHERE user_id=:user"
                        ),
                        {"state": context_state, "user": user_id},
                    )
        cookies = dict(client.cookies)
        before = business_snapshot(auth)
        for path in paths:
            client.cookies.update(cookies)
            assert client.get(path).status_code == 401, (context_state, path)
        request_headers = {
            "Origin": "http://localhost",
            "X-CSRF-Token": csrf,
        }
        for method, path, body in mutations:
            client.cookies.update(cookies)
            assert client.request(
                method, path, headers=request_headers, json=body
            ).status_code in {401, 403}, (context_state, method, path)
        assert business_snapshot(auth) == before
    finally:
        if owned_client:
            client.close()


def test_p02_verified_admin_cannot_read_or_mutate_business(planning):
    paths, mutations = responsibility_cases(planning)
    admin = planning["admin"]
    before = business_snapshot(planning["auth"])
    for path in paths:
        assert admin.get(path).status_code == 403, path
    admin_headers = headers(admin)
    for method, path, body in mutations:
        assert (
            admin.request(method, path, headers=admin_headers, json=body).status_code
            == 403
        ), (method, path)
    assert business_snapshot(planning["auth"]) == before


def test_p02_all_reads_reject_invalid_context_states(planning):
    paths, _ = responsibility_cases(planning)
    user_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    for state in ("pending", "revoked"):
        with planning["auth"].engine.begin() as db:
            db.execute(
                text("UPDATE auth_context SET state=:state WHERE user_id=:user"),
                {"state": state, "user": user_id},
            )
        assert planning["agent"].get(paths[0]).status_code == 401
        with planning["auth"].engine.begin() as db:
            db.execute(
                text("UPDATE auth_context SET state='verified' WHERE user_id=:user"),
                {"user": user_id},
            )
    with planning["auth"].engine.begin() as db:
        db.execute(
            text(
                "UPDATE auth_context SET expires_at=expires_at-interval '2 days' "
                "WHERE user_id=:user"
            ),
            {"user": user_id},
        )
    assert planning["agent"].get(paths[0]).status_code == 401


def test_p02_every_mutation_rejects_missing_or_invalid_request_evidence(planning):
    _, operation_type, project, activity, _ = create_activity(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    cases = [
        (planning["validator"], "POST", "/api/v1/partners", {"name": "X"}),
        (planning["validator"], "POST", "/api/v1/operation-types", {"label": "X"}),
        (
            planning["validator"],
            "POST",
            "/api/v1/projects",
            {"partner_id": str(uuid4()), "name": "X"},
        ),
        (
            planning["validator"],
            "PATCH",
            f"/api/v1/projects/{project['id']}",
            {"expected_version": 1, "action": "close"},
        ),
        (
            planning["agent"],
            "POST",
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {**plan(operation_type), "request_key": str(uuid4())},
        ),
        (
            planning["agent"],
            "PATCH",
            f"/api/v1/activities/{activity['id']}",
            {**plan(operation_type), "expected_version": 1},
        ),
        (
            planning["validator"],
            "PUT",
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": 1, "agent_ids": [agent_id]},
        ),
    ]
    with Session(planning["auth"].engine) as db:
        before = db.query(Audit).filter(Audit.business.is_not(None)).count()
    for client, method, path, body in cases:
        assert client.request(method, path, json=body).status_code == 403
        csrf = client.get("/api/v1/auth/session").json()["csrf"]
        assert (
            client.request(
                method,
                path,
                json=body,
                headers={"Origin": "http://invalid.test", "X-CSRF-Token": csrf},
            ).status_code
            == 403
        )
        assert (
            client.request(
                method,
                path,
                json=body,
                headers={"Origin": "http://localhost", "X-CSRF-Token": "invalid"},
            ).status_code
            == 403
        )
    with Session(planning["auth"].engine) as db:
        assert db.query(Audit).filter(Audit.business.is_not(None)).count() == before


def test_p03_parent_bound_cursors_and_forged_paths_do_not_cross_trees(planning):
    _, operation_type, first = references(planning)
    second_partner = post(
        planning["validator"], "/api/v1/partners", {"name": "Arbre deux"}
    ).json()
    second = post(
        planning["validator"],
        "/api/v1/projects",
        {"partner_id": second_partner["id"], "name": "Projet deux"},
    ).json()
    for year in (2027, 2028):
        assert (
            post(
                planning["agent"],
                f"/api/v1/projects/{first['id']}/ptas/{year}/activities",
                {
                    **plan(
                        operation_type,
                        name=f"Activité {year}",
                        planned_start=f"{year}-01-01",
                        planned_end=f"{year}-04-01",
                    ),
                    "request_key": str(uuid4()),
                },
            ).status_code
            == 201
        )
    assert (
        post(
            planning["agent"],
            f"/api/v1/projects/{second['id']}/ptas/2027/activities",
            {**plan(operation_type), "request_key": str(uuid4())},
        ).status_code
        == 201
    )
    page = planning["agent"].get(f"/api/v1/projects/{first['id']}/ptas?limit=1").json()
    assert page["count"] == 2 and page["next"]
    token = page["next"].split("cursor=", 1)[1]
    assert (
        planning["agent"]
        .get(f"/api/v1/projects/{second['id']}/ptas?limit=1&cursor={token}")
        .status_code
        == 422
    )
    assert planning["agent"].get(f"/api/v1/projects/{uuid4()}").status_code == 404
    assert (
        planning["agent"].get(f"/api/v1/ptas/{uuid4()}/activities").status_code == 404
    )


def test_p18_assigned_account_recovery_uses_schema_guard_not_eligibility(planning):
    _, _, _, activity, _ = create_activity(planning)
    session = planning["agent"].get("/api/v1/auth/session").json()
    agent_id = session["user"]["id"]
    email = session["user"]["email"]
    assigned = put(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": 1, "agent_ids": [agent_id]},
    )
    assert assigned.status_code == 200
    prepared = planning["auth"].prepare_recovery(email)
    assert prepared
    _, selector, generation, verifier = prepared
    planning["auth"].deliver_recovery(email, selector, generation, verifier)
    recovered_id, recovered_email = planning["auth"].complete_recovery(
        selector, verifier, "Recovered!94", "Recovered!94"
    )
    assert (recovered_id, recovered_email) == (agent_id, email)
    with pytest.raises(AuthError) as replay:
        planning["auth"].complete_recovery(
            selector, verifier, "Recovered!95", "Recovered!95"
        )
    assert getattr(replay.value, "code", None) == "recovery_consumed"
    assert planning["agent"].get("/api/v1/projects").status_code == 401


def test_p19_role_change_and_planning_are_serial_in_both_orders(planning):
    _, operation_type, _, activity, _ = create_activity(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    agent2_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]
    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    versions = {row["id"]: row["version"] for row in users}
    planned, changed = ordered_advisory_race(
        planning["auth"],
        lambda: patch(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}",
            {**plan(operation_type, name="Avant rôle"), "expected_version": 1},
        ),
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{agent_id}",
            headers=headers(planning["admin"]),
            json={
                "role": "AGENT_VERIFICATEUR",
                "expected_version": versions[agent_id],
            },
        ),
    )
    assert (planned.status_code, changed.status_code) == (200, 200)
    assert planning["agent"].get("/api/v1/projects").status_code == 401
    changed_first, planning_denied = ordered_advisory_race(
        planning["auth"],
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{agent2_id}",
            headers=headers(planning["admin"]),
            json={
                "role": "AGENT_VERIFICATEUR",
                "expected_version": versions[agent2_id],
            },
        ),
        lambda: patch(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}",
            {**plan(operation_type, name="Après rôle"), "expected_version": 2},
        ),
    )
    assert changed_first.status_code == 200
    assert planning_denied.status_code == 401


def test_p19_password_reset_and_planning_are_serial_in_both_orders(planning):
    _, operation_type, _, activity, _ = create_activity(planning)
    sessions = {
        name: planning[name].get("/api/v1/auth/session").json()["user"]
        for name in ("agent", "agent2")
    }
    proofs = {}
    for name, user in sessions.items():
        prepared = planning["auth"].prepare_recovery(user["email"])
        assert prepared
        email, selector, generation, verifier = prepared
        planning["auth"].deliver_recovery(email, selector, generation, verifier)
        proofs[name] = (selector, verifier)

    planned, reset = ordered_advisory_race(
        planning["auth"],
        lambda: patch(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}",
            {**plan(operation_type, name="Avant reset"), "expected_version": 1},
        ),
        lambda: planning["auth"].complete_recovery(
            *proofs["agent"], "Recovered!96", "Recovered!96"
        ),
    )
    assert planned.status_code == 200
    assert reset == (sessions["agent"]["id"], sessions["agent"]["email"])
    assert planning["agent"].get("/api/v1/projects").status_code == 401

    reset_first, planning_denied = ordered_advisory_race(
        planning["auth"],
        lambda: planning["auth"].complete_recovery(
            *proofs["agent2"], "Recovered!97", "Recovered!97"
        ),
        lambda: patch(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}",
            {**plan(operation_type, name="Après reset"), "expected_version": 2},
        ),
    )
    assert reset_first == (sessions["agent2"]["id"], sessions["agent2"]["email"])
    assert planning_denied.status_code == 401
