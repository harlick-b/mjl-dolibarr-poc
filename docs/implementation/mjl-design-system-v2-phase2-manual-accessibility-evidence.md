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

| Width | 100% recording | 200% recording | Defects / rerun |
| --- | --- | --- | --- |
| 390 | Pending | Pending | Pending |
| 768 | Pending | Pending | Pending |
| 1024 | Pending | Pending | Pending |
| 1366 | Pending | Pending | Pending |

Each recording must demonstrate and the reviewer must mark:

- keyboard order, skip link, and visible focus;
- error-summary link and invalid-control focus;
- modal focus entry/trap, Escape close, and trigger-focus restoration;
- no clipped controls, two-dimensional page scrolling, overlap, or lost
  content at 100% and calibrated 200%;
- status, warning, success, and error meaning remains present in text rather
  than color alone;
- visible text and component contrast has no observed regression.

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
