# MJL Clarity System - Phase 9 Compliance Report

## Scope

Phase 9 implements the MJL official exports center for reports and CSV exports. Changes stay inside `custom/mjlfinancement`, E2E tests, and this documentation.

## Safe Boundary Evidence

- Dolibarr core files were not modified.
- No schema changes, PDF output, print views, export audit logging, email changes, workflow changes, native menu hiding, or unrelated table redesigns were introduced.
- Report access continues to use the existing Phase 5/6 Admin or `MJL POC - DPAF` boundary.
- CSV generation still uses the existing shared CSV output helper, preserving UTF-8 BOM and semicolon delimiters.
- CSV export actions now enforce required filters server-side; direct URLs cannot generate official empty files when the required scope is missing.
- The temporary Level 1 / Level 2 / Level 3 / Admin model remains the only role model used.

## Implemented Surfaces

- `/custom/mjlfinancement/reports.php` is now the `Centre d'exports MJL`.
- Reports define label, description, scope, supported filters, required filters, status domain, filename slug, headers, and output formatting metadata.
- Filter bars are report-aware and hide unsupported filters.
- Aggregate project and convention reports do not expose a generic status filter because their output already contains fixed submitted/validated budget columns.
- Required filters are explicit for project summary and convention budget reports.
- Export context shows report, scope, period, active filters, format, role restriction, and filename preview.
- CSV downloads use a report-specific sanitized filename that matches the preview.
- Preview rows and CSV rows share the same normalized filters and formatted output values.
- Report-specific table and export styles are scoped under the existing `.mjl-workspace` system.

## Constraints Check

- No public register page was created.
- Invitation-only access remains unchanged.
- Only Admin invitation management remains unchanged.
- Existing activity and expense workflow rules, audit history, no-self-validation behavior, and active-entity filtering are preserved.
- CSV remains the only implemented official output format in this phase; PDF remains out of scope.
- Status and document values are displayed as French-readable text, not raw numeric codes.

## E2E Coverage Added

Playwright spec `tests/e2e/phase9-tables-exports.spec.js` covers:

- Level 1, Level 2, read-only, and workflow-only users blocked from reports.
- DPAF and Admin access to the reports center.
- Report descriptions, supported filters, required-filter messaging, format label, and filename preview.
- Unsupported filters hidden for date-only audit reports and aggregate financial reports.
- Filtered activity preview and CSV export sharing filters and active-entity scope.
- CSV filename matching preview, UTF-8 BOM, semicolon separator, French headers, and filtered row content.
- Expense document export with French-readable status and document flags.
- Forced export without required filters being refused server-side without a download.
- Forbidden public-registration labels remain absent.

## Verification

Passed commands:

- `php -l custom/mjlfinancement/reports.php`
- `php -l custom/mjlfinancement/css/mjl_app.css.php`
- `node --check tests/e2e/phase9-tables-exports.spec.js`
- `npm run test:e2e -- tests/e2e/phase9-tables-exports.spec.js`
- `npm run test:e2e -- tests/e2e/phase6-level-dashboards.spec.js tests/e2e/phase7-activity-workflow.spec.js tests/e2e/phase8-alerts-risks.spec.js tests/e2e/phase9-tables-exports.spec.js`
- `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_traceability_exports.php`

The first regression attempt failed because Phase 6 still asserted the old `Rapports MJL` page title. The assertion was updated to the Phase 9 heading `Centre d'exports MJL`, and the regression suite then passed.

A later review found two semantic issues before commit: aggregate reports exposed a misleading generic `Statut` filter, and direct CSV URLs could produce a header-only file without required filters. Both were corrected before final validation.

## Known Limitations

- Export audit logging remains outside Phase 9.
- PDF and printable official reports remain outside Phase 9.
- Standardized table styling is applied to the reports center only; other raw list screens remain deferred to later phases.
- Filenames include internal project/convention IDs when those filters are used; replacing them with stable business references should be a later compatibility decision.
