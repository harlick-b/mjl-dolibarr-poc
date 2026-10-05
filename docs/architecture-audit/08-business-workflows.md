# Business workflows

## Portfolio references

- Validator creates and maintains Partenaires, Projets and Types d’Opération.
- Project technical reference and original Partner are immutable. Partner deactivation atomically closes its active Projects; reactivation does not reopen them.
- Operation Types and custom objects are entity scoped and application-deactivated rather than hard deleted.

## Activity planning and review

```text
DRAFT -> ABANDONED -> DRAFT
DRAFT/RETURNED_* -> SUBMITTED -> PREVALIDATED -> FINAL_VALIDATED
SUBMITTED -> RETURNED_SUPERVISOR
PREVALIDATED -> RETURNED_VALIDATOR
```

An assigned Agent creates a future Activity and becomes primary. Structural edits stop at start and require balanced integer-XOF Operations on submission. Submission creates an immutable revision and contributor set. Resubmission requires a structural change. Supervisor and Validator decisions target the exact current revision; contributors cannot review it and the final Validator cannot be the prevalidator. Returns require reasons and stop after start, while unchanged acceptance may finish.

## Execution

After definitive validation, an assigned Agent moves Operations forward from TODO to IN_PROGRESS or COMPLETED. Completion requires an explicit spent amount; a variance requires observation. Missing remains distinct from zero. Derived Activity execution status is recalculated from validation, dates, cancellation and child terminal states and is audited when it changes.

## Exceptions

Cancellation/reopening requests are bound to target version/revision. Only current assigned Agents request or withdraw; Validator approves/rejects. Activity cancellation terminates active children and assignments. Completed Operations may reopen to IN_PROGRESS after approval; cancelled Operations do not reopen.

## Audit and reporting

Committed business/access actions append immutable entity-scoped audit events. Timeline projection sanitizes payloads into French descriptions. Reports are server-filtered and authorization scoped; official operational formats are French PDF/XLSX with audited CSV supplemental. Export evidence is recorded before HTTP streaming.

## Workflow risks

- Export evidence intentionally records a fully generated artifact before delivery. Existing E2E source specifies that a client abort leaves `GENERATED` evidence; a server-side `fread() === false` still exits silently and lacks focused coverage.
- One failing Activity stops later reconciliation rowids; earlier per-Activity commits remain durable.
- Predecessor/current branches preserve older schemas but add duplicated behavior whose retirement is undecided.
