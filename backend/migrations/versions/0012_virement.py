"""PTA-3C virement request authorization.

Revision ID: 0012_pta3c
Revises: 0011_pta3b
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012_pta3c"
down_revision: str | None = "0011_pta3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "pta_virement_request",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("disbursement_request_id", sa.String(36), nullable=False),
        sa.Column("excluded_reviewer_ids", postgresql.JSONB(), nullable=False),
        sa.Column("submitter_id", sa.String(36), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.String(16), nullable=False),
        sa.Column("cancelled_by_id", sa.String(36)),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)),
        sa.Column("cancellation_reason", sa.String(4000)),
        sa.ForeignKeyConstraint(["submitter_id"], ["auth_user.id"]),
        sa.ForeignKeyConstraint(["cancelled_by_id"], ["auth_user.id"]),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.ForeignKeyConstraint(
            ["activity_id", "disbursement_request_id"],
            ["pta_disbursement_request.activity_id", "pta_disbursement_request.id"],
        ),
        sa.UniqueConstraint("activity_id", "id", name="virement_request_scope"),
        sa.CheckConstraint(
            "state IN ('submitted','prevalidated','returned','approved','cancelled')",
            name="virement_request_state_allowed",
        ),
        sa.CheckConstraint(
            "jsonb_typeof(excluded_reviewer_ids)='array' AND "
            "octet_length(excluded_reviewer_ids::text) <= 1048576",
            name="virement_exclusions_bounded",
        ),
        sa.CheckConstraint(
            "(state='cancelled' AND cancelled_by_id IS NOT NULL AND "
            "cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND "
            "length(btrim(cancellation_reason)) BETWEEN 1 AND 4000) OR "
            "(state<>'cancelled' AND cancelled_by_id IS NULL AND "
            "cancelled_at IS NULL AND cancellation_reason IS NULL)",
            name="virement_cancellation_facts",
        ),
    )
    op.create_index(
        "virement_one_open_per_activity",
        "pta_virement_request",
        ["activity_id"],
        unique=True,
        postgresql_where=sa.text("state <> 'cancelled'"),
    )
    op.create_table(
        "pta_virement_decision",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("stage", sa.String(16), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column("actor_id", sa.String(36), nullable=False),
        sa.Column("actor_role", sa.String(32), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(4000)),
        sa.Column("prevalidation_decision_id", sa.String(36)),
        sa.ForeignKeyConstraint(["actor_id"], ["auth_user.id"]),
        sa.ForeignKeyConstraint(
            ["activity_id", "request_id"],
            ["pta_virement_request.activity_id", "pta_virement_request.id"],
        ),
        sa.UniqueConstraint("request_id", "id", name="virement_decision_scope"),
        sa.UniqueConstraint("request_id", "stage", name="virement_decision_stage"),
        sa.CheckConstraint(
            "stage IN ('supervisor','validator')",
            name="virement_decision_stage_allowed",
        ),
        sa.CheckConstraint(
            "outcome IN ('prevalidated','approved','returned')",
            name="virement_decision_outcome_allowed",
        ),
        sa.CheckConstraint(
            "(stage='supervisor' AND outcome IN ('prevalidated','returned') AND "
            "actor_role='AGENT_VERIFICATEUR') OR "
            "(stage='validator' AND outcome IN ('approved','returned') AND "
            "actor_role='VALIDATEUR_DEFINITIF')",
            name="virement_decision_role_allowed",
        ),
        sa.CheckConstraint(
            "(outcome='returned' AND reason IS NOT NULL AND "
            "length(btrim(reason)) BETWEEN 1 AND 4000) OR "
            "(outcome<>'returned' AND reason IS NULL)",
            name="virement_decision_reason",
        ),
        sa.CheckConstraint(
            "(stage='validator' AND "
            "prevalidation_decision_id IS NOT NULL) OR "
            "(stage<>'validator' AND "
            "prevalidation_decision_id IS NULL)",
            name="virement_prevalidation_reference",
        ),
    )
    op.create_foreign_key(
        "virement_prevalidation_same_request",
        "pta_virement_decision",
        "pta_virement_decision",
        ["request_id", "prevalidation_decision_id"],
        ["request_id", "id"],
        use_alter=True,
    )
    op.execute("""
    CREATE FUNCTION pta_preserve_virement() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      approval_time timestamptz; source_exclusions jsonb;
    BEGIN
      IF TG_TABLE_NAME='pta_virement_decision' THEN
        RAISE EXCEPTION 'Virement decisions are immutable';
      END IF;
      IF TG_OP='INSERT' THEN
        SELECT d.decided_at,
               COALESCE(r.snapshot->'excluded_reviewer_ids','[]'::jsonb)
          INTO approval_time,source_exclusions
          FROM pta_disbursement_request r
          JOIN pta_disbursement_decision d ON d.request_id=r.id
         WHERE r.id=NEW.disbursement_request_id
           AND r.activity_id=NEW.activity_id
           AND r.state='approved'
           AND d.stage='validator' AND d.outcome='approved';
        IF NEW.state<>'submitted' OR approval_time IS NULL
           OR approval_time >= NEW.submitted_at
           OR jsonb_typeof(source_exclusions)<>'array'
           OR NOT (NEW.excluded_reviewer_ids @> source_exclusions)
           OR NOT (NEW.excluded_reviewer_ids @> jsonb_build_array(NEW.submitter_id))
           OR EXISTS (
             SELECT 1 FROM pta_activity_contributor c
              WHERE c.activity_id=NEW.activity_id
                AND NOT (NEW.excluded_reviewer_ids @> jsonb_build_array(c.user_id)))
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements(NEW.excluded_reviewer_ids) value
              WHERE jsonb_typeof(value)<>'string') THEN
          RAISE EXCEPTION 'Invalid initial virement basis';
        END IF;
        RETURN NEW;
      END IF;
      IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'Virement requests are immutable';
      END IF;
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.context_id IS DISTINCT FROM OLD.context_id
         OR NEW.activity_id IS DISTINCT FROM OLD.activity_id
         OR NEW.disbursement_request_id IS DISTINCT FROM OLD.disbursement_request_id
         OR NEW.excluded_reviewer_ids IS DISTINCT FROM OLD.excluded_reviewer_ids
         OR NEW.submitter_id IS DISTINCT FROM OLD.submitter_id
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Virement basis is immutable';
      END IF;
      IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
           (OLD.state='submitted'
            AND NEW.state IN ('prevalidated','returned','cancelled'))
        OR (OLD.state='prevalidated'
            AND NEW.state IN ('approved','returned','cancelled'))
        OR (OLD.state='returned' AND NEW.state='cancelled')) THEN
        RAISE EXCEPTION 'Invalid virement transition';
      END IF;
      IF OLD.state='cancelled' AND (
           NEW.cancelled_by_id IS DISTINCT FROM OLD.cancelled_by_id
        OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
        OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason) THEN
        RAISE EXCEPTION 'Virement cancellation is immutable';
      END IF;
      RETURN NEW;
    END $$;

    CREATE FUNCTION pta_validate_virement_state() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      request_key text; request_state text; supervisor_count integer;
      validator_count integer; returned_count integer; return_stage text;
      supervisor_actor text; validator_actor text; prevalidation_key text;
      excluded jsonb;
    BEGIN
      IF TG_TABLE_NAME='pta_virement_request' THEN
        request_key := NEW.id;
      ELSE
        request_key := NEW.request_id;
      END IF;
      SELECT state,excluded_reviewer_ids INTO request_state,excluded
        FROM pta_virement_request WHERE id=request_key;
      IF request_state IS NULL THEN RETURN NULL; END IF;
      SELECT
        count(*) FILTER (WHERE stage='supervisor' AND outcome='prevalidated'),
        count(*) FILTER (WHERE stage='validator' AND outcome='approved'),
        count(*) FILTER (WHERE outcome='returned'),
        max(stage) FILTER (WHERE outcome='returned'),
        max(actor_id) FILTER (WHERE stage='supervisor' AND outcome='prevalidated'),
        max(actor_id) FILTER (WHERE stage='validator'),
        max(prevalidation_decision_id) FILTER (WHERE stage='validator')
      INTO supervisor_count,validator_count,returned_count,return_stage,
           supervisor_actor,validator_actor,prevalidation_key
        FROM pta_virement_decision WHERE request_id=request_key;
      IF EXISTS (
        SELECT 1 FROM pta_virement_decision d
         WHERE d.request_id=request_key
           AND excluded @> jsonb_build_array(d.actor_id)
      ) OR EXISTS (
        SELECT 1 FROM pta_virement_decision validator
        LEFT JOIN pta_virement_decision supervisor
          ON supervisor.request_id=validator.request_id
         AND supervisor.id=validator.prevalidation_decision_id
         AND supervisor.stage='supervisor' AND supervisor.outcome='prevalidated'
        WHERE validator.request_id=request_key AND validator.stage='validator'
          AND validator.outcome IN ('approved','returned')
          AND (supervisor.id IS NULL OR supervisor.actor_id=validator.actor_id
               OR supervisor.decided_at>=validator.decided_at)
      ) OR EXISTS (
        SELECT 1 FROM pta_virement_decision d
        JOIN pta_virement_request r ON r.id=d.request_id
         WHERE d.request_id=request_key AND d.decided_at<=r.submitted_at
      ) OR EXISTS (
        SELECT 1 FROM pta_virement_decision d
        JOIN pta_virement_request r ON r.id=d.request_id
         WHERE d.request_id=request_key AND r.state='cancelled'
           AND d.decided_at>=r.cancelled_at
      ) OR EXISTS (
        SELECT 1 FROM pta_virement_request r WHERE r.id=request_key
         AND r.state='cancelled' AND r.cancelled_at<=r.submitted_at
      ) OR (request_state='submitted' AND EXISTS (
        SELECT 1 FROM pta_virement_decision WHERE request_id=request_key))
      OR (request_state='prevalidated' AND NOT (
        supervisor_count=1 AND validator_count=0 AND returned_count=0))
      OR (request_state='returned' AND NOT (
        returned_count=1 AND validator_count=0 AND
        ((return_stage='supervisor' AND supervisor_count=0) OR
         (return_stage='validator' AND supervisor_count=1))))
      OR (request_state='approved' AND NOT (
        supervisor_count=1 AND validator_count=1 AND returned_count=0
        AND supervisor_actor<>validator_actor AND prevalidation_key IS NOT NULL))
      OR (request_state='cancelled' AND NOT (
        validator_count=0 AND ((returned_count=0 AND supervisor_count IN (0,1)) OR
        (returned_count=1 AND ((return_stage='supervisor' AND supervisor_count=0) OR
        (return_stage='validator' AND supervisor_count=1)))))) THEN
        RAISE EXCEPTION 'Virement state and decisions disagree';
      END IF;
      RETURN NULL;
    END $$;

    CREATE TRIGGER virement_request_immutable
      BEFORE INSERT OR UPDATE OR DELETE ON pta_virement_request
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_virement();
    CREATE TRIGGER virement_decision_immutable
      BEFORE UPDATE OR DELETE ON pta_virement_decision
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_virement();
    CREATE CONSTRAINT TRIGGER virement_request_state_consistent
      AFTER INSERT OR UPDATE ON pta_virement_request DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION pta_validate_virement_state();
    CREATE CONSTRAINT TRIGGER virement_decision_state_consistent
      AFTER INSERT OR UPDATE ON pta_virement_decision DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION pta_validate_virement_state();
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pta_virement_request)
         OR EXISTS (SELECT 1 FROM pta_virement_decision)
         OR EXISTS (SELECT 1 FROM auth_audit WHERE action LIKE 'virement.%') THEN
        RAISE EXCEPTION 'Refusing destructive PTA-3C downgrade';
      END IF;
    END $$;
    """)
    op.execute(
        "DROP TRIGGER virement_decision_state_consistent ON pta_virement_decision"
    )
    op.execute("DROP TRIGGER virement_request_state_consistent ON pta_virement_request")
    op.execute("DROP TRIGGER virement_decision_immutable ON pta_virement_decision")
    op.execute("DROP TRIGGER virement_request_immutable ON pta_virement_request")
    op.execute("DROP FUNCTION pta_validate_virement_state()")
    op.execute("DROP FUNCTION pta_preserve_virement()")
    op.drop_table("pta_virement_decision")
    op.drop_index("virement_one_open_per_activity", table_name="pta_virement_request")
    op.drop_table("pta_virement_request")
