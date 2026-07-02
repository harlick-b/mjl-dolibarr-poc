# MJL Navigation Unification, Dashboard, Projects, Documents, Notes, And Native UI Cleanup

Phase execution is tracked in:

```text
docs/mjl_navigation_unification_phase_tracker.md
```

## 0. Mission

Implement a clean MJL-first navigation and workspace experience for the MJL Dolibarr POC.

The user-facing app must feel like a dedicated MJL application, not like raw Dolibarr.

Dolibarr may remain the backend engine, but normal MJL users must interact only with the custom MJL UI.

Do not modify Dolibarr core.

Keep implementation under:

```text
custom/mjlfinancement/
```

unless tests or documentation require changes elsewhere.

## 1. Current Context

The current repo-visible navigation is split across several layers:

```text
- Dolibarr top module entry
- MJL sidebar shell
- dashboard cards / quick links
- contextual object links
- auth and invitation flows
- CSS-hidden native Dolibarr menus
- PHP hook redirects for native routes
- JavaScript fallback guard
- route-level PHP guards
```

This is acceptable for a POC, but the target is a single coherent MJL workspace.

Current known MJL landing route:

```text
/custom/mjlfinancement/index.php
```

Do not invent `/dashboard.php`.

If a dashboard abstraction already exists, inspect it first. Otherwise, keep `/custom/mjlfinancement/index.php` as the MJL dashboard and post-login landing page.

## 2. Product Decisions To Implement

### 2.1 Landing Page

After login, users must land on:

```text
/custom/mjlfinancement/index.php
```

This page becomes the real MJL home page.

The old Dolibarr Accueil/dashboard must not be the normal user landing page.

### 2.2 Unified Sidebar

Create one unified MJL sidebar.

Primary sections:

```text
Tableau de bord
Projets
Activités
Dépenses
Financement
Documents
Supervision
Administration
```

Rules:

```text
- No search bar in the sidebar.
- Only primary sections are visible by default.
- When a section is active, show its children.
- The current page must be visually highlighted.
- Sidebar visibility must be role-aware.
- Sidebar visibility is not security.
- Every route must keep server-side access checks.
- Do not duplicate navigation definitions inside individual pages.
```

The top Dolibarr navbar should ultimately disappear from the MJL workspace, but do not remove it blindly before proving that all required MJL routes are reachable through the new sidebar.

### 2.3 Native Dolibarr Projects

Native Dolibarr `/projet` must disappear from the MJL user experience.

Do not expose the old Dolibarr Projects interface to DPAF, Admin, or normal MJL users as part of the client-facing workspace.

Instead, create a custom MJL projects page:

```text
/custom/mjlfinancement/projects.php
```

This page may use Dolibarr project data internally if the repo already relies on it, but users must never be sent to the native `/projet` interface.

### 2.4 Documents

Create a global read-only MJL Documents page:

```text
/custom/mjlfinancement/documents.php
```

Documents page purpose:

```text
- consultation
- search
- filtering
- audit
- secure download
```

Uploads must remain contextual.

Documents are uploaded from the related:

```text
- project
- activity
- expense
- convention
- fund receipt
```

Do not create a generic global upload button.

Do not expose raw Dolibarr ECM to normal users.

Use MJL-controlled secure document download links.

### 2.5 Validations

Rename the visible navigation label:

```text
Validations
```

to:

```text
Historique des validations
```

Place it under:

```text
Supervision
```

Do not keep it as a primary sidebar item.

Reason: the current route behaves more like a read-only validation history than a live validation queue.

If a real pending validation queue is added later, it must be separate from this history page.

### 2.6 Échanges

Remove `Échanges` as a standalone sidebar/menu feature.

Do not show it in:

```text
- sidebar
- quick links
- dashboard cards
- client-facing navigation
```

Replace the product need with contextual project notes/comments.

Project detail pages must include:

```text
Notes / Commentaires
```

Do not implement this as one editable text blob.

Use a note timeline/list.

Minimum note data:

```text
project_id
comment text
author
created_at
updated_at if supported
optional linked object if practical later: activity, expense, convention, document
```

Notes are human/contextual.

Audit remains automatic and factual.

Examples:

```text
Audit:
- Expense submitted.
- Activity rejected.
- Budget updated.
- Document uploaded.

Notes:
- Le rapport d’activité sera transmis demain.
- La DPAF demande la liste de présence signée.
- Le justificatif a été reçu après correction.
```

If `exchangelogs.php` currently exists, do not delete it blindly.

Safe handling:

```text
- remove it from visible navigation
- remove it from dashboard/quick links
- keep strict guards
- either leave it as hidden legacy/technical route or redirect/forbid it if safe
- do not break existing audit/workflow behavior
```

### 2.7 Roadmap / Préparation Production

The Roadmap / Préparation production page must be hidden by default.

Add or use a config/environment flag:

```text
MJL_SHOW_INTERNAL_ROADMAP=0
```

Default behavior:

```text
- not visible in sidebar
- not visible in quick links
- not visible in dashboard cards
- direct access returns 404 or forbidden
```

When enabled:

```text
MJL_SHOW_INTERNAL_ROADMAP=1
```

then:

```text
- visible only to Admin
- never visible to normal client/demo users
```

Prefer 404 when disabled to avoid exposing the existence of an internal page.

## 3. Target Sidebar Structure

### 3.1 Tableau de bord

```text
Tableau de bord
```

Route:

```text
/custom/mjlfinancement/index.php
```

### 3.2 Projets

```text
Projets
  - Liste des projets
  - Projets en alerte
```

Main route:

```text
/custom/mjlfinancement/projects.php
```

Detail route may use:

```text
/custom/mjlfinancement/projects.php?id=...
```

unless the repo has an existing safer convention.

### 3.3 Activités

```text
Activités
  - Liste des activités
  - Activités à corriger
  - Alertes activités
```

Existing routes to reuse where possible:

```text
/custom/mjlfinancement/activities.php
/custom/mjlfinancement/alerts.php
```

Creation, edit, detail, submit, correction, validation, and document upload remain contextual inside the activity workflow.

### 3.4 Dépenses

```text
Dépenses
  - Liste des dépenses
  - Dépenses à corriger
  - Alertes dépenses
```

Existing routes to reuse:

```text
/custom/mjlfinancement/expenses.php
/custom/mjlfinancement/alerts.php
```

Do not expose native Dolibarr `expensereport`.

### 3.5 Financement

```text
Financement
  - Conventions
  - Budgets
  - Fonds reçus
```

Routes:

```text
/custom/mjlfinancement/conventions.php
/custom/mjlfinancement/budgetlines.php
/custom/mjlfinancement/fundreceipts.php
```

### 3.6 Documents

```text
Documents
  - Bibliothèque
  - Documents manquants
```

Main route:

```text
/custom/mjlfinancement/documents.php
```

The page aggregates accessible documents from:

```text
- projects
- activities
- expenses
- conventions
- fund receipts
```

The page is read-only.

No global upload.

### 3.7 Supervision

```text
Supervision
  - Tableau DPAF
  - Historique des validations
  - Alertes globales
  - Rapports / Exports
  - Historique / Audit
```

Routes:

```text
/custom/mjlfinancement/dpafdashboard.php
/custom/mjlfinancement/validations.php
/custom/mjlfinancement/alerts.php
/custom/mjlfinancement/reports.php
/custom/mjlfinancement/workflowactions.php
```

Do not include `Échanges`.

### 3.8 Administration

```text
Administration
  - Invitations
  - Utilisateurs & groupes
  - Configuration MJL
```

Confirmed existing custom route:

```text
/custom/mjlfinancement/admin/access.php
```

For users/groups/configuration:

```text
- do not expose raw Dolibarr admin pages to normal users
- Admin-only access is acceptable
- prefer MJL wrapper pages if they already exist or can be safely created
- otherwise keep visible navigation limited to the custom invitation/access page and necessary MJL configuration surfaces
```

## 4. Dashboard Requirements

Update:

```text
/custom/mjlfinancement/index.php
```

to be the real MJL home page.

Do not copy Dolibarr default Accueil widgets blindly.

Remove or avoid generic Dolibarr concepts:

```text
- client invoices
- opportunities
- modified customers
- customer credit limits
- cheques to deposit
- native expense reports
- unrelated accounting widgets
- unrelated HR widgets
- billing/commercial widgets
```

Use MJL-relevant indicators only.

### 4.1 Indicators For All Users

```text
Mes activités ouvertes
Mes dépenses en cours
Actions à corriger
Documents manquants
Échéances proches
```

### 4.2 Indicators For Supervisor N1 / N2

```text
Validations en attente
Activités à revoir
Dépenses à valider
Retards sur mon périmètre
Corrections demandées
```

### 4.3 Indicators For DPAF / Admin

```text
Activités ouvertes
Activités en retard
Validations en attente
Dépenses engagées
Budget consommé
Budget restant
Fonds reçus
Conventions actives
Conventions proches échéance
Documents manquants
Projets en alerte
Exports disponibles
Dernières actions auditées
```

### 4.4 Indicators For Reader / Audit

```text
Activités consultables
Dépenses consultables
Projets consultables
Documents consultables
Historique des décisions
Exports disponibles
```

Every dashboard query must be scoped by role and rights.

Do not show global financial totals to users whose role should only see their own perimeter.

## 5. Projects Page Requirements

Create:

```text
/custom/mjlfinancement/projects.php
```

Use the MJL shell and unified sidebar.

### 5.1 Mandatory Pre-Implementation Audit For Projects

Before coding the Projects page, inspect the repo and answer:

```text
- Is there already an MJL project table?
- Are projects currently represented by Dolibarr native projects?
- Are projects inferred from conventions?
- Are activities already linked to a project field?
- Are expenses linked to activities only, or also to projects?
- Are budget lines linked to conventions, projects, activities, or another dimension?
- Are documents linked to project-like objects?
```

Do not invent a schema.

If no first-class project model exists, choose the safest repo-compatible approach:

```text
Option A: read-only project view derived from existing conventions/activities
Option B: wrapper over native Dolibarr project records, but with MJL UI only
Option C: create a small MJL project table if and only if migrations and model conventions are clear
```

Prefer the least disruptive option that supports the page without fake data.

### 5.2 Project List

Minimum target columns, if data exists or can be safely computed:

```text
Projet
Convention liée
Budget total
Budget consommé
Budget restant
Fonds reçus
Activités liées
Dépenses liées
Documents liés
Échéance
Statut
Alertes
```

If a field cannot be safely computed:

```text
- do not fake it
- show a neutral empty state
- document the limitation
```

### 5.3 Project Detail

Project detail should show:

```text
Résumé
Budget
Activités liées
Dépenses liées
Documents liés
Notes / Commentaires
Historique / audit if available
```

### 5.4 Notes / Commentaires

Implement project notes as a timeline/list, not as a single blob.

Access proposal:

```text
- users who can read the project can read notes
- users who can act on the project or related workflow can add notes
- Reader/Audit can read notes only
- Admin/DPAF can read notes within their scope
```

If edit/delete is added:

```text
- author can edit only within a short safe window if desired
- Admin can moderate if needed
- deletion should be soft delete or audited
```

Adding a note should create an audit entry if the audit system supports it.

Notes must not replace audit trail.

## 6. Documents Page Requirements

Create:

```text
/custom/mjlfinancement/documents.php
```

Use MJL shell and unified sidebar.

### 6.1 Mandatory Pre-Implementation Audit For Documents

Before coding, inspect:

```text
- current document storage pattern
- Dolibarr ECM usage
- documentdownload.php access rules
- activity document model
- expense document model
- convention document model
- fund receipt proof model
- whether project documents already exist
```

Do not link directly to physical files.

Do not bypass object-level security.

### 6.2 Documents Library Columns

Minimum target columns:

```text
Nom du document
Type
Objet lié
Projet
Convention
Activité
Dépense
Ajouté par
Date d’ajout
Statut
Action télécharger
```

### 6.3 Filters

Provide filters where feasible:

```text
Type
Projet
Convention
Activité
Dépense
Date
Ajouté par
Documents manquants
```

### 6.4 Download

Downloads must use MJL-controlled secure links.

Preferred route:

```text
/custom/mjlfinancement/documentdownload.php?type=...&id=...
```

or the repo’s current secure equivalent.

Preserve object-level access rules.

### 6.5 Upload

No generic upload button.

Show clear UX copy:

```text
Les documents sont ajoutés depuis la fiche activité, dépense, convention, fonds reçu ou projet concerné.
```

## 7. Route Guards And Permissions

Keep server-side guards on every route.

Refactor if needed so navigation visibility and direct route access are consistent.

Known issue to inspect:

```text
- Dolibarr top menu visibility and dashboard access may not use exactly the same right checks.
- export/read may not currently be part of top-menu or dashboard entry checks.
```

Create or reuse one shared helper if the mismatch still exists:

```php
mjl_workspace_user_can_enter($user)
```

Use consistently for:

```text
- dashboard access
- sidebar base visibility
- top menu visibility where possible
- landing behavior
- native route guard decisions
```

Do not rely on CSS hiding for security.

CSS and JS are UX safeguards only.

Server-side route control is mandatory.

## 8. Native Dolibarr Interface Cleanup

Normal MJL users must not see or use the old Dolibarr interface.

Native routes that should remain hidden, blocked, or redirected for normal MJL users include:

```text
/projet
/ecm
/expensereport
/hrm
/holiday
/commande
/fourn
/compta
/accountancy
/banque
/tax
/societe
/comm
/modulebuilder
/api
/core/tools.php
/admin/tools
/admin/system
/admin/dict
/admin/modules.php
```

Important:

```text
- /projet must not remain visible even for DPAF/Admin in the client-facing workspace.
- If Admin needs technical access, provide an explicit hidden/advanced escape hatch outside normal navigation.
- Do not pollute the MJL sidebar with raw Dolibarr admin pages.
```

Keep or improve:

```text
- PHP hook redirects
- route-level guards
- CSS hiding
- JS fallback guard
```

But treat PHP/server-side protections as the real security layer.

## 9. Auth And Invitation

Do not add public registration.

The application remains invitation-only.

Keep existing flows:

```text
- login
- forgotten password
- password reset
- invitation acceptance
```

Admin can invite users.

Do not break invitation links, password reset links, or post-reset landing.

## 10. Roadmap Flag

Add or use:

```text
MJL_SHOW_INTERNAL_ROADMAP
```

Default:

```text
0
```

When disabled:

```text
- hide from sidebar
- hide from quick links
- hide from dashboard
- direct access returns 404 or forbidden
```

When enabled:

```text
- visible only to Admin
```

Do not show it during client demo.

## 11. Implementation Order

### Phase 1 — Mandatory Audit

Before coding, inspect:

```text
custom/mjlfinancement/lib/mjl_navigation.lib.php
custom/mjlfinancement/lib/mjl_workspace.lib.php
custom/mjlfinancement/core/modules/modMjlFinancement.class.php
custom/mjlfinancement/class/actions_mjlfinancement.class.php
custom/mjlfinancement/js/native_guard.js.php
custom/mjlfinancement/css/mjl_app.css.php
custom/mjlfinancement/index.php
custom/mjlfinancement/activities.php
custom/mjlfinancement/expenses.php
custom/mjlfinancement/alerts.php
custom/mjlfinancement/validations.php
custom/mjlfinancement/dpafdashboard.php
custom/mjlfinancement/reports.php
custom/mjlfinancement/conventions.php
custom/mjlfinancement/budgetlines.php
custom/mjlfinancement/fundreceipts.php
custom/mjlfinancement/workflowactions.php
custom/mjlfinancement/exchangelogs.php
custom/mjlfinancement/documentdownload.php
```

Also inspect schema/migrations/classes to identify whether projects and notes already exist.

Produce a short implementation note before coding.

### Phase 2 — Navigation Registry

Refactor the navigation registry into grouped sections.

Each section/item should support:

```text
key
label
url
icon if current system uses icons
section
children
description
required rights/capabilities
active patterns
order
visibility logic
```

Keep one central registry.

Do not define separate menus inside pages.

### Phase 3 — Sidebar Rendering

Update sidebar rendering:

```text
- no search bar
- grouped primary sections
- active section expands
- child links appear only in active section
- current route highlighted
- role-aware links
- no Échanges
- no Roadmap unless flag enabled and Admin
```

### Phase 4 — Projects

Create or wire:

```text
/custom/mjlfinancement/projects.php
```

Implement:

```text
- list view
- detail view if feasible
- project notes/comments
- role-aware access
- no native /projet exposure
```

### Phase 5 — Documents

Create:

```text
/custom/mjlfinancement/documents.php
```

Implement:

```text
- read-only document library
- filters
- secure downloads
- no generic upload
- contextual upload explanation
```

### Phase 6 — Dashboard

Update:

```text
/custom/mjlfinancement/index.php
```

Implement:

```text
- MJL-relevant indicators only
- role-scoped totals
- links to Projects and Documents
- remove irrelevant Dolibarr/default business widgets
```

### Phase 7 — Native UI Cleanup

Ensure normal MJL users cannot access old Dolibarr UI from visible navigation.

Improve server-side redirects where needed.

Do not rely only on CSS or JavaScript.

### Phase 8 — Tests

Add/update Playwright E2E tests.

Do not add only micro tests.

Use full role-based navigation flows.

### Phase 9 — Documentation

Update relevant docs:

```text
docs/15-production-menu-scope.md
docs/design-system/audit/current-screen-inventory.md
docs/mjl-financement-feature-coverage.md
```

Document:

```text
- new sidebar structure
- hidden native Dolibarr interface strategy
- new Projects page
- new Documents page
- contextual uploads
- removal of Échanges from navigation
- project notes/comments
- Roadmap flag
- known limitations
```

## 12. Required E2E Tests

Use existing POC users where available:

```text
admin.poc
agent.mjl
superviseur.n1
superviseur.n2
dpaf.mjl
lecteur.audit
```

Minimum tests:

```text
1. Login redirects to /custom/mjlfinancement/index.php.
2. Sidebar is visible on every MJL page.
3. Sidebar has no search bar.
4. Sidebar has grouped primary sections.
5. Active primary section expands and shows children.
6. Normal users do not see Administration links.
7. Admin sees Administration links.
8. Roadmap is hidden by default.
9. Roadmap appears only to Admin when MJL_SHOW_INTERNAL_ROADMAP=1.
10. Native /projet is not visible in navigation.
11. Native /projet redirects, forbids, or blocks normal MJL users.
12. /custom/mjlfinancement/projects.php returns 200 for allowed users.
13. Project detail shows Notes / Commentaires.
14. Users with appropriate rights can add a project note.
15. Reader/Audit can read notes but cannot add/edit/delete notes.
16. /custom/mjlfinancement/documents.php returns 200 for allowed users.
17. Documents page is read-only.
18. Documents page has no generic upload button.
19. Documents download uses secure MJL download links.
20. “Validations” is not a primary menu item.
21. “Historique des validations” appears under Supervision.
22. “Échanges” is not visible in sidebar, quick links, or dashboard cards.
23. Every visible sidebar link returns 200 for the role that sees it.
24. Hidden restricted routes are forbidden, redirected, or not found when accessed directly.
25. Dashboard indicators are scoped to the logged-in role.
26. Agent cannot see global DPAF/Admin financial totals.
27. DPAF/Admin can see supervision indicators.
28. Reader/Audit has read-only access where applicable.
29. Invitation-only access remains intact.
30. Password reset flow still lands users in MJL workspace.
```

## 13. Loophole Review And Fixes

### Loophole 1 — Project schema may not exist

Risk:

```text
The prompt asks for a Projects page, but the repo may not have a clean MJL project model.
```

Fix:

```text
Mandatory project audit before coding.
Do not invent schema.
Use the least disruptive repo-compatible option:
- derived read-only project view
- MJL wrapper over native Dolibarr projects
- new MJL table only if migrations and model conventions are clear
```

### Loophole 2 — Removing native /projet may break hidden dependencies

Risk:

```text
Activities, budgets, or documents may internally rely on Dolibarr project records.
```

Fix:

```text
Do not remove backend use of Dolibarr projects.
Only remove native UI exposure.
Keep data integration if needed.
Expose project data through /custom/mjlfinancement/projects.php only.
```

### Loophole 3 — Documents page could bypass object permissions

Risk:

```text
A global Documents page may accidentally show documents from objects the user cannot access.
```

Fix:

```text
Aggregate only documents the user can access through the same object-level guards used by activity, expense, convention, fund receipt, and project pages.
Use secure download endpoint only.
Never link raw files.
```

### Loophole 4 — Global Documents page could become a messy file manager

Risk:

```text
Users upload orphan documents with no object context.
```

Fix:

```text
No global upload button.
Uploads remain contextual.
Global Documents page is read-only.
```

### Loophole 5 — Project notes could replace audit trail

Risk:

```text
Users may rely on comments instead of controlled workflow/audit records.
```

Fix:

```text
Keep notes separate from audit.
Audit remains automatic and factual.
Adding a note should itself be auditable if supported.
```

### Loophole 6 — Échanges removal could break existing code

Risk:

```text
Existing routes, tests, dashboard cards, or audit logic may depend on exchangelogs.php.
```

Fix:

```text
Do not delete blindly.
Remove only from visible navigation.
Keep strict guards or redirect safely.
Update tests and docs.
```

### Loophole 7 — Roadmap flag could be unavailable in Dolibarr config style

Risk:

```text
Plain environment variable access may not match the repo’s config pattern.
```

Fix:

```text
Inspect existing config helpers.
Implement MJL_SHOW_INTERNAL_ROADMAP using the repo’s accepted configuration mechanism.
Default to disabled.
```

### Loophole 8 — Sidebar visibility and route guards may diverge

Risk:

```text
A user may not see a link but can open the route directly, or may see a link that 403s.
```

Fix:

```text
Centralize capability helpers.
Use shared access checks for navigation and route guards where possible.
Add E2E tests for visible links and hidden routes.
```

### Loophole 9 — Top navbar removal could trap users

Risk:

```text
If the top navbar is removed too early, users may lose access to needed pages.
```

Fix:

```text
First implement complete sidebar coverage.
Then hide/remove the top navbar inside MJL workspace only.
Run role-based navigation tests before final removal.
```

### Loophole 10 — Admin technical access may be needed

Risk:

```text
Fully hiding native Dolibarr admin UI could make maintenance harder.
```

Fix:

```text
Do not expose native admin pages in client-facing sidebar.
If needed, keep a hidden admin-only technical escape hatch outside normal MJL navigation.
Document it clearly.
```

### Loophole 11 — Dashboard indicators may leak financial data

Risk:

```text
Agent or Reader sees global totals reserved for DPAF/Admin.
```

Fix:

```text
Every dashboard query must be role-scoped.
Add tests proving financial totals are not visible to unauthorized roles.
```

### Loophole 12 — Validation label could still confuse users

Risk:

```text
The route is history, but users may expect live validation actions.
```

Fix:

```text
Rename visible label to “Historique des validations”.
Place under Supervision.
Do not call it “À valider” unless a true queue exists.
```

### Loophole 13 — Alerts route is reused under multiple sections

Risk:

```text
Same alerts.php route appears under Activités, Dépenses, and Supervision.
```

Fix:

```text
Use query filters or active keys if supported:
- alerts.php?scope=activities
- alerts.php?scope=expenses
- alerts.php?scope=global
If not supported, keep one Alertes page but label links carefully and document limitation.
```

### Loophole 14 — Tests could become local micro-tests only

Risk:

```text
Implementation passes isolated checks but fails real user flows.
```

Fix:

```text
Use full Playwright E2E role flows.
Every role must log in, navigate, and access/deny expected pages.
```

### Loophole 15 — Client demo may expose internal POC limits

Risk:

```text
Roadmap or internal production readiness screens appear during demo.
```

Fix:

```text
Roadmap hidden by default.
Flag required.
Admin-only even when enabled.
Prefer 404 when disabled.
```

## 14. Non-Goals

Do not:

```text
- modify Dolibarr core
- add public registration
- expose raw native /projet
- expose raw ECM
- create generic global document upload
- keep Échanges as visible navigation
- present the app as production-ready
- add unrelated HR/accounting/billing/commercial modules
- rely on CSS hiding as security
- add only micro tests
```

## 15. Final Acceptance Criteria

Implementation is accepted only if:

```text
- Login lands on /custom/mjlfinancement/index.php.
- Users see one coherent MJL sidebar.
- Sidebar has no search bar.
- Sidebar uses grouped primary sections.
- Active section expands.
- Old Dolibarr interface is not visible to normal MJL users.
- Native /projet is hidden from the client-facing workspace.
- New /custom/mjlfinancement/projects.php exists.
- Project detail includes Notes / Commentaires.
- Project notes are timeline/list-based, not one blob.
- New /custom/mjlfinancement/documents.php exists.
- Documents page is read-only.
- Documents downloads use secure MJL links.
- Uploads remain contextual.
- “Historique des validations” is under Supervision.
- “Validations” is not a primary sidebar item.
- “Échanges” is removed from visible navigation.
- Roadmap is hidden by default.
- Roadmap is controlled by MJL_SHOW_INTERNAL_ROADMAP.
- All visible links are role-aware.
- All direct routes are server-side guarded.
- Full Playwright E2E tests pass.
- Documentation is updated.
```

## 16. Confidence Statement For The Implementing Agent

This strategy is considered implementation-ready only after Phase 1 audit confirms the repo’s actual project/document schema and route guards.

Do not skip Phase 1.

Do not silently invent missing data models.

If the audit reveals that a requirement cannot be implemented safely without a larger schema migration, stop and report:

```text
- what was found
- why the current plan cannot be applied directly
- safest alternative
- files affected
- test impact
```
