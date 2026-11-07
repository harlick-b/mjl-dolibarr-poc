# Project status

Updated 2026-11-06. MJL is under development; implemented does not mean accepted
or production-ready. This file describes the current boundary, not authorization
for another feature. [Business rules](business-rules.md) define behavior;
[engineering](engineering.md), [security](security.md) and [design](design.md)
own their subjects. [README](../README.md) owns setup and development commands.

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

The schema head is 0025_profile_names. Application code, migrations and focused
tests are the implementation evidence; do not treat a summary or an old passing
count as a new verification run.

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
Full reference parity remains incomplete: unsupported PTA/execution search filters
and populated Dashboard attention/financial sections need supporting data contracts.
PTA summary columns remain limited to available projections. No fictional totals
or nonfunctional filters were added to imitate those references.

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
assessment follows from development checks.
