# Phase 3B validation — 2026-09-10

Authority: `docs/mjl-authoritative-decisions.md` and the approved `docs/mjl-phase-3b-monitoring-plan.md`.

## Scale and performance

`npm run test:phase3b-performance` passed in 1400.3 seconds, including setup and teardown, in `mjl-test-20260910t172235-552731-7168d10c`. The populated workload contained 1,000 Activities, 10,000 Operations and 50,000 audit events before measured requests.

Activities were created through the existing command owners: 200 drafts, 200 submitted, 200 prevalidated and 400 validated, with 200 additional assignments. Across 200 validated Activities, five Operations have missing spending, three have explicit zero spending and two are completed with spending; one zero-spending Operation per Activity is cancelled. Start dates are 2026-09-05 and end dates 2032-12-31. The setup clock is 2026-09-04. Audit padding uses the transactional append-only writer in batches of 500.

Environment:

- PHP 8.2.31, memory limit 256M.
- Host: linux/x64, Intel(R) Core(TM) i5-4570T CPU @ 2.90GHz, 4 logical CPUs, 12427636736 bytes RAM.
- Dolibarr image: `sha256:7793a238fd94809309fa9143513b2ce19e9393458d897d719ecc97851df652fd`.
- MariaDB image: `sha256:068cbf783463efa481f20561812878dbae91d3dc6e9649999bb986a7fc3334b2`.

One warm-up preceded 20 serial authenticated samples per role/route. Timing includes response-body receipt; populated-content and unavailable-state checks run outside the timed interval. p95 uses the nineteenth ordered sample.

| Role | Route | p95 (ms) |
| --- | --- | ---: |
| agent | `index.php` | 484.8 |
| agent | `activities.php` | 1137.0 |
| agent | `operations.php` | 1578.3 |
| agent | `alerts.php` | 637.6 |
| supervisor | `index.php` | 626.8 |
| supervisor | `activities.php` | 966.5 |
| supervisor | `operations.php` | 1124.4 |
| supervisor | `alerts.php` | 690.9 |
| validator | `index.php` | 869.7 |
| validator | `activities.php` | 866.9 |
| validator | `operations.php` | 1184.2 |
| validator | `alerts.php` | 582.8 |
| validator | `reports.php?report=audit` | 675.4 |

All 13 cases meet the 2,000 ms limit.

Each export uses the actual generator and an actual authenticated HTTP download. Checks require the audited row count, descriptor hash, attachment filename/MIME, generation and HTTP times under 30 seconds, and artifact size within 20 MiB. CLI peak memory covers the complete generator; the subsequent evidence lookup is outside the measurement.

| Report | Format | Audited rows | Generation (ms) | HTTP (ms) | Peak memory (MiB) | Artifact bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| activities | pdf | 100 | 1123.9 | 1238.9 | 32 | 183993 |
| activities | xlsx | 1000 | 4390.9 | 2741.9 | 68 | 79027 |
| activities | csv | 1000 | 859.7 | 615.0 | 48 | 232157 |
| operations | pdf | 100 | 466.8 | 445.3 | 28 | 150428 |
| operations | xlsx | 1000 | 1514.3 | 1614.1 | 38 | 48675 |
| operations | csv | 1000 | 297.1 | 313.0 | 24 | 188909 |
| activity_detail | pdf | 12 | 401.4 | 261.9 | 28 | 111346 |
| activity_detail | xlsx | 12 | 299.0 | 236.3 | 18 | 12672 |
| activity_detail | csv | 12 | 210.2 | 249.1 | 16 | 4603 |
| portfolio | pdf | 1 | 821.7 | 708.9 | 48 | 105596 |
| portfolio | xlsx | 1 | 626.0 | 645.5 | 40 | 9097 |
| portfolio | csv | 1 | 595.6 | 612.3 | 36 | 2485 |
| audit | pdf | 100 | 672.3 | 629.9 | 30 | 203617 |
| audit | xlsx | 1000 | 2850.7 | 2917.7 | 54 | 97299 |
| audit | csv | 1000 | 400.2 | 402.5 | 28 | 265243 |

These are explicitly filtered export selections against the full database. Operations and audit XLSX/CSV samples contain 1,000 rows; they do not establish throughput at the 10,000-row cap. The one-row portfolio covers all 1,000 Activities. Exact filters and raw samples are recorded in the run’s `playwright/zz-phase3b-performance-ins-84c0b--export-time-memory-budgets/performance.json`.

Shared source, database, documents and resource evidence matched exactly. Runtime logs contained no PHP warning, fatal, parse or uncaught-error entries. The runner removed both containers, the network and all three volumes.

## Standalone verifier

`npm run test:verify` passed in 233.6 seconds in `mjl-test-20260910t171811-540711-8a02fbdd`. Shared before/after evidence matched; teardown completed.

## Aggregate validation

`npm test` passed in 2535.9 seconds in `mjl-test-20260910t174746-600057-bd787bf5`: 211 Node tests, all PHP contracts, the RST-002B/Phase 3A schema checks, 192 browser tests (29 + 13 + 18 + 52 + 79 + 1 benchmark), and the Phase 3B export-schema/renderer/Admin-owner probes.

The final benchmark created a fresh 1,000-Activity / 10,000-Operation cohort alongside earlier regression data and brought the audit history to 50,000 events. All 13 latency cases passed; the worst p95 was 1723.8 ms. All 15 export combinations passed, with maximum generation time 2754 ms, HTTP delivery 2808.6 ms and peak generator memory 68 MiB. Raw results are in this run’s `playwright/zz-phase3b-performance-ins-84c0b--export-time-memory-budgets/performance.json`.

Shared source/database/documents/resource evidence matched exactly. Artifact scanning passed, runtime logs were free of PHP warning/fatal/parse/uncaught errors, and the complete disposable tenant was destroyed.

The aggregate now activates RST-012 immediately before the Phase 3B browser batch. Its existing schema probe uses an explicitly empty audit selection, so earlier regression history is preserved. `all`, `e2e` and `verify` now enforce shared-state equality, as the focused Phase 3B gates already did.

`php -l tests/fixtures/phase3b-performance-fixture.php`, `php -l tests/fixtures/phase3b-schema-probe.php`, `node --check tests/e2e/zz-phase3b-performance.spec.js`, `node --check tests/runner/run-suite.js` and `git diff --check` passed. Standards/Security and benchmark Spec reviews have no outstanding actionable finding.

## Interrupted attempts

Runs `mjl-test-20260910t164418-443360-f06370a0` and `mjl-test-20260910t165411-465541-3c74c0db` were stopped during setup to adjust the fixture allowance and address review findings; teardown completed. Run `mjl-test-20260910t170229-483822-8a268ee1` lost its runner session without a final result. After confirming the runner was absent and checking resource ownership, its exact two containers, three volumes and network were removed. None of these attempts counts as passing acceptance evidence.

## Remaining whole-phase requirements

Phase 3B remains IN_PROGRESS. The explicit unfinished-integration guard remains. Outstanding executable proofs identified in the whole-phase audit are:

- Full-pipeline low-memory/deadline and renderer/open/hash/unlink failures, ambiguous commit, interrupted transfer and actual killed-worker orphan recovery. Existing audit/record-insertion rollback tests do not establish all of these cases.
- Commit-before-revocation ordering and remaining cross-Agent abandonment/cancellation races.
- A deliberately failing Phase 3B test that fails both focused and aggregate public commands.
- The disposable guarded cutover wrapper/rehearsals, interrupted-DDL convergence, empty rollback and evidence-preserving containment.

Signed human accessibility and guarded shared cutover remain pending. No push or shared cutover occurred.

The known-incomplete `npm run test:phase3b` command was not rerun after its implemented subgates passed; its deliberate guard necessarily rejects readiness while the requirements above remain unimplemented. Human accessibility and cutover checks were not run in this validation scope.
