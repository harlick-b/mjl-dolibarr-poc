import base64
import hashlib
import hmac
import json
from datetime import date
from typing import Any
from urllib.parse import urlencode
from uuid import UUID

from sqlalchemy import func, select, text, true
from sqlalchemy.orm import Session

from app.auth.models import User
from app.auth.service import AuthError, AuthService
from app.planning.models import (
    Activity,
    ActivityAssignment,
    Operation,
    OperationType,
    Partner,
    Project,
)

CONTEXT = "MJL"
BUSINESS_ROLES = {"AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"}


def principal(
    db: Session,
    auth: AuthService,
    secret: str | None,
    csrf: str | None = None,
    *,
    roles: set[str] = BUSINESS_ROLES,
    mutation: bool = False,
) -> User:
    if mutation:
        context = auth.guard(db, secret, csrf)
        if context.state != "verified" or not context.user_id:
            raise AuthError(401, "otp_required")
        actor = db.get(User, context.user_id)
        assert actor
    else:
        actor = auth.principal(db, secret)
    if actor.role not in roles:
        raise AuthError(403, "business_forbidden")
    auth.environment_verified(db)
    return actor


def locked_mutation(db: Session) -> None:
    db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))


def clean(value: str, maximum: int) -> str:
    result = value.strip()
    if not result or len(result) > maximum:
        raise AuthError(422, "input_invalid")
    return result


def xof(value: str) -> int:
    if not value or not value.isascii() or not value.isdecimal() or value[0] == "0":
        raise AuthError(422, "input_invalid")
    result = int(value)
    if result > 9_223_372_036_854_775_807:
        raise AuthError(422, "input_invalid")
    return result


def reference(db: Session, sequence: str, prefix: str) -> str:
    number = db.scalar(text(f"SELECT nextval('{sequence}')"))
    return f"{prefix}-{number:06d}"


def allowed(role: str, *, resource: str, state: str = "active") -> list[str]:
    actions = ["read"]
    if role == "VALIDATEUR_DEFINITIF" and resource in {"partner", "type", "project"}:
        actions.append("create")
    if role == "VALIDATEUR_DEFINITIF" and resource == "project" and state == "active":
        actions.append("close")
    if role == "AGENT_SAISIE" and resource == "pta" and state == "active":
        actions.append("create_activity")
    if role == "AGENT_SAISIE" and resource == "activity":
        actions.append("edit")
    if (
        role in {"AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"}
        and resource == "activity"
    ):
        actions.append("assign_agents")
    return actions


def partner_item(item: Partner, role: str) -> dict[str, Any]:
    return {
        "id": item.id,
        "name": item.name,
        "active": item.active,
        "allowed_actions": allowed(role, resource="partner"),
    }


def type_item(item: OperationType, role: str) -> dict[str, Any]:
    return {
        "id": item.id,
        "label": item.label,
        "active": item.active,
        "allowed_actions": allowed(role, resource="type"),
    }


def project_item(item: Project, role: str) -> dict[str, Any]:
    return {
        "id": item.id,
        "partner_id": item.partner_id,
        "reference": item.reference,
        "name": item.name,
        "state": item.state,
        "version": item.version,
        "allowed_actions": allowed(role, resource="project", state=item.state),
    }


def activity_item(db: Session, item: Activity, role: str) -> dict[str, Any]:
    operations = list(
        db.scalars(
            select(Operation)
            .where(Operation.activity_id == item.id, Operation.removed_at.is_(None))
            .order_by(Operation.position)
        )
    )
    agent_ids = list(
        db.scalars(
            select(ActivityAssignment.agent_id)
            .where(
                ActivityAssignment.activity_id == item.id,
                ActivityAssignment.ended_at.is_(None),
            )
            .order_by(ActivityAssignment.agent_id)
        )
    )
    return {
        "id": item.id,
        "pta_id": item.pta_id,
        "reference": item.reference,
        "name": item.name,
        "description": item.description,
        "planned_start": item.planned_start.isoformat(),
        "planned_end": item.planned_end.isoformat(),
        "allocation": str(item.allocation),
        "state": item.state,
        "version": item.version,
        "operations": [
            {
                "id": row.id,
                "type_id": row.type_id,
                "name": row.name,
                "allocation": str(row.allocation),
                "position": row.position,
            }
            for row in operations
        ],
        "agent_ids": agent_ids,
        "allowed_actions": allowed(role, resource="activity"),
    }


class Cursor:
    def __init__(self, auth: AuthService, resource: str, parent: str, limit: int):
        self.auth, self.resource, self.parent, self.limit = (
            auth,
            resource,
            parent,
            limit,
        )

    def encode(self, value: str, direction: str) -> str:
        raw = json.dumps(
            {
                "v": 1,
                "r": self.resource,
                "p": self.parent,
                "l": self.limit,
                "i": value,
                "d": direction,
            },
            separators=(",", ":"),
            sort_keys=True,
        ).encode()
        sig = (
            hmac.new(
                bytes.fromhex(self.auth.policy.key),
                b"pta-cursor:" + raw,
                hashlib.sha256,
            )
            .hexdigest()
            .encode()
        )
        return base64.urlsafe_b64encode(raw + b"." + sig).decode().rstrip("=")

    def decode(self, token: str | None) -> tuple[str | None, str]:
        if not token:
            return None, "next"
        try:
            payload = base64.urlsafe_b64decode(token + "=" * (-len(token) % 4))
            raw, sig = payload.rsplit(b".", 1)
            expected = (
                hmac.new(
                    bytes.fromhex(self.auth.policy.key),
                    b"pta-cursor:" + raw,
                    hashlib.sha256,
                )
                .hexdigest()
                .encode()
            )
            data = json.loads(raw)
            if (
                not hmac.compare_digest(sig, expected)
                or not isinstance(data, dict)
                or set(data) != {"v", "r", "p", "l", "i", "d"}
                or data["v"] != 1
                or data["r"] != self.resource
                or data["p"] != self.parent
                or data["l"] != self.limit
                or data["d"] not in {"next", "previous"}
            ):
                raise ValueError
            if not isinstance(data["i"], str) or not 1 <= len(data["i"]) <= 80:
                raise ValueError
            return data["i"], data["d"]
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            raise AuthError(422, "cursor_invalid") from None


def list_rows(
    db: Session,
    auth: AuthService,
    model: Any,
    resource: str,
    parent: str,
    role: str,
    limit: int,
    token: str | None,
    where: tuple[Any, ...] = (),
) -> dict[str, Any]:
    if not 1 <= limit <= 100:
        raise AuthError(422, "input_invalid")
    cursor = Cursor(auth, resource, parent, limit)
    marker, direction = cursor.decode(token)
    conditions = list(where)
    if marker:
        try:
            marker = str(UUID(marker))
        except ValueError:
            raise AuthError(422, "cursor_invalid") from None
        conditions.append(
            model.id > marker if direction == "next" else model.id < marker
        )
    order = model.id.asc() if direction == "next" else model.id.desc()
    rows, total = page_rows(db, model, tuple(where), tuple(conditions), (order,), limit)
    more = len(rows) > limit
    rows = rows[:limit]
    if direction == "previous":
        rows.reverse()
    params: dict[str, int | str] = {"limit": limit}
    next_link = previous_link = None
    if rows and ((direction == "next" and more) or direction == "previous"):
        params["cursor"] = cursor.encode(rows[-1].id, "next")
        next_link = f"{auth.policy.origin}/api/v1/{resource}?{urlencode(params)}"
    if rows and (
        (direction == "previous" and more) or (direction == "next" and marker)
    ):
        params["cursor"] = cursor.encode(rows[0].id, "previous")
        previous_link = f"{auth.policy.origin}/api/v1/{resource}?{urlencode(params)}"
    serializer = (
        partner_item
        if model is Partner
        else type_item
        if model is OperationType
        else project_item
    )
    return {
        "object": "list",
        "count": total,
        "data": [serializer(row, role) for row in rows],
        "next": next_link,
        "previous": previous_link,
    }


def page_rows(
    db: Session,
    model: Any,
    base_conditions: tuple[Any, ...],
    page_conditions: tuple[Any, ...],
    ordering: tuple[Any, ...],
    limit: int,
) -> tuple[list[Any], int]:
    """Read authorized count and keyset rows from one PostgreSQL snapshot."""
    page = (
        select(model.id.label("page_id"))
        .where(*page_conditions)
        .order_by(*ordering)
        .limit(limit + 1)
        .cte("authorized_page")
    )
    anchor = select(
        select(func.count())
        .select_from(model)
        .where(*base_conditions)
        .scalar_subquery()
        .label("authorized_count")
    ).subquery("authorized_total")
    statement = (
        select(model, anchor.c.authorized_count)
        .select_from(
            anchor.outerjoin(page, true()).outerjoin(model, model.id == page.c.page_id)
        )
        .order_by(*ordering)
    )
    result = list(db.execute(statement))
    total = int(result[0][1])
    return [row[0] for row in result if row[0] is not None], total


def fingerprint(payload: dict[str, Any]) -> str:
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def validate_plan(
    payload: dict[str, Any], year: int
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        start = date.fromisoformat(payload["planned_start"])
        end = date.fromisoformat(payload["planned_end"])
    except (ValueError, KeyError, TypeError):
        raise AuthError(422, "input_invalid") from None
    if start.year != year or end < start:
        raise AuthError(422, "input_invalid")
    operations = payload.get("operations")
    if not isinstance(operations, list) or not 1 <= len(operations) <= 100:
        raise AuthError(422, "input_invalid")
    normalized = []
    total = 0
    operation_ids: set[str] = set()
    for position, row in enumerate(operations, 1):
        try:
            operation_id = str(UUID(row["id"])) if row.get("id") else None
            if operation_id and operation_id in operation_ids:
                raise AuthError(422, "input_invalid")
            if operation_id:
                operation_ids.add(operation_id)
            type_id = str(UUID(row["type_id"]))
            name = clean(row["name"], 200)
            amount = xof(row.get("allocation", ""))
            total += amount
            if total > 9_223_372_036_854_775_807:
                raise AuthError(422, "input_invalid")
            normalized.append(
                {
                    "id": operation_id,
                    "type_id": type_id,
                    "name": name,
                    "allocation": amount,
                    "position": position,
                }
            )
        except (KeyError, TypeError, ValueError):
            raise AuthError(422, "input_invalid") from None
    allocation = xof(payload.get("allocation", ""))
    if allocation != total:
        raise AuthError(422, "allocation_mismatch")
    try:
        return {
            "name": clean(payload["name"], 200),
            "description": clean(payload["description"], 4000),
            "planned_start": start,
            "planned_end": end,
            "allocation": allocation,
        }, normalized
    except (KeyError, TypeError):
        raise AuthError(422, "input_invalid") from None


def assert_types(db: Session, operations: list[dict[str, Any]]) -> None:
    ids = {row["type_id"] for row in operations}
    found = set(
        db.scalars(
            select(OperationType.id).where(
                OperationType.id.in_(ids),
                OperationType.context_id == CONTEXT,
                OperationType.active.is_(True),
            )
        )
    )
    if found != ids:
        raise AuthError(409, "operation_type_ineligible")
