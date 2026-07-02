# MJL-Financement Production Readiness

This document is the production-readiness gate for the MJL-Financement
module. It replaces broad POC claims with an evidence-gated matrix.

Production readiness is not inferred from implementation intent. A feature can
be marked `READY` only when the matrix row cites concrete route/action guards,
real data behavior, tests, and matching documentation.

## Status Rules

- Production scope status: `IN_SCOPE`, `OUT_OF_SCOPE`, or
  `BLOCKED_NEEDS_DECISION`.
- Final readiness status: `READY`, `PARTIAL`, `BLOCKED`, or `OUT_OF_SCOPE`.
- Do not mark a row `READY` when any required UI, backend/data, permission,
  test, or documentation evidence is missing.
- Do not bump the module from `0.7.0` to `1.0.0` while any `IN_SCOPE` row is
  `PARTIAL` or `BLOCKED`.
- Dolibarr core files remain out of scope.

## Current Scope Decisions

- The final permission matrix is not available. Until it is provided, tests and
  route guards continue to use the current role simulation:
  `AGENT`, `SUPERVISEUR_N1`, `SUPERVISEUR_N2`, `DPAF`, `ADMIN`, and `LECTEUR`.
- Conventions / funding envelopes are selected for production management by
  DPAF/Admin only. Production readiness requires create, edit, detail,
  close/archive, required-field validation, project/donor links, and history.
- Budget lines are implemented as governed DPAF/Admin production management:
  create, edit, detail, activation, amount validation, recalculation, audit
  history, filters by project/convention/activity, and unsafe-edit protection
  after expenses exist.
- Fund receipts are implemented as governed DPAF/Admin production management:
  create, edit, proof upload/download, received/not-received lifecycle, audit
  history, filters by project/convention/status/date, and received-only totals.
- Documents target secure download first. Preview is a later enhancement.
- Official report lists and columns will be provided later. Export format for
  production is CSV compatible with Microsoft Excel plus XLSX.
- Email features and production email/base URL settings will be implemented
  later.
- Native Dolibarr project and third-party screens remain acceptable for
  Admin/DPAF reference data. Normal users should see project/donor context
  inside MJL screens rather than raw native screens.
- The current role model is not final.

## Route And Action Inventory

| Feature / action | Route / surface | Current state | Production scope | Missing UI work | Missing backend/data work | Missing permission checks | Missing tests | Missing documentation | Guard evidence | Test evidence | Data-source evidence | Final readiness | Remaining blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MJL workspace dashboard | `/custom/mjlfinancement/index.php` | Role-aware custom workspace with sidebar and action cards | `IN_SCOPE` | Needs final production wording review | None known for current cards | Broad read users are kept from unavailable links through capability navigation | Full route matrix covered in latest E2E pass | Production matrix row and deployment docs | `mjl_workspace_user_can_read()` and `mjl_navigation_items()` | `npm run test:e2e` passed, 89/89 on 2026-07-02 | Custom dashboard/workspace queries filtered by entity | `PARTIAL` | Final production wording and client review pending |
| Shared MJL sidebar | Shared helper `mjl_navigation_shell_start()` | Present on module pages except invitation/auth surfaces | `IN_SCOPE` | None known | None | Direct URL guards now match hidden reference/advanced links | Direct URL tests for advanced/reference pages passed | Matrix describes hidden vs blocked surfaces | `custom/mjlfinancement/lib/mjl_navigation.lib.php` | `npm run test:e2e` passed, 89/89 on 2026-07-02 | Navigation derives from user capabilities | `PARTIAL` | Final production wording/client review pending |
| Activity list/detail/create/workflow | `/custom/mjlfinancement/activities.php`, POST `create`, `update`, `submit`, `correct`, `request_correction`, `validate`, `reject`, `upload` | Core workflow implemented with detail view, timeline, direct activity document panel, linked-expense document checklist, entity scope, CSRF, and no-self-validation | `IN_SCOPE` | Final UX polish only | No schema migration; direct activity documents use ECM | Existing action guards remain domain-backed; uploads require object access plus ECM upload | Full regression and Phase 18 activity document tests passed | Matrix and deployment docs cite guarded document behavior | Route requires `activity/read`; actions require write/validate; upload requires `mjl_activities_can_apply_action()` and ECM upload; object open checks scope and ownership | `npm run test:e2e` passed, 89/89 on 2026-07-02; Phase 18 activity document coverage passed 4/4 | `llx_mjlfinancement_activity`, `llx_ecm_files`, workflow actions, Dolibarr project/task links | `PARTIAL` | Final activity wording/client review pending |
| Expense list/detail/create/workflow/upload/download | `/custom/mjlfinancement/expenses.php`, `/custom/mjlfinancement/documentdownload.php`, POST `create`, `update`, `upload`, `submit`, `correct`, `validate`, `reject` | Core workflow implemented with detail view, document upload, guarded document download, document state, timeline, CSRF, no-self-validation | `IN_SCOPE` | Preview planned later | None known for expense download | Download route repeats `expense/read`, entity, linked-object, object-scope, and filesystem containment checks | Direct secure-download tests cover success, unauthorized, cross-entity, non-expense, orphan, and poisoned path rows | Production docs state guarded download and preview limits | Route requires `expense/read`; upload requires `expense/write` and ECM upload; validate blocks missing document; download uses `mjl_expenses_can_open()` and ECM realpath containment | `npm run test:e2e` passed, 89/89 on 2026-07-02; expense smoke passed | `llx_mjlfinancement_expense`, `llx_ecm_files`, budget lines, ECM storage | `PARTIAL` | Preview remains later |
| Alerts | `/custom/mjlfinancement/alerts.php` | Actionable alerts for deadlines, pending reviews, and missing expense documents | `IN_SCOPE` | Final wording review | None known | Scoped alert queries preserved | Full role matrix coverage passed | Production docs need cite alert rules | `mjl_alerts_user_can_read()` plus scoped alert helpers | `npm run test:e2e` passed, 89/89 on 2026-07-02 | Activities, expenses, ECM document state | `PARTIAL` | Final alert wording/client review pending |
| DPAF dashboard | `/custom/mjlfinancement/dpafdashboard.php` | Supervision dashboard restricted to DPAF/Admin | `IN_SCOPE` | Final KPI labels may need client review | Final indicators may change | Guard is capability-based, not report read only | Direct URL role tests passed | Deployment docs cover permission setup | `mjl_workspace_require_supervision_access()` | `npm run test:e2e` passed, 89/89 on 2026-07-02 | Entity-filtered dashboard helpers | `PARTIAL` | Final DPAF indicators pending |
| CSV/XLSX official exports | `/custom/mjlfinancement/reports.php`, GET `action=export_csv` or `action=export_xlsx` | Export center with preview, filters, French headers, UTF-8 BOM semicolon CSV, native Dolibarr XLSX, and stable filenames | `IN_SCOPE` | Final donor-specific template review | Final client columns/templates unknown | Export actions require DPAF/Admin page access plus Admin or `export/write`; required filters are enforced server-side | Full route/action matrix covers CSV and XLSX download guards/content | Official-output docs aligned in Phase 17 | `mjl_workspace_require_supervision_access()` and export-write check | `npm run test:e2e` passed, 89/89 on 2026-07-02; Phase 9 export and Phase 17 hardening evidence retained | Report helpers filter by active entity; XLSX uses Dolibarr `ExportExcel2007` | `PARTIAL` | Final donor canevas and client-approved columns remain blocked |
| Expense validation history | `/custom/mjlfinancement/validations.php` | Read-only validation history | `IN_SCOPE` | Needs clearer title/context | None known | Operational users with broad read rights are blocked unless reviewer/supervision/audit | Full suite passed | Matrix and capability docs | `mjl_workspace_require_validation_history_access()` | `npm run test:e2e` passed, 89/89 on 2026-07-02 | `llx_mjlfinancement_validation` | `PARTIAL` | Contextual UX evidence pending |
| Workflow audit history | `/custom/mjlfinancement/workflowactions.php` | Advanced technical audit table | `IN_SCOPE` | Needs less technical normal-user UX or advanced-only label | None known | Advanced/audit-only despite broad read rights | Full suite passed | Matrix labels advanced audit | `mjl_workspace_require_advanced_traceability_access()` | `npm run test:e2e` passed, 89/89 on 2026-07-02; traceability/export smoke passed | `llx_mjlfinancement_workflow_action` | `PARTIAL` | Advanced UX evidence pending |
| Exchange logs | `/custom/mjlfinancement/exchangelogs.php`, POST `create` | Activity-linked exchange log list/create surface | `IN_SCOPE` | Needs contextual placement; standalone table is technical | Object support currently limited to activities | Standalone route is advanced/audit-only; contextual normal-user exchange UX remains open | Create tests still partial | Matrix states standalone vs contextual behavior | `mjl_workspace_require_advanced_traceability_access()` plus POST token/write checks | `npm run test:e2e` passed, 89/89 on 2026-07-02 | `llx_mjlfinancement_exchange_log` | `PARTIAL` | Standalone production UX and contextual exchange decision pending |
| Invitation-only admin access | `/custom/mjlfinancement/admin/access.php`, POST `invite`, `revoke` | Admin invitation management implemented | `IN_SCOPE` | Final admin wording review | Production mail transport/config documented as required | Admin-only route and CSRF POSTs | Full auth/access rerun passed | Deployment docs cover setup | `empty($user->admin)` guard and token checks | `npm run test:e2e` passed, 89/89 on 2026-07-02 | `llx_user`, groups, invitation table, email helpers | `PARTIAL` | Production email/base URL configuration pending |
| Invitation acceptance | `/custom/mjlfinancement/invitation.php`, POST `accept_invitation` | Token-based invitation acceptance without module sidebar | `IN_SCOPE` | Final wording review | Production mail/base URL config pending | Token, CSRF, invitation status checks | Full auth/access rerun passed | Deployment docs cover invite lifecycle | Token status and CSRF checks in page/auth helpers | `npm run test:e2e` passed, 89/89 on 2026-07-02 | Invitation and user tables | `PARTIAL` | Production mail/base URL parameters pending |
| Conventions management | `/custom/mjlfinancement/conventions.php`, POST `create`, `update`, `activate`, `close`, `delete`, `upload`, guarded convention document download | Governed DPAF/Admin management with create, edit, detail, activation, closure, history, and Phase 18 document upload/download | `IN_SCOPE` | Final UX polish only | No schema migration; ECM remains the only document storage layer | DPAF/Admin-only management guard; uploads require `convention/write` plus ECM upload; closed conventions block new uploads; downloads require reference-data access and guarded ECM checks | Phase 14 management and Phase 18 document workflow tests passed | Matrix describes convention workflow and document guard rules | `mjl_workspace_require_reference_data_access()`, `mjl_conventions_can_manage()`, `mjl_conventions_can_upload_document()`, `documentdownload.php?type=convention` | `npm run test:e2e` passed, 89/89 on 2026-07-02; Phase 14 convention management and Phase 18 convention documents passed | `llx_mjlfinancement_convention`, `llx_ecm_files`, native third parties/projects, `MjlWorkflowAction` | `PARTIAL` | Final client wording/review pending |
| Budget lines management | `/custom/mjlfinancement/budgetlines.php`, POST `create`, `update`, `activate` | Governed DPAF/Admin management with detail, filters, lifecycle, recalculation, locked edits, and history | `IN_SCOPE` | Final UX polish only | No deactivate/close UI by design for now | DPAF/Admin-only management guard; active convention and active budget-line expense guards enforced in domain/integrity code | Focused Phase 15 E2E passed in full suite | Production docs keep budget-line ownership and revision floor visible | `mjl_workspace_require_reference_data_access()` plus `budgetline/write` for actions | `npm run test:e2e` passed, 89/89 on 2026-07-02; Phase 15 covers rights, CRUD, locked edits, recalculation, and expense integration | `llx_mjlfinancement_budget_line`, `MjlWorkflowAction`, linked expenses | `PARTIAL` | Deactivation policy remains a later business decision |
| Fund receipts management | `/custom/mjlfinancement/fundreceipts.php`, POST `create`, `update`, `upload`, `received`, `not_received`, guarded fund proof download | Governed DPAF/Admin management with active convention, derived PTF/project, proof upload/download, lifecycle, and history | `IN_SCOPE` | Final UX polish only | No expected-funds intermediate status by design for now | DPAF/Admin-only management guard; proof download requires supervision/reference-data access; received totals require status `received` | Focused Phase 16 E2E passed in full suite | Production docs keep proof-before-received and received-only totals visible | `mjl_workspace_require_reference_data_access()` plus `fundreceipt/write` and ECM upload for actions | `npm run test:e2e` passed, 89/89 on 2026-07-02; Phase 16 covers rights, CRUD, proof upload/download guards, lifecycle, and report/dashboard impact | `llx_mjlfinancement_fund_receipt`, `llx_ecm_files`, `MjlWorkflowAction` | `PARTIAL` | Expected-funds planning remains a later business decision |
| Internal production roadmap | `/custom/mjlfinancement/roadmap.php` | Admin-only future-scope page | `OUT_OF_SCOPE` | None; must stay internal | None | Admin-only guard must remain | Direct URL tests passed | Matrix row | `empty($user->admin)` guard | `npm run test:e2e` passed, 89/89 on 2026-07-02 | Static internal content | `OUT_OF_SCOPE` | Not a production user feature |
| Dolibarr native projects/tasks | Native Dolibarr project/task screens | Used as linked native data | `IN_SCOPE` | Normal-user MJL screens must expose only needed project context | Native management remains Dolibarr-owned for Admin/DPAF | Native permissions need deployment setup | Smoke/E2E setup checks | Deployment docs must cover native modules | Bootstrap activates project module; custom queries filter entity | Activity/export tests | Native project/task tables | `PARTIAL` | Production permission setup must be documented and rehearsed |
| Dolibarr native third parties / donors | Native Dolibarr third-party screens | Used for PTF/bailleurs through conventions | `IN_SCOPE` | Normal-user MJL screens must expose donor context where relevant | Native management remains Dolibarr-owned for Admin/DPAF | Native permissions need deployment setup | Setup checks | Deployment docs must cover native modules | Bootstrap activates third parties module | Export/report tests | Native `societe` table | `PARTIAL` | Production permission setup must be documented and rehearsed |
| Dolibarr native ECM / documents | Native ECM plus MJL expense, fund-receipt, activity, and convention guarded document workflows | ECM is storage layer; downloads go through the MJL guarded route | `IN_SCOPE` | Preview planned later | No schema migration; direct object document workflows use ECM `src_object_type` and `src_object_id` | Download route checks entity, source type/id, object existence/access, safe filename/path, and realpath containment; uploads require object-specific rights plus ECM upload | Phase 11, Phase 16, and Phase 18 secure-download/document workflow tests passed | Deployment docs cover storage/backup and guarded route expectations | Upload guarded in object pages; download guarded by `documentdownload.php`, object-specific fetch helpers, and realpath containment | `npm run test:e2e` passed, 89/89 on 2026-07-02; Phase 11 expense, Phase 16 fund-receipt, and Phase 18 activity/convention document tests passed | `llx_ecm_files` and ECM directory | `PARTIAL` | Document preview enhancement remains later |
| Public registration | Native Dolibarr registration if enabled | Forbidden by product rules | `OUT_OF_SCOPE` | None | Must remain disabled/unlinked | No public register UI in tested auth/workspace flows | Auth tests check forbidden labels | Deployment docs state invitation-only | Auth templates avoid register links | `npm run test:e2e` passed, 89/89 on 2026-07-02 | Configuration/runtime behavior | `OUT_OF_SCOPE` | Runtime config must be checked during deployment |
| OHADA/SYSCOHADA accounting engine | Not implemented | Not selected | `OUT_OF_SCOPE` | None | None | None | None | Matrix row only | Not exposed as MJL production feature | Not applicable | Native accounting may exist but is not MJL feature | `OUT_OF_SCOPE` | Explicit client selection required |
| Payroll, procurement, bank reconciliation/API, SMS, OCR, external portal, offline mode, AI reporting | Not implemented | Not selected | `OUT_OF_SCOPE` | None | None | None | None | Matrix row only | Not exposed as MJL production feature | Not applicable | None | `OUT_OF_SCOPE` | Explicit client selection required |

## Production Scope Summary

- `READY`: none yet. The repository has strong POC-valid evidence, including
  a fresh full `npm run test:e2e` pass of 89/89 on 2026-07-02, but remaining
  production decisions and wording/configuration reviews keep in-scope rows
  below `READY`.
- `PARTIAL`: dashboard, navigation, activities, expenses, alerts, DPAF
  dashboard, exports, validation history, audit history, exchange logs, auth
  and invitation flows, convention/envelope management, budget-line management,
  fund receipt management, native project/PTF/ECM integrations.
- `BLOCKED_NEEDS_DECISION`: final export/report columns, official templates,
  final permission matrix, DPAF/N2 escalation rules, final role model, and
  production email/base URL settings.
- `OUT_OF_SCOPE`: public registration, internal roadmap as user feature,
  full accounting engine, payroll, procurement, bank reconciliation/API, SMS,
  OCR, external portal, offline mode, AI-assisted reporting.

## Version Eligibility

The module is not eligible for `1.0.0` yet. It remains `0.7.0` because no
`IN_SCOPE` production row has been proven `READY` by this matrix.
