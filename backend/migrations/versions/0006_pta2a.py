"""PTA-2A immutable Activity submission and review.

Revision ID: 0006_pta2a
Revises: 0005_pta1
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006_pta2a"
down_revision: str | None = "0005_pta1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("activity_draft_only", "pta_activity", type_="check")
    op.alter_column(
        "pta_activity", "state", existing_type=sa.String(16), type_=sa.String(32)
    )
    op.add_column("pta_activity", sa.Column("current_revision_id", sa.String(36)))
    op.add_column("pta_activity", sa.Column("approved_revision_id", sa.String(36)))
    op.create_check_constraint(
        "activity_state_allowed",
        "pta_activity",
        "state IN ('draft','submitted','prevalidated','returned_supervisor',"
        "'returned_validator','approved')",
    )
    op.create_check_constraint(
        "activity_revision_pointer_state",
        "pta_activity",
        "(state = 'draft' AND current_revision_id IS NULL "
        "AND approved_revision_id IS NULL) OR "
        "(state IN ('submitted','prevalidated','returned_supervisor',"
        "'returned_validator') "
        "AND current_revision_id IS NOT NULL AND approved_revision_id IS NULL) OR "
        "(state = 'approved' AND current_revision_id IS NOT NULL "
        "AND approved_revision_id = current_revision_id)",
    )

    op.create_table(
        "pta_activity_contributor",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column(
            "user_id", sa.String(36), sa.ForeignKey("auth_user.id"), nullable=False
        ),
        sa.Column("contributed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.UniqueConstraint("activity_id", "user_id", name="activity_contributor_once"),
    )
    op.create_table(
        "pta_activity_revision",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(), nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column(
            "submitter_id", sa.String(36), sa.ForeignKey("auth_user.id"), nullable=False
        ),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        sa.UniqueConstraint("activity_id", "id", name="activity_revision_identity"),
        sa.UniqueConstraint(
            "context_id", "activity_id", "id", name="activity_revision_scope"
        ),
        sa.UniqueConstraint(
            "activity_id", "revision_number", name="activity_revision_number"
        ),
        sa.CheckConstraint("revision_number > 0", name="revision_number_positive"),
        sa.CheckConstraint(
            "octet_length(snapshot::text) <= 1048576",
            name="revision_snapshot_bounded",
        ),
    )
    op.create_table(
        "pta_activity_revision_decision",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("context_id", sa.String(3), nullable=False),
        sa.Column("activity_id", sa.String(36), nullable=False),
        sa.Column("revision_id", sa.String(36), nullable=False),
        sa.Column("stage", sa.String(16), nullable=False),
        sa.Column("outcome", sa.String(16), nullable=False),
        sa.Column(
            "actor_id", sa.String(36), sa.ForeignKey("auth_user.id"), nullable=False
        ),
        sa.Column("actor_role", sa.String(32), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reason", sa.String(4000)),
        sa.Column("requested_amount", sa.BigInteger()),
        sa.Column("prevalidation_revision_id", sa.String(36)),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id", "revision_id"],
            [
                "pta_activity_revision.context_id",
                "pta_activity_revision.activity_id",
                "pta_activity_revision.id",
            ],
        ),
        sa.ForeignKeyConstraint(
            ["context_id", "activity_id", "prevalidation_revision_id"],
            [
                "pta_activity_revision.context_id",
                "pta_activity_revision.activity_id",
                "pta_activity_revision.id",
            ],
        ),
        sa.UniqueConstraint("revision_id", "stage", name="revision_decision_stage"),
        sa.CheckConstraint(
            "stage IN ('supervisor','validator')", name="decision_stage_allowed"
        ),
        sa.CheckConstraint(
            "outcome IN ('prevalidated','approved','returned')",
            name="decision_outcome_allowed",
        ),
        sa.CheckConstraint(
            "(stage = 'supervisor' AND outcome IN ('prevalidated','returned') "
            "AND actor_role = 'AGENT_VERIFICATEUR') OR "
            "(stage = 'validator' AND outcome IN ('approved','returned') "
            "AND actor_role = 'VALIDATEUR_DEFINITIF')",
            name="decision_stage_role_outcome",
        ),
        sa.CheckConstraint(
            "(outcome = 'returned' AND reason IS NOT NULL "
            "AND length(btrim(reason)) BETWEEN 1 AND 4000) "
            "OR (outcome <> 'returned' AND reason IS NULL)",
            name="decision_reason_required",
        ),
        sa.CheckConstraint(
            "requested_amount IS NULL OR requested_amount > 0",
            name="decision_requested_amount_positive",
        ),
        sa.CheckConstraint(
            "(stage = 'validator' AND outcome = 'returned') "
            "OR requested_amount IS NULL",
            name="decision_requested_amount_scope",
        ),
        sa.CheckConstraint(
            "(stage = 'validator' AND outcome = 'approved' "
            "AND prevalidation_revision_id = revision_id) "
            "OR (outcome <> 'approved' AND prevalidation_revision_id IS NULL)",
            name="decision_prevalidation_scope",
        ),
    )
    op.create_foreign_key(
        "activity_current_revision_same_activity",
        "pta_activity",
        "pta_activity_revision",
        ["id", "current_revision_id"],
        ["activity_id", "id"],
    )
    op.create_foreign_key(
        "activity_approved_revision_same_activity",
        "pta_activity",
        "pta_activity_revision",
        ["id", "approved_revision_id"],
        ["activity_id", "id"],
    )

    # Abort rather than guessing if a PTA-1 Activity has an incomplete audit chain.
    op.execute(
        """
        DO $$
        DECLARE row record;
        DECLARE latest_after jsonb;
        DECLARE persisted_operations jsonb;
        DECLARE persisted_agents jsonb;
        DECLARE audit_tombstones bigint;
        DECLARE persisted_tombstones bigint;
        BEGIN
          FOR row IN SELECT id, creator_id, version, created_at FROM pta_activity LOOP
            SELECT business->'after' INTO latest_after FROM auth_audit
              WHERE target=row.id AND outcome='ok'
                AND action IN
                  ('activity.create','activity.replace','activity.assign_agents')
              ORDER BY (business->'after'->>'version')::integer DESC LIMIT 1;
            SELECT coalesce(jsonb_agg(jsonb_build_object(
                       'id',id,'type_id',type_id,'name',name,
                       'allocation',allocation::text,'position',position)
                       ORDER BY position),'[]'::jsonb)
              INTO persisted_operations FROM pta_operation
              WHERE activity_id=row.id AND removed_at IS NULL;
            SELECT coalesce(jsonb_agg(to_jsonb(agent_id) ORDER BY agent_id),'[]'::jsonb)
              INTO persisted_agents FROM pta_activity_agent_assignment
              WHERE activity_id=row.id AND ended_at IS NULL;
            SELECT count(*) INTO audit_tombstones
              FROM auth_audit a
              CROSS JOIN LATERAL jsonb_array_elements(
                coalesce(a.business->'removed_operations','[]'::jsonb)) removed
              WHERE a.target=row.id AND a.outcome='ok'
                AND a.action='activity.replace';
            SELECT count(*) INTO persisted_tombstones FROM pta_operation
              WHERE activity_id=row.id AND removed_at IS NOT NULL;
            IF (SELECT count(*) FROM auth_audit
                WHERE target=row.id AND outcome='ok'
                  AND action IN
                    ('activity.create','activity.replace','activity.assign_agents'))
               <> row.version
               OR (SELECT count(DISTINCT (business->'after'->>'version')::integer)
                   FROM auth_audit WHERE target=row.id AND outcome='ok'
                     AND action IN
                       ('activity.create','activity.replace','activity.assign_agents'))
                  <> row.version
               OR (SELECT min((business->'after'->>'version')::integer)
                   FROM auth_audit WHERE target=row.id AND outcome='ok'
                     AND action IN
                       ('activity.create','activity.replace',
                        'activity.assign_agents')) <> 1
               OR (SELECT max((business->'after'->>'version')::integer)
                   FROM auth_audit WHERE target=row.id AND outcome='ok'
                     AND action IN
                       ('activity.create','activity.replace','activity.assign_agents'))
                  <> row.version
               OR (SELECT count(*) FROM auth_audit
                   WHERE target=row.id AND outcome='ok'
                     AND action='activity.create' AND actor=row.creator_id) <> 1
               OR NOT EXISTS (
                    SELECT 1 FROM auth_audit WHERE target=row.id AND outcome='ok'
                      AND action='activity.create'
                      AND (business->'after'->>'version')::integer=1)
               OR EXISTS (
                    SELECT 1 FROM auth_audit a
                    WHERE a.target=row.id AND a.outcome='ok'
                      AND a.action IN ('activity.replace','activity.assign_agents')
                      AND (a.business->'before'->>'version')::integer + 1
                          <> (a.business->'after'->>'version')::integer)
               OR EXISTS (
                    SELECT 1 FROM (
                      SELECT action, business,
                        lag(business->'after') OVER (
                          ORDER BY (business->'after'->>'version')::integer
                        ) prior
                      FROM auth_audit WHERE target=row.id AND outcome='ok'
                        AND action IN
                          ('activity.create','activity.replace','activity.assign_agents')
                    ) chain
                    WHERE action <> 'activity.create'
                      AND (prior::jsonb - 'allowed_actions'::text) IS DISTINCT FROM
                          ((business->'before')::jsonb - 'allowed_actions'::text))
               OR EXISTS (
                    SELECT 1 FROM pta_activity current
                    WHERE current.id=row.id AND (
                      latest_after->>'id' IS DISTINCT FROM current.id
                      OR latest_after->>'pta_id' IS DISTINCT FROM current.pta_id
                      OR latest_after->>'reference' IS DISTINCT FROM current.reference
                      OR latest_after->>'name' IS DISTINCT FROM current.name
                      OR latest_after->>'description'
                           IS DISTINCT FROM current.description
                      OR latest_after->>'planned_start'
                           IS DISTINCT FROM current.planned_start::text
                      OR latest_after->>'planned_end'
                           IS DISTINCT FROM current.planned_end::text
                      OR latest_after->>'allocation'
                           IS DISTINCT FROM current.allocation::text
                      OR latest_after->>'state' IS DISTINCT FROM current.state
                      OR (latest_after->>'version')::integer
                           IS DISTINCT FROM current.version
                      OR latest_after->'operations'
                           IS DISTINCT FROM persisted_operations
                      OR latest_after->'agent_ids' IS DISTINCT FROM persisted_agents))
               OR audit_tombstones <> persisted_tombstones
               OR EXISTS (
                    SELECT 1 FROM auth_audit a
                    CROSS JOIN LATERAL jsonb_array_elements(
                      coalesce(a.business->'removed_operations','[]'::jsonb)) removed
                    LEFT JOIN LATERAL (
                      SELECT prior_operation
                      FROM jsonb_array_elements(
                        coalesce(a.business->'before'->'operations','[]'::jsonb)
                      ) prior_operation
                      WHERE prior_operation->>'id'=removed->>'id'
                    ) prior ON true
                    LEFT JOIN pta_operation operation
                      ON operation.id=removed->>'id'
                     AND operation.activity_id=row.id
                     AND operation.removed_at IS NOT NULL
                    WHERE a.target=row.id AND a.outcome='ok'
                      AND a.action='activity.replace'
                      AND (operation.id IS NULL OR prior IS NULL
                        OR operation.type_id <> prior.prior_operation->>'type_id'
                        OR operation.name <> prior.prior_operation->>'name'
                        OR operation.allocation::text
                             <> prior.prior_operation->>'allocation'
                        OR operation.position
                             <> (prior.prior_operation->>'position')::integer
                        OR operation.position <> (removed->>'position')::integer
                        OR operation.removed_by_id
                             IS DISTINCT FROM removed->>'removed_by_id'
                        OR operation.removed_at
                             IS DISTINCT FROM (removed->>'removed_at')::timestamptz))
            THEN
              RAISE EXCEPTION 'Incomplete PTA-1 Activity audit chain for %', row.id;
            END IF;
            INSERT INTO pta_activity_contributor
              (id,context_id,activity_id,user_id,contributed_at)
              VALUES
                (gen_random_uuid()::text,'MJL',row.id,row.creator_id,row.created_at);
            INSERT INTO pta_activity_contributor
              (id,context_id,activity_id,user_id,contributed_at)
              SELECT gen_random_uuid()::text,'MJL',row.id,a.actor,a.occurred_at
              FROM auth_audit a
              WHERE a.target=row.id AND a.outcome='ok'
                AND a.action='activity.replace'
                AND jsonb_build_object(
                  'name',a.business->'before'->'name',
                  'description',a.business->'before'->'description',
                  'planned_start',a.business->'before'->'planned_start',
                  'planned_end',a.business->'before'->'planned_end',
                  'allocation',a.business->'before'->'allocation',
                  'operations',a.business->'before'->'operations')
                  IS DISTINCT FROM
                    jsonb_build_object(
                  'name',a.business->'after'->'name',
                  'description',a.business->'after'->'description',
                  'planned_start',a.business->'after'->'planned_start',
                  'planned_end',a.business->'after'->'planned_end',
                  'allocation',a.business->'after'->'allocation',
                  'operations',a.business->'after'->'operations')
              ON CONFLICT (activity_id,user_id) DO NOTHING;
          END LOOP;
        END $$
        """
    )

    op.execute(
        """
        CREATE FUNCTION pta_reject_immutable() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          RAISE EXCEPTION 'immutable PTA review evidence';
        END $$;
        CREATE TRIGGER revision_immutable BEFORE UPDATE OR DELETE
          ON pta_activity_revision FOR EACH ROW EXECUTE FUNCTION pta_reject_immutable();
        CREATE TRIGGER decision_immutable BEFORE UPDATE OR DELETE
          ON pta_activity_revision_decision FOR EACH ROW
          EXECUTE FUNCTION pta_reject_immutable();
        CREATE TRIGGER contributor_immutable BEFORE UPDATE OR DELETE
          ON pta_activity_contributor FOR EACH ROW
          EXECUTE FUNCTION pta_reject_immutable();

        CREATE FUNCTION pta_validate_final_decision() RETURNS trigger
        LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.stage='validator' AND NEW.outcome='approved' AND NOT EXISTS (
            SELECT 1 FROM pta_activity_revision_decision p
            WHERE p.revision_id=NEW.revision_id AND p.stage='supervisor'
              AND p.outcome='prevalidated' AND p.actor_id<>NEW.actor_id
          ) THEN
            RAISE EXCEPTION 'final approval requires distinct successful prevalidation';
          END IF;
          RETURN NEW;
        END $$;
        CREATE CONSTRAINT TRIGGER final_decision_valid
          AFTER INSERT ON pta_activity_revision_decision
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
          EXECUTE FUNCTION pta_validate_final_decision();

        CREATE FUNCTION pta_validate_activity_review_state() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE activity_row pta_activity%ROWTYPE;
        DECLARE supervisor_outcome text;
        DECLARE validator_outcome text;
        BEGIN
          IF TG_TABLE_NAME = 'pta_activity' THEN
            activity_row := NEW;
          ELSE
            SELECT * INTO activity_row FROM pta_activity
              WHERE id = NEW.activity_id;
            IF activity_row.current_revision_id IS DISTINCT FROM NEW.revision_id THEN
              RAISE EXCEPTION 'Decision targets an obsolete Activity revision';
            END IF;
          END IF;
          IF activity_row.state = 'draft' THEN
            RETURN NEW;
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
        CREATE CONSTRAINT TRIGGER activity_review_state_valid
          AFTER INSERT OR UPDATE ON pta_activity
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
          EXECUTE FUNCTION pta_validate_activity_review_state();
        CREATE CONSTRAINT TRIGGER decision_activity_state_valid
          AFTER INSERT ON pta_activity_revision_decision
          DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
          EXECUTE FUNCTION pta_validate_activity_review_state();
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
          IF EXISTS (SELECT 1 FROM pta_activity_revision) THEN
            RAISE EXCEPTION
              'Refusing destructive PTA-2A downgrade: immutable review evidence exists';
          END IF;
        END $$
        """
    )
    op.execute(
        "DROP TRIGGER decision_activity_state_valid ON pta_activity_revision_decision"
    )
    op.execute("DROP TRIGGER activity_review_state_valid ON pta_activity")
    op.execute("DROP TRIGGER final_decision_valid ON pta_activity_revision_decision")
    op.execute("DROP TRIGGER contributor_immutable ON pta_activity_contributor")
    op.execute("DROP TRIGGER decision_immutable ON pta_activity_revision_decision")
    op.execute("DROP TRIGGER revision_immutable ON pta_activity_revision")
    op.execute("DROP FUNCTION pta_validate_final_decision()")
    op.execute("DROP FUNCTION pta_validate_activity_review_state()")
    op.execute("DROP FUNCTION pta_reject_immutable()")
    op.drop_constraint(
        "activity_approved_revision_same_activity", "pta_activity", type_="foreignkey"
    )
    op.drop_constraint(
        "activity_current_revision_same_activity", "pta_activity", type_="foreignkey"
    )
    op.drop_table("pta_activity_revision_decision")
    op.drop_table("pta_activity_revision")
    op.drop_table("pta_activity_contributor")
    op.drop_constraint("activity_revision_pointer_state", "pta_activity", type_="check")
    op.drop_constraint("activity_state_allowed", "pta_activity", type_="check")
    op.drop_column("pta_activity", "approved_revision_id")
    op.drop_column("pta_activity", "current_revision_id")
    op.alter_column(
        "pta_activity", "state", existing_type=sa.String(32), type_=sa.String(16)
    )
    op.create_check_constraint("activity_draft_only", "pta_activity", "state = 'draft'")
