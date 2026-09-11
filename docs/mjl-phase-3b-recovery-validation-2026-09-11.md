# Phase 3B export recovery and authorization validation — 2026-09-11

Authority: DEC-056 in `mjl-authoritative-decisions.md` and the failure/authorization requirements in `mjl-phase-3b-monitoring-plan.md`. This checkpoint closes the export recovery and authorization-race slice. Phase 3B remains **IN_PROGRESS**.

## Change

The export owner now has a protected spool factory, and the spool has a protected native read-open method. Production implementations perform the same construction/open operations as before. The public generation interface, file validation, authorization locks, atomic evidence transaction and delivery route are unchanged. There is no HTTP/configuration fault switch.

A sentinel-guarded disposable fixture supplies the fault implementations. The new `phase3b-export-recovery.spec.js` is discovered by Playwright and included in the Activities, reports, monitoring and containing aggregate batches.

## Recovery coverage

The 32 new checks cover:

- Real denied file open and unlink, filtered short read during hashing, oversized final artifact, and renderer failure after private output begins.
- CSV 10,001-row and PDF 501-row rejection, projected byte/cell limits, actual low PHP memory headroom, and the real 30-second deadline before publication and after commit.
- Lost COMMIT acknowledgement as a false return or exception after a real MariaDB commit, plus an uncommitted false return. No attempt replays the transaction; file delivery is withheld. Committed audit/export pairs survive; uncommitted pairs roll back.
- Actual SIGKILL of the PHP generator after private attempt/file creation. The next real export removes the 0700/0600 orphan under the generation lock.
- A real throttled HTTP download aborted by the client: received bytes are fewer than the recorded artifact length, while `GENERATED` evidence survives.
- A source-payload limit using an oversized immutable audit event in disposable entity 2, kept outside later entity-1 report and benchmark selections.

Failure probes inspect open spool descriptors and lock availability before PHP shutdown can conceal leaks, and verify transaction closure and restoration of session SQL budgets. Existing HTTP audit-insertion and export-record-insertion failure checks remain in the same batch.

## Authorization coverage

Fourteen cases exercise both revocation-first and commit-first ordering for assignment removal, deactivation, role change, native entity change, native Admin promotion, Activity cancellation and cross-Agent draft abandonment. Assignment and workflow mutations use their existing command owners. Account mutations use an unassigned reviewer and preserve database guards; native Admin promotion disables the business role atomically.

Commit-first cases observe a real InnoDB lock wait through the existing privileged read-only observer, release the export commit, wait for revocation to finish, and then verify the returned descriptor's byte count and SHA-256 against the immutable pair. Fresh generation respects the resulting access/scope. Revocation-first cases return no file and add no success pair.

## Verification

- `npm run test:unit`: **211 passed**, plus PHP contracts, 4.1 seconds on the final rerun after the incomplete-phase diagnostic update. An earlier user-service run also passed in 8.0 seconds. The initial sandboxed run stalled in a PHP subprocess and was stopped.
- `npm run test:phase3b-monitoring`: **111/111 passed**, 751.8 seconds including provisioning/evidence/teardown (9.5 minutes browser execution). Run `mjl-test-20260911t113709-170446-f125f370`.
- PHP syntax: `php -l custom/mjlfinancement/class/mjlexport.class.php`, `php -l custom/mjlfinancement/class/mjlexportspool.class.php`, `php -l tests/fixtures/phase3b-report-fixture.php`, and `php -l tests/fixtures/phase3b-export-recovery.php` passed.
- `node --check tests/e2e/phase3b-export-recovery.spec.js` and `git diff --check` passed.
- Independent Standards/Security and Spec reviews: no remaining actionable findings after fixture and lock-observer corrections.

The expected RED run `mjl-test-20260911t110717-52679-33b3dea5` passed 16 existing tests and failed the new open-failure check before the protected seams were connected. Run `mjl-test-20260911t111418-73851-d30cde54` passed 39 tests, then failed because the lock observer lacked PROCESS privilege; eight cases did not run. Both failed runs completed teardown and recorded identical before/after shared evidence. They are diagnostic results, not passing acceptance gates.

Run `mjl-test-20260911t112243-106703-0b8b25a6` passed 109 tests, then failed the client-abort test because curl throttled the POST upload before receiving a response; the source-limit case was skipped. The corrected test downloads a PDF at 1 KiB/s with a five-second client timeout. A temporary local HTTP probe confirmed partial download after HTTP 200 before the final real-PDF regression passed. That failed run also completed teardown with identical shared before/after evidence.

Final evidence: `test-results/runs/mjl-test-20260911t113709-170446-f125f370/phase3b-monitoring-shared-evidence.json` contains identical `before` and `after` objects, including protected source, shared database and documents. Its `compose.log` contains no PHP warning, fatal, parse or uncaught-error match. Artifact scanning and mandatory teardown passed; both containers, all three volumes and the network were removed. The command exited 0.

## Remaining work

The whole-phase gate continues to reject readiness. Deliberately failing discovery controls and disposable cutover rehearsals remain, including interrupted DDL convergence, empty rollback and evidence-preserving containment. Signed human accessibility and guarded shared cutover remain pending.

The aggregate `npm test`, separate `test:e2e`, `test:verify`, scale benchmark and intentionally incomplete `test:phase3b` were not rerun for this slice. The monitoring/report regression covers the changed export seam; schema, workload and report calculations are unchanged. The September 10 aggregate/performance record remains the latest evidence for those commands. No persistent seed, shared migration or push occurred.

`tasks/lessons.md` was evaluated; no new lesson was needed beyond the existing documented fixture and isolation rules.
