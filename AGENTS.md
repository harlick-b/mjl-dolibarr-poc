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
Readiness and the first proposed slice are in the existing roadmap.
These documents do not authorize implementation. The current task permits only
Markdown documentation and repository-owned skill/instruction maintenance.

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

## Git and stopping

Preserve unrelated worktree changes. Do not perform destructive Git/filesystem
operations without explicit authorization. Historical documents remain intact.
Do not deploy, change production configuration or infer later phase permission.
A foundation readiness verdict means only that a separate implementation request
can follow. Stop after the authorized scope.
