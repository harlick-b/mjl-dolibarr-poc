"""Returned financial requests become terminal history (DEC-135)."""

import sqlalchemy as sa
from alembic import op

revision: str = "0021_financial_returns"
down_revision: str | None = "0020_pta9a"
branch_labels = None
depends_on = None


def change_guards(*, returning: bool) -> None:
    # Preserve each predecessor function byte-for-byte apart from this transition.
    for kind in ("disbursement", "virement"):
        definition = op.get_bind().scalar(
            sa.text(f"SELECT pg_get_functiondef('pta_preserve_{kind}()'::regprocedure)")
        )
        old = "OR (OLD.state='returned' AND NEW.state='cancelled')"
        new = "OR false /* Returned requests are terminal (DEC-135). */"
        source, target = (old, new) if returning else (new, old)
        if not definition or definition.count(source) != 1:
            raise RuntimeError(f"Unexpected {kind} transition guard")
        op.execute(definition.replace(source, target))


def indexes(predicate: str) -> None:
    for kind in ("disbursement", "virement"):
        op.drop_index(f"{kind}_one_open_per_activity", table_name=f"pta_{kind}_request")
        op.create_index(
            f"{kind}_one_open_per_activity",
            f"pta_{kind}_request",
            ["activity_id"],
            unique=True,
            postgresql_where=sa.text(predicate),
        )


def upgrade() -> None:
    indexes("state NOT IN ('returned', 'cancelled')")
    change_guards(returning=True)


def downgrade() -> None:
    for kind in ("disbursement", "virement"):
        if op.get_bind().scalar(
            sa.text(
                f"SELECT EXISTS (SELECT 1 FROM pta_{kind}_request "
                "WHERE state <> 'cancelled' GROUP BY activity_id HAVING count(*) > 1)"
            )
        ):
            raise RuntimeError(
                "Refusing financial-return downgrade: retained request history"
            )
    indexes("state <> 'cancelled'")
    change_guards(returning=False)
