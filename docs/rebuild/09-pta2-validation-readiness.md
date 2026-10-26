# PTA-2 — Activity validation, revisions and annual transfers

Documentation-only readiness review, 2026-10-26. **No implementation authorized.**
Business authority: [PTA brief](../mjl_codex_authoritative_pta_change_brief.md)
§§2–5, DEC-087/089/090/104–108, and the retained rules in functional
specification §§9–13, permission matrix §Separation of Duties and status model
§Activity Validation. Newer PTA rules override obsolete assignment-based Agent
access, post-start bans and terminal-forever approval. Code/tests establish the
baseline, never business approval.

## 1. Verified PTA-1 baseline

Completion commit: `70ff0f90cbd5083bef888128b5baab3534bf3d77`, parent `d5962c8`;
HEAD matched it at the initial review; decision closure follows documentation
commit `4f546e5`. Runtime remains unchanged. Source inspection
agrees with [PTA-1 status](09-pta1-implementation-status.md) and the roadmap:

| Existing seam | Verified behavior; material PTA-2 consequence |
| --- | --- |
| `backend/app/planning/models.py`, migration `0005_pta1` | Project → unique Project/year PTA → Activity → Operations; fixed `MJL` context with composite ancestry constraints. Activity has optimistic `version`, creator, request-key fingerprint and dates/amount, but no submitted/approved revision. Its database state is constrained to `draft`. |
| `planning/routes.py:create_activity`, `replace_activity` | First Activity creates the annual PTA atomically; scoped create replay; exact balanced positive integer-XOF Operations; retained removal tombstones. PATCH currently relies on the draft-only schema: expanding states requires an explicit editable-state guard in this same transaction. |
| `planning/service.py:principal`, `allowed`, `locked_mutation` | Verified ordinary role plus exact environment verification; Admin denied; advisory lock `1843201` precedes mutating session/row locks. `allowed` currently advertises Agent edit without a state test: change it with the new backend state guards. |
| `replace_assignments`, `ActivityAssignment` | Only Agent coordination assignments exist; Supervisor/Validator manage them. Unassigned Agents retain equal planning access. These are not reviewer assignments. |
| `auth/service.py:business_audit` | Exact bounded before/after business facts in the write transaction; the allowed Activity audit shape is currently draft-only. Creator and all committed edit actors survive in audit; current `Operation.updated_by_id` alone is not cumulative contributor evidence. |
| `auth/service.py:environment_verified`, `lifecycle_eligible` | Exact 16-relation `0005_pta1` manifest, revision and singleton; current Agent assignments block A2.2. A3 uses schema/provenance separately from assignment eligibility. DEC-108 introduces no individual reviewer assignment or pending-work lifecycle blocker; existing Agent assignment restrictions remain. |
| `PlanningView.jsx`, `planning.js`, `router.jsx` | Five planning routes, shared RestClient, Query cancellation/invalidation, offline denial, date clamp and exact display. Reuse the Activity workspace; no review UI exists yet. |

Project states are `active/closed`; closure currently rejects any Activity, which
is safe for this slice because approval is not execution/administrative completion.
Do not loosen Project closure when adding approval states. There is no execution,
settlement, amendment, transfer, business revision or reviewer-assignment model.
The prior 24/24 gate report is historical evidence; no runtime suite was rerun in
this documentation task. Historical `tests/e2e/activity-planning.spec.js` and
`api-activities.spec.js` clarify exact-revision review, cumulative contributors,
correction totals and race oracles only; their date/access/cancellation behavior
must not be copied.

## 2. Smallest useful sequence

Recommend **Option B**:

- **PTA-2A: initial validation.** Role-based review eligibility, first submission, both
  decisions, reasoned correction/edit/resubmission loops, immutable numbered
  submissions and the first approved snapshot; scoped history, concurrency,
  audit, lifecycle guard integration and the minimum existing-workspace UI.
- **PTA-2B: approved amendments.** Separate candidate and effective approved
  revisions, late amendments, affected-execution pause, withdrawal and annual
  transfers. Requires 2A plus the B2 decisions below. Recheck readiness separately.

2A is independently useful: an Activity reaches an immutable approval through a
complete correction-capable chain. Its approved state is read-only until a later
amendment implementation is authorized; this is a slice boundary, not a permanent
business prohibition. No amendment/transfer endpoints, placeholder controls,
execution flags, document machinery, aggregate PTA approval or generic workflow
engine belong in 2A. Cross-year changes are deferred in every state; existing
same-year late corrections remain possible without a date cutoff.
Operation removal before first submission retains PTA-1 tombstones. In 2A,
Operations included in any submitted revision cannot be removed/cancelled; edits
and additions remain available in correction. The retained dictionary §Opération
defers post-submission removal to the unresolved cancellation branch (L2). Do not
silently extend the current draft-removal API to those Operations.

## 3. Approved role-based review (DEC-108)

Confirmed actor codes: Agent `AGENT_SAISIE`, Supervisor/Prévalidateur
`AGENT_VERIFICATEUR`, final Validator `VALIDATEUR_DEFINITIF`. One effective role;
Admin has no planning/review power. All reads remain inside trusted MJL ownership
and validated parent relationships. Every active Admin-invited Supervisor or
Validator can review every Activity in that scope, subject to their stage,
current verified session, exact revision/state and contributor separation.
DEC-108 supersedes DEC-105's Activity-specific reviewer requirement only.
Pending invitations do not confer access; normal password/OTP login is required.

| Action | Actor / contributor rule | State and evidence |
| --- | --- | --- |
| Edit and submit | Any Agent in authorized MJL scope; no coordination-assignment requirement. Actual edits and submissions add lineage contribution. | Draft or returned correction; complete balanced plan; current version. |
| Prevalidate / return | Any active Supervisor, excluding creator, submitters and cumulative structural contributors. | Current submitted revision; return reason required. |
| Approve / return | Any active Validator, excluding contributors and that revision's prevalidator even after role change. | Current prevalidated revision and successful prevalidation; no bypass. |
| Change Agent coordination | Supervisor or Validator under unchanged PTA-1 rules. | Audited/versioned; no review eligibility is granted; no financial prevalidation invalidation. |
| Account invitation/lifecycle | Technical Admin through existing access functions. | No business decision privilege; deactivation ends access, preserves decisions and requires no Activity handoff. Existing Agent-assignment, self/Admin-target and provenance guards remain. |
| Read revision/decision history | Existing ordinary business readers in the Activity's trusted MJL scope. | Sanitized Activity-local chronology, not global audit export or Partner portal access. |

Multiple people may hold either review role. **One eligible Supervisor's
prevalidation followed by one eligible Validator's approval is sufficient**;
there is no all-reviewers vote, quorum, reviewer selection, claiming or individual
assignment. The first valid committed decision wins its stage/version.
Submission requires no preselected reviewers or nonempty reviewer pool. If no
eligible person remains for a required stage, the Activity waits without bypass.

Replacing, changing the role of, or deactivating a reviewer never erases completed
decisions or cancels a valid prevalidation. Another eligible identity continues
the remaining stage. Historical eligibility is captured at decision time; final
approval does not require the former prevalidator to remain active or keep that
role. It does require a successful prevalidation of the exact current revision
and a different final actor. Structural correction creates a new submission and
requires fresh prevalidation regardless of personnel continuity.

The user's Admin-created-directly-in-database statement is recorded as a separate
provisioning concern. This readiness recheck changes neither the guarded A1
bootstrap nor its security contract, and authorizes no direct SQL account writes.
The user approved keeping that issue separate; it is not a PTA-2A dependency.

## 4. Submission, correction and approval

Proposed storage codes map to the approved French meanings:

| Current state | Action → next state | Oracle |
| --- | --- | --- |
| `draft` | Agent submit → `submitted` | Freeze revision 1 and lineage contributors atomically; no approved pointer yet. |
| `submitted` | Supervisor prevalidate → `prevalidated` | Decision targets exactly current immutable revision. |
| `submitted` | Supervisor return → `returned_supervisor` | Nonblank reason; Agent receives correction directly. |
| `prevalidated` | Validator approve → `approved` | Same revision and successful prevalidation by a different eligible identity; set approved pointer atomically. |
| `prevalidated` | Validator return → `returned_validator` | Nonblank reason; goes directly to Agent, not back to Supervisor. |
| Either returned state | Agent edits, then submits → `submitted` | New immutable revision; genuine structural change; all review stages start again. |

Reviewers never edit structural fields. Submitted/prevalidated structures are
locked. Returned content is editable after planned start/end; no cancellation-and-
recreation requirement. A return is a correction decision, not an invented terminal
rejection state. Retain origin, reason and all prior decisions after resubmission.

Retained correction rules (functional specification §13 and status model):
Supervisor returns preserve the prior submitted total; Validator returns also
preserve it unless the Validator records an optional positive advisory requested
amount with the reason. That amount is neither a ceiling nor an exact mandate;
then any positive exactly balanced total is eligible. Apply this after start/end
as well. A no-op edit, coordination change or edit-then-revert is not structural
correction: compare normalized submitted content, excluding assignments, versions,
actors and timestamps. Do not silently drop these rules as legacy behavior.

Snapshots contain immutable context/Partner/Project/PTA/year identifiers and
relevant display labels, Activity reference/name/description/dates/XOF allocation,
ordered Operation IDs/type IDs and labels/names/amounts, Agent coordination
assignments at submission, submitter/time, cumulative contributor IDs and
role-at-submission facts, and content fingerprint. Do not snapshot the global
reviewer pool: current role/session determines eligibility for a new decision.
Review events retain actor/role/time, exact revision, stage,
reason, requested amount where applicable, and before/after state/version.

Cumulative contributors include creator, every submitter and every identity whose
structural change committed, including removed Operations and edits later reverted
(functional specification §10). Changing role never erases them. Assignment-only
management adds no structural contribution. No attachments are required; qualifying
document contribution remains a future Phase 4 integration obligation.

## 5. Minimal PostgreSQL and transaction proposal

This is the bounded design under approved DEC-108, not a schema authorization.
Reuse Activity,
Operation, User, ownership, audit and the existing transaction/advisory seam.
A single reviewed migration would add only the following concrete persistence:

- Activity revisions: unique `(activity_id, revision_number)`, immutable bounded
  typed snapshot, submitter/time and fingerprint, with context/Activity composite
  ancestry. Do not create separate generic snapshot/Operation-history engines.
- Revision decisions: exact revision and stage, outcome, actor/role/time/reason,
  optional requested amount and final decision's prevalidation reference.
- Cumulative Activity contributors: unique Activity/user identity, maintained
  transactionally on actual structural edits and submissions, immutable identity
  membership. Each revision freezes its contributor set. This avoids incorrectly
  treating the latest editor as the only contributor.

Extend `Activity.state` (widen its current `String(16)` for the proposed returned
state codes), add current-submitted and effective-approved revision
pointers with same-Activity FKs, and keep `Activity.version` as the aggregate
optimistic token for structural, assignment, submission and decision changes.
Pointers cannot target another Activity. Do not conflate revision number with
version: assignment changes advance version without changing financial content.
One current submitted candidate per Activity; one immutable decision per stage per
revision, enforced by a unique revision/stage constraint. Personnel changes do
not reopen a decided stage. Do not erase an old decision to make room. Only three
new tables are proposed; no reviewer assignment or review-attempt table.

Use bounded snapshot schemas with the existing 1–100 Operations, exact positive
XOF strings/BigInteger ceiling, name/description bounds and date-only rules.
Database constraints enforce uniqueness, same-Activity ancestry, allowed states,
required return reason and positive optional requested amount. Add narrow database
immutability protection for revision content and decision rows (runtime UPDATE/
DELETE rejected); snapshot content is never rewritten to record decision status.
No broad trigger framework or runtime DDL. Freeze exact DDL, bounded payloads and
pointer/decision constraints under I2 before implementation of these writes.

For pre-existing PTA-1 drafts, reconstruct cumulative contributors from creator
and committed structural changes in complete `activity.create`/`activity.replace`
audit evidence, including tombstones. PTA-1 records even unchanged PATCH saves:
compare normalized structural before/after content (including Operation identity,
order and removal), excluding versions, actors, timestamps and assignments. Add
the replace actor only if that event actually changed structure; an edit followed
by a later revert still contributes, but a no-op alone does not. Creator and every
submitter always contribute. Verify evidence coverage against aggregate mutation
history; fail the cutover if attribution is incomplete, rather than assuming
latest Operation author is sufficient or silently losing a contributor. No POC
imports or new demo data. New writes maintain membership atomically thereafter.

Every mutation uses one use-case-owned transaction: existing advisory lock
`1843201` **first**, then acting Context→User through current auth, other affected
Users in deterministic ID order, applicable parent/Activity rows, revision and
Agent-assignment/decision rows in deterministic order. Recheck session, role, scope,
contribution, current effective role, exact revision/state and expected
Activity version inside it. Helpers flush but never commit; route success is
returned only after transaction exit/commit. Existing read paths can lock
Context→User without taking this advisory lock; never introduce an Activity→User
path that reverses that order. Keep auth's already serialized login/OTP/reset/
lifecycle paths intact; prove interactions with deterministic PostgreSQL barriers.

| Mutation | Preconditions and atomic effect / audit |
| --- | --- |
| Structural correction | Agent, editable state, expected version, retained correction-total rule; existing Operation/tombstone writes plus cumulative contributor membership; existing `activity.replace` audit with expanded explicit shape. |
| Submission/resubmission | Agent, exact current version, editable state, validated full plan and changed-content rules; no reviewer staffing precondition; allocate next revision under Activity lock, freeze snapshot/contributors, update current pointer/state/version; `activity.submit`. |
| Supervisor decision | Current submitted revision and eligible active Supervisor noncontributor; append exact decision, state/version and `activity.prevalidate` or `activity.return_supervisor`. |
| Validator decision | Current prevalidated revision, valid linked prevalidation and different eligible active Validator noncontributor; append decision, state/version, approved pointer only on approval; `activity.approve` or `activity.return_validator`. |

All writes and audit roll back on constraint, audit or commit failure. Expand the
current strict audit allowlist explicitly; never relax it to arbitrary JSON.
Expected-version plus exact revision/state gives stale/replay rejection: duplicate
submission or decision returns 409 with no extra snapshot/decision/audit. After a
lost response, refetch current Activity/history to reconcile; do not automatically
replay. Preserve PTA-1's separate idempotent Activity-create request-key contract.

## 6. API and React scope for 2A

Proposed additions under `/api/v1/activities/{id}` only:

| Responsibility | Minimum contract |
| --- | --- |
| POST `/submissions` | Expected Activity version; backend freezes current plan, never accepts client-supplied approval/snapshot. |
| POST `/revisions/{revision_id}/decisions` | Expected Activity version, finite stage-appropriate decision, reason and optional advisory requested amount only on Validator return. Server chooses eligibility/stage. |
| GET `/revisions` | Scoped cursor history of immutable revisions with decisions; no global audit stream. |
| GET `/revisions/{revision_id}` | Exact authorized frozen content and that revision's decision chronology. |

Reuse Activity detail GET for state/version,
current-submitted/approved pointers and actor-specific allowed actions/review
eligibility. Reuse existing PATCH for corrections, with explicit state/amount
checks. No separate eligibility, correction, resubmission, review-page or generic
transition endpoints. Both POST decision stages still reauthorize independently.
DTOs forbid unknown context/state/role/approval fields; safe 401/403, scoped 404,
409 stale/ineligible, 422 invalid-input and sanitized unavailable errors. All
cookie mutations require existing Origin/CSRF checks and all responses no-store.
Lists default to 60, max 100, invalid limits 422, signed parent-bound cursors and
`count/data/next/previous/object: "list"`; reuse cursor helpers.

Extend `/activities/$activityId` with current state, exact revision, review
progress, read-only submitted/approved content, and an Activity-local history
section. Reasoned return and confirmation use accessible dialogs,
not new pages. Show proposed and approved amounts distinctly; no approval means
no official approved value. Only permitted real server actions appear. Correction
shows originating reviewer/reason and any advisory amount; resubmission clearly
starts prevalidation again.

Visual sources inspected: `activities/activities-details.png` (programming and
budget panels), `activities/activities-history.png` (chronology), and
`confirm-modal.png` under ignored `docs/inspiration/`. Reuse those compositions,
existing dialogs and v3 tokens/component contracts; omit their finance, relance,
PDF and document controls. No separate new review layout is needed. Confirm the
same local inspirations exist at implementation time; missing files block the
affected screen only. v3 governs colors, Inter, spacing, focus and non-color
state cues. DEC-102 requires RestClient/Provider/useAPI, Query, Sonner,
localization and Helmet. Router owns history selection/search; Query owns remote
state. Keep only editable forms/dialogs local, with retained server version.

After mutations invalidate Activity, revision detail/history and affected PTA/list
queries. Cancel/mask stale responses on logout, role/scope loss or offline events;
no persisted business cache, queued replay or optimistic local approval. Test
keyboard containment/focus return, mobile, empty/loading/error/stale/denied states
and refreshed eligibility after role/access changes. No reviewer picker or handoff UI.

## 7. Amendments, withdrawal and annual transfers (2B only)

Approved facts remain authoritative until a new candidate receives both approvals.
A new draft/submitted amendment cannot contaminate approved amounts, Operation
distribution, annual monitoring or reports. Retain immutable old revisions,
contributors, reasons, decisions and activation chronology. Late corrections use
the same chain; no planned-date ban. Retain a distinct candidate pointer/content
when 2B is authorized, not a premature execution subsystem in 2A.

DEC-090 pauses execution of the affected Activity while its proposed amendment
awaits approval. Unrelated Activities continue. Future execution commands must
read effective-approved revision and applicable pause under their transaction,
and reject stale bases; financial settlement must not silently change its frozen
approved basis. Do not widen this to a PTA-wide freeze or assume an Operation-
only pause within the affected Activity. The precise pause entry/exit on draft,
return, rejection or abandonment and settled-Activity cases belongs to B2.

Approved withdrawal requires a reasoned two-stage formal revision, never deletion
or the obsolete Agent→Validator cancellation shortcut. Before-approval abandonment,
withdrawal of a submission versus withdrawal of the Activity, restoration and
already-executed/settled cases need explicit disposition; no such action is in 2A.

Cross-year postponement must record source/target PTA, old/new approved revision,
actor, reason and effective time while preserving immutable annual history and
Operation/allocation identity. Start-year ownership remains authoritative;
end-year crossing alone never transfers. B2 must settle draft versus approved
transfer eligibility, target-year creation timing, annual official denominators
and historical/as-of attribution. The future approved transfer must create/select
one same-Project target PTA, lock source/target years deterministically, recheck
version and source membership, and activate the new revision and membership in
one audited transaction. Duplicate/stale transfers cannot create two current
memberships. PTA-1's request-project/year ancestry and create replay identity must
be deliberately reconciled, not overwritten silently. No transfer table, new API
or speculative foreign-key rewrite is proposed before those decisions close.
Unused funds are never transferred between Activities.

## 8. A2.2/A3 compatibility, cutover and security

DEC-108 removes individual reviewer responsibilities: a pending review or an
old decision does not block A2.2 role changes/deactivation. Admin can deactivate
an ordinary reviewer immediately through existing versioned, audited lifecycle
commands; no transfer or replacement requirement and no last-reviewer lockout.
Existing current Agent coordination assignments still block lifecycle changes;
no other A2.2 restrictions are relaxed. If the eligible pool becomes empty,
pending Activities wait. Do not implement reviewer responsibility rows or checks.

The advisory lock serializes decision versus lifecycle/reset in both orders:
if review commits first, its immutable decision remains valid after deactivation;
if lifecycle commits first, the obsolete session cannot decide. A role change may
give access to a different stage only after fresh login and all contributor and
same-prevalidator exclusions. A3 reset remains allowed for ordinary reviewers
on the exact schema and preserves history, while revoking old sessions/OTP.

C2 cutover gate: verify fresh isolated provenance and literal TEST_ONLY policy;
drain all old writers including background/CLI processes; apply one reviewed
migration with separate DDL credentials, contributor reconstruction and exact
constraints; install matching candidate backend/guard before reopening admission.
Update the exact revision/relation/column/index/constraint (and any new immutability
trigger) manifest and verify the existing A2.2 Agent-responsibility predicate
together. No dual-schema
wildcard or weakened guard. Verify singleton context, denied unsupported/extra/
missing/weakened schema, non-DDL runtime privileges and immutable history as that
runtime user. Prove A3 works, A2.2 blocks Agent assignments, and review work alone
does not block lifecycle. Failure
keeps admission closed; rehearse on disposable resources, remove them afterward.

Baseline 03 mapping: SEC-02/07 → explicit OpenAPI/DTO/replay and concurrency checks;
SEC-03–06 → current session/role/contributor and lifecycle denial;
SEC-08 → exact XOF, immutable snapshots and rollback; SEC-09 → attributable atomic
append-only chronology, sanitized protected failure logs; SEC-11 → minimal scoped
identity/history disclosure; SEC-13 → no offline/confidential persistence;
SEC-14/15 → focused regressions, disposable evidence and independent review.
SEC-12 document containment is unchanged. PC1/PC2, real-data/privacy/mail/hosting
and SEC-E1–E6 retain their owners and gates. No PSSIE compliance is claimed.

## 9. Focused future acceptance checks (20)

These are executable oracles for separately authorized implementation; **none executed here**.
Use minimal synthetic identities and disposable PostgreSQL, actual FastAPI request
paths, and deterministic barriers/observed locks rather than timing sleeps.

| ID | Execution and required oracle |
| --- | --- |
| V01 | For every new and changed responsibility, real HTTP denies absent/anonymous/pending/expired/revoked sessions and technical Admin; missing/invalid Origin or CSRF denies every mutation. No protected data, row/version change or success audit on denial. |
| V02 | Multiple active Supervisors/Validators can independently access eligible review on any Activity without assignment. One successful decision per stage suffices; no reviewer picker, assignment endpoint/table or quorum. Pending/inactive/wrong-role identities cannot decide. |
| V03 | Creator, prior editor, reverted editor, removed-Operation editor and submitter cannot review after role change; the same prevalidator cannot final-approve after role change. Unrelated eligible same-role reviewers succeed without coordination assignment. |
| V04 | Any ordinary Agent, including an unassigned second Agent, submits a complete balanced draft; one immutable revision and correct ancestry, contributor set and submission audit appear, no approved amount yet. Incomplete/spoofed/unbalanced submissions fail. |
| V05 | Supervisor prevalidates exact revision; eligible Validator approves it; final decision links that successful prevalidation, approved pointer/value matches its immutable snapshot. Direct submitted→approved, swapped revision and cross-Activity prevalidation reject. |
| V06 | Supervisor reasoned return preserves total, unlocks Agent correction even after end date; no-change/edit-then-revert resubmit rejects; genuine changed balanced content creates next revision. Old snapshot/decision remains byte-identical. |
| V07 | Validator return goes directly to Agent. Without advisory amount total stays fixed; with positive advisory amount a different positive balanced total is accepted, not forced to the suggestion. Fresh Supervisor prevalidation is mandatory before final approval of the new revision. |
| V08 | Raw Activity PATCH cannot edit submitted/prevalidated/approved content; forged state/pointers and reviewer structural edits reject. Returned-state edits/additions succeed under correction rules, but removal/cancellation of previously submitted Operations rejects. Direct SQL with runtime credential cannot UPDATE/DELETE immutable revisions/decisions. |
| V09 | Snapshot preserves labels, ordered Operations, amounts, assignment/contributor identities and chronology after later allowed reference/coordination/account changes; official approved values derive only from approved pointer, never returned working values. No amendment endpoint exists in 2A. |
| V10 | Double submit at one version: one revision and success audit; losing/replayed request 409. Duplicate decisions at one version: one decision/state change; lost-response read reconciliation finds it without resubmission. |
| V11 | Barrier Supervisor approve-vs-return and Validator approve-vs-return: one winner, one conflict; no two terminal decisions for one stage or approval lacking prevalidation. |
| V12 | Barrier edit-vs-submit and return/correction-vs-final approval in both orders: no accepted decision on changed/obsolete content, no mutable submitted snapshot; results equivalent to a legal serial execution. |
| V13 | Barrier reviewer deactivation/role-change versus decision in both orders: review-first remains historically valid; lifecycle-first denies the obsolete session. New eligible reviewer continues the remaining stage without repeating valid prevalidation or erasing history. |
| V14 | Inject audit, real constraint and outer commit failure for submission, correction and each decision stage: full rows/pointers/state/version/contributors roll back, no success audit or orphan; safe failure response/log. |
| V15 | Admin deactivates/changes an ordinary reviewer despite pending reviews or prior decisions; last eligible reviewer may be deactivated and Activity waits. Submission still succeeds with an empty pool; final approval without prevalidation fails. Existing current Agent-assignment lifecycle restriction and all Admin/self-target/provenance guards remain. |
| V16 | A3 reset works for an ordinary reviewer on exact new schema; old sessions/OTP cannot edit/review. Barrier role/reset-vs-review both orders plus focused login/OTP/deactivation regressions complete without deadlock. |
| V17 | Two independent Project/PTA trees: guessed mismatched revision/decision IDs, forged context, parent-bound cursor swaps and prevalidation references leak no protected content and cannot cross-link. Exact XOF ceiling, fractions/overflow, operation sum and date-clamp regressions pass. |
| V18 | Generated OpenAPI has only selected responsibilities, strict DTO/auth/header/errors, exact revision/version fields and DEC-102 list envelope/default 60/max 100/invalid 422; no withdrawal/transfer/execution/document routes. |
| V19 | Playwright covers Agent submit→Supervisor return→correction→prevalidation→Validator return→fresh cycle→approval/history. Query refetches list/detail/eligibility, ignores delayed old-auth response; keyboard/mobile/loading/error/empty/stale states work. Offline submit sends no write and reconnect never replays. |
| V20 | Disposable C2 rehearsal: exact predecessor upgrade, complete contributor reconstruction (including prior/reverted/removed-Operation editors, excluding no-op-only saves), singleton and manifest; missing/unexpected/weakened schema/attribution fail closed; no old/mixed worker, no runtime DDL. A no-op-only saver remains review-eligible if otherwise qualified. Focused A1–A3/PTA-1 PostgreSQL regressions, lint/format/type/build and teardown pass. |

PTA-2B is not included in this count. Its later oracles must separately prove
candidate/approved isolation throughout amendment return/rejection, affected-only
pause, concurrent activation, withdrawal preservation and both transfer race
orders with exact annual attribution; they cannot be counted as passed or as
concrete implementation gates until B2 decisions close.

## 10. Decisions, reviews and verdict

| ID / timing | Owner and precise closure | Affected scope |
| --- | --- | --- |
| B1 — RESOLVED (DEC-108) | User approves role-wide review, one decision per stage, preserved decisions after personnel changes, fresh chain after structural correction and immediate ordinary reviewer deactivation without handoff. | No remaining PTA-2A business-authorization blocker. |
| B2 — LATER_PTA_2_SLICE (before 2B authorization) | Business sponsor/finance/reporting owner: before/after-approval withdrawal and restoration, settled/executed restrictions, amendment pause entry/exit and rejection disposition, cross-year eligibility/target creation, source/target annual/as-of denominator/history policy (gap L1–L3). | PTA-2B only; B1 is closed and these questions do not block 2A. |
| I2 — BEFORE_AFFECTED_IMPLEMENTATION | Engineer: freeze exact bounded snapshots/decision DTOs, one-decision-per-stage constraints, cumulative contributor migration proof, immutable-row protection and state/pointer invariants; resolve supplied inspiration availability for affected UI. | Separately authorized 2A schema/API/UI; DEC-108 is settled. |
| C2 — BEFORE_CUTOVER | Engineer/operator: matching artifact/schema/guard and preserved Agent lifecycle predicate, drained writers, isolated provenance, all mandatory checks and independent reviews. | Enablement after separately authorized implementation. |
| R2 — BEFORE_REAL_ACCOUNT_ENABLEMENT | Sponsor/RSSI: PC1/PC2 and actual identity/mail/data acceptance. | Real accounts remain prohibited. |
| E2 — EXTERNAL_SECURITY_DEPENDENCY | Named Ministry/RSSI/legal/hosting/delivery owners in baseline 03 SEC-E1–E6. | Sensitive use, external assurance and deployment; no inferred compliance. |

Engineering decision-closure review: **PASS**. Security/Specification
decision-closure review: **PASS**. Both independent reviewers inspected the actual
five-document diff and full contract; no blocking findings remain.
Independent reviews must assess whether the document accurately bounds unresolved
rules; a review PASS is not a business-decision approval or readiness override.
Any eventual implementation plan must end with a separate review-only agent
inspecting requirements, actual diff and verification independently. Implementer
fixes findings; the same reviewer rechecks. Blocking findings or missing mandatory
evidence prevent completion; no separate reviewer means a blocked gate.

Verification for this documentation task: full changed-document diff and new-file
review, `git status`, `git diff --stat` and `git diff --check`. Runtime, database,
browser, build and historical suites intentionally skipped: no executable source
or configuration changed. `tasks/lessons.md` evaluated; existing contributor and
audit guidance suffices, with no additional durable lesson needed.

**PTA_2_NOT_READY** for the whole scope. **PTA_2A_READY_FOR_AUTHORIZATION**
under DEC-108 with both independent decision-closure reviews passed. I2 and C2
remain mandatory implementation/cutover gates. **PTA_2B_NOT_READY**: B2 business
questions and the 2A implementation dependency remain. No implementation, schema,
tests, runtime or account configuration changed. Stop before implementation.
