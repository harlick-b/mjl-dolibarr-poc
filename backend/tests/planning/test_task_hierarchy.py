from datetime import date

import pytest

from app.auth.service import AuthError
from app.planning.core.service import validate_draft
from app.planning.core.task_hierarchy import (
    activity_progress,
    manual_task_progress,
    normalize_tasks,
)


def task(name: str, amount: str, weight: str, *, subtasks=None):
    return {
        "type_id": "11111111-1111-4111-8111-111111111111",
        "name": name,
        "description": "",
        "allocation": amount,
        "weight": weight,
        "planned_start": "2027-01-01",
        "planned_end": "2027-12-31",
        "subtasks": subtasks or [],
    }


def subtask(name: str, amount: str, weight: str):
    return {
        "name": name,
        "description": "",
        "allocation": amount,
        "weight": weight,
        "planned_start": "2027-01-01",
        "planned_end": "2027-12-31",
    }


def test_weighted_activity_progress_matches_the_approved_example():
    assert activity_progress([(2000, 10000), (6000, 5000), (2000, 0)]) == 5000
    assert activity_progress([(3333, 3333), (6667, 6667)]) == 5556


def test_activity_progress_reaches_100_only_when_every_contribution_is_complete():
    assert activity_progress([(9999, 10000), (1, 9999)]) == 9999
    assert activity_progress([(9999, 10000), (1, 10000)]) == 10000


def test_weighted_legacy_completion_preserves_only_established_full_progress():
    assert manual_task_progress(None, completed=True, weighted=True) == 10000
    assert manual_task_progress(None, completed=False, weighted=True) == 0
    assert manual_task_progress(None, completed=True, weighted=False) is None
    assert manual_task_progress(3750, completed=False, weighted=True) == 3750


def test_draft_allows_incomplete_weights_but_submission_requires_exact_totals():
    rows = [task("Préparation", "100", "20.00")]

    normalized = normalize_tasks(
        rows,
        activity_start=date(2027, 1, 1),
        activity_end=date(2027, 12, 31),
        submitting=False,
    )
    assert normalized[0]["weight_basis_points"] == 2000

    with pytest.raises(AuthError) as problem:
        normalize_tasks(
            rows,
            activity_start=date(2027, 1, 1),
            activity_end=date(2027, 12, 31),
            submitting=True,
        )
    assert problem.value.code == "task_weights_mismatch"


def test_draft_allows_a_missing_category_until_submission():
    rows = [task("Préparation", "100", "20.00")]
    rows[0]["type_id"] = None

    normalized = normalize_tasks(
        rows,
        activity_start=None,
        activity_end=None,
        submitting=False,
    )
    assert normalized[0]["type_id"] is None

    with pytest.raises(AuthError) as problem:
        normalize_tasks(
            rows,
            activity_start=date(2027, 1, 1),
            activity_end=date(2027, 12, 31),
            submitting=True,
        )
    assert problem.value.code == "task_category_incomplete"


def test_submission_requires_balanced_positive_subtasks_inside_parent_dates():
    rows = [
        task(
            "Formation",
            "2000000",
            "100.00",
            subtasks=[
                subtask("Salle", "500000", "25.00"),
                subtask("Restauration", "1000000", "50.00"),
                subtask("Documentation", "500000", "25.00"),
            ],
        )
    ]

    normalized = normalize_tasks(
        rows,
        activity_start=date(2027, 1, 1),
        activity_end=date(2027, 12, 31),
        submitting=True,
    )
    assert sum(row["allocation"] for row in normalized[0]["subtasks"]) == 2000000
    assert sum(row["weight_basis_points"] for row in normalized[0]["subtasks"]) == 10000


def test_draft_rejects_subtask_amounts_above_the_parent_task():
    rows = [
        task(
            "Formation",
            "100",
            "",
            subtasks=[subtask("Salle", "120", "")],
        )
    ]

    with pytest.raises(AuthError) as problem:
        normalize_tasks(
            rows,
            activity_start=None,
            activity_end=None,
            submitting=False,
        )
    assert problem.value.code == "subtask_allocation_exceeded"


def test_draft_rejects_task_weights_above_100_percent():
    rows = [
        task("Préparation", "50", "60"),
        task("Formation", "50", "50"),
    ]

    with pytest.raises(AuthError) as problem:
        normalize_tasks(
            rows,
            activity_start=None,
            activity_end=None,
            submitting=False,
        )
    assert problem.value.code == "task_weights_exceeded"


def test_draft_rejects_subtask_weights_above_100_percent():
    rows = [
        task(
            "Formation",
            "100",
            "",
            subtasks=[
                subtask("Salle", "50", "60"),
                subtask("Supports", "50", "50"),
            ],
        )
    ]

    with pytest.raises(AuthError) as problem:
        normalize_tasks(
            rows,
            activity_start=None,
            activity_end=None,
            submitting=False,
        )
    assert problem.value.code == "subtask_weights_exceeded"


def test_draft_rejects_task_amounts_above_the_activity_budget():
    payload = {
        "name": "Formation",
        "description": "",
        "allocation": "100",
        "tasks": [task("Préparation", "120", "")],
    }

    with pytest.raises(AuthError) as problem:
        validate_draft(payload, 2027)
    assert problem.value.code == "allocation_exceeded"
