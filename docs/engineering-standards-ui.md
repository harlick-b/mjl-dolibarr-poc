# Frontend engineering standard

Portable reference for humans and agents · Reviewed 2026-11-18.

**Use this file as the authority for accepted engineering rules.** Observed behavior documents the source project; it is not automatically a requirement for a new product. Open decisions remain unresolved. Examples labelled adapted illustrate a pattern; they do not establish production behavior.

## Contents

- [Adoption checklist](#adoption-checklist)
- [Migrating an existing project](#migration-workflow)
- [Authority and adoption](#frontend-readme)
- [Folders, code and architecture](#frontend-architecture)
- [Role booleans and active context](#role-booleans)
- [RestClient, useAPI and TanStack Query](#frontend-api-and-query)
- [Registration, login and session lifecycle](#frontend-authentication)
- [Dependencies, configuration and tests](#frontend-tooling-and-tests)
- [Unresolved choices and verification gaps](#frontend-open-decisions)
- [Accepted adoption decisions](#adoption-questions)
- [Complete examples and dependency map](#examples)
- [Embedded source evidence](#evidence)

**At a glance:** JavaScript/React; pages in `src/pages/`, shared UI in lowercase `src/components/`, hooks in `src/hooks/`; TanStack Router; RestClient → context provider → useAPI → TanStack Query; Tailwind/shadcn; npm, Prettier, ESLint, Husky and behavior tests.

<a id="adoption-checklist"></a>
## Adopt this standard

Use this checklist when starting a project or introducing the standard into an existing one. It applies the accepted rules below; it does not turn observed source behavior into additional requirements.

- [ ] **Establish ownership.** Copy this file into the destination's `docs/engineering-standards.md` and link it from the README and agent instructions. If both stack standards share one docs directory, give them distinct frontend/backend filenames and link both.
- [ ] **Check stack compatibility.** Review the [toolchain](#frontend-tooling-and-tests), select required dependencies and verify compatible versions. Keep a lockfile; do not copy the entire observed manifest or unused packages automatically.
- [ ] **Wire one representative feature.** Follow the folder layout, routing, `Urls.js`/`ApiUrls.js`, RestClient/provider/useAPI and scoped TanStack Query patterns. Keep current cache defaults as fallback and record data-specific overrides. Replace synthetic identity and API clients with the destination's approved contracts.
- [ ] **Settle remaining auth details.** Apply [AUTH-001](#adoption-questions): simple registration, verified email before first sign-in, email OTP enabled by default with a user setting, shared password checks and return to login after reset. Record session storage/transport/expiry, how users confirm OTP-setting changes, and the email-verification mechanism/expiry. Do not reopen accepted choices unless an approved exception is needed.
- [ ] **Record adaptations.** Replace eHadj branding, role names, campaign fields and integrations with the destination's requirements while preserving the documented responsibility boundaries. Keep source evidence labelled as historical evidence. Record each exception's rule ID, scope, reason, approval, risks, checks and review condition. In ongoing projects, inventory deviations and migrate deliberately.
- [ ] **Verify adoption.** Run the destination's lint/build and relevant behavior tests. Cover query invalidation, scope changes, form failure/retry and the AUTH-001 flows. Configure the test commands documented here before relying on them; `verify` does not include Jest in the source project. Record executed checks and remaining gaps.

<a id="migration-workflow"></a>
## Migrating an existing project

1. **Audit before editing.** Read this standard and the destination's product decisions. Compare actual code/configuration/tests against each applicable rule. Record `rule ID | evidence | gap | risk | planned change | status`; mark unknowns rather than guessing behavior. Inventory existing user edits.
2. **Establish the baseline.** Run the project's available checks and representative user flows. Record pre-existing failures and missing coverage. Add focused behavior checks where a risky migration otherwise has no reliable verification.
3. **Plan small steps.** Separate structural moves/import fixes from dependency, behavior, authentication, permission, API-contract and deployment changes. Order dependent work and identify a rollback point for each step. Preserve product behavior during structural cleanup; resolve conflicting product decisions before affected changes.
4. **Migrate one responsibility at a time.** Use the destination's version control to keep changes reviewable. Update imports, exports, aliases, routes, test paths, configuration and documentation affected by each move. Do not combine unrelated rewrites or overwrite existing work.
5. **Verify each step.** Run relevant lint/build and behavior tests; exercise navigation, forms, requests, cache updates and role/session changes. For API contract changes, verify both the producer and consumer, or explicitly mark the unavailable side unverified. If a change breaks the baseline, repair it or revert only that migration step before continuing. Record any checks that could not run.
6. **Report rule-by-rule completion.** Mark each applicable rule compliant, approved exception, pending or unverified, with evidence. Record exception owners/review conditions and remaining migration work. A passing build alone is not proof of full compliance; do not claim completion while required work remains.

<a id="frontend-readme"></a>

## Frontend engineering standards


### Authority and adoption — FE-001

**Accepted.** MUST means required; SHOULD means the default with a documented reason for deviation; MAY means optional. Only sections labelled Accepted establish reusable rules. Observed sections describe source behavior. Open decisions do not establish a default by accident. Adapted examples demonstrate the pattern and are not tested drop-in features.

The owner approved preserving structure, implementation and test conventions, including authentication and TanStack Query, and using this handbook for new and ongoing projects. New code and substantially modified code MUST follow accepted decisions. Existing deviations MUST be recorded and migrated deliberately; do not rewrite untouched code just to achieve uniformity. A substantial modification changes responsibility, data flow or behavior, rather than only wording or formatting. Compliance applies to the touched responsibility, not an automatic whole-repository migration.

Approved product requirements and explicit project exceptions remain authoritative for product behavior. If an engineering rule conflicts with a destination project's accepted decision, identify the exact conflict and obtain a decision before changing the affected behavior. Continue unrelated work. Do not silently replace authentication, permissions, API contracts, integrations, or deployment settings in the name of compliance.

A project exception MUST record the rule ID, scope, reason, owner approval, risks, verification and migration/review condition. Runtime versions below are an extraction snapshot, not a mandate to freeze versions forever or proof they are current or safe. Dependency upgrades require compatibility checks; this task does not select new versions.

### Reading path

1. [Architecture and code conventions](#frontend-architecture): folders, imports, routing, components, forms, styling.
2. [API access and TanStack Query](#frontend-api-and-query): contracts, wiring, queries, mutations and cache lifecycle.
3. [Authentication](#frontend-authentication): registration, login, OTP, recovery and session lifecycle.
4. [Tooling and tests](#frontend-tooling-and-tests): configuration, dependencies, hooks, test logic and examples.
5. [Open decisions and evidence limits](#frontend-open-decisions): conflicts that MUST NOT be silently standardized.

### Using the handbook in a project

Decision map: FE-001 authority/adoption; FE-002 folders; FE-003 code style/imports; FE-004 routing/URLs; FE-005 UI/forms/lists; FE-006 transport/provider ownership; FE-007 REST contract; FE-008 Query lifecycle; FE-009 auth responsibilities; FE-010 toolchain; FE-011 tests; FE-012 role booleans. Each rule's topic gives source evidence and verification guidance. Original design rationale is unknown unless explicitly documented.

Copy this file to `docs/engineering-standards.md` in the destination project and link it from human and agent onboarding. For example:

```markdown
## Engineering standards

Follow docs/engineering-standards.md and its relevant sections.
Accepted rules govern new and substantially modified code.
Record existing deviations and approved exceptions; do not change sensitive
behavior merely to achieve compliance. Resolve open decisions with the owner.
```

Before a feature, read the relevant rules and local product context, inspect nearby source, identify contract and permission boundaries, and plan behavior-level verification. Afterward, update affected decisions/examples when the convention changes. A proposed change to this handbook MUST identify the old rule, new rule, reason, affected projects/contracts and approval; source changes alone do not silently amend an accepted rule.

The original rationale for many code choices is not recorded. The explanations here describe responsibility and consequences, not an invented history of why the team chose a library.

### Coverage and completion

This handbook covers the shared React foundation and representative page/form/query/auth/test flows. Feature-specific finance, identity, medical, campaign, role names, branding and integrations are not universal defaults. Optional capabilities are catalogued, not certified as completely reusable modules.

For adoption, inventory the target's folders, dependencies, providers, API contract, auth policy, tests and exceptions. A feature is ready when its accepted rules are met, relevant behavior is verified, and any remaining limitation is stated. See [test guidance](#frontend-tooling-and-tests). Source evidence and complete example modules are embedded below; no original checkout is needed.

<a id="frontend-architecture"></a>

## Architecture and code conventions

Authority and adoption: [FE-001](#frontend-readme). Examples marked adapted require project-specific names and contracts.

### Folder ownership — FE-002

**Accepted.** Preserve exact casing and these responsibility boundaries. Feature folders MAY contain nested components, helpers and tests. Create folders when needed rather than empty scaffolding.

```text
src/
  index.jsx                     # browser entry
  App/                          # persistent root, route tree, shell/readiness
    Root.jsx
    router.jsx
    index.jsx
  pages/
    Example/
      index.jsx                 # route-level feature
      index.test.jsx
      components/               # feature-local UI
      exampleLogic.js            # feature-local pure logic when useful
  components/
    ui/                         # low-level shadcn/Radix primitives
    shared/                     # reusable application components
  hooks/                        # reusable hooks, useX naming
  context/                      # providers and contexts
  helpers/                      # non-visual shared utilities and RestClient
    RestClient/
  data/                         # Urls, Params and shared static definitions
  lib/                          # primitive support, e.g. cn()
  locales/                      # localization entry and language/page resources
  assets/                       # images, global styles and other assets
  public/                       # source-side assets where already used
scripts/                        # configuration checks and test/build support
public/                         # root static assets
```

Do not rename `components` to `Components`. Pages compose shared UI; primitives MUST NOT acquire feature business rules. Shell readiness and route behavior belong to `App/`. Extract shared code for existing duplication or a clear responsibility boundary, not speculative reuse.

Evidence: [repository instructions](#evidence-043), [src](#evidence-056), [Group page](#evidence-090), [User feature components](#evidence-096). Verification: inspect file placement and dependency direction in the diff.

### JavaScript and function conventions — FE-003

**Accepted.** Use the established JavaScript/JSX style: `.jsx` for components, `.js` for non-JSX helpers/hooks; PascalCase component names, camelCase functions/variables and `use` prefixes for React hooks. Named components SHOULD be arrow functions, matching the ESLint rule. Keep components and helpers direct and responsibility-focused. Use descriptive event handlers and explicit loading/error/empty states.

Use default exports for page/component entry points where the neighboring code does; named exports for groups of helpers or context values. Existing `pages`, `hooks`, `context`, `data` and `helpers` barrels are valid. MUST NOT import the deprecated `components` barrel: import `components/shared/Name` or `components/ui/name` directly. Shared components SHOULD use source-root imports. Keep Vite aliases, `jsconfig.json` and Jest resolution aligned. A relative import MAY avoid a barrel cycle, as in `useAPI.js`.

Prefer render-time derivation or the triggering event over effects that duplicate state. Effects remain appropriate for external subscriptions, timers and lifecycle synchronization. Do not add memoization, registries or wrappers without a current need. Keep comments that explain contracts or constraints; do not repeat the code or present guesses as guarantees. JSDoc, when present, MUST match actual return shapes.

Observed: PropTypes are used, but ESLint disables `react/prop-types`; mandatory PropTypes coverage is an [open decision](#frontend-open-decisions). The repository is not a TypeScript baseline despite some tooling globs accepting TS extensions.

Evidence: [ESLint](#evidence-039), [aliases](#evidence-099), [jsconfig](#evidence-050), [useAPI](#evidence-079), [instructions](#evidence-043). Verification: lint plus focused review; lint success alone does not prove all these rules are enforced.

### Routing and URL ownership — FE-004

**Accepted.** Use TanStack Router, define the route tree in `src/App/router.jsx`, and put navigable application paths in `src/data/Urls.js`. Consumers MUST use these definitions for application navigation instead of independently repeating path strings. Keep route shell/providers in a persistent root route so navigation does not reset their state. Keep route access and navigation visibility consistent, while treating the API as the authorization authority.

Adapted excerpts showing placement and usage:

```jsx
// src/data/Urls.js
const Urls = { base: '/', example: '/example' };
export default Urls;

// Inside src/App/router.jsx, after rootRoute exists:
const exampleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: Urls.example,
  component: Example,
});
// Include exampleRoute in rootRoute.addChildren([...]).

// A navigation consumer:
<Link to={Urls.example}>Examples</Link>;
```

`createRoute`, `Link` and the root/router factories come from `@tanstack/react-router`; import `Example` from the pages entry and `Urls` from `data`. Protected routes use the existing `ProtectedRoute`/role predicate pattern rather than exposing a page merely because a link is hidden.

Observed route settings: `defaultPreload: false`, `scrollRestoration: false`; custom search parsing preserves strings and repeated keys. `useUrlSearchParams` adapts URLSearchParams-style consumers with push/replace semantics. Preserve these semantics in ongoing projects; they are not an unexplained mandate for all products.

**Accepted extension:** keep page paths in `src/data/Urls.js` and API resource paths in `src/data/ApiUrls.js`. Consumers MUST import API resource constants instead of repeating endpoint strings. Keep base URLs in environment/provider configuration; resource paths retain RestClient trailing-slash conventions. The observed source uses resource literals; migrate touched callers deliberately. The [complete example](#examples) includes both catalogs and their exports.

Evidence: [entry](#evidence-087), [router](#evidence-059), [Urls](#evidence-069), [search adapter](#evidence-086), [route tests](#evidence-060). Verification: direct navigation, denied route, back/forward, refresh and query-string behavior.

### Components, styling, forms and lists — FE-005

**Accepted.** Use Tailwind utilities and local shadcn/Radix primitives. MUST NOT introduce CSS modules, page-specific stylesheets or a parallel component system. Global CSS owns shared tokens, Tailwind layers and retained compatibility styles. Use `cn()` from `lib/utils` for conditional/merged classes and primitive variants for semantic styles. Status colors belong to shared badge variants, not individual call sites.

Shared application components own layouts, dialogs, pagination and reusable states. Feature-only components remain in their page subfolder. Preserve labels, keyboard operation, focus indicators, disabled/busy states and narrow-screen usability. Use Lucide and the icon convention in the touched component. Each destination project defines its own branding/tokens in `DESIGN.md`; eHadj's logo, green palette and domain-specific badges are not a new project's default.

React Hook Form, Zod and `zodResolver` are established for structured forms; SHOULD use that combination for new multi-field forms unless the local pattern or an approved exception requires otherwise. Existing simple auth forms use controlled state. Do not migrate them implicitly. Frontend validation assists users; backend validation remains required.

Adapted form logic from the User feature (render with existing Form/Input primitives and labelled controls):

```jsx
const ExampleSchema = z.object({ name: z.string().trim().min(1, 'Name is required') });
const form = useForm({
  resolver: zodResolver(ExampleSchema),
  defaultValues: { name: '' },
});
const handleSave = form.handleSubmit((values) => saveExample(values));
```

Import `z` from `zod`, `useForm` from `react-hook-form`, and `zodResolver` from `@hookform/resolvers/zod`. `saveExample` is the mutation supplied by the feature. Preserve drafts and surface failed submissions; do not infer that every existing modal waits for success before closing (variants exist).

List pages MUST keep applied URL filters, visible controls, API parameters and export parameters consistent. Keep draft filters separate from applied filters; reset pagination on filter changes. Handle deep links before asynchronous labels arrive. Do not add automatic pagination loops to selector queries without a demonstrated requirement.

Evidence: [design guidance](#evidence-044), [class helper](#evidence-088), [AddUserModal](#evidence-097), [search/filter guide](#evidence-048). Verification: valid/invalid submission, failed request, keyboard use, mobile/desktop layout, filter/export parity. See [tooling and tests](#frontend-tooling-and-tests).

<a id="role-booleans"></a>
### Role booleans and active context — FE-012

**Accepted.** Centralize role interpretation in a pure helper under `src/helpers/` and expose derived booleans through `UserProvider` and `useGetUser`. Pages, route guards and navigation consume meaningful `is<Role>`/`can<Action>` flags instead of repeating role strings or membership checks throughout the UI. Derive flags from current user state; do not store a second independently editable set of role booleans.

For projects with organizations or another active access context, resolve the role valid for that context first. A role held in another organization must not grant access in the active one. Missing, ambiguous or malformed membership data yields no role privileges; do not fall back to the first role. For a project without organization scoping, use its server-defined effective-role contract. Multiple simultaneous roles require an explicit combination policy, implemented centrally rather than guessed in each component.

**Observed naming:** the source uses `isAgency` for SA roles, not `isSA`. A destination may choose `isSA`, `isAdmin`, `isEditor`, etc.; define the mapping once and use consistent names. Role-family flags, level-specific flags and derived action flags have different meanings:

| Source flag | Derived from |
| --- | --- |
| `isAGLO` | Active role `AGLO1` or `AGLO2` |
| `isAgency` | Active role `SA1` or `SA2` |
| `isAgencyPrimary` / `isAgencySecondary` | Active role `SA1` / `SA2`, respectively |
| `isSuperAdmin` | Active role in the centralized DSI/ASIN role family |
| `canAccessDashboard` | Centralized combination of eligible role-family flags |

These domain names and role combinations are source examples, not required roles for another product. Role booleans control frontend presentation; they do not replace backend authorization or separate action/lock permissions. After a server-confirmed context change, refresh authoritative user data and recompute the flags; keep permission queries and protected caches scoped to that context.

Observed wiring: `UserProvider` computes `useMemo(() => buildUserRoleState(user), [user])` and spreads that result into its context; `useGetUser` returns the context. The complete [role helper](#example-frontend-src-helpers-userroles-js), [role tests](#example-frontend-src-helpers-userroles-test-js) and [useGetUser module](#example-frontend-src-hooks-usegetuser-js) are embedded below. Existing provider evidence is under [UserProvider](#evidence-066). The educational feature's synthetic identity provider is not the production role resolver. To render the consumer below with that synthetic provider, supply `isConnected`, `isUserReady` and the flags returned by `buildUserRoleState(user)` in its fixture value.

Adapted consumer using the documented hook (React and the local hook implementation are defined in the dependency map/examples):

```jsx
import React from 'react';
import { useGetUser } from 'hooks';

const RoleSummary = () => {
  const { isConnected, isUserReady, isAGLO, isAgency } = useGetUser();
  if (!isConnected || !isUserReady) return null;
  if (isAGLO) return <p>AGLO workspace</p>;
  if (isAgency) return <p>Agency workspace</p>;
  return null;
};
export default RoleSummary;
```

**Verification:** test role families and levels, unknown roles, missing user data, malformed/duplicate memberships and context switching. For example, a user with `SA1` in organization A and `MAEC2` in organization B must have `isAgency === false` when B is active. Switching back to A must recompute the flags and affected visibility without displaying B's cached data. Test route/page behavior as well as the helper; frontend tests alone do not prove server enforcement.

<a id="frontend-api-and-query"></a>

## API access and TanStack Query

Authority: [FE-001](#frontend-readme). This describes the inspected React Query v4 usage; do not silently substitute APIs from another major version.

### Transport and provider ownership — FE-006

**Accepted.** Keep HTTP mechanics in `helpers/RestClient/`, provide feature access through `context/RestClientProvider.jsx`, and consume it through `hooks/useAPI.js`. Use TanStack Query for asynchronous server state. Pages own feature parameters and behavior; they MUST NOT duplicate base URL, credential injection or common error handling. Specialized transfers/integrations require an explicit contract rather than a second generic client.

Observed wiring:

```text
index.jsx -> RouterProvider -> persistent App/Root.jsx
  QueryClientProvider
    RestClientProvider
      UserProvider
        PermissionsProvider
          PreferencesProvider
            UI support providers -> App -> route Outlet -> pages
```

`RestClientProvider` reads the namespaced stored token and creates `RestClient(Params.API_BASE_URL, token, onLogout)`. `useAPI` returns the context object `{ api }`. The provider creates a new client on render; its `useMemo` does not establish a stable singleton. `UserProvider` separately memoizes a RestClient by token for session bootstrap. Do not claim every request uses one shared instance.

Exact hook excerpt:

```js
import { useContext } from 'react';
import { RestClientContext } from '../context/RestClientProvider';

function useAPI() {
  return useContext(RestClientContext);
}

export default useAPI;
```

Evidence: [Root](#evidence-057), [provider](#evidence-065), [hook](#evidence-079), [user provider](#evidence-066), [client](#evidence-071).

### RestClient call and response contract — FE-007

**Accepted.** Preserve these method distinctions in consumers. If the transport contract changes, update queries, mutations and tests together.

| Method                                                  | Observed behavior                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `get/delete/head(url, config)`                          | Immediately returns a request promise with an Axios response                               |
| `post/put/patch(url, data, config)`                     | Immediately returns a request promise with an Axios response                               |
| `list(resource, params)`                                | Returns an async query function; default `limit: 60`, overridden by supplied params        |
| `retrieve(resource, id = 'current', params = {})`       | Normally returns an async query function, unwrapping response `data`                       |
| `create(resource, data)`                                | POSTs exactly the supplied resource path; no slash is added                                |
| `update(resource, data, id = 'current')`                | PUTs `${resource}/${id}/`                                                                  |
| `remove(resource, id = 'current')`                      | DELETEs `${resource}/${id}/`                                                               |
| `updateFile(resource, field, files, id, useResourceId)` | Builds FormData from File values and POSTs; optionally constructs `${resource}/${id}/file` |

For `list`, a response whose body has `object === 'list'` becomes an array with extra `object`, `count`, `next` and `previous` properties. Other bodies become `{ data: body }`. Thus grouped/custom responses need different consumption from ordinary arrays. Do not discard pagination metadata by assuming a plain array copy preserves it. Raw writes still require destructuring `{ data }` in callbacks.

Exception: `retrieve` with a falsy ID returns `Promise.resolve({ data: null })` directly, not a function. Callers MUST guard missing IDs and pass an actual function to `queryFn`; do not copy the inaccurate return JSDoc. Query factories also mutate `requestParams`; this field is not an independent cache or concurrent request log.

The client concatenates base URL and relative path; slash conventions matter. `list('example/')`, `retrieve('example', id)`, `create('example/', payload)` and `update('example', payload, id)` follow the observed API construction. Do not assume endpoint existence from these examples.

Errors: with a stored token, a `401` invokes logout then rejects the original error. For other HTTP failures, `includeErrorStatus` returns only `{ status, detail }`; otherwise a truthy API `detail` is rejected directly. Remaining errors retain their original shape. Defined APIError subclasses are not instantiated by `raiseAPIError`. Consumers MUST handle the actual string/object/network variants and MUST NOT log credentials from raw Axios objects.

Evidence: [RestClient](#evidence-071), [error helper](#evidence-070), [client tests](#evidence-072). Verification: URL/method/payload construction, list envelope, missing IDs, error shape and credential-safe session handling.

### Query keys, readiness and freshness — FE-008

**Accepted.** Query keys MUST contain resource identity, effective request parameters and every applicable access/data scope. Protected queries wait until required identity/scope is ready. Mutations MUST refresh or invalidate affected data after success. Never reuse another user's or organization's protected cached data.

Observed domain query scope includes user ID, active organization, active role and effective campaign year. Carry the mechanism into other projects; replace campaign with the destination's relevant scope, if any. Bootstrap queries differ: the current-user key is `['user', 'current']`, with explicit session-change clearing and stale-response protection. Do not claim all bootstrap queries already use a session-scoped key.

Observed global defaults from `App/Root.jsx`:

```js
queries: {
  staleTime: 60 * 60 * 1000,
  cacheTime: 48 * 60 * 60 * 1000,
  enabled: !!token,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
}
```

**Accepted fallback:** retain `staleTime` of one hour, `cacheTime` of 48 hours and the three disabled automatic-refetch flags above when a data type has no documented override. Choose and document overrides by data type (for example, a dashboard may need fresher data than a country list); these examples do not select new durations. This acceptance covers freshness/retention/refetch behavior, not the module-level `enabled` expression. `token` is read at module initialization here. Public queries must override `enabled`; protected queries should explicitly reflect readiness. Disabled automatic refresh makes mutation invalidation and deliberate refresh essential. `keepPreviousData` is used selectively; MUST NOT show stale rows across access scopes. Query key separation is a UI/cache boundary, not server authorization.

Evidence: [Root](#evidence-057), [scope helper](#evidence-077), [scope hook](#evidence-080), [Group flow](#evidence-090), [scope tests](#evidence-081).

### Worked query/mutation example

Adapted pattern for a hypothetical `example` API. This hook is illustrative, not added application code. It uses the existing eHadj scope hook; a destination project implements its approved scope rather than copying campaign business rules.

```jsx
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAPI } from 'hooks';
import { ApiUrls } from 'data';
import useAuthenticatedQueryScope from 'hooks/useAuthenticatedQueryScope';
import usePermissionMutation from 'hooks/usePermissionMutation';

const useExamples = (params) => {
  const { api } = useAPI();
  const queryClient = useQueryClient();
  const { scope, isScopeReady } = useAuthenticatedQueryScope();
  const queryKey = [ApiUrls.example, params, ...scope];
  const examples = useQuery({
    queryKey,
    queryFn: api.list(ApiUrls.example, params),
    enabled: isScopeReady,
  });
  const createExample = usePermissionMutation({
    mutationFn: (payload) => api.create(ApiUrls.example, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [ApiUrls.example] }),
  });
  return { examples, createExample };
};
```

The page renders loading/error/retry/empty states from `examples`, submits through `createExample.mutate(values)`, and disables duplicate submissions using mutation state. This example invalidates all variants of the resource; a larger feature may target narrower keys and related detail/summary queries. Do not invalidate only the current page if other cached variants become incorrect. Detail form: `queryFn: () => api.retrieve('example', id)()` with `enabled: isScopeReady && Boolean(id)`; manual refetch still requires a valid ID.

`usePermissionMutation` wraps `useMutation` and rejects when `isPermissionsReady === false`; it is not a complete role/action checker. Public login/register mutations use `useMutation` directly. Global `MutationCache.onError` shows a fallback toast only when the mutation has no `onError`; local handlers own their presentation. Do not show duplicate generic and field errors.

Verification SHOULD exercise a real QueryClient: successful fetch, scoped key change, failed mutation retaining useful input, successful mutation refreshing rows, and session/scope transitions. A mock of `useQuery` alone cannot prove invalidation or caching behavior.

Evidence: [permission mutation](#evidence-085), [Group tests](#evidence-091), [Root](#evidence-057). Current cache durations and provider lifecycle are tracked in [open decisions](#frontend-open-decisions).

<a id="frontend-authentication"></a>

## Authentication and account lifecycle

Authority: [FE-001](#frontend-readme). This is a source-backed flow reference, not authorization to change authentication behavior. Backend enforcement must be checked against its own implementation.

### Reusable session responsibilities — FE-009

**Accepted.** Separate credential-entry UI, transport credentials, current-user state, route readiness and server authorization. Registration, login, OTP verification, password recovery and logout MUST have explicit success, failure and retry behavior. A token's presence is not proof that the current user or permissions are ready. Preserve valid session recovery after temporary network failure and discard responses belonging to a replaced session.

Clear protected in-memory state on logout or session replacement. Coordinate tabs without publishing identity payloads. Do not put real credentials, OTPs, reset links or user records in examples, logs or fixtures. Product-specific consent, membership and onboarding rules require explicit local decisions.

### Observed eHadj flow

| Stage           | UI and request                                                          | Result / boundary                                                                                     |
| --------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Register        | `pages/Register`, POST `pilgrim_org/` with name/email/phone and CAPTCHA | Success screen requests email activation; does not create a frontend session                          |
| Password setup  | Activation email leads to reset-password UI                             | Shares reset endpoint; backend marks the account verified                                             |
| Login           | POST `auth/user_token/` with email/password                             | Success advances to OTP, not a signed-in session                                                      |
| OTP             | POST `auth/user_token/verify_otp/` with email/OTP                       | Stores returned `auth_key`, performs consent receipt behavior, reloads home                           |
| Resend          | Repeats login POST                                                      | UI uses a 180-second timer; server independently enforces attempt limits                              |
| Restore session | GET `user/current/`                                                     | User remains in memory; protected routes wait for readiness                                           |
| Forgot password | POST `auth/user_token/forgot_password/`                                 | Shows success and navigates to login; server response does not disclose account existence             |
| Reset password  | POST `auth/user_token/reset_password/` with token/password/password2    | Clears recovery state and navigates to login; UI does not install the session returned by this API    |
| Logout          | Shared `onLogout`, DELETE `auth/user_token/{key}/`                      | Local cleanup precedes bounded server revocation; old session completion cannot replace a newer login |

Registration is a domain-specific individual-account organization flow, not a generic `/register` API. Do not copy Benin phone validation, pilgrimage roles or legal-PDF gating into another product without its requirements. Browser CAPTCHA submission alone does not establish server verification; see [open decisions](#frontend-open-decisions).

### Implementing the accepted sign-in flow

Use API resource constants from `ApiUrls.js`. After successful credentials, the server response must distinguish **OTP required** from **session established**; the exact response field names are not defined by this standard. Show the OTP form only for the first outcome, and initialize the approved session for the second. OTP verification success initializes that same session. Do not infer the outcome from a browser-controlled preference.

The [embedded login source](#evidence-093) demonstrates the existing OTP-only flow and error handling. Its consent-receipt download and full-page reload are observed product behavior, not new-project requirements. A complete adaptable auth module requires the destination's session/storage and response contracts; the educational feature bundle does not supply one.

### Session and recovery details

Observed transport is Axios Basic authentication using the token as username and empty password; browser storage is namespaced with `eHadj-`. This is not a JWT access-token decoding flow. Current-user data is kept in memory, and the former persisted `user` value is removed. `isConnected` currently reflects token presence; readiness is separate.

`UserProvider` ignores current-user responses if the token changed while the request was pending. Session restoration distinguishes an inactive-account rejection from a transient failure and offers appropriate logout or retry. `useCrossTabLogout` coordinates storage events and resume/focus checks; organization changes publish an opaque revision and reload to obtain authoritative identity/permissions.

Password reset reads link parameters, stores temporary recovery material in tab-scoped sessionStorage when available, and removes token/email from the visible URL with replacement navigation. Its local recovery window is 30 minutes; that does not extend the server token expiry. An invalid/used link clears recovery state; transient errors permit retry. The observed API differs; AUTH-001 now selects the exact frontend checks as the shared policy, with API alignment still required.

Logout clears local credentials and protected state immediately, retains only approved valid preference flags, and attempts revocation with a five-second timeout. Concurrent calls for the same session share the operation. Server failure does not prevent local logout. A newer token is preserved. These lifecycle properties are reusable; exact endpoints, retention flags and timeout values are part of the eHadj profile.

**Accepted target:** [AUTH-001](#adoption-questions) settles the login flow, user-controlled email OTP, frontend password checks and return-to-login reset behavior. Storage/transport, legal gating and setting-change confirmation remain destination decisions. Observed application behavior is not changed by this document.

### Evidence and verification

Sources: [Login](#evidence-093), [Register](#evidence-094), [ForgotPassword](#evidence-089), [ResetPassword](#evidence-095), [reset session helper](#evidence-075), [UserProvider](#evidence-066), [logout helper](#evidence-078), [cross-tab hook](#evidence-082), [auth documentation](#evidence-047).

Tests to preserve/adapt: [recovery UI](#evidence-092), [reset helper](#evidence-076), [logout helper](#evidence-074), [logout UI](#evidence-058), [UserProvider](#evidence-067), [cross-tab](#evidence-083).

Acceptance scenarios MUST include registration rejection/success, login failure, OTP failure/expiry/resend, reset invalid/expired/used link, retry after network failure, current-user failure, inactive account, logout failure/timeout, tab synchronization and a late response after a new login. Test existence is evidence of intended coverage, not proof those tests passed during extraction.

<a id="frontend-tooling-and-tests"></a>

## Tooling, dependencies and test conventions

Authority: [FE-001](#frontend-readme). Versions are source-manifest observations, not upgrade recommendations.

### Toolchain — FE-010

**Accepted.** Retain npm, Vite, Prettier, ESLint, Stylelint and Husky as the frontend workflow. Keep configuration in version control and expose repeatable package scripts. Use the repository's supported runtime and lockfile; do not infer compatibility from package names alone.

Observed baseline: React 18, Vite 8, Node `^22.12.0 || ^24.0.0`, TanStack Router `1.170.44`, React Query `^4.26.1`, Axios `^1.20.0`, Tailwind `^3.4.18`, shadcn tooling `^3.5.0`, Jest `29.7.0`. `@tailwindcss/postcss` v4 is also declared, but the inspected PostCSS config loads `tailwindcss` directly. This is not evidence that the project runs a Tailwind v4 pipeline.

| Responsibility                | Established dependencies/configuration                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| UI primitives                 | Radix packages, local shadcn components, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` |
| Forms                         | `react-hook-form`, `zod`, `@hookform/resolvers`                                                               |
| Server state/transport        | `@tanstack/react-query`, `axios`                                                                              |
| Navigation                    | `@tanstack/react-router`                                                                                      |
| Feedback and document head    | `sonner`, `react-helmet-async`                                                                                |
| Localization/dates            | `react-localization`, `date-fns`                                                                              |
| Optional feature capabilities | Recharts/ECharts, Framer Motion, jsPDF/autotable, react-day-picker, input-otp, next-themes                    |
| Product/integration-specific  | Sentry, reCAPTCHA, payment scripts, CryptoJS signing, `@trellixio/roaster-coffee`                             |
| Verification                  | Jest/jsdom/Babel transforms, Playwright Core, Express synthetic browser server, configuration scripts         |

The full manifest also declares packages whose necessity was not traced individually (for example JWT encode/decode helpers). Presence is not a mandate to install every dependency in a new project. Core choices above preserve the stack; optional libraries need a feature justification. Licensing, availability and clean installation of the Trellix package were not verified.

### Configuration examples

Selected exact Prettier settings (excerpt, not the complete file):

```json
{
  "printWidth": 120,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5",
  "arrowParens": "always"
}
```

The full config uses four-space CSS indentation, two-space JS/JSX/JSON, and `endOfLine: auto`. ESLint extends React recommended, Prettier recommended and JSDoc recommended-error. Airbnb is installed but not in the inspected `extends`; do not call this an enforced Airbnb configuration. CSS modules and the deprecated component barrel are restricted. Some overlapping overrides need effective-config verification before claiming enforcement of relative-import restrictions.

Exact Husky pre-commit hook:

```sh
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run lint
```

`postinstall` runs `husky install`. This hook runs the whole lint command, not lint-staged, build or tests. It MUST NOT be reported as verifying behavior.

Selected package scripts:

```json
{
  "start": "vite",
  "build": "vite build",
  "test": "jest",
  "lint:prettier": "prettier --check .",
  "lint:stylelint": "stylelint src",
  "lint:js": "eslint 'src/**/*.{js,ts,jsx}'",
  "lint": "npm run lint:prettier && npm run lint:js && npm run lint:stylelint",
  "verify": "npm run lint && npm run build",
  "postinstall": "husky install"
}
```

Vite uses explicit source-root aliases, loopback dev port 3000, preview port 4173, output `build/`, Browserslist-derived targets and disabled production sourcemaps. Client environment loading is explicitly allowlisted through `scripts/client-env.cjs`, with automatic env loading disabled in Vite. Only browser-public values belong in the bundle. Preserve the mechanism; deployment domains, branding and third-party IDs are project configuration. Do not copy `.env` values.

Sources: [package](#evidence-051), [Prettier](#evidence-041), [ESLint](#evidence-039), [Stylelint](#evidence-042), [Husky](#evidence-040), [Vite](#evidence-099), [PostCSS](#evidence-052), [shadcn config](#evidence-045), [client env](#evidence-054).

### Test structure and logic — FE-011

**Accepted.** Keep behavior tests beside the feature/helper using `*.test.js` or `*.test.jsx`; Jest also discovers spec files and `__tests__`. Use focused pure-helper tests where useful and real component/provider interactions for stateful flows. Mock external boundaries, not every internal function. MUST use synthetic data and isolated state. Do not introduce a test framework migration simply to add a feature.

Current component tests use React `act`, `createRoot` and DOM assertions. React Testing Library is not declared as the established harness. Tests with query behavior create a fresh QueryClient with retries disabled, mock `useAPI` to supply the query-function factory contract, then unmount and clear cache. Some current tests use short timer waits; their presence does not establish a mandatory sleep strategy. Prefer awaiting observable completion or controlled promises in new tests.

Adapted test harness excerpt; `Example` and the mocked API are supplied by the feature test:

```jsx
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let container;
let root;
let client;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

// API mock shape: list returns the function Query will execute.
const list = jest.fn(() => async () => [{ id: 'synthetic-1', name: 'Example' }]);
```

When mounting, wrap the page in `QueryClientProvider client={client}` plus only the contexts it depends on. Assert visible result, request parameters and state transitions. A meaningful mutation test submits, resolves the write, observes a refetch and asserts the updated row; merely asserting `invalidateQueries` was called does not prove the screen refreshes. Test error and empty states, permissions, scope changes and stale responses when relevant.

Jest config uses jsdom, `src/setupTests.js`, source-root module resolution, JS/CSS/file transforms and `resetMocks: true`. Source and asset handling differ from the production Vite build; both need checks when configuration changes.

Browser checks use Playwright Core against a synthetic local application/API setup. Read the existing script and [development guide](#evidence-046) before running; it is not an unrestricted production smoke test. Existing scripts contain eHadj scenarios and must be adapted for another project.

| Work                            | Required verification                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkout preparation            | Use supported Node; `npm ci` with the committed lockfile, then `npm run preflight`; `npm install` when intentionally updating dependency resolution |
| Meaningful frontend change      | `npm run verify` plus relevant Jest behavior tests                                                                                                  |
| Jest suite                      | `npm test -- --runInBand`                                                                                                                           |
| Environment/build configuration | `npm run test:config` plus build checks                                                                                                             |
| Affected browser flow           | `npm run test:browser` with isolated synthetic build and browser prerequisites                                                                      |
| Container change                | Relevant `npm run test:container` prerequisites/checks                                                                                              |
| Documentation only              | Diff, factual/source consistency, links and Git status; no application build required                                                               |

`npm run verify` does not run Jest. No universal coverage threshold or exhaustive end-to-end suite is established by this extraction. Report what was executed and what remains unverified.

Evidence: [Jest config](#evidence-049), [setup](#evidence-098), [Group tests](#evidence-091), [browser script](#evidence-053), [validation workflow](#evidence-055).

<a id="frontend-open-decisions"></a>

## Open decisions and evidence limits

Unresolved entries are **not accepted reusable defaults**; resolved rows link to accepted rules and any remaining migration work. Continue applying unambiguous accepted rules while resolving only the affected choice. No application remediation is included in this documentation extraction.

| ID     | Evidence / conflict                                                                                                                              | Disposition and decision needed                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-O01 | `Urls.js` defines frontend navigation; API calls use resource strings                                                                            | Resolved by FE-004: navigation stays in `Urls.js`; API resources MUST use separate `ApiUrls.js`. Existing resource literals are migration work. |
| FE-O02 | `Root.jsx` sets one-hour staleness, 48-hour retention and disabled automatic refetch                                                             | Resolved by FE-008: retain current freshness/retention/refetch defaults as fallback, with documented overrides per data type. |
| FE-O03 | `RestClientProvider` constructs a client per render; `UserProvider` separately memoizes one                                                      | Document both. A single stable instance would be a design change, not an extracted fact.                                                                                                    |
| FE-O04 | RestClient comments claim backend signature enforcement; source backend `AppMain/asgi.py` comments out `app.add_middleware(IntegrityMiddleware)` | Do not promote comments as proof of enforcement. Signing/security policy requires an explicit cross-stack decision; no shared browser signing material is copied into examples.             |
| FE-O05 | Reset UI requires length greater than eight, uppercase, lowercase, a digit and a special character; API permits eight and requires a letter, digit and special-character check | Resolved by AUTH-001: frontend password checks are authoritative for both layers. API alignment remains implementation work. |
| FE-O06 | API reset issues a session; frontend ignores it and returns to login                                                                             | Resolved by AUTH-001: return to login; reset API must not issue a new session. API alignment remains implementation work. |
| FE-O07 | Registration sends CAPTCHA, but inspected registration route/serializer does not show CAPTCHA verification                                       | Server verification was not established by this trace. Do not state that the widget guarantees backend abuse prevention.                                                                    |
| FE-O08 | Manifest mixes Tailwind v3 and a v4 PostCSS package; active config loads `tailwindcss`                                                           | Treat v3 pipeline as inspected configuration; do not copy unused/conflicting dependencies or upgrade implicitly.                                                                            |
| FE-O09 | Manual auth forms coexist with React Hook Form/Zod; modal-close behavior differs                                                                 | Preserve existing flows; use FE-005 for new structured forms. Choosing a universal modal-submit lifecycle requires a decision.                                                              |
| FE-O10 | PropTypes is common but enforcement disabled; overlapping ESLint overrides may affect import restrictions                                        | Do not claim mandatory PropTypes or complete import enforcement. Confirm effective config before strengthening rules.                                                                       |
| FE-O11 | `components.json` includes an example `@acme` registry                                                                                           | Not established as a required/working registry. Do not copy it as an approved dependency source.                                                                                            |
| FE-O12 | Package presence does not prove all libraries are actively required                                                                              | Keep core versus optional classification. Audit imports and package availability before reusing proprietary/integration libraries.                                                          |
| FE-O13 | Existing auth uses localStorage token + Basic transport; consent PDF and domain membership rules are intertwined                                 | AUTH-001 settles email/password plus user-controlled email OTP enabled by default, and simple registration with email verification before first sign-in. Storage/transport and setting-change confirmation remain destination decisions. |

Source pointers: [Urls](#evidence-069), [Root](#evidence-057), [RestClient](#evidence-071), [provider](#evidence-065), [UserProvider](#evidence-066), [ResetPassword](#evidence-095), [Register](#evidence-094), [package](#evidence-051), [ESLint](#evidence-039), [components config](#evidence-045).

Cross-stack evidence was inspected in the sibling API repository at commit `8a33bea1cb22e41b4ed3f313e8a252870b7bd204`: `app/serializers/auth.py`, `app/webapi/auth.py`, `app/webapi/pilgrim_org.py`, `app/serializers/organization/pilgrim_org.py`, `AppMain/asgi.py`. These provenance paths are not required runtime/document dependencies on a sibling checkout.

### Evidence limits

The extraction inspected representative source/configuration/test flows. It did not execute app tests, contact production, verify deployment middleware, establish CAPTCHA enforcement elsewhere, prove concurrent token consumption, audit all third-party implementations, or reproduce every feature. Test files demonstrate intended scenarios, not passing results. No real environment values or confidential operational data were used.

To resolve an entry, record the selected rule, rationale, owner approval, affected contracts and verification in the relevant topic, then mark this entry resolved with that rule ID. An agent MUST NOT treat silence or an example as approval.

### Storage and public configuration: source caveats

`Storage.get/set` insert `-` after the supplied prefix. With `eHadj-`, the actual key is `eHadj--user_token`. `Storage.clear()` clears the entire storage engine, not only that prefix. Do not copy broad clearing as a universal policy. See [storage evidence](#evidence-073).

The client allowlist includes the name `VITE_JWT_SECRET`; allowlisted values can enter the public browser bundle. That name does not make a value confidential. No value is included here; server secrets must not be placed in public client configuration. See [configuration evidence](#evidence-054).

<a id="adoption-questions"></a>
## Accepted adoption decisions

**Accepted by the owner, 2026-11-18 — AUTH-001.** These requirements govern new and substantially modified authentication code. They describe the target contract; the observed source excerpts below are unchanged and may differ. Application implementation is separate from this documentation update.

- **Sign-in:** validate email and password first. If the account has OTP enabled, send the OTP by email only after credentials succeed, and issue a session only after OTP verification succeeds. If OTP is disabled, successful credentials complete sign-in. Users can enable or disable OTP in their own settings; the server owns and enforces this preference, rather than trusting a login-request flag. OTP MUST be enabled by default for new accounts. The confirmation needed to change this setting remains a destination implementation decision.
- **Registration:** keep generic account registration simple. Do not carry over Hajj membership, consent PDF, organization, passport or pilgrimage fields as universal requirements. The registration form collects email, password and password confirmation. Users MUST verify their email before their first sign-in; the server MUST prevent an unverified account from establishing a login session, even if OTP is disabled. Registration email verification and the subsequent login OTP are separate steps. After email verification, users follow the normal sign-in flow.
- **Password reset:** return to login after success. The reset API MUST NOT issue or return a new login session. The user then follows the normal sign-in flow, including OTP when enabled. Existing reset-token validation/consumption and retry behavior remain relevant. This decision does not select a new policy for revoking already active sessions.
- **Passwords:** use the current frontend checks in both UI and API for account creation, password setup/change and reset: JavaScript length greater than eight, at least one ASCII uppercase letter, one ASCII lowercase letter, one ASCII digit, and one character from the exact special-character set below. Confirmation must match. Login validates credentials, not new-password complexity, so existing accounts are not locked out merely by adopting this rule.

Exact frontend source (`src/pages/ResetPassword/index.jsx`, lines 92–98):

```js
  const validatePassword = (password) => {
    setPwdRuleSize(password.length > 8);
    setPwdRuleUppercase(/[A-Z]/.test(password));
    setPwdRuleLowercase(/[a-z]/.test(password));
    setPwdRuleNumber(/\d/.test(password));
    setPwdRuleSpecial(/[`!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/.test(password));
  };
```

This is a source fragment: the `setPwdRule*` names are React state setters, not imports. `isValidPwd` combines all five booleans; submission additionally requires matching confirmation and a valid reset token. JavaScript length counts UTF-16 code units; a Python validator must preserve this behavior or obtain approval for a different Unicode-length policy. Use ASCII `[0-9]` on Python rather than its broader Unicode `\d` semantics. No extra maximum length or whitespace restriction is established by these checks.

Synthetic shared test cases: `Example9!` passes; `Examp9!` fails length; `example9!` fails uppercase; `EXAMPLE9!` fails lowercase; `Example!!` fails digit; `Example99` fails special character. A different confirmation fails even when the password itself passes. These strings are test examples, not real credentials.

**Required verification:** new accounts have OTP enabled; unverified accounts cannot establish a session, including when OTP is disabled; after email verification, the default login still requires password success followed by email OTP success; invalid credentials do not send an OTP or issue a session; OTP-enabled login cannot issue a session before successful verification; OTP-disabled login can finish after successful credentials; changing one account's setting cannot change another's; reset success issues no session and returns to login; UI/API accept and reject the same password test cases. Verify the destination's selected confirmation flow when implementing changes to the OTP setting; these requirements do not claim that setting already exists in the source application.


<a id="examples"></a>
## Complete examples and dependency map

Files labelled **copied** retain source code; **adapted** files are educational implementations. All local imports in these complete modules resolve to definitions below. Third-party imports resolve to the packages named here and in the embedded manifests. Source evidence is separate and may contain partial bodies.

The example covers routing, providers, a scoped query, form validation, mutation and cache invalidation. Identity and the tested API client are synthetic; this is not a production authentication implementation or a full-stack starter. The two frontend behavior tests were run successfully before this documentation split; source application flows were not executed.

JavaScript packages: `react` (React/context/hooks/forwardRef/act), `react-dom` (client renderer and test utilities), `@tanstack/react-query` (QueryClient/provider/hooks), `@tanstack/react-router` (routing/Link/Outlet), `axios`, `react-hook-form`, `zod`, `@hookform/resolvers` (zodResolver), `prop-types`, `@radix-ui/react-slot`, `@radix-ui/react-label`, `class-variance-authority`, `clsx`, `tailwind-merge`. Build/test packages: `vite`, `@vitejs/plugin-react`, `jest`, `jest-environment-jsdom`, `babel-jest`, `@babel/preset-env`, `@babel/preset-react`. The full original npm manifest, including observed versions and other capabilities, is embedded in the evidence catalog. Jest globals such as `test`, `expect` and `jest` are supplied by the test runner, not missing imports. Node `node:*` modules are runtime built-ins.

The `saveExample` callback in earlier fragments is illustrative, not an import. The complete page below supplies a real mutation. Authentication integration requires the destination's approved session implementation.

- [frontend/babel.config.cjs](#example-frontend-babel-config-cjs)
- [frontend/index.html](#example-frontend-index-html)
- [frontend/jest.config.cjs](#example-frontend-jest-config-cjs)
- [frontend/src/App/Root.jsx](#example-frontend-src-app-root-jsx)
- [frontend/src/App/router.jsx](#example-frontend-src-app-router-jsx)
- [frontend/src/components/ui/button.jsx](#example-frontend-src-components-ui-button-jsx)
- [frontend/src/components/ui/input.jsx](#example-frontend-src-components-ui-input-jsx)
- [frontend/src/components/ui/label.jsx](#example-frontend-src-components-ui-label-jsx)
- [frontend/src/context/PermissionsContext.js](#example-frontend-src-context-permissionscontext-js)
- [frontend/src/context/PreferencesProvider.jsx](#example-frontend-src-context-preferencesprovider-jsx)
- [frontend/src/context/RestClientProvider.jsx](#example-frontend-src-context-restclientprovider-jsx)
- [frontend/src/context/UserProvider.jsx](#example-frontend-src-context-userprovider-jsx)
- [frontend/src/data/ApiUrls.js](#example-frontend-src-data-apiurls-js)
- [frontend/src/data/Urls.js](#example-frontend-src-data-urls-js)
- [frontend/src/data/index.js](#example-frontend-src-data-index-js)
- [frontend/src/helpers/RestClient/index.js](#example-frontend-src-helpers-restclient-index-js)
- [frontend/src/helpers/userRoles.js](#example-frontend-src-helpers-userroles-js)
- [frontend/src/helpers/userRoles.test.js](#example-frontend-src-helpers-userroles-test-js)
- [frontend/src/helpers/queryScope.js](#example-frontend-src-helpers-queryscope-js)
- [frontend/src/hooks/index.js](#example-frontend-src-hooks-index-js)
- [frontend/src/hooks/useAPI.js](#example-frontend-src-hooks-useapi-js)
- [frontend/src/hooks/useAuthenticatedQueryScope.js](#example-frontend-src-hooks-useauthenticatedqueryscope-js)
- [frontend/src/hooks/useGetUser.js](#example-frontend-src-hooks-usegetuser-js)
- [frontend/src/hooks/usePermissionMutation.js](#example-frontend-src-hooks-usepermissionmutation-js)
- [frontend/src/index.jsx](#example-frontend-src-index-jsx)
- [frontend/src/lib/utils.js](#example-frontend-src-lib-utils-js)
- [frontend/src/pages/Example/index.jsx](#example-frontend-src-pages-example-index-jsx)
- [frontend/src/pages/Example/index.test.jsx](#example-frontend-src-pages-example-index-test-jsx)
- [frontend/src/pages/index.js](#example-frontend-src-pages-index-js)
- [frontend/vite.config.mjs](#example-frontend-vite-config-mjs)


<a id="example-frontend-babel-config-cjs"></a>

#### `frontend/babel.config.cjs`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```js
module.exports = { presets: [['@babel/preset-env', { targets: { node: 'current' } }], ['@babel/preset-react', { runtime: 'automatic' }]] };
```


</details>


<a id="example-frontend-index-html"></a>

#### `frontend/index.html`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```html
<!doctype html>
<html lang="en"><head><title>Engineering example</title></head><body><div id="root"></div><script type="module" src="/src/index.jsx"></script></body></html>
```


</details>


<a id="example-frontend-jest-config-cjs"></a>

#### `frontend/jest.config.cjs`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```js
module.exports = { testEnvironment: 'jsdom', modulePaths: ['<rootDir>/src'], transform: { '^.+\\.[jt]sx?$': 'babel-jest' }, resetMocks: true };
```


</details>


<a id="example-frontend-src-app-root-jsx"></a>

#### `frontend/src/App/Root.jsx`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```jsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RestClientProvider from 'context/RestClientProvider';
import UserProvider from 'context/UserProvider';
import PreferencesProvider from 'context/PreferencesProvider';
import { PermissionsContext } from 'context/PermissionsContext';
import { ExampleOutlet } from 'App/router';

const queryClient = new QueryClient({ defaultOptions: { queries: {
  staleTime: 60 * 60 * 1000,
  cacheTime: 48 * 60 * 60 * 1000,
  refetchOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} } });
// Synthetic identity/context solely for demonstrating scope and provider composition.
const identity = { user: { id: 'synthetic-user' }, activeOrganizationId: 'synthetic-org',
  activeRole: 'READER', isAGLO: false };
const preferences = { campaignYear: 2026 };
const permissions = { isPermissionsReady: true };
const AppRoot = () => (
  <QueryClientProvider client={queryClient}>
    <RestClientProvider baseUrl="/api/v1/">
      <UserProvider value={identity}>
        <PreferencesProvider value={preferences}>
          <PermissionsContext.Provider value={permissions}>
            <ExampleOutlet />
          </PermissionsContext.Provider>
        </PreferencesProvider>
      </UserProvider>
    </RestClientProvider>
  </QueryClientProvider>
);
export default AppRoot;
```


</details>


<a id="example-frontend-src-app-router-jsx"></a>

#### `frontend/src/App/router.jsx`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```jsx
import React from 'react';
import { Link, Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Urls } from 'data';
import { Example } from 'pages';

export const createAppRouter = ({ RootComponent, history }) => {
  const rootRoute = createRootRoute({ component: RootComponent });
  const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: Urls.base,
    component: () => <Link to={Urls.example}>Examples</Link> });
  const exampleRoute = createRoute({ getParentRoute: () => rootRoute, path: Urls.example, component: Example });
  return createRouter({ history, routeTree: rootRoute.addChildren([homeRoute, exampleRoute]) });
};
export const ExampleOutlet = () => <Outlet />;
```


</details>


<a id="example-frontend-src-components-ui-button-jsx"></a>

#### `frontend/src/components/ui/button.jsx`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/components/ui/button.jsx`.

```jsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';

import { cn } from 'lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        hajj: 'bg-hajj-primary hover:bg-hajj-secondary text-white rounded-md shadow-lg shadow-hajj-primary/20 hover:shadow-xl hover:shadow-hajj-primary/30 transition-all duration-200',
        'modal-primary':
          'border border-[#287c50] bg-[#287c50] text-white shadow-none hover:border-[#17613d] hover:bg-[#17613d] disabled:border-[#80aa91] disabled:bg-[#80aa91] disabled:text-white disabled:opacity-100',
        'modal-secondary': 'border border-[#d7dfda] bg-white text-[#33463b] shadow-none hover:bg-[#f4f7f5]',
        disabled: 'bg-gray-300 text-gray-600 cursor-not-allowed',
      },
      size: {
        default: 'h-9 px-2.5 py-2',
        sm: 'h-8 rounded-md px-2.5',
        lg: 'h-10 rounded-md px-2.5',
        icon: 'h-9 w-9',
        modal: 'min-h-9 rounded-[8px] px-[14px] py-[7px] text-sm leading-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
```


</details>


<a id="example-frontend-src-components-ui-input-jsx"></a>

#### `frontend/src/components/ui/input.jsx`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/components/ui/input.jsx`.

```jsx
import React, { forwardRef } from 'react';
import { cva } from 'class-variance-authority';

import { cn } from 'lib/utils';

const inputVariants = cva(
  'flex w-full rounded-md px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm placeholder:text-gray-500',
  {
    variants: {
      variant: {
        default: 'border border-input bg-background',
        hajj: 'bg-white/80 backdrop-blur-sm border focus:border-hajj-primary focus:ring-4 focus:ring-hajj-primary/10 transition-all duration-200 rounded-sm-xl',
        subtle: 'border-transparent bg-muted/10',
        disabled: 'bg-muted/50 text-muted-foreground cursor-not-allowed border-2',
      },
      size: {
        default: 'h-10',
        lg: 'h-14 text-lg',
        sm: 'h-10 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Input = forwardRef(({ className, variant, size, type = 'text', ...props }, ref) => {
  return <input type={type} className={cn(inputVariants({ variant, size }), className)} ref={ref} {...props} />;
});
Input.displayName = 'Input';

export { Input, inputVariants };
```


</details>


<a id="example-frontend-src-components-ui-label-jsx"></a>

#### `frontend/src/components/ui/label.jsx`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/components/ui/label.jsx`.

```jsx
import React, { forwardRef } from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cva } from 'class-variance-authority';

import { cn } from 'lib/utils';

const labelVariants = cva('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70');

const Label = forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
```


</details>


<a id="example-frontend-src-context-permissionscontext-js"></a>

#### `frontend/src/context/PermissionsContext.js`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/context/PermissionsContext.js`.

```js
import { createContext } from 'react';

export const PermissionsContext = createContext({});
```


</details>


<a id="example-frontend-src-context-preferencesprovider-jsx"></a>

#### `frontend/src/context/PreferencesProvider.jsx`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```jsx
import React, { createContext } from 'react';

export const PreferencesContext = createContext({});
// Demonstration fixture provider; the backend remains the source of real settings.
const PreferencesProvider = ({ children, value }) => (
  <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
);
export default PreferencesProvider;
```


</details>


<a id="example-frontend-src-context-restclientprovider-jsx"></a>

#### `frontend/src/context/RestClientProvider.jsx`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```jsx
import React, { createContext, useMemo } from 'react';
import RestClient from 'helpers/RestClient';

export const RestClientContext = createContext({});
const noLogout = () => {};

// Injected configuration keeps the example independent of storage/auth policy.
const RestClientProvider = ({ children, baseUrl, token = '', onLogout = noLogout, client }) => {
  const api = useMemo(() => client || new RestClient(baseUrl, token, onLogout),
    [client, baseUrl, token, onLogout]);
  const value = useMemo(() => ({ api }), [api]);
  return <RestClientContext.Provider value={value}>{children}</RestClientContext.Provider>;
};
export default RestClientProvider;
```


</details>


<a id="example-frontend-src-context-userprovider-jsx"></a>

#### `frontend/src/context/UserProvider.jsx`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```jsx
import React, { createContext } from 'react';

export const UserContext = createContext({});
// Demonstration fixture provider; not the real session-restoration implementation.
const UserProvider = ({ children, value }) => (
  <UserContext.Provider value={value}>{children}</UserContext.Provider>
);
export default UserProvider;
```


</details>


<a id="example-frontend-src-data-urls-js"></a>

#### `frontend/src/data/Urls.js`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```js
const Urls = { base: '/', example: '/example' };
export default Urls;
```


</details>


<a id="example-frontend-src-data-apiurls-js"></a>

#### `frontend/src/data/ApiUrls.js`

Adapted example implementing the accepted separate API catalog.

```js
const ApiUrls = { example: 'example/' };
export default ApiUrls;
```

<a id="example-frontend-src-data-index-js"></a>

#### `frontend/src/data/index.js`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```js
export { default as Urls } from './Urls';
export { default as ApiUrls } from './ApiUrls';
```


</details>


<a id="example-frontend-src-helpers-restclient-index-js"></a>

#### `frontend/src/helpers/RestClient/index.js`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code. This reduced client omits signing, includeErrorStatus, file uploads and requestParams; use embedded source evidence for the original behavior.

```js
import axios from 'axios';

// Adapted transport example: signing policy is intentionally not selected here.
export default class RestClient {
  constructor(baseUrl, token = '', onLogout = () => {}) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.onLogout = onLogout;
  }

  async request(config) {
    try {
      return await axios.request({
        ...config,
        url: `${this.baseUrl}${config.url}`,
        ...(this.token ? { auth: { username: this.token, password: '' } } : {}),
      });
    } catch (error) {
      if (error.response?.status === 401 && this.token) {
        this.onLogout({ requestToken: this.token });
      } else if (error.response?.data?.detail) {
        return Promise.reject(error.response.data.detail);
      }
      return Promise.reject(error);
    }
  }

  get(url, config = {}) { return this.request({ ...config, url, method: 'get' }); }
  post(url, data) { return this.request({ url, data, method: 'post' }); }
  create(resource, data) { return this.post(resource, data); }
  update(resource, data, id = 'current') {
    return this.request({ url: `${resource}/${id}/`, data, method: 'put' });
  }
  remove(resource, id = 'current') {
    return this.request({ url: `${resource}/${id}/`, method: 'delete' });
  }
  retrieve(resource, id = 'current', params = {}) {
    if (!id) return Promise.resolve({ data: null });
    return async () => (await this.get(`${resource}/${id}`, { params })).data;
  }
  list(resource, params = {}) {
    return async () => {
      const { data } = await this.get(resource, { params: { limit: 60, ...params } });
      if (data.object !== 'list') return { data };
      return Object.assign(data.data, {
        object: data.object, count: data.count, next: data.next, previous: data.previous,
      });
    };
  }
}
```


</details>


<a id="example-frontend-src-helpers-queryscope-js"></a>

#### `frontend/src/helpers/queryScope.js`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/helpers/queryScope.js`.

```js
const normalizeScopeValue = (value) => value ?? null;

export const getIdentityQueryScope = ({ userId, organizationId, role }) => [
  {
    userId: normalizeScopeValue(userId),
    organizationId: normalizeScopeValue(organizationId),
    role: normalizeScopeValue(role),
  },
];

export const getAuthenticatedQueryScope = ({ userId, organizationId, role, campaignYear }) => [
  {
    ...getIdentityQueryScope({ userId, organizationId, role })[0],
    campaignYear: normalizeScopeValue(campaignYear),
  },
];
```


</details>


<a id="example-frontend-src-hooks-index-js"></a>

#### `frontend/src/hooks/index.js`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```js
export { default as useAPI } from './useAPI';
export { default as useGetUser } from './useGetUser';
```


</details>


<a id="example-frontend-src-hooks-useapi-js"></a>

#### `frontend/src/hooks/useAPI.js`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/hooks/useAPI.js`.

```js
import { useContext } from 'react';
import { RestClientContext } from '../context/RestClientProvider'; // relative import to avoid circular dependency in context folder

/**
 * Initialize RestClientContext
 *
 * @returns {object} values contain in RestClientContext
 */
function useAPI() {
  return useContext(RestClientContext);
}

export default useAPI;
```


</details>


<a id="example-frontend-src-hooks-useauthenticatedqueryscope-js"></a>

#### `frontend/src/hooks/useAuthenticatedQueryScope.js`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/hooks/useAuthenticatedQueryScope.js`.

```js
import { useContext } from 'react';
import { PreferencesContext } from 'context/PreferencesProvider';
import { getAuthenticatedQueryScope, getIdentityQueryScope } from 'helpers/queryScope';
import { useGetUser } from 'hooks';

export const useIdentityQueryScope = () => {
  const { user, activeOrganizationId, activeRole } = useGetUser();
  return {
    isScopeReady: user?.id != null,
    scope: getIdentityQueryScope({
      userId: user?.id,
      organizationId: activeOrganizationId,
      role: activeRole,
    }),
  };
};

const useAuthenticatedQueryScope = () => {
  const { user, activeOrganizationId, activeRole, isAGLO } = useGetUser();
  const { campaignYear, selectedCampaignYear } = useContext(PreferencesContext);
  const effectiveCampaignYear = isAGLO ? selectedCampaignYear ?? campaignYear : campaignYear;

  return {
    isScopeReady: user?.id != null && effectiveCampaignYear != null,
    scope: getAuthenticatedQueryScope({
      userId: user?.id,
      organizationId: activeOrganizationId,
      role: activeRole,
      campaignYear: effectiveCampaignYear,
    }),
  };
};

export default useAuthenticatedQueryScope;
```


</details>


<a id="example-frontend-src-hooks-usegetuser-js"></a>

#### `frontend/src/hooks/useGetUser.js`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/hooks/useGetUser.js`.

```js
import { useContext } from 'react';
import { UserContext } from '../context/UserProvider';

const useGetUser = () => useContext(UserContext);

export default useGetUser;
```


</details>


<a id="example-frontend-src-hooks-usepermissionmutation-js"></a>

#### `frontend/src/hooks/usePermissionMutation.js`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/hooks/usePermissionMutation.js`.

```js
import { useContext } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PermissionsContext } from 'context/PermissionsContext';

// Also guard keyboard form submission and dialogs opened before a refresh failed.
const usePermissionMutation = ({ mutationFn, ...options }) => {
  const { isPermissionsReady } = useContext(PermissionsContext);
  return useMutation({
    ...options,
    mutationFn: (...args) => {
      if (isPermissionsReady === false) {
        throw new Error('Impossible de vérifier vos autorisations. Veuillez réessayer.');
      }
      return mutationFn(...args);
    },
  });
};
export default usePermissionMutation;
```


</details>


<a id="example-frontend-src-index-jsx"></a>

#### `frontend/src/index.jsx`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { createAppRouter } from 'App/router';
import AppRoot from 'App/Root';

const router = createAppRouter({ RootComponent: AppRoot });
createRoot(document.getElementById('root')).render(<RouterProvider router={router} />);
```


</details>


<a id="example-frontend-src-lib-utils-js"></a>

#### `frontend/src/lib/utils.js`

<details>
<summary>Code and usage notes</summary>


copied verbatim from `proj-ehadj-ui/src/lib/utils.js`.

```js
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const cn = (...inputs) => {
  return twMerge(clsx(inputs));
};

export { cn };
```


</details>


<a id="example-frontend-src-pages-example-index-jsx"></a>

#### `frontend/src/pages/Example/index.jsx`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```jsx
import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAPI } from 'hooks';
import { ApiUrls } from 'data';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import useAuthenticatedQueryScope from 'hooks/useAuthenticatedQueryScope';
import usePermissionMutation from 'hooks/usePermissionMutation';

const ExampleSchema = z.object({ name: z.string().trim().min(1, 'Name is required') });
const params = { limit: 60 };

const Example = () => {
  const { api } = useAPI();
  const client = useQueryClient();
  const { scope, isScopeReady } = useAuthenticatedQueryScope();
  const query = useQuery({
    queryKey: [ApiUrls.example, params, ...scope],
    queryFn: api.list(ApiUrls.example, params),
    enabled: isScopeReady,
  });
  const form = useForm({ resolver: zodResolver(ExampleSchema), defaultValues: { name: '' } });
  const save = usePermissionMutation({
    mutationFn: (values) => api.create(ApiUrls.example, values),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: [ApiUrls.example] });
      form.reset();
    },
  });
  if (!isScopeReady) return <p role="status">Waiting for scope</p>;
  return (
    <main className="space-y-4 p-4">
      <h1>Examples</h1>
      <form onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <Label htmlFor="example-name">Name</Label>
        <Input id="example-name" {...form.register('name')} />
        {form.formState.errors.name && <p role="alert">{form.formState.errors.name.message}</p>}
        <Button type="submit" disabled={save.isLoading}>Save</Button>
        {save.isError && <p role="alert">Save failed; please retry.</p>}
      </form>
      {query.isLoading && <p role="status">Loading</p>}
      {query.isError && <Button onClick={() => query.refetch()}>Retry loading</Button>}
      {query.data?.length === 0 && <p>No examples</p>}
      <ul>{query.data?.map((row) => <li key={row.id}>{row.name}</li>)}</ul>
    </main>
  );
};
export default Example;
```


</details>


<a id="example-frontend-src-pages-example-index-test-jsx"></a>

#### `frontend/src/pages/Example/index.test.jsx`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```jsx
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RestClientProvider from 'context/RestClientProvider';
import UserProvider from 'context/UserProvider';
import PreferencesProvider from 'context/PreferencesProvider';
import { PermissionsContext } from 'context/PermissionsContext';
import Example from './index';

let container;
let root;
let client;
let rows;
let api;

const settle = async (predicate) => {
  for (let step = 0; step < 50 && !predicate(); step += 1) {
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  }
  expect(predicate()).toBe(true);
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  rows = [];
  api = {
    list: jest.fn(() => async () => rows.map((row) => ({ ...row }))),
    create: jest.fn(async (_resource, payload) => {
      const row = { id: 'synthetic-1', name: payload.name };
      rows.push(row);
      return { data: row };
    }),
  };
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

const mount = async () => {
  await act(async () => root.render(
    <QueryClientProvider client={client}>
      <RestClientProvider client={api}>
        <UserProvider value={{ user: { id: 'synthetic-user' }, activeOrganizationId: 'synthetic-org', activeRole: 'READER' }}>
          <PreferencesProvider value={{ campaignYear: 2026 }}>
            <PermissionsContext.Provider value={{ isPermissionsReady: true }}>
              <Example />
            </PermissionsContext.Provider>
          </PreferencesProvider>
        </UserProvider>
      </RestClientProvider>
    </QueryClientProvider>
  ));
  await settle(() => container.textContent.includes('No examples'));
};

const submit = async (name) => {
  await act(async () => {
    const input = container.querySelector('input');
    input.value = name;
    Simulate.change(input, { target: { name: 'name', value: name } });
  });
  await act(async () => {
    container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

test('successful save refreshes the visible list', async () => {
  await mount();
  await submit('Created example');
  await settle(() => container.querySelector('li')?.textContent === 'Created example');
  expect(api.create).toHaveBeenCalledWith('example/', { name: 'Created example' });
  expect(container.querySelector('input').value).toBe('');
});

test('failed save preserves the draft and exposes retry', async () => {
  await mount();
  api.create.mockRejectedValueOnce('Synthetic failure');
  await submit('Retained draft');
  await settle(() => container.textContent.includes('Save failed'));
  expect(container.querySelector('input').value).toBe('Retained draft');
  expect(container.querySelector('li')).toBeNull();
});
```


</details>


<a id="example-frontend-src-pages-index-js"></a>

#### `frontend/src/pages/index.js`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```js
export { default as Example } from './Example';
```


</details>


<a id="example-frontend-vite-config-mjs"></a>

#### `frontend/vite.config.mjs`

<details>
<summary>Code and usage notes</summary>


adapted; not original application code.

```js
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const roots = ['App', 'context', 'data', 'helpers', 'hooks', 'pages', 'components', 'lib'];
export default defineConfig({
  plugins: [react()],
  resolve: { alias: Object.fromEntries(roots.map((name) =>
    [name, fileURLToPath(new URL(`./src/${name}`, import.meta.url))])) },
});
```


</details>


<a id="example-frontend-src-helpers-userroles-js"></a>

#### `frontend/src/helpers/userRoles.js`

<details>
<summary>Complete copied role helper</summary>

Copied verbatim from `proj-ehadj-ui/src/helpers/userRoles.js`. The role codes are source-specific; adapt them to the destination's approved role model.

```js
const SUPER_ADMIN_ROLES = ['DSI1', 'DSI2', 'ASIN1', 'ASIN2'];
const AGLO_ROLES = ['AGLO1', 'AGLO2'];
const AGENCY_ROLES = ['SA1', 'SA2'];
const MS_ROLES = ['MS1', 'MS2'];
const MAEC_ROLES = ['MAEC1', 'MAEC2'];
const DEI_ROLES = ['DEI1', 'DEI2'];
const BANK_ROLES = ['BANK1', 'BANK2'];
const PILGRIM_ROLES = ['PILGRIM1'];
const PRIMARY_ROLES = ['AGLO1', 'SA1', 'MS1', 'MAEC1', 'DEI1', 'BANK1'];

const toArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

// Payload normalization ------------------------------------------------------
//
// The API returns parallel arrays: roles[i] <-> organization_ids[i] <->
// organization_names[i].
export const getNormalizedRoles = (user) => toArray(user?.roles);

export const getNormalizedOrganizationIds = (user) => toArray(user?.organization_ids);

export const getNormalizedOrganizationNames = (user) => toArray(user?.organization_names);

export const hasPairedMemberships = (user) => {
  // Validate the original positions. Filtering empty entries can manufacture
  // a role/organization pairing that the API never supplied.
  const roles = user?.roles;
  const organizationIds = user?.organization_ids;

  return (
    Array.isArray(roles) &&
    Array.isArray(organizationIds) &&
    roles.length > 0 &&
    roles.length === organizationIds.length &&
    roles.every((role) => typeof role === 'string' && role.trim().length > 0) &&
    organizationIds.every((id) => typeof id === 'string' && id.trim().length > 0) &&
    new Set(organizationIds).size === organizationIds.length
  );
};

// Membership resolution ------------------------------------------------------
export const getOrganizationMemberships = (user) => {
  // Keep original indexes intact here. Filtering the parallel arrays before
  // zipping can manufacture a role/organization pairing around an empty slot.
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  const organizationIds = Array.isArray(user?.organization_ids) ? user.organization_ids : [];
  const organizationNames = Array.isArray(user?.organization_names) ? user.organization_names : [];
  const length = Math.max(roles.length, organizationIds.length, organizationNames.length);

  return Array.from({ length }, (_, index) => ({
    index,
    role: typeof roles[index] === 'string' && roles[index].trim() ? roles[index].trim() : null,
    organizationId:
      typeof organizationIds[index] === 'string' && organizationIds[index].trim()
        ? organizationIds[index].trim()
        : null,
    organizationName:
      typeof organizationNames[index] === 'string' && organizationNames[index].trim()
        ? organizationNames[index].trim()
        : null,
  })).filter(({ role, organizationId, organizationName }) => role || organizationId || organizationName);
};

export const resolveActiveOrganizationId = (user) => user?.active_organization_id || null;

export const getActiveOrganizationMembership = (user) => {
  const memberships = getOrganizationMemberships(user);
  const activeOrganizationId = resolveActiveOrganizationId(user);

  if (!activeOrganizationId || !hasPairedMemberships(user)) {
    return null;
  }

  return memberships.find((membership) => membership.organizationId === activeOrganizationId) || null;
};

export const resolveActiveRole = (user) => {
  if (!hasPairedMemberships(user)) {
    return null;
  }

  return getActiveOrganizationMembership(user)?.role || null;
};

export const resolveActiveOrganizationName = (user) => getActiveOrganizationMembership(user)?.organizationName || null;

export const getUserMembershipWriteFields = (user, organizationIds) => ({
  organization_ids: organizationIds ?? getNormalizedOrganizationIds(user),
  membership_version: user?.membership_version ?? 0,
});

// Role booleans --------------------------------------------------------------
//
// Pages and route guards still expect the old boolean names. We keep those
// names here, but compute them from the resolved active role instead of from
// any role that merely exists on the user.
export const getRoleBooleans = (activeRole) => {
  const isSuperAdmin = SUPER_ADMIN_ROLES.includes(activeRole);
  const isAGLO = AGLO_ROLES.includes(activeRole);
  const isAGLOPrimary = activeRole === 'AGLO1';
  const isAGLOSecondary = activeRole === 'AGLO2';
  const isAgency = AGENCY_ROLES.includes(activeRole);
  const isAgencyPrimary = activeRole === 'SA1';
  const isAgencySecondary = activeRole === 'SA2';
  const isMS = MS_ROLES.includes(activeRole);
  const isMSPrimary = activeRole === 'MS1';
  const isMSSecondary = activeRole === 'MS2';
  const isMAEC = MAEC_ROLES.includes(activeRole);
  const isMAECPrimary = activeRole === 'MAEC1';
  const isMAECSecondary = activeRole === 'MAEC2';
  const isDEI = DEI_ROLES.includes(activeRole);
  const isDEIPrimary = activeRole === 'DEI1';
  const isDEISecondary = activeRole === 'DEI2';
  const isBank = BANK_ROLES.includes(activeRole);
  const isBankPrimary = activeRole === 'BANK1';
  const isBankSecondary = activeRole === 'BANK2';
  const isPilgrim = PILGRIM_ROLES.includes(activeRole);
  const isPilgrimPrimary = activeRole === 'PILGRIM1';
  const isPrimaryUser = isSuperAdmin || PRIMARY_ROLES.includes(activeRole);
  const canAccessDashboard = isAGLO || isSuperAdmin || isAgency || isMS || isMAEC || isBank;

  return {
    isSuperAdmin,
    isAGLO,
    isAGLOPrimary,
    isAGLOSecondary,
    isAgency,
    isAgencyPrimary,
    isAgencySecondary,
    isMS,
    isMSPrimary,
    isMSSecondary,
    isMAEC,
    isMAECPrimary,
    isMAECSecondary,
    isDEI,
    isDEIPrimary,
    isDEISecondary,
    isBank,
    isBankPrimary,
    isBankSecondary,
    isPilgrim,
    isPilgrimPrimary,
    isPrimaryUser,
    canAccessDashboard,
  };
};

export const getMembershipRolePresentation = (role) => {
  if (role === 'DSI1' || role === 'DSI2') return { typeKey: 'dsi' };
  if (role === 'ASIN1' || role === 'ASIN2') return { typeKey: 'asin' };
  if (AGLO_ROLES.includes(role)) return { typeKey: 'aglo' };
  if (role === 'SA1') return { typeKey: 'agency', levelKey: 'primary' };
  if (role === 'SA2') return { typeKey: 'agency', levelKey: 'secondary' };
  if (MS_ROLES.includes(role)) return { typeKey: 'health' };
  if (MAEC_ROLES.includes(role)) return { typeKey: 'passports' };
  if (DEI_ROLES.includes(role)) return { typeKey: 'dei' };
  if (role === 'BANK1') return { typeKey: 'bank' };
  if (role === 'BANK2') return { typeKey: 'bank', levelKey: 'secondary' };
  if (PILGRIM_ROLES.includes(role)) return { typeKey: 'pilgrim' };
  return null;
};

// Provider payload -----------------------------------------------------------
export const buildUserRoleState = (user) => {
  const roles = getNormalizedRoles(user);
  const organizationIds = getNormalizedOrganizationIds(user);
  const organizationNames = getNormalizedOrganizationNames(user);
  const memberships = getOrganizationMemberships(user);
  const activeOrganizationId = resolveActiveOrganizationId(user);
  const activeOrganizationName = resolveActiveOrganizationName(user);
  const activeRole = resolveActiveRole(user);

  return {
    roles,
    organizationIds,
    organizationNames,
    memberships,
    activeOrganizationId,
    activeOrganizationName,
    activeRole,
    hasMultipleOrganizations: organizationIds.length > 1,
    ...getRoleBooleans(activeRole),
  };
};
```

</details>

<a id="example-frontend-src-helpers-userroles-test-js"></a>

#### `frontend/src/helpers/userRoles.test.js`

<details>
<summary>Complete copied role tests</summary>

Copied verbatim from `proj-ehadj-ui/src/helpers/userRoles.test.js`. The role codes are source-specific; adapt them to the destination's approved role model.

```js
import { buildUserRoleState, getUserMembershipWriteFields, resolveActiveRole } from './userRoles';

const multiOrgUser = {
  roles: ['SA1', 'MAEC2'],
  organization_ids: ['organization-sa', 'organization-maec'],
  organization_names: ['Agence', 'MAEC'],
  active_organization_id: 'organization-maec',
  membership_version: 3,
};

describe('resolveActiveRole', () => {
  test('binds the active role to the active organization', () => {
    expect(resolveActiveRole(multiOrgUser)).toBe('MAEC2');
  });

  test('does not fall back to the first role when pairing is incomplete', () => {
    expect(
      resolveActiveRole({
        roles: ['SA1', 'MAEC2'],
        organization_ids: ['organization-sa'],
        active_organization_id: 'organization-sa',
      })
    ).toBeNull();
  });

  test('does not invent an active role without an active organization', () => {
    expect(
      resolveActiveRole({
        roles: ['SA1'],
        organization_ids: ['organization-sa'],
      })
    ).toBeNull();
  });
});

describe('malformed memberships', () => {
  test.each([
    ['duplicate active organization', ['AGLO1', 'SA1'], ['org-a', 'org-a']],
    ['duplicate inactive organization', ['AGLO1', 'SA1', 'SA2'], ['org-a', 'org-b', 'org-b']],
    ['missing role before active membership', [null, 'AGLO1'], ['org-a']],
    ['missing organization before active membership', ['AGLO1'], [null, 'org-a']],
    ['empty paired entries', [null, 'AGLO1'], [null, 'org-a']],
  ])('does not derive privileges from %s', (_, roles, organizationIds) => {
    const state = buildUserRoleState({
      roles,
      organization_ids: organizationIds,
      active_organization_id: 'org-a',
    });
    expect(state.activeRole).toBeNull();
    expect(state.activeOrganizationName).toBeNull();
    expect([
      state.isSuperAdmin,
      state.isAGLO,
      state.isAgency,
      state.isMS,
      state.isMAEC,
      state.isBank,
      state.isPilgrim,
      state.isDEI,
      state.isPrimaryUser,
      state.canAccessDashboard,
    ]).not.toContain(true);
  });
});

describe('buildUserRoleState', () => {
  test('exposes family flags from the active membership only', () => {
    const state = buildUserRoleState(multiOrgUser);

    expect(state.isAgency).toBe(false);
    expect(state.isMAEC).toBe(true);
    expect(state.isMAECSecondary).toBe(true);
    expect(state.isPrimaryUser).toBe(false);
    expect(state.canAccessDashboard).toBe(true);
  });

  test('treats DSI1 and DSI2 as super admins', () => {
    const primary = buildUserRoleState({
      roles: ['DSI1'],
      organization_ids: ['organization-dsi'],
      organization_names: ['DSI'],
      active_organization_id: 'organization-dsi',
    });
    const secondary = buildUserRoleState({
      roles: ['DSI2'],
      organization_ids: ['organization-dsi'],
      organization_names: ['DSI'],
      active_organization_id: 'organization-dsi',
    });

    expect(primary.isSuperAdmin).toBe(true);
    expect(primary.isPrimaryUser).toBe(true);
    expect(secondary.isSuperAdmin).toBe(true);
    expect(secondary.isPrimaryUser).toBe(true);
  });

  test('does not treat PILGRIM2 as a pilgrim role', () => {
    const state = buildUserRoleState({
      roles: ['PILGRIM2'],
      organization_ids: ['organization-pilgrim'],
      active_organization_id: 'organization-pilgrim',
    });

    expect(state.isPilgrim).toBe(false);
    expect(state.canAccessDashboard).toBe(false);
  });
});

describe('getUserMembershipWriteFields', () => {
  test('sends membership_version 0 when the field is missing', () => {
    expect(getUserMembershipWriteFields({ organization_ids: ['organization-1'] })).toEqual({
      organization_ids: ['organization-1'],
      membership_version: 0,
    });
  });

  test('preserves an explicit organization list for profile-only updates', () => {
    expect(getUserMembershipWriteFields(multiOrgUser)).toEqual({
      organization_ids: ['organization-sa', 'organization-maec'],
      membership_version: 3,
    });
  });
});
```

</details>

<a id="evidence"></a>
## Embedded source evidence

Inspected source snapshot: 2026-11-18. Paths and original line spans identify provenance; they are not dependencies on the original checkout. Expand an entry to read actual source. Partial excerpts are labelled `text` and are not standalone programs. Configuration snapshots record observed versions, not an instruction to retain unused packages or freeze versions. Contradictory comments and observed defects are not endorsed rules.

<a id="evidence-004"></a>

### evidence-004: `proj-ehadj-api/AppMain/asgi.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 56–91:

````text
async def lifespan(current_app: FastAPI) -> typing.AsyncGenerator[None, None]:
    """Initialize beanie for main and audit databases on startup."""
    assert current_app

    # Init main DB
    await initialize_beanie()
    # Init audit DB
    client = motor.motor_asyncio.AsyncIOMotorClient(audit_settings.get_mongodb_url())
    await init_beanie(database=client[audit_settings.get_mongodb_db_name()], document_models=[AuditEvent])

    # Start background tasks
    # quota_task = asyncio.create_task(run_periodic_quota_check(interval_second=20))
    #
    # The periodic workers poll the database and acquire shared locks. They must
    # not run inside the test suite, where they would race with deterministic
    # controller assertions and leak the queue lock on cancellation.
    tasks: list[tuple[asyncio.Task, str]] = []
    if AppSettings.TEST_ENV == "NONE":
        tasks = [
            # (asyncio.create_task(run_periodic_quota_check(interval_second=20)), "Quota checker"),
            (asyncio.create_task(run_periodic_bank_payment_queue()), "Bank payment queue"),
            (asyncio.create_task(run_periodic_ecobank_payment_queue()), "Ecobank payment queue"),
        ]

    yield

    # Stop tasks upon application shutdown
    for task, name in tasks:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            logger.info("%s task cancelled.", name)


# Initialize application
````

Original lines 180–253:

````text
app_api = FastAPI(
    docs_url=None, redoc_url=None, openapi_url=None, title=AppSettings.PROJ_NAME, description="eHadj project API"
)


@app_api.get("/doc", include_in_schema=False)
async def custom_swagger_ui_html(
    request: Request,
    request_user: User = Depends(
        user_auth.require([RoleEnum.BANK1, RoleEnum.AGLO1, RoleEnum.DSI1, RoleEnum.MAEC1, RoleEnum.ASIN1])
    ),
) -> HTMLResponse:
    """Protect swagger doc endpoint."""
    return get_swagger_ui_html(openapi_url="/api/v1/openapi.json", title=f"{AppSettings.PROJ_NAME} - Documentation")


@app_api.get("/docs", include_in_schema=False)
async def custom_redoc_html(
    request: Request,
    request_user: User = Depends(
        user_auth.require([RoleEnum.BANK1, RoleEnum.AGLO1, RoleEnum.DSI1, RoleEnum.MAEC1, RoleEnum.ASIN1])
    ),
) -> HTMLResponse:
    """Protect redoc doc endpoint."""
    return get_redoc_html(openapi_url="/api/v1/openapi.json", title=f"{AppSettings.PROJ_NAME} - Documentation")


@app_api.get("/openapi.json", include_in_schema=False)
async def custom_openapi(
    request: Request,
    request_user: User = Depends(
        user_auth.require([RoleEnum.BANK1, RoleEnum.AGLO1, RoleEnum.DSI1, RoleEnum.MAEC1, RoleEnum.ASIN1])
    ),
) -> JSONResponse:
    """Protect openapi doc endpoint."""
    return JSONResponse(app_api.openapi())


app_api.include_router(router_api)
app.routes.append(Mount(path="/api/v1", app=app_api, name="api"))

# Mount Web App
app_pages = FastAPI(
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    title=AppSettings.PROJ_NAME,
    description="eHadj web application",
)
app.routes.append(Mount(path="/pages", app=app_pages, name="pages"))

# Load sub-apps routes and documents
document_models = []

# Retrieve the lists of documents for beanie initialization
for model_name in models.__all__:
    document_models.append(getattr(models, model_name))


# Register middleware
app.add_middleware(InitBeanieMiddleware, mongo_params=AppSettings.MONGO, document_models=document_models)
app.add_middleware(InitGlobalParamsMiddleware)
app_pages.add_middleware(SessionMiddleware, session_cookie="starlette", secret_key=AppSettings.CRYPTO_SECRET)
app_pages.add_middleware(InitJinjaGlobalsMiddleware)

##########################################################################
# Add security middleware to avoid middle man attack for kkiapay payment #
##########################################################################


# This must match the secret in your React code exactly
async def verify_signature(request: Request, body: bytes) -> bool:
    """Verify the integrity of incoming requests using HMAC signature."""
    # 1. Extract headers
````

Original lines 316–327:

````text
# app.add_middleware(IntegrityMiddleware)

###################################################
#                    END                          #
###################################################


# Events to run on startups
async def initialize_beanie() -> None:
    """Initialize beanie on startup."""
    await BeanieClient.init(mongo_params=AppSettings.MONGO, document_models=document_models)
    try:
````

Original lines 329–338:

````text

        org_coll = Organization.get_motor_collection()
        indexes = await org_coll.index_information()
        if "unique_ecobank_user_id" in indexes:
            await org_coll.drop_index("unique_ecobank_user_id")
            logger.info("Dropped legacy unique_ecobank_user_id index on organization collection.")
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning(f"Could not drop legacy unique_ecobank_user_id index: {exc}")

    try:
````

Original lines 340–359:

````text

        cat_coll = Category.get_motor_collection()
        indexes = await cat_coll.index_information()
        if "name_1" in indexes and indexes["name_1"].get("key") == [("name", 1)]:
            await cat_coll.drop_index("name_1")
            logger.info("Dropped legacy name_1 index on category collection.")
    except Exception as exc:  # pylint: disable=broad-except
        logger.warning(f"Could not drop legacy name_1 index on category: {exc}")


# Always log exception
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Log all request validation errors to a file."""
    logger.exception(exc.errors())
    return await request_validation_exception_handler(request=request, exc=exc)


async def update_uvicorn_logger() -> None:
    """Log all uvicorn errors."""
````

</details>

<a id="evidence-017"></a>

### evidence-017: `proj-ehadj-api/app/serializers/auth.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 49–84:

````text
class ResetPasswordSerializer(WriteObjectSerializer[User]):
    """
    Password reset validation.

    Allow the user to set a new password.
    """

    token: str
    password: str = Field(min_length=8)
    password2: str = Field(min_length=8)

    @pydantic.field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        """Verify that the password fit security criteria."""
        if not re.findall(r"[a-zA-Z]+", value):
            raise AssertionError("Votre mot de passe doit contenir au moins une lettre.")
        if not re.findall(r"[0-9]+", value):
            raise AssertionError("Votre mot de passe doit contenir au moins 1 chiffre.")
        if re.match(r"^\w+$", value):
            raise AssertionError("Votre mot de passe doit contenir au moins 1 caractère spécial.")
        return value

    @pydantic.model_validator(mode="after")
    def validate_passwords_equals(self) -> typing.Self:
        """Verify that both password are equals."""
        assert self.password == self.password2, "Le mot de passe de confirmation ne corresponds pas."
        return self

    async def run_async_validators(self, **kwargs: typing.Any) -> None:
        """Check that data pass DB validation."""
        await self.verify_jwt_token()

        # Ensure that verify_jwt_token actually set the instance. If not,
        # raise an HTTP 401 rather than letting `update()` assert and cause a 500.
        if not self.instance:
````

Original lines 96–102:

````text
    async def verify_jwt_token(self) -> bool:
        """Check that the token is valid, unused, and bound to its user.

        The token carries a random ``nonce``; the SHA-256 of that nonce is
        stored on the user. A token whose nonce does not match the stored hash
        (already consumed, or forged) is refused, so the link is single-use.
        """
````

Original lines 105–131:

````text

        try:
            jwt_data = jwt.decode(self.token, key=AppSettings.CRYPTO_SECRET, algorithms=["HS256"])
        except jwt.exceptions.InvalidTokenError:
            logger.warning("JWT token invalid for password reset")
            _invalid_reset_link()

        user_id = jwt_data.get("user_id")
        nonce = jwt_data.get("nonce")
        user: User | None = None
        if user_id:
            try:
                user = await User.get(user_id)
            except Exception:  # pylint: disable=broad-except
                user = None

        if not user_id or not nonce or user is None or not user.password_reset_token_hash:
            logger.warning("Reset token unusable for user_id=%s", user_id)
            _invalid_reset_link()

        expected = hashlib.sha256(nonce.encode()).hexdigest()
        if not hmac.compare_digest(expected, user.password_reset_token_hash):
            logger.warning("Reset token already used or tampered for user_id=%s", user_id)
            _invalid_reset_link()

        self.instance = user
        return True
````

Original lines 133–180:

````text
    async def update(self, **kwargs: typing.Any) -> User:
        """Reset the password and verify the user."""
        assert self.instance
        self.instance.set_password(self.password)
        self.instance.is_verified = True
        # Consume the single-use reset/registration token.
        self.instance.password_reset_token_hash = None
        await self.instance.save()

        return self.instance


class LoginAuthSerializer(WriteObjectSerializer[User]):
    """
    Login form.

    Allow the user who have authenticate to the web app using email and password.
    """

    email: pydantic.EmailStr
    password: str

    async def run_async_validators(self, **kwargs: typing.Any) -> None:
        """Check that data pass DB validation."""
        await self.verify_email_password()

    async def verify_email_password(self) -> bool:
        """Check that the email exists in the DB."""
        self.instance: User | None = await User.find_current(email=self.email)

        if self.instance:
            if not self.instance.is_active:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Votre compte est inactif. Veuillez procéder à l'activation de votre compte.",
                )

            # In a multi-org context, we check if the active organization (or the first one) is active
            await self.instance.fetch_all_links()

            organization_docs = [org.doc for org in self.instance.organizations if org.doc]
            if organization_docs:
                active_org = next(
                    (o for o in organization_docs if str(o.id) == self.instance.active_organization_id),
                    organization_docs[0],
                )
                if not active_org.is_active:
                    raise HTTPException(
````

Original lines 198–233:

````text
class ForgotPasswordSerializer(WriteObjectSerializer[User]):
    """
    Password forgotten form.

    Allow the user who have forgotten their password to request a reset link.
    """

    email: pydantic.EmailStr

    # This code is commented because, at the moment, we don't want to provide
    # feedback on the email existing. This allows higher security as hackers don't know which
    # emails are registered in the system

    # async def run_async_validators(self, request: Request) -> None:
    #     """Check that data pass DB validation."""
    #     await self.validate_email_exists()

    # async def validate_email_exists(self) -> None:
    #     """Check that the email exists in the DB."""
    #     is_existing = await User.find_current(email=self.email).exists()
    #     if not is_existing:
    #         raise AssertionError("This email does not correspond to any known user.")

    async def run_async_validators(self, **kwargs: typing.Any) -> None:
        """Check that data pass DB validation."""
        await self.verify_email_exists()

    async def verify_email_exists(self, **kwargs: typing.Any) -> bool:
        """Check that the email exists in the DB."""
        user = await User.find_current(email=self.email)
        if user:
            self.instance = user
            return True
        return False

    async def update(self, **kwargs: typing.Any) -> User:
````

</details>

<a id="evidence-019"></a>

### evidence-019: `proj-ehadj-api/app/serializers/organization/pilgrim_org.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 92–161:

````text
class WritePilgrimOrgSerializer(WriteObjectSerializer[PilgrimOrg]):
    """Serialize the `agency` object for create and update."""

    name: str | None = None
    ifu: str | None = None
    address: str | None = None
    phone: str = Field(min_length=6)
    admin_first_name: str | None = Field(None, exclude=True)
    admin_last_name: str | None = Field(None, exclude=True)
    admin_email: pydantic.EmailStr | None = Field(None, exclude=True)

    license: License = License()
    merger: Merger = Merger()

    # category_ids: list[str] | None = None , only for SAs

    @pydantic.field_validator("admin_first_name", "admin_last_name", "admin_email", mode="before")
    @classmethod
    def validate_admin_info(cls, value: str, values: pydantic.ValidationInfo, **kwargs: typing.Any) -> str | None:
        """Replace blank string values with `None`."""

        # No validation if update
        if values.data.get("instance"):
            return None

        if not value:
            raise Validation422Error("Ce champ est obligatoire.")

        return value

    async def run_async_validators(self, **kwargs: typing.Any) -> None:
        """Check that data pass DB validation."""
        await self.validate_email_uniqueness()

    async def validate_email_uniqueness(self) -> None:
        """Check that email does not exist in the DB."""
        if self.instance:
            return

        assert self.admin_email

        is_duplicate = await User.find_current(email=self.admin_email)
        if is_duplicate:
            raise Validation422Error("Cette adresse email est déjà rattachée à un compte existant.")

    async def create(self, **kwargs: typing.Any) -> PilgrimOrg:
        """Create the object in the database using the data extracted by the serializer."""
        assert self.admin_first_name and self.admin_last_name and self.admin_email

        logger.info(
            "Creating PilgrimOrg with admin: %s %s (%s)",
            self.admin_first_name,
            self.admin_last_name,
            self.admin_email,
        )

        # Create the pilgrim_org
        logger.debug("Creating PilgrimOrg document in database...")

        # Exclude None values from dump
        org_data = self.model_dump(exclude_none=True)
        logger.debug("Organization data: %s", org_data)

        # Generate a random 10-digit IFU if absent to avoid uniqueness violation
        if not org_data.get("ifu"):
            campaign = Campaign.get_default()
            for _ in range(100):
                candidate_ifu = "".join(secrets.choice("0123456789") for _ in range(10))
                exists = await PilgrimOrg.find_one(
                    PilgrimOrg.ifu == candidate_ifu, PilgrimOrg.campaign.id == campaign.id
````

Original lines 181–214:

````text
        user_serializer = WriteUserSerializer(
            first_name=self.admin_first_name,
            last_name=self.admin_last_name,
            email=self.admin_email,
            organization_id=str(pilgrim_org.id),
            organization=pilgrim_org,
            role=RoleEnum.PILGRIM1,
            is_primary=True,
            is_onboard=False,  # Add this line
        )

        await user_serializer.run_async_validators(request=kwargs["request"])
        logger.debug("User validators passed for email=%s", self.admin_email)

        admin = await user_serializer.create_pilgrim_user(**kwargs, is_primary=True)
        logger.info(
            "Primary admin created successfully. User ID=%s, email=%s, organization_id=%s",
            admin.id,
            admin.email,
            pilgrim_org.id,
        )

        setattr(pilgrim_org, "admin", admin)
        logger.info("PilgrimOrg creation process completed. ID=%s", pilgrim_org.id)

        return pilgrim_org

    async def update(self, **kwargs: typing.Any) -> PilgrimOrg:
        """Update the object in the database using the data extracted by the serializer."""
        assert self.instance
        instance: PilgrimOrg = self.instance.model_copy(update=self.model_dump())
        await instance.replace()  # because the data is corrupted in the base
        self.instance = instance
        return instance
````

</details>

<a id="evidence-023"></a>

### evidence-023: `proj-ehadj-api/app/webapi/auth.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 36–142:

````text
async def create(
    request: Request, serializer_write: LoginAuthSerializer
) -> AuthTokenSerializer | dict[str, typing.Any]:
    """Create an authentication token."""
    identifier = str(serializer_write.email)
    await controllers.auth_throttle.assert_not_locked("login", identifier)
    try:
        await serializer_write.run_async_validators(request=request)
    except HTTPException:
        await controllers.auth_throttle.register_failure("login", identifier)
        raise
    await controllers.auth_throttle.clear("login", identifier)
    assert (user := serializer_write.instance)

    # Issue and email an OTP; the client must call verify_otp to complete login.
    return await controllers.user.issue_login_otp(user)


@router.post("/verify_otp/", status_code=status.HTTP_201_CREATED)
@audit_action("login", "auth_token creation via OTP")
async def verify_otp(request: Request, body: VerifyOTPRequest) -> AuthTokenSerializer:
    """Verify an OTP and issue auth token if valid."""

    if not body.email or not body.otp:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Email et OTP requis.")

    identifier = str(body.email)
    await controllers.auth_throttle.assert_not_locked("otp_verify", identifier)

    user = await User.find_current(email=body.email)
    if not user:
        await controllers.auth_throttle.register_failure("otp_verify", identifier)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides.")

    if not user.verify_otp(body.otp):
        await controllers.auth_throttle.register_failure("otp_verify", identifier)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OTP invalide ou expiré.")

    await controllers.auth_throttle.clear("otp_verify", identifier)
    # valid OTP: clear it, generate auth key and return token
    await user.clear_otp()
    await user.generate_auth_key()
    assert user.auth_key
    # Fetch all linked documents (including organizations)
    await user.fetch_all_links()
    request.state.user_id = str(user.id)
    return AuthTokenSerializer(
        id=user.auth_key, auth_key=user.auth_key, email=user.email, user=UserSerializer.read(user)
    )


@router.post("/reset_password/", status_code=status.HTTP_202_ACCEPTED)
@audit_action("reset password", "auth_token")
async def reset_password(request: Request, serializer_write: ResetPasswordSerializer) -> AuthTokenSerializer:
    """Let users to set a new password.

    This is also used to confirm registration of new users.
    Since registration is confirmed by updating the password.
    """
    identifier = request.client.host if request.client else "unknown"
    await controllers.auth_throttle.assert_not_locked("reset_password", identifier)
    try:
        await serializer_write.run_async_validators(request=request)
    except HTTPException:
        await controllers.auth_throttle.register_failure("reset_password", identifier)
        raise
    await controllers.auth_throttle.clear("reset_password", identifier)
    user = await serializer_write.update()
    await user.generate_auth_key()
    assert user.auth_key
    # Fetch all linked documents (including organizations)
    await user.fetch_all_links()
    request.state.user_id = str(user.id)
    return AuthTokenSerializer(
        id=user.auth_key, auth_key=user.auth_key, email=user.email, user=UserSerializer.read(user)
    )


@router.post("/forgot_password/", status_code=status.HTTP_202_ACCEPTED)
@audit_action("forgot password", "auth_token")
async def forgot_password(request: Request, serializer_write: ForgotPasswordSerializer) -> dict[str, bool]:
    """Let the user request for a link to reset their password."""
    identifier = str(serializer_write.email)
    await controllers.auth_throttle.assert_not_locked("forgot_password", identifier)
    await controllers.auth_throttle.register_hit("forgot_password", identifier)

    email_exists = await serializer_write.verify_email_exists(request=request)

    if email_exists:
        await serializer_write.update()
    if serializer_write.instance is not None:
        request.state.user_id = str(serializer_write.instance.id)
    return {"result": True}


@router.delete("/{pk}/", status_code=status.HTTP_204_NO_CONTENT)
@audit_action("delete authentication token", "auth_token")
async def destroy(request: Request, pk: str) -> None:
    """Delete the authentication token used by the user."""
    instance = await User.find_one_or_404(User.auth_key == pk)
    request.state.user_id = str(instance.id)
    # Match the credential again at write time.  A delayed logout for an old
    # session must be a no-op if a concurrent login has already issued a new
    # auth key for the same account.
    await User.find_one(User.id == instance.id, User.auth_key == pk).set(
        {"auth_key": None, "auth_key_expires_at": None}
    )
````

</details>

<a id="evidence-025"></a>

### evidence-025: `proj-ehadj-api/app/webapi/pilgrim_org.py`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 38–73:

````text
async def _enforce_register_throttle(request: Request) -> None:
    """Count and lock public registration attempts before body validation."""
    identifier = request.client.host if request.client else "unknown"
    await controllers.auth_throttle.assert_not_locked("register", identifier)
    await controllers.auth_throttle.register_hit("register", identifier)


@router.get("/stats/default/", status_code=status.HTTP_200_OK)
@audit_action("get individual account stats default", "individual account organization")
async def stats_default(
    request: Request,
    request_user: User = Depends(
        user_auth.require_active(
            [RoleEnum.DSI1, RoleEnum.AGLO1, RoleEnum.ASIN1, RoleEnum.DSI2, RoleEnum.AGLO2, RoleEnum.ASIN2]
        )
    ),
) -> StatsCollection:
    """Provide statistics about the list of items."""
    campaign = await get_campaign_for_view(request)
    query = PilgrimOrgQuery(user=request_user, filters=request.query_params, campaign=campaign)
    request.state.user_id = str(request_user.id)
    return {"data": await query.get_stats()}


@router.get("/{pk}/", status_code=status.HTTP_200_OK)
@audit_action("retrieve an individual account", "individual account organization")
async def retrieve(
    request: Request,
    pk: str,
    request_user: User = Depends(user_auth.require_active([RoleEnum.PILGRIM1, RoleEnum.AGLO1, RoleEnum.AGLO2])),
) -> PilgrimOrgSerializer:
    """Retrieve an agency by id.

    This is a public endpoint. Anyone to retrieve info about an agency.
    """
    instance = await PilgrimOrgQuery(user=request_user).retrieve(pk)
````

Original lines 122–157:

````text
@router.post("/", status_code=status.HTTP_201_CREATED)
@audit_action("create individual account", "individual account organization")
async def create(
    request: Request,
    serializer_write: WritePilgrimOrgSerializer,
    _throttle: None = Depends(_enforce_register_throttle),
) -> PilgrimOrgSerializer:
    """Create an PilgrimOrg."""
    logger.info(
        "Starting PilgrimOrg creation process. Data received: name=%s, ifu=%s, email=%s",
        serializer_write.name,
        serializer_write.ifu,
        serializer_write.admin_email,
    )

    try:
        logger.debug("Running async validators...")
        await serializer_write.run_async_validators(request=request)
        logger.info("Async validators passed successfully")

        logger.debug("Creating PilgrimOrg instance...")
        instance: PilgrimOrg = await serializer_write.create(request=request)
        admin = typing.cast(User | None, getattr(instance, "admin", None))
        logger.info(
            "PilgrimOrg created successfully. ID=%s, name=%s, admin_email=%s",
            instance.id,
            instance.name,
            admin.email if admin is not None else "N/A",
        )

        logger.debug("Serializing response...")
        response = PilgrimOrgSerializer.read(instance)
        logger.info("PilgrimOrg creation completed successfully. ID=%s", instance.id)
        request.state.user_id = str(admin.id) if admin is not None else None
        return response

````

</details>

<a id="evidence-039"></a>

### evidence-039: `proj-ehadj-ui/.eslintrc.json`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–78:

````text
{
  "env": {
    "browser": true,
    "es2022": true
  },
  "extends": ["plugin:react/recommended", "plugin:prettier/recommended", "plugin:jsdoc/recommended-error"],
  "parserOptions": {
    "ecmaFeatures": {
      "jsx": true
    },
    "ecmaVersion": 2022,
    "sourceType": "module",
    "parser": "@babel/eslint-parser",
    "requireConfigFile": false
  },
  "plugins": ["react", "prettier"],
  "rules": {
    "react/function-component-definition": [2, { "namedComponents": "arrow-function" }],
    // "import/no-unresolved": [2, { "caseSensitive": false }],
    "react/jsx-props-no-spreading": "off",
    "jsdoc/require-jsdoc": "off",
    "jsdoc/tag-lines": ["error", "any", { "startLines": null }],
    "jsdoc/no-defaults": "off",
    "react/prop-types": "off",
    "no-unused-vars": "warn"
  },
  "overrides": [
    {
      "files": ["src/components/shared/**/*.{js,jsx}"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["./*", "../*"],
                "message": "Use baseUrl imports in shared components: components/shared/<ComponentName>."
              }
            ]
          }
        ]
      }
    },
    {
      "files": ["src/**/*.{js,jsx}"],
      "rules": {
        "no-restricted-imports": [
          "error",
          {
            "patterns": [
              {
                "group": ["**/*.module.*"],
                "message": "CSS modules are prohibited. Use Tailwind utilities and existing shadcn/ui primitives."
              }
            ],
            "paths": [
              {
                "name": "components",
                "message": "The components barrel is deprecated. Import from components/shared/<ComponentName> instead."
              }
            ]
          }
        ]
      }
    }
  ],
  "settings": {
    "react": {
      "version": "detect"
    },
    "import/resolver": {
      "node": {
        "extensions": [".js", ".jsx"],
        "moduleDirectory": ["src", "node_modules"]
      }
    }
  }
}
````

</details>

<a id="evidence-040"></a>

### evidence-040: `proj-ehadj-ui/.husky/pre-commit`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–4:

````text
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run lint
````

</details>

<a id="evidence-041"></a>

### evidence-041: `proj-ehadj-ui/.prettierrc`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–49:

````text
{
  "printWidth": 120,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "auto",
  "insertPragma": false,
  "overrides": [
    {
      "files": ["*.js", "*.jsx"],
      "options": {
        "tabWidth": 2
      }
    },
    {
      "files": ["*.json", "*rc"],
      "options": {
        "tabWidth": 2
      }
    },
    {
      "files": "*.css",
      "options": {
        "tabWidth": 4
      }
    },
    {
      "files": ["*.html", "*.xml"],
      "options": {
        "tabWidth": 2,
        "printWidth": 120
      }
    },
    {
      "files": "*.source.html",
      "options": {
        "tabWidth": 2,
        "printWidth": 200
      }
    }
  ]
}
````

</details>

<a id="evidence-042"></a>

### evidence-042: `proj-ehadj-ui/.stylelintrc.json`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–13:

````text
{
  "plugins": ["stylelint-order"],
  "extends": ["stylelint-config-standard", "stylelint-config-recess-order", "stylelint-config-tailwindcss"],
  "rules": {
    "selector-class-pattern": null,
    "selector-pseudo-class-no-unknown": [
      true,
      {
        "ignorePseudoClasses": ["global"]
      }
    ]
  }
}
````

</details>

<a id="evidence-043"></a>

### evidence-043: `proj-ehadj-ui/AGENTS.md`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–45:

````text
# eHadj UI Agent Instructions

## Project overview

This repository is the canonical agent workspace for the eHadj React frontend. It must be usable when opened without the parent workspace.

eHadj manages the Hajj pilgrimage process for Benin. The frontend owns browser routes, role-aware navigation, user-facing workflows, local storage, API consumption, UI presentation, frontend telemetry, and frontend documentation.

For full-stack work, inspect the backend repository when it is available and within the authorized scope. If required API evidence is unavailable, document the contract gap and pause only the API-dependent action or conclusion. Continue independent, authorized frontend work without inventing backend behavior.

## Start here

Read `AGENTS.md` and `CONTEXT.md` once when entering the repository; reread changed or relevant sections as needed. Use `docs/README.md` to find the affected feature documentation and `skills/` for the applicable workflow. Read `docs/architecture.md` for route/provider/API boundaries and `DESIGN.md` for UI work. Avoid rereading unrelated documentation on every edit.

## Important directories

- `src/App/`: route shell, protected route wiring, global shell behavior.
- `src/pages/`: route-level feature areas.
- `src/components/ui/`: low-level shadcn-style UI primitives.
- `src/components/shared/`: reusable app-level components.
- `src/context/`: REST client, user, permissions, and preferences providers.
- `src/helpers/`: REST client, storage, role helpers, and utilities.
- `docs/`: frontend product, architecture, route, and contract docs.
- `skills/`: canonical frontend agent workflows and review skills.
- `tasks/lessons.md`: durable frontend lessons and pitfalls.

## Commands

- Install: `npm install`
- Dev: `npm start`
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Preflight: `npm run preflight`
- Standard verification: `npm run verify`

Runtime: Node.js `22.12+` (22.x) or `24.x`, npm, Vite 8 and TanStack Router.

## Safety rules

- Do not read, print, copy, or commit real `.env` values.
- Do not copy credentials, payment keys, API keys, OTPs, reset URLs, protected document data, or real user data into docs, logs, fixtures, screenshots, or generated artifacts.
- Treat the remote API as read-only by default unless a human explicitly authorizes safe non-production writes.
- Authenticated workflows require human-supplied credentials.
- Ask before changing auth/session behavior, permissions, payments, identity/passport/visa, audit, deployment config, or external integrations.
````

</details>

<a id="evidence-044"></a>

### evidence-044: `proj-ehadj-ui/DESIGN.md`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–45:

````text
# eHadj UI Design Memory

## Purpose

This file records confirmed frontend visual and design-system facts. It is not a redesign brief.

## Visual Personality

- Operational government/service platform, not a marketing site.
- Dense, task-oriented pages with tables, filters, sidebars, modals, dashboard cards, and form workflows.
- Restrained neutral base with Hajj green accents.
- Finance, trip, agency, and governance workflows prioritize scannability, predictable controls, and clear state over decoration.

## Component System

- shadcn-style setup uses JavaScript components, CSS variables, neutral base color, and `lucide-react`.
- Prefer primitives in `src/components/ui/`: button, card, dialog, dropdown, form, input, select, table, tabs, tooltip, sheet, sidebar, skeleton, spinner, sonner, chart, and related controls.
- Prefer shared app components in `src/components/shared/`: `Page`, `Sidebar`, `ProtectedRoute`, `Pagination`, `FilterSelect`, `ConfirmationModal`, `Modal`, `StatsGrid`, `EmptyCard`, `Lockable`, `LockProtection`, and payment/banner helpers.
- New work should follow the icon convention already present in the touched component or page.

## Layout Rules

- Route-level pages live under `src/pages/`.
- Route shell behavior lives under `src/App/`.
- Low-level primitives live under `src/components/ui/`.
- App-level shared UI lives under `src/components/shared/`.
- Sidebar behavior is responsive: desktop sidebars can collapse/offcanvas; mobile sidebars render through a `Sheet`.
- Auth pages use a dark green decoration area that collapses into a short top block on small screens.

## Search, Filters, And Lists

List pages should keep visible search, active filter chips, request params, URL query params, and export params aligned.

- Keep draft filter state separate from applied filter state.
- Search/filter changes reset pagination.
- Exports use the same effective query as the visible list.
- Render defensively when deep-linked filters depend on async labels.

## Colors And Styling

- Style UI with Tailwind utilities and existing shadcn/ui primitives. CSS modules and new page-specific stylesheets are prohibited (see `AGENTS.md`).
- Always use `assets/img/logo/icon_ehadj_green.svg` for the eHadj logo at its original aspect ratio. Do not substitute another logo or wordmark asset, or recreate the brand from icon and text.

- Semantic status badges use the shared `Badge` variants: `success`, `destructive`, `pending`, and `info`. Their colors belong to the primitive and must not be overridden at call sites.
- Callers may add layout or interaction classes such as spacing, shrinking, wrapping, or cursor behavior without redefining the semantic treatment.
````

</details>

<a id="evidence-045"></a>

### evidence-045: `proj-ehadj-ui/components.json`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–24:

````text
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": false,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/assets/styles/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "components",
    "utils": "lib/utils",
    "ui": "components/ui",
    "lib": "lib",
    "hooks": "hooks"
  },
  "registries": {
    "@acme": "https://acme.com/r/{name}.json"
  },
  "iconLibrary": "lucide"
}
````

</details>

<a id="evidence-046"></a>

### evidence-046: `proj-ehadj-ui/docs/development.md`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–45:

````text
# Frontend development and deployment

See the [project README](../README.md) for prerequisites, installation, and everyday commands.

## Environment configuration

Application code reads `import.meta.env.VITE_*`. The explicit allowlist and validation rules live in [`scripts/client-env.cjs`](../scripts/client-env.cjs); [`.env.example`](../.env.example) lists the required and optional integration settings. Only allowlisted custom variables are exposed to browser code.

Corresponding `REACT_APP_*` names remain a temporary fallback. An explicitly set `VITE_*` value wins, even when empty; empty required values fail validation. Rename configuration keys to `VITE_*` while preserving their values.

For each variable name, precedence is:

1. Shell environment.
2. `.env.<mode>.local`.
3. `.env.local` (except in test mode).
4. `.env.<mode>`.
5. `.env`.

The loader preserves legacy dotenv parsing and recursive expansion, including unquoted `#` values and forward references. `npm run test:config` checks this compatibility contract.

Development uses `development` mode; builds use `production` by default. `npm run preflight -- production` checks production-mode configuration without building. Preflight and builds require the three variables documented in the README and validate that frontend/API URLs are absolute HTTP(S) URLs. The API base must end in `/` (normally `/api/v1/`) and have no query string or fragment because the client appends endpoint paths. This validates configuration shape, not API connectivity or credentials.

`VITE_PUBLIC_URL` controls the asset base, with `PUBLIC_URL` as a temporary fallback. Application routes remain rooted at `/`; changing the asset base does not configure a router subdirectory. Asset links use `import.meta.env.BASE_URL`.

Allowlisted values are embedded at build time, so configuration changes require a rebuild. They are publicly readable in the browser. `VITE_JWT_SECRET` currently supports browser-side medical-note signing and cannot be treated as a private signing key. The behavior and separate remediation are documented in [trip and operations](trip-and-operations.md) and the [security review](frontend-security-privacy-review.md).

## Toolchain

[`vite.config.mjs`](../vite.config.mjs) defines the development server, aliases, asset base, and production output. The entry point is the root `index.html`, and production assets are written to `build/`.

The CSS pipeline uses Tailwind 3 and the explicit plugins in [`postcss.config.cjs`](../postcss.config.cjs). Production JavaScript targets come from the Browserslist configuration in [`package.json`](../package.json). Jest, Babel, and jsdom are explicit development dependencies; CRA and `react-app-polyfill` are not required.

## Browser checks

`npm run test:browser` runs [`scripts/check-frontend-security.cjs`](../scripts/check-frontend-security.cjs) against an existing production build. It supplies synthetic API responses, mocks payment traffic, and blocks other external requests.

1. Prepare an isolated checkout or copy without real environment files or credentials, and install dependencies with `npm ci`.
2. Configure synthetic values: frontend `http://127.0.0.1:4173`, API `http://127.0.0.1:4173/api/v1/`, and a non-production signing value. Leave optional integrations unset.
3. Run `npm run build` in that isolated directory.
4. Install or locate Chromium and set `CHROMIUM_PATH` to its executable if necessary.
5. Ensure port 4173 is free, then run `npm run test:browser`. The script starts its own local server; a separate preview server is unnecessary.

These checks exercise synthetic frontend flows. They do not verify real authenticated integrations, every production browser, or exhaustive print and visual parity. See the [security review](frontend-security-privacy-review.md#verification-and-remaining-release-evidence) for remaining release evidence.

To exercise an already-running synthetic Docker image instead of the script's Express server, set `FRONTEND_TEST_ORIGIN` to its published HTTP origin on `127.0.0.1`, then run `npm run test:browser`. The same API/payment mocks and external-request blocking apply. Build any absolute `VITE_PUBLIC_URL` with that same origin so browser asset requests reach the test container.
````

</details>

<a id="evidence-047"></a>

### evidence-047: `proj-ehadj-ui/docs/public-and-auth.md`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–45:

````text
# Public And Auth Modules

## 1. Public Landing Page (`/`)

Main file: [`src/pages/Home/index.jsx`](../src/pages/Home/index.jsx)

### Data loaded

- `preference/public/`
- `category/`

### Purpose

This page is the public marketing and orientation surface for the platform.

### Sections

Header → Mecca hero → platform presentation → quota → four-step journey → tariffs → footer.
The header has Login and Registration; presentation links to pilgrim registration.
Tariff cards are informational and limited to Standard, Premium, Non-résident
Standard, and Non-résident Premium. The national overview uses the backend-owned
national counts and can differ from the public-category breakdown. Standard and
Premium use their backend quota groups. The two non-resident offers use their API
prices and occupied counts but share the frontend capacity constant from
`src/data/Pilgrims.jsx`; Home counts that pool once and shows the same
remaining availability on both tariff cards. Supervisor categories are excluded
from Home. Existing package descriptions remain local.

Home uses Tailwind utilities, shared shadcn/ui controls, and the original eHadj
wordmark assets. Tariffs use four columns on wide screens, two on tablets, and
one on mobile. Journey illustrations follow the same responsive flow.

The public query refreshes on mount, focus, and reconnect. Loading and failed
requests keep account navigation available; failures offer retry and hide quota
and price claims. Missing API data never becomes zero availability or demo data.
Optional tariff copy naming a different campaign year is suppressed.

### Redirection behavior

If a user is already authenticated and the current-user request has resolved, `Home` redirects according to the resolved active role:

- super admin -> `/user`
- bank -> `/invoice`
- pilgrim -> `/profile`
- agency, AGLO, MS, DEI, or MAEC -> `/trip`
````

</details>

<a id="evidence-048"></a>

### evidence-048: `proj-ehadj-ui/docs/search-and-filter-guidelines.md`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–45:

````text
# Search And Filter Guidelines

This document defines the standard behavior for list-page search, filters, URL sync, exports, and pagination.

Apply these rules to all new list pages and when refactoring existing ones.

## 1. Core Principle

The UI, URL, and server request must always describe the same applied query state.

At any moment, these must stay aligned:

- visible search text
- active filter chips
- request params sent to the backend
- URL query params
- exported list params

## 2. Search Rules

- Search is additive to filters. A search term must not drop active filters from the backend request.
- Keep the input controlled with local state so deep links, resets, and programmatic updates are reflected in the field.
- Use debounce for non-empty search requests to reduce request churn.
- When search is cleared, remove `q` from the effective request immediately. Do not keep the old debounced query active after the input is empty.
- URL sync may use raw input state, but the request and export logic must use the same effective query state as the visible list.

## 3. Filter Rules

- Separate draft filter state from applied filter state.
- Dropdown or select edits are draft only until the user clicks the apply/validate action.
- Chips must reflect applied filters only, never draft selections.
- Clearing search must keep applied filters active.
- Resetting filters must not clear search unless the user explicitly clears search too.
- Removing a single chip must update:
  - applied filters
  - draft filter control state
  - URL params
  - server request params

## 4. URL Sync Rules

- The URL must represent applied filters plus the current search text only.
- Do not write draft filter choices into `useUrlSearchParams`.
- Deep-linked URLs must initialize:
  - controlled search state
````

</details>

<a id="evidence-049"></a>

### evidence-049: `proj-ehadj-ui/jest.config.cjs`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–15:

````text
module.exports = {
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.{js,jsx,ts,tsx}', '!src/**/*.d.ts'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}', '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}'],
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  modulePaths: ['<rootDir>/src'],
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': '<rootDir>/scripts/jest/js-transform.cjs',
    '^.+\\.css$': '<rootDir>/scripts/jest/css-transform.cjs',
    '^(?!.*\\.(js|jsx|mjs|cjs|ts|tsx|css|json)$)': '<rootDir>/scripts/jest/file-transform.cjs',
  },
  resetMocks: true,
  transformIgnorePatterns: ['[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$'],
};
````

</details>

<a id="evidence-050"></a>

### evidence-050: `proj-ehadj-ui/jsconfig.json`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–6:

````text
{
  "compilerOptions": {
    "baseUrl": "src"
  },
  "include": ["src"]
}
````

</details>

<a id="evidence-051"></a>

### evidence-051: `proj-ehadj-ui/package.json`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–139:

````text
{
  "name": "proj-ehadj-ui",
  "version": "0.1.0",
  "private": true,
  "author": "Beans <dev@trybeans.com>",
  "homepage": "",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/trellixio/proj-ehadj-ui.git"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@radix-ui/react-alert-dialog": "^1.1.15",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-icons": "^1.3.2",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-popover": "^1.1.15",
    "@radix-ui/react-portal": "1.1.9",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toggle": "^1.1.10",
    "@radix-ui/react-toggle-group": "^1.1.11",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@sentry/react": "^9.2.0",
    "@tailwindcss/postcss": "^4.1.14",
    "@tanstack/react-query": "^4.26.1",
    "@tanstack/react-router": "1.170.44",
    "@trellixio/roaster-coffee": "^0.2.17",
    "axios": "^1.20.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "crypto-js": "^4.2.0",
    "date-fns": "^4.1.0",
    "echarts": "^5.6.0",
    "echarts-for-react": "^3.0.6",
    "framer-motion": "^12.23.24",
    "input-otp": "^1.4.2",
    "jspdf": "^4.2.1",
    "jspdf-autotable": "^5.0.9",
    "jwt-decode": "^4.0.0",
    "jwt-encode": "^1.0.1",
    "lucide-react": "^0.546.0",
    "next-themes": "^0.4.6",
    "prop-types": "^15.8.1",
    "react": "^18.2.0",
    "react-day-picker": "^9.11.1",
    "react-dom": "^18.2.0",
    "react-google-recaptcha": "^3.1.0",
    "react-helmet-async": "^2.0.5",
    "react-hook-form": "^7.65.0",
    "react-localization": "^1.0.19",
    "recharts": "^2.15.4",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7",
    "tw-animate-css": "^1.4.0",
    "web-vitals": "^2.1.4",
    "zod": "^4.1.12"
  },
  "scripts": {
    "start": "vite",
    "build": "vite build",
    "test": "jest",
    "preflight": "node scripts/preflight.js",
    "lint:prettier": "prettier --check .",
    "lint:stylelint": "stylelint src",
    "lint:js": "eslint 'src/**/*.{js,ts,jsx}'",
    "lint": "npm run lint:prettier && npm run lint:js && npm run lint:stylelint",
    "verify": "npm run lint && npm run build",
    "postinstall": "husky install",
    "preview": "vite preview",
    "test:config": "node scripts/client-env.test.cjs",
    "test:browser": "node scripts/check-frontend-security.cjs",
    "test:container": "node scripts/check-container.cjs"
  },
  "devDependencies": {
    "@babel/core": "7.29.7",
    "@babel/eslint-parser": "^7.19.1",
    "@babel/preset-env": "7.26.9",
    "@babel/preset-react": "7.26.3",
    "@vitejs/plugin-react": "6.1.2",
    "autoprefixer": "^10.4.21",
    "babel-jest": "29.7.0",
    "browserslist": "4.29.3",
    "browserslist-to-esbuild": "2.1.1",
    "dotenv": "10.0.0",
    "dotenv-expand": "5.1.0",
    "eslint": "^8.34.0",
    "eslint-config-airbnb": "^19.0.4",
    "eslint-config-prettier": "^8.6.0",
    "eslint-plugin-import": "2.31.0",
    "eslint-plugin-jsdoc": "50.8.0",
    "eslint-plugin-jsx-a11y": "^6.7.1",
    "eslint-plugin-prettier": "^4.2.1",
    "eslint-plugin-react": "^7.32.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "express": "^4.18.2",
    "husky": "^8.0.3",
    "jest": "29.7.0",
    "jest-environment-jsdom": "29.7.0",
    "path": "^0.12.7",
    "playwright-core": "1.64.1",
    "postcss": "^8.5.6",
    "postcss-flexbugs-fixes": "5.0.2",
    "postcss-preset-env": "7.8.3",
    "prettier": "^2.8.4",
    "shadcn": "^3.5.0",
    "stylelint": "^15.2.0",
    "stylelint-config-recess-order": "^4.0.0",
    "stylelint-config-standard": "^30.0.1",
    "stylelint-config-tailwindcss": "^1.0.0",
    "stylelint-order": "6.0.4",
    "tailwindcss": "^3.4.18",
    "vite": "8.3.4"
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  },
  "engines": {
    "node": "^22.12.0 || ^24.0.0"
  }
}
````

</details>

<a id="evidence-052"></a>

### evidence-052: `proj-ehadj-ui/postcss.config.cjs`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–7:

````text
module.exports = {
  plugins: [
    require('tailwindcss'),
    require('postcss-flexbugs-fixes'),
    require('postcss-preset-env')({ autoprefixer: { flexbox: 'no-2009' }, stage: 3 }),
  ],
};
````

</details>

<a id="evidence-053"></a>

### evidence-053: `proj-ehadj-ui/scripts/check-frontend-security.cjs`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 6–41:

````text
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const origin = process.env.FRONTEND_TEST_ORIGIN || 'http://127.0.0.1:4173';
const target = new URL(origin);
assert(
  target.protocol === 'http:' && target.hostname === '127.0.0.1' && target.origin === origin,
  'Synthetic browser checks require an HTTP origin on 127.0.0.1'
);
const app = express();
app.use(express.static(path.join(__dirname, '../build')));
app.get('*', (_, response) => response.sendFile(path.join(__dirname, '../build/index.html')));
const server = process.env.FRONTEND_TEST_ORIGIN ? null : app.listen(4173, '127.0.0.1');
let browser;

const list = (data = []) => ({ object: 'list', data, count: data.length, next: null, previous: null });
const user = {
  id: 'synthetic-user',
  first_name: 'Synthetic',
  last_name: 'Tester',
  email: 'test@example.invalid',
  roles: ['AGLO1', 'BANK1'],
  organization_ids: ['org-aglo', 'org-bank'],
  organization_names: ['Test AGLO', 'Test BANK'],
  active_organization_id: 'org-aglo',
  membership_version: 1,
  is_onboard: true,
};

const createContext = async () => {
  const state = {
    user: { ...user },
    failUser: false,
    failPermissions: false,
    resetAttempts: 0,
    sdkLoads: 0,
    requests: [],
````

</details>

<a id="evidence-054"></a>

### evidence-054: `proj-ehadj-ui/scripts/client-env.cjs`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 6–76:

````text
const required = ['VITE_FRONTEND_BASE_URL', 'VITE_API_BASE_URL', 'VITE_JWT_SECRET'];
const optional = ['VITE_ENV', 'VITE_SENTRY_DSN', 'VITE_KKIAPAY_PUBLIC_KEY', 'VITE_CAPTCHA_PUBLIC_KEY'];

// Preserve existing file parsing/precedence while deployment names transition to VITE_.
const loadClientEnv = (mode, directory, environment = process.env) => {
  const resolved = { ...environment };
  const files = [`.env.${mode}.local`, mode !== 'test' && '.env.local', `.env.${mode}`, '.env'].filter(Boolean);
  for (const file of files) {
    const filename = path.join(directory, file);
    if (fs.existsSync(filename)) {
      const parsed = dotenv.parse(fs.readFileSync(filename));
      // CRA's recursive expansion supports references declared later in the file.
      // Isolate it from process.env while keeping shell and earlier-file precedence.
      const fileKeys = Object.keys(parsed);
      for (const [key, value] of Object.entries(resolved)) {
        Object.defineProperty(parsed, key, {
          value,
          writable: true,
          configurable: true,
          enumerable: Object.hasOwn(parsed, key),
        });
      }
      // Shell-only keys are available to references, but are not expanded eagerly.
      const expanded = expand({ parsed, ignoreProcessEnv: true }).parsed;
      for (const key of fileKeys) resolved[key] = expanded[key];
    }
  }
  return Object.fromEntries(
    [...required, ...optional, 'VITE_PUBLIC_URL'].map((key) => {
      const legacy = key === 'VITE_PUBLIC_URL' ? 'PUBLIC_URL' : key.replace('VITE_', 'REACT_APP_');
      return [key, resolved[key] ?? resolved[legacy]];
    })
  );
};

const validateClientEnv = (environment, { rootAssetBase = false } = {}) => {
  const missing = required.filter((key) => !environment[key]?.trim());
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  for (const key of ['VITE_FRONTEND_BASE_URL', 'VITE_API_BASE_URL']) {
    let valid = false;
    try {
      valid = ['http:', 'https:'].includes(new URL(environment[key]).protocol);
    } catch {
      // Report the name only; values can contain private configuration.
    }
    if (!valid) throw new Error(`Expected an absolute HTTP(S) URL for ${key}`);
  }
  // RestClient appends relative endpoint paths directly to this value.
  const apiUrl = new URL(environment.VITE_API_BASE_URL);
  if (!environment.VITE_API_BASE_URL.endsWith('/') || apiUrl.search || apiUrl.hash) {
    throw new Error('VITE_API_BASE_URL must end with / and contain no query string or fragment');
  }
  if (rootAssetBase && environment.VITE_PUBLIC_URL && environment.VITE_PUBLIC_URL !== '/') {
    let valid = false;
    try {
      const base = new URL(environment.VITE_PUBLIC_URL);
      valid =
        !/[?#\\\s]/u.test(environment.VITE_PUBLIC_URL) &&
        base.origin === new URL(environment.VITE_FRONTEND_BASE_URL).origin &&
        base.pathname === '/' &&
        !base.search &&
        !base.hash &&
        !base.username &&
        !base.password;
    } catch {
      // Relative asset bases cannot serve nested frontend routes in this image.
    }
    if (!valid) {
      throw new Error('Docker requires VITE_PUBLIC_URL to be empty, /, or the frontend origin without a path');
    }
  }
````

</details>

<a id="evidence-055"></a>

### evidence-055: `proj-ehadj-ui/skills/frontend/full-feature-validation/SKILL.md`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–17:

````text
---
name: full-feature-validation
description: Validate complete frontend user-visible flows before marking work complete.
---

# Full Feature Validation

Use before marking meaningful frontend work complete.

## Steps

1. Identify the complete user workflow, not only the touched component.
2. Verify route access, loading, empty, error, success, pagination, filtering, export, modal, and responsive states that apply.
3. Check API consumption and cache invalidation through the existing React Query and REST client patterns.
4. Run relevant behavioral regression tests through the existing feature interfaces. Use focused Jest tests for affected logic, `npm run test:config` for environment loading, and `npm run test:browser` when browser navigation, downloads, security or rendering behavior is affected. Use an isolated synthetic build for browser checks and respect remote-write authorization. Broaden testing when the changed scope or a failure warrants it.
5. Run `npm run verify` for code changes; this command runs lint and build, not tests. For documentation-only changes, check diffs, links and source consistency instead.
6. Report commands/results and any unverified integration or role-specific behavior. Missing external access blocks only the dependent check; complete independent validation.
````

</details>

<a id="evidence-056"></a>

### evidence-056: `proj-ehadj-ui/src`

Observed immediate directory entries (names only):

```text
App/
assets/
components/
context/
data/
helpers/
hooks/
index.jsx
lib/
locales/
pages/
public/
reportWebVitals.js
setupTests.js
test/
```

<a id="evidence-057"></a>

### evidence-057: `proj-ehadj-ui/src/App/Root.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 18–83:

````text
const mutationCache = new MutationCache({
  /* In case of an error, the onError configuration option is called with the parameters error, _variables, _context, mutation
   * - error represents the error that occurred during the mutation
   * - _variables represent the variables passed to the mutation (optional, used as needed)
   * - _context represents the context of the mutation (optional, used as needed)
   * - mutation contains information about the current mutation
   */
  onError: (error, _variables, _context, mutation) => {
    // This condition checks if the current mutation has a specific onError function defined in its options
    if (!mutation.options.onError) {
      toast.error(typeof error === 'string' ? error : 'Oups ! Une erreur est survenue.');
    }
  },
});

// Creation of a QueryClient instance with default options for queries
const queryClient = new QueryClient({
  // Defines the default options to be used for all queries that will be made
  defaultOptions: {
    queries: {
      staleTime: 60 * 60 * 1000, // Time to live for cached data (in milliseconds)
      cacheTime: 48 * 60 * 60 * 1000, // Time to retain cached data (in milliseconds)
      enabled: !!token, // Enables queries if a user token is present
      refetchOnMount: false, // Don’t refetch the data every time the component remounts (use cached data)
      refetchOnWindowFocus: false, // Don’t refetch when the browser window regains focus (use cached data)
      refetchOnReconnect: false, // Don’t refetch when the user’s internet connection is restored.
    },
  },
  mutationCache, // Using the previously configured mutation cache
});

const AppRoot = () => {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('eHadj-session-expired') === 'true') {
        sessionStorage.removeItem('eHadj-session-expired');
        toast.error('Votre session a expiré. Veuillez vous reconnecter.');
      }
    } catch {
      // The notification is optional when browser storage is unavailable.
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RestClientProvider>
        <UserProvider>
          <PermissionsProvider>
            <PreferencesProvider>
              <TooltipProvider delayDuration={500}>
                <HelmetProvider>
                  <Sentry.ErrorBoundary>
                    <App />
                    <Toaster position="bottom-right" richColors />
                  </Sentry.ErrorBoundary>
                </HelmetProvider>
              </TooltipProvider>
            </PreferencesProvider>
          </PermissionsProvider>
        </UserProvider>
      </RestClientProvider>
    </QueryClientProvider>
  );
};

export default AppRoot;
````

</details>

<a id="evidence-058"></a>

### evidence-058: `proj-ehadj-ui/src/App/logout.test.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 18–55:

````text

jest.mock('axios');
jest.mock('components/shared/Sidebar', () => () => null);
jest.mock('components/shared/AuthSidebar', () => () => null);
jest.mock('components/shared/PermissionStatus', () => () => null);
jest.mock('components/ui/sidebar', () => {
  const MockSidebarProvider = ({ children }) => children;
  MockSidebarProvider.propTypes = { children: require('prop-types').node };
  return { SidebarProvider: MockSidebarProvider };
});

let container;
let root;
let client;
let router;
let finishRevocation;
let revokedTokens;

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  finishSameTabLogout();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('eHadj--user_token', 'synthetic-old-session');
  localStorage.setItem('eHadj--legal_downloaded', 'true');
  localStorage.setItem('eHadj--legal_toast_displayed', 'true');
  revokedTokens = [];
  axios.request.mockImplementation(({ method, auth }) => {
    if (method === 'delete') {
      revokedTokens.push(auth.username);
      if (revokedTokens.length === 1)
        return new Promise((resolve) => {
          finishRevocation = resolve;
        });
      return Promise.resolve({ status: 204 });
    }
    return Promise.resolve({ status: 200, data: { id: 'synthetic-user', is_onboard: true } });
  });
````

</details>

<a id="evidence-059"></a>

### evidence-059: `proj-ehadj-ui/src/App/router.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 31–81:

````text
const RoutePage = ({ Page, allowed, scoped = false }) => {
  const user = useGetUser();
  const key = scoped && user.isAGLO ? `${user.user?.id}:${user.activeOrganizationId}:${user.activeRole}` : 'other-role';
  return (
    <ProtectedRoute isAllowed={allowed(user)}>
      <Page key={key} />
    </ProtectedRoute>
  );
};

const connected = (user) => user.isConnected;
const guest = (user) => !user.isConnected;
const any = () => true;
const UnknownRoute = () => <RoutePage Page={Error404} allowed={connected} />;

export const createAppRouter = ({ history, RootComponent }) => {
  const rootRoute = createRootRoute({ component: RootComponent, notFoundComponent: UnknownRoute });
  const page = (path, Page, allowed = any, scoped = false) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => <RoutePage Page={Page} allowed={allowed} scoped={scoped} />,
    });
  return createRouter({
    history,
    parseSearch,
    stringifySearch,
    defaultPreload: false,
    scrollRestoration: false,
    routeTree: rootRoute.addChildren([
      page(Urls.base, Home),
      page(Urls.register, Register, guest),
      page(Urls.front.login, Login, guest),
      page(Urls.front.password.forgot, ForgotPassword, guest),
      page(Urls.front.password.reset, ResetPassword, guest),
      page(Urls.front.logout, Logout),
      page(Urls.cgu, Cgu),
      page(Urls.legal_mention, LegalMention),
      page(Urls.cookie_policy, CookiePolicy),
      page(Urls.invoice, Invoice, (u) => u.isConnected && (u.isAGLO || u.isBank || u.isAgency), true),
      page(Urls.agency, Agency, (u) => u.isConnected && u.isAGLO),
      page(Urls.preferences, Preferences, (u) => u.isConnected && (u.isSuperAdmin || u.isAGLO)),
      page(Urls.trip, Trip, (u) => u.isConnected && (u.isAgency || u.isAGLO || u.isMS || u.isDEI || u.isMAEC), true),
      page(Urls.authorization, Authorization, (u) => u.isConnected && u.isAgencyPrimary),
      page(Urls.dashboard, Dashboard, (u) => u.isConnected && u.canAccessDashboard),
      page(Urls.user, User, (u) => u.isConnected && u.isPrimaryUser),
      page(Urls.userProfile, UserProfile, connected),
      page(Urls.assignation, AgencyAssignation, (u) => u.isConnected && u.isAGLO),
      page(Urls.profile.base, Profile, (u) => u.isConnected && u.isPilgrim),
      page(`${Urls.profile.base}/$key`, Profile, (u) => u.isConnected && u.isPilgrim),
      page(Urls.group, Group, (u) => u.isConnected && (u.isAgency || u.isAGLO), true),
````

</details>

<a id="evidence-060"></a>

### evidence-060: `proj-ehadj-ui/src/App/router.test.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 14–55:

````text

test('list search preserves string values, repeated parameters and back/forward history', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const Filters = () => {
    const [params, setParams] = useUrlSearchParams();
    return (
      <>
        <output>
          {params.get('q')}|{params.get('flag')}|{params.getAll('tag').join(',')}
        </output>
        <button
          onClick={() => {
            const next = new URLSearchParams(params);
            next.set('q', 'new value');
            setParams(next);
          }}
        >
          Search
        </button>
        <Link to="/other">Other page</Link>
      </>
    );
  };
  const rootRoute = createRootRoute({ component: Outlet });
  const history = createMemoryHistory({ initialEntries: ['/list?q=001&flag=false&tag=a&tag=b'] });
  const router = createRouter({
    history,
    parseSearch,
    stringifySearch,
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/list', component: Filters }),
      createRoute({ getParentRoute: () => rootRoute, path: '/other', component: () => <p>Other</p> }),
    ]),
  });
  try {
    await act(async () => {
      root.render(<RouterProvider router={router} />);
    });
    expect(container.querySelector('output').textContent).toBe('001|false|a,b');
````

</details>

<a id="evidence-061"></a>

### evidence-061: `proj-ehadj-ui/src/components/ui/button.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 7–45:

````text
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        hajj: 'bg-hajj-primary hover:bg-hajj-secondary text-white rounded-md shadow-lg shadow-hajj-primary/20 hover:shadow-xl hover:shadow-hajj-primary/30 transition-all duration-200',
        'modal-primary':
          'border border-[#287c50] bg-[#287c50] text-white shadow-none hover:border-[#17613d] hover:bg-[#17613d] disabled:border-[#80aa91] disabled:bg-[#80aa91] disabled:text-white disabled:opacity-100',
        'modal-secondary': 'border border-[#d7dfda] bg-white text-[#33463b] shadow-none hover:bg-[#f4f7f5]',
        disabled: 'bg-gray-300 text-gray-600 cursor-not-allowed',
      },
      size: {
        default: 'h-9 px-2.5 py-2',
        sm: 'h-8 rounded-md px-2.5',
        lg: 'h-10 rounded-md px-2.5',
        icon: 'h-9 w-9',
        modal: 'min-h-9 rounded-[8px] px-[14px] py-[7px] text-sm leading-5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = 'Button';

export { Button, buttonVariants };
````

</details>

<a id="evidence-062"></a>

### evidence-062: `proj-ehadj-ui/src/components/ui/input.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 6–34:

````text
const inputVariants = cva(
  'flex w-full rounded-md px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm placeholder:text-gray-500',
  {
    variants: {
      variant: {
        default: 'border border-input bg-background',
        hajj: 'bg-white/80 backdrop-blur-sm border focus:border-hajj-primary focus:ring-4 focus:ring-hajj-primary/10 transition-all duration-200 rounded-sm-xl',
        subtle: 'border-transparent bg-muted/10',
        disabled: 'bg-muted/50 text-muted-foreground cursor-not-allowed border-2',
      },
      size: {
        default: 'h-10',
        lg: 'h-14 text-lg',
        sm: 'h-10 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const Input = forwardRef(({ className, variant, size, type = 'text', ...props }, ref) => {
  return <input type={type} className={cn(inputVariants({ variant, size }), className)} ref={ref} {...props} />;
});
Input.displayName = 'Input';

export { Input, inputVariants };
````

</details>

<a id="evidence-063"></a>

### evidence-063: `proj-ehadj-ui/src/components/ui/label.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 7–14:

````text
const labelVariants = cva('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70');

const Label = forwardRef(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
));
Label.displayName = LabelPrimitive.Root.displayName;

export { Label };
````

</details>

<a id="evidence-064"></a>

### evidence-064: `proj-ehadj-ui/src/context/PermissionsContext.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 3–3:

````text
export const PermissionsContext = createContext({});
````

</details>

<a id="evidence-065"></a>

### evidence-065: `proj-ehadj-ui/src/context/RestClientProvider.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 15–36:

````text
const getRestClient = () => {
  const storage = new Storage(localStorage, 'eHadj-');
  const token = storage.get(CONST_USER_TOKEN);

  return new RestClient(Params.API_BASE_URL, token, onLogout);
};

export const RestClientContext = React.createContext({});

const RestClientProvider = ({ children }) => {
  const api = getRestClient();

  const memoValues = useMemo(() => ({ api }), [api]);

  return <RestClientContext.Provider value={memoValues}>{children}</RestClientContext.Provider>;
};

RestClientProvider.propTypes = {
  children: PropTypes.node,
};

export default RestClientProvider;
````

</details>

<a id="evidence-066"></a>

### evidence-066: `proj-ehadj-ui/src/context/UserProvider.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 13–86:

````text
const UserProvider = ({ children }) => {
  const storage = useMemo(() => new Storage(localStorage, 'eHadj-'), []);
  const [user, setUserState] = useState(() => {
    storage.remove(CONST_USER);
    return null;
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const token = storage.get(CONST_USER_TOKEN);
  const isConnected = !!token;
  const api = useMemo(() => new RestClient(Params.API_BASE_URL, token, onLogout), [token]);

  // UserProvider owns session state only.
  // The actual RBAC derivation lives in `src/helpers/userRoles.js`, where we:
  // 1. normalize the multi-organization payload,
  // 2. resolve the active organization and the role paired with it,
  // 3. expose the boolean flags used by pages and route guards.
  const roleState = useMemo(() => buildUserRoleState(user), [user]);

  const setCurrentUser = useCallback((nextUser) => setUserState(nextUser || null), []);
  useCrossTabLogout(token, setCurrentUser, setIsLoggingOut);

  const refreshCurrentUser = useCallback(
    async ({ includeErrorStatus = false } = {}) => {
      // We always re-fetch after session-sensitive mutations (for example org
      // switching) instead of inferring the next RBAC state locally.
      if (!token) {
        return null;
      }

      const { data } = await api.get('user/current/', { includeErrorStatus });
      if (storage.get(CONST_USER_TOKEN) !== token) return null;
      setCurrentUser(data);
      return data;
    },
    [api, setCurrentUser, storage, token]
  );

  // Use react-query to handle the on-mount fetch instead of a bare useEffect.
  const currentUserQuery = useQuery({
    queryKey: ['user', 'current'],
    queryFn: () => refreshCurrentUser({ includeErrorStatus: true }),
    enabled: isConnected,
    retry: false,
  });

  const isUserReady = !isConnected || Boolean(user);
  const isCurrentUserLoading = Boolean(isConnected && !user && currentUserQuery.isFetching);
  const currentUserError = !user && currentUserQuery.isError ? currentUserQuery.error : null;

  const memoValues = useMemo(
    () => ({
      user,
      ...roleState,
      currentUserEmail: user?.email,
      currentUserLastname: user?.last_name,
      currentUserFirstname: user?.first_name,
      isConnected,
      isLoggingOut,
      isUserReady,
      isCurrentUserLoading,
      currentUserError,
      isOnboarded: user?.is_onboard,
      setCurrentUser,
      refreshCurrentUser,
      retryCurrentUser: currentUserQuery.refetch,
    }),
    [
      currentUserError,
      currentUserQuery.refetch,
      isConnected,
      isLoggingOut,
      isCurrentUserLoading,
      isUserReady,
      refreshCurrentUser,
````

</details>

<a id="evidence-067"></a>

### evidence-067: `proj-ehadj-ui/src/context/UserProvider.test.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 7–61:

````text
const mockGetCurrentUser = jest.fn();
const mockApi = { get: (...args) => mockGetCurrentUser(...args) };

jest.mock('helpers', () => {
  class MockStorage {
    constructor(engine, prefix) {
      this.engine = engine;
      this.prefix = prefix;
    }

    get(key) {
      return this.engine.getItem(`${this.prefix}-${key}`);
    }

    remove(key) {
      return this.engine.removeItem(`${this.prefix}-${key}`);
    }
  }

  return {
    RestClient: function MockRestClient() {
      return mockApi;
    },
    Storage: MockStorage,
    buildUserRoleState: () => ({}),
    onLogout: jest.fn(),
  };
});

const Probe = () => {
  const { user, isCurrentUserLoading, isLoggingOut, currentUserError, retryCurrentUser } = useContext(UserContext);
  return (
    <div>
      <span data-testid="user">{user?.email || ''}</span>
      <span data-testid="loading">{String(isCurrentUserLoading)}</span>
      <span data-testid="error">{currentUserError ? 'error' : ''}</span>
      <span data-testid="logging-out">{String(isLoggingOut)}</span>
      <button type="button" onClick={retryCurrentUser}>
        Retry
      </button>
    </div>
  );
};

let container;
let root;
let queryClient;

const renderProvider = async () => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <UserProvider>
          <Probe />
        </UserProvider>
````

</details>

<a id="evidence-068"></a>

### evidence-068: `proj-ehadj-ui/src/data/Params.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–6:

````text
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const Params = {
  API_BASE_URL,
};

export default Params;
````

</details>

<a id="evidence-069"></a>

### evidence-069: `proj-ehadj-ui/src/data/Urls.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–32:

````text
const Urls = {
  base: '/',
  front: {
    login: '/login',
    password: {
      reset: '/reset-password',
      forgot: '/forgot-password',
    },
    logout: '/logout',
  },
  apikey: '/api-key',
  trip: '/trip',
  authorization: '/authorisation',
  dashboard: '/dashboard',
  preferences: '/preferences',
  agency: '/agency',
  invoice: '/invoice',
  user: '/user',
  userProfile: '/user-profile',
  legal_mention: '/mention-legal',
  cgu: '/cgu',
  cookie_policy: '/cookie-policy',
  profile: {
    base: '/profile',
    object: '/profile/:key',
  },
  assignation: '/assignation',
  register: '/register',
  group: '/groupes',
};

export default Urls;
````

</details>

<a id="evidence-070"></a>

### evidence-070: `proj-ehadj-ui/src/helpers/RestClient/exceptions.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 2–29:

````text
class ExtendableError extends Error {
  constructor(message) {
    super(message);
    this.name = this.constructor.name;
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    } else {
      this.stack = new Error(message).stack;
    }
  }
}

export class APIError extends ExtendableError {}

export class APIError400BadRequest extends APIError {}
export class APIError403Forbidden extends APIError {}
export class APIError404NotFound extends APIError {}
export class APIError409Conflict extends APIError {}
export class APIError50XServerError extends APIError {}

/**
 *
 * @param {object} apiError object return by a fail API call
 * @returns {Promise} a Promise
 */
export async function raiseAPIError(apiError) {
  return Promise.reject(apiError.data.detail);
}
````

</details>

<a id="evidence-071"></a>

### evidence-071: `proj-ehadj-ui/src/helpers/RestClient/index.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 13–31:

````text
const handleListData = ({ data }) => {
  if (data.object === 'list') {
    const arrayData = data.data;
    arrayData.object = data.object;
    arrayData.count = data.count;
    arrayData.next = data.next;
    arrayData.previous = data.previous;
    return Promise.resolve(arrayData);
  }
  return Promise.resolve({ data });
};

export default class RestClient {
  #baseUrl = '';

  #authToken = '';

  #onLogout = null;

````

Original lines 33–48:

````text

  /**
   * Cache the request params before making the call.
   * Used to build the storageKey
   */
  requestParams = null;

  constructor(baseUrl, token, onLogout) {
    this.#baseUrl = baseUrl;
    this.#authToken = token;
    this.#onLogout = onLogout;
  }

  /**
   * Config for REST method call
   *
````

Original lines 88–158:

````text
    if (this.#authToken) {
      updatedAxiosConfig.auth = { username: this.#authToken, password: '' };
    }

    try {
      return await axios.request(updatedAxiosConfig);
    } catch (err) {
      if (err.response?.status === 401 && this.#authToken) {
        this.#onLogout({
          requestToken: this.#authToken,
          sessionExpired: [
            'Session expirée. Veuillez vous reconnecter.',
            'Session has expired',
            'Invalid or expired authentication credentials',
          ].includes(err.response?.data?.detail),
        });
      } else if (includeErrorStatus && err.response) {
        // Session recovery needs the status, but not Axios request credentials or headers.
        return Promise.reject({ status: err.response.status, detail: err.response.data?.detail });
      } else if (err.response?.data?.detail) {
        return raiseAPIError(err.response);
      }
      return Promise.reject(err);
    }
  }

  /** REST API methods */

  /**
   * Rest: Get
   *
   * @param {string} url Request URL or path
   * @param {object} config Additional axios config
   * @returns {Promise} Response of the request
   */
  async get(url, config) {
    const conf = { ...(config || {}), ...{ url, method: 'get' } };
    return this.#request(conf);
  }

  /**
   * Rest: Delete
   *
   * @param {string} url Request URL or path
   * @param {object} config Additional axios config
   * @returns {Promise} Response of the request
   */
  async delete(url, config) {
    const conf = { ...(config || {}), ...{ url, method: 'delete' } };
    return this.#request(conf);
  }

  /**
   * Rest: Post
   *
   * @param {string} url Request URL or path
   * @param {object} data data to POST
   * @param {object} config Additional axios config
   * @returns {Promise} Response of the request
   */
  async post(url, data, config) {
    const conf = { ...(config || {}), ...{ url, data, method: 'post' } };
    return this.#request(conf);
  }

  /**
   * Rest: Put
   *
   * @param {string} url Request URL or path
   * @param {object} data data to PUT
   * @param {object} config Additional axios config
````

Original lines 212–247:

````text
  async create(objectURI, data) {
    const url = `${objectURI}`;
    return this.post(url, data);
  }

  /**
   * Call to update a resource
   *
   * @param {string} objectURI API object relative URI or path
   * @param {object} data object to update
   * @param {string} id resource id
   * @returns {Promise} Response of the request
   */
  async update(objectURI, data, id = 'current') {
    const url = `${objectURI}/${id}/`;
    return this.put(url, data);
  }

  /**
   * Call to update an existing file
   *
   * @param {string} objectURI API object relative URI or path
   * @param {string} field object key
   * @param {Array} files an array of Files
   * @param {string} id resource id
   * @param {boolean} useRessourceId whether or not to use path to ressource id
   * @returns {Promise} Response of the request
   */
  async updateFile(objectURI, field, files, id = 'current', useRessourceId = true) {
    const url = useRessourceId ? `${objectURI}/${id}/file` : objectURI;
    const formData = new FormData();
    Object.values(files).forEach((file) => {
      if (file instanceof File) {
        formData.append(field, file);
      }
    });
````

Original lines 259–284:

````text
  retrieve(objectURI, id = 'current', params = {}) {
    if (!id) return Promise.resolve({ data: null });
    const path = `${objectURI}/${id}`;
    this.requestParams = { method: 'GET', params, path };
    return async () => {
      const { data } = await this.get(path, { params });
      return data;
    };
  }

  /**
   * Prepare a call to list resources
   *
   * @param {string} objectURI API object relative URI or path
   * @param {object} params Query parameters
   * @returns {Promise} a promise
   */
  list(objectURI, params = {}) {
    const paramsWithDefaults = { ...{ limit: 60 }, ...params };
    this.requestParams = { method: 'GET', params: paramsWithDefaults, path: objectURI };
    return async () => {
      const response = await this.get(objectURI, { params: paramsWithDefaults });
      return handleListData(response);
    };
  }
}
````

</details>

<a id="evidence-072"></a>

### evidence-072: `proj-ehadj-ui/src/helpers/RestClient/index.test.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 3–28:

````text

jest.mock('axios');

test('session loading can distinguish an inactive account without exposing request credentials in its error', async () => {
  const onLogout = jest.fn();
  const api = new RestClient('/api/v1/', 'synthetic-session', onLogout);
  axios.request.mockRejectedValueOnce({
    response: { status: 403, data: { detail: 'Votre compte est inactif.' } },
    config: { auth: { username: 'synthetic-session', password: '' } },
  });
  await expect(api.get('user/current/', { includeErrorStatus: true })).rejects.toEqual({
    status: 403,
    detail: 'Votre compte est inactif.',
  });
  expect(onLogout).not.toHaveBeenCalled();
});

test('ordinary API consumers retain their existing detail-only errors', async () => {
  const api = new RestClient('/api/v1/', null, jest.fn());
  axios.request.mockRejectedValueOnce({
    response: { status: 429, data: { detail: 'Trop de tentatives. Veuillez réessayer plus tard.' } },
  });
  await expect(api.post('auth/user_token/verify_otp/', {})).rejects.toBe(
    'Trop de tentatives. Veuillez réessayer plus tard.'
  );
});
````

</details>

<a id="evidence-073"></a>

### evidence-073: `proj-ehadj-ui/src/helpers/Storage.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–37:

````text
class Storage {
  #engine = null;

  #prefix = '';

  constructor(engine, prefix) {
    this.#engine = engine;
    this.#prefix = prefix;
  }

  get(key) {
    return this.#engine.getItem(`${this.#prefix}-${key}`);
  }

  set(key, value) {
    return this.#engine.setItem(`${this.#prefix}-${key}`, value);
  }

  getData(key) {
    const data = this.get(key);
    return data != null && data !== 'undefined' ? JSON.parse(data) : null;
  }

  setData(key, value) {
    return this.set(key, JSON.stringify(value));
  }

  remove(key) {
    return this.#engine.removeItem(`${this.#prefix}-${key}`);
  }

  clear() {
    this.#engine.clear();
  }
}

export default Storage;
````

</details>

<a id="evidence-074"></a>

### evidence-074: `proj-ehadj-ui/src/helpers/logout.test.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 8–62:

````text
const storage = new Storage(localStorage, 'eHadj-');
const originalLocation = window.location;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  delete window.location;
  window.location = '/logout';
  storage.set('user_token', 'synthetic-session');
  storage.set('legal_accepted', 'true');
  storage.set('legal_downloaded', 'true');
  storage.set('legal_toast_displayed', 'true');
  storage.set('legal_acceptance_date', 'synthetic-date');
  storage.set('already_done_onboarding', 'true');
  sessionStorage.setItem('eHadj-password-reset', 'synthetic-reset');
});

afterEach(() => {
  window.location = originalLocation;
});

test('clears local credentials before revocation finishes and preserves the existing logout outcome', async () => {
  let finishRevocation;
  axios.request.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRevocation = resolve;
      })
  );

  const pending = onLogout();

  expect(axios.request).toHaveBeenCalledWith(
    expect.objectContaining({
      method: 'delete',
      url: expect.stringMatching(/auth\/user_token\/synthetic-session\/$/),
      auth: { username: 'synthetic-session', password: '' },
    })
  );
  const tokenDuringRevocation = storage.get('user_token');
  const resetSessionDuringRevocation = sessionStorage.getItem('eHadj-password-reset');
  const locationDuringRevocation = window.location;

  finishRevocation({ status: 204 });
  await pending;

  expect(tokenDuringRevocation).toBeNull();
  expect(resetSessionDuringRevocation).toBeNull();
  expect(locationDuringRevocation).toBe('/logout');
  expect(storage.get('user_token')).toBeNull();
  expect(sessionStorage.getItem('eHadj-password-reset')).toBeNull();
  expect(storage.getData('legal_accepted')).toBe(true);
  expect(storage.getData('legal_downloaded')).toBe(true);
  expect(storage.getData('legal_toast_displayed')).toBe(true);
  expect(storage.get('legal_acceptance_date')).toBe('synthetic-date');
````

</details>

<a id="evidence-075"></a>

### evidence-075: `proj-ehadj-ui/src/helpers/passwordResetSession.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–34:

````text
const KEY = 'eHadj-password-reset';
const MAX_AGE = 30 * 60 * 1000;

export const clearPasswordResetSession = () => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Memory-only retry remains available when storage is blocked. */
  }
};

export const readPasswordResetSession = (search) => {
  const params = new URLSearchParams(search);
  if (params.has('token') || params.has('email')) {
    return { token: params.get('token') || '', email: params.get('email') || '', expiresAt: Date.now() + MAX_AGE };
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY));
    if (typeof saved?.token === 'string' && saved.token && saved.expiresAt > Date.now()) return saved;
  } catch {
    /* Missing or invalid tab storage requires opening the reset link again. */
  }
  return { token: '', email: '', expiresAt: 0 };
};

export const savePasswordResetSession = (credentials) => {
  clearPasswordResetSession();
  if (!credentials.token || credentials.expiresAt <= Date.now()) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(credentials));
  } catch {
    /* Keep same-page retry in React memory. */
  }
};
````

</details>

<a id="evidence-076"></a>

### evidence-076: `proj-ehadj-ui/src/helpers/passwordResetSession.test.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 2–25:

````text

afterEach(() => {
  sessionStorage.clear();
  jest.restoreAllMocks();
});
test('retains a reset link in tab storage for reload and removes it on completion', () => {
  const credentials = readPasswordResetSession('token=synthetic-reset&email=test%40example.invalid');
  savePasswordResetSession(credentials);
  expect(readPasswordResetSession('').token).toBe('synthetic-reset');
  clearPasswordResetSession();
  expect(readPasswordResetSession('').token).toBe('');
});
test('an explicit empty link cannot reuse an older reset token', () => {
  savePasswordResetSession(readPasswordResetSession('token=synthetic-old'));
  expect(readPasswordResetSession('token=').token).toBe('');
});
test('expired and malformed stored reset credentials are not restored', () => {
  jest.spyOn(Date, 'now').mockReturnValue(1000);
  savePasswordResetSession(readPasswordResetSession('token=synthetic-reset'));
  Date.now.mockReturnValue(1000 + 31 * 60 * 1000);
  expect(readPasswordResetSession('').token).toBe('');
  sessionStorage.setItem('eHadj-password-reset', 'invalid');
  expect(readPasswordResetSession('').token).toBe('');
});
````

</details>

<a id="evidence-077"></a>

### evidence-077: `proj-ehadj-ui/src/helpers/queryScope.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–16:

````text
const normalizeScopeValue = (value) => value ?? null;

export const getIdentityQueryScope = ({ userId, organizationId, role }) => [
  {
    userId: normalizeScopeValue(userId),
    organizationId: normalizeScopeValue(organizationId),
    role: normalizeScopeValue(role),
  },
];

export const getAuthenticatedQueryScope = ({ userId, organizationId, role, campaignYear }) => [
  {
    ...getIdentityQueryScope({ userId, organizationId, role })[0],
    campaignYear: normalizeScopeValue(campaignYear),
  },
];
````

</details>

<a id="evidence-078"></a>

### evidence-078: `proj-ehadj-ui/src/helpers/utils.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 113–148:

````text
const revokeSessionAndLogout = async ({ token, sessionExpired = false }) => {
  const retainedValues = {
    [CONST_LEGAL_ACCEPTED]: readRetainedBoolean(CONST_LEGAL_ACCEPTED),
    [CONST_LEGAL_DOWNLOADED]: readRetainedBoolean(CONST_LEGAL_DOWNLOADED),
    [CONST_LEGAL_TOAST_DISPLAYED]: readRetainedBoolean(CONST_LEGAL_TOAST_DISPLAYED),
    [CONST_LEGAL_ACCEPTANCE_DATE]: readRetainedString(CONST_LEGAL_ACCEPTANCE_DATE),
    [CONST_ALREADY_DONE_ONBOARDING]: readRetainedBoolean(CONST_ALREADY_DONE_ONBOARDING),
  };

  clearPasswordResetSession();
  storage.clear();
  Object.entries(retainedValues).forEach(([key, value]) => restoreRetainedValue(key, value));
  if (sessionExpired) {
    try {
      sessionStorage.setItem('eHadj-session-expired', 'true');
    } catch {
      // Storage restrictions must not prevent sign-out.
    }
  }
  notifySameTabLogout();

  if (token) {
    // A rejected revocation must not recursively invoke logout on a 401.
    const api = new RestClient(Params.API_BASE_URL, token, () => {});
    try {
      await api.delete(`auth/user_token/${encodeURIComponent(token)}/`, { timeout: 5000 });
    } catch {
      // Keep local sign-out available when the API is unreachable or the session has expired.
    }
  }
  // A replacement login established while revocation was in flight owns this tab now.
  if (storage.get('user_token')) {
    finishSameTabLogout();
    return;
  }
  window.location = Urls.base;
````

Original lines 153–188:

````text
export const onLogout = (options = {}) => {
  const token = storage.get('user_token');
  if (options.requestToken !== undefined && options.requestToken !== token) return Promise.resolve();
  if (token && pendingLogouts.has(token)) return pendingLogouts.get(token);
  if (!token && pendingLogouts.size > 0) return Array.from(pendingLogouts.values()).at(-1);

  const pendingLogout = revokeSessionAndLogout({ token, sessionExpired: options.sessionExpired }).finally(() => {
    pendingLogouts.delete(token);
  });
  pendingLogouts.set(token, pendingLogout);
  return pendingLogout;
};

/**
 * Get a username based on firstname and lastname
 *
 * @param {string} firstname user firstname
 * @param {string} lastname user lastname
 * @returns {string} a concatenation of firstname and lastname separated by a space
 */
export const getUserName = (firstname, lastname) => `${firstname} ${lastname}`;

/**
 *
 * @param {object} e the keydown event of the input
 */
export const preventSubmitWithENTER = (e) => {
  if (e.keyCode === 13) {
    e.preventDefault(); // prevent ENTER from submitting the form, thus reloading the page
  }
};

export const renderCGUContent = (contentArray, parentKey) => {
  return contentArray.map((paragraph) => {
    if (typeof paragraph === 'string') {
      return (
````

</details>

<a id="evidence-079"></a>

### evidence-079: `proj-ehadj-ui/src/hooks/useAPI.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 9–13:

````text
function useAPI() {
  return useContext(RestClientContext);
}

export default useAPI;
````

</details>

<a id="evidence-080"></a>

### evidence-080: `proj-ehadj-ui/src/hooks/useAuthenticatedQueryScope.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 6–34:

````text
export const useIdentityQueryScope = () => {
  const { user, activeOrganizationId, activeRole } = useGetUser();
  return {
    isScopeReady: user?.id != null,
    scope: getIdentityQueryScope({
      userId: user?.id,
      organizationId: activeOrganizationId,
      role: activeRole,
    }),
  };
};

const useAuthenticatedQueryScope = () => {
  const { user, activeOrganizationId, activeRole, isAGLO } = useGetUser();
  const { campaignYear, selectedCampaignYear } = useContext(PreferencesContext);
  const effectiveCampaignYear = isAGLO ? selectedCampaignYear ?? campaignYear : campaignYear;

  return {
    isScopeReady: user?.id != null && effectiveCampaignYear != null,
    scope: getAuthenticatedQueryScope({
      userId: user?.id,
      organizationId: activeOrganizationId,
      role: activeRole,
      campaignYear: effectiveCampaignYear,
    }),
  };
};

export default useAuthenticatedQueryScope;
````

</details>

<a id="evidence-081"></a>

### evidence-081: `proj-ehadj-ui/src/hooks/useAuthenticatedQueryScope.test.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 10–64:

````text
const request = jest.fn();

const Probe = () => {
  const { scope, isScopeReady } = useAuthenticatedQueryScope();
  useQuery({ queryKey: ['records', ...scope], queryFn: request, enabled: isScopeReady });
  return <span data-testid="ready">{String(isScopeReady)}</span>;
};

let container;
let root;
let client;

const renderProbe = async (preferences) => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <PreferencesContext.Provider value={preferences}>
          <Probe />
        </PreferencesContext.Provider>
      </QueryClientProvider>
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  request.mockResolvedValue(['scoped result']);
  useGetUser.mockReturnValue({
    user: { id: 'user-without-organization' },
    activeOrganizationId: null,
    activeRole: null,
    isAGLO: false,
  });
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  jest.clearAllMocks();
});

test('waits for campaign context while allowing an account without an organization', async () => {
  await renderProbe({});
  expect(container.querySelector('[data-testid="ready"]').textContent).toBe('false');
  expect(request).not.toHaveBeenCalled();

  await renderProbe({ campaignYear: 2026 });
  expect(container.querySelector('[data-testid="ready"]').textContent).toBe('true');
  expect(request).toHaveBeenCalledTimes(1);
````

</details>

<a id="evidence-082"></a>

### evidence-082: `proj-ehadj-ui/src/hooks/useCrossTabLogout.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 13–67:

````text
const useCrossTabLogout = (token, clearUser, setIsLoggingOut) => {
  const queryClient = useQueryClient();
  useEffect(() => {
    let synchronizing = false;
    let organizationRevision = localStorage.getItem(ORGANIZATION_REVISION_KEY);
    const clearProtectedState = () => {
      queryClient.cancelQueries();
      clearUser(null);
      queryClient.clear();
    };
    const synchronize = () => {
      if (synchronizing) return;
      if (localStorage.getItem(SESSION_TOKEN_KEY) !== token) {
        synchronizing = true;
        clearProtectedState();
        clearPasswordResetSession();
        window.location.replace('/');
        return;
      }

      if (!token) return;
      const currentOrganizationRevision = localStorage.getItem(ORGANIZATION_REVISION_KEY);
      if (currentOrganizationRevision === organizationRevision) return;
      organizationRevision = currentOrganizationRevision;
      synchronizing = true;
      clearProtectedState();
      reloadBrowserPage();
    };
    const onSameTabLogout = () => {
      if (synchronizing) return;
      synchronizing = true;
      setIsLoggingOut(true);
      clearProtectedState();
    };
    const onSameTabLogoutFinished = () => {
      synchronizing = false;
      setIsLoggingOut(false);
    };
    const onStorage = (event) => {
      if (
        event.storageArea === localStorage &&
        (event.key === null || event.key === SESSION_TOKEN_KEY || event.key === ORGANIZATION_REVISION_KEY)
      ) {
        synchronize();
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') synchronize();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', synchronize);
    window.addEventListener('pageshow', synchronize);
    window.addEventListener(SESSION_LOGOUT_STARTED_EVENT, onSameTabLogout);
    window.addEventListener(SESSION_LOGOUT_FINISHED_EVENT, onSameTabLogoutFinished);
    document.addEventListener('visibilitychange', onVisible);
````

</details>

<a id="evidence-083"></a>

### evidence-083: `proj-ehadj-ui/src/hooks/useCrossTabLogout.test.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 16–70:

````text
const Probe = ({ clearUser, setIsLoggingOut }) => {
  useCrossTabLogout('session-token', clearUser, setIsLoggingOut);
  return null;
};

Probe.propTypes = {
  clearUser: PropTypes.func.isRequired,
  setIsLoggingOut: PropTypes.func.isRequired,
};

let container;
let root;
let queryClient;
let clearUser;
let setIsLoggingOut;

const renderHook = async () => {
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe clearUser={clearUser} setIsLoggingOut={setIsLoggingOut} />
      </QueryClientProvider>
    );
  });
};

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  localStorage.setItem(SESSION_TOKEN_KEY, 'session-token');
  localStorage.setItem(ORGANIZATION_REVISION_KEY, 'initial-revision');
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(['protected-records'], [{ id: 'old-record' }]);
  clearUser = jest.fn();
  setIsLoggingOut = jest.fn();
});

afterEach(async () => {
  finishSameTabLogout();
  await act(async () => root.unmount());
  queryClient.clear();
  container.remove();
  jest.clearAllMocks();
});

test('observes a same-tab logout that started before the hook subscribed', async () => {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  notifySameTabLogout();

  await renderHook();

  expect(setIsLoggingOut).toHaveBeenCalledWith(true);
````

</details>

<a id="evidence-084"></a>

### evidence-084: `proj-ehadj-ui/src/hooks/useGetUser.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 4–6:

````text
const useGetUser = () => useContext(UserContext);

export default useGetUser;
````

</details>

<a id="evidence-085"></a>

### evidence-085: `proj-ehadj-ui/src/hooks/usePermissionMutation.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 6–18:

````text
const usePermissionMutation = ({ mutationFn, ...options }) => {
  const { isPermissionsReady } = useContext(PermissionsContext);
  return useMutation({
    ...options,
    mutationFn: (...args) => {
      if (isPermissionsReady === false) {
        throw new Error('Impossible de vérifier vos autorisations. Veuillez réessayer.');
      }
      return mutationFn(...args);
    },
  });
};
export default usePermissionMutation;
````

</details>

<a id="evidence-086"></a>

### evidence-086: `proj-ehadj-ui/src/hooks/useUrlSearchParams.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 6–24:

````text
const useUrlSearchParams = () => {
  const search = useLocation({ select: (location) => location.searchStr });
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const navigate = useNavigate();
  const setParams = useCallback(
    (next, options = {}) => {
      const value = typeof next === 'function' ? next(params) : next;
      return navigate({
        search: parseSearch(new URLSearchParams(value).toString()),
        replace: options.replace,
        resetScroll: false,
      });
    },
    [navigate, params]
  );
  return [params, setParams];
};

export default useUrlSearchParams;
````

</details>

<a id="evidence-087"></a>

### evidence-087: `proj-ehadj-ui/src/index.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 10–18:

````text
const router = createAppRouter({ RootComponent: AppRoot });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

reportWebVitals();
````

</details>

<a id="evidence-088"></a>

### evidence-088: `proj-ehadj-ui/src/lib/utils.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 4–8:

````text
const cn = (...inputs) => {
  return twMerge(clsx(inputs));
};

export { cn };
````

</details>

<a id="evidence-089"></a>

### evidence-089: `proj-ehadj-ui/src/pages/ForgotPassword/index.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 16–51:

````text
const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [displayError, setDisplayError] = useState(false);
  const navigate = useNavigate();
  const { api } = useAPI();

  const queryClient = useQueryClient();
  const isMutating = queryClient.isMutating() > 0;

  const { mutate: checkEmail } = useMutation({
    mutationFn: () => api.post('auth/user_token/forgot_password/', { email }),
    onSuccess: () => {
      setDisplayError(false);
      toast.success(Locales.formatString(Locales.auth.forgot_pwd.alert, { email }));
      navigate({ resetScroll: false, to: Urls.front.login });
    },
  });

  const handleForgotPassword = (event) => {
    event.preventDefault();
    const emptyEmailField = email.trim() === '';
    const validEmail = validateEmail(email);
    if (!emptyEmailField && validEmail) {
      setDisplayError(false);
      checkEmail();
    } else {
      setDisplayError(true);
    }
  };

  const isDisabled = email.trim() === '' || isMutating;

  return (
    <AuthPageLayout className="bg-[#f7f9f8] p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-hajj-primary/5 rounded-full blur-3xl animate-pulse" />
````

</details>

<a id="evidence-090"></a>

### evidence-090: `proj-ehadj-ui/src/pages/Group/index.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 60–124:

````text
  const groupsQuery = useQuery({
    queryFn: api.list('trip/', { group_by: 'agency_and_group', ...campaignParams }),
    queryKey: ['trip/groupes/', { group_by: 'agency_and_group', ...campaignParams }, ...campaignScope],
    keepPreviousData: !isAGLO,
    enabled: isScopeReady,
    ...(isAGLO && isCampaignSwitching ? { staleTime: 0 } : {}),
  });

  const { data: groupsData } = groupsQuery;
  useCampaignSwitchStatus([groupsQuery]);

  // only display groups.
  // group_id = null when there are no group
  const groups = groupsData
    ? groupsData.data
        .map((agency) => ({
          ...agency,
          groups: agency.groups.filter((g) => g.group_id !== null),
        }))
        .filter((agency) => agency.groups.length > 0)
    : [];

  const filteredGroups = groups
    ? groups.filter((g) => {
        if (selectedAgency === 'all') return true;
        return String(g.agency_id) === selectedAgency;
      })
    : [];

  const { mutate: deleteGroup } = usePermissionMutation({
    mutationFn: (group) => api.remove('agency/groups', group.group_id),
    onSuccess: (_, deletedGroup) => {
      queryClient.invalidateQueries({ queryKey: ['trip/'] });
      queryClient.invalidateQueries({ queryKey: ['trip/groupes/'] });
      toast.success(Locales.formatString(Locales.trip.toast.group_delete, { name: deletedGroup?.group_name }));
      setSelectedGroup(null);
    },
  });

  const { mutate: deleteGroupMember } = usePermissionMutation({
    mutationFn: (groupMember) =>
      api.post(`agency/groups/${groupMember.group.group_id}/remove_trip/${groupMember.trip.id}/`),
    onSuccess: (_, deletedGroupMember) => {
      queryClient.invalidateQueries({ queryKey: ['trip/'] });
      queryClient.invalidateQueries({ queryKey: ['trip/groupes/'] });
      toast.success(
        Locales.formatString(Locales.trip.toast.group_member_delete, {
          pilgrimName: getUserName(
            deletedGroupMember?.trip.pilgrim.first_name,
            deletedGroupMember?.trip.pilgrim.last_name
          ),
          groupName: deletedGroupMember?.group.group_name,
        })
      );
      setSelectedGroupMember(null);
    },
  });

  const { mutate: generateMedicalCertificate } = usePermissionMutation({
    mutationFn: ({ id }) => api.get(`trip/${id}/generate_medical_certificate/`, { responseType: 'blob' }),
    onSuccess: ({ data }, { pilgrimData }) => {
      const fileName = `certificat_medicale_de_${getUserName(
        pilgrimData?.pilgrim?.first_name,
        pilgrimData?.pilgrim?.last_name
      )}_${pilgrimData?.pilgrim?.passport || pilgrimData?.pilgrim?.npi}.pdf`;
````

</details>

<a id="evidence-091"></a>

### evidence-091: `proj-ehadj-ui/src/pages/Group/index.test.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 55–125:

````text
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 60 * 60 * 1000, refetchOnMount: false } },
  });
  response = [];
  list = jest.fn(() => async () => ({ data: response }));
  useAPI.mockReturnValue({ api: { list } });
  useDebounce.mockImplementation((value) => value);
  useGetUser.mockReturnValue({
    isAGLO: true,
    isAgency: false,
    user: { id: 'aglo-1' },
    activeOrganizationId: 'org-1',
    activeRole: 'AGLO1',
  });
  useGetPilgrim.mockReturnValue({ firstname: 'Awa', lastname: 'Dossou', npi: '1234567890' });
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
});

test('does not show search or agency filter when the campaign has no groups', async () => {
  await renderGroup();
  expect(document.body.textContent).toContain('Aucune donnée disponible');
  expect(document.body.querySelector('input[placeholder^="Rechercher un pèlerin"]')).toBeNull();
  expect(document.body.querySelector('[role="combobox"]')).toBeNull();
});

test('renders a group when the grouped trip response contains one', async () => {
  response = [
    {
      agency_id: 'agency-1',
      agency_name: 'Société Alpha',
      groups: [{ group_id: 'group-1', group_name: 'Alpha', trips: [{ id: 'trip-1' }] }],
    },
  ];
  await renderGroup();
  expect(document.body.textContent).toContain('Groupe Alpha');
  expect(document.body.querySelector('input[placeholder^="Rechercher un pèlerin"]')).not.toBeNull();
  expect(list).toHaveBeenCalledWith('trip/', { group_by: 'agency_and_group' });
});

test('historical AGLO grouping retains the selected year in the list request', async () => {
  await renderGroup(2024);
  expect(list).toHaveBeenCalledWith('trip/', { group_by: 'agency_and_group', campaign_year: 2024 });
});

test('agency grouping keeps its existing list request', async () => {
  useGetUser.mockReturnValue({ isAGLO: false, isAgency: true });
  await renderGroup();
  expect(list).toHaveBeenCalledWith('trip/', { group_by: 'agency_and_group' });
});

test('reloads groups when returning to a cached campaign', async () => {
  await renderGroup(2026);
  await renderGroup(2024, true);
  response = [
    {
      agency_id: 'agency-new',
      agency_name: 'Société Nouvelle',
      groups: [{ group_id: 'group-new', group_name: 'Nouveau', trips: [] }],
    },
  ];
  await renderGroup(2026, true);
````

</details>

<a id="evidence-092"></a>

### evidence-092: `proj-ehadj-ui/src/pages/Login/authRecovery.test.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 21–75:

````text
const originalResizeObserver = global.ResizeObserver;
beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterAll(() => {
  global.ResizeObserver = originalResizeObserver;
});

let root;
let container;
let client;
let router;
const renderPage = async (path) => {
  const rootRoute = createRootRoute({ component: Outlet });
  router = createRouter({
    history: createMemoryHistory({ initialEntries: [path] }),
    parseSearch,
    stringifySearch,
    routeTree: rootRoute.addChildren([
      createRoute({ getParentRoute: () => rootRoute, path: '/reset-password', component: ResetPassword }),
      createRoute({ getParentRoute: () => rootRoute, path: '/login', component: Login }),
      createRoute({
        getParentRoute: () => rootRoute,
        path: '/forgot-password',
        component: () => <p>New reset link</p>,
      }),
    ]),
  });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <RestClientContext.Provider value={{ api: new RestClient('/api/v1/', null, jest.fn()) }}>
          <RouterProvider router={router} />
        </RestClientContext.Provider>
      </QueryClientProvider>
    )
  );
};
const fill = async (selector, value) =>
  act(async () => {
    const input = container.querySelector(selector);
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const flush = async () => act(async () => new Promise((resolve) => setTimeout(resolve, 20)));

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem('eHadj--legal_accepted', 'true');
````

</details>

<a id="evidence-093"></a>

### evidence-093: `proj-ehadj-ui/src/pages/Login/index.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 75–139:

````text
  // 1. First Step: Login Mutation
  const { mutate: logUser, isLoading: isLoggingIn } = useMutation({
    mutationFn: () => api.post('auth/user_token/', { email, password: pwd }, { headers }),
    onSuccess: ({ data }) => {
      toast.success(data.message);
      setError('');
      setStep(CONST_OTP); // Switch to OTP UI
      startTimer();
    },
    onError: (error) => {
      setError(error || Locales.auth.errors.invalid_identifiers);
    },
  });

  // 2. Second Step: OTP Validation
  const { mutate: verifyOTP, isLoading: isVerifyingOTP } = useMutation({
    mutationFn: () => api.post('auth/user_token/verify_otp/', { email, otp: otpValue }, { headers }),
    onSuccess: ({ data }) => {
      // Finalize login
      storage.set(CONST_USER_TOKEN, data.auth_key);
      downloadConsentReceipt();
      window.location = Urls.base;
    },
    onError: () => {
      setError('Code OTP invalide ou expiré.');
      setOtpValue('');
    },
  });

  // Resend OTP Mutation
  const { mutate: resendOTP, isLoading: isResending } = useMutation({
    mutationFn: () => api.post('auth/user_token/', { email, password: pwd }, { headers }),
    onSuccess: () => {
      toast.success('Un nouveau code a été envoyé.');
      startTimer();
    },
    onError: () => setError('Erreur lors du renvoi du code. Veuillez réessayer.'),
  });

  const startTimer = () => setResendTimer(RESEND_OTP_TIMER_SECONDS);

  const handleLogin = (event) => {
    event.preventDefault();

    if (!validateEmail(email)) {
      setError(Locales.auth.errors.invalid_email);
      setPwd('');
      setEmail('');
      return;
    }

    setError('');
    logUser();
  };

  const toggleDisplayPassword = () => setDisplayPwd((val) => !val);

  const toggleLegalNoticeOpen = () => setLegalNoticeOpen((val) => !val);

  const acceptCgu = () => {
    storage.set(CONST_LEGAL_ACCEPTED, true);
    const acceptanceDateTime = formatDate(new Date(), "EEEE d MMMM yyyy 'à' HH:mm:ss");
    storage.set(CONST_LEGAL_ACCEPTANCE_DATE, acceptanceDateTime);
    toggleLegalNoticeOpen();
  };
````

</details>

<a id="evidence-094"></a>

### evidence-094: `proj-ehadj-ui/src/pages/Register/index.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 33–86:

````text
  const { mutate: registerPilgrim } = useMutation({
    mutationFn: () => {
      const payload = {
        admin_last_name: lastName.trim(),
        admin_first_name: firstName.trim(),
        phone: phoneNumber,
        admin_email: email.trim(),
        captcha,
      };
      return api.post('pilgrim_org/', payload);
    },
    onSuccess: () => {
      setError('');
      setSuccessMessage('Inscription réussie !');
      setShowSuccessCard(true);
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');

    if (!validateName(lastName)) {
      setError('Le nom est requis.');
      return;
    }
    if (!validateName(firstName)) {
      setError('Le prénom est requis.');
      return;
    }
    if (!validatePhoneNumber(phoneNumber)) {
      setError('Le numéro de téléphone doit commencer par 01 et contenir 10 chiffres (01 XX XX XX XX).');
      return;
    }
    if (email && !validateEmail(email)) {
      setError("L'email fourni n'est pas valide.");
      return;
    }
    if (!captcha) {
      setError('Veuillez compléter le CAPTCHA.');
      return;
    }

    registerPilgrim();
  };

  const isDisabled = isMutating || !lastName || !firstName || !email || !phoneNumber || !captcha;

  return (
    <AuthPageLayout>
      {showSuccessCard && (
        <AuthCard className="max-w-[488px]">
          <div className="mb-[26px]">
````

</details>

<a id="evidence-095"></a>

### evidence-095: `proj-ehadj-ui/src/pages/ResetPassword/index.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 39–89:

````text
  const { token, email } = credentials;
  useLayoutEffect(() => {
    if (searchParams.has('token') || searchParams.has('email')) {
      const next = readPasswordResetSession(searchParams.toString());
      savePasswordResetSession(next);
      setCredentials(next);
      const clean = new URLSearchParams(searchParams);
      clean.delete('token');
      clean.delete('email');
      setSearchParams(clean, { replace: true });
    } else if (!credentials.token) {
      clearPasswordResetSession();
    }
  }, [searchParams, setSearchParams, credentials.token]);

  const { mutate: resetPassword, isLoading: isMutating } = useMutation({
    mutationFn: () => {
      if (!token || credentials.expiresAt <= Date.now()) {
        clearPasswordResetSession();
        setCredentials({ token: '', email: '', expiresAt: 0 });
        throw new Error('Veuillez rouvrir votre lien de réinitialisation.');
      }
      return api.post('auth/user_token/reset_password/', { token, password: pwd, password2: confirmPwd });
    },
    onSuccess: () => {
      clearPasswordResetSession();
      toast.success(Locales.auth.password_reset_with_success);
      navigate({ resetScroll: false, to: Urls.front.login, replace: true });
    },
    onError: (error) => {
      if (
        [
          "Ce lien n'est plus valide. Veuillez accéder à la page 'Mot de passe oublié' pour en générer un nouveau.",
          'This reset link has already been used. Please request a new one.',
        ].includes(error)
      ) {
        clearPasswordResetSession();
        setCredentials({ token: '', email, expiresAt: 0 });
        setInvalidLinkMessage(error);
      } else {
        toast.error(typeof error === 'string' ? error : 'Oups ! Une erreur est survenue.');
      }
    },
    onSettled: () => {
      submitting.current = false;
    },
  });

  const isValidPwd = pwdRuleSize && pwdRuleUppercase && pwdRuleLowercase && pwdRuleNumber && pwdRuleSpecial;

  const toggleDisplayPassword = () => setDisplayPwd((val) => !val);
````

Original lines 92–127:

````text
  const validatePassword = (password) => {
    setPwdRuleSize(password.length > 8);
    setPwdRuleUppercase(/[A-Z]/.test(password));
    setPwdRuleLowercase(/[a-z]/.test(password));
    setPwdRuleNumber(/\d/.test(password));
    setPwdRuleSpecial(/[`!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~]/.test(password));
  };

  const handlePasswordChange = (value) => {
    const newPassword = value;
    setPwd(newPassword);
    validatePassword(newPassword);
  };

  const enableSubmitButton = Boolean(token) && isValidPwd && pwd === confirmPwd;

  return (
    <AuthPageLayout>
      <AuthCard className="max-w-[480px]">
        <div className="space-y-6">
          <div className="mb-[25px] text-left">
            <h1 className="text-2xl font-semibold leading-[1.3] tracking-[-0.55px] text-[#21312a] max-[520px]:text-[22px]">
              {Locales.auth.reset_password_title}
            </h1>
            <p className="mt-2 text-sm leading-[1.6] text-[#62736a]">{Locales.auth.reset_password_message}</p>
          </div>

          <form className="space-y-6">
            {!token && (
              <div role="alert" className="text-sm text-destructive">
                {invalidLinkMessage || 'Ce lien est absent ou n’est plus disponible.'}{' '}
                <Button
                  type="button"
                  variant="link"
                  onClick={() => navigate({ resetScroll: false, to: Urls.front.password.forgot })}
                >
````

</details>

<a id="evidence-096"></a>

### evidence-096: `proj-ehadj-ui/src/pages/User/components`

Observed immediate directory entries (names only):

```text
AddUserModal.jsx
EditUserModal.jsx
UserFormPrimitives.jsx
UserFormPrimitives.test.jsx
```

<a id="evidence-097"></a>

### evidence-097: `proj-ehadj-ui/src/pages/User/components/AddUserModal.jsx`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 13–59:

````text
const AddUserSchema = z.object({
  firstName: z.string().trim().min(1, Locales.user.redesign.validation.first_names_required),
  lastName: z.string().trim().min(1, Locales.user.redesign.validation.last_name_required),
  email: z
    .string()
    .trim()
    .min(1, Locales.user.redesign.validation.email_required)
    .email(Locales.user.redesign.validation.email_invalid),
  organizationIds: z.array(z.string()).min(1, Locales.user.errors.organization_required),
});

const AddUserModal = ({ isOpen, onClose, organizations = [] }) => {
  const copy = Locales.user.redesign;
  const { isSuperAdmin, activeOrganizationId, activeOrganizationName } = useGetUser();
  const { api } = useAPI();
  const queryClient = useQueryClient();
  const defaultOrganizationIds = isSuperAdmin ? [] : activeOrganizationId ? [activeOrganizationId] : [];

  const form = useForm({
    resolver: zodResolver(AddUserSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      organizationIds: defaultOrganizationIds,
    },
  });

  const { mutate: createUser, isLoading } = usePermissionMutation({
    mutationFn: (data) =>
      api.create('user/', {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        organization_ids: data.organizationIds,
        is_onboard: true,
      }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['user/'] });
      toast.success(
        Locales.formatString(Locales.user.toast.user_added, {
          firstName: data.first_name,
          lastName: data.last_name,
          email: data.email,
        })
      );
      form.reset({
````

</details>

<a id="evidence-098"></a>

### evidence-098: `proj-ehadj-ui/src/setupTests.js`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 1–5:

````text
// jsdom has no viewport scrolling; routing behavior is exercised in browser checks.
window.scrollTo = () => {};

// Vite supplies this asset base in the browser; tests use an explicit synthetic base.
process.env.BASE_URL = '/';
````

</details>

<a id="evidence-099"></a>

### evidence-099: `proj-ehadj-ui/vite.config.mjs`

Selected original spans; omitted surrounding code is not asserted included.

<details>
<summary>Embedded evidence</summary>

Original lines 6–54:

````text
const require = createRequire(import.meta.url);
const clientEnv = require('./scripts/client-env.cjs');

const root = fileURLToPath(new URL('.', import.meta.url));
const sourceRoots = [
  'App',
  'assets',
  'components',
  'context',
  'data',
  'helpers',
  'hooks',
  'lib',
  'locales',
  'pages',
  'public',
];

export default defineConfig(({ mode, command }) => {
  const environment = clientEnv.loadClientEnv(mode, root);
  if (command === 'build') clientEnv.validateClientEnv(environment);
  const publicBase = environment.VITE_PUBLIC_URL || '/';
  const base = publicBase.endsWith('/') ? publicBase : `${publicBase}/`;
  return {
    // Environment loading is explicit so CRA precedence and the allowlist are preserved.
    envDir: false,
    envPrefix: [],
    base,
    plugins: [react()],
    resolve: {
      alias: Object.fromEntries(
        sourceRoots.map((name) => [name, fileURLToPath(new URL(`./src/${name}`, import.meta.url))])
      ),
    },
    define: Object.fromEntries(
      Object.entries(environment).map(([key, value]) => [
        `import.meta.env.${key}`,
        value === undefined ? 'undefined' : JSON.stringify(value),
      ])
    ),
    server: { host: '127.0.0.1', port: 3000, strictPort: true },
    preview: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: {
      outDir: 'build',
      target: browserslistToEsbuild(undefined, { path: root, env: 'production' }),
      sourcemap: false,
    },
  };
});
````

</details>

