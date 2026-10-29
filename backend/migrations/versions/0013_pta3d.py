"""PTA-3D external virement confirmation.

Revision ID: 0013_pta3d
Revises: 0012_pta3c
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0013_pta3d"
down_revision: str | None = "0012_pta3c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pta_virement_confirmation",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("transfer_date", sa.Date(), nullable=False),
        sa.Column("note", sa.String(4000)),
        sa.Column("actor_id", sa.String(36), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("correction_reason", sa.String(4000)),
        sa.ForeignKeyConstraint(["actor_id"], ["auth_user.id"]),
        sa.ForeignKeyConstraint(
            ["activity_id", "request_id"],
            ["pta_virement_request.activity_id", "pta_virement_request.id"],
        ),
        sa.UniqueConstraint(
            "request_id", "revision", name="virement_confirmation_revision"
        ),
        sa.CheckConstraint(
            "revision > 0", name="virement_confirmation_revision_positive"
        ),
        sa.CheckConstraint(
            "amount > 0", name="virement_confirmation_amount_positive"
        ),
        sa.CheckConstraint(
            "(revision=1 AND correction_reason IS NULL) OR "
            "(revision>1 AND correction_reason IS NOT NULL AND "
            "length(btrim(correction_reason)) BETWEEN 1 AND 4000)",
            name="virement_confirmation_correction_reason",
        ),
    )
    op.execute("""
    CREATE FUNCTION pta_preserve_virement_confirmation() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      expected_amount bigint; latest_revision integer;
      approved_at timestamptz; latest_recorded_at timestamptz;
    BEGIN
      IF TG_OP<>'INSERT' THEN
        RAISE EXCEPTION 'Virement confirmations are immutable';
      END IF;
      SELECT d.amount, COALESCE(MAX(c.revision),0), vd.decided_at,
             MAX(c.recorded_at)
        INTO expected_amount,latest_revision,approved_at,latest_recorded_at
        FROM pta_virement_request v
        JOIN pta_disbursement_request d ON d.id=v.disbursement_request_id
        JOIN pta_virement_decision vd ON vd.request_id=v.id
          AND vd.stage='validator' AND vd.outcome='approved'
        LEFT JOIN pta_virement_confirmation c ON c.request_id=v.id
       WHERE v.id=NEW.request_id AND v.activity_id=NEW.activity_id
         AND v.state='approved'
       GROUP BY d.amount,vd.decided_at;
      IF expected_amount IS NULL OR NEW.amount<>expected_amount
         OR NEW.revision<>latest_revision+1
         OR NEW.recorded_at<=COALESCE(latest_recorded_at,approved_at)
         OR NEW.transfer_date>(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date THEN
        RAISE EXCEPTION 'Invalid virement confirmation';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER virement_confirmation_immutable
      BEFORE INSERT OR UPDATE OR DELETE ON pta_virement_confirmation
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_virement_confirmation();
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pta_virement_confirmation)
         OR EXISTS (SELECT 1 FROM auth_audit
                     WHERE action LIKE 'virement_confirmation.%') THEN
        RAISE EXCEPTION 'Refusing destructive PTA-3D downgrade';
      END IF;
    END $$;
    """)
    op.execute(
        "DROP TRIGGER virement_confirmation_immutable "
        "ON pta_virement_confirmation"
    )
    op.execute("DROP FUNCTION pta_preserve_virement_confirmation()")
    op.drop_table("pta_virement_confirmation")
