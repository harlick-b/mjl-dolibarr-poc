import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.auth.policy import normalize_email

TEMPLATE_DIRECTORY = Path(__file__).resolve().parent / "templates"

MAILS = {
    "invitation": ("invitation", "Invitation à activer votre compte"),
    "otp": ("login-code", "Code de vérification"),
    "password_recovery": (
        "password-recovery",
        "Réinitialisation du mot de passe",
    ),
    "password_reset_notice": ("password-change-notice", "Mot de passe modifié"),
    "activity_reminder": ("activity-reminder", "Rappel d’échéance"),
}


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html: str
    text: str
    legacy_value: str


class MailRenderer:
    def __init__(self, directory: Path = TEMPLATE_DIRECTORY) -> None:
        self.environment = Environment(
            loader=FileSystemLoader(directory),
            autoescape=select_autoescape(enabled_extensions=("html",)),
            undefined=StrictUndefined,
            keep_trailing_newline=True,
        )

    def render(self, kind: str, **context: Any) -> RenderedEmail:
        try:
            template, title = MAILS[kind]
        except KeyError:
            raise ValueError("Unknown system email") from None
        values = {
            "app_name": "MJL",
            "email_title": title,
            "action_label": {
                "invitation": "Activer mon compte",
                "password_recovery": "Réinitialiser mon mot de passe",
            }.get(kind),
            **context,
        }
        html = self.environment.get_template(f"{template}.html").render(values)
        text = self.environment.get_template(f"{template}.txt").render(values)
        legacy_value = str(
            values.get("action_url")
            or values.get("otp_code")
            or values.get("activity_reference")
            or text
        )
        return RenderedEmail(title, html, text, legacy_value)


class TestMailbox:
    """Private synthetic capture with the same interface as the real transport."""

    def __init__(self, directory: Path):
        self.directory = directory

    def send(self, recipient: str, kind: str, message: RenderedEmail) -> str:
        normalize_email(recipient)
        self.directory.mkdir(mode=0o700, parents=False, exist_ok=True)
        if self.directory.is_symlink() or self.directory.stat().st_mode & 0o077:
            raise OSError("Unsafe test mailbox")
        identifier = str(uuid4())
        path = self.directory / f"{identifier}.json"
        with open(path, "x", opener=lambda p, f: os.open(p, f, 0o600)) as stream:
            json.dump(
                {
                    "recipient": recipient,
                    "kind": kind,
                    "value": message.legacy_value,
                    "subject": message.subject,
                    "html": message.html,
                    "text": message.text,
                    "provider_id": identifier,
                },
                stream,
            )
        return identifier


class ResendMailer:
    def __init__(
        self,
        api_key: str,
        sender: str,
        reply_to: str | None,
        client: httpx.Client | None = None,
    ) -> None:
        if not api_key or not sender:
            raise ValueError("Resend configuration is incomplete")
        self.api_key = api_key
        self.sender = sender
        self.reply_to = reply_to
        self.client = client or httpx.Client(timeout=10.0)

    def send(self, recipient: str, kind: str, message: RenderedEmail) -> str:
        del kind
        normalized = normalize_email(recipient)
        payload: dict[str, Any] = {
            "from": self.sender,
            "to": [normalized],
            "subject": message.subject,
            "html": message.html,
            "text": message.text,
        }
        if self.reply_to:
            payload["reply_to"] = self.reply_to
        try:
            response = self.client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
            body = response.json()
            if not isinstance(body, dict):
                raise ValueError
            identifier = body.get("id")
            if (
                not isinstance(identifier, str)
                or not identifier
                or len(identifier) > 64
            ):
                raise ValueError
            return identifier
        except (httpx.HTTPError, ValueError, TypeError):
            raise OSError("Email provider rejected the message") from None
