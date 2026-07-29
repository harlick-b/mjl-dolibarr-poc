# MJL Financement v2 — Phase 2 Implementation Report

## Verdict

`MJL_V2_PHASE2_IMPLEMENTED_AND_VALIDATED`

Phase 2 — Operational components and reusable states was explicitly
authorized on 29 July 2026. This verdict is an implementation and automated
validation result, not a production-release approval. Phase 3, deployment,
merge, tag, and production operations were not authorized.

## Checkpoints

| Checkpoint | Commit |
| --- | --- |
| Phase 1 foundation and rollback target | `9d6042c62943b2843150ff6b85e8f581bfeb034c` |
| Phase 2 operational-component checkpoint | `2b3c5f2cc634b40bebd32f65160939a76de056c6` |
| Standards/spec review corrections | `70f354e0f5786b521bbd900340a3d7ce544d9b0c` |
| Expanded Phase 2 risk coverage | `da22ff440c8695ef78dfd0b285f326073a1ef69b` |
| Production-state and idempotency verification | `5a691667197cef7302f90b159ad730feae3a7974` |

The approved v2 snapshot was not edited. Its tree hash remains
`98d0053a934b83b4a21a6c67207e86b3c89fe7d0`.

## Implemented behavior

- Added shared presentation helpers for business-status badges, persistent
  system states, safe error messages, and normalized redacted diagnostics.
- Added shared form fields, stable IDs, linked inline errors and summaries,
  exact domain-error translation, and opaque session-bound recovery handles.
- Added an operational table/filter/pagination contract with normalized
  server-side filters, scoped counts, stable sorting, page boundaries, query
  retention, responsive cards, and distinct initial/filtered/error states.
- Added progressive consequence confirmation for expense decisions with
  keyboard focus containment, Escape cancellation, focus restoration, and a
  functional JavaScript-disabled server fallback.
- Deepened activity and expense timelines into explicit creation, workflow or
  validation, document, and contextual-comment source envelopes with stable
  ordering and partial-result warnings.
- Added partial-result alert aggregation while retaining the
  `mjl_alerts_for_user()` compatibility wrapper for existing callers.
- Adopted controlled status presentation on activities, expenses, dashboards,
  projects, and partners without exposing machine codes or raw user IDs.
- Applied shared fields and recovery to activity creation, correction,
  execution, decisions, and contextual comments.
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
| Phase 2 browser seam | `npm run test:e2e -- --reporter=line --timeout=120000 tests/e2e/phase2-v2-operational-components.spec.js` | 18 passed |
| Expense workflow replay/idempotency | Same Playwright command with `phase05-expense-disbursement-workflow.spec.js` and `phase11-expense-workflow.spec.js` | 13 passed |
| Activity workflow regression | Same Playwright command with `phase7-activity-workflow.spec.js` | 9 passed |
| Activity execution regression | Same Playwright command with `phase6r-project-activity-execution.spec.js` | 5 passed |
| Initial Phase 2 full gate | `npm run test:e2e -- --reporter=line --timeout=120000` | 148 passed |
| First post-review full gate | Same full command | 151 passed |
| Expanded-risk full gate | Same full command | 154 passed in 9.0 minutes |
| Final full gate | Same full command | 155 passed in 8.0 minutes |
| Activity smoke | `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_activity_workflow.php` | Passed |
| Expense smoke | `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php` | Passed |
| Traceability/export smoke | `docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_traceability_exports.php` | Passed |
| PHP syntax | `php -l` for every touched PHP/CSS-PHP file | Passed |
| JavaScript syntax | `node --check` for shared JavaScript and touched E2E files | Passed |
| Patch integrity | `git diff --check` | Passed |
| Fixed-point standards review | Phase 1 commit through corrected Phase 2 HEAD | No High, blocking, or Medium issue |
| Fixed-point specification review | Phase 1 commit through corrected Phase 2 HEAD | No High, blocking, or Medium issue |

The final browser seam covers linked multi-field errors and retained values;
two-tab, one-use, expired, cross-user, and cross-entity recovery; known and
unknown failures; normalized/scoped filters and totals; sorting and pagination
boundaries; inaccessible and malformed filters; real initial-empty and
filtered-empty routes; semantic desktop and 390px/768px layouts; keyboard
confirmation and no-JavaScript fallback; stale state/token/premature direct
POST rejection; repeated correction chronology; real production partial
timeline/alert renderers; and absence of raw technical or legacy wording.

Expense regressions replay prevalidation, final validation, rejection, and
disbursement through public POSTs. Each replay is rejected with HTTP 403 and
each decision remains exactly one validation/audit event.

## Review findings and corrections

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

The final standards and specification re-reviews found no remaining High,
blocking, or Medium issue. A low-risk performance observation remains:
responsible-name lookup is per changed audit event on bounded detail
timelines; batch loading is only warranted if measured timeline latency later
justifies it.

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
- errors shown to users contain no SQL, driver details, tokens, comments,
  reasons, or filesystem paths;
- diagnostic logging accepts only normalized context and a bounded redacted
  driver category/message.

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

## Residual human validation and exclusions

The following evidence remains intentionally pending Phase 4/release:

- manual screen-reader validation;
- broader physical-device and assistive-technology coverage;
- formal human 200% zoom/reflow review;
- formal human contrast and visual-regression sign-off.

No WCAG conformance claim is made. Production email transport, public/base
URL, final permission and secret configuration, production operations
evidence, client report canevas/rights, `FACT-001`, and the documented release
blockers remain open.

## Rollback

Rollback to the Phase 1 boundary is:

`9d6042c62943b2843150ff6b85e8f581bfeb034c`

Revert the Phase 2 custom-module, test, and documentation commits. No schema,
migration, or business-data rollback is required.

## Next authorization boundary

Phase 3 — Core MJL journeys requires separate user authorization.
