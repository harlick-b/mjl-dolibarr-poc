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
    String,
    UniqueConstraint,
    text,
)
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
        UniqueConstraint("context_id", "id"),
        UniqueConstraint(
            "context_id",
            "request_actor_id",
            "request_project_id",
            "request_year",
            "request_key",
            name="activity_request_key",
        ),
        CheckConstraint("state = 'draft'", name="activity_draft_only"),
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
    state: Mapped[str] = mapped_column(String(16), default="draft")
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
