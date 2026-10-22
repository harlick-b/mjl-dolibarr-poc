import os
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.config import database_url
from app.database import get_session, make_engine
from app.main import create_app


@pytest.fixture
def isolated_url():
    value = os.environ.get("TEST_DATABASE_URL")
    if not value:
        pytest.fail(
            "Integration requires TEST_DATABASE_URL for a disposable mjl_test_ database"
        )
    url = database_url(value)
    assert url.database.startswith("mjl_test_"), "Refuse non-test database"
    return value


@pytest.mark.integration
def test_postgresql_readiness_and_session_rollback(isolated_url):
    app = create_app(isolated_url)
    with TestClient(app) as client:
        # Exercise the actual request dependency's rollback/release, not just Session.
        dependency = get_session(Request({"type": "http", "app": app}))
        session = next(dependency)
        try:
            session.execute(text("SET LOCAL application_name = 'mjl-uncommitted'"))
            assert session.scalar(text("SHOW application_name")) == "mjl-uncommitted"
        finally:
            dependency.close()
        assert app.state.engine.pool.checkedout() == 0
        with Session(app.state.engine) as session:
            assert session.scalar(text("SHOW application_name")) != "mjl-uncommitted"
            assert session.scalar(text("SELECT 1")) == 1
        response = client.get("/api/health/ready")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert response.headers["cache-control"] == "no-store"
        assert app.state.engine.pool.checkedout() == 0


@pytest.mark.integration
def test_alembic_repeatable_upgrade_without_business_tables(isolated_url, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", isolated_url)
    root = Path(__file__).resolve().parents[1]
    config = Config(str(root / "alembic.ini"))
    command.current(config)
    command.upgrade(config, "head")
    command.upgrade(config, "head")
    command.current(config, check_heads=True)
    engine = make_engine(database_url(isolated_url))
    try:
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT version_num FROM alembic_version"))
                == "0002_a1"
            )
            assert set(inspect(connection).get_table_names()) == {
                "alembic_version",
                "auth_user",
                "auth_invitation",
                "auth_otp",
                "auth_context",
                "auth_audit",
                "auth_abuse",
            }
    finally:
        engine.dispose()
