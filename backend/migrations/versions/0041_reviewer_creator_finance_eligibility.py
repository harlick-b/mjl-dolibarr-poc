"""Keep brief creators eligible for financial review.

Revision ID: 0041_reviewer_finance
Revises: 0040_financial_request_details
"""

from alembic import op

revision = "0041_reviewer_finance"
down_revision = "0040_financial_request_details"
branch_labels = None
depends_on = None


_TABLES = (
    "pta_disbursement_request",
    "pta_funding_request",
    "pta_zero_spending_declaration",
    "pta_virement_request",
)


def upgrade() -> None:
    # Request snapshots are immutable evidence. Remove only a person who is
    # demonstrably present solely because they created the initial brief.
    op.execute(
        """
        CREATE FUNCTION mjl_0041_filter_brief_only_creators(
          requested_activity_id varchar,
          requested_submitter_id varchar,
          stored_exclusions jsonb
        ) RETURNS jsonb
        LANGUAGE sql STABLE AS $$
          SELECT coalesce(jsonb_agg(entry.user_id ORDER BY entry.position), '[]'::jsonb)
          FROM jsonb_array_elements_text(
            coalesce(stored_exclusions, '[]'::jsonb)
          ) WITH ORDINALITY AS entry(user_id, position)
          WHERE entry.user_id = requested_submitter_id
             OR NOT EXISTS (
                  SELECT 1 FROM pta_activity_contributor creator
                  WHERE creator.activity_id = requested_activity_id
                    AND creator.user_id = entry.user_id
                    AND creator.kind IN ('supervisor_creation', 'validator_creation')
                )
             OR EXISTS (
                  SELECT 1 FROM pta_activity_contributor author
                  WHERE author.activity_id = requested_activity_id
                    AND author.user_id = entry.user_id
                    AND author.kind = 'content'
                )
             OR EXISTS (
                  SELECT 1 FROM auth_audit evidence
                  WHERE evidence.actor = entry.user_id
                    AND evidence.business->>'activity_id' = requested_activity_id
                    AND evidence.action IN (
                      'operation.execution_started',
                      'operation.execution_recorded',
                      'operation.execution_corrected',
                      'subtask.execution_recorded',
                      'subtask.execution_corrected'
                    )
                )
        $$
        """
    )
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE TRIGGER USER")
    for table in _TABLES[:3]:
        op.execute(
            f"""
            UPDATE {table}
            SET snapshot = jsonb_set(
              snapshot,
              '{{excluded_reviewer_ids}}',
              mjl_0041_filter_brief_only_creators(
                activity_id,
                submitter_id,
                snapshot->'excluded_reviewer_ids'
              ),
              true
            )
            """
        )
    op.execute(
        """
        UPDATE pta_virement_request request
        SET excluded_reviewer_ids = (
          SELECT coalesce(jsonb_agg(author_id ORDER BY author_id), '[]'::jsonb)
          FROM (
            SELECT value AS author_id
            FROM pta_disbursement_request source,
              jsonb_array_elements_text(
                source.snapshot->'excluded_reviewer_ids'
              ) inherited(value)
            WHERE source.id = request.disbursement_request_id
              AND source.activity_id = request.activity_id
            UNION
            SELECT value AS author_id
            FROM jsonb_array_elements_text(
              mjl_0041_filter_brief_only_creators(
                request.activity_id,
                request.submitter_id,
                request.excluded_reviewer_ids
              )
            ) own(value)
          ) authors
        )
        """
    )
    for table in reversed(_TABLES):
        op.execute(f"ALTER TABLE {table} ENABLE TRIGGER USER")
    op.execute(
        "DROP FUNCTION mjl_0041_filter_brief_only_creators(varchar, varchar, jsonb)"
    )

    # Funding decisions are checked against the same frozen request snapshot
    # used by the API. Current Activity contributors must not rewrite history.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION pta_validate_funding_state() RETURNS trigger
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
              d.actor_id=r.submitter_id
              OR r.snapshot->'excluded_reviewer_ids' ? d.actor_id)
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
        END $$
        """
    )
    op.execute(
        """
        CREATE OR REPLACE FUNCTION pta_preserve_virement() RETURNS trigger
        LANGUAGE plpgsql AS $$ DECLARE
          approval_time timestamptz; source_exclusions jsonb; source_amount bigint;
          approved_total bigint;
        BEGIN
          IF TG_TABLE_NAME='pta_virement_decision' THEN
            RAISE EXCEPTION 'Virement decisions are immutable';
          END IF;
          IF TG_OP='INSERT' THEN
            SELECT d.decided_at,
                   COALESCE(r.snapshot->'excluded_reviewer_ids','[]'::jsonb),
                   r.amount
              INTO approval_time,source_exclusions,source_amount
              FROM pta_disbursement_request r
              JOIN pta_disbursement_decision d ON d.request_id=r.id
             WHERE r.id=NEW.disbursement_request_id AND r.activity_id=NEW.activity_id
               AND r.state='approved' AND d.stage='validator' AND d.outcome='approved';
            SELECT coalesce(sum(v.amount),0) INTO approved_total
              FROM pta_virement_request v
             WHERE v.disbursement_request_id=NEW.disbursement_request_id
               AND v.state='approved';
            IF NEW.state<>'submitted' OR approval_time IS NULL
               OR approval_time>=NEW.submitted_at
               OR approved_total+NEW.amount>source_amount
               OR jsonb_typeof(source_exclusions)<>'array'
               OR NOT (NEW.excluded_reviewer_ids @> source_exclusions)
               OR NOT (NEW.excluded_reviewer_ids @> jsonb_build_array(NEW.submitter_id))
               OR EXISTS (SELECT 1 FROM pta_activity_contributor c
                           WHERE c.activity_id=NEW.activity_id
                             AND c.kind='content'
                             AND NOT (
                               NEW.excluded_reviewer_ids
                               @> jsonb_build_array(c.user_id)))
               OR EXISTS (
                    SELECT 1
                    FROM jsonb_array_elements(NEW.excluded_reviewer_ids) value
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
             OR NEW.amount IS DISTINCT FROM OLD.amount
             OR NEW.observation IS DISTINCT FROM OLD.observation
             OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name
             OR NEW.attachment_media_type IS DISTINCT FROM OLD.attachment_media_type
             OR NEW.attachment_size IS DISTINCT FROM OLD.attachment_size
             OR NEW.attachment_sha256 IS DISTINCT FROM OLD.attachment_sha256
             OR NEW.attachment_content IS DISTINCT FROM OLD.attachment_content
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
            OR false /* Returned requests are terminal (DEC-135). */) THEN
            RAISE EXCEPTION 'Invalid virement transition';
          END IF;
          IF OLD.state='cancelled' AND (
               NEW.cancelled_by_id IS DISTINCT FROM OLD.cancelled_by_id
            OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
            OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason) THEN
            RAISE EXCEPTION 'Virement cancellation is immutable';
          END IF;
          RETURN NEW;
        END $$
        """
    )


def downgrade() -> None:
    raise RuntimeError(
        "Reviewer eligibility repair is irreversible; preserve corrected "
        "financial request exclusions"
    )
