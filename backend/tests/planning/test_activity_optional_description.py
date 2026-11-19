from uuid import uuid4

from .test_planning import admin, plan, post, references  # noqa: F401
from .test_planning import planning as planning_fixture  # noqa: F401


def test_activity_submission_accepts_an_empty_description(
    planning_fixture,  # noqa: F811
):
    _partner, category, project = references(planning_fixture)
    created = post(
        planning_fixture["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {
            **plan(category, description=""),
            "request_key": str(uuid4()),
        },
    )
    assert created.status_code == 201, created.text

    submitted = post(
        planning_fixture["agent"],
        f"/api/v1/activities/{created.json()['id']}/submissions",
        {"expected_version": created.json()["version"]},
    )

    assert submitted.status_code == 201, submitted.text
    assert submitted.json()["snapshot"]["description"] == ""
