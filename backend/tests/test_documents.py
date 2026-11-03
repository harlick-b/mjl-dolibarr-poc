import asyncio
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from threading import Event
from urllib.parse import urlsplit
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from PIL import Image
from reportlab.pdfgen import canvas
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import Session
from starlette.requests import Request
from test_access import admin as admin
from test_access import headers
from test_planning import ordered_advisory_race, plan, post, references
from test_planning import planning as planning

from app.auth.models import Audit, User
from app.auth.service import AuthError
from app.planning import documents as document_service
from app.planning.models import ActivityDocument


def activity(planning):
    _partner, operation_type, project = references(planning)
    response = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    )
    assert response.status_code == 201, response.text
    return response.json()


def png():
    output = BytesIO()
    Image.new("RGB", (2, 2), "white").save(output, "PNG")
    return output.getvalue()


def jpeg():
    output = BytesIO()
    Image.new("RGB", (2, 2), "white").save(output, "JPEG")
    return output.getvalue()


def pdf():
    output = BytesIO()
    document = canvas.Canvas(output)
    document.drawString(72, 720, "Synthetic evidence")
    document.showPage()
    document.save()
    return output.getvalue()


def upload(client, identifier, content=None, name="preuve.png", media="image/png"):
    content = png() if content is None else content
    return client.post(
        f"/api/v1/activities/{identifier}/documents",
        headers={
            **headers(client),
            "Content-Type": media,
            "X-File-Name": name,
        },
        content=content,
    )


def test_optional_attachment_upload_list_and_guarded_download(planning):
    item = activity(planning)
    created = upload(planning["agent"], item["id"])
    assert created.status_code == 201, created.text
    document = created.json()
    assert document["name"] == "preuve.png" and document["size"] == len(png())
    assert created.headers["location"].endswith(
        f"/activities/{item['id']}/documents/{document['id']}/download"
    )

    for actor in ("agent", "supervisor", "validator"):
        listing = planning[actor].get(
            f"/api/v1/activities/{item['id']}/documents?limit=60"
        )
        assert listing.status_code == 200
        assert listing.json()["object"] == "list"
        assert listing.json()["count"] == 1
    assert (
        planning["admin"]
        .get(
            f"/api/v1/activities/{item['id']}/documents",
            headers=headers(planning["admin"]),
        )
        .status_code
        == 403
    )
    assert upload(planning["admin"], item["id"]).status_code == 403

    downloaded = planning["supervisor"].get(
        f"/api/v1/activities/{item['id']}/documents/{document['id']}/download"
    )
    assert downloaded.status_code == 200 and downloaded.content == png()
    assert downloaded.headers["cache-control"] == "no-store"
    assert downloaded.headers["x-content-type-options"] == "nosniff"
    assert downloaded.headers["content-disposition"].startswith("attachment;")
    assert (
        planning["admin"]
        .get(
            f"/api/v1/activities/{item['id']}/documents/{document['id']}/download",
            headers=headers(planning["admin"]),
        )
        .status_code
        == 403
    )
    with Session(planning["auth"].engine) as db:
        actions = list(
            db.scalars(select(Audit.action).where(Audit.target == document["id"]))
        )
        assert actions == ["document.upload", "document.download"]


@pytest.mark.parametrize(
    ("content", "name", "media_type"),
    ((png, "preuve.png", "image/png"), (jpeg, "preuve.jpg", "image/jpeg")),
)
def test_guarded_image_preview_is_inline_audited_and_pdf_stays_download_only(
    planning, content, name, media_type
):
    item = activity(planning)
    image = upload(planning["agent"], item["id"], content(), name, media_type).json()
    pdf_item = upload(
        planning["agent"], item["id"], pdf(), "preuve.pdf", "application/pdf"
    ).json()

    preview = planning["supervisor"].get(
        f"/api/v1/activities/{item['id']}/documents/{image['id']}/preview"
    )
    assert preview.status_code == 200 and preview.content == content()
    assert preview.headers["content-type"].startswith(media_type)
    assert preview.headers["content-disposition"].startswith("inline;")
    assert preview.headers["cache-control"] == "no-store"
    assert preview.headers["x-content-type-options"] == "nosniff"
    assert preview.headers["content-security-policy"] == "default-src 'none'; sandbox"
    assert preview.headers["cross-origin-resource-policy"] == "same-origin"

    validator_preview = planning["validator"].get(
        f"/api/v1/activities/{item['id']}/documents/{image['id']}/preview"
    )
    assert validator_preview.status_code == 200
    anonymous = TestClient(planning["agent"].app, base_url="http://localhost")
    try:
        assert (
            anonymous.get(
                f"/api/v1/activities/{item['id']}/documents/{image['id']}/preview"
            ).status_code
            == 401
        )
    finally:
        anonymous.close()

    unavailable = planning["supervisor"].get(
        f"/api/v1/activities/{item['id']}/documents/{pdf_item['id']}/preview"
    )
    assert unavailable.status_code == 422
    assert (
        planning["admin"]
        .get(
            f"/api/v1/activities/{item['id']}/documents/{image['id']}/preview",
            headers=headers(planning["admin"]),
        )
        .status_code
        == 403
    )
    with Session(planning["auth"].engine) as db:
        actions = list(
            db.scalars(select(Audit.action).where(Audit.target == image["id"]))
        )
        assert sorted(actions) == [
            "document.preview",
            "document.preview",
            "document.upload",
        ]


def test_upload_permissions_and_content_validation(planning):
    item = activity(planning)
    assert (
        upload(planning["supervisor"], item["id"], b"not an image").status_code == 403
    )
    assert upload(planning["validator"], item["id"]).status_code == 201
    assert (
        upload(
            planning["agent"], item["id"], jpeg(), "preuve.jpg", "image/jpeg"
        ).status_code
        == 201
    )
    assert (
        upload(
            planning["agent"], item["id"], pdf(), "preuve.pdf", "application/pdf"
        ).status_code
        == 201
    )
    assert (
        upload(
            planning["agent"], item["id"], b"not png", "fake.png", "image/png"
        ).status_code
        == 422
    )
    assert (
        upload(
            planning["agent"],
            item["id"],
            pdf().replace(b"%%EOF", b"/OpenAction\n%%EOF"),
            "active.pdf",
            "application/pdf",
        ).status_code
        == 422
    )
    assert (
        upload(planning["agent"], item["id"], b"x" * (20 * 1024 * 1024 + 1)).status_code
        == 422
    )
    assert (
        upload(planning["agent"], item["id"], png(), "../preuve.png").status_code == 422
    )
    assert (
        upload(
            planning["agent"], item["id"], png(), "fake.jpg", "image/jpeg"
        ).status_code
        == 422
    )
    assert (
        upload(
            planning["agent"],
            item["id"],
            b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
            "danger.pdf",
            "application/pdf",
        ).status_code
        == 422
    )

    missing_csrf = planning["agent"].post(
        f"/api/v1/activities/{item['id']}/documents",
        headers={"Content-Type": "image/png", "X-File-Name": "preuve.png"},
        content=png(),
    )
    assert missing_csrf.status_code == 403


def test_streaming_limit_rejects_before_accumulating_an_unbounded_body(monkeypatch):
    monkeypatch.setattr(document_service, "MAX_BYTES", 4)
    messages = iter(
        [
            {"type": "http.request", "body": b"123", "more_body": True},
            {"type": "http.request", "body": b"45", "more_body": False},
        ]
    )

    async def receive():
        return next(messages)

    request = Request(
        {
            "type": "http",
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 1),
            "server": ("localhost", 80),
        },
        receive,
    )
    with pytest.raises(AuthError, match="document_invalid"):
        asyncio.run(document_service.bounded_content(request))


def test_document_list_uses_the_shared_cursor_contract(planning):
    item = activity(planning)
    first = upload(planning["agent"], item["id"], png(), "a.png").json()
    second = upload(planning["agent"], item["id"], png(), "b.png").json()

    page = planning["agent"].get(f"/api/v1/activities/{item['id']}/documents?limit=1")
    assert page.status_code == 200
    assert page.json()["count"] == 2
    assert page.json()["data"][0]["id"] == second["id"]
    assert page.json()["next"] and page.json()["previous"] is None

    following = planning["agent"].get(
        urlsplit(page.json()["next"]).path + "?" + urlsplit(page.json()["next"]).query
    )
    assert following.status_code == 200
    assert following.json()["data"][0]["id"] == first["id"]
    assert following.json()["previous"]
    assert (
        planning["agent"]
        .get(f"/api/v1/activities/{item['id']}/documents?limit=101")
        .status_code
        == 422
    )


def test_document_ids_are_parent_scoped_and_rows_are_append_only(planning):
    first, second = activity(planning), activity(planning)
    document = upload(planning["agent"], first["id"]).json()
    guessed = planning["agent"].get(
        f"/api/v1/activities/{second['id']}/documents/{document['id']}/download"
    )
    assert guessed.status_code == 404
    guessed_preview = planning["agent"].get(
        f"/api/v1/activities/{second['id']}/documents/{document['id']}/preview"
    )
    assert guessed_preview.status_code == 404
    with pytest.raises(DBAPIError):
        with planning["auth"].engine.begin() as db:
            db.execute(
                text(
                    "UPDATE pta_activity_document SET display_name='changed' "
                    "WHERE id=:id"
                ),
                {"id": document["id"]},
            )
    with Session(planning["auth"].engine) as db:
        assert db.get(ActivityDocument, document["id"]).display_name == "preuve.png"


def test_upload_audit_failure_rolls_back_document(planning, monkeypatch):
    item = activity(planning)
    original = planning["auth"].audit

    def fail_upload(db, action, *args, **kwargs):
        if action == "document.upload":
            raise RuntimeError("synthetic audit failure")
        return original(db, action, *args, **kwargs)

    monkeypatch.setattr(planning["auth"], "audit", fail_upload)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        upload(planning["agent"], item["id"])
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityDocument).count() == 0
        assert db.query(Audit).filter(Audit.action == "document.upload").count() == 0


def test_document_download_audit_failure_returns_no_document(planning, monkeypatch):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()
    original = planning["auth"].audit

    def fail_delivery(db, current_action, *args, **kwargs):
        if current_action == "document.download":
            raise RuntimeError("synthetic audit failure")
        return original(db, current_action, *args, **kwargs)

    monkeypatch.setattr(planning["auth"], "audit", fail_delivery)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        planning["agent"].get(
            f"/api/v1/activities/{item['id']}/documents/{document['id']}/download"
        )
    with Session(planning["auth"].engine) as db:
        actions = list(
            db.scalars(select(Audit.action).where(Audit.target == document["id"]))
        )
        assert actions == ["document.upload"]


def test_preview_audit_database_failure_returns_503_without_image(planning):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()

    def reject(_connection, _cursor, statement, parameters, _context, _many):
        if "INSERT INTO auth_audit" in statement and "document.preview" in str(
            parameters
        ):
            raise OperationalError(statement, parameters, Exception("synthetic"))

    event.listen(planning["auth"].engine, "before_cursor_execute", reject)
    try:
        response = planning["agent"].get(
            f"/api/v1/activities/{item['id']}/documents/{document['id']}/preview"
        )
    finally:
        event.remove(planning["auth"].engine, "before_cursor_execute", reject)
    assert response.status_code == 503
    assert response.headers["content-type"].startswith("application/json")
    assert response.content != png()
    with Session(planning["auth"].engine) as db:
        actions = list(
            db.scalars(select(Audit.action).where(Audit.target == document["id"]))
        )
        assert actions == ["document.upload"]


def test_upload_parsing_does_not_hold_lifecycle_lock(planning, monkeypatch):
    item = activity(planning)
    entered, release = Event(), Event()
    original = document_service.validate

    def paused_validation(*args):
        entered.set()
        assert release.wait(5), "bounded parser release missing"
        return original(*args)

    monkeypatch.setattr(document_service, "validate", paused_validation)
    with Session(planning["auth"].engine) as db:
        user = db.scalar(select(User).where(User.email == "agent@example.test"))
        assert user is not None
        user_id, version = user.id, user.version
    with ThreadPoolExecutor(max_workers=1) as pool:
        pending = pool.submit(upload, planning["agent"], item["id"])
        assert entered.wait(5), "parser was not reached"
        deactivated = planning["admin"].patch(
            f"/api/v1/access/users/{user_id}",
            headers=headers(planning["admin"]),
            json={"expected_version": version, "deactivate": True},
        )
        assert deactivated.status_code == 200, deactivated.text
        release.set()
        denied = pending.result(timeout=10)
    assert denied.status_code == 401
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityDocument).count() == 0


@pytest.mark.parametrize("suffix", ("download", "preview"))
def test_deactivation_serializes_before_document_delivery(planning, suffix):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()
    with Session(planning["auth"].engine) as db:
        user = db.scalar(select(User).where(User.email == "agent@example.test"))
        assert user is not None
        user_id, version = user.id, user.version
    deactivated, denied = ordered_advisory_race(
        planning["auth"],
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{user_id}",
            headers=headers(planning["admin"]),
            json={"expected_version": version, "deactivate": True},
        ),
        lambda: planning["agent"].get(
            f"/api/v1/activities/{item['id']}/documents/{document['id']}/{suffix}"
        ),
    )
    assert deactivated.status_code == 200
    assert denied.status_code == 401


def test_unexpected_document_schema_fails_closed(planning):
    item = activity(planning)
    with planning["auth"].engine.begin() as db:
        db.execute(text("ALTER TABLE pta_activity_document ADD COLUMN unexpected int"))
    assert upload(planning["agent"], item["id"]).status_code == 409
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityDocument).count() == 0


def test_document_openapi_exposes_image_preview_and_keeps_deletion_out(planning):
    paths = planning["agent"].get("/openapi.json").json()["paths"]
    base = "/api/v1/activities/{activity_id}/documents"
    assert set(paths[base]) == {"get", "post"}
    assert set(paths[base]["post"]["requestBody"]["content"]) == {
        "application/pdf",
        "image/jpeg",
        "image/png",
    }
    assert set(paths[base + "/{document_id}/download"]) == {"get"}
    preview = paths[base + "/{document_id}/preview"]
    assert set(preview) == {"get"}
    assert set(preview["get"]["responses"]["200"]["content"]) == {
        "image/jpeg",
        "image/png",
    }
    assert (
        "application/octet-stream"
        in paths[base + "/{document_id}/download"]["get"]["responses"]["200"]["content"]
    )


def test_document_migration_round_trip_when_empty(auth_env):
    config = Config("alembic.ini")
    command.downgrade(config, "0016_pta5")
    command.upgrade(config, "head")
    with create_engine(auth_env.url).connect() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
            "0018_pta7a"
        )


def test_used_document_migration_refuses_destructive_downgrade(planning, auth_env):
    item = activity(planning)
    assert upload(planning["agent"], item["id"]).status_code == 201
    with pytest.raises(Exception, match="Refusing to discard Activity documents"):
        command.downgrade(Config("alembic.ini"), "0016_pta5")
    with create_engine(auth_env.url).connect() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
            "0018_pta7a"
        )
