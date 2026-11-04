"""PTA-3E reversement declaration.

Revision ID: 0014_pta3e
Revises: 0013_pta3d
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0014_pta3e"
down_revision: str | None = "0013_pta3d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pta_reversement_declaration",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("confirmation_id", sa.String(36), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
        sa.Column("return_date", sa.Date(), nullable=False),
        sa.Column("note", sa.String(4000)),
        sa.Column("actor_id", sa.String(36), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("correction_reason", sa.String(4000)),
        sa.ForeignKeyConstraint(["actor_id"], ["auth_user.id"]),
        sa.ForeignKeyConstraint(["confirmation_id"], ["pta_virement_confirmation.id"]),
        sa.ForeignKeyConstraint(
            ["activity_id", "request_id"],
            ["pta_virement_request.activity_id", "pta_virement_request.id"],
        ),
        sa.UniqueConstraint(
            "request_id", "revision", name="reversement_declaration_revision"
        ),
        sa.CheckConstraint(
            "revision > 0", name="reversement_declaration_revision_positive"
        ),
        sa.CheckConstraint(
            "amount > 0", name="reversement_declaration_amount_positive"
        ),
        sa.CheckConstraint(
            "(revision=1 AND correction_reason IS NULL) OR "
            "(revision>1 AND correction_reason IS NOT NULL AND "
            "length(btrim(correction_reason)) BETWEEN 1 AND 4000)",
            name="reversement_declaration_correction_reason",
        ),
    )
    op.execute("""
    CREATE FUNCTION pta_preserve_reversement_declaration() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      expected_amount bigint; confirmation_date date;
      confirmation_recorded_at timestamptz; latest_revision integer;
      latest_recorded_at timestamptz; previous_confirmation_id varchar(36);
    BEGIN
      IF TG_OP<>'INSERT' THEN
        RAISE EXCEPTION 'Reversement declarations are immutable';
      END IF;
      SELECT ((d.snapshot->>'allocation')::bigint - d.amount),
             c.transfer_date,c.recorded_at,COALESCE(MAX(r.revision),0),
             MAX(r.recorded_at),MAX(r.confirmation_id)
        INTO expected_amount,confirmation_date,confirmation_recorded_at,
             latest_revision,latest_recorded_at,previous_confirmation_id
        FROM pta_virement_request v
        JOIN pta_disbursement_request d ON d.id=v.disbursement_request_id
          AND d.activity_id=v.activity_id AND d.state='approved'
        JOIN pta_virement_confirmation c ON c.id=NEW.confirmation_id
          AND c.request_id=v.id AND c.activity_id=v.activity_id
        LEFT JOIN pta_reversement_declaration r ON r.request_id=v.id
       WHERE v.id=NEW.request_id AND v.activity_id=NEW.activity_id
         AND v.state='approved'
         AND c.revision=(SELECT MAX(latest.revision)
                           FROM pta_virement_confirmation latest
                          WHERE latest.request_id=v.id)
       GROUP BY d.snapshot,d.amount,c.transfer_date,c.recorded_at;
      IF expected_amount IS NULL OR expected_amount<=0
         OR NEW.amount<>expected_amount
         OR NEW.revision<>latest_revision+1
         OR (latest_revision>0 AND NEW.confirmation_id<>previous_confirmation_id)
         OR NEW.return_date<confirmation_date
         OR NEW.return_date>(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date
         OR NEW.recorded_at<=COALESCE(latest_recorded_at,confirmation_recorded_at) THEN
        RAISE EXCEPTION 'Invalid reversement declaration';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER reversement_declaration_immutable
      BEFORE INSERT OR UPDATE OR DELETE ON pta_reversement_declaration
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_reversement_declaration();

    CREATE OR REPLACE FUNCTION pta_preserve_virement_confirmation()
    RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
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
         OR NEW.transfer_date>(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date
         OR EXISTS (SELECT 1 FROM pta_reversement_declaration r
                     WHERE r.request_id=NEW.request_id) THEN
        RAISE EXCEPTION 'Invalid virement confirmation';
      END IF;
      RETURN NEW;
    END $$;
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pta_reversement_declaration)
         OR EXISTS (SELECT 1 FROM auth_audit
                     WHERE action LIKE 'reversement.%') THEN
        RAISE EXCEPTION 'Refusing destructive PTA-3E downgrade';
      END IF;
    END $$;
    CREATE OR REPLACE FUNCTION pta_preserve_virement_confirmation()
    RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
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
         OR NEW.transfer_date>
              (clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date THEN
        RAISE EXCEPTION 'Invalid virement confirmation';
      END IF;
      RETURN NEW;
    END $$;
    """)
    op.execute(
        "DROP TRIGGER reversement_declaration_immutable ON pta_reversement_declaration"
    )
    op.execute("DROP FUNCTION pta_preserve_reversement_declaration()")
    op.drop_table("pta_reversement_declaration")
