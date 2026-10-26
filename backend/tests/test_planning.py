from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from threading import Barrier, Event, Lock
from time import monotonic
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session, SessionTransaction
from test_access import PASSWORD, activate, headers
from test_access import admin as admin_fixture
from test_auth import messages

from app.auth.models import Audit, User
from app.auth.service import AuthError
from app.planning.models import (
    Activity,
    ActivityAssignment,
    ActivityContributor,
    ActivityRevision,
    ActivityRevisionDecision,
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


def login_existing(client, mailbox, email):
    h = headers(client)
    previous_codes = {
        message["value"]
        for message in messages(mailbox)
        if message["recipient"] == email and message["kind"] == "otp"
    }
    response = client.post(
        "/api/v1/auth/login",
        headers=h,
        json={"email": email, "password": PASSWORD},
    )
    assert response.status_code == 202, response.text
    new_codes = [
        message["value"]
        for message in messages(mailbox)
        if message["recipient"] == email
        and message["kind"] == "otp"
        and message["value"] not in previous_codes
    ]
    assert len(new_codes) == 1
    code = new_codes[0]
    verified = client.post("/api/v1/auth/otp/verify", headers=h, json={"code": code})
    assert verified.status_code == 200, verified.text


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


def test_v04_v05_role_wide_submission_and_exact_revision_approval(planning, auth_env):
    """One eligible reviewer at each stage completes the immutable first revision."""
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    )
    assert created.status_code == 201, created.text
    activity = created.json()

    submitted = post(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    )
    assert submitted.status_code == 201, submitted.text
    revision = submitted.json()
    assert revision["revision_number"] == 1
    assert revision["snapshot"]["allocation"] == "300000"
    assert revision["fingerprint"] == revision["snapshot"]["content_fingerprint"]
    assert revision["snapshot"]["partner"]["name"] == "Partenaire test"
    assert revision["snapshot"]["project"]["name"] == "Projet test"
    assert [row["type_label"] for row in revision["snapshot"]["operations"]] == [
        "Formation",
        "Formation",
    ]
    assert revision["snapshot"]["submitter"]["email"] == "agent2@example.test"
    assert {row["email"] for row in revision["snapshot"]["contributors"]} == {
        "agent@example.test",
        "agent2@example.test",
    }

    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    )
    assert prevalidated.status_code == 201, prevalidated.text
    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    supervisor = next(row for row in users if row["email"] == "supervisor@example.test")
    changed = planning["admin"].patch(
        f"/api/v1/access/users/{supervisor['id']}",
        headers=headers(planning["admin"]),
        json={
            "expected_version": supervisor["version"],
            "role": "VALIDATEUR_DEFINITIF",
        },
    )
    assert changed.status_code == 200, changed.text
    with TestClient(planning["admin"].app, base_url="http://localhost") as changed_role:
        refreshed_auth = changed_role.app.state.auth
        refreshed_auth.policy = refreshed_auth.policy.model_copy(
            update={
                "lifecycle_database": refreshed_auth.engine.url.database,
                "resend_seconds": 0,
            }
        )
        planning["auth"] = refreshed_auth
        login_existing(changed_role, auth_env.mailbox, "supervisor@example.test")
        self_approval = post(
            changed_role,
            f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": prevalidated.json()["activity_version"],
                "decision": "approve",
            },
        )
        assert self_approval.status_code == 409

    approved = post(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text

    detail = planning["agent"].get(f"/api/v1/activities/{activity['id']}")
    assert detail.status_code == 200
    assert detail.json()["state"] == "approved"
    assert detail.json()["approved_allocation"] == "300000"
    history = (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}")
        .json()
    )
    assert history["snapshot"] == revision["snapshot"]
    with Session(planning["auth"].engine) as db:
        workflow = list(
            db.scalars(
                select(Audit)
                .where(
                    Audit.target == activity["id"],
                    Audit.action.in_(
                        ["activity.submit", "activity.prevalidate", "activity.approve"]
                    ),
                )
                .order_by(Audit.occurred_at)
            )
        )
        assert len(workflow) == 3
        for row in workflow:
            assert row.business["revision"]["actor_role"]
            assert row.business["revision"]["submitted_at"]
        assert workflow[0].business["revision"]["actor_id"] == workflow[0].actor
        for row in workflow[1:]:
            assert row.business["decision"]["actor_id"] == row.actor
            assert row.business["decision"]["actor_role"]
            assert row.business["decision"]["decided_at"]
        assert (
            workflow[-1].business["decision"]["prevalidation_revision_id"]
            == revision["id"]
        )


def test_v06_v07_returns_require_changed_resubmission_and_fresh_prevalidation(
    planning,
):
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    first = post(
        planning["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    returned = post(
        planning["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{first['id']}/decisions",
        {
            "expected_version": first["activity_version"],
            "decision": "return",
            "reason": "Préciser le résultat attendu.",
        },
    )
    assert returned.status_code == 201, returned.text
    unchanged = post(
        planning["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": returned.json()["activity_version"]},
    )
    assert unchanged.status_code == 409

    detail = planning["agent"].get(f"/api/v1/activities/{created['id']}").json()
    corrected_body = plan(
        operation_type,
        description="Planification corrigée et complète",
        operations=[
            {
                key: value
                for key, value in {
                    **detail["operations"][0],
                    "allocation": "120000",
                }.items()
                if key != "position"
            },
            {
                key: value
                for key, value in {
                    **detail["operations"][1],
                    "allocation": "180000",
                }.items()
                if key != "position"
            },
        ],
        expected_version=detail["version"],
    )
    corrected = patch(
        planning["agent"], f"/api/v1/activities/{created['id']}", corrected_body
    )
    assert corrected.status_code == 200, corrected.text
    second = post(
        planning["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": corrected.json()["version"]},
    )
    assert second.status_code == 201, second.text
    assert second.json()["revision_number"] == 2
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{second.json()['id']}/decisions",
        {
            "expected_version": second.json()["activity_version"],
            "decision": "prevalidate",
        },
    )
    assert prevalidated.status_code == 201, prevalidated.text
    validator_return = post(
        planning["validator"],
        f"/api/v1/activities/{created['id']}/revisions/{second.json()['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "return",
            "reason": "Réviser le budget proposé.",
            "requested_amount": "350000",
        },
    )
    assert validator_return.status_code == 201, validator_return.text

    detail = planning["agent"].get(f"/api/v1/activities/{created['id']}").json()
    revised = patch(
        planning["agent"],
        f"/api/v1/activities/{created['id']}",
        plan(
            operation_type,
            description="Nouvelle correction budgétaire",
            allocation="350000",
            operations=[
                {
                    key: value
                    for key, value in {
                        **detail["operations"][0],
                        "allocation": "150000",
                    }.items()
                    if key != "position"
                },
                {
                    key: value
                    for key, value in {
                        **detail["operations"][1],
                        "allocation": "200000",
                    }.items()
                    if key != "position"
                },
            ],
            expected_version=detail["version"],
        ),
    )
    assert revised.status_code == 200, revised.text
    third = post(
        planning["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": revised.json()["version"]},
    )
    assert third.status_code == 201, third.text
    skipped = post(
        planning["validator"],
        f"/api/v1/activities/{created['id']}/revisions/{third.json()['id']}/decisions",
        {"expected_version": third.json()["activity_version"], "decision": "approve"},
    )
    assert skipped.status_code == 409
    with Session(planning["auth"].engine) as db:
        validator_id = db.scalar(
            select(User.id).where(User.email == "validator@example.test")
        )
        before_decisions = db.query(ActivityRevisionDecision).count()
    with pytest.raises(DBAPIError):
        with Session(planning["auth"].engine) as db, db.begin():
            db.execute(
                text(
                    "INSERT INTO pta_activity_revision_decision"
                    "(id,context_id,activity_id,revision_id,stage,outcome,actor_id,"
                    "actor_role,decided_at,reason) VALUES "
                    "(:id,'MJL',:activity,:revision,'validator','returned',:actor,"
                    "'VALIDATEUR_DEFINITIF',now(),'obsolete')"
                ),
                {
                    "id": str(uuid4()),
                    "activity": created["id"],
                    "revision": first["id"],
                    "actor": validator_id,
                },
            )
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityRevisionDecision).count() == before_decisions


def test_v03_v08_contributors_and_review_evidence_remain_immutable(planning, auth_env):
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    submitted = post(
        planning["agent2"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    contributor = next(row for row in users if row["email"] == "agent2@example.test")
    changed = planning["admin"].patch(
        f"/api/v1/access/users/{contributor['id']}",
        headers=headers(planning["admin"]),
        json={
            "expected_version": contributor["version"],
            "role": "AGENT_VERIFICATEUR",
        },
    )
    assert changed.status_code == 200, changed.text
    with TestClient(planning["admin"].app, base_url="http://localhost") as changed_role:
        refreshed_auth = changed_role.app.state.auth
        refreshed_auth.policy = refreshed_auth.policy.model_copy(
            update={
                "lifecycle_database": refreshed_auth.engine.url.database,
                "resend_seconds": 0,
            }
        )
        planning["auth"] = refreshed_auth
        login_existing(changed_role, auth_env.mailbox, "agent2@example.test")
        rejected = post(
            changed_role,
            f"/api/v1/activities/{created['id']}/revisions/{submitted['id']}/decisions",
            {
                "expected_version": submitted["activity_version"],
                "decision": "prevalidate",
            },
        )
        assert rejected.status_code == 409

    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{submitted['id']}/decisions",
        {"expected_version": submitted["activity_version"], "decision": "prevalidate"},
    )
    assert prevalidated.status_code == 201, prevalidated.text
    with Session(planning["auth"].engine) as db:
        revision = db.get(ActivityRevision, submitted["id"])
        decision = db.scalar(
            select(ActivityRevisionDecision).where(
                ActivityRevisionDecision.revision_id == submitted["id"]
            )
        )
        membership = db.scalar(
            select(ActivityContributor).where(
                ActivityContributor.activity_id == created["id"]
            )
        )
        assert revision and decision and membership
        immutable_attempts = (
            (
                text("UPDATE pta_activity_revision SET fingerprint='x' WHERE id=:id"),
                revision.id,
            ),
            (
                text("DELETE FROM pta_activity_revision_decision WHERE id=:id"),
                decision.id,
            ),
            (
                text("DELETE FROM pta_activity_contributor WHERE id=:id"),
                membership.id,
            ),
        )
    for statement, target in immutable_attempts:
        with pytest.raises(DBAPIError):
            with Session(planning["auth"].engine) as db, db.begin():
                db.execute(statement, {"id": target})


def test_v03_reverted_removed_and_noop_editors_drive_runtime_review_eligibility(
    planning, auth_env
):
    """Persisted structural contributors, rather than the latest role, bar review."""
    with ExitStack() as stack:
        noop_agent = invite(
            planning["admin"],
            auth_env,
            stack,
            "noop-reviewer@example.test",
            "AGENT_SAISIE",
        )
        refreshed_auth = planning["admin"].app.state.auth
        refreshed_auth.policy = refreshed_auth.policy.model_copy(
            update={"lifecycle_database": refreshed_auth.engine.url.database}
        )
        planning["auth"] = refreshed_auth
        _partner, operation_type, project = references(planning)
        activity = post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {**plan(operation_type), "request_key": str(uuid4())},
        ).json()
        changed = patch(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}",
            replace_body(activity, name="Nom temporaire"),
        ).json()
        reverted = patch(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}",
            replace_body(changed, name=activity["name"]),
        ).json()
        noop = patch(
            noop_agent,
            f"/api/v1/activities/{activity['id']}",
            replace_body(reverted),
        )
        assert noop.status_code == 200, noop.text
        retained = noop.json()["operations"][0]
        removed = patch(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}",
            replace_body(
                noop.json(),
                allocation=retained["allocation"],
                operations=[
                    {
                        "id": retained["id"],
                        "type_id": retained["type_id"],
                        "name": retained["name"],
                        "allocation": retained["allocation"],
                    }
                ],
            ),
        ).json()
        revision = post(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/submissions",
            {"expected_version": removed["version"]},
        ).json()

        users = planning["admin"].get("/api/v1/access/users").json()["items"]
        emails = (
            "agent@example.test",
            "agent2@example.test",
            "noop-reviewer@example.test",
        )
        for email in emails:
            target = next(row for row in users if row["email"] == email)
            changed_role = planning["admin"].patch(
                f"/api/v1/access/users/{target['id']}",
                headers=headers(planning["admin"]),
                json={
                    "expected_version": target["version"],
                    "role": "AGENT_VERIFICATEUR",
                },
            )
            assert changed_role.status_code == 200, changed_role.text

        reviewer_clients = {}
        for email in emails:
            reviewer = stack.enter_context(
                TestClient(planning["admin"].app, base_url="http://localhost")
            )
            reviewer.app.state.auth.policy = reviewer.app.state.auth.policy.model_copy(
                update={
                    "lifecycle_database": reviewer.app.state.auth.engine.url.database,
                    "resend_seconds": 0,
                }
            )
            login_existing(reviewer, auth_env.mailbox, email)
            reviewer_clients[email] = reviewer

        for email in emails[:2]:
            rejected = post(
                reviewer_clients[email],
                f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
                {
                    "expected_version": revision["activity_version"],
                    "decision": "prevalidate",
                },
            )
            assert rejected.status_code == 409
        eligible = post(
            reviewer_clients[emails[2]],
            f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        )
        assert eligible.status_code == 201, eligible.text


def test_v09_frozen_revision_survives_assignment_and_reference_changes(planning):
    partner, operation_type, project = references(planning)
    agent2_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    assigned = put(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": activity["version"], "agent_ids": [agent2_id]},
    ).json()
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": assigned["version"]},
    ).json()
    frozen = revision["snapshot"]
    cleared = put(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": revision["activity_version"], "agent_ids": []},
    )
    assert cleared.status_code == 200, cleared.text
    with planning["auth"].engine.begin() as db:
        db.execute(
            text("UPDATE pta_partner SET name='Partenaire renommé' WHERE id=:id"),
            {"id": partner["id"]},
        )
        db.execute(
            text("UPDATE pta_project SET name='Projet renommé' WHERE id=:id"),
            {"id": project["id"]},
        )
        db.execute(
            text("UPDATE pta_operation_type SET label='Type renommé' WHERE id=:id"),
            {"id": operation_type["id"]},
        )
    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    submitter = next(row for row in users if row["email"] == "agent@example.test")
    assigned_agent = next(row for row in users if row["email"] == "agent2@example.test")
    assert (
        planning["admin"]
        .patch(
            f"/api/v1/access/users/{submitter['id']}",
            headers=headers(planning["admin"]),
            json={"expected_version": submitter["version"], "deactivate": True},
        )
        .status_code
        == 200
    )
    assert (
        planning["admin"]
        .patch(
            f"/api/v1/access/users/{assigned_agent['id']}",
            headers=headers(planning["admin"]),
            json={
                "expected_version": assigned_agent["version"],
                "role": "AGENT_VERIFICATEUR",
            },
        )
        .status_code
        == 200
    )
    history = planning["supervisor"].get(
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}"
    )
    assert history.status_code == 200, history.text
    assert history.json()["snapshot"] == frozen


def test_v08_database_constraints_reject_invalid_decision_chains(planning):
    _partner, operation_type, project = references(planning)
    with Session(planning["auth"].engine) as db:
        validator_id = db.scalar(
            select(User.id).where(User.email == "validator@example.test")
        )
        assert validator_id
    second_activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type, name="Seconde activité"), "request_key": str(uuid4())},
    ).json()
    second_revision = post(
        planning["agent"],
        f"/api/v1/activities/{second_activity['id']}/submissions",
        {"expected_version": second_activity["version"]},
    ).json()
    with pytest.raises(DBAPIError):
        with Session(planning["auth"].engine) as db, db.begin():
            db.execute(
                text(
                    "INSERT INTO pta_activity_revision_decision"
                    "(id,context_id,activity_id,revision_id,stage,outcome,actor_id,"
                    "actor_role,decided_at,prevalidation_revision_id) VALUES "
                    "(:id,'MJL',:activity,:revision,'validator','approved',:actor,"
                    "'VALIDATEUR_DEFINITIF',now(),:revision)"
                ),
                {
                    "id": str(uuid4()),
                    "activity": second_activity["id"],
                    "revision": second_revision["id"],
                    "actor": validator_id,
                },
            )
    with pytest.raises(DBAPIError):
        with Session(planning["auth"].engine) as db, db.begin():
            db.execute(
                text(
                    "UPDATE pta_activity SET state='approved',"
                    "approved_revision_id=current_revision_id WHERE id=:activity"
                ),
                {"activity": second_activity["id"]},
            )
    with pytest.raises(DBAPIError):
        with Session(planning["auth"].engine) as db, db.begin():
            db.execute(
                text(
                    "INSERT INTO pta_activity_revision_decision"
                    "(id,context_id,activity_id,revision_id,stage,outcome,actor_id,"
                    "actor_role,decided_at) VALUES "
                    "(:id,'MJL',:activity,:revision,'supervisor','approved',:actor,"
                    "'AGENT_VERIFICATEUR',now())"
                ),
                {
                    "id": str(uuid4()),
                    "activity": second_activity["id"],
                    "revision": second_revision["id"],
                    "actor": validator_id,
                },
            )


def test_v10_v11_concurrent_supervisor_decisions_have_one_winner(planning, auth_env):
    with ExitStack() as stack:
        second = invite(
            planning["admin"],
            auth_env,
            stack,
            "supervisor2@example.test",
            "AGENT_VERIFICATEUR",
        )
        second_validator = invite(
            planning["admin"],
            auth_env,
            stack,
            "validator2@example.test",
            "VALIDATEUR_DEFINITIF",
        )
        refreshed_auth = planning["admin"].app.state.auth
        refreshed_auth.policy = refreshed_auth.policy.model_copy(
            update={"lifecycle_database": refreshed_auth.engine.url.database}
        )
        planning["auth"] = refreshed_auth
        _partner, operation_type, project = references(planning)
        created = post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {**plan(operation_type), "request_key": str(uuid4())},
        ).json()
        submitted = post(
            planning["agent"],
            f"/api/v1/activities/{created['id']}/submissions",
            {"expected_version": created["version"]},
        ).json()
        path = (
            f"/api/v1/activities/{created['id']}/revisions/{submitted['id']}/decisions"
        )
        first, losing = ordered_advisory_race(
            planning["auth"],
            lambda: post(
                planning["supervisor"],
                path,
                {
                    "expected_version": submitted["activity_version"],
                    "decision": "prevalidate",
                },
            ),
            lambda: post(
                second,
                path,
                {
                    "expected_version": submitted["activity_version"],
                    "decision": "return",
                    "reason": "Décision concurrente.",
                },
            ),
        )
        assert sorted((first.status_code, losing.status_code)) == [201, 409]
        with Session(planning["auth"].engine) as db:
            assert (
                db.scalar(
                    select(func.count())
                    .select_from(ActivityRevisionDecision)
                    .where(ActivityRevisionDecision.revision_id == submitted["id"])
                )
                == 1
            )

        validator_activity = post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {
                **plan(operation_type, name="Décision finale concurrente"),
                "request_key": str(uuid4()),
            },
        ).json()
        validator_revision = post(
            planning["agent"],
            f"/api/v1/activities/{validator_activity['id']}/submissions",
            {"expected_version": validator_activity["version"]},
        ).json()
        prevalidated = post(
            planning["supervisor"],
            f"/api/v1/activities/{validator_activity['id']}/revisions/"
            f"{validator_revision['id']}/decisions",
            {
                "expected_version": validator_revision["activity_version"],
                "decision": "prevalidate",
            },
        ).json()
        validator_path = (
            f"/api/v1/activities/{validator_activity['id']}/revisions/"
            f"{validator_revision['id']}/decisions"
        )
        winner, loser = ordered_advisory_race(
            planning["auth"],
            lambda: post(
                planning["validator"],
                validator_path,
                {
                    "expected_version": prevalidated["activity_version"],
                    "decision": "approve",
                },
            ),
            lambda: post(
                second_validator,
                validator_path,
                {
                    "expected_version": prevalidated["activity_version"],
                    "decision": "return",
                    "reason": "Décision finale concurrente.",
                },
            ),
        )
        assert sorted((winner.status_code, loser.status_code)) == [201, 409]
        with Session(planning["auth"].engine) as db:
            assert (
                db.scalar(
                    select(func.count())
                    .select_from(ActivityRevisionDecision)
                    .where(
                        ActivityRevisionDecision.revision_id
                        == validator_revision["id"],
                        ActivityRevisionDecision.stage == "validator",
                    )
                )
                == 1
            )


def test_v08_v20_runtime_role_cannot_mutate_evidence_or_administer_schema(planning):
    _partner, operation_type, project = references(planning)
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    ).json()
    role = "mjl_runtime_" + uuid4().hex
    engine = planning["auth"].engine
    try:
        with engine.begin() as db:
            db.execute(text(f'CREATE ROLE "{role}" NOLOGIN'))
            db.execute(text(f'GRANT USAGE ON SCHEMA public TO "{role}"'))
            db.execute(
                text(
                    f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES "
                    f'IN SCHEMA public TO "{role}"'
                )
            )
            db.execute(
                text(
                    f'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "{role}"'
                )
            )
        statements = (
            (
                "UPDATE pta_activity_revision SET fingerprint='x' WHERE id=:id",
                {"id": revision["id"]},
            ),
            ("TRUNCATE pta_activity_revision", {}),
            ("ALTER TABLE pta_activity_revision ADD COLUMN forbidden integer", {}),
        )
        for statement, parameters in statements:
            with pytest.raises(DBAPIError):
                with engine.begin() as db:
                    db.execute(text(f'SET ROLE "{role}"'))
                    db.execute(text(statement), parameters)
    finally:
        with engine.begin() as db:
            db.execute(text(f'DROP OWNED BY "{role}"'))
            db.execute(text(f'DROP ROLE IF EXISTS "{role}"'))


def test_v04_snapshot_overflow_rolls_back_without_truncating_lineage(
    planning, monkeypatch
):
    from app.planning import routes as planning_routes

    _partner, operation_type, project = references(planning)
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    actual_builder = planning_routes.build_revision_snapshot

    def oversized_snapshot(db, item, actor, submitted_at):
        return {
            **actual_builder(db, item, actor, submitted_at),
            "overflow": "x" * 1_048_576,
        }

    monkeypatch.setattr(planning_routes, "build_revision_snapshot", oversized_snapshot)
    response = post(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    )
    assert response.status_code == 422
    with Session(planning["auth"].engine) as db:
        row = db.get(Activity, activity["id"])
        assert row and row.state == "draft" and row.version == activity["version"]
        assert not db.scalar(
            select(ActivityRevision.id).where(
                ActivityRevision.activity_id == activity["id"]
            )
        )
        assert (
            db.scalar(
                select(func.count())
                .select_from(ActivityContributor)
                .where(ActivityContributor.activity_id == activity["id"])
            )
            == 1
        )


def test_v12_edit_and_submission_races_serialize_in_both_orders(planning):
    _partner, operation_type, project = references(planning)

    def draft(name):
        return post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {
                **plan(operation_type, name=name),
                "request_key": str(uuid4()),
            },
        ).json()

    edit_first = draft("Modification d'abord")
    edited, stale_submit = ordered_advisory_race(
        planning["auth"],
        lambda: patch(
            planning["agent"],
            f"/api/v1/activities/{edit_first['id']}",
            replace_body(edit_first, description="Version modifiée avant soumission"),
        ),
        lambda: post(
            planning["agent2"],
            f"/api/v1/activities/{edit_first['id']}/submissions",
            {"expected_version": edit_first["version"]},
        ),
    )
    assert (edited.status_code, stale_submit.status_code) == (200, 409)
    assert (
        planning["agent"].get(f"/api/v1/activities/{edit_first['id']}").json()["state"]
        == "draft"
    )

    submit_first = draft("Soumission d'abord")
    submitted, stale_edit = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent2"],
            f"/api/v1/activities/{submit_first['id']}/submissions",
            {"expected_version": submit_first["version"]},
        ),
        lambda: patch(
            planning["agent"],
            f"/api/v1/activities/{submit_first['id']}",
            replace_body(submit_first, description="Modification devenue obsolète"),
        ),
    )
    assert (submitted.status_code, stale_edit.status_code) == (201, 409)
    detail = planning["agent"].get(f"/api/v1/activities/{submit_first['id']}").json()
    frozen = (
        planning["agent"]
        .get(
            f"/api/v1/activities/{submit_first['id']}/revisions/"
            f"{submitted.json()['id']}"
        )
        .json()
    )
    assert detail["state"] == "submitted"
    assert frozen["snapshot"]["description"] == submit_first["description"]


def test_v12_correction_and_final_approval_serialize_in_both_orders(planning):
    """Return/correction and approval serialize to one coherent outcome."""
    _partner, operation_type, project = references(planning)

    def prevalidated(name):
        activity = post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {**plan(operation_type, name=name), "request_key": str(uuid4())},
        ).json()
        revision = post(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/submissions",
            {"expected_version": activity["version"]},
        ).json()
        decision = post(
            planning["supervisor"],
            f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        ).json()
        return activity, revision, decision

    first, first_revision, first_prevalidation = prevalidated("Correction première")
    returned, approval = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["validator"],
            f"/api/v1/activities/{first['id']}/revisions/{first_revision['id']}/decisions",
            {
                "expected_version": first_prevalidation["activity_version"],
                "decision": "return",
                "reason": "Corriger avant approbation",
            },
        ),
        lambda: post(
            planning["validator"],
            f"/api/v1/activities/{first['id']}/revisions/{first_revision['id']}/decisions",
            {
                "expected_version": first_prevalidation["activity_version"],
                "decision": "approve",
            },
        ),
    )
    assert (returned.status_code, approval.status_code) == (201, 409)
    returned_activity = (
        planning["agent"].get(f"/api/v1/activities/{first['id']}").json()
    )
    correction = patch(
        planning["agent"],
        f"/api/v1/activities/{first['id']}",
        replace_body(
            returned_activity,
            description="Correction gagnante",
            expected_version=returned.json()["activity_version"],
        ),
    )
    assert correction.status_code == 200, correction.text
    obsolete_approval = post(
        planning["validator"],
        f"/api/v1/activities/{first['id']}/revisions/{first_revision['id']}/decisions",
        {
            "expected_version": correction.json()["version"],
            "decision": "approve",
        },
    )
    assert obsolete_approval.status_code == 409
    with Session(planning["auth"].engine) as db:
        corrected = db.get(Activity, first["id"])
        assert corrected and corrected.state == "returned_validator"
        assert corrected.current_revision_id == first_revision["id"]
        outcomes = list(
            db.scalars(
                select(ActivityRevisionDecision.outcome).where(
                    ActivityRevisionDecision.revision_id == first_revision["id"]
                )
            )
        )
        assert outcomes == ["prevalidated", "returned"]

    second, second_revision, second_prevalidation = prevalidated("Validation première")
    approval, returned = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["validator"],
            f"/api/v1/activities/{second['id']}/revisions/{second_revision['id']}/decisions",
            {
                "expected_version": second_prevalidation["activity_version"],
                "decision": "approve",
            },
        ),
        lambda: post(
            planning["validator"],
            f"/api/v1/activities/{second['id']}/revisions/{second_revision['id']}/decisions",
            {
                "expected_version": second_prevalidation["activity_version"],
                "decision": "return",
                "reason": "Retour devenu obsolète",
            },
        ),
    )
    assert approval.status_code == 201
    assert returned.status_code == 409
    approved_activity = (
        planning["agent"].get(f"/api/v1/activities/{second['id']}").json()
    )
    correction = patch(
        planning["agent"],
        f"/api/v1/activities/{second['id']}",
        replace_body(
            approved_activity,
            description="Correction après approbation",
            expected_version=approved_activity["version"],
        ),
    )
    assert correction.status_code == 409
    with Session(planning["auth"].engine) as db:
        approved = db.get(Activity, second["id"])
        assert approved and approved.state == "approved"
        assert approved.approved_revision_id == second_revision["id"]
        assert (
            db.scalar(
                select(func.count())
                .select_from(ActivityRevisionDecision)
                .where(ActivityRevisionDecision.revision_id == second_revision["id"])
            )
            == 2
        )


def test_v14_submission_and_decision_audit_failures_roll_back(planning, monkeypatch):
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    auth = planning["auth"]
    real_audit = auth.business_audit
    failed_action = {"value": "activity.submit"}

    def fail_selected(db, action, *args, **kwargs):
        if action == failed_action["value"]:
            raise IntegrityError("synthetic workflow audit failure", {}, Exception())
        return real_audit(db, action, *args, **kwargs)

    monkeypatch.setattr(auth, "business_audit", fail_selected)
    failed = post(
        planning["agent2"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    )
    assert failed.status_code == 503
    with Session(auth.engine) as db:
        activity = db.get(Activity, created["id"])
        assert activity and activity.state == "draft" and activity.version == 1
        assert db.query(ActivityRevision).count() == 0
        assert (
            db.query(ActivityContributor)
            .filter(ActivityContributor.activity_id == created["id"])
            .count()
            == 1
        )

    failed_action["value"] = "none"
    submitted = post(
        planning["agent2"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": 1},
    ).json()
    failed_action["value"] = "activity.prevalidate"
    rejected = post(
        planning["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{submitted['id']}/decisions",
        {"expected_version": submitted["activity_version"], "decision": "prevalidate"},
    )
    assert rejected.status_code == 503
    with Session(auth.engine) as db:
        activity = db.get(Activity, created["id"])
        assert activity and activity.state == "submitted"
        assert db.query(ActivityRevisionDecision).count() == 0


@pytest.mark.parametrize(
    "workflow_action",
    [
        "correction",
        "submission",
        "prevalidate",
        "return_supervisor",
        "approve",
        "return_validator",
    ],
)
@pytest.mark.parametrize("failure", ["audit", "constraint", "commit"])
def test_v14_every_workflow_stage_rolls_back_all_failure_classes(
    planning, monkeypatch, workflow_action, failure
):
    _partner, operation_type, project = references(planning)
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    revision = None
    if workflow_action != "submission":
        revision = post(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/submissions",
            {"expected_version": activity["version"]},
        ).json()
    if workflow_action == "correction":
        returned = post(
            planning["supervisor"],
            f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "return",
                "reason": "Correction requise",
            },
        ).json()
        returned_activity = (
            planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
        )

        def request():
            return patch(
                planning["agent"],
                f"/api/v1/activities/{activity['id']}",
                replace_body(
                    returned_activity,
                    description="Correction atomique",
                    expected_version=returned["activity_version"],
                ),
            )
    elif workflow_action == "submission":

        def request():
            return post(
                planning["agent"],
                f"/api/v1/activities/{activity['id']}/submissions",
                {"expected_version": activity["version"]},
            )
    elif workflow_action in {"prevalidate", "return_supervisor"}:

        def request():
            return post(
                planning["supervisor"],
                f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
                {
                    "expected_version": revision["activity_version"],
                    "decision": "prevalidate"
                    if workflow_action == "prevalidate"
                    else "return",
                    **(
                        {"reason": "Retour atomique"}
                        if workflow_action == "return_supervisor"
                        else {}
                    ),
                },
            )
    else:
        prevalidated = post(
            planning["supervisor"],
            f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        ).json()

        def request():
            return post(
                planning["validator"],
                f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
                {
                    "expected_version": prevalidated["activity_version"],
                    "decision": "approve" if workflow_action == "approve" else "return",
                    **(
                        {"reason": "Retour définitif atomique"}
                        if workflow_action == "return_validator"
                        else {}
                    ),
                },
            )

    auth = planning["auth"]
    with auth.engine.connect() as db:
        before = db.execute(
            text(
                "SELECT state,version,name,current_revision_id,approved_revision_id,"
                "(SELECT count(*) FROM pta_activity_revision),"
                "(SELECT count(*) FROM pta_activity_revision_decision),"
                "(SELECT count(*) FROM auth_audit WHERE business IS NOT NULL) "
                "FROM pta_activity WHERE id=:id"
            ),
            {"id": activity["id"]},
        ).one()
    real_audit = auth.business_audit

    def fail(db, *args, **kwargs):
        if failure == "audit":
            raise IntegrityError("synthetic audit failure", {}, Exception())
        real_audit(db, *args, **kwargs)
        if failure == "constraint":
            db.execute(
                text(
                    "INSERT INTO mjl_ownership_context(id,created_at) "
                    "VALUES ('BAD',clock_timestamp())"
                )
            )
        else:
            db.info["fail_workflow_commit"] = True

    real_commit = SessionTransaction.commit

    def fail_commit(transaction, *args, **kwargs):
        if transaction.session.info.pop("fail_workflow_commit", False):
            raise IntegrityError("synthetic commit failure", {}, Exception())
        return real_commit(transaction, *args, **kwargs)

    monkeypatch.setattr(auth, "business_audit", fail)
    if failure == "commit":
        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    assert request().status_code == 503
    with auth.engine.connect() as db:
        after = db.execute(
            text(
                "SELECT state,version,name,current_revision_id,approved_revision_id,"
                "(SELECT count(*) FROM pta_activity_revision),"
                "(SELECT count(*) FROM pta_activity_revision_decision),"
                "(SELECT count(*) FROM auth_audit WHERE business IS NOT NULL) "
                "FROM pta_activity WHERE id=:id"
            ),
            {"id": activity["id"]},
        ).one()
    assert after == before


def test_v13_v15_reviewer_deactivation_preserves_decision_and_never_blocks(
    planning,
):
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{submitted['id']}/decisions",
        {"expected_version": submitted["activity_version"], "decision": "prevalidate"},
    ).json()
    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    supervisor = next(row for row in users if row["email"] == "supervisor@example.test")
    deactivated = planning["admin"].patch(
        f"/api/v1/access/users/{supervisor['id']}",
        headers=headers(planning["admin"]),
        json={"expected_version": supervisor["version"], "deactivate": True},
    )
    assert deactivated.status_code == 200, deactivated.text
    assert planning["supervisor"].get("/api/v1/auth/session").status_code == 401
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{created['id']}/revisions/{submitted['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text


def test_v06_v07_late_revert_and_unadvised_total_corrections(planning):
    _partner, operation_type, project = references(planning)
    late = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2026/activities",
        {
            **plan(
                operation_type,
                planned_start="2026-01-01",
                planned_end="2026-04-01",
            ),
            "request_key": str(uuid4()),
        },
    ).json()
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{late['id']}/submissions",
        {"expected_version": late["version"]},
    ).json()
    returned = post(
        planning["supervisor"],
        f"/api/v1/activities/{late['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": revision["activity_version"],
            "decision": "return",
            "reason": "Correction après la date planifiée",
        },
    ).json()
    detail = planning["agent"].get(f"/api/v1/activities/{late['id']}").json()
    changed = patch(
        planning["agent"],
        f"/api/v1/activities/{late['id']}",
        replace_body(
            detail,
            description="Modification tardive",
            expected_version=returned["activity_version"],
        ),
    ).json()
    reverted = patch(
        planning["agent"],
        f"/api/v1/activities/{late['id']}",
        replace_body(changed, description=late["description"]),
    ).json()
    assert (
        post(
            planning["agent"],
            f"/api/v1/activities/{late['id']}/submissions",
            {"expected_version": reverted["version"]},
        ).status_code
        == 409
    )
    current = patch(
        planning["agent"],
        f"/api/v1/activities/{late['id']}",
        replace_body(reverted, description="Correction tardive conservée"),
    ).json()
    second = post(
        planning["agent"],
        f"/api/v1/activities/{late['id']}/submissions",
        {"expected_version": current["version"]},
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{late['id']}/revisions/{second['id']}/decisions",
        {"expected_version": second["activity_version"], "decision": "prevalidate"},
    ).json()
    validator_return = post(
        planning["validator"],
        f"/api/v1/activities/{late['id']}/revisions/{second['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "return",
            "reason": "Conserver le total sans avis chiffré",
        },
    ).json()
    detail = planning["agent"].get(f"/api/v1/activities/{late['id']}").json()
    first, second_operation = detail["operations"]
    first_update = {
        key: value
        for key, value in {**first, "allocation": "150000"}.items()
        if key != "position"
    }
    second_update = {
        key: value
        for key, value in {**second_operation, "allocation": "200000"}.items()
        if key != "position"
    }
    locked = patch(
        planning["agent"],
        f"/api/v1/activities/{late['id']}",
        replace_body(
            detail,
            allocation="350000",
            operations=[first_update, second_update],
            expected_version=validator_return["activity_version"],
        ),
    )
    assert locked.status_code == 409


def test_v10_duplicate_submission_and_decision_add_no_evidence(planning):
    _partner, operation_type, project = references(planning)
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    first = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    )
    assert first.status_code == 201
    assert (
        post(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/submissions",
            {"expected_version": activity["version"]},
        ).status_code
        == 409
    )
    revision = first.json()
    decision = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    )
    assert decision.status_code == 201
    assert (
        post(
            planning["supervisor"],
            f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        ).status_code
        == 409
    )
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityRevision).count() == 1
        assert db.query(ActivityRevisionDecision).count() == 1
        workflow_audits = list(
            db.scalars(
                select(Audit.action).where(
                    Audit.target == activity["id"],
                    Audit.action.in_(["activity.submit", "activity.prevalidate"]),
                )
            )
        )
        assert workflow_audits.count("activity.submit") == 1
        assert workflow_audits.count("activity.prevalidate") == 1


def test_v15_submission_waits_when_last_supervisor_is_deactivated(planning):
    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    supervisor = next(row for row in users if row["email"] == "supervisor@example.test")
    assert (
        planning["admin"]
        .patch(
            f"/api/v1/access/users/{supervisor['id']}",
            headers=headers(planning["admin"]),
            json={"expected_version": supervisor["version"], "deactivate": True},
        )
        .status_code
        == 200
    )
    _partner, operation_type, project = references(planning)
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    )
    assert submitted.status_code == 201
    detail = planning["validator"].get(f"/api/v1/activities/{activity['id']}").json()
    assert detail["state"] == "submitted"
    assert "approve" not in detail["allowed_actions"]
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityRevisionDecision).count() == 0


def test_v13_review_and_reviewer_lifecycle_serialize_in_both_orders(planning, auth_env):
    with ExitStack() as stack:
        second = invite(
            planning["admin"],
            auth_env,
            stack,
            "race-supervisor@example.test",
            "AGENT_VERIFICATEUR",
        )
        refreshed_auth = planning["admin"].app.state.auth
        refreshed_auth.policy = refreshed_auth.policy.model_copy(
            update={"lifecycle_database": refreshed_auth.engine.url.database}
        )
        planning["auth"] = refreshed_auth
        _partner, operation_type, project = references(planning)

        def submitted_activity(name):
            created = post(
                planning["agent"],
                f"/api/v1/projects/{project['id']}/ptas/2027/activities",
                {
                    **plan(operation_type, name=name),
                    "request_key": str(uuid4()),
                },
            ).json()
            revision = post(
                planning["agent"],
                f"/api/v1/activities/{created['id']}/submissions",
                {"expected_version": created["version"]},
            ).json()
            return created, revision

        first_activity, first_revision = submitted_activity("Revue avant cycle")
        users = planning["admin"].get("/api/v1/access/users").json()["items"]
        first_user = next(
            row for row in users if row["email"] == "supervisor@example.test"
        )
        review, lifecycle = ordered_advisory_race(
            planning["auth"],
            lambda: post(
                planning["supervisor"],
                f"/api/v1/activities/{first_activity['id']}/revisions/"
                f"{first_revision['id']}/decisions",
                {
                    "expected_version": first_revision["activity_version"],
                    "decision": "prevalidate",
                },
            ),
            lambda: planning["admin"].patch(
                f"/api/v1/access/users/{first_user['id']}",
                headers=headers(planning["admin"]),
                json={
                    "expected_version": first_user["version"],
                    "deactivate": True,
                },
            ),
        )
        assert (review.status_code, lifecycle.status_code) == (201, 200)

        second_activity, second_revision = submitted_activity("Cycle avant revue")
        users = planning["admin"].get("/api/v1/access/users").json()["items"]
        second_user = next(
            row for row in users if row["email"] == "race-supervisor@example.test"
        )
        lifecycle, denied_review = ordered_advisory_race(
            planning["auth"],
            lambda: planning["admin"].patch(
                f"/api/v1/access/users/{second_user['id']}",
                headers=headers(planning["admin"]),
                json={
                    "expected_version": second_user["version"],
                    "deactivate": True,
                },
            ),
            lambda: post(
                second,
                f"/api/v1/activities/{second_activity['id']}/revisions/"
                f"{second_revision['id']}/decisions",
                {
                    "expected_version": second_revision["activity_version"],
                    "decision": "prevalidate",
                },
            ),
        )
        assert lifecycle.status_code == 200
        assert denied_review.status_code == 401


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


def replace_body(activity, **changes):
    body = {
        "name": activity["name"],
        "description": activity["description"],
        "planned_start": activity["planned_start"],
        "planned_end": activity["planned_end"],
        "allocation": activity["allocation"],
        "operations": [
            {
                "id": operation["id"],
                "type_id": operation["type_id"],
                "name": operation["name"],
                "allocation": operation["allocation"],
            }
            for operation in activity["operations"]
        ],
        "expected_version": activity["version"],
    }
    body.update(changes)
    return body


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


def test_p20_v18_openapi_cursors_and_bounded_review_surface(planning):
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
    assert not any(
        word in path
        for path in paths
        for word in ("withdraw", "transfer", "execution", "document")
    )
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
        "/api/v1/activities/{identifier}/amendments",
        "/api/v1/activities/{identifier}/amendments/{amendment_id}",
        "/api/v1/activities/{identifier}/amendments/{amendment_id}/cancellation",
        "/api/v1/activities/{identifier}/assignments",
        "/api/v1/activities/{identifier}/submissions",
        "/api/v1/activities/{identifier}/revisions",
        "/api/v1/activities/{identifier}/revisions/{revision_id}",
        "/api/v1/activities/{identifier}/revisions/{revision_id}/decisions",
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


def test_v20_replaced_immutability_function_fails_schema_guard(planning):
    with planning["auth"].engine.begin() as db:
        db.execute(
            text(
                "CREATE OR REPLACE FUNCTION pta_reject_immutable() RETURNS trigger "
                "LANGUAGE plpgsql AS $$ BEGIN RETURN OLD; END $$"
            )
        )
    assert planning["agent"].get("/api/v1/projects").status_code == 409


def test_v20_predecessor_upgrade_reconstructs_complete_contributors(planning, auth_env):
    """A real PTA-1 audit chain retains reverted/removal editors, not no-op savers."""
    with ExitStack() as stack:
        noop_agent = invite(
            planning["admin"],
            auth_env,
            stack,
            "noop-agent@example.test",
            "AGENT_SAISIE",
        )
        refreshed_auth = planning["admin"].app.state.auth
        refreshed_auth.policy = refreshed_auth.policy.model_copy(
            update={"lifecycle_database": refreshed_auth.engine.url.database}
        )
        planning["auth"] = refreshed_auth
        _partner, operation_type, project = references(planning)
        activity = post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {**plan(operation_type), "request_key": str(uuid4())},
        ).json()
        changed = patch(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}",
            replace_body(activity, name="Nom temporaire"),
        ).json()
        reverted = patch(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}",
            replace_body(changed, name=activity["name"]),
        ).json()
        noop = patch(
            noop_agent,
            f"/api/v1/activities/{activity['id']}",
            replace_body(reverted),
        )
        assert noop.status_code == 200, noop.text
        after_noop = noop.json()
        kept = after_noop["operations"][0]
        removed = patch(
            planning["agent2"],
            f"/api/v1/activities/{activity['id']}",
            replace_body(
                after_noop,
                allocation=kept["allocation"],
                operations=[
                    {
                        "id": kept["id"],
                        "type_id": kept["type_id"],
                        "name": kept["name"],
                        "allocation": kept["allocation"],
                    }
                ],
            ),
        )
        assert removed.status_code == 200, removed.text
        users = planning["admin"].get("/api/v1/access/users").json()["items"]
        expected = {
            next(row["id"] for row in users if row["email"] == "agent@example.test"),
            next(row["id"] for row in users if row["email"] == "agent2@example.test"),
        }
        excluded = next(
            row["id"] for row in users if row["email"] == "noop-agent@example.test"
        )

    planning["auth"].engine.dispose()
    config = Config("alembic.ini")
    command.downgrade(config, "0005_pta1")
    command.upgrade(config, "head")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            contributors = set(
                db.scalars(
                    select(ActivityContributor.user_id).where(
                        ActivityContributor.activity_id == activity["id"]
                    )
                )
            )
            assert contributors == expected
            assert excluded not in contributors
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0007_pta2b1"
            )
    finally:
        engine.dispose()


def test_v20_used_pta2a_database_refuses_destructive_downgrade(planning, auth_env):
    _partner, operation_type, project = references(planning)
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    )
    assert submitted.status_code == 201, submitted.text
    planning["auth"].engine.dispose()
    config = Config("alembic.ini")
    with pytest.raises(Exception, match="Refusing destructive PTA-2A downgrade"):
        command.downgrade(config, "0005_pta1")
    engine = create_engine(auth_env.url)
    try:
        with engine.connect() as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                "0007_pta2b1"
            )
            assert db.scalar(text("SELECT count(*) FROM pta_activity_revision")) == 1
    finally:
        engine.dispose()


@pytest.mark.parametrize("corruption", ["missing", "duplicate", "gap"])
def test_v20_predecessor_upgrade_rejects_broken_attribution(
    planning, auth_env, corruption
):
    _partner, operation_type, project = references(planning)
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}",
        replace_body(activity, name="Modification attribuée"),
    )
    assert changed.status_code == 200, changed.text
    planning["auth"].engine.dispose()
    config = Config("alembic.ini")
    command.downgrade(config, "0005_pta1")
    engine = create_engine(auth_env.url)
    try:
        with engine.begin() as db:
            if corruption in {"missing", "gap"}:
                db.execute(
                    text("ALTER TABLE auth_audit DISABLE TRIGGER auth_audit_immutable")
                )
            if corruption == "missing":
                db.execute(
                    text(
                        "DELETE FROM auth_audit WHERE ctid IN (SELECT ctid FROM "
                        "auth_audit WHERE target=:target AND action='activity.replace' "
                        "LIMIT 1)"
                    ),
                    {"target": activity["id"]},
                )
            elif corruption == "duplicate":
                db.execute(
                    text(
                        "INSERT INTO auth_audit(occurred_at,action,actor,target,"
                        "outcome,"
                        "request_id,details,business) SELECT occurred_at,action,actor,"
                        "target,outcome,request_id,details,business FROM auth_audit "
                        "WHERE target=:target AND action='activity.replace' LIMIT 1"
                    ),
                    {"target": activity["id"]},
                )
            else:
                db.execute(
                    text(
                        "UPDATE auth_audit SET business=jsonb_set(business,"
                        "'{after,version}','4'::jsonb) WHERE target=:target "
                        "AND action='activity.replace'"
                    ),
                    {"target": activity["id"]},
                )
            if corruption in {"missing", "gap"}:
                db.execute(
                    text("ALTER TABLE auth_audit ENABLE TRIGGER auth_audit_immutable")
                )
        with pytest.raises(Exception, match="Incomplete PTA-1 Activity audit chain"):
            command.upgrade(config, "head")
    finally:
        engine.dispose()


@pytest.mark.parametrize("field", ["type_id", "name", "allocation", "position"])
def test_v20_predecessor_upgrade_rejects_corrupted_operation_tombstone(
    planning, auth_env, field
):
    _partner, operation_type, project = references(planning)
    other_type = post(
        planning["validator"],
        "/api/v1/operation-types",
        {"label": "Type de corruption"},
    ).json()
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    kept = activity["operations"][0]
    response = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}",
        replace_body(
            activity,
            allocation=kept["allocation"],
            operations=[
                {
                    "id": kept["id"],
                    "type_id": kept["type_id"],
                    "name": kept["name"],
                    "allocation": kept["allocation"],
                }
            ],
        ),
    )
    assert response.status_code == 200, response.text
    planning["auth"].engine.dispose()
    config = Config("alembic.ini")
    command.downgrade(config, "0005_pta1")
    engine = create_engine(auth_env.url)
    values = {
        "type_id": other_type["id"],
        "name": "Tombstone falsifiée",
        "allocation": 999999,
        "position": 99,
    }
    try:
        with engine.begin() as db:
            db.execute(
                text(
                    f"UPDATE pta_operation SET {field}=:value "
                    "WHERE activity_id=:activity AND removed_at IS NOT NULL"
                ),
                {"value": values[field], "activity": activity["id"]},
            )
        with pytest.raises(Exception, match="Incomplete PTA-1 Activity audit chain"):
            command.upgrade(config, "head")
    finally:
        engine.dispose()


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
        f"/api/v1/activities/{activity['id']}/revisions",
        f"/api/v1/activities/{activity['id']}/revisions/{uuid4()}",
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
        (
            "POST",
            f"/api/v1/activities/{activity['id']}/submissions",
            {"expected_version": 1},
        ),
        (
            "POST",
            f"/api/v1/activities/{activity['id']}/revisions/{uuid4()}/decisions",
            {"expected_version": 1, "decision": "prevalidate"},
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
        (
            planning["agent"],
            "POST",
            f"/api/v1/activities/{activity['id']}/submissions",
            {"expected_version": 1},
        ),
        (
            planning["supervisor"],
            "POST",
            f"/api/v1/activities/{activity['id']}/revisions/{uuid4()}/decisions",
            {"expected_version": 1, "decision": "prevalidate"},
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


def test_v17_revision_cursor_and_detail_cannot_cross_activity_trees(planning):
    _partner, operation_type, project = references(planning)
    activities = [
        post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            {
                **plan(operation_type, name=f"Arbre révision {index}"),
                "request_key": str(uuid4()),
            },
        ).json()
        for index in (1, 2)
    ]
    first_revision = post(
        planning["agent"],
        f"/api/v1/activities/{activities[0]['id']}/submissions",
        {"expected_version": activities[0]["version"]},
    ).json()
    returned = post(
        planning["supervisor"],
        f"/api/v1/activities/{activities[0]['id']}/revisions/{first_revision['id']}/decisions",
        {
            "expected_version": first_revision["activity_version"],
            "decision": "return",
            "reason": "Créer une seconde révision",
        },
    ).json()
    detail = planning["agent"].get(f"/api/v1/activities/{activities[0]['id']}").json()
    corrected = patch(
        planning["agent"],
        f"/api/v1/activities/{activities[0]['id']}",
        replace_body(
            detail,
            description="Seconde révision pour le curseur",
            expected_version=returned["activity_version"],
        ),
    ).json()
    post(
        planning["agent"],
        f"/api/v1/activities/{activities[0]['id']}/submissions",
        {"expected_version": corrected["version"]},
    )
    page = (
        planning["agent"]
        .get(f"/api/v1/activities/{activities[0]['id']}/revisions?limit=1")
        .json()
    )
    token = page["next"].split("cursor=", 1)[1]
    assert (
        planning["agent"]
        .get(
            f"/api/v1/activities/{activities[1]['id']}/revisions?limit=1&cursor={token}"
        )
        .status_code
        == 422
    )
    assert (
        planning["agent"]
        .get(
            f"/api/v1/activities/{activities[1]['id']}/revisions/{first_revision['id']}"
        )
        .status_code
        == 404
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


def test_v16_role_change_and_review_are_serial_in_both_orders(planning, auth_env):
    with ExitStack() as stack:
        second = invite(
            planning["admin"],
            auth_env,
            stack,
            "v16-role-supervisor@example.test",
            "AGENT_VERIFICATEUR",
        )
        planning["auth"] = planning["admin"].app.state.auth
        planning["auth"].policy = planning["auth"].policy.model_copy(
            update={"lifecycle_database": planning["auth"].engine.url.database}
        )
        _partner, operation_type, project = references(planning)

        def submitted(name):
            activity = post(
                planning["agent"],
                f"/api/v1/projects/{project['id']}/ptas/2027/activities",
                {**plan(operation_type, name=name), "request_key": str(uuid4())},
            ).json()
            revision = post(
                planning["agent"],
                f"/api/v1/activities/{activity['id']}/submissions",
                {"expected_version": activity["version"]},
            ).json()
            return activity, revision

        users = planning["admin"].get("/api/v1/access/users").json()["items"]
        by_email = {row["email"]: row for row in users}
        first, first_revision = submitted("Revue avant rôle")
        reviewed, changed = ordered_advisory_race(
            planning["auth"],
            lambda: post(
                planning["supervisor"],
                f"/api/v1/activities/{first['id']}/revisions/{first_revision['id']}/decisions",
                {
                    "expected_version": first_revision["activity_version"],
                    "decision": "prevalidate",
                },
            ),
            lambda: planning["admin"].patch(
                f"/api/v1/access/users/{by_email['supervisor@example.test']['id']}",
                headers=headers(planning["admin"]),
                json={
                    "expected_version": by_email["supervisor@example.test"]["version"],
                    "role": "VALIDATEUR_DEFINITIF",
                },
            ),
        )
        assert (reviewed.status_code, changed.status_code) == (201, 200)

        second_activity, second_revision = submitted("Rôle avant revue")
        changed, denied = ordered_advisory_race(
            planning["auth"],
            lambda: planning["admin"].patch(
                f"/api/v1/access/users/{by_email['v16-role-supervisor@example.test']['id']}",
                headers=headers(planning["admin"]),
                json={
                    "expected_version": by_email["v16-role-supervisor@example.test"][
                        "version"
                    ],
                    "role": "AGENT_SAISIE",
                },
            ),
            lambda: post(
                second,
                f"/api/v1/activities/{second_activity['id']}/revisions/{second_revision['id']}/decisions",
                {
                    "expected_version": second_revision["activity_version"],
                    "decision": "prevalidate",
                },
            ),
        )
        assert changed.status_code == 200
        assert denied.status_code == 401


def test_v16_password_reset_and_review_are_serial_in_both_orders(planning, auth_env):
    with ExitStack() as stack:
        first_reviewer = invite(
            planning["admin"],
            auth_env,
            stack,
            "v16-reset-one@example.test",
            "AGENT_VERIFICATEUR",
        )
        second_reviewer = invite(
            planning["admin"],
            auth_env,
            stack,
            "v16-reset-two@example.test",
            "AGENT_VERIFICATEUR",
        )
        planning["auth"] = planning["admin"].app.state.auth
        planning["auth"].policy = planning["auth"].policy.model_copy(
            update={"lifecycle_database": planning["auth"].engine.url.database}
        )
        _partner, operation_type, project = references(planning)

        def submitted(name):
            activity = post(
                planning["agent"],
                f"/api/v1/projects/{project['id']}/ptas/2027/activities",
                {**plan(operation_type, name=name), "request_key": str(uuid4())},
            ).json()
            revision = post(
                planning["agent"],
                f"/api/v1/activities/{activity['id']}/submissions",
                {"expected_version": activity["version"]},
            ).json()
            return activity, revision

        proofs = {}
        for email in ("v16-reset-one@example.test", "v16-reset-two@example.test"):
            prepared = planning["auth"].prepare_recovery(email)
            assert prepared
            recipient, selector, generation, verifier = prepared
            planning["auth"].deliver_recovery(recipient, selector, generation, verifier)
            proofs[email] = (selector, verifier)

        first, first_revision = submitted("Revue avant reset")
        reviewed, reset = ordered_advisory_race(
            planning["auth"],
            lambda: post(
                first_reviewer,
                f"/api/v1/activities/{first['id']}/revisions/{first_revision['id']}/decisions",
                {
                    "expected_version": first_revision["activity_version"],
                    "decision": "prevalidate",
                },
            ),
            lambda: planning["auth"].complete_recovery(
                *proofs["v16-reset-one@example.test"], "Recovered!98", "Recovered!98"
            ),
        )
        assert reviewed.status_code == 201
        assert reset[1] == "v16-reset-one@example.test"

        second, second_revision = submitted("Reset avant revue")
        reset, denied = ordered_advisory_race(
            planning["auth"],
            lambda: planning["auth"].complete_recovery(
                *proofs["v16-reset-two@example.test"], "Recovered!99", "Recovered!99"
            ),
            lambda: post(
                second_reviewer,
                f"/api/v1/activities/{second['id']}/revisions/{second_revision['id']}/decisions",
                {
                    "expected_version": second_revision["activity_version"],
                    "decision": "prevalidate",
                },
            ),
        )
        assert reset[1] == "v16-reset-two@example.test"
        assert denied.status_code == 401


@pytest.mark.parametrize("mutation", ["submission", "correction", "decision"])
def test_v12_activity_reads_remain_coherent_while_workflow_mutates(planning, mutation):
    _partner, operation_type, project = references(planning)
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    revision = returned = None
    if mutation in {"correction", "decision"}:
        revision = post(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/submissions",
            {"expected_version": activity["version"]},
        ).json()
    if mutation == "correction":
        returned = post(
            planning["supervisor"],
            f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "return",
                "reason": "Lecture cohérente",
            },
        ).json()
        returned_activity = (
            planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
        )

    def mutate(client):
        if mutation == "submission":
            return post(
                client,
                f"/api/v1/activities/{activity['id']}/submissions",
                {"expected_version": activity["version"]},
            )
        if mutation == "correction":
            return patch(
                client,
                f"/api/v1/activities/{activity['id']}",
                replace_body(
                    returned_activity,
                    description="Correction après lecture",
                    expected_version=returned["activity_version"],
                ),
            )
        return post(
            client,
            f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        )

    entered, release, attempted = Event(), Event(), Event()
    mutation_pid = {"value": None}

    def hold_http_read(_conn, _cursor, statement, _parameters, _context, _many):
        normalized = statement.upper()
        if "FROM PTA_ACTIVITY" in normalized and "FOR SHARE" in normalized:
            entered.set()
            assert release.wait(5), "bounded coherent-read release missing"

    def observe_mutation_lock(conn, _cursor, statement, _parameters, _context, _many):
        normalized = statement.upper()
        if "FROM PTA_ACTIVITY" in normalized and "FOR UPDATE" in normalized:
            mutation_pid["value"] = conn.connection.driver_connection.info.backend_pid
            attempted.set()

    read_path = (
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}"
        if mutation == "decision"
        else f"/api/v1/activities/{activity['id']}"
    )
    reader = TestClient(planning["admin"].app, base_url="http://localhost")
    writer = TestClient(planning["admin"].app, base_url="http://localhost")
    try:
        reader.cookies.update(planning["agent"].cookies)
        writer_source = (
            planning["supervisor"] if mutation == "decision" else planning["agent2"]
        )
        writer.cookies.update(writer_source.cookies)
        engine = planning["auth"].engine
        event.listen(engine, "after_cursor_execute", hold_http_read)
        event.listen(engine, "before_cursor_execute", observe_mutation_lock)
        try:
            with (
                ThreadPoolExecutor(
                    max_workers=1, thread_name_prefix="coherent-read"
                ) as reads,
                ThreadPoolExecutor(
                    max_workers=1, thread_name_prefix="coherent-write"
                ) as writes,
            ):
                read_result = reads.submit(reader.get, read_path)
                assert entered.wait(5), "HTTP read did not acquire Activity FOR SHARE"
                pending = writes.submit(mutate, writer)
                assert attempted.wait(5), "mutation did not attempt the Activity lock"
                deadline = monotonic() + 5
                observed_wait = False
                while monotonic() < deadline:
                    with engine.connect() as observer:
                        observed_wait = (
                            observer.scalar(
                                text(
                                    "SELECT wait_event_type='Lock' "
                                    "FROM pg_stat_activity WHERE pid=:pid"
                                ),
                                {"pid": mutation_pid["value"]},
                            )
                            is True
                        )
                    if observed_wait:
                        break
                    Event().wait(0.01)
                assert observed_wait, "mutation was not observed waiting on the lock"
                release.set()
                coherent_before = read_result.result(timeout=10)
                result = pending.result(timeout=10)
        finally:
            release.set()
            event.remove(engine, "after_cursor_execute", hold_http_read)
            event.remove(engine, "before_cursor_execute", observe_mutation_lock)
    finally:
        reader.close()
        writer.close()
    assert coherent_before.status_code == 200
    if mutation == "decision":
        assert coherent_before.json()["decisions"] == []
    else:
        assert coherent_before.json()["version"] == (
            activity["version"]
            if mutation == "submission"
            else returned["activity_version"]
        )
    assert result.status_code in {200, 201}, result.text
    with engine.connect() as db:
        coherent_after = db.execute(
            text("SELECT state,version FROM pta_activity WHERE id=:id"),
            {"id": activity["id"]},
        ).one()
    before_version = (
        revision["activity_version"]
        if mutation == "decision"
        else coherent_before.json()["version"]
    )
    assert coherent_after.version == before_version + 1
