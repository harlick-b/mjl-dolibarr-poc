# MJL Acceptance Tests

Target decisions come from `docs/mjl-authoritative-decisions.md`. Match
verification to the changed surface and report skipped checks.

## Primary E2E Check

Run browser regression checks against the local Dolibarr instance:

```bash
npm run test:e2e
```

The Playwright suite uses `MJL_BASE_URL` when set, otherwise
`http://127.0.0.1:8080`.

## Schema And Smoke Checks

Run relevant checks after schema, workflow, document, export, or sample-data
changes:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.3.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.4.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.5.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.8.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.9.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.10.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/acceptance_sample_data.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_scope_model.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_activity_workflow.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_traceability_exports.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_unresolved_scope.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/check_production_readiness.php
```

## Clean Install Verification

Use this flow to validate module activation and sample fixtures from an empty
Dolibarr database without touching the repository's persistent `data/` folder:

```bash
tmpdir="$(mktemp -d)"
rsync -a --exclude .git --exclude data ./ "$tmpdir/"
cd "$tmpdir"
docker compose -p mjl-clean-install up -d
```

Then run the schema and smoke checks with `docker compose -p
mjl-clean-install exec -T dolibarr ...`.

Expected audit/smoke results:

```text
MJL 0.3.0 schema audit: OK
MJL 0.4.0 workflow foundation audit: OK
MJL 0.5.0 activity status audit: OK
MJL 0.8.0 role/scope schema audit: OK
MJL 0.9.0 activity workflow schema audit: OK
MJL 0.10.0 expense disbursement schema audit: OK
MJL sample data acceptance checks completed.
MJL 0.8.0 scope model smoke: OK
MJL expense validation smoke test completed.
MJL activity workflow smoke test completed.
MJL traceability/export smoke test completed.
MJL unresolved scope audit: OK
```

`check_production_readiness.php` also reports deployment items that cannot be
proven from source as `UNKNOWN`, including production email transport, public
base URL, secrets, backup/restore, and monitoring/log retention.

Clean up:

```bash
docker compose -p mjl-clean-install down -v
cd -
rm -rf "$tmpdir"
```

## Acceptance Scenarios

- Admin can invite users; no public registration is exposed.
- Admin can assign one production role and one or many Partenaires /
  Programmes.
- Non-admin users see only assigned Partenaires / Programmes.
- Unresolved object scope fails closed for non-admin users.
- Agent de saisie can create, submit, correct, and attach documents only within
  assigned scope.
- Agent verificateur can prevalidate or request correction without
  self-prevalidation.
- Validateur definitif can final-validate and disburse without self-final
  validation or self-disbursement.
- Global Documents is read-only; uploads are contextual; downloads are guarded.
- Exchanges are contextual or audit/supervision-only, not primary navigation.
- CSV exports include UTF-8 BOM, semicolon separator, French headers, stable
  filenames, and server-side filtering.
