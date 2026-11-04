import pytest


def test_auth_cannot_enable_real_accounts(monkeypatch):
    from app.auth.policy import load_policy

    monkeypatch.setenv("MJL_AUTH_MODE", "synthetic")
    monkeypatch.setenv("MJL_ENVIRONMENT", "production")
    with pytest.raises(ValueError, match="isolated"):
        load_policy("postgresql+psycopg://mjl:secret@postgres/mjl_production")


def test_local_policy_requires_resend_and_loopback_app_configuration(monkeypatch):
    from app.auth.policy import load_policy

    monkeypatch.setenv("MJL_AUTH_MODE", "local")
    monkeypatch.setenv("MJL_ENVIRONMENT", "local-development")
    monkeypatch.setenv("APP_BASE_URL", "http://localhost:5173")
    monkeypatch.setenv("MJL_AUTH_KEY", "a" * 64)
    monkeypatch.setenv("RESEND_API_KEY", "resend-secret")
    monkeypatch.setenv("EMAIL_FROM", "MJL <mail@example.com>")
    policy = load_policy("postgresql+psycopg://mjl:secret@postgres/mjl_foundation")

    assert policy and policy.fixture == "local-v1"
    assert policy.mailbox is None
    assert policy.resend_api_key == "resend-secret"
    assert policy.lifecycle_database == "mjl_foundation"

    monkeypatch.setenv("APP_BASE_URL", "https://mjl.example.com")
    with pytest.raises(ValueError, match="local authentication"):
        load_policy("postgresql+psycopg://mjl:secret@postgres/mjl_foundation")

    monkeypatch.setenv("APP_BASE_URL", "http://localhost:5173")
    monkeypatch.setenv("EMAIL_FROM", "not-an-address")
    with pytest.raises(ValueError, match="local authentication"):
        load_policy("postgresql+psycopg://mjl:secret@postgres/mjl_foundation")


def test_synthetic_password_unicode_categories_match_browser():
    from app.auth.policy import password_valid

    assert password_valid("Été!2345", "Été!2345", 8)
    assert not password_valid("Ⅷabc!234", "Ⅷabc!234", 8)
    assert not password_valid("ABC!2345", "ABC!2345", 8)


def test_real_identity_is_accepted_and_blocks_lossy_downgrade(auth_env):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, text

    engine = create_engine(auth_env.url)
    try:
        with engine.begin() as db:
            db.execute(
                text(
                    "INSERT INTO auth_user (id,email,role,state,version) VALUES "
                    "('real-local','person@example.com',"
                    "'ADMIN_PLATEFORME','pending',1)"
                )
            )
        with engine.connect() as db:
            assert db.scalar(
                text("SELECT email FROM auth_user WHERE id='real-local'")
            ) == "person@example.com"
        with pytest.raises(
            RuntimeError, match="Refusing to discard real-account identity data"
        ):
            command.downgrade(Config("alembic.ini"), "0022_partner_documents")
    finally:
        engine.dispose()


def test_account_migration_preserves_existing_unnamed_fixture(auth_env):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, text

    config = Config("alembic.ini")
    command.downgrade(config, "0022_partner_documents")
    engine = create_engine(auth_env.url)
    try:
        with engine.begin() as db:
            db.execute(
                text(
                    "INSERT INTO auth_user (id,email,role,state,version) VALUES "
                    "('existing','existing@example.test',"
                    "'AGENT_SAISIE','pending',1)"
                )
            )
        command.upgrade(config, "head")
        with engine.connect() as db:
            row = db.execute(
                text(
                    "SELECT email,full_name FROM auth_user WHERE id='existing'"
                )
            ).one()
            assert row == ("existing@example.test", None)
    finally:
        engine.dispose()
