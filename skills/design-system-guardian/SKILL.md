---
name: design-system-guardian
description: Use for UI, layout, Tailwind, shadcn/ui, icons, visual consistency, auth pages, emails, dashboards, exports, official outputs, or E2E-covered screens.
---

# Design System Guardian

## When to use

Use this for any UI or visual-consistency work, including auth, email,
dashboard, export, official-output, and E2E-covered flows.

## Read first

- `AGENTS.md`
- `docs/mjl-authoritative-decisions.md`
- `DESIGN.md`
- `docs/design-system/DESIGN.md`
- `docs/design-system/audit/current-screen-inventory.md`
- `docs/design-system/audit/current-ui-audit.md`
- Applicable supplied `docs/inspiration/` references when screens are affected

## Workflow

1. Confirm the design-system gate for the touched surface before source changes.
   A documentation audit does not require generating screens or running E2E.
2. Preserve French-first labels, invitation-only access, and guarded routes.
3. Use approved v3 tokens for identity and supplied inspiration for composition.
   Resolve conflicting palettes explicitly; default shadcn styles and legacy PHP
   widget structure are not the rebuild visual authority. Missing inspiration
   blocks that product screen only.
4. Validate responsive behavior, accessibility, and E2E impact.

## Output

Return design-system files used, applied patterns, exceptions, verification, and
remaining design decisions.
