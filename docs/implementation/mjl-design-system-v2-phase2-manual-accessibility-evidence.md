# Phase 2 manual accessibility evidence

## Gate

`PENDING_USER_QA_SIGNATURE`

This document is the required evidence sheet, not a conformance claim. Phase 2
may use `MJL_V2_PHASE2_IMPLEMENTED_PENDING_MANUAL_VALIDATION` after automated
gates pass. Only a completed and signed copy permits the phase-scoped validated
verdict.

## Environment and calibration

| Field | Recorded value |
| --- | --- |
| Fixture revision / commit | Pending |
| Operator | Pending |
| Date and timezone | Pending |
| Playwright-bundled Chromium version | Pending |
| Operating system and version | Pending |
| Display scale | Pending |

Use headed Playwright Chromium with `viewport: null`. At 100% browser zoom,
preserve the outer-window geometry and record `window.innerWidth` for each
window. Apply real browser 200% zoom without changing outer geometry and
record the effective inner width. It must be approximately half the calibrated
100% value, within ±5%. CSS zoom, DPR emulation, viewport shrinking, or a
screenshot without browser chrome is invalid evidence.

| Outer target | 100% inner width | 200% inner width | Half-width tolerance | Result |
| --- | ---: | ---: | ---: | --- |
| 390×844 | Pending | Pending | ±5% | Pending |
| 768×1024 | Pending | Pending | ±5% | Pending |
| 1024×768 | Pending | Pending | ±5% | Pending |
| 1366×768 | Pending | Pending | ±5% | Pending |

If any calibration fails, record `BLOCKED_BY_TEST_ENVIRONMENT` and stop; do
not substitute automated responsive-viewport evidence.

## Eight-cell evidence matrix

For every cell, record one OS-level video with browser chrome. Cover the
authenticated and forbidden shell, activity list/create/detail and forms,
expense list/detail and final-validation/rejection/disbursement dialogs,
alerts and the test-only partial-result harness, dashboard, project detail,
and partner detail.

Use `P — EVID@timestamp`, `F — EVID@timestamp`, or
`B — blocker-reference` in every check cell for pass, fail, or blocked. A
blank cell or a result without its criterion-specific evidence reference is
incomplete. One generic recording reference is insufficient.

| Cell | Calibrated inner width | OS video / evidence ID | Auth + forbidden shell | Activity list/create/detail/forms | Expense list/detail/3 dialogs | Alerts + partial harness | Dashboard | Project detail | Partner detail | Order/skip/focus | Error link/focus | Modal entry/trap/Escape/restore | Reflow/overflow/lost content | Non-color meaning | Contrast | Result | Defects / rerun evidence |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 390 @ 100% | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 390 @ 200% | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 768 @ 100% | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 768 @ 200% | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 1024 @ 100% | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 1024 @ 200% | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 1366 @ 100% | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |
| 1366 @ 200% | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending | Pending |

For each row, the criterion columns mean:

- `Order/skip/focus`: keyboard order, skip link, and visible focus;
- `Error link/focus`: error-summary link and invalid-control focus;
- `Modal entry/trap/Escape/restore`: focus entry and containment, Escape close,
  and trigger-focus restoration for all three expense dialogs;
- `Reflow/overflow/lost content`: no clipped controls, unintended
  two-dimensional page scrolling, overlap, or lost content;
- `Non-color meaning`: status, warning, success, and error meaning remains
  present in text rather than color alone;
- `Contrast`: visible text and component contrast has no observed regression.

The row result may be `PASS` only when every surface and criterion cell is
`P` and its evidence is traceable. Use `FAIL` when any cell is `F`, and
`BLOCKED_BY_TEST_ENVIRONMENT` when calibration or collection cannot be
completed.

## Defects and reruns

| Defect ID | Affected cells/surfaces | Resolution commit | Rerun evidence | Result |
| --- | --- | --- | --- | --- |
| None recorded yet | — | — | — | Pending |

Any correction requires rerunning every affected cell and the automated
focused/full regression gates.

## Signature

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| User/QA | Pending | Pending | Pending |

Excluded from this Phase 2 evidence: screen-reader validation, broader
physical-device/assistive-technology coverage, and any formal WCAG conformance
claim.
