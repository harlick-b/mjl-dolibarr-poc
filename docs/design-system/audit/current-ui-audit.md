# MJL Clarity System - Current UI Audit

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file is current-state evidence only.

## Scope

This audit is documentation-only. It reflects repository-visible UI surfaces
after the documentation cleanup and does not replace browser verification.

## Overall Verdict

The current UI has a real MJL workspace shell, guarded routes, workflow
screens, dashboards, denial-only document routes, audit surfaces, and shared
presentation contracts for formatting, feedback, statuses, alerts, and
transactional emails. It still needs less legacy supervision wording, clearer
contextual timelines/exchanges, and final client review for non-protected copy
and official outputs.

## Global Findings

- The MJL workspace is custom-module based and should remain the primary user
  experience.
- Normal users should not need raw native Dolibarr project/document screens.
- RST-010A exposes no global document library, upload, or download behavior;
  custom and native document delivery paths are denial-only.
- The workflow audit screen exists; the obsolete exchange-log screen is
  removed.
- CSV/XLSX exports are the current output formats; PDF/Word reports are outside
  the current authoritative scope.
- Historical shared journey summaries and document panels are not current
  document behavior; exact finance recovery,
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
| Partenaires | Good | French-first reference list/detail/forms, lifecycle states, safe feedback, and 390-pixel containment are focused-browser verified. | `custom/mjlfinancement/partners.php` |
| Projets | Good | Guarded reference states expose only the display label for editing; immutable ownership/ref and parent lifecycle behavior are focused-browser verified. | `custom/mjlfinancement/projects.php` |
| Types d’Opération | Good | Entity-scoped active/inactive reference states use the shared RST-003 presentation and security contract. | `custom/mjlfinancement/operationtypes.php` |
| Activities | Implemented, pending gates | Four-section server-rendered planning form, Activity-scoped dynamic Opérations, textual balance, detail/review states, responsive layouts, and no-JavaScript submission are present. Signed keyboard/screen-reader/zoom/reflow/forced-color/reduced-motion evidence remains pending. | `custom/mjlfinancement/activities.php`, `custom/mjlfinancement/lib/mjl_activity_route.lib.php`, `custom/mjlfinancement/js/activities.js` |
| Opérations | Implemented, pending human gate | Read-only entity/assignment-scoped planning list uses shared table, money, pagination, and guarded Activity-link patterns. Signed keyboard/screen-reader/zoom/reflow/forced-color/reduced-motion evidence remains pending. | `custom/mjlfinancement/operations.php`, `custom/mjlfinancement/lib/mjl_operation_route.lib.php` |
| Expenses | Removed | Obsolete finance and contextual-upload route is absent. | `custom/mjlfinancement/expenses.php` |
| Documents | Contained | RST-010A exposes no document UI: custom and native delivery routes return HTTP 403 pending the sequenced Phase 4 implementation. | `custom/mjlfinancement/documents.php`, `custom/mjlfinancement/documentdownload.php` |
| Conventions | Removed | Obsolete finance and document behavior is absent. | `custom/mjlfinancement/conventions.php` |
| Budget lines | Removed | Obsolete finance route is absent and returns 404. | `custom/mjlfinancement/budgetlines.php` |
| Fund receipts | Removed | Obsolete finance and proof-document behavior is absent. | `custom/mjlfinancement/fundreceipts.php` |
| Reports / exports | Removed | Obsolete report-center route is absent and returns 404; target Phase 3B outputs are not implemented. | `custom/mjlfinancement/reports.php` |
| Validation history | Removed | Obsolete expense-validation route is absent and returns 404. | `custom/mjlfinancement/validations.php` |
| Workflow audit | Partial | Current technical audit route should become more contextual in later phases. | `custom/mjlfinancement/workflowactions.php` |
| Exchange logs | Removed | Obsolete exchange-log route is absent and returns 404. | `custom/mjlfinancement/exchangelogs.php` |
| Roadmap | Removed | Obsolete internal roadmap route is absent and returns 404. | `custom/mjlfinancement/roadmap.php` |
| Auth/invitations | Medium | Invitation-only stance and formal accented plain-text templates are aligned; production email/base URL remains pending. | Auth templates, `admin/access.php`, `invitation.php`, `lib/mjl_email.lib.php` |

## Review Checklist

- Preserve guarded routes and active-entity filtering.
- Preserve no public registration.
- Preserve RST-010A denial-only containment until the sequenced Phase 4
  implementation replaces it; do not restore contextual uploads or downloads.
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
- The signed accessibility harness now includes fourteen current archetypes,
  including Activity list/create/detail/edit/review, plus representative
  screen-reader, forced-colors, reduced-motion, and real-zoom evidence. It
  requires a recorded result, geometry, visible-focus observation, reviewer,
  keyboard/screen-reader/French findings, and non-empty notes for all 140
  combinations. No reviewer has signed this run:
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
