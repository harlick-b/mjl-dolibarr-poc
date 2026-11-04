"""Budget funding funding authorization.

Revision ID: 0024_budget_funding
Revises: 0023_real_mail_accounts
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0024_budget_funding"
down_revision: str | None = "0023_real_mail_accounts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM (
          SELECT r.activity_id, (r.snapshot->>'allocation')::numeric amount,
            lag((r.snapshot->>'allocation')::numeric) OVER (
              PARTITION BY r.activity_id ORDER BY r.revision_number) previous
          FROM pta_activity_revision r
          JOIN pta_activity_revision_decision d ON d.revision_id=r.id
            AND d.stage='validator' AND d.outcome='approved'
        ) budgets WHERE amount > previous AND (
          EXISTS (SELECT 1 FROM pta_disbursement_request f
            WHERE f.activity_id=budgets.activity_id
              AND f.state NOT IN ('returned','cancelled'))
          OR EXISTS (SELECT 1 FROM pta_zero_spending_declaration z
            WHERE z.activity_id=budgets.activity_id AND z.state<>'returned'))
      ) THEN
        RAISE EXCEPTION
          'Funding upgrade blocked: prior budget increase has frozen finance; '
          'resolve under an approved migration policy before retrying';
      END IF;
    END $$;
    """)
    op.create_table(
        "pta_funding_request",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("approved_revision_id", sa.String(36), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("amount", sa.BigInteger(), nullable=False),
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
            ["activity_id", "approved_revision_id"],
            ["pta_activity_revision.activity_id", "pta_activity_revision.id"],
        ),
        sa.UniqueConstraint("activity_id", "id", name="funding_request_scope"),
        sa.CheckConstraint(
            "state IN ('submitted','prevalidated','returned','approved','cancelled')",
            name="funding_request_state_allowed",
        ),
        sa.CheckConstraint("amount > 0", name="funding_amount_positive"),
        sa.CheckConstraint(
            "octet_length(snapshot::text) <= 1048576",
            name="funding_snapshot_bounded",
        ),
        sa.CheckConstraint(
            "(state='cancelled' AND cancelled_by_id IS NOT NULL AND "
            "cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND "
            "length(btrim(cancellation_reason)) BETWEEN 1 AND 4000) OR "
            "(state<>'cancelled' AND cancelled_by_id IS NULL AND "
            "cancelled_at IS NULL AND cancellation_reason IS NULL)",
            name="funding_cancellation_facts",
        ),
    )
    op.create_index(
        "funding_one_open_per_activity",
        "pta_funding_request",
        ["activity_id", "approved_revision_id"],
        unique=True,
        postgresql_where=sa.text("state NOT IN ('returned', 'cancelled')"),
    )
    op.create_table(
        "pta_funding_decision",
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
            ["pta_funding_request.activity_id", "pta_funding_request.id"],
        ),
        sa.UniqueConstraint("request_id", "id", name="funding_decision_scope"),
        sa.UniqueConstraint("request_id", "stage", name="funding_decision_stage"),
        sa.CheckConstraint(
            "stage IN ('supervisor','validator')",
            name="funding_decision_stage_allowed",
        ),
        sa.CheckConstraint(
            "outcome IN ('prevalidated','approved','returned')",
            name="funding_decision_outcome_allowed",
        ),
        sa.CheckConstraint(
            "(stage='supervisor' AND outcome IN ('prevalidated','returned') AND "
            "actor_role='AGENT_VERIFICATEUR') OR "
            "(stage='validator' AND outcome IN ('approved','returned') AND "
            "actor_role='VALIDATEUR_DEFINITIF')",
            name="funding_decision_role_allowed",
        ),
        sa.CheckConstraint(
            "(outcome='returned' AND reason IS NOT NULL AND "
            "length(btrim(reason)) BETWEEN 1 AND 4000) OR "
            "(outcome<>'returned' AND reason IS NULL)",
            name="funding_decision_reason",
        ),
        sa.CheckConstraint(
            "(stage='validator' AND outcome='approved' AND "
            "prevalidation_decision_id IS NOT NULL) OR "
            "(NOT (stage='validator' AND outcome='approved') AND "
            "prevalidation_decision_id IS NULL)",
            name="funding_prevalidation_reference",
        ),
    )
    op.create_foreign_key(
        "funding_prevalidation_same_request",
        "pta_funding_decision",
        "pta_funding_decision",
        ["request_id", "prevalidation_decision_id"],
        ["request_id", "id"],
        use_alter=True,
    )
    op.execute("""
    CREATE FUNCTION pta_preserve_funding() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      snapshot_total numeric;
    BEGIN
      IF TG_TABLE_NAME='pta_funding_decision' THEN
        RAISE EXCEPTION 'Funding decisions are immutable';
      END IF;
      IF TG_OP='INSERT' THEN
        IF NEW.state<>'submitted'
           OR jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object'
           OR jsonb_typeof(NEW.snapshot->'excluded_reviewer_ids')
              IS DISTINCT FROM 'array'
           OR NOT EXISTS (
             SELECT 1 FROM pta_activity_revision newer
             JOIN pta_activity_revision_decision nd ON nd.revision_id=newer.id
               AND nd.stage='validator' AND nd.outcome='approved'
             JOIN pta_activity_revision older
               ON older.id=NEW.snapshot->>'base_revision_id'
               AND older.activity_id=newer.activity_id
             JOIN pta_activity_revision_decision od ON od.revision_id=older.id
               AND od.stage='validator' AND od.outcome='approved'
             WHERE newer.id=NEW.approved_revision_id
               AND newer.activity_id=NEW.activity_id
               AND newer.revision_number > older.revision_number
               AND NOT EXISTS (
                 SELECT 1 FROM pta_activity_revision between_revision
                 JOIN pta_activity_revision_decision bd
                   ON bd.revision_id=between_revision.id
                   AND bd.stage='validator' AND bd.outcome='approved'
                 WHERE between_revision.activity_id=newer.activity_id
                   AND between_revision.revision_number > older.revision_number
                   AND between_revision.revision_number < newer.revision_number)
               AND NEW.snapshot->>'old_allocation' IS NOT DISTINCT FROM
                   older.snapshot->>'allocation'
               AND NEW.snapshot->>'new_allocation' IS NOT DISTINCT FROM
                   newer.snapshot->>'allocation'
               AND NEW.amount = (newer.snapshot->>'allocation')::numeric
                   - (older.snapshot->>'allocation')::numeric
           ) THEN
          RAISE EXCEPTION 'Invalid funding revision basis';
        END IF;
        RETURN NEW;
      END IF;
      IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'Funding requests are immutable';
      END IF;
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.context_id IS DISTINCT FROM OLD.context_id
         OR NEW.activity_id IS DISTINCT FROM OLD.activity_id
         OR NEW.approved_revision_id IS DISTINCT FROM OLD.approved_revision_id
         OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
         OR NEW.amount IS DISTINCT FROM OLD.amount
         OR NEW.submitter_id IS DISTINCT FROM OLD.submitter_id
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Funding basis is immutable';
      END IF;
      IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
           (OLD.state='submitted'
            AND NEW.state IN ('prevalidated','returned','cancelled'))
        OR (OLD.state='prevalidated'
            AND NEW.state IN ('approved','returned','cancelled'))
        OR false
      ) THEN
        RAISE EXCEPTION 'Invalid funding transition';
      END IF;
      IF OLD.state='cancelled' AND (
           NEW.cancelled_by_id IS DISTINCT FROM OLD.cancelled_by_id
        OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
        OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason
      ) THEN
        RAISE EXCEPTION 'Funding cancellation is immutable';
      END IF;
      RETURN NEW;
    END $$;
    CREATE FUNCTION pta_validate_funding_state() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      request_key text;
      request_state text;
      supervisor_count integer;
      validator_count integer;
      returned_count integer;
      return_stage text;
      supervisor_actor text;
      validator_actor text;
      prevalidation_key text;
    BEGIN
      IF TG_TABLE_NAME='pta_funding_request' THEN
        request_key := NEW.id;
      ELSE
        request_key := NEW.request_id;
      END IF;
      SELECT state INTO request_state FROM pta_funding_request
        WHERE id=request_key;
      IF request_state IS NULL THEN RETURN NULL; END IF;
      SELECT
        count(*) FILTER (WHERE stage='supervisor' AND outcome='prevalidated'),
        count(*) FILTER (WHERE stage='validator' AND outcome='approved'),
        count(*) FILTER (WHERE outcome='returned'),
        max(stage) FILTER (WHERE outcome='returned'),
        max(actor_id) FILTER (WHERE stage='supervisor' AND outcome='prevalidated'),
        max(actor_id) FILTER (WHERE stage='validator'),
        max(prevalidation_decision_id) FILTER (
          WHERE stage='validator' AND outcome='approved')
      INTO supervisor_count,validator_count,returned_count,return_stage,
           supervisor_actor,validator_actor,prevalidation_key
      FROM pta_funding_decision WHERE request_id=request_key;
      IF EXISTS (
        SELECT 1 FROM pta_funding_decision d
        JOIN pta_funding_request r ON r.id=d.request_id
        WHERE d.request_id=request_key AND (
          d.actor_id=r.submitter_id OR r.snapshot->'excluded_reviewer_ids' ? d.actor_id
          OR EXISTS (SELECT 1 FROM pta_activity_contributor c
                     WHERE c.activity_id=r.activity_id AND c.user_id=d.actor_id)
          OR EXISTS (SELECT 1 FROM auth_audit a WHERE a.actor=d.actor_id
                     AND a.business->>'activity_id'=r.activity_id
                     AND a.action LIKE 'operation.execution_%'))
      ) OR EXISTS (
        SELECT 1 FROM pta_funding_decision validator
        LEFT JOIN pta_funding_decision supervisor
          ON supervisor.request_id=validator.request_id
         AND supervisor.id=validator.prevalidation_decision_id
         AND supervisor.stage='supervisor'
         AND supervisor.outcome='prevalidated'
        WHERE validator.request_id=request_key
          AND validator.stage='validator'
          AND validator.outcome='approved'
          AND (supervisor.id IS NULL OR supervisor.actor_id=validator.actor_id
               OR supervisor.decided_at > validator.decided_at)
      ) OR EXISTS (
        SELECT 1 FROM pta_funding_decision validator
        LEFT JOIN pta_funding_decision supervisor
          ON supervisor.request_id=validator.request_id
         AND supervisor.stage='supervisor'
         AND supervisor.outcome='prevalidated'
        WHERE validator.request_id=request_key
          AND validator.stage='validator'
          AND validator.outcome='returned'
          AND (supervisor.id IS NULL
               OR supervisor.decided_at > validator.decided_at)
      ) OR EXISTS (
        SELECT 1 FROM pta_funding_decision decision
        JOIN pta_funding_request request ON request.id=decision.request_id
        WHERE decision.request_id=request_key
          AND decision.decided_at < request.submitted_at
      ) OR EXISTS (
        SELECT 1 FROM pta_funding_decision decision
        JOIN pta_funding_request request ON request.id=decision.request_id
        WHERE decision.request_id=request_key
          AND request.state='cancelled'
          AND decision.decided_at > request.cancelled_at
      ) OR EXISTS (
        SELECT 1 FROM pta_funding_request request
        WHERE request.id=request_key
          AND request.state='cancelled'
          AND request.cancelled_at < request.submitted_at
      ) OR (
        request_state='submitted' AND
        EXISTS (SELECT 1 FROM pta_funding_decision WHERE request_id=request_key)
      ) OR (
        request_state='prevalidated' AND NOT (
          supervisor_count=1 AND validator_count=0 AND returned_count=0)
      ) OR (
        request_state='returned' AND NOT (
          returned_count=1 AND validator_count=0 AND (
            (return_stage='supervisor' AND supervisor_count=0) OR
            (return_stage='validator' AND supervisor_count=1)))
      ) OR (
        request_state='approved' AND NOT (
          supervisor_count=1 AND validator_count=1 AND returned_count=0
          AND supervisor_actor<>validator_actor AND prevalidation_key IS NOT NULL)
      ) OR (
        request_state='cancelled' AND NOT (
          validator_count=0 AND (
            (returned_count=0 AND supervisor_count IN (0,1)) OR
            (returned_count=1 AND (
              (return_stage='supervisor' AND supervisor_count=0) OR
              (return_stage='validator' AND supervisor_count=1)))))
      ) THEN
        RAISE EXCEPTION 'Funding state and decisions disagree';
      END IF;
      RETURN NULL;
    END $$;
    CREATE TRIGGER funding_request_immutable
      BEFORE INSERT OR UPDATE OR DELETE ON pta_funding_request
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_funding();
    CREATE TRIGGER funding_decision_immutable
      BEFORE UPDATE OR DELETE ON pta_funding_decision
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_funding();
    CREATE CONSTRAINT TRIGGER funding_request_state_consistent
      AFTER INSERT OR UPDATE ON pta_funding_request
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION pta_validate_funding_state();
    CREATE CONSTRAINT TRIGGER funding_decision_state_consistent
      AFTER INSERT OR UPDATE ON pta_funding_decision
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION pta_validate_funding_state();
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pta_funding_request)
         OR EXISTS (SELECT 1 FROM pta_funding_decision)
         OR EXISTS (SELECT 1 FROM auth_audit WHERE action LIKE 'funding.%') THEN
        RAISE EXCEPTION 'Refusing destructive Budget funding downgrade';
      END IF;
    END $$;
    """)
    op.execute(
        "DROP TRIGGER IF EXISTS funding_decision_state_consistent "
        "ON pta_funding_decision"
    )
    op.execute(
        "DROP TRIGGER IF EXISTS funding_request_state_consistent ON pta_funding_request"
    )
    op.execute("DROP TRIGGER funding_decision_immutable ON pta_funding_decision")
    op.execute("DROP TRIGGER funding_request_immutable ON pta_funding_request")
    op.execute("DROP FUNCTION pta_preserve_funding()")
    op.execute("DROP FUNCTION IF EXISTS pta_validate_funding_state()")
    op.drop_table("pta_funding_decision")
    op.drop_index(
        "funding_one_open_per_activity",
        table_name="pta_funding_request",
    )
    op.drop_table("pta_funding_request")
