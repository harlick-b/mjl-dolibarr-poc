from concurrent.futures import ThreadPoolExecutor
from threading import Event, Lock
from uuid import uuid4

from tests.auth.test_access import headers
from tests.execution.test_closure import close_path
from tests.execution.test_reversement import confirmed_virement, reversement_path
from tests.execution.test_virement import submit_virement
from tests.planning.test_planning import (
    admin as admin_fixture,
)
from tests.planning.test_planning import (
    assign_agents,
    plan,
    post,
    references,
)
from tests.planning.test_planning import (
    planning as planning_fixture,
)

admin = admin_fixture
planning = planning_fixture


def test_dashboard_finance_uses_current_pta_execution_and_settlement_facts(planning):
    activity, _source, request, confirmation, _ = confirmed_virement(planning)
    path = f"/api/v1/ptas/{activity['pta_id']}/dashboard"

    before_return = planning["agent"].get(path)
    assert before_return.status_code == 200, before_return.text
    assert before_return.json()["finance"] == {
        "approved_allocation": "300000",
        "recorded_spending": "200000",
        "recorded_operations": 2,
        "approved_operations": 2,
        "closed_spending": "0",
        "reversement_due": "100000",
        "reversement_confirmed": None,
    }
    assert before_return.json()["attention"] == {
        "count": 1,
        "items": [
            {
                "activity_id": activity["id"],
                "reference": activity["reference"],
                "name": activity["name"],
                "reason": "reversement_required",
                "action": "declare_reversement",
                "destination": "execution",
            }
        ],
    }

    declared = post(
        planning["agent"],
        reversement_path(activity, request),
        {
            "expected_version": confirmation["activity_version"],
            "return_date": "2026-10-28",
            "note": "REVERSEMENT-TABLEAU-BORD",
        },
    )
    assert declared.status_code == 201, declared.text

    after_return = planning["supervisor"].get(path)
    assert after_return.status_code == 200, after_return.text
    assert after_return.json()["finance"]["reversement_due"] == "0"
    assert after_return.json()["finance"]["reversement_confirmed"] == "100000"
    assert after_return.json()["attention"] == {"count": 0, "items": []}

    closed = post(
        planning["agent"],
        close_path(activity),
        {"expected_version": declared.json()["activity_version"]},
    )
    assert closed.status_code == 200, closed.text
    final = planning["validator"].get(path)
    assert final.status_code == 200, final.text
    assert final.json()["financial"] == {
        "closed_spending": "200000",
        "approved_allocation": "300000",
    }
    assert final.json()["finance"]["closed_spending"] == "200000"

    denied = planning["admin"].get(path, headers=headers(planning["admin"]))
    assert denied.status_code == 403, denied.text


def test_dashboard_finance_preserves_a_known_zero_reversement(planning):
    activity, _source, _request, _confirmation, _ = confirmed_virement(
        planning,
        amounts=(100_000, 200_000),
        allocations=(100_000, 200_000),
    )

    response = planning["agent"].get(f"/api/v1/ptas/{activity['pta_id']}/dashboard")

    assert response.status_code == 200, response.text
    assert response.json()["finance"]["reversement_due"] == "0"
    assert response.json()["finance"]["reversement_confirmed"] is None
    assert response.json()["attention"] == {"count": 0, "items": []}


def test_dashboard_attention_follows_existing_planning_review_roles(planning):
    _partner, operation_type, project = references(planning)
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    created = assign_agents(planning, created, planning["agent"])
    path = f"/api/v1/ptas/{created['pta_id']}/dashboard"

    agent = planning["agent"].get(path)
    assert agent.status_code == 200, agent.text
    assert [
        (item["activity_id"], item["reason"], item["destination"])
        for item in agent.json()["attention"]["items"]
    ] == [(created["id"], "draft_to_complete", "planning")]

    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    supervisor = planning["supervisor"].get(path)
    assert supervisor.status_code == 200, supervisor.text
    assert supervisor.json()["attention"]["items"][0]["reason"] == (
        "planning_prevalidation"
    )

    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{submitted['id']}/decisions",
        {
            "expected_version": submitted["activity_version"],
            "decision": "prevalidate",
        },
    )
    assert prevalidated.status_code == 201, prevalidated.text
    validator = planning["validator"].get(path)
    assert validator.status_code == 200, validator.text
    assert validator.json()["attention"]["items"][0]["reason"] == ("planning_approval")


def test_dashboard_attention_exposes_an_eligible_financial_review(planning):
    activity, _source, _request = submit_virement(planning)
    response = planning["supervisor"].get(
        f"/api/v1/ptas/{activity['pta_id']}/dashboard"
    )
    assert response.status_code == 200, response.text
    item = next(
        row
        for row in response.json()["attention"]["items"]
        if row["activity_id"] == activity["id"]
    )
    assert (item["reason"], item["action"], item["destination"]) == (
        "virement_prevalidation",
        "review_finance",
        "execution",
    )


def test_page_projections_count_projects_and_resolve_partner_names(planning):
    validator = planning["validator"]
    assert validator.get("/api/v1/projects").json()["data"] == []
    partner, _, project = references(planning)
    empty = post(validator, "/api/v1/partners", {"name": "Sans projet"}).json()
    partners = validator.get("/api/v1/partners").json()["data"]
    assert {item["id"]: item["project_count"] for item in partners} == {
        partner["id"]: 1,
        empty["id"]: 0,
    }
    projects = validator.get("/api/v1/projects").json()["data"]
    assert len(projects) == 1
    assert projects[0]["id"] == project["id"]
    assert projects[0]["partner_name"] == partner["name"]


def test_dashboard_projects_and_reminders_do_not_lock_each_other(planning, monkeypatch):
    auth = planning["auth"]
    entered, release = Event(), Event()
    guard = Lock()
    first = True
    verify = auth.environment_verified

    def hold_first_read(db, **kwargs):
        nonlocal first
        with guard:
            hold = first
            first = False
        if hold:
            entered.set()
            assert release.wait(10)
        return verify(db, **kwargs)

    monkeypatch.setattr(auth, "environment_verified", hold_first_read)
    with ThreadPoolExecutor(max_workers=2) as pool:
        projects = pool.submit(planning["agent"].get, "/api/v1/projects")
        assert entered.wait(5)
        try:
            reminders = pool.submit(planning["agent"].get, "/api/v1/notifications")
            response = reminders.result(timeout=5)
            assert response.status_code == 200, response.text
        finally:
            release.set()
        assert projects.result(timeout=5).status_code == 200
