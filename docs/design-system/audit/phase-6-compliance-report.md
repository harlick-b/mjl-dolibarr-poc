# MJL Clarity System — Phase 6 Compliance Report

## Scope

Phase 6 refines the Level dashboards and DPAF supervision dashboard. Changes stay inside `custom/mjlfinancement`, E2E tests, and this documentation.

## Safe Boundary Evidence

- Dolibarr core files were not modified.
- MJL-specific UI remains inside `custom/mjlfinancement`.
- No schema changes, new routes, list filters, export behavior changes, email changes, or native menu hiding were introduced.
- DPAF/report direct-access hardening still uses the Phase 5 Admin or `MJL POC - DPAF` boundary.
- Dashboard styling is scoped under `.mjl-workspace` and `.mjl-dashboard-*`.

## Implemented Surfaces

- Role-specific MJL landing dashboard cards for Level 1, Level 2, Level 3/DPAF, Admin, and read-only users.
- Admin dashboard remains administration-first, with supervision/report shortcuts but without operational or validation workload sections.
- DPAF dashboard now presents KPI cards, deadline-risk alert cards, pending-review rows, budget/expense summary, recent fund receipts, and recent audit rows.
- Dashboard helper queries and rendering helpers were centralized in `mjl_dashboard.lib.php`.

## Constraints Check

- No public register page was created.
- Invitation-only access remains unchanged.
- Only Admin sees invitation management.
- No final permission matrix was invented.
- Activity and expense detail pages were not introduced; dashboard links target existing owning screens.
- Existing workflow rules, audit history, exports, active-entity filtering, and no-self-validation behavior were not intentionally changed.
- Status and alert severity use visible text, not color alone.

## E2E Coverage Added

Playwright specs cover:

- Level 1 operational dashboard cards and blocked DPAF/report access.
- Level 2 validation workload and deadline-risk dashboard cards with blocked DPAF/report access.
- DPAF supervision dashboard sections and report access.
- Admin administration-first dashboard and DPAF access.
- Read-only consultation-only workspace.
- Forbidden public-registration labels remain absent.

## Known Limitations

- Activity workflow detail, validation timeline, decision panel, and document checklist remain outside Phase 6.
- Standalone alert center remains outside Phase 6.
- Reports/export redesign remains outside Phase 6.
- The `MJL POC - DPAF` group marker remains a temporary POC convention pending a final permission matrix.
