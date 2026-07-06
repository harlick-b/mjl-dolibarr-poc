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

- When using a local skill, read its `SKILL.md` first. If platform skill loading
  is unavailable, follow the local file manually.
- Bugs, failing tests, regressions, or unclear runtime behavior: use `diagnose`
  at `skills/diagnose/SKILL.md`.
- Risky plans, architectural uncertainty, or "are you sure?" reviews: use
  `confidence-review-loop` at `skills/confidence-review-loop/SKILL.md`.
- Product/domain ambiguity: read `CONTEXT.md` and use `grill-with-docs` at
  `skills/grill-with-docs/SKILL.md`.
- UI, layout, Tailwind, shadcn/ui, icons, or visual consistency: read
  `DESIGN.md` and use `design-system-guardian` at
  `skills/design-system-guardian/SKILL.md`.
- Auth, APIs, user data, secrets, public forms, permissions, RLS, CORS, rate
  limits, or production security: use `security-baseline-review` at
  `skills/security-baseline-review/SKILL.md`.
- Before marking a feature complete: use `full-feature-validation` at
  `skills/full-feature-validation/SKILL.md`.
- When creating a reusable new workflow: use `write-a-skill` at
  `skills/write-a-skill/SKILL.md`.
- For MJL-specific E2E/smoke verification, use `mjl-e2e-verification` at
  `skills/mjl-e2e-verification/SKILL.md`.
- For MJL production-readiness review, use `mjl-production-readiness-audit` at
  `skills/mjl-production-readiness-audit/SKILL.md`.
- For the MJL design-system gate, use `mjl-design-system-gate` at
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
