# Financial return simplification

Authorized by the user's approval of the simpler return path on 2026-11-03;
DEC-135 is the business authority. Earlier financial slice contracts describe
the former return-then-cancel sequence as historical behavior.

## Outcome and invariants

Returning a décaissement or virement request makes that request terminal and
read-only. The Agent can correct eligible facts and submit a fresh request
without cancelling the returned one. Keep original amounts, decisions, reasons
and audit; no approval is inherited. A pending submitted/prevalidated request
can still be deliberately cancelled. At most one nonterminal/approved request
of each kind exists per Activity. Approved décaissement remains frozen even
when a downstream virement is returned; formal planning/budget controls remain.

## Implementation seams

- Reuse current return/submit/cancel REST responsibilities and transactions.
  Update active-request selection, execution/closure projections and UI actions.
- Migration 0021 changes the two partial unique indexes and transition guards
  so returned rows are terminal history. Add no table, field or state. Preserve
  older cancelled history; refuse downgrade if the older uniqueness rule would
  lose representability. Update the existing exact-schema guard.
- Reuse the execution workspace and its history/detail cards. Explain the
  correction path in French, keep return reasons discoverable, and preserve
  independent cursor navigation and authorization. Existing design tokens apply.

No Activity-state merge, generic workflow mechanism, approved amount editing,
reopening, production change, banking action or later slice follows.

## Checks

API regressions cover Supervisor/Validator returns, direct correction and fresh
submission, immutable history, fresh two-stage approval, obsolete-action denial,
single-active-request concurrency, atomic audit rollback, zero-spending and
closure interactions, and the downstream approved-source freeze. Database checks
cover terminal transitions, uniqueness, migration upgrade/downgrade/re-upgrade
and exact schema compatibility. Run the affected financial suites and shared
schema/static checks; reuse adjacent workflow coverage proportionately.

React regressions and focused Chromium journeys verify both request types,
returned history/reasons, direct fresh submission and historical-page behavior.
Run lint/build and record final source/artifact plus actual results below.

## Mandatory independent handoff

A separate reviewer who did not implement this change inspects DEC-135, the
actual diff, surrounding guards and final verification evidence. Review only:
report severity, file/line, impact and smallest correction; do not edit source.
The implementer fixes accepted findings and returns the candidate to that same
reviewer. Stop only after blocking findings and mandatory verification gaps are
resolved; update the current roadmap once. No later slice is authorized.

## Evidence

Implemented on 2026-11-03 against base `3ab6e75`. Returned rows no longer occupy
the active financial slot; the server, database and execution workspace agree.
The latest returned reason is visible without opening history, and an explicitly
selected returned request permits fresh submission using the current Activity
version. Old cursor pages cannot infer that no current request exists. The UI
adds French guidance within existing cards and retains the approved v3 tokens.
Correction to zero spending keeps the returned décaissement history beside the
zero declaration, without offering a new zero-amount financial request.
The existing root Agent communication rule (layman's explanations) is preserved.

Final source fingerprints (SHA-256 over sorted repository-relative paths + NUL +
bytes + NUL):

- The nine backend paths below:
  `960bfbabce2cffe7e2634fe8c62ffbd3c53b51957cde4fc91c3718723f9a93d0`.
- The five frontend paths below:
  `f719cc1e90a1320b14d6a1fff4ce82dcbf97cee5ab348c72336fbe46dba309ac`.
- `frontend/dist`:
  `fa061b2f13569df181e0ebfa5a563ba54fef456fcd106c03abc41a73abc7a969`.

```text
backend/app/auth/service.py
backend/app/planning/disbursement.py
backend/app/planning/execution.py
backend/app/planning/models.py
backend/app/planning/virement.py
backend/migrations/versions/0021_financial_returns.py
backend/tests/test_disbursement.py
backend/tests/test_virement.py
backend/tests/test_financial_returns.py
frontend/src/ExecutionView.jsx
frontend/src/execution.test.jsx
frontend/src/i18n.js
frontend/e2e/execution.spec.js
frontend/e2e/financial-returns.spec.js
```

Concurrent unrelated Partner Fiche implementation/tests were preserved and are
excluded from this scoped fingerprint and review. They did not change these
financial runtime seams during the regression run.

From `backend/`:

```sh
PYTHONPATH=.:.venv/lib/python3.12/site-packages /usr/bin/python3.12 /tmp/mjl-state-pytest.py -q tests/test_disbursement.py tests/test_virement.py tests/test_financial_returns.py
PYTHONPATH=.:.venv/lib/python3.12/site-packages /usr/bin/python3.12 /tmp/mjl-state-pytest.py -q tests/test_financial_returns.py -k database_terminal
PYTHONPATH=.:.venv/lib/python3.12/site-packages /usr/bin/python3.12 /tmp/mjl-financial-manifest.py
.venv/bin/ruff check app/planning app/auth/service.py migrations/versions/0021_financial_returns.py tests/test_disbursement.py tests/test_virement.py tests/test_financial_returns.py
.venv/bin/ruff format --check app/planning app/auth/service.py migrations/versions/0021_financial_returns.py tests/test_disbursement.py tests/test_virement.py tests/test_financial_returns.py
.venv/bin/mypy app
```

Financial suites: **80 passed** (673.97s). The runtime/migration candidate remained
unchanged during this run. Its test-only immutability assertion was then verified
on the corrected source with **2 passed, 7 deselected** (22.69s); the separate
boundary suite also passed **9 tests** (98.79s) before that assertion correction.
The broad run loaded tests before the assertion correction; it is not claimed as
a rerun of that final test edit. Ruff passed; mypy passed 32 source files.
Initial regressions reproduced the blocked
correction and duplicate-request rejection after return. Three earlier migration
assertions in the financial suites still named head 0019; they now expect 0021.
The independent reviewer found a test using a nonexistent virement amount column;
the corrected test mutates its actual immutable reviewer exclusions and asserts
the intended trigger message and SQLSTATE, including the terminal-transition check.

Independent review was led by separate agent `state_business`, which inspected
requirements, source, surrounding guards and actual verification logs without
editing implementation files. It accepted the immutability-test correction and
the later zero-history UI correction on re-review. Final independent verdict:
**PASS**, no remaining blocking finding or mandatory verification gap. The
reviewer read the final 80-case and corrected two-case logs and independently
recomputed both scoped source fingerprints.

The temporary test runner sets only `TEST_DATABASE_URL` and calls
`pytest.main(sys.argv[1:])`. Tests create/drop individual UUID databases in the
task-owned PostgreSQL 14 cluster on port 55439. `backend/.venv` is preserved;
system Python supplies `_ctypes`, absent from its local interpreter. The test
cluster was stopped after verifying it had no other client connections. Existing
Starlette/httpx deprecation warnings remain.

Migration verification covers empty upgrade/downgrade/re-upgrade, populated
predecessor return-then-cancel histories, terminal immutable returned rows and
refusal to downgrade multiple retained returns. The separate temporary manifest
runner creates/drops its own database and evaluates the schema manifest from
`AuthService.environment_verified`; head → 0020 → head matches exactly:

- 0020: `5e556766e799caa02d3fb077938c6c6a948615a46b64f72affcc77b8d3eefa5d`.
- 0021: `8bc157e7c05ad4ba1ac6f53b2c3bc49be493d251a0de082c54c099799f47eaed`.

Application and schema must move together to 0021. The migration adds no table
or state and never erases old history. Downgrade deliberately refuses histories
that the earlier one-open-request rule cannot represent.

From `frontend/`:

```sh
npm run test:unit -- src/execution.test.jsx
npm run lint
npx prettier --check src/ExecutionView.jsx src/execution.test.jsx src/i18n.js e2e/financial-returns.spec.js e2e/execution.spec.js
npm run build
PLAYWRIGHT_CHROMIUM_PATH=/opt/google/chrome/chrome npm run test:e2e -- e2e/financial-returns.spec.js e2e/execution.spec.js
```

React: **21 passed** (16.53s). Chromium: **7 passed** (45.9s), including both
mobile financial returns, preserved reason/history, blocked duplicate submission,
old-cursor restrictions and the full replacement→approval→settlement journey.
The older browser fixture was updated from return-then-cancel to direct fresh
submission. ESLint and build passed; the existing >500 kB bundle warning remains.
Browser tests mock REST; PostgreSQL/API tests provide separate server evidence.
No CSS or new visual surface was introduced; mobile checks assert no overflow.

Security review retains current authentication/CSRF/resource roles, independent
approval and atomic audit boundaries. No new API responsibility, public surface,
production setting or data migration is added. Broad historical suites,
production audits and human visual acceptance were not run for this bounded
change. `tasks/lessons.md` was evaluated; no additional durable lesson beyond the
existing focused-check and simple-state guidance was needed. Development checks
and independent review do not imply user acceptance or production readiness.
