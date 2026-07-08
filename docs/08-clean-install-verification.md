# Clean Install Verification

Use this flow to validate module activation and CSV sample data from an empty
Dolibarr database without touching the repository's persistent `data/` folder.

From the repository root:

```bash
tmpdir="$(mktemp -d)"
rsync -a --exclude .git --exclude data ./ "$tmpdir/"
cd "$tmpdir"
docker compose -p mjl-clean-install up -d
```

Wait for Dolibarr to finish first-run installation, then run:

```bash
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.3.0.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.4.0.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.5.0.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.8.0.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.9.0.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.10.0.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/acceptance_sample_data.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_scope_model.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_activity_workflow.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_traceability_exports.php
```

The expected result is:

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
```

For manual UI verification, open
`http://127.0.0.1:8080/custom/mjlfinancement/index.php` and log in with a
report-capable sample user such as `admin.poc` or `dpaf.mjl`.

Clean up the disposable environment:

```bash
docker compose -p mjl-clean-install down -v
cd -
rm -rf "$tmpdir"
```
