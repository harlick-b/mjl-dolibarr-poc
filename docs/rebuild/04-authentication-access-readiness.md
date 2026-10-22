# Authentication & Access readiness

2026-10-22 — original readiness review (DEC-093). Foundation `48c2bea` verified at HEAD;
worktree initially clean. No runtime tests, database access or implementation.
**AUTH_ACCESS_READY_FOR_AUTHORIZATION** applies only to A1 below, with the
explicit pre-cutover gates in §10. It does not authorize implementation,
real-account use, application acceptance or compliance. Engineering/security
review results are recorded in §11. DEC-094 subsequently authorized A1; its implementation and verification evidence is maintained in §12.

## 1. Authority and inspected evidence

Latest user request governs. Read root `AGENTS.md` (no nested instructions found
under docs), [authority](../mjl-authoritative-decisions.md), decision register,
roadmap, rebuild [01](01-authority-and-business-baseline.md),
[02](02-target-architecture-and-engineering-standard.md) and
[03](03-security-compliance-baseline.md). Auth/access semantics come from
[functional specification §§4–5](../mjl-functional-specification-v2.md),
[permission matrix](../mjl-permission-matrix-v2.md), DEC-005/009/011/016/019,
DEC-078/081/086 and the current PTA overlay. State/data documents supply no
separate approved numeric authentication policy. No competing readiness doc exists.

Historical evidence: [REST auth contract](../mjl-rest-api-contract.md#authentication-and-session-contract),
`mjl-rest-api.openapi.yaml` (PasswordCreationRequest), preservation classifications
SEC-AUTH-001–006/SEC-AUTHZ-001–004 in 01; targeted inspection of
`custom/mjlfinancement/class/mjlauthcommand.class.php`, `mjlaccesscommand.class.php`,
`lib/mjl_auth.lib.php`, `lib/mjl_api_access.lib.php`; historical
`tests/e2e/{authentication,auth-concurrency,api-auth-partners,api-access}.spec.js`
and `tests/contracts/auth_transaction_test.php`. These describe behavior, not
new-stack acceptance. DEC-079 expressly does not ratify every technical choice.

Foundation inspection confirms only public health routes, request sessions that
close without committing, one QueryClient and a static-only worker. Reuse these
seams; no new infrastructure or foundation rebuild. Research links below were
checked against official technical guidance; no new legal interpretation is made.

## 2. Confirmed rules and historical disposition

**APPROVED REQUIREMENT:** Admin invitation → password definition → email/password
→ six-digit email OTP → verified session. No public registration, remembered
devices, alternative MFA, LDAP/SSO, bearer JWT requirement or refresh tokens.
Exactly one effective internal role, using canonical labels:

| Code | French label |
| --- | --- |
| AGENT_SAISIE | Agent de saisie |
| AGENT_VERIFICATEUR | Agent superviseur et prévalidateur |
| VALIDATEUR_DEFINITIF | Validateur définitif |
| ADMIN_PLATEFORME | Admin |

Admin is technical/audit-only and cannot combine with a business identity.
The server derives actor, role and MJL scope; clients cannot grant them. Session
expiry is **86,400 seconds inactivity OR 86,400 seconds absolute**, whichever
first (DEC-081). Password and OTP are required again. Polling/static/session
inspection do not renew activity. Equal Agent visibility supersedes historical
assignment-based access. Assignments coordinate work. Resource/state/contributor
checks and no-self-validation remain for later business commands, including after
role changes. Future Partner identities are exclusive, read-only and bound to one
Partner; neither their role identifier nor their portal is invented here.

These **16 historical contracts** are classified; RETAIN means semantics, not PHP:

| ID | Contract / evidence | Disposition |
| --- | --- | --- |
| H01 | Invitation-only, Admin issuer; B18, SEC-AUTH-001 | RETAIN; bootstrap is the restricted first-identity exception |
| H02 | Exclusive codes/labels and technical Admin; functional §4 | RETAIN; replace native-admin inference |
| H03 | Password criteria: ≥8 characters, uppercase, lowercase, digit, symbol, matching confirmation; OpenAPI PasswordCreationRequest and auth lib133–140 | PROPOSED carry-forward; no separately approved numeric policy found; PC1 |
| H04 | Six-digit OTP before protected session; latest request §12, B18 | RETAIN; no disabled-OTP bypass |
| H05 | OTP 600s, five wrong well-formed attempts then 600s account lock, resend 60s/max 3; REST233–237 | PROPOSED historical values, not independently ratified; PC1. Counters survive relogin; malformed input still subject to endpoint abuse control |
| H06 | Invitation 7 days/reset 1 hour; REST250–255 | PROPOSED historical values; invitation PC1, reset LA1 |
| H07 | Hash-only single-use link proofs, inspect non-consuming; REST250–255 | RETAIN; reject expiry/revocation/replay, fixed target identity |
| H08 | Neutral reset202 and subsequent password+OTP, no automatic login; REST203/252 | RETAIN in later recovery slice |
| H09 | Native password throttling, unknown deployed limits; REST254–255 | REPLACE mechanism; explicit rebuild policy required PC1 |
| H10 | Reset limiter counts ≥5 matching audit events/900s by email or IP fingerprint; auth lib204–213 | REPLACE later; not demonstrably five requests/15min; LA1 |
| H11 | 24h idle/absolute, fixation/logout/invalidation; DEC-081/REST238–249 | RETAIN; opaque PostgreSQL session replaces native session |
| H12 | Deactivation/role/credential changes reject stale access; DEC-086 | RETAIN; no permission cache until expiry |
| H13 | Native Admin self/last-Admin safeguards and prohibition of native-Admin mutation; access command40–125 | NOT_APPLICABLE as implementation; broader Admin lifecycle LA2 |
| H14 | Assignment guard before Agent role change; functional §5 | RECONCILE later coordination handoff with PTA authority; do not revive assignment-based access; LA3 |
| H15 | Delivery can fail after inactive invitation committed; REST257–267 | RETAIN truthful outcome; no raw link, false rollback or automatic retry |
| H16 | Native hashes/entity0, MariaDB named locks, session hooks, disabled-OTP configuration | SUPERSEDED; preserve replay/atomicity objectives with new-stack mechanisms |

The five password criteria shown in supplied images are visual/historical evidence,
not new policy approval. Password code and prototype also differ on Unicode number
categories (`N` versus `Nd`); PC1 must settle one server/client definition.

## 3. Smallest first slice and scope boundary

**PROPOSED MECHANISM — A1: first Admin invitation-to-session journey.** A restricted
operator creates one pending technical identity and sends its invitation. That
person defines a password, logs in with email/password, receives/verifies OTP,
sees only their server-confirmed identity and logout control in the existing
neutral shell, then logs out. This is a real end-to-end journey, not an IAM scaffold.
All development tests use disposable identities and test mail only.

The candidate full Slice A is too broad: ordinary invitation management adds
listing/reissue/revocation/role and administrative UX concerns. Keep these out of
A1. Do not expose inactive recovery links, fake dashboards or future controls.
A1 has no public account creation, normal Admin-grant endpoint or business action.
The public acceptance route changes credentials/state of an already provisioned
pending identity; it cannot create identities, select roles or elevate privileges.

| Subsequent slice | Coherent behavior and gate |
| --- | --- |
| A2 — Admin provisioning/access | Minimal Admin invitation form/list, invite internal business roles, inspect/reissue/revoke invitations, account list, deactivation and exclusive business-role change. Reactivation requires Admin re-invitation and password setup, then fresh password+OTP login (historical REST196–199); no standalone activation toggle. Include immediate session/challenge revocation and audited concurrency checks together. Additional Admin lifecycle requires LA2; assignment handoff requires LA3 when business assignments exist. Admin screen inspiration must be checked separately. |
| A3 — Recovery | Neutral password-reset request, proof inspection, new password/confirmation, token consumption and all-session revocation, then password+OTP login. LA1 policy must be settled first. Supplied recovery references exist. |
| A4 — Business authorization | Add resource/state/contributor checks with each actual PTA/Activity use case. No framework-only authorization phase, permission DSL, configurable role bundles or speculative tables. Partner portal remains separately authorized. |

## 4. FastAPI, persistence and transaction ownership

One auth feature module with routes, request/response schemas and direct use-case
functions is sufficient; introduce files only for real consumers. FastAPI
dependencies resolve the current verified principal and reject inactive/expired
sessions. Role checks are explicit at administrative entrypoints; sensitive
commands recheck current authorization inside their transaction. A1 needs no
business authorization engine. [FastAPI dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/).

**Seven persistence responsibilities**, six needed in A1; conceptual concerns,
not a mandate for seven tables or full DDL:

| Responsibility | Durable facts / invariants |
| --- | --- |
| P1 Identity/password | Unique normalized login email; one effective role; pending/active/inactive state; password verifier nullable only before setup; credential/security-context version. No mutable historical actor identity or stored cleartext password. Exact normalization is PC1. |
| P2 Invitation | Fixed precreated target, issuer/operator, verifier digest, expiry, consumed/revoked and delivery state; one live invitation per identity. Never trust browser email/role fields. |
| P3 OTP challenge | User/pre-auth browser binding, keyed verifier, expiry, attempt/resend counters, lockout and generation/delivery state; no reusable plaintext. Relogin cannot erase active abuse counters. |
| P4 Session/context | Opaque identifier digest, context kind (anonymous/pending/verified), user when applicable, CSRF binding, verified-at/last-foreground-at, expiry/revocation and security version. Anonymous context never satisfies authentication. No separate session server. |
| P5 Security audit | Protected append-only events with stable actor/target IDs, action, UTC timestamp, outcome/reason code and correlation ID; bootstrap event also records one-time provisioning. |
| P6 Abuse state | Atomic PostgreSQL counters/windows for credential attempts and endpoint/IP abuse, including unknown accounts; scoped keyed fingerprints, no raw credentials or audit-string counting. Expiry/retention per PC1/E1. |
| P7 Reset proof — A3 only | Target-bound hashed proof, expiry, consumed/revoked/delivery state. Do not create in A1. |

Use reviewed Alembic migrations only when implementation is authorized. Passwords:
propose a maintained Argon2id library with per-password salts and reviewed cost
settings, not custom hashing; exact library/settings chosen during implementation
against current [OWASP guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
Use CSPRNG opaque session/link secrets with stored digests. Protect the low-entropy
OTP with a keyed verifier bound to user/challenge/generation and constant-time
verification; hashing six digits without an application-held secret is insufficient
against offline guessing. Key from environment, never database/source/logs; E3
owns real custody. Keep plaintext only transiently for mail delivery.

One use case owns the outer SQLAlchemy transaction **before** authorization reads
(avoid autobegin/nested-begin errors). Helpers flush, never commit. Lock account
then relevant credential/session rows in a consistent order; current version/state
checks and audit precede commit. Database UTC time owns expiry. No transaction
held over email delivery. [PostgreSQL row locks](https://www.postgresql.org/docs/17/explicit-locking.html).

| Race | Owner / invariant and strategy | Negative oracle / response |
| --- | --- | --- |
| Two bootstrap calls | Operator command: transaction-scoped advisory lock; require empty identity store and no prior bootstrap event; write pending identity+invitation+event atomically | Exactly one identity/event; second invocation refuses creation |
| Two acceptances / repeated reset | Accept/reset command: lock account then proof, verify current/unused, set hash and consume proof together; reset also revokes sessions/challenges | One committed change; other409, invalid/expired proof generic400; no duplicate user |
| Two OTP verifications | Verify command: lock account/challenge, consume once and create fresh verified session+event in same transaction | One session; other409/invalid challenge; no pre-MFA access |
| Resend versus verify/relogin | Auth command: same account/challenge lock; new generation invalidates old code, counters preserved; pending delivery cannot verify | Serialized winner; old generation fails; never two usable generations |
| Deactivation/role change versus privileged write (A2+) | Account command and protected writer lock relevant actor/target accounts in ID order, then dependent rows; recheck role/state/version | If revocation commits first, write fails401/403; if write commits first, audit records that order; no post-revocation stale write |
| Two role changes (A2) | Account command: expected version predicate plus lock and single-role constraint; revoke sessions/challenges atomically | One change, stale competitor409; never two roles |

Bootstrap: operator-only process/container access, explicit identity input, configured
policy/key/mail and correct migration state. No HTTP route, default password,
startup invocation or native-account import. Provisioning closes durably after its
first commit; reruns never create another Admin. On delivery failure leave the
same pending identity inaccessible and report failure. A separately explicit
pending-invitation reissue mode may rotate only that original unaccepted proof,
with audit; it cannot change role/email, reopen accepted bootstrap or create an
identity. Crash after sending but before delivery confirmation leaves proof unusable
until a deliberate reissue. Never print link/OTP/password to ordinary CLI output.

Mail seam: one synchronous `send` responsibility used by invitation, OTP and later
reset, with injected isolated test capture. Prepare non-usable generation in a
transaction, send outside it, then conditionally mark that same generation delivered;
failed/stale completion must never enable it. Transport failure is recorded safely
and fails closed; no queue, broker, background retry or provider platform. Ambiguous
send outcomes require deliberate reissue under limits. Test capture has no public
retrieval route and cannot be selected in a real-account environment. Fake send
success proves only local behavior; real mailbox receipt is E3.

## 5. Sessions, CSRF and frontend state

Propose one browser origin, Vite `/api` proxy locally and separately operated
frontend/backend behind same-origin routing later. CORS is off. Cookie is opaque,
HttpOnly, Secure, host-only (no Domain), SameSite=Lax, Path=/; use a `__Host-` name
under HTTPS and a distinctly named localhost-only HTTP exception. Trust forwarded
scheme/client IP only from configured proxy addresses; derive links from configured
public origin, never untrusted Host headers. [FastAPI proxy guidance](https://fastapi.tiangolo.com/advanced/behind-a-proxy/).

Use a PostgreSQL-backed pre-auth context and synchronizer CSRF token delivered by
session inspection; exact Origin validation and CSRF header on **every unsafe
request**, including login, invitation, OTP and logout. Reject missing/foreign
Origin, missing/mismatched token and non-JSON bodies. CSRF value is not a session
credential; keep it in memory. SameSite alone is insufficient. After MFA destroy
pre-auth context and issue a new session identifier and CSRF token; never promote
the same pre-auth identifier. [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

Enforce both 24h limits on each protected request; session inspection does not
extend idle time. Accepted foreground requests may update activity, background
reads never do; A1 needs no heartbeat. Recheck active user/security version on
reads; deactivation/password/role change revoke all relevant sessions/challenges.
Use the server-returned expiry deadline to hide protected content locally and
require fresh verification; a local timer never extends authentication.
Concurrent-session choice is PC2, not an invented one-session limit. Login always
starts fresh password+OTP after expiry. Logout revokes server context and expires
cookie only as a confirmed operation; an offline/failed request cannot claim
server revocation. Session rotation/revocation follows
[OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).

Router guards are navigation UX only. Query owns the fresh server session
projection; React state owns password/OTP/form input. No duplicate global identity
store and no mount-effect fetch. Use the existing QueryClient and Router context.

| Event | Required browser behavior |
| --- | --- |
| Password success | Pending challenge only; clear password input/mutation payload, no protected shell |
| OTP success | Discard previous identity caches; fetch fresh session projection before protected content |
| Logout /401 /account change | Block protected rendering immediately; cancel queries using AbortSignal, clear Query query+mutation caches and Router retained data/forms; ignore late callbacks from prior identity; then navigate. Revalidate on tab focus and before protected navigation; same-origin tabs receive a secret-free invalidation signal |
| Offline/network uncertainty | Hide protected cached data and mark session unverified; disable sensitive actions, never infer auth from cached success. Offline logout clears displayed state but explicitly says server logout is unconfirmed; no replay queue. Require deliberate retry/fresh server check on reconnect |
| Role/status revocation | Next server check rejects old context; clear as above. Do not promise instantaneous remote UI push; backend denial is immediate after committed revocation |

Query mutations: retry=false, networkMode=always, no offline pausing/resumption;
no optimistic authentication success. Strip sensitive mutation variables on
settlement/unmount; no devtool/tracing serialization of credentials. Clear/ignore
in-flight previous-context results rather than assuming cache clearing cancels
network operations. [QueryClient cancellation/clear](https://tanstack.com/query/latest/docs/framework/react/reference/classes/QueryClient).

Retain existing worker policy: no API/auth/session/profile/role caching, no browser
storage of secrets/confidential Query data and no Background Sync. All auth HTTP
responses, including errors and inspections, use `Cache-Control: no-store`.
Do not expand navigation fallback to private routes. Defer worker activation while
an auth submission or sensitive dirty form is active; foundation update prompt
currently has no such form guard, so A1 must add that small behavior. A static
shell never proves authentication. No new PWA framework.

## 6. Minimal REST responsibilities

**16 proposed responsibilities: 7 in A1, 9 later.** Prefix `/api/v1`; existing
`/api/health/*` remain unchanged. No second OpenAPI specification now. Generate
contracts from actual routes during implementation. Responses are explicit DTOs,
errors `{code,message,fields?,request_id}` with French messages; no secrets or SQL.
Common failures: 403 CSRF/Origin/role denial,422 input,429 abuse limit,503 temporary
failure; protected calls401 absent/expired/revoked session, invisible targets404,
stale/replayed mutations409. Bound input and reject unknown privilege fields.

| Slice / method and path | Auth / role; request → response and state | One-use rule / oracle |
| --- | --- | --- |
| A1 GET `/auth/session` | Anonymous allowed; cookie context →200 anonymous/pending/verified state, CSRF token; safe identity/role/expiry only when verified. Expired verified context 401 clears stale cookie, then next inspection creates anonymous context | Does not extend idle; no OTP/session secret; T07/T10 |
| A1 POST `/auth/invitations/inspect` | Anonymous+CSRF; selector/verifier →200 readonly invited email; generic400 invalid link | Non-consuming, no role override; T03 |
| A1 POST `/auth/invitations/accept` | Anonymous+CSRF; proof,password,confirmation →200 password_set, no login | Consume proof/set password atomically; T04 |
| A1 POST `/auth/login` | Anonymous+CSRF; email,password →202 pending and masked email; generic401 credentials/inactive;503 mail unavailable | No protected session; preserve live counters; T05–06 |
| A1 POST `/auth/otp/verify` | Bound pending context+CSRF; six-digit code →200 verified, rotated cookies;400 invalid/expired,409 consumed | Atomic consume+session; T07–08 |
| A1 POST `/auth/otp/resend` | Bound pending context+CSRF; empty body →202 sent,429 limit,503 delivery failure | Replace generation, preserve counters; T08–09 |
| A1 POST `/auth/logout` | Current anonymous/pending/verified context+CSRF; empty body →204, revoked context+expired cookie | Already-absent logout requires fresh anonymous context+CSRF and server confirmation; no success on unconfirmed revocation; T10/T14 |
| A2 POST `/access/invitations` | Verified Admin; email,name,business-role →201 safe invitation/delivery status,409 duplicate,503 delivery failure | No Admin/Partner grant in this slice; fixed target+one live proof |
| A2 GET `/access/invitations` | Verified Admin; bounded filters/page →200 safe status rows | No verifier/link; non-Admin403 |
| A2 POST `/access/invitations/{id}/resend` | Verified Admin; expected_version →200 safe delivery status,503 send failure | New generation; terminal accepted/revoked invitations409 |
| A2 POST `/access/invitations/{id}/revoke` | Verified Admin; expected_version →200 revoked | Atomic invalidation/audit; repeated terminal action no new mutation |
| A2 GET `/access/users` | Verified Admin; bounded filters/page →200 safe user/role/state/version rows | No password/session/challenge projection; non-Admin403 |
| A2 PATCH `/access/users/{id}` | Verified Admin; expected_version,one business role and/or deactivate=true →200 safe state/version | Locked reauthorization and revoke old contexts; no Admin-target lifecycle until LA2 |
| A3 POST `/auth/password-reset/requests` | Anonymous+CSRF; email →same generic202 for known/unknown/throttled/delivery outcome | No account enumeration; approved LA1 rate policy |
| A3 POST `/auth/password-reset/inspect` | Anonymous+CSRF; selector/verifier →200 readonly email or generic400 | Non-consuming; no arbitrary identity input |
| A3 POST `/auth/password-reset/complete` | Anonymous+CSRF; proof,password,confirmation →200 password_reset, no session | Consume once and revoke all old sessions/challenges; loser409 |

Link verifier arrives in fragment, is removed from address/history before further
navigation, held transiently outside Query keys and posted in bodies. No analytics
or external scripts on proof pages; no-referrer policy. No raw secret in response,
logs, redirect/search parameters or persisted state. Reset behavior follows the
existing neutral contract and [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).

## 7. Visual contract

Inspected all five supplied PNGs in `docs/inspiration/auth/`: `login.png`,
`login-otp.png`, `set-password.png`, `forgot-password.png`, `reset-password.png`,
and the auth portions of `mjl-prototype-auth.html`. They are ignored local assets,
not guaranteed available on a fresh clone; preserve access for the implementer.
Use their navy architectural side panel, MJL mark, centered form card, readonly
invited email, reveal controls and six slots grouped 3+3. Keep **one logical OTP
input** with paste/autofill, keyboard editing and accessible errors, not six
independent focus traps. Remove prototype DEMO/scenario controls and sample data.

Read `DESIGN.md`, design-system index, approved v3 design/tokens and current
inventory/audit. v3 navy #16324f/action #164f7a, Inter, spacing/radii, visible focus,
44px touch controls, reduced motion and forced colors remain authoritative;
prototype internals/green palettes/large corner radii do not override them. Reuse
foundation self-hosted Inter and shadcn primitives. Collapse decorative panel on
small screens, retain labeled fields, reveal button names, error association and
non-color password-criteria feedback. No new auth inspiration is required for A1.
The signed human accessibility/acceptance review remains a later delivery gate.
Recovery links/screens appear only when A3 is implemented; no inactive link in A1.

## 8. Security events and applicable controls

Minimum event groups below are required by SEC-09's traceability objective;
exact event names are proposed. No generic audit framework or audit UI in A1.
Every event records UTC time, correlation ID, actor/target where known and a
bounded safe outcome code. Anonymous actors are marked anonymous; failed unknown
email attempts use a keyed fingerprint rather than a raw address/password payload.

| Events / slice | Actor → target / safe metadata | Failure behavior and evidence |
| --- | --- | --- |
| Bootstrap, invitation prepare/reissue/accept; A1 then Admin issue/revoke A2 | Operator or verified Admin / proof-bound actor → fixed user/invitation; role, generation, expiry and outcome, never proof | Successful security mutation+event atomic; induced audit failure leaves no activation/provisioning |
| Password login failure, OTP issue/resend/failure/lockout; A1 | Anonymous/pending actor → known user or opaque fingerprint; reason/attempt window | Persist counters and failure event despite rejected credentials; commit denial before returning; infrastructure failure503 never grants access |
| OTP success/login success; A1 | Verified user → session internal record ID; timestamps/context version, never cookie | Consume+grant+event commit together; audit failure gives no session |
| Logout/expiry/revoked-session denial; A1 | User or server → internal context reference; safe reason | Logout audit failure503 is not confirmed revocation; local UI locks. Expiry/revocation remains denied even if denial logging fails; sanitized operational error |
| Reset request/outcome/completion; A3 | Anonymous/proof-bound actor → target/fingerprint; status only | Neutral public response; hash change+revocation+success audit atomic |
| Activation/deactivation/role change; A2 | Verified Admin → target; old/new state/role, expected version | Account change+context revocation+event atomic; audit failure rolls back mutation |

No passwords, OTP values, invitation/reset/session secrets, request bodies or
email bodies in production logs. Test mail capture is isolated, explicitly
secret-bearing and removed with fixtures. Retention/access/clock synchronization
and operational log custody require E1/E4; local tests do not prove them.

**15 applicable existing controls** are mapped, not a new control catalog. All
implementation assessments remain NOT_ASSESSED. Baseline03 owns source wording
and locators; PSSIE§§4.3–4.4, EXP-09/10, ADM controls and RSPSL
IDEN-ESERV-01–05/EVENT-ESERV-01–04 materially inform this scope. Source currency,
legal interpretation and email-OTP assurance remain E1/E3, not a compliance claim.

| Existing control | Enforcement / test and expected evidence | Owner / external dependency |
| --- | --- | --- |
| SEC-01 governance | Explicit scope/policy gates; reviewed doc and decisions | Sponsor/RSSI; E1 |
| SEC-02 API architecture | Typed route DTOs/generated OpenAPI; T18 contract evidence | Engineering; none for local work |
| SEC-03 identity/password | P1/P2, guarded bootstrap, hash/abuse controls; T01–06/17 DB+negative tests | Backend/RSSI; PC1/E3 |
| SEC-04 MFA | Pending-only context, bounded one-use challenge; T06–09/17 | Backend/mail owner; PC1/E3 |
| SEC-05 sessions | Server expiry/rotation/revocation/CSRF; T07/10–14 | Backend/frontend; PC2/E2 |
| SEC-06 access separation | Exclusive principal, no client grants, live server checks; T02/12, A2 wrong-role and A4 resource tests | Backend/domain owner; LA2/LA3 |
| SEC-07 API/input/concurrency | Validation, generic errors, locks; T04/08/11/18 | Engineering; none |
| SEC-09 audit | Atomic grants/mutations, bounded denial events, secret exclusion; T15–17 | Backend/operations; E1/E4 |
| SEC-10 crypto/secrets | Adaptive hashing, keyed OTP, Secure cookies/TLS; T11/17 plus later TLS/key evidence | RSSI/operations; E3 |
| SEC-11 privacy | Minimal identity/log data, no browser persistence; T14/17 | Ministry data/legal owner; E1 |
| SEC-13 PWA | Existing static worker, no-store, Query clearing; T13–14 | Frontend; none for local tests |
| SEC-14 secure development | Focused pytest/PostgreSQL/Playwright and independent review; T01–18 | Engineering/security reviewer; E6 for delivery |
| SEC-16 protected administration | CLI bootstrap, private DB, trusted proxy/origin; T01/11/18 plus hosting evidence | DSI/RSSI; E2 |
| SEC-17 vulnerability management | Review actual auth library/lockfile and findings when implementing; T18, release-bound review | Engineering/RSSI; E4 |
| SEC-20 deliverables | Update auth operational/user/API/data documentation with actual slice | Delivery lead/client; E6 |

**7 original CLIENT clauses mapped:** CLIENT-SEC-01→03/04/05/06/09/10/11/13/14/16/17;
CLIENT-ARCH-01→02/13; CLIENT-API-01→02/07; CLIENT-DOC-01→14/20;
CLIENT-INFRA-01→16 and baseline external hosting/continuity gates;
CLIENT-MIG-01→empty-source/no-native-account import plus future non-regression
record (baseline 15/E5); CLIENT-INT-01→financial integrity in baseline 08, deferred
business scope, not satisfied by auth. Counting coverage does not claim delivery.
Baseline12 documents and 18/19 continuity/supplier detail remain separate scopes,
not silently exempted or duplicated here.

## 9. First-slice acceptance: 18 future checks

These are **planned**, none run in this documentation task. During authorized A1,
use focused pytest/real disposable PostgreSQL and Playwright/test mail capture,
with minimal fixture identities destroyed at teardown; never enable a bypass to
make tests pass. Exact test filenames are chosen then, not skeletons now.

| ID | Concrete test/evidence oracle |
| --- | --- |
| T01 Bootstrap | Two concurrent restricted CLI calls yield one pending identity/event; HTTP creation absent; rerun/refused reuse; no defaults/output secrets; fail delivery then deliberate reissue same identity |
| T02 Privilege binding | Acceptance cannot change target email/role or create another identity; rejected extra fields; native accounts absent; no public signup endpoint |
| T03 Proof inspection | Correct proof reveals only invited readonly email, without consumption; invalid/expired/revoked proof generic failure with no email disclosure |
| T04 Acceptance | Matching policy-valid password stored only as verifier; mismatches rejected; two DB-backed accepts produce one success/no duplicate; replay denied, no session issued |
| T05 Credentials | Correct password reaches pending state only; wrong/unknown/inactive generic failure with comparable verifier work; approved account/IP limits enforced across workers |
| T06 Delivery/MFA | Test mailbox receives challenge; missing/failed transport gives no authenticated session and no usable undelivered generation; direct protected request with pre-auth cookie 401 |
| T07 OTP/rotation | Valid code creates exactly one verified session/new cookie+CSRF; old pre-auth identifier cannot access it; invalid/expired/wrong-browser code fails |
| T08 Races | Concurrent verify/verify and verify/resend have one valid serialized outcome, no duplicate grant; replay rejected; relogin cannot reset live counters/lockout |
| T09 Limits | At/before/after approved expiry, attempt, lock and resend boundaries with injected clock: exact documented outcomes, including malformed input behavior and restart persistence |
| T10 Expiry/logout | Idle and absolute each tested at 86,400s; polling does not extend idle; absolute never slides; confirmed logout invalidates cookie replay; session-inspection expiry 401 |
| T11 Cookie/CSRF | Inspect Secure/HttpOnly/host-only/SameSite/path in HTTPS test context; isolated localhost exception; foreign/missing Origin and CSRF denied for all unsafe routes; spoofed proxy/Host cannot alter origin or links |
| T12 Identity invalidation | Disposable account/status/password/security-version changes reject existing context on direct API call; no role field/client guard can confer privilege; A2 adds actual wrong-role Admin-route tests, A4 adds resource/no-self-validation cases |
| T13 Cache/account isolation | Real browser login/OTP/logout/401/account-switch and a delayed old response never render prior identity; same-origin second tab invalidates; inspect no auth entries in Cache Storage/localStorage/IndexedDB or persisted Query cache |
| T14 Offline/unknown outcome | Offline hides protected state, network errors never show authenticated success; no queued login/OTP/logout replay after reconnect; logout explicitly unconfirmed until server confirms; worker update deferred during form submission |
| T15 Audit success/failure | Bootstrap/accept/OTP grant and events agree; injected audit write failure leaves no granted identity/session/password transition; logout failure reported truthfully |
| T16 Denial evidence | Wrong login/OTP creates protected sanitized event and durable limits without granting access; database/log failure cannot bypass expiry or MFA |
| T17 Secret exclusion | Known fixture secrets absent from DB cleartext columns, HTTP projections, URLs after fragment removal, app logs and browser persistent storage; isolated test mailbox is the declared exception and is torn down |
| T18 Integration/quality | Full A1 journey in React against actual FastAPI/PostgreSQL; generated OpenAPI validates schema/statuses; lint/format/type checks and focused tests pass; migrations reviewed; Compose test resources isolated/removed; no real SMTP/production claim; keyboard/mobile/OTP paste/reveal/error states match supplied references |

## 10. Decisions and gates

**IMPLEMENTATION_BLOCKER: 0.** Safe local development can use explicit test-only
policy values and fake mail; it cannot enable real accounts using unresolved
policy defaults. A1 implementation approval must explicitly retain this gate.
No policy decision is silently made by this readiness verdict.

| ID / classification | Decision, owner and precise stop boundary |
| --- | --- |
| PC1 PRE-CUTOVER_DECISION | Sponsor/RSSI confirm password criteria/Unicode handling/email normalization and historical invitation/OTP values H03/H05/H06; set missing password/account/IP and anonymous endpoint abuse limits plus pre-auth lifetime. Proposed starting point is the documented historical values, not invented contractual numbers. Local fixtures may specify values for tests; real-account enablement refuses incomplete policy. No unbounded login or OTP fallback. |
| PC2 PRE-CUTOVER_DECISION | Sponsor/RSSI decide concurrent sessions (proposal: independent sessions, revoke all on security-context change; no speculative cap) and confirm foreground activity classification. Resolve and test before real-account enablement; 24h hard ceiling never negotiable here. |
| LA1 LATER_ACCESS_DECISION | Sponsor/RSSI: reset lifetime and direct request-based throttling, replacement of old outstanding proofs and any security notification rule; gates A3 enablement, not A1. |
| LA2 LATER_ACCESS_DECISION | Sponsor/RSSI: additional Admin provisioning, self-removal/last-Admin protection and lost sole-Admin recovery; A1 exposes none of these. No permanent bootstrap bypass or generic recovery backdoor. Resolve before real operator dependence on the system. |
| LA3 LATER_ACCESS_DECISION | Domain owner: role/deactivation coordination handoff with assignments and historic contributors; gates later affected account changes/business integration, not empty A1. |
| E1–E6 EXTERNAL_SECURITY_DEPENDENCY | Inherit exactly the six groups from baseline 03: source/legal/privacy/retention; hosting; keys/mail/OTP assurance; operational evidence; empty-source migration interpretation; delivery/acceptance. Owners and scope remain there. E1/E3 gate real personal/authenticated sensitive use; E2/E4 gate affected environments. Fake mail does not settle E3. |
| PG1 PRODUCTION_GATE | DSI/RSSI/host verify actual HTTPS/cookies/proxy origin, provider/network/secret custody, mail receipt and recovery/access-review operation against approved E1–E4 decisions. No deployment authorized. |
| PG2 PRODUCTION_GATE | Client/security/delivery owners accept release-specific security/load results, remediation, retention/restore/incident evidence, human accessibility/UAT and handover under E4–E6. These are release evidence gates, not local development certificates. |

Counts: **0 blockers; 2 pre-cutover; 3 later access; 6 external groups; 2 production
verification gates** (PG rows reference external groups, not new requirements).
NON_BLOCKING: A1 inspiration is supplied; recoverability/admin-screen/Partner
references are checked before their respective later UI slices. Do not expand
A1 merely to close all later questions.

## 11. Review and verdict

Pre-edit scope checkpoint: one readiness document, minimal authority/decision/
roadmap links only. Every proposed A1 concern maps to the bootstrap/password/OTP/
session journey or its concrete CSRF, replay, abuse, audit or disclosure risk.
Reset, normal access management and business authorization are deferred, not
prebuilt. No new platform or generic orchestration.

Independent engineering review: **PASS**. Independent security/specification
review: **PASS after correction**. Corrected unintended standalone account
reactivation to the existing re-invitation/password-setup journey; clarified that
expired-session401 clears its cookie and idempotent logout still needs a valid
anonymous CSRF context. No blocking finding remains. Documentation-only diff
and direct new-file review are the verification evidence; no runtime test claim.
Confidence is conditional on explicitly resolving PC1/PC2 before enablement and
on external evidence before real/sensitive use, not on future tests already passing.
`tasks/lessons.md` evaluated: no new repeated mistake or durable debugging finding.

**AUTH_ACCESS_READY_FOR_AUTHORIZATION**: bounded A1, confirmed invariants, explicit
policy stage gates, actual supplied visuals and concrete negative-test oracles.
A separate user authorization is required. Stop; do not create users, schemas,
dependencies, tests, runtime code, Docker changes or deployment.

## 12. A1 implementation evidence (DEC-094)

**A1_COMPLETE** for isolated synthetic operation; real-account enablement remains
NOT_AUTHORIZED pending PC1/PC2. Foundation
`48c2bea` and readiness `6007159` were verified ancestors and the worktree was
clean before this slice. The baseline passed 7 Vitest, 6 pytest and 3 Playwright
checks before implementation.

**Ownership:** `app/auth/routes.py` owns seven typed HTTP responsibilities;
`service.py` owns transaction boundaries, identity/credential checks, invitation
consumption, OTP generation/consumption, session projection/revocation and audit.
`models.py` / Alembic `0002_a1` own P1–P6: `auth_user`, `auth_invitation`,
`auth_otp`, `auth_context`, `auth_audit`, `auth_abuse`. No business tables or seeds.
Audit rejects UPDATE/DELETE; privileged DB administration remains an external
operations control. `principal()` is the verified-only backend boundary; no
protected business endpoint has been invented for A1.

The restricted operator command is `python -m app.auth.bootstrap --email
<synthetic@example.test>` in the isolated backend environment. OS/container
execution access is the operator boundary; the audit identifies its OS UID.
There is no HTTP bootstrap or registration endpoint and no default password.
Bootstrap serializes on a PostgreSQL advisory lock and refuses existing users or
bootstrap evidence. `--reissue` only replaces the same still-pending target's
proof. Delivery is prepare/commit → private fake capture → delivered/commit;
failed sends or post-delivery persistence failure leave an unusable prepared
proof. Acceptance and reissue share lock ordering. Login/OTP use context, user
and challenge row locks; credential counters are acquired before these locks.

Argon2id uses the maintained `argon2-cffi` implementation/default parameters;
SHA-256 stores only high-entropy opaque-token digests and keyed HMAC binds each
OTP to user/context/generation. The same HMAC key fingerprints abuse identities.
Every HTTP request gets one correlation ID, propagated through prepare, delivery
and sanitized error envelopes. Database failures fail closed. Proxy headers are
not trusted by the development server; exact configured Host/Origin and bound
CSRF protect unsafe methods. Cookies are HttpOnly/host-only/Path=/SameSite=Lax;
HTTPS uses Secure `__Host-mjl`, isolated HTTP localhost uses `mjl_local`.

**Policy is deliberately synthetic:** default mode is off. Enabling A1 requires
`MJL_AUTH_MODE=synthetic`, `MJL_ENVIRONMENT=isolated-test`, a `mjl_test_` database,
a loopback origin, a private `/tmp/mjl-a1-mail-*` capture and complete policy JSON.
The only accepted/stored identities are `@example.test`. There is no SMTP or
real-account enablement switch. Fixture password criteria use Unicode Lu/Ll/Nd,
non-letter/non-number/non-space symbol, matching confirmation, 8–128 characters;
invitation 604800s, OTP 600s, 5 attempts/600s lock, resend 60s/max3, pre-auth900s,
credential account10/900s and IP120/60s, endpoint IP120/60s. These are explicit
test values, **not sponsor/RSSI policy**. Malformed bounded OTP input consumes an
attempt; all auth requests, including DTO errors, consume the endpoint budget.
Relogin retains live challenge counters; a fully expired 900s challenge window
with no remaining lock can renew them. Independent verified sessions are a
fixture choice. Both 86400s expiry ceilings are fixed; inspection never renews
activity, and A1 has no foreground business operation that extends it.

PC1 and PC2 remain **PENDING**, owned by sponsor/RSSI exactly as §10 defines.
Neither blocks synthetic verification; both block real-account enablement.
Evidence required is explicit approved password/Unicode/normalization,
invitation/OTP/abuse/context policy (PC1), and concurrency/foreground activity
classification (PC2), followed by implementation and focused verification.
LA1–LA3 and E1–E6 remain unchanged, outside A1 approval. Test results do not
establish legal compliance, external mail assurance, TLS operations, backup,
monitoring, formal security assessment or Ministry acceptance.

### Acceptance evidence

All rows use the original §9 identifiers and oracles. `test_auth_security.py`
references below are actual `test_tNN_*` functions, not a replacement checklist.
PG means disposable PostgreSQL 17 with real Alembic/transactions; browser means
Chromium against the built React app and real isolated FastAPI/PG. Time tests
inject the service clock; production clock reads PostgreSQL. Results: **18/18
PASS**, zero failed mandatory checks.

| ID | Behavior / positive and negative oracle | Executed test | Environment | Result |
| --- | --- | --- | --- | --- |
| T01 | Concurrent CLI gives one pending Admin; repeat/public creation denied; failed delivery reissues only same pending target | `test_t01_*`, bootstrap test, policy gate | PG + CLI | PASS |
| T02 | Target email/role immutable from request; extra grants rejected422; no signup | `test_t02_no_client_grants`, T01 absent routes | PG/API | PASS |
| T03 | Inspection non-consuming; bad/expired/revoked proof discloses no email | `test_t03_invalid_proof_no_email`, invitation test | PG/API | PASS |
| T04 | Valid password hashes; weak rejected; concurrent accepts yield200/409; replay denied, no session | `test_t04_concurrent_acceptance`, invitation test | PG | PASS |
| T05 | Correct credentials pending only; unknown/wrong generic401, durable limits after service restart | `test_t05_credentials_and_durable_account_limit`, full HTTP journey | PG/API | PASS |
| T06 | Delivered challenge required; failed transport cannot grant; direct principal rejects partial MFA | `test_t06_*` | PG/API | PASS |
| T07 | OTP rotates cookie/CSRF; wrong browser denied; old context cannot access grant | `test_t07_wrong_browser_and_rotation`, full HTTP journey | PG/API | PASS |
| T08 | Verify/verify and verify/resend serialize with ≤1 grant; counters survive relogin | `test_t08_concurrent_otp`, T09 relogin checks | PG concurrent workers | PASS |
| T09 | Before/at/after expiry; lock/cooldown/max resends; malformed requests throttled; restart durable; expired window renewal | `test_t09_*` | PG/injected clock | PASS |
| T10 | Idle/absolute86400 independent boundaries; polling does not renew; old logout cookie401 | `test_t10_expiry_and_polling`, full HTTP/browser journeys | PG/clock + browser | PASS |
| T11 | HTTPS/local cookie flags; every unsafe route missing/foreign Origin and forged/missing CSRF rejected; Host/proxy spoof denied/ignored | `test_t11_*` | HTTPS TestClient + PG | PASS |
| T12 | Status/role/password/version change rejects existing server context; client role never grants | `test_t12_live_identity_invalidation`, T02 | PG/API | PASS |
| T13 | Real login/logout401, synthetic identity change, delayed old response, cross-tab invalidation; no persistent auth cache | both `e2e/auth.spec.js` cases; payload cleanup Vitest | browser + Vitest | PASS |
| T14 | Offline masks identity, no replay; interrupted logout unconfirmed and deliberate retry; dirty form blocks worker update | both A1 browser cases + foundation worker cases | browser/PWA | PASS |
| T15 | Audit grants agree; bootstrap/accept/grant/logout audit failure rolls back; post-send invitation failure unusable | `test_t15_*`, T04/T08 | PG triggers/failure injection | PASS |
| T16 | Sanitized denial evidence and durable counters; expired session and unavailable DB cannot grant | `test_t16_*`, T05/T09/T15 | PG/API | PASS |
| T17 | No cleartext verifier/password/token in DB/projections/logs/storage; fragment removed; private capture only | `test_t17_*`, A1 browser/storage checks, application log scan | PG/browser/container logs | PASS |
| T18 | Full real browser journey; OpenAPI, repeatable migration, quality checks, mobile/reveal/keyboard/OTP paste, isolated cleanup | full HTTP, policy/health/database tests; auth Vitest; five Playwright cases; quality commands | Docker/host/browser | PASS |

A stale/revoked context is rejected401 before inspecting a challenge; a valid
context encountering an already-consumed challenge yields409. Invalid invitation
inspection remains generic400; acceptance replay with the valid consumed proof
returns409. These precedence rules preserve the explicit context-denial contract.

### Security controls and review

The 15 controls in §8 were exercised at A1 scope: SEC-01 policy refusal and
DEC-094 scope; SEC-02 typed OpenAPI; SEC-03 password/proof/abuse; SEC-04 OTP;
SEC-05 sessions/CSRF/cache; SEC-06 live exclusive Admin principal; SEC-07
validation/locks; SEC-09 atomic audit/denials; SEC-10 Argon2id/HMAC/cookies;
SEC-11 minimal projections/private capture; SEC-13 online-only PWA; SEC-14
PostgreSQL/browser tests and independent reviews; SEC-16 CLI/private DB/Host;
SEC-17 maintained locked auth dependency review; SEC-20 updated API/schema,
operator/user/test documentation. **15/15 code/document controls exercised,
PASS for A1 only**. External dependencies remain the six E1–E6 groups with the
owners and gates in baseline03; the dependency-tool advisory in gap analysis is
not closed by A1. No formal security-compliance or production-readiness claim.

Independent standards/frontend and specification/security reviews identified
and verified fixes for resend exhaustion, lock order, endpoint abuse, error DTOs,
audit correlation/targets, stale Query observers, logout uncertainty, retained
mutation payloads and OTP composition. Final focused re-reviews had no remaining
findings; reviewers did not claim their static review replaced runtime tests.

### Final verification and cleanup

64/64 backend cases passed in the rebuilt Docker backend, including generated
OpenAPI and repeatable Alembic upgrade. 11/11 frontend cases passed (seven
foundation plus four auth); 5/5 Playwright cases passed against actual FastAPI/PG.
React build, both Docker image builds, Compose configuration, Ruff lint/format,
mypy, ESLint, Prettier, Stylelint and `git diff --check` passed. The explicit
commands are maintained in README. Test warnings were Starlette's httpx test-client
deprecation and the non-root test UID's inability to write pytest's optional
image-local cache; neither affected execution. No dependency migration or
permission relaxation was introduced for these warnings.

The task used `mjl-a1-test` only: three containers, one network and one database
volume. Pytest child databases were removed (only the browser database remained
before teardown); final teardown removed the owned runtime resources, image
tags, private mailbox and generated policy/credential files. Zero disposable
runtime/test-fixture resources remain. Unrelated Docker/POC resources were not
modified; shared Docker build cache was not pruned. Application logs were scanned
against the known fixture secrets without printing them: no matches.

Skipped intentionally: historical Dolibarr suites, real SMTP, production
deployment/security certification and human acceptance. None is authorized by
A1, and no passing test closes those separate gates.
