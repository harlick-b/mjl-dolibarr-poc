# ruff: noqa: E501
"""PTA-3F terminal Activity closure.

Revision ID: 0015_pta3f
Revises: 0014_pta3e
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0015_pta3f"
down_revision: str | None = "0014_pta3e"
branch_labels = None
depends_on = None


STATE = (
    "state IN ('draft','amendment_draft','submitted','prevalidated',"
    "'returned_supervisor','returned_validator','approved','withdrawn','closed')"
)
POINTERS = (
    "(state='draft' AND current_revision_id IS NULL AND approved_revision_id IS NULL) OR "
    "(state='amendment_draft' AND current_revision_id=approved_revision_id AND approved_revision_id IS NOT NULL) OR "
    "(state IN ('submitted','prevalidated','returned_supervisor','returned_validator') AND current_revision_id IS NOT NULL AND ((amendment_id IS NULL AND withdrawal_id IS NULL AND transfer_id IS NULL AND approved_revision_id IS NULL) OR (withdrawal_id IS NOT NULL AND amendment_id IS NULL AND transfer_id IS NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id) OR (amendment_id IS NOT NULL AND withdrawal_id IS NULL AND transfer_id IS NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id) OR (transfer_id IS NOT NULL AND amendment_id IS NULL AND withdrawal_id IS NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id))) OR "
    "(state IN ('approved','closed') AND current_revision_id IS NOT NULL AND approved_revision_id=current_revision_id) OR "
    "(state='withdrawn' AND current_revision_id IS NOT NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id AND withdrawal_id IS NOT NULL)"
)
AMENDMENT = (
    "(amendment_id IS NULL AND amendment_reason IS NULL AND (approved_revision_id IS NULL OR state IN ('approved','withdrawn','closed') OR withdrawal_id IS NOT NULL OR transfer_id IS NOT NULL)) OR "
    "(amendment_id IS NOT NULL AND withdrawal_id IS NULL AND transfer_id IS NULL AND amendment_reason IS NOT NULL AND length(btrim(amendment_reason)) BETWEEN 1 AND 4000 AND approved_revision_id IS NOT NULL AND state<>'approved')"
)


def upgrade() -> None:
    op.add_column("pta_activity", sa.Column("closed_at", sa.DateTime(timezone=True)))
    op.add_column("pta_activity", sa.Column("closed_by_id", sa.String(36)))
    op.create_foreign_key(
        "activity_closed_by_user", "pta_activity", "auth_user", ["closed_by_id"], ["id"]
    )
    for name in (
        "activity_state_allowed",
        "activity_revision_pointer_state",
        "activity_amendment_state",
    ):
        op.drop_constraint(name, "pta_activity", type_="check")
    op.create_check_constraint("activity_state_allowed", "pta_activity", STATE)
    op.create_check_constraint(
        "activity_revision_pointer_state", "pta_activity", POINTERS
    )
    op.create_check_constraint("activity_amendment_state", "pta_activity", AMENDMENT)
    op.create_check_constraint(
        "activity_closure_facts",
        "pta_activity",
        "(state='closed' AND closed_at IS NOT NULL AND closed_by_id IS NOT NULL) OR (state<>'closed' AND closed_at IS NULL AND closed_by_id IS NULL)",
    )
    op.execute(r"""
    CREATE FUNCTION pta_validate_activity_closure() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      operation_count integer; snapshot_count integer; spent bigint;
      source_id varchar(36); source_amount bigint; virement_id varchar(36);
      latest_confirmation_id varchar(36); confirmed_amount bigint; returned bigint;
    BEGIN
      IF OLD.state='closed' AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Closed Activity is immutable';
      END IF;
      IF NEW.state='closed' AND OLD.state<>'closed' THEN
        IF OLD.state<>'approved' OR NEW.closed_at IS NULL OR NEW.closed_by_id IS NULL
           OR NEW.current_revision_id<>NEW.approved_revision_id
           OR NEW.amendment_id IS NOT NULL OR NEW.withdrawal_id IS NOT NULL
           OR NEW.transfer_id IS NOT NULL
           OR NOT EXISTS (SELECT 1 FROM pta_project p
                           WHERE p.id=NEW.request_project_id AND p.state='active') THEN
          RAISE EXCEPTION 'Invalid Activity closure';
        END IF;
        SELECT count(*),sum(o.actual_spent) INTO operation_count,spent
          FROM pta_operation o WHERE o.activity_id=NEW.id AND o.removed_at IS NULL
           AND o.execution_started_at IS NOT NULL AND o.execution_completed
           AND o.actual_spent IS NOT NULL;
        SELECT jsonb_array_length(r.snapshot->'operations') INTO snapshot_count
          FROM pta_activity_revision r WHERE r.id=NEW.approved_revision_id
           AND r.activity_id=NEW.id;
        IF operation_count=0 OR operation_count<>snapshot_count OR spent<=0
           OR spent>NEW.allocation OR EXISTS (
             SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.id
              AND o.removed_at IS NULL AND (o.execution_started_at IS NULL
                OR NOT o.execution_completed OR o.actual_spent IS NULL)
           ) OR EXISTS (
             SELECT 1 FROM pta_activity_revision r,
               jsonb_array_elements(r.snapshot->'operations') fact
              WHERE r.id=NEW.approved_revision_id AND NOT EXISTS (
                SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.id
                 AND o.removed_at IS NULL AND o.id=fact->>'id')
           ) OR EXISTS (
             SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.id
              AND o.removed_at IS NULL AND NOT EXISTS (
                SELECT 1 FROM pta_activity_revision r,
                  jsonb_array_elements(r.snapshot->'operations') fact
                 WHERE r.id=NEW.approved_revision_id AND fact->>'id'=o.id)
           ) THEN RAISE EXCEPTION 'Incomplete Activity closure'; END IF;
        SELECT d.id,d.amount INTO source_id,source_amount
          FROM pta_disbursement_request d WHERE d.activity_id=NEW.id
           AND d.state='approved' AND d.approved_revision_id=NEW.approved_revision_id;
        IF source_id IS NULL OR source_amount<>spent THEN
          RAISE EXCEPTION 'Invalid closure disbursement'; END IF;
        SELECT v.id INTO virement_id FROM pta_virement_request v
          WHERE v.activity_id=NEW.id AND v.disbursement_request_id=source_id
            AND v.state='approved';
        SELECT c.id,c.amount INTO latest_confirmation_id,confirmed_amount
          FROM pta_virement_confirmation c
          WHERE c.request_id=virement_id ORDER BY c.revision DESC LIMIT 1;
        IF virement_id IS NULL OR latest_confirmation_id IS NULL
           OR confirmed_amount<>spent THEN
          RAISE EXCEPTION 'Invalid closure virement'; END IF;
        IF NEW.allocation-spent>0 THEN
          SELECT r.amount INTO returned FROM pta_reversement_declaration r
            WHERE r.request_id=virement_id
              AND r.confirmation_id=latest_confirmation_id
            ORDER BY r.revision DESC LIMIT 1;
          IF returned IS NULL OR returned<>NEW.allocation-spent THEN
            RAISE EXCEPTION 'Invalid closure reversement'; END IF;
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER activity_closure_guard BEFORE UPDATE ON pta_activity
      FOR EACH ROW EXECUTE FUNCTION pta_validate_activity_closure();

    CREATE FUNCTION pta_reject_closed_financial_change() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE activity_key varchar(36); BEGIN
      activity_key:=CASE WHEN TG_OP='DELETE' THEN OLD.activity_id ELSE NEW.activity_id END;
      IF EXISTS (SELECT 1 FROM pta_activity a
                  WHERE a.id=activity_key AND a.state='closed') THEN
        RAISE EXCEPTION 'Closed Activity settlement is immutable';
      END IF;
      RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
    END $$;
    CREATE TRIGGER virement_confirmation_closed_guard
      BEFORE INSERT OR UPDATE OR DELETE ON pta_virement_confirmation
      FOR EACH ROW EXECUTE FUNCTION pta_reject_closed_financial_change();
    CREATE TRIGGER reversement_declaration_closed_guard
      BEFORE INSERT OR UPDATE OR DELETE ON pta_reversement_declaration
      FOR EACH ROW EXECUTE FUNCTION pta_reject_closed_financial_change();

    DROP TRIGGER operation_execution_immutable ON pta_operation;
    CREATE OR REPLACE FUNCTION pta_preserve_operation_execution() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE activity_key varchar(36); BEGIN
      activity_key:=CASE WHEN TG_OP='DELETE' THEN OLD.activity_id ELSE NEW.activity_id END;
      IF EXISTS (SELECT 1 FROM pta_activity a WHERE a.id=activity_key AND a.state='closed') THEN
        RAISE EXCEPTION 'Closed Activity Operation is immutable';
      END IF;
      IF TG_OP='INSERT' THEN RETURN NEW; END IF;
      IF TG_OP='DELETE' THEN
        IF OLD.execution_started_at IS NOT NULL THEN RAISE EXCEPTION 'Started Operation cannot be deleted'; END IF;
        RETURN OLD;
      END IF;
      IF OLD.execution_started_at IS NOT NULL AND (NEW.execution_started_at IS DISTINCT FROM OLD.execution_started_at OR (OLD.removed_at IS NULL AND NEW.removed_at IS NOT NULL)) THEN
        RAISE EXCEPTION 'Operation execution start is immutable';
      END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER operation_execution_immutable
      BEFORE INSERT OR UPDATE OR DELETE ON pta_operation
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_operation_execution();
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pta_activity WHERE state='closed' OR closed_at IS NOT NULL OR closed_by_id IS NOT NULL)
         OR EXISTS (SELECT 1 FROM auth_audit WHERE action='activity.closed') THEN
        RAISE EXCEPTION 'Refusing destructive PTA-3F downgrade';
      END IF;
    END $$;
    DROP TRIGGER activity_closure_guard ON pta_activity;
    DROP FUNCTION pta_validate_activity_closure();
    DROP TRIGGER virement_confirmation_closed_guard
      ON pta_virement_confirmation;
    DROP TRIGGER reversement_declaration_closed_guard
      ON pta_reversement_declaration;
    DROP FUNCTION pta_reject_closed_financial_change();
    DROP TRIGGER operation_execution_immutable ON pta_operation;
    CREATE OR REPLACE FUNCTION pta_preserve_operation_execution() RETURNS trigger
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
    op.drop_constraint("activity_closure_facts", "pta_activity", type_="check")
    for name in (
        "activity_state_allowed",
        "activity_revision_pointer_state",
        "activity_amendment_state",
    ):
        op.drop_constraint(name, "pta_activity", type_="check")
    op.create_check_constraint(
        "activity_state_allowed", "pta_activity", STATE.replace(",'closed'", "")
    )
    op.create_check_constraint(
        "activity_revision_pointer_state",
        "pta_activity",
        POINTERS.replace("IN ('approved','closed')", "='approved'"),
    )
    op.create_check_constraint(
        "activity_amendment_state", "pta_activity", AMENDMENT.replace(",'closed'", "")
    )
    op.drop_constraint("activity_closed_by_user", "pta_activity", type_="foreignkey")
    op.drop_column("pta_activity", "closed_by_id")
    op.drop_column("pta_activity", "closed_at")
