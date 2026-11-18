"""Allow editable Activity corrections to retain incomplete dates."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0039_editable_activity_dates"
down_revision: str | None = "0038_draft_task_categories"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "activity_complete_after_submission", "pta_activity", type_="check"
    )
    op.create_check_constraint(
        "activity_complete_after_submission",
        "pta_activity",
        "(state = 'draft' AND current_revision_id IS NULL "
        "AND approved_revision_id IS NULL) OR "
        "(state IN ('amendment_draft','returned_supervisor',"
        "'returned_validator') AND allocation IS NOT NULL "
        "AND withdrawal_id IS NULL AND transfer_id IS NULL) OR "
        "(planned_start IS NOT NULL AND planned_end IS NOT NULL "
        "AND allocation IS NOT NULL)",
    )


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pta_activity WHERE NOT ("
            "(state = 'draft' AND current_revision_id IS NULL "
            "AND approved_revision_id IS NULL) OR "
            "(planned_start IS NOT NULL AND planned_end IS NOT NULL "
            "AND allocation IS NOT NULL)))"
        )
    ):
        raise RuntimeError("Refusing to discard incomplete editable Activity dates")
    op.drop_constraint(
        "activity_complete_after_submission", "pta_activity", type_="check"
    )
    op.create_check_constraint(
        "activity_complete_after_submission",
        "pta_activity",
        "(state = 'draft' AND current_revision_id IS NULL "
        "AND approved_revision_id IS NULL) OR "
        "(planned_start IS NOT NULL AND planned_end IS NOT NULL "
        "AND allocation IS NOT NULL)",
    )
