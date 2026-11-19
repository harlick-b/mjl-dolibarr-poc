from datetime import date
from typing import Any
from uuid import UUID

from app.auth.service import AuthError

MAX_XOF = 9_223_372_036_854_775_807
PERCENT_TOTAL = 10_000


def percentage(
    value: object, *, required: bool, allow_zero: bool = False
) -> int | None:
    if value in (None, ""):
        if required:
            raise AuthError(422, "task_weights_incomplete")
        return None
    text = str(value)
    whole, separator, fraction = text.partition(".")
    if (
        not whole.isascii()
        or not whole.isdecimal()
        or (separator and (not fraction.isascii() or not fraction.isdecimal()))
        or len(fraction) > 2
    ):
        raise AuthError(422, "input_invalid")
    basis_points = int(whole) * 100 + int(fraction.ljust(2, "0") or "0")
    if basis_points > PERCENT_TOTAL or (
        required and basis_points == 0 and not allow_zero
    ):
        raise AuthError(422, "task_weights_incomplete")
    return basis_points


def activity_progress(weighted_progress: list[tuple[int, int]]) -> int:
    numerator = sum(weight * progress for weight, progress in weighted_progress)
    rounded = min(PERCENT_TOTAL, (numerator + PERCENT_TOTAL // 2) // PERCENT_TOTAL)
    if rounded == PERCENT_TOTAL and any(
        progress < PERCENT_TOTAL for _, progress in weighted_progress
    ):
        return PERCENT_TOTAL - 1
    return rounded


def manual_task_progress(
    value: int | None, *, completed: bool, weighted: bool
) -> int | None:
    if value is not None:
        return value
    if not weighted:
        return None
    return PERCENT_TOTAL if completed else 0


def format_percentage(value: int | None) -> str | None:
    if value is None:
        return None
    return f"{value // 100}.{value % 100:02d}"


def _text(row: dict[str, Any], key: str, maximum: int, *, required: bool) -> str:
    value = str(row.get(key) or "").strip()
    if len(value) > maximum or (required and not value):
        raise AuthError(422, "input_invalid")
    return value


def _amount(value: object) -> int:
    text = str(value or "")
    if not text.isascii() or not text.isdecimal() or text.startswith("0"):
        raise AuthError(422, "input_invalid")
    amount = int(text)
    if amount <= 0 or amount > MAX_XOF:
        raise AuthError(422, "input_invalid")
    return amount


def _date(value: object, *, required: bool) -> date | None:
    if value in (None, ""):
        if required:
            raise AuthError(422, "task_dates_incomplete")
        return None
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise AuthError(422, "input_invalid") from None


def _identifier(value: object) -> str | None:
    if value in (None, ""):
        return None
    try:
        return str(UUID(str(value)))
    except ValueError:
        raise AuthError(422, "input_invalid") from None


def normalize_tasks(
    rows: object,
    *,
    activity_start: date | None,
    activity_end: date | None,
    submitting: bool,
) -> list[dict[str, Any]]:
    if not isinstance(rows, list) or len(rows) > 100 or (submitting and not rows):
        raise AuthError(422, "input_invalid")
    normalized: list[dict[str, Any]] = []
    seen: set[str] = set()
    task_weight_total = 0
    for position, raw in enumerate(rows, 1):
        if not isinstance(raw, dict):
            raise AuthError(422, "input_invalid")
        identifier = _identifier(raw.get("id"))
        if identifier and identifier in seen:
            raise AuthError(422, "input_invalid")
        if identifier:
            seen.add(identifier)
        raw_type_id = raw.get("type_id")
        if raw_type_id in (None, ""):
            if submitting:
                raise AuthError(422, "task_category_incomplete")
            type_id = None
        else:
            try:
                type_id = str(UUID(str(raw_type_id)))
            except ValueError:
                raise AuthError(422, "input_invalid") from None
        start = _date(raw.get("planned_start"), required=submitting)
        end = _date(raw.get("planned_end"), required=submitting)
        if start and end and end < start:
            raise AuthError(422, "task_dates_invalid")
        if start and activity_start and start < activity_start:
            raise AuthError(422, "task_dates_outside_activity")
        if end and activity_end and end > activity_end:
            raise AuthError(422, "task_dates_outside_activity")
        weight = percentage(raw.get("weight"), required=submitting)
        task_weight_total += weight or 0
        subtasks_raw = raw.get("subtasks", [])
        if not isinstance(subtasks_raw, list) or len(subtasks_raw) > 100:
            raise AuthError(422, "input_invalid")
        subtasks: list[dict[str, Any]] = []
        subtask_weight_total = 0
        subtask_amount_total = 0
        subtask_seen: set[str] = set()
        allocation = _amount(raw.get("allocation"))
        for sub_position, child in enumerate(subtasks_raw, 1):
            if not isinstance(child, dict):
                raise AuthError(422, "input_invalid")
            child_id = _identifier(child.get("id"))
            if child_id and child_id in subtask_seen:
                raise AuthError(422, "input_invalid")
            if child_id:
                subtask_seen.add(child_id)
            child_start = _date(child.get("planned_start"), required=submitting)
            child_end = _date(child.get("planned_end"), required=submitting)
            if child_start and child_end and child_end < child_start:
                raise AuthError(422, "subtask_dates_invalid")
            if child_start and start and child_start < start:
                raise AuthError(422, "subtask_dates_outside_task")
            if child_end and end and child_end > end:
                raise AuthError(422, "subtask_dates_outside_task")
            child_weight = percentage(child.get("weight"), required=submitting)
            child_amount = _amount(child.get("allocation"))
            subtask_weight_total += child_weight or 0
            subtask_amount_total += child_amount
            subtasks.append(
                {
                    "id": child_id,
                    "name": _text(child, "name", 200, required=True),
                    "description": _text(child, "description", 4000, required=False),
                    "allocation": child_amount,
                    "weight_basis_points": child_weight,
                    "planned_start": child_start,
                    "planned_end": child_end,
                    "position": sub_position,
                }
            )
        if subtask_weight_total > PERCENT_TOTAL:
            raise AuthError(422, "subtask_weights_exceeded")
        if subtasks and submitting and subtask_weight_total != PERCENT_TOTAL:
            raise AuthError(422, "subtask_weights_mismatch")
        if subtasks and not submitting and subtask_amount_total > allocation:
            raise AuthError(422, "subtask_allocation_exceeded")
        if subtasks and submitting and subtask_amount_total != allocation:
            raise AuthError(422, "subtask_allocation_mismatch")
        normalized.append(
            {
                "id": identifier,
                "type_id": type_id,
                "name": _text(raw, "name", 200, required=True),
                "description": _text(raw, "description", 4000, required=False),
                "allocation": allocation,
                "weight_basis_points": weight,
                "planned_start": start,
                "planned_end": end,
                "position": position,
                "subtasks": subtasks,
            }
        )
    if task_weight_total > PERCENT_TOTAL:
        raise AuthError(422, "task_weights_exceeded")
    if submitting and task_weight_total != PERCENT_TOTAL:
        raise AuthError(422, "task_weights_mismatch")
    return normalized
