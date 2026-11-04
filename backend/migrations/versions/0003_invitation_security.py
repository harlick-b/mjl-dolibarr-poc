"""Invitation concurrency and bounded security audit facts; no new tables."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0003_a21"
down_revision = "0002_a1"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "auth_invitation",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.alter_column("auth_invitation", "version", server_default=None)
    op.create_check_constraint(
        "invitation_version_positive", "auth_invitation", "version > 0"
    )
    op.add_column(
        "auth_audit", sa.Column("details", JSONB(none_as_null=True), nullable=True)
    )
    op.create_check_constraint(
        "audit_details_bounded",
        "auth_audit",
        "details IS NULL OR (jsonb_typeof(details) = 'object' "
        "AND octet_length(details::text) <= 2048)",
    )


def downgrade():
    op.drop_constraint("audit_details_bounded", "auth_audit")
    op.drop_column("auth_audit", "details")
    op.drop_constraint("invitation_version_positive", "auth_invitation")
    op.drop_column("auth_invitation", "version")
