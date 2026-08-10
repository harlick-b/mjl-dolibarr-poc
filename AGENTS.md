# Agent Instructions

This is the canonical in-repo instruction layer for AI agents. If another
AI-facing file conflicts with this file, follow this file.

## Project Overview

MJL Dolibarr is a Dockerized Dolibarr 23.0.2 workspace with MariaDB 11 for
monitoring externally funded Ministry of Justice and Legislation projects.
MJL-specific work must stay in the custom module or documented safe supporting
areas; Dolibarr core files must never be modified.

## MJL Documentation Authority

For MJL work, read `docs/mjl-authoritative-decisions.md` first.

Do not follow older POC docs, executed plans, historical prompts, or stale
N1/N2/DPAF instructions.

Use `docs/mjl-current-app-functional-map.md` only as current-state evidence.

If code conflicts with authoritative decisions, treat the code as
implementation debt and record it in `docs/mjl-current-vs-target-gap-analysis.md`.

If a doc conflicts with authoritative decisions, update, merge, or delete the
stale doc.

## Important Directories

- `custom/mjlfinancement`: MJL custom module, pages, classes, scripts, SQL,
  CSS, JS, and language files.
- `docs/`: authority, current-state, deployment, readiness, testing, and
  decision docs.
- `docs/design-system/`: active design guidance, current screen inventory, and
  UI audit docs.
- `CONTEXT.md`: durable product/domain memory.
- `DESIGN.md`: durable design memory.
- `tasks/lessons.md`: reusable lessons from repeated mistakes or durable
  debugging discoveries.
- `tests/e2e`: Playwright E2E tests.
- `data/documents`: local Dolibarr document storage.

## Setup Commands

Confirmed from `README.md` and `docker-compose.yml`:

```bash
docker compose up -d
```

Open `http://127.0.0.1:8080/`.

The retained `bootstrap_poc.php` is a non-seeding module activation path. It
must preserve the empty tenant and the one native technical administrator.

## Development Commands

Needs confirmation. No dedicated dev-server, watch, formatter, or generic
developer command is confirmed beyond Docker Compose start.

## Test/Lint/Build Commands

Confirmed public verification commands from `package.json`:

```bash
npm test
npm run test:unit
npm run test:verify
npm run test:e2e
npm run test:characterization
npm run test:manual-accessibility
```

Active verification guidance is in `docs/mjl-acceptance-tests.md`.

`npm run test:unit` remains available after RST-000A. Container-backed legacy
suites are not target acceptance gates until RST-014 replaces their removed
persistent seed with disposable factories; do not revive the seed to make
them pass.

Lint command: Needs confirmation. Build command: Needs confirmation.

## Environment/Secrets Rules

- Do not commit real secrets, production credentials, private keys, API tokens,
  or client-specific confidential values.
- Credentials in `docker-compose.yml` are local development/test values only.
- Production email transport, public/base URL, final permissions, and secrets
  configuration remain Needs confirmation.
- Never recreate `seed_sample_data.php`, the legacy sample-data library/CSVs,
  or persistent fixture packages in a shared or production tenant.

## Coding Conventions

- Keep MJL-specific code inside `custom/mjlfinancement`, `docs/`, documented
  setup scripts, disposable test-fixture locations, tests, SQL/update files, or
  a documented safe custom theme boundary.
- If a requirement appears to need Dolibarr core edits, stop and escalate the
  architecture decision.
- Prefer native Dolibarr concepts where they fit: third parties, projects,
  users/groups, permissions, ECM/documents, and export helpers.
- Preserve French-first UI/content and XOF/FCFA assumptions.
- Preserve invitation-only access. Only Admin can send invitations for now.
- Preserve exactly one native technical administrator through the clean local
  reset; migrate no other existing sample user or business record.
- Keep persistent sample/demo data absent until all implementation phases are
  complete. Tests may create minimal records only inside isolated disposable
  tenants and must remove all test data with tenant teardown.
- Do not create or expose a public register page.
- Filter custom queries by the active Dolibarr entity for custom objects,
  dashboards, alerts, exports, audit lists, document lookups, and workflow
  lookups.
- UI hiding is not access control; direct URL and POST guards must remain.
- Supporting documents must use guarded MJL routes, not raw public ECM links.
- Preserve workflow rules, audit history, exports, and no-self-validation.
- Official exports should stay French-labeled, Excel-readable, server-filtered,
  audited, and stable in filename/format.

## Git/Destructive Action Rules

- Never modify Dolibarr core files.
- Never revert user changes unless explicitly requested.
- Do not run destructive git or filesystem operations unless explicitly
  requested and approved.
- Keep unrelated dirty worktree changes intact.

## Verification Before Done

- Match verification to the changed surface.
- Use E2E tests as the primary validation for app UI, auth, dashboards,
  exports, official outputs, and workflow changes.
- For schema, workflow, document, or export changes, run the relevant current-purpose
  verification command listed in `docs/mjl-acceptance-tests.md`.
- For PHP edits, run appropriate syntax checks if available and report the
  exact command used.
- For documentation-only instruction changes, a diff/status check is enough.
- Always report skipped checks and why.

## Skill Routing

- Global Matt skills are invoked by name. Local project skills are invoked from
  `skills/<name>/SKILL.md`; read the local `SKILL.md` first.
- Planning and ambiguity: use Matt `grill-with-docs` when requirements,
  product behavior, domain language, or architecture decisions are unclear.
- Domain model changes: use Matt `domain-modeling` when work changes domain
  terms, business rules, entity relationships, permissions, statuses, workflow
  states, or glossary vocabulary.
- Risky plans, architectural uncertainty, or "are you sure?" reviews: use local
  `confidence-review-loop` at `skills/confidence-review-loop/SKILL.md`.
- Bugs, failing tests, regressions, performance issues, production errors,
  inconsistent behavior, or unclear runtime failures: use local `diagnose` at
  `skills/diagnose/SKILL.md`; reproduce the issue or create a feedback loop
  before fixing.
- Feature work or bug fixes where behavior can be built in vertical slices: use
  Matt `tdd`.
- Architecture, module design, public interfaces, adapters, UI/API/domain/data
  boundaries, or testability improvements: use Matt `codebase-design`.
- UI, layout, icons, responsive behavior, accessibility, visual consistency, or
  `DESIGN.md` compliance: read `DESIGN.md`, active docs under
  `docs/design-system/`, and use local `design-system-guardian`.
- UI/state/logic questions that should be answered with throwaway code before
  production implementation: use Matt `prototype`.
- Auth, APIs, user data, secrets, public forms, permissions, rate limits, logs,
  guarded documents, or production-security concerns: use local
  `security-baseline-review`.
- Before marking a feature complete: use local `full-feature-validation`.
- Before merge or before presenting a substantial diff as done: use Matt
  `code-review`.
- When the current conversation or spec needs to become a structured PRD: use
  Matt `to-prd`.
- When a plan or PRD must be broken into vertical, agent-ready issues: use Matt
  `to-issues`.
- Before ending a long session, switching agents, or handing work to a fresh
  context: use Matt `handoff`.
- When creating or improving reusable skills: use Matt `writing-great-skills`.
- For MJL-specific E2E/smoke verification, use local `mjl-e2e-verification`.
- For MJL production-readiness review, use local
  `mjl-production-readiness-audit`.
- For the MJL design-system gate, use local `mjl-design-system-gate`.
- At the end of meaningful work: evaluate whether `tasks/lessons.md` should be
  updated.
- If a named skill is unavailable, perform the equivalent review manually and
  note that in the final response.

## Subagent Policy

- Use subagents only when explicitly asked or when the task naturally splits
  into independent audits.
- Suggested subagent uses: security review, UI/design review,
  test/verification review, and documentation/context review.
- Each subagent must return findings, evidence, risk level, and recommended
  fixes.
- The main agent must consolidate results before editing.

## Project Memory Routing

- For MJL product/domain decisions, read `docs/mjl-authoritative-decisions.md`
  first, then `CONTEXT.md`.
- For current implementation evidence, read
  `docs/mjl-current-app-functional-map.md`.
- For UI/design ambiguity, read `DESIGN.md`, `docs/design-system/DESIGN.md`,
  `docs/design-system/audit/current-screen-inventory.md`, and
  `docs/design-system/audit/current-ui-audit.md`.
- Before app UI, auth, email, dashboard, export, official output, or
  E2E-covered work, confirm required design-system docs and audits exist and
  have no unresolved decisions blocking the touched surface.

## Lessons/Update Policy

Evaluate `tasks/lessons.md` at the end of meaningful work. Update it only for
repeated mistakes, user corrections, or durable debugging discoveries. Do not
add one-off observations or generic advice.
