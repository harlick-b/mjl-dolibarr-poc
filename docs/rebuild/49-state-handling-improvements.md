# Focused state-handling improvements

Authorized by the user on 2026-11-03 after the state-handling review.

## Contract

Preserve draft concurrency tokens across background refreshes; align advertised
business actions with command guards; reconcile uncertain uploads before another
attempt; scope planning reconciliation to its Activity; let History and Partner
users explicitly reverify access; defer application updates during unsaved forms
or pending mutations. Preserve current business rules, server authorization,
immutable evidence, synthetic isolation and existing visual patterns.

Use existing form, Query and domain-policy seams. No workflow framework, new
business phase, migration, generic retry queue, production changes or unrelated
Partner-portal edits. Preserve the pre-existing worktree (snapshot under
`/tmp/mjl-state-fixes-before`). UI/security checks follow DEC-102 and the existing
design/security standards; layouts and tokens remain unchanged.

## Verification and stopping

Use failing focused React regressions followed by implementation for draft
refresh, reconciliation/navigation, upload uncertainty, access recovery and
reload guards. Exercise changed backend action projections through disposable
PostgreSQL/API tests, including zero declarations, closure and amended dates.
Run affected frontend suites, lint/build, backend static checks and focused
Chromium journeys. Record actual commands/results below; do not substitute
earlier slice evidence or claim production acceptance.

## Mandatory independent review

Hand the final task diff, governing contracts and verification evidence to a
separate agent that did not implement it. The reviewer inspects source and
evidence independently and makes no edits. Fix accepted findings, return them to
the same reviewer, and stop only after blocking findings/verification gaps are
resolved. Update the roadmap once at completion. No later slice is authorized.

## Evidence

Implemented on 2026-11-03. Draft fields retain their original concurrency token
in Activity editing, assignments and Operation observations, with explicit discard
paths. Financial/action projections reuse current guards for zero-spending,
closure and already-started Operations. Unknown uploads reconcile the newest
page before another attempt, with retry inside the modal. Activity navigation
resets local reconciliation. History/Partner access can be freshly verified.
Business forms track unsaved input and disable edits while saving; PWA updates
wait for these forms and pending Query mutations.

Final source fingerprints (SHA-256 over sorted relative paths + NUL + bytes +
NUL, excluding Python caches):

- `backend/app` + `backend/tests`: `b7f9daf17a549861f34bc9e05d6d63d5a530efd3fa0c7c74fd35532a29364bf3`.
- `frontend/src`: `8b02fc44909427e26bc3a9292cf453a45a63eae0a115f4e13d780e8ead429754`.

From `frontend/`:

```sh
DEBUG_PRINT_LIMIT=500 npm run test:unit -- --maxWorkers=1 src/planning.test.jsx src/execution.test.jsx src/audit-history.test.jsx src/partner-portal.test.jsx src/state-handling.test.jsx src/pwa-update.test.jsx
npm run lint
npm run build
PLAYWRIGHT_CHROMIUM_PATH=/opt/google/chrome/chrome npm run test:e2e -- e2e/state-handling.spec.js
```

The six unit suites passed **56 tests** (46.47s); ESLint and production build
passed. The build retains the existing >500 kB chunk warning. Regressions first
reproduced stale tokens, lost-response/recovery and update-guard failures; the
Operation observation regression specifically sent version 8 instead of draft
version 7 before the correction.

From `backend/`, using system Python with the existing virtualenv packages:

```sh
PYTHONPATH=.:.venv/lib/python3.12/site-packages /usr/bin/python3.12 /tmp/mjl-state-pytest.py -q tests/test_zero_spending.py tests/test_closure.py tests/test_execution.py tests/test_disbursement.py tests/test_virement.py -k 'agent_declares_zero or return_releases_correction or validator_return_commits or financial_detail_has_no or closed_activity_rejects_execution or approved_budget_amendment or execution_is_role_date or amendment_pause_preserves or cancellation_releases_execution or duplicate_submission_is_serialized_and_planning_is_frozen or agent_declares_exact_external_transfer or agent_submits_locked_amount'
PYTHONPATH=.:.venv/lib/python3.12/site-packages /usr/bin/python3.12 -m ruff check app tests/test_zero_spending.py tests/test_closure.py tests/test_execution.py
PYTHONPATH=.:.venv/lib/python3.12/site-packages /usr/bin/python3.12 -m mypy app
```

**14 passed, 133 deselected** (91.46s); Ruff passed; mypy passed 31 files.
The temporary runner only sets `TEST_DATABASE_URL` to a local disposable
PostgreSQL 14 cluster at port 55439 and calls `pytest.main(sys.argv[1:])`.
The base database is empty; fixtures create and drop isolated UUID databases.
A generated password satisfies URL validation against local trust auth.
The existing Starlette/httpx deprecation warning remains. `backend/.venv` was
preserved; its Python executable lacks `_ctypes`, hence the system interpreter.

No migration compatibility run is required: no schema, persisted states,
constraints or migration files changed. Broad historical suites and production
checks were not run for this bounded correction. Browser tests mock the REST
boundary and exercise native dialogs, offline recovery and a real waiting service
worker; PostgreSQL/API tests provide separate backend evidence. These checks are
development evidence, not business acceptance or production readiness.

Independent backend review (`state_business`) passed after removing the obsolete
zero-spending helper and adding return-path action coverage. Independent frontend
review (`state_frontend`) required newest-page upload reconciliation, an accessible
in-modal retry and locking form edits during save. All were corrected and
re-reviewed; the adjacent Operation draft correction was independently reviewed.
Final Chromium run: **3 passed in 12.9s**, including lost upload response with
failed refresh/retry from an older cursor, offline Partner revalidation, and a
real PWA update remaining queued while dirty then reloading after explicit
discard. The PWA journey uses a 1280×1000 desktop viewport; at shorter heights
the floating notice can cover the form's Cancel button and can be dismissed with
“Plus tard”. The test awaits the intended reload before inspecting the worker.
Tested `frontend/dist` fingerprint using the same algorithm:
`65b080fa7bb249878deec0e556c0ce20e2d9a5a997c3fb153c4a0e96bb383c2c`.

Both independent reviewers returned **PASS**, with no unresolved blocking
implementation or verification findings. They inspected final logs; backend
review reran Ruff/mypy and frontend review reran ESLint. Final whitespace review
passed. The final code-review pass additionally centralized the newly introduced
French labels and replaced Operation-card remounts with explicit adoption after
save or discard; its regression changes remote amount, completion and observation
while preserving the local draft/version. Both corrections passed independent
re-review. The disposable PostgreSQL cluster was stopped. No later slice or
deployment was performed.
