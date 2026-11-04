"""PTA-3A Operation execution and actual spending.

Revision ID: 0010_pta3a
Revises: 0009_pta2b2b
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0010_pta3a"
down_revision: str | None = "0009_pta2b2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pta_operation", sa.Column("execution_started_at", sa.DateTime(timezone=True))
    )
    op.add_column(
        "pta_operation",
        sa.Column(
            "execution_completed", sa.Boolean(), nullable=False, server_default="false"
        ),
    )
    op.add_column("pta_operation", sa.Column("actual_spent", sa.BigInteger()))
    op.add_column(
        "pta_operation",
        sa.Column(
            "execution_observation",
            sa.String(4000),
            nullable=False,
            server_default="",
        ),
    )
    op.create_check_constraint(
        "operation_actual_spent_nonnegative",
        "pta_operation",
        "actual_spent IS NULL OR actual_spent >= 0",
    )
    op.create_check_constraint(
        "operation_execution_started_before_facts",
        "pta_operation",
        "execution_started_at IS NOT NULL OR "
        "(execution_completed=false AND actual_spent IS NULL "
        "AND execution_observation='')",
    )
    op.create_check_constraint(
        "operation_completion_has_amount",
        "pta_operation",
        "execution_completed=false OR actual_spent IS NOT NULL",
    )
    op.execute("""
    CREATE FUNCTION pta_preserve_operation_execution() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP='DELETE' THEN
        IF OLD.execution_started_at IS NOT NULL THEN
          RAISE EXCEPTION 'Started Operation cannot be deleted';
        END IF;
        RETURN OLD;
      END IF;
      IF OLD.execution_started_at IS NOT NULL AND (
           NEW.execution_started_at IS DISTINCT FROM OLD.execution_started_at
        OR (OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL)
      ) THEN
        RAISE EXCEPTION 'Operation execution start is immutable';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER operation_execution_immutable
      BEFORE UPDATE OR DELETE ON pta_operation
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_operation_execution();
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pta_operation
        WHERE execution_started_at IS NOT NULL OR execution_completed
           OR actual_spent IS NOT NULL OR execution_observation<>''
      ) OR EXISTS (
        SELECT 1 FROM auth_audit WHERE action LIKE 'operation.execution_%'
      ) THEN
        RAISE EXCEPTION 'Refusing destructive PTA-3A downgrade';
      END IF;
    END $$;
    """)
    op.execute("DROP TRIGGER operation_execution_immutable ON pta_operation")
    op.execute("DROP FUNCTION pta_preserve_operation_execution()")
    op.drop_constraint(
        "operation_completion_has_amount", "pta_operation", type_="check"
    )
    op.drop_constraint(
        "operation_execution_started_before_facts", "pta_operation", type_="check"
    )
    op.drop_constraint(
        "operation_actual_spent_nonnegative", "pta_operation", type_="check"
    )
    op.drop_column("pta_operation", "execution_observation")
    op.drop_column("pta_operation", "actual_spent")
    op.drop_column("pta_operation", "execution_completed")
    op.drop_column("pta_operation", "execution_started_at")
