# A3 — Password recovery readiness

Documentation-only, 2026-10-22; implementation baseline `14f75d0` (A2.2 complete).
No runtime, schema, policy configuration or real-account change is authorized.

## 1. Confirmed requirements and proposed boundary

[Readiness 04](04-authentication-access-readiness.md) H07/H08/H12, its A3 scope,
API table and LA1/LA2, [authority disposition SEC-AUTH-003](01-authority-and-business-baseline.md)
and [security baseline](03-security-compliance-baseline.md) retain:

- Neutral recovery request; expiring, single-use email proof; non-consuming proof
  inspection; new password/confirmation; no arbitrary identity or role change.
- Hash-only proof storage, replay rejection, transactional audit and credential
  change, all-obsolete-session/pending-OTP invalidation.
- **No authenticated session from reset.** Subsequent password + email OTP login
  remains mandatory. Reset must never activate an inactive/pending account.

Propose one coherent first journey for **active ordinary synthetic accounts**.
Unknown, pending, inactive and excluded Admin identities receive the same neutral
request response and no recovery mail. Ordinary identity/email/role/state and
historical attribution survive completion unchanged. Inactive reinvitation,
assignment handoff, additional Admin lifecycle, A4/PTA and Phase 4 stay excluded.

This scope is proposed, not approved by the readiness request. Technical Admin
mailbox-possession reset must be decided explicitly; the legacy native entity-0
exception is not target authority. Lost mailbox/sole-Admin recovery remains LA2,
not a reason to reopen bootstrap or introduce an operator reset bypass.

No current cited requirement mandates a second challenge before changing the
password. Link-possession-only completion is the proposed minimum, **pending
Sponsor/RSSI confirmation**. Same-mailbox reset OTP is not an independent factor;
the mandatory subsequent login OTP does not establish independent recovery
assurance. Do not add an extra verification mechanism or call one approved.

## 2. Existing capabilities to reuse

`auth/policy.py`: synthetic-only isolation, normalization and `password_valid`;
`AuthService`: Argon2 hashing, cryptographic random secrets, `digest`, `keyed`,
database time, `limit`, `guard`, `user_proof/context`, `audit`, and the invitation
prepare/commit/send/conditional-delivery pattern. `TestMailbox` remains private
synthetic capture, not SMTP or evidence of actual production receipt.

Keep existing User/Context/OTP/Abuse/Audit models and anonymous cookie/CSRF,
Origin/Host, no-store and no-referrer protections. Reuse actual A1 password criteria
and configured synthetic minimum; server validation remains authoritative. Do not
promote historical eight-character/one-hour values to approved production policy.

A1/A2.1/A2.2 execution evidence remains in the
[roadmap](../mjl-implementation-roadmap-v2.md); completed audits were not repeated.

## 3. Minimal FastAPI/PostgreSQL proposal

Three existing planned POST responsibilities, all under `/api/v1/auth`:

| Endpoint | Input → result |
| --- | --- |
| `/password-reset/requests` | Anonymous context + CSRF; bounded normalized synthetic email → identical 202 `request_received` for known/unknown/ineligible/throttled/mail outcomes; never `email_sent` |
| `/password-reset/inspect` | CSRF + selector/verifier → readonly email only for delivered, unexpired, current eligible proof; otherwise generic 400. Does not consume or extend expiry |
| `/password-reset/complete` | CSRF + proof/password/confirmation → 200 `password_reset`, no verified cookie. Invalid/expired/stale proof 400; valid consumed replay/concurrent loser 409; policy failure 422. No caller-supplied User/role/state |

Malformed input and CSRF/Origin/Host failures retain uniform 422/403; inspection
and completion retain endpoint abuse controls. The request route needs a narrow
adaptation of `main.endpoint_limit`'s current 429 handling to neutral 202 on
throttling. Increment keyed IP/email request counters independently of account
existence before scheduling, not by counting audit strings. Limits/windows are
required configuration, not unlimited defaults or values invented in this review.

**One new dedicated recovery-proof table and one Alembic migration are justified.**
Proposed fields: random selector PK, unique User FK, verifier digest, generation,
expiry, prepared/delivered/consumed state and bound User security proof (reuse
`user_proof`). One current row per User; append-only audit preserves prior
preparations/consumptions. No new session store, token framework or outbox table.
Invitation is activation-specific with one row per User; reusing it would overwrite
invitation state/history semantics. OTP is a Context-bound MFA challenge with its
own abuse counters. Neither safely represents recovery without broader changes.

A recovery migration will intentionally trip A2.2's exact `0003_a21`/seven-table
guard. **An eventual A3 authorization must include a reviewed, fixed auth-only
compatibility update** for exactly the recovery relation and migration head,
while preserving database-provenance binding and denial of every unknown schema.
Do not dynamically trust all models, wildcard revisions or treat this as PTA
eligibility. Without that explicit compatibility change, A2.2 remains disabled
on the migrated database; never silently weaken the guard to restore it.

## 4. Sessions, OTP and transaction order

Proposed request handler: existing Context/CSRF guard in a short transaction;
commit before the separate uniform Abuse-counter transaction/response. Background
work (see §5) never carries those locks or a live Session across the response.
Inspect/complete similarly finish the existing route guard before entering their
service transaction, as invitation routes already do.

Recovery preparation/inspection/completion/delivery completion acquire existing
advisory lock `1843201` **first**, then target User → Recovery. Revalidate active
state, permitted role, current generation/security proof, expiry and delivery
state under those locks. For completion, first authenticate selector/verifier;
an authentic consumed proof returns 409 before checking the now-obsolete bound
User security proof. Other invalid/expired/security-stale proofs return 400.
Request work never locks out or inactivates an account merely
because someone knows its email. On completion, hash the validated password,
increment User.version, consume the proof and append actual old/new credential
version facts in one commit. Never log the password or hashes.

No target Context/OTP sweep: changed password/version invalidates their existing
HMAC proofs. Existing login remains Advisory → Abuse → Context → User(s) → OTP;
OTP/session/logout remain Context → same User → OTP where applicable. Recovery
must not take Context/OTP locks after User. Existing late OTP delivery may update
its old row but cannot restore a valid context.

Both transaction orders must be safe: authentication committed before reset yields
a context unusable after reset; reset-first rejects old password/pending proof.
Deactivation-first rejects reset without password change; reset-first may finish,
but subsequent deactivation wins and forbids login. Role change also invalidates
outstanding recovery proof. No version reset, identity recreation or counter reset.
All-obsolete-context invalidation is already mandatory; PC2 session cardinality
and foreground-activity classification remain separate pending decisions.

## 5. Email, repeated requests and audit failure

**Proposed timing-safe orchestration:** use existing FastAPI response-attached
`BackgroundTasks` for account lookup and preparation/send/completion, after sending
the complete neutral 202. Schedule the same task shape for admitted identifiers;
unknown/ineligible targets produce no proof/mail. This extends A1's synchronous
orchestration only to prevent mailbox latency from identifying account existence.
No Redis, Celery, durable job queue, service or dependency is needed. Background
work opens its own Sessions and receives normalized email/request ID only, never
a Request, live Session or browser credential. Catch failures with sanitized,
correlated evidence; no secrets/raw exception payloads in logs.

Preparation commits an unusable random generation and required audit first.
Send outside database locks. Completion locks User/Recovery again and marks
**delivered only** for matching prepared generation, still-active eligible target,
current security proof and unexpired deadline; append actual delivery outcome.
Stale success/failure must not update the replacement row or restore eligibility.

| Failure | Required result |
| --- | --- |
| Guard/counter database unavailable before response | Uniform generic 503, no delivery claim; no account lookup-specific status leak |
| Background preparation/audit/commit fails | Roll back proof changes; do not send; public 202 means request received only |
| Mail fails | Proof remains unusable; record failure if database available; no `sent` success event |
| Mail sent, delivery-result transaction/audit fails | Earlier prepared proof remains unusable; receipt cannot be rolled back; never falsely record delivered |
| Task/process lost before delivery-completion commit | No delivery guarantee; absent or prepared unusable proof; no automatic retry. User may submit another deliberate limited request |
| Password/audit/commit fails | Old hash/version and unconsumed proof preserved; no partial reset or success event |

UI wording: “Si ce compte peut être récupéré, vous recevrez un lien.” It must not
say delivery succeeded. Delivery failures remain observable to authorized technical
operators through existing protected evidence, not exposed per email to callers.

**LA1 replacement proposal, not a decision:** each admitted eligible preparation
commit supersedes previous proof; throttled requests do not replace it. Concurrent
requests serialize and only the latest committed generation may be used. Mail
failure could therefore invalidate an older delivered link; Sponsor/RSSI must
approve this tradeoff or specify another bounded rule. Reset-completion notification
requirements and failure handling also remain unapproved; do not silently add or
omit such a notification as accepted policy.

## 6. React and online-only PWA

Supplied `docs/inspiration/auth/forgot-password.png`, `reset-password.png` and
current auth prototype support the existing navy shell/MJL mark, centered card,
password criteria and reveal controls. `DESIGN.md`/v3 tokens govern presentation;
prototype demo/scenario controls are excluded. Reuse `AuthView` form/password/error
patterns and existing Query mutations; no separate transient-state pages.

Propose two Router routes: `/forgot-password` (request/loading/neutral confirmation)
and `/reset-password` (inspect/new password/invalid-expired/success). Success links
to ordinary login. Capture proof from URL fragment and remove it with replaceState
**before network/navigation**, as invitation loading does. Keep it only in ephemeral
route/form memory; never Query keys, search parameters, storage or persisted caches.
Password/token are POST bodies, excluded from telemetry/logging/referrers. Clear
proof/password on success, departure, offline invalidation and account switch;
reload after fragment removal may require reopening the email link.

Query owns session/inspection responses; Router owns navigation; local state owns
forms. Reuse cancellation and current-request guards, `retry:false`, online checks
and mutation-cache cleanup; clear stale session/access queries after completion.
No extra effects where loader/event handlers suffice. No service-worker recovery
response caching, offline mutation queue or retry/replay. Test loading, errors,
keyboard focus, 375px layout and late-response isolation.

## 7. Acceptance checks for future authorization

Sixteen focused oracles; these were **not executed** in this documentation review.
Use synthetic identities, disposable PostgreSQL and private mail captures only.

| ID | Concrete oracle |
| --- | --- |
| R01 | Active permitted ordinary identity requests/inspects/completes; User id/email/role/state unchanged, password replaced once, proof consumed; no verified session/cookie; subsequent password+OTP yields the same identity |
| R02 | Known/unknown/pending/inactive/excluded Admin and throttled requests return identical 202 body/headers with no eligibility/delivery marker; invalid syntax/security guards remain uniform. Unknown/ineligible creates no proof/mail; counters count direct requests, including unknown identities |
| R03 | Real ASGI HTTP connection receives complete neutral 202 while mail is blocked on a barrier; release mail afterward. In-process TestClient/ASGITransport timing is insufficient because it may await background completion. No account-dependent transport delay before response |
| R04 | Wrong selector/verifier, expired/undelivered/security-stale proof returns generic invalid-link denial; inspect neither consumes nor extends expiry. Inactive/pending/forbidden target cannot reset or activate |
| R05 | Concurrent complete attempts using one delivered proof produce exactly one hash/version change, one consumed proof/success audit; other 409; later replay cannot change password again |
| R06 | Concurrent/repeated requests obey the explicitly approved LA1 replacement rule; test latest generation, throttled no-replacement, delayed old-generation success AND failure and expired completion; none restores superseded authority |
| R07 | All A1 password-policy and confirmation failures reject without consumption/hash/version change; new verifier passes Argon2 verification, old password fails; no plaintext/hash in API/audit/logs |
| R08 | Multiple verified cookies and pending OTP verify/resend contexts fail after reset; returning to an old password cannot revive prior proofs; existing limits/lockout counters and 24-hour ceilings remain intact |
| R09 | Deterministic independent PostgreSQL connections, barriers and bounded waits cover both orders of reset/login, reset/OTP verification/resend, reset/deactivation and reset/role change. No deadlock/timeouts/500 or stale authority; inactive state cannot be undone |
| R10 | Preparation/mutation/audit/commit fault injection rolls back the corresponding proof/password/version changes; no precommit mail, success audit or session. Identity/history and append-only constraints remain intact |
| R11 | Mail failure, completion persistence failure and background work lost before delivery-completion commit yield absent/unusable proofs and truthful internal delivery facts; 202 never asserts mail receipt. Applicable notification failures follow the approved LA1 contract |
| R12 | Token removed from address/history before inspection; no secret in redirects, referrer, logs, Query keys, browser persistence or cached responses. Proof comes only from its link, never caller-supplied identity/role |
| R13 | Browser request→neutral confirmation→email link→password criteria/errors→success→fresh login/OTP; invalid/expired states, accessible focus and 375px reflow use existing auth design |
| R14 | Offline submission sends nothing; reconnect never replays. Logout/account switch/navigation invalidate sensitive state; late inspection/completion responses cannot restore another identity's Query state; APIs/recovery responses are not service-worker cached |
| R15 | Generated OpenAPI has exactly the three recovery POST responsibilities, bounded DTOs/status/security contracts. Upgrade existing synthetic auth data preserves invitation/audit/session evidence. A2.2 permits only explicitly reviewed recovery schema and still denies unknown tables/revisions/unverified provenance |
| R16 | Focused existing A1/A2.1/A2.2 pytest and relevant auth/access unit/browser regressions pass with build/lint/format/typing checks and disposable teardown; bootstrap, invitation replay/late mail, exclusive roles, atomic lifecycle and policy gates unchanged |

## 8. Missing decisions, owners and timing

| Item | Timing | Owner and required resolution |
| --- | --- | --- |
| LA1 proof replacement and notification | BEFORE_AUTHORIZATION | Sponsor/RSSI approve the bounded repeated-request rule and whether/when reset notifications are required, including notification failure semantics |
| Recovery assurance and Admin boundary | BEFORE_AUTHORIZATION | Sponsor/RSSI approve link-possession-only ordinary recovery or specify required added verification; confirm ordinary-only first scope versus expressly authorized active Admin mailbox recovery. Lost-mailbox/sole-Admin escalation stays separate LA2 |
| LA1 lifetime/direct throttle values | BEFORE_AFFECTED_IMPLEMENTATION | Sponsor/RSSI provide approved values or explicitly permit labeled synthetic-only fixtures for A3. Required finite configuration; historical one-hour/reset-count guesses are not approval. Production values remain a real-account gate |
| A3 storage/A2.2 compatibility and timing-safe delivery | BEFORE_AFFECTED_IMPLEMENTATION | Engineering; include exact recovery migration/guard compatibility in the implementation contract, verify R03/R09–R11/R15 before exposure. No broad schema bypass |
| PC1/PC2 | BEFORE_REAL_ACCOUNT_ENABLEMENT | Sponsor/RSSI; still pending password/normalization/abuse/session cardinality/activity policy. Existing A1 synthetic fixtures can be reused, but do not resolve LA1. They do not by themselves block synthetic development or weaken reset revocation |
| External E1/E3 | BEFORE_REAL_ACCOUNT_ENABLEMENT | Ministry legal/RSSI/DSI/mail operator: applicability/privacy/key/mail assurance; private capture proves no real receipt or compliance |
| E2/E4 environments, E5/E6 deliverables | BEFORE_AFFECTED_IMPLEMENTATION | Existing baseline owners retain sensitive-environment and contractual gates; no cloud/provider work required for this local proposal |
| Deployment/release evidence PG1/PG2 | PRODUCTION_ONLY | DSI/RSSI/host/client delivery owners; actual TLS, operations and release evidence remain outside A3 |
| Supplied visual references | NON_BLOCKING | Engineering/design: auth inspiration exists locally; preserve access for the implementer |

This review applies the existing baseline mapping, not a new legal audit:
MJL-SEC-02–07, 09–11, 13–14 cover API, identity/MFA/session, input, audit, secrets,
privacy, PWA and secure development. Baseline 03 maps CLIENT-SEC-01/API-01 to PSSIE
logical access (§§4.3–4.4), logging EXP-09/10 and secure lifecycle ADM controls,
and RSPSL identity/MFA controls. Operational compliance requires separate evidence;
no compliance or production-readiness claim follows from this document.

## 9. Verdict and independent reviews

**A3_NOT_READY**. LA1 behavioral policy and recovery-assurance/Admin scope remain
unapproved. The ordinary-only journey above is technically bounded but is not a
substitute for those decisions. PC1/PC2 and external mail/cloud evidence are not
misclassified as local architecture blockers. Stop before implementation.

Independent Engineering and Security/Specification source audits identified the
A2.2 schema compatibility gate, neutral throttle adaptation and policy boundaries.
Final Engineering and Security/Specification reviews passed after precision fixes
to row-lock wording, consumed-proof validation order and task-loss timing. Documentation verification only; no runtime tests,
completed-slice audit reruns or production checks are appropriate here.
