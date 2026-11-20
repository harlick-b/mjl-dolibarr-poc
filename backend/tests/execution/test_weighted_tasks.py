# ruff: noqa: F401, F811
from copy import deepcopy
from datetime import datetime, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from app.planning.core.models import (
    Activity,
    ActivityRevision,
    DisbursementRequest,
    Operation,
)
from app.planning.core.service import fingerprint
from app.planning.finance.funding import excluded_reviewers as funding_reviewers
from tests.execution.test_execution import approved_execution_activity
from tests.planning.test_amendments import open_amendment
from tests.planning.test_planning import (  # noqa: F401
    admin,
    patch,
    planning,
    post,
    put,
    references,
)


def _editable_subtask(row):
    return {
        key: row[key]
        for key in (
            "id",
            "name",
            "description",
            "allocation",
            "weight",
            "planned_start",
            "planned_end",
        )
    }


def _editable_task(row):
    return {
        key: row[key]
        for key in (
            "id",
            "type_id",
            "name",
            "description",
            "allocation",
            "weight",
            "planned_start",
            "planned_end",
        )
    } | {"subtasks": [_editable_subtask(child) for child in row["subtasks"]]}


def test_draft_can_add_a_task_with_subtasks_then_reorder_and_remove_children(
    planning,
):
    _partner, category, project = references(planning)
    today = datetime.now(ZoneInfo("Africa/Porto-Novo")).date()
    if today.year != 2027:
        response = post(
            planning["supervisor"],
            f"/api/v1/projects/{project['id']}/ptas",
            {"year": today.year, "name": f"PTA {today.year}"},
        )
        assert response.status_code in (201, 409), response.text
    end = today + timedelta(days=30)
    created_response = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/{today.year}/activities",
        {
            "name": "Hiérarchie modifiable",
            "description": "",
            "planned_start": today.isoformat(),
            "planned_end": end.isoformat(),
            "allocation": "1000",
            "tasks": [
                {
                    "type_id": category["id"],
                    "name": "Tâche existante",
                    "description": "",
                    "allocation": "1000",
                    "weight": "50.00",
                    "planned_start": today.isoformat(),
                    "planned_end": end.isoformat(),
                    "subtasks": [
                        {
                            "name": "Première",
                            "description": "",
                            "allocation": "400",
                            "weight": "40.00",
                            "planned_start": today.isoformat(),
                            "planned_end": end.isoformat(),
                        },
                        {
                            "name": "Deuxième",
                            "description": "",
                            "allocation": "600",
                            "weight": "60.00",
                            "planned_start": today.isoformat(),
                            "planned_end": end.isoformat(),
                        },
                    ],
                }
            ],
            "request_key": str(uuid4()),
        },
    )
    assert created_response.status_code == 201, created_response.text
    created = created_response.json()
    existing = _editable_task(created["tasks"][0])
    existing["subtasks"].reverse()
    added_response = patch(
        planning["agent"],
        f"/api/v1/activities/{created['id']}",
        {
            "expected_version": created["version"],
            "name": created["name"],
            "description": created["description"],
            "planned_start": created["planned_start"],
            "planned_end": created["planned_end"],
            "allocation": "1500",
            "tasks": [
                existing,
                {
                    "type_id": category["id"],
                    "name": "Nouvelle tâche",
                    "description": "",
                    "allocation": "500",
                    "weight": "50.00",
                    "planned_start": today.isoformat(),
                    "planned_end": end.isoformat(),
                    "subtasks": [
                        {
                            "name": "Enfant créé avec le parent",
                            "description": "",
                            "allocation": "500",
                            "weight": "100.00",
                            "planned_start": today.isoformat(),
                            "planned_end": end.isoformat(),
                        }
                    ],
                },
            ],
        },
    )
    assert added_response.status_code == 200, added_response.text
    added = added_response.json()
    added_plan = added["candidate"] or added
    assert [row["name"] for row in added_plan["tasks"][0]["subtasks"]] == [
        "Deuxième",
        "Première",
    ]
    assert added_plan["tasks"][1]["subtasks"][0]["name"] == (
        "Enfant créé avec le parent"
    )

    kept_task = _editable_task(added_plan["tasks"][0])
    kept_task["subtasks"] = kept_task["subtasks"][:1]
    removed_response = patch(
        planning["agent"],
        f"/api/v1/activities/{created['id']}",
        {
            "expected_version": added["version"],
            "name": added_plan["name"],
            "description": added_plan["description"],
            "planned_start": added_plan["planned_start"],
            "planned_end": added_plan["planned_end"],
            "allocation": added_plan["allocation"],
            "tasks": [kept_task, _editable_task(added_plan["tasks"][1])],
        },
    )
    assert removed_response.status_code == 200, removed_response.text
    removed = removed_response.json()
    removed_plan = removed["candidate"] or removed
    assert len(removed_plan["tasks"][0]["subtasks"]) == 1


def test_weighted_subtasks_roll_up_progress_and_spending_once(
    planning, auth_env, monkeypatch
):
    _partner, category, project = references(planning)
    today = datetime.now(ZoneInfo("Africa/Porto-Novo")).date()
    if today.year != 2027:
        pta = post(
            planning["supervisor"],
            f"/api/v1/projects/{project['id']}/ptas",
            {"year": today.year, "name": f"PTA {today.year}"},
        )
        assert pta.status_code == 201, pta.text
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/{today.year}/activities",
        {
            "name": "Formation pondérée",
            "description": "Une tâche financière et deux sous-tâches.",
            "planned_start": today.isoformat(),
            "planned_end": (today + timedelta(days=30)).isoformat(),
            "allocation": "2100000",
            "tasks": [
                {
                    "type_id": category["id"],
                    "name": "Organisation",
                    "description": "",
                    "allocation": "2000000",
                    "weight": "50.00",
                    "planned_start": today.isoformat(),
                    "planned_end": (today + timedelta(days=30)).isoformat(),
                    "subtasks": [
                        {
                            "name": "Salle",
                            "description": "",
                            "allocation": "500000",
                            "weight": "25.00",
                            "planned_start": today.isoformat(),
                            "planned_end": (today + timedelta(days=10)).isoformat(),
                        },
                        {
                            "name": "Restauration",
                            "description": "",
                            "allocation": "1500000",
                            "weight": "75.00",
                            "planned_start": today.isoformat(),
                            "planned_end": (today + timedelta(days=30)).isoformat(),
                        },
                    ],
                },
                {
                    "type_id": category["id"],
                    "name": "Rapport",
                    "description": "",
                    "allocation": "100000",
                    "weight": "50.00",
                    "planned_start": today.isoformat(),
                    "planned_end": (today + timedelta(days=30)).isoformat(),
                    "subtasks": [],
                },
            ],
            "request_key": str(uuid4()),
        },
    )
    assert created.status_code == 201, created.text
    activity = created.json()
    assert activity["tasks"][0]["subtasks"][0]["allocation"] == "500000"
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    )
    assert submitted.status_code == 201, submitted.text
    revision = submitted.json()
    agent_ids = [
        planning[name].get("/api/v1/auth/session").json()["user"]["id"]
        for name in ("agent", "agent2")
    ]
    assigned = put(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/assignments",
        {
            "expected_version": revision["activity_version"],
            "agent_ids": agent_ids,
        },
    )
    assert assigned.status_code == 200, assigned.text
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": assigned.json()["version"],
            "decision": "prevalidate",
        },
    )
    assert prevalidated.status_code == 201, prevalidated.text
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text
    detail = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    task, direct_task = detail["tasks"]
    first, second = task["subtasks"]
    recorded = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{task['id']}/subtasks/{first['id']}/execution",
        {
            "action": "record",
            "expected_version": detail["version"],
            "expected_approved_revision_id": detail["approved_revision_id"],
            "actual_spent": "400000",
            "execution_completed": True,
            "execution_observation": "",
        },
    )
    assert recorded.status_code == 200, recorded.text
    partial = recorded.json()
    assert partial["progress"] == "12.50"
    assert partial["tasks"][0]["progress"] == "25.00"
    assert partial["tasks"][0]["actual_spent"] is None
    zero_progress = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/tasks/{direct_task['id']}/execution",
        {
            "action": "record",
            "expected_version": partial["version"],
            "expected_approved_revision_id": partial["approved_revision_id"],
            "actual_spent": None,
            "progress": "0.00",
            "execution_completed": False,
            "execution_observation": "Rapport commencé.",
        },
    )
    assert zero_progress.status_code == 200, zero_progress.text
    assert zero_progress.json()["tasks"][1]["progress"] == "0.00"
    physical_only = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/tasks/{direct_task['id']}/execution",
        {
            "action": "record",
            "expected_version": zero_progress.json()["version"],
            "expected_approved_revision_id": zero_progress.json()[
                "approved_revision_id"
            ],
            "actual_spent": None,
            "progress": "100.00",
            "execution_completed": True,
            "execution_observation": "Rapport terminé, dépense à saisir.",
            "correction_reason": "Le rapport est maintenant terminé.",
        },
    )
    assert physical_only.status_code == 200, physical_only.text
    physical = physical_only.json()
    assert physical["progress"] == "62.50"
    assert physical["tasks"][1]["actual_spent"] is None
    second_started = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/tasks/{task['id']}/subtasks/{second['id']}/execution",
        {
            "action": "record",
            "expected_version": physical["version"],
            "expected_approved_revision_id": physical["approved_revision_id"],
            "actual_spent": "1400000",
            "execution_completed": False,
            "execution_observation": "Sous-tâche achevée avec économie.",
        },
    )
    assert second_started.status_code == 200, second_started.text
    finished = patch(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/tasks/{task['id']}/subtasks/{second['id']}/execution",
        {
            "action": "record",
            "expected_version": second_started.json()["version"],
            "expected_approved_revision_id": second_started.json()[
                "approved_revision_id"
            ],
            "actual_spent": "1400000",
            "execution_completed": True,
            "execution_observation": "Sous-tâche achevée avec économie.",
            "correction_reason": "Confirmer la fin de la sous-tâche.",
        },
    )
    assert finished.status_code == 200, finished.text
    result = finished.json()
    assert result["progress"] == "100.00"
    assert result["spending_total"] is None
    assert result["tasks"][0]["actual_spent"] == "1800000"
    engine = create_engine(auth_env.url)
    with Session(engine) as db:
        item = db.get(Activity, activity["id"])
        assert item
        original_scalars = db.scalars
        query_count = 0

        def without_current_contributors(statement):
            nonlocal query_count
            query_count += 1
            if query_count == 1:
                return []
            return original_scalars(statement)

        monkeypatch.setattr(db, "scalars", without_current_contributors)
        assert agent_ids[0] in funding_reviewers(db, item, agent_ids[1])
    engine.dispose()
    financial = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{direct_task['id']}/execution",
        {
            "action": "record",
            "expected_version": result["version"],
            "expected_approved_revision_id": result["approved_revision_id"],
            "actual_spent": "100000",
            "progress": "100.00",
            "execution_completed": True,
            "execution_observation": "Rapport terminé, dépense à saisir.",
            "correction_reason": "Ajouter la dépense finale.",
        },
    )
    assert financial.status_code == 200, financial.text
    assert financial.json()["spending_total"] == "1900000"
    disbursement = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/disbursement-requests",
        {
            "expected_version": financial.json()["version"],
            "expected_approved_revision_id": financial.json()["approved_revision_id"],
            "amount": financial.json()["spending_total"],
        },
    )
    assert disbursement.status_code == 201, disbursement.text
    engine = create_engine(auth_env.url)
    with Session(engine) as db:
        request = db.get(DisbursementRequest, disbursement.json()["id"])
        assert request
        assert set(agent_ids).issubset(request.snapshot["excluded_reviewer_ids"])
    engine.dispose()
    released = post(
        planning["agent2"],
        f"/api/v1/activities/{activity['id']}/disbursement-requests/"
        f"{disbursement.json()['id']}/cancellation",
        {
            "expected_version": disbursement.json()["activity_version"],
            "reason": "Poursuivre le test de modification.",
        },
    )
    assert released.status_code == 201, released.text

    current = planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
    opened_response = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/amendments",
        {
            "expected_version": current["version"],
            "expected_approved_revision_id": current["approved_revision_id"],
            "reason": "Ajouter une sous-tâche après le démarrage.",
        },
    )
    assert opened_response.status_code == 201, opened_response.text
    opened = opened_response.json()

    def child_payload(row):
        return {
            key: row[key]
            for key in (
                "id",
                "name",
                "description",
                "allocation",
                "weight",
                "planned_start",
                "planned_end",
            )
        }

    def task_payload(row):
        return {
            key: row[key]
            for key in (
                "id",
                "type_id",
                "name",
                "description",
                "allocation",
                "weight",
                "planned_start",
                "planned_end",
            )
        } | {"subtasks": [child_payload(child) for child in row["subtasks"]]}

    amended_tasks = [task_payload(row) for row in opened["tasks"]]
    forbidden_tasks = [task_payload(row) for row in opened["tasks"]]
    forbidden_tasks[1]["subtasks"] = [
        {
            "name": "Conversion interdite",
            "description": "",
            "allocation": "100000",
            "weight": "100.00",
            "planned_start": today.isoformat(),
            "planned_end": (today + timedelta(days=30)).isoformat(),
        }
    ]
    forbidden = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}",
        {
            "expected_version": opened["version"],
            "name": opened["name"],
            "description": opened["description"],
            "planned_start": opened["planned_start"],
            "planned_end": opened["planned_end"],
            "allocation": opened["allocation"],
            "tasks": forbidden_tasks,
        },
    )
    assert forbidden.status_code == 409, forbidden.text
    assert forbidden.json()["code"] == "started_task_subtasks_forbidden"
    amended_tasks[0]["subtasks"][1]["allocation"] = "1400000"
    amended_tasks[0]["subtasks"][1]["weight"] = "70.00"
    amended_tasks[0]["subtasks"].append(
        {
            "name": "Supports complémentaires",
            "description": "",
            "allocation": "100000",
            "weight": "5.00",
            "planned_start": today.isoformat(),
            "planned_end": (today + timedelta(days=30)).isoformat(),
        }
    )
    changed_response = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}",
        {
            "expected_version": opened["version"],
            "name": opened["name"],
            "description": opened["description"],
            "planned_start": opened["planned_start"],
            "planned_end": opened["planned_end"],
            "allocation": opened["allocation"],
            "tasks": amended_tasks,
        },
    )
    assert changed_response.status_code == 200, changed_response.text
    changed = changed_response.json()
    assert len(changed["candidate"]["tasks"][0]["subtasks"]) == 3
    amendment_revision_response = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": changed["version"]},
    )
    assert amendment_revision_response.status_code == 201, (
        amendment_revision_response.text
    )
    amendment_revision = amendment_revision_response.json()
    assert "tasks" in amendment_revision["snapshot"]
    assert "operations" not in amendment_revision["snapshot"]
    amendment_prevalidation = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{amendment_revision['id']}/decisions",
        {
            "expected_version": amendment_revision["activity_version"],
            "decision": "prevalidate",
        },
    )
    assert amendment_prevalidation.status_code == 201, amendment_prevalidation.text
    amendment_approval = post(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/{amendment_revision['id']}/decisions",
        {
            "expected_version": amendment_prevalidation.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert amendment_approval.status_code == 201, amendment_approval.text
    recalculated = planning["agent"].get(
        f"/api/v1/activities/{activity['id']}/execution"
    )
    assert recalculated.status_code == 200, recalculated.text
    assert recalculated.json()["progress"] == "97.50"
    assert recalculated.json()["tasks"][0]["actual_spent"] is None
    assert recalculated.json()["tasks"][0]["execution_completed"] is False
    assert recalculated.json()["works_completed"] is False
    assert recalculated.json()["spending_total"] is None
    approved_amendment_detail = planning["agent"].get(
        f"/api/v1/activities/{activity['id']}/amendments/{opened['amendment']['id']}"
    )
    assert approved_amendment_detail.status_code == 200, approved_amendment_detail.text
    assert (
        len(approved_amendment_detail.json()["candidate"]["tasks"][0]["subtasks"]) == 3
    )

    history = planning["agent"].get(
        f"/api/v1/activities/{activity['id']}/execution/history"
    )
    assert history.status_code == 200, history.text
    child_history = [
        row for row in history.json()["data"] if row["subtask_id"] == second["id"]
    ]
    assert {row["action"] for row in child_history} == {
        "subtask.execution_recorded",
        "subtask.execution_corrected",
    }

    approved_detail = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}").json()
    )
    second_open_response = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/amendments",
        {
            "expected_version": approved_detail["version"],
            "expected_approved_revision_id": approved_detail["approved_revision_id"],
            "reason": "Vérifier l'annulation du plan hiérarchique.",
        },
    )
    assert second_open_response.status_code == 201, second_open_response.text
    second_open = second_open_response.json()
    changed_again_tasks = [task_payload(row) for row in second_open["tasks"]]
    changed_again_tasks[0]["description"] = "Description candidate à annuler."
    changed_again_tasks[0]["subtasks"][1]["allocation"] = "1350000"
    changed_again_tasks[0]["subtasks"][1]["weight"] = "67.50"
    changed_again_tasks[0]["subtasks"].append(
        {
            "name": "Sous-tâche candidate à annuler",
            "description": "",
            "allocation": "50000",
            "weight": "2.50",
            "planned_start": today.isoformat(),
            "planned_end": (today + timedelta(days=30)).isoformat(),
        }
    )
    changed_again_response = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}",
        {
            "expected_version": second_open["version"],
            "name": second_open["name"],
            "description": second_open["description"],
            "planned_start": second_open["planned_start"],
            "planned_end": second_open["planned_end"],
            "allocation": second_open["allocation"],
            "tasks": changed_again_tasks,
        },
    )
    assert changed_again_response.status_code == 200, changed_again_response.text
    changed_again = changed_again_response.json()
    amendment_detail = planning["agent"].get(
        f"/api/v1/activities/{activity['id']}/amendments/"
        f"{second_open['amendment']['id']}"
    )
    assert amendment_detail.status_code == 200, amendment_detail.text
    assert len(amendment_detail.json()["candidate"]["tasks"][0]["subtasks"]) == 4
    cancellation = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/amendments/"
        f"{second_open['amendment']['id']}/cancellation",
        {
            "expected_version": changed_again["version"],
            "expected_approved_revision_id": changed_again["approved_revision_id"],
            "reason": "Conserver la version approuvée.",
        },
    )
    assert cancellation.status_code == 200, cancellation.text
    assert cancellation.json()["candidate"] is None
    restored = cancellation.json()["tasks"][0]
    assert restored["description"] != "Description candidate à annuler."
    assert len(restored["subtasks"]) == 3
    cancelled_detail = planning["agent"].get(
        f"/api/v1/activities/{activity['id']}/amendments/"
        f"{second_open['amendment']['id']}"
    )
    assert cancelled_detail.status_code == 200, cancelled_detail.text
    assert "tasks" in cancelled_detail.json()["candidate"]

    current_execution = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    restored_task = current_execution["tasks"][0]
    added_child = restored_task["subtasks"][2]
    overspent_response = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{restored_task['id']}"
        f"/subtasks/{added_child['id']}/execution",
        {
            "action": "record",
            "expected_version": current_execution["version"],
            "expected_approved_revision_id": current_execution["approved_revision_id"],
            "actual_spent": "400000",
            "execution_completed": True,
            "execution_observation": "Dépassement à corriger.",
        },
    )
    assert overspent_response.status_code == 200, overspent_response.text
    overspent = overspent_response.json()
    assert overspent["pause_reason"] == "funding_required"
    assert "record" in overspent["tasks"][0]["subtasks"][2]["allowed_actions"]
    lowered_response = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{direct_task['id']}/execution",
        {
            "action": "record",
            "expected_version": overspent["version"],
            "expected_approved_revision_id": overspent["approved_revision_id"],
            "actual_spent": "100000",
            "progress": "50.00",
            "execution_completed": False,
            "execution_observation": "Progression physique corrigée.",
            "correction_reason": "Corriger la progression surestimée.",
        },
    )
    assert lowered_response.status_code == 200, lowered_response.text
    lowered = lowered_response.json()
    progress_bypass = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{direct_task['id']}/execution",
        {
            "action": "record",
            "expected_version": lowered["version"],
            "expected_approved_revision_id": lowered["approved_revision_id"],
            "actual_spent": "100000",
            "progress": "100.00",
            "execution_completed": False,
            "execution_observation": "Tentative de reprise pendant la pause.",
            "correction_reason": "Tester le contrôle serveur.",
        },
    )
    assert progress_bypass.status_code == 409, progress_bypass.text
    assert progress_bypass.json()["code"] == "funding_required"
    corrected_response = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{restored_task['id']}"
        f"/subtasks/{added_child['id']}/execution",
        {
            "action": "record",
            "expected_version": lowered["version"],
            "expected_approved_revision_id": lowered["approved_revision_id"],
            "actual_spent": "100000",
            "execution_completed": True,
            "execution_observation": "Montant corrigé.",
            "correction_reason": "Erreur de saisie du montant.",
        },
    )
    assert corrected_response.status_code == 200, corrected_response.text
    assert corrected_response.json()["spending_total"] == "2000000"
    assert corrected_response.json()["pause_reason"] == "funding_required"


def test_subtask_spending_overflow_is_rejected_without_changing_execution(planning):
    _partner, category, project = references(planning)
    today = datetime.now(ZoneInfo("Africa/Porto-Novo")).date()
    if today.year != 2027:
        pta = post(
            planning["supervisor"],
            f"/api/v1/projects/{project['id']}/ptas",
            {"year": today.year, "name": f"PTA {today.year}"},
        )
        assert pta.status_code in (201, 409), pta.text
    maximum = 9_223_372_036_854_775_807
    created = post(
        planning["agent"],
        f"/api/v1/projects/{project['id']}/ptas/{today.year}/activities",
        {
            "name": "Dépenses consolidées bornées",
            "description": "Refuser un total hors capacité XOF.",
            "planned_start": today.isoformat(),
            "planned_end": (today + timedelta(days=30)).isoformat(),
            "allocation": str(maximum),
            "tasks": [
                {
                    "type_id": category["id"],
                    "name": "Tâche maximale",
                    "description": "",
                    "allocation": str(maximum),
                    "weight": "100.00",
                    "planned_start": today.isoformat(),
                    "planned_end": (today + timedelta(days=30)).isoformat(),
                    "subtasks": [
                        {
                            "name": "Première dépense",
                            "description": "",
                            "allocation": str(maximum - 1),
                            "weight": "50.00",
                            "planned_start": today.isoformat(),
                            "planned_end": (today + timedelta(days=30)).isoformat(),
                        },
                        {
                            "name": "Deuxième dépense",
                            "description": "",
                            "allocation": "1",
                            "weight": "50.00",
                            "planned_start": today.isoformat(),
                            "planned_end": (today + timedelta(days=30)).isoformat(),
                        },
                    ],
                }
            ],
            "request_key": str(uuid4()),
        },
    )
    assert created.status_code == 201, created.text
    activity = created.json()
    submitted = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": activity["version"]},
    )
    assert submitted.status_code == 201, submitted.text
    revision = submitted.json()
    prevalidated = post(
        planning["supervisor"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": revision["activity_version"],
            "decision": "prevalidate",
        },
    )
    assert prevalidated.status_code == 201, prevalidated.text
    approved = post(
        planning["validator"],
        f"/api/v1/activities/{activity['id']}/revisions/{revision['id']}/decisions",
        {
            "expected_version": prevalidated.json()["activity_version"],
            "decision": "approve",
        },
    )
    assert approved.status_code == 201, approved.text
    detail = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    task = detail["tasks"][0]
    first, second = task["subtasks"]
    first_recorded = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{task['id']}"
        f"/subtasks/{first['id']}/execution",
        {
            "action": "record",
            "expected_version": detail["version"],
            "expected_approved_revision_id": detail["approved_revision_id"],
            "actual_spent": str(maximum),
            "execution_completed": True,
            "execution_observation": "Dépense finale avec écart documenté.",
        },
    )
    assert first_recorded.status_code == 200, first_recorded.text
    before = first_recorded.json()
    history_before = (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/execution/history")
        .json()["count"]
    )
    overflow = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{task['id']}"
        f"/subtasks/{second['id']}/execution",
        {
            "action": "record",
            "expected_version": before["version"],
            "expected_approved_revision_id": before["approved_revision_id"],
            "actual_spent": "1",
            "execution_completed": True,
            "execution_observation": "Deuxième dépense finale.",
        },
    )
    assert overflow.status_code == 422, overflow.text
    assert overflow.json()["code"] == "amount_overflow"
    unchanged = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert unchanged["version"] == before["version"]
    assert unchanged["tasks"][0]["subtasks"][1]["actual_spent"] is None
    assert (
        planning["agent"]
        .get(f"/api/v1/activities/{activity['id']}/execution/history")
        .json()["count"]
        == history_before
    )


def test_legacy_completion_survives_weighted_amendment_spending_correction(planning):
    activity = approved_execution_activity(planning)
    with Session(planning["auth"].engine) as db:
        db.execute(text("ALTER TABLE pta_activity_revision DISABLE TRIGGER USER"))
        revision = db.get(ActivityRevision, activity["approved_revision_id"])
        assert revision is not None
        snapshot = deepcopy(revision.snapshot)
        for task in snapshot["operations"]:
            task.pop("weight", None)
        snapshot.pop("content_fingerprint", None)
        digest = fingerprint(snapshot)
        snapshot["content_fingerprint"] = digest
        revision.snapshot = snapshot
        revision.fingerprint = digest
        for task in db.scalars(
            select(Operation).where(Operation.activity_id == activity["id"])
        ):
            task.weight_basis_points = None
        db.flush()
        db.execute(text("ALTER TABLE pta_activity_revision ENABLE TRIGGER USER"))
        db.commit()

    legacy = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    task = legacy["tasks"][0]
    recorded = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{task['id']}/execution",
        {
            "action": "record",
            "expected_version": legacy["version"],
            "expected_approved_revision_id": legacy["approved_revision_id"],
            "actual_spent": "310000",
            "execution_completed": True,
            "execution_observation": "Tâche historique terminée.",
        },
    )
    assert recorded.status_code == 200, recorded.text
    assert recorded.json()["pause_reason"] == "funding_required"

    opened = open_amendment(planning, recorded.json())
    tasks = [_editable_task(row) for row in opened["tasks"]]
    for index, row in enumerate(tasks):
        row["weight"] = "50.00"
        if index == 0:
            row["allocation"] = "320000"
    changed = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}",
        {
            "expected_version": opened["version"],
            "name": opened["name"],
            "description": opened["description"],
            "planned_start": opened["planned_start"],
            "planned_end": opened["planned_end"],
            "allocation": "520000",
            "tasks": tasks,
        },
    )
    assert changed.status_code == 200, changed.text
    revision = post(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/submissions",
        {"expected_version": changed.json()["version"]},
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

    weighted = (
        planning["agent"].get(f"/api/v1/activities/{activity['id']}/execution").json()
    )
    assert weighted["tasks"][0]["progress"] == "100.00"
    correction = patch(
        planning["agent"],
        f"/api/v1/activities/{activity['id']}/tasks/{task['id']}/execution",
        {
            "action": "record",
            "expected_version": weighted["version"],
            "expected_approved_revision_id": weighted["approved_revision_id"],
            "actual_spent": "100000",
            "progress": "100.00",
            "execution_completed": True,
            "execution_observation": "Montant historique corrigé.",
            "correction_reason": "Corriger la dépense sans modifier l’avancement.",
        },
    )
    assert correction.status_code == 200, correction.text
    assert correction.json()["tasks"][0]["execution_completed"] is True
    assert correction.json()["tasks"][0]["progress"] == "100.00"
    assert correction.json()["pause_reason"] == "funding_required"
