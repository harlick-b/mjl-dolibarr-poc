# Ongoing And To Do

## Ongoing

- The MJL Dolibarr POC runtime is functional and committed.
- The current focus should be consolidation, validation, navigation clarity,
  documentation alignment, and hardening, not more schema churn.
- `MjlConvention` remains the Phase 1 funding envelope unless a real business rule proves it insufficient.
- Activity deadline alerts such as `Échéance proche` and `En retard` remain computed states, not stored statuses.
- Playwright E2E coverage exists for auth/access, role workspaces, dashboards,
  activity workflow, alerts, exports, email templates, and expense workflow.
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
- Add DPAF/Admin convention detail, create, edit, close/archive, validation,
  and history pages.
- Keep DPAF/Admin budget-line management aligned with final MJL policy if a
  later deactivate/close lifecycle is requested.

### Document Workflows

- Keep secure expense download links guarded and covered by E2E tests.
- Add document preview after secure download has been reviewed in use.
- Add activity and convention supporting-document handling.
- Make missing-document states clearer in lists and detail pages.

### Browser End-To-End Tests

- Keep the existing Playwright suite passing before and after UI/navigation
  consolidation.
- Add focused coverage for shared MJL sidebar visibility and role-aware links.
- Add focused coverage for admin-only production-readiness route access.
- Continue expanding browser coverage only when it protects a real user flow.

### DPAF And Reporting

- Confirm final client report columns.
- Add official report canevas if provided by MJL.
- Add XLSX export support in addition to CSV compatible with Microsoft Excel.
- Improve filters and selectors.
- Add `.xlsx` only if a safe Dolibarr-native helper or existing dependency is available.

### Security And Data Integrity

- Continue entity-leak checks.
- Add more cross-object coherence audits.
- Test permissions from each sample role in the browser.
- Keep direct URL and direct POST access blocked for unauthorized actions.
- Preserve no-self-validation in domain logic, not only in the UI.

### Navigation And Scope Clarity

- Keep module navigation role-aware across MJL pages.
- Keep future-only features hidden from normal users.
- Keep partial read-only screens labelled as POC consultation views.
- Maintain `docs/mjl-financement-feature-coverage.md` as the coverage and
  scope classification baseline.

### Product Decisions

- Define final escalation rules for `SUPERVISEUR_N2` and `DPAF`.
- Permission matrix and final role model are not available yet; keep current
  role simulation until the matrix is provided.
- Confirm whether `MjlConvention` fully covers mission/envelope needs during
  the DPAF/Admin management implementation.
- Confirm exact budget execution formulas expected by MJL.
- Confirm any required exports or reports beyond the three currently implemented:
  - `Suivi des activités`
  - `Suivi des dépenses`
  - `Historique décisions / audit`

### Production Readiness

- Maintain `docs/mjl-financement-production-readiness.md` as the evidence
  gate for production scope and readiness status.
- Keep `docs/mjl-financement-production-deployment.md` aligned with real
  deployment, backup, restore, diagnostics, and smoke-test procedures.
- Rehearse installer and upgrade flow on a clean database.
- Define backup and restore procedures.
- Add error logging and admin diagnostics.
- Write deployment guidance.
- Write user training notes.
