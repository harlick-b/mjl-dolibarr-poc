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
- The Partenaires / Programmes route implements the 5R partner workspace:
  scoped list/detail access, identity summary, explicit `entity + fk_soc`
  portfolio KPIs, related projects/envelopes/budgets/activities/expenses/funds,
  guarded document links, computed alerts, read-only contextual history, and
  Admin-only assigned-user visibility.
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
- Report option lists and export row queries are partner/programme scoped for
  non-admin users; unresolved rows fail closed through scope joins/filters.
- Guarded document downloads record best-effort `document_downloaded` workflow
  audit rows after successful path resolution.
- CSV/XLSX exports record `export_generated` workflow audit rows anchored to
  stable `mjlfinancement_report` rows.
- Project create/update inside the MJL workspace records workflow audit rows
  with production actor-role labels.
- Phase 8R contextual exchanges are implemented for project, activity, expense,
  convention, budget-line, and fund-receipt detail pages. New comments are
  written to `mjlfinancement_exchange_log` with channel `commentaire` through
  the object page's own access guard and the `exchangelog/write` permission.
- `exchangelogs.php` is now a read-only advanced search/audit surface under the
  advanced traceability guard; normal exchange creation happens contextually.
- Phase 9R operational alerts are computed live through
  `custom/mjlfinancement/lib/mjl_alerts.lib.php`; no alert table or schema
  migration was added. The alert page, dashboard alert metrics, and supervision
  alert cards consume the centralized helper.
- Alert payloads now carry `type`, `domain`, `object_type`, `object_id`, `ref`,
  `label`, `severity`, `tone`, `audience`, `expected_action`, `href`,
  `sort_date`, and `meta`. `alerts.php` supports the allowlisted scopes `all`,
  `activities`, `expenses`, and `finance`, with invalid values falling back to
  `all`.
- Phase 9R alert generation filters by active entity and assigned Partenaire /
  Programme through the target object's convention/project partner. Only
  `ADMIN_PLATEFORME` or Dolibarr admin gets unrestricted scope; finance alerts
  are suppressed when the current user cannot open the guarded target route.

## Current Compatibility Debt

- Local bootstrap and seed scripts still use POC names for fixture setup and
  legacy migration.
- Some untouched code labels still use DPAF, Conventions, Depenses, and
  Echanges.
- The module descriptor and language files still contain POC wording.
- Download/export audit is not fully proven across every path.
- Generic report-export audit rows do not resolve to a Partenaire / Programme;
  non-admin audit views that enforce object-scope resolution may therefore hide
  those generic report audit rows until a report-scope model is defined.
- `audit_unresolved_scope.php` now reports positive workflow/exchange object
  pointers that cannot resolve to a supported target; current local data may
  contain historical orphan rows that must be cleaned before the audit passes.
- The known Phase 8R unresolved-scope historical orphan-row debt remains data
  debt unless a current verification run reports new Phase 9R-owned unresolved
  rows.
- Final client-approved permission matrix and report templates remain pending.
- 5R partner funding totals use received fund receipts as `Financement total
  recu`; envelope amounts are not treated as received funding. Negative
  unallocated budget is displayed as an over-allocation warning rather than
  clamped.

## July 9, 2026 Phase 7R Finance Alignment Pass

- 6R evidence gate: the worktree contains
  `tests/e2e/phase6r-project-activity-execution.spec.js` and modified
  project/activity execution code, so the previous statement that Sub-phase 6R
  was not started is stale implementation-summary debt.
- Phase 7R added a centralized internal finance metrics helper for budget
  submitted, prevalidated, final validated, disbursed, remaining, validation
  rate, and execution rate calculations.
- Expense create option lists and POST validation now apply active-entity and
  assigned Partenaire / Programme scope for project, programme/envelope,
  activity, and budget-line links.
- Fund receipts can be attached to active global partner/programme envelopes
  without a project; budget lines and expenses remain project-bound.
- A guarded SQL update was added to make `mjlfinancement_fund_receipt.fk_project`
  nullable when a runtime tenant still has the old NOT NULL shape.
- Expense document uploads now write both expense validation history and
  workflow audit rows.
- Touched finance labels were aligned toward Partenaire, Programme,
  Administrateur plateforme, and Validateur definitif wording.

## July 9, 2026 5R Partner Workspace Pass

- 5R status: DONE after focused PHP syntax, E2E, scope smoke, and unresolved
  scope audit verification.
- Sub-phase 5R was implemented in `custom/mjlfinancement/partners.php`; no
  schema migration was added in that pass. The later 6R worktree evidence means
  any "6R not started" reading is stale.
- Partner portfolio KPIs are computed from explicit active-entity and
  `fk_soc`-scoped SQL instead of activity/expense queue helpers.
- Partner detail remains read-only for contextual history and uses existing
  guarded detail/download routes for actions and documents.
- Focused E2E coverage was added to
  `tests/e2e/phase3-partners-project-finance.spec.js` for required 5R labels,
  cross-scope fixture exclusion, guarded document links, and Admin-only
  assigned users.

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

## July 9, 2026 Phase 9R Alerts Alignment Pass

- Centralized live alert generation in `mjl_alerts.lib.php` for activity,
  expense, and finance alerts.
- Added activity alerts for deadline soon, overdue, role-specific
  prevalidation/final-validation queues, returned correction work, and stale
  physical execution.
- Added expense alerts for role-specific validation queues, returned
  corrections, missing/unavailable justificatifs, budget overspend candidates,
  and final-validated-but-not-disbursed expenses.
- Added finance alerts for active budget-line warning/critical thresholds based
  on final-validated consumption, and active funding envelopes ending within
  seven days.
- Added focused E2E coverage in
  `tests/e2e/phase9r-alerts-alignment.spec.js` for alert classes, scope tabs,
  cross-partner isolation, and finance-route suppression.
- Verification run during this pass:
  `git diff --check` passed;
  `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`
  passed;
  focused Playwright
  `tests/e2e/phase9r-alerts-alignment.spec.js` passed;
  `smoke_scope_model.php` passed;
  `smoke_activity_workflow.php` passed;
  `smoke_expense_validation.php` passed.
- `audit_unresolved_scope.php` still fails on the known historical unresolved
  workflow/audit row debt. The reported refs did not include Phase 9R fixture
  refs.

## July 9, 2026 Phase 8R Contextual Exchanges Pass

- Added `custom/mjlfinancement/lib/mjl_timeline.lib.php` for exchange
  allowlist validation, labels, actor-role resolution, contextual comment
  creation, and exchange timeline rows.
- Activity, expense, project, convention, budget-line, and fund-receipt detail
  pages can show contextual exchange history; users without
  `mjlfinancement/exchangelog/write` see history without a comment form.
- Existing project notes remain readable as legacy timeline entries; new
  project comments are exchange-log rows.
- Partner/programme aggregate history includes exchange rows for all supported
  object types, including projects and budget lines.
- Verification run during this pass:
  `git diff --check` passed;
  `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`
  passed;
  `smoke_scope_model.php` passed;
  `smoke_traceability_exports.php` passed after adding non-activity exchange
  coverage;
  focused Playwright
  `tests/e2e/phase8r-contextual-exchanges.spec.js` passed.
- `audit_unresolved_scope.php` failed in the current local database because it
  now reports historical orphan workflow rows. This is data debt, not a syntax
  failure.

## July 8, 2026 Baseline And Alignment Pass

- Starting worktree already had modified docs:
  `docs/mjl-current-vs-target-gap-analysis.md`,
  `docs/mjl-doc-cleanup-inventory.md`, `docs/mjl-docs-index.md`, and
  `docs/mjl-stale-reference-audit.md`, plus untracked
  `docs/mjl-post-cleanup-alignment-report.md`.
- Baseline `git diff --check`: passed.
- Baseline PHP syntax check:
  `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`:
  passed.
- Available npm scripts: `test:e2e` only. No `composer.json`,
  `composer test`, `vendor/bin/phpunit`, `npm test`, or `npm run test` script
  was present at baseline.
