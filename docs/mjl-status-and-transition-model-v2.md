# MJL Status and Transition Model v2

## Activity Validation State

| State | Allowed next state | Actor | Guard |
| --- | --- | --- | --- |
| Brouillon | Soumise pour prévalidation | Assigned Agent | At least one Opération; exact budget balance; before start |
| Brouillon | Abandonnée | Assigned Agent | No submitted revision; reason and expected version; any date; end all assignments |
| Abandonnée | Brouillon | Validator | Before start; no current assignments; reason; selected active primary Agent |
| Soumise pour prévalidation | Prévalidée | Supervisor | Current unchanged revision; not a contributor |
| Soumise pour prévalidation | Retournée en correction par le Superviseur | Supervisor | Current revision; mandatory reason; structural correction still possible |
| Retournée en correction par le Superviseur | Soumise pour prévalidation | Assigned Agent | New immutable revision; exact balance; before start |
| Prévalidée | Validée définitivement | Validator | Same current revision; not contributor or prevalidator |
| Prévalidée | Retournée en correction par le Validateur définitif | Validator | Mandatory reason; structural correction still possible |
| Retournée en correction par le Validateur définitif | Soumise pour prévalidation | Assigned Agent | New revision and complete review cycle |
| Validée définitivement | None in RST-006A | None | Structurally terminal |

An unchanged submitted revision may finish review after the start date. A
required structural correction at or after start cannot transition to an
editable state; cancellation and recreation are required.

Every returned Activity must contain a structural change before resubmission.
A Supervisor return preserves the prior total. A Validator return preserves it
unless an advisory requested amount was recorded; in that case any positive,
exactly balanced total is accepted.

## Opération Execution State

| State | Allowed next state | Guard |
| --- | --- | --- |
| À faire | En cours | Activity definitively validated; assigned Agent |
| À faire | Terminée | Explicit spent amount; observation if different |
| À faire | Annulée | Approved current-version cancellation request |
| En cours | Terminée | Explicit spent amount; observation if different |
| En cours | Annulée | Approved current-version cancellation request |
| Terminée | En cours | Approved current-version reopening request |
| Annulée | None | Terminal in first release |

`Terminée` and `Annulée` Opérations cannot be edited directly.

## Cancellation Request State

| State | Allowed next state | Actor | Guard |
| --- | --- | --- | --- |
| PENDING | APPROVED | Validator | One pending request; current target version matches |
| PENDING | REJECTED | Validator | Mandatory decision reason |
| PENDING | WITHDRAWN | Requester | Decision not yet made |
| APPROVED | None | None | Terminal request record |
| REJECTED | None | None | Terminal request record |
| WITHDRAWN | None | None | Terminal request record |

Approval changes the target only within the same audited transaction.

## Reopening Request State

The request states and concurrency guards match cancellation. Only completed,
non-cancelled Opérations are eligible. Approval returns the Opération to En
cours and recalculates Activity execution status.

## Derived Activity Execution State

Before definitive validation: `Exécution non démarrée`.

After definitive validation, evaluate in order:

1. Annulée when explicitly cancelled.
2. Annulée when all Opérations are cancelled.
3. Terminée when every Opération is terminal and at least one is completed.
4. En retard when an unfinished Opération exists after the inclusive end date.
5. À venir when the start date is in the future.
6. En cours otherwise.

The source of truth is deterministic and uses `Africa/Porto-Novo`.

## Financial Completeness

| Value | Definition |
| --- | --- |
| Non démarrée | No relevant Opération has explicit spent amount |
| Partiellement renseignée | Some but not all relevant Opérations have explicit spent amount |
| Complète | Every relevant Opération has explicit spent amount |

Cancellation never supplies a missing amount and never implies completeness.

## Version and Audit Rules

- Every structural edit, execution edit, assignment change, review, request,
  and decision verifies the expected version.
- Stale actions change no business or audit data.
- Mutation and audit event share one transaction.
- Date-driven derived-state transitions produce one idempotent event.
- Revision, validation, execution, request, and completeness states remain
  separate concepts.

## Phase 4 Document Series and Lifecycle Events

| Effective state/event | Allowed next event | Actor | Guard |
| --- | --- | --- | --- |
| None | `PUBLISHED` | Authorized Agent or Validator | Parent context authorized; workflow unlocked; validation and scan pass |
| Current version | `PUBLISHED` plus prior-version `SUPERSEDED` | Authorized Agent or Validator | One transaction; expected series version matches |
| Current version | `WITHDRAWN` | Authorized uploader scope or Validator | Mandatory reason; Validator cannot withdraw Agent evidence; no physical delete |
| Superseded or withdrawn version | None | None | Immutable historical evidence; reasoned recovery view only |

A series may have many versions but ordered append-only lifecycle events derive
at most one current version. Version numbers and per-series event sequences are
append-only and never reused. The lifecycle event and audit event commit in the
same transaction. A per-series lock or optimistic version returns a retryable
conflict to a concurrent loser. Any current-state projection is rebuildable,
not authoritative version metadata. Submission snapshots the qualifying
version identifiers and complete selected Category Rule Revision payloads.
Snapshot versions never change even when a later version or rule is appended,
superseded, or withdrawn.

Evidence is immutable during submitted or prevalidated review. Activité
evidence is locked from definitive validation. Post-validation Opération
evidence remains open until the Opération becomes terminal; an approved
reopening unlocks only future append operations. It never makes an old version
mutable. Stale, cross-entity, cross-parent, or locked mutations
fail without changing files, metadata, ECM linkage, quota, or audit.
