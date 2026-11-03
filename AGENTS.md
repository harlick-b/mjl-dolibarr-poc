# Agent Instructions

Canonical repository instructions. The user's latest explicit request takes
precedence over recorded decisions, plans, tests and skill procedures.

## Authority and scope

Read `docs/mjl-authoritative-decisions.md` first, then only the canonical sources
relevant to the task. The approved PTA brief and DEC-087–090 govern business
rules. Code and passing tests are implementation evidence, never acceptance.

MJL is being rebuilt as a dedicated React/Vite JavaScript/JSX application with
TanStack Router/Query, Tailwind/shadcn/ui/Lucide, FastAPI REST, PostgreSQL,
SQLAlchemy 2 and Alembic. The PWA is installable with online-only business
operations. Docker Compose is the development direction; frontend and backend
will deploy separately. Provider and region are unapproved.

The proposed technical standard is
`docs/rebuild/02-target-architecture-and-engineering-standard.md`;
`docs/rebuild/03-security-compliance-baseline.md` owns security requirements.
The authority/business/API disposition register is
`docs/rebuild/01-authority-and-business-baseline.md`.
The current implementation boundary and evidence are in
`docs/mjl-implementation-roadmap-v2.md`; decision history belongs to the authority
router. Foundation, A1–A3 and the synthetic PTA slices through PTA-7A are
complete. DEC-121 governs current whole-PTA physical and financial
metrics. DEC-122 adds the regenerable French Activity Fiche PDF from approved
planning, execution, settlement and chronology facts. DEC-123 completes Project
closure: a Validator may close an empty Project or one containing only terminal
`closed` or `withdrawn` Activities; every unfinished Activity remains a blocker.
PTA-4B and PTA-4C add no migration.
DEC-124 adds one durable 21-day reminder cycle per assigned Agent and approved
Activity end date, one synthetic email attempt, recipient-only notification APIs
and the sidebar notification centre. Migration `0016_pta5` adds one table.
DEC-125 adds optional append-only PDF/JPEG/PNG evidence to an Activity in the
isolated synthetic environment. Agents and Validators upload; internal business
roles list and download through fresh authorization. Migration `0017_pta6a` adds
one table and three REST responsibilities.
DEC-126 adds a sanitized, newest-first global audit chronology for Validators
and Admins. It reuses the append-only audit table, adds one read responsibility
and one screen, and adds no migration or export.
DEC-127 adds an audited, exact-snapshot CSV export of that sanitized chronology
for Validators and Admins. It adds one POST responsibility and one existing-screen
action with no migration, table, stored artifact, job or reporting framework.
DEC-128 adds a freshly authorized and audited inline preview for stored JPEG/PNG
Activity evidence. The existing Activity panel loads protected bytes through the
shared REST client into a bounded modal. PDF remains download-only. It adds one
GET responsibility with no migration, table, converter or thumbnail service.
DEC-129 settles the intended PC1/PC2 product policy, exact unsplit reversement,
validated zero-spending path, limited Activity-document scope, Partner portal
projection, no-reopening rule and first annual CSV boundary. External
RSSI/mail/hosting acceptance remains pending; use synthetic identities, isolated
databases and test mail only. DEC-130 implements the validated zero-spending
closure path with migration `0018_pta7a`, two focused tables and the existing
execution workspace. DEC-131 implements reasoned Activity attachment withdrawal
and optional linked correction with migration `0019_pta7b`, one focused table and
the existing Activity panel/Fiche. Stop after PTA-7B.
Technical Admin recovery, reinvitation, reverse transfer, restoration,
insufficiency implementation, historical metrics,
the approved current-PTA CSV, PDF/XLSX global audit exports,
PDF preview and document restoration/general versioning,
Partner portal implementation and Partner attachment visibility,
production document storage/scanning/retention,
browser push, real mail and production scheduling, banking integration, later
slices, general A4 and production remain deferred.

When the user explicitly authorizes a slice, derive the smallest complete implementation from its authoritative readiness document, implement and verify it, then stop. Do not request a separate detailed implementation prompt unless essential information is missing or contradictory. Do not infer authorization for the next slice.

## Planning with minimal overhead

- No externally written implementation prompt is required. Derive the next plan
  from approved business rules and actual code; ask only about unresolved business
  choices, contradictory requirements or missing external inputs. A short user
  authorization is sufficient once the slice is concrete. Keep explicit stop rules.
- Maintain one concise contract per new slice: user-visible outcome/exclusions,
  changed API/data/UI seams, genuine decisions/dependencies, checks with expected
  results, and the mandatory independent review handoff below. Extend an existing
  readiness document when sufficient; add a separate plan only when it materially
  helps execution. Link settled standards instead of restating them. Do not require
  a closure/recheck document or a second authorization for routine technical fixes.
- Describe invariants before prescribing table/endpoint counts. Prefer existing
  seams, but justify added representation or abstraction by a current need and
  total implementation cost. Explicit slice limits remain binding. No generic
  workflow framework or broad cleanup project follows from a complexity concern.
- Map checks to changed behavior and risks, reuse existing coverage, and test
  interactions with adjacent workflows. Run focused checks while iterating; run a
  broad regression when required or justified by shared changes. After a fix,
  rerun affected checks, widening only for changed dependencies or unresolved risk.
  Never waive a mandatory gate or relabel older evidence as a final-candidate run.
- Record the tested source/artifact and actual command/results together. Keep
  migration compatibility evidence tied to that candidate. Measure slow setup
  before optimizing fixtures; retain disposable isolation and real database tests.
- At completion, update the current roadmap once and link detailed evidence.
  Mark old authorization/status prose as historical without rewriting its contract.
  Read only task-relevant lessons; legacy-specific rules are not rebuild mandates.

## Legacy workspace

The existing Dolibarr 23.0.2/MariaDB 11 POC remains a behavioral reference and
has never been deployed to production. Preserve it, its data and frozen
architecture/Engineering Standard as historical evidence. Do not edit Dolibarr
core. Its custom-module location, bootstrap, native sessions, database adapter,
lifecycle and PHP presentation rules govern legacy maintenance only.

Existing `docker compose up -d`, `http://127.0.0.1:8080/`, `package.json` scripts
and `docs/mjl-acceptance-tests.md` belong to that POC. They are not new-stack
commands. New frontend/backend directories and configuration require separate
implementation authorization. Do not migrate sample data or native accounts;
a future first-admin bootstrap must be guarded and non-seeding.

## Engineering and security

- Implement only the authorized slice. Before edits map each mechanism to a
  current requirement or concrete security/data-integrity risk. Prefer the
  smallest existing seam; remove speculative abstractions. Reassess immediately
  if scope grows and after an hour of active implementation.
- No generic workflow engine, event bus, repository framework, microservices,
  offline database, mutation queue or speculative infrastructure.
- Router owns navigation/search; Query owns server state; React state owns
  temporary UI/forms. Use JavaScript/JSX; TypeScript is not a prerequisite.
- FastAPI routes validate and authorize; use cases own transactions, current
  state checks and atomic audit. Persistence helpers never silently commit.
- Preserve exact XOF, French-first content, immutable approved revisions,
  no-self-validation and server-side role/resource isolation. Assignments are
  coordination metadata, not Agent access restrictions. No multi-tenant SaaS
  assumption or in-app banking/reallocation of unused funds.
- Access is Admin-invited, email/password plus email OTP, with 24-hour idle and
  absolute limits, no remembered devices or public registration. Admin has no
  business mutation; Partner identities are read-only and single-Partner scoped.
- Keep API/documents/exports authorized on the server. Phase 4 remains separately
  gated; legacy document routes remain deny-all. Documents are optional evidence.
- No persistent demo data, hard-coded credentials or committed secrets. Tests
  use minimal disposable data and teardown; never mutate a shared tenant for tests.

## Design and verification

For every authorized rebuild page and related API implementation, apply the
approved UI/API standard (DEC-102) in
`docs/rebuild/02-target-architecture-and-engineering-standard.md`, including its
shared display/pagination helper contracts. This covers cursor lists (default 60,
max 100, invalid limits 422), the list envelope, RestClient/Provider/useAPI,
Query integration, Sonner, localization, Helmet and cookie/CSRF safeguards.
Verify the applicable rules in the slice's focused checks. Reuse shared helpers;
do not copy the illustrative snippets without their documented corrections.
This standing requirement does not authorize new pages or a standalone runtime
migration; implement only the separately authorized slice.

For touched visual surfaces read `DESIGN.md`, the design-system index and
relevant approved v3 tokens/inspiration. Their product assertions cannot override
business authority. Missing inspiration blocks that product screen, not unrelated
backend work. The foundation shell is a technical smoke surface, not a new design.

Choose the smallest check that verifies the change. Documentation-only work uses
`git status`, `git diff --stat`, `git diff`, `git diff --check`, plus direct review
of new files. Report skipped checks and why. Do not run broad historical suites,
benchmarks or production audits without an explicit request. Future React UI/API
journeys use focused Playwright; domain rules use Vitest/pytest as appropriate;
transactions and constraints use disposable PostgreSQL. Never claim acceptance,
compliance or production readiness from passing development checks.

## Skills and collaboration

Use repository skills from `skills/<name>/SKILL.md`; global skills are read-only.
Route architecture to `codebase-design`, unclear product decisions to
`grill-with-docs`, domain changes to `domain-modeling`, bugs to `diagnosing-bugs`,
behavioral implementation to `tdd`, throwaway exploration to `prototype`, skill
maintenance to `writing-great-skills`, and substantial reviews to `code-review`.
Use local `design-system-guardian`, `security-baseline-review` and
`confidence-review-loop` for their named concerns. Skill procedures cannot expand
scope, require runtime work for a documentation audit or imply implementation
approval. Do not create per-library skills.

Use subagents only when explicitly requested or for independent audits. Return
findings, evidence, risk and focused fixes; consolidate before edits. At the end
of meaningful work evaluate `tasks/lessons.md`; add only repeated corrections or
durable discoveries. Legacy-specific lessons remain legacy-specific.

Every implementation plan must end with a mandatory handoff to a separate agent
that did not implement the changes. That agent leads a review-only phase and must
not modify implementation files or fix its own findings. It independently inspects
the governing requirements, actual diff, relevant surrounding code and verification
evidence, treating implementer explanations and passing-test claims as unverified.
It reports gaps, bugs, regressions and security weaknesses with severity, file/line
evidence, impact and the smallest correction, including missing verification.

The implementation agent fixes accepted findings, then returns the candidate to
the same independent reviewer for focused re-review. Do not declare completion
until blocking findings and mandatory verification gaps are resolved. If no
separate reviewer is available, report the review gate as blocked rather than
substituting self-review. Include this handoff/correction/re-review cycle in every
future implementation plan. Independent review is not acceptance, production
readiness or authorization for another slice.

## Git and stopping

Preserve unrelated worktree changes. Do not perform destructive Git/filesystem
operations without explicit authorization. Historical documents remain intact.
Do not deploy, change production configuration or infer later phase permission.
A foundation readiness verdict means only that a separate implementation request
can follow. Stop after the authorized scope.
