# MJL Implementation Roadmap v2

## Global Rule

Run one phase at a time. Read every canonical v2 document, verify that its
preconditions and required reset approvals are satisfied, implement only that
phase, report exact results, emit the phase verdict, and stop.

After RST-000, the next destructive gate is one approved clean local purge:
delete all legacy sample data without migration, preserve exactly one native
technical administrator, and replace the legacy bootstrap with a non-seeding
installation/activation path. Phases
then build target structures against an empty persistent tenant. Test suites
may create and destroy isolated test-only fixtures.

RST-000A was checksum-approved, physically executed, and supplementally
ratified on 2026-08-10. The shared tenant contains no persistent
business/sample data and preserves only the native technical administrator.
RST-001 was approved and executed on 2026-08-10. RST-002A was approved and
executed on 2026-08-12. RST-003 was approved and executed on 2026-08-13.
No later reset unit is authorized by that execution.

## Phase 0: Authoritative Audit and Reset Manifest

Deliver canonical v2 documents and current-state evidence. Execute no reset.
Verdict: `PHASE_0_AUDIT_READY`, `PHASE_0_AUDIT_READY_WITH_NOTES`, or
`PHASE_0_AUDIT_BLOCKED`.

Human review and explicit reset approval are required before Phase 1.

## Phase 1: Foundation

Preconditions:

- acceptable Phase 0 verdict;
- explicit approval of each required Phase 1 reset ID;
- no contradiction among canonical v2 documents.

Deliver effective-role enforcement, safe role changes, invitations, accounts,
empty Partner/Project/Opération-type reference structures, stable identifiers,
and transactional append-only audit. Execute only approved reset IDs. Do not
implement Activities or persistent sample data.

Verdict: `PHASE_1_READY`, `PHASE_1_READY_WITH_NOTES`, or `PHASE_1_BLOCKED`.

## Phase 2: Activity Planning and Validation

Preconditions: approved Phase 1, effective roles/reference data, and
transactional audit.

Deliver Activities, Opérations planning, assignments, dedicated creation,
balanced budgets, immutable revisions, correction cycles, prévalidation,
definitive validation, separation of duties, structural freeze, chronology,
and optimistic locking. Do not implement execution editing.

Verdict: `PHASE_2_READY`, `PHASE_2_READY_WITH_NOTES`, or `PHASE_2_BLOCKED`.

## Phase 3A: Execution and Exception Workflows

Preconditions: approved Phase 2 and revision-linked validation.

Deliver spent amounts, observations, Opération lifecycle, cancellation and
reopening requests, Activity cancellation, derived execution status,
reconciliation, completeness, concurrency, audit, and tests.

Verdict: `PHASE_3A_READY`, `PHASE_3A_READY_WITH_NOTES`, or
`PHASE_3A_BLOCKED`.

## Phase 3B: Audit, Dashboards, and Operational Outputs

Preconditions: approved Phase 3A and stable audit/execution models.

Deliver human-readable chronology, audit search, dashboards, monitoring,
notifications, required PDF/XLSX outputs, supplemental audited CSV, browsing,
accessibility, and bounded performance.

Official Partner labeling remains forbidden.

Verdict: `PHASE_3B_READY`, `PHASE_3B_READY_WITH_NOTES`, or
`PHASE_3B_BLOCKED`.

## Phase 3C: Core Hardening and Integration Readiness

Preconditions: approved Phases 1, 2, 3A, and 3B.

Harden authorization, data integrity, concurrency, scheduled jobs, empty-state
operation, disposable test-fixture isolation,
backup/restore, configuration, security, performance, accessibility, errors,
and regression coverage. Produce a client-owned decision matrix for Phases
4-6.

Verdict: `CORE_SCOPE_READY_FOR_INTEGRATION`,
`CORE_SCOPE_READY_WITH_NOTES`, or `CORE_SCOPE_BLOCKED`.

Every verdict includes: `This verdict does not authorize production launch.`

## Phase 4: Documents

The strategy is approved by DEC-041 but implementation remains blocked by
sequence until Phases 2 through 3C provide stable Activity, Opération,
revision, assignment, audit, and job interfaces. After Phase 3C, perform a
fresh live inventory and a separately reviewed Phase 4 reset/implementation
unit. Never reuse the legacy POC document implementation.

Deliver the contextual model, permissions, requirement snapshots, immutable
series/versions, validation and scanning, encrypted storage, native ECM
adapter, guarded downloads, isolated preview origin, lifecycle locks,
reconciliation, audit, quota/rate limits, and the verification gates defined
in the canonical v2 documents. Rollback returns to RST-010A containment.

Production activation remains blocked on preview-origin TLS, scanner and
signature operations, encryption-key escrow, encrypted backup restoration,
storage monitoring, and legal retention confirmation.

## Phase 5: Accounting

Blocked until approved accounting structure, classifications, roles,
validation, correction/reversal, reconciliation, dependencies, and real
examples exist. Never infer accounting entries from spent amounts.

## Phase 6: Official Partner Reports

Blocked until approved Partner templates, mappings, periods, dependencies,
formulas, output requirements, versioning, and approval behavior exist.
Official outputs become immutable snapshots.

## Rollback Boundaries

Create a reviewed stable commit after each phase only when the user authorizes
the git workflow. Database/document backups precede every approved destructive
phase. A phase verdict never authorizes the next phase automatically.

## Go-live Decision

After Phase 3C, the client and project owner decide which gated phases are
mandatory before launch. Production deployment remains outside every Codex
verdict.

## Post-implementation Persistent Sample Dataset Gate

No persistent sample/demo dataset may be designed or loaded during Phases 1-6.
After every implementation phase is complete, a separately reviewed dataset
specification may define new records from the final business rules. Legacy POC
data cannot be copied, mapped, or used to justify that specification.
