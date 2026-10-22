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

## Approved PTA change — 2026-10-21 (DEC-087)

The user explicitly approved the business rules in
`docs/mjl_codex_authoritative_pta_change_brief.md`. They supersede related
rules in code, tests, the v2 documents, and preservation requirements that
merely describe the former business behavior. Code remains the source of truth
for what is implemented, not a reason to reject the approved changes.

The current task authorizes impact audit and planning, not runtime implementation.
The gap analysis owns findings and unresolved questions; the roadmap owns the
proposed implementation sequence. Existing security and engineering controls
remain unless expressly superseded. The brief preserves the Phase 4 document
security gate. Before implementing any screen, check for an applicable supplied
design inspiration; if absent, stop that screen work and ask the user.

The brief is the canonical business-change overlay until the affected v2
sections are reconciled in their implementation slices. Their conflicting
pre-PTA statements are not active requirements. In particular, do not retain
assignment-based Agent access, independent Activity creation, post-start edit
bans, automatic Activity closure, or mandatory attachments because old tests
or documentation describe them. Unresolved details are not implementation
permission.

## Canonical ownership

| Subject | Canonical document |
| --- | --- |
| REST action inventory and wire contract | `docs/mjl-rest-api-contract.md`, `docs/mjl-rest-api.openapi.yaml` (75/75 inventoried operations implemented; not accepted) |
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
| `docs/architecture-audit/17-target-architecture-proposal.md` | `ARCHITECTURE_FROZEN`; REST destinations through DEC-086 | `e9c31d37a0e46d7dedb3797980fab90bc8ff8f3c02b8af53630162699a87a19b` |
| `docs/mjl-engineering-standard-v1.md` | `STANDARD_FROZEN`; DEC-066 transaction amendment retained | `03ea3aabcd703242986330cbd238d90b9a1f6bb6a80e377060a9ebabc2553841` |

DEC-083 amends Activity HTTP/presentation destinations for REST while preserving
command and bounded-read ownership. DEC-084 applies the same REST migration to
Opérations, expenses, accounting corrections and exception workflows. DEC-085
applies it to monitoring, audit previews and checked report delivery. DEC-086
applies it to MJL access administration.

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
- The hierarchy is `Partenaire -> Projet -> PTA annuel -> Activités -> Opérations`.
  One Partner has at most one active Project; the Validator creates/closes
  Projects. Each relevant Project/year has one PTA; Activity creation requires
  that PTA and planned-start-year attribution. Create it automatically when an
  Agent first plans an Activity for that Project/year (DEC-089).
  Project closure is blocked while any Activity or required financial step
  remains unfinished (DEC-090).
- All Agents have the same visibility and editing rights across PTAs and
  Activities within the active entity, subject to workflow state. Assignments
  are coordination/notification metadata managed by Supervisor and Validator.
- Per-Activity immutable revisions and two-stage approval remain. Approved
  content can change through formal PTA revision, including after its dates;
  cross-year postponement requires audited transfer. Preserve approved history,
  exact-revision decisions and no-self-validation. Pause execution of the
  affected Activity while its proposed change awaits approval; other approved
  Activities continue normally (DEC-090).
- Default end date is start plus three calendar months for every Partner,
  suggested without overwriting a manually selected end date.
- Planning and realization are distinct modules. Only approved scheduled
  Activities execute. Final Operation spending is explicit exact XOF; missing
  is not zero. The user confirmed that final Operation spending replaces the itemized
  expense approval/reversal ledger. External fund custody is outside MJL scope;
  record only the specified administrative amounts and declarations.
- Décaissement and virement are separate administrative requests, each approved
  by Supervisor then Validator. Requests use actual finalized spending, not the
  whole allocation. Budget insufficiency requires approved PTA revision and a
  distinct financial authorization before décaissement starts. This is a separate
  Agent → Supervisor → Validator request, distinct from décaissement and virement
  (DEC-089). Later exceptions require controlled resolution, never silent budget
  adjustment.
- External virement confirmation and reversement record declared actual amounts
  and dates. Required reversement is `max(0, approved allocation - final spending)`;
  distinguish required and actually returned amounts. No in-app banking or
  redistribution of leftover funds. Agent closes directly only after every
  required settlement check; only closed Activities count as physically realized.
- Annual PTA KPIs use approved revisions, closed-only realized counts/spending,
  non-calculable zero denominators and no silent cap at 100 percent.
- Relance is due 21 calendar days before current end date, for all assigned
  Agents through in-app/PWA and email, with rescheduling and delivery evidence.
- The regenerable Activity Fiche PDF includes planning, decision history and
  settlement reconciliation. Supporting documents are optional; the Phase 4
  guarded-delivery implementation gate remains in force.
- Partner portal identities are Admin-invited, read-only and bound to exactly
  one Partner. Internal roles remain exclusive; no role switching or public
  registration. Full audit-history exports remain Validator/Admin only.
- `Programme` is not a generic entity name; it may remain in a proper name.
- Existing internal role codes and French labels remain. Native Admin implies
  `ADMIN_PLATEFORME`, cannot combine with a business identity and grants no
  business mutation. Preserve entity isolation and guarded document delivery.
- Authentication target remains email/password plus email OTP, with 24-hour
  idle and absolute session limits and no remembered devices. Code supports
  configuration-gated OTP; the last recorded local state has it disabled and
  mail unconfigured. This audit did not recheck runtime configuration. Verify
  actual mail delivery before enablement.
- REST remains the backend foundation. The 75-operation inventory describes
  the implemented pre-PTA scope, not coverage of the newly approved scope.
  Migrated screens require JavaScript. French PDF/XLSX and audited supplemental
  CSV remain supported outputs. No acceptance or production readiness is implied.

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
