# MJL Authoritative Decisions

This file is the highest-level MJL authority router after the post-cadrage
Phase 0 reset. It supersedes the former POC-era authority model.

## Authority Order

Use this order for MJL work:

1. Direct user instruction in the current task.
2. This authority router.
3. The canonical v2 documents listed below, each for its assigned subject.
4. The approved v3 design package for visual presentation only.
5. The current-vs-target gap analysis.
6. The current application functional map as current-state evidence only.
7. Existing implementation code and tests as current-state evidence only.
8. Historical prompts, plans, reports, and POC notes.

If canonical v2 documents contradict one another, stop. Do not conceal the
contradiction by choosing an implicit precedence rule.

## Canonical v2 Ownership

| Subject | Canonical document |
| --- | --- |
| Complete business rules | `docs/mjl-functional-specification-v2.md` |
| Decision provenance and status | `docs/mjl-decision-register-v2.md` |
| Core, excluded, and gated scope | `docs/mjl-scope-boundary-v2.md` |
| Visibility and permitted actions | `docs/mjl-permission-matrix-v2.md` |
| States, transitions, and guards | `docs/mjl-status-and-transition-model-v2.md` |
| Target entities, fields, and invariants | `docs/mjl-data-dictionary-v2.md` |
| Proposed reset actions and approvals | `docs/mjl-reset-manifest-v2.md` |
| Phase dependencies and stop conditions | `docs/mjl-implementation-roadmap-v2.md` |

`docs/mjl-phase-0-audit-report.md` is evidence, not a target-decision source.

## Post-cadrage Decisions

- The application is not live. Backward compatibility is not required.
- All existing local sample/demo data must be deleted through an approved,
  checksum-scoped clean reset. Existing users, role assignments, Partners,
  Projects, Activities, finance records, logs, and documents are not migrated
  into the target model.
- Exactly one native Dolibarr technical administrator account is preserved.
  Every other existing sample account is deleted rather than migrated.
- No persistent sample/demo dataset is created until all implementation phases
  are complete and a later dataset specification is approved.
- Disposable test-only fixtures are permitted only in isolated tenants and
  must be removed with the tenant. They are not persistent sample data and are
  never business-rule authority.
- The canonical hierarchy is `Partenaire -> Projet -> Activité -> Opérations`.
- RST-003 reference records use activation/deactivation, never application
  hard deletion. A Partenaire deactivation atomically closes its active
  Projects; reactivation does not reopen them. A Project permanently retains
  its original Partenaire and generated technical reference.
- `Programme` is not a generic entity name. It may remain inside a proper name.
- Each user has one effective MJL role.
- Stable role codes remain `AGENT_SAISIE`, `AGENT_VERIFICATEUR`,
  `VALIDATEUR_DEFINITIF`, and `ADMIN_PLATEFORME`.
- `AGENT_VERIFICATEUR` is labeled `Agent superviseur et prévalidateur`.
- Native Dolibarr admin status implies `ADMIN_PLATEFORME` and cannot coexist
  with an active MJL business role.
- Agent visibility is based on current Activity assignment, not Partner scope.
- Supervisors and Validators can view all Activities.
- The Validator is the business superuser. Admin is technical and audit-only,
  except for the approved Phase 4 read-only document exception within the
  runtime active Dolibarr entity (`$conf->entity`). That exception permits
  scoped metadata browsing, guarded download/preview of current documents, and
  reasoned separately audited historical recovery; it grants no document or
  business mutation.
- Submitted business revisions are immutable and review decisions target one
  exact revision.
- Missing financial information is never zero.
- XOF amounts use integer-safe storage.
- Operational outputs require PDF and XLSX. Audited CSV remains supplemental.
- The Phase 4 contextual document strategy is approved, with three explicitly
  accepted residual risks, but implementation remains sequenced after Phases 2
  through 3C. Accounting entries and official Partner reports remain gated by
  later client decisions.
- Phase 4 category rules are append-only immutable revisions. Submitted
  revisions freeze the complete selected rule payload and qualifying evidence.
  Document bytes/metadata are immutable and document status is derived from
  append-only lifecycle events rather than mutable withdrawal fields.
- Phase 3C is not a production-launch authorization.

## Implementation Boundary

MJL-specific code stays outside Dolibarr core. Native third parties, projects,
users, authentication, ECM, and export capabilities may be reused through safe
MJL interfaces.

RST-000, RST-000A, RST-001, RST-002A, RST-003, RST-007A, RST-004, RST-008,
RST-009A, RST-010A, RST-013A, and RST-014A are executed. RST-014A passed its complete
committed-source gate matrix and independent Standards, Spec, and
Security/Isolation reviews on 2026-08-21. RST-013A was separately approved and
executed under DEC-044 on 2026-08-21, including its separately approved
positive-control and serial factory-only amendment; its complete committed-source
gate matrix and final Standards, Spec, and Security/Isolation reviews are clean.
The formal Phase 1 verdict is `PHASE_1_READY_WITH_NOTES`: the only deferred note
is the signed human-only accessibility gate. That verdict did not authorize
Phase 2 or RST-005; RST-005 was subsequently and separately approved for
implementation by DEC-045 on 2026-08-24, only within
`docs/mjl-rst-005-activity-foundation-strategy.md`. Disposable implementation
subsequently proved that MariaDB refuses `RENAME TABLE` while explicit table
locks remain active. The strategy now records an exact temporary insert-guard
amendment; shared execution remains unauthorized until that amendment receives
separate explicit RST-005 approval. The operational `initdb.log` checksum deviation from
the Phase 1 activation was explicitly ratified by DEC-039; it authorizes no
RST-010A or later behavior. See `docs/mjl-phase1-reset-execution-report.md`.
RST-000A's recorded approval-boundary
deviation was ratified through supplemental checksum
`5ecc8e68574358526817051cc4ce4d3322d144775b978e7154f633dfe913a870`.
It deleted the checksum-approved legacy sample rows/files without migration
and preserved native administrator `llx_user.rowid=1`. RST-001 enforces one
effective role and derives `ADMIN_PLATEFORME` from native administrator status
without granting business workflow access. RST-002A removes Partner scope from
runtime authorization, retains its exact empty table until RST-002B, freezes all
legacy Activity mutations, and exposes only a safe read-only reviewer projection.
RST-003 establishes empty guarded Partenaire, Projet, and Type d’Opération
references with Validator-only mutation and no persistent fixtures. RST-007A
adds the single append-only transactional audit foundation. RST-004 removes
the obsolete finance core and the Activity-to-Convention seam. RST-008
retargets invitation and reset credentials to business roles with public
selectors, fragment-only verifiers, hashed storage, transactional use, and
no legacy group or Partner-scope authorization. RST-009A exposes only the
approved Phase 1 role-projected navigation. RST-010A is executed as
containment hardening only and authorizes no document-management behavior.
The future Phase 4 strategy is approved by DEC-041 but cannot be implemented
before its roadmap dependencies and a fresh post-Phase-3C live inventory and
reset-unit review. Every other unexecuted reset-manifest entry remains
`PENDING_APPROVAL` unless its explicit approved-in-review status is stated
above.
DEC-042 narrows the future Admin document exception to the runtime active
Dolibarr entity and fixes the append-only category-rule and document-lifecycle
contracts. It changes no current RST-010A denial behavior.

## Design Authority

`docs/design-system/approved/v3/` remains approved for visual tokens,
components, density, interaction states, responsive behavior, and
accessibility guidance. Product, role, permission, workflow, document, and
export assertions in that package are superseded where they conflict with the
canonical v2 documents.

## Historical Documentation

Historical evidence remains recoverable, but it is not active guidance.
Conflicting documents must be marked non-authoritative in
`docs/mjl-docs-index.md` or updated to the canonical v2 model.
