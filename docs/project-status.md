# Project status

Updated 2026-11-22. MJL is under development; implemented does not mean accepted
or production-ready. This file describes the current boundary, not authorization
for another feature. [Business rules](business-rules.md) define behavior;
[engineering](engineering.md), [security](security.md) and [design](design.md)
own their subjects. [README](../README.md) owns setup and development commands.

## Execution administrative status — 2026-11-23

The Execution list derives one concise administrative status from the existing
execution projection. Completed physical work under financial review now shows
the relevant décaissement, virement or no-spending step instead of the generic
**Réalisation suspendue** label. The shared frontend helper also covers work to
complete, reversement, funding regularization, other administrative blocks,
closure readiness and closed Activities. No API, workflow or permission changed.

## Activity correction resubmission — 2026-11-22

An assigned Agent can resubmit a valid Activity after either the Supervisor or
Validator returns it with an observation, even when the Activity values are
unchanged. Each resubmission creates a fresh immutable revision and restarts the
full Supervisor-then-distinct-Validator review chain. A newly opened no-op
amendment remains blocked, and transfer/withdrawal request correction rules are
unchanged.

The focused disposable-PostgreSQL regression failed before the correction with
`409 correction_unchanged` and passed afterward through both returns and final
approval. The adjacent amendment test retained its expected no-op rejection; its
later, unrelated second-Agent edit still fails under the current private-draft
assignment fixture and is not reported as a passing test.

## Financial review eligibility for Activity brief creators — 2026-11-22

A Supervisor or Validator who only created the initial Activity brief remains
eligible for their normal financial review step. The request submitter, Activity
content authors and execution authors remain excluded, and the Supervisor and
Validator decisions must still be performed by distinct people. The rule is
shared by funding, décaissement, virement and zero-spending requests.

Migration `0041_reviewer_finance` corrects existing frozen request exclusions
while retaining real authors and inherited virement exclusions. Focused API
tests cover Supervisor and Validator brief creators through décaissement and
virement. Trigger-enabled migration tests cover funding and prevent Alembic from
claiming the irreversible repair was rolled back. Frontend regression coverage
confirms that the current row opens a centered local modal and renders the
Validator action granted by the API.

## Administrative modal completion behavior — 2026-11-22

Virement and reversement dialogs close after a confirmed successful mutation.
Reversement stays open only when an optional evidence upload still needs review
or retry, and closes after a successful retry. Access dialogs now have one
visibility owner, and the shared administrative step uses one centered-dialog
variant and one close handler. Execution and Access regression suites cover the
changed interactions.

## Activity header and financial review flow — 2026-11-21

Activity-header actions now use a shared Activity-specific Button variant, and
the visible header actions are text-only. The workspace navigation calls the
reminder entry **Notifications**. Supervisor and Validator review of both
décaissement and virement requests now opens a centered modal immediately from
the Activity finance table without URL mutation or an Activity-page reload; the
obsolete request-history expander is no longer displayed. Links identify only
the Activity page or tab and never open a particular request dialog.

Financial-request pagination is restored in the **Demandes financières** card,
so older décaissement and virement requests remain reachable outside any modal.
Task/Subtask execution dialogs receive the current Query records through props
and keep only local open/closed state. Their unsaved values and starting version
remain stable if the Activity refreshes in the background.

Access invitation links open the Users page without opening a dialog. Failed
Access actions keep the dialog and entered fields visible with the error inside
the dialog. Zero-spending creation and review now use the same success/close and
failure/retain behavior as the other financial dialogs; zero-spending history
pagination is owned by the Finance card.

The focused 154-test frontend run, targeted formatting/lint checks and production
build passed. A focused Playwright settlement journey failed before reaching the
changed modal because its fixture rendered the service-unavailable screen and
waited for an older submission control. Browser-level visual evidence for this
candidate therefore remains incomplete pending fixture reconciliation.

The follow-up verification passed 69 Access/Execution unit tests, targeted ESLint,
`git diff --check` and the production build with the existing large-chunk warning.
The focused browser journey was not rebuilt or rerun for these final corrections
at the user's direction; earlier browser evidence remains historical evidence for
the earlier candidate only.

Independent review found one zero-spending creation error hidden behind the open
modal. The correction displays that error in the dialog, retains the reason for a
retry and clears through the same close handler after success or cancellation.
The same reviewer cleared the corrected candidate with no remaining blocking
finding; its focused two-scenario rerun passed.

The next corrective review found route, concurrency and error-placement gaps.
Financial pagination now remains on the Activity Finance tab and each control is
disabled only by its own request. Zero-spending creation and return reasons keep
their starting version through background refreshes. Task/Subtask failures appear
inside their open modal. Access row dialogs now receive current Query records,
store no selected record or identifier, retain a role draft's starting version,
and avoid refreshing the list after confirmed validation errors.

Funding requests now follow the same modal ownership rule. A row opens only its
current request without a page reload, stored selection identifier or detail
read; **Nouvelle demande** handles only the pending increment. Funding pagination
remains in the Finance card. Failed actions retain the entered reason and starting
version, while successful actions close the modal. The focused 52-test Execution
run, targeted formatting/lint, `git diff --check` and the production build passed
with only the existing chunk-size warning. Specification review reported no
behavior finding. Standards review found a missing modal footer; actionable
funding reviews now use the shared bordered footer with **Annuler** and the same
close callback. The same reviewer cleared the correction after focused checks.
No browser visual journey was run for this follow-up.

Partner and Project edit dialogs now belong to their current list row rather than
to a selected record copied into page state. Background refreshes can update the
list without replacing typed form values or the concurrency baseline captured
when editing started. Failures remain visible in the open dialog for retry;
successful edits close and refresh through the existing page mutation. If the
row disappears, the dialog closes with focus returned to the page heading.
Creation, permissions, Partner/Project relationships and API contracts are
unchanged. The full Planning unit file passed 74/74 tests, targeted lint and
formatting checks passed, `git diff --check` was clean, and the production build
passed with the existing large-chunk warning. Independent review requested and
then cleared visible refreshed-row assertions for both successful edit flows;
there is no remaining blocking finding or verification gap in this slice.

The Activity calendar preview now follows the same ownership boundary. A timeline
row stores only whether its tooltip and preview are open and renders the current
Activity list record directly. An open preview therefore follows refreshed data,
and it closes naturally if that Activity leaves the list. No Activity identifier
or copied server record is retained for modal selection; API, permissions,
navigation and timeline presentation remain unchanged.

Closed previews no longer leave duplicate hidden Activity content in the document.
When refresh removes the Activity whose preview is open, focus moves to the stable
timeline-period summary. The combined Planning run passed 71/71 tests; targeted
ESLint, Prettier, `git diff --check`, and the production build also passed. No
browser visual journey was run for this state-only change. Both independent
reviewers cleared the corrected candidate.

Project closure now follows the same current-record ownership rule. An eligible
Project row stores only whether its confirmation is open, and the confirmation
uses the latest Query record and version. Successful closure still uses the
existing page mutation; failure retains the confirmation. Removing the open row
during refresh closes it and focuses the Projects heading. Project edit drafts,
API contracts, permissions and closure eligibility rules are unchanged.

Rejected closure now shows its safe error inside the retained confirmation and
supports retry through the same action. The affected Planning and timeline run
passed 74/74 tests, targeted lint/formatting and `git diff --check` passed, and the
production build completed with the existing chunk-size warning. No browser
visual journey was run. Both independent reviewers cleared the corrected
candidate.

## Controlled-browser baseline and auth reconciliation — 2026-11-21

The CI-shaped controlled-browser group was restarted against a freshly built
frontend and a disposable synthetic FastAPI/PostgreSQL stack. Foundation reached
the real readiness API and passed. The process ended without a final Playwright
summary after case 105 of 128; the observed ledger is 69 passed, 31 failed, five
skipped because their isolated connected environments were not supplied, and 23
unrun. This is an incomplete, failing broad run. The failures cluster around
current authentication/form labels, empty-state and loading expectations, fixture
route drift and Execution presentation; they do not justify blanket removal.

The first bounded cluster is reconciled. Authentication password locators now use
the stable field-label prefix rather than requiring punctuation, required markers
and password-toggle text to remain exact. The Admin invitation journey proves that
an omitted Partner blocks the request and exposes a validation alert before the
selected Partner ID is submitted. Admin navigation checks compare route paths
instead of assuming preview port 4173. No application or API behavior changed.

The final complete authentication-presentation file passed 17/17 in 13.2 seconds,
and the reviewer-corrected complete Admin-presentation file passed 9/9 in 11.3
seconds on
isolated preview port 4196. Targeted ESLint and Prettier passed. Some controlled
auth fixtures still allowed unrelated API reads to reach the absent default proxy;
tightening those fixtures and reconciling the remaining empty-state/loading cluster
is the next browser-test phase. These focused passes do not turn the broad run into
a pass.

No immutable source snapshot was captured before the broad command. Repository
HEAD was `b3d7cd4f1f729890ec4a928aa367c031370f17a5`; the surviving `npm run build`
artifact used by Playwright has aggregate SHA-256
`b05a6c5bb0d649477cdb321f12d78a8206452f9e988499fd138319401efabee6`.
The aggregate uses the path/content algorithm recorded in the testing plan.
At the post-run evidence capture, the unfrozen worktree had 29 status entries. The
broad run preceded the final locator corrections, while the focused results bind to
Admin test SHA-256 `492b00be4b2c7a765c33ecbe1bdd5829a0acda611003d37efa3d9ca1e7ca394c`
and authentication test SHA-256
`caec580de93b11e0d5f932fc8a1a08cd4dd91014ec1d06c427cabe3aefee67c8`.
Later concurrent source edits are outside those results.

## Activity submission and visual consistency — 2026-11-20

Activity edit and detail submission checks now share one frontend validator for
required fields, date boundaries, Task/Subtask amount equality and weight totals.
Financial request creation uses the shared exact XOF input, virement stays hidden
until its décaissement prerequisite is complete, and review drawers no longer
repeat the optional creation attachment. Required-field errors are real linked
elements for both native and manually validated controls.

The PTA page now leads with the Project identity. Activity header typography uses
the approved title and metadata tokens, while the five financial facts use one
desktop row and responsive reflow. Draft over-allocation behavior remains unchanged
pending a final métier choice. The focused final frontend run passed 123 tests,
targeted ESLint and the production build passed, and independent re-review cleared
the candidate. Responsive financial breakpoints were inspected in code; no rendered
browser screenshot pass was run.

## Foundation browser reconciliation — 2026-11-20

The Foundation browser file now follows the current public route contract against
a real disposable FastAPI/PostgreSQL stack. Anonymous `/` redirects to the usable
login form, `/health` is opened directly and returns the real readiness response,
and an unknown route shows the not-found recovery whose return link opens login.
Keyboard focus and mobile-width containment remain verified. Exact button/body
color assertions were removed because they repeated presentation values without
establishing another application outcome.

The same built artifact proves manifest installability, static-asset-only caching,
no API caching or offline POST replay, no business IndexedDB store and controlled
service-worker replacement. The first real-backend run passed the two PWA journeys
and failed only the stale anonymous-home assertion. After reconciliation, all three
Foundation journeys passed in 8.6 seconds. The adjacent router/PWA unit files passed
13/13 tests in 7.66 seconds; ESLint and Prettier passed. The production build passed
with its existing large-chunk warning. No application, API, security or business
behavior changed. The isolated containers, network, database volume and temporary
policy/environment files were removed after review.

## Session-service recovery browser reconciliation — 2026-11-20

The controlled Admin journey now follows the accepted session-service failure
behavior: while the initial session read is pending, protected Users content stays
hidden; a 503 then triggers one bounded local sign-out and returns the browser to a
fresh login form without exposing the protected table or requiring a retry click.
The fixture accepts only GET session reads and one POST logout, and the journey
proves the recovery stops after three session reads and one logout request. Its
loading screenshot and obsolete on-page retry assertions were removed because they
did not establish the current application outcome.

The adjacent invitation scenario passed unchanged and therefore did not justify a
test or application edit. The initial two-scenario reproduction passed invitation
and failed the stale recovery expectation. After reconciliation, the same two
scenarios passed in 4.0 seconds and the complete Admin browser file passed all nine
journeys in the final 11.7-second run. The access and access-coordinator unit files
passed 44/44 tests in 10.19 seconds. Targeted ESLint, Prettier and whitespace checks
passed. No application, API, security or business behavior changed, and the
Foundation live-backend verification remains separate.

## Activity-history browser reconciliation — 2026-11-20

The controlled Agent journey now follows the current Activity-history contract:
changed values are visible directly in the compact timeline, while presentation
metadata and a separate details expander are absent by design. Its Activity fixture
uses the current Task field and represents an assigned Agent. The journey proves
that two history events returned by the API remain newest-first, names the actor,
shows the actual before/after description and keeps the event and exact change
visible after resizing to mobile. Its fixture permits only the expected session,
Activity, history and unread-notification reads. Two screenshots and assertions
for milestone wording and the removed expander were retired because they did not
establish another application outcome.

The fresh four-file browser probe reported 12 passes and five failures. Two
Foundation failures did not reach their intended checks because no backend was
running at the configured proxy target; the other failures reproduced the recorded
Activity-history and two access/retry mismatches. After reconciliation, the complete
audit-history browser file passed both its global-history and Activity-history
journeys in 4.9 seconds. Its adjacent timeline unit contract passed in 2.32 seconds;
targeted ESLint, Prettier and whitespace checks passed. No application, API or
business behavior changed. The Foundation environment and two access/retry
mismatches remain separate work rather than being reported as passing.

## Frontend unit-gate scheduling — 2026-11-20

The complete Vitest gate now runs test files serially while retaining per-file
isolation and the existing per-test timeouts. On the current four-core development
environment, default file parallelism produced nine failures across Execution,
Planning, PTA and Audit while all affected scenarios passed in focused or complete-
file reruns. Two workers still produced two Execution failures. These results are
consistent with scheduling contention, but do not yet distinguish resource pressure
from order-dependent or cross-file interference. No Partner document failure
reproduced: both Partner files passed all 15 tests together.

The measured serial command passed all 300 tests in 215.85 seconds. After making
file serialization the configured default, the ordinary `npm run test:unit`
command passed the same 34 files and 300 tests in 180.05 seconds. No individual
timeout was enlarged, no test was removed, and no application behavior changed.
The two serial runs provide a reliable frontend unit gate on the measured
environment. If the affected tests recur, inspect their setup and cross-file
interactions before considering restored parallelism; do not mask recurrence by
raising timeouts. CI timing remains to be measured, and these runs do not establish
browser, API, production or other-runner performance.

## Application-update browser reconciliation — 2026-11-20

The controlled application-update journey again reaches the real unsaved Activity
form before installing a waiting service worker. It uses the current programming-
edit action and a complete current Activity-detail response for an assigned Agent.
When the worker activates, the client discards the unsaved protected screen,
performs server logout, opens a fresh login and leaves no waiting worker or stale
protected screen. The test checks these state and access outcomes rather than
treating update wording as the feature under test.

No application, API or security behavior changed. The focused browser reproduction
first timed out waiting for the removed generic edit action. After fixture and flow
reconciliation, the focused journey passed in 5.1 seconds and the complete state-
handling browser file passed all three journeys in 6.6 seconds. The adjacent PWA-
update unit contract passed in 1.47 seconds. Targeted ESLint, Prettier and whitespace
checks passed. These controlled responses do not replace server-side session-
revocation evidence or a broad browser-suite pass.

## Editable financial requests and shared action variants — implemented, 2026-11-20

Agents can enter a positive décaissement up to recorded spending and a positive
virement up to the approved décaissement amount. Both request forms accept an
optional observation and one optional validated attachment, submit directly into
the existing two-stage review, and provide no Draft action. Review keeps amounts
read-only and exposes the applicant facts. Settlement calculations retain actual
spending as the reversement basis and the approved virement as the transfer basis.
Partial approvals now retain and expose the remaining balance. Successive approved
requests accumulate, every approved virement requires its own exact external
confirmation, and reversement/closure stay blocked until the cumulative décaissement,
virement and confirmation totals reconcile with final spending. When several
partial virements cover one Activity, they share one Activity-level reversement;
opening any related virement shows that same declaration and later confirmation
corrections remain frozen across the Activity.

The OTP secondary actions, Activity-header downloads/assignments, destructive
actions and specialized controls now use explicit shared Button variants. Shared
business forms provide consistent required-field feedback. Attachment metadata
travels as bounded UTF-8 in the request body and is validated before storage, so
French filenames and observations keep their exact text without depending on
browser or proxy header limits.

The focused shared-field/Auth/Access/Execution frontend run passed 82 tests. The final disposable-
PostgreSQL run passed five request, observation, attachment, transfer and migration
checks. Migration 0040 also completed an empty-database downgrade to 0039 and
re-upgrade to head. Ruff, mypy, ESLint, CSS lint, Prettier and the production build
passed; the build retains the existing large-chunk warning. The final review
correction additionally passed four focused PostgreSQL cumulative-request,
shared-reversement, closure and schema-integrity scenarios and 118 focused
frontend tests.

## Uncertain-upload reconciliation correction — 2026-11-20

The uncertain document-upload checks again follow the authorized Activity flow.
Their Agent is assigned to the Activity, the browser opens the existing supporting-
documents tab, and an older document cursor is cleared when the upload dialog
opens. Before upload, the client records the newest page's document identifiers
and the selected file facts. After an uncertain network result, it closes the
dialog only when a fresh read contains a new document with the same name, size
and uploader. A failed read keeps reconciliation available; a successful read
that proves absence enables a deliberate retry. The original upload is never
replayed automatically.

The unit flow covers a saved upload and a proven-absent upload after a failed read.
It includes an older identical file and another user's new identical file so
neither can be mistaken for the attempted upload. The controlled browser journey
uses an assigned Agent, follows the existing supporting-documents tab, rejects
unexpected API requests and proves that exactly one upload precedes successful
reconciliation. The API contract and server authorization behavior did not change.
The final unit file passed both outcomes in 9.26 seconds, the adjacent document-
workspace scenario passed in 16.33 seconds, and the rebuilt focused Playwright
journey passed in 3.4 seconds. Targeted ESLint and Prettier checks and the production
build passed; the build retains its existing large-chunk warning. The complete
browser file's earlier diagnostic run recorded two passes and the known application-
update timeout, so no final browser-file or broad-suite pass is claimed.

## Activity financial-summary projection correction — 2026-11-19

The Activity execution detail now projects the current décaissement state with
the already authoritative approved amount and virement context. The Finance
summary therefore remains stable while a user browses older cursor pages: an
older returned request cannot replace or hide the current authorization state.
Financial decision and request-dialog copy is owned by the French execution
locale. Unit checks assert visible business facts, while the controlled browser
journey checks the four-fact desktop row and its mobile reflow.

The broad affected unit run passed 46 of 48 tests; its two known order-sensitive
reversement scenarios then passed together on the immediate focused rerun. The
focused Activity-detail browser journey and production build pass. The previously
unavailable PostgreSQL gate was rerun on an isolated disposable database: both the
Supervisor-return and Validator-return variants passed in 18.04 seconds. They
prove that the Activity remains frozen while execution detail retains the approved
décaissement request, its `approved` state and the exact 300,000 XOF amount.

Independent re-review cleared the pagination-authority, localization and
outcome-test findings. It recorded one non-blocking coverage gap: the regression
directly proves the pending summary state, while an approved virement drawer on
an older conflicting history page is verified by code inspection rather than a
separate visible-outcome test.

## Backend static gates — restored, 2026-11-19

The three historical migrations identified by the CI-equivalent baseline now use
the repository's current Ruff layout. Migration 0013's long PostgreSQL condition
was split only at an existing SQL whitespace boundary; revision identifiers,
parent links, operations, constraints and downgrade guards are unchanged. No new
test was added because this slice changes no behavior or schema.

The complete backend Ruff lint and format gates pass across 157 Python files. An
AST comparison against the captured pre-edit sources matched after normalizing
whitespace inside string constants. The exact final backend image
`sha256:d531d6732a357060e55eac23fdb4ec9216e4bdca49270493f2189d3012e76898`
then applied the complete Alembic chain to a fresh disposable PostgreSQL database,
which reported `0039_editable_activity_dates (head)`. This is focused migration
and static evidence, not a complete backend-suite result.

## PTA detail identity test reconciliation — 2026-11-19

The PTA detail again presents the required saved PTA name as its single page
heading. Project, year and optional description remain visible as supporting
context. This restores the approved metadata boundary after concurrent visual
work had replaced the PTA identity with the Project name.

The existing create, uncertain-write reconciliation and submitted-edit dismissal
tests were retained because each completes a distinct save workflow and verifies
the refreshed saved PTA. The adjacent annual-page loading test now uses the PTA
identity as its ready-state outcome while continuing to prove that the page stays
in loading until its Activity list is available. No test was added, removed or
split.

The baseline reproduced three PTA-metadata failures while the adjacent Planning
file passed, for 75 passes and three failures overall. The focused PTA file then
passed all 11 tests, and the final combined Planning/PTA selection passed all 78
tests in 54.32 seconds while targeted static checks ran in parallel. Frontend
lint passed with one existing Hooks warning,
Prettier passed and the production build passed with the existing large-chunk
warning. The broader Planning design browser file remains incomplete: two tests
passed and six failed on the concurrent visual candidate; four failures concern
existing focus/modal interactions and two use hard-coded port 4173 while the
isolated run used 4193. No browser or visual-acceptance pass is claimed.

## CI-equivalent stabilization baseline — incomplete, 2026-11-19

The working tree was checked in independent backend, frontend and browser lanes
on a disposable Compose stack. It was not frozen while concurrent frontend work
continued, so this is a time-bounded failure inventory rather than one immutable
candidate or a clean CI result. The exact source boundary and commands are in the
[testing-strategy evidence ledger](testing-strategy-plan.md#ci-baseline-evidence-ledger--2026-11-19).

Backend mypy passed all 59 application source files. Ruff found one line-length
error in migration 0013, and the format check found migration 0009, 0013 and 0036
outside the current formatter output. The first full pytest client session ended
without a summary while its process continued; the durable rerun therefore
overlapped it unintentionally. Both processes were interrupted. The durable run
reported 109 passed, one setup error and two warnings in 13 minutes at about 7%.
The error was a migration statement timeout while the two broad processes
overlapped; its cause is unconfirmed. Its exact audit-history case passed alone
in 7.65 seconds after both broad processes stopped. No complete backend-suite
pass is claimed, and the overlapped timing is not valid evidence for changing the
CI timeout or test architecture.

Frontend ESLint, Prettier, CSS lint and the production build passed; ESLint retains
one existing Hooks warning and the build retains its existing large-chunk warning.
The complete unit run finished with 286 passed and seven failed across Planning,
Execution, Partner documents, PTA metadata and uncertain-upload handling. The
financial-summary regression passed inside that run. These failures remain a
classification backlog alongside the ongoing visual work.

The required connected Activity-submission browser journey first stopped before
mutation because a reused local policy named another lifecycle database. After a
disposable policy was aligned with the actual isolated database and browser origin,
the journey passed in 21.9 seconds. The broader controlled-browser command was
interrupted after five passes, five failures, one skip and one interrupted test;
116 tests did not run. Two failures came from running port-specific fixtures on an
alternate port. A corrected focused rerun of the first four affected browser files
on the expected port passed 12 tests and failed five in 1.6 minutes. The remaining
foundation, upload/update, Activity-history and access-retry mismatches are not
reported as visual acceptance or a completed browser baseline.

No application, API, schema or test code changed in this checkpoint. Its backend
static-gate follow-up is now complete. The next stabilization slice should
reconcile one frontend failure cluster at a time; no further test retirement is
justified by this baseline alone.

## Activity approval/correction test strategy slice — completed, 2026-11-19

The 2026-11-19 API flow covered complete recovery after both review stages and at
that time required changed content before resubmission. That content-change
requirement is superseded by the 2026-11-22 rule above. The retained protections
still require a fresh revision, Supervisor prevalidation and a distinct Validator
decision, while revision detail preserves earlier return reasons and decisions.

The strengthened scenario passed alone in 8.53 seconds. Initial approval, the
corrected return flow, approval/return serialization and duplicate-evidence
protection then passed all 4 focused tests in 24.92 seconds on the exact final
candidate and disposable PostgreSQL. A broader selected command did not return its
pytest summary and is not reported as passing. Three adjacent baseline failures
were outside that slice and are reconciled in the following section:
private-draft assignment setup, an old migration-message expectation reached after
the weighted-Task downgrade guard, and a reviewer-brief fixture missing current
Task weights. No application behavior, API contract, schema, deployment or
production configuration changed.

## Contributor/reviewer test fixture reconciliation — completed, 2026-11-19

The contributor evidence scenario now starts from a Supervisor-created private
draft assigned to both Agents. Agent 2 completes and submits it, so the test still
proves that a persisted content contributor cannot review the lineage after a role
change and that revision, decision and the exact content-contributor evidence are
immutable. It no longer depends on a reviewer seeing an Agent-created private draft.

The reviewer-created brief scenario supplies 100% progress when completing weighted
Tasks. It retains the approved distinction: a Supervisor or Validator who only
created the brief may perform normal planning review, but remains excluded from
financial self-review. The positive decision-observation migration guard now runs
in a dedicated disposable database at the exact 0028→0029 seam; it proves both
downgrade refusal and preservation of the used observation. The existing unused
round trip remains covered separately.

The contributor scenario, both reviewer roles, used downgrade guard and unused
round trip passed all 5 focused tests in 28.04 seconds on disposable PostgreSQL.
Ruff, formatting and whitespace checks passed. No application behavior, API
contract, schema, deployment or production configuration changed.

## Password-recovery test reconciliation — completed, 2026-11-19

The concurrent preparation scenario now proves that two requests produce one
delivered recovery record and one usable emailed proof. Concurrent completion
still proves one successful reset, one rejected contender, one credential-version
change, one consumed proof, one significant completion record and one reset notice.
Notification failure checks observe actual notice delivery while proving that a
mail or recording failure cannot reverse the completed password change.

Three previously recorded failures came from expecting routine
`recovery_prepare` or `recovery_notification` rows in business history, contrary
to the current security-event boundary. The baseline reproduced those three
failures with the fourth parameterization passing. After reconciliation, all four
focused cases passed in 19.73 seconds on disposable PostgreSQL; the concurrent
preparation case includes public inspection of the exact emailed selector and
verifier. No application behavior, API contract, schema, deployment or production
configuration changed.

## Historical migration test reconciliation — completed, 2026-11-19

Closure downgrade protection now runs at the exact 0014→0015 boundary. A dedicated
database contains one synthetic `activity.closed` audit record; attempted downgrade
is refused and both revision 0015 and the evidence remain intact. This replaces a
current-head downgrade that correctly stopped earlier at weighted-Task history.

Operation-tombstone validation now uses a complete synthetic PTA-1 removal chain at
revision 0005. A clean control proves upgrade to 0006 succeeds and reconstructs its
contributor. Four independent cases then corrupt the removed Task's type, name,
allocation or position and prove the upgrade refuses each incomplete chain without
partially advancing or discarding the corruption.

The five recorded failures were reproduced in 33.22 seconds. The repaired five
protections plus the clean control passed all 6 cases in 7.43 seconds on disposable
PostgreSQL. Independent review then required guaranteed teardown around migration
setup and a test-database prefix guard; the same final selection passed all 6 in
6.31 seconds. No application behavior, API contract, schema, deployment or
production configuration changed. This focused result does not claim a broad
backend pass.

The adjacent contributor and attribution cases were subsequently reconciled on the
same exact revision-0005 fixture. Their new baseline reproduced all 4 failures in
30.34 seconds: one stale private-Draft assignment and three current-head downgrades
blocked by weighted-Task history. The complete historical chain now contains a
real edit, reversion, no-op save and Task removal. Upgrade to 0006 reconstructs the
creator and real editor while excluding the no-op saver; missing, duplicated and
skipped audit versions each refuse upgrade without advancing or rewriting the
corruption. The repaired four cases passed in 4.57 seconds, and all eight consumers
of the consolidated contributor/attribution/tombstone fixture initially passed in
5.20 seconds. Independent review required valid active assignments for every
historical editor and removed a redundant exclusion assertion. The corrected final
eight-case selection passed in 5.74 seconds. The stronger contributor success case
subsumes the removed tombstone-only clean control. No application behavior, API
contract, schema, deployment or production configuration changed; this remains
focused migration-test evidence.

## Partner-isolation test strategy slice — completed, 2026-11-19

Partner users remain permanently bound to one Partner and read only approved public
portfolio facts. Focused real-API flows prove that guessed foreign Projects, PTAs,
Activities, Fiches, private/shared documents and exports remain unavailable, while
authorized CSV, sanitized Fiche and shared-file delivery work through protected
routes. Four focused PostgreSQL tests passed in 48.19 seconds.

The shared-document list now keeps its upload timestamp solely for opaque cursor
ordering and returns only the approved identifier, name, media type and size. This
corrects a strict response-serialization failure without expanding the API contract.
Independent synthetic Partner clients use separate fixture addresses so unrelated
actors do not exhaust one IP rate budget before the authorization checks run.

The controlled browser flow now rejects unexpected API requests, confirms the
read-only public portfolio and protected CSV/PDF/image downloads, and shows no
internal Users, Planning or History navigation. Wording-only Fiche expectations,
the repeated mobile download and screenshots were removed; the unique mobile
preview-containment check remains. The initial tightened browser journey passed 1
test in 8.6 seconds; the final review-corrected journey passed 1 test in 5.0 seconds.
The 28 focused frontend tests passed in 14.59 seconds.

The seven remaining lifecycle scenarios were reconciled with current rules. Shared
setup assigns both acting Agents; post-closure evidence administration uses the
Validator; Partner CSV assertions identify public fields by column name; and exact
API values are paired with current-format Fiche checks for transferred dates, the
transfer decision and the corrected reversement date. The obsolete downgrade round
trip from current head was replaced because the weighted-task migration deliberately
refuses that lossy history boundary. A separate disposable database now exercises
the exact 0021→0022 sharing migration, proving private defaults and refusal to
discard used sharing history. Closed-Activity sharing and the runtime schema guard
remain covered. Before these independent-review corrections, the complete Partner
API group passed all 21 tests in 130.82 seconds. The final corrected group, including
the added migration seam, passed all 22 tests in 136.96 seconds on disposable
PostgreSQL. The earlier 14-of-21 run remains historical evidence of stale fixtures.
No schema, approved business rule, deployment or production configuration changed.

## Session-revocation test strategy slice — completed, 2026-11-19

A dedicated controlled browser journey now proves the cross-tab security outcome.
A Supervisor sees protected notification data and the current account; after an
authentication-change broadcast, the client immediately removes the old account,
business data and workspace while the bounded server recheck remains pending, then
presents a fresh login after the rejected and anonymous session checks. The fixture
uses exact paths and methods, current error envelopes and rejects unexpected API
requests.

The existing server tests remain the authoritative proof that logout rejects a
restored old cookie and that role, lifecycle, password and security-version changes
invalidate active sessions. Six selected cases passed in 11.37 seconds on disposable
PostgreSQL. The existing access-coordinator and RestClient files passed all 39 tests
in 3.95 seconds. The corrected dedicated Playwright journey passed 1 test in 2.8 seconds.
The revocation tail was removed from an unrelated execution-review browser scenario;
its focused baseline still fails earlier on the in-progress current screen, so no
passing execution-flow claim is made. No application behavior, API contract, schema,
deployment or production configuration changed.

## Financial-return test strategy slice — completed, 2026-11-19

The controlled browser scenario now follows the current Activity finance screen
for both disbursement and virement returns. It proves that the Agent sees the
return reason and exact 100,000 F CFA amount, submits a fresh request with the
immutable approval basis, and still sees the fresh and returned requests. Its API
fixture lists every expected path and method, uses current list/mutation shapes and
valid financial states, and fails unexpected calls. The retained return reason is
reopened after the fresh submission. The stale legacy-route/cursor setup and
unrelated page-wide overflow assertion were removed. A separate 390 px base-screen
check remains; the in-progress visual work retains responsibility for the returned
modal at the previous 375 px viewport.

The final focused Playwright run passed 2 tests in 6.6 seconds. The existing connected
API journey passed 1 test in 10.35 seconds on disposable PostgreSQL, covering both
returns, fresh Supervisor and Validator approvals, exact external confirmation,
settlement, closure and retained reasons in the Fiche. No application behavior,
API contract, schema, deployment or production configuration changed.

## Connected Activity-submission test gate — implemented, 2026-11-19

CI now creates and migrates a disposable `mjl_test_` PostgreSQL database with a
generated synthetic auth policy, then explicitly runs one connected Playwright
goal. An assigned Agent submits a complete Activity through the UI; a Supervisor
sees the submitted state, exact amount and prevalidation action, and the same
browser session reads the persisted Activity and immutable revision snapshot.
Missing connected-test settings fail this required selection instead of producing
a skipped pass. Controlled-response browser checks run separately.

The final isolated local run passed 1 connected test in 52.8 seconds on port 4174
while visual checks continued on port 4173. Negative checks rejected missing
settings, a mismatched database before mutation and an invalid preview port. An
actual UID-10001 backend-image check confirmed the generated policy needs and now
receives read permission. The production build passed with the existing chunk-size
warning. No product behavior, API contract, deployment or production configuration
changed. The current in-progress History visual does not yet render revision data;
this gate proves the reviewer screen and real revision API, not that presentation.

## Shared Axios transport — implemented, 2026-11-18

The existing RestClient now delegates request configuration and transforms to
Axios while preserving current parsed JSON, empty-success, protected download,
error and access-coordinator contracts. Its header-aware adapter lets protected
`401` responses mask access before a delayed body completes; caller cancellation
also remains silent while ordinary error bodies are pending. Direct raw-file
uploads retain explicit CSRF without a forced JSON content type. No resource API
contract or Activity component changed in this slice.

Focused RestClient/adapter checks passed 15 tests; the existing PTA fixture passed
11 tests, and five timeouts observed under a stopped parallel broad run passed in
focused reruns. Lint, formatting, CSS lint, build and diff checks passed with the
existing React Hooks and chunk-size warnings. Independent review found the two
pending-body issues, verified their corrections and cleared the final candidate.
The final structure move and resource-by-resource Axios response-contract migration
remain in the adoption plan.

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
`Soumise pour prévalidation`; Validators enter on
`Validation définitive attendue`. Both defaults use the actual
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

## PTA Activity visibility and list consistency, 2026-11-11

Initial Activity drafts are scoped to their creator and currently assigned
Agents across PTA lists and counters, direct detail reads, Activity History,
documents, execution and financial subresources, the PTA Agent-filter choices,
and Validator global-audit rows, options and CSV exports. Admin global-audit
access remains complete. Submission restores the ordinary internal read scope;
approved-Activity amendment drafts keep their existing scope. The shared
predicate is applied before count and cursor pagination so a hidden draft cannot
be inferred from totals or page boundaries.

Planning now uses `Soumise pour prévalidation` and
`Validation définitive attendue` as the canonical review-stage labels. Derived
review defaults no longer create duplicate state chips, and the combined PTA
counter is labelled `En cours de validation` because it includes both stages. The
Agent selector lives inside the collapsible filter panel, active filters remain
removable with a restored Agent name after reload, the responsibility action is
an accessible pencil button, and Activity History uses the supplied compact
vertical timeline composition. Workflow mutations continue to invalidate the
shared Planning query family; a regression check binds that invalidation to the
PTA summary query used by the five counters.

Focused evidence on the current candidate: 45 Planning frontend tests and six
History/audit frontend tests passed; frontend ESLint passed with one unrelated
pre-existing hooks warning. The new PostgreSQL draft-visibility journey passed
against an isolated temporary database. An adjacent nine-test assignment/filter
selection initially exposed one correlated-query error and obsolete visibility
expectations; the query was corrected with an aliased assignment relation and
the affected filter journey passed. The final corrected three-test PostgreSQL
campaign passed the visibility, role-read and Agent-filter journeys. The focused
Planning reference Playwright journey passed; the broader six-test design file
also surfaced two unrelated stale selectors in Partner editing and a decision
dialog, so that broad run remains failed. The production build passed with the
known large-chunk warning. A final three-test PostgreSQL campaign passed direct
draft isolation plus Validator audit-list, option and CSV isolation on the current
candidate. Independent specification and standards review cleared the corrected
candidate with no remaining blocking finding.

## URL catalog, module ownership and PWA metadata, 2026-11-11

Frontend route destinations and TanStack route patterns now come from the shared
`Urls` catalog. Production links, redirects, route registration and programmatic
navigation no longer embed route string literals; REST paths remain local to their
request modules. Auth is grouped into components, pages, session and route helpers,
while Planning is grouped into components, pages and display utilities.

Backend Planning retains the same FastAPI routers, models, transactions and HTTP
contracts, with modules grouped into core planning rules, finance, operations,
notifications and reports. Setup, migration, test and browser-runner imports were
updated to the new explicit module paths. No schema or business behavior changed.

The existing Vite PWA now has a stable manifest identity, standard and maskable
icons, Apple install metadata and guarded update registration. Its generated
worker precaches public build assets only. API responses, authentication,
documents, exports, private route fallbacks and business writes remain online-only
and outside runtime caching.

The approved MJL logo now replaces the previous placeholder on the existing
authentication/sidebar, browser favicon, Apple-touch and PWA icon surfaces. The
source SVG and 192/512 px PNG assets live with the frontend public assets; no new
logo placement was introduced. The production PWA build and focused Chromium
installability/cache journey passed with the standard and maskable icon entries.
Independent review cleared the authentication-logo accessible name and found no
remaining blocking issue.

Precommit evidence against the working candidate based on `bb62137`:
`npm run test:unit -- --maxWorkers=1` passed all **226 tests / 25 files**.
Independent review then found two Dashboard attention links outside the catalog;
both now use route patterns and activity parameters. After correcting an invalid
role in the new test fixture, the focused Dashboard/router run
`npm run test:unit -- src/features/dashboard/dashboard.test.jsx src/app/app.test.jsx --maxWorkers=1`
passed **13 tests / 2 files**. This focused run covers the subsequent link change;
it is not a second full-suite run.

Backend `.venv/bin/ruff check app tests`, `.venv/bin/mypy app` (55 files), and
`.venv/bin/pytest --collect-only -q` (890 tests) passed. Runtime PostgreSQL tests
and Alembic upgrade/downgrade were not rerun: this slice moves backend modules
without changing SQL, schema or transaction logic. Browser installation and
Cache Storage acceptance were not performed. `npm run lint`, `npm run format:check` and the final `npm run build` passed.
The final build emitted 13 precache entries and `assets/index-DkCq5CDZ.js`
(SHA-256 `e90c866cf16150c9123ae94ef5d21cdd2071df0606895b80e84b7c703d6ccd49`).
Existing hooks and bundle-size warnings remain. Review also removed unrelated historical documentation formatting.
Final independent specification and standards reviews cleared the corrected
candidate with no remaining blocking findings.

## Demo-staging deployment readiness, 2026-11-11

The repository now contains an inert Render/Supabase demo-staging package. A
multi-stage image builds the Vite application and serves its immutable output with
FastAPI on the same origin as `/api`; browser deep links fall back to the public
shell while API paths remain API-owned. Render's assigned port is honored and the
Blueprint follows `staging` and requests deployment on each pushed commit.
The existing Supabase project is designated for staging; preserve its accounts,
ownership record and data rather than initializing a replacement.
Migrations, ownership provisioning
and first-Admin bootstrap are not container startup actions.
This branch/database configuration correction passed `git diff --check`,
`npx prettier --check ../render.yaml ../README.md` from `frontend/`, and an
independent review. Runtime suites were not repeated for these configuration and
documentation edits; live Render settings and the remote branch remain unverified.

The new `staging` authentication mode accepts only the `demo-staging` environment,
an exact HTTPS origin, a 64-or-more-character lowercase hexadecimal key, real
Resend settings and the literal `non-sensitive-demo-only` operator acknowledgment.
It uses Secure host-only cookies and permits Supabase provider schemas while still
requiring MJL's exact public schema and search-path guard. Local and isolated-test
policies remain unchanged. A tracked placeholder environment file and README
operator procedure contain no credentials.

This capability is limited to disposable, non-sensitive demonstration data. No
Render or Supabase resource was created or changed, no migration was run, no email
was sent and no production configuration was enabled. Provider/region acceptance,
real-data authorization, automatic backups, persistent protected logs, retention,
monitoring, restore evidence and the other external security dependencies remain
open. The free tiers are not production infrastructure.

Final local evidence for the completed candidate:

- From `backend/`, `.venv/bin/ruff check` and `.venv/bin/ruff format --check`
  passed on `app/auth/client_address.py`, `app/auth/policy.py`,
  `app/auth/routes.py`, `app/auth/service.py`, `app/core/frontend.py`,
  `app/core/health.py`, `app/main.py`, `tests/auth/test_client_address.py`,
  `tests/auth/test_auth_policy.py` and `tests/core/test_frontend.py`.
  `.venv/bin/mypy app` and `.venv/bin/pytest
tests/auth/test_client_address.py
tests/auth/test_auth_policy.py::test_auth_cannot_enable_real_accounts
tests/auth/test_auth_policy.py::test_local_policy_requires_resend_and_loopback_app_configuration
tests/auth/test_auth_policy.py::test_staging_policy_requires_explicit_https_demo_configuration
tests/auth/test_auth_policy.py::test_synthetic_password_unicode_categories_match_browser
tests/core/test_frontend.py -q` passed: Ruff and format clean, strict mypy clean
  across 57 source files, and 6 focused tests passed.
- The broader selected authentication/frontend run reached 5 passes and 2 setup
  errors because `TEST_DATABASE_URL` was not configured; those database-backed
  cases are not reported as passed.
- `docker build --file Dockerfile.staging --tag mjl-demo-staging:verify .` passed
  and produced image digest
  `sha256:995ab6bb9c6e6dff3ab1e1cc517f7e7329e948b0623112c563df709bf48f0133`.
  A disposable network-disabled local container smoke exercised the packaged app
  through HTTPX's ASGI transport and returned HTML `200` for `/` and a deep
  browser route, `{"status":"ok"}` for `/api/health/live`, and the documented
  JSON `404` envelope for an unknown `/api` route. HEAD preserved GET content
  length with an empty body; the container was then removed. The earlier local
  Uvicorn smoke verified the configured listening port before the HEAD correction.
- `bash -n .env.staging.example`, the focused Prettier checks and
  `git diff --check` passed. The frontend image build retained its existing large
  chunk warning and reported 10 build-stage npm advisories; Node and `node_modules`
  are not copied into the Python runtime image.
- Separate specification and standards reviewers inspected the requirements,
  diff and evidence, independently reran focused checks, and cleared the corrected
  candidate with no remaining blocking finding.
  The pre-commit review removed a trivial frontend wrapper and corrected HEAD
  response metadata; both reviewers cleared those fixes after focused rechecks.

No live Render edge, Supabase pooler/schema/search-path, migration/provisioning,
Resend, restart or document-flow check was performed. Those provider-runtime checks
require a separately authorized future deployment with disposable data.

## Users page reference alignment, 2026-11-11

Admin now opens on Users; Dashboard is omitted from Admin navigation while direct
route authorization remains unchanged. The Users page follows the supplied Users
and PTA-filter references: one page action, name/email search, a collapsible
Role-only filter with removable criteria, a filtered total above the table,
semantic state badges and outlined row actions. Ordinary delivered invitations no
longer repeat `Envoyée · Envoyée`; only failed, unconfirmed or expired delivery
facts add secondary text. Successful invitation creation uses the global success
toast instead of an inline notice. Account actions now use the shared business
modal, including consistent dismissal and focus restoration; a pending request
cannot dismiss its dialog. Filter refreshes preserve the loaded table and usable
controls, with a compact progress indicator until the replacement arrives.

The account list API adds bounded `q` search across normalized email and full name
while retaining its existing exact endpoint, role filter, pagination and Admin
authorization. The legacy `email` query remains accepted for existing callers.

Focused verification passed 30 frontend tests, frontend ESLint and Prettier, the
production PWA build, backend Ruff and strict mypy across 57 source files, and
backend collection of 24 account-access tests. The changed search journey passed
one focused test against an isolated disposable PostgreSQL database, which was
removed afterward. Three final rebuilt browser checks passed the Admin landing,
Users search and Role-only filter history, desktop/mobile reflow, shared invitation
dialog, required validation and pending submission. Earlier focused browser checks
also passed the Admin destination/sidebar for all roles. A broader 33-test browser
selection was stopped after 16 passes, four failures and one interrupted test; two
failures were stale required-label selectors and passed after correction, while the
remaining service recovery/auth failures and unrun tests are not reported as
passing. The final rendered populated and expanded-filter screenshots were
compared with
`docs/inspiration/users/users.png`, `docs/inspiration/users/user-add-edit-modal.png`
and `docs/inspiration/pta/pta-search-filter.png`. Human accessibility and visual
acceptance remain outstanding.

Final built artifact `index-BBGUNqpe.js` SHA256:
`4c9b65b0c2483b8dbc89fefa4643efd7c0b54b8d1cd71a7981fbf5930d98cc64`.

## Activity presentation, assignment mail and account order, 2026-11-11

The PTA Activity explorer now uses the supplied floating filter composition with
the six current user-facing states, date-overlap controls and Agent search kept
behind Filters. The separate **Mes activités** button is removed. Searchable Agent
lists in filters, reviewer creation and responsibility editing share the supplied
titled search panel. Activity detail keeps its identity facts together, places
**Réalisation & finances** second, and no longer repeats dates inside
Programming. History is a compact timeline: reasons remain visible and only
actual before/after changes are expanded; raw submitted snapshots and metadata
are no longer loaded or displayed.

The Activity fiche uses the approved institutional report hierarchy and page
header while preserving the approved snapshot, exact XOF values, unknown values,
financial evidence and chronology. It names assigned Agents, separates initial,
approved and recorded spending totals, gives each financial request its own
decision table, presents documents in the approved three-column layout, and keeps
validation and administrative events in one chronology. The new-Activity assignment email now uses the
same visual shell as the approved Activity-review message and includes a direct
Activity link in both HTML and text. The Users API orders accounts by their
authoritative bootstrap/invitation creation audit time, newest first; no missing
date is invented and no schema migration is required.

Focused frontend verification passed **81 tests** in the final unified rerun
after the shared Agent listbox received contextual close labels, common keyboard
navigation and status/pagination content outside the option list. ESLint passed with the existing
unrelated effect-cleanup warning, and the production PWA build passed with the
existing large-chunk warning. Mail rendering passed **23 tests**; backend Ruff
passed. The final disposable-PostgreSQL Fiche/account selection passed **12 tests**,
including closed-Activity Agent attribution, unique validation chronology,
complementary-funding decisions, approved-baseline rendering, maximum description
splitting, PDF OpenAPI and newest-account ordering. Its shared setup now follows the approved private-draft
rule: the Agent submits its private draft before a reviewer changes assignments.
A mocked planning
browser selection also failed on stale selectors and unrelated partner/modal
expectations and was stopped; it is not reported as passing. Human visual, print
and accessibility acceptance remain outstanding.

## Réalisations and Fiche presentation alignment, 2026-11-11

The Réalisations Activity list now uses the same floating filter composition as
Prévisions, including Agent search and an overlapping Activity period backed by
the execution list API. The detail identity block follows the same compact
reference, title, context, status, date and responsibility hierarchy and no longer
repeats a technical revision number.

The internal Fiche follows the supplied administrative reference with a concise
identity block, readable Programming section, three budget facts, Operations,
authorization decisions, external declarations, evidence and a bordered
chronology. It omits raw audit action names, unchanged before/after transitions
and assignment cleanup caused by closure while retaining exact XOF amounts,
approved facts, correction reasons, actors and dates. A generated three-page PDF
was rendered to PNG and compared directly with the four supplied Fiche references.
Focused verification passed 30 frontend tests and 13 disposable-PostgreSQL tests;
Ruff and strict mypy passed on the touched backend sources. Human print and
accessibility acceptance remain outstanding.

## Human-readable Activity information, 2026-11-11

Activity screens and human-readable fiches/exports no longer display internal
revision numbers. History continues to show what happened, when, by whom and why;
approved information remains distinct from changes awaiting approval. Immutable
approval records, API fields and concurrency protection remain internal and
unchanged. The code-level information audit and remaining human-review boundary
are recorded in [the Activity UX plan](activity-ux-plan.md).

Final focused verification used disposable PostgreSQL and passed 13 execution,
financial-history, Fiche, annual Excel and Partner Fiche tests. The affected
frontend files passed 83 tests. Independent review also verified that date filters
continue to use the approved schedule while a correction is awaiting approval,
and that long valid history remains printable.

## Activity orientation, 2026-11-11

Activity details now surface the saved purpose with their identity facts.
Prévisions names the next responsible role from the current workflow state, while
Réalisations uses the approved description and keeps its existing administrative
stage. Both explorers explicitly search by Activity title or reference and give
filtered empty results a clear explanation and reset action. Navigation,
permissions and workflow transitions are unchanged.
Final focused runs passed 45 Planning tests, 30 Réalisations tests and one
disposable-PostgreSQL execution-contract test. Frontend lint/format, backend Ruff
and strict mypy, the PWA build and independent specification/standards reviews
passed. Human visual and 200% zoom acceptance remains outstanding.

## Automatic updates and Activity presentation, 2026-11-12

Application updates no longer display a version prompt. A waiting service worker
activates immediately, then hard-navigates through `/logout` when it takes control;
the login form appears after server logout completes. The service-unavailable login
clears the unusable session automatically once per page
load; refreshing the browser provides a fresh recovery attempt without a
**Réessayer la connexion** action.

Dashboard attention rows now use the action required by their actual planning or
financial reason. Planning and Execution Activity details use the refreshed
identity, tab, Programming, finance, History and document compositions.
Administrative finance uses compact, expandable steps and opens the current
actionable step. Planning and Execution tables have bounded columns, wrap long Activity and Project names,
and display assigned Agents one per line. Shared exact-XOF and date helpers now
cover these surfaces and the Activity fiche; absent amounts display `—`, while a
genuine zero displays `0 F CFA`.

Focused verification passed 45 Planning tests, 32 Execution tests, 63 supporting
frontend tests, the production PWA build, one real Chromium service-worker update
journey and one focused session-outage recovery journey. ESLint passed with one
existing coordinator cleanup warning; formatting and focused backend Ruff checks
passed. The 13 focused backend fiche tests passed against a disposable PostgreSQL
container that was removed after the run. Two unrelated
**Relances** E2E cases still use the previous sidebar label after the product had
already renamed that entry **Notifications**.

## Notification access and read-state corrections, 2026-11-12

Notification projections now reapply current Activity visibility before returning
linked live fields. A removed Agent therefore cannot use an old assignment notice,
its read endpoint or a delayed email attempt to learn changes to a private draft.
The durable notice remains stored and becomes visible again if ordinary internal
Activity visibility later applies. Withdrawal approval captures the active assigned
Agents before ending their assignments, so each receives the required in-app final
approval notice without email. Selecting an already-read inbox item also refreshes
the recipient's shared notification cache, clearing a stale sidebar unread count.

Focused verification passed three frontend notification tests and two disposable-
PostgreSQL regressions. The combined affected backend run completed **31 passed,
3 failed**: all failures are older Activity-brief assertions expecting `403` or
assignment management where the current private-draft contract correctly conceals
the Activity with `404`; this run is not reported as a broad pass. Ruff, strict
mypy, ESLint, Prettier and independent review passed for the notification candidate.
The disposable PostgreSQL container was removed after verification.

## Focused Activity reading and entry, 2026-11-12

Activity history now omits the routine draft-to-submission event and presents
creation without artificial before/after details. Immutable records and the
authorized global audit remain complete. Planning and Execution retain a single
page-loading state until all enabled first-view reads finish. Planning starts from
the complete authorized list, offers two review-stage shortcuts and exposes Agent
search beside a compact state/date filter panel.

Missing PTA guidance is compact. Execution uses the approved compact follow-up
action, removes repeated supporting-document panels from finance and Operation
entry, and centers the content-sized Operation modal. **Fiche récapitulative** now
opens a protected PDF preview before offering an explicit download in both
Planning and Execution.

Final focused verification passed 79 frontend Planning/Execution tests, including
the complete 33-test Execution file after the Operation-modal correction, and the
complete 14-test audit-history backend file against disposable PostgreSQL. ESLint,
Prettier, the production PWA build, focused Ruff, backend formatting, strict mypy
and `git diff --check` passed. Vite retained its existing large-bundle warning.
Independent review cleared the corrected candidate with no blocking findings;
human visual comparison remains outstanding.

Planning and Execution now share the reference Activity explorer composition:
search, Agent and Filters align in one compact row, while both 300 px floating
panels follow the supplied right-edge anchoring, 13 px labels and reference
spacing. Filter behavior and Activity visibility are unchanged.
Serial verification passed 46 Planning tests and 33 Execution tests; ESLint,
Prettier, the production PWA build and independent review passed. Human browser
comparison at normal and 200% zoom and narrow widths remains outstanding.

## Activity finance alignment and reference fiches, 2026-11-12

Execution now exposes server-owned realization, balance and required-reversement
facts. Internal and Partner Activity fiches use the supplied six-section A4
composition with embedded DejaVu fonts, dynamic continuation pages and separate
audience projections. The Partner UI previews its protected fiche before download.
Reversement entry can add optional Activity evidence without changing closure
rules; partial upload failure retains the declaration and supports upload-only
recovery.

Focused PDF unit checks and the execution UI contract passed during implementation.
Measured operation-table anchors match the supplied internal PDF within 0.06
points, including the headings, two representative rows, total and following
section; monetary values remain on one line. A clean final selected backend run
passed 25 finance, fiche, Partner and closure tests against disposable PostgreSQL,
including returned initial programming, successive amendments, negative balance,
maximum XOF values, long multipage history and both reversement branches. The 41
affected frontend tests passed. Ruff, backend formatting, strict mypy, ESLint,
Prettier, the production PWA build and `git diff --check` passed; ESLint retained
one existing session-cleanup warning and Vite retained its existing large-chunk
warning. A broader diagnostic execution run completed 79 passes and nine
failures: seven are stale migration-head or downgrade-message assertions, while
the two report failures discovered by that run were corrected and covered by the
clean selected run. The same independent reviewer rechecked the final renderer,
dynamic operation rows, decision history and evidence and reported no blocking
finding. Human visual acceptance remains outstanding.

Pre-commit review corrected French datetime formatting, historical role display,
the realization summary, evidence retry concurrency/cancellation and Partner PDF
denial cleanup. Legacy renderers were removed. Both independent review axes
cleared the corrected source; the standards reviewer also independently passed
the two changed frontend regressions and four renderer tests.

Final pre-commit verification: the report/Partner backend selection completed
18 passes and one stale current-role assertion failure; the corrected assertion
passed its focused PostgreSQL rerun. The frontend selection completed 85 passes
and two Planning timeouts with one worker; both timeout cases then passed alone.
Earlier overlapping frontend jobs timed out and an initial backend attempt lacked
a running database. The focused reruns do not turn those combined attempts into
full passes. Ruff, formatting, strict mypy, ESLint, build and diff checks passed,
with the existing hook and bundle-size warnings. Exact selections are recorded in
the Activity plan.

## Activity detail navigation and finance presentation, 2026-11-12

Activity detail now has one stable identity header across Programming, Realization
and finance, History, and Supporting documents. The tab content changes below the
header without remounting it. The Activity remembers whether it was opened from
Planning or Execution and keeps that sidebar item selected while tabs change.
Normal Execution, dashboard, notification, and legacy detail links enter the same
canonical Activity page.

The finance tab removes its duplicate header and page-top refresh spinner. Open
administrative steps no longer add a bordered card inside the parent card. The
Operation entry dialog remains centered, follows the supplied field hierarchy,
and contains no supporting-document block. Internal Activity fiche actions now
start the protected PDF download directly without a preview step; the Partner
preview contract is unchanged.

The Agent finance entry state now follows the supplied Activity references.
Planning workflow buttons are hidden on the finance tab, editable Operations use
**Renseigner** inside the physical-realization accordion, and completing the last
Operation collapses that accordion. The amount summary uses the approved three
primary facts with confirmed details behind its disclosure row. Administrative
steps stay at **À venir** until physical realization is complete; opening a
blocked step shows the prerequisite message without a nested card or an active
financial CTA. The initial sequence includes the separate external-virement row
and keeps closure disabled inside its accordion. Approved authorization,
external-virement confirmation, reversement and closure remain sibling steps,
with each CTA inside its own accordion. Unknown finance values display **Non
renseigné**, and an unfinished all-zero entry cannot prematurely switch to the
zero-spending workflow.

The combined Planning and Execution run completed **82 passed** on the final
source. ESLint and the production PWA build passed; the existing session-cleanup
and large-chunk warnings remain. Independent specification and standards
re-review cleared the candidate. Human visual acceptance remains outstanding.

Operation execution no longer has a separate start action. The assigned Agent
uses the Operation form immediately; the first accepted submission records its
start and progress atomically. Empty submissions are rejected without creating a
start timestamp. Historical Activities with separate start and record audit
events remain supported by financial verification.

Pre-commit PostgreSQL verification completed 30 execution/brief cases and eight
adjacent finance, access, and report cases. Three previously identified fixture
and downgrade cases were excluded; the full suite is not reported as passing.
The focused frontend interaction and static checks passed. Independent standards
and specification reviews cleared the corrected candidate; commands and limits
are recorded in the Activity UX plan.

## Remaining inputs and excluded work

| Subject              | Boundary / owner                                                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production           | Deployment/accounts, provider/region, legal/RSSI acceptance and operations evidence remain unapproved; see security requirements.                                                                            |
| Mail                 | Live Gmail/Outlook/inbox evidence remains owner-directed after private configuration. Production scheduling, retry, queues, webhooks and browser push are outside scope.                                     |
| Documents            | Production storage/scanning/retention/key custody require data-owner/RSSI input. Supporting-document PDF preview, restoration, general versioning and other attachment contexts are not enabled.             |
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

## Activity header and missing-amount correction — 2026-11-12

Execution-context Activity tabs now share the execution breadcrumb and keep
planning mutation buttons hidden across tabs. Planning entry retains its actions.
The optional authorization-summary disclosure has been removed. Unknown amounts
now display a dash, preserving the distinction from explicit zero.
Final combined Planning and Execution verification completed **82 passed**
(`npm run test:unit -- --run src/features/execution/execution.test.jsx
src/features/planning/pages/planning.test.jsx --maxWorkers=1`). ESLint, Prettier,
production build and `git diff --check` passed, retaining the existing hook and
bundle-size warnings. Independent specification and standards re-review cleared
the candidate. An earlier combined run caught the History remount (81 passed,
1 failed); the final run includes that correction. An independent concurrent
focused run timed out, then passed both selected tests with a 15-second timeout.
Human visual acceptance remains outstanding.

## Weighted Tasks and Subtasks — 2026-11-13

Implemented the coordinated public rename from Operations to Tasks for Activity
planning and execution, with optional one-level Subtasks. Tasks remain inside the
Activity and remain the budget, authorization, validation and reporting unit.
Planning supports exact weights, dates, child allocations and draft-incomplete
totals; submission enforces both 100% weight totals and exact child budget totals.

Assigned Agents can record manual Task progress or binary Subtask completion.
The backend derives Task and Activity progress from approved weights and keeps it
independent from expenditure and closure. Subtask expenditure consolidates once
at Task level. The established amendment, financial freeze, funding, settlement,
reversement and closure workflows remain in force. Existing approved records keep
their history and show weighted progress as unavailable until amended.

Shared exact numeric entry, keyboard-capable French dates and wrapping badges are
available to touched screens. Resource lists touched by this slice sort on stored
creation time and identifier before cursor pagination. Visual acceptance and
production readiness remain separate external gates.

Independent review found and the implementation now covers hierarchy changes at
amendment boundaries. Cancelling restores every approved Task and Subtask field;
approving a child change recomputes the Task's completion, start and consolidated
spending before downstream finance checks can proceed. Amendment detail uses the
public `tasks` shape in active, approved and cancelled states. Subtask execution
appears in audit, execution history and Fiche chronology, and Partner views expose
derived progress while legacy unweighted Activities retain an unavailable value.
The database also binds each Subtask to a Task in the same Activity with one
composite foreign key.
Financial verification replays Subtask audit chains and then consolidates their
facts at Task level. It rejects mismatches in either layer and excludes every
Agent who recorded Task or Subtask execution from reviewing the request.
Funding verification also replays child spending at each approval boundary, so
historical child overspending remains a funding obligation after correction and
child-only execution actors remain excluded from funding review.

### Weighted hierarchy review remediation — 2026-11-16

New Task hierarchies and Subtask reordering are now saved atomically, including
partially completed draft rows. Funding pauses cannot be bypassed with conflicting
completion fields, and Subtasks receive the established correction action.
Rounded Activity progress reaches 100% only when the weighted work is complete.

Annual transfers now preview and review the exact calendar-day shift of every
dated Task and Subtask. The API verifies hierarchy identity, shifted dates and
parent containment; approval persists the reviewed schedule. Migration
`0037_transfer_task_dates` permits only the reviewed hierarchy-date differences
inside immutable transfer snapshots and blocks legacy pending transfers whose
hierarchy dates were never reviewed.

Focused backend and frontend regression checks, schema repeatability, Ruff, mypy
and ESLint passed. The full transfer run's three failures were corrected and each
affected case passed on focused rerun; that earlier run remains recorded as 53
passes and three failures. A broader planning run stopped on historical tests that
assign additional Agents to another Agent's private draft and is not reported as
a full-suite pass. Production migration, deployment and human visual acceptance
remain outside this implementation evidence.

Final independent review found two further gaps. Activity history now retains and
shows safe changes to Task descriptions, weights, dates and Subtasks, including a
removed Subtask's bounded identity, without copying unchanged child content.
That candidate replaced a cleared Activity amount with the computed Task total.
This historical behavior is superseded by the authoritative editor below. Their
focused regressions and all 49 Activity planning UI tests
passed. The surrounding audit file remains recorded as 10 passes and five stale
current-contract fixture failures rather than a full pass. The same independent
reviewer cleared the corrected candidate with no blocking finding.

A follow-up review on 2026-11-17 identified and corrected six integration gaps:
live Task hierarchy audit input, complete reviewer hierarchy display, legacy
completion preservation in frontend and backend projections, exact-XOF overflow
handling during Subtask consolidation, and stale shared test helpers. The
affected backend run passed 18 PostgreSQL tests. Independent re-review found one
adjacent legacy funding-pause gap: a completed Task with newly approved weights
was compared against stored zero progress during a spending correction. The
guard now uses the effective displayed progress; its workflow regression failed
before the correction and passed afterward, and the full weighted-execution file
passed all four tests. Activity planning passed all 49
frontend tests; the combined planning/execution run passed 86 of 87 before one
unchanged five-second timeout, and that timed-out interaction passed on focused
rerun. Static checks and the production build passed with the existing warnings.
The same independent reviewer cleared the corrected funding-pause behavior with
no additional blocking finding in the focused re-review.

### Authoritative Activity, Task and Subtask editor — 2026-11-18

Activity editing now follows the approved `docs/inspiration/activities/edit`
screens. The Activity keeps a manually entered planned amount and a Répartition
summary; it never derives or defaults that amount from Tasks. Task editing uses
a dedicated three-card page, Subtask editing uses a right-side drawer, and both
removal paths require confirmation. Activity detail shows Task-only rows with
the approved information hierarchy and dates only in its header.

Initial Drafts, amendment Drafts and returned corrections can retain missing
Categories, dates and weights and incomplete allocation totals. A Task or
Subtask still requires a name and positive amount before it can be retained in
the Activity Draft. Submission requires Categories, dates within parent dates,
exact Activity/Task/Subtask amount totals and 100% Task/Subtask weight totals.
Migration `0038_draft_task_categories` permits the nullable Task Category needed
to restore these editable Drafts; submission remains strict.

The editor accepts an optional attachment after saving the Activity. A failed
upload leaves the Draft saved and prevents a requested submission. Category
pagination remains available in the Task editor, and a temporary Category-list
failure disables Category selection and submission while preserving Draft save.

Verification passed 54 Activity-planning tests, two exact-number tests, seven
pure hierarchy tests, Ruff, mypy, ESLint, Prettier, the production build, and two
focused Playwright flows covering responsive Task/Subtask editing and failed
attachment upload. The existing ESLint hook warning and build chunk-size warning
remain. `TEST_DATABASE_URL` was unavailable, so PostgreSQL integration and
migration upgrade/downgrade were not run; Alembic reports
`0038_draft_task_categories` as the single head. Independent review corrections
were applied. A second re-review found that a first-load Category failure still
replaced the initial Activity form; the route now treats Categories as optional
Draft data, shows an inline retry, keeps Draft save available, and blocks only
Category controls and submission. That review also led to stable focus return
from the Task page and localized real-text labels for responsive amount and
weight values. The same independent reviewer cleared these final corrections
with no concrete finding; the unavailable PostgreSQL migration check remains
recorded above.

The three authoritative Activity surfaces then received a second direct visual
pass. Activity detail now follows the approved header, card, Task-row, budget and
bottom-action hierarchy. Activity edit uses the approved two-column proportions,
French attachment field and full-width action row. Task edit is a centered
three-card page, with Category creation inside the selector; its Subtask drawer
uses the approved header, width, field grid and footer. Responsive populated
screens were rendered and inspected at desktop, 918 px reflow and 390 px mobile
widths. The focused 58-test frontend run, ESLint, production build and complete
Activity editing Playwright flow pass. The wider planning-reference E2E still
fails its existing calendar inspection focus-return check after reaching that
unrelated interaction.

A subsequent component-standard correction replaced the remaining page-local
card and grid-list imitations with the existing `Panel`, `Button`, exact-number
and responsive table patterns. Exact-number inputs now fill their assigned field
columns, including the two Task budget fields, and status badges remain contained
when the viewport changes. No new UI component was added. The focused 58-test
run, targeted ESLint, rebuilt production bundle and rebuilt responsive Activity
editing Playwright flow pass; fresh captures were inspected against the supplied
references. Independent re-review and the Draft-fiche conflict recorded in the
Activity UX plan remained open at that point. The independent reviewer then
cleared the component-standard and responsive implementation, with the Draft
fiche as the sole blocking product conflict requiring a user decision.

## Activity realization and finance detail alignment, 2026-11-18

The approved Activity detail now has separate **Réalisation** and **Finance**
tabs under one stable header. The header shows programming approval, physical
progress and realization validation without exposing technical revision numbers.
Réalisation combines the compact summary, Task table, collapsed Subtasks and
actionable readiness rows in one card. Finance separates its financial situation,
requests, and administrative closure into three cards and keeps the Task expense
breakdown collapsed.

Current business behavior is unchanged: only assigned Agents edit execution;
financial requests retain their existing completion gates; final décaissement or
approved zero spending establishes validated realization; reversement evidence
remains optional and recorded external amounts remain immutable. The implementation
uses the existing execution endpoints and preserves the shared REST-client
contract.

Independent review corrections separate physical and validation wording, derive
the authorized amount only from approved décaissement data, group readiness
requirements while respecting read-only access, add the compact financial-request
list, hide blocked closure actions and surface execution-summary failure with
retry. Financial request rows now expose their latest decision with actor/date;
submission and review use the shared right-side modal instead of duplicate inline
accordions. The finance decision API adds the reviewer's display name to its
existing decision projection, and zero-spending rows open their selected
declaration rather than whichever declaration is current. The focused
execution/Planning run passes 94 tests. Targeted formatting
and lint, the production build, and the canonical Activity Playwright flow pass;
the build retains its known chunk-size warning. Browser coverage includes desktop
and mobile Réalisation/Finance, Subtask disclosure, read-only readiness, all three
authorization display states, financial request columns and header read failure.

The final visual correction replaces the remaining Finance administration
accordions with flat rows and moves their forms into the shared right-side modal.
The financial summary now shows partial spending and realization submission
state directly, and hides the variance row when there is no discrepancy; the
obsolete realization footer action is
removed. Réalisation uses the approved **Développer** disclosure and explicit
**Non renseigné** value. Programmation retains the approved two-column cards while
removing the technical revision number from its budget label. Technical financial
request identifiers remain hidden and no API field was added, following the
user's explicit decision. The closure row now opens its exact financial blockers
after physical work is complete. Closed Activities show the authorized closer
display name and provide a direct link to the existing History tab; this uses one
additive execution-response display field and does not expose the internal closer
identifier. Pending financial blockers name the responsible role and open the
existing request directly. The final affected frontend run passes 97 tests,
ESLint, Prettier, the production build and the canonical Activity browser flow.
Backend Ruff and mypy pass; the focused PostgreSQL closure test remains
unavailable because `TEST_DATABASE_URL` is not configured.

### Activity modal and final visual standard pass — 2026-11-19

Activity dialogs now inherit one shared field, label and footer treatment from
`BusinessModal`, including forms nested in Activity execution and financial
content. The Task/Subtask execution modal is the approved compact centered form;
variance observations and audit correction reasons appear only when required by
the existing integrity rules. Activity and Task progress display human-readable
percentages without stored decimal padding, and the execution sidebar matches the
approved MJL mark and **Relances** wording.

Financial request creation uses the centered dialog and request review uses the
approved right drawer. Décaissement review shows the available Activity context,
request totals and decisions without exposing revision numbers or inventing the
hidden request reference. External virement, reversement and closure retain their
current workflow rules and use centered confirmation dialogs.

The focused frontend evidence is 41 passing Execution tests, 57 passing Planning
tests, 12 passing app tests, targeted ESLint, a production build and the passing
canonical Activity Playwright flow with desktop/mobile captures. The production
build retains its known bundle-size warning. Independent review and human visual
acceptance are still separate gates.

Independent review of that candidate identified two state defects and three
remaining visual inconsistencies, all corrected in the same slice. Observation-
only Task/Subtask corrections now include the required audit reason; successful
financial returns close the return form; percentages omit API padding; request
drawers use a fixed shell with scrolling content; and confirmation checkboxes use
the established inline layout. All 45 Execution tests and the focused Planning
rerun pass, as do targeted ESLint, `git diff --check`, the production build and
the canonical Activity Playwright flow. In the combined affected run, 112 of 113
tests passed and the single timed-out Planning submission test passed immediately
when rerun alone. Equivalent numeric formatting and surrounding observation
whitespace are normalized before correction detection, matching the API and
avoiding false correction reasons.

The Activity UI correction on 2026-11-19 keeps saved Task and budget facts visible
in incomplete Draft details, aligns all compact planning tables and percentage
display, fixes 390 px navigation containment, and centralizes drawers, business
field styles and file selection. Required submission fields are visibly marked
without changing incomplete Draft persistence. The Activity fiche remains
approved-only, and the shared REST client/API contract is unchanged.

The final findings correction removes the repeated realization status from
Finance, pins shared drawer actions to the viewport bottom, stacks the mobile
closure action, and preserves the standard budget card for incomplete Drafts.
Activity document and reversement uploads use the shared file selector; link
actions, Finance cards, percentage totals and revision dates use their
centralized UI and formatting seams. The combined affected unit run passes 102
of 104 tests, and its two order-sensitive reversement scenarios pass on their
immediate focused rerun. Targeted ESLint and `git diff --check` pass, the
production build passes with the known chunk warning, and the five relevant
Activity Playwright journeys pass. The broader Planning Playwright invocation
also ran four older scenarios that still fail on unrelated dialog/focus
expectations; those failures are kept separate from the passing affected
evidence.

## Activity administrative reminder and PTA identity, 2026-11-19

Eligible approved Activities now show a read-only **Relance administrative**
card in Programming with their approved deadline, current assigned Agents and
the reminder date 21 days before the deadline. The card follows the existing
reminder window and excludes past-end, closed, withdrawn and unapproved
Activities. It does not add a delivery claim, notification mutation or new API
contract.

The PTA detail heading identifies the saved PTA, with the Project, PTA year and
description retained as supporting context. Activity detail dates appear only in
the identity header, and technical revision numbers remain hidden. The explicitly
excluded Réalisation filters/status presentation, PTA workflow labels and sidebar
brand were not changed.

Verification passed 73 focused frontend tests, targeted ESLint and Prettier, and
the production build with its existing large-chunk warning. Independent review
found no implementation defect; its documentation finding was corrected here and
in the existing Activity UX plan.

### Shared frontend composition — 2026-11-19

Planning, Execution, Audit, Notifications, Access, Partner and shared filters use
one pagination component. Activity breadcrumbs use Router links through one shared
composition. Access field styling, Authentication loading actions/password rules,
ordinary Access/Partner actions, protected file previews/downloads and the common
financial-request detail sections now use their shared owners. No API, permission,
amount, validation or financial decision rule changed.

### Financial request findings correction — 2026-11-20

The Agent-entered amount is required at both financial request APIs. Internal and
Partner fiches display each virement's own amount, and attachment persistence no
longer performs synchronous database work on the async event loop. Successive
partial décaissements and virements accumulate without double counting. Database
triggers and closure checks require cumulative approved décaissements, approved
virements and exact latest confirmations to reconcile before reversement or
closure. The fail-closed schema fingerprint and downgrade guards cover the new
schema. A partial décaissement no longer marks the internal fiche as validated,
and a closed Partner finance summary consolidates every approved virement's
latest exact confirmation and reports the latest transfer date.

Final focused evidence: 64 frontend unit tests, two Playwright financial-return
journeys, 14 disposable-PostgreSQL financial/migration scenarios, and three
focused internal/Partner projection regressions passed.
Backend Ruff, focused mypy, Python compilation, targeted ESLint/Prettier, the
production build and `git diff --check` passed. A broader run also encountered an
existing weighted-Task fixture whose approved weights are incomplete; its
execution-recording failure is separate from this correction and is not counted
as passing evidence.

### Prop-driven financial review modals — 2026-11-21

Décaissement and virement review dialogs now open immediately from their current
Activity Finance table row without navigation, URL selection IDs or a redundant
décaissement detail request. The latest TanStack Query record is passed through
props to the shared centered modal. Background refreshes update displayed server
facts while an entered observation and its starting version remain stable.
Successful decisions and cancellations refresh the Activity data and close the
dialog; failed submissions keep it open with the entered value and display the
server error inside the dialog.

Financial-request search parameters are unsupported and stripped; notifications
link only to the Activity and its section fragment. The existing virement detail query remains for settlement
confirmation, reversement and history data. Creation, funding, zero-spending and
other modal-ownership follow-ups remain unchanged and require their own authorized
slice. No backend, schema, API payload, permission or financial approval rule
changed.

Focused evidence: the 119-test affected frontend run passed, followed by a
49-test Execution rerun after the review-error correction. Targeted ESLint and
the production build passed. The focused Playwright PTA-3B through PTA-3E
administrative-settlement journey passed; its populated 1440×900 and 390×844
captures were inspected against the approved centered modal. The independent
review found the initially hidden server error and missing visual evidence; both
were corrected, and the same reviewer cleared the final candidate with no
blocking findings.

The follow-up correction also keeps Finance pagination on the Activity route,
uses each Query's own loading state, preserves zero-spending and Access edit
versions across background refreshes, and displays Task/Subtask failures inside
their open modal. Its final evidence is 71/71 focused tests, passing targeted
Prettier and ESLint, a clean `git diff --check`, and a successful production build
with only the existing chunk-size warning. Both independent reviewers cleared the
candidate. The browser journey was not rerun at the user's direction.

### Activity document withdrawal modal — 2026-11-21

The Activity Documents tab no longer keeps a selected document snapshot in page
state to open withdrawal. Each eligible row opens the shared modal from its
current Query data, while the reason, optional corrected document and replacement
pagination remain temporary form input. Background document refreshes update the
open modal without clearing those values. Failed requests stay open with safe
feedback. Success refreshes the documents, Activity history and audit data;
conflict reconciliation refreshes the document list. Focus recovers to the
Documents heading when the action disappears.

The API payload, document permissions, immutable withdrawal evidence and audit
workflow are unchanged. The full Planning unit file passed 70/70 tests; targeted
ESLint and Prettier passed, `git diff --check` was clean, and the production build
passed with the existing chunk-size warning. The independent review's success
coverage and status-wording findings were corrected, and the same reviewer
cleared the candidate. No browser journey was run.

### Correction notice presentation — 2026-11-23

Programming, Réalisation and financial request corrections use the shared amber
notice from the approved references. This is a frontend-only presentation change;
the existing APIs and correction workflows remain unchanged.

### Clean browser navigation — 2026-11-23

Activity detail sections now use stable fragments. Activities that have never
received definitive approval use `/planning/activities/:id`; Activities with an
approved baseline use `/execution/activities/:id`, including while an amendment
or correction is prepared. Both lists may show an approved Activity, but every
detail link resolves to the Execution URL. The detail loader corrects a manually
entered route from the latest Activity data, and the sidebar follows the canonical
pathname. Applied filters and calendar selection remain shareable; list
pagination stays local and no longer adds opaque cursors or page numbers to
browser URLs. Login remembers only the last visible top-level module.
Planning rows, notifications, global History and newly generated Activity emails
carry the same approved-baseline fact, so their links use the canonical module
directly. Previously delivered generic Activity email links are intentionally not
supported.
Copied project, PTA and Partner Activity selections resolve even when their row is
outside the currently visible list page. The change does not alter API pagination,
permissions or business workflows.
Resolver failures now render retryable errors instead of empty screens, and
Partner resolver denials follow the existing protected-data cleanup. Browser
coverage uses the canonical fragments and local-pagination contract.
