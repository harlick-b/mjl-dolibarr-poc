import base64
import hashlib
import hmac
import json
from datetime import date, datetime
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
    ActivityContributor,
    ActivityRevision,
    ActivityRevisionDecision,
    AnnualPTA,
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


def allowed(
    role: str,
    *,
    resource: str,
    state: str = "active",
    contributor: bool = False,
    prevalidator: bool = False,
    amendment: bool = False,
) -> list[str]:
    actions = ["read"]
    if role == "VALIDATEUR_DEFINITIF" and resource in {"partner", "type", "project"}:
        actions.append("create")
    if role == "VALIDATEUR_DEFINITIF" and resource == "project" and state == "active":
        actions.append("close")
    if role == "AGENT_SAISIE" and resource == "pta" and state == "active":
        actions.append("create_activity")
    if (
        role == "AGENT_SAISIE"
        and resource == "activity"
        and state
        in {
            "draft",
            "amendment_draft",
            "returned_supervisor",
            "returned_validator",
        }
    ):
        actions.extend(["edit", "submit"])
    if role == "AGENT_SAISIE" and resource == "activity" and state == "approved":
        actions.append("open_amendment")
    if role == "AGENT_SAISIE" and resource == "activity" and amendment:
        actions.append("cancel_amendment")
    if (
        role in {"AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"}
        and resource == "activity"
    ):
        actions.append("assign_agents")
    if (
        role == "AGENT_VERIFICATEUR"
        and resource == "activity"
        and state == "submitted"
        and not contributor
    ):
        actions.extend(["prevalidate", "return"])
    if (
        role == "VALIDATEUR_DEFINITIF"
        and resource == "activity"
        and state == "prevalidated"
        and not contributor
        and not prevalidator
    ):
        actions.extend(["approve", "return"])
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


def activity_item(
    db: Session, item: Activity, role: str, actor_id: str | None = None
) -> dict[str, Any]:
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
    contributor = bool(
        actor_id
        and db.scalar(
            select(ActivityContributor.id)
            .where(
                ActivityContributor.activity_id == item.id,
                ActivityContributor.user_id == actor_id,
            )
            .limit(1)
        )
    )
    prevalidator = bool(
        actor_id
        and item.current_revision_id
        and db.scalar(
            select(ActivityRevisionDecision.id)
            .where(
                ActivityRevisionDecision.revision_id == item.current_revision_id,
                ActivityRevisionDecision.stage == "supervisor",
                ActivityRevisionDecision.outcome == "prevalidated",
                ActivityRevisionDecision.actor_id == actor_id,
            )
            .limit(1)
        )
    )
    approved_projection = None
    if item.approved_revision_id:
        approved = db.get(ActivityRevision, item.approved_revision_id)
        if approved:
            approved_projection = snapshot_projection(approved.snapshot)
    correction = None
    if item.current_revision_id and item.state in {
        "returned_supervisor",
        "returned_validator",
    }:
        returned = db.scalar(
            select(ActivityRevisionDecision)
            .where(
                ActivityRevisionDecision.revision_id == item.current_revision_id,
                ActivityRevisionDecision.outcome == "returned",
            )
            .order_by(ActivityRevisionDecision.decided_at.desc())
        )
        if returned:
            correction = {
                "actor_id": returned.actor_id,
                "actor_role": returned.actor_role,
                "reason": returned.reason,
                "requested_amount": str(returned.requested_amount)
                if returned.requested_amount is not None
                else None,
            }
    candidate_projection = structural_content(db, item) if item.amendment_id else None
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
        "current_revision_id": item.current_revision_id,
        "approved_revision_id": item.approved_revision_id,
        "approved_allocation": (
            approved_projection["allocation"] if approved_projection else None
        ),
        "approved": approved_projection,
        "candidate": candidate_projection,
        "amendment": (
            {"id": item.amendment_id, "reason": item.amendment_reason}
            if item.amendment_id
            else None
        ),
        "execution_paused": item.amendment_id is not None,
        "correction": correction,
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
        "allowed_actions": allowed(
            role,
            resource="activity",
            state=item.state,
            contributor=contributor,
            prevalidator=prevalidator,
            amendment=item.amendment_id is not None,
        ),
    }


def snapshot_projection(snapshot: dict[str, object]) -> dict[str, Any]:
    operations = snapshot.get("operations")
    assert isinstance(operations, list)
    return {
        "name": snapshot["name"],
        "description": snapshot["description"],
        "planned_start": snapshot["planned_start"],
        "planned_end": snapshot["planned_end"],
        "allocation": snapshot["allocation"],
        "operations": [
            {
                key: row[key]
                for key in ("id", "type_id", "name", "allocation", "position")
            }
            for row in operations
            if isinstance(row, dict)
        ],
    }


def structural_content(db: Session, item: Activity) -> dict[str, Any]:
    operations = list(
        db.scalars(
            select(Operation)
            .where(Operation.activity_id == item.id, Operation.removed_at.is_(None))
            .order_by(Operation.position)
        )
    )
    return {
        "name": item.name,
        "description": item.description,
        "planned_start": item.planned_start.isoformat(),
        "planned_end": item.planned_end.isoformat(),
        "allocation": str(item.allocation),
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
    }


def revision_item(
    db: Session, revision: ActivityRevision, *, include_snapshot: bool = True
) -> dict[str, Any]:
    decisions = list(
        db.scalars(
            select(ActivityRevisionDecision)
            .where(ActivityRevisionDecision.revision_id == revision.id)
            .order_by(ActivityRevisionDecision.decided_at, ActivityRevisionDecision.id)
        )
    )
    result: dict[str, Any] = {
        "id": revision.id,
        "activity_id": revision.activity_id,
        "revision_number": revision.revision_number,
        "fingerprint": revision.fingerprint,
        "submitter_id": revision.submitter_id,
        "submitted_at": revision.submitted_at.isoformat(),
        "decisions": [
            {
                "id": row.id,
                "stage": row.stage,
                "outcome": row.outcome,
                "actor_id": row.actor_id,
                "actor_role": row.actor_role,
                "decided_at": row.decided_at.isoformat(),
                "reason": row.reason,
                "requested_amount": str(row.requested_amount)
                if row.requested_amount is not None
                else None,
                "prevalidation_revision_id": row.prevalidation_revision_id,
            }
            for row in decisions
        ],
    }
    if include_snapshot:
        result["snapshot"] = revision.snapshot
    return result


def build_revision_snapshot(
    db: Session, item: Activity, actor: User, submitted_at: datetime
) -> dict[str, Any]:
    pta = db.get(AnnualPTA, item.pta_id)
    assert pta
    project = db.get(Project, pta.project_id)
    assert project
    partner = db.get(Partner, project.partner_id)
    assert partner
    content = structural_content(db, item)
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
    assignment_users = {
        user.id: user for user in db.scalars(select(User).where(User.id.in_(agent_ids)))
    }
    type_ids = {row["type_id"] for row in content["operations"]}
    type_labels = {
        row.id: row.label
        for row in db.scalars(
            select(OperationType).where(OperationType.id.in_(type_ids))
        )
    }
    snapshot_operations = [
        {**row, "type_label": type_labels[row["type_id"]]}
        for row in content["operations"]
    ]
    contributor_ids = list(
        db.scalars(
            select(ActivityContributor.user_id)
            .where(ActivityContributor.activity_id == item.id)
            .order_by(ActivityContributor.user_id)
        )
    )
    users = {
        user.id: user
        for user in db.scalars(
            select(User).where(User.id.in_(set(contributor_ids + [actor.id])))
        )
    }
    result: dict[str, Any] = {
        "context_id": CONTEXT,
        "partner": {"id": partner.id, "name": partner.name},
        "project": {
            "id": project.id,
            "reference": project.reference,
            "name": project.name,
        },
        "pta": {"id": pta.id, "year": pta.year},
        "activity": {"id": item.id, "reference": item.reference},
        **content,
        "operations": snapshot_operations,
        "agent_ids": agent_ids,
        "agents": [
            {
                "id": identifier,
                "email": assignment_users[identifier].email,
                "role": assignment_users[identifier].role,
            }
            for identifier in agent_ids
        ],
        "submitter": {"id": actor.id, "email": actor.email, "role": actor.role},
        "submitted_at": submitted_at.isoformat(),
        "contributors": [
            {
                "id": identifier,
                "email": users[identifier].email,
                "role": users[identifier].role,
            }
            for identifier in contributor_ids
        ],
    }
    if item.amendment_id:
        result.update(
            {
                "amendment_id": item.amendment_id,
                "amendment_reason": item.amendment_reason,
                "base_approved_revision_id": item.approved_revision_id,
            }
        )
    return result


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
