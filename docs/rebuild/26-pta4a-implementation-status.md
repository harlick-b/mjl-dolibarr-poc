# PTA-4A implementation status

**PTA_4A_COMPLETE** on 2026-11-02.

## Implemented boundary

`GET /api/v1/ptas/{pta_id}/metrics` returns a server timestamp and exact current
whole-PTA facts: closed and definitively approved Activity counts, plus final
spending of closed Activities and the definitively approved allocation. It reuses
the shared authenticated business-role read lock and approved-plan projection.
The endpoint has no filters, pagination or historical cutoff, so list state cannot
alter its denominator.

The existing French annual PTA screen uses one TanStack Query projection and the
approved dashboard two-card composition. It displays physical and financial
percentages to one presentation decimal, exact supporting XOF/count facts,
`Non calculable` for zero denominators and values above 100 percent without a cap.
No schema, migration, mutation, audit event or new page was added.

Historical as-of KPIs, Activity Fiche, exports, documents, reminders, Partner
access, real identities and production remain excluded. PC1/PC2 remain pending.

## Verification evidence

- Backend image `sha256:5f6e3f2ea8470e88436021826741accef5a7959c8a7b5606b419643ed0e88ae8`:
  Ruff formatting/lint and strict mypy passed. Four disposable-PostgreSQL metric
  tests passed in 33.04 seconds, covering closed-only spending, all business-role
  reads/Admin denial, guessed-ID denial, pending amendment baselines, approved
  withdrawal exclusion/zero denominators and transfer attribution. Four focused
  closure, withdrawal, transfer and OpenAPI regressions passed in 28.93 seconds.
- Frontend ESLint, Stylelint and Prettier passed; all 60 Vitest tests passed. The
  production/PWA build passed with the existing chunk-size warning.
- One focused real-Chromium journey passed in 3.6 seconds and verified the two
  cards, French percentage/XOF display and desktop/mobile visibility.
- `git diff --check` passed. Only synthetic identities and the task-owned
  disposable `mjl-pta4a` PostgreSQL resources were used.

## Exact commands and results

Run from the repository root unless a working directory is stated:

- `POSTGRES_PASSWORD=pta4a-synthetic-only POSTGRES_DB=mjl_test_base docker compose -f compose.rebuild.yaml -p mjl-pta4a build backend` — built backend image
  `sha256:5f6e3f2ea8470e88436021826741accef5a7959c8a7b5606b419643ed0e88ae8`.
- `POSTGRES_PASSWORD=pta4a-synthetic-only POSTGRES_DB=mjl_test_base docker compose -f compose.rebuild.yaml -p mjl-pta4a run --rm -e MJL_AUTH_MODE=off backend sh -c 'ruff format --check app tests/test_metrics.py && ruff check app tests/test_metrics.py && mypy app'` — 25 files formatted, Ruff passed and strict mypy passed for 24 source files on that image.
- The same Compose project/image with
  `sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -q tests/test_metrics.py'` —
  **4 passed** in **33.04s** with one existing Starlette/httpx deprecation warning.
- The same Compose project/image with
  `sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -q tests/test_closure.py::test_agent_closes_complete_activity_atomically tests/test_withdrawals.py::test_w02_fresh_two_stage_approval_withdraws_activity tests/test_transfers.py::test_transfer_preserves_source_until_distinct_two_stage_approval tests/test_health.py::test_openapi_documents_actual_health_contract'` —
  **4 passed** in **28.93s** with the same existing warning.
- From `frontend`, `npm run lint && npm run lint:css` passed. After Prettier
  corrected `src/planning.js`, `npm run format:check && npm run test:unit && npm run build`
  passed: **60 tests**, production/PWA build complete, existing chunk-size warning only.
- From `frontend`, `npm run test:e2e -- e2e/metrics.spec.js` — **1 passed** in
  **3.6s** using real Chromium after sandbox escalation allowed the local preview
  listener.
- `git diff --check` — passed on the review candidate.

## Security and design review

The protected asset is current annual planning/execution data. The read route
uses fresh session evidence, the existing server-side business principal guard,
the trusted MJL context and opaque resource lookup; Admin and unknown PTAs are
denied. It accepts no mutation, user-selected cutoff, filter or amount. The UI
uses Query-owned server state and existing auth/offline invalidation.

The visual implementation uses `docs/inspiration/dashboard/dashboard.png`,
`DESIGN.md`, the Clarity design index and approved v3 tokens. It introduces no
new layout system or product assertion.

## Independent review

The independent reviewer initially returned `CHANGES_REQUIRED` without a runtime,
security, scope or overengineering defect. It required exact reproducible command
evidence and accurate pending status before completion. The implementer corrected
those documentation findings and returned the candidate to the same read-only
reviewer. Focused re-review returned **PASS** with no remaining blocking
correctness, security, specification, scope, design, overengineering or evidence
finding. The reviewer modified no files.
