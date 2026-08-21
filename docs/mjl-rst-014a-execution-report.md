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

- `npm run test:unit` at commit `51cd00a`: 77/77 Node unit cases and the
  retained PHP contracts passed after the review corrections.
- PHP syntax: `phase1-fixture-preflight.php`, `phase1-fixture.php`,
  `database-evidence.php`, `auth-parallel-worker.php`, and modified
  `rst010a-document-state.php` passed `php -l`.
- Committed-source focused tenant `mjl-test-20260819t152824-611337-0d76641f`
  at commit `f0c9dd6`: all 27 browser cases passed in 2.9 minutes, including canonical-stdin auth concurrency,
  independent Admin attestation, trigger-digest mutation/restoration, and real
  repeated SIGINT/SIGTERM runner teardown.
- RST-010A evidence in that tenant remained unchanged across hostile probes:
  aggregate `6b61342432b80531f1e994811900e125c9b25ffbc3ee1c5ea939bc72cad4c2da`,
  filesystem `76336c682af319943d25c01042c87df2f7f2c637964eea02ac7ba8d85b7cdf4b`,
  `llx_ecm_files` `d1f0ef8e9ed5d972af5adfdbbc855175650f9daafaf343463f63582feb3f0bd2`,
  and `llx_ecm_directories`
  `7584307a47007fffa40af817b1467f6394beeea77921c966f5a35a1683043796`.
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
- Public committed-source gates also passed: `npm run test:verify` in tenant
  `mjl-test-20260819t153329-637668-5fddf1e7` (including a successful teardown
  retry after one transient MariaDB stop error), and `npm run test:e2e` with
  27/27 cases in tenant `mjl-test-20260819t153333-638111-937387e6`. Both left
  no disposable resource.
- Final committed-source focused gate at commit `51cd00a` used tenant
  `mjl-test-20260819t160627-736754-d1ac3f40`: all 36 browser/runtime cases
  passed in 358.2 seconds. This included direct-PHP Unicode/canonical-input
  rejection, post-reservation transaction rollback, every permitted role in
  two entities, absent-sentinel complete-factory denial, schema mutation
  detection for triggers/database defaults/routine parameters/sequences, and
  real success/setup/test/diagnostics-failure/diagnostics-timeout/repeated
  SIGINT/SIGTERM subprocess paths. RST-010A aggregate, filesystem,
  `llx_ecm_files`, and `llx_ecm_directories` hashes were respectively
  `b173d2d88a9d57229a0e8058b14c9f662cd2744d30d4a45ab79d9342107602a7`,
  `90a7de5f775ba0c97d026f33f1de849d8b4ec194e14fa29dfe772d3330c0d5c2`,
  `a142ddd3acd3057443dc9eb94814c89dadf158aa4fb3e2257466f2683eb01ea2`,
  and `d0c019f472a95d545c72edbade6b1af5bb45feceda6796ed0fe4a394383412f1`.
- The final shared before/after evidence matched exactly: protected source
  `85a4268fd922eeda68b39e5bb3a3496d478480fea1b3c930b137f162e1b9ec27`,
  database `b0f2a2b8500826dab6a76d21ef919c5d4be1816cba43b3b3a134370560124857`,
  Admin `8051d600e0740b2a2a9d4a2a85eb2674ffa3742e197e0604f5414e688236d987`,
  ECM `1dc830d123a3ca805d66f23e0d80e966dc43f0543fb46b334462b3e14308746b`,
  and documents
  `9acb96c564a4d9091b9d3f5f9570c96f58648f2f45f9c01fe3a66da28e9f713a`.
  It recorded zero views, zero routines/parameters/events, and nine triggers;
  all disposable resources were independently confirmed absent.
- The final public `npm run test:verify` gate passed at commit `51cd00a` in
  tenant `mjl-test-20260819t161245-770476-f6c7b83b` in 168.6 seconds and
  removed every container, network, and volume.

Completion requires a clean commit, committed-source `test:rst014a`, public
unit/verify/E2E gates proportional to the changed surface, and independent
Standards/Spec/security review with zero actionable findings.
