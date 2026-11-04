import os
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    NameEmail,
    PositiveInt,
    TypeAdapter,
)
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
    mailbox: Path | None = None
    resend_api_key: str | None = None
    email_from: str | None = None
    email_reply_to: str | None = None
    # Operator attestation, only after verifying a fresh isolated database.
    lifecycle_database: str | None = None
    recovery_fixture: str | None = None
    recovery_seconds: PositiveInt | None = None
    recovery_email_window_seconds: PositiveInt | None = None
    recovery_email_limit: PositiveInt | None = None
    recovery_ip_window_seconds: PositiveInt | None = None
    recovery_ip_limit: PositiveInt | None = None
    planning_lifecycle_fixture: str | None = None

    @property
    def recovery_enabled(self) -> bool:
        return self.recovery_fixture in {"TEST_ONLY", "LOCAL"}

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
    parsed_url = make_url(url)
    if mode == "local":
        try:
            origin_value = os.environ["APP_BASE_URL"]
            origin = urlsplit(origin_value)
            key = os.environ["MJL_AUTH_KEY"]
            api_key = os.environ["RESEND_API_KEY"]
            sender = str(
                TypeAdapter(NameEmail).validate_python(os.environ["EMAIL_FROM"])
            )
            reply_to = os.environ.get("EMAIL_REPLY_TO") or None
            if (
                os.environ.get("MJL_ENVIRONMENT") != "local-development"
                or origin.hostname not in {"localhost", "127.0.0.1"}
                or origin.scheme != "http"
                or origin.path not in {"", "/"}
                or origin.query
                or origin.fragment
                or origin.username
                or len(key) < 64
                or not re.fullmatch(r"[a-f0-9]+", key)
                or not api_key
                or not sender
                or not parsed_url.database
            ):
                raise ValueError
            if reply_to:
                reply_to = normalize_email(reply_to)
            return Policy(
                fixture="local-v1",
                password_min=8,
                invitation_seconds=604800,
                otp_seconds=600,
                otp_attempts=5,
                otp_lock_seconds=600,
                resend_seconds=60,
                resend_max=3,
                context_seconds=900,
                login_window_seconds=900,
                login_limit=10,
                ip_window_seconds=60,
                ip_limit=120,
                concurrent_sessions="independent",
                origin=origin_value.rstrip("/"),
                key=key,
                resend_api_key=api_key,
                email_from=sender,
                email_reply_to=reply_to,
                lifecycle_database=parsed_url.database,
                recovery_fixture="LOCAL",
                recovery_seconds=600,
                recovery_email_window_seconds=600,
                recovery_email_limit=3,
                recovery_ip_window_seconds=60,
                recovery_ip_limit=20,
                planning_lifecycle_fixture="LOCAL",
            )
        except (KeyError, ValueError):
            raise ValueError("Invalid local authentication configuration") from None
    if (
        mode != "synthetic"
        or os.environ.get("MJL_ENVIRONMENT") != "isolated-test"
        or not (parsed_url.database or "").startswith("mjl_test_")
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
            or policy.mailbox is None
            or not str(policy.mailbox).startswith("/tmp/mjl-a1-mail")
            or ".." in policy.mailbox.parts
        ):
            raise ValueError
        recovery = (
            policy.recovery_seconds,
            policy.recovery_email_window_seconds,
            policy.recovery_email_limit,
            policy.recovery_ip_window_seconds,
            policy.recovery_ip_limit,
        )
        if policy.recovery_fixture is None:
            if any(value is not None for value in recovery):
                raise ValueError
        elif policy.recovery_fixture != "TEST_ONLY" or recovery != (
            600,
            600,
            3,
            60,
            20,
        ):
            raise ValueError
        if policy.planning_lifecycle_fixture not in {
            None,
            "SYNTHETIC_EXECUTION_TEST_ONLY",
        }:
            raise ValueError
        return policy
    except (OSError, KeyError, ValueError):
        raise ValueError("Invalid isolated A1 policy configuration") from None


def normalize_email(value: str) -> str:
    candidate = value.strip().lower()
    if re.fullmatch(r"[a-z0-9][a-z0-9._+-]{0,63}@example\.test", candidate):
        return candidate
    try:
        return str(TypeAdapter(EmailStr).validate_python(candidate)).lower()
    except ValueError:
        raise ValueError("Valid email address required") from None


def normalize_full_name(value: str) -> str:
    name = value.strip()
    if (
        not name
        or len(name) > 200
        or any(unicodedata.category(character).startswith("C") for character in name)
    ):
        raise ValueError("Valid full name required")
    return name

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
