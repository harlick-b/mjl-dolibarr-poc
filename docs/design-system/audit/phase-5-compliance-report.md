# MJL Clarity System — Phase 5 Compliance Report

## Scope

Phase 5 implements the MJL workspace shell and hardens direct access to supervision/report pages. Changes stay inside `custom/mjlfinancement`, E2E tests, and this documentation.

## Safe Boundary Evidence

- Dolibarr core files were not modified.
- MJL-specific UI remains inside `custom/mjlfinancement`.
- The workspace shell replaces only `/custom/mjlfinancement/index.php`.
- App styling is loaded through module CSS registration with selectors scoped under `.mjl-workspace`.
- The temporary Level 3 marker is existing group membership in `MJL POC - DPAF`; this is not a final permission matrix.

## Implemented Surfaces

- Role-aware MJL workspace shell with Administration, operational, validation, supervision, and read-only consultation sections.
- Shared `mjl_workspace.lib.php` helper for temporary workspace capabilities, DPAF access checks, and active-entity-safe counts.
- Direct access hardening for `/custom/mjlfinancement/dpafdashboard.php`.
- Direct access hardening for `/custom/mjlfinancement/reports.php`.
- CSV export still requires Admin or existing export-write capability.
- Phase 5 app stylesheet registered in module metadata and bootstrap constants.

## Constraints Check

- No public register page was created.
- Invitation-only access remains unchanged.
- Only Admin sees invitation management.
- No database schema changes were introduced.
- No final role or permission matrix was invented.
- Existing supervisor export rights remain unchanged, but DPAF/report page access now uses the temporary DPAF/Admin boundary.
- Open overdue activity counts exclude completed, validated, rejected, and cancelled statuses.

## E2E Coverage Added

Playwright specs cover:

- Level 1 operational workspace visibility and direct DPAF/report blocking.
- Level 2 validation workspace visibility and direct DPAF/report blocking.
- DPAF supervision workspace visibility and direct DPAF/report access.
- Admin invitation and supervision/report access.
- Read-only audit workspace without operational, validation, supervision, or admin sections.
- Forbidden public-registration labels remain absent from the workspace.

## Known Limitations

- Activity workflow UI, timeline, decision panel, and document checklist remain outside Phase 5.
- DPAF dashboard and reports pages are access-hardened but not visually redesigned in this phase.
- Native Dolibarr menus are not hidden in this phase.
- The `MJL POC - DPAF` group marker is a temporary POC convention pending a final permission matrix.
