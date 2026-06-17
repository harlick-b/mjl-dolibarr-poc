# MJL Dolibarr POC Scope

The objective is to test whether Dolibarr can serve as the base for a web application dedicated to accounting and financial monitoring of externally funded projects.

The POC must cover:

Priority order for the revised POC:

1. Activity traceability.
2. Hierarchical workflow.
3. Audit history.
4. DPAF dashboard.
5. Deadline alerts.
6. Role-based permissions.
7. Excel-readable exports.
8. Minimal financial tracking.

Functional scope:

- PTF / bailleurs, mapped to Dolibarr third parties.
- Projects, mapped to Dolibarr projects.
- Users, groups, and permissions, mapped to Dolibarr native users/groups.
- Supporting documents, mapped to Dolibarr ECM.
- Conventions as the Phase 1 envelope candidate.
- Activities with lifecycle status, deadline fields, and traceability.
- Hierarchical validation workflow for activities and expenses.
- Audit trail showing who did what, when, why, and what changed.
- DPAF dashboard sections for activities, deadlines, pending reviews,
  expenses, budgets, validations, and recent workflow actions.
- Budget lines, funds received, and expenses for minimal financial tracking.
- Excel-readable exports through UTF-8 BOM semicolon CSV with French headers.

The POC must not cover:

- Full ERP accounting replacement
- SMS
- Bank API
- OCR / AI invoice reading
- External bailleur portal
- Full offline mode
- Dynamic report builder
- Custom `.xlsx` generation unless an existing safe Dolibarr helper or
  dependency is already available
- Dolibarr core edits
