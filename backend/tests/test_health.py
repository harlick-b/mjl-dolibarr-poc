from fastapi.testclient import TestClient

from app.main import create_app


def test_liveness_is_independent_of_postgresql():
    with TestClient(
        create_app("postgresql+psycopg://unused:secret@127.0.0.1:1/absent")
    ) as client:
        response = client.get("/api/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_failure_is_generic_and_not_cached():
    url = "postgresql+psycopg://unused:never-expose-this@127.0.0.1:1/absent"
    with TestClient(create_app(url)) as client:
        response = client.get("/api/health/ready")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
    assert response.headers["cache-control"] == "no-store"
    assert "never-expose-this" not in response.text


def test_openapi_documents_actual_health_contract():
    from openapi_spec_validator import validate

    with TestClient(
        create_app("postgresql+psycopg://unused:secret@127.0.0.1:1/absent")
    ) as client:
        schema = client.get("/openapi.json").json()
    validate(schema)
    assert set(schema["paths"]) == {"/api/health/live", "/api/health/ready"} | {
        "/api/v1/auth/" + path
        for path in (
            "session",
            "invitations/inspect",
            "invitations/accept",
            "login",
            "otp/verify",
            "otp/resend",
            "logout",
        )
    }
    ready = schema["paths"]["/api/health/ready"]["get"]["responses"]
    assert set(ready) == {"200", "503"}
    assert (
        schema["components"]["schemas"]["Healthy"]["properties"]["status"]["const"]
        == "ok"
    )
    assert (
        schema["components"]["schemas"]["Unavailable"]["properties"]["status"]["const"]
        == "unavailable"
    )


def test_invalid_required_configuration_is_sanitized(monkeypatch):
    import pytest

    monkeypatch.delenv("DATABASE_URL", raising=False)
    for invalid in (None, "postgresql://name:secret@host/db", "secret-invalid"):
        with pytest.raises(ValueError, match="DATABASE_URL must be") as error:
            create_app(invalid)
        assert "secret" not in str(error.value)
