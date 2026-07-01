# Phase 17 Official Output Hardening Compliance Report

## Summary

- Adds XLSX export support beside the existing Excel-compatible CSV exports.
- Uses Dolibarr's native Excel 2007 export driver; no new spreadsheet dependency is introduced.
- Keeps CSV and XLSX on the same report definitions, filters, required-filter guards, filenames, role checks, and active-entity-scoped rows.
- Polishes visible fund-receipt wording for the DPAF/Admin manual review path.

## Design-System Alignment

- The reports center now exposes CSV and XLSX filenames before export.
- Export context states report, scope, period, formats, role restriction, and active filters.
- Fund-receipt UI uses accented French labels for `Réception`, `Reçu`, `Non reçu`, `Créer`, and proof-download actions.

## Security And Scope

- Export routes remain DPAF/Admin supervision surfaces.
- File generation still requires Admin or `mjlfinancement/export/write`.
- Required filters block both direct CSV and direct XLSX export URLs.
- XLSX is generated through the existing Dolibarr driver and streamed from a temporary file.

## E2E Coverage

- Phase 9 export tests cover CSV and XLSX filenames, content, workbook ZIP signature, workbook entries, headers, row content, entity scope, and forced-export denial.
- Phase 16 fund-receipt tests cover the accented DPAF workflow labels.

## Residual Decisions

- Donor-specific UNICEF, HACT, FACE, Redevabilite, or other official templates remain blocked until MJL provides exact canevas and final columns.
