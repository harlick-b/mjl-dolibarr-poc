"""Add weighted tasks and optional financial subtasks."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0036_weighted_tasks"
down_revision: str | None = "0035_uncertain_notification_mail"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "pta_operation",
        sa.Column("description", sa.String(4000), nullable=False, server_default=""),
    )
    op.add_column(
        "pta_operation", sa.Column("weight_basis_points", sa.Integer(), nullable=True)
    )
    op.add_column(
        "pta_operation",
        sa.Column("manual_progress_basis_points", sa.Integer(), nullable=True),
    )
    op.add_column("pta_operation", sa.Column("planned_start", sa.Date(), nullable=True))
    op.add_column("pta_operation", sa.Column("planned_end", sa.Date(), nullable=True))
    op.create_check_constraint(
        "operation_weight_allowed",
        "pta_operation",
        "weight_basis_points IS NULL OR weight_basis_points BETWEEN 0 AND 10000",
    )
    op.create_check_constraint(
        "operation_progress_allowed",
        "pta_operation",
        "manual_progress_basis_points IS NULL OR "
        "manual_progress_basis_points BETWEEN 0 AND 10000",
    )
    op.create_check_constraint(
        "operation_dates_ordered",
        "pta_operation",
        "planned_start IS NULL OR planned_end IS NULL OR planned_end >= planned_start",
    )
    op.drop_constraint(
        "operation_completion_has_amount", "pta_operation", type_="check"
    )
    op.create_unique_constraint(
        "operation_activity_identity",
        "pta_operation",
        ["context_id", "activity_id", "id"],
    )
    op.create_table(
        "pta_subtask",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("task_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.String(4000), nullable=False, server_default=""),
        sa.Column("allocation", sa.BigInteger(), nullable=False),
        sa.Column("weight_basis_points", sa.Integer(), nullable=True),
        sa.Column("planned_start", sa.Date(), nullable=True),
        sa.Column("planned_end", sa.Date(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "creator_id", sa.String(36), sa.ForeignKey("auth_user.id"), nullable=False
        ),
        sa.Column(
            "updated_by_id",
            sa.String(36),
            sa.ForeignKey("auth_user.id"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("removed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "removed_by_id", sa.String(36), sa.ForeignKey("auth_user.id"), nullable=True
        ),
        sa.Column("execution_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "execution_completed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
        sa.Column("actual_spent", sa.BigInteger(), nullable=True),
        sa.Column(
            "execution_observation", sa.String(4000), nullable=False, server_default=""
        ),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id", "task_id"],
            [
                "pta_operation.context_id",
                "pta_operation.activity_id",
                "pta_operation.id",
            ],
        ),
        sa.UniqueConstraint("context_id", "id"),
        sa.CheckConstraint("allocation > 0", name="subtask_allocation_positive"),
        sa.CheckConstraint("position > 0", name="subtask_position_positive"),
        sa.CheckConstraint(
            "weight_basis_points IS NULL OR weight_basis_points BETWEEN 0 AND 10000",
            name="subtask_weight_allowed",
        ),
        sa.CheckConstraint(
            "planned_end IS NULL OR planned_start IS NULL OR "
            "planned_end >= planned_start",
            name="subtask_dates_ordered",
        ),
        sa.CheckConstraint(
            "actual_spent IS NULL OR actual_spent >= 0",
            name="subtask_actual_spent_nonnegative",
        ),
        sa.CheckConstraint(
            "execution_started_at IS NOT NULL OR "
            "(execution_completed=false AND actual_spent IS NULL "
            "AND execution_observation='')",
            name="subtask_execution_started_before_facts",
        ),
    )
    op.create_index(
        "subtask_current_position",
        "pta_subtask",
        ["task_id", "position"],
        unique=True,
        postgresql_where=sa.text("removed_at IS NULL"),
    )


def downgrade() -> None:
    connection = op.get_bind()
    hierarchy_used = connection.scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM pta_subtask) OR EXISTS ("
            "SELECT 1 FROM pta_operation WHERE description <> '' "
            "OR weight_basis_points IS NOT NULL "
            "OR manual_progress_basis_points IS NOT NULL "
            "OR planned_start IS NOT NULL OR planned_end IS NOT NULL "
            "OR (execution_completed AND actual_spent IS NULL))"
        )
    )
    if hierarchy_used:
        raise RuntimeError("Refusing to discard task hierarchy history")
    op.drop_table("pta_subtask")
    op.drop_constraint("operation_activity_identity", "pta_operation", type_="unique")
    op.create_check_constraint(
        "operation_completion_has_amount",
        "pta_operation",
        "execution_completed=false OR actual_spent IS NOT NULL",
    )
    op.drop_constraint("operation_dates_ordered", "pta_operation", type_="check")
    op.drop_constraint("operation_progress_allowed", "pta_operation", type_="check")
    op.drop_constraint("operation_weight_allowed", "pta_operation", type_="check")
    op.drop_column("pta_operation", "planned_end")
    op.drop_column("pta_operation", "planned_start")
    op.drop_column("pta_operation", "manual_progress_basis_points")
    op.drop_column("pta_operation", "weight_basis_points")
    op.drop_column("pta_operation", "description")
