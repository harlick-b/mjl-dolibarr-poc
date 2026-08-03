# MJL Acceptance Tests

Target decisions come from `docs/mjl-authoritative-decisions.md`. The maintained case audit and destination map are in `docs/mjl-test-coverage-registry.md`.

## Public commands

```bash
npm test
npm run test:unit
npm run test:verify
npm run test:e2e
npm run test:characterization
npm run test:manual-accessibility
```

- `npm test` provisions one disposable tenant, runs unit contracts, current container verification, and blocking Chromium capability suites, then removes the tenant.
- `npm run test:unit` runs fast Node and PHP contracts without Docker.
- `npm run test:verify` runs the current schema, sample-data, scope/integrity, activity, expense, traceability/export, and dashboard-resilience checks in one disposable tenant.
- `npm run test:e2e` runs the eleven blocking capability suites in one disposable tenant.
- `npm run test:characterization` runs current finance security/data-integrity behavior that still lacks product authority. It is intentionally excluded from `npm test`, but exits nonzero on drift.
- `npm run test:manual-accessibility` opens the real application in headed Chromium for keyboard, focus, reflow, and actual 100%/200% browser-zoom review.

## Disposable tenant contract

The runner generates a unique Compose project and free non-8080 loopback port. MariaDB and documents use project-scoped named volumes. Repository `custom/`, container test contracts, and the Apache native guard are mounted read-only. Both services use `restart: no`.

Before startup, the resolved Compose configuration rejects:

- port 8080 or a mismatched base URL;
- non-unique or mismatched project names;
- repository data binds, writable application mounts, or unexpected bind sources;
- external/shared volumes or networks;
- fixed container names or persistent restart policies;
- extra services, unapproved host binds, privileged mode, host namespaces,
  host networking, devices, or non-Dolibarr published ports.

Bootstrap and sample seeding run once per complete tenant. Normal completion, failure, and interruption run `docker compose down -v --remove-orphans` and verify no labeled containers, networks, or volumes remain.

Set `MJL_TEST_RETAIN=1` to retain a failed tenant. The runner prints its exact project, URL, storage names, and cleanup command. Playwright output and sanitized Compose diagnostics remain under `test-results/runs/<project>/` independently of tenant teardown.

## Current container verification

The current-purpose entrypoints are:

```text
custom/mjlfinancement/scripts/audit_schema_current.php
custom/mjlfinancement/scripts/verify_sample_data.php
custom/mjlfinancement/scripts/verify_scope_integrity.php
custom/mjlfinancement/scripts/verify_activity_workflow.php
custom/mjlfinancement/scripts/verify_expense_workflow.php
custom/mjlfinancement/scripts/verify_traceability_exports.php
```

`npm run test:verify` is the supported complete invocation. The schema and
scope entrypoints accept only runner-supplied allowlisted module names so each
legacy check executes in a separate PHP process without exposing historical
versioned commands.

`check_production_readiness.php` remains an operational diagnostic, not a test gate. It may report deployment-dependent `UNKNOWN` values for production email, public URL, secrets, backup/restore, monitoring, and retention.

## Blocking capability coverage

- `access-shell.spec.js`: guarded native boundary, role-projected shell, current location, focus, responsive drawer, reduced motion, and auth helpers.
- `auth-invitations.spec.js`: invitation lifecycle, neutral reset response, replay/revocation, unsafe targets, and CSRF.
- `partners-projects.spec.js`: assigned scope, project create/edit permissions, cross-scope denial, and semantic row actions.
- `activities.spec.js`: creation, scoped references, execution, correction, staged decisions, audit, and no-self behavior.
- `expenses.spec.js`: documents, submit/correct/reject, prevalidation, final validation, disbursement, exact-one replay, concurrency, and no-self behavior.
- `finance.spec.js`: authority-backed active-entity and assigned-scope finance references.
- `documents-audit.spec.js`: contextual uploads/comments, guarded downloads, path/entity/scope denial, read-only aggregates, and audit visibility.
- `scope-security.spec.js`: representative scope/isolation, safe partial failures, audit-before-download, and export safety.
- `dashboards-alerts.spec.js`: scoped filters, queues, actionable alerts, safe destinations, and role separation.
- `reports-exports.spec.js`: access, filters/tampering, CSV/XLSX formats, stable filenames, safe cells, and export auditing.
- `email-notifications.spec.js`: functional invitation/reset/workflow links and recipients without freezing unapproved production wording.

## Manual evidence

The headed accessibility command is intentionally interactive. Record completion or blockers for keyboard order, visible focus, real 100% and 200% zoom, horizontal overflow, form/error usability, navigation, and non-color state meaning. Automated viewport emulation is not accepted as proof of real browser zoom.
