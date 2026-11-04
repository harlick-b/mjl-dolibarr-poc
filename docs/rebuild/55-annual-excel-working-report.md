# Annual Excel working report — DEC-137

Authorized 2026-11-04 by “go for next” following Partner CSV completion. This is
an internal working report, not an official template or Partner report. Stop after
Excel; printable PDF, insufficiency and production remain deferred.

## Audit and implementation plan

The existing annual CSV already obtains approved current placement, immutable
approved budget/dates, current review state and definitive closed financial facts
under the shared advisory lock. Its 10,000-row limit, internal business-role checks,
CSRF, audit hash and bounded queries are the seams to reuse. No new metrics,
workflow, table, migration, stored file or background job is needed.

1. Extend internal POST `/api/v1/ptas/{identifier}/exports` to accept `xlsx` as well
   as CSV, preserving CSV bytes/behavior. Keep the Partner input CSV-only (it
   currently reuses the internal input model). Reuse the same transaction and rows.
2. Generate one French workbook: `Synthèse` identifies Partner, Project, PTA year,
   generation/export reference and current physical/financial summary; `Activités`
   has one row per approved, nonwithdrawn Activity with reference/name, approved
   revision/dates/budget, current state (progress), final spending and returned
   surplus where definitive. Unfinished financial cells stay blank; validated
   zero stays zero. The workbook labels itself “Rapport de travail — non officiel”.
3. Add XlsxWriter only for workbook generation rather than maintaining a custom
   Office ZIP/XML writer. Disable formula/URL inference; write user text literally.
   Keep integer XOF exact: numeric cells through Excel's 15-digit precision limit,
   larger values as exact decimal text with a workbook note. No formulas/macros,
   external links, attachments or internal comments. Freeze/filter Activity headers,
   use restrained existing navy styling and readable widths; no elaborate template.
   Library behavior: [XlsxWriter cell types and numeric precision](https://xlsxwriter.readthedocs.io/worksheet.html).
4. Add one Excel button beside CSV in the existing PTA card using the same Query
   mutation, protected download, CSRF and online-only behavior. Preserve selection,
   cancellation on access loss/unmount, error feedback and no automatic retry.

## Focused checks and expected results

- Parse the generated workbook independently: summary matches current metrics;
  Activity values match approved/current placement and CSV, blank/zero distinction,
  exact large XOF, literal formula/URL-like names, useful sheet names/styles/filter.
- Internal roles succeed; Admin/Partner/anonymous and missing CSRF fail. Partner
  export rejects XLSX. Invalid format remains 422; response is binary XLSX/no-store.
- Audit matches bytes/format/count; failed audit returns no workbook. Row bound
  refuses excess. Existing deterministic authorization/closure/export tests protect
  the unchanged shared transaction; run focused CSV and Partner regressions.
- React selected-PTA XLSX request/filename and protected failure/offline behavior;
  desktop/mobile browser journey for both formats. Reuse adjacent tests where the
  mutation is unchanged rather than multiplying fixtures by every format.
- Ruff/format/mypy, frontend lint/format/build and diff checks. Test only synthetic
  identities on isolated disposable PostgreSQL. Record candidate and actual results.

## Mandatory independent review

Separate review-only engineering and security/specification agents inspect the
requirements, actual changes and surrounding code, without trusting implementer
claims. Findings include severity, evidence, impact and smallest correction. The
implementer fixes accepted findings and returns to the same reviewers; blockers
and required verification gaps must be resolved before completion. No later slice
is implied by review or passing tests.

## Evidence

Implemented and verified on base `5083c7d` in `/tmp/mjl-annual-excel`, isolated
from concurrent mail/account changes in the main worktree. No new migration or
schema change. Locked XlsxWriter 3.3.1 is the only added package.

Candidate SHA-256:
`b6dda6db90ba19c4883c54d27a50378964ff3b32cd6207f5142c5df9b56cf41a`.
Digest is sorted path + NUL + bytes + NUL for these files: backend
`app/partner_portal.py`, `app/planning/annual_export.py`,
`app/planning/annual_report.py`, `pyproject.toml`, `uv.lock`,
`tests/test_annual_excel.py`, `tests/test_annual_export.py`; frontend
`src/PlanningView.jsx`, `src/i18n.js`, `src/planning.test.jsx`,
`e2e/metrics.spec.js` (each prefixed by `backend/` or `frontend/`).

- First Excel API test failed with the expected 422 before XLSX was implemented.
- The isolated Docker image was built with `uv sync --frozen` from the candidate
  lockfile. Tests mounted candidate backend source read-only, using a disposable
  PostgreSQL 16 container and synthetic per-test databases; teardown removed them.
  `python -m pytest -p no:cacheprovider -q tests/test_annual_excel.py
  tests/test_annual_export.py tests/test_partner_export.py`: **20 passed** (141.29s).
  This includes existing deterministic deactivation/export and closure/export
  ordering, placement/withdrawal, pagination, zero, exact audit and rollback tests.
- After adding the explicit anonymous-401 assertion, final focused rerun
  `python -m pytest -p no:cacheprovider -q tests/test_annual_excel.py`:
  **4 passed** (19.14s). Workbook ZIP/XML is read independently with the standard
  library: literal formula/URL text, no formulas/external links/macros, exact
  19-digit XOF text, summary/CSV equality, closed finance, blank/zero distinction,
  sheet names, filter/freeze behavior. Internal-role success, Admin/Partner/anonymous
  denial, CSRF, format/row-bound refusal, audit hash and rollback are exercised.
  Partner XLSX remains 422 on its own route and 403 on the internal route.
- `npx vitest run src/planning.test.jsx src/partner-export.test.jsx
  src/partner-portal.test.jsx --maxWorkers=1`: **39 passed** (17.28s).
  XLSX selection/CSRF/filename plus shared mutation offline, retry and late-byte
  controls remain covered alongside CSV/Partner regressions.
- `npx playwright test e2e/metrics.spec.js`: **1 passed** (4.2s), desktop and mobile
  download journey against `frontend/dist/assets/index-CKfoNVZ7.js`. The browser
  mocks responses to check UI/requests; real workbook contents are checked by the
  database and renderer tests above.
- Ruff check/format, ESLint, focused Prettier, mypy (**34 source files** in locked
  container), Vite/PWA build and `git diff --check` passed. Existing large-chunk
  and TestClient deprecation warnings remain. No production audit, migration suite
  or broad historical suite was needed for this schema-free export change.

Separate engineering and security/specification reviewers inspected actual source
and surrounding code without modifying it. Neither found blocking defects or
unnecessary abstraction. Both passed final evidence re-review and independently
recomputed the candidate digest with no remaining blockers. They inspected the
recorded database/browser results rather than independently rerunning them.
The Excel slice is complete in the isolated synthetic environment; no production
acceptance or authorization for PDF/insufficiency follows.
