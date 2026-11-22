from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.models import Audit
from app.planning.core.models import ActivityContributor

EXECUTION_AUTHOR_ACTIONS = {
    "operation.execution_started",
    "operation.execution_recorded",
    "operation.execution_corrected",
    "subtask.execution_recorded",
    "subtask.execution_corrected",
}


def financial_review_exclusions(
    db: Session, activity_id: str, submitter_id: str
) -> set[str]:
    """Freeze the people who authored the financial basis of a request."""
    excluded = {submitter_id}
    excluded.update(
        db.scalars(
            select(ActivityContributor.user_id).where(
                ActivityContributor.activity_id == activity_id,
                ActivityContributor.kind == "content",
            )
        )
    )
    excluded.update(
        db.scalars(
            select(Audit.actor).where(
                Audit.action.in_(EXECUTION_AUTHOR_ACTIONS),
                Audit.business["activity_id"].as_string() == activity_id,
            )
        )
    )
    return excluded
