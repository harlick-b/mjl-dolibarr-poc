# RST-005 Pre-Execution Validation Report

## Status

`DISPOSABLE_IMPLEMENTATION_VALIDATED; SHARED_EXECUTION_ENABLEMENT_NOT_IMPLEMENTED`

RST-005 has not been executed against the shared tenant. The original approval
does not authorize the guarded-lock cutover amendment discovered during
implementation. Shared execution requires a separate explicit approval of that
amendment after the final Standards and Spec reviews are clean.

The operational script additionally enforces that stop: `apply`, `finalize`,
and `rollback` run only inside an attested RST-014A disposable tenant. A later
root/operator-owned shared launcher must be separately implemented and
reviewed after amendment approval; it must bind the exact approved commit and
clean complete source tree, stopped traffic, protected manifest, root-owned
backup directory/files, held-file-descriptor hashing, and separate key escrow.
No caller-supplied manifest or environment flag can currently enable shared
mutation.

The shared tenant remains on the Phase 1 Activity containment schema. This file
is pre-execution evidence and must not be cited as an `EXECUTED` verdict.

## Amendment requiring approval

MariaDB 11 rejects `RENAME TABLE` while the session holds explicit table locks.
The revised cutover therefore installs one exact temporary `BEFORE INSERT`
denial trigger on the empty Phase 1 Activity table, obtains and releases the
sealed table-lock set only after repeating every premise, and immediately runs
the atomic rename while that guard still excludes direct writers. The guard
moves with the quarantine table and is removed by exact name. Crash recovery
accepts only the verified guarded forms documented in the strategy.

The implementation also seals both complete retained-schema forms caused by a
historical nonsemantic column-order difference: Phase 1 appended the generated
`user_role.active_user_id` column, whereas clean installation creates it beside
`is_active`. No third digest and no retained-table repair are accepted.

## Final disposable implementation evidence

The exact final runtime/test tree passed these gates on 2026-08-24:

- `npm run test:rst005` — passed in 428.6 seconds. Encrypted schema/full
  backups restored with exact dump and restorable-logical equality; randomized
  restore databases and the alternate-prefix scratch database left neither
  schemas nor `mysql.db` grants; non-disposable restore and mutation callers
  were rejected; all failpoints, restart recovery, activation, finalization,
  retry, and containment-only rollback paths converged; exact schema and audit
  verification passed; 4/4 Playwright tests passed; whole-tenant teardown
  removed all containers, volumes, and network.
- `npm run test:verify` — passed in 156.7 seconds and removed its isolated
  tenant after the exact Phase 1 empty-schema verifier passed.
- `npm run test:unit` — passed 88/88 Node tests plus maintained PHP contract
  checks.
- PHP lint — every changed and new PHP file passed `php -l`.
- `git diff --check` — passed.
- Independent Standards review — `CLEAN`.
- Independent Spec review — `CLEAN`.
- Independent Security/Isolation review — `CLEAN` for the current
  disposable-only/pre-execution tree.

The full-feature validation result is `PASS` for disposable implementation and
`NOT_IMPLEMENTED` for shared execution enablement. No shared preflight, backup,
DDL, finalization, rollback, or state mutation occurred.

## Superseded diagnostic evidence

Earlier implementation checkpoints on 2026-08-24 passed the following gates,
but are superseded by later source hardening and are not the final evidence
boundary:

- `npm run test:verify` — passed in 111.3 seconds; clean installation and exact
  Phase 1 verification converged, followed by whole-tenant teardown.
- `npm run test:rst005` — passed in 387.5 seconds; encrypted streaming schema
  and full backups restored with matching plaintext digests in fresh processes;
  all target-object, guarded-cutover, activation, verification, finalization,
  retry, and rollback failpoints converged; complete database/filesystem/native
  ECM evidence matched after reversible rollbacks; 3/3 Playwright tests passed;
  whole-tenant teardown passed.
- `npm run test:unit` — passed 88/88 Node tests plus the maintained PHP contract
  checks.
- PHP lint — every changed and new PHP file passed `php -l`.
- `git diff --check` — passed.

One earlier disposable run stopped before migration DDL because its source-hash
walker misclassified the deliberately excluded orchestrator as a non-file. The
runner branch was corrected, `/tmp` backup/key absence was verified, and the
complete suite then passed. Another clean-install diagnostic tenant exposed the
sealed `active_user_id` ordinal difference; it and all isolated volumes were
explicitly destroyed after inspection.

Later diagnostic runs found and corrected MariaDB-generated trigger timestamp
drift, restore-schema identity drift, missing metadata visibility under
SELECT-only grants, unsupported `REVOKE IF EXISTS` syntax, and a residual
alternate-prefix database grant. Each failed disposable tenant was removed.
Only the final evidence above is the current validation boundary.

## Shared evidence and completion fields

The following remain intentionally blank until separately approved shared
execution:

- committed implementation SHA;
- shared before/after complete database, protected projection, Activity schema,
  document-tree, native ECM, Admin, audit, module, and Compose digests;
- shared encrypted backup location identity and restore attestation;
- maintenance start/end boundary;
- final independent reviews of the later committed shared launcher and
  approval-bound execution tree;
- RST-005 `EXECUTED` verdict.

No downstream Phase 2 unit is authorized by this implementation or report.
