# Phase 3B: Revised Strategy After Confidence Review

## 1. Review outcome and agreed boundaries

Independent security, financial, and rollout audits completed three review rounds, followed by a simplification check. **No known actionable planning blocker remains after the corrections below.** This is a design-review conclusion; factual 100% runtime correctness cannot be established before implementation and testing.

The review found and addressed these material loopholes:

| Risk | Correction |
| --- | --- |
| Stale authorization during exports | Separate consistent-snapshot reads from a fresh, locked authorization transaction. |
| Incorrect financial totals | Preserve validated amounts after cancellation and prevent multiplication through assignment/revision joins. |
| Misleading work queues | Separate approval-ready requests from stale requests still requiring rejection or withdrawal. |
| Export precision and oversized audit payloads | Use exact numeric projections, explicit XLSX text fallback, and bounded field-level audit expansion. |
| Crash cleanup and uncertain commits | Define eventual cleanup and retain truthful generation evidence without claiming delivery. |
| Broken installation or false activation success | Install the export schema explicitly; return numeric failure for migration-required activation. |
| Incomplete test execution or retained fixtures | Update actual runner batches and prohibit retention for Phase 3B and containing aggregates. |
| Memory overlap during slow downloads | Serialize generation and release workbook memory before allowing another generator. |

Retain the previously agreed choices:

- Five fixed PDF/XLSX/CSV reports.
- Computed in-app alerts with seven-calendar-day warnings.
- Period selection by overlapping Activity dates, showing current cumulative amounts.
- Export traces retained; generated files remain temporary.
- Oversized XLSX values preserved as exact text.
- Acceptance scale: 1,000 Activities, 10,000 Opérations, 50,000 audit events.

The user additionally accepted:

- **Authorization cutoff:** revocation committed before the final generation transaction blocks delivery. A response authorized by that transaction may finish.
- **Crash cleanup:** private orphan files are removed on the next export or controlled startup. Hard-crash cleanup is not instantaneous.

Deliver RST-009C, RST-011, RST-012, RST-013D, and RST-014D. Preserve the empty shared tenant, existing business workflows, document containment, and one hourly execution reconciler.

## 2. Monitoring, financial projections, and audit

**Shared reads and financial meaning**

- Centralize scoped filtering and financial projection across dashboards, report previews, and touched Activity/Opération detail views.
- Use current Activity assignments for Agent authorization, active-entity portfolio access for Supervisor/Validator, and technical/audit access for Admin.
- Produce one financial row per Activity before portfolio aggregation. Use assignment `EXISTS` checks and separately aggregate one-to-many relations.
- Initial proposal means revision 1. Current pending proposal means the current draft/submitted amount in nonterminal, unvalidated states; distinguish draft from submitted proposals.
- Validated totals use the latest definitively validated amount, including Activities subsequently cancelled. Unvalidated authorization never enters validated totals.
- Split validated Opération authorization and spending by the Opération’s own cancellation state. Completed children preserved inside cancelled Activities remain non-cancelled amounts.
- Compute completeness over every non-removed Opération. Preserve null spending, explicit zero, and clearly identified partial known sums.
- Adapt source rows to the existing pure status projector’s expected shape. Propagate database failures distinctly from genuinely empty child collections.
- Compute exact signed differences and percentage values before presentation. Never parse formatted money or variance strings back into numbers.

**Browsing and role dashboards**

- Replace the static Accueil with scoped financial indicators, workflow-stage counts, and permitted-action queues.
- Support Partenaire, Projet, Activity reference/name, validation state, execution state, completeness, and inclusive date overlap. Default to all dates.
- Include inactive references still used by visible Activities in browsing filters. Creation dropdown rules remain separate.
- Opération browsing additionally supports type and state. Those filters narrow Opération rows without changing parent Activity completeness or totals.
- Activity detail requires one Activity and always contains its complete current Opération table; reject unsupported child filters.
- Use stable 50-row pagination and preserve filters across navigation. Audit/chronology pagination uses stable event ordering and cursors.
- Display source failures locally as unavailable, without fabricated zeros or raw diagnostics.

**Alerts and action eligibility**

- Separate “awaiting this workflow stage” from “actions I may perform”.
- Action queues apply current assignments, contributor/prevalidator separation, exact revisions, and structural date freezes.
- Validation warnings begin seven days before start and escalate at/after start. Exclude abandoned and explicitly cancelled work.
- Completion warnings apply to validated, nonterminal Activities during the final seven days through the inclusive end date; overdue begins the next day.
- Missing-spending action alerts concern started, editable execution. Future untouched work and terminal incomplete objects receive informational treatment where appropriate.
- Request approval eligibility uses the existing version, revision, state, competing-request, and Opération-set-hash rules.
- Stale requests remain visible under “À clôturer”, with permitted rejection or withdrawal. Add no persisted `STALE` state.
- Use one Africa/Porto-Novo date per response/export. Add no notification persistence, email delivery, cache table, or scheduled notification work.

**Chronology and complete audit**

- Add event-specific French labels and meaningful changes for execution, requests, withdrawals, decisions, assignments, automatic transitions, and exports.
- Ordinary Activity chronology contains sanitized contextual history. Complete audit and audit exports remain Validator/Admin-only.
- Search historical event identifiers, references, revisions, target versions, actor snapshots, actions, results, and event-date ranges. Do not hide history through joins to current users or active references.
- Support every currently emitted audit action with an explicit field-level projection. Unknown/malformed details receive an explicit unavailable state; a complete audit export fails safely if required details cannot be represented.
- Only genuinely single-Activity exports enter ordinary Activity chronology. Multi-Activity exports remain in complete audit.
- An audit extract excludes its subsequently committed generation event.

## 3. Fixed reports and guarded generation

| Report | Defined content |
| --- | --- |
| Activities | Hierarchy, dates, assignments, revision references, states, and separated financial indicators |
| Opérations | Parent, type, state, authorization classification, spending, observation, difference, and variance |
| Activity detail | General information, assignments, revision references, financial summary, and complete current Opération table |
| Portfolio summary | One row per Projet by default, or per Partenaire when selected; no mixed subtotal levels in machine-readable tables |
| Audit extract | Event metadata and ordered field/path changes with before/after values |

Use fixed report/format keys, filtered previews, and CSRF-protected POST generation. Each report is authorized independently; Admin receives only the audit report.

**Generation sequence**

1. Acquire one fixed, nonblocking exporter lock for the single-container runtime. Return a concise busy response if another generation is active.
2. Under that lock, clean recognized orphan attempt directories without following symlinks. Controlled startup uses the same lock. Never replace or delete the lock file.
3. Open a bounded consistent-read transaction. Capture authorized data, included Activity IDs, filters, generator identity, snapshot time, and calculation date. Preflight row counts and source byte sizes before buffered fetching or JSON decoding.
4. Close the snapshot transaction and render privately with installed TCPDF/PhpSpreadsheet. Use a `0700` non-web spool and exclusive `0600` files outside document storage.
5. Open the finished artifact, verify regular-file type, size, and hash from that descriptor, rewind it, and unlink its pathname. Delivery will use this exact descriptor.
6. Start a new `READ COMMITTED` transaction. Reload and lock the exporter and role, then included Activities in ascending order and current assignments. Require the same role/entity as the snapshot and current permission for the entire captured scope. Native Admin uses the technical audit authorization path.
7. Append the generation audit event and immutable export record atomically. Require matching entity, export identifier, successful action, and generator actor; keep the audit reference unique.
8. After confirmed commit, free workbook/writer objects and snapshot arrays, end transactions, restore query budgets, clean named artifacts, and release the exporter lock. Stream only the verified descriptor with a bounded buffer.

Use attachment delivery with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. No legacy output wrapper may bypass this owner.

Confirmed pre-commit failure produces no successful export pair or file delivery. **An uncertain COMMIT acknowledgement may leave both records committed:** deliver no file, preserve evidence, and do not blindly replay the transaction. Interrupted delivery retains truthful `GENERATED` evidence without claiming browser receipt.

Normal cleanup uses `finally` and shutdown handling. Hard-crash leftovers remain private until the accepted next-export/startup sweep.

**Formats and integrity**

- Every format includes export identifier, generator, generation/as-of times, filters, scope, and stable French filename.
- PDF uses plain text, canonical financial display, repeated headings, and readable page breaks. User content cannot become HTML, resource URLs, embedded objects, or renderer instructions.
- XLSX uses numeric ordinary amounts, explicit text user content, and number formats. Values exceeding conservative numeric precision become exact text with a metadata explanation.
- Percentage cells contain ratios. Preserve tiny nonzero signs; use exact text when numeric rendering cannot reproduce the canonical signed two-decimal display.
- CSV retains BOM, semicolons, French headers, documented metadata preamble, formula-safe text, and exact canonical decimal strings. Explain that spreadsheet auto-import can round long CSV numbers; XLSX provides the controlled text fallback.
- Missing numeric cells remain blank with documented meaning; explicit zero remains numeric zero.
- Audit changes expand into ordered scalar rows rather than whole JSON cells. Redact complete values before splitting long text into numbered continuation rows.
- Previews and separately generated exports may represent different snapshots; their timestamps make that distinction explicit.

## 4. Installation, limits, and delivery

**Schema and activation**

- Add one immutable export-record table with identity, report/projection version, format, generator snapshot, timestamps, canonical filters/scope, row count, file size/hash, and audit reference.
- Keep its DDL outside the generic bulk-loaded `sql/` directory. Fresh installation builds the existing Phase 3A foundation before explicitly installing the export extension.
- Existing installations require the guarded additive migration. Migration-required activation sets an error and returns numeric `-1`, never a string that Dolibarr can interpret as success.
- Preserve predecessor schema assertions. Any evidence-required index change must be an explicit successor contract.
- Update the existing executable dependency ledger alongside the canonical approval/execution records.
- Replace stale reset-path inventories and UI-audit claims before implementation; do not recreate removed legacy report machinery.

These controls address the actual activation behavior in [the module initializer](/home/yoann/Documents/Projects/mjl-dolibarr-poc/custom/mjlfinancement/core/modules/modMjlFinancement.class.php:122).

**Resource contract**

Apply limits together:

- 500 PDF body rows; 10,000 XLSX/CSV body rows, including audit continuation rows.
- 5 MiB source payload before decoding and 5 MiB serialized projected content.
- Text segments of at most 4,000 Unicode characters.
- 20 MiB final artifact.
- Memory-headroom checks before allocation, followed by full-pipeline peak-memory verification.

Never silently truncate or exclude oversized records. Distinguish excessive selection from a single unsupported record.

Thirty seconds is a measured generation acceptance target with monotonic no-publication deadline checks, not a claim that PHP guarantees hard wall-clock termination. Bound database query/lock waits and restore those settings afterward.

Benchmark the actual installed environment, recording image IDs, PHP limits, host resources, and workload distribution. After one warm-up, require p95 authenticated dashboard/list latency ≤2 seconds over 20 serial samples. Every accepted benchmark export must complete generation within 30 seconds.

**Implementation sequence and local cutover**

Implement shared projections/audit first, dashboards and browsing second, one end-to-end Activity export third, then the remaining reports and navigation.

Rehearse the actual lean cutover wrapper: committed source, stopped traffic, private checksummed backup, exact predecessor verification, additive installation, target verification, restart, and health check. Unknown state leaves traffic stopped.

Shared post-cutover checks are read-only. Do not generate even an empty export there, because that would create persistent report/audit records. Preserve the single Admin, empty business tables, document checksums, and existing hourly reconciler.

Empty-schema rollback is permitted only without export evidence. Once records exist, containment disables new behavior while retaining records and audit.

## 5. Acceptance and completion gates

Extend the existing disposable runner and bounded command-backed factories. Wire `test:phase3b` into actual suite mappings, explicit E2E batches, discovery, schema verification, shared-state evidence, and cleanup.

Disable retention for Phase 3B and aggregates containing it, including when `MJL_TEST_RETAIN=1`. The existing retention branch requires explicit correction: [runner cleanup](/home/yoann/Documents/Projects/mjl-dolibarr-poc/tests/runner/run-suite.js:698).

Required evidence includes:

- **Financial:** multiple assignments/revisions without duplicated totals; cancellation before/after validation; partial/null/zero spending; complete denominators despite child filters; oversized amounts and signed tiny percentages.
- **Workflow:** contributor role changes, start-date freezes, late unchanged review, exact stale-request predicates, rejection/withdrawal cleanup, and deadline boundary dates.
- **Authorization:** both orderings of revocation versus final commit, including cross-Agent abandonment, cancellation, account changes, native Admin scope, and cross-entity identifiers.
- **Export integrity:** all five reports and three formats, historical actors, inactive references, metadata, safe text, oversized audit values, continuation-boundary redaction, and unknown payload refusal.
- **Failure handling:** row/byte/cell limits, low memory, deadlines, renderer/open/hash/unlink failures, audit/record insertion failures, ambiguous commit, interrupted transfer, hard-crash orphan cleanup, and lock contention.
- **Installation/isolation:** clean install, Phase 3A upgrade, repeated activation, interrupted DDL convergence, malformed-state refusal, actual wrapper failure paths, empty rollback, evidence-preserving containment, and complete failed-run teardown.
- **Discovery:** a deliberately failing Phase 3B test must fail both focused and aggregate gates.
- **Accessibility:** populated dashboards, alerts, filters, audit details, reports, and error/limit states at the existing viewport/zoom matrix, including forced colors and reduced motion.

Inspect PDF content with `pdftotext` and workbook values/types with PhpSpreadsheet. Run changed-file `php -l`, `git diff --check`, `npm run test:phase3b`, `npm test`, and `npm run test:verify`.

Complete Standards, Spec, Security, Design, and full-feature reviews. Update canonical decisions, acceptance/coverage documents, current-state/gap analysis, and the Phase 3B execution report.

Issue `PHASE_3B_READY_WITH_NOTES` only if technical gates pass and the sole remaining note is the unsigned expanded human accessibility review. Failed technical gates produce `PHASE_3B_BLOCKED`. Stop after Phase 3B; no verdict authorizes production.

Review work remained read-only. Repository/installed-code inspection, pure calculation probes, an in-memory workbook capacity probe, and clean diff/status checks were completed. Full implementation acceptance and signed human accessibility remain unexecuted.

## Execution authorization

Approved for implementation and guarded local cutover by the user on 2026-09-09 under DEC-056. Review baseline: `4f74b4c`. Test seams are the scoped read/projection interfaces, authenticated routes, generated files, exact schema/cutover commands, and disposable runner described above. Implementation is in progress; no readiness verdict or shared cutover is yet claimed.

## Implementation checkpoint — 2026-09-09

**Status: IN_PROGRESS, not Phase 3B ready.** No shared cutover has run. The
Phase 3A routes and module activation remain the active application surface.

Implemented preliminary components: scoped monitoring reads, exact financial
and deadline projections, fixed report-filter/portfolio helpers, immutable
`mjlfinancement_export_record` schema, private single-lock spool, typed
CSV/XLSX/PDF rendering, and an export transaction owner. The owner captures a
consistent snapshot and rechecks runtime entity, native identity, role and
included Activity access before atomic generation evidence. It returns an
unlinked descriptor. The Activities preview and POST delivery routes now use
this owner; focused Activities validation passed as recorded below.

Verification at this checkpoint:

- `node tests/runner/run-suite.js unit`: 181 Node tests and all PHP contracts
  passed. New PHP files passed `php -l`.
- Attached `node tests/runner/run-suite.js phase3b`: schema, installed
  CSV/XLSX/multipage-PDF renderer, and native Admin audit-export transaction
  probes passed. The run still exits nonzero through its explicit
  incomplete-integration guard; this is not a passed Phase 3B gate.
- Disposable run `mjl-test-20260909t150143-899496-747e936d` completed teardown.
  Its `phase3b-shared-evidence.json` proves identical before/after protected
  source, documents, database, Admin and shared resource evidence.
- Earlier probes exposed and led to fixes for the installed spreadsheet loader
  and writer file permissions. Two background runs were externally terminated;
  their exact owned containers, volumes and networks were removed explicitly.
  Those runs do not count as verification evidence.
- Independent component reviews found and fixed audit byte-count underestimates,
  missing historical filters, numeric-zero division, preflight allocation order,
  omitted metadata limits, PDF headings/money display, and export-owner cleanup
  and identity issues. These are component reviews, not final feature approval.

Remaining mandatory work: the other three complete report datasets and audit change
projection; scoped dashboards, lists, queues, chronology and navigation; the remaining report
delivery routes; activation/migration/cutover commands; real authorization-race,
concurrency, failure and performance tests; complete runner/Playwright coverage;
expanded accessibility evidence; final independent reviews; full committed-source
gates and guarded local cutover. `npm test`, `npm run test:verify`, the expanded
manual gate and cutover rehearsals have not been run for this unfinished phase.
No production or READY verdict is implied by this checkpoint.


## Activities vertical slice — verified 2026-09-09

**Slice: PASS. Full Phase 3B: IN_PROGRESS.** The Activities list links to the
scoped report only when the target export table exists. The report requires the
exact RST-012 schema; shared Phase 3A remains unavailable pending guarded cutover.
Business users can filter and preview their complete selection and download
French PDF/XLSX/CSV files. Native Admin and users without a business role are
denied. Downloads capture a consistent selection, recheck current identity and
all included assignments, commit immutable generation evidence atomically, and
stream only the verified unlinked descriptor. Incidental output is discarded.
Preview queries have bounded waits and recover cleanly after a blocked read.

Verification:

- `node tests/runner/run-suite.js phase3b-activities`: **16/16 passed** in
  `mjl-test-20260909t162317-1056957-a55c5be7` (242.7 seconds including provisioning
  and teardown). Coverage includes the actual Activities entry point, all three
  formats and matching hashes, Agent/role/entity boundaries, malformed requests,
  mobile filtering without JavaScript, overlapping generations, assignment and
  account changes after capture, failure at both evidence insert boundaries,
  buffered output, preview timeout/recovery, null versus zero, and spool cleanup.
- The run's `phase3b-activities-shared-evidence.json` proves exact before/after
  equality. Containers, volumes and network were removed; artifact secret scan
  passed. All business fixtures belonged to this disposable tenant.
- `node tests/runner/run-suite.js unit`: **182/182 Node tests** and all PHP
  contracts passed. `php -l` passed for all 14 changed/new PHP files, including
  `custom/mjlfinancement/lib/mjl_report_route.lib.php` and
  `tests/fixtures/phase3b-report-fixture.php`. `git diff --check` passed.
- Inspected the 390px no-JavaScript screenshot and rendered PDF page. The mobile
  form fits its viewport; the PDF preserves the oversized FCFA amount and null
  spending labels without clipped content. Expanded human accessibility signoff
  remains pending.
- Standards review: **0 open blocking findings** after runner/documentation and
  delivery-failure fixes. Spec review: **0 open findings for this slice** after
  distinct unsupported-record handling and additional failure/race coverage.
  These reviews do not approve the unfinished whole phase.

The public aggregate E2E batches now include this slice after predecessor checks.
The full `phase3b` command also invokes it but retains an explicit incomplete-phase
failure. Aggregate `npm test`, `npm run test:verify`, `npm run test:e2e`, expanded
manual accessibility, scale/performance and committed-source/cutover gates were
not run for this slice: the other reports, dashboards and deployment work remain
unfinished. No shared schema migration, production action or READY verdict was
performed. Existing durable lessons were reviewed; no additional lesson was needed.


## Operations vertical slice — verified 2026-09-09

**Slice: PASS. Full Phase 3B: IN_PROGRESS.** The existing preview and POST route
accept a closed `report` key: `activities` (default) or `operations`. Both use
the same reviewed export owner. The Opérations list links to its report only
when the target export table exists; the report still requires exact RST-012.
There is no shared schema change or cutover in this slice.

The Opérations report adds scoped type/state filters after complete-parent
projection, proposed/validated authorization, spending, observation, exact signed
difference and variance. Parent filter labels explicitly identify the Activity.
Inactive types referenced by visible work remain selectable. Pagination preserves
filters and downloads include every selected page; audit scope contains exactly
the represented parent Activities. Cancelled parents retain prior validation and
each child's own execution state. Missing ratios are blank in CSV/XLSX; exact
zero remains numeric in XLSX, while tiny signed percentages retain their text
presentation when numeric spreadsheet formatting would lose the sign.

The existing memory-headroom check is now available before derived-record and
typed-table expansion as well as before writer allocation. This fixes a reproduced
32 MiB fatal allocation failure without introducing another reporting framework.
A standalone 10,000-small-row probe built at 64 MiB peak under a 128 MiB limit
and passed CSV preflight; it is not the full database/writer performance gate.

Verification:

- `node tests/runner/run-suite.js phase3b-reports`: **27/27 passed**, comprising
  the 16 Activities regression checks and 11 Opérations checks, in disposable
  run `mjl-test-20260909t165805-1143807-3aa312fa` (270.8 seconds including setup
  and teardown). The new checks exercise the real entry point, parent/child
  filter semantics, all three files and matching immutable evidence, exact XLSX
  cell types and formula-like text, cancelled and proposed work, 51-row pagination
  across two valid Activities, role/Agent/entity restrictions, malformed report
  requests, and inactive types on mobile without JavaScript.
- `phase3b-reports-shared-evidence.json` proves exact shared before/after equality.
  All owned containers, volumes and network were removed and artifact scanning
  passed. No test records or generated files were retained in a tenant.
- `node tests/runner/run-suite.js unit`: **186/186 Node tests** and all PHP
  contracts passed. New regression tests were observed failing before fixing
  missing numeric values, memory exhaustion, and exact zero percentage typing.
- `php -l` passed on all 15 changed/new PHP files; `git diff --check` passed.
- Inspected the 390px screenshot and PDF body page: controls and values fit,
  observations remain readable, and oversized amounts/difference/percentage
  retain their exact representation.
- Standards/security review: **0 open blocking findings**. Spec review:
  **0 open findings for this slice**. Review caught an invalid 51-child fixture;
  it now uses command-valid 50+1 children across two Activities. A subsequent
  fixture namespace-length failure was fixed without weakening factory limits.

`test:phase3b-reports` is included in actual aggregate runner coverage and the
full phase gate; the latter retains its explicit incomplete-phase failure.
Aggregate `npm test`, `test:verify`, `test:e2e`, expanded human accessibility,
full-scale/performance and cutover gates were not rerun for this bounded slice;
Fiche Activité, portfolio, audit, dashboards and deployment work remain pending.
No whole-phase READY verdict or production authorization is implied.

## Fiche Activité slice checkpoint — 2026-09-09

The Fiche Activité is implemented behind exact RST-012 readiness, with a
contextual link from the Activity detail. It requires one accessible Activity
and presents general information (including description, current assignments
and current submitted revision number/identifier), separated financial indicators,
and the complete current non-removed Opération collection. Unsupported child
filters and missing selection are rejected. Missing, foreign and inaccessible
Activities fail without exposing details or generating export evidence.

PDF, XLSX and supplemental CSV reuse the existing export owner, consistent
snapshot, full-scope authorization recheck and atomic audit/immutable evidence.
The Fiche always retains its parent in audit scope. A shared download form avoids
three copies of the same CSRF/format/filter controls; no new persistence or
runtime dependency was added. Fixed three-section documents use existing row,
source, artifact and memory limits.

A browser regression exposed that the installed Dolibarr HTML helper's default
converts line breaks into literal backslash-n text. Fiche cells and Operations
observations now use plain-text HTML escaping followed by controlled line-break
markup. Browser assertions verify preserved line breaks and literal markup;
all installed export formats retain their distinct typed-value safeguards.

Verification:

- `node tests/runner/run-suite.js phase3b-reports`: **35/35 passed** (16
  Activities, 11 Operations, 8 Fiche checks), disposable run
  `mjl-test-20260909t172232-1206502-c4d278c8`, 322.4 seconds including setup and
  teardown. PDF, XLSX and CSV contain all three sections, exact numeric/null
  semantics, literal user text and matching single-Activity immutable evidence.
- Shared before/after evidence is exactly equal. Artifact scanning passed;
  all owned containers, network and volumes were removed. Retained sanitized
  runtime logs contain no PHP fatal/parse or uncaught errors.
- `node tests/runner/run-suite.js unit`: **188/188 Node tests** and all PHP
  contracts passed. The two new Fiche projection contracts failed before
  implementation and then passed.
- `php -l` passed on all 15 changed/new PHP files; `git diff --check` passed.
- The initial combined run passed all 27 existing checks and reproduced the
  multiline preview bug in the new Fiche test. Its remaining seven serial
  Fiche checks were skipped, and its diagnostic artifacts were removed by the
  credential scanner. Its owned tenant was fully torn down. It is not final
  acceptance evidence.

Standards/security review: no open blocking findings. Spec review: no findings
for this slice. Documentation completion identified by Standards is recorded in
the current map, acceptance guidance, reset inventory and screen/audit records.
The no-JavaScript 390px preview and actual PDF general-information/Opération
pages were inspected: controls and content fit, descriptions/observations
remain readable, and zero versus missing spending is preserved.

The complete phase remains IN_PROGRESS. Portfolio and audit reports, dashboards,
full-scale/performance verification, broader aggregate gates, expanded human
accessibility and guarded cutover remain pending. Aggregate npm test,
test:verify, test:e2e, full-phase and cutover commands were not rerun for this
bounded report slice; no READY or production verdict is implied.

## Portfolio summary slice checkpoint — 2026-09-09

The portfolio report is implemented behind exact RST-012 readiness and available
from the report tabs. It defaults to one row per Projet and allows one row per
Partenaire instead. Activity filters apply before grouping; each full Activity
contributes once, and downloads retain every contributing Activity ID for scope
revalidation and immutable evidence. Machine-readable output contains only the
selected grouping level, without mixed subtotals.

The summary includes exact financial totals, Activity/Opération counts and
missing-spending counts. Null-only spending remains unknown; explicit zero stays
zero and mixed known/unknown sums remain identified by their counters. Pending
proposals remain separate from validated amounts and are further broken down
into draft/returned and submitted/prevalidated amounts, using the existing
states and exact addition. Child filters and invalid/empty grouping are rejected.

Spec review caught the initially missing proposal-state distinction. It was
reproduced with a failing unit contract, corrected, and checked with a real
draft of 20 FCFA plus a submitted proposal of 10 FCFA in one group. The first
browser run `mjl-test-20260909t173830-1245217-0bfaf6ce` was gracefully interrupted
before browser execution so this fix could be included; all its owned resources
were removed. It is not acceptance evidence.

Verification:

- `node tests/runner/run-suite.js phase3b-reports`: **43/43 passed** (the previous
  35 plus 8 portfolio checks), run `mjl-test-20260909t174216-1254985-e5d4922c`,
  366.7 seconds including setup and teardown. Tests cover both grouping modes,
  exact totals beyond native integer range, null/zero and proposal breakdown,
  pre-grouping filters, scope/role/invalid-filter denials, actual PDF/XLSX/CSV
  with immutable evidence, and mobile grouping without JavaScript.
- Shared before/after evidence is exactly equal. Artifact scanning passed;
  all owned containers, volumes and network were removed. Sanitized runtime
  logs contain no PHP fatal/parse or uncaught errors.
- `node tests/runner/run-suite.js unit`: **191/191 Node tests** and all PHP
  contracts passed. Three new portfolio contracts were observed failing before
  their respective implementations, then passing.
- `php -l` passed on all 15 changed/new PHP files; `git diff --check` passed.
- The 390px no-JavaScript preview and actual PDF body page were inspected:
  grouping controls and financial fields fit, exact amounts remain readable,
  and the pending proposal breakdown is explicit.

Standards/security: no open blocking findings. Spec: the proposal-state finding
is resolved, with no outstanding finding for this slice. Existing projection,
renderer, download form, authorization and disposable-factory boundaries are
reused; no new schema, persistence or runtime dependency was added.

The full phase remains IN_PROGRESS. The audit report, audit/chronology work,
dashboards, full-scale/performance checks, broader aggregate gates, expanded
human accessibility and guarded cutover remain pending. Aggregate npm test,
test:verify, test:e2e, full-phase and cutover commands were not rerun for this
bounded slice; no whole-phase READY or production verdict is implied.

## Complete audit report slice checkpoint — 2026-09-09

The complete audit report is implemented for Validator/Admin behind exact
RST-012 readiness. The existing audit menu route delegates to it only after that
schema is present; the shared Phase 3A audit page remains unchanged. Business
reports remain denied to Admin, and Agent/Supervisor cannot access complete audit.

The finite projection registry in `lib/mjl_audit_projection.lib.php` covers all
42 currently emitted actions and their payload variants, including native
cancellation, reopening, reference changes and both assignment-removal shapes.
It preserves historical IDs, references, revision/target version and actor
snapshots without current-record joins. Missing fields in partial after-snapshots
mean “Non enregistré”, not deletion; explicit null, empty text and zero remain
distinct. Reference before/after wrappers become proper scalar changes. French
field/action labels and finite automatic cause labels accompany the stored codes.

Historical filters and a stable 50-event cursor scope previews. PDF/XLSX/CSV
include all matching events within the existing resource limits and exclude
their own generation event. Audit exports retain empty Activity scope even when
filtered to an Activity. Complete scalar values are redacted before numbered
4000-character continuation rows. Unknown actions, extra/malformed payload
fields or unsupported causes leave details unavailable in preview and refuse a
complete export without success evidence. Previously unrecorded history cannot
be reconstructed by this projection.

Independent standards/security and specification reviews found two gaps: quoted
credentials containing spaces could evade the legacy sanitizer, and automatic
causes needed explicit French labels. Both were fixed and covered by unit
contracts; no blocking review finding remains for this slice. Existing report
owner, renderers, budgets and disposable fixture boundaries are reused, with no
new schema, persistence or runtime dependency.

Verification:

- `node tests/runner/run-suite.js phase3b-reports`: **55/55 passed**, including
  12 audit checks, run `mjl-test-20260909t181531-1322001-0119a47c`, 390.7 seconds
  including setup and teardown. Native cancellation/reopening histories,
  Validator/Admin exports, actual PDF/XLSX/CSV and immutable hashes, role/entity
  denials, historical filters, 57-event cursor coverage, null/zero, quoted
  credential redaction, continuation rows and unsupported-event refusal passed.
- Shared before/after evidence is exactly equal. Artifact scanning passed;
  all owned containers, volumes and network were removed. Sanitized runtime
  logs contain no PHP fatal/parse or uncaught errors.
- `node tests/runner/run-suite.js unit`: **197/197 Node tests** and all PHP
  contracts passed. The audit projector includes six targeted contracts with
  the initial missing implementation observed failing before implementation.
- `php -l` passed on all 18 changed/new PHP files; `git diff --check` passed.
- The actual PDF body and 390px no-JavaScript preview were inspected. Historical
  metadata and field changes remain readable; null and exact zero remain distinct.

The phase remains IN_PROGRESS. Ordinary Activity chronology, dashboards and
navigation, full-scale/performance checks, broader aggregate gates, expanded
human accessibility and guarded cutover remain pending. Aggregate npm test,
test:verify, test:e2e, full-phase and cutover commands were not rerun for this
bounded slice; no whole-phase READY or production verdict is implied.

## Activity chronology slice checkpoint — 2026-09-10

Activity detail and review pages now present contextual French summaries for
execution changes, cancellation/reopening requests and decisions, assignment
changes, automatic execution transitions and single-Activity business exports.
Explicit zero, missing spending and multiline observations retain their meaning;
actor snapshots and displayed details use the existing whole-value redaction.
No raw audit JSON or technical payload is exposed. Assignment removal without a
recorded name falls back to the captured Agent identifier, without current-user
joins. Automatic future/overdue and active/ended assignment states have explicit
French labels.

The loader rechecks current Activity read access and active entity, with a
current-assignment predicate for Agents. It reads at most 51 events, displays 50,
and uses an Activity-scoped immutable event anchor with `(event_date, rowid)`
ordering. Detail and review navigation preserve their parent route. The event and cursor-anchor queries
each have a five-second statement limit, and combined event detail payloads over
65,536 bytes are withheld before PHP buffering. Unknown/malformed or oversized
details have an explicit unavailable state. Multi-Activity and audit exports
remain outside ordinary chronology; captured export scope is checked as well as
the producer’s Activity linkage.

Standards/security review: the missing future/overdue labels were fixed with a
failing/passing contract; no outstanding finding remains. Spec review: the
cancellation-driven assignment variant needed captured-ID fallback and French
active/ended labels; both were reproduced, fixed and verified. Existing
presentation, redaction, scope, list and disposable-factory boundaries are reused;
no schema, persistence, runtime dependency or core modification was added.

Verification:

- `node tests/runner/run-suite.js phase3b-reports`: **63/63 passed**, including
  all eight chronology checks, run `mjl-test-20260910t121116-86187-45c60cd2`,
  **502.1 seconds** including setup and teardown. Coverage includes native
  execution/request/cancellation history, assignment identification and immediate
  access revocation, zero/null/redaction, single versus multi-Activity/audit
  exports, 57-event cursor traversal with an event appended between pages,
  review-route preservation, invalid/foreign cursors, unavailable details,
  automatic causes, and mobile navigation without JavaScript.
- Shared before/after evidence is exactly equal. Artifact scanning passed;
  every owned container, volume and network was removed. Sanitized runtime logs
  contain no PHP fatal/parse, uncaught or PHP warning entries.
- `node tests/runner/run-suite.js unit`: **201/201 Node tests** and all PHP
  contracts passed, including four new chronology presentation contracts.
- `php -l <file>` passed for all **20 changed/new PHP files**, selected from
  `git diff --name-only` plus `git ls-files --others --exclude-standard`.
  `git diff --check` and JavaScript syntax checks passed.
- The 390px no-JavaScript chronology screenshot was inspected: historical
  metadata, multiline changes and pagination remain readable without overflow.

The first run `mjl-test-20260910t120122-45191-34fc7206` passed all eight chronology
checks but exposed a date-dependent audit test (60 passed, one failed, two
skipped). The test used September 9 even though its audit event was recorded on
September 10. It now filters using the event’s captured date, independently of
the command’s fixed business date. That run’s owned Docker resources were
confirmed removed; the artifact scanner removed its contaminated failure
capture, which was not reconstructed. It is not a passing gate. The durable
clock-seam lesson is recorded in `tasks/lessons.md`.

The phase remains IN_PROGRESS. Dashboards/navigation, full-scale/performance
checks, broader aggregate gates, expanded human accessibility and guarded
cutover remain pending. Aggregate npm test, test:verify, test:e2e, full-phase and
cutover commands were not rerun for this bounded slice; the focused combined
report/chronology gate is the current affected-surface evidence. No whole-phase
READY or production verdict is implied.

## Full uncommitted-work review before commit — 2026-09-10

The user requested review of all changes since `4f74b4c`, followed by splitting
and committing all work. The review covered all 52 changed/new files, including
untracked source, canonical decisions, the report backend and schema, every
report route, chronology, fixtures, tests and runner integration. Independent
Standards/security and Spec audits covered the full implemented scope.

Standards/security: one high-severity finding, resolved. The CSV renderer only
checked `fputcsv() === false`, but a full filesystem can return a positive
partial byte count even while `fflush()` succeeds. A child-process file-size
limit reproduced truncation on the final row. The renderer now serializes each
bounded row in memory and requires the exact complete byte count from the file
write; partial writes raise `RENDER_FAILED` before export evidence is committed.
The failing regression was observed passing after the fix. The reviewer
confirmed the fix; no outstanding Standards/security finding remains.

Spec: one medium-severity finding, resolved. Actual equal spent/authorized
amounts project zero variance with the canonical human display `-`. XLSX was
storing that as text. It now stores numeric zero and uses a zero-section number
format displaying the dash. A regression through the actual Opération
projection and an actual generated workbook both verify value, type and format.
The reviewer confirmed the fix; no outstanding Spec finding remains within the
implemented scope.

Final verification before commit:

- `node tests/runner/run-suite.js unit`: **203/203 Node tests** and all PHP
  contracts passed, including both newly reproduced export regressions.
- `node tests/runner/run-suite.js phase3b-reports`: **64/64 browser tests passed**,
  run `mjl-test-20260910t124441-161880-a3061d70`, **493.9 seconds** including
  setup and teardown. The additional check reads the actual XLSX zero cell and
  its number format; all earlier report/chronology checks remain green.
- Shared before/after evidence is exactly equal. Artifact scanning passed;
  all owned Docker resources were removed. Runtime logs contain no PHP
  fatal/parse/uncaught/warning entries.
- `php -l <file>` passed on all 20 changed/new PHP files. JavaScript syntax and
  `git diff --check` passed. A changed-file private-key/token pattern scan found
  no matches; this is bounded evidence, not a universal secret-detection claim.

The commits separate approved scope/decisions, backend projections/schema/export
integrity, guarded pages/disposable acceptance, and verification documentation.
No shared cutover or production action is included. Dashboards/navigation,
full-scale benchmarks, full-phase/aggregate verification, human accessibility
and cutover remain pending. Aggregate and full-phase commands were not rerun:
the affected export and chronology surfaces use the focused combined gate, and
the full-phase unfinished guard remains intentional.

## Dashboard/navigation slice — implementation 2026-09-10

User-selected boundary: this slice only; full-phase validation, human review
and cutover remain pending. Accueil leads with financial indicators, then
workflow counts, permitted actions and alerts. Readiness remains exact RST-012,
so the shared Phase 3A tenant is unchanged. No schema installation or cutover
was performed.

The first dashboard check failed on the absent financial overview and then
passed after implementation. A five-flow disposable browser run subsequently
passed, covering financial meaning, role navigation, filter links, stale-request
closure and mobile forced-colors/no-JavaScript behavior. Independent Standards
and Spec reviews identified and led to corrections for Project labels, proposed
amount labels, request-filter composition, draft abandonment after start, and
the request source budget. The abandonment predicate was observed failing and
then passing through the public eligibility projection. Final combined
report/chronology/dashboard verification passed as recorded below.


### Slice validation completed — 2026-09-10

- `npm run test:phase3b-monitoring`: **79/79 passed** (15 dashboard/navigation
  cases plus 64 report/chronology regressions), run
  `mjl-test-20260910t161750-372637-5329ad95`, **594.7 seconds** including setup
  and teardown. All source-failure, role-change, 50/51-row, assignment removal,
  foreign-entity, no-JavaScript, keyboard, readiness and filter cases executed.
- The runner's `phase3b-monitoring-shared-evidence.json` has exactly equal
  before/after source, document, database and resource evidence. Artifact
  scanning passed; the run's containers, network and three volumes were removed.
  Runtime logs contain no PHP warning, fatal, parse or uncaught-error entries.
- `npm run test:unit`: **210/210 Node tests** and all PHP contracts passed.
  `php -l <file>` passed for every PHP file listed by
  `git diff-tree --no-commit-id --name-only -r bcba069` (13 files).
  `node --check tests/e2e/phase3b-monitoring.spec.js` and `git diff --check` passed.
- Populated dashboard captures at 390/768/980/1024/1366 pixels were inspected,
  together with the 390-pixel no-JavaScript, reduced-motion, forced-colors view.
  Cards, amounts and navigation remain readable without horizontal clipping;
  keyboard menu/Escape/focus and viewport overflow assertions passed.
- Standards/Security and Spec reviews have no outstanding actionable finding.
  Design and full-feature checks pass within this slice's technical boundary.
  This is not signed human accessibility approval.

Validation corrected test setup only after implementation commit `bcba069`:
a dedicated contributor transfers current assignment through the guarded UI
before changing role; inactive-reference assertions use exact stored fixture
labels; the request Type dropdown is selected by accessible combobox name;
and Partenaire/Projet fixture keys are distinct across reference collections.
The preceding complete runs reached 70, 72, 75 and 76 passes before these
fixture/locator failures; none is represented as a passing acceptance gate.
Interrupted runs have no usable final acceptance result. Orphan resources from
runs `20260910t133027`, `20260910t145138` and `20260910t151240` were explicitly
removed once their runner processes were confirmed absent.

Phase 3B remains **IN_PROGRESS**. Whole-phase/aggregate validation, scale and
performance acceptance, signed human accessibility review and guarded shared
cutover were deliberately not run in this slice. The shared tenant retains
Phase 3A behavior; no persistent sample data, shared migration or push occurred.

## Scale and aggregate validation checkpoint — 2026-09-10

`npm run test:phase3b-performance` passed in 1400.3 seconds against 1,000
Activities, 10,000 Operations and 50,000 audit events. All 13 populated-page
latency cases met p95 ≤2 seconds, and all 15 measured report/format selections
met the 30-second export budget. Maximum generator memory was 68 MiB with a
256 MiB PHP limit. These selected exports do not establish maximum-row
throughput for every format.

`npm test` passed in 2535.9 seconds: 211 Node tests, PHP contracts, 192 browser
tests, schema/renderer probes and a repeated scale benchmark. The aggregate's
worst p95 was 1.72 seconds. `npm run test:verify` separately passed in 233.6
seconds. Shared before/after evidence matched and all three successful runs
completed disposable teardown. The aggregate now includes the existing RST-012
probe immediately before monitoring tests, and containing aggregate modes
enforce shared-state equality.

See [the validation record](mjl-phase-3b-validation-2026-09-10.md) for image IDs,
PHP/host limits, workload distribution, measured export rows, raw evidence paths
and interrupted attempts. Standards/Security and benchmark Spec reviews have no
outstanding actionable finding.

Phase 3B remains **IN_PROGRESS**. The explicit unfinished-integration guard
remains for expanded full-pipeline failure/recovery coverage, remaining
authorization-race orders, deliberate discovery-failure controls and disposable
cutover rehearsals. Signed human accessibility and guarded shared cutover remain
pending. No persistent sample data, shared migration or push occurred.


## Export recovery and authorization checkpoint — 2026-09-11

`npm run test:phase3b-monitoring` passed **111/111** checks in 751.8 seconds,
including 32 new export recovery and authorization cases. `npm run test:unit`
passed 211 tests plus PHP contracts. Shared before/after evidence was identical,
PHP runtime diagnostics were clean, artifact scanning passed and the disposable
tenant was fully removed.

The new suite exercises real file-open/unlink failures, short hashing reads,
renderer and source/row/cell/byte/artifact limits, actual low-memory and deadline
failures, uncertain COMMIT acknowledgement with both committed and uncommitted
outcomes, interrupted PDF delivery and real SIGKILL orphan recovery. Same-process
checks expose descriptor/lock leaks before shutdown can conceal them. Fourteen
races cover both authorization orderings for assignment removal, account/role/
entity/Admin changes, Activity cancellation and cross-Agent draft abandonment.
Commit-first cases observe a real database lock wait and retain exact committed
artifact bytes after revocation. Two protected internal seams enable these
checks without changing the public export interface or adding request fault flags.

See [the recovery validation record](mjl-phase-3b-recovery-validation-2026-09-11.md)
for evidence, corrected diagnostic attempts, review outcomes and skipped gates.
The earlier failure/recovery and remaining authorization-race gaps are covered.
Phase 3B remains **IN_PROGRESS**: deliberate discovery-failure controls,
disposable cutover rehearsals, signed human accessibility and guarded shared
cutover remain pending. The explicit incomplete-phase guard remains. No shared
migration, persistent seed or push occurred.
