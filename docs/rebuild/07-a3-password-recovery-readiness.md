# A3 — Password recovery readiness

Documentation-only; decision approval 2026-10-23 (DEC-101); implementation baseline `14f75d0` (A2.2 complete).
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

Approved scope: one coherent first journey for **active ordinary synthetic accounts**.
Unknown, pending, inactive and excluded Admin identities receive the same neutral
request response and no recovery mail. Ordinary identity/email/role/state and
historical attribution survive completion unchanged. Inactive reinvitation,
assignment handoff, additional Admin lifecycle, A4/PTA and Phase 4 stay excluded.

The user explicitly approved ordinary synthetic-only scope, deferring all technical
Admin recovery without bootstrap changes or an alternative bypass (DEC-101).
Lost-mailbox/sole-Admin recovery remains LA2 and is outside A3.

Link possession alone authorizes password definition in this scope, as explicitly
approved by the user. Same-mailbox OTP is not an independent recovery factor;
mailbox compromise remains a takeover risk. No extra recovery challenge is added.
Fresh password-plus-email-OTP login remains mandatory after reset.

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
`user_proof`). One current row per User; Decision A requires preserving an unexpired current
proof rather than keeping multiple candidates. Append-only audit preserves prior
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

Under approved Decision A below, preparation creates a generation only when
no unexpired, security-current prepared/delivered proof exists. Repeated requests
are neutral no-ops: no mail, replacement, expiry extension or credential change.
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
| Task/process lost before delivery-completion commit | No delivery guarantee; absent or prepared unusable proof; no automatic retry. If preparation committed, a new limited request is a neutral no-op until original expiry or security staleness. If no proof exists, a limited request may prepare immediately |
| Password/audit/commit fails | Old hash/version and unconsumed proof preserved; no partial reset or success event |

UI wording: “Si ce compte peut être récupéré, vous recevrez un lien.” It must not
say delivery succeeded. Delivery failures remain observable to authorized technical
operators through existing protected evidence, not exposed per email to callers.

**Decision A (approved):** preserve the current unexpired,
security-current prepared/delivered proof. Permit a fresh generation only after
expiry, consumption or security staleness, and only for a still-eligible account
within request limits. No resend: hash-only storage cannot reconstruct a verifier.
Concurrent preparations serialize; only one creates/sends a generation. Late
results for an older generation cannot modify its replacement. This supersedes
the earlier *recommendation* to replace on preparation, not an approved decision.

After a successful reset commit, send one best-effort security notification
through the existing mail boundary. Send no password, token or authentication link.
Only the winning reset schedules it; never notify before commit. Failure or task
loss cannot roll back the password change, restore sessions or unconsume the proof;
reset success means credential change, not notification delivery. Audit the attempt
and known outcome truthfully; missing outcome is unknown, never inferred sent.
No durable queue, retry platform or delivery guarantee. The user approved
both this notification limitation and the finite wait after failed initial mail.

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
| R06 | Under approved Decision A: repeated unexpired prepared/delivered requests preserve generation/digest/expiry, send no mail and return neutral 202; concurrent preparation sends once. Expired/consumed/security-stale proofs permit a fresh generation only for eligible, unthrottled accounts. Late prior-generation success/failure cannot change its replacement or restore authority |
| R07 | All A1 password-policy and confirmation failures reject without consumption/hash/version change; new verifier passes Argon2 verification, old password fails; no plaintext/hash in API/audit/logs |
| R08 | Multiple verified cookies and pending OTP verify/resend contexts fail after reset; returning to an old password cannot revive prior proofs; existing limits/lockout counters and 24-hour ceilings remain intact |
| R09 | Deterministic independent PostgreSQL connections, barriers and bounded waits cover both orders of reset/login, reset/OTP verification/resend, reset/deactivation and reset/role change. No deadlock/timeouts/500 or stale authority; inactive state cannot be undone |
| R10 | Preparation/mutation/audit/commit fault injection rolls back the corresponding proof/password/version changes; no precommit mail, success audit or session. Identity/history and append-only constraints remain intact |
| R11 | Under approved Decision A: task loss before preparation commit permits an immediate limited retry; after preparation committed, failed/lost initial mail leaves an unusable proof until original expiry; repeats never extend that wait, then a limited request can retry. Delivery-result persistence failure cannot enable proof. Exactly the winning committed reset schedules a best-effort notification; injected send/audit failure or task loss never reverses reset or claims receipt. 202 never asserts mail receipt |
| R12 | Token removed from address/history before inspection; no secret in redirects, referrer, logs, Query keys, browser persistence or cached responses. Proof comes only from its link, never caller-supplied identity/role |
| R13 | Browser request→neutral confirmation→email link→password criteria/errors→success→fresh login/OTP; invalid/expired states, accessible focus and 375px reflow use existing auth design |
| R14 | Offline submission sends nothing; reconnect never replays. Logout/account switch/navigation invalidate sensitive state; late inspection/completion responses cannot restore another identity's Query state; APIs/recovery responses are not service-worker cached |
| R15 | Generated OpenAPI has exactly the three recovery POST responsibilities, bounded DTOs/status/security contracts. Upgrade existing synthetic auth data preserves invitation/audit/session evidence. A2.2 permits only explicitly reviewed recovery schema and still denies unknown tables/revisions/unverified provenance |
| R16 | Focused existing A1/A2.1/A2.2 pytest and relevant auth/access unit/browser regressions pass with build/lint/format/typing checks and disposable teardown; bootstrap, invitation replay/late mail, exclusive roles, atomic lifecycle and policy gates unchanged |

## 8. Focused security decisions and remaining gates

The user's explicit three affirmative answers on 2026-10-23 approve A/B/C
(DEC-101), superseding the prior pending recommendations. This is security-policy
and scope approval only, not implementation authorization or real-account approval.

| Decision | Approved behavior | Approval source | Approval status | Blocks A3? |
| --- | --- | --- | --- | --- |
| A — replacement and notification | Preserve unexpired proofs without resending/extending expiry, including the failed-delivery wait; one best-effort post-reset notification | User explicit yes, DEC-101 | APPROVED | No; finite values remain a pre-implementation gate |
| B — assurance | Link possession authorizes password definition; require fresh password-plus-email-OTP login afterward | User explicit yes, DEC-101 | APPROVED | No |
| C — Admin boundary | Ordinary synthetic accounts only; defer all technical Admin recovery, without bootstrap changes or bypass | User explicit yes, DEC-101 | APPROVED; Admin recovery DEFERRED | No; privileged policy does not block ordinary A3 |

Decision A uses one current proof row and prevents replacement mail failure from
invalidating a working link. No resend is possible from hash-only storage. A
committed prepared proof whose mail fails remains unusable until its original
finite expiry (or security staleness); repeat requests cannot extend the wait.
No committed proof means another rate-limited request can prepare immediately.
The user approved this availability tradeoff and best-effort notification: failed
or lost notification never rolls back reset or implies delivery. No queue is added.

Decision B preserves the existing identity/role and invalidates obsolete sessions
and pending OTP; reset creates no authenticated session. Link possession does not
protect against mailbox compromise, and fresh email OTP is not independent of
that mailbox. No new verification method is authorized.

Decision C excludes Admin at request, inspection and completion boundaries. Loss
of Admin credentials remains unresolved under LA2; it is not permission to change
bootstrap or create an operator bypass. Account reactivation, role/email/identity
changes, public registration and business features remain outside A3.

All sixteen acceptance checks remain planned and unexecuted. R06/R11 now express
the approved preservation/notification behavior. The three POST responsibilities,
one-table justification, fixed A2.2 schema compatibility requirement, advisory-first
ordering, UI and session-proof invalidation remain unchanged. Earlier alternative
comparisons and independent review evidence remain in Git history (`c10bfb9`).

### Remaining timing gates

| Item | Timing | Owner and required resolution |
| --- | --- | --- |
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

**A3_READY_FOR_AUTHORIZATION** for ordinary synthetic-account recovery only.
DEC-101 closes all three pre-authorization decisions. Before affected implementation,
obtain finite recovery lifetime/direct-request limits or explicit permission for
labeled synthetic fixtures. Before exposure, verify the exact A2.2 guard update,
transaction/delivery ordering and all sixteen checks. PC1/PC2 remain pending and
real-account enablement remains prohibited. Separate implementation authorization
is required; stop before implementation.

Independent Engineering and Security/Specification source audits identified the
A2.2 schema compatibility gate, neutral throttle adaptation and policy boundaries.
The original review passed after precision fixes. Decision-closure Engineering
and Security/Specification reviews passed after clarifying task loss before versus
after preparation commit in the failure table and R11. Documentation
verification only; no runtime tests, completed-slice audit reruns or production
checks are appropriate here.
