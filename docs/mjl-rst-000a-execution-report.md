# MJL RST-000A Clean Reset Execution Report

## Authorization and Scope

- Reset unit: `RST-000A`
- Unit approval: received on 2026-08-10
- Appendix bundle checksum approval: received on 2026-08-10
- Approved bundle checksum:
  `15ba42a2dba1e3e8c3f8171b93e1049ffcbee7ddea1fb12fb6f3cfe358ce593d`
- Execution window: 2026-08-10 15:12-15:18 Africa/Porto-Novo
- Git baseline: `c04a7a9`
- Target: local Docker Compose tenant only
- Migration performed: none
- Preserved account: native `llx_user.rowid=1`, entity `0`, login `admin`
- Conformance status: executed and supplementally ratified

The exact approved inventory remains below the ignored,
permission-restricted path:

```text
data/backups/rst000a-20260810T145929+0100/
```

RST-000 recovery artifacts were checksum-verified before execution.

## Executed Data Reset

The application was stopped before mutation. A single dependency-ordered
transaction deleted all `16,443` appendix database targets:

| Class | Deleted rows |
| --- | ---: |
| Fifteen MJL data tables | 15,996 |
| Native sample users | 15 |
| Native sample groups | 14 |
| Native group memberships | 15 |
| Native direct user rights | 156 |
| Native group rights | 206 |
| Native third parties and user links | 8 |
| Native Projects and tasks | 14 |
| Native ECM metadata | 19 |

The transaction retained the preserved administrator and its 103 native
direct-right rows. All other database tables retained their exact before
counts.

Six exact approved document directories were removed, covering all `606`
hash-matched MJL sample/test files. Dolibarr templates, installation files,
configuration, and unrelated document paths were untouched.

## Repository Reset

- Removed `seed_sample_data.php` and `mjl_sample_data.lib.php`.
- Removed both legacy CSV/placeholder trees and the external fixture package.
- Replaced `bootstrap_poc.php` with module activation that creates no users,
  roles, groups, Partners, Projects, business rows, documents, or sample data.
- Removed legacy data backfills from `sql/update_0.8.0.sql` while retaining its
  schema/index/constraint operations.
- Replaced the old fixture verifier with a persistent-data absence verifier.
- Removed the seed call from the disposable test runner.

## Fail-Closed Evidence

The first database attempt used entity-1 predicates for the custom tables.
Legacy entity-0 role backfills remained and their foreign key correctly blocked
sample-user deletion. The transaction did not reach `COMMIT`; connection
closure rolled it back. Verification proved all 414 table counts and all 606
document files were unchanged before retry.

The corrected transaction deleted every checksum-approved custom row,
including the inventoried legacy entity-0 backfills, while retaining exact
native row-ID predicates. Its private SQL SHA-256 is
`0243ea89c9d7d9dc75c1781b4e97bf5cc00fa467341eb3a1de0cfe2cd96f4502`.

The first post-reset bootstrap check exposed a legacy `update_0.8.0.sql`
backfill that recreated one Admin role row. That exact generated row was
removed, the legacy data-backfill statements were deleted, and bootstrap plus
absence verification then passed. This prevented a silent seed recreation
path from surviving the reset.

This corrective action exceeded the original checksum-approved inventory: the
transient row and supporting operational, verification, test, and evidence
files were not listed in the first appendix. Execution should have paused for
a new approval at that point. The deviation is recorded without restoring the
deleted sample data, because restoration would undo the requested clean state.
`docs/mjl-rst-000a-supplemental-appendix.md` checksum-scopes every added item.
The user explicitly ratified checksum
`5ecc8e68574358526817051cc4ce4d3322d144775b978e7154f633dfe913a870`
on 2026-08-10, restoring approval conformity without authorizing new mutation.

## Verification Results

| Verification | Result |
| --- | --- |
| Approved appendix component checksums | PASS |
| RST-000 recovery artifact checksums | PASS |
| Live database appendix comparison before mutation | PASS |
| Live document hash comparison before mutation | PASS |
| Live repository-file hash comparison before mutation | PASS |
| Failed-attempt rollback: all 414 table counts | PASS |
| Failed-attempt rollback: all 606 documents | PASS |
| All 16,443 appendix database rows absent | PASS |
| All 15 MJL persistent data tables empty | PASS |
| Native Partners, Projects, tasks, groups, and ECM rows empty | PASS |
| Only `llx_user.rowid=1` remains | PASS |
| All non-target table counts unchanged | PASS |
| All 606 approved document files absent | PASS |
| Non-seeding bootstrap followed by empty-state verification | PASS |
| Preserved Admin browser authentication | PASS |
| PHP syntax checks for changed operational scripts | PASS |
| `npm run test:unit` | PASS, 8/8 files |

The preserved Admin authenticated successfully and reached
`/custom/mjlfinancement/index.php`.

## Rollback Boundary

No rollback of the successful reset was necessary because every postcondition
passed. Full recovery remains available from the verified RST-000 database,
document, and configuration artifacts. Repository removals are recoverable
from Git baseline `c04a7a9`.

## Result

`RST-000A_EXECUTED`

The shared local tenant is persistently empty except for the single native
technical administrator. RST-001 remains separately approval-gated.
