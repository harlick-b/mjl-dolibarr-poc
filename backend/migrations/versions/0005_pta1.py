"""PTA-1 planning foundation and trusted MJL context."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0005_pta1"
down_revision = "0004_a3"
branch_labels = None
depends_on = None


def audit_columns():
    return [
        sa.Column(
            "creator_id", sa.String(36), sa.ForeignKey("auth_user.id"), nullable=False
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade():
    op.add_column(
        "auth_audit", sa.Column("business", JSONB(none_as_null=True), nullable=True)
    )
    op.create_check_constraint(
        "audit_business_bounded",
        "auth_audit",
        "business IS NULL OR (jsonb_typeof(business) = 'object' "
        "AND octet_length(business::text) <= 1048576)",
    )
    op.execute("CREATE SEQUENCE pta_project_reference_seq")
    op.execute("CREATE SEQUENCE pta_activity_reference_seq")
    op.create_table(
        "mjl_ownership_context",
        sa.Column("id", sa.String(3), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 'MJL'", name="ownership_context_singleton"),
    )
    op.create_table(
        "pta_partner",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "context_id",
            sa.String(3),
            sa.ForeignKey("mjl_ownership_context.id"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        *audit_columns(),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("context_id", "id"),
    )
    op.create_table(
        "pta_operation_type",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "context_id",
            sa.String(3),
            sa.ForeignKey("mjl_ownership_context.id"),
            nullable=False,
        ),
        sa.Column("label", sa.String(200), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False),
        *audit_columns(),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("context_id", "id"),
    )
    op.create_table(
        "pta_project",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("partner_id", sa.String(36), nullable=False),
        sa.Column("reference", sa.String(32), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        *audit_columns(),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["context_id", "partner_id"], ["pta_partner.context_id", "pta_partner.id"]
        ),
        sa.UniqueConstraint("context_id", "id"),
        sa.CheckConstraint(
            "state IN ('active','closed')", name="project_state_allowed"
        ),
        sa.CheckConstraint("version > 0", name="project_version_positive"),
    )
    op.create_index(
        "project_one_active_per_partner",
        "pta_project",
        ["context_id", "partner_id"],
        unique=True,
        postgresql_where=sa.text("state = 'active'"),
    )
    op.create_table(
        "pta_annual",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("project_id", sa.String(36), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        *audit_columns(),
        sa.ForeignKeyConstraint(
            ["context_id", "project_id"], ["pta_project.context_id", "pta_project.id"]
        ),
        sa.UniqueConstraint("context_id", "id"),
        sa.UniqueConstraint(
            "context_id", "id", "project_id", "year", name="pta_scope_identity"
        ),
        sa.UniqueConstraint(
            "context_id", "project_id", "year", name="pta_project_year"
        ),
        sa.CheckConstraint("year BETWEEN 2000 AND 2200", name="pta_year_allowed"),
    )
    op.create_table(
        "pta_activity",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("pta_id", sa.String(36), nullable=False),
        sa.Column("reference", sa.String(32), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.String(4000), nullable=False),
        sa.Column("planned_start", sa.Date(), nullable=False),
        sa.Column("planned_end", sa.Date(), nullable=False),
        sa.Column("allocation", sa.BigInteger(), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        *audit_columns(),
        sa.Column(
            "request_actor_id",
            sa.String(36),
            sa.ForeignKey("auth_user.id"),
            nullable=False,
        ),
        sa.Column("request_project_id", sa.String(36), nullable=False),
        sa.Column("request_year", sa.Integer(), nullable=False),
        sa.Column("request_key", sa.String(36), nullable=False),
        sa.Column("request_fingerprint", sa.String(64), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["context_id", "pta_id", "request_project_id", "request_year"],
            [
                "pta_annual.context_id",
                "pta_annual.id",
                "pta_annual.project_id",
                "pta_annual.year",
            ],
        ),
        sa.UniqueConstraint("context_id", "id"),
        sa.UniqueConstraint(
            "context_id",
            "request_actor_id",
            "request_project_id",
            "request_year",
            "request_key",
            name="activity_request_key",
        ),
        sa.CheckConstraint("state = 'draft'", name="activity_draft_only"),
        sa.CheckConstraint("version > 0", name="activity_version_positive"),
        sa.CheckConstraint("allocation > 0", name="activity_allocation_positive"),
        sa.CheckConstraint(
            "planned_end >= planned_start", name="activity_dates_ordered"
        ),
    )
    op.create_table(
        "pta_operation",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("type_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("allocation", sa.BigInteger(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        *audit_columns(),
        sa.Column(
            "updated_by_id",
            sa.String(36),
            sa.ForeignKey("auth_user.id"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True)),
        sa.Column("removed_by_id", sa.String(36), sa.ForeignKey("auth_user.id")),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.ForeignKeyConstraint(
            ["context_id", "type_id"],
            ["pta_operation_type.context_id", "pta_operation_type.id"],
        ),
        sa.UniqueConstraint("context_id", "id"),
        sa.CheckConstraint("allocation > 0", name="operation_allocation_positive"),
        sa.CheckConstraint("position > 0", name="operation_position_positive"),
    )
    op.create_index(
        "operation_current_position",
        "pta_operation",
        ["activity_id", "position"],
        unique=True,
        postgresql_where=sa.text("removed_at IS NULL"),
    )
    op.create_table(
        "pta_activity_agent_assignment",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column(
            "agent_id", sa.String(36), sa.ForeignKey("auth_user.id"), nullable=False
        ),
        sa.Column(
            "assigned_by_id",
            sa.String(36),
            sa.ForeignKey("auth_user.id"),
            nullable=False,
        ),
        sa.Column("assigned_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("ended_by_id", sa.String(36), sa.ForeignKey("auth_user.id")),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
    )
    op.create_index(
        "assignment_one_current",
        "pta_activity_agent_assignment",
        ["activity_id", "agent_id"],
        unique=True,
        postgresql_where=sa.text("ended_at IS NULL"),
    )


def downgrade():
    op.drop_index("assignment_one_current", table_name="pta_activity_agent_assignment")
    for table in (
        "pta_activity_agent_assignment",
        "pta_operation",
        "pta_activity",
        "pta_annual",
        "pta_project",
        "pta_operation_type",
        "pta_partner",
        "mjl_ownership_context",
    ):
        op.drop_table(table)
    op.execute("DROP SEQUENCE pta_activity_reference_seq")
    op.execute("DROP SEQUENCE pta_project_reference_seq")
    op.drop_constraint("audit_business_bounded", "auth_audit")
    op.drop_column("auth_audit", "business")
