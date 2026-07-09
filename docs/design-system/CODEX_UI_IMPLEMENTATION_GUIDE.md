# MJL Clarity System — Codex UI Implementation Guide

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
guide covers UI implementation only.

Note: `AGENTS.md` is the canonical in-repo agent instruction layer. This file
is retained as scoped UI implementation guidance; if it conflicts with
`AGENTS.md`, follow `AGENTS.md`.

## Purpose

Define the required execution sequence for future Codex work affecting app UI, auth pages, system emails, dashboards, exports, official outputs, or E2E-covered flows.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The production access model uses one global business role per user: AGENT_SAISIE, AGENT_VERIFICATEUR, VALIDATEUR_DEFINITIF, or ADMIN_PLATEFORME.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Required Sequence

1. Read all files under `docs/design-system/`.
2. Respect Dolibarr core boundaries.
3. Keep MJL logic inside the custom module or documented safe theme boundary.
4. Create `docs/design-system/audit/current-screen-inventory.md` before UI source changes.
5. Create `docs/design-system/audit/current-ui-audit.md` before UI source changes.
6. Wait for review of inventory and audit decisions.
7. Implement one phase only.
8. Use French labels.
9. Preserve invitation-only access and never create a public register page.
10. Apply the design system to emails and official outputs.
11. Use E2E tests as primary validation.
12. Preserve business rules, no-self-validation, exports, and audit history.
13. Produce a compliance report after implementation.

## Prohibited Actions

- Modify Dolibarr core.
- Redesign everything at once.
- Hide screens without inventory.
- Invent final permissions.
- Create a register page.
- Use micro tests as the main QA.
- Break existing workflows.
- Copy external design systems directly.
- Introduce heavy UI frameworks without approval.
- Use color as the only status indicator.
