from datetime import date
from typing import Annotated, Any, Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import APIKeyCookie
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.auth.dto import ErrorResponse
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError
from app.planning.models import ReversementDeclaration, VirementConfirmation
from app.planning.routes import MUTATION_HEADERS, get_activity, get_activity_for_command
from app.planning.service import CONTEXT, Cursor, locked_mutation, principal
from app.planning.virement import exact_request, verified_source

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA external virement confirmation"],
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


class DeclarationInput(Input):
    expected_version: int = Field(gt=0, strict=True)
    transfer_date: date
    note: str | None = Field(default=None, max_length=4000)

    @field_validator("note", mode="before")
    @classmethod
    def normalized_note(cls, value: object) -> object:
        return (value.strip() or None) if isinstance(value, str) else value


class CorrectionInput(DeclarationInput):
    reason: str = Field(min_length=1, max_length=4000)

    @field_validator("reason", mode="before")
    @classmethod
    def normalized_reason(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ConfirmationOutput(Input):
    id: str
    activity_id: str
    request_id: str
    revision: int
    amount: str
    transfer_date: str
    note: str | None
    actor_id: str
    recorded_at: str
    correction_reason: str | None


class MutationOutput(ConfirmationOutput):
    activity_version: int


class ListOutput(Input):
    object: Literal["list"]
    count: int
    data: list[ConfirmationOutput]
    next: str | None
    previous: str | None


def output(row: VirementConfirmation) -> dict[str, Any]:
    return {
        "id": row.id,
        "activity_id": row.activity_id,
        "request_id": row.request_id,
        "revision": row.revision,
        "amount": str(row.amount),
        "transfer_date": row.transfer_date.isoformat(),
        "note": row.note,
        "actor_id": row.actor_id,
        "recorded_at": row.recorded_at.isoformat(),
        "correction_reason": row.correction_reason,
    }


def current(
    db: Session, request_id: str, *, lock: bool = False
) -> VirementConfirmation | None:
    statement = (
        select(VirementConfirmation)
        .where(VirementConfirmation.request_id == request_id)
        .order_by(VirementConfirmation.revision.desc())
        .limit(1)
    )
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def create_confirmation(
    identifier: str,
    request_id: str,
    body: DeclarationInput,
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
        previous = current(db, financial.id, lock=True)
        if previous and db.scalar(
            select(ReversementDeclaration.id).where(
                ReversementDeclaration.request_id == financial.id
            )
        ):
            raise AuthError(409, "confirmation_frozen")
        if correction != (previous is not None):
            raise AuthError(
                409,
                "confirmation_required" if correction else "confirmation_exists",
            )
        today = db.scalar(
            select(text("(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date"))
        )
        if today is None or body.transfer_date > today:
            raise AuthError(422, "transfer_date_invalid")
        if previous and (
            previous.transfer_date == body.transfer_date and previous.note == body.note
        ):
            raise AuthError(409, "confirmation_unchanged")
        now = auth.now(db)
        created = VirementConfirmation(
            activity_id=item.id,
            request_id=financial.id,
            revision=(previous.revision + 1) if previous else 1,
            amount=source.amount,
            transfer_date=body.transfer_date,
            note=body.note,
            actor_id=actor.id,
            recorded_at=now,
            correction_reason=(
                body.reason if isinstance(body, CorrectionInput) else None
            ),
        )
        db.add(created)
        item.version += 1
        item.updated_at = now
        db.flush()
        auth.business_audit(
            db,
            "virement_confirmation.corrected"
            if correction
            else "virement_confirmation.declared",
            actor.id,
            created.id,
            {
                "context_id": CONTEXT,
                "activity_id": item.id,
                "request_id": financial.id,
                "confirmation_id": created.id,
                "revision": created.revision,
                "amount": str(created.amount),
                "before": output(previous) if previous else None,
                "after": output(created),
                "reason": created.correction_reason,
            },
        )
        result = output(created)
        result["activity_version"] = item.version
        return result


@router.post(
    "/activities/{identifier}/virement-requests/{request_id}/confirmation",
    status_code=201,
    response_model=MutationOutput,
    openapi_extra=MUTATION_HEADERS,
)
def declare(
    identifier: str,
    request_id: str,
    body: DeclarationInput,
    request: Request,
    auth: Auth,
) -> dict[str, Any]:
    return create_confirmation(
        identifier, request_id, body, request, auth, correction=False
    )


@router.post(
    "/activities/{identifier}/virement-requests/{request_id}/confirmation/corrections",
    status_code=201,
    response_model=MutationOutput,
    openapi_extra=MUTATION_HEADERS,
)
def correct(
    identifier: str,
    request_id: str,
    body: CorrectionInput,
    request: Request,
    auth: Auth,
) -> dict[str, Any]:
    return create_confirmation(
        identifier, request_id, body, request, auth, correction=True
    )


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


@router.get(
    "/activities/{identifier}/virement-requests/{request_id}/confirmation/history",
    response_model=ListOutput,
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
        cursor = Cursor(auth, "virement-confirmations", financial.id, limit)
        marker, direction = cursor.decode(token)
        conditions = [VirementConfirmation.request_id == financial.id]
        if marker:
            try:
                marker_revision = int(marker)
            except (TypeError, ValueError):
                raise AuthError(422, "cursor_invalid") from None
            conditions.append(
                VirementConfirmation.revision < marker_revision
                if direction == "next"
                else VirementConfirmation.revision > marker_revision
            )
        order = (
            VirementConfirmation.revision.desc()
            if direction == "next"
            else VirementConfirmation.revision.asc()
        )
        rows = list(
            db.scalars(
                select(VirementConfirmation)
                .where(*conditions)
                .order_by(order)
                .limit(limit + 1)
            )
        )
        total = (
            db.scalar(
                select(func.count())
                .select_from(VirementConfirmation)
                .where(VirementConfirmation.request_id == financial.id)
            )
            or 0
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: VirementConfirmation, move: str) -> str:
            query = urlencode(
                {"limit": limit, "cursor": cursor.encode(str(row.revision), move)}
            )
            base = (
                f"{auth.policy.origin}/api/v1/activities/{item.id}/"
                f"virement-requests/{financial.id}/confirmation/history"
            )
            return f"{base}?{query}"

        return {
            "object": "list",
            "count": total,
            "data": [output(row) for row in rows],
            "next": link(rows[-1], "next")
            if rows and ((direction == "next" and more) or direction == "previous")
            else None,
            "previous": link(rows[0], "previous")
            if rows
            and ((direction == "previous" and more) or (direction == "next" and marker))
            else None,
        }
