# PTA-2B.2 readiness: withdrawal and cross-year transfer

Documentation-only review, 2026-10-26. Baseline:
`641ba1313d8d2ce2d531a6ea13aefc79d57e0b94` (PTA-2B.1), clean worktree at start.
Current verdicts after DEC-112 and independent technical re-review:
**PTA_2B2_WITHDRAWAL_READY_FOR_AUTHORIZATION** and
**PTA_2B2_TRANSFER_READY_FOR_AUTHORIZATION**. Both are planning verdicts only;
implement withdrawal first and satisfy its completion dependency before transfer.
The earlier NOT_READY review is retained as historical evidence in §10.

## Decision closure following the five user approvals

The user approved reasoned Agent withdrawal with Supervisor then distinct
Validator approval, pause at submission and prior resolution of any amendment;
reasoned cancellation of a pending withdrawal; preserved history, ended Agent
assignments and no restoration after effective withdrawal; exclusion of drafts;
removal from current annual counts/budget only after approval without changing
earlier history or releasing/returning funds; and later-year same-Project transfer
preserving identity, Operations, budget and assignments, with pause, fresh review,
pending-request cancellation and destination-year counting after approval.

The user also approved restricting both capabilities to verified synthetic test
Activities with no execution started. Work performed, spending, unresolved
obligations or unknown financial status block them. This settles the presented
W1/W2/T1/T2/F1 business choices. Do not ask for those approvals again.

## Technical recheck after DEC-112

Planning baseline `356cc76`; actual runtime remains `641ba13`. The user now
requests finalized technical readiness and sequential plans, not implementation.
The five business choices are closed. The following implementation contracts
resolve their technical details without adding business permissions:

- [PTA-2B.2A withdrawal plan](13-pta2b2a-withdrawal-implementation-plan.md): one
  Activity request-ID column, one migration, no table; two new POST commands,
  purpose-aware existing revision decisions/history and approved-plan totals on
  existing Project/year context. Pending withdrawal retains approved content;
  effective withdrawal retains its separate reviewed request.
- [PTA-2B.2B transfer plan](14-pta2b2b-transfer-implementation-plan.md): after
  withdrawal completion, one transfer-ID column and current placement year,
  one migration, no table; two new POST commands plus existing review/history.
  Opening and submission are one action: pause starts when the request is sent.
  No persisted transfer draft. Original create keys never change; target PTA is
  created only at final approval. Candidate snapshots hold intended target year
  with explicitly nullable target PTA ID; activation audit binds actual ID.
- Existing shared review states are reused with strict bounded purpose metadata,
  mutually exclusive pending requests, purpose/base/chain SQL constraints and
  contributor protection. No generic workflow engine or independent ledger.
- Exact-schema/no-import/no-execution proof is required per mutation, backed by
  existing operator attestation plus an explicit disabled-by-default test-only
  policy literal. Future realization must replace the proof, not simply approve
  its new schema hash. Unknown responsibilities remain a denial.
- Historical annual contribution selects the latest committed final approval
  effective at the cutoff, including initial, amended and transferred content;
  a latest withdrawal approval excludes contribution. Single-query snapshot,
  exact XOF, no current-pointer/current-PTA join shortcut, no pending/cancelled
  amounts. Extend existing PTA context with this planning-only summary and
  optional as_of; no reporting module or realized-finance metrics. Context and
  Activity-list GETs take shared advisory lock 1843201 before auth/row locks and
  hold it through complete projections; writers take its exclusive counterpart.
  This closes inter-statement membership/count/nullable-target races without
  implying simultaneous consistency across separate HTTP requests.

The numbered sections below remain rationale and shared acceptance requirements.
Where their earlier tentative mechanism differs, the two linked plans own the
exact technical contract (notably immediate transfer submission and its snapshot
shape). Each plan ends with independent engineering/security review-only handoff,
implementer corrections and same-reviewer re-review. Implementation still needs
separate explicit authorization per slice. PC1/PC2 remain pending.

## 1. Authority and verified baseline

Sources: [authority router](../mjl-authoritative-decisions.md) DEC-087–090/108–112,
[approved PTA brief](../mjl_codex_authoritative_pta_change_brief.md) §§2–5,
[readiness 10](10-pta2b-amendments-readiness.md) §§6/11, roadmap, gap L1–L3,
PTA-2A and [PTA-2B.1 completion](12-pta2b1-implementation-status.md), functional
specification §§10–16/23–28, engineering standard 02 and security baseline 03.
The brief supersedes legacy assigned-Agent access, Agent→Validator cancellation,
expense-ledger execution, date freezes and automatic closure. Legacy draft
abandonment is not an approved withdrawal contract.

Inspected `backend/app/planning/{models,service,routes}.py`, migrations
`0005_pta1`–`0007_pta2b1`, `backend/app/auth/service.py`, and
`frontend/src/{PlanningView,router}.jsx`. Schema evidence is checked-in
migrations/models and recorded C3, not inspection of a live PostgreSQL instance.
Recorded prior results: M01–M20, 151 PTA PostgreSQL cases, 206 focused regressions,
45 frontend cases, one Chrome journey, quality checks and independent reviews
PASS. These tests were not rerun in this documentation review.

| Verified baseline | Reusable mechanism and limit |
| --- | --- |
| Approved values preserved | `activity_item` resolves `approved` from `approved_revision_id`. Mutable top-level fields/Operations and `candidate` are working content; official consumers must not use those as approved values. |
| Pause and candidate isolation | `open_amendment` retains the base and sets amendment identity; `execution_paused` stays true until approval/cancellation. No execution module exists: this is a planning flag/contract, not an exercised spending gate. |
| Cancellation preserves history | `cancel_amendment` restores approved content/Operation IDs, retires candidate-only Operations, resets current to approved, clears amendment metadata and audits a frozen candidate. Assignments/contributors/history survive. |
| Corrected content requires fresh review | Submission freezes a new revision; exact current/base/version, cumulative contributors and distinct Supervisor/Validator checks protect approval. Return/resubmission requires a fresh chain. |
| SQL and audit protection | Append-only revisions/decisions/contributors, same-Activity composite FKs, unique revision/stage decision, deferred chain/base checks and bounded transactional business audit. Reuse these rather than a parallel workflow. |
| Concurrency | Advisory `1843201` precedes authentication and resource locks in mutations. Detail/history/list use Activity shared locks; versions reject stale requests. Helpers do not silently commit. |

DEC-108 still controls reviewers: all currently eligible invited Supervisors and
Validators in MJL may review, with per-Activity contributor/state/revision checks.
The request's “Activity-specific reviewer authorization” does not reinstate
reviewer assignments. Agent coordination is not access control. Admin has no
business mutation; Partner access remains unimplemented.

## 2. Withdrawal contract under DEC-112

Confirmed: withdrawal of approved content needs formal Supervisor then distinct
Validator approval and retained administrative history. It does not delete an
Activity or release allocation for another Activity. Amendment cancellation
instead restores the already approved plan; it is not Activity withdrawal.
No authority grants financial reversal, settlement waiver or restoration after
an effective withdrawal.

**Approved bounded business contract; exact implementation in plan 13:**

- Any eligible Agent requests withdrawal of an `approved` Activity without an
  open amendment, in an active Project. Require trimmed reason (1–4000 chars),
  expected version and approved revision ID. Submission freezes an unchanged
  approved-content snapshot with explicit withdrawal purpose/base/reason;
  no fake structural edit or zeroed amount.
- Reject draft, initial submitted/prevalidated/returned, already withdrawn,
  closed and financially unverifiable Activities. Draft abandonment stays
  deferred. Resolve an open amendment separately through approval or cancellation;
  withdrawal never silently discards it.
- Pause from withdrawal submission through review/correction. Preserve approved
  content and annual contribution until final approval. Either reviewer can
  return with mandatory reason directly to Agent. A corrected reason/request
  is resubmitted as a new revision with fresh two-stage review; reason-only
  correction is valid for this purpose. No advisory budget change here.
- Allow Agent reasoned cancellation of the pending request from every pending/
  returned stage. Preserve history, restore approved current pointer and release
  only this request's pause. This is neither amendment cancellation nor reversal
  of an effective withdrawal.
- Final approval takes effect at the server-recorded approval time, without
  backdating. Record withdrawn lifecycle state/request/time separately from the
  last content approval. End current Agent assignments atomically with actor/time;
  prevent new assignments/structural edits. Retain Operation identities and
  allocations as historical facts, without inventing individual cancellation,
  financial settlement or physical completion. No restoration initially.
- Approved W2: remove the Activity from current approved planned count/allocation
  only at effective withdrawal; earlier as-of totals remain unchanged. Keep
  withdrawn approved allocation visible historically, never available for reuse.
  Withdrawal adds no realized count/spending. No reporting UI is built here.

W2 example: allocation 100 F CFA contributes count 1/amount 100
before and during review; after withdrawal current values become 0/0, while an
earlier as-of view remains 1/100. Zero denominators stay non-calculable. This is
planning attribution, not refund or administrative reversement evidence.

## 3. Transfer contract under DEC-112

Confirmed: Projects span years with one PTA per relevant calendar year; Activity
belongs to its planned start year. End date crossing New Year alone causes no
transfer. Changed start year requires formal audited transfer and preserved
approved history, with two-stage approval of affected content. It is not financial
virement or reallocation between Activities.

**Approved bounded business contract; exact implementation in plan 14:**

- Eligible Agent proposes from an approved Activity without another pending
  amendment/withdrawal/transfer, in the same active Project and Partner/MJL scope.
  Target start year strictly later than current placement, within 2000–2200;
  no current-date cutoff. Same-year uses ordinary amendment; backward,
  cross-Project/Partner, closed, unapproved or financially unverifiable cases
  reject. Forward-only is approved in DEC-112.
- Require reason, target dates, expected source version and approved base.
  Retain Activity/reference, Operation IDs/types/allocations, contributors and
  coordination assignments. Restrict changes to dates/placement; other structure
  or budget changes require a separate same-year amendment.
- Submit a dated candidate in one action, starting the pause and fresh two-stage
  review together. Effective approved content/placement remain in source until approval.
  Returns permit correction and fresh submission. Reasoned Agent cancellation
  from every pending stage restores source with history intact. Do not create
  a destination PTA merely for preview/opening or leave one after cancellation.
- At final approval atomically resolve/create unique same-Project target PTA,
  activate target-dated revision, change placement and append source/target/base/
  replacement/reason/actor/time evidence. No second Activity clone or rewritten
  snapshot/decision. Pending snapshots may record intended Project/year before
  target PTA ID exists; activation audit binds the resolved target ID.
- Preserve original create-request provenance/fingerprint forever. Replaying
  original creation after transfer resolves the same Activity, not a duplicate
  source-year record or implicit move back.
- Approved T2: current source contribution ends at transfer time and target
  contribution begins once; prior as-of membership is preserved. For 100 F CFA
  transferred Y→Y+1, current source/target are 0/100, earlier as-of 100/0, never
  100/100 at the same effective instant. Joining only today's `Activity.pta_id`
  cannot establish historical annual membership.
- Duplicate/stale transfer rejects. A subsequent forward transfer needs new
  request/base/version and fresh approvals; preserve the whole placement chain.
  No backward/administrative undo initially. Failed activation rolls back target
  creation, placement, revision activation, decision and audit together.

Future spending stays attached to immutable Operation/Activity and its approved
execution basis. No financial fact moves automatically with planned placement.
Executed Activity transfer and cross-year spending/settlement attribution remain
explicit finance/reporting decisions, not inferred from dates.

## 4. Financial boundaries and sequencing

The new stack has no execution, final spending, financial authorization,
external-virement confirmation, reversement or financial-close records. Missing
financial data is **not zero spending**. Approved allocation alone proves neither
absence of obligations nor external payment. Do not investigate banking custody
or build partial financial execution to unblock these capabilities.

| Scenario | Boundary |
| --- | --- |
| Synthetic planning-only Activity, no execution ever enabled | DEC-112 approves this bounded eligibility model; per-mutation technical proof remains mandatory before any separately authorized implementation is enabled. |
| Real/imported/unverified database; missing or extra schema | Reject. Database naming or absent spending rows alone is insufficient. |
| Open amendment | Reject opening withdrawal/transfer; explicitly resolve the candidate first. |
| Historical approvals only | Preserve every fact; approval is not itself spending. Financial eligibility is independently required. |
| Future execution, finalized spending including explicit zero, financial request/declaration/discrepancy/reversement | Reject until authoritative per-Activity obligations/eligibility and exceptions are approved and implemented. Zero alone clears no obligation. |
| Closed Activity/Project | Reject. Reopening/late exceptions remain L1/L2. Current Project close rejects any contained Activity; do not weaken it as a withdrawal side effect. |
| Unspent allocation | Never redistribute, mark returned or waive required administrative reversement. Resolution is a later financial responsibility. |
| Annual history | Preserve approved snapshots and effective membership/status times; W2 and T2 are separate owner choices. |

Approved F1 is synthetic development only: verify disposable deployment/
artifact and no-import provenance, exact supported planning-only schema and
test-only policy for every affected mutation. Existing exact guard is reusable,
not proof of real-world absence of obligations. Any schema/version change denies.
Realization cutover must replace this temporary proof with authoritative
per-Activity execution/obligation eligibility before these commands resume;
merely accepting a new manifest is forbidden. Unknown responsibilities deny.
No speculative financial table or `has_spending=false` flag.

Implement **PTA-2B.2A withdrawal first** after separate authorization, then
**PTA-2B.2B transfer** after withdrawal completion and its own authorization.
These subdivisions address real placement/replay/migration dependencies. No
further W1/W2/T1/T2/F1 business approval is required. Financial-realization cases
remain later work and do not block these verified synthetic planning-only slices.

## 5. Minimum persistence, API and transactions

The linked plans now fix these technical impacts; the summary below explains reuse. Reuse Activity, Operation,
AnnualPTA, revisions/decisions/contributors, assignment history and atomic audit.
No new table is demonstrated necessary; no generic workflow/state-machine engine.

**Withdrawal:** extend Activity lifecycle/current-request metadata and immutable
revision purpose/base/reason. Retain last content approval independently from
withdrawal approval/effective timestamp. Existing revision/decision tables can
carry the chain. Extend purpose/base/state and same-Activity deferred constraints;
withdrawal approval must never become executable content approval. Pending
request kinds are mutually exclusive. Extend DTO/history/allowed actions/pause
and assignment-ending behavior. Plan 13 fixes SQL fields/states and the single migration; I4 is now a
contract-conformance check, not an unresolved business design.

Proposed responsibilities: reasoned request submission, scoped request read via
existing revision/history, correction/resubmission and review via existing seams,
and reasoned pending-request cancellation. Candidate paths under `/api/v1`:
`POST /activities/{id}/withdrawals` and
`POST /activities/{id}/withdrawals/{request_id}/cancellation` with typed extensions
to submissions/decisions as required. No DELETE or restore.

**Transfer:** Activity ancestry FK currently uses `request_project_id/request_year`,
also create-replay identity. Retain those immutable request fields/fingerprint and
separate current annual placement, adding current-year linkage if needed. Enforce
same fixed Project/MJL/current PTA/year via composite FK and date consistency;
never simply overwrite `request_year`. Candidate snapshots hold purpose/target
year/dates; activation audit binds actual target ID/time. Reuse immutable revisions
and append-only audit for placement events; no separate transfer table is yet
justified. Freeze the exact as-of algorithm using initial approval, each subsequent
content-amendment approval and committed transfer/withdrawal events, with stable
event ordering and scoped lookup before code. Resolve the content revision
effective at the requested time, never today's approved pointer or always the
initial allocation. Pending or cancelled candidates do not change that historical
basis; an approved transfer replacement is itself an effective content approval.

Proposed responsibilities: opening, scoped read, editing/submission, review and
pending cancellation. Reuse amendment preparation/revision/history seams with
explicit purpose guards; ordinary Activity PATCH must not move annual ownership.
Preview reuses Project/year context with nullable PTA. Candidate paths include
`/activities/{id}/transfers` and `/{transfer_id}/cancellation`; plan 14 fixes methods,
payloads and the two new POST responsibilities. No separate annual-PTA
create API or finance route.

One mutation transaction: advisory `1843201` first, current authentication
Context/User and environment guard, Project, relevant PTAs in stable ID order,
Activity, revision and children in stable order. Recheck active Project, current
version/base/request purpose/identity and eligibility before writes and at final
activation. Serialize missing target creation using advisory/Project lock plus
unique Project/year. Preserve login/lifecycle/recovery ordering; never take
advisory after resource rows. No hidden commits/external effects in transaction.

Annual reads need a coherent snapshot across source/target/status/history. Keep
Activity shared locks and specify an atomic annual projection (for example a
single SQL snapshot query) before transfer implementation; independent READ
COMMITTED queries are insufficient. Trusted MJL→Partner→Project ancestry applies
to both endpoints, never browser IDs/assignments alone. Versions, request IDs and
exact bases reject stale/duplicate effects. Reviewers use DEC-108, including
cumulative no-self-validation and distinct identities, not staffing/quorum rules.

Audit each request/edit/resubmission/return/decision/cancel/activation with purpose,
actor/role/time, reason, version, old/new placement/content basis and assignments
ended. Keep bounded material before/after edits before immutable submission;
PTA-2B.1 payload lessons apply. Audit/constraint/commit failure rolls back all rows.
Exact XOF stays unchanged in these bounded proposals.

## 6. A2.2/A3 and cutover

`environment_verified` checks test policy/attested database, exact 19 relations,
`0007_pta2b1`, manifest of columns/constraints/indexes/triggers/functions and MJL
singleton. `lifecycle_eligible` rejects current Agent assignments; historical
contributors/decisions do not block ordinary reviewer deactivation (DEC-108).
Pending withdrawal preserves assignments; only final approval ends them. Transfer
retains them. No reviewer responsibility/handoff is introduced. Contributor
exclusion survives request cancellation, transfer and role changes.

Any eventual migration updates the exact guard with the matching artifact, never
wildcard relation acceptance/auth-only fallback. Cutover uses exact predecessor
creating approved/amended/cancelled history, drained writers, disposable data,
distinct restricted runtime, unchanged histories/replay keys, old-artifact/new-
schema rejection and tamper denial. Refuse destructive downgrade with evidence.
Run A2.2 role/deactivation and A3 request/proof/reset/session regressions on the
new schema. No Admin recovery or real-account enablement.

## 7. Minimal React experience

Extend existing Activity workspace, RestClient/Provider/useAPI, Router search and
Query state. Read `DESIGN.md`, design index/v3 tokens/components and supplied
`docs/inspiration/pta`/`activities` references; existing detail/review/comparison/
history composition is reusable. No new standalone page or unresolved mock
controls. Approved purpose/decision contract and applicable inspiration remain
prerequisites before affected visual implementation.

Withdrawal needs reason/impact confirmation, exact-base review, returned correction,
pending cancellation and read-only effective history. Transfer adds same-Project
destination year/dates, source/target preview, unchanged Operation/amount comparison
and historic context links. French labels distinguish `Retirer l'activité`,
`Annuler la demande de retrait`, `Transférer vers un autre PTA` and
`Annuler l'amendement`; do not suggest released money.

Reuse focus/keyboard/mobile/loading/error/409 feedback and Sonner. Backend allowed
actions are hints, not authorization. Refetch after unknown result; never auto-
repeat a possibly committed mutation. Invalidate Activity list/detail/current/
history and source/target Project/year views plus ended assignments. Old-session
responses cannot restore data. No local duplicate server state, persisted cache,
offline sends/queues/replay or PWA business API caching.

## 8. Focused acceptance oracles

Mandatory future verification, not executed in this documentation task. The
linked plans resolve mechanisms and must be applied alongside these gates. C01–C08 apply to either capability, W01–W06 only to
withdrawal, T01–T08 only to transfer: **14 withdrawal, 16 transfer, 22 distinct
combined gates**, not test-function counts.

| ID | Positive/negative oracle |
| --- | --- |
| C01 | Verified Agent submits; eligible Supervisor then distinct Validator decide. Anonymous/OTP-only/expired/CSRF-invalid/Admin/Partner/wrong-role/cross-resource deny without mutation. Former contributor after role change and same prevalidator/final actor deny; equal Agent access preserved. |
| C02 | F1-approved exact isolated planning provenance passes; unverified/imported/extra or missing relation/altered constraint/unsupported version denies every mutation including decisions. Future financial unknown/nonempty denies; missing spending never becomes zero. |
| C03 | Current version/base/request succeeds once; stale/obsolete/duplicate/replayed cancelled requests produce no duplicate action. Deterministic both-order races with amendment/edit/assignment/review/cancel and role-change/deactivation/recovery yield valid serial outcomes. |
| C04 | Inject audit, real SQL constraint and outer-commit failure for each mutating responsibility; compare all affected Activity/Operation/assignment/revision/decision/contributor/audit rows and target PTA to before-state. No success artifact survives. |
| C05 | Prior snapshots/decisions/contributors byte-stable; direct SQL rejects bad purpose/base/ancestry/pointers and invalid review chain. Maximum Unicode fits Python/PostgreSQL bounds with material edit history. Exact XOF/sums preserved; fractions/overflow deny. |
| C06 | Exact predecessor upgrade/non-owner/tamper/old-artifact/downgrade gates pass. Current assignments still block A2.2, historical reviews do not. A3 and focused PTA-1/2A/2B.1 regressions pass. |
| C07 | OpenAPI/strict DTOs include Origin/CSRF/versions; malformed 422, auth 401/403, scoped missing 404, stale/ineligible 409. DEC-102 history envelope/default 60/max 100; invalid limit/cross-parent cursor deny. No finance/restore/export routes. |
| C08 | Focused real-browser success/return/cancel journeys, French keyboard/mobile/loading/error; Query reconciles delayed/failed refetch/account switch. Offline sends/reconnect replay absent. Lint/format/type/build, independent correction/re-review and disposable teardown pass. |
| W01 | Approved request preserves content/allocation and pauses at submission; draft/initial review/withdrawn/closed/open amendment/transfer deny. Reason/base required; no deletion or draft-abandonment shortcut. |
| W02 | Fresh Supervisor then Validator needed; reasoned returns reach Agent, corrected resubmission gets a new revision/chain. Old content approval cannot approve withdrawal. |
| W03 | Reasoned cancellation at every pending/returned stage restores approved content, retains history/assignments; cancel-vs-approve has one winner. Cancellation after effective withdrawal denies; amendment cancellation unchanged. |
| W04 | Final withdrawal retains content/Operation IDs/amounts, records request/time and ends assignments atomically with actor/time. No new assignments/edit/restore/spending/reversement/physical completion. A2.2 only passes when all current assignments/blockers clear. |
| W05 | W2 example: current 1/100 before/during request, 0/0 after effect, earlier as-of still 1/100; concurrent reads coherent. Add approved amendment 100→120 before withdrawal: historical allocation is 100 before amendment approval, 120 afterward/until withdrawal, then current contribution zero; pending amendment changes nothing. Historical allocation visible, never reusable; zero denominator non-calculable. |
| W06 | Closed Project/unknown obligations deny; Project close still returns `project_not_empty` after withdrawal. No hidden close/reopen or financial waiver. |
| T01 | Approved same-active-Project forward candidate allowed; same-year/backward/out-of-range/cross-Project/Partner/closed/unapproved/open amendment/withdrawal deny. End-only year crossing never transfers. |
| T02 | Submitted/returned review preserves source and approved content; correction needs fresh chain; pending cancellation restores source/history without orphan target. No allocation/Operation structural change piggybacks. |
| T03 | Approval reuses target or atomically creates one Project/year PTA, activates replacement and preserves Activity/reference/Operation identities/amounts/assignments. Preview creates nothing. |
| T04 | Original create replay returns same Activity after transfer; changed original payload conflicts. Original keys/fingerprint/source snapshots byte-stable; SQL denies wrong current PTA/year/Project/MJL. |
| T05 | T2 example: current source/target 0/100, earlier as-of 100/0, no double count. With approved amendment 100→120 before transfer, earlier source values are 100 then 120 by approval time and target receives 120 only on transfer; pending amendment changes nothing. Barrier read-vs-activation proves coherent source/target/history under selected snapshot strategy; no silent historical rewrite. |
| T06 | Two transfers have one winner; two Activities targeting same missing Project/year create one PTA. Races with Project close/ordinary create/cancel/review have valid serial results without deadlock/orphans. |
| T07 | Later forward move needs new request/base/version/fresh chain; old command conflicts, both moves remain historical. No undo. Rollback removes only transaction-created target, never pre-existing PTA. |
| T08 | Future execution/settlement or unknown finances deny, no spending/reversement reattribution/reuse. Closed Activity/Project deny. Query refreshes both annual contexts; old source history remains readable. |

## 9. Remaining gates and owners

| Gate/classification | Status and required evidence | Owner | Scope |
| --- | --- | --- | --- |
| W1/W2/T1/T2/F1 | CLOSED by DEC-112; no repeat business approval. | User | Both bounded slices |
| I4 / BEFORE_AFFECTED_IMPLEMENTATION | Technical contract fixed in plans 13/14; verify actual predecessor, DTO/SQL mappings, snapshot purpose/null cases and annual algorithm conform before edits. Transfer predecessor must be the completed withdrawal artifact. | Implementer | Respective slice |
| C4a/C4b / BEFORE_CUTOVER | Prove isolated provenance, exact predecessor upgrade, restricted runtime, fail-closed guard, migrations, all applicable gates and independent correction/re-review. These are mandatory future evidence, not reasons to claim implementation complete now. | Engineer/operator | Respective synthetic enablement |
| F2 / LATER_SLICE | Authoritative execution/financial obligations and late exceptions before any executed/financially unknown case. Replace temporary proof before enabling lifecycle in realization schema. | Finance/reporting owners and realization engineer | Excluded cases |
| PC1/PC2 / EXTERNAL_SECURITY_DEPENDENCY | Still pending; real accounts/production prohibited. | Sponsor/RSSI | Real-account/production use |

## 10. Initial independent review and verdict (before DEC-112)

Independent engineering review: **PASS** after focused same-reviewer re-review.
Independent security/specification review: **PASS** after focused same-reviewer
re-review. Both identified an omission in the initial as-of description: it
needed subsequent approved amendments as well as initial approval and annual
events. Section 5 and W05/T05 now explicitly resolve the effective historical
content revision, including an approved 100→120 change, excluding pending or
cancelled candidates. No remaining blocking findings. Reviewers inspected the
document and actual surrounding code without editing files or running runtime
tests. PASS validates this NOT_READY decision package, not business approval.

**PTA_2B2_WITHDRAWAL_NOT_READY**: W1/W2/F1 require owner decisions.
**PTA_2B2_TRANSFER_NOT_READY**: T1/T2/F1 require owner decisions.
**Complete PTA-2B.2 is not ready.** No partial READY or implementation permission.
Next implementation recommendation, conditional on decisions/recheck: bounded
PTA-2B.2A withdrawal; transfer needs its own authorization.

Task verification: source/document inspection, new-file/documentation diff review,
`git status`, `git diff --stat`, `git diff`, `git diff --check`. No runtime tests,
builds/migrations/browser runs because no executable changes. Existing lessons
evaluated; no repeated correction warrants an entry. Stop before implementation.

## 11. Current readiness recheck

Independent engineering review: **PASS** for both plans after correction and
same-reviewer re-review. Independent security/specification review: **PASS** for
both plans after focused re-review. Engineering found the existing context/list
inter-statement read race during transfer; both plans now fix the exact shared
advisory-before-auth protocol and require public-route barrier tests at nullable
PTA lookup and membership/count selection. Security verified no implicit lock
upgrade in the current authentication path. No remaining blocking plan findings.

**PTA_2B2_WITHDRAWAL_READY_FOR_AUTHORIZATION**.
**PTA_2B2_TRANSFER_READY_FOR_AUTHORIZATION** after withdrawal completion as the
mandatory predecessor gate. Complete bounded synthetic PTA-2B.2 is technically
ready for sequential authorization; no runtime work is authorized by this review.
I4/C4a/C4b and all 14/16 checks remain mandatory implementation evidence, not passed
runtime checks. PC1/PC2, real accounts and financial execution remain excluded.

Verification: reviewed tracked diff and both new plans directly against actual
code/authority; git diff --check passes. No runtime tests, database changes,
browser runs or builds for this documentation-only work. Existing lessons were
evaluated; the read-race correction is captured in the plans, with no unrelated
lesson or runtime edit. Stop before implementation.
