"""Add explicit PTA metadata; preserve existing project/year plans."""

import sqlalchemy as sa
from alembic import op

revision = "0027_pta_metadata"
down_revision = "0026_partner_description"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("pta_annual", sa.Column("name", sa.String(200), nullable=True))
    op.add_column(
        "pta_annual", sa.Column("description", sa.String(4000), nullable=True)
    )
    op.add_column(
        "pta_annual",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.execute("UPDATE pta_annual SET name = 'PTA ' || year::text")
    op.alter_column("pta_annual", "name", nullable=False)
    op.alter_column("pta_annual", "version", server_default=None)


def downgrade():
    if op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pta_annual "
            "WHERE name <> 'PTA ' || year::text "
            "OR description IS NOT NULL OR version <> 1)"
        )
    ):
        raise RuntimeError("Preserve PTA metadata before downgrade")
    op.drop_column("pta_annual", "version")
    op.drop_column("pta_annual", "description")
    op.drop_column("pta_annual", "name")
