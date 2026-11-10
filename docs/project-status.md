# Project status

Updated 2026-11-10. MJL is under development; implemented does not mean accepted
or production-ready. This file describes the current boundary, not authorization
for another feature. [Business rules](business-rules.md) define behavior;
[engineering](engineering.md), [security](security.md) and [design](design.md)
own their subjects. [README](../README.md) owns setup and development commands.

## PTA foundations — staged implementation, 2026-11-07

New PTA/Activity/execution visuals and the updated prototype have now been supplied.
The latest brief and Supervisor-upload clarification are recorded in business-rules.md
and design.md. All five planned UI slices are implemented; their final implementation
boundary is recorded below.

The agreed next workflow is recorded in business-rules.md; it is **not fully
implemented**. This candidate adds Supervisor/Validator PTA creation and metadata
editing APIs, version-conflict protection, safe business History and migration
`0027_pta_metadata`. Existing PTAs retain identity/project/year and receive the
neutral name `PTA <year>` with no invented description. A lossy downgrade is refused.
The migration has been exercised only on disposable PostgreSQL, not the configured
development database.

Calendar now loads all pages for the selected PTA/filters when selected, independently
of the table cursor. It refuses detected incomplete/changing pagination, retains
403/404 cache redaction, uses start/ongoing/end month labels, and centers empty
month text. UI wording uses Planification des activités sur l’année where expanded.

The first UI slice connects **Créer un PTA** and **Modifier le PTA** for Supervisors
and Validators, with required name, optional description, active Project choices
and the current year selected by default. Project/year remain fixed after creation.
The index and detail show PTA metadata. Edit forms retain their opening version;
conflicts and uncertain save outcomes are handled locally. Successful changes
invalidate planning and History queries. The new modal composition was compared
with the supplied desktop references; mobile reflow was checked separately. This
is not user acceptance.

Activity creation and annual transfer now require an explicitly created PTA.
A missing transfer destination returns `pta_required`; reviewers create it before
submission/approval, including for older pending requests. Existing approved
revisions and Activity identity remain unchanged. Active Project filtering is
applied before cursor pagination/counting and bound into the cursor scope.

No configured development-database migration or deployment was performed.

Slice 1 source SHA256 (`backend/app`, `backend/migrations`, `frontend/src`, sorted
paths + NUL + bytes + NUL, excluding Python caches):
`0dd73f823687c6c304d6ec70a4bdea213347f2f1fb3588ef7bd164787a58867e`.
Built artifact `index-D9OfAkV-.js` SHA256:
`643c4edf619791738a211aacf271685a36d460ac1473dad1835a90e1808f6969`.

Slice 1 checks:

- `npm --prefix frontend run test:unit -- src/features/planning/pta-metadata.test.jsx
  src/features/planning/planning.test.jsx --maxWorkers=1`: **45 passed**. After
  localization wrapping, the same command restricted to `pta-metadata.test.jsx`
  passed **10 tests**.
- From `frontend`, `npm run test:e2e -- e2e/planning/planning-design.spec.js`:
  **3 passed**, against the final build with disposable intercepted data. Includes
  modal create/edit, immutable Project/year, mobile, Escape and outside dismissal.
- `npm --prefix frontend run build`: passed. `npm --prefix frontend run lint`:
  no errors, one existing effect-cleanup warning in `access-verification.jsx:451`.
  Prettier checks of all touched JSX/JS files passed.
- From `backend`, `.venv/bin/ruff check app/planning/routes.py
  tests/planning/test_explicit_pta.py tests/planning/test_planning.py
  tests/planning/test_transfers.py`: passed; `.venv/bin/mypy app/planning`:
  **20 source files passed**. `git diff --check`: passed.
- Earlier broad PostgreSQL run of explicit PTA and transfer files finished
  **53 passed, 9 failed** after an initial **6 passed, 53 failed** fixture-cutover
  run. Failures involved stale implicit-PTA/assignment/lifecycle/migration fixture
  assumptions; those were corrected. The first focused rerun was interrupted
  (exit 143), with no completed summary. Neither run is reported as a full pass.
  Final focused PostgreSQL rerun: **21 passed, 150 deselected** in 135.20s,
  using `.venv/bin/python /tmp/mjl-design-tests.py
  tests/planning/test_explicit_pta.py tests/planning/test_transfers.py
  tests/planning/test_planning.py -k 'explicit_pta or t05_amend_transfer or
  original_create_replay or assignment_change_serialize or assignment_lifecycle_guard
  or approval_rolls_back_target or used_transfer_database or
  placement_change_without_transfer or v04_v05_assigned or p06_p10_direct'
  -q --tb=short --show-capture=no`. This covers all nine previously failing cases,
  explicit-PTA prerequisites, legacy pending transfer compatibility, assignment
  races, rollback and migration 0027 round-trip on this candidate. It is not a
  rerun of the full suite. Tests used disposable PostgreSQL with teardown.

Independent review found and verified corrections for form snapshot/version,
read-denial cleanup, local write denial, uncertain-write reconciliation, active
Project cursor scope and History invalidation. Final independent code/evidence
review completed with no remaining blocking findings for slice 1.
The existing lessons already cover snapshot-based forms and targeted verification;
no duplicate lesson was added.


Commit review follow-up: fixed dismissal during a pending PTA save so the request
settles and refreshes planning/History without reopening the dialog. Session
changes still suppress obsolete callbacks. Regression failed before the fix;
final `npm --prefix frontend run test:unit -- src/features/planning/pta-metadata.test.jsx
--maxWorkers=1`: **11 passed**. Targeted ESLint and final build passed. Backend
source is unchanged from the 21-test run above; browser evidence above predates
this callback-only correction. Separate standards/specification reviewers found
no remaining blockers. Final source SHA256: `9c707becd412083193c933f46e89b87036a8497e77dec894bbaf06bc08fc899d`.
Final built artifact: `index-DGLp7nDY.js`, SHA256 `6d97445860125e790d062a0881c3549a807475aa5476cd306f9c55cebd431e2e`.

## PTA slice 2 — reviewer brief and Agent completion, 2026-11-09

Supervisors and final Validators can now use **Ajouter une activité au PTA** to
create a short Activity brief and assign one or more active Agents in the same
transaction. The modal requires a title, start date in the PTA year and an Agent;
instructions and end date are optional. Agent direct creation still opens the full
planning form and self-assigns the creator. A reviewer opening the former full-form
URL is returned to the PTA, where the authorized quick action is available.

A brief is an ordinary incomplete draft: its budget remains unknown and it has no
invented Operations. Only assigned Agents can complete, edit and submit it. The
full Agent form identifies missing required planning rather than silently refusing
save. Draft-safe lists, detail, summaries and calendar keep incomplete work visible,
while approved totals, exports, Partner views and reminders exclude it. Migration
`0028_activity_briefs` permits nullable end/allocation only for a never-submitted
draft and records immutable creation/content contribution kinds.

Reviewer creation provenance allows that Supervisor or Validator to perform their
normal planning review later. Any later content contribution still excludes that
person from planning review, and every contribution kind continues to exclude the
person from financial approval. Replay protection covers Activity plus assignments
and audit atomically. If the browser loses a creation response, the modal freezes
the exact payload and request key until replay resolves it; rate limits and other
pre-route failures cannot unlock a possibly committed command. A conclusive
post-replay assignment rejection unlocks correction.

The quick modal uses the supplied nested date picker and searchable cursor-based
Agent choices. Its final desktop screenshot was compared directly with
`docs/inspiration/pta/create-activity-quick.png`; mobile containment, nested-popover
Escape, outside dismissal and focus return were exercised. Automated 918 px reflow
does not constitute human 200% zoom or visual acceptance.

Final source SHA256 (`backend/app`, `backend/migrations`, `frontend/src`, sorted
path + NUL + bytes + NUL, excluding Python caches):
`1e5fea31e39a78204a6cfffcfba96311a9312ae04286a5f207ed8a6637b006ff`.
Built artifact `index-d4tCTiMu.js` SHA256:
`26aa16921b157326e399f9d6f856ab7879cdc95ae19e94730223b6956a77708d`.

Slice 2 checks:

- Disposable PostgreSQL: `.venv/bin/python /tmp/mjl-design-tests.py
  tests/planning/test_activity_briefs.py -q --tb=short --show-capture=no`:
  **8 passed** in 55.47s. This covers migration/constraints, role/body rules,
  replay and rollback, Agent completion, two-stage review, planning/financial
  contributor separation, visibility/exports and assignment/deactivation races.
- Adjacent disposable-PostgreSQL checks: assignment lifecycle, role-change/planning
  and role-change/review races passed **3 tests**; the corrected Partner isolation
  journey passed **1 test**. Legacy fixtures now create the PTA first, explicitly
  assign the collaborating Agent and use a separate test IP for late permission
  assertions so setup traffic does not exhaust the independent abuse limit.
- Frontend focused run reported **53 passed and 1 timeout** under concurrent final
  checks; the timed-out unchanged PTA modal file was rerun alone and passed
  **11/11**. The changed Activity brief file passed **5/5**, including unknown
  response, 429 recovery and conclusive-assignment correction. This is recorded as
  a focused rerun, not as a clean 54-test combined pass.
- Rebuilt Playwright reviewer-brief journey: **1 passed**. It covers the reviewer
  route, nested calendar, Agent selection, identical-command recovery, mobile
  containment, outside/Escape dismissal and focus return.
- Prettier passed for the full frontend. ESLint passed with no errors and the
  existing `access-verification.jsx:451` warning. The final Vite/PWA build passed
  with its existing large-bundle warning. Ruff passed for all changed backend
  files; mypy passed **45 source files**. `git diff --check` passed.

Separate specification and design/standards reviewers inspected the final diff,
surrounding contracts, tests and rebuilt reference screenshot. Their recovery,
validation, direct-route and modal-fidelity findings were corrected and returned
to the same reviewers; both reported no remaining P1/P2 findings. Review is not
user acceptance or production readiness.

## PTA slice 3 — Activity workspace and review evidence, 2026-11-09

The Activity workspace now follows the supplied connected composition: Activity
identity, Project/Partner/PTA context, state, responsible Agents, dates and revision
remain together in the header; the contextual completion/review actions lead into
the existing Programmation, Historique and Pièces justificatives sections. The
approved assignment dialog loads searchable paginated Agent choices only while it
is open, shows current people and added/removed changes, requires at least one
Agent and keeps its opening Activity version through a failed save. Explicit cancel
discards that draft.

Supervisor and final-Validator planning decisions now accept an optional observation.
Migration `0029_decision_observations` changes only that decision constraint and
refuses a lossy downgrade when positive observations exist. Decision dialogs show
the Activity, immutable revision, exact XOF total, optional observation and optional
Activity-level evidence. The decision and evidence remain separate transactions:
a confirmed decision is never replayed when evidence upload fails, and the owning
dialog offers evidence-only retry. The selected file is captured before the decision
refresh so it is not lost during the state change. Before upload, the client records
the identifiers already present on the newest document page. If the upload result is
uncertain, it reads that page again and accepts only a new identifier with the same
file name, size and uploader. This avoids both browser/server clock comparisons and
false confirmation from an older matching file. It closes on confirmed receipt,
offers file-only retry only when the read proves the file absent, and otherwise keeps
a verification action.

Supervisors may upload Activity documents after the same fresh authorization checks
used for other upload roles. They did not gain programming edits, document withdrawal,
Partner sharing or post-closure administration. Activity detail adds only the Agent
identity, Project/Partner/PTA display fields and minimal current-revision summary
needed by this screen; it does not fetch the full revision snapshot until History is
opened. Core audit and mutation projections retain their strict existing shape.
The History and Files tabs load only when opened. Assignment search keeps the selected
Agent identities across searches and pages instead of falling back to raw identifiers.
The Activity header now includes the PTA breadcrumb and draft/review actor context.

Candidate checks:

- Disposable PostgreSQL: `pytest tests/planning/test_activity_briefs.py
  tests/execution/test_documents.py::test_optional_attachment_upload_list_and_guarded_download
  -q --tb=short --show-capture=no`: **10 passed** in 87.78s. This covers both
  reviewer roles, observations, blank-observation rejection, downgrade guards,
  financial contributor exclusion and Supervisor upload/audit.
- Frontend `npm run test:unit -- src/features/planning/planning.test.jsx`:
  **38 passed**. It covers lazy inactive tabs, assignment identity/discard, uncertain
  evidence reconciliation and evidence-only retry without a second decision request.
  The final production build passed with the
  existing large-chunk warning.
- The complete affected backend files first reported **36 passed, 3 failed**: two
  helpers still created only a 2027 PTA while execution uses the current year, and
  one assertion still expected Supervisors to be forbidden from uploading. After
  correcting those stale tests, the three focused reruns passed. Ruff check/format
  passed for all changed backend files; mypy passed **45 source files**. ESLint,
  Prettier and the production build passed; the build retains its existing
  large-chunk warning.

Separate specification and standards reviewers inspected the corrected final diff.
The specification reviewer confirmed both optional end-date variants and the compact
incomplete-draft composition. The standards reviewer confirmed the before/after
document-ID reconciliation, minimal revision summary, native assignment toggle
semantics and strict mutation/audit response boundary. Both reported no remaining
P1/P2 findings. The standards reviewer independently reran the frontend planning
suite (**38 passed**); its backend rerun could not start because its isolated review
shell had no `TEST_DATABASE_URL`, while the implementer rerun against the disposable
PostgreSQL database passed both reviewer-role cases (**2 passed**). No browser visual,
keyboard or reflow comparison was run for this final correction pass.

The following foundation evidence predates this UI slice and its assignment work.
PTA-foundation candidate (before assignment changes) application/migration/frontend-source SHA256 (sorted paths, each path +
NUL + file bytes + NUL): `c9e193171121fcae9bd9c7197037f1258818291ba2073fa8f946ef6bc855b7d2`.
Frontend artifact: `index-V9k3IkFL.js`.

Verification of that PTA-foundation candidate:

- Backend disposable PostgreSQL: `/tmp/mjl-design-tests.py` via backend `.venv/bin/python`,
  `tests/planning/test_explicit_pta.py`,
  `tests/planning/test_planning.py::test_p06_p10_direct_pta_duplicate_and_maximum_xof`,
  `tests/planning/test_catalog_editing.py -q`: **7 passed**. Includes clean upgrade,
  populated predecessor round-trip, loss-preventing downgrade and direct uniqueness.
- Frontend `npm run test:unit -- src/features/planning/calendar.test.js
  src/features/planning/planning.test.jsx`: **37 passed**, including denied calendar
  refetch cache removal. `npm run test:e2e -- e2e/planning/planning-design.spec.js`:
  **2 passed**, using intercepted disposable data. Calendar screenshot inspected
  against the existing reference; this is not human visual acceptance.
- Build passes (existing chunk-size warning); targeted ESLint, Ruff and mypy pass.
  No full application/backend suite was run. Initial fixture-import errors were
  corrected before the successful backend run; focused evidence does not imply a
  broader suite passed.

Independent review corrected protected-calendar cleanup, export noise in History
and a uniqueness test that could fail for the wrong constraint. Final focused
PostgreSQL rerun `tests/planning/test_explicit_pta.py::test_pta_access_validation_and_audit
-q`: **1 passed**, including actual export exclusion from History/filter/CSV.
The independent reviewer reran both frontend files: **37 passed**; final source
review found no remaining blocking code findings for this additive slice.

## Assignment-based Agent access — implemented, 2026-11-07

An Agent who creates an Activity is assigned automatically in the same transaction.
Supervisor/Validator assignment changes retain at least one active Agent. Only
current assignees can edit, submit, execute or initiate the Activity’s financial
and evidence changes; other Agents retain viewing access. Reviewer permissions
and immutable approvals are unchanged. Reassignment and mutation use the existing
transaction lock, so a waiting command cannot use an assignment removed first.
Replaying creation does not restore a removed assignment.

The existing UI uses these permissions, disables empty assignment submission and
refreshes permissions after an assignment rejection, including an already-open
document form. Execution list assignment checks reuse its batched Agent lookup.
Existing unassigned Activities are not silently allocated: a Supervisor or
Validator must assign them before an Agent can work. Closure/withdrawal continues
to end assignments, preserving their history.

This slice does not add the pending PTA/brief visuals, reviewer-created briefs,
or the explicit-only PTA cutover described above. No additional migration or
configured development-database change is made by the assignment slice.
Final candidate application/migration/frontend-source SHA256 (same method above):
`f7533098e2ebd954a9f92b1dfe4fcbe3aebd553ea9a531513ef2a4be7f5eada1`;
frontend artifact `index-B-hNgtNu.js`.

Verification (segmented regression campaign, not a single full-suite pass):

- Final-source disposable PostgreSQL run: `tests/planning/test_assignment_access.py`,
  `tests/planning/test_explicit_pta.py`, planning role-change/coherent-read races,
  and funding/disbursement/virement list authorization/OpenAPI checks: **12 passed**.
  This rerun follows batching the financial lists’ assignment lookup; earlier
  broad execution checks predate that localized projection change.
- Historical predecessor migration checks: `tests/planning/test_planning.py
  -k predecessor_upgrade -q`: **8 passed**. Fixtures reproduce the older full
  before/after audit format. This does not promise that current compact audit
  records support downgrade/re-upgrade through that historical schema.
- Corrected closure/document/migration cases: **12 passed** before a remaining
  compound test exhausted its test IP limit. Removing redundant setup, without
  changing the limiter, produced **4 passed** for parent-state/lifecycle/tombstone
  checks. Reminder handoff/legacy-empty-assignment checks: **4 passed**.
  Cross-Activity reversement scope check: **1 passed** with the target Activity’s
  correct version, proving the request reaches the scope check. Separate foreign
  and cancelled virement-source scenarios: **2 passed**, without relaxing limits.
- Frontend `planning.test.jsx`, `calendar.test.js`, `document-denial.test.jsx`,
  `execution.test.jsx`: **71 passed** together with one worker, test timeout 20s,
  and temporary Testing Library async-wait limit 5s. Earlier 1s DOM waits timed
  out under concurrent database-test load; no assertions were removed.
- Build, targeted ESLint/Prettier, Ruff, mypy and diff checks pass. Existing build
  chunk-size and TestClient deprecation warnings remain. No full application
  suite, live mail or configured-database migration was run.

Final-source backend command (from `backend/`):

```sh
.venv/bin/python /tmp/mjl-design-tests.py \
  tests/planning/test_assignment_access.py \
  tests/planning/test_explicit_pta.py \
  tests/planning/test_planning.py::test_p19_role_change_and_planning_are_serial_in_both_orders \
  tests/planning/test_planning.py::test_v12_activity_reads_remain_coherent_while_workflow_mutates \
  tests/execution/test_funding.py::test_authorization_stale_replay_and_openapi \
  tests/execution/test_disbursement.py::test_routes_are_scoped_and_openapi_success_contracts_are_typed \
  tests/execution/test_virement.py::test_routes_enforce_roles_csrf_scope_and_cursor_contract \
  -q --tb=short --maxfail=1
```

The initial broad run was interrupted (including an interrupted teardown). Planning
`test_planning.py` then stopped at **58 passed / 15 failed**; its failed/unrun cases
plus the new assignment/PTA tests produced **51 passed / 5 failed**. Every identified
failure was corrected and passed the focused reruns above. Execution initially
stopped at **17 passed / 1 failed**, its continuation at **135 passed / 20 failed**;
the final remaining batch completed at **73 passed / 2 failed**. Those last two
fixture failures passed the scope/version correction and separated-source reruns.
No known regression failure remains; these counts must not be represented as one
uninterrupted suite pass. Tests used disposable PostgreSQL through
`backend/.venv/bin/python /tmp/mjl-design-tests.py` (pytest arguments), with teardown.

Independent review inspected transaction guards, permission projections, stale UI,
fixtures and actual evidence and cleared this slice with no remaining blocking
findings. This is not production readiness or visual acceptance.

Pre-commit specification and standards reviews independently inspected the combined
PTA/assignment diff, all added files and saved final-source evidence. Both cleared
the candidate; the stale schema-head summary was corrected. This review ran diff
checks, not new runtime suites; the source hash above remains unchanged.

## Catalog and planning screen refinement

Implemented 2026-11-07 against the supplied Partner, Project, PTA, Activity and
Execution references. Validator catalog editing preserves ownership and records
atomic field deltas; Partner deactivation remains deferred. Project links open
its PTA list, with year selection on the PTA screen. Sidebar selection is exclusive.
PTA summaries, filtered table/calendar, Activity form/details and shared controls
use approved composition/tokens. Existing separate save, submission and document
workflows remain. The calendar pagination limitation from this earlier batch is
superseded by the staged PTA foundation update above.
No migration, financial-rule change or production configuration change.

Implementation candidate before review cleanup: working tree on `920c406`;
frontend `index-B0EMOLUF.js`.
Application-source SHA256 (same path/content method below):
`6cac11b1d11e4287c32eb5bbcb59a16983839dc6db47d596e255f7b759a0b67a`.

Focused verification:

- Vitest `planning.test.jsx --maxWorkers=1`: 33 passed; `execution.test.jsx
--maxWorkers=1`: 28 passed; audit, Partner portal, document-denial and format
  tests with `--maxWorkers=1`: 20 passed. Earlier combined runs failed; a later
  combined run and broad backend run ended with exit 143. These are not full-suite
  passes. Focused final reruns supersede affected failures only.
- Playwright `e2e/planning/planning-design.spec.js e2e/auth/empty-states.spec.js
e2e/audit/audit-history.spec.js`: 25 passed; after the final Execution amount
  label correction, `empty-states.spec.js --grep 'Execution search'`: 1 passed.
  Browser fixtures are disposable, intercepted API data; they cover mobile,
  empty states, table/calendar, first creation, edit cancellation/save, sidebar,
  History and document tabs. Rendered screenshots were compared with references.
- PostgreSQL catalog editing/projections and actual two-stage withdrawal checks:
  3 passed. The companion Execution assertion used a nonexistent test-response
  field and was corrected. Final command `tests/execution/test_execution.py::
test_execution_reads_are_scoped_paginated_and_read_only_for_reviewers tests/audit
-q`: 21 passed. Backend runs used `/tmp/mjl-design-tests.py` with disposable
  local PostgreSQL and teardown, never the configured shared database.
- Build, ESLint (one pre-existing lifecycle-ref warning), Ruff and mypy pass.
  Changed-file formatting and diff checks pass; broad Ruff formatting identifies
  pre-existing spacing in untouched `app/auth/policy.py`.

Independent backend and frontend reviewers inspected requirements, source and
corrections. Fixed findings: withdrawn totals, empty table headers/filter meaning,
stale edit-dialog inputs and modal spacing. Human visual/accessibility acceptance
remains outstanding. No new durable lesson was needed beyond existing checks for
reference comparison, test assertions and workflow-aware fixtures.

Final review cleanup batches PTA approval/state summaries and removes the obsolete
planning branches from the Dashboard/Execution component. The new planning browser
spec lives under `e2e/planning` (it was under `e2e/auth` for the earlier 25-test run).
Final candidate on `920c406`: frontend `index-C-k_PymQ.js`, application-source SHA256
`e05f13a86c026bbee3a3acf5402c44db4bf662dd552833407a0ae91128b593bd`.
Affected verification after these corrections:

- PostgreSQL via the same disposable wrapper: `tests/planning/test_catalog_editing.py`,
  `test_withdrawals.py::test_w02_fresh_two_stage_approval_withdraws_activity`,
  `test_transfers.py::test_t05_amend_transfer_amend_withdraw_preserves_annual_history`,
  and `tests/reports/test_metrics.py`: **9 passed**. Covers constant page-query
  count, exact totals and historical approval/transfer/withdrawal semantics.
- Playwright `e2e/planning/planning-design.spec.js e2e/auth/empty-states.spec.js`:
  **23 passed** on the rebuilt bundle, including adjacent Dashboard/Execution.
- Build, changed-file ESLint/Prettier, Ruff and mypy (45 source files) passed.
  Separate standards/specification reviewers rechecked the changes; no unresolved
  source findings remain. Broader earlier results above are not rerun-suite claims.

## Business History and security logging

Implemented 2026-11-06; see the [validated contract](history-logging-implementation-plan.md).
Global History applies Admin/Validator business-event scope to lists, filters and
CSV. Internal Activity viewers share the same authoritative timeline; Partners
remain excluded. Saved deltas, recorded reasons and financial facts are available
without inventing missing legacy details. Existing internal document/export
evidence is preserved outside visible business History.

Routine authentication output is now separate, bounded structured server logging;
existing historical records remain intact. Meaningful account events retain
business evidence. No schema migration or new infrastructure was required.
Production provider, protected log collection, persistence across deployment and
automatic expiration remain unverified until the retention decision and hosting
configuration are supplied. No final duration was selected.

Candidate: working tree based on `25d1d8d`, frontend bundle
`index-C4dorUWJ.js`. Application source SHA256
`499dbf85e147864dcaf3fdf7278c00716e36c764d171e3f72f395f16e437c689`
covers sorted paths/content under `backend/app` and `frontend/src` with
.py/.js/.jsx/.css suffixes (path, NUL, bytes, NUL).

Verification used disposable local PostgreSQL with teardown. Backend commands
below used `.venv/bin/python /tmp/mjl-auth-fix-tests.py` to supply an isolated
TEST_DATABASE_URL and invoke pytest; setup ownership remains in README.

- `tests/audit tests/auth/test_security_logging.py tests/auth/test_auth_security.py
tests/auth/test_profile.py tests/auth/test_access.py -q`: 99 passed before final
  corrections; affected tests were rerun below.
- `tests/audit tests/auth/test_security_logging.py tests/auth/test_profile.py
tests/planning/test_amendments.py::test_m04_amendment_edits_keep_bounded_structural_audit_history
tests/planning/test_withdrawals.py::test_w01_agent_requests_withdrawal_without_changing_approved_content -q`:
  29 passed. Covers the real API/PostgreSQL journey through submission,
  distinct approvals, execution, financial return, both histories, CSV and
  Partner denial, plus transactional rollback and security log suppression.
- `tests/auth/test_profile.py -q`: final correction rerun, 6 passed,
  including valid maximum-length multibyte changes and unchanged saves.
  `tests/audit/test_audit_history.py -k legacy_records -q`: 1 passed,
  12 deselected; legacy records remain intact and sort by time/id.
- An additional focused adjacent-workflow run passed 24 tests covering
  zero-spending approval/return, amendment-transfer-withdrawal, reminder access
  and authentication/lifecycle serialization.
- `npm run test:unit -- src/features/audit src/features/planning/planning.test.jsx
src/features/execution/execution.test.jsx src/features/access/access.test.jsx
src/features/auth/profile.test.jsx --maxWorkers=1`: 81 passed.
  After denial fixes, `npm run test:unit -- src/features/audit --maxWorkers=1`:
  6 passed, including cached-page redaction and late export suppression.
- `npm run test:e2e -- e2e/audit/audit-history.spec.js`: final build, 2 passed,
  desktop/mobile global History and Agent Activity timeline. Browser API responses
  are mocked; this is separate from the real PostgreSQL/API journey.
- Changed-Python Ruff checks/format, mypy (44 source files), build and diff checks
  passed. ESLint has zero errors and the existing lifecycle-ref warning; the
  bundle-size warning remains. No full repository suite or production audit ran.

Earlier focused runs caught obsolete expectations for the new audit shape and
Validator scope; corrected tests passed in the focused runs above. Two independent
review-only agents inspected actual source/diff and evidence. Missing settlement
dates/legacy withdrawal reasons, oversized profile facts and denied-History cache/
export handling were corrected and returned to the same reviewers; both report
no remaining blockers. Review and development checks are not user acceptance,
human visual/accessibility acceptance or production readiness.

Commit review (2026-11-07): both independent reviewers confirmed the unchanged
application source digest above and cleared the implementation. Today,
`npm run test:unit -- src/features/audit --maxWorkers=1` passed 6 tests and
`npm run build` passed. Backend suites were not rerun: the earlier reviewed
candidate is unchanged; temporary raw logs are no longer available. The missing
temporary retention handoff was restored as a separate durable
[decision handoff](retention-policy-handoff.md), with all proposals still unapproved.

## Current UI follow-up boundary

Browser titles use a single string for React 19. Business dialogs share a visible
heading, close control, separated action footer and backdrop dismissal; Project
closure uses the same confirmation dialog. Projects preload Partner availability,
disable creation for an empty catalog, expose read retry and exclude inactive
Partner choices. Empty messages are centered, with reference table headers and
History/Réalisation search toolbars retained.

Partners have an optional saved description (maximum 4,000 characters). Migration
`0026_partner_description` preserves existing Partners with a null description;
its exact schema is included in the authentication eligibility fingerprint.
History filters run before pagination and also apply to CSV: search, action,
author, Activity, Project and inclusive Porto-Novo date range. Réalisation filters
search approved Activity names/reference, assigned Agent and physical progress
(in progress/completed/closed). Query keys and signed cursors include filters;
changing PTA cannot display the previous PTA's rows. Additional financial-stage
filters shown in the prototype are not implemented by this change.

Operation-category placement is now resolved: Agents de saisie can create a
category directly alongside an Operation in Activity creation/edit forms. The
new category is selected without submitting or resetting the Activity draft.
Partners no longer owns category management. Validator API creation remains
allowed; Supervisor/Admin/Partner creation remains denied. Errors stay in the
category dialog; writes retain CSRF, transaction and audit protections.

Empty-state/filter verification before the category follow-up (base `e11c4f4`, bundle
`index-B5olx9lv.js`, 2026-11-06):

- `npm run test:unit -- src/features/planning/planning.test.jsx
src/features/planning/document-denial.test.jsx
src/features/execution/execution.test.jsx
src/features/audit/audit-history.test.jsx`: 68 passed.
- `npm run build` followed by `npm run test:e2e --
e2e/auth/empty-states.spec.js`: 19 passed. Desktop empty-state captures and the
  mobile Partner modal were inspected; this is not human visual acceptance.
- Disposable PostgreSQL: `.venv/bin/pytest` with
  `tests/planning/test_planning.py::test_partner_description_upgrade_preserves_existing_partner`,
  `tests/planning/test_planning.py::test_partner_optional_description_round_trips`,
  `tests/audit/test_audit_history.py`, `tests/audit/test_audit_export.py`,
  `tests/execution/test_execution.py::test_execution_filters_use_approved_name_and_do_not_change_authorization`
  and `tests/execution/test_execution.py::test_execution_filter_ignores_new_unapproved_operations`:
  18 passed. The migration test verifies the populated predecessor round-trip and
  the final authentication schema fingerprint, not only fresh-schema creation.
- Independent review inspected the final code and test logs; no blocking findings
  remain for the implemented scope.
- Changed-file Prettier and Ruff checks, mypy (42 source files), and diff checks
  passed. ESLint has no errors; the existing auth lifecycle-ref warning and build
  chunk-size warning remain. Local `/api/v1/auth/session` returned HTTP 200.

Category follow-up verification (2026-11-06, bundle `index-CDXhb2pj.js`):
`npm run test:unit -- src/features/planning/planning.test.jsx` passed 33 tests.
Disposable PostgreSQL tests
`test_agents_create_operation_categories_with_existing_guards` and
`test_p02_p12_p13_role_matrix_and_coordination_assignment` passed (2 tests),
including capabilities, role denials and missing CSRF. The focused Agent test
first failed with 403 before the permission change. The current browser suite
`npm run test:e2e -- e2e/auth/empty-states.spec.js` passed 20 tests covering category creation,
error retry, selection, no accidental Activity submission and preserved drafts.
Build, changed-file Ruff, ESLint (same pre-existing warning), and diff checks pass.
Independent review inspected the final evidence and found no blocking issues.

## Implemented

- Session-service outages return to login with a refresh-safe local sign-out hold.
  Recovery confirms server logout before allowing fresh sign-in. `/logout` is a
  direct route; not-found pages retain the appropriate sidebar. Relances opens
  from the sidebar without a horizontal header. Invitation email uses the supplied
  final HTML wording and the invited role, with matching plain text.
  The reproduced local 502 was caused by the API not listening on port 8000;
  restarting the configured development API restored readiness and session 200.
  The reason the earlier process stopped is not established.

- Dashboard/reminder reads now share identity locks instead of contending for an
  exclusive session lock. Mutations retain exclusive locking. Ordinary page data
  has one-minute freshness and five-minute in-memory retention; tab hiding/return
  no longer purges data or forms. Logout, expiry, offline and cross-tab account
  changes retain their access protections and 24-hour session boundary.
  Auth fields stay filled while a successful submission waits for navigation.
  Dashboard empty rates display `0 %`; missing/unconfirmed finance displays `-`.
- `/profile` replaces `/identity`, with a centered personal-information form.
  Users can edit first/last names; email/role remain read-only. Migration
  `0025_profile_names` preserves existing combined names without guessing their
  split, adds a name-consistency constraint and refuses lossy downgrade. It was
  tested on disposable PostgreSQL and applied to the configured development DB.
  Profile updates compare the original snapshot under lock and audit atomically;
  stale edits offer explicit reload/discard. Legacy combined names prefill editable
  suggestions without rewriting stored names until the user saves.
- Admin users and pending invitations share one paginated table, including safe
  invitation state/delivery/version facts and existing permitted actions. Name and
  email are stacked. Invite names share a desktop row. Shared shadcn Select and
  submit-button progress are used by business forms; auth criteria are blue and
  successful invitation activation prefills only the login email.
- History and its CSV exclude authentication/security noise while preserving the
  underlying audit. They expose actor, target and safe recorded before/after facts.
  Historical events without those facts cannot be retroactively reconstructed.
- Partners/Projects use reference table layouts and actual project counts/partner
  names. Execution uses approved execution rows, current assigned names, period,
  progress and administrative stage. Empty messages are centered. Operation-category
  creation now lives in the Activity form, as described in the current follow-up
  boundary above.

  Current verification: 43 affected disposable-PostgreSQL tests passed across
  auth/profile, access, audit history/CSV and Dashboard reads. Focused follow-ups
  passed execution assignment projection (1) and failed/revoked invitation
  summaries (2). Browser layout checks passed 19 tests, followed by 11 empty-state
  and secondary-section checks. The earlier 38-case browser run had 34 passes,
  two failures subsequently fixed/rechecked, and two environment-gated recovery
  skips; it was not a complete pass. Final `npm run test:unit -- --maxWorkers=1
--reporter=verbose` passed all 179 tests; earlier interrupted broad runs are
  superseded by this completed run. `tests/auth/test_auth.py` passed 4 additional
  disposable-PostgreSQL tests. Backend commands use `.venv/bin/python
/tmp/mjl-auth-fix-tests.py` with `tests/auth/test_profile.py`,
  `tests/auth/test_access.py`, `tests/audit/test_audit_history.py`,
  `tests/audit/test_audit_export.py` and `tests/planning/test_dashboard_reads.py`;
  the helper creates and drops isolated local test databases. Browser commands
  use `npx playwright test` with `e2e/auth/admin-presentation.spec.js` and
  `e2e/auth/empty-states.spec.js`. Final build artifacts are
  `index-4qAJzd62.js` / `index-CHGs9n2I.css`; the existing bundle-size warning remains.
  ESLint, Prettier, Stylelint, Ruff, mypy and diff checks passed. Independent review
  found no remaining blocker after correction. Screenshots cover desktop/mobile profile, Admin pages,
  Partners, Projects and Execution empty states. No production deployment or human
  visual acceptance is implied.

- Auth form state is scoped to each route: navigation clears errors, confirmation
  messages and drafts, with cancellation/generation guards for late responses.
  Password-reset copy remains neutral about account existence and delivery.
  Public error responses and OpenAPI omit correlation IDs; internal audit/log
  correlation remains available. Business request IDs remain part of workflows.
  The local login outage was a runtime database mismatch: Compose started an
  empty database while `.env` pointed to the existing hosted development database.
  The app now runs in the documented host development mode against `.env`.
  No account/password data was changed. Personal password/OTP login is unverified.

  Focused verification: `npm run test:unit -- src/features/auth/auth.test.jsx
src/shared/api/rest-client.test.js --maxWorkers=1` passed 22 tests. `npm run
test:e2e -- e2e/auth/navigation-transitions.spec.js e2e/auth/recovery.spec.js
--output=/tmp/mjl-auth-fix-browser` passed 7 tests; 2 real-service recovery tests
  skipped because their isolated backend/mail fixture was not configured.
  `.venv/bin/pytest tests/auth/test_auth.py -q` passed 4 tests using disposable
  PostgreSQL databases, including a full password/OTP journey and error contract.
  ESLint, Prettier, Ruff and build passed (`index-B_GtFBmc.js`); the existing bundle
  warning remains. Live localhost session/readiness checks passed, and validation
  errors return only code/message. Independent review found no blocking code issue.

- Page guards, navigation and workspace destinations share a derived UI
  authorization catalog exposed by the existing access context. API adapters
  reuse the transaction-bound principal resolver for identity, role and mutation
  CSRF checks. Resource/state/contributor authorization remains server-owned.
  The [hot-path review](hot-path-review.md) records avoidable waits, repeated reads
  and an ordered improvement plan. Frontend queries now load only the active
  screen or open form’s dependencies; shared session data is exposed through a
  Query-backed React context. Partner invitation choices load one page on demand.
  Backend batching, history pagination and lock optimizations remain planned.

- Invited accounts, password/OTP sessions, ordinary lifecycle/recovery and
  permanently Partner-bound identities.
- Direct entry to login or Dashboard for every verified role, restoring the last
  permitted page when available. One frontend page catalog drives sidebar links,
  direct page guards and remembered destinations. The shared sidebar uses the
  verified user’s name/initials and contains long identities in its account menu.
  Internal Dashboard reads only selected project/PTA metrics; Admin Dashboard
  shows account totals and management actions, while Partner Dashboard shows
  permitted entry links. Separate Prévisions (PTA) and Réalisation
  entry pages use bounded project/PTA lists. Project and audit lists use tables.
  Full inspiration parity remains open: the PTA list API does not yet expose
  partner names, activity/validation summaries or approved budget per row; no
  summary is inferred from a paginated list. Partner Dashboard statistics
  are not implemented.
  Authentication screens follow the supplied references; OTP fields support
  typing, paste, correction and automatic submission on the sixth digit. One
  application-wide access gate masks navigation and protected views during bounded
  session revalidation, guards protected downloads and never replays writes.
  Switching tabs preserves data and drafts; actual cross-tab authentication changes
  still reverify access and cannot cancel an unconfirmed logout.
  Ordinary read failures preserve drafts; denied
  reads discard the affected cached data and previews. Public recovery proofs
  survive connection changes. Admin users, history and
  account pages share the reference navigation; default list URLs omit empty
  filters and first-page parameters. Shared fallback states now cover missing and
  forbidden pages, temporary service failures, unexpected rendering failures,
  offline access, invalid proofs and local read errors. Initial session checks use
  the authentication frame and keep protected content masked; authenticated page
  waits use a minimal centered loader inside the verified shell. Subtle skeletons
  remain limited to local tables, dependent sections and document previews.
- Auth actions display progress inside their buttons; invitations collect separate
  first and last names and retain the existing normalized full-name API contract.
  Admin navigation remains present during ordinary loading, with non-interactive
  labels before identity is known. Page/control translations are grouped in `frontend/src/locales/fr/`.
  Concurrent session, Admin-list and history reads share identity locks to avoid
  serializing independent reads; lifecycle mutations retain exclusive locks.
  API projections omit unused invitation/session identifiers, full Activity detail
  in lists, and internal financial snapshots. The
  [loading and fallback contract](loading-and-fallbacks.md) records the
  scenario mapping and known API-level limitations. The router supplies a
  sanitized reload fallback for unexpected rendering failures.
- Partner/Project/PTA planning, independent Activity review, amendments,
  unstarted withdrawal and forward annual transfer.
- Operation execution, exact spending, separate budget-increase funding approvals,
  décaissement/virement approvals, external settlement and Activity/Project closure.
- Validated zero-spending closure and direct correction after financial return.
- Assigned-Agent reminders, recipient notifications, optional Activity evidence,
  reasoned withdrawal, image preview and Validator-controlled Partner sharing.
- Whole-PTA metrics, internal and sanitized Partner Fiches, global audit/CSV,
  internal annual CSV/Excel/PDF working reports and Partner-scoped PTA CSV.
- Local real email accounts and five French HTML/plain-text messages via Resend.
- Supabase PostgreSQL for local development, with encrypted connectivity and
  provider metadata compatibility while retaining MJL schema integrity checks.
  Setup is documented in README; production authentication remains excluded.
- Installable PWA with online-only business operations and guarded update handling.

The source schema head is `0029_decision_observations`. Focused integration tests
applied it to disposable PostgreSQL databases; application to a shared or production
database is outside this local evidence. Application code, migrations and focused
tests are implementation evidence; do not treat a summary or an old passing count
as a new verification run.

Application presentation now uses Tailwind utilities for auth, Admin, internal
and Partner views. The CSS entry contains fonts and approved theme tokens only;
shared layout/button components own repeated styling. This migration preserves
the existing loading and access-verification behavior. Human visual acceptance
remains outstanding.

Sidebar identity now opens a shared keyboard-accessible account menu. Auth CTAs
remain busy through session verification; logout uses one page loader and deliberate
failure recovery. The disabled session Query observer is retained when its value
is cleared, fixing the Agent post-OTP false access denial. Empty URL parameters are
stripped centrally, password criteria use approved badge tokens, and fallbacks
are centered within the full content area beside navigation.

Role defaults remain in `authorization.js`; `navigation.js` restores the last
permitted page per user/role. Detail paths remain in memory during the app session;
only allowlisted top-level choices survive reload in sessionStorage. Filters,
fragments and secrets are never stored. API resource checks still apply on return.

Reviewed role/navigation and empty-state candidate: built assets
`index-DppCh8dO.js` and `index-C5Gd2_xF.css`. This adds `full_name` to the
verified session projection; it changes no schema. Existing unnamed users retain
an email-initial fallback. No migration is needed.

The sidebar follows the requested role matrix in engineering.md. Partner Exports
has its own protected page, and internal reminders open in a dialog. Empty tables
retain their headers; empty text is centered as explicitly requested. Prévisions
preserves project/year entry for the first activity even without an existing PTA.

Final verification (commands from `frontend/`, except backend checks):

- `npm run lint`, `npm run lint:css`, `npm run format:check` and `npm run build` passed.
- `npm run test:unit -- --maxWorkers=1`: 175 passed in 18 files.
- `npm run test:e2e -- e2e/auth/empty-states.spec.js e2e/auth/role-pages.spec.js e2e/auth/navigation-transitions.spec.js --output=/tmp/mjl-empty-final`:
  22 passed, no skips. Includes sequential year typing, first-activity entry,
  scoped Partner export, all five role menus, auth/logout transitions and centered
  empty states. Screenshots were inspected for the changed empty compositions.
- Backend `.venv/bin/pytest tests/auth/test_access.py -k each_business_role_accepts -q`:
  3 passed with a disposable PostgreSQL database and teardown. The test asserts
  the minimal session projection including name and preserves Admin endpoint
  denials for all three internal business roles. Ruff passed for the three files.
- Separate specification and standards reviewers inspected the full changes and
  cleared functional findings after correction. The standards reviewer separately
  ran catalog/navigation tests: 11 passed. Final browser evidence also passed.

The existing JavaScript bundle-size warning remains. Fixture-backed browser
coverage is not live backend/email or human visual/accessibility acceptance.
The later catalog/planning refinement above supplies PTA summary projections and
PTA/Execution search filters. At that checkpoint, populated Dashboard
attention/financial sections remained outside the slice; they were subsequently
completed in **Internal Dashboard attention and finance, 2026-11-10** below. No
fictional totals or nonfunctional controls were added to imitate references.

Current invitation/Relances/session-recovery candidate (2026-11-06):
`npx vitest run --maxWorkers=1` passed 183 tests in 19 files;
`npx playwright test e2e/auth/service-recovery.spec.js e2e/auth/navigation-transitions.spec.js e2e/auth/auth-presentation.spec.js`
passed 29 tests. Build, ESLint, touched-Python Ruff and `git diff --check` passed.
Disposable-PostgreSQL pytest: `tests/execution/test_reminders.py tests/auth/test_mail_accounts.py -q`
passed 33 tests; three focused invitation delivery/activation tests passed; the
added PTA-year assertion passed in a focused rerun. Earlier frontend failures
exposed obsolete recovery expectations and a real coordinator disposal gap;
those were corrected before the final passing runs. Provider-unmount/late-502
and StrictMode checks are included. Relances screenshot was compared with the
supplied reference; no live invitation was sent for this verification.
Pre-commit review corrected stale header wording and made reminder timestamps
explicitly Africa/Porto-Novo; focused formatter/notification checks passed (2 tests).

Current PTA visual-correction candidate (2026-11-09): the PTA metadata, reviewer
brief, incomplete and populated Activity workspaces, assignment dialog and planning
decision dialogs were compared with the applicable supplied references at desktop,
narrow and 200%-equivalent reflow sizes. The implementation now restores modal
focus to each opener, keeps incomplete briefs from exposing submission, separates
incomplete-draft guidance from complete-draft budget facts, and aligns the populated
Activity editor's field order and budget reconciliation. Assignment search excludes
already selected Agents and previews additions, removals and the removal effect
before saving. These are presentation and client-interaction corrections only; no
API, schema, role or persisted workflow behavior changed.

Final-source evidence for this correction: focused planning Vitest passed 55 tests
in 3 files; fixture-backed `planning-design.spec.js` passed 6 browser cases covering
desktop/reflow/mobile composition and dialog Escape/outside/cancel focus return;
the production build, ESLint (with one pre-existing auth hook warning), Stylelint,
Prettier and `git diff --check` passed. The real-service planning journey was
discovered but skipped because its opt-in environment was not enabled. The existing
large JavaScript chunk warning remains. Rendered comparison and automated checks
are implementation evidence, not client acceptance or production readiness.

PTA shared-explorer slice completed (2026-11-09): the PTA table and calendar now
share router-owned text/reference, validation, current-Agent and inclusive period
filters. **En correction** maps to both returned workflow states without adding a
stored state. Cursor signatures include every normalized criterion, Agent choices
come only from current assignments in the selected PTA, and invalid or reversed
dates fail with 422. The annual calendar now loads every matching page before it
renders and uses a horizontal annual/monthly timeline with clipped cross-year spans,
compact date labels, start-only markers and keyboard-accessible Activity links.
Long names use a readable two-line treatment; full dates remain in accessible
labels and the shared inspection dialog. The whole-PTA summary remains unfiltered.
Execution adds administrative filters backed by current authorization requests,
approved virements, exact closure blockers and completed-operation facts.

Planning and Execution reuse the same search/Agent/state/additional-filter
composition and readable removable criteria. Searchable Agent pagination remains
inside the option popover. The timeline is separated by its real presentation
responsibility and reuses the business Modal; cursor scope reuses the canonical
fingerprint helper. Response-only state checks were removed in favor of contextual
workflow outcomes. These corrections implement the agreed simplicity/reuse
checkpoint.

Focused final evidence: seven isolated-PostgreSQL tests passed with 238 deselected
in 39.85s. They cover normalized Activity filter/cursor scope, filtered traversal
beyond 100 rows and administrative Execution states with adjacent closure,
disbursement and virement facts. Planning passed 44 Vitest tests in 3 files;
Execution passed 29 tests in its focused file. Ruff and strict mypy passed for the
touched backend modules. Final targeted ESLint, Stylelint, Prettier and
`git diff --check` passed; the earlier full ESLint run had no error and retained
the pre-existing auth-hook warning. The production build passed with the existing
large-chunk warning. The final six-case fixture-backed browser suite passed in
20.2s, including searchable Agent selection, annual/month navigation, tooltip,
keyboard inspection, Escape/focus return and 918px Planning/Execution reflow
containment. The rendered annual timeline was inspected at 1846 × 970. Both
independent reviewers' concrete findings were corrected and returned for recheck.
These checks are implementation evidence, not human acceptance or production
readiness.

## PTA slice 5 — Execution and settlement presentation, 2026-11-09

The Execution list now shows each Activity's physical progress, final or partial
spending against its authorized budget, and administrative state. Activity detail
keeps the Project, Partner, PTA, responsible Agents, dates and approved revision in
one header and connects the existing Programming, Réalisation & finances, History
and evidence tabs without replacing their deep links.

Operations are presented in one physical-realization table. **Consulter** opens the
shared right-side business dialog for the existing explicit start, record and
reasoned-correction commands; Activity documents remain Activity-scoped and are
reached through the existing evidence tab. Approved Activities expose the existing
protected Fiche download. The established financial approvals, zero-spending route,
complementary funding and closure rules remain unchanged inside one sequential
administrative section with an Activity evidence row. Reversement entry uses the
shared business dialog and calendar and displays the server-derived full required
amount as fixed text rather than an editable amount.

Final focused evidence:

- `npm run test:unit -- src/features/execution/execution.test.jsx
src/features/planning/planning.test.jsx`: **68 passed**. Both independent
  reviewers repeated the affected unit checks; the specification reviewer passed
  Execution **29/29**, and the standards reviewer passed the combined **68/68**.
- Disposable PostgreSQL: `.venv/bin/pytest -q
tests/execution/test_execution.py -k
execution_reads_are_scoped_paginated_and_read_only_for_reviewers`: **1 passed,
  29 deselected** in 11.53s. The temporary empty `mjl_test_` base and per-test
  database were removed; no development data was used.
- The final production build passed, followed by
  `npx playwright test e2e/execution/execution.spec.js`: **5 passed** in 12.5s.
  This covers operation start/completion/correction, reviewer read-only history,
  zero-spending desktop/mobile reflow, closure evidence and the complete
  administrative settlement/reversement dialog journey. Final screenshots were
  inspected at desktop and 390px; this is not human visual/accessibility acceptance.
- Ruff and strict mypy passed for `backend/app/planning/execution.py`; targeted
  ESLint, Prettier and `git diff --check` passed. The production build retained the
  existing large-chunk warning.

Separate specification and standards/design reviewers inspected the requirements,
actual diff, surrounding code and evidence. Their administrative composition,
eligible Fiche, shared calendar, localization, component ownership and browser
coverage findings were corrected and returned to the same reviewers. Both reported
no remaining blocking finding. Review is not user acceptance or production
readiness. The completed temporary workflow plan was removed; settled rules remain
in the owning guides and this status records the final boundary.

Final commit review aligned the ready/reversal filters with the same fail-closed
closure basis used by detail and closure, and preserved the responsible Agents in
closed detail. On a disposable PostgreSQL instance, the focused closure regression
run passed **2 tests with 31 deselected** in 14.09s. It proves an Activity with an
extra removed operation carrying execution facts is blocked in detail and excluded
from the ready list, and that a real closure response retains its responsible Agent.
Focused Ruff, strict mypy and `git diff --check` passed after the correction.

No banking execution, partial reversement, new operation-attachment model or new
financial exception was introduced. Production readiness and client acceptance
remain outside this implementation evidence.

## Internal Dashboard attention and finance, 2026-11-10

The internal Dashboard now gives Agents, Supervisors and Validators a bounded
summary of work that their existing role and resource assignments let them act
on. The server returns the exact count and at most the first three prioritized
items, linking planning reviews back to Planning and financial or settlement work
back to Execution. It reuses the current assignment, reviewer-exclusion,
no-self-validation and closure rules; it does not create a second workflow or
make the browser an authorization boundary.

The financial strip now separates approved budget, known operation spending,
closed spending, remaining reversement and confirmed reversement. Values use
integer XOF strings. A missing basis remains `null`, while a confirmed zero is
returned and displayed as `0 F CFA`. The existing physical and financial progress
facts remain the source of the two Dashboard rates. The Partner Dashboard, new
mutations and a generic all-actions destination remain outside this slice.

Final focused evidence:

- On disposable PostgreSQL, `pytest -q
  tests/planning/test_dashboard_reads.py` passed **6 tests** in 33.96s after one
  discarded setup-only run used an incomplete test URL. The journeys cover
  planning and financial role attention, exact settlement values, the explicit
  zero-reversement case, role denial and the adjacent shared-read behavior. The
  temporary database and cluster were removed.
- The production frontend build passed with the existing large-chunk warning.
  The populated Dashboard browser journey passed at desktop and 390px, and both
  rendered screenshots were inspected. The affected role/entry/empty-state rerun
  passed **8 tests**. A broader browser campaign passed **28 of 31**: two unrelated
  Planning fixture journeys timed out, while one stale Admin-heading assertion
  was corrected and included in the focused pass. This is not reported as a
  broad-suite pass or human accessibility/visual acceptance.
- Ruff, strict mypy, targeted ESLint, Prettier and `git diff --check` passed on
  the final candidate. Separate specification and standards/design reviewers
  found the missing-versus-zero defect; it was corrected with a contextual
  workflow regression and returned to both reviewers. They reported no remaining
  blocking code or contract finding.

Runtime follow-up: a Project with no PTA returned 503 because the raw expanding
bind in the approved-plan summary inferred an integer type for an empty Project-ID
set. The summary now returns its neutral empty projection without issuing that
query. The regression failed with the reported 503 before correction; afterward,
the full explicit-PTA file passed **8 tests** on disposable PostgreSQL and the
original read-only development-database replay completed. Root development
StrictMode was also removed after a browser trace proved it canceled and repeated
each Query read during navigation; the same trace then issued Projects and PTAs
once each. The production build and focused static checks passed. Independent
review found no remaining blocking issue; production/client acceptance claims are
unchanged.

Reversement attention batch-prefilters eligible candidates but invokes the
canonical closure check for each remaining candidate. This candidate-filtered
N+1 read is a known performance limitation; duplicating the closure rule or
introducing a new abstraction was not justified for this summary slice.
Production, security and client acceptance gates remain unchanged.

## Activity creation and assignment UX - implementation candidate, 2026-11-10

The reviewed Activity plan is implemented across the existing Planning,
notification and audit seams. Agents can save and reopen a title-only initial
draft, while submission still requires the complete dated and balanced plan.
Reviewers retain quick creation with ten active Agents prefetched, and newly
assigned Agents receive a recipient-only in-app notification plus one bounded
email attempt. Agent self-creation does not notify. The Agent PTA view starts on
`Mes activités`, undated drafts appear under `Sans date`, and category
descriptions are now persisted.

Migrations `0030`-`0032` add category descriptions, permit incomplete initial
drafts without weakening submitted/approved revisions, and store the narrow
assignment-notification record. Downgrades refuse data loss where the older
schema cannot represent current rows. Email failure does not roll back an
assignment or its in-app notification, and notification reads remain scoped to
the recipient.

Fresh corrected-candidate verification used disposable PostgreSQL. Repeatable
migration to head passed and the strict schema fingerprint was regenerated from
the migrated database. The affected backend campaign completed with **26 passes**
and one order-sensitive assertion; after correcting that assertion to compare the
assigned set, its focused workflow rerun passed **1 test**. Backend Ruff and
strict mypy passed.

The affected frontend campaign passed **104 tests in seven files**, covering
Planning, PTA metadata, quick creation, History, notifications, authentication
labels and adjacent Execution behavior. ESLint passed with one unchanged hooks
warning, and the production build passed with the existing large-chunk warning.
A broad parallel run completed **217 of 221 tests**; its four Execution misses
then passed together in the isolated **29-test** file rerun, so the broad run is
not represented as a pass. A later single-worker broad attempt was interrupted
and is not evidence. The focused reviewer quick-create browser journey passed and
its desktop, 390px, calendar, Agent-selection and short-height screenshots were
inspected against the supplied composition. Independent specification and
standards/security/design reviewers cleared their concrete code findings. The
Agent full-form desktop/mobile composition remains part of the user's ongoing
human review. These checks and reviews are implementation evidence, not human
visual/accessibility acceptance or production readiness. Final specification
review removed an unapproved end-year cap while retaining start-year and date-order
rules; the corrected Planning frontend rerun passed **47 tests** and the two-role
reviewer-brief PostgreSQL rerun passed **2 tests**.

## Activity History, role work filters and review notifications, 2026-11-10

The Activity detail now keeps History on its own tab, presents business events in
human French without raw identity IDs or email addresses, separates loading from
empty/error states, shows assigned Agents in the validation summary and restores
the approved status colors and finance affordance. Supervisors enter a PTA on
`À examiner`; Validators enter on `À approuver`. Both defaults use the actual
server-side contributor and no-self-review eligibility and remain removable.

Activity review notifications are implemented through the existing recipient
inbox. Submission alerts eligible Supervisors; prevalidation alerts eligible
Validators; a return alerts assigned Agents in-app and by one plain-text email
attempt; final approval alerts assigned Agents in-app only. Read and handled are
separate, an already-read update is harmless, and a mail failure cannot roll back
or replay the workflow transition. New HTML mail output is deliberately absent
until approved templates are supplied.

Corrected-candidate evidence: the independently reviewed presentation/filter
slice passed **47 frontend tests**, **14 PostgreSQL-backed History/filter tests**,
focused Ruff and strict audit mypy. For notifications, repeatable migration to
`0033_activity_notifications` and plain-text mail rendering passed **2 tests**;
the complete affected notification/reminder file passed **19 tests** on disposable
PostgreSQL. The focused frontend campaign passed **49 tests**. Backend Ruff and
strict mypy, frontend ESLint and `git diff --check` passed. Independent review
found one stale reviewer-inbox cache after decisions; notification invalidation
and a two-branch contextual regression corrected it, and the same reviewer then
cleared the slice. Withdrawal approval remains a separate lifecycle-copy and
recipient boundary rather than being mislabeled as ordinary Activity approval.
Financial-request notifications are implemented in the following slice. These
checks are implementation evidence, not human visual acceptance or production
readiness.

## Financial-request review notifications, 2026-11-10

Additional-funding, disbursement, virement and zero-spending submissions now
notify every active reviewer who is eligible when that review stage becomes
actionable. Supervisor decisions hand the notification to eligible Validators;
returns notify current assigned Agents in-app and by one plain-text email attempt;
final approval notifies those Agents in-app only. Existing frozen contributor
and no-self-review facts determine eligibility. Notifications are committed with
the financial transition, while mail is attempted once after commit and cannot
roll back the decision.

The recipient inbox keeps read state separate from handled state, validates the
underlying request/Activity relationship and opens financial items in the current
`Réalisation & finances` view. Successful financial actions invalidate the
current user's inbox cache. Migration `0034_financial_notifications` adds the
narrow durable record. No HTML templates, retry queue, generic event system or
named manager hierarchy were introduced.

Corrected-candidate evidence: complete focused backend journeys
passed for all four supported financial request types (**4 tests**). The affected
notification/reminder, migration and representative plain-text mail checks passed
**23 tests** on disposable PostgreSQL. Three focused financial UI journeys and
the notification inbox file passed, backend Ruff and strict mypy passed, frontend
ESLint passed, and the production build passed with the known large-chunk warning.
Independent review found no P1/P2 issue and independently reran the four workflows,
plain-text rendering, the affected inbox/migration checks, **31 frontend tests**,
Ruff, strict mypy, ESLint and `git diff --check`. Real Resend delivery and browser
E2E were not run. These checks are implementation evidence, not human acceptance
or production readiness.

Final commit review corrected stale reviewer notices after financial cancellation
and batched inbox source lookups. Both independent specification and standards
reviewers cleared the candidate. The final disposable-PostgreSQL rerun passed
seven cases using `pytest -q` with funding
`test_return_cancel_retains_pause_and_requires_fresh_decisions` and
`test_funding_notifications_follow_the_available_reviewer`, disbursement
`test_cancellation_or_return_releases_execution_for_fresh_request`, and virement
`test_audit_failure_rolls_back_decision_and_cancellation`. Focused Ruff, strict
planning mypy, `bash -n scripts/dev.sh` and `git diff --check` passed. The reviewed
development launcher and metadata alignment for already-existing indexes are
included; the launcher was not run against the user's development database in
this review.

## Review and correction email templates, 2026-11-10

The six supplied email designs now live with the application templates and have
matching plain-text alternatives: Activity and financial review at Supervisor and
Validator stages, plus both correction returns. Their subjects use the six agreed
actions. Activity copy identifies initial submission, amendment, withdrawal or
annual transfer and uses neutral wording when a person's name is absent. Financial
copy uses the Activity reference and the exact stored request amount; a declaration
without spending is shown as `Déclaration sans dépense — 0 F CFA`. A financial
return tells the Agent to correct the request and submit it again. The templates do
not create request numbers or substitute unrelated values for missing facts.

Withdrawal and annual-transfer submissions now create Supervisor review notices,
while their existing prevalidation path creates Validator notices. Cancelling an
amendment, withdrawal or transfer handles notices from both stages so obsolete work
no longer appears actionable. Login and OTP keep an authorized path from a mail or
inbox link. Opening the notification menu refreshes its unread count without adding
periodic polling.

All durable notification emails use one bounded delivery-attempt helper. Explicit
provider rejection is recorded as failed; a network or malformed-success outcome is
recorded as uncertain and is not retried. Migration
`0035_uncertain_notification_mail` adds that status to the four existing durable
notification records and refuses a downgrade that would discard uncertain history.
The mixed notification inbox reads one repeatable database snapshot and batches
reminder projections; its UI presentation and localized pagination no longer rely
on repeated nested kind checks.

Candidate evidence: the six mail pairs passed **23 tests**. The complete
PostgreSQL-backed reminder/notification file passed **20 tests**; focused financial,
withdrawal, transfer, amendment and repeatable-migration checks passed **8 tests**
on disposable PostgreSQL. Focused Ruff and strict mypy passed. Frontend ESLint,
Prettier and production build passed, with the existing large-chunk warning. The
full frontend run completed **220 passed, 5 failed**: the failures were in unrelated
execution/planning journeys during the concurrent run. Rerunning those two files
alone with one worker passed **73 tests**; this focused pass does not turn the broad
run into a pass. Real Resend delivery, Gmail/Outlook rendering and browser visual or
accessibility acceptance were not run. No historical notification backfill or
resend, retry queue, polling or generic event system was added.

Independent specification and standards review found that missing decision facts
could incorrectly attribute prevalidation or return to the original submitter, and
that a malformed reminder snapshot could be displayed as the name `None`. The
corrected context builders now keep an unknown decision actor neutral, and reminder
projection rejects a missing/non-text Activity name. Focused regressions passed
**2 tests**; the normal Activity and financial attribution journeys then passed
**2 PostgreSQL-backed tests**. Focused Ruff and strict mypy passed again. The same
reviewers cleared the corrected candidate with no remaining blocking finding.

Pre-commit review independently cleared both specification and standards again.
`npm --prefix frontend run test:unit -- --maxWorkers=1` completed with **224 passed,
1 failed**: the execution-history 404 case timed out finding its initial button.
Its focused rerun (`src/features/execution/execution.test.jsx -t 'background history
failure 404' --maxWorkers=1`) passed **1 test, 28 skipped**. The full suite remains
recorded as failed. Explicit mail and missing-data pytest node selections passed
**25 tests**. An earlier overly broad selection also picked five PostgreSQL cases
without `TEST_DATABASE_URL`; those failed at fixture setup and provide no new
database evidence. The disposable-PostgreSQL results above remain the database
evidence for this unchanged implementation. `git diff --check` passed.

## Remaining inputs and excluded work

| Subject              | Boundary / owner                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production           | Deployment/accounts, provider/region, legal/RSSI acceptance and operations evidence remain unapproved; see security requirements.                                                                            |
| Mail                 | Live Gmail/Outlook/inbox evidence remains owner-directed after private configuration. Production scheduling, retry, queues, webhooks and browser push are outside scope.                                     |
| Documents            | Production storage/scanning/retention/key custody require data-owner/RSSI input. PDF preview, restoration, general versioning and other attachment contexts are not enabled.                                 |
| Lifecycle            | Technical Admin recovery/reinvitation, reverse transfer and general reopening/restoration remain excluded. Future Partner deactivation requires no active Project or unfinished Activity.                    |
| Reporting/accounting | Official templates, accounting rules/examples, SPD meaning and delivery acceptance need client input. Past-date reconstruction and global audit PDF/XLSX remain deferred. Partner annual export is CSV-only. |
| Financial exceptions | No banking execution, partial reversement or reallocation. A real late settlement exception needs user clarification; do not invent one.                                                                     |
| Visual acceptance    | Human visual/accessibility/client-copy acceptance remains outstanding.                                                                                                                                       |

## Known verification limitations

Prior frontend checks reported a large-bundle warning and a development-only
Stylelint/glob dependency advisory. No new dependency audit was run for this
documentation consolidation; verify the current candidate before dependency work
and avoid force-downgrading tooling to obsolete releases. No production/compliance
assessment follows from development checks. A broader planning/Execution backend
run for the shared-explorer candidate was stopped after an unchanged schema-admin
fixture failed to clean up a local Supabase role (`DROP OWNED` lacked privilege).
It is not reported as a broad pass; the seven affected focused PostgreSQL journeys
were rerun cleanly on the final candidate.
