# MJL Financement v2 — Phase 1 Implementation Report

## Verdict

`MJL_V2_PHASE1_IMPLEMENTED_AND_VALIDATED`

Phase 1 — Shared visual foundation and application shell was explicitly
authorized on 28 July 2026. No later implementation phase or production
release was authorized.

## Implemented scope

- Mapped approved provisional semantic colors, spacing, radii, shadows, focus,
  and touch-target values into scoped MJL CSS custom properties.
- Added a keyboard skip link and focusable main-content destination.
- Added exact `aria-current="page"` semantics and contextual
  `aria-current="location"` for the advanced Échanges view under Supervision,
  without exposing Échanges as a primary item.
- Consolidated the shared semantic page-header renderer across primary,
  Administration, validation, workflow-audit, and exchange-audit surfaces.
- Added primary, secondary, quiet, danger, and native-disabled action styling;
  the guarded forbidden route uses the primary safe-return action.
- Applied the approved `#164f7a` focus boundary to shell controls.
- Enforced 44px navigation/action targets through the 768px tablet baseline
  and on coarse-pointer devices.
- Corrected French accents and removed legacy/technical wording on touched
  shell and header surfaces.
- Added reduced-motion behavior for the shared shell.

## Protected behavior

- No Dolibarr core, route, API, schema, dependency, role, permission, scope,
  workflow, business-data, document, export, auth/email, or runtime
  configuration contract changed.
- Navigation remains capability-derived and direct route/POST enforcement
  remains server-side.
- Échanges remains contextual/advanced and absent from primary navigation.
- The approved v2 snapshot remains unchanged.

## Verification

| Check | Result |
| --- | --- |
| Phase 1 Playwright journeys | 7 passed |
| Full Playwright integration gate | 137 passed in one run |
| Full command | `npm run test:e2e -- --reporter=line --timeout=120000` |
| Existing native-boundary/workspace regression | 20 passed |
| PHP syntax for all touched PHP/CSS-PHP files | Passed |
| JavaScript syntax for all touched E2E files | Passed |
| `git diff --check` | Passed |
| Standards review | No remaining Phase 1 finding |
| Specification review | No remaining Phase 1 blocker |

The new browser coverage verifies skip access, exact/contextual current
location, all four production roles, fail-closed unresolved access, token
resolution and critical contrast, representative primary-section headers,
forbidden recovery, 390/768/1024/1366 widths, and 44px compact/tablet targets.

The full gate exposed one pre-existing fixed-date assertion that assumed an
activity could not become overdue. It now verifies the persisted user-visible
execution percentage/status controls independently of the date-sensitive
overdue summary. This durable lesson is recorded in `tasks/lessons.md`.

## Review corrections applied

- Removed unnecessary page-header `aria-labelledby` after it collided with
  form-label queries.
- Scoped tokens to both authenticated shell and standalone MJL workspace roots.
- Removed latent `aria-disabled` link styling that did not enforce behavior.
- Completed Administration/advanced page-header migration.
- Added contextual Supervision location for Échanges.
- Extended touch targets from compact-only to tablet/coarse-pointer input.

## Residual decisions and exclusions

- Brand, formal token governance, and icon policy remain provisional.
- Full mobile drawer parity, screen-reader/human accessibility validation,
  200% zoom certification, and page-specific action/breadcrumb migration
  remain later-phase work.
- `FACT-001`, production operations evidence, client report canevas/rights,
  and all release blockers remain open.
- Phase 1 validation is not production-release approval.

## Rollback

Rollback is presentation-only: revert the Phase 1 custom-module and E2E
changes. No schema or data rollback is required.

## Next authorization boundary

Phase 2 — Operational components and reusable states requires separate user
authorization.
