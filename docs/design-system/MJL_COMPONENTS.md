# MJL Clarity System — Components

## Purpose

Define the reusable component catalog for app UI, auth pages, system emails, official outputs, and E2E-covered flows.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Component Definition Standard

Each component must define purpose, when to use it, when not to use it, layout, behavior, accessibility, French labels, role visibility, and E2E coverage expectation.

## Priority Components

- MJL workspace shell
- Page header
- Dashboard card
- KPI card
- Status badge
- Alert card
- Validation timeline
- Decision panel
- Activity summary card
- Project summary card
- Document checklist
- Export toolbar
- Filter bar
- Audit table
- Invitation status badge
- Auth form
- Empty state
- Error state
- Confirmation modal
- Email header
- Email CTA button
- Email footer

## Reuse Rule

Reuse existing MJL patterns before creating new ones. Do not introduce a heavy UI framework without approval.
