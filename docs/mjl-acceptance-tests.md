# MJL Acceptance Tests

Authority comes from 'docs/mjl-authoritative-decisions.md'.

## Public current-purpose commands

    npm run test:unit
    npm run test:verify
    npm run test:e2e
    npm run test:rst003
    npm run test:rst007a
    npm run test:rst004
    npm run test:rst008
    npm run test:rst009a
    npm run test:rst010a
    npm run test:rst013a
    npm run test:rst014a
    npm run test:rst005
    npm run test:rst005-launcher
    npm run test:phase1-reset

- 'test:unit' runs static Node contracts and PHP presentation/navigation contracts.
- 'test:verify' provisions an isolated tenant and runs the Phase 1 schema and empty-tenant verifier.
- 'test:phase1-reset' runs the focused Phase 1 schema gates and browser
  contracts, including RST-010A, in one isolated tenant.
- 'test:rst010a' creates disposable same-entity, cross-entity, orphan, and
  public-share canaries, exercises anonymous/authenticated GET and POST plus
  traversal, encoded-path, and native delivery probes, and requires exact
  before/after filesystem and all-column ECM manifests.
- 'test:rst014a' proves the guarded fixture allowlist, global namespace
  serialization, file/database/project attestation, non-Admin credentials,
  migrated Phase 1 callers, secret-free artifacts, exact shared-state equality,
  and complete destruction of its unique tenant even on failure.
- 'test:rst013a' proves that legacy Partner-scope rows and hostile scope inputs
  cannot grant Activity access; Agent GET/POST and every current class mutation
  fail without DB/audit/ECM/document effects; reviewer output is same-entity,
  parent-matched, and limited to the approved safe fields; repeated SIGINT and
  SIGTERM destroy the real disposable runner. It also requires exact shared
  source/database/Admin/ECM/document/resource equality.
- 'test:rst005' rehearses clean target installation, exact Phase 1-to-target
  replacement, guarded direct-writer exclusion, crash/restart resumption,
  duplicate activation, containment-only rollback, finalization, fresh-process
  libsodium backup restores, role/entity/parent/POST denials, SQL invariants,
  retained authenticated/anonymous custom and native document GET/POST denial,
  complete database/filesystem/ECM evidence, and whole-tenant destruction.
- 'test:rst005-launcher' runs the exact root-owned fixed-name/no-follow launcher against a
  temporary committed-source snapshot and unique disposable Phase 1 tenant;
  it proves commit/tree/Compose/traffic/custody binding, encrypted fresh restore,
  v3 stable/execution identity separation, inherited-flock contention, exact
  negative substitutions, protected-input replacement, unsafe topology,
  foreign/alternate networks, database sessions/events, ancestor-path writers,
  real harness and launcher interruption, active mutation-lifetime `SIGKILL`
  during apply/recover/rollback with concurrent-launch rejection, operational
  full-plaintext-restore `SIGKILL` with daemon lifetime and fresh-launch reaping,
  manifest-before/manifest-target publication crashes and recovery,
  missing/duplicate/reordered/truncated/corrupt/copied/replayed/contradictory
  durable packages, secret-canary scanning, immutable create-inspect-start,
  apply/activate/verify/finalize, containment-only rollback, launcher-owned
  signal cleanup after resources exist with bounded daemon auto-removal
  convergence and an independent read-only survivor assertion, and a disposable shared-shaped
  production-mode execute followed by a fresh standalone rollback approval.
  It proves complete restore/tenant/custody cleanup without addressing the real
  shared project or shared bind paths.
- The browser contract covers the business-role/Admin/role-less navigation matrix, direct guards, removed-route 404s, invitation issuance and acceptance, fragment clearing, hash invalidation, replay behavior, password reset, and login with changed credentials.
- 'test:rst003' retains the reference-foundation schema/browser gate.

The runner rejects port 8080 and shared binds, creates unique Compose project
names and volumes, and removes containers, network, database volume, and
document volume after success or failure. RST-013A, RST-014A, and the combined
Phase 1 reset proof ignore `MJL_TEST_RETAIN`.

## Shared cutover invariants

Before and after a Phase 1 cutover:

- exactly one active native administrator at 'llx_user.rowid=1';
- zero other users, business roles, Partner scopes, Activities, invitations,
  reset credentials, and audit rows;
- obsolete audit/finance tables absent after finalization;
- Activity has no 'fk_convention';
- invitation/reset selector, hash, and live-user uniqueness columns exist;
- audit UPDATE and DELETE triggers exist;
- business-document checksums are unchanged; operational log drift is recorded
  explicitly in the execution report;
- no persistent fixture or E2E token exposure constant exists.

For PHP changes, run 'php -l' on every changed PHP file. For route changes,
also inspect container logs for fatal errors; an HTTP shell response alone is
not sufficient.
