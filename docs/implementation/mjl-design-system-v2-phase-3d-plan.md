# MJL Financement v2 Phase 3D Implementation Plan

## Authorization and baseline

- User authorization: `authorize and start phase 3d`
- Branch: `main`
- Phase 3D rollback baseline:
  `52a6a6fbacb135713fc92b09331b7bef356fe4f0`
- Revised prompt commit:
  `c6b67d8a10ab6b921a50eb111ba06fcc8d1e35a8`
- Prerequisite application commit:
  `ed5e16f175c6144b500d4c71a395a5c13d2cb836`
- Prerequisite report and rollback-boundary commit:
  `52a6a6fbacb135713fc92b09331b7bef356fe4f0`
- Phase 3A / 3B / 3C checkpoints:
  `0399646`, `06fe50c`, `e81f8b1`
- Initial working tree: clean
- Approved v2 snapshot: unchanged from the rollback baseline
- Phase 4 and Phase 5 in the revised design-system sequence: not started

The prerequisite security report records `CORRECTED_AND_VALIDATED`. Its
isolated verification includes 9/9 prerequisite journeys, all 43 selected
existing regression tests, the scope/export/integrity smokes, and an
unresolved-scope audit pass. Those are baseline evidence and are not newly
executed Phase 3D results.

## Protected boundary

Phase 3D is presentation-only. It does not change routes, schemas, permissions,
scope rules, workflow transitions, financial meanings, guarded document
behavior, audit meanings, or CSV/XLSX contracts. Dolibarr core and
`docs/design-system/approved/v2/` remain unchanged.

## TDD seams

The authorized Phase 3D prompt defines and therefore confirms these public
test seams:

1. Pure presentation helpers: navigation registry, exact-path resolution,
   page-header model, formatters, and shared state renderers.
2. Rendered MJL routes in the browser: role-projected navigation, headers,
   lists, forms, action states, feedback, responsive behavior, focus, and
   no-JavaScript fallbacks.
3. Existing protected POST/download/export routes for regression proof only;
   presentation tests must not replace their server-side authorization tests.

Each slice follows red then green at one of these seams. Shared helpers ship
with their first route adopter and focused tests.

## Work sequence

### Checkpoint 3D.1: navigation, shell, and headers

- Introduce one pure canonical navigation registry.
- Project the registry through a closed mapping to existing access helpers.
- Derive active state from the exact normalized request path.
- Render non-clickable categories and remove duplicate parent/child links.
- Preserve contextual aliases without adding primary destinations.
- Remove dashboard links that duplicate the persistent sidebar.
- Add the responsive no-JavaScript navigation fallback and JavaScript drawer.
- Introduce the general page-header API and migrate all shell callers.

First tracer bullet: canonical registry plus exact-path resolver, adopted by
the existing shell.

### Checkpoint 3D.2: operational interactions

- Consolidate pagination, filter presentation, and shared list states.
- Apply responsive cards only to project, activity, and expense lists.
- Keep dense tables in controlled horizontal scrolling.
- Move substantive create/edit and consequential workflow forms into guarded
  same-route presentation states.
- Preserve exact POST names, recovery binding, token checks, and action guards.

### Checkpoint 3D.3: presentation and content

- Add the single operation-feedback adapter.
- Add the shared display formatter, including `F CFA` money display.
- Consolidate safe states, status presentation, alerts, and professional
  French on migrated surfaces.
- Preserve separate raw, HTML, CSV, and typed XLSX representations.

### Checkpoint 3D.4: journey convergence and integration

- Apply stabilized patterns across the complete route inventory.
- Run focused and wider role/journey regression tests.
- Run full relevant E2E and applicable smoke/audit checks only in a disposable
  Compose environment.
- Update the implementation report, current-state documentation where
  materially changed, and the unsigned accessibility evidence boundary.

## Verification strategy

For each workstream:

1. Run the new focused test red before implementation.
2. Run PHP syntax checks for changed PHP.
3. Run JavaScript syntax checks for changed JavaScript.
4. Run `git diff --check`.
5. Run focused browser journeys in a verified disposable environment.
6. Run the wider affected suite at the checkpoint gate.

The final integration gate uses unique database/document bind directories, a
free port, matching `DOLI_URL_ROOT` and `MJL_BASE_URL`, and a unique
`COMPOSE_PROJECT_NAME` beginning with the documented disposable prefix.

## Known limitations and release gates

- The manual accessibility matrix remains unsigned.
- No WCAG conformance or production-readiness claim is authorized.
- Final brand assets, general microcopy, report canevas, and the complete
  permission/report matrix remain client-pending.
- Production email, public URL, secrets, backup/restore, monitoring, and
  rehearsal remain outside Phase 3D.
- Existing historical local unresolved-target rows are data-remediation debt;
  fail-closed behavior remains protected.

## Workstream 3D.1 progress

### Canonical navigation and responsive drawer

Implemented from the rollback baseline without a commit:

- pure canonical registry and closed access-policy identifiers;
- stable permission projection with empty-category removal;
- exact canonical-path and contextual-alias active states;
- stable category IDs and exact active-path matcher metadata on every leaf;
- non-clickable category headings and duplicate-link removal;
- removal of dashboard quick links that duplicated the sidebar;
- mobile/tablet drawer enhancement with an in-flow no-JavaScript fallback;
- labelled trigger, Escape and outside-click closing, focus containment and
  restoration, background isolation, scroll locking, touch interaction, and
  focus-safe desktop/mobile resize reset.

Disposable verification environment:

- Compose project: `mjl-phase3d-prereq-shell-b`
- URL: `http://127.0.0.1:18083`
- Temporary root: `/tmp/mjl-phase3d-shell.BWuFjl`
- Database and document binds: dedicated children of that temporary root

Focused results:

- Pure navigation registry: passed
- Phase 3D navigation shell: 2/2 passed
- Existing Phase 1 shell foundation: 7/7 passed
- Existing role/native-boundary shell suite: 17/17 passed
- PHP and JavaScript syntax checks: passed
- `git diff --check`: passed

The responsive automation covers 390, 768, 980, 1024, and 1366 pixel widths,
supplemental half-width reflow checks for the desktop targets, a touch-enabled
browser context, and a reduced-motion browser context. Half-width and page
scale emulation do not prove real browser zoom; the invalid page-scale claim
was removed and real 100%/200% zoom is now a separate headed manual gate.

### Desktop sidebar geometry

Implemented as the second Workstream 3D.1 tracer bullet:

- fixed the desktop rail at 256 pixels with a 24 pixel content gap;
- attached the rail to the left workspace edge despite the asymmetric
  Dolibarr content container;
- removed floating-card radius and shadow from the desktop rail;
- made the rail fill at least the available viewport height while retaining
  sticky positioning;
- preserved the responsive in-flow and drawer behavior below 981 pixels;
- added rendered geometry checks at 1024 and 1366 pixels, including page and
  shell horizontal-overflow assertions.

Disposable verification environment:

- Compose project: `mjl-phase3d-prereq-geometry-c`
- URL: `http://127.0.0.1:18084`
- Temporary root: `/tmp/mjl-phase3d-geometry.9WWjyU`
- Database and document binds: dedicated children of that temporary root

Focused results:

- Phase 3D navigation shell: 3/3 passed
- Existing Phase 1 shell foundation: 7/7 passed

### General page-header interface

Implemented as the third Workstream 3D.1 tracer bullet:

- added one pure `mjl_page_header_render()` interface outside the
  dashboard-specific concern;
- escaped and normalized the required title plus optional breadcrumbs,
  useful description, caller-authorized actions, and status or scope context;
- guaranteed exactly one `h1` and omitted empty or decorative regions;
- replaced the enclosing header card with whitespace-led typography and
  predictable responsive action wrapping;
- migrated every shell header caller and removed the compatibility wrapper
  after confirming zero callers;
- moved existing detail return links into semantic breadcrumbs.

Disposable verification environment:

- Compose project: `mjl-phase3d-prereq-header-d`
- URL: `http://127.0.0.1:18085`
- Temporary root: `/tmp/mjl-phase3d-header.4ReMI5`
- Database and document binds: dedicated children of that temporary root

Focused results:

- Pure page-header isolation seam: passed
- Phase 3D navigation and page-header suite: 4/4 passed
- Existing Phase 1 shell foundation: 7/7 passed
- Existing dashboard alignment suite: 4/4 passed
- Existing role/native-boundary shell suite: 17/17 passed
- PHP syntax checks for all migrated callers and shared files: passed
- Initial two-axis review: completed with unresolved registry, drawer
  isolation, reduced-motion, browser-zoom evidence, duplicated responsive
  coverage, French copy, and evidence-status findings
- Final two-axis remediation recheck: Standards passed with no actionable
  findings; Spec passed with no remaining actionable findings after closing
  the navigation, pointer-interception, zoom-calibration, dynamic French-copy,
  and observer-disconnection test loopholes
- Remaining gate: real browser-zoom evidence is pending manual execution

### Phase 3D review remediation

Implemented on 2026-07-31:

- moved `category_id` and canonical-first `active_paths` into the required
  leaf constructor and removed both synthesis passes;
- expanded the pure registry contract checks to cover closed keys and
  policies, types, stable ordering, and global uniqueness of category IDs,
  leaf IDs, canonical paths, aliases, and all active paths;
- isolated every non-drawer DOM branch with owned inert markers, preserved
  pre-existing inert state, observed dynamic body/subtree additions, guarded
  focus escape, and restored state on every drawer close/reset path;
- added a reduced-motion browser context that checks the media query, zero
  transition duration, drawer operation, Escape, and focus restoration;
- extracted the canonical `390, 768, 980, 1024, 1366` width fixture and
  horizontal-overflow assertion shared by the Phase 1 and Phase 3D specs;
- corrected accents and apostrophes in migrated page-header copy and added
  representative rendered-text assertions;
- removed Chromium page-scale emulation as zoom proof and added a dedicated
  headed, `viewport: null` real browser-zoom harness and evidence sheet.

Scoped disposable verification environment:

- Compose project: `mjl-phase3d-prereq-remediation`
- URL: `http://127.0.0.1:18086`
- Temporary root: `/tmp/mjl-phase3d-remediation.2YSKF2`
- Database and document binds: dedicated children of that temporary root

Scoped results:

- Pure navigation registry: passed
- Pure page-header isolation seam: passed
- PHP syntax for the changed PHP files: passed
- JavaScript syntax for the changed production/test files: passed
- Phase 1 shell foundation: 7/7 passed
- Phase 3D navigation shell: 6/6 passed
- `git diff --check`: passed after the evidence update
- Real 100%/200% browser zoom: pending manual execution; no emulated pass is
  claimed
- Full suite: intentionally not run, per the user-authorized scoped
  validation strategy

The first browser attempt began before the fresh Dolibarr database finished
initializing and timed out at the login fixture. It was stopped, the isolated
fixture was explicitly bootstrapped, and the scoped specs then passed. This
was an environment-readiness failure, not an application assertion failure.

The next Phase 3D checkpoint is Workstream 3D.2 operational interactions,
starting with guarded create/edit presentation states, including the project
primary action, followed by shared pagination and filter presentation.

## Workstream 3D.2 progress

### Guarded project create and edit presentation states

Implemented on 2026-07-31 as the first Workstream 3D.2 tracer bullet:

- moved project creation from the list into the same guarded route with
  `action=create` and a caller-authorized page-header primary action;
- moved project editing from the default detail view into the same guarded
  route with `action=edit` and a caller-authorized page-header primary action;
- kept the existing POST action names, CSRF checks, permissions, entity and
  object-scope checks, workflow audit writes, and canonical success redirects;
- checked presentation-route permission and object access before consuming
  recovery state or rendering scoped Partenaire / Programme options;
- kept invalid create and update submissions on their dedicated presentation
  states with allowlisted, one-use recovery handles;
- added explicit no-JavaScript cancel paths back to the canonical list or
  project detail;
- removed substantive project forms from default list and detail states.

Disposable verification environment:

- Compose project: `mjl-phase3d-prereq-operations-e`
- URL: `http://127.0.0.1:18086`
- Temporary root: `/tmp/mjl-phase3d-operations.cGh5cr`
- Database and document binds: dedicated children of that temporary root

Final focused results:

- Guarded project presentation states and edit recovery: 3/3 passed
- Existing project create recovery: 1/1 passed
- Existing create/update permissions and audit regression: 1/1 passed
- Existing partner-scope and project permission regression: 1/1 passed
- Phase 1 shell foundation and Phase 3D navigation shell: 13/13 passed
- PHP and JavaScript syntax checks: passed
- `git diff --check`: passed
- Final two-axis review: Standards passed after resolving the stale current UI
  audit row and duplicate detail query; Spec passed with no findings

The next Workstream 3D.2 slice is shared pagination and filter presentation.

### Shared operational filter and pagination presentation

Implemented on 2026-07-31 as the second Workstream 3D.2 tracer bullet:

- introduced one escaped select-filter presentation helper with stable field
  IDs, French resource labels, apply/reset actions, and explicit default or
  active-filter summaries;
- adopted it on the project, activity, and expense operational lists while
  leaving query construction, allowlists, entity/scope filtering, columns,
  sorting, and action availability route-owned;
- consolidated the activity-only and generic pagination implementations into
  one resource-labelled renderer with a programmatic current-page state;
- consolidated retained filter-query handling and removed the unused duplicate
  query builder;
- corrected retained pagination links so integer-zero ID defaults are omitted
  while valid string enum value `0` remains preserved;
- verified the shared filter bar at 390, 768, and 1024 pixels without local
  horizontal overflow.

Disposable verification environment:

- Compose project: `mjl-phase3d-prereq-tables-f`
- URL: `http://127.0.0.1:18087`
- Temporary root: `/tmp/mjl-phase3d-tables.A7xdfC`
- Database and document binds: dedicated children of that temporary root

Final focused results:

- Pure filter/pagination presentation contract: passed
- Phase 3D operational presentation suite: 7/7 passed
- Existing activity filter, responsive-table, and pagination boundaries: 3/3
  passed
- Existing project/activity/expense retained-filter and pagination journeys:
  3/3 passed
- Existing Phase 1 shell foundation: 7/7 passed
- PHP and JavaScript syntax checks: passed
- `git diff --check`: passed
- Final two-axis review: Standards passed with no findings; Spec passed with
  no findings

The first browser attempt started while the fresh Dolibarr installer was still
importing tables and failed before the application assertion because no Admin
user existed yet. After a read-only Admin-user readiness check confirmed
installer completion, the unchanged red test reached the intended missing
filter-helper seam. This repeated readiness condition is now recorded in
`tasks/lessons.md`.

The next Workstream 3D.2 slice is responsive project and expense list cards
plus consolidated list states.
