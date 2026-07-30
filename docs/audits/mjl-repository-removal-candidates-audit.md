# MJL Repository Removal Audit

## Outcome

Disposition: `CLEANUP_EXECUTED_WITH_EXPLICIT_KEEPS`

The cleanup was executed on 30 July 2026 from baseline
`15d94eb83726654fcea008c20b2f82922501185b`.

The project owner confirmed:

- committed Git history is sufficient archival storage for removed historical
  documentation;
- the top-level sample-data package must be kept for now;
- the ignored Playwright result may be removed when it is useless.

No application code, database state, Dolibarr documents, approved-v2 snapshot,
sample data, migration, test, or skill was removed.

## Removed Tracked Documentation

The following 12 tracked documents were removed after their active references,
valid chronology, open assumptions, current-state conclusions, and remaining
release/accessibility gates were consolidated:

1. `docs/audits/mjl-navigation-design-full-audit.md`
2. `docs/mjl-ui-navigation-design-target-specification.md`
3. `docs/design-system/TRANSFER-AUTHORIZATION.md`
4. `docs/implementation/mjl-design-system-v2-assumption-resolution.md`
5. `docs/implementation/mjl-design-system-v2-component-mapping.md`
6. `docs/implementation/mjl-design-system-v2-documentation-transfer-report.md`
7. `docs/implementation/mjl-design-system-v2-gap-matrix.md`
8. `docs/implementation/mjl-design-system-v2-implementation-readiness-audit.md`
9. `docs/implementation/mjl-design-system-v2-implementation-readiness-report.md`
10. `docs/implementation/mjl-design-system-v2-phase1-implementation-report.md`
11. `docs/implementation/mjl-design-system-v2-phase2-implementation-report.md`
12. `docs/implementation/mjl-design-system-v2-phased-implementation-plan.md`

These files were point-in-time audits, executed plans, superseded phase
reports, duplicate governance records, or pre-approved-v2 navigation evidence.
Their original committed contents remain recoverable from Git history.

## Consolidation And Reference Fixes

The cleanup updated:

- `docs/mjl-docs-index.md` to remove obsolete active entries and register the
  surviving current evidence;
- `docs/design-system/README.md` to retain `PD-DEC-029`/`PD-DEC-030`
  chronology, record separately authorized implementation through Phase 3,
  and preserve current release blockers;
- `docs/design-context.md` to point to the approved-v2 design entry point
  instead of the deleted pre-v2 target specification;
- `docs/mjl-current-vs-target-gap-analysis.md` to record where durable
  conclusions, assumptions, and open blockers now live;
- `docs/design-system/mjl-v2-phase-3d-ux-ui-convergence-implementation-prompt.md`
  to remove its dependency on the deleted standalone transfer authorization.

The immutable approved-v2 package was not edited.

## Candidate Preserved After Revalidation

`docs/implementation/mjl-design-system-v2-phase3-implementation-report.md` was
not removed.

The removal audit originally classified it using an older version that said
verification was superseded. Before deletion, commit `15d94eb` refreshed the
file with current post-remediation evidence:

- exact reviewed pre-evidence commit;
- three clean fixed-point reviews;
- 198/198 complete E2E result;
- focused Phase 3 and finance regression results;
- current integrity-debt counts and explanation;
- remaining accessibility, operations, and production gates.

It is now the current consolidated Phase 1–3 implementation evidence. It
remains evidence only, not product authority, deployment authorization, or
release approval.

## Local Noise Removed

`test-results/.last-run.json` was removed after revalidation showed it was the
only remaining file under `test-results/`, was 45 bytes, and recorded:

```json
{
  "status": "passed",
  "failedTests": []
}
```

The file was ignored, reproducible Playwright metadata and contained no failure
trace needed for diagnosis. It is not recoverable from Git because it was
ignored, but Playwright recreates it on a later run.

## Sample Data Explicitly Kept

The full `mjl_dolibarr_poc_sample_data/` directory and the fallback in
`custom/mjlfinancement/lib/mjl_sample_data.lib.php` remain unchanged by owner
decision.

This includes:

- 19 files byte-identical to module fixture counterparts;
- two divergent root CSVs:
  `seed/fixed_reports.csv` and `seed/fund_receipts.csv`;
- `README_SAMPLE_DATA.md`;
- `TEST_SCENARIOS.md`;
- `sample_data_summary.json`.

The package remains referenced by `AGENTS.md`, `docs/mjl-docs-index.md`,
`tests/manual/phase2-accessibility-fixture-manifest.md`, and the sample-data
fallback. Duplication may be reconsidered only in a separately authorized,
fixture-tested cleanup.

## Explicit Keeps

- `docs/design-system/approved/v2/**`
- `docs/implementation/mjl-design-system-v2-phase3-implementation-report.md`
- `docs/implementation/mjl-design-system-v2-phase2-manual-accessibility-evidence.md`
- `tests/manual/**`
- `mjl_dolibarr_poc_sample_data/**`
- `custom/mjlfinancement/sample_data/**`
- `data/**`
- `node_modules/**`
- application source, SQL migrations, smoke scripts, E2E tests, local skills,
  agent-support documentation, and durable project memory

`data/**` remains Docker-managed state and must not be deleted file by file.

## Verification Scope

This was documentation and ignored-local-output cleanup. Verification consists
of:

- confirming every removed tracked path was committed before deletion;
- checking that active files no longer depend on deleted paths;
- verifying that the approved-v2 snapshot and sample-data trees are unchanged;
- checking the final Git diff and whitespace;
- confirming the ignored passing-run result is absent.

Application E2E, database, bootstrap, seed, smoke, and deployment commands are
not required because no application, fixture, schema, or runtime behavior was
changed.

## Verification Result

- Deleted tracked documents: 12.
- Dangling references to deleted document basenames outside this cleanup
  record: none.
- Approved-v2 and sample-data diffs: none.
- Current Phase 3 report: present.
- Remaining files under `test-results/`: none.
- Tracked diff whitespace check: passed.
- No-index whitespace checks for this audit and the pre-existing untracked
  Phase 3D prompt: passed.
