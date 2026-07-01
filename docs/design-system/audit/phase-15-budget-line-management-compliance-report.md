# Phase 15 Budget-Line Management Compliance Report

## Scope

- Adds governed DPAF/Admin budget-line management while keeping the product label `Ligne budgetaire`.
- Keeps implementation inside `custom/mjlfinancement`.
- Keeps delete/deactivation UI out of scope.

## Design-System Compliance

- Replaces the raw read-only budget-line list with a DPAF/Admin control surface.
- Shows status, project/convention/activity context, financial execution, lifecycle action, and workflow history before low-level details.
- Preserves French-first labels and sober finance-workspace wording.
- Uses `MjlWorkflowAction` for budget-line timeline evidence and sanitized unsafe-edit attempts.

## Access And Safety

- DPAF/Admin can manage budget lines only through supervision plus `budgetline/write`.
- Normal users remain blocked by direct URL and direct POST.
- Active conventions are required for budget-line creation and activation.
- Active budget lines under active conventions are required for new or progressing expenses.
- Structural fields are locked after expenses exist; computed spent and remaining amounts are recalculated server-side.

## Validation

- Focused Playwright coverage: `tests/e2e/phase15-budget-line-management.spec.js`.
- Covered rights, create/edit/activate, filters/history, direct access blocks, inactive convention rejection, locked edits, revised-budget floor, computed amount tampering, and expense integration.
