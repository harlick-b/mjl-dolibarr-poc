"""Reviewer-created Activity drafts and immutable creation provenance."""

import sqlalchemy as sa
from alembic import op

revision = "0028_activity_briefs"
down_revision = "0027_pta_metadata"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column("pta_activity", "planned_end", nullable=True)
    op.alter_column("pta_activity", "allocation", nullable=True)
    op.create_check_constraint(
        "activity_complete_after_submission",
        "pta_activity",
        "(state = 'draft' AND current_revision_id IS NULL "
        "AND approved_revision_id IS NULL) "
        "OR (planned_end IS NOT NULL AND allocation IS NOT NULL)",
    )
    op.add_column(
        "pta_activity_contributor",
        sa.Column("kind", sa.String(32), nullable=False, server_default="content"),
    )
    op.alter_column("pta_activity_contributor", "kind", server_default=None)
    op.drop_constraint(
        "activity_contributor_once", "pta_activity_contributor", type_="unique"
    )
    op.create_unique_constraint(
        "activity_contributor_once",
        "pta_activity_contributor",
        ["activity_id", "user_id", "kind"],
    )
    op.create_check_constraint(
        "contribution_kind_allowed",
        "pta_activity_contributor",
        "kind IN ('content','supervisor_creation','validator_creation')",
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pta_activity "
            "WHERE planned_end IS NULL OR allocation IS NULL) "
            "OR EXISTS (SELECT 1 FROM pta_activity_contributor WHERE kind <> 'content')"
        )
    ):
        raise RuntimeError(
            "Preserve Activity briefs and creation provenance before downgrade"
        )
    op.drop_constraint(
        "contribution_kind_allowed", "pta_activity_contributor", type_="check"
    )
    op.drop_constraint(
        "activity_contributor_once", "pta_activity_contributor", type_="unique"
    )
    op.create_unique_constraint(
        "activity_contributor_once",
        "pta_activity_contributor",
        ["activity_id", "user_id"],
    )
    op.drop_column("pta_activity_contributor", "kind")
    op.drop_constraint(
        "activity_complete_after_submission", "pta_activity", type_="check"
    )
    op.alter_column("pta_activity", "planned_end", nullable=False)
    op.alter_column("pta_activity", "allocation", nullable=False)
