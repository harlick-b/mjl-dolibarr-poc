# RST-002A Execution Report

## Verdict

RST-002A was approved and executed on 2026-08-12. Partner scope is no longer
an authorization input. The retained table and its three DDL files are
unchanged and globally empty. No shared-tenant row or document was migrated,
created, updated, or deleted.

This execution does not authorize RST-002B, RST-003, RST-004, RST-007A,
RST-008, RST-009A, RST-010A, RST-013A, RST-014A, or any later unit.

## Approval and baseline

- Approval date: 2026-08-12.
- Code baseline: `f031cde743d3ab0d9cf1d65eaf45914a0d07947e`.
- Initial tracked binary-diff checksum:
  `b401b8ce4f0aa74d3ef11c20d631eff58218bdde92c6df5afadc049a64c40c65`.
- Adopted untracked browser-case checksum before hardening:
  `b48643733b206cd460dd8afbedf6eecd02c8e8d9ddea48177cb8a592125f1aec`.
- Archived HEAD rollback artifact:
  `/tmp/mjl-rst002a-rollback-b2zyBv/baseline.tar`, checksum
  `d3d1a31a936112fa3de995f6b732240d110fe77bb6380711cf4976d1103359d8`.
- RST-000 recovery evidence remains `docs/mjl-phase-1-reset-report.md`.
- Supplemental paths explicitly authorized by the user:
  `custom/mjlfinancement/index.php`,
  `tests/e2e/cases/rst002a-authorization.cases.js`, and the structural test
  needed to prove their RST-002A contract.

Shared tenant before and after: users `1`, native Admins `1`, Partners `0`,
Projects `0`, Partner-scope rows `0`, active role rows `0`.

## Implemented containment

- Access-profile assignment is role-only. Legacy `scope_soc_ids[]` input is
  ignored, no Partner row is written/deactivated, and audit context contains
  role/source only.
- Production runtime has no read/write dependency on
  `llx_mjlfinancement_user_soc_scope`; retained references are limited to
  install/schema/emptiness diagnostics. Disposable tests alone insert poison
  rows and remove them.
- Agent and Admin Activity access is denied. Supervisor and Validator can read
  only parent-consistent same-entity Activity identity, status, safe Project,
  dates, risk, and review-next-action fields.
- Every Activity mutation is denied at HTTP and domain persistence seams,
  including create/update/delete, execution, submission/correction/review,
  direct `notrigger`, contextual comment/exchange, and ECM upload.
- Activity document list and direct-download resolvers return no row for every
  role, so denial occurs before file resolution, download audit, or delivery.
- Rich Partner/Project, finance, document, report, alert, dashboard, and legacy
  Partner-dependent loaders remain contained without implementing their later
  owning reset units.
- Admin receives a query-free technical landing and the four approved
  administration/diagnostic destinations. Traceability rows use complete
  target/parent entity predicates; absent targets remain Admin diagnostics,
  while cross-entity/corrupt targets are excluded.

## Schema integrity

The following files remained byte-for-byte unchanged:

- `llx_mjlfinancement_user_soc_scope.sql`:
  `0c98f580cdd40f033f2a8a21f4f07f5dbb45d1c542be628c399ee282209cf98d`
- `llx_mjlfinancement_user_soc_scope.key.sql`:
  `2f063f734542a5daecef98d04f8019edb26bfe36427404ee40b2ee9d1a91d6b8`
- `update_0.8.0.sql`:
  `5dbd4f77db23a27ab449faf3808df94e28b1a05e06e0383aac88f9d7fff822eb`

No migration ran. The schema verifier confirmed the exact retained columns and
indexes and required a global row count of zero.

## Verification evidence

Commands and observed results:

```text
npm run test:unit
PASS: 9/9 Node suites plus PHP contracts

php -l <each changed PHP file>
PASS: no syntax errors

docker compose exec -T dolibarr php .../audit_schema_current.php role_scope_schema.php
PASS: MJL role and retained empty scope schema audit: OK

docker compose exec -T dolibarr php .../verify_scope_integrity.php access_model.php
PASS: MJL RST-002A role-only access model verification: OK

docker compose exec -T dolibarr php .../verify_scope_integrity.php traceability_targets.php
PASS: MJL traceability target and metadata containment: OK

docker compose exec -T dolibarr php .../verify_scope_integrity.php unresolved_scope.php
PASS: MJL unresolved scope audit: OK

npx playwright test tests/e2e/scope-security.spec.js --config=playwright.config.js
PASS: 6/6 in project mjl-test-rst002a-20260812 on 127.0.0.1:18082;
final spoof-regression rerun 6/6 in project mjl-test-rst002a-final on
127.0.0.1:18084

git diff --check
PASS
```

The focused suite first captured exact role/surface results with zero scope
rows, injected active/inactive same-entity and cross-entity poison rows for all
three business roles, repeated the capture, and observed identical results.
It also proved hostile access-profile payloads write no scope data, all direct
Activity POST/class/side-effect mutations leave DB/file/audit snapshots
unchanged, and cross-entity/corrupt-parent Activities remain hidden.
The traceability verifier transaction additionally seeded valid, absent,
cross-entity, and corrupt-parent targets for all seven supported target types,
then proved exact workflow/exchange row visibility and distinct-filter metadata
with the production predicate before rollback.
A final rollback-only direct class check created a cross-entity persisted
Activity exchange, spoofed its in-memory type, and proved update/delete both
returned `-1` while the stored subject remained unchanged.
Direct container and structural tests also proved both Activity document
resolver entry points return an empty result before any delivery/audit seam.

The disposable execution tenant ended with native users `1`, Partners `0`,
Projects `0`, roles `0`, scope rows `0`, Activities `0`, access audits `0`, and
invitations `0`. `docker compose down -v --remove-orphans` removed both named
volumes, its network, and both containers; label-based survivor queries were
empty.

`npm run test:verify`, the complete legacy `npm run test:e2e`, and the legacy
runtime characterization suite were not acceptance gates: RST-013A/RST-014A
own their fixture/runner reset. They were not revived or reported as target
coverage.

## Rollback rehearsal

Rollback never restored obsolete guards in the shared tenant. A `git archive`
of the baseline commit was extracted under `/tmp`, mounted read-only into the
separate project `mjl-test-rst002a-rollback` on `127.0.0.1:18083`, bootstrapped,
and confirmed users `1`, Partners `0`, Projects `0`, scope rows `0`. The tenant
was then destroyed with volumes and a zero-survivor label check.

## Residual boundaries

The empty retained table is dropped only by RST-002B. The temporary compatibility
containment seams in legacy routes are removed by their owning RST-003/RST-004/
RST-010A resets. RST-003 is the recommended next independent approval unit.
