# ruff: noqa: E501
"""PTA-7A validated zero-spending closure.

Revision ID: 0018_pta7a
Revises: 0017_pta6a
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0018_pta7a"
down_revision: str | None = "0017_pta6a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pta_zero_spending_declaration",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("approved_revision_id", sa.String(36), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("reason", sa.String(4000), nullable=False),
        sa.Column("submitter_id", sa.String(36), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.ForeignKeyConstraint(["submitter_id"], ["auth_user.id"]),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.ForeignKeyConstraint(
            ["activity_id", "approved_revision_id"],
            ["pta_activity_revision.activity_id", "pta_activity_revision.id"],
        ),
        sa.UniqueConstraint(
            "activity_id", "id", name="zero_spending_declaration_scope"
        ),
        sa.CheckConstraint(
            "state IN ('submitted','prevalidated','returned','approved')",
            name="zero_spending_state_allowed",
        ),
        sa.CheckConstraint(
            "length(btrim(reason)) BETWEEN 1 AND 4000",
            name="zero_spending_reason_required",
        ),
        sa.CheckConstraint(
            "octet_length(snapshot::text) <= 1048576",
            name="zero_spending_snapshot_bounded",
        ),
    )
    op.create_index(
        "zero_spending_one_current_per_activity",
        "pta_zero_spending_declaration",
        ["activity_id"],
        unique=True,
        postgresql_where=sa.text("state <> 'returned'"),
    )
    op.create_table(
        "pta_zero_spending_decision",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("declaration_id", sa.String(36), nullable=False),
        sa.Column("stage", sa.String(16), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("actor_id", sa.String(36), nullable=False),
        sa.Column("actor_role", sa.String(32), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(4000)),
        sa.Column("prevalidation_decision_id", sa.String(36)),
        sa.ForeignKeyConstraint(["actor_id"], ["auth_user.id"]),
        sa.ForeignKeyConstraint(
            ["activity_id", "declaration_id"],
            [
                "pta_zero_spending_declaration.activity_id",
                "pta_zero_spending_declaration.id",
            ],
        ),
        sa.UniqueConstraint(
            "declaration_id", "id", name="zero_spending_decision_scope"
        ),
        sa.UniqueConstraint(
            "declaration_id", "stage", name="zero_spending_decision_stage"
        ),
        sa.CheckConstraint(
            "stage IN ('supervisor','validator')",
            name="zero_spending_decision_stage_allowed",
        ),
        sa.CheckConstraint(
            "outcome IN ('prevalidated','approved','returned')",
            name="zero_spending_decision_outcome_allowed",
        ),
        sa.CheckConstraint(
            "(stage='supervisor' AND outcome IN ('prevalidated','returned') AND actor_role='AGENT_VERIFICATEUR') OR "
            "(stage='validator' AND outcome IN ('approved','returned') AND actor_role='VALIDATEUR_DEFINITIF')",
            name="zero_spending_decision_role_allowed",
        ),
        sa.CheckConstraint(
            "(outcome='returned' AND reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 4000) OR "
            "(outcome<>'returned' AND reason IS NULL)",
            name="zero_spending_decision_reason",
        ),
        sa.CheckConstraint(
            "(stage='validator' AND outcome='approved' AND prevalidation_decision_id IS NOT NULL) OR "
            "(NOT (stage='validator' AND outcome='approved') AND prevalidation_decision_id IS NULL)",
            name="zero_spending_prevalidation_reference",
        ),
    )
    op.create_foreign_key(
        "zero_spending_prevalidation_same_declaration",
        "pta_zero_spending_decision",
        "pta_zero_spending_decision",
        ["declaration_id", "prevalidation_decision_id"],
        ["declaration_id", "id"],
        use_alter=True,
    )
    op.execute(r"""
    CREATE FUNCTION pta_preserve_zero_spending() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF TG_TABLE_NAME='pta_zero_spending_decision' THEN
        RAISE EXCEPTION 'Zero-spending decisions are immutable';
      END IF;
      IF TG_OP='INSERT' THEN
        IF NEW.state<>'submitted'
           OR jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object'
           OR NEW.snapshot->>'total' IS DISTINCT FROM '0'
           OR jsonb_typeof(NEW.snapshot->'operations') IS DISTINCT FROM 'array'
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'operations') x
             WHERE jsonb_typeof(x) IS DISTINCT FROM 'object'
                OR coalesce(x->>'id','')=''
                OR coalesce(x->>'approved_allocation','') !~ '^[0-9]+$'
                OR x->>'actual_spent' IS DISTINCT FROM '0'
                OR x->>'execution_completed' IS DISTINCT FROM 'true')
           OR (SELECT count(*) FROM jsonb_array_elements(NEW.snapshot->'operations'))
              <> (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(NEW.snapshot->'operations') x)
           OR NOT EXISTS (SELECT 1 FROM pta_activity a
               WHERE a.id=NEW.activity_id AND a.state='approved'
                 AND a.approved_revision_id=NEW.approved_revision_id)
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'operations') x
             WHERE NOT EXISTS (
               SELECT 1 FROM pta_activity_revision r,
                 jsonb_array_elements(r.snapshot->'operations') fact
               WHERE r.id=NEW.approved_revision_id AND r.activity_id=NEW.activity_id
                 AND fact->>'id'=x->>'id'
                 AND fact->>'allocation'=x->>'approved_allocation')
                OR NOT EXISTS (
                  SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.activity_id
                    AND o.id=x->>'id' AND o.removed_at IS NULL
                    AND o.execution_started_at IS NOT NULL
                    AND o.execution_completed AND o.actual_spent=0))
           OR EXISTS (
             SELECT 1 FROM pta_activity_revision r,
               jsonb_array_elements(r.snapshot->'operations') fact
             WHERE r.id=NEW.approved_revision_id AND r.activity_id=NEW.activity_id
               AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'operations') x
                 WHERE x->>'id'=fact->>'id'))
           OR EXISTS (
             SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.activity_id
               AND o.removed_at IS NULL
               AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'operations') x
                 WHERE x->>'id'=o.id)) THEN
          RAISE EXCEPTION 'Invalid initial zero-spending basis';
        END IF;
        RETURN NEW;
      END IF;
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Zero-spending declarations are immutable'; END IF;
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.context_id IS DISTINCT FROM OLD.context_id
         OR NEW.activity_id IS DISTINCT FROM OLD.activity_id
         OR NEW.approved_revision_id IS DISTINCT FROM OLD.approved_revision_id
         OR NEW.snapshot IS DISTINCT FROM OLD.snapshot OR NEW.reason IS DISTINCT FROM OLD.reason
         OR NEW.submitter_id IS DISTINCT FROM OLD.submitter_id
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Zero-spending basis is immutable';
      END IF;
      IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
        (OLD.state='submitted' AND NEW.state IN ('prevalidated','returned')) OR
        (OLD.state='prevalidated' AND NEW.state IN ('approved','returned'))) THEN
        RAISE EXCEPTION 'Invalid zero-spending transition';
      END IF;
      RETURN NEW;
    END $$;
    CREATE FUNCTION pta_validate_zero_spending_state() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      declaration_key text; declaration_state text; supervisors integer;
      validators integer; returns integer; supervisor_actor text; validator_actor text;
    BEGIN
      IF TG_TABLE_NAME='pta_zero_spending_declaration' THEN
        declaration_key := NEW.id;
      ELSE
        declaration_key := NEW.declaration_id;
      END IF;
      SELECT state INTO declaration_state FROM pta_zero_spending_declaration WHERE id=declaration_key;
      IF declaration_state IS NULL THEN RETURN NULL; END IF;
      SELECT count(*) FILTER (WHERE stage='supervisor' AND outcome='prevalidated'),
        count(*) FILTER (WHERE stage='validator' AND outcome='approved'),
        count(*) FILTER (WHERE outcome='returned'),
        max(actor_id) FILTER (WHERE stage='supervisor' AND outcome='prevalidated'),
        max(actor_id) FILTER (WHERE stage='validator')
      INTO supervisors,validators,returns,supervisor_actor,validator_actor
      FROM pta_zero_spending_decision WHERE declaration_id=declaration_key;
      IF (declaration_state='submitted' AND supervisors+validators+returns<>0)
         OR (declaration_state='prevalidated' AND NOT (supervisors=1 AND validators=0 AND returns=0))
         OR (declaration_state='approved' AND NOT (supervisors=1 AND validators=1 AND returns=0 AND supervisor_actor<>validator_actor))
         OR (declaration_state='returned' AND NOT (returns=1 AND validators=0 AND supervisors IN (0,1)))
         OR EXISTS (SELECT 1 FROM pta_zero_spending_decision d JOIN pta_zero_spending_declaration z ON z.id=d.declaration_id
           WHERE d.declaration_id=declaration_key AND d.decided_at<z.submitted_at) THEN
        RAISE EXCEPTION 'Zero-spending state and decisions disagree';
      END IF;
      IF EXISTS (
        SELECT 1 FROM pta_zero_spending_decision validator
        LEFT JOIN pta_zero_spending_decision supervisor
          ON supervisor.declaration_id=validator.declaration_id
         AND supervisor.id=validator.prevalidation_decision_id
         AND supervisor.stage='supervisor' AND supervisor.outcome='prevalidated'
        WHERE validator.declaration_id=declaration_key
          AND validator.stage='validator' AND validator.outcome='approved'
          AND (supervisor.id IS NULL OR supervisor.actor_id=validator.actor_id
               OR supervisor.decided_at>validator.decided_at)
      ) OR EXISTS (
        SELECT 1 FROM pta_zero_spending_decision validator
        LEFT JOIN pta_zero_spending_decision supervisor
          ON supervisor.declaration_id=validator.declaration_id
         AND supervisor.stage='supervisor' AND supervisor.outcome='prevalidated'
        WHERE validator.declaration_id=declaration_key
          AND validator.stage='validator' AND validator.outcome='returned'
          AND (supervisor.id IS NULL OR supervisor.decided_at>validator.decided_at)
      ) THEN
        RAISE EXCEPTION 'Zero-spending state and decisions disagree';
      END IF;
      RETURN NULL;
    END $$;
    CREATE TRIGGER zero_spending_declaration_immutable BEFORE INSERT OR UPDATE OR DELETE
      ON pta_zero_spending_declaration FOR EACH ROW EXECUTE FUNCTION pta_preserve_zero_spending();
    CREATE TRIGGER zero_spending_decision_immutable BEFORE UPDATE OR DELETE
      ON pta_zero_spending_decision FOR EACH ROW EXECUTE FUNCTION pta_preserve_zero_spending();
    CREATE CONSTRAINT TRIGGER zero_spending_declaration_state_consistent AFTER INSERT OR UPDATE
      ON pta_zero_spending_declaration DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pta_validate_zero_spending_state();
    CREATE CONSTRAINT TRIGGER zero_spending_decision_state_consistent AFTER INSERT OR UPDATE
      ON pta_zero_spending_decision DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pta_validate_zero_spending_state();
    """)
    op.execute(r"""
    CREATE OR REPLACE FUNCTION pta_validate_activity_closure() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      operation_count integer; snapshot_count integer; spent bigint;
      source_id varchar(36); source_amount bigint; virement_id varchar(36);
      latest_confirmation_id varchar(36); confirmed_amount bigint; returned bigint;
      zero_id varchar(36);
    BEGIN
      IF OLD.state='closed' AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Closed Activity is immutable';
      END IF;
      IF NEW.state='closed' AND OLD.state<>'closed' THEN
        IF OLD.state<>'approved' OR NEW.closed_at IS NULL OR NEW.closed_by_id IS NULL
           OR NEW.current_revision_id<>NEW.approved_revision_id
           OR NEW.amendment_id IS NOT NULL OR NEW.withdrawal_id IS NOT NULL
           OR NEW.transfer_id IS NOT NULL
           OR NOT EXISTS (SELECT 1 FROM pta_project p WHERE p.id=NEW.request_project_id AND p.state='active') THEN
          RAISE EXCEPTION 'Invalid Activity closure';
        END IF;
        SELECT count(*),sum(o.actual_spent) INTO operation_count,spent
          FROM pta_operation o WHERE o.activity_id=NEW.id AND o.removed_at IS NULL
           AND o.execution_started_at IS NOT NULL AND o.execution_completed
           AND o.actual_spent IS NOT NULL;
        SELECT jsonb_array_length(r.snapshot->'operations') INTO snapshot_count
          FROM pta_activity_revision r WHERE r.id=NEW.approved_revision_id AND r.activity_id=NEW.id;
        IF operation_count=0 OR operation_count<>snapshot_count OR spent<0
           OR spent>NEW.allocation OR EXISTS (
             SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.id AND o.removed_at IS NULL
              AND (o.execution_started_at IS NULL OR NOT o.execution_completed OR o.actual_spent IS NULL)
           ) OR EXISTS (
             SELECT 1 FROM pta_activity_revision r, jsonb_array_elements(r.snapshot->'operations') fact
              WHERE r.id=NEW.approved_revision_id AND NOT EXISTS (
                SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.id AND o.removed_at IS NULL AND o.id=fact->>'id')
           ) OR EXISTS (
             SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.id AND o.removed_at IS NULL AND NOT EXISTS (
                SELECT 1 FROM pta_activity_revision r, jsonb_array_elements(r.snapshot->'operations') fact
                 WHERE r.id=NEW.approved_revision_id AND fact->>'id'=o.id)
           ) THEN RAISE EXCEPTION 'Incomplete Activity closure'; END IF;
        IF spent=0 THEN
          SELECT z.id INTO zero_id FROM pta_zero_spending_declaration z
            WHERE z.activity_id=NEW.id AND z.approved_revision_id=NEW.approved_revision_id
              AND z.state='approved' AND z.snapshot->>'total'='0'
              AND jsonb_array_length(z.snapshot->'operations')=operation_count
              AND (SELECT count(DISTINCT fact->>'id')
                   FROM jsonb_array_elements(z.snapshot->'operations') fact)=operation_count
              AND NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(z.snapshot->'operations') fact
                 WHERE fact->>'actual_spent' IS DISTINCT FROM '0'
                    OR fact->>'execution_completed' IS DISTINCT FROM 'true'
                    OR NOT EXISTS (SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.id
                      AND o.removed_at IS NULL AND o.id=fact->>'id' AND o.actual_spent=0 AND o.execution_completed))
            LIMIT 1;
          IF zero_id IS NULL THEN RAISE EXCEPTION 'Invalid zero-spending closure'; END IF;
          RETURN NEW;
        END IF;
        SELECT d.id,d.amount INTO source_id,source_amount FROM pta_disbursement_request d
          WHERE d.activity_id=NEW.id AND d.state='approved' AND d.approved_revision_id=NEW.approved_revision_id;
        IF source_id IS NULL OR source_amount<>spent THEN RAISE EXCEPTION 'Invalid closure disbursement'; END IF;
        SELECT v.id INTO virement_id FROM pta_virement_request v
          WHERE v.activity_id=NEW.id AND v.disbursement_request_id=source_id AND v.state='approved';
        SELECT c.id,c.amount INTO latest_confirmation_id,confirmed_amount FROM pta_virement_confirmation c
          WHERE c.request_id=virement_id ORDER BY c.revision DESC LIMIT 1;
        IF virement_id IS NULL OR latest_confirmation_id IS NULL OR confirmed_amount<>spent THEN
          RAISE EXCEPTION 'Invalid closure virement'; END IF;
        IF NEW.allocation-spent>0 THEN
          SELECT r.amount INTO returned FROM pta_reversement_declaration r
            WHERE r.request_id=virement_id AND r.confirmation_id=latest_confirmation_id
            ORDER BY r.revision DESC LIMIT 1;
          IF returned IS NULL OR returned<>NEW.allocation-spent THEN RAISE EXCEPTION 'Invalid closure reversement'; END IF;
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pta_zero_spending_declaration)
         OR EXISTS (SELECT 1 FROM pta_zero_spending_decision)
         OR EXISTS (SELECT 1 FROM auth_audit WHERE action LIKE 'zero_spending.%') THEN
        RAISE EXCEPTION 'Refusing destructive PTA-7A downgrade';
      END IF;
    END $$;
    """)
    op.execute(r"""
    CREATE OR REPLACE FUNCTION pta_validate_activity_closure() RETURNS trigger
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
           OR NOT EXISTS (SELECT 1 FROM pta_project p WHERE p.id=NEW.request_project_id AND p.state='active') THEN
          RAISE EXCEPTION 'Invalid Activity closure';
        END IF;
        SELECT count(*),sum(o.actual_spent) INTO operation_count,spent
          FROM pta_operation o WHERE o.activity_id=NEW.id AND o.removed_at IS NULL
           AND o.execution_started_at IS NOT NULL AND o.execution_completed AND o.actual_spent IS NOT NULL;
        SELECT jsonb_array_length(r.snapshot->'operations') INTO snapshot_count
          FROM pta_activity_revision r WHERE r.id=NEW.approved_revision_id AND r.activity_id=NEW.id;
        IF operation_count=0 OR operation_count<>snapshot_count OR spent<=0 OR spent>NEW.allocation
           OR EXISTS (SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.id AND o.removed_at IS NULL
             AND (o.execution_started_at IS NULL OR NOT o.execution_completed OR o.actual_spent IS NULL))
           OR EXISTS (SELECT 1 FROM pta_activity_revision r, jsonb_array_elements(r.snapshot->'operations') fact
             WHERE r.id=NEW.approved_revision_id AND NOT EXISTS (SELECT 1 FROM pta_operation o
               WHERE o.activity_id=NEW.id AND o.removed_at IS NULL AND o.id=fact->>'id'))
           OR EXISTS (SELECT 1 FROM pta_operation o WHERE o.activity_id=NEW.id AND o.removed_at IS NULL
             AND NOT EXISTS (SELECT 1 FROM pta_activity_revision r,
               jsonb_array_elements(r.snapshot->'operations') fact
               WHERE r.id=NEW.approved_revision_id AND fact->>'id'=o.id)) THEN
          RAISE EXCEPTION 'Incomplete Activity closure';
        END IF;
        SELECT d.id,d.amount INTO source_id,source_amount FROM pta_disbursement_request d
          WHERE d.activity_id=NEW.id AND d.state='approved' AND d.approved_revision_id=NEW.approved_revision_id;
        IF source_id IS NULL OR source_amount<>spent THEN RAISE EXCEPTION 'Invalid closure disbursement'; END IF;
        SELECT v.id INTO virement_id FROM pta_virement_request v
          WHERE v.activity_id=NEW.id AND v.disbursement_request_id=source_id AND v.state='approved';
        SELECT c.id,c.amount INTO latest_confirmation_id,confirmed_amount FROM pta_virement_confirmation c
          WHERE c.request_id=virement_id ORDER BY c.revision DESC LIMIT 1;
        IF virement_id IS NULL OR latest_confirmation_id IS NULL OR confirmed_amount<>spent THEN
          RAISE EXCEPTION 'Invalid closure virement'; END IF;
        IF NEW.allocation-spent>0 THEN
          SELECT r.amount INTO returned FROM pta_reversement_declaration r
            WHERE r.request_id=virement_id AND r.confirmation_id=latest_confirmation_id
            ORDER BY r.revision DESC LIMIT 1;
          IF returned IS NULL OR returned<>NEW.allocation-spent THEN
            RAISE EXCEPTION 'Invalid closure reversement'; END IF;
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    """)
    op.execute("DROP FUNCTION pta_validate_zero_spending_state() CASCADE")
    op.execute("DROP FUNCTION pta_preserve_zero_spending() CASCADE")
    op.drop_table("pta_zero_spending_decision")
    op.drop_index(
        "zero_spending_one_current_per_activity",
        table_name="pta_zero_spending_declaration",
    )
    op.drop_table("pta_zero_spending_declaration")
