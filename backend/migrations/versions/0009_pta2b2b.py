# ruff: noqa: E501
"""PTA-2B.2B approved cross-year Activity transfers.

Revision ID: 0009_pta2b2b
Revises: 0008_pta2b2a
"""

from importlib import import_module

import sqlalchemy as sa
from alembic import op

revision: str = "0009_pta2b2b"
down_revision: str | None = "0008_pta2b2a"
branch_labels = None
depends_on = None


def corrected_review_function() -> str:
    previous = import_module("migrations.versions.0008_pta2b2a").review_function()
    old = "OR snap->'pta' IS DISTINCT FROM base_snap->'pta'"
    new = """OR (
             snap->'pta' IS DISTINCT FROM base_snap->'pta'
             AND NOT (
               base_snap ? 'transfer'
               AND base_snap->'pta'->'id' = 'null'::jsonb
               AND snap->'pta'->>'id' IS NOT NULL
               AND snap->'pta'->>'year' IS NOT DISTINCT FROM base_snap->'pta'->>'year'
             )
           )"""
    if old not in previous:
        raise RuntimeError("0008 withdrawal comparison changed")
    return previous.replace(old, new)


def transfer_function() -> str:
    return """
    CREATE OR REPLACE FUNCTION pta_validate_activity_transfer_state() RETURNS trigger
    LANGUAGE plpgsql AS $$
    DECLARE a pta_activity%ROWTYPE;
    DECLARE snap jsonb;
    DECLARE base_snap jsonb;
    DECLARE transfer jsonb;
    BEGIN
      IF TG_TABLE_NAME='pta_activity' THEN a := NEW;
      ELSE SELECT * INTO a FROM pta_activity WHERE id=NEW.activity_id; END IF;
      IF a.id IS NULL THEN
        RAISE EXCEPTION 'Activity revision parent is invalid';
      END IF;
      IF TG_TABLE_NAME='pta_activity_revision' THEN
        IF NOT (NEW.snapshot ? 'transfer') THEN
          IF NEW.snapshot->'pta'->'id' IS NULL
             OR NEW.snapshot->'pta'->'id' = 'null'::jsonb
          THEN RAISE EXCEPTION 'Activity revision PTA purpose is invalid'; END IF;
        ELSE
          transfer := NEW.snapshot->'transfer';
          IF jsonb_typeof(transfer)<>'object'
             OR (SELECT count(*) FROM jsonb_object_keys(transfer))<>5
             OR NOT (transfer ?& ARRAY[
               'id','reason','base_approved_revision_id','source_pta','target_year'
             ])
             OR transfer->>'id' IS NULL
             OR transfer->>'id' !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
             OR nullif(btrim(transfer->>'reason'),'') IS NULL
             OR length(transfer->>'reason')>4000
             OR transfer->>'base_approved_revision_id' IS NULL
             OR jsonb_typeof(transfer->'source_pta')<>'object'
             OR (SELECT count(*) FROM jsonb_object_keys(transfer->'source_pta'))<>2
             OR NOT (transfer->'source_pta' ?& ARRAY['id','year'])
             OR transfer->'source_pta'->>'id' IS NULL
             OR transfer->'source_pta'->>'year' IS NULL
             OR transfer->>'target_year' IS NULL
             OR transfer->>'target_year' !~ '^[0-9]{4}$'
             OR NEW.snapshot->'pta'->'id' IS NULL
             OR NEW.snapshot->'pta'->'id' <> 'null'::jsonb
             OR NEW.snapshot->'pta'->>'year' IS NULL
             OR NEW.snapshot->>'planned_start' IS NULL
             OR NEW.snapshot->>'planned_end' IS NULL
             OR NEW.snapshot ? 'withdrawal'
             OR NEW.snapshot ? 'amendment_id'
          THEN RAISE EXCEPTION 'Activity transfer revision shape is invalid'; END IF;
          SELECT snapshot INTO base_snap FROM pta_activity_revision
            WHERE id=transfer->>'base_approved_revision_id'
              AND activity_id=NEW.activity_id;
          IF base_snap IS NULL
             OR transfer->>'base_approved_revision_id'
                  IS DISTINCT FROM a.approved_revision_id
             OR transfer->'source_pta'->>'id' IS DISTINCT FROM a.pta_id
             OR (transfer->'source_pta'->>'year')::integer
                  IS DISTINCT FROM a.placement_year
             OR (transfer->>'target_year')::integer <= a.placement_year
             OR (transfer->>'target_year')::integer NOT BETWEEN 2000 AND 2200
             OR (NEW.snapshot->'pta'->>'year')::integer
                  IS DISTINCT FROM (transfer->>'target_year')::integer
             OR extract(year from (NEW.snapshot->>'planned_start')::date)::integer
                  IS DISTINCT FROM (transfer->>'target_year')::integer
             OR (NEW.snapshot->>'planned_end')::date
                  < (NEW.snapshot->>'planned_start')::date
             OR NEW.snapshot->'context_id' IS DISTINCT FROM base_snap->'context_id'
             OR NEW.snapshot->'partner' IS DISTINCT FROM base_snap->'partner'
             OR NEW.snapshot->'project' IS DISTINCT FROM base_snap->'project'
             OR NEW.snapshot->'activity' IS DISTINCT FROM base_snap->'activity'
             OR NEW.snapshot->'name' IS DISTINCT FROM base_snap->'name'
             OR NEW.snapshot->'description' IS DISTINCT FROM base_snap->'description'
             OR NEW.snapshot->'allocation' IS DISTINCT FROM base_snap->'allocation'
             OR NEW.snapshot->'operations' IS DISTINCT FROM base_snap->'operations'
          THEN RAISE EXCEPTION 'Activity transfer revision lineage is invalid'; END IF;
        END IF;
      END IF;
      IF a.current_revision_id IS NULL THEN RETURN NEW; END IF;
      SELECT snapshot INTO snap FROM pta_activity_revision
        WHERE id=a.current_revision_id AND activity_id=a.id;
      transfer := snap->'transfer';
      IF a.approved_revision_id IS NOT NULL THEN
        SELECT snapshot INTO base_snap FROM pta_activity_revision
          WHERE id=a.approved_revision_id AND activity_id=a.id;
        IF base_snap IS NULL
           OR a.placement_year IS DISTINCT FROM (base_snap->'pta'->>'year')::integer
           OR (
             a.amendment_id IS NULL
             AND (
               a.planned_start IS DISTINCT FROM (base_snap->>'planned_start')::date
               OR a.planned_end IS DISTINCT FROM (base_snap->>'planned_end')::date
             )
           )
           OR (
             base_snap->'pta'->'id' <> 'null'::jsonb
             AND base_snap->'pta'->>'id' IS DISTINCT FROM a.pta_id
           )
           OR (
             base_snap->'pta'->'id' = 'null'::jsonb
             AND (
               base_snap->'transfer' IS NULL
               OR (base_snap->'transfer'->>'target_year')::integer
                    IS DISTINCT FROM a.placement_year
             )
           )
        THEN RAISE EXCEPTION 'Activity approved placement is invalid'; END IF;
      END IF;
      IF a.transfer_id IS NOT NULL THEN
        IF transfer IS NULL OR jsonb_typeof(transfer)<>'object'
           OR (SELECT count(*) FROM jsonb_object_keys(transfer))<>5
           OR transfer->>'id' IS DISTINCT FROM a.transfer_id
           OR transfer->>'base_approved_revision_id' IS DISTINCT FROM a.approved_revision_id
           OR nullif(btrim(transfer->>'reason'),'') IS NULL
           OR length(transfer->>'reason')>4000
           OR transfer->'source_pta'->>'id' IS DISTINCT FROM a.pta_id
           OR (transfer->'source_pta'->>'year')::integer IS DISTINCT FROM a.placement_year
           OR (transfer->>'target_year')::integer <= a.placement_year
           OR (transfer->>'target_year')::integer > 2200
           OR snap->'pta'->'id' <> 'null'::jsonb
           OR (snap->'pta'->>'year')::integer IS DISTINCT FROM (transfer->>'target_year')::integer
           OR extract(year from (snap->>'planned_start')::date)::integer
                IS DISTINCT FROM (transfer->>'target_year')::integer
           OR (snap->>'planned_end')::date < (snap->>'planned_start')::date
           OR snap ? 'withdrawal' OR snap ? 'amendment_id'
           OR snap->'context_id' IS DISTINCT FROM base_snap->'context_id'
           OR snap->'partner' IS DISTINCT FROM base_snap->'partner'
           OR snap->'project' IS DISTINCT FROM base_snap->'project'
           OR snap->'activity' IS DISTINCT FROM base_snap->'activity'
           OR snap->'name' IS DISTINCT FROM base_snap->'name'
           OR snap->'description' IS DISTINCT FROM base_snap->'description'
           OR snap->'allocation' IS DISTINCT FROM base_snap->'allocation'
           OR snap->'operations' IS DISTINCT FROM base_snap->'operations'
        THEN RAISE EXCEPTION 'Activity transfer revision lineage is invalid'; END IF;
      ELSIF transfer IS NOT NULL THEN
        IF a.state NOT IN ('approved','amendment_draft')
           OR a.current_revision_id<>a.approved_revision_id
           OR (snap->'pta'->>'year')::integer IS DISTINCT FROM a.placement_year
           OR (
             a.amendment_id IS NULL
             AND (
               a.planned_start IS DISTINCT FROM (snap->>'planned_start')::date
               OR a.planned_end IS DISTINCT FROM (snap->>'planned_end')::date
             )
           )
        THEN RAISE EXCEPTION 'Activity has obsolete transfer lineage'; END IF;
      END IF;
      RETURN NEW;
    END $$;
    """


def upgrade() -> None:
    op.add_column("pta_activity", sa.Column("transfer_id", sa.String(36)))
    op.add_column("pta_activity", sa.Column("placement_year", sa.Integer()))
    op.execute("""
      UPDATE pta_activity a SET placement_year=p.year
      FROM pta_annual p WHERE p.id=a.pta_id
    """)
    op.execute("SET CONSTRAINTS ALL IMMEDIATE")
    op.alter_column("pta_activity", "placement_year", nullable=False)
    op.execute("""
    DO $$ DECLARE constraint_name text; BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conrelid='pta_activity'::regclass AND contype='f'
        AND pg_get_constraintdef(oid) LIKE
          'FOREIGN KEY (context_id, pta_id, request_project_id, request_year)%';
      IF constraint_name IS NULL THEN
        RAISE EXCEPTION 'Current Activity placement foreign key is missing';
      END IF;
      EXECUTE format('ALTER TABLE pta_activity DROP CONSTRAINT %I', constraint_name);
    END $$;
    """)
    op.create_foreign_key(
        "activity_current_placement",
        "pta_activity",
        "pta_annual",
        ["context_id", "pta_id", "request_project_id", "placement_year"],
        ["context_id", "id", "project_id", "year"],
    )
    for name in (
        "activity_revision_pointer_state",
        "activity_amendment_state",
        "activity_withdrawal_state",
    ):
        op.drop_constraint(name, "pta_activity", type_="check")
    op.create_check_constraint(
        "activity_revision_pointer_state",
        "pta_activity",
        "(state='draft' AND current_revision_id IS NULL AND approved_revision_id IS NULL) OR "
        "(state='amendment_draft' AND current_revision_id=approved_revision_id AND approved_revision_id IS NOT NULL) OR "
        "(state IN ('submitted','prevalidated','returned_supervisor','returned_validator') AND current_revision_id IS NOT NULL AND ("
        "(amendment_id IS NULL AND withdrawal_id IS NULL AND transfer_id IS NULL AND approved_revision_id IS NULL) OR "
        "(amendment_id IS NOT NULL AND withdrawal_id IS NULL AND transfer_id IS NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id) OR "
        "(withdrawal_id IS NOT NULL AND amendment_id IS NULL AND transfer_id IS NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id) OR "
        "(transfer_id IS NOT NULL AND amendment_id IS NULL AND withdrawal_id IS NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id))) OR "
        "(state='approved' AND current_revision_id=approved_revision_id AND current_revision_id IS NOT NULL) OR "
        "(state='withdrawn' AND withdrawal_id IS NOT NULL AND transfer_id IS NULL AND current_revision_id IS NOT NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id)",
    )
    op.create_check_constraint(
        "activity_amendment_state",
        "pta_activity",
        "(amendment_id IS NULL AND amendment_reason IS NULL AND (approved_revision_id IS NULL OR state IN ('approved','withdrawn') OR withdrawal_id IS NOT NULL OR transfer_id IS NOT NULL)) OR "
        "(amendment_id IS NOT NULL AND withdrawal_id IS NULL AND transfer_id IS NULL AND amendment_reason IS NOT NULL AND length(btrim(amendment_reason)) BETWEEN 1 AND 4000 AND approved_revision_id IS NOT NULL AND state<>'approved')",
    )
    op.create_check_constraint(
        "activity_withdrawal_state",
        "pta_activity",
        "(withdrawal_id IS NULL AND state<>'withdrawn') OR (withdrawal_id IS NOT NULL AND amendment_id IS NULL AND transfer_id IS NULL AND withdrawal_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AND approved_revision_id IS NOT NULL AND state IN ('submitted','prevalidated','returned_supervisor','returned_validator','withdrawn'))",
    )
    op.create_check_constraint(
        "activity_transfer_state",
        "pta_activity",
        "transfer_id IS NULL OR (amendment_id IS NULL AND withdrawal_id IS NULL AND transfer_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AND approved_revision_id IS NOT NULL AND state IN ('submitted','prevalidated','returned_supervisor','returned_validator'))",
    )
    op.create_check_constraint(
        "activity_placement_year_valid",
        "pta_activity",
        "placement_year BETWEEN 2000 AND 2200 AND extract(year from planned_start)::integer=placement_year",
    )
    op.execute("""
    CREATE OR REPLACE FUNCTION pta_preserve_activity_request() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.request_actor_id IS DISTINCT FROM OLD.request_actor_id
         OR NEW.request_project_id IS DISTINCT FROM OLD.request_project_id
         OR NEW.request_year IS DISTINCT FROM OLD.request_year
         OR NEW.request_key IS DISTINCT FROM OLD.request_key
         OR NEW.request_fingerprint IS DISTINCT FROM OLD.request_fingerprint
      THEN RAISE EXCEPTION 'Activity request provenance is immutable'; END IF;
      RETURN NEW;
    END $$;
    CREATE TRIGGER activity_request_immutable BEFORE UPDATE ON pta_activity
      FOR EACH ROW EXECUTE FUNCTION pta_preserve_activity_request();
    """)
    op.execute(corrected_review_function())
    op.execute(transfer_function())
    op.execute("""
    CREATE CONSTRAINT TRIGGER activity_transfer_state_valid
      AFTER INSERT OR UPDATE ON pta_activity DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION pta_validate_activity_transfer_state();
    CREATE CONSTRAINT TRIGGER revision_transfer_state_valid
      AFTER INSERT OR UPDATE ON pta_activity_revision DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION pta_validate_activity_transfer_state();
    CREATE CONSTRAINT TRIGGER decision_transfer_state_valid
      AFTER INSERT OR UPDATE ON pta_activity_revision_decision DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION pta_validate_activity_transfer_state();
    """)


def downgrade() -> None:
    op.execute("""
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pta_activity_revision WHERE snapshot ? 'transfer')
         OR EXISTS (SELECT 1 FROM auth_audit WHERE action LIKE 'activity.transfer_%')
      THEN RAISE EXCEPTION 'Refusing destructive PTA-2B.2B downgrade: transfer evidence exists';
      END IF;
    END $$;
    """)
    op.execute(
        "DROP TRIGGER decision_transfer_state_valid ON pta_activity_revision_decision"
    )
    op.execute("DROP TRIGGER revision_transfer_state_valid ON pta_activity_revision")
    op.execute("DROP TRIGGER activity_transfer_state_valid ON pta_activity")
    op.execute("DROP FUNCTION pta_validate_activity_transfer_state()")
    op.execute("DROP TRIGGER activity_request_immutable ON pta_activity")
    op.execute("DROP FUNCTION pta_preserve_activity_request()")
    op.drop_constraint("activity_placement_year_valid", "pta_activity", type_="check")
    op.drop_constraint("activity_transfer_state", "pta_activity", type_="check")
    op.drop_constraint("activity_amendment_state", "pta_activity", type_="check")
    op.drop_constraint("activity_withdrawal_state", "pta_activity", type_="check")
    op.drop_constraint("activity_revision_pointer_state", "pta_activity", type_="check")
    op.drop_constraint("activity_current_placement", "pta_activity", type_="foreignkey")
    op.create_foreign_key(
        None,
        "pta_activity",
        "pta_annual",
        ["context_id", "pta_id", "request_project_id", "request_year"],
        ["context_id", "id", "project_id", "year"],
    )
    op.drop_column("pta_activity", "placement_year")
    op.drop_column("pta_activity", "transfer_id")
    op.create_check_constraint(
        "activity_revision_pointer_state",
        "pta_activity",
        "(state='draft' AND current_revision_id IS NULL AND approved_revision_id IS NULL) OR "
        "(state='amendment_draft' AND current_revision_id=approved_revision_id AND approved_revision_id IS NOT NULL) OR "
        "(state IN ('submitted','prevalidated','returned_supervisor','returned_validator') AND current_revision_id IS NOT NULL AND ((amendment_id IS NULL AND withdrawal_id IS NULL AND approved_revision_id IS NULL) OR "
        "(withdrawal_id IS NOT NULL AND amendment_id IS NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id) OR "
        "(amendment_id IS NOT NULL AND withdrawal_id IS NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id))) OR "
        "(state='approved' AND current_revision_id=approved_revision_id AND current_revision_id IS NOT NULL) OR "
        "(state='withdrawn' AND withdrawal_id IS NOT NULL AND current_revision_id IS NOT NULL AND approved_revision_id IS NOT NULL AND current_revision_id<>approved_revision_id)",
    )
    op.create_check_constraint(
        "activity_amendment_state",
        "pta_activity",
        "(amendment_id IS NULL AND amendment_reason IS NULL AND (approved_revision_id IS NULL OR state IN ('approved','withdrawn') OR withdrawal_id IS NOT NULL)) OR "
        "(amendment_id IS NOT NULL AND withdrawal_id IS NULL AND amendment_reason IS NOT NULL AND length(btrim(amendment_reason)) BETWEEN 1 AND 4000 AND approved_revision_id IS NOT NULL AND state<>'approved')",
    )
    op.create_check_constraint(
        "activity_withdrawal_state",
        "pta_activity",
        "(withdrawal_id IS NULL AND state<>'withdrawn') OR (withdrawal_id IS NOT NULL AND amendment_id IS NULL AND withdrawal_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AND approved_revision_id IS NOT NULL AND state IN ('submitted','prevalidated','returned_supervisor','returned_validator','withdrawn'))",
    )
    op.execute(import_module("migrations.versions.0008_pta2b2a").review_function())
