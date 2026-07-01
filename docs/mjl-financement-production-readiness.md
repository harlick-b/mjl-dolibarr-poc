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
- Fund receipts remain read-only supervision/reference for now, following the
  current recommendation. Full create/edit/upload management is deferred until
  the business workflow is selected.
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
| MJL workspace dashboard | `/custom/mjlfinancement/index.php` | Role-aware custom workspace with sidebar and action cards | `IN_SCOPE` | Needs final production wording review | None known for current cards | Broad read users are kept from unavailable links through capability navigation | Full route matrix covered in latest E2E pass | Production matrix row and deployment docs | `mjl_workspace_user_can_read()` and `mjl_navigation_items()` | `npm run test:e2e` passed, 59/59 | Custom dashboard/workspace queries filtered by entity | `PARTIAL` | Final production wording and client review pending |
| Shared MJL sidebar | Shared helper `mjl_navigation_shell_start()` | Present on module pages except invitation/auth surfaces | `IN_SCOPE` | None known | None | Direct URL guards now match hidden reference/advanced links | Direct URL tests for advanced/reference pages passed | Matrix describes hidden vs blocked surfaces | `custom/mjlfinancement/lib/mjl_navigation.lib.php` | `npm run test:e2e` passed, 59/59 | Navigation derives from user capabilities | `PARTIAL` | Final production wording/client review pending |
| Activity list/detail/create/workflow | `/custom/mjlfinancement/activities.php`, POST `create`, `update`, `submit`, `correct`, `request_correction`, `validate`, `reject` | Core workflow implemented with detail view, timeline, document checklist, entity scope, CSRF, no-self-validation | `IN_SCOPE` | Final UX polish only | No activity-level upload; linked expense documents are shown | Existing action guards remain domain-backed | Full regression passed | Production docs need cite current behavior | Route requires `activity/read`; actions require write/validate; object open checks scope and ownership | `npm run test:e2e` passed, 59/59; activity smoke passed | `llx_mjlfinancement_activity`, workflow actions, Dolibarr project/task links | `PARTIAL` | Activity-level document scope and final production docs pending |
| Expense list/detail/create/workflow/upload/download | `/custom/mjlfinancement/expenses.php`, `/custom/mjlfinancement/documentdownload.php`, POST `create`, `update`, `upload`, `submit`, `correct`, `validate`, `reject` | Core workflow implemented with detail view, document upload, guarded document download, document state, timeline, CSRF, no-self-validation | `IN_SCOPE` | Preview planned later | None known for expense download; activity/convention document workflows remain later | Download route repeats `expense/read`, entity, linked-object, object-scope, and filesystem containment checks | Direct secure-download tests added for success, unauthorized, cross-entity, non-expense, orphan, and poisoned path rows | Production docs state guarded download and preview limits | Route requires `expense/read`; upload requires `expense/write` and ECM upload; validate blocks missing document; download uses `mjl_expenses_can_open()` and ECM realpath containment | `npm run test:e2e` passed after implementation; expense smoke passed | `llx_mjlfinancement_expense`, `llx_ecm_files`, budget lines, ECM storage | `PARTIAL` | Preview and broader document workflows remain later |
| Alerts | `/custom/mjlfinancement/alerts.php` | Actionable alerts for deadlines, pending reviews, and missing expense documents | `IN_SCOPE` | Final wording review | None known | Scoped alert queries preserved | Full role matrix coverage passed | Production docs need cite alert rules | `mjl_alerts_user_can_read()` plus scoped alert helpers | `npm run test:e2e` passed, 59/59 | Activities, expenses, ECM document state | `PARTIAL` | Final alert wording/client review pending |
| DPAF dashboard | `/custom/mjlfinancement/dpafdashboard.php` | Supervision dashboard restricted to DPAF/Admin | `IN_SCOPE` | Final KPI labels may need client review | Final indicators may change | Guard is capability-based, not report read only | Direct URL role tests passed | Deployment docs cover permission setup | `mjl_workspace_require_supervision_access()` | `npm run test:e2e` passed, 59/59 | Entity-filtered dashboard helpers | `PARTIAL` | Final DPAF indicators pending |
| CSV/XLSX official exports | `/custom/mjlfinancement/reports.php`, GET `action=export_csv`; XLSX route/action not implemented | Export center with preview, filters, French headers, UTF-8 BOM, semicolon CSV, stable filenames | `IN_SCOPE` | Final official framing review and XLSX action/UI | XLSX generation missing; final client columns/templates unknown | Export action requires DPAF/Admin page access plus Admin or `export/write` | Full route/action matrix coverage passed for CSV; XLSX tests missing | Official-output docs need production alignment | `mjl_workspace_require_supervision_access()` and export-write check | `npm run test:e2e` passed, 59/59; traceability/export smoke passed | Report helpers filter by active entity | `PARTIAL` | XLSX implementation and final report columns/templates are blocked |
| Expense validation history | `/custom/mjlfinancement/validations.php` | Read-only validation history | `IN_SCOPE` | Needs clearer title/context | None known | Operational users with broad read rights are blocked unless reviewer/supervision/audit | Full suite passed | Matrix and capability docs | `mjl_workspace_require_validation_history_access()` | `npm run test:e2e` passed, 59/59 | `llx_mjlfinancement_validation` | `PARTIAL` | Contextual UX evidence pending |
| Workflow audit history | `/custom/mjlfinancement/workflowactions.php` | Advanced technical audit table | `IN_SCOPE` | Needs less technical normal-user UX or advanced-only label | None known | Advanced/audit-only despite broad read rights | Full suite passed | Matrix labels advanced audit | `mjl_workspace_require_advanced_traceability_access()` | `npm run test:e2e` passed, 59/59; traceability/export smoke passed | `llx_mjlfinancement_workflow_action` | `PARTIAL` | Advanced UX evidence pending |
| Exchange logs | `/custom/mjlfinancement/exchangelogs.php`, POST `create` | Activity-linked exchange log list/create surface | `IN_SCOPE` | Needs contextual placement; standalone table is technical | Object support currently limited to activities | Standalone route is advanced/audit-only; contextual normal-user exchange UX remains open | Create tests still partial | Matrix states standalone vs contextual behavior | `mjl_workspace_require_advanced_traceability_access()` plus POST token/write checks | `npm run test:e2e` passed, 59/59 | `llx_mjlfinancement_exchange_log` | `PARTIAL` | Standalone production UX and contextual exchange decision pending |
| Invitation-only admin access | `/custom/mjlfinancement/admin/access.php`, POST `invite`, `revoke` | Admin invitation management implemented | `IN_SCOPE` | Final admin wording review | Production mail transport/config documented as required | Admin-only route and CSRF POSTs | Full auth/access rerun passed | Deployment docs cover setup | `empty($user->admin)` guard and token checks | `npm run test:e2e` passed, 59/59 | `llx_user`, groups, invitation table, email helpers | `PARTIAL` | Production email/base URL configuration pending |
| Invitation acceptance | `/custom/mjlfinancement/invitation.php`, POST `accept_invitation` | Token-based invitation acceptance without module sidebar | `IN_SCOPE` | Final wording review | Production mail/base URL config pending | Token, CSRF, invitation status checks | Full auth/access rerun passed | Deployment docs cover invite lifecycle | Token status and CSRF checks in page/auth helpers | `npm run test:e2e` passed, 59/59 | Invitation and user tables | `PARTIAL` | Production mail/base URL parameters pending |
| Conventions / funding envelopes management | `/custom/mjlfinancement/conventions.php` plus missing create/edit/detail actions | Read-only reference list, visible in supervision navigation | `IN_SCOPE` | Create, edit, detail, close/archive, required-field errors, history, and DPAF/Admin action UI | Domain methods may exist, but production management controller flow is missing | DPAF/Admin-only management guard needed for write actions; normal direct URL access is already blocked | Full management tests missing | Production docs must describe convention/envelope workflow | `mjl_workspace_require_reference_data_access()` protects current read surface | `npm run test:e2e` passed, 59/59 for current read/route behavior | `llx_mjlfinancement_convention`, native third parties/projects | `PARTIAL` | Production management workflow not implemented |
| Budget lines management | `/custom/mjlfinancement/budgetlines.php`, POST `create`, `update`, `activate` | Governed DPAF/Admin management with detail, filters, lifecycle, recalculation, locked edits, and history | `IN_SCOPE` | Final UX polish only | No deactivate/close UI by design for now | DPAF/Admin-only management guard; active convention and active budget-line expense guards enforced in domain/integrity code | Focused Phase 15 E2E added | Production docs should keep budget-line ownership and revision floor visible | `mjl_workspace_require_reference_data_access()` plus `budgetline/write` for actions | Phase 15 covers rights, CRUD, locked edits, recalculation, and expense integration | `llx_mjlfinancement_budget_line`, `MjlWorkflowAction`, linked expenses | `READY_FOR_POC` | Deactivation policy remains a later business decision |
| Fund receipts reference | `/custom/mjlfinancement/fundreceipts.php` | Read-only supervision/reference list | `IN_SCOPE` | Better monitoring/detail/document state for supervision | Full create/edit/upload workflow deferred | Normal direct URL access is blocked despite broad read rights | Full management tests not required for current selected scope; supervision tests remain partial | Production docs must state read-only supervision scope | `mjl_workspace_require_reference_data_access()` | `npm run test:e2e` passed, 59/59 | `llx_mjlfinancement_fund_receipt`, ECM evidence | `PARTIAL` | Production-managed fund receipt workflow deferred beyond current scope |
| Internal production roadmap | `/custom/mjlfinancement/roadmap.php` | Admin-only future-scope page | `OUT_OF_SCOPE` | None; must stay internal | None | Admin-only guard must remain | Direct URL tests passed | Matrix row | `empty($user->admin)` guard | `npm run test:e2e` passed, 59/59 | Static internal content | `OUT_OF_SCOPE` | Not a production user feature |
| Dolibarr native projects/tasks | Native Dolibarr project/task screens | Used as linked native data | `IN_SCOPE` | Normal-user MJL screens must expose only needed project context | Native management remains Dolibarr-owned for Admin/DPAF | Native permissions need deployment setup | Smoke/E2E setup checks | Deployment docs must cover native modules | Bootstrap activates project module; custom queries filter entity | Activity/export tests | Native project/task tables | `PARTIAL` | Production permission setup must be documented and rehearsed |
| Dolibarr native third parties / donors | Native Dolibarr third-party screens | Used for PTF/bailleurs through conventions | `IN_SCOPE` | Normal-user MJL screens must expose donor context where relevant | Native management remains Dolibarr-owned for Admin/DPAF | Native permissions need deployment setup | Setup checks | Deployment docs must cover native modules | Bootstrap activates third parties module | Export/report tests | Native `societe` table | `PARTIAL` | Production permission setup must be documented and rehearsed |
| Dolibarr native ECM / documents | Native ECM plus MJL expense uploads/downloads | ECM is storage layer; expense downloads go through the MJL guarded route | `IN_SCOPE` | Preview planned later; activity/convention document handling later | None known for expense download | Download route is MJL-guarded and refuses generic/non-expense ECM rows | Secure download tests added to Phase 11 | Deployment docs cover storage/backup and guarded route expectations | Upload guarded in expense page; download guarded by `documentdownload.php`, `mjl_expense_document_fetch_download_row()`, and realpath containment | `phase11-expense-workflow.spec.js`; `npm run test:e2e` passed after implementation | `llx_ecm_files` and ECM directory | `PARTIAL` | Preview and non-expense document workflows remain later |
| Public registration | Native Dolibarr registration if enabled | Forbidden by product rules | `OUT_OF_SCOPE` | None | Must remain disabled/unlinked | No public register UI in tested auth/workspace flows | Auth tests check forbidden labels | Deployment docs state invitation-only | Auth templates avoid register links | `npm run test:e2e` passed, 59/59 | Configuration/runtime behavior | `OUT_OF_SCOPE` | Runtime config must be checked during deployment |
| OHADA/SYSCOHADA accounting engine | Not implemented | Not selected | `OUT_OF_SCOPE` | None | None | None | None | Matrix row only | Not exposed as MJL production feature | Not applicable | Native accounting may exist but is not MJL feature | `OUT_OF_SCOPE` | Explicit client selection required |
| Payroll, procurement, bank reconciliation/API, SMS, OCR, external portal, offline mode, AI reporting | Not implemented | Not selected | `OUT_OF_SCOPE` | None | None | None | None | Matrix row only | Not exposed as MJL production feature | Not applicable | None | `OUT_OF_SCOPE` | Explicit client selection required |

## Production Scope Summary

- `READY`: none yet. The repository has strong POC-valid evidence, but this
  matrix requires a fresh full verification pass before any production row is
  marked `READY`.
- `PARTIAL`: dashboard, navigation, activities, expenses, alerts, DPAF
  dashboard, exports, validation history, audit history, exchange logs, auth
  and invitation flows, convention/envelope management, budget-line management,
  fund receipt supervision, native project/PTF/ECM integrations.
- `BLOCKED_NEEDS_DECISION`: final export/report columns, official templates,
  final permission matrix, DPAF/N2 escalation rules, final role model, and
  production email/base URL settings.
- `OUT_OF_SCOPE`: public registration, internal roadmap as user feature,
  full accounting engine, payroll, procurement, bank reconciliation/API, SMS,
  OCR, external portal, offline mode, AI-assisted reporting.

## Version Eligibility

The module is not eligible for `1.0.0` yet. It remains `0.7.0` because no
`IN_SCOPE` production row has been proven `READY` by this matrix.
