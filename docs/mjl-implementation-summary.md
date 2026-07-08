# MJL Implementation Summary

This file summarizes what is actually implemented. Target decisions remain in
`docs/mjl-authoritative-decisions.md`; current-state detail remains in
`docs/mjl-current-app-functional-map.md`.

## Current Module

- Custom module path: `custom/mjlfinancement`.
- Module descriptor: `modMjlFinancement`, version `0.10.0`.
- Runtime: Dolibarr 23.0.2 with MariaDB 11 through Docker Compose.
- Native dependencies: third parties, projects, ECM/documents, exports,
  users/groups/rights.

## Implemented Capabilities

- MJL workspace shell, role-aware dashboard, grouped sidebar, and guarded
  native-route behavior.
- Invitation-only access administration and token-based invitation acceptance.
- Production role/scope tables and helpers for one global business role and
  assigned Partenaires / Programmes.
- Partner/programme, project, activity, expense, document, alert, supervision,
  report/export, validation history, workflow audit, and exchange-log routes.
- Activity workflow with prevalidation, final validation, no-self-review,
  physical execution fields, workflow history, and document support.
- Expense workflow with prevalidation, final validation, disbursement,
  no-self-review/disbursement, supporting-document checks, budget checks, and
  validation history.
- Governed convention, budget-line, and fund-receipt management.
- Guarded document downloads for expenses, fund receipts, activities, and
  conventions.
- CSV/XLSX report/export center with French labels, server-side filters, and
  stable filenames.

## Current Compatibility Debt

- Local bootstrap and seed scripts still use POC names for fixture setup and
  legacy migration.
- Some code labels still use DPAF, Conventions, Depenses, and Echanges.
- The module descriptor and language files still contain POC wording.
- Download/export audit is not fully proven across every path.
- Final client-approved permission matrix and report templates remain pending.

## Durable Verification Evidence

Historical docs recorded successful focused checks for:

- schema audits through `audit_schema_0.10.0.php`;
- `smoke_scope_model.php`;
- `smoke_activity_workflow.php`;
- `smoke_expense_validation.php`;
- `smoke_traceability_exports.php`;
- focused Playwright suites for auth/access, workspace navigation, activity
  workflow, expense/document workflow, alerts, reports/exports, and governed
  finance screens.

Historical pass counts are not current verification. Re-run checks from
`docs/mjl-acceptance-tests.md` before making production-readiness claims.
