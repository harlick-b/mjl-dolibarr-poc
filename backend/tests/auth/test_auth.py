import json

from sqlalchemy import text


def messages(mailbox):
    return [json.loads(p.read_text()) for p in sorted(mailbox.glob("*.json"))]


def test_public_errors_omit_internal_correlation_ids(auth_env, monkeypatch, caplog):
    from fastapi.testclient import TestClient
    from sqlalchemy.exc import SQLAlchemyError

    from app.main import create_app

    url, _, _ = auth_env
    with TestClient(create_app(url), base_url="http://localhost") as client:
        state = client.get("/api/v1/auth/session").json()
        headers = {"Origin": "http://localhost", "X-CSRF-Token": state["csrf"]}
        responses = [
            (
                client.post(
                    "/api/v1/auth/login",
                    json={"email": "unknown@example.test", "password": "Synthetic!93"},
                    headers=headers,
                ),
                401,
            ),
            (client.post("/api/v1/auth/login", json={}, headers=headers), 422),
            (
                client.post(
                    "/api/v1/auth/login",
                    json={"email": "unknown@example.test", "password": "Synthetic!93"},
                    headers={**headers, "Origin": "https://other.example"},
                ),
                403,
            ),
        ]
        monkeypatch.setattr(client.app.state.auth, "limit", lambda *args: False)
        responses.append((client.get("/api/v1/access/users"), 429))

        def database_unavailable(*args):
            raise SQLAlchemyError("private diagnostic")

        monkeypatch.setattr(client.app.state.auth, "limit", database_unavailable)
        responses.append((client.get("/api/v1/access/users"), 503))
        for response, status in responses:
            assert response.status_code == status
            assert set(response.json()) == {"code", "message"}
            assert "x-request-id" not in response.headers
        assert "request_id=" in caplog.text
        assert "private diagnostic" not in caplog.text
        schema = client.app.openapi()["components"]["schemas"]["ErrorResponse"]
        assert set(schema["properties"]) == {"code", "message"}


def test_bootstrap_is_one_time_and_delivers_only_a_pending_invitation(auth_env):
    import pytest

    from app.auth.policy import load_policy
    from app.auth.service import AuthError, AuthService
    from app.core.config import database_url
    from app.core.database import make_engine

    url, mailbox, _ = auth_env
    engine = make_engine(database_url(url))
    auth = AuthService(engine, load_policy(url))
    try:
        auth.bootstrap("first@example.test", "First Admin", "operator-test")
        assert len(messages(mailbox)) == 1
        assert messages(mailbox)[0]["kind"] == "invitation"
        with engine.connect() as db:
            assert db.scalar(text("SELECT state FROM auth_user")) == "pending"
            assert db.scalar(text("SELECT password_hash FROM auth_user")) is None
        with pytest.raises(AuthError):
            auth.bootstrap("second@example.test", "Second Admin", "operator-test")
    finally:
        engine.dispose()


def test_invitation_acceptance_is_bound_single_use_and_does_not_create_session(
    auth_env,
):
    from urllib.parse import parse_qs, urlsplit

    import pytest

    from app.auth.policy import load_policy
    from app.auth.service import AuthError, AuthService
    from app.core.database import make_engine

    url, mailbox, _ = auth_env
    engine = make_engine(url)
    auth = AuthService(engine, load_policy(url))
    try:
        auth.bootstrap("first@example.test", "First Admin", "operator-test")
        proof = parse_qs(urlsplit(messages(mailbox)[0]["value"]).fragment)
        selector, verifier = proof["selector"][0], proof["verifier"][0]
        assert auth.invitation(selector, verifier) == "first@example.test"
        with pytest.raises(AuthError):
            auth.invitation(selector, verifier, "weak", "weak")
        auth.invitation(selector, verifier, "Synthetic!93", "Synthetic!93")
        with pytest.raises(AuthError):
            auth.invitation(selector, verifier, "Synthetic!94", "Synthetic!94")
        with engine.connect() as db:
            assert db.scalar(text("SELECT state FROM auth_user")) == "active"
            assert db.scalar(text("SELECT password_hash FROM auth_user")).startswith(
                "$argon2id$"
            )
    finally:
        engine.dispose()


def test_full_http_journey_requires_otp_and_revokes_old_session(auth_env):
    from urllib.parse import parse_qs, urlsplit

    from fastapi.testclient import TestClient

    from app.main import create_app

    url, mailbox, _ = auth_env
    with TestClient(create_app(url), base_url="http://localhost") as client:
        auth = client.app.state.auth
        auth.bootstrap("first@example.test", "First Admin", "operator-test")
        proof = {
            k: v[0]
            for k, v in parse_qs(
                urlsplit(messages(mailbox)[0]["value"]).fragment
            ).items()
        }
        state = client.get("/api/v1/auth/session").json()
        headers = {"Origin": "http://localhost", "X-CSRF-Token": state["csrf"]}
        assert (
            client.post(
                "/api/v1/auth/invitations/inspect", json=proof, headers=headers
            ).json()["email"]
            == "first@example.test"
        )
        assert (
            client.post(
                "/api/v1/auth/invitations/accept",
                json={
                    **proof,
                    "password": "Synthetic!93",
                    "confirmation": "Synthetic!93",
                },
                headers=headers,
            ).status_code
            == 200
        )
        assert (
            client.post(
                "/api/v1/auth/login",
                json={"email": "first@example.test", "password": "Synthetic!93"},
                headers=headers,
            ).status_code
            == 202
        )
        state = client.get("/api/v1/auth/session").json()
        assert state["state"] == "pending" and "user" not in state
        old = client.cookies.get("mjl_local")
        otp = next(m["value"] for m in messages(mailbox) if m["kind"] == "otp")
        response = client.post(
            "/api/v1/auth/otp/verify", json={"code": otp}, headers=headers
        )
        assert response.status_code == 200
        assert client.cookies.get("mjl_local") != old
        state = client.get("/api/v1/auth/session").json()
        assert state["user"]["email"] == "first@example.test"
        assert state["state"] == "verified"
        cookie = client.cookies.get("mjl_local")
        headers["X-CSRF-Token"] = state["csrf"]
        assert (
            client.post("/api/v1/auth/logout", json={}, headers=headers).status_code
            == 204
        )
        client.cookies.set("mjl_local", cookie)
        assert client.get("/api/v1/auth/session").status_code == 401
