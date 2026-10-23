# MJL rebuild architecture and Engineering Standard

Status: **UI/API RULES CONFIRMED (DEC-102)**, 2026-10-23; other proposals retain
their prior status. The user selected the stack;
the first technical slice is authorized separately by DEC-092. Remaining business
and authentication mechanisms are proposals, not implementation approval, a
frozen standard, compliance evidence or production readiness.
Business authority remains the PTA brief and DEC-087–090. The frozen Dolibarr
architecture and Standard v1 remain unchanged historical implementation references.
Security requirements belong to [the security baseline](03-security-compliance-baseline.md).

## Minimal architecture and scope

| Mechanism | Requirement and owner |
| --- | --- |
| React/Vite JavaScript/JSX frontend | Browser/PWA client; frontend owns rendering and interaction |
| TanStack Router + Query | Navigation and one server-state cache, respectively |
| Tailwind + shadcn/ui + Lucide | Approved MJL presentation with accessible primitives |
| FastAPI modular monolith + OpenAPI REST | Backend owns authorization and business truth |
| SQLAlchemy 2 + PostgreSQL + Alembic | Exact relational integrity and reviewed schema evolution |
| Server-side opaque sessions | Invitation/password/email OTP and revocable 24-hour sessions |
| Static-only service-worker cache | Installable shell without offline business operations |
| Separate frontend/backend deployment, local Compose | Selected topology without choosing an unapproved cloud |

The foundation uses `frontend/`, `backend/`, shared `docs/` and
`compose.rebuild.yaml`. FastAPI generates `/openapi.json` for the two actual
`/api/health/live` and `/api/health/ready` endpoints; no duplicated contract
artifact or future business contract directory is created. Keep the POC
and its existing Compose untouched. Do not precreate feature folders, empty
layers or interfaces. Organize actual consumers by feature as they appear.
HTTP routes depend on application use cases and domain rules; use cases access
persistence and audit. Domain rules do not depend on HTTP, React or globals.
No microservices, generic workflow/repository engine, event bus, broker, Redis,
Celery, Kubernetes or interchangeable adapters without a concrete requirement.

## Frontend responsibilities

Router owns navigation, route/search parameters, matching, navigation status and
route loading/error boundaries. Use JavaScript route definitions; no TypeScript
prerequisite. Query owns fetching, cache, freshness, invalidation, mutations and
request status. React local state owns temporary form values, selection and
open dialogs. Do not copy Query results into Context or redundant state. A
form's intentional editable snapshot must retain the server version and detect
stale saves rather than silently overwriting refetched changes.

Use one QueryClient supplied through Router context. Route loaders prime the
critical queries with the same feature query options used by component hooks;
components read Query's cache. Do not retain a competing loader payload/cache.
Keep query keys serializable and include resource, filters, pagination and
relevant authenticated scope. Keys contain no secrets. The backend derives
actor/scope; a key or request parameter cannot confer authority. Pass AbortSignal
to fetch, throw sanitized HTTP errors and validate the expected response shape.
A shared RestClient exposed through RestClientProvider/useAPI handles
credentials/error parsing (DEC-102); no API repository framework. Render loading, unavailable, empty and validation states distinctly.
[Router integration](https://tanstack.com/router/latest/docs/framework/react/guide/external-data-loading)
and [Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
provide the implementation guidance, not new business requirements.

Query defaults need explicit review: data starts stale, stale queries may refetch
on mount/focus/reconnect, failed client queries retry three times and inactive
queries normally expire after five minutes. Choose freshness per resource; use
fresh server decisions for permissions, approvals and financial summaries, never
an infinite/static permission cache. Do not retry 401/403 or validation failures;
limited read retries may be appropriate for transient failures. Invalidate
related detail/list/summary keys after confirmed mutations. Do not show optimistic
financial approval or settlement success. Backend authorization is authoritative
on every request, regardless of cached capabilities.
[Official defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults).

Sensitive mutations have `retry: false`. Prevent offline pausing/replay too:
propose `networkMode: 'always'` for mutations so an unavailable network fails the
actual request rather than holding it until reconnect. An offline UI guard is
advisory, not proof of connectivity. Do not persist/resume paused mutations or
create an offline queue. A lost response means outcome unknown; reconcile via a
fresh read before any deliberate resubmission, with server replay protection for
the relevant action. [Network modes](https://tanstack.com/query/latest/docs/framework/react/guides/network-mode)
and [mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations).

On logout, account/scope change or session expiry: stop active requests, clear
Query query/mutation state and Router retained data, reset protected forms and
navigate to authentication. Ignore late responses from the previous context.
No persisted authenticated response cache, localStorage credentials or sensitive
form recovery. Server expiry still applies when the browser is offline.

## React and visual rules

Components are pure; props/state immutable; Hooks unconditional and ordered;
list keys stable by identity. Derive ordinary filters/totals during rendering,
handle clicks in event handlers, fetch through Query and navigate through Router.
Use controlled forms and keys for intentional resets. `useEffect` is for genuine
external synchronization (subscriptions, timers, imperative integrations) with
cleanup, not prop copying, redundant state synchronization, routine fetches or
button actions. Avoid direct DOM manipulation, premature memoization, giant
shared state stores and generic components without real consumers.
[React effects guidance](https://react.dev/learn/you-might-not-need-an-effect),
[React reference](https://react.dev/reference/react).

Approved v3 tokens remain visual authority: navy `#16324f`, action/focus blue
`#164f7a`, background `#f5f7f8`, text `#202529`, Inter with Arial/Helvetica/sans-serif
fallbacks, 4px spacing scale, 32/40px controls and 44px touch controls, 40/44px
rows, 10/6/8px control/card/panel radii. Preserve visible keyboard focus,
non-color status cues, reduced motion, forced colors and responsive layouts.
Tailwind/shadcn consume these tokens; shadcn defaults are not a new identity.
Use Lucide consistently and accessible names on icon-only controls. Add only
components needed by the current slice.

`docs/inspiration/` is local-only composition evidence. Its HTML green palettes
do not override v3; existing login PNG uses navy/blue. Reconcile applicable
inspiration before product-screen work; absent references block that screen.
The foundation uses a neutral technical shell, no invented PTA design. Font
loading via a Dolibarr header hook is historical. Hosting/CSP/privacy of the
browser font must be resolved before sensitive deployment; exports and emails
must not depend on a remote font service.

## PWA and deployment updates

Provide a manifest, icons, supported installability, HTTPS outside localhost,
service worker, responsive shell and offline indication. Cache only an explicit
allowlist of public versioned static assets. Exclude `/api`, authentication,
documents, exports, private navigation responses and all non-GET requests.
Authenticated responses use `Cache-Control: no-store`; inspect HTTP caches as
well as Cache Storage. No offline database, background sync, confidential file
cache or persistent authenticated API cache. Business operations require a live
verified server response, never a cached success.

Version static caches and delete old static caches during safe activation. Offer
a controlled update/reload when no mutation or unsaved form is active; do not
force a worker takeover mid-operation. An incompatible client version must fail
safely and request reload, not retry mutations. Logout/account switching/expiry
clears protected client state even though the public shell may stay cached.
Only the shell can be shown offline, with clear unavailable business actions.
[Installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Backend and REST

Use feature APIRouters with request/response validation and explicit projections.
Dependencies provide the current verified actor, resource scope and request
session where useful; no DI container or business logic in dependency teardown.
Routers enforce methods, parse inputs and map errors; use cases authorize current
facts, enforce domain rules and own writes/audit. Pure rules remain callable
without a request. No cyclic feature imports or ORM-row serialization.
Start with synchronous SQLAlchemy sessions and synchronous database routes to
avoid blocking an async event loop; add async only with a demonstrated need.
[FastAPI structure](https://fastapi.tiangolo.com/tutorial/bigger-applications/),
[dependencies](https://fastapi.tiangolo.com/tutorial/dependencies/),
[testing](https://fastapi.tiangolo.com/tutorial/testing/).

Use one `/api/v1` application contract, not a version per feature. FastAPI
OpenAPI is generated from implemented routes; review its exported artifact in
`contracts/` once implementation begins. Do not create a replacement contract
in this audit. Existing 75 operations are disposition evidence, not a backlog
to copy. No public external integration API is authorized.

Proposed errors: `{code, message, fields?, request_id}` with stable codes,
French user-facing messages, sanitized details and no SQL/trace/secret leakage.
Document 401 session required, 403 forbidden, non-disclosing 404 for invisible
objects, 409 stale/conflicting/replayed mutation, 422 invalid input, 429 abuse
limit and 503 temporary failure. Align validation errors with this envelope.
Use cursor pagination for collection APIs with default limit 60 and the DEC-102
list envelope below, superseding the default-25 proposal. Maximum limit is 100; invalid limits return 422. Preserve deterministic ordering and allowlisted server filters;
official whole-PTA totals must not inherit page/search denominators.
Money travels as exact decimal integer strings and is computed as integer XOF,
not JavaScript Number beyond its safe range. Missing remains null, not zero.

## UI/API standard — DEC-102

The 2026-10-23 user request and follow-up approval confirm the following rules.
Apply this entire UI/API section, including shared helpers and corrected examples,
during every separately authorized page and related API implementation. Verify
applicable rules with focused slice checks; this is a standing implementation
requirement, not authorization to start new pages or migrate existing runtime. This is documentation-only
standard setting, not runtime migration, dependency installation or later-slice
authorization. Existing security and business requirements remain. The uploaded
Axios client illustrates the intended pattern; it is not a security exception.

### Confirmed user requirements

- All collection APIs use cursor pagination; omitted `limit` defaults to **60**
  on the server. Return `count`, `data`, `next`, `previous`, and `object: "list"`.
- Centralize API/auth handling in a RestClient, exposed by RestClientContext and
  RestClientProvider through `const { api } = useAPI()`.
- Feature hooks consume that client with TanStack Query. Context does not duplicate
  Query server state. Add other contexts only for actual shared-state needs.
- Use `toast` from `sonner`, `react-localization` for locales, and
  `HelmetProvider` from `react-helmet-async`.
- Retain JavaScript/JSX, French-first content and Router/Query ownership above.

Illustrative final-page response (using the count semantics below):

```json
{
  "count": 1,
  "data": [{"id": 123}],
  "next": null,
  "previous": null,
  "object": "list"
}
```

A non-null link follows the user's format, for example
`https://example.invalid/api/v1/access/users?limit=60&cursor=opaque-cursor`.
This domain is illustrative, not a hosting decision. The sample Base64 value
in the request does not require encoding an offset as a cursor.

### Approved additional API rules

| Topic | Recommendation |
| --- | --- |
| Count | Exact authorized, filtered total before the cursor window, not page length. Count and rows use a consistent request snapshot. Assess cost; never expose inaccessible rows. |
| Limit validation | Accept integers 1–100; default 60; invalid/out-of-range values return 422 rather than silent clamping. |
| Navigation | Absolute next/previous URLs preserve filters, ordering and limit; null at either end. Empty collection: count 0, data [], both links null. Generate links from a trusted configured public origin, not untrusted Host/forwarded headers. |
| Cursor design | Versioned opaque keyset cursor; deterministic ordering plus unique ID tie-breaker. Validate filter/order context; malformed or mismatched cursor returns a stable 422 code. Reauthorize every request; cursors confer no access. |
| Previous page | Reverse keyset traversal, returned in the same display order. Reset cursor after filter/order/limit changes; no random page-number navigation. |
| Concurrent changes | Each page reflects currently authorized data; no frozen multi-page snapshot promise. Prefer immutable sort fields. Official totals/exports use their own complete-selection contract. |
| Error shape | Retain A1 `{code, message, request_id}`; add optional `fields` with stable field codes for validation. Normalize framework validation into that envelope. |
| HTTP semantics | Retain documented 401/403/404/409/422/429/503 meanings. Use 201 plus Location on create, 204 only for empty success, Retry-After on rate limiting; never return failures as 200. |
| Naming | Plural resource paths without trailing slash; snake_case JSON/query fields; allowlisted filters/sort, unknown-field rejection. Keep `/api/v1` and explicit actions for domain transitions. |
| Dates | RFC 3339 UTC timestamps; YYYY-MM-DD calendar dates without timezone conversion. Retain exact integer XOF strings and null-versus-zero. |
| Contract | Document DTOs, pagination, filters and errors in generated FastAPI OpenAPI; update consumers and focused contract tests together. |

The selected 422 is a request-validation convention, consistent with FastAPI
and MJL's existing invalid-input status. For example `limit=101`, `limit=0` or
`limit=abc` fails the declared integer/range constraint; omission alone selects
60. Rejecting makes caller mistakes visible instead of silently changing the
requested size. HTTP 400 is also a possible API convention, not inherently wrong;
422 is recommended here for consistency. The cap bounds response size and per-page
work; it does not bound total-count query cost. Maximum 100 is a project choice approved in the follow-up, not an HTTP requirement.
[FastAPI validation handling](https://fastapi.tiangolo.com/tutorial/handling-errors/).

Existing expected-version guards, atomic audit and server-side resource authorization
remain mandatory. Add idempotency keys only for a concrete replay requirement;
no generic idempotency subsystem or automatic write retries.

### Client corrections required by existing safeguards

- Preserve HttpOnly session cookies and CSRF/Origin protection. No localStorage
  session tokens, token-based Basic auth, CryptoJS HMAC or browser-held signing
  secret. A shared secret shipped to browsers cannot authenticate trusted clients.
  TLS, server validation and existing authorization remain required.
- Centralize credentials, CSRF, trusted path joining, JSON parsing, cancellation,
  sanitized errors and session-expiry handling. Reject pagination URLs outside
  the configured origin/API prefix before sending credentials or CSRF.
- Construct one stable client per provider lifetime, or inject it. Memoizing
  `{ api }` cannot stabilize a newly constructed client on each render. Read current
  CSRF/session context at request time. Use a null context default and make
  `useAPI()` fail clearly outside its provider.
- Every failed request rejects even after an expiry callback. The supplied 401
  branch can otherwise resolve undefined. Deduplicate protected-session expiry
  cleanup, keep login/OTP failures local, and prevent old-session responses from
  logging out a new session. Never infer expiry from translated message strings;
  403 does not automatically mean logout.
- Preserve the list envelope as an object, not an Array with attached metadata.
  Keep parameters local per request; remove shared mutable `requestParams`.
- Throw structured Error instances with safe status/code/message/fields/requestId,
  not bare strings or raw Axios configs/headers. Distinguish HTTP, network,
  cancellation and malformed-response failures; handle 204 without JSON parsing.
- Propagate AbortSignal; retain no-store and online-only rules, no offline queue,
  no automatic write retries and no false success after a lost response.
- Storage helpers may hold non-sensitive preferences only. Namespace keys,
  handle unavailable storage/malformed JSON, and clear only owned keys; the
  supplied `engine.clear()` removes unrelated storage as well.

Shared client interface: `list(path, params)` returns a Query function receiving
`{ signal }`, preserving the supplied `queryFn: api.list(...)` usage; retrieve
follows the same convention. Writes return Promises. All methods return parsed
JSON: lists return the full envelope; create returns the documented resource,
not an Axios wrapper. Use PATCH for partial update, PUT only where contracted.
Do not fabricate a `current` ID or add unused CRUD/upload methods. Missing IDs
are handled with query eligibility, not inconsistent return types.

During an authorized implementation, extend the existing `frontend/src/auth.js`
transport seam and migrate callers together. Axios itself is not mandated by the
illustrative upload; fetch can implement the shared client. Avoid parallel clients.

### Query and UI conventions

The installed Query major is v5. Use `gcTime` rather than `cacheTime`, mutation
`isPending` rather than `isLoading`, and omit placeholder data for the example's
`keepPreviousData: false`. Retained pages, when appropriate, use v5
`placeholderData`. Never retain another principal's data.
[Official v5 migration guide](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5).

Do not copy the global one-hour freshness/48-hour retention or disabled
mount/focus/reconnect settings for sensitive state. Choose freshness per resource;
session/permissions require fresh checks. Enable protected queries from verified
session readiness per query, not a captured token. Public auth/health queries have
separate eligibility. Keep one QueryClient, cancellation/cleanup on logout and
old-session response guards. Keys include filters, cursor, limit and non-secret
principal context. Invalidate affected lists/details/summaries after confirmed
mutations; reconcile unknown outcomes before deliberate resubmission.

Use one root Sonner Toaster. MutationCache supplies a safe French error toast
only when there is no local mutation error handler; suppress duplicate expiry
and abort feedback. Render query errors inline instead of repeated background
toasts. Field errors remain beside fields; blocking errors must remain discoverable
after a toast disappears. Success feedback follows confirmed server success.
[Sonner usage](https://sonner.emilkowal.ski/).

Centralize French keys for labels, validation, toast messages and titles; translate
stable API codes, not parsed server messages. Set French as the explicit default
and fallback; use named interpolation and keep display formatting separate from
machine dates/XOF. A locale context is warranted if language changes must rerender
consumers; this does not authorize a new language-switcher feature.
[react-localization usage](https://github.com/stefalda/react-localization).

Place HelmetProvider at the root, with localized route titles and no sensitive
metadata. Pin compatible versions for the installed React 19 during implementation;
verify provider mounting, titles and French rendering without compatibility
bypasses. No packages are installed in this documentation task.
[Helmet provider guidance](https://github.com/staylor/react-helmet-async).

### Shared display and pagination helpers

The user's follow-up supplies date/number formatting and cursor helpers as
approved standardization inputs. Centralize these small reusable helpers when implementing
the standard, with the following contracts; the snippets are not runtime changes.

- `formatDate`: default French `dd/MM/yyyy`; explicitly parse/validate accepted
  date inputs. Distinguish date-only business values from timestamp instants:
  calendar dates must not shift with browser timezone; timestamps need a documented
  display timezone. Define missing/invalid display explicitly (`—`), never
  silently substitute today. A formatting locale alone does not select a timezone.
  The supplied `format`/`fr` imports and compatible date-library version must be
  resolved during implementation; this does not install a dependency.
- `formatNumber`: preserve zero, negative values and missing values distinctly.
  The supplied truthiness fallback conflates null/undefined/NaN with zero.
  Use `—` for missing/invalid display and French grouping for valid numbers.
  Separate ordinary numeric formatting from `formatXOF`: API integer strings
  must be validated and formatted exactly (for example through BigInt), never
  rounded through Number. Calling a string's `toLocaleString` does not apply
  numeric grouping. Document precision per numeric field rather than silently
  rounding business values with generic defaults.
- Pagination helpers take the **list envelope object**, not an Array. Prefer link
  presence for navigation visibility; `count > limit` depends on total-count
  semantics and can hide a previous-page escape after concurrent deletion.
  Treat missing links as disabled; also disable navigation during a page transition.
- Extract only the opaque cursor from a validated server link. Null means no
  navigation. Reject malformed URLs, foreign origin/API paths, and missing/empty
  cursors rather than throwing from a click handler or navigating to page one.
  Verify links retain the current filter/order/limit context. Query failure must
  not be disguised as a valid empty list.
- Router owns cursor search state. `updateQueryCursor` should invoke a Router-backed
  callback preserving other search fields, not create a second React cursor state.
  Its return type follows that callback (usually void/Promise), not Function.
  Back/forward navigation should restore cursor/filter state; filter changes clear
  the cursor. Query keys use those same normalized search values.

Illustrative pure predicates after list-response validation:

```javascript
export const showPagination = (page) =>
  Boolean(page?.next || page?.previous);

export const isNextDisabled = (page, isFetching = false) =>
  isFetching || !page?.next;

export const isPreviousDisabled = (page, isFetching = false) =>
  isFetching || !page?.previous;
```

Focused future checks include zero/null/invalid and large exact XOF values,
leap-day and timezone-boundary dates, first/middle/last pages, a deleted last-page
result, malformed/foreign links and Router history. Helper code is deferred to
an authorized implementation; the count semantics and display placeholders above
are approved defaults.

### Migration gap and focused future checks

Readiness 05 and A2.1 implementation use page/size (default 20, max 50), returning
`items/total/page/size`. DEC-102 supersedes that target; the current runtime is
unchanged. A later authorized migration must update both account/invitation lists,
OpenAPI, client and UI together. This does not authorize A3 or business features.

Future checks cover default 60 and invalid limits; forward/backward/empty/end
pages and duplicate sort values; filtered count and resource isolation; malformed
cursors/filter changes; cookies/CSRF and foreign-link rejection; 401 rejection and
old-session races; cancellation/structured errors; stable provider and one toast;
French fallback/titles; no persisted credentials/data or offline write replay.
Documentation review establishes none of those runtime properties.

## Sessions, authorization and first administrator

Propose PostgreSQL-backed opaque sessions, with a random browser identifier,
server-side hashed identifier, expiry and revocation state. Password verification
creates only a short-lived pending OTP challenge, never business access. OTPs
are short-lived, single-use, attempt/resend limited and protected at rest;
invitation/reset proofs are expiring, single-use and non-enumerating. Use a
maintained password hashing implementation (proposed Argon2id), no custom crypto.
Authentication abuse controls and mail delivery must be verified before auth
is operational. Do not inherit the POC's disabled-OTP configuration.

Rotate sessions after authentication; enforce max 24 hours idle and 24 hours
absolute on the server, then password plus OTP again. Background polling does
not extend inactivity. Revoke sessions after deactivation, credential reset or
scope/role change. Check effective role and resource ownership on every read,
write, export and eventual download, with locked rechecks for sensitive writes.
Admin has no business mutation; contributor identity/revision guards survive
role changes. No public signup, remembered devices, LDAP/SSO or new identity
provider dependency.

Propose one browser origin: frontend static hosting and backend separately
operated, ingress routes `/api` to FastAPI. Vite proxies `/api` in development.
Use HttpOnly, Secure, host-only, SameSite=Lax cookies (localhost HTTP exception
only), CSRF protection and Origin validation for unsafe requests, including auth
flows. CORS is disabled when same-origin. If later topology requires cross-origin
credentials, use exact trusted origins and credentials, never wildcard; test
CSRF/cookie behavior before use. Cross-site cookies require a separate topology
review. TLS is also required on remote internal/database connections as applicable.

First-admin bootstrap is a future explicit operator CLI, unavailable over HTTP:
require an empty identity store and controlled deployment access, create one
technical identity from operator input, never defaults or sample credentials,
audit it, then refuse reuse after provisioning. Activation and subsequent login
must follow the verified email/password/OTP policy. No native account migration.
Exact ceremony belongs to the later auth slice, not the foundation scaffold.

## PostgreSQL integrity and migration

Normalize real entities when their slice is approved. Use PK/FK, uniqueness,
NOT NULL and CHECK constraints for local invariants; nullable checks must reject
missing values explicitly where required. Aggregate sums and cross-row rules
need locked transaction checks, not cross-row CHECK expressions. Exact integer
XOF, balanced allocation and null/zero distinctions are mandatory.

One use case owns one outer transaction. Account for SQLAlchemy autobegin from
authorization reads: establish the owned boundary before those reads, or end the
read-only dependency session before opening it; never silently nest begin calls.
Within the owned transaction, lock relevant rows in deterministic
order, recheck authorization/state/revision, write business facts and append audit,
then commit before success. Persistence helpers may flush but never commit.
Rollback on failure; discard failed sessions. Each request/task has its own
session, never shared concurrently. Audit failure rolls back business mutation.
Do not hold transactions across email delivery, HTTP calls or file streaming.

Use version predicates for stale writes and row locks/unique constraints for
races such as first PTA creation and one active Project. Sensitive one-time
approvals/settlement use action-bound replay identity and a transactionally
recorded result or rejection; do not blindly inherit the old token endpoint.
Unknown commit outcomes must be reconciled, not automatically retried. Approved
records stay immutable; corrections retain linked originals, reason and actor.
The exact financial correction workflow is a later business decision, not a
reason to restore the superseded expense ledger.

Alembic autogeneration produces drafts for human review, not trusted migrations.
Run migrations once as an explicit deployment step with separate DDL privilege;
application accounts cannot alter schemas. No migrations in requests or startup
replicas, no silent repair. Review data impact and recovery/rollback limits,
particularly nontransactional operations. Use disposable PostgreSQL for migration
and concurrency tests, not SQLite substitutes. Foundation proves connection and
Alembic revision bookkeeping only, without a business schema.
[SQLAlchemy sessions](https://docs.sqlalchemy.org/en/20/orm/session_basics.html),
[PostgreSQL constraints](https://www.postgresql.org/docs/current/ddl-constraints.html),
[Alembic generation](https://alembic.sqlalchemy.org/en/latest/autogenerate.html).

## Quality tools and verification responsibilities

| Tool | Responsibility |
| --- | --- |
| ESLint + React Hooks rules | JavaScript/React correctness, Hook order and supported invariants |
| Prettier | Formatting only; disable conflicting stylistic lint rules |
| Stylelint | Authored CSS, including appropriate Tailwind syntax handling; not JSX formatting |
| Husky + lint-staged | Lightweight changed-file local checks; no full browser suite per commit |
| Vitest + React Testing Library | Pure calculations and observable component interaction |
| Playwright | Focused real-browser navigation, API/auth/UI/PWA journeys |
| Ruff | Python lint and formatting; no second Python formatter |
| mypy | Typed application interfaces and practical strictness; scope third-party exceptions |
| pytest + disposable PostgreSQL | Domain rules, real constraints, atomicity, concurrency and negative authorization |
| OpenAPI contract validation | Generated contract, response/error conformance and reviewed drift |
| CI | Independently enforce relevant checks; hooks are bypassable and insufficient alone |

Pin compatible stable versions and exact command scripts in the later foundation
slice; no package install or tooling configuration is authorized here. Do not
write tests that merely preserve wording, private implementation or ceremony.
Prioritize observable behavior, immutability, replay/stale rejection, atomic audit
and resource isolation. Run only focused checks for the touched surface.

## Infrastructure boundaries

Future Compose provides frontend, backend and PostgreSQL health checks, isolated
volumes and secret-free environment examples. Do not publish the database port;
only backend/migration/test consumers reach its private network. Readiness probes
must not leak configuration and must distinguish process health from DB readiness.
Reset commands must target explicitly named disposable projects/volumes, never
wildcard or shared POC storage. No teardown or configuration changes in this audit.

Private evidence storage, scanning, retention and key custody remain separately
gated Phase 4 decisions; no generic ECM, document version-series engine or preview
infrastructure. Provider/region, jurisdiction, network administration, backup and
incident ownership need external confirmation before relevant environments or
sensitive data use. No cloud provider is approved by this proposal.
