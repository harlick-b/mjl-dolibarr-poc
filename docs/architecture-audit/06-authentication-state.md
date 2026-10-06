# Authentication and session state

## Password plus OTP

```text
anonymous
  -> valid email/password + enabled/ready OTP
  -> PENDING challenge (10 minutes, browser/session/credential bound)
  -> VERIFIED -> regenerated authenticated Dolibarr session
  -> CANCELLED | DELIVERY_FAILED | LOCKED
```

- Five incorrect codes lock the challenge for ten minutes. Resend is limited to three with a sixty-second cooldown.
- Codes, session bindings, IP/email throttling identifiers and credential fingerprints are hashes/HMACs; plaintext OTP is delivered and not stored.
- Verified sessions are rechecked against password/status/admin/entity/effective-role fingerprint. Role or credential changes invalidate them.
- With the gate enabled, the login hook rejects native password-session creation and clears authenticated sessions lacking valid OTP evidence.
- Back-to-page redirects pass the safe internal-path validator.

## Invitation

```text
PENDING_SEND -> SENT -> ACCEPTED
PENDING_SEND/SENT -> REVOKED
PENDING_SEND -> SEND_FAILED
```

Admin creates an inactive non-admin User plus one active business role and random selector/verifier under identity locks. Only the verifier hash is stored; expiry is seven days. Redemption row-locks the selector, performs constant-time verification, applies the shared password rules, activates the account, consumes the invitation and audits in one transaction.

## Password reset

```text
PENDING_SEND -> SENT -> CONSUMED
PENDING_SEND/SENT -> REVOKED
PENDING_SEND -> SEND_FAILED
```

The public request response is neutral. Email/IP hashes enforce five requests per fifteen minutes. The one-hour selector/verifier is single use and transaction-bound to password mutation and audit. Verifiers remain in URL fragments and `auth_fragment.js` transfers them into POST, so redemption is not fully functional without JavaScript.

## Security headers and UI

Public auth pages emit no-store/referrer restrictions; errors use assertive live regions where implemented. CSRF applies to POST. Password policy is at least eight characters with uppercase, lowercase, digit and symbol, enforced in PHP and mirrored in JavaScript for feedback.

## Findings

- **RESOLVED AUTH-F01:** reset insert/update and consume now use one exact entity rule: the native entity-0 Admin may own an active-entity reset; a non-admin target must match the reset entity. The focused disposable auth suite passed 12/12, including request, consumption and subsequent Admin password-plus-OTP login.
- **RESOLVED AUTH-F03:** `mjl_auth_set_password()` forces Dolibarr's encrypted-only storage switch only around the native password call, then restores the prior runtime value. Both MJL password-write callers use this adapter. The disposable auth suite passed 12/12 and proves `llx_user.pass IS NULL` after retained-Admin reset and invitation acceptance.
- **MEDIUM AUTH-F04:** a valid reset selector alone reveals the full target email before verifier proof. The selector is high entropy and pages set no-referrer/no-store, but masking remains an unapproved privacy correction.
- **LOW AUTH-F02:** resend commits the replacement OTP before email delivery. A delivery failure invalidates the previous code and can strand the user until cooldown/retry; security remains fail closed.
- External SMTP delivery, operator email configuration and activation readiness remain unverified.
