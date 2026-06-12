## MJL Dolibarr POC

Start Dolibarr:

```bash
docker compose up -d
```

Open `http://127.0.0.1:8080/`.

Bootstrap the MJL POC configuration:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php
```

The bootstrap is idempotent. It activates the required Dolibarr modules, enables the
custom `mjlfinancement` module, creates the MJL POC groups and users, resets only
those POC group rights, reapplies permissions, and generates an API key for
`admin_poc`.

Default local POC user password: `MjlPoc2026!!`

Override it with:

```bash
MJL_POC_DEFAULT_PASSWORD='change-me' docker compose up -d
```
