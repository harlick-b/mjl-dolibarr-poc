"""Synthetic A1 identity, credentials, sessions and security evidence only."""

import sqlalchemy as sa
from alembic import op

revision = "0002_a1"
down_revision = "0001_foundation"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "auth_user",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("role", sa.String(32), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("version", sa.Integer, nullable=False),
        sa.CheckConstraint(
            "role IN ('ADMIN_PLATEFORME','AGENT_SAISIE',"
            "'AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF')"
        ),
        sa.CheckConstraint("state IN ('pending','active','inactive')"),
        sa.CheckConstraint("state = 'pending' OR password_hash IS NOT NULL"),
        sa.CheckConstraint("email = lower(email)"),
        sa.CheckConstraint("email ~ '^[a-z0-9][a-z0-9._+-]{0,63}@example[.]test$'"),
    )
    op.create_table(
        "auth_invitation",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("auth_user.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("verifier", sa.String(64), nullable=False),
        sa.Column("generation", sa.String(36), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.CheckConstraint("state IN ('prepared','delivered','consumed','revoked')"),
    )
    op.create_table(
        "auth_context",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("csrf", sa.String(64), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("auth_user.id")),
        sa.Column("proof", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_activity", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("state IN ('anonymous','pending','verified','revoked')"),
    )
    op.create_table(
        "auth_otp",
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("auth_user.id"), primary_key=True
        ),
        sa.Column(
            "context_id",
            sa.String(64),
            sa.ForeignKey("auth_context.id"),
            nullable=False,
        ),
        sa.Column("generation", sa.String(36), nullable=False),
        sa.Column("verifier", sa.String(64), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer, nullable=False),
        sa.Column("resends", sa.Integer, nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.CheckConstraint("state IN ('prepared','delivered','consumed')"),
        sa.CheckConstraint("attempts >= 0 AND resends >= 0"),
    )
    op.create_table(
        "auth_abuse",
        sa.Column("id", sa.String(64), primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer, nullable=False),
        sa.CheckConstraint("count >= 0"),
    )
    op.create_table(
        "auth_audit",
        sa.Column("id", sa.BigInteger, primary_key=True, autoincrement=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("action", sa.String(48), nullable=False),
        sa.Column("actor", sa.String(80), nullable=False),
        sa.Column("target", sa.String(64)),
        sa.Column("outcome", sa.String(32), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
    )
    op.create_index(
        "auth_bootstrap_once",
        "auth_audit",
        ["action"],
        unique=True,
        postgresql_where=sa.text("action = 'bootstrap'"),
    )
    op.execute("""CREATE FUNCTION auth_audit_immutable() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
        RAISE EXCEPTION 'Security audit is append-only'; END $$""")
    op.execute("""CREATE TRIGGER auth_audit_immutable BEFORE UPDATE OR DELETE
        ON auth_audit FOR EACH ROW EXECUTE FUNCTION auth_audit_immutable()""")


def downgrade():
    op.drop_table("auth_invitation")
    op.drop_table("auth_otp")
    op.drop_table("auth_context")
    op.drop_table("auth_abuse")
    op.drop_table("auth_user")
    op.drop_table("auth_audit")
    op.execute("DROP FUNCTION auth_audit_immutable()")
