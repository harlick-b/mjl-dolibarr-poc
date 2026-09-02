# RST-002B Execution Report

## Result

`EXECUTED_AND_VERIFIED` on 2026-09-02 under DEC-050.

The user first requested commit of the DEC-049 simplification and then
explicitly requested the RST-002B fast cutover. The simplification was committed
as `99df34f`. The final idempotent completion ran from commit `608386f`.

## Execution

The first attempt stopped before PHP migration because the one-off Dolibarr
container lacked the installed `conf.php`. Dolibarr restarted, no DDL ran, and
the mode-0600 pre-cutover backup was retained. Commit `8035490` added a private
temporary config copy, a read-only one-off mount, and unconditional cleanup.

The second attempt applied the ordered RST-002B DDL and then stopped at the
final retained-schema digest. Read-only diagnosis proved:

- the database shape was the complete RST-002B target;
- the retained table-only digest was the sealed Phase-1 value;
- every new role trigger exactly matched its expected definition;
- Activities, assignments, roles, and other business targets remained empty.

Commit `608386f` sealed only that exact executed shared physical digest. The
full live target verifier then passed. The same fast command re-entered
idempotently and completed backup, apply classification, verification, restart,
and loopback health checking.

## Evidence

- First fail-closed attempt backup:
  `data/backups/rst002b-before-2026-09-02T12-17-30-812Z.sql`
  (`0600`, 838977 bytes; no DDL ran).
- Pre-DDL backup from the second attempt:
  `data/backups/rst002b-before-2026-09-02T12-21-35-025Z.sql`
  (`0600`, 838977 bytes; retained before the successful ordered DDL).
- Final idempotent completion backup:
  `data/backups/rst002b-before-2026-09-02T12-26-29-460Z.sql`
  (`0600`, 847256 bytes; target already present).
- Independent verifier:
  `MJL RST-002B Activity assignment schema: OK`.
- Services: Dolibarr and MariaDB both running; loopback HTTP passed.
- Tenant counts: one user, one native administrator at row 1, zero Activities,
  zero assignments, and zero business roles.
- Temporary config directories: none remain.
- Rollback was not run or authorized. RST-006A remains unapproved.
