# Reusable lessons

Keep only repeated corrections or durable discoveries. Replace superseded advice;
do not append a competing rule. Read the sections relevant to the current task.
This is memory about pitfalls, not a backlog, acceptance report or authorization.

Current rules belong in [business rules](../docs/business-rules.md),
[engineering](../docs/engineering.md), [design](../docs/design.md) and
[security](../docs/security.md). [Project status](../docs/project-status.md) records
implementation boundaries; [README](../README.md) owns setup.

## Scope, review and evidence

- Finish the smallest complete authorized slice: implement, inspect the actual
  experience, run relevant checks and obtain independent review before claiming
  completion. Commit when requested. Passing tests are implementation evidence,
  not proof that the result matches the user's design or acceptance.
- Explain necessary scope growth when discovered. Shared auth or API dependencies
  can be necessary to fix a screen; independent improvements remain separate.
  Do not let a large final commit be the first explanation of expanded scope.
- Use the approved contract and actual code without asking for another execution
  prompt. Ask only about unresolved business choices or missing external inputs.
  Hypothetical exceptions are not requirements; establish a real case first.
- Consolidate independent findings, fix accepted issues and return the candidate
  to the same reviewer. Do not claim completion with blocking findings or gaps.
- Distinguish full runs, focused reruns, skips and interruptions. Record actual
  commands and tested source/artifact. A focused pass cannot make an unfinished
  broad run pass. After fixes rerun affected checks, not unrelated suites.
- Keep settled rules in their owning guides. Remove spent plans, duplicate reports
  and obsolete claims rather than accumulating a second source of requirements.
  Documentation-only cleanup does not justify runtime suites.

## Design and interaction

- Verify the browser tab title in a real browser. With React 19, concatenate
  dynamic title text and its suffix into one string; JSX fragments can leave an
  empty title even when the page renders correctly.

- Compare supplied references against rendered populated pages, empty states,
  dialogs and narrow layouts. Inspect spacing, alignment, typography and controls,
  not just whether the page loads. Explicit user corrections override a reference
  detail; business/security rules still govern permitted behavior.
- Loading belongs to the work being awaited: a submitting button, a dependent
  section or the page. Keep the verified navigation shell during ordinary reads;
  preserve entered values and button progress until the next auth screen is ready.
  Do not add a loading sentence below a CTA or briefly clear fields before redirect.
  Follow the [loading contract](../docs/loading-and-fallbacks.md).
- Errors belong to the component/action that produced them. Login errors must not
  follow navigation into recovery. Optional catalog failures must not replace the
  parent page or remove cancellation. Distinguish pending, empty and failed reads.
- A confirmed write and its refresh are separate outcomes. An invitation can be
  delivered while refreshing the list fails. Preserve confirmed success and offer
  read retry; do not encourage duplicate invitations or approvals.
- When a write response is lost, freeze the exact command and idempotency key until
  replay resolves it. Unlock correction only for a response that occurs after the
  replay lookup and proves no write exists. Middleware rate limits and access
  interruptions happen earlier, so they cannot safely release or replace the draft.
- Centralize shared decisions, not all data: role navigation/route guards/defaults,
  query keys and controls need one owner. Load page/form options where consumed.
  Shared React context should expose Query state, not maintain another copy.
- One person should not appear twice just because they have both an account and
  an invitation. Keep state/actions together with one pagination boundary.
  History should show meaningful changes, actor, target and recorded before/after
  facts. Filtering authentication noise from the screen must not delete its audit.
- Prefill edit forms from existing data. Keep editable values and their concurrency
  token bound to the same snapshot until save or explicit discard; a refresh must
  not attach a new version to an old draft. Legacy name suggestions need to remain
  editable, not become an automatic database rewrite.
- Replacing native selects needs real-browser checks for keyboard use, required
  validation and FormData. In native dialogs, keep the popup in the dialog's top
  layer. Test close/focus return and submitted values, not only appearance.
- A CSS-to-Tailwind migration must preserve the cascade. Keep shared field defaults
  low-specificity so OTP and specialized controls can override them. Inspect
  computed styles and mobile overflow; an accessible hidden label can overflow a
  scrolling table unless its positioning is contained.
- Role navigation changes must preserve first-resource creation, not just list
  access. When creation moves to another role, keep a usable handoff: a reviewer
  creates the PTA, then Agents add Activities inside it. Do not activate a new
  prerequisite before its authorized creation path is available.

## Authentication, queries and protected data

- Query cache removal does not guarantee that mounted observers stop displaying
  old data. Mask protected content through the existing access coordinator.
  Keep the session observer attached and clear its value; deleting that observed
  entry can strand the login → OTP → workspace transition.
- Mutation reset does not remove all cached variables or suppress old callbacks.
  Purge settled credential variables and guard late responses by request
  generation. An obsolete protected-file failure must not cancel a newer request.
- Use the bounded coordinator recovery contract rather than adding per-screen
  verification effects. Test repeated account-change notifications during a held
  check: no obsolete identity, stranded mask or unbounded request loop.
- Switching tabs is not authentication loss. Preserve data and drafts on ordinary
  hide/return; actual expiry, logout, offline and account changes retain the
  protections defined in the engineering guide.
- When responsibility controls editing, test reassignment against waiting commands
  and open dialogs. Losing edit rights must refresh mutation controls without
  removing permitted read access; test collaborators need explicit assignments.
- Ordinary read failure, authentication uncertainty and scoped denial differ.
  Scoped denial must remove retained pages, dependent previews and object URLs,
  not merely visible rows. Temporary service failure preserves unrelated drafts.
  Session-service failure is different: close local access and require fresh sign-in
  after confirmed server logout, as specified in the engineering guide.
  Test the actual denial path; an offline test does not prove a 401/403 race.
- Protected media uses the authenticated REST client, not an unguarded element URL.
  Abort obsolete requests, reject late results and revoke object URLs on close or
  access loss. A successful refreshed list that removes a file also revokes its
  pending bytes and preview.
- Preserve failure conditions in recovery tests. Retry failed logout after
  cross-tab CSRF rotation on the same mounted page; reloading first can hide the
  stale-state defect. Test reload persistence separately.
- Test OTP expiry together with exhausted resends and fresh password login.
  Isolated expiry/cap tests missed a permanently pending challenge. Re-login must
  still respect active challenge counters and lockouts.
- Reproduce slow page reads concurrently. Exclusive session locks can serialize
  otherwise independent reads into timeouts. Shared read locks must retain
  revocation safety; verify both with real database races.

## Data integrity, migrations and outputs

- MJL records allocations, requests and external declarations; do not block a
  bounded implementation on banking/custody modeling excluded by the contract.
- Count total model, constraint, API and verification complexity, not tables alone.
  Fewer tables can create more state combinations and snapshot exceptions.
- SQL CHECK accepts UNKNOWN. Require IS NOT NULL where a branch needs a value.
  JSON extraction returns SQL NULL for missing and JSON-null facts; use null-safe
  comparisons for required snapshot values and test both forms of direct writes.
- Child-row immutability does not prove a valid approval chain. Verify the aggregate
  at deferred commit, including review order, distinct actors and returned or
  cancelled histories. Test adjacent workflows and changed invariant fields,
  such as dates after transfer, not only changed amounts.
- Bound Unicode inputs and encoded audit bytes consistently. Preserve material
  before/after values for mutable drafts; remove repeated projections instead.
  Test maximum multibyte content, edit/revert history and atomic rollback.
- A cutover rehearsal needs the exact predecessor writer and a distinct restricted
  candidate runtime login. Candidate-created data with a downgraded schema is not
  predecessor evidence. Hash-based schema guards need canonical predecessor
  definitions restored on downgrade; identify columns by stable names, not
  physical positions left behind by drop/re-add.
- Cursor APIs need Router-owned pagination in their screens. Detail histories
  require independent cursors. Bounded reference lists must expose remaining
  choices rather than silently limiting users to the first page.
- A row limit does not bound memory if queries load large snapshots, binary files
  or every revision. Select only needed fields and latest relevant history in SQL.
  Metadata-only views must defer binary columns; inspect SQL as well as responses.
- At READ COMMITTED, separately selected timestamps and rows are not one snapshot.
  Capture export time and exact append-only IDs in one statement. Test concurrent
  row absence by its exported ID, not by an internal action omitted from output.
- PDF checks must bind each label to its exact value, including maximum narrative
  text and correction-only changes. Chronology must identify who changed what and
  when in user-facing language; a document-wide amount match is insufficient.
- Excel numeric cells retain only 15 significant digits reliably. Export larger
  exact XOF integers as labeled text; write user text literally to prevent formula
  or URL interpretation. Verify saved cell types.
- Count streamed upload chunks before accumulation. Parse outside the lifecycle
  lock and async event loop, then reauthorize before atomic storage.
- FastAPI runtime Response media types do not define OpenAPI output. Declare and
  verify binary success types and cookie security in the generated contract.

## Reliable verification and local operation

- Use disposable PostgreSQL with deterministic barriers for transaction races.
  Sequential browser submissions do not prove serialization. Hold the real
  mutation, start the competitor, check both orderings and tear down test data.
- Mailbox UUID filenames do not encode delivery order. Compare before/after file
  sets or explicit delivery IDs. Await the relevant REST response/navigation
  before inspecting mail or database results.
- A retained test tenant retains abuse limits; a neutral recovery response may
  leave old mail untouched. Use a fresh isolated tenant to verify a new delivery.
- Workflow dates and actual audit recording dates can differ. Filter tests using
  captured audit dates; do not assume a dated fixture is always before deadline.
  Assert overdue labels separately from persisted execution controls.
- For navigating submissions, assert response status, then the destination URL
  and ID. Reading an old browser response body after navigation can fail even
  when saving succeeded.
- Check Playwright discovery when renaming specs: testMatch also filters explicit
  CLI paths. Use role plus accessible name for custom comboboxes; option text can
  interfere with label queries. Await the condition under test rather than sleeps.
- Before launching an existing app, identify its configured database and runtime.
  Compose can override .env and a new project name selects another volume.
  Healthy endpoints alone do not prove that existing accounts are being served.

- A dialog form rendered through a React portal still bubbles submit events to
  its React parent. Stop propagation when creating a reference from another form,
  and verify that saving the reference neither submits nor resets the parent draft.
