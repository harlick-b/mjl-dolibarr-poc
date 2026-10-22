import pytest


def test_auth_cannot_enable_real_accounts(monkeypatch):
    from app.auth.policy import load_policy

    monkeypatch.setenv("MJL_AUTH_MODE", "synthetic")
    monkeypatch.setenv("MJL_ENVIRONMENT", "production")
    with pytest.raises(ValueError, match="isolated"):
        load_policy("postgresql+psycopg://mjl:secret@postgres/mjl_production")


def test_synthetic_password_unicode_categories_match_browser():
    from app.auth.policy import password_valid

    assert password_valid("Été!2345", "Été!2345", 8)
    assert not password_valid("Ⅷabc!234", "Ⅷabc!234", 8)
    assert not password_valid("ABC!2345", "ABC!2345", 8)


def test_real_identity_is_rejected_by_persistence(auth_env):
    import pytest
    from sqlalchemy import create_engine, text
    from sqlalchemy.exc import IntegrityError

    engine = create_engine(auth_env.url)
    try:
        with pytest.raises(IntegrityError), engine.begin() as db:
            db.execute(
                text(
                    "INSERT INTO auth_user (id,email,role,state,version) VALUES "
                    "('synthetic-test','person@invalid.example',"
                    "'ADMIN_PLATEFORME','pending',1)"
                )
            )
    finally:
        engine.dispose()
