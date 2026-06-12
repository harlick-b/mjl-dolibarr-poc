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
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/acceptance_sample_data.php
docker compose -p mjl-clean-install exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php
```

The expected result is:

```text
MJL 0.3.0 schema audit: OK
MJL sample data acceptance checks completed.
MJL expense validation smoke test completed.
```

For manual UI verification, open
`http://127.0.0.1:8080/custom/mjlfinancement/index.php` and log in with a
report-capable sample user such as `admin.poc` or
`responsable.projet`.

Clean up the disposable environment:

```bash
docker compose -p mjl-clean-install down -v
cd -
rm -rf "$tmpdir"
```
