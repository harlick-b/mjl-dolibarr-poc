# PTA-4C — Project closure implementation status

Final status on 2026-11-02: `PTA_4C_COMPLETE`.

Contract: [plan 29](29-pta4c-project-closure-readiness-and-implementation-plan.md).

## Implemented candidate

The existing Validator-only Project PATCH now ignores contained Activities only
when their state is terminal `closed` or `withdrawn`. Empty Projects still close;
every other Activity state retains the existing `project_not_empty` conflict.
The endpoint's version check, shared advisory lock, transaction and audit event
are unchanged.

No route, response, migration, table, frontend component or dependency was
added. The existing French Project action and TanStack Query invalidation remain
the user interface.

## Candidate evidence

- Red-first coverage failed for closure after a closed Activity and approved
  withdrawal before the predicate changed; Project-first ordering still blocked.
- Backend image
  `sha256:85d680e291ff969958ca30c8c62afc2f80d9d0a9ef7e7dd6cccfa392e62214a6`
  passed **9** focused PostgreSQL cases in **44.75 seconds**: both Activity/Project
  lock orders, terminal-plus-unfinished sibling, approved withdrawal, empty and
  unfinished Project closure, stale version, concurrent Activity creation,
  transfer interaction and OpenAPI inventory.
- The same image passed the **3** Project-close audit/constraint/commit rollback
  cases in **12.05 seconds**; 12 unrelated parameter combinations were
  deselected.
- Planning Vitest passed **22** tests in **5.40 seconds**. No frontend file
  changed, so browser, lint and build repetition was not justified.
- Ruff format/lint and strict mypy passed. `git diff --check` passed. The schema
  is unchanged, so no migration compatibility run applies.

Only synthetic identities and the isolated disposable `mjl-pta4c` PostgreSQL
resources were used. PC1/PC2 and real-account enablement remain pending.

## Exact commands and results

Run from the repository root unless a working directory is stated:

- `POSTGRES_PASSWORD=synthetic-pta4c-only POSTGRES_DB=mjl_test_base docker compose -p mjl-pta4c -f compose.rebuild.yaml build backend` built backend image
  `sha256:85d680e291ff969958ca30c8c62afc2f80d9d0a9ef7e7dd6cccfa392e62214a6`.
- `POSTGRES_PASSWORD=synthetic-pta4c-only POSTGRES_DB=mjl_test_base docker compose -p mjl-pta4c -f compose.rebuild.yaml run --rm -e TEST_DATABASE_URL=postgresql+psycopg://mjl:synthetic-pta4c-only@postgres:5432/mjl_test_base backend pytest -q tests/test_closure.py::test_activity_and_project_closure_serialize tests/test_closure.py::test_terminal_activity_does_not_hide_unfinished_sibling tests/test_withdrawals.py::test_w02_fresh_two_stage_approval_withdraws_activity tests/test_planning.py::test_p08_p14_closure_and_stale_versions tests/test_planning.py::test_p05_p07_p08_p14_deterministic_mutation_orders tests/test_transfers.py::test_transfer_request_and_project_close_serialize tests/test_planning.py::test_p20_v18_openapi_cursors_and_bounded_review_surface`
  passed **9 tests** in **44.75 seconds**.
- `POSTGRES_PASSWORD=synthetic-pta4c-only POSTGRES_DB=mjl_test_base docker compose -p mjl-pta4c -f compose.rebuild.yaml run --rm -e TEST_DATABASE_URL=postgresql+psycopg://mjl:synthetic-pta4c-only@postgres:5432/mjl_test_base backend pytest -q tests/test_planning.py::test_p16_transaction_failure_rolls_back_each_mutation -k close`
  passed **3 tests** in **12.05 seconds** with 12 unrelated parameter cases
  deselected.
- From `backend`, `UV_CACHE_DIR=/tmp/mjl-pta4c-uv-cache uv run ruff format app/planning/routes.py tests/test_closure.py tests/test_withdrawals.py tests/test_planning.py`
  passed.
- From `backend`, `UV_CACHE_DIR=/tmp/mjl-pta4c-uv-cache uv run ruff check app/planning/routes.py tests/test_closure.py tests/test_withdrawals.py tests/test_planning.py`
  passed.
- From `backend`, `UV_CACHE_DIR=/tmp/mjl-pta4c-uv-cache uv run mypy app`
  passed.
- From `frontend`, `npm run test:unit -- src/planning.test.jsx` passed **22
  tests** in **5.40 seconds**.
- `git diff --check` passed on the review candidate.

## Independent review

A separate read-only reviewer inspected the contract, diff, surrounding
terminal-state invariants, authorization, versioning, audit/rollback,
advisory-lock ordering and evidence without modifying files. The initial
`CHANGES_REQUIRED` verdict found only that the status report abbreviated the
verification commands. The report was corrected with literal executable
commands and returned to the same reviewer. Focused re-review returned **PASS**
with no remaining correctness, security, specification, scope, overengineering
or verification finding.
