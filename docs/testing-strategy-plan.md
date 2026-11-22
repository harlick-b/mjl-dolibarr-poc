# Testing strategy and adoption plan

Agreed 2026-11-19. Status: durable rules adopted in the engineering guide and the
Activity-submission UI and connected slices are implemented. Scope remains test
strategy and the smallest complete pilot, including its disposable CI setup;
visual implementation, business behavior and API contracts are excluded. Existing
engineering/security gates remain in force.

## Objective and basis

A test should tell us whether a person can complete an approved task, or whether
the application prevents a concrete harmful outcome. For example: an Agent can
submit a complete Activity, reviewers see the correct revision, and the Agent
cannot approve their own contribution. A passing assertion about a request alone
does not establish that the screen refreshed or the server saved the change.

Use [business rules](business-rules.md) as the behavioral authority, the
[engineering guide](engineering.md#transactions-migrations-and-verification) for
verification, and [security controls](security.md#normalized-controls) for
protection. Tests are evidence, not product decisions or user acceptance.

Research supports the following approach; its allocation to MJL is our proposal:

| Guidance                                                                                                                                                                                              | Application to MJL                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Testing Library principles](https://testing-library.com/docs/guiding-principles/) favor testing the software as people use it.                                                                       | Exercise forms, navigation and visible results with real components/providers.                                                                      |
| [Playwright best practices](https://playwright.dev/docs/best-practices) recommend observable behavior, isolation, resilient locators and waiting for conditions.                                      | Keep browser scenarios independent; use roles/labels and observable completion instead of CSS structure or arbitrary delays.                        |
| [Google's change-detector warning](https://testing.googleblog.com/2015/01/testing-on-toilet-change-detector-tests.html) explains why copying implementation facts into tests gives little protection. | Derive expected outcomes from approved rules; avoid source-text checks and internal call sequences that merely mirror code.                         |
| [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html) describes complementary test scopes and avoiding duplication.                                             | Choose the smallest scope that detects the real failure, retaining a few connected browser journeys. No fixed percentage of unit/API/browser tests. |
| [pytest fixture guidance](https://docs.pytest.org/en/stable/how-to/fixtures.html) addresses reusable setup and safe cleanup.                                                                          | Preserve disposable PostgreSQL and owned teardown; share setup only when independence survives.                                                     |
| [Google's coverage guidance](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html) treats coverage as a gap indicator, not proof of correctness.                                  | Track protected outcomes and missed defects; do not set a test-count or blanket coverage quota.                                                     |

## Rules for keeping or adding a test

1. **Name the current outcome and failure.** Explain what would go wrong for a
   user, their data, access or operational integrity without this check. A bug
   fix can justify a regression test when it protects a continuing rule; a test
   whose only purpose is to approve the current patch cannot.
2. **Keep requirements current.** When an approved decision changes, replace or
   retire the obsolete expectation. Preserve historical evidence in Git/docs,
   not in contradictory assertions. Historical data/migration tests remain
   valuable when they protect compatibility or prevent data loss today.
3. **Do not test editorial wording changes.** No standalone tests for renamed
   headings, explanatory sentences or punctuation. Text can still identify a
   control or verify a business result: exact F CFA amounts, a saved correction
   reason, a meaningful error, accessible names or forbidden information in a
   Partner export. Assert the necessary fact, not the entire paragraph. A label
   used to click a button does not make the surrounding workflow a wording test.
4. **Cover one coherent goal.** A scenario includes the actions and outcomes
   needed to complete that goal, with several useful assertions when necessary.
   Do not split every click into a test, or combine all account creation,
   planning, execution and settlement into one fragile scenario. Different
   rejection reasons or concurrent races can deserve independent tests.
5. **Every assertion must distinguish correct from incorrect behavior.** Ask:
   “Which plausible defect would make this fail?” Expected values come from
   independently understood examples, never the same production calculation.
   `expect(true).toBe(true)` and comparing a fixture with itself fail this test.
   Checking a boolean produced by the application is valid. Negative checks
   must reach the action under test and wait for its completion; an empty call
   list or an empty `.every(...)` result alone proves little.
6. **Reuse before expanding.** Improve an existing scenario before adding a
   duplicate. Shared helpers may arrange valid prerequisites, but must not hide
   the action/assertion being tested. Test bodies never depend on another test
   having run first. Split files by coherent responsibility, not line count.

## What belongs at each level

| Level and existing tools                                           | What it should prove                                                                                                                                        | Boundary                                                                                                                                   |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Focused rule/helper tests: pytest or Vitest                        | Exact XOF/percentage calculations, missing versus zero, date boundaries, trusted URL handling and other meaningful reusable rules.                          | Keep these even when short; a whole browser journey is unnecessary for every numeric boundary.                                             |
| API workflow tests: pytest, real FastAPI and disposable PostgreSQL | Allowed transitions through real routes; persisted results; immutable approvals; role/resource/contributor isolation; atomic audit and replay/stale denial. | Real database/transaction behavior is mandatory where relevant; SQLite or mocked persistence cannot prove it.                              |
| Frontend feature tests: Vitest, Testing Library, Router/Query      | User input, confirmation, outgoing contract, visible result after refresh, and preservation/recovery after relevant failures.                               | API responses may be controlled. These tests establish UI behavior, not backend authorization or persistence.                              |
| Browser UI tests: Playwright with controlled API responses         | Real-browser focus, keyboard use, dialogs, navigation and responsive interaction.                                                                           | Report these as browser UI checks, not proof of the connected application.                                                                 |
| Connected journeys: Playwright plus real API/PostgreSQL            | Selected critical paths work across browser, session/CSRF, transport, server and persisted state.                                                           | Provision isolated actors/data and exercise the target path without intercepting MJL business responses. External email remains synthetic. |

Security and infrastructure checks are useful even without a visible screen:
migrations, safe export encoding, transactional audit, session revocation and
cross-Partner denial protect real user outcomes. Retain focused tests for these.
Different levels may cover the same feature when they detect different failures;
do not repeat its entire permission/validation matrix at every level.

## Repeatable method

For each changed behavior, add a short entry in its existing slice plan:
**rule/risk → valid starting state and actor → action → observable outcome →
test level and existing scenario → checks run**. A few lines are sufficient;
no new form, framework or document per test is required.

1. Read the current rule and adjacent workflow. Identify a successful outcome
   and the relevant denial/recovery boundaries; do not enumerate hypothetical
   combinations. Find existing coverage before designing more.
2. Arrange minimal synthetic prerequisites. Use real transitions when their
   history/eligibility matters; fixtures may prepare unrelated prerequisites.
   Never fabricate an approved revision that bypasses the approval chain being
   tested. Direct SQL is appropriate for deliberately invalid integrity fixtures
   or historical migration fixtures, clearly identified as such.
3. Exercise the actual public boundary. For frontend interaction prefer
   [`userEvent`](https://testing-library.com/docs/user-event/intro/); low-level
   events need a specific harness limitation and browser evidence when that
   limitation affects the behavior. Keep Router/Query and the relevant real
   client path; stub the external boundary rather than business logic.
4. Assert the result. A successful API mutation should establish its important
   response and persisted result through a fresh read, adding database/audit
   inspection where that is the protected rule. A denied mutation should show
   the correct denial and unchanged protected facts where corruption is the
   risk. UI mutations should show the resulting state after completion/refetch,
   not only a called function, request or toast. Transport-specific tests may
   legitimately stop at the transport contract.
5. Challenge the assertion: would it fail if saving did nothing, the wrong
   Activity changed, stale data returned, or a relevant guard disappeared?
   Use this question in review. For new behavioral regressions, demonstrate the
   relevant failure before the fix when feasible. For a pilot rewrite, a bounded
   deliberate defect in a disposable working copy can resolve doubt; always
   restore it. No project-wide mutation-testing rollout is proposed.
6. Run the affected checks, including adjacent consumers of a shared change.
   Record actual commands, candidate commit plus working diff/build, outcomes,
   skips and interruptions. Independent reviewers inspect the requirements,
   tests and evidence; implementers fix findings and return to the same reviewer.

Fixtures must fail on unexpected requests instead of silently returning a
successful empty response. Controlled responses must match current API fields,
types, list envelopes and allowed transitions. Reuse existing fixture seams;
do not introduce a second simulated business engine. Verify critical shapes
against real endpoint tests/OpenAPI and a connected journey where appropriate.
Restore mocks, caches, sessions and timers; use controlled clocks/promises or
barriers for expiry and races. Keep real PostgreSQL for transaction/concurrency
checks. Ordinary tests must not call real Resend or touch shared development data.

## Repository assessment

Source inspection on 2026-11-19 at HEAD
`ea1ff0dfbafcd69d4a7b324736e5fa6f8583f0d7` plus the existing working tree.
This is a targeted sample, not a test-by-test audit or a new runtime result.
Pre-existing frontend edits were observed and are outside this task's edits.

| Evidence                                                                                                                                                                         | Assessment and proposed treatment                                                                                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Disbursement workflow](../backend/tests/execution/test_disbursement.py), `test_agent_submits_and_distinct_reviewers_authorize_disbursement`                                     | Good pattern to preserve: real actions, exact amount, frozen execution, direct Admin denial and distinct review stages.                                                                                                                                          |
| [Financial returns](../backend/tests/execution/test_financial_returns.py), `test_replacements_drive_settlement_and_closure_with_both_returns_in_history`                         | Useful connected API flow: returned requests, new approvals, settlement, closure and retained reasons. A saved reason in a PDF is business evidence, not editorial copy.                                                                                         |
| [Authentication HTTP journey](../backend/tests/auth/test_auth.py), lifecycle and live-identity invalidation tests                                                                | Preserve the real PostgreSQL/API boundary: logout rejects the restored old cookie; role, lifecycle, password and security-version changes invalidate live sessions. These are distinct revocation causes, not browser duplicates.                                |
| [Access coordinator tests](../frontend/src/features/auth/session/access-verification.test.jsx) and [RestClient tests](../frontend/src/shared/api/rest-client.test.js)            | Preserve the lower-level client protections: bounded session recheck, protected-cache purge, request cancellation and obsolete-generation suppression. The browser journey should prove the person-facing result instead of repeating these internal assertions. |
| [Execution browser review](../frontend/e2e/execution/execution.spec.js), `reviewer sees pause, resume and paginated history without mutation controls`                           | Its cross-tab revocation tail was unrelated to the execution-review goal and was never reached on the current screen because that broader fixture already fails earlier. Move revocation to a dedicated current auth journey and record the broader failure.     |
| [Partner portfolio API](../backend/tests/partner_portal/test_partner_portal.py), document and export scope tests                                                                 | Preserve real PostgreSQL denial for guessed foreign Partner resources, drafts, private files and exports. Remove PDF wording expectations that do not protect public facts or redaction.                                                                         |
| [Partner browser journey](../frontend/e2e/partner-portal/partner-portal.spec.js)                                                                                                 | Keep one public-portfolio and protected-download goal. Reject unexpected methods/paths, assert that internal navigation is absent and retain the unique mobile preview-containment check; screenshots and repeated mobile downloads add no behavioral proof.     |
| [Amount/date helpers](../frontend/src/shared/lib/format.test.js)                                                                                                                 | Valuable short tests: unknown versus zero, exact large integers and calendar boundaries. Do not delete them to enforce long flows.                                                                                                                               |
| [Planning submission](../frontend/src/features/planning/pages/planning.test.jsx), `an eligible Agent confirms submission of the current Activity version`                        | Previously checked only the POST/version. The pilot now reuses this scenario to prove the refreshed submitted state and removal of the submit action.                                                                                                            |
| [Planning browser fixtures](../frontend/e2e/planning/planning-design.spec.js), `setup`; [financial-return browser fixtures](../frontend/e2e/execution/financial-returns.spec.js) | Planning still has catch-all interception to review in its visual slice. The financial-return fixture now rejects every unmodeled path or method and follows the current Activity finance route. It remains controlled browser evidence, not backend coverage.   |
| [Planning browser journey](../frontend/e2e/planning/planning.spec.js) and [CI workflow](../.github/workflows/foundation.yml)                                                     | The journey requires specific mailbox/container variables and can skip; the checked-in workflow does not supply those variables. Generic Playwright success does not establish that this journey ran.                                                            |
| [PostgreSQL fixture](../backend/tests/conftest.py), `auth_env`                                                                                                                   | Creates a unique database, migrates it and tears it down. Preserve isolation. Per-test migration cost is visible in the design, but has not been measured here.                                                                                                  |
| [Existing adoption evidence](engineering-standards-adoption-plan.md#step-3--verify-the-committed-baseline) and its Step 4 transport evidence                                     | Records stale recovery/migration expectations, browser fixture failures and an interrupted broad unit run. These are historical unresolved evidence to reconcile, not freshly reproduced failures or a clean baseline.                                           |

No literal tautology is established by this sample. Boolean assertions and
text queries are not grounds for automatic deletion. No runtime or performance
conclusion follows from static inspection.

## Proposed adoption sequence

The method applies project-wide; the inspected sample does not establish
project-wide compliance. Apply it one feature at a time. Ordinary test cleanup
may proceed while connected-journey infrastructure and visual corrections are
unfinished. A missing connected run blocks claims about connected behavior,
not unrelated helper or feature-test improvements. Existing mandatory gates
still apply to each changed scope.

Each implementation slice ends with a separate review-only agent inspecting the
actual diff, surrounding code and final evidence. Accepted findings return to the
implementer, then the same reviewer. Blocking findings/gaps must be resolved
before that slice is called complete.

1. **Agree and consolidate the rules.** Integrate the durable
   method into the engineering guide and record any MJL adaptations in the
   existing standards adoption plan. Keep README as setup authority. Retain
   Vitest/Testing Library, Playwright and pytest/PostgreSQL. Follow staged BE-009
   and FE-011 adoption; no parallel test directory scheme or bulk file moves.
2. **Pilot one planning goal.** Use Activity submission and its existing review
   coverage: valid assigned Agent draft → confirmation/submission → visible
   submitted revision and reviewer access. First map existing API/UI/browser
   checks and classify them as keep, strengthen, combine, retire or gap. Extend
   the request-only UI scenario, use strict current-contract fixtures, retain
   API protections for incomplete planning and contributor/reviewer eligibility,
   and repair/reuse a connected journey for this goal. A goal-specific scenario
   may start with pre-provisioned actors rather than repeating account setup.
   Do not assert that approval closes or executes an Activity.
3. **Make the pilot evidence dependable.** Supply the chosen connected journey's
   disposable environment and teardown explicitly. Its required CI selection
   must fail if prerequisites are missing or the journey is skipped. Separate
   controlled browser checks from connected results in reporting. Reconcile
   known failures affecting this goal against current requirements, preserving
   every still-required protection. Record unrelated failures separately; a
   focused pass does not clear a failed broader gate. Keep all existing mandatory
   CI checks. Do not hide failures with retries, skips or larger timeouts.
4. **Expand by business risk after each bounded review.** The financial
   return/correction, session-revocation and Partner-isolation slices are complete.
   The Partner lifecycle reconciliation is complete: current Agent assignment
   prerequisites, effective withdrawal/transfer setup and the obsolete downgrade
   path blocked by the weighted-task history guard were reconciled. Audit
   each bounded feature against current rules,
   replace obsolete assertions, and remove duplication only after identifying
   where each unique risk remains protected. Retirement is justified by a
   superseded requirement, equivalent stronger coverage, or review establishing
   that the test protects no current requirement or concrete risk (for example,
   a tautology or editorial-only check). Preserve any useful surrounding
   assertions; inconvenience alone is not grounds for deletion.
   Performance work starts by measuring setup/call/teardown on the affected
   group; no speculative fixture-scope change or broad benchmark.

Pilot completion means that each selected rule/risk has a meaningful existing
or improved check, the real goal succeeds through its selected layers, relevant
denial/recovery checks pass, fixtures match the current API, required journeys
actually run, and independent review has no blocking findings. Record timings
only if measured. Evaluate maintenance using irrelevant-copy failures, duplicated
setup and actionable failures; test count and coverage percentage are not success
criteria. Human visual/business acceptance remains separate.

## Whole-project rollout and consolidation decisions

For each bounded feature, record a small map in its existing plan:
**current rule → plausible failure → test and boundary → disposition → surviving
assertions or missing coverage**. Use keep, strengthen, combine, retire or gap.
Review the assertions and fixtures, not just test names. Prioritize exact money,
approval/settlement, access isolation and session revocation, then repeated
maintenance problems. Do not require a new browser journey for every feature:
select connected journeys for critical integration risks and preserve focused
checks at the layer that detects each failure.

Redundancy means the **same current risk, same boundary and equivalent defect
detection**. Similar setup, names or endpoints alone do not establish redundancy.
For consolidation:

- Keep independent goals and denial reasons independently runnable. Share minimal
  prerequisite setup where useful; parameterize equivalent cases with readable
  case names. Parameterization reduces repetition, not the number of scenarios.
- Combine consecutive interactions only when they form one natural goal. Do not
  join tests into a long lifecycle merely to reduce setup or test count.
- Before removing a test, name the surviving test and transfer any unique useful
  assertions. If there is no current requirement or risk to preserve, record that
  reasoning instead. A superseded expectation needs the current requirement as
  evidence; a failing test is not automatically obsolete.
- Run affected surviving scenarios, review their ability to catch the identified
  defect, and obtain independent review. Use a bounded deliberate defect only
  when sensitivity is uncertain. Preserve all required gates and isolated data.
- Measure success by preserved protections, clearer failures and less irrelevant
  maintenance. Claim speed improvements only with measured timings.

Concrete shortlist from the current source review. Completion is recorded per
row; remaining changes are proposals:

| Candidate                                                                                                                                          | Disposition and prerequisite                                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `planning.test.jsx`, “formats an exact integer amount in F CFA”                                                                                    | Completed 2026-11-19: retired the weak substring-only duplicate and moved its ordinary amount example to `shared/lib/format.test.js` with the full expected value.                                                                                                    |
| `notification.test.jsx`, assignment notification sentence                                                                                          | Completed 2026-11-19: checks the activity, assigner, PTA and project independently within the notification while retaining navigation and read/unread behavior; punctuation and sentence structure are no longer test requirements.                                   |
| `test_planning.py`, `test_v14_submission_and_decision_audit_failures_roll_back` and `test_v14_every_workflow_stage_rolls_back_all_failure_classes` | Completed 2026-11-19: the matrix now snapshots contributor count, requires the expected contributor and verifies a successful submission retry plus fresh detail after an audit failure. The narrower duplicate was removed after disposable PostgreSQL verification. |
| `test_planning.py`, `test_v06_v07_returns_allow_unchanged_resubmission_and_require_fresh_prevalidation`                                           | Updated 2026-11-22: the return/correction flow proves unchanged resubmission after both Supervisor and Validator observations, a new immutable revision for each response, fresh two-stage review, final approval and preserved return reasons.                       |
| Contributor immutability and reviewer-created brief fixtures                                                                                       | Completed 2026-11-19: contributor setup now uses a reviewer-created private draft assigned to both Agents, weighted execution records complete progress, and the used 0029 downgrade guard runs at its exact isolated migration seam.                                 |
| `test_recovery.py`, concurrent preparation/completion and notification failure                                                                     | Completed 2026-11-19: retired obsolete routine business-audit row expectations while retaining one usable generation, one reset winner, password/recovery persistence, significant completion evidence and truthful notice delivery outcomes.                         |
| Closure downgrade and PTA-1 operation-tombstone predecessor checks                                                                                 | Completed 2026-11-19: closure evidence now exercises the exact 0014→0015 seam; the shared complete PTA-1 fixture proves 0005→0006 succeeds before four independent tombstone corruptions prove refusal and rollback.                                                  |
| PTA-1 contributor reconstruction and broken-attribution predecessor checks                                                                         | Completed 2026-11-19: one exact 0005 audit chain retains the creator and real editor, excludes a no-op saver and proves missing, duplicated or skipped versions each refuse 0006 without advancing or rewriting the corrupt evidence.                                 |
| `rest-client-adapter.test.js` and `rest-client.test.js`, protected 401 cases                                                                       | Keep both: real Axios/fetch streaming and mocked Axios result handling detect different failures.                                                                                                                                                                     |
| `test_activity_briefs.py` draft completion and `test_planning.py` immutable revision approval                                                      | Keep both: incomplete-draft completion and approval integrity are distinct goals despite sharing submission.                                                                                                                                                          |

The formatter, notification, first API rollback, connected submission and
financial-return slices are complete. Coordinate individual hunks in files touched
by visual work; preserve layout/accessibility checks that protect approved
interaction requirements. Do not classify every visual assertion as useless or
remove ongoing visual work during test cleanup.

## Strategy review and evidence

Research, targeted source assessment and independent strategy review are complete.
The specification reviewer inspected the complete draft and supplied requirement
and source excerpts. The standards reviewer inspected the rules, test levels,
method and adoption sequence against supplied standards. Reviewer sessions lacked
filesystem tools, so both reviews used supplied snapshots rather than fresh disk
reads. Neither reviewer implemented or edited the draft.

The standards review found one correction: retirement criteria initially omitted
tests that never protected a meaningful requirement. Step 4 now permits their
removal after review, preserving useful surrounding assertions. The same reviewer
cleared that correction; the specification reviewer found no blocking issues in
the updated candidate. No blocking strategy findings remain within those scopes.
The strategy is agreed, with no unresolved business question for the pilot.

The first pilot slice strengthens the existing ordinary Activity-submission UI
test. Its fixture now changes the Activity to the server's submitted projection,
the page must perform a fresh detail read, show the submitted state and remove the
submit action. The targeted test was observed passing before the change, then
failed when the outcome assertions were added while the fixture still returned
the Draft, and passed after the fixture represented the confirmed submission.
The test now fails unexpected requests instead of silently returning an empty
success. Existing PostgreSQL API coverage already establishes valid submission,
the immutable first revision, exact snapshot facts, reviewer exclusion, distinct
approval stages, fresh approved detail and workflow audit; this pilot does not
duplicate it or move its files. Ongoing visual edits remain untouched.

The independent implementation review found that known read URLs still accepted
unexpected HTTP methods. The fixture now requires `GET` for session, Activity and
revision reads and `POST` for submission; all other URL/method combinations fail.
The first re-review then found that the session route still used a substring
match; it now requires the exact `/api/v1/auth/session` path as well as `GET`.
The final candidate passed the complete Planning file (57 tests), then the focused
submission check (1 passed, 56 skipped), targeted ESLint, Prettier for the test and
three touched guides, and `git diff --check`. `TEST_DATABASE_URL` is unavailable,
so no fresh backend runtime is claimed; backend behavior did not change. The same
reviewer cleared the exact-path correction after the current candidate passed the
final diff check. CI and a connected browser journey remain later steps in the
agreed sequence.

Documentation verification on 2026-11-19: direct new-file review,
`git status --short`, `git diff --stat`, `git diff --check` and
`git diff --no-index --check /dev/null docs/testing-strategy-plan.md` (no whitespace
diagnostics; exit 1 denotes the new-file difference). A Python 3 reference check
resolved all 13 local file links and checked trailing whitespace. The first
reference-check attempt used unavailable `python`; its `python3` rerun passed.
The initial documentation-only evidence above remains historical. The pilot now
changes this plan, the engineering/adoption guides and one existing frontend test;
its final verification is recorded after the implementation review. Existing
`tasks/lessons.md` verification lessons already cover fixture drift, meaningful
outcomes, focused reruns and honest evidence reporting; no duplicate lesson is
needed. Product capabilities/status are unchanged.

## Follow-up review of reproducibility

The source review covered the current task's test/docs diff at the HEAD recorded
above and directly read the untracked strategy. Two separate review-only agents
inspected actual files, including sampled formatter, notification, transport,
planning and API rollback scenarios. This was not an exhaustive suite audit.

The review found three weaknesses in the initial UI pilot: the eligible Agent
was absent from `agent_ids`, the read counter included pre-submission reads, and
an unused revision-list handler returned an abbreviated mutation-result shape.
The corrected fixture assigns the session Agent, counts only detail reads after
submission, uses exact expected paths/methods and removes the unused handler.
Visible submitted state and removal of the submit action remain the primary
outcomes. No application code or existing test scenario was removed.

Earlier run counts and snapshot reviews above are historical. Final follow-up
runtime check: from `frontend`, `npm run test:unit --
src/features/planning/pages/planning.test.jsx -t 'an eligible Agent confirms
submission'` passed 1 test with 56 excluded by the name filter (5.37 seconds).
`npx eslint src/features/planning/pages/planning.test.jsx` passed. This is a focused
rerun of the changed scenario, not a fresh pass of all 57 tests. No shared fixture
or application code changed. Prettier, diff whitespace, direct new-file and local
reference checks cover the three touched guides; independent reviewers inspect
this final candidate after those checks. Existing fixture-drift lessons already
cover the correction, so no duplicate entry is added to `tasks/lessons.md`.
The connected pilot was completed in the later evidence below. Project-wide
adoption remains incomplete; this review did not claim whole-project compliance.

The first consolidation slice completed the formatter candidate on 2026-11-19.
The Planning page's substring-only XOF check was removed; its ordinary amount is
now asserted as the complete `1 250 000 F CFA` result beside the shared exact,
missing, zero and invalid formatter cases. From `frontend`, `npm run test:unit --
src/shared/lib/format.test.js src/features/planning/pages/planning.test.jsx` passed
both files and all 59 remaining tests in 26.60 seconds. Targeted ESLint passed.
Prettier and `git diff --check` covered the final candidate, and the independent
reviewer cleared it. No application behavior changed; the concurrent visual edits
in the Planning test remain outside this cleanup.

The second consolidation slice completed the notification candidate on
2026-11-19. The assignment scenario now scopes its assertions to the rendered
notification and checks the activity, reference, assigner, PTA and project as
independent facts. It retains the unread badge, navigation, PATCH contract and
visible removal after the read flow without requiring one exact sentence. The
first focused run exposed that a removed duplicate text query had also supplied
the page-load wait; awaiting the notification item now expresses that condition
directly. The rerun of `npm run test:unit --
src/features/notifications/notification.test.jsx` passed all 3 tests in 7.39
seconds. Targeted ESLint and Prettier passed. Final whitespace and independent
review passed on the same candidate with no findings. Existing lessons already
require awaiting the condition under test, so no duplicate lesson is added.

The third consolidation slice completed the first API candidate on 2026-11-19.
The existing rollback matrix still exercises correction, submission,
prevalidation, Supervisor return, approval and Validator return against audit,
constraint and commit failures. Its before/after snapshot now includes the
Activity contributor count and asserts the expected contributor. The
submission/audit case also retries successfully and confirms the submitted
revision through a fresh API detail read. Those protections allowed removal of
the narrower audit-only test without losing its unique assertions.

Verification used an isolated Compose project with its own PostgreSQL volume and
`mjl_test_` base database. Before consolidation, both tests passed 19 cases with
96 deselected in 153.66 seconds. On the final formatted candidate, `pytest -q
tests/planning/test_planning.py -k
"test_v14_every_workflow_stage_rolls_back_all_failure_classes"` passed all 18
matrix cases with 96 deselected in 90.12 seconds. Each case created, migrated and
dropped its disposable database. Targeted Ruff check and format check passed;
`git diff --check` passed. Independent specification and standards reviews found
no remaining issue. The isolated containers, network and PostgreSQL volume were
removed after verification. The known Starlette/httpx deprecation warning remains
unrelated to this consolidation.

The Activity approval/correction scenario was updated on 2026-11-22 for the
clarified product rule. It proves that an unchanged valid Activity can be
resubmitted after both Supervisor and Validator returns, each response creates a
new immutable revision, and the Validator still cannot approve before fresh
Supervisor prevalidation. It continues through distinct final approval, reads the
Activity again and preserves both earlier return reasons in revision evidence.
The separate no-op amendment guard remains in place until a returned review exists.

The initial baseline selection passed the two core review scenarios but had three
adjacent failures before their intended assertions: assignment administration on
a private Agent draft, the obsolete downgrade message blocked earlier by weighted
Task history, and a brief fixture without current Task weights. Those broader
fixture issues were not changed or reported as passing. The strengthened flow
passed alone in 8.53 seconds. A final focused run of initial approval, the corrected
return flow, approval/return serialization and duplicate-evidence protection passed
all 4 tests in 24.92 seconds on the exact final candidate and disposable PostgreSQL.
A larger selected command
closed before returning its pytest summary and is explicitly not evidence. Ruff,
format and whitespace checks cover the final candidate. No application behavior,
API contract or schema changed.

The contributor/reviewer fixture reconciliation completed on 2026-11-19. The
contributor-immutability scenario no longer asks a reviewer to reassign an
Agent-created private draft that the reviewer cannot see. A Supervisor now creates
the brief with both Agents; the second Agent completes and submits it, then remains
barred from review after a role change because the content contribution is
persisted. The direct immutability checks now select that exact content-contributor
row rather than an arbitrary creation-provenance row.

The reviewer-creator scenario now records the required 100% Task progress before
financial submission while retaining both creator roles and the distinct rule that
creation permits planning review but never financial self-review. Its positive
decision-observation downgrade check moved out of this long business flow. A new
isolated database upgrades exactly from revision 0028 to 0029, inserts a positive
observation and proves that downgrade refuses to discard it while leaving revision
0029 and the observation intact. The existing unused round trip remains separate.
All 5 focused cases passed in 28.04 seconds on disposable PostgreSQL. Ruff, format
and whitespace checks passed; no application behavior, API contract or schema
changed. Existing migration-seam and private-draft rules already cover the durable
lessons, so no duplicate lesson was added.

The connected Activity-submission slice completed on 2026-11-19. A dedicated
Playwright journey now provisions disposable synthetic actors and planning data,
then proves that an assigned Agent can submit through the real UI and loses the
submit action. A Supervisor sees the submitted state, exact 300,000 F CFA amount
and prevalidation action; the same authenticated browser session reads the fresh
Activity and immutable revision 1 snapshot from the real API. This stays one
submission-for-review goal and does not absorb correction, approval, amendment,
transfer or withdrawal flows from the older broad planning lifecycle.

The CI Compose override mounts a generated synthetic policy bound to the exact
`mjl_test_foundation` database. CI migrates that disposable database, selects the
connected journey explicitly, and sets `MJL_REQUIRE_CONNECTED_PLANNING=1`, so a
missing mailbox, container or database fails rather than skips. The remaining
browser tests run separately to keep controlled-browser reporting distinct. The
local candidate used isolated port 4174 while visual browser work continued on 4173. After review added an exact read-only environment preflight, the real
FastAPI/PostgreSQL journey passed 1 test in 52.8 seconds. Negative checks rejected
missing prerequisites, a mismatched database before provisioning and an invalid
preview port. The actual UID-10001 backend image could not read a CI-shaped 0600
bind mount and did read the corrected disposable 0644 policy. The build passed
with the existing chunk-size warning. The disposable containers, network and
PostgreSQL volume were removed after final checks.

During the run, the in-progress visual branch's History tab displayed only the
creation event because its current timeline prop does not consume the supplied
revision data. That independent visual mismatch was not changed here. The pilot
therefore proves reviewer UI access and reads revision detail through the same
real authenticated browser session; it does not claim the History presentation
is cleared. Review that presentation with the visual work before using it as the
surviving UI assertion for revision history.

The financial return/correction slice completed on 2026-11-19 without removing
backend coverage. The existing PostgreSQL API journey remains the connected proof
for both returned authorizations, fresh Supervisor and Validator decisions, exact
external confirmation, settlement, closure and both retained reasons in the Fiche.
Its focused disposable-database rerun passed 1 test in 10.35 seconds.

The controlled Playwright scenario now uses the current Activity finance route and
one coherent person-facing goal for both request types: open the returned request,
see its reason and exact 100,000 F CFA amount, submit a fresh request with the
correct immutable basis, and retain both the fresh and returned rows. All expected
session, notification, Activity, execution and financial collection/detail calls
have exact path and method handlers; an unmodeled API request fails the test. The
fixture uses current list and mutation response shapes, one completed Task, exact
string percentages, the correct realization/closure state for each request type
and the approved disbursement source required by virement. After fresh submission,
the flow reopens the retained return and sees its reason again.

The obsolete legacy-route and historical-cursor setup was removed. The page-wide
mobile overflow assertion was also removed from this financial behavior test
because it belongs to the separate visual work and was already failing in that
in-progress screen. `activity-detail.spec.js` still checks containment of the base
finance screen at 390 px; it does not clear the returned-request modal at the old
375 px viewport. The final focused browser run passed both cases in 6.6 seconds;
targeted ESLint, Prettier and the production build passed, with the existing
chunk-size warning.

Independent review first found impossible synthetic states and incomplete current
response contracts. The corrected fixture separates list and mutation outputs,
keeps Activity and execution versions synchronized, orders the approved source
decisions chronologically and represents the required approved disbursement. The
same specification and standards reviewers cleared the final candidate. The
existing fixture-contract lesson already covers this correction, so no duplicate
lesson was added.

The session-revocation slice completed on 2026-11-19 without changing application
or server behavior. Real PostgreSQL/API coverage remains authoritative for logout,
restored-cookie rejection, role change, deactivation, password change and security
version invalidation. Its focused disposable-database run passed all 6 selected
cases in 11.37 seconds. The existing access-coordinator and RestClient files passed
all 39 tests in 3.95 seconds, covering bounded revalidation, protected-state purge,
request abort and obsolete-generation handling at their owning boundary.

A dedicated controlled Playwright journey now proves the visible cross-tab outcome:
a Supervisor first sees protected notification data and the current account; after
another tab announces an authentication change, the client immediately removes the
old business data and workspace while the server recheck is deliberately held. It
then performs the contracted `401` and anonymous session checks and presents a fresh
login. Every expected request has an exact path and method; unexpected API calls
fail. The small revocation tail was removed from the unrelated execution-review
scenario. Its baseline focused run failed before reaching that tail because the
current execution screen no longer satisfies the older fixture; that independent
broader failure remains unresolved and is not reported as passing. The corrected
dedicated browser run passed 1 test in 2.8 seconds; targeted ESLint and Prettier
passed. Existing tests already state the coherent-goal and fixture-contract lessons,
so no duplicate lesson was added. The same independent specification and standards
reviewers cleared the corrected candidate.

The Partner-isolation slice completed on 2026-11-19. The existing real
PostgreSQL/API flow remains the authority for permanent Partner binding, public
approved projections and denial of guessed foreign Project, PTA, Activity, Fiche,
document and export resources. Two obsolete PDF text expectations were removed:
one asserted an old title, while the other contradicted the current sanitized
Fiche's approved supporting-document section. The surviving assertions still
require the correct Activity and exclude candidate content, internal history,
identities and email data.

The shared Partner client fixture now gives independent synthetic identities
distinct client addresses, so the real IP limiter does not combine unrelated
actors and preempt the scope assertions. The focused portfolio, shared-document,
foreign-document and export/audit flows passed 4 tests in 48.19 seconds on
disposable PostgreSQL. That run exposed and corrected a response-contract defect:
the document list used `uploaded_at` for opaque cursor ordering but also leaked it
into the public row before strict serialization. The route now returns only the
approved identifier, name, media type and size while retaining the cursor field
internally.

The controlled Partner browser journey now uses exact request methods and paths,
fails on every unmodeled API request, proves the public portfolio and protected
CSV/PDF/document downloads, and confirms internal Users, Planning and History
navigation is absent. Repeated mobile download behavior and screenshots were
removed while the unique mobile preview-containment assertion remains. The initial
tightened browser run passed 1 test in 8.6 seconds; the final review-corrected run
is recorded below. The four focused frontend files retained 28 passing tests in
14.59 seconds.

The first post-fix broad Partner API run passed 14 of 21 tests in 126.38 seconds.
The follow-up lifecycle reconciliation now assigns both Agents used by withdrawal
and transfer setup, uses the Validator for evidence administration after closure,
and reads CSV facts by their public column names instead of stale offsets. Exact
dates and finance values remain asserted through the JSON/CSV contracts and at the
separate Fiche boundary using its current French date presentation. Editorial-only
document titles were retired while the transfer decision event remains protected.
The historical migration round trip from current head was replaced because the
current weighted-task migration deliberately refuses that lossy downgrade. A
dedicated disposable database now starts at revision 0021, upgrades to 0022 and
proves both private defaults and refusal to discard used sharing history. The
separate lifecycle test still exercises sharing and unsharing after closure and
fails runtime environment verification when the document-sharing schema constraint
is absent.

The six corrected scenarios first passed 5 of 6 in 49.94 seconds, exposing one
stale PDF date-format assertion. The complete Partner API group then passed all 21
tests in 130.82 seconds. Independent review required the useful Fiche boundary to
retain its transferred period, transfer decision and corrected reversement date;
those assertions now use the current rendered format. Ruff and format checks passed
for the three touched Partner test files. The three independent-review corrections
passed together in 20.65 seconds; the final complete Partner API group, now including
the dedicated migration seam, passed all 22 tests in 136.96 seconds on disposable
PostgreSQL. No application behavior, API contract or schema changed in this
lifecycle reconciliation.

Independent standards review restored the unique mobile preview-containment check,
broadened strict interception to every `/api/` path and aligned the controlled
Activity/Task fixture with the current required projection. The corrected browser
journey passed 1 test in 5.0 seconds. The same independent specification and
standards reviewers cleared the corrected candidate.

The recovery reconciliation completed on 2026-11-19. Three recorded failures were
reproduced alongside the passing notification-recording parameterization: routine
`recovery_prepare` and `recovery_notification` events no longer create business
audit rows under the current security boundary. The concurrency scenarios now
prove one delivered recovery record and one emailed proof, one successful reset
and one consumed proof, one significant `recovery_complete` record and one reset
notice. Notification failure checks now observe whether a notice was actually
sent while proving that mail or recording failure cannot reverse the password
change. After independent review added public inspection of the exact emailed
selector and verifier, the final four parameterizations passed in 19.73 seconds
on disposable PostgreSQL. No application behavior, API contract or schema changed,
and the existing security-boundary lessons already cover this fixture drift.

The historical migration reconciliation completed on 2026-11-19. The five
recorded failures were first reproduced in 33.22 seconds: newer weighted-Task
history correctly stopped downgrade before the older protections under test. The
closure case now creates a dedicated database at revision 0015, inserts synthetic
`activity.closed` evidence and proves that downgrade to 0014 is refused while both
the revision and evidence remain. The PTA-1 cases now build one complete historical
removal chain directly at revision 0005. A positive control upgrades it to 0006 and
reconstructs the contributor; four parameterizations separately corrupt the
removed Task's type, name, allocation or position, then prove the 0006 upgrade
refuses the incomplete chain and leaves revision 0005 plus the corruption intact.
All 6 exact-seam cases passed in 7.43 seconds on disposable PostgreSQL. After
independent review moved migration setup under guaranteed teardown and added the
test-database prefix guard, the same final selection passed in 6.31 seconds. No
application behavior, API contract or schema changed; existing migration-seam
lessons already cover this correction.

The adjacent contributor and attribution follow-up completed on 2026-11-19. Its
baseline reproduced all 4 failures in 30.34 seconds: contributor reconstruction
stopped at a stale private-Draft assignment, while missing, duplicated and skipped
audit-version cases stopped at weighted-Task history during a current-head
downgrade. The shared revision-0005 fixture now contains a real edit, reversion,
no-op save and Task removal. Upgrade to 0006 reconstructs exactly the creator and
real editor; the no-op saver is excluded. Each audit corruption refuses the
upgrade, leaves revision 0005 in place and preserves the exact corrupt version
sequence. The four repaired cases passed in 4.57 seconds; all eight contributor,
attribution and tombstone consumers initially passed together in 5.20 seconds.
Independent review required valid active assignments for every historical editor
and removed one redundant exclusion assertion; the corrected final eight-case
selection passed in 5.74 seconds. The stronger contributor success case subsumes
the former tombstone-only clean control, which was removed. No application
behavior, API contract or schema changed.

The first stabilization checkpoint closed the financial-summary PostgreSQL gap
on 2026-11-19. The two reviewer-return variants of
`test_return_and_direct_fresh_request_keep_disbursement_frozen` passed in 18.04
seconds on an isolated disposable database. Each proves through the real API and
PostgreSQL that execution remains frozen while the Activity detail retains the
authoritative approved décaissement request, its `approved` state and the exact
300,000 XOF amount. The existing Starlette/httpx warning remains. No application,
test or schema code changed in this verification slice; the separate approved
virement-drawer visual gap remains recorded in project status.

The CI-equivalent baseline checkpoint remains incomplete. On an isolated Compose
stack, backend mypy passed 59 source files; Ruff found one migration line-length
error and the format gate found three historical migrations outside current
formatting. Two full pytest processes unintentionally overlapped after the first
client session ended without stopping its process. They were interrupted; the
durable run recorded 109 passes, one migration setup timeout and two warnings in
13 minutes at about 7%. Its cause remains unconfirmed. The exact erroring
audit-history case then passed alone in 7.65 seconds after both broad processes
stopped. This is neither a full backend result nor valid single-process timing
evidence.

Frontend lint, format, CSS lint and build passed with the existing Hooks and chunk
warnings. The complete unit run reported 286 passes and seven failures in five
files. The connected Activity-submission journey passed in 21.9 seconds after a
discarded setup-only run exposed a mismatched local lifecycle policy. The broad
controlled-browser run was stopped after five passes, five failures, one skip and
one interrupted test, leaving 116 unrun. Its alternate port caused two URL-only
failures. A focused rerun of the first affected files on their expected port passed
12 and failed five in 1.6 minutes. These results identify real failure clusters;
they do not authorize blanket test removal or establish a complete CI baseline.
No application, API, schema or test code changed in this checkpoint.

### CI baseline evidence ledger — 2026-11-19

The baseline started from Git HEAD
`d53692a3435c8994ef07e6da33d36125e27f8478` plus an unfrozen working tree. The
tree had 55 status entries at final documentation review. No diff hash or frozen
snapshot was captured before the commands ran, and concurrent frontend edits made
after a command are outside that command's evidence. Results therefore bind only
to the disposable image or working tree used by each command; they cannot be
combined into evidence for one immutable candidate.

The common Compose prefix was:

```sh
docker compose --env-file /tmp/mjl-partner-isolation.env -p mjl-ci-baseline \
  -f compose.rebuild.yaml -f .github/compose.connected-tests.yaml
```

The stack and backend checks used that prefix followed by these arguments:

```sh
up -d --build --wait
exec -T backend alembic upgrade head
exec -T backend ruff check .
exec -T backend ruff format --check .
exec -T backend mypy app
exec -T backend sh -lc 'TEST_DATABASE_URL="${DATABASE_URL%/*}/mjl_test_ci_baseline"; export TEST_DATABASE_URL; /app/.venv/bin/pytest -q'
exec -T backend sh -lc 'TEST_DATABASE_URL="${DATABASE_URL%/*}/mjl_test_ci_baseline"; export TEST_DATABASE_URL; /app/.venv/bin/pytest -q tests/audit/test_audit_history.py::test_global_history_allows_only_validator_and_admin'
```

The frontend checks used the same prefix:

```sh
exec -T frontend npm run lint
exec -T frontend npm run format:check
exec -T frontend npm run lint:css
exec -T frontend npm run test:unit
exec -T frontend npm run build
```

The host Playwright commands below ran from `frontend/`. The connected journey
used the corrected disposable policy and isolated database:

```sh
MJL_PLAYWRIGHT_PORT=4183 API_PROXY_TARGET=http://127.0.0.1:8193 \
MJL_CONNECTED_PLANNING_MAILBOX=/tmp/mjl-a1-mail-session-revocation \
MJL_CONNECTED_PLANNING_CONTAINER=mjl-ci-baseline-backend-1 \
MJL_CONNECTED_PLANNING_DATABASE=mjl_test_partner_isolation \
MJL_REQUIRE_CONNECTED_PLANNING=1 \
npm run test:e2e -- e2e/planning/activity-submission.spec.js
```

The incomplete broad browser run and its corrected focused rerun were:

```sh
MJL_PLAYWRIGHT_PORT=4183 API_PROXY_TARGET=http://127.0.0.1:8193 \
npm run test:e2e -- --grep-invert 'assigned Agent submits an Activity for Supervisor review'

API_PROXY_TARGET=http://127.0.0.1:8193 npm run test:e2e -- \
  e2e/app/foundation.spec.js e2e/app/state-handling.spec.js \
  e2e/audit/audit-history.spec.js e2e/auth/admin-presentation.spec.js
```

The backend static-gate follow-up completed on 2026-11-19. Ruff reformatted only
migrations 0009, 0013 and 0036; migration 0013's line-length correction moves a
line break to an existing PostgreSQL whitespace boundary. Revision identifiers,
parent links and migration operations remain unchanged. No test was added for
this formatting-only change.

From `backend/`, `.venv/bin/ruff check .` passed and `.venv/bin/ruff format
--check .` reported all 157 files formatted. An AST comparison against the
captured pre-edit files matched after normalizing whitespace inside string
constants. The exact final image
`sha256:d531d6732a357060e55eac23fdb4ec9216e4bdca49270493f2189d3012e76898`
was built with:

```sh
docker compose --env-file /tmp/mjl-partner-isolation.env -p mjl-static-gates \
  -f compose.rebuild.yaml build backend
```

The image then passed the complete migration chain on a newly created disposable
PostgreSQL volume. `alembic current` reported
`0039_editable_activity_dates (head)` after these commands:

```sh
docker compose --env-file /tmp/mjl-partner-isolation.env -p mjl-static-gates \
  -f compose.rebuild.yaml up -d postgres --wait
docker compose --env-file /tmp/mjl-partner-isolation.env -p mjl-static-gates \
  -f compose.rebuild.yaml run --rm backend alembic upgrade head
docker compose --env-file /tmp/mjl-partner-isolation.env -p mjl-static-gates \
  -f compose.rebuild.yaml run --rm backend alembic current
```

This restores the independent backend static gates without changing application,
API, schema or test behavior. It does not complete the interrupted backend suite.
The next bounded stabilization slice is one frontend failure cluster; the baseline
does not support blanket test removal.

The first frontend cluster follow-up completed on 2026-11-19. Three PTA metadata
flows failed because the saved PTA name had disappeared from the detail heading;
the fourth previously inventoried Planning failure did not reproduce on the fresh
baseline. The detail now uses the saved PTA name as its page heading and retains
Project, year and optional description as context. The existing create,
uncertain-write and submitted-edit flows remain separate because they protect
different persistence outcomes. One adjacent loading assertion was updated to
observe the PTA identity after the Activity list resolves. No test was added,
removed or split.

The initial two-file command reported 75 passes and three failures. After the
correction, `npm run test:unit -- src/features/planning/pages/pta-metadata.test.jsx
src/features/planning/pages/planning.test.jsx` passed all 78 tests in 54.32
seconds from `frontend/` while targeted static checks ran in parallel. The complete
frontend lint passed with the existing Hooks warning;
`npm run format:check` and `npm run build` passed, with the existing chunk-size
warning. The focused `planning-design.spec.js` browser file did not pass: two tests
passed and six failed on the concurrent visual candidate. Four failures concern
existing focus/modal interactions; two navigate to hard-coded port 4173 while the
isolated run used 4193. This result does not block the unit-level metadata repair,
but it remains explicit incomplete browser evidence rather than visual acceptance.

The uncertain-upload cluster follow-up completed on 2026-11-20. The first test
repair exposed an application defect: any successful document read, including an
empty or unchanged page, closed the dialog as though the upload were saved. The
client now records the newest-page identifiers and selected file facts before the
upload. Reconciliation accepts only a new identifier with the same name, size and
uploader. A failed read keeps verification available; a successful read proving
absence enables a deliberate retry without automatically replaying the upload.

The unit flow includes an older identical file and another user's new identical
file so neither can satisfy reconciliation. The saved branch waits for the dialog
transition and verifies both the old and new protected preview actions. The browser
fixture assigns its Agent, follows the existing supporting-documents tab, enumerates
the expected API calls and fails unexpected requests. No test was removed or split;
the API contract and server authorization behavior did not change.

From `frontend/`, the complete two-outcome unit file passed with:

```sh
npm run test:unit -- src/app/state-handling.test.jsx
```

The focused browser journey passed with one upload request, a failed first
reconciliation read and a successful user-triggered reread:

```sh
MJL_PLAYWRIGHT_PORT=4194 npm run test:e2e -- \
  e2e/app/state-handling.spec.js --grep "uncertain upload"
```

Targeted ESLint and Prettier checks passed for the application and both test files.
The final unit file passed both outcomes in 9.26 seconds, the adjacent Activity
document-workspace scenario passed in 16.33 seconds, and the rebuilt focused
Playwright journey passed in 3.4 seconds. The production build passed with its
existing large-chunk warning. An earlier diagnostic complete-browser-file run
passed the upload and Partner-offline journeys, then its separate application-
update journey retained the known timeout waiting for `Modifier`; it remains
two passes and one failure, not final-candidate browser-file evidence. This closes
only the uncertain-upload cluster; it does not turn the earlier incomplete broad
browser run into a pass.

The application-update cluster follow-up completed on 2026-11-20. Its browser
journey still protected the useful state transition, but it stopped before creating
an unsaved edit because the screen now exposes the specific programming-edit action
instead of the removed generic action. The shared Activity fixture also mixed an
obsolete `operations` field with an incomplete detail response. It now follows the
current Activity-detail and Task output contracts, assigns the acting Agent and
uses complete task-category rows with their real advertised actions. The update
journey enumerates exact logout and session requests and rejects every unexpected
API call. No application or API code changed, and no test was added, removed or
split.

The focused journey passed, then the complete state-handling file passed the
uncertain-upload, Partner reconnect and application-update flows together:

```sh
MJL_PLAYWRIGHT_PORT=4195 npm run test:e2e -- \
  e2e/app/state-handling.spec.js --grep "waiting application update"
MJL_PLAYWRIGHT_PORT=4195 npm run test:e2e -- \
  e2e/app/state-handling.spec.js
npm run test:unit -- src/app/pwa-update.test.jsx
```

The focused browser run passed in 5.1 seconds; the final browser file passed all
three tests in 6.6 seconds; and the adjacent unit check passed in 1.47 seconds.
Targeted ESLint, Prettier and whitespace checks passed. This closes the recorded
application-update mismatch without claiming broad browser or production readiness.

The next frontend checkpoint completed on 2026-11-20. The recorded Partner
document mismatch did not reproduce: its dedicated file passed 7 tests and both
Partner feature files passed all 15 together. A fresh default unit run then passed
291 tests and failed nine across Execution, Planning, PTA and Audit. Every affected
scenario passed in focused or complete-file reruns, showing that file competition
was consistent with the failures being scheduling-related rather than nine behavior
defects. The measurements do not distinguish resource pressure from order-dependent
or cross-file interference. No assertion, feature test or timeout was changed.

The runner comparison used the same 34 files and 300 tests on the current four-core
environment. The exact comparison commands and results were:

```sh
# Pre-configuration default: 291 passed, 9 failed; 149.19 seconds.
npm run test:unit

# Limited parallelism: 298 passed, 2 failed; 180.48 seconds.
npm run test:unit -- --maxWorkers=2

# Explicit serial scheduling: 300 passed; 215.85 seconds.
npm run test:unit -- --no-file-parallelism
```

Vitest now sets `fileParallelism: false`, preserving test-file isolation. The
exact configured candidate was the second serial run and passed all 300 tests in
180.05 seconds with:

```sh
npm run test:unit
```

The project did not raise individual timeouts, disable isolation or retire tests to
obtain these passes. The serial setting contains the observed instability; it does
not establish its root cause. If the affected tests recur, inspect their setup and
cross-file interactions before considering restored parallelism, without raising
timeouts. Performance conclusions are limited to the measured environment; CI
timing for this configured candidate remains to be measured.

The next browser checkpoint reconciled the controlled Activity-history mismatch.
The fresh four-file probe passed 12 tests and failed five: two Foundation cases
could not reach their objectives because the configured backend proxy target was
not running, while Activity history and two access/retry scenarios reproduced
their recorded mismatches. The Activity test expected visible milestone metadata
and a details expander even though the accepted compact timeline intentionally
shows actual changes inline and omits metadata.

The corrected journey uses the current `tasks` detail field and an assigned-Agent
fixture. It proves two history events returned by the API remain newest-first, the
actor is visible, the before/after description is presented inline and the event
and exact change remain visible at mobile width. Its route fixture rejects every
API request outside the expected session, Activity, history and unread-notification
reads. Presentation-only screenshots and the stale milestone and expander
assertions were removed; no application assertion was replaced with a tautology or
request-only check. The complete audit-history browser file and its adjacent unit
contract passed with:

```sh
npm run test:e2e -- e2e/audit/audit-history.spec.js
npm run test:unit -- src/features/audit/activity-timeline.test.jsx
```

The final browser file passed 2 tests in 4.9 seconds and the unit file passed its one
contract in 2.32 seconds. Targeted ESLint, Prettier and whitespace checks passed.
The Foundation environment and two access/retry mismatches remain open; this
focused pass does not turn the earlier browser group into a pass.

The next access/retry checkpoint reproduced the two recorded Admin scenarios on
current source. The Partner-role invitation flow passed unchanged. The session
failure flow still expected an on-page retry after a 503, but the accepted design
now clears the unusable local session once, performs a bounded logout and opens a
fresh login without a retry click.

The existing browser journey now holds the first session read long enough to prove
the protected Users table stays hidden, returns a 503, supplies fresh anonymous
contexts for recovery, accepts exactly one logout and proves the usable password
form at `/login`. It rejects wrong methods on the session and logout paths and
establishes that recovery stops after three session reads and one logout request.
The loading screenshot and obsolete retry-heading/button assertions were removed;
no test was added or split, and no application or API code changed.

```sh
npm run test:e2e -- e2e/auth/admin-presentation.spec.js --grep \
  'invitation Select|session service failure'
npm run test:e2e -- e2e/auth/admin-presentation.spec.js
npm run test:unit -- \
  src/features/access/access.test.jsx \
  src/features/auth/session/access-verification.test.jsx
```

The focused browser pair passed 2 tests in 4.0 seconds, the final complete Admin
browser file passed 9 tests in 11.7 seconds and the adjacent unit files passed 44/44
tests in 10.19 seconds. Targeted ESLint, Prettier and whitespace checks passed. The
Foundation live-backend verification remains open; these controlled responses do
not replace server-side session enforcement.

The remaining Foundation checkpoint used the CI-shaped synthetic policy and a
dedicated Compose project with the disposable `mjl_test_foundation_browser`
database. The first backend start rejected a mailbox path outside the required
`/tmp/mjl-a1-mail...` boundary; correcting that setup input produced a healthy,
migrated backend on port 8193. This was an environment correction before test
execution, not product evidence.

Against the real proxy, the first Foundation run passed the installability/offline
and service-worker-update journeys and failed only the public-route journey. That
test still expected the removed anonymous “Espace MJL” home and a health link from
it. The current contract redirects anonymous `/` to login, exposes `/health`
directly and shows the not-found recovery for an unknown anonymous route; its
return link opens login. The corrected journey proves those routes, the real
readiness response, keyboard focus and mobile containment. It removes exact
button/body color assertions because they repeated presentation values rather than
an application outcome.

```sh
npm run build
API_PROXY_TARGET=http://127.0.0.1:8193 npm run test:e2e -- \
  e2e/app/foundation.spec.js
npm run test:unit -- src/app/app.test.jsx src/app/pwa-update.test.jsx
```

The final Foundation browser file passed 3 tests in 8.6 seconds and the adjacent
unit files passed 13/13 tests in 7.66 seconds. ESLint and Prettier passed. The build
passed with its existing large-chunk warning. No test was split or added and no
application or API code changed. After independent re-review cleared the candidate,
the isolated containers, network, database volume and temporary policy/environment
files were removed. This is test evidence rather than production readiness.

The broader controlled-browser checkpoint started on 2026-11-20 and was completed
as a bounded failure audit on 2026-11-21. It used a freshly built frontend and a
disposable synthetic FastAPI/PostgreSQL stack on backend port 8194. Foundation
passed against the real readiness endpoint. The broad command was:

```sh
API_PROXY_TARGET=http://127.0.0.1:8194 npm run test:e2e -- \
  --grep-invert 'assigned Agent submits an Activity for Supervisor review'
```

The process ended without a final Playwright summary after case 105 of 128. The
visible result ledger is 69 passed, 31 failed, five skipped because their separate
connected environments were absent, and 23 unrun. This remains an incomplete,
failing broad run. Failures span authentication/form labels, empty-state and
loading expectations, fixture route drift and Execution presentation. They must be
handled as coherent clusters; this evidence does not support blanket test deletion,
timeout increases or a project-wide assertion rewrite.

The first cluster showed that exact accessible-name locators had accidentally made
required punctuation and password-toggle text part of the authentication contract.
Password and invitation locators now select the stable label prefix while retaining
the full proof-handling, submit, OTP and navigation outcomes. The Admin invitation
journey now explicitly proves that missing Partner selection sends no request and
shows a validation alert before the selected Partner ID is submitted. Admin URL
checks compare the application path, allowing the configured isolated preview port
without weakening navigation or history assertions.

```sh
MJL_PLAYWRIGHT_PORT=4196 npm run test:e2e -- \
  e2e/auth/auth-presentation.spec.js
MJL_PLAYWRIGHT_PORT=4196 npm run test:e2e -- \
  e2e/auth/admin-presentation.spec.js
npx eslint e2e/auth/admin-presentation.spec.js \
  e2e/auth/auth-presentation.spec.js
npx prettier --check e2e/auth/admin-presentation.spec.js \
  e2e/auth/auth-presentation.spec.js
```

The final complete authentication-presentation file passed 17/17 in 13.2 seconds;
the reviewer-corrected complete Admin-presentation file passed 9/9 in 11.3 seconds;
targeted ESLint and Prettier passed. Some auth fixtures still emitted unrelated
requests to the absent default proxy while their intended outcomes passed. The next
browser cluster should make those controlled fixtures reject or fulfill every
expected request, then reconcile the empty-state/loading failures. These focused
results do not replace the incomplete broad ledger or establish a browser baseline
pass.

No immutable source snapshot was captured before the broad command. Repository
HEAD was `b3d7cd4f1f729890ec4a928aa367c031370f17a5`; `npm run build` produced the
surviving browser artifact with aggregate SHA-256
`b05a6c5bb0d649477cdb321f12d78a8206452f9e988499fd138319401efabee6`.
It was calculated by iterating every regular file under `frontend/dist` in lexical
repository-relative path order and feeding SHA-256 each path, a NUL byte, the file
bytes and another NUL byte. This states the aggregation method rather than implying
the digest is a conventional archive or concatenated-file hash.
At the post-run evidence capture, the unfrozen worktree had 29 status entries. The
broad run preceded the final locator corrections. The final focused results bind to
Admin test SHA-256 `492b00be4b2c7a765c33ecbe1bdd5829a0acda611003d37efa3d9ca1e7ca394c`
and authentication test SHA-256
`caec580de93b11e0d5f932fc8a1a08cd4dd91014ec1d06c427cabe3aefee67c8`.
Later concurrent source edits are outside these results; the hashes prevent those
edits from being folded into this evidence retrospectively.
