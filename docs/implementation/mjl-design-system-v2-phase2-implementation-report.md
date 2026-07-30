# MJL Financement v2 — Phase 2 Implementation Report

## Verdict

`MJL_V2_PHASE2_IMPLEMENTED_PENDING_MANUAL_VALIDATION`

Phase 2 — Operational components and reusable states was explicitly
authorized on 29 July 2026. The remediation implementation and automated
repository gates are complete; this is not a phase-scoped validation or
production-release approval. The required User/QA keyboard, reflow, contrast,
and browser-zoom matrix remains unsigned. Phase 3, deployment, merge, tag, and
production operations are not authorized.

## Resumed remediation completion — 30 July 2026

The paused remediation was resumed at the user’s request. All corrections
listed in the paused checkpoint were completed and rerun from the current
tree.

Completed after resumption:

- exhaustive expected-matrix tests cover every supported presentation action,
  object, channel, numeric/status alias, role, contextual `DPAF` case, and
  empty/unknown fallback;
- the standalone expense seam asserts exact stage rows, actor/date metadata,
  legacy fields, modifiers, rejection clearing, audit projections, isolated
  budget effects, stale replays, invalid CSRF, no-self decisions, and
  near-simultaneous final attempts;
- startup assertions verify effective expense rights, active partner scope,
  and project/convention/activity consistency for the fixture actors;
- recovery tests compare the complete registry, derived consume allowlist,
  exact session-handle identities, and mismatched form/action rejection;
- syntax, focused, affected-regression, smoke, patch-integrity, manual-harness
  guard, approved-snapshot, and complete Playwright gates passed from the
  corrected tree.

The verdict remains pending until the separate User/QA accessibility matrix is
completed and signed.

## Checkpoints

| Checkpoint | Commit |
| --- | --- |
| Phase 1 foundation and rollback target | `9d6042c62943b2843150ff6b85e8f581bfeb034c` |
| Phase 2 operational-component checkpoint | `2b3c5f2cc634b40bebd32f65160939a76de056c6` |
| Standards/spec review corrections | `70f354e0f5786b521bbd900340a3d7ce544d9b0c` |
| Expanded Phase 2 risk coverage | `da22ff440c8695ef78dfd0b285f326073a1ef69b` |
| Production-state and idempotency verification | `5a691667197cef7302f90b159ad730feae3a7974` |
| Paused remediation checkpoint | `6c71ff8a927aed33e558431fa23a45745f1b2aad` |

The approved v2 snapshot was not edited. Its tree hash remains
`98d0053a934b83b4a21a6c67207e86b3c89fe7d0`.

## Implemented behavior

- Added shared presentation helpers for business-status badges, persistent
  system states, safe error messages, and normalized redacted diagnostics.
- Added the approved info/success runtime status tones with computed-style and
  contrast assertions on real activity and expense states.
- Added shared form fields, stable IDs, linked inline errors and summaries,
  exact domain-error translation, and opaque session-bound recovery handles.
- Centralized activity recovery in one exact-action registry. Storage and
  consumption derive from it; simultaneously rendered actions remain isolated,
  and upload/unknown actions create no recovery handle.
- Added an operational table/filter/pagination contract with normalized
  server-side filters, scoped counts, stable sorting, page boundaries, query
  retention, responsive cards, and distinct initial/filtered/error states.
- Added progressive consequence confirmation for expense decisions with
  keyboard focus containment, Escape cancellation, focus restoration, and a
  functional JavaScript-disabled server fallback.
- Deepened activity and expense timelines into explicit creation, workflow or
  validation, document, and contextual-comment source envelopes with stable
  ordering and partial-result warnings.
- Centralized normal timeline/audit presentation for action, actor role,
  object, channel, and status values, including context-bound legacy `DPAF`
  handling and neutral French unknown/empty fallbacks.
- Added partial-result alert aggregation while retaining the
  `mjl_alerts_for_user()` compatibility wrapper for existing callers.
- Adopted controlled status presentation on activities, expenses, dashboards,
  projects, and partners without exposing machine codes or raw user IDs.
- Applied shared fields and recovery to activity creation, correction,
  execution, decisions, and contextual comments.
- Moved `activities.js` out of the global shell and into the activity route,
  before the once-global shared component script.
- Added an isolated Phase 2 expense fixture seam covering exact-one decisions,
  fresh-token stale replays, invalid CSRF, all four no-self checks, and
  near-simultaneous separately authenticated final-validation attempts.
- Added explicit next-action content to the activity operational table at
  desktop, 768px, and 390px layouts.
- Replaced raw database/driver feedback on touched surfaces with safe French
  messages while keeping normalized server diagnostics.
- Documented the operational components and updated the current-state and
  target-gap evidence.

## Protected contracts

- No Dolibarr core file, schema, migration, dependency, route, API, role,
  permission, entity/scope rule, workflow transition, status value, document
  guard, email contract, or runtime configuration changed.
- Existing POST action names, form payload names, anti-CSRF enforcement,
  no-self-validation rules, server-side scope checks, and direct URL/POST
  guards remain authoritative.
- Report and export status mappings remain untouched:
  `custom/mjlfinancement/reports.php` and
  `mjl_integrity.lib.php::mjl_expense_status_label()` were not modified.
- Official export filenames, French labels, formats, filters, and audit
  behavior were not changed.
- The final alert renderer extraction only moved existing escaped route markup
  into the alert library; loading, scope, payload, destination normalization,
  and access behavior are unchanged.
- No sample-data loader or E2E fixture was added to a production path.

## Verification

| Check | Exact command or seam | Result |
| --- | --- | --- |
| Remediated Phase 2 browser seam | `npm run test:e2e -- --reporter=line --timeout=120000 tests/e2e/phase2-v2-operational-components.spec.js` | 28 passed |
| Strengthened recovery baseline | Same focused command with `--grep "recovery is isolated"` | 1 passed |
| Affected workflow, exchange, alert, dashboard, email, convention, and fund-receipt regressions | Playwright command covering `phase05-expense-disbursement-workflow`, `phase11-expense-workflow`, `phase7-activity-workflow`, `phase8r-contextual-exchanges`, `phase8-alerts-risks`, `phase9r-alerts-alignment`, `phase6-level-dashboards`, `phase10r-dashboards-alignment`, `phase10-email-templates`, `phase14-convention-management`, and `phase16-fund-receipts` | 65 passed |
| Final complete browser gate | `npm run test:e2e -- --reporter=line --timeout=120000` | 165 passed in 9.7 minutes |
| Activity smoke | `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_activity_workflow.php` | Passed |
| Expense smoke | `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php` | Passed |
| Traceability/export smoke | `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_traceability_exports.php` | Passed |
| PHP syntax | `php -l` for every touched PHP file | Passed |
| JavaScript syntax | `node --check` for touched E2E/manual files and manual config | Passed |
| Manual harness guard | `npx playwright test --config=tests/manual/playwright.config.js --reporter=line` without opt-in | 1 skipped as designed |
| Approved snapshot identity | `git rev-parse HEAD:docs/design-system/approved/v2` | `98d0053a934b83b4a21a6c67207e86b3c89fe7d0` |
| Patch integrity | `git diff --check` | Passed |
| Fixed-point standards review | Phase 1 commit through remediated working tree | Passed: 0 High, 0 Medium |
| Fixed-point specification review | Phase 1 commit through remediated working tree | Passed: 0 High, 0 Medium |

The remediated browser seam covers computed semantic tones and contrast;
single-owner route JavaScript; exact-action recovery and unchanged forbidden
session baselines; neutral unknown/legacy timeline and audit presentation;
linked multi-field errors and retained values;
two-tab, one-use, expired, cross-user, and cross-entity recovery; known and
unknown failures; normalized/scoped filters and totals; sorting and pagination
boundaries; inaccessible and malformed filters; real initial-empty and
filtered-empty routes; semantic desktop and 390px/768px layouts; keyboard
confirmation and no-JavaScript fallback; stale state/token/premature direct
POST rejection; repeated correction chronology; real production partial
timeline/alert renderers; and absence of raw technical or legacy wording.

The standalone expense fixtures drive prevalidation, final validation,
rejection, and disbursement through UI and public POST seams. Each fresh-token
replay is rejected with HTTP 403; expense, budget, actor/date metadata, and
audit projections are exact; invalid CSRF and four no-self cases are
immutable; and two separately authenticated near-simultaneous final attempts
produce one event and one state/budget effect.

## Historical review findings and corrections

The review conclusions below describe the pre-remediation Phase 2 checkpoints.
They are historical and will be superseded only after final post-remediation
fixed-point corrections, reruns, and review complete.

The first fixed-point review found incomplete shared-field adoption, stale
expense checks occurring before action authorization, implicit document
timeline sources, missing mobile next action, raw responsible/status values,
weak recovery links, incomplete component documentation, legacy wording, and
insufficient risk coverage.

Corrections:

- adopted shared fields and unique stable ID prefixes on correction,
  execution, decision, and contextual-comment forms;
- restored action authorization before stale-state feedback;
- split document items into explicit source envelopes;
- resolved responsible users within the active entity and translated all
  normal timeline values;
- added the mobile next-action column and browser assertions;
- centralized execution status vocabulary;
- completed component definitions and current-state documentation;
- added real two-tab/context recovery, repeated-cycle chronology, partial
  renderer, real empty-route, and duplicate expense-decision coverage.

Those standards and specification re-reviews found no remaining High,
blocking, or Medium issue at that earlier checkpoint. A low-risk performance
observation remains:
responsible-name lookup is per changed audit event on bounded detail
timelines; batch loading is only warranted if measured timeline latency later
justifies it.

The final post-remediation fixed-point Standards and Specification reviews
both passed with zero High and zero Medium finding. Review corrections added
the complete alias and contextual-`DPAF` presentation matrix, explicit
1366px/1024px Phase 2 desktop checks, criterion-specific evidence references
for every manual matrix cell, an exact regression-spec list, and accurately
scoped security wording. One non-blocking Low maintainability observation
remains: business-status labels overlap between the badge and timeline
presentation maps. Their intentional expense legacy-context difference is
covered by the exhaustive contract; centralization should be considered only
in a separately scoped refactor.

## Security and feature validation

The security-baseline review found no remaining blocker:

- entity and active partner scope remain present in custom queries;
- direct route and POST capability checks remain server-side;
- invalid CSRF, unauthorized, premature, stale, and no-self actions fail
  closed;
- recovery state is opaque, allowlisted, bounded, one-use, ten-minute,
  session/user/entity/route/form/action/object-bound, and excludes tokens,
  document paths, and unrestricted payloads;
- guarded document routes and existing ECM checks remain unchanged;
- failure branches changed by Phase 2 show no SQL, driver details, tokens,
  comments, reasons, or filesystem paths, and their diagnostic logging accepts
  only normalized context and a bounded redacted driver category/message;
- separate legacy project, convention, budget-line, and fund-receipt CRUD
  error leakage remains explicitly open and out of scope in
  `docs/mjl-current-vs-target-gap-analysis.md`.

Full-feature validation confirmed the implemented slices, regression
coverage, safe fallback behavior, documentation, and rollback boundary.

## Design evidence

Implementation followed `DESIGN.md`, `docs/design-system/DESIGN.md`,
`docs/design-system/audit/current-screen-inventory.md`,
`docs/design-system/audit/current-ui-audit.md`, and the approved v2 snapshot.
The component contract is recorded in
`docs/design-system/MJL_COMPONENTS.md`.

Automated checks cover keyboard focus behavior, token contrast pairs, the
390/768/1024/1366 review widths used by the plan, responsive table/card
behavior, semantic labels, and JavaScript-disabled fallback.

## Required manual validation and exclusions

The Phase 2 User/QA matrix is a current gate, not deferred Phase 4 work. Its
fixture manifest, headed calibration harness, and unsigned evidence sheet are
at `tests/manual/phase2-accessibility-fixture-manifest.md` and
`docs/implementation/mjl-design-system-v2-phase2-manual-accessibility-evidence.md`.
Until every 390/768/1024/1366 cell passes at calibrated real-browser 100% and
200% zoom with signed keyboard, reflow, contrast, and dialog evidence, this
report cannot use a phase-scoped validated verdict.

The following remain expressly outside Phase 2:

- screen-reader validation;
- broader physical-device and assistive-technology coverage;
- a formal WCAG conformance claim.

Production email transport, public/base URL, final permission and secret
configuration, production operations
evidence, client report canevas/rights, `FACT-001`, and the documented release
blockers remain open.

## Rollback

Rollback to the Phase 1 boundary is:

`9d6042c62943b2843150ff6b85e8f581bfeb034c`

Revert the Phase 2 custom-module, test, and documentation commits. No schema,
migration, or business-data rollback is required.

## Next authorization boundary

Phase 3 — Core MJL journeys requires separate user authorization.
