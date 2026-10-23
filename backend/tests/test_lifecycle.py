"""Restricted A2.2: disposable auth-only databases, never shared identities."""

from concurrent.futures import ThreadPoolExecutor
from itertools import permutations
from threading import Event

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, select, text
from sqlalchemy.orm import Session
from test_access import PASSWORD, activate, headers
from test_access import admin as admin_fixture

from app.auth.models import User
from app.auth.service import AuthError

admin = admin_fixture


def test_login_takes_advisory_before_any_row_lock(admin):
    auth = admin.app.state.auth
    seen = []

    def record(conn, cursor, statement, parameters, context, executemany):
        seen.append(statement)

    event.listen(auth.engine, "before_cursor_execute", record)
    try:
        with pytest.raises(AuthError):
            auth.login(None, None, "nobody@example.test", PASSWORD, "test")
    finally:
        event.remove(auth.engine, "before_cursor_execute", record)
    assert "pg_advisory_xact_lock(1843201)" in seen[0]


def test_eligibility_requires_verified_database(admin, auth_env):
    auth = admin.app.state.auth
    with Session(auth.engine) as db, db.begin():
        with pytest.raises(AuthError, match="eligibility_unverified"):
            auth.lifecycle_eligible(db)
    auth.policy = auth.policy.model_copy(
        update={"lifecycle_database": auth.engine.url.database}
    )
    auth.provision_context("test-operator", "PTA-1 lifecycle verification")
    with Session(auth.engine) as db, db.begin():
        auth.lifecycle_eligible(db)
        db.execute(text("CREATE SCHEMA unexpected"))
        db.execute(text("CREATE TABLE unexpected.obligation (id integer)"))
        with pytest.raises(AuthError, match="eligibility_unverified"):
            auth.lifecycle_eligible(db)


@pytest.fixture
def ordinary(admin, auth_env):
    assert (
        admin.post(
            "/api/v1/access/invitations",
            headers=headers(admin),
            json={"email": "ordinary@example.test", "role": "AGENT_SAISIE"},
        ).status_code
        == 201
    )
    with TestClient(admin.app, base_url="http://localhost") as client:
        activate(client, auth_env.mailbox, "ordinary@example.test")
        yield client


def test_login_waits_before_rows_against_lifecycle_order(admin, ordinary):
    """Prerequisite: intended mutation transaction, before PATCH is exposed."""
    auth = admin.app.state.auth
    # Pending ordinary context can submit another identity's credentials.
    with Session(auth.engine) as db, db.begin():
        user = db.scalar(select(User).where(User.email == "ordinary@example.test"))
        context, secret = auth.new_context(db, user)
        context.state = "pending"
        csrf = auth.csrf_token(context.id)
        target_id = user.id
    entered = Event()
    statements = []

    def before(conn, cursor, statement, parameters, context, executemany):
        if context.execution_options.get("race_login"):
            statements.append(statement)
            if "pg_advisory_xact_lock" in statement:
                entered.set()

    # All connections have bounded waits; identify the worker by its connection.
    def worker():
        with auth.engine.connect().execution_options(race_login=True) as connection:
            connection.execute(text("SET statement_timeout = '5s'"))
            connection.commit()
            original = auth.engine
            # Bind only this call to the independently checked-out connection.
            from app.auth.service import AuthService

            service = AuthService(original, auth.policy)
            service.engine = connection
            try:
                service.login(secret, csrf, "admin@example.test", PASSWORD, "race")
            except AuthError as error:
                assert error.code in {"otp_cooldown", "session_expired"}

    event.listen(auth.engine, "before_cursor_execute", before)
    try:
        with ThreadPoolExecutor(max_workers=1) as pool:
            with Session(auth.engine) as db, db.begin():
                db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
                db.get(User, target_id, with_for_update=True)
                future = pool.submit(worker)
                assert entered.wait(3)
                assert not future.done()
                assert not any(
                    "auth_context" in s or "auth_user" in s or "auth_abuse" in s
                    for s in statements
                )
            future.result(timeout=7)
    finally:
        event.remove(auth.engine, "before_cursor_execute", before)


@pytest.mark.parametrize(
    "ddl",
    [
        "UPDATE alembic_version SET version_num='future'",
        "INSERT INTO alembic_version VALUES ('other')",
        "DELETE FROM alembic_version",
        "DROP TABLE alembic_version",
        "CREATE VIEW unexpected AS SELECT 1 AS id",
        "CREATE MATERIALIZED VIEW unexpected AS SELECT 1 AS id",
        "CREATE TABLE unexpected (id integer) PARTITION BY RANGE(id)",
        "ALTER TABLE auth_abuse RENAME TO missing",
    ],
)
def test_guard_rejects_unknown_schema(admin, ddl):
    auth = admin.app.state.auth
    auth.policy = auth.policy.model_copy(
        update={"lifecycle_database": auth.engine.url.database}
    )
    auth.provision_context("test-operator", "PTA-1 schema negative")
    with Session(auth.engine) as db, db.begin():
        db.execute(text(ddl))
        with pytest.raises(AuthError, match="eligibility_unverified"):
            auth.lifecycle_eligible(db)


def target(admin):
    return next(
        u
        for u in admin.get("/api/v1/access/users").json()["items"]
        if u["email"] == "ordinary@example.test"
    )


def change(admin, item, **action):
    return admin.patch(
        "/api/v1/access/users/" + item["id"],
        headers=headers(admin),
        json={"expected_version": item["version"], **action},
    )


def enable(admin):
    # auth_env creates an empty random child DB and migrates it, with no imports.
    auth = admin.app.state.auth
    auth.policy = auth.policy.model_copy(
        update={"lifecycle_database": auth.engine.url.database}
    )
    auth.provision_context("test-operator", "PTA-1 lifecycle tests")


def test_role_change_and_deactivation_revoke_contexts(admin, ordinary):
    enable(admin)
    item = target(admin)
    old_cookie = ordinary.cookies.get("mjl_local")
    response = change(admin, item, role="VALIDATEUR_DEFINITIF")
    assert response.status_code == 200, response.text
    updated = response.json()
    assert updated == {
        **item,
        "role": "VALIDATEUR_DEFINITIF",
        "version": item["version"] + 1,
    }
    assert ordinary.get("/api/v1/auth/session").status_code == 401
    assert change(admin, item, deactivate=True).status_code == 409
    assert change(admin, updated, role="VALIDATEUR_DEFINITIF").json() == updated
    back = change(admin, updated, role="AGENT_SAISIE").json()
    ordinary.cookies.set("mjl_local", old_cookie)
    assert ordinary.get("/api/v1/auth/session").status_code == 401
    response = change(admin, back, deactivate=True)
    assert response.status_code == 200
    assert response.json()["state"] == "inactive"
    assert change(admin, response.json(), deactivate=True).status_code == 409


@pytest.mark.parametrize(
    "other,role",
    list(
        permutations(["AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"], 2)
    ),
)
def test_each_role_exclusive_and_nonadmin_denied(admin, ordinary, other, role):
    enable(admin)
    item = target(admin)
    item = change(admin, item, role=other).json()
    result = change(admin, item, role=role)
    assert result.status_code == 200
    assert result.json()["role"] == role
    assert result.json()["version"] == item["version"] + 1
    auth = admin.app.state.auth
    with Session(auth.engine) as db, db.begin():
        user = db.get(User, item["id"])
        _, secret = auth.new_context(db, user)
    ordinary.cookies.clear()
    ordinary.cookies.set("mjl_local", secret)
    assert change(ordinary, result.json(), deactivate=True).status_code == 403


@pytest.mark.parametrize("actor", ["anonymous", "pending", "expired", "inactive"])
def test_unverified_actor_denied(admin, ordinary, actor):
    enable(admin)
    item = target(admin)
    auth = admin.app.state.auth
    with Session(auth.engine) as db, db.begin():
        user = db.scalar(select(User).where(User.role == "ADMIN_PLATEFORME"))
        context, secret = auth.new_context(db, user if actor != "anonymous" else None)
        csrf = auth.csrf_token(context.id)
        if actor == "pending":
            context.state = "pending"
        if actor == "expired":
            context.expires_at = auth.now(db)
        if actor == "inactive":
            user.state = "inactive"
    with TestClient(admin.app, base_url="http://localhost") as client:
        client.cookies.set("mjl_local", secret)
        r = client.patch(
            "/api/v1/access/users/" + item["id"],
            headers={"Origin": "http://localhost", "X-CSRF-Token": csrf},
            json={"expected_version": item["version"], "deactivate": True},
        )
        assert r.status_code == 401
    with Session(auth.engine) as db:
        assert db.get(User, item["id"]).state == "active"


@pytest.mark.parametrize(
    "payload",
    [
        {"role": "ADMIN_PLATEFORME"},
        {"role": "AGENT_SAISIE", "deactivate": True},
        {"deactivate": False},
        {"deactivate": 1},
        {"deactivate": "true"},
        {},
        {"role": "AGENT_SAISIE", "unassigned": True},
        {"role": "AGENT_SAISIE", "expected_version": True},
    ],
)
def test_invalid_lifecycle_payload(admin, ordinary, payload):
    enable(admin)
    item = target(admin)
    assert change(admin, item, **payload).status_code == 422
    assert target(admin) == item


def test_forbidden_targets_states_and_request_guards(admin, ordinary):
    enable(admin)
    item = target(admin)
    users = admin.get("/api/v1/access/users").json()["items"]
    operator = next(u for u in users if u["role"] == "ADMIN_PLATEFORME")
    assert change(admin, operator, deactivate=True).status_code == 403
    assert change(admin, {**item, "id": "missing"}, deactivate=True).status_code == 404
    h = headers(admin)
    for bad in (
        {**h, "X-CSRF-Token": "bad"},
        {**h, "Origin": "http://foreign"},
        {**h, "Host": "foreign"},
    ):
        assert (
            admin.patch(
                "/api/v1/access/users/" + item["id"],
                headers=bad,
                json={"expected_version": item["version"], "deactivate": True},
            ).status_code
            == 403
        )
    with admin.app.state.auth.engine.begin() as db:
        db.execute(
            text("UPDATE auth_user SET state='pending' WHERE id=:id"),
            {"id": item["id"]},
        )
    assert change(admin, item, deactivate=True).status_code == 409


@pytest.mark.parametrize(
    "drift",
    [
        "unknown",
        "multiple",
        "missing",
        "other_schema",
        "view",
        "foreign",
        "missing_table",
        "unbound",
        "wrong_binding",
        "read_failure",
    ],
)
def test_patch_eligibility_denial_is_atomic(admin, ordinary, drift):
    from sqlalchemy.exc import OperationalError

    enable(admin)
    item = target(admin)
    auth = admin.app.state.auth
    h = headers(admin)
    if drift in {"unbound", "wrong_binding"}:
        auth.policy = auth.policy.model_copy(
            update={
                "lifecycle_database": None if drift == "unbound" else "mjl_test_other"
            }
        )
    elif drift != "read_failure":
        with auth.engine.begin() as db:
            statements = {
                "unknown": ["UPDATE alembic_version SET version_num='future'"],
                "multiple": ["INSERT INTO alembic_version VALUES ('future')"],
                "missing": ["DELETE FROM alembic_version"],
                "other_schema": [
                    "CREATE SCHEMA other",
                    "CREATE TABLE other.obligation (id integer)",
                ],
                "view": ["CREATE VIEW unexpected AS SELECT 1 AS id"],
                "foreign": [
                    "CREATE EXTENSION postgres_fdw",
                    "CREATE SERVER external FOREIGN DATA WRAPPER postgres_fdw",
                    "CREATE FOREIGN TABLE external_obligation (id integer) "
                    "SERVER external",
                ],
                "missing_table": ["DROP TABLE alembic_version"],
            }[drift]
            for stmt in statements:
                db.execute(text(stmt))

    def fail(conn, cursor, statement, parameters, context, executemany):
        if "pg_catalog.pg_class" in statement:
            raise OperationalError("catalog", {}, Exception("synthetic read failure"))

    if drift == "read_failure":
        event.listen(auth.engine, "before_cursor_execute", fail)
    try:
        for action in ({"deactivate": True}, {"role": "VALIDATEUR_DEFINITIF"}):
            r = admin.patch(
                "/api/v1/access/users/" + item["id"],
                headers=h,
                json={"expected_version": item["version"], **action},
            )
            assert r.status_code == (503 if drift == "read_failure" else 409), r.text
    finally:
        if drift == "read_failure":
            event.remove(auth.engine, "before_cursor_execute", fail)
    assert target(admin) == item
    with auth.engine.connect() as db:
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM auth_audit WHERE action IN "
                    "('account_role_change','account_deactivate')"
                )
            )
            == 0
        )


@pytest.mark.parametrize(
    "invitation_state", ["prepared", "delivered", "consumed", "revoked"]
)
def test_deactivate_invitation_history_and_audit(admin, ordinary, invitation_state):
    from app.auth.models import Audit, Invitation

    enable(admin)
    auth = admin.app.state.auth
    item = target(admin)
    with Session(auth.engine) as db, db.begin():
        inv = db.scalar(select(Invitation).where(Invitation.user_id == item["id"]))
        inv.state = invitation_state
        version = inv.version
        before = db.scalars(select(Audit.id)).all()
    result = change(admin, item, deactivate=True)
    assert result.status_code == 200
    with Session(auth.engine) as db:
        inv = db.scalar(select(Invitation).where(Invitation.user_id == item["id"]))
        revoked = invitation_state in {"prepared", "delivered"}
        assert inv.state == ("revoked" if revoked else invitation_state)
        assert inv.version == version + int(revoked)
        record = db.scalar(select(Audit).where(Audit.action == "account_deactivate"))
        assert record.target == item["id"] and record.actor != item["id"]
        assert record.details["before_role"] == record.details["role"] == item["role"]
        assert (
            record.details["before_user_state"] == "active"
            and record.details["user_state"] == "inactive"
        )
        assert (
            record.details["before_user_version"] == item["version"]
            and record.details["user_version"] == item["version"] + 1
        )
        assert set(before) <= set(db.scalars(select(Audit.id)).all())
    assert (
        admin.post(
            "/api/v1/access/invitations",
            headers=headers(admin),
            json={"email": item["email"], "role": item["role"]},
        ).status_code
        == 409
    )


@pytest.mark.parametrize("failure", ["mutation", "audit", "commit"])
def test_lifecycle_failure_rolls_back(admin, ordinary, auth_env, failure):
    from sqlalchemy.exc import OperationalError
    from test_auth import messages

    enable(admin)
    auth = admin.app.state.auth
    item = target(admin)
    h = headers(admin)
    mail_count = len(messages(auth_env.mailbox))
    with auth.engine.begin() as db:
        db.execute(
            text("UPDATE auth_invitation SET state='delivered' WHERE user_id=:id"),
            {"id": item["id"]},
        )
        invitation_before = db.execute(
            text("SELECT state,version FROM auth_invitation WHERE user_id=:id"),
            {"id": item["id"]},
        ).one()

    def fail(conn, cursor, stmt, params, context, many):
        if (failure == "mutation" and stmt.startswith("UPDATE auth_user")) or (
            failure == "audit"
            and stmt.startswith("INSERT INTO auth_audit")
            and params.get("action") == "account_deactivate"
        ):
            raise OperationalError("write", {}, Exception("synthetic"))

    def fail_commit(conn):
        if conn.scalar(
            text("SELECT count(*) FROM auth_audit WHERE action='account_deactivate'")
        ):
            raise OperationalError("commit", {}, Exception("synthetic"))

    event.listen(
        auth.engine, "commit", fail_commit
    ) if failure == "commit" else event.listen(
        auth.engine, "before_cursor_execute", fail
    )
    try:
        r = admin.patch(
            "/api/v1/access/users/" + item["id"],
            headers=h,
            json={"expected_version": item["version"], "deactivate": True},
        )
        assert r.status_code == 503
    finally:
        event.remove(
            auth.engine, "commit", fail_commit
        ) if failure == "commit" else event.remove(
            auth.engine, "before_cursor_execute", fail
        )
    assert target(admin) == item
    assert len(messages(auth_env.mailbox)) == mail_count
    with auth.engine.connect() as db:
        assert (
            db.execute(
                text("SELECT state,version FROM auth_invitation WHERE user_id=:id"),
                {"id": item["id"]},
            ).one()
            == invitation_before
        )
    with auth.engine.connect() as db:
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM auth_audit WHERE action='account_deactivate'"
                )
            )
            == 0
        )


def test_lifecycle_openapi(admin):
    from openapi_spec_validator import validate_spec

    spec = admin.get("/openapi.json").json()
    validate_spec(spec)
    op = spec["paths"]["/api/v1/access/users/{identifier}"]["patch"]
    assert len(op["requestBody"]["content"]["application/json"]["schema"]["anyOf"]) == 2
    assert op["security"]
    assert {"Origin", "X-CSRF-Token"} <= {p["name"] for p in op["parameters"]}
    assert {"200", "401", "403", "404", "409", "422", "503"} <= set(op["responses"])
    assert not any("reactivate" in p or "recover" in p for p in spec["paths"])


@pytest.mark.parametrize(
    "action", [{"deactivate": True}, {"role": "VALIDATEUR_DEFINITIF"}]
)
@pytest.mark.parametrize(
    "auth_path", ["login", "cross_login", "verify", "resend", "session"]
)
@pytest.mark.parametrize("first", ["auth", "mutation"])
def test_authentication_lifecycle_serializes(
    admin, ordinary, action, auth_path, first, monkeypatch
):
    from datetime import timedelta

    from app.auth.models import OTP

    enable(admin)
    auth = admin.app.state.auth

    def bounded(dbapi_connection, connection_record, connection_proxy):
        with dbapi_connection.cursor() as cursor:
            cursor.execute("SET statement_timeout = '8s'")
            cursor.execute("SET lock_timeout = '5s'")

    event.listen(auth.engine, "checkout", bounded)
    item = target(admin)
    h = headers(admin)
    # A second verified cookie and pending proof exercise all-context invalidation.
    with Session(auth.engine) as db, db.begin():
        user = db.get(User, item["id"])
        _, verified = auth.new_context(db, user)
        context, secret = auth.new_context(db, user if auth_path != "login" else None)
        csrf = auth.csrf_token(context.id)
        if auth_path in {"verify", "resend", "cross_login"}:
            otp = db.get(OTP, user.id)
            code, generation = auth.prepare_otp(db, user, context, otp)
            otp.state = "delivered"
            otp.sent_at = auth.now(db) - timedelta(seconds=61)
        elif auth_path == "login":
            otp = db.get(OTP, user.id)
            otp.sent_at = auth.now(db) - timedelta(seconds=61)
            otp.state = "consumed"
    entered, release, attempted = Event(), Event(), Event()
    original_audit = auth.audit
    paused = False

    # Pause while the first operation owns the target User row; real DB locks
    # serialize the second operation. Hooks are synchronization, not fake writes.
    def pause_audit(db, name, *args, **kwargs):
        nonlocal paused
        desired = (
            name.startswith("account_")
            if first == "mutation"
            else name in {"otp_prepare", "otp_verify", "login"}
        )
        if desired and not paused:
            paused = True
            entered.set()
            assert release.wait(7)
        return original_audit(db, name, *args, **kwargs)

    def observe(conn, cursor, statement, parameters, context, many):
        if entered.is_set() and (
            "pg_advisory_xact_lock" in statement
            or ("auth_user" in statement and "FOR UPDATE" in statement)
        ):
            attempted.set()

    # Session has no success audit: pause after its User lock instead.
    def after(conn, cursor, statement, parameters, context, many):
        nonlocal paused
        if (
            first == "auth"
            and auth_path == "session"
            and not paused
            and "auth_user" in statement
            and "FOR UPDATE" in statement
        ):
            paused = True
            entered.set()
            assert release.wait(7)

    monkeypatch.setattr(auth, "audit", pause_audit)
    event.listen(auth.engine, "before_cursor_execute", observe)
    event.listen(auth.engine, "after_cursor_execute", after)

    def authenticate():
        try:
            if auth_path in {"login", "cross_login"}:
                return auth.login(
                    secret,
                    csrf,
                    "admin@example.test"
                    if auth_path == "cross_login"
                    else item["email"],
                    PASSWORD,
                    "race",
                )
            if auth_path in {"verify", "resend"}:
                return auth.otp(secret, csrf, code if auth_path == "verify" else None)
            return auth.session(secret)
        except AuthError as error:
            return error.code

    def mutate():
        return admin.patch(
            "/api/v1/access/users/" + item["id"],
            headers=h,
            json={"expected_version": item["version"], **action},
        )

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            a = pool.submit(authenticate if first == "auth" else mutate)
            try:
                assert entered.wait(5)
                b = pool.submit(mutate if first == "auth" else authenticate)
                assert attempted.wait(5)
                assert not b.done()
            finally:
                release.set()
            ra, rb = a.result(10), b.result(10)
        mutation, authentication = (rb, ra) if first == "auth" else (ra, rb)
        assert mutation.status_code == 200, mutation.text
        if first == "mutation":
            if auth_path == "login":
                assert authentication == (
                    "credentials_invalid"
                    if "deactivate" in action
                    else {"state": "pending", "email": "o***@example.test"}
                )
            else:
                assert authentication == "session_expired"
        else:
            assert (
                not isinstance(authentication, str) or authentication == "otp_cooldown"
            )
        for old in (secret, verified, ordinary.cookies.get("mjl_local")):
            # A new anonymous login begun after role-change is fresh, not obsolete.
            if old == secret and auth_path == "login" and first == "mutation":
                assert auth.session(old)[0]["state"] == (
                    "anonymous" if "deactivate" in action else "pending"
                )
                continue
            with pytest.raises(AuthError, match="session_expired"):
                auth.session(old)
        if auth_path == "verify" and first == "auth":
            with pytest.raises(AuthError, match="session_expired"):
                auth.session(authentication[1])
    finally:
        release.set()
        event.remove(auth.engine, "before_cursor_execute", observe)
        event.remove(auth.engine, "after_cursor_execute", after)
        event.remove(auth.engine, "checkout", bounded)


@pytest.mark.parametrize(
    "pair",
    [
        ({"role": "AGENT_VERIFICATEUR"}, {"role": "VALIDATEUR_DEFINITIF"}),
        ({"role": "VALIDATEUR_DEFINITIF"}, {"deactivate": True}),
        ({"deactivate": True}, {"role": "VALIDATEUR_DEFINITIF"}),
    ],
)
def test_concurrent_admin_writes_one_winner(admin, ordinary, pair, monkeypatch):
    enable(admin)
    item = target(admin)
    h = headers(admin)
    auth = admin.app.state.auth
    entered, release, attempted = Event(), Event(), Event()
    original = auth.audit

    def audit(db, name, *args, **kwargs):
        if name.startswith("account_") and not entered.is_set():
            entered.set()
            assert release.wait(5)
        return original(db, name, *args, **kwargs)

    monkeypatch.setattr(auth, "audit", audit)

    def run(action):
        return admin.patch(
            "/api/v1/access/users/" + item["id"],
            headers=h,
            json={"expected_version": item["version"], **action},
        )

    def observe(conn, cursor, statement, parameters, context, many):
        if entered.is_set() and "pg_advisory_xact_lock" in statement:
            attempted.set()

    def bounded(dbapi_connection, connection_record, connection_proxy):
        with dbapi_connection.cursor() as cursor:
            cursor.execute("SET statement_timeout = '8s'")
            cursor.execute("SET lock_timeout = '5s'")

    event.listen(auth.engine, "before_cursor_execute", observe)
    event.listen(auth.engine, "checkout", bounded)
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(run, pair[0])
            try:
                assert entered.wait(5)
                second = pool.submit(run, pair[1])
                assert attempted.wait(5)
                assert not second.done()
            finally:
                release.set()
            assert first.result(10).status_code == 200
            assert second.result(10).status_code == 409
    finally:
        release.set()
        event.remove(auth.engine, "before_cursor_execute", observe)
        event.remove(auth.engine, "checkout", bounded)
    assert target(admin)["version"] == item["version"] + 1
    with auth.engine.connect() as db:
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM auth_audit WHERE action IN "
                    "('account_deactivate','account_role_change')"
                )
            )
            == 1
        )


@pytest.mark.parametrize("fails", [False, True])
@pytest.mark.parametrize(
    "action", [{"deactivate": True}, {"role": "VALIDATEUR_DEFINITIF"}]
)
def test_late_otp_delivery_never_restores_authority(
    admin, ordinary, action, fails, monkeypatch
):
    from app.auth.models import OTP

    enable(admin)
    auth = admin.app.state.auth
    item = target(admin)
    with Session(auth.engine) as db, db.begin():
        user = db.get(User, item["id"])
        context, secret = auth.new_context(db, user)
        code, generation = auth.prepare_otp(db, user, context, db.get(OTP, user.id))
        csrf = auth.csrf_token(context.id)
    entered, release = Event(), Event()

    def send(*args):
        entered.set()
        assert release.wait(5)
        if fails:
            raise OSError("synthetic mail failure")

    monkeypatch.setattr(auth.mail, "send", send)
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            auth.deliver_otp, item["id"], item["email"], generation, code
        )
        try:
            assert entered.wait(5)
            assert change(admin, item, **action).status_code == 200
        finally:
            release.set()
        if fails:
            with pytest.raises(AuthError, match="otp_delivery_failed"):
                future.result(7)
        else:
            future.result(7)
    for supplied in (code, None):
        with pytest.raises(AuthError, match="session_expired"):
            auth.otp(secret, csrf, supplied)
