# MJL Implementation Roadmap v2

## Working rule

Development is unfinished and no feature or phase is accepted unless the user
explicitly says so. The user's latest instruction supersedes earlier plans,
approvals, verdicts, and phase sequencing. Implement only the requested slice,
check scope before editing, and use focused verification. Production
preparation remains deferred until explicitly requested.

Completed phase plans and reports are kept in Git history rather than as active
documents. The decision register preserves provenance; the gap analysis owns
unresolved weaknesses and unapproved recommendations.

## Rebuild foundation (DEC-091–092, 2026-10-22)

**FOUNDATION_COMPLETE** — all mandatory first-slice technical gates passed.
This is not application acceptance or production readiness.

Audit baseline `3e7443d` is an ancestor of this implementation. DEC-092 explicitly
authorized only the first technical slice. Its implementation now includes
`frontend/` (React/Vite JSX, Router/Query, Tailwind/shadcn/Lucide, online-only PWA),
`backend/` (FastAPI, SQLAlchemy/PostgreSQL, empty Alembic revision), isolated
`compose.rebuild.yaml`, locked dependencies, staged checks and a minimal CI job.
[README](../README.md#rebuild-development) owns exact setup/check/cleanup commands.
That foundation commit contained no auth or business features; A1 is recorded below.

Scope map: the two neutral routes exercise routing and one shared readiness
query; the single shadcn control exercises approved tokens; static PWA assets
satisfy installability without business offline behavior; two health endpoints
exercise API/connection lifecycle; empty Alembic bookkeeping proves migration
execution; focused tools/tests/CI and Compose satisfy the authorized verification
and isolated local runtime. No future feature directories or generic frameworks.
FastAPI generates the actual contract at `/openapi.json`; no parallel hand-written
contract or `contracts/` scaffold is required for these two endpoints.

### Focused technical evidence

| Check | Executed command / evidence | Result |
| --- | --- | --- |
| Frontend | `npm --prefix frontend run build`, `lint`, `format:check`, `lint:css` | PASS; JSX, Vite/Tailwind build and generated static worker |
| Unit/UI state | `npm --prefix frontend run test:unit` | 7/7 PASS; shell, loading, success, HTTP/payload/network failures, manual recovery, not-found |
| Browser | `API_PROXY_TARGET=http://127.0.0.1:8013 PLAYWRIGHT_BROWSERS_PATH=/tmp/mjl-playwright npm --prefix frontend run test:e2e` | 3/3 PASS; real proxy, routing, tokens/focus/narrow viewport, Chromium installability, cache/offline/no-replay and confirmed worker update |
| Backend tools | In disposable backend: `ruff check .`, `ruff format --check .`, `mypy app` | PASS; 9 Python files formatted, 5 typed app sources |
| API/PostgreSQL | In disposable backend: `TEST_DATABASE_URL="$DATABASE_URL" pytest -q` | 6/6 PASS; live/ready, sanitized failure, valid generated OpenAPI, configuration, transaction cleanup, repeatable Alembic; only `alembic_version` exists |
| Hooks | Installed Husky; disposable Git repo with the same configuration | Invalid staged formatting rejected; standalone CI formatter also rejects it; corrected fixture passes |
| Compose | Explicit project `mjl-foundation-test-20261022`, `/tmp/mjl-foundation-test.env`, `compose.rebuild.yaml`; `config --quiet`, `up -d --build`, `ps` | All 3 services healthy; frontend/backend ports bound to 127.0.0.1; no PostgreSQL host port |
| Real DB outage | Stop only task PostgreSQL, call live/ready, restart and await health | Live remains 200; ready becomes generic 503 then recovers to 200; frontend proxy also verified |
| Cleanup | Verify exact project labels, then project-scoped `down --volumes --remove-orphans` | PASS; 3 containers, network and test volume removed; 22 unrelated containers retain IDs/start times |

The CI workflow uses these same independent checks; no remote GitHub run is
claimed. Browser Background Sync is disabled in the isolated Chromium context;
the test accepts that explicit disabled result, inspects no registered queue or
business IndexedDB and verifies no POST replay on reconnect. Generated worker
inspection confirms no Background Sync code. Installability evidence applies to
Chromium/local secure context, not every browser or production hosting.
One upstream TestClient/httpx deprecation warning remains without a failed test.
Developer-tool dependency advisories are recorded in the gap analysis.

Independent standards and security/spec reviews found no blocking code issue;
stale glossary authorization wording and a host-development port conflict in
README were corrected. Final docs/CI review found no blocker; CI YAML parsed.
Task-owned runtime resources were attested and removed. No historical PHP suite, broad application matrix,
load test or production-readiness audit was run: none belongs to this slice.
No user acceptance or authorization of another slice follows from these checks.

## A3 password recovery readiness (DEC-100–101)

**A3_READY_FOR_AUTHORIZATION** — the user's three explicit approvals close
replacement/notification, recovery-assurance and ordinary synthetic-only scope
in [readiness 07](rebuild/07-a3-password-recovery-readiness.md). Technical Admin
recovery is deferred with no bootstrap change or bypass. Three POST responsibilities,
one recovery-proof table/migration and exact A2.2 guard compatibility remain proposed
implementation scope. All sixteen checks remain planned, not executed.
Finite expiry/direct-request limits or explicit synthetic-fixture permission remain
a pre-implementation prerequisite. Implementation is not authorized; PC1/PC2 remain
pending and real accounts prohibited. No acceptance or production claim.

## Authentication & Access readiness (DEC-093)

**AUTH_ACCESS_READY_FOR_AUTHORIZATION** for the proposed A1 first-Admin
invitation → password setup → password/email OTP → verified identity/logout
journey. [Readiness 04](rebuild/04-authentication-access-readiness.md) owns scope,
16 historical contract dispositions, 15 applicable security controls, 16 proposed
API responsibilities (7 A1), 7 persistence concerns (6 A1) and 18 future checks.
Engineering and security/specification reviews passed after documentation fixes.
No implementation or runtime checks occurred in this review.

Zero local implementation blockers; two pre-cutover policy decisions must be
resolved before real-account enablement. Three later access decisions and the
six baseline external security groups retain their owners/gates. Routine Admin
provisioning/account management, recovery and business authorization follow as
separate bounded slices. DEC-094 subsequently authorized A1 only. Production and application acceptance remain unclaimed.

## A2 account-management readiness (DEC-095)

**A2_READY_FOR_AUTHORIZATION** for A2.1 only; both independent reviews passed.
Documentation-only review after verified A1 commit `0a2cf22`.
[Readiness 05](rebuild/05-a2-account-management-readiness.md) owns the proposed
A2.1 Admin invitations/account listing and later A2.2 ordinary account lifecycle.
Eight confirmed responsibilities; first slice has five API responsibilities,
two table extensions, sixteen acceptance checks and no new IAM tables.
PC1/PC2, Admin lifecycle LA2 and ordinary lifecycle handoff LA3 retain their gates.
At readiness, A2 implementation was unauthorized. DEC-096 subsequently authorized
A2.1 only; real accounts and later slices remain **NOT_AUTHORIZED**.

## A2.1 Admin invitations and account listing (DEC-096)

**A2_1_COMPLETE** — the user authorized readiness 05 at `2c1929e`; all 16
acceptance gates passed. Five API operations, two existing-table extensions,
zero new tables. One `/access/users` view; A1 authentication now admits the three
ordinary roles, with separate backend Admin authorization. Bootstrap remains
bound to the original technical Admin. Versioned invitations and current-generation
binding checks prevent replay and late-delivery resurrection; state/audit commits
are atomic. Existing unbound pending A1 proofs require deliberate operator reissue.

Scope map: five APIs serve list/invite/resend/revoke; Invitation.version prevents
stale actions; Audit.details preserves bounded before/after/generation facts;
shared A1 prepare/deliver/accept code avoids duplicate credential mechanisms;
one Router view and Query-owned lists implement the supplied users composition.
No dependencies, Docker/CI infrastructure, production configuration or POC changes.

| Gate | Verified evidence |
| --- | --- |
| C01 | All five endpoints reject anonymous/pending/expired/inactive principals and all three non-Admin roles; valid Admin journey passes |
| C02 | CSRF/Origin/Host, synthetic-only inputs, endpoint abuse and no-store negative cases |
| C03 | Bounded/allowlisted list filters, escaped substring, exact projections, guessed IDs and forbidden targets |
| C04 | Each ordinary role completes invitation/password/OTP with exact identity; recipient/Admin-role forgery denied |
| C05 | Duplicate pending/active/inactive creation and concurrent create preserve one identity/proof/send |
| C06 | A1 invalid/expired/replayed proof regressions plus revoked and concurrent acceptance cases |
| C07 | Resend rotates proof and version, preserves role, rejects stale/terminal/Admin targets |
| C08 | Revoke invalidates proof; repeated revoke is a no-op with one success audit; pending User remains inaccessible |
| C09 | Two-connection accept/revoke, accept/resend, resend/resend, duplicate create and late-delivery revoke/reissue races; bootstrap regressions |
| C10 | Database start/preparation/audit/commit/completion and mail fault injection; truthful failed/unconfirmed outcomes and no precommit mail |
| C11 | Bounded previous/current identity and invitation facts, durable sanitized denials, no secrets and append-only audit |
| C12 | Real-browser Admin/recipient flow, list/filter/empty/loading/error/conflict/delivery-failure feedback and confirmations |
| C13 | Unit late-response cancellation/API denial; browser focus refresh, cross-tab logout and same-browser switch to ordinary role |
| C14 | Native-dialog focus return plus explicit Tab containment, 375px reflow, interrupted/offline requests, no sensitive storage or replay |
| C15 | Valid generated OpenAPI with cookie/CSRF/Origin contracts; existing-A1 Alembic upgrade, constraints, append-only history and PostgreSQL races |
| C16 | Focused tools, tests, real proxy/PostgreSQL/test mail and disposable-resource teardown |

Verification: **82 backend** cases (24 A2 + 58 A1 auth/security/policy), **18 frontend
unit** cases, **one comprehensive A2 browser** case and **three foundation/PWA
browser regressions** passed. The OpenAPI case was rerun after adding explicit
header documentation. Ruff check/format, strict mypy, ESLint, Prettier, Stylelint
and frontend build passed. README owns commands and isolated-runtime instructions.
Independent engineering/UI and security/specification source reviews passed after
fixes verified in the browser/API tests. Upstream test-library deprecation warnings
remain; no dependency change was introduced to suppress them.

The task-owned `mjl-a21-test` containers/network/volume and private policy/mail
captures were removed after label verification. No shared POC resources were
changed. Historical PHP matrices, unrelated business tests, performance benchmarks,
production checks and redundant full suites were skipped as out of scope.

PC1/PC2 remain pending. Real accounts, A2.2, A3, A4, PTA, production and application
acceptance remain **NOT_AUTHORIZED / NOT_CLAIMED**. LA2/LA3 and all six external
security dependency groups retain their gates. Stop after A2.1.

## A2.2 restricted ordinary lifecycle (DEC-098–099)

**A2_2_COMPLETE** — implemented only readiness 06 at `6659a05`; **16/16 gates
passed**. No application acceptance, real-account enablement or production claim.

One `PATCH /api/v1/access/users/{identifier}` supports exactly one ordinary active
role change or deactivation with expected version. Admin/self targets and broader
lifecycle are denied. Existing User/Invitation versions and append-only audit
provide atomic changes and obsolete verified/pending-OTP proof invalidation.
Login now takes the existing advisory lock before any row lock. Two dialogs reuse
the Admin view, Router/Query, approved users composition and v3 tokens. Zero new
tables, migrations, dependencies, services or business mechanisms.

Provenance: task-created `mjl-a22-test` volume/database started empty; explicit
migration reached `0003_a21` and a zero-user check preceded policy attestation.
Pytest created/migrated/dropped random empty child databases. Inspected writers
remain auth-only, without imports or external business stores. Lifecycle defaults
off until private `lifecycle_database` matches the verified disposable database;
that attestation cannot bypass per-mutation exact revision/seven-table checks.
Unknown relations, versions or read failures deny. **Replace the temporary guard
before any PTA/assignment/workflow integration; never advance its revision alone.**

| Gate | Exercised evidence / PASS |
| --- | --- |
| L01 | Verified Admin only; anonymous/pending/expired/inactive/three ordinary roles and CSRF/Origin/Host negatives |
| L02 | All six distinct ordinary-role transitions, exclusive input, Admin/self/invalid targets, stale state and unchanged-role no-op |
| L03 | Deactivation preserves identity/history; prepared/delivered invitation revoked with version; consumed/revoked unchanged |
| L04 | Old verified cookies and pending OTP contexts denied; role changes require fresh password/OTP; role restoration never revives old cookie |
| L05 | Exact auth-only baseline passes; unknown/multiple/missing revision, missing/extra/foreign/view/partitioned relations and catalog fault fail closed |
| L06 | Absent/wrong database attestation and unknown schema deny; existing synthetic-policy negatives remain effective |
| L07 | Deterministic overlapping role/role and role/deactivate writes in both orders: one success/version/audit, one conflict |
| L08 | Both orders of login, cross-identity login, OTP verify/resend and session versus PATCH, with barriers and bounded PostgreSQL waits; late OTP success/failure cannot restore authority |
| L09 | No reinvitation/activation/Admin extension; inactive invite conflicts; A2.1 replay and late invitation delivery regressions pass |
| L10 | Mutation/audit/commit failures restore User and outstanding Invitation state/version; no success audit or lifecycle email |
| L11 | Stable actor/target and actual old/new facts; append-only audit and sanitized DTOs/logs; no sensitive browser persistence |
| L12 | Existing identity/invitation uniqueness and state/password constraints retained; rejection leaves identity/history intact |
| L13 | Real-browser role/no-op/deactivate dialogs, keyboard containment/focus return, 375px layout, conflict/eligibility/unknown-result feedback and both Query lists refreshed |
| L14 | Browser offline non-replay and A2.1 account-switch/logout checks; unit delayed mutation completion cannot restore cleared queries |
| L15 | Valid generated six-operation access OpenAPI, exclusive PATCH payload, security/header/error contract; invitation POST unchanged |
| L16 | Focused A1/A2.1 tests, quality/build and isolated-resource teardown |

Verification: **76 lifecycle backend cases**, **82 focused A1/A2.1 regression
cases**, **20 frontend unit cases**, **one A2.1 browser journey and one A2.2
browser journey** passed. Tests ran in focused batches; review-driven cases and
failed test oracles were corrected and rerun, not counted as passing from their
initial failure. The pre-existing API inventory assertion was updated for the one
authorized new operation and explicitly passed. README owns reproducible commands.
Ruff lint/format (app/tests), strict mypy, ESLint, Prettier, Stylelint, frontend
build, OpenAPI validation and Git diff checks passed. Independent Engineering/UI
and Security/Specification reviews passed after their findings were verified.
Synthetic mobile screenshot inspected; human accessibility acceptance unclaimed.
Existing test-library deprecation warnings remain; no dependency changes.

Label-verified task containers, network, volume, local image and private
policy/mail captures were removed. No shared POC resources changed. Unrelated
historical suites, production audits and redundant full reruns were skipped.
PC1/PC2 remain pending. Assigned/responsible accounts, handoff, R8/Admin lifecycle,
A3/A4/PTA and real-account enablement remain deferred/prohibited. Stop after A2.2.

## A1 first Admin authentication (DEC-094)

**A1_COMPLETE** — 7/7 API responsibilities, 6/6 persistence concerns and 18/18
acceptance checks passed. Verification: 64 backend, 11 frontend and five browser
cases; OpenAPI/Alembic, build, Ruff/mypy/ESLint/Prettier/Stylelint and isolated
Docker checks passed. Task-owned containers/network/volume/private captures were
removed; no historical PHP was changed. Independent security/specification and
standards/frontend findings were resolved. PC1/PC2 and six external dependencies
remain pending; real accounts, acceptance and production readiness are unclaimed.

The seven A1 routes and six
PostgreSQL concerns are implemented under `backend/app/auth`; React auth views
use the supplied references and Query-owned session projections. No later slice
is authorized. The retained readiness matrix owns the current evidence, policy
gates and remaining external dependencies; no separate execution report.

Scope boundary: one CLI bootstrap/reissue, one auth service with explicit
transactions, six A1 tables, one private fake-mail boundary, one synthetic policy
gate, four React routes, focused PostgreSQL/browser tests. Argon2id is the only
new runtime dependency. No queue, generic IAM layer, SMTP or business resources.

## Approved PTA business sequence after foundation/auth (DEC-087–091)

The following feature sequence retains approved business dependencies. Native
objects/installers, existing PHP class paths and old test runners are historical
references only; each new-stack slice receives separate implementation approval.

The business rules in `mjl_codex_authoritative_pta_change_brief.md` are approved.
The 2026-10-21 impact audit is recorded in the gap analysis. Runtime implementation
has not started. The sequence below is proposed for review; implement only the
next authorized slice and stop after it. Do not generate separate permanent
phase execution/validation reports: keep concise state here and evidence in Git.

| Slice | Requirement and smallest implementation scope | Dependencies / exit evidence |
| --- | --- | --- |
| 1. PTA planning foundation | Project lifecycle + at-most-one-active guard and closure denial for unfinished Activities/financial steps; annual PTA created automatically with the first Agent-planned Activity for that Project/year; PTA-only Activity creation; equal Agent access; Supervisor/Validator assignments. Reconcile schema, commands, route/token guards, reads and exports together. | Project closure guard is settled by DEC-090; retain reopening/deactivation questions for their dependent branches. PTA creation ownership is settled by DEC-089. Disposable API/DB tests for Project/first-PTA creation races, cross-entity denial, unassigned Agent and forbidden create bypass. Existing screen changes need inspiration check before implementation. |
| 2. Approved amendments and annual transfer | Extend immutable Activity revisions with separate approved/candidate content, fresh two-stage review with affected execution paused while approval is pending, late corrections, withdrawal and atomic cross-year transfer. Reuse contributor/audit protections. | Slice 1; decide withdrawal/annual history semantics. Affected-only execution pause is settled by DEC-090. Prove pending amounts cannot alter approved execution/reporting and stale decisions cannot activate content. |
| 3. Realization and administrative settlement | Final Operation spending replacing itemized expense approvals/reversals, distinct décaissement/virement approvals, separate Agent → Supervisor → Validator insufficiency authorization, external confirmation, automatic reversement requirement/declarations and direct Agent closure. Retire conflicting old finance/completion paths. | Slices 1–2 and exception/zero-amount decisions from gap analysis. Focused missing/zero/XOF, stale-basis, no-self-approval, discrepancy/full-return and closure tests. No bank execution. |
| 4. Annual metrics and Fiche | Whole-PTA approved denominators; closed-only realization/spending; provide Fiche PDF and guarded PDF/XLSX exports with history/reconciliation. | Slices 2–3 and historical attribution decision. Prove UI filters cannot alter official denominator, pending amendments stay excluded and history is not truncated. File references activate only with slice 6. |
| 5. Administrative relance | Focused 21-day scheduler, recipient/channel outcomes, in-app notifications and email; browser push if required by clarified PWA contract. | Stable dates/assignments/closure from slices 1–3; verify mail, agree retry/rescheduling and browser permission behavior. Focused due/reschedule/closure/deduplication tests. No generic notification platform. |
| 6. Guarded optional documents | Reconcile Phase 4 to optional PTA/Activity/revision/decision/request/confirmation/return contexts and Partner visibility. Implement only the separately authorized security slice. | Existing document gate and relevant storage/preview/security decisions. Keep deny-all until guarded route and entity/Partner isolation checks pass; no mandatory attachments or requirement-blocking machinery. |
| 7. Partner portal | Exclusive one-Partner invitation/auth binding; own current/past Projects and approved PTA/progress; authorized decisions, Fiches, files and scoped exports. | Can prepare identity/API work after slices 1–2; complete experience depends on slices 3–4 and allowed files on slice 6. Verify real mail/OTP before enablement, cross-Partner denial and no internal-role escalation. |

Each slice covers its schema/command/API/consumer/test changes as one coherent
behavioral change. Backend work can proceed without screen layouts, but no
incomplete front end may fake the unavailable workflow. **Before implementing
any screen, stop and request applicable inspiration if absent.** Reuse the
existing design system and add accessible skeleton/empty/error states when
screen work is authorized.

Use reviewed Alembic migrations on a clean PostgreSQL database for separately
authorized slices. Do not import old accounts or business/demo records. Preserve
the POC and require explicit authorization before any reset or cutover. Retain
no generic workflow engine, banking integration or offline synchronization.
Passing focused checks neither accepts the application nor authorizes later work.

## Historical POC implementation state

- The W0 prerequisite and W1 reference migration are complete. DEC-080/082 now
  supersede the former reference form/presentation paths: all three reference
  roots render a shared REST shell, scoped reads remain reference-owned, and
  the existing reference command owns writes. Legacy reference POST/render
  handlers are removed. DEC-083 supersedes the W2 Activity HTML POST and
  template paths with a GET shell and JavaScript REST client. Existing Activity
  commands, scoped reads and audit chronology retain their ownership. W3 is
  complete: one deep reference command owns reference writes, one deep access
  command owns standalone access writes, and invitation preparation uses the
  access command as a non-transaction-owning participant. Superseded procedural
  writers are removed. W4 is complete: one cohesive authentication command owns
  invitation, reset, and OTP orchestration; one private session adapter owns
  session storage; session validity is pure; access policy has one explicit
  owner; and email test capture remains email-owned. W5 is complete under
  DEC-067: report and audit previews now have selected HTTP, bounded read, and
  presentation owners; export delivery has an explicit checked stream owner;
  and only dashboard/index/alerts moved onto the retained W2 monitoring-read
  module. DEC-066 governs read-only preview rollback-call failure: rollback and
  exact budget restoration remain attempted while the public result stays the
  generic unavailable/HTTP 503 response. `MjlMonitoring`, durable export
  generation/evidence, shared Operation/request branches, formats, filters,
  filenames, CSS/JS, schema, and authentication remain unchanged. All W5 gates
  passed. DEC-068 closed the four W6 prerequisites: exact historical
  predecessor provisioning, activation-time exact auth-schema refusal, the
  RST-012 transition matrix, and descriptor lifecycle characterization.
  DEC-069 records the first W6 attempt as failed before movement. DEC-070 then
  authorized and completed the exact frozen delegation from clean named
  baseline `725821a` under amended Standard hash `b24021ac...`: the descriptor
  delegates once to the existing current-path lifecycle seam and retains native
  `_remove`/`_init` orchestration. Exact lifecycle behavior, schema, resources,
  auth rules, and prior-wave owners remain unchanged. W6 is complete. W7 is
  complete under DEC-071: only the unused
  `mjl_activity_access_can_mutate()` / `mjl_activity_access_require_mutation()`
  pair was removed after the named reachability proof. The surrounding access
  library, its read helpers, current route/command authorization, all other
  cleanup candidates, and every completed-wave owner remain unchanged. This
  closes the numbered architecture waves without recording user acceptance,
  production readiness, or an automatic migration-completion state. DEC-072
  separately reconciled all wave completions, frozen hashes, 35/35 preservation,
  current governance, and bounded residuals. Its binary gate passed with zero
  migration blockers, so the frozen architecture migration is now
  `MIGRATION_COMPLETE: YES`. Application acceptance and production readiness
  remain `NOT_CLAIMED`. The post-migration technical revalidation fixed the
  Activity GET allowlist and access/authentication transaction-start handling,
  activated 0.21.0 through the non-seeding path, and passed the focused Activity
  gate, authentication gate, and complete maintained E2E batches. Role-based
  UAT and manual accessibility sign-off remain outstanding.
- Phase 0 authority and reset structure are implemented.
- Phase 1 foundations are implemented: effective roles, invitations and account
  lifecycle, Partenaires, Projets, Types d’opération, audit, navigation, and
  document containment.
- Phase 2 Activity and Opération planning, assignments, immutable revisions,
  review decisions, and chronology are implemented.
- Phase 3A execution and exception workflows are implemented.
- Phase 3B dashboards, alerts, browsing, audit views, and operational exports
  are implemented.
- Phase 3C reconciliation and disposable restore checks are implemented. Some
  historical rollback and exact-schema suites conflict with later schemas; the
  gap analysis records this unresolved compatibility debt.
- The MJL authentication pass is implemented behind `MJL_AUTH_OTP_ENABLED`:
  email-only password verification, six-digit email OTP, verified-session
  enforcement, native login/reset bypass guards, and shared invitation/reset
  password rules. Version 0.21.0 and its exact empty OTP schema are installed
  locally through the non-seeding activation path. The retained technical Admin now has a configured email. OTP enablement
  was requested on 2026-10-20 but remains blocked by missing mail transport
  and delivery verification. DEC-077 adds native failed-login recording to setup
  (also applied locally) and replaces expired OTP challenges on fresh password
  login. Focused authentication verification passed 19/19, including expiry with
  exhausted resends; transaction and syntax checks passed.

These statements describe repository state only. They do not record user
acceptance or readiness for production.

## Historical POC post-cadrage UI pass

VUI-00 records the agreed implementation map. VUI-01 shared foundations are
implemented with Activity create/edit as the first consumer. VUI-02 shared
shell/navigation is implemented with six permission-filtered primary entries,
contextual secondary links, a real-user profile, and responsive drawer.
VUI-03 Activities list is implemented with the existing scoped monitoring
projection, supported filters, separated states, exact counts, pagination,
and read-only Operation expansion. VUI-04 Activity planning is implemented
with a redesigned create/edit form, shared controls, exact budget feedback,
browser-side validation, and dependent Partner-to-Project selection using
active-entity Project data. VUI-05 Activity workspace is implemented with
status and financial summaries, progressive tabs, current assignments, an
Operation table, lock explanations, and individual reasoned assignment
actions. VUI-06 review/revisions is implemented with immutable submitted
snapshots, staged progress, role-aware decisions, reasoned correction dialogs,
revision history, late-validation guidance, and read-only reviewer states.
VUI-07 Operation consultation is implemented with a shared read-only contextual
drawer, exact financial and execution facts, role-aware execution navigation,
and ordinary-link fallback. VUI-08 exception dialogs are implemented with one
shared progressive dialog host that moves each existing guarded form without
cloning it or issuing another token. DEC-083/084 supersede the ordinary-form
fallback with JavaScript-required REST clients and the shared modal controls,
preserving role eligibility, exact versions, financial facts and terminal rules.
VUI-09 role dashboards are implemented with role-specific headings and
indicators derived from the existing scoped Activity projection, current
permission-aware work queues, execution progress, financial disclosure, and
alert previews. The Admin dashboard exposes only the existing guarded access,
history, audit-report, and technical-administration destinations; it fabricates
no account or health metrics. VUI-10 Partner/Project management is implemented
with shared responsive reference tables, current status and parent facts,
role-aware row actions, progressive create/edit and lifecycle dialogs, shared
dirty-state protection, and JavaScript-required REST clients (DEC-080/082). Project ownership stays
immutable after creation and the existing lifecycle, permission, token, and
entity boundaries remain under their current backend owners. VUI-11 Users and
invitations is implemented as a JavaScript-required REST screen with shared
responsive access tables, progressive invitation and account-action dialogs,
French invitation statuses, real delivery outcomes, dirty-state protection,
and a no-JavaScript message. Invitation, role, deactivation, revocation,
Admin-only, token, and entity boundaries remain under their current backend
owners.
VUI-12 history and exports is implemented with shared report navigation,
responsive filter/date controls, visible active selections, complete-selection
export actions, and a chronological global-audit presentation. Existing
server-side filters, cursor and page behavior, report-specific access, audited
PDF/XLSX/CSV generation, filenames, formats, projections, and active-entity
boundaries remain under their current backend owners. VUI-13 cross-screen
consistency is implemented with one shared section-heading owner, one shared
chronology primitive across contextual and global history, removal of dormant
report/timeline presentation selectors, and focused structural, responsive,
accessibility-preference, and four-role boundary checks across completed
surfaces. No query, workflow, permission, schema, or export contract changed.
No UI wave has been accepted. The user authorized
a phased design pass using `docs/inspiration/` for composition and interaction,
while the approved v3 design tokens remain the visual authority. Reuse the
current PHP/JavaScript stack, shared MJL presentation helpers, and installed
compatible widgets. Keep business rules, authorization, queries, endpoints,
schema, authentication, and exports under their existing owners. Stop and ask
before a UI wave requires a backend change.

UI wave order: VUI-01 shared foundations; VUI-02 shell/navigation; VUI-03
Activities list; VUI-04 Activity planning; VUI-05 Activity workspace and
assignments; VUI-06 review/revisions; VUI-07 read-only Operation consultation;
VUI-08 exception dialogs; VUI-09 role dashboards; VUI-10 Partner/Project
management; VUI-11 Users/invitations; VUI-12 history/exports; VUI-13
cross-screen consistency. Each wave is scoped, verified, reported, and stopped
before the next wave. Create a shared presentation mechanism with its first
actual consumer, reuse it on later screens, and remove replaced UI code and CSS.
The current screen inventory retains the POC route evidence; the design-system
README now routes rebuild visual authority. Deferred dependencies remain in the
gap analysis.

## Historical POC feature state and remaining product gates

### Current spending: accounting approval and immutability

DEC-076 makes explicit Validateur définitif approval the immutability boundary for current
spending entries. The schema is installed in the empty local tenant. Six focused browser/command
checks passed for approval, atomic correction, completion, isolation, cancellation
access and exports.
DEC-077 authorizes implementation
of separate expense entries within each Opération and Validator-approved full
reversal/replacement pairs. Totals/exports count only approved expenses, and
completion requires approval (including an explicit zero-spending declaration).
Accounting corrections remain permitted after completion/cancellation without reopening or changing execution status. This requirement applies to current
spending independently of the additional Phase 5 accounting structure. Overall
budget-variance observation is required at completion; each expense/correction
retains its description/reason. Broader historical suites and manual accessibility
sign-off were not run; these checks establish neither acceptance nor production readiness.

### REST API: progressive implementation

DEC-077 records REST API implementation after authentication fixes and spending
approval/reversal. DEC-078 sets the API as the backend foundation for web/PWA
clients, covering all available MJL actions with login plus OTP. The existing
interface migrates progressively with each feature. MJL administration is
included; native Dolibarr technical administration is excluded.
There are no external integrations for now. Authentication, reference screens and Activity workflows are implemented through REST (DEC-080/082/083); native API remains disabled. Phase 4 remains separately deferred.

Approved session policy (user confirmation on 2026-10-21, DEC-081): expire after 24
hours of inactivity or 24 hours total, whichever comes first, and require login
plus email OTP again. No remembered-device option is included. These limits
are implemented and verified through the shared API/HTML session gate.
Offline mode remains outside current scope. Mail remains a prerequisite for
operational OTP delivery.

The 2026-10-21 source inventory and target wire contract are defined in
[`mjl-rest-api-contract.md`](mjl-rest-api-contract.md) and
[`mjl-rest-api.openapi.yaml`](mjl-rest-api.openapi.yaml): 75 operations covering
current MJL actions and necessary session/submission-token adapters. The contract
preserves command ownership, scoped reads, fingerprints/versions, one-use
submissions, correction-only access and audited binary exports. The implemented slices cover authentication, recovery, all three reference screens, Activity planning/assignments/reviews/chronology and shared API/HTML session expiry. OpenAPI schema
validation and operation/source/security-header consistency checks passed;
independent spec/security/read-projection reviews were reconciled. Runtime checks for the first slice cover authentication, recovery, expiry, Partner transactions, role/entity denial and mobile use. Six focused migration/regression checks now cover all reference screens, immutable Project ownership, inactive-parent refusal, stale/replayed writes, audit rollback, mobile and JavaScript-disabled states. A focused browser layout check also verifies wrapped mobile reference labels remain inside their cells.

Proposed API delivery stages (separate from product Phase 4):

1. Authentication/session/recovery and all reference data: implemented. OTP stays
   disabled until mail is configured and delivery verified.
2. Activities, assignments, planning, review and chronology: implemented (DEC-083), including Activity cancellation requests and scoped filter options.
3. Operations, expenses, accounting corrections and exception workflows: implemented (DEC-084); focused checks passed.
4. Dashboards, alerts, audit, previews and exports: implemented (DEC-085); focused checks passed.
5. MJL access administration and final action/interface coverage: implemented (DEC-086); 75/75 inventoried endpoints are covered.

Each slice must preserve existing commands and migrate the corresponding screen's
reads/writes to REST. Focused checks and remaining technical dependencies are
specified in the contract. Contract completion does not imply runtime completion,
user acceptance or production readiness. Mail remains pending before OTP enablement.

Current Activity slice (DEC-083): JavaScript-required list, planning, detail and
review clients use the existing REST transport. Existing aggregate/assignment
commands retain mutations, locks, no-self-validation and audit transactions.
Scoped bounded reads explicitly project wire fields; chronology remains sanitized.
The former HTML POST/presentation/recovery path and obsolete form-ceremony tests
are removed. All five focused Activity API browser checks passed across targeted
runs: planning and exact amounts; the complete review cycle and chronology;
assignment transfer/removal and restoration; stale/replay/revision guards and
audit rollback; foreign-entity isolation and contributor exclusion. Request/read
contracts, the planning-control browser check, changed-file PHP/JavaScript syntax
and OpenAPI validation also passed. Broad suites and manual accessibility review
were not run for this slice. No acceptance or production readiness is implied.
OTP remains disabled pending mail delivery.
Current access slice (DEC-086): the Admin-only users/invitations screen is a
JavaScript-required REST client. Six entity-scoped endpoints reuse the existing
authentication and access commands for invitation, role, deactivation and
revocation rules. Invitation secrets are never projected, and delivery failure
is an explicit 503. Endpoint coverage is 75/75; user acceptance remains outstanding.

Current execution slice (DEC-084): the three Operation, expense and exception
screens use REST reads and one-use mutation tokens issued on submission. Existing
commands retain approved-only totals, immutable entries, atomic correction pairs,
completion guards and exact exception targets. Historical cancellation assignments
retain correction-only ledger access. Legacy form/read-render adapters are removed.
All four focused execution REST browser checks passed across targeted runs, covering
approval/correction, zero spending, exception target versions, stale/replayed writes,
audit rollback, correction-only access and role/entity/self-approval denial. Request
contracts, changed-file PHP/JavaScript syntax and OpenAPI validation passed. Broad
suites and manual accessibility review were not run; user acceptance remains
outstanding. OTP remains disabled.

Current reporting slice (DEC-085): dashboard, alerts, audit browsing, four report
previews and five synchronous audited exports use REST. Existing bounded readers,
exact financial projections, immutable export evidence and checked delivery remain
the owners. The dashboard exposes unavailable action data explicitly while keeping
verified totals. Nine focused disposable-tenant browser/API checks and the request,
snapshot, delivery, recovery, chronology, syntax and schema checks passed. Obsolete
HTML transport suites were removed; manual accessibility review and user acceptance
remain outstanding.

### Phase 4: Documents

Planning was requested on 2026-10-12. The consolidated scope, domain model,
security boundary, lean sequence, acceptance criteria, and unresolved decisions
are in `docs/mjl-phase4-contextual-document-management.md`. Implementation is
not authorized. Document behavior remains behind the current deny-all
containment boundary until a separately reviewed slice and cutover are approved.

### Phase 5: Accounting

Additional accounting structure remains blocked until the user supplies or accepts its structure,
classifications, roles, validation, correction, reconciliation, dependencies,
and representative examples.

### Phase 6: Official Partner reports

Official reports remain blocked until the user accepts templates, mappings,
periods, formulas, outputs, versioning, and approval behavior.

## Data and deployment boundaries

Keep the persistent development tenant free of sample/demo business data until
the user approves a dataset specification. Use only isolated disposable
fixtures for tests and remove them during teardown.

Do not perform deployment preparation, production configuration, production
backup work, go-live checks, or a production-readiness verdict until the user
explicitly requests them. Passing development checks cannot authorize those
activities.
