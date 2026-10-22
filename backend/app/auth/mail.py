import json
import os
from pathlib import Path
from uuid import uuid4

from app.auth.policy import synthetic_email


class TestMailbox:
    """Private synthetic capture, intentionally no SMTP or HTTP reader."""

    def __init__(self, directory: Path):
        self.directory = directory

    def send(self, recipient: str, kind: str, value: str) -> None:
        synthetic_email(recipient)
        self.directory.mkdir(mode=0o700, parents=False, exist_ok=True)
        if self.directory.is_symlink() or self.directory.stat().st_mode & 0o077:
            raise OSError("Unsafe test mailbox")
        path = self.directory / f"{uuid4()}.json"
        with open(path, "x", opener=lambda p, f: os.open(p, f, 0o600)) as stream:
            json.dump({"recipient": recipient, "kind": kind, "value": value}, stream)
