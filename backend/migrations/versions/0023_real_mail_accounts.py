"""Real local email identities and optional names for existing accounts."""

import sqlalchemy as sa
from alembic import op

revision = "0023_real_mail_accounts"
down_revision = "0022_partner_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auth_user", sa.Column("full_name", sa.String(200), nullable=True))
    op.execute("""
    DO $$ DECLARE old_name text; BEGIN
      SELECT conname INTO old_name
      FROM pg_constraint
      WHERE conrelid = 'auth_user'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%example%test%';
      IF old_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE auth_user DROP CONSTRAINT %I', old_name);
      END IF;
    END $$;
    """)
    op.create_check_constraint(
        "auth_user_email_format",
        "auth_user",
        "email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'",
    )


def downgrade() -> None:
    connection = op.get_bind()
    if connection.scalar(
        sa.text(
            "SELECT count(*) FROM auth_user "
            "WHERE email !~ '^[a-z0-9][a-z0-9._+-]{0,63}@example[.]test$'"
        )
    ):
        raise RuntimeError("Refusing to discard real-account identity data")
    op.drop_constraint("auth_user_email_format", "auth_user")
    op.create_check_constraint(
        "auth_user_email_synthetic",
        "auth_user",
        "email ~ '^[a-z0-9][a-z0-9._+-]{0,63}@example[.]test$'",
    )
    op.drop_column("auth_user", "full_name")
