"""A3 ordinary synthetic-account password recovery through public HTTP seams."""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from socket import socket
from threading import Event, Lock, Thread
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
import uvicorn
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select, text
from sqlalchemy.orm import Session
from test_access import PASSWORD, activate, headers
from test_access import admin as admin_fixture
from test_auth import messages

from app.auth.models import OTP, Abuse, Audit, Context, Recovery, User
from app.auth.service import AuthError

admin = admin_fixture
NEW_PASSWORD = "Recovered!94"


def recovery_proof(mailbox, email):
    mail = [
        item
        for item in messages(mailbox)
        if item["recipient"] == email and item["kind"] == "password_recovery"
    ][-1]
    return {
        key: value[0]
        for key, value in parse_qs(urlsplit(mail["value"]).fragment).items()
    }


@pytest.fixture
def ordinary(admin, auth_env):
    email = "recovery@example.test"
    assert (
        admin.post(
            "/api/v1/access/invitations",
            headers=headers(admin),
            json={"email": email, "role": "AGENT_SAISIE"},
        ).status_code
        == 201
    )
    with TestClient(admin.app, base_url="http://localhost") as client:
        activate(client, auth_env.mailbox, email)
        with Session(client.app.state.auth.engine) as db:
            user = db.scalar(select(User).where(User.email == email))
            assert user
            identifier = user.id
        yield client, email, identifier


@pytest.fixture
def lifecycle_case(admin, auth_env):
    email = "recovery-lifecycle@example.test"
    assert (
        admin.post(
            "/api/v1/access/invitations",
            headers=headers(admin),
            json={"email": email, "role": "AGENT_SAISIE"},
        ).status_code
        == 201
    )
    with TestClient(admin.app, base_url="http://localhost") as client:
        activate(client, auth_env.mailbox, email)
        with Session(client.app.state.auth.engine) as db:
            user = db.scalar(select(User).where(User.email == email))
            assert user
            identifier = user.id
        yield admin, client, email, identifier


def enable_recovery(client):
    auth = client.app.state.auth
    auth.policy = auth.policy.model_copy(
        update={"lifecycle_database": auth.engine.url.database}
    )
    auth.provision_context("test-operator", "PTA-1 recovery compatibility")


def request(client, email):
    return client.post(
        "/api/v1/auth/password-reset/requests",
        headers=headers(client),
        json={"email": email},
    )


def ordered_race(engine, blocked_name, blocked_statement, blocked_call, other_call):
    entered, release, guard = Event(), Event(), Lock()
    result = {}
    blocked_once = False

    def before(conn, cursor, statement, parameters, context, executemany):
        nonlocal blocked_once
        if not blocked_statement(statement):
            return
        with guard:
            if blocked_once:
                return
            blocked_once = True
        entered.set()
        assert release.wait(5)

    def invoke():
        result["response"] = blocked_call()

    from sqlalchemy import event

    event.listen(engine, "before_cursor_execute", before)
    worker = Thread(target=invoke, name=blocked_name)
    try:
        worker.start()
        assert entered.wait(3)
        other = other_call()
        release.set()
        worker.join(7)
        assert not worker.is_alive()
    finally:
        release.set()
        worker.join(7)
        event.remove(engine, "before_cursor_execute", before)
    return result["response"], other


def test_recovery_requires_explicit_isolated_policy(admin):
    admin.app.state.auth.policy = admin.app.state.auth.policy.model_copy(
        update={"recovery_fixture": None}
    )
    response = request(admin, "nobody@example.test")
    assert response.status_code == 503
    assert response.json()["code"] == "recovery_unavailable"


def test_recovery_policy_accepts_only_authorized_test_values(
    auth_env, monkeypatch, tmp_path
):
    import json

    from app.auth.policy import load_policy

    policy_file = tmp_path / "invalid-recovery-policy.json"
    invalid = {**auth_env.config, "recovery_seconds": 601}
    policy_file.write_text(json.dumps(invalid))
    monkeypatch.setenv("MJL_AUTH_POLICY_FILE", str(policy_file))
    with pytest.raises(ValueError, match="Invalid isolated A1 policy configuration"):
        load_policy(auth_env.url)


def test_a3_migration_preserves_existing_auth_evidence(auth_env):
    config = Config("alembic.ini")
    command.downgrade(config, "0003_a21")
    engine = create_engine(auth_env.url)
    try:
        with engine.begin() as db:
            db.execute(
                text(
                    "INSERT INTO auth_user(id,email,role,state,password_hash,version) "
                    "VALUES ('user','migration@example.test','AGENT_SAISIE','active',"
                    "'synthetic-hash',2)"
                )
            )
            db.execute(
                text(
                    "INSERT INTO auth_invitation(id,user_id,verifier,generation,"
                    "expires_at,state,version) VALUES ('invite','user',repeat('a',64),"
                    "'generation',clock_timestamp()+interval '1 hour','consumed',2)"
                )
            )
            db.execute(
                text(
                    "INSERT INTO auth_context(id,csrf,state,user_id,proof,created_at,"
                    "last_activity,expires_at) VALUES ('context','csrf','verified',"
                    "'user','proof',clock_timestamp(),clock_timestamp(),"
                    "clock_timestamp()+interval '1 hour')"
                )
            )
            db.execute(
                text(
                    "INSERT INTO auth_otp(user_id,context_id,generation,verifier,state,"
                    "expires_at,sent_at,attempts,resends) VALUES ('user','context',"
                    "'generation',repeat('b',64),'consumed',clock_timestamp()+"
                    "interval '1 hour',clock_timestamp(),1,1)"
                )
            )
            db.execute(
                text(
                    "INSERT INTO auth_abuse(id,started_at,count) "
                    "VALUES ('limit',clock_timestamp(),1)"
                )
            )
            db.execute(
                text(
                    "INSERT INTO auth_audit(occurred_at,action,actor,target,outcome,"
                    "request_id,details) VALUES (clock_timestamp(),'migration_fixture',"
                    "'test','user','ok','00000000-0000-0000-0000-000000000000',"
                    "jsonb_build_object('preserved',1))"
                )
            )
        command.upgrade(config, "head")
        with engine.connect() as db:
            assert (
                db.scalar(text("SELECT version_num FROM alembic_version"))
                == "0007_pta2b1"
            )
            for table in (
                "auth_user",
                "auth_invitation",
                "auth_context",
                "auth_otp",
                "auth_abuse",
                "auth_audit",
            ):
                assert db.scalar(text(f"SELECT count(*) FROM {table}")) == 1
            assert db.scalar(text("SELECT count(*) FROM auth_recovery")) == 0
    finally:
        engine.dispose()


def test_request_is_neutral_and_excludes_unknown_and_admin(admin, auth_env):
    enable_recovery(admin)
    for email in ("pending@example.test", "inactive@example.test"):
        assert (
            admin.post(
                "/api/v1/access/invitations",
                headers=headers(admin),
                json={"email": email, "role": "AGENT_SAISIE"},
            ).status_code
            == 201
        )
    auth = admin.app.state.auth
    with Session(auth.engine) as db, db.begin():
        inactive = db.scalar(
            select(User).where(User.email == "inactive@example.test").with_for_update()
        )
        assert inactive
        inactive.state = "inactive"
        inactive.password_hash = auth.dummy_hash
        inactive.version += 1
    before = len(
        [
            item
            for item in messages(auth_env.mailbox)
            if item["kind"] == "password_recovery"
        ]
    )
    for email in (
        "unknown@example.test",
        "admin@example.test",
        "pending@example.test",
        "inactive@example.test",
    ):
        response = request(admin, email)
        assert response.status_code == 202
        assert response.json() == {"state": "request_received"}
    after = len(
        [
            item
            for item in messages(auth_env.mailbox)
            if item["kind"] == "password_recovery"
        ]
    )
    assert after == before
    with Session(auth.engine) as db:
        assert db.scalar(select(func.count(Recovery.id))) == 0


def test_valid_recovery_preserves_identity_and_requires_fresh_login(ordinary, auth_env):
    client, email, identifier = ordinary
    enable_recovery(client)
    assert request(client, email).status_code == 202
    proof = recovery_proof(auth_env.mailbox, email)
    assert client.post(
        "/api/v1/auth/password-reset/inspect",
        headers=headers(client),
        json=proof,
    ).json() == {"email": email}
    response = client.post(
        "/api/v1/auth/password-reset/complete",
        headers=headers(client),
        json={**proof, "password": NEW_PASSWORD, "confirmation": NEW_PASSWORD},
    )
    assert response.status_code == 200
    assert response.json() == {"state": "password_reset"}
    assert client.get("/api/v1/auth/session").status_code == 401
    with Session(client.app.state.auth.engine) as db:
        user = db.get(User, identifier)
        recovery = db.get(Recovery, proof["selector"])
        assert user and user.email == email and user.role == "AGENT_SAISIE"
        assert recovery and recovery.state == "consumed"
        assert db.scalar(select(Audit.id).where(Audit.action == "recovery_complete"))
    with TestClient(client.app, base_url="http://localhost") as fresh:
        h = headers(fresh)
        assert (
            fresh.post(
                "/api/v1/auth/login",
                headers=h,
                json={"email": email, "password": PASSWORD},
            ).status_code
            == 401
        )
        with fresh.app.state.auth.engine.begin() as db:
            db.exec_driver_sql(
                "UPDATE auth_otp SET sent_at = clock_timestamp() - interval '1 hour' "
                "WHERE user_id = %s",
                (identifier,),
            )
        assert (
            fresh.post(
                "/api/v1/auth/login",
                headers=h,
                json={"email": email, "password": NEW_PASSWORD},
            ).status_code
            == 202
        )


def test_inspection_rejects_bad_and_expired_proofs_without_extension(
    ordinary, auth_env
):
    client, email, _ = ordinary
    enable_recovery(client)
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    auth = client.app.state.auth
    with Session(auth.engine) as db:
        recovery = db.get(Recovery, proof["selector"])
        assert recovery
        original_expiry = recovery.expires_at
    assert (
        client.post(
            "/api/v1/auth/password-reset/inspect",
            headers=headers(client),
            json=proof,
        ).status_code
        == 200
    )
    with Session(auth.engine) as db:
        recovery = db.get(Recovery, proof["selector"])
        assert recovery and recovery.expires_at == original_expiry
    for rejected in (
        {**proof, "verifier": "wrong-verifier"},
        {**proof, "selector": "00000000-0000-0000-0000-000000000000"},
    ):
        response = client.post(
            "/api/v1/auth/password-reset/inspect",
            headers=headers(client),
            json=rejected,
        )
        assert response.status_code == 400
        assert response.json()["code"] == "recovery_invalid"
    with Session(auth.engine) as db, db.begin():
        db.execute(
            text(
                "UPDATE auth_recovery "
                "SET expires_at=clock_timestamp()-interval '1 second'"
            )
        )
    response = client.post(
        "/api/v1/auth/password-reset/inspect",
        headers=headers(client),
        json=proof,
    )
    assert response.status_code == 400
    assert response.json()["code"] == "recovery_invalid"


@pytest.mark.parametrize("failure", ["binding", "schema"])
def test_delivery_and_inspection_fail_closed_on_provenance_or_schema(
    ordinary, auth_env, failure
):
    client, email, _ = ordinary
    enable_recovery(client)
    auth = client.app.state.auth
    delivery = auth.prepare_recovery(email)
    assert delivery
    if failure == "binding":
        auth.policy = auth.policy.model_copy(update={"lifecycle_database": None})
    else:
        with Session(auth.engine) as db, db.begin():
            db.execute(text("CREATE TABLE unexpected_recovery_relation (id integer)"))
    before = len(messages(auth_env.mailbox))
    with pytest.raises(AuthError, match="eligibility_unverified"):
        auth.deliver_recovery(*delivery)
    assert len(messages(auth_env.mailbox)) == before
    with Session(auth.engine) as db:
        recovery = db.get(Recovery, delivery[1])
        assert recovery and recovery.state == "prepared"
    with pytest.raises(AuthError, match="eligibility_unverified"):
        auth.recovery(delivery[1], delivery[3])


def test_repeat_request_preserves_unexpired_proof(ordinary, auth_env):
    client, email, _ = ordinary
    enable_recovery(client)
    assert request(client, email).status_code == 202
    proof = recovery_proof(auth_env.mailbox, email)
    with Session(client.app.state.auth.engine) as db:
        original = db.get(Recovery, proof["selector"])
        assert original
        facts = (original.generation, original.verifier, original.expires_at)
    count = len(messages(auth_env.mailbox))
    assert request(client, email).status_code == 202
    assert len(messages(auth_env.mailbox)) == count
    with Session(client.app.state.auth.engine) as db:
        current = db.get(Recovery, proof["selector"])
        assert current
        assert (current.generation, current.verifier, current.expires_at) == facts


def test_policy_failure_does_not_consume_and_replay_is_rejected(ordinary, auth_env):
    client, email, _ = ordinary
    enable_recovery(client)
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    for password, confirmation in (
        ("weak", "weak"),
        (NEW_PASSWORD, "Different!95"),
    ):
        rejected = client.post(
            "/api/v1/auth/password-reset/complete",
            headers=headers(client),
            json={**proof, "password": password, "confirmation": confirmation},
        )
        assert rejected.status_code == 422
        with Session(client.app.state.auth.engine) as db:
            recovery = db.get(Recovery, proof["selector"])
            assert recovery and recovery.state == "delivered"
    body = {**proof, "password": NEW_PASSWORD, "confirmation": NEW_PASSWORD}
    assert (
        client.post(
            "/api/v1/auth/password-reset/complete", headers=headers(client), json=body
        ).status_code
        == 200
    )
    fresh = TestClient(client.app, base_url="http://localhost")
    try:
        replay = fresh.post(
            "/api/v1/auth/password-reset/complete", headers=headers(fresh), json=body
        )
    finally:
        fresh.close()
    assert replay.status_code == 409
    assert replay.json()["code"] == "recovery_consumed"


def test_concurrent_completion_has_one_winner(ordinary, auth_env):
    client, email, identifier = ordinary
    enable_recovery(client)
    with Session(client.app.state.auth.engine) as db:
        initial = db.get(User, identifier)
        assert initial
        initial_version = initial.version
        initial_hash = initial.password_hash
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    body = {**proof, "password": NEW_PASSWORD, "confirmation": NEW_PASSWORD}
    contenders = [TestClient(client.app, base_url="http://localhost") for _ in range(2)]
    credentials = [(item, headers(item)) for item in contenders]

    def complete(item):
        contender, contender_headers = item
        return contender.post(
            "/api/v1/auth/password-reset/complete",
            headers=contender_headers,
            json=body,
        ).status_code

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = sorted(pool.map(complete, credentials))
    finally:
        for contender in contenders:
            contender.close()
    assert statuses == [200, 409]
    with Session(client.app.state.auth.engine) as db:
        user = db.get(User, identifier)
        recovery = db.get(Recovery, proof["selector"])
        successes = db.scalar(
            select(func.count(Audit.id)).where(
                Audit.action == "recovery_complete", Audit.target == identifier
            )
        )
        notifications = db.scalar(
            select(func.count(Audit.id)).where(
                Audit.action == "recovery_notification", Audit.target == identifier
            )
        )
        assert user and user.version == initial_version + 1
        assert user.password_hash != initial_hash
        assert client.app.state.auth.hasher.verify(user.password_hash, NEW_PASSWORD)
        assert recovery and recovery.state == "consumed"
        assert successes == 1
        assert notifications == 1
    notices = [
        item
        for item in messages(auth_env.mailbox)
        if item["recipient"] == email and item["kind"] == "password_reset_notice"
    ]
    assert len(notices) == 1


def test_concurrent_preparation_sends_one_generation(ordinary, auth_env):
    client, email, identifier = ordinary
    enable_recovery(client)
    auth = client.app.state.auth
    before = len(
        [
            item
            for item in messages(auth_env.mailbox)
            if item["recipient"] == email and item["kind"] == "password_recovery"
        ]
    )
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(
            pool.map(
                lambda correlation: auth.request_recovery(email, correlation),
                ("concurrent-one", "concurrent-two"),
            )
        )
    after = [
        item
        for item in messages(auth_env.mailbox)
        if item["recipient"] == email and item["kind"] == "password_recovery"
    ]
    assert len(after) == before + 1
    with Session(auth.engine) as db:
        assert (
            db.scalar(
                select(func.count(Audit.id)).where(
                    Audit.action == "recovery_prepare", Audit.target == identifier
                )
            )
            == 1
        )


@pytest.mark.parametrize("first", ["reset", "login"])
def test_reset_and_login_are_ordered_without_stale_authority(ordinary, auth_env, first):
    client, email, identifier = ordinary
    enable_recovery(client)
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    with Session(client.app.state.auth.engine) as db, db.begin():
        db.execute(
            text(
                "UPDATE auth_otp SET sent_at = clock_timestamp() - interval '1 hour' "
                "WHERE user_id = :user"
            ),
            {"user": identifier},
        )
    reset_client = TestClient(client.app, base_url="http://localhost")
    login_client = TestClient(client.app, base_url="http://localhost")
    reset_headers, login_headers = headers(reset_client), headers(login_client)

    def reset():
        return reset_client.post(
            "/api/v1/auth/password-reset/complete",
            headers=reset_headers,
            json={**proof, "password": NEW_PASSWORD, "confirmation": NEW_PASSWORD},
        )

    def login():
        return login_client.post(
            "/api/v1/auth/login",
            headers=login_headers,
            json={"email": email, "password": PASSWORD},
        )

    try:
        if first == "reset":
            blocked, winner = ordered_race(
                client.app.state.auth.engine,
                "blocked-login",
                lambda statement: "pg_advisory_xact_lock" in statement,
                login,
                reset,
            )
            login_response, reset_response = blocked, winner
        else:
            blocked, winner = ordered_race(
                client.app.state.auth.engine,
                "blocked-reset",
                lambda statement: "pg_advisory_xact_lock" in statement,
                reset,
                login,
            )
            reset_response, login_response = blocked, winner
        assert reset_response.status_code == 200
        assert login_response.status_code == (401 if first == "reset" else 202)
        session = login_client.get("/api/v1/auth/session")
        if first == "reset":
            assert session.status_code == 200 and session.json()["state"] == "anonymous"
        else:
            assert session.status_code == 401
    finally:
        reset_client.close()
        login_client.close()


@pytest.mark.parametrize("action", ["verify", "resend"])
@pytest.mark.parametrize("first", ["reset", "otp"])
def test_reset_and_pending_otp_are_ordered_without_revival(
    ordinary, auth_env, action, first
):
    client, email, identifier = ordinary
    enable_recovery(client)
    auth = client.app.state.auth
    with Session(auth.engine) as db, db.begin():
        db.execute(
            text(
                "UPDATE auth_otp SET sent_at = clock_timestamp() - interval '1 hour' "
                "WHERE user_id = :user"
            ),
            {"user": identifier},
        )
    pending = TestClient(client.app, base_url="http://localhost")
    pending_headers = headers(pending)
    existing_mail = set(auth_env.mailbox.glob("*.json"))
    assert (
        pending.post(
            "/api/v1/auth/login",
            headers=pending_headers,
            json={"email": email, "password": PASSWORD},
        ).status_code
        == 202
    )
    new_mail = set(auth_env.mailbox.glob("*.json")) - existing_mail
    codes = [
        item["value"]
        for item in (json.loads(path.read_text()) for path in new_mail)
        if item["recipient"] == email and item["kind"] == "otp"
    ]
    assert len(codes) == 1
    code = codes[0]
    if action == "resend":
        with Session(auth.engine) as db, db.begin():
            db.execute(
                text(
                    "UPDATE auth_otp "
                    "SET sent_at = clock_timestamp() - interval '61 seconds' "
                    "WHERE user_id = :user"
                ),
                {"user": identifier},
            )
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    reset_client = TestClient(client.app, base_url="http://localhost")
    reset_headers = headers(reset_client)

    def reset():
        return reset_client.post(
            "/api/v1/auth/password-reset/complete",
            headers=reset_headers,
            json={**proof, "password": NEW_PASSWORD, "confirmation": NEW_PASSWORD},
        )

    def otp():
        return pending.post(
            f"/api/v1/auth/otp/{action}",
            headers=pending_headers,
            json={"code": code} if action == "verify" else {},
        )

    try:
        if first == "reset":
            blocked, winner = ordered_race(
                auth.engine,
                "blocked-otp",
                lambda statement: "from auth_user" in statement.lower(),
                otp,
                reset,
            )
            otp_response, reset_response = blocked, winner
        else:
            blocked, winner = ordered_race(
                auth.engine,
                "blocked-reset",
                lambda statement: "pg_advisory_xact_lock" in statement,
                reset,
                otp,
            )
            reset_response, otp_response = blocked, winner
        assert reset_response.status_code == 200
        assert otp_response.status_code == (
            401 if first == "reset" else (200 if action == "verify" else 202)
        )
        session = pending.get("/api/v1/auth/session")
        if first == "reset":
            assert session.status_code == 200 and session.json()["state"] == "anonymous"
        else:
            assert session.status_code == 401
    finally:
        pending.close()
        reset_client.close()


@pytest.mark.parametrize("action", ["role", "deactivate"])
@pytest.mark.parametrize("first", ["reset", "lifecycle"])
def test_reset_and_lifecycle_are_ordered_without_stale_authority(
    lifecycle_case, auth_env, action, first
):
    admin_client, client, email, identifier = lifecycle_case
    enable_recovery(client)
    auth = client.app.state.auth
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    with Session(auth.engine) as db:
        user = db.get(User, identifier)
        assert user
        expected_version = user.version
    reset_client = TestClient(client.app, base_url="http://localhost")
    reset_headers, admin_headers = headers(reset_client), headers(admin_client)
    body = (
        {"expected_version": expected_version, "role": "AGENT_VERIFICATEUR"}
        if action == "role"
        else {"expected_version": expected_version, "deactivate": True}
    )

    def reset():
        return reset_client.post(
            "/api/v1/auth/password-reset/complete",
            headers=reset_headers,
            json={**proof, "password": NEW_PASSWORD, "confirmation": NEW_PASSWORD},
        )

    def lifecycle():
        return admin_client.patch(
            f"/api/v1/access/users/{identifier}",
            headers=admin_headers,
            json=body,
        )

    try:
        if first == "reset":
            blocked, winner = ordered_race(
                auth.engine,
                "blocked-lifecycle",
                lambda statement: "pg_advisory_xact_lock" in statement,
                lifecycle,
                reset,
            )
            lifecycle_response, reset_response = blocked, winner
            assert reset_response.status_code == 200
            assert lifecycle_response.status_code == 409
        else:
            blocked, winner = ordered_race(
                auth.engine,
                "blocked-reset",
                lambda statement: "pg_advisory_xact_lock" in statement,
                reset,
                lifecycle,
            )
            reset_response, lifecycle_response = blocked, winner
            assert lifecycle_response.status_code == 200
            assert reset_response.status_code == 400
        with Session(auth.engine) as db:
            user = db.get(User, identifier)
            assert user
            if first == "reset":
                assert user.state == "active" and user.role == "AGENT_SAISIE"
                assert auth.hasher.verify(user.password_hash, NEW_PASSWORD)
            elif action == "role":
                assert user.role == "AGENT_VERIFICATEUR"
                assert auth.hasher.verify(user.password_hash, PASSWORD)
            else:
                assert user.state == "inactive"
                assert auth.hasher.verify(user.password_hash, PASSWORD)
    finally:
        reset_client.close()


def test_reset_invalidates_verified_and_pending_contexts(ordinary, auth_env):
    client, email, identifier = ordinary
    enable_recovery(client)
    auth = client.app.state.auth
    second_verified = TestClient(client.app, base_url="http://localhost")
    pending = TestClient(client.app, base_url="http://localhost")
    try:
        with Session(auth.engine) as db, db.begin():
            otp = db.get(OTP, identifier, with_for_update=True)
            assert otp
            otp.sent_at = auth.now(db) - timedelta(seconds=61)
        second_headers = headers(second_verified)
        before_delivery = set(auth_env.mailbox.glob("*.json"))
        assert (
            second_verified.post(
                "/api/v1/auth/login",
                headers=second_headers,
                json={"email": email, "password": PASSWORD},
            ).status_code
            == 202
        )
        delivered = set(auth_env.mailbox.glob("*.json")) - before_delivery
        assert len(delivered) == 1
        second_message = json.loads(delivered.pop().read_text())
        assert (second_message["recipient"], second_message["kind"]) == (email, "otp")
        second_code = second_message["value"]
        assert (
            second_verified.post(
                "/api/v1/auth/otp/verify",
                headers=second_headers,
                json={"code": second_code},
            ).status_code
            == 200
        )
        with Session(auth.engine) as db, db.begin():
            otp = db.get(OTP, identifier, with_for_update=True)
            assert otp
            otp.sent_at = auth.now(db) - timedelta(seconds=61)
        pending_headers = headers(pending)
        before_delivery = set(auth_env.mailbox.glob("*.json"))
        assert (
            pending.post(
                "/api/v1/auth/login",
                headers=pending_headers,
                json={"email": email, "password": PASSWORD},
            ).status_code
            == 202
        )
        delivered = set(auth_env.mailbox.glob("*.json")) - before_delivery
        assert len(delivered) == 1
        pending_message = json.loads(delivered.pop().read_text())
        assert (pending_message["recipient"], pending_message["kind"]) == (email, "otp")
        pending_code = pending_message["value"]
        with Session(auth.engine) as db:
            otp = db.get(OTP, identifier)
            assert otp
            otp_facts = (otp.attempts, otp.resends, otp.expires_at)
        request(client, email)
        proof = recovery_proof(auth_env.mailbox, email)
        assert (
            client.post(
                "/api/v1/auth/password-reset/complete",
                headers=headers(client),
                json={
                    **proof,
                    "password": NEW_PASSWORD,
                    "confirmation": NEW_PASSWORD,
                },
            ).status_code
            == 200
        )
        assert client.get("/api/v1/auth/session").status_code == 401
        assert second_verified.get("/api/v1/auth/session").status_code == 401
        assert (
            pending.post(
                "/api/v1/auth/otp/verify",
                headers=pending_headers,
                json={"code": pending_code},
            ).status_code
            == 401
        )
        assert (
            pending.post(
                "/api/v1/auth/otp/resend", headers=pending_headers, json={}
            ).status_code
            == 401
        )
        with Session(auth.engine) as db:
            otp = db.get(OTP, identifier)
            user = db.get(User, identifier)
            assert otp and user
            assert (otp.attempts, otp.resends, otp.expires_at) == otp_facts
            contexts = list(
                db.scalars(select(Context).where(Context.user_id == identifier))
            )
            assert len(contexts) >= 3
            assert all(context.proof != auth.user_proof(user) for context in contexts)
    finally:
        second_verified.close()
        pending.close()


def test_openapi_has_exact_recovery_operations(admin):
    paths = admin.app.openapi()["paths"]
    recovery = sorted(path for path in paths if "/password-reset/" in path)
    assert recovery == [
        "/api/v1/auth/password-reset/complete",
        "/api/v1/auth/password-reset/inspect",
        "/api/v1/auth/password-reset/requests",
    ]
    assert all(set(paths[path]) == {"post"} for path in recovery)


def test_real_http_returns_before_background_mail_finishes(ordinary, monkeypatch):
    client, email, _ = ordinary
    enable_recovery(client)
    entered, release = Event(), Event()
    original = client.app.state.auth.mail.send

    def blocked(recipient, kind, value):
        if kind == "password_recovery":
            entered.set()
            assert release.wait(5)
        return original(recipient, kind, value)

    monkeypatch.setattr(client.app.state.auth.mail, "send", blocked)
    sock = socket()
    sock.bind(("127.0.0.1", 0))
    port = sock.getsockname()[1]
    sock.close()
    server = uvicorn.Server(
        uvicorn.Config(client.app, host="127.0.0.1", port=port, lifespan="off")
    )
    thread = Thread(target=server.run, daemon=True)
    thread.start()
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}") as real:
            session = real.get("/api/v1/auth/session", headers={"Host": "localhost"})
            response = real.post(
                "/api/v1/auth/password-reset/requests",
                headers={
                    "Host": "localhost",
                    "Origin": "http://localhost",
                    "X-CSRF-Token": session.json()["csrf"],
                },
                json={"email": email},
            )
            assert response.status_code == 202
            assert entered.wait(2)
            assert not release.is_set()
    finally:
        release.set()
        server.should_exit = True
        thread.join(5)


def test_delivery_failure_preserves_unusable_proof_until_expiry(
    ordinary, auth_env, monkeypatch
):
    client, email, _ = ordinary
    enable_recovery(client)
    original = client.app.state.auth.mail.send

    def fail(recipient, kind, value):
        if kind == "password_recovery":
            raise OSError("synthetic mail failure")
        return original(recipient, kind, value)

    monkeypatch.setattr(client.app.state.auth.mail, "send", fail)
    assert request(client, email).status_code == 202
    with Session(client.app.state.auth.engine) as db:
        recovery = db.scalar(select(Recovery))
        assert recovery and recovery.state == "prepared"
        selector, verifier, expiry = recovery.id, recovery.verifier, recovery.expires_at
    count = len(messages(auth_env.mailbox))
    assert request(client, email).status_code == 202
    assert len(messages(auth_env.mailbox)) == count
    with Session(client.app.state.auth.engine) as db:
        recovery = db.get(Recovery, selector)
        assert recovery
        assert (recovery.verifier, recovery.expires_at) == (verifier, expiry)


def test_preparation_audit_failure_rolls_back_before_mail(
    ordinary, auth_env, monkeypatch
):
    client, email, _ = ordinary
    enable_recovery(client)
    auth = client.app.state.auth
    original = auth.audit

    def fail_prepare(db, action, actor, target, outcome="ok", details=None):
        if action == "recovery_prepare":
            raise RuntimeError("synthetic preparation audit failure")
        return original(db, action, actor, target, outcome, details)

    monkeypatch.setattr(auth, "audit", fail_prepare)
    before = len(messages(auth_env.mailbox))
    auth.request_recovery(email, "synthetic-preparation-failure")
    assert len(messages(auth_env.mailbox)) == before
    with Session(auth.engine) as db:
        assert db.scalar(select(Recovery)) is None


def test_task_loss_before_preparation_allows_limited_retry(
    ordinary, auth_env, monkeypatch
):
    client, email, _ = ordinary
    enable_recovery(client)
    auth = client.app.state.auth
    original = auth.prepare_recovery
    attempts = 0

    def lose_once(target):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            raise RuntimeError("synthetic task loss")
        return original(target)

    monkeypatch.setattr(auth, "prepare_recovery", lose_once)
    before = len(messages(auth_env.mailbox))
    assert request(client, email).status_code == 202
    assert len(messages(auth_env.mailbox)) == before
    assert request(client, email).status_code == 202
    assert len(messages(auth_env.mailbox)) == before + 1


def test_task_loss_after_preparation_preserves_unusable_proof(ordinary, auth_env):
    client, email, _ = ordinary
    enable_recovery(client)
    auth = client.app.state.auth
    delivery = auth.prepare_recovery(email)
    assert delivery
    with Session(auth.engine) as db:
        recovery = db.get(Recovery, delivery[1])
        assert recovery
        facts = (recovery.generation, recovery.verifier, recovery.expires_at)
    before = len(messages(auth_env.mailbox))
    assert request(client, email).status_code == 202
    assert len(messages(auth_env.mailbox)) == before
    with Session(auth.engine) as db:
        recovery = db.get(Recovery, delivery[1])
        assert recovery and recovery.state == "prepared"
        assert (recovery.generation, recovery.verifier, recovery.expires_at) == facts


def test_delivery_audit_failure_leaves_sent_proof_unusable(
    ordinary, auth_env, monkeypatch
):
    client, email, _ = ordinary
    enable_recovery(client)
    auth = client.app.state.auth
    original = auth.audit

    def fail_delivery(db, action, actor, target, outcome="ok", details=None):
        if action == "recovery_delivery":
            raise RuntimeError("synthetic delivery audit failure")
        return original(db, action, actor, target, outcome, details)

    monkeypatch.setattr(auth, "audit", fail_delivery)
    assert request(client, email).status_code == 202
    proof = recovery_proof(auth_env.mailbox, email)
    with Session(auth.engine) as db:
        recovery = db.get(Recovery, proof["selector"])
        assert recovery and recovery.state == "prepared"
    response = client.post(
        "/api/v1/auth/password-reset/inspect",
        headers=headers(client),
        json=proof,
    )
    assert response.status_code == 400
    assert response.json()["code"] == "recovery_invalid"


def test_expired_preparation_is_replaced_and_late_delivery_is_ignored(ordinary):
    client, email, _ = ordinary
    enable_recovery(client)
    auth = client.app.state.auth
    first = auth.prepare_recovery(email)
    assert first
    with Session(auth.engine) as db, db.begin():
        recovery = db.get(Recovery, first[1], with_for_update=True)
        assert recovery
        db.execute(
            text(
                "UPDATE auth_recovery "
                "SET expires_at = clock_timestamp() - interval '1 second' "
                "WHERE id = :selector"
            ),
            {"selector": first[1]},
        )
    second = auth.prepare_recovery(email)
    assert second and second[1] != first[1] and second[2] != first[2]
    auth.deliver_recovery(*first)
    with Session(auth.engine) as db:
        current = db.get(Recovery, second[1])
        assert current and current.state == "prepared"
        assert db.get(Recovery, first[1]) is None
    auth.deliver_recovery(*second)
    with Session(auth.engine) as db:
        current = db.get(Recovery, second[1])
        assert current and current.state == "delivered"


def test_direct_request_throttle_is_neutral_and_counts_unknown(
    admin, auth_env, monkeypatch
):
    enable_recovery(admin)
    scheduled = []
    monkeypatch.setattr(
        admin.app.state.auth,
        "request_recovery",
        lambda email, correlation_id: scheduled.append(email),
    )
    responses = [request(admin, "unknown@example.test") for _ in range(4)]
    assert all(response.status_code == 202 for response in responses)
    assert all(
        response.json() == {"state": "request_received"} for response in responses
    )
    assert scheduled == ["unknown@example.test"] * 3
    assert not any(
        item["kind"] == "password_recovery" for item in messages(auth_env.mailbox)
    )
    with Session(admin.app.state.auth.engine) as db:
        auth = admin.app.state.auth
        assert db.get(Abuse, auth.keyed("recovery-ip:testclient")).count == 4
        assert (
            db.get(Abuse, auth.keyed("recovery-email:unknown@example.test")).count == 4
        )


@pytest.mark.parametrize(
    ("change", "value"),
    [
        ("state", "inactive"),
        ("state", "pending"),
        ("role", "AGENT_VERIFICATEUR"),
        ("role", "ADMIN_PLATEFORME"),
    ],
)
def test_account_security_change_invalidates_recovery_proof(
    ordinary, auth_env, change, value
):
    client, email, identifier = ordinary
    enable_recovery(client)
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    auth = client.app.state.auth
    with Session(auth.engine) as db, db.begin():
        db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
        user = db.get(User, identifier, with_for_update=True)
        assert user
        setattr(user, change, value)
        user.version += 1
    fresh = TestClient(client.app, base_url="http://localhost")
    try:
        inspection = fresh.post(
            "/api/v1/auth/password-reset/inspect",
            headers=headers(fresh),
            json=proof,
        )
        response = fresh.post(
            "/api/v1/auth/password-reset/complete",
            headers=headers(fresh),
            json={**proof, "password": NEW_PASSWORD, "confirmation": NEW_PASSWORD},
        )
    finally:
        fresh.close()
    assert inspection.status_code == 400
    assert inspection.json()["code"] == "recovery_invalid"
    assert response.status_code == 400
    assert response.json()["code"] == "recovery_invalid"
    with Session(auth.engine) as db:
        user = db.get(User, identifier)
        recovery = db.get(Recovery, proof["selector"])
        assert user and auth.hasher.verify(user.password_hash, PASSWORD)
        assert recovery and recovery.state == "delivered"


@pytest.mark.parametrize("failure", ["mail", "audit"])
def test_notification_failure_does_not_reverse_reset(
    ordinary, auth_env, monkeypatch, failure
):
    client, email, identifier = ordinary
    enable_recovery(client)
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    original = client.app.state.auth.mail.send

    def fail_notice(recipient, kind, value):
        if kind == "password_reset_notice":
            raise OSError("synthetic notice failure")
        return original(recipient, kind, value)

    auth = client.app.state.auth
    if failure == "mail":
        monkeypatch.setattr(auth.mail, "send", fail_notice)
    else:
        original_audit = auth.audit

        def fail_notice_audit(db, action, actor, target, outcome="ok", details=None):
            if action == "recovery_notification":
                raise RuntimeError("synthetic notice audit failure")
            return original_audit(db, action, actor, target, outcome, details)

        monkeypatch.setattr(auth, "audit", fail_notice_audit)
    response = client.post(
        "/api/v1/auth/password-reset/complete",
        headers=headers(client),
        json={**proof, "password": NEW_PASSWORD, "confirmation": NEW_PASSWORD},
    )
    assert response.status_code == 200
    with Session(client.app.state.auth.engine) as db:
        user = db.get(User, identifier)
        recovery = db.get(Recovery, proof["selector"])
        notice = db.scalar(select(Audit).where(Audit.action == "recovery_notification"))
        assert user and client.app.state.auth.hasher.verify(
            user.password_hash, NEW_PASSWORD
        )
        assert recovery and recovery.state == "consumed"
        if failure == "mail":
            assert notice and notice.outcome == "failed"
        else:
            assert notice is None


def test_notification_task_loss_does_not_reverse_reset(ordinary, auth_env):
    client, email, identifier = ordinary
    enable_recovery(client)
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    auth = client.app.state.auth
    before = len(messages(auth_env.mailbox))
    completed_user, completed_email = auth.complete_recovery(
        proof["selector"], proof["verifier"], NEW_PASSWORD, NEW_PASSWORD
    )
    assert (completed_user, completed_email) == (identifier, email)
    assert len(messages(auth_env.mailbox)) == before
    with Session(auth.engine) as db:
        user = db.get(User, identifier)
        recovery = db.get(Recovery, proof["selector"])
        notice = db.scalar(select(Audit).where(Audit.action == "recovery_notification"))
        assert user and auth.hasher.verify(user.password_hash, NEW_PASSWORD)
        assert recovery and recovery.state == "consumed"
        assert notice is None


def test_complete_audit_failure_rolls_back_password_and_consumption(
    ordinary, auth_env, monkeypatch
):
    client, email, identifier = ordinary
    enable_recovery(client)
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    auth = client.app.state.auth
    original = auth.audit

    def fail_complete(db, action, actor, target, outcome="ok", details=None):
        if action == "recovery_complete":
            raise RuntimeError("synthetic audit failure")
        return original(db, action, actor, target, outcome, details)

    monkeypatch.setattr(auth, "audit", fail_complete)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        auth.complete_recovery(
            proof["selector"], proof["verifier"], NEW_PASSWORD, NEW_PASSWORD
        )
    with Session(auth.engine) as db:
        user = db.get(User, identifier)
        recovery = db.get(Recovery, proof["selector"])
        assert user and auth.hasher.verify(user.password_hash, PASSWORD)
        assert recovery and recovery.state == "delivered"


def test_complete_commit_failure_rolls_back_password_and_consumption(
    ordinary, auth_env
):
    client, email, identifier = ordinary
    enable_recovery(client)
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    auth = client.app.state.auth
    raised = False

    def fail_before_commit(session):
        nonlocal raised
        if not raised and session.bind is auth.engine:
            raised = True
            raise RuntimeError("synthetic commit failure")

    event.listen(Session, "before_commit", fail_before_commit)
    try:
        with pytest.raises(RuntimeError, match="synthetic commit failure"):
            auth.complete_recovery(
                proof["selector"], proof["verifier"], NEW_PASSWORD, NEW_PASSWORD
            )
    finally:
        event.remove(Session, "before_commit", fail_before_commit)
    with Session(auth.engine) as db:
        user = db.get(User, identifier)
        recovery = db.get(Recovery, proof["selector"])
        assert user and auth.hasher.verify(user.password_hash, PASSWORD)
        assert recovery and recovery.state == "delivered"
        assert not db.scalar(
            select(Audit.id).where(
                Audit.action == "recovery_complete", Audit.target == identifier
            )
        )


def test_recovery_takes_advisory_lock_before_rows(ordinary, auth_env):
    from sqlalchemy import event

    client, email, _ = ordinary
    enable_recovery(client)
    request(client, email)
    proof = recovery_proof(auth_env.mailbox, email)
    auth = client.app.state.auth
    seen = []

    def record(conn, cursor, statement, parameters, context, executemany):
        seen.append(statement)

    event.listen(auth.engine, "before_cursor_execute", record)
    try:
        with pytest.raises(AuthError):
            auth.complete_recovery(
                proof["selector"], "wrong", NEW_PASSWORD, NEW_PASSWORD
            )
    finally:
        event.remove(auth.engine, "before_cursor_execute", record)
    assert "pg_advisory_xact_lock(1843201)" in seen[0]
