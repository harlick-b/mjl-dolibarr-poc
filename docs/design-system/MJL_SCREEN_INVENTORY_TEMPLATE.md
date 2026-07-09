# MJL Clarity System — Screen Inventory Template

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
template covers screen inventory evidence only.

## Purpose

Provide the template for the later screen inventory. This file does not perform the inventory.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The production access model uses one global business role per user: AGENT_SAISIE, AGENT_VERIFICATEUR, VALIDATEUR_DEFINITIF, or ADMIN_PLATEFORME.
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
- Target business role: AGENT_SAISIE / AGENT_VERIFICATEUR / VALIDATEUR_DEFINITIF / ADMIN_PLATEFORME
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
- Do not invent permissions beyond the production role model in docs/mjl-authoritative-decisions.md.
