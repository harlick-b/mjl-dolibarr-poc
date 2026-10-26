# ruff: noqa: F401, F811
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import monotonic
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, func, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.orm import Session, SessionTransaction
from test_access import admin, headers
from test_planning import (
    login_existing,
    ordered_advisory_race,
    patch,
    plan,
    planning,
    post,
    references,
)

from app.auth.models import Audit
from app.planning.models import (
    Activity,
    ActivityContributor,
    ActivityRevision,
    Operation,
)


def approved_activity(clients):
    _partner, operation_type, project = references(clients)
    created = post(
        clients["agent"],
        f"/api/v1/projects/{project['id']}/ptas/2027/activities",
        {**plan(operation_type), "request_key": str(uuid4())},
    ).json()
    revision = post(
        clients["agent"],
        f"/api/v1/activities/{created['id']}/submissions",
        {"expected_version": created["version"]},
    ).json()
    prevalidated = post(
        clients["supervisor"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    approved = post(
        clients["validator"],
        f"/api/v1/activities/{created['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert approved.status_code == 201, approved.text
    detail = clients["agent"].get(f"/api/v1/activities/{created['id']}").json()
    return detail, operation_type


def open_amendment(clients, activity, reason="Modification synthétique"):
    response = post(
        clients["agent"],
        f"/api/v1/activities/{activity['id']}/amendments",
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": reason,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def edit_amendment(clients, activity, operation_type, description):
    response = patch(
        clients["agent2"],
        f"/api/v1/activities/{activity['id']}",
        plan(
            operation_type,
            description=description,
            allocation=activity["allocation"],
            operations=[
                {key: value for key, value in row.items() if key != "position"}
                for row in activity["operations"]
            ],
            expected_version=activity["version"],
        ),
    )
    assert response.status_code == 200, response.text
    return response.json()


def cancel_amendment(clients, activity, reason="Annulation synthétique"):
    response = post(
        clients["agent2"],
        f"/api/v1/activities/{activity['id']}/amendments/"
        f"{activity['amendment']['id']}/cancellation",
        {
            "expected_version": activity["version"],
            "expected_approved_revision_id": activity["approved_revision_id"],
            "reason": reason,
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def persisted_activity(engine, activity_id):
    with engine.connect() as db:
        return {
            "activity": db.execute(
                text("SELECT * FROM pta_activity WHERE id=:id"), {"id": activity_id}
            ).one(),
            "operations": tuple(
                db.execute(
                    text(
                        "SELECT * FROM pta_operation WHERE activity_id=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                ).all()
            ),
            "assignments": tuple(
                db.execute(
                    text(
                        "SELECT * FROM pta_activity_agent_assignment "
                        "WHERE activity_id=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                ).all()
            ),
            "contributors": tuple(
                db.execute(
                    text(
                        "SELECT * FROM pta_activity_contributor "
                        "WHERE activity_id=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                ).all()
            ),
            "revisions": tuple(
                db.execute(
                    text(
                        "SELECT * FROM pta_activity_revision "
                        "WHERE activity_id=:id ORDER BY id"
                    ),
                    {"id": activity_id},
                ).all()
            ),
            "decisions": tuple(
                db.execute(
                    text(
                        "SELECT d.* FROM pta_activity_revision_decision d "
                        "JOIN pta_activity_revision r ON r.id=d.revision_id "
                        "WHERE r.activity_id=:id ORDER BY d.id"
                    ),
                    {"id": activity_id},
                ).all()
            ),
            "audits": tuple(
                db.execute(
                    text("SELECT * FROM auth_audit WHERE target=:id ORDER BY id"),
                    {"id": activity_id},
                ).all()
            ),
        }


def test_m02_opening_preserves_effective_approval_and_blocks_second_candidate(planning):
    approved, _operation_type = approved_activity(planning)
    opened = post(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}/amendments",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Adapter le calendrier et le budget.",
        },
    )
    assert opened.status_code == 201, opened.text
    candidate = opened.json()
    assert candidate["state"] == "amendment_draft"
    assert candidate["execution_paused"] is True
    assert candidate["approved"]["allocation"] == "300000"
    assert candidate["candidate"]["allocation"] == "300000"
    assert candidate["amendment"]["reason"] == "Adapter le calendrier et le budget."
    duplicate = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments",
        {
            "expected_version": candidate["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Une seconde modification.",
        },
    )
    assert duplicate.status_code == 409


def test_m03_m04_m05_amendment_edits_are_isolated_and_submit_frozen_base(planning):
    approved, operation_type = approved_activity(planning)
    opened = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Correction tardive.",
        },
    ).json()
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            operation_type,
            description="Candidat modifié sans contaminer le socle approuvé",
            allocation="350000",
            operations=[
                {
                    key: value
                    for key, value in {
                        **opened["operations"][0],
                        "allocation": "150000",
                    }.items()
                    if key != "position"
                },
                {
                    key: value
                    for key, value in {
                        **opened["operations"][1],
                        "allocation": "200000",
                    }.items()
                    if key != "position"
                },
            ],
            expected_version=opened["version"],
        ),
    )
    assert changed.status_code == 200, changed.text
    detail = changed.json()
    assert detail["approved"]["allocation"] == "300000"
    assert detail["candidate"]["allocation"] == "350000"
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/submissions",
        {"expected_version": detail["version"]},
    )
    assert revision.status_code == 201, revision.text
    assert revision.json()["revision_number"] == 2
    assert revision.json()["snapshot"]["amendment_id"] == opened["amendment"]["id"]
    assert (
        revision.json()["snapshot"]["base_approved_revision_id"]
        == approved["approved_revision_id"]
    )


def test_m13_cancellation_restores_approved_content_and_preserves_evidence(planning):
    approved, operation_type = approved_activity(planning)
    opened = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Modification finalement inutile.",
        },
    ).json()
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            operation_type,
            description="Brouillon annulé",
            operations=[
                *[
                    {key: value for key, value in row.items() if key != "position"}
                    for row in opened["operations"]
                ],
                {
                    "type_id": operation_type["id"],
                    "name": "Ajout candidat",
                    "allocation": "1",
                },
            ],
            allocation="300001",
            expected_version=opened["version"],
        ),
    ).json()
    with Session(planning["auth"].engine) as db, db.begin():
        db.execute(
            text(
                "UPDATE pta_operation_type SET label='Libellé figé',active=false "
                "WHERE id=:id"
            ),
            {"id": operation_type["id"]},
        )
    cancelled = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments/{opened['amendment']['id']}/cancellation",
        {
            "expected_version": changed["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Retour au programme approuvé.",
        },
    )
    assert cancelled.status_code == 200, cancelled.text
    restored = cancelled.json()
    assert restored["state"] == "approved"
    assert restored["execution_paused"] is False
    assert restored["amendment"] is None
    assert restored["candidate"] is None
    assert restored["description"] == approved["description"]
    assert restored["allocation"] == approved["allocation"]
    history = planning["agent"].get(
        f"/api/v1/activities/{approved['id']}/amendments/{opened['amendment']['id']}"
    )
    assert history.status_code == 200, history.text
    assert history.json()["cancellation"]["reason"] == "Retour au programme approuvé."
    assert history.json()["candidate"]["description"] == "Brouillon annulé"
    assert history.json()["status"] == "cancelled"
    frozen_label = history.json()["candidate"]["operations"][0]["type_label"]
    with Session(planning["auth"].engine) as db:
        assert db.scalar(
            select(ActivityContributor.id).where(
                ActivityContributor.activity_id == approved["id"]
            )
        )
        assert db.scalar(
            select(Operation).where(
                Operation.activity_id == approved["id"],
                Operation.name == "Ajout candidat",
                Operation.removed_at.is_not(None),
            )
        )
        assert db.scalar(
            select(Audit).where(
                Audit.target == approved["id"],
                Audit.action == "activity.amendment_cancel",
            )
        )
        db.execute(
            text(
                "UPDATE pta_operation_type SET label='Libellé ultérieur' WHERE id=:id"
            ),
            {"id": operation_type["id"]},
        )
        db.commit()
    frozen = planning["agent"].get(
        f"/api/v1/activities/{approved['id']}/amendments/{opened['amendment']['id']}"
    )
    assert frozen.status_code == 200
    assert frozen.json()["candidate"]["operations"][0]["type_label"] == frozen_label


def test_m06_m08_amendment_requires_fresh_chain_and_activates_atomically(planning):
    approved, operation_type = approved_activity(planning)
    opened = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Révision approuvée.",
        },
    ).json()
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            operation_type,
            description="Nouvelle version approuvée",
            operations=[
                {key: value for key, value in row.items() if key != "position"}
                for row in opened["operations"]
            ],
            expected_version=opened["version"],
        ),
    ).json()
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/submissions",
        {"expected_version": changed["version"]},
    ).json()
    skipped = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "approve"},
    )
    assert skipped.status_code == 409
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    accepted = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert accepted.status_code == 201, accepted.text
    detail = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert detail["approved_revision_id"] == revision["id"]
    assert detail["approved"]["description"] == "Nouvelle version approuvée"
    assert detail["amendment"] is None
    assert detail["execution_paused"] is False
    completed = planning["agent"].get(
        f"/api/v1/activities/{approved['id']}/amendments/{opened['amendment']['id']}"
    )
    assert completed.status_code == 200, completed.text
    assert completed.json()["status"] == "approved"
    assert completed.json()["candidate"]["description"] == "Nouvelle version approuvée"


def test_m01_authorization_validation_and_stale_cancellation_fail_closed(planning):
    approved, _operation_type = approved_activity(planning)
    path = f"/api/v1/activities/{approved['id']}/amendments"
    body = {
        "expected_version": approved["version"],
        "expected_approved_revision_id": approved["approved_revision_id"],
        "reason": "Modification autorisée.",
    }
    assert post(planning["admin"], path, body).status_code == 403
    assert post(planning["supervisor"], path, body).status_code == 403
    assert post(planning["validator"], path, body).status_code == 403
    assert post(planning["agent"], path, {**body, "reason": " "}).status_code == 422
    assert (
        post(
            planning["agent"],
            path,
            {**body, "expected_approved_revision_id": str(uuid4())},
        ).status_code
        == 409
    )
    opened = post(planning["agent"], path, body).json()
    cancel_path = f"{path}/{opened['amendment']['id']}/cancellation"
    cancellation = {
        "expected_version": opened["version"],
        "expected_approved_revision_id": opened["approved_revision_id"],
        "reason": "Annulation autorisée.",
    }
    assert post(planning["supervisor"], cancel_path, cancellation).status_code == 403
    restored = post(planning["agent2"], cancel_path, cancellation)
    assert restored.status_code == 200
    assert post(planning["agent"], cancel_path, cancellation).status_code == 409
    assert (
        post(
            planning["agent"],
            f"{path}/{uuid4()}/cancellation",
            {**cancellation, "expected_version": restored.json()["version"]},
        ).status_code
        == 409
    )


def test_m07_m13_cancellation_from_every_open_state_preserves_history(planning):
    approved, operation_type = approved_activity(planning)
    revision_numbers = []
    phases = [
        "amendment_draft",
        "submitted",
        "prevalidated",
        "returned_supervisor",
        "returned_validator",
    ]
    activity = approved
    amendment_ids = []
    for index, phase in enumerate(phases, start=1):
        opened = open_amendment(planning, activity, f"Cycle {index}")
        amendment_ids.append(opened["amendment"]["id"])
        current = edit_amendment(
            planning, opened, operation_type, f"Candidat du cycle {index}"
        )
        if phase != "amendment_draft":
            submitted = post(
                planning["agent"],
                f"/api/v1/activities/{activity['id']}/submissions",
                {"expected_version": current["version"]},
            ).json()
            revision_numbers.append(submitted["revision_number"])
            current = (
                planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
            )
            if phase in {"prevalidated", "returned_validator"}:
                prevalidated = post(
                    planning["supervisor"],
                    f"/api/v1/activities/{activity['id']}/revisions/"
                    f"{submitted['id']}/decisions",
                    {
                        "expected_version": current["version"],
                        "decision": "prevalidate",
                    },
                ).json()
                current = (
                    planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
                )
                assert current["version"] == prevalidated["activity_version"]
            elif phase == "returned_supervisor":
                returned = post(
                    planning["supervisor"],
                    f"/api/v1/activities/{activity['id']}/revisions/"
                    f"{submitted['id']}/decisions",
                    {
                        "expected_version": current["version"],
                        "decision": "return",
                        "reason": "Retour superviseur.",
                    },
                ).json()
                current = (
                    planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
                )
                assert current["version"] == returned["activity_version"]
            if phase == "returned_validator":
                returned = post(
                    planning["validator"],
                    f"/api/v1/activities/{activity['id']}/revisions/"
                    f"{submitted['id']}/decisions",
                    {
                        "expected_version": current["version"],
                        "decision": "return",
                        "reason": "Retour validateur.",
                    },
                ).json()
                current = (
                    planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
                )
                assert current["version"] == returned["activity_version"]
        assert current["state"] == phase
        activity = cancel_amendment(planning, current, f"Annulation du cycle {index}")
        assert activity["state"] == "approved"
        assert activity["approved_revision_id"] == approved["approved_revision_id"]
        detail = planning["agent"].get(
            f"/api/v1/activities/{activity['id']}/amendments/{amendment_ids[-1]}"
        )
        assert detail.status_code == 200
        assert detail.json()["candidate"]["description"] == f"Candidat du cycle {index}"
    assert revision_numbers == sorted(revision_numbers)
    assert len(revision_numbers) == len(set(revision_numbers))
    history = (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/revisions?limit=100")
        .json()
    )
    assert history["count"] == 1 + len(revision_numbers) + 2 * len(phases)
    assert {row["kind"] for row in history["data"]} == {
        "revision",
        "amendment_open",
        "amendment_cancel",
    }
    seen = []
    page_url = f"/api/v1/activities/{activity['id']}/revisions?limit=1"
    while page_url:
        page = planning["agent"].get(page_url)
        assert page.status_code == 200, page.text
        payload = page.json()
        seen.extend(row["id"] for row in payload["data"])
        assert all("snapshot" not in row for row in payload["data"])
        page_url = payload["next"]
    assert len(seen) == history["count"]
    assert len(seen) == len(set(seen))


def test_m09_m10_cancel_and_approval_race_has_one_serial_winner(planning):
    approved, operation_type = approved_activity(planning)

    def prevalidated_candidate(activity, description):
        opened = open_amendment(planning, activity, description)
        changed = edit_amendment(planning, opened, operation_type, description)
        revision = post(
            planning["agent"],
            f"/api/v1/activities/{activity['id']}/submissions",
            {"expected_version": changed["version"]},
        ).json()
        prevalidated = post(
            planning["supervisor"],
            f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        ).json()
        return opened, revision, prevalidated

    opened, revision, prevalidated = prevalidated_candidate(
        approved, "Annulation gagnante"
    )
    cancelled, stale_approval = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent2"],
            f"/api/v1/activities/{approved['id']}/amendments/"
            f"{opened['amendment']['id']}/cancellation",
            {
                "expected_version": prevalidated["activity_version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Annulation concurrente.",
            },
        ),
        lambda: post(
            planning["validator"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        ),
    )
    assert (cancelled.status_code, stale_approval.status_code) == (200, 409)

    current = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    opened, revision, prevalidated = prevalidated_candidate(
        current, "Approbation gagnante"
    )
    approved_result, stale_cancel = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["validator"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": prevalidated["activity_version"],
                "decision": "approve",
            },
        ),
        lambda: post(
            planning["agent2"],
            f"/api/v1/activities/{approved['id']}/amendments/"
            f"{opened['amendment']['id']}/cancellation",
            {
                "expected_version": prevalidated["activity_version"],
                "expected_approved_revision_id": current["approved_revision_id"],
                "reason": "Annulation devenue obsolète.",
            },
        ),
    )
    assert (approved_result.status_code, stale_cancel.status_code) == (201, 409)


@pytest.mark.parametrize(
    "competing_action",
    ["edit", "submit", "return_supervisor", "prevalidate", "return_validator"],
)
def test_m10_cancellation_serializes_against_every_candidate_mutation(
    planning, competing_action
):
    approved, operation_type = approved_activity(planning)
    opened = open_amendment(planning, approved, competing_action)
    current = edit_amendment(planning, opened, operation_type, "Candidat concurrent")
    revision = None
    if competing_action in {"return_supervisor", "prevalidate", "return_validator"}:
        revision = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/submissions",
            {"expected_version": current["version"]},
        ).json()
        current = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    if competing_action == "return_validator":
        prevalidated = post(
            planning["supervisor"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {"expected_version": current["version"], "decision": "prevalidate"},
        ).json()
        current = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
        assert current["version"] == prevalidated["activity_version"]

    def competing_request():
        if competing_action == "edit":
            return patch(
                planning["agent"],
                f"/api/v1/activities/{approved['id']}",
                plan(
                    operation_type,
                    description="Modification concurrente",
                    operations=[
                        {key: value for key, value in row.items() if key != "position"}
                        for row in current["operations"]
                    ],
                    expected_version=current["version"],
                ),
            )
        if competing_action == "submit":
            return post(
                planning["agent"],
                f"/api/v1/activities/{approved['id']}/submissions",
                {"expected_version": current["version"]},
            )
        role = (
            planning["validator"]
            if competing_action == "return_validator"
            else planning["supervisor"]
        )
        return post(
            role,
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": current["version"],
                "decision": "prevalidate"
                if competing_action == "prevalidate"
                else "return",
                **(
                    {"reason": "Retour concurrent."}
                    if competing_action != "prevalidate"
                    else {}
                ),
            },
        )

    cancelled, stale_mutation = ordered_advisory_race(
        planning["auth"],
        lambda: post(
            planning["agent2"],
            f"/api/v1/activities/{approved['id']}/amendments/"
            f"{opened['amendment']['id']}/cancellation",
            {
                "expected_version": current["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Annulation concurrente.",
            },
        ),
        competing_request,
    )
    assert (cancelled.status_code, stale_mutation.status_code) == (200, 409)
    assert cancelled.json()["state"] == "approved"


def test_m04_amendment_edits_keep_bounded_structural_audit_history(planning):
    approved, operation_type = approved_activity(planning)
    current = open_amendment(planning, approved, "Historique des éditions")
    expected_descriptions = []
    for index, allocation in enumerate(("350000", "400000", "300000"), start=1):
        first = str(int(allocation) - 200000)
        description = (
            approved["description"] if index == 3 else f"Édition intermédiaire {index}"
        )
        response = patch(
            planning["agent2"],
            f"/api/v1/activities/{approved['id']}",
            plan(
                operation_type,
                description=description,
                allocation=allocation,
                operations=[
                    {
                        **{
                            key: value
                            for key, value in current["operations"][0].items()
                            if key != "position"
                        },
                        "allocation": first,
                    },
                    {
                        **{
                            key: value
                            for key, value in current["operations"][1].items()
                            if key != "position"
                        },
                        "allocation": "200000",
                    },
                ],
                expected_version=current["version"],
            ),
        )
        assert response.status_code == 200, response.text
        expected_descriptions.append((current["description"], description))
        current = response.json()
    cancel_amendment(planning, current, "Conserver les éditions puis annuler")
    with Session(planning["auth"].engine) as db:
        audits = list(
            db.scalars(
                select(Audit)
                .where(
                    Audit.target == approved["id"],
                    Audit.action == "activity.replace",
                )
                .order_by(Audit.occurred_at, Audit.id)
            )
        )
    assert len(audits) == 3
    assert [
        (
            row.business["before"]["content"]["description"],
            row.business["after"]["content"]["description"],
        )
        for row in audits
    ] == expected_descriptions
    assert [row.business["after"]["content"]["allocation"] for row in audits] == [
        "350000",
        "400000",
        "300000",
    ]
    assert all(
        row.business["before"]["content"]["operations"]
        and row.business["after"]["content"]["operations"]
        for row in audits
    )


def test_m14_open_and_cancel_audit_failures_roll_back(planning, monkeypatch):
    approved, operation_type = approved_activity(planning)
    auth = planning["auth"]
    real_audit = auth.business_audit
    failed_action = {"value": "activity.amendment_open"}

    def fail_selected(db, action, *args, **kwargs):
        if action == failed_action["value"]:
            raise IntegrityError("synthetic amendment audit failure", {}, Exception())
        return real_audit(db, action, *args, **kwargs)

    monkeypatch.setattr(auth, "business_audit", fail_selected)
    before_open = persisted_activity(auth.engine, approved["id"])
    response = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments",
        {
            "expected_version": approved["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Échec atomique.",
        },
    )
    assert response.status_code == 503
    assert persisted_activity(auth.engine, approved["id"]) == before_open
    unchanged = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert (
        unchanged["state"] == "approved" and unchanged["version"] == approved["version"]
    )

    failed_action["value"] = "none"
    opened = open_amendment(planning, unchanged)
    changed = edit_amendment(planning, opened, operation_type, "Candidat à restaurer")
    before_cancel = persisted_activity(auth.engine, approved["id"])
    failed_action["value"] = "activity.amendment_cancel"
    response = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/amendments/"
        f"{opened['amendment']['id']}/cancellation",
        {
            "expected_version": changed["version"],
            "expected_approved_revision_id": approved["approved_revision_id"],
            "reason": "Échec atomique.",
        },
    )
    assert response.status_code == 503
    assert persisted_activity(auth.engine, approved["id"]) == before_cancel
    retained = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    assert retained["candidate"]["description"] == "Candidat à restaurer"
    assert retained["execution_paused"] is True


@pytest.mark.parametrize("action", ["open", "cancel"])
def test_m14_open_and_cancel_constraint_failures_roll_back(
    planning, monkeypatch, action
):
    approved, _operation_type = approved_activity(planning)
    current = open_amendment(planning, approved) if action == "cancel" else approved
    auth = planning["auth"]
    before = persisted_activity(auth.engine, approved["id"])
    real_audit = auth.business_audit

    def violate_constraint(db, *args, **kwargs):
        real_audit(db, *args, **kwargs)
        db.execute(
            text(
                "INSERT INTO mjl_ownership_context (id,created_at) "
                "VALUES ('NOT_MJL',clock_timestamp())"
            )
        )

    monkeypatch.setattr(auth, "business_audit", violate_constraint)
    response = (
        post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/amendments",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Ouverture atomique.",
            },
        )
        if action == "open"
        else post(
            planning["agent2"],
            f"/api/v1/activities/{approved['id']}/amendments/"
            f"{current['amendment']['id']}/cancellation",
            {
                "expected_version": current["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Annulation atomique.",
            },
        )
    )
    assert response.status_code == 503
    after = persisted_activity(auth.engine, approved["id"])
    assert after == before


@pytest.mark.parametrize("action", ["open", "cancel"])
def test_m14_open_and_cancel_outer_commit_failures_roll_back(
    planning, monkeypatch, action
):
    approved, _operation_type = approved_activity(planning)
    current = open_amendment(planning, approved) if action == "cancel" else approved
    auth = planning["auth"]
    before = persisted_activity(auth.engine, approved["id"])
    real_audit = auth.business_audit

    def mark_commit(db, *args, **kwargs):
        real_audit(db, *args, **kwargs)
        db.info["fail_amendment_commit"] = True

    real_commit = SessionTransaction.commit

    def fail_commit(transaction, *args, **kwargs):
        if transaction.session.info.pop("fail_amendment_commit", False):
            raise IntegrityError("synthetic amendment commit failure", {}, Exception())
        return real_commit(transaction, *args, **kwargs)

    monkeypatch.setattr(auth, "business_audit", mark_commit)
    monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    response = (
        post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/amendments",
            {
                "expected_version": approved["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Ouverture atomique.",
            },
        )
        if action == "open"
        else post(
            planning["agent2"],
            f"/api/v1/activities/{approved['id']}/amendments/"
            f"{current['amendment']['id']}/cancellation",
            {
                "expected_version": current["version"],
                "expected_approved_revision_id": approved["approved_revision_id"],
                "reason": "Annulation atomique.",
            },
        )
    )
    assert response.status_code == 503
    after = persisted_activity(auth.engine, approved["id"])
    assert after == before


@pytest.mark.parametrize(
    "action",
    [
        "edit",
        "submit",
        "return_supervisor",
        "prevalidate",
        "return_validator",
        "activate",
    ],
)
@pytest.mark.parametrize("failure", ["audit", "constraint", "commit"])
def test_m14_amendment_workflow_constraint_failures_roll_back(
    planning, monkeypatch, action, failure
):
    approved, operation_type = approved_activity(planning)
    opened = open_amendment(planning, approved, f"Rollback {action}")
    current = opened
    revision = None
    if action != "edit":
        current = edit_amendment(planning, current, operation_type, f"Avant {action}")
    if action in {
        "return_supervisor",
        "prevalidate",
        "return_validator",
        "activate",
    }:
        revision = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/submissions",
            {"expected_version": current["version"]},
        ).json()
        current = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    if action in {"return_validator", "activate"}:
        result = post(
            planning["supervisor"],
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {"expected_version": current["version"], "decision": "prevalidate"},
        ).json()
        current = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
        assert current["version"] == result["activity_version"]

    auth = planning["auth"]
    before = persisted_activity(auth.engine, approved["id"])
    real_audit = auth.business_audit

    def fail_transaction(db, *args, **kwargs):
        if failure == "audit":
            raise IntegrityError("synthetic amendment audit failure", {}, Exception())
        real_audit(db, *args, **kwargs)
        if failure == "constraint":
            db.execute(
                text(
                    "INSERT INTO mjl_ownership_context (id,created_at) "
                    "VALUES ('NOT_MJL',clock_timestamp())"
                )
            )
        else:
            db.info["fail_amendment_commit"] = True

    monkeypatch.setattr(auth, "business_audit", fail_transaction)
    if failure == "commit":
        real_commit = SessionTransaction.commit

        def fail_commit(transaction, *args, **kwargs):
            if transaction.session.info.pop("fail_amendment_commit", False):
                raise IntegrityError(
                    "synthetic amendment commit failure", {}, Exception()
                )
            return real_commit(transaction, *args, **kwargs)

        monkeypatch.setattr(SessionTransaction, "commit", fail_commit)
    if action == "edit":
        response = patch(
            planning["agent2"],
            f"/api/v1/activities/{approved['id']}",
            plan(
                operation_type,
                description="Modification à annuler",
                operations=[
                    {key: value for key, value in row.items() if key != "position"}
                    for row in reversed(current["operations"])
                ]
                + [
                    {
                        "type_id": operation_type["id"],
                        "name": "Ajout à annuler",
                        "allocation": "1",
                    }
                ],
                allocation="300001",
                expected_version=current["version"],
            ),
        )
    elif action == "submit":
        response = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/submissions",
            {"expected_version": current["version"]},
        )
    else:
        reviewer = (
            planning["validator"]
            if action in {"return_validator", "activate"}
            else planning["supervisor"]
        )
        response = post(
            reviewer,
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": current["version"],
                "decision": (
                    "approve"
                    if action == "activate"
                    else "prevalidate"
                    if action == "prevalidate"
                    else "return"
                ),
                **(
                    {"reason": "Retour annulé"}
                    if action in {"return_supervisor", "return_validator"}
                    else {}
                ),
            },
        )
    assert response.status_code == 503, response.text
    after = persisted_activity(auth.engine, approved["id"])
    assert after == before


def test_m15_database_constraints_and_history_scope_fail_closed(planning):
    approved, _operation_type = approved_activity(planning)
    opened = open_amendment(planning, approved)
    with pytest.raises(DBAPIError):
        with Session(planning["auth"].engine) as db, db.begin():
            db.execute(
                text("UPDATE pta_activity SET amendment_id=NULL WHERE id=:id"),
                {"id": approved["id"]},
            )
    other, _ = approved_activity(planning)
    assert (
        planning["agent"]
        .get(f"/api/v1/activities/{other['id']}/amendments/{opened['amendment']['id']}")
        .status_code
        == 404
    )
    first = (
        planning["agent"]
        .get(f"/api/v1/activities/{approved['id']}/revisions?limit=1")
        .json()
    )
    assert first["next"]
    assert planning["agent"].get(first["next"]).status_code == 200
    assert planning["agent"].get(first["next"][:-1] + "x").status_code == 422


def test_m03_m05_late_dates_same_year_and_unchanged_submission(planning):
    approved, operation_type = approved_activity(planning)
    opened = open_amendment(planning, approved, "Calendrier tardif")
    unchanged = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/submissions",
        {"expected_version": opened["version"]},
    )
    assert unchanged.status_code == 409
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            operation_type,
            planned_start="2027-01-01",
            planned_end="2030-12-31",
            operations=[
                {key: value for key, value in row.items() if key != "position"}
                for row in opened["operations"]
            ],
            expected_version=opened["version"],
        ),
    )
    assert changed.status_code == 200, changed.text
    wrong_year = patch(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            operation_type,
            planned_start="2028-01-01",
            planned_end="2030-12-31",
            operations=[
                {key: value for key, value in row.items() if key != "position"}
                for row in changed.json()["operations"]
            ],
            expected_version=changed.json()["version"],
        ),
    )
    assert wrong_year.status_code == 422


def test_m15_m17_lineage_guard_and_maximum_candidate_remain_cancellable(planning):
    approved, operation_type = approved_activity(planning)
    opened = open_amendment(planning, approved, "🧪" * 4000)
    operations = [
        {
            "id": row["id"],
            "type_id": operation_type["id"],
            "name": f"Opération {index:03d} " + "🧪" * 185,
            "allocation": "1",
        }
        for index, row in enumerate(opened["operations"])
    ] + [
        {
            "type_id": operation_type["id"],
            "name": f"Opération {index:03d} " + "🧪" * 185,
            "allocation": "1",
        }
        for index in range(2, 100)
    ]
    changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            operation_type,
            description="🧪" * 4000,
            allocation="100",
            operations=operations,
            expected_version=opened["version"],
        ),
    )
    assert changed.status_code == 200, changed.text
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/submissions",
        {"expected_version": changed.json()["version"]},
    ).json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": revision["activity_version"], "decision": "prevalidate"},
    ).json()
    activated = post(
        planning["validator"],
        f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
        {"expected_version": prevalidated["activity_version"], "decision": "approve"},
    )
    assert activated.status_code == 201, activated.text
    maximum_base = planning["agent"].get(f"/api/v1/activities/{approved['id']}").json()
    second = open_amendment(planning, maximum_base, "🧭" * 4000)
    second_operations = [
        {
            "id": row["id"],
            "type_id": operation_type["id"],
            "name": f"Remplacement {index:03d} " + "🧭" * 183,
            "allocation": "1",
        }
        for index, row in enumerate(second["operations"])
    ]
    second_changed = patch(
        planning["agent2"],
        f"/api/v1/activities/{approved['id']}",
        plan(
            operation_type,
            description="🧭" * 4000,
            allocation="100",
            operations=second_operations,
            expected_version=second["version"],
        ),
    )
    assert second_changed.status_code == 200, second_changed.text
    cancelled = cancel_amendment(planning, second_changed.json(), "🧭" * 4000)
    assert cancelled["state"] == "approved"
    with Session(planning["auth"].engine) as db:
        size = db.scalar(
            text(
                "SELECT octet_length(business::text) FROM auth_audit "
                "WHERE target=:target AND action='activity.amendment_cancel'"
            ),
            {"target": approved["id"]},
        )
        assert size is not None and size <= 1_048_576

    reopened = open_amendment(planning, cancelled, "Lignée invalide")
    edited = edit_amendment(planning, reopened, operation_type, "Lignée candidate")
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{approved['id']}/submissions",
        {"expected_version": edited["version"]},
    ).json()
    with pytest.raises(DBAPIError):
        with Session(planning["auth"].engine) as db, db.begin():
            invalid_revision_id = str(uuid4())
            db.execute(
                text(
                    "INSERT INTO pta_activity_revision "
                    "(id,context_id,activity_id,revision_number,snapshot,fingerprint,"
                    "submitter_id,submitted_at) "
                    "SELECT :invalid_id,context_id,activity_id,revision_number+100,"
                    "jsonb_set(snapshot,'{base_approved_revision_id}',"
                    "to_jsonb(CAST(:wrong AS text))),fingerprint,submitter_id,"
                    "submitted_at "
                    "FROM pta_activity_revision WHERE id=:revision_id"
                ),
                {
                    "invalid_id": invalid_revision_id,
                    "wrong": str(uuid4()),
                    "revision_id": submitted["id"],
                },
            )
            db.execute(
                text(
                    "UPDATE pta_activity SET current_revision_id=:revision_id "
                    "WHERE id=:activity_id"
                ),
                {
                    "revision_id": invalid_revision_id,
                    "activity_id": approved["id"],
                },
            )


def test_m15_database_rejects_unreviewed_approved_base(planning):
    approved, _operation_type = approved_activity(planning)
    opened = open_amendment(planning, approved, "Socle à protéger")
    with pytest.raises(DBAPIError):
        with Session(planning["auth"].engine) as db, db.begin():
            invalid_revision_id = str(uuid4())
            db.execute(
                text(
                    "INSERT INTO pta_activity_revision "
                    "(id,context_id,activity_id,revision_number,snapshot,fingerprint,"
                    "submitter_id,submitted_at) "
                    "SELECT :invalid_id,context_id,activity_id,revision_number+100,"
                    "snapshot,fingerprint,submitter_id,submitted_at "
                    "FROM pta_activity_revision WHERE id=:approved_id"
                ),
                {
                    "invalid_id": invalid_revision_id,
                    "approved_id": approved["approved_revision_id"],
                },
            )
            db.execute(
                text(
                    "UPDATE pta_activity SET current_revision_id=:invalid_id,"
                    "approved_revision_id=:invalid_id WHERE id=:activity_id"
                ),
                {"invalid_id": invalid_revision_id, "activity_id": opened["id"]},
            )


def test_m06_cancelled_candidate_contributor_cannot_later_review(planning, auth_env):
    approved, operation_type = approved_activity(planning)
    opened = open_amendment(planning, approved, "Contribution annulée")
    changed = edit_amendment(planning, opened, operation_type, "Travail annulé")
    restored = cancel_amendment(planning, changed)

    users = planning["admin"].get("/api/v1/access/users").json()["items"]
    agent2 = next(row for row in users if row["email"] == "agent2@example.test")
    role_change = planning["admin"].patch(
        f"/api/v1/access/users/{agent2['id']}",
        headers=headers(planning["admin"]),
        json={
            "expected_version": agent2["version"],
            "role": "AGENT_VERIFICATEUR",
        },
    )
    assert role_change.status_code == 200, role_change.text

    with TestClient(planning["admin"].app, base_url="http://localhost") as reviewer:
        reviewer.app.state.auth.policy = reviewer.app.state.auth.policy.model_copy(
            update={
                "lifecycle_database": reviewer.app.state.auth.engine.url.database,
                "resend_seconds": 0,
            }
        )
        login_existing(reviewer, auth_env.mailbox, "agent2@example.test")
        reopened = open_amendment(planning, restored, "Nouveau cycle")
        revised = patch(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}",
            plan(
                operation_type,
                description="Nouveau candidat indépendant",
                operations=[
                    {key: value for key, value in row.items() if key != "position"}
                    for row in reopened["operations"]
                ],
                expected_version=reopened["version"],
            ),
        ).json()
        revision = post(
            planning["agent"],
            f"/api/v1/activities/{approved['id']}/submissions",
            {"expected_version": revised["version"]},
        ).json()
        denied = post(
            reviewer,
            f"/api/v1/activities/{approved['id']}/revisions/{revision['id']}/decisions",
            {
                "expected_version": revision["activity_version"],
                "decision": "prevalidate",
            },
        )
        assert denied.status_code == 409
        assert denied.json()["code"] == "reviewer_contributed"


@pytest.mark.parametrize("resource", ["detail", "list", "history", "amendment"])
def test_m12_http_reads_are_coherent_during_cancellation(planning, resource):
    approved, operation_type = approved_activity(planning)
    opened = open_amendment(planning, approved, "Lecture concurrente")
    changed = edit_amendment(planning, opened, operation_type, "Candidat visible")
    paths = {
        "detail": f"/api/v1/activities/{approved['id']}",
        "list": f"/api/v1/ptas/{approved['pta_id']}/activities",
        "history": f"/api/v1/activities/{approved['id']}/revisions",
        "amendment": (
            f"/api/v1/activities/{approved['id']}/amendments/"
            f"{opened['amendment']['id']}"
        ),
    }
    entered, release, attempted = Event(), Event(), Event()
    writer_pid = {"value": None}

    def hold_read(_conn, _cursor, statement, _parameters, _context, _many):
        normalized = statement.upper()
        if "FROM PTA_ACTIVITY" in normalized and "FOR SHARE" in normalized:
            entered.set()
            assert release.wait(5), "bounded coherent-read release missing"

    def observe_write(conn, _cursor, statement, _parameters, _context, _many):
        normalized = statement.upper()
        if "FROM PTA_ACTIVITY" in normalized and "FOR UPDATE" in normalized:
            writer_pid["value"] = conn.connection.driver_connection.info.backend_pid
            attempted.set()

    reader = TestClient(planning["admin"].app, base_url="http://localhost")
    writer = TestClient(planning["admin"].app, base_url="http://localhost")
    reader.cookies.update(planning["agent"].cookies)
    writer.cookies.update(planning["agent2"].cookies)
    engine = planning["auth"].engine
    event.listen(engine, "after_cursor_execute", hold_read)
    event.listen(engine, "before_cursor_execute", observe_write)
    try:
        with (
            ThreadPoolExecutor(max_workers=1) as reads,
            ThreadPoolExecutor(max_workers=1) as writes,
        ):
            pending_read = reads.submit(reader.get, paths[resource])
            assert entered.wait(5), "HTTP read did not acquire Activity FOR SHARE"
            pending_write = writes.submit(
                post,
                writer,
                f"/api/v1/activities/{approved['id']}/amendments/"
                f"{opened['amendment']['id']}/cancellation",
                {
                    "expected_version": changed["version"],
                    "expected_approved_revision_id": approved["approved_revision_id"],
                    "reason": "Annulation concurrente.",
                },
            )
            assert attempted.wait(5), "cancellation did not attempt Activity lock"
            deadline = monotonic() + 5
            waiting = False
            while monotonic() < deadline:
                with engine.connect() as observer:
                    waiting = (
                        observer.scalar(
                            text(
                                "SELECT wait_event_type='Lock' FROM pg_stat_activity "
                                "WHERE pid=:pid"
                            ),
                            {"pid": writer_pid["value"]},
                        )
                        is True
                    )
                if waiting:
                    break
                Event().wait(0.01)
            assert waiting, "cancellation was not observed waiting on the read lock"
            release.set()
            before = pending_read.result(timeout=10)
            cancelled = pending_write.result(timeout=10)
    finally:
        release.set()
        event.remove(engine, "after_cursor_execute", hold_read)
        event.remove(engine, "before_cursor_execute", observe_write)
        reader.close()
        writer.close()
    assert before.status_code == 200, before.text
    assert cancelled.status_code == 200, cancelled.text
    before_payload = before.json()
    if resource == "detail":
        candidate = before_payload
        assert candidate["version"] == changed["version"]
        assert candidate["approved_revision_id"] == approved["approved_revision_id"]
        assert candidate["approved"] == approved["approved"]
        assert candidate["candidate"] == changed["candidate"]
        assert candidate["operations"] == changed["operations"]
        assert candidate["execution_paused"] is True
    elif resource == "list":
        candidate = next(
            row for row in before_payload["data"] if row["id"] == approved["id"]
        )
        assert candidate["approved_revision_id"] == approved["approved_revision_id"]
        assert candidate["approved"] == approved["approved"]
        assert candidate["candidate"] == changed["candidate"]
        assert candidate["operations"] == changed["operations"]
        assert candidate["execution_paused"] is True
    elif resource == "history":
        kinds = [row["kind"] for row in before_payload["data"]]
        assert kinds.count("revision") == 1
        assert kinds.count("amendment_open") == 1
        assert "amendment_cancel" not in kinds
    elif resource == "amendment":
        assert before_payload["status"] == "active"
        assert (
            before_payload["base_approved_revision_id"]
            == approved["approved_revision_id"]
        )
        assert before_payload["candidate"]["description"] == changed["description"]
        assert [
            (row["id"], row["name"], row["allocation"])
            for row in before_payload["candidate"]["operations"]
        ] == [
            (row["id"], row["name"], row["allocation"]) for row in changed["operations"]
        ]

    after = planning["agent"].get(f"/api/v1/activities/{approved['id']}")
    assert after.status_code == 200
    restored = after.json()
    assert restored["state"] == "approved"
    assert restored["approved_revision_id"] == approved["approved_revision_id"]
    assert restored["approved"] == approved["approved"]
    assert restored["candidate"] is None
    assert restored["operations"] == approved["operations"]
    history = (
        planning["agent"].get(f"/api/v1/activities/{approved['id']}/revisions").json()
    )
    assert [row["kind"] for row in history["data"]].count("amendment_cancel") == 1
    archived = planning["agent"].get(paths["amendment"])
    assert archived.status_code == 200
    assert archived.json()["status"] == "cancelled"
    assert archived.json()["candidate"]["description"] == changed["description"]
