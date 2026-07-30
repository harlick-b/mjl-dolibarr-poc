# Phase 3D Prerequisite Security Report

## Status

`READY_FOR_REVIEW_AND_MANUAL_COMMIT`

This report covers only the security and export-hardening prerequisite defined
by the revised Phase 3D implementation prompt. Phase 3D UX/UI convergence has
not started.

## Baseline

- Branch: `main`
- Baseline commit: `fbab8294cecd93659b1f7a4f761e973106c31b2b`
- Earlier prompt commit: `fbab8294cecd93659b1f7a4f761e973106c31b2b`
- Revised supplied prompt SHA-256: `699ae4a1504b8dd67c8f3ace5073cba74bfc5d73826842c05c9b92cacb192979`
- Prompt gate: the supplied revision differs from the prompt tracked at the
  baseline and still requires its own manual checkpoint before Phase 3D
- Phase 3A checkpoint: `0399646`
- Phase 3B checkpoint: `06fe50c`
- Phase 3C checkpoint: `e81f8b1`
- Initial working tree: clean
- Approved v2 snapshot: unchanged

## Security result

| Risk | Initial severity | Correction | Verification |
| --- | --- | --- | --- |
| Validation-history cross-scope disclosure and raw database error | High | Entity-matched validation, expense, and convention joins; partner/programme predicate for non-admins; safe persistent error and redacted logging | Single-partner and forced-query-failure browser checks |
| Workflow-audit row and filter metadata disclosure | High | Shared fail-closed traceability predicate for projects, activities, expenses, conventions, budget lines, and fund receipts | Single-partner rows, every supported target type, unresolved targets, and distinct filter options |
| Convention and fund-receipt document IDOR | High | Parent-object scope is rechecked before the ECM row is returned | Direct cross-partner download checks and unchanged audit count |
| Download and export audit persistence was fail-open | High | File generation/opening occurs before audit; delivery begins only after the required audit insert succeeds | Forced audit-insert failures return `503` with no attachment or file body |
| Spreadsheet formula injection and untyped XLSX cells | High | Dangerous CSV text is apostrophe-prefixed; declared money stays raw numeric; XLSX uses `Numeric` only for `money_fields` and `Text` elsewhere | CSV content plus XLSX worksheet/shared-string XML checks |

Admin access remains active-entity-wide for resolved eligible targets.
Unresolved, orphaned, and cross-entity audit targets fail closed for every
role; unsupported report targets remain Admin-only when resolved. Existing route,
permission, token, status, filename, field-order, BOM, delimiter, MIME, and
audit event contracts remain unchanged.

## Files changed

- `custom/mjlfinancement/validations.php`
- `custom/mjlfinancement/workflowactions.php`
- `custom/mjlfinancement/documentdownload.php`
- `custom/mjlfinancement/reports.php`
- `custom/mjlfinancement/lib/mjl_traceability_scope.lib.php`
- `custom/mjlfinancement/lib/mjl_document.lib.php`
- `custom/mjlfinancement/lib/mjl_csv_export.lib.php`
- `custom/mjlfinancement/lib/mjl_xlsx_export.lib.php`
- `tests/e2e/phase3d-prerequisite-security.spec.js`
- `docs/mjl-current-app-functional-map.md`
- `docs/mjl-current-vs-target-gap-analysis.md`
- `docs/mjl-acceptance-tests.md`
- `docs/mjl-docs-index.md`
- This report

## Test isolation

All mutating bootstrap, seed, smoke, and browser checks ran in a disposable
Compose project:

- Compose project: `mjl_phase3d_prereq`
- URL: `http://127.0.0.1:18081`
- Database directory: `/tmp/mjl-phase3d-prereq.22dF5f/mariadb`
- Document directory: `/tmp/mjl-phase3d-prereq.22dF5f/documents`

The shared repository database and document directories were not used for
test mutations. The first combined existing-suite run exposed a disposable
fixture permission issue: a root-created fund-receipt directory was `0755`.
After changing only that disposable directory to `0777`, the complete Phase 16
suite passed.

## Commands and results

| Command | Result |
| --- | --- |
| PHP `-l` on every changed PHP file during its implementation slice | Passed |
| `git diff --check` | Passed |
| `npx playwright test tests/e2e/phase3d-prerequisite-security.spec.js` | 7/7 passed |
| Prerequisite plus existing Phase 9 and Phase 11R export suites | 16/16 passed |
| `smoke_scope_model.php` | `MJL 0.8.0 scope model smoke: OK` |
| `smoke_traceability_exports.php` | Completed successfully |
| Selected access/report/document suites (`phase5`, `phase9`, `phase11r`, `phase16`, `phase18`, prerequisite spec) | All 49 distinct tests passed after correcting the disposable directory permission |

The complete E2E suite was not run at this prerequisite checkpoint because the
revised prompt calls for targeted prerequisite validation before manual review
and commit. Full relevant E2E remains required at the later Phase 3D
integration gate.

## Remaining boundary

- The prerequisite diff is intentionally uncommitted for user review.
- It must be committed as a separate security/export baseline.
- Phase 3D must not begin until that commit exists and the working tree is
  suitable for a new rollback baseline.
- Phase 4 and Phase 5 were not started.
