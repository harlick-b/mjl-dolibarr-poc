# RST-014A Execution Report

Status: `IMPLEMENTED_PENDING_POST_COMMIT_VERIFICATION_AND_REVIEW`.

Approval provenance: the user explicitly approved RST-014A on 2026-08-19.
RST-013A remains separately approval-gated and was not implemented.

## Implemented boundary

- Added the sole structured `createPhase1FixtureSet(...)` seam and a PHP
  factory that preflights the immutable project/file sentinel before loading
  Dolibarr or opening its write transaction.
- Added entity-0 database sentinel and run-global namespace reservations,
  fixed allowlisted prepared writes, null-prototype/frozen secret-free results,
  and native Admin before/after attestation.
- Added a 24-byte per-run non-Admin credential, a hardened 1 MiB MariaDB tmpfs,
  atomic mode-0600 client defaults, stdin-only SQL, bounded diagnostics,
  retrying unconditional teardown, protected shared-state streaming digests,
  and every-outcome artifact hardening/scanning.
- Migrated Phase 1, RST-003, RST-010A, auth-concurrency, and manual
  accessibility setup away from Admin-hash copying, password-bearing argv, and
  case-local principal/business/audit cleanup.
- Added disposable factory allowlist, replay, concurrent namespace,
  cross-entity, wrong-mode/owner/user, shared-preflight, and containment tests.

No Dolibarr core file, shared business row, shared ECM row, shared document, or
persistent fixture was changed. Generated test evidence is confined to
`test-results/runs/<projectName>/` and every disposable container, network, and
named volume is removed.

## Runtime correction

The approved draft required a forced `dol_hash($password, 'password_hash')`.
Live verification established that this tenant's active Dolibarr 23 algorithm
is SHA-256 and its native verifier rejects a forced password-hash value unless
the global algorithm is changed. Changing that global would invalidate the
preserved Admin credential. The implementation therefore uses the supported
active native `dol_hash($password, '0')` path for the cryptographically random,
single-run disposable password. `pass` and `pass_temp` remain null; no Admin
hash is read or copied.

## Verification to date

- `npm run test:unit`: all current Node/PHP contracts passed.
- PHP syntax: `phase1-fixture-preflight.php`, `phase1-fixture.php`,
  `database-evidence.php`, and modified `rst010a-document-state.php` passed
  `php -l`.
- RST-014A tenant `mjl-test-20260819t141521-368296-87846176`: 19/19 browser
  cases passed, shared before/after evidence matched, artifacts passed scanning,
  and all containers/network/volumes were removed.
- The later expanded 24-case run passed 21 cases; its concurrency case reached
  the prior 60-second test limit and two dependent cases did not run. The
  shared source gate also correctly rejected an in-flight test edit. The
  timeout is now 180 seconds; final committed-source evidence remains pending.

Completion requires a clean commit, committed-source `test:rst014a`, public
unit/verify/E2E gates proportional to the changed surface, and independent
Standards/Spec/security review with zero actionable findings.
