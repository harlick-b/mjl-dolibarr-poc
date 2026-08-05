# v3 Design Validation Report

Status: `APPROVED`

## Baseline

- Commit: `bc820e1e3e46acddfbd2d55878a6f78c0403d67d`
- Baseline unit suite: passed on 2026-08-04.
- The worktree already contained user changes. They are preserved and remain
  outside this design refinement.
- Existing modified areas include application routes, operational scripts,
  design audits, acceptance and deployment documentation, runner files,
  Playwright configuration, tests, and lessons memory.

## Migration ledger

| v2 artifact | Disposition | v3 destination or reason |
| --- | --- | --- |
| `PRODUCT.md` | Rebuilt | `PRODUCT.md` |
| `DESIGN.md` | Rebuilt | `DESIGN.md` |
| `MANUAL-REVIEW.md` | Rebuilt | `MANUAL-REVIEW.md` |
| `design-manifest.yaml` | Rebuilt | Repository-owned `design-manifest.yaml`; generated hashes were not copied. |
| `design-tokens/README.md` | Rebuilt | `design-tokens/README.md` |
| `design-tokens/tokens.json` | Rebuilt | `design-tokens/tokens.json` |
| `design-tokens/semantic-tokens.json` | Rebuilt | `design-tokens/semantic-tokens.json` |
| `component-inventory.md` | Rebuilt | `docs/design/component-inventory.md` |
| `design-assumptions.md` | Rebuilt | `docs/design/design-assumptions.md` |
| `design-decisions.md` | Rebuilt | `docs/design/design-decisions.md` |
| `design-validation-report.md` | Rebuilt | This report |
| `design-brief.md` | Consolidated | Durable direction is in `PRODUCT.md` and `DESIGN.md`. |
| `product-model.md` | Consolidated | Product authority remains in `docs/mjl-authoritative-decisions.md` and `CONTEXT.md`. |
| `interaction-flows.md` | Consolidated | Current flows remain in the functional map, screen inventory, and acceptance coverage. |
| `implementation-plan.md` | Retired | Executed plan material is not active documentation. |
| `skills-recommendation.yaml` | Retired | Recommendation-only generated material has no runtime authority. |

Useful provenance, accessibility assumptions, source-rights boundaries, and
anti-cloning decisions were retained in the manifest and v3 design documents.
The deleted v2 package is recoverable from Git commit
`e95927f816bb127914b432adb119e522c669cbc8`.

## Promotion gates

Promotion requires valid and fully resolvable tokens, exact scoped font
markup, functional CDN-blocked fallback, syntax-clean PHP and CSS endpoints,
task-owned tests passing, no new regression, active documentation updated, and
no stale v2 authority reference. Actual results are recorded only after each
command has run.

## Results

- `npm run test:unit`: passed, including v3 token resolution.
- PHP syntax checks: passed for the actions hook and both MJL CSS endpoints.
- Live local HTTP inspection: exact font markup present once on eligible
  browser documents; served CSS contained no PHP warning.
- Chromium live-font evidence: Inter rendered for semantic weights 400, 500,
  600, and 700 after `document.fonts.ready`, reproduced by
  `node tests/evidence/inter-font-live.js`.
- Chromium fallback evidence: with both Google origins blocked, a non-Inter
  platform fallback rendered and login/workspace journeys remained usable.
- `npm test`: passed 20 fast Node checks, all PHP/schema/workflow contracts,
  and 116/116 browser cases in disposable tenant
  `mjl-test-20260804t164805-1042186-0242d59b`.
- Disposable cleanup: containers, network, database volume, and document
  volume removed. Total supported-suite duration was 584.8 seconds.
- `npm run test:characterization`: passed 21/21 finance behavior cases in
  disposable tenant `mjl-test-20260804t170156-1112400-e56b0ea1`; all tenant
  resources were removed. Duration was 254.7 seconds.
- Final `npm run test:e2e`: passed 117/117 browser cases in disposable tenant
  `mjl-test-20260804t173241-1210006-5d7ea169`; all tenant resources were
  removed. Duration was 492.3 seconds.

The automated promotion verdict is `PASSED`. The implementation verdict is
`IMPLEMENTED_WITH_NOTES` because the human and production confirmations below
remain outside repository automation.

## Remaining confirmations

Production CSP, egress, and privacy configuration is unconfirmed. A future CSP
must allow `https://fonts.googleapis.com` in `style-src` and
`https://fonts.gstatic.com` in `font-src`, or the font source must be replaced
with an approved local pipeline. Manual accessibility, client content, and
operator production evidence remain release blockers.

## Remediation evidence, 2026-08-04

The five post-promotion findings were remediated without rewriting the
approved normative v3 artifacts. This section is an append-only evidence
record under the active-generation governance policy.

- Governance and privacy contract tests were introduced red, then passed
  after the active README and deployment checklist were updated.
- The approved authentication title role now renders at `24px/32px`, and the
  real project-list row with independently accessible actions uses the 44px
  interactive-row role at desktop and mobile widths.
- PHP syntax checks passed for `projects.php`, `mjl_app.css.php`, and
  `mjl_auth.css.php`. Both CSS endpoints returned HTTP 200 with a CSS content
  type and no PHP warning output.
- Live Google evidence passed: the stylesheet response returned HTTP 200;
  28 `@font-face` blocks covered semantic weights 400, 500, 600, and 700 with
  `font-display: swap`; three observed font responses completed with HTTP 200;
  all four semantic weights rendered as Inter. The blocked-CDN fallback also
  remained usable and rendered a non-Inter platform fallback.
- `npm run test:e2e` passed 118/118 browser cases in disposable tenant
  `mjl-test-20260804t185355-1472417-b0eb2dc3`; all tenant resources were
  removed. Duration was 728.7 seconds.
- `npm run test:characterization` passed 27/27 cases in disposable tenant
  `mjl-test-20260804t191057-1551394-27329b98`; all tenant resources were
  removed. Duration was 251.8 seconds. The run also corrected a stale
  characterization report key and actor-owned audit cleanup predicate.
- Final `npm test` passed 28 Node checks, all maintained PHP, schema, scope,
  workflow, export, and resilience checks, and 118/118 browser cases in
  disposable tenant `mjl-test-20260804t191522-1574161-b8fc9e1b`; all tenant
  resources were removed. Duration was 632.1 seconds.

The remediation verdict is `PASSED`. Manual accessibility and the existing
production CSP, egress, privacy, client-content, and operator confirmations
remain external release confirmations; no automated claim is made for them.

### Post-review closure evidence

- The two-axis review found one Standards false-pass risk and one Spec
  governance false-closure risk. Both were fixed and both reviewers confirmed
  that no task-owned finding remains.
- The governance contract now compares every protected normative v3 index
  blob with remediation base `ed0584f`, preserves the validation report's
  exact 4,377-byte historical prefix, and constrains any indexed report to the
  append-only worktree candidate.
- `npm run test:unit` passed all 7 unit files and maintained PHP contracts after
  the governance contract was strengthened. Duration was 0.8 seconds.
- A concurrent unconditional Apache `Header` directive prevented disposable
  Apache startup because the test image does not load `mod_headers`. Guarding
  that directive with `IfModule headers_module` preserved it where available,
  while scoped PHP responses continued to emit the required policy.
- Post-review `npm run test:e2e` passed the current 116/116 browser cases in
  disposable tenant `mjl-test-20260804t195247-1705655-ac1c7585`; all tenant
  resources were removed. Duration was 642.7 seconds. This run included the
  mandatory visible 40px activity-create control under the authorized Agent
  role and the separately authorized Admin checks.

### Concurrent-write correction

After the post-review run, concurrent worktree edits temporarily removed the
protected-index assertions and the guarded Apache `Header` line. The final
audit restored both task-owned requirements without staging the unrelated
normative worktree changes. The later verification results below supersede
that transient worktree state; no earlier evidence entry was rewritten.

### Restored-state verification

- `node --test tests/unit/design-system-v3-remediation.test.js` passed the
  isolated remediation contract, including protected index blobs and the
  append-only validation prefix.
- `npm run test:unit` passed all 8 current unit files and maintained PHP
  contracts after restoration. Duration was 1.0 seconds.
- `git diff --check` passed.
- `git diff --cached --name-only` returned no paths; no unrelated or normative
  worktree hunk is staged.
- The final Standards review confirmed no remaining task-owned finding. The
  final Spec review required this appended command record as its sole remaining
  documentation correction.
