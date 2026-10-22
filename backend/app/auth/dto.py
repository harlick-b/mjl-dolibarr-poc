from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    request_id: str


class Identity(BaseModel):
    id: str
    email: str
    role: Literal["ADMIN_PLATEFORME"]


class Anonymous(BaseModel):
    state: Literal["anonymous"]
    csrf: str


class Pending(BaseModel):
    state: Literal["pending"]
    csrf: str
    email: str


class Verified(BaseModel):
    state: Literal["verified"]
    csrf: str
    user: Identity
    expires_at: datetime


class Invited(BaseModel):
    email: str


class PasswordSet(BaseModel):
    state: Literal["password_set"]


class ChallengeSent(BaseModel):
    state: Literal["pending"]
    email: str | None = None
