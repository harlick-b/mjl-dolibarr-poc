import os

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError


def database_url(value: str | None = None) -> URL:
    """Validate configuration without including the supplied secret in errors."""
    try:
        url = make_url(
            value if value is not None else os.environ.get("DATABASE_URL", "")
        )
        if (
            url.drivername != "postgresql+psycopg"
            or not url.host
            or not url.database
            or not url.username
            or not url.password
        ):
            raise ValueError
        _ = url.port
    except (ArgumentError, ValueError):
        raise ValueError(
            "DATABASE_URL must be a complete postgresql+psycopg URL"
        ) from None
    return url
