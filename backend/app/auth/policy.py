import os
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, PositiveInt
from sqlalchemy.engine import URL, make_url


class Policy(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)
    fixture: str
    password_min: PositiveInt
    invitation_seconds: PositiveInt
    otp_seconds: PositiveInt
    otp_attempts: PositiveInt
    otp_lock_seconds: PositiveInt
    resend_seconds: PositiveInt
    resend_max: PositiveInt
    context_seconds: PositiveInt
    login_window_seconds: PositiveInt
    login_limit: PositiveInt
    ip_window_seconds: PositiveInt
    ip_limit: PositiveInt
    concurrent_sessions: str
    origin: str
    key: str
    mailbox: Path

    @property
    def secure(self) -> bool:
        return self.origin.startswith("https://")

    @property
    def cookie_name(self) -> str:
        return "__Host-mjl" if self.secure else "mjl_local"


def load_policy(url: str | URL) -> Policy | None:
    mode = os.environ.get("MJL_AUTH_MODE", "off")
    if mode == "off":
        return None
    if (
        mode != "synthetic"
        or os.environ.get("MJL_ENVIRONMENT") != "isolated-test"
        or not (make_url(url).database or "").startswith("mjl_test_")
    ):
        raise ValueError("A1 requires an isolated synthetic test environment")
    try:
        data = Path(os.environ["MJL_AUTH_POLICY_FILE"]).read_text()
        policy = Policy.model_validate_json(data)
        origin = urlsplit(policy.origin)
        if (
            policy.fixture != "a1-synthetic-v1"
            or policy.concurrent_sessions != "independent-test-only"
            or origin.hostname not in {"localhost", "127.0.0.1"}
            or origin.scheme not in {"http", "https"}
            or origin.path
            or origin.query
            or origin.fragment
            or origin.username
            or len(policy.key) < 64
            or not re.fullmatch(r"[a-f0-9]+", policy.key)
            or not str(policy.mailbox).startswith("/tmp/mjl-a1-mail")
            or ".." in policy.mailbox.parts
        ):
            raise ValueError
        return policy
    except (OSError, KeyError, ValueError):
        raise ValueError("Invalid isolated A1 policy configuration") from None


def synthetic_email(value: str) -> str:
    email = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9._+-]{0,63}@example\.test", email):
        raise ValueError("Synthetic @example.test identity required")
    return email


def password_valid(value: str, confirmation: str, minimum: int) -> bool:
    return (
        value == confirmation
        and minimum <= len(value) <= 128
        and any(unicodedata.category(c) == "Lu" for c in value)
        and any(unicodedata.category(c) == "Ll" for c in value)
        and any(c.isdecimal() for c in value)
        and any(
            unicodedata.category(c)[0] not in {"L", "N"} and not c.isspace()
            for c in value
        )
    )
