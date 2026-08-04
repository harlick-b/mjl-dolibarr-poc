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
