# Engineering guide

Use this guide for application changes and the [business rules](business-rules.md)
for behavior. [Security](security.md) owns protection and external acceptance;
[design](design.md) owns presentation. Setup commands are in [README](../README.md).

## Architecture and ownership

Prefer the smallest implementation of the approved behavior. Reuse existing
components and utilities, and keep frontend behavior aligned with backend rules.
Do not introduce exceptions or abstractions for unlikely hypothetical cases.
Routine technical decisions belong to the implementer; major scope, architecture,
business-behavior or API/data-contract changes require the user's decision first.
Files may be split by page, component, utility or another coherent responsibility;
avoid trivial wrappers and arbitrary size-based fragmentation.

React/Vite JavaScript/JSX, TanStack Router/Query, Tailwind/shadcn/ui and Lucide form
the frontend. FastAPI REST, SQLAlchemy 2, PostgreSQL and Alembic form the backend.
Keep a modular monolith: routes validate/authorize/map errors; use cases own
current state checks, transactions and audit; persistence helpers never commit.
Domain rules do not depend on HTTP, React or globals. Organize real consumers by
feature; no empty layers, generic workflow/repository engine, event bus, offline
database, mutation queue, microservices or speculative infrastructure.

Router owns navigation/search/cursor state. Query owns server data, cache and
mutations. React state owns temporary forms/dialogs; do not duplicate Query state
in Context. Components are pure, Hooks ordered, keys stable. Effects synchronize
external systems with cleanup, not ordinary fetches, prop copies or button actions.
Use synchronous SQLAlchemy work outside async event loops; isolate each session.

Readability is a design requirement: use clear names and direct control flow,
remove unreachable alternatives, and keep files grouped by their actual feature.
Validate external inputs and authorization boundaries; do not add defensive checks
for facts already guaranteed by the local contract. Avoid per-row database reads
when a collection can share one projection query.

## Source layout

Group files by the feature they implement. Put code in shared folders only when
several features actually use it. Keep tool configuration at the package root
where the tool discovers it; directory depth is not an architectural goal.

```text
backend/
  app/
    main.py                 # FastAPI composition and middleware
    core/                   # Configuration, database and health endpoints
    auth/                   # Authentication, access administration and mail
      templates/            # HTML/plain-text mail resources
    planning/               # PTA routes plus responsibility packages
      core/                 # Models, planning rules and projections
      finance/              # Funding and settlement workflows
      operations/           # Execution, evidence and Fiche delivery
      notifications/        # Review, assignment and reminder delivery
      reports/              # Annual CSV, Excel and PDF output
    partner_portal/         # Partner routes, CSV and sanitized Fiche
    audit/                  # Global history and audit export
  migrations/
    env.py, script.py.mako   # Alembic environment and revision template
    versions/               # Ordered revisions with descriptive filenames
  tests/
    conftest.py             # Shared disposable database/mail fixtures
    core/ auth/ planning/ execution/ reports/ audit/ partner_portal/
  pyproject.toml, alembic.ini, Dockerfile

frontend/
  src/
    main.jsx                # Browser entry point
    app/                    # Router/providers, PWA updates and global styles
    features/
      auth/                 # components/, pages/, session/ and lib/
      planning/             # components/, pages/ and lib/
      access/ execution/
      notifications/ audit/ partner-portal/ health/
    shared/
      api/                  # REST transport and provider
      ui/                   # Reused controls, forms and modal
      lib/                  # Display, pagination and class-name helpers
    locales/fr/             # Page/control dictionaries and common labels
    test/setup.js           # Common test environment
  e2e/                      # Browser journeys grouped by feature
    app/ auth/ planning/ execution/ reports/ audit/ partner-portal/
  public/                   # Public PWA assets
  package.json, vite.config.js, other tool configuration
```

Page/control translations live in `src/locales/fr/`, named for their consumer;
`common.js` contains only reused labels. Keep French default/fallback in every dictionary.

Feature tests live beside their frontend feature; cross-feature and PWA tests
live with application composition. Import another folder through the existing
`@/` alias, and use relative imports within a folder. Shared code does not import
feature screens. Backend imports use explicit `app.<module>` paths. No forwarding
modules or barrel re-exports are needed just to preserve former file locations.
Application/CLI entry points remain `app.main:create_app`, `app.auth.bootstrap`,
`app.planning.core.provision` and `app.planning.notifications.reminders`.

Backend tests import shared helpers through explicit `tests.<group>` paths;
the root `conftest.py` supplies disposable fixtures to every group. Run a group
with `pytest tests/auth` or a browser group with `npm run test:e2e -- e2e/auth`.
Migration filenames describe their purpose, but their stored revision IDs and
parent links remain immutable. Keep one ordered `migrations/versions` directory:
the database upgrade sequence crosses features and must stay easy to follow.
Keep manifests/lockfiles, Dockerfiles, Alembic, Vite, Playwright, lint/format and
editor configuration at package roots for normal tool discovery. `index.html`
is Vite's entry document; `components.json` configures component generation.

This organization changes source locations, not URL routes, business rules or
database definitions. OpenAPI schema identifiers derived from Python module
names follow the new module names; request/response shapes remain the same.

## Hosted development databases

Local Supabase development uses the existing PostgreSQL driver and migrations.
The database Data API must be disabled: FastAPI owns authorization. In local
mode, schema verification permits metadata in `auth`, `extensions`, `graphql`,
`graphql_public`, `realtime`, `storage` and `vault`; it still requires the exact
MJL public relations, migration head and integrity manifest. `public` must be
first in the effective explicit search path to prevent provider schemas from
shadowing application relations. Synthetic test databases retain the strict
whole-database check. This does not enable production authentication or hosting.

Verify this compatibility with disposable PostgreSQL tests for allowed provider
metadata, unknown relations, altered MJL definitions and search-path shadowing;
then check encrypted connectivity and migration/guard results on the configured
empty development database. A separate reviewer inspects the diff and evidence;
fix any blocking findings and return them for re-review before completion.

Non-sensitive demo staging may use the same provider-metadata compatibility under
the distinct `supabase-staging-v1` policy. That policy requires an exact HTTPS
origin, real Resend configuration, a generated authentication key and the explicit
`non-sensitive-demo-only` operator acknowledgment. It does not authorize production
or sensitive data. The Render staging image serves the immutable Vite build and
FastAPI from one origin; local development keeps separate Vite/FastAPI processes.
Migrations, MJL ownership provisioning and first-Admin bootstrap remain explicit
operator actions and never run during application startup.

Keep generic Uvicorn proxy-header trust disabled. Render staging derives abuse-
limit client addresses only from a syntactically valid `CF-Connecting-IP` paired
with `CF-Ray`, because Cloudflare overwrites that provider header at Render's edge.
Other policies and missing/malformed edge evidence use the socket address. Do not
use a caller-controlled `X-Forwarded-For` value.

## REST and shared client

FastAPI generates OpenAPI from actual routes; do not maintain a second static
contract. Use /api/v1, plural resource paths, no trailing slash, snake_case fields,
allowlisted filters/sorts and unknown-field rejection. Domain transitions are
explicit actions. No external public integration API is authorized.

All collection APIs use cursor pagination, default limit 60, maximum 100; invalid
limits return 422. Envelope: count, data, next, previous, object: "list". Count is
the exact authorized filtered total before the cursor window, from a consistent
request snapshot. Empty collection has count 0, data [], and null links.
Versioned opaque keyset cursors use deterministic ordering and unique ID ties;
validate filter/order context, reject malformed/mismatched cursors with 422.
Reverse traversal preserves display order. Links are absolute URLs built from a
trusted configured origin, preserve filters/order/limit and are null at boundaries.
Each page reauthorizes; no frozen multi-page snapshot promise. Official totals
and exports use complete selections independent of screen pagination.

Errors use {code, message, fields?}, stable codes and safe French text.
Correlation request IDs stay in internal logs/audit and are not returned in public
responses. Business request identifiers needed by financial workflows are separate.
401 requires session, 403 denies action, 404 conceals invisible resources, 409
rejects stale/conflicting/replayed writes, 422 validates input, 429 limits abuse,
503 signals temporary failure. Use 201+Location for create, 204 for empty success,
Retry-After on rate limits; never encode failure as 200. Dates are YYYY-MM-DD;
timestamps RFC3339 UTC. Money is exact decimal integer strings, null distinct from 0.

RestClientContext/RestClientProvider exposes const { api } = useAPI(). Keep one
stable client per provider lifetime; useAPI fails clearly outside it. Read current
credentials/CSRF context at request time. Centralize trusted path joining,
credentials, CSRF, cancellation, parsing, safe errors and session expiry; reject
pagination URLs outside the configured origin/API prefix before sending credentials.
No browser signing secret, Basic-auth token or localStorage credential.

Every failure rejects even after expiry handling. Distinguish structured HTTP,
network, cancellation and malformed-response errors; parse 204 without JSON.
Deduplicate protected-session expiry cleanup, keep login/OTP errors local, and
ignore old-session responses. 403 is not automatic logout. Propagate AbortSignal.
List/retrieve methods return Query functions receiving { signal }; writes return
Promises. Return parsed JSON/full list envelopes, not Axios wrappers or arrays
with attached metadata. Request params are local, never mutable shared state.
Use PATCH for partial updates, PUT only where contracted; no invented IDs or
unused CRUD methods. Fetch is sufficient; no second parallel transport.

One application access coordinator owns protected readiness. A protected `401` or
`csrf_invalid` closes the shared gate, clears protected state and starts one
coalesced session check with a ten-second total deadline. It may make a second
session request only after the first returns `401` or when a superseding
authentication-context change arrives within that same cycle; it never replays a
rejected write. Verified access remounts and reloads the route, anonymous returns to login,
pending continues to OTP. Session network/service/timeout failures clear local
access and return to `/login` with a service-unavailable message. A tab-local hold
survives refresh: deliberate retry first confirms server logout, then shows the
ready login form; an old cookie must not restore access. Malformed session responses
remain blocked behind a deliberate retry. A repeated `401` for the recovered request
stays blocked until deliberate retry, an authentication-context change or a
successful read resets that path's recovery latch.

Ordinary network, `5xx` and malformed data-read failures remain in their owning
view and preserve verified access. Read/download `403` or `404` removes the denied
resource and dependent previews, including retained cached pages and replacement
candidates in that resource scope. Verify cache redaction, pending-delivery
cancellation and object-URL revocation as well as visible removal; hiding a row
alone is insufficient. Mutation `403`, `409`, `422` and `429` remains
local to the attempted action. Cancellation and responses from an obsolete access
generation are silent. Unexpected render errors use the root sanitized retry
fallback and do not imply logout. Expiry, offline and cross-tab authentication
changes mask the workspace and purge protected queries, mutations, drafts and
object URLs; an online return verifies before remounting protected routes.
Switching tabs, hiding the page and returning to it do not clear data, discard
forms or reverify a still-valid session. The 24-hour session boundary remains.

## Query, forms and feedback

Ordinary page queries use a one-minute freshness window and five-minute in-memory
retention. Fresh data is reused on navigation; stale data refetches on mount.
Focus/reconnect do not trigger general page refetches. The access coordinator
still owns reconnect verification and security purges. Session/proof/blob queries
retain their specialized lifetime rules. No API cache is persisted to disk.
Mutations invalidate their affected Query keys. Global mutation errors defer to
`meta.localError`; the presence of `onError` alone does not mean the form displays
an error (some callbacks only clean up or reconcile).

Planning reads use shared session/user locks; mutations always take exclusive
locks, preserving revocation ordering without serializing Dashboard and reminders.
Self-service `GET/PATCH /auth/profile` returns only personal display fields,
email and role. Updates accept names and their original snapshot, enforce CSRF,
compare under an exclusive actor lock and atomically audit. Roles, email, password
and credential versions are never editable through this endpoint. First/last
names persist separately; migration does not split existing combined names.
For those legacy accounts only, the edit form suggests the first word as given
name and the remaining words as family name. The user can correct both before
saving; concurrency compares the original nullable database fields.

The users list includes a minimal current invitation summary for pending accounts,
so the UI has one identity row and one pagination boundary. Consumed invitations
are not duplicated beside active users. History list and CSV share an explicit
business/account action allowlist; historical authentication/security records remain preserved. New routine
authentication events use the separate security logger. Public before/after changes come from named safe audit fields, including
changed Operation fields and assignment identifiers, never raw audit details. Older events without those facts cannot reconstruct them.

`SessionProvider` shares the actual session `useQuery` result through React context;
consumers use `useSessionQuery`. Do not copy query data into Context state. Keep
reference/options queries at the screen or open form that consumes them instead
of loading catalogs in a global provider. Enable queries by both active screen
and required identifiers: a disabled observer can still expose cached data.
Only required active queries participate in page-wide loading/error handling;
form option failures stay local and do not disable cancellation.

Use `queryClient.invalidateQueries({ queryKey })` after confirmed mutations and
`setQueryData` only for complete authoritative returned projections. A retry of
one failed read may call that Query observer's `refetch`; navigation changes the
normalized query key. Session revalidation is a security transition owned by the
access coordinator, not a bare session-key invalidation: it must mask and purge
protected state first. Selected/current views of the same revision share one key.

Use Query v5 gcTime/isPending and appropriate placeholderData; never retain another
principal's data. Choose freshness per resource, especially session/permissions;
do not apply global one-hour freshness or 48-hour sensitive retention. Protected
queries depend on verified readiness, with keys including normalized filters,
cursor, limit and non-secret principal context. Read retries may be bounded for
transient failures; do not retry authorization/validation errors.

Mutations use retry:false and avoid offline pausing/replay (networkMode:always).
Offline UI guards are advisory. Invalidate affected projections after confirmed
success; never optimistically approve finance. A lost response is unknown, not
failure or success: reconcile via fresh reads before deliberate resubmission.
Uncertain uploads reconcile the newest relevant Activity page before retry and
keep recovery available in the modal. Navigation resets Activity-local recovery.

Editable fields and version token stay bound to the same snapshot during refresh.
Preserve dirty drafts until save or explicit discard. Lock editing while saving.
Advertised actions match server command guards; History and Partner screens allow
explicit access revalidation. Logout/account switch/expiry abort requests, clear
query/mutation/Router data, reset protected forms and mask the UI immediately;
late responses must not restore prior data. Resetting a mutation alone does not
remove cached variables or suppress callbacks; use request-generation guards.

One root Sonner Toaster: global safe French mutation error only if no local handler;
suppress duplicate expiry/abort feedback. Query errors stay inline, field errors
beside fields, blocking errors discoverable after toasts vanish. Success follows
confirmed server success. Use react-localization, French default/fallback, stable
code translation and named interpolation. HelmetProvider owns localized route
titles without sensitive metadata. Pass title content as one string (including
interpolated suffixes); React 19 does not accept multiple title children. Storage helpers may retain only namespaced
non-sensitive preferences, tolerate bad/unavailable storage and clear owned keys.

## Shared display and pagination helpers

formatDate defaults to French dd/MM/yyyy. Validate inputs; date-only values never
shift timezone, timestamp display timezone is explicit. Missing/invalid shows —,
never today. formatNumber preserves zero, negatives and missing distinctions;
invalid/missing shows —, valid values use French grouping. formatXOF validates
integer strings and formats exactly (e.g. BigInt), never through lossy Number.
Specify numeric precision per field. A string's toLocaleString is not formatting.

Pagination helpers take the list envelope. Show navigation from next/previous
presence, not count>limit; disable absent links and controls while transitioning.
Extract only a validated opaque cursor; reject foreign/malformed links, empty
cursors or changed filter/order/limit context. Query errors are not empty lists.
Router cursor callbacks preserve other search fields, return their real callback
type and support back/forward. Filter/order/limit changes reset cursors; Query keys
use the same normalized values. Reuse shared helpers rather than per-screen copies.

## Authentication and PWA

Opaque PostgreSQL-backed sessions use random browser identifiers and stored
verifier hashes. Password success creates only a pending OTP challenge. Passwords
use Argon2id; proofs are random, expiring, single-use and protected at rest.
Rotate after authentication; enforce server revocation, idle/absolute deadlines
and contributor/resource checks. First Admin is an operator-only one-time CLI
for an empty identity store, with explicit email/name and no default credentials.

Local Vite proxies /api. Production retains separate frontend/backend deployment;
the authorized demo-staging image may package their built artifacts in one web
process. Both browser topologies use one origin with /api ingress. Cookies are HttpOnly, Secure,
host-only, SameSite=Lax (local HTTP exception only). CSRF/Origin checks protect
unsafe requests including auth. Same-origin disables CORS; any separately approved
cross-origin credential topology needs exact allowlists, never wildcard, and
cookie/CSRF verification. TLS protects remote connections as applicable.

PWA caches only explicitly allowlisted public versioned static assets. Exclude
API/auth, files, exports, private navigation and non-GET requests; authenticated
responses are no-store. No confidential persistence, background sync or offline
business writes. Offline shell shows unavailable actions. Version/delete static
caches safely. Defer update/reload while forms are dirty or mutations pending;
incompatible clients fail safely and ask reload, never retry writes.

## Transactions, migrations and verification

Choose tests for meaningful user outcomes and concrete integrity risks. Reuse
existing coverage; do not add tests for obvious operations or every conceivable
interaction. Assertions must demonstrate behavior in context rather than repeat
constants, fixture setup or implementation details. Update the active slice plan
after each slice with progress and lessons that affect subsequent work.

Use PK/FK, uniqueness, NOT NULL and CHECK for local invariants, explicitly handling
nullable operands. Cross-row sums/rules require locked transaction checks. One
use case owns the outer transaction including authorization, writes and audit.
Account for SQLAlchemy autobegin; never silently nest or commit in helpers. Lock
in deterministic order, reauthorize current role/state/revision, then commit.
Failure rolls back audit and mutation; discard failed sessions. Do not hold
transactions over email/network/file streaming. Protect one-time actions with
concrete stale/replay guards; unknown outcomes are reconciled, not retried.

Schema/provenance checks fail closed on unknown/tampered definitions. Review
Alembic autogeneration. Execute migrations explicitly once with separate DDL
privilege, never in requests/startup or through runtime schema repair. Verify
authentic predecessor histories, clean upgrade/round-trip and destructive-downgrade
refusal where evidence exists. Use disposable PostgreSQL, not SQLite, for
constraints, atomicity, migrations and deterministic concurrent races.

Use ESLint/React Hooks, Prettier, Stylelint, Vitest/Testing Library, focused
Playwright, Ruff, mypy, pytest/PostgreSQL and generated OpenAPI checks according
to changed behavior. CI enforces relevant checks; hooks alone are insufficient.
Test observable rules, exact money, authorization, replay/stale denial, audit
rollback, adjacent workflows and maximum valid inputs, not implementation wording.
Record tested source/artifact with actual commands/results. Independently review
the final candidate; fix accepted findings and obtain focused re-review.

Compose uses isolated PostgreSQL/network/volumes without a published DB port.
Health probes separate process from database readiness without leaking config.
Target explicit disposable projects for tests/resets; no wildcard/shared teardown.
Provider/region, production file storage/scanning/retention, backups and incident
ownership remain external gates described in security.md. No production changes
follow from this guide.

### Authorization ownership

The access coordinator owns identity freshness and exposes the derived
`authorization(session)` view from `features/auth/session/authorization.js`. Page guards,
navigation and workspace destinations use this catalog; unverified/unknown roles
have no page capabilities. Query remains the session cache, with no second mutable
permission store. These UI capabilities are presentation checks, not authority.

`AuthService.principal` resolves the actor, optional mutation CSRF and required
roles once inside the caller's transaction. Admin, planning and Partner adapters
reuse it; planning integrity and Partner binding remain specialized guards. Never
carry an actor across transactions or external work as authorization evidence.
Resource state, contributor exclusions and `allowed_actions` stay with their
server use cases; this page catalog does not replace workflow checks.

### Auth navigation and session observation

Keep the session Query observer attached across authentication changes. Clear its
value to `null` while access is masked; removing the observed disabled query can
leave consumers attached to a discarded cache entry. Purge protected queries and
mutation variables before publishing the newly verified session.

`authorization.js` owns the page catalog (paths, owning detail routes, capability,
label and icon) and role workspace defaults. `ApplicationSidebar` and direct route
guards derive from that same catalog. Users is currently the Admin default;
Dashboard remains the default for the other known roles. Changing a role’s default
does not require changing its sidebar.
`navigation.js` selects a permitted
last page for that user/role, otherwise that default. It retains resource paths in
memory only and persists only allowlisted top-level destinations in sessionStorage;
search values, fragments, credentials and form data are never retained. Resource
access is still checked by the API when returning. Empty search values are stripped
by the Router root middleware; meaningful filters/cursors remain shareable.

Auth CTAs stay busy through their dependent session check and navigation. Logout
is coordinated by `LogoutProvider`, outside the protected tree: one page loader
covers the request and fresh anonymous-session check. Failure keeps access masked
and offers deliberate retry; it does not silently restore the previous workspace.

Current sidebar page matrix (2026-11-05):

| Role                 | Pages                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| Agent / Superviseur  | Tableau de bord, Prévisions (PTA), Réalisation                                   |
| Validateur définitif | Tableau de bord, Prévisions (PTA), Réalisation, Partenaires, Projets, Historique |
| Admin                | Tableau de bord, Utilisateurs, Historique                                        |
| Partenaire           | Tableau de bord, Mes projets, Exports                                            |

Internal notifications open in a modal from the sidebar; they are not an extra page.
Prévisions owns PTA navigation and creation; Agents add Activities to an existing
PTA without needing catalog-management access. See project status for the staged
explicit-creation cutover while its supplied screens are being integrated. Partner Exports uses the existing scoped
annual CSV endpoint; it loads profile/projects/PTAs, not activity detail lists.

## Business History and security output

Global History and `/activities/{identifier}/history` project the same append-only
Audit records with role/resource checks before pagination. Global list and CSV
share role-specific action selection; filter options use that same selection.
Ordering is timestamp then event ID, newest first. Details include recorded
reasons, exact financial values and safe field changes. Revision navigation still
uses the immutable revision endpoints; old rows are not rewritten.

Planning command validation precedes compact audit projection. New planning
records omit repeated API capabilities and approved/candidate snapshots; they
retain changed business fields and evidence links required by workflow consumers.
Execution facts retain their existing financial-integrity contract. No-op draft,
assignment and profile saves preserve the version and create no business event.
Financial return/cancellation reasons are recorded in the transaction from the
actual decision/declaration. Legacy missing deltas stay missing; withdrawal reasons
may be read from the exact linked immutable revision.

`app.auth.security_log` emits one-line JSON through `mjl.security` on stderr,
without propagating to duplicate root handlers. Completed OTP authentication,
credential/OTP failures, suspicious authorization denials, abuse-limit crossings
and significant account/security changes are classified explicitly. Routine
successful password/OTP preparation/delivery/resends, logout, recovery transport
and notification-read events do not create database audit rows. Business account
and invitation evidence used by integrity checks still does. Logging callbacks
run after the command transaction commits; rollback emits no successful event.

Each worker has a fixed-size counter, bounded by `MJL_SECURITY_LOG_MAX_PER_MINUTE`
(default 120, allowed 1–10000). Excess events are suppressed, with a bounded count
reported on the next event after the minute expires. Total capacity scales with
workers; a restart resets this process-local limit. This supplements authentication
abuse controls, which remain unchanged. Success/account events are INFO; failures
and suppression are WARNING. Only event/outcome, UTC time, valid UUID actor/target
and correlation identifiers are emitted—no email, IP, cookie, proof, token, OTP,
password, request body or exception text. Provider collection/access/expiration
is a deployment responsibility, not an application retention guarantee.
