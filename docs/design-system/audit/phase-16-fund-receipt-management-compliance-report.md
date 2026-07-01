# Phase 16 Fund Receipt Management Compliance Report

## Summary

- Replaces the raw read-only fund receipt list with a governed DPAF/Admin management surface.
- Keeps the French-first product label `Réception de fonds` / `Fonds reçus`.
- Uses active conventions as the only editable linkage; PTF and project are derived server-side.
- Requires downloadable ECM proof before a receipt can be marked `Reçu`.

## Design-System Alignment

- Uses the existing MJL workspace shell, section headings, compact forms, status pills, document summary, and timeline patterns.
- Keeps fund receipt management out of Level 1/2 navigation through `mjl_workspace_require_reference_data_access()`.
- Preserves supervision-focused hierarchy: status, PTF/project/convention, amount/date, proof state, actions, and history.

## Security And Traceability

- Mutations require DPAF/Admin supervision plus `fundreceipt/write`; proof upload also requires ECM upload.
- Fund proof downloads use `type=fundreceipt` and require the same reference-data/supervision access as the page.
- Downloads verify entity, ECM source object type, object id, safe path, and realpath containment.
- `MjlWorkflowAction` records creation, field changes, proof upload, received/not-received decisions, and rejected unsafe edits.

## E2E Coverage

- Focused Playwright coverage: `tests/e2e/phase16-fund-receipt-management.spec.js`.
- Covered paths: DPAF rights, create/edit/upload/received, missing proof block, inactive convention rejection, not-received zeroing, report/dashboard impact, role blocks, and secure download denial cases.

## Residual Decisions

- No expected-funds intermediate lifecycle is included in this phase.
- Document preview remains outside this phase; downloads are guarded and auditable.
