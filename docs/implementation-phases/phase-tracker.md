# MJL Production Readiness Phase Tracker

This tracker controls the production-readiness refactor. Execute one phase at a
time. Each phase must be planned, implemented, verified, and closed before the
next phase starts.

## Global gates

- Do not modify Dolibarr core files.
- Keep MJL-specific changes inside `custom/mjlfinancement`, `docs`, tests,
  scripts, SQL/update files, and sample data.
- Keep the module below `1.0.0` until every in-scope readiness row is evidence
  backed.
- Treat `docs/mjl-current-app-functional-map.md` as current-state evidence and
  do not overwrite it without explicit intent.
- Report every skipped check and the reason.

## Phase status

| Phase | Name | Status | Exit gate |
| --- | --- | --- | --- |
| 0 | Baseline and target spec | Implemented | Target docs and phase plans created; no runtime changes |
| 1 | Role, scope, and migration foundation | Implemented | New role/scope model migrated and audited |
| 2 | Access gates, admin assignments, navigation | Implemented | Production role/scope guards and admin assignment UI verified |
| 3 | Partenaires / Programmes, projects, financing | Implemented | Scoped partner/project/finance pages verified |
| 4 | Activity workflow | Implemented | Production activity workflow and physical execution verified; full E2E still has non-Phase-4 failures listed in Phase 4 notes |
| 5 | Expense / decaissement workflow | Not started | Production expense and disbursement workflow verified |
| 6 | Documents, timeline, exchanges, audit | Not started | Guarded documents and contextual timeline verified |
| 7 | Dashboards, alerts, reports, exports | Not started | Scoped KPI, alert, CSV, and XLSX behavior verified |
| 8 | Security and production readiness gate | Not started | Security/readiness checks implemented and reviewed |
| 9 | Seed, acceptance tests, final docs | Not started | Full acceptance scenarios and final docs complete |
