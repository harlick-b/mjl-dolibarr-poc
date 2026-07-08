# Phase 5 - Expense / Decaissement Workflow

## Goal

Implement the production expense and disbursement workflow, separating business
final validation from actual money movement.

## Scope

- Add or verify requested, prevalidated, definitively validated, and disbursed
  amounts.
- Add or verify expense and disbursement dates, beneficiary, actors, comments,
  and supporting document behavior.
- Introduce production workflow states without destructive integer-status
  repurposing.
- Enforce justificatif, budget protection, no-self-validation, and no
  self-disbursement.

## Verification

- Full expense/disbursement workflow E2E.
- Missing justificatif blocks final validation.
- Overspend blocks final validation and disbursement.
- Financial KPIs change after final validation and disbursement.

