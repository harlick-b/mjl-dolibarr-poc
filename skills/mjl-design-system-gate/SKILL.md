---
name: mjl-design-system-gate
description: Use for MJL-specific design-system gate checks before UI, auth, email, dashboard, export, official-output, or E2E-covered work.
---

# MJL Design System Gate

## When to use

Use before source changes affecting covered UI, auth, email, dashboard, export,
official-output, or E2E-covered flows.

## Read first

- `AGENTS.md`
- `docs/mjl-authoritative-decisions.md`
- `DESIGN.md`
- `docs/design-system/audit/current-screen-inventory.md`
- `docs/design-system/audit/current-ui-audit.md`

## Workflow

1. Confirm required design-system docs and audits exist.
2. Check for unresolved decisions before source changes.
3. Identify applicable tokens, components, accessibility, content, and E2E
   rules.
4. Stop and report if the gate is not satisfied.

## Output

Return gate status, files checked, unresolved decisions, and implementation
constraints.
