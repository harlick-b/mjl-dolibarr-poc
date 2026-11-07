# ruff: noqa: F811
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.auth.models import Audit
from tests.planning.test_planning import admin, patch, planning, post  # noqa: F401


def test_catalog_edits_are_authorized_atomic_and_reject_stale_changes(
    planning, monkeypatch
):
    validator = planning["validator"]
    partner = post(
        validator, "/api/v1/partners", {"name": "Original", "description": "Before"}
    ).json()
    path = f"/api/v1/partners/{partner['id']}"
    body = {
        "name": "Revised",
        "description": "After",
        "expected": {"name": "Original", "description": "Before"},
    }
    for role in ("agent", "supervisor", "admin"):
        assert patch(planning[role], path, body).status_code == 403
    saved = patch(validator, path, body)
    assert saved.status_code == 200, saved.text
    assert saved.json()["description"] == "After"
    assert patch(validator, path, body).status_code == 409
    body["expected"] = {"name": "Revised", "description": "After"}
    assert patch(validator, path, body).status_code == 200
    project = post(
        validator, "/api/v1/projects", {"name": "Project", "partner_id": partner["id"]}
    ).json()
    project_path = f"/api/v1/projects/{project['id']}"
    edit = {
        "action": "edit",
        "name": "New project",
        "expected_version": project["version"],
    }
    for role in ("agent", "supervisor", "admin"):
        assert patch(planning[role], project_path, edit).status_code == 403
    result = patch(validator, project_path, edit)
    assert result.status_code == 200, result.text
    assert result.json()["name"] == "New project"
    assert patch(validator, project_path, edit).status_code == 409
    with Session(planning["auth"].engine) as db:
        changes = list(
            db.scalars(
                select(Audit).where(
                    Audit.action.in_(["partner.update", "project.update"])
                )
            )
        )
        assert len(changes) == 2
        assert changes[0].business["before"]["name"] == "Original"
        assert changes[0].business["after"]["name"] == "Revised"

    def fail(*args, **kwargs):
        raise SQLAlchemyError("synthetic audit failure")

    monkeypatch.setattr(planning["auth"], "business_audit", fail)
    body["name"] = "Rolled back"
    assert patch(validator, path, body).status_code == 503
    assert validator.get("/api/v1/partners").json()["data"][0]["name"] == "Revised"


def test_planning_projections_are_complete_filtered_and_internal(planning):
    from uuid import uuid4

    from tests.planning.test_planning import plan, references

    _, category, project = references(planning)
    activity = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(category), "request_key": str(uuid4())},
    )
    assert activity.status_code == 201, activity.text
    item = activity.json()
    index = planning["validator"].get("/api/v1/ptas")
    assert index.status_code == 200, index.text
    row = index.json()["data"][0]
    assert row["summary"] == {
        "activities": 1,
        "approved": 0,
        "review": 0,
        "correction": 0,
        "draft": 1,
        "approved_allocation": "0",
    }
    assert row["project_name"] == project["name"]
    path = f"/api/v1/ptas/{item['pta_id']}/activities"
    result = planning["agent"].get(path)
    assert result.status_code == 200, result.text
    detail = result.json()["data"][0]
    assert detail["planned_start"] == "2027-11-30"
    assert detail["planned_end"] == "2028-02-29"
    assert detail["operation_count"] == 2
    assert detail["revision_number"] is None
    assert planning["agent"].get(path, params={"q": "missing"}).json()["count"] == 0
    assert (
        planning["agent"].get(path, params={"state": "approved"}).json()["count"] == 0
    )
    assert planning["agent"].get(path, params={"state": "invented"}).status_code == 422
    assert planning["admin"].get("/api/v1/ptas").status_code == 403


def test_pta_page_summary_query_count_does_not_grow_with_rows(planning):
    from uuid import uuid4

    from sqlalchemy import event

    from tests.planning.test_planning import plan, references

    _, category, project = references(planning)
    for year in (2027, 2028, 2029):
        created = post(
            planning["agent"],
            f"/api/v1/projects/{project['id']}/ptas/{year}/activities",
            {
                **plan(
                    category,
                    planned_start=f"{year}-01-01",
                    planned_end=f"{year}-03-01",
                ),
                "request_key": str(uuid4()),
            },
        )
        assert created.status_code == 201, created.text

    statements = []

    def record(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    engine = planning["auth"].engine
    event.listen(engine, "before_cursor_execute", record)
    try:
        small = planning["validator"].get("/api/v1/ptas?limit=1")
        assert small.status_code == 200, small.text
        small_count = len(statements)
        statements.clear()
        full = planning["validator"].get("/api/v1/ptas?limit=100")
        assert full.status_code == 200, full.text
        assert len(statements) == small_count
        assert full.json()["count"] == 3
        assert len(full.json()["data"]) == 3
        assert all(row["summary"]["draft"] == 1 for row in full.json()["data"])
    finally:
        event.remove(engine, "before_cursor_execute", record)
