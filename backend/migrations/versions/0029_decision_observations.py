"""Optional observations on positive Activity decisions."""

import sqlalchemy as sa
from alembic import op

revision = "0029_decision_observations"
down_revision = "0028_activity_briefs"
branch_labels = None
depends_on = None


def upgrade():
    op.drop_constraint(
        "decision_reason_required", "pta_activity_revision_decision", type_="check"
    )
    op.create_check_constraint(
        "decision_reason_required",
        "pta_activity_revision_decision",
        "(outcome = 'returned' AND reason IS NOT NULL "
        "AND length(btrim(reason)) BETWEEN 1 AND 4000) "
        "OR (outcome <> 'returned' AND "
        "(reason IS NULL OR length(btrim(reason)) BETWEEN 1 AND 4000))",
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pta_activity_revision_decision "
            "WHERE outcome <> 'returned' AND reason IS NOT NULL)"
        )
    ):
        raise RuntimeError("Preserve positive decision observations before downgrade")
    op.drop_constraint(
        "decision_reason_required", "pta_activity_revision_decision", type_="check"
    )
    op.create_check_constraint(
        "decision_reason_required",
        "pta_activity_revision_decision",
        "(outcome = 'returned' AND reason IS NOT NULL "
        "AND length(btrim(reason)) BETWEEN 1 AND 4000) "
        "OR (outcome <> 'returned' AND reason IS NULL)",
    )
