# Phase 3B final technical validation — 2026-09-11

Authority: `docs/mjl-authoritative-decisions.md`, DEC-056, and
`docs/mjl-phase-3b-monitoring-plan.md`.

## Required gates

- `npm run test:phase3b` passed from a fresh disposable start in
  `mjl-test-20260911t154645-998165-13a8b538` in 2467.4 seconds. It passed the
  schema and renderer probes, 111 monitoring/report/recovery browser checks,
  the scale benchmark, and the complete RST-012 wrapper matrix: clean install,
  repeated activation, guarded-migration refusal, interrupted-DDL convergence,
  malformed-state refusal, post-restart containment, empty rollback,
  evidence-preserving containment, and cleanup.
- `npm test` passed in `mjl-test-20260911t175944-1720195-dcd18538` in 2494.7
  seconds. It passed 214 Node/static checks and PHP contracts, 223 functional
  browser checks across the maintained batches, the scale benchmark case, and
  all schema/renderer/Admin-owner probes.
- `npm run test:verify` passed in
  `mjl-test-20260911t184133-1891349-0abe5acc` in 175.8 seconds. The exact
  RST-002B assignment and Phase 3A execution schema verifiers passed.

All three runs recorded identical shared before/after evidence and removed
their containers, network, and three disposable volumes.

## Aggregate scale evidence

The aggregate benchmark used 1,000 Activities, 10,000 Operations, and 50,000
audit events. All thirteen authenticated latency cases met p95 ≤2 seconds; the
worst p95 was 1118.5 ms. All fifteen PDF/XLSX/CSV selections met the 30-second
generation criterion; the slowest generation was 2894.7 ms. Maximum generator
memory was 68 MiB with a 256 MiB PHP limit.

Raw measurements are retained under the aggregate run at
`playwright/zz-phase3b-performance-ins-84c0b--export-time-memory-budgets/performance.json`.

## Corrections made during aggregate validation

The first aggregate attempt exposed predecessor assertions that still targeted
former table markup and filter responses. Those assertions now use the current
accessible Activity/Opération cards, canonical filter names, and current French
empty/error states. A real filter-validation defect was also corrected: control
characters are rejected before trimming, so a leading or trailing control
character cannot be normalized into accepted input.

The corrected Activity execution batch passed 29/29 in
`mjl-test-20260911t165052-1303938-ba3f495a`, and the final aggregate passed the
same regression coverage. `php -l custom/mjlfinancement/lib/mjl_monitoring.lib.php`,
Node syntax checks for the changed browser specifications, and
`git diff --check` passed.

A diagnostic `npm run test:phase2` attempt did not reach browser tests because
fresh module activation now installs RST-012 before that predecessor-only runner
tries to apply RST-006A. This compatibility alias is outside the Phase 3B gate;
it is recorded as follow-up test-runner debt and is not represented as passing.

## Review and verdict boundary

Security review passed with no open blocker after the raw control-character fix.
Design review passed the technical gate and confirmed the existing French-first,
responsive, keyboard, forced-colors, reduced-motion, and output evidence; it
does not substitute for the human accessibility signature. Full-feature review
found the implemented financial, workflow, authorization, export, recovery,
installation, discovery, isolation, and performance coverage complete.

The two-axis review found one invalid decision-status label and two permissive
compatibility assertions. The status was restored to the register's defined
`APPROVED` vocabulary, and the RST-012 assertions now require the canonical
French error and `validation_status` pagination key. The broken standalone
Phase 2 compatibility alias is recorded in the current gap and coverage docs.
No Standards, Spec, Security, Design, or full-feature blocker remains.

Verdict: `PHASE_3B_READY_WITH_NOTES`. The sole phase-readiness note is the
unsigned human accessibility review. The guarded shared cutover also remains
unexecuted and requires explicit approval. This verdict authorizes no production
release, shared migration, persistent sample data, or push.
