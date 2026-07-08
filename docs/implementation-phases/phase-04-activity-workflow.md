# Phase 4 - Activity Workflow

## Goal

Implement the production activity workflow and physical execution model while
preserving compatibility with current status data.

## Scope

- Add or verify activity fields for Partenaire / Programme, project, envelope,
  budget, planned/actual dates, physical execution percentage, execution
  status, responsible user, comments, and documents.
- Introduce production workflow states without destructive integer-status
  repurposing.
- Split prevalidation and final validation.
- Preserve no-self-validation and audit history.

## Verification

- Activity workflow E2E from draft to final validation.
- Invalid physical execution percentage is rejected.
- Timeline/audit shows every decision and status transition.

## Implementation record

Status: Implemented on 2026-07-08.

Implemented:

- Module version advanced to `0.9.0`.
- Activity schema now includes responsible user, actual dates, physical
  execution percentage, execution status, and execution comment.
- Added `STATUS_PREVALIDATED = 7` without repurposing existing statuses.
- Activity workflow now splits verifier prevalidation from final validation.
- No-self-review blocks creator and responsible user for review decisions.
- Activity guards normalize object `id`/`rowid` so direct POST checks use the
  same object id as detail pages.
- Activity list/detail UI shows responsible user, actual execution fields,
  physical execution, final/prevalidation labels, and linked funding envelope
  budget summary from budget lines.
- Dashboards, alerts, reports, convention close checks, and activity pages use
  centralized open/final/review status semantics.
- Bootstrap/seed now idempotently populate production roles/scopes used by the
  activity workflow.

Verification run on 2026-07-08:

- `php -l custom/mjlfinancement/class/mjlactivity.class.php`: pass
- `php -l custom/mjlfinancement/activities.php`: pass
- `php -l custom/mjlfinancement/lib/mjl_activity_access.lib.php`: pass
- `php -l custom/mjlfinancement/scripts/audit_schema_0.9.0.php`: pass
- `php -l custom/mjlfinancement/scripts/smoke_activity_workflow.php`: pass
- `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.9.0.php`: pass
- `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_activity_workflow.php`: pass
- `npx playwright test tests/e2e/phase10-email-templates.spec.js tests/e2e/phase7-activity-workflow.spec.js tests/e2e/phase8-alerts-risks.spec.js`: pass, 19 passed
- `npm run test:e2e`: fail outside the Phase 4 activity workflow gate; Phase
  7, Phase 8, Phase 10, and Phase 11 passed in the full run. Remaining failures
  were Phase 14 convention heading expectation, Phase 15 budget-line direct
  access expectation, Phase 16 fund-receipt draft-convention POST expectation,
  Phase 18 DPAF activity document upload expectation, Phase 5 workspace access
  expectation, and Phase 6 legacy reader dashboard expectation.
