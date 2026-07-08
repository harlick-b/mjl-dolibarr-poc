# MJL Clarity System — Screen Inventory Template

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
template covers screen inventory evidence only.

## Purpose

Provide the template for the later screen inventory. This file does not perform the inventory.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Output File For Later Phase

Before UI implementation, create:

```txt
docs/design-system/audit/current-screen-inventory.md
```

Do not modify UI source code before this inventory is created and reviewed.

## Screen Entry Template

```md
## Screen: [Name]

- URL/path:
- Current purpose:
- Target purpose:
- Current users:
- Target access level: Level 1 / Level 2 / Level 3 / Admin
- Current problems:
- Recommended action: redesign / hide / rename / keep / advanced-only
- Safe files to modify:
- Implementation risk:
- Affected E2E scenarios:
- Review decision:
```

## Inventory Rules

- Include app UI, auth pages, dashboards, exports, official outputs, and administration screens.
- Identify screens that expose raw Dolibarr complexity.
- Do not hide, rename, or redesign screens before inventory review.
- Do not invent final permissions beyond the temporary Level 1, Level 2, Level 3, Admin model.
