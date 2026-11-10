"""Record uncertain notification email delivery without retry."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0035_uncertain_notification_mail"
down_revision: str | None = "0034_financial_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CONSTRAINTS = (
    ("pta_activity_reminder", "reminder_email_status_allowed"),
    (
        "pta_activity_assignment_notification",
        "assignment_notification_email_status_allowed",
    ),
    (
        "pta_activity_workflow_notification",
        "activity_workflow_notification_email_status_allowed",
    ),
    (
        "pta_financial_workflow_notification",
        "financial_workflow_notification_email_status_allowed",
    ),
)


def _replace(allowed: str) -> None:
    for table, name in CONSTRAINTS:
        op.drop_constraint(name, table, type_="check")
        op.create_check_constraint(name, table, f"email_status IN ({allowed})")


def upgrade() -> None:
    _replace("'unconfirmed','delivered','failed','uncertain','skipped'")


def downgrade() -> None:
    for table, _name in CONSTRAINTS:
        notification_table = sa.table(table, sa.column("email_status"))
        if op.get_bind().scalar(
            sa.select(sa.func.count())
            .select_from(notification_table)
            .where(notification_table.c.email_status == "uncertain")
        ):
            raise RuntimeError("Refusing to discard uncertain email delivery history")
    _replace("'unconfirmed','delivered','failed','skipped'")
