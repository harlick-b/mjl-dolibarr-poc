# ruff: noqa: E501
"""Store Agent-entered financial request details.

Revision ID: 0040_financial_request_details
Revises: 0039_editable_activity_dates
"""

import sqlalchemy as sa
from alembic import op

revision = "0040_financial_request_details"
down_revision = "0039_editable_activity_dates"
branch_labels = None
depends_on = None


def _details(table: str, prefix: str) -> None:
    op.add_column(table, sa.Column("observation", sa.String(length=4000)))
    op.add_column(table, sa.Column("attachment_name", sa.String(length=200)))
    op.add_column(table, sa.Column("attachment_media_type", sa.String(length=32)))
    op.add_column(table, sa.Column("attachment_size", sa.Integer()))
    op.add_column(table, sa.Column("attachment_sha256", sa.String(length=64)))
    op.add_column(table, sa.Column("attachment_content", sa.LargeBinary()))
    op.create_check_constraint(
        f"{prefix}_attachment_complete",
        table,
        "(attachment_name IS NULL AND attachment_media_type IS NULL AND "
        "attachment_size IS NULL AND attachment_sha256 IS NULL AND "
        "attachment_content IS NULL) OR "
        "(attachment_name IS NOT NULL AND attachment_media_type IS NOT NULL "
        "AND attachment_size > 0 AND attachment_size <= 20971520 AND "
        "attachment_sha256 IS NOT NULL AND attachment_content IS NOT NULL)",
    )


def upgrade() -> None:
    _details("pta_disbursement_request", "disbursement")
    _details("pta_virement_request", "virement")
    for table, constraint in (
        ("pta_disbursement_decision", "disbursement_decision_reason"),
        ("pta_virement_decision", "virement_decision_reason"),
    ):
        op.drop_constraint(constraint, table, type_="check")
        op.create_check_constraint(
            constraint,
            table,
            "(outcome='returned' AND reason IS NOT NULL AND "
            "length(btrim(reason)) BETWEEN 1 AND 4000) OR "
            "(outcome<>'returned' AND (reason IS NULL OR "
            "length(btrim(reason)) BETWEEN 1 AND 4000))",
        )
    op.add_column("pta_virement_request", sa.Column("amount", sa.BigInteger()))
    op.execute(
        """
        UPDATE pta_virement_request AS v
        SET amount = d.amount
        FROM pta_disbursement_request AS d
        WHERE d.id = v.disbursement_request_id
        """
    )
    op.alter_column("pta_virement_request", "amount", nullable=False)
    op.create_check_constraint(
        "virement_amount_positive", "pta_virement_request", "amount > 0"
    )
    op.drop_index(
        "disbursement_one_open_per_activity",
        table_name="pta_disbursement_request",
    )
    op.create_index(
        "disbursement_one_open_per_activity",
        "pta_disbursement_request",
        ["activity_id"],
        unique=True,
        postgresql_where=sa.text("state IN ('submitted', 'prevalidated')"),
    )
    op.drop_index("virement_one_open_per_activity", table_name="pta_virement_request")
    op.create_index(
        "virement_one_open_per_activity",
        "pta_virement_request",
        ["activity_id"],
        unique=True,
        postgresql_where=sa.text("state IN ('submitted', 'prevalidated')"),
    )
    op.execute(r"""
    CREATE OR REPLACE FUNCTION pta_preserve_disbursement() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE snapshot_total numeric; approved_total numeric;
    BEGIN
      IF TG_TABLE_NAME='pta_disbursement_decision' THEN
        RAISE EXCEPTION 'Disbursement decisions are immutable';
      END IF;
      IF TG_OP='INSERT' THEN
        IF NEW.state<>'submitted'
           OR jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object'
           OR jsonb_typeof(NEW.snapshot->'operations') IS DISTINCT FROM 'array'
           OR coalesce(NEW.snapshot->>'allocation','') !~ '^[0-9]+$'
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'operations') operation
             WHERE jsonb_typeof(operation) IS DISTINCT FROM 'object'
                OR coalesce(operation->>'actual_spent','') !~ '^[0-9]+$'
                OR coalesce(operation->>'approved_allocation','') !~ '^[0-9]+$'
           ) THEN RAISE EXCEPTION 'Invalid initial disbursement basis'; END IF;
        SELECT coalesce(sum((operation->>'actual_spent')::numeric),0)
          INTO snapshot_total
          FROM jsonb_array_elements(NEW.snapshot->'operations') operation;
        SELECT coalesce(sum(d.amount),0) INTO approved_total
          FROM pta_disbursement_request d
         WHERE d.activity_id=NEW.activity_id
           AND d.approved_revision_id=NEW.approved_revision_id
           AND d.state='approved';
        IF approved_total+NEW.amount>snapshot_total
           OR snapshot_total>(NEW.snapshot->>'allocation')::numeric THEN
          RAISE EXCEPTION 'Disbursement amount and snapshot disagree';
        END IF;
        RETURN NEW;
      END IF;
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Disbursement requests are immutable'; END IF;
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.context_id IS DISTINCT FROM OLD.context_id
         OR NEW.activity_id IS DISTINCT FROM OLD.activity_id
         OR NEW.approved_revision_id IS DISTINCT FROM OLD.approved_revision_id
         OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
         OR NEW.amount IS DISTINCT FROM OLD.amount
         OR NEW.observation IS DISTINCT FROM OLD.observation
         OR NEW.attachment_name IS DISTINCT FROM OLD.attachment_name
         OR NEW.attachment_media_type IS DISTINCT FROM OLD.attachment_media_type
         OR NEW.attachment_size IS DISTINCT FROM OLD.attachment_size
         OR NEW.attachment_sha256 IS DISTINCT FROM OLD.attachment_sha256
         OR NEW.attachment_content IS DISTINCT FROM OLD.attachment_content
         OR NEW.submitter_id IS DISTINCT FROM OLD.submitter_id
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Disbursement basis is immutable';
      END IF;
      IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
           (OLD.state='submitted' AND NEW.state IN ('prevalidated','returned','cancelled'))
        OR (OLD.state='prevalidated' AND NEW.state IN ('approved','returned','cancelled'))
        OR false /* Returned requests are terminal (DEC-135). */) THEN
        RAISE EXCEPTION 'Invalid disbursement transition';
      END IF;
      IF OLD.state='cancelled' AND (
           NEW.cancelled_by_id IS DISTINCT FROM OLD.cancelled_by_id
        OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
        OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason) THEN
        RAISE EXCEPTION 'Disbursement cancellation is immutable';
      END IF;
      RETURN NEW;
    END $$;

    CREATE OR REPLACE FUNCTION pta_preserve_virement() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      approval_time timestamptz; source_exclusions jsonb; source_amount bigint;
      approved_total bigint;
    BEGIN
      IF TG_TABLE_NAME='pta_virement_decision' THEN
        RAISE EXCEPTION 'Virement decisions are immutable';
      END IF;
      IF TG_OP='INSERT' THEN
        SELECT d.decided_at,COALESCE(r.snapshot->'excluded_reviewer_ids','[]'::jsonb),r.amount
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
                         AND NOT (NEW.excluded_reviewer_ids @> jsonb_build_array(c.user_id)))
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.excluded_reviewer_ids) value
                       WHERE jsonb_typeof(value)<>'string') THEN
          RAISE EXCEPTION 'Invalid initial virement basis';
        END IF;
        RETURN NEW;
      END IF;
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Virement requests are immutable'; END IF;
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
           (OLD.state='submitted' AND NEW.state IN ('prevalidated','returned','cancelled'))
        OR (OLD.state='prevalidated' AND NEW.state IN ('approved','returned','cancelled'))
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
    END $$;

    CREATE OR REPLACE FUNCTION pta_preserve_virement_confirmation()
    RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
      expected_amount bigint; latest_revision integer;
      approved_at timestamptz; latest_recorded_at timestamptz;
    BEGIN
      IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Virement confirmations are immutable'; END IF;
      SELECT v.amount,COALESCE(MAX(c.revision),0),vd.decided_at,MAX(c.recorded_at)
        INTO expected_amount,latest_revision,approved_at,latest_recorded_at
        FROM pta_virement_request v
        JOIN pta_virement_decision vd ON vd.request_id=v.id
          AND vd.stage='validator' AND vd.outcome='approved'
        LEFT JOIN pta_virement_confirmation c ON c.request_id=v.id
       WHERE v.id=NEW.request_id AND v.activity_id=NEW.activity_id AND v.state='approved'
       GROUP BY v.amount,vd.decided_at;
      IF expected_amount IS NULL OR NEW.amount<>expected_amount
         OR NEW.revision<>latest_revision+1
         OR NEW.recorded_at<=COALESCE(latest_recorded_at,approved_at)
         OR NEW.transfer_date>(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date
         OR EXISTS (SELECT 1 FROM pta_reversement_declaration r
                     WHERE r.activity_id=NEW.activity_id) THEN
        RAISE EXCEPTION 'Invalid virement confirmation';
      END IF;
      RETURN NEW;
    END $$;

    CREATE OR REPLACE FUNCTION pta_preserve_reversement_declaration() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      expected_amount bigint; spent_total bigint; confirmation_date date;
      confirmation_recorded_at timestamptz; latest_revision integer;
      latest_recorded_at timestamptz; previous_confirmation_id varchar(36);
    BEGIN
      IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Reversement declarations are immutable'; END IF;
      SELECT ((d.snapshot->>'allocation')::bigint -
              (SELECT sum((operation->>'actual_spent')::bigint)
                 FROM jsonb_array_elements(d.snapshot->'operations') operation)),
             (SELECT sum((operation->>'actual_spent')::bigint)
                FROM jsonb_array_elements(d.snapshot->'operations') operation),
             c.transfer_date,c.recorded_at,COALESCE(MAX(r.revision),0),
             MAX(r.recorded_at),MAX(r.confirmation_id)
        INTO expected_amount,spent_total,confirmation_date,confirmation_recorded_at,
             latest_revision,latest_recorded_at,previous_confirmation_id
        FROM pta_virement_request v
        JOIN pta_disbursement_request d ON d.id=v.disbursement_request_id
          AND d.activity_id=v.activity_id AND d.state='approved'
        JOIN pta_virement_confirmation c ON c.id=NEW.confirmation_id
          AND c.request_id=v.id AND c.activity_id=v.activity_id
        LEFT JOIN pta_reversement_declaration r ON r.request_id=v.id
       WHERE v.id=NEW.request_id AND v.activity_id=NEW.activity_id
         AND v.state='approved'
         AND c.revision=(SELECT MAX(latest.revision)
                           FROM pta_virement_confirmation latest
                          WHERE latest.request_id=v.id)
       GROUP BY d.snapshot,c.transfer_date,c.recorded_at;
      IF expected_amount IS NULL OR expected_amount<=0 OR NEW.amount<>expected_amount
         OR NEW.revision<>latest_revision+1
         OR (latest_revision>0 AND NEW.confirmation_id<>previous_confirmation_id)
         OR (SELECT coalesce(sum(d.amount),0)
               FROM pta_disbursement_request d
              WHERE d.activity_id=NEW.activity_id AND d.state='approved')
            <> spent_total
         OR (SELECT coalesce(sum(other.amount),0)
               FROM pta_virement_request other
              WHERE other.activity_id=NEW.activity_id AND other.state='approved')
            <> spent_total
         OR EXISTS (
           SELECT 1 FROM pta_virement_request other
            WHERE other.activity_id=NEW.activity_id AND other.state='approved'
              AND NOT EXISTS (
                SELECT 1 FROM pta_virement_confirmation other_confirmation
                 WHERE other_confirmation.request_id=other.id
                   AND other_confirmation.amount=other.amount
                   AND other_confirmation.revision=(
                     SELECT max(latest.revision)
                       FROM pta_virement_confirmation latest
                      WHERE latest.request_id=other.id)
              )
         )
         OR EXISTS (
           SELECT 1 FROM pta_reversement_declaration other_return
            WHERE other_return.activity_id=NEW.activity_id
              AND other_return.request_id<>NEW.request_id
         )
         OR NEW.return_date<confirmation_date
         OR NEW.return_date>(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date
         OR NEW.recorded_at<=COALESCE(latest_recorded_at,confirmation_recorded_at) THEN
        RAISE EXCEPTION 'Invalid reversement declaration';
      END IF;
      RETURN NEW;
    END $$;

    CREATE OR REPLACE FUNCTION pta_validate_activity_closure() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      operation_count integer; snapshot_count integer; spent bigint;
      source_amount bigint; virement_amount bigint; returned bigint;
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
        SELECT coalesce(sum(d.amount),0) INTO source_amount
          FROM pta_disbursement_request d WHERE d.activity_id=NEW.id
           AND d.state='approved' AND d.approved_revision_id=NEW.approved_revision_id;
        IF source_amount<>spent OR EXISTS (
          SELECT 1 FROM pta_disbursement_request d WHERE d.activity_id=NEW.id
           AND d.state IN ('submitted','prevalidated')
        ) THEN
          RAISE EXCEPTION 'Invalid closure disbursement'; END IF;
        SELECT coalesce(sum(v.amount),0) INTO virement_amount
          FROM pta_virement_request v
         WHERE v.activity_id=NEW.id AND v.state='approved'
           AND EXISTS (SELECT 1 FROM pta_disbursement_request d
                        WHERE d.id=v.disbursement_request_id
                          AND d.activity_id=NEW.id AND d.state='approved'
                          AND d.approved_revision_id=NEW.approved_revision_id);
        IF virement_amount<>source_amount OR EXISTS (
          SELECT 1 FROM pta_virement_request v WHERE v.activity_id=NEW.id
           AND v.state IN ('submitted','prevalidated')
        ) OR EXISTS (
          SELECT 1 FROM pta_virement_request v
           WHERE v.activity_id=NEW.id AND v.state='approved'
             AND NOT EXISTS (
               SELECT 1 FROM pta_virement_confirmation c
                WHERE c.request_id=v.id AND c.amount=v.amount
                  AND c.revision=(SELECT max(latest.revision)
                                    FROM pta_virement_confirmation latest
                                   WHERE latest.request_id=v.id)
             )
        ) THEN
          RAISE EXCEPTION 'Invalid closure virement'; END IF;
        IF NEW.allocation-spent>0 THEN
          SELECT r.amount INTO returned FROM pta_reversement_declaration r
           JOIN pta_virement_request v ON v.id=r.request_id
           JOIN pta_virement_confirmation c ON c.id=r.confirmation_id
          WHERE v.activity_id=NEW.id AND v.state='approved'
            AND c.revision=(SELECT max(latest.revision)
                              FROM pta_virement_confirmation latest
                             WHERE latest.request_id=v.id)
          ORDER BY r.recorded_at DESC,r.id DESC LIMIT 1;
          IF returned IS NULL OR returned<>NEW.allocation-spent THEN
            RAISE EXCEPTION 'Invalid closure reversement'; END IF;
        END IF;
      END IF;
      RETURN NEW;
    END $$;
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pta_disbursement_request
         WHERE state NOT IN ('returned','cancelled')
         GROUP BY activity_id HAVING count(*)>1
      ) OR EXISTS (
        SELECT 1 FROM pta_virement_request
         WHERE state NOT IN ('returned','cancelled')
         GROUP BY activity_id HAVING count(*)>1
      ) THEN
        RAISE EXCEPTION 'Refusing to discard cumulative financial requests';
      END IF;
    END $$;
    """)
    op.drop_index(
        "disbursement_one_open_per_activity",
        table_name="pta_disbursement_request",
    )
    op.create_index(
        "disbursement_one_open_per_activity",
        "pta_disbursement_request",
        ["activity_id"],
        unique=True,
        postgresql_where=sa.text("state NOT IN ('returned', 'cancelled')"),
    )
    op.drop_index("virement_one_open_per_activity", table_name="pta_virement_request")
    op.create_index(
        "virement_one_open_per_activity",
        "pta_virement_request",
        ["activity_id"],
        unique=True,
        postgresql_where=sa.text("state NOT IN ('returned', 'cancelled')"),
    )
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pta_disbursement_request)
         OR EXISTS (SELECT 1 FROM pta_virement_request) THEN
        RAISE EXCEPTION 'Refusing destructive financial-request-details downgrade';
      END IF;
    END $$;

    CREATE OR REPLACE FUNCTION pta_preserve_disbursement() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE snapshot_total numeric;
    BEGIN
      IF TG_TABLE_NAME='pta_disbursement_decision' THEN
        RAISE EXCEPTION 'Disbursement decisions are immutable';
      END IF;
      IF TG_OP='INSERT' THEN
        IF NEW.state<>'submitted'
           OR jsonb_typeof(NEW.snapshot) IS DISTINCT FROM 'object'
           OR jsonb_typeof(NEW.snapshot->'operations') IS DISTINCT FROM 'array'
           OR coalesce(NEW.snapshot->>'allocation','') !~ '^[0-9]+$'
           OR EXISTS (
             SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'operations') operation
             WHERE jsonb_typeof(operation) IS DISTINCT FROM 'object'
                OR coalesce(operation->>'actual_spent','') !~ '^[0-9]+$'
                OR coalesce(operation->>'approved_allocation','') !~ '^[0-9]+$'
           ) THEN RAISE EXCEPTION 'Invalid initial disbursement basis'; END IF;
        SELECT coalesce(sum((operation->>'actual_spent')::numeric),0)
          INTO snapshot_total
          FROM jsonb_array_elements(NEW.snapshot->'operations') operation;
        IF snapshot_total<>NEW.amount
           OR NEW.amount>(NEW.snapshot->>'allocation')::numeric THEN
          RAISE EXCEPTION 'Disbursement amount and snapshot disagree';
        END IF;
        RETURN NEW;
      END IF;
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Disbursement requests are immutable'; END IF;
      IF NEW.id IS DISTINCT FROM OLD.id
         OR NEW.context_id IS DISTINCT FROM OLD.context_id
         OR NEW.activity_id IS DISTINCT FROM OLD.activity_id
         OR NEW.approved_revision_id IS DISTINCT FROM OLD.approved_revision_id
         OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
         OR NEW.amount IS DISTINCT FROM OLD.amount
         OR NEW.submitter_id IS DISTINCT FROM OLD.submitter_id
         OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at THEN
        RAISE EXCEPTION 'Disbursement basis is immutable';
      END IF;
      IF NEW.state IS DISTINCT FROM OLD.state AND NOT (
           (OLD.state='submitted' AND NEW.state IN ('prevalidated','returned','cancelled'))
        OR (OLD.state='prevalidated' AND NEW.state IN ('approved','returned','cancelled'))
        OR false /* Returned requests are terminal (DEC-135). */) THEN
        RAISE EXCEPTION 'Invalid disbursement transition';
      END IF;
      IF OLD.state='cancelled' AND (
           NEW.cancelled_by_id IS DISTINCT FROM OLD.cancelled_by_id
        OR NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at
        OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason) THEN
        RAISE EXCEPTION 'Disbursement cancellation is immutable';
      END IF;
      RETURN NEW;
    END $$;

    CREATE OR REPLACE FUNCTION pta_preserve_virement() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      approval_time timestamptz; source_exclusions jsonb;
    BEGIN
      IF TG_TABLE_NAME='pta_virement_decision' THEN
        RAISE EXCEPTION 'Virement decisions are immutable';
      END IF;
      IF TG_OP='INSERT' THEN
        SELECT d.decided_at,COALESCE(r.snapshot->'excluded_reviewer_ids','[]'::jsonb)
          INTO approval_time,source_exclusions
          FROM pta_disbursement_request r
          JOIN pta_disbursement_decision d ON d.request_id=r.id
         WHERE r.id=NEW.disbursement_request_id AND r.activity_id=NEW.activity_id
           AND r.state='approved' AND d.stage='validator' AND d.outcome='approved';
        IF NEW.state<>'submitted' OR approval_time IS NULL
           OR approval_time>=NEW.submitted_at
           OR jsonb_typeof(source_exclusions)<>'array'
           OR NOT (NEW.excluded_reviewer_ids @> source_exclusions)
           OR NOT (NEW.excluded_reviewer_ids @> jsonb_build_array(NEW.submitter_id))
           OR EXISTS (SELECT 1 FROM pta_activity_contributor c
                       WHERE c.activity_id=NEW.activity_id
                         AND NOT (NEW.excluded_reviewer_ids @> jsonb_build_array(c.user_id)))
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.excluded_reviewer_ids) value
                       WHERE jsonb_typeof(value)<>'string') THEN
          RAISE EXCEPTION 'Invalid initial virement basis';
        END IF;
        RETURN NEW;
      END IF;
      IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Virement requests are immutable'; END IF;
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
           (OLD.state='submitted' AND NEW.state IN ('prevalidated','returned','cancelled'))
        OR (OLD.state='prevalidated' AND NEW.state IN ('approved','returned','cancelled'))
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
    END $$;

    CREATE OR REPLACE FUNCTION pta_preserve_virement_confirmation()
    RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE
      expected_amount bigint; latest_revision integer;
      approved_at timestamptz; latest_recorded_at timestamptz;
    BEGIN
      IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Virement confirmations are immutable'; END IF;
      SELECT d.amount,COALESCE(MAX(c.revision),0),vd.decided_at,MAX(c.recorded_at)
        INTO expected_amount,latest_revision,approved_at,latest_recorded_at
        FROM pta_virement_request v
        JOIN pta_disbursement_request d ON d.id=v.disbursement_request_id
        JOIN pta_virement_decision vd ON vd.request_id=v.id
          AND vd.stage='validator' AND vd.outcome='approved'
        LEFT JOIN pta_virement_confirmation c ON c.request_id=v.id
       WHERE v.id=NEW.request_id AND v.activity_id=NEW.activity_id AND v.state='approved'
       GROUP BY d.amount,vd.decided_at;
      IF expected_amount IS NULL OR NEW.amount<>expected_amount
         OR NEW.revision<>latest_revision+1
         OR NEW.recorded_at<=COALESCE(latest_recorded_at,approved_at)
         OR NEW.transfer_date>(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date
         OR EXISTS (SELECT 1 FROM pta_reversement_declaration r
                     WHERE r.request_id=NEW.request_id) THEN
        RAISE EXCEPTION 'Invalid virement confirmation';
      END IF;
      RETURN NEW;
    END $$;

    CREATE OR REPLACE FUNCTION pta_preserve_reversement_declaration() RETURNS trigger
    LANGUAGE plpgsql AS $$ DECLARE
      expected_amount bigint; confirmation_date date;
      confirmation_recorded_at timestamptz; latest_revision integer;
      latest_recorded_at timestamptz; previous_confirmation_id varchar(36);
    BEGIN
      IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Reversement declarations are immutable'; END IF;
      SELECT ((d.snapshot->>'allocation')::bigint-d.amount),
             c.transfer_date,c.recorded_at,COALESCE(MAX(r.revision),0),
             MAX(r.recorded_at),MAX(r.confirmation_id)
        INTO expected_amount,confirmation_date,confirmation_recorded_at,
             latest_revision,latest_recorded_at,previous_confirmation_id
        FROM pta_virement_request v
        JOIN pta_disbursement_request d ON d.id=v.disbursement_request_id
          AND d.activity_id=v.activity_id AND d.state='approved'
        JOIN pta_virement_confirmation c ON c.id=NEW.confirmation_id
          AND c.request_id=v.id AND c.activity_id=v.activity_id
        LEFT JOIN pta_reversement_declaration r ON r.request_id=v.id
       WHERE v.id=NEW.request_id AND v.activity_id=NEW.activity_id AND v.state='approved'
         AND c.revision=(SELECT MAX(latest.revision)
                           FROM pta_virement_confirmation latest
                          WHERE latest.request_id=v.id)
       GROUP BY d.snapshot,d.amount,c.transfer_date,c.recorded_at;
      IF expected_amount IS NULL OR expected_amount<=0 OR NEW.amount<>expected_amount
         OR NEW.revision<>latest_revision+1
         OR (latest_revision>0 AND NEW.confirmation_id<>previous_confirmation_id)
         OR NEW.return_date<confirmation_date
         OR NEW.return_date>(clock_timestamp() AT TIME ZONE 'Africa/Porto-Novo')::date
         OR NEW.recorded_at<=COALESCE(latest_recorded_at,confirmation_recorded_at) THEN
        RAISE EXCEPTION 'Invalid reversement declaration';
      END IF;
      RETURN NEW;
    END $$;

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
        IF operation_count=0 OR operation_count<>snapshot_count OR spent<0
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
                   OR NOT EXISTS (SELECT 1 FROM pta_operation o
                                   WHERE o.activity_id=NEW.id AND o.removed_at IS NULL
                                     AND o.id=fact->>'id' AND o.actual_spent=0
                                     AND o.execution_completed)) LIMIT 1;
          IF zero_id IS NULL THEN RAISE EXCEPTION 'Invalid zero-spending closure'; END IF;
          RETURN NEW;
        END IF;
        SELECT d.id,d.amount INTO source_id,source_amount
          FROM pta_disbursement_request d WHERE d.activity_id=NEW.id
           AND d.state='approved' AND d.approved_revision_id=NEW.approved_revision_id;
        IF source_id IS NULL OR source_amount<>spent THEN
          RAISE EXCEPTION 'Invalid closure disbursement'; END IF;
        SELECT v.id INTO virement_id FROM pta_virement_request v
         WHERE v.activity_id=NEW.id AND v.disbursement_request_id=source_id
           AND v.state='approved';
        SELECT c.id,c.amount INTO latest_confirmation_id,confirmed_amount
          FROM pta_virement_confirmation c WHERE c.request_id=virement_id
         ORDER BY c.revision DESC LIMIT 1;
        IF virement_id IS NULL OR latest_confirmation_id IS NULL
           OR confirmed_amount<>spent THEN
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
    op.drop_constraint(
        "virement_amount_positive", "pta_virement_request", type_="check"
    )
    for table, constraint in (
        ("pta_disbursement_decision", "disbursement_decision_reason"),
        ("pta_virement_decision", "virement_decision_reason"),
    ):
        op.drop_constraint(constraint, table, type_="check")
        op.create_check_constraint(
            constraint,
            table,
            "(outcome='returned' AND reason IS NOT NULL AND "
            "length(btrim(reason)) BETWEEN 1 AND 4000) OR "
            "(outcome<>'returned' AND reason IS NULL)",
        )
    op.drop_column("pta_virement_request", "amount")
    for table, prefix in (
        ("pta_virement_request", "virement"),
        ("pta_disbursement_request", "disbursement"),
    ):
        op.drop_constraint(f"{prefix}_attachment_complete", table, type_="check")
        for column in (
            "attachment_content",
            "attachment_sha256",
            "attachment_size",
            "attachment_media_type",
            "attachment_name",
            "observation",
        ):
            op.drop_column(table, column)
