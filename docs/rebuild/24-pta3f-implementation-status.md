# PTA-3F implementation status

**PTA_3F_COMPLETE** on 2026-10-30.

## Implemented boundary

PTA-3F adds direct, terminal Activity closure for an active Agent after the
server rechecks the complete approved Operation set, explicit final spending,
approved décaissement and virement, latest external confirmation, and the exact
zero or positive reversement outcome. The request supplies only the expected
Activity version. Success records the Agent and server time, increments the
version, ends active coordination assignments, and writes one transactional
`activity.closed` audit entry.

Migration `0015_pta3f` adds nullable closure facts to `pta_activity`, the
`closed` state, exact row/cross-table guards, and terminal guards for Operations,
confirmations and reversements. It creates no table. One POST responsibility,
`/api/v1/activities/{activity_id}/closure`, returns the updated realization
projection. Existing Activity/execution reads expose closure evidence. The French
realization workspace shows server-owned blockers, requires explicit Agent
confirmation and becomes read-only after closure.

Reopening, Project closure relaxation, zero-total financial requests,
insufficiency/discrepancy resolution, KPIs/Fiche, documents, notifications,
banking integration, real identities and production remain excluded.

## Verification evidence

All seven readiness gates C01-C07 passed.

- The tested backend image is
  `sha256:06afe414b5432f8f7a3a70dba73c2576ba9e3bd78c1fdb9401bba224dfa7a5f4`.
  The final migration-affected disposable-PostgreSQL run passed **29 tests** in
  **260.16s** (`test_closure.py` plus `test_database.py`).
  It covers each settlement stage, positive and zero reversement, the complete
  actor/CSRF/Origin/guessed-ID matrix, stale/replayed versions, assignment ending,
  terminal planning/execution/assignment/confirmation/reversement denial,
  audit/constraint/commit rollback, deterministic serialization with adjacent
  mutations and account lifecycle, exact predecessor upgrade, destructive
  downgrade refusal, exact predecessor Operation-trigger restoration,
  schema-function drift and direct database rejection of a new Operation after
  closure.
- Frontend ESLint, Stylelint, Prettier, **58 Vitest tests** and the Vite/PWA
  production build passed. The build retains the existing chunk-size warning.
  Four focused real-Chromium realization journeys passed, including Agent closure,
  offline-before-submit non-replay, Query reconciliation and reviewer read-only
  terminal evidence.
- The corrected head-runtime combined backend regression passed **624 tests** in
  **2722.21s** on image `b865f800…`. Its three warnings are the existing
  Starlette/httpx and OpenAPI-validator deprecations. The only later source
  correction copied the exact predecessor function text into the clean downgrade;
  it does not alter the `0015` head schema or runtime. The final `06afe414…` image
  reran every migration-affected closure and database-startup check.
- Migration compatibility preserves predecessor business fingerprints while
  excluding only the two successor columns. The exact schema manifest keys
  columns by stable name and still hashes types, nullability, defaults,
  constraints, indexes, triggers and functions.

PC1/PC2 remain pending. Only synthetic identities, test mail and task-owned
disposable PostgreSQL/browser resources were used. Real accounts and production
remain prohibited; no later slice is authorized.

## Exact commands and results

Run from the repository root unless a working directory is stated:

- `docker compose --env-file /tmp/mjl-pta3f-final.env -f compose.rebuild.yaml -p mjl-pta3f-final build backend` — built final image
  `sha256:06afe414b5432f8f7a3a70dba73c2576ba9e3bd78c1fdb9401bba224dfa7a5f4`.
- `docker compose --env-file /tmp/mjl-pta3f-final.env -f compose.rebuild.yaml -p mjl-pta3f-final run --rm -e MJL_AUTH_MODE=off backend sh -c 'ruff format --check app tests/test_closure.py && ruff check app tests/test_closure.py && mypy app && TEST_DATABASE_URL="$DATABASE_URL" pytest -q tests/test_closure.py::test_pta3f_migration_upgrades_clean_predecessor'` — Ruff format/lint and mypy passed; exact canonical predecessor comparison passed.
- `docker compose --env-file /tmp/mjl-pta3f-final.env -f compose.rebuild.yaml -p mjl-pta3f-final run --rm -e MJL_AUTH_MODE=off backend sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -q tests/test_closure.py tests/test_database.py'` — **29 passed**, one existing Starlette/httpx deprecation warning, **260.16s**.
- Before the downgrade-only exact-text correction, `docker compose --env-file /tmp/mjl-pta3f-final.env -f compose.rebuild.yaml -p mjl-pta3f-final run --rm -e MJL_AUTH_MODE=off backend sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -q'` on head-runtime image `b865f800…` — **624 passed**, three existing dependency deprecation warnings, **2722.21s**.
- From `frontend`, `npm run lint && npm run lint:css && npm run format:check && npm run test:unit && npm run build` — lint/format passed, **58 passed**, production/PWA build passed with the existing chunk-size warning.
- From `frontend`, `npm run test:e2e -- e2e/execution.spec.js` — **4 passed** in **9.2s**.
- `git diff --check` — passed after the review corrections.

## Independent review

The independent reviewer initially found missing terminal action/race/negative
authorization/browser evidence and read projections taking write locks. After
those corrections, the same reviewer found and required closure of a direct
PostgreSQL Operation-INSERT bypass and exact predecessor-function restoration on
clean downgrade. The implementer corrected every accepted finding and returned
the candidate to that reviewer. Final re-review returned **PASS** with no blocking
correctness, security, scope, migration or evidence finding. The reviewer made no
implementation changes.
