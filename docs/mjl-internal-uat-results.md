# MJL Internal UAT Results

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Executive verdict

`INTERNAL_UAT_PASS_WITH_MINOR_GAPS`

Internal UAT evidence supports presenting the app for structured client validation. No feature-validation blocker was found. Remaining gaps are documented client decisions, production-release blockers, and local historical unresolved audit-row data debt.

## Environment tested

- Date: July 13, 2026.
- Local Docker stack: Dolibarr 23.0.2 and MariaDB 11.
- URL: `http://127.0.0.1:8080`.
- Dataset: local/dev bootstrap and seeded MJL sample data.

## Test users

Fixture users exercised by scripts/E2E:

- `admin.poc`
- `agent.mjl`
- `superviseur.n1`
- `superviseur.n2`
- `dpaf.mjl`
- `lecteur.audit`

## Test data

`seed_sample_data.php` reported:

- PTF/Bailleurs: 3
- Production profiles/scopes: assigned
- Projects: 3
- Conventions: 3
- Activities: 5
- Budget lines: 8
- Fund receipts: 4
- Expenses: 7
- Validation events: 4
- Fixed reports: 3

## Scenario results

| Scenario | Result | Evidence |
| --- | --- | --- |
| Invitation and access | PASS | Phase 4/10 E2E auth and email-template tests passed. |
| Scope isolation | PASS | Partner, workspace, dashboard, report, alert, and direct URL E2E tests passed. |
| Project creation | PASS | Admin/Validateur project create/edit and lower-role denial E2E passed. |
| Funding and budget | PASS | Convention, fund receipt, budget-line, finance report, and dashboard E2E passed. |
| Activity workflow and physical execution | PASS | Activity workflow, execution update, KPI, alert, tamper, and no-self E2E passed. |
| Expense / Decaissement workflow | PASS | Expense prevalidation, final validation, disbursement, document, budget, and no-self E2E passed. |
| Documents | PASS | Expense, fund, activity, and convention guarded document E2E passed. |
| Timeline / exchanges | PASS | Contextual exchange/timeline E2E passed. |
| Alerts | PASS | Activity, expense, finance, scope, and role-specific alert E2E passed. |
| Dashboards and KPIs | PASS | Role dashboard, scoped filter, and Admin diagnostic E2E passed. |
| Reports and exports | PASS | CSV/XLSX, token, scope, stable filename, and audit E2E passed. |

## Evidence collected

- `git diff --check`: passed.
- PHP syntax checks for all `custom/mjlfinancement` PHP files: passed.
- `bootstrap_poc.php`: completed for local/dev fixture setup.
- `seed_sample_data.php`: completed.
- Schema audits `0.3.0`, `0.4.0`, `0.5.0`, `0.8.0`, `0.9.0`, `0.10.0`: passed; `0.8.0` reported legacy lecteur warnings.
- `acceptance_sample_data.php`: passed.
- `smoke_scope_model.php`: passed.
- `smoke_activity_workflow.php`: passed.
- `smoke_expense_validation.php`: passed.
- `smoke_traceability_exports.php`: passed.
- `npm run test:e2e`: passed with 125 tests after rerunning with Docker access.
- `check_production_readiness.php`: source-provable checks passed and expected production deployment confirmations stayed `UNKNOWN`.

## Issues found

| Issue | Classification | Evidence | Status |
| --- | --- | --- | --- |
| Sandboxed Playwright run failed with `spawnSync /bin/sh EPERM` when specs spawned Docker. | DEFERRED_PRODUCTION_RELEASE | First `npm run test:e2e` run failed before app assertions. | Resolved for verification by rerunning with approved Docker access. |
| Historical unresolved local workflow/action rows and generic report audit anchors remain. | MEDIUM | `audit_unresolved_scope.php` failed on historical local rows. | Documented as data debt; E2E fail-closed behavior passed. |
| Production email transport, public URL, secrets, backup/restore, monitoring/log retention remain unconfirmed. | DEFERRED_PRODUCTION_RELEASE | `check_production_readiness.php` returned expected `UNKNOWN` rows. | Not in Phase 13 scope. |
| Final permission matrix, report templates, KPI labels, formulas wording, and alert thresholds require client validation. | CLIENT_DECISION | Existing Phase 12/13 docs mark these pending. | To validate with client. |

## Fixes applied

No production code fixes were applied. Phase 13 implementation was documentation, evidence capture, and verification only.

## Remaining gaps

- Historical unresolved local audit rows should be cleaned or migrated separately before using the local database as a clean audit demonstration.
- Final client decisions remain pending.
- Production-release blockers remain pending.

## Client-validation risks

- The client may request changes to role permissions, KPI wording, report column order, formulas, or alert thresholds.
- Live email invitation acceptance cannot be presented as production-ready until SMTP and public/base URL are configured.

## Final recommendation

Proceed to structured client validation with the documented minor gaps. Do not claim production release readiness.
