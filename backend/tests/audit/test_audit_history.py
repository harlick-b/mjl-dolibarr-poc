from urllib.parse import parse_qs, urlsplit

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.routes import public_changes
from app.auth.models import Audit, User
from tests.auth.test_access import admin as admin_fixture
from tests.auth.test_access import headers
from tests.planning.test_planning import planning as planning_fixture
from tests.planning.test_planning import post, references

planning = planning_fixture
admin = admin_fixture


def test_changes_project_existing_safe_shapes_and_never_raw_secrets():
    row = Audit(
        action="operation.execution_recorded",
        business={
            "before": {
                "actual_spent": None,
                "execution_completed": False,
                "password": "old",
            },
            "after": {
                "actual_spent": "9007199254740993",
                "execution_completed": True,
                "password": "new",
            },
        },
    )
    changes = public_changes(row)
    assert {
        "field": "Dépenses (F CFA)",
        "before": None,
        "after": "9007199254740993",
    } in changes
    assert {"field": "Réalisation terminée", "before": "Non", "after": "Oui"} in changes
    assert len(changes) == 2
    row.business = {}
    row.details = {
        "before_role": "AGENT_SAISIE",
        "role": "AGENT_VERIFICATEUR",
        "generation": "secret",
    }
    assert public_changes(row) == [
        {"field": "Rôle", "before": "Agent de saisie", "after": "Superviseur"}
    ]
    row.business = {"before_state": "submitted", "after_state": "approved"}
    assert public_changes(row) == [
        {"field": "État", "before": "Soumis", "after": "Approuvé"}
    ]
    row.business = {
        "before_state": "delivered",
        "after_state": "revoked",
        "before_user_state": "pending",
        "user_state": "pending",
    }
    assert public_changes(row) == [
        {"field": "État", "before": "Envoyée", "after": "Révoquée"}
    ]


def test_global_history_is_bounded_newest_first_and_activity_aware(planning):
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            "name": "Historique synthétique",
            "description": "Vérifier la projection globale.",
            "planned_start": "2027-01-10",
            "planned_end": "2027-02-10",
            "allocation": "1000",
            "operations": [
                {
                    "type_id": operation_type["id"],
                    "name": "Action",
                    "allocation": "1000",
                }
            ],
            "request_key": "97107dc0-11af-4c09-b09f-c9203ee90729",
        },
    )
    assert created.status_code == 201, created.text

    page = planning["admin"].get("/api/v1/audit-events?limit=2")
    assert page.status_code == 200, page.text
    payload = page.json()
    assert payload["object"] == "list"
    assert payload["count"] >= 3
    assert len(payload["data"]) == 2
    assert payload["next"] and payload["previous"] is None
    assert payload["data"][0]["id"] > payload["data"][1]["id"]
    assert all(
        "details" not in row and "business" not in row for row in payload["data"]
    )
    all_rows = planning["admin"].get("/api/v1/audit-events").json()["data"]
    assert not {"login", "otp_verify", "access_denied", "logout"} & {
        row["action"] for row in all_rows
    }
    activity = next(
        row for row in payload["data"] if row["action"] == "activity.create"
    )
    assert activity["activity"] == {
        "id": created.json()["id"],
        "reference": created.json()["reference"],
        "name": "Historique synthétique",
    }
    assert activity["actor"]["email"] == "agent@example.test"
    assert set(activity["actor"]) == {"id", "email", "full_name"}
    assert activity["label"] == "Activité créée"
    assert {
        "field": "Nom",
        "before": None,
        "after": "Historique synthétique",
    } in activity["changes"]

    with Session(planning["auth"].engine) as db, db.begin():
        agent = db.scalar(select(User).where(User.email == "agent@example.test"))
        assert agent
        agent.role = "AGENT_VERIFICATEUR"
    unchanged = planning["admin"].get("/api/v1/audit-events?limit=2").json()
    historical_actor = next(
        row for row in unchanged["data"] if row["action"] == "activity.create"
    )["actor"]
    assert historical_actor == {
        "id": activity["actor"]["id"],
        "email": "agent@example.test",
        "full_name": activity["actor"]["full_name"],
    }

    following = planning["admin"].get(page.json()["next"])
    assert following.status_code == 200, following.text
    assert following.json()["previous"]
    assert {row["id"] for row in following.json()["data"]}.isdisjoint(
        {row["id"] for row in payload["data"]}
    )
    back = planning["admin"].get(following.json()["previous"])
    assert back.status_code == 200, back.text
    assert [row["id"] for row in back.json()["data"]] == [
        row["id"] for row in payload["data"]
    ]


def test_global_history_allows_only_validator_and_admin(planning):
    assert planning["validator"].get("/api/v1/audit-events").status_code == 200
    assert planning["admin"].get("/api/v1/audit-events").status_code == 200
    assert planning["agent"].get("/api/v1/audit-events").status_code == 403
    assert planning["supervisor"].get("/api/v1/audit-events").status_code == 403


def test_global_history_rejects_invalid_pagination(planning):
    assert planning["validator"].get("/api/v1/audit-events?limit=0").status_code == 422
    assert (
        planning["validator"].get("/api/v1/audit-events?cursor=invalid").status_code
        == 422
    )
    first = planning["admin"].get("/api/v1/audit-events?limit=1").json()
    token = parse_qs(urlsplit(first["next"]).query)["cursor"][0]
    tampered = ("A" if token[0] != "A" else "B") + token[1:]
    assert (
        planning["validator"]
        .get(f"/api/v1/audit-events?limit=1&cursor={tampered}")
        .status_code
        == 422
    )
    assert (
        planning["validator"]
        .get(f"/api/v1/audit-events?limit=2&cursor={token}")
        .status_code
        == 422
    )
    foreign = planning["validator"].get("/api/v1/assignment-agents?limit=1").json()
    foreign_token = parse_qs(urlsplit(foreign["next"]).query)["cursor"][0]
    assert (
        planning["validator"]
        .get(f"/api/v1/audit-events?limit=1&cursor={foreign_token}")
        .status_code
        == 422
    )
    assert (
        planning["admin"]
        .get("/api/v1/audit-events", headers=headers(planning["admin"]))
        .status_code
        == 200
    )


def test_openapi_exposes_only_the_sanitized_history_shape(planning):
    schema = planning["validator"].get("/openapi.json").json()
    assert "/api/v1/audit-events" in schema["paths"]
    item = schema["components"]["schemas"]["AuditOutput"]
    assert set(item["properties"]) == {
        "id",
        "occurred_at",
        "changes",
        "subject",
        "action",
        "label",
        "outcome",
        "actor",
        "activity",
        "reason",
        "facts",
        "milestone",
        "revision_id",
        "amendment_id",
    }


def test_history_filters_apply_before_pagination_and_bind_cursors(planning):
    client = planning["admin"]
    for name in ["Recherche cible A", "Recherche cible B", "Sans rapport"]:
        assert (
            post(planning["validator"], "/api/v1/partners", {"name": name}).status_code
            == 201
        )
    result = client.get(
        "/api/v1/audit-events",
        params={"q": "Recherche cible", "action": "partner.create", "limit": 1},
    )
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["count"] == 2
    assert len(body["data"]) == 1
    assert body["data"][0]["subject"].startswith("Recherche cible")
    following = client.get(body["next"])
    assert following.status_code == 200
    assert following.json()["data"][0]["id"] != body["data"][0]["id"]
    query = parse_qs(urlsplit(body["next"]).query)
    query["q"] = ["Sans rapport"]
    assert (
        client.get(
            "/api/v1/audit-events",
            params={key: value[0] for key, value in query.items()},
        ).status_code
        == 422
    )
    assert (
        client.get(
            "/api/v1/audit-events?date_from=2027-02-01&date_to=2027-01-01"
        ).status_code
        == 422
    )
    assert client.get("/api/v1/audit-events?action=login").status_code == 422


def test_history_project_filters_include_project_and_activity_and_export(planning):
    from datetime import datetime
    from uuid import uuid4
    from zoneinfo import ZoneInfo

    from tests.planning.test_planning import plan

    client = planning["admin"]
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            **plan(operation_type),
            "request_key": str(uuid4()),
        },
    )
    assert created.status_code == 201, created.text
    activity = created.json()
    filters = {"project": project["id"]}
    result = client.get("/api/v1/audit-events", params=filters)
    assert result.status_code == 200, result.text
    rows = result.json()["data"]
    assert {row["action"] for row in rows} == {"project.create", "activity.create"}
    specific = client.get(
        "/api/v1/audit-events", params={**filters, "activity": activity["id"]}
    ).json()
    assert [row["action"] for row in specific["data"]] == ["activity.create"]
    today = datetime.now(ZoneInfo("Africa/Porto-Novo")).date().isoformat()
    dated = client.get(
        "/api/v1/audit-events", params={**filters, "date_from": today, "date_to": today}
    ).json()
    assert {row["id"] for row in dated["data"]} == {row["id"] for row in rows}
    actors = client.get("/api/v1/audit-events/filter-options?kind=actor").json()["data"]
    actor = next(row for row in actors if row["id"] == rows[0]["actor"]["id"])
    assert (
        client.get(
            "/api/v1/audit-events", params={**filters, "actor": actor["id"]}
        ).json()["count"]
        == 1
    )
    exported = client.post(
        "/api/v1/reports/audit/exports",
        params=filters,
        headers=headers(client),
        json={"format": "csv"},
    )
    assert exported.status_code == 200, exported.text
    assert "Projet créé" in exported.text and "Activité créée" in exported.text
    assert "Partenaire créé" not in exported.text
    for kind in ["actor", "activity", "project", "action"]:
        options = client.get(
            "/api/v1/audit-events/filter-options", params={"kind": kind, "limit": 1}
        )
        assert options.status_code == 200, options.text
        assert len(options.json()["data"]) == 1
        if options.json()["next"]:
            next_page = client.get(options.json()["next"])
            assert next_page.status_code == 200, next_page.text
            assert next_page.json()["data"][0]["id"] != options.json()["data"][0]["id"]
            token = parse_qs(urlsplit(options.json()["next"]).query)["cursor"][0]
            assert (
                client.get(
                    "/api/v1/audit-events/filter-options",
                    params={
                        "kind": "project" if kind != "project" else "actor",
                        "limit": 1,
                        "cursor": token,
                    },
                ).status_code
                == 422
            )
        assert (
            planning["agent"]
            .get("/api/v1/audit-events/filter-options", params={"kind": kind})
            .status_code
            == 403
        )


def test_validator_history_excludes_administration_in_rows_options_and_csv(planning):
    references(planning)
    admin_rows = planning["admin"].get("/api/v1/audit-events").json()["data"]
    assert "partner.create" in {row["action"] for row in admin_rows}
    validator = planning["validator"]
    rows = validator.get("/api/v1/audit-events").json()["data"]
    assert not any(
        row["action"].startswith(("partner.", "project.", "invitation_"))
        for row in rows
    )
    options = validator.get(
        "/api/v1/audit-events/filter-options?kind=action&limit=100"
    ).json()["data"]
    assert "partner.create" not in {row["id"] for row in options}
    assert (
        validator.get("/api/v1/audit-events?action=partner.create").status_code == 422
    )
    exported = post(validator, "/api/v1/reports/audit/exports", {"format": "csv"})
    assert exported.status_code == 200
    assert "Partenaire créé" not in exported.text
    assert "Invitation créée" not in exported.text


def test_activity_business_history_uses_global_events_and_resource_guards(planning):
    from uuid import uuid4

    from tests.planning.test_planning import plan

    _, category, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(category), "request_key": str(uuid4())},
    )
    assert created.status_code == 201
    identifier = created.json()["id"]
    path = f"/api/v1/activities/{identifier}/history"
    history = planning["agent"].get(path)
    assert history.status_code == 200, history.text
    global_rows = (
        planning["admin"]
        .get("/api/v1/audit-events", params={"activity": identifier})
        .json()["data"]
    )
    assert history.json()["data"] == global_rows
    assert history.json()["count"] == 1
    for role in ("agent2", "supervisor", "validator"):
        assert planning[role].get(path).status_code == 200
    assert planning["admin"].get(path).status_code == 403
    assert (
        planning["agent"].get(f"/api/v1/activities/{uuid4()}/history").status_code
        == 404
    )
    assert planning["agent"].get(path + "?limit=101").status_code == 422


def test_saved_changes_noops_and_rollback_preserve_business_evidence(
    planning, monkeypatch
):
    from uuid import uuid4

    from tests.planning.test_planning import patch, plan, put

    _, category, project = references(planning)
    agent = planning["agent"]
    created = post(
        agent,
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(category), "request_key": str(uuid4())},
    ).json()
    identifier = created["id"]
    path = f"/api/v1/activities/{identifier}"
    body = {
        key: created[key]
        for key in ("name", "description", "allocation", "planned_start", "planned_end")
    }
    body["operations"] = [
        {key: row[key] for key in ("id", "type_id", "name", "allocation")}
        for row in created["operations"]
    ]
    body["expected_version"] = created["version"]
    same = patch(agent, path, body)
    assert same.status_code == 200, same.text
    assert same.json()["version"] == created["version"]
    assert agent.get(path + "/history").json()["count"] == 1
    assigned = put(
        planning["supervisor"],
        path + "/assignments",
        {"expected_version": created["version"], "agent_ids": []},
    )
    assert assigned.status_code == 200
    assert agent.get(path + "/history").json()["count"] == 1
    body["description"] = "Description corrigée"
    body["operations"][0]["name"] = "Opération corrigée"
    saved = patch(agent, path, body)
    assert saved.status_code == 200, saved.text
    event = agent.get(path + "/history").json()["data"][0]
    assert event["action"] == "activity.replace"
    assert {
        "field": "Description",
        "before": created["description"],
        "after": "Description corrigée",
    } in event["changes"]
    assert any(row["after"] == "Opération corrigée" for row in event["changes"])
    original = planning["auth"].business_audit

    def reject_after_audit(*args, **kwargs):
        original(*args, **kwargs)
        from app.auth.service import AuthError

        raise AuthError(409, "test_rollback")

    monkeypatch.setattr(planning["auth"], "business_audit", reject_after_audit)
    failed = patch(
        agent,
        path,
        {**body, "name": "Must roll back", "expected_version": saved.json()["version"]},
    )
    assert failed.status_code == 409
    assert agent.get(path + "/history").json()["count"] == 2
    assert agent.get(path).json()["name"] == created["name"]


def test_representative_history_journey_finance_reasons_exports_and_partner_denial(
    planning, auth_env
):
    from contextlib import ExitStack

    from tests.execution.test_disbursement import collection, finish_activity
    from tests.execution.test_financial_returns import decide
    from tests.partner_portal.test_partner_portal import (
        activity_partner,
        invite_partner,
    )

    activity = finish_activity(planning)
    path = f"/api/v1/activities/{activity['id']}/history"
    requested = post(
        planning["agent"],
        collection(activity),
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
        },
    )
    assert requested.status_code == 201, requested.text
    decide(planning, collection(activity), requested.json(), "return")
    history = planning["agent"].get(path).json()
    actions = [row["action"] for row in history["data"]]
    for action in (
        "activity.create",
        "activity.submit",
        "activity.prevalidate",
        "activity.approve",
        "disbursement.submit",
        "disbursement.returned",
    ):
        assert actions.count(action) == 1
    returned = history["data"][0]
    assert returned["reason"] == "Montant à vérifier."
    assert returned["facts"] == [
        {
            "field": "Montant (F CFA)",
            "before": None,
            "after": requested.json()["amount"],
        }
    ]
    for role in ("admin", "validator"):
        client = planning[role]
        rows = client.get(
            "/api/v1/audit-events", params={"activity": activity["id"]}
        ).json()["data"]
        assert rows == history["data"]
        exported = client.post(
            "/api/v1/reports/audit/exports",
            params={"activity": activity["id"]},
            headers=headers(client),
            json={"format": "csv"},
        )
        assert exported.status_code == 200
        assert "Montant à vérifier." in exported.text
    first = planning["agent"].get(path + "?limit=1").json()
    second = planning["agent"].get(first["next"]).json()
    assert first["data"][0]["id"] != second["data"][0]["id"]
    assert planning["agent"].get(second["previous"]).json()["data"] == first["data"]
    partner_id = activity_partner(planning["auth"], activity["id"])
    with ExitStack() as stack:
        partner, _, _ = invite_partner(
            planning, auth_env, stack, partner_id, "history-partner@example.test"
        )
        assert partner.get(path).status_code == 403
        assert partner.get("/api/v1/audit-events").status_code == 403
        assert (
            post(
                partner, "/api/v1/reports/audit/exports", {"format": "csv"}
            ).status_code
            == 403
        )


def test_settlement_date_only_corrections_are_visible(planning):
    from tests.execution.test_reversement import confirmed_virement, reversement_path

    activity, _, request, confirmation, confirmation_path = confirmed_virement(planning)
    fixed = post(
        planning["agent"],
        confirmation_path + "/corrections",
        {
            "expected_version": confirmation["activity_version"],
            "transfer_date": "2026-10-28",
            "note": confirmation["note"],
            "reason": "Date réelle confirmée.",
        },
    )
    assert fixed.status_code == 201, fixed.text
    event = (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/history")
        .json()["data"][0]
    )
    assert event["changes"] == [
        {"field": "Date du virement", "before": "2026-10-27", "after": "2026-10-28"}
    ]
    path = reversement_path(activity, request)
    declared = post(
        planning["agent"],
        path,
        {
            "expected_version": fixed.json()["activity_version"],
            "return_date": "2026-10-28",
            "note": "Rendu",
        },
    )
    assert declared.status_code == 201, declared.text
    corrected = post(
        planning["agent"],
        path + "/corrections",
        {
            "expected_version": declared.json()["activity_version"],
            "return_date": "2026-10-29",
            "note": "Rendu",
            "reason": "Date réelle confirmée.",
        },
    )
    assert corrected.status_code == 201, corrected.text
    event = (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/history")
        .json()["data"][0]
    )
    assert event["changes"] == [
        {"field": "Date du reversement", "before": "2026-10-28", "after": "2026-10-29"}
    ]


def test_legacy_records_stay_intact_and_history_uses_time_then_id(planning):
    from datetime import UTC, datetime
    from uuid import uuid4

    with Session(planning["auth"].engine) as db, db.begin():
        old_auth = Audit(
            action="login",
            actor="anonymous",
            target=None,
            outcome="pending",
            occurred_at=datetime(2020, 1, 1, tzinfo=UTC),
            request_id=str(uuid4()),
        )
        newer_time = Audit(
            action="account_role_change",
            actor="anonymous",
            target=None,
            outcome="ok",
            occurred_at=datetime(2020, 1, 2, tzinfo=UTC),
            request_id=str(uuid4()),
        )
        older_time = Audit(
            action="account_role_change",
            actor="anonymous",
            target=None,
            outcome="ok",
            occurred_at=datetime(2020, 1, 1, tzinfo=UTC),
            request_id=str(uuid4()),
        )
        db.add_all([old_auth, newer_time, older_time])
        db.flush()
        auth_id, newer_id, older_id = old_auth.id, newer_time.id, older_time.id
    admin = planning["admin"]
    first = admin.get("/api/v1/audit-events?action=account_role_change&limit=1").json()
    assert first["data"][0]["id"] == newer_id
    assert first["data"][0]["changes"] == []
    assert first["data"][0]["reason"] is None
    second = admin.get(first["next"]).json()
    assert second["data"][0]["id"] == older_id
    assert admin.get(second["previous"]).json()["data"] == first["data"]
    with Session(planning["auth"].engine) as db:
        assert db.get(Audit, auth_id).outcome == "pending"
