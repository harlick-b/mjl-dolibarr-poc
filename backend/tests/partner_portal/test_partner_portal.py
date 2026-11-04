# ruff: noqa: F401, F811
from contextlib import ExitStack
from io import BytesIO
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import Session

from app.auth.models import Audit, User
from app.planning.models import Activity, AnnualPTA, Project
from tests.auth.test_access import PASSWORD, activate, headers
from tests.auth.test_recovery import (
    NEW_PASSWORD,
    enable_recovery,
    recovery_proof,
    request,
)
from tests.execution.test_closure import close_path, settled_activity
from tests.execution.test_reversement import reversement_path
from tests.planning.test_amendments import edit_amendment, open_amendment
from tests.planning.test_planning import (
    admin,
    ordered_advisory_race,
    plan,
    planning,
    post,
    references,
)
from tests.planning.test_transfers import approve_transfer, request_transfer
from tests.planning.test_withdrawals import request_withdrawal
from tests.reports.test_annual_export import approve_zero_and_close


def pdf_text(response):
    return "\n".join(
        page.extract_text() or "" for page in PdfReader(BytesIO(response.content)).pages
    )


def activity_partner(auth, activity_id):
    with Session(auth.engine) as db:
        activity = db.get(Activity, activity_id)
        pta = db.get(AnnualPTA, activity.pta_id) if activity else None
        project = db.get(Project, pta.project_id) if pta else None
        assert project
        return project.partner_id


def approve_in_project(clients, project, operation_type, *, name="Activité portail"):
    created = post(
        clients["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type, name=name), "request_key": str(uuid4())},
    ).json()
    revision = post(
        clients["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    prevalidated = post(
        clients["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    approved = post(
        clients["validator"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text
    return clients["agent"].get(f"/api/v1/activities/{created['id']}").json()


def invite_partner(clients, auth_env, stack, partner_id, email):
    invitation = clients["admin"].post(
        "/api/v1/access/invitations",
        headers=headers(clients["admin"]),
        json={
            "email": email,
            "full_name": "Partner User",
            "role": "PARTENAIRE",
            "partner_id": partner_id,
        },
    )
    assert invitation.status_code == 201, invitation.text
    client = stack.enter_context(
        TestClient(clients["admin"].app, base_url="http://localhost")
    )
    refreshed_auth = client.app.state.auth
    refreshed_auth.policy = refreshed_auth.policy.model_copy(
        update={"lifecycle_database": refreshed_auth.engine.url.database}
    )
    clients["auth"] = refreshed_auth
    identity = activate(client, auth_env.mailbox, email)
    return client, identity, invitation.json()


def test_partner_identity_reads_only_its_approved_portfolio(planning, auth_env):
    first_partner, operation_type, project = references(planning)
    activity = approve_in_project(planning, project, operation_type)
    candidate = edit_amendment(
        planning,
        open_amendment(planning, activity),
        operation_type,
        "Contenu candidat interne",
    )
    draft = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            **plan(operation_type, name="Brouillon interne"),
            "request_key": str(uuid4()),
        },
    ).json()
    second_activity = approve_in_project(
        planning, project, operation_type, name="Deuxième activité approuvée"
    )
    draft_only_year = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2029/activities",
        {
            **plan(
                operation_type,
                name="Année brouillon interne",
                planned_start="2029-01-10",
                planned_end="2029-02-10",
            ),
            "request_key": str(uuid4()),
        },
    )
    assert draft_only_year.status_code == 201, draft_only_year.text
    draft_only_year = draft_only_year.json()
    second_partner, second_type, second_project = references(planning)
    foreign = approve_in_project(planning, second_project, second_type)

    with ExitStack() as stack:
        partner, identity, invitation = invite_partner(
            planning,
            auth_env,
            stack,
            first_partner["id"],
            "partner@example.test",
        )
        assert identity["user"] == {
            "id": invitation["user_id"],
            "email": "partner@example.test",
            "role": "PARTENAIRE",
            "partner_id": first_partner["id"],
        }

        profile = partner.get("/api/v1/partner-portal/profile")
        assert profile.status_code == 200, profile.text
        assert profile.json() == {
            "id": first_partner["id"],
            "name": first_partner["name"],
        }
        assert (
            planning["agent"].get("/api/v1/partner-portal/profile").status_code == 403
        )
        assert (
            planning["admin"].get("/api/v1/partner-portal/profile").status_code == 403
        )
        contract = partner.get("/openapi.json").json()
        paths = contract["paths"]
        assert "get" in paths["/api/v1/partner-portal/activities/{activity_id}"]
        fiche_operation = paths[
            "/api/v1/partner-portal/activities/{activity_id}/fiche.pdf"
        ]["get"]
        assert "application/pdf" in fiche_operation["responses"]["200"]["content"]
        schemes = contract["components"]["securitySchemes"]
        assert schemes["LocalSession"]["name"] == "mjl_local"
        assert schemes["SecureSession"]["name"] == "__Host-mjl"
        assert {tuple(entry) for entry in fiche_operation["security"]} == {
            ("LocalSession",),
            ("SecureSession",),
        }
        assert (
            partner.get("/api/v1/partner-portal/projects?limit=101").status_code == 422
        )
        assert (
            partner.get("/api/v1/partner-portal/projects?cursor=invalid").status_code
            == 422
        )
        projects = partner.get("/api/v1/partner-portal/projects?limit=1")
        assert projects.status_code == 200, projects.text
        assert projects.json()["count"] == 1
        assert [row["id"] for row in projects.json()["data"]] == [project["id"]]

        ptas = partner.get(f"/api/v1/partner-portal/projects/{project['id']}/ptas")
        assert ptas.status_code == 200, ptas.text
        assert ptas.json()["count"] == 1
        pta = ptas.json()["data"][0]
        assert pta["year"] == 2027
        assert 2029 not in {row["year"] for row in ptas.json()["data"]}
        assert (
            partner.get(
                f"/api/v1/partner-portal/ptas/{draft_only_year['pta_id']}/activities"
            ).status_code
            == 404
        )
        assert pta["metrics"]["physical"] == {
            "closed_activities": 0,
            "approved_activities": 2,
        }

        activities = partner.get(f"/api/v1/partner-portal/ptas/{pta['id']}/activities")
        assert activities.status_code == 200, activities.text
        row = next(
            item for item in activities.json()["data"] if item["id"] == activity["id"]
        )
        assert row == {
            "id": activity["id"],
            "reference": activity["reference"],
            "name": activity["name"],
            "planned_start": activity["planned_start"],
            "planned_end": activity["planned_end"],
            "allocation": activity["allocation"],
            "state": "approved",
            "approved_revision": 1,
        }
        assert activities.json()["count"] == 2
        assert candidate["name"] != row["name"]
        assert draft["id"] not in {item["id"] for item in activities.json()["data"]}
        assert "Contenu candidat interne" not in activities.text
        assert "Brouillon interne" not in activities.text
        assert foreign["id"] not in {item["id"] for item in activities.json()["data"]}

        detail = partner.get(f"/api/v1/partner-portal/activities/{activity['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["finance"] is None
        assert detail.json()["decisions"] == [
            {
                "kind": "initial",
                "revision": 1,
                "decided_at": detail.json()["decisions"][0]["decided_at"],
            }
        ]
        assert set(detail.json()["decisions"][0]) == {
            "kind",
            "revision",
            "decided_at",
        }
        assert "Contenu candidat interne" not in detail.text
        assert "actor" not in detail.text
        assert "reason" not in detail.text
        assert (
            partner.get(
                f"/api/v1/partner-portal/activities/{foreign['id']}"
            ).status_code
            == 404
        )
        assert (
            partner.get(
                f"/api/v1/partner-portal/activities/{foreign['id']}/fiche.pdf"
            ).status_code
            == 404
        )
        assert (
            partner.get(f"/api/v1/partner-portal/activities/{draft['id']}").status_code
            == 404
        )

        fiche = partner.get(
            f"/api/v1/partner-portal/activities/{activity['id']}/fiche.pdf"
        )
        assert fiche.status_code == 200, fiche.text
        assert fiche.headers["content-type"] == "application/pdf"
        assert fiche.headers["cache-control"] == "no-store"
        content = pdf_text(fiche)
        assert "FICHE PARTENAIRE" in content
        assert activity["name"] in content
        for hidden in (
            "Contenu candidat interne",
            "Pièces justificatives",
            "Journal des événements",
            "@example.test",
        ):
            assert hidden not in content

        first_page = partner.get(
            f"/api/v1/partner-portal/ptas/{pta['id']}/activities?limit=1"
        ).json()
        assert first_page["count"] == 2 and first_page["next"]
        second_page = partner.get(first_page["next"]).json()
        assert second_page["count"] == 2 and second_page["previous"]
        assert {first_page["data"][0]["id"], second_page["data"][0]["id"]} == {
            activity["id"],
            second_activity["id"],
        }
        previous_page = partner.get(second_page["previous"]).json()
        assert previous_page["data"] == first_page["data"]
        activity_cursor = first_page["next"].split("cursor=", 1)[1]
        assert (
            partner.get(
                f"/api/v1/partner-portal/projects?limit=1&cursor={activity_cursor}"
            ).status_code
            == 422
        )

        assert (
            partner.get(
                f"/api/v1/partner-portal/projects/{second_project['id']}/ptas"
            ).status_code
            == 404
        )
        assert (
            partner.get(
                f"/api/v1/partner-portal/ptas/{foreign['pta_id']}/activities"
            ).status_code
            == 404
        )
        assert partner.get("/api/v1/projects").status_code == 403
        assert partner.get("/api/v1/access/users").status_code == 403
        for denied_path in (
            "/api/v1/notifications",
            "/api/v1/audit-events",
            f"/api/v1/activities/{activity['id']}/documents",
            f"/api/v1/activities/{activity['id']}/execution",
        ):
            assert partner.get(denied_path).status_code == 403, denied_path
        assert (
            partner.post(
                f"/api/v1/ptas/{pta['id']}/exports",
                headers=headers(partner),
                json={"format": "csv"},
            ).status_code
            == 403
        )
        assert (
            partner.post(
                "/api/v1/reports/audit/exports",
                headers=headers(partner),
                json={"format": "csv"},
            ).status_code
            == 403
        )
        assert (
            partner.get(f"/api/v1/activities/{activity['id']}/fiche.pdf").status_code
            == 403
        )


def test_partner_invitation_binding_constraints_and_deactivation(planning, auth_env):
    partner_row, operation_type, project = references(planning)
    activity = approve_in_project(planning, project, operation_type)
    partner_options = planning["admin"].get("/api/v1/partners?limit=100")
    assert partner_options.status_code == 200, partner_options.text
    assert partner_row["id"] in {item["id"] for item in partner_options.json()["data"]}
    invalid = [
        {
            "email": "missing@example.test",
            "full_name": "Missing Partner",
            "role": "PARTENAIRE",
        },
        {
            "email": "unexpected@example.test",
            "full_name": "Unexpected Partner",
            "role": "AGENT_SAISIE",
            "partner_id": partner_row["id"],
        },
    ]
    for body in invalid:
        response = planning["admin"].post(
            "/api/v1/access/invitations",
            headers=headers(planning["admin"]),
            json=body,
        )
        assert response.status_code == 422, response.text
    unknown = planning["admin"].post(
        "/api/v1/access/invitations",
        headers=headers(planning["admin"]),
        json={
            "email": "unknown@example.test",
            "full_name": "Unknown Partner",
            "role": "PARTENAIRE",
            "partner_id": str(uuid4()),
        },
    )
    assert unknown.status_code == 404, unknown.text

    with Session(planning["auth"].engine) as db:
        db.add(User(email="broken1@example.test", role="PARTENAIRE"))
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()
    with Session(planning["auth"].engine) as db:
        db.add(
            User(
                email="broken2@example.test",
                role="AGENT_SAISIE",
                partner_id=partner_row["id"],
            )
        )
        with pytest.raises(IntegrityError):
            db.flush()
        db.rollback()

    with ExitStack() as stack:
        partner, _identity, first_invitation = invite_partner(
            planning,
            auth_env,
            stack,
            partner_row["id"],
            "partner-one@example.test",
        )
        second = planning["admin"].post(
            "/api/v1/access/invitations",
            headers=headers(planning["admin"]),
            json={
                "email": "partner-two@example.test",
                "full_name": "Partner Two",
                "role": "PARTENAIRE",
                "partner_id": partner_row["id"],
            },
        )
        assert second.status_code == 201, second.text
        assert second.json()["partner_id"] == partner_row["id"]

        second_partner, _other_type, _other_project = references(planning)
        with Session(planning["auth"].engine) as db, pytest.raises(IntegrityError):
            db.execute(
                text("UPDATE auth_user SET partner_id=:partner WHERE id=:user"),
                {"partner": second_partner["id"], "user": first_invitation["user_id"]},
            )
            db.flush()
        assert (
            partner.get("/api/v1/partner-portal/profile").json()["id"]
            == partner_row["id"]
        )

        users = planning["admin"].get(
            "/api/v1/access/users?email=partner-one@example.test",
        )
        assert users.status_code == 200, users.text
        account = users.json()["items"][0]
        assert account["partner_id"] == partner_row["id"]
        role_change = planning["admin"].patch(
            f"/api/v1/access/users/{first_invitation['user_id']}",
            headers=headers(planning["admin"]),
            json={"expected_version": account["version"], "role": "AGENT_SAISIE"},
        )
        assert role_change.status_code == 409, role_change.text
        login_headers = headers(partner)
        deactivated, denied_detail = ordered_advisory_race(
            planning["auth"],
            lambda: planning["admin"].patch(
                f"/api/v1/access/users/{first_invitation['user_id']}",
                headers=headers(planning["admin"]),
                json={"expected_version": account["version"], "deactivate": True},
            ),
            lambda: partner.get(f"/api/v1/partner-portal/activities/{activity['id']}"),
        )
        assert deactivated.status_code == 200, deactivated.text
        assert denied_detail.status_code == 401, denied_detail.text
        assert deactivated.json()["state"] == "inactive"
        assert deactivated.json()["partner_id"] == partner_row["id"]
        denied_login = partner.post(
            "/api/v1/auth/login",
            headers=login_headers,
            json={"email": "partner-one@example.test", "password": PASSWORD},
        )
        assert denied_login.status_code == 401, denied_login.text
        assert partner.get("/api/v1/partner-portal/profile").status_code == 401
        with Session(planning["auth"].engine) as db:
            audit = db.scalar(
                select(Audit).where(
                    Audit.action == "account_deactivate",
                    Audit.target == first_invitation["user_id"],
                )
            )
            assert audit and audit.outcome == "ok"


def test_partner_projection_follows_effective_withdrawal_and_transfer(
    planning, auth_env
):
    partner_row, operation_type, project = references(planning)
    withdrawn = approve_in_project(
        planning, project, operation_type, name="Activité retirée"
    )
    withdrawal = request_withdrawal(planning, withdrawn)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{withdrawn['id']}/revisions/{withdrawal['id']}/decisions",
        {
            "expected_version": withdrawal["activity_version"],
            "decision": "prevalidate",
        },
    ).json()
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{withdrawn['id']}/revisions/{withdrawal['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text

    source = approve_in_project(
        planning, project, operation_type, name="Activité reportée"
    )
    transfer = request_transfer(planning, source)
    moved = approve_transfer(planning, source, transfer)

    with ExitStack() as stack:
        portal, _identity, _invitation = invite_partner(
            planning,
            auth_env,
            stack,
            partner_row["id"],
            "history@example.test",
        )
        ptas = portal.get(
            f"/api/v1/partner-portal/projects/{project['id']}/ptas?limit=100"
        )
        assert ptas.status_code == 200, ptas.text
        by_year = {row["year"]: row["id"] for row in ptas.json()["data"]}
        assert set(by_year) == {2028}
        assert (
            portal.get(
                f"/api/v1/partner-portal/ptas/{source['pta_id']}/activities?limit=100"
            ).status_code
            == 404
        )
        destination_rows = portal.get(
            f"/api/v1/partner-portal/ptas/{by_year[2028]}/activities?limit=100"
        ).json()
        assert [row["id"] for row in destination_rows["data"]] == [moved["id"]]
        assert destination_rows["data"][0]["planned_start"] == "2028-02-01"

        for suffix in ("", "/fiche.pdf"):
            denied = portal.get(
                f"/api/v1/partner-portal/activities/{withdrawn['id']}{suffix}"
            )
            assert denied.status_code == 404, denied.text

        detail = portal.get(f"/api/v1/partner-portal/activities/{moved['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["context"]["year"] == 2028
        assert detail.json()["planned_start"] == "2028-02-01"
        assert detail.json()["planned_end"] == "2028-08-31"
        assert [decision["kind"] for decision in detail.json()["decisions"]] == [
            "initial",
            "transfer",
        ]
        fiche = portal.get(f"/api/v1/partner-portal/activities/{moved['id']}/fiche.pdf")
        assert fiche.status_code == 200, fiche.text
        content = pdf_text(fiche)
        assert "2028" in content
        assert "01/02/2028 au 31/08/2028" in content
        assert "Transfert annuel approuvé" in content


def test_partner_closed_finance_uses_latest_definitive_facts(planning, auth_env):
    activity, request_row, version = settled_activity(planning)
    corrected = post(
        planning["agent2"],
        reversement_path(activity, request_row) + "/corrections",
        {
            "expected_version": version,
            "return_date": "2026-10-29",
            "note": "NOTE INTERNE PARTENAIRE MASQUÉE",
            "reason": "MOTIF INTERNE PARTENAIRE MASQUÉ",
        },
    )
    assert corrected.status_code == 201, corrected.text
    closed = post(
        planning["agent"],
        close_path(activity),
        {"expected_version": corrected.json()["activity_version"]},
    )
    assert closed.status_code == 200, closed.text
    partner_id = activity_partner(planning["auth"], activity["id"])

    with ExitStack() as stack:
        portal, _identity, _invitation = invite_partner(
            planning,
            auth_env,
            stack,
            partner_id,
            "finance-partner@example.test",
        )
        detail = portal.get(f"/api/v1/partner-portal/activities/{activity['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["finance"] == {
            "approved_allocation": "300000",
            "final_spending": "200000",
            "zero_spending": False,
            "confirmed_transfer_amount": "200000",
            "confirmed_transfer_date": "2026-10-27",
            "reversement_required": "100000",
            "reversement_amount": "100000",
            "reversement_date": "2026-10-29",
            "closed_at": closed.json()["closure"]["closed_at"],
        }
        assert "NOTE INTERNE" not in detail.text
        assert "MOTIF INTERNE" not in detail.text

        fiche = portal.get(
            f"/api/v1/partner-portal/activities/{activity['id']}/fiche.pdf"
        )
        content = pdf_text(fiche)
        for expected in (
            "FICHE PARTENAIRE",
            "300 000 F CFA",
            "200 000 F CFA",
            "100 000 F CFA",
            "29/10/2026",
        ):
            assert expected in content
        assert "NOTE INTERNE" not in content
        assert "MOTIF INTERNE" not in content
        with Session(planning["auth"].engine) as db:
            audit = db.scalar(
                select(Audit)
                .where(
                    Audit.action == "activity.fiche_generated",
                    Audit.actor == _invitation["user_id"],
                    Audit.target == activity["id"],
                )
                .order_by(Audit.id.desc())
            )
            assert audit and audit.details == {
                "role": "PARTENAIRE",
                "version": closed.json()["version"],
            }


def test_partner_zero_spending_result_and_fiche_audit_rollback(planning, auth_env):
    closed = approve_zero_and_close(planning)
    partner_id = activity_partner(planning["auth"], closed["id"])
    with ExitStack() as stack:
        portal, _identity, _invitation = invite_partner(
            planning,
            auth_env,
            stack,
            partner_id,
            "zero-partner@example.test",
        )
        detail = portal.get(f"/api/v1/partner-portal/activities/{closed['id']}")
        assert detail.status_code == 200, detail.text
        assert detail.json()["finance"] == {
            "approved_allocation": "300000",
            "final_spending": "0",
            "zero_spending": True,
            "confirmed_transfer_amount": None,
            "confirmed_transfer_date": None,
            "reversement_required": "0",
            "reversement_amount": None,
            "reversement_date": None,
            "closed_at": closed["closure"]["closed_at"],
        }

        def reject(_connection, _cursor, statement, parameters, _context, _many):
            if (
                "INSERT INTO auth_audit" in statement
                and "activity.fiche_generated" in str(parameters)
            ):
                raise OperationalError(statement, parameters, Exception("synthetic"))

        from sqlalchemy import event

        event.listen(planning["auth"].engine, "before_cursor_execute", reject)
        try:
            failed = portal.get(
                f"/api/v1/partner-portal/activities/{closed['id']}/fiche.pdf"
            )
        finally:
            event.remove(planning["auth"].engine, "before_cursor_execute", reject)
        assert failed.status_code == 503


def test_partner_recovery_preserves_permanent_binding(planning, auth_env):
    partner_row, _operation_type, _project = references(planning)
    with ExitStack() as stack:
        portal, _identity, invitation = invite_partner(
            planning,
            auth_env,
            stack,
            partner_row["id"],
            "partner-recovery@example.test",
        )
        enable_recovery(portal)
        assert request(portal, "partner-recovery@example.test").status_code == 202
        proof = recovery_proof(auth_env.mailbox, "partner-recovery@example.test")
        completed = portal.post(
            "/api/v1/auth/password-reset/complete",
            headers=headers(portal),
            json={
                **proof,
                "password": NEW_PASSWORD,
                "confirmation": NEW_PASSWORD,
            },
        )
        assert completed.status_code == 200, completed.text
        with Session(planning["auth"].engine) as db:
            user = db.get(User, invitation["user_id"])
            assert user and user.role == "PARTENAIRE"
            assert user.partner_id == partner_row["id"]


def test_partner_invitation_audit_failure_rolls_back(planning, monkeypatch):
    partner_row, _operation_type, _project = references(planning)
    auth = planning["auth"]
    original = auth.audit

    def fail_partner_audit(db, action, actor, target, outcome="ok", details=None):
        if action == "invitation_create":
            raise RuntimeError("synthetic audit failure")
        return original(db, action, actor, target, outcome, details)

    monkeypatch.setattr(auth, "audit", fail_partner_audit)
    with pytest.raises(RuntimeError, match="synthetic audit failure"):
        planning["admin"].post(
            "/api/v1/access/invitations",
            headers=headers(planning["admin"]),
            json={
                "email": "partner-rollback@example.test",
                "full_name": "Partner Rollback",
                "role": "PARTENAIRE",
                "partner_id": partner_row["id"],
            },
        )
    with Session(auth.engine) as db:
        assert not db.scalar(
            select(User).where(User.email == "partner-rollback@example.test")
        )
