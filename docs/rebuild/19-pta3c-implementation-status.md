# PTA-3C implementation status

## Contract and implemented boundary

DEC-117 authorizes synthetic virement request authorization only. After PTA-3B
approval, an Agent submits a separate request for exactly that server-owned
amount. One eligible Supervisor prevalidates and one distinct eligible Validator
approves. Reasoned return and cancellation permit a fresh request without
changing the approved source or releasing its planning/execution freeze.

Migration `0012_pta3c` adds dedicated request and immutable decision tables.
Five REST responsibilities provide submission, cursor history, exact detail,
review decisions and cancellation. The existing French realization workspace
owns the UI. Activity versions, the global mutation advisory lock, source and
financial-basis rechecks, inherited contributor exclusions, strict chronology,
deferred decision-chain validation and transactional audit fail closed.

External transfer execution or confirmation, alternative amounts, discrepancy
handling, reversement, formal Activity closure, documents, notifications, real
accounts and production remain excluded.

## Verification evidence

`PTA_3C_COMPLETE` on 2026-10-29.
All eight contract gates passed.

- Final backend regression: **562 passed** in 1975.72 seconds, with three
  existing dependency deprecation warnings. Corrected focused PTA-3C runs passed,
  including the 24-case module, deterministic Activity-version race, and four
  final source/large-XOF/direct-write gates.
- Exact PTA-3B predecessor history migrated from `0011_pta3b` to `0012_pta3c`
  with identical Activity, Operation, revision, audit, disbursement-request and
  disbursement-decision hashes and zero seeded virement rows. The predecessor
  runtime refused the successor schema; the candidate completed password-plus-OTP
  login and submitted the exact approved amount. Clean install,
  downgrade and re-upgrade passed; evidence-bearing downgrade is refused.
- PostgreSQL coverage includes role/CSRF/resource denial, valid foreign and
  cancelled sources, exact `9,000,000,000` XOF, individual-zero Operations,
  stale versions, advisory-lock races, source/basis reconciliation, rollback,
  audit atomicity, strict chronology, forged exclusions, invalid initial state,
  malformed decision chains, immutability and schema tamper refusal.
- Backend Ruff lint/format and mypy passed. Frontend ESLint, Stylelint and
  Prettier passed; **52 Vitest tests** and the Vite/PWA build passed with the
  existing chunk-size warning.
- Real Chrome passed the PTA-3A, reviewer and PTA-3B/PTA-3C journeys. PTA-3C
  coverage includes return, cancellation, fresh review, approval, independent
  pagination, selection and browser back/forward. Unit checks cover uncertain
  response reconciliation, access loss and offline mutation clearing without
  replay.
- Independent engineering and security/specification reviewers found blocking
  defects and evidence gaps, reviewed the corrections, and both issued final
  read-only PASS results with no blocking, high or material medium finding.

PC1/PC2 remain pending. Only synthetic identities, test mail and disposable
isolated databases were used. No later slice is authorized.
