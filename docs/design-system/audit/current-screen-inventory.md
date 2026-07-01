# MJL Clarity System — Current Screen Inventory

## Scope

This inventory is documentation-only. It is based on repo-visible files and docs, not browser screenshots or runtime probing.

Evidence categories:

- Repo-confirmed custom screens: files under `custom/mjlfinancement/`.
- Dolibarr-native runtime surfaces: inferred from the Dockerized Dolibarr setup, bootstrap docs, activated modules, and design-system requirements. Their source is not locally inspected in this repository.

Fixed constraints:

- Dolibarr core files must not be modified.
- MJL implementation must stay inside safe custom module/theme boundaries.
- Target access levels use only Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- There is no public register page.
- Only Admin can send invitations for now.
- E2E tests are the main validation method.

## Screen: MJL Module Home / Generic Dashboard

- URL/path: `/custom/mjlfinancement/index.php`
- Evidence source: repo-confirmed custom screen; module menu points to this file.
- Current purpose: Shows object counts, navigation buttons, and fixed report snippets.
- Target purpose: Role-aware MJL workspace shell with clear entry points, personal/global dashboard content, alerts, and shortcuts.
- Current users: Any user with at least one MJL read right.
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems: Generic object-count dashboard; raw navigation; not yet aligned to Level 1/2/3/Admin entry points; mixed dashboard and report snippets.
- Recommended action: redesign
- Safe files to modify: `custom/mjlfinancement/index.php`, `custom/mjlfinancement/lib/mjl_dashboard.lib.php`, design-system docs.
- Implementation risk: Medium; likely becomes the main navigation shell and must preserve rights checks.
- Affected E2E scenarios: Role visibility, activity lifecycle, alerts, export.
- Review decision: Redesign as first MJL workspace shell after UI audit.

## Screen: DPAF Dashboard

- URL/path: `/custom/mjlfinancement/dpafdashboard.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Shows DPAF KPIs, deadline alerts, pending reviews, budget/expense summaries, funds, and audit rows.
- Target purpose: Level 3 supervision dashboard focused on risks, bottlenecks, missing documents, and export shortcuts.
- Current users: Users with `mjlfinancement/report/read`.
- Target access level: Level 3 / Admin
- Current problems: Table-heavy; limited action links; KPI hierarchy is basic; alerts are not presented as action cards.
- Recommended action: redesign
- Safe files to modify: `custom/mjlfinancement/dpafdashboard.php`, custom dashboard helpers, design-system docs.
- Implementation risk: Medium; dashboard queries must remain active-entity safe.
- Affected E2E scenarios: Alerts, role visibility, export.
- Review decision: Redesign after inventory and UI audit review.

## Screen: Activities

- URL/path: `/custom/mjlfinancement/activities.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Create draft activities, list activities, submit/correct/validate/reject/request correction, and show recent workflow history.
- Target purpose: Core activity workflow workspace with status-first detail, validation timeline, decision panel, document checklist, and role-aware actions.
- Current users: Users with `activity/read`; write and validation controls depend on `activity/write` and `activity/validate`.
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems: List and forms are dense; no rich activity detail page; workflow history is separate from object context; status labels are technical in places; supporting documents are not surfaced.
- Recommended action: redesign
- Safe files to modify: `custom/mjlfinancement/activities.php`, `custom/mjlfinancement/class/mjlactivity.class.php`, custom workflow helpers, design-system docs.
- Implementation risk: High; must preserve no-self-validation, audit history, active-entity filtering, and workflow transitions.
- Affected E2E scenarios: Activity lifecycle, return for correction, alerts, role visibility.
- Review decision: Redesign as a priority workflow screen.

## Screen: Expenses

- URL/path: `/custom/mjlfinancement/expenses.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Create draft expenses, upload supporting documents, submit, validate, reject, correct, and list latest expenses.
- Target purpose: Expense workflow workspace with clear document state, status badges, validation decision panel, and traceable correction flow.
- Current users: Users with `expense/read`; write/upload/validation controls depend on `expense/write`, `expense/validate`, and ECM upload rights.
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems: Dense inline forms; no rich detail page; document upload is technical; no document preview/download path; actions are cramped in table cells.
- Recommended action: redesign
- Safe files to modify: `custom/mjlfinancement/expenses.php`, `custom/mjlfinancement/class/mjlexpense.class.php`, ECM integration helpers, design-system docs.
- Implementation risk: High; expense validation has important budget, document, and audit rules.
- Affected E2E scenarios: Activity lifecycle where expense state matters, export, role visibility.
- Review decision: Redesign after activity workflow priorities are confirmed.

## Screen: Reports And CSV Exports

- URL/path: `/custom/mjlfinancement/reports.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Select fixed reports, filter them, preview table output, and export CSV when authorized.
- Target purpose: Official exports center with clear report descriptions, filter context, role restrictions, format, and filename preview.
- Current users: Users with `report/read`; CSV/XLSX export requires `export/write`.
- Target access level: Level 3 / Admin
- Current problems: Generic MJL reports are available; final donor-specific canevas are not yet supplied.
- Recommended action: keep as official outputs center and add donor templates when provided.
- Safe files to modify: `custom/mjlfinancement/reports.php`, `custom/mjlfinancement/lib/mjl_reporting.lib.php`, `custom/mjlfinancement/lib/mjl_csv_export.lib.php`, `custom/mjlfinancement/lib/mjl_xlsx_export.lib.php`, design-system docs.
- Implementation risk: Medium; must preserve UTF-8 BOM, semicolon CSV, native XLSX generation, French headers, stable filenames, and filters.
- Affected E2E scenarios: Export, role visibility.
- Review decision: Phase 17 hardens generic CSV/XLSX outputs; donor-specific canevas remain a client-input dependency.

## Screen: Conventions

- URL/path: `/custom/mjlfinancement/conventions.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Read-only list of conventions.
- Target purpose: DPAF/Admin convention management surface for creation, governed edits, activation, closure, and history.
- Current users: Users with `convention/read`.
- Target access level: Level 3 / Admin
- Current problems: Management workflow implemented in Phase 14; continue monitoring for budget-line reuse and report impacts.
- Recommended action: keep as governed DPAF/Admin management surface
- Safe files to modify: `custom/mjlfinancement/conventions.php`, custom labels/navigation, design-system docs.
- Implementation risk: Medium; naming and IA decision affects reports, activities, budget lines, and exports.
- Affected E2E scenarios: Role visibility, export.
- Review decision: Resolved in Phase 14 planning: keep label `Convention`, place under DPAF/Admin supervision.

## Screen: Budget Lines

- URL/path: `/custom/mjlfinancement/budgetlines.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Governed DPAF/Admin budget-line management with create, edit, activation, filters, recalculation, locked edits, and history.
- Target purpose: Finance setup/supervision surface with embedded budget context inside project/activity/expense flows where useful.
- Current users: Users with `budgetline/read`.
- Target access level: Level 3 / Admin
- Current problems: Future deactivate/close lifecycle depends on final MJL business policy.
- Recommended action: keep as governed DPAF/Admin management surface
- Safe files to modify: `custom/mjlfinancement/budgetlines.php`, `custom/mjlfinancement/class/mjlbudgetline.class.php`, custom navigation, design-system docs.
- Implementation risk: Medium; budget data affects expense validation and exports.
- Affected E2E scenarios: Expense validation, export, role visibility.
- Review decision: Keep out of normal Level 1/2 navigation; preserve domain-level budget-line and expense guards.

## Screen: Fund Receipts

- URL/path: `/custom/mjlfinancement/fundreceipts.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Governed DPAF/Admin fund receipt management with create, edit, proof upload/download, received/not-received lifecycle, filters, and history.
- Target purpose: Fund receipt monitoring and management with readable project/convention/PTF labels and supporting document state.
- Current users: Users with `fundreceipt/read`.
- Target access level: Level 3 / Admin
- Current problems: Management workflow implemented in Phase 16; continue monitoring report/dashboard impact and proof-document ergonomics.
- Recommended action: keep as governed DPAF/Admin management surface
- Safe files to modify: `custom/mjlfinancement/fundreceipts.php`, custom fund-receipt helpers/classes, design-system docs.
- Implementation risk: Medium; must preserve financial traceability and active-entity filtering.
- Affected E2E scenarios: Export, role visibility, secure document download.
- Review decision: Keep out of normal Level 1/2 navigation; preserve active-convention, proof, and entity guards.

## Screen: Expense Validation History

- URL/path: `/custom/mjlfinancement/validations.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Read-only validation history for expenses.
- Target purpose: Audit trail named clearly as `Historique des validations de dépenses`.
- Current users: Users with `validation/read`.
- Target access level: Level 2 / Level 3 / Admin
- Current problems: Current title is generic; tied to expenses but label does not say so; table is raw and isolated.
- Recommended action: rename
- Safe files to modify: `custom/mjlfinancement/validations.php`, custom navigation labels, design-system docs.
- Implementation risk: Low; read-only audit screen but labels must not weaken traceability.
- Affected E2E scenarios: Activity lifecycle where audit is verified, role visibility.
- Review decision: Rename and later integrate into contextual audit views.

## Screen: Workflow Actions

- URL/path: `/custom/mjlfinancement/workflowactions.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Generic workflow-action audit trail with filters.
- Target purpose: Advanced audit evidence surface for supervision/admin/audit review.
- Current users: Users with `workflowaction/read`.
- Target access level: Level 3 / Admin
- Current problems: Technical fields such as object type, object ID, raw status, and `changes_json`; too detailed for normal users.
- Recommended action: advanced-only
- Safe files to modify: `custom/mjlfinancement/workflowactions.php`, custom audit helpers, design-system docs.
- Implementation risk: Medium; must preserve audit detail and filtering.
- Affected E2E scenarios: Activity lifecycle, return for correction, role visibility.
- Review decision: Keep available to advanced users; normal users should see contextual timelines instead.

## Screen: Exchange Logs

- URL/path: `/custom/mjlfinancement/exchangelogs.php`
- Evidence source: repo-confirmed custom screen.
- Current purpose: Create and filter activity-linked exchange logs.
- Target purpose: Contextual exchange timeline tied to activities or other MJL objects.
- Current users: Users with `exchangelog/read`; create requires `exchangelog/write`.
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems: Object type/object ID fields are technical; defaults to activity linkage only; not visually connected to activity detail.
- Recommended action: redesign
- Safe files to modify: `custom/mjlfinancement/exchangelogs.php`, `custom/mjlfinancement/class/mjlexchangelog.class.php`, design-system docs.
- Implementation risk: Medium; exchange queries must remain active-entity safe and traceable.
- Affected E2E scenarios: Alerts if exchange follows action, role visibility, future activity lifecycle.
- Review decision: Redesign as contextual traceability, not a standalone technical table for normal users.

## Screen: Login Page

- URL/path: Dolibarr-native login page, runtime surface inferred from Dockerized Dolibarr.
- Evidence source: inferred runtime surface from Dolibarr setup and auth design-system requirements; source not locally inspected.
- Current purpose: Native Dolibarr authentication.
- Target purpose: MJL-branded login page with French-first, institutional wording.
- Current users: Anonymous invited users and existing users.
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems: Not confirmed as MJL-branded; may expose generic Dolibarr identity.
- Recommended action: redesign
- Safe files to modify: Documented custom theme/hook/config boundary only; no Dolibarr core files.
- Implementation risk: High until a safe custom theme or hook path is documented.
- Affected E2E scenarios: Invitation and first access, forgotten password, role visibility.
- Review decision: Redesign only after safe implementation boundary is documented.

## Screen: Forgotten And Reset Password Pages

- URL/path: Dolibarr-native password recovery/reset pages, runtime surfaces inferred from Dockerized Dolibarr.
- Evidence source: inferred runtime surface from Dolibarr setup and auth/security design-system requirements; source not locally inspected.
- Current purpose: Native password recovery and reset.
- Target purpose: MJL-branded recovery/reset pages with neutral account-enumeration-safe wording.
- Current users: Invited or existing users.
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems: Wording and branding are not confirmed; must not reveal whether an account exists.
- Recommended action: redesign
- Safe files to modify: Documented custom theme/hook/config boundary only; no Dolibarr core files.
- Implementation risk: High until a safe custom theme or hook path is documented.
- Affected E2E scenarios: Forgotten password, invitation and first access.
- Review decision: Redesign only after safe implementation boundary is documented.

## Screen: Public Registration

- URL/path: Dolibarr-native registration surface if enabled, runtime surface inferred.
- Evidence source: inferred from Dolibarr auth capabilities and design-system prohibition; source not locally inspected.
- Current purpose: Public account creation if enabled by configuration.
- Target purpose: Not available; access must be invitation-only.
- Current users: Anonymous users if enabled.
- Target access level: Admin
- Current problems: Any public registration path conflicts with no public register page.
- Recommended action: hide for normal users
- Safe files to modify: Configuration/custom setup only; no Dolibarr core files.
- Implementation risk: High if enabled; must be verified in runtime configuration before auth work.
- Affected E2E scenarios: Invitation and first access, role visibility.
- Review decision: Verify disabled; do not build or expose registration.

## Screen: Native Dolibarr Home And Navigation

- URL/path: Dolibarr-native home/navigation, runtime surface inferred.
- Evidence source: inferred runtime surface from Dockerized Dolibarr; module menu links to MJL index.
- Current purpose: Generic ERP landing and navigation.
- Target purpose: Normal users land in MJL workspace; Admin/technical users may retain advanced access.
- Current users: Authenticated Dolibarr users.
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems: Can expose generic ERP complexity and non-MJL menus.
- Recommended action: hide for normal users
- Safe files to modify: Permissions, menu configuration, custom module navigation, documented custom theme/hook/config boundary; no Dolibarr core files.
- Implementation risk: High; hiding must not block Admin technical access.
- Affected E2E scenarios: Role visibility.
- Review decision: Hide progressively for normal users after role visibility audit.

## Screen: Native Third Parties / PTF Reference Data

- URL/path: Dolibarr-native third-party screens, runtime surfaces inferred.
- Evidence source: inferred from module dependency on `modSociete`, bootstrap activation, and sample PTF data.
- Current purpose: Manage third parties/PTFs/bailleurs.
- Target purpose: Admin/Level 3 reference-data area, not normal workflow.
- Current users: Users with relevant native Dolibarr rights.
- Target access level: Level 3 / Admin
- Current problems: Native labels may expose customer/supplier/ERP wording; normal users should not manage reference data.
- Recommended action: advanced-only
- Safe files to modify: Permissions, custom navigation, possible MJL wrapper pages; no Dolibarr core files.
- Implementation risk: Medium; PTF data is linked to conventions, reports, and exports.
- Affected E2E scenarios: Role visibility, export.
- Review decision: Keep as advanced/reference data unless human review requests a custom MJL PTF screen.

## Screen: Native Projects And Tasks

- URL/path: Dolibarr-native project/task screens, runtime surfaces inferred.
- Evidence source: inferred from module dependency on `modProjet`, activity links, and bootstrap sample projects/tasks.
- Current purpose: Manage projects and tasks.
- Target purpose: Expose project/task context through MJL project and activity screens where possible.
- Current users: Users with relevant native Dolibarr rights.
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems: Native project/task UI may not match MJL workflows; raw Dolibarr concepts may confuse users.
- Recommended action: simplify
- Safe files to modify: Custom MJL pages/navigation and permissions; no Dolibarr core files.
- Implementation risk: Medium; projects/tasks are reused by activities, budgets, reports, and exports.
- Affected E2E scenarios: Activity lifecycle, export, role visibility.
- Review decision: Keep native model, simplify access through MJL UI.

## Screen: Native ECM / Documents

- URL/path: Dolibarr-native ECM/document screens, runtime surfaces inferred.
- Evidence source: inferred from module dependency on `modECM`, expense upload behavior, and document placeholders.
- Current purpose: Store and manage supporting documents.
- Target purpose: MJL document checklist and context-aware document access while preserving ECM as storage.
- Current users: Users with ECM rights.
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems: Native document UI is not tied clearly to MJL validation workflows; expense screen has upload but no preview/download flow.
- Recommended action: simplify
- Safe files to modify: Custom MJL document views/checklists and ECM links; no Dolibarr core files.
- Implementation risk: High; documents are required for expense validation and auditability.
- Affected E2E scenarios: Activity lifecycle, export, role visibility.
- Review decision: Preserve ECM; surface documents in MJL context.

## Screen: Native Users / Groups / Permissions / Admin

- URL/path: Dolibarr-native users, groups, permissions, and admin screens, runtime surfaces inferred.
- Evidence source: inferred from bootstrap user/group creation and design-system Admin access requirements.
- Current purpose: Technical user, group, permission, and system administration.
- Target purpose: Admin-only technical area; future invitation management should hide unnecessary Dolibarr complexity.
- Current users: Admin/technical users.
- Target access level: Admin
- Current problems: Too technical for normal users; not invitation-centered.
- Recommended action: advanced-only
- Safe files to modify: Custom admin/invitation pages, permissions, module setup; no Dolibarr core files.
- Implementation risk: High; access control and invitation-only model depend on this area.
- Affected E2E scenarios: Invitation and first access, role visibility.
- Review decision: Keep native admin advanced-only; build MJL invitation UI separately if needed.

## Screen: Native Dolibarr Export Module

- URL/path: Dolibarr-native export module, runtime surface inferred.
- Evidence source: inferred from module dependency on `modExport`, bootstrap activation, and custom reports page.
- Current purpose: Generic Dolibarr exports.
- Target purpose: Advanced technical export option; normal official outputs should use MJL reports and exports.
- Current users: Users with native export rights.
- Target access level: Level 3 / Admin
- Current problems: Generic export module may expose technical table/entity concepts.
- Recommended action: advanced-only
- Safe files to modify: Permissions, navigation, custom MJL reports/exports; no Dolibarr core files.
- Implementation risk: Medium; export rights overlap with official output expectations.
- Affected E2E scenarios: Export, role visibility.
- Review decision: Keep advanced; prioritize MJL official outputs.

## Screen: Module Setup / Configuration

- URL/path: Dolibarr-native module setup/configuration, runtime surface inferred.
- Evidence source: inferred from module declaration, bootstrap activation, and Admin setup requirements.
- Current purpose: Activate/configure modules and technical settings.
- Target purpose: Admin/technical-only setup area.
- Current users: Admin/technical users.
- Target access level: Admin
- Current problems: Technical Dolibarr surface; should not appear in normal MJL workflows.
- Recommended action: advanced-only
- Safe files to modify: Module setup scripts/config documentation/custom module settings; no Dolibarr core files.
- Implementation risk: Medium; setup changes can affect permissions and module availability.
- Affected E2E scenarios: Role visibility.
- Review decision: Keep advanced-only.
