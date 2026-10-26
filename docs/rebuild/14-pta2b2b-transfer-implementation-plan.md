# PTA-2B.2B implementation plan: cross-year Activity transfer

Planning only; separate implementation authorization required. Authority: DEC-112,
[readiness](11-pta2b2-withdrawal-transfer-readiness.md), AGENTS.md and standards
02/03/DEC-102. This follows completed/reviewed
[withdrawal plan](13-pta2b2a-withdrawal-implementation-plan.md). Independent
engineering and security/specification plan reviews: PASS after focused re-review.
PTA_2B2_TRANSFER_READY_FOR_AUTHORIZATION, with withdrawal completion a mandatory
pre-implementation dependency.
Withdrawal is not implemented yet; its eventual committed artifact is the required
predecessor. Do not invent its completion hash or run this slice automatically.

## 1. Scope and dependency gate

Transfer an approved synthetic Activity to a strictly later start year in the
same active Project, preserving Activity/reference, Operations/allocations,
contributors and current coordination. Submit a dated reasoned request, pause,
get fresh Supervisor then distinct Validator approval, and activate placement
atomically. Returned requests are corrected/resubmitted; reasoned Agent
cancellation restores source. No separate persisted transfer-draft phase: request
opening and submission are one action. This makes pause start when approval is
sought and avoids a new workflow or unapproved timing choice.

No cross-Project/Partner/backward moves, budget changes, Operation changes,
withdrawn/closed/unapproved Activities, execution, money transfers/reallocation,
real accounts or reports. An amendment or withdrawal request must be resolved
before transfer. Any further forward move follows the same rule with a new
request and fresh approvals; no undo endpoint. PC1/PC2 remain pending.

Before edits inspect actual PTA-2B.2A completed diff/contract and record its commit,
revision/guard manifest and test evidence. Reconcile any changed technical seam
with this plan; stop affected work if substantive discrepancy exists. Reuse A's
per-mutation `planning_lifecycle_fixture`, proven no-import/no-execution environment,
exact schema/provenance checks and financial fail-closed boundary. Do not add a
second eligibility system. Unknown execution/responsibility capability denies.

## 2. Persistence (one migration after withdrawal; no new tables)

Proposed migration `0009_pta2b2b`, predecessor `0008_pta2b2a` (confirm exact accepted
name at dependency gate). Add nullable Activity `transfer_id` and nonnull integer
`placement_year`, initialized from existing current PTA.year. Keep immutable
`request_year`, `request_project_id`, actor/key/fingerprint unchanged. Replace the
current ancestry FK with `(context_id, pta_id, request_project_id, placement_year)`
referencing existing `pta_annual(context_id,id,project_id,year)`. Original Project
is still fixed. Enforce year range and planned_start's year = placement_year;
working dates stay effective/source until activation. Existing same-year validation
must use placement_year after transfer, not immutable request_year.

Database protection must prevent alteration of original request provenance during
any Activity update; add a narrowly scoped trigger for immutable request actor,
Project, year, key and fingerprint (do not rely only on Python). Keep the original
create-request unique key and scope. Update exact manifest to include any added
trigger/function. Do not relax trusted MJL ownership or add generic tenant fields.

`transfer_id`, `withdrawal_id`, `amendment_id` are mutually exclusive. Reuse review
states and immutable revision/decision tables. Pending transfer holds approved
base, and current points to the candidate; cancellation restores current=approved,
clears transfer_id and leaves working rows/placement unchanged. Approval sets
current=approved=candidate, state approved, clears transfer_id, changes placement
and working dates atomically. No other working structure changes.

Each submission clones the approved structural snapshot and frozen labels, updates
only dates and fresh submitter/time/contributors, normalizes obsolete purpose
metadata, and adds:
`transfer: {id, reason, base_approved_revision_id, source_pta: {id, year}, target_year}`.
Snapshot `pta = {id: null, year: target_year}` means intended annual placement before
target creation. This nullable ID is permitted **only** for transfer-purpose
snapshots with validated same-Project ancestry; old snapshots remain unchanged.
Activation audit binds the actual target PTA ID. Historical transfer snapshots
remain immutable with null ID, even after activation; never patch them afterward.
Snapshot Project is authoritative fixed ancestry, target year is reviewed intent;
nullable ID is never permission to omit resource authorization.

Update strict RevisionSnapshot/DTOs/renderers and validation so a transfer's
approved snapshot exposes target year, source context and resolved current PTA
from Activity separately. Existing snapshot `pta.id` is not globally made optional:
reject null for initial/amendment/withdrawal snapshots. A later same-year amendment
or withdrawal builds its context from actual current PTA while preserving approved
structure; do not propagate the historical transfer's null PTA ID/current purpose
into a different-purpose submission. Fingerprint includes purpose/base/source/
target/reason/dates and content; use current revision numbering and byte limits.

Deferred constraints validate group/base/source placement, target > source year,
dates ordered and start year target, same fixed Project/MJL, unchanged Operation
IDs/content/amounts, fresh chain and the correct final placement on activation.
Retain exact content-base chain and no-withdrawal-as-content protection. After
activation validate approved snapshot year matches actual placement. Old initial
snapshots/decisions remain byte-identical; approved history never gets moved by
rewriting rows. Wrong/null keys, mixed purpose and stale source deny via SQL.
Downgrade refuses any transfer evidence; clean downgrade only restores predecessor
constraints with validated original placement. No speculative financial fields.

## 3. API contract (two new POST routes)

Paths under `/api/v1`, existing cookie/Origin/CSRF. Reuse withdrawal plan's strict
DTO/error/version/replay behavior and existing scoped revision/history GETs.

1. `POST /activities/{id}/transfers` body `{expected_version,
   expected_approved_revision_id, reason, planned_start, planned_end}`. Target year
   derives from ISO date-only planned_start, never a conflicting browser PTA ID.
   Initial call requires approved/active Project/no pending purpose; server
   generates group ID and inserts next immutable submitted revision. On correction
   require additional `transfer_id, expected_revision_id` matching current returned
   request; changed reason or dates required. No budget/Operation fields accepted.
   Year > current placement, range 2000–2200, end >= start. 201 RevisionOutput,
   new Activity version and Location at existing revision detail.
2. `POST /activities/{id}/transfers/{transfer_id}/cancellation` body
   `{expected_version, expected_approved_revision_id, expected_revision_id, reason}`.
   Agent only, every pending/returned stage, same group/base/current. 200 Activity
   projection; audit reason/current revision, restore pointers/clear group, no
   target creation or Operation rewrite.

Existing revision decisions dispatch explicitly on transfer purpose. Same current
role/contributor/distinct-reviewer checks, reasoned returns, fresh resubmission,
no requested_amount. Role changes cannot revive obsolete sessions or remove old
contributors. Existing ordinary PATCH/submissions/amendment/withdrawal paths reject
pending transfers rather than treating shared returned states as editable content.
Assignment commands retain existing current-role/version semantics while pending;
transfer approval retains the assignments current at commit (old snapshot list is
historical, not a command to restore old assignments).

Destination preview uses existing Project/year context, nullable target PTA. Do
not create target until final approval; existing target reused, missing target
created once under unique Project/year. No new PTA creation API. On final approval
write target (if absent), decision, current placement, working dates, pointer/state/
version and audit together. Same Activity/Operation identities and exact XOF remain.
Future same-year edits validate new placement_year. Original create replay checks
immutable original request tuple/fingerprint and returns same Activity now placed
elsewhere, without re-running a move or creating another Activity.

Extend Activity DTO with pending transfer source/target/reason/group/base/current
and pause, while keeping effective source `pta_id`, dates and approved projection
until activation. Histories include reasoned cancellations and transfer decisions,
with source/target year and original frozen content. Scoped revision detail remains
accessible after moves through stable Activity ID; source history links use it.

## 4. Atomicity and historical annual contribution

Reuse advisory-first auth/guard order from withdrawal; then Project, both existing
PTAs sorted by ID, Activity, revision/children. Resource identifiers may be read
without row locks after advisory to determine order, then locked/revalidated.
Missing-target serialization uses Project/advisory plus unique constraint. Do not
lock a resource before advisory. All business mutations must respect this order;
no change to read-only authentication behavior is required.

The annual contribution helper/API from withdrawal already selects the latest
final-approved revision as of time. Transfer replacement contributes to its
snapshot target year, initial/amendment approvals to their own frozen year;
withdrawal contributes zero. Query all Activities in the fixed Project regardless
of today's PTA, otherwise old source contributions vanish. Unapproved/cancelled
transfers do not count. Consecutive content/transfer/withdrawal approvals form the
history; use revision_number ordering and decision effective times. No copies or
financial spending migration. Update snapshot parsing for the bounded nullable
target ID; year attribution never depends on a present target ID in old snapshots.

Current/as_of planning totals remain single-query consistent. Test source and
target together using one database snapshot in deterministic read races; separate
HTTP calls may legitimately straddle a commit and must not claim simultaneous
consistency. Each HTTP response must be internally coherent. UI invalidates both
annual contexts and reconciles each after success/uncertain outcome. No global
reporting API/page is introduced to manufacture cross-request atomicity.

Apply/verify plan 13's shared advisory read protocol to existing
`GET /projects/{id}/ptas/{year}` and `GET /ptas/{id}/activities`: acquire
`pg_advisory_xact_lock_shared(1843201)` before auth/row locks and hold through all
lookup/count/page/child/summary reads and DTO materialization. No lock upgrade.
Every transfer/creation/approval writer already takes the exclusive lock first.
Thus a target cannot return `pta:null` with a post-transfer positive contribution,
and a source list cannot retain a moved Activity selected before later ID-only
row locking. Test public HTTP handlers with barriers after nullable PTA lookup
and after list membership/count selection, in both read-first and activation-first
orders; assert PTA identity, count, cursor membership, dates, pointers and amounts
are all from the permitted serial state. Confirm PostgreSQL waits at advisory,
not a deadlock later at authentication/Activity locks.

Audit request/return/correction/cancel/approval with exact source/target/project,
base/new revision, request identity, actors/reason/time/versions. Resolve actual
target PTA ID into approval audit; original snapshots remain frozen. Inject audit,
constraint and outer-commit failures: rollback must remove only the target created
by that transaction, never a pre-existing target, with no orphan decision/history.
Use maximum payload checks and deterministic both-order races, not assumptions.

## 5. React workspace

Add `Transférer vers un autre PTA` confirmation showing source year, proposed target
dates/year, unchanged Operation/budget summary and required reason. Submit opens
and requests review together; local unsaved form state is not a paused Activity.
Reviewers see exact source/target and revision. Returned corrections use the same
dates/reason form; `Annuler la demande de transfert` retains history. Use existing
Project/year preview, no standalone selector/page or editable Partner/Project.

After approval navigate/link to current target context through Router; stable
Activity detail/history links still work. Show prior source/target years in
history. Reuse v3/inspiration, accessible dialogs, French loading/error/conflict
and Sonner. Query invalidation covers source/target PTA context and lists, Activity/
current/history. Extend uncertain-response reconciliation matcher for transfer
paths, block stale controls during refetch, and preserve session generation checks.
No offline sends, automatic replay/retry, persisted cache or duplicate server state.

## 6. Verification and predecessor cutover

Execute **16 readiness gates C01–C08/T01–T08**, plus withdrawal focused regression.
Extend existing route/PostgreSQL/browser fixtures with disposable synthetic data.
Include original create replay after 2 transfers; later amendment and withdrawal
in target year; initial 100→approved amendment 120→transfer→later amendment→withdraw
as-of values; pending/cancelled exclusion; preserved Operation IDs and assignments;
nullable-target DTO and SQL-purpose negatives; inactive Operation labels.

Race both orders of transfer vs transfer, approval vs cancellation, creation of
same missing Project/year by another Activity, ordinary creation, Project close,
assignment, role/deactivation/recovery and historical reads. Observe PostgreSQL
lock waits with barriers and bounded timeouts; assert exact permitted serial
outcomes, one target, one final approval, no deadlocks. Every mutating path needs
audit/real-constraint/commit rollback assertions of complete rows/history.

C4b uses the actual accepted withdrawal artifact/commit, not 641ba13 or a manually
constructed predecessor schema. Create approved/amended/pending/cancelled/effective
withdrawal fixtures through that artifact, drain writers, migrate with DDL user,
exercise candidate under distinct non-owner runtime. Preserve facts/request keys;
prove manifest/provenance denial, old-artifact rejection and protected downgrade.
Do not support two runtime schema versions or leave old writers active.

Run focused A1–A3/PTA-1/2A/2B.1/2B.2A regressions, REST/OpenAPI, frontend unit and
real-browser forward transfer→return→correction→approval, cancellation/history and
source/target reconciliation/offline journeys. Run relevant Ruff/format/mypy and
ESLint/Prettier/Stylelint/build; record real counts/commands, not expected output.
Dispose only task-owned resources. Missing prerequisite/evidence blocks completion.

## 7. Mandatory independent handoff and completion

Separate **engineering and security/specification agents who did not implement**
lead a review-only phase after the candidate and evidence are ready. They inspect
DEC-112, readiness, both actual predecessor and transfer diffs, surrounding code,
migration/history/replay/provenance and raw check evidence. Treat implementer
claims as unverified. No edits or reviewer fixes; report severity, file/line,
impact, smallest correction and missing verification. No separate reviewer means
blocked completion, never self-review substitution.

Implementer fixes accepted findings, reruns affected checks and returns to the
**same reviewers** for focused re-review until all blocking issues/evidence gaps
are closed. Only then update completion/roadmap, inspect full diff, git diff --check,
commit and report `PTA_2B2B_COMPLETE` (otherwise `PTA_2B2B_FAILED`), 16/16 gates,
predecessor/migration/guard/race/history/replay/audit/browser/quality/review results,
commit/worktree and pending PC1/PC2. **Stop. No financial execution, reversement,
reporting module, Partner portal, Phase 4, real accounts or subsequent slice.**
