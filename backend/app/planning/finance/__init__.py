from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import User


def actor_display_names(db: Session, actor_ids: Iterable[str]) -> dict[str, str]:
    ids = set(actor_ids)
    if not ids:
        return {}
    return {
        user.id: user.full_name or user.email
        for user in db.scalars(select(User).where(User.id.in_(ids)))
    }
