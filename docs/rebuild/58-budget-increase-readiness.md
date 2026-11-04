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
now recorded in the sequence above. The implementation evidence below supersedes
that historical unverified status.


## Implementation and verification — 2026-11-04

Implemented and verified. The user initially requested leaving changes
uncommitted, then explicitly authorized committing them. Migration
`0024_budget_funding` follows `0023_real_mail_accounts`; the prerequisite received
its own correction/re-review and verification recorded in contract 57. No production database or real mail was used for these
checks.

The existing workspace now offers exact-increment funding submission, separate
Supervisor/Validator review, reasoned return/cancellation and immutable history.
Five REST responsibilities live under `/api/v1/activities/{id}/funding-requests`
(list, detail, submission, decisions, cancellation). Two focused tables hold the
request and decision evidence. No dependency, generic workflow infrastructure or
Activity state was added. Outstanding increases and truthful historical shortages
keep execution/finance paused; bounded reasoned downward corrections remain
possible without removing that pause. Frozen settlement remains unchanged.

The tested candidate was isolated at `/tmp/mjl-budget-increase` against the
captured pre-task `/tmp/mjl-budget-baseline`, then applied as a scoped patch to the
main workspace. All 27 changed source/test paths matched byte-for-byte after
integration. SHA-256 of sorted path + NUL + bytes + NUL:
`52d4839c2ec7758fc87c7f25d240ff245dfceab9805a44d7ff98c63c016acc01`.
Runtime-only identity (excluding tests and browser fixtures):
`c5afa2a92cbb5c21a124d70046cfd210cce41ec73c081a036ebc6ef6883600b9`.
Exact schema fingerprint:
`2dbb6ca3e2390ad82170906e0a8e863b705ed81a256e5dcce3d629e5e46635b4`.

### Final candidate checks

PostgreSQL checks ran through `/tmp/mjl_budget_check.py` using the candidate's
locked-dependency `mjl-budget-test:local` image, a fresh disposable PostgreSQL 16
container/database per invocation, synthetic fixtures and teardown. The wrapper
runs `python -m pytest -p no:cacheprovider -q` with the arguments below.

- `tests/test_funding.py -x --tb=short`: **20 passed**, 217.82s
  (`/tmp/mjl-funding-final.log`). Covers F01–F11, including three deterministic
  lock races, audit/constraint/commit rollback, direct-write constraints, exact
  increments, repeated revisions, corrections, migration refusal/roundtrip and
  exact-schema drift refusal.
- Focused execution/amendment/finance/authentication regressions: **22 passed**,
  98.00s (`/tmp/mjl-funding-focused-final.log`); exact selection below.
- `tests/test_database.py tests/test_health.py --tb=short`: **6 passed**, 22.94s
  (`/tmp/mjl-funding-schema-contract.log`), including final head/table inventory
  and REST/OpenAPI validation after adjacent head assertions were reconciled.
- `npm run test:unit -- src/execution.test.jsx`: **25 passed**, 18.81s
  (`/tmp/mjl-funding-ui-final.log`). Includes funding-query refresh after spending
  correction and fresh server versions for funding actions.
- `npx playwright test e2e/funding.spec.js`: **6 passed**, 6.8s
  (`/tmp/mjl-funding-browser-final.log`), Agent/Supervisor/Validator at desktop and
  mobile widths. Browser transport is mocked; PostgreSQL tests exercise server
  authorization and transactions.
- `npm run lint`, touched-file Prettier checks and `npm run build`: passed.
  Build retains the existing large-chunk warning. Final lint/build logs are
  `/tmp/mjl-funding-eslint-final.log` and `/tmp/mjl-funding-build-final.log`.
- In the locked image, `ruff check app migrations/versions/0024_budget_funding.py
  tests/test_funding.py tests/test_execution.py tests/test_disbursement.py`,
  `ruff format --check` on the same paths, and
  `mypy --cache-dir=/tmp/mypy-cache app`: passed; **42 files formatted, 37 source
  files typed** (`/tmp/mjl-funding-python-quality-final.log`). Read-only candidate
  mount and temporary writable Ruff/mypy caches were used.
- `git apply --check`, post-integration byte comparison and `git diff --check`:
  passed. F01–F12 have the required focused evidence; no production acceptance
  or broader historical-suite result is claimed.

Exact focused regression selection (all prefixed `backend/` in the repository):

```text
tests/test_execution.py::test_execution_evidence_refuses_destructive_downgrade
tests/test_execution.py::test_approved_budget_amendment_preserves_execution_and_recording_basis
tests/test_disbursement.py::test_submission_rejects_incomplete_zero_and_overspent_activity
tests/test_disbursement.py::test_historical_overspending_remains_blocked_after_budget_increase
tests/test_disbursement.py::test_financial_evidence_refuses_destructive_downgrade
tests/test_disbursement.py::test_missing_execution_audits_fail_closed
tests/test_disbursement.py::test_submission_serializes_with_execution_correction_and_amendment
tests/test_amendments.py::test_m06_m08_amendment_requires_fresh_chain_and_activates_atomically
tests/test_amendments.py::test_m13_cancellation_restores_approved_content_and_preserves_evidence
tests/test_zero_spending.py::test_agent_declares_zero_distinct_reviewers_approve_and_agent_closes
tests/test_virement.py::test_agent_declares_exact_external_transfer_and_corrects_with_history
tests/test_auth.py::test_full_http_journey_requires_otp_and_revokes_old_session
tests/test_lifecycle.py::test_guard_rejects_unknown_schema
```

Earlier broad-suite attempts are **not passes**: one was interrupted after
outdated budget/head assertions failed. The relevant failures were corrected and
rerun in the focused selection above. Earlier logs also contain missing host
XlsxWriter/Jinja2 dependencies and a read-only Ruff cache failure; the final
locked-image checks supersede those attempts, not their historical record.

### Independent review

Separate engineering and security/specification reviewers inspected the scoped
diff, surrounding code, contract and evidence without modifying implementation.
Accepted findings were fixed and returned to the same reviewers: reject migration
of incompatible frozen financial history; allow bounded truthful corrections
while retaining the pause; refresh funding Query state after execution changes;
and localize all new funding copy. Both reviewers then confirmed no remaining
blocking finding or mandatory verification gap. They independently inspected the
candidate identities and final command logs; they did not rerun database/browser
suites. Security also verified the integrated runtime identity and final evidence
document. This signoff covers funding only, not the separate mail work or
production readiness.

The lesson review found these fixes covered by the existing server-snapshot and
focused-verification rules; no new general process or speculative cleanup was
added. Stop after this funding slice. Settlement exceptions, banking, reopening,
production enablement and later work remain excluded.
