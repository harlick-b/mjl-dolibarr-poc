# PTA-9B — Implementation status

`PTA_9B_COMPLETE` on 2026-11-03 for synthetic identities and isolated disposable
PostgreSQL only.

## Implemented boundary

- `GET /api/v1/partner-portal/activities/{activity_id}` returns an allowlisted
  current approved Activity projection for the permanently bound Partner.
- `GET /api/v1/partner-portal/activities/{activity_id}/fiche.pdf` returns and
  transactionally audits an in-memory French PDF built from that same projection.
- Successful Validator approvals expose only kind, revision and French-displayed
  date. Closed finance exposes allocation, final spending, validated zero state,
  confirmed external transfer, required surplus, reversement and closure facts.
- The existing Partner workspace owns detail selection in Router search, data in
  Query and a generation-guarded online PDF download. Authorization loss masks
  cached data and synchronously rejects late protected bytes.

Drafts, pending candidates, unsuccessful decisions, actors, reasons, internal
notes/audit, attachments, exports and unfinished finance remain hidden. Partner
attachment visibility, real identities, external services and production remain
deferred. No schema change, migration, table, stored PDF, job or reporting
framework was added.

## Verification evidence

- Final backend image:
  `sha256:f82be881e11343e83cf7bab8fab765ef2eb244f08a3b2784bc117c34970d4427`.
- Disposable PostgreSQL Partner suite: `7 passed`; it covers own/cross-Partner,
  draft and withdrawn visibility, current transfer placement, final decisions,
  positive and zero finance, latest corrections, PDF content/headers/OpenAPI,
  transactional audit rollback and deterministic deactivation serialization.
- Adjacent internal Fiche, closure and reversement regression selection:
  `12 passed`.
- Frontend Partner unit suite: `7 passed`; the integrated complete unit run:
  `85 passed`.
- Focused Chromium desktop/mobile journey: `1 passed`; production Vite/PWA build
  succeeded. ESLint, Prettier, Stylelint, Ruff and mypy passed. `git diff --check`
  passed.

The final build retains Vite's existing advisory warning for a JavaScript chunk
above 500 kB. It does not change this slice's behavior or authorize a bundling
project.

## Independent review

The engineering reviewer found an incorrect JSON OpenAPI success declaration and
incomplete financial/date display. The product/security reviewer independently
found the same display gap, missing zero/unfinished/mobile oracles and a late PDF
race on query-driven authorization loss. The implementer added the explicit PDF
response contract/security assertions, complete French settlement display,
direct cross-Partner PDF denial, focused state/mobile coverage and synchronous
download revocation with an exact late-response query-denial oracle. The same
reviewers re-inspected the corrected candidate without modifying it and passed
the final engineering and product/security gates.

## Focused PDF corrections (2026-11-03)

A subsequent review reproduced two valid-input defects: multiline descriptions
could exceed one unsplittable row, and Operation names were escaped plain strings
that neither wrapped nor displayed special characters correctly. The correction
allows rows to split and uses Paragraph cells for names, retaining the existing
layout. No API, authorization, schema or frontend behavior changed.

Verification candidate: commit `3ab6e75` plus only `app/partner_fiche.py`,
`tests/test_partner_fiche.py` and `tests/test_partner_portal.py` under `backend/`.
The isolated candidate was byte-compared with these worktree files; concurrent
financial-return changes were excluded. Source SHA-256 for the renderer:
`9c6e5a0a10ed15ef2a0c17175cdcc58370fe96b3ad780d5b23400928c01e5266`.

- Both new renderer regressions failed before their corresponding fixes and
  passed afterward. They preserve all 189 description lines across pages and
  verify a wrapped 200-character name plus literal `&` and angle brackets.
- In the existing `mjl-pta9b-backend` image with the candidate mounted read-only
  and fresh disposable PostgreSQL 16, `python -m pytest -p no:cacheprovider -q
  tests/test_partner_fiche.py tests/test_partner_portal.py` passed **9 tests**
  in 79.76 seconds. The database container was removed afterward. The extended
  API test directly verifies withdrawn detail/PDF 404 responses and transferred
  detail/PDF destination dates and final approval label; the earlier list-only
  assertions did not establish this new-route coverage.
- Ruff check and format check for all three files, mypy for the renderer, and
  `git diff --check` passed. The first host API attempt failed during setup due
  to missing Python `_ctypes`; it is not counted as verification.
- The same independent engineering and specification reviewers re-reviewed the
  fixes, independently passed both renderer tests, and accepted the focused
  PostgreSQL evidence. No outstanding finding in this correction scope.

Browser/build suites were not rerun: no frontend code or download contract was
changed. Synthetic verification remains distinct from production acceptance.
