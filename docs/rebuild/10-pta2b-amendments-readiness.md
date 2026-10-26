# PTA-2B — Approved amendments, withdrawal and annual transfers

Documentation-only review, 2026-10-26. No implementation authorized. Authority:
[PTA brief](../mjl_codex_authoritative_pta_change_brief.md) §§2–5,
[decisions](../mjl-authoritative-decisions.md) DEC-087–090/108–110,
[readiness 09](09-pta2-validation-readiness.md), and retained functional
specification §§9–13. Recommendations below are proposals, not new approvals.

### Decision closure — DEC-110

The user approved pause from opening, one open amendment per Activity, and
reasoned Agent cancellation preserving history and the prior approved version.
A1/A2 are closed. This contract incorporates those choices; withdrawal/transfer
remain separately blocked. Implementation still requires explicit authorization.

## 1. PTA-2A baseline

Verified HEAD/completion: `1f6c67067c97e3137de4a17a1c82f64059aba939`,
`Implement PTA-2A activity review workflow`; clean worktree at review start.
[Completion evidence](10-pta2a-implementation-status.md) records V01–V20,
105 planning cases, subsequent focused corrections, 71 A1–A3 regressions,
42 frontend tests, Chromium and both independent reviews. These are recorded
historical results, not tests rerun during this documentation review.

Inspected `backend/app/planning/{models,routes,service}.py`, migration
`0006_pta2a.py`, `auth/service.py`, and `frontend/src/PlanningView.jsx`:

- Activity has `version`, `current_revision_id`, `approved_revision_id` and
  mutable working Activity/Operation rows. Revisions/decisions/contributors are
  append-only; review decisions are unique per revision/stage.
- `activity_revision_pointer_state` requires no approved pointer while reviewing
  and equal current/approved pointers when approved. It cannot support an
  amendment by merely allowing PATCH on approved Activities.
- `activity_item` gets `approved_allocation` from the approved snapshot but its
  names, dates, proposed allocation and Operations come from mutable rows.
  This is not yet a complete approved-content read contract.
- `submit_activity` freezes content; `decide_activity` checks current revision,
  version, role and cumulative contributors, then atomically audits approval.
  `replace_activity` rejects approved/submitted/prevalidated edits. Returned
  edits preserve the last submitted pointer until a new submission.
- Mutations acquire advisory lock `1843201` before authentication Context/User
  and Activity locks. Detail/history hold Activity `FOR SHARE`; list rows lock
  in deterministic order. Helpers never own hidden commits.
- Exact guard checks `0006_pta2a`, 19 relations, constraints/indexes and trigger/
  function definitions. Active Agent coordination blocks A2.2; review history
  does not. No execution/settlement, withdrawal or annual-transfer model exists.

## 2. Confirmed scope

The brief approves formal amendment of definitively approved content, including
late dates, additions and budget changes; old approval remains authoritative
until fresh two-stage approval. Same-year start changes and an end date in the
next year do not transfer annual ownership. Changed start year requires a
separate audited annual transfer. Exact positive integer XOF Operation totals
remain balanced with Activity allocation. No unused-fund reallocation exists.

DEC-108 settles the prompt's reviewer-assignment question: there are no Activity
reviewer assignments to retain or reconsider. All currently eligible Supervisors
and Validators may act; one of each suffices, final actor distinct from that
revision's prevalidator. Personnel changes preserve valid completed decisions.
Cumulative creator/editor/submitter exclusion persists across amendments and
role changes. Agent coordination remains independent metadata.

## 3. Approved and candidate revision model

Selected minimum: one open amendment per Activity;
reuse working Activity/Operation rows for candidate preparation, immutable
revisions for submissions, and existing approved pointer for effective content.
No generic version manager or duplicate Operation tables are needed.

Add `amendment_draft` state, nullable server-generated `amendment_id` UUID and
nullable `amendment_reason` (trimmed 1–4000 characters) on Activity. Freeze the
amendment ID, reason and base approved revision ID into each new
amendment submission. Preserve existing initial-submission snapshots unchanged.
The approved pointer is the locked base; a candidate's base must still equal it
at approval. An explicit candidate base field is unnecessary if opening a second
amendment and all other approved-pointer changes are prohibited while one is open.
The amendment ID is fresh on every opening and cleared on activation/cancellation;
reason is fixed for that opening. Both metadata fields are null together when
closed and non-null together when open. An open amendment requires an approved
pointer and state `amendment_draft`, `submitted`, `prevalidated`,
`returned_supervisor` or `returned_validator`. Draft uses current = approved;
submitted/returned states use a candidate of this same amendment/base. Initial
PTA-2A flows have no amendment metadata and retain their original rules.
I3 translates these invariants into exact SQL/DTOs before runtime edits.

| Situation | Working/current content | Effective approved content |
| --- | --- | --- |
| Approved, no amendment | Working rows equal approved structure; current = approved | Approved snapshot |
| Amendment preparation | Editable working copy; current may still identify preceding approval | Same approved snapshot |
| Submitted/prevalidated amendment | Working structure locked; current = new frozen submission | Previous approved snapshot |
| Returned amendment | Working copy editable under correction rules; current = last returned submission | Previous approved snapshot |
| Cancelled amendment | Restore approved structure; current = approved; clear amendment metadata | Previous approved snapshot |
| Definitive approval | Current candidate becomes approved atomically; working structure matches it | New approved snapshot |

Use explicit response blocks for `approved` and `candidate` including their
identity, dates, Operations and amounts. Do not label mutable top-level planning
fields as effective values. Lists/details/history must agree. Future totals,
exports and execution resolve only `approved_revision_id`; no fallback to working
rows, `max(revision_number)` or candidate state. Pending amendments must not make
an approved Activity disappear from official totals. Historical as-of reads use
approval decision times and frozen snapshots; no reporting module is built here.

## 4. Amendment validation and atomic activation

Required transitions under DEC-110:

1. Any verified Agent opens a reasoned amendment from approved state and current
   version; preserve approved pointer, clone/check effective structure and enter
   amendment draft. A second opening conflicts; opening alone is not a structural
   contribution (subsequent real edits/submission are).
2. Agent edits same-year candidate fields/adds Operations. No date cutoff.
   Previously submitted Operations cannot be removed/cancelled; L2 remains open.
   First amendment may propose a different positive balanced allocation; old
   returns from the preceding approved revision must not lock this new proposal.
3. Submission requires genuine structural change against the approved base,
   creates the next numbered immutable snapshot and enters `submitted`.
   Assignment-only, reason-only or edit-then-revert does not qualify.
4. Reuse Supervisor prevalidate/return and Validator approve/return. Returns go
   directly to Agent. Supervisor return locks that submission's total; Validator
   return does likewise unless a positive advisory amount was supplied, which is
   neither a cap nor a mandated value. Compare resubmission to the returned
   snapshot; fresh Supervisor prevalidation is always required.
5. Final approval verifies exact candidate, base approved pointer, version,
   current actor and successful distinct prevalidation, then writes decision,
   approved pointer, state/version and activation audit in one transaction.
   Other readers see either complete old or complete new effective content.
   Prior snapshots and decisions never change. No separate activation endpoint.

6. Any currently authorized Agent may cancel the open amendment in draft,
   submitted, prevalidated or either returned state, with a mandatory reason.
   Coordination/opener identity does not restrict Agent access. Cancellation is
   immediate, not a review decision; no terminal reviewer rejection is added.
   Validate expected Activity version, amendment ID and approved base before
   changing anything. Approved/initial-review Activities have nothing to cancel.
   Capture the complete current candidate structure, opening reason, last candidate
   revision (nullable before first submission), immutable base and cancellation
   actor/reason/time in `auth_audit.business`, then restore approved structural
   fields and Operations by their original IDs. Retain all submitted snapshots,
   decisions and cumulative contributors, including cancelled contributors.
   Current coordination assignments are not rolled back to the old snapshot.
   Candidate-only Operations are soft-removed, never deleted; even submitted
   candidate-only additions are retired by cancellation of the whole amendment,
   not by individual Operation cancellation. Preserve their content in history.
   Restore approved Operation positions collision-safely with existing ordering
   mechanics; preserve identity/creation metadata and record restoration actor/time.
   Set current = approved, state = approved, clear amendment metadata and bump
   version once. Persist snapshot/audit/restoration in the same transaction.
   Missing/inconsistent approved data fails closed; do not reconstruct from UI.
   Cancellation releases only the amendment pause. Reopening creates a fresh ID
   from approved content, never revives cancelled working content or prevalidation.
   Revision numbering continues above all historical submissions, not the reset
   current pointer. Cancelling an unchanged/unsubmitted draft still records it.

## 5. Affected-execution pause

DEC-090/110 require pause from opening through preparation, submission,
prevalidation and correction, until definitive approval or cancellation. Derive
`execution_paused` and its amendment reason from the open amendment identity;
no separate mutable pause flag. Cancellation resumes the prior approved version;
approval resumes the replacement. Other Activities continue. This is a planning
eligibility signal only; future financial/settlement rules may independently deny
execution. It does not claim that cancelling overrides those restrictions.

Later realization must authorize each write against the same locked Activity,
exact effective revision and amendment status. Return an explicit pause reason;
unknown status/financial eligibility denies the affected write. Never rely on a
cached UI flag or global Project/PTA lock. Static snapshot reads stay available.
The existing short transaction advisory lock is not a business execution pause.

No spending rows, execution endpoints, financial authorizations, reminder jobs or
settlement flags are introduced. Before future realization cutover, replace
verified planning-only eligibility with actual execution/settlement checks;
unknown extra schema fails the exact guard. Settlement already started must not
silently receive a new budget basis; L1 controls exceptions. Reversement remains
`max(0, approved allocation - final spending)` with actual returned values
separate, and no reallocation to another Activity.

## 6. Withdrawal and cross-year transfer

**Withdrawal:** the brief requires a formal two-stage approved withdrawal and
preserved administrative history. Legacy Agent→Validator cancellation is
superseded; draft abandonment is not an approved-withdrawal shortcut. Still
undecided: eligible pre/post-approval or executed states, initiator, reason
contract, pending-amendment disposition, effective withdrawal date, restoration,
Operation/coordination ending, and annual denominator policy. Recommend a
reasoned Agent request with the existing distinct two-stage review, no physical
deletion, archived Operations/decisions and explicit assignment termination on
effective withdrawal, subject to owner approval. No endpoint/schema is frozen.
Defer it without blocking amendments once their own decisions close.

**Transfer:** retain Activity identity, Project, Operation identities/allocations,
assignments and historical decisions; only formal approval may change start-year
ownership. Proposed target is a unique PTA of the same Project/year, created
atomically if missing. Business/reporting owners must approve eligible states,
initiator/review, allowed target years and closed-Project behavior, coexistence
with amendments, and whether source-year totals are restated or retained as-of.
Decide effective date and historical spending attribution without double counting.
The current Activity ancestry FK ties PTA to `request_project_id/request_year`;
these are also create-replay identity. A later transfer must separate immutable
creation provenance from current placement, not rewrite replay keys or old
snapshots. Need immutable source/target/effective-time transfer evidence, with
exact storage chosen after policy approval. Two concurrent transfers have one
winner; target creation, move, version, lineage and audit commit or roll back
as one unit. Transfers are not financial virements or leftover-budget transfers.

## 7. Minimal API, persistence and React impact

Three new responsibilities, using the existing authenticated Activity scope:

- `POST /api/v1/activities/{id}/amendments`: expected Activity version, expected
  approved revision and reason; server generates amendment ID; 201 after commit.
- `POST /api/v1/activities/{id}/amendments/{amendment_id}/cancellation`:
  expected Activity version, expected approved revision and cancellation reason;
  200 with restored Activity only after commit. It creates a cancellation record,
  not a DELETE of history. Stale/duplicate/wrong-open-ID writes return 409.
- `GET /api/v1/activities/{id}/amendments/{amendment_id}`: authorized detail of
  the opening and optional cancellation, including preserved cancelled candidate
  content. Missing/cross-Activity identity returns scoped 404. No generic audit
  browsing or auth audit facts are exposed.

Extend existing PATCH/submission/decision/GET projections, not parallel review
endpoints. Existing revisions history list gains tagged opening/cancellation
summary items alongside submissions. Use a stable composite ordering/cursor
across the two sources; bind cursor to Activity, resource, limit and format
version, rejecting older/incompatible cursors. Summaries exclude full candidate
snapshots; the new detail read supplies them. Existing revision detail remains
revision-only and unchanged for historical submissions. Activity response includes
open amendment identity/reason, `approved`, `candidate`, and derived pause state.
Strict DTOs reject extras; IDs/version use current validation conventions, reason
trimmed 1–4000 characters. Preserve 422 validation, 403/401 role/session denial,
404 scoped absence, Origin/CSRF, safe errors and DEC-102 pagination.

One Alembic migration revises state/pointer constraints and deferred validation,
adds only selected amendment metadata, and preserves all 0006 history. No new
tables demonstrated necessary for amendments. Constraints must validate both
current candidate chain and the independently approved chain, including exact
same-Activity/context links; old approval must remain valid while candidate is
returned. Immutability and runtime UPDATE/DELETE/DDL/TRUNCATE denials remain.
Do not edit historical migration 0006. Migration must reject inconsistent
predecessor state rather than fabricate approval evidence.

Preserve lock order: advisory → authentication Context → User → Activity →
revision/Operations → transactional audit. Reauthorize in transaction; no User
lock acquired after Activity. All candidate/approval/lifecycle races serialize;
read projections hold appropriate Activity share locks and deterministic list
order. Use outer commit ownership; audit, constraint or commit failure rolls back
candidate, contributors, decisions, pointers and version together.
Use `activity.amendment_open` and `activity.amendment_cancel`; activation retains
`activity.approve` with amendment/base identity. Audit records carry actor/time,
context/Activity, amendment ID, reasons, before/after version and pointer IDs.
Cancellation additionally freezes full saved candidate structure/Operation IDs,
labels and last submission ID before restoration. Extend the strict existing
business-audit validator only for these exact shapes; retain its 1 MiB bound.
Verify maximum allowed candidate plus before/after payload fits both Python
serialization and PostgreSQL `octet_length(business::text)` bounds; avoid redundant
copies, and reject oversized edits before creating an uncancellable candidate.
Opening/cancellation audit records are append-only under restricted runtime;
history reads filter allowed event types, target and trusted context. Submitted
snapshots already retain their review actors; cancellation must not forge a
submission, revision number or contributor merely to archive a draft.

Extend the existing Activity workspace: “Version approuvée”, “Modification en
préparation”, “Motif de modification”, approved/candidate comparison and existing
review/correction dialogs/history. Add “Annuler la modification” with required
reason and a confirmation explaining restoration; closing the dialog does not
cancel the amendment. History shows “Modification annulée”, saved candidate,
reason and actor/time; approved content remains clearly identified. Use `DESIGN.md`, design-system index/approved
v3 tokens/components, `docs/inspiration/mjl-prototype.html` amendment form/detail
composition and Activity details/history references. Prototype behavior has no
business authority. No new standalone page or withdrawal/transfer controls.
Router owns selection/navigation, Query owns both projections; local forms only.
Keep French accessible keyboard/mobile states, exact XOF formatting, Sonner and
Helmet. Reuse fail-closed reconciliation after conflicts/uncertain outcomes;
auth change masks/clears data; offline mutation sends nothing and never replays.

## 8. A2.2/A3 compatibility

Expand the exact migration/schema/trigger/function manifest atomically with the
new code. Do not accept both old and new layouts as an undocumented fallback.
A2.2 continues to reject accounts with active Agent assignments; candidate work
and role-wide reviews add no individual responsibility assignment. A3 retains
provenance/schema checks independently of that assignment predicate. Login/OTP,
password reset and lifecycle retain advisory-first ordering and immediate session
revocation. Unknown responsibility schema denies eligibility.

C3 requires a disposable upgrade from actual `1f6c670` data/artifact, including
approved/returned/history/contributor fixtures, drained old writers, matching
candidate/schema/manifest and restricted non-owner runtime login. Demonstrate
old artifact rejects new schema, no mixed workers, exact guard tamper rejection,
immutability and A2.2/A3 focused regressions. Test teardown is task-owned only.

## 9. Recommended implementation slice

**PTA-2B.1 — approved same-year Activity amendments:** depends on completed 2A
and closed DEC-110 decisions. Independently verifiable outcome: an Agent revises approved
content, receives correction, resubmits, and a fresh distinct two-stage chain
atomically replaces effective content without contaminating prior approval.
Limit to synthetic planning-only data; defer post-submission Operation removal.

**PTA-2B.2 — withdrawal and cross-year transfer:** depends on W1/T1/L1–L3
closure. Its outcome must independently preserve historical allocation/approval
attribution through an authorized withdrawal or one atomic annual move. Do not
force both features into one implementation if their decisions close separately.
The split follows distinct unresolved lifecycle/history rules, not convenience.

## 10. Focused proposed acceptance checks

These twenty checks are mandatory future implementation gates, not executed
or passed results. Each includes its positive and negative branches.

| ID | Concrete oracle |
| --- | --- |
| M01 | Admin/wrong role/pending/inactive/expired session and bad Origin/CSRF cannot open/edit/submit/decide/cancel; denial creates no success audit. |
| M02 | Approved same-year Activity opens exactly one candidate; no approved pointer, amounts, Operations or annual attribution changes. Ineligible state/second candidate rejects; new opening after cancellation has a fresh ID and approved content. |
| M03 | Late same-year changes work after start/end; changed start year rejects, end-only year crossing retains PTA. Invalid dates fail. |
| M04 | Candidate reads/edits cannot alter effective approved fields, Operation set or approved-only aggregate fixture at any draft/review/return stage. |
| M05 | First amendment can change balanced allocation; no-op/revert/coordination-only submission rejects; frozen base/reason/lineage is exact. |
| M06 | Eligible role-wide Supervisor then distinct Validator succeeds; contributors across old/new revisions and role-changed prevalidator cannot self-approve. Empty pool waits. |
| M07 | Both reasoned returns preserve old approval; correct total-lock/advisory semantics; correction produces new revision and requires fresh prevalidation. |
| M08 | Final approval atomically changes effective pointer/values/version and audit; old history remains byte-identical; candidate operations become effective only now. |
| M09 | Barrier concurrent opening/submission/decision yields one winner, loser 409, one success audit and no orphan revision. |
| M10 | Observed PostgreSQL-lock schedules for edit/submit and return→correction/stale approval versus approval-first produce legal serial outcomes. Wrong candidate/base and replayed activation reject. Cancel versus edit/submit/return/prevalidate/approve and reopen has one legal winner; stale cancellation cannot affect reopened amendment. Exercise both lock orders. |
| M11 | Reviewer role/deactivation/reset races preserve committed decisions or deny obsolete sessions; coordination changes grant no review privilege, preserve decision history and retain A2.2 blockers. |
| M12 | Real HTTP list/detail/history reads racing changes expose coherent before-or-after approved/candidate projections, never mixed Operations/pointers. |
| M13 | Pause starts at opening and persists through all review/return states; cancellation from each open state restores approved content, clears pause, retains complete candidate/history/contributors and current assignments; duplicate/initial-flow cancellation rejects; unrelated approved Activity remains eligible. Later execution contract cannot use candidate allocation. No execution API is implemented. |
| M14 | Inject audit, real constraint and outer commit failures at open/edit/submit/return/prevalidate/activate/cancel: exact rollback of all rows, pointers, contributors/version; no success audit. |
| M15 | Direct SQL rejects invalid pointer/base/stage/cross-Activity chains and immutable history writes; changed schema/functions fail guard. |
| M16 | Two Project/PTA trees reject mismatched revisions/parent cursors/context; candidate, cancelled-detail and merged history disclose only authorized trusted ancestry; cursor cross-source ordering/page boundaries have no duplicates/omissions, invalid/cross-parent cursors reject. |
| M17 | Exact XOF boundary, fractions/overflow, positive Operations and balanced sums pass/fail correctly; stable approved Operation identities and prohibited individual removal preserved; whole-amendment cancellation retires candidate-only additions without deleting history. Maximum payload remains cancellable; inactive reference labels do not prevent restoration of unchanged approved facts. |
| M18 | Generated OpenAPI/strict DTOs cover selected new/extended responsibilities and DEC-102 pagination; no withdrawal/transfer/finance routes; existing A1–A3/PTA-1/2A focused regressions pass. |
| M19 | Playwright amendment→return→correction→fresh approval and cancellation→history→reopen; French keyboard/mobile/loading/error; Query list/detail/current/history reconciliation including delayed/failed refetch, old-auth responses, offline no-send/no-replay. |
| M20 | C3 exact predecessor upgrade, no manufactured history, restricted runtime, guard/lifecycle/recovery compatibility, focused lint/format/type/build checks, independent correction/re-review and disposable teardown pass. |

Deferred W/T gates are not counted: state/role/reason withdrawal matrix and
restoration/assignment-history results; duplicate withdrawal one winner;
source/target/as-of annual totals; same-Project unique target creation; both
transfer race orders; stale/duplicate transfer rejection; transfer audit/commit
rollback leaves original placement and no orphan target/history. Finalize these
oracles only after W1/T1 decisions, never claim ready based on placeholders.

## 11. Blockers and decision owners

| Gate / timing | Exact decision or evidence; owner | Affected scope |
| --- | --- | --- |
| A1 — CLOSED | User DEC-110: affected Activity pauses from opening through review/correction until approval or cancellation. | Amendment pause; later execution integration. |
| A2 — CLOSED | User DEC-110: one open amendment; Agent cancellation with mandatory reason preserves history and prior approval. | Complete amendment journey. |
| W1 — BEFORE_AUTHORIZATION | Sponsor/finance: approve withdrawal state/actor/reason/two-stage/effective-date/restoration/Operation/assignment/candidate/settlement matrix. Brief §2 gives formal two-stage requirement, not all consequences; L1/L2 remain. | Withdrawal only. |
| T1 — BEFORE_AUTHORIZATION | Sponsor/reporting/finance: approve transfer eligibility, actor/review/target-year/PTA creation, pending-candidate disposition and source/target/as-of totals/history/spending attribution; gap L3. | Transfer; withdrawal annual effects also depend on L3. Not ordinary same-year amendments. |
| I3 — BEFORE_AFFECTED_IMPLEMENTATION | Engineer: freeze selected state/pointer/base/reason DTO, exact constraint changes and comparison layout against supplied inspiration after A1/A2. | Authorized amendment schema/API/UI only; no runtime work in this review. |
| C3 — BEFORE_CUTOVER | Engineer/operator: exact artifact/schema/guard upgrade, disposable provenance, non-owner runtime, drained writers and all mandatory checks/reviews. | Synthetic enablement of the separately authorized slice. |
| L1/L2 integration — LATER_PTA_SLICE | Sponsor/finance and realization engineer: execution/settlement eligibility and controlled late exceptions; explicit assignment-aware eligibility when future responsibilities appear. | Financial realization/settled amendments and Operation cancellation; no speculative tables now. |
| PC1/PC2, SEC-E1–E6 — EXTERNAL_SECURITY_DEPENDENCY | Sponsor/RSSI and named baseline 03 owners: real identity policies, delivery, legal/hosting/operations evidence. | Real-account/sensitive/production use; remain prohibited. |

## 12. Reviews and verdict

Independent engineering re-review: **PASS**, no blocking findings. Confirmed
append-only audit reuse, bounded cancellation payload, Operation restoration,
revision numbering, advisory-first concurrency and exact guard cutover against
actual code. I3 must check both Python and PostgreSQL JSON serialization sizes.
Independent security/specification re-review: **PASS**, no blocking findings.
Confirmed role/resource checks, retained contributors/history, cancellation from
all open states, fresh amendment identity and synthetic-only boundaries.
Both reviews were read-only; no runtime tests were run or claimed.

**PTA_2B1_READY_FOR_AUTHORIZATION** — same-year amendments, including cancellation,
under this contract and [implementation plan](11-pta2b1-implementation-plan.md).
A1/A2 are closed; I3/C3 and M01–M20 remain mandatory future implementation gates.
**PTA_2B_NOT_READY** — full withdrawal/transfer scope remains blocked by W1/T1.
Readiness and review PASS do not authorize implementation or real accounts.
The implementation plan ends with mandatory independent review-only handoff,
implementer corrections and same-reviewer re-review before completion.

Verification: documentation diff/new-file review and `git diff --check` only.
No runtime suites/builds/database/browser tests run: no executable change.
Existing lessons were evaluated; no new repeated correction warrants an entry.
Stop before implementation; PC1/PC2 pending, synthetic-only restriction retained.
