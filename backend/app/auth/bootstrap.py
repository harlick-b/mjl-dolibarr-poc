"""Run only through restricted operator access to an isolated A1 environment."""

import argparse
import os

from sqlalchemy.exc import SQLAlchemyError

from app.auth.policy import load_policy
from app.auth.service import AuthError, AuthService
from app.config import database_url
from app.database import make_engine


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--email", required=True)
    parser.add_argument("--reissue", action="store_true")
    args = parser.parse_args()
    url = database_url()
    policy = load_policy(url)
    engine = make_engine(url)
    try:
        AuthService(engine, policy).bootstrap(
            args.email, f"os-uid:{os.getuid()}", args.reissue
        )
    except (AuthError, ValueError, SQLAlchemyError):
        parser.exit(
            1, "Bootstrap refused. Check the isolated policy and security audit.\n"
        )
    finally:
        engine.dispose()
    print("Synthetic invitation delivered to the private test mailbox.")


if __name__ == "__main__":
    main()
