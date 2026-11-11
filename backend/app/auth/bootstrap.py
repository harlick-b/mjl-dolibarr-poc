"""Provision the first local Admin through restricted operator access."""

import argparse
import os

from sqlalchemy.exc import SQLAlchemyError

import app.planning.core.models  # noqa: F401
from app.auth.policy import load_policy
from app.auth.service import AuthError, AuthService
from app.core.config import database_url
from app.core.database import make_engine


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--reissue", action="store_true")
    args = parser.parse_args()
    url = database_url()
    policy = load_policy(url)
    engine = make_engine(url)
    try:
        AuthService(engine, policy).bootstrap(
            args.email, args.name, f"os-uid:{os.getuid()}", args.reissue
        )
    except (AuthError, ValueError, SQLAlchemyError):
        parser.exit(
            1, "Bootstrap refused. Check the isolated policy and security audit.\n"
        )
    finally:
        engine.dispose()
    print("Admin invitation delivered.")


if __name__ == "__main__":
    main()
