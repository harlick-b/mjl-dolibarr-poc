# Project status

Updated 2026-11-05. MJL is under development; implemented does not mean accepted
or production-ready. This file describes the current boundary, not authorization
for another feature. [Business rules](business-rules.md) define behavior;
[engineering](engineering.md), [security](security.md) and [design](design.md)
own their subjects. [README](../README.md) owns setup and development commands.

## Implemented

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
  Internal Dashboard reads only selected project/PTA metrics; Admin and Partner
  Dashboard show permitted entry links. Separate Prévisions (PTA) and Réalisation
  entry pages use bounded project/PTA lists. Project and audit lists use tables.
  Full inspiration parity remains open: the PTA list API does not yet expose
  partner names, activity/validation summaries or approved budget per row; no
  summary is inferred from a paginated list. Admin/Partner Dashboard statistics
  are not implemented.
  Authentication screens follow the supplied references; OTP fields support
  typing, paste, correction and automatic submission on the sixth digit. One
  application-wide access gate masks navigation and protected views during bounded
  session revalidation, clears hidden-tab data, guards protected downloads and
  never replays writes. Cross-tab signals cannot reopen hidden workspaces or
  cancel an unconfirmed logout. Ordinary read failures preserve drafts; denied
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

The schema head is 0024_budget_funding. Application code, migrations and focused
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
