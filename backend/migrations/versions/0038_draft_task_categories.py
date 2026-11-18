"""Allow a Task Category to remain empty until submission."""

from collections.abc import Sequence

from alembic import op

revision: str = "0038_draft_task_categories"
down_revision: str | None = "0037_transfer_task_dates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("pta_operation", "type_id", nullable=True)


def downgrade() -> None:
    connection = op.get_bind()
    if connection.exec_driver_sql(
        "SELECT EXISTS (SELECT 1 FROM pta_operation WHERE type_id IS NULL)"
    ).scalar():
        raise RuntimeError("Refusing to discard incomplete Task Categories")
    op.alter_column("pta_operation", "type_id", nullable=False)
