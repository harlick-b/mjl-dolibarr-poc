# Engineering standards adoption plan

Drafted 2026-11-18. Status: Steps 1–3 complete; Step 4 is next.

## Outcome and authority

Adopt the authoritative [API standard](engineering-standards-api.md) and
[UI standard](engineering-standards-ui.md) through small, verified changes to
structure and implementation. Migrate to Axios and change API/client contracts
resource by resource, keeping the backend and its consumers aligned.

Preserve the [business rules](business-rules.md), [security requirements](security.md)
and approved [design](design.md), including the ongoing
[Activity editor work](activity-ux-plan.md#authoritative-activity-task-and-subtask-editor--2026-11-18).
The standards' accepted rules govern adoption; embedded source observations and
examples do not automatically become MJL requirements.

The user confirmed:

- Retain PostgreSQL, SQLAlchemy 2, Alembic and the current tooling, including
  Ruff/pyproject and the existing frontend test harness.
- Adopt the prescribed folder structure and responsibility ownership.
- Use Axios and migrate contracts step by step.
- Preserve métier and ongoing design work.
- Commit all current intended changes before implementation begins.

This file records the agreed sequence and the evidence from completed slices.
Existing guides remain the record of current implementation until their
respective slices update them. Setup commands remain owned by
[README](../README.md).

## Invariants and adaptations

Retain exact integer XOF and the distinction between unknown and zero; immutable
approvals and audit evidence; no-self-validation and the approved reviewer
exceptions; server-side role, assignment and Partner isolation; existing planning,
execution, finance and closure rules. Preserve transaction-owned authorization,
writes and atomic audit. Persistence helpers never commit independently.

Authentication remains invitation-only, password plus mandatory email OTP, with
the current Unicode password rules, session limits, cookie/CSRF protection and
revocation behavior. AUTH-001's public registration, optional OTP and different
password policy must not replace MJL's approved rules. No browser-stored bearer
credential or browser signing secret is introduced.

Step 2 records adaptations with rule ID, scope, reason, owner decision, risks,
checks and review condition. The baseline inventory is:

| Rule     | Baseline evidence and disposition                                                                                                                                                                                                                                                                            | Risk/check                                                                                                                   | Slice/status                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| BE-001   | Standards are authoritative and linked from README, AGENTS and the engineering guide. Apply accepted rules only; keep product decisions and explicit adaptations.                                                                                                                                            | Prevent source examples from changing permissions, data or workflows. Review the matrix after every slice.                   | Step 2 compliant.                              |
| BE-002   | Current `app/main.py` and feature packages differ from the exact `AppMain` and responsibility folders. Adopt the target names with real resource owners only.                                                                                                                                                | Startup, imports and Alembic metadata can break during moves. Verify both launch paths and migration discovery.              | Steps 4–7 pending.                             |
| BE-003   | Current Python is typed and checked with Ruff/mypy. Retain Ruff/pyproject as the user-approved project tooling adaptation; use the standard naming/interface rules.                                                                                                                                          | A move must not hide mismatches behind `Any` or forwarding modules. Run Ruff/mypy and inspect dependency direction.          | Approved adaptation; ongoing.                  |
| BE-004   | Planning currently combines Pydantic input/output, scoped queries, projections and mutations in `planning/routes.py` and `core/service.py`. Split read/write serializers, actor-scoped queries and transaction-owning controllers. Keep SQLAlchemy models and database validation appropriate to PostgreSQL. | Reject server-owned input; preserve scoped list/detail/search/export/aggregate reads and atomic audit.                       | Partner pilot then Step 6.                     |
| BE-005   | FastAPI composition is in `app/main.py`; several large routers mix resources. Move composition to `AppMain/asgi.py`, aggregate resource routers in `app/webapi/`, and keep declared output aligned.                                                                                                          | Update Docker/dev/CLI imports and OpenAPI together. Change each contract only with all consumers.                            | Steps 4–6 pending.                             |
| BE-006   | Mail/provider adapters and scheduled commands currently live with feature owners. Move external clients to `xlib/` and real background/operational work to `tasks/` without adding queues or retries.                                                                                                        | Preserve one bounded mail attempt and keep network work outside transactions. Mock external work in ordinary tests.          | Step 6 pending.                                |
| BE-007   | MJL auth already enforces server credentials, authorization and scoped sessions, but ownership differs from the standard layout. MJL invitation-only mandatory-OTP rules override AUTH-001 source behavior.                                                                                                  | Reorganize only after auth flow coverage; preserve revocation, abuse limits, cookies and CSRF.                               | Approved product adaptation; Step 6 migration. |
| BE-008   | Retain PostgreSQL/SQLAlchemy/Alembic, uv/pyproject, Ruff and mypy as explicitly approved. Do not install MongoDB, Beanie or sapx or copy source-project versions.                                                                                                                                            | Verify locked dependencies and existing configured checks; no dependency-wide upgrade.                                       | Approved adaptation.                           |
| BE-009   | Tests currently use domain folders with shared disposable PostgreSQL fixtures. Move touched endpoint tests to `tests/webapi/<resource>/` and pure logic to `tests/unit/` while preserving isolated real PostgreSQL.                                                                                          | Do not weaken exact status/body/database/authorization assertions or rewrite untouched tests only for uniformity.            | Partner pilot then Step 6.                     |
| FE-001   | Standards and staged adoption are now linked from onboarding. Existing deviations migrate deliberately.                                                                                                                                                                                                      | Do not claim repository-wide compliance from a single pilot.                                                                 | Step 2 compliant.                              |
| FE-002   | Current `src/app`, `features` and `shared` layout differs from the exact target. Move only coherent owners into `App`, `pages`, `components`, `hooks`, `context`, `helpers`, `data`, `lib`, `locales` and `assets`.                                                                                          | Preserve CSS order, aliases, PWA entry and tests; avoid empty scaffolding.                                                   | Steps 4–7 pending.                             |
| FE-003   | Current JavaScript/JSX naming is largely compatible; imports still reflect the old layout. Apply component/helper naming and direct shared imports during moves.                                                                                                                                             | ESLint plus review must catch barrel cycles, deprecated paths and stale aliases.                                             | Ongoing.                                       |
| FE-004   | Browser paths live in `app/urls.js`; API strings are repeated in screens. Move to `data/Urls.js`, add `data/ApiUrls.js`, and migrate affected callers with their resource.                                                                                                                                   | Preserve Router parsing, back/forward and route guards. API path changes require paired backend/client updates.              | Shared structure and each resource slice.      |
| FE-005   | Tailwind/shadcn/Lucide and the approved MJL design are established. Existing structured forms use local accessible components rather than React Hook Form/Zod. Preserve current forms while moving them; use the standard default for genuinely new structured forms.                                        | Compare populated/empty/error/dialog/narrow states; do not alter tokens or drop dirty input.                                 | Approved local pattern; ongoing design checks. |
| FE-006   | One fetch-based RestClient/provider/useAPI seam exists with access-generation protection. Replace its transport with Axios under the final `helpers/RestClient`, `context` and `hooks` owners.                                                                                                               | Verify credentials, CSRF, cancellation, trusted URLs, blobs and expiry before migrating resources. No second generic client. | Step 4 pending.                                |
| FE-007   | Current reads and writes return parsed bodies. Migrate deliberately to standard method distinctions and Axios response handling, resource by resource.                                                                                                                                                       | Temporary compatibility must be bounded and removed; never leak credential-bearing Axios errors.                             | Partner pilot then Step 6.                     |
| FE-008   | Query keys usually include user/resource/parameters. MJL's documented default is one-minute freshness and five-minute memory retention, with mount refetch; session/proof/blob queries use zero/specialized lifetimes. Treat these as data-specific project overrides.                                       | Preserve access-scope purges, readiness gates, invalidation and stale-response rejection.                                    | Approved override; verify per slice.           |
| FE-009   | Session Query and the access coordinator already separate credentials, readiness and authorization. Move ownership without changing invitation, OTP, recovery or logout behavior.                                                                                                                            | Test network retry, account replacement, logout failure and late responses before/after the move.                            | Step 6 pending.                                |
| FE-010   | Retain current npm/Vite/React 19/Query 5/Tailwind 4/Vitest/Playwright toolchain and lockfile. Source-project versions are observations, not downgrade targets.                                                                                                                                               | Keep config and aliases aligned; run configured lint, CSS, unit, browser and build checks as applicable.                     | Approved adaptation.                           |
| FE-011   | Retain colocated Vitest/Testing Library tests and Playwright journeys instead of migrating to Jest. Tests already use synthetic isolated data.                                                                                                                                                               | Test observable refresh/error/scope behavior, not only invalidation calls or internal mocks.                                 | Approved adaptation; ongoing.                  |
| FE-012   | `features/auth/session/authorization.js` centralizes the page catalog, but pages still repeat role strings. Move the pure role helper and expose derived flags through `UserProvider`/`useGetUser` backed by the same session Query.                                                                         | No second permission store; server remains authoritative. Verify unknown roles and session/account changes.                  | Steps 4–7 pending.                             |
| AUTH-001 | Public registration, optional OTP and its password examples conflict with MJL. The approved MJL contract is Admin invitation, mandatory email OTP, Unicode 8–128 password rules and reset without sign-in.                                                                                                   | Preserve complete auth flow and server enforcement; record this as product precedence, not partial compliance.               | Approved product adaptation.                   |

No database replacement, schema redesign, new business workflow, dependency-wide
upgrade, deployment, production migration or external acceptance exercise belongs
to this plan. Migration `0038_draft_task_categories` belongs to the design
baseline. Its automated round trip demonstrates the affected Task-category
schema transition and preservation of a representative persisted row; it is not
claimed as an exact rehearsal of a writer built from revision `0037`. The
corrective migration `0039_editable_activity_dates` has a separate exact predecessor
rehearsal recorded in Step 3.

### Partner pilot contract

The pilot covers the internal Partner catalog, including the Partners page and
the Partner choices used by Project creation. It does not change the separate
Partner portal, add Partner deactivation, add search or introduce detail/delete
operations.

| Operation       | Baseline contract                                                                                                                           | Pilot target                                                                                                                                                                                                                                                                                           | Consumers and checks                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| List            | `GET /api/v1/partners`, optional `limit`/opaque `cursor`, 200 list envelope; reads allowed for Admin and the three internal business roles. | `api.list(ApiUrls.partners, params)` targets `GET /api/v1/partners/` and supplies the Query function. Preserve default 60/max 100, 422 invalid cursor/limit, newest-first ordering, exact authorized count and absolute next/previous links. Consume the standard list result without losing metadata. | Partners page, Project Partner selector, audit/Partner-portal setup and endpoint tests; verify both cursor directions and scope.   |
| Create          | `POST /api/v1/partners`, `{name, description?}`, 201 plus `Location`; final Validator only; mutation and `partner.create` audit are atomic. | `api.create(ApiUrls.partners, payload)` targets `POST /api/v1/partners/` and returns the Axios response; caller reads `response.data`. Preserve normalization, bounds, output and `Location`.                                                                                                          | Creation dialog, visible Query refresh, denied roles, invalid input and rollback.                                                  |
| Update          | `PATCH /api/v1/partners/{id}`, `{name, description?, expected:{name, description?}}`, 200; final Validator only; stale basis is 409.        | `api.update(ApiUrls.partners, payload, id)` targets `PUT /api/v1/partners/{id}/` and returns the Axios response. The payload remains the complete editable Partner representation plus its expected snapshot; relationship, active state and server fields remain unavailable.                         | Edit dialog, retained input on failure, stale refresh, 404 concealment, unchanged-save behavior and atomic `partner.update` audit. |
| Errors/security | `{code, message, fields?}` with cookie session, CSRF/Origin on writes and resource/role checks inside the transaction.                      | Preserve the MJL error envelope and normalize Axios failures into the safe client error shape. A transport change does not change authorization or expose raw responses.                                                                                                                               | 401 access coordinator, local 403/404/409/422/429/503 handling, cancellation and late-response tests.                              |

The API and every caller move in the same pilot commit. A temporary RestClient
adapter may support untouched resources, but the Partner contract has one active
shape after its slice. The pilot does not proceed until Step 3 records the baseline.

## Implementation sequence

### Step 1 — Commit the existing work

Coordinate a handoff with the ongoing design work before staging shared files.
Inventory tracked and untracked changes, including the Activity editor, its tests,
migration `0038`, current guides, both standards and this plan. Review the intended
commit contents; keep credentials, generated artifacts and disposable data out.
Preserve ignored inspiration assets without silently adding them to Git.

Commit all intended current work in coherent commits and record the resulting
baseline SHA. Confirm a clean tracked/untracked worktree for implementation.
Preserve `backend/.venv`. A checkpoint preserves work; it is not proof that its
tests pass or its design has been accepted.

If design work continues afterward, agree ownership of shared files and integrate
its committed changes before moving those files. Do not refactor concurrently
edited files or discard later design changes during rollback.

**Exit:** baseline commits identified; current work preserved; shared-file handoff
clear; no implementation changes mixed into the checkpoint.

Completed 2026-11-18 at baseline commit `f6e65cd`. The commit contains the
Activity/Task/Subtask editor, migration `0038`, current design/business/status
guides, both authoritative standards and this plan. The commit hook passed ESLint
and Prettier for its staged frontend files. That hook result is not a runtime or
migration baseline; Step 3 remains required.

### Step 2 — Complete the adoption and contract inventory

Inspect actual code/configuration/tests against BE-001–009, FE-001–012 and
AUTH-001. Maintain a concise matrix in this plan:
`rule | source evidence | gap/adaptation | risk | slice | status`.
Use compliant, approved adaptation, pending or unverified; do not infer compliance
from folder names or a passing build.

Link the standards from README, agent instructions and the engineering guide;
record the confirmed project adaptations and reconcile superseded guidance.
Map existing files to their final owners, including tests, imports, startup/CLI
entrypoints, templates, assets, configuration and Alembic model registration.

For every resource slice, specify its old/new URL, method, status, input/output,
error, pagination and RestClient return contract, plus all callers and tests.
Distinguish mandatory rules from observed example conventions: a sample status
code does not redefine the meaning of a business action.

**Exit:** concrete pilot map and contracts; all applicable rules accounted for;
only genuine unresolved contradictions or external inputs require questions.

### Step 3 — Verify the committed baseline

Run the configured checks and representative journeys needed to establish a
reliable comparison before application changes. Record actual commands, candidate
SHA, results and pre-existing failures. Add focused behavioral coverage only when
a concrete migration risk lacks meaningful existing coverage.

Capture representative desktop/mobile presentation and interactions, including
dialogs, loading/error states, dirty forms and Activity → Task → Subtask editing.
Check migration `0038` against its authentic predecessor on disposable PostgreSQL.
Do not substitute SQLite or a shared development tenant.

Project status previously reported unavailable PostgreSQL migration verification;
that is historical evidence, not a current result. Resolve required gaps before
the affected slice; an unrelated passing check cannot waive them.

**Exit:** recorded baseline and design comparison points; affected prerequisites
available; known failures distinguished from migration regressions.

Completed 2026-11-18 against baseline `f6e65cd`, with the Step 2 documentation
commit `9bbfcac`, baseline integration repair `3d58d3a` and editable-date repair
`f6964f2`.
The verification found and corrected integration drift introduced by the latest
Activity/Task design baseline: schema eligibility now recognizes migration
`0038`, its exact schema manifest is current, Task audit facts accept a genuinely
incomplete Draft only when category ID and label are both absent, current Task
execution/category paths are used by affected checks, and Partner browser fixtures
match the current protected PDF preview contract. No business rule changed.

Configured frontend evidence:

- `cd frontend && npm run lint && npm run format:check && npm run lint:css`
  passed, with the
  existing React Hooks warning at
  `src/features/auth/session/access-verification.jsx:457`.
- `cd frontend && npm run test:unit` passed: 29 files and 257 tests.
- `cd frontend && npm run build` passed; the existing Vite chunk-size warning
  remains.
- Focused Playwright passed the current Partner desktop/mobile journey and two
  Activity editor journeys covering populated responsive editing, the Subtask
  drawer and attachment-failure Draft retention. Current screenshots were
  captured under `/tmp` for local comparison and were not committed.

Configured backend/static evidence:

- `cd backend && .venv/bin/pytest --collect-only -q` collected 917 tests with the existing
  Starlette/httpx deprecation warning.
- `cd backend && .venv/bin/alembic heads` reported
  `0039_editable_activity_dates (head)` for the final candidate.
- `cd backend && .venv/bin/ruff check app tests`,
  `cd backend && .venv/bin/ruff format --check app tests`, and
  `cd backend && .venv/bin/mypy app` passed. The formatter checked 115 files and
  mypy checked 59 source files. Repository-wide
  Ruff still reports the historical migration line at
  `migrations/versions/0013_virement_confirmation.py:73`; the formatter would
  rewrite migrations `0009`, `0013` and `0036`. Historical migrations were not
  rewritten for style.
- `git diff --check` passed for both committed candidates.
- A rebuilt disposable PostgreSQL 17 stack passed the baseline repair's 19-test
  focused set. This covered the categorized Task schema/persisted-row round trip
  `0038 -> 0037 -> 0038 -> 0037 -> head`, refusal to discard an incomplete Draft,
  both impossible audit category pairs, schema readiness, repeatable Alembic
  upgrade, the corrected audit export actor, current Task/Category routes, closure
  serialization and amendment audit/category projection. This is not claimed as
  an exact revision-`0037` application-writer rehearsal.
- A fail-fast broad run reached 226 passes before exposing an obsolete expected
  Alembic head; that assertion was corrected and its focused rerun passed. An
  earlier broad run was interrupted at about 31% and is not reported as a pass.

The bounded recovery/core/closure run reported 78 passes and seven failures.
Three current Task-path/head mismatches were corrected and their five relevant
focused checks passed; the final OpenAPI rerun then exposed and led to removal of
the remaining old `operation-types` path fixtures. Eight historical backend test
cases remain recorded rather than being hidden or used to change métier:

- Three recovery tests still expect `recovery_prepare` or
  `recovery_notification` rows in the business audit table, although the current
  documented security boundary routes routine authentication evidence away from
  business history.
- The closure destructive-downgrade test expects the older PTA-3F guard, while a
  newer Task-hierarchy guard correctly refuses the downgrade first.
- Four parameterizations of the older operation-tombstone predecessor test are
  likewise stopped by the newer Task-hierarchy loss guard before they can reach
  migration `0005`.

A 31-test browser group was interrupted after 9 passes and 4 failures, leaving
18 tests unrun; its failures were old screen fixtures that no longer reach current
Activity controls. A direct rerun passed the Partner portal journey, skipped the
Planning journey because its supplied inspiration gate is absent, and exposed five
existing Execution fixture failures before the repaired Task mutation mock could
exercise its controls. These are baseline evidence, not a passing browser suite.

These failures predate the standards structure work and do not block the shared
Axios/ownership slice. They must be reconciled with the settled security,
migration and current-screen contracts before the authentication, closure or
Execution UI slices.

The repair review found that the Activity API, audit validator and database
constraint disagreed with the authoritative rule permitting missing dates in
amendment Drafts and returned corrections, while initial Draft handling was
already aligned. Commit `f6964f2` adds migration
`0039_editable_activity_dates` and aligns those three layers. The constraint still
rejects missing dates in returned withdrawal and transfer content, so the repair
does not broaden those workflows.

The final focused migration/workflow command used the disposable Compose stack:

```text
docker compose --env-file /tmp/mjl-standards-baseline.env -p mjl-standards-baseline -f compose.rebuild.yaml exec -T backend sh -lc 'TEST_DATABASE_URL="$DATABASE_URL" .venv/bin/pytest -q tests/planning/test_amendments.py::test_editable_activity_dates_migration_round_trip_preserves_complete_activity tests/planning/test_amendments.py::test_m04_editable_amendments_can_clear_dates_and_keep_audit_history tests/planning/test_amendments.py::test_m04_amendment_edits_keep_bounded_structural_audit_history tests/planning/test_planning.py::test_category_migration_refuses_to_discard_an_incomplete_draft tests/core/test_database.py::test_alembic_repeatable_upgrade_to_head'
```

It passed 5 tests in 22.72 seconds. After the independent reviewer identified
the withdrawal/transfer integrity gap and the constraint was corrected, this
affected command passed both parameterizations in 12.70 seconds:

```text
docker compose --env-file /tmp/mjl-standards-baseline.env -p mjl-standards-baseline -f compose.rebuild.yaml exec -T backend sh -lc 'TEST_DATABASE_URL="$DATABASE_URL" .venv/bin/pytest -q tests/planning/test_amendments.py::test_editable_date_constraint_protects_returned_non_editable_content'
```

A broader 22-test candidate run passed 21 tests and exposed one stale expected
head assertion. The assertion was updated from `0038` to `0039`, and its focused
rerun passed. This is recorded as an affected rerun, not as a complete passing
rerun of the 22-test group.

The exact cutover rehearsal used disposable PostgreSQL and two application images.
Image `f638b614375a2adfc0f1c339a2f3f3e95ff3e0ab54d686e2a419d06bd3009818`,
built from committed predecessor `3d58d3a`, created a complete amendment under
schema `0038`. The initial wrapper exited after the successful database write
because its evidence mount was not writable; a read-only extraction recovered the
created identifiers without changing the row. Corrected-candidate image
`873245b6132ddf1ec99fa33ddf3744e0c04eea49f90d58f69fb012e2b96d1f0a` then ran
`alembic upgrade head`, verified the preserved row and new constraint, and used a
distinct assigned Agent login to read the Activity through the API. It reported
`0038 exact predecessor data preserved through 0039`.

The final staged diff for `f6964f2` had SHA-256
`de31ce66a7f96d52933c084324fc50fe61d940fdbf8121b8875c9c4d123dcc61`.
The independent reviewer first reported the missing withdrawal/transfer guard;
after correction, the same reviewer found no remaining blocking findings and
cleared the candidate. The earlier `3d58d3a` candidate was also independently
reviewed and cleared before commit.

### Step 4 — Establish the shared structure and Axios transport

Use the final standard locations from the start:

- Frontend: `src/index.jsx`, `App/`, `pages/`, `components/ui/`,
  `components/shared/`, `hooks/`, `context/`, `helpers/RestClient/`, `data/`,
  `lib/`, `locales/` and `assets/`, creating owners only where needed.
- Backend: `AppMain/asgi.py`, `AppMain/settings.py`, and
  `app/webapi/`, `models/`, `serializers/`, `controllers/`, `query/`, `xlib/`;
  `tasks/` only for actual existing work. Preserve domain subpackages where useful.
- Backend endpoint tests: `tests/webapi/<resource>/`; shared fixtures/helpers
  and useful unit tests follow BE-009 without replacing disposable PostgreSQL.

Move only shared owners needed for the pilot first. Update entry documents,
aliases, test resolution, component-generator paths, CSS imports and relevant
startup references together. Preserve CSS loading order and approved token values;
update the documented token path when its file moves.

Introduce Axios under the shared RestClient/provider/useAPI interface. A bounded
temporary adapter may preserve existing callers while the underlying fetch
transport is removed. Do not maintain a second generic client. Separate transport
replacement from resource-contract changes into reviewable commits.

Verify trusted URL handling, cookie/CSRF behavior, cancellation and stale-response
suppression, session-expiry coordination, safe errors, 204 responses, multipart
uploads, protected blobs and exact XOF strings. Never expose credential-bearing
Axios error objects or automatically replay writes.

**Exit:** shared infrastructure works with existing callers; transport and security
checks pass before the first contract migration.

### Step 5 — Migrate the Partner pilot end to end

Move Partner list/create/update into the final backend resource owners and the
frontend Partner page. Separate input validation from output projection; reject
server-owned input fields. Keep actor-scoped list/detail/query behavior and move
business operations into controllers that own authorization, transaction and audit.

Apply the recorded contract mapping in both API and frontend callers. Adopt
Query-function list/retrieve calls, Axios mutation response handling and the
standard's pagination metadata consumption deliberately. Preserve filtering,
ordering, exact authorized counts, default 60/max 100 and invalid-limit 422.
Guard missing IDs rather than copying known example defects.

Verify the actual UI/Query journey: list and pagination, create/update and refreshed
results, failed requests with retained input, denied actors, stale edits, immutable
relationships and audit rollback. Confirm presentation against the baseline.

**Exit:** pilot checks and independent review pass; API and caller changes form
one coherent commit/rollback unit. Do not expand the rollout before this gate.

### Step 6 — Expand through paired resource slices

Use the pilot pattern for remaining catalogs/PTAs, notifications/history/reports,
Partner portal, authentication, execution/finance and Activity planning. Refine
this order using real dependencies and the design handoff; each named group may
require several small resource slices.

Each slice changes its backend contract and frontend consumers together, including
cross-page selectors, exports and download links. This is not a backend-wide
conversion followed later by frontend repairs. Keep a migration ledger so mixed
old/new contracts are explicit during the transition.

Preserve scoped retrieval for lists, details, search, exports and aggregates.
Keep synchronous SQLAlchemy work off async event loops and preserve locking,
reauthorization and atomic audit. Move implementation without inventing generic
workflow/repository layers or changing notification delivery guarantees.

Update application/CLI startup references and Alembic model-registration imports
when their owners move. Verify complete metadata discovery and startup resolution.
Inventory historical migration dependencies; preserve revision IDs, parent links,
DDL and executable history. Any unavoidable compatibility adjustment must be
explicitly reviewed, not hidden in a directory move.

**Exit per slice:** its callers migrated, adjacent workflows verified, obsolete
paths removed only after caller inventory, independent review resolved, commit
recorded and this plan updated.

### Step 7 — Finish UI ownership and preserve the latest Activity design

Complete page/component/helper moves and shared conventions alongside the paired
resource rollout. Keep feature-only components/helpers/tests with their page;
shared primitives must not acquire business rules. Replace scattered API paths
with `ApiUrls` and use the existing route catalog through `data/Urls.js`.

Centralize role interpretation and expose derived flags through the standard's
`UserProvider`/`useGetUser` ownership, reusing the existing Query session and access
coordinator. Do not create another mutable permission store. Retain Router-owned
navigation, scoped Query data, temporary React forms, localization, Sonner and
Helmet behavior.

Migrate the Activity editor only after its design handoff, using the latest committed
version. Preserve the Répartition card, manually entered amounts, dedicated Task
page, Subtask drawer, incomplete Draft saving, strict submission, Category failure
handling, optional attachment sequencing and keyboard focus restoration. Retain
the rest of the approved design guide; this list is not a replacement for it.

Compare populated/empty/error screens, dialogs and narrow layouts before and after
the move. Missing inspiration blocks the affected visual verification only.
Remove temporary client/contract adapters after their last callers migrate.

**Exit:** final UI ownership and caller inventory complete; design and interaction
checks pass; no permanent parallel implementation remains.

### Step 8 — Final verification and independent review

Run the applicable configured lint, formatting, typing, test collection, generated
OpenAPI and build checks. Use focused runtime/browser checks per slice; broaden
final regression coverage because shared transport and ownership changes cross
the application. Use existing README/package/CI commands, updated for moved paths,
instead of copying runnable commands from the standards' source project.

Bind final database/migration compatibility evidence to the actual candidate,
separately from baseline evidence. Record full runs, focused reruns, skips,
interruptions and unresolved failures truthfully. Do not report an unfinished
broad run as passed because a focused rerun succeeded.

Update the rule matrix, current engineering/design path references and project
status. Evaluate relevant lessons; add only durable discoveries or repeated
corrections. Preserve a concise progress record here after each slice rather than
creating separate execution or closure documents.

Every implementation slice, and the final candidate, ends with a separate
review-only agent that did not implement it. The reviewer inspects requirements,
actual diff, surrounding code and evidence; reports severity, file/line, impact
and smallest correction; and does not edit implementation. The implementer fixes
accepted findings and returns the candidate to the same reviewer. Unresolved
blocking findings or unavailable required review prevent completion.

Review and passing checks establish implementation evidence, not human acceptance,
production readiness or authorization for additional work.

## Progress and evidence

| Item                                               | Status                                                                                                                                                                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database/tooling, structure and Axios decisions    | Confirmed by user on 2026-11-18.                                                                                                                                                                                                             |
| Current-work commit checkpoint                     | Complete at `f6e65cd`; worktree was clean immediately after the commit.                                                                                                                                                                      |
| Complete rule inventory and per-resource contracts | Baseline rule matrix and Partner pilot contract recorded; remaining resources are inventoried immediately before their slice.                                                                                                                |
| Runtime baseline and migration compatibility       | Step 3 complete on disposable PostgreSQL. The 19-test baseline set, 5-test editable-date set, affected 2-test invariant rerun and exact `0038`→`0039` cutover are recorded above. Broad runs, skips and historical failures remain explicit. |
| Application implementation                         | Baseline integration repairs are committed in `3d58d3a` and `f6964f2`; standards structure/Axios implementation has not started. Step 4 is next.                                                                                             |
| Earlier conversational plan review                 | Bounded review of supplied source excerpts; not direct repository or implementation review.                                                                                                                                                  |
| Step 2 independent review                          | No blocking content finding from the exact candidate supplied to the reviewer. The reviewer lacked direct filesystem/tool access and could not independently rerun the reported checks.                                                      |
| Step 3 independent review                          | Complete. The reviewer-cleared baseline repair is `3d58d3a`; the editable-date review found one integrity gap, then cleared the corrected candidate committed as `f6964f2`.                                                                  |

After each slice, record its commit, changed contracts, commands/results,
independent-review outcome, remaining work and lessons that change the next step.
Rollback targets only that slice and must preserve subsequent design work; no
destructive Git or database operation is implied by this plan.
