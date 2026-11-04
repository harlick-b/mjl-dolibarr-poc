# Budget increase and separate funding approval — readiness audit

The 2026-11-04 “review, if ok, commit; go for next” request follows PDF completion
at `20f853a`. That commit still matches contract 56 and its independent review.
The next work is DEC-137 budget insufficiency, governed by the PTA brief §3 and
DEC-089/090. This audit does not invent the unresolved business rules below.

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
   authorization to the approved budget change; representation depends on the
   answers below, rather than speculative tables decided in advance.

The financial guard concerns the **Activity total**; individual Operation variance
may be recorded with an explanation. Do not convert every Operation variance into
an extra-funding request. Amendment approval currently clears its execution pause;
if both approvals become required, add the missing funding blocker explicitly.
Return/cancellation of a funding request must not silently clear an unresolved pause.

## Essential questions sent to the user — not approved decisions

- **Amount:** for 100,000 → 120,000 F CFA, approve the extra 20,000 linked to the
  exact budget revision? Proposal: yes; décaissement still uses final actual spend.
- **Resumption:** must both the budget amendment and separate funding approval pass
  before work resumes? Proposal: yes, each through Supervisor then distinct Validator.
  Current authority explicitly requires budget approval before continuation and
  separate funding approval before décaissement; it does not settle this interval.
- **Already-spent cases before finance begins:** include them now by preserving the
  truthful spending and history, pausing further work and financial requests until
  both approvals? Proposal: yes. Alternatively defer those cases and keep the
  current historical-overspending refusal. No post-settlement exception is proposed.

Affected mutation implementation waits for these answers. No additional external
implementation prompt or repeated authorization is needed once essential choices
are settled within the user's requested next slice.

## Implementation checks to retain when the contract is completed

A focused contract must prove the pause/resume rule, exact approved increment and
revision binding, two distinct approvals/no self-validation, stale/replay rejection,
truthful old/new budgets and actual spending, cancellation/return behavior,
current and historical insufficiency gates, and unchanged frozen settlement basis.
Use deterministic PostgreSQL races around amendment/funding/décaissement,
transactional audit rollback and focused React reconciliation/no offline replay.
Do not expand to late financial exceptions, real transfers or other workflows.

## Independent review handoff

A separate review-only agent checks authority, actual implementation seams and
these gaps without accepting implementer claims. After decisions arrive, the
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
or tests were made by the reviewer. Implementation remains blocked only on the
explicit business choices sent to the user, not a new external prompt.
