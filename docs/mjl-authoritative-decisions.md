# MJL Authoritative Decisions

This file routes current MJL authority. Development is unfinished. Recorded
implementation, verification, readiness, and approval states are evidence only
and never imply current user acceptance.

## Authority order

1. The user's latest explicit instruction.
2. This authority router.
3. The canonical documents below for their assigned subjects.
4. Approved v3 design guidance for visual presentation only.
5. Gap analysis and current-state evidence.
6. Existing code and tests as current-state evidence only.

The latest user instruction supersedes every conflicting earlier project
decision, approval, plan, report, test convention, and skill procedure. Update
conflicting active guidance instead of applying an older rule. If canonical
documents still contradict each other after applying the latest instruction,
stop and surface the contradiction.

## Canonical ownership

| Subject | Canonical document |
| --- | --- |
| Complete business rules | `docs/mjl-functional-specification-v2.md` |
| Decision history and provenance | `docs/mjl-decision-register-v2.md` |
| Core, excluded, and gated scope | `docs/mjl-scope-boundary-v2.md` |
| Visibility and permitted actions | `docs/mjl-permission-matrix-v2.md` |
| States, transitions, and guards | `docs/mjl-status-and-transition-model-v2.md` |
| Target entities, fields, and invariants | `docs/mjl-data-dictionary-v2.md` |
| Implementation state and unfinished phases | `docs/mjl-implementation-roadmap-v2.md` |
| Frozen target architecture boundaries and migration-wave contracts | `docs/architecture-audit/17-target-architecture-proposal.md` |

## Review candidates

The following document is discoverable for review but is not yet canonical and
authorizes no implementation:

| Candidate | Review evidence | Status |
| --- | --- | --- |
| `docs/mjl-engineering-standard-v1.md` | `docs/mjl-engineering-standard-v1-review.md`; three findings resolved and focused re-review passed | `STANDARD_READY_FOR_REVIEW`; not frozen; W0 and W1–W7 remain `NOT_AUTHORIZED` |

Completed plans and reports are recoverable from Git history and are not active
guidance. `docs/mjl-current-app-functional-map.md` records current-state
evidence only. Unresolved weaknesses and unapproved recommendations belong in
`docs/mjl-current-vs-target-gap-analysis.md`.

## Current product decisions

- The application is under development and nothing is accepted by default.
- No phase, passing test, verdict, or registered approval authorizes later work.
- Production preparation and production-readiness assessment are deferred until
  the user explicitly requests them.
- The application is not live. Existing local sample data is not migrated.
- Preserve exactly one native Dolibarr technical administrator in the empty
  development tenant.
- Create no persistent sample/demo dataset until the user approves one. Tests
  may create minimal records only in isolated disposable tenants and must tear
  them down.
- The canonical hierarchy is `Partenaire -> Projet -> Activité -> Opérations`.
- `Programme` is not a generic entity name; it may remain in a proper name.
- Each user has one effective role. Stable codes are `AGENT_SAISIE`,
  `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`, and `ADMIN_PLATEFORME`.
- `AGENT_VERIFICATEUR` is labeled `Agent superviseur et prévalidateur`.
- Native Dolibarr admin implies `ADMIN_PLATEFORME`, cannot coexist with an
  active MJL business role, and grants no business workflow mutation.
- Agent visibility follows current Activity assignment. Supervisors and
  Validators can view all Activities.
- Only Admin can send invitations for now; no public registration route exists.
- Submitted business revisions are immutable and review decisions target one
  exact revision. Self-validation remains forbidden.
- Missing financial information is never zero. XOF amounts use integer-safe
  storage.
- Operational outputs require French-labeled PDF and XLSX; audited CSV is
  supplemental.
- Document business behavior remains behind the current containment boundary.
  Phase 4 requires a fresh user request. Accounting and official Partner
  reports remain deferred pending user decisions.
- The future Phase 4 Admin document exception is read-only and non-mutating in
  the runtime active Dolibarr entity (`$conf->entity`) only.

## Implementation boundary

MJL-specific code stays outside Dolibarr core. Native Dolibarr capabilities may
be reused through guarded MJL interfaces. The roadmap records which phases are
implemented; that status does not establish acceptance.

Over-engineering is banned. Remove obsolete mechanisms and their stale
callers together; historical references do not justify keeping them. Use the
smallest implementation that satisfies the current request and a concrete
authorization, security, or data-integrity risk. Check scope before
editing and when new work appears. Record useful optional work as an unapproved
recommendation rather than implementing it.

## Design authority

The approved v3 design package is authority for visual presentation only.
`docs/design-system/approved/v3/` owns visual tokens, components, density,
interaction states, responsive behavior, and accessibility guidance. Product,
role, permission, workflow, document, and export assertions are superseded by
the canonical documents when they conflict.
