"""PTA-6A optional Activity attachments.

Revision ID: 0017_pta6a
Revises: 0016_pta5
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0017_pta6a"
down_revision: str | None = "0016_pta5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pta_activity_document",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=False),
        sa.Column("media_type", sa.String(32), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column("content", sa.LargeBinary(), nullable=False),
        sa.Column(
            "uploaded_by_id",
            sa.String(36),
            sa.ForeignKey("auth_user.id"),
            nullable=False,
        ),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.CheckConstraint(
            "byte_size > 0 AND byte_size <= 20971520", name="document_size"
        ),
        sa.CheckConstraint(
            "media_type IN ('application/pdf','image/jpeg','image/png')",
            name="document_media_type",
        ),
    )
    op.create_index(
        "document_activity_uploaded",
        "pta_activity_document",
        ["activity_id", "uploaded_at", "id"],
    )
    op.execute("""
    CREATE FUNCTION pta_preserve_activity_document() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      RAISE EXCEPTION 'Activity documents are append-only';
    END $$;
    CREATE TRIGGER activity_document_append_only
      BEFORE UPDATE OR DELETE ON pta_activity_document
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_activity_document();
    """)


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT count(*) FROM pta_activity_document")):
        raise RuntimeError("Refusing to discard Activity documents")
    op.execute("DROP TRIGGER activity_document_append_only ON pta_activity_document")
    op.execute("DROP FUNCTION pta_preserve_activity_document()")
    op.drop_table("pta_activity_document")
