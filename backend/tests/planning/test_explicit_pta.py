from tests.planning.test_planning import admin as admin
from tests.planning.test_planning import patch, post, references
from tests.planning.test_planning import planning as planning


def test_pta_created_before_activity_and_metadata_editing(planning):
    _, _, project = references(planning)
    path = f"/api/v1/projects/{project['id']}/ptas"
    body = {
        "year": 2029,
        "name": "Planification 2029",
        "description": "Objectifs annuels",
    }
    assert post(planning["agent"], path, body).status_code == 403
    created = post(planning["supervisor"], path, body)
    assert created.status_code == 201, created.text
    pta = created.json()
    assert pta["name"] == body["name"]
    assert post(planning["validator"], path, body).status_code == 409
    changed = patch(
        planning["validator"],
        f"/api/v1/ptas/{pta['id']}",
        {
            "name": "Planification révisée",
            "description": None,
            "expected_version": pta["version"],
        },
    )
    assert changed.status_code == 200, changed.text
    assert changed.json()["description"] is None
    assert (
        patch(
            planning["validator"],
            f"/api/v1/ptas/{pta['id']}",
            {"name": "Autre", "expected_version": pta["version"]},
        ).status_code
        == 409
    )
    assert (
        patch(
            planning["validator"],
            f"/api/v1/ptas/{pta['id']}",
            {
                "year": 2030,
                "name": "Autre",
                "expected_version": changed.json()["version"],
            },
        ).status_code
        == 422
    )


def test_pta_access_validation_and_audit(planning):
    _, _, project = references(planning)
    path = f"/api/v1/projects/{project['id']}/ptas"
    body = {"year": 2030, "name": "  PTA 2030  "}
    assert planning["validator"].post(path, json=body).status_code == 403
    assert post(planning["admin"], path, body).status_code == 403
    assert post(planning["validator"], path, {**body, "year": 2201}).status_code == 422
    assert post(planning["validator"], path, {**body, "name": " "}).status_code == 422
    assert (
        post(
            planning["validator"], path, {**body, "description": "x" * 4001}
        ).status_code
        == 422
    )
    created = post(planning["validator"], path, body)
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["name"] == "PTA 2030"
    assert (
        patch(
            planning["agent"],
            f"/api/v1/ptas/{item['id']}",
            {"name": "Non autorisé", "expected_version": 1},
        ).status_code
        == 403
    )
    listed = planning["supervisor"].get(path).json()["data"]
    assert next(row for row in listed if row["year"] == 2030)["name"] == "PTA 2030"
    assert "edit" in listed[0]["allowed_actions"]
    context = planning["agent"].get(f"{path}/2030").json()
    assert context["pta"]["name"] == "PTA 2030"
    assert "edit" not in context["pta"]["allowed_actions"]
    assert (
        patch(
            planning["supervisor"],
            f"/api/v1/ptas/{item['id']}",
            {
                "name": "Priorités annuelles",
                "description": "Objectif",
                "expected_version": 1,
            },
        ).status_code
        == 200
    )
    options = (
        planning["validator"]
        .get("/api/v1/audit-events/filter-options?kind=action&limit=100")
        .json()["data"]
    )
    assert "pta.export" not in {row["id"] for row in options}
    assert {"pta.create", "pta.update"} <= {row["id"] for row in options}
    exported = post(
        planning["validator"], f"/api/v1/ptas/{item['id']}/exports", {"format": "csv"}
    )
    assert exported.status_code == 200, exported.text
    events = planning["validator"].get("/api/v1/audit-events").json()["data"]
    assert "pta.export" not in {row["action"] for row in events}
    history_csv = post(
        planning["validator"], "/api/v1/reports/audit/exports", {"format": "csv"}
    )
    assert history_csv.status_code == 200, history_csv.text
    assert "PTA exporté" not in history_csv.text

    assert {"pta.create", "pta.update"} <= {row["action"] for row in events}


def test_pta_migration_round_trip_preserves_legacy_plan(planning):
    from alembic import command
    from alembic.config import Config

    _, _, project = references(planning)
    path = f"/api/v1/projects/{project['id']}/ptas"
    item = post(planning["validator"], path, {"year": 2029, "name": "PTA 2029"}).json()
    command.downgrade(Config("alembic.ini"), "0026_partner_description")
    command.upgrade(Config("alembic.ini"), "head")
    actual = planning["agent"].get(f"{path}/2029").json()["pta"]
    assert actual["id"] == item["id"]
    assert actual["name"] == "PTA 2029"
    assert actual["description"] is None
    assert actual["version"] == 1
    updated = patch(
        planning["validator"],
        f"/api/v1/ptas/{item['id']}",
        {"name": "Nom à conserver", "expected_version": 1},
    )
    assert updated.status_code == 200
    import pytest

    with pytest.raises(RuntimeError, match="Preserve PTA metadata"):
        command.downgrade(Config("alembic.ini"), "0026_partner_description")
    assert (
        planning["agent"].get(f"{path}/2029").json()["pta"]["name"] == "Nom à conserver"
    )


def test_activity_creation_requires_explicit_pta(planning):
    from uuid import uuid4

    from tests.planning.test_planning import plan

    _, operation_type, project = references(planning)
    path = f"/api/v1/projects/{project['id']}/ptas/2031"
    context = planning["agent"].get(path).json()
    assert "create_activity" not in context["allowed_actions"]
    body = {
        **plan(operation_type, planned_start="2031-01-01", planned_end="2031-03-31"),
        "request_key": str(uuid4()),
    }
    refused = post(planning["agent"], path + "/activities", body)
    assert refused.status_code == 409
    assert refused.json()["code"] == "pta_required"
    assert planning["agent"].get(path).json()["pta"] is None
    created = post(
        planning["supervisor"],
        f"/api/v1/projects/{project['id']}/ptas",
        {"year": 2031, "name": "Programme 2031"},
    )
    assert created.status_code == 201
    activity = post(planning["agent"], path + "/activities", body)
    assert activity.status_code == 201, activity.text
    assert activity.json()["pta_id"] == created.json()["id"]
    assert post(planning["agent"], path + "/activities", body).status_code == 200


def test_transfer_requires_reviewer_created_destination(planning):
    from tests.planning.test_amendments import approved_activity
    from tests.planning.test_transfers import approve_transfer

    activity, _ = approved_activity(planning)
    path = f"/api/v1/activities/{activity['id']}/transfers"
    body = {
        "expected_version": activity["version"],
        "expected_approved_revision_id": activity["approved_revision_id"],
        "reason": "Reprogrammer l’activité.",
        "planned_start": "2031-01-01",
        "planned_end": "2031-03-31",
    }
    refused = post(planning["agent"], path, body)
    assert refused.status_code == 409, refused.text
    assert refused.json()["code"] == "pta_required"
    destination = post(
        planning["supervisor"],
        f"/api/v1/projects/{activity['project_id']}/ptas",
        {"year": 2031, "name": "Programme suivant"},
    )
    assert destination.status_code == 201
    revision = post(planning["agent"], path, body)
    assert revision.status_code == 201, revision.text
    moved = approve_transfer(planning, activity, revision.json())
    assert moved["pta_id"] == destination.json()["id"]


def test_pre_cutover_pending_transfer_waits_for_explicit_destination(planning):
    from sqlalchemy import text

    from tests.planning.test_amendments import approved_activity

    activity, _ = approved_activity(planning)
    destination_path = f"/api/v1/projects/{activity['project_id']}/ptas"
    target = post(
        planning["supervisor"], destination_path, {"year": 2031, "name": "PTA 2031"}
    ).json()
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/transfers",
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": "Reprogrammer l’activité.",
            "planned_start": "2031-01-01",
            "planned_end": "2031-03-31",
        },
    ).json()
    decision_path = (
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions"
    )
    prevalidated = post(
        planning["supervisor"],
        decision_path,
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    # Reconstruct the persisted pre-cutover condition: immutable pending revision,
    # prevalidation already recorded, no destination PTA yet. No live tenant data.
    with planning["auth"].engine.begin() as db:
        db.execute(text("DELETE FROM pta_annual WHERE id=:id"), {"id": target["id"]})
    detail_path = f"/api/v1/activities/{activity['id']}"
    before = planning["agent"].get(detail_path).json()
    command = {
        "expected_version": prevalidated["activity_version"],
        "decision": "approve",
    }
    failed = post(planning["validator"], decision_path, command)
    assert failed.status_code == 409
    assert failed.json()["code"] == "pta_required"
    assert planning["agent"].get(detail_path).json() == before
    created = post(
        planning["supervisor"],
        destination_path,
        {"year": 2031, "name": "Programme suivant"},
    )
    assert created.status_code == 201
    accepted = post(planning["validator"], decision_path, command)
    assert accepted.status_code == 201, accepted.text
    assert planning["agent"].get(detail_path).json()["pta_id"] == created.json()["id"]


def test_project_choices_filter_before_cursor_pagination(planning):
    partner, _, project = references(planning)
    closed = patch(
        planning["validator"],
        f"/api/v1/projects/{project['id']}",
        {"action": "close", "expected_version": project["version"]},
    )
    assert closed.status_code == 200, closed.text
    active = post(
        planning["validator"],
        "/api/v1/projects",
        {"name": "Nouveau projet", "partner_id": partner["id"]},
    ).json()
    result = planning["agent"].get("/api/v1/projects?state=active&limit=1")
    assert result.status_code == 200
    assert result.json()["count"] == 1
    assert [row["id"] for row in result.json()["data"]] == [active["id"]]
    assert result.json()["next"] is None
    assert planning["agent"].get("/api/v1/projects?state=invalid").status_code == 422

    another_partner = post(
        planning["validator"], "/api/v1/partners", {"name": "Deuxième partenaire"}
    ).json()
    another = post(
        planning["validator"],
        "/api/v1/projects",
        {"name": "Autre projet", "partner_id": another_partner["id"]},
    ).json()
    first = planning["agent"].get("/api/v1/projects?state=active&limit=1").json()
    assert first["count"] == 2
    assert "state=active" in first["next"]
    second = planning["agent"].get(first["next"]).json()
    assert {first["data"][0]["id"], second["data"][0]["id"]} == {
        active["id"],
        another["id"],
    }
    assert "state=active" in second["previous"]
    assert planning["agent"].get(second["previous"]).json()["data"] == first["data"]
    assert (
        planning["agent"].get(first["next"].replace("&state=active", "")).status_code
        == 422
    )
    assert (
        planning["agent"]
        .get(first["next"].replace("state=active", "state=closed"))
        .status_code
        == 422
    )

    from openapi_spec_validator import validate

    schema = planning["agent"].app.openapi()
    validate(schema)
    parameter = next(
        p
        for p in schema["paths"]["/api/v1/projects"]["get"]["parameters"]
        if p["name"] == "state"
    )
    assert parameter["schema"]["anyOf"][0]["enum"] == ["active", "closed"]
