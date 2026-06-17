# AI Agent Rules

## Phase 1 boundary

Phase 1 is documentation only.

Do not change:

- SQL schemas.
- PHP module behavior.
- UI screens.
- Dependencies.
- Dolibarr core files.
- Sample data contracts.

Do not create `MjlMissionEnvelope` during Phase 1.

## Dolibarr core rule

Never edit Dolibarr core files for this POC strategy.

All custom behavior must live in:

- `custom/mjlfinancement`
- documented setup scripts
- documented sample data
- custom module pages

If a requirement needs Dolibarr core edits, stop and evaluate a Symfony MVP.

## Maintainability rules

Prefer small, named domain objects over large mixed-purpose tables.

Do not overload `MjlValidation` for generic audit. It is expense-specific in the
current codebase. Use a future `MjlWorkflowAction` for generic activity,
expense, exchange, reassignment, and field-change audit.

Add only the next necessary object in Phase 2:

- `MjlWorkflowAction`
- `MjlExchangeLog`, only if exchanges must be independently queryable

Create `MjlMissionEnvelope` only if `MjlConvention` fails the envelope test.

## Native-first rule

Use native Dolibarr features where they match the need:

- Third parties for PTF/bailleurs.
- Projects for projects.
- Users/groups for roles and permissions.
- ECM for supporting documents.

Do not duplicate native Dolibarr concepts in custom tables without a documented
reason.

## Audit rules

Every important workflow action must answer:

- Who?
- What?
- When?
- Why?
- What changed?

`changes_json` must contain simple before/after values for important changed
fields.

## Entity rules

Every new query for custom objects, dashboards, exports, audit lists, and
workflow actions must filter by the active Dolibarr entity.

Treat missing entity filtering as a security defect.

## Workflow rules

No-self-validation is a domain rule. Do not rely only on button visibility or UI
permissions.

Deadline alerts are computed states, not workflow statuses:

- `Échéance proche`
- `En retard`

## Export rules

Default to CSV that Excel can open reliably:

- UTF-8 BOM.
- Semicolon separator.
- French headers.
- Stable filenames.

Use `.xlsx` only when a safe existing Dolibarr helper or dependency is already
available. Do not add a new spreadsheet dependency during Phase 1.
