# Phase 1 - Role, Scope, And Migration Foundation

## Goal

Introduce the production business role and Partenaires / Programmes scope model
without breaking existing POC data.

## Scope

- Add `llx_mjlfinancement_user_role`.
- Add `llx_mjlfinancement_user_soc_scope`.
- Add `custom/mjlfinancement/lib/mjl_scope.lib.php`.
- Add install SQL and `update_0.8.0.sql`.
- Bump the module version from `0.7.0` to `0.8.0`, but keep it below `1.0.0`.
- Backfill legacy POC users/groups into production roles and scopes where safe.

## Required decisions already fixed

- One global business role per user.
- A user may be assigned to one or many Partenaires / Programmes.
- Admin sees all scopes, but business validation still requires
  `VALIDATEUR_DEFINITIF`.
- Non-admin unresolved scope fails closed.

## Verification

- PHP syntax checks for changed PHP files.
- Schema audit script for the new tables, indexes, and backfill results.
- A focused smoke script proving Admin sees all, non-admin sees only assigned
  scopes, and unresolved non-admin users are not granted broad access.

## Implementation Record

Status: Implemented and runtime-verified as module version `0.8.0`.

Implemented artifacts:

- `llx_mjlfinancement_user_role`.
- `llx_mjlfinancement_user_soc_scope`.
- `custom/mjlfinancement/sql/update_0.8.0.sql`.
- `custom/mjlfinancement/lib/mjl_scope.lib.php`.
- `custom/mjlfinancement/scripts/audit_schema_0.8.0.php`.
- `custom/mjlfinancement/scripts/smoke_scope_model.php`.

Migration behavior:

- Existing Admin / `MJL POC - Administrateur` users map to
  `ADMIN_PLATEFORME`.
- `MJL POC - Agent` maps to `AGENT_SAISIE`.
- `MJL POC - Superviseur N1` and `MJL POC - Superviseur N2` map to
  `AGENT_VERIFICATEUR`.
- `MJL POC - DPAF` maps to `VALIDATEUR_DEFINITIF`.
- `MJL POC - Lecteur` is intentionally not mapped to an active production
  role and is reported by the audit as unresolved legacy read-only access.
- Scopes are backfilled from created activities, created expenses, validation
  history, workflow history, and guarded seeded POC exceptions.

Verification commands:

```bash
php -l custom/mjlfinancement/core/modules/modMjlFinancement.class.php
php -l custom/mjlfinancement/lib/mjl_scope.lib.php
php -l custom/mjlfinancement/scripts/audit_schema_0.8.0.php
php -l custom/mjlfinancement/scripts/smoke_scope_model.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.8.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_scope_model.php
```
