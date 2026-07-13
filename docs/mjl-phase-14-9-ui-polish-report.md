# MJL Phase 14.9 UI Polish Report

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Verdict

`DEMO_UI_READY_WITH_NOTES`

Phase 14.9 was completed as a gated UI/navigation polish pass only. No client
validation was run, no production readiness is claimed, and no business
behavior, schema, route filename, permission code, workflow transition, KPI
formula, report key, export column, or export filename was changed.

## Changes Made

- Created `docs/mjl-demo-ui-polish-plan.md` before source edits with inspected
  pages, safe fixes, deferred decisions, stop conditions, and the status-label
  mapping.
- Aligned visible finance/navigation labels toward `Enveloppe de financement`,
  `Partenaire / Programme`, `Fonds reçus`, `Historique / Audit`, and
  production role wording.
- Replaced display-only `Validee legacy` wording on touched pages/helpers with
  final-validation compatibility wording where the status already represents
  historical final validation.
- Retitled the guarded exchange-log search page as an advanced
  `Historique / Audit` surface while keeping it out of primary navigation.
- Updated E2E expectations only where visible labels changed.
- Created `docs/mjl-demo-data-hygiene.md` to classify remaining fixture and
  compatibility vocabulary.
- Updated implementation and stale-reference docs for actual Phase 14.9
  changes.

## Files Changed

- `custom/mjlfinancement/activities.php`
- `custom/mjlfinancement/budgetlines.php`
- `custom/mjlfinancement/conventions.php`
- `custom/mjlfinancement/documents.php`
- `custom/mjlfinancement/exchangelogs.php`
- `custom/mjlfinancement/expenses.php`
- `custom/mjlfinancement/fundreceipts.php`
- `custom/mjlfinancement/langs/en_US/mjlfinancement.lang`
- `custom/mjlfinancement/langs/fr_FR/mjlfinancement.lang`
- `custom/mjlfinancement/lib/mjl_alerts.lib.php`
- `custom/mjlfinancement/lib/mjl_dashboard.lib.php`
- `custom/mjlfinancement/lib/mjl_email.lib.php`
- `custom/mjlfinancement/lib/mjl_navigation.lib.php`
- `custom/mjlfinancement/partners.php`
- `custom/mjlfinancement/projects.php`
- `tests/e2e/phase5-workspace-shell.spec.js`
- `tests/e2e/phase8r-contextual-exchanges.spec.js`
- `tests/e2e/phase14-convention-management.spec.js`
- `tests/e2e/phase18-activity-convention-documents.spec.js`
- `docs/mjl-demo-ui-polish-plan.md`
- `docs/mjl-demo-data-hygiene.md`
- `docs/mjl-phase-14-9-ui-polish-report.md`
- `docs/mjl-docs-index.md`
- `docs/mjl-implementation-summary.md`
- `docs/mjl-stale-reference-audit.md`

## Visual Evidence / Manual Notes

- Browser evidence comes from Playwright E2E runs against the local Dockerized
  Dolibarr instance at `http://127.0.0.1:8080`.
- No screenshot infrastructure or tracked screenshots were added.
- The global exchange-log route remains directly accessible only under the
  advanced traceability guard and remains absent from primary navigation.

## Verification

- `git diff --check`: passed before and after implementation passes.
- `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`:
  passed before and after implementation passes.
- Targeted changed-label E2E:
  `npx playwright test tests/e2e/phase5-workspace-shell.spec.js tests/e2e/phase8r-contextual-exchanges.spec.js tests/e2e/phase14-convention-management.spec.js`
  passed 25/25 after Docker escalation.
- Broader targeted E2E:
  `npx playwright test tests/e2e/phase3-partners-project-finance.spec.js tests/e2e/phase6r-project-activity-execution.spec.js tests/e2e/phase05-expense-disbursement-workflow.spec.js tests/e2e/phase10r-dashboards-alignment.spec.js tests/e2e/phase11r-reports-exports-alignment.spec.js tests/e2e/phase15-budget-line-management.spec.js tests/e2e/phase16-fund-receipt-management.spec.js tests/e2e/phase18-activity-convention-documents.spec.js`
  first found one stale Phase 18 label expectation, then the updated Phase 18
  spec passed 8/8.
- Full browser regression:
  `npm run test:e2e` passed 125/125.

## Skipped Checks

- No schema audits or smoke scripts were run for Phase 14.9 because no schema,
  workflow meaning, export generation, document permission, or data model logic
  was changed.
- No client validation was run or claimed.
- No production readiness audit was run or claimed.

## Deferred Decisions

- Final client-approved wording for funding-envelope lifecycle states.
- Final donor/client report canevas and official output templates.
- Final production permission matrix.
- Route/file rename strategy for compatibility routes such as
  `conventions.php`, `dpafdashboard.php`, and `exchangelogs.php`.
- Final document preview and document ergonomics policy.
