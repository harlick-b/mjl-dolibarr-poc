# RST-014A Execution Report

Status: `IMPLEMENTED_PENDING_POST_COMMIT_VERIFICATION_AND_REVIEW`.

Approval provenance: the user explicitly approved RST-014A on 2026-08-19 and
then separately approved the native `dol_hash(..., '0')` correction,
`tests/fixtures/auth-parallel-worker.php` path amendment, and post-commit
review corrections on the same date.
RST-013A remains separately approval-gated and was not implemented.

## Implemented boundary

- Added the sole structured `createPhase1FixtureSet(...)` seam and a PHP
  factory that preflights the immutable project/file sentinel before loading
  Dolibarr or opening its write transaction.
- Added entity-0 database sentinel and run-global namespace reservations,
  fixed allowlisted prepared writes, null-prototype/frozen secret-free results,
  and independent all-column native Admin before/after attestation around every
  factory outcome; the write-capable factory never reads an Admin row.
- Added a 24-byte per-run non-Admin credential, a hardened 1 MiB MariaDB tmpfs,
  atomic mode-0600 client defaults, stdin-only SQL, bounded diagnostics,
  retrying unconditional teardown, protected shared-state streaming digests,
  and every-outcome artifact hardening/scanning.
- Migrated Phase 1, RST-003, RST-010A, auth-concurrency, and manual
  accessibility setup away from Admin-hash copying, password-bearing argv, and
  case-local principal/business/audit cleanup. Auth selectors, verifiers, token
  hashes, and generated lifecycle passwords are registered in runner memory,
  transported outside argv, redacted before output, and scanned in encoded forms.
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
single-run disposable password. `pass` and `pass_temp` remain null; only the
independent read-only evidence process hashes the complete Admin row, and the
write-capable factory never reads or copies it.

## Verification to date

- `npm run test:unit`: all 13 current Node test files and retained PHP
  contracts passed after the review corrections.
- PHP syntax: `phase1-fixture-preflight.php`, `phase1-fixture.php`,
  `database-evidence.php`, `auth-parallel-worker.php`, and modified
  `rst010a-document-state.php` passed `php -l`.
- Focused tenant `mjl-test-20260819t151641-555951-b51d06fc`: all 27 browser
  cases passed in 3.2 minutes, including canonical-stdin auth concurrency,
  independent Admin attestation, trigger-digest mutation/restoration, and real
  repeated SIGINT/SIGTERM runner teardown.
- RST-010A evidence in that tenant remained unchanged across hostile probes:
  aggregate `e5efbd7f8f82ee947cebd1b201e2a139d1a489074e70911843bbd0baf45e5fbc`,
  filesystem `f2daac793c19486ca0b66b46d1a51b5d88f1e02ef2ae682f209c29b4a97816f8`,
  `llx_ecm_files` `03facf205575035f6d1da1d78ddbd66b15b41c523ffab13dfdaf2c05128343b4`,
  and `llx_ecm_directories`
  `484db93c3484debdc6ecdab8c4b8b63b8497d0396cfcf6616efa642c6f6c89f4`.
- Shared before/after evidence matched exactly: database
  `8a5e5173bcfd09fa2c0e9d02213924727cf7f8a052f8d212d1efc69261d341ed`,
  Admin `8051d600e0740b2a2a9d4a2a85eb2674ffa3742e197e0604f5414e688236d987`,
  ECM `1dc830d123a3ca805d66f23e0d80e966dc43f0543fb46b334462b3e14308746b`,
  and documents
  `9acb96c564a4d9091b9d3f5f9570c96f58648f2f45f9c01fe3a66da28e9f713a`.
  It recorded one exact active native Admin, zero business/sample rows, zero
  disposable controls, and nine trigger definitions.
- Dynamic selector/verifier/hash/password redaction and recursive artifact
  scanning passed; the outer tenant and both nested signal-probe tenants left
  no container, network, or volume.

Completion requires a clean commit, committed-source `test:rst014a`, public
unit/verify/E2E gates proportional to the changed surface, and independent
Standards/Spec/security review with zero actionable findings.
