# MJL Clarity System — Design Governance

## Purpose

Prevent design drift after multiple implementation iterations.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Rule Of Reuse

Codex must reuse existing patterns before creating new ones. Do not invent a new component if an existing component covers the need.

## Change Process

Any design-system change should document:

- reason for change;
- affected files;
- affected screens;
- affected components;
- backward compatibility notes;
- E2E impact;
- accessibility impact.

## Changelog

Maintain a simple changelog inside the design-system folder when the design system changes.

Example:

```txt
v0.1 - Initial design system
v0.2 - Added auth and email rules
v0.3 - Updated role visibility model
```

## Deprecated Patterns

If a pattern is replaced, mark it as deprecated. Do not silently keep multiple competing patterns.

## Compliance

Every Codex UI implementation must state which design-system files were used, which components were applied, which rules were followed, which exceptions were made, and why exceptions were necessary.
