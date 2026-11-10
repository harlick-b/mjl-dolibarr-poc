"""Activity review and Agent outcome notifications."""

import sqlalchemy as sa
from alembic import op

revision = "0033_activity_notifications"
down_revision = "0032_assignment_notifications"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "pta_activity_workflow_notification",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("revision_id", sa.String(36), nullable=False),
        sa.Column("recipient_id", sa.String(36), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("stage", sa.String(16), nullable=False),
        sa.Column("reason", sa.String(4000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("handled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("email_status", sa.String(16), nullable=False),
        sa.Column("email_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.ForeignKeyConstraint(
            ["activity_id", "revision_id"],
            ["pta_activity_revision.activity_id", "pta_activity_revision.id"],
        ),
        sa.ForeignKeyConstraint(["recipient_id"], ["auth_user.id"]),
        sa.UniqueConstraint(
            "revision_id",
            "recipient_id",
            "kind",
            "stage",
            name="activity_workflow_notification_once",
        ),
        sa.CheckConstraint(
            "kind IN ('activity_review','activity_correction','activity_approved')",
            name="activity_workflow_notification_kind_allowed",
        ),
        sa.CheckConstraint(
            "stage IN ('supervisor','validator','agent')",
            name="activity_workflow_notification_stage_allowed",
        ),
        sa.CheckConstraint(
            "email_status IN ('unconfirmed','delivered','failed','skipped')",
            name="activity_workflow_notification_email_status_allowed",
        ),
        sa.CheckConstraint(
            "version > 0", name="activity_workflow_notification_version_positive"
        ),
    )
    op.create_index(
        "activity_workflow_notification_recipient_created",
        "pta_activity_workflow_notification",
        ["recipient_id", "created_at", "id"],
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text("SELECT EXISTS (SELECT 1 FROM pta_activity_workflow_notification)")
    ):
        raise RuntimeError("Preserve Activity workflow notifications before downgrade")
    op.drop_table("pta_activity_workflow_notification")
