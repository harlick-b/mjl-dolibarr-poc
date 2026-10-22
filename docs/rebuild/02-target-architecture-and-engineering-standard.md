# MJL rebuild architecture and Engineering Standard

Status: **PROPOSED_FOR_AUTHORIZATION**, 2026-10-22. The user selected the stack;
this document proposes its technical boundaries. It is not an implementation
approval, a frozen standard, compliance evidence or production readiness.
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

Proposed repository locations are `frontend/`, `backend/`, `contracts/`, shared
`docs/` and, after authorization, a separate rebuild Compose file. Keep the POC
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
One small HTTP function may handle credentials/error parsing; no API repository
framework. Render loading, unavailable, empty and validation states distinctly.
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
Bound list pagination (proposed default 25/max 100), deterministic ordering and
allowlisted server-side filters. Cursors are appropriate for evolving audit
chronology; official whole-PTA totals must not inherit page/search denominators.
Money travels as exact decimal integer strings and is computed as integer XOF,
not JavaScript Number beyond its safe range. Missing remains null, not zero.

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
