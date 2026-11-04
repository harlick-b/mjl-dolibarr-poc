# Annual printable PDF working report — DEC-137

Authorized 2026-11-04 by “go for next” after Excel commit `9d087f0`. Stop after
PDF; budget insufficiency, official report templates and production remain excluded.

## Audit and plan

Reuse the existing annual export route, internal business roles, CSRF/advisory
lock, exact approved/current snapshot, 10,000-row bound and transactional audit.
Reuse ReportLab already used for Fiches; no new dependency, schema or stored file.

1. Add `pdf` to the internal export format only. Partner export stays CSV-only.
   Generate a French landscape A4 working report using the exact Excel metadata
   and nine Activity columns. Label it non-official. Include a summary followed by
   Activity rows with repeated headers and page numbers. No links/attachments,
   comments, candidate budgets or extra workflow facts.
2. Wrap and escape all dynamic text (including long names and markup-like names).
   Keep every Activity and the full exact integer amounts, never truncate rows.
   Repeat table headers across pages; allow long rows to split. Missing final
   finance is a dash, with a legend; zero remains zero. Use existing navy tokens,
   restrained print styling and readable column widths; no invented official seal.
3. Add one localized PDF button next to CSV/Excel on the existing PTA card using
   its same online-only mutation, authorization generation, filename handling and
   no retry/replay. No new page or PDF preview.

## Focused checks

- Real PDF response and extracted summary/row facts match Excel/CSV, exact large
  amounts, zero versus missing, accents and literal markup; multipage repeated
  headers, long rows, page bounds and no clickable links. Inspect a rendered
  synthetic multipage sample visually as well as extracted text.
- Internal roles only, CSRF, anonymous/Partner/Admin denials, Partner PDF format
  rejection, binary OpenAPI/no-store, format/row-bound refusal and atomic audit hash
  with rollback. Reuse existing transaction/concurrency tests on the shared route.
- PDF selected-PTA request and filename, shared offline/late-result protections;
  browser desktop/mobile downloads for all three formats. Focused CSV/Excel and
  Partner regressions, Ruff/format/mypy, lint/format/build and diff checks.
- Tests use disposable PostgreSQL and synthetic identities. No migration suite or
  production audit is needed for this schema-free formatting extension.

## Mandatory independent review

Separate review-only engineering and security/specification agents inspect actual
requirements, diff, surrounding code and evidence without trusting implementer
claims. Report severity, file/line, impact and smallest correction. Implementer
fixes accepted findings and returns to the same reviewers; blockers and mandatory
verification gaps must be resolved before completion. No later slice is implied.

## Evidence

Implemented on base `9d087f0` in `/tmp/mjl-annual-pdf`, isolated from concurrent
mail/account work. No dependency/schema changes. Final candidate SHA-256:
`966f263c3f9b5128c99a66a6c2f57538e2f957af152ea58a8494c6f8d7a46f66`.
Computed from sorted path + NUL + bytes + NUL for backend
`app/planning/annual_export.py`, `app/planning/annual_pdf.py`,
`tests/test_annual_pdf.py`, `tests/test_annual_excel.py`,
`tests/test_annual_export.py`; frontend `src/PlanningView.jsx`, `src/i18n.js`,
`src/planning.test.jsx`, `e2e/metrics.spec.js` (with backend/frontend prefixes).

- First API test failed with the expected 422 before PDF support, then passed.
- Using the existing locked `mjl-annual-excel-test:local` image, candidate source
  mounted read-only and a fresh disposable PostgreSQL 16 container with synthetic
  per-test databases: `python -m pytest -p no:cacheprovider -q
  tests/test_annual_pdf.py tests/test_annual_excel.py tests/test_annual_export.py
  tests/test_partner_export.py`: **23 passed, 1 failed** (288.53s). The failure
  was a renderer test incorrectly supplying no summary metadata; the real export
  always supplies it. All 20 adjacent Excel/CSV/Partner regressions passed,
  including deterministic authorization/closure ordering, approved/current
  placement, zero-spending, audit, pagination and Partner isolation.
- Corrected the metadata fixture and widened the revision column after visual
  review. Final `python -m pytest -p no:cacheprovider -q
  tests/test_annual_pdf.py`: **4 passed** (41.13s). Actual PDF bytes are parsed
  independently by pypdf: French/escaped text, exact large amounts, Excel finance
  equality, audit hash/rollback, permissions/CSRF, Partner/anonymous denial,
  row-bound refusal, empty plan, all 65 rows across pages, repeated headers,
  page numbers, long-row splitting and absence of link annotations.
- Rendered a synthetic 48-row, five-page report with `pdftoppm`; visually inspected
  pages 1 and 2 after the column correction. `pdftotext -bbox` verified **1,406
  words** on all **5 pages** stay inside 20-point horizontal and 10-point vertical
  page margins. Final sample: `/tmp/mjl-annual-report-final.pdf`; temporary PNGs
  `/tmp/mjl-annual-final-1.png` and `-2.png`. These are disposable review artifacts,
  not committed project data or an approved official template.
- `npx vitest run src/planning.test.jsx src/partner-export.test.jsx
  src/partner-portal.test.jsx --maxWorkers=1`: **40 passed** (24.53s), including
  PDF request/CSRF/filename and shared no-replay/access-loss protections.
- `npx playwright test e2e/metrics.spec.js`: **1 passed** (7.4s), desktop/mobile
  CSV/Excel/PDF downloads from final build `frontend/dist/assets/index-BB7ZfwR2.js`.
  Browser responses are mocked for request/UI checks; actual bytes/layout are
  verified separately above.
- Ruff check/format, ESLint, focused Prettier, mypy (**35 source files**, rerun on
  final candidate), Vite/PWA build and diff checks pass. Existing chunk-size and
  TestClient warnings remain. No migration or production audit was run because
  no schema/production work is included.

Separate engineering and security/specification reviewers inspected requirements,
source, surrounding authorization and evidence without modifying files. No
blocking code/security findings; engineering's optional revision-column readability
suggestion was applied and passed focused re-review. Both reviewers passed final
signoff with no blockers and independently verified the source digest. They
inspected recorded database/browser evidence rather than rerunning those suites;
engineering and security also inspected rendered PDF output. The slice is complete
in the isolated synthetic environment, not a production acceptance.
