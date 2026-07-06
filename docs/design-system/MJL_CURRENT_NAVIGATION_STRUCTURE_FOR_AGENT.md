# MJL Current Navigation Structure For Agent

Note: `AGENTS.md` is the canonical in-repo agent instruction layer. This file
is retained as navigation context; if it conflicts with `AGENTS.md`, follow
`AGENTS.md`.

## Purpose

This document gives an online agent the current repo-visible navigation context
for the MJL Dolibarr POC. It is current-state documentation, not a target
proposal.

Primary evidence:

- `custom/mjlfinancement/lib/mjl_navigation.lib.php`
- `custom/mjlfinancement/lib/mjl_workspace.lib.php`
- `custom/mjlfinancement/class/actions_mjlfinancement.class.php`
- `custom/mjlfinancement/js/native_guard.js.php`
- `custom/mjlfinancement/css/mjl_app.css.php`
- `docs/15-production-menu-scope.md`
- `docs/mjl_navigation_unification_phase_tracker.md`

## Navigation Layers

1. Dolibarr top module entry
   - Label: `Financement MJL`.
   - URL: `/custom/mjlfinancement/index.php`.
   - Declared in `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`.
   - Visible to internal users with at least one relevant MJL read right.

2. MJL sidebar shell
   - Rendered by `mjl_navigation_shell_start($user, $activeKey)`.
   - Source of truth: `mjl_navigation_sections($user)`.
   - Compatibility flattening: `mjl_navigation_items($user)`.
   - Children are shown only for the active section.

3. Dashboard and quick links
   - Dashboard cards are role-aware helpers into MJL routes.
   - Quick links are generated from visible navigation sections.
   - `dashboard`, `administration`, and hidden/internal surfaces are excluded.

4. Contextual object links
   - Detail pages and alerts link to guarded object routes such as
     `activities.php?id=...`, `expenses.php?id=...`, and
     `projects.php?id=...`.
   - Document downloads use `documentdownload.php` and remain contextual helper
     links, not navigation destinations.

5. Auth and invitation flows
   - Login/password reset use Dolibarr auth routes with MJL templates.
   - Invitation acceptance uses `/custom/mjlfinancement/invitation.php`.
   - These flows are not sidebar navigation entries.

## Current Sidebar Sections

| Section key | Label | Main URL | Main visibility | Typical children |
| --- | --- | --- | --- | --- |
| `dashboard` | Tableau de bord | `/custom/mjlfinancement/index.php` | Any readable MJL workspace user | None |
| `projects` | Projets | `/custom/mjlfinancement/projects.php` | Project-capable MJL users | None |
| `activities` | Activités | `/custom/mjlfinancement/activities.php` | `activity/read` | `Alertes` when activity or expense alerts are readable |
| `expenses` | Dépenses | `/custom/mjlfinancement/expenses.php` | `expense/read` | None |
| `documents` | Documents | `/custom/mjlfinancement/documents.php` | Document-capable MJL users | None |
| `finance` | Financement | `/custom/mjlfinancement/conventions.php` or another visible finance child | Supervision plus finance/reference rights | `Conventions`, `Budgets`, `Fonds reçus`, `Exports` |
| `supervision` | Supervision | `/custom/mjlfinancement/dpafdashboard.php` or another visible supervision child | Supervision, validation history, or advanced audit capability | `Tableau DPAF`, `Historique des validations`, `Historique / Audit` |
| `administration` | Administration | `/custom/mjlfinancement/admin/access.php` | Admin only | `Invitations`; `Preparation production` only when `MJL_SHOW_INTERNAL_ROADMAP=1` |

Hidden but still guarded:

- `/custom/mjlfinancement/exchangelogs.php` is no longer visible in sidebar,
  quick links, or dashboard cards. It remains directly guarded for eligible
  advanced traceability users.
- `/custom/mjlfinancement/roadmap.php` is disabled by default. It requires
  Admin plus `MJL_SHOW_INTERNAL_ROADMAP=1`.

## Route Catalog

| Route | Purpose | Navigation status | Guard summary |
| --- | --- | --- | --- |
| `/custom/mjlfinancement/index.php` | MJL dashboard | Sidebar section | `mjl_workspace_user_can_read()` |
| `/custom/mjlfinancement/projects.php` | Native Dolibarr projects through MJL wrapper, including project notes | Sidebar section | `mjl_workspace_require_projects_access()` plus scoped project checks |
| `/custom/mjlfinancement/activities.php` | Activity workflow and documents | Sidebar section | `activity/read`; object scope through activity access helpers |
| `/custom/mjlfinancement/alerts.php` | Activity and expense alerts | Active-section child | Alert read helper using activity/expense rights |
| `/custom/mjlfinancement/expenses.php` | Expense workflow and documents | Sidebar section | `expense/read`; object scope through expense access helpers |
| `/custom/mjlfinancement/documents.php` | Read-only document library | Sidebar section | `mjl_workspace_require_documents_access()` plus object download guards |
| `/custom/mjlfinancement/conventions.php` | Convention reference management and documents | Finance child | Supervision plus `convention/read`; mutations require write/manage checks |
| `/custom/mjlfinancement/budgetlines.php` | Budget line management | Finance child | Supervision plus `budgetline/read`; mutations require write/manage checks |
| `/custom/mjlfinancement/fundreceipts.php` | Fund receipt management and proof documents | Finance child | Supervision plus `fundreceipt/read`; mutations require write/manage checks |
| `/custom/mjlfinancement/reports.php` | Official exports | Finance child | Supervision; export actions require Admin or `export/write` |
| `/custom/mjlfinancement/dpafdashboard.php` | DPAF supervision dashboard | Supervision child | `mjl_workspace_require_supervision_access()` |
| `/custom/mjlfinancement/validations.php` | Validation history | Supervision child | `mjl_workspace_require_validation_history_access()` |
| `/custom/mjlfinancement/workflowactions.php` | Advanced workflow audit | Supervision child | `mjl_workspace_require_advanced_traceability_access($user, 'workflowaction')` |
| `/custom/mjlfinancement/exchangelogs.php` | Advanced exchange log | Hidden from navigation | `mjl_workspace_require_advanced_traceability_access($user, 'exchangelog')` |
| `/custom/mjlfinancement/admin/access.php` | Invitation-only access management | Administration child | Admin only |
| `/custom/mjlfinancement/roadmap.php` | Internal roadmap | Hidden unless flag enabled | Admin plus `MJL_SHOW_INTERNAL_ROADMAP=1` |
| `/custom/mjlfinancement/documentdownload.php` | Guarded document download endpoint | Contextual helper only | Object-specific guards |
| `/custom/mjlfinancement/invitation.php` | Public invitation activation | Not sidebar navigation | Token-controlled public flow |

## Document Library Rules

`/custom/mjlfinancement/documents.php` aggregates only documents that remain
downloadable through the existing guarded MJL endpoint:

- Activities use `mjl_activity_document_download_rows()`.
- Expenses use `mjl_expense_document_download_rows()`.
- Conventions use `mjl_convention_document_download_rows()`.
- Fund receipts use `mjl_fund_receipt_document_download_rows()`.

The page is read-only. Uploads remain contextual on the governed object pages.
The document library must not expose raw ECM links.

## Native Dolibarr Controls

Normal MJL business users should stay inside the MJL workspace. Native
Dolibarr records are still used as backend data where appropriate, especially
third parties, projects, and stored documents.

Current control layers:

- CSS hides native top-menu entries in `mjl_app.css.php`.
- The module loads `native_guard.js.php` as a browser-side fallback.
- `ActionsMjlfinancement::redirectRestrictedNativeWorkspace()` redirects
  restricted native paths for authenticated non-admin MJL users.
- `custom/mjlfinancement/deployment/apache-native-guard.conf` can block
  selected technical native routes at Apache level in the local deployment.

Server-side restricted prefixes for non-admin MJL users include:

- `/societe`
- `/comm`
- `/projet`
- `/ecm`
- `/expensereport`
- `/hrm`
- `/holiday`
- `/modulebuilder`
- `/api`
- `/core/tools.php`
- `/commande`
- `/fourn`
- `/compta`
- `/accountancy`
- `/banque`
- `/tax`
- `/admin/tools`
- `/admin/system`
- `/admin/dict`
- `/admin/modules.php`

`/index.php` and `/custom/mjlfinancement/...` remain allowed.

## Role Notes

The POC sample profiles are:

| Login | Profile |
| --- | --- |
| `admin.poc` | Admin |
| `agent.mjl` | Operational user |
| `superviseur.n1` | Reviewer N1 |
| `superviseur.n2` | Reviewer N2 |
| `dpaf.mjl` | DPAF supervision |
| `lecteur.audit` | Read-only audit |

Sidebar visibility is capability-based, not only raw read-right based.

## Do Not Treat As Navigation

Do not surface these implementation/support paths as user navigation:

- `custom/mjlfinancement/scripts/*`
- `custom/mjlfinancement/class/*`
- `custom/mjlfinancement/lib/*`
- `custom/mjlfinancement/sql/*`
- `custom/mjlfinancement/css/*`
- `custom/mjlfinancement/js/*`
- `custom/mjlfinancement/core/tpl/*`
- `custom/mjlfinancement/sample_data/*`
- `custom/mjlfinancement/deployment/*`
- `custom/mjlfinancement/documentdownload.php`
- `custom/mjlfinancement/invitation.php`

## Verification Checklist

Before using this document as source context, verify:

- Sidebar rows still match `mjl_navigation_sections()`.
- Direct route guards still match the PHP routes.
- Native denied prefixes still match `ActionsMjlfinancement`.
- Browser fallback prefixes still match `native_guard.js.php`.
- `MJL_SHOW_INTERNAL_ROADMAP` still defaults to `0`.
- Full E2E evidence remains current after navigation changes.
