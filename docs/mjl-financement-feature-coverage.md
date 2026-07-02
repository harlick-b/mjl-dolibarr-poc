# MJL-Financement Feature Coverage Audit

This audit is the required consolidation baseline before navigation and scope
hardening work. It reflects the current codebase, not future production goals.

## Route And Entry-Point Inventory

| Route | Current guard | Classification | Decision |
| --- | --- | --- | --- |
| `/custom/mjlfinancement/index.php` | Any MJL read right | A - implemented and POC-valid | Keep visible as the role-aware workspace dashboard. |
| `/custom/mjlfinancement/activities.php` and `/custom/mjlfinancement/documentdownload.php?type=activity` | `activity/read`; actions require `activity/write`, `activity/validate`, or ECM upload where needed | A - implemented and POC-valid | Preserve workflow, direct URL guards, tampered POST guards, no-self-validation, timeline, direct activity documents, and linked-expense document checklist behavior. |
| `/custom/mjlfinancement/expenses.php` and `/custom/mjlfinancement/documentdownload.php` | `expense/read`; actions require `expense/write`, `expense/validate`, and ECM upload where needed; download also requires same-entity ECM row and expense visibility | A - implemented and POC-valid | Preserve expense workflow, document checks/downloads, budget checks, correction/rejection/resubmission, no-self-validation, and ECM fallback. |
| `/custom/mjlfinancement/alerts.php` | Activity or expense alert visibility | A - implemented and POC-valid | Keep visible for users with actionable alert scope. |
| `/custom/mjlfinancement/dpafdashboard.php` | `mjl_workspace_require_supervision_access()` | A - implemented and POC-valid | Keep for DPAF/Admin only. |
| `/custom/mjlfinancement/reports.php` | `mjl_workspace_require_supervision_access()`; CSV export additionally needs Admin or `export/write` | A - implemented and POC-valid | Keep for DPAF/Admin only; preserve CSV guarantees and server-side filter guards. |
| `/custom/mjlfinancement/validations.php` | `mjl_workspace_require_validation_history_access()` | A - implemented and POC-valid | Keep as read-only expense validation history for reviewers, supervision, admin, and audit consultation. |
| `/custom/mjlfinancement/workflowactions.php` | `mjl_workspace_require_advanced_traceability_access()` | B - partial but demo-safe | Keep as advanced audit evidence, not normal operational navigation. |
| `/custom/mjlfinancement/exchangelogs.php` | `mjl_workspace_require_advanced_traceability_access()`; create requires `exchangelog/write` and token | B - partial but demo-safe | Keep as advanced traceability/exchange log. Avoid presenting it as a complete collaboration module. |
| `/custom/mjlfinancement/admin/access.php` | Admin only | A - implemented and POC-valid | Keep as invitation-only access administration. |
| `/custom/mjlfinancement/invitation.php` | Token-driven invitation flow | A - implemented and POC-valid | Preserve; do not render module sidebar here. |
| `/custom/mjlfinancement/conventions.php` and `/custom/mjlfinancement/documentdownload.php?type=convention` | `mjl_workspace_require_reference_data_access()`; write/upload actions require DPAF/Admin plus `convention/write` and ECM upload | A - implemented and POC-valid | Keep as governed DPAF/Admin convention management with activation, closure, locked-edit, history, and guarded document guards. |
| `/custom/mjlfinancement/budgetlines.php` | `mjl_workspace_require_reference_data_access()`; write actions require DPAF/Admin plus `budgetline/write` | A - implemented and POC-valid | Keep as governed DPAF/Admin budget-line management with active-convention, locked-edit, recalculation, and history guards. |
| `/custom/mjlfinancement/fundreceipts.php` and `/custom/mjlfinancement/documentdownload.php?type=fundreceipt` | `mjl_workspace_require_reference_data_access()`; write/upload actions require DPAF/Admin plus `fundreceipt/write` and ECM upload | A - implemented and POC-valid | Keep as governed DPAF/Admin fund-receipt management with active convention, proof-before-received, secure download, received/not-received lifecycle, and history guards. |

## Module Integration And Navigation

- Dolibarr module entry point: top menu `MJLFinancement` routes to
  `/custom/mjlfinancement/index.php`.
- Module declaration: `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`.
- Current module version in code: `0.7.0`.
- Current quick navigation is local to `index.php`; consolidation should move
  this into a shared helper and render it as a scoped MJL sidebar on module
  pages.
- The sidebar must not appear on `invitation.php` or auth template surfaces.
- Sidebar links must use the same route-level access rules as the target page,
  not raw read rights alone.

## Role And Permission Mapping

The bootstrap maps CSV business roles to Dolibarr groups named `MJL POC - ...`.

| Business role | Sample login | Practical workspace behavior |
| --- | --- | --- |
| Admin | `admin.poc` | Dolibarr admin, invitations, DPAF dashboard, reports, internal production-readiness page. |
| Agent | `agent.mjl` | Operational creation, submission, own follow-up, own alerts, expenses/documents. |
| Supervisor N1 | `superviseur.n1` | Review queue, activity/expense decisions, correction/rejection/validation where authorized. |
| Supervisor N2 | `superviseur.n2` | Same current reviewer capability as N1 until final escalation rules are confirmed. |
| DPAF | `dpaf.mjl` | Supervision dashboard, portfolio alerts, reports and exports. |
| Reader / Audit | `lecteur.audit` | Read-only consultation/audit surfaces; no workflow actions. |

Important loophole: sample roles receive broad MJL read rights. Navigation and
direct route guards must therefore follow workspace capabilities, not raw read
rights alone. For example, `reports.php` is restricted to DPAF/Admin even
though several roles can read `report`; supervision reference pages and
advanced audit pages use capability-level guards for the same reason.

## Preserved POC-Valid Capabilities

- Invitation-only authentication, login, forgotten password, reset password,
  invitation acceptance, revocation, and race-condition protections.
- Activity creation, submission, correction request, correction, validation,
  rejection, direct POST protection, active-entity filtering, timeline, direct
  activity document upload/download, linked expense document checklist, and
  no-self-validation.
- Expense creation, supporting-document upload/download, submission, validation,
  rejection, correction, resubmission, missing-document blocking, budget-line
  checks, ECM-only document fallback, direct download guards, and no-self-validation.
- DPAF dashboard, alerts, validations, workflow audit, exchange logs, and
  Excel-readable CSV exports with French headers.
- Guarded ECM downloads for expenses, fund receipts, activities, and
  conventions.

## Partial But Demo-Safe Surfaces

- Conventions, budget lines, and fund receipts are governed DPAF/Admin
  production-management surfaces with create/edit/detail/status/history flows,
  relevant document workflows, and focused E2E coverage.
- Workflow actions expose technical audit detail and should be treated as an
  advanced audit screen.
- Exchange logs are useful for traceability but not a full collaboration or
  document workflow.

## Future Or Hidden From Normal UI

Do not expose links for these as available features:

- Standalone project management wrapper.
- Standalone PTF/bailleur management wrapper.
- Standalone supporting-document center.
- Official PDF/Word report templates.
- Full CRUD/detail screens for every object.
- Full OHADA/SYSCOHADA accounting, bank reconciliation, payroll, procurement,
  SMS, bank API, OCR, partner portal, offline mode, dynamic report builder,
  advanced analytics, mobile companion, or AI report summaries.

## Dangerous Or Forbidden Surfaces

- Public registration is forbidden. No UI should contain public sign-up labels
  such as `Register`, `Sign up`, `Créer un compte`, or `Inscription`.
- Future-only roadmap items must not have action buttons suggesting they are
  already available.
- Hiding unauthorized actions in the UI is not enough; direct URL and direct
  POST access must remain protected server-side.

## Existing E2E Coverage

Current Playwright coverage includes:

- Phase 4 auth/access flows.
- Phase 5 workspace shell and role visibility.
- Phase 6 level dashboards.
- Phase 7 activity workflow.
- Phase 8 alerts and risks.
- Phase 9 tables and exports.
- Phase 10 email templates.
- Phase 11 expense workflow and document validation.
- Phase 14 convention management.
- Phase 15 budget-line governance.
- Phase 16 fund-receipt management and proof downloads.
- Phase 18 activity and convention document workflows.

Current full-suite evidence:

```text
npm run test:e2e
89 passed on 2026-07-02
```

## Stale Documentation Targets

Update targeted stale claims in:

- `docs/07-actual-capabilities.md`
- `docs/10-codebase-analysis.md`
- `docs/11-support-reunion-cadrage.md`
- `docs/14-ongoing-todo.md`

Known corrections:

- The module version is `0.7.0` in code.
- Browser-level Playwright E2E tests are implemented and passing.
- Remaining work is consolidation, navigation, documentation alignment,
  production readiness, official report templates, final wording, inline
  document preview, and document UX polish, not core POC feasibility.
