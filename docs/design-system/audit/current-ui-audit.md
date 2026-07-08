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
- CSV/XLSX exports are the current output formats; PDF/Word reports are out of
  scope for this phase.
- Some labels and route names still use legacy DPAF/Convention wording; treat
  that as UI terminology debt.

## Screen Findings

| Screen | Alignment | Main UI Debt | Safe Area |
| --- | --- | --- | --- |
| Workspace dashboard | Partial | Final role wording and next-action hierarchy need review. | `custom/mjlfinancement/index.php` |
| Supervision dashboard | Partial | Legacy DPAF wording and dense KPI/table presentation. | `custom/mjlfinancement/dpafdashboard.php` |
| Partenaires / Programmes | Partial | Needs current browser review for production scope clarity. | `custom/mjlfinancement/partners.php` |
| Projects | Partial | Project creation/editing inside MJL needs current UX verification. | `custom/mjlfinancement/projects.php` |
| Activities | Medium | Dense workflow detail; document preview deferred; wording review needed. | `custom/mjlfinancement/activities.php` |
| Expenses | Medium | Dense forms/actions; final validation/disbursement clarity needs review. | `custom/mjlfinancement/expenses.php` |
| Documents | Good | Read-only model is correct; filters and document ergonomics can improve. | `custom/mjlfinancement/documents.php` |
| Conventions | Partial | Legacy label and DPAF/Admin wording need target review. | `custom/mjlfinancement/conventions.php` |
| Budget lines | Partial | Advanced finance setup should stay guarded; wording needs review. | `custom/mjlfinancement/budgetlines.php` |
| Fund receipts | Partial | Proof-document ergonomics and final wording need review. | `custom/mjlfinancement/fundreceipts.php` |
| Reports / exports | Medium | Final donor canevas and export audit remain pending. | `custom/mjlfinancement/reports.php` |
| Validation/audit history | Partial | Should be more contextual inside object detail pages. | `validations.php`, `workflowactions.php` |
| Exchange logs | Partial | Standalone route should not be primary navigation. | `custom/mjlfinancement/exchangelogs.php` |
| Auth/invitations | Medium | Invitation-only stance is correct; production email/base URL pending. | Auth templates, `admin/access.php`, `invitation.php` |

## Review Checklist

- Preserve guarded routes and active-entity filtering.
- Preserve no public registration.
- Preserve contextual uploads and guarded downloads.
- Preserve CSV/XLSX-only scope unless authority changes.
- Use `docs/mjl-authoritative-decisions.md` for terminology and role decisions.
