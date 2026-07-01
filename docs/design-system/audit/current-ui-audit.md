# MJL Clarity System — Current UI Audit

## Scope

This audit is documentation-only. It compares current UI evidence against the MJL Clarity System and the current screen inventory in `docs/design-system/audit/current-screen-inventory.md`.

Evidence used:

- static repository inspection;
- design-system documentation under `docs/design-system/`;
- current screen inventory;
- module declaration evidence from `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`.

Evidence not used:

- browser screenshots;
- runtime probing;
- manual UI walkthroughs;
- Dolibarr core source inspection outside this repository.

## Fixed Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must stay inside safe custom module/theme boundaries.
- The temporary access model is Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- There is no public register page.
- Only Admin can send invitations for now.
- E2E tests are the primary validation method for UI, auth, dashboard, export, official output, and workflow changes.
- Existing workflow rules, audit history, exports, active-entity filtering, and no-self-validation behavior must be preserved.

## Overall Verdict

The current POC is technically credible: the custom module contains real MJL objects, permissions, workflows, audit history, dashboard data, and export behavior. However, the current UI is not yet MJL Clarity System compliant.

The visible product direction is still closer to a raw Dolibarr/table-heavy POC than a calm administrative control room for externally funded projects. The first source change should therefore be a reviewed, safe-boundary implementation inside `custom/mjlfinancement`, not a Dolibarr core edit.

## Global Findings

- The UI currently has a raw Dolibarr/table-heavy POC feel; it exposes data structures before user intent.
- Role-aware landing pages are missing; Level 1, Level 2, Level 3, and Admin do not yet have clearly separated workspace entry points.
- Dense inline forms and action buttons make validation screens harder to scan.
- Workflow is not yet presented as timelines and decision panels; buttons and history tables carry too much meaning alone.
- Alerts are not consistently actionable; they need affected object, actor, expected action, urgency, and destination.
- Raw IDs, statuses, object types, and technical fields are visible in several normal-user paths.
- Exports are functional but not yet framed as official outputs with scope, period, filename, format, and role context.
- Document UX is incomplete outside expense upload; ECM should remain the storage layer, while MJL screens need document checklists and contextual access.
- Native auth and invitation pages are required by the design system. Phase 4a safe-boundary discovery is now complete for auth/access surfaces.
- The selected safe boundary uses module `tpl`, `hooks`, `css`, `MAIN_LANDING_PAGE`, and custom module pages; Dolibarr core remains untouched.

## Per-Screen Audit

### MJL Module Home / Generic Dashboard

- Alignment: Partial. It exists as a custom entry point but is still object-count and navigation oriented.
- Severity: Critical.
- Design-system gaps: No role-aware workspace shell; no dominant question; alerts and next actions are not the primary structure.
- Safe implementation area: `custom/mjlfinancement/index.php`, `custom/mjlfinancement/lib/mjl_dashboard.lib.php`, design-system docs.
- E2E impact: Role visibility, activity lifecycle, alerts, export.
- Recommendation: Make this the first actionable UI implementation: a Level-aware MJL workspace shell that preserves permissions and active-entity behavior.

### DPAF Dashboard

- Alignment: Partial. It contains relevant supervision data but presents it in a dense table/KPI style.
- Severity: High.
- Design-system gaps: Alerts are not consistently action cards; Level 3 supervision hierarchy is limited; bottlenecks and deadlines need clearer decision structure.
- Safe implementation area: `custom/mjlfinancement/dpafdashboard.php`, custom dashboard helpers, design-system docs.
- E2E impact: Alerts, role visibility, export.
- Recommendation: Redesign after the workspace shell with dashboard cards, pending review views, deadline risk presentation, and export shortcuts.

### Activities

- Alignment: Partial. It implements core workflow behavior but not the target workflow experience.
- Severity: Critical.
- Design-system gaps: Status is not dominant; validation is not a timeline; decision actions are dense; supporting documents are not surfaced; audit context is separate.
- Safe implementation area: `custom/mjlfinancement/activities.php`, `custom/mjlfinancement/class/mjlactivity.class.php`, custom workflow helpers, design-system docs.
- E2E impact: Activity lifecycle, return for correction, alerts, role visibility.
- Recommendation: Redesign as the first workflow UI after shell/dashboards, preserving no-self-validation, workflow transitions, permissions, audit history, and active-entity filtering.

### Expenses

- Alignment: Partial. Expense creation, upload, submission, correction, and validation exist, but the screen is not yet clarity-first.
- Severity: High.
- Design-system gaps: Dense inline form; technical document upload; no clear document preview/download path; cramped table actions.
- Safe implementation area: `custom/mjlfinancement/expenses.php`, `custom/mjlfinancement/class/mjlexpense.class.php`, ECM integration helpers, design-system docs.
- E2E impact: Activity lifecycle where expense state matters, export, role visibility.
- Recommendation: Defer until the activity workflow pattern is stable, then apply the same status-first and document-checklist structure.

### Reports And CSV/XLSX Exports

- Alignment: Medium. The reports center presents official-output context and supports CSV plus XLSX through the Dolibarr-native Excel 2007 driver.
- Severity: Medium.
- Design-system gaps: Final donor-specific canevas and client-approved report columns are still missing.
- Safe implementation area: `custom/mjlfinancement/reports.php`, `custom/mjlfinancement/lib/mjl_reporting.lib.php`, `custom/mjlfinancement/lib/mjl_csv_export.lib.php`, `custom/mjlfinancement/lib/mjl_xlsx_export.lib.php`, design-system docs.
- E2E impact: Export, role visibility.
- Recommendation: Keep CSV and XLSX generated from the same report definitions; add donor-specific templates only after MJL supplies official canevas.

### Conventions

- Alignment: Medium. Phase 14 turns it into a governed DPAF/Admin management surface with lifecycle actions and history.
- Severity: Low.
- Design-system gaps: Budget-line reuse and broader reporting impacts should be reviewed in the next finance setup batch.
- Safe implementation area: `custom/mjlfinancement/conventions.php`, custom labels/navigation, design-system docs.
- E2E impact: Role visibility, export.
- Recommendation: Keep `Convention` as the DPAF/Admin control surface and reuse its locking/history pattern for budget-line management.

### Budget Lines

- Alignment: Medium. Phase 15 turns it into a governed DPAF/Admin management surface with lifecycle action, recalculation, locked edits, and history.
- Severity: Low.
- Design-system gaps: Final deactivate/close policy remains a business decision; contextual budget summaries can still be improved later inside expense/activity flows.
- Safe implementation area: `custom/mjlfinancement/budgetlines.php`, `custom/mjlfinancement/class/mjlbudgetline.class.php`, custom navigation, design-system docs.
- E2E impact: Expense validation, export, role visibility.
- Recommendation: Keep advanced-only, preserve domain-level guards, and later surface budget context inside activity/expense/report workflows.

### Fund Receipts

- Alignment: Good. It is now a governed DPAF/Admin management surface with readable labels, lifecycle actions, proof state, and timeline evidence.
- Severity: Low.
- Design-system gaps: Continue monitoring final wording and proof-document ergonomics after real user review.
- Safe implementation area: `custom/mjlfinancement/fundreceipts.php`, custom fund-receipt helpers/classes, design-system docs.
- E2E impact: Export, role visibility, secure document download.
- Recommendation: Keep as Level 3/Admin finance setup surface; preserve active-convention and proof-before-received guards.

### Expense Validation History

- Alignment: Partial. It preserves traceability but is isolated and generically named.
- Severity: Low.
- Design-system gaps: Title is too generic; expense scope is unclear; audit history is not contextualized inside related workflows.
- Safe implementation area: `custom/mjlfinancement/validations.php`, custom navigation labels, design-system docs.
- E2E impact: Activity lifecycle where audit is verified, role visibility.
- Recommendation: Rename clearly and later embed relevant validation history into expense/activity detail views.

### Workflow Actions

- Alignment: Low for normal users, acceptable as an advanced audit surface.
- Severity: Medium.
- Design-system gaps: Raw object type, object ID, raw status, and `changes_json` expose implementation details.
- Safe implementation area: `custom/mjlfinancement/workflowactions.php`, custom audit helpers, design-system docs.
- E2E impact: Activity lifecycle, return for correction, role visibility.
- Recommendation: Keep advanced-only for Level 3/Admin and use contextual timelines for normal workflow screens.

### Exchange Logs

- Alignment: Partial. It supports traceability but is not yet contextual.
- Severity: Medium.
- Design-system gaps: Technical object type/object ID fields; standalone table feel; weak connection to activity detail.
- Safe implementation area: `custom/mjlfinancement/exchangelogs.php`, `custom/mjlfinancement/class/mjlexchangelog.class.php`, design-system docs.
- E2E impact: Alerts if exchange follows action, role visibility, future activity lifecycle.
- Recommendation: Redesign later as contextual exchange timelines attached to activities or MJL objects.

### Login Page

- Alignment: Unknown/low. It is inferred as native Dolibarr login and not confirmed MJL-branded.
- Severity: Critical.
- Design-system gaps: Auth is part of the product, but the safe customization path is not documented.
- Safe implementation area: Documentation/config investigation only until a custom theme, hook, or config boundary is confirmed; no Dolibarr core files.
- E2E impact: Invitation and first access, forgotten password, role visibility.
- Recommendation: Do not implement auth UI yet. Start Phase 4a to document the safe boundary for login customization.

### Forgotten And Reset Password Pages

- Alignment: Unknown/low. Native password flows are inferred and wording/branding is not confirmed.
- Severity: Critical.
- Design-system gaps: Required account-enumeration-safe French wording is not verified; safe customization path is not documented.
- Safe implementation area: Documentation/config investigation only until a custom theme, hook, or config boundary is confirmed; no Dolibarr core files.
- E2E impact: Forgotten password, invitation and first access.
- Recommendation: Include in Phase 4a before any auth UI implementation.

### Public Registration

- Alignment: Unknown and potentially conflicting if enabled.
- Severity: Critical.
- Design-system gaps: Public registration is forbidden by the invitation-only model.
- Safe implementation area: Configuration/custom setup verification only; no Dolibarr core files.
- E2E impact: Invitation and first access, role visibility.
- Recommendation: Verify runtime configuration disables public registration; do not create or expose any registration page.

### Native Dolibarr Home And Navigation

- Alignment: Low for normal users, acceptable only for Admin/technical access.
- Severity: High.
- Design-system gaps: Generic ERP navigation can break the MJL-first experience and expose unnecessary complexity.
- Safe implementation area: Permissions, menu configuration, custom module navigation, documented custom theme/hook/config boundary; no Dolibarr core files.
- E2E impact: Role visibility.
- Recommendation: De-emphasize via the custom MJL workspace first; defer native menu hiding until role visibility audit and E2E coverage are ready.

### Native Third Parties / PTF Reference Data

- Alignment: Partial as native reference data, low as normal workflow UI.
- Severity: Medium.
- Design-system gaps: Native customer/supplier/ERP wording may not match PTF/bailleur mental models; normal users should not manage reference data.
- Safe implementation area: Permissions, custom navigation, possible MJL wrapper pages; no Dolibarr core files.
- E2E impact: Role visibility, export.
- Recommendation: Keep advanced/reference-data only unless human review requests a custom MJL PTF screen.

### Native Projects And Tasks

- Alignment: Partial. The native model is useful, but native UI may not match MJL workflows.
- Severity: Medium.
- Design-system gaps: Raw project/task concepts can distract from activities, validation, budgets, and reporting.
- Safe implementation area: Custom MJL pages/navigation and permissions; no Dolibarr core files.
- E2E impact: Activity lifecycle, export, role visibility.
- Recommendation: Preserve native model and expose project/task context through MJL workflow screens.

### Native ECM / Documents

- Alignment: Partial as storage, low as user-facing document UX.
- Severity: High.
- Design-system gaps: Documents are not consistently tied to validation state; upload exists for expenses but checklist, preview/download, and missing-document state are incomplete.
- Safe implementation area: Custom MJL document views/checklists and ECM links; no Dolibarr core files.
- E2E impact: Activity lifecycle, export, role visibility.
- Recommendation: Preserve ECM and surface documents contextually in activity/expense workflow screens.

### Native Users / Groups / Permissions / Admin

- Alignment: Partial for Admin, low for invitation-centered access UX.
- Severity: High.
- Design-system gaps: Native admin is technical; invitation lifecycle is not a first-class MJL surface.
- Safe implementation area: Custom admin/invitation pages, permissions, module setup; no Dolibarr core files.
- E2E impact: Invitation and first access, role visibility.
- Recommendation: Keep native admin advanced-only and design MJL invitation management only after auth/access boundary discovery.

### Native Dolibarr Export Module

- Alignment: Low for normal official outputs, acceptable as advanced technical export.
- Severity: Medium.
- Design-system gaps: Generic export module exposes technical table/entity concepts and does not frame outputs as MJL official reports.
- Safe implementation area: Permissions, navigation, custom MJL reports/exports; no Dolibarr core files.
- E2E impact: Export, role visibility.
- Recommendation: Keep advanced-only and prioritize custom MJL reports for official outputs.

### Module Setup / Configuration

- Alignment: Acceptable as Admin-only technical setup.
- Severity: Low.
- Design-system gaps: Should not appear in normal workflows; setup changes need clear documentation.
- Safe implementation area: Module setup scripts/config documentation/custom module settings; no Dolibarr core files.
- E2E impact: Role visibility.
- Recommendation: Keep advanced-only and document any setup changes that affect permissions, auth, or navigation.

## First Implementation Scope

### 1. Phase 4a — Auth/access boundary discovery and decision

Status: completed.

- Login, forgotten-password, and reset templates are supplied through module `tpl`.
- Auth styling is supplied through module `css`.
- Password-reset behavior and login-failure wording are supplied through module `hooks`.
- Post-login landing uses Dolibarr's `MAIN_LANDING_PAGE` constant.
- Invitation acceptance and Admin invitation management are custom module pages.
- Dolibarr core files remain out of scope.

### 2. Phase 5 — MJL workspace shell in custom module

This is the first actionable UI implementation after audit review.

- Redesign `/custom/mjlfinancement/index.php` as the MJL-first role-aware workspace shell.
- Use custom-module navigation to de-emphasize advanced screens for normal users.
- Preserve all permissions and active-entity behavior.

### 3. Phase 6 — Level dashboards and actionable alerts

- Improve `/custom/mjlfinancement/index.php` and `/custom/mjlfinancement/dpafdashboard.php`.
- Add dashboard cards, next actions, pending validation views, deadline-risk presentation, and Level 3 supervision structure.
- Preserve DPAF dashboard data and active-entity filtering.

### 4. Phase 7 — Activity workflow UI

- Improve `/custom/mjlfinancement/activities.php`.
- Add status-first layout, validation timeline, decision panel, correction clarity, contextual audit preview, and supporting document placeholder/checklist.
- Preserve no-self-validation, audit history, permissions, and workflow transitions.

## Deferred Work

- Native menu hiding, dashboards, reports, email polish beyond auth/access, and activity workflow redesign remain outside Phase 4.
- Reports/export redesign is deferred until shell, dashboards, and activity workflow are stable.
- Email templates are deferred until invitation/auth flow is specified.
- Convention naming and DPAF/Admin management are resolved by Phase 14; later work should preserve the `Convention` label and governed management surface.
- Native Dolibarr menu hiding is deferred until role visibility audit and E2E plan are ready.

## Review Checklist

- This audit is documentation-only.
- No source files should change as part of this phase.
- All 21 screens from `current-screen-inventory.md` are represented.
- Every screen entry includes alignment, severity, gaps, safe area, E2E impact, and recommendation.
- Phase 4a auth/access boundary discovery appears before auth UI implementation.
- No recommendation requires Dolibarr core edits.
