"""Compact planning facts after command validation; existing evidence is immutable."""

from typing import Any

# Business fields only; never copy capabilities, approved/candidate projections,
# account proofs, or full API objects into a new planning event.
FIELDS = {
    "id",
    "version",
    "name",
    "label",
    "description",
    "active",
    "state",
    "pta_id",
    "project_id",
    "partner_id",
    "reference",
    "placement_year",
    "planned_start",
    "planned_end",
    "allocation",
    "agent_ids",
    "current_revision_id",
    "approved_revision_id",
    "amendment_id",
    "withdrawal_id",
    "transfer_id",
}
OPERATION_FIELDS = {
    "id",
    "type_id",
    "name",
    "description",
    "allocation",
    "weight",
    "planned_start",
    "planned_end",
    "position",
}
SUBTASK_FIELDS = {
    "id",
    "name",
    "description",
    "allocation",
    "weight",
    "planned_start",
    "planned_end",
    "position",
}


def _safe_row(row: dict[str, Any], fields: set[str]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if key in fields}


def _delta_row(
    row: dict[str, Any], peer: dict[str, Any] | None, fields: set[str]
) -> dict[str, Any]:
    result = {key: row[key] for key in ("id", "name") if key in row}
    if peer is not None:
        result.update(
            {
                key: row.get(key)
                for key in fields - {"id", "name"}
                if row.get(key) != peer.get(key)
            }
        )
    return result


def _operation_deltas(
    old: dict[str, Any] | None, new: dict[str, Any] | None
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    old_safe = _safe_row(old, OPERATION_FIELDS) if old is not None else None
    new_safe = _safe_row(new, OPERATION_FIELDS) if new is not None else None
    old_children = {
        child["id"]: _safe_row(child, SUBTASK_FIELDS)
        for child in (old or {}).get("subtasks", [])
        if isinstance(child, dict) and "id" in child
    }
    new_children = {
        child["id"]: _safe_row(child, SUBTASK_FIELDS)
        for child in (new or {}).get("subtasks", [])
        if isinstance(child, dict) and "id" in child
    }
    if old_safe == new_safe and old_children == new_children:
        return None, None
    old_delta = _delta_row(old_safe, new_safe, OPERATION_FIELDS) if old_safe else None
    new_delta = _delta_row(new_safe, old_safe, OPERATION_FIELDS) if new_safe else None
    changed_children = {
        identifier
        for identifier in old_children.keys() | new_children.keys()
        if old_children.get(identifier) != new_children.get(identifier)
    }
    if old_delta is not None:
        old_delta["subtasks"] = [
            _delta_row(old_children[key], new_children.get(key), SUBTASK_FIELDS)
            for key in sorted(changed_children)
            if key in old_children
        ]
    if new_delta is not None:
        new_delta["subtasks"] = [
            _delta_row(new_children[key], old_children.get(key), SUBTASK_FIELDS)
            for key in sorted(changed_children)
            if key in new_children
        ]
    return old_delta, new_delta


def compact_planning_facts(facts: dict[str, Any]) -> dict[str, Any]:
    result = dict(facts)
    sides = []
    for side in ("before", "after"):
        raw = facts.get(side) or {}
        content = raw.get("content") or raw
        sides.append(
            {
                **{k: v for k, v in raw.items() if k in FIELDS},
                **{k: v for k, v in content.items() if k in FIELDS},
            }
        )
    before, after = sides
    changed = {
        key for key in before.keys() | after.keys() if before.get(key) != after.get(key)
    }
    # IDs/versions remain useful evidence links; no repeated large content.
    changed |= {"id", "version"}
    for side, values in zip(("before", "after"), sides, strict=True):
        if side in facts:
            result[side] = {
                key: value for key, value in values.items() if key in changed
            }
    operations = []
    for side in ("before", "after"):
        raw = facts.get(side) or {}
        content = raw.get("content") or raw
        operations.append(
            {
                row["id"]: row
                for row in content.get("tasks", content.get("operations", []))
                if isinstance(row, dict) and "id" in row
            }
        )
    old, new = operations
    deltas = {
        key: _operation_deltas(old.get(key), new.get(key))
        for key in old.keys() | new.keys()
    }
    for index, side in enumerate(("before", "after")):
        rows = [
            pair[index]
            for _key, pair in sorted(deltas.items())
            if pair[index] is not None
        ]
        if side in result and rows:
            result[side]["operations"] = rows
    return result
