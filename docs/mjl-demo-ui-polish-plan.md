# MJL Phase 14.9 Demo UI Polish Plan

Target decisions come from `docs/mjl-authoritative-decisions.md`. This plan
limits Phase 14.9 to demo UI/navigation polish and does not authorize business
behavior, schema, route, filename, permission, workflow, KPI, report-code,
export-column, or export-filename changes.

## Inspected Pages

- Workspace dashboard: `custom/mjlfinancement/index.php`.
- Navigation shell: `custom/mjlfinancement/lib/mjl_navigation.lib.php`.
- Partenaires / Programmes: `custom/mjlfinancement/partners.php`.
- Projects: `custom/mjlfinancement/projects.php`.
- Activities: `custom/mjlfinancement/activities.php`.
- Expenses: `custom/mjlfinancement/expenses.php`.
- Documents: `custom/mjlfinancement/documents.php`.
- Funding envelopes: `custom/mjlfinancement/conventions.php`.
- Budget lines: `custom/mjlfinancement/budgetlines.php`.
- Fund receipts: `custom/mjlfinancement/fundreceipts.php`.
- Alerts: `custom/mjlfinancement/alerts.php`.
- Supervision dashboard: `custom/mjlfinancement/dpafdashboard.php`.
- Reports / exports: `custom/mjlfinancement/reports.php`.
- Validation history: `custom/mjlfinancement/validations.php`.
- Workflow audit: `custom/mjlfinancement/workflowactions.php`.
- Exchange logs: `custom/mjlfinancement/exchangelogs.php`.
- Admin access: `custom/mjlfinancement/admin/access.php`.

## Safe Fixes

- Replace production-facing `Convention` labels with `Enveloppe de
  financement` where the page is describing the MJL funding-envelope object.
- Replace production-facing `PTF` labels with `Partenaire / Programme`.
- Replace production-facing `DPAF / Admin` display context with
  `Administration / validation definitive`.
- Keep `Echanges` out of primary navigation.
- Clarify empty states, table headers, page descriptions, scope chips, and
  action labels without changing route names or access checks.
- Replace display-only `Validee legacy` where the code already treats status
  `2` as final/legacy compatibility.

## Deferred Client Decisions

- Final client-approved wording for funding-envelope lifecycle states remains
  pending.
- Final donor/client report canevas and official output templates remain
  pending.
- Final production permission matrix remains pending.
- Document preview UX remains pending; global Documents stays read-only.
- Route filenames such as `conventions.php` and `dpafdashboard.php` remain
  compatibility debt until a separate architecture decision.

## Stop Conditions

Stop and ask before any route rename, file rename, schema change, permission
code change, workflow meaning change, KPI formula change, report-key change,
export-template or export-filename change, hidden-page exposure, or Dolibarr
core modification.

## Status-Label Mapping

| Internal source | Internal value | Demo display label | Notes |
| --- | --- | --- | --- |
| Activity workflow | `STATUS_DRAFT` / `0` | Brouillon | Unambiguous workflow draft. |
| Activity workflow | `STATUS_OPEN` / `1` | En cours | Unambiguous open execution state. |
| Activity workflow | `STATUS_COMPLETED` / `2` | Terminee | Execution completion, not final validation. |
| Activity workflow | `STATUS_SUBMITTED` / `3` | Soumise | Awaiting review. |
| Activity workflow | `STATUS_CORRECTION_REQUESTED` / `4` | Correction demandee | Awaiting correction. |
| Activity workflow | `STATUS_CORRECTED` / `5` | Corrigee | Corrected after request. |
| Activity workflow | `STATUS_VALIDATED` / `6` | Validee definitivement | Final business validation. |
| Activity workflow | `STATUS_PREVALIDATED` / `7` | Prevalidee | Reviewer/prevalidation state. |
| Activity workflow | `STATUS_REJECTED` / `8` | Rejetee | Rejected workflow state. |
| Activity workflow | `STATUS_CANCELLED` / `9` | Annulee | Cancelled workflow state. |
| Expense workflow | `STATUS_DRAFT` / `0` | Brouillon | Unambiguous workflow draft. |
| Expense workflow | `STATUS_SUBMITTED` / `1` | Soumise | Awaiting review. |
| Expense workflow | legacy `2` | Validee definitivement (compatibilite historique) | Display-only replacement for `Validee legacy` where status `2` is already treated as final legacy compatibility. |
| Expense workflow | `STATUS_CORRECTED` / `3` | Corrigee | Corrected after request. |
| Expense workflow | `STATUS_PREVALIDATED` / `4` | Prevalidee | Reviewer/prevalidation state. |
| Expense workflow | `STATUS_FINAL_VALIDATED` / `6` | Validee definitivement | Final business validation. |
| Expense workflow | `STATUS_DISBURSED` / `7` | Decaissee | Money moved; distinct from validation. |
| Expense workflow | `STATUS_REJECTED` / `8` | Rejetee | Rejected workflow state. |
| Funding envelope reference data | `STATUS_DRAFT` / `0` | Brouillon | Reference-data lifecycle, not workflow validation. |
| Funding envelope reference data | `STATUS_ACTIVE` / `1` | Active | Do not map to workflow validation. |
| Funding envelope reference data | `STATUS_CLOSED` / `2` | Cloturee | Do not map to workflow validation or disbursement. |
| Budget-line reference data | `STATUS_DRAFT` / `0` | Brouillon | Reference-data lifecycle. |
| Budget-line reference data | `STATUS_ACTIVE` / `1` | Active | Do not map to workflow validation. |
| Budget-line reference data | `STATUS_CLOSED` / `2` | Cloturee | Do not map to workflow validation. |
| Fund receipt reference data | `STATUS_DRAFT` / `0` | Brouillon | Receipt lifecycle. |
| Fund receipt reference data | `STATUS_RECEIVED` / `1` | Fonds recus | Receipt confirmed, not expense disbursement. |
| Fund receipt reference data | `STATUS_CANCELLED` / `2` | Annulee | Cancelled receipt. |
