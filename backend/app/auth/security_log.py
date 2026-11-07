"""Bounded security records; hosting owns protected persistence and retention."""

import json
import logging
import os
import re
import threading
import time
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import event
from sqlalchemy.orm import Session

logger = logging.getLogger("mjl.security")
logger.setLevel(logging.INFO)
logger.propagate = False
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)

ROUTINE = {
    "login",
    "otp_prepare",
    "otp_delivery",
    "otp_verify",
    "otp_resend",
    "logout",
    "reminder.read",
    "access_denied",
    "abuse_limit",
    "invitation_inspect",
    "recovery_prepare",
    "recovery_delivery",
    "recovery_notification",
}
SIGNIFICANT = {
    "account_deactivate",
    "account_role_change",
    "invitation_create",
    "invitation_reissue",
    "invitation_revoke",
    "invitation_accept",
    "recovery_complete",
    "bootstrap",
}
SUSPICIOUS = {
    "csrf_invalid",
    "origin_invalid",
    "host_invalid",
    "admin_required",
    "admin_target_forbidden",
    "business_forbidden",
    "eligibility_unverified",
}


def identity(value: str | None) -> str | None:
    try:
        return str(UUID(value or ""))
    except ValueError:
        return None


class SecurityLog:
    def __init__(self) -> None:
        self.limit = int(os.environ.get("MJL_SECURITY_LOG_MAX_PER_MINUTE", "120"))
        if not 1 <= self.limit <= 10000:
            raise ValueError(
                "MJL_SECURITY_LOG_MAX_PER_MINUTE must be between 1 and 10000"
            )
        self.lock = threading.Lock()
        self.started = time.monotonic()
        self.count = 0
        self.suppressed = 0

    def emit(
        self,
        kind: str,
        actor: str,
        outcome: str,
        correlation: str | None,
        target: str | None = None,
    ) -> None:
        # No attacker-keyed map: cardinality and output are bounded per worker.
        with self.lock:
            now = time.monotonic()
            if now - self.started >= 60:
                if self.suppressed:
                    self.write(
                        "security_log_suppressed",
                        None,
                        "limited",
                        None,
                        suppressed=self.suppressed,
                    )
                self.started, self.count, self.suppressed = now, 0, 0
            if self.count >= self.limit:
                self.suppressed = min(self.suppressed + 1, 2**63 - 1)
                return
            self.count += 1
            self.write(
                kind,
                identity(actor),
                outcome,
                identity(correlation),
                target=identity(target),
            )

    @staticmethod
    def write(
        kind: str,
        actor: str | None,
        outcome: str,
        correlation: str | None,
        *,
        suppressed: int | None = None,
        target: str | None = None,
    ) -> None:
        # Only code-defined event/outcome names; never arbitrary diagnostic text.
        if not re.fullmatch(r"[a-z_.]{1,48}", kind) or not re.fullmatch(
            r"[a-z_]{1,48}", outcome
        ):
            return
        record: dict[str, str | int] = {
            "category": "security",
            "event": kind,
            "outcome": outcome,
            "occurred_at": datetime.now(UTC).isoformat(),
        }
        if actor:
            record["actor_id"] = actor
        if target:
            record["target_user_id"] = target
        if correlation:
            record["request_id"] = correlation
        if suppressed is not None:
            record["suppressed_count"] = suppressed
        level = logging.INFO if outcome == "ok" else logging.WARNING
        record["level"] = logging.getLevelName(level).lower()
        logger.log(level, json.dumps(record, separators=(",", ":")))

    def record(
        self,
        db: Session,
        action: str,
        actor: str,
        target: str | None,
        outcome: str,
        correlation: str | None,
    ) -> bool:
        """Return whether this replaces a routine database audit write."""
        kind = None
        if action == "login" and outcome in {
            "credentials_invalid",
            "authentication_limited",
            "otp_locked",
        }:
            kind, actor = "authentication_failure", identity(target) or "anonymous"
        elif action == "otp_delivery" and outcome == "failed":
            kind, outcome = "authentication_failure", "otp_delivery_failed"
        elif action == "otp_verify":
            kind = (
                "authentication_success"
                if outcome == "ok"
                else "authentication_failure"
            )
        elif action == "access_denied" and outcome in SUSPICIOUS:
            kind = "authorization_failure"
        elif action == "abuse_limit":
            kind = "security_rate_limit"
        elif action in SIGNIFICANT:
            kind = action
        target_user = identity(target) if action in SIGNIFICANT else None
        if kind:
            # The session is command-local. A rolled-back/closed session cannot
            # emit a success, and no global queue retains its callbacks.
            event.listen(
                db,
                "after_commit",
                lambda _db: self.emit(kind, actor, outcome, correlation, target_user),
                once=True,
            )
        return action in ROUTINE
