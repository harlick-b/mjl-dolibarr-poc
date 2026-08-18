# RST-004 Execution Report

- Status: `EXECUTED_PENDING_RATIFICATION`; implementation is complete, but
  the combined operational-log checksum deviation awaits explicit approval.

- Authorization: explicit user approval received before mutation.
- Date and target: 2026-08-14, local Docker Compose tenant.
- Preconditions: every finance table had exactly zero rows.
- Result: Convention, budget-line, fund-receipt, Expense, and validation
  routes, classes, helpers, schemas, update SQL, and obsolete tests were
  removed. Activity no longer has fk_convention and remains read-only.
- Containment: document, alert, and old supervision routes return explicit
  403 responses pending their target units.
- Verification: removed-route 404s, schema absence, empty tenant, PHP syntax,
  and disposable browser gates passed.

No finance value was archived, inferred, or migrated.

Exact combined cutover evidence and exceptions are recorded in
`docs/mjl-phase1-reset-execution-report.md`.
