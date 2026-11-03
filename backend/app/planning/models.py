from datetime import date, datetime
from uuid import uuid4

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.auth.models import Base


def identifier() -> str:
    return str(uuid4())


class OwnershipContext(Base):
    __tablename__ = "mjl_ownership_context"
    __table_args__ = (
        CheckConstraint("id = 'MJL'", name="ownership_context_singleton"),
    )
    id: Mapped[str] = mapped_column(String(3), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Partner(Base):
    __tablename__ = "pta_partner"
    __table_args__ = (UniqueConstraint("context_id", "id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(ForeignKey("mjl_ownership_context.id"))
    name: Mapped[str] = mapped_column(String(200))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    creator_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class OperationType(Base):
    __tablename__ = "pta_operation_type"
    __table_args__ = (UniqueConstraint("context_id", "id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(ForeignKey("mjl_ownership_context.id"))
    label: Mapped[str] = mapped_column(String(200))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    creator_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Project(Base):
    __tablename__ = "pta_project"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "partner_id"], ["pta_partner.context_id", "pta_partner.id"]
        ),
        UniqueConstraint("context_id", "id"),
        CheckConstraint("state IN ('active','closed')", name="project_state_allowed"),
        CheckConstraint("version > 0", name="project_version_positive"),
        Index(
            "project_one_active_per_partner",
            "context_id",
            "partner_id",
            unique=True,
            postgresql_where=text("state = 'active'"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    partner_id: Mapped[str] = mapped_column(String(36))
    reference: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    state: Mapped[str] = mapped_column(String(16), default="active")
    version: Mapped[int] = mapped_column(default=1)
    creator_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AnnualPTA(Base):
    __tablename__ = "pta_annual"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "project_id"], ["pta_project.context_id", "pta_project.id"]
        ),
        UniqueConstraint("context_id", "id"),
        UniqueConstraint(
            "context_id", "id", "project_id", "year", name="pta_scope_identity"
        ),
        UniqueConstraint("context_id", "project_id", "year", name="pta_project_year"),
        CheckConstraint("year BETWEEN 2000 AND 2200", name="pta_year_allowed"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    project_id: Mapped[str] = mapped_column(String(36))
    year: Mapped[int] = mapped_column()
    creator_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Activity(Base):
    __tablename__ = "pta_activity"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "pta_id", "request_project_id", "placement_year"],
            [
                "pta_annual.context_id",
                "pta_annual.id",
                "pta_annual.project_id",
                "pta_annual.year",
            ],
        ),
        ForeignKeyConstraint(
            ["id", "current_revision_id"],
            ["pta_activity_revision.activity_id", "pta_activity_revision.id"],
            name="activity_current_revision_same_activity",
            use_alter=True,
        ),
        ForeignKeyConstraint(
            ["id", "approved_revision_id"],
            ["pta_activity_revision.activity_id", "pta_activity_revision.id"],
            name="activity_approved_revision_same_activity",
            use_alter=True,
        ),
        UniqueConstraint("context_id", "id"),
        UniqueConstraint(
            "context_id",
            "request_actor_id",
            "request_project_id",
            "request_year",
            "request_key",
            name="activity_request_key",
        ),
        CheckConstraint(
            "state IN ('draft','amendment_draft','submitted','prevalidated',"
            "'returned_supervisor',"
            "'returned_validator','approved','withdrawn','closed')",
            name="activity_state_allowed",
        ),
        CheckConstraint(
            "(state = 'draft' AND current_revision_id IS NULL "
            "AND approved_revision_id IS NULL) OR "
            "(state = 'amendment_draft' AND current_revision_id = approved_revision_id "
            "AND approved_revision_id IS NOT NULL) OR "
            "(state IN ('submitted','prevalidated','returned_supervisor',"
            "'returned_validator') "
            "AND current_revision_id IS NOT NULL AND ((amendment_id IS NULL "
            "AND withdrawal_id IS NULL AND transfer_id IS NULL "
            "AND approved_revision_id IS NULL) OR "
            "(withdrawal_id IS NOT NULL AND amendment_id IS NULL "
            "AND transfer_id IS NULL "
            "AND approved_revision_id IS NOT NULL "
            "AND current_revision_id <> approved_revision_id) OR "
            "(amendment_id IS NOT NULL "
            "AND withdrawal_id IS NULL AND transfer_id IS NULL "
            "AND approved_revision_id IS NOT NULL "
            "AND current_revision_id <> approved_revision_id) OR "
            "(transfer_id IS NOT NULL AND amendment_id IS NULL "
            "AND withdrawal_id IS NULL "
            "AND approved_revision_id IS NOT NULL "
            "AND current_revision_id <> approved_revision_id))) OR "
            "(state = 'approved' AND current_revision_id IS NOT NULL "
            "AND approved_revision_id = current_revision_id) OR "
            "(state = 'closed' AND current_revision_id IS NOT NULL "
            "AND approved_revision_id = current_revision_id) OR "
            "(state = 'withdrawn' AND current_revision_id IS NOT NULL "
            "AND approved_revision_id IS NOT NULL "
            "AND current_revision_id <> approved_revision_id "
            "AND withdrawal_id IS NOT NULL)",
            name="activity_revision_pointer_state",
        ),
        CheckConstraint(
            "(amendment_id IS NULL AND amendment_reason IS NULL AND "
            "(approved_revision_id IS NULL OR state IN "
            "('approved','withdrawn','closed') "
            "OR withdrawal_id IS NOT NULL OR transfer_id IS NOT NULL)) OR "
            "(amendment_id IS NOT NULL AND withdrawal_id IS NULL "
            "AND transfer_id IS NULL AND amendment_reason IS NOT NULL "
            "AND length(btrim(amendment_reason)) BETWEEN 1 AND 4000 "
            "AND approved_revision_id IS NOT NULL AND state <> 'approved')",
            name="activity_amendment_state",
        ),
        CheckConstraint(
            "(withdrawal_id IS NULL AND state <> 'withdrawn') OR "
            "(withdrawal_id IS NOT NULL AND amendment_id IS NULL "
            "AND transfer_id IS NULL "
            "AND withdrawal_id ~ "
            "'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' "
            "AND approved_revision_id IS NOT NULL AND state IN "
            "('submitted','prevalidated','returned_supervisor',"
            "'returned_validator','withdrawn'))",
            name="activity_withdrawal_state",
        ),
        CheckConstraint(
            "transfer_id IS NULL OR (amendment_id IS NULL AND withdrawal_id IS NULL "
            "AND transfer_id ~ "
            "'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' "
            "AND approved_revision_id IS NOT NULL AND state IN "
            "('submitted','prevalidated','returned_supervisor','returned_validator'))",
            name="activity_transfer_state",
        ),
        CheckConstraint(
            "placement_year BETWEEN 2000 AND 2200 AND "
            "extract(year from planned_start)::integer = placement_year",
            name="activity_placement_year_valid",
        ),
        CheckConstraint("version > 0", name="activity_version_positive"),
        CheckConstraint(
            "(state='closed' AND closed_at IS NOT NULL "
            "AND closed_by_id IS NOT NULL) OR "
            "(state<>'closed' AND closed_at IS NULL AND closed_by_id IS NULL)",
            name="activity_closure_facts",
        ),
        CheckConstraint("allocation > 0", name="activity_allocation_positive"),
        CheckConstraint("planned_end >= planned_start", name="activity_dates_ordered"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    pta_id: Mapped[str] = mapped_column(String(36))
    reference: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(4000))
    planned_start: Mapped[date] = mapped_column(Date)
    planned_end: Mapped[date] = mapped_column(Date)
    allocation: Mapped[int] = mapped_column(BigInteger)
    state: Mapped[str] = mapped_column(String(32), default="draft")
    current_revision_id: Mapped[str | None] = mapped_column(String(36))
    approved_revision_id: Mapped[str | None] = mapped_column(String(36))
    amendment_id: Mapped[str | None] = mapped_column(String(36))
    amendment_reason: Mapped[str | None] = mapped_column(String(4000))
    withdrawal_id: Mapped[str | None] = mapped_column(String(36))
    transfer_id: Mapped[str | None] = mapped_column(String(36))
    placement_year: Mapped[int] = mapped_column(Integer)
    version: Mapped[int] = mapped_column(default=1)
    creator_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    request_actor_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    request_project_id: Mapped[str] = mapped_column(String(36))
    request_year: Mapped[int] = mapped_column()
    request_key: Mapped[str] = mapped_column(String(36))
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_by_id: Mapped[str | None] = mapped_column(ForeignKey("auth_user.id"))


class Operation(Base):
    __tablename__ = "pta_operation"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        ForeignKeyConstraint(
            ["context_id", "type_id"],
            ["pta_operation_type.context_id", "pta_operation_type.id"],
        ),
        UniqueConstraint("context_id", "id"),
        Index(
            "operation_current_position",
            "activity_id",
            "position",
            unique=True,
            postgresql_where=text("removed_at IS NULL"),
        ),
        CheckConstraint("allocation > 0", name="operation_allocation_positive"),
        CheckConstraint("position > 0", name="operation_position_positive"),
        CheckConstraint(
            "actual_spent IS NULL OR actual_spent >= 0",
            name="operation_actual_spent_nonnegative",
        ),
        CheckConstraint(
            "execution_started_at IS NOT NULL OR "
            "(execution_completed=false AND actual_spent IS NULL "
            "AND execution_observation='')",
            name="operation_execution_started_before_facts",
        ),
        CheckConstraint(
            "execution_completed=false OR actual_spent IS NOT NULL",
            name="operation_completion_has_amount",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    type_id: Mapped[str] = mapped_column(String(36))
    name: Mapped[str] = mapped_column(String(200))
    allocation: Mapped[int] = mapped_column(BigInteger)
    position: Mapped[int] = mapped_column()
    creator_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    updated_by_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    removed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_by_id: Mapped[str | None] = mapped_column(ForeignKey("auth_user.id"))
    execution_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    execution_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    actual_spent: Mapped[int | None] = mapped_column(BigInteger)
    execution_observation: Mapped[str] = mapped_column(String(4000), default="")


class ActivityAssignment(Base):
    __tablename__ = "pta_activity_agent_assignment"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        Index(
            "assignment_one_current",
            "activity_id",
            "agent_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    agent_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    assigned_by_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_by_id: Mapped[str | None] = mapped_column(ForeignKey("auth_user.id"))


class ActivityReminder(Base):
    __tablename__ = "pta_activity_reminder"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        ForeignKeyConstraint(
            ["activity_id", "approved_revision_id"],
            ["pta_activity_revision.activity_id", "pta_activity_revision.id"],
        ),
        UniqueConstraint(
            "activity_id", "agent_id", "planned_end", name="reminder_cycle_once"
        ),
        CheckConstraint("due_on = planned_end - 21", name="reminder_due_date"),
        CheckConstraint(
            "email_status IN ('unconfirmed','delivered','failed','skipped')",
            name="reminder_email_status_allowed",
        ),
        CheckConstraint("version > 0", name="reminder_version_positive"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    approved_revision_id: Mapped[str] = mapped_column(String(36))
    agent_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    planned_end: Mapped[date] = mapped_column(Date)
    due_on: Mapped[date] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    email_status: Mapped[str] = mapped_column(String(16), default="unconfirmed")
    email_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(default=1)


class ActivityDocument(Base):
    __tablename__ = "pta_activity_document"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        CheckConstraint(
            "byte_size > 0 AND byte_size <= 20971520", name="document_size"
        ),
        CheckConstraint(
            "media_type IN ('application/pdf','image/jpeg','image/png')",
            name="document_media_type",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    display_name: Mapped[str] = mapped_column(String(200))
    media_type: Mapped[str] = mapped_column(String(32))
    byte_size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64))
    content: Mapped[bytes] = mapped_column(LargeBinary)
    uploaded_by_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ActivityDocumentWithdrawal(Base):
    __tablename__ = "pta_activity_document_withdrawal"
    __table_args__ = (
        CheckConstraint(
            "length(btrim(reason)) BETWEEN 1 AND 4000",
            name="document_withdrawal_reason",
        ),
        CheckConstraint(
            "replacement_document_id IS NULL OR replacement_document_id <> document_id",
            name="document_withdrawal_not_self",
        ),
    )
    document_id: Mapped[str] = mapped_column(
        ForeignKey("pta_activity_document.id"), primary_key=True
    )
    replacement_document_id: Mapped[str | None] = mapped_column(
        ForeignKey("pta_activity_document.id")
    )
    reason: Mapped[str] = mapped_column(String(4000))
    withdrawn_by_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    withdrawn_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ActivityContributor(Base):
    __tablename__ = "pta_activity_contributor"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        UniqueConstraint("activity_id", "user_id", name="activity_contributor_once"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    user_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    contributed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ActivityRevision(Base):
    __tablename__ = "pta_activity_revision"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        UniqueConstraint("activity_id", "id", name="activity_revision_identity"),
        UniqueConstraint(
            "context_id", "activity_id", "id", name="activity_revision_scope"
        ),
        UniqueConstraint(
            "activity_id", "revision_number", name="activity_revision_number"
        ),
        CheckConstraint("revision_number > 0", name="revision_number_positive"),
        CheckConstraint(
            "octet_length(snapshot::text) <= 1048576",
            name="revision_snapshot_bounded",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    revision_number: Mapped[int] = mapped_column(Integer)
    snapshot: Mapped[dict[str, object]] = mapped_column(JSONB)
    fingerprint: Mapped[str] = mapped_column(String(64))
    submitter_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ActivityRevisionDecision(Base):
    __tablename__ = "pta_activity_revision_decision"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id", "revision_id"],
            [
                "pta_activity_revision.context_id",
                "pta_activity_revision.activity_id",
                "pta_activity_revision.id",
            ],
        ),
        ForeignKeyConstraint(
            ["context_id", "activity_id", "prevalidation_revision_id"],
            [
                "pta_activity_revision.context_id",
                "pta_activity_revision.activity_id",
                "pta_activity_revision.id",
            ],
        ),
        UniqueConstraint("revision_id", "stage", name="revision_decision_stage"),
        CheckConstraint(
            "stage IN ('supervisor','validator')", name="decision_stage_allowed"
        ),
        CheckConstraint(
            "outcome IN ('prevalidated','approved','returned')",
            name="decision_outcome_allowed",
        ),
        CheckConstraint(
            "(stage = 'supervisor' AND outcome IN ('prevalidated','returned') "
            "AND actor_role = 'AGENT_VERIFICATEUR') OR "
            "(stage = 'validator' AND outcome IN ('approved','returned') "
            "AND actor_role = 'VALIDATEUR_DEFINITIF')",
            name="decision_stage_role_outcome",
        ),
        CheckConstraint(
            "(outcome = 'returned' AND reason IS NOT NULL "
            "AND length(btrim(reason)) BETWEEN 1 AND 4000) "
            "OR (outcome <> 'returned' AND reason IS NULL)",
            name="decision_reason_required",
        ),
        CheckConstraint(
            "requested_amount IS NULL OR requested_amount > 0",
            name="decision_requested_amount_positive",
        ),
        CheckConstraint(
            "(stage = 'validator' AND outcome = 'returned') "
            "OR requested_amount IS NULL",
            name="decision_requested_amount_scope",
        ),
        CheckConstraint(
            "(stage = 'validator' AND outcome = 'approved' "
            "AND prevalidation_revision_id = revision_id) "
            "OR (outcome <> 'approved' AND prevalidation_revision_id IS NULL)",
            name="decision_prevalidation_scope",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    revision_id: Mapped[str] = mapped_column(String(36))
    stage: Mapped[str] = mapped_column(String(16))
    outcome: Mapped[str] = mapped_column(String(16))
    actor_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    actor_role: Mapped[str] = mapped_column(String(32))
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(4000))
    requested_amount: Mapped[int | None] = mapped_column(BigInteger)
    prevalidation_revision_id: Mapped[str | None] = mapped_column(String(36))


class DisbursementRequest(Base):
    __tablename__ = "pta_disbursement_request"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        ForeignKeyConstraint(
            ["activity_id", "approved_revision_id"],
            ["pta_activity_revision.activity_id", "pta_activity_revision.id"],
        ),
        UniqueConstraint("activity_id", "id", name="disbursement_request_scope"),
        CheckConstraint(
            "state IN ('submitted','prevalidated','returned','approved','cancelled')",
            name="disbursement_request_state_allowed",
        ),
        CheckConstraint("amount > 0", name="disbursement_amount_positive"),
        CheckConstraint(
            "octet_length(snapshot::text) <= 1048576",
            name="disbursement_snapshot_bounded",
        ),
        CheckConstraint(
            "(state='cancelled' AND cancelled_by_id IS NOT NULL AND "
            "cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND "
            "length(btrim(cancellation_reason)) BETWEEN 1 AND 4000) OR "
            "(state<>'cancelled' AND cancelled_by_id IS NULL AND "
            "cancelled_at IS NULL AND cancellation_reason IS NULL)",
            name="disbursement_cancellation_facts",
        ),
        Index(
            "disbursement_one_open_per_activity",
            "activity_id",
            unique=True,
            postgresql_where=text("state NOT IN ('returned', 'cancelled')"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    approved_revision_id: Mapped[str] = mapped_column(String(36))
    snapshot: Mapped[dict[str, object]] = mapped_column(JSONB)
    amount: Mapped[int] = mapped_column(BigInteger)
    submitter_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(16), default="submitted")
    cancelled_by_id: Mapped[str | None] = mapped_column(ForeignKey("auth_user.id"))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(String(4000))


class ZeroSpendingDeclaration(Base):
    __tablename__ = "pta_zero_spending_declaration"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        ForeignKeyConstraint(
            ["activity_id", "approved_revision_id"],
            ["pta_activity_revision.activity_id", "pta_activity_revision.id"],
        ),
        UniqueConstraint("activity_id", "id", name="zero_spending_declaration_scope"),
        CheckConstraint(
            "state IN ('submitted','prevalidated','returned','approved')",
            name="zero_spending_state_allowed",
        ),
        CheckConstraint(
            "length(btrim(reason)) BETWEEN 1 AND 4000",
            name="zero_spending_reason_required",
        ),
        CheckConstraint(
            "octet_length(snapshot::text) <= 1048576",
            name="zero_spending_snapshot_bounded",
        ),
        Index(
            "zero_spending_one_current_per_activity",
            "activity_id",
            unique=True,
            postgresql_where=text("state <> 'returned'"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    approved_revision_id: Mapped[str] = mapped_column(String(36))
    snapshot: Mapped[dict[str, object]] = mapped_column(JSONB)
    reason: Mapped[str] = mapped_column(String(4000))
    submitter_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(16), default="submitted")


class ZeroSpendingDecision(Base):
    __tablename__ = "pta_zero_spending_decision"
    __table_args__ = (
        ForeignKeyConstraint(
            ["activity_id", "declaration_id"],
            [
                "pta_zero_spending_declaration.activity_id",
                "pta_zero_spending_declaration.id",
            ],
        ),
        ForeignKeyConstraint(
            ["declaration_id", "prevalidation_decision_id"],
            [
                "pta_zero_spending_decision.declaration_id",
                "pta_zero_spending_decision.id",
            ],
            use_alter=True,
        ),
        UniqueConstraint("declaration_id", "id", name="zero_spending_decision_scope"),
        UniqueConstraint(
            "declaration_id", "stage", name="zero_spending_decision_stage"
        ),
        CheckConstraint(
            "stage IN ('supervisor','validator')",
            name="zero_spending_decision_stage_allowed",
        ),
        CheckConstraint(
            "outcome IN ('prevalidated','approved','returned')",
            name="zero_spending_decision_outcome_allowed",
        ),
        CheckConstraint(
            "(stage='supervisor' AND outcome IN ('prevalidated','returned') AND "
            "actor_role='AGENT_VERIFICATEUR') OR "
            "(stage='validator' AND outcome IN ('approved','returned') AND "
            "actor_role='VALIDATEUR_DEFINITIF')",
            name="zero_spending_decision_role_allowed",
        ),
        CheckConstraint(
            "(outcome='returned' AND reason IS NOT NULL AND "
            "length(btrim(reason)) BETWEEN 1 AND 4000) OR "
            "(outcome<>'returned' AND reason IS NULL)",
            name="zero_spending_decision_reason",
        ),
        CheckConstraint(
            "(stage='validator' AND outcome='approved' AND "
            "prevalidation_decision_id IS NOT NULL) OR "
            "(NOT (stage='validator' AND outcome='approved') AND "
            "prevalidation_decision_id IS NULL)",
            name="zero_spending_prevalidation_reference",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    activity_id: Mapped[str] = mapped_column(String(36))
    declaration_id: Mapped[str] = mapped_column(String(36))
    stage: Mapped[str] = mapped_column(String(16))
    outcome: Mapped[str] = mapped_column(String(16))
    actor_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    actor_role: Mapped[str] = mapped_column(String(32))
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(4000))
    prevalidation_decision_id: Mapped[str | None] = mapped_column(String(36))


class DisbursementDecision(Base):
    __tablename__ = "pta_disbursement_decision"
    __table_args__ = (
        ForeignKeyConstraint(
            ["activity_id", "request_id"],
            ["pta_disbursement_request.activity_id", "pta_disbursement_request.id"],
        ),
        ForeignKeyConstraint(
            ["request_id", "prevalidation_decision_id"],
            ["pta_disbursement_decision.request_id", "pta_disbursement_decision.id"],
            use_alter=True,
        ),
        UniqueConstraint("request_id", "id", name="disbursement_decision_scope"),
        UniqueConstraint("request_id", "stage", name="disbursement_decision_stage"),
        CheckConstraint(
            "stage IN ('supervisor','validator')",
            name="disbursement_decision_stage_allowed",
        ),
        CheckConstraint(
            "outcome IN ('prevalidated','approved','returned')",
            name="disbursement_decision_outcome_allowed",
        ),
        CheckConstraint(
            "(stage='supervisor' AND outcome IN ('prevalidated','returned') AND "
            "actor_role='AGENT_VERIFICATEUR') OR "
            "(stage='validator' AND outcome IN ('approved','returned') AND "
            "actor_role='VALIDATEUR_DEFINITIF')",
            name="disbursement_decision_role_allowed",
        ),
        CheckConstraint(
            "(outcome='returned' AND reason IS NOT NULL AND "
            "length(btrim(reason)) BETWEEN 1 AND 4000) OR "
            "(outcome<>'returned' AND reason IS NULL)",
            name="disbursement_decision_reason",
        ),
        CheckConstraint(
            "(stage='validator' AND outcome='approved' AND "
            "prevalidation_decision_id IS NOT NULL) OR "
            "(NOT (stage='validator' AND outcome='approved') AND "
            "prevalidation_decision_id IS NULL)",
            name="disbursement_prevalidation_reference",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    activity_id: Mapped[str] = mapped_column(String(36))
    request_id: Mapped[str] = mapped_column(String(36))
    stage: Mapped[str] = mapped_column(String(16))
    outcome: Mapped[str] = mapped_column(String(16))
    actor_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    actor_role: Mapped[str] = mapped_column(String(32))
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(4000))
    prevalidation_decision_id: Mapped[str | None] = mapped_column(String(36))


class VirementRequest(Base):
    __tablename__ = "pta_virement_request"
    __table_args__ = (
        ForeignKeyConstraint(
            ["context_id", "activity_id"],
            ["pta_activity.context_id", "pta_activity.id"],
        ),
        ForeignKeyConstraint(
            ["activity_id", "disbursement_request_id"],
            ["pta_disbursement_request.activity_id", "pta_disbursement_request.id"],
        ),
        UniqueConstraint("activity_id", "id", name="virement_request_scope"),
        CheckConstraint(
            "state IN ('submitted','prevalidated','returned','approved','cancelled')",
            name="virement_request_state_allowed",
        ),
        CheckConstraint(
            "jsonb_typeof(excluded_reviewer_ids)='array' AND "
            "octet_length(excluded_reviewer_ids::text) <= 1048576",
            name="virement_exclusions_bounded",
        ),
        CheckConstraint(
            "(state='cancelled' AND cancelled_by_id IS NOT NULL AND "
            "cancelled_at IS NOT NULL AND cancellation_reason IS NOT NULL AND "
            "length(btrim(cancellation_reason)) BETWEEN 1 AND 4000) OR "
            "(state<>'cancelled' AND cancelled_by_id IS NULL AND "
            "cancelled_at IS NULL AND cancellation_reason IS NULL)",
            name="virement_cancellation_facts",
        ),
        Index(
            "virement_one_open_per_activity",
            "activity_id",
            unique=True,
            postgresql_where=text("state NOT IN ('returned', 'cancelled')"),
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    context_id: Mapped[str] = mapped_column(String(3))
    activity_id: Mapped[str] = mapped_column(String(36))
    disbursement_request_id: Mapped[str] = mapped_column(String(36))
    excluded_reviewer_ids: Mapped[list[str]] = mapped_column(JSONB)
    submitter_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(16), default="submitted")
    cancelled_by_id: Mapped[str | None] = mapped_column(ForeignKey("auth_user.id"))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancellation_reason: Mapped[str | None] = mapped_column(String(4000))


class VirementDecision(Base):
    __tablename__ = "pta_virement_decision"
    __table_args__ = (
        ForeignKeyConstraint(
            ["activity_id", "request_id"],
            ["pta_virement_request.activity_id", "pta_virement_request.id"],
        ),
        ForeignKeyConstraint(
            ["request_id", "prevalidation_decision_id"],
            ["pta_virement_decision.request_id", "pta_virement_decision.id"],
            use_alter=True,
        ),
        UniqueConstraint("request_id", "id", name="virement_decision_scope"),
        UniqueConstraint("request_id", "stage", name="virement_decision_stage"),
        CheckConstraint(
            "stage IN ('supervisor','validator')",
            name="virement_decision_stage_allowed",
        ),
        CheckConstraint(
            "outcome IN ('prevalidated','approved','returned')",
            name="virement_decision_outcome_allowed",
        ),
        CheckConstraint(
            "(stage='supervisor' AND outcome IN ('prevalidated','returned') AND "
            "actor_role='AGENT_VERIFICATEUR') OR "
            "(stage='validator' AND outcome IN ('approved','returned') AND "
            "actor_role='VALIDATEUR_DEFINITIF')",
            name="virement_decision_role_allowed",
        ),
        CheckConstraint(
            "(outcome='returned' AND reason IS NOT NULL AND "
            "length(btrim(reason)) BETWEEN 1 AND 4000) OR "
            "(outcome<>'returned' AND reason IS NULL)",
            name="virement_decision_reason",
        ),
        CheckConstraint(
            "(stage='validator' AND "
            "prevalidation_decision_id IS NOT NULL) OR "
            "(stage<>'validator' AND "
            "prevalidation_decision_id IS NULL)",
            name="virement_prevalidation_reference",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    activity_id: Mapped[str] = mapped_column(String(36))
    request_id: Mapped[str] = mapped_column(String(36))
    stage: Mapped[str] = mapped_column(String(16))
    outcome: Mapped[str] = mapped_column(String(16))
    actor_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    actor_role: Mapped[str] = mapped_column(String(32))
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str | None] = mapped_column(String(4000))
    prevalidation_decision_id: Mapped[str | None] = mapped_column(String(36))


class VirementConfirmation(Base):
    __tablename__ = "pta_virement_confirmation"
    __table_args__ = (
        ForeignKeyConstraint(
            ["activity_id", "request_id"],
            ["pta_virement_request.activity_id", "pta_virement_request.id"],
        ),
        UniqueConstraint(
            "request_id", "revision", name="virement_confirmation_revision"
        ),
        CheckConstraint("revision > 0", name="virement_confirmation_revision_positive"),
        CheckConstraint("amount > 0", name="virement_confirmation_amount_positive"),
        CheckConstraint(
            "(revision=1 AND correction_reason IS NULL) OR "
            "(revision>1 AND correction_reason IS NOT NULL AND "
            "length(btrim(correction_reason)) BETWEEN 1 AND 4000)",
            name="virement_confirmation_correction_reason",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    activity_id: Mapped[str] = mapped_column(String(36))
    request_id: Mapped[str] = mapped_column(String(36))
    revision: Mapped[int] = mapped_column(Integer)
    amount: Mapped[int] = mapped_column(BigInteger)
    transfer_date: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(4000))
    actor_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    correction_reason: Mapped[str | None] = mapped_column(String(4000))


class ReversementDeclaration(Base):
    __tablename__ = "pta_reversement_declaration"
    __table_args__ = (
        ForeignKeyConstraint(
            ["activity_id", "request_id"],
            ["pta_virement_request.activity_id", "pta_virement_request.id"],
        ),
        UniqueConstraint(
            "request_id", "revision", name="reversement_declaration_revision"
        ),
        CheckConstraint(
            "revision > 0", name="reversement_declaration_revision_positive"
        ),
        CheckConstraint("amount > 0", name="reversement_declaration_amount_positive"),
        CheckConstraint(
            "(revision=1 AND correction_reason IS NULL) OR "
            "(revision>1 AND correction_reason IS NOT NULL AND "
            "length(btrim(correction_reason)) BETWEEN 1 AND 4000)",
            name="reversement_declaration_correction_reason",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=identifier)
    activity_id: Mapped[str] = mapped_column(String(36))
    request_id: Mapped[str] = mapped_column(String(36))
    confirmation_id: Mapped[str] = mapped_column(
        ForeignKey("pta_virement_confirmation.id")
    )
    revision: Mapped[int] = mapped_column(Integer)
    amount: Mapped[int] = mapped_column(BigInteger)
    return_date: Mapped[date] = mapped_column(Date)
    note: Mapped[str | None] = mapped_column(String(4000))
    actor_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    correction_reason: Mapped[str | None] = mapped_column(String(4000))
