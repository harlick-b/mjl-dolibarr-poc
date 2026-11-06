"""Preserve personal names without guessing the split of existing names."""

import sqlalchemy as sa
from alembic import op

revision = "0025_profile_names"
down_revision = "0024_budget_funding"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("auth_user", sa.Column("first_name", sa.String(100), nullable=True))
    op.add_column("auth_user", sa.Column("last_name", sa.String(100), nullable=True))
    op.create_check_constraint(
        "auth_user_profile_names",
        "auth_user",
        "(first_name IS NULL AND last_name IS NULL) OR "
        "(first_name IS NOT NULL AND last_name IS NOT NULL "
        "AND length(trim(first_name)) > 0 AND length(trim(last_name)) > 0 "
        "AND full_name IS NOT NULL AND full_name = first_name || ' ' || last_name)",
    )


def downgrade():
    # full_name retains the display name, but cannot preserve its exact split.
    connection = op.get_bind()
    if connection.scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM auth_user "
            "WHERE first_name IS NOT NULL OR last_name IS NOT NULL)"
        )
    ):
        raise RuntimeError(
            "Structured profile names must be preserved before downgrade"
        )
    op.drop_constraint("auth_user_profile_names", "auth_user", type_="check")
    op.drop_column("auth_user", "last_name")
    op.drop_column("auth_user", "first_name")
