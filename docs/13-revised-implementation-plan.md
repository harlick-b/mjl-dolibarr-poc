# Revised Implementation Plan

## Confidence result

This file started as a Phase 1 documentation-only plan. After review, runtime
work moved beyond that phase: the module now includes workflow/audit tables,
activity workflow screens, DPAF dashboarding, exchange logs, and CSV exports.

The remaining rule is unchanged: do not create `MjlMissionEnvelope` unless
`MjlConvention` fails the envelope test in real implementation.

## Revised target

The POC priority is:

1. Activity traceability.
2. Hierarchical workflow.
3. Audit.
4. DPAF dashboard.
5. Deadline alerts.
6. Permissions.
7. Excel-readable exports.
8. Minimal financial tracking.

## Native Dolibarr mapping

- Partner / PTF / bailleur: native Third Party.
- Project: native Project.
- Users and permissions: native Users and Groups.
- Supporting documents: native ECM.
- Exports and dashboard: custom MJL module pages.

## Custom object strategy

Keep the current custom objects:

- `MjlConvention`
- `MjlActivity`
- `MjlExpense`
- `MjlFundReceipt`
- `MjlBudgetLine`
- `MjlValidation`
- `MjlReport`

Treat `MjlConvention` as the Phase 1 envelope candidate because it already
links `fk_soc`, `fk_project`, dates, amount, currency, and status, and because
`MjlFundReceipt` already links received funds to it.

Defer `MjlMissionEnvelope`. Create it only if Phase 2 proves grouped mission
funding cannot be modeled cleanly with `MjlConvention` plus activities, budget
lines, and fund receipts.

The traceability objects are implemented:

- `MjlWorkflowAction` for generic activity, expense, reassignment, exchange, and
  field-change audit.
- `MjlExchangeLog` for exchanges/comments when they must be queryable apart
  from workflow actions.

## `MjlWorkflowAction`

Required fields:

- `object_type`
- `object_id`
- `action`
- `from_status`
- `to_status`
- `actor`
- `actor_role`
- `action_date`
- `reason` or `comment`
- `changes_json`

`changes_json` stores simple before/after values for important changed fields.
It is required because validation status rows alone do not prove what changed.

Do not overload the current `MjlValidation` table for generic activity and
field-change audit. It is expense-specific in the current implementation.

## Roles

Target role contract:

- `AGENT`
- `SUPERVISEUR_N1`
- `SUPERVISEUR_N2`
- `DPAF`
- `ADMIN`
- `LECTEUR`

CSV/bootstrap rights now align with this contract. Current sample groups remain
implementation details, not the final role model.

No-self-validation is a domain rule. An `AGENT` must not validate their own
activity, and the rule must be enforced in `MjlActivity`, not only hidden in the
UI.

## Alerts

`Échéance proche` and `En retard` are computed alert states based on `date_end`
and whether the activity is completed or cancelled.

They must not replace the real workflow status. For example, an activity can be
`submitted` and also computed as `En retard`.

## Exports

Default export format:

- UTF-8 BOM.
- Semicolon separator.
- French headers.
- Stable filenames.

`.xlsx` is allowed only if an existing safe Dolibarr helper or dependency is
found. Do not add a new spreadsheet dependency during Phase 1.

## Entity and security

Every new object, dashboard query, export, audit list, and workflow lookup must
filter on the active Dolibarr entity. Custom queries must not leak data across
entities.

## DPAF dashboard

The DPAF dashboard must include:

- Activities.
- Deadlines.
- Pending reviews.
- Expenses.
- Budgets.
- Validations.
- Recent workflow actions.

Simple counts alone are not enough for the target strategy.

## Stop gates

Switch to a Symfony MVP if:

- Dolibarr core edits become necessary.
- The hierarchical workflow cannot be expressed clearly.
- Audit does not show who, what, when, why, and changes.
- Dashboard or export implementation becomes painful.
- The module becomes hard for junior developers or AI agents to reason about.

## Implementation gate

This gate is already crossed for the current repository. Future implementation
work should keep schema, audit scripts, smoke tests, seed data, and docs in
sync with the code.
