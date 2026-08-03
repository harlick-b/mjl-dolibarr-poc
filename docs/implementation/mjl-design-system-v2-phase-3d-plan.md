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

### Responsive project and expense operational lists

Implemented on 2026-08-03 as the next Workstream 3D.2 tracer slice:

- converted project and expense result markup to semantic tables on desktop
  and the existing labeled-card pattern at 768px and below;
- placed resource identity and status first, retained the established reference
  links, and added a terminal explicit `Ouvrir` link to every result row;
- reused the shared `initial-empty`, `filtered-empty`, `partial-error`, and
  `unavailable` persistent states, with safe retry/reset actions;
- exposed scoped result counts consistently and corrected malformed or
  inaccessible filters to display the already fail-closed result as zero;
- left query fragments, active-entity and Partenaire / Programme scope guards,
  permissions, workflows, schemas, exports, pagination behavior, and the
  expense creation form unchanged.

The project and expense browser tracers were captured red before their PHP
presentation changes: each failed because its list had no semantic `thead` at
the requested public browser seam. Both unchanged tracers then passed green.
The first wider operational run found that existing project journeys depended
on the reference link; the link was restored while retaining the new explicit
`Ouvrir` action, and the complete operational spec then passed.

Disposable verification environment:

- Compose project: `mjl-phase3d-prereq-lists`
- URL: `http://127.0.0.1:18086`
- Temporary root: `/tmp/mjl-phase3d-lists-Shpc2R`
- Database and document binds: dedicated children of that temporary root

Final focused results:

- Phase 3D operational interactions, including project/expense filters,
  pagination presentation, scope guards, shared states, responsive lists, and
  browser overflow: 15/15 passed;
- existing activity filter, semantic-table/responsive-card, fail-closed, and
  pagination-boundary regressions: 3/3 passed;
- existing count-degradation seam proving successful rows and previous/next
  pagination survive an unavailable total: 1/1 passed;
- scope-model smoke: passed;
- changed PHP and JavaScript syntax checks: passed;
- `git diff --check`: passed;
- design-system gate: passed with the existing operational-table/card pattern
  and no unresolved decision blocking the slice;
- security baseline gate: passed; server authorization, active-entity/scope
  SQL fragments, guarded detail routes, POST behavior, and safe diagnostics
  remain intact;
- full-feature gate: passed for the authorized slice; current-state design and
  functional-map evidence was updated, with no schema/workflow/export smoke
  required beyond the scope-model check;
- final two-axis code review: Standards passed with no documented-standard
  violations and one optional low-risk duplicated-test-shape judgement call;
  Spec passed with no findings. The separate project and expense tracers were
  retained for route-specific diagnostics.

The complete Playwright suite was not rerun for this focused UI slice. The
affected operational and activity-list suites were selected because they cover
the changed routes, shared filters/pagination, scope behavior, and responsive
contract; the repository already records unrelated legacy full-suite failures.

### Hardened project-form remediation

Implemented on 2026-08-03 as a focused remediation of the guarded project
create/edit states:

- added persisted `Statut actuel` context to the edit page header and corrected
  the migrated French project-form copy;
- retained partner and status selections through one-use recovery by deriving
  project-local aliases only after active entity/scope and exact enum
  validation, then revalidating them when recovery is consumed;
- added context-bound, 128-bit, one-use project submission tokens with a
  two-hour lifetime, explicit closed issue/consume reasons, and a per-user
  pending-token cap;
- locked the exact entity/project row before updates, computed changes before
  writing, and made unchanged updates audit-free no-ops; native
  entity/reference uniqueness remains the create-side duplicate backstop;
- connected project forms to linked validation, dirty-state tracking, the
  accessible unsaved-change dialog, best-effort browser lifecycle warnings,
  and first-valid-submit locking;
- retained native no-JavaScript validation and added focused recovered error
  summaries for the no-script path.

Disposable verification used `mjl-phase3d-prereq-formhymn2u` at
`http://127.0.0.1:18083`, with database and document binds under
`/tmp/mjl-phase3d-form-HymN2U`. A second clean diagnostic stack used
`mjl-phase3d-prereq-crosscut` at `http://127.0.0.1:18084`.
Final review-remediation verification used `mjl-phase3d-prereq-final` at
`http://127.0.0.1:18085`, with binds under
`/tmp/mjl-phase3d-final-csn7Us`.

Verified results:

- Phase 3D project-form isolation contract: passed;
- all PHP isolation seams: 4/4 passed;
- disposable-environment guard: 5/5 passed;
- Phase 3D operational interactions, including injected-alias, invalid-enum,
  stale-scope, missing/cross-context/replayed token, concurrent create/update,
  audit-free no-op update, no-JavaScript focus, navigation exclusions,
  dynamic lifecycle warning, and stalled-real-POST locking: 12/12 passed;
- final affected legacy project recovery, role/permission, workflow-audit, and
  navigation regressions: 9/9 passed;
- scope-model smoke: passed;
- changed PHP and JavaScript syntax checks: passed;
- `git diff --check`: passed.

The complete Playwright command was also executed on the disposable stack. It
reported 137 passed, 12 failed, and 74 not run. All ten remediation tests
passed within that run. The failures were outside this slice and included
legacy copy/selector expectations, permission or workflow fixture state, and
hard-coded fixture IDs; therefore this entry does not claim a globally green
suite. In particular, the shared expense-dialog diagnostic was rerun on a
fresh stack and reached the existing self-disbursement fixture at hard-coded
expense ID `13`, for which the server correctly exposes no action before the
JavaScript controller runs.

No WCAG conformance, signed manual accessibility matrix, complete Phase 3D,
or production-readiness claim is made by this remediation.

### Guarded activity review decision states

Implemented on 2026-08-03 as the next Workstream 3D.2 tracer slice:

- moved activity prevalidation, final validation, legacy validation,
  correction return, and rejection forms out of the default detail into
  allowlisted `id=<id>&action=<action>` states on `activities.php`;
- rechecked object visibility, active entity, Partenaire / Programme scope,
  role, actor separation, and current workflow status before consuming
  recovery or rendering any decision field;
- retained the existing POST action names, Dolibarr token check, workflow
  methods, transition guards, audit behavior, and recovery registry;
- returned decision failures to the same guarded state, focused recovered
  error summaries, marked only the dedicated decision form substantive, and
  provided an explicit `Annuler` link to canonical detail;
- updated affected Phase 7, Phase 8, and Phase 10 browser journeys from the
  removed inline controls to the dedicated action links and French labels.

The first correction-state tracer was captured red against the inline default
detail, and the recovery tracer was captured red before decision failures
returned to their guarded state. The verifier tracer was also red before the
complete allowlisted review set was migrated. Existing Phase 7 journeys then
failed at their former inline-control selectors and passed after navigating the
new states.

Disposable verification environment:

- Compose project: `mjl-phase3d-prereq-actions`
- URL: `http://127.0.0.1:18087`
- Temporary root: `/tmp/mjl-phase3d-actions-lNAd4s`
- Database and document binds: dedicated children of that temporary root

Final focused results:

- Phase 3D operational interactions, including verifier/final-validator
  states, wrong-role, no-self, cross-scope and stale-state denial, recovery
  ordering/one-use behavior, filters, responsive lists, and overflow:
  21/21 passed;
- complete Phase 7 activity workflow suite: 9/9 passed; the verifier and
  self-review journeys also passed 2/2 after their final link-absence
  assertions were strengthened;
- exact-action activity recovery plus list filter, semantic table/card, and
  pagination regressions: 4/4 passed;
- Phase 8 alert removal after activity prevalidation: 1/1 passed;
- scope-model and activity-workflow server smokes: passed;
- guarded activity action state has no document overflow at 390, 768, 980,
  1024, or 1366 pixels;
- changed PHP and JavaScript syntax checks and `git diff --check`: passed.

The migrated Phase 10 decision-notification journey completed all four UI
transitions, then failed at its existing test-outbox assertion because the
isolated run produced no outbox entry. The complete Phase 10 spec stopped
earlier on its existing unaccented invitation-success copy expectation, so
this slice does not claim that suite green. The complete repository Playwright
suite and manual 200% zoom/assistive-technology matrix were not rerun; targeted
browser suites cover the changed route, protected actions, recovery, activity
lists, filters, and responsive contract.

Final gates after review remediation:

- design-system gate: passed; the implementation reuses the page-header,
  decision-form, event-feedback, exact recovery, and substantive-form patterns,
  preserves French-first content and guarded routes, and has no unresolved
  design decision blocking this incremental slice;
- security baseline: passed; direct GET and POST evidence covers wrong role,
  no-self, single-partner cross-scope, stale status, active-entity/object
  access, CSRF, recovery ordering, and one-use consumption without exposing
  unauthorized fields;
- full-feature validation: passed for the authorized activity-review slice;
  implementation, protected workflow behavior, responsive UI, recovery,
  current-state docs, syntax, smokes, and affected regressions are covered,
  with the Phase 10 outbox and complete-suite/manual-matrix limitations stated
  above;
- final two-axis code review: Standards passed with no documented-standard
  violation and one optional low-risk repeated review-metadata judgement call;
  Spec passed with no findings after the direct guard/recovery tracers were
  added.

No query logic, permission model, workflow transition, schema, export, expense
creation form, or Dolibarr core file changed.

### Guarded activity creation and editing states

Implemented on 2026-08-03 as the next Workstream 3D.2 tracer slice:

- moved the activity creation form out of the operational list into the
  allowlisted same-route `action=create` state and exposed one authorized
  primary action from the list header;
- moved the editable-activity correction form out of the default detail into
  `id=<id>&action=edit`, with the existing ownership, status, entity, and
  Partenaire / Programme checks applied before rendering any field;
- retained the existing POST `create` and `update` actions, Dolibarr token,
  domain methods, workflow audit behavior, project/convention integrity, and
  canonical success destinations;
- returned creation and update failures to their exact guarded state with
  focused one-use recovery, explicit cancel destinations, and native
  no-JavaScript validation;
- preserved project, convention, task, and responsible-user selections through
  server-validated local recovery aliases, then restored them only if they
  remain in the current entity/scope-filtered option sets and retain the
  required project relationship; generic recovery continues to reject raw
  `fk_*` and request-supplied alias identifiers;
- marked only the dedicated forms substantive so the existing unsaved-change
  and duplicate-submit enhancement applies without affecting filters,
  comments, or navigation;
- migrated the affected Phase 7 and Phase 2 activity journeys away from the
  removed inline forms.

The creation tracer was captured red against the missing list-header action.
The creation-recovery tracer was red while failures returned to the list and
then exposed the generic registry’s intentional raw-identifier rejection; the
green implementation adopted scoped aliases instead. The edit-recovery tracer
was red while failures returned to canonical detail. An initial edit fixture
used the non-editable `En cours` state and was corrected to `Brouillon` without
relaxing the domain guard. Two-axis review then identified that request fields
could fall through into missing aliases and that valid task/responsible choices
were not retained. Dedicated tracers reproduced both failures; the remediated
alias-only storage and double scoped revalidation passed those tracers.

Disposable verification environment:

- Compose project: `mjl-phase3d-prereq-activity-forms`
- URL: `http://127.0.0.1:18089`
- Temporary root: `/tmp/mjl-phase3d-activity-forms-5mQN1f`
- Database and document binds: dedicated children of that temporary root

Final focused results:

- complete Phase 3D operational suite, including dedicated create/edit
  states, wrong-role denial before option rendering, stale-state
  guard-before-recovery behavior, one-use recovery, dirty navigation, and
  overflow at 390, 768, 1024, and 1366 pixels: 31/31 passed;
- complete Phase 7 activity workflow suite: 9/9 passed;
- focused Phase 2 linked validation, exact recovery, two-tab/context
  isolation, no-JavaScript validation, action isolation, and responsive-table
  regressions: 6/6 passed;
- exact activity recovery-registry and standalone-wrapper checks: 2/2 passed;
- isolated scope-model and activity-workflow server smokes: passed;
- changed PHP and JavaScript syntax checks and `git diff --check`: passed.

The complete repository Playwright suite and manual 200% zoom/assistive-
technology matrix were not rerun. The targeted suites cover the changed
route, form options, recovery, workflow handoff, scope/status guards,
responsive layout, shared filters/lists, and no-JavaScript behavior.

Final gates:

- design-system gate: passed; the slice reuses the established page-header,
  primary-action, form-field, error-summary, exact-recovery, substantive-form,
  cancel, and responsive-shell patterns with French-first content;
- security baseline: passed; direct GET evidence covers wrong-role create and
  edit denial before option rendering, while stale edit status is denied before
  recovery consumption and the existing CSRF, entity/scope, ownership, POST,
  and project/convention integrity guards remain authoritative; request-
  supplied recovery aliases are rejected and every server-created selection
  alias is revalidated against current scoped options before display;
- full-feature validation: passed for the authorized activity create/edit
  slice; implementation, recovery, progressive/native validation, responsive
  behavior, current-state docs, server smokes, and affected regressions are
  covered, with the complete-suite/manual-matrix limitations stated above;
- final two-axis code review: Standards and Spec both passed after the
  alias-integrity and task/responsible recovery findings were reproduced and
  remediated; no blocking or follow-up findings remain.

No query shape, permission model, workflow transition, schema, export,
document behavior, expense form, or Dolibarr core file changed.

### Guarded expense review and disbursement states

Implemented on 2026-08-03 as the next Workstream 3D.2 tracer slice:

- moved expense prevalidation, final validation, rejection, and disbursement
  forms out of the default detail into allowlisted
  `id=<id>&action=<action>` states on `expenses.php`;
- rechecked object visibility, active entity, Partenaire / Programme scope,
  role, actor separation, and current workflow status before consuming exact
  recovery or rendering any decision field;
- retained the existing POST actions, CSRF checks, workflow methods,
  transition guards, audit behavior, and consequence copy;
- returned recoverable decision failures to the same guarded state with a
  focused error summary, retained submitted values, an explicit `Annuler`
  link, and native no-JavaScript submission;
- removed the expense decision confirmation modal after consequences became
  persistently visible in the dedicated states; the shared unsaved-change
  dialog remains in use;
- updated affected Phase 0.5, Phase 2, and Phase 11 browser journeys to follow
  the guarded links and French-first labels.

The verifier tracer was captured red while the default detail still contained
the prevalidation form. The final-validation/disbursement tracer was captured
red before the complete decision set moved, and the rejection recovery tracer
proved exact-action, one-use return behavior. All passed green after the
incremental implementation.

Disposable verification environment:

- Compose project: `mjl-phase3d-prereq-expense-actions`
- URL: `http://127.0.0.1:18088`
- Temporary root: `/tmp/mjl-phase3d-expense-actions-cxnTKG`
- Database and document binds: dedicated children of that temporary root

Final focused results:

- Phase 3D operational interactions, including all four guarded expense
  states, wrong-role, no-self, cross-scope and stale-state denial, recovery
  ordering/one-use behavior, filters, pagination, activity regressions, and
  browser overflow at 390, 768, 1024, and 1366 pixels: 25/25 passed;
- complete Phase 0.5 expense disbursement workflow suite: 3/3 passed;
- complete Phase 11 expense workflow/document/scope suite: 10/10 passed;
- focused Phase 2 consequence visibility with and without JavaScript,
  stale/invalid/premature decisions, exact-one effects, and all four no-self
  decisions: 4/4 passed;
- scope-model and expense-validation server smokes: passed;
- changed PHP and JavaScript syntax checks and `git diff --check`: passed.

The isolated Phase 11 run initially exposed a disposable-environment
prerequisite: its freshly created document bind was not writable by container
user `www-data` (`33:33`). Ownership was corrected only within the verified
temporary bind, after which the full suite passed. The complete repository
Playwright suite and manual 200% zoom/assistive-technology matrix were not
rerun; targeted browser suites cover the changed route, workflow decisions,
recovery, documents, scope guards, responsive lists, and overflow.

Final gates after review remediation:

- design-system gate: passed; the guarded expense states reuse the existing
  page-header, decision-form, exact-recovery, error-summary, consequence, and
  substantive-form patterns, retain native no-JavaScript submission, and
  remove the obsolete expense confirmation modal only after the decisions
  have persistent dedicated context;
- security baseline: passed; direct GET and POST evidence covers wrong role,
  no-self, single-partner cross-scope, stale status, active-entity/object
  access, CSRF, guard-before-recovery ordering, and one-use consumption
  without exposing unauthorized decision fields;
- full-feature validation: passed for the authorized guarded-expense slice;
  implementation, workflow protection, responsive UI, recovery, current-state
  docs, syntax, server smokes, and affected browser regressions are covered,
  with the complete-suite and manual-accessibility limitations stated above;
- final two-axis code review: Standards passed with no blocking finding after
  the obsolete `confirmDecision` helper name and form indentation were
  remediated; one optional low-risk route-metadata duplication judgement call
  remains. Spec initially identified this missing gate-evidence paragraph;
  after it was added, no implementation, scope-creep, or correctness finding
  remained.

No query logic, permission model, workflow transition, schema, export, expense
creation form, or Dolibarr core file changed.
