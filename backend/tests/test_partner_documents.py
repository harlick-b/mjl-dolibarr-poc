# ruff: noqa: F401, F811
from contextlib import ExitStack

from test_access import admin, headers
from test_documents import png, upload, withdraw
from test_partner_portal import approve_in_project, invite_partner
from test_planning import planning, references


def share(client, activity_id, document_id, shared=True, version=0):
    return client.patch(
        f"/api/v1/activities/{activity_id}/documents/{document_id}/sharing",
        headers=headers(client),
        json={"shared": shared, "expected_version": version},
    )


def test_sharing_lifecycle_and_partner_scope(planning, auth_env):
    partner, operation, project = references(planning)
    activity = approve_in_project(planning, project, operation)
    document = upload(planning["agent"], activity["id"]).json()
    path = f"/api/v1/partner-portal/activities/{activity['id']}/documents"
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning, auth_env, stack, partner["id"], "files@example.test"
        )
        assert portal.get(path).json()["data"] == []
        for role in ("agent", "supervisor", "admin"):
            assert (
                share(planning[role], activity["id"], document["id"]).status_code == 403
            )
        response = share(planning["validator"], activity["id"], document["id"])
        assert response.status_code == 200, response.text
        assert response.json() == {"shared": True, "version": 1}
        listing = portal.get(path).json()
        assert listing["data"] == [
            {
                "id": document["id"],
                "name": "preuve.png",
                "media_type": "image/png",
                "size": len(png()),
            }
        ]
        for action in ("download", "preview"):
            response = portal.get(f"{path}/{document['id']}/{action}")
            assert response.status_code == 200, response.text
            assert response.content == png()
            assert response.headers["cache-control"] == "no-store"
        assert (
            share(
                planning["validator"], activity["id"], document["id"], False
            ).status_code
            == 409
        )
        assert (
            share(
                planning["validator"], activity["id"], document["id"], False, 1
            ).status_code
            == 200
        )
        assert portal.get(path).json()["data"] == []
        assert portal.get(f"{path}/{document['id']}/download").status_code == 404
        assert (
            share(
                planning["validator"], activity["id"], document["id"], True, 2
            ).status_code
            == 200
        )
        replacement = upload(
            planning["agent"], activity["id"], name="correction.png"
        ).json()
        assert (
            withdraw(
                planning["agent"],
                activity["id"],
                document["id"],
                replacement=replacement["id"],
            ).status_code
            == 201
        )
        assert portal.get(path).json()["data"] == []
        assert portal.get(f"{path}/{document['id']}/preview").status_code == 404
        assert portal.get(f"{path}/{replacement['id']}/download").status_code == 404


def test_visibility_pagination_and_public_contract(planning, auth_env):
    from sqlalchemy import event
    from test_documents import activity as draft_activity
    from test_documents import pdf
    from test_planning import post
    from test_withdrawals import request_withdrawal

    partner, operation, project = references(planning)
    activity = approve_in_project(planning, project, operation)
    other_partner, other_operation, other_project = references(planning)
    foreign = approve_in_project(planning, other_project, other_operation)
    draft = draft_activity(planning)
    draft_file = upload(planning["agent"], draft["id"]).json()
    assert (
        share(planning["validator"], draft["id"], draft_file["id"]).status_code == 409
    )
    document = upload(planning["agent"], activity["id"]).json()
    pdf_content = pdf()
    pdf_file = upload(
        planning["agent"], activity["id"], pdf_content, "rapport.pdf", "application/pdf"
    ).json()
    private = upload(planning["agent"], activity["id"], name="interne.png").json()
    for item in (document, pdf_file):
        assert (
            share(planning["validator"], activity["id"], item["id"]).status_code == 200
        )
    base = f"/api/v1/partner-portal/activities/{activity['id']}/documents"
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning, auth_env, stack, partner["id"], "reader1@example.test"
        )
        second, _, _ = invite_partner(
            planning, auth_env, stack, partner["id"], "reader2@example.test"
        )
        outsider, _, _ = invite_partner(
            planning, auth_env, stack, other_partner["id"], "outsider@example.test"
        )
        assert share(portal, activity["id"], private["id"]).status_code == 403
        for reader in (portal, second):
            assert reader.get(base).json()["count"] == 2
        for suffix in ("", f"/{document['id']}/download", f"/{document['id']}/preview"):
            assert outsider.get(base + suffix).status_code == 404
            assert planning["agent"].get(base + suffix).status_code == 403
        assert portal.get(base.replace(activity["id"], draft["id"])).status_code == 404
        assert (
            portal.get(base.replace(activity["id"], foreign["id"])).status_code == 404
        )
        assert portal.get(f"{base}/{private['id']}/download").status_code == 404
        assert portal.get(f"{base}/{pdf_file['id']}/preview").status_code == 422
        assert portal.get(f"{base}/{pdf_file['id']}/download").content == pdf_content
        for limit in (0, 101):
            assert portal.get(f"{base}?limit={limit}").status_code == 422
        assert portal.get(f"{base}?limit=100").status_code == 200
        statements = []

        def capture(_conn, _cursor, statement, *_args):
            statements.append(statement)

        event.listen(planning["auth"].engine, "before_cursor_execute", capture)
        try:
            first = portal.get(f"{base}?limit=1").json()
        finally:
            event.remove(planning["auth"].engine, "before_cursor_execute", capture)
        assert not any("pta_activity_document.content" in sql for sql in statements)
        next_page = portal.get(first["next"]).json()
        assert next_page["data"][0]["id"] != first["data"][0]["id"]
        assert portal.get(next_page["previous"]).json()["data"] == first["data"]
        assert second.get(first["next"]).status_code == 422
        assert set(first["data"][0]) == {"id", "name", "media_type", "size"}
        schema = portal.get("/openapi.json").json()
        for suffix in ("download", "preview"):
            route = schema["paths"][
                f"/api/v1/partner-portal/activities/{{activity_id}}/documents/{{document_id}}/{suffix}"
            ]["get"]
            assert "application/json" not in route["responses"]["200"]["content"]
            assert route["security"]


def test_shared_files_disappear_when_activity_withdrawn(planning, auth_env):
    from test_planning import post
    from test_withdrawals import request_withdrawal

    partner, operation, project = references(planning)
    activity = approve_in_project(planning, project, operation)
    document = upload(planning["agent"], activity["id"]).json()
    assert (
        share(planning["validator"], activity["id"], document["id"]).status_code == 200
    )
    base = f"/api/v1/partner-portal/activities/{activity['id']}/documents"
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning, auth_env, stack, partner["id"], "withdrawn-files@example.test"
        )
        withdrawal = request_withdrawal(planning, activity)
        pre = post(
            planning["supervisor"],
            f"/api/v1/activities/{activity['id']}/revisions/{withdrawal['id']}/decisions",
            {
                "expected_version": withdrawal["activity_version"],
                "decision": "prevalidate",
            },
        ).json()
        assert (
            post(
                planning["validator"],
                f"/api/v1/activities/{activity['id']}/revisions/{withdrawal['id']}/decisions",
                {"expected_version": pre["activity_version"], "decision": "approve"},
            ).status_code
            == 201
        )
        for suffix in ("", f"/{document['id']}/download", f"/{document['id']}/preview"):
            assert portal.get(base + suffix).status_code == 404
        # Revocation remains possible even after Activity visibility ends.
        assert (
            share(
                planning["validator"], activity["id"], document["id"], False, 1
            ).status_code
            == 200
        )


def test_sharing_rollback_serialization_and_immutable_bytes(
    planning, auth_env, monkeypatch
):
    import pytest
    from sqlalchemy import select, text
    from sqlalchemy.exc import DBAPIError
    from sqlalchemy.orm import Session
    from test_planning import ordered_advisory_race

    from app.auth.models import Audit
    from app.planning.models import ActivityDocument

    partner, operation, project = references(planning)
    activity = approve_in_project(planning, project, operation)
    document = upload(planning["agent"], activity["id"]).json()
    path = f"/api/v1/activities/{activity['id']}/documents/{document['id']}/sharing"
    assert (
        planning["validator"]
        .patch(path, json={"shared": True, "expected_version": 0})
        .status_code
        == 403
    )
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning, auth_env, stack, partner["id"], "races@example.test"
        )
        auth = planning["auth"]
        original = auth.audit

        def fail(db, action, *args, **kwargs):
            if action == "document.share":
                raise RuntimeError("audit unavailable")
            return original(db, action, *args, **kwargs)

        with monkeypatch.context() as patch:
            patch.setattr(auth, "audit", fail)
            with pytest.raises(RuntimeError, match="audit unavailable"):
                share(planning["validator"], activity["id"], document["id"])
        with Session(auth.engine) as db:
            item = db.get(ActivityDocument, document["id"])
            assert item.sharing_version == 0 and not item.partner_shared
            assert not db.scalar(
                select(Audit.id).where(Audit.action == "document.share")
            )
        assert (
            share(planning["validator"], activity["id"], document["id"]).status_code
            == 200
        )
        first, second = ordered_advisory_race(
            auth,
            lambda: share(
                planning["validator"], activity["id"], document["id"], False, 1
            ),
            lambda: portal.get(
                f"/api/v1/partner-portal/activities/{activity['id']}/documents/{document['id']}/download"
            ),
        )
        assert first.status_code == 200 and second.status_code == 404
        for sql in (
            "UPDATE pta_activity_document SET display_name='changed', "
            "partner_shared=true, sharing_version=sharing_version+1 WHERE id=:id",
            "UPDATE pta_activity_document SET content='changed' WHERE id=:id",
            "DELETE FROM pta_activity_document WHERE id=:id",
        ):
            with pytest.raises(DBAPIError), auth.engine.begin() as db:
                db.execute(text(sql), {"id": document["id"]})


def test_sharing_after_closure_and_migration_guard(planning):
    import pytest
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text
    from sqlalchemy.orm import Session
    from test_annual_export import approve_zero_and_close

    from app.auth.service import AuthError

    partner, operation, project = references(planning)
    activity = approve_in_project(planning, project, operation)
    document = upload(planning["agent"], activity["id"]).json()
    config = Config("alembic.ini")
    command.downgrade(config, "0021_financial_returns")
    command.upgrade(config, "head")
    # An existing private attachment survives round-trip with private defaults.
    listing = planning["validator"].get(
        f"/api/v1/activities/{activity['id']}/documents"
    )
    assert listing.status_code == 200, listing.text
    assert listing.json()["data"][0]["sharing_version"] == 0
    activity = approve_zero_and_close(planning)
    document = upload(planning["agent"], activity["id"]).json()
    assert (
        share(planning["validator"], activity["id"], document["id"]).status_code == 200
    )
    assert (
        share(
            planning["validator"], activity["id"], document["id"], False, 1
        ).status_code
        == 200
    )
    with pytest.raises(RuntimeError, match="sharing history"):
        command.downgrade(config, "0021_financial_returns")
    with Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text(
                "ALTER TABLE pta_activity_document "
                "DROP CONSTRAINT document_sharing_version"
            )
        )
        with pytest.raises(AuthError) as denied:
            planning["auth"].environment_verified(db)
        assert denied.value.code == "eligibility_unverified"
        db.rollback()
