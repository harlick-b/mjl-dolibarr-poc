from tests.planning.test_planning import admin as admin
from tests.planning.test_planning import create_activity, patch, post, put, replace_body
from tests.planning.test_planning import planning as planning


def test_assignment_controls_work_but_preserves_viewing(planning):
    _, _, project, activity, original = create_activity(planning)
    agent = planning["agent"]
    other = planning["agent2"]
    first_id = agent.get("/api/v1/auth/session").json()["user"]["id"]
    other_id = other.get("/api/v1/auth/session").json()["user"]["id"]
    path = f"/api/v1/activities/{activity['id']}"
    assert activity["agent_ids"] == [first_id]
    assert other.get(path).status_code == 200
    assert other.get(path).json()["allowed_actions"] == ["read"]
    assert patch(other, path, replace_body(activity)).status_code == 403
    assert (
        post(
            other, path + "/submissions", {"expected_version": activity["version"]}
        ).status_code
        == 403
    )
    assert (
        put(
            planning["supervisor"],
            path + "/assignments",
            {"expected_version": activity["version"], "agent_ids": []},
        ).status_code
        == 422
    )
    reassigned = put(
        planning["supervisor"],
        path + "/assignments",
        {"expected_version": activity["version"], "agent_ids": [other_id]},
    )
    assert reassigned.status_code == 200, reassigned.text
    current = reassigned.json()
    assert patch(agent, path, replace_body(current)).status_code == 403
    assert (
        patch(
            other, path, replace_body(current, name="Updated by assigned Agent")
        ).status_code
        == 200
    )
    replay = post(
        agent, f"/api/v1/projects/{project['id']}/ptas/2027/activities", original
    )
    assert replay.status_code == 200, replay.text
    assert replay.json()["agent_ids"] == [other_id]
    assert agent.get(path).json()["allowed_actions"] == ["read"]
    stale = put(
        planning["validator"],
        path + "/assignments",
        {"expected_version": activity["version"], "agent_ids": [first_id, other_id]},
    )
    assert stale.status_code == 409
    assert other.get(path).json()["agent_ids"] == [other_id]
    latest = other.get(path).json()
    shared = put(
        planning["validator"],
        path + "/assignments",
        {"expected_version": latest["version"], "agent_ids": [first_id, other_id]},
    )
    assert shared.status_code == 200, shared.text
    assert set(shared.json()["agent_ids"]) == {first_id, other_id}
    for client in [agent, other]:
        assert "edit" in client.get(path).json()["allowed_actions"]


def test_reassignment_blocks_execution_finance_and_documents(planning):
    from tests.execution.test_documents import upload, withdraw
    from tests.execution.test_execution import (
        approved_execution_activity,
        execution_path,
    )
    from tests.planning.test_planning import ordered_advisory_race

    activity = approved_execution_activity(planning)
    agent, other = planning["agent"], planning["agent2"]
    other_id = other.get("/api/v1/auth/session").json()["user"]["id"]
    path = f"/api/v1/activities/{activity['id']}"
    document = upload(agent, activity["id"])
    assert document.status_code == 201, document.text
    start = {
        "action": "record",
        "actual_spent": None,
        "execution_completed": False,
        "execution_observation": "Progression initiale enregistrée.",
        "expected_version": activity["version"],
        "expected_approved_revision_id": activity["approved_revision_id"],
    }
    reassigned, waiting = ordered_advisory_race(
        planning["auth"],
        lambda: put(
            planning["validator"],
            path + "/assignments",
            {"expected_version": activity["version"], "agent_ids": [other_id]},
        ),
        lambda: patch(
            agent, execution_path(activity, activity["operations"][0]), start
        ),
    )
    assert reassigned.status_code == 200, reassigned.text
    assert waiting.status_code == 403, waiting.text
    current = reassigned.json()
    detail = agent.get(path + "/execution")
    assert detail.status_code == 200
    assert detail.json()["allowed_actions"] == ["read"]
    assert all(row["allowed_actions"] == [] for row in detail.json()["operations"])
    assert detail.json()["virement_context"]["can_submit"] is False
    assert (
        detail.json()["mutation_unavailable_reason"] == "activity_assignment_required"
    )
    assert upload(agent, activity["id"]).status_code == 403
    assert withdraw(agent, activity["id"], document.json()["id"]).status_code == 403
    docs = agent.get(path + "/documents")
    assert docs.status_code == 200
    assert docs.json()["data"][0]["allowed_actions"] == []
    basis = {
        "expected_version": current["version"],
        "expected_approved_revision_id": current["approved_revision_id"],
    }
    for suffix, extra in [
        ("/funding-requests", {}),
        ("/disbursement-requests", {}),
        ("/zero-spending-declarations", {"reason": "No expense"}),
    ]:
        response = post(agent, path + suffix, {**basis, **extra})
        assert response.status_code == 403, (suffix, response.text)
    from uuid import uuid4

    identifier = str(uuid4())
    version = {"expected_version": current["version"]}
    reason = {**version, "reason": "Responsibility reassigned"}
    amendment = {**basis, "reason": "Plan correction"}
    commands = [
        ("/closure", version),
        (
            "/virement-requests",
            {**version, "expected_disbursement_request_id": identifier},
        ),
        ("/amendments", amendment),
        (f"/amendments/{identifier}/cancellation", amendment),
        ("/withdrawals", amendment),
        (
            f"/withdrawals/{identifier}/cancellation",
            {**amendment, "expected_revision_id": identifier},
        ),
        (
            "/transfers",
            {**amendment, "planned_start": "2028-01-01", "planned_end": "2028-02-01"},
        ),
        (
            f"/transfers/{identifier}/cancellation",
            {**amendment, "expected_revision_id": identifier},
        ),
    ]
    for collection in [
        "funding-requests",
        "disbursement-requests",
        "virement-requests",
    ]:
        commands.append((f"/{collection}/{identifier}/cancellation", reason))
    for resource, date_field in [
        ("confirmation", "transfer_date"),
        ("reversement", "return_date"),
    ]:
        base = f"/virement-requests/{identifier}/{resource}"
        commands.extend(
            [
                (base, {**version, date_field: "2026-11-07"}),
                (base + "/corrections", {**reason, date_field: "2026-11-07"}),
            ]
        )
    for suffix, body in commands:
        response = post(agent, path + suffix, body)
        assert response.status_code == 403, (suffix, response.text)
    started = patch(
        other,
        execution_path(current, current["operations"][0]),
        {**start, "expected_version": current["version"]},
    )
    assert started.status_code == 200, started.text
