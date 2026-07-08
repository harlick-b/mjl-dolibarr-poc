## MJL Dolibarr Workspace

This repository contains a Dockerized Dolibarr 23.0.2 installation with the
custom MJL workspace module under `custom/mjlfinancement`.

## MJL Documentation Authority

For MJL work, read `docs/mjl-authoritative-decisions.md` first.

Do not follow older POC docs, executed plans, historical prompts, or stale
N1/N2/DPAF instructions.

Use `docs/mjl-current-app-functional-map.md` only as current-state evidence.

If code conflicts with authoritative decisions, treat the code as
implementation debt and record it in `docs/mjl-current-vs-target-gap-analysis.md`.

If a doc conflicts with authoritative decisions, update, merge, or delete the
stale doc.

## Local Runtime

Start Dolibarr:

```bash
docker compose up -d
```

Open:

```text
http://127.0.0.1:8080/
```

Bootstrap the local development/test configuration:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php
```

The bootstrap is idempotent. It activates required Dolibarr modules, enables
the custom `mjlfinancement` module, creates local fixture groups and users,
reapplies permissions, and generates an API key for `admin_poc`.

Default local fixture password:

```text
MjlPoc2026!!
```

Optional local password override:

```bash
MJL_POC_DEFAULT_PASSWORD='change-me' docker compose up -d
```

## Verification

Use `docs/mjl-acceptance-tests.md` for the active verification matrix and
`docs/mjl-deployment-checklist.md` for deployment and clean-install checks.

Primary UI regression command:

```bash
npm run test:e2e
```
