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
            ["context_id", "pta_id", "request_project_id", "request_year"],
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
            "'returned_validator','approved')",
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
            "AND approved_revision_id IS NULL) OR (amendment_id IS NOT NULL "
            "AND approved_revision_id IS NOT NULL "
            "AND current_revision_id <> approved_revision_id))) OR "
            "(state = 'approved' AND current_revision_id IS NOT NULL "
            "AND approved_revision_id = current_revision_id)",
            name="activity_revision_pointer_state",
        ),
        CheckConstraint(
            "(amendment_id IS NULL AND amendment_reason IS NULL AND "
            "(approved_revision_id IS NULL OR state = 'approved')) OR "
            "(amendment_id IS NOT NULL AND amendment_reason IS NOT NULL "
            "AND length(btrim(amendment_reason)) BETWEEN 1 AND 4000 "
            "AND approved_revision_id IS NOT NULL AND state <> 'approved')",
            name="activity_amendment_state",
        ),
        CheckConstraint("version > 0", name="activity_version_positive"),
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
    version: Mapped[int] = mapped_column(default=1)
    creator_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    request_actor_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"))
    request_project_id: Mapped[str] = mapped_column(String(36))
    request_year: Mapped[int] = mapped_column()
    request_key: Mapped[str] = mapped_column(String(36))
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


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
