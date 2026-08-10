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
- `Programme` is not a generic entity name. It may remain inside a proper name.
- Each user has one effective MJL role.
- Stable role codes remain `AGENT_SAISIE`, `AGENT_VERIFICATEUR`,
  `VALIDATEUR_DEFINITIF`, and `ADMIN_PLATEFORME`.
- `AGENT_VERIFICATEUR` is labeled `Agent superviseur et prévalidateur`.
- Native Dolibarr admin status implies `ADMIN_PLATEFORME` and cannot coexist
  with an active MJL business role.
- Agent visibility is based on current Activity assignment, not Partner scope.
- Supervisors and Validators can view all Activities.
- The Validator is the business superuser. Admin is technical and audit-only.
- Submitted business revisions are immutable and review decisions target one
  exact revision.
- Missing financial information is never zero.
- XOF amounts use integer-safe storage.
- Operational outputs require PDF and XLSX. Audited CSV remains supplemental.
- Document management, accounting entries, and official Partner reports remain
  gated by later client decisions.
- Phase 3C is not a production-launch authorization.

## Implementation Boundary

MJL-specific code stays outside Dolibarr core. Native third parties, projects,
users, authentication, ECM, and export capabilities may be reused through safe
MJL interfaces.

RST-000 and RST-000A are executed. RST-000A's recorded approval-boundary
deviation was ratified through supplemental checksum
`5ecc8e68574358526817051cc4ce4d3322d144775b978e7154f633dfe913a870`.
It deleted the checksum-approved legacy sample rows/files without migration
and preserved native administrator `llx_user.rowid=1`. Every other
reset-manifest entry remains `PENDING_APPROVAL`.

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
