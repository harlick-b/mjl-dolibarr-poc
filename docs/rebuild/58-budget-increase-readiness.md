# Budget increase and separate funding approval — implementation contract

The 2026-11-04 “review, if ok, commit; go for next” request follows PDF completion
at `20f853a`. That commit still matches contract 56 and its independent review.
The next work is DEC-137 budget insufficiency, governed by the PTA brief §3 and
DEC-089/090. The subsequent user reply approved all three proposals (DEC-139).
Implementation is authorized; the earlier decision-blocked audit is historical.

## What can be reused

- An Agent already opens a reasoned amendment to an approved Activity; execution
  pauses immediately. Existing candidate editing, fresh Supervisor/Validator
  decisions, cancellation and immutable revision/audit history apply.
  `backend/app/planning/routes.py:1740` is the existing opening seam.
- Execution facts survive an approved budget amendment, including their original
  recording basis. See `test_approved_budget_amendment_preserves_execution_and_recording_basis`
  in `backend/tests/test_execution.py`.
- Existing active décaissement and zero-spending requests freeze the financial
  basis through `financial_freeze_reason`/`assert_disbursement_unfrozen` in
  `backend/app/planning/disbursement.py`. Preserve this guard; no late settlement
  adjustment, reopening, new banking operation or surplus reallocation is implied.
- Reuse role/resource authorization, advisory lock/version checks, immutable
  snapshots, transactional audit, current review UI and online-only Query behavior.
  No generic financial-workflow framework or replacement amendment system is needed.

## Actual gaps

1. `execution.py:714` permits recording true spending above approved allocation
   (subject to exact amounts, observations and correction reasons); it does not
   create a durable funding-shortfall pause. The first financial request rejects
   a current overspend in `verified_financial_basis` (`disbursement.py:195`).
2. `verified_financial_basis` also rejects overspending against an earlier approved
   allocation, even after the budget increases. Existing
   `test_historical_overspending_remains_blocked_after_budget_increase` deliberately
   protects this boundary. Simply deleting that guard would erase an approval
   requirement and is not an acceptable implementation. The guard also rejects
   a mistaken historical over-budget entry later corrected down; distinguish that
   from genuinely spent extra funds when resolving the approved correction rules.
3. The distinct Agent → Supervisor → Validator funding authorization required by
   DEC-089/brief §3 has no current representation or workflow. Décaissement and
   virement cannot silently stand in for this approval. Evidence must bind any new
   authorization to the approved budget change; representation follows the
   approved decisions below, rather than speculative tables decided in advance.

The financial guard concerns the **Activity total**; individual Operation variance
may be recorded with an explanation. Do not convert every Operation variance into
an extra-funding request. Amendment approval currently clears its execution pause;
because both approvals are required, add the missing funding blocker explicitly.
Return/cancellation of a funding request must not silently clear an unresolved pause.

## Approved decisions (DEC-139)

- **Amount:** authorize the exact positive increment tied to the approved budget
  revision. For 100,000 → 120,000 F CFA, request 20,000. Décaissement continues to
  use final actual spending, not the allocation or increment.
- **Resumption:** both the amendment and separate funding request must pass
  Supervisor then distinct Validator review before work resumes.
- **Already spent before finance:** include these cases; retain truthful spending
  and history, blocking further work and financial requests until both approvals.

No additional external implementation prompt or repeated authorization is needed.

## Bounded implementation sequence

1. Extend the existing amendment/execution seams with a durable funding blocker.
   Planning approval alone must not release an unfunded increase. Recording
   Activity-total overspending preserves the record and blocks subsequent work;
   individual Operation variance alone does not trigger this workflow.
2. Add focused funding requests and immutable decisions, following existing
   financial review conventions. Bind old/new approved revisions, allocations and
   server-calculated positive increment. Reuse role checks, contributor exclusions,
   Activity versions, advisory-lock-first transactions and atomic audit. A forecast
   increase needs no execution history: do not inherit décaissement's prerequisite
   of completed work. No generic workflow framework is needed.
3. Preserve all outstanding increases across subsequent revisions. For 100→120
   then 120→150, require separate approvals for 20 and 30. A later decrease cannot
   silently erase an earlier unfunded increase. Return/cancel retains history and
   leaves the unresolved pause; fresh submission needs fresh decisions.
4. Keep historical financial verification. Replace unconditional historical
   overspending refusal only with verification of the covering approved revision
   and funding evidence. A downward correction must not silently erase the
   earlier record or establish that real earlier spending never occurred.
5. Extend the current Activity workspace with the blocked reason, calculated
   increment, submission, review and history. Reuse French components, RestClient,
   Router search and Query reconciliation, with no offline mutation replay.
6. Verify the checks below, independently review the final candidate, fix accepted
   findings, rerun affected checks and return it to the same reviewers. Update the
   roadmap/evidence once; commit only after mandatory gates pass.

Preserve the unrelated mail/account work. Choose the migration predecessor from
its actual integrated schema, without competing heads or a weakened exact-schema
check. Reconcile prior data conservatively; test only disposable synthetic data.
Late settlement changes, reopening, banking and unrelated features remain excluded.

## Mandatory verification

| Check | Expected result |
| --- | --- |
| F01 Forecast increase | An Agent can amend 100,000 to 120,000 before execution; funding amount is exactly 20,000 and cannot be supplied by the client. |
| F02 Two approvals | Amendment approval keeps execution blocked; only a separate eligible Supervisor and distinct Validator funding chain releases it. |
| F03 Already spent | Recording 110,000 against 100,000 retains truthful history and pauses further work/finance; approved 120,000 revision plus 20,000 funding resolves the shortage without rewriting old facts. |
| F04 Role isolation | Admin/Partner cannot mutate; Agent cannot review; contributors, submitter and execution authors cannot validate their own work after role changes. |
| F05 Repeated revisions | 100→120 then 120→150 need independent 20 and 30 approvals; unfunded 100→150 followed by 150→120 cannot erase the outstanding approval requirement. |
| F06 Return/cancel | Reason required, immutable history retained, unresolved pause retained, fresh request requires both new decisions. |
| F07 Correction/variance | Individual Operation variance within the Activity total does not require funding; reasoned corrections preserve original records and never silently waive a genuine historical shortfall. |
| F08 Frozen finance | Active décaissement or zero-spending basis remains frozen; no funding route modifies approved settlement, reopens closed work or starts banking. |
| F09 Concurrency/replay | Deterministic PostgreSQL amendment/funding/execution/décaissement races produce one valid ordered outcome; stale versions and request replay cannot duplicate approvals or unblock prematurely. |
| F10 Atomicity/integrity | Audit, constraint and commit failures roll back state/decisions together; malformed direct writes cannot fabricate a valid approval chain or alter its immutable basis. |
| F11 Migration | Disposable predecessor upgrade preserves records, repeat upgrade is stable, fresh head works, incompatible destructive downgrade refuses; exact-schema checks accept only the intended schema. |
| F12 UI/API | French workspace shows authoritative blockers/amount/actions/history; all affected Query views refresh, stale forms conflict, no offline replay; role journeys, REST/OpenAPI, lint/format/typing/build and focused amendment/execution/finance regressions pass. |

Record commands, candidate identity and actual results. Reuse existing coverage;
missing execution evidence remains a gate, not a presumed pass. No historical
suite or production audit is required merely because this contract exists.

## Independent review handoff

A separate review-only agent checks authority, actual implementation seams and
these gaps without accepting implementer claims. During implementation, the
implementation plan must retain the mandatory independent engineering/security
review, implementer correction and same-reviewer re-review cycle. No completion
claim until required checks and blockers pass.

## Audit evidence

Read-only code/document inspection; no runtime changes or test data created.
Documentation checks: `git status`, scoped diff/stat, direct new-file review and
`git diff --check`. Runtime suites are not needed for this decision-blocked audit.
Independent security/specification review confirmed the actual code paths and
all four findings: recording overspend, amendment pause/preservation, missing
separate funding approval and historical-overspending refusal. Its correction/
cancellation and Activity-total cautions are recorded above. No source changes
or tests were made by the reviewer. That audit awaited the business choices. All three are now approved. This is
historical audit evidence, not runtime implementation or test evidence.


The independent pre-implementation security audit confirmed no remaining business
contradiction. It identified the forecast/no-execution prerequisite, sequential
increase/decrease bypass, reasoned-correction history and cancellation safeguards
now recorded in the sequence above. Runtime implementation remains unverified.
