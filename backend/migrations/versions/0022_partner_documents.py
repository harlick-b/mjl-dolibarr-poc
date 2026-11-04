"""Explicit Partner sharing without changing immutable attachment contents."""

import sqlalchemy as sa
from alembic import op

revision = "0022_partner_documents"
down_revision = "0021_financial_returns"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "pta_activity_document",
        sa.Column(
            "partner_shared", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.add_column(
        "pta_activity_document",
        sa.Column("sharing_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_check_constraint(
        "document_sharing_version", "pta_activity_document", "sharing_version >= 0"
    )
    op.execute("""
    CREATE OR REPLACE FUNCTION pta_preserve_activity_document() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Activity documents cannot be deleted';
      END IF;
      IF (to_jsonb(NEW) - ARRAY['partner_shared','sharing_version'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['partner_shared','sharing_version'])
         OR NEW.sharing_version <> OLD.sharing_version + 1
         OR NEW.partner_shared IS NOT DISTINCT FROM OLD.partner_shared THEN
        RAISE EXCEPTION 'Only versioned sharing changes are allowed';
      END IF;
      IF NEW.partner_shared AND (
        EXISTS (SELECT 1 FROM pta_activity_document_withdrawal WHERE document_id=NEW.id)
        OR NOT EXISTS (SELECT 1 FROM pta_activity a
          JOIN pta_annual y ON y.id=a.pta_id
          JOIN pta_project p ON p.id=y.project_id
          JOIN pta_partner partner ON partner.id=p.partner_id
          WHERE a.id=NEW.activity_id AND a.approved_revision_id IS NOT NULL
            AND a.state <> 'withdrawn' AND partner.active)
      ) THEN
        RAISE EXCEPTION 'Document is not eligible for sharing';
      END IF;
      RETURN NEW;
    END $$;
    """)


def downgrade() -> None:
    if op.get_bind().scalar(
        sa.text(
            "SELECT count(*) FROM pta_activity_document "
            "WHERE sharing_version <> 0 OR partner_shared"
        )
    ):
        raise RuntimeError("Refusing to discard attachment sharing history")
    op.execute("""
    CREATE OR REPLACE FUNCTION pta_preserve_activity_document() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Activity documents are append-only';
    END $$;
    """)
    op.drop_constraint("document_sharing_version", "pta_activity_document")
    op.drop_column("pta_activity_document", "sharing_version")
    op.drop_column("pta_activity_document", "partner_shared")
