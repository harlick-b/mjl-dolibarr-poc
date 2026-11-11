from datetime import date
from typing import Annotated, Any, Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.models import User
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.core.models import ReversementDeclaration
from app.planning.core.service import CONTEXT, Cursor, locked_mutation, principal
from app.planning.finance.virement import exact_request, verified_source
from app.planning.finance.virement_confirmation import current as current_confirmation
from app.planning.routes import (
    MUTATION_HEADERS,
    created,
    get_activity,
    get_activity_for_command,
)

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA reversement declaration"],
    dependencies=[
        Depends(APIKeyCookie(name="mjl_local", auto_error=False)),
        Depends(APIKeyCookie(name="__Host-mjl", auto_error=False)),
    ],
    responses={
        status: {"model": ErrorResponse}
        for status in (401, 403, 404, 409, 422, 429, 503)
    },
)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ReversementDeclarationInput(Input):
    expected_version: int = Field(gt=0, strict=True)
    return_date: date
    note: str | None = Field(default=None, max_length=4000)

    @field_validator("note", mode="before")
    @classmethod
    def normalized_note(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class ReversementCorrectionInput(ReversementDeclarationInput):
    reason: str = Field(min_length=1, max_length=4000)

    @field_validator("reason", mode="before")
    @classmethod
    def normalized_reason(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ReversementDeclarationOutput(Input):
    id: str
    activity_id: str
    request_id: str
    confirmation_id: str
    revision: int
    returned_amount: str
    return_date: str
    note: str | None
    actor_id: str
    recorded_at: str
    correction_reason: str | None


class ReversementMutationOutput(ReversementDeclarationOutput):
    activity_version: int


class ReversementHistoryOutput(ReversementDeclarationOutput):
    actor_name: str


class ReversementListOutput(Input):
    object: Literal["list"]
    count: int
    data: list[ReversementHistoryOutput]
    next: str | None
    previous: str | None


def output(row: ReversementDeclaration) -> dict[str, Any]:
    return {
        "id": row.id,
        "activity_id": row.activity_id,
        "request_id": row.request_id,
        "confirmation_id": row.confirmation_id,
        "revision": row.revision,
        "returned_amount": str(row.amount),
        "return_date": row.return_date.isoformat(),
        "note": row.note,
        "actor_id": row.actor_id,
        "recorded_at": row.recorded_at.isoformat(),
        "correction_reason": row.correction_reason,
    }


def current(
    db: Session, request_id: str, *, lock: bool = False
) -> ReversementDeclaration | None:
    statement = (
        select(ReversementDeclaration)
        .where(ReversementDeclaration.request_id == request_id)
        .order_by(ReversementDeclaration.revision.desc())
        .limit(1)
    )
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def required_amount(snapshot: dict[str, object], spent: int) -> int:
    allocation = snapshot.get("allocation")
    if (
        not isinstance(allocation, str)
        or not allocation.isascii()
        or not allocation.isdecimal()
    ):
        raise AuthError(409, "financial_basis_stale")
    required = int(allocation) - spent
    if required < 0:
        raise AuthError(409, "financial_insufficiency_unresolved")
    return required


def create_declaration(
    identifier: str,
    request_id: str,
    body: ReversementDeclarationInput,
    request: Request,
    auth: Auth,
    *,
    correction: bool,
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db, auth, *evidence(request, auth), roles={"AGENT_SAISIE"}, mutation=True
        )
        item = get_activity_for_command(db, identifier, actor)
        if item.version != body.expected_version:
            raise AuthError(409, "activity_stale")
        financial = exact_request(db, item.id, request_id, lock=True)
        source = verified_source(db, item, financial.disbursement_request_id, lock=True)
        if financial.state != "approved":
            raise AuthError(409, "virement_not_approved")
        confirmation = current_confirmation(db, financial.id, lock=True)
        if not confirmation:
            raise AuthError(409, "virement_confirmation_required")
        amount = required_amount(source.snapshot, source.amount)
        if amount == 0:
            raise AuthError(409, "reversement_not_required")
        previous = current(db, financial.id, lock=True)
        if correction != (previous is not None):
            raise AuthError(
                409,
                "reversement_required" if correction else "reversement_exists",
            )
        today = db.scalar(
            select(text("(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date"))
        )
        if (
            today is None
            or body.return_date > today
            or body.return_date < confirmation.transfer_date
        ):
            raise AuthError(422, "return_date_invalid")
        if previous and (
            previous.return_date == body.return_date and previous.note == body.note
        ):
            raise AuthError(409, "reversement_unchanged")
        now = auth.now(db)
        created = ReversementDeclaration(
            activity_id=item.id,
            request_id=financial.id,
            confirmation_id=confirmation.id,
            revision=(previous.revision + 1) if previous else 1,
            amount=amount,
            return_date=body.return_date,
            note=body.note,
            actor_id=actor.id,
            recorded_at=now,
            correction_reason=(
                body.reason if isinstance(body, ReversementCorrectionInput) else None
            ),
        )
        db.add(created)
        item.version += 1
        item.updated_at = now
        db.flush()
        auth.business_audit(
            db,
            "reversement.corrected" if correction else "reversement.declared",
            actor.id,
            created.id,
            {
                "context_id": CONTEXT,
                "activity_id": item.id,
                "request_id": financial.id,
                "confirmation_id": confirmation.id,
                "declaration_id": created.id,
                "revision": created.revision,
                "required_amount": str(amount),
                "returned_amount": str(created.amount),
                "before": output(previous) if previous else None,
                "after": output(created),
                "reason": created.correction_reason,
            },
        )
        result = output(created)
        result["activity_version"] = item.version
        return result


@router.post(
    "/activities/{identifier}/virement-requests/{request_id}/reversement",
    status_code=201,
    response_model=ReversementMutationOutput,
    openapi_extra=MUTATION_HEADERS,
)
def declare(
    identifier: str,
    request_id: str,
    body: ReversementDeclarationInput,
    request: Request,
    auth: Auth,
) -> Response:
    result = create_declaration(
        identifier, request_id, body, request, auth, correction=False
    )
    return created(
        request,
        f"/api/v1/activities/{result['activity_id']}/virement-requests/"
        f"{result['request_id']}/reversement",
        result,
    )


@router.post(
    "/activities/{identifier}/virement-requests/{request_id}/reversement/corrections",
    status_code=201,
    response_model=ReversementMutationOutput,
    openapi_extra=MUTATION_HEADERS,
)
def correct(
    identifier: str,
    request_id: str,
    body: ReversementCorrectionInput,
    request: Request,
    auth: Auth,
) -> Response:
    result = create_declaration(
        identifier, request_id, body, request, auth, correction=True
    )
    return created(
        request,
        f"/api/v1/activities/{result['activity_id']}/virement-requests/"
        f"{result['request_id']}/reversement",
        result,
    )


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


@router.get(
    "/activities/{identifier}/virement-requests/{request_id}/reversement/history",
    response_model=ReversementListOutput,
)
def history(
    identifier: str,
    request_id: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        actor = principal(db, auth, evidence(request, auth)[0])
        item = get_activity(db, identifier, actor=actor, shared=True)
        financial = exact_request(db, item.id, request_id)
        limit, token = args
        cursor = Cursor(auth, "reversement-declarations", financial.id, limit)
        marker, direction = cursor.decode(token)
        conditions = [ReversementDeclaration.request_id == financial.id]
        if marker:
            try:
                marker_revision = int(marker)
            except (TypeError, ValueError):
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                ReversementDeclaration.revision < marker_revision
                if direction == "next"
                else ReversementDeclaration.revision > marker_revision
            )
        order = (
            ReversementDeclaration.revision.desc()
            if direction == "next"
            else ReversementDeclaration.revision.asc()
        )
        rows = list(
            db.scalars(
                select(ReversementDeclaration)
                .where(*conditions)
                .order_by(order)
                .limit(limit + 1)
            )
        )
        total = (
            db.scalar(
                select(func.count())
                .select_from(ReversementDeclaration)
                .where(ReversementDeclaration.request_id == financial.id)
            )
            or 0
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()
        actors = {
            user.id: user.full_name or user.email
            for user in db.scalars(
                select(User).where(User.id.in_({row.actor_id for row in rows}))
            )
        }

        def link(row: ReversementDeclaration, move: str) -> str:
            query = urlencode(
                {"limit": limit, "cursor": cursor.encode(str(row.revision), move)}
            )
            base = (
                f"{auth.policy.origin}/api/v1/activities/{item.id}/"
                f"virement-requests/{financial.id}/reversement/history"
            )
            return f"{base}?{query}"

        return {
            "object": "list",
            "count": total,
            "data": [
                {
                    **output(row),
                    "actor_name": actors.get(row.actor_id, "Utilisateur indisponible"),
                }
                for row in rows
            ],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }
