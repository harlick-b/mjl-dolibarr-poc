from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    request_id: str


BusinessRole = Literal["AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"]
Role = Literal[
    "ADMIN_PLATEFORME", "AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"
]


class Identity(BaseModel):
    id: str
    email: str
    role: Role


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
