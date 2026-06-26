# MJL Clarity System — Phase 7 Compliance Report

## Scope

Phase 7 redesigns the activity workflow UI only. Changes stay inside `custom/mjlfinancement`, E2E tests, and this documentation.

## Safe Boundary Evidence

- Dolibarr core files were not modified.
- No schema changes, export changes, email changes, native menu hiding, or expense upload redesign were introduced.
- Activity workflow transitions still use the existing `MjlActivity` methods.
- No final permission matrix or N+1/N+2 split was invented.
- Current single-step validation remains the implemented workflow.

## Implemented Surfaces

- `/custom/mjlfinancement/activities.php` now has a scoped list view and `?id=` detail view.
- Activity detail is status-first, with summary, next action, role-aware decision panel, linked-expense document checklist, and workflow timeline.
- Level 1 operational users are scoped to their own activities.
- Level 2 reviewers see submitted activities and activities where they have workflow history.
- Level 3/DPAF, Admin, and read-only users retain portfolio or consultation visibility according to the temporary access model.
- Normal workflow UI renders French status/action labels and avoids raw status codes, object IDs, and `changes_json`.
- Supporting documents are surfaced only through linked expenses and existing ECM/supporting-document evidence.

## Constraints Check

- No public register page was created.
- Invitation-only access remains unchanged.
- Only Admin invitation management remains unchanged.
- Existing audit rows and no-self-validation behavior are preserved.
- Existing exports and report filters are untouched.
- Status and alert severity use visible text, not color alone.

## E2E Coverage Added

Playwright spec `tests/e2e/phase7-activity-workflow.spec.js` covers:

- Level 1 activity creation, detail view, submission, and timeline update.
- Level 1 blocking from another operational user's activity and another entity's activity.
- Level 2 validation with linked-expense document checklist.
- Return for correction, Level 1 correction, resubmission, and preservation of previous decision comments.
- Self-validation hidden in UI and blocked server-side.
- DPAF, Admin, read-only, and forbidden public-registration-label checks.

## Known Limitations

- Standalone alert center remains outside Phase 7.
- Reports/export redesign remains outside Phase 7.
- Expense upload UX remains on `expenses.php`.
- Activity-level document upload is not introduced.
