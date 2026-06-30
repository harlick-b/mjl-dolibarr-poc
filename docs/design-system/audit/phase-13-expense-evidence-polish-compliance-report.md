# Phase 13 Expense Evidence Polish Compliance Report

## Scope

- Refines expense detail evidence review after guarded downloads.
- Requires downloadable expense evidence before validation.
- Keeps schema, preview, convention management, and budget-line management out of this batch.

## Design-System Rules Applied

- Expense detail remains status-first and French-first.
- Validators see evidence state before decision controls.
- Document states distinguish available, missing, and referenced-but-unavailable evidence.
- Download remains guarded and attachment-only.

## Security And Workflow Controls

- Server-side validation now requires at least one linked ECM file that resolves through the same storage safety checks used by the download route.
- Unavailable evidence is not hidden from missing-document alerts, workspace counts, dashboard counts, or expense document reporting.
- Existing active-entity filtering, no-self-validation, audit history, budget checks, and role-aware actions are preserved.

## Validation

- Phase 11 E2E coverage is extended for downloadable, missing, ECM-only, and unavailable evidence states.
- Smoke expense validation fixtures now create real ECM files for successful validation paths.

## Known Limitations

- No inline preview.
- No activity, convention, or fund-receipt document workflow expansion.
- No migration of legacy reference-only document values; they are surfaced as unavailable until a real ECM file is attached.
