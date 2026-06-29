# MJL Clarity System — Phase 8 Compliance Report

## Scope

Phase 8 implements a standalone alert and risk center. Changes stay inside `custom/mjlfinancement`, E2E tests, and this documentation.

## Safe Boundary Evidence

- Dolibarr core files were not modified.
- No schema changes, export changes, email changes, native menu hiding, or expense workflow redesign were introduced.
- Alerts are derived from existing activities, expenses, validation status, deadlines, and ECM/supporting-document evidence.
- The temporary Level 1 / Level 2 / Level 3 / Admin model remains the only role model used.
- Expense self-validation behavior is not changed in this phase and remains deferred to the later expense workflow phase.

## Implemented Surfaces

- `/custom/mjlfinancement/alerts.php` now provides the standalone `Alertes MJL` center.
- Alert cards show visible severity, affected object, actor/audience, expected action, status/context metadata, and action link.
- Alert types cover deadline risks, overdue activities, submitted activities, submitted expenses, and missing expense documents.
- Workspace cards and quick navigation expose `Alertes`.
- Existing DPAF deadline-risk cards now link directly to the relevant activity detail.
- Activity alerts link to `activities.php?id=...`; expense alerts keep the existing `expenses.php` destination until expense detail is redesigned.

## Constraints Check

- No public register page was created.
- Invitation-only access remains unchanged.
- Only Admin invitation management remains unchanged.
- Existing workflow rules, audit history, exports, active-entity filtering, and activity no-self-validation behavior are preserved.
- Status and alert severity use visible text, not color alone.
- Read-only and workflow-only users do not receive new activity or expense access beyond their existing MJL rights.

## E2E Coverage Added

Playwright spec `tests/e2e/phase8-alerts-risks.spec.js` covers:

- Level 1 own operational alerts and cross-user/entity exclusion.
- Level 2 validation alerts and direct activity links.
- DPAF/Admin portfolio alert visibility.
- Alert removal after the underlying activity decision is recorded.
- Missing-document expense alert visibility without an expense detail page.
- Read-only bounded visibility and workflow-only blocking.
- Forbidden public-registration labels remain absent.

## Verification

- `npm run test:e2e -- tests/e2e/phase8-alerts-risks.spec.js`
- `npm run test:e2e -- tests/e2e/phase6-level-dashboards.spec.js tests/e2e/phase7-activity-workflow.spec.js tests/e2e/phase8-alerts-risks.spec.js`

Both commands passed.

## Known Limitations

- Alerts are computed views, not persisted alert records with acknowledgement or resolution history.
- Expense alerts link to the existing expense list because expense detail redesign is deferred.
- Alert emails remain outside Phase 8.
- Reports/export redesign remains outside Phase 8.
