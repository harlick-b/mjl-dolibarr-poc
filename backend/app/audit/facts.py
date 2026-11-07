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
OPERATION_FIELDS = {"id", "type_id", "name", "allocation", "position"}


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
                row["id"]: {k: v for k, v in row.items() if k in OPERATION_FIELDS}
                for row in content.get("operations", [])
            }
        )
    old, new = operations
    changed_ids = {
        key for key in old.keys() | new.keys() if old.get(key) != new.get(key)
    }
    for side, rows in zip(("before", "after"), operations, strict=True):
        if side in result and changed_ids:
            result[side]["operations"] = [
                {
                    field: value
                    for field, value in rows[key].items()
                    if field == "id"
                    or old.get(key, {}).get(field) != new.get(key, {}).get(field)
                }
                for key in sorted(changed_ids)
                if key in rows
            ]
    return result
