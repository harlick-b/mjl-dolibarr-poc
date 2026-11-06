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

    page = planning["validator"].get("/api/v1/audit-events?limit=2")
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
    all_rows = planning["validator"].get("/api/v1/audit-events").json()["data"]
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
    unchanged = planning["validator"].get("/api/v1/audit-events?limit=2").json()
    historical_actor = next(
        row for row in unchanged["data"] if row["action"] == "activity.create"
    )["actor"]
    assert historical_actor == {
        "id": activity["actor"]["id"],
        "email": "agent@example.test",
        "full_name": activity["actor"]["full_name"],
    }

    following = planning["validator"].get(page.json()["next"])
    assert following.status_code == 200, following.text
    assert following.json()["previous"]
    assert {row["id"] for row in following.json()["data"]}.isdisjoint(
        {row["id"] for row in payload["data"]}
    )
    back = planning["validator"].get(following.json()["previous"])
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
    first = planning["validator"].get("/api/v1/audit-events?limit=1").json()
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
    }


def test_history_filters_apply_before_pagination_and_bind_cursors(planning):
    client = planning["validator"]
    for name in ["Recherche cible A", "Recherche cible B", "Sans rapport"]:
        assert post(client, "/api/v1/partners", {"name": name}).status_code == 201
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

    client = planning["validator"]
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
