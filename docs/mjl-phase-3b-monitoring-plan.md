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
