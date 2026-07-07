# Agent Instructions

This is the canonical in-repo instruction layer for AI agents. If another
AI-facing file conflicts with this file, follow this file.

## Project overview

MJL Dolibarr POC is a Dockerized Dolibarr 23.0.2 proof of concept with MariaDB
11 for monitoring externally funded Ministry of Justice and Legislation
projects. MJL-specific work must stay in the custom module or documented safe
supporting areas; Dolibarr core files must never be modified.

## Important directories

- `custom/mjlfinancement`: MJL custom module, pages, classes, scripts, SQL,
  CSS, JS, language files, and sample data.
- `docs/`: project, deployment, capability, readiness, and decision docs.
- `docs/design-system/`: design-system source, audits, screen inventory, and
  UI/E2E guidance.
- `CONTEXT.md`: durable product/domain memory.
- `DESIGN.md`: durable design memory.
- `tasks/lessons.md`: reusable lessons from repeated mistakes or durable
  debugging discoveries.
- `tests/e2e`: Playwright E2E tests.
- `data/documents`: local Dolibarr document storage.
- `mjl_dolibarr_poc_sample_data`: sample-data package and background prompt.

## Setup commands

Confirmed from `README.md` and `docker-compose.yml`:

```bash
docker compose up -d
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php
```

Open `http://127.0.0.1:8080/`.

Optional local POC password override:

```bash
MJL_POC_DEFAULT_PASSWORD='change-me' docker compose up -d
```

## Development commands

Needs confirmation. No dedicated dev-server, watch, formatter, or generic
developer command is confirmed beyond Docker Compose start/bootstrap.

## Test/lint/build commands

Confirmed E2E command from `package.json`:

```bash
npm run test:e2e
```

Confirmed deployment and clean-install verification scripts:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.3.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.4.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.5.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/acceptance_sample_data.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_activity_workflow.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_traceability_exports.php
```

Lint command: Needs confirmation. Build command: Needs confirmation.

## Environment/secrets rules

- Do not commit real secrets, production credentials, private keys, API tokens,
  or client-specific confidential values.
- Credentials in `docker-compose.yml` and the default POC user password are
  local POC values only.
- Production email transport, public/base URL, final permissions, and secrets
  configuration remain Needs confirmation.
- Do not load `bootstrap_poc.php`, `seed_sample_data.php`, or sample-data CSVs
  into a production tenant.

## Coding conventions

- Keep MJL-specific code inside `custom/mjlfinancement`, `docs/`, documented
  setup scripts, documented sample-data locations, or a documented safe custom
  theme boundary.
- If a requirement appears to need Dolibarr core edits, stop and escalate the
  architecture decision.
- Prefer native Dolibarr concepts where they fit: third parties, projects,
  users/groups, permissions, ECM/documents, and export helpers.
- Preserve French-first UI/content and XOF/FCFA POC currency assumptions.
- Preserve invitation-only access. Only Admin can send invitations for now.
- Do not create or expose a public register page.
- Filter custom queries by the active Dolibarr entity for custom objects,
  dashboards, alerts, exports, audit lists, document lookups, and workflow
  lookups.
- UI hiding is not access control; direct URL and POST guards must remain.
- Supporting documents must use guarded MJL routes, not raw public ECM links.
- Preserve workflow rules, audit history, exports, and no-self-validation.
- Official exports should stay French-labeled, Excel-readable, server-filtered,
  and stable in filename/format.

## Git/destructive action rules

- Never modify Dolibarr core files.
- Never revert user changes unless explicitly requested.
- Do not run destructive git or filesystem operations unless explicitly
  requested and approved.
- Keep unrelated dirty worktree changes intact.

## Verification before done

- Match verification to the changed surface.
- Use E2E tests as the primary validation for app UI, auth, dashboards,
  exports, official outputs, and workflow changes.
- For schema, workflow, document, or export changes, run the relevant audit and
  smoke scripts listed above.
- For PHP edits, run appropriate syntax checks if available and report the
  exact command used.
- For documentation-only instruction changes, a diff/status check is enough.
- Always report skipped checks and why.

## Skill routing

- Global Matt skills are invoked by name. Local project skills are invoked from
  `skills/<name>/SKILL.md`; read the local `SKILL.md` first.
- Planning and ambiguity: use Matt `grill-with-docs` when requirements,
  product behavior, domain language, or architecture decisions are unclear.
- Domain model changes: use Matt `domain-modeling` when work changes domain
  terms, business rules, entity relationships, permissions, statuses, workflow
  states, or glossary vocabulary.
- Risky plans, architectural uncertainty, or "are you sure?" reviews: use local
  `confidence-review-loop` at `skills/confidence-review-loop/SKILL.md`.
- Code exploration: Matt `zoom-out` was requested but is not currently
  discoverable from the installed Matt skills. Do not route to it until it is
  installed and verified.
- Bugs, failing tests, regressions, performance issues, production errors,
  inconsistent behavior, or unclear runtime failures: the requested Matt
  `diagnose` skill is not currently discoverable. Until it is installed and
  verified, use local `diagnose` at `skills/diagnose/SKILL.md`; reproduce the
  issue or create a feedback loop before fixing.
- Feature work or bug fixes where behavior can be built in vertical slices: use
  Matt `tdd`. Prefer integration, E2E, full-feature, browser, and workflow
  checks when supported; do not create brittle tests that only assert
  implementation details.
- Architecture, module design, public interfaces, seams, adapters, UI/API/
  domain/data boundaries, or testability improvements: use Matt
  `codebase-design`. Do not run broad architecture refactors unless explicitly
  requested.
- UI, layout, Tailwind, shadcn/ui, icons, responsive behavior, accessibility,
  visual consistency, or `DESIGN.md` compliance: read `DESIGN.md` and use local
  `design-system-guardian` at `skills/design-system-guardian/SKILL.md`.
- UI/state/logic questions that should be answered with throwaway code before
  production implementation: use Matt `prototype`.
- Auth, APIs, user data, secrets, public forms, permissions, RLS, CORS, rate
  limits, logs, guarded documents, or production-security concerns: use local
  `security-baseline-review` at `skills/security-baseline-review/SKILL.md`.
- Before marking a feature complete: use local `full-feature-validation` at
  `skills/full-feature-validation/SKILL.md`.
- Before merge or before presenting a substantial diff as done: use Matt
  `code-review`.
- When the current conversation or spec needs to become a structured PRD: use
  Matt `to-prd`.
- When a plan or PRD must be broken into vertical, agent-ready issues: use Matt
  `to-issues`.
- Before ending a long session, switching agents, or handing work to a fresh
  context: use Matt `handoff`.
- When creating or improving reusable skills: use Matt `writing-great-skills`.
- For MJL-specific E2E/smoke verification, use local `mjl-e2e-verification` at
  `skills/mjl-e2e-verification/SKILL.md`.
- For MJL production-readiness review, use local
  `mjl-production-readiness-audit` at
  `skills/mjl-production-readiness-audit/SKILL.md`.
- For the MJL design-system gate, use local `mjl-design-system-gate` at
  `skills/mjl-design-system-gate/SKILL.md`.
- At the end of meaningful work: evaluate whether `tasks/lessons.md` should be
  updated.
- If a named skill is unavailable, perform the equivalent review manually and
  note that in the final response.

Subagent policy:

- Use subagents only when explicitly asked or when the task naturally splits
  into independent audits.
- Suggested subagent uses: security review, UI/design review,
  test/verification review, and documentation/context review.
- Each subagent must return findings, evidence, risk level, and recommended
  fixes.
- The main agent must consolidate results before editing.

## Project memory routing

- For product/domain ambiguity, read `CONTEXT.md` first.
- For UI/design ambiguity, read `DESIGN.md` first.
- Before app UI, auth, email, dashboard, export, official output, or
  E2E-covered work, read `docs/design-system/00_DESIGN_SYSTEM_PLAN.md`.
- Do not implement source changes affecting covered screens until required
  design-system docs, `docs/design-system/audit/current-screen-inventory.md`,
  and `docs/design-system/audit/current-ui-audit.md` exist and have no
  unresolved decisions.

## Lessons/update policy

Evaluate `tasks/lessons.md` at the end of meaningful work. Update it only for
repeated mistakes, user corrections, or durable debugging discoveries. Do not
add one-off observations or generic advice.
