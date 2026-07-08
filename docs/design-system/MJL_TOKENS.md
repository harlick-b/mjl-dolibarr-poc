# MJL Clarity System — Tokens

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers design tokens only.

## Purpose

Define token categories and names for future app UI, auth pages, system emails, official outputs, and E2E-stable selectors or visual checks.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Token Categories

- Primary colors
- Semantic colors
- Status colors
- Typography
- Spacing
- Border radius
- Borders
- Shadows
- Focus ring
- Table density
- Form density
- Email-safe equivalents

## Recommended Names

```txt
--mjl-color-primary
--mjl-color-surface
--mjl-color-text
--mjl-color-muted
--mjl-color-border
--mjl-status-draft
--mjl-status-submitted
--mjl-status-returned
--mjl-status-validated
--mjl-status-rejected
--mjl-alert-info
--mjl-alert-warning
--mjl-alert-urgent
--mjl-alert-blocking
--mjl-space-1
--mjl-space-2
--mjl-space-3
--mjl-radius-card
--mjl-focus-ring
```

## Accessibility Requirement

Tokens must support sufficient contrast and visible focus. Status and severity must never depend on color alone.
