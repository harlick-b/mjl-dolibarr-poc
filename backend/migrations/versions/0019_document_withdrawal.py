"""PTA-7B Activity attachment withdrawal and linked correction.

Revision ID: 0019_pta7b
Revises: 0018_pta7a
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0019_pta7b"
down_revision: str | None = "0018_pta7a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pta_activity_document_withdrawal",
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("pta_activity_document.id"),
            primary_key=True,
        ),
        sa.Column(
            "replacement_document_id",
            sa.String(36),
            sa.ForeignKey("pta_activity_document.id"),
        ),
        sa.Column("reason", sa.String(4000), nullable=False),
        sa.Column(
            "withdrawn_by_id",
            sa.String(36),
            sa.ForeignKey("auth_user.id"),
            nullable=False,
        ),
        sa.Column("withdrawn_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "length(btrim(reason)) BETWEEN 1 AND 4000",
            name="document_withdrawal_reason",
        ),
        sa.CheckConstraint(
            "replacement_document_id IS NULL OR replacement_document_id <> document_id",
            name="document_withdrawal_not_self",
        ),
    )
    op.execute(r"""
    CREATE FUNCTION pta_validate_activity_document_withdrawal() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE
      source_activity text;
      source_uploaded timestamptz;
      replacement_activity text;
      replacement_uploaded timestamptz;
    BEGIN
      SELECT activity_id,uploaded_at INTO source_activity,source_uploaded
        FROM pta_activity_document WHERE id=NEW.document_id;
      IF source_activity IS NULL THEN
        RAISE EXCEPTION 'Invalid Activity document withdrawal';
      END IF;
      IF NEW.replacement_document_id IS NOT NULL THEN
        SELECT activity_id,uploaded_at
          INTO replacement_activity,replacement_uploaded
          FROM pta_activity_document
          WHERE id=NEW.replacement_document_id;
        IF replacement_activity IS DISTINCT FROM source_activity
           OR replacement_uploaded <= source_uploaded
           OR EXISTS (SELECT 1 FROM pta_activity_document_withdrawal w
                      WHERE w.document_id=NEW.replacement_document_id) THEN
          RAISE EXCEPTION 'Invalid Activity document replacement';
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER activity_document_withdrawal_valid
      BEFORE INSERT ON pta_activity_document_withdrawal
      FOR EACH ROW EXECUTE FUNCTION pta_validate_activity_document_withdrawal();
    CREATE TRIGGER activity_document_withdrawal_immutable
      BEFORE UPDATE OR DELETE ON pta_activity_document_withdrawal
      FOR EACH ROW EXECUTE FUNCTION pta_reject_immutable();
    """)


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(
        sa.text("SELECT count(*) FROM pta_activity_document_withdrawal")
    ):
        raise RuntimeError("Refusing to discard Activity document withdrawals")
    op.execute(
        "DROP TRIGGER activity_document_withdrawal_immutable "
        "ON pta_activity_document_withdrawal"
    )
    op.execute(
        "DROP TRIGGER activity_document_withdrawal_valid "
        "ON pta_activity_document_withdrawal"
    )
    op.execute("DROP FUNCTION pta_validate_activity_document_withdrawal()")
    op.drop_table("pta_activity_document_withdrawal")
