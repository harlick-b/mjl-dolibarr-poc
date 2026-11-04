# ruff: noqa: F401, F811
from tests.auth.test_access import headers
from tests.execution.test_closure import close_path, settled_activity
from tests.planning.test_amendments import approved_activity, open_amendment
from tests.planning.test_planning import admin, planning, post
from tests.planning.test_transfers import approve_transfer, request_transfer
from tests.planning.test_withdrawals import request_withdrawal


def metrics_path(activity):
    return f"/api/v1/ptas/{activity['pta_id']}/metrics"


def test_current_pta_metrics_use_closed_activity_and_approved_plan(planning):
    activity, _request, version = settled_activity(planning)

    before = planning["supervisor"].get(metrics_path(activity))
    assert before.status_code == 200, before.text
    assert before.json()["physical"] == {
        "closed_activities": 0,
        "approved_activities": 1,
    }
    assert before.json()["financial"] == {
        "closed_spending": "0",
        "approved_allocation": "300000",
    }

    closed = post(
        planning["agent"], close_path(activity), {"expected_version": version}
    )
    assert closed.status_code == 200, closed.text

    after = planning["validator"].get(metrics_path(activity))
    assert after.status_code == 200, after.text
    payload = after.json()
    assert payload["pta_id"] == activity["pta_id"]
    assert payload["physical"] == {
        "closed_activities": 1,
        "approved_activities": 1,
    }
    assert payload["financial"] == {
        "closed_spending": "200000",
        "approved_allocation": "300000",
    }
    assert payload["as_of"]


def test_metrics_require_a_business_identity(planning):
    activity, _request, _version = settled_activity(planning)

    denied = planning["admin"].get(
        metrics_path(activity), headers=headers(planning["admin"])
    )
    assert denied.status_code == 403, denied.text

    missing = planning["agent"].get("/api/v1/ptas/not-a-pta/metrics")
    assert missing.status_code == 404, missing.text


def test_metrics_keep_approved_baseline_pending_and_exclude_approved_withdrawal(
    planning,
):
    approved, _operation_type = approved_activity(planning)
    open_amendment(planning, approved)

    pending = planning["agent"].get(metrics_path(approved))
    assert pending.status_code == 200, pending.text
    assert pending.json()["physical"]["approved_activities"] == 1
    assert pending.json()["financial"]["approved_allocation"] == approved["allocation"]

    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    cancelled = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments/"
        f"{detail['amendment']['id']}/cancellation",
        {
            "expected_version": detail["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Préparer le test de retrait.",
        },
    )
    assert cancelled.status_code == 200, cancelled.text

    withdrawal = request_withdrawal(planning, cancelled.json())
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{withdrawal['id']}/decisions",
        {
            "expected_version": withdrawal["activity_version"],
            "decision": "prevalidate",
        },
    )
    accepted = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{withdrawal['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert accepted.status_code == 201, accepted.text

    excluded = planning["agent"].get(metrics_path(approved))
    assert excluded.status_code == 200, excluded.text
    assert excluded.json()["physical"] == {
        "closed_activities": 0,
        "approved_activities": 0,
    }
    assert excluded.json()["financial"] == {
        "closed_spending": "0",
        "approved_allocation": "0",
    }


def test_metrics_move_to_the_destination_only_after_transfer_approval(planning):
    approved, _operation_type = approved_activity(planning)
    source_path = metrics_path(approved)
    transfer = request_transfer(planning, approved)

    assert (
        planning["agent"].get(source_path).json()["physical"]["approved_activities"]
        == 1
    )

    moved = approve_transfer(planning, approved, transfer)
    source = planning["agent"].get(source_path)
    destination = planning["agent"].get(metrics_path(moved))
    assert source.status_code == 200, source.text
    assert destination.status_code == 200, destination.text
    assert source.json()["physical"]["approved_activities"] == 0
    assert destination.json()["physical"]["approved_activities"] == 1
    assert (
        destination.json()["financial"]["approved_allocation"] == approved["allocation"]
    )
