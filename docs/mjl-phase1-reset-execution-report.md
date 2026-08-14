# Phase 1 Reset Execution Report

## Scope and authorization

The user explicitly authorized RST-007A, RST-004, RST-008, and RST-009A.
The combined cutover ran on 2026-08-14 against source baseline
`dc6f0becbd45c7676cccec2ac42b9374b8e61101`. No later reset unit, commit,
push, production email, or persistent fixture was authorized or performed.

The pre-cutover recovery bundle is the ignored directory
`data/backups/rst-phase1-20260814-pre`:

- source archive: `f7902ebe34d69c10356d00a2016b0fcd5e7dcb3fee13fa91c628fedb017887fa`;
- database dump: `ec7804be385ecb0d17b8446dc7e5cc2a9c93dcd894f65ecfd6cca298b81285ef`;
- document-checksum manifest: `61d5af34cc0966b1062fb6d6f6d509a9f8df0c46c8e9ddaa1c8383397e79dcf6`.

Exact preflight counts were zero for all other users, roles, Partner scopes,
Activities, legacy finance/audit/auth tables, and retained business objects.
The preserved account was exactly native `admin`, row ID 1, entity 0.

## Cutover result

Application traffic was stopped. The guarded executor ran `preflight` and
`apply` with the exact four-unit confirmation. The final module was activated
twice, schema and HTTP gates ran with quarantines retained, every quarantine
was observed empty, and `finalize` removed it. Final recovery is therefore the
checksummed source/database bundle, not quarantine rename.

The implemented result is:

- one append-only entity-filtered audit store and transactional writer;
- no obsolete Convention, budget, receipt, Expense, validation, exchange,
  report, legacy workflow-audit, or access-audit runtime/storage;
- selector/verifier invitation and reset credentials with hash-only storage,
  state constraints, locks, revocation, expiry, role/deactivation invalidation,
  audit coupling, and disposable-only raw-link exposure;
- the approved role-projected navigation and a narrowly exposed native
  `/admin/modules.php` destination; other native Admin routes remain denied.

## Verification evidence

Observed passing commands after the final hardening loop:

```text
npm run test:unit
PASS: 8 Node suites and all PHP contracts

php -l <every changed or added PHP file>
PASS: no syntax errors

npm run test:phase1-reset
PASS: four repeated schema/behavior gates, five Playwright gates, disposable
teardown; final project `mjl-test-20260814t141823-384708-99be54e1`, 146.3s

npm run test:rst008
PASS: expanded invitation/reset lifecycle gate, 159.6s

npm run test:rst009a
PASS: role matrix and native technical-destination content, 155.7s

npm run test:rst003
PASS: nine retained reference-foundation browser scenarios after correcting an
explicit page-header dependency, 174.2s

npm run test:e2e
PASS: all 14 retained RST-003 and Phase 1 browser scenarios; disposable
teardown; final project `mjl-test-20260814t143509-434319-70cdcd37`, 191.0s

docker compose exec -T dolibarr php .../bootstrap_poc.php
PASS twice after final auth-state hardening

docker compose exec -T dolibarr php .../verify_phase1_reset.php
PASS on the shared tenant

docker compose exec -T dolibarr php .../verify_phase1_behavior.php
PASS; audit mutation rejected and verifier transaction rolled back
```

The browser evidence covers audit immutability/entity filtering; Agent,
Supervisor, Validator, Admin, and role-less navigation/direct guards; the
technical Admin destination; obsolete-route 404; selector/fragment clearing;
bad-verifier rejection; role-change revocation; acceptance and replay;
reset consumption and replay; expiry; deactivation revocation; and immediate
denial of an already-authenticated session. Failed disposable runs also
removed their containers, networks, and volumes.

The signed manual accessibility gate was not run because it requires a named
human reviewer and assistive technology. Its stale finance-era archetypes were
retargeted to the Phase 1 surfaces. Production email was not tested or sent;
auth delivery used the immutable disposable-tenant marker plus the explicit
test constant.

## Document-checksum exception

The literal all-document checksum invariant did not hold. Seven retained
business/template/cache/lock files matched their pre-cutover checksums, but
`data/documents/initdb.log` changed when the one-off Dolibarr activation and
restart rewrote the installer log. Its pre-cutover SHA-256 was
`8f999bca21f305125a240b319dc02bb08228d45e073f14229a91d82e69d77e68`.
Its final observed SHA-256 is
`6e66f68985cb1eba6fd8fcd3c3a030b84ef77b7f4967b125db78eeab472aaf21`.
No pre-cutover file
content backup exists for that operational log, so an exact restoration was
not attempted. No business document was added, removed, or changed.

This exception prevents a truthful claim that every byte under the document
volume stayed unchanged; it does not affect business records or documents.

## Result

`RST-007A`, `RST-004`, `RST-008`, and `RST-009A` are implemented and verified
but remain `PENDING_EXCEPTION_RATIFICATION` until the user explicitly accepts
the operational-log checksum deviation above.
