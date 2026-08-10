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
npm run audit:production-readiness
```

- `npm test` provisions one disposable tenant, runs unit contracts, current container verification, and blocking Chromium capability suites, then removes the tenant.
- `npm run test:unit` runs fast Node and PHP contracts without Docker.
- `npm run test:verify` currently runs legacy schema/sample-data and old-product behavioral checks in one disposable tenant. It is current-state characterization only until RST-013A/RST-014A replace its data setup; it cannot validate target business rules.
- `npm run test:e2e` runs the twelve blocking capability suites in one disposable tenant.
- `npm run test:characterization` runs current finance behavior (C1) and pending role-to-route/project/export admissions (C2) that still lack product authority. It is intentionally excluded from `npm test`, but exits nonzero on drift.
- `npm run test:manual-accessibility` opens the real application in headed Chromium for a signed keyboard, focus, forms/workflow, screen-reader, reflow, and actual 100%/200% browser-zoom review.
- `npm run audit:production-readiness` runs the non-blocking local readiness diagnostic in its own disposable tenant. It is intentionally excluded from `npm test` and prints an explicit blocked verdict while client/operator confirmations remain unknown.

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

RST-000A removed the legacy persistent seed. The runner may activate modules
inside its disposable tenant but creates no business records. RST-014 must add
minimal per-test or per-suite factories before the container-backed legacy
journeys can serve as target acceptance. Normal completion, failure, and
interruption run `docker compose down -v --remove-orphans` and verify no
labeled containers, networks, or volumes remain.

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

`verify_sample_data.php` now verifies the opposite contract: all persistent
sample/business rows and paths are absent while the single native technical
administrator remains.

## Target fixture contract

- Normal shared-tenant startup creates no persistent sample data.
- Tests create only the minimum records needed inside the runner's unique
  database/entity and document volumes.
- Test data is never copied from the legacy POC dataset and never defines a
  business rule.
- Teardown must remove records, files, containers, networks, and volumes on
  success, failure, and interruption.
- No persistent demonstration dataset is introduced until all implementation
  phases and the later dataset specification are complete.

`check_production_readiness.php` remains an operational diagnostic, not a test gate. It reports client/operator-dependent `UNKNOWN` values for the final permission matrix, official outputs and content, production email, public URL, secrets, document storage, backup/restore, monitoring, and retention. Operational scripts are CLI-only and the Apache boundary denies their complete HTTP route family.

## Blocking capability coverage

- `access-shell.spec.js`: guarded native boundary, role-projected shell, current location, focus, responsive drawer, reduced motion, and auth helpers.
- `auth-invitations.spec.js`: invitation lifecycle, neutral reset response, replay/revocation, unsafe targets, and CSRF.
- `partners-projects.spec.js`: assigned scope, project create/edit permissions, cross-scope denial, and semantic row actions.
- `activities.spec.js`: creation, scoped references, JavaScript-free recovery,
  execution, unavailable aggregate sources, correction, staged decisions,
  audit, and no-self behavior.
- `expenses.spec.js`: validation-versus-technical create recovery without
  diagnostic leakage, documents, submit/correct/reject, prevalidation, final
  validation, disbursement, exact-one replay, concurrency, and no-self behavior.
- `finance.spec.js`: authority-backed active-entity and assigned-scope finance references.
- `documents-audit.spec.js`: contextual uploads/comments, guarded downloads, path/entity/scope denial, read-only aggregates, and audit visibility.
- `scope-security.spec.js`: representative scope/isolation, safe partial failures, audit-before-download, and export safety.
- `dashboards-alerts.spec.js`: raw-condition scoped filters and queues,
  workflow-specific actionable alerts, partner-card convergence, 390-pixel
  containment, safe destinations, and role separation.
- `reports-exports.spec.js`: access, filters/tampering, CSV/XLSX formats, stable filenames, safe cells, and export auditing.
- `email-notifications.spec.js`: functional invitation/reset/workflow links and recipients without freezing unapproved production wording.
- `screen-inventory.spec.js`: all sixteen active application screens, exact document titles and headings, one semantic main landmark, safe rendering, read-only global Documents, guarded downloads, protected advanced routes, hidden roadmap, absent public registration, and denied operational-script URLs.

## Manual evidence

The headed accessibility command is intentionally interactive. It requires `MJL_MANUAL_ACCESSIBILITY_REVIEWER`, `MJL_MANUAL_ACCESSIBILITY_ASSISTIVE_TECH`, non-empty `MJL_MANUAL_ACCESSIBILITY_NOTES`, and `MJL_MANUAL_ACCESSIBILITY_VERDICT=pass|fail`. Record keyboard order, visible focus, representative screen-reader output, real 100% and 200% zoom at 390/768/980/1024/1366, horizontal overflow, form/error recovery, workflow states, navigation, and non-color meaning. Each of the 90 resumed combinations records its geometry, focus, notes, reviewer and result in the signed evidence. Automated viewport emulation is not accepted as proof of real browser zoom, and an unsigned run cannot emit a passing evidence status.
