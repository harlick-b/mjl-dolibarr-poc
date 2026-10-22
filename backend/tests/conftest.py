import json
import os
import secrets
import uuid
from pathlib import Path
from typing import NamedTuple

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


class AuthEnvironment(NamedTuple):
    url: str
    mailbox: Path
    config: dict

    def __repr__(self):
        return "AuthEnvironment(<isolated credentials redacted>)"


@pytest.fixture
def auth_env(monkeypatch, tmp_path):
    base = make_url(os.environ["TEST_DATABASE_URL"])
    assert (base.database or "").startswith("mjl_test_")
    name = "mjl_test_" + uuid.uuid4().hex
    admin = create_engine(base, isolation_level="AUTOCOMMIT")
    with admin.connect() as connection:
        connection.execute(text(f"CREATE DATABASE {name}"))
    url = base.set(database=name).render_as_string(hide_password=False)
    mailbox = Path("/tmp/mjl-a1-mail-" + uuid.uuid4().hex)
    config = {
        "fixture": "a1-synthetic-v1",
        "password_min": 8,
        "invitation_seconds": 604800,
        "otp_seconds": 600,
        "otp_attempts": 5,
        "otp_lock_seconds": 600,
        "resend_seconds": 60,
        "resend_max": 3,
        "context_seconds": 900,
        "login_window_seconds": 900,
        "login_limit": 10,
        "ip_window_seconds": 60,
        "ip_limit": 120,
        "concurrent_sessions": "independent-test-only",
        "origin": "http://localhost",
        "key": secrets.token_hex(32),
        "mailbox": str(mailbox),
    }
    policy_file = tmp_path / "policy.json"
    policy_file.write_text(json.dumps(config))
    monkeypatch.setenv("MJL_AUTH_MODE", "synthetic")
    monkeypatch.setenv("MJL_ENVIRONMENT", "isolated-test")
    monkeypatch.setenv("MJL_AUTH_POLICY_FILE", str(policy_file))
    monkeypatch.setenv("DATABASE_URL", url)
    try:
        command.upgrade(Config("alembic.ini"), "head")
        yield AuthEnvironment(url, mailbox, config)
    finally:
        import shutil

        shutil.rmtree(mailbox, ignore_errors=True)
        with admin.connect() as connection:
            connection.execute(text(f"DROP DATABASE {name} WITH (FORCE)"))
        admin.dispose()
