from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient
from test_auth import messages

from app.main import create_app

PASSWORD = "Synthetic!93"


def proof(mailbox, email):
    mail = [
        m
        for m in messages(mailbox)
        if m["recipient"] == email and m["kind"] == "invitation"
    ][-1]
    return {k: v[0] for k, v in parse_qs(urlsplit(mail["value"]).fragment).items()}


def headers(client):
    return {
        "Origin": "http://localhost",
        "X-CSRF-Token": client.get("/api/v1/auth/session").json()["csrf"],
    }


def activate(client, mailbox, email):
    h = headers(client)
    assert (
        client.post(
            "/api/v1/auth/invitations/accept",
            headers=h,
            json={
                **proof(mailbox, email),
                "password": PASSWORD,
                "confirmation": PASSWORD,
            },
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/login", headers=h, json={"email": email, "password": PASSWORD}
        ).status_code
        == 202
    )
    code = [
        m["value"]
        for m in messages(mailbox)
        if m["recipient"] == email and m["kind"] == "otp"
    ][-1]
    response = client.post("/api/v1/auth/otp/verify", headers=h, json={"code": code})
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def admin(auth_env):
    with TestClient(create_app(auth_env.url), base_url="http://localhost") as client:
        client.app.state.auth.bootstrap("admin@example.test", "test-operator")
        activate(client, auth_env.mailbox, "admin@example.test")
        yield client


def test_admin_invites_and_lists_ordinary_user(admin, auth_env):
    response = admin.post(
        "/api/v1/access/invitations",
        headers=headers(admin),
        json={"email": "agent@example.test", "role": "AGENT_SAISIE"},
    )
    assert response.status_code == 201, response.text
    item = response.json()
    assert item["state"] == "delivered" and item["version"] > 0
    users = admin.get("/api/v1/access/users").json()
    assert users["total"] == 2
    assert {u["email"] for u in users["items"]} == {
        "admin@example.test",
        "agent@example.test",
    }
    with TestClient(admin.app, base_url="http://localhost") as recipient:
        identity = activate(recipient, auth_env.mailbox, "agent@example.test")
        assert identity["user"]["role"] == "AGENT_SAISIE"
        assert recipient.get("/api/v1/access/users").status_code == 403


def test_resend_revoke_versions_and_late_delivery(admin, auth_env, monkeypatch):
    h = headers(admin)
    path = "/api/v1/access/invitations"
    item = admin.post(
        path, headers=h, json={"email": "pending@example.test", "role": "AGENT_SAISIE"}
    ).json()
    old = proof(auth_env.mailbox, "pending@example.test")
    result = admin.post(
        f"{path}/{item['id']}/resend",
        headers=h,
        json={"expected_version": item["version"]},
    )
    assert result.status_code == 200
    renewed = result.json()
    assert renewed["version"] > item["version"]
    assert (
        admin.post("/api/v1/auth/invitations/inspect", headers=h, json=old).status_code
        == 400
    )
    assert (
        admin.post(
            f"{path}/{item['id']}/revoke",
            headers=h,
            json={"expected_version": item["version"]},
        ).status_code
        == 409
    )
    response = admin.post(
        f"{path}/{item['id']}/revoke",
        headers=h,
        json={"expected_version": renewed["version"]},
    )
    assert response.status_code == 200 and response.json()["state"] == "revoked"
    assert (
        admin.post(
            f"{path}/{item['id']}/revoke",
            headers=h,
            json={"expected_version": renewed["version"]},
        ).json()
        == response.json()
    )
    assert (
        admin.post(
            f"{path}/{item['id']}/resend",
            headers=h,
            json={"expected_version": response.json()["version"]},
        ).status_code
        == 409
    )


@pytest.mark.parametrize(
    "role", ["AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"]
)
def test_each_business_role_accepts_and_authenticates_but_cannot_admin(
    admin, auth_env, role
):
    email = "ordinary@example.test"
    invitation = admin.post(
        "/api/v1/access/invitations",
        headers=headers(admin),
        json={"email": email, "role": role},
    ).json()
    with TestClient(admin.app, base_url="http://localhost") as recipient:
        h = headers(recipient)
        body = {
            **proof(auth_env.mailbox, email),
            "password": PASSWORD,
            "confirmation": PASSWORD,
            "role": "ADMIN_PLATEFORME",
        }
        assert (
            recipient.post(
                "/api/v1/auth/invitations/accept", headers=h, json=body
            ).status_code
            == 422
        )
        assert activate(recipient, auth_env.mailbox, email)["user"]["role"] == role
        assert_denied_endpoints(recipient, 403, invitation["id"])


def assert_denied_endpoints(client, status, identifier="missing"):
    h = (
        headers(client)
        if status != 401
        else {"Origin": "http://localhost", "X-CSRF-Token": "invalid"}
    )
    requests = [
        ("GET", "users", None),
        ("GET", "invitations", None),
        (
            "POST",
            "invitations",
            {"email": "forbidden@example.test", "role": "AGENT_SAISIE"},
        ),
        ("POST", f"invitations/{identifier}/resend", {"expected_version": 1}),
        ("POST", f"invitations/{identifier}/revoke", {"expected_version": 1}),
    ]
    for method, path, body in requests:
        r = client.request(method, "/api/v1/access/" + path, json=body, headers=h)
        assert r.status_code == status, (path, r.text)
        assert r.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("state", ["anonymous", "pending", "inactive", "expired"])
def test_all_endpoints_reject_unverified_or_invalid_admin(admin, auth_env, state):
    from sqlalchemy import text

    auth = admin.app.state.auth
    with auth.engine.begin() as db:
        if state == "anonymous":
            admin.cookies.clear()
        elif state == "pending":
            db.execute(
                text("UPDATE auth_context SET state='pending' WHERE state='verified'")
            )
        elif state == "inactive":
            db.execute(text("UPDATE auth_user SET state='inactive'"))
        else:
            db.execute(
                text(
                    "UPDATE auth_context SET expires_at=clock_timestamp()"
                    "-interval '1 second'"
                )
            )
    before = len(messages(auth_env.mailbox))
    assert_denied_endpoints(admin, 401)
    assert len(messages(auth_env.mailbox)) == before


def test_guards_filters_privacy_duplicates_and_terminal_targets(admin, auth_env):
    from sqlalchemy import text

    path = "/api/v1/access/invitations"
    h = headers(admin)
    payload = {"email": "pending@example.test", "role": "AGENT_VERIFICATEUR"}
    assert (
        admin.post(
            path, json=payload, headers={"Origin": "http://localhost"}
        ).status_code
        == 403
    )
    for header, value in [
        ("Origin", "https://foreign.invalid"),
        ("Host", "foreign.invalid"),
    ]:
        assert (
            admin.post(path, json=payload, headers={**h, header: value}).status_code
            == 403
        )
    for invalid in [
        {**payload, "role": "ADMIN_PLATEFORME"},
        {**payload, "email": "real@example.com"},
        {**payload, "entity": 2},
    ]:
        assert admin.post(path, json=invalid, headers=h).status_code == 422
    item = admin.post(path, json=payload, headers=h).json()
    for email in ["PENDING@example.test", "admin@example.test"]:
        assert (
            admin.post(path, json={**payload, "email": email}, headers=h).status_code
            == 409
        )
    for query in ["size=51", "page=0", "state=other", "entity=2"]:
        assert admin.get("/api/v1/access/users?" + query).status_code == 422
    result = admin.get(
        "/api/v1/access/users?email=pending&role=AGENT_VERIFICATEUR&size=1"
    ).json()
    assert result["total"] == 1 and len(result["items"]) == 1
    assert set(result["items"][0]) == {"id", "email", "role", "state", "version"}
    invitation = admin.get(path + "?email=pending").json()["items"][0]
    assert set(invitation) == {
        "id",
        "user_id",
        "email",
        "role",
        "state",
        "delivery_status",
        "expires_at",
        "version",
    }
    assert admin.get("/api/v1/access/users?email=%25").json()["total"] == 0
    original = admin.get(path + "?email=admin").json()["items"][0]
    for action in ["resend", "revoke"]:
        assert (
            admin.post(
                f"{path}/{original['id']}/{action}",
                headers=h,
                json={"expected_version": original["version"]},
            ).status_code
            == 403
        )
        assert (
            admin.post(
                f"{path}/missing/{action}", headers=h, json={"expected_version": 1}
            ).status_code
            == 404
        )
    with admin.app.state.auth.engine.begin() as db:
        db.execute(
            text(
                "UPDATE auth_user SET state='inactive',"
                "password_hash='synthetic-placeholder' "
                "WHERE email='pending@example.test'"
            )
        )
    assert admin.post(path, json=payload, headers=h).status_code == 409
    assert (
        admin.post(
            f"{path}/{item['id']}/resend",
            headers=h,
            json={"expected_version": item["version"]},
        ).status_code
        == 409
    )
    with pytest.raises(Exception) as rejected:
        admin.app.state.auth.bootstrap(
            "pending@example.test", "test-operator", reissue=True
        )
    assert str(rejected.value) == "bootstrap_closed"


def test_mail_failure_is_persisted_and_explicit_resend_recovers(
    admin, auth_env, monkeypatch
):
    auth = admin.app.state.auth
    send = auth.mail.send

    def fail(*args):
        raise OSError("synthetic transport failure")

    monkeypatch.setattr(auth.mail, "send", fail)
    h = headers(admin)
    response = admin.post(
        "/api/v1/access/invitations",
        headers=h,
        json={"email": "failed@example.test", "role": "AGENT_SAISIE"},
    )
    assert (
        response.status_code == 503
        and response.json()["code"] == "invitation_delivery_failed"
    )
    item = admin.get("/api/v1/access/invitations?email=failed").json()["items"][0]
    assert item["state"] == "prepared" and item["delivery_status"] == "failed"
    monkeypatch.setattr(auth.mail, "send", send)
    assert (
        admin.post(
            f"/api/v1/access/invitations/{item['id']}/resend",
            headers=h,
            json={"expected_version": item["version"]},
        ).status_code
        == 200
    )
    with TestClient(admin.app, base_url="http://localhost") as recipient:
        assert (
            activate(recipient, auth_env.mailbox, "failed@example.test")["user"]["role"]
            == "AGENT_SAISIE"
        )


def test_duplicate_create_and_late_delivery_revoke_are_serialized(
    admin, auth_env, monkeypatch
):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event

    from sqlalchemy import text

    auth = admin.app.state.auth
    h = headers(admin)
    started, release = Event(), Event()
    send = auth.mail.send

    def delayed(*args):
        started.set()
        assert release.wait(10)
        send(*args)

    monkeypatch.setattr(auth.mail, "send", delayed)
    payload = {"email": "race@example.test", "role": "AGENT_SAISIE"}
    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(
            admin.post, "/api/v1/access/invitations", headers=h, json=payload
        )
        assert started.wait(10)
        try:
            assert (
                admin.post(
                    "/api/v1/access/invitations", headers=h, json=payload
                ).status_code
                == 409
            )
            item = admin.get("/api/v1/access/invitations?email=race").json()["items"][0]
            assert item["delivery_status"] == "unconfirmed"
            assert (
                admin.post(
                    f"/api/v1/access/invitations/{item['id']}/revoke",
                    headers=h,
                    json={"expected_version": item["version"]},
                ).status_code
                == 200
            )
        finally:
            release.set()
        assert first.result(10).status_code == 409
    assert (
        admin.get("/api/v1/access/invitations?email=race").json()["items"][0]["state"]
        == "revoked"
    )
    assert (
        admin.post(
            "/api/v1/auth/invitations/inspect",
            headers=h,
            json=proof(auth_env.mailbox, "race@example.test"),
        ).status_code
        == 400
    )
    with auth.engine.connect() as db:
        assert (
            db.scalar(
                text("SELECT count(*) FROM auth_user WHERE email='race@example.test'")
            )
            == 1
        )
        assert (
            db.scalar(
                text("SELECT count(*) FROM auth_audit WHERE action='invitation_revoke'")
            )
            == 1
        )


@pytest.mark.parametrize("pair", ["accept-revoke", "accept-resend", "resend-resend"])
def test_competing_invitation_actions_have_one_winner(admin, auth_env, pair):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    h = headers(admin)
    item = admin.post(
        "/api/v1/access/invitations",
        headers=h,
        json={"email": "race@example.test", "role": "AGENT_SAISIE"},
    ).json()
    saved = proof(auth_env.mailbox, "race@example.test")
    barrier = Barrier(2)

    def act(action):
        barrier.wait(10)
        if action == "accept":
            return admin.post(
                "/api/v1/auth/invitations/accept",
                headers=h,
                json={**saved, "password": PASSWORD, "confirmation": PASSWORD},
            ).status_code
        return admin.post(
            f"/api/v1/access/invitations/{item['id']}/{action}",
            headers=h,
            json={"expected_version": item["version"]},
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(act, action) for action in pair.split("-")]
        results = [f.result(15) for f in futures]
    assert results.count(200) == 1, results
    assert next(code for code in results if code != 200) in (400, 409)


@pytest.mark.parametrize(
    "failure", ["prepare", "audit", "commit", "completion", "start"]
)
def test_database_faults_never_claim_success_or_send_before_commit(
    admin, auth_env, failure
):
    from sqlalchemy import event, text
    from sqlalchemy.exc import OperationalError

    auth = admin.app.state.auth
    h = headers(admin)
    count = len(messages(auth_env.mailbox))

    def fail_commit(connection):
        # Only the preparation transaction has this new identity in its snapshot.
        if connection.scalar(
            text("SELECT count(*) FROM auth_user WHERE email='fault@example.test'")
        ):
            raise OperationalError("commit", {}, Exception("synthetic commit failure"))

    def fail_start(*args):
        raise OperationalError("connect", {}, Exception("synthetic outage"))

    if failure in {"prepare", "audit", "completion"}:
        table = "auth_user" if failure == "prepare" else "auth_audit"
        condition = (
            "NEW.email='fault@example.test'"
            if failure == "prepare"
            else "NEW.action='invitation_create'"
            if failure == "audit"
            else "NEW.action='invitation_delivery'"
        )
        with auth.engine.begin() as db:
            db.execute(
                text(
                    f"CREATE FUNCTION fail_a21() RETURNS trigger "
                    f"LANGUAGE plpgsql AS $$ BEGIN IF {condition} THEN "
                    f"RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$"
                )
            )
            db.execute(
                text(
                    f"CREATE TRIGGER fail_a21 BEFORE INSERT ON {table} "
                    f"FOR EACH ROW EXECUTE FUNCTION fail_a21()"
                )
            )
    elif failure == "commit":
        event.listen(auth.engine, "commit", fail_commit)
    else:
        event.listen(auth.engine, "checkout", fail_start)
    try:
        response = admin.post(
            "/api/v1/access/invitations",
            headers=h,
            json={"email": "fault@example.test", "role": "AGENT_SAISIE"},
        )
        assert response.status_code == 503
        assert "synthetic" not in response.text
    finally:
        if failure == "commit":
            event.remove(auth.engine, "commit", fail_commit)
        if failure == "start":
            event.remove(auth.engine, "checkout", fail_start)
        if failure in {"prepare", "audit", "completion"}:
            with auth.engine.begin() as db:
                db.execute(text(f"DROP TRIGGER fail_a21 ON {table}"))
                db.execute(text("DROP FUNCTION fail_a21()"))
    items = admin.get("/api/v1/access/invitations?email=fault").json()["items"]
    if failure == "completion":
        assert (
            len(items) == 1
            and items[0]["delivery_status"] == "unconfirmed"
            and items[0]["state"] == "prepared"
        )
        assert len(messages(auth_env.mailbox)) == count + 1
        assert (
            admin.post(
                "/api/v1/auth/invitations/inspect",
                headers=h,
                json=proof(auth_env.mailbox, "fault@example.test"),
            ).status_code
            == 400
        )
    else:
        assert items == [] and len(messages(auth_env.mailbox)) == count


def test_audit_facts_append_only_and_security_denials(admin, auth_env):
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError

    h = headers(admin)
    item = admin.post(
        "/api/v1/access/invitations",
        headers=h,
        json={"email": "audit@example.test", "role": "AGENT_SAISIE"},
    ).json()
    saved = proof(auth_env.mailbox, "audit@example.test")
    assert (
        admin.post(
            "/api/v1/auth/invitations/accept",
            headers=h,
            json={**saved, "password": PASSWORD, "confirmation": PASSWORD},
        ).status_code
        == 200
    )
    assert (
        admin.post(
            f"/api/v1/access/invitations/{item['id']}/revoke",
            headers=h,
            json={"expected_version": item["version"]},
        ).status_code
        == 409
    )
    with admin.app.state.auth.engine.connect() as db:
        event = (
            db.execute(
                text(
                    "SELECT "
                    "actor,target,occurred_at,request_id,details FROM "
                    "auth_audit WHERE action='invitation_accept' AND target=:id"
                ),
                {"id": item["user_id"]},
            )
            .mappings()
            .one()
        )
        assert (
            event["actor"] == "anonymous"
            and event["occurred_at"]
            and event["request_id"]
        )
        facts = event["details"]
        assert (
            facts["before_user_state"] == "pending" and facts["user_state"] == "active"
        )
        assert facts["before_user_version"] == 1 and facts["user_version"] == 2
        assert (
            facts["before_state"] == "delivered" and facts["after_state"] == "consumed"
        )
        assert facts["before_version"] == 2 and facts["version"] == 3
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM auth_audit WHERE "
                    "action='access_denied' AND outcome='invitation_terminal'"
                )
            )
            == 1
        )
        serialized = str(db.execute(text("SELECT * FROM auth_audit")).all())
        assert saved["verifier"] not in serialized and PASSWORD not in serialized
    for statement in [
        "UPDATE auth_audit SET outcome='changed'",
        "DELETE FROM auth_audit",
    ]:
        with pytest.raises(DBAPIError), admin.app.state.auth.engine.begin() as db:
            db.execute(text(statement))


def test_openapi_and_access_endpoint_abuse(admin):
    from openapi_spec_validator import validate_spec
    from sqlalchemy import text

    schema = admin.get("/openapi.json").json()
    validate_spec(schema)
    paths = {p: v for p, v in schema["paths"].items() if p.startswith("/api/v1/access")}
    assert len(paths) == 4
    assert sum(len(v) for v in paths.values()) == 5
    for operations in paths.values():
        for method, operation in operations.items():
            if method == "post":
                assert {
                    p["name"]
                    for p in operation["parameters"]
                    if p["in"] == "header" and p["required"]
                } == {"X-CSRF-Token", "Origin"}
            assert operation["security"] == [
                {"LocalSession": []},
                {"SecureSession": []},
            ]
            assert all(
                str(status) in operation["responses"]
                for status in [401, 403, 409, 422, 429, 503]
            )
    with admin.app.state.auth.engine.begin() as db:
        db.execute(
            text("UPDATE auth_abuse SET count=120 WHERE id=:key"),
            {"key": admin.app.state.auth.keyed("endpoint:testclient")},
        )
    response = admin.get("/api/v1/access/users")
    assert (
        response.status_code == 429 and response.headers["cache-control"] == "no-store"
    )


def test_upgrade_existing_a1_pending_proof_requires_deliberate_reissue(auth_env):
    from uuid import uuid4

    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text

    from app.auth.service import digest
    from app.database import make_engine

    config = Config("alembic.ini")
    command.downgrade(config, "0002_a1")
    engine = make_engine(auth_env.url)
    user, invitation, generation = map(str, [uuid4(), uuid4(), uuid4()])
    with engine.begin() as db:
        db.execute(
            text(
                "INSERT INTO auth_user VALUES "
                "(:id,'legacy@example.test','ADMIN_PLATEFORME','pending',NULL,1)"
            ),
            {"id": user},
        )
        db.execute(
            text(
                "INSERT INTO auth_invitation VALUES "
                "(:id,:user,:proof,:generation,clock_timestamp()"
                "+interval '1 day','delivered')"
            ),
            {
                "id": invitation,
                "user": user,
                "proof": digest("old-proof"),
                "generation": generation,
            },
        )
        db.execute(
            text(
                "INSERT INTO "
                "auth_audit(occurred_at,action,actor,target,outcome,request_id) "
                "VALUES (clock_timestamp(),'bootstrap','operator',:user,'ok',:request)"
            ),
            {"user": user, "request": str(uuid4())},
        )
    command.upgrade(config, "head")
    with TestClient(create_app(auth_env.url), base_url="http://localhost") as client:
        h = headers(client)
        assert (
            client.post(
                "/api/v1/auth/invitations/inspect",
                headers=h,
                json={"selector": invitation, "verifier": "old-proof"},
            ).status_code
            == 400
        )
        client.app.state.auth.bootstrap("legacy@example.test", "operator", reissue=True)
        assert (
            activate(client, auth_env.mailbox, "legacy@example.test")["user"]["role"]
            == "ADMIN_PLATEFORME"
        )
    with engine.connect() as db:
        assert (
            db.scalar(text("SELECT details FROM auth_audit WHERE action='bootstrap'"))
            is None
        )
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM information_schema.tables "
                    "WHERE table_schema='public' AND table_name LIKE 'auth_%'"
                )
            )
            == 6
        )
    engine.dispose()


def test_database_constraints_and_late_superseded_generation(
    admin, auth_env, monkeypatch
):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Event

    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError

    h = headers(admin)
    auth = admin.app.state.auth
    send = auth.mail.send
    started, release = Event(), Event()
    calls = 0

    def delayed(*args):
        nonlocal calls
        calls += 1
        if calls == 1:
            started.set()
            assert release.wait(10)
        send(*args)

    monkeypatch.setattr(auth.mail, "send", delayed)
    with ThreadPoolExecutor(max_workers=1) as pool:
        first = pool.submit(
            admin.post,
            "/api/v1/access/invitations",
            headers=h,
            json={"email": "generation@example.test", "role": "AGENT_SAISIE"},
        )
        assert started.wait(10)
        try:
            item = admin.get("/api/v1/access/invitations?email=generation").json()[
                "items"
            ][0]
            result = admin.post(
                f"/api/v1/access/invitations/{item['id']}/resend",
                headers=h,
                json={"expected_version": item["version"]},
            )
            assert result.status_code == 200
            current = result.json()
        finally:
            release.set()
        assert first.result(10).status_code == 409
    assert (
        admin.get("/api/v1/access/invitations?email=generation").json()["items"][0]
        == current
    )
    with pytest.raises(DBAPIError), auth.engine.begin() as db:
        db.execute(text("UPDATE auth_invitation SET version=0"))
    with pytest.raises(DBAPIError), auth.engine.begin() as db:
        db.execute(
            text(
                "INSERT INTO auth_audit"
                "(occurred_at,action,actor,outcome,request_id,details) "
                "VALUES (now(),'test','test','test','test','[]'::jsonb)"
            )
        )
