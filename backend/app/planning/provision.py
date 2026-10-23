"""Provision the single synthetic MJL ownership context."""

import argparse
import os

from sqlalchemy.exc import SQLAlchemyError

from app.auth.policy import load_policy
from app.auth.service import AuthError, AuthService
from app.config import database_url
from app.database import make_engine


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reason", required=True)
    args = parser.parse_args()
    url = database_url()
    policy = load_policy(url)
    engine = make_engine(url)
    try:
        AuthService(engine, policy).provision_context(
            f"os-uid:{os.getuid()}", args.reason
        )
    except (AuthError, ValueError, SQLAlchemyError):
        parser.exit(1, "MJL ownership provisioning refused.\n")
    finally:
        engine.dispose()
    print("Synthetic MJL ownership context verified.")


if __name__ == "__main__":
    main()
