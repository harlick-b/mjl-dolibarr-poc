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
    npm run test:phase1-reset

- 'test:unit' runs static Node contracts and PHP presentation/navigation contracts.
- 'test:verify' provisions an isolated tenant and runs the Phase 1 schema and empty-tenant verifier.
- 'test:phase1-reset' runs the focused Phase 1 schema gates and browser
  contracts, including RST-010A, in one isolated tenant.
- 'test:rst010a' creates disposable same-entity, cross-entity, orphan, and
  public-share canaries, exercises anonymous/authenticated GET and POST plus
  traversal, encoded-path, and native delivery probes, and requires exact
  before/after filesystem and all-column ECM manifests.
- The browser contract covers the business-role/Admin/role-less navigation matrix, direct guards, removed-route 404s, invitation issuance and acceptance, fragment clearing, hash invalidation, replay behavior, password reset, and login with changed credentials.
- 'test:rst003' retains the reference-foundation schema/browser gate.

The runner rejects port 8080 and shared binds, creates unique Compose project
names and volumes, and removes containers, network, database volume, and
document volume after success or failure.

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
