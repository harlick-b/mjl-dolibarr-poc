# Engineering standards adoption plan

Drafted 2026-11-18. Status: planning only; implementation has not started.

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

This file records the agreed sequence. Writing it does not start implementation,
complete the baseline checks or authorize production changes. Existing guides
remain the record of current implementation until their respective slices update
them. Setup commands remain owned by [README](../README.md).

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
checks and review condition. Initial subjects are:

| Rules | MJL treatment |
| --- | --- |
| BE-002/004/008 | Adopt responsibility folders with SQLAlchemy/PostgreSQL/Alembic; adapt MongoDB/sap-specific persistence examples. Preserve SQL transaction and locking behavior. |
| BE-003/008, FE-010/011 | Retain current tooling, dependency declarations and test harness as confirmed by the user. Do not downgrade installed frameworks to observed source versions. |
| AUTH-001, BE-007, FE-009 | Preserve the approved MJL authentication and security policy while reorganizing its implementation. |
| FE-004/006/007, BE-005 | Adopt Axios and progressively migrate resource/client contracts. Specify each old/new contract before editing its producer and consumers. |
| FE-008 | Document existing page freshness and retention as data-specific overrides; retain specialized session/proof/blob lifetimes and security purges. |
| FE-005 | Preserve existing form behavior and the approved design. The standard permits the local form pattern; moving a form does not require rewriting it. |

No database replacement, schema redesign, new business workflow, dependency-wide
upgrade, deployment, production migration or external acceptance exercise belongs
to this plan. The existing migration `0038_draft_task_categories` belongs to the
design baseline and still needs its own compatibility evidence.

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

| Item | Status |
| --- | --- |
| Database/tooling, structure and Axios decisions | Confirmed by user on 2026-11-18. |
| Current-work commit checkpoint | Pending; ongoing design changes were present during planning. |
| Complete rule inventory and per-resource contracts | Pending Step 2. |
| Runtime baseline and migration compatibility | Not run for this documentation task; pending Step 3. |
| Implementation | Not started. |
| Earlier conversational plan review | Bounded review of supplied source excerpts; not direct repository or implementation review. |

After each slice, record its commit, changed contracts, commands/results,
independent-review outcome, remaining work and lessons that change the next step.
Rollback targets only that slice and must preserve subsequent design work; no
destructive Git or database operation is implied by this plan.
