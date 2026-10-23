# PTA planning foundation and A4 readiness

Documentation-only review, updated 2026-10-23 after DEC-104–106.
**PTA_A4_FOUNDATION_READY_FOR_AUTHORIZATION**.
No implementation, schema change, real-account enablement or deployment is authorized.

## 1. Baseline and authority

[Authority](../mjl-authoritative-decisions.md), the [PTA brief](../mjl_codex_authoritative_pta_change_brief.md)
and DEC-087–090 govern business meaning. Engineering Standard 02/DEC-102 and
security baseline 03 govern implementation. The roadmap records A1, A2.1, A2.2
and A3 complete; A3 records 200 PostgreSQL cases and independent review. This
review inspected current auth models/service/policy and completion records; it
did not rerun those tests or establish application acceptance.

`auth_user` has one exclusive role and credential version, but no entity binding.
`AuthService.lifecycle_eligible` accepts exactly eight public ordinary tables and
Alembic `0004_a3`, with explicit `mjl_test_` database attestation. Both A2.2 and
A3 depend on it. Adding business tables currently denies recovery as well as
lifecycle mutation. Existing audit details have a narrow auth-only allowlist;
business audit facts cannot simply be passed through it unchanged.

## 2. Proposed exact slice

**PTA-1 — Project, Annual PTA and draft Activity planning**, with resource-specific
A4 in the same slice. An ordinary synthetic Agent selects an active Project/year,
creates a complete planned Activity with one or more typed Operations and positive
integer XOF allocations, and reads it in that annual PTA. No submission, approval,
execution, finance or official KPI is introduced; draft allocation is never
represented as definitively approved money.

Include minimal Validator creation/read of Partner, Operation type and active
Project so an empty installation supports the journey without permanent seeds,
operator SQL or native Dolibarr dependencies. No general reference CRUD. Include
Project closure only for empty Projects: any Activity blocks closure in this
slice, since it cannot yet finish; future financial obligations must also block.
Reopening/deactivation remain deferred. Include Supervisor/Validator management
of Agent coordination assignments, not Agent access restrictions. Activity-specific
Supervisor/Prévalidateur and Validateur définitif assignments, submission and every
review action are deferred to the later approval-workflow slice. PTA-1 has no
temporary reviewer assignment or validation bypass.

## 3. Confirmed rules and future compatibility

One active Project per Partner; Validator owns Project creation/closure. Project
identity, original Partner and generated reference stay immutable. One annual PTA
per Project/start year, created atomically with its first Activity; never create
an empty PTA separately or accept standalone Activity creation. End year does not
change attribution. All Agents have equal trusted-context visibility/edit rights
subject to state. Planning includes at least one Operation; Activity allocation
equals their positive integer allocation sum. Suggested end is start + three
calendar months: preserve the original day when it exists in the target month,
otherwise clamp to that month's final day. This is calendar-date arithmetic, not
90 days or timezone arithmetic, and it does not carry an end-of-month flag. The
rule only supplies the editable planned end date for a newly planned Activity and
never overwrites a manual value. PTA-1 derives no duration or deadline from these
dates, so deadline inclusivity is not an implementation choice in this slice.

Keep creator/contributor identities independent of current roles. No review
endpoint exists in PTA-1; later exact-revision contributor checks must survive
role changes. Draft content need not be immutable, but future submitted/candidate
and approved snapshots must coexist without overwriting approved history. Do not
create unused revision/approval tables now. Cross-year transfer, late amendments,
two-stage review, execution/final spending, distinct financial authorizations,
external virement/reversement declarations, direct Agent closure, annual metrics,
Fiche, relance, optional documents and Partner portal remain later slices.
Unused allocation returns administratively to Partner, never to another Activity.

## 4. A4 action matrix

All rows require a fresh verified active session. The backend loads the one
trusted MJL ownership context and derives each resource's ownership through
server-side parent relationships; request bodies, paths, filters and cursors
cannot establish or override that context. Routes validate; use cases reauthorize
inside mutation transactions. Unlisted actions deny by default.

| Action/resource | Role and relationship | State | Negative oracle |
| --- | --- | --- | --- |
| Read references/Project/PTA/Activity/Operations | Agent, Supervisor, Validator in the trusted context | Existing resource, including historical Project | Forged context/parent IDs and cursors return no data; Admin denied business surface |
| Create Partner/type/Project | Validator in the trusted context | New active reference; Project requires eligible Partner with no active Project | Agent/Supervisor/Admin 403; second active Project 409 |
| Close Project | Validator in the trusted context | Active, no Activities or financial responsibilities | Agent 403; nonempty Project 409 |
| Create planned Activity and Operations | Agent in trusted Project/year context | Active Project, complete planning | Supervisor/Validator/Admin 403; wrong parent/year or closed Project rejected |
| Replace draft planning | Any Agent in the trusted context; assignment not required | Draft, expected version; start year unchanged | Foreign parent denied; stale version 409; approval-state spoof rejected |
| Manage Agent assignments | Supervisor or Validator in the trusted context | Draft Activity; active Agent targets | Agent/Admin 403; inactive/wrong-role target rejected; no reviewer target type exists |

No Partner identity provisioning/portal, business power for Admin, role switching,
reviewer assignment or review action. Future review mutations must require the
then-approved Activity-specific reviewer authorization and still enforce one role,
separation of duties, exact-revision contribution and no-self-validation.

## 5. Auth guard transition and concurrency

Before cutover retain exact eight-relation/0004 behavior. The reviewed PTA
migration introduces a singleton `mjl_ownership_context` relation plus the seven
business relations in §6. A restricted backend operator command, with no HTTP or
UI route, provisions exactly one fixed-kind `MJL` context only after the existing
literal `TEST_ONLY` policy and `mjl_test_` database-name provenance binding succeed
through the newly separated environment verifier. It must not call the old
eight-relation/0004 lifecycle predicate after migration. In one transaction the
command takes advisory lock `1843201` first and inserts or verifies a fixed primary
key whose database `CHECK` permits only the literal `MJL`; the check plus primary
key enforce one row even against direct SQL. The command is idempotent only for
that same verified singleton.
Missing, duplicate, differently keyed or unreadable context fails closed. This
record is application ownership configuration, not a tenant selector or demo row.
The command requires a bounded controlled operator identity and reason and writes
one redacted `ownership_context.provisioned` event through the existing append-only
audit storage in the same transaction as first creation. Audit failure rolls back
the context; an idempotent verification creates neither another context nor a
duplicate success event. A failed attempt has no success audit and emits only the
protected redacted failure event required by the security logging contract.

Business use cases load that singleton server-side. Root rows reference it with a
non-null FK; child ownership is propagated and checked through restrictive parent
relationships/composite FKs. No DTO, path, cursor or client cache accepts a context
identifier. The one context makes every active ordinary business identity eligible
for the same application scope while technical Admin remains excluded from business
mutations; no user-context mapping or generic tenancy module is introduced.

The matching code release replaces the auth-only manifest with the exact approved
expanded relation/kind/schema set and exact migration head, never an open-ended
allowlist or schema-prefix exception. Verify the singleton, mandatory keys, checks,
FKs and Agent-assignment model definitions, not just table names. Keep literal
`TEST_ONLY`, exact disposable DB attestation, synthetic emails and PC1/PC2
restrictions. Unknown, missing, extra or weakened schema fails closed; no runtime
DDL is allowed.

Separate environment/schema verification from account eligibility. A3 uses the
former, preserves all proof/version/state checks and does not deny password reset
solely because an ordinary account has assignments. A2.2 additionally checks the
target's authoritative assignment rows and any introduced outstanding workflow
responsibility. In PTA-1 every retained assignment blocks role/deactivation; no
completion/handoff inference. Unassigned accounts pass only when the verified
schema proves no other responsibility model exists. Historical contribution alone
is not an active assignment; retain it for later no-self-validation. Future review
or finance tables require a new manifest plus responsibility predicate and tests
before their release; advancing the revision alone is forbidden.

Reuse advisory transaction lock `1843201` first for business mutations and the
existing auth mutations that already take it. Preserve actual session guard order:
Context then actor User (`context`, service.py), then additional target Users in
sorted ID order, Partner, Project, PTA, Activity and child rows in fixed ID order.
Recheck session version/state/role/entity under these locks. OTP currently locks
Context → User → OTP without this advisory lock; do not claim otherwise. Business
paths must never lock User then Context, nor acquire the advisory lock after any
row lock. Recovery/delivery paths that lock User then proof must not subsequently
lock Context; credential-version invalidation remains logical, not eager Context
row updates. Prove session/OTP/business interleavings before enabling writes.
This coarse business serialization avoids a new lock framework or broad auth rewrite.

Assignment vs deactivation: assignment-first makes lifecycle return 409;
deactivation-first makes assignment reject inactive target. Role-change vs planning:
change-first rejects revoked actor; planning-first commits before revocation and
all subsequent requests fail. A3 password reset changes credential version and
invalidates pending OTP/session contexts exactly as now, preserving assignments.

Cutover is atomic at release level: stop all HTTP/background writers and drain mail
results; verify isolated provenance and the old exact auth schema; stage the matching
release artifact offline with no serving process; use that artifact to apply the
transactional PTA migration and run its restricted provisioning command; start only
matching workers with readiness/write admission closed; verify the singleton, exact
expanded manifest and separated environment-versus-lifecycle predicates; run
P17–P19/P24 plus focused A1–A3 regressions; only then admit traffic/writers. No old
worker may serve after migration and no mixed version may run. A2.2 checks
authoritative Agent assignment rows under the shared advisory-first transaction
and denies assigned or unverifiable targets. A3 accepts exactly the reviewed
expanded schema but does not treat an assignment as recovery ineligibility. Failure
leaves affected mutations unavailable; never loosen the guard to restore service.
No separate auth cleanup phase or real-data migration is authorized.

## 6. Minimal persistence, API and transactions

Proposed relations: MjlOwnershipContext, Partner, Project, AnnualPTA, Activity,
Operation, OperationType and ActivityAgentAssignment. Use restrictive FKs,
composite context/parent keys, unique Project/year PTA, partial unique active
Project per context/Partner, unique Activity/Agent assignment,
positive XOF integer checks, ordered dates, positive versions and required creator.
No floats; bound totals to an explicitly documented representable integer range.
Operation sum equality is enforced by the owning whole-Activity transaction, with
no independent Operation mutation endpoint. Preserve contribution history on draft
edits (minimum audit facts adequate for later reconstruction; never erase actors).

Use existing audit storage with a narrowly reviewed business detail contract for
context/resource/version, before/after changes and actor; preserve bounded payloads
and append-only behavior. If full changed content exceeds that contract, settle
its minimal persistence representation before affected code; no silent truncation.
Do not add a generic audit/workflow framework.

Proposed `/api/v1` responsibilities:

- GET/POST `/partners`, GET/POST `/operation-types`, GET/POST `/projects`;
  GET `/projects/{id}`, PATCH `/projects/{id}` for versioned empty closure only.
- GET `/projects/{id}/ptas`, GET `/projects/{id}/ptas/{year}` (absent context
  distinguishable from existing PTA); POST `/projects/{id}/ptas/{year}/activities`
  resolves/creates the PTA and inserts Activity/Operations in one transaction.
- GET `/ptas/{id}/activities`, GET `/activities/{id}`;
  PATCH `/activities/{id}` replaces complete draft planning with expected version;
  PUT `/activities/{id}/assignments` replaces Agent set with expected version.
- A bounded same-context eligible-Agent read for assignment controls; expose only
  necessary identity labels, never repurpose unrestricted Admin account listing.

All writes own one SQLAlchemy transaction with business audit and version advance;
helpers never commit. Lock Partner before active-Project uniqueness checks. Lock
Project before first-PTA resolution/closure; unique PTA constraint backs race safety.
Two distinct simultaneous Activities for one Project/year both succeed under one
PTA. Duplicate logical submission must return the prior outcome or conflict, never
a second Activity: include a scoped request key persisted on creation and reject
reuse with a different payload. Failed audit/constraint/commit leaves no orphan PTA.

401 unauthenticated, 403 forbidden role/CSRF, non-disclosing 404 unavailable scope,
409 stale/state/duplicate/eligibility conflict, 422 invalid input, sanitized 503
unavailable dependency. DEC-102 cursor envelopes default 60/max100, invalid limit
422; reject tampered/cross-scope cursors. Detail reads expose draft/version and
server-derived allowed actions; no cached client capability authorizes a write.

## 7. React journey and visual gate

Use v3 tokens, French labels, accessible shadcn/Lucide controls. Supplied references
exist at `inspiration/partners`, `projects`, `pta` and `activities/new-activities*`;
the older gap-analysis assertion that PTA inspiration is absent is stale. Confirm
actual screen/reference applicability before implementation; do not copy financial,
calendar, dashboard or approval behaviors merely pictured there.

Minimum reference creation dialogs for Validator; Project list/selection; Project
annual PTA context with empty state; complete draft Activity form/detail and small
Agent coordination-assignment control. Use Router parameters for Project/year,
Query for lists/details/options, local state only for unsaved forms/version. Shared
RestClient/Provider/useAPI, Sonner, localization and Helmet apply. Invalidate affected
Project/PTA/Activity/assignment queries after successful mutations; clear protected
state on auth changes and discard late responses. No optimistic authorization,
offline mutation queue or automatic replay. Include loading/empty/error states,
keyboard focus, mobile layout, exact F CFA and editable date suggestion.

## 8. Security evidence

Baseline 03 controls MJL-SEC-02/06/07: direct API role/resource/input tests and
OpenAPI. 03–05: invitation/OTP/session and immediate revocation regressions.
08: exact XOF, constraints, rollback and immutable contributor evidence. 09: transactional append-only audit and redacted log samples. 11: minimized
identity/resource disclosure; legal/retention confirmation before real data.
10: transport/key controls remain separately gated; no production secrets.
SEC-12 documents stay deferred/deny-all; SEC-13 protected cache behavior is tested
by P22/P23 and service-worker/cache inspection. P16 plus redacted logs demonstrate
SEC-09. No document route is opened. Verify least-privilege database
runtime credentials and no runtime DDL. This is a test plan, not PSSIE compliance.
PC1/PC2 remain pending and real accounts prohibited.

## 9. Implementation order after separate approval

Freeze the DEC-104–106 manifest/contracts, then implement schema + guard cutover
and deterministic auth/assignment races first. Implement narrow business use cases
and APIs with real transaction tests, then the minimum React journey. Run all
checks below and focused A1–A3 regressions. Hand off actual diff and evidence to a
separate review-only agent who independently reads requirements/code and distrusts
implementer claims. Implementer fixes findings; same reviewer rechecks. Blocking
findings/missing evidence prevent completion. Stop after PTA-1; no later slice.

## 10. Focused acceptance checks (24)

Each is a future executable gate, not a test result from this review. Use disposable
PostgreSQL API tests unless explicitly browser/unit; deterministic barriers rather
than sleeps for races. Assert expected test discovery and teardown.

| ID | Execution and oracle |
| --- | --- |
| P01 | Restricted provisioning creates the one verified MJL context and exactly one attributable redacted success audit in an empty disposable DB. Same-context retry changes neither; direct SQL insertion of a differently keyed/second context violates the database singleton constraint. Missing/unverified context denies business writes. Validator then creates references/Project and Agent creates and reads a complete Activity. |
| P02 | Parametrized real-HTTP checks cover every PTA-1 responsibility: unauthenticated, anonymous, pending, expired and revoked contexts reject; verified Admin cannot read or mutate business resources; Agent/Supervisor/Validator reads and writes match the matrix. Every mutation with missing/invalid CSRF or Origin returns 403 with no row or success audit, and the use case rechecks actor/session/role under its transaction locks. |
| P03 | HTTP DTO/OpenAPI reject every client context field. Within the singleton context, two independent Partner/Project trees prove forged parent/child IDs, mismatched ancestry, filters and cursors leak nothing and cannot cross-link resources. No second-context fixture or configurable tenancy seam exists. |
| P04 | First Activity creates one PTA for start year; second uses it; end-year crossing keeps original attribution. |
| P05 | Barrier concurrent first Activities: two Activities, one PTA, two creation audits, no orphan or 500. |
| P06 | Duplicate scoped request key: one Activity; altered payload conflicts; direct duplicate PTA insert rejected. |
| P07 | Concurrent Project creations for same Partner: one active winner; different Partners succeed. |
| P08 | Empty Project closure succeeds; any draft Activity blocks; close/create race cannot put Activity in closed Project. |
| P09 | Standalone Activity/PTA creation, mismatched year/parent, closed Project and client status spoof all reject. |
| P10 | Positive XOF integer boundary/sum exact; fractions, zero/negative Operations, empty Operations and overflow reject. |
| P11 | Pure unit and browser checks use date-only values: 2027-01-31→2027-04-30, 2027-02-28→2027-05-28, 2027-08-31→2027-11-30, 2026-11-30→2027-02-28 and 2027-11-30→2028-02-29. They reject a 90-day/timezone shift, preserve a manual end date and prove no automatic end-of-month carry. |
| P12 | Unassigned second Agent reads/edits draft; Supervisor/Validator cannot structurally edit. |
| P13 | Supervisor/Validator can replace only the Activity's Agent coordination set; Agent actor and inactive/wrong-role targets reject, duplicates reject, and assignment never changes Agent read/edit access. No reviewer-assignment type, review endpoint or validation status transition exists. |
| P14 | Two same-version draft/assignment writes: one success, one 409, no lost update; same transaction versions both. |
| P15 | Creator and edit contributors survive role changes; no approval endpoint/status injection can validate a draft. |
| P16 | Inject audit/constraint/commit failures for context provisioning and business create/update/close/assignment: complete rollback, no success audit/orphan. Provisioning retry creates no duplicate audit; protected failure events are redacted and contain operator/time/reason but no secret. |
| P17 | A2.2 unassigned ordinary succeeds; assigned or unverifiable fails; both assignment/lifecycle race orders prove serial safety. |
| P18 | A3 on exact PTA schema resets assigned ordinary account; unexpected/missing/weakened schema denies; expired/replay proof rejected. |
| P19 | Both role-change/planning and reset/planning orders deny obsolete sessions; login/OTP/deactivation regressions and deterministic Context→User vs business races complete without deadlock. |
| P20 | Generated OpenAPI exposes only the listed PTA-1 responsibilities, no review action or client context field, with exact auth/error schemas. Cursor default/max/invalid limits, envelopes and parent-scoped continuation are verified over HTTP. |
| P21 | Playwright covers Validator references → Agent PTA/create/read → Supervisor/Validator management of Agent coordination assignments; no review control appears. Verify keyboard/mobile/loading/error/empty states. |
| P22 | Browser Query invalidation refreshes lists/detail; logout/scope change masks cached data and ignores delayed old response. |
| P23 | Offline submission fails immediately; reconnect produces no delayed write; lost-response retry does not duplicate. |
| P24 | Offline matching-artifact cutover proves no old/mixed worker serves after migration. Fresh migration, separated `TEST_ONLY`/database provenance verification, singleton provisioning and exact expanded constraints/manifest pass; missing/different context, unsupported upgrade, extra/weakened schema fail closed. Focused A1–A3 regression suites pass and all owned disposable resources are cleaned up. |

## 11. Decisions and gates

| ID/classification | Owner and smallest decision/evidence | Affected scope |
| --- | --- | --- |
| DEC-104 RESOLVED | One backend-provisioned MJL ownership context; server relationships establish scope, all client context input rejects and unverifiable context fails closed. No generic tenancy. | A4 resource scope, migration manifest |
| DEC-105 RESOLVED | PTA-1 retains Agent coordination assignments managed by Supervisor/Validator. Activity-specific reviewer assignments and all review actions are deferred without bypass. | Assignment schema, lifecycle responsibility predicate |
| DEC-106 RESOLVED | Editable default planned end is start +3 calendar months with invalid-day clamp, date-only semantics and no end-of-month carry. | Date suggestion oracle |
| I1 BEFORE_AFFECTED_IMPLEMENTATION | Engineer freezes exact fields, integer limits, cursor/replay contract, bounded full business audit representation and applicable visual reference mapping under confirmed scope. | API/schema/UI |
| C1 BEFORE_CUTOVER | Engineer verifies disposable provenance, exact expanded schema and responsibility coverage, drained writers, all 24 gates plus independent review. | Guard replacement/mutations |
| R1 BEFORE_REAL_ACCOUNT_ENABLEMENT | User/RSSI resolves PC1/PC2, actual mail and security acceptance; current synthetic restriction persists. | All real identities |
| L1 LATER_PTA_SLICE | Business/finance/reporting/product owners resolve gap-analysis L1–L6/L8 only for affected future settlement, historical metrics, notifications, documents, accounting and templates. Reopening and incomplete drafts remain deferred. | Excluded branches |
| E1 EXTERNAL_SECURITY_DEPENDENCY | RSSI/legal/client owns baseline SEC-E1–E6 evidence; no presumed acceptance. | External assurance |
| D1 PRODUCTION_ONLY | User/operator approves provider/region, operational configuration and production controls separately. | Deployment |

## 12. Review and verdict

Independent engineering and security/specification reviews **PASS** after focused
correction and re-review. The corrections separated disposable provenance from the
obsolete auth-only schema predicate; made singleton enforcement, provisioning audit
and offline cutover exact; and added real-HTTP session/role/CSRF/Origin oracles.
Both reviewers found no remaining blocker and all **24/24** gates have concrete
behavioral oracles. Existing lessons were evaluated; no repeated correction or new
durable discovery required an entry. Documentation diff/whitespace checks passed;
runtime suites were deliberately skipped because no runtime changed.

DEC-104–106 resolve every pre-authorization business decision. I1 remains a
mandatory implementation-design gate, C1 a cutover gate, R1/PC1/PC2 a real-account
gate, and later/external/production decisions retain their named scopes; none blocks
authorization of isolated synthetic PTA-1 implementation. Only documentation
changed and no implementation, acceptance, compliance or production readiness is
claimed. **PTA_A4_FOUNDATION_READY_FOR_AUTHORIZATION**.
