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
    npm run test:rst002b
    npm run test:rst006a
    npm run test:phase2
    npm run test:phase1-reset

- 'test:unit' runs static Node contracts and PHP presentation/navigation contracts.
- 'test:verify' provisions an isolated tenant and runs the current RST-002B
  exact-schema and empty-tenant verifier.
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
- 'test:rst002b' installs the current RST-002B target in one isolated tenant,
  rolls it back to the sealed RST-005 schema, returns forward, and proves
  forward and reverse known-prefix resumption,
  current-assignment reads, immediate revocation, add/remove/primary-transfer,
  optimistic locking, transactional audit rollback, concurrency, reciprocal
  role/user guards, entity isolation, direct SQL denial, shared-state equality,
  and whole-tenant destruction.
- 'test:rst006a' provisions the complete RST-006A target in an isolated tenant
  and exercises the aggregate command, guarded Activity route, canonical
  reference allocation, automatic primary assignment, balance, immutable
  revisions, signed-BIGINT and arithmetic-overflow boundaries, inactive
  reference retention/new-use refusal, start-date freeze, identity separation,
  return/resubmission, terminal validation, audit rollback, literal search, fixed 50-row pagination with distinct
  0/1/50/51/101-result cohorts, typed filters,
  JavaScript-disabled use, CSRF/context replay, request size, role/entity
  isolation, and HTML escaping. Its fixed named inventory includes real
  concurrent command races plus MariaDB deadlock and lock-timeout rollback.
  Before browser execution it proves every one of the 43 forward and 43
  rollback DDL interruption points, exact forward-prefix convergence, and
  malformed engine/collation, column, index, foreign-key, CHECK, unexpected
  object, and trigger refusal. The same command also runs an isolated
  shared-shaped fast-wrapper rehearsal covering success, exclusive locking,
  source drift, malformed journals, missing/corrupt backups, four interruption
  and exact-resume stages, and unknown-state containment. It does not cut over
  the shared tenant.
- `test:phase2` aggregates the existing RST-006A planning/workflow suite with
  Planification navigation, paginated read-only scoped Opérations, sanitized
  Activity chronology, command-backed fixtures, shared-state preservation, and
  whole-tenant teardown.
- The Phase 2 manual accessibility gate covers fourteen archetypes, including
  Activity list/create/detail/edit/review and Opérations, at five widths and real 100%/200%
  browser zoom: exactly 140 combinations. Planning states also require forced
  colors and reduced motion evidence. Passing requires named human review,
  keyboard, screen-reader and French findings, and a private checksummed JSON
  artifact. No automated run substitutes for that signature.
- `npm run cutover:rst002b-fast -- --confirm=RST-002B-FAST` is the intentionally
  small local operational command. It is not an automated test and must not be
  invoked unless the user explicitly requests execution.
- 'test:characterization' is a compatibility alias to `test:phase2`.
- The default browser contract covers retained reference/auth/document/fixture
  behavior, the current RST-002B role/assignment matrix, RST-006A planning and
  workflow, and Phase 2 Planification/Opérations/chronology. Phase 1 predecessor
  suites remain explicit historical commands rather than default target discovery.
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
