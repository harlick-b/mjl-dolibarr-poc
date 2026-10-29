# PTA-3D implementation status

## Implemented boundary

DEC-118 authorizes synthetic external-virement confirmation only. After final
PTA-3C approval, an Agent declares that the exact server-owned amount was
transferred externally, records the effective date and may add an optional
reference/comment. Reasoned corrections append immutable revisions. MJL does
not execute or independently verify the bank transaction.

Migration `0013_pta3d` adds one append-only confirmation table. Three REST
responsibilities provide declaration, correction and cursor history. The French
realization workspace exposes the fixed amount, explicit attestation, correction
form and history. Advisory-lock ordering, Activity versions, current-role/CSRF
checks, exact schema provenance, transactional audit and online-only Query
reconciliation are retained.

Different or partial amounts, discrepancy handling, declaration cancellation,
reversement, formal closure, documents, notifications, banking integration, real
accounts and production remain excluded. Future reversement and closure must
block further corrections once either process begins.

## Verification evidence

`PTA_3D_COMPLETE` on 2026-10-29.

- Runtime and PostgreSQL tests used image
  `sha256:c704062295538e8ed54d3118c38a5774f15f67cea6268efd20f60979fe10775d`.
  The recorded commands were `pytest -q tests/test_virement.py` and
  `pytest -q` inside that isolated image; frontend evidence used
  `npm run test:unit`, the lint/format/build scripts and
  `playwright test e2e/execution.spec.js`.
- The complete final backend regression passed: **577 passed** in 2444.07
  seconds. The three warnings are existing FastAPI/httpx and OpenAPI validator
  deprecations. The run used the corrected final candidate image after the
  exhaustive OpenAPI path inventory was updated for the three PTA-3D routes.
- The final candidate image passed the focused PostgreSQL module: **40 passed**
  in 326.50 seconds. It covers Agent-only declaration/correction, CSRF and
  resource scope, exact large XOF, future-date and no-op rejection, maximum
  Unicode, immutable history, stale Activity and financial bases, deterministic
  duplicate/correction/deactivation races, transactional audit, constraint and
  synthetic commit rollback, schema tamper and destructive-downgrade refusal.
- The exact predecessor image was built from commit
  `1a318d58068ad0294a8b7ca4dcda8661a54571f7`. Its `0012_pta3c` migration is
  byte-identical to the candidate predecessor. Authentic approved PTA-3C data
  migrated to `0013_pta3d` with identical Activity, Operation, revision,
  disbursement, virement, decision and audit hashes and zero seeded confirmation
  rows. The candidate then completed password-plus-OTP login and declared the
  exact approved amount; the predecessor runtime rejected the successor schema.
- Backend Ruff lint/format and mypy passed. Frontend ESLint, Stylelint and
  Prettier passed; **53 Vitest tests** and the Vite/PWA build passed with the
  existing chunk-size warning.
- Three final real-Chromium execution journeys passed. PTA-3D coverage includes
  declaration, reasoned correction, current actor/time provenance, cursor
  history with browser navigation, reviewer read-only behavior, and Agent-side
  offline blocking with no mutation replay after reconnect.
- Independent engineering and security/specification reviewers treated the
  implementation and evidence as untrusted, reported blocking gaps, inspected
  the corrections, and issued final read-only PASS results with no remaining
  code, security or specification finding.

PC1/PC2 remain pending. Only synthetic identities, test mail and disposable
isolated databases were used. Real accounts and production remain prohibited;
no later slice is authorized.
