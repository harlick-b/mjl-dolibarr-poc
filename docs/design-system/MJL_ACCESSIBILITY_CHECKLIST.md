# MJL Clarity System — Accessibility Checklist

## Purpose

Define accessibility checks for app UI, auth pages, system emails, official outputs, and E2E-covered flows.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Acceptance Checks

- Keyboard navigation works.
- Focus state is visible.
- Status is never color-only.
- Form labels are clear.
- Errors appear near fields.
- Tables remain readable.
- Action buttons are keyboard reachable.
- Modal focus is handled.
- 200% zoom remains usable.
- Email layout remains readable.
- Contrast is sufficient.
- Alert severity is understandable without color.

## E2E Relationship

E2E tests should cover critical accessibility expectations for complete journeys where practical, especially auth, invitation, validation, alerts, exports, and role visibility.
