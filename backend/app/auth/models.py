from datetime import datetime
from uuid import uuid4

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "auth_user"
    __table_args__ = (
        CheckConstraint(
            "role IN ('ADMIN_PLATEFORME','AGENT_SAISIE',"
            "'AGENT_VERIFICATEUR','VALIDATEUR_DEFINITIF')"
        ),
        CheckConstraint("state IN ('pending','active','inactive')"),
        CheckConstraint("state = 'pending' OR password_hash IS NOT NULL"),
        CheckConstraint("email = lower(email)"),
        CheckConstraint("email ~ '^[a-z0-9][a-z0-9._+-]{0,63}@example[.]test$'"),
    )
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    email: Mapped[str] = mapped_column(String(254), unique=True)
    role: Mapped[str] = mapped_column(String(32), default="ADMIN_PLATEFORME")
    state: Mapped[str] = mapped_column(String(16), default="pending")
    password_hash: Mapped[str | None] = mapped_column(String(255))
    version: Mapped[int] = mapped_column(default=1)


class Invitation(Base):
    __tablename__ = "auth_invitation"
    __table_args__ = (
        CheckConstraint("state IN ('prepared','delivered','consumed','revoked')"),
    )
    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid4())
    )
    user_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"), unique=True)
    verifier: Mapped[str] = mapped_column(String(64))
    generation: Mapped[str] = mapped_column(String(36))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    state: Mapped[str] = mapped_column(String(16), default="prepared")


class Audit(Base):
    __tablename__ = "auth_audit"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    action: Mapped[str] = mapped_column(String(48))
    actor: Mapped[str] = mapped_column(String(80))
    target: Mapped[str | None] = mapped_column(String(64))
    outcome: Mapped[str] = mapped_column(String(32))
    request_id: Mapped[str] = mapped_column(String(36))


class Context(Base):
    __tablename__ = "auth_context"
    __table_args__ = (
        CheckConstraint("state IN ('anonymous','pending','verified','revoked')"),
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    csrf: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(16))
    user_id: Mapped[str | None] = mapped_column(ForeignKey("auth_user.id"))
    proof: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_activity: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class OTP(Base):
    __tablename__ = "auth_otp"
    user_id: Mapped[str] = mapped_column(ForeignKey("auth_user.id"), primary_key=True)
    context_id: Mapped[str] = mapped_column(ForeignKey("auth_context.id"))
    generation: Mapped[str] = mapped_column(String(36))
    verifier: Mapped[str] = mapped_column(String(64))
    state: Mapped[str] = mapped_column(String(16))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0)
    resends: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("state IN ('prepared','delivered','consumed')"),
        CheckConstraint("attempts >= 0 AND resends >= 0"),
    )


class Abuse(Base):
    __tablename__ = "auth_abuse"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    count: Mapped[int] = mapped_column()
    __table_args__ = (CheckConstraint("count >= 0"),)
