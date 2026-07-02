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
  - `roadmap.php` is now disabled by default behind `MJL_SHOW_INTERNAL_ROADMAP`;
  - `Échanges` is no longer visible in navigation;
  - `projects.php` and `documents.php` now exist;
  - project data currently relies on native Dolibarr projects through `fk_project`;
  - project notes are stored in `llx_mjlfinancement_project_note`.

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
- Commit: `814349d` for tracker baseline; implementation commit pending

## Phase 2 - Navigation Registry

- Status: Done
- Goal: Refactor navigation into one grouped, role-aware registry.
- Files/routes affected: `custom/mjlfinancement/lib/mjl_navigation.lib.php`, `custom/mjlfinancement/lib/mjl_workspace.lib.php`, `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`.
- Completion checklist:
  - [x] Define primary sections: Tableau de bord, Projets, Activités, Dépenses, Financement, Documents, Supervision, Administration.
  - [x] Keep one central registry with keys, labels, URLs, active patterns, order, descriptions, and visibility callbacks.
  - [x] Remove visible `Échanges` from sidebar and quick links.
  - [x] Add `Projects` and `Documents` navigation entries only where the user can open the route.
  - [x] Add `MJL_SHOW_INTERNAL_ROADMAP` visibility check for roadmap.
  - [x] Align module top-menu visibility with `mjl_workspace_user_can_enter()` or equivalent shared helper.
- Evidence required before done: `tests/e2e/phase5-workspace-shell.spec.js` passed 15/15.
- Blockers/loopholes: none open for current POC scope.
- Commit: pending

## Phase 3 - Sidebar Rendering

- Status: Done
- Goal: Render a grouped MJL sidebar with active-section expansion and current-page highlighting.
- Files/routes affected: `custom/mjlfinancement/lib/mjl_navigation.lib.php`, `custom/mjlfinancement/css/mjl_app.css.php`, MJL route files that pass active keys.
- Completion checklist:
  - [x] Remove any sidebar search behavior if present.
  - [x] Render only primary sections by default.
  - [x] Expand children only for the active section.
  - [x] Highlight the current page.
  - [x] Preserve accessible labels and no broken mobile layout.
  - [x] Do not render the sidebar on invitation/auth surfaces.
- Evidence required before done: visible-link traversal and invitation-sidebar checks passed in Phase 5 E2E.
- Blockers/loopholes: none open for current POC scope.
- Commit: pending

## Phase 4 - Projects

- Status: Done
- Goal: Add `/custom/mjlfinancement/projects.php` as an MJL wrapper over native Dolibarr projects.
- Files/routes affected: new `projects.php`, optional project helper class/lib, project-note schema/migration if notes are implemented, navigation and tests.
- Completion checklist:
  - [x] Use native `llx_projet` rows as project records.
  - [x] Filter by active entity.
  - [x] Show list columns only when values are safely computed from conventions, activities, expenses, fund receipts, documents, and budgets.
  - [x] Add detail view with summary, budget, related activities, expenses, documents, and notes/comments.
  - [x] Implement notes/comments as a timeline/list, not one editable blob.
  - [x] Keep audit separate from human notes.
  - [x] Do not expose native `/projet` UI.
- Evidence required before done: Phase 5 E2E covers project route, note creation, read-only note access, and native `/projet` blocking.
- Blockers/loopholes: none open for current POC scope.
- Commit: pending

## Phase 5 - Documents

- Status: Done
- Goal: Add `/custom/mjlfinancement/documents.php` as a read-only document library.
- Files/routes affected: new `documents.php`, `custom/mjlfinancement/lib/mjl_document.lib.php`, `documentdownload.php`, navigation and tests.
- Completion checklist:
  - [x] Aggregate only documents the current user can access through object-level guards.
  - [x] Include activity, expense, convention, and fund-receipt documents.
  - [x] Use secure MJL download links only.
  - [x] Do not expose raw ECM links.
  - [x] Do not add a generic upload button.
  - [x] Show contextual-upload explanation.
  - [x] Add filters where feasible without bypassing security.
- Evidence required before done: Phase 5 E2E covers read-only page and no generic upload button; download helper guards remain covered by existing document specs.
- Blockers/loopholes: none open for current POC scope.
- Commit: pending

## Phase 6 - Dashboard

- Status: Done
- Goal: Keep `/custom/mjlfinancement/index.php` as MJL home and align cards with unified navigation.
- Files/routes affected: `index.php`, `mjl_dashboard.lib.php`, `mjl_navigation.lib.php`.
- Completion checklist:
  - [x] Add role-scoped links to Projects and Documents.
  - [x] Remove `Échanges` and roadmap from dashboard/quick links by default.
  - [x] Keep financial/global totals reserved for DPAF/Admin.
  - [x] Preserve invitation-only and auth landing behavior.
- Evidence required before done: Phase 5 role dashboard E2E passed.
- Blockers/loopholes: none open for current POC scope.
- Commit: pending

## Phase 7 - Native UI Cleanup

- Status: Done
- Goal: Keep normal MJL users inside the MJL workspace.
- Files/routes affected: `actions_mjlfinancement.class.php`, `native_guard.js.php`, `mjl_app.css.php`, deployment docs.
- Completion checklist:
  - [x] Keep server-side redirects/forbidden behavior as the security layer.
  - [x] Hide/block native `/projet`, `/ecm`, `/expensereport`, accounting, HR, tools, admin technical paths for normal MJL users.
  - [x] Preserve project records and backend joins.
  - [x] Keep Admin technical access only outside normal client-facing navigation.
- Evidence required before done: Phase 5 direct native URL matrix passed, including DPAF.
- Blockers/loopholes: DPAF native `societe`/`projet` read rights removed from bootstrap; custom MJL pages keep backend joins.
- Commit: pending

## Phase 8 - E2E Tests

- Status: Done
- Goal: Update Playwright coverage for the new navigation model.
- Files/routes affected: `tests/e2e/phase5-workspace-shell.spec.js`, plus targeted new specs if needed.
- Completion checklist:
  - [x] Login redirects to `/custom/mjlfinancement/index.php`.
  - [x] Grouped sidebar structure is covered.
  - [x] Roadmap hidden by default and Admin-only when flag is enabled.
  - [x] `Échanges` absent from sidebar, quick links, and dashboard cards.
  - [x] `/projects.php` and project notes are covered.
  - [x] `/documents.php` secure read-only behavior is covered.
  - [x] Every visible sidebar link returns 200 for the role that sees it.
  - [x] Full `npm run test:e2e` passes before final acceptance.
- Evidence required before done: targeted Phase 5 E2E passed 15/15; full `npm run test:e2e` passed 93/93 on 2026-07-02.
- Blockers/loopholes: previous Admin roadmap and exchange-log visibility expectations were updated to match the flag-gated and hidden-navigation behavior.
- Commit: pending

## Phase 9 - Documentation

- Status: Done
- Goal: Align production and design-system docs with implemented navigation.
- Files/routes affected: `docs/15-production-menu-scope.md`, `docs/design-system/audit/current-screen-inventory.md`, `docs/mjl-financement-feature-coverage.md`, production readiness/deployment docs as needed.
- Completion checklist:
  - [x] Document new sidebar structure.
  - [x] Document Projects wrapper and notes/comments.
  - [x] Document Documents library and contextual upload policy.
  - [x] Document hidden native Dolibarr strategy.
  - [x] Document `MJL_SHOW_INTERNAL_ROADMAP`.
  - [x] Document known limitations.
- Evidence required before done: docs diff and Phase 5 E2E reference.
- Blockers/loopholes: do not mark production-ready unless remaining client-review wording and donor-template gaps are explicitly scoped.
- Commit: pending
