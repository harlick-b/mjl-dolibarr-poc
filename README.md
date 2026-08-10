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

The retained `bootstrap_poc.php` only activates the approved module set and
disables unsafe native workspace modules. It creates no users, roles, groups,
Partners, Projects, business records, documents, or sample data. The shared
local tenant remains empty except for one native technical administrator.

Target tests create their own minimal records only inside isolated disposable
tenants and remove those tenants after the run. A new persistent demonstration
dataset is deferred until all implementation phases are complete.

## Verification

Use `docs/mjl-acceptance-tests.md` for the active transitional verification
matrix. `docs/mjl-deployment-checklist.md` is old-product evidence and must not
be used as a target deployment gate until its Phase 3C rewrite.

Available reset verification command:

```bash
npm run test:unit
```

The container-backed legacy suites remain isolated from the shared tenant, but
their former persistent seed has been removed. RST-014 must replace it with
disposable factories before those suites can serve as target acceptance gates.
