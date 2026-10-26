# PTA-2B.2A implementation plan: Activity withdrawal

Planning only; separate implementation authorization required. Authority: DEC-112,
[readiness](11-pta2b2-withdrawal-transfer-readiness.md), AGENTS.md and standards
02/03/DEC-102. Runtime baseline `641ba13`, decision baseline `356cc76`.
Independent engineering and security/specification plan reviews: PASS after
focused re-review. PTA_2B2_WITHDRAWAL_READY_FOR_AUTHORIZATION.
Complete withdrawal only; stop before transfer or finance.

## 1. Bounded result and prerequisites

An Agent submits a reasoned withdrawal of an approved Activity; submission pauses
it. One eligible Supervisor then a distinct Validator decide. Either returns it
with a reason for correction/fresh review. Agent cancellation resumes the prior
approved Activity. Final withdrawal preserves approved content/history, ends all
coordination assignments and removes current annual planned contribution, without
returning/reallocating money. No restoration, drafts, real accounts or execution.

Read actual models/routes/service, auth service/policy, migrations 0005–0007,
planning/amendment tests, PlanningView/router/RestClient and supplied Activity
inspiration before edits. Capture HEAD/status. Apply local security/design/
confidence skills and TDD for behavior; no new dependencies or framework.

Before exposing any mutation, verify a task-owned disposable PostgreSQL/database,
loopback synthetic deployment and no imported/executed data. Reuse the existing
operator `lifecycle_database` attestation and test-only policy, but introduce one
explicit optional policy literal `planning_lifecycle_fixture = 'NO_EXECUTION_TEST_ONLY'`
(default absent/disabled). Operator may set it only after the no-import/no-execution
provenance review is recorded in completion evidence. Wrong/absent value denies
new commands without disabling existing A1–PTA-2B.1 behavior. It is configuration,
not client input or a substitute for database evidence.

On every request/correction/decision/cancellation, require both this literal and
`environment_verified` exact schema/version/ownership; no catches permitting
unknown evidence. Only reviewed planning schemas qualify. Extra relations,
missing constraints, unavailable evidence or unknown provenance reject 409
`eligibility_unverified` before writes. A future realization release must replace
this bounded proof with authoritative execution/obligation checks before enabling
these commands; updating the manifest alone must not enable them. Test an unknown
execution-capable schema as a denial, not a fabricated finance model.

## 2. Persistence and state contract (one migration, no new tables)

Add nullable UUID-string `withdrawal_id` to Activity in `0008_pta2b2a`. It is a
server-generated request-group identity, retained through corrections and effective
withdrawal, cleared only on pending cancellation. Add `withdrawn` state. Reuse
`submitted`, `prevalidated`, `returned_supervisor`, `returned_validator` for review.
The presence of `withdrawal_id` selects this bounded path; it is mutually exclusive
with `amendment_id`. Do not rename/refactor the old amendment model.

Each withdrawal submission creates an immutable ActivityRevision from the locked
approved content, with fresh submitter/time/contributors plus:
`withdrawal: {id, reason, base_approved_revision_id}`. Reason is trimmed 1–4000
characters. Copy the approved structural fields and frozen Operation type labels;
never rebuild historical content from possibly inactive reference values. Snapshot
fingerprint covers the canonical purpose/base/reason/content, not structure alone.
Keep existing revision numbering, size bound, decisions and contributor tables.
Original snapshots need no rewrite and missing withdrawal metadata means old flow.

| Situation | Activity pointers/state |
| --- | --- |
| No withdrawal | All existing PTA-2A/2B.1 rules unchanged; withdrawal_id null. |
| Pending/returned | withdrawal_id nonnull; amendment null; approved points to last content approval; current points to this group's submitted withdrawal revision, different from approved. |
| Effective | state withdrawn; same withdrawal_id/current withdrawal revision; approved still last content approval, never replaced by withdrawal snapshot. |
| Cancelled request | state approved, current = approved, withdrawal_id null; no Operation/content changes; request evidence remains immutable. |

Extend check constraints and deferred review trigger, not just allowed states:
validate same-Activity base/group, nonblank reason, exact approved content identity,
valid distinct review chain for the content base, correct current withdrawal chain
for each state, no withdrawal revision as `approved_revision_id`, and withdrawn
requires final withdrawal approval. Reject a withdrawal decision through ordinary
approval semantics. Retain final-decision distinctness and immutable triggers.
Invalid/null JSON keys must explicitly fail, not pass SQL UNKNOWN. Existing
snapshot labels/amounts must survive unchanged. Do not require amended content
metadata to disappear from a copied base: normalize new request-purpose metadata
so a revision has at most one current purpose, while retaining base linkage.

End current assignment rows with ended_at/ended_by only at final approval. Add no
financial flags/amounts. No Operation is removed/cancelled. Update exact schema
manifest and guard alongside the migration; downgrade refuses if any withdrawal
revision or request/cancellation/effective audit exists. No destructive downgrade.

## 3. API and behavior (two new POST routes)

All paths below have `/api/v1` prefix and existing cookie/Origin/CSRF safeguards.
Use strict DTOs and UUID validation; exact positive versions, no extra fields.

1. `POST /activities/{id}/withdrawals`: initial request or returned correction.
   Body `{expected_version, expected_approved_revision_id, reason}`; on correction
   additionally require `{withdrawal_id, expected_revision_id}` matching current.
   Initial call requires approved/no amendment/no other request/active Project;
   correction requires this group's returned state and a changed trimmed reason.
   Server assigns group ID only initially. Every accepted call inserts next
   revision, adds submitter as cumulative contributor, enters submitted, increments
   version once and audits in one transaction. 201 RevisionOutput plus Activity
   version and Location pointing to existing scoped revision detail.
2. `POST /activities/{id}/withdrawals/{withdrawal_id}/cancellation`: body
   `{expected_version, expected_approved_revision_id, expected_revision_id, reason}`.
   Agent only, any pending/returned stage, exact current group/base/version/revision.
   200 ActivityOutput after restoring pointers and clearing group. Reason required;
   retain cancellation actor/time/group/base/current revision in append-only audit.

Read requests with existing scoped revision detail/history. Extend existing
`POST /activities/{id}/revisions/{revision_id}/decisions` with explicit withdrawal
branch. Supervisor prevalidate/return and Validator approve/return remain; require
reason on return, reject requested_amount for withdrawal. Reuse contributor and
same-prevalidator exclusion. Validate current actor/session/Project/environment/
group/base/version inside transaction. Personnel change preserves completed
eligible decisions; no reviewer assignment or staffing restriction.

Ordinary PATCH/submissions/amendment commands must reject pending/effective
withdrawal instead of misreading shared returned states. Assignment changes may
continue while pending under existing reviewer-role rules and version checks;
final withdrawal ends whatever assignments are current at commit. Assignment
commands reject withdrawn Activities. Project close remains `project_not_empty`.

Expose `withdrawal` metadata (group, reason, base, current revision, status and
final decision time where present), `execution_paused` for pending withdrawal or
amendment, and explicit `withdrawn` status after effect. Withdrawn is terminal,
not merely paused. Approved projection stays historical; allowed actions exclude
execution/edit/assignment/restore. Histories merge cancellation events into the
existing cursor ordering with kind-specific IDs; no full audit export is added.
All POST replays with used version fail 409, including uncertain commits; clients
refetch and never automatically retry. No idempotency table is necessary.

## 4. Transaction, audit and annual contribution

Acquire advisory `1843201` before any auth/resource row lock. In one owned
transaction: authenticate/guard, lock Project then Activity, current/base revision,
children in stable ID order; recheck eligibility and version; mutate/audit; commit
before success. Serialize with role/deactivation/recovery and existing planning
commands through the same advisory order. Read paths retain Activity shared locks.
No helper commit or network effect inside transaction.

Audit exact request/group/base/revision/purpose, actor/role/time, old/new state/
version and ended assignment IDs. Immutable snapshots supply request content;
cancellation retains its reason and current revision. Bound payloads in Python and
PostgreSQL; no repeated structural projections that exceed 1 MiB. Failed audit,
constraint or outer commit restores every row. Test real SQL constraints, not
only mocked exceptions.

Add a small planning projection helper for approved annual contribution. Extend
existing `GET /projects/{id}/ptas/{year}` with optional UTC `as_of` (offset required;
malformed/future timestamp 422), and `approved_plan: {as_of, activity_count,
allocation}`; allocation is exact integer decimal string. Omitted as_of resolves
to database statement time. This is planning totals, not a reporting module,
realization KPI, export or new page. Existing PTA/context fields retain meaning;
annual contribution is the only historical projection in this response.

One SQL statement/snapshot selects each Activity's latest committed final-approved
revision with decision time <= cutoff, ordered by revision_number (unique within
Activity), across the Project's full history, not today's page/filter or pointer.
Initial/content amendment approvals contribute frozen allocation to their snapshot
PTA year; a latest withdrawal approval contributes zero. Returned, pending and
cancelled requests cannot change totals. At no prior approval contribution is zero.
The selected revision's approved decision time is its effective time; no backdated
client times. The projection uses committed facts visible in its query snapshot;
no claim of historical reconstruction of uncommitted observations. Keep arbitrary-
precision SQL sums and wire strings. Preserve prior amended allocations (100→120)
and historical before/during/after withdrawal oracles. Whole-PTA totals never use
page/search filters. Validate trusted Project/MJL scope before data exposure.

For PTA context and Activity-list GETs, take transaction-scoped shared advisory
lock `pg_advisory_xact_lock_shared(1843201)` before authentication or any row
locks, and hold it until the entire response projection is materialized. Existing
writers take the exclusive counterpart first. This covers context PTA lookup plus
summary and list count/membership plus Activity/Operation projections; it avoids
inter-statement mixed state without changing isolation or adding infrastructure.
Only these bounded reads need the shared advisory; do not change every GET. Never
upgrade shared to exclusive in these handlers. Keep transactions short and perform
no external work while locked. Tests must prove both read-first and write-first
ordering using actual HTTP routes, including selection-to-projection boundaries.

## 5. Existing React workspace

Use approved v3 tokens and supplied Activity detail/history references. Add a
reason/impact confirmation for `Retirer l'activité`; submit immediately, no
persistent withdrawal draft. Show pending purpose, paused state, current approved
content, exact reviewed request and correction reason. Returned reason can be
edited/resubmitted; distinct `Annuler la demande de retrait` confirmation. Withdrawn
view is read-only with retained approved values and decision history; never say
money is returned. Reuse existing review controls with purpose-aware labels.

Use RestClient/useAPI, Router search, Query and Sonner. Extend uncertain-workflow
path matching/reconciliation to both new routes; refetch Activity/current/history
and PTA context before re-enabling controls after 409/network-unknown. Invalidate
planning and affected access lists when final withdrawal ends assignments. No
old-session response revival, local server-state copy or offline queue/replay.
Current annual planning totals may display in the existing PTA context; historical
as_of remains an API/test capability, not a new report screen. Keyboard, focus
return, mobile, loading/error and French copy belong in browser checks.

## 6. Verification and cutover gates

Execute all **14 readiness gates C01–C08/W01–W06** with the exact contract above.
Map each ID to actual tests/results in one concise completion record. Tests first
through public routes; use existing fixtures and a focused withdrawal test file.
Include all four pending/returned states, reason-only resubmission, both cancellation/
approval race orders, final assignment-ending versus role change, contributor
survival, direct-SQL purpose/null/base/chain corruption and max Unicode payload.

Use deterministic PostgreSQL barriers and observed lock waits, bounded timeouts,
not sleeps/SQLite. Race annual totals/detail/history against approval, inspect
before-or-after coherent results. Rollback injection covers initial request,
correction, both returns, prevalidation, final approval and cancellation, comparing
all touched rows and audit cardinality. No skipped race counts as passing.

C4a: exact `641ba13` predecessor artifact creates initial/approved/amended/cancelled
histories in fresh disposable database; stop old writer, migrate 0007→0008, use
distinct restricted runtime, prove byte-stable old facts and correct guard. Test
clean upgrade/downgrade and evidence-bearing downgrade refusal. Unknown schema,
missing provenance/literal and predecessor artifact on new schema reject. Record
artifact revision and database provenance, never secrets.

Run focused A1/A2.1/A2.2/A3 and PTA-1/2A/2B.1 regressions, OpenAPI, Ruff/format/mypy,
frontend unit/ESLint/Prettier/Stylelint/build and real-browser withdrawal return→
correction→approval plus cancellation/history journey. Derive commands from
current package/README, use only task-owned resources and tear them down. No
production mail/data, shared POC database or broad historical PHP suites.

## 7. Mandatory independent handoff and completion

After implementation and evidence, hand the full candidate to **separate
engineering and security/specification agents who did not implement it**. They
lead a review-only phase: independently read DEC-112, readiness/this plan, actual
diff/surrounding code and raw verification evidence. They must not trust the
implementer's explanations or passing-test claims, edit implementation, or fix
findings themselves. Require severity, file/line, impact, smallest correction and
missing-evidence findings; absence of a reviewer blocks completion.

Implementer fixes accepted findings and reruns affected checks, then returns the
candidate to the **same reviewers** for focused re-review. Repeat until blocking
findings and mandatory evidence gaps are resolved. Only then update status/roadmap,
review full diff, run git diff --check, commit and report
`PTA_2B2A_COMPLETE` (otherwise `PTA_2B2A_FAILED`), 14/14 gate evidence, migrations,
guards/races/audit/browser/quality/review results, commit and worktree. PC1/PC2
remain pending. **Stop; do not begin transfers without separate authorization.**
