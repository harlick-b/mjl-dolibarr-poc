# Phase 3D Prerequisite Security Report

## Status

`CORRECTED_AND_VALIDATED`

This report covers only the security and export-hardening prerequisite defined
by the revised Phase 3D implementation prompt. Phase 3D UX/UI convergence has
not started.

## Baseline

- Branch: `main`
- Original prerequisite commit:
  `37226de0ee80e09e8e33089a1f3a5033049e3396`
- Revised Phase 3D prompt commit:
  `c6b67d8a10ab6b921a50eb111ba06fcc8d1e35a8`
- Corrective application baseline (commit A):
  `ed5e16f175c6144b500d4c71a395a5c13d2cb836`
- Phase 3D rollback/evidence boundary: the commit containing this report,
  `docs(mjl): record Phase 3D rollback baseline`; its exact SHA is recorded in
  the implementation handoff after commit creation.
- Phase 3A checkpoint: `0399646`
- Phase 3B checkpoint: `06fe50c`
- Phase 3C checkpoint: `e81f8b1`
- Initial working tree: clean
- Approved v2 snapshot: unchanged

## Security result

| Risk | Initial severity | Correction | Verification |
| --- | --- | --- | --- |
| Validation-history cross-scope disclosure and raw database error | High | Entity-matched left joins; Admin unresolved diagnostics; negative cross-entity expense/convention guards; resolved assigned-partner requirement for non-admins; safe persistent error and redacted logging | Admin orphan/missing-parent visibility, non-admin fail-closed, cross-entity target/parent denial, and forced-query-failure browser checks |
| Workflow-audit row and filter metadata disclosure | High | Shared predicate lets Admin diagnose missing/unknown active-entity targets while rejecting known cross-entity targets/required parents; non-admins still require resolved same-entity assigned scope and cannot see report audits | Admin/non-admin rows and identical filter metadata, including expense and fund-receipt missing/cross-entity convention parents |
| Prerequisite E2E shared-workspace mutation | High | Fail-fast Compose/URL/bind/port guard runs before all mutations; cleanup is disabled until isolation verification succeeds; custom fixture queries are entity-scoped | Five guard checks, deliberate default-invocation failure before bootstrap, and two disposable Compose runs |
| Convention and fund-receipt document IDOR | High | Parent-object scope is rechecked before the ECM row is returned | Direct cross-partner download checks and unchanged audit count |
| Download and export audit persistence was fail-open | High | File generation/opening occurs before audit; delivery begins only after the required audit insert succeeds | Forced audit-insert failures return `503` with no attachment or file body |
| Spreadsheet formula injection and untyped XLSX cells | High | Dangerous CSV text is apostrophe-prefixed; declared money stays raw numeric; XLSX uses `Numeric` only for `money_fields` and `Text` elsewhere | CSV content plus XLSX worksheet/shared-string XML checks |

Admin sees active-entity unresolved validation and audit diagnostics for
remediation, including missing supported targets, missing required convention
parents, and unknown audit object types. Non-admins fail closed unless the
target and required convention parent resolve in the active entity and the
Partenaire / Programme is assigned. Known targets or required parents in
another entity remain hidden from every role. Generic report audit rows remain
Admin-only. Existing route, permission, token, status, filename, field-order,
BOM, delimiter, MIME, and audit event contracts remain unchanged.

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
- `tests/helpers/phase3d-prerequisite-isolation.js`
- `tests/isolation/phase3d-prerequisite-isolation.test.js`
- `docs/mjl-current-app-functional-map.md`
- `docs/mjl-current-vs-target-gap-analysis.md`
- `docs/mjl-acceptance-tests.md`
- `docs/mjl-docs-index.md`
- This report

## Test isolation

All mutating bootstrap, seed, smoke, and browser checks ran in disposable
Compose projects. The corrective implementation run used:

- Compose project: `mjl-phase3d-prereq-red`
- URL: `http://127.0.0.1:18081`
- Temporary root: `/tmp/mjl-phase3d-blockers.khmgvy`

The independent exact-commit-A proof used:

- Compose project: `mjl-phase3d-prereq-commit-a`
- URL: `http://127.0.0.1:18082`
- Temporary root: `/tmp/mjl-phase3d-commit-a.JOdNQ2`
- Proved source SHA: `ed5e16f175c6144b500d4c71a395a5c13d2cb836`

The shared repository database and document directories were not used for
test mutations. The first combined existing-suite run exposed a disposable
fixture permission issue: a root-created fund-receipt directory was `0755`.
After changing only that disposable directory to `0777`, the complete Phase 16
suite passed.

## Commands and results

| Command | Result |
| --- | --- |
| PHP `-l` on both changed PHP files | Passed |
| `node --check` on the changed prerequisite spec/helper/guard test | Passed |
| `node tests/isolation/phase3d-prerequisite-isolation.test.js` | 5/5 passed |
| Bare prerequisite invocation without isolation variables | Failed before bootstrap as required |
| `git diff --check` | Passed |
| Prerequisite spec in the corrective disposable environment | 9/9 passed |
| Requested Phase 5, Phase 9, Phase 11R, Phase 16, and Phase 18 suites | All 43 distinct tests passed; Phase 16 required only the documented disposable directory mode correction |
| `smoke_scope_model.php` | `MJL 0.8.0 scope model smoke: OK` |
| `smoke_traceability_exports.php` | Completed successfully |
| `smoke_integrity_targets.php` | `MJL integrity target smoke: OK` |
| `audit_unresolved_scope.php` | `MJL unresolved scope audit: OK` |
| Focused standards review | No documented-standard violation; low-risk duplication refactor remains intentionally deferred |
| Focused spec/security review | Fund-receipt convention-parent gap found, corrected, and re-reviewed closed |
| Approved v2 snapshot diff | Unchanged |
| Fresh environment at exact commit A | Prerequisite 9/9 plus all four smoke/audit checks passed |

The complete E2E suite was not run at this prerequisite checkpoint because the
correction plan calls for the prerequisite and specified affected suites.
Full relevant E2E remains required at the later Phase 3D integration gate.

## Remaining boundary

- Commit A is the corrective application baseline and must remain outside any
  later Phase 3D presentation rollback.
- The commit containing this report is the Phase 3D rollback and baseline
  evidence boundary.
- Phase 3D UX/UI convergence did not begin during this correction.
- The complete E2E suite remains a later Phase 3D integration gate; the
  prerequisite and every explicitly requested affected suite passed here.
