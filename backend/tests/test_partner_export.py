# ruff: noqa: F401, F811
from contextlib import ExitStack

from test_access import admin, headers
from test_annual_export import activity_rows, records
from test_partner_portal import approve_in_project, invite_partner
from test_planning import planning, references


def export(client, pta_id):
    return client.post(
        f"/api/v1/partner-portal/ptas/{pta_id}/exports",
        headers=headers(client),
        json={"format": "csv"},
    )


def test_partner_exports_only_public_approved_rows(planning, auth_env):
    partner, operation, project = references(planning)
    activity = approve_in_project(planning, project, operation, name="=SUM(1;2)")
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning, auth_env, stack, partner["id"], "export@example.test"
        )
        response = export(portal, activity["pta_id"])
        assert response.status_code == 200, response.text
        assert response.headers["content-type"].startswith("text/csv")
        assert response.headers["cache-control"] == "no-store"
        content, rows = activity_rows(response)
        assert len(rows) == 1
        assert rows[0][2] == "'=SUM(1;2)"
        assert rows[0][6] == "Approuvée"
        assert rows[0][8:] == [""] * 7
        assert "Généré par" not in response.text
        assert "@example.test" not in response.text


def test_partner_export_scope_contract_and_audit(planning, auth_env, monkeypatch):
    import hashlib
    from uuid import uuid4

    from sqlalchemy import event, select
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session
    from test_amendments import open_amendment

    from app.auth.models import Audit
    from app.planning import annual_export

    partner, operation, project = references(planning)
    activity = approve_in_project(planning, project, operation)
    second = approve_in_project(planning, project, operation, name="Second approved")
    open_amendment(planning, activity)
    foreign_partner, foreign_operation, foreign_project = references(planning)
    foreign = approve_in_project(planning, foreign_project, foreign_operation)
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning, auth_env, stack, partner["id"], "scope-export@example.test"
        )
        path = f"/api/v1/partner-portal/ptas/{activity['pta_id']}/exports"
        for role in ("agent", "supervisor", "validator", "admin"):
            assert export(planning[role], activity["pta_id"]).status_code == 403
        assert export(portal, foreign["pta_id"]).status_code == 404
        assert export(portal, str(uuid4())).status_code == 404
        assert portal.post(path, json={"format": "csv"}).status_code == 403
        assert (
            portal.post(
                path, headers=headers(portal), json={"format": "xlsx"}
            ).status_code
            == 422
        )
        assert (
            portal.post(
                path,
                headers=headers(portal),
                json={"format": "csv", "partner_id": foreign_partner["id"]},
            ).status_code
            == 422
        )
        page = portal.get(
            f"/api/v1/partner-portal/ptas/{activity['pta_id']}/activities?limit=1"
        )
        assert len(page.json()["data"]) == 1
        response = export(portal, activity["pta_id"])
        assert response.status_code == 200, response.text
        content, rows = activity_rows(response)
        assert {row[0] for row in rows} == {activity["id"], second["id"]}
        assert all(row[6] == "Approuvée" for row in rows)
        assert all(len(row) == 15 for row in rows)
        assert "amendment" not in response.text.lower()
        metadata = {row[0]: row[1] for row in content if len(row) == 2}
        with Session(planning["auth"].engine) as db:
            audit = db.scalar(
                select(Audit).where(Audit.target == metadata["Identifiant export"])
            )
            assert (
                audit
                and audit.details["sha256"]
                == hashlib.sha256(response.content).hexdigest()
            )
            assert audit.details["row_count"] == 2
            assert audit.details["role"] == "PARTENAIRE"
        operation_schema = portal.get("/openapi.json").json()["paths"][
            "/api/v1/partner-portal/ptas/{pta_id}/exports"
        ]["post"]
        assert "text/csv" in operation_schema["responses"]["200"]["content"]
        assert {item["name"] for item in operation_schema["parameters"]} >= {
            "Origin",
            "X-CSRF-Token",
        }

        def count_audits():
            with Session(planning["auth"].engine) as db:
                return len(
                    list(
                        db.scalars(select(Audit.id).where(Audit.action == "pta.export"))
                    )
                )

        before = count_audits()
        monkeypatch.setattr(annual_export, "MAX_EXPORT_ROWS", 1)
        assert export(portal, activity["pta_id"]).status_code == 422
        assert count_audits() == before
        monkeypatch.undo()

        def reject(_connection, _cursor, statement, parameters, _context, _many):
            if "INSERT INTO auth_audit" in statement and "pta.export" in str(
                parameters
            ):
                raise OperationalError(statement, parameters, Exception("synthetic"))

        event.listen(planning["auth"].engine, "before_cursor_execute", reject)
        try:
            failed = export(portal, activity["pta_id"])
        finally:
            event.remove(planning["auth"].engine, "before_cursor_execute", reject)
        assert failed.status_code == 503
        assert failed.headers["content-type"].startswith("application/json")
        assert count_audits() == before


def test_partner_export_deactivation_ordering(planning, auth_env):
    from test_planning import ordered_advisory_race

    partner, operation, project = references(planning)
    activity = approve_in_project(planning, project, operation)
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning, auth_env, stack, partner["id"], "race-export@example.test"
        )
        account = next(
            row
            for row in planning["admin"].get("/api/v1/access/users").json()["items"]
            if row["email"] == "race-export@example.test"
        )
        deactivated, denied = ordered_advisory_race(
            planning["auth"],
            lambda: planning["admin"].patch(
                f"/api/v1/access/users/{account['id']}",
                headers=headers(planning["admin"]),
                json={"expected_version": account["version"], "deactivate": True},
            ),
            lambda: export(portal, activity["pta_id"]),
        )
        assert deactivated.status_code == 200, deactivated.text
        assert denied.status_code == 401


def test_partner_export_closed_finance_matches_portal(planning, auth_env):
    from test_closure import close_path, settled_activity
    from test_partner_portal import activity_partner
    from test_planning import post

    activity, _, version = settled_activity(planning)
    closed = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert closed.status_code == 200, closed.text
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning,
            auth_env,
            stack,
            activity_partner(planning["auth"], activity["id"]),
            "closed-export@example.test",
        )
        detail = portal.get(
            f"/api/v1/partner-portal/activities/{activity['id']}"
        ).json()
        response = export(portal, activity["pta_id"])
        assert response.status_code == 200, response.text
        row = activity_rows(response)[1][0]
        finance = detail["finance"]
        assert row[8] == finance["final_spending"]
        assert row[9] == finance["confirmed_transfer_amount"]
        assert row[11] == finance["reversement_required"]
        assert row[12] == finance["reversement_amount"]
        assert row[6] == "Clôturée"


def test_partner_export_current_placement_and_invisible_pta(planning, auth_env):
    from uuid import uuid4

    from test_planning import plan, post
    from test_transfers import approve_transfer, request_transfer

    partner, operation, project = references(planning)
    activity = approve_in_project(planning, project, operation)
    draft = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation, name="PRIVATE DRAFT"), "request_key": str(uuid4())},
    ).json()
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning, auth_env, stack, partner["id"], "placement-export@example.test"
        )
        before = export(portal, activity["pta_id"])
        assert [row[0] for row in activity_rows(before)[1]] == [activity["id"]]
        assert draft["id"] not in before.text
        requested = request_transfer(planning, activity)
        pending = export(portal, activity["pta_id"])
        assert activity_rows(pending)[1][0][6] == "Approuvée"
        moved = approve_transfer(planning, activity, requested)
        assert export(portal, activity["pta_id"]).status_code == 404
        destination = export(portal, moved["pta_id"])
        assert [row[0] for row in activity_rows(destination)[1]] == [activity["id"]]


def test_partner_export_validated_zero_and_closed_project(planning, auth_env):
    from test_annual_export import approve_zero_and_close
    from test_partner_portal import activity_partner
    from test_planning import patch

    activity = approve_zero_and_close(planning)
    closed = patch(
        planning["validator"],
        f"/api/v1/projects/{activity['project_id']}",
        {"expected_version": 1, "action": "close"},
    )
    assert closed.status_code == 200, closed.text
    with ExitStack() as stack:
        portal, _, _ = invite_partner(
            planning,
            auth_env,
            stack,
            activity_partner(planning["auth"], activity["id"]),
            "zero-export@example.test",
        )
        response = export(portal, activity["pta_id"])
        assert response.status_code == 200, response.text
        assert activity_rows(response)[1][0][8:14] == ["0", "", "", "0", "", ""]
