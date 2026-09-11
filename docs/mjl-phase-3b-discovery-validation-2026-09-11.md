# Phase 3B test-discovery validation — 2026-09-11

Authority: DEC-056 and the discovery requirement in
`mjl-phase-3b-monitoring-plan.md`: a deliberately failing Phase 3B test must
fail both focused and aggregate gates.

## Implementation

The existing recovery spec throws the distinctive
`MJL_PHASE3B_DISCOVERY_CONTROL` error only when
`MJL_PHASE3B_DISCOVERY_FAILURE=1`. Guarded Playwright global setup still runs
first. Playwright stops after this first deliberate failure. With the flag
unset, normal execution and failure handling are unchanged.

The control uses the public npm commands, existing suite mappings, disposable
provisioning, shared-state comparison, artifact scanning and mandatory
teardown. It adds no alternate runner, production fault flag or retention path.

## Evidence

| Control | Command | Result |
| --- | --- | --- |
| Focused negative | `MJL_PHASE3B_DISCOVERY_FAILURE=1 npm run test:phase3b-monitoring` | Exit 1 on the exact deliberate error after 36 passing tests; 329.1 seconds |
| Aggregate negative | `MJL_PHASE3B_DISCOVERY_FAILURE=1 npm test` | Exit 1 on the exact deliberate error after 211 unit tests, PHP contracts, schema/renderer/Admin probes and 148 passing browser checks; 972.6 seconds |
| Focused positive | `npm run test:phase3b-monitoring` | 111/111 passed; exit 0; 779.3 seconds |

Focused negative run: `mjl-test-20260911t120250-260722-d9fba099`.
Aggregate negative run: `mjl-test-20260911t120908-287481-965e704a`.
Focused positive run: `mjl-test-20260911t122549-392945-9d65a0d8`.

All three evidence files contain identical before/after shared state. Their
compose logs contain no PHP warning, fatal, parse or uncaught-error match.
Artifact scanning passed, and no containers, volumes or networks remain. The
aggregate's 148 passing browser checks comprise batches of 29, 13, 18 and 52,
then 36 Phase 3B checks. The exception output repeats the final 36-test summary;
it is counted once.

A negative control qualifies only when the exact deliberate error and nonzero
exit occur with successful state comparison, artifact scanning and teardown.
An unrelated setup or cleanup failure does not qualify.

## Diagnostic attempt

Initial run `mjl-test-20260911t115744-246613-31e66212` reached the deliberate
failure in the Activities spec, but Playwright copied an existing configured
development credential from that source into error context. The artifact
scanner correctly removed the entire evidence tree. Teardown completed, but
this attempt is excluded from the proof. Moving the hook to the existing
credential-free recovery spec fixed the artifact without weakening scanning.

Automatic approval review rejected an attempted control with
`MJL_TEST_RETAIN=1` because it requested retention of a failed disposable
tenant. The executed controls omitted that flag and used mandatory teardown.

Independent Standards/Security and Spec reviews found no actionable issue in
the control design before execution. Final review found no open findings.
JavaScript syntax and diff checks passed.

## Remaining phase work

Phase 3B remains **IN_PROGRESS**. Disposable cutover wrapper/rehearsals remain,
including interrupted-DDL convergence, empty rollback and evidence-preserving
containment. Signed human accessibility and guarded shared cutover also remain
pending. The incomplete-phase guard remains.

The aggregate negative control intentionally stops before the scale benchmark;
it is failure-propagation evidence, not a new successful aggregate/performance
result. The September 10 aggregate/benchmark and September 11 recovery record
remain separate evidence. No shared migration, persistent seed or push
occurred.
