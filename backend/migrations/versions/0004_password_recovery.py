"""Ordinary synthetic-account password recovery proof."""

import sqlalchemy as sa
from alembic import op

revision = "0004_a3"
down_revision = "0003_a21"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auth_recovery",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(length=36),
            sa.ForeignKey("auth_user.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("verifier", sa.String(length=64), nullable=False),
        sa.Column("generation", sa.String(length=36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(length=16), nullable=False),
        sa.Column("user_proof", sa.String(length=64), nullable=False),
        sa.CheckConstraint(
            "state IN ('prepared','delivered','consumed')",
            name="recovery_state_allowed",
        ),
    )


def downgrade():
    op.drop_table("auth_recovery")
