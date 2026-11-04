# ruff: noqa: E501
"""PTA-2B.2A approved Activity withdrawal.

Revision ID: 0008_pta2b2a
Revises: 0007_pta2b1
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0008_pta2b2a"
down_revision: str | None = "0007_pta2b1"
branch_labels = None
depends_on = None


def review_function() -> str:
    return """
    CREATE OR REPLACE FUNCTION pta_validate_activity_review_state() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE a pta_activity%ROWTYPE;
    DECLARE snap jsonb;
    DECLARE base_snap jsonb;
    DECLARE base_s_out text;
    DECLARE base_s_actor text;
    DECLARE base_v_out text;
    DECLARE base_v_actor text;
    DECLARE s_out text;
    DECLARE v_out text;
    BEGIN
      IF TG_TABLE_NAME='pta_activity' THEN a := NEW;
      ELSE
        SELECT * INTO a FROM pta_activity WHERE id=NEW.activity_id;
        IF a.current_revision_id IS DISTINCT FROM NEW.revision_id THEN
          RAISE EXCEPTION 'Decision targets an obsolete Activity revision';
        END IF;
      END IF;
      IF a.approved_revision_id IS NOT NULL THEN
        SELECT snapshot INTO base_snap FROM pta_activity_revision
          WHERE id=a.approved_revision_id AND activity_id=a.id;
        SELECT outcome,actor_id INTO base_s_out,base_s_actor
          FROM pta_activity_revision_decision
          WHERE revision_id=a.approved_revision_id AND stage='supervisor';
        SELECT outcome,actor_id INTO base_v_out,base_v_actor
          FROM pta_activity_revision_decision
          WHERE revision_id=a.approved_revision_id AND stage='validator';
        IF base_snap IS NULL OR base_snap ? 'withdrawal'
           OR base_s_out IS DISTINCT FROM 'prevalidated'
           OR base_v_out IS DISTINCT FROM 'approved'
           OR base_s_actor IS NOT DISTINCT FROM base_v_actor THEN
          RAISE EXCEPTION 'Activity approved revision chain is invalid';
        END IF;
      END IF;
      IF a.state IN ('draft','amendment_draft') THEN RETURN NEW; END IF;
      SELECT snapshot INTO snap FROM pta_activity_revision
        WHERE id=a.current_revision_id AND activity_id=a.id;
      IF snap IS NULL THEN RAISE EXCEPTION 'Activity current revision is missing'; END IF;
      IF a.withdrawal_id IS NOT NULL THEN
        IF NOT (snap ? 'withdrawal') OR jsonb_typeof(snap->'withdrawal')<>'object'
           OR snap->'withdrawal'->>'id' IS DISTINCT FROM a.withdrawal_id
           OR (SELECT count(*) FROM jsonb_object_keys(snap->'withdrawal')) <> 3
           OR snap->'withdrawal'->>'base_approved_revision_id'
                IS DISTINCT FROM a.approved_revision_id
           OR nullif(btrim(snap->'withdrawal'->>'reason'),'') IS NULL
           OR length(snap->'withdrawal'->>'reason') > 4000
           OR snap ? 'amendment_id' OR snap ? 'amendment_reason'
           OR snap->'context_id' IS DISTINCT FROM base_snap->'context_id'
           OR snap->'partner' IS DISTINCT FROM base_snap->'partner'
           OR snap->'project' IS DISTINCT FROM base_snap->'project'
           OR snap->'pta' IS DISTINCT FROM base_snap->'pta'
           OR snap->'activity' IS DISTINCT FROM base_snap->'activity'
           OR snap->'name' IS DISTINCT FROM base_snap->'name'
           OR snap->'description' IS DISTINCT FROM base_snap->'description'
           OR snap->'planned_start' IS DISTINCT FROM base_snap->'planned_start'
           OR snap->'planned_end' IS DISTINCT FROM base_snap->'planned_end'
           OR snap->'allocation' IS DISTINCT FROM base_snap->'allocation'
           OR snap->'operations' IS DISTINCT FROM base_snap->'operations' THEN
          RAISE EXCEPTION 'Activity withdrawal revision lineage is invalid';
        END IF;
      ELSIF snap ? 'withdrawal' THEN
        RAISE EXCEPTION 'Activity has obsolete withdrawal lineage';
      END IF;
      IF a.amendment_id IS NOT NULL AND (
           snap->>'amendment_id' IS DISTINCT FROM a.amendment_id
           OR snap->>'amendment_reason' IS DISTINCT FROM a.amendment_reason
           OR snap->>'base_approved_revision_id' IS DISTINCT FROM a.approved_revision_id
         ) THEN
        RAISE EXCEPTION 'Activity amendment revision lineage is invalid';
      ELSIF a.amendment_id IS NULL AND a.approved_revision_id IS NULL
            AND snap ? 'amendment_id' THEN
        RAISE EXCEPTION 'Initial Activity revision has amendment lineage';
      END IF;
      SELECT outcome INTO s_out FROM pta_activity_revision_decision
        WHERE revision_id=a.current_revision_id AND stage='supervisor';
      SELECT outcome INTO v_out FROM pta_activity_revision_decision
        WHERE revision_id=a.current_revision_id AND stage='validator';
      IF (a.state='submitted' AND (s_out IS NOT NULL OR v_out IS NOT NULL))
         OR (a.state='prevalidated' AND
             (s_out IS DISTINCT FROM 'prevalidated' OR v_out IS NOT NULL))
         OR (a.state='returned_supervisor' AND
             (s_out IS DISTINCT FROM 'returned' OR v_out IS NOT NULL))
         OR (a.state='returned_validator' AND
             (s_out IS DISTINCT FROM 'prevalidated' OR v_out IS DISTINCT FROM 'returned'))
         OR (a.state IN ('approved','withdrawn') AND
             (s_out IS DISTINCT FROM 'prevalidated' OR v_out IS DISTINCT FROM 'approved'))
      THEN RAISE EXCEPTION 'Activity state does not match its current review chain';
      END IF;
      RETURN NEW;
    END $$;
    """


def previous_review_function() -> str:
    return """
    CREATE OR REPLACE FUNCTION pta_validate_activity_review_state() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE activity_row pta_activity%ROWTYPE;
    DECLARE revision_snapshot jsonb;
    DECLARE approved_supervisor_outcome text;
    DECLARE approved_supervisor_actor text;
    DECLARE approved_validator_outcome text;
    DECLARE approved_validator_actor text;
    DECLARE supervisor_outcome text;
    DECLARE validator_outcome text;
    BEGIN
      IF TG_TABLE_NAME = 'pta_activity' THEN
        activity_row := NEW;
      ELSE
        SELECT * INTO activity_row FROM pta_activity WHERE id=NEW.activity_id;
        IF activity_row.current_revision_id IS DISTINCT FROM NEW.revision_id THEN
          RAISE EXCEPTION 'Decision targets an obsolete Activity revision';
        END IF;
      END IF;
      IF activity_row.approved_revision_id IS NOT NULL THEN
        SELECT outcome,actor_id
          INTO approved_supervisor_outcome,approved_supervisor_actor
          FROM pta_activity_revision_decision
          WHERE revision_id=activity_row.approved_revision_id
            AND stage='supervisor';
        SELECT outcome,actor_id
          INTO approved_validator_outcome,approved_validator_actor
          FROM pta_activity_revision_decision
          WHERE revision_id=activity_row.approved_revision_id
            AND stage='validator';
        IF approved_supervisor_outcome IS DISTINCT FROM 'prevalidated'
           OR approved_validator_outcome IS DISTINCT FROM 'approved'
           OR approved_supervisor_actor IS NOT DISTINCT FROM
                approved_validator_actor THEN
          RAISE EXCEPTION 'Activity approved revision chain is invalid';
        END IF;
      END IF;
      IF activity_row.state IN ('draft','amendment_draft') THEN RETURN NEW; END IF;
      SELECT snapshot INTO revision_snapshot FROM pta_activity_revision
        WHERE id=activity_row.current_revision_id
          AND activity_id=activity_row.id;
      IF revision_snapshot IS NULL THEN
        RAISE EXCEPTION 'Activity current revision is missing';
      END IF;
      IF activity_row.amendment_id IS NOT NULL AND (
           revision_snapshot->>'amendment_id'
             IS DISTINCT FROM activity_row.amendment_id
           OR revision_snapshot->>'amendment_reason'
             IS DISTINCT FROM activity_row.amendment_reason
           OR revision_snapshot->>'base_approved_revision_id'
             IS DISTINCT FROM activity_row.approved_revision_id
         ) THEN
        RAISE EXCEPTION 'Activity amendment revision lineage is invalid';
      ELSIF activity_row.amendment_id IS NULL
            AND activity_row.approved_revision_id IS NULL
            AND revision_snapshot ? 'amendment_id' THEN
        RAISE EXCEPTION 'Initial Activity revision has amendment lineage';
      END IF;
      SELECT outcome INTO supervisor_outcome
        FROM pta_activity_revision_decision
        WHERE revision_id=activity_row.current_revision_id AND stage='supervisor';
      SELECT outcome INTO validator_outcome
        FROM pta_activity_revision_decision
        WHERE revision_id=activity_row.current_revision_id AND stage='validator';
      IF (activity_row.state='submitted'
            AND (supervisor_outcome IS NOT NULL OR validator_outcome IS NOT NULL))
         OR (activity_row.state='prevalidated'
            AND (supervisor_outcome IS DISTINCT FROM 'prevalidated'
                 OR validator_outcome IS NOT NULL))
         OR (activity_row.state='returned_supervisor'
            AND (supervisor_outcome IS DISTINCT FROM 'returned'
                 OR validator_outcome IS NOT NULL))
         OR (activity_row.state='returned_validator'
            AND (supervisor_outcome IS DISTINCT FROM 'prevalidated'
                 OR validator_outcome IS DISTINCT FROM 'returned'))
         OR (activity_row.state='approved'
            AND (supervisor_outcome IS DISTINCT FROM 'prevalidated'
                 OR validator_outcome IS DISTINCT FROM 'approved')) THEN
        RAISE EXCEPTION 'Activity state does not match its current review chain';
      END IF;
      RETURN NEW;
    END $$;
    """.replace("\n    ", "\n        ")


def upgrade() -> None:
    op.add_column("pta_activity", sa.Column("withdrawal_id", sa.String(36)))
    for name in (
        "activity_amendment_state",
        "activity_revision_pointer_state",
        "activity_state_allowed",
    ):
        op.drop_constraint(name, "pta_activity", type_="check")
    op.create_check_constraint(
        "activity_state_allowed",
        "pta_activity",
        "state IN ('draft','amendment_draft','submitted','prevalidated',"
        "'returned_supervisor','returned_validator','approved','withdrawn')",
    )
    op.create_check_constraint(
        "activity_revision_pointer_state",
        "pta_activity",
        "(state='draft' AND current_revision_id IS NULL AND approved_revision_id IS NULL) OR "
        "(state='amendment_draft' AND current_revision_id=approved_revision_id "
        "AND approved_revision_id IS NOT NULL) OR "
        "(state IN ('submitted','prevalidated','returned_supervisor','returned_validator') "
        "AND current_revision_id IS NOT NULL AND ((amendment_id IS NULL "
        "AND withdrawal_id IS NULL AND approved_revision_id IS NULL) OR "
        "(withdrawal_id IS NOT NULL AND amendment_id IS NULL "
        "AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id) OR "
        "(amendment_id IS NOT NULL AND withdrawal_id IS NULL "
        "AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id))) OR "
        "(state='approved' AND current_revision_id=approved_revision_id "
        "AND current_revision_id IS NOT NULL) OR "
        "(state='withdrawn' AND withdrawal_id IS NOT NULL "
        "AND current_revision_id IS NOT NULL AND approved_revision_id IS NOT NULL "
        "AND current_revision_id<>approved_revision_id)",
    )
    op.create_check_constraint(
        "activity_amendment_state",
        "pta_activity",
        "(amendment_id IS NULL AND amendment_reason IS NULL AND "
        "(approved_revision_id IS NULL OR state IN ('approved','withdrawn') "
        "OR withdrawal_id IS NOT NULL)) OR "
        "(amendment_id IS NOT NULL AND withdrawal_id IS NULL "
        "AND amendment_reason IS NOT NULL "
        "AND length(btrim(amendment_reason)) BETWEEN 1 AND 4000 "
        "AND approved_revision_id IS NOT NULL AND state<>'approved')",
    )
    op.create_check_constraint(
        "activity_withdrawal_state",
        "pta_activity",
        "(withdrawal_id IS NULL AND state<>'withdrawn') OR "
        "(withdrawal_id IS NOT NULL AND amendment_id IS NULL "
        "AND withdrawal_id ~ "
        "'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' "
        "AND approved_revision_id IS NOT NULL AND state IN "
        "('submitted','prevalidated','returned_supervisor','returned_validator','withdrawn'))",
    )
    op.execute(review_function())


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pta_activity_revision WHERE snapshot ? 'withdrawal')
         OR EXISTS (SELECT 1 FROM auth_audit WHERE action LIKE 'activity.withdrawal_%')
      THEN RAISE EXCEPTION
        'Refusing destructive PTA-2B.2A downgrade: withdrawal evidence exists';
      END IF;
    END $$;
    """)
    op.drop_constraint("activity_withdrawal_state", "pta_activity", type_="check")
    op.drop_constraint("activity_amendment_state", "pta_activity", type_="check")
    op.drop_constraint("activity_revision_pointer_state", "pta_activity", type_="check")
    op.drop_constraint("activity_state_allowed", "pta_activity", type_="check")
    op.drop_column("pta_activity", "withdrawal_id")
    op.create_check_constraint(
        "activity_state_allowed",
        "pta_activity",
        "state IN ('draft','amendment_draft','submitted','prevalidated',"
        "'returned_supervisor','returned_validator','approved')",
    )
    op.create_check_constraint(
        "activity_revision_pointer_state",
        "pta_activity",
        "(state='draft' AND current_revision_id IS NULL AND approved_revision_id IS NULL) OR "
        "(state='amendment_draft' AND current_revision_id=approved_revision_id "
        "AND approved_revision_id IS NOT NULL) OR "
        "(state IN ('submitted','prevalidated','returned_supervisor','returned_validator') "
        "AND current_revision_id IS NOT NULL AND ((amendment_id IS NULL "
        "AND approved_revision_id IS NULL) OR (amendment_id IS NOT NULL "
        "AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id))) OR "
        "(state='approved' AND current_revision_id IS NOT NULL "
        "AND approved_revision_id=current_revision_id)",
    )
    op.create_check_constraint(
        "activity_amendment_state",
        "pta_activity",
        "(amendment_id IS NULL AND amendment_reason IS NULL AND "
        "(approved_revision_id IS NULL OR state='approved')) OR "
        "(amendment_id IS NOT NULL AND amendment_reason IS NOT NULL "
        "AND length(btrim(amendment_reason)) BETWEEN 1 AND 4000 "
        "AND approved_revision_id IS NOT NULL AND state<>'approved')",
    )
    op.execute(previous_review_function())
