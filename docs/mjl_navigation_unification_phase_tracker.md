# MJL Navigation Unification Phase Tracker

This tracker is the execution board for `docs/mjl_navigation_unification_implementation_plan.md`.

Do not mark a phase as done without concrete evidence: file references, test
results, manual review notes, or a commit hash.

## Current Baseline

- Status date: 2026-07-02
- Design-system gate: documentation, screen inventory, and UI audit exist.
- Safe implementation boundary: `custom/mjlfinancement/`, `docs/`, tests, setup scripts, and documented deployment/setup files.
- Dolibarr core edits: forbidden.
- Existing loopholes to close:
  - worktree already contains unrelated dirty files, so every commit must stage explicit paths only;
  - `roadmap.php` is currently Admin-only but not disabled by default behind `MJL_SHOW_INTERNAL_ROADMAP`;
  - `Échanges` is currently visible in navigation for eligible users;
  - `projects.php` and `documents.php` do not exist yet;
  - project data currently relies on native Dolibarr projects through `fk_project`;
  - no first-class project-note/comment table exists yet.

## Phase 1 - Mandatory Audit

- Status: Done
- Goal: Confirm the current repo shape before implementation.
- Files/routes affected: navigation helper, workspace helper, module declaration, hooks, native guard, dashboard, workflow pages, document helper, schema/sample-data helpers.
- Completion checklist:
  - [x] Confirm design-system gate files exist.
  - [x] Confirm current MJL shell exists in `custom/mjlfinancement/lib/mjl_navigation.lib.php`.
  - [x] Confirm project data is represented by native Dolibarr projects (`llx_projet`) referenced through `fk_project`.
  - [x] Confirm `projects.php` and `documents.php` are absent.
  - [x] Confirm `roadmap.php` exists and is Admin-only but not flag-gated.
  - [x] Confirm standalone `exchangelogs.php` exists and is guarded.
- Evidence required before done: static inspection notes in the implementation-plan discussion and this tracker baseline.
- Blockers/loopholes: project notes require a new MJL table if timeline notes are implemented.
- Commit: pending

## Phase 2 - Navigation Registry

- Status: Not started
- Goal: Refactor navigation into one grouped, role-aware registry.
- Files/routes affected: `custom/mjlfinancement/lib/mjl_navigation.lib.php`, `custom/mjlfinancement/lib/mjl_workspace.lib.php`, `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`.
- Completion checklist:
  - [ ] Define primary sections: Tableau de bord, Projets, Activités, Dépenses, Financement, Documents, Supervision, Administration.
  - [ ] Keep one central registry with keys, labels, URLs, active patterns, order, descriptions, and visibility callbacks.
  - [ ] Remove visible `Échanges` from sidebar and quick links.
  - [ ] Add `Projects` and `Documents` navigation entries only where the user can open the route.
  - [ ] Add `MJL_SHOW_INTERNAL_ROADMAP` visibility check for roadmap.
  - [ ] Align module top-menu visibility with `mjl_workspace_user_can_enter()` or equivalent shared helper.
- Evidence required before done: diff references plus route/visibility test results.
- Blockers/loopholes: direct route guards must match visible links.
- Commit: pending

## Phase 3 - Sidebar Rendering

- Status: Not started
- Goal: Render a grouped MJL sidebar with active-section expansion and current-page highlighting.
- Files/routes affected: `custom/mjlfinancement/lib/mjl_navigation.lib.php`, `custom/mjlfinancement/css/mjl_app.css.php`, MJL route files that pass active keys.
- Completion checklist:
  - [ ] Remove any sidebar search behavior if present.
  - [ ] Render only primary sections by default.
  - [ ] Expand children only for the active section.
  - [ ] Highlight the current page.
  - [ ] Preserve accessible labels and no broken mobile layout.
  - [ ] Do not render the sidebar on invitation/auth surfaces.
- Evidence required before done: Playwright coverage for sidebar structure and visible-link traversal.
- Blockers/loopholes: grouped repeated links must not produce duplicate accessible names that break current tests.
- Commit: pending

## Phase 4 - Projects

- Status: Not started
- Goal: Add `/custom/mjlfinancement/projects.php` as an MJL wrapper over native Dolibarr projects.
- Files/routes affected: new `projects.php`, optional project helper class/lib, project-note schema/migration if notes are implemented, navigation and tests.
- Completion checklist:
  - [ ] Use native `llx_projet` rows as project records.
  - [ ] Filter by active entity.
  - [ ] Show list columns only when values are safely computed from conventions, activities, expenses, fund receipts, documents, and budgets.
  - [ ] Add detail view with summary, budget, related activities, expenses, documents, and notes/comments.
  - [ ] Implement notes/comments as a timeline/list, not one editable blob.
  - [ ] Keep audit separate from human notes.
  - [ ] Do not expose native `/projet` UI.
- Evidence required before done: E2E for list/detail, note creation, read-only note access, and direct native `/projet` blocking.
- Blockers/loopholes: project-note timeline requires an MJL table and migration path.
- Commit: pending

## Phase 5 - Documents

- Status: Not started
- Goal: Add `/custom/mjlfinancement/documents.php` as a read-only document library.
- Files/routes affected: new `documents.php`, `custom/mjlfinancement/lib/mjl_document.lib.php`, `documentdownload.php`, navigation and tests.
- Completion checklist:
  - [ ] Aggregate only documents the current user can access through object-level guards.
  - [ ] Include activity, expense, convention, and fund-receipt documents.
  - [ ] Use secure MJL download links only.
  - [ ] Do not expose raw ECM links.
  - [ ] Do not add a generic upload button.
  - [ ] Show contextual-upload explanation.
  - [ ] Add filters where feasible without bypassing security.
- Evidence required before done: E2E for read-only page, no upload button, guarded download links, forbidden cross-object/cross-entity rows.
- Blockers/loopholes: global document lists must not leak inaccessible object names.
- Commit: pending

## Phase 6 - Dashboard

- Status: Not started
- Goal: Keep `/custom/mjlfinancement/index.php` as MJL home and align cards with unified navigation.
- Files/routes affected: `index.php`, `mjl_dashboard.lib.php`, `mjl_navigation.lib.php`.
- Completion checklist:
  - [ ] Add role-scoped links to Projects and Documents.
  - [ ] Remove `Échanges` and roadmap from dashboard/quick links by default.
  - [ ] Keep financial/global totals reserved for DPAF/Admin.
  - [ ] Preserve invitation-only and auth landing behavior.
- Evidence required before done: role dashboard E2E and no financial-total leak checks.
- Blockers/loopholes: existing quick-link helper derives from navigation registry, so registry changes must be validated first.
- Commit: pending

## Phase 7 - Native UI Cleanup

- Status: Not started
- Goal: Keep normal MJL users inside the MJL workspace.
- Files/routes affected: `actions_mjlfinancement.class.php`, `native_guard.js.php`, `mjl_app.css.php`, deployment docs.
- Completion checklist:
  - [ ] Keep server-side redirects/forbidden behavior as the security layer.
  - [ ] Hide/block native `/projet`, `/ecm`, `/expensereport`, accounting, HR, tools, admin technical paths for normal MJL users.
  - [ ] Preserve project records and backend joins.
  - [ ] Keep Admin technical access only outside normal client-facing navigation.
- Evidence required before done: E2E direct native URL matrix.
- Blockers/loopholes: DPAF/Admin may still need background rights for native models; do not remove data rights blindly.
- Commit: pending

## Phase 8 - E2E Tests

- Status: Not started
- Goal: Update Playwright coverage for the new navigation model.
- Files/routes affected: `tests/e2e/phase5-workspace-shell.spec.js`, plus targeted new specs if needed.
- Completion checklist:
  - [ ] Login redirects to `/custom/mjlfinancement/index.php`.
  - [ ] Grouped sidebar structure is covered.
  - [ ] Roadmap hidden by default and Admin-only when flag is enabled.
  - [ ] `Échanges` absent from sidebar, quick links, and dashboard cards.
  - [ ] `/projects.php` and project notes are covered.
  - [ ] `/documents.php` secure read-only behavior is covered.
  - [ ] Every visible sidebar link returns 200 for the role that sees it.
  - [ ] Full `npm run test:e2e` passes before final acceptance.
- Evidence required before done: targeted and full Playwright output.
- Blockers/loopholes: tests currently expect Admin roadmap visibility and exchange-log visibility; update them with implementation.
- Commit: pending

## Phase 9 - Documentation

- Status: Not started
- Goal: Align production and design-system docs with implemented navigation.
- Files/routes affected: `docs/15-production-menu-scope.md`, `docs/design-system/audit/current-screen-inventory.md`, `docs/mjl-financement-feature-coverage.md`, production readiness/deployment docs as needed.
- Completion checklist:
  - [ ] Document new sidebar structure.
  - [ ] Document Projects wrapper and notes/comments.
  - [ ] Document Documents library and contextual upload policy.
  - [ ] Document hidden native Dolibarr strategy.
  - [ ] Document `MJL_SHOW_INTERNAL_ROADMAP`.
  - [ ] Document known limitations.
- Evidence required before done: docs diff and passing E2E reference.
- Blockers/loopholes: do not mark production-ready unless remaining client-review wording and donor-template gaps are explicitly scoped.
- Commit: pending
