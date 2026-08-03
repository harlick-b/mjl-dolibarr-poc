# MJL Clarity System - Current UI Audit

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file is current-state evidence only.

## Scope

This audit is documentation-only. It reflects repository-visible UI surfaces
after the documentation cleanup and does not replace browser verification.

## Overall Verdict

The current UI has a real MJL workspace shell, guarded routes, workflow
screens, dashboards, documents, exports, and audit surfaces. It still needs
production wording polish, less legacy supervision wording, clearer contextual
timelines/exchanges, and final client review for official outputs.

## Global Findings

- The MJL workspace is custom-module based and should remain the primary user
  experience.
- Normal users should not need raw native Dolibarr project/document screens.
- Global Documents is read-only; uploads are contextual.
- Guarded downloads are implemented for key document paths.
- Advanced audit and exchange screens exist but should remain contextual or
  supervision/audit-only.
- CSV/XLSX exports are the current output formats; PDF/Word reports are outside
  the current authoritative scope.
- Shared journey summaries, guarded document panels, exact finance recovery,
  resource pagination, contextual timelines, and enriched dashboard-card
  metadata now have catalog definitions. Their callers retain all server
  authorization.
- Touched finance routes distinguish allowlisted validation, database,
  timeline, and unknown feedback without exposing raw diagnostics. Unrelated
  legacy error-output debt remains tracked in the current-vs-target analysis.
- Some labels and route names still use legacy DPAF/Convention wording; treat
  that as UI terminology debt.

## Screen Findings

| Screen | Alignment | Main UI Debt | Safe Area |
| --- | --- | --- | --- |
| Workspace dashboard | Medium | Enriched cards now expose definition, scope, period, freshness, destination, and local source failure; final client KPI wording can still be reviewed. | `custom/mjlfinancement/index.php` |
| Supervision dashboard | Medium | Production role wording, scoped filters, and audit-row resolution are aligned; route filename remains compatibility debt. | `custom/mjlfinancement/dpafdashboard.php` |
| Partenaires / Programmes | Partial | Needs current browser review for production scope clarity. | `custom/mjlfinancement/partners.php` |
| Projects | Medium | Dedicated guarded create/edit states, shared scoped filters/pagination and list states, and responsive operational cards are browser-verified; dense related-detail tables remain separate. | `custom/mjlfinancement/projects.php` |
| Activities | Medium | Dedicated guarded create/edit/execution/contextual-upload and verifier/final-validator decision states plus shared scoped filters/pagination and responsive list cards are browser-verified; short submission/correction comments remain contextual and wording review remains. | `custom/mjlfinancement/activities.php` |
| Expenses | Medium | Dedicated guarded create/edit/contextual-upload/prevalidation/final-validation/rejection/disbursement states plus shared scoped filters/pagination and responsive operational cards are browser-verified; short submission/correction comments remain contextual and wording review remains. | `custom/mjlfinancement/expenses.php` |
| Documents | Good | Read-only model is correct; filters and document ergonomics can improve. | `custom/mjlfinancement/documents.php` |
| Conventions | Medium | Shared journey/document/recovery/pagination/timeline patterns and canonical feedback are present; legacy label and role wording still need target review. | `custom/mjlfinancement/conventions.php` |
| Budget lines | Medium | Shared journey/recovery/pagination/timeline patterns and canonical feedback are present; advanced finance setup must stay guarded. | `custom/mjlfinancement/budgetlines.php` |
| Fund receipts | Medium | Shared journey/document/recovery/pagination/timeline patterns and canonical feedback are present; final wording remains pending client review. | `custom/mjlfinancement/fundreceipts.php` |
| Reports / exports | Good | The report inventory uses target French wording, explicit Partenaire / Programme filters, POST-token exports, CSV/XLSX filename previews, and scoped audit visibility. Final donor canevas and permission matrix remain pending. | `custom/mjlfinancement/reports.php` |
| Validation/audit history | Partial | Should be more contextual inside object detail pages. | `validations.php`, `workflowactions.php` |
| Exchange logs | Partial | Standalone route should not be primary navigation. | `custom/mjlfinancement/exchangelogs.php` |
| Auth/invitations | Medium | Invitation-only stance is correct; production email/base URL pending. | Auth templates, `admin/access.php`, `invitation.php` |

## Review Checklist

- Preserve guarded routes and active-entity filtering.
- Preserve no public registration.
- Preserve contextual uploads and guarded downloads.
- Preserve CSV/XLSX-only scope unless authority changes.
- Use `docs/mjl-authoritative-decisions.md` for terminology and role decisions.

## Phase 3D.2 gate evidence

Guarded operational states and conditional record menus are browser-verified.
The operational matrix passed 42/42, and the shell/table regression matrix
passed 41/41. Native no-JavaScript menu fallback, keyboard focus restoration,
escaping, empty suppression, and 390-pixel viewport containment are covered.

The unsigned manual accessibility matrix and real 200% browser-zoom evidence
remain release blockers. This checkpoint does not claim WCAG conformance.
