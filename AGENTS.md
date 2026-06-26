# Agent Instructions

This is the canonical agent instruction file for this repository.

## MJL Design System

Before any app UI, auth, email, dashboard, export, official output, or E2E
work, read:

- `docs/design-system/00_DESIGN_SYSTEM_PLAN.md`

Do not implement source changes affecting app UI, auth pages, system emails,
dashboards, exports, official outputs, or E2E-covered flows until the
design-system files, screen inventory, and UI audit have been created and
reviewed.

For any covered work:

- If planned design-system markdown files are missing, create documentation
  first.
- If `docs/design-system/audit/current-screen-inventory.md` is missing, create
  the screen inventory before source changes affecting screens.
- If `docs/design-system/audit/current-ui-audit.md` is missing, create the UI
  audit before source changes affecting screens.
- If the screen inventory or UI audit contains unresolved decisions, stop for
  review before implementation.

Dolibarr core files must never be modified.
MJL-specific work must stay inside safe custom module/theme boundaries.

## Safe Working Boundaries

This repository is a Dolibarr POC with one MJL custom module.

Allowed MJL work areas:

- `custom/mjlfinancement`
- `docs/`
- documented setup scripts
- documented sample-data locations
- safe custom theme boundaries, only after a custom theme path is explicitly
  documented

Do not modify Dolibarr core files. If a requirement appears to need Dolibarr
core edits, stop and escalate the architecture decision instead of editing core.

## Repo Rules

- Keep MJL-specific code inside `custom/mjlfinancement`.
- Filter custom queries by the active Dolibarr entity for custom objects,
  dashboards, exports, audit lists, and workflow lookups.
- Prefer native Dolibarr concepts where they fit: third parties, projects,
  users/groups, permissions, ECM/documents, and export helpers.
- Preserve French-first UI and content.
- Preserve invitation-only access.
- Only Admin can send invitations for now.
- Do not create a public register page.
- Apply the design system to system emails and official outputs, including
  reports, exports, and PDF or print views if added.
- Use E2E tests as the primary validation for app UI, auth, dashboard, export,
  official output, and workflow changes.
- Preserve existing workflow rules, audit history, exports, and
  no-self-validation behavior.
