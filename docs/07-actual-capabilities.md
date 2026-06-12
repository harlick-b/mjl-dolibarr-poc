# Actual Codebase Capabilities

This document describes what the repository can actually do based on the
current code, not what the broader POC scope says it should eventually cover.

## Repository shape

The repository contains a Dockerized Dolibarr 23.0.2 setup and one custom
Dolibarr module: `custom/mjlfinancement`.

Implemented parts:

- Local Dolibarr + MariaDB runtime through `docker-compose.yml`.
- A custom Dolibarr module declaration, `modMjlFinancement`, currently version
  `0.3.0`.
- Seven custom database-backed object classes:
  - `MjlConvention`
  - `MjlActivity`
  - `MjlBudgetLine`
  - `MjlFundReceipt`
  - `MjlExpense`
  - `MjlValidation`
  - `MjlReport`
- SQL table definitions and indexes/foreign keys for those custom objects.
- Activation upgrade scripts for the 0.2.0 and 0.3.0 schemas.
- CSV-driven bootstrap and sample-data seed scripts.
- Schema, acceptance, and smoke scripts for the POC data set.
- A minimal dashboard page at `/mjlfinancement/index.php`.

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
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/acceptance_sample_data.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php
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

- `admin.poc`
- `comptable.mjl`
- `responsable.projet`
- `validateur.financier`
- `lecteur.audit`

The default password is:

```text
MjlPoc2026!!
```

It can be overridden with the `MJL_POC_DEFAULT_PASSWORD` environment variable.
The bootstrap assigns exactly one `MJL POC - ...` group to each sample user,
disables older legacy POC users when present, and generates an API key for
`admin.poc`.

## Implemented custom data model

The module creates seven custom tables.

### Conventions

Table: `llx_mjlfinancement_convention`

Key fields: `ref`, `title`, `fk_soc`, `fk_project`, `date_start`, `date_end`,
`total_amount`, `currency_code`, notes, audit fields, and `status`.

Statuses: Draft, Active, Closed.

### Activities

Table: `llx_mjlfinancement_activity`

Key fields: `ref`, `label`, `fk_project`, `fk_convention`, optional `fk_task`,
dates, notes, audit fields, and `status`.

Statuses: Draft, Ongoing, Completed.

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

### Reports

Table: `llx_mjlfinancement_report`

Key fields: `ref`, `name`, `scope`, `expected_format`, `filters`,
`must_include`, and audit fields.

## Upgrade and audit behavior

Fresh installs use the table definitions in the `sql/llx_*.sql` files and
their matching key files.

Existing POC installs are upgraded by `sql/update_0.2.0.sql` and
`sql/update_0.3.0.sql` during module activation. The upgrades backfill renamed
fields where possible and use guarded DDL for 0.3.0 additions.

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

## What can be done programmatically

The seven custom classes extend Dolibarr `CommonObject` and expose basic
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
- activity read/write/delete
- budget line read/write/delete
- expense read/write/delete/validate
- export read/write
- fund receipt read/write
- validation read/write
- report read/write

The dashboard count rows are filtered by the matching read right. Report
summaries require `report/read`.

## What is not implemented yet

The current code does not implement:

- Custom CRUD screens for MJL objects.
- Custom export files or export controllers.
- A browser UI for expense submission, correction, rejection, or validation.
- A business rule preventing overspend.
- API endpoints specific to MJL objects.
- Dolibarr hook, trigger, cron job, model, template, dashboard box, or custom
  tab implementations.
- Browser-level smoke tests.

## Practical conclusion

Today, this repository is a runnable Dolibarr POC with a custom MJL financing
module, schema, object classes, CSV seed data, role bootstrap automation,
read-only dashboard summaries, and CLI validation scripts.

It is not yet a complete financial monitoring application for end users. The
next major product work would be custom list/card/create/edit pages and at
least one browser-driven workflow from convention to expense validation and
reporting.
