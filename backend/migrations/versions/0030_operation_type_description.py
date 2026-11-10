"""Saved descriptions for operation categories."""

import sqlalchemy as sa
from alembic import op

revision = "0030_operation_type_description"
down_revision = "0029_decision_observations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pta_operation_type",
        sa.Column("description", sa.String(4000), nullable=True),
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pta_operation_type "
            "WHERE description IS NOT NULL)"
        )
    ):
        raise RuntimeError("Preserve operation category descriptions before downgrade")
    op.drop_column("pta_operation_type", "description")
