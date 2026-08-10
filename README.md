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

Do not run the current `bootstrap_poc.php` or `seed_sample_data.php`. They
recreate obsolete persistent POC data. RST-000A removes the seed entrypoint and
replaces or strips the bootstrap to a documented non-seeding module
installation/activation path. The shared local tenant must remain empty after
that purge except for one native technical administrator.

Target tests create their own minimal records only inside isolated disposable
tenants and remove those tenants after the run. A new persistent demonstration
dataset is deferred until all implementation phases are complete.

## Verification

Use `docs/mjl-acceptance-tests.md` for the active transitional verification
matrix. `docs/mjl-deployment-checklist.md` is old-product evidence and must not
be used as a target deployment gate until its Phase 3C rewrite.

Primary complete regression command:

```bash
npm test
```

Focused commands are `npm run test:unit`, `npm run test:verify`, `npm run
test:e2e`, `npm run test:characterization`, and `npm run
test:manual-accessibility`. Container-backed commands always create and remove
an isolated named-volume tenant; they never target the shared port 8080 data.
