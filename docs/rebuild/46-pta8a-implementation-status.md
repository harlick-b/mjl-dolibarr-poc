# PTA-8A implementation status

**PTA_8A_COMPLETE** on 2026-11-03.

`POST /api/v1/ptas/{pta_id}/exports` lets an authenticated Agent, Supervisor or
Validator download the selected current PTA as a UTF-8 BOM, semicolon-separated,
French-headed and formula-safe CSV. The export includes exact annual metric facts
and one stable approved-baseline row per currently counted Activity. Definitive
financial fields appear only after closure; validated zero spending is explicit.

The server takes the complete bounded selection under the shared lifecycle lock,
records export ID, PTA ID, snapshot time, row and byte counts and SHA-256 in the
existing audit transaction, then returns the attachment. The annual PTA screen
adds one cancellable, non-retrying online download action. No migration, table,
stored artifact, job, historical reconstruction or reporting framework was added.

## Final-candidate verification

- Backend image
  `sha256:462d5325670c8c72babac712a45f8f6364cc7e2c36f9252f81c130fbab564754`:
  `pytest -q tests/test_annual_export.py` — **10 passed** in **57.36s**.
- The same image: `pytest -q tests/test_metrics.py tests/test_audit_export.py` —
  **11 passed** in **99.88s**.
- Backend Ruff lint/format and strict mypy passed for the application and focused
  tests.
- Frontend Vitest — **69 passed**; ESLint, Stylelint, Prettier and production/PWA
  build passed with the existing chunk-size warning.
- `npm run test:e2e -- e2e/metrics.spec.js` — **1 passed** in **3.2s**, including
  the browser CSV download.
- `git diff --check` passed. All runtime checks used synthetic identities and the
  disposable `mjl-pta8a` PostgreSQL resources.

The independent engineering and product/security reviewers initially found
missing boundary, Origin, offline/authorization-loss and bounded-query evidence.
The implementation was corrected and returned to the same reviewers. Both final
read-only re-reviews passed with no remaining finding.

Historical exports, official annual PDF/XLSX, Partner exports, real identities,
production services and later slices remain deferred.
