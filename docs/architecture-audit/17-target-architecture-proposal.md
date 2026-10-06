# MJL target architecture

## Status, authority, and scope

**Architecture status: `ARCHITECTURE_FROZEN`.**

The architecture defined by this document is the authoritative MJL target
architecture baseline. Architecture freeze does not authorize implementation,
production preparation, an Engineering Standard, or any file, schema, runtime
or migration change. W0 remains an unauthorized characterization prerequisite;
W1–W7 remain unauthorized migration proposals until the user separately
authorizes each applicable wave.

The baseline was derived from the `READY_FOR_PROPOSAL` audit gate and the
completed forensic audit, especially the [dependency map](02-dependency-map.md),
[request map](03-request-map.md), [database map](04-database-map.md), [module
lifecycle](05-module-lifecycle.md), [authentication state](06-authentication-state.md),
[authorization map](07-authorization-map.md), [business workflows](08-business-workflows.md),
[frontend contracts](09-frontend-contracts.md), [duplication report](10-duplication-report.md),
[regression baseline](13-regression-baseline.md), [preservation ledger](14-preservation-ledger.md),
[behavior classification](15-behavior-classification.md), and [current
architecture](16-current-architecture.md). Current product authority remains
in `docs/mjl-authoritative-decisions.md` and its canonical documents.

The baseline uses **module**, **interface**, **implementation**, **seam**, and
**adapter** in the codebase-design sense. A module is justified only where its
interface hides meaningful MJL behavior and improves locality or testability.
No interface class is proposed merely to wrap a single implementation.

### Lean scope boundary

| Proposed mechanism | Current requirement or material risk |
| --- | --- |
| thin HTTP adapters plus feature request handlers | large route libraries currently mix parsing, authorization, mutation, and rendering |
| workflow command modules with owned transactions | audit evidence locates business invariants and fail-closed behavior at locked write seams |
| explicit policy modules | effective role, entity, assignment, and action eligibility are fragmented, while defense-in-depth checks must remain |
| read projections separate from writes | monitoring/report SQL is duplicated and must never become write authorization |
| prepared presentation data plus PHP templates | route libraries emit HTML while also dispatching commands, making behavior hard to test and trace |
| delegated lifecycle functions | the descriptor mixes registration with guarded, resumable schema work |
| documented DOM hooks | JavaScript currently depends on markup contracts that are not expressed at one seam |

No other mechanism is approved by this frozen baseline. In particular, it does
not justify a framework, container, ORM, event bus, generic repository layer,
or schema redesign.

### Frozen-baseline governance

A material deviation that changes an approved architectural boundary,
dependency direction, responsibility owner, preservation mapping,
migration-wave contract or ordering, database-invariant ownership, or major
lifecycle, authorization, security or auth/session invariant requires explicit
architecture review before implementation. Record the approved change as a
focused architecture amendment or in the existing decision register; this
freeze does not create a separate ADR system.

Private method extraction, local naming or algorithm improvements, small
helpers inside an approved responsibility, local test refactoring, and other
implementation details that preserve those contracts are non-material and do
not require an architecture amendment.

## 1. Architectural diagnosis

| Problem ID | Current implementation and evidence | Operational and maintenance impact | Regression/security/data risk | Why architecture should address it |
| --- | --- | --- | --- | --- |
| D-01 mixed HTTP responsibilities | `mjl_activity_route.lib.php` (549 lines), `mjl_monitoring_route.lib.php`, `mjl_report_route.lib.php`, `mjl_reference_route.lib.php`, and the Operation route libraries parse requests, decide access, call mutations, build data, render HTML, and redirect. See request and dependency maps. | A single route change requires understanding unrelated request, domain, and markup behavior; failures are hard to locate. | A presentation edit can accidentally alter an authorization or mutation branch. | Establish a narrow request-handler seam and a separate presentation seam while retaining root routes and direct guards. |
| D-02 concentrated multi-purpose files | `mjl_app.css.php` is 2,417 lines; `mjl_components.js` 913; `mjl_auth.lib.php` 723; `MjlActivityCommand` 656; `mjl_scope.lib.php` 524; the descriptor 293. The inventory records these exact concentrations. | Investigation and review cross large unrelated regions; ownership is unclear. | Changes can disturb hidden contracts, especially auth, lifecycle, and DOM behavior. | Split only where responsibilities and callers differ. Keep cohesive deep modules such as the Activity aggregate intact at their external seam. |
| D-03 procedural helper concentration | Authentication, scope, reference writes, routing, rendering, and SQL are exposed as broad families of global functions in `.lib.php` files. | Callers can bypass intended sequencing, and tests often reach individual helpers rather than stable behavior. | Transaction setup, lock order, and failure propagation can drift between callers. | Keep procedural adapters where Dolibarr expects them, but put stateful workflows behind small command interfaces. |
| D-04 duplicated business vocabulary | Role codes occur in auth, scope, SQL, and trigger installers; validation and parsing repeat with meaningful differences. Duplication report classifies this as D2/D3/D4. | Equivalent-looking rules require repeated comparison during every change. | Role drift could weaken access or activation; blind consolidation could remove security defense in depth. | Centralize canonical vocabulary and semantically identical pure rules, while retaining checks at each trust boundary. |
| D-05 duplicated and embedded SQL | Auth, scope, Activity, monitoring, reports, references, exports, audit, and lifecycle each construct SQL. Similar reads occur in current/predecessor branches. | Query ownership and entity filtering are hard to trace. | Generic consolidation could hide lock timing or remove entity predicates. | Assign each statement to a write owner or read projection; share a query only after semantic equivalence is proved. No repository per table. |
| D-06 fragmented authorization | UI eligibility, routes, commands, and database definitions each enforce part of access. This is intentionally layered, but policy vocabulary and route eligibility are spread across files. | Engineers must search many helpers to answer whether an action is allowed. | Collapsing layers weakens fail-closed behavior; inconsistent role vocabulary can create gaps. | Define policy modules that calculate decisions for a particular trust boundary and explicitly require command reauthorization under locks. |
| D-07 transaction inconsistency | The Activity aggregate, auth, export, assignment, and reference paths each own different locking/commit behavior. BC-002 showed the consequence of unchecked reference begin/commit results. | Failure semantics vary by subsystem. | Partial writes, misleading success, or reuse of an uncertain connection. | Each write interface must own one outer transaction and a documented result contract; native calls stay inside that owner where verified safe. |
| D-08 descriptor/lifecycle concentration | `modMjlFinancement::init()` registers the module and orchestrates RST-005/006A/006B/012 detection/install, triggers, OTP schema, locks, and test-only branches. | Lifecycle changes require reasoning about registration and DDL together. | MariaDB implicit commits, unknown states, and interruption/resumption make casual extraction dangerous. | Keep the descriptor as Dolibarr adapter but delegate exact detection and transition work to lifecycle modules without inventing a migration framework. |
| D-09 frontend coupling | PHP emits DOM structures consumed by `activities.js`, `mjl_components.js`, `mjl_form_controls.js`, and CSS; several hooks use presentation selectors. The frontend audit lists the exact contracts. | Markup, behavior, and styling cannot be changed independently or confidently. | A cosmetic rename can break CSRF-bearing dialog forms, focus management, indexed Operation inputs, or BigInt-safe preview. | Name behavioral `data-*` hooks and keep presentation classes separate during incremental template extraction. |
| D-10 error inconsistency | Routes use HTTP errors, redirects, Dolibarr event messages, arrays with codes, booleans, and exceptions. Cron and migrations have still different failure forms. | Callers must learn each helper's implicit convention. | Errors may be swallowed (`fread() === false`) or later work may continue after uncertain failure. | Standardize result families at existing seams, not through one generic exception hierarchy. |
| D-11 testability limits | Mixed route/render/write files and globals make isolated tests difficult; several unit tests spawn PHP, runner discovery is incomplete, and broad commands are unreliable in the audited environment. | Slow or environment-sensitive feedback encourages testing around rather than through interfaces. | Critical behavior may be claimed from incomplete gates. | Make each deep module's interface the primary test surface and keep database/security tests at their real trust boundaries. |
| D-12 lifecycle and compatibility complexity | Exact predecessor/current recognition, implicit-commit DDL, test modes, and retained schema make lifecycle distinct from ordinary HTTP code. BC-019 demonstrated early-prefix risk. | A normal refactor technique can make activation non-resumable. | Unknown or partial schema could be accepted, or a valid interrupted migration could become unrecoverable. | Isolate lifecycle ownership and preserve detectors, locks, checkpoints, and fail-closed classification verbatim until focused migration work. |
| D-13 difficult end-to-end tracing | A request may cross a thin root route, a large procedural route, scope helpers, command internals, native objects, triggers, audit, presentation, and JS. | Investigation relies on repository-wide search rather than a predictable path. | Fixes can land at the wrong trust boundary. | Make the path `entrypoint -> handler -> policy -> command/query -> presenter`, with transaction and audit ownership visible at the command. |

The audit found no justification for replacing Dolibarr, for converting every
function into a class, or for splitting `MjlActivityCommand` into many shallow
objects. Its external interface is broad because the aggregate has many real
commands, but its private implementation already provides substantial depth.

## 2. Architectural goals and non-goals

### Goals

1. **Easy investigation:** an engineer can trace an HTTP action, authorization
   decision, transaction, audit row, and response without searching unrelated
   presentation code.
2. **Clear ownership:** every write has one transaction owner; every scoped SQL
   read has a named query owner and every bounded read snapshot has a named
   procedural orchestrator; every DOM behavior has a named markup contract.
3. **Bounded responsibilities:** modules expose the smallest useful interface
   and hide lock order, SQL details, native adapter calls, and rendering details.
4. **Low accidental duplication:** consolidate only rules proved semantically
   identical; preserve security and client/server duplication intentionally.
5. **Predictable dependency direction:** HTTP and presentation depend inward
   on policies, commands, and projections; business modules never emit HTML.
6. **Dolibarr compatibility:** retain root entrypoints, `main.inc.php`, hooks,
   module descriptor conventions, native `User`/`Societe`/`Project`, CSRF,
   event messages, PDF/XLSX libraries, and the database adapter.
7. **Testable workflows:** test commands and projections through their public
   interfaces, with focused disposable-tenant tests for real DB boundaries.
8. **Explicit authorization:** make route decisions legible while preserving
   under-lock reauthorization and database invariants.
9. **Safe transactions and preserved DB invariants:** preserve the verified
   checked begin/commit/rollback/quarantine reference contract; preserve each
   other owner's current transaction behavior until separately approved,
   failure-tested hardening; retain active-entity predicates, triggers, and
   exact schema definitions.
10. **Safe lifecycle:** detection, locking, interruption/resumption, and
    historical compatibility remain explicit.
11. **Frontend contract clarity:** templates produce documented behavioral
    hooks; JS enhances ordinary forms and never becomes authoritative.
12. **Incremental migratability:** every wave leaves a working module and can
    be rolled back without reversing business data or DDL.

### Non-goals

- rewriting MJL or its business rules;
- replacing or wrapping Dolibarr with a second framework;
- redesigning schema, workflow, roles, UI, routes, or output formats;
- converting every procedural function into a class;
- introducing Symfony, Laravel, Twig, PSR-7, an ORM, a DI container,
  microservices, CQRS, an event bus, or generic DDD ceremony;
- creating interfaces for single implementations;
- adopting namespaces, Composer PSR-4, PHPStan, PHP_CodeSniffer, ESLint, or
  Stylelint without a separately approved evidence-based task;
- removing triggers, predecessor branches, historical schema support, or
  apparently dead helpers without compatibility proof;
- implementing Phase 4 documents, accounting, official Partner reports,
  production hardening, or persistent demo data.

## 3. Target responsibility model

The roles below precede and justify the directory proposal.

| Architectural role | Responsibility and interface | Allowed dependencies | Forbidden dependencies | Current examples and exclusions |
| --- | --- | --- | --- | --- |
| Dolibarr web adapter | Load `main.inc.php` when required, identify one route handler, and hand off. Denial routes remain dependency-free. | one feature handler; Dolibarr bootstrap | SQL, business decisions, HTML bodies beyond denial | root `activities.php`, `reports.php`, `auth.php`; must not regain inline workflows |
| feature request handler | Normalize method/action/input, enforce route policy and CSRF/submission token, own session-backed form effects, invoke exactly one command or query, choose redirect/view/error, and prepare shell eligibility. | route policy, command/query, existing token/recovery/feedback/session helpers, presenter | direct business SQL, trigger knowledge, HTML fragments, business transaction control | current `mjl_*_route()` and POST dispatch portions; token issue/consume, recovery consume, feedback drain and shell preparation occur here before rendering |
| policy module | Answer a narrowly named authorization/eligibility question from current persisted facts. Its interface includes entity and actor explicitly. | effective-role reader, assignment/readiness query as needed | rendering, redirect, mutation, reliance on UI state | `mjl_scope_effective_role_code`, Activity access and monitoring access; command modules still reauthorize |
| workflow command module | Perform one business mutation atomically, including current-state locks, authorization, version checks, native adapters, audit, commit/rollback, and a finite result code. | Dolibarr DB, native objects, audit writer, canonical pure rules | HTTP globals, HTML, event messages, templates, browser state | `MjlActivityCommand`, `MjlActivityAssignment`; future reference/access/auth command modules only where they hide real workflow depth |
| feature read module | Return entity- and role-scoped data shaped for a use case and own any existing bounded read snapshot: isolation selection, checked begin/commit, failure result and DB-session budget restoration. It never authorizes a write. | Dolibarr DB, `MjlMonitoring`, policy vocabulary, pure projection helpers | mutation, HTML, write authorization | procedural monitoring read orchestration for Activity detail/review and monitoring; procedural reporting read orchestration for report previews |
| scoped query owner | Execute entity- and role-scoped read SQL for feature read modules; never authorize a write or own HTTP/session state. | Dolibarr DB, policy vocabulary, pure projection helpers | mutation, HTML, write authorization | retain `MjlMonitoring`; do not add a competing `MjlActivityQuery` without a distinct need |
| audit writer/projection | Append audit within the caller-owned transaction; separately turn stored evidence into authorized, sanitized views. | DB and actor snapshots; projection may depend on formatting | owning its own commit for a business mutation, emitting route HTML | `mjl_audit_append_in_transaction`, audit/timeline projections |
| export workflow module | Validate report role, capture a repeatable snapshot, render to private spool, reacquire current authorization locks, record evidence/audit, and return a delivery handle. | projections/renderers, DB, spool, audit | direct HTTP streaming in its transaction; global UI rendering | `MjlExport`, `MjlExportSpool`, report format/render libraries |
| presenter/template module | Convert prepared data and eligibility flags into escaped French-first HTML with stable form and accessibility contracts. | pure formatting, translation, template partials | SQL, mutation, authoritative access decisions, session reads or changes | current `mjl_*_ui`, render portions of route libraries; session-backed effects complete in handlers before pure rendering; `core/tpl` stays reserved for Dolibarr auth overrides |
| browser feature module | Enhance a documented DOM contract and retain ordinary form/link fallback where the current contract has it. | DOM, approved optional jQuery UI/Select2 globals | authorization, authoritative money/workflow rules, undisclosed storage/network state | `activities.js`, `mjl_form_controls.js`, `mjl_components.js`, `mjl_auth.js` |
| CSS presentation module | Express approved tokens, components, feature layout, responsive and accessibility states. | documented markup/component names | behavioral state inferred solely from cosmetic selectors | `mjl_app.css.php`, `mjl_auth.css.php` |
| schema recognition and lifecycle functions | Existing read-only detectors/exact-definition verifiers may be called by routes, policies, queries, commands, activation and guarded CLI entrypoints. Install/apply/resume/rollback functions remain restricted to activation or their guarded CLI entrypoints. | Dolibarr DB, SQL files, named locks, exact definitions | HTTP rendering, silent repair of unknown state, runtime invocation of DDL operations | retain current RST schema-library/installer paths and definitions; not a generic registry or migration framework |
| private auth session adapter | Bind the existing PHP/Dolibarr session, apply/clear pending auth state, regenerate session identity and complete invalidation at explicit auth decision points. | PHP/Dolibarr session API, values supplied by auth orchestration | DB workflow ownership, policy decisions, rendering, generic interchangeability | one procedural adapter under `lib/auth/`; the sole explicit deeper-session exception |
| module descriptor adapter | Declare metadata, dependencies, rights, menus, hooks, assets, cron, and sequence lifecycle modules during `init()`. | lifecycle modules and native `DolibarrModules` | embedding detailed DDL/detector implementations, business workflow logic | `modMjlFinancement` |
| hook adapter | Translate Dolibarr hook calls into auth/navigation modules and return Dolibarr-compatible results. | auth/session policy, presentation asset registry | duplicating auth state machines, direct business mutation | `ActionsMjlFinancement` |
| low-level pure utility | One stable cross-feature calculation or encoding with no business orchestration. | PHP standard library only, or explicitly supplied values | DB/session globals, workflow decisions, miscellaneous dumping | XOF formatting/parsing, safe internal path, form token encoding; generic `helpers` module forbidden |

The deletion test applies: if removing a proposed module merely moves one-line
calls back into a single caller, that module is too shallow and should not be
created. Internal seams may support tests, but they are not exposed as public
interfaces unless a second real adapter exists.

## 4. Dependency direction

```text
Apache / Dolibarr dispatch
          |
          v
root web adapter or hook adapter
          |
          v
feature request handler ---------> presenter/template -----> HTML
          |                              |
          |                              +-------------------> documented DOM/CSS contract
          +------> route policy
          +------> feature read module ------> retained scoped query owner
          |                 |                              |
          |                 +------> exact read-only       +------> DoliDB
          |                          schema detector
          +------> workflow command
                        |
                        +------> audit writer (same transaction)
                        +------> native Dolibarr object adapter
                        +------> DoliDB + preserved constraints/triggers

auth orchestration/hook ------> pure validity policy
          |
          +-------------------> private auth session adapter ------> PHP/Dolibarr session

browser feature module <------ documented data-* and form contract ------> template

runtime policy/query/command ---> exact read-only schema detector ----> DoliDB
module descriptor/guarded CLI --> retained lifecycle operations ------> DoliDB/DDL
cron adapter -------------------> reconciler ------------------------> Activity command
```

Rules:

- Templates do not query or write the database and do not calculate
  authoritative authorization.
- Browser code does not authorize, invent workflow state, or make missing XOF
  data equal zero.
- Policies may read current facts but do not mutate or render.
- Commands own their outer transaction. A handler never begins or commits a
  business transaction.
- Feature read modules and scoped query owners never become a write-authorization
  source. Commands reload
  and lock the facts needed for mutation.
- Persistence code never depends on routes, templates, event messages, or JS.
- Audit append functions participate in the caller's transaction and never
  commit independently. The existing `mjl_audit_record_outcome` interface for
  failed attempts outside a business transaction retains its separate outcome
  transaction, including email transport failure; it cannot record a successful
  business mutation as a substitute for transaction-bound append.
- Business modules return finite results or throw documented infrastructure
  failures; they do not emit HTML or redirects.
- Normal runtime code may call the existing read-only schema detectors and
  exact-definition verifiers. Install/apply/resume/rollback functions are not
  callable from normal HTTP feature handlers and remain restricted to activation
  or guarded CLI entrypoints. Unknown schema state continues to deny access;
  existing readiness caching and DB timeout/session-budget restoration remain.
- Shared utilities cannot depend on feature modules. Feature modules may share
  only proven pure vocabulary/calculations.

Intentional exceptions:

- `MjlExport` owns a repeatable-read capture followed by a distinct
  read-committed authorization/evidence transaction because delivery crosses
  two completion boundaries.
- Auth issuance owns separate preparation and delivery-result transactions,
  with email between them. The existing order, identity-lock lifetime, and
  failure states are preserved; email cannot be rolled back with SQL. See the
  auth composition contract in section 9.
- Dolibarr hook signatures and root scripts necessarily use globals. Globals
  must be captured at the adapter and passed explicitly into deeper modules.
- The private auth session adapter is the single explicit exception for deeper
  PHP/Dolibarr session access. Pure auth validity policies return decisions;
  auth orchestration and hooks invoke the adapter at existing decision points.
- Dynamic CSS/JS endpoints may omit normal application bootstrap where their
  audited security and content contracts require it.
- `core/tpl` authentication overrides follow Dolibarr's template interface;
  ordinary MJL feature templates use the MJL `tpl/` tree.

## 5. Target file and directory structure

This is a destination map, not permission to create or move these files. Only
directories supported by audited responsibilities are proposed.

```text
custom/mjlfinancement/
├── *.php                         # stable root web adapters
├── admin/access.php              # stable Admin web adapter
├── class/                        # deep stateful modules and Dolibarr-discovered classes
│   ├── actions_mjlfinancement.class.php
│   ├── mjlactivitycommand.class.php
│   ├── mjlactivityassignment.class.php
│   ├── mjlreferencecommand.class.php        # only after replacing proven write helpers
│   ├── mjlaccesscommand.class.php           # only after replacing proven access writes
│   ├── mjlauthcommand.class.php             # invitation/reset/OTP workflow owner
│   ├── mjlmonitoring.class.php
│   ├── mjlexport.class.php
│   ├── mjlexportspool.class.php
│   └── mjlexecutionreconciler.class.php
├── lib/
│   ├── activity/                 # Activity HTTP, policy, pure form/presentation helpers
│   ├── access/                   # effective-role policy and Admin access HTTP/presentation
│   ├── auth/                     # auth HTTP, private session adapter, presentation helpers
│   ├── reference/                # reference HTTP, read projection, presentation
│   ├── monitoring/               # Activity/monitoring snapshot orchestration, HTTP, presentation
│   ├── reporting/                # report snapshot orchestration, HTTP, formatting/rendering
│   ├── audit/                    # append interface, audit/timeline projection/presentation
│   └── ui/                       # proven cross-feature form/navigation/table primitives
├── tpl/                          # ordinary MJL feature templates/partials
│   ├── activity/
│   ├── access/
│   ├── auth/
│   ├── reference/
│   ├── monitoring/
│   └── reporting/
├── core/
│   ├── modules/modMjlFinancement.class.php
│   └── tpl/                      # Dolibarr authentication overrides only
├── js/                           # browser feature modules and documented behavior hooks
├── css/                          # tokens/components plus feature sections or files
├── scripts/                      # retain existing schema libraries, guarded CLI entrypoints,
│                                 # SQL-resource lookups and shared-operation tooling in place
├── sql/                          # clean-install definitions and preserved invariants
└── deployment/                   # Apache containment configuration
```

Directory rules:

| Directory | Allowed | Forbidden | Naming and migration sources |
| --- | --- | --- | --- |
| root and `admin/` | stable URL adapters, bootstrap, single handler call, denial responses | SQL, workflow logic, large templates | keep public filenames; migrate bodies from current route entrypoints only |
| `class/` | deep modules with transaction/state depth; Dolibarr-discovered hook/module classes | one-method pass-through wrappers, presenter classes, repository per table | retain Dolibarr lowercase `mjl*.class.php`; current command, assignment, monitoring, export, reconciler classes plus justified replacements from auth/scope/reference helpers |
| `lib/<feature>/` | procedural HTTP adapters, policies, projections, pure feature helpers | mixed feature dumping, hidden commits, large HTML bodies | `mjl_<feature>_<role>.lib.php`; migrate current flat libraries by responsibility, not wholesale |
| `lib/ui/` | only established cross-feature primitives such as forms, feedback, navigation, tables | workflow/status rules or feature-specific markup | existing `mjl_form`, `mjl_feedback`, `mjl_navigation*`, `mjl_table`, `mjl_page_header`; keep feature differences local |
| `tpl/<feature>/` | escaped HTML using prepared view data and eligibility flags | DB access, request parsing, mutation, policy queries | descriptive partial names; sources are current render functions |
| `core/tpl/` | Dolibarr-required login/forgot/reset overrides | ordinary MJL feature templates | retain native filenames and interface |
| `js/` | one feature or shared interaction contract per file | authorization, implicit coupling to cosmetic classes when a data hook is suitable | retain current public asset names during migration; add `data-mjl-*` hooks before changing selectors |
| `css/` | approved tokens, shared components, feature rules, dynamic PHP wrapper where needed | business state logic, speculative empty files | split `mjl_app.css.php` only along proven token/component/feature ownership; preserve load order |
| `scripts/` lifecycle files at current paths | exact read-only detectors, guarded installers, checkpoint definitions and invariant verification | generic migration registry, HTTP rendering, silent schema repair, runtime calls to DDL operations | retain existing filenames, includes and SQL-resource paths; descriptor delegates without mandatory relocation |
| `sql/` | clean-install tables, keys, triggers/invariants | runtime queries, fixture/demo data | keep Dolibarr prefix convention and exact-definition validation |

## 6. Current-to-target responsibility mapping

### High-risk and high-complexity files

| Current file/symbol | Current responsibility | Proposed destination/owner |
| --- | --- | --- |
| `lib/mjl_activity_route.lib.php::mjl_activity_route`, `mjl_activity_post` | method/action dispatch, request normalization, route guard, command invocation, redirect/feedback | `lib/activity/mjl_activity_http.lib.php`; no SQL or rendering |
| same file: `mjl_activity_fetch`, `mjl_activity_operations`, `mjl_activity_revision`, list query | Activity list/detail/review reads and snapshot orchestration | W2 moves the needed orchestration to the procedural monitoring read module, which calls retained `MjlMonitoring`; it owns existing isolation, checked begin/commit, failure results and DB-session budget restoration |
| same file: `mjl_activity_render_*`, option builders | HTML, view preparation and currently adjacent session-backed form effects | handler first issues/consumes submission tokens, consumes recovery, drains feedback and prepares shell eligibility through retained helpers; pure prepared-data functions in `lib/activity/mjl_activity_presentation.lib.php` plus `tpl/activity/*` receive the results |
| `class/mjlactivitycommand.class.php` public commands | aggregate planning, revision, review, execution, exception, reconciliation transactions | remain the external Activity write interface in `class/`; refactor only private internals where locality improves |
| same class: lock/load/validate/audit private methods | aggregate implementation depth | remain private/internal seams; do not expose repositories or validators as public architecture |
| `class/mjlactivityassignment.class.php::changeAssignment` | assignment transaction, locks, eligibility, audit | remain one deep assignment command; may share canonical role vocabulary but not transaction ownership |
| `lib/mjl_auth.lib.php` invitation/reset functions | credential issue/consume workflows, identity locks, native password write, audit | `MjlAuthCommand` methods grouped by invitation/reset; encrypted-only native password adapter remains internal |
| same file OTP/session functions | password check, OTP state machine, pending session state, completion/regeneration and fingerprint validation | pure validity decisions remain inside cohesive auth policy/command code; one private procedural adapter at `lib/auth/mjl_auth_session.lib.php` owns PHP/Dolibarr session binding, pending changes, clearing and regeneration |
| same file pure token/hash/password helpers | cryptographic/pure validation | private auth implementation or narrowly named auth utility when multiple callers truly require it |
| `lib/mjl_scope.lib.php` role readers/predicates | canonical effective role and role vocabulary | `lib/access/mjl_access_policy.lib.php`; actor/entity explicit |
| same file access mutation functions | role/right replacement, account deactivation, credential revocation, audit | `MjlAccessCommand`; one owned transaction and finite outcomes |
| `mjl_auth_issue_invitation` -> `mjl_scope_assign_access_profile` -> `mjl_auth_record_event` | invitation composes access writes and audit inside its preparation transaction | auth owns the outer transaction; an internal access mutation operation participates without begin/commit; both owners use the audit writer directly (section 9) |
| `lib/mjl_email.lib.php::mjl_email_send`, `mjl_email_render`, `mjl_email_absolute_url`, `mjl_email_record_event` | native mail transport, safe URL construction, rendering and delivery audit | retain the existing email module as a concrete adapter used by auth; presentation stays in `mjl_email_presentation.lib.php`; no auth/access-command dependency from email |
| same file `mjl_email_e2e_enabled`, `mjl_email_write_test_outbox`, `mjl_email_store_e2e_const` | guarded disposable outbox and test delivery evidence | retain with the email adapter and existing disposable guards; no production token exposure or new mail framework |
| `lib/mjl_auth.lib.php::mjl_auth_write_test_outbox`, `mjl_auth_e2e_tokens_enabled` | guarded auth-link capture called back from email and exposure predicate | relocate these unchanged procedural helpers into the email module during W4, preserving names and updating includes/callers together; email no longer calls into auth implementation |
| `lib/mjl_scope.lib.php::mjl_scope_object_pointer`, `mjl_scope_document_pointer` | no discovered live caller | retain until reachability proof; remove only in a separate `REMOVE_WITH_PROOF` wave |
| `lib/mjl_reference.lib.php::mjl_reference_create`, update, lifecycle | reference locks, native adapters, transaction, audit | `MjlReferenceCommand`; preserve begin/commit/rollback/quarantine contract |
| same file list/fetch/config/fingerprint | reference projection and optimistic request token | feature read/policy module; fingerprint verification remains near locked command |
| `lib/mjl_reference_route.lib.php` | request dispatch and rendering | reference HTTP handler plus `tpl/reference/*` |
| `class/mjlmonitoring.class.php` | scoped Activity/Operation/review/request/audit queries | retain as the scoped query owner; procedural feature read modules call it; split audit projection only if distinct policy/callers justify it |
| `lib/mjl_monitoring_route.lib.php`, dashboard/alert/work helpers | request filters, Activity/monitoring snapshot orchestration, view data, HTML | W2 extracts the read orchestration needed by Activity detail/review into `lib/monitoring/mjl_monitoring_read.lib.php`; current monitoring handlers call the same implementation until W5 moves dashboard/index, alerts and presentation |
| `lib/mjl_report_route.lib.php`, `mjl_report_data.lib.php` | report policy/filtering, preview snapshot orchestration/data projection and HTTP dispatch | `lib/reporting/mjl_reporting_read.lib.php` owns preview isolation/begin/commit/failure/budget restoration; reporting HTTP and pure presentation remain separate; deduplicate only proven identical queries |
| `class/mjlexport.class.php::generate` | snapshot, renderer callback, fresh authorization, evidence/audit | retain as export workflow interface; return delivery handle/result, no HTML |
| `class/mjlexportspool.class.php` | private spool lifecycle and file handle | retain as concrete internal adapter; do not add an interface without a second adapter |
| `reportexport.php` streaming loop | POST/CSRF, generate, HTTP headers and stream | root adapter + reporting HTTP handler; streaming remains HTTP responsibility after durable generation |
| `lib/mjl_report_render.lib.php`, CSV/XLSX helpers | PDF/XLSX/CSV presentation | `lib/reporting/`; reconcile older direct helpers before consolidation |
| `lib/mjl_audit.lib.php` append functions | transaction-bound immutable evidence | `lib/audit/mjl_audit_writer.lib.php`; no independent commit |
| audit projection/report/timeline libraries | authorized queries, sanitization, French chronology | `lib/audit/` projections/presentation and relevant templates |
| `core/modules/modMjlFinancement.class.php::__construct` | metadata, rights, menu, hooks, CSS, cron declarations | remain in descriptor adapter |
| same file `init` and `ensure*` | lifecycle orchestration, schema branches, triggers/auth definitions | descriptor delegates to existing schema libraries at their current paths; activation and guarded CLI dispatch remain distinct |
| `scripts/activity_schema_installer.lib.php`, `rst005_activity_foundation.php`, `rst006a_schema.lib.php`, `rst006b_schema.lib.php`, `rst012_schema.lib.php` | exact read-only schema detection plus guarded install/resume | retain current paths and definitions; runtime callers may use only read-only recognition, while activation/guarded CLI retain exclusive DDL operations |
| `mjl_rst006b_detect_schema`, `mjl_rst006b_is_known_prefix` | classify target/predecessor/every known partial prefix/fail unknown | retain together in RST-006B lifecycle module and preserve complete interruption matrix |
| `scripts/rst005_shared_operation.lib.js` and launcher/packet files | guarded shared one-off/reset orchestration | remain CLI operational tooling; simplify only after separate runner/compatibility decision |
| `class/actions_mjlfinancement.class.php` hooks | native login/session/password/header integration | remain Dolibarr hook adapter; delegate state decisions to auth/policy and asset registry |
| `class/mjlexecutionreconciler.class.php::run` | entity-context paging and fail-fast per-Activity reconciliation | retain cron adapter/module until BC-008/009 decisions; calls Activity command only |
| `css/mjl_app.css.php` | tokens, components, feature layout, responsive states | staged token/component/feature sections or files under `css/`; preserve selector/load contracts until templates migrate |
| `js/mjl_components.js` | dialog movement, dirty state, controls, disclosure, tabs, drawer | split only by independently testable interaction contracts; retain shared focus/inert behavior together |
| `js/activities.js`, financial preview, form controls | Operation row contract, BigInt XOF, indexed fields, form enhancement | retain feature modules; bind to documented `data-mjl-*` hooks introduced compatibly |
| `core/tpl/*.tpl.php`, `mjl_auth_ui.lib.php` | Dolibarr auth overrides and shared auth HTML | native override templates remain; move ordinary prepared partials only where Dolibarr template interface permits |

### Remaining responsibility groups

| Current group | Target owner |
| --- | --- |
| root `partners.php`, `projects.php`, `operationtypes.php` | unchanged web adapters -> one reference handler parameterized by kind |
| `operations.php`, `operationrequests.php` and route libraries | unchanged adapters -> Activity execution/exception handlers -> `MjlActivityCommand` |
| `index.php`, `alerts.php` | monitoring handlers/projections/templates |
| `reports.php`, `workflowactions.php` | reporting/audit handlers; predecessor inline branch remains explicit lifecycle compatibility until retirement is approved |
| `admin/access.php`, `auth.php`, `invitation.php` | thin HTTP adapters -> access/auth handlers -> command modules/templates |
| `documents.php`, `documentdownload.php`, `nativeforbidden.php`, `dpafdashboard.php` | remain minimal denial adapters; do not route through general application modules |
| `lib/mjl_form*`, `mjl_feedback`, `mjl_navigation*`, `mjl_page_header`, live `mjl_table` functions | retain procedural helpers; handlers own token issue/consume, recovery consume, feedback drain and shell-eligibility preparation, while only proven pure presentation primitives may move to `lib/ui/` after callers are characterized |
| recovery libraries, older access wrappers/export helpers, dormant CSS | no automatic target; retain pending reachability and compatibility proof |
| language files | unchanged Dolibarr language resources; keys move only with their owning visible behavior |
| `sql/*` | unchanged clean-install definitions and invariant source; current exact detectors share these definitions with lifecycle callers; any later extraction moves callers/includes/resources as one unit |
| deployment guard | unchanged Apache adapter; loaded-state verification belongs to deployment review, not this refactor |

No current responsibility is intentionally discarded. Candidates in the
dead-code report are mapped to “retain pending proof,” not silently omitted.

## 7. PHP structural direction

- Root routes remain procedural because that is the natural Dolibarr web seam.
  Each should bootstrap, capture relevant globals, and call one named handler.
- `.lib.php` remains supported for stateless policy, HTTP adaptation,
  presentation preparation, and pure utilities. It must not hide a long-lived
  state machine or an unowned transaction.
- Classes are used for modules that own stateful workflows, locks,
  transactions, resources, or a deep interface. A class is not required for a
  formatting function or one route.
- Dolibarr `CommonObject` subclasses remain only where native conventions add
  value. `MjlActivity` must not expose unsupported generic create/update/delete
  as if they were valid write paths; its read role should be renamed or made
  explicit during its wave.
- Static helpers are not the default. Pure functions are clearer for existing
  procedural callers; stateful work receives dependencies in constructors or
  method parameters.
- The outer command owns begin/commit/rollback. Nested native adapters may run
  inside it only with the already characterized Dolibarr transaction-depth
  behavior. No helper commits a caller-owned transaction.
- Route policy checks happen before command invocation for usability and
  direct-route protection. Commands repeat authoritative checks after locks.
- Expected business rejections return a finite result code with stable fields.
  Infrastructure failures either return a documented `FAILED` result after
  rollback or throw at a seam whose handler maps it once. Raw DB errors are
  logged, not exposed to users.
- Add scalar/return typing only when PHP 7.4 compatibility, Dolibarr callback
  signatures, and existing callers are proved safe. Do not perform a global
  typing rewrite.
- Naming remains Dolibarr-compatible: `Mjl...` class names, lowercase
  `mjl....class.php`, and `mjl_<feature>_<role>_*` procedural names.
- Namespaces, PSR-4, and Composer autoloading are deferred. The audit found no
  autoload defect that outweighs migration risk, and Dolibarr already discovers
  hook/module classes by convention.
- PSR-1/PSR-12 are comparison guidance for new local code, not permission for
  formatting-only churn. Existing Dolibarr callback interfaces take priority.

## 8. Database and transaction architecture

### Ownership rules

- Activity planning, revisions, reviews, execution, exception requests, and
  reconciliation: `MjlActivityCommand`.
- Assignment changes: `MjlActivityAssignment`.
- Partner/Project/Operation Type writes: `MjlReferenceCommand`, using native
  `Societe` and `Project` adapters where currently required.
- Invitations, resets, OTP and native password effects: auth command; actual
  PHP/Dolibarr session mutation: the private auth session adapter invoked by
  auth orchestration/hooks after the relevant persistence boundary.
- Role/right/account changes and credential revocation: access command.
- Export generation/evidence: export workflow.
- Reads: procedural feature read modules orchestrating retained scoped query
  owners; a read result never authorizes a later write without fresh locks.
- DDL: activation and guarded CLI lifecycle entrypoints only. Runtime code may
  use the same definitions through exact read-only detectors/verifiers.

### Verified reference contract and target hardening

The nine-step contract below is **verified current behavior for the reference
write seam** and must be preserved without qualification when W3 replaces its
owner. It is the proposed target for other write owners, but the audit did not
verify that every current owner already satisfies every step:

1. Validate non-sensitive shape before opening a transaction.
2. Check `begin()` and stop before writes if it fails.
3. Lock actor/aggregate/dependent rows in a deterministic documented order.
4. Recompute entity, effective role, assignment, state, revision, and version
   eligibility from locked facts.
5. Perform native/custom writes and append audit in the same transaction.
6. Check every material DB/native return value.
7. Check `commit()`. A failed commit is failure, including no-op paths.
8. On failure, attempt rollback; if rollback fails, close/quarantine the
   uncertain connection before it can be reused.
9. Return success only after a successful commit. Never append a success audit
   after the commit as a separate transaction.

Unchecked `begin()` or rollback handling found in other current owners is
separately proposed hardening, not a guarantee established by this document.
Any such correction needs a separately approved behavioral substep and focused
failure-injection tests. W1-W7 structural relocation must preserve current
behavior and must not claim that moving code fixes transaction weaknesses.

An internal access mutation operation may join the invitation preparation
transaction: it never begins, commits, or rolls back, and propagates failure to
the auth owner. The standalone access command wraps that same operation while
preserving its current begin/commit/rollback behavior. Bringing that owner up
to the reference contract is a separate approval with focused fault injection.
This is transaction participation, not a second command owning a nested
transaction. During W3, the existing invitation caller
must switch to this operation in the same change that removes the old scope
writer; W4 subsequently relocates the auth owner without changing this contract.

Nested transactions are not a public feature. Native calls whose Dolibarr
transaction-depth behavior was audited may execute inside the owner; any new
native adapter must be characterized first.

SQL stays with the command or projection that owns its semantics. A private
query helper may hide repeated syntax inside one module. Cross-feature sharing
requires proof of identical entity, lock, visibility, ordering, null, and
historical-schema semantics. There is no generic query builder or
repository-per-table layer.

Database constraints and triggers remain architectural participants, not
legacy clutter. Retain exact definitions for append-only audit, one effective
role/admin exclusion, entity relationships, immutable revisions/evidence,
live-state uniqueness, and auth target rules. They protect concurrency and
alternate writers. Removal requires a verified replacement at the same trust
boundary plus explicit preservation-ledger remapping.

Clean-install SQL remains in `sql/`. Existing installations are changed only
by named, exact-state lifecycle transitions. MariaDB DDL implicit commits mean
activation is resumable, not falsely described as atomic. Named lifecycle
locks, exact predecessor/target/partial recognition, fail-closed unknown
states, checkpoint tests, and data-retaining module removal remain. Historical
branches are not deleted until an explicit compatibility decision identifies
the last supported predecessor.

## 9. Authentication and authorization architecture

Authentication behavior is unchanged. The target merely makes owners clear:

| Concern | Target owner | Invariants |
| --- | --- | --- |
| native login interception and hook results | Dolibarr hook adapter | with OTP enabled, native authenticated state without verified evidence is cleared/rejected |
| password verification and OTP state | auth command implementation | 10-minute challenge, five attempts, three resends, 60-second cooldown, bound hashes/HMACs, regenerated session |
| invitation issue/accept/revoke | auth command | Admin-only issue, inactive user plus one role, seven-day selector/verifier, digest only, row lock, single use, transaction-bound audit |
| password reset issue/consume | auth command | neutral response, throttling, one-hour selector/verifier, active-entity row, narrow entity-0 Admin exception, single use |
| native password write | private auth adapter | temporarily force encrypted-only mode; restore prior setting in `finally`; `llx_user.pass` remains `NULL` |
| session validity | pure auth/session policy | recompute credential/status/admin/entity/effective-role fingerprint and return a decision without changing session state |
| session mutation | private procedural auth session adapter | bind existing keys, apply/clear pending state, regenerate identity and execute invalidation only when invoked by auth orchestration/hooks |
| effective role | access policy | active native Admin -> `ADMIN_PLATEFORME`; non-admin -> exactly one active same-entity business role |
| Activity visibility | Activity policy/read projection | Agent requires current Activity assignment; Supervisor/Validator see all same-entity Activities; Admin denied business view |
| mutation authorization | route policy plus command locks | UI is advisory; direct route and locked command checks remain; DB invariants remain |
| no-self-validation | Activity command | exact revision contributor/prevalidator identities checked under lock |

The policy interface must ask action-specific questions such as
`canReadActivity(actor, entity, activityId)` or
`canManageReferences(actor, entity)`, not return a vague permission bag. The
command does not trust the answer across a transaction boundary; it reloads
the facts it needs. Technical Admin exceptions are narrow named cases, never a
general business bypass.

BC-018 is a permanent compatibility contract: every MJL invitation/reset
password write goes through the encrypted-only native adapter, and both
database assertions remain in the focused auth suite. Direct GET handling for
invitation/reset state changes (BC-017) must be characterized and, if
confirmed, corrected at the HTTP adapter without redesigning auth.

### Auth composition and delivery contract

The current call chain is `mjl_auth_issue_invitation()` ->
`mjl_scope_assign_access_profile()` -> `mjl_auth_record_event()`. It crosses
the proposed owners and currently nests transaction calls. The target removes
the reverse dependency: auth and access depend on the audit writer; access
does not depend on auth. The access implementation provides a narrowly scoped
internal role/right/revocation operation to its standalone command and the
invitation preparation owner. It accepts the existing connection and explicit
actor/entity, performs the same guards and writes, and appends the same audit
payloads inside the caller's transaction. It cannot return success after a
failed write, independently commit, or manufacture its own connection.

Preserve these existing completion boundaries from `mjl_auth.lib.php`:

1. Invitation/reset preparation persists `pending_send` credential state and
   issuance audit, then commits. Invitation preparation also includes native
   user creation and role/right assignment atomically.
2. The existing email adapter renders and sends only after that commit.
   Keep the current identity lock held through sending and delivery-result
   persistence; do not move SMTP inside a database transaction.
3. A separate transaction records `sent` or `send_failed`, the existing hash
   clearing behavior on failure, and delivery audit. A failure to persist a
   delivery result cannot undo either the preparation commit or the email.
   Preserve the current invitation error and neutral reset response; do not
   silently retry delivery or claim the whole workflow rolled back.

OTP issue/resend retains its own audited ordering: the new challenge is
committed before delivery, with existing delivery-failure handling and no
resurrection of the old code. On successful OTP verification, the credential
transaction commits before the private session adapter completes the
authenticated session and regenerates its identity. Failure/invalidation paths
preserve their current ordering and keys; native-login bypass protection still
clears/rejects an authenticated native session without verified OTP evidence.
Pure validity policy returns a decision and never mutates the session. The
email adapter owns transport/rendering, safe public
URL construction, its existing audit behavior, and disposable outbox guards;
auth owns credential state and sequencing. Production SMTP configuration is
outside this proposal, but delivery orchestration is explicitly inside W3/W4
characterization. No queue, outbox redesign, or retry framework is proposed.

One existing reverse call requires explicit relocation:
`mjl_email_write_test_outbox()` calls `mjl_auth_write_test_outbox()`. In W4,
move that capture helper and its pure configuration predicate
`mjl_auth_e2e_tokens_enabled()` into the email module while retaining their
procedural names. Update includes and all auth/email callers in the same
substep, with exactly one definition of each helper. Preserve the disposable
tenant and exposure flags, `MJL_AUTH_E2E_FAIL_AUTH_OUTBOX`, the
`auth-test-outbox/latest-<type>.json` path and payload, write failure results,
and the ban on placing auth secret bodies in SQL. This is ownership of an
existing test-capture mechanism, not a new public auth interface. Add capture
failure assertions to the W4 auth gate if absent before relocation.

W3 must characterize invitation failure after role assignment to prove user,
role, credential, and issuance audit roll back together. W4 must characterize
send failure and post-send persistence failure separately. These are missing
targeted proofs, not claims that the existing 12 auth tests cover each fault.

## 10. Frontend architecture

- A feature handler performs token issuance/consumption, recovery consumption,
  feedback draining and shell-eligibility preparation through the existing
  procedural helpers, then prepares a view model containing the resulting
  values, translated labels, eligibility flags, form tokens, versions and URLs.
  A pure presenter/template renders it and performs no query or session access.
- Preserve submission-token exactly-once behavior, the current 7,200-second TTL
  and 20-pending-token cap, context matching, mismatch non-consumption, and
  current partial-form recovery.
- Reusable HTML exists only for established recurring structures: shell,
  responsive table, feedback summary, form field, dialog mechanics, tabs, and
  action menu. Activity, exception, access, and reference semantics remain in
  their feature templates.
- Existing IDs, names, indexed Operation fields, 50-row limit,
  `data-partner-id`, version fields, submitter name/value, fragment handoff,
  navigation IDs, and dialog reparenting contracts remain until a focused
  migration changes producer and consumer together.
- New or migrated behavior binds to `data-mjl-*` attributes (for example,
  `data-mjl-dialog`, `data-mjl-operation-row`, `data-mjl-date-control`) rather
  than color/layout classes. During migration, templates may emit both old and
  new hooks; JS supports both only within one bounded wave, then the old hook
  and compatibility test are removed together.
- CSS classes describe presentation/component state. JS may toggle a documented
  state class or ARIA attribute, but must not infer behavior from an incidental
  spacing/color selector.
- Browser state remains in the DOM/form/session behavior already audited; no
  fetch/XHR or local/session storage architecture is introduced.
- `MjlFinance.summary` retains BigInt-safe integer-XOF handling, distinct null
  and zero, and malformed/negative/overflow rejection. Server validation stays
  authoritative.
- Shared form behavior retains HTML validity, French summaries,
  `aria-invalid`/`aria-describedby`, clicked submitter preservation,
  duplicate-submit guard, and dirty-navigation events.
- Navigation drawer retains the 980px breakpoint, owned `inert`, focus trap,
  focus restoration, backdrop, and Escape behavior. Dialogs keep reparenting
  rather than cloning CSRF/version/nonce-bearing forms.
- `core/tpl` remains for native auth overrides. Normal MJL templates live in
  `tpl/<feature>/`. No UI redesign or design-token decision is made here.

## 11. Module lifecycle architecture

`modMjlFinancement` continues to own the Dolibarr interface: metadata,
dependencies, rights definitions, menus, hooks, assets, cron registration,
`init()`, and `remove()`. It should not own the implementation of schema
recognizers or DDL steps.

Routes, policies, queries and commands may call the existing exact read-only
schema detectors/verifiers at their current paths. They share definitions with
activation and migration code, preserve the current result vocabulary,
fail-closed unknown-state handling, readiness cache and timeout/session-budget
restoration, and do not gain any install/apply/resume/rollback capability.

The descriptor acquires the existing database/prefix-scoped named lock, then
delegates the following distinct branches, preserving current dispatch:

| Entry/state | Permitted action |
| --- | --- |
| `init()`, genuinely empty installation | load base SQL, preserve clean-bootstrap normalization, chain the existing RST installers in order and verify each required target; honor only guarded disposable predecessor modes |
| `init()`, exact supported current state | verify the current schema, perform the existing auth/trigger initialization and replacement, then native module initialization; this includes source-characterized reactivation behavior |
| `init()`, exact older state requiring an upgrade | return failure with `MJL guarded migration required`; do not apply the upgrade |
| `init()`, partial or unknown/conflicting state | refuse activation; recognizing a resumable prefix does not authorize activation to resume it |
| guarded CLI migration, supported predecessor or exact known prefix | the explicitly invoked RST entrypoint owns apply/resume, its existing lock/authorization/preflight, exact steps and checkpoint verification |
| guarded CLI migration, unknown shape | refuse before migration writes |

After successful activation prerequisites, retain native `remove()`/`_init()`
registration ordering and return conventions. Release the activation lock in
`finally` on every path. CLI migrations retain their own existing lock scope;
do not nest a new descriptor lock around them. Delegating detector/installer
implementation must not broaden which entrypoint may perform DDL. Existing
schema-library, guarded CLI and SQL-resource locations stay stable; no
`scripts/lifecycle/` relocation is required.

Lifecycle modules own exact detection, DDL step order, failure injection points
used by disposable tests, and post-step verification. Production behavior must
not branch on test modes unless `MJL_DISPOSABLE_TEST_TENANT=1` and the mode is
explicitly supported. `remove()` continues to retain business data.

If a later extraction is necessary, inventory and change every caller,
`require`/`include`, dynamic lookup and SQL/resource path in one reversible
unit. Its rollback restores those code references together; it does not claim
to undo already committed MariaDB DDL. Activation refusal, named locks, guarded
migration dispatch and all retained checkpoints remain unchanged.

BC-019 is preserved exactly: `mjl_rst006b_detect_schema()` recognizes every
exact prefix accepted by `mjl_rst006b_is_known_prefix()` as partial, including
the drop and first three replacement Operation-check stages. Unknown shapes
remain fail closed. The interruption/resumption apply, exact-target verify,
and rollback matrix remains a required proof.

Cron registration stays in the descriptor; execution stays in
`MjlExecutionReconciler`, which calls the Activity command. Its current
fail-fast and `$conf->entity` semantics are not normalized until BC-008 and
BC-009 receive product/operational decisions.

## 12. Error handling and observability

Use existing platform mechanisms predictably. The DB failure rows are verified
current guarantees at the reference write seam. For other current owners they
describe the target only after separately approved, focused failure hardening;
structural relocation alone preserves rather than upgrades their behavior.

| Failure kind | Internal contract | User/runner result | Evidence/logging |
| --- | --- | --- | --- |
| invalid request shape/method/token | handler rejection before command | 400/403 or safe redirect with sanitized French feedback | no sensitive input in logs |
| expected business conflict | finite command code such as `FORBIDDEN`, `STALE_VERSION`, `INVALID_STATE` | handler maps once to stable feedback/status | failed mutation has no success audit |
| reference DB/native operation failure | verified rollback; quarantine connection if rollback uncertain | generic unavailable/error response | no dedicated current logging guarantee verified; any added structured logging is separately approved and contains no secrets |
| reference commit failure | verified failure, including no-op | generic failure | rollback/quarantine behavior verified; dedicated logging is only proposed future hardening |
| other owner DB/commit/rollback failure | preserve its characterized current behavior during structural moves; improve only in a separately approved fault-tested substep | current mapped response until hardening is approved | log only as currently characterized; proposed hardening must define its evidence |
| migration unknown/partial failure | throw/return at lifecycle seam; never continue initialization | activation failure and diagnostic CLI/log message | state/detector/checkpoint recorded without credentials |
| cron per-row failure | current run returns failure and stops until semantics are decided | Dolibarr cron failure | entity and last rowid/action recorded; no fabricated completion |
| export generation failure | no export record unless generation/evidence contract reaches its durable boundary | explicit HTTP error before headers where possible | spool cleanup outcome logged |
| export delivery read failure | preserve existing `GENERATED` meaning; define explicit transport termination in BC-003 wave | incomplete HTTP delivery, not reclassified generation | server error/correlation logged; never expose spool path |

Dolibarr event messages remain the UI adapter. They are not emitted inside
commands. Exceptions are for infrastructure/programming failures where the
caller cannot take a business branch; expected domain outcomes use finite
results. A universal exception wrapper or result framework is explicitly
rejected.

Audit events are immutable business/technical evidence, not debug logs.
Secrets, OTPs, verifiers, passwords, and raw sensitive request payloads never
enter either channel. Success audit is transaction-bound; rejected attempts
are logged/audited only where the existing security contract explicitly owns
such evidence.

## 13. Duplication strategy

| Audit category | Decision | Reason and target treatment |
| --- | --- | --- |
| UI vs route vs command vs DB authorization | leave intentionally duplicated | D4 defense in depth at different trust/lock boundaries; share vocabulary, never collapse checks |
| Activity/Operation/request ID and decimal parsing | reconcile first, then possibly centralize pure parsing | accepted inputs and French errors differ; characterize before one parser |
| business-role code lists | centralize canonical application vocabulary; preserve DB duplication | one application source reduces drift, while exact trigger checks remain independent |
| predecessor/current list/audit/report paths | defer/retain | selected by schema readiness; removal requires explicit supported-history decision |
| dialog movers | parameterize mechanics only | preserve exception reason state versus access/reference reset and dirty policies |
| client/server financial validation | leave intentionally duplicated | browser feedback and authoritative server enforcement have different trust roles |
| CSV/XLSX old/new helpers | reconcile reachability first | semantic equivalence and external/dynamic use are unproved |
| repeated historical/VUI tests | reconcile by behavior and maintained gate | delete only duplicated obsolete coverage; retain security/data-integrity proof |
| auth/application CSS token copies | defer to dedicated design task | current authority/test conflict must be resolved before consolidation |
| SQL fragments | centralize only within an owning command/projection | similar text does not prove same entity, lock, null, or historical semantics |

## 14. Testability architecture

The interface of each deep module is its primary test surface. Tests should
assert observable outcomes and survive private refactoring.

- **Characterization:** before moving a mixed responsibility, record current
  inputs, finite outcomes, redirects/view model, SQL-visible effects, and audit
  effects at the existing seam.
- **Unit:** pure parsing, XOF rules, safe paths, view-model preparation, and
  browser behavior can run without Dolibarr/database state.
- **Integration/DB:** command modules run against disposable MariaDB/Dolibarr
  tenants to prove locks, entity predicates, transactions, triggers, audit,
  and native adapters. In-memory repository substitutes are not proposed.
- **Authorization:** retain route/direct-URL tests, command tests after locks,
  and DB-guard tests. One layer cannot stand in for another.
- **Failure injection:** begin, commit, rollback, native adapter, spool read,
  and lifecycle checkpoint failures are injected at the smallest existing
  seam. Do not publish broad adapter interfaces solely for injection; protected
  methods or test-owned DB doubles may remain internal seams.
- **Migration:** each exact lifecycle prefix must apply, verify target, resume,
  and follow its supported rollback procedure in an isolated tenant.
- **Frontend:** test documented DOM hooks, ordinary fallback, form token/version
  preservation, accessibility state, and BigInt-safe calculations. Avoid
  assertions coupled only to formatting or stale visible labels.
- **Regression:** named commands must state their actual file discovery and
  timeout. A passing subset must not be called complete coverage.

Responsibilities that become independently testable are HTTP normalization
and result mapping, action-specific policies, command result contracts,
prepared view models/templates, projections, export delivery, and lifecycle
state classification. Tests of superseded shallow helpers should be removed
when equivalent tests at the new module interface exist; layering both suites
indefinitely is not a goal.

## 15. Residual medium risks and other audit findings

| Finding | Architectural effect | Required timing/disposition | Preservation impact |
| --- | --- | --- | --- |
| BC-001 resolved Admin reset | direct auth/entity seam | preserve in every auth move | SEC-AUTH-003, SEC-AUTHZ-001, DB-001/003, LIFE-001 |
| BC-002 resolved reference transaction | direct command/transaction seam | reference command wave cannot exit without failure contract | DB-001/002, RT-008/014 |
| BC-003 export `fread()` failure | direct export/HTTP-delivery seam | characterize and fix before or within export-handler migration; do not change `GENERATED` meaning | RT-012, DB-002 |
| BC-004 design assertions diverge | no backend seam; test authority issue | reconcile in a dedicated UI wave before CSS decomposition | frontend contracts only; no new preservation item |
| BC-005 unit command stalls | testability/runner seam | correct before using `test:unit` as a wave gate; focused direct tests remain usable | LIFE-002 indirectly |
| BC-006 incomplete discovery | verification architecture | named wave gates must list actual suites; runner fix can precede broad claims | LIFE-002 |
| BC-007 dormant shared-port test | test security boundary | remove with proof or add disposable preflight before it is ever run | LIFE-002 |
| BC-008 cron poison row/fail-fast | reconciler interface | decision required before reconciler behavior changes; current semantics may remain deferred | RT-015 |
| BC-009 cron entity context | lifecycle/cron seam | supported topology required before multi-entity refactor | DB-001, RT-015 |
| BC-010 DDL activation atomicity | direct lifecycle seam | every lifecycle wave preserves resumability; never promise atomic rollback | DB-003/004, LIFE-003 |
| BC-011 OTP resend before delivery | auth state model, low risk | defer unless UX decision requests change; preserve fail closed | SEC-AUTH-004 |
| BC-012 global export lock | export resource seam | defer until measured concurrency requires change | RT-012 |
| BC-013 export retry identity | export completion seam | decide before changing post-commit cleanup/retry behavior | RT-012, DB-002 |
| BC-014 predecessor audit cap | legacy projection, low risk | retain until predecessor retirement/completeness requirement | RT-011 |
| BC-015 Apache loaded state | deployment security fact | verify in deployment-specific security review, not architecture migration | SEC-DOC-001/002 |
| BC-016 external fonts | deployment/privacy, low risk | defer to explicit CSP/privacy/hosting task | none; approved visual authority applies |
| BC-017 password action method | direct auth HTTP seam | characterize direct GET and native dispatcher before auth-handler migration exits | RT-002/003, SEC-AUTH-001/003 |
| BC-018 resolved cleartext persistence | private native password adapter | preserve adapter and both DB assertions in auth wave | SEC-AUTH-006 |
| BC-019 resolved RST-006B prefix | lifecycle detector seam | preserve exact detector and full checkpoint matrix | DB-004, LIFE-003, RT-011 |
| BC-020 timeout accepts zero exit | runner seam | correct before deadline-aware gate is relied upon | LIFE-002 |
| BC-021 historical modes provision wrong target | runner/lifecycle compatibility | define each maintained baseline before lifecycle move/retirement | RT-011, LIFE-003 |
| BC-022 weakened auth schema accepted | lifecycle security seam | exact-definition check or explicit repair policy required before auth lifecycle extraction exits | DB-003/004, SEC-AUTH-004 |
| AUTH-F04 reset selector exposes full email before verifier proof (`06-authentication-state.md`) | reset presentation and selector lookup seam | masking remains an unapproved correction; preserve the current behavior during extraction, record it in W4 characterization, and reconsider when reset presentation/privacy changes are explicitly approved | no new compatibility requirement to retain the exposure permanently; SEC-AUTH-003 neutral request behavior is separate |

There are no unresolved CRITICAL or HIGH audit findings. Medium findings are
not treated as authorization to change behavior; the table specifies which
ones gate a particular migration wave and which stay deferred.

## 16. Incremental migration waves

No wave is authorized by this proposal. Each requires separate approval. A
wave is mergeable only if the application remains operational with unchanged
public URLs, schema, business behavior, and preservation contracts.

The commands below are proposed verification for later authorized migration
work, not commands run during this documentation task or blanket obligations
for future tasks. Select only the gates for the responsibility actually moved,
subject to `docs/mjl-acceptance-tests.md` and the user's current authorization.
Run all browser checks through the named disposable runner, never bare
Playwright against port 8080. Existing selector drift and runner limitations
in the regression baseline must be resolved for the selected gate before it
counts as proof. For any PHP/JS file actually edited, also run `php -l <file>`
or `node --check <file>` and `git diff --check`; these file arguments are
determined by that future diff.

### W0 — lock observable seams

- **Scope:** add or repair only the focused characterization needed for the
  first moved responsibility; make the selected runner's discovery explicit.
- **Rationale:** mixed modules cannot be split safely from source shape alone.
- **Affected:** selected route/command tests; BC-005/006/007/020 as necessary.
- **Prerequisites:** W1 is the reference-list GET slice; no shared tenant.
- **Preservation IDs:** LIFE-002 plus IDs owned by the selected slice.
- **Required tests/commands:** `php tests/contracts/table_presentation_test.php`,
  `php tests/contracts/project_form_security_test.php`, and
  `npm run test:vui10` (`vui-reference-management.spec.js`). Repair only drift
  blocking that selected gate. If runner behavior changes, use
  `node --test tests/unit/disposable-run.test.js tests/unit/disposable-policy.test.js`.
  Missing prerequisite: add direct unauthorized reference-list GET assertions
  to that existing disposable spec if its current UI assertions do not prove
  them. Do not use `npm test` as evidence.
- **Allowed:** characterization and runner safety only.
- **Forbidden:** runtime behavior, schema, or UI changes.
- **Rollback:** revert test/runner commit; no persistent state exists.
- **Exit:** focused test reliably discovers and proves the current seam.

### W1 — extract one HTTP/presentation slice

- **Scope:** start with the reference-list GET surface, separate handler,
  prepared view data, and template while
  keeping root URL and output contract.
- **Rationale:** proves the target request path without touching core writes.
- **Affected:** one root adapter, its route library, presentation helpers,
  existing form/feedback/navigation helpers and template; no command internals.
- **Prerequisites:** W0 contract for the selected route.
- **Preservation IDs:** RT-001–003/010/011/014 and applicable SEC-AUTHZ/DB-001.
- **Tests/commands:** `php tests/contracts/table_presentation_test.php`,
  `php tests/contracts/project_form_security_test.php`, and
  `npm run test:vui10`; preserve list visibility, direct-route denial,
  native reference identity and form contracts. W0 supplies any missing
  direct-GET characterization before extraction.
- **Allowed:** responsibility move, equivalent markup, dual old/new DOM hooks
  inside the wave. The handler must perform token issue/consume, recovery
  consume, feedback drain and shell preparation before pure rendering where
  the selected slice currently uses those effects.
- **Forbidden:** query, role, filter, route, label, or workflow redesign.
- **Rollback:** switch the root adapter require/call back to the old route
  function in the same commit revert; no data conversion.
- **Exit:** identical authorized/forbidden outcomes and usable rendered screen;
  old render path removed, not retained as a parallel architecture.

### W2 — Activity HTTP and presentation separation

- **Scope:** split `mjl_activity_route.lib.php` into handler, procedural
  monitoring read orchestration, pure view preparation and templates; keep
  `MjlActivityCommand` and `MjlMonitoring` interfaces unchanged.
- **Rationale:** largest mixed route and most valuable investigation gain,
  while protecting the already deep aggregate seam.
- **Affected:** Activity root/route/form/access/presentation libraries, the
  monitoring read module used for Activity list/detail/review, existing
  token/recovery/feedback/navigation helpers, and Activity JS DOM contract.
- **Prerequisites:** W1 pattern accepted; Activity route characterization.
- **Preservation IDs:** RT-001–011, SEC-AUTHZ-003/004, DB-001/002.
- **Tests/commands:** use `npm run test:vui03` for the Activity list,
  `test:vui04` for planning forms, `test:vui05` for detail/workspace, and
  `test:vui06` for review (each with the `npm run` prefix). Use
  `node --test tests/unit/mjl-financial-preview.test.js` for financial form
  extraction. `npm run test:phase2` covers planning mutations/navigation when
  POST dispatch moves. Execution/exception handlers are separate substeps:
  `npm run test:vui07` / `npm run test:vui08` cover their UI; the affected
  `npm run test:phase3a` command supplies execution/DB guards when approved.
  Before extraction, add focused snapshot begin/commit/read-failure and
  DB-session budget restoration assertions where absent. Add form-effect
  characterization for exactly-once token/recovery consumption, token
  TTL/cap/context mismatch non-consumption and feedback drain. Do not claim
  GET-only VUI proof covers locked command behavior.
- **Allowed:** handler/template extraction and documented compatible hooks.
- **Forbidden:** aggregate command split, state/financial/assignment/review
  changes, DOM redesign, broad Phase 3A rerun without affected behavior.
- **Rollback:** revert handler/template switch; schema/data unchanged.
- **Exit:** request -> policy -> command/query -> presenter is traceable, and
  every old read/render/session-effect responsibility has one new owner.
  Monitoring handlers may call this same read implementation until W5; W2
  does not create `MjlActivityQuery` or move dashboard/alerts presentation.

### W3 — reference and access write ownership

- **Scope:** replace stateful procedural reference and access mutations with
  deep command modules; keep HTTP handlers and native object behavior.
- **Rationale:** transaction and role/right writes need explicit owners.
- **Affected:** `mjl_reference.lib.php`, `mjl_scope.lib.php`, reference/access
  handlers, new command classes, and the existing invitation caller switching
  to the transaction-participating access operation in the same substep.
- **Prerequisites:** exact current outcomes characterized; effective-role
  vocabulary reconciled without weakening DB definitions.
- **Preservation IDs:** RT-002–004/008/014, SEC-AUTHZ-001/002/004,
  DB-001–003, LIFE-001.
- **Tests/commands:** `php tests/contracts/reference_transaction_test.php`;
  adapt that contract to the replacement command interface while retaining
  every fault assertion. Use `npm run test:vui10` for reference UI,
  `npm run test:rst003` (`partner-project.spec.js`) for native reference
  behavior, and `npm run test:vui11` for access administration. Use
  `node --test tests/unit/access-audit-fail-closed.test.js` for its source
  guard assertions, not DB proof. The access/invitation substep also requires
  `npm run test:auth`, extended before the move with the missing injected
  post-role-assignment failure assertion in `authentication.spec.js` to prove
  atomic user/role/credential/audit rollback.
- **Allowed:** replace old functions atomically at callers, preserve outcomes.
- **Forbidden:** generic repository, Admin business authority, trigger removal,
  accepting failed begin/commit at the verified reference seam, silently
  hardening access transaction failure behavior without separate approval and
  focused fault proof, changing Partner cascade/Project identity.
- **Rollback:** revert callers and new classes together; no schema change.
- **Exit:** one transaction owner per write, old mutation helpers deleted when
  no callers remain, direct failure contract passes.

### W4 — authentication responsibility split

- **Scope:** put invitation, reset, OTP and password effects behind cohesive
  auth command interfaces; put PHP/Dolibarr session mutation behind one private
  procedural auth session adapter; keep hooks/templates/URLs.
- **Rationale:** `mjl_auth.lib.php` mixes several security state machines and
  adapters, but those flows share identity locks and credential invalidation.
- **Affected:** auth library, `auth.php`, `invitation.php`, hook adapter, auth
  templates/presentation.
- **Prerequisites:** BC-017 direct-GET characterization; BC-022 exact auth
  schema decision/check; W3 composition contract established. Production SMTP
  setup remains outside the wave; delivery orchestration stays in scope.
- **Preservation IDs:** RT-001–004/014, SEC-AUTH-001–006,
  SEC-AUTHZ-001/002/004, DB-001–004, LIFE-001/003.
- **Tests/commands:** `npm run test:auth` (`authentication.spec.js`). Missing
  prerequisites, added to that same disposable gate before extraction: direct
  GET mutation characterization, send failure, post-send persistence failure,
  and selector-only email disclosure characterization (AUTH-F04). Add exact
  weakened-auth-schema refusal/repair-policy proof to its disposable lifecycle
  setup before relying on BC-022; this proof does not exist merely because
  clean activation passed. Add explicit ordering proof that successful OTP
  persistence commits before authenticated-session completion/regeneration,
  plus current invalidation keys/order and native-login bypass assertions.
  Preserve the 12 baseline cases and both encrypted storage assertions; do not
  require the suite count to remain 12.
- **Allowed:** internal ownership changes and smallest confirmed method guard.
- **Forbidden:** auth redesign, token lifetime/policy change, plaintext fallback,
  entity exception widening, public registration.
- **Rollback:** revert the complete caller/module replacement; DB schema and
  credential rows remain compatible.
- **Exit:** 12/12 baseline behaviors plus new method/schema characterization
  pass; both `llx_user.pass IS NULL` assertions remain.

### W5 — reporting/export and frontend contracts

- **Scope:** separate report HTTP, procedural preview snapshots, renderers,
  durable generation and delivery; in an independently mergeable monitoring
  substep migrate dashboard/index, alerts and their presentation onto W2's
  monitoring read module; incrementally introduce behavioral data hooks and
  split only proven frontend modules/CSS sections.
- **Rationale:** exports cross distinct completion boundaries and frontend
  coupling makes investigation difficult.
- **Affected:** report routes/data/render/UI, `MjlExport`, spool, streaming;
  monitoring dashboard/index/alerts handlers and presentation; relevant
  templates/JS/CSS. The retained `MjlMonitoring` query owner is not moved.
- **Prerequisites:** BC-003 failure injection; BC-004 authority reconciliation;
  BC-013 retry decision if cleanup/retry is touched; existing monitoring filter,
  permission, unavailable-state and URL assertions; add missing alerts
  assertions before the monitoring substep.
- **Preservation IDs:** RT-001/002/010–012/014, SEC-AUTHZ-004, DB-001/002,
  plus all frontend contracts in section 10.
- **Tests/commands:** `node --test tests/unit/report-format.test.js
  tests/unit/export-spool.test.js tests/unit/monitoring-reports.test.js`;
  `npm run test:vui12` (`vui-history-exports.spec.js`) for presentation.
  The monitoring substep requires `npm run test:vui09` for dashboard/monitoring
  browser coverage and focused alerts assertions added to that disposable gate.
  Moving snapshot/authorization/evidence logic additionally needs
  `npm run test:phase3b` (report/export recovery specs); its scope includes
  several reports and must be explicitly selected for that substep. Missing
  prerequisite: extend `export-recovery.spec.js` with server-side read-failure
  injection and preserved `GENERATED` evidence; client-abort coverage is not
  equivalent. Design assertion corrections use
  `node --test tests/unit/design-system-v3.test.js` only for touched CSS.
- **Allowed:** seam extraction, equivalent renderer ownership, bounded dual DOM
  hooks, explicit read-failure handling. Any touched shared presentation path
  keeps session-backed token/recovery/feedback/shell effects in the handler and
  passes only prepared values to the renderer.
- **Forbidden:** format/filter/filename/audit meaning changes, global-lock
  redesign without workload evidence, UI redesign.
- **Rollback:** old handler/renderer switch restored; generated records retain
  their existing meaning and no schema rollback is needed.
- **Exit:** generation and delivery failures are distinguishable, artifacts
  remain private, authorization is freshly locked, old duplicate path removed;
  dashboard/index and alerts preserve filters, permissions, unavailable states,
  URLs and visible behavior through the shared W2 read implementation.

### W6 — lifecycle delegation

- **Scope:** reduce descriptor `init()` to explicit orchestration by delegating
  to existing exact detector/installer implementations at their current paths,
  without changing DDL, states, guarded entrypoints or SQL-resource locations.
- **Rationale:** lifecycle is high risk and should move only after runtime
  responsibility patterns are proven.
- **Affected:** descriptor, every changed caller/include/resource lookup, the
  retained RST installers/detectors and focused runner modes.
- **Prerequisites:** BC-020 fixed; BC-021 maintained baselines defined; BC-022
  resolved; complete current checkpoint inventory.
- **Preservation IDs:** RT-011/014, DB-003/004, LIFE-001–004.
- **Tests/commands:** `npm run test:phase3a` for RST-006B-affecting moves;
  `npm run test:rst002b` for assignment and `npm run test:rst006a` for planning
  detectors, only after BC-021 provisions and verifies their exact predecessor.
  `npm run test:phase3b` exercises the export target but is not an RST-012
  interruption matrix. Missing prerequisites: add RST-012 detector/transition
  characterization to that runner mode before moving its lifecycle code; add
  clean/current-reactivation/older-state-refusal/partial-state-refusal cases to
  the auth runner's lifecycle setup for descriptor extraction. RST-005/shared
  operational tooling remains at its current paths. No suite may claim those
  missing proofs until its added assertions actually run. Add focused runtime
  schema-refusal/cache/budget-restoration and lifecycle loading/include/resource
  checkpoint characterization before changing the relevant call graph.
- **Allowed:** delegate exact logic at current paths and improve state
  diagnostics without accepting new states. A necessary extraction is one unit
  containing every changed caller, include and SQL/resource lookup.
- **Forbidden:** generic migration framework, DDL/schema changes, silent repair,
  broad test-mode forwarding, removal of historical support.
- **Rollback:** revert descriptor delegation and every changed caller/include/
  resource path as one code unit; interrupted disposable tenants use the
  already proven resume/rollback path and are torn down. Code rollback is not
  represented as reversing committed DDL.
- **Exit:** exact-state and every maintained interruption matrix pass; descriptor
  contains declarations/orchestration rather than detector implementations.

### W7 — prove and remove residual duplication/dead candidates

- **Scope:** first candidate is the unused Activity access wrapper pair
  (`mjl_activity_access_can_mutate`, `mjl_activity_access_require_mutation`)
  after runtime/dynamic caller proof. Other listed candidates remain deferred
  until a candidate-specific removal proposal supplies its own exact gate.
- **Rationale:** cleanup follows ownership migration; it does not lead it.
- **Affected:** the two Activity access wrappers in
  `lib/mjl_activity_access.lib.php` and their proven obsolete references.
  The other five helpers, recovery libraries, export helpers, dormant CSS/tests,
  and `project_note` remain retained candidates under section 18.
- **Prerequisites:** repository/dynamic reachability proof and explicit
  compatibility decision where applicable.
- **Preservation IDs:** RT-002/004, SEC-AUTHZ-003/004, DB-001; LIFE-002 for
  disposable browser verification.
- **Tests/commands:** `rg -n 'mjl_activity_access_(can_mutate|require_mutation)'
  custom tests` plus dynamic registration/include inspection;
  `node --test tests/unit/access-audit-fail-closed.test.js` and
  `npm run test:vui03` for retained list access. A text search alone cannot
  prove external invocation absent; if caller evidence remains inconclusive,
  retain the pair and defer this wave instead of claiming a successful removal.
- **Allowed:** `REMOVE_WITH_PROOF` deletion and stale caller/doc/test removal.
- **Forbidden:** speculative deletion, schema removal bundled with code cleanup,
  weakening defense-in-depth duplication.
- **Rollback:** revert candidate-sized commit; schema changes require their own
  separately approved reversible lifecycle design.
- **Exit:** no live/dynamic caller, replacement behavior proven, all stale
  references removed together.

## 17. Traceability matrices

### Architecture decisions

| Decision | Audit findings/evidence | Current files/symbols | Preservation | Regression evidence | Target responsibility | Wave |
| --- | --- | --- | --- | --- | --- | --- |
| TA-01 stable thin Dolibarr adapters | D-01/D-13; request map | root routes, `mjl_*_route` | RT-001–003 | route/PHP/VUI contracts | web adapter + handler | W1/W2/W4/W5 |
| TA-02 preserve deep Activity aggregate | dependency map calls it deepest module; workflow map | `MjlActivityCommand` public commands/private locks | RT-004–009, DB-001/002 | Phase 3A and focused workflow tests | workflow command | W2 |
| TA-03 action-specific policies with locked reauthorization | authorization map/D4 duplication | scope/access helpers, assignment checks | SEC-AUTHZ-001–004, RT-002/004 | access-audit, auth, Phase 3A | policy + command | W2–W4 |
| TA-04 one transaction owner per write | BC-002/database map | reference, scope, auth, assignment, Activity | DB-001/002, RT-008/014 | verified reference failure contract; focused failure tests before other hardening | workflow commands | W3/W4 |
| TA-05 feature snapshots use retained scoped queries | monitoring/report map | `MjlMonitoring`, Activity/monitoring/report route snapshots | RT-010/012, DB-001/002 | snapshot failure/budget restoration plus monitoring/report contracts | procedural feature read modules + retained query owner | W2/W5 |
| TA-06 handlers complete request-state effects before pure rendering | frontend and route coupling | route render functions, form/recovery/feedback/navigation helpers | RT-002/003 plus frontend contracts | effect characterization plus PHP/VUI/accessibility checks | handler + presenter/template | W1/W2/W5 |
| TA-07 data hooks define browser behavior | frontend contract audit | `mjl_components.js`, Activity/form JS, CSS | client/server and form contracts | browser/unit JS tests | browser feature module | W2/W5 |
| TA-08 descriptor delegates existing lifecycle functions in place | D-08/D-12, BC-010/019/021/022 | `modMjlFinancement::init`, RST detectors/installers, callers/includes/resources | RT-011, DB-003/004, LIFE-001–004 | runtime refusal and Phase 3A/RST/loading matrices | descriptor + retained schema libraries | W6 |
| TA-09 keep DB triggers/invariants | database/authorization maps | SQL triggers and `ensure*` | SEC-AUTHZ-004, DB-003 | auth/Phase 3A DB assertions | DB boundary | all relevant |
| TA-10 export generation distinct from delivery | BC-003/012/013; current architecture | `MjlExport::generate`, spool, `reportexport.php` | RT-012, DB-002 | export spool/source E2E plus new read failure | export workflow + HTTP | W5 |
| TA-11 no speculative abstraction | duplication/dead-code audits | flat libs and candidates | all as touched | candidate-specific | deepest existing seam | all |
| TA-12 auth state behind cohesive owner and one private session adapter | auth-state map, BC-017/018/022 | `mjl_auth.lib.php`, hooks/routes/session keys | SEC-AUTH-001–006, DB-001/003 | `npm run test:auth` plus commit/session ordering | auth command + private procedural session adapter | W4 |
| TA-13 preserve composed access writes and auth delivery phases | authentication/request/database maps; current invitation/reset call chains | `mjl_auth_issue_invitation`, `mjl_scope_assign_access_profile`, `mjl_auth_record_event`, email adapter | SEC-AUTH-001–004, SEC-AUTHZ-002, DB-002 | auth suite plus explicitly missing composition/delivery fault cases | transaction-participating access operation, audit writer, auth owner and email adapter | W3/W4 |
| TA-14 runtime schema recognition is read-only | current Activity/monitoring/export readiness callers and exact RST detectors | Activity/monitoring access, export checks, current schema libraries | RT-011, DB-003/004 | refusal/cache/timeout restoration characterization | runtime callers -> retained exact read-only detectors | W2/W4/W5/W6 |
| TA-15 monitoring dashboard/alerts have an explicit migration | current `index.php`, `alerts.php`, monitoring route/UI | monitoring handlers, `MjlMonitoring`, presentation | RT-001/002/010/011, DB-001 | `npm run test:vui09` plus alerts prerequisites | W2 read module reused by W5 monitoring substep | W5 |

### Correction register

Document 18 remains the immutable original independent review. This register
records how its seven required corrections are incorporated here:

Independent standards and specification correction reviews passed after the
AR-REV-006 evidence distinction and two low evidence/mapping findings were
reconciled. This review outcome does not freeze the proposal or authorize a
migration wave.

| Correction | Revised sections | Current evidence preserved | Resolution |
| --- | --- | --- | --- |
| AR-REV-001 runtime schema checks | 3–6, 8, 11, W2/W4/W5/W6, TA-14 | Activity/monitoring/export readiness callers; exact RST detectors; unknown denial, cache and timeout restoration | runtime exact read-only recognition allowed; DDL operations remain activation/guarded-CLI only; no registry |
| AR-REV-002 read snapshots | 3–6, 8, W2/W5, TA-05 | current Activity monitoring context and monitoring/report repeatable-read orchestration | procedural feature read modules own snapshot lifecycle; retained `MjlMonitoring` owns scoped SQL |
| AR-REV-003 monitoring wave | 5–6, W5, TA-15 | `index.php`, `alerts.php`, monitoring handlers and VUI09 | independently mergeable W5 substep reuses W2 reads and preserves behavior |
| AR-REV-004 form effects | 3–6, 10, W1/W2/W5, TA-06 | submission token store, recovery, feedback and navigation helpers | handlers execute session-backed effects; pure rendering receives values |
| AR-REV-005 auth session ownership | 3–6, 8–9, W4, TA-12 | OTP verify/complete-session order, session keys, fingerprint and native-login guard | one private procedural session adapter; policy is pure; commit precedes session completion |
| AR-REV-006 transaction guarantees | 8, W3/W4, TA-04 | verified reference begin/commit/rollback/quarantine contract | verified preservation separated from unapproved hardening of other owners |
| AR-REV-007 lifecycle closure/rollback | 3–6, 11, W6, TA-08 | current schema/CLI/SQL locations, locks, BC-019 checkpoints | delegation in place; any extraction includes callers/includes/resources; code rollback does not reverse DDL |

### Preservation ledger placement

| Preservation ID | Target owner after migration | Wave/proof |
| --- | --- | --- |
| RT-001 | root web/denial/dynamic-asset adapters | W1/W2/W4/W5 route contracts |
| RT-002 | feature handler route policy | every HTTP wave direct-route proof |
| RT-003 | feature handler CSRF and session-backed submission-token effects; pure presenter receives prepared values | W1/W2/W5 route and exactly-once/TTL/cap/context proof |
| RT-004 | locked workflow command authorization | W2–W4 DB/command tests |
| RT-005 | `MjlActivityCommand` | W2 characterization; interface retained |
| RT-006 | Activity review command | W2 focused no-self-validation proof |
| RT-007 | Activity command and server financial rules | W2 PHP/Phase 3A proof |
| RT-008 | command expected-version checks | W2/W3/W4 stale-write proof |
| RT-009 | Activity exception/reconciliation commands | W2 focused Phase 3A proof |
| RT-010 | retained `MjlMonitoring` plus monitoring/report feature read modules | W2/W5 scoped snapshot/failure/budget tests and VUI09 |
| RT-011 | runtime readiness policies calling retained read-only exact detectors; guarded lifecycle operations | W2/W4/W5 refusal/cache tests and W6 exact-state/RST tests |
| RT-012 | export workflow and spool | W5 export/read-failure tests |
| RT-013 | dependency-free denial routes | unchanged; document containment contract |
| RT-014 | private native adapters inside owning commands | W3/W4/W5 native-boundary contracts |
| RT-015 | reconciler -> Activity command | unchanged until BC-008/009 decision |
| SEC-AUTH-001 | auth/access handler and auth command | W4 auth E2E |
| SEC-AUTH-002 | auth command token implementation | W4 auth E2E/DB assertions |
| SEC-AUTH-003 | reset command with named Admin exception | W4 12/12 baseline |
| SEC-AUTH-004 | OTP command/state plus private session adapter at the post-commit point | W4 auth E2E and commit-before-session-completion proof |
| SEC-AUTH-005 | hook adapter, pure session-validity policy and private session adapter | W4 invalidation order/keys and native-bypass proof |
| SEC-AUTH-006 | encrypted-only native password adapter | W4 both `pass IS NULL` assertions |
| SEC-AUTHZ-001 | effective-role policy plus DB invariant | W3/W4 role/admin tests |
| SEC-AUTHZ-002 | access command | W3 Admin-only/revocation tests |
| SEC-AUTHZ-003 | Activity policy/projection plus locked command | W2 assignment visibility/mutation tests |
| SEC-AUTHZ-004 | UI, handler, command, DB layers | all applicable wave gates |
| SEC-DOC-001 | dependency-free denial routes | unchanged containment contract |
| SEC-DOC-002 | Apache/native guard plus no public links | unchanged; deployment check later |
| DB-001 | every command/projection and schema relation | entity assertions in every DB wave |
| DB-002 | verified reference transaction/audit contract; current behavior preserved elsewhere pending approved hardening | W2–W5 owner-specific failure/audit contracts |
| DB-003 | SQL definitions and exact lifecycle checks | W3/W4/W6 DB assertions |
| DB-004 | retained exact detectors and guarded installers at current paths | runtime refusal plus W6 loading/interruption/resume matrix |
| LIFE-001 | guarded bootstrap and lifecycle | W4/W6 clean-tenant assertion |
| LIFE-002 | disposable runner/fixtures | W0 and every container suite teardown |
| LIFE-003 | lifecycle state classifier | W6 exact predecessor/current checks |
| LIFE-004 | bootstrap-only native-module disablement | unchanged operational-script contract |

All 35 preservation requirements have a target owner and proof location.

### Investigation-ergonomics simulations after correction

These six source-tracing simulations recheck the same scenarios used by the
original independent review; they assess ownership clarity, not runtime proof.

| Scenario | Revised investigation path | Result |
| --- | --- | --- |
| technical Admin cannot reset | reset HTTP/hook -> auth command and narrow entity rule -> encrypted-only adapter/DB guards -> committed OTP state -> private session adapter | improved: session mutation and post-commit ordering are explicit |
| Agent sees unauthorized Activity | handler -> Activity policy -> retained read-only readiness detector -> procedural monitoring read snapshot -> `MjlMonitoring` entity/assignment query -> prepared view | improved: runnable readiness and current list/detail/review ownership are explicit |
| false success saving reference | handler -> `MjlReferenceCommand` -> verified checked begin/write/commit/rollback/quarantine -> finite result/feedback | equivalent and direct; verified guarantee is no longer generalized |
| unauthorized exported rows | report handler -> reporting snapshot/scoped projection -> renderer/private spool -> fresh locked authorization/evidence -> stream | equivalent; read snapshot and write authorization remain separate |
| partial reconciliation | descriptor cron registration -> reconciler entity/cursor -> Activity command transaction -> failure result/log | equivalent; BC-008/009 behavior remains deliberately unchanged |
| interrupted RST-006B | activation recognition/refusal -> guarded CLI -> retained exact detector/current includes/resources -> checkpoint/resume -> exact target verification | improved: no mandatory relocation and rollback limits are explicit |

All six are now improved or acceptably equivalent; none requires a new generic
framework or a runtime change in this proposal task.

## 18. Decisions deferred

| Decision | Why deferred | Reconsider when |
| --- | --- | --- |
| namespaces, PSR-4, Composer autoload | no audited defect justifies ecosystem-wide churn; Dolibarr naming/discovery is working | class discovery or collision becomes a measured problem after responsibility migration |
| static-analysis/format tooling | no configured baseline; current runner already has discovery/environment debt | a specific defect class and bounded baseline justify it |
| splitting `MjlActivityCommand` externally | current audit identifies it as a deep cohesive aggregate module | its public interface or change history proves two independently owned aggregates, not merely file length |
| exact auth class count | invitation/reset/OTP share locks and credential invalidation; premature splitting risks shallow pass-throughs | W4 design can demonstrate independently deep interfaces and no circular state coupling |
| deeper CSS/JS decomposition | design assertions conflict with source and dormant selectors are unresolved | authoritative design reconciliation plus producer/consumer characterization |
| legacy helper removal | dynamic/external reachability unproved | W7 `REMOVE_WITH_PROOF` evidence exists |
| historical migration/branch removal | supported predecessor horizon not decided | explicit lifecycle compatibility decision names the oldest supported state |
| `project_note` table removal | schema-only reachability but lifecycle compatibility matters | separate schema decision and reversible migration are approved |
| cron continue-on-error/multi-entity semantics | product/operational behavior unknown | supported entity topology and batch failure policy are approved |
| export concurrency/retry identity | no workload evidence and completion semantics unresolved | measured demand or BC-013 decision |
| Phase 4 documents/accounting/official reports | explicitly gated product scope | fresh user request and canonical decision update |
| production CSP/font/email/base URL/secrets | production preparation explicitly deferred | user requests deployment/readiness work |

## 19. Acceptance criteria for architecture approval

The proposal is approvable when reviewers can answer yes to all of the
following; approval still does not authorize implementation.

- All 35 preservation requirements have an explicit target owner and proof.
- Every high-risk/high-complexity current responsibility is mapped, including
  Activity, auth, scope/access, references, exports, lifecycle, frontend, and
  verification infrastructure.
- No current important responsibility or dead-code candidate is orphaned.
- Dependency direction is acyclic: adapters/handlers depend on policies,
  commands, projections, and presentation; none depends back on HTTP/UI.
- Dolibarr bootstrap, hooks, descriptor, native objects, CSRF, event messages,
  libraries, and file conventions remain compatible.
- Entity isolation, transaction/audit coupling, triggers, exact definitions,
  nullable financial semantics, and integer-XOF invariants remain mapped.
- Invitation, OTP, reset, technical Admin, encrypted-only password storage,
  effective role, assignment, and no-self-validation invariants remain mapped.
- RST-006B prefixes, lifecycle lock, fail-closed unknown states, interruption
  checkpoints, data-retaining removal, and bootstrap invariants remain mapped.
- Every known PHP/template/JS/CSS contract has an incremental compatibility
  strategy; no UI redesign is smuggled into architecture work.
- Every migration wave can merge independently, has focused verification,
  forbids functional changes, and has a code rollback without business-data
  reversal.
- Every residual medium risk either gates a named wave, influences a seam, or
  is explicitly deferred with a decision trigger.
- No proposed module fails the deletion test or exists only for aesthetic
  symmetry, mocking, or hypothetical future reuse.

## Adversarial review and revisions

This section records a separate attempt to break the initial design. The
proposal above already includes the resulting revisions.

| Attack | Weakness found | Impact | Revision made | Recheck result |
| --- | --- | --- | --- | --- |
| over-engineering | initial role model could imply handler, policy, command, repository, and adapter classes for every route | navigation and boilerplate worse than today | retained procedural handlers/policies, rejected repositories and single-implementation interfaces, applied deletion test | no HIGH concern; module creation now evidence-gated |
| Dolibarr compatibility | moving all templates/classes behind namespaces or a container would conflict with discovery and globals | activation/hooks/routes could fail | deferred namespaces/PSR-4/container; kept root routes, descriptor, hooks, native templates and adapters | no HIGH concern |
| hidden PHP/template coupling | templates could call policy/query helpers during extraction | recreated mixed route behind includes | required prepared view data and forbade DB/policy calls in templates | trace is one direction |
| hidden template/JS/CSS coupling | switching directly to data hooks could break existing selector consumers | broken forms/dialog/focus behavior | required bounded dual-hook migration with producer/consumer removal in one wave | compatibility is explicit |
| service/session coupling | auth or business commands could read globals implicitly | tests and entity semantics remain opaque | globals captured at adapters; one named private auth session adapter is the sole deeper-session exception; pure validity policy returns decisions | no proposed cycle |
| policy/command cycle | a command calling a route policy that itself uses projections could create a cycle | authorization hard to trace and stale facts trusted | route policy is advisory; command owns separate locked checks and canonical pure vocabulary only | acyclic dependency retained |
| authorization weakening | centralizing policy could remove UI/route/command/DB duplication | direct/concurrent bypass | explicitly preserved all four trust layers and DB definitions | no HIGH security concern |
| Admin exception widening | a generic Admin override could enter business workflows | privilege escalation | Admin exception named only in reset entity rule; business commands continue rejecting Admin | invariant retained |
| password regression | native adapter extraction could restore cleartext behavior or leak config mutation | credential exposure | kept encrypted-only adapter private, `finally` restoration, and two DB assertions as W4 exit criteria | BC-018 protected |
| transaction abstraction | a generic transaction wrapper could mishandle native nesting, commit failure, or rollback failure | partial writes/false success | preserved the verified reference contract; classified equivalent handling elsewhere as future owner-specific hardening; no generic wrapper | BC-002 protected without inventing current guarantees |
| export completion | combining generation and stream could erase `GENERATED` evidence or retry semantics | audit corruption/duplicate records | retained two completion boundaries; BC-003/013 gate delivery changes | medium questions remain bounded |
| DDL rollback assumption | a conventional migration transaction would be false under MariaDB implicit commits | unrecoverable activation | kept exact detectors/checkpoints/resumption and rejected generic migration framework | BC-010/019 protected |
| old/new coexistence | parallel implementations could diverge over long migrations | double ownership and ambiguous fixes | every wave replaces one caller slice and removes the old path before exit; dual DOM hooks are wave-bounded only | medium migration risk accepted per wave |
| cron extraction | normalizing errors/entities without decisions could change durable partial progress | skipped or duplicated reconciliation | left reconciler behavior unchanged until BC-008/009 decisions | explicitly deferred |
| investigation ergonomics: Activity authorization | too many public seams could make route-to-lock tracing harder | slower security diagnosis | fixed path to root -> Activity handler -> route policy -> `MjlActivityCommand` locked checks -> DB; private helpers remain internal | easier than current mixed route |
| investigation ergonomics: authentication | splitting each state into tiny modules would scatter one credential lifecycle | harder incident response | proposed one cohesive auth owner initially, with hooks/HTTP as adapters | direct login/reset/OTP trace |
| investigation ergonomics: DB failure | shared repositories would hide transaction owner | uncertain rollback/audit behavior | SQL remains local to named command/projection; transaction contract visible at command | owner identifiable |
| investigation ergonomics: export | renderer, evidence, and stream could obscure failure boundary | misleading audit interpretation | named export workflow and HTTP delivery seam; `GENERATED` semantics documented | two boundaries traceable |
| investigation ergonomics: migration | descriptor delegation could hide order | activation diagnosis harder | descriptor keeps explicit sequence; lifecycle modules keep RST names/checkpoints | order remains visible |
| investigation ergonomics: cron | generic job framework would obscure partial commits | harder recovery | no framework; reconciler calls Activity command and records last failure context | current behavior traceable |
| independent review: auth/access composition | invitation called a transaction-owning access helper which called auth audit | ambiguous transaction ownership and reverse dependency | section 9 defines internal transaction participation and independent audit dependency; W3 updates the existing caller atomically | concrete composition mapped |
| independent review: delivery and email ownership | auth preparation/send/finalize and email responsibilities were omitted | potential credential-state or failure-behavior change | preserved phases, locks, transport/audit/outbox owners and missing fault tests; W4 relocates the guarded capture callback | no auth/email reverse dependency in target |
| independent review: lifecycle dispatch | generic activation sequence could imply automatic upgrades | unauthorized DDL or invalid partial-state acceptance | explicit activation/refusal branches separate from guarded CLI apply/resume | current dispatch preserved |
| independent review: residual risks and wave gates | AUTH-F04 and concrete verification commands were missing | incomplete risk disposition and unverifiable migration exits | explicit privacy deferral, named existing gates and missing prerequisites; unsupported historical work stays deferred | evidence limits remain visible |
| correction review: runtime schema recognition | runtime readiness would violate a blanket lifecycle dependency ban | unavailable or harder-to-diagnose Activity/monitoring/export paths | allowed retained exact read-only detectors from runtime; DDL operations remain activation/guarded-CLI only | AR-REV-001 closed |
| correction review: read snapshots | only export snapshots had an owner | leaked isolation/timeouts or ambiguous Activity/report failure handling | procedural feature read modules own snapshot lifecycle and call retained `MjlMonitoring` | AR-REV-002 closed |
| correction review: monitoring migration | dashboard/alerts had a target directory but no wave | orphaned current responsibility | added independent W5 monitoring substep reusing W2 reads and VUI09/alerts prerequisites | AR-REV-003 closed |
| correction review: presentation effects | broad UI move mixed session effects with pure rendering | lost/duplicated tokens, recovery or feedback | handlers execute retained effect helpers before pure presentation | AR-REV-004 closed |
| correction review: auth sessions | policy/command/session ownership and order were ambiguous | OTP bypass or stale authenticated state | one private adapter owns mutation; persistence commits before session completion; hooks retain invalidation/bypass order | AR-REV-005 closed |
| correction review: transaction evidence | target contract read as verified everywhere | unsupported safety claim or behavioral scope creep | reference guarantee remains verified; other hardening is unapproved and test-gated | AR-REV-006 closed |
| correction review: lifecycle relocation | mandatory directory move omitted callers/resources and implied reversible DDL | broken includes/assets or false rollback | delegate in place; any extraction closes callers/includes/resources; code rollback excludes DDL undo | AR-REV-007 closed |

Second-pass cycle check:

```text
HTTP adapter -> handler -> {policy, command, feature read, presenter}
feature read -> {retained MjlMonitoring, read-only exact schema detector, DB}
command/policy -> {read-only exact schema detector where readiness is required}
command -> {DB/native adapter, audit writer, pure rules}
auth preparation -> internal access mutation -> {DB, audit writer}
standalone access command -> internal access mutation
auth orchestration/hook -> {pure validity policy, private session adapter}
auth delivery -> email adapter -> {native mail, presentation, failed-outcome audit}
presenter -> template -> DOM contract
descriptor/guarded CLI -> retained lifecycle operations -> DB/DDL
cron -> reconciler -> Activity command
```

No reverse dependency is proposed. The audit writer does not call commands;
feature reads do not authorize commands; templates do not call policies; and
schema/lifecycle libraries do not call runtime handlers. Runtime access stops
at exact read-only recognition functions and never reaches DDL operations.

The auth/access operation participates in an already owned transaction and
does not call back into auth. Email has no auth/access dependency. Its failed
outcome audit is distinct from credential issuance/delivery audit. Activation
and CLI migration dispatch remain separate entrypaths to lifecycle code.

Adversarial result:

- critical architectural concerns remaining: **0**;
- high architectural concerns remaining: **0**;
- medium architectural concerns remaining: temporary old/new compatibility
  inside a wave, export delivery/retry semantics, cron failure/entity semantics,
  runner accuracy, and exact auth-schema recognition;
- accepted trade-offs: procedural Dolibarr adapters, SQL local to owning
  modules, retained database triggers, and retained predecessor branches;
- deferred decisions: those listed in section 18.

## 20. Architecture verdict

Every audited critical responsibility and all 35 preservation requirements
have an approved target owner; no unresolved CRITICAL or HIGH architecture
finding remains after the correction reviews. The frozen design is incremental,
Dolibarr-native, and deliberately does not authorize implementation. W0 and
W1–W7 are all `NOT_AUTHORIZED` until separately approved.

```text
ARCHITECTURE_FROZEN
```
