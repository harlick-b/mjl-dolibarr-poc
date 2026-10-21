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
| REST action inventory and wire contract | `docs/mjl-rest-api-contract.md`, `docs/mjl-rest-api.openapi.yaml` (target coverage; authentication/all reference screens implemented) |
| Complete business rules | `docs/mjl-functional-specification-v2.md` |
| Decision history and provenance | `docs/mjl-decision-register-v2.md` |
| Core, excluded, and gated scope | `docs/mjl-scope-boundary-v2.md` |
| Visibility and permitted actions | `docs/mjl-permission-matrix-v2.md` |
| States, transitions, and guards | `docs/mjl-status-and-transition-model-v2.md` |
| Target entities, fields, and invariants | `docs/mjl-data-dictionary-v2.md` |
| Phase 4 cross-cutting planning and handoff index | `docs/mjl-phase4-contextual-document-management.md` |
| Implementation state and unfinished phases | `docs/mjl-implementation-roadmap-v2.md` |
| Architecture preservation requirements | `docs/architecture-audit/14-preservation-ledger.md` |
| Frozen target architecture boundaries and migration-wave contracts | `docs/architecture-audit/17-target-architecture-proposal.md` |
| Implementation and review rules within the frozen architecture | `docs/mjl-engineering-standard-v1.md` |

## Engineering authorities and implementation state

The architecture and Engineering Standard remain frozen authorities for their
technical contracts. DEC-075 authorizes documentation cleanup only; it changes
no architectural boundary or runtime behavior. Current document fingerprints:

| Authority | Status | SHA-256 |
| --- | --- | --- |
| `docs/architecture-audit/17-target-architecture-proposal.md` | `ARCHITECTURE_FROZEN` | `0adda9f7816d02ce5fc5c5290786d52efe7f74dff0931be4c94034859304f8c7` |
| `docs/mjl-engineering-standard-v1.md` | `STANDARD_FROZEN`; DEC-066 transaction amendment retained | `99f794b60a7f4b7a9981cb520bf3cf362a98df432d1f83f6f4086c540b58d794` |

W0 and W1–W7 are complete. DEC-072 records `MIGRATION_COMPLETE: YES`.
The roadmap owns concise implementation state, the decision register owns
history, and the gap analysis owns unresolved issues. Completed audit snapshots,
readiness reviews, and execution/validation reports are retained in Git history
rather than as active documents. The preservation ledger retains all 35 rules.

DEC-073 records post-migration technical revalidation. Role-based UAT and manual
accessibility sign-off remain outstanding; application acceptance and production
readiness remain unclaimed. DEC-074 and its Phase 4 planning brief are unchanged:
implementation is not authorized and document routes remain deny-all.

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
- Current spending records are accounting entries. Explicit Validateur définitif approval
  makes them immutable, separately from Activity budget validation and Opération
  completion. Corrections require linked reversal/correcting entries preserving
  the original (DEC-076). Self-approval is forbidden. DEC-077 authorizes implementation:
  separate expenses within each Opération; Agent submission; Validator approval
  of linked full reversal/replacement together. Only approved expenses count in spending totals and exports. Completion
  requires all expenses approved, or an approved explicit zero-spending declaration. Authentication fixes come first; mail must be supplied and delivery
  verified before enabling OTP. DEC-078 defines REST API as the backend foundation
  for web/PWA clients, covering all available MJL actions and using login plus
  OTP. Migrate the existing interface progressively as API features are delivered. Migrated screens require JavaScript (DEC-080). DEC-082 authorizes Projets and Types d’Opération migration; OTP remains disabled.
  Scope includes MJL business features and MJL administration; native Dolibarr
  technical administration and external integrations are excluded. Approved session
  limits are 24 hours of inactivity or 24 hours total, whichever comes first;
  either expiry requires login plus email OTP again, with no remembered devices. Overall variance
  explanation is required at completion. Agents assigned immediately before
  entire Activity cancellation retain correction-only access.
- Operational outputs require French-labeled PDF and XLSX; audited CSV is
  supplemental.
- Document business behavior remains behind the current containment boundary.
  Phase 4 planning is requested and owned by
  `docs/mjl-phase4-contextual-document-management.md`; implementation still
  requires separate authorization. Additional Phase 5 accounting structure and
  official Partner reports remain deferred pending user decisions.
- The Phase 4 Admin document exception is read-only and non-mutating in
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
