"""PTA-9A Partner-bound identities.

Revision ID: 0020_pta9a
Revises: 0019_pta7b
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0020_pta9a"
down_revision: str | None = "0019_pta7b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("auth_user_role_check", "auth_user", type_="check")
    op.add_column("auth_user", sa.Column("partner_id", sa.String(36)))
    op.create_foreign_key(
        "auth_user_partner",
        "auth_user",
        "pta_partner",
        ["partner_id"],
        ["id"],
    )
    op.create_check_constraint(
        "auth_user_role_check",
        "auth_user",
        "role IN ('ADMIN_PLATEFORME','AGENT_SAISIE','AGENT_VERIFICATEUR',"
        "'VALIDATEUR_DEFINITIF','PARTENAIRE')",
    )
    op.create_check_constraint(
        "auth_user_partner_binding",
        "auth_user",
        "(role='PARTENAIRE' AND partner_id IS NOT NULL) OR "
        "(role<>'PARTENAIRE' AND partner_id IS NULL)",
    )
    op.execute("""
        CREATE FUNCTION auth_preserve_partner_binding() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          IF (OLD.role = 'PARTENAIRE' OR NEW.role = 'PARTENAIRE')
             AND (OLD.role IS DISTINCT FROM NEW.role
                  OR OLD.partner_id IS DISTINCT FROM NEW.partner_id) THEN
            RAISE EXCEPTION 'Partner identity bindings are immutable'
              USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END;
        $$;
        CREATE TRIGGER auth_user_partner_immutable
        BEFORE UPDATE OF role, partner_id ON auth_user
        FOR EACH ROW EXECUTE FUNCTION auth_preserve_partner_binding();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER auth_user_partner_immutable ON auth_user")
    op.execute("DROP FUNCTION auth_preserve_partner_binding()")
    connection = op.get_bind()
    if connection.scalar(
        sa.text("SELECT count(*) FROM auth_user WHERE partner_id IS NOT NULL")
    ):
        raise RuntimeError("Refusing to discard Partner identity bindings")
    op.drop_constraint("auth_user_partner_binding", "auth_user", type_="check")
    op.drop_constraint("auth_user_role_check", "auth_user", type_="check")
    op.drop_constraint("auth_user_partner", "auth_user", type_="foreignkey")
    op.drop_column("auth_user", "partner_id")
    op.create_check_constraint(
        "auth_user_role_check",
        "auth_user",
        "role IN ('ADMIN_PLATEFORME','AGENT_SAISIE','AGENT_VERIFICATEUR',"
        "'VALIDATEUR_DEFINITIF')",
    )
