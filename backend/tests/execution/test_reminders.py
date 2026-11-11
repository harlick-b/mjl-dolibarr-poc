# ruff: noqa: F401, F811
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from types import SimpleNamespace

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.auth.models import Audit, User
from app.auth.service import AuthError
from app.planning.core.models import ActivityReminder
from app.planning.notifications.financial_notifications import (
    _actor_id as financial_actor_id,
)
from app.planning.notifications.reminders import (
    _reminder_outputs,
    deliver_reminder,
    dispatch_due_reminders,
)
from app.planning.notifications.workflow_notifications import (
    _actor_id as activity_actor_id,
)
from tests.auth.test_access import admin, headers
from tests.auth.test_auth import messages
from tests.execution.test_closure import close_path, settled_activity
from tests.planning.test_amendments import approved_activity, open_amendment
from tests.planning.test_planning import (
    create_activity,
    ordered_advisory_race,
    patch,
    plan,
    planning,
    post,
    put,
)
from tests.planning.test_withdrawals import request_withdrawal


def test_pta5_migration_round_trip_without_history(auth_env):
    config = Config("alembic.ini")
    command.downgrade(config, "0015_pta3f")
    command.upgrade(config, "head")


def assign(planning, activity, *actors):
    ids = [
        planning[name].get("/api/v1/auth/session").json()["user"]["id"]
        for name in actors
    ]
    response = put(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {"expected_version": activity["version"], "agent_ids": ids},
    )
    assert response.status_code == 200, response.text
    return response.json(), ids


def reminder_mail(planning):
    return [
        row
        for row in messages(planning["auth"].mail.directory)
        if row["kind"] == "activity_reminder"
    ]


def assignment_mail(planning):
    return [
        row
        for row in messages(planning["auth"].mail.directory)
        if row["kind"] == "activity_assignment"
    ]


class _MissingDecisionSession:
    def scalar(self, _statement):
        return None


def test_missing_decision_actor_uses_neutral_mail_context():
    db = _MissingDecisionSession()
    source = SimpleNamespace(id="request-id", submitter_id="submitter-id")

    assert (
        activity_actor_id(
            db,
            SimpleNamespace(stage="validator", kind="activity_review"),
            SimpleNamespace(id="revision-id", submitter_id="submitter-id"),
        )
        is None
    )
    assert (
        financial_actor_id(
            db,
            SimpleNamespace(
                stage="validator",
                kind="financial_review",
                request_kind="funding",
            ),
            source,
        )
        is None
    )


def test_reminder_projection_rejects_a_missing_activity_name():
    class InvalidSnapshotSession:
        def execute(self, _statement):
            return [
                SimpleNamespace(
                    notification_id="notice-id",
                    activity_reference="ACT-1",
                    pta_year=2027,
                    revision_snapshot={"name": None},
                )
            ]

    with pytest.raises(AuthError, match="reminder_source_invalid"):
        _reminder_outputs(
            InvalidSnapshotSession(), [SimpleNamespace(id="notice-id")]
        )


def test_exact_due_cycle_is_deduplicated_and_recipient_only(planning):
    activity, _ = approved_activity(planning)
    assigned, _ids = assign(planning, activity, "agent")

    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 8)) == 1
    assigned, new_ids = assign(planning, assigned, "agent", "agent2")
    assert len(assignment_mail(planning)) == 1
    assert assigned["reference"] in assignment_mail(planning)[0]["html"]
    assert assigned["name"] in assignment_mail(planning)[0]["html"]
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 9)) == 1
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 10)) == 0
    assert len(reminder_mail(planning)) == 2
    for message in reminder_mail(planning):
        assert "29 février 2028" in message["html"]
        assert "Bonjour Test User," in message["html"]
        assert "<a " not in message["html"]
        assert message["provider_id"]

    first = planning["agent"].get("/api/v1/notifications")
    second = planning["agent2"].get("/api/v1/notifications")
    assert first.status_code == second.status_code == 200
    assert first.json()["count"] == 2
    assert second.json()["count"] == 2
    reminder = next(item for item in first.json()["data"] if item["kind"] == "deadline")
    assignment = next(
        item for item in second.json()["data"] if item["kind"] == "assignment"
    )
    assert reminder["planned_end"] == "2028-02-29"
    assert assignment["activity_id"] == assigned["id"]
    assert assignment["assigned_by"]
    assert reminder["pta_year"] == assigned["placement_year"]
    with Session(planning["auth"].engine) as db:
        assert set(db.scalars(select(ActivityReminder.agent_id))) == set(new_ids)

    denied = planning["admin"].get(
        "/api/v1/notifications", headers=headers(planning["admin"])
    )
    assert denied.status_code == 403


def test_approved_end_date_change_creates_a_new_cycle_and_keeps_history(planning):
    activity, operation_type = approved_activity(planning)
    assigned, _ids = assign(planning, activity, "agent")
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 8)) == 1

    opened = open_amendment(planning, assigned)
    assert dispatch_due_reminders(planning["auth"], date(2028, 3, 10)) == 0
    edited = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}",
        plan(
            operation_type,
            planned_end="2028-03-31",
            allocation=activity["allocation"],
            operations=[
                {key: value for key, value in row.items() if key != "position"}
                for row in activity["operations"]
            ],
            expected_version=opened["version"],
        ),
    )
    assert edited.status_code == 200, edited.text
    assert dispatch_due_reminders(planning["auth"], date(2028, 3, 10)) == 0
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": edited.json()["version"]},
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text

    assert dispatch_due_reminders(planning["auth"], date(2028, 3, 10)) == 1
    payload = planning["agent"].get("/api/v1/notifications").json()
    assert payload["count"] == 4
    deadlines = [item for item in payload["data"] if item["kind"] == "deadline"]
    assert {item["planned_end"] for item in deadlines} == {
        "2028-02-29",
        "2028-03-31",
    }
    first_page = planning["agent"].get("/api/v1/notifications?limit=1").json()
    assert first_page["count"] == 4 and first_page["next"]
    second_page = planning["agent"].get(first_page["next"]).json()
    assert second_page["count"] == 4 and second_page["previous"]
    back = planning["agent"].get(second_page["previous"]).json()
    assert back["data"][0]["id"] == first_page["data"][0]["id"]


def test_same_end_date_amendment_keeps_the_existing_delivery_cycle(
    planning, monkeypatch
):
    activity, operation_type = approved_activity(planning)
    assigned, _ids = assign(planning, activity, "agent")
    monkeypatch.setattr(
        "app.planning.notifications.reminders.deliver_reminder",
        lambda _auth, _identifier: None,
    )
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 8)) == 1
    with Session(planning["auth"].engine) as db:
        reminder_id = db.scalar(select(ActivityReminder.id))

    opened = open_amendment(planning, assigned)
    edited = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}",
        plan(
            operation_type,
            description="Même échéance, contenu corrigé",
            allocation=activity["allocation"],
            operations=[
                {key: value for key, value in row.items() if key != "position"}
                for row in activity["operations"]
            ],
            expected_version=opened["version"],
        ),
    ).json()
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": edited["version"]},
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text

    monkeypatch.undo()
    assert deliver_reminder(planning["auth"], reminder_id) == "delivered"
    assert len(reminder_mail(planning)) == 1
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 9)) == 0


def test_boundaries_and_ineligible_recipients_do_not_create_reminders(planning):
    activity, _ = approved_activity(planning)
    # Represent a legacy Activity whose assignments already ended. New API
    # reassignment cannot leave an Activity without a responsible Agent.
    with planning["auth"].engine.begin() as db:
        db.execute(
            text(
                "UPDATE pta_activity_agent_assignment SET ended_at=clock_timestamp(), "
                "ended_by_id=assigned_by_id WHERE activity_id=:id"
            ),
            {"id": activity["id"]},
        )
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 8)) == 0
    assigned, ids = assign(planning, activity, "agent")
    with planning["auth"].engine.begin() as db:
        db.execute(
            text("UPDATE auth_user SET state='inactive' WHERE id=:id"), {"id": ids[0]}
        )
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 8)) == 0
    with planning["auth"].engine.begin() as db:
        db.execute(
            text("UPDATE auth_user SET state='active' WHERE id=:id"), {"id": ids[0]}
        )
    assert assigned["state"] == "approved"
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 7)) == 0
    assert dispatch_due_reminders(planning["auth"], date(2028, 3, 1)) == 0


def test_withdrawn_activity_stops_reminders(planning):
    activity, _ = approved_activity(planning)
    assigned, _ids = assign(planning, activity, "agent", "agent2")
    revision = request_withdrawal(planning, assigned)
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert approved.status_code == 201
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 8)) == 0


def test_closed_activity_stops_reminders(planning):
    activity, _request, version = settled_activity(planning)
    agent_id = planning["agent"].get("/api/v1/auth/session").json()["user"]["id"]
    planned_end = date.fromisoformat(activity["planned_end"])
    with Session(planning["auth"].engine) as db, db.begin():
        reminder = ActivityReminder(
            context_id="MJL",
            activity_id=activity["id"],
            approved_revision_id=activity["approved_revision_id"],
            agent_id=agent_id,
            planned_end=planned_end,
            due_on=planned_end - timedelta(days=21),
            created_at=planning["auth"].now(db),
            read_at=None,
            email_status="unconfirmed",
            email_completed_at=None,
            version=1,
        )
        db.add(reminder)
        db.flush()
        reminder_id = reminder.id
    closed, delivery = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent"], close_path(activity), {"expected_version": version}
        ),
        lambda: deliver_reminder(planning["auth"], reminder_id),
    )
    assert closed.status_code == 200
    assert delivery == "skipped"
    assert reminder_mail(planning) == []


def test_read_is_versioned_and_not_visible_to_another_agent(planning):
    activity, _ = approved_activity(planning)
    _assigned, _ids = assign(planning, activity, "agent")
    dispatch_due_reminders(planning["auth"], date(2028, 2, 8))
    item = next(
        row
        for row in planning["agent"].get("/api/v1/notifications").json()["data"]
        if row["kind"] == "deadline"
    )

    hidden = planning["agent2"].patch(
        f"/api/v1/notifications/{item['id']}",
        headers=headers(planning["agent2"]),
        json={"expected_version": item["version"]},
    )
    assert hidden.status_code == 404
    read = planning["agent"].patch(
        f"/api/v1/notifications/{item['id']}",
        headers=headers(planning["agent"]),
        json={"expected_version": item["version"]},
    )
    assert read.status_code == 200, read.text
    assert read.json()["read_at"]
    with Session(planning["auth"].engine) as db:
        assert (
            db.scalar(select(Audit).where(Audit.action == "notification.read").limit(1))
            is None
        )
    replay = planning["agent"].patch(
        f"/api/v1/notifications/{item['id']}",
        headers=headers(planning["agent"]),
        json={"expected_version": item["version"]},
    )
    assert replay.status_code == 200
    assert replay.json()["read_at"] == read.json()["read_at"]
    assert replay.json()["version"] == read.json()["version"]
    unread = planning["agent"].get("/api/v1/notifications?state=unread")
    assert unread.json()["count"] == 1
    assert unread.json()["data"][0]["kind"] == "activity_approved"


def test_deactivation_serializes_before_notification_read(planning):
    activity, _ = approved_activity(planning)
    assigned, _ids = assign(planning, activity, "agent")
    dispatch_due_reminders(planning["auth"], date(2028, 2, 8))
    item = planning["agent"].get("/api/v1/notifications").json()["data"][0]
    assign(planning, assigned, "agent2")
    with Session(planning["auth"].engine) as db:
        user = db.scalar(select(User).where(User.email == "agent@example.test"))
        assert user is not None
        user_id, user_version = user.id, user.version

    deactivated, denied = ordered_advisory_race(
        planning["auth"],
        lambda: planning["admin"].patch(
            f"/api/v1/access/users/{user_id}",
            headers=headers(planning["admin"]),
            json={"expected_version": user_version, "deactivate": True},
        ),
        lambda: planning["agent"].patch(
            f"/api/v1/notifications/{item['id']}",
            headers=headers(planning["agent"]),
            json={"expected_version": item["version"]},
        ),
    )
    assert deactivated.status_code == 200, deactivated.text
    assert denied.status_code == 401
    with Session(planning["auth"].engine) as db:
        reminder = db.get(ActivityReminder, item["id"])
        assert reminder is not None
        assert reminder.read_at is None and reminder.version == item["version"]


def test_failed_mail_is_recorded_once_without_retry(planning, monkeypatch):
    activity, _ = approved_activity(planning)
    assign(planning, activity, "agent")
    calls = 0

    def fail(*_args):
        nonlocal calls
        calls += 1
        raise OSError("synthetic failure")

    monkeypatch.setattr(planning["auth"].mail, "send", fail)
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 8)) == 1
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 9)) == 0
    assert calls == 1
    item = planning["agent"].get("/api/v1/notifications").json()["data"][0]
    assert item["email_status"] == "failed"


def test_uncertain_mail_is_recorded_once_without_retry(planning, monkeypatch):
    from app.auth.mail import MailDeliveryUncertain

    activity, _ = approved_activity(planning)
    assign(planning, activity, "agent")
    calls = 0

    def uncertain(*_args):
        nonlocal calls
        calls += 1
        raise MailDeliveryUncertain("synthetic uncertain outcome")

    monkeypatch.setattr(planning["auth"].mail, "send", uncertain)
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 8)) == 1
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 9)) == 0
    assert calls == 1
    item = planning["agent"].get("/api/v1/notifications").json()["data"][0]
    assert item["email_status"] == "uncertain"


def test_assignment_survives_its_email_failure(planning, monkeypatch):
    activity, _ = approved_activity(planning)
    assigned, _ids = assign(planning, activity, "agent")
    original_send = planning["auth"].mail.send

    def fail_assignment(recipient, kind, message):
        if kind == "activity_assignment":
            raise OSError("provider unavailable")
        return original_send(recipient, kind, message)

    monkeypatch.setattr(planning["auth"].mail, "send", fail_assignment)
    changed, expected_ids = assign(planning, assigned, "agent", "agent2")
    assert set(changed["agent_ids"]) == set(expected_ids)
    notification = planning["agent2"].get("/api/v1/notifications").json()
    assert notification["count"] == 1
    assert notification["data"][0]["kind"] == "assignment"
    assert notification["data"][0]["email_status"] == "failed"


def test_unconfirmed_delivery_result_is_never_retried(planning, monkeypatch):
    activity, _ = approved_activity(planning)
    assign(planning, activity, "agent")
    original = planning["auth"].audit
    calls = 0

    def sent(*args, **kwargs):
        nonlocal calls
        calls += 1
        return original_send(*args, **kwargs)

    def fail_delivery(db, action, *args, **kwargs):
        if action == "reminder.email_delivery":
            raise RuntimeError("synthetic audit failure")
        return original(db, action, *args, **kwargs)

    original_send = planning["auth"].mail.send
    monkeypatch.setattr(planning["auth"].mail, "send", sent)
    monkeypatch.setattr(planning["auth"], "audit", fail_delivery)
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 8)) == 1
    assert len(reminder_mail(planning)) == 1
    item = planning["agent"].get("/api/v1/notifications").json()["data"][0]
    assert deliver_reminder(planning["auth"], item["id"]) is None
    assert dispatch_due_reminders(planning["auth"], date(2028, 2, 9)) == 0
    assert calls == 1
    assert item["email_status"] == "unconfirmed"


def test_provider_call_does_not_hold_the_global_mutation_lock(planning, monkeypatch):
    from threading import Event

    activity, _ = approved_activity(planning)
    assigned, _ids = assign(planning, activity, "agent")
    entered, release = Event(), Event()
    original_send = planning["auth"].mail.send

    def delayed(*args, **kwargs):
        if len(args) > 1 and args[1] == "activity_reminder":
            entered.set()
            assert release.wait(5)
        return original_send(*args, **kwargs)

    monkeypatch.setattr(planning["auth"].mail, "send", delayed)
    with ThreadPoolExecutor(max_workers=2) as pool:
        dispatched = pool.submit(
            dispatch_due_reminders, planning["auth"], date(2028, 2, 8)
        )
        assert entered.wait(3)
        changed = pool.submit(assign, planning, assigned, "agent", "agent2")
        try:
            assert changed.result(3)[0]["state"] == "approved"
        finally:
            release.set()
        assert dispatched.result(7) == 1


def test_assignment_change_serializes_before_dispatch(planning):
    activity, _ = approved_activity(planning)
    assigned, _ids = assign(planning, activity, "agent")
    other_id = planning["agent2"].get("/api/v1/auth/session").json()["user"]["id"]
    changed, dispatched = ordered_advisory_race(
        planning["auth"],
        lambda: put(
            planning["supervisor"],
            f"/api/v1/activities/{activity['id']}/assignments",
            {"expected_version": assigned["version"], "agent_ids": [other_id]},
        ),
        lambda: dispatch_due_reminders(planning["auth"], date(2028, 2, 8)),
    )
    assert changed.status_code == 200
    assert dispatched == 1
    former_agent_items = planning["agent"].get("/api/v1/notifications").json()
    assert former_agent_items["count"] == 1
    assert former_agent_items["data"][0]["kind"] == "activity_approved"
    recipient_items = planning["agent2"].get("/api/v1/notifications").json()
    assert recipient_items["count"] == 2
    assert {item["kind"] for item in recipient_items["data"]} == {
        "assignment",
        "deadline",
    }


def test_notification_history_blocks_each_unsafe_downgrade(planning):
    activity, _ = approved_activity(planning)
    assign(planning, activity, "agent")
    dispatch_due_reminders(planning["auth"], date(2028, 2, 8))
    with pytest.raises(
        RuntimeError, match="Preserve Activity workflow notifications"
    ):
        command.downgrade(Config("alembic.ini"), "0015_pta3f")
    with planning["auth"].engine.begin() as connection:
        connection.execute(text("DELETE FROM pta_activity_workflow_notification"))
    with pytest.raises(RuntimeError, match="Refusing to discard reminder history"):
        command.downgrade(Config("alembic.ini"), "0015_pta3f")


def test_concurrent_dispatch_creates_and_sends_one_cycle(planning):
    activity, _ = approved_activity(planning)
    assign(planning, activity, "agent")
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(
                lambda _index: dispatch_due_reminders(
                    planning["auth"], date(2028, 2, 8)
                ),
                range(2),
            )
        )
    assert sorted(results) == [0, 1]
    assert len(reminder_mail(planning)) == 1


def test_activity_review_notifications_follow_the_available_decision(planning):
    _partner, _operation_type, _project, activity, _body = create_activity(planning)
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    )
    assert submitted.status_code == 201, submitted.text
    supervisor_items = planning["supervisor"].get("/api/v1/notifications").json()
    assert supervisor_items["count"] == 1
    supervisor_notice = supervisor_items["data"][0]
    assert supervisor_notice["kind"] == "activity_review"
    assert supervisor_notice["stage"] == "supervisor"
    assert supervisor_notice["handled_at"] is None
    assert planning["validator"].get("/api/v1/notifications").json()["count"] == 0
    review_mail = [
        row
        for row in messages(planning["auth"].mail.directory)
        if row["kind"] == "activity_review_supervisor"
    ]
    assert len(review_mail) == 1
    assert review_mail[0]["html"] is not None
    for content in (review_mail[0]["html"], review_mail[0]["text"]):
        assert "Une activité attend votre examen" in content
        assert activity["reference"] in content
        assert f"/activities/{activity['id']}" in content

    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/"
        f"{submitted.json()['id']}/decisions",
        {
            "expected_version": submitted.json()["activity_version"],
            "decision": "prevalidate",
        },
    )
    assert prevalidated.status_code == 201, prevalidated.text
    supervisor_notice = (
        planning["supervisor"].get("/api/v1/notifications").json()["data"][0]
    )
    assert supervisor_notice["handled_at"] is not None
    validator_notice = (
        planning["validator"].get("/api/v1/notifications").json()["data"][0]
    )
    assert validator_notice["stage"] == "validator"
    assert validator_notice["handled_at"] is None

    returned = post(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/"
        f"{submitted.json()['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "return",
            "reason": "Préciser les résultats attendus.",
        },
    )
    assert returned.status_code == 201, returned.text
    agent_items = planning["agent"].get("/api/v1/notifications").json()
    correction = next(
        row for row in agent_items["data"] if row["kind"] == "activity_correction"
    )
    assert correction["reason"] == "Préciser les résultats attendus."
    assert correction["email_status"] == "delivered"
    assert (
        planning["validator"]
        .get("/api/v1/notifications")
        .json()["data"][0]["handled_at"]
    )


def test_activity_final_approval_notifies_agent_in_app_without_email(planning):
    activity, _operation_type = approved_activity(planning)

    agent_items = planning["agent"].get("/api/v1/notifications").json()
    approval = next(
        row for row in agent_items["data"] if row["kind"] == "activity_approved"
    )
    assert approval["activity_id"] == activity["id"]
    assert approval["stage"] == "agent"
    assert approval["email_status"] == "skipped"
    assert all(
        row["kind"] != "activity_approved"
        for row in messages(planning["auth"].mail.directory)
    )


def test_activity_submission_survives_review_email_failure_without_retry(
    planning, monkeypatch
):
    _partner, _operation_type, _project, activity, _body = create_activity(planning)
    calls = 0

    def fail(*_args):
        nonlocal calls
        calls += 1
        raise OSError("synthetic failure")

    monkeypatch.setattr(planning["auth"].mail, "send", fail)
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    )
    assert submitted.status_code == 201, submitted.text
    detail = planning["agent"].get(f"/api/v1/activities/{activity['id']}")
    assert detail.status_code == 200
    assert detail.json()["state"] == "submitted"
    notice = planning["supervisor"].get("/api/v1/notifications").json()["data"][0]
    assert notice["kind"] == "activity_review"
    assert notice["email_status"] == "failed"

    replay = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": submitted.json()["activity_version"]},
    )
    assert replay.status_code == 409
    assert calls == 1
