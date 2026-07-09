# MJL Feature Alignment Phase Execution Plan

Status: temporary execution plan.

Remove this file once all phases are executed.

This file records the hardened execution strategy for the rebased MJL client
feature-alignment work. It is not a permanent authority document. Product
decisions still come from `docs/mjl-authoritative-decisions.md`.

Do not modify Dolibarr core files. Do not recreate the deleted
`docs/mjl-target-client-spec.md`. Do not implement production-release closure
items in this feature-alignment pass.

## Confidence Review Results

The prior strategy was not accepted as 100% reliable until it was reviewed for
loopholes against the repository. These issues were found and fixed:

- The earlier plan treated some existing foundations as missing. Physical
  execution fields, project create/edit, scoped documents, timelines on several
  object pages, CSV/XLSX exports, and audit helpers already exist. Fix:
  verify/extend them, do not rebuild.
- The prompt references non-existing helpers such as `mjl_timeline.lib.php`.
  Fix: create a reusable helper only if duplication or scope safety requires
  it; otherwise consolidate existing per-page timeline logic.
- The prompt asks to update `docs/mjl-target-client-spec.md`, but repository
  docs classify it as merged/deleted. Fix: do not recreate it unless explicitly
  requested; write current client docs to active or new UAT/model docs.
- Current schema requires `fund_receipt.fk_convention` and expense
  budget/envelope links. Fix: do not loosen finance constraints without a
  migration decision; represent a global partner envelope through nullable
  project on funding envelopes.
- Exchange export currently resolves activity-backed exchanges best. Fix:
  Phase 8R and Phase 11R must generalize exchange scope resolution before
  claiming full contextual exchange coverage.
- Generic report export audit rows do not resolve cleanly to a Partenaire /
  Programme. Fix: keep non-admin object timelines scoped; treat report-audit
  scope as a formal design point before exposing it broadly.
- `npm run e2e` is listed in the prompt, but `package.json` only defines
  `npm run test:e2e`. Fix: use the actual available command and document
  skipped unavailable commands.
- Design docs still mention old Level 1/2/3 wording in places. Fix:
  `docs/mjl-authoritative-decisions.md` wins; production roles are
  `AGENT_SAISIE`, `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`, and
  `ADMIN_PLATEFORME`.
- Full `FEATURE_ALIGNED` cannot be claimed if official client report templates
  or the permission matrix are pending. Fix: likely final verdict is
  `FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION`.

## Revised Execution Rules

- Start every phase by proving whether the feature is already implemented,
  partial, or missing.
- Prefer existing MJL classes, helpers, and routes over new abstractions.
- Add migrations only for missing durable fields; never use destructive schema
  changes.
- Every touched query must filter by active Dolibarr entity and Partenaire /
  Programme scope.
- Every touched POST must keep CSRF, sanitization, and server-side role checks.
- Every document link must use guarded MJL download routes.
- Do not modify Dolibarr core files.
- Do not implement SMTP, public URL, secrets, backup/restore, monitoring, SMS,
  OCR, bank API, public portal, offline mode, PDF reports, or Word reports.
- Before UI-heavy phases, check `DESIGN.md`, `docs/design-system/DESIGN.md`,
  current UI audit/inventory, and run the local design gate before calling the
  phase done.
- Before feature completion, run local full-feature validation; before
  presenting a substantial diff as done, run code review.

## Phase 0: Baseline

Objective: record current status and prevent reimplementation.

Files likely to change:

- `docs/mjl-implementation-summary.md`
- `docs/mjl-current-vs-target-gap-analysis.md`

Schema risks: none.

Permission/scope risks: unverified baseline route guards.

Tests to run:

- `git status`
- `git diff --check`
- `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`
- Confirm `npm run test:e2e` is available.
- Run optional Docker audits if the local Docker instance is running.

Stop conditions:

- Baseline syntax or schema failure is not clearly unrelated.
- Mandatory docs conflict with `docs/mjl-authoritative-decisions.md`.
- Existing user work in target files makes implementation ambiguous.

## Phase 5R: Partenaires / Programmes

Objective: extend `partners.php` from partial workspace to complete scoped
client dashboard.

Files likely to change:

- `custom/mjlfinancement/partners.php`
- dashboard/reporting helpers
- E2E tests
- implementation summary and gap docs

Schema risks: low; prefer aggregates over new tables.

Permission/scope risks: high KPI leakage risk.

Tests to run:

- UNICEF-only user sees UNICEF only.
- Programme Redevabilite-only user sees Programme Redevabilite only.
- Admin sees both.
- Partner detail KPIs, documents, alerts, and timeline remain scoped.
- `smoke_scope_model.php`
- `audit_unresolved_scope.php`

Stop conditions:

- Any KPI cannot be made scope-safe.
- A required KPI needs a schema decision not covered by authority docs.
- Detail access leaks cross-partner data.

## Phase 6R: Projects And Activities

Objective: verify existing project create/edit and physical execution, then
fill only real gaps.

Files likely to change:

- `custom/mjlfinancement/projects.php`
- `custom/mjlfinancement/activities.php`
- `custom/mjlfinancement/class/mjlactivity.class.php`
- dashboard/reporting helpers
- E2E tests
- implementation summary and gap docs

Schema risks: low unless planned/actual date mapping proves incomplete.

Permission/scope risks: project create/edit role guard and no-self workflow.

Tests to run:

- `audit_schema_0.9.0.php`
- `smoke_activity_workflow.php`
- Project create/edit role tests.
- Invalid physical percentage rejection.
- Late activity alert behavior.

Stop conditions:

- A destructive activity-field rename would be required.
- Project create/edit cannot be guarded to `ADMIN_PLATEFORME` and
  `VALIDATEUR_DEFINITIF`.
- No-self validation is weakened.

## Phase 7R: Funding, Budget, Expenses

Objective: align finance KPIs while preserving existing required
envelope/budget links.

Files likely to change:

- `custom/mjlfinancement/conventions.php`
- `custom/mjlfinancement/budgetlines.php`
- `custom/mjlfinancement/fundreceipts.php`
- `custom/mjlfinancement/expenses.php`
- related classes/helpers
- E2E tests
- implementation summary and gap docs

Schema risks: medium; additive only.

Permission/scope risks: high money leakage and workflow bypass risk.

Tests to run:

- `audit_schema_0.10.0.php`
- `smoke_expense_validation.php`
- `smoke_traceability_exports.php`
- E2E for budget blocking, justificatif blocking, final validation, and
  disbursement.

Stop conditions:

- Budget-consumption formula ambiguity cannot be resolved from authority docs
  and code.
- Disbursement can occur before final validation.
- Any finance object can be accessed outside assigned scope.

## Phase 8R: Contextual Timeline

Objective: consolidate existing timelines and add contextual
comments/exchanges on key detail pages.

Files likely to change:

- existing object pages
- `custom/mjlfinancement/class/mjlexchangelog.class.php`
- possibly `custom/mjlfinancement/lib/mjl_timeline.lib.php`
- E2E tests
- implementation summary and gap docs

Schema risks: medium only if exchange rows cannot resolve scope.

Permission/scope risks: high; timeline must fail closed for unresolved scope.

Tests to run:

- Scoped user can add and view contextual comments on accessible objects only.
- Workflow and document events appear where available.
- No primary `Echanges` menu is exposed.
- Global exchange remains Supervision/Audit only.

Stop conditions:

- Exchange or timeline scope cannot be resolved for non-admin.
- Append-only comment behavior needs an unapproved edit/delete policy.
- Existing exchange route would become primary navigation.

## Phase 9R: Alerts

Objective: complete computed operational alerts with scoped links.

Files likely to change:

- `custom/mjlfinancement/alerts.php`
- `custom/mjlfinancement/lib/mjl_alerts.lib.php`
- dashboards
- partner/project detail pages
- E2E tests
- implementation summary and gap docs

Schema risks: low; keep alerts computed.

Permission/scope risks: high direct-link and data leakage risk.

Tests to run:

- Overdue activity alert.
- Submitted/prevalidated queue alerts.
- Missing justificatif alert.
- Validated-not-disbursed alert.
- Budget warning and critical alerts.
- Scoped alert isolation.

Stop conditions:

- Alert cannot link safely to an accessible object.
- Threshold behavior conflicts with the prompt defaults.
- Any alert query leaks unassigned data.

## Phase 10R: Dashboards

Objective: role-appropriate KPIs and queues using production role names.

Files likely to change:

- `custom/mjlfinancement/index.php`
- `custom/mjlfinancement/dpafdashboard.php` or label cleanup around it
- dashboard/navigation helpers
- E2E tests
- implementation summary and gap docs

Schema risks: low.

Permission/scope risks: high global-count leakage risk.

Tests to run:

- Each role dashboard.
- Partner, project, period, and status filters.
- Admin unresolved-data indicator.
- No cross-partner counts for non-admin users.

Stop conditions:

- `ADMIN_PLATEFORME` and `VALIDATEUR_DEFINITIF` semantics blur.
- Non-admin dashboard includes global counts.
- KPI formulas diverge from partner/project/report formulas.

## Phase 11R: Reports And Exports

Objective: client monitoring CSV/XLSX reports with stable French outputs and
audited exports.

Files likely to change:

- `custom/mjlfinancement/reports.php`
- reporting/CSV/XLSX helpers
- E2E tests
- report model docs
- implementation summary and gap docs

Schema risks: low unless report-audit scope is formalized.

Permission/scope risks: high export leakage risk.

Tests to run:

- CSV has UTF-8 BOM.
- CSV uses semicolon separator.
- Headers are French.
- XLSX generation works.
- Unauthorized export is denied.
- Export audit row is created.
- Report rows and options are scoped.
- `smoke_traceability_exports.php`
- `npm run test:e2e`

Stop conditions:

- Required official columns depend on unavailable client templates.
- Generic export audit scope cannot be represented safely.
- Any PDF or Word feature becomes necessary.

## Phase 12R: UAT Pack

Objective: create acceptance checklist, demo scenario, roles matrix, report
model, and dashboard KPI model.

Files likely to change:

- `docs/mjl-client-uat-checklist.md`
- `docs/mjl-client-demo-scenario.md`
- `docs/mjl-roles-permissions-matrix.md`
- `docs/mjl-reports-exports-model.md`
- `docs/mjl-dashboard-kpi-model.md`
- `docs/mjl-implementation-summary.md`
- `docs/mjl-current-vs-target-gap-analysis.md`
- `docs/mjl-stale-reference-audit.md`
- `docs/mjl-post-cleanup-alignment-report.md`

Do not recreate `docs/mjl-target-client-spec.md`.

Schema risks: none.

Permission/scope risks: docs must not imply public registration, raw ECM,
per-partner roles, or production release readiness.

Tests to run:

- `git diff --check`
- PHP syntax check if PHP changed earlier.
- All relevant Docker audits and smoke checks.
- `npm run test:e2e`
- Stale-term scan with classification.

Stop conditions:

- UAT flow cannot be completed.
- Final permission matrix or report templates remain unapproved; mark
  `PENDING_CLIENT_VALIDATION`.
- Docs drift from authoritative decisions.

## Final Verdict Rules

- Use `FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION` if implementation and tests
  pass but permission matrix or report templates remain client-pending.
- Use `MOSTLY_ALIGNED_WITH_GAPS` if any feature phase remains partial.
- Use `FEATURE_ALIGNED` only if all client-facing feature behavior is
  implemented, verified, scoped, documented, and no client feature decision
  remains open.
- Never claim production release readiness in this task.
- Confirm no Dolibarr core files changed.

## Final Verification

At the end of all feature-alignment phases, run:

```sh
git diff --check
find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l
npm run test:e2e
```

Run relevant Docker schema and smoke scripts from
`docs/mjl-acceptance-tests.md`, including unresolved-scope and readiness
checks. Report skipped checks and why.
