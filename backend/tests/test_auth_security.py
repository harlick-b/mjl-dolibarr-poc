"""T01–T17: real PostgreSQL transactions with isolated synthetic identities."""

import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.auth.service import AuthError, AuthService
from app.main import create_app

PASSWORD = "Synthetic!93"
EMAIL = "first@example.test"


def mail(env, kind):
    return [
        json.loads(p.read_text())
        for p in sorted(env.mailbox.glob("*.json"), key=lambda p: p.stat().st_mtime_ns)
        if json.loads(p.read_text())["kind"] == kind
    ]


@pytest.fixture
def journey(auth_env):
    with TestClient(create_app(auth_env.url), base_url="http://localhost") as client:
        auth = client.app.state.auth
        auth.bootstrap(EMAIL, "test-operator")
        proof = {
            k: v[0]
            for k, v in parse_qs(
                urlsplit(mail(auth_env, "invitation")[-1]["value"]).fragment
            ).items()
        }
        state = client.get("/api/v1/auth/session").json()
        headers = {"Origin": "http://localhost", "X-CSRF-Token": state["csrf"]}
        yield client, auth, proof, headers, auth_env


def accept(j):
    client, _, proof, headers, _ = j
    return client.post(
        "/api/v1/auth/invitations/accept",
        json={**proof, "password": PASSWORD, "confirmation": PASSWORD},
        headers=headers,
    )


def login(j):
    return j[0].post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=j[3]
    )


def verify(j, code=None):
    return j[0].post(
        "/api/v1/auth/otp/verify",
        json={"code": code if code is not None else mail(j[4], "otp")[-1]["value"]},
        headers=j[3],
    )


def status(call):
    try:
        call()
        return 200
    except AuthError as error:
        return error.status


def test_t01_concurrent_cli_bootstrap(auth_env):
    def run(_):
        return subprocess.run(
            [sys.executable, "-m", "app.auth.bootstrap", "--email", EMAIL],
            capture_output=True,
            text=True,
            env=os.environ.copy(),
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, range(2)))
    assert sorted(r.returncode for r in results) == [0, 1]
    assert all("verifier=" not in r.stdout + r.stderr for r in results)
    assert len(mail(auth_env, "invitation")) == 1


def test_t01_failed_delivery_and_reissue(auth_env):
    with TestClient(create_app(auth_env.url), base_url="http://localhost") as client:
        auth = client.app.state.auth
        original = auth.mail.send
        auth.mail.send = lambda *args: (_ for _ in ()).throw(OSError())
        assert status(lambda: auth.bootstrap(EMAIL, "operator")) == 503
        with auth.engine.connect() as db:
            assert db.scalar(text("SELECT state FROM auth_invitation")) == "prepared"
        auth.mail.send = original
        auth.bootstrap(EMAIL, "operator", reissue=True)
        assert len(mail(auth_env, "invitation")) == 1
        assert (
            status(
                lambda: auth.bootstrap("other@example.test", "operator", reissue=True)
            )
            == 409
        )
        assert client.post("/api/v1/auth/bootstrap", json={}).status_code == 404
        assert client.post("/api/v1/auth/register", json={}).status_code == 404


@pytest.mark.parametrize(
    "extra", [{"role": "VALIDATEUR_DEFINITIF"}, {"email": "other@example.test"}]
)
def test_t02_no_client_grants(journey, extra):
    client, _, proof, headers, _ = journey
    assert (
        client.post(
            "/api/v1/auth/invitations/accept",
            json={**proof, "password": PASSWORD, "confirmation": PASSWORD, **extra},
            headers=headers,
        ).status_code
        == 422
    )


@pytest.mark.parametrize("condition", ["invalid", "expired", "revoked"])
def test_t03_invalid_proof_no_email(journey, condition):
    client, auth, proof, headers, _ = journey
    if condition == "invalid":
        proof = {**proof, "verifier": "incorrect"}
    else:
        with auth.engine.begin() as db:
            db.execute(
                text(
                    "UPDATE auth_invitation SET "
                    + (
                        "state='revoked'"
                        if condition == "revoked"
                        else "expires_at=now()-interval '1 second'"
                    )
                )
            )
    response = client.post(
        "/api/v1/auth/invitations/inspect", json=proof, headers=headers
    )
    assert response.status_code == 400 and EMAIL not in response.text


def test_t04_concurrent_acceptance(journey):
    _, auth, proof, _, _ = journey

    def run(_):
        return status(
            lambda: auth.invitation(**proof, password=PASSWORD, confirmation=PASSWORD)
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(run, range(2))) == [200, 409]
    with auth.engine.connect() as db:
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM auth_audit "
                    "WHERE action='invitation_accept' AND outcome='ok'"
                )
            )
            == 1
        )
        assert (
            db.scalar(text("SELECT count(*) FROM auth_context WHERE state='verified'"))
            == 0
        )


def test_t05_credentials_and_durable_account_limit(journey):
    client, auth, _, headers, _ = journey
    assert accept(journey).status_code == 200
    for email in [EMAIL, "unknown@example.test"]:
        response = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "incorrect"},
            headers=headers,
        )
        assert (
            response.status_code == 401
            and response.json()["code"] == "credentials_invalid"
        )
    for _ in range(auth.policy.login_limit - 1):
        client.post(
            "/api/v1/auth/login",
            json={"email": EMAIL, "password": "incorrect"},
            headers=headers,
        )
    restarted = AuthService(auth.engine, auth.policy)
    assert (
        status(
            lambda: restarted.login(
                client.cookies.get("mjl_local"),
                headers["X-CSRF-Token"],
                EMAIL,
                PASSWORD,
                "testclient",
            )
        )
        == 429
    )
    with auth.engine.connect() as db:
        assert (
            db.scalar(
                text(
                    "SELECT count(*) FROM auth_audit "
                    "WHERE action='login' AND outcome='credentials_invalid'"
                )
            )
            >= 2
        )


def test_t06_mail_failure_cannot_verify(journey):
    _, auth, _, _, env = journey
    assert accept(journey).status_code == 200
    auth.mail.send = lambda *args: (_ for _ in ()).throw(OSError())
    assert login(journey).status_code == 503
    assert verify(journey, "000000").status_code == 400
    assert not mail(env, "otp")
    assert journey[0].get("/api/v1/auth/session").json()["state"] == "pending"


def test_t07_wrong_browser_and_rotation(journey):
    client, _, _, headers, env = journey
    accept(journey)
    assert login(journey).status_code == 202
    with TestClient(client.app, base_url="http://localhost") as other:
        token = other.get("/api/v1/auth/session").json()["csrf"]
        response = other.post(
            "/api/v1/auth/otp/verify",
            json={"code": mail(env, "otp")[-1]["value"]},
            headers={"Origin": "http://localhost", "X-CSRF-Token": token},
        )
        assert response.status_code == 401
    old = client.cookies.get("mjl_local")
    response = verify(journey)
    assert (
        response.status_code == 200
        and response.json()["csrf"] != headers["X-CSRF-Token"]
    )
    assert client.cookies.get("mjl_local") != old


@pytest.mark.parametrize("resend", [False, True])
def test_t08_concurrent_otp(journey, resend):
    client, auth, _, headers, env = journey
    accept(journey)
    login(journey)
    with auth.engine.connect() as db:
        sent = db.scalar(text("SELECT sent_at FROM auth_otp"))
    auth.clock = lambda: sent + timedelta(seconds=auth.policy.resend_seconds)
    secret, csrf = client.cookies.get("mjl_local"), headers["X-CSRF-Token"]
    code = mail(env, "otp")[-1]["value"]

    def run(index):
        return status(
            lambda: auth.otp(secret, csrf, None if resend and index else code)
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(run, range(2)))
    with auth.engine.connect() as db:
        count = db.scalar(
            text("SELECT count(*) FROM auth_context WHERE state='verified'")
        )
    assert count <= 1 and 200 in results
    if not resend:
        assert count == 1 and sorted(results) == [200, 401]


@pytest.mark.parametrize("offset,expected", [(599, 200), (600, 400), (601, 400)])
def test_t09_otp_expiry_boundary(journey, offset, expected):
    _, auth, _, _, _ = journey
    accept(journey)
    login(journey)
    with auth.engine.connect() as db:
        sent = db.scalar(text("SELECT sent_at FROM auth_otp"))
    auth.clock = lambda: sent + timedelta(seconds=offset)
    assert verify(journey).status_code == expected


def test_t09_attempt_lock_resend_and_relogin(journey):
    client, auth, _, headers, _ = journey
    accept(journey)
    login(journey)
    with auth.engine.connect() as db:
        sent = db.scalar(text("SELECT sent_at FROM auth_otp"))
    for _ in range(auth.policy.otp_attempts):
        assert verify(journey, "malformed").status_code == 400
    assert verify(journey).status_code == 429
    assert login(journey).status_code == 429
    auth.clock = lambda: sent + timedelta(seconds=599)
    assert (
        client.post("/api/v1/auth/otp/resend", json={}, headers=headers).status_code
        == 429
    )
    # Lock is anchored to the last failed attempt, not challenge delivery.
    with auth.engine.connect() as db:
        unlock = db.scalar(text("SELECT locked_until FROM auth_otp"))
    auth.clock = lambda: unlock
    assert (
        client.post("/api/v1/auth/otp/resend", json={}, headers=headers).status_code
        == 202
    )
    assert verify(journey).status_code == 200


@pytest.mark.parametrize("kind", ["absolute", "idle"])
def test_t10_expiry_and_polling(journey, kind):
    client, auth, _, _, _ = journey
    accept(journey)
    login(journey)
    verify(journey)
    with auth.engine.begin() as db:
        created = db.scalar(
            text("SELECT created_at FROM auth_context WHERE state='verified'")
        )
        if kind == "idle":
            db.execute(
                text(
                    "UPDATE auth_context SET expires_at=expires_at+interval '1 day' "
                    "WHERE state='verified'"
                )
            )
    auth.clock = lambda: created + timedelta(seconds=86399)
    assert client.get("/api/v1/auth/session").status_code == 200
    with auth.engine.connect() as db:
        assert (
            db.scalar(
                text("SELECT last_activity FROM auth_context WHERE state='verified'")
            )
            == created
        )
    auth.clock = lambda: created + timedelta(seconds=86400)
    response = client.get("/api/v1/auth/session")
    assert response.status_code == 401
    assert "Max-Age=0" in response.headers["set-cookie"]


@pytest.mark.parametrize(
    "path,body",
    [
        ("invitations/inspect", {"selector": "x", "verifier": "x"}),
        (
            "invitations/accept",
            {
                "selector": "x",
                "verifier": "x",
                "password": PASSWORD,
                "confirmation": PASSWORD,
            },
        ),
        ("login", {"email": EMAIL, "password": PASSWORD}),
        ("otp/verify", {"code": "123456"}),
        ("otp/resend", {}),
        ("logout", {}),
    ],
)
@pytest.mark.parametrize("fault", ["origin", "csrf", "missing"])
def test_t11_all_unsafe_routes_require_origin_and_csrf(journey, path, body, fault):
    headers = dict(journey[3])
    if fault == "origin":
        headers["Origin"] = "https://evil.example"
    if fault == "csrf":
        headers["X-CSRF-Token"] = "forged"
    if fault == "missing":
        headers = {}
    assert (
        journey[0].post("/api/v1/auth/" + path, json=body, headers=headers).status_code
        == 403
    )


def test_t11_cookie_and_host(journey):
    client = journey[0]
    client.cookies.clear()
    response = client.get("/api/v1/auth/session")
    cookie = response.headers["set-cookie"]
    assert all(part in cookie for part in ["HttpOnly", "Path=/", "SameSite=lax"])
    assert "Domain=" not in cookie and "Secure" not in cookie
    assert (
        client.get("/api/v1/auth/session", headers={"Host": "evil.example"}).status_code
        == 403
    )
    assert (
        client.get(
            "/api/v1/auth/session",
            headers={"X-Forwarded-Host": "evil.example", "X-Forwarded-Proto": "https"},
        ).status_code
        == 200
    )


@pytest.mark.parametrize(
    "change",
    [
        "state='inactive'",
        "version=version+1",
        "role='AGENT_SAISIE'",
        "password_hash='changed'",
    ],
)
def test_t12_live_identity_invalidation(journey, change):
    accept(journey)
    login(journey)
    verify(journey)
    with journey[1].engine.begin() as db:
        db.execute(text("UPDATE auth_user SET " + change))
    assert journey[0].get("/api/v1/auth/session").status_code == 401


def break_audit(auth, action):
    with auth.engine.begin() as db:
        db.execute(
            text(
                "CREATE FUNCTION fail_audit() RETURNS trigger LANGUAGE plpgsql "
                "AS $$ BEGIN IF NEW.action = '"
                + action
                + "' THEN RAISE EXCEPTION 'test audit unavailable'; "
                "END IF; RETURN NEW; END $$"
            )
        )
        db.execute(
            text(
                "CREATE TRIGGER fail_audit BEFORE INSERT ON auth_audit "
                "FOR EACH ROW EXECUTE FUNCTION fail_audit()"
            )
        )


@pytest.mark.parametrize("action", ["invitation_accept", "otp_verify", "logout"])
def test_t15_audit_failure_rolls_back(journey, action):
    client, auth, _, headers, _ = journey
    if action != "invitation_accept":
        accept(journey)
        login(journey)
    if action == "logout":
        headers["X-CSRF-Token"] = verify(journey).json()["csrf"]
    break_audit(auth, action)
    response = (
        accept(journey)
        if action == "invitation_accept"
        else verify(journey)
        if action == "otp_verify"
        else client.post("/api/v1/auth/logout", json={}, headers=headers)
    )
    assert response.status_code == 503
    with auth.engine.connect() as db:
        if action == "invitation_accept":
            assert db.scalar(text("SELECT state FROM auth_user")) == "pending"
        elif action == "otp_verify":
            assert (
                db.scalar(
                    text("SELECT count(*) FROM auth_context WHERE state='verified'")
                )
                == 0
            )
        else:
            assert (
                db.scalar(
                    text("SELECT count(*) FROM auth_context WHERE state='verified'")
                )
                == 1
            )


def test_t17_no_plaintext_secrets_in_tables(journey):
    client, auth, proof, _, env = journey
    accept(journey)
    login(journey)
    otp = mail(env, "otp")[-1]["value"]
    verify(journey)
    cookie = client.cookies.get("mjl_local")
    with auth.engine.connect() as db:
        for table in [
            "auth_user",
            "auth_invitation",
            "auth_context",
            "auth_otp",
            "auth_audit",
            "auth_abuse",
        ]:
            rows = repr(db.execute(text(f"SELECT * FROM {table}")).all())
            for secret in [PASSWORD, proof["verifier"], cookie]:
                assert secret not in rows
        assert db.scalar(text("SELECT verifier FROM auth_otp")) != otp
    response = client.get("/api/v1/auth/session")
    assert response.headers["cache-control"] == "no-store"
    assert all(
        secret not in response.text
        for secret in [PASSWORD, proof["verifier"], cookie, otp]
    )


def test_t06_principal_rejects_partial_mfa(journey):
    from sqlalchemy.orm import Session

    accept(journey)
    login(journey)
    with Session(journey[1].engine) as db:
        assert (
            status(
                lambda: journey[1].principal(db, journey[0].cookies.get("mjl_local"))
            )
            == 401
        )


def test_t09_resend_boundary_and_exhaustion_recovers_after_context_window(journey):
    client, auth, _, headers, _ = journey
    accept(journey)
    login(journey)
    with auth.engine.connect() as db:
        sent = db.scalar(text("SELECT sent_at FROM auth_otp"))
    for count in range(1, auth.policy.resend_max + 1):
        auth.clock = lambda count=count: sent + timedelta(seconds=count * 60 - 1)
        assert (
            client.post("/api/v1/auth/otp/resend", json={}, headers=headers).status_code
            == 429
        )
        auth.clock = lambda count=count: sent + timedelta(seconds=count * 60)
        assert (
            client.post("/api/v1/auth/otp/resend", json={}, headers=headers).status_code
            == 202
        )
    auth.clock = lambda: sent + timedelta(seconds=240)
    assert (
        client.post("/api/v1/auth/otp/resend", json={}, headers=headers).status_code
        == 429
    )
    assert login(journey).status_code == 429
    auth.clock = lambda: sent + timedelta(seconds=1200)
    assert client.get("/api/v1/auth/session").status_code == 401
    headers["X-CSRF-Token"] = client.get("/api/v1/auth/session").json()["csrf"]
    assert login(journey).status_code == 202


def test_t09_endpoint_limit_covers_malformed_requests_and_restart(journey):
    client, auth, _, headers, _ = journey
    auth.policy = auth.policy.model_copy(update={"ip_limit": 8})
    # Boundary uses immutable app policy: consume its actual configured fixture budget.
    for _ in range(120):
        response = client.post(
            "/api/v1/auth/otp/verify", json={"unexpected": True}, headers=headers
        )
    assert response.status_code == 429
    with TestClient(create_app(journey[4].url), base_url="http://localhost") as other:
        assert other.get("/api/v1/auth/session").status_code == 429


def test_t11_https_cookie(auth_env, monkeypatch, tmp_path):
    config = {**auth_env.config, "origin": "https://localhost"}
    file = tmp_path / "https.json"
    file.write_text(json.dumps(config))
    monkeypatch.setenv("MJL_AUTH_POLICY_FILE", str(file))
    with TestClient(create_app(auth_env.url), base_url="https://localhost") as client:
        response = client.get("/api/v1/auth/session")
        cookie = response.headers["set-cookie"]
        assert cookie.startswith("__Host-mjl=")
        assert all(
            value in cookie
            for value in ["Secure", "HttpOnly", "SameSite=lax", "Path=/"]
        )
        assert "Domain=" not in cookie


def test_t15_bootstrap_audit_failure_and_post_delivery_failure(auth_env):
    from sqlalchemy.exc import SQLAlchemyError

    with TestClient(create_app(auth_env.url), base_url="http://localhost") as client:
        auth = client.app.state.auth
        break_audit(auth, "bootstrap")
        with pytest.raises(SQLAlchemyError):
            auth.bootstrap(EMAIL, "operator")
        with auth.engine.begin() as db:
            assert db.scalar(text("SELECT count(*) FROM auth_user")) == 0
            db.execute(text("DROP TRIGGER fail_audit ON auth_audit"))
            db.execute(text("DROP FUNCTION fail_audit()"))
        break_audit(auth, "invitation_delivery")
        with pytest.raises(SQLAlchemyError):
            auth.bootstrap(EMAIL, "operator")
        proof = {
            k: v[0]
            for k, v in parse_qs(
                urlsplit(mail(auth_env, "invitation")[-1]["value"]).fragment
            ).items()
        }
        assert status(lambda: auth.invitation(**proof)) == 400
        with auth.engine.connect() as db:
            assert db.scalar(text("SELECT state FROM auth_invitation")) == "prepared"


def test_t16_expiry_denial_audit_and_unavailable_database(journey):
    client, auth, _, _, _ = journey
    accept(journey)
    login(journey)
    verify(journey)
    auth.clock = lambda: datetime.now(UTC) + timedelta(days=2)
    assert client.get("/api/v1/auth/session").status_code == 401
    with auth.engine.connect() as db:
        assert (
            db.scalar(
                text("SELECT count(*) FROM auth_audit WHERE action='access_denied'")
            )
            >= 1
        )
    # The fixed public health fixture is unreachable; it cannot grant an auth session.
    with TestClient(
        create_app("postgresql+psycopg://unused:synthetic@127.0.0.1:1/mjl_test_absent"),
        base_url="http://localhost",
    ) as unavailable:
        response = unavailable.get("/api/v1/auth/session")
        assert response.status_code == 503 and "synthetic" not in response.text
