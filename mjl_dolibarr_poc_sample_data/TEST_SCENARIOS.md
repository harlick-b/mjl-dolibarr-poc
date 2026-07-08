# MJL Sample Data Test Scenarios

These scenarios exercise local fixture data only. Production decisions come
from `../docs/mjl-authoritative-decisions.md`; active verification guidance is
in `../docs/mjl-acceptance-tests.md`.

## Scenario 1 - Happy Path Expense Validation

Use:

- `PTF-UNICEF`
- `PRJ-JE-2026`
- `CONV-UNICEF-2026-001`
- `ACT-JE-001`
- `BL-JE-001`
- `EXP-JE-001`

Expected result:

- Expense is visible under the right project, convention, activity, and budget
  line.
- Supporting document is attached.
- Status and validation dates are visible.
- Report `RPT-001` includes the expense in the expected expense totals.

## Scenario 2 - Submitted Expense Awaiting Validation

Use:

- `EXP-JE-002`

Expected result:

- Expense status is submitted or waiting for review.
- It appears in pending/submitted expenses.
- It is not counted as final validated expenditure until the workflow reaches
  that state.

## Scenario 3 - Over-Budget Rejection

Use:

- `EXP-JE-003`

Expected result:

- Expense is rejected.
- Rejection reason is visible.
- It does not reduce the final validated budget execution total.
- It remains visible in audit history.

## Scenario 4 - Corrected Expense

Use:

- `EXP-JE-004`

Expected result:

- Expense correction state/reason is visible.
- It can be resubmitted and reviewed according to the current workflow.

## Scenario 5 - Missing Supporting Document

Use:

- `EXP-JE-005`

Expected result:

- Expense remains draft or cannot progress to protected validation states.
- The missing supporting document is clearly visible.

## Scenario 6 - Funds Received By Convention

Use:

- `FR-UNICEF-001`
- `FR-UNICEF-002`

Expected result:

- Funds received total for `CONV-UNICEF-2026-001` is visible.
- Reports show received funds separately from expenses.

## Scenario 7 - Legacy Read-Only Fixture Access

Use:

- user `lecteur.audit`

Expected result:

- User can view allowed fixture reports/screens.
- User cannot create or edit convention, budget line, fund receipt, or expense.
- Export behavior follows the active permission matrix.

## Scenario 8 - Draft Project Without Funds

Use:

- `PRJ-EXT-2026`
- `CONV-TEST-2026-001`

Expected result:

- Project/convention can exist in draft.
- No fund receipt has been received.
- Reports do not break with zero funding.
