# MJL Dolibarr POC — Test Scenarios

## Scenario 1 — Happy path expense validation

Use:
- `PTF-UNICEF`
- `PRJ-JE-2026`
- `CONV-UNICEF-2026-001`
- `ACT-JE-001`
- `BL-JE-001`
- `EXP-JE-001`

Expected result:
- Expense is visible under the right project, convention, activity and budget line.
- Supporting document is attached.
- Status is `validated`.
- Validator and validation date are visible.
- Report `RPT-001` includes the expense in validated expenses.

## Scenario 2 — Submitted expense awaiting validation

Use:
- `EXP-JE-002`

Expected result:
- Expense status is `submitted`.
- It appears in pending/submitted expenses.
- It is not counted as validated expenditure until validation.

## Scenario 3 — Over-budget rejection

Use:
- `EXP-JE-003`

Expected result:
- Expense is rejected.
- Rejection reason is visible.
- It should not reduce the validated budget execution total.
- It should remain visible in the audit trail.

## Scenario 4 — Corrected expense

Use:
- `EXP-JE-004`

Expected result:
- Expense status is `corrected`.
- Correction reason is visible.
- It can be resubmitted or validated depending on the chosen workflow.

## Scenario 5 — Missing supporting document

Use:
- `EXP-JE-005`

Expected result:
- Expense remains draft or cannot be submitted.
- System should clearly show that the supporting document is missing.

## Scenario 6 — Funds received by convention

Use:
- `FR-UNICEF-001`
- `FR-UNICEF-002`

Expected result:
- Funds received total for `CONV-UNICEF-2026-001` is 4,000,000 XOF.
- Reports show received funds separately from expenses.

## Scenario 7 — Read-only access

Use:
- user `lecteur.audit`

Expected result:
- User can view reports.
- User cannot create or edit convention, budget line, fund receipt or expense.
- User cannot export if you enforce the sample permission matrix strictly.

## Scenario 8 — Draft project without funds

Use:
- `PRJ-EXT-2026`
- `CONV-TEST-2026-001`

Expected result:
- Project/convention can exist in draft.
- No fund receipt has been received.
- Reports should not break with zero funding.
