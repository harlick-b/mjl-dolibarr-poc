from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str


BusinessRole = Literal["AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF"]
InvitableRole = Literal[
    "AGENT_SAISIE", "AGENT_VERIFICATEUR", "VALIDATEUR_DEFINITIF", "PARTENAIRE"
]
Role = Literal[
    "ADMIN_PLATEFORME",
    "AGENT_SAISIE",
    "AGENT_VERIFICATEUR",
    "VALIDATEUR_DEFINITIF",
    "PARTENAIRE",
]


class SessionIdentity(BaseModel):
    full_name: str | None = None
    id: str
    email: str
    role: Role


class Identity(SessionIdentity):
    partner_id: str | None = None


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
    user: SessionIdentity
    expires_at: datetime


class Invited(BaseModel):
    email: str


class PasswordSet(BaseModel):
    state: Literal["password_set"]


class ChallengeSent(BaseModel):
    state: Literal["pending"]
    email: str | None = None


class RecoveryRequested(BaseModel):
    state: Literal["request_received"]


class PasswordReset(BaseModel):
    state: Literal["password_reset"]
