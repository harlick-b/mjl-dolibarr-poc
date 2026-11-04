"""PTA-5 administrative reminders.

Revision ID: 0016_pta5
Revises: 0015_pta3f
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0016_pta5"
down_revision: str | None = "0015_pta3f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pta_activity_reminder",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("approved_revision_id", sa.String(36), nullable=False),
        sa.Column(
            "agent_id", sa.String(36), sa.ForeignKey("auth_user.id"), nullable=False
        ),
        sa.Column("planned_end", sa.Date(), nullable=False),
        sa.Column("due_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("email_status", sa.String(16), nullable=False),
        sa.Column("email_completed_at", sa.DateTime(timezone=True)),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.ForeignKeyConstraint(
            ["activity_id", "approved_revision_id"],
            ["pta_activity_revision.activity_id", "pta_activity_revision.id"],
        ),
        sa.UniqueConstraint(
            "activity_id", "agent_id", "planned_end", name="reminder_cycle_once"
        ),
        sa.CheckConstraint("due_on = planned_end - 21", name="reminder_due_date"),
        sa.CheckConstraint(
            "email_status IN ('unconfirmed','delivered','failed','skipped')",
            name="reminder_email_status_allowed",
        ),
        sa.CheckConstraint("version > 0", name="reminder_version_positive"),
    )
    op.create_index(
        "reminder_recipient_created",
        "pta_activity_reminder",
        ["agent_id", "created_at", "id"],
    )


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT count(*) FROM pta_activity_reminder")):
        raise RuntimeError("Refusing to discard reminder history")
    op.drop_table("pta_activity_reminder")
