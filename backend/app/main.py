from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import RequestResponseEndpoint

from app.auth.access import router as access_router
from app.auth.models import Context
from app.auth.policy import load_policy
from app.auth.routes import router as auth_router
from app.auth.service import AuthError, AuthService, digest, request_id
from app.config import database_url as read_database_url
from app.database import make_engine
from app.health import router


def create_app(database_url: str | None = None) -> FastAPI:
    url = read_database_url(database_url)
    policy = load_policy(url)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.engine = make_engine(url)
        try:
            app.state.auth = AuthService(app.state.engine, policy) if policy else None
            yield
        finally:
            app.state.engine.dispose()

    app = FastAPI(title="MJL Foundation", version="0.1.0", lifespan=lifespan)
    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(access_router)

    def failure(request: Request, status: int, code: str) -> JSONResponse:
        response = JSONResponse(
            {
                "code": code,
                "message": "Service indisponible."
                if status == 503
                else "Vérification refusée. Vérifiez votre demande et réessayez.",
                "request_id": request_id.get() or str(uuid4()),
            },
            status_code=status,
        )
        if code == "session_expired" and policy:
            response.delete_cookie(
                policy.cookie_name,
                httponly=True,
                secure=policy.secure,
                samesite="lax",
                path="/",
            )
        return response

    def endpoint_limit(request: Request) -> bool:
        auth: AuthService | None = request.app.state.auth
        if not auth:
            return True
        ip = request.client.host if request.client else "unknown"
        with Session(auth.engine) as db, db.begin():
            return (
                auth.limit(
                    db, "endpoint:" + ip, policy.ip_window_seconds, policy.ip_limit
                )
                if policy
                else False
            )

    @app.middleware("http")
    async def sensitive_headers(
        request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        token = request_id.set(str(uuid4()))
        try:
            sensitive = request.url.path.startswith(("/api/v1/auth", "/api/v1/access"))
            if sensitive:
                try:
                    allowed = await run_in_threadpool(endpoint_limit, request)
                    response = (
                        await call_next(request)
                        if allowed
                        else failure(request, 429, "endpoint_limited")
                    )
                except SQLAlchemyError:
                    response = failure(request, 503, "service_unavailable")
                response.headers["Cache-Control"] = "no-store"
                response.headers["Referrer-Policy"] = "no-referrer"
                response.headers["X-Content-Type-Options"] = "nosniff"
            else:
                response = await call_next(request)
            return response
        finally:
            request_id.reset(token)

    @app.exception_handler(AuthError)
    def auth_error(request: Request, error: AuthError) -> JSONResponse:
        auth: AuthService | None = request.app.state.auth
        if auth and error.code in {
            "session_expired",
            "csrf_invalid",
            "origin_invalid",
            "host_invalid",
            "otp_required",
            "admin_required",
            "admin_target_forbidden",
            "account_exists",
            "account_stale",
            "account_ineligible",
            "eligibility_unverified",
            "invitation_stale",
            "invitation_terminal",
            "delivery_superseded",
        }:
            try:
                with Session(auth.engine) as db, db.begin():
                    context = db.get(
                        Context,
                        digest(request.cookies.get(auth.policy.cookie_name, "")),
                    )
                    auth.audit(
                        db,
                        "access_denied",
                        context.user_id if context and context.user_id else "anonymous",
                        context.id if context else None,
                        error.code,
                    )
            except SQLAlchemyError:
                return failure(request, 503, "service_unavailable")
        return failure(request, error.status, error.code)

    @app.exception_handler(RequestValidationError)
    def invalid_input(request: Request, error: RequestValidationError) -> JSONResponse:
        return failure(request, 422, "input_invalid")

    @app.exception_handler(SQLAlchemyError)
    def database_failure(request: Request, error: SQLAlchemyError) -> JSONResponse:
        return failure(request, 503, "service_unavailable")

    return app
