# RST-000A Supplemental Appendix

Approval state: `APPROVED` on 2026-08-10 for bundle checksum
`5ecc8e68574358526817051cc4ce4d3322d144775b978e7154f633dfe913a870`.

## Purpose

The physical reset reached the approved empty-state outcome, but its first
post-reset bootstrap recreated one legacy role row. Removing that row and its
recreation path, then documenting and verifying the result, affected items
outside the original appendix. Execution should have paused for approval when
that drift appeared.

This appendix records the deviation and its explicit retroactive ratification.
It does not authorize RST-001 or any further destructive action. The empty
tenant remains in place as the approved RST-000A outcome.

## Supplemental Scope

The private supplemental bundle contains:

- one exact transient database row: `llx_mjlfinancement_user_role.rowid=14366`,
  recreated by historical module activation and then deleted;
- every changed repository path outside the original 48-file appendix,
  including operational source, verification/test changes, authority/current
  documentation, and execution evidence;
- the Git-baseline and current SHA-256 for each existing changed path, with
  added/deleted status represented explicitly;
- component checksums and one bundle checksum.

The original appendix already scoped the replacement of
`custom/mjlfinancement/scripts/bootstrap_poc.php`; it is not counted again.
This supplemental appendix and the private checksum manifests are approval
metadata, not execution targets, and are excluded from their own inventory to
avoid a recursive checksum. Every other changed repository path is included.

## Approval Boundary

Approval of the supplemental bundle means:

- ratify deletion of the one transient generated role row;
- ratify the exact additional source, test, and documentation snapshot;
- allow RST-000A to be marked conformant and committed;
- authorize no new row deletion, file deletion, migration, or RST unit.

Any content change to a checksum-bound implementation path before approval
invalidates the bundle and requires regeneration. After approval, status-only
updates that record the approval and replace the pending marker are
non-destructive execution metadata; implementation changes are not permitted
without a new checksum.

## Bundle Location and Checksum

The exact inventory is private, ignored by Git, and permission-restricted at:

```text
data/backups/rst000a-20260810T145929+0100/supplemental/
```

Bundle checksum:
`5ecc8e68574358526817051cc4ce4d3322d144775b978e7154f633dfe913a870`

Approval wording received:

```text
I approve RST-000A supplemental appendix checksum <checksum>.
```

That exact approval was received on 2026-08-10. The resulting state is
`RST-000A_EXECUTED`; RST-001 remains separately approval-gated.
