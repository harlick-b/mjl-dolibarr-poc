"""Synthetic-only optional Activity attachments."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime
from io import BytesIO
from typing import Annotated, Any, Literal
from urllib.parse import quote, urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response
from fastapi.security import APIKeyCookie
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from sqlalchemy import func, select, tuple_
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.auth.dto import ErrorResponse
from app.auth.routes import Auth, evidence
from app.auth.service import AuthError, AuthService
from app.planning.models import Activity, ActivityDocument
from app.planning.routes import locked_read
from app.planning.service import CONTEXT, Cursor, locked_mutation, principal

router = APIRouter(
    prefix="/api/v1",
    tags=["PTA documents"],
    dependencies=[
        Depends(APIKeyCookie(name="mjl_local", auto_error=False)),
        Depends(APIKeyCookie(name="__Host-mjl", auto_error=False)),
    ],
    responses={
        status: {"model": ErrorResponse}
        for status in (401, 403, 404, 409, 422, 429, 503)
    },
)

MAX_BYTES = 20 * 1024 * 1024


class Output(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    activity_id: str
    name: str
    media_type: str
    size: int
    uploaded_by_id: str
    uploaded_at: str


class ListOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    object: Literal["list"]
    count: int
    data: list[Output]
    next: str | None
    previous: str | None


def output(item: ActivityDocument) -> dict[str, Any]:
    return {
        "id": item.id,
        "activity_id": item.activity_id,
        "name": item.display_name,
        "media_type": item.media_type,
        "size": item.byte_size,
        "uploaded_by_id": item.uploaded_by_id,
        "uploaded_at": item.uploaded_at.isoformat(),
    }


def activity(db: Session, identifier: str) -> Activity:
    item = db.get(Activity, identifier)
    if not item or item.context_id != CONTEXT:
        raise AuthError(404, "activity_not_found")
    return item


def filename(value: str) -> str:
    name = value.strip()
    if (
        not name
        or len(name) > 200
        or "/" in name
        or "\\" in name
        or name in {".", ".."}
        or any(ord(character) < 32 or ord(character) == 127 for character in name)
    ):
        raise AuthError(422, "document_invalid")
    return name


def validate(content: bytes, name: str, media_type: str) -> None:
    expected = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }
    suffix = "." + name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if not content or len(content) > MAX_BYTES or expected.get(suffix) != media_type:
        raise AuthError(422, "document_invalid")
    if b"EICAR-STANDARD-ANTIVIRUS-TEST-FILE" in content:
        raise AuthError(422, "document_rejected")
    try:
        if media_type == "application/pdf":
            if not content.startswith(b"%PDF-") or any(
                marker in content
                for marker in (
                    b"/JavaScript",
                    b"/JS",
                    b"/EmbeddedFile",
                    b"/Launch",
                    b"/OpenAction",
                )
            ):
                raise ValueError
            reader = PdfReader(BytesIO(content), strict=True)
            if reader.is_encrypted or not reader.pages:
                raise ValueError
        else:
            with Image.open(BytesIO(content)) as image:
                required = "PNG" if media_type == "image/png" else "JPEG"
                if image.format != required or image.width * image.height > 40_000_000:
                    raise ValueError
                image.verify()
    except (
        Image.DecompressionBombError,
        PdfReadError,
        ValueError,
        OSError,
        UnidentifiedImageError,
    ):
        raise AuthError(422, "document_invalid") from None


async def bounded_content(request: Request) -> bytes:
    declared = request.headers.get("content-length")
    try:
        if declared is not None:
            size = int(declared)
            if size < 0 or size > MAX_BYTES:
                raise AuthError(422, "document_invalid")
    except ValueError:
        raise AuthError(422, "document_invalid") from None
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > MAX_BYTES:
            raise AuthError(422, "document_invalid")
        content.extend(chunk)
    return bytes(content)


def authorize_upload(
    auth: AuthService,
    secret: str | None,
    csrf: str | None,
    activity_id: str,
) -> None:
    with Session(auth.engine) as db, db.begin():
        principal(
            db,
            auth,
            secret,
            csrf,
            roles={"AGENT_SAISIE", "VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        activity(db, activity_id)


def store_upload(
    auth: AuthService,
    secret: str | None,
    csrf: str | None,
    activity_id: str,
    name: str,
    media_type: str,
    body: bytes,
) -> tuple[dict[str, Any], str]:
    with Session(auth.engine) as db, db.begin():
        locked_mutation(db)
        actor = principal(
            db,
            auth,
            secret,
            csrf,
            roles={"AGENT_SAISIE", "VALIDATEUR_DEFINITIF"},
            mutation=True,
        )
        activity(db, activity_id)
        item = ActivityDocument(
            context_id=CONTEXT,
            activity_id=activity_id,
            display_name=name,
            media_type=media_type,
            byte_size=len(body),
            sha256=hashlib.sha256(body).hexdigest(),
            content=body,
            uploaded_by_id=actor.id,
            uploaded_at=auth.now(db),
        )
        db.add(item)
        db.flush()
        auth.audit(
            db,
            "document.upload",
            actor.id,
            item.id,
            details={
                "activity_id": activity_id,
                "media_type": media_type,
                "byte_size": len(body),
                "sha256": item.sha256,
            },
        )
        location = (
            f"{auth.policy.origin}/api/v1/activities/{activity_id}/documents/"
            f"{item.id}/download"
        )
        return output(item), location


def list_args(
    limit: Annotated[int, Query(ge=1, le=100)] = 60, cursor: str | None = None
) -> tuple[int, str | None]:
    return limit, cursor


@router.get("/activities/{activity_id}/documents", response_model=ListOutput)
def listing(
    activity_id: str,
    request: Request,
    auth: Auth,
    args: Annotated[tuple[int, str | None], Depends(list_args)],
) -> dict[str, Any]:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor = principal(db, auth, evidence(request, auth)[0])
        activity(db, activity_id)
        limit, token = args
        cursor = Cursor(auth, "activity_documents", f"{actor.id}:{activity_id}", limit)
        marker, direction = cursor.decode(token)
        conditions = [ActivityDocument.activity_id == activity_id]
        if marker:
            try:
                raw_time, raw_id = marker.split("|", 1)
                marked = tuple_(datetime.fromisoformat(raw_time), str(UUID(raw_id)))
            except (ValueError, TypeError):
                raise AuthError(422, "cursor_invalid") from None
            pair = tuple_(ActivityDocument.uploaded_at, ActivityDocument.id)
            conditions.append(pair < marked if direction == "next" else pair > marked)
        order = (
            (ActivityDocument.uploaded_at.desc(), ActivityDocument.id.desc())
            if direction == "next"
            else (ActivityDocument.uploaded_at.asc(), ActivityDocument.id.asc())
        )
        rows = list(
            db.scalars(
                select(ActivityDocument)
                .where(*conditions)
                .order_by(*order)
                .limit(limit + 1)
            )
        )
        total = (
            db.scalar(
                select(func.count())
                .select_from(ActivityDocument)
                .where(ActivityDocument.activity_id == activity_id)
            )
            or 0
        )
        more = len(rows) > limit
        rows = rows[:limit]
        if direction == "previous":
            rows.reverse()

        def link(row: ActivityDocument, move: str) -> str:
            marker_value = f"{row.uploaded_at.isoformat()}|{row.id}"
            query = urlencode(
                {"limit": limit, "cursor": cursor.encode(marker_value, move)}
            )
            path = f"/api/v1/activities/{activity_id}/documents"
            return f"{auth.policy.origin}{path}?{query}"

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


@router.post(
    "/activities/{activity_id}/documents",
    response_model=Output,
    status_code=201,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                media_type: {"schema": {"type": "string", "format": "binary"}}
                for media_type in ("application/pdf", "image/jpeg", "image/png")
            },
        }
    },
)
async def upload(
    activity_id: str,
    request: Request,
    response: Response,
    auth: Auth,
    x_file_name: Annotated[str, Header(alias="X-File-Name")],
) -> dict[str, Any]:
    media_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    secret, csrf = evidence(request, auth)
    await run_in_threadpool(authorize_upload, auth, secret, csrf, activity_id)
    name = filename(x_file_name)
    body = await bounded_content(request)
    await run_in_threadpool(validate, body, name, media_type)
    result, location = await run_in_threadpool(
        store_upload, auth, secret, csrf, activity_id, name, media_type, body
    )
    response.headers["Location"] = location
    return result


@router.get(
    "/activities/{activity_id}/documents/{document_id}/download",
    response_class=Response,
    responses={200: {"content": {"application/octet-stream": {}}}},
)
def download(
    activity_id: str, document_id: str, request: Request, auth: Auth
) -> Response:
    with Session(auth.engine) as db, db.begin():
        locked_read(db)
        actor = principal(db, auth, evidence(request, auth)[0])
        activity(db, activity_id)
        item = db.get(ActivityDocument, document_id)
        if not item or item.activity_id != activity_id or item.context_id != CONTEXT:
            raise AuthError(404, "document_not_found")
        auth.audit(
            db,
            "document.download",
            actor.id,
            item.id,
            details={"activity_id": activity_id},
        )
        content, media_type, name = item.content, item.media_type, item.display_name
    fallback = re.sub(r"[^A-Za-z0-9._-]", "_", name) or "document"
    disposition = f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(name)}"
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": disposition,
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
