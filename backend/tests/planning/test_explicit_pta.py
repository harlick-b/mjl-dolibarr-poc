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
    assert listed[0]["name"] == "PTA 2030"
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
