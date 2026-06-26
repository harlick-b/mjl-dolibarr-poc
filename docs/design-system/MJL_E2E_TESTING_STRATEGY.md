# MJL Clarity System — E2E Testing Strategy

## Purpose

Define E2E tests as the main validation method for the MJL Clarity System.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Main Rule

End-to-end tests are the primary validation method. Micro/unit tests are allowed only when useful for business rules or security-critical logic, but they must not replace full feature E2E tests.

## Artifact Cleanup

After E2E or browser-assisted test work is complete, remove disposable generated artifacts, including `.playwright-mcp/`, Playwright reports, test results, screenshots, videos, traces, and downloaded export files unless they are explicitly needed for a reviewed compliance report.

## Required Scenarios

### Scenario 1 — Invitation And First Access

Admin logs in, sends invitation, invitation status becomes sent, user opens link, defines password, logs in, account becomes active, and audit records lifecycle.

### Scenario 2 — Forgotten Password

User requests reset, neutral confirmation appears, user opens reset link, sets new password, and logs in.

### Scenario 3 — Activity Lifecycle

Level 1 user creates and submits an activity, Level 2 reviewer validates or returns it, timeline updates, audit updates, dashboard updates, and export reflects the result where applicable.

### Scenario 4 — Return For Correction

Reviewer returns an activity with comment, Level 1 corrects it, resubmits it, and previous decision remains visible.

### Scenario 5 — Alerts

Seed approaching or overdue activity, correct level sees alert, alert links to object, user acts, and alert state updates if applicable.

### Scenario 6 — Export

User applies filters, exports, export respects filters, file is Excel-readable, filename is stable, and export is logged if applicable.

### Scenario 7 — Role Visibility

Level 1 sees operational workspace, Level 2 sees validation workspace, Level 3 sees supervision dashboard, Admin sees user/invitation management, and unauthorized pages are blocked.
