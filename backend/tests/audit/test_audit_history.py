from urllib.parse import parse_qs, urlsplit

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User
from tests.auth.test_access import admin as admin_fixture
from tests.auth.test_access import headers
from tests.planning.test_planning import planning as planning_fixture
from tests.planning.test_planning import post, references

planning = planning_fixture
admin = admin_fixture


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
    activity = next(
        row for row in payload["data"] if row["action"] == "activity.create"
    )
    assert activity["activity"] == {
        "id": created.json()["id"],
        "reference": created.json()["reference"],
        "name": "Historique synthétique",
    }
    assert activity["actor"]["email"] == "agent@example.test"
    assert set(activity["actor"]) == {"id", "email"}
    assert activity["label"] == "Activité créée"

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
        "action",
        "label",
        "outcome",
        "actor",
        "activity",
    }
