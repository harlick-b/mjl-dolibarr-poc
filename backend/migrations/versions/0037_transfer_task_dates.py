"""Allow reviewed Task and Subtask dates in annual transfers."""

from collections.abc import Sequence
from importlib import import_module

import sqlalchemy as sa
from alembic import op

revision: str = "0037_transfer_task_dates"
down_revision: str | None = "0036_weighted_tasks"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def transfer_function() -> str:
    previous = import_module(
        "migrations.versions.0009_activity_transfer"
    ).transfer_function()
    return previous.replace(
        "NEW.snapshot->'operations' IS DISTINCT FROM base_snap->'operations'",
        "pta_transfer_operations_without_dates(NEW.snapshot->'operations') "
        "IS DISTINCT FROM "
        "pta_transfer_operations_without_dates(base_snap->'operations')",
    ).replace(
        "snap->'operations' IS DISTINCT FROM base_snap->'operations'",
        "pta_transfer_operations_without_dates(snap->'operations') "
        "IS DISTINCT FROM "
        "pta_transfer_operations_without_dates(base_snap->'operations')",
    )


def upgrade() -> None:
    op.execute(
        """
        CREATE FUNCTION pta_transfer_operations_without_dates(operations jsonb)
        RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT AS $$
          SELECT coalesce(
            jsonb_agg(
              (operation - 'planned_start' - 'planned_end' - 'subtasks') ||
              CASE WHEN operation ? 'subtasks' THEN
                jsonb_build_object(
                  'subtasks',
                  coalesce(
                    (
                      SELECT jsonb_agg(
                        child - 'planned_start' - 'planned_end'
                        ORDER BY child_position
                      )
                      FROM jsonb_array_elements(operation->'subtasks')
                        WITH ORDINALITY AS children(child, child_position)
                    ),
                    '[]'::jsonb
                  )
                )
              ELSE '{}'::jsonb END
              ORDER BY operation_position
            ),
            '[]'::jsonb
          )
          FROM jsonb_array_elements(operations)
            WITH ORDINALITY AS rows(operation, operation_position)
        $$
        """
    )
    op.execute(transfer_function())


def downgrade() -> None:
    connection = op.get_bind()
    changed = connection.scalar(
        sa.text(
            """
            SELECT EXISTS (
              SELECT 1
              FROM pta_activity_revision revision
              JOIN pta_activity_revision base
                ON base.id=revision.snapshot->'transfer'->>'base_approved_revision_id'
              WHERE revision.snapshot ? 'transfer'
                AND revision.snapshot->'operations'
                    IS DISTINCT FROM base.snapshot->'operations'
            )
            """
        )
    )
    if changed:
        raise RuntimeError("Refusing to discard reviewed transfer hierarchy dates")
    op.execute(
        import_module("migrations.versions.0009_activity_transfer").transfer_function()
    )
    op.execute("DROP FUNCTION pta_transfer_operations_without_dates(jsonb)")
