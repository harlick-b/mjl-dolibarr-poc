import hashlib
import secrets
from collections.abc import Callable
from contextvars import ContextVar
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy import Engine, func, select, text
from sqlalchemy.orm import Session

from app.auth.mail import TestMailbox
from app.auth.models import OTP, Abuse, Audit, Context, Invitation, User
from app.auth.policy import Policy, synthetic_email

request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


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
    ) -> None:
        db.add(
            Audit(
                occurred_at=self.now(db),
                action=action,
                actor=actor,
                target=target,
                outcome=outcome,
                request_id=request_id.get() or str(uuid4()),
            )
        )
        db.flush()

    def bootstrap(self, email: str, operator: str, reissue: bool = False) -> None:
        email = synthetic_email(email)
        if not operator or len(operator) > 80:
            raise AuthError(403, "operator_required")
        request_id.set(str(uuid4()))
        secret = secrets.token_urlsafe(32)
        generation = str(uuid4())
        with Session(self.engine) as db, db.begin():
            db.execute(text("SELECT pg_advisory_xact_lock(1843201)"))
            user = db.scalar(select(User).with_for_update())
            exists = db.scalar(select(Audit.id).where(Audit.action == "bootstrap"))
            if not reissue:
                if user or exists:
                    raise AuthError(409, "bootstrap_closed")
                user = User(email=email)
                db.add(user)
                db.flush()
                invitation: Invitation | None = Invitation(user_id=user.id)
                db.add(invitation)
                action = "bootstrap"
            else:
                if not user or user.email != email or user.state != "pending":
                    raise AuthError(409, "bootstrap_closed")
                invitation = db.scalar(
                    select(Invitation)
                    .where(Invitation.user_id == user.id)
                    .with_for_update()
                )
                if not invitation or invitation.state in {"consumed", "revoked"}:
                    raise AuthError(409, "bootstrap_closed")
                action = "invitation_reissue"
            assert invitation
            invitation.verifier = digest(secret)
            invitation.generation = generation
            invitation.expires_at = self.now(db) + timedelta(
                seconds=self.policy.invitation_seconds
            )
            invitation.state = "prepared"
            self.audit(db, action, operator, user.id)
            selector = invitation.id
        link = f"{self.policy.origin}/invitation#selector={selector}&verifier={secret}"
        delivered = True
        try:
            self.mail.send(email, "invitation", link)
        except OSError:
            delivered = False
        with Session(self.engine) as db, db.begin():
            invitation = db.get(Invitation, selector, with_for_update=True)
            if not invitation or invitation.generation != generation:
                raise AuthError(409, "delivery_superseded")
            invitation.state = "delivered" if delivered else "prepared"
            self.audit(
                db,
                "invitation_delivery",
                operator,
                invitation.user_id,
                "sent" if delivered else "failed",
            )
        if not delivered:
            raise AuthError(503, "invitation_delivery_failed")

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
            invitation = db.get(Invitation, selector, with_for_update=True)
            user = db.get(User, invitation.user_id) if invitation else None
            if (
                not invitation
                or not user
                or user.state != "pending"
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
            if user and not error:
                email = user.email
            self.audit(
                db,
                "invitation_accept" if password is not None else "invitation_inspect",
                "anonymous",
                user.id if user else None,
                error.code if error else "ok",
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
                or user.role != "ADMIN_PLATEFORME"
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
            # Same lock ordering for all login requests: network, then identity.
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
            elif (
                not valid
                or not user
                or user.state != "active"
                or user.role != "ADMIN_PLATEFORME"
            ):
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
