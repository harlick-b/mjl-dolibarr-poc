# Actual Codebase Capabilities

This document describes what the repository can actually do based on the
current code, not what the broader POC scope says it should eventually cover.

## Current versus target strategy

The current implementation now follows the revised traceable-demo strategy for
Phase 1. It keeps `MjlConvention` as the envelope-like grouping object and does
not add `MjlMissionEnvelope`.

Sample roles are aligned to the target role contract: `AGENT`,
`SUPERVISEUR_N1`, `SUPERVISEUR_N2`, `DPAF`, `ADMIN`, and `LECTEUR`.

Current code has `MjlValidation` for expense validation history. It also has
`MjlWorkflowAction` and `MjlExchangeLog`. `MjlWorkflowAction` is wired into the
`MjlActivity` domain workflow methods, the activity workflow browser page, and
the generic workflow action browser page. `MjlExchangeLog` is exposed through a
browser page for activity-linked exchanges.

Current code has `MjlConvention`. The target strategy treats it as the Phase 1
envelope candidate and defers `MjlMissionEnvelope` until Phase 2 proves it is
needed.

The module includes a generic index dashboard and a dedicated DPAF dashboard
covering activity deadlines, pending reviews, budgets, expenses, fund receipts,
validation snippets, and recent workflow actions.

## Repository shape

The repository contains a Dockerized Dolibarr 23.0.2 setup and one custom
Dolibarr module: `custom/mjlfinancement`.

Implemented parts:

- Local Dolibarr + MariaDB runtime through `docker-compose.yml`.
- A custom Dolibarr module declaration, `modMjlFinancement`, currently version
  `0.5.0`.
- Nine custom database-backed object classes:
  - `MjlConvention`
  - `MjlActivity`
  - `MjlBudgetLine`
  - `MjlFundReceipt`
  - `MjlExpense`
  - `MjlValidation`
  - `MjlWorkflowAction`
  - `MjlExchangeLog`
  - `MjlReport`
- SQL table definitions and indexes/foreign keys for those custom objects.
- Activation upgrade scripts for the 0.2.0, 0.3.0, and 0.4.0 schemas.
- CSV-driven bootstrap and sample-data seed scripts.
- Schema, acceptance, and smoke scripts for the POC data set.
- A generic dashboard page at `/mjlfinancement/index.php`.
- A DPAF dashboard page at `/mjlfinancement/dpafdashboard.php`.
- Browser pages for activities, expenses, validations, workflow actions,
  exchange logs, and reports.

## What can be run locally

Start Dolibarr:

```bash
docker compose up -d
```

Dolibarr is exposed at:

```text
http://127.0.0.1:8080/
```

Prepare users, roles, module activation, and rights:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php
```

Seed the CSV sample data:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php
```

Run checks:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.3.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.4.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/acceptance_sample_data.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_activity_workflow.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_traceability_exports.php
```

The legacy 0.2.0 schema audit remains available for older migration checks:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.2.0.php
```

## Bootstrap and sample users

The bootstrap activates these Dolibarr modules:

- Users
- Third parties
- Projects
- ECM/documents
- Accounting
- Expense reports
- Export
- Module Builder
- API
- `MjlFinancement`

It reads `sample_data/seed/roles_permissions.csv` and
`sample_data/seed/users.csv` to create or update these POC users:

- `admin.poc` (`ADMIN`)
- `agent.mjl` (`AGENT`)
- `superviseur.n1` (`SUPERVISEUR_N1`)
- `superviseur.n2` (`SUPERVISEUR_N2`)
- `dpaf.mjl` (`DPAF`)
- `lecteur.audit` (`LECTEUR`)

The default password is:

```text
MjlPoc2026!!
```

It can be overridden with the `MJL_POC_DEFAULT_PASSWORD` environment variable.
The bootstrap assigns exactly one `MJL POC - ...` group to each sample user,
disables older legacy POC users when present, and generates an API key for
`admin.poc`.

## Implemented custom data model

The module creates nine custom tables.

### Conventions

Table: `llx_mjlfinancement_convention`

Key fields: `ref`, `title`, `fk_soc`, `fk_project`, `date_start`, `date_end`,
`total_amount`, `currency_code`, notes, audit fields, and `status`.

Statuses: Draft, Active, Closed.

### Activities

Table: `llx_mjlfinancement_activity`

Key fields: `ref`, `label`, `fk_project`, `fk_convention`, optional `fk_task`,
dates, notes, audit fields, and `status`.

Statuses: Draft (`0`), Ongoing (`1`), Completed (`2`), Submitted (`3`),
Correction requested (`4`), Corrected (`5`), Validated (`6`), Rejected (`8`),
Cancelled (`9`).

`overdue` is not persisted. Deadline alerts are computed from `date_end` and
are hidden only for completed or cancelled activities.

### Budget Lines

Table: `llx_mjlfinancement_budget_line`

Key fields: `ref`, `label`, `fk_project`, `fk_convention`,
`fk_mjl_activity`, optional Dolibarr task link `fk_activity`,
`initial_budget`, `revised_budget`, `committed_amount`, `spent_amount`,
`remaining_amount`, `category`, notes, audit fields, and `status`.

### Fund Receipts

Table: `llx_mjlfinancement_fund_receipt`

Key fields: `ref`, `fk_soc`, `fk_project`, `fk_convention`, `amount`,
`reception_date`, `supporting_document`, `comment`, notes, audit fields, and
`status`.

Statuses: Draft, Recorded, Not received.

### Expenses

Table: `llx_mjlfinancement_expense`

Key fields: `ref`, `fk_project`, `fk_convention`, `fk_mjl_activity`,
`fk_budget_line`, `amount`, `expense_date`, `description`,
`supporting_document`, `fk_user_valid`, `validation_date`,
`correction_reason`, `submitted_at`, notes, audit fields, and `status`.

Statuses: Draft, Submitted, Validated, Corrected, Rejected.

The `MjlExpense` class includes a `validate()` method for submitted expenses.
It requires a supporting document, checks the revised budget-line balance,
writes `status`, `fk_user_valid`, and `validation_date`, creates a
`MjlValidation` history row, and recalculates the budget line in one database
transaction. If trigger `MJLFINANCEMENT_EXPENSE_VALIDATE` fails, the transaction
is rolled back.

Generic create/update/delete calls are intentionally restricted around audited
states: validated, rejected, and corrected expenses cannot be created directly
through `create()`, reached through generic `update()`, or modified/deleted once
validation history exists.

### Validations

Table: `llx_mjlfinancement_validation`

Key fields: `ref`, `fk_expense`, `action`, `from_status`, `to_status`,
`fk_user_action`, `action_date`, `comment`, and audit fields.

### Workflow Actions

Table: `llx_mjlfinancement_workflow_action`

Key fields: `ref`, `object_type`, `object_id`, `action`, `from_status`,
`to_status`, `actor`, `actor_role`, `action_date`, `reason`, `comment`,
`changes_json`, and audit fields.

This is the generic audit foundation for activity workflow, field changes,
reassignment, and non-expense workflow actions. It is wired into the
`MjlActivity` domain methods and exposed through browser workflow screens.
Activity status changes and important activity field edits write
`MjlWorkflowAction` rows. Field edits store before/after values in
`changes_json`.

### Exchange Logs

Table: `llx_mjlfinancement_exchange_log`

Key fields: `ref`, `object_type`, `object_id`, `exchange_date`, `actor`,
`actor_role`, `channel`, `subject`, `message`, and audit fields.

This is the queryable exchange/comment foundation. It is exposed in
`exchangelogs.php` with create, list, and filter behavior for activity-linked
demo exchanges.

### Reports

Table: `llx_mjlfinancement_report`

Key fields: `ref`, `name`, `scope`, `expected_format`, `filters`,
`must_include`, and audit fields.

## Upgrade and audit behavior

Fresh installs use the table definitions in the `sql/llx_*.sql` files and
their matching key files.

Existing POC installs are upgraded by `sql/update_0.2.0.sql`,
`sql/update_0.3.0.sql`, and `sql/update_0.4.0.sql` during module activation.
The upgrades backfill renamed fields where possible and use guarded DDL for
0.3.0 and 0.4.0 additions.

Legacy columns that no longer belong to the 0.3.0 fresh schema are dropped only
when empty. Populated legacy columns are preserved for manual review and are
reported by `scripts/audit_schema_0.3.0.php`.

The 0.3.0 audit reports:

- missing required tables, columns, indexes, and constraints,
- duplicate `ref` + `entity` values,
- broken foreign-key references,
- audited expenses missing matching validation history,
- stale stored budget-line execution amounts,
- cross-entity custom links and sample ECM source links,
- populated legacy columns that could not be safely dropped,
- empty legacy columns that remain after migration cleanup.

The 0.4.0 audit reports:

- missing workflow-action and exchange-log tables, columns, indexes, and
  constraints,
- duplicate `ref` + `entity` values,
- broken actor references,
- workflow actions missing `changes_json`.

## What can be done through the UI

The custom module exposes a top menu entry to `/mjlfinancement/index.php` for
users with at least one MJL read right.

The page displays a small read-only dashboard:

- counts for the object families the current user may read,
- project financial summary `RPT-001` for users with `report/read`,
- convention budget execution `RPT-002` for users with `report/read`.

The page is read-only and does not run schema changes. It does not provide
custom create, edit, delete, validate, export, or detailed list/card screens.

Standard Dolibarr modules activated by the bootstrap can still be used through
their native screens, subject to user permissions.

The custom activity page at `/mjlfinancement/activities.php` provides:

- activity creation in draft status,
- active-entity dropdown selectors for project, convention, and optional
  project task,
- activity list with project, convention, status, computed deadline alert, and
  creator,
- submit, correction request, correction, validation, and rejection actions,
- audited label/date correction with a required comment while draft or
  correction requested,
- no-self-validation protection through the domain class,
- recent activity workflow history from `MjlWorkflowAction`.

The custom expense page at `/mjlfinancement/expenses.php` provides:

- expense creation in draft status,
- active-entity dropdown selectors for project, convention, optional activity,
  and budget line,
- supporting document upload to ECM,
- submission, validation, rejection, correction, and resubmission actions.

The custom workflow action page at `/mjlfinancement/workflowactions.php`
provides:

- recent generic workflow action history,
- active-entity filtering,
- filters for object type, action, actor role, and date range,
- before/after status and `changes_json` display.

## What can be done programmatically

The nine custom classes extend Dolibarr `CommonObject` and expose basic
methods:

- `create()`
- `fetch()`
- `update()`
- `delete()`

`MjlExpense` also exposes `validate()`.

The seed script creates sample third parties, projects, tasks, conventions,
activities, budget lines, fund receipts, expenses, validation events, fixed
report definitions, and ECM placeholder documents.

## Custom permissions currently declared

The module declares rights for:

- convention read/write/delete
- activity read/write/delete/validate
- budget line read/write/delete
- expense read/write/delete/validate
- export read/write
- fund receipt read/write
- validation read/write
- workflow action read/write
- exchange log read/write
- report read/write

The dashboard count rows are filtered by the matching read right. Report
summaries require `report/read`.

## What is not implemented yet

The current code does not implement:

- Full custom CRUD/detail screens for every MJL object.
- Rich document preview/download flows in the custom screens.
- API endpoints specific to MJL objects.
- Dolibarr hook, trigger, cron job, model, template, dashboard box, or custom
  tab implementations.
- Browser-level smoke tests.

## Practical conclusion

Today, this repository is a runnable Dolibarr POC with a custom MJL financing
module, schema, object classes, CSV seed data, role bootstrap automation,
browser workflow pages, exchange traceability, DPAF dashboarding, CSV exports,
and CLI validation scripts.

It is not yet a complete financial monitoring application for end users. The
next major product work would be richer detail pages, official client report
canevas, stronger document consultation, and browser-driven regression tests.
