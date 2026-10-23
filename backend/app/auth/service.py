import hashlib
import json
import logging
import secrets
from collections.abc import Callable
from contextvars import ContextVar
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import Engine, func, select, text
from sqlalchemy.orm import Session

from app.auth.mail import TestMailbox
from app.auth.models import OTP, Abuse, Audit, Context, Invitation, Recovery, User
from app.auth.policy import Policy, synthetic_email

request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
logger = logging.getLogger(__name__)


class AuthError(Exception):
    def __init__(self, status: int, code: str):
        self.status = status
        self.code = code
        super().__init__(code)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class AuthService:
    def __init__(self, engine: Engine, policy: Policy | None):
        if policy is None:
            raise AuthError(503, "authentication_unavailable")
        from argon2 import PasswordHasher

        self.hasher = PasswordHasher()
        self.dummy_hash = self.hasher.hash(secrets.token_urlsafe(32))
        self.engine = engine
        self.policy = policy
        self.mail = TestMailbox(policy.mailbox)
        self.clock: Callable[[], datetime] | None = None

    def environment_verified(
        self, db: Session, *, require_context: bool = True
    ) -> None:
        """Verify the exact isolated PTA-1 database without inferring eligibility."""
        if (
            not self.policy.recovery_enabled
            or not self.policy.lifecycle_database
            or self.policy.lifecycle_database != self.engine.url.database
            or not self.policy.lifecycle_database.startswith("mjl_test_")
        ):
            raise AuthError(409, "eligibility_unverified")
        relations = set(
            db.execute(
                text("""
            SELECT n.nspname, c.relname, c.relkind
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname <> 'information_schema'
              AND n.nspname !~ '^pg_'
              AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
        """)
            ).all()
        )
        expected = {
            ("public", name, "r")
            for name in (
                "alembic_version",
                "auth_user",
                "auth_invitation",
                "auth_audit",
                "auth_context",
                "auth_otp",
                "auth_abuse",
                "auth_recovery",
                "mjl_ownership_context",
                "pta_partner",
                "pta_operation_type",
                "pta_project",
                "pta_annual",
                "pta_activity",
                "pta_operation",
                "pta_activity_agent_assignment",
            )
        }
        if relations != expected:
            raise AuthError(409, "eligibility_unverified")
        revisions = list(
            db.scalars(text("SELECT version_num FROM public.alembic_version"))
        )
        if revisions != ["0005_pta1"]:
            raise AuthError(409, "eligibility_unverified")
        required_constraints = {
            "ownership_context_singleton",
            "project_one_active_per_partner",
            "pta_project_year",
            "activity_request_key",
            "assignment_one_current",
            "audit_business_bounded",
        }
        found = set(
            db.scalars(
                text("""
                SELECT conname FROM pg_catalog.pg_constraint
                WHERE conname = ANY(:names)
                UNION
                SELECT indexname FROM pg_catalog.pg_indexes
                WHERE indexname = ANY(:names)
                """),
                {"names": list(required_constraints)},
            )
        )
        if found != required_constraints:
            raise AuthError(409, "eligibility_unverified")
        table_names = [name for schema, name, kind in expected]
        manifest = [
            list(row)
            for row in db.execute(
                text("""
                SELECT * FROM (
                  SELECT 'column' kind, c.relname object, a.attnum::text name,
                    a.attname || '|' ||
                    pg_catalog.format_type(a.atttypid,a.atttypmod) || '|' ||
                    a.attnotnull::text || '|' ||
                    coalesce(pg_get_expr(d.adbin,d.adrelid),'') definition
                  FROM pg_catalog.pg_class c
                  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                  JOIN pg_catalog.pg_attribute a
                    ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
                  LEFT JOIN pg_catalog.pg_attrdef d
                    ON d.adrelid=c.oid AND d.adnum=a.attnum
                  WHERE n.nspname='public' AND c.relname=ANY(:tables)
                  UNION ALL
                  SELECT 'constraint', c.relname, x.conname,
                    pg_get_constraintdef(x.oid)
                  FROM pg_catalog.pg_constraint x
                  JOIN pg_catalog.pg_class c ON c.oid=x.conrelid
                  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                  WHERE n.nspname='public' AND c.relname=ANY(:tables)
                  UNION ALL
                  SELECT 'index', tablename, indexname, indexdef
                  FROM pg_catalog.pg_indexes
                  WHERE schemaname='public' AND tablename=ANY(:tables)
                ) manifest ORDER BY kind,object,name
                """),
                {"tables": table_names},
            )
        ]
        encoded_manifest = json.dumps(manifest, separators=(",", ":"))
        if hashlib.sha256(encoded_manifest.encode()).hexdigest() != (
            "65c3559d5276d42175e40bf664a884706afe4c6b9591e91f88c85a3b6df9b614"
        ):
            raise AuthError(409, "eligibility_unverified")
        if require_context:
            from app.planning.models import OwnershipContext

            contexts = list(db.scalars(select(OwnershipContext.id)))
            if contexts != ["MJL"]:
                raise AuthError(409, "eligibility_unverified")

    def lifecycle_eligible(self, db: Session, user_id: str | None = None) -> None:
        """PTA-aware proof that an ordinary account has no current responsibility."""
        self.environment_verified(db)
        if user_id:
            from app.planning.models import ActivityAssignment

            if db.scalar(
                select(ActivityAssignment.id)
                .where(
                    ActivityAssignment.agent_id == user_id,
                    ActivityAssignment.ended_at.is_(None),
                )
                .limit(1)
            ):
                raise AuthError(409, "account_ineligible")

    def provision_context(self, operator: str, reason: str) -> None:
        reason = reason.strip()
        if not operator or len(operator) > 80 or not reason or len(reason) > 200:
            raise AuthError(403, "operator_required")
        from app.planning.models import OwnershipContext

        try:
            with Session(self.engine) as db, db.begin():
                db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
                self.environment_verified(db, require_context=False)
                context = db.get(OwnershipContext, "MJL", with_for_update=True)
                if context:
                    return
                context = OwnershipContext(id="MJL", created_at=self.now(db))
                db.add(context)
                db.flush()
                self.audit(
                    db,
                    "ownership_context.provisioned",
                    operator,
                    "MJL",
                    details={"reason": reason},
                )
        except Exception:
            logger.warning(
                "MJL ownership provisioning failed "
                "operator=%s occurred_at=%s reason=%s",
                operator,
                datetime.now(UTC).isoformat(),
                reason,
            )
            raise

    def now(self, db: Session) -> datetime:
        if self.clock:
            return self.clock()
        with db.no_autoflush:
            value = db.scalar(select(func.clock_timestamp()))
        assert isinstance(value, datetime)
        return value

    def audit(
        self,
        db: Session,
        action: str,
        actor: str,
        target: str | None,
        outcome: str = "ok",
        details: dict[str, str | int] | None = None,
    ) -> None:
        if details is not None:
            allowed = {
                "invitation_id",
                "generation",
                "role",
                "before_role",
                "user_state",
                "user_version",
                "before_state",
                "after_state",
                "version",
                "before_version",
                "before_user_state",
                "before_user_version",
                "recovery_id",
                "before_credential_version",
                "credential_version",
                "reason",
            }
            if set(details) - allowed or any(
                type(v) not in (str, int) for v in details.values()
            ):
                raise ValueError("Invalid audit facts")
            if any(
                isinstance(value, str) and len(value) > (200 if key == "reason" else 64)
                for key, value in details.items()
            ):
                raise ValueError("Invalid audit facts")
        db.add(
            Audit(
                details=details,
                occurred_at=self.now(db),
                action=action,
                actor=actor,
                target=target,
                outcome=outcome,
                request_id=request_id.get() or str(uuid4()),
            )
        )
        db.flush()

    def business_audit(
        self,
        db: Session,
        action: str,
        actor: str,
        target: str,
        business: dict[str, object],
    ) -> None:
        shapes = {
            "partner.create": "partner",
            "operation_type.create": "type",
            "project.create": "project",
            "project.close": "project",
            "activity.create": "activity",
            "activity.replace": "activity",
            "activity.assign_agents": "activity",
        }
        create_actions = {
            "partner.create",
            "operation_type.create",
            "project.create",
            "activity.create",
        }
        change_actions = set(shapes) - create_actions
        required = (
            {"context_id", "after"}
            if action in create_actions
            else {"context_id", "before", "after", "removed_operations"}
            if action == "activity.replace"
            else {"context_id", "before", "after"}
            if action in change_actions
            else None
        )
        after = business.get("after")
        before = business.get("before")

        def valid_removals(value: object) -> bool:
            fields = {"id", "position", "removed_at", "removed_by_id"}
            return (
                isinstance(value, list)
                and len(value) <= 100
                and all(
                    isinstance(row, dict)
                    and set(row) == fields
                    and all(
                        isinstance(row.get(key), str)
                        for key in ("id", "removed_at", "removed_by_id")
                    )
                    and isinstance(row.get("position"), int)
                    and row["position"] > 0
                    for row in value
                )
            )

        def valid_item(value: object, shape: str) -> bool:
            if not isinstance(value, dict):
                return False
            fields = {
                "partner": {"id", "name", "active", "allowed_actions"},
                "type": {"id", "label", "active", "allowed_actions"},
                "project": {
                    "id",
                    "partner_id",
                    "reference",
                    "name",
                    "state",
                    "version",
                    "allowed_actions",
                },
                "activity": {
                    "id",
                    "pta_id",
                    "reference",
                    "name",
                    "description",
                    "planned_start",
                    "planned_end",
                    "allocation",
                    "state",
                    "version",
                    "operations",
                    "agent_ids",
                    "allowed_actions",
                },
            }[shape]
            if set(value) != fields or not isinstance(value.get("id"), str):
                return False
            if not isinstance(value.get("allowed_actions"), list) or not all(
                isinstance(action, str) for action in value["allowed_actions"]
            ):
                return False
            if shape in {"partner", "type"}:
                label = value.get("name" if shape == "partner" else "label")
                return (
                    isinstance(label, str)
                    and bool(label)
                    and isinstance(value.get("active"), bool)
                )
            if shape == "project":
                return (
                    all(
                        isinstance(value.get(key), str)
                        for key in ("partner_id", "reference", "name", "state")
                    )
                    and value.get("state") in {"active", "closed"}
                    and isinstance(value.get("version"), int)
                    and value["version"] > 0
                )
            operations = value.get("operations")
            operation_fields = {"id", "type_id", "name", "allocation", "position"}
            return (
                all(
                    isinstance(value.get(key), str)
                    for key in (
                        "pta_id",
                        "reference",
                        "name",
                        "description",
                        "planned_start",
                        "planned_end",
                        "allocation",
                        "state",
                    )
                )
                and value.get("state") == "draft"
                and isinstance(value.get("version"), int)
                and value["version"] > 0
                and isinstance(operations, list)
                and 1 <= len(operations) <= 100
                and all(
                    isinstance(row, dict)
                    and set(row) == operation_fields
                    and all(
                        isinstance(row.get(key), str)
                        for key in ("id", "type_id", "name", "allocation")
                    )
                    and isinstance(row.get("position"), int)
                    and row["position"] > 0
                    for row in operations
                )
                and isinstance(value.get("agent_ids"), list)
                and all(
                    isinstance(identifier, str) for identifier in value["agent_ids"]
                )
            )

        if (
            required is None
            or set(business) != required
            or business.get("context_id") != "MJL"
            or (
                action == "activity.replace"
                and not valid_removals(business.get("removed_operations"))
            )
            or not valid_item(after, shapes[action])
            or not isinstance(after, dict)
            or after.get("id") != target
            or (
                action in change_actions
                and (
                    not valid_item(before, shapes[action])
                    or not isinstance(before, dict)
                    or before.get("id") != target
                )
            )
        ):
            raise ValueError("Invalid business audit facts")
        encoded = json.dumps(business, separators=(",", ":"), sort_keys=True)
        if len(encoded.encode()) > 1_048_576:
            raise ValueError("Business audit exceeds its bounded contract")
        db.add(
            Audit(
                business=business,
                occurred_at=self.now(db),
                action=action,
                actor=actor,
                target=target,
                outcome="ok",
                request_id=request_id.get() or str(uuid4()),
            )
        )
        db.flush()

    def prepare_invitation(
        self, db: Session, user: User, invitation: Invitation, actor: str, action: str
    ) -> tuple[str, str, str, str, str]:
        secret = secrets.token_urlsafe(32)
        previous = invitation.state or "prepared"
        invitation.verifier = digest(secret)
        invitation.generation = str(uuid4())
        invitation.expires_at = self.now(db) + timedelta(
            seconds=self.policy.invitation_seconds
        )
        invitation.state = "prepared"
        invitation.version = (invitation.version or 0) + 1
        db.flush()
        self.audit(
            db,
            action,
            actor,
            user.id,
            details=self.invitation_facts(user, invitation, previous),
        )
        return user.email, invitation.id, invitation.generation, secret, actor

    def invitation_facts(
        self,
        user: User,
        invitation: Invitation,
        previous: str,
        *,
        accepted: bool = False,
        changed: bool = True,
    ) -> dict[str, str | int]:
        return {
            "invitation_id": invitation.id,
            "generation": invitation.generation,
            "role": user.role,
            "user_state": user.state,
            "user_version": user.version,
            "before_state": previous,
            "after_state": invitation.state,
            "version": invitation.version,
            "before_version": max(0, invitation.version - int(changed)),
            "before_user_state": "pending" if accepted else user.state,
            "before_user_version": user.version - 1 if accepted else user.version,
        }

    def invitation_bound(self, db: Session, user: User, invitation: Invitation) -> bool:
        facts = db.scalar(
            select(Audit.details)
            .where(
                Audit.target == user.id,
                Audit.action.in_(
                    ["bootstrap", "invitation_create", "invitation_reissue"]
                ),
                Audit.details["generation"].astext == invitation.generation,
            )
            .order_by(Audit.id.desc())
            .limit(1)
        )
        return bool(
            facts
            and facts.get("role") == user.role
            and facts.get("user_version") == user.version
            and facts.get("user_state") == user.state
        )

    def deliver_invitation(
        self, email: str, selector: str, generation: str, secret: str, actor: str
    ) -> None:
        link = f"{self.policy.origin}/invitation#selector={selector}&verifier={secret}"
        delivered = True
        try:
            self.mail.send(email, "invitation", link)
        except OSError:
            delivered = False
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            target = db.scalar(
                select(Invitation.user_id).where(Invitation.id == selector)
            )
            user = db.get(User, target, with_for_update=True) if target else None
            invitation = db.get(Invitation, selector, with_for_update=True)
            if (
                not invitation
                or not user
                or invitation.generation != generation
                or invitation.state != "prepared"
                or user.state != "pending"
                or not self.invitation_bound(db, user, invitation)
            ):
                raise AuthError(409, "delivery_superseded")
            if delivered:
                invitation.state = "delivered"
            invitation.version += 1
            self.audit(
                db,
                "invitation_delivery",
                actor,
                user.id,
                "sent" if delivered else "failed",
                details=self.invitation_facts(user, invitation, "prepared"),
            )
        if not delivered:
            raise AuthError(503, "invitation_delivery_failed")

    def require_recovery(self) -> None:
        if not self.policy.recovery_enabled:
            raise AuthError(503, "recovery_unavailable")

    def recovery_request_allowed(self, email: str, ip: str) -> tuple[str, bool]:
        self.require_recovery()
        try:
            normalized = synthetic_email(email)
        except ValueError:
            raise AuthError(422, "input_invalid") from None
        assert self.policy.recovery_ip_window_seconds
        assert self.policy.recovery_ip_limit
        assert self.policy.recovery_email_window_seconds
        assert self.policy.recovery_email_limit
        with Session(self.engine) as db, db.begin():
            network_ok = self.limit(
                db,
                "recovery-ip:" + ip,
                self.policy.recovery_ip_window_seconds,
                self.policy.recovery_ip_limit,
            )
            account_ok = self.limit(
                db,
                "recovery-email:" + normalized,
                self.policy.recovery_email_window_seconds,
                self.policy.recovery_email_limit,
            )
        return normalized, network_ok and account_ok

    def prepare_recovery(self, email: str) -> tuple[str, str, str, str] | None:
        self.require_recovery()
        assert self.policy.recovery_seconds
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            self.environment_verified(db)
            user = db.scalar(select(User).where(User.email == email).with_for_update())
            if not user or user.state != "active" or user.role == "ADMIN_PLATEFORME":
                return None
            recovery = db.scalar(
                select(Recovery).where(Recovery.user_id == user.id).with_for_update()
            )
            now = self.now(db)
            current_proof = self.user_proof(user)
            if (
                recovery
                and recovery.state in {"prepared", "delivered"}
                and recovery.expires_at > now
                and secrets.compare_digest(recovery.user_proof, current_proof)
            ):
                return None
            secret = secrets.token_urlsafe(32)
            selector = str(uuid4())
            generation = str(uuid4())
            if recovery is None:
                recovery = Recovery(user_id=user.id)
                db.add(recovery)
            recovery.id = selector
            recovery.verifier = digest(secret)
            recovery.generation = generation
            recovery.expires_at = now + timedelta(seconds=self.policy.recovery_seconds)
            recovery.state = "prepared"
            recovery.user_proof = current_proof
            db.flush()
            self.audit(
                db,
                "recovery_prepare",
                "anonymous",
                user.id,
                details={
                    "recovery_id": selector,
                    "generation": generation,
                    "user_version": user.version,
                },
            )
            return user.email, selector, generation, secret

    def deliver_recovery(
        self, email: str, selector: str, generation: str, secret: str
    ) -> None:
        self.require_recovery()
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            self.environment_verified(db)
            target = db.scalar(select(Recovery.user_id).where(Recovery.id == selector))
            user = db.get(User, target, with_for_update=True) if target else None
            recovery = db.get(Recovery, selector, with_for_update=True)
            if (
                not user
                or not recovery
                or recovery.generation != generation
                or recovery.state != "prepared"
                or user.state != "active"
                or user.role == "ADMIN_PLATEFORME"
                or recovery.expires_at <= self.now(db)
                or not secrets.compare_digest(
                    recovery.user_proof, self.user_proof(user)
                )
            ):
                return
        delivered = True
        try:
            self.mail.send(
                email,
                "password_recovery",
                f"{self.policy.origin}/reset-password#selector={selector}"
                f"&verifier={secret}",
            )
        except OSError:
            delivered = False
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            self.environment_verified(db)
            target = db.scalar(select(Recovery.user_id).where(Recovery.id == selector))
            user = db.get(User, target, with_for_update=True) if target else None
            recovery = db.get(Recovery, selector, with_for_update=True)
            if (
                not user
                or not recovery
                or recovery.generation != generation
                or recovery.state != "prepared"
                or user.state != "active"
                or user.role == "ADMIN_PLATEFORME"
                or recovery.expires_at <= self.now(db)
                or not secrets.compare_digest(
                    recovery.user_proof, self.user_proof(user)
                )
            ):
                return
            if delivered:
                recovery.state = "delivered"
            self.audit(
                db,
                "recovery_delivery",
                "anonymous",
                user.id,
                "sent" if delivered else "failed",
                details={
                    "recovery_id": recovery.id,
                    "generation": recovery.generation,
                    "user_version": user.version,
                },
            )

    def request_recovery(self, email: str, correlation_id: str) -> None:
        try:
            delivery = self.prepare_recovery(email)
            if delivery:
                self.deliver_recovery(*delivery)
        except Exception:
            logger.warning(
                "Recovery background task failed request_id=%s", correlation_id
            )
            return

    def recovery(self, selector: str, verifier: str) -> str:
        self.require_recovery()
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            self.environment_verified(db)
            target = db.scalar(select(Recovery.user_id).where(Recovery.id == selector))
            user = db.get(User, target, with_for_update=True) if target else None
            recovery = db.get(Recovery, selector, with_for_update=True)
            if (
                not user
                or not recovery
                or recovery.state != "delivered"
                or recovery.expires_at <= self.now(db)
                or user.state != "active"
                or user.role == "ADMIN_PLATEFORME"
                or not secrets.compare_digest(recovery.verifier, digest(verifier))
                or not secrets.compare_digest(
                    recovery.user_proof, self.user_proof(user)
                )
            ):
                raise AuthError(400, "recovery_invalid")
            return user.email

    def complete_recovery(
        self, selector: str, verifier: str, password: str, confirmation: str
    ) -> tuple[str, str]:
        from app.auth.policy import password_valid

        self.require_recovery()
        error: AuthError | None = None
        result: tuple[str, str] | None = None
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            self.environment_verified(db)
            target = db.scalar(select(Recovery.user_id).where(Recovery.id == selector))
            user = db.get(User, target, with_for_update=True) if target else None
            recovery = db.get(Recovery, selector, with_for_update=True)
            authentic = bool(
                recovery and secrets.compare_digest(recovery.verifier, digest(verifier))
            )
            if authentic and recovery and recovery.state == "consumed":
                error = AuthError(409, "recovery_consumed")
            elif (
                not authentic
                or not recovery
                or not user
                or recovery.state != "delivered"
                or recovery.expires_at <= self.now(db)
                or user.state != "active"
                or user.role == "ADMIN_PLATEFORME"
                or not secrets.compare_digest(
                    recovery.user_proof, self.user_proof(user)
                )
            ):
                error = AuthError(400, "recovery_invalid")
            elif not password_valid(password, confirmation, self.policy.password_min):
                error = AuthError(422, "password_policy")
            else:
                before = user.version
                user.password_hash = self.hasher.hash(password)
                user.version += 1
                recovery.state = "consumed"
                self.audit(
                    db,
                    "recovery_complete",
                    "anonymous",
                    user.id,
                    details={
                        "recovery_id": recovery.id,
                        "before_credential_version": before,
                        "credential_version": user.version,
                    },
                )
                result = user.id, user.email
        if error:
            raise error
        assert result
        return result

    def notify_recovery(self, user_id: str, email: str) -> None:
        delivered = True
        try:
            self.mail.send(
                email,
                "password_reset_notice",
                "Votre mot de passe MJL a été réinitialisé.",
            )
        except OSError:
            delivered = False
        try:
            with Session(self.engine) as db, db.begin():
                self.audit(
                    db,
                    "recovery_notification",
                    "anonymous",
                    user_id,
                    "sent" if delivered else "failed",
                )
        except Exception:
            return

    def bootstrap(self, email: str, operator: str, reissue: bool = False) -> None:
        email = synthetic_email(email)
        if not operator or len(operator) > 80:
            raise AuthError(403, "operator_required")
        request_id.set(str(uuid4()))
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            original = db.scalar(select(Audit).where(Audit.action == "bootstrap"))
            if not reissue:
                if original or db.scalar(select(User.id).limit(1)):
                    raise AuthError(409, "bootstrap_closed")
                user: User | None = User(email=email, role="ADMIN_PLATEFORME")
                db.add(user)
                db.flush()
                assert user
                invitation: Invitation | None = Invitation(user_id=user.id)
                db.add(invitation)
                action = "bootstrap"
            else:
                user = (
                    db.get(User, original.target, with_for_update=True)
                    if original and original.target
                    else None
                )
                if (
                    not user
                    or user.email != email
                    or user.state != "pending"
                    or user.role != "ADMIN_PLATEFORME"
                ):
                    raise AuthError(409, "bootstrap_closed")
                invitation = db.scalar(
                    select(Invitation)
                    .where(Invitation.user_id == user.id)
                    .with_for_update()
                )
                if not invitation or invitation.state in {"consumed", "revoked"}:
                    raise AuthError(409, "bootstrap_closed")
                action = "invitation_reissue"
            assert invitation and user
            delivery = self.prepare_invitation(db, user, invitation, operator, action)
        self.deliver_invitation(*delivery)

    def invitation(
        self,
        selector: str,
        verifier: str,
        password: str | None = None,
        confirmation: str | None = None,
    ) -> str:
        from argon2 import PasswordHasher

        from app.auth.policy import password_valid

        error = None
        email = ""
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            target = db.scalar(
                select(Invitation.user_id).where(Invitation.id == selector)
            )
            user = db.get(User, target, with_for_update=True) if target else None
            invitation = db.get(Invitation, selector, with_for_update=True)
            previous = invitation.state if invitation else "prepared"
            if (
                not invitation
                or not user
                or user.state != "pending"
                or not self.invitation_bound(db, user, invitation)
                or invitation.state != "delivered"
                or invitation.expires_at <= self.now(db)
                or not secrets.compare_digest(invitation.verifier, digest(verifier))
            ):
                error = AuthError(
                    409
                    if invitation
                    and invitation.state == "consumed"
                    and password is not None
                    and secrets.compare_digest(invitation.verifier, digest(verifier))
                    else 400,
                    "invitation_invalid",
                )
            elif password is not None and not password_valid(
                password, confirmation or "", self.policy.password_min
            ):
                error = AuthError(400, "password_policy")
            elif password is not None:
                user.password_hash = PasswordHasher().hash(password)
                user.state = "active"
                user.version += 1
                invitation.state = "consumed"
                invitation.version += 1
            if user and not error:
                email = user.email
            self.audit(
                db,
                "invitation_accept" if password is not None else "invitation_inspect",
                "anonymous",
                user.id if user else None,
                error.code if error else "ok",
                details=self.invitation_facts(
                    user,
                    invitation,
                    previous,
                    accepted=password is not None and error is None,
                    changed=password is not None and error is None,
                )
                if user and invitation
                else None,
            )
        if error:
            raise error
        return email

    def keyed(self, value: str) -> str:
        import hmac

        return hmac.new(
            bytes.fromhex(self.policy.key), value.encode(), "sha256"
        ).hexdigest()

    def user_proof(self, user: User) -> str:
        return self.keyed(
            f"{user.id}:{user.version}:{user.state}:{user.role}:{user.password_hash}"
        )

    def csrf_token(self, context_id: str) -> str:
        return self.keyed("csrf:" + context_id)

    def new_context(self, db: Session, user: User | None = None) -> tuple[Context, str]:
        secret = secrets.token_urlsafe(32)
        now = self.now(db)
        identifier = digest(secret)
        context = Context(
            id=identifier,
            csrf=digest(self.csrf_token(identifier)),
            state="verified" if user else "anonymous",
            user_id=user.id if user else None,
            proof=self.user_proof(user) if user else None,
            created_at=now,
            last_activity=now,
            expires_at=now
            + timedelta(seconds=86400 if user else self.policy.context_seconds),
        )
        db.add(context)
        return context, secret

    def context(self, db: Session, secret: str | None) -> Context:
        context = db.get(Context, digest(secret or ""), with_for_update=True)
        now = self.now(db)
        if (
            not context
            or context.state == "revoked"
            or context.expires_at <= now
            or context.last_activity + timedelta(seconds=86400) <= now
        ):
            raise AuthError(401, "session_expired")
        if context.user_id:
            user = db.get(User, context.user_id, with_for_update=True)
            if (
                not user
                or user.state != "active"
                or not secrets.compare_digest(
                    context.proof or "", self.user_proof(user)
                )
            ):
                raise AuthError(401, "session_expired")
        return context

    def principal(self, db: Session, secret: str | None) -> User:
        context = self.context(db, secret)
        if context.state != "verified" or not context.user_id:
            raise AuthError(401, "otp_required")
        user = db.get(User, context.user_id)
        assert user
        return user

    def projection(self, db: Session, context: Context) -> dict[str, object]:
        result: dict[str, object] = {
            "state": context.state,
            "csrf": self.csrf_token(context.id),
        }
        if context.state == "pending":
            pending_user = db.get(User, context.user_id)
            assert pending_user
            result["email"] = pending_user.email[:1] + "***@example.test"
        if context.state == "verified":
            user = db.get(User, context.user_id)
            assert user
            result["user"] = {"id": user.id, "email": user.email, "role": user.role}
            result["expires_at"] = min(
                context.expires_at, context.last_activity + timedelta(seconds=86400)
            ).isoformat()
        return result

    def session(self, secret: str | None) -> tuple[dict[str, object], str | None]:
        with Session(self.engine) as db, db.begin():
            if secret:
                context = self.context(db, secret)
                cookie = None
            else:
                context, cookie = self.new_context(db)
            return self.projection(db, context), cookie

    def guard(self, db: Session, secret: str | None, csrf: str | None) -> Context:
        context = self.context(db, secret)
        if not secrets.compare_digest(context.csrf, digest(csrf or "")):
            raise AuthError(403, "csrf_invalid")
        return context

    def limit(self, db: Session, key: str, window: int, maximum: int) -> bool:
        from sqlalchemy.dialects.postgresql import insert

        now = self.now(db)
        identifier = self.keyed(key)
        db.execute(
            insert(Abuse)
            .values(id=identifier, started_at=now, count=0)
            .on_conflict_do_nothing(index_elements=["id"])
        )
        counter = db.get(Abuse, identifier, with_for_update=True)
        assert counter
        if counter.started_at + timedelta(seconds=window) <= now:
            counter.started_at, counter.count = now, 0
        counter.count += 1
        if counter.count == maximum + 1:
            self.audit(db, "abuse_limit", "anonymous", identifier, "limited")
        return counter.count <= maximum

    def prepare_otp(
        self, db: Session, user: User, context: Context, otp: OTP | None
    ) -> tuple[str, str]:
        now = self.now(db)
        code = f"{secrets.randbelow(1000000):06d}"
        generation = str(uuid4())
        if otp is None:
            otp = OTP(user_id=user.id, attempts=0, resends=0)
            db.add(otp)
        otp.context_id, otp.generation = context.id, generation
        otp.verifier = self.keyed(f"otp:{user.id}:{context.id}:{generation}:{code}")
        otp.state, otp.sent_at = "prepared", now
        otp.expires_at = now + timedelta(seconds=self.policy.otp_seconds)
        context.state, context.user_id = "pending", user.id
        context.proof = self.user_proof(user)
        self.audit(db, "otp_prepare", user.id, user.id)
        return code, generation

    def deliver_otp(self, user_id: str, email: str, generation: str, code: str) -> None:
        delivered = True
        try:
            self.mail.send(email, "otp", code)
        except OSError:
            delivered = False
        with Session(self.engine) as db, db.begin():
            otp = db.get(OTP, user_id, with_for_update=True)
            if not otp or otp.generation != generation:
                raise AuthError(409, "delivery_superseded")
            otp.state = "delivered" if delivered else "prepared"
            self.audit(
                db, "otp_delivery", user_id, user_id, "sent" if delivered else "failed"
            )
        if not delivered:
            raise AuthError(503, "otp_delivery_failed")

    def login(
        self, secret: str | None, csrf: str | None, email: str, password: str, ip: str
    ) -> dict[str, object]:
        from argon2.exceptions import InvalidHashError, VerificationError

        error = None
        delivery = None
        normalized = email.strip().lower()
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            # Shared with invitation/lifecycle writes, before any row locks.
            network_ok = self.limit(
                db, "ip:" + ip, self.policy.ip_window_seconds, self.policy.ip_limit
            )
            account_ok = self.limit(
                db,
                "login:" + normalized,
                self.policy.login_window_seconds,
                self.policy.login_limit,
            )
            context = self.guard(db, secret, csrf)
            if context.state == "verified":
                raise AuthError(409, "logout_required")
            user = db.scalar(
                select(User).where(User.email == normalized).with_for_update()
            )
            valid = False
            try:
                valid = (
                    network_ok
                    and account_ok
                    and self.hasher.verify(
                        user.password_hash
                        if user and user.password_hash
                        else self.dummy_hash,
                        password,
                    )
                )
            except (VerificationError, InvalidHashError):
                pass
            if not network_ok or not account_ok:
                error = AuthError(429, "authentication_limited")
            elif not valid or not user or user.state != "active":
                error = AuthError(401, "credentials_invalid")
            else:
                otp = db.get(OTP, user.id, with_for_update=True)
                now = self.now(db)
                if (
                    otp
                    and otp.sent_at + timedelta(seconds=self.policy.context_seconds)
                    <= now
                    and (not otp.locked_until or otp.locked_until <= now)
                ):
                    otp.attempts, otp.resends, otp.locked_until = 0, 0, None
                if otp and otp.locked_until and otp.locked_until > now:
                    error = AuthError(429, "otp_locked")
                elif (
                    otp
                    and otp.sent_at + timedelta(seconds=self.policy.resend_seconds)
                    > now
                ):
                    error = AuthError(429, "otp_cooldown")
                elif (
                    otp
                    and otp.state != "consumed"
                    and otp.resends >= self.policy.resend_max
                ):
                    error = AuthError(429, "otp_resend_limit")
                else:
                    if otp and otp.locked_until and otp.locked_until <= now:
                        otp.attempts, otp.locked_until = 0, None
                    if otp and otp.state == "consumed":
                        otp.attempts, otp.resends, otp.locked_until = 0, 0, None
                    elif otp:
                        otp.resends += 1
                    code, generation = self.prepare_otp(db, user, context, otp)
                    delivery = (user.id, user.email, generation, code)
            self.audit(
                db,
                "login",
                "anonymous",
                user.id if user else self.keyed("login:" + normalized),
                error.code if error else "pending",
            )
        if error:
            raise error
        assert delivery
        self.deliver_otp(*delivery)
        return {"state": "pending", "email": normalized[:1] + "***@example.test"}

    def otp(
        self, secret: str | None, csrf: str | None, code: str | None = None
    ) -> tuple[dict[str, object], str | None]:
        error = None
        delivery = None
        cookie = None
        result: dict[str, object] = {}
        grant_target = None
        with Session(self.engine) as db, db.begin():
            context = self.guard(db, secret, csrf)
            if context.state != "pending" or not context.user_id:
                raise AuthError(401, "otp_required")
            user = db.get(User, context.user_id, with_for_update=True)
            otp = db.get(OTP, context.user_id, with_for_update=True)
            now = self.now(db)
            if not user or not otp or otp.context_id != context.id:
                error = AuthError(400, "otp_invalid")
            elif otp.state == "consumed":
                error = AuthError(409, "otp_consumed")
            elif otp.locked_until and otp.locked_until > now:
                error = AuthError(429, "otp_locked")
            elif code is None:
                if otp.sent_at + timedelta(seconds=self.policy.resend_seconds) > now:
                    error = AuthError(429, "otp_cooldown")
                elif otp.resends >= self.policy.resend_max:
                    error = AuthError(429, "otp_resend_limit")
                else:
                    otp.resends += 1
                    if otp.locked_until and otp.locked_until <= now:
                        otp.attempts, otp.locked_until = 0, None
                    value, generation = self.prepare_otp(db, user, context, otp)
                    delivery = (user.id, user.email, generation, value)
                    result = {"state": "pending"}
            else:
                expected = self.keyed(
                    f"otp:{user.id}:{context.id}:{otp.generation}:{code}"
                )
                if (
                    otp.state != "delivered"
                    or otp.expires_at <= now
                    or len(code) != 6
                    or not code.isascii()
                    or not code.isdecimal()
                    or not secrets.compare_digest(otp.verifier, expected)
                ):
                    otp.attempts += 1
                    if otp.attempts >= self.policy.otp_attempts:
                        otp.locked_until = now + timedelta(
                            seconds=self.policy.otp_lock_seconds
                        )
                    error = AuthError(400, "otp_invalid")
                else:
                    otp.state, context.state = "consumed", "revoked"
                    verified, cookie = self.new_context(db, user)
                    result = self.projection(db, verified)
                    grant_target = verified.id
            self.audit(
                db,
                "otp_resend" if code is None else "otp_verify",
                context.user_id,
                grant_target or context.id,
                error.code if error else "ok",
            )
        if error:
            raise error
        if delivery:
            self.deliver_otp(*delivery)
        return result, cookie

    def logout(self, secret: str | None, csrf: str | None) -> None:
        with Session(self.engine) as db, db.begin():
            context = self.guard(db, secret, csrf)
            context.state = "revoked"
            self.audit(db, "logout", context.user_id or "anonymous", context.id)
