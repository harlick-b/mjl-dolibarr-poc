# Engineering guide

Use this guide for application changes and the [business rules](business-rules.md)
for behavior. [Security](security.md) owns protection and external acceptance;
[design](design.md) owns presentation. Setup commands are in [README](../README.md).

## Architecture and ownership

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

Errors use {code, message, fields?, request_id}, stable codes and safe French text.
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

## Query, forms and feedback

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
titles without sensitive metadata. Storage helpers may retain only namespaced
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

Local Vite proxies /api. Frontend and backend deploy separately; the intended
browser topology uses one origin with /api ingress. Cookies are HttpOnly, Secure,
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
