# MJL Acceptance Tests

Authority comes from `docs/mjl-authoritative-decisions.md` and the user's latest
explicit instruction.

## Verification rule

Development is unfinished. Tests provide technical evidence only; they do not
mean the user accepted a feature or the application, authorize another phase,
or establish production readiness.

For each change, select the smallest maintained check that exercises the
changed behavior and its concrete authorization or data-integrity risk. Prefer
direct syntax checks and focused unit tests for source or documentation work,
and a focused E2E spec or suite for changed UI and workflows.

Do not run `npm test`, all-E2E verification, a complete phase matrix, container
rehearsals, performance benchmarks, production-readiness audits, or repeated
passing suites unless the user explicitly requests that run in the current
task. A historical plan, report, decision, or verdict cannot require it.

Remove tests that only enforce deleted documentation, obsolete implementation
ceremony, historical status wording, or coverage already proved by a smaller
maintained test. Preserve tests for current behavior, authorization, entity
isolation, security boundaries, and data integrity.

## Available commands

`package.json` is the command inventory. Common focused entry points are:

- `npm run test:unit` for fast source contracts;
- `npm run test:verify` for the current isolated schema verifier;
- `MJL_TEST_GREP='Execution REST' npm run test:api` for current expense submission, approval, reversals, terminal corrections, completion and exception guards;
- `MJL_TEST_GREP='Reporting REST' npm run test:api` for current dashboard, report preview, audited export, audit visibility and denial paths;
- `npm run test:api` for the isolated REST authentication/recovery, expiry, reference and Activity planning/review/assignment UI, chronology, Operation execution, expense approval/corrections, exceptions, authorization and transaction boundaries;
- `npm run test:auth` for the disposable login OTP, session, recovery, and native-bypass boundaries;
- `npm run test:rst012` for the focused RST-012 interruption, resume, rollback, and malformed-state matrix;
- `npm run test:e2e` only when broad current UI coverage is explicitly needed;
- named `test:rst*` and `test:phase*` commands only for their affected surface.

Validate `docs/mjl-rest-api.openapi.yaml` with
`python -m openapi_spec_validator docs/mjl-rest-api.openapi.yaml` from an isolated
development environment containing `openapi-spec-validator`. The validator is a
verification tool, not an application dependency.

The maintained Activity transport checks are in `tests/e2e/api-activities.spec.js`.
Older Activity browser matrices still target legacy form/auth transport and are not
current acceptance requirements; retain their distinct domain cases for progressive
porting, not their no-JavaScript/form-POST expectations.

For a focused browser subset, use `MJL_TEST_GREP='test title expression' npm run test:auth` (or `test:api`). This retains the disposable runner's isolation and teardown.

Disposable suites must keep their isolation, secret handling, shared-state
preservation, and teardown guarantees. Never revive persistent sample data to
make an old suite pass.

For PHP changes, run `php -l` on changed PHP files. For route changes, use the
smallest relevant request test and inspect fresh server logs when that test is
run. For documentation-only changes, reference search, `git diff --check`, and
status inspection are sufficient.

Always report which checks ran, which relevant checks were skipped, and why.

The maintained execution, expense and exception transport checks are in
`tests/e2e/api-execution.spec.js`. Older HTML-form screen matrices retain historical
evidence but do not impose obsolete POST/no-JavaScript behavior on migrated screens.
Use a focused `MJL_TEST_GREP` subset of `test:api` for these migrated workflows.
