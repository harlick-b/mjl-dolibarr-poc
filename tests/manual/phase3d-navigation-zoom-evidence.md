# Phase 3D real browser-zoom evidence

This is the manual acceptance gate for real 100%/200% browser zoom. Viewport
shrinking, CSS `zoom`, device-scale emulation, and CDP page-scale emulation are
supplemental checks only and must not be recorded as a pass for this gate.

Run only against the verified disposable Phase 3D Compose environment. The
harness verifies its isolation contract and idempotently bootstraps that
fixture before opening the browser:

```bash
MJL_PHASE3D_ZOOM_MANUAL=1 PWDEBUG=1 npx playwright test --config=tests/manual/phase3d-navigation-zoom.config.js
```

At each 100% pause, use visible Chromium browser chrome to reset zoom and
resize the full browser window to the requested outer width. Keep that physical
window size unchanged for the corresponding 200% pause. The harness checks
100% outer-width calibration, records browser/OS/inner/outer/DPR evidence,
checks the physical-size invariant (`outerWidth × DPR`), requires the DPR and
layout-width changes expected from real 200% zoom, requires the 200% inner
width to be half the 100% inner width within ±5%, checks horizontal reflow, and
exercises the drawer or desktop navigation state.

| Outer width | 100% | 200% | Evidence/result |
| ---: | :---: | :---: | --- |
| 390 | Pending | Pending | Pending manual execution |
| 768 | Pending | Pending | Pending manual execution |
| 980 | Pending | Pending | Pending manual execution |
| 1024 | Pending | Pending | Pending manual execution |
| 1366 | Pending | Pending | Pending manual execution |

If the headed browser or window manager cannot achieve a target outer width,
record `BLOCKED_BY_TEST_ENVIRONMENT` for that row with the observed outer and
inner dimensions. Do not substitute an emulated pass.
