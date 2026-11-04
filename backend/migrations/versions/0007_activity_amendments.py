"""PTA-2B.1 approved Activity amendments.

Revision ID: 0007_pta2b1
Revises: 0006_pta2a
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0007_pta2b1"
down_revision: str | None = "0006_pta2a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("pta_activity", sa.Column("amendment_id", sa.String(36)))
    op.add_column("pta_activity", sa.Column("amendment_reason", sa.String(4000)))
    op.drop_constraint("activity_state_allowed", "pta_activity", type_="check")
    op.drop_constraint("activity_revision_pointer_state", "pta_activity", type_="check")
    op.create_check_constraint(
        "activity_state_allowed",
        "pta_activity",
        "state IN ('draft','amendment_draft','submitted','prevalidated',"
        "'returned_supervisor','returned_validator','approved')",
    )
    op.create_check_constraint(
        "activity_revision_pointer_state",
        "pta_activity",
        "(state='draft' AND current_revision_id IS NULL "
        "AND approved_revision_id IS NULL) OR "
        "(state='amendment_draft' AND current_revision_id=approved_revision_id "
        "AND approved_revision_id IS NOT NULL) OR "
        "(state IN ('submitted','prevalidated','returned_supervisor',"
        "'returned_validator') "
        "AND current_revision_id IS NOT NULL AND ((amendment_id IS NULL "
        "AND approved_revision_id IS NULL) OR (amendment_id IS NOT NULL "
        "AND approved_revision_id IS NOT NULL "
        "AND current_revision_id<>approved_revision_id))) OR "
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
    op.execute(
        """
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
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
          IF EXISTS (
            SELECT 1 FROM auth_audit
            WHERE action IN ('activity.amendment_open','activity.amendment_cancel')
          ) OR EXISTS (
            SELECT 1 FROM pta_activity_revision WHERE snapshot ? 'amendment_id'
          ) THEN
            RAISE EXCEPTION
              'Refusing destructive PTA-2B.1 downgrade: amendment evidence exists';
          END IF;
        END $$
        """
    )
    op.drop_constraint("activity_amendment_state", "pta_activity", type_="check")
    op.drop_constraint("activity_revision_pointer_state", "pta_activity", type_="check")
    op.drop_constraint("activity_state_allowed", "pta_activity", type_="check")
    op.create_check_constraint(
        "activity_state_allowed",
        "pta_activity",
        "state IN ('draft','submitted','prevalidated','returned_supervisor',"
        "'returned_validator','approved')",
    )
    op.create_check_constraint(
        "activity_revision_pointer_state",
        "pta_activity",
        "(state='draft' AND current_revision_id IS NULL "
        "AND approved_revision_id IS NULL) OR "
        "(state IN ('submitted','prevalidated','returned_supervisor',"
        "'returned_validator') "
        "AND current_revision_id IS NOT NULL AND approved_revision_id IS NULL) OR "
        "(state='approved' AND current_revision_id IS NOT NULL "
        "AND approved_revision_id=current_revision_id)",
    )
    op.drop_column("pta_activity", "amendment_reason")
    op.drop_column("pta_activity", "amendment_id")
    op.execute(
        """
        CREATE OR REPLACE FUNCTION pta_validate_activity_review_state() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE activity_row pta_activity%ROWTYPE;
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
          IF activity_row.state = 'draft' THEN RETURN NEW; END IF;
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
        """
    )
