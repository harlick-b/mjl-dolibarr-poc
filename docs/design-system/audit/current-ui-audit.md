# MJL Clarity System - Current UI Audit

MJL product decisions come from `docs/mjl-authoritative-decisions.md`. This file
records current React UI evidence, not user acceptance or production readiness.

## React PTA-6A/PTA-6D evidence (DEC-125/128)

The Activity workspace uses existing card, list and action patterns for optional
evidence. JPEG/PNG rows open a bounded modal with loading, offline and failure
states, keyboard close/focus return and mobile containment. Protected bytes use
the authenticated REST client and are released when the modal closes. PDF rows
remain download-only. Focused Vitest and Chromium checks establish exercised
behavior; human visual and accessibility acceptance remain outstanding.

## React PTA-4A evidence (DEC-121)

The annual PTA screen reuses the supplied dashboard inspiration's two-card metric
composition and approved v3 tokens. It displays physical and financial execution,
exact supporting counts/XOF amounts, an explicit zero-denominator state and
responsive one-column reflow. Focused Vitest and Chromium checks establish the
exercised behavior; human review remains outstanding.

## React PTA-3D evidence (DEC-118)

The realization workspace reuses the approved financial-card composition for
external virement declarations. It displays the server-owned amount, requires
the effective date and explicit attestation, keeps the reference optional and
shows immutable correction history. Mutations remain online-only and refresh
the affected Query projections.

## React A2.1-A2.2 evidence (DEC-096/099)

The Admin account and invitation view follows the supplied user-table/dialog
composition and v3 tokens. Focused browser checks cover invitation, recipient OTP,
restricted role/deactivation, focus containment and return, 375px reflow, Query
refresh, offline masking and unknown-result non-replay. No human acceptance is
claimed; the roadmap owns final gate evidence.

## React A1 evidence (DEC-094)

French authentication screens follow supplied composition references and v3
tokens. Focused Playwright checks exercise 375px layout, keyboard OTP entry,
password reveal, readonly email, inline errors, cross-tab/offline masking and
dirty-form worker deferral. These checks establish exercised behavior; signed
human visual and accessibility review remains outstanding.
