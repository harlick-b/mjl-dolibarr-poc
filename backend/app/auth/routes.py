from typing import Annotated
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from app.auth.dto import (
    Anonymous,
    ChallengeSent,
    ErrorResponse,
    Invited,
    PasswordSet,
    Pending,
    Verified,
)
from app.auth.service import AuthError, AuthService

router = APIRouter(
    prefix="/api/v1/auth",
    tags=["authentication"],
    responses={
        status: {"model": ErrorResponse}
        for status in (400, 401, 403, 409, 422, 429, 503)
    },
)


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class InvitationInput(Input):
    selector: str = Field(max_length=36)
    verifier: str = Field(max_length=128)


class Acceptance(InvitationInput):
    password: str = Field(max_length=128)
    confirmation: str = Field(max_length=128)


class Login(Input):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class Code(Input):
    code: str = Field(max_length=128)


def service(request: Request) -> AuthService:
    auth: AuthService | None = request.app.state.auth
    if auth is None:
        raise AuthError(503, "authentication_unavailable")
    origin = urlsplit(auth.policy.origin)
    if request.headers.get("host") != origin.netloc:
        raise AuthError(403, "host_invalid")
    if request.method != "GET" and request.headers.get("origin") != auth.policy.origin:
        raise AuthError(403, "origin_invalid")
    return auth


Auth = Annotated[AuthService, Depends(service)]


def evidence(request: Request, auth: AuthService) -> tuple[str | None, str | None]:
    return request.cookies.get(auth.policy.cookie_name), request.headers.get(
        "x-csrf-token"
    )


def set_cookie(response: Response, auth: AuthService, secret: str | None) -> None:
    if secret:
        response.set_cookie(
            auth.policy.cookie_name,
            secret,
            httponly=True,
            secure=auth.policy.secure,
            samesite="lax",
            path="/",
        )


@router.get("/session", response_model=Anonymous | Pending | Verified)
def session(request: Request, response: Response, auth: Auth) -> dict[str, object]:
    result, secret = auth.session(evidence(request, auth)[0])
    set_cookie(response, auth, secret)
    return result


@router.post("/invitations/inspect", response_model=Invited)
def inspect(body: InvitationInput, request: Request, auth: Auth) -> dict[str, str]:
    with Session(auth.engine) as db, db.begin():
        auth.guard(db, *evidence(request, auth))
    return {"email": auth.invitation(body.selector, body.verifier)}


@router.post("/invitations/accept", response_model=PasswordSet)
def accept(body: Acceptance, request: Request, auth: Auth) -> dict[str, str]:
    with Session(auth.engine) as db, db.begin():
        auth.guard(db, *evidence(request, auth))
    auth.invitation(body.selector, body.verifier, body.password, body.confirmation)
    return {"state": "password_set"}


@router.post("/login", status_code=202, response_model=ChallengeSent)
def login(body: Login, request: Request, auth: Auth) -> dict[str, object]:
    return auth.login(
        *evidence(request, auth),
        body.email,
        body.password,
        request.client.host if request.client else "unknown",
    )


@router.post("/otp/verify", response_model=Verified)
def verify(
    body: Code, request: Request, response: Response, auth: Auth
) -> dict[str, object]:
    result, secret = auth.otp(*evidence(request, auth), body.code)
    set_cookie(response, auth, secret)
    return result


@router.post("/otp/resend", status_code=202, response_model=ChallengeSent)
def resend(body: Input, request: Request, auth: Auth) -> dict[str, object]:
    return auth.otp(*evidence(request, auth))[0]


@router.post("/logout", status_code=204)
def logout(body: Input, request: Request, auth: Auth) -> Response:
    auth.logout(*evidence(request, auth))
    response = Response(status_code=204)
    response.delete_cookie(
        auth.policy.cookie_name,
        httponly=True,
        secure=auth.policy.secure,
        samesite="lax",
        path="/",
    )
    return response
