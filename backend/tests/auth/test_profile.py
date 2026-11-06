from alembic import command
from alembic.config import Config
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import Audit, User
from tests.auth.test_access import admin as admin_fixture
from tests.auth.test_access import headers

admin = admin_fixture


def test_profile_preserves_names_and_cannot_change_access(admin):
    before = admin.get("/api/v1/auth/profile")
    assert before.status_code == 200
    data = before.json()
    assert set(data) == {"first_name", "last_name", "full_name", "email", "role"}
    expected = {key: data[key] for key in ("first_name", "last_name", "full_name")}
    body = {"first_name": "Jean Paul", "last_name": "de Souza", "expected": expected}
    assert (
        admin.patch(
            "/api/v1/auth/profile", json=body, headers={"Origin": "http://localhost"}
        ).status_code
        == 403
    )
    assert (
        admin.patch(
            "/api/v1/auth/profile",
            json={**body, "role": "PARTENAIRE"},
            headers=headers(admin),
        ).status_code
        == 422
    )
    result = admin.patch("/api/v1/auth/profile", json=body, headers=headers(admin))
    assert result.status_code == 200, result.text
    assert result.json()["full_name"] == "Jean Paul de Souza"
    assert admin.get("/api/v1/auth/profile").json()["last_name"] == "de Souza"
    session = admin.get("/api/v1/auth/session").json()
    assert session["state"] == "verified"
    assert session["user"]["full_name"] == "Jean Paul de Souza"
    assert (
        admin.patch(
            "/api/v1/auth/profile", json=body, headers=headers(admin)
        ).status_code
        == 409
    )
    with Session(admin.app.state.auth.engine) as db:
        assert (
            len(list(db.scalars(select(Audit).where(Audit.action == "profile_update"))))
            == 1
        )
        assert db.get(User, session["user"]["id"]).role == data["role"]
        event = db.scalar(select(Audit).where(Audit.action == "profile_update"))
        assert event.details == {
            "before_full_name": data["full_name"] or "",
            "full_name": "Jean Paul de Souza",
        }
    assert (
        admin.post("/api/v1/auth/logout", json={}, headers=headers(admin)).status_code
        == 204
    )
    assert admin.get("/api/v1/auth/profile").status_code == 401


def test_profile_migration_round_trip_without_names(auth_env):
    cfg = Config("alembic.ini")
    command.downgrade(cfg, "0024_budget_funding")
    command.upgrade(cfg, "head")


def test_profile_concurrent_updates_and_audit_failure_are_atomic(admin, monkeypatch):
    from concurrent.futures import ThreadPoolExecutor

    from sqlalchemy.exc import SQLAlchemyError

    data = admin.get("/api/v1/auth/profile").json()
    expected = {key: data[key] for key in ("first_name", "last_name", "full_name")}
    auth_headers = headers(admin)

    def change(name):
        return admin.patch(
            "/api/v1/auth/profile",
            headers=auth_headers,
            json={"first_name": name, "last_name": "Test", "expected": expected},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(change, ["First", "Second"]))
    assert sorted(result.status_code for result in results) == [200, 409]
    saved = admin.get("/api/v1/auth/profile").json()
    expected = {key: saved[key] for key in expected}

    def fail_audit(*args, **kwargs):
        raise SQLAlchemyError("synthetic audit failure")

    monkeypatch.setattr(admin.app.state.auth, "audit", fail_audit)
    assert change("Rollback").status_code == 503
    assert admin.get("/api/v1/auth/profile").json() == saved


def test_invitations_preserve_structured_names_and_profile_requires_verification(admin):
    import pytest
    from fastapi.testclient import TestClient
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError

    response = admin.post(
        "/api/v1/access/invitations",
        headers=headers(admin),
        json={
            "email": "names@example.test",
            "full_name": "Jean Paul de Souza",
            "first_name": "Jean Paul",
            "last_name": "de Souza",
            "role": "AGENT_SAISIE",
        },
    )
    assert response.status_code == 201, response.text
    with Session(admin.app.state.auth.engine) as db:
        user = db.scalar(select(User).where(User.email == "names@example.test"))
        assert (user.first_name, user.last_name) == ("Jean Paul", "de Souza")
    with pytest.raises(IntegrityError), admin.app.state.auth.engine.begin() as db:
        db.execute(
            text(
                "UPDATE auth_user SET first_name='Inconsistent' "
                "WHERE email='names@example.test'"
            )
        )
    with TestClient(admin.app, base_url="http://localhost") as anonymous:
        anonymous.get("/api/v1/auth/session")
        assert anonymous.get("/api/v1/auth/profile").status_code == 401


def test_profile_migration_refuses_loss_of_structured_names(admin):
    import pytest
    from sqlalchemy import text

    with admin.app.state.auth.engine.begin() as db:
        db.execute(
            text(
                "UPDATE auth_user SET first_name='Jean', last_name='de Souza', "
                "full_name='Jean de Souza'"
            )
        )
    with pytest.raises(RuntimeError, match="Structured profile names"):
        command.downgrade(Config("alembic.ini"), "0024_budget_funding")
