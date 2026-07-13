# MJL Implementation Summary

This file summarizes what is actually implemented. Target decisions remain in
`docs/mjl-authoritative-decisions.md`; current-state detail remains in
`docs/mjl-current-app-functional-map.md`.

## Current Module

- Custom module path: `custom/mjlfinancement`.
- Module descriptor: `modMjlFinancement`, version `0.10.0`.
- Runtime: Dolibarr 23.0.2 with MariaDB 11 through Docker Compose.
- Native dependencies: third parties, projects, ECM/documents, exports,
  users/groups/rights.

## Implemented Capabilities

- MJL workspace shell, role-aware dashboard, grouped sidebar, and guarded
  native-route behavior.
- Invitation-only access administration and token-based invitation acceptance.
- Production role/scope tables and helpers for one global business role and
  assigned Partenaires / Programmes.
- Partner/programme, project, activity, expense, document, alert, supervision,
  report/export, validation history, workflow audit, and exchange-log routes.
- The Partenaires / Programmes route implements the 5R partner workspace:
  scoped list/detail access, identity summary, explicit `entity + fk_soc`
  portfolio KPIs, related projects/envelopes/budgets/activities/expenses/funds,
  guarded document links, computed alerts, read-only contextual history, and
  Admin-only assigned-user visibility.
- Activity workflow with prevalidation, final validation, no-self-review,
  physical execution fields, workflow history, and document support.
- Expense workflow with prevalidation, final validation, disbursement,
  no-self-review/disbursement, supporting-document checks, budget checks, and
  validation history.
- Governed convention, budget-line, and fund-receipt management.
- Guarded document downloads for expenses, fund receipts, activities, and
  conventions.
- Phase 11R CSV/XLSX report/export center with French labels, server-side
  filters, explicit Partenaire / Programme filtering, stable filenames, and
  POST-only export generation with Dolibarr token validation.
- Report option lists and export row queries are partner/programme scoped for
  non-admin users; unresolved rows fail closed through scope joins/filters.
- Guarded document downloads record best-effort `document_downloaded` workflow
  audit rows after successful path resolution.
- CSV/XLSX exports record `export_generated` workflow audit rows anchored to
  stable `mjlfinancement_report` rows; generic report audit rows remain
  Admin-only in the report center's scoped audit view because no formal
  report-scope model exists yet.
- Project create/update inside the MJL workspace records workflow audit rows
  with production actor-role labels.
- Phase 8R contextual exchanges are implemented for project, activity, expense,
  convention, budget-line, and fund-receipt detail pages. New comments are
  written to `mjlfinancement_exchange_log` with channel `commentaire` through
  the object page's own access guard and the `exchangelog/write` permission.
- `exchangelogs.php` is now a read-only advanced search/audit surface under the
  advanced traceability guard; normal exchange creation happens contextually.
- Phase 9R operational alerts are computed live through
  `custom/mjlfinancement/lib/mjl_alerts.lib.php`; no alert table or schema
  migration was added. The alert page, dashboard alert metrics, and supervision
  alert cards consume the centralized helper.
- Alert payloads now carry `type`, `domain`, `object_type`, `object_id`, `ref`,
  `label`, `severity`, `tone`, `audience`, `expected_action`, `href`,
  `sort_date`, and `meta`. `alerts.php` supports the allowlisted scopes `all`,
  `activities`, `expenses`, and `finance`, with invalid values falling back to
  `all`.
- Phase 9R alert generation filters by active entity and assigned Partenaire /
  Programme through the target object's convention/project partner. Only
  `ADMIN_PLATEFORME` or Dolibarr admin gets unrestricted scope; finance alerts
  are suppressed when the current user cannot open the guarded target route.
- Phase 10R dashboard alignment is implemented for the MJL home dashboard and
  supervision dashboard. Dashboard filters are shared across cards, queues,
  budget rows, fund rows, and audit rows with active-entity filtering, assigned
  Partenaire / Programme scope, project validation, date semantics by object
  type, and semantic status buckets.
- Phase 10R keeps `dpafdashboard.php` as a compatibility route name, but the
  dashboard UI and focused E2E assertions use production role wording:
  `AGENT_SAISIE`, `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`, and
  `ADMIN_PLATEFORME`.
- Platform Admin now sees an Admin-only unresolved-data diagnostic card based
  on the same categories as `audit_unresolved_scope.php`. Normal recent-audit
  dashboard rows hide unresolved targets and stay scoped to resolvable MJL
  objects.
- Phase 11R report keys are implemented or mapped in `reports.php`:
  `funding_received_partner`, `budget_allocation_partner`,
  `budget_allocation_project`, `financial_execution_partner`,
  `financial_execution_project`, `physical_execution_project`,
  `activities_tracking`, `expenses_disbursements`, `expense_documents`,
  `validated_not_disbursed`, `pending_prevalidations`,
  `pending_final_validations`, `corrections_rejections`,
  `workflow_decisions`, `contextual_comments`, and `general_audit`.
- Phase 12R client UAT and model documents now exist for feature acceptance:
  UAT checklist, demo scenario, roles/permissions matrix, reports/exports
  model, and dashboard KPI model.

## Current Compatibility Debt

- Local bootstrap and seed scripts still use POC names for fixture setup and
  legacy migration.
- Some untouched code labels still use DPAF, Conventions, Depenses, and
  Echanges.
- The module descriptor and language files still contain POC wording.
- Download/export audit is not fully proven across every path.
- Generic report-export audit rows do not resolve to a Partenaire / Programme;
  non-admin audit views that enforce object-scope resolution may therefore hide
  those generic report audit rows until a report-scope model is defined.
- `audit_unresolved_scope.php` now reports positive workflow/exchange object
  pointers that cannot resolve to a supported target; current local data may
  contain historical orphan rows that must be cleaned before the audit passes.
- The known Phase 8R unresolved-scope historical orphan-row debt remains data
  debt unless a current verification run reports new Phase 9R-owned unresolved
  rows.
- Phase 10R does not clean historical unresolved audit/workflow rows; it only
  exposes an Admin-only diagnostic count and prevents those unresolved rows from
  appearing in normal scoped dashboard audit tables.
- Final client-approved permission matrix and report templates remain pending.
- Final report status remains `FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION`
  because donor/client report canevas and the final permission matrix are not
  approved.
- Phase 12R documents are current implementation/UAT artifacts, not final
  client approval of permissions, KPI wording, or donor report templates.
- Sample-data acceptance and the 0.3.0 schema audit now distinguish budget
  `committed_amount` from disbursed `spent_amount`, matching the current
  finance model.
- 5R partner funding totals use received fund receipts as `Financement total
  recu`; envelope amounts are not treated as received funding. Negative
  unallocated budget is displayed as an over-allocation warning rather than
  clamped.

## July 9, 2026 Phase 7R Finance Alignment Pass

- 6R evidence gate: the worktree contains
  `tests/e2e/phase6r-project-activity-execution.spec.js` and modified
  project/activity execution code, so the previous statement that Sub-phase 6R
  was not started is stale implementation-summary debt.
- Phase 7R added a centralized internal finance metrics helper for budget
  submitted, prevalidated, final validated, disbursed, remaining, validation
  rate, and execution rate calculations.
- Expense create option lists and POST validation now apply active-entity and
  assigned Partenaire / Programme scope for project, programme/envelope,
  activity, and budget-line links.
- Fund receipts can be attached to active global partner/programme envelopes
  without a project; budget lines and expenses remain project-bound.
- A guarded SQL update was added to make `mjlfinancement_fund_receipt.fk_project`
  nullable when a runtime tenant still has the old NOT NULL shape.
- Expense document uploads now write both expense validation history and
  workflow audit rows.
- Touched finance labels were aligned toward Partenaire, Programme,
  Administrateur plateforme, and Validateur definitif wording.

## July 9, 2026 5R Partner Workspace Pass

- 5R status: DONE after focused PHP syntax, E2E, scope smoke, and unresolved
  scope audit verification.
- Sub-phase 5R was implemented in `custom/mjlfinancement/partners.php`; no
  schema migration was added in that pass. The later 6R worktree evidence means
  any "6R not started" reading is stale.
- Partner portfolio KPIs are computed from explicit active-entity and
  `fk_soc`-scoped SQL instead of activity/expense queue helpers.
- Partner detail remains read-only for contextual history and uses existing
  guarded detail/download routes for actions and documents.
- Focused E2E coverage was added to
  `tests/e2e/phase3-partners-project-finance.spec.js` for required 5R labels,
  cross-scope fixture exclusion, guarded document links, and Admin-only
  assigned users.

## Durable Verification Evidence

Historical docs recorded successful focused checks for:

- schema audits through `audit_schema_0.10.0.php`;
- `smoke_scope_model.php`;
- `smoke_activity_workflow.php`;
- `smoke_expense_validation.php`;
- `smoke_traceability_exports.php`;
- focused Playwright suites for auth/access, workspace navigation, activity
  workflow, expense/document workflow, alerts, reports/exports, and governed
  finance screens.

Historical pass counts are not current verification. Re-run checks from
`docs/mjl-acceptance-tests.md` before making production-readiness claims.

## July 9, 2026 Phase 12R Client UAT Pack

- Created the client UAT checklist, end-to-end demo scenario, role/permission
  matrix, reports/exports model, and dashboard KPI model.
- Indexed the new Phase 12R documents in `docs/mjl-docs-index.md`.
- Updated `acceptance_sample_data.php` and `audit_schema_0.3.0.php` to verify
  budget `committed_amount` as budget-consuming/final-validated amount and
  `spent_amount` as disbursed amount.
- The UAT pack covers invitation/login, assigned-scope isolation, project
  creation/editing, funding envelopes, funds received, budget allocation,
  activities, physical execution, expenses, justificatifs, workflow decisions,
  disbursement, documents, guarded downloads, contextual timelines, alerts,
  dashboards, CSV/XLSX exports, and audit evidence.
- The role matrix uses only the production roles `AGENT_SAISIE`,
  `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`, and `ADMIN_PLATEFORME`.
- The report and dashboard models explicitly remain
  `PENDING_CLIENT_VALIDATION`; they do not close final permission approval,
  final donor/client report canevas, or production deployment blockers.
- Verification run during this pass:
  `git diff --check` passed;
  PHP syntax checks passed for all `custom/mjlfinancement` PHP files;
  full Playwright `npm run test:e2e` passed with 125 tests after rerunning
  outside the sandbox because specs invoke Docker;
  `seed_sample_data.php`, `acceptance_sample_data.php`,
  `smoke_scope_model.php`, `smoke_activity_workflow.php`,
  `smoke_expense_validation.php`, and `smoke_traceability_exports.php` passed;
  schema audits `0.2.0`, `0.3.0`, `0.4.0`, `0.5.0`, `0.8.0`, `0.9.0`, and
  `0.10.0` passed.
- `audit_unresolved_scope.php` still fails in the current local database on
  workflow-action rows pointing to deleted test objects and generic report
  audit anchors. This is classified as local verification data debt, not
  Phase 12R product-code debt.
- `check_production_readiness.php` passed source-provable checks and reported
  expected `UNKNOWN` deployment items for production email transport, public
  base URL, production secrets, backup/restore, and monitoring/log retention.

## July 13, 2026 Phase 13 Feature Freeze And Internal UAT

- Saved the Phase 13 task prompt under `docs/prompts/` and indexed the new
  Phase 13 evidence documents in `docs/mjl-docs-index.md`.
- Created feature-freeze notes, UAT data readiness, internal UAT dry-run plan,
  internal UAT results, client validation pack, and final Phase 13 report.
- Updated the client demo scenario into a repeatable client-demonstration guide
  with UNICEF and Programme Redevabilite isolation paths.
- Phase 13 verdict is
  `READY_FOR_CLIENT_VALIDATION_WITH_MINOR_GAPS`: internal UAT evidence passed,
  no feature-validation blocker remains, and the remaining gaps are historical
  local audit data debt, client decisions, and production-release blockers.
- Verification run during this pass:
  `git diff --check` passed before documentation edits;
  PHP syntax checks passed for all `custom/mjlfinancement` PHP files;
  `bootstrap_poc.php` and `seed_sample_data.php` completed for local/dev UAT
  setup;
  schema audits `0.3.0`, `0.4.0`, `0.5.0`, `0.8.0`, `0.9.0`, and `0.10.0`
  passed, with the known legacy lecteur warning in `0.8.0`;
  `acceptance_sample_data.php`, `smoke_scope_model.php`,
  `smoke_activity_workflow.php`, `smoke_expense_validation.php`, and
  `smoke_traceability_exports.php` passed;
  full Playwright `npm run test:e2e` passed with 125 tests after rerunning with
  Docker access because the first sandboxed run failed before app assertions;
  `check_production_readiness.php` passed source-provable checks and kept
  expected production deployment confirmations as `UNKNOWN`.
- `audit_unresolved_scope.php` still fails in the current local database on
  historical workflow/action rows and generic report audit anchors. E2E
  fail-closed checks for unresolved and scoped access passed, so this remains
  local verification data debt rather than a Phase 13 feature-validation
  blocker.

## July 13, 2026 Phase 14 Client Validation Preparation

- Saved the Phase 14 task prompt under `docs/prompts/` and indexed the new
  Phase 14 evidence documents in `docs/mjl-docs-index.md`.
- Created demo readiness, demo hygiene, demo runbook, demo rehearsal, client
  decision log, client validation results, client change request, and final
  Phase 14 report documents.
- Phase 14 verdict is `CLIENT_VALIDATION_NOT_RUN`: no real client validation
  session or client feedback was provided, so no client approval, rejection, or
  change request is recorded.
- Demo preparation verdicts are `DEMO_READY_WITH_MINOR_GAPS`,
  `DEMO_HYGIENE_READY_WITH_NOTES`, and
  `DEMO_REHEARSAL_PASS_WITH_NOTES`, based on Phase 13 UAT evidence, Phase 14
  runbook/checklists, and current verification.
- Verification run during this pass:
  `git diff --check` passed;
  `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`
  passed for all MJL PHP files;
  `bootstrap_poc.php` and `seed_sample_data.php` completed for local/dev
  setup;
  schema audits `0.2.0`, `0.3.0`, `0.4.0`, `0.5.0`, `0.8.0`, `0.9.0`, and
  `0.10.0` passed, with known legacy lecteur warnings in `0.8.0`;
  `acceptance_sample_data.php`, `smoke_scope_model.php`,
  `smoke_activity_workflow.php`, `smoke_expense_validation.php`, and
  `smoke_traceability_exports.php` passed;
  full Playwright `npm run test:e2e` first failed in the sandbox with
  `spawnSync /bin/sh EPERM`, then passed with 125 tests in 12.5 minutes after
  rerunning with Docker access;
  `check_production_readiness.php` passed source-provable checks and kept the
  expected production deployment confirmations as `UNKNOWN`.
- `audit_unresolved_scope.php` still fails in the current local database on
  historical workflow/action rows and generic report audit anchors. This
  remains local data debt and a demo hygiene note, not client feedback and not
  production release closure.

## July 13, 2026 Phase 14.9 Demo UI Polish

- Phase 14.9 was implemented as a UI/navigation polish pass only. It did not
  change schema, route filenames, table names, DB fields, permission codes,
  workflow transitions, KPI formulas, report keys, export columns, or export
  filenames.
- Created `docs/mjl-demo-ui-polish-plan.md` before source changes with the
  status-label mapping, safe fixes, deferred decisions, and stop conditions.
- Production-facing labels on touched pages were aligned toward
  `Enveloppe de financement`, `Partenaire / Programme`, `Fonds reçus`,
  `Historique / Audit`, and production role wording.
- Display-only legacy expense status `Validee legacy` is now rendered as
  final-validation compatibility wording where the code already treats the
  stored status as historical final validation. Stored constants and statuses
  were not changed.
- The global exchange-log route remains guarded and absent from primary
  navigation; its page title now presents it as an advanced
  `Historique / Audit` search surface.
- Created `docs/mjl-demo-data-hygiene.md` and
  `docs/mjl-phase-14-9-ui-polish-report.md` to record remaining fixture debt,
  verification evidence, and deferred client decisions.
- Verification for this pass:
  `git diff --check` passed;
  `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`
  passed;
  targeted Playwright checks for workspace shell, contextual exchanges, and
  envelope management passed 25/25;
  broader targeted Playwright checks passed after updating one document-label
  expectation;
  full `npm run test:e2e` passed 125/125.

## July 9, 2026 Phase 10R Dashboard Alignment Pass

- Added shared dashboard filter parsing for `fk_soc`, `fk_project`,
  `date_start`, `date_end`, and semantic `status_bucket` values:
  `all`, `to_prevalidate`, `to_final_validate`, `to_disburse`, `correction`,
  and `overdue`.
- Home-dashboard workspace metrics and supervision-dashboard KPIs/tables now
  consume the same validated filters and scope rules.
- Filter option lists are scope-filtered. Direct URL tampering with an
  unassigned Partenaire / Programme or project fails closed to zeroed results
  with a visible warning.
- Review queues are role-specific: `AGENT_VERIFICATEUR` sees prevalidation
  work; `VALIDATEUR_DEFINITIF` sees final-validation and disbursement work;
  `ADMIN_PLATEFORME` sees platform administration and diagnostic oversight.
- Recent audit dashboard rows now require a resolvable supported MJL target and
  apply partner/project/date/status filtering. Generic report-export audit
  scope remains a later design point outside Phase 10R.
- Active design-system docs were updated to stop presenting the old temporary
  Level 1/2/3 model as target behavior.
- Focused E2E coverage was added in
  `tests/e2e/phase10r-dashboards-alignment.spec.js` for production role
  dashboards, filtered scoped queues/KPIs, direct filter tampering, Admin-only
  unresolved diagnostics, and absence of legacy dashboard wording.
- Verification run during this pass:
  `git diff --check` passed;
  `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`
  passed;
  focused Playwright
  `tests/e2e/phase10r-dashboards-alignment.spec.js` passed;
  full Playwright `npm run test:e2e` passed with 121 tests;
  `smoke_scope_model.php`, `smoke_activity_workflow.php`,
  `smoke_expense_validation.php`, and `smoke_traceability_exports.php`
  passed.
- `audit_unresolved_scope.php` still fails in the current local database on
  historical/deleted fixture workflow-action rows. A direct database check
  after the Phase 10R full-suite run found zero remaining `P10R-*` projects,
  conventions, budget lines, activities, expenses, fund receipts, or Phase 10R
  workflow actions/comments, so no Phase 10R-owned unresolved row is currently
  recorded.

## July 9, 2026 Phase 9R Alerts Alignment Pass

- Centralized live alert generation in `mjl_alerts.lib.php` for activity,
  expense, and finance alerts.
- Added activity alerts for deadline soon, overdue, role-specific
  prevalidation/final-validation queues, returned correction work, and stale
  physical execution.
- Added expense alerts for role-specific validation queues, returned
  corrections, missing/unavailable justificatifs, budget overspend candidates,
  and final-validated-but-not-disbursed expenses.
- Added finance alerts for active budget-line warning/critical thresholds based
  on final-validated consumption, and active funding envelopes ending within
  seven days.
- Added focused E2E coverage in
  `tests/e2e/phase9r-alerts-alignment.spec.js` for alert classes, scope tabs,
  cross-partner isolation, and finance-route suppression.
- Verification run during this pass:
  `git diff --check` passed;
  `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`
  passed;
  focused Playwright
  `tests/e2e/phase9r-alerts-alignment.spec.js` passed;
  `smoke_scope_model.php` passed;
  `smoke_activity_workflow.php` passed;
  `smoke_expense_validation.php` passed.
- `audit_unresolved_scope.php` still fails on the known historical unresolved
  workflow/audit row debt. The reported refs did not include Phase 9R fixture
  refs.

## July 9, 2026 Phase 8R Contextual Exchanges Pass

- Added `custom/mjlfinancement/lib/mjl_timeline.lib.php` for exchange
  allowlist validation, labels, actor-role resolution, contextual comment
  creation, and exchange timeline rows.
- Activity, expense, project, convention, budget-line, and fund-receipt detail
  pages can show contextual exchange history; users without
  `mjlfinancement/exchangelog/write` see history without a comment form.
- Existing project notes remain readable as legacy timeline entries; new
  project comments are exchange-log rows.
- Partner/programme aggregate history includes exchange rows for all supported
  object types, including projects and budget lines.
- Verification run during this pass:
  `git diff --check` passed;
  `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`
  passed;
  `smoke_scope_model.php` passed;
  `smoke_traceability_exports.php` passed after adding non-activity exchange
  coverage;
  focused Playwright
  `tests/e2e/phase8r-contextual-exchanges.spec.js` passed.
- `audit_unresolved_scope.php` failed in the current local database because it
  now reports historical orphan workflow rows. This is data debt, not a syntax
  failure.

## July 8, 2026 Baseline And Alignment Pass

- Starting worktree already had modified docs:
  `docs/mjl-current-vs-target-gap-analysis.md`,
  `docs/mjl-doc-cleanup-inventory.md`, `docs/mjl-docs-index.md`, and
  `docs/mjl-stale-reference-audit.md`, plus untracked
  `docs/mjl-post-cleanup-alignment-report.md`.
- Baseline `git diff --check`: passed.
- Baseline PHP syntax check:
  `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`:
  passed.
- Available npm scripts: `test:e2e` only. No `composer.json`,
  `composer test`, `vendor/bin/phpunit`, `npm test`, or `npm run test` script
  was present at baseline.
