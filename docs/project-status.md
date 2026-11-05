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
- Direct entry to login or the existing role workspace (user management for Admin,
  Partner overview for Partner users, projects for internal business roles).
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
