# RST-003 Execution Report

## Verdict

RST-003 was approved and executed on 2026-08-13. The shared tenant now has the
empty Partenaire, Projet, and Type d’Opération reference foundation. No
business/reference fixture or transitional RST-003 audit row remains.

This execution does not authorize RST-004 or any later reset unit.

## Approval and baseline

- User approval: 2026-08-13.
- Git/code baseline: `b2acbc0`.
- Dependencies RST-000A and RST-001 were already executed.
- Shared baseline before schema activation: native Admins `1`, business users
  `0`, active business roles `0`, Partenaires `0`, Projets `0`, RST-003 audit
  rows `0`; the Type d’Opération table did not yet exist.
- RST-000 recovery evidence remains in `docs/mjl-phase-1-reset-report.md`.

## Implemented foundation

- `partners.php`, `projects.php`, and `operationtypes.php` provide French-first
  list/detail and guarded create/edit/activate/deactivate states.
- Business roles read active references. Only the Validateur définitif can see
  inactive references or mutate them. Admin, anonymous, no-role, and
  cross-entity access fail closed.
- Partenaires and Projets use native Dolibarr objects. Project technical refs
  are `MJL-PROJET-` plus 128 random bits; ref and original Partenaire are never
  editable.
- Types d’Opération use an empty entity-scoped table with actor/timestamp
  columns, active indexes, user foreign keys, and unique `(entity, label)`.
- Mutations are POST-only with CSRF, one-use submission tokens, locked-record
  fingerprints, active-role revalidation, and parent-before-project locks.
- Partenaire deactivation locks and closes active Projets before deactivating
  the parent. Reactivation never reopens children. There is no hard-delete
  interface.
- The legacy workflow audit helper is used only as transitional transactional
  evidence; durable target audit remains owned by RST-007A.

## Verification evidence

Observed results:

```text
php -l <all changed PHP files>
PASS: no syntax errors

npm run test:unit
PASS: 10/10 Node suites and all PHP contracts

npm run test:rst003
PASS: exact schema verifier, schema rollback/restore rehearsal, and 9/9
Playwright cases; runner duration 198.9 seconds

docker compose exec -T dolibarr php .../bootstrap_poc.php
PASS: module activation completed without creating business/sample data

docker compose exec -T dolibarr php .../audit_schema_current.php reference_foundation.php
PASS: MJL RST-003 reference foundation schema: OK
```

The final focused tenant was
`mjl-test-20260814t120638-84771-1fbee1d5` on loopback port `44113`. The
focused browser gate proved native creation, exact status mappings,
multiple Projects per Partenaire, immutable identifiers and ownership,
creation-first/cascade-close and deactivation-first/create-denial ordering,
no child reopen, stale edit/lifecycle rejection, duplicate-label rejection,
one-use token replay denial, active-only reader visibility, Validator-only
mutation, Admin/entity/CSRF/delete/native-route denial, safe escaping, and
390-pixel containment. Each disposable run removed its containers, network,
database volume, and document volume. Failed development runs also cleaned up.

Before browser fixtures, the runner renamed the empty Type d’Opération table
out of the target schema, verified its absence, restored it, and reran the
exact schema verifier successfully. This was the schema rollback/restore
rehearsal. The failed stale-write and parent-deactivation race paths separately
proved transactional rollback, and disposable teardown was verified.

## Shared tenant end state

After idempotent activation and the allowlisted schema check:

| Measure | Count |
| --- | ---: |
| Native Admins | 1 |
| Business users | 0 |
| Active business roles | 0 |
| Partenaires | 0 |
| Projets | 0 |
| Types d’Opération | 0 |
| RST-003 transitional audit rows | 0 |

No persistent fixture or surviving disposable resource was observed.
