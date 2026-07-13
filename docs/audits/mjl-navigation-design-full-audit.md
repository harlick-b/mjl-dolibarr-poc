# MJL Navigation And Design Full Audit

## 1. Executive Verdict

Verdict: FAIL

Recommendation: NOT_DEMO_READY / NOT_PRODUCTION_READY

The MJL sidebar, dashboard landing, Projects page, read-only Documents page, contextual project comments, validation-history label, and Roadmap flag are substantially implemented. However, normal MJL users still see native Dolibarr chrome in the client-facing workspace, and direct native routes are not redirected to the MJL dashboard. Runtime evidence shows `/projet`, `/ecm`, `/societe`, `/comm`, and `/admin/modules.php` render native Dolibarr access-denied pages with old top chrome; `/hrm`, `/compta`, and `/modulebuilder` expose native workspace/error surfaces. This fails the target requirement that old Dolibarr UI must not be exposed to normal MJL users.

## 2. Repo State

- Branch: `main...origin/main [ahead 1]`
- Git status: dirty before this audit.
- Modified files before audit: `custom/mjlfinancement/activities.php`, `budgetlines.php`, `conventions.php`, `documents.php`, `exchangelogs.php`, `expenses.php`, `fundreceipts.php`, language files, `lib/mjl_alerts.lib.php`, `lib/mjl_dashboard.lib.php`, `lib/mjl_email.lib.php`, `lib/mjl_navigation.lib.php`, `partners.php`, `projects.php`, docs, and several E2E specs.
- Untracked files before audit: client/demo docs under `docs/` and `docs/prompts/`.
- Recent commits: `817f920 docs: add phase 13 UAT readiness pack`; `3f57ce0 Complete MJL feature alignment UAT pack`; `d637710 Implement MJL alert alignment`.
- Audit limitations: Repo is mid-change; audit findings may reflect uncommitted work.

## 3. Method And Evidence

- Static audit performed: yes.
- Runtime audit performed: yes, against `http://127.0.0.1:8080/`.
- Browser screenshots captured: yes, under `docs/audits/assets/`.
- Tests run: no. Existing E2E specs were inspected, but not run because they bootstrap/seed data and mutate users/documents/config.
- Database inspected: yes, read-only SQL via Docker confirmed sample users active and `MJL_SHOW_INTERNAL_ROADMAP=0`.
- Limitations: Login/logout was the only accepted runtime side effect. Document download links were inspected but not clicked because `documentdownload.php` audits downloads.

Screenshots captured:

- `docs/audits/assets/login-1366x768.png`
- `docs/audits/assets/agent-mjl-dashboard-1366x768.png`
- `docs/audits/assets/dashboard-agent-390x844.png`
- `docs/audits/assets/dashboard-agent-768x1024.png`
- `docs/audits/assets/projects-agent-1366x768.png`
- `docs/audits/assets/project-detail-agent-1366x768.png`
- `docs/audits/assets/documents-agent-1366x768.png`
- `docs/audits/assets/admin-poc-dashboard-1366x768.png`
- `docs/audits/assets/admin-access-1366x768.png`
- `docs/audits/assets/superviseur-n1-dashboard-1366x768.png`
- `docs/audits/assets/superviseur-n2-dashboard-1366x768.png`
- `docs/audits/assets/dpaf-mjl-dashboard-1366x768.png`
- `docs/audits/assets/lecteur-audit-dashboard-1366x768.png`

## 4. Target Decisions Checked

| Decision | Status | Evidence | Risk |
|---|---|---|---|
| MJL dashboard is post-login landing | OK for active sample business users | Runtime: `admin.poc`, `agent.mjl`, `superviseur.n1`, `superviseur.n2`, `dpaf.mjl`, and `lecteur.audit` landed on `/custom/mjlfinancement/index.php`. Static caveat: `ActionsMjlfinancement::redirectAfterConnection()` is no-op at `custom/mjlfinancement/class/actions_mjlfinancement.class.php:18`. | Medium |
| Unified MJL sidebar | Mostly OK | Central registry in `mjl_navigation_sections()` at `custom/mjlfinancement/lib/mjl_navigation.lib.php:31`; shell renderer at lines 193-223; runtime sidebars visible for active business users. | Medium |
| Hide old Dolibarr UI from normal users | Broken | Runtime: `agent.mjl` dashboard body includes `Rechercher`, `Mon tableau de bord`, `Configuration`, `Outils d'administration`, `Utilisateurs & Groupes`; native routes do not redirect. CSS only hides selected top menu anchors at `custom/mjlfinancement/css/mjl_app.css.php:4`. | Blocker |
| New MJL Projects page | Mostly OK | `projects.php` requires workspace access at line 12, renders MJL shell at lines 34-35, list at lines 127-165, detail at lines 167-198, native Dolibarr project table wrapper at lines 83-108 and 347-364. | Low |
| Project notes/comments timeline/list | OK | Notes/comment section renders ordered timeline at `custom/mjlfinancement/projects.php:303`; POST is contextual and guarded at lines 27-31 and 49-61. | Low |
| Global read-only Documents page | OK | Guard at `custom/mjlfinancement/documents.php:10`; read-only header at lines 24-29; no global upload copy at lines 61-63; secured download route links at line 83. | Low |
| Guarded document downloads | Mostly OK | Download route forbids missing/invalid rows at `custom/mjlfinancement/documentdownload.php:18-40`, audits at lines 42-43 and 92-110. Not clicked during audit to avoid audit-row mutation. | Low |
| Validations moved under Supervision and relabeled | Mostly OK | Navigation label is `Historique des validations` under Supervision at `custom/mjlfinancement/lib/mjl_navigation.lib.php:127-146`. Page title still says `Historique validations MJL` at `custom/mjlfinancement/validations.php:5`. | Medium |
| Échanges not primary navigation | Mostly OK | No `Échanges` entry in `mjl_navigation_sections()`; `exchangelogs.php` guarded as advanced traceability at `custom/mjlfinancement/exchangelogs.php:9`; POST creation forbidden at lines 14-15. | Low |
| Roadmap hidden by default | OK | Flag check at `custom/mjlfinancement/lib/mjl_workspace.lib.php:174`; admin-only access at lines 183-190; SQL query returned `MJL_SHOW_INTERNAL_ROADMAP 0`; runtime direct access returned 404/forbidden. | Low |
| Role-aware route guards | Partial | Route guards exist in workspace helpers, e.g. reference-data guards at `custom/mjlfinancement/lib/mjl_workspace.lib.php:30`; runtime showed expected forbidden pages for many MJL routes. Native-route guard did not redirect. | High |
| Coherent design system | Partial | MJL shell and CSS are consistent (`custom/mjlfinancement/css/mjl_app.css.php:36` onward), but native Dolibarr top chrome remains visible. | High |

## 5. Navigation Registry Audit

Navigation is centralized in `custom/mjlfinancement/lib/mjl_navigation.lib.php`. `mjl_navigation_sections()` defines grouped sections from user capabilities at lines 31-169. `mjl_navigation_quick_items()` derives dashboard quick links from the same sections at lines 172-181, skipping dashboard and administration. `mjl_navigation_shell_start()` renders one MJL sidebar with active section expansion at lines 193-223. No sidebar search bar is present in this renderer.

The primary target sections are mostly present, with one extra top-level section:

- Target present: Tableau de bord, Projets, Activités, Dépenses, Financement, Documents, Supervision, Administration.
- Extra present: Partenaires / Programmes.
- `Échanges` is not present as a primary registry item.
- Roadmap appears only when `roadmap_read` is true, which is admin plus flag.

Risk: dashboard quick links include all non-dashboard/non-admin sections, including `Partenaires / Programmes`. This is not directly prohibited by the audit target, but it expands the intended primary section set.

## 6. Role Visibility Matrix

| Role/User | Visible sections | Visible children | Missing expected links | Unexpected links | Notes |
|---|---|---|---|---|---|
| `admin.poc` | Tableau de bord; Partenaires / Programmes; Projets; Activités; Dépenses; Documents; Financement; Supervision; Administration | Children are shown only for active section; runtime dashboard sidebar showed primary sections. | Roadmap hidden because flag is off. | Partenaires / Programmes extra vs target list. | Native Dolibarr chrome visible in body snippet. |
| `agent.mjl` | Tableau de bord; Partenaires / Programmes; Projets; Activités; Dépenses; Documents; Supervision | Runtime dashboard primary sections. | None for operational workspace. | Supervision exists for alerts; Partenaires / Programmes extra vs target list. | Native Dolibarr chrome visible. |
| `superviseur.n1` | Tableau de bord; Partenaires / Programmes; Projets; Activités; Dépenses; Documents; Supervision | Runtime dashboard primary sections. | None observed. | Partenaires / Programmes extra vs target list. | Native Dolibarr chrome visible. |
| `superviseur.n2` | Tableau de bord; Partenaires / Programmes; Projets; Activités; Dépenses; Documents; Supervision | Runtime dashboard primary sections. | None observed. | Partenaires / Programmes extra vs target list. | Native Dolibarr chrome visible. |
| `dpaf.mjl` | Tableau de bord; Partenaires / Programmes; Projets; Activités; Dépenses; Documents; Financement; Supervision | Runtime dashboard primary sections. | Administration correctly absent. | Partenaires / Programmes extra vs target list. | Native Dolibarr chrome visible. |
| `lecteur.audit` | None | None | UNKNOWN: current authority says legacy `LECTEUR` has no production equivalent. | None. | Runtime landed on `/custom/mjlfinancement/index.php` but showed access denied and no MJL sidebar. |

Runtime evidence command output:

- `agent.mjl` sidebar: `Tableau de bord`, `Partenaires / Programmes`, `Projets`, `Activités`, `Dépenses`, `Documents`, `Supervision`.
- `dpaf.mjl` sidebar: same plus `Financement`.
- All role probes reported `nativeChrome: true` because body text included native Dolibarr top items.

## 7. Route Guard Matrix

| Route | Purpose | Visible? | Guard | Status | Issue |
|---|---|---:|---|---|---|
| `/custom/mjlfinancement/index.php` | MJL dashboard | Yes | `mjl_workspace_user_can_enter()` at `index.php:9` | OK for active roles | `lecteur.audit` access denied; aligns with unresolved legacy role. |
| `/custom/mjlfinancement/projects.php` | MJL Projects | Yes | `mjl_workspace_require_projects_access()` at `projects.php:12` | OK | Runtime accessible to `agent.mjl`; static scope filters at `projects.php:332`, `518-523`. |
| `/custom/mjlfinancement/documents.php` | Read-only document library | Yes | `mjl_workspace_require_documents_access()` at `documents.php:10` | OK | Runtime accessible to `agent.mjl`; no upload button observed in screenshot. |
| `/custom/mjlfinancement/activities.php` | Activities | Yes | `mjl_workspace_can_access_activity()` then `accessforbidden()` at `activities.php:15` | OK | Runtime accessible to `agent.mjl`. |
| `/custom/mjlfinancement/expenses.php` | Expenses | Yes | `mjl_workspace_can_access_expense()` at `expenses.php:15` | OK | Runtime accessible to `agent.mjl`. |
| `/custom/mjlfinancement/alerts.php` | Alerts | Yes for alert-capable users | `mjl_alerts_user_can_read()` at `alerts.php:9` | OK | Runtime accessible to `agent.mjl`. |
| `/custom/mjlfinancement/validations.php` | Validation history | Supervision child | `mjl_workspace_require_validation_history_access()` at `validations.php:4` | Mostly OK | Label mismatch on page title: `Historique validations MJL`, not exact sidebar label. |
| `/custom/mjlfinancement/dpafdashboard.php` | Finance supervision | Supervision child for final/admin | `mjl_workspace_require_supervision_access()` at `dpafdashboard.php:8` | OK | Route filename remains DPAF legacy debt. |
| `/custom/mjlfinancement/reports.php` | Reports/exports | Supervision child for final/admin | `mjl_workspace_require_supervision_access()` at `reports.php:18` | OK | Exports not clicked. |
| `/custom/mjlfinancement/conventions.php` | Funding envelopes | Finance child | `mjl_workspace_require_reference_data_access()` at `conventions.php:11` | OK | User-facing label still uses Enveloppe; route name legacy. |
| `/custom/mjlfinancement/budgetlines.php` | Budget lines | Finance child | `mjl_workspace_require_reference_data_access()` at `budgetlines.php:11` | OK | No runtime POST tested. |
| `/custom/mjlfinancement/fundreceipts.php` | Fund receipts | Finance child | `mjl_workspace_require_reference_data_access()` at `fundreceipts.php:9` | OK | No runtime POST tested. |
| `/custom/mjlfinancement/workflowactions.php` | Advanced audit | Supervision child for some roles | `mjl_workspace_require_advanced_traceability_access()` at `workflowactions.php:7` | Mostly OK | Admin runtime body included forbidden text in first full probe; needs targeted follow-up after native chrome fixed. |
| `/custom/mjlfinancement/exchangelogs.php` | Advanced exchange/audit search | Hidden from primary sidebar | `mjl_workspace_require_advanced_traceability_access()` at `exchangelogs.php:9` | OK for hidden/guarded route | Still accessible to final/admin by direct URL; acceptable only as advanced audit surface. |
| `/custom/mjlfinancement/admin/access.php` | Access admin | Administration child | Admin check at `admin/access.php:9` | OK | Runtime screenshot captured. |
| `/custom/mjlfinancement/roadmap.php` | Internal roadmap | Hidden by default | `mjl_workspace_require_roadmap_access()` at `roadmap.php:6` | OK default | Runtime direct access returned 404/forbidden with flag off. |
| `/custom/mjlfinancement/documentdownload.php` | Guarded document download | Not navigation | Type/row guards at `documentdownload.php:18-40` | Mostly OK | Not clicked to avoid audit mutation. |
| `/custom/mjlfinancement/invitation.php` | Token invitation | Not sidebar | Token logic in auth lib/route | Not fully runtime-audited | Existing E2E mutates invitation data; inspected only. |

## 8. Native Dolibarr Exposure Audit

Static implementation has three intended guard layers:

- CSS hides selected native menu items at `custom/mjlfinancement/css/mjl_app.css.php:4-33`.
- JS fallback guard defines denied prefixes and redirects to MJL at `custom/mjlfinancement/js/native_guard.js.php:15-60`.
- PHP hook `redirectRestrictedNativeWorkspace()` redirects denied native paths at `custom/mjlfinancement/class/actions_mjlfinancement.class.php:79-105`, with prefix list at lines 114-135.

Runtime shows those layers are insufficient:

| Route | User | Runtime result | Classification |
|---|---|---|---|
| `/projet/index.php` | `agent.mjl`, `dpaf.mjl` | Final URL stayed `/projet/index.php`; status 200; Dolibarr access-denied page with native chrome. | Blocker / UX + guard failure |
| `/ecm/index.php` | `agent.mjl`, `dpaf.mjl` | Final URL stayed `/ecm/index.php`; status 200; Dolibarr access-denied page with native chrome. | Blocker |
| `/societe/index.php` | `agent.mjl`, `dpaf.mjl` | Final URL stayed `/societe/index.php`; status 200; Dolibarr access-denied page with native chrome. | Blocker |
| `/comm/index.php` | `agent.mjl`, `dpaf.mjl` | Final URL stayed `/comm/index.php`; status 200; Dolibarr access-denied page with native chrome. | Blocker |
| `/admin/modules.php` | `agent.mjl`, `dpaf.mjl` | Final URL stayed `/admin/modules.php`; status 200; Dolibarr access-denied page with native chrome. | Blocker |
| `/core/tools.php` | `agent.mjl`, `dpaf.mjl` | Status 403 raw Apache forbidden; no MJL redirect. | High |
| `/hrm/index.php` | `agent.mjl`, `dpaf.mjl` | Status 200, final URL native, body includes `Espace RH`. | Blocker |
| `/compta/index.php` | `agent.mjl`, `dpaf.mjl` | Status 200, final URL native, body includes `Espace facturation et paiement`. | Blocker |
| `/modulebuilder/index.php` | `agent.mjl`, `dpaf.mjl` | Status 200, final URL native, body includes Module Builder access message. | Blocker |

The native UI is also visible on MJL pages: runtime snippets for `agent.mjl`, `superviseur.n1`, `superviseur.n2`, and `dpaf.mjl` include `Rechercher`, `Mon tableau de bord`, `Configuration`, `Outils d'administration`, and `Utilisateurs & Groupes`.

## 9. Dashboard Audit

The dashboard uses role-aware cards:

- Admin cards at `custom/mjlfinancement/index.php:36-53`.
- Agent cards at lines 56-75.
- Reviewer cards at lines 77-97.
- Final-validator/supervision cards at lines 99-115.
- Quick links are rendered from navigation registry at line 117.

The cards are MJL-relevant: invitations, reports, unresolved scope diagnostics, risks, execution, activities, expenses, missing documents, reviews. No client invoices, cheques, HR, accounting, billing, or commercial widgets were found in the custom dashboard card definitions.

Runtime risk: the page shell still includes native Dolibarr chrome, so users see old workspace affordances before/around MJL content. This is a demo blocker even if the custom dashboard content is aligned.

## 10. Projects Audit

- File exists: yes, `custom/mjlfinancement/projects.php`.
- Uses MJL shell/sidebar: yes, `llxHeader()` and `mjl_navigation_shell_start($user, 'projects')` at lines 34-35.
- Exposes native `/projet`: not as links in audited source; uses native Dolibarr `llx_projet` table as backend wrapper at lines 83-108 and 347-364.
- Project model classification: native Dolibarr project wrapper.
- List view: implemented at lines 127-165.
- Detail view: implemented at lines 167-198.
- Relations: conventions, budget lines, fund receipts, activities, expenses, documents are computed in base SQL and helper rows at lines 347-441.
- Role guards: route guard at line 12; create/update guarded by CSRF and `mjl_projects_can_manage_projects()` at lines 18-25; manage rule is admin or final validator at lines 547-550.
- Empty states: list and related tables include empty states at lines 141-143 and 237-240.
- Project alert logic: `mjl_projects_alert_rows()` at lines 444-454.
- Notes/comments: `Notes / Commentaires` timeline at lines 303-325, plus contextual comment POST at lines 27-31 and 49-61.
- Reader/Audit read-only: `lecteur.audit` currently cannot enter the MJL workspace; this is consistent with authority saying `LECTEUR` has no production role equivalent, but it means read-only audit persona behavior is not production-ready.
- Note creation audited: implemented via timeline helper call, but not POST-tested in this audit.

## 11. Documents Audit

- File exists: yes, `custom/mjlfinancement/documents.php`.
- Uses MJL shell/sidebar: yes, lines 21-23.
- Read-only: yes, header uses `Lecture seule` at lines 24-29.
- Generic upload button: no form or file upload button found in the global documents page; runtime screenshot confirms no visible upload button.
- Contextual upload explanation: line 62 says documents are added from activity, expense, envelope, fund receipt, or project object pages.
- Document sources aggregated: activities, expenses, conventions, fund receipts at lines 91-103.
- Filters present: type, project, date from/to at lines 39-55.
- Secure download links: yes, `documentdownload.php?type=...&id=...` at line 83.
- Raw file links: none found in the global documents table.
- Object-level permissions: source queries use entity and scope filters for activities/expenses/conventions/fund receipts at lines 118-120, 140-142, 160-162, and 182-184.
- Missing documents represented: no; the global library lists available documents and empty states, not missing expected documents.

## 12. Validations / Échanges / Roadmap Audit

Validations:

- Sidebar label is `Historique des validations` under Supervision at `custom/mjlfinancement/lib/mjl_navigation.lib.php:131-132`.
- Route works for authorized users in the first runtime probe.
- Page title is `Historique validations MJL` at `custom/mjlfinancement/validations.php:5`, which is close but not the exact target label.
- The page is read-only table output, not a live validation queue.

Échanges:

- No primary `Échanges` menu item in the central navigation registry.
- `exchangelogs.php` exists and is guarded by advanced traceability at `custom/mjlfinancement/exchangelogs.php:9`.
- POST creation is blocked with `Les echanges se creent depuis les pages contextuelles.` at lines 14-15.
- Project comments cover the communication need as a timeline/list at `custom/mjlfinancement/projects.php:303-325`.

Roadmap:

- Code uses `MJL_SHOW_INTERNAL_ROADMAP` at `custom/mjlfinancement/lib/mjl_workspace.lib.php:174-180`.
- Access requires admin plus flag at lines 183-190.
- Bootstrap default sets `MJL_SHOW_INTERNAL_ROADMAP` to `0` at `custom/mjlfinancement/scripts/bootstrap_poc.php:316`.
- Read-only SQL returned `MJL_SHOW_INTERNAL_ROADMAP 0`.
- Runtime direct access with flag off returned 404/forbidden.
- Enabled-state runtime was not tested because toggling the flag would mutate the persistent DB/config.

## 13. Design System Audit

Positive evidence:

- The MJL shell uses institutional palette, compact typography, 6px radii, cards, tables, status-like cards, and responsive grid behavior in `custom/mjlfinancement/css/mjl_app.css.php:36-260`.
- Auth page screenshot shows MJL-specific login copy and no public registration; runtime login page body: `MJL Financement ... Identifiant Mot de passe Connexion Mot de passe oublie`, `hasRegister=false`.
- Representative MJL screens were captured at desktop and smaller viewports.

Major design failure:

- Native Dolibarr top chrome remains visible on MJL pages for normal users. Runtime snippets include `Accueil`, `Rechercher`, `Mon tableau de bord`, `Configuration`, `Outils d'administration`, and `Utilisateurs & Groupes`.
- Native route access-denied pages are not MJL-styled, so direct-route failures break the unified app experience.

Responsive:

- Screenshots were captured at 1366x768, 768x1024, and 390x844 for the agent dashboard. No detailed pixel/overlap audit was performed beyond screenshot capture.

## 14. Test Coverage Audit

Existing relevant tests:

- `tests/e2e/phase5-workspace-shell.spec.js` covers role sidebars, Documents, Projects, Roadmap visibility, Échanges hidden, and native-route blocking. It explicitly updates `MJL_SHOW_INTERNAL_ROADMAP` at lines 270 and 275 and creates/deletes narrow users at lines 75-97.
- `tests/e2e/phase4-auth-access.spec.js` covers auth/invitation/password flows but mutates users, constants, invitations, resets, and audit rows at lines 29-44 and 80-82.
- `tests/e2e/phase8r-contextual-exchanges.spec.js` covers contextual exchanges and hidden global route but bootstraps/seeds and creates/deletes users/records at lines 41-75.
- `tests/e2e/phase18-activity-convention-documents.spec.js` covers activity/convention documents but bootstraps/seeds, inserts records, deletes records, and writes document fixtures at lines 49-122.
- `tests/e2e/phase11-expense-workflow.spec.js` covers guarded documents and expense workflow but mutates expense/document/test user data at lines 75-169.

Coverage gaps or stale tests:

- Native-route blocking tests appear stale relative to runtime: current runtime did not redirect native routes away from `/projet`, `/ecm`, `/societe`, `/comm`, or `/admin/modules.php`.
- Need non-mutating or isolated audit checks for demo readiness.
- Need screenshot or visual-regression checks that assert native top chrome is absent, not just selected menu labels.
- Need route-guard tests that distinguish raw Dolibarr access-denied pages from MJL-safe redirects/404/forbidden responses.

Tests run:

- None. Skipped because current E2E setup mutates persistent data through bootstrap/seed scripts, SQL writes, config toggles, and document fixture writes.

## 15. Documentation Drift

- `docs/design-system/audit/current-screen-inventory.md` says exchange logs are advanced and should not be primary navigation; this still matches source.
- `docs/design-system/audit/current-ui-audit.md` says global Documents is read-only and exchange logs should not be primary navigation; this matches source.
- `docs/mjl-current-vs-target-gap-analysis.md` still marks global Documents and contextual exchanges as partial pending runtime proof; this audit supplies proof but finds broader native UI blockers.
- Requested docs `docs/15-production-menu-scope.md` and `docs/mjl-financement-feature-coverage.md` were not found by repo scan; their absence is documentation drift relative to the audit prompt.
- Current docs do not reflect the runtime blocker that native Dolibarr chrome remains visible and native routes are not redirected.
- `docs/design-system/MJL_INFORMATION_ARCHITECTURE.md` still lists `Validations` as an information-architecture item, while the current target label is `Historique des validations`.

## 16. Issues Found

### Blockers

ID: NAV-BLOCKER-001  
Severity: Blocker  
Area: Native Dolibarr exposure  
Finding: Normal MJL users still see native Dolibarr top chrome on MJL workspace pages.  
Evidence: Runtime `agent.mjl` dashboard body includes `Rechercher`, `Mon tableau de bord`, `Configuration`, `Outils d'administration`, `Utilisateurs & Groupes`; screenshot `docs/audits/assets/agent-mjl-dashboard-1366x768.png`. CSS hides selected menu anchors only at `custom/mjlfinancement/css/mjl_app.css.php:4-33`.  
Impact: Client-facing workspace still looks like Dolibarr, not a unified MJL application.  
Recommended fix: Hide or replace the native Dolibarr top/header chrome for normal MJL workspace users within a safe custom-module/theme/hook boundary; keep admin technical escape hatch explicit.  
Files likely affected: `custom/mjlfinancement/css/mjl_app.css.php`, `custom/mjlfinancement/class/actions_mjlfinancement.class.php`, module hook/theme configuration.  
Test needed: Browser test asserting normal users do not see native top chrome text or native menu links on MJL pages.

ID: NAV-BLOCKER-002  
Severity: Blocker  
Area: Native route guards  
Finding: Direct native routes are not redirected or safely hidden from normal MJL users.  
Evidence: Runtime `agent.mjl` and `dpaf.mjl`: `/projet/index.php`, `/ecm/index.php`, `/societe/index.php`, `/comm/index.php`, and `/admin/modules.php` stayed on native URLs and rendered Dolibarr access-denied pages with native chrome; `/hrm/index.php` rendered `Espace RH`; `/compta/index.php` rendered `Espace facturation et paiement`; `/modulebuilder/index.php` rendered Module Builder access text. Static intended PHP guard is at `custom/mjlfinancement/class/actions_mjlfinancement.class.php:79-105`.  
Impact: Old Dolibarr interface is exposed by direct URL, blocking demo readiness.  
Recommended fix: Make the server-side native-route guard actually execute for these contexts, or enforce equivalent Apache/PHP route blocking before native Dolibarr pages render.  
Files likely affected: `custom/mjlfinancement/class/actions_mjlfinancement.class.php`, `custom/mjlfinancement/deployment/apache-native-guard.conf`, module hook registration.  
Test needed: Direct-route tests requiring redirect to MJL dashboard, 404, or MJL-safe forbidden response for each target native route.

### High

ID: NAV-HIGH-001  
Severity: High  
Area: Native guard JS/PHP reliability  
Finding: Static JS and PHP guards define denied prefixes, but runtime shows they do not prevent native page rendering.  
Evidence: JS guard at `custom/mjlfinancement/js/native_guard.js.php:15-60`; PHP guard at `custom/mjlfinancement/class/actions_mjlfinancement.class.php:79-148`; runtime native routes not redirected.  
Impact: The intended defense-in-depth is not effective.  
Recommended fix: Verify hook context execution on native pages, script inclusion on native pages, and Apache guard coverage; add logging or tests around guard activation.  
Files likely affected: hook class, module descriptor, Apache guard config.  
Test needed: Runtime tests that assert final URL/status and absence of native chrome.

ID: UI-HIGH-001  
Severity: High  
Area: Unified design system  
Finding: Direct forbidden pages use native Dolibarr chrome, not the MJL shell.  
Evidence: Runtime forbidden snippets for `/custom/mjlfinancement/validations.php` as `agent.mjl` and native routes show Dolibarr header text and no MJL sidebar.  
Impact: Access-denied states are visually inconsistent and expose old UI.  
Recommended fix: Provide MJL-safe forbidden/404 handling for guarded custom and native routes where possible.  
Files likely affected: workspace guard helpers, hook/redirect layer, possibly custom error template.  
Test needed: Screenshot/accessibility test for forbidden states.

### Medium

ID: NAV-MED-001  
Severity: Medium  
Area: Validations wording  
Finding: Sidebar label is target-compliant, but page title is `Historique validations MJL` rather than exact `Historique des validations`.  
Evidence: Sidebar label at `custom/mjlfinancement/lib/mjl_navigation.lib.php:131-132`; page title at `custom/mjlfinancement/validations.php:5`.  
Impact: Wording inconsistency in client-facing supervision.  
Recommended fix: Align route title and visible heading to `Historique des validations`.  
Files likely affected: `custom/mjlfinancement/validations.php`, language files if used.  
Test needed: UI text assertion for sidebar and page heading.

ID: DOC-MED-001  
Severity: Medium  
Area: Documentation drift  
Finding: Requested drift docs `docs/15-production-menu-scope.md` and `docs/mjl-financement-feature-coverage.md` are absent.  
Evidence: `rg --files docs` did not find those paths.  
Impact: Audit references cannot be reconciled against those docs.  
Recommended fix: Either recreate current docs with authoritative content or remove references from active prompts/checklists.  
Files likely affected: `docs/mjl-docs-index.md`, active audit/checklist docs.  
Test needed: Documentation index check.

ID: DOC-MED-002  
Severity: Medium  
Area: Runtime evidence documentation  
Finding: Current docs do not mention the observed native chrome/native route blocker.  
Evidence: `docs/design-system/audit/current-ui-audit.md` says the current UI has a real MJL workspace shell but does not record direct native route exposure.  
Impact: Product readiness docs overstate current client-facing UX safety.  
Recommended fix: Update current-vs-target gap analysis after fixes or as part of issue tracking.  
Files likely affected: `docs/mjl-current-vs-target-gap-analysis.md`, design-system audit docs.  
Test needed: N/A documentation.

### Low

ID: UI-LOW-001  
Severity: Low  
Area: Project terminology  
Finding: Some project/status labels retain compatibility wording such as `Validee definitivement (compatibilite historique)`.  
Evidence: `custom/mjlfinancement/projects.php:631`.  
Impact: Minor client wording debt.  
Recommended fix: Replace compatibility wording on user-facing screens once data migration semantics are confirmed.  
Files likely affected: `custom/mjlfinancement/projects.php`, language files.  
Test needed: UI text assertion.

## 17. Loopholes / Unknowns

Unknown: Enabled Roadmap behavior when `MJL_SHOW_INTERNAL_ROADMAP=1`.  
Why it matters: Target requires visible only to Admin.  
How to verify next: Run in isolated DB or temporary clean-install project and toggle flag there.

Unknown: Whether document download guards allow every expected object-specific case.  
Why it matters: Downloads are security-sensitive and audited.  
How to verify next: Run isolated E2E or smoke checks that can safely create/download fixture documents.

Unknown: Whether native route guard failure comes from hook not firing, JS not loaded early enough, Apache config not matching, or CSS selector incompleteness.  
Why it matters: Fix path depends on actual guard failure point.  
How to verify next: Add temporary diagnostic logging in an isolated branch/test environment or inspect loaded scripts/headers on native pages.

Unknown: Final client-approved permission matrix.  
Why it matters: `lecteur.audit` is active but has no production role equivalent per authority.  
How to verify next: Confirm role disposition and update sample users/tests accordingly.

Unknown: Full mobile visual quality.  
Why it matters: Screenshots were captured, but no exhaustive overlap/pixel audit was performed.  
How to verify next: Run focused Playwright screenshot review after native chrome blocker is fixed.

## 18. Recommended Fix Plan

### Phase 1 - Safety / blockers

- Fix server-side native route interception so normal MJL users never see old Dolibarr native pages for `/projet`, `/ecm`, `/societe`, `/comm`, `/hrm`, `/compta`, `/modulebuilder`, `/admin/*`, and the other listed native routes.
- Remove or replace native Dolibarr top chrome for normal MJL workspace pages.
- Ensure forbidden/404 responses for normal users are MJL-safe, not native Dolibarr pages.

### Phase 2 - Navigation correctness

- Keep central registry as the only source for MJL sidebar and quick links.
- Decide whether `Partenaires / Programmes` is intentionally a primary section; document the decision if kept.
- Align `validations.php` visible title with `Historique des validations`.

### Phase 3 - Design consistency

- Re-audit desktop/tablet/mobile screenshots after native chrome is hidden.
- Verify login, password reset, invitation, dashboard, Projects, Documents, activities, expenses, finance, supervision, admin, and forbidden states all use one visual system.

### Phase 4 - Tests

- Add or repair direct native-route tests so they assert final URL/status and absence of native chrome, not just access denied text.
- Add non-mutating smoke tests or run existing mutating E2E only in isolated clean-install projects.
- Add visual/text assertions that normal users do not see `Rechercher`, `Mon tableau de bord`, `Configuration`, `Outils d'administration`, `Tiers`, `Projets` native top menu, `ECM`, `GRH`, or accounting/billing workspace labels.

### Phase 5 - Documentation

- Update `docs/mjl-current-vs-target-gap-analysis.md` with the native UI blocker until fixed.
- Reconcile missing/stale docs referenced by audit prompts.
- Update design-system current audit after fixes and browser proof.

## 19. Final Answer

Can we safely proceed to implementation fixes? Yes.

Top 5 fixes to do next:

1. Make native route blocking effective server-side for normal MJL users.
2. Remove native Dolibarr top/header chrome from normal MJL workspace pages.
3. Replace native access-denied/error surfaces with MJL-safe forbidden/404 handling.
4. Repair/add E2E tests for native route blocking and absence of old UI chrome.
5. Align validation-history wording and update current-vs-target docs with this audit evidence.
