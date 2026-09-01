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

RST-014A was separately approved on 2026-08-19 and executed after complete
committed-source verification and independent clean reviews on 2026-08-21.
RST-013A was separately approved and executed by DEC-044 on 2026-08-21 after
its complete committed-source gate matrix and final independent Standards,
Spec, and Security/Isolation reviews passed. RST-014A and RST-013A retain
separate rollback and approval boundaries.

Verdict: `PHASE_1_READY_WITH_NOTES` on 2026-08-21. The signed human-only
accessibility gate remains deferred. This verdict does not authorize Phase 2
or RST-005, which requires a separately reviewed and explicitly approved
strategy.

RST-005 was separately approved by DEC-045, confidence-hardened by DEC-046,
and executed under DEC-047 on 2026-09-01 after clean committed-source gates,
final reviews, and exact approval of commit
`b9520f5aaf38629d13618034cce546e71637ebab` with protected-tree digest
`a01bfd02d6e0bff4c1039f5f191233bfa5fe9cbc170c715f640737d75403f40f`.
The shared tenant now has the verified-empty finalized target Activity
foundation. RST-002B is the next dependency; RST-006A follows it. Both remain
separately reviewable and separately approval-gated, and no other Phase 2 unit
is authorized by RST-005 execution.

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
series/versions, append-only category-rule revisions and document-lifecycle
events, validation and scanning, encrypted storage, native ECM
adapter, guarded downloads, isolated preview origin, lifecycle locks,
reconciliation, audit, quota/rate limits, and the verification gates defined
in the canonical v2 documents. Admin read/recovery is limited to the runtime
active Dolibarr entity. Rollback returns to RST-010A containment.

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
