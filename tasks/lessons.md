# Reusable Lessons

Update only after repeated corrections or durable discoveries. Read only lessons
relevant to the current task.

- Synthetic mailbox filenames are UUIDs and do not encode delivery order. Tests
  that need the latest message must compare the mailbox file set before and after
  the delivery, or select by an explicit delivery identifier.

- E2E assertions for dated activities must not assume a fixed fixture remains
  before its deadline. Assert persisted execution controls and workflow state
  separately from the date-sensitive overdue label.

- Sequential browser submissions do not prove row-lock serialization. For a
  concurrency acceptance gate, use disposable-only deterministic barriers that
  hold the real mutation inside its transaction, start the competing
  request while the lock is held, and verify both orderings plus teardown.

- SQL `CHECK` constraints accept the three-valued result `UNKNOWN`. Whenever a
  nullable operand is mandatory in one branch, require `IS NOT NULL`
  explicitly; a regex or comparison against `NULL` alone does not reject the
  row. Exact-schema tests should exercise the null branch, not only compare the
  stored constraint text.

- Historical audit text can contain quoted JSON credentials with spaces even
  when the original writer used a key-value sanitizer. Redact complete quoted
  values before the unquoted rule and before continuation splitting;
  otherwise the first rule can consume only the prefix and expose the rest.
  Exercise actor snapshots as well as reasons/context, including escaped quotes.

- Disposable workflow commands may use a fixed business date while audit
  timestamps still use the actual recording clock. Date-filter tests must use
  the fixture event’s captured date rather than its workflow date; otherwise a
  correct filter starts failing the day after the test is written.

- Playwright `testMatch` filters explicit CLI file arguments too. When renaming or
  retaining a focused spec, update both the runner path and `testMatch`, then
  check discovery with `playwright test <file> --list --config=playwright.config.js`.

- Playwright exact `getByLabel()` matching can include nested select option text
  even when the control's computed accessible name is just the label. For such
  controls, use `getByRole('combobox', { name: ..., exact: true })`; retain the
  name assertion instead of replacing it with an unrelated CSS selector.

- For OTP recovery, test expiry together with exhausted resends and a fresh
  password login. Testing expiry and resend caps separately missed a permanent
  pending-challenge trap; live challenge counters and active lockouts must still
  survive re-login.

- REST form submission completes asynchronously. Browser tests must await the
  relevant response and any subsequent navigation before reading a captured
  email or database result. A retained disposable tenant also retains rate-limit
  history: a neutral reset response can leave the previous outbox message intact.
  Use a fresh tenant to verify reset delivery, rather than treating that stale
  outbox as the response to the latest request.

- For REST forms that navigate immediately after saving, assert the mutation
  response status, then wait for the detail URL and read its ID. Reading the old
  browser response body after navigation can fail with `Network.getResponseBody`
  even when the save succeeded; the Partner test already demonstrates the stable pattern.

## Application and planning lessons

- For the approved PTA administrative workflows, do not make external fund
  custody/source-of-funds questions block application design. MJL records the
  specified allocations, spending, requests and external declarations; the
  user explicitly excluded investigation or modeling of the banking process.

- TanStack Query `clear()` removes cache entries without necessarily clearing an
  existing observer's displayed data. Authentication invalidation must also mask
  the UI reactively and deliberately revalidate; `invalidateQueries()` on the
  removed key is insufficient. `mutation.reset()` likewise leaves MutationCache
  variables behind: remove settled credential mutations and clear them on unmount.
  Repeated invalidation notifications also need a changing revalidation version:
  an already-true boolean does not restart an Effect after cancelling its pending
  read. Test a second account-change notification while that read is held.

- A migration cutover rehearsal must run the exact predecessor application
  artifact to create its histories, stop that writer, and then exercise the
  candidate through a distinct restricted runtime login. Creating data with the
  candidate and downgrading only its schema does not prove predecessor behavior
  or deployed credential separation.

- Reducing an audit payload to meet a size bound must preserve the material
  before/after values of edits that have no immutable revision yet. Remove
  repeated projections, retain one bounded structural copy per side, and test
  maximum encoded content plus edit/revert history and rollback of complete rows.
- When a schema guard hashes PostgreSQL definitions, an exact downgrade must
  restore the canonical predecessor constraint expressions and function bodies,
  not merely equivalent behavior. Verify the downgraded manifest against the
  predecessor application artifact before accepting re-upgrade evidence.
- Schema manifests must identify PostgreSQL columns by stable names rather than
  physical attribute positions. A drop and re-add can leave internal column slots
  while restoring the same public schema, causing a false provenance rejection.

- Completed plans should not look like pending authorization. Keep current
  contracts in purpose-named guides; remove spent instructions and duplicate reports.
- Repeated external execution prompts duplicated rules already approved in the
  repository. After a concrete slice is authorized, derive implementation locally
  from one current contract; ask about missing business choices, not prompt format.
- Fewer tables did not guarantee a simpler transfer implementation: shared state
  combinations and snapshot exceptions increased the work. Compare total model,
  constraint, API and verification cost before setting future representation limits.
- Post-transfer amendment tests changed amounts but initially kept the same dates,
  missing a constraint regression. Test meaningful changes to fields affected by
  the new invariant across adjacent workflows; larger passing counts do not replace
  that coverage. Keep the independent correction/re-review cycle that found it.
- A bounded Unicode input contract and a byte-bounded audit contract must agree at
  their maximums. Derive the audit byte ceiling from every validated before/after
  text field plus JSON overhead, then test maximum multibyte input; a smaller
  arbitrary byte limit turns valid requests into transaction-time 500 responses.
- A cursor-paginated audit API is incomplete unless its screen exposes independent
  Router-owned pagination. Do not reuse a list cursor for detail history, and cover
  navigation to an older page in the browser journey.
- When a final workflow state depends on child decision rows, row checks and
  immutability triggers do not prove the decision chain. Validate the aggregate at
  deferred transaction commit and test malformed direct writes, including review
  order, distinct actors and returned/cancelled histories.
- Administrative PDF checks must bind each financial label to its exact extracted
  value; a document-wide amount assertion can pass against the wrong row. Exercise
  maximum valid narrative content and correction-only changes, and verify that the
  rendered chronology identifies who changed what and when in user-facing language.
- A bounded upload must count streamed request chunks before accumulation. Run
  synchronous parsers and database work outside the async event loop, parse outside
  the global lifecycle lock, then reauthorize under that lock before atomic storage.
- At PostgreSQL READ COMMITTED, an export timestamp selected separately from its
  rows is not an exact snapshot. Capture the timestamp and exact append-only row
  IDs in one statement, then test absence by the concurrent row's exported ID;
  checking a raw internal action that the export omits is a false oracle.
- Protected inline media must use the authenticated REST client rather than a raw
  element URL when the workspace owns offline and authorization-loss behavior.
  Abort stale requests, reject late authorization generations, revoke object URLs
  and reset mutation data so sensitive bytes are not retained after close.
- A protected-download race oracle must trigger the same authorization-denial
  path as production. An offline event does not prove that a concurrent query
  401/403 revokes bytes synchronously before a late response creates an object URL.
- Returning a FastAPI `Response` with a runtime media type does not define that
  content in OpenAPI. Declare the route response class and assert both the binary
  success content and cookie security alternatives in the generated contract.
- A deferred hypothetical exception is not a product requirement. Before asking
  the user to design an exception workflow, establish that the real business
  process can produce that case; otherwise preserve the exact bounded rule and
  remove the invented branch from active planning.
- PostgreSQL JSON extraction returns SQL `NULL` for missing and JSON-null facts,
  so `<>` does not make a trigger fail closed. Use null-safe comparisons such as
  `IS DISTINCT FROM` for required snapshot values and test both missing and null
  direct writes against the complete valid surrounding snapshot.
- Metadata-only views over stored documents must explicitly defer or raise on
  binary columns in every list, report and candidate lookup. Verify the emitted
  SQL, because response-shape tests do not prove that large file bodies stayed
  unloaded. When candidates use the shared cursor contract, expose pagination
  instead of silently limiting valid choices to the first page.
- A row-count ceiling does not bound an export if its query loads full large
  snapshots or every correction revision. Project only exported fields, select
  the latest history row per entity in SQL, and test both the refusal boundary
  and latest-correction semantics.

- Editable fields and their concurrency token must describe the same snapshot.
  Background Query refresh must not attach a newer version to an older local
  draft. Preserve both until save or explicit discard, and test refresh during
  editing (including observation-only changes that do not remount a form).

- Resetting a TanStack mutation does not suppress its old hook callbacks. Bind
  protected-file error cleanup to the request generation so an old failure cannot
  cancel a newer request. A successful scoped-list refresh that removes the active
  file must also revoke pending bytes and preview URLs, not merely hide its row.

- Excel numeric cells retain only 15 significant digits reliably. Write larger
  integer XOF values as exact decimal text, label that convention, and verify the
  saved cell type. Write user-controlled workbook text explicitly as text so names
  cannot become formulas or external links.

- A route loader can delay mounting the page itself, so component-only loading
  states leave a blank wait. Cover both route and dependent section requests;
  test staggered responses, and keep forms mounted during pagination/refetch so
  placeholders do not discard drafts or mistake pending data for an empty list.
