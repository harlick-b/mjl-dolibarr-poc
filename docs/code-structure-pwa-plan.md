# URL, module structure and PWA plan

## Contract

This slice centralizes browser route paths, groups auth and planning code by
responsibility, and completes install metadata for the existing PWA. It preserves
business behavior, API paths, database schema, transaction ownership and server
authorization. The PWA remains online-only for business operations: it must not
cache authenticated API responses, documents or exports, and it must not queue
writes.

## Implementation seams

- `frontend/src/app/urls.js` owns route destinations and TanStack route patterns.
  Production links, redirects, route registration and programmatic navigation use
  `Urls` rather than route string literals. API endpoint strings remain owned by
  the REST callers.
- Frontend auth code is grouped into `components/`, `pages/`, `session/` and
  route-oriented `lib/` modules.
  Frontend planning code is grouped into `components/`, `pages/` and `lib/`.
- Backend planning keeps FastAPI composition unchanged while grouping models and
  planning rules in `core/`, money workflows in `finance/`, execution and evidence
  in `operations/`, delivery in `notifications/` and annual output in `reports/`.
- Vite owns the web manifest and service worker. The worker precaches public build
  assets only; `/api`, private downloads and business mutations remain network-only.

## Progress and verification

- [x] Central route catalog added and production navigation migrated.
- [x] Frontend auth and planning folders grouped by responsibility.
- [x] Backend planning modules grouped by responsibility with callers updated.
- [x] PWA identity, install icons and Apple install metadata completed.
- [x] Final focused tests, static checks and independent review.

The first combined frontend run passed 128 tests and timed out in one existing
lost-response Activity test while files ran concurrently; that test passed its
focused single-worker rerun. Backend full collection initially found stale
test imports after the package move; they were corrected, and collection now
finds all 890 tests without errors.

Independent review found one remaining literal Activity-prefix guard in the
application router. It was replaced with `Urls.activities`, the expanded scan and
27 focused router/auth/navigation tests passed, and the same reviewer cleared the
corrected candidate with no blocking finding. Browser install/Cache Storage
acceptance remains external to these generated-artifact checks.

Precommit review additionally caught two Dashboard attention links constructing
literal routes. Both now use `Urls` patterns and activity parameters. The full
frontend run passed 226 tests before this correction; the subsequent focused
Dashboard/router run passed 13 tests, including both title and action destinations.
The new fixture initially used an invalid role; it was corrected before the passing
run. Backend Ruff, mypy (55 files) and collection (890 tests) passed again.
Runtime PostgreSQL and Alembic journeys remain unexecuted for this import-only move.
Historical project-status formatting was restored to keep documentation changes
within this slice. Existing lessons already cover scoped review and evidence;
no new lesson was needed.

Final independent specification and standards reviewers cleared the corrected
candidate with no remaining blocking findings. Final frontend lint, formatting,
build and staged diff checks passed; artifact identity is in project status.
