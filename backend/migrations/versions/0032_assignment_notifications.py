"""Recipient notifications for new Activity assignments."""

import sqlalchemy as sa
from alembic import op

revision = "0032_assignment_notifications"
down_revision = "0031_resumable_activity_drafts"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pta_activity_assignment_notification",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("assignment_id", sa.String(36), nullable=False),
        sa.Column("agent_id", sa.String(36), nullable=False),
        sa.Column("assigned_by_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_status", sa.String(16), nullable=False),
        sa.Column("email_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.ForeignKeyConstraint(
            ["assignment_id"], ["pta_activity_agent_assignment.id"]
        ),
        sa.ForeignKeyConstraint(["agent_id"], ["auth_user.id"]),
        sa.ForeignKeyConstraint(["assigned_by_id"], ["auth_user.id"]),
        sa.UniqueConstraint("assignment_id", name="assignment_notification_once"),
        sa.CheckConstraint(
            "email_status IN ('unconfirmed','delivered','failed','skipped')",
            name="assignment_notification_email_status_allowed",
        ),
        sa.CheckConstraint(
            "version > 0", name="assignment_notification_version_positive"
        ),
    )
    op.create_index(
        "assignment_notification_recipient_created",
        "pta_activity_assignment_notification",
        ["agent_id", "created_at", "id"],
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM pta_activity_assignment_notification)")
    ):
        raise RuntimeError(
            "Preserve Activity assignment notifications before downgrade"
        )
    op.drop_table("pta_activity_assignment_notification")
