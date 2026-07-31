# MJL Clarity System - Current Screen Inventory

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file is current-state evidence only.

## Scope

This inventory is documentation-only. It lists repo-visible screens and helper
routes that matter for UI, auth, dashboards, exports, documents, and workflow
coverage.

| Screen | Route/path | Current purpose | Access notes | Current-state caveat |
| --- | --- | --- | --- | --- |
| Workspace dashboard | `/custom/mjlfinancement/index.php` | Role-aware enriched cards with definition/scope/period/freshness/destination metadata, local source-unavailable states, scoped filters, alerts context, and Admin-only unresolved-data diagnostics. | Any user who can enter the MJL workspace; server queries retain role/entity/scope guards. | Fixture and compatibility identifiers still contain POC-era vocabulary. |
| Partenaires / Programmes | `/custom/mjlfinancement/partners.php` | Partner/programme list/detail and related data. | Scoped by MJL helpers. | Needs current browser verification. |
| Projects | `/custom/mjlfinancement/projects.php` | Project list/detail, dedicated create/edit states, shared scoped filters/pagination, related MJL objects, notes. | Create/edit actions are caller-authorized; direct presentation routes, POST actions, project objects, recovery state, filters, and partner options retain MJL permission/entity/scope guards. | Responsive project-list cards and consolidated list states remain in Workstream 3D.2. |
| Activities | `/custom/mjlfinancement/activities.php` | Activity lifecycle, shared scoped filters/pagination, responsive operational list, execution fields, documents, timeline. | Read/write/validation helpers; route retains entity/scope filtering and fail-closed normalization. | Dense workflow detail UI remains. |
| Expenses | `/custom/mjlfinancement/expenses.php` | Expense lifecycle, shared scoped filters/pagination, evidence, prevalidation, final validation, disbursement. | Read/write/validation helpers; route retains entity/scope filtering and fail-closed normalization. | Responsive expense-list cards and dense action/forms remain. |
| Documents library | `/custom/mjlfinancement/documents.php` | Read-only accessible document list. | Document helper plus object access. | Uploads are contextual only. |
| Conventions | `/custom/mjlfinancement/conventions.php` | Governed funding-envelope management with journey summary, guarded documents, exact recovery, pagination, timeline, and canonical finance feedback. | Reference-data/supervision guards remain caller-owned. | Legacy label/role wording remains. |
| Budget lines | `/custom/mjlfinancement/budgetlines.php` | Governed budget-line management with journey summary, exact recovery, pagination, timeline, and canonical finance feedback. | Reference-data/supervision guards remain caller-owned. | Advanced finance setup surface. |
| Fund receipts | `/custom/mjlfinancement/fundreceipts.php` | Fund receipt management with journey summary, guarded proof documents, exact recovery, pagination, timeline, and canonical finance feedback. | Reference-data/supervision guards remain caller-owned. | Final wording remains subject to client review. |
| Alerts | `/custom/mjlfinancement/alerts.php` | Computed activity/expense alerts. | Activity or expense alert visibility. | Alerts are computed, not stored. |
| Supervision dashboard | `/custom/mjlfinancement/dpafdashboard.php` | Portfolio supervision metrics, role-specific queues, scoped filters, fund rows, and resolvable audit history. | Supervision access. | Route filename remains DPAF-era compatibility debt; UI labels use production wording. |
| Reports / exports | `/custom/mjlfinancement/reports.php` | Phase 11R report center with 16 report keys, GET previews/filters, explicit Partenaire / Programme filtering, CSV/XLSX POST exports, stable filenames, and export audit rows. | Supervision; export requires export write/Admin and a valid Dolibarr token. | Final donor/client canevas and final permission matrix remain pending; generic report audit rows are Admin-only in scoped audit views. |
| Validation history | `/custom/mjlfinancement/validations.php` | Expense validation history. | Reviewer/supervision/audit helper. | Read-only and not fully contextual. |
| Workflow audit | `/custom/mjlfinancement/workflowactions.php` | Generic workflow audit rows. | Advanced traceability helper. | Advanced technical screen. |
| Exchange logs | `/custom/mjlfinancement/exchangelogs.php` | Exchange log list/create surface. | Advanced traceability helper. | Should not be primary navigation. |
| Admin access | `/custom/mjlfinancement/admin/access.php` | Invitations and access administration. | Admin only. | Production email/base URL pending. |
| Invitation acceptance | `/custom/mjlfinancement/invitation.php` | Public token invitation flow. | Token and CSRF checks. | Outside app shell by design. |
| Document download | `/custom/mjlfinancement/documentdownload.php` | Guarded ECM download route. | Object-specific guards. | Helper route, not navigation. |
| Roadmap | `/custom/mjlfinancement/roadmap.php` | Internal roadmap/readiness page. | Admin plus feature flag. | Not a production user feature. |
| Login/password pages | Dolibarr auth templates/hooks | Auth and password flows with MJL styling. | Native auth plus MJL hooks. | No public registration should appear. |
