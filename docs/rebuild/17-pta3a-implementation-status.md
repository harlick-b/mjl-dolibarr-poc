# PTA-3A implementation status

## Contract

DEC-115 authorizes synthetic Operation execution only: explicit start, actual
integer XOF spending, physical completion, and reasoned corrections with
preserved audit history. Financial requests, payment, reversement, formal
Activity closure, documents, notifications, real accounts and production are
excluded.

## Implemented

- Migration `0010_pta3a` adds four fields to the existing Operation and no table.
- Four REST responsibilities expose paginated realization lists/history, detail,
  and strict `start`/`record` mutation actions.
- Planning eligibility now checks persisted execution facts and approved
  Operation membership before withdrawal or transfer review.
- The French React workspace provides Agent controls, read-only reviewer views,
  pause/ineligibility reasons, variance and paginated history with online-only
  Query reconciliation.

## Verification and review

`PTA_3A_COMPLETE` on 2026-10-28.

- Focused disposable PostgreSQL: 27 passed in 223.22 seconds. This covers strict
  input, authorization and state denial, execution/correction, lifecycle and
  account races, rollback, immutable start, predecessor history and downgrade.
- Combined backend regression: 509 passed in 1909.46 seconds. Three existing
  dependency deprecation warnings remain non-blocking.
- Backend Ruff, format and mypy passed.
- Frontend ESLint, Stylelint and Prettier passed; 46 Vitest tests passed; the
  Vite/PWA production build passed with the existing chunk-size warning.
- Two focused real-Chrome Playwright journeys passed: Agent
  start/record/correction/offline behavior and reviewer pause/resume, read-only,
  history pagination and session invalidation.
- Independent engineering and security/specification reviewers returned PASS
  after the implementer corrected their findings and returned the candidate for
  focused re-review. Both confirmed the final focused and combined evidence.

PC1/PC2 remain pending. Synthetic identities and disposable resources only;
real accounts and production are prohibited. The next financial slice is not
authorized.
