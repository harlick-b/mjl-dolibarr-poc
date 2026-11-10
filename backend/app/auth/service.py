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

from app.auth.mail import MailRenderer, ResendMailer, TestMailbox
from app.auth.models import OTP, Abuse, Audit, Context, Invitation, Recovery, User
from app.auth.policy import Policy, normalize_email, normalize_full_name

request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
logger = logging.getLogger(__name__)


class AuthError(Exception):
    def __init__(self, status: int, code: str):
        self.status = status
        self.code = code
        super().__init__(code)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def duration_label(seconds: int) -> str:
    if seconds % 86400 == 0:
        return f"{seconds // 86400} jours"
    if seconds % 60 == 0:
        return f"{seconds // 60} minutes"
    return f"{seconds} secondes"


def masked_email(value: str) -> str:
    local, domain = value.split("@", 1)
    return f"{local[:1]}***@{domain}"


class AuthService:
    def __init__(self, engine: Engine, policy: Policy | None):
        if policy is None:
            raise AuthError(503, "authentication_unavailable")
        from argon2 import PasswordHasher

        self.hasher = PasswordHasher()
        self.dummy_hash = self.hasher.hash(secrets.token_urlsafe(32))
        from app.auth.security_log import SecurityLog

        self.security_log = SecurityLog()
        self.engine = engine
        self.policy = policy
        if policy.mailbox:
            self.mail: TestMailbox | ResendMailer = TestMailbox(policy.mailbox)
        else:
            assert policy.resend_api_key and policy.email_from
            self.mail = ResendMailer(
                policy.resend_api_key, policy.email_from, policy.email_reply_to
            )
        self.mail_renderer = MailRenderer()
        self.clock: Callable[[], datetime] | None = None

    def environment_verified(
        self, db: Session, *, require_context: bool = True
    ) -> None:
        """Verify the exact schema and configured lifecycle database."""
        if (
            not self.policy.recovery_enabled
            or not self.policy.lifecycle_database
            or self.policy.lifecycle_database != self.engine.url.database
            or (
                self.policy.fixture == "a1-synthetic-v1"
                and not self.policy.lifecycle_database.startswith("mjl_test_")
            )
        ):
            raise AuthError(409, "eligibility_unverified")
        # Hosted local development may share a database with provider metadata.
        # MJL still owns the complete public schema; unknown schemas fail closed.
        provider_schemas = (
            {
                "auth",
                "extensions",
                "graphql",
                "graphql_public",
                "realtime",
                "storage",
                "vault",
            }
            if self.policy.fixture == "local-v1"
            else set()
        )
        if provider_schemas:
            search_path = db.scalar(text("SELECT current_schemas(false)"))
            if not search_path or search_path[0] != "public":
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
                "pta_activity_contributor",
                "pta_activity_revision",
                "pta_activity_revision_decision",
                "pta_funding_request",
                "pta_funding_decision",
                "pta_disbursement_request",
                "pta_disbursement_decision",
                "pta_virement_request",
                "pta_virement_decision",
                "pta_virement_confirmation",
                "pta_reversement_declaration",
                "pta_activity_reminder",
                "pta_activity_assignment_notification",
                "pta_activity_workflow_notification",
                "pta_financial_workflow_notification",
                "pta_activity_document",
                "pta_activity_document_withdrawal",
                "pta_zero_spending_declaration",
                "pta_zero_spending_decision",
            )
        }
        relations = {row for row in relations if row[0] not in provider_schemas}
        if relations != expected:
            raise AuthError(409, "eligibility_unverified")
        revisions = list(
            db.scalars(text("SELECT version_num FROM public.alembic_version"))
        )
        if revisions != ["0034_financial_notifications"]:
            raise AuthError(409, "eligibility_unverified")
        required_constraints = {
            "ownership_context_singleton",
            "project_one_active_per_partner",
            "pta_project_year",
            "activity_request_key",
            "assignment_one_current",
            "audit_business_bounded",
            "activity_state_allowed",
            "activity_revision_pointer_state",
            "activity_amendment_state",
            "activity_withdrawal_state",
            "activity_transfer_state",
            "activity_closure_facts",
            "activity_placement_year_valid",
            "activity_revision_number",
            "revision_decision_stage",
            "decision_prevalidation_scope",
            "decision_stage_role_outcome",
            "operation_actual_spent_nonnegative",
            "operation_execution_started_before_facts",
            "operation_completion_has_amount",
            "disbursement_request_state_allowed",
            "disbursement_amount_positive",
            "disbursement_snapshot_bounded",
            "disbursement_cancellation_facts",
            "disbursement_one_open_per_activity",
            "disbursement_decision_stage",
            "disbursement_decision_role_allowed",
            "disbursement_decision_reason",
            "disbursement_prevalidation_reference",
            "disbursement_prevalidation_same_request",
            "virement_request_state_allowed",
            "virement_exclusions_bounded",
            "virement_cancellation_facts",
            "virement_one_open_per_activity",
            "virement_decision_stage",
            "virement_decision_role_allowed",
            "virement_decision_reason",
            "virement_prevalidation_reference",
            "virement_prevalidation_same_request",
            "virement_confirmation_revision",
            "virement_confirmation_revision_positive",
            "virement_confirmation_amount_positive",
            "virement_confirmation_correction_reason",
            "reversement_declaration_revision",
            "reversement_declaration_revision_positive",
            "reversement_declaration_amount_positive",
            "reversement_declaration_correction_reason",
            "zero_spending_state_allowed",
            "zero_spending_reason_required",
            "zero_spending_snapshot_bounded",
            "zero_spending_one_current_per_activity",
            "zero_spending_decision_stage",
            "zero_spending_decision_role_allowed",
            "zero_spending_decision_reason",
            "zero_spending_prevalidation_reference",
            "zero_spending_prevalidation_same_declaration",
            "document_sharing_version",
            "document_withdrawal_reason",
            "document_withdrawal_not_self",
            "auth_user_partner_binding",
            "auth_user_partner_immutable",
        }
        found = set(
            db.scalars(
                text("""
                SELECT conname FROM pg_catalog.pg_constraint
                WHERE conname = ANY(:names)
                UNION
                SELECT indexname FROM pg_catalog.pg_indexes
                WHERE indexname = ANY(:names)
                UNION
                SELECT tgname FROM pg_catalog.pg_trigger
                WHERE tgname = ANY(:names) AND NOT tgisinternal
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
                  SELECT 'column' kind, c.relname object, a.attname name,
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
                  UNION ALL
                  SELECT 'trigger', c.relname, t.tgname,
                    t.tgenabled::text || '|' || pg_get_triggerdef(t.oid)
                  FROM pg_catalog.pg_trigger t
                  JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
                  JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
                  WHERE n.nspname='public' AND c.relname=ANY(:tables)
                    AND NOT t.tgisinternal
                  UNION ALL
                  SELECT 'function', p.proname, p.oid::regprocedure::text,
                    p.provolatile::text || '|' || p.prosecdef::text || '|' ||
                    pg_get_functiondef(p.oid)
                  FROM pg_catalog.pg_proc p
                  JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
                  WHERE n.nspname='public' AND p.proname IN
                    ('pta_reject_immutable','pta_validate_final_decision',
                     'pta_validate_activity_review_state',
                     'pta_validate_activity_transfer_state',
                     'pta_preserve_activity_request',
                     'pta_preserve_operation_execution',
                     'auth_audit_immutable',
                     'pta_preserve_funding',
                     'pta_validate_funding_state',
                     'pta_preserve_disbursement',
                     'pta_validate_disbursement_state',
                     'pta_preserve_virement',
                     'pta_validate_virement_state',
                     'pta_preserve_virement_confirmation',
                     'pta_preserve_reversement_declaration',
                     'pta_validate_activity_closure',
                     'pta_reject_closed_financial_change',
                     'pta_preserve_activity_document')
                     OR p.proname IN ('pta_preserve_zero_spending',
                       'pta_validate_zero_spending_state',
                       'pta_validate_activity_document_withdrawal',
                       'auth_preserve_partner_binding')
                ) manifest ORDER BY kind,object,name
                """),
                {"tables": table_names},
            )
        ]
        encoded_manifest = json.dumps(manifest, separators=(",", ":"))
        manifest_hash = hashlib.sha256(encoded_manifest.encode()).hexdigest()
        if manifest_hash != (
            "1e3f86a9ea6ca0eee7446f545c6ad77136cdf8115847e9990ed1ba8866fcde15"
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

    def send_mail(self, recipient: str, kind: str, **context: object) -> str:
        return self.mail.send(
            recipient, kind, self.mail_renderer.render(kind, **context)
        )

    def audit(
        self,
        db: Session,
        action: str,
        actor: str,
        target: str | None,
        outcome: str = "ok",
        details: dict[str, str | int] | None = None,
    ) -> None:
        if self.security_log.record(
            db, action, actor, target, outcome, request_id.get()
        ):
            return
        if details is not None:
            allowed = {
                "before_first_name",
                "before_last_name",
                "first_name",
                "last_name",
                "before_full_name",
                "full_name",
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
                "activity_id",
                "agent_id",
                "planned_end",
                "email_status",
                "provider_message_id",
                "media_type",
                "format",
                "row_count",
                "byte_size",
                "sha256",
                "as_of",
                "replacement_document_id",
                "pta_id",
                "partner_id",
            }
            if set(details) - allowed or any(
                type(v) not in (str, int) for v in details.values()
            ):
                raise ValueError("Invalid audit facts")
            if any(
                isinstance(value, str)
                and len(value)
                > (
                    200
                    if key
                    in {
                        "reason",
                        "before_full_name",
                        "full_name",
                        "before_first_name",
                        "before_last_name",
                        "first_name",
                        "last_name",
                    }
                    else 64
                )
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
        business = dict(business)
        if action == "activity.closed":
            closure_required = {
                "context_id",
                "activity_id",
                "approved_revision_id",
                "before_version",
                "version",
                "closed_by_id",
                "closed_at",
                "ended_assignment_ids",
            }
            before_version = business.get("before_version")
            version = business.get("version")
            ended_ids = business.get("ended_assignment_ids")
            if (
                set(business) != closure_required
                or business.get("context_id") != "MJL"
                or business.get("activity_id") != target
                or not all(
                    isinstance(business.get(key), str)
                    for key in (
                        "activity_id",
                        "approved_revision_id",
                        "closed_by_id",
                        "closed_at",
                    )
                )
                or not isinstance(before_version, int)
                or not isinstance(version, int)
                or version != before_version + 1
                or not isinstance(ended_ids, list)
                or not all(isinstance(value, str) for value in ended_ids)
            ):
                raise ValueError("Invalid business audit facts")
            encoded = json.dumps(
                business, separators=(",", ":"), sort_keys=True, ensure_ascii=False
            )
            if len(encoded.encode()) > 65536:
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
            return
        if action.startswith("reversement."):
            reversement_required = {
                "context_id",
                "activity_id",
                "request_id",
                "confirmation_id",
                "declaration_id",
                "revision",
                "required_amount",
                "returned_amount",
                "before",
                "after",
                "reason",
            }
            if (
                set(business) != reversement_required
                or business.get("context_id") != "MJL"
                or business.get("declaration_id") != target
                or not all(
                    isinstance(business.get(key), str)
                    for key in ("activity_id", "request_id", "confirmation_id")
                )
                or not isinstance(business.get("revision"), int)
                or not all(
                    isinstance(business.get(key), str)
                    and str(business[key]).isascii()
                    and str(business[key]).isdecimal()
                    for key in ("required_amount", "returned_amount")
                )
                or not isinstance(business.get("after"), dict)
                or not (
                    business.get("before") is None
                    or isinstance(business.get("before"), dict)
                )
                or not (
                    business.get("reason") is None
                    or isinstance(business.get("reason"), str)
                )
            ):
                raise ValueError("Invalid business audit facts")
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
            return
        if action.startswith("virement_confirmation."):
            confirmation_required = {
                "context_id",
                "activity_id",
                "request_id",
                "confirmation_id",
                "revision",
                "amount",
                "before",
                "after",
                "reason",
            }
            if (
                set(business) != confirmation_required
                or business.get("context_id") != "MJL"
                or business.get("confirmation_id") != target
                or not isinstance(business.get("activity_id"), str)
                or not isinstance(business.get("request_id"), str)
                or not isinstance(business.get("revision"), int)
                or not isinstance(business.get("amount"), str)
                or not str(business["amount"]).isascii()
                or not str(business["amount"]).isdecimal()
                or not isinstance(business.get("after"), dict)
                or not (
                    business.get("before") is None
                    or isinstance(business.get("before"), dict)
                )
                or not (
                    business.get("reason") is None
                    or isinstance(business.get("reason"), str)
                )
            ):
                raise ValueError("Invalid business audit facts")
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
            return
        if action.startswith("virement."):
            virement_required = {
                "reason",
                "context_id",
                "activity_id",
                "request_id",
                "disbursement_request_id",
                "amount",
                "before_state",
                "after_state",
            }
            states = {
                None,
                "submitted",
                "prevalidated",
                "returned",
                "approved",
                "cancelled",
            }
            if (
                (
                    business.get("reason") is not None
                    and (
                        not isinstance(business["reason"], str)
                        or len(business["reason"]) > 4000
                    )
                )
                or set(business) != virement_required
                or business.get("context_id") != "MJL"
                or business.get("request_id") != target
                or not isinstance(business.get("activity_id"), str)
                or not isinstance(business.get("disbursement_request_id"), str)
                or not isinstance(business.get("amount"), str)
                or not str(business["amount"]).isascii()
                or not str(business["amount"]).isdecimal()
                or business.get("before_state") not in states
                or business.get("after_state") not in states - {None}
            ):
                raise ValueError("Invalid business audit facts")
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
            return
        if action.startswith("zero_spending."):
            zero_required = {
                "reason",
                "context_id",
                "activity_id",
                "declaration_id",
                "approved_revision_id",
                "before_state",
                "after_state",
            }
            zero_states = {None, "submitted", "prevalidated", "returned", "approved"}
            if (
                (
                    business.get("reason") is not None
                    and (
                        not isinstance(business["reason"], str)
                        or len(business["reason"]) > 4000
                    )
                )
                or set(business) != zero_required
                or business.get("context_id") != "MJL"
                or business.get("declaration_id") != target
                or not isinstance(business.get("activity_id"), str)
                or not isinstance(business.get("approved_revision_id"), str)
                or business.get("before_state") not in zero_states
                or business.get("after_state") not in zero_states - {None}
            ):
                raise ValueError("Invalid business audit facts")
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
            return
        if action.startswith(("disbursement.", "funding.")):
            disbursement_required = {
                "reason",
                "context_id",
                "activity_id",
                "request_id",
                "amount",
                "before_state",
                "after_state",
            }
            disbursement_states = {
                None,
                "submitted",
                "prevalidated",
                "returned",
                "approved",
                "cancelled",
            }
            if (
                (
                    business.get("reason") is not None
                    and (
                        not isinstance(business["reason"], str)
                        or len(business["reason"]) > 4000
                    )
                )
                or set(business) != disbursement_required
                or business.get("context_id") != "MJL"
                or business.get("request_id") != target
                or not isinstance(business.get("activity_id"), str)
                or not isinstance(business.get("amount"), str)
                or not str(business["amount"]).isascii()
                or not str(business["amount"]).isdecimal()
                or business.get("before_state") not in disbursement_states
                or business.get("after_state") not in disbursement_states - {None}
            ):
                raise ValueError("Invalid business audit facts")
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
            return
        if action in {
            "operation.execution_started",
            "operation.execution_recorded",
            "operation.execution_corrected",
        }:
            execution_required = {
                "context_id",
                "activity_id",
                "operation_id",
                "approved_revision_id",
                "approved_allocation",
                "before",
                "after",
                "correction_reason",
            }

            def valid_execution_facts(value: object) -> bool:
                fields = {
                    "execution_started_at",
                    "execution_completed",
                    "actual_spent",
                    "execution_observation",
                }
                return (
                    isinstance(value, dict)
                    and set(value) == fields
                    and (
                        value["execution_started_at"] is None
                        or isinstance(value["execution_started_at"], str)
                    )
                    and isinstance(value["execution_completed"], bool)
                    and (
                        value["actual_spent"] is None
                        or (
                            isinstance(value["actual_spent"], str)
                            and value["actual_spent"].isascii()
                            and value["actual_spent"].isdecimal()
                        )
                    )
                    and isinstance(value["execution_observation"], str)
                    and len(value["execution_observation"]) <= 4000
                )

            if (
                set(business) != execution_required
                or business.get("context_id") != "MJL"
                or business.get("operation_id") != target
                or not all(
                    isinstance(business.get(key), str)
                    for key in (
                        "activity_id",
                        "operation_id",
                        "approved_revision_id",
                        "approved_allocation",
                    )
                )
                or not valid_execution_facts(business.get("before"))
                or not valid_execution_facts(business.get("after"))
                or (
                    business.get("correction_reason") is not None
                    and (
                        not isinstance(business.get("correction_reason"), str)
                        or not 1 <= len(str(business["correction_reason"])) <= 4000
                    )
                )
            ):
                raise ValueError("Invalid business audit facts")
            encoded = json.dumps(
                business, separators=(",", ":"), sort_keys=True, ensure_ascii=False
            )
            if len(encoded.encode()) > 65536:
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
            return
        revision_facts = business.get("revision")
        before_facts = business.get("before")
        amendment_replace = (
            action == "activity.replace"
            and isinstance(before_facts, dict)
            and isinstance(before_facts.get("amendment"), dict)
        )
        compact_transition = (
            action
            in {
                "activity.amendment_open",
                "activity.amendment_cancel",
                "activity.withdrawal_cancel",
                "activity.transfer_cancel",
            }
            or amendment_replace
            or (
                action
                in {
                    "activity.submit",
                    "activity.prevalidate",
                    "activity.return_supervisor",
                    "activity.approve",
                    "activity.return_validator",
                    "activity.withdrawal_submit",
                    "activity.withdrawal_prevalidate",
                    "activity.withdrawal_return_supervisor",
                    "activity.withdrawal_approve",
                    "activity.withdrawal_return_validator",
                    "activity.transfer_submit",
                    "activity.transfer_prevalidate",
                    "activity.transfer_return_supervisor",
                    "activity.transfer_approve",
                    "activity.transfer_return_validator",
                }
                and isinstance(revision_facts, dict)
                and (
                    isinstance(revision_facts.get("amendment_id"), str)
                    or isinstance(revision_facts.get("withdrawal_id"), str)
                    or isinstance(revision_facts.get("transfer_id"), str)
                )
            )
        )
        if compact_transition:
            transition_fields = {
                "id",
                "state",
                "version",
                "current_revision_id",
                "approved_revision_id",
                "pta_id",
                "placement_year",
                "amendment_id",
                "withdrawal_id",
                "transfer_id",
            }
            for side in ("before", "after"):
                value = business.get(side)
                if isinstance(value, dict):
                    amendment = value.get("amendment")
                    withdrawal = value.get("withdrawal")
                    transfer = value.get("transfer")
                    content = (
                        {
                            key: value.get(key)
                            for key in (
                                "name",
                                "description",
                                "planned_start",
                                "planned_end",
                                "allocation",
                                "operations",
                            )
                        }
                        if amendment_replace
                        else None
                    )
                    business[side] = {
                        "amendment_id": (
                            amendment.get("id") if isinstance(amendment, dict) else None
                        ),
                        "withdrawal_id": (
                            withdrawal.get("id")
                            if isinstance(withdrawal, dict)
                            else None
                        ),
                        "transfer_id": (
                            transfer.get("id") if isinstance(transfer, dict) else None
                        ),
                        **{
                            key: value.get(key)
                            for key in transition_fields
                            - {"amendment_id", "withdrawal_id", "transfer_id"}
                        },
                        **({"content": content} if content is not None else {}),
                    }
        shapes = {
            "partner.create": "partner",
            "partner.update": "partner",
            "operation_type.create": "type",
            "pta.create": "pta",
            "pta.update": "pta",
            "project.create": "project",
            "project.close": "project",
            "project.update": "project",
            "activity.create": "activity",
            "activity.replace": "activity",
            "activity.assign_agents": "activity",
            "activity.submit": "activity",
            "activity.prevalidate": "activity",
            "activity.return_supervisor": "activity",
            "activity.approve": "activity",
            "activity.return_validator": "activity",
            "activity.amendment_open": "activity",
            "activity.amendment_cancel": "activity",
            "activity.withdrawal_submit": "activity",
            "activity.withdrawal_prevalidate": "activity",
            "activity.withdrawal_return_supervisor": "activity",
            "activity.withdrawal_approve": "activity",
            "activity.withdrawal_return_validator": "activity",
            "activity.withdrawal_cancel": "activity",
            "activity.transfer_submit": "activity",
            "activity.transfer_prevalidate": "activity",
            "activity.transfer_return_supervisor": "activity",
            "activity.transfer_approve": "activity",
            "activity.transfer_return_validator": "activity",
            "activity.transfer_cancel": "activity",
        }
        create_actions = {
            "pta.create",
            "partner.create",
            "operation_type.create",
            "project.create",
            "activity.create",
        }
        change_actions = set(shapes) - create_actions
        workflow_actions = {
            "activity.submit",
            "activity.prevalidate",
            "activity.return_supervisor",
            "activity.approve",
            "activity.return_validator",
            "activity.withdrawal_submit",
            "activity.withdrawal_prevalidate",
            "activity.withdrawal_return_supervisor",
            "activity.withdrawal_approve",
            "activity.withdrawal_return_validator",
            "activity.transfer_submit",
            "activity.transfer_prevalidate",
            "activity.transfer_return_supervisor",
            "activity.transfer_approve",
            "activity.transfer_return_validator",
        }
        required = (
            {"context_id", "after"}
            if action in create_actions
            else {
                "context_id",
                "before",
                "after",
                "revision",
                "decision",
                "ended_assignment_ids",
            }
            if action == "activity.withdrawal_approve"
            else {"context_id", "before", "after", "revision", "decision"}
            if action
            in workflow_actions
            - {
                "activity.submit",
                "activity.withdrawal_submit",
                "activity.transfer_submit",
            }
            else {"context_id", "before", "after", "revision"}
            if action
            in {
                "activity.submit",
                "activity.withdrawal_submit",
                "activity.transfer_submit",
            }
            else {"context_id", "before", "after", "removed_operations"}
            if action == "activity.replace"
            else {"context_id", "before", "after", "amendment"}
            if action == "activity.amendment_open"
            else {
                "context_id",
                "before",
                "after",
                "amendment",
                "candidate",
                "last_revision_id",
                "cancellation",
            }
            if action == "activity.amendment_cancel"
            else {
                "context_id",
                "before",
                "after",
                "withdrawal",
                "current_revision_id",
                "cancellation",
            }
            if action == "activity.withdrawal_cancel"
            else {
                "context_id",
                "before",
                "after",
                "transfer",
                "current_revision_id",
                "cancellation",
            }
            if action == "activity.transfer_cancel"
            else {"context_id", "before", "after"}
            if action in change_actions
            else None
        )
        after = business.get("after")
        before = business.get("before")
        ended_assignment_ids = business.get("ended_assignment_ids")

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
                "partner": {"id", "name", "description", "active", "allowed_actions"},
                "pta": {
                    "id",
                    "project_id",
                    "year",
                    "name",
                    "description",
                    "version",
                    "allowed_actions",
                },
                "type": {
                    "id",
                    "label",
                    "description",
                    "active",
                    "allowed_actions",
                },
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
                    "project_id",
                    "reference",
                    "name",
                    "description",
                    "planned_start",
                    "planned_end",
                    "allocation",
                    "state",
                    "version",
                    "current_revision_id",
                    "approved_revision_id",
                    "approved_allocation",
                    "approved",
                    "candidate",
                    "amendment",
                    "withdrawal",
                    "transfer",
                    "placement_year",
                    "execution_paused",
                    "correction",
                    "operations",
                    "agent_ids",
                    "allowed_actions",
                    "closure",
                },
            }[shape]
            if set(value) != fields or not isinstance(value.get("id"), str):
                return False
            if not isinstance(value.get("allowed_actions"), list) or not all(
                isinstance(action, str) for action in value["allowed_actions"]
            ):
                return False
            if shape == "partner" and value.get("description") is not None:
                description = value["description"]
                if not isinstance(description, str) or len(description) > 4000:
                    return False
            if shape in {"partner", "type"}:
                label = value.get("name" if shape == "partner" else "label")
                description = value.get("description")
                return (
                    isinstance(label, str)
                    and bool(label)
                    and (
                        description is None
                        or isinstance(description, str)
                        and len(description) <= 4000
                    )
                    and isinstance(value.get("active"), bool)
                )
            if shape == "pta":
                return (
                    isinstance(value.get("name"), str)
                    and 0 < len(value["name"]) <= 200
                    and isinstance(value.get("project_id"), str)
                    and isinstance(value.get("year"), int)
                    and 2000 <= value["year"] <= 2200
                    and isinstance(value.get("version"), int)
                    and value["version"] > 0
                    and (
                        value.get("description") is None
                        or isinstance(value["description"], str)
                        and len(value["description"]) <= 4000
                    )
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
                        "project_id",
                        "reference",
                        "name",
                        "description",
                        "state",
                    )
                )
                and value.get("state")
                in {
                    "draft",
                    "amendment_draft",
                    "submitted",
                    "prevalidated",
                    "returned_supervisor",
                    "returned_validator",
                    "approved",
                    "withdrawn",
                    "closed",
                }
                and isinstance(value.get("version"), int)
                and value["version"] > 0
                and isinstance(operations, list)
                and (0 if value.get("state") == "draft" else 1)
                <= len(operations)
                <= 100
                and all(
                    isinstance(value.get(field), str)
                    or (value.get("state") == "draft" and value.get(field) is None)
                    for field in ("planned_start", "planned_end", "allocation")
                )
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
                and isinstance(value.get("execution_paused"), bool)
                and (
                    value.get("closure") is None
                    or (
                        isinstance(value.get("closure"), dict)
                        and set(value["closure"]) == {"closed_by_id", "closed_at"}
                        and all(
                            isinstance(value["closure"].get(key), str)
                            for key in ("closed_by_id", "closed_at")
                        )
                    )
                )
            )

        def valid_amendment_facts(value: object, *, opened: bool) -> bool:
            if not isinstance(value, dict):
                return False
            fields = {"id", "reason", "base_approved_revision_id"}
            if opened:
                fields |= {"opened_by_id", "opened_at"}
            return (
                set(value) == fields
                and all(isinstance(value.get(key), str) for key in fields)
                and 1 <= len(value["reason"]) <= 4000
            )

        def valid_candidate(value: object) -> bool:
            if not isinstance(value, dict):
                return False
            fields = {
                "name",
                "description",
                "planned_start",
                "planned_end",
                "allocation",
                "operations",
            }
            operations = value.get("operations")
            operation_fields = {
                "id",
                "type_id",
                "type_label",
                "name",
                "allocation",
                "position",
            }
            return (
                set(value) == fields
                and all(
                    isinstance(value.get(key), str) for key in fields - {"operations"}
                )
                and isinstance(operations, list)
                and 1 <= len(operations) <= 100
                and all(
                    isinstance(row, dict)
                    and set(row) == operation_fields
                    and all(
                        isinstance(row.get(key), str)
                        for key in (
                            "id",
                            "type_id",
                            "type_label",
                            "name",
                            "allocation",
                        )
                    )
                    and isinstance(row.get("position"), int)
                    and row["position"] > 0
                    for row in operations
                )
            )

        def valid_structural_content(value: object) -> bool:
            fields = {
                "name",
                "description",
                "planned_start",
                "planned_end",
                "allocation",
                "operations",
            }
            operation_fields = {"id", "type_id", "name", "allocation", "position"}
            return (
                isinstance(value, dict)
                and set(value) == fields
                and all(
                    isinstance(value.get(key), str) for key in fields - {"operations"}
                )
                and isinstance(value.get("operations"), list)
                and 1 <= len(value["operations"]) <= 100
                and all(
                    isinstance(row, dict)
                    and set(row) == operation_fields
                    and all(
                        isinstance(row.get(key), str)
                        for key in ("id", "type_id", "name", "allocation")
                    )
                    and isinstance(row.get("position"), int)
                    and row["position"] > 0
                    for row in value["operations"]
                )
            )

        def valid_transition(value: object, *, with_content: bool = False) -> bool:
            fields = {
                "id",
                "state",
                "version",
                "current_revision_id",
                "approved_revision_id",
                "pta_id",
                "placement_year",
                "amendment_id",
                "withdrawal_id",
                "transfer_id",
            }
            if with_content:
                fields.add("content")
            return (
                isinstance(value, dict)
                and set(value) == fields
                and isinstance(value.get("id"), str)
                and isinstance(value.get("state"), str)
                and isinstance(value.get("version"), int)
                and value["version"] > 0
                and isinstance(value.get("pta_id"), str)
                and isinstance(value.get("placement_year"), int)
                and all(
                    value.get(key) is None or isinstance(value.get(key), str)
                    for key in (
                        "current_revision_id",
                        "approved_revision_id",
                        "amendment_id",
                        "withdrawal_id",
                        "transfer_id",
                    )
                )
                and (not with_content or valid_structural_content(value.get("content")))
            )

        def valid_cancellation(value: object) -> bool:
            return (
                isinstance(value, dict)
                and set(value) == {"reason", "actor_id", "occurred_at"}
                and all(isinstance(value.get(key), str) for key in value)
                and 1 <= len(value["reason"]) <= 4000
            )

        revision = business.get("revision")
        decision = business.get("decision")
        revision_fields = {
            "id",
            "revision_number",
            "fingerprint",
            "actor_id",
            "actor_role",
            "submitted_at",
        }
        valid_revision = (
            isinstance(revision, dict)
            and set(revision)
            in {
                frozenset(revision_fields),
                frozenset(
                    revision_fields | {"amendment_id", "base_approved_revision_id"}
                ),
                frozenset(
                    revision_fields
                    | {"withdrawal_id", "base_approved_revision_id", "reason"}
                ),
                frozenset(
                    revision_fields
                    | {
                        "transfer_id",
                        "base_approved_revision_id",
                        "reason",
                        "source_pta",
                        "target_year",
                    }
                ),
            }
            and isinstance(revision.get("id"), str)
            and isinstance(revision.get("revision_number"), int)
            and revision["revision_number"] > 0
            and isinstance(revision.get("fingerprint"), str)
            and len(revision["fingerprint"]) == 64
            and all(
                isinstance(revision.get(key), str)
                for key in ("actor_id", "actor_role", "submitted_at")
            )
            and (
                "amendment_id" not in revision
                and "withdrawal_id" not in revision
                and "transfer_id" not in revision
                or all(
                    isinstance(revision.get(key), str)
                    for key in (
                        "base_approved_revision_id",
                        (
                            "amendment_id"
                            if "amendment_id" in revision
                            else "withdrawal_id"
                            if "withdrawal_id" in revision
                            else "transfer_id"
                        ),
                    )
                )
            )
            and (
                "transfer_id" not in revision
                or (
                    isinstance(revision.get("reason"), str)
                    and isinstance(revision.get("source_pta"), dict)
                    and set(revision["source_pta"]) == {"id", "year"}
                    and isinstance(revision["source_pta"].get("id"), str)
                    and isinstance(revision["source_pta"].get("year"), int)
                    and isinstance(revision.get("target_year"), int)
                )
            )
        )
        valid_decision = (
            isinstance(decision, dict)
            and set(decision)
            == {
                "id",
                "stage",
                "outcome",
                "reason",
                "requested_amount",
                "actor_id",
                "actor_role",
                "decided_at",
                "prevalidation_revision_id",
            }
            and all(
                isinstance(decision.get(key), str) for key in ("id", "stage", "outcome")
            )
            and (
                decision.get("reason") is None
                or isinstance(decision.get("reason"), str)
            )
            and (
                decision.get("requested_amount") is None
                or isinstance(decision.get("requested_amount"), str)
            )
            and all(
                isinstance(decision.get(key), str)
                for key in ("actor_id", "actor_role", "decided_at")
            )
            and (
                decision.get("prevalidation_revision_id") is None
                or isinstance(decision.get("prevalidation_revision_id"), str)
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
            or (
                action == "activity.amendment_open"
                and not valid_amendment_facts(business.get("amendment"), opened=True)
            )
            or (
                action == "activity.amendment_cancel"
                and (
                    not valid_amendment_facts(business.get("amendment"), opened=False)
                    or not valid_candidate(business.get("candidate"))
                    or not valid_cancellation(business.get("cancellation"))
                    or (
                        business.get("last_revision_id") is not None
                        and not isinstance(business.get("last_revision_id"), str)
                    )
                )
            )
            or (
                action == "activity.withdrawal_cancel"
                and (
                    not valid_amendment_facts(business.get("withdrawal"), opened=False)
                    or not isinstance(business.get("current_revision_id"), str)
                    or not valid_cancellation(business.get("cancellation"))
                )
            )
            or (
                action == "activity.transfer_cancel"
                and (
                    not isinstance(business.get("transfer"), dict)
                    or not isinstance(business.get("current_revision_id"), str)
                    or not valid_cancellation(business.get("cancellation"))
                )
            )
            or (
                action == "activity.withdrawal_approve"
                and (
                    not isinstance(ended_assignment_ids, list)
                    or not all(
                        isinstance(identifier, str)
                        for identifier in ended_assignment_ids
                    )
                )
            )
            or (
                not valid_transition(after, with_content=amendment_replace)
                if compact_transition
                else not valid_item(after, shapes[action])
            )
            or (action in workflow_actions and not valid_revision)
            or (
                action
                in workflow_actions
                - {
                    "activity.submit",
                    "activity.withdrawal_submit",
                    "activity.transfer_submit",
                }
                and not valid_decision
            )
            or not isinstance(after, dict)
            or after.get("id") != target
            or (
                action in change_actions
                and (
                    (
                        not valid_transition(before, with_content=amendment_replace)
                        if compact_transition
                        else not valid_item(before, shapes[action])
                    )
                    or not isinstance(before, dict)
                    or before.get("id") != target
                )
            )
        ):
            raise ValueError("Invalid business audit facts")
        from app.audit.facts import compact_planning_facts

        business = compact_planning_facts(business)
        encoded = json.dumps(
            business, separators=(",", ":"), sort_keys=True, ensure_ascii=False
        )
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
            **({"partner_id": user.partner_id} if user.partner_id else {}),
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
            and facts.get("partner_id") == user.partner_id
            and facts.get("user_version") == user.version
            and facts.get("user_state") == user.state
        )

    def deliver_invitation(
        self, email: str, selector: str, generation: str, secret: str, actor: str
    ) -> None:
        link = f"{self.policy.origin}/invitation#selector={selector}&verifier={secret}"
        delivered = True
        provider_message_id = ""
        try:
            with Session(self.engine) as lookup:
                invitee = lookup.execute(
                    select(User.full_name, User.role)
                    .join(Invitation, Invitation.user_id == User.id)
                    .where(Invitation.id == selector, User.email == email)
                ).one()
            provider_message_id = self.send_mail(
                email,
                "invitation",
                recipient_name=invitee.full_name,
                role_label={
                    "AGENT_SAISIE": "Agent de saisie",
                    "AGENT_VERIFICATEUR": "Superviseur",
                    "VALIDATEUR_DEFINITIF": "Validateur définitif",
                    "ADMIN_PLATEFORME": "Admin technique",
                    "PARTENAIRE": "Partenaire",
                }[invitee.role],
                action_url=link,
                expiration_text=duration_label(self.policy.invitation_seconds),
            )
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
            facts = self.invitation_facts(user, invitation, "prepared")
            if provider_message_id:
                facts["provider_message_id"] = provider_message_id
            self.audit(
                db,
                "invitation_delivery",
                actor,
                user.id,
                "sent" if delivered else "failed",
                details=facts,
            )
        if not delivered:
            raise AuthError(503, "invitation_delivery_failed")

    def require_recovery(self) -> None:
        if not self.policy.recovery_enabled:
            raise AuthError(503, "recovery_unavailable")

    def recovery_request_allowed(self, email: str, ip: str) -> tuple[str, bool]:
        self.require_recovery()
        try:
            normalized = normalize_email(email)
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
        recipient_name = None
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
            recipient_name = user.full_name
        delivered = True
        provider_message_id = ""
        try:
            provider_message_id = self.send_mail(
                email,
                "password_recovery",
                recipient_name=recipient_name,
                action_url=(
                    f"{self.policy.origin}/reset-password#selector={selector}"
                    f"&verifier={secret}"
                ),
                expiration_text=duration_label(self.policy.recovery_seconds or 0),
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
                    **(
                        {"provider_message_id": provider_message_id}
                        if provider_message_id
                        else {}
                    ),
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
        provider_message_id = ""
        try:
            with Session(self.engine) as db:
                recipient_name = db.scalar(
                    select(User.full_name).where(
                        User.id == user_id, User.email == email
                    )
                )
            provider_message_id = self.send_mail(
                email,
                "password_reset_notice",
                recipient_name=recipient_name,
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
                    details={"provider_message_id": provider_message_id}
                    if provider_message_id
                    else None,
                )
        except Exception:
            return

    def bootstrap(
        self, email: str, full_name: str, operator: str, reissue: bool = False
    ) -> None:
        email = normalize_email(email)
        full_name = normalize_full_name(full_name)
        if not operator or len(operator) > 80:
            raise AuthError(403, "operator_required")
        request_id.set(str(uuid4()))
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            original = db.scalar(select(Audit).where(Audit.action == "bootstrap"))
            if not reissue:
                if original or db.scalar(select(User.id).limit(1)):
                    raise AuthError(409, "bootstrap_closed")
                user: User | None = User(
                    email=email, full_name=full_name, role="ADMIN_PLATEFORME"
                )
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
                    or (user.full_name is not None and user.full_name != full_name)
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
                if user.full_name is None:
                    user.full_name = full_name
                    user.version += 1
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
            f"{user.id}:{user.version}:{user.state}:{user.role}:"
            f"{user.partner_id or ''}:{user.password_hash}"
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

    def context(
        self, db: Session, secret: str | None, *, read_only: bool = False
    ) -> Context:
        # Concurrent page reads share identity protection; lifecycle writes still
        # need an exclusive lock and cannot revoke midway through a response.
        lock = {"read": True} if read_only else True
        context = db.get(Context, digest(secret or ""), with_for_update=lock)
        now = self.now(db)
        if (
            not context
            or context.state == "revoked"
            or context.expires_at <= now
            or context.last_activity + timedelta(seconds=86400) <= now
        ):
            raise AuthError(401, "session_expired")
        if context.user_id:
            user = db.get(User, context.user_id, with_for_update=lock)
            if (
                not user
                or user.state != "active"
                or not secrets.compare_digest(
                    context.proof or "", self.user_proof(user)
                )
            ):
                raise AuthError(401, "session_expired")
        return context

    def principal(
        self,
        db: Session,
        secret: str | None,
        *,
        read_only: bool = False,
        mutation: bool = False,
        csrf: str | None = None,
        roles: set[str] | None = None,
        forbidden: str = "business_forbidden",
    ) -> User:
        # Resolve the current actor once, within the caller's transaction.
        # Never reuse this result across transactions or external I/O.
        context = self.context(db, secret, read_only=read_only and not mutation)
        if context.state != "verified" or not context.user_id:
            raise AuthError(401, "otp_required")
        user = db.get(User, context.user_id)
        assert user
        if roles is not None and user.role not in roles:
            raise AuthError(403, forbidden)
        if mutation and not secrets.compare_digest(context.csrf, digest(csrf or "")):
            raise AuthError(403, "csrf_invalid")
        return user

    def projection(self, db: Session, context: Context) -> dict[str, object]:
        result: dict[str, object] = {
            "state": context.state,
            "csrf": self.csrf_token(context.id),
        }
        if context.state == "pending":
            pending_user = db.get(User, context.user_id)
            assert pending_user
            result["email"] = masked_email(pending_user.email)
        if context.state == "verified":
            user = db.get(User, context.user_id)
            assert user
            result["user"] = {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "role": user.role,
            }
            result["expires_at"] = min(
                context.expires_at, context.last_activity + timedelta(seconds=86400)
            ).isoformat()
        return result

    def session(self, secret: str | None) -> tuple[dict[str, object], str | None]:
        with Session(self.engine) as db, db.begin():
            if secret:
                context = self.context(db, secret, read_only=True)
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
        provider_message_id = ""
        try:
            provider_message_id = self.send_mail(
                email,
                "otp",
                otp_code=code,
                expiration_text=duration_label(self.policy.otp_seconds),
            )
        except OSError:
            delivered = False
        with Session(self.engine) as db, db.begin():
            otp = db.get(OTP, user_id, with_for_update=True)
            if not otp or otp.generation != generation:
                raise AuthError(409, "delivery_superseded")
            otp.state = "delivered" if delivered else "prepared"
            self.audit(
                db,
                "otp_delivery",
                user_id,
                user_id,
                "sent" if delivered else "failed",
                details={"provider_message_id": provider_message_id}
                if provider_message_id
                else None,
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
        return {"state": "pending", "email": masked_email(normalized)}

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
