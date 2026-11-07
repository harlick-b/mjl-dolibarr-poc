import asyncio
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from threading import Event
from urllib.parse import urlsplit
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from PIL import Image
from reportlab.pdfgen import canvas
from sqlalchemy import create_engine, event, select, text
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.orm import Session
from starlette.requests import Request

from app.auth.models import Audit, User
from app.auth.service import AuthError
from app.planning import documents as document_service
from app.planning.models import ActivityDocument, ActivityDocumentWithdrawal
from tests.auth.test_access import admin as admin
from tests.auth.test_access import headers
from tests.execution.test_closure import close_path, settled_activity
from tests.execution.test_execution import approved_execution_activity
from tests.planning.test_planning import (
    assign_agents,
    ordered_advisory_race,
    plan,
    post,
    references,
)
from tests.planning.test_planning import planning as planning
from tests.reports.test_fiche import fiche_path, pdf_text


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


def withdraw(
    client, activity_id, document_id, reason="Pièce incorrecte.", replacement=None
):
    return client.post(
        f"/api/v1/activities/{activity_id}/documents/{document_id}/withdrawal",
        headers=headers(client),
        json={"reason": reason, "replacement_document_id": replacement},
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


def test_agent_withdraws_own_document_and_links_active_correction(planning):
    item = activity(planning)
    original = upload(planning["agent"], item["id"], name="preuve-erronee.png").json()
    correction = upload(
        planning["agent"], item["id"], name="preuve-corrigee.png"
    ).json()

    withdrawn = planning["agent"].post(
        f"/api/v1/activities/{item['id']}/documents/{original['id']}/withdrawal",
        headers=headers(planning["agent"]),
        json={
            "reason": "Le fichier initial était incorrect.",
            "replacement_document_id": correction["id"],
        },
    )
    assert withdrawn.status_code == 201, withdrawn.text
    result = withdrawn.json()
    assert result["id"] == original["id"]
    assert result["allowed_actions"] == []
    assert result["withdrawal"]["reason"] == "Le fichier initial était incorrect."
    assert result["withdrawal"]["replacement_document_id"] == correction["id"]
    assert result["withdrawal"]["replacement_document_name"] == "preuve-corrigee.png"

    statements = []

    def capture(_connection, _cursor, statement, _parameters, _context, _many):
        if "FROM pta_activity_document " in statement:
            statements.append(statement)

    event.listen(planning["auth"].engine, "before_cursor_execute", capture)
    try:
        listing = (
            planning["agent"].get(f"/api/v1/activities/{item['id']}/documents").json()
        )
    finally:
        event.remove(planning["auth"].engine, "before_cursor_execute", capture)
    assert len(statements) == 3
    assert all("pta_activity_document.content" not in value for value in statements)
    assert all("pta_activity_document.sha256" not in value for value in statements)
    historical = next(row for row in listing["data"] if row["id"] == original["id"])
    assert historical["withdrawal"] == result["withdrawal"]
    assert historical["allowed_actions"] == []
    for action in ("download", "preview"):
        denied = planning["agent"].get(
            f"/api/v1/activities/{item['id']}/documents/{original['id']}/{action}"
        )
        assert denied.status_code == 409
        assert denied.json()["code"] == "document_withdrawn"
    current = planning["agent"].get(
        f"/api/v1/activities/{item['id']}/documents/{correction['id']}/download"
    )
    assert current.status_code == 200 and current.content == png()
    with Session(planning["auth"].engine) as db:
        actions = list(
            db.scalars(select(Audit.action).where(Audit.target == original["id"]))
        )
        assert actions == ["document.upload", "document.withdraw"]


def test_withdrawal_roles_ownership_and_plain_history(planning):
    item = activity(planning)
    item = assign_agents(planning, item, planning["agent"], planning["agent2"])
    foreign = upload(planning["agent2"], item["id"]).json()
    for actor in ("agent", "supervisor", "admin"):
        denied = withdraw(planning[actor], item["id"], foreign["id"])
        assert denied.status_code == 403
    own_view = (
        planning["agent2"]
        .get(f"/api/v1/activities/{item['id']}/documents")
        .json()["data"][0]
    )
    assert own_view["allowed_actions"] == ["withdraw"]
    validator_view = (
        planning["validator"]
        .get(f"/api/v1/activities/{item['id']}/documents")
        .json()["data"][0]
    )
    assert validator_view["allowed_actions"] == ["withdraw"]

    result = withdraw(planning["validator"], item["id"], foreign["id"])
    assert result.status_code == 201, result.text
    assert result.json()["withdrawal"]["replacement_document_id"] is None
    assert result.json()["allowed_actions"] == []
    replay = withdraw(planning["validator"], item["id"], foreign["id"])
    assert replay.status_code == 409
    assert replay.json()["code"] == "document_withdrawn"


def test_only_validator_withdraws_after_activity_closure(planning):
    item, _request, version = settled_activity(planning)
    agent_document = upload(planning["agent"], item["id"]).json()
    validator_document = upload(
        planning["validator"], item["id"], name="preuve-validateur.png"
    ).json()
    closed = post(planning["agent"], close_path(item), {"expected_version": version})
    assert closed.status_code == 200, closed.text
    listing = (
        planning["agent"]
        .get(f"/api/v1/activities/{item['id']}/documents")
        .json()["data"]
    )
    assert all(row["allowed_actions"] == [] for row in listing)
    denied = withdraw(planning["agent"], item["id"], agent_document["id"])
    assert denied.status_code == 403
    for document in (agent_document, validator_document):
        result = withdraw(planning["validator"], item["id"], document["id"])
        assert result.status_code == 201, result.text


def test_withdrawal_validates_reason_and_replacement_scope(planning):
    first = activity(planning)
    second = activity(planning)
    old = upload(planning["agent"], first["id"], name="ancienne.png").json()
    current = upload(planning["agent"], first["id"], name="courante.png").json()
    foreign = upload(planning["agent"], second["id"]).json()
    assert withdraw(planning["agent"], first["id"], old["id"], "   ").status_code == 422
    self_link = withdraw(
        planning["agent"], first["id"], old["id"], replacement=old["id"]
    )
    assert self_link.status_code == 409
    assert self_link.json()["code"] == "document_replacement_ineligible"
    cross = withdraw(
        planning["agent"], first["id"], old["id"], replacement=foreign["id"]
    )
    assert cross.status_code == 404
    assert cross.json()["code"] == "document_replacement_not_found"
    older = withdraw(
        planning["agent"], first["id"], current["id"], replacement=old["id"]
    )
    assert older.status_code == 409
    assert older.json()["code"] == "document_replacement_ineligible"
    assert withdraw(planning["agent"], first["id"], current["id"]).status_code == 201
    inactive = withdraw(
        planning["agent"], first["id"], old["id"], replacement=current["id"]
    )
    assert inactive.status_code == 409
    assert inactive.json()["code"] == "document_replacement_ineligible"


def test_activity_fiche_projects_current_and_withdrawn_documents(planning):
    item = approved_execution_activity(planning)
    original = upload(planning["agent"], item["id"], name="preuve-erronee.png").json()
    corrected = upload(planning["agent"], item["id"], name="preuve-corrigee.png").json()
    response = withdraw(
        planning["agent"],
        item["id"],
        original["id"],
        reason="Mauvaise pièce.",
        replacement=corrected["id"],
    )
    assert response.status_code == 201, response.text

    statements = []

    def capture(_connection, _cursor, statement, _parameters, _context, _many):
        if "FROM pta_activity_document " in statement:
            statements.append(statement)

    event.listen(planning["auth"].engine, "before_cursor_execute", capture)
    try:
        response = planning["agent"].get(fiche_path(item))
    finally:
        event.remove(planning["auth"].engine, "before_cursor_execute", capture)
    assert response.status_code == 200, response.text
    assert len(statements) == 1
    assert "pta_activity_document.content" not in statements[0]
    content = pdf_text(response)
    assert "preuve-erronee.png" in content
    assert "preuve-corrigee.png" in content
    assert "Pièce retirée" in content
    assert "Pièce actuelle" in content
    assert "Mauvaise pièce." in content
    assert "Remplacée par preuve-corrigee.png" in content
    assert "seront traitées dans une tranche distincte" not in content


def test_withdrawal_audit_failure_rolls_back_fact(planning, monkeypatch):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()

    def reject_audit(*_args, **_kwargs):
        raise RuntimeError("synthetic withdrawal audit failure")

    monkeypatch.setattr(planning["auth"], "audit", reject_audit)
    with pytest.raises(RuntimeError, match="synthetic withdrawal audit failure"):
        withdraw(planning["agent"], item["id"], document["id"])
    with Session(planning["auth"].engine) as db:
        assert db.get(ActivityDocumentWithdrawal, document["id"]) is None


def test_concurrent_withdrawals_are_single_use(planning):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()
    first, second = ordered_advisory_race(
        planning["auth"],
        lambda: withdraw(planning["agent"], item["id"], document["id"]),
        lambda: withdraw(planning["agent"], item["id"], document["id"]),
    )
    assert first.status_code == 201
    assert second.status_code == 409
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityDocumentWithdrawal).count() == 1


def test_withdrawal_serializes_before_document_delivery(planning):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()
    withdrawn, denied = ordered_advisory_race(
        planning["auth"],
        lambda: withdraw(planning["agent"], item["id"], document["id"]),
        lambda: planning["supervisor"].get(
            f"/api/v1/activities/{item['id']}/documents/{document['id']}/download"
        ),
    )
    assert withdrawn.status_code == 201
    assert denied.status_code == 409


def test_deactivation_serializes_before_document_withdrawal(planning):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()
    item = assign_agents(planning, item, planning["agent2"])
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
        lambda: withdraw(planning["agent"], item["id"], document["id"]),
    )
    assert deactivated.status_code == 200
    assert denied.status_code == 401
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityDocumentWithdrawal).count() == 0


def test_database_enforces_replacement_scope_and_withdrawal_immutability(planning):
    first, second = activity(planning), activity(planning)
    source = upload(planning["agent"], first["id"], name="source.png").json()
    foreign = upload(planning["agent"], second["id"], name="foreign.png").json()
    with Session(planning["auth"].engine) as db:
        actor = db.scalar(select(User).where(User.email == "agent@example.test"))
        assert actor is not None
        actor_id = actor.id
    with pytest.raises(DBAPIError, match="Invalid Activity document replacement"):
        with planning["auth"].engine.begin() as db:
            db.execute(
                text(
                    "INSERT INTO pta_activity_document_withdrawal "
                    "(document_id,replacement_document_id,reason,withdrawn_by_id,"
                    "withdrawn_at) VALUES (:source,:replacement,'Correction',:actor,"
                    "clock_timestamp())"
                ),
                {
                    "source": source["id"],
                    "replacement": foreign["id"],
                    "actor": actor_id,
                },
            )
    assert withdraw(planning["agent"], first["id"], source["id"]).status_code == 201
    for statement in (
        "UPDATE pta_activity_document_withdrawal SET reason='changed' "
        "WHERE document_id=:id",
        "DELETE FROM pta_activity_document_withdrawal WHERE document_id=:id",
    ):
        with pytest.raises(DBAPIError, match="immutable"):
            with planning["auth"].engine.begin() as db:
                db.execute(text(statement), {"id": source["id"]})


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
        assign_agents(planning, item, planning["agent2"])
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
    item = assign_agents(planning, item, planning["agent2"])
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


def test_unexpected_withdrawal_schema_fails_closed(planning):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()
    with planning["auth"].engine.begin() as db:
        db.execute(
            text(
                "ALTER TABLE pta_activity_document_withdrawal ADD COLUMN unexpected int"
            )
        )
    response = withdraw(planning["agent"], item["id"], document["id"])
    assert response.status_code == 409
    assert response.json()["code"] == "eligibility_unverified"
    with Session(planning["auth"].engine) as db:
        assert db.query(ActivityDocumentWithdrawal).count() == 0


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
    assert set(paths[base + "/{document_id}/withdrawal"]) == {"post"}
    parameters = paths[base + "/{document_id}/withdrawal"]["post"]["parameters"]
    assert {(item["name"], item["in"], item["required"]) for item in parameters} >= {
        ("X-CSRF-Token", "header", True),
        ("Origin", "header", True),
    }
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
    command.downgrade(config, "0018_pta7a")
    with create_engine(auth_env.url).connect() as db:
        assert (
            db.scalar(text("SELECT to_regclass('pta_activity_document_withdrawal')"))
            is None
        )
    command.upgrade(config, "head")
    with create_engine(auth_env.url).connect() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
            ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
        )
        assert db.scalar(text("SELECT to_regclass('pta_activity_document_withdrawal')"))


def test_predecessor_documents_survive_withdrawal_migration(planning, auth_env):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()
    planning["auth"].engine.dispose()
    config = Config("alembic.ini")
    command.downgrade(config, "0018_pta7a")
    command.upgrade(config, "head")
    with create_engine(auth_env.url).connect() as db:
        assert (
            db.scalar(text("SELECT version_num FROM alembic_version"))
            == ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
        )
        assert (
            db.scalar(
                text("SELECT display_name FROM pta_activity_document WHERE id=:id"),
                {"id": document["id"]},
            )
            == "preuve.png"
        )
        assert (
            db.scalar(text("SELECT count(*) FROM pta_activity_document_withdrawal"))
            == 0
        )


def test_used_withdrawal_migration_refuses_destructive_downgrade(planning, auth_env):
    item = activity(planning)
    document = upload(planning["agent"], item["id"]).json()
    assert withdraw(planning["agent"], item["id"], document["id"]).status_code == 201
    planning["auth"].engine.dispose()
    with pytest.raises(
        Exception, match="Refusing to discard Activity document withdrawals"
    ):
        command.downgrade(Config("alembic.ini"), "0018_pta7a")
    with create_engine(auth_env.url).connect() as db:
        assert (
            db.scalar(text("SELECT version_num FROM alembic_version"))
            == ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
        )


def test_used_document_migration_refuses_destructive_downgrade(planning, auth_env):
    item = activity(planning)
    assert upload(planning["agent"], item["id"]).status_code == 201
    with pytest.raises(Exception, match="Refusing to discard Activity documents"):
        command.downgrade(Config("alembic.ini"), "0016_pta5")
    with create_engine(auth_env.url).connect() as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
            ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
        )
