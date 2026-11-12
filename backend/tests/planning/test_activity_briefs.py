from datetime import date, timedelta
from uuid import uuid4

import pytest

import app.planning.routes as planning_routes
from app.planning.notifications.assignment_notifications import (
    deliver_assignment_notification,
)
from tests.planning.test_planning import admin as admin
from tests.planning.test_planning import patch, plan, post, put, references
from tests.planning.test_planning import planning as planning


def test_agent_saves_reopens_and_submits_a_title_only_draft(planning):
    _, category, project = references(planning)
    path = f"/api/v1/projects/{project['id']}/ptas/2027/activities"
    created = post(
        planning["agent"],
        path,
        {"request_key": str(uuid4()), "name": "Brouillon terrain"},
    )
    assert created.status_code == 201, created.text
    draft = created.json()
    assert draft["planned_start"] is None
    assert draft["planned_end"] is None
    assert draft["allocation"] is None
    assert draft["operations"] == []
    assert "submit" not in draft["allowed_actions"]
    assert planning["agent"].get("/api/v1/notifications").json()["count"] == 0

    end_only = post(
        planning["agent"],
        path,
        {
            "request_key": str(uuid4()),
            "name": "Brouillon sans début",
            "planned_end": "2027-05-01",
        },
    )
    assert end_only.status_code == 201, end_only.text
    filtered = planning["agent"].get(
        f"/api/v1/ptas/{draft['pta_id']}/activities?from=2027-01-01"
    )
    assert filtered.status_code == 200, filtered.text
    assert end_only.json()["id"] not in {row["id"] for row in filtered.json()["data"]}

    detail = planning["agent"].get(f"/api/v1/activities/{draft['id']}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["name"] == "Brouillon terrain"
    assert (
        post(
            planning["agent"],
            f"/api/v1/activities/{draft['id']}/submissions",
            {"expected_version": draft["version"]},
        ).status_code
        == 409
    )
    completed = patch(
        planning["agent"],
        f"/api/v1/activities/{draft['id']}",
        {
            **plan(category),
            "expected_version": draft["version"],
        },
    )
    assert completed.status_code == 200, completed.text
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{draft['id']}/submissions",
        {"expected_version": completed.json()["version"]},
    )
    assert submitted.status_code == 201, submitted.text


def test_initial_drafts_are_visible_only_to_creator_and_assigned_agents(planning):
    _, category, project = references(planning)
    path = f"/api/v1/projects/{project['id']}/ptas/2027/activities"
    created = post(
        planning["agent"],
        path,
        {"request_key": str(uuid4()), "name": "Brouillon confidentiel"},
    ).json()
    detail_path = f"/api/v1/activities/{created['id']}"
    list_path = f"/api/v1/ptas/{created['pta_id']}/activities"
    context_path = f"/api/v1/projects/{project['id']}/ptas/2027"

    assert planning["agent"].get(detail_path).status_code == 200
    assert planning["agent"].get(context_path).json()["summary"]["draft"] == 1
    assert planning["supervisor"].get(context_path).json()["summary"]["draft"] == 0
    for client in (planning["agent2"], planning["supervisor"], planning["validator"]):
        assert client.get(detail_path).status_code == 404
        listing = client.get(list_path)
        assert listing.status_code == 200, listing.text
        assert created["id"] not in {row["id"] for row in listing.json()["data"]}
    assert planning["supervisor"].get(detail_path + "/history").status_code == 404
    assert planning["supervisor"].get(detail_path + "/documents").status_code == 404
    assert planning["supervisor"].get(detail_path + "/revisions").status_code == 404
    assert planning["supervisor"].get(detail_path + "/execution").status_code == 404
    assert (
        planning["supervisor"].get(detail_path + "/execution/history").status_code
        == 404
    )
    assert planning["supervisor"].get(detail_path + "/fiche.pdf").status_code == 404
    agent2_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]
    rejected_assignment = put(
        planning["validator"],
        detail_path + "/assignments",
        {"expected_version": created["version"], "agent_ids": [agent2_id]},
    )
    assert rejected_assignment.status_code == 404
    assert planning["agent"].get(detail_path).json()["version"] == created["version"]

    completed = patch(
        planning["agent"],
        detail_path,
        {**plan(category), "expected_version": created["version"]},
    ).json()
    submitted = post(
        planning["agent"],
        detail_path + "/submissions",
        {"expected_version": completed["version"]},
    )
    assert submitted.status_code == 201, submitted.text
    assert planning["supervisor"].get(detail_path).status_code == 200
    assert planning["supervisor"].get(context_path).json()["summary"]["review"] == 1

    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    reviewer_draft = post(
        planning["supervisor"],
        path,
        {
            "request_key": str(uuid4()),
            "name": "Brief du superviseur",
            "agent_ids": [agent_id],
        },
    ).json()
    reviewer_path = f"/api/v1/activities/{reviewer_draft['id']}"
    assert planning["supervisor"].get(reviewer_path).status_code == 200
    assert planning["agent"].get(reviewer_path).status_code == 200
    assert planning["agent2"].get(reviewer_path).status_code == 404
    assert planning["validator"].get(reviewer_path).status_code == 404
    assert planning["supervisor"].get(context_path).json()["summary"]["draft"] == 1
    assert planning["validator"].get(context_path).json()["summary"]["draft"] == 0


def test_removed_agent_notification_does_not_reveal_current_private_draft(
    planning, monkeypatch
):
    monkeypatch.setattr(
        planning_routes, "deliver_assignment_notification", lambda *_args: None
    )
    _, _category, project = references(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    agent2_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]
    created = post(
        planning["supervisor"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            "request_key": str(uuid4()),
            "name": "Brief confidentiel initial",
            "agent_ids": [agent_id],
        },
    ).json()
    notice = next(
        row
        for row in planning["agent"].get("/api/v1/notifications").json()["data"]
        if row["activity_id"] == created["id"]
    )

    reassigned = put(
        planning["supervisor"],
        f"/api/v1/activities/{created['id']}/assignments",
        {"expected_version": created["version"], "agent_ids": [agent2_id]},
    ).json()
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{created['id']}",
        {
            "name": "Titre privé modifié",
            "expected_version": reassigned["version"],
        },
    )
    assert changed.status_code == 200, changed.text
    hidden_activity = planning["agent"].get(f"/api/v1/activities/{created['id']}")
    assert hidden_activity.status_code == 404

    inbox = planning["agent"].get("/api/v1/notifications")
    assert inbox.status_code == 200, inbox.text
    assert created["id"] not in {row["activity_id"] for row in inbox.json()["data"]}
    hidden_read = patch(
        planning["agent"],
        f"/api/v1/notifications/{notice['id']}",
        {"expected_version": notice["version"]},
    )
    assert hidden_read.status_code == 404
    assert deliver_assignment_notification(planning["auth"], notice["id"]) == "skipped"


@pytest.mark.parametrize("creator", ["supervisor", "validator"])
def test_reviewer_brief_completed_by_assigned_agent_then_reviewed_by_creator(
    planning, creator
):
    _, category, project = references(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    today = date.today()
    if today.year != 2027:
        assert (
            post(
                planning["supervisor"],
                f"/api/v1/projects/{project['id']}/ptas",
                {"year": today.year, "name": "PTA courant"},
            ).status_code
            == 201
        )
    path = f"/api/v1/projects/{project['id']}/ptas/{today.year}/activities"
    body = {
        "request_key": str(uuid4()),
        "name": "Concertation communale",
        "planned_start": today.isoformat(),
        "planned_end": date(today.year + 1, 1, 1).isoformat(),
        "agent_ids": [agent_id],
    }
    created = post(planning[creator], path, body)
    assert created.status_code == 201, created.text
    item = created.json()
    assert item["state"] == "draft"
    assert item["planned_end"] == body["planned_end"]
    assert item["allocation"] is None
    assert item["description"] == "" and item["operations"] == []
    assert item["agent_ids"] == [agent_id]
    notification = planning["agent"].get("/api/v1/notifications").json()
    assert notification["count"] == 1
    assert notification["data"][0]["kind"] == "assignment"
    assert notification["data"][0]["activity_id"] == item["id"]
    assert not {
        "agents",
        "creator",
        "current_revision_number",
        "current_submitter",
        "latest_decision_actor",
        "project_name",
        "partner_name",
        "pta_name",
    }.intersection(item)
    detail = planning[creator].get(f"/api/v1/activities/{item['id']}").json()
    assert detail["agents"] == [
        {
            "id": agent_id,
            "email": planning["agent"]
            .get("/api/v1/auth/session")
            .json()["user"]["email"],
            "full_name": planning["agent"]
            .get("/api/v1/auth/session")
            .json()["user"]["full_name"],
        }
    ]
    assert detail["project_name"] == project["name"]
    assert detail["partner_name"]
    assert detail["pta_name"]
    creator_user = planning[creator].get("/api/v1/auth/session").json()["user"]
    assert detail["creator"] == {
        "id": creator_user["id"],
        "email": creator_user["email"],
        "full_name": creator_user["full_name"],
    }
    assert detail["latest_decision_actor"] is None
    assert detail["current_revision_number"] is None
    assert detail["current_submitter"] is None
    assert "replace" not in item["allowed_actions"]
    assert post(planning[creator], path, body).status_code == 200
    assert post(planning[creator], path, {**body, "name": "Autre"}).status_code == 409
    url = f"/api/v1/activities/{item['id']}"
    assert "submit" not in planning["agent"].get(url).json()["allowed_actions"]
    assert (
        post(
            planning["agent"], url + "/submissions", {"expected_version": 1}
        ).status_code
        == 409
    )
    complete = {
        **plan(
            category,
            planned_start=today.isoformat(),
            planned_end=(today + timedelta(days=90)).isoformat(),
        ),
        "expected_version": 1,
    }
    assert patch(planning["supervisor"], url, complete).status_code == 403
    assert patch(planning["agent2"], url, complete).status_code == 404
    updated = patch(planning["agent"], url, complete)
    assert updated.status_code == 200, updated.text
    submitted = post(
        planning["agent"],
        url + "/submissions",
        {"expected_version": updated.json()["version"]},
    )
    assert submitted.status_code == 201, submitted.text
    revision = submitted.json()
    submitted_detail = planning[creator].get(url).json()
    assert submitted_detail["current_revision_number"] == 1
    assert submitted_detail["current_submitter"] == {
        "id": agent_id,
        "email": planning["agent"].get("/api/v1/auth/session").json()["user"]["email"],
        "full_name": planning["agent"]
        .get("/api/v1/auth/session")
        .json()["user"]["full_name"],
    }
    assert (
        post(
            planning["supervisor"],
            url + f"/revisions/{revision['id']}/decisions",
            {
                "decision": "prevalidate",
                "expected_version": revision["activity_version"],
                "reason": "   ",
            },
        ).status_code
        == 422
    )
    reviewed = post(
        planning["supervisor"],
        url + f"/revisions/{revision['id']}/decisions",
        {
            "decision": "prevalidate",
            "expected_version": revision["activity_version"],
            "reason": "Programmation vérifiée.",
        },
    )
    assert reviewed.status_code == 201, reviewed.text
    assert reviewed.json()["reason"] == "Programmation vérifiée."
    approved = post(
        planning["validator"],
        url + f"/revisions/{revision['id']}/decisions",
        {
            "decision": "approve",
            "expected_version": reviewed.json()["activity_version"],
            "reason": "Validation définitive confirmée.",
        },
    )
    assert approved.status_code == 201, approved.text
    assert approved.json()["reason"] == "Validation définitive confirmée."
    validator = planning["validator"].get("/api/v1/auth/session").json()["user"]
    assert planning[creator].get(url).json()["latest_decision_actor"] == {
        "id": validator["id"],
        "email": validator["email"],
        "full_name": validator["full_name"],
    }
    if creator == "supervisor":
        from alembic import command
        from alembic.config import Config
        from alembic.script import ScriptDirectory
        from sqlalchemy import text
        from sqlalchemy.orm import Session

        with Session(planning["auth"].engine) as db, db.begin():
            db.execute(text("DELETE FROM pta_activity_workflow_notification"))
            db.execute(text("DELETE FROM pta_activity_assignment_notification"))
        with pytest.raises(
            RuntimeError, match="Preserve positive decision observations"
        ):
            command.downgrade(Config("alembic.ini"), "0028_activity_briefs")
        with Session(planning["auth"].engine) as db:
            assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
                ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
            )
    # The same reviewer remains excluded from financial approval.
    from tests.execution.test_execution import execution_path

    detail = planning["agent"].get(url + "/execution").json()
    for operation in detail["operations"]:
        recorded = patch(
            planning["agent"],
            execution_path(detail, operation),
            {
                "action": "record",
                "expected_version": detail["version"],
                "expected_approved_revision_id": detail["approved_revision_id"],
                "actual_spent": operation["approved_allocation"],
                "execution_completed": True,
                "execution_observation": "Terminé",
            },
        )
        assert recorded.status_code == 200, recorded.text
        detail = recorded.json()
    finance = post(
        planning["agent"],
        url + "/disbursement-requests",
        {
            "expected_version": detail["version"],
            "expected_approved_revision_id": detail["approved_revision_id"],
        },
    )
    assert finance.status_code == 201, finance.text
    request = finance.json()
    if creator == "validator":
        prevalidated = post(
            planning["supervisor"],
            url + f"/disbursement-requests/{request['id']}/decisions",
            {
                "decision": "prevalidate",
                "expected_version": request["activity_version"],
            },
        )
        assert prevalidated.status_code == 201, prevalidated.text
        request = prevalidated.json()
    denied = post(
        planning[creator],
        url + f"/disbursement-requests/{request['id']}/decisions",
        {
            "decision": "prevalidate" if creator == "supervisor" else "approve",
            "expected_version": request["activity_version"],
        },
    )
    assert denied.status_code == 409, denied.text


def test_decision_observation_migration_round_trip_when_unused(auth_env):
    from alembic import command
    from alembic.config import Config
    from alembic.script import ScriptDirectory
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import Session

    config = Config("alembic.ini")
    command.downgrade(config, "0028_activity_briefs")
    command.upgrade(config, "head")
    engine = create_engine(auth_env.url)
    with Session(engine) as db:
        assert db.scalar(text("SELECT version_num FROM alembic_version")) == (
            ScriptDirectory.from_config(config).get_current_head()
        )
    engine.dispose()


def test_brief_validation_visibility_and_atomic_audit(planning, monkeypatch):
    from sqlalchemy import func, select
    from sqlalchemy.orm import Session

    from app.auth.service import AuthService
    from app.planning.core.models import (
        Activity,
        ActivityAssignment,
        ActivityContributor,
    )

    _, _, project = references(planning)
    agent = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    reviewer = planning["supervisor"].get("/api/v1/auth/session").json()["user"]["id"]
    path = f"/api/v1/projects/{project['id']}/ptas/2027/activities"
    body = {
        "request_key": str(uuid4()),
        "name": "Brief",
        "planned_start": "2027-06-01",
        "agent_ids": [agent],
    }
    for invalid in (
        {"agent_ids": []},
        {"agent_ids": [agent, agent]},
        {"planned_start": "2028-01-01"},
        {"planned_end": "2027-05-31"},
        {"name": " "},
        {"allocation": "0"},
    ):
        assert (
            post(planning["supervisor"], path, {**body, **invalid}).status_code == 422
        )
    assert (
        post(
            planning["supervisor"], path, {**body, "agent_ids": [reviewer]}
        ).status_code
        == 409
    )
    assert post(planning["agent"], path, body).status_code == 403
    assert post(planning["admin"], path, body).status_code == 403
    assert planning["supervisor"].post(path, json=body).status_code == 403
    original = AuthService.business_audit

    def fail(self, db, action, *args, **kwargs):
        if action == "activity.create":
            raise RuntimeError("synthetic audit failure")
        return original(self, db, action, *args, **kwargs)

    with monkeypatch.context() as scoped:
        scoped.setattr(AuthService, "business_audit", fail)
        with pytest.raises(RuntimeError, match="synthetic audit"):
            post(planning["supervisor"], path, body)
    with Session(planning["auth"].engine) as db:
        for model in (Activity, ActivityAssignment, ActivityContributor):
            assert db.scalar(select(func.count()).select_from(model)) == 0
    created = post(planning["supervisor"], path, body)
    assert created.status_code == 201, created.text
    item = created.json()
    assert planning["agent2"].get(f"/api/v1/activities/{item['id']}").status_code == 404
    listed = planning["agent"].get(f"/api/v1/ptas/{item['pta_id']}/activities").json()
    assert listed["count"] == 1 and listed["data"][0]["allocation"] is None
    assert listed["data"][0]["planned_end"] is None
    context = (
        planning["agent"].get(f"/api/v1/projects/{project['id']}/ptas/2027").json()
    )
    assert context["summary"]["draft"] == 1
    assert context["summary"]["approved_allocation"] == "0"
    history = planning["validator"].get("/api/v1/audit-events").json()
    assert not any(
        row.get("activity", {}).get("id") == item["id"]
        for row in history["data"]
        if row.get("activity")
    )
    filtered_history = planning["validator"].get(
        "/api/v1/audit-events", params={"activity": item["id"]}
    )
    assert filtered_history.status_code == 200
    assert filtered_history.json()["count"] == 0
    admin_history = planning["admin"].get(
        "/api/v1/audit-events", params={"activity": item["id"]}
    )
    assert admin_history.json()["count"] == 1
    audit_export = post(
        planning["validator"], "/api/v1/reports/audit/exports", {"format": "csv"}
    )
    assert audit_export.status_code == 200
    assert "Brief" not in audit_export.text
    export = post(
        planning["validator"],
        f"/api/v1/ptas/{item['pta_id']}/exports",
        {"format": "csv"},
    )
    assert export.status_code == 200 and "Brief" not in export.text


def test_brief_migration_preserves_complete_legacy_data_and_refuses_loss(planning):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import text
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.orm import Session

    _, category, project = references(planning)
    body = {**plan(category), "request_key": str(uuid4())}
    path = f"/api/v1/projects/{project['id']}/ptas/2027/activities"
    old = post(planning["agent"], path, body).json()
    command.downgrade(Config("alembic.ini"), "0027_pta_metadata")
    command.upgrade(Config("alembic.ini"), "head")
    assert (
        planning["agent"].get(f"/api/v1/activities/{old['id']}").json()["allocation"]
        == old["allocation"]
    )
    agent = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    item = post(
        planning["supervisor"],
        path,
        {
            "request_key": str(uuid4()),
            "name": "Brief",
            "planned_start": "2027-01-01",
            "agent_ids": [agent],
        },
    ).json()
    with pytest.raises(
        RuntimeError, match="Preserve Activity assignment notifications"
    ):
        command.downgrade(Config("alembic.ini"), "0031_resumable_activity_drafts")
    with Session(planning["auth"].engine) as db, db.begin():
        db.execute(text("DELETE FROM pta_activity_assignment_notification"))
    with pytest.raises(RuntimeError, match="Preserve Activity briefs"):
        command.downgrade(Config("alembic.ini"), "0027_pta_metadata")
    with Session(planning["auth"].engine) as db:
        with pytest.raises(IntegrityError):
            db.execute(
                text("UPDATE pta_activity SET allocation=0 WHERE id=:id"),
                {"id": item["id"]},
            )
        db.rollback()
        with pytest.raises(Exception, match="immutable PTA"):
            db.execute(
                text(
                    "UPDATE pta_activity_contributor SET kind='content' "
                    "WHERE activity_id=:id"
                ),
                {"id": item["id"]},
            )
        db.rollback()


def test_reviewer_creator_who_later_edits_cannot_review_after_role_change(
    planning, auth_env
):
    from tests.planning.test_planning import login_existing, put

    _, category, project = references(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    reviewer_id = (
        planning["supervisor"].get("/api/v1/auth/session").json()["user"]["id"]
    )
    created = post(
        planning["supervisor"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            "request_key": str(uuid4()),
            "name": "Brief",
            "planned_start": "2027-01-01",
            "agent_ids": [agent_id],
        },
    ).json()
    url = f"/api/v1/activities/{created['id']}"

    def change_role(role):
        accounts = planning["admin"].get("/api/v1/access/users").json()["items"]
        account = next(row for row in accounts if row["id"] == reviewer_id)
        changed = patch(
            planning["admin"],
            f"/api/v1/access/users/{reviewer_id}",
            {"expected_version": account["version"], "role": role},
        )
        assert changed.status_code == 200, changed.text
        planning["auth"].policy = planning["auth"].policy.model_copy(
            update={"resend_seconds": 0}
        )
        planning["supervisor"].cookies.clear()
        login_existing(
            planning["supervisor"], auth_env.mailbox, "supervisor@example.test"
        )

    change_role("AGENT_SAISIE")
    assigned = put(
        planning["validator"],
        url + "/assignments",
        {"expected_version": created["version"], "agent_ids": [agent_id, reviewer_id]},
    )
    assert assigned.status_code == 200, assigned.text
    edited = patch(
        planning["supervisor"],
        url,
        {**plan(category), "expected_version": assigned.json()["version"]},
    )
    assert edited.status_code == 200, edited.text
    reassigned = put(
        planning["validator"],
        url + "/assignments",
        {"expected_version": edited.json()["version"], "agent_ids": [agent_id]},
    )
    assert reassigned.status_code == 200, reassigned.text
    change_role("AGENT_VERIFICATEUR")
    submitted = post(
        planning["agent"],
        url + "/submissions",
        {"expected_version": reassigned.json()["version"]},
    )
    assert submitted.status_code == 201, submitted.text
    revision = submitted.json()
    denied = post(
        planning["supervisor"],
        url + f"/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    )
    assert denied.status_code == 409 and denied.json()["code"] == "reviewer_contributed"


@pytest.mark.parametrize("creation_first", [True, False])
def test_brief_assignment_serializes_with_agent_deactivation(planning, creation_first):
    from tests.planning.test_planning import ordered_advisory_race

    _, _, project = references(planning)
    accounts = planning["admin"].get("/api/v1/access/users").json()["items"]
    agent = next(row for row in accounts if row["email"] == "agent@example.test")
    body = {
        "request_key": str(uuid4()),
        "name": "Brief concurrent",
        "planned_start": "2027-01-01",
        "agent_ids": [agent["id"]],
    }

    def create():
        return post(
            planning["supervisor"],
            f"/api/v1/projects/{project['id']}/ptas/2027/activities",
            body,
        )

    def deactivate():
        return patch(
            planning["admin"],
            f"/api/v1/access/users/{agent['id']}",
            {"expected_version": agent["version"], "deactivate": True},
        )

    results = ordered_advisory_race(
        planning["auth"],
        create if creation_first else deactivate,
        deactivate if creation_first else create,
    )
    assert [result.status_code for result in results] == (
        [201, 409] if creation_first else [200, 409]
    )


def test_agent_picker_search_and_cursor_scope(planning):
    path = "/api/v1/assignment-agents"
    first = planning["supervisor"].get(path + "?limit=1&q=agent").json()
    assert first["count"] == 2 and len(first["data"]) == 1 and first["next"]
    second = planning["supervisor"].get(first["next"]).json()
    assert second["count"] == 2 and second["data"][0]["id"] != first["data"][0]["id"]
    assert (
        planning["supervisor"].get(second["previous"]).json()["data"] == first["data"]
    )
    assert (
        planning["supervisor"]
        .get(first["next"].replace("q=agent", "q=unknown"))
        .status_code
        == 422
    )
    assert planning["supervisor"].get(path + "?q=agent2").json()["count"] == 1
    assert planning["agent"].get(path).status_code == 403
