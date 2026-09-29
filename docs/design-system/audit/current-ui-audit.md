# MJL Clarity System - Current UI Audit

MJL product decisions come from `docs/mjl-authoritative-decisions.md`. This
file records current repository-visible UI evidence, not user acceptance or
browser verification for this documentation update.

## Current findings

- The custom-module workspace is the primary MJL interface. Business screens
  use French-first labels, scoped data, guarded actions, and shared presentation
  contracts for amounts, dates, feedback, and status.
- Tableau de bord composes role-specific indicators, permitted actions,
  execution progress, financial facts, and computed alerts from current scoped
  data. Admin sees only supported access, audit, and technical destinations.
- Partner and Project management uses shared responsive tables and progressive
  form/lifecycle dialogs while retaining current role reads, Validator-only
  mutation, immutable Project ownership, and ordinary-form fallback.
- Activity planning/review, Opération execution, exception requests, contextual
  chronology, and audited PDF/XLSX/CSV reports are present. Business access is
  entity and assignment scoped; Admin remains technical and audit focused.
- Documents and document downloads are denied for every actor and method.
  Native ECM delivery paths are also denied. No document UI is active.
- The obsolete finance, validation, exchange-log, and roadmap screens are
  removed. The old supervision dashboard remains a denied route.
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
| Rapports | Scoped previews and guarded audited PDF/XLSX/CSV downloads for Activities, Opérations, Fiche Activité, portfolio, and audit. | `custom/mjlfinancement/reports.php`, `reportexport.php` |
| Audit | Filtered event history and detail, restricted to Validator/Admin. | `custom/mjlfinancement/workflowactions.php` |
| Utilisateurs et accès | Admin-only invitation and access management. | `custom/mjlfinancement/admin/access.php` |
| Invitation | Token redemption outside the app shell. | `custom/mjlfinancement/invitation.php` |
| Documents | Denial-only routes with no document UI. | `custom/mjlfinancement/documents.php`, `documentdownload.php` |

## Review boundary

Preserve direct route and POST authorization, active-entity filtering,
invitation-only access, the document delivery denial, and guarded audited
exports. Future UI review should use the active inventory and the current
acceptance guide rather than historical phase test counts.
