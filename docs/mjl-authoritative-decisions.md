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

## A3 security decisions approved (DEC-101)

The user explicitly approves preserving unexpired recovery proofs without resend
or expiry extension, including waiting after failed initial delivery, and one
best-effort post-reset notification. Link possession authorizes password definition;
fresh password-plus-email-OTP login remains mandatory. Scope is ordinary synthetic
accounts only; all technical Admin recovery is deferred without bootstrap changes
or a bypass. [Readiness 07](rebuild/07-a3-password-recovery-readiness.md) is now
**A3_READY_FOR_AUTHORIZATION**, superseding DEC-100's pending-decision verdict.
Finite recovery lifetime/direct-request limits or explicit synthetic-fixture
permission remain required before affected implementation. This approval does not
authorize implementation. PC1/PC2 remain pending; real accounts remain prohibited.

## A2.2 implementation authorization (DEC-099)

The user authorizes restricted A2.2 only under readiness 06 at `6659a05`: ordinary
synthetic role changes/deactivation, one PATCH and minimal existing Admin UI,
no new tables/migrations. Provenance, per-mutation fail-closed schema eligibility,
login advisory ordering and deterministic race/invalidation checks are mandatory
before mutation enablement. Complete all sixteen gates, update status, commit,
and stop. No assigned/responsible accounts, handoff, R8/Admin lifecycle, A3/A4/PTA
or real accounts. PC1/PC2 remain pending. The roadmap owns completion evidence.

## Restricted A2.2 scope and readiness (DEC-098)

The user approves synthetic ordinary-account role changes and deactivation only
when no Activity assignments or outstanding workflow responsibilities exist.
[Readiness 06](rebuild/06-a2-account-lifecycle-readiness.md) records the fail-closed
auth-only eligibility boundary, mandatory login lock correction and pre-mutation
verification gates. **A2_2_READY_FOR_AUTHORIZATION** applies only to this scope.
That scope recheck was documentation-only; DEC-099 now authorizes its implementation.
Assigned/responsible accounts, handoff, inactive reinvitation, Admin lifecycle,
A3/A4/PTA and real accounts remain deferred/prohibited. PC1/PC2 remain pending.
DEC-097's earlier unapproved-scope verdict is superseded by this restricted approval.

## A2.1 implementation authorization (DEC-096)

The user authorizes A2.1 from readiness 05 at `2c1929e`: five access APIs,
two existing-table extensions, ordinary-role A1 authentication, one Admin view
and all sixteen acceptance gates. Synthetic identities and isolated test mail
only. PC1/PC2 remain pending; no A2.2/A3/A4/PTA or real accounts. Implement,
verify, update status, commit and stop after A2.1.

## A2 account-management readiness (DEC-095)

The earlier request authorized documentation-only A2 readiness after A1 commit
`0a2cf22`. [Readiness 05](rebuild/05-a2-account-management-readiness.md) owns the
proposed ordinary-account invitation/listing slice and deferred lifecycle gates.
No A2 implementation, tests, schema/data, dependencies, Docker/CI or skills changes
are authorized. PC1/PC2 remain pending; real accounts, A3/A4/PTA and production
remain unauthorized. Supplied users inspiration governs composition, not privileges.

## A1 implementation authorization (DEC-094)

The A1 user request authorized the exact seven A1 API and six persistence
responsibilities and T01–T18 in readiness 04, following commits 48c2bea/6007159.
Only synthetic identities, isolated PostgreSQL and test mail are authorized.
PC1/PC2 remain pending sponsor/RSSI approval. Real-account enablement must fail
closed; no A2/A3/A4, recovery, PTA, production mail/deployment or POC changes.
Updated local inspiration supplies visual composition, not extra feature scope.

## Authentication & Access readiness (DEC-093)

The earlier auth request authorized documentation-only readiness review after foundation
`48c2bea`. [Readiness contract](rebuild/04-authentication-access-readiness.md) owns
the bounded proposed first-Admin invitation-to-session slice, policy stage gates
and future test oracles. Auth inspiration is supplied in `docs/inspiration/auth/`.
Readiness is not implementation authorization: no auth/user/schema/test/dependency,
Docker, skill or deployment changes. Confirmed rules remain authoritative;
historical numeric settings are clearly distinguished from approved policy.

## First foundation implementation authorization (DEC-092)

The user explicitly authorized the first technical React/FastAPI/PostgreSQL
slice following audit commit `3e7443d`. Scope: two frontend routes (`/`, `/health`),
PWA static assets only, health endpoints `/api/health/live` and `/api/health/ready`,
PostgreSQL connectivity, SQLAlchemy session lifecycle, empty Alembic bookkeeping,
quality tools/tests, separate Docker services and minimal CI/development docs.
This supersedes DEC-091's documentation-only stop for this slice only. Proposed
future authentication/financial mechanisms are not thereby approved or implemented.
No users, business tables/data, auth, PTA, documents or production deployment.
Keep POC files, tests, databases and Docker resources unchanged. Use an explicitly
named rebuild Compose file so default POC startup remains unchanged. The first
technical slice is implemented and its mandatory gates passed (see roadmap).
This authorizes no next slice and records no application acceptance.

## Dedicated application rebuild — 2026-10-22 (DEC-091)

The rebuild instruction selects React/Vite JavaScript/JSX, TanStack
Router/Query, Tailwind/shadcn/ui/Lucide, FastAPI REST/OpenAPI, PostgreSQL,
SQLAlchemy 2/Alembic and Docker Compose. PWA business operations are online-only.
Frontend/backend deploy separately; commercial cloud provider/region are unapproved.
This authorizes documentation and repository-owned skill maintenance only.

The new technical proposal is `docs/rebuild/02-target-architecture-and-engineering-standard.md`;
security requirements are consolidated in `docs/rebuild/03-security-compliance-baseline.md`.
Both remain proposals for review, not evidence of conformity or permission to build.
`docs/rebuild/01-authority-and-business-baseline.md` classifies business contracts,
all 35 migration preservation rules and all 75 existing API operations.
The roadmap owns the first foundation slice/readiness; the gap analysis owns
remaining decisions. No implementation, production work, Phase 4 activation,
POC removal or migration of old accounts/data is authorized.

The frozen Dolibarr architecture and Engineering Standard v1 remain historical
engineering evidence, byte-identical. Their custom-module, PHP/bootstrap,
native-session, MariaDB/lifecycle, ERP-object and delivery requirements are
superseded for the new rebuild, not retroactively unapproved. Existing POC
commands, source paths and test matrices describe legacy maintenance only.
Approved business, contractual/security and v3 visual requirements survive
according to the disposition register. The old 35 rules are not copied wholesale.
Phase 4's complex document series/ECM/preview design and accepted risks are not
automatically transferred: target optional private PDF/image evidence only,
with separately approved file-security and retention decisions.

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
| Legacy REST action inventory and wire contract (behavioral evidence) | `docs/mjl-rest-api-contract.md`, `docs/mjl-rest-api.openapi.yaml` (75/75 inventoried operations implemented; not accepted) |
| Complete business rules | `docs/mjl-functional-specification-v2.md` |
| Decision history and provenance | `docs/mjl-decision-register-v2.md` |
| Core, excluded, and gated scope | `docs/mjl-scope-boundary-v2.md` |
| Visibility and permitted actions | `docs/mjl-permission-matrix-v2.md` |
| States, transitions, and guards | `docs/mjl-status-and-transition-model-v2.md` |
| Target entities, fields, and invariants | `docs/mjl-data-dictionary-v2.md` |
| Phase 4 cross-cutting planning and handoff index | `docs/mjl-phase4-contextual-document-management.md` |
| Implementation state and unfinished phases | `docs/mjl-implementation-roadmap-v2.md` |
| Historical architecture preservation requirements | `docs/architecture-audit/14-preservation-ledger.md` |
| Historical frozen Dolibarr architecture and migration-wave contracts | `docs/architecture-audit/17-target-architecture-proposal.md` |
| Historical implementation rules within the frozen Dolibarr architecture | `docs/mjl-engineering-standard-v1.md` |
| New-stack architecture and Engineering Standard proposal | `docs/rebuild/02-target-architecture-and-engineering-standard.md` |
| Consolidated security requirements | `docs/rebuild/03-security-compliance-baseline.md` |
| Rebuild authority/business/API disposition | `docs/rebuild/01-authority-and-business-baseline.md` |

## Historical Dolibarr engineering authority and implementation state

The legacy architecture and Engineering Standard retain their frozen historical
technical contracts; they do not govern the rebuild. DEC-075 authorizes documentation cleanup only; it changes
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
rather than as active documents. The historical preservation ledger retains all 35 rules, classified for rebuild
applicability in document 01.

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
- Preserve the existing POC tenant and its native technical administrator. The
  rebuild starts clean with a separately guarded first-admin bootstrap, not
  migration of native accounts or sample data.
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
- Existing internal role codes and French labels remain. In the POC, native Admin implies
  `ADMIN_PLATEFORME`; the rebuild provisions that technical role independently.
  Admin cannot combine with a business identity and grants no business mutation. Preserve entity isolation and guarded document delivery.
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

The POC remains outside Dolibarr core. Native capabilities are legacy reference
only; the rebuild uses the proposed dedicated frontend/backend boundaries. The roadmap records which phases are
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
