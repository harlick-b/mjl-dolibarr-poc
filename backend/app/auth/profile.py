"""Self-service display names; credential and role changes are excluded."""

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from app.auth.policy import normalize_full_name
from app.auth.service import AuthError, AuthService


class Names(BaseModel):
    model_config = ConfigDict(extra="forbid")
    full_name: str | None = Field(default=None, max_length=200)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)


class Profile(Names):
    email: str
    role: str


class UpdateProfile(BaseModel):
    model_config = ConfigDict(extra="forbid")
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    expected: Names

    @field_validator("first_name", "last_name")
    @classmethod
    def normalize(cls, value: str) -> str:
        return normalize_full_name(value)

    @model_validator(mode="after")
    def combined_name(self) -> "UpdateProfile":
        normalize_full_name(f"{self.first_name} {self.last_name}")
        return self


def profile(
    auth: AuthService,
    secret: str | None,
    csrf: str | None = None,
    update: UpdateProfile | None = None,
) -> Profile:
    with Session(auth.engine) as db, db.begin():
        user = auth.principal(
            db, secret, read_only=update is None, mutation=update is not None, csrf=csrf
        )
        if update is not None:
            before = Names(
                full_name=user.full_name,
                first_name=user.first_name,
                last_name=user.last_name,
            )
            if before != update.expected:
                raise AuthError(409, "profile_changed")
            if (
                before.first_name == update.first_name
                and before.last_name == update.last_name
            ):
                return Profile(**before.model_dump(), email=user.email, role=user.role)
            user.full_name = normalize_full_name(
                f"{update.first_name} {update.last_name}"
            )
            user.first_name, user.last_name = update.first_name, update.last_name
            facts: dict[str, str | int]
            if before.first_name is None or before.last_name is None:
                facts = {
                    "before_full_name": before.full_name or "",
                    "full_name": user.full_name,
                }
            else:
                facts = {}
                for field in ("first_name", "last_name"):
                    old, new = getattr(before, field), getattr(user, field)
                    if old != new:
                        facts[f"before_{field}"] = old
                        facts[field] = new
            auth.audit(db, "profile_update", user.id, user.id, details=facts)

        return Profile(
            full_name=user.full_name,
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            role=user.role,
        )
