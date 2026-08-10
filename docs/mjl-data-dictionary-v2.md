# MJL Data Dictionary v2

This dictionary describes target data only. Existing POC records are deleted,
not mapped into these entities. Current tables and clean-reset gaps belong to
the Phase 0 audit report and reset manifest.

## Shared Rules

- Every custom record carries the active Dolibarr entity.
- Stable identifiers do not change when display names change.
- XOF money uses integer-safe minor-unit storage; XOF has no fractional unit in
  this application.
- Missing money remains null. Explicit zero remains numeric zero.
- Versioned mutable records use optimistic locking.
- Dates and scheduled derivations use `Africa/Porto-Novo`.
- Audit events are append-only.
- Target business tables start without persistent sample/demo rows. Disposable
  test fixtures exist only in isolated test tenants and define no target value.

## Partenaire

| Field | Required | Meaning |
| --- | --- | --- |
| Stable identifier | Yes | Internal immutable identity |
| Display name | Yes | User-facing Partner name |
| Active | Yes | Eligibility for new Activity selection |

One Partner has many Projects. Referenced Partners are not hard-deleted.

## Projet

| Field | Required | Meaning |
| --- | --- | --- |
| Stable identifier | Yes | Internal immutable identity |
| Partner identifier | Yes | Owning Partner |
| Display name | Yes | User-facing Project name |
| Active | Yes | Eligibility for new Activity selection |

One Project belongs to one Partner and has many Activities. Referenced Projects
are not hard-deleted.

## Type d'Opération

Stable identifier, label, and active state. The value catalog remains client
input and is not defined here.

## Activité

| Field | Required | Meaning |
| --- | --- | --- |
| Stable identifier | Yes | Immutable Activity identity |
| Partner identifier | Yes | Parent Partner, consistent with Project |
| Project identifier | Yes | Parent Project |
| Name | Yes | Activity name |
| Description | Yes | Planned business description |
| Start/end dates | Yes | Inclusive Activity period |
| Draft authorized amount | Yes | Current editable proposal |
| First submitted amount | After first submission | Amount in revision 1 |
| Latest validated amount | After validation | Amount in latest final-validated revision |
| Validation status | Yes | Workflow state |
| Explicit cancellation | Yes | Terminal cancellation fact |
| Creator | Yes | Creating identity |
| Primary Agent | Yes | Current coordination assignment |
| Version | Yes | Optimistic-lock value |
| Created/updated timestamps | Yes | Record metadata |

Execution state and financial completeness are derived, not freely edited.

## Opération

| Field | Required | Meaning |
| --- | --- | --- |
| Stable identifier | Yes | Immutable Opération identity |
| Activity identifier | Yes | Parent Activity |
| Name | Yes | Opération name |
| Type identifier | Yes | Active type at creation; preserved historically |
| Authorized amount | Yes | Positive integer XOF amount |
| Spent amount | No | Null until explicitly entered; zero allowed |
| Observation | Conditional | Required when spent differs from authorized |
| Execution status | Yes | À faire, En cours, Terminée, or Annulée |
| Version | Yes | Optimistic-lock value |
| Created/updated metadata | Yes | Actor and timestamps |

An Opération is not hard-deleted after first Activity submission.

## Activity Assignment

Records Activity, Agent, assignment start/end, primary flag, assigning
Validator, reason, and timestamps. At most one current primary Agent exists,
but all current Agents share authorized business capabilities.

## Business Revision

Immutable numbered snapshot containing the complete submitted Activity
structure, Opérations, assignments at submission, submitter, submission time,
contributors, and integrity reference. Revision numbers are unique within one
Activity and never reused.

## Revision Contributor

Links one immutable revision to each identity that created or structurally
modified included data. It exists to enforce separation of duties across role
changes.

## Review Decision

References one Activity revision and records decision type, actor, actor role
snapshot, timestamp, mandatory reason where applicable, requested amount where
applicable, and state before/after. A final decision references the same
revision as its prévalidation.

## Cancellation Request

Records target type and identifier, target revision/version, requester, request
reason/date, state, reviewer, decision reason/date, and withdrawal date. One
pending request exists per target.

## Reopening Request

Records Opération, target version, requester, reason/date, state, reviewer,
decision reason/date, and withdrawal date. One pending request exists per
Opération.

## Audit Event

Immutable identifier, entity, object identifiers, Activity/Opération/revision
references where applicable, actor identity plus name/role snapshots,
timestamp, action, previous/new values, reason, states before/after, target
version, and result. Secrets and raw authentication material are forbidden.

## Operational Export Record

Records export identifier, format, generator, generated-at and as-of times,
filters, relevant scope, successful file metadata or integrity reference, and
audit link. A record is committed only after successful generation.

## Future-module References

Stable object identifiers, revisions, and audit references may later be used
by approved document, accounting, or official-report modules. No future table,
category, journal, account, mapping, or approval field is defined in Phase 0.
