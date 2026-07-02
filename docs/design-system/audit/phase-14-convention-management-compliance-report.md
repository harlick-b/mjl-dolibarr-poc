# Phase 14 Convention Management Compliance Report

Historical note: this report describes the Phase 14 convention-management
batch. Convention document upload/download was added later in Phase 18 and is
tracked in the current readiness and screen-inventory docs.

## Scope

- Adds governed DPAF/Admin convention management while keeping the product label `Convention`.
- Keeps implementation inside `custom/mjlfinancement`.
- Keeps convention documents out of scope.

## Design-System Compliance

- Replaces the raw read-only convention list with a DPAF/Admin control surface.
- Shows status, linked-record counts, lifecycle actions, and workflow history before low-level details.
- Preserves French-first labels and institutional wording.
- Uses `MjlWorkflowAction` for convention timeline evidence and sanitized unsafe-edit attempts.

## Access And Safety

- DPAF/Admin can manage conventions only through supervision plus `convention/write`.
- Normal users remain blocked by direct URL and direct POST.
- Linked conventions lock reference, PTF, project, currency, and total amount.
- Closed conventions remain visible in reports and history but cannot receive new linked records.

## Validation

- Focused Playwright coverage: `tests/e2e/phase14-convention-management.spec.js`.
- Covered rights, create/edit/activate/close, direct access blocks, locked edits, draft deletion, active-only selectors, direct POST guards, and closed-convention reporting visibility.
