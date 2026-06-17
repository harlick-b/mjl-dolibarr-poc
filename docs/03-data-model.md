# Data Model Strategy

## Native Dolibarr mapping

Use native Dolibarr objects wherever they already match the MJL need:

- Partner / PTF / bailleur: Third Party.
- Project: Project.
- Users and permissions: Users and Groups.
- Supporting documents: ECM.
- Exports and dashboard: custom module pages.

The custom module should not duplicate these native concepts.

## Current custom objects

Keep these custom MJL objects as the Phase 1 base:

- `MjlConvention`
- `MjlActivity`
- `MjlExpense`
- `MjlFundReceipt`
- `MjlBudgetLine`
- `MjlValidation`
- `MjlReport`

These objects are represented in the repository and remain the base model for
the current POC.

## Envelope decision

`MjlConvention` is the Phase 1 envelope candidate.

Reason: it already carries the key envelope dimensions:

- `fk_soc`
- `fk_project`
- `date_start`
- `date_end`
- `total_amount`
- `currency_code`
- `status`

`MjlFundReceipt` also links received funds to `MjlConvention`, which makes it a
reasonable place to model the first funding envelope.

Do not create `MjlMissionEnvelope` in Phase 1. Defer it until Phase 2 proves
that grouped mission funding cannot be modeled cleanly with `MjlConvention`,
activities, budget lines, and fund receipts.

## Audit model

The current `MjlValidation` object is expense-specific and remains tied to
expense validation.

Generic activity workflow, exchanges, field changes, and reassignment audit use
`MjlWorkflowAction` with these fields:

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

`changes_json` must store simple before/after values for important field
changes. This closes the gap between status history and field-level audit.

`MjlExchangeLog` is implemented for comments/exchanges that must be listed,
filtered, or reported independently from workflow actions.

## Activity workflow rules

Activity workflow is the strategic center of the revised POC.

Required lifecycle concepts:

- Creation by `AGENT` in draft or ongoing state.
- Submission by `AGENT`.
- Correction requested by `SUPERVISEUR_N1`.
- Correction and resubmission by `AGENT`.
- Validation by `SUPERVISEUR_N1`.
- Rejection with reason by `SUPERVISEUR_N1`.
- Optional escalation to `SUPERVISEUR_N2` or `DPAF` where the business rule
  requires it.

Persisted activity statuses are distinct:

- `0` draft.
- `1` ongoing.
- `2` completed.
- `3` submitted.
- `4` correction requested.
- `5` corrected.
- `6` validated.
- `8` rejected.
- `9` cancelled.

`overdue` is not a persisted status.

No-self-validation is a domain rule and must be enforced in the activity model,
not only in UI permissions.

## Alerts

`Échéance proche` and `En retard` are computed alert states from `date_end` and
completion/cancellation state.

They must not replace workflow status. An activity can keep its real workflow
status while also being shown as close to deadline or late.

## Roles

Target role contract:

- `AGENT`
- `SUPERVISEUR_N1`
- `SUPERVISEUR_N2`
- `DPAF`
- `ADMIN`
- `LECTEUR`

CSV sample data and bootstrap rights now use this contract.

## Entity filtering

Every custom object, dashboard query, export, audit list, and workflow lookup
must filter by the active Dolibarr entity.

Cross-entity leakage is a blocking security defect.
