# Codebase Analysis

## Overall state

This repository is a Dolibarr 23.0.2 proof of concept for financial tracking of externally funded projects. It is not a standalone application; it is a Dockerized Dolibarr instance plus one custom module: `custom/mjlfinancement`.

The current implementation is credible for a traceable POC. It includes a custom data model, installation/bootstrap scripts, seed data, permissions, dashboard views, reports, exchange logs, standardized CSV exports, and working expense/activity workflows. It is not yet a polished production application: several screens are basic table/form views and rich detail pages are still intentionally out of scope.

The current working tree also contains modified and untracked module files, so the filesystem state is ahead of the committed git state.

## Runtime and setup

- Dolibarr runs through Docker with MariaDB using `docker-compose.yml`.
- Dolibarr is exposed on `http://127.0.0.1:8080/`.
- The custom module is `MjlFinancement`, version `0.5.0`.
- The module depends on Dolibarr third parties, projects, ECM/documents, expense reports, and export modules.
- Bootstrap is handled by `custom/mjlfinancement/scripts/bootstrap_poc.php`.
- Sample data is loaded by `custom/mjlfinancement/scripts/seed_sample_data.php`.

Typical setup:

```bash
docker compose up -d
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php
```

Default POC user password:

```text
MjlPoc2026!!
```

## Main implemented domain objects

The module defines nine custom database-backed objects:

- `MjlConvention`
- `MjlActivity`
- `MjlBudgetLine`
- `MjlFundReceipt`
- `MjlExpense`
- `MjlValidation`
- `MjlWorkflowAction`
- `MjlExchangeLog`
- `MjlReport`

Each object has a Dolibarr `CommonObject` class and matching SQL table definitions. The most complete browser behavior is implemented around expenses. `MjlActivity` exposes domain workflow methods backed by `MjlWorkflowAction`, and `activities.php` exposes the first browser workflow for activities.

## Data model coverage

Implemented tables cover:

- Conventions
- Activities
- Budget lines
- Fund receipts
- Expenses
- Validation events
- Generic workflow actions
- Exchange logs
- Fixed reports

The schema includes entity support, references, audit fields, statuses, links to Dolibarr projects/third parties/users, and custom foreign-key style relationships between MJL objects.

Upgrade scripts are present for schema versions `0.2.0`, `0.3.0`, `0.4.0`,
and `0.5.0`.

## Available user-facing features

### Dashboard

File: `custom/mjlfinancement/index.php`

The generic dashboard provides:

- Counts for readable MJL object families.
- Navigation buttons to module screens.
- A fixed project financial summary.
- A fixed convention budget execution table.
- Links to exchange logs, reports, and the DPAF dashboard.

Access is controlled by MJL read permissions.

File: `custom/mjlfinancement/dpafdashboard.php`

The DPAF dashboard provides:

- Activity deadline alerts computed from `date_end`.
- Pending activity and expense reviews.
- Budget and expense summaries by convention.
- Recent fund receipts.
- Recent validation and activity workflow actions.

All dashboard queries filter by the active Dolibarr entity.

### Conventions

File: `custom/mjlfinancement/conventions.php`

Available:

- Read-only list of conventions.

Not yet available:

- Custom create/edit/delete UI.
- Detail page.
- Search/filter form.

### Budget lines

File: `custom/mjlfinancement/budgetlines.php`

Available:

- Read-only list of budget lines.
- Displays initial budget, revised budget, spent amount, remaining amount, and status.

Not yet available:

- Custom create/edit/delete UI.
- Budget-line detail page.
- Guided selection by project/convention/activity.

### Fund receipts

File: `custom/mjlfinancement/fundreceipts.php`

Available:

- Read-only list of fund receipts.

Not yet available:

- Custom create/edit/delete UI.
- Supporting document upload workflow for receipts.

### Activities

File: `custom/mjlfinancement/activities.php`

Available:

- Create a draft activity.
- Select project, convention, and optional project task through active-entity
  dropdowns.
- List activities with project, convention, dates, status, computed deadline
  alert, and creator.
- Submit draft or corrected activities.
- Request correction on submitted activities.
- Mark correction-requested activities as corrected.
- Validate submitted activities.
- Reject submitted activities with a reason.
- Display recent activity workflow actions from `MjlWorkflowAction`.

Important rules:

- Create, edit, submit, and correction actions require `activity/write`.
- Validation, rejection, and correction request require `activity/validate`.
- No-self-validation is enforced by `MjlActivity`, not only by the UI.

Current limitations:

- There is no rich detail page per activity.
- Activity supporting documents are not exposed in this screen.
- Activity exchange logs are handled in the dedicated exchange log page.

### Expenses

File: `custom/mjlfinancement/expenses.php`

This is the most complete custom UI.

Available:

- Create a draft expense.
- Select project, convention, optional activity, and budget line through
  active-entity dropdowns.
- Upload a supporting document to Dolibarr ECM.
- Submit a draft or corrected expense.
- Validate a submitted expense.
- Reject a submitted expense with a reason.
- Edit a rejected expense.
- Mark a rejected expense as corrected.
- Resubmit a corrected expense.
- Display latest expenses with status, amount, budget line, and supporting document presence.

Important rules:

- Validation requires `expense/validate` permission.
- Creation, upload, submission, and correction require `expense/write` permission.
- Upload additionally requires Dolibarr ECM upload permission.
- Validated expenses cannot receive new supporting documents.
- Rejected expenses can be edited through the dedicated action.
- Corrected expenses must be resubmitted before validation.

Current limitations:

- There is no rich detail page per expense.
- There is no document preview or download link in the custom screen.

### Validation history

File: `custom/mjlfinancement/validations.php`

Available:

- Read-only validation/audit trail.
- Shows validation reference, expense reference, action, source status, target status, actor, date, and comment.

### Workflow actions

File: `custom/mjlfinancement/workflowactions.php`

Available:

- Read-only generic workflow-action audit trail.
- Filters by object type, action, actor role, date start, and date end.
- Shows object type, object id, linked activity reference when available,
  action, source status, target status, actor, actor role, date, reason,
  comment, and `changes_json`.

### Exchange logs

File: `custom/mjlfinancement/exchangelogs.php`

Available:

- Create an activity-linked exchange log.
- Filter by object type, object id, and channel.
- List recent exchanges with actor, actor role, date, channel, subject, and
  message.

Current limitations:

- The UI defaults to activity linkage for the demo, although the model remains
  generic for future convention or expense linkage.

### Reports

File: `custom/mjlfinancement/reports.php`

Available reports:

- Financial summary by project.
- Budget execution by convention.
- `Suivi des activités`.
- `Suivi des dépenses`.
- `Historique décisions / audit`.
- Exchange logs.
- DPAF summary.

Available report features:

- Filters for project, convention, status, date start, and date end.
- Table display.
- UTF-8 BOM, semicolon-separated CSV export with French headers and stable
  filenames for users with export write permission.
- The activity export uses `MjlConvention` as `Mission / enveloppe de
  financement`, linked Dolibarr task progress as the current physical execution
  source, and a computed performance index.

Current limitations:

- There is no dynamic report builder.
- Report definitions are fixed in code.

## Expense workflow behavior

The `MjlExpense` class implements the strongest business logic in the module.

Supported statuses:

- Draft
- Submitted
- Validated
- Corrected
- Rejected

Supported transitions:

- Draft to submitted.
- Corrected to submitted.
- Submitted to validated.
- Submitted to rejected.
- Rejected to corrected.

Validation enforces:

- The expense must belong to the active entity.
- The expense must be in submitted status.
- A supporting document must exist, either in the expense field or linked ECM file.
- The linked project, convention, activity, and budget line must be coherent.
- The expense must not exceed the available revised budget line balance.
- A validation history row is created.
- Budget-line spent and remaining amounts are recalculated.

Audit protection:

- Audited statuses cannot be created directly through generic `create()`.
- Status changes cannot be done through generic `update()`.
- Submitted, validated, corrected, and most audited expenses cannot be modified through generic `update()`.
- Validated or otherwise audited expenses cannot be deleted.

## Permissions and users

The module declares rights for:

- Convention read/write/delete.
- Activity read/write/delete.
- Budget-line read/write/delete.
- Expense read/write/delete/validate.
- Export read/write.
- Fund receipt read/write.
- Validation read/write.
- Workflow action read/write.
- Exchange log read/write.
- Report read/write.

The bootstrap creates POC groups and users from CSV sample data:

- `admin.poc`
- `agent.mjl`
- `superviseur.n1`
- `superviseur.n2`
- `dpaf.mjl`
- `lecteur.audit`

The bootstrap assigns exactly one MJL POC group per sample user and generates an API key for `admin.poc`.

## Sample data

The sample data pack includes:

- 3 projects
- 3 PTFs/bailleurs
- 3 conventions
- 5 activities
- 8 budget lines
- 4 fund receipts
- 7 expenses
- 4 validation events
- 10 document placeholders
- 6 users
- 3 reports

Notable sample edge cases:

- Rejected over-budget expense.
- Corrected expense.
- Missing supporting document.
- Draft project/convention without funds.
- Read-only user permissions.

## Verification scripts

Available scripts:

- `custom/mjlfinancement/scripts/audit_schema_0.3.0.php`
- `custom/mjlfinancement/scripts/audit_schema_0.4.0.php`
- `custom/mjlfinancement/scripts/audit_schema_0.5.0.php`
- `custom/mjlfinancement/scripts/audit_schema_0.2.0.php`
- `custom/mjlfinancement/scripts/acceptance_sample_data.php`
- `custom/mjlfinancement/scripts/smoke_expense_validation.php`
- `custom/mjlfinancement/scripts/smoke_activity_workflow.php`
- `custom/mjlfinancement/scripts/smoke_traceability_exports.php`

The main clean-install verification flow is documented in `docs/08-clean-install-verification.md`.

Expected successful outputs:

```text
MJL 0.3.0 schema audit: OK
MJL 0.4.0 workflow foundation audit: OK
MJL 0.5.0 activity status audit: OK
MJL sample data acceptance checks completed.
MJL expense validation smoke test completed.
MJL activity workflow smoke test completed.
```

## What is programmatically available

All nine custom classes expose basic Dolibarr object methods:

- `create()`
- `fetch()`
- `update()`
- `delete()`

`MjlExpense` additionally exposes:

- `submit()`
- `validate()`
- `reject()`
- `correct()`

`MjlActivity` additionally exposes:

- `submit()`
- `requestCorrection()`
- `correct()`
- `validate()`
- `reject()`

The seed and bootstrap scripts exercise much of the domain model outside the browser UI.

## Main gaps and risks

- Several screens are read-only lists rather than complete CRUD workflows.
- Expense workflow is implemented, but the UI remains basic.
- Activity workflow has a first browser page, but no detail page or document
  workflow yet.
- No custom REST API endpoints were found.
- No polished navigation, detail pages, search, or pagination controls.
- Supporting document handling is strongest for expenses, weaker or absent in custom UI for other objects.
- Some documentation files are empty even though useful implementation exists.
- The current git worktree has modified and untracked files, so the repo should be cleaned up before handoff or deployment.

## Explicit non-goals in the current POC

The current scope intentionally does not cover:

- Full ERP/accounting replacement.
- SMS.
- Bank API integration.
- OCR or AI invoice reading.
- External bailleur portal.
- Full offline mode.
- Dynamic report builder.

## Assessment

The application is suitable as a technical POC to demonstrate that Dolibarr can host the required financial tracking model and a controlled expense validation workflow. The strongest parts are the schema, bootstrap/seed automation, permission model, reports, and expense workflow rules.

The next level of work should focus on productizing the UI: replacing raw IDs with selectors, adding detail pages, adding create/edit flows for conventions/budget lines/fund receipts/activities, improving document access, and aligning documentation with the actual implemented screens.
