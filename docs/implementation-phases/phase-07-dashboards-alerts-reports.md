# Phase 7 - Dashboards, Alerts, Reports, Exports

## Goal

Update dashboards, alerts, reports, and exports around production roles and
Partenaires / Programmes scope.

## Scope

- Rebuild dashboard cards and filters by production role.
- Add production alert types while keeping alerts computed live by default.
- Update CSV/XLSX reports only.
- Enforce server-side partner/programme scope on every report and export.
- Audit `export_generated`.
- Preserve French headers, UTF-8 BOM CSV, semicolon separator, and stable
  filenames.

## Verification

- E2E export checks for CSV and XLSX.
- Unauthorized user cannot export.
- Exports respect partner/programme filters.
- Export audit is created.

