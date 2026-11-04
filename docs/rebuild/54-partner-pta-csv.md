# Partner selected-PTA CSV — DEC-137

Authorized on 2026-11-04: plan, implement, independent review. Stop after Partner
CSV; annual XLSX/PDF reports, insufficiency and production remain outside scope.

## Outcome and smallest implementation

A Partner downloads the complete currently visible approved portfolio of one
selected PTA, independent of the screen's cursor. Include Partner/Project/year,
current physical/financial summary, and one row per visible Activity: reference,
name, approved revision/dates/budget, public approved/closed state and completed
financial amounts/dates. Financial cells remain empty until closure; zero is
preserved. Never include internal review states, actors, reasons, candidates,
attachments or other Partners. This is current data, not an as-of report.

- Add one POST `/api/v1/partner-portal/ptas/{pta_id}/exports` accepting only
  `{ "format": "csv" }`. Reuse session/CSRF, permanent Partner binding, active
  Partner/context and effective Activity visibility, read advisory locking,
  transactionally audited artifact generation and protected response headers.
- Reuse bounded annual-export row queries (10,000-row refusal), CSV cell escaping,
  exact integer amounts and French rates. Explicit Partner renderer allowlist;
  normalize internal review state to the existing public approved/closed state.
  Semicolon-delimited UTF-8 BOM for Excel; no stored file, migration or dependency.
- Add one French download button to the selected PTA card using existing Router
  selection, Query/session and protected download guard. No offline replay or
  automatic retry; discard late bytes after navigation or access loss.

## Focused verification

1. Own-Partner success; foreign/guessed/invisible PTA, non-Partner role and missing
   CSRF denial. Closed Projects remain visible under existing portal rules.
2. All visible rows regardless of pagination, correct transfer placement and
   withdrawn/draft exclusion; approved baseline during pending amendments.
3. Exact allowlisted columns, no actor/internal state/reason/file leakage,
   unfinished finance blank, closed finance matching portal, zero values,
   French/CSV quoting/formula protection, valid binary OpenAPI and no-store headers.
4. Export audit hash/count match bytes; audit failure rolls back; over-limit refusal;
   deterministic PostgreSQL authorization/export ordering. Reuse adjacent annual
   export/Partner tests for their unchanged projection and transaction mechanics.
5. React selected-PTA request, CSRF, offline/error feedback, no replay, late-byte
   rejection after access loss/navigation; focused desktop/mobile browser download.
6. Focused backend/frontend regressions, Ruff/format/mypy, ESLint/Prettier,
   Vite build and diff checks; synthetic disposable resources only.

## Evidence

All six focused verification gates pass on the synthetic candidate based on
`8e3e3a3`. No migration, table, dependency, persistent artifact or production
configuration changed. Candidate SHA-256:
`eb5c3c2e500cd120891d26a8b21483acd35d6215fdc6328b54c65b30dc6a5902`.
Computed by concatenating sorted paths, NUL, file bytes, NUL for
`backend/app/partner_portal.py`, `backend/app/partner_export.py`,
`backend/tests/test_partner_export.py`, `frontend/src/PartnerPortalView.jsx`,
`frontend/src/i18n.js`, `frontend/src/partner-export.test.jsx` and
`frontend/e2e/partner-portal.spec.js`.

- Disposable PostgreSQL 16 with generated credentials and synthetic per-test
  databases; backend candidate mounted read-only into the existing Python image.
  `python -m pytest -p no:cacheprovider -q tests/test_partner_export.py
  tests/test_annual_export.py tests/test_partner_portal.py`: **20 passed, 1 failed**
  (185.11s). The failure was an incorrect new test key, not an application defect.
  All 17 unchanged annual-export/Partner regressions passed, including withdrawal,
  closure ordering and existing Partner isolation. Earlier new-test attempts also
  used the wrong Project closure route; corrected to the existing PATCH action.
- Final focused rerun `python -m pytest -p no:cacheprovider -q
  tests/test_partner_export.py`: **6 passed** (54.43s). Covers own/foreign scope,
  roles, CSRF, strict format, binary OpenAPI, approved amendment baseline,
  complete rows beyond pagination, hash/count audit, rollback, bound refusal,
  deterministic deactivation/export ordering, closed finance matching portal,
  draft exclusion, transfer placement, zero spending and closed Project export.
  No acceptance gate or abuse limit was weakened.
- `npx vitest run src/partner-export.test.jsx src/partner-portal.test.jsx
  src/partner-documents.test.jsx --maxWorkers=1`: **19 passed** on the final
  localized candidate (13.23s). Controlled promises exercise access loss,
  selection changes and offline late-byte rejection; POST/CSRF, manual retry and
  no reconnect replay are checked. An initial concurrent run hit an existing
  test's one-second wait; serial workers avoid machine-contention noise.
- `npx playwright test e2e/partner-portal.spec.js`: **1 passed** (3.0s) against
  the final build, exercising desktop and mobile CSV downloads with POST/CSRF
  assertions, plus unchanged PDF/image access and preview behavior.
- ESLint, focused Prettier, Ruff check/format, mypy (**33 source files**),
  Vite/PWA build and diff checks pass. Final browser artifact:
  `frontend/dist/assets/index-D5Y-V51J.js`. Existing large-chunk and TestClient
  deprecation warnings remain. No broad historical suite or production audit was
  run: neither is needed for this bounded read/export slice.

Separate engineering and security/specification reviewers inspected the actual
source and surrounding mechanisms without editing. Engineering requested moving
new French messages into the existing localization file; corrected. Neither
review found an authorization, data-projection or unnecessary-abstraction defect.
Both same reviewers passed focused re-review with no remaining blocking findings.
They independently verified the recorded source digest and diff checks; engineering
also reran the five CSV React tests (5 passed, 2.52s). Database/browser results
above were executed by the implementer and inspected as evidence, not independently
rerun by reviewers. The slice is complete in the synthetic environment; production
acceptance and later slices remain excluded.

## Mandatory independent review handoff

A separate reviewer inspects requirements, actual diff, surrounding authorization
and verification evidence adversarially without editing or trusting implementation
claims. Report severity, file/line, impact and smallest correction. The implementer
fixes accepted findings and returns the candidate to the same reviewer. Completion
requires resolved blocking findings and mandatory verification gaps. Review does
not authorize another slice or establish production acceptance.
