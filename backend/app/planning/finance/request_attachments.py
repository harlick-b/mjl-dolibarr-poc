from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import quote

from fastapi import Request, Response
from starlette.concurrency import run_in_threadpool

from app.auth.service import AuthError
from app.planning.operations.documents import MAX_BYTES, filename, validate

REQUEST_METADATA_LIMIT = 20_000

REQUEST_ATTACHMENT_OPENAPI = {
    "requestBody": {
        "required": True,
        "content": {
            media_type: {
                "schema": {"type": "string", "format": "binary"},
                "description": (
                    "UTF-8 JSON metadata followed by the file bytes. "
                    "X-Request-Metadata-Length gives the metadata byte length."
                ),
            }
            for media_type in ("application/pdf", "image/jpeg", "image/png")
        },
    }
}


@dataclass(frozen=True)
class RequestAttachment:
    name: str
    media_type: str
    content: bytes
    sha256: str


@dataclass(frozen=True)
class RequestUpload:
    attachment: RequestAttachment
    observation: str | None


class HasAttachment(Protocol):
    attachment_name: str | None
    attachment_media_type: str | None
    attachment_size: int | None
    attachment_content: bytes | None


async def read_request_attachment(
    request: Request, metadata_length: int
) -> RequestUpload:
    if metadata_length < 2 or metadata_length > REQUEST_METADATA_LIMIT:
        raise AuthError(422, "document_invalid")
    declared = request.headers.get("content-length")
    try:
        if declared is not None and (
            int(declared) <= metadata_length
            or int(declared) > metadata_length + MAX_BYTES
        ):
            raise AuthError(422, "document_invalid")
    except ValueError:
        raise AuthError(422, "document_invalid") from None
    raw = bytearray()
    async for chunk in request.stream():
        if len(raw) + len(chunk) > metadata_length + MAX_BYTES:
            raise AuthError(422, "document_invalid")
        raw.extend(chunk)
    if len(raw) <= metadata_length:
        raise AuthError(422, "document_invalid")
    try:
        metadata = json.loads(bytes(raw[:metadata_length]).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise AuthError(422, "document_invalid") from None
    if not isinstance(metadata, dict) or set(metadata) != {"name", "observation"}:
        raise AuthError(422, "document_invalid")
    supplied_name = metadata["name"]
    observation = metadata["observation"]
    if not isinstance(supplied_name, str) or (
        observation is not None and not isinstance(observation, str)
    ):
        raise AuthError(422, "document_invalid")
    name = filename(supplied_name)
    media_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    content = bytes(raw[metadata_length:])
    await run_in_threadpool(validate, content, name, media_type)
    return RequestUpload(
        attachment=RequestAttachment(
            name=name,
            media_type=media_type,
            content=content,
            sha256=hashlib.sha256(content).hexdigest(),
        ),
        observation=observation,
    )


def attachment_values(attachment: RequestAttachment | None) -> dict[str, object]:
    if attachment is None:
        return {}
    return {
        "attachment_name": attachment.name,
        "attachment_media_type": attachment.media_type,
        "attachment_size": len(attachment.content),
        "attachment_sha256": attachment.sha256,
        "attachment_content": attachment.content,
    }


def attachment_output(request: HasAttachment) -> dict[str, object] | None:
    name = request.attachment_name
    if not name:
        return None
    return {
        "name": name,
        "media_type": request.attachment_media_type,
        "size": request.attachment_size,
    }


def attachment_response(request: HasAttachment) -> Response:
    name = request.attachment_name
    content = request.attachment_content
    media_type = request.attachment_media_type
    if not name or content is None or not media_type:
        raise AuthError(404, "financial_attachment_not_found")
    fallback = "piece-jointe." + name.rsplit(".", 1)[-1].lower()
    disposition = f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{quote(name)}"
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": disposition, "Cache-Control": "no-store"},
    )
