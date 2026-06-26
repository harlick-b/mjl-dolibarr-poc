# Ongoing And To Do

## Ongoing

- The MJL Dolibarr POC runtime is functional and committed.
- The current focus should be validation and hardening, not more schema churn.
- `MjlConvention` remains the Phase 1 funding envelope unless a real business rule proves it insufficient.
- Activity deadline alerts such as `Échéance proche` and `En retard` remain computed states, not stored statuses.
- The implemented activity status model is the source of truth:
  - `0` draft
  - `1` ongoing
  - `2` completed
  - `3` submitted
  - `4` correction requested
  - `5` corrected
  - `6` validated
  - `8` rejected
  - `9` cancelled

## To Do

### Richer Detail Pages

- Add activity detail pages.
- Add expense detail pages.
- Add convention detail pages.
- Add budget-line detail pages.

### Document Workflows

- Add preview/download links in custom screens.
- Add activity and convention supporting-document handling.
- Make missing-document states clearer in lists and detail pages.

### Browser End-To-End Tests

- Test agent activity submission.
- Test supervisor correction request.
- Test agent correction and resubmission.
- Test supervisor validation.
- Test DPAF dashboard and export checks.

### DPAF And Reporting

- Confirm final client report columns.
- Add official report canevas if provided by MJL.
- Improve filters and selectors.
- Add `.xlsx` only if a safe Dolibarr-native helper or existing dependency is available.

### Security And Data Integrity

- Continue entity-leak checks.
- Add more cross-object coherence audits.
- Test permissions from each sample role in the browser.

### Product Decisions

- Define final escalation rules for `SUPERVISEUR_N2` and `DPAF`.
- Confirm whether `MjlConvention` fully covers mission/envelope needs.
- Confirm exact budget execution formulas expected by MJL.
- Confirm any required exports or reports beyond the three currently implemented:
  - `Suivi des activités`
  - `Suivi des dépenses`
  - `Historique décisions / audit`

### Production Readiness

- Rehearse installer and upgrade flow on a clean database.
- Define backup and restore procedures.
- Add error logging and admin diagnostics.
- Write deployment guidance.
- Write user training notes.
