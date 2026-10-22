# MJL Clarity System - Current UI Audit

MJL product decisions come from `docs/mjl-authoritative-decisions.md`. This
file records current repository-visible UI evidence, not user acceptance or
browser verification for this documentation update.

## React A1 evidence (DEC-094)

French auth screens follow the updated supplied composition and v3 tokens.
Focused Playwright checks exercise 375px layout, keyboard OTP entry, password
reveal, readonly email, inline errors, cross-tab/offline masking and dirty-form
worker deferral. No recovery, registration or admin-management screen was added.
These checks establish the exercised behavior; human visual/accessibility
acceptance remains unclaimed. Readiness §12 owns exact final verification results.

## Historical POC findings

- Activity list/planning/detail/review/chronology now load through REST. Existing
  tabs, dialogs, planning controls, Operation drawer and dirty-form guards are
  initialized after data loads. JavaScript is required. Human accessibility
  acceptance remains outstanding.

- All three reference screens now use the shared REST client. Focused browser
  checks cover their forms, lifecycle actions, mobile layout and JavaScript-required
  states. Mobile reference cells expand for wrapped labels instead of inheriting
  a fixed native row height. Human accessibility acceptance remains outstanding.

- Operation execution, expense approval/correction and exception screens use REST
  with existing cards, labeled controls, modal/dirty-form protection and bounded
  pagination. JavaScript is required. Four focused REST workflow checks passed;
  visual and manual accessibility acceptance remain outstanding.

- The custom-module workspace is the primary MJL interface. Business screens
  use French-first labels, scoped data, guarded actions, and shared presentation
  contracts for amounts, dates, feedback, and status.
- Tableau de bord composes role-specific indicators, permitted actions,
  execution progress, financial facts, and computed alerts from current scoped
  data. Admin sees only supported access, audit, and technical destinations.
- Partner and Project management uses shared responsive tables and progressive
  form/lifecycle dialogs while retaining current role reads, Validator-only
  mutation, immutable Project ownership. All three reference screens use REST and require JavaScript, with shared responsive tables, form/lifecycle dialogs and unsaved-form protection.
- Admin access uses shared responsive user and invitation tables with
  progressive invitation and account-action dialogs. It presents the current
  invitation delivery states and preserves Admin-only mutation, existing roles,
  guarded REST actions, dirty-state protection, and a no-JavaScript message.
- Login, OTP, invitation, forgotten-password, and reset states use one
  responsive auth shell with the Inter font, French copy, visible keyboard
  focus, generic recovery errors, and one logical six-digit OTP input.
- Activity planning/review, Opération execution, exception requests, contextual
  chronology, and audited PDF/XLSX/CSV reports are present. Report surfaces use
  shared responsive filters, visible active selections, complete-selection
  download actions, and chronological audit evidence. Business access is entity
  and assignment scoped; Admin remains technical and audit focused.
- Documents and document downloads are denied for every actor and method.
  Native ECM delivery paths are also denied. No document UI is active.
- The obsolete finance, validation, exchange-log, and roadmap screens are
  removed. The old supervision dashboard remains a denied route.
- Shared section headings and chronology now have one presentation owner across
  completed surfaces; dormant predecessor report and timeline selectors are
  removed. Focused browser evidence covers structural headings, duplicate IDs,
  representative reflow, coarse targets, reduced motion, forced colors,
  no-JavaScript fallback on unmigrated screens, and existing four-role route
  boundaries. Migrated REST screens require JavaScript and display that requirement
  when it is disabled.
- Signed human keyboard, screen-reader, zoom, reflow, forced-colors, and
  reduced-motion review remains outstanding. Client review of non-protected
  wording and official outputs is also outstanding. This audit does not claim
  WCAG conformance or production readiness.

## Active surfaces

| Screen | Current UI | Source |
| --- | --- | --- |
| Tableau de bord | Role-specific scoped indicators, permitted actions, execution progress, financial disclosure, and alert preview. | `custom/mjlfinancement/index.php` |
| Partenaires, Projets | Responsive status/parent lists, role-aware actions, progressive forms and lifecycle confirmation; Project ownership remains immutable. | `custom/mjlfinancement/partners.php`, `projects.php` |
| Types d’Opération | French-first reference list and forms with guarded lifecycle actions. | `custom/mjlfinancement/operationtypes.php` |
| Activities | Planning/review, derived execution and financial status, contextual chronology, and guarded cancellation request. | `custom/mjlfinancement/activities.php` |
| Opérations | Responsive execution cards, explicit amounts and lock states, and Agent exception forms. | `custom/mjlfinancement/operations.php` |
| Demandes d’exception | Filtered cancellation/reopening requests with Agent withdrawal and Validator decisions. | `custom/mjlfinancement/operationrequests.php` |
| Alertes | Computed, scoped alerts. | `custom/mjlfinancement/alerts.php` |
| Rapports | JavaScript-required REST filters and previews with guarded audited PDF/XLSX/CSV downloads for Activities, Opérations, Fiche Activité, portfolio, and audit. | `custom/mjlfinancement/reports.php`, `lib/api/mjl_api_reporting.lib.php` |
| Audit | Responsive chronological event history with recorded metadata/details and complete-selection downloads, restricted to Validator/Admin. | `custom/mjlfinancement/workflowactions.php` |
| Utilisateurs et accès | Responsive users/invitations, French delivery states, and progressive invitation, role-change, deactivation, and revocation dialogs for Admin only. | `custom/mjlfinancement/admin/access.php` |
| Invitation | Token redemption outside the app shell. | `custom/mjlfinancement/invitation.php` |
| Authentication and recovery | Email/password login, six-slot OTP, generic recovery states, and shared five-rule password creation. | `custom/mjlfinancement/auth.php`, `custom/mjlfinancement/core/tpl/*.tpl.php` |
| Documents | Denial-only routes with no document UI. | `custom/mjlfinancement/documents.php`, `documentdownload.php` |

## Review boundary

Preserve direct route and POST authorization, active-entity filtering,
invitation-only access, the document delivery denial, and guarded audited
exports. Future UI review should use the active inventory and the current
acceptance guide rather than historical phase test counts.
