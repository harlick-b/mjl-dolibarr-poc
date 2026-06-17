# Test Scenarios

## Phase 1 acceptance tests to document

These tests define the current POC behavior and the remaining acceptance
surface for regression checks.

## Activity workflow

1. `AGENT` creates an activity.
2. `AGENT` submits the activity.
3. `SUPERVISEUR_N1` requests correction with a reason.
4. `AGENT` corrects important fields and resubmits.
5. `SUPERVISEUR_N1` validates the resubmitted activity.
6. `SUPERVISEUR_N1` rejects a submitted activity with a reason.
7. A user cannot validate their own activity.

Expected audit result:

- Actor is recorded.
- Actor role is recorded.
- Action date is recorded.
- Source and target statuses are recorded.
- Reason/comment is recorded when required.
- Important field changes are recorded with before/after values.

## DPAF dashboard

`DPAF` sees all records in the active entity across:

- Activities.
- Deadlines.
- Pending reviews.
- Expenses.
- Budgets.
- Validations.
- Recent workflow actions.

The dashboard must not show records from another Dolibarr entity.

## Deadline alerts

Activities compute:

- `Échéance proche` when the end date is approaching and the activity is not
  completed or cancelled.
- `En retard` when the end date has passed and the activity is not completed or
  cancelled.

The computed alert must not overwrite the real workflow status.

## Exports

Excel-readable exports must work for:

- `Suivi des activités`.
- `Suivi des dépenses`.
- `Historique décisions / audit`.

Expected export format:

- UTF-8 BOM.
- Semicolon separator.
- French headers.
- Stable filenames.
- Exact required French columns for each export.

`.xlsx` export is accepted only when it uses an already available safe Dolibarr
helper or dependency.

## Permissions

Role contract to test:

- `AGENT`
- `SUPERVISEUR_N1`
- `SUPERVISEUR_N2`
- `DPAF`
- `ADMIN`
- `LECTEUR`

Tests must verify that permissions alone are not the only protection for
business rules. No-self-validation must be enforced by domain logic.

## Exchange traceability

1. `AGENT` creates an activity-linked exchange log.
2. A reader filters exchange logs by object type, object id, and channel.
3. The list shows actor, actor role, date, channel, subject, and message.
4. No exchange query returns rows from another active entity.
