"""One bounded email attempt shared by durable planning notifications."""

from typing import Literal

from jinja2 import UndefinedError

from app.auth.mail import MailDeliveryUncertain
from app.auth.service import AuthService
from app.planning.core.models import Activity

EmailAttemptStatus = Literal["delivered", "failed", "uncertain"]


def activity_action_url(auth: AuthService, activity: Activity) -> str:
    module = "execution" if activity.approved_revision_id else "planning"
    return f"{auth.policy.origin}/{module}/activities/{activity.id}"


def attempt_notification_email(
    auth: AuthService,
    recipient: str,
    kind: str,
    context: dict[str, object],
) -> tuple[EmailAttemptStatus, str | None]:
    try:
        return "delivered", auth.send_mail(recipient, kind, **context)
    except MailDeliveryUncertain:
        return "uncertain", None
    except (OSError, UndefinedError):
        return "failed", None
