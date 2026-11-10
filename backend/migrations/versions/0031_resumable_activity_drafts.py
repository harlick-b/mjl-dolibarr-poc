"""Allow undated, resumable initial Activity drafts."""

import sqlalchemy as sa
from alembic import op

revision = "0031_resumable_activity_drafts"
down_revision = "0030_operation_type_description"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint("activity_placement_year_valid", "pta_activity", type_="check")
    op.drop_constraint(
        "activity_complete_after_submission", "pta_activity", type_="check"
    )
    op.alter_column("pta_activity", "planned_start", nullable=True)
    op.create_check_constraint(
        "activity_placement_year_valid",
        "pta_activity",
        "placement_year BETWEEN 2000 AND 2200 AND "
        "(planned_start IS NULL OR "
        "extract(year from planned_start)::integer = placement_year)",
    )
    op.create_check_constraint(
        "activity_complete_after_submission",
        "pta_activity",
        "(state = 'draft' AND current_revision_id IS NULL "
        "AND approved_revision_id IS NULL) OR "
        "(planned_start IS NOT NULL AND planned_end IS NOT NULL "
        "AND allocation IS NOT NULL)",
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pta_activity WHERE planned_start IS NULL)"
        )
    ):
        raise RuntimeError("Preserve undated Activity drafts before downgrade")
    op.drop_constraint(
        "activity_complete_after_submission", "pta_activity", type_="check"
    )
    op.drop_constraint("activity_placement_year_valid", "pta_activity", type_="check")
    op.alter_column("pta_activity", "planned_start", nullable=False)
    op.create_check_constraint(
        "activity_placement_year_valid",
        "pta_activity",
        "placement_year BETWEEN 2000 AND 2200 AND "
        "extract(year from planned_start)::integer = placement_year",
    )
    op.create_check_constraint(
        "activity_complete_after_submission",
        "pta_activity",
        "(state = 'draft' AND current_revision_id IS NULL "
        "AND approved_revision_id IS NULL) OR "
        "(planned_end IS NOT NULL AND allocation IS NOT NULL)",
    )
