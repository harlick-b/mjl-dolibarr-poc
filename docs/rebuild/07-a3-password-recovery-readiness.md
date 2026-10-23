# A3 — Password recovery readiness

Documentation-only; decision recheck 2026-10-23; implementation baseline `14f75d0` (A2.2 complete).
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
`user_proof`). One current row per User; Decision A recommends preserving an unexpired current
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

Under recommended Decision A below, preparation creates a generation only when
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

**Decision A recommendation (not approved):** preserve the current unexpired,
security-current prepared/delivered proof. Permit a fresh generation only after
expiry, consumption or security staleness, and only for a still-eligible account
within request limits. No resend: hash-only storage cannot reconstruct a verifier.
Concurrent preparations serialize; only one creates/sends a generation. Late
results for an older generation cannot modify its replacement. This supersedes
the earlier *recommendation* to replace on preparation, not an approved decision.

After a successful reset commit, recommend one best-effort security notification
through the existing mail boundary. Send no password, token or authentication link.
Only the winning reset schedules it; never notify before commit. Failure or task
loss cannot roll back the password change, restore sessions or unconsume the proof;
reset success means credential change, not notification delivery. Audit the attempt
and known outcome truthfully; missing outcome is unknown, never inferred sent.
No durable queue, retry platform or delivery guarantee. Sponsor/RSSI must approve
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
| R06 | If Decision A is approved: repeated unexpired prepared/delivered requests preserve generation/digest/expiry, send no mail and return neutral 202; concurrent preparation sends once. Expired/consumed/security-stale proofs permit a fresh generation only for eligible, unthrottled accounts. Late prior-generation success/failure cannot change its replacement or restore authority |
| R07 | All A1 password-policy and confirmation failures reject without consumption/hash/version change; new verifier passes Argon2 verification, old password fails; no plaintext/hash in API/audit/logs |
| R08 | Multiple verified cookies and pending OTP verify/resend contexts fail after reset; returning to an old password cannot revive prior proofs; existing limits/lockout counters and 24-hour ceilings remain intact |
| R09 | Deterministic independent PostgreSQL connections, barriers and bounded waits cover both orders of reset/login, reset/OTP verification/resend, reset/deactivation and reset/role change. No deadlock/timeouts/500 or stale authority; inactive state cannot be undone |
| R10 | Preparation/mutation/audit/commit fault injection rolls back the corresponding proof/password/version changes; no precommit mail, success audit or session. Identity/history and append-only constraints remain intact |
| R11 | If Decision A is approved: task loss before preparation commit permits an immediate limited retry; after preparation committed, failed/lost initial mail leaves an unusable proof until original expiry; repeats never extend that wait, then a limited request can retry. Delivery-result persistence failure cannot enable proof. Exactly the winning committed reset schedules a best-effort notification; injected send/audit failure or task loss never reverses reset or claims receipt. 202 never asserts mail receipt |
| R12 | Token removed from address/history before inspection; no secret in redirects, referrer, logs, Query keys, browser persistence or cached responses. Proof comes only from its link, never caller-supplied identity/role |
| R13 | Browser request→neutral confirmation→email link→password criteria/errors→success→fresh login/OTP; invalid/expired states, accessible focus and 375px reflow use existing auth design |
| R14 | Offline submission sends nothing; reconnect never replays. Logout/account switch/navigation invalidate sensitive state; late inspection/completion responses cannot restore another identity's Query state; APIs/recovery responses are not service-worker cached |
| R15 | Generated OpenAPI has exactly the three recovery POST responsibilities, bounded DTOs/status/security contracts. Upgrade existing synthetic auth data preserves invitation/audit/session evidence. A2.2 permits only explicitly reviewed recovery schema and still denies unknown tables/revisions/unverified provenance |
| R16 | Focused existing A1/A2.1/A2.2 pytest and relevant auth/access unit/browser regressions pass with build/lint/format/typing checks and disposable teardown; bootstrap, invitation replay/late mail, exclusive roles, atomic lifecycle and policy gates unchanged |

## 8. Focused security decisions and remaining gates

Repository recheck: DEC-100, readiness 04 LA1/LA2 and the current roadmap contain
no newer Sponsor/RSSI approval. The latest request asks to evaluate options, not
to approve them. Only this readiness document changes; authoritative decision
records stay unchanged until an authorized owner actually approves a decision.

**APPROVED** invariants remain: single-use expiring proof, identity/role preservation,
no reset-created authenticated session, obsolete-session/pending-OTP revocation,
and fresh password-plus-email-OTP login. The following recommendations are all
**RECOMMENDED_PENDING_APPROVAL** and **BLOCKING** before synthetic authorization.

| Decision | Recommendation | Required owner | Approval status | Blocks A3? |
| --- | --- | --- | --- | --- |
| A — replacement and notification | Preserve live proof; neutral no-op repeats; one best-effort post-commit notification | Sponsor/RSSI | RECOMMENDED_PENDING_APPROVAL | BLOCKING, including synthetic |
| B — assurance | Link possession authorizes ordinary-account password definition, followed by normal login + OTP | Sponsor/RSSI | RECOMMENDED_PENDING_APPROVAL | BLOCKING, including synthetic |
| C — Admin boundary | Ordinary synthetic accounts only; no technical Admin recovery or bypass | Sponsor/RSSI | RECOMMENDED_PENDING_APPROVAL; privileged recovery proposed DEFERRED | BLOCKING until exclusion approved; privileged policy then does not block ordinary A3 |

### A — what happens to an existing link and how is the user notified?

Constraints: hash-only single-use proof, finite expiry, neutral enumeration-safe
responses, direct IP/email request limits, transactional audit and non-atomic DB/mail.
Three reasonable replacement options:

1. **Preserve until expiry (recommended):** no replacement/resend/extension while
   a current prepared/delivered proof is unexpired. Smallest one-row design; failed
   new delivery cannot destroy an existing valid link because no new mail is sent.
   Lost mail or a failed initial send requires waiting until original expiry.
   An attacker can trigger this wait if initial delivery fails; finite IP/email
   limits bound abuse, and ordinary login is never locked by recovery requests.
2. **Replace on preparation:** simpler latest-request semantics, but a failed new
   send invalidates an older usable link. Explicit owner approval of that loss is
   essential; this review does not select it.
3. **Replace after confirmed delivery-result commit:** preserve the old valid
   proof until a candidate is sent and its result committed. Better retry experience,
   but requires old/candidate persistence and races between old consumption and new
   delivery; exceeds the proposed single-current-proof design. SMTP receipt alone
   cannot atomically switch database authority.

For notification, recommend one post-commit best-effort security notice rather
than no separate notice. It offers incident awareness without infrastructure;
mailbox compromise can conceal it, and it is not another authentication factor.
No-notice is leaner but removes that warning. Guaranteed eventual notification
would need a separately approved durable mechanism and is not selected.

**Exact owner question:** Approve preservation/no-resend until original expiry
(including known mail failure and uncertain task/delivery-result failure), finite
direct-request limits, and one
best-effort post-reset notification whose failure never reverses reset? If not,
select the replacement/notification alternative and approve its failure semantics.
Provide finite lifetime/limit values, or explicitly permit labeled synthetic test
values before affected implementation. No numeric policy is invented here.
**Resulting acceptance:** R02/R03/R06/R10/R11 prove neutral responses, no premature
replacement, bounded wait, conditional late delivery and truthful notification.

### B — is the recovery link sufficient authority to define a password?

The invitation model already uses an email proof for password definition; login
then requires password plus email OTP. That analogy supports a proposal, not a
recovery approval. Recovery replaces an existing credential, so mailbox control
is a material account-takeover risk despite random expiring, single-use tokens,
abuse controls and immediate revocation of old sessions/OTP contexts.

1. **Link-only definition (recommended for this ordinary synthetic slice):** reuse
   existing security primitives and require normal login afterward. Bounded scope;
   possession of a compromised mailbox can still enable takeover.
2. **Additional same-mailbox OTP:** adds a step/short-lived challenge but no
   independent assurance against mailbox compromise; introduces extra state and
   does not justify claiming stronger MFA.
3. **Independent assurance or operator-assisted verification:** potentially stronger
   but needs an approved method, ownership and exception policy. None exists here;
   do not invent a factor or bypass. Defer implementation if this is required.

**Exact owner question:** Is possession of the valid recovery link sufficient for
ordinary synthetic password definition under the stated revocation/fresh-login
invariants, or must an additional approved verification method be specified?
**Resulting acceptance:** R01/R04/R05/R07–R10/R12 prove expiry/replay, safe password
storage, complete revocation and no identity/role/MFA bypass. Any extra method
requires a bounded contract and corresponding oracle before authorization.

### C — can ordinary recovery proceed while Admin recovery is deferred?

Technical Admin is separate from business roles; LA2 and the restricted bootstrap
supply no recovery bypass. Options:

1. **Ordinary synthetic only (recommended):** excluded Admin request returns the
   same neutral response with no proof/mail; inspect/complete reject Admin targets.
   Approving this boundary is sufficient to defer the privileged recovery policy
   without blocking ordinary recovery. Loss of Admin credentials remains unresolved.
2. **Include active Admin under ordinary rules:** increases privileged takeover
   exposure; requires explicit Sponsor/RSSI assurance approval, not legacy behavior.
3. **Hold all A3 until privileged policy exists:** avoids different recovery scopes
   but unnecessarily couples ordinary recovery to later high-assurance decisions.

**Exact owner question:** Approve ordinary synthetic-only A3 and explicitly defer
all technical Admin recovery, with no bootstrap changes or alternative bypass?
**Resulting acceptance:** R02/R04/R16 reject Admin recovery at every boundary and
preserve bootstrap. Once exclusion is approved, the Admin policy is **DEFERRED**;
ordinary A3 remains blocked only by its own unresolved decisions and prerequisites.

All sixteen checks remain. R06/R11 are adjusted to the preservation/notification
recommendation because the prior preparation-replacement oracle would invalidate
working links on failed mail. These are conditional future oracles, not approval
or executed evidence. API count, one-table justification, fixed A2.2 schema guard,
advisory-first ordering, UI and session-proof invalidation remain unchanged.

### Remaining timing gates

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
The original review passed after precision fixes. Decision-closure Engineering
and Security/Specification reviews passed after clarifying task loss before versus
after preparation commit in the failure table and R11. Documentation
verification only; no runtime tests, completed-slice audit reruns or production
checks are appropriate here.
