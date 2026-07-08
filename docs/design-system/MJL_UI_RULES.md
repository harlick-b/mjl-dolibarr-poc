# MJL Clarity System — UI Rules

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers UI rules only.

## Purpose

Define the cross-screen UI rules for app UI, auth pages, dashboards, exports, official outputs, and E2E-covered flows.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Page Rules

- Every page must answer one dominant question.
- The status of the object must be visible before detailed metadata.
- Primary actions must be obvious, role-aware, and written in French.
- Advanced Dolibarr complexity should be hidden, renamed, or moved to advanced access where safe.
- Do not hide screens without a reviewed screen inventory.

## Workflow Rules

- Validation must appear as a timeline showing created, submitted, reviewed, returned, rejected, validated, and final decision states where relevant.
- Buttons alone are not enough for validation state.
- Existing workflow rules, audit history, exports, and no-self-validation behavior must be preserved.

## Alert Rules

Every alert must explain:

- what the problem is;
- what object is affected;
- who should act;
- what action is expected;
- how urgent it is;
- where the user can click.

## Export And Official Output Rules

Exports are first-class outputs. Export screens should show report name, data scope, period, filters, format, filename, role restrictions, and generation action.

## Accessibility Rules

Status must never be color-only. Keyboard focus, labels, errors, tables, and action buttons must remain usable and understandable.
