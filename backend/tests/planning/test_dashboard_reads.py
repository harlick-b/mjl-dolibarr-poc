from concurrent.futures import ThreadPoolExecutor
from threading import Event, Lock

from tests.planning.test_planning import (
    admin as admin_fixture,
)
from tests.planning.test_planning import (
    planning as planning_fixture,
)
from tests.planning.test_planning import post, references

admin = admin_fixture
planning = planning_fixture


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
