"""Store optional partner descriptions without changing existing records."""

import sqlalchemy as sa
from alembic import op

revision = "0026_partner_description"
down_revision = "0025_profile_names"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "pta_partner", sa.Column("description", sa.String(4000), nullable=True)
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pta_partner WHERE description IS NOT NULL)"
        )
    ):
        raise RuntimeError("Preserve partner descriptions before downgrade")
    op.drop_column("pta_partner", "description")
