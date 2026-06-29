# MJL Clarity System - Phase 11 Expense And Document Workflow Compliance Report

## Scope

Phase 11 redesigns the MJL expense workflow and supporting-document surface. Changes stay inside `custom/mjlfinancement`, E2E tests, documented smoke verification, and this documentation.

This phase uses "Phase 11" for the next concrete implementation phase. The original master plan labels Phase 11 as broad E2E coverage, but this repository already adds E2E coverage phase by phase.

## Safe Boundary Evidence

- Dolibarr core files are not modified.
- Expense UI changes are contained in `/custom/mjlfinancement/expenses.php` and existing MJL CSS classes.
- Expense workflow hardening is contained in `custom/mjlfinancement/class/mjlexpense.class.php`.
- Alert, dashboard, and activity links are updated only in MJL custom-module files.
- No schema migration is added.
- ECM remains the storage layer for supporting documents.

## Implemented Surfaces

- `/custom/mjlfinancement/expenses.php` now has a scoped list view and `?id=` detail view.
- Expense detail is status-first, with summary, document panel, decision panel, and validation timeline.
- Level 1 operational users remain scoped to their own expenses.
- Level 2 validators see submitted expenses and prior decisions, but self-owned submitted expenses are not actionable.
- DPAF/Admin/read-only visibility remains bounded by existing rights and temporary workspace capabilities.
- Supporting-document state uses the shared helper semantics, including ECM-only evidence where `supporting_document` is empty.
- Expense alerts and activity linked-expense rows now link to expense detail pages.
- DPAF pending-review rows link directly to expense detail pages.

## Constraints Check

- No public register page was created.
- Invitation-only access remains unchanged.
- Only Admin invitation management remains unchanged.
- Existing active-entity filtering is preserved.
- Expense document-required validation, budget-overspend checks, audit history, correction flow, and exports are preserved.
- Expense no-self-validation is now enforced in UI/page guards and in `MjlExpense`.
- Validation buttons are not shown when a submitted expense lacks a supporting document.
- No final permission matrix, N+1/N+2 split, alert scheduling, PDF output, or native menu hiding was introduced.

## E2E Coverage Added

Playwright spec `tests/e2e/phase11-expense-workflow.spec.js` covers:

- Level 1 own expense detail, document upload, submission, and missing-document alert removal.
- Level 1 blocking from another operational user's expense and another entity's expense.
- Level 2 validation of a submitted expense with a document.
- ECM-only supporting-document fallback display.
- Missing-document validation blocked in UI and by direct POST.
- Rejection, correction, resubmission, and preserved timeline comments.
- Self-review controls hidden and direct POST blocked with no audit row.
- Tampered create POST with mismatched project/convention rejected server-side.
- DPAF, Admin, and read-only role visibility.

## Verification

Static checks run during implementation:

- `php -l custom/mjlfinancement/expenses.php`
- `php -l custom/mjlfinancement/class/mjlexpense.class.php`
- `php -l custom/mjlfinancement/lib/mjl_alerts.lib.php`
- `php -l custom/mjlfinancement/activities.php`
- `php -l custom/mjlfinancement/lib/mjl_workspace.lib.php`
- `php -l custom/mjlfinancement/dpafdashboard.php`
- `php -l custom/mjlfinancement/scripts/smoke_expense_validation.php`
- `node --check tests/e2e/phase11-expense-workflow.spec.js`

Runtime verification passed:

- `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php`
- `npm run test:e2e -- tests/e2e/phase11-expense-workflow.spec.js`
- `npm run test:e2e -- tests/e2e/phase6-level-dashboards.spec.js tests/e2e/phase7-activity-workflow.spec.js tests/e2e/phase8-alerts-risks.spec.js tests/e2e/phase9-tables-exports.spec.js tests/e2e/phase10-email-templates.spec.js tests/e2e/phase11-expense-workflow.spec.js`

The first phase 11 E2E attempt exposed an ambiguous text locator in the test, not an application failure. The assertion was narrowed and the rerun passed.

## Known Limitations

- No document preview/download route is added in this phase; the UI displays supporting-document state and filename evidence.
- Expense workflow emails are not implemented.
- Alert emails, PDF/print official outputs, export audit logging, native menu hiding, and convention/envelope naming remain deferred.
