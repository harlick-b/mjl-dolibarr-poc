# MJL Internal UAT Dry-Run Plan

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Environment

- Local Docker Dolibarr 23.0.2 and MariaDB 11 stack.
- Base URL: `http://127.0.0.1:8080`.
- Dataset: local/dev bootstrap and sample data only.

## Test users

- `admin.poc`: Admin plateforme.
- `dpaf.mjl`: Validateur definitif fixture user.
- `superviseur.n1` / `superviseur.n2`: Agent verificateur / prevalidateur fixture users.
- `agent.mjl`: Agent de saisie fixture user.
- `lecteur.audit`: legacy/read-only fail-closed fixture user.

## Test data

Required data comes from `bootstrap_poc.php` and `seed_sample_data.php`: UNICEF, Programme Redevabilite, projects, funding envelopes, fund receipts, budgets, activities, expenses, documents, workflow history, alerts, and reports.

## Test execution order

1. Baseline syntax and Docker readiness.
2. Local fixture bootstrap/seed.
3. Schema audits and smoke scripts.
4. Full Playwright E2E suite.
5. Unresolved-scope and production-readiness probes.
6. Manual review of generated Phase 13 docs and final verdict.

## Expected evidence for each scenario

| Scenario | Role | Precondition | Action | Expected result | Evidence | Pass/fail rule |
| --- | --- | --- | --- | --- | --- | --- |
| Invitation and access | Admin plateforme, invited user | Bootstrap users exist | Verify invitation, password reset, assignment, and login flows | Invitation-only access works; no public registration | E2E auth/access suite | Pass if E2E passes; production SMTP remains deferred |
| Scope isolation | Agent/Admin | UNICEF and Programme Redevabilite exist | Open scoped workspaces and tampered URLs | Non-admin sees assigned scope only; Admin sees all | E2E partner/workspace/dashboard/report suites | Pass if cross-scope leakage is not observed |
| Project creation | Validateur definitif/Admin/Agent | Seeded scopes exist | Create/edit project and attempt forbidden create | Validateur/Admin allowed; lower roles denied; audit exists | E2E project execution suite | Pass if route and POST guards match matrix |
| Funding and budget | Validateur definitif/Admin | Envelopes, receipts, budgets exist | Review/create funding, receipts, budget lines | Financial data and KPI inputs are coherent | E2E convention/budget/fund suites, smoke scripts | Pass if scripts and E2E pass |
| Activity workflow | Agent/Verifier/Validator | Project and budget exist | Create, submit, prevalidate, final validate, update execution | Workflow completes, no-self rules hold, KPIs/alerts update | E2E activity/project/alert suites, smoke script | Pass if no invalid transition succeeds |
| Expense / Decaissement | Agent/Verifier/Validator | Budget and justificatif data exist | Create, upload, submit, prevalidate, final validate, disburse | Final validation and disbursement stay separate; guards hold | E2E expense suites, smoke script | Pass if missing docs/overspend/self-actions are blocked |
| Documents | Authorized/unauthorized users | Contextual docs exist | Upload/download and direct tampering attempts | Contextual upload works; guarded download denies unsafe access | E2E document suites | Pass if no raw/unsafe download succeeds |
| Timeline / exchanges | Authorized/read-only users | Object history exists | Add comments and inspect timeline/search | Contextual timeline is scoped; global exchange route is advanced only | E2E contextual exchange suite | Pass if direct POST fails closed outside access |
| Alerts | Agent/Verifier/Validator/Admin | Alert candidates exist | Review activity, expense, and finance alerts | Alerts are scoped and role-specific | E2E alert suites | Pass if queues match role and scope |
| Dashboards and KPIs | All roles | Seeded dashboard data exists | Review filters, cards, queues, diagnostics | Values are scoped; Admin diagnostics are distinct | E2E dashboard suites | Pass if tampered filters fail closed |
| Reports and exports | Authorized/unauthorized users | Report registry and data exist | Export CSV/XLSX and tamper filters/tokens | CSV/XLSX rules hold; export is audited and scoped | E2E report/export suites, traceability smoke | Pass if unauthorized export is denied |

## Stop conditions

- Baseline syntax failure.
- UAT dataset cannot be generated locally.
- Feature-validation blocker remains after allowed fixes.
- Scope isolation is broken.
- Workflow cannot complete.
- Reports/exports fail.
- Dashboards/KPIs are misleading.

## Known pre-UAT risks

- Production SMTP, public/base URL, secrets, backup/restore, and monitoring are not closed in Phase 13.
- Final client permission matrix, report canevas, KPI labels, and alert thresholds remain pending client validation.
- Historical unresolved local audit rows remain data debt.

## Commands/scripts to run

Use the commands listed in `docs/mjl-acceptance-tests.md`, plus `git diff --check` and PHP syntax checks.

## Manual checks required

- Confirm final Phase 13 docs do not claim production release readiness.
- Confirm client-facing docs keep approval items marked as pending.
- Confirm no Dolibarr core files changed.
