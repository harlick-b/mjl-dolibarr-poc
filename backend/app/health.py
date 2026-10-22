from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_session

router = APIRouter(prefix="/api/health", tags=["Health"])


class Healthy(BaseModel):
    status: Literal["ok"] = "ok"


class Unavailable(BaseModel):
    status: Literal["unavailable"] = "unavailable"


@router.get("/live", response_model=Healthy)
def live(response: Response) -> Healthy:
    response.headers["Cache-Control"] = "no-store"
    return Healthy()


@router.get("/ready", response_model=Healthy, responses={503: {"model": Unavailable}})
def ready(
    response: Response, session: Annotated[Session, Depends(get_session)]
) -> Healthy | JSONResponse:
    response.headers["Cache-Control"] = "no-store"
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable"},
            headers={"Cache-Control": "no-store"},
        )
    return Healthy()
