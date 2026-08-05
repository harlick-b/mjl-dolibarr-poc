# MJL Clarity System - Current UI Audit

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file is current-state evidence only.

## Scope

This audit is documentation-only. It reflects repository-visible UI surfaces
after the documentation cleanup and does not replace browser verification.

## Overall Verdict

The current UI has a real MJL workspace shell, guarded routes, workflow
screens, dashboards, documents, exports, audit surfaces, and shared
presentation contracts for formatting, feedback, statuses, alerts, and
transactional emails. It still needs less legacy supervision wording, clearer
contextual timelines/exchanges, and final client review for non-protected copy
and official outputs.

## Global Findings

- The MJL workspace is custom-module based and should remain the primary user
  experience.
- Normal users should not need raw native Dolibarr project/document screens.
- Global Documents is read-only; uploads are contextual.
- Guarded downloads are implemented for key document paths.
- Advanced audit and exchange screens exist but should remain contextual or
  supervision/audit-only.
- CSV/XLSX exports are the current output formats; PDF/Word reports are outside
  the current authoritative scope.
- Shared journey summaries, guarded document panels, exact finance recovery,
  resource pagination, contextual timelines, and enriched dashboard-card
  metadata now have catalog definitions. Their callers retain all server
  authorization.
- Touched finance routes distinguish allowlisted validation, database,
  timeline, and unknown feedback without exposing raw diagnostics. Unrelated
  lower-level diagnostic handling debt remains tracked in the current-vs-target
  analysis.
- Operation outcomes render in the server response through closed French
  message contracts; success uses status semantics and warnings/errors use
  alert semantics. Computed business alerts remain a separate collection.
- Shared presentation text distinguishes numeric zero from unavailable data,
  uses `F CFA` and French date shapes, and rejects unsafe action destinations.
- Business status labels are surface-aware, while stored values, workflow
  transitions, audit history, and protected export mappings remain unchanged.
- Some labels and route names still use legacy DPAF/Convention wording; treat
  that as UI terminology debt.

## Screen Findings

| Screen | Alignment | Main UI Debt | Safe Area |
| --- | --- | --- | --- |
| Workspace dashboard | Medium | Enriched cards now expose definition, scope, period, freshness, destination, and local source failure; final client KPI wording can still be reviewed. | `custom/mjlfinancement/index.php` |
| Supervision dashboard | Medium | Production role wording, scoped filters, and audit-row resolution are aligned; route filename remains compatibility debt. | `custom/mjlfinancement/dpafdashboard.php` |
| Partenaires / Programmes | Partial | Needs current browser review for production scope clarity. | `custom/mjlfinancement/partners.php` |
| Projects | Medium | Dedicated guarded create/edit states, shared scoped filters/pagination and list states, and responsive operational cards are browser-verified; dense related-detail tables remain separate. | `custom/mjlfinancement/projects.php` |
| Activities | Medium | Dedicated guarded create/edit/execution/contextual-upload and verifier/final-validator decision states plus shared scoped filters/pagination and responsive list cards are browser-verified; short submission/correction comments remain contextual and wording review remains. | `custom/mjlfinancement/activities.php` |
| Expenses | Medium | Dedicated guarded create/edit/contextual-upload/prevalidation/final-validation/rejection/disbursement states plus shared scoped filters/pagination and responsive operational cards are browser-verified; short submission/correction comments remain contextual and wording review remains. | `custom/mjlfinancement/expenses.php` |
| Documents | Good | Read-only model is correct; filters and document ergonomics can improve. | `custom/mjlfinancement/documents.php` |
| Conventions | Medium | Shared journey/document/recovery/pagination/timeline patterns and canonical feedback are present; legacy label and role wording still need target review. | `custom/mjlfinancement/conventions.php` |
| Budget lines | Medium | Shared journey/recovery/pagination/timeline patterns and canonical feedback are present; advanced finance setup must stay guarded. | `custom/mjlfinancement/budgetlines.php` |
| Fund receipts | Medium | Shared journey/document/recovery/pagination/timeline patterns and canonical feedback are present; final wording remains pending client review. | `custom/mjlfinancement/fundreceipts.php` |
| Reports / exports | Good | The report inventory uses target French wording, explicit Partenaire / Programme filters, POST-token exports, CSV/XLSX filename previews, scoped audit visibility, distinct HTML/export rows, and explicit F CFA money headings. Final donor canevas and permission matrix remain pending. | `custom/mjlfinancement/reports.php` |
| Validation/audit history | Partial | Should be more contextual inside object detail pages. | `validations.php`, `workflowactions.php` |
| Exchange logs | Partial | Standalone route should not be primary navigation. | `custom/mjlfinancement/exchangelogs.php` |
| Auth/invitations | Medium | Invitation-only stance and formal accented plain-text templates are aligned; production email/base URL remains pending. | Auth templates, `admin/access.php`, `invitation.php`, `lib/mjl_email.lib.php` |

## Review Checklist

- Preserve guarded routes and active-entity filtering.
- Preserve no public registration.
- Preserve contextual uploads and guarded downloads.
- Preserve CSV/XLSX-only scope unless authority changes.
- Use `docs/mjl-authoritative-decisions.md` for terminology and role decisions.

## Phase 3D.2 gate evidence

Guarded operational states and conditional record menus are browser-verified.
The operational matrix passed 42/42, and the shell/table regression matrix
passed 41/41. Native no-JavaScript menu fallback, keyboard focus restoration,
escaping, empty suppression, and 390-pixel viewport containment are covered.

The unsigned manual accessibility matrix and real 200% browser-zoom evidence
remain release blockers. This checkpoint does not claim WCAG conformance.

## Phase 3D.3 gate evidence

The presentation layer now has closed contracts for French formatters,
operation feedback, status surfaces, alert tone/copy/destinations, safe links,
transactional email templates, and HTML-versus-export report rows. Static PHP
contracts reject direct native-event calls outside the adapter and cover
formatter/status/feedback/alert/link edge cases. Browser regression remains
the affected-surface evidence boundary for this checkpoint. The completed
worktree passed 92/92 consolidated browser cases and 21/21 characterization
cases in separate disposable tenants, with cleanup verified after each run.

Client approval of non-protected wording, the signed keyboard/reflow/real-zoom
matrix, final design/security/production-readiness audits, and the complete
Phase 3D verdict remain deferred to Phase 3D.4. This audit does not claim WCAG
conformance, production readiness, or whole-Phase-3D completion.

## Phase 3D.4 integration audit

- The active inventory has an exact title/H1/main/shell browser contract for
  all sixteen application screens, safe contracts for auxiliary routes,
  route-by-route Agent scope checks on the dashboard plus six displayed
  business routes, and authenticated no-role denial. Current advanced-route
  admissions are isolated in characterization C2 pending client authority.
- Security and production audits found a high-risk web exposure of operational
  scripts. It was corrected with an Apache family deny, a shared CLI-only
  defense on every operational entrypoint, and anonymous HTTP regression.
- Formal-French residuals on dashboard, activity/expense timelines, and access
  scope summaries were corrected. Non-protected labels, emails, and CSV/XLSX
  output still require client approval: `BLOCKED_PENDING_CLIENT_REVIEW`.
- The signed accessibility harness now includes auth, dashboard, list, form,
  workflow, Documents, alert, report, and administration archetypes plus
  representative screen-reader and real-zoom evidence. It requires a recorded
  result, geometry, visible-focus observation, reviewer, and non-empty notes for
  all 90 combinations. No reviewer has signed this run:
  `BLOCKED_PENDING_MANUAL_ACCESSIBILITY`.
- The final strengthened-remediation run passed the complete local verification
  layer and 114/114 blocking browser cases in a disposable tenant. Separate
  characterization passed 28/28. Both tenants and their named resources were
  removed.
- The retired v2 `FACT-001` remains recoverable in Git history and is
  reconciled by the current green unresolved-scope verifier.

Automated design and security evidence has no open high-risk finding after
remediation. This remains a local integration result, not WCAG conformance or
production-readiness approval.
