# A2 account-management readiness

Current authorization: DEC-096 authorizes A2.1 from this contract at `2c1929e`.
The [roadmap](../mjl-implementation-roadmap-v2.md) owns implementation evidence.
The readiness review below records the earlier documentation-only decision.
DEC-098 now approves restricted A2.2 scope only; [readiness 06](06-a2-account-lifecycle-readiness.md)
owns its eligibility and pre-mutation gates. Later LA3/R8 and policy gates remain
in force. This supersedes blanket LA3 blocking of restricted R6/R7 below, not the
historical A2.1 implementation contract.

## 1. Purpose and verified baseline

Documentation-only review, 2026-10-22. **A2 implementation is NOT_AUTHORIZED.**
This document refines the A2 proposal in [readiness 04](04-authentication-access-readiness.md),
without changing approved business rules or PC1/PC2. No application acceptance,
real-account enablement, production email verification or production readiness is claimed.

Git ancestry confirms foundation `48c2bea2e591ce60c4a86be0c2f6c1dfb536c42d`,
readiness `6007159651abf82833f58ce229ba5349f3a8ff44`, and A1 implementation
`0a2cf22d195a1443d3bf49e46b63f9186edc7f18`. A1 is **A1_COMPLETE**.
The roadmap and readiness 04 §12 record 7 API/6 persistence responsibilities,
18 acceptance checks, 64 backend/11 frontend/5 browser tests, and disposable-resource
cleanup. Current source and test inventory match that slice; these are historical
execution results, not newly rerun tests or a fresh runtime/resource attestation.
The review began with a clean worktree.

Authority: [business baseline](01-authority-and-business-baseline.md),
[engineering standard](02-target-architecture-and-engineering-standard.md),
[security baseline](03-security-compliance-baseline.md),
[functional specification §§4–5](../mjl-functional-specification-v2.md),
[permission matrix](../mjl-permission-matrix-v2.md), DEC-005/009/011/016/019/086–094,
and [historical REST access contract](../mjl-rest-api-contract.md).
Historical native-Admin/Dolibarr mechanics are evidence, not target architecture.

## 2. Confirmed scope and exclusions

Eight confirmed responsibilities below count business capabilities, not endpoints.
They are approved business scope; their new-stack implementation remains unauthorized.

| ID | Confirmed responsibility | Proposed stage |
| --- | --- | --- |
| R1 | Admin views bounded account identity, effective role and state | A2.1 |
| R2 | Admin invites an ordinary user with exactly one of three business roles | A2.1 |
| R3 | Admin views invitation and delivery status | A2.1 |
| R4 | Admin deliberately reissues an eligible unaccepted invitation | A2.1 |
| R5 | Admin revokes a pending invitation | A2.1 |
| R6 | Admin changes an ordinary account's exclusive business role, subject to assignment/history safeguards | A2.2, LA3 |
| R7 | Admin deactivates an ordinary active account; authorization ceases | A2.2, LA3 |
| R8 | Admin reinvites an inactive ordinary account; activation requires password setup and fresh authentication | A2.2, LA3 |

Audit is a mandatory cross-cutting obligation for these eight, not a ninth UI feature.
R4/R8 follow the REST contract's re-invitation behavior and readiness 04 §§3/6;
R8 is not an activation toggle. Role/deactivation handoff is not settled merely
because there are currently no business tables.

Two responsibility groups require decisions: **LA2 Admin lifecycle** and **LA3
ordinary account lifecycle/handoff** (§11). Additional Admins, self-role change,
self-deactivation/access revocation and last-Admin removal are not authorized by
this proposal. LA2 must decide these together, including sole-Admin recovery.
No delegated administration, multi-role account, Partner role, public registration,
profile/email editing, deletion, bulk operations, dashboard metrics, separate account
detail page, session/device manager, A3 recovery, A4 business endpoints or PTA work.
No persistent sample accounts or historical business-data migration.

## 3. Roles and Admin authorization

| Canonical identifier | French label | A2 authority |
| --- | --- | --- |
| `AGENT_SAISIE` | Agent de saisie | Own A1 authentication only; no Admin API |
| `AGENT_VERIFICATEUR` | Agent superviseur et prévalidateur | Same |
| `VALIDATEUR_DEFINITIF` | Validateur définitif | Same; business authority deferred to A4 |
| `ADMIN_PLATEFORME` | Admin | List accounts/invitations and manage ordinary invitations |

A1's controlled first technical Admin is the only provisioning source for Admin
in this slice. No additional super-role. Admin grants no financial/PTA approval.
Every `/api/v1/access` endpoint requires a fresh, active, fully OTP-verified A1
principal, then an explicit Admin guard inside the transaction. Invalid, inactive,
expired or partial sessions return 401; valid non-Admin principals return 403.
Mutations also check CSRF/Origin, target eligibility and expected version. A
browser role value is never authority. Reject Admin role payloads and Admin
invitation targets, including the actor's own invitation, before any mutation/mail.
The Admin may see their own safe list row; this grants no self-management operation.

A1 currently checks Admin in `auth/service.py` login/context, restricts Identity in
`auth/dto.py`, and displays a literal Admin label in `frontend/src/AuthView.jsx`.
A2.1 must allow all four canonical roles through the SAME A1 login/session flow,
and separate authenticated identity from Admin authorization. Ordinary users land
on the existing identity screen, with their actual role and no business controls.
This necessary extension is not a new authentication system or A4 implementation.
The existing User default Admin must never supply a missing invitation role.
Bootstrap reissue currently selects an arbitrary User; with A2 accounts present,
it must select the original bootstrap audit target, verify its Admin role and
pending state, and never reopen initial bootstrap or reissue ordinary invitations.

The rebuild currently has one MJL application boundary, no tenant selector or
business entities. Scope queries to this authorized application and fixed DTOs;
do not accept a client entity/organization filter or invent multi-Ministry tenancy.

## 4. Invitation contract

This is the proposed target contract for authorization, based on retained behavior.
A1 User states stay `pending`, `active`, `inactive`; invitation states stay
`prepared`, `delivered`, `consumed`, `revoked`. Expiry is derived from server time.
Delivery failure/unconfirmed delivery is separate from account activation.

| Situation/action | Proposed outcome |
| --- | --- |
| New normalized synthetic email + permitted role | Create pending User and one prepared invitation; record role; send after commit; mark delivered only for unchanged eligible generation |
| Existing pending email, including duplicate submission | 409, no second User/proof/mail; select existing invitation and explicitly resend if eligible |
| Existing active email / consumed invitation | 409, no invitation or reset of active account |
| Existing inactive email | A2.1 returns 409; R8 requires A2.2 authorization and LA3 resolution |
| Prepared/unconfirmed, delivery-failed, delivered or expired invitation for pending ordinary User | Explicit resend rotates verifier and generation, increments version and expiry, preserves role; all older proofs invalid |
| Revoked invitation | Terminal in A2.1: create/resend returns 409; no silent resurrection or alternate-email workaround |
| Pending invitation revoke | Mark revoked, increment version, audit; User remains pending and cannot log in. Do not set a passwordless User inactive |
| Repeated revoke of already revoked invitation | 200 unchanged safe projection; no second domain mutation/audit success. Consumed invitation conflicts with 409 |
| Recipient accepts | Only delivered, unexpired, current proof and pending target; consume once, increment invitation version, define password, activate via A1. Role supplied by recipient rejected; no immediate verified session |
| Invalid/expired/revoked proof | A1 generic invalid-link denial; consumed replay cannot mutate twice |
| Change pending invited role | No edit operation in A2.1; resend retains intended role. Any future correction of revoked/pending identity needs a separately authorized extension |

Invitation proof is bound to target identity, intended role and security version;
the preparation audit facts record that binding for each generation (including
bootstrap/reissue). Acceptance and delivery completion compare it under the shared
lock; no extra invitation snapshot columns are proposed. Existing A1 pending
invitations without binding facts require deliberate reissue before acceptance,
not an inferred historical binding. Acceptance cannot trust payload role, and
resends never alter it. Unique normalized
email and unique invitation User FK remain database-enforced. Revoked identities
remain visible to Admin; deleting/recreating them is not an escape hatch.

Email is the sufficient first-slice identifier. List User `{id,email,role,state,version}`;
list invitation `{id,user_id,email,role,state,delivery_status,expires_at,version}`.
`delivery_status` is delivered, failed or unconfirmed for the CURRENT generation;
prepared alone is never proof of failure or delivery. Fixed bounded projections
exclude password hashes, verifier/generation values, OTP/context IDs and raw errors.
Dates beyond expiry, display names, affiliation and profile fields have no required
first-slice consumer and are omitted. This deliberately narrows readiness 04's
proposed `name` field; the visual reference is not authority to collect it.

## 5. Account/session lifecycle and races

R6–R8 are deferred, not implemented under A2.1. Required security invariant remains:
no inactive account or obsolete role/security context can authorize a later request.

| Scenario | Required backend/transaction result | Frontend and future oracle |
| --- | --- | --- |
| Pending proof revoked | Serialize against acceptance/resend/delivery; revoke commits before any later acceptance can succeed | Refresh lists; old link fails; no session was created |
| Ordinary active User deactivated (A2.2) | Under current actor/target authorization and version check: inactive, version increment invalidates all bound contexts/OTP proofs, revoke outstanding invitation, transactional old/new audit | Subsequent login and old-cookie protected requests fail; cached UI removed on next authoritative check |
| Ordinary active role change (A2.2) | Exactly one new business role, assignment/historical-contributor guard, version increment and same context/proof invalidation | Require fresh password+OTP; old verified and pending-OTP contexts fail |
| Admin's access changed | No such operation exposed by A2.1/A2.2 proposal; LA2 must settle usable-Admin safeguards first. A1 still rejects an externally invalidated principal | 401 clears session/access queries; 403 removes privileged controls and refreshes identity |
| Concurrent mutation/request | Authorization reads and security mutation serialize on relevant records. Work authorized and committed before revocation may complete; nothing authorized after revocation commit may use old privileges | Deterministic two-connection tests; UI cannot promise cancellation of already completed work |

The A1 keyed session proof already includes User id/version/state/role/password hash.
Use it; changing frontend cache is not revocation. Prefer effective revocation through the existing User security proof rather
than physically updating every Context/OTP row. Existing context validation
rejects both verified and pending OTP contexts after a User version change.
A2.2 must review the lock protocol across login/context/OTP/admin use cases: current
A1 locks Context then User whereas readiness 04 proposes User first. Do not bolt
User→Context updates onto Context→User authorization. LA3 covers business handoff;
engineering owns consistent locking and race tests, not a new policy choice. PC2 concurrent-session cardinality stays pending; revoking all
obsolete security contexts is already required, independent of that cardinality.
No credential/OTP/abuse counters are reset to bypass existing safeguards.

## 6. Smallest backend, API and persistence additions

Reuse **13 A1 capabilities**: (1) controlled bootstrap, (2) invitation proof/expiry,
(3) password setup/hashing, (4) password login, (5) email OTP, (6) opaque PostgreSQL
contexts, (7) cookies/CSRF/Origin, (8) expiry/logout, (9) identity/security proof,
(10) private test mail, (11) transactional security audit, (12) Query session
boundary, (13) static-only PWA/synthetic-policy fail-closed boundary.

Keep additions in the existing auth module: small access router/DTOs and direct
use cases alongside A1, with one shared Admin check. No repository/service layer,
provider, event bus, Redis, queue, new IAM tables or framework. Extend the existing
`/auth`-only middleware coverage to `/access` for no-store, bounded endpoint abuse
and sanitized failures. Preserve current synthetic policy values and test-mail
boundary; do not reinterpret OTP resend limits as invitation policy. Existing
endpoint abuse budgets also constrain Admin sending; any additional numeric
invitation policy needs explicit approval rather than a new development bypass.

DEC-102 supersedes the list pagination below as a target: cursor pagination,
default limit 60 and the `count/data/next/previous/object` envelope now apply.
[Engineering Standard 02](02-target-architecture-and-engineering-standard.md#uiapi-standard--dec-102)
owns the new rules and open details. The table retains the implemented A2.1
contract as historical evidence; migration is not implemented or authorized here.

All six proposed API responsibilities use prefix `/api/v1`; five belong to A2.1.
All require the §3 Admin guard; failures use A1 `{code,message,request_id}`.

| Responsibility | Method/path | Request → response | Mutation | Main failure oracle |
| --- | --- | --- | --- | --- |
| List users | GET `/access/users` | Validated page, size 1–50 (default 20), email substring ≤254, role/state enum → items/total/page/size | None | 401/403 before data; invalid filter 422 |
| List invitations | GET `/access/invitations` | Same bounded pagination/email, invitation-state enum → safe items/total/page/size | None | No secret/generation or other application data |
| Invite | POST `/access/invitations` | email + required business role only → 201 safe invitation after delivery | Pending User/proof/audit | 409 duplicate/inactive; 422 invalid/Admin role; 503 delivery failed, persisted pending result |
| Resend | POST `/access/invitations/{id}/resend` | positive `expected_version` → 200 safe invitation | Rotate eligible proof + audit | 409 stale/terminal; 503 delivery failed |
| Revoke | POST `/access/invitations/{id}/revoke` | positive `expected_version` → 200 safe projection | Revoke/audit or terminal no-op | 409 stale/consumed; Admin target 403 |
| Change ordinary account, later | PATCH `/access/users/{id}` | expected_version + exactly one of business role or deactivate=true → safe User | R6/R7 + revocation/audit | LA3 gate; stale 409; forbidden target 403 |

R8 later reuses POST invitation with existing inactive identity, not another endpoint.
Stable id ordering makes list pagination deterministic. Reject unknown fields and
role/privilege claims; authorized missing targets return 404. Unknown mutation
outcome after transport failure requires refresh before deliberate retry, not
optimistic success. No general idempotency-token subsystem: unique email, locked
versions and one-use proofs cover current consumers.

Two proposed schema changes, counted by affected table; **zero new tables**:

| Change | Invariant / why A1 is insufficient | Constraint, migration and verification |
| --- | --- | --- |
| P1 `auth_invitation.version` | Generation rotates on resend but does not detect revoke/delivery changes; don't expose private generation as concurrency token | Positive non-null integer, existing rows start at 1; increment every actual transition. Isolated Alembic upgrade + stale/concurrent transition tests |
| P2 bounded optional `auth_audit.details` JSONB | Existing columns cannot retain old/new role/state/version and invitation-generation attribution | Object with validated allowlisted scalar facts only: invitation id/generation, target version/role/state before/after, fixed reason code. DB object/size constraint and application field validation; existing rows null. Preserve append-only trigger; upgrade and rollback/audit-failure tests |

Audit facts preserve overwritten invitation generations without a second history
table. Derive delivery status from current-generation audit; no new timestamps,
name field, stored failed/expired state or personnel directory. A2.2 reuses these
fields and current User.version; its exact migration needs must be checked against
approved LA3 behavior before authorization, not prebuilt now.

Transaction contract (one use case owns each transaction; no helper commits):

- For A2.1 invitation mutations, reuse the existing transaction advisory lock
  `1843201`, acquired BEFORE actor Context→User validation; then target User and
  Invitation locks. Acceptance/proof inspection, bootstrap/reissue and delivery completion take
  that same invitation lock first. Recheck target/role/state/version under lock.
  Ordinary login never obtains this advisory lock or invitation locks. This
  bounds invitation races without redesigning all A1 session locks in A2.1.
- Create/resend commits pending proof and audit before sending mail. Delivery
  completion is a second explicit transaction: matching generation AND prepared
  state AND unchanged target role/security version/pending state are required.
  Otherwise report superseded, never resurrect a revoked/consumed invitation.
  No locks span mail I/O; no automatic retry/background dispatch.
- Revoke and later role/deactivation changes commit their state and required
  audit atomically. Acceptance similarly consumes/activates/audits once. Repeated
  terminal revoke authenticates/checks eligibility, returns current projection,
  and does not append a second success event; other stale versions return 409.
- Transaction-start/audit/write failures roll back that transaction, return a
  sanitized failure and never trigger mail before the preparation commit.
  Known commit rollback is failure; lost commit acknowledgment is explicitly
  unconfirmed until refreshed. Mail failure AFTER preparation never claims rollback:
  pending identity remains; return `invitation_delivery_failed`, audit failed delivery
  and offer deliberate resend. Failure of the completion transaction leaves delivery
  unconfirmed even if mail was physically received; the proof remains unusable.
- Audit create/reissue/revoke/accept/delivery and later role/deactivation/reactivation
  with actor, target, timestamp, outcome, correlation and bounded facts; record
  fixed action reason, old/new values and version where relevant. No free-text
  justification form is required by current authority. Failed/denied security
  attempts use sanitized security events outside rolled-back mutations, never
  fictitious successful domain audit. No tokens, hashes or mail contents in logs.

## 7. React and supplied design

One protected Router destination `/access/users` with account list and invitation
section, invite dialog and revoke confirmation. No separate detail or invitation
route. Admin navigation links only to implemented screens. Auth/session states:
anonymous → login; pending OTP → verification; valid non-Admin → explicit denied
view with identity link; expired → login; backend unavailable → retry state,
never a fabricated logout or a successful action.

References inspected: `docs/inspiration/users/users.png` and
`user-add-edit-modal.png`, plus auth references and current design inventory/audit.
Use their list/card/dialog composition and approved v3 navy/blue, Inter and radii;
existing customized shadcn Button is the control seam. Omit sample rows, DEMO,
Partner, affiliation and unimplemented sidebar destinations. Invite form uses
email + three-role selector; no profile editor inferred from image filename.
Applicable inspiration exists; no missing visual decision blocks this first slice.
Human visual/accessibility acceptance remains outstanding.

Router owns route/filter/page search state. Query owns session and lists with keys
`['access',principalId,'users'|'invitations',normalizedFilters]`; query functions
consume AbortSignal. No mount-fetch Effect, duplicate Context store, persisted
cache or sensitive route-loader snapshot. Mutations have retry=false; disable
repeat submissions; refresh both lists after success OR known partial delivery
failure. On conflict refresh before another confirmation. Clear/cancel access
queries on logout, identity change, 401 and loss of Admin authority; ignore late
responses for old principals. Revalidate identity on protected navigation/focus
using A1 boundaries; offline or unavailable identity masks sensitive controls/data.
401 clears session; 403 removes Admin access and fetches current identity.

Provide French loading, empty, validation, unavailable, conflict, delivery-failed
and unconfirmed states. Accessible names/labels, visible focus, keyboard operation,
dialog focus trap/return, Escape/cancel, pending feedback and error announcement;
reflow at 375px/zoom without losing actions. No optimistic privilege changes.
PWA stays INSTALLABLE_ONLINE_ONLY: no sensitive service-worker/browser-storage
cache, offline actions or replay on reconnect. Interrupted requests show unknown
outcome and refresh, never guessed success. No polling/session dashboard added.

## 8. Applicable security controls

Twelve affected controls from baseline 03; this is slice traceability, not a second
security catalog or a claim of PSSIE/RSPSL conformity. Six external dependency
groups E1–E6 retain their baseline owners and evidence requirements.

| Control ID (MJL-SEC-) | A2 obligation / enforcement | Verification | External dependency |
| --- | --- | --- | --- |
| 01 | Scope/policy ownership; no implied acceptance | §11 gates/review | E1, E6 |
| 02 | Explicit internal REST/OpenAPI; bounded DTOs | C03/C15 | E6 delivery |
| 03 | Unique invitation-only identity; exclusive role/lifecycle | C04–C08; later lifecycle tests | PC1, LA2/LA3 |
| 04 | Preserve password+OTP for all roles | C01/C04 | PC1, E3 mail assurance |
| 05 | Active verified context, CSRF and immediate stale-context denial | C01/C02/C09; §5 | PC2, E2/E3 |
| 06 | Technical Admin only, deny direct/non-Admin access | C01/C03/C04 | LA3; business checks A4 |
| 07 | Validation, versions and race/replay defenses | C05–C09/C15 | None for synthetic slice |
| 09 | Transactional append-only redacted evidence | C10/C11 | E1 retention, E4 operations |
| 10 | Reuse proof/password primitives; no exposed secrets | C02/C03/C11 | E2/E3 TLS/keys |
| 11 | Minimal email/role/state projections | C03/C11 | E1 legal/data owner |
| 13 | Query isolation; no offline persistence/replay | C12–C14 | E2 connectivity |
| 14 | Focused contract/schema/browser checks and independent review | C15/C16 | E4/E6 release evidence |

Financial integrity, files, hosting, migration and release-wide controls remain
baseline obligations in their affected slices; A2 creates no financial/file surface.

## 9. Recommended authorization boundary

**A2.1 — Admin invitations and account listing**: R1–R5, five endpoints, two
schema changes, one Admin view, same A1 acceptance/password/OTP for all three
ordinary roles, transactional audit and isolated synthetic tests. This is an
end-to-end usable journey even without any business module. All policy/database/
loopback/test-mail restrictions remain fail-closed. No real accounts permitted.

**A2.2 — Ordinary account lifecycle changes**: R6–R8 after LA3 and a reviewed
consistent auth/account lock protocol. Extend the same view, one PATCH and existing
invitation POST; no separate infrastructure slice. LA2 Admin lifecycle remains
outside both slices unless separately authorized; no implied A2.3 or recovery work.

Lean scope map: endpoints serve the actual list/invite/resend/revoke journey;
P1 prevents stale mutations; P2 preserves required security evidence; shared role
authentication enables invitees to log in; Admin guard protects account data;
one route/dialogs implement supplied composition. Everything else is deferred.

## 10. First-slice acceptance checks

Sixteen future gates; none run during this documentation review. Use isolated
PostgreSQL/test mail and synthetic identities, tearing down all disposable data.

| ID | Exact oracle / focused verification |
| --- | --- |
| C01 | Directly call EACH Admin endpoint with anonymous, pending OTP, expired/inactive Admin and each verified non-Admin: 401/403 as §3, zero unauthorized mutation/mail/list disclosure. Valid Admin succeeds |
| C02 | Missing/wrong CSRF, foreign Origin/Host and existing endpoint abuse limit reject; all access responses including errors are no-store; no development-policy bypass or real email accepted |
| C03 | Lists expose only fixed DTOs; pagination limits, filters, stable order, invalid parameters and guessed IDs obey authorization; no entity selector, hashes, proof/generation/context/OTP or raw errors |
| C04 | Parameterize all three business roles: Admin invite → private mail → readonly-email password setup → password+OTP → identity with exact stored role; recipient role forgery/Admin role request denied, no business authority granted |
| C05 | Concurrent normalized-email duplicates yield one User/invitation and one send; existing pending/active/inactive/revoked identities follow §4 without accidental reactivation |
| C06 | Expired/invalid/revoked proofs fail; successful acceptance consumes once; repeat/concurrent acceptance produces no second activation/audit success |
| C07 | Eligible resend rotates proof, preserves role, increments version; old proof and stale version fail. Consumed/revoked/Admin-target resend rejected; no automatic send retry |
| C08 | Revoke pending proof succeeds once; repeated revoked no-op adds no success audit; consumed/stale revoke conflicts. User stays pending and cannot log in |
| C09 | Two-connection barriers exercise accept/revoke, resend/accept, two resends and revoke/late-mail completion: exactly one eligible transition per version; late completion cannot restore access. Include bootstrap closed/reissue-original-Admin-only regression after ordinary users exist, and lock timeout/deadlock detection |
| C10 | Inject preparation/audit/commit failure: no partial committed mutation or precommit email. Inject postcommit mail/completion failure: truthful failed/unconfirmed delivery, unusable prepared proof, deliberate recoverable resend, no false rollback |
| C11 | Query DB audit: actor/target/time/correlation/action/outcome and allowlisted role/state/version/generation facts survive rotation; mutation+audit atomic; update/delete audit denied; secrets absent from DTOs/logs/events |
| C12 | Focused real-browser Admin list→invite→status→revoke and recipient acceptance/login journey; empty/loading/error/conflict/mail-failure states and confirmation are usable in French |
| C13 | Browser logout/account switch/revoked principal clears and cancels sensitive Query results; late response cannot repopulate prior principal; non-Admin direct route denied; unavailable backend does not grant authority |
| C14 | Keyboard/dialog focus/reflow checks; offline masks sensitive state and sends nothing, interrupted request claims no success, reconnect replays no mutation; Cache Storage/browser persistence contain no sensitive access data |
| C15 | Generated OpenAPI exactly matches six defined responsibilities only when their slice is implemented (five in A2.1), DTOs/errors/security documented; Alembic upgrade existing synthetic A1 data + constraint/append-only checks; PostgreSQL races use real connections |
| C16 | Focused changed-surface pytest/frontend unit/Playwright pass; Ruff check/format, mypy, ESLint, Prettier, Stylelint and frontend build pass. Isolated Docker integration proves real API/proxy/PostgreSQL/mail boundary then cleanup; no historical/full unrelated suite |

README owns actual check commands; implementation must select named tests matching
these oracles, not satisfy C16 with empty collection or mocked-only database tests.
Later A2.2 must additionally test active-role/deactivation changes, old verified and
pending-OTP denial, assignment/history guards, in-flight races, audit rollback and
inactive re-invitation; those tests do not authorize implementing them in A2.1.

## 11. Decisions, timing and genuine blockers

| Decision | Timing | Owner / required outcome / affected scope |
| --- | --- | --- |
| PC1 | BEFORE_REAL_ACCOUNT_ENABLEMENT | Sponsor/RSSI approves password/normalization/invitation/OTP/abuse/pre-auth policy. Existing A1 synthetic fixtures suffice for A2.1; no new numeric policy assumed |
| PC2 | BEFORE_REAL_ACCOUNT_ENABLEMENT | Sponsor/RSSI approves concurrent sessions and foreground activity. Preserve 24-hour limits and invalidation invariant; no real-account cutover |
| LA2 | BEFORE_AFFECTED_IMPLEMENTATION | Sponsor/RSSI decides additional Admin provisioning, self-role/deactivation/access loss, last usable Admin and sole-Admin recovery. All excluded here; required before real operator dependence |
| LA3 | BEFORE_AFFECTED_IMPLEMENTATION | Domain owner with RSSI decides ordinary role/deactivation/re-invitation handoff for current coordination assignments and historical contributors under DEC-087–090. Gates A2.2, not empty A2.1 |
| E1–E6 | BEFORE_REAL_ACCOUNT_ENABLEMENT for applicable data/mail/identity and E4 sensitive-environment safeguards; LATER_SLICE for E5/E6 contractual deliverables; PRODUCTION_ONLY for remaining deployment/release evidence | Baseline owners: legal/data/RSSI, DSI/hosting, key/mail operator, security/operations, client/data owner, delivery/client. Baseline evidence and approvals remain outstanding; no production work authorized |

No decision is classified BEFORE_A2_AUTHORIZATION: **zero first-slice blockers**.
Two before-affected-implementation decisions (LA2/LA3), two named before-real-account
policy decisions (PC1/PC2), zero additional LATER_SLICE decisions; six external
security dependency groups. LA2's real-operator dependency is additional to PC1/PC2,
not waived by that count. Ordinary role/deactivation contracts are **DEFERRED**.
Email/profile edits, free-text reasons and undoing revoked invitations are excluded
feature requests, not invented mandatory decisions. No legal or production audit
is required to finish this synthetic-development readiness review.

## 12. Independent review and verdict

**Engineering review: PASS. Security/specification review: PASS.** Independent
source and draft reviews confirmed the bounded A1 extension, two schema changes,
transaction/race contract, Query ownership and preserved policy gates. Findings
were incorporated: Admin/auth separation, access middleware coverage, original
bootstrap-target selection, generation/state-safe delivery, binding facts in audit,
no pending-account deactivation, and precise external-gate timing.

**A2_READY_FOR_AUTHORIZATION** applies to A2.1 only. Zero first-slice blockers;
A2.2 remains separately gated. Readiness never authorizes implementation.
No runtime/test/schema/database/dependency/Docker/CI/skill files changed; no runtime
suites were run because this is documentation-only. No new durable lesson was
identified; `tasks/lessons.md` remains unchanged under the allowed mutation scope.
