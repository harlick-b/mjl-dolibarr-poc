# MJL UI, Navigation, And Design System Target Specification

> Planning artifact only. No code, no file edits, no Dolibarr core changes proposed.
> Grounded in: `docs/mjl-authoritative-decisions.md` (highest authority), `CONTEXT.md` (durable role/report/KPI rules and pending client decisions), `docs/audits/mjl-navigation-design-full-audit.md` (kept historical FAIL/NOT_DEMO_READY audit evidence), `docs/mjl-current-vs-target-gap-analysis.md`, and the existing `docs/design-system/*.md` scaffolding, reconciled against actual code in `custom/mjlfinancement/`.
> Role vocabulary decision (confirmed with client stakeholder): authoritative names (`AGENT_SAISIE`, `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`, `ADMIN_PLATEFORME`) are primary throughout. `Superviseur N1/N2`, `DPAF`, `Agent`, `Admin` (the older prompt/audit vocabulary) appear only as a legacy-mapping footnote. `Lecteur / Audit` is **not** a fifth role — it is a read-only capability overlay, by default layered on `ADMIN_PLATEFORME` (see §3.3), with an explicit scope caveat noted there.
> Revision note: this version incorporates a self-review pass — see the eight fixes summarized inline where relevant (native-route enforcement strategy, token naming, Supervision role visibility, screen-spec completeness, and two newly surfaced risks). Nothing in the original nine-section navigation model or role framing changed; the fixes tighten enforcement mechanics, wording precision, and close gaps against the literal ask.

---

## 1. Executive Recommendation

Ship an MJL application that never shows a normal user a Dolibarr screen, menu item, or error page — not through CSS hiding, not through client-side JS redirects, but through actual server-side route interception. The current implementation already has the right *shape* (a real sidebar registry, a real dashboard, a real Projects/Documents/Supervision surface) — the audit's verdict of FAIL is not about missing screens, it is about a leaky boundary: native Dolibarr chrome renders on top of every MJL page, and nine native routes (`/projet`, `/ecm`, `/societe`, `/comm`, `/hrm`, `/compta`, `/modulebuilder`, `/admin/modules.php`, `/core/tools.php`) still render live Dolibarr surfaces for non-admin users because the only enforcement layers that exist today (CSS selector hiding, a JS redirect script, one Apache deny rule for a single path) are all bypassable or incomplete.

The fix is not a redesign. It is: (1) close the boundary server-side, (2) replace every Dolibarr-native chrome element and error page with an MJL-styled equivalent, (3) finish the wording/labeling pass so nothing on screen exposes migration-compatibility or database language to a non-technical user, and (4) keep iterating the already-solid screen inventory (dashboard, Projects, Documents, Financement, Supervision) rather than rebuilding it.

Treat this document as the authoritative target for navigation, shell, components, and wording. It supersedes `docs/design-system/MJL_INFORMATION_ARCHITECTURE.md` where the two disagree (that file predates the Dépenses/Financement/Partenaires/Supervision structure that is now actually implemented and validated through Phases 6R–13) — recommend updating that file to match this spec rather than the reverse.

## 2. Design Principles

1. **One application, one boundary.** A user with an MJL business role must never be able to tell, from the UI, that Dolibarr exists underneath. If a native route renders anything, that is a defect, not an edge case.
2. **Server enforces, client merely reflects.** Sidebar visibility, CSS hiding, and JS redirects are UX conveniences, never the security boundary. Every guard must also exist as a server-side check that fails closed.
3. **Status before detail.** Every object screen (activity, expense, project, document, fund receipt) shows its status prominently before secondary metadata.
4. **One dominant question per screen.** If a screen tries to answer two unrelated questions, split it.
5. **Contextual creation, central consultation.** Documents and exchanges are created from the object they belong to; they are consulted from a central, read-only, filtered library.
6. **No self-review.** No self-prevalidation, no self-final-validation, no self-disbursement is visible or reachable in any UI state.
7. **Capability-driven visibility, not role-name branching.** Navigation and actions are computed from a capability map (as `mjl_workspace_capabilities()` already does), not from `if ($role === 'X')` checks scattered per screen. This is what lets the permission matrix evolve without a UI rewrite.
8. **French, plain, institutional.** No English UI strings, no raw Dolibarr object nouns (`Tiers`, `Third party`), no database/status internals (`legacy`, `compatibilite historique`, `Prevalidee`) surfaced to end users.
9. **Fail closed, explain why.** An unresolved scope, a missing right, or a broken link produces a calm, MJL-styled explanation and a way back — never a blank page, a stack trace, or a native Dolibarr denial screen.
10. **Reuse before inventing.** Every component decision below extends the already-approved catalog in `docs/design-system/MJL_COMPONENTS.md`; nothing here introduces a new UI framework or a competing pattern.

## 3. Navigation Architecture

### 3.1 Recommended Primary Sections

Keep the current nine-section structure implemented in `mjl_navigation_sections()` — it is more mature and business-validated than the older `MJL_INFORMATION_ARCHITECTURE.md` sketch (which never modeled Dépenses, Financement, or Partenaires as first-class areas). Target primary sections, in sidebar order:

1. Tableau de bord
2. Partenaires / Programmes
3. Projets
4. Activités
5. Dépenses
6. Documents
7. Financement
8. Supervision
9. Administration

**Recommendation on the open question ("should Partenaires/Programmes remain primary or move under Financement?"): keep it primary.** Reasoning: it is not a finance sub-object — it is the scope root. Every non-admin user's visible data is filtered by which Partenaires/Programmes they're assigned to (`mjl_scope_*`), and the partner detail page already aggregates identity, KPIs, related projects/activities/expenses, guarded documents, alerts, and contextual history (the "5R portfolio view" per the gap analysis) — a richer surface than a Financement sub-page would comfortably host. Burying it under Financement would also mislead: a `VALIDATEUR_DEFINITIF` cares about Partenaires/Programmes for reasons unrelated to money (which projects, which activities), not only budget. Action: update `MJL_INFORMATION_ARCHITECTURE.md` to add this as primary area #2, and treat its current position in the live sidebar as correct — no navigation change needed here, just documentation alignment.

### 3.2 Section-By-Section Navigation

For each section: purpose, visible roles (capability-based, not name-branched), children, default landing route, key tasks, empty state, design notes.

**Tableau de bord** (`/custom/mjlfinancement/index.php`)
- Purpose: role-relevant summary of what needs attention today.
- Visible to: everyone with workspace access (all four roles).
- Children: none (quick-links widget only, sourced from the same nav registry).
- Landing: post-login default for all roles except where §3.2 "Entry Points" below specifies a more specific first screen.
- Key tasks: see what's overdue, what's blocked, what's waiting on me.
- Empty state: "Aucune action en attente. Votre espace de travail est à jour." with links to Projets/Activités.
- Design notes: cards, not a data table; every card links to a filtered list, never dead-ends.

**Partenaires / Programmes** (`/custom/mjlfinancement/partners.php`)
- Purpose: scope root — the funder/programme entities (e.g. UNICEF, Programme Redevabilité) that define what data a non-admin user can see.
- Visible to: all four roles (scoped to assignment for non-admin; `ADMIN_PLATEFORME` sees all).
- Children: Liste des partenaires (detail view is a drill-in, not a separate nav child).
- Landing: `partners.php` (list).
- Key tasks: find a partner/programme, see its portfolio (projects, budget, documents, alerts), see who's assigned.
- Empty state: "Aucun partenaire ou programme ne vous est assigné. Contactez l'administrateur." (non-admin with zero scope — this must never silently show all data).
- Design notes: detail page uses the Detail Summary Card + KPI row + related-object tabs pattern shared with Project detail.

**Projets** (`/custom/mjlfinancement/projects.php`)
- Purpose: the central operational object — everything (activities, expenses, documents, budget) hangs off a project.
- Visible to: all four roles (scoped); create/edit restricted to `ADMIN_PLATEFORME` and `VALIDATEUR_DEFINITIF` per authoritative decisions.
- Children: Liste des projets (detail is drill-in).
- Landing: `projects.php`.
- Key tasks: check project status/budget, jump to its activities/expenses/documents, read/add notes.
- Empty state: "Aucun projet dans votre périmètre actuel."
- Design notes: this is the screen every other object links back to — treat it as the hub, not a leaf.

**Activités** (`/custom/mjlfinancement/activities.php`)
- Purpose: operational execution tracking and the prevalidation/final-validation workflow.
- Visible to: all four roles (scoped); creation/submission/correction limited to `AGENT_SAISIE`; prevalidation to `AGENT_VERIFICATEUR`; final validation to `VALIDATEUR_DEFINITIF`.
- Children: Liste des activités; Alertes activités (only if alert-read capability).
- Landing: `activities.php`, pre-filtered to "my open items" per role (see §3.2 Entry Points).
- Key tasks: create/submit an activity, review a submitted one, correct a returned one, update physical execution.
- Empty state: role-aware — `AGENT_SAISIE` sees "Créez votre première activité"; reviewers see "Aucune activité en attente de révision."
- Design notes: status must be the first visual element in every row/card, per Design Principle 3.

**Dépenses** (`/custom/mjlfinancement/expenses.php`)
- Purpose: financial execution tied to activities/budget lines, same workflow shape as Activités.
- Visible to: all four roles (scoped); create/submit/correct: `AGENT_SAISIE`; prevalidate: `AGENT_VERIFICATEUR`; final-validate + mark décaissé: `VALIDATEUR_DEFINITIF`.
- Children: Liste des dépenses; Alertes dépenses.
- Landing: `expenses.php`, pre-filtered per role.
- Key tasks: submit an expense with justificatifs, review, validate, mark disbursed (separately from validation — these are two different states, never merge them in UI).
- Empty state: same pattern as Activités.
- Design notes: exceeds-budget and missing-justificatif conditions must be visible on the row, not only inside the alert feed.

**Documents** (`/custom/mjlfinancement/documents.php`)
- Purpose: read-only, filterable, audited consultation library aggregating documents from every contextual source.
- Visible to: all four roles (scoped read-only; `ADMIN_PLATEFORME` sees all, read-only too — admin does not get a bulk-upload capability here either).
- Children: Bibliothèque (single page; no sub-children needed).
- Landing: `documents.php`.
- Key tasks: find a document, confirm what's missing, download with an audited link.
- Empty state: "Aucun document ne correspond à ces filtres." (never "no documents exist" if filters are active — distinguish filtered-empty from truly-empty).
- Design notes: **no global upload button, ever.** Persistent copy: *"Les documents sont ajoutés depuis la fiche activité, dépense, convention, fonds reçu ou projet concerné."*

**Financement** (href = first child)
- Purpose: the money side — funding envelopes, budget allocation, funds received.
- Visible to: `VALIDATEUR_DEFINITIF` and `ADMIN_PLATEFORME` for creation; read access wider per matrix (reference-data read capability).
- Children: Enveloppes de financement (`conventions.php`), Budgets (`budgetlines.php`), Fonds reçus (`fundreceipts.php`).
- Landing: Enveloppes de financement.
- Key tasks: create a funding envelope, allocate a budget line, record funds received, check consumption.
- Empty state: per sub-page — "Aucune enveloppe de financement enregistrée."
- Design notes: budget-consumption warnings (≥80% / ≥95%, already computed in `mjl_alerts.lib.php`) must surface here, not only in Supervision.

**Supervision** (href = first child)
- Purpose: cross-cutting oversight — the finance supervision dashboard, validation history, global alerts, reports/exports, and audit trail.
- Visible to: **capability-per-child, not one section-wide gate** — this corrects an inconsistency in an earlier draft of this spec, which gated the whole section to `VALIDATEUR_DEFINITIF`/`ADMIN_PLATEFORME` and missed that current live behavior already grants `AGENT_SAISIE` and `AGENT_VERIFICATEUR` the Alertes child (confirmed: `agent.mjl`'s sidebar shows Supervision today, via alert-read capability). Concretely: Alertes globales is visible to any role holding alert-read capability (today: all four roles, scoped to what's operationally/review-relevant to each); Supervision finance, Historique des validations, Rapports/Exports, and Historique/Audit are visible to `VALIDATEUR_DEFINITIF` and `ADMIN_PLATEFORME`, with `AGENT_VERIFICATEUR` optionally granted read access to Historique des validations for items they reviewed (per the matrix's "advanced audit... where granted" language). A section header still appears in the sidebar for any role holding at least one child capability — never a section with zero visible children.
- Children: Supervision finance (`dpafdashboard.php` — rename route to `financesupervision.php` when convenient, see §17), Historique des validations (`validations.php`), Alertes globales (`alerts.php`), Rapports / Exports (`reports.php`), Historique / Audit (`workflowactions.php`).
- Landing: Supervision finance for `VALIDATEUR_DEFINITIF`/`ADMIN_PLATEFORME`; Alertes globales for a role whose only visible child is alerts (e.g. `AGENT_SAISIE`).
- Key tasks: see global project/activity/budget status, review validation decisions, export reports, audit downloads/exchanges; for operational roles, simply triage their own alerts.
- Empty state: per sub-page.
- Design notes: no standalone Échanges menu item, ever (see §3.4 and §13).

**Administration** (href = first child)
- Purpose: platform administration — access, invitations, roles, and (flagged) internal roadmap.
- Visible to: `ADMIN_PLATEFORME` only.
- Children: Accès utilisateurs (`admin/access.php`), Préparation production (`roadmap.php`, only when `MJL_SHOW_INTERNAL_ROADMAP=1`).
- Landing: Accès utilisateurs.
- Key tasks: send/revoke/resend invitations, assign role + Partenaires/Programmes, manage the internal roadmap flag.
- Empty state: "Aucune invitation en attente."
- Design notes: this is the only section where technical/platform language is acceptable, since its audience is `ADMIN_PLATEFORME` specifically.

**Entry points by role** (align to `MJL_INFORMATION_ARCHITECTURE.md`'s existing intent, adapted to current IA):
- `AGENT_SAISIE` → Tableau de bord, with "Mes activités à finaliser" as the first card, and Activités pre-filtered to own drafts/returned items as the natural next click.
- `AGENT_VERIFICATEUR` → Tableau de bord, with "Activités/dépenses en revue" as the first card.
- `VALIDATEUR_DEFINITIF` → Tableau de bord, with Supervision finance KPIs surfaced first.
- `ADMIN_PLATEFORME` → Tableau de bord, with Invitations en attente / Rapports disponibles / Éléments à qualifier surfaced first.

### 3.3 Role Visibility Principles

Do not hardcode a final permission matrix in this spec — `CONTEXT.md` records
the durable permission principles and keeps final route/action approval marked
as pending client validation. Instead, the UI must be built against
**capabilities**, computed once per request (as `mjl_workspace_capabilities()`
already does), never against inline role-name checks scattered through
templates. Principles:

- **Admin (`ADMIN_PLATEFORME`) sees administration tools** — invitations, access, roles, platform diagnostics — and sees all data across all Partenaires/Programmes.
- **Agent (`AGENT_SAISIE`) sees operational actions** — create, submit, correct — scoped to assigned Partenaires/Programmes.
- **Vérificateur (`AGENT_VERIFICATEUR`)** sees review/prevalidation actions, scoped, never their own submissions for self-review.
- **Validateur (`VALIDATEUR_DEFINITIF`)** sees final-validation, disbursement marking, project creation/edit, and finance supervision, scoped.
- **Reader/Audit is a capability overlay, not a fifth role.** Per the confirmed decision, the default and primary carrier is `ADMIN_PLATEFORME`: grant a `read_only_audit` capability alongside the admin role so every write action (buttons, forms, POST routes) is hidden and server-blocked, while all read/consultation/export surfaces remain available at admin's normal (unrestricted, all-Partenaires/Programmes) scope. This resolves the audit's open question about `lecteur.audit` without inventing a permission model the client hasn't approved.
  **Scope caveat — do not treat as solved:** because the default carrier is `ADMIN_PLATEFORME`, a `read_only_audit` user sees *all* Partenaires/Programmes, not a scoped subset. If the client's actual intent for "Lecteur/Audit" is a scoped external auditor (e.g. a UNICEF-only reviewer who should not see Programme Redevabilité data), this model does not fit as-is — it would need the capability layered on a scoped role (`VALIDATEUR_DEFINITIF`) or paired with an independent scope assignment. This spec does not build that broader case speculatively; it is tracked as an explicit open question (§17), not a current commitment.
- **Every visibility rule doubles as a route guard.** If a link is hidden because a capability is false, the destination route must also 403/404 for that capability being false — the durable rule in `CONTEXT.md` that UI hiding is not access control is binding here.

Legacy mapping (documentation aid only, not for use in new UI/code):

| Authoritative role | Legacy/prompt equivalent |
|---|---|
| `AGENT_SAISIE` | Agent |
| `AGENT_VERIFICATEUR` | Superviseur N1 |
| `VALIDATEUR_DEFINITIF` | Superviseur N2 / DPAF (context-dependent, see `mjl-authoritative-decisions.md` mapping table) |
| `ADMIN_PLATEFORME` | Admin |
| `read_only_audit` capability | Lecteur / Audit |

### 3.4 Native Dolibarr UI Policy

Normal users (any of the four roles) must never see: Accueil, Rechercher, Mon tableau de bord, Configuration, Outils d'administration, Utilisateurs & Groupes, Tiers, native Projets, ECM, GRH, Comptabilité, Facturation, Banques, Module Builder.

**Two independent enforcement tracks**, chosen per route by whether MJL's own code actually depends on the underlying Dolibarr module. This is a deliberate revision from a single "guard every route with a PHP hook" strategy: the audit's worst findings (`/hrm` and `/compta` rendering *live native content*, e.g. "Espace RH", not merely an ugly denial page) show the hook-based approach alone is fragile — it has to be individually verified per route and has already been shown to silently not fire. Removing entire routes from existence via Dolibarr's own module framework is strictly stronger where it's available.

**Track A — modules MJL does not use at all: disable the module.** `comm` (commercial), `hrm`/`holiday`/`expensereport`, `compta`/`accountancy`/`banque`/`tax`, and `modulebuilder` back Dolibarr features that `docs/mjl-authoritative-decisions.md` never lists as something MJL depends on (it lists only authentication, users/groups/rights, third parties, projects, ECM/documents, export support). Recommendation: disable these modules in standard Dolibarr module configuration for the MJL entity — an admin configuration action, not a core-file edit, fully consistent with the "Dolibarr core files must not be modified" constraint. A disabled module 404s/blocks natively for every user including `ADMIN_PLATEFORME`, with zero custom guard code to write, maintain, or have silently fail to fire. **Precondition, required before disabling, not assumed:** Codex must first verify no MJL code path (activity/expense/document logic, scheduled scripts, exports) silently reads from these modules' tables or classes — treat this as a discovery step at the start of Phase 1, and do not disable a module until that check comes back clean for it specifically.

**Track B — modules MJL's own code depends on: verified soft-redirect before native render.** `projet` (MJL's Project screens read `llx_projet`), `societe` (Partenaires/Programmes wraps `societe`), and `ecm` (document storage may sit underneath) must stay active. For these, Dolibarr's own rights system already correctly denies non-admin access today — the audit's evidence for `/projet`, `/ecm`, `/societe` explicitly reads "Dolibarr access-denied page with native chrome," i.e. access is already blocked, only the chrome is wrong. Since Dolibarr core's own `accessforbidden()` template cannot be restyled without touching core files, the fix is to intercept and redirect **before** that native page begins rendering, not to try to reskin its output — this is the PHP-hook mechanism already scaffolded in `actions_mjlfinancement.class.php`; Phase 1's job is to make it actually fire, not to invent a new mechanism. It must fire for POST as well as GET, and it must fire *before* any native business logic executes — a guard that runs after Dolibarr's own POST handler has already mutated data (e.g. created a native project row) is too late even if the response is eventually redirected (see §18 risk).

**Admin/config routes** (`/admin/modules.php`, `/admin/tools*`, `/admin/system*`, `/admin/dict*`): same Track-B mechanism (verified early redirect) for non-admin sessions, since Dolibarr's `$user->admin` check already denies them correctly today (confirmed by the audit) and only the chrome needs fixing. For `ADMIN_PLATEFORME`, these routes remain **directly reachable by URL, with no additional runtime gate** — they are simply not linked from the MJL sidebar, which already satisfies "keep technical admin escape hatches hidden from client-facing navigation." Gating an admin's access to their own already-fully-privileged tools behind a second mechanism (e.g. a session-flag "technical mode") adds real implementation and lockout risk for no corresponding security benefit, since `ADMIN_PLATEFORME` already holds full Dolibarr rights — an earlier draft of this spec proposed exactly that extra gate and it has been dropped as unjustified complexity.

**`/core/tools.php`**: already partially fixed — Apache returns a raw 403 today (confirmed by the audit). Keep this, and if the web server config supports it, add a location-scoped `ErrorDocument 403` pointing at an MJL-branded static page — a deployment-config change, not a core change.

**`/api*`**: not a UI-chrome concern, but a real data-exposure risk that an earlier draft of this spec incorrectly waved off as "not a UI concern." If Dolibarr's REST API module is enabled, it authenticates against native Dolibarr rights, which do not know about MJL's custom Partenaire/Programme scope filtering (a SQL-level filter MJL's own PHP applies, not a Dolibarr rights concept) — an authenticated `AGENT_SAISIE` could potentially query the API directly for objects outside their assigned scope, bypassing MJL's entire scope model, not merely its chrome. Recommendation: disable the module entirely unless a specific integration requires it; if it must stay enabled, every reachable endpoint needs a scope audit before "no native surface bypasses MJL's data model" can be considered true — see §18.

Summary table:

| Native route family | Track | Mechanism | Applies to |
|---|---|---|---|
| `/comm*` | A — disable module | Module deactivation (after dependency check) | Everyone incl. `ADMIN_PLATEFORME` |
| `/hrm*`, `/holiday*`, `/expensereport*` | A — disable module | Module deactivation (after dependency check) | Everyone |
| `/compta*`, `/accountancy*`, `/banque*`, `/tax*` | A — disable module | Module deactivation (after dependency check) | Everyone |
| `/modulebuilder*` | A — disable module | Module deactivation | Everyone incl. `ADMIN_PLATEFORME` (dev tool, not a production task) |
| `/projet*` | B — verified redirect | Early PHP hook → 302 to `/custom/mjlfinancement/projects.php` | Non-admin roles; `ADMIN_PLATEFORME` also redirected (no native-project need per authoritative decisions) |
| `/societe*` | B — verified redirect | Early PHP hook → 302 to `/custom/mjlfinancement/partners.php` | Non-admin roles |
| `/ecm*` | B — verified redirect | Early PHP hook → 302 to `/custom/mjlfinancement/documents.php` | Non-admin roles |
| `/admin/modules.php`, `/admin/tools*`, `/admin/system*`, `/admin/dict*` | B-variant — redirect non-admin only | Early PHP hook → MJL 403 shell | Non-admin roles; `ADMIN_PLATEFORME` reaches directly by URL, unlinked from nav, no extra gate |
| `/core/tools.php` | C — server-level deny | Existing Apache deny + branded `ErrorDocument` if supported | Everyone |
| `/api*` | D — audit, don't assume safe | Disable unless required; else per-endpoint scope audit | Everyone |

Enforcement layers within Track B/admin, in order of trust (weakest to strongest — **the server-side layer is mandatory; the others are UX polish that must never be the only defense**, which is exactly what failed in the current audit):
1. CSS hiding of native menu anchors — cosmetic only, never rely on it for security.
2. JS redirect fallback (`native_guard.js.php`) — improves perceived speed, but must not be the enforcement mechanism (confirmed non-functional at runtime per audit NAV-BLOCKER-002).
3. **PHP hook that actually executes on every native controller entry, GET and POST, before native business logic runs** — the mechanism `redirectRestrictedNativeWorkspace()` was designed to be, but the audit found it does not fire for the affected routes at runtime; this is the layer Phase 1 must make real.
4. Apache/web-server-level deny as a backstop even for Track-B routes, if feasible, for defense in depth.

## 4. App Shell Specification

### 4.1 Desktop Shell

Fixed-width left sidebar (current `.mjl-module-sidebar` pattern, keep) + fluid content area. Sidebar: MJL wordmark/title at top, primary sections as a flat vertical list, active section expanded in place to show its children, current page highlighted with a left accent bar + background tint (never color-only — pair with a bold weight and an "active" text style). No search bar in the sidebar. Content area: page header (title + optional KPI strip + primary action) directly below a minimal utility header, then the page body.

### 4.2 Tablet Shell

At ≤1024px, sidebar collapses to icon-only rail with section labels in a slide-out on tap/click; content area becomes full-width. Tables that don't fit switch to a stacked-card row pattern per §13.

### 4.3 Mobile Shell

At ≤480px (mobile viewport, e.g. 390×844), sidebar becomes a bottom-anchored or top-anchored slide-in drawer triggered by a hamburger control in the utility header — never permanently visible, never pushing content off-screen without a way to dismiss. Primary action for the current screen is pinned (sticky) at the bottom or top of the viewport so it's reachable without scrolling. Tables render as stacked cards (see §13).

### 4.4 Top Bar / Header Policy

**No traditional Dolibarr-style top navigation navbar.** Only a minimal utility header, present on every MJL page: left = current section/page title (or a compact breadcrumb on deep pages), right = user identity (name + role badge) as a small menu exposing "Mon profil" (if applicable) and "Déconnexion", nothing else. No module icon rail, no global search box, no "Accueil"/"Configuration" links. This utility header is intentionally thin (single row, ~48–56px) so it reads as an identity/context strip, not a second navigation system competing with the sidebar.

### 4.5 Forbidden And 404 Shell

Both states render **inside the full MJL shell** (sidebar present and correctly scoped to the user's real capabilities, utility header present) — never a bare page, never Dolibarr's native `accessforbidden()` output. Content: a centered message block with an icon, a one-sentence French explanation, a reason line only when it is safe to disclose (e.g. "Cette section n'est pas disponible pour votre rôle." — never leak *why* in a way that reveals other users'/objects' existence), and a single primary button "Retour au tableau de bord". See §7 for full copy.

## 5. Visual Design System

Ground truth: extend the palette already shipped in `custom/mjlfinancement/css/mjl_app.css.php` rather than inventing a new one (Design Principle 10) — it is already institutional and mostly coherent; the gap is that it's unnamed/untokenized (`MJL_TOKENS.md` currently lists variable names with no values). This section assigns values.

### 5.1 Colors

Token *names* below reuse exactly what `docs/design-system/MJL_TOKENS.md` already proposed (`--mjl-status-draft/submitted/returned/validated/rejected`, `--mjl-alert-info/warning/urgent/blocking`) — an earlier draft of this section invented a parallel `--mjl-status-warning/danger/success` naming scheme instead of adopting the already-recommended names, which contradicted this document's own "reuse before inventing" principle; fixed here. Values are assigned from the palette already shipped in `mjl_app.css.php`.

```
--mjl-color-primary:        #16324f   /* headings, active nav, primary emphasis */
--mjl-color-accent:         #164f7a   /* links, interactive text */
--mjl-color-focus-ring:     #7fb3d5   /* focus outline, timeline accent */
--mjl-color-text:           #202529   /* body text */
--mjl-color-text-secondary: #34414a   /* secondary text, labels */
--mjl-color-text-muted:     #5c6870   /* meta text, timestamps */
--mjl-color-surface:        #ffffff   /* cards, sidebar, page background */
--mjl-color-surface-subtle: #f5f7f8   /* hover states, subtle section backgrounds */
--mjl-color-border:         #d7dee2   /* default borders */
--mjl-color-border-strong:  #c5ced4   /* secondary/emphasis borders */
```

Object-lifecycle status tokens (the five values `MJL_TOKENS.md` already names):
```
--mjl-status-draft:      bg #f5f7f8, text #34414a   /* neutral, not yet actionable */
--mjl-status-submitted:  bg #eaf1f7, text #164f7a   /* accent tint, awaiting review */
--mjl-status-returned:   bg #fff4df, text #6f4200   /* warning family */
--mjl-status-validated:  bg #edf7f1, text #1f6b3a   /* success family */
--mjl-status-rejected:   bg #fff0ed, text #8a1f15   /* danger family */
```

Alert-severity tokens (the four levels `MJL_TOKENS.md` already names). `urgent` and `blocking` intentionally reuse the same danger hue rather than inventing a fourth color family — they differentiate by icon and label instead, which is a stronger accessibility pattern than a fourth hue most users can't reliably distinguish from `rejected`/danger anyway:
```
--mjl-alert-info:     bg #eaf1f7, text #164f7a, icon "info"
--mjl-alert-warning:  bg #fff4df, text #6f4200, icon "warning-triangle"
--mjl-alert-urgent:   bg #fff0ed, text #8a1f15, icon "warning-triangle" (bold weight)
--mjl-alert-blocking: bg #fff0ed, text #8a1f15, icon "stop-octagon"
```

Status/severity is never color-only (Principle 8, `MJL_UI_RULES.md`): every status/alert token above is always paired with its icon and French text label, never rendered as a bare color swatch.

### 5.2 Typography

System font stack (no external font loading — keep pages self-contained and fast). Scale: page title (20–22px, semibold, `--mjl-color-primary`), section heading (16–17px, semibold), body (14px, `--mjl-color-text`), meta/caption (12–13px, `--mjl-color-text-muted`). Line-height 1.4–1.5 for body text, 1.2 for headings.

### 5.3 Spacing

4px base unit. `--mjl-space-1: 4px; --mjl-space-2: 8px; --mjl-space-3: 12px; --mjl-space-4: 16px; --mjl-space-5: 24px; --mjl-space-6: 32px;` — card padding 16–24px, form field vertical rhythm 12–16px, table cell padding 8–12px.

### 5.4 Radius, Borders, Shadows

`--mjl-radius-card: 6px` (matches existing shell), `--mjl-radius-control: 4px` (buttons/inputs), `--mjl-radius-badge: 999px` (pill status badges). Borders: 1px `--mjl-color-border` as default card/table border. Shadows: `--mjl-shadow-card: 0 6px 16px rgba(32,37,41,0.05)`, `--mjl-shadow-elevated: 0 8px 22px rgba(32,37,41,0.06)` for modals/popovers — keep shadows subtle, never a heavy drop-shadow look.

### 5.5 Icons

A single consistent icon set (reuse whatever the current shell already loads — do not introduce a second icon library). Icons always accompany, never replace, a text label or status word. No decorative icons with no semantic meaning.

### 5.6 Status Colors

See §5.1 for the full `--mjl-status-*` / `--mjl-alert-*` token mapping — no separate palette here; §10 maps each object's actual status vocabulary onto these five status tokens plus the four alert-severity tokens, never a bespoke color per object type.

## 6. Component Library Specification

Extends `docs/design-system/MJL_COMPONENTS.md`'s priority list — every component below already has a named slot there; this section fills in structure/states/wording so Codex can implement without re-deriving decisions.

1. **App sidebar** — Purpose: primary navigation. Structure: title + flat section list, active section expands children inline. States: default / active-section / active-child / collapsed(tablet)/drawer(mobile). A11y: each link is a real `<a>`, current page marked `aria-current="page"`. French: section labels per §3.1.
2. **Page header** — Purpose: orient the user and hold the primary action. Structure: title, optional breadcrumb above it, optional status badge next to title, primary action button top-right. States: with/without primary action, with/without breadcrumb. A11y: title is an `<h1>` per page.
3. **KPI card** — Purpose: one number, one meaning, one link. Structure: label, value, short context line, optional trend/status tint, click-through to filtered list. States: normal / zero / alert-tint. A11y: the whole card is a single focusable link, not a div with a nested link.
4. **Action card** — Purpose: surface a task, not just a number (e.g. "3 invitations en attente" with a direct "Gérer" action). Structure: icon, short label, count or short description, action link. States: normal / empty (hidden entirely if zero and not actionable, per Dashboard rules in §9).
5. **Data table** — Purpose: scannable list of objects. Structure: see §13 in full. States: loading / populated / filtered-empty / truly-empty / error.
6. **Filter bar** — Purpose: narrow a table without navigating away. Structure: inline row of selects/date pickers/search field above the table, "Réinitialiser les filtres" action when any filter is active. States: default / active-filters / no-results-from-filters (distinct empty state, see §13).
7. **Detail summary card** — Purpose: top-of-detail-page identity block (used on Project, Partner, Activity, Expense detail). Structure: name/title, status badge, key metadata row, primary actions. States: role-variant actions.
8. **Status badge** — Purpose: canonical status display, reused everywhere an object has a status. Structure: pill shape, icon + text, colored per §5.6. Never color-only. French labels per §10.
9. **Timeline item** — Purpose: one event in a chronological history (validation timeline, notes, exchanges). Structure: actor, action verb, timestamp, optional attached comment/document. States: system-generated vs user-authored entries visually distinguished (e.g. subtle icon difference) without using color alone.
10. **Notes / Commentaires block** — see §12 in full.
11. **Document list** — Purpose: filtered list of documents in the global library or on an object detail page. Structure: filename/label, type, source object link, date, guarded download action. States: empty / filtered-empty.
12. **Document status block** — Purpose: shows what's present vs missing for an object requiring justificatifs. Structure: checklist-style rows, each with a present/missing indicator (icon + text, not color-only) and, if missing, who should upload it. See §11.
13. **Upload context block** — Purpose: the only place a file input ever appears — always embedded in an object's own form (activity, expense, convention, fund receipt, project), never on the global Documents page. Structure: file input, accepted formats hint, existing-file list with replace/remove where permitted.
14. **Form section** — Purpose: group related fields under a heading inside a longer form. Structure: heading, optional help text, field group.
15. **Form field** — see §8 in full.
16. **Required document warning** — Purpose: block or warn submission when a mandatory justificatif is missing. Structure: inline warning banner near the submit action, naming the specific missing document(s). Never a silent disabled button with no explanation.
17. **Validation decision block** — Purpose: the reviewer's action surface (prevalidate/return/reject or final-validate/return/reject). Structure: decision buttons + mandatory reason field for return/reject, confirmation step before submission. See §8 and §13.
18. **Audit row** — Purpose: one line in a Historique/Audit table — actor, action, object, timestamp, and (if applicable) result. Structure: dense table row, monospace-free (audit rows are still read by humans, not developers). A11y: sortable columns have accessible sort-state labels.
19. **Empty state** — Purpose: explain absence and guide the next action. Structure: short icon, one sentence, optional single action link. Distinguish "nothing exists yet" from "nothing matches your filters" (different copy, see §13).
20. **Forbidden state** — see §4.5 and §7.
21. **Not found state** — see §4.5 and §7.
22. **Success alert** — Purpose: confirm a completed action. Structure: `--mjl-status-validated` tokens, icon, one-sentence confirmation, auto-dismiss or manual close. French: e.g. "L'activité a été soumise avec succès."
23. **Error alert** — Purpose: explain a failure and the next step. Structure: `--mjl-alert-blocking` tokens, icon, what happened + what to do. Never a raw exception or SQL fragment.
24. **Warning alert** — Purpose: non-blocking but important — e.g. approaching budget threshold. Structure: `--mjl-alert-warning` tokens, same explanatory shape as error alert.
25. **Confirmation modal / area** — Purpose: gate destructive or final actions (final validation, rejection, revocation). Structure: short question, consequence sentence, two clearly differentiated buttons (destructive action never the visually "safe-looking" default). A11y: focus trapped in modal, `Escape` closes, focus returns to trigger on close.

## 7. Screen Specifications

Grouped by shared pattern to avoid repeating identical structure 30 times. Every screen entry below explicitly covers all nine requested fields — Goal, Layout, Primary actions, Secondary actions, Data shown, Empty state, Error state, Role variations, Design risks — either individually or, for a cluster, once at the top with per-screen deltas; a field that is genuinely absent for a screen is stated as "none" rather than omitted, so nothing is silently missing.

### Auth cluster (screens 1–4)

Shared: centered card layout, MJL wordmark, no top bar (pre-auth), no register link anywhere (invitation-only, per authoritative decisions), every state-transition audited.

**1. Login** — Goal: authenticate. Layout: identifiant/mot de passe fields. Primary actions: "Connexion". Secondary actions: "Mot de passe oublié ?" link. Data shown: none beyond the form. Empty state: n/a. Error state: inline "Identifiant ou mot de passe incorrect." (never reveal which field is wrong). Role variations: none — pre-auth. Design risks: none — already close to target per audit (`hasRegister=false` confirmed at runtime); keep as-is.

**2. Mot de passe oublié** — Goal: request a reset link without account enumeration. Layout: single email field. Primary actions: "Envoyer". Secondary actions: "Retour à la connexion" link. Data shown: none. Empty state: n/a. Error state: only for malformed input — mandatory copy (`MJL_SECURITY_UX.md`): *"Si un compte correspond à cette adresse, un lien de réinitialisation sera envoyé."*, shown regardless of whether the account exists; never "Aucun compte trouvé." Role variations: none. Design risks: a future integration (e.g. rate limiting) must not leak enumeration through response-timing differences either — flag as an implementation detail for Codex, not just copy.

**3. Réinitialisation du mot de passe** — Goal: set a new password from a valid token. Layout: new/confirm password fields, password rules shown inline. Primary actions: "Réinitialiser le mot de passe". Secondary actions: "Retour à la connexion". Data shown: none beyond the form. Empty state: n/a. Error state: invalid/expired token → *"Cette invitation/ce lien a expiré. Veuillez contacter l'administrateur."* pattern, form not shown. Role variations: none. Design risks: token validity must be checked server-side before rendering the form, not client-side only (same class of risk as native-route guards).

**4. Invitation acceptance** — Goal: accept an admin-issued invitation and set initial credentials. Layout: invited email (read-only) + name + password fields. Primary actions: "Créer mon accès" (or equivalent verb — never "Créer un compte"/"Sign up"). Secondary actions: none. Data shown: invited email, assigned role/Partenaires-Programmes are not shown here (set by admin, not chosen by the user). Empty state: n/a. Error state: expired (*"Cette invitation a expiré. Veuillez contacter l'administrateur pour recevoir une nouvelle invitation."*), already-accepted (redirect to login + explanatory message), revoked (same copy as expired — no distinction needed for the end user). Role variations: none. Design risks: every state transition here (accepted/expired/revoked) must be audited — already a target per authoritative decisions, verify it's wired end to end.

### Dashboard (screen 5)

**5. MJL dashboard** — Goal: role-relevant "what needs my attention" landing page. Layout: KPI/Action card grid, role-scoped (full card taxonomy in the original prompt's Dashboard section), quick-links row sourced from the nav registry. Primary actions: none globally — each card is its own action (e.g. "Voir les activités en attente"). Secondary actions: quick-links row. Data shown: only MJL-relevant indicators; explicitly never Factures clients, Opportunités, Chèques à déposer, GRH, Comptabilité, Facturation, Clients modifiés. Empty state: "Aucune action en attente. Votre espace de travail est à jour." Error state: if a KPI computation fails, that card shows a muted "Indisponible pour le moment" rather than blocking the whole dashboard. Role variations: card set differs by role (§3.2 Entry Points). Design risks: dashboard must not silently grow generic Dolibarr widgets if a future module is enabled — route any new card through `MJL_DESIGN_GOVERNANCE.md`'s change process (see §18 risk).

### Projects cluster (screens 6–8)

**6. Projets list** — Goal: find a project, see its status at a glance. Layout: Filter Bar (Partenaire/Programme, statut, échéance) + Data Table. Primary actions: "Nouveau projet" (`VALIDATEUR_DEFINITIF`/`ADMIN_PLATEFORME` only). Secondary actions: per-row "Voir le détail". Data shown: name, Partenaire/Programme, status badge, budget consommé %, prochaine échéance. Empty state: "Aucun projet dans votre périmètre." (no-filter) / "Aucun projet ne correspond à ces filtres." + reset (filtered). Error state: table load failure → Error Alert above an empty table shell, not a blank page. Role variations: create button hidden for `AGENT_SAISIE`/`AGENT_VERIFICATEUR`. Design risks: none beyond the general scope-filter risk already tracked in the gap analysis (verify every list query is scope-filtered).

**7. Project detail** — Goal: single source of truth for one project. Layout: Detail Summary Card (name, status, Partenaire/Programme, dates) + KPI row (budget consommé/restant) + stacked sections: Résumé, Budget, Activités liées, Dépenses liées, Documents liés, Notes/Commentaires, Historique/audit (capability-gated). Primary actions: "Modifier" (`VALIDATEUR_DEFINITIF`/`ADMIN_PLATEFORME` only). Secondary actions: "Ajouter une note", per-related-object "Voir tout". Data shown: all sections above, each linking to its own filtered list. Empty state: per sub-section (e.g. "Aucune activité liée à ce projet."). Error state: a failed related-object query degrades that one section to an Error Alert, not the whole page. Role variations: "Modifier" and Historique/audit section hidden for `AGENT_SAISIE`/`AGENT_VERIFICATEUR`. Design risks: this page aggregates six object types — a single slow/failing query must not block the other five sections from rendering (partial-failure isolation).

**8. Project Notes / Commentaires** — see §12 in full. As a summary against the nine fields: Goal = give the project a running conversational record; Layout = Timeline Item list + posting form, embedded in screen 7; Primary action = "Ajouter une note"; Secondary actions = none; Data shown = author, timestamp, text, optional attachment; Empty state = "Aucune note pour le moment."; Error state = failed post keeps the draft text in the textarea (never silently discards it); Role variations = posting requires write right, scoped like everything else; Design risks = none beyond what's in §12.

### Activités cluster (screens 9–11)

**9. Activités list** — Goal: find/triage activities. Layout: Filter Bar (statut, projet, échéance) + Data Table, default sort deadline-risk then status. Primary actions: "Nouvelle activité" (`AGENT_SAISIE` only). Secondary actions: per-row "Voir le détail". Data shown: title, projet, status badge, échéance, actor. Empty state: role-aware — `AGENT_SAISIE` sees "Créez votre première activité"; reviewers see "Aucune activité en attente de révision." Error state: Error Alert above an empty table shell. Role variations: create button and column emphasis differ per role (reviewers' default sort surfaces "en attente de ma revue" first). Design risks: none beyond the shared scope-filter risk.

**10. Activity detail** — Goal: full picture of one activity plus its decision history. Layout: Detail Summary Card, description/execution fields, Validation Decision Block (role-gated), Timeline (submission → prevalidation → correction loop → final validation), Document Status Block, contextual notes. Primary actions by role: "Soumettre l'activité" (`AGENT_SAISIE`, draft only); "Prévalider" / "Retourner pour correction" (`AGENT_VERIFICATEUR`); "Valider définitivement" / "Retourner" / "Rejeter" (`VALIDATEUR_DEFINITIF`). Secondary actions: "Ajouter une note", "Mettre à jour l'exécution physique" (`AGENT_SAISIE`). Data shown: all fields above plus attached justificatifs. Empty state: n/a (always exists if reachable). Error state: a rejected decision submission (e.g. missing mandatory reason) blocks with an inline Error Alert on the Validation Decision Block, not a page-level failure. Role variations: never show two roles' decision buttons at once, and never show a decision button to the activity's own author (no self-review, Principle 6). Design risks: the correction loop (returned → corrected → resubmitted) must visibly distinguish each cycle in the timeline, not collapse repeats into one entry — otherwise reviewers can't tell how many correction rounds occurred.

**11. Activity creation/edit form** — Goal: capture a new/draft activity. Layout: Form Sections (Identification, Description, Exécution, Pièces justificatives via Upload Context Block). Primary actions: "Enregistrer le brouillon", "Soumettre l'activité". Secondary actions: "Annuler". Data shown: form fields only (or pre-filled existing draft data on edit). Empty state: n/a. Error state: inline per-field validation errors; Required Document Warning at submit time (not draft-save time) if a mandatory justificatif is missing. Role variations: only reachable by `AGENT_SAISIE` for their own scope. Design risks: draft-save must not require the same completeness as submit — a half-filled draft must be saveable, only submission is gated.

### Dépenses cluster (screens 12–14)

Same shape as the Activités cluster; deltas only.

**12. Dépenses list** — as screen 9, columns: title, projet, ligne budgétaire, montant, status badge. Secondary actions: same per-row "Voir le détail". Error state: same pattern. Design risks: montant column must be right-aligned and currency-formatted consistently with §8's amount-field rules, including in this read-only table context.

**13. Expense detail** — as screen 10, plus: "Marquer comme décaissé" (`VALIDATEUR_DEFINITIF` only, reachable only after final validation, never combined into the same button as final validation — décaissement and validation are separate states per Design Principle/authoritative decisions). Secondary actions: same as screen 10. Error state: same, plus an exceeds-budget warning banner (Warning Alert) surfaced independently of any submitted decision. Design risks: "Marquer comme décaissé" must be unreachable (not just hidden) before final validation — verify this server-side, not just via button visibility, given the self-disbursement/no-shortcut constraint.

**14. Expense creation/edit form** — as screen 11, plus a currency-formatted montant field with explicit unit, and mandatory justificatif upload enforced before submission (not before draft-save). Design risks: same draft-vs-submit completeness distinction as screen 11.

### Financement cluster (screens 15–18)

**15. Financement section landing** — Goal: orient into the three finance sub-areas. Layout: same "href = first child" pattern as other grouped sections — the URL redirects straight to Enveloppes de financement, there is no distinct landing content to design. Primary/secondary actions, data shown, empty/error states, role variations: n/a — see screen 16.

**16. Conventions (Enveloppes de financement)** — Goal: manage funding envelopes. Layout: list + detail. Primary actions: "Nouvelle enveloppe" (`VALIDATEUR_DEFINITIF`/`ADMIN_PLATEFORME` only). Secondary actions: per-row "Voir le détail". Data shown: Partenaire/Programme, montant total, période, statut (active/clôturée). Empty state: "Aucune enveloppe de financement enregistrée." Error state: Error Alert above empty table. Role variations: create/edit hidden for `AGENT_SAISIE`/`AGENT_VERIFICATEUR`. Design risks: none beyond shared scope-filter risk.

**17. Budget lines** — Goal: allocate/track budget lines under a project or envelope. Layout: list scoped to project/envelope, consumption indicator per line (bar + numeric %, never bar-only, per accessibility rules). Primary actions: "Nouvelle ligne budgétaire" (`VALIDATEUR_DEFINITIF`/`ADMIN_PLATEFORME`). Secondary actions: none beyond row detail. Data shown: libellé, montant alloué, montant consommé %, statut (normal/alerte ≥80%/critique ≥95%). Empty state: "Aucune ligne budgétaire pour ce projet/cette enveloppe." Error state: same table-load pattern. Role variations: create/edit hidden for `AGENT_SAISIE`/`AGENT_VERIFICATEUR`. Design risks: the ≥80%/≥95% thresholds already computed in `mjl_alerts.lib.php` must drive this screen's status badge directly, not a separately-maintained copy of the same logic (single source of truth).

**18. Fonds reçus** — Goal: record and track funds actually received. Layout: list + simple creation form, supports global (no project) or project-bound receipts. Primary actions: "Enregistrer un fonds reçu" (`VALIDATEUR_DEFINITIF`/`ADMIN_PLATEFORME`). Secondary actions: none. Data shown: date, montant, source (Partenaire/Programme), projet (or "Global"), pièce justificative link. Empty state: "Aucun fonds reçu enregistré." Error state: same table-load pattern. Role variations: create hidden for `AGENT_SAISIE`/`AGENT_VERIFICATEUR`. Design risks: the "Global" (no-project) case must be visually distinct from a missing/broken project link, never ambiguous.

### Documents cluster (screens 19–20)

**19. Documents library** — see §11 in full. Against the nine fields: Goal = consult, never create; Layout = Filter Bar + Document List; Primary actions = guarded download per row; Secondary actions = filter reset; Data shown = filename/label, type, source object link, date; Empty state = filtered-empty vs truly-empty distinguished (§9); Error state = a source query failure degrades that source's rows only, not the whole library; Role variations = scoped read-only for all four roles, `ADMIN_PLATEFORME` sees all but still read-only; Design risks = **no global upload button, ever** — the one non-negotiable constraint on this screen.

**20. Document download states** — Goal: safe, audited file retrieval. Layout: n/a (a state set on the Document List/Document Status Block components, not a separate page). Primary actions: guarded download link. Secondary actions: none. Data shown: filename, state indicator. States (this screen's core content): available (direct guarded link, audited on click), unavailable/missing (explicit "Document manquant" row state, never a broken link), forbidden (scope-excluded rows are not rendered at all, never a click-then-403), expired/removed (explicit state if the underlying record was deleted, not a silent 404). Role variations: which rows appear at all is scope-dependent; the state vocabulary itself is the same for everyone. Design risks: "forbidden" must be enforced by not rendering the row (server-side scope filter on the query), not by rendering it and blocking the click — a rendered-but-blocked row leaks the row's existence.

### Supervision cluster (screens 21–24)

**21. Supervision finance** (rename from "Tableau DPAF" — drop DPAF from user-facing text; route filename may stay `dpafdashboard.php` as tracked debt, see §17) — Goal: global financial/operational health view. Layout: KPI row (exécution physique %, budget consommé/restant, validations en attente) + charts only where they clarify a decision (validation bottleneck by level, deadline-risk summary — no decorative charts per `MJL_DASHBOARD_AND_DATA_VIZ.md`). Primary actions: click-through from any KPI/chart to its filtered list. Secondary actions: none. Data shown: per §9 of the original prompt's Supervision dashboard priorities. Empty state: "Aucune donnée de supervision pour le moment." Error state: a failed KPI computation shows "Indisponible" on that card only. Role variations: `VALIDATEUR_DEFINITIF`/`ADMIN_PLATEFORME` only. Design risks: same widget-drift risk as the main dashboard (§18).

**22. Historique des validations** — Goal: consult past validation decisions. Layout: filterable, sortable Data Table (decision type, actor, object, date, outcome). Primary actions: none (read-only) beyond row drill-in. Secondary actions: export (if capability granted). Data shown: per row above. Empty state: "Aucune validation enregistrée." / filtered-empty variant. Error state: table-load pattern. Role variations: `AGENT_VERIFICATEUR` sees only items they reviewed if granted; `VALIDATEUR_DEFINITIF`/`ADMIN_PLATEFORME` see the full scoped history. Design risks: page title and heading must read exactly "Historique des validations" — fixes the current `validations.php` title mismatch ("Historique validations MJL").

**23. Historique / Audit** — Goal: full audit trail for supervision-capable roles. Layout: Audit Row list with filters (actor, action type, object type, date range) + an "advanced search" affordance that folds in what `exchangelogs.php` does today. Primary actions: none beyond row inspection. Secondary actions: export. Data shown: actor's real name, French action verb, object's human label (ID as secondary/muted text), timestamp. Empty state: "Aucune entrée d'audit pour ces filtres." Error state: table-load pattern. Role variations: supervision-capable roles only. Design risks: this screen is the only legitimate home for exchange/audit advanced search — verify no other route re-exposes it as a primary nav item (regression of the Échanges rule).

**24. Reports / Exports** — Goal: generate CSV/XLSX exports. Layout: Export Toolbar per report type — name, data scope, period, filters, format (CSV/XLSX only), filename preview, role-restriction note, "Générer" action. Primary actions: "Générer". Secondary actions: none. Data shown: report metadata only, not a data preview (export itself is the "view"). Empty state: n/a (toolbar always renders). Error state: generation failure shows an Error Alert with a retry action, never a silent failed download. Role variations: which report types appear is capability-gated. Design risks: every export must be audited server-side — verify no export path bypasses the `export_generated` audit row.

### Administration (screen 25)

**25. Administration / Invitations** — Goal: manage user access. Layout: invitation list (Invitation Status Badge per row: en attente/acceptée/expirée/révoquée) + "Envoyer une invitation" form (email, rôle, Partenaires/Programmes assignment). Primary actions: "Envoyer une invitation". Secondary actions: per-row "Renvoyer", "Révoquer". Data shown: email, rôle, Partenaires/Programmes, status badge, sent date. Empty state: "Aucune invitation en attente." Error state: inline form validation (e.g. duplicate email) + Error Alert on send failure. Role variations: `ADMIN_PLATEFORME` only — everyone else 403s at the route level, not just hidden from nav. Design risks: this is the one screen where the `read_only_audit` overlay (§3.3) must specifically disable "Envoyer/Renvoyer/Révoquer" while leaving the list visible, since inviting/revoking access is unambiguously a write action.

### System states (screens 26–30)

**26. Forbidden / 403 state** — Goal: explain denial calmly and offer a way back. Layout: full MJL shell (sidebar scoped to the real user, utility header), centered message block. Primary actions: "Retour au tableau de bord". Secondary actions: none. Data shown: one-sentence explanation, *"Cette section n'est pas disponible pour votre rôle."* — a reason line only when safe to disclose, never revealing other users'/objects' existence. Empty state: n/a (this is itself a state). Error state: this is the error state for guarded routes. Role variations: sidebar still reflects the actual user's real capabilities (not a stripped-down generic sidebar). Design risks: must be the single shared component referenced everywhere (§18 risk) — no per-route bespoke variant.

**27. Not found / 404 state** — Same shell as 403. Copy: *"Cette page n'existe pas ou n'est plus disponible."* + "Retour au tableau de bord". Applies both to missing MJL routes and to native Dolibarr routes with no MJL equivalent (Track A/C in §3.4). Role variations: none — same for everyone. Design risks: same shared-component requirement as 403.

**28. Empty states** — see component #19 (§6) and per-screen entries above. Two distinct flavors required everywhere a list exists: "nothing exists yet" (no reset action) vs "nothing matches your active filters" (includes "Réinitialiser les filtres"). Design risks: conflating the two flavors (showing a generic "no results" for both) misleads a user who thinks their filters are the problem when actually nothing exists yet, or vice versa.

**29. Loading states** — Skeleton rows for tables (not a spinner-only blank page) so layout doesn't jump; buttons show an inline spinner + disabled state during submission to prevent double-submit. Design risks: a full-page blocking overlay for routine actions (e.g. saving a draft) reads as broken/slow even when it isn't — reserve full-page loading for true page navigation only.

**30. Error states** — see Error Alert component (#23 in §6). Any unrecoverable error still renders inside the MJL shell with a "Retour au tableau de bord" path — never a raw PHP error, stack trace, or bare Dolibarr error page. Design risks: an error inside one section of a multi-section page (e.g. Project detail, screen 7) must degrade that section only, not the whole page — see the partial-failure-isolation risk noted on screen 7.

## 8. Forms Specification

- **Page-level vs inline:** Creation/edit of a primary object (activity, expense, project, convention) is a page-level form (Form Section blocks). Small edits (a single status change, a comment) are inline forms within the object detail page — never a full-page navigation for a one-field change.
- **Labels:** French business labels only — "Montant", "Échéance", "Pièce justificative", never "amount", "due_date", "doc_type_id".
- **Required markers:** a visible asterisk + `aria-required`, never color-only.
- **Help text:** short, under the label, only when the field's purpose isn't obvious from the label alone (e.g. currency/format hints on Montant).
- **Validation errors:** inline, directly under the field, on submit and on blur for the more common mistakes (empty required field, malformed amount) — never a single top-of-form error summary with no per-field indication.
- **Disabled/read-only fields:** visually distinct from editable fields (subdued background, not just a slightly different border), with a reason available on hover/focus if not obvious (e.g. "Ce champ n'est modifiable qu'avant soumission.").
- **File inputs:** always inside an Upload Context Block (§6 #13), always show accepted formats and any size limit, always list existing files with a clear replace/remove affordance when permitted.
- **Date fields:** native date picker, French date format display (jj/mm/aaaa), no free-text date parsing.
- **Amount fields:** currency-formatted display, plain numeric entry, explicit currency unit shown adjacent (not embedded ambiguously in the placeholder).
- **Select fields:** French option labels, no raw database codes visible even as fallback text.
- **Textarea fields:** used for descriptions/reasons/comments; character count shown only where a limit exists.
- **Save/cancel buttons:** "Enregistrer" (or a specific verb like "Soumettre l'activité") + "Annuler", right-aligned as a pair, primary action visually dominant but not the destructive-looking color.
- **Correction/rejection reasons:** mandatory textarea whenever a Validation Decision Block's action is "Retourner pour correction" or "Rejeter" — the action cannot be submitted with an empty reason.
- **Validation decision actions:** rendered as the Validation Decision Block (§6 #17), always behind a Confirmation Modal for final/irreversible decisions (final validation, rejection), never for prevalidation-with-no-consequence-yet if the workflow allows an easy undo.

## 9. Tables Specification

Applies to: projets, activités, dépenses, documents, conventions, budget lines, fund receipts, validation history, audit history.

- **Column density:** 6–8 columns max on desktop; status and primary identifier (name/title) always the first two visible columns.
- **Default sorting:** deadline-risk/urgency first where applicable (activités, dépenses, alerts-adjacent tables), otherwise most-recent-first.
- **Status display:** Status Badge component in its own column, never blended into a text cell.
- **Action column:** rightmost, icon+label or a compact menu for 3+ actions — never bury the primary action (e.g. "Voir le détail") behind a menu.
- **Empty state:** per §7/§6 #19 — distinguish no-data from no-filter-match.
- **Filters:** Filter Bar component above the table (§6 #6), never a separate filter page.
- **Pagination:** standard page-based pagination, page size indicated, total count shown ("124 activités").
- **Responsive behavior:** below ~768px, collapse to stacked cards — each row becomes a card with label:value pairs, status badge retained prominently at the card top, action(s) as buttons at the card bottom. Never a horizontally-scrolling dense table on mobile as the primary pattern (acceptable only as a fallback for genuinely wide audit tables, with a clear scroll affordance).

## 10. Status And Wording Specification

Fix every accent-inconsistent and legacy-compatibility string the audit surfaced. Target vocabulary (French, accented, no "legacy"/"compatibilite historique" suffixes visible to end users):

| Object | Status values (target wording) |
|---|---|
| Activité | Brouillon · Soumise · En prévalidation · Retournée pour correction · Prévalidée · En validation finale · Rejetée · Validée définitivement · Annulée |
| Dépense | Brouillon · Soumise · En prévalidation · Retournée pour correction · Prévalidée · En validation finale · Rejetée · Validée définitivement · Décaissée |
| Projet | Actif · En alerte · Clôturé |
| Document | Disponible · Manquant · En attente |
| Fonds reçu | Enregistré · Rapproché (if applicable) |
| Ligne budgétaire | Normal · Alerte (≥80%) · Critique (≥95%) |
| Validation (history entry) | Prévalidée · Retournée · Validée définitivement · Rejetée |
| Audit (row outcome) | Réussi · Échoué (only where an action can fail in a way relevant to the reader) |

Specific replacements required (source: audit evidence):
- `"Validee definitivement (compatibilite historique)"` → **"Validée définitivement"**. If the distinction from a true final validation matters for internal debugging, keep it as a hidden data attribute or admin-only tooltip, never in the primary user-facing label. Affects `mjl_alerts.lib.php:792`, `expenses.php:751/759/760`, `partners.php:454`, `activities.php:852`, `projects.php:631`.
- `"Validation legacy"` → remove from user-facing text entirely (`expenses.php:776`); if a distinct data provenance needs to be shown to `ADMIN_PLATEFORME`, use "Migré" or similar neutral term, admin-only.
- `str_replace('Validee legacy', 'Validée définitivement', ...)` pattern in `reports.php:541` → fix at the source status label instead of patching it per-screen, so every surface (not just reports) shows the corrected wording consistently.
- Missing-accent status keys (`'Prevalidee'`, `'Corrigee'`, `'Rejetee'`, `'Annulee'`, `'Ligne budgetaire'` in `mjl_dashboard.lib.php:958-973`, `mjl_alerts.lib.php:770-800`) → align to the accented forms already used correctly in the `.lang` files ("Correction demandée", "Corrigé", "Rejeté", "Annulé").
- `"Historique validations MJL"` page title (`validations.php:5`) → **"Historique des validations"**, matching the sidebar label exactly (NAV-MED-001).
- `"Données à qualifier"` dashboard card → acceptable to keep admin-only, but reword to **"Éléments à qualifier"** with a clearer one-line explanation ("Objets sans partenaire/programme résolu — visibles uniquement par l'administrateur.") rather than the more technical "Objets ou traces sans périmètre résolu".
- Route/file names carrying legacy naming (`dpafdashboard.php`, `mjlfinancement_user_role` compatibility groups, POC-era bootstrap/fixture names) are **not** user-facing and are out of scope for this UI spec — track as code debt per `docs/mjl-current-vs-target-gap-analysis.md`, not a wording fix.

## 11. Documents UX Specification

Global Documents page is strictly read-only and aggregates from activities, expenses, conventions, and fund receipts (already implemented). Required elements:
- Persistent explanatory copy: *"Les documents sont ajoutés depuis la fiche activité, dépense, convention, fonds reçu ou projet concerné."*
- Filters: type, projet, date de/à (already implemented) — extend with Partenaire/Programme filter for supervision-capable roles.
- Search: add a text search over filename/label if feasible without a major backend change; treat as a nice-to-have, not a blocker for demo readiness.
- Consultation: Document List component (§6 #11), grouped or filterable by source object type.
- Audit: every download goes through the guarded route (`documentdownload.php`) and is logged (`document_downloaded` workflow audit) — no raw ECM/public links, ever, on any screen (already the current implementation; preserve it).
- Secure download: the guarded route pattern is correct; ensure it degrades to an explicit "Document manquant"/"Accès refusé" row state rather than a broken link or silent 404 when the underlying file/record is unavailable.
- **No global upload button** — this is an authoritative, non-negotiable constraint (§2 Principle 5, `mjl-authoritative-decisions.md`).

## 12. Project Notes / Commentaires Specification

Rendered as an ordered **timeline**, not a single comment blob (already correctly implemented at `projects.php:303`, preserve this pattern and extend it to the other object detail pages that support contextual exchanges — activity, expense, convention, budget line, fund receipt). Structure per entry (Timeline Item component, §6 #9): author, timestamp, comment text, and — where applicable — an attached document reference (linking into the guarded download route, never a raw file link). Creation is contextual only (posted from the object's own detail page), consistent with the "no standalone Échanges menu" rule — this timeline *is* the user-facing realization of that rule, not a separate feature. Empty state: "Aucune note pour le moment. Ajoutez la première note ci-dessous." Posting form: single textarea + optional file attach + "Ajouter une note" button, no page navigation required to post.

## 13. Supervision And Audit UX Specification

Supervision groups: Supervision finance (KPI dashboard), Historique des validations, Alertes globales, Rapports/Exports, Historique/Audit. No standalone Échanges menu item anywhere in primary navigation — confirmed correct in current implementation, must remain so. The advanced exchange/audit search (`exchangelogs.php`) is folded into Historique/Audit as an "advanced search" affordance for supervision-capable roles only, not a separate sidebar entry, matching its current guard (`mjl_workspace_require_advanced_traceability_access()`). Audit rows (Audit Row component, §6 #18) must be legible to a non-technical auditor: actor's real name (not a user ID), a French action verb ("a validé", "a téléchargé", "a exporté"), the object's human label (not a database ID alone, though the ID may appear as secondary/muted text for cross-reference), and timestamp. Export from Historique/Audit follows the same Export Toolbar pattern as Rapports/Exports (§7 screen 24).

## 14. Responsive And Accessibility Requirements

Target breakpoints: desktop 1366×768 (primary), tablet 768×1024, mobile 390×844 (all already used in the audit's screenshot set — keep as the standard test matrix).

- **Keyboard navigation:** every interactive element (sidebar links, table row actions, form fields, modal triggers) reachable and operable via Tab/Shift+Tab/Enter/Space, in a logical order matching visual layout.
- **Focus states:** visible focus ring using `--mjl-color-focus-ring` on every focusable element, including custom-styled buttons and the sidebar's active link — never `outline: none` without a replacement.
- **Contrast:** all text/background pairs meet WCAG AA (4.5:1 body text, 3:1 large text/icons) — verify the existing muted tones (`#5c6870` on `#ffffff`, `#34414a` on `#f5f7f8`) against this threshold during implementation.
- **Touch targets:** minimum 44×44px for buttons/links on tablet and mobile layouts, including table row action icons (which must not shrink below this on the stacked-card mobile table pattern).
- **Sidebar collapse:** tablet icon-rail and mobile drawer per §4.2/§4.3, both keyboard-operable (drawer trap-and-release focus like a modal).
- **Table overflow:** stacked-card fallback per §9, not silent horizontal scroll, for all primary object tables; audit/history tables may use horizontal scroll with a visible scroll affordance as an accepted exception given their column count.
- **Form usability:** labels always visible (no placeholder-as-label pattern), error messages programmatically associated with their field (`aria-describedby`), required fields announced to assistive tech.
- **Screen-reader-friendly labels:** icon-only buttons (e.g. a table row's download icon) always carry an `aria-label` naming the actual action + object ("Télécharger le justificatif de la dépense D-2026-014"), not a generic "Télécharger".
- **200% zoom:** layout must remain usable (no clipped content, no overlapping fixed elements) at 200% browser zoom, per `MJL_ACCESSIBILITY_CHECKLIST.md`.

## 15. Implementation Guidance For Codex

### Phase 1: Native Dolibarr UI blocker containment
Two-track execution per §3.4: (a) **discovery step first** — verify no MJL code path depends on `comm`/`hrm`/`holiday`/`expensereport`/`compta`/`accountancy`/`banque`/`tax`/`modulebuilder`, then disable those modules in standard Dolibarr module configuration (Track A); (b) make the server-side redirect guard for `projet`/`societe`/`ecm`/admin-config routes actually execute — verified per route, for GET and POST alike, firing *before* any native business logic runs, not just defined and untriggered (Track B). Also: confirm the status of Dolibarr's REST API module and either disable it or audit every reachable endpoint for MJL scope enforcement; extend the Apache deny/branded-error-document for `/core/tools.php`; remove native top chrome (`llxHeader()`/`llxFooter()` native menu output) for normal MJL workspace users within the safe custom module/theme boundary. This directly resolves NAV-BLOCKER-001 and NAV-BLOCKER-002 from the audit and must be verified with the runtime method the audit used (final URL + status code + absence-of-native-chrome-text assertions, plus a direct-POST check for the mutation-before-redirect risk in §18), not just static code review.

### Phase 2: App shell and sidebar polish
Implement the minimal utility header (§4.4), the MJL-styled forbidden/404 shell (§4.5/§7 screens 26–27) so every guarded route — MJL and native — degrades into it, and align `Partenaires / Programmes` primary-section documentation (update `MJL_INFORMATION_ARCHITECTURE.md` per §3.1's recommendation — no code change required here, this section is already correctly positioned in the live sidebar).

### Phase 3: Screen/component consistency
Apply the token values from §5 across `mjl_app.css.php`, implement the read-only-audit capability overlay (§3.3) instead of a new role, and bring every screen in §7 into alignment with its documented layout — most screens are close; this phase is mostly verification + targeted fixes (e.g. validations.php title, DPAF-branded labels).

### Phase 4: Forms and tables
Apply §8/§9 rules consistently — Required Document Warning, mandatory reason fields on return/reject, stacked-card mobile tables, empty-state differentiation (no-data vs no-filter-match) across all nine table types.

### Phase 5: Forbidden/404 states
Wire every guarded MJL route and every native-route interception from Phase 1 into the same shared forbidden/404 shell component — single implementation, reused everywhere, no per-route bespoke error page.

### Phase 6: Tests and screenshots
Repair/add the native-route E2E coverage the audit found stale
(final-URL/status/absence-of-native-chrome assertions, not
text-presence-of-access-denied assertions), add non-mutating smoke checks so
demo-readiness can be re-verified without seeding/mutating data, and refresh
the desktop/tablet/mobile screenshot evidence after fixes.

### Phase 7: Documentation
Update `docs/mjl-current-vs-target-gap-analysis.md` to reflect native-UI
blocker status after fixes, update `MJL_INFORMATION_ARCHITECTURE.md` to match
§3, and update the active design-system docs per
`MJL_DESIGN_GOVERNANCE.md`'s required change-process fields.

## 16. Acceptance Criteria

- Zero native Dolibarr chrome text (`Rechercher`, `Mon tableau de bord`, `Configuration`, `Outils d'administration`, `Utilisateurs & Groupes`, `Accueil`) present in the rendered HTML of any MJL page for any of the four roles.
- Direct navigation to `/projet`, `/societe`, `/ecm` for a non-`ADMIN_PLATEFORME` user results in a final URL under `/custom/mjlfinancement/` (redirect target per §3.4 table) with status 200 on the MJL page — never a native URL persisting with status 200. The same POST to the native route's own form action must not execute native business logic before the redirect fires (verified by confirming no corresponding native row is created/mutated).
- `/comm`, `/hrm`, `/holiday`, `/expensereport`, `/compta`, `/accountancy`, `/banque`, `/tax`, `/modulebuilder` are confirmed disabled at the module level (native "module not active" response) for every role including `ADMIN_PLATEFORME` — verified by absence of native page body text (`Espace RH`, `Espace facturation et paiement`, Module Builder text), not just presence of a denial phrase. Module-disable is only signed off after the Phase 1 dependency-verification step confirms no MJL code path reads from that module.
- `/admin/modules.php` and related admin/config routes return an MJL-styled 403 for every non-`ADMIN_PLATEFORME` role; `ADMIN_PLATEFORME` reaches them directly by URL with no additional gate (they are simply absent from the MJL sidebar).
- Dolibarr's REST API module is either disabled, or every endpoint reachable by a non-admin session has been audited and confirmed to enforce the same Partenaire/Programme scope filtering as the equivalent MJL screen — verified by an authenticated `AGENT_SAISIE` API request for an out-of-scope object returning no data.
- No global upload control exists on `/custom/mjlfinancement/documents.php` for any role, including `ADMIN_PLATEFORME`.
- `validations.php` page title and heading read exactly "Historique des validations".
- No user-facing string contains "legacy" or "compatibilite historique"; every status label in §10's table is accent-correct and matches across dashboard, list, detail, and export surfaces for the same status value.
- Every guarded MJL route (403/404 case) renders inside the full MJL shell (sidebar + utility header), never Dolibarr's native `accessforbidden()` output.
- A `read_only_audit` capability, when granted, hides every write action/button/POST route while preserving all read/export surfaces at the base role's normal scope, verified for at least one base role via direct POST attempt (should fail server-side even if a client somehow bypassed the hidden button).
- All 9 primary table types (§9) render as stacked cards at ≤768px viewport width, with status badge and primary action preserved.
- Contrast, focus-visibility, and keyboard-navigability checks pass per §14 on at minimum: login, dashboard, one list screen, one detail screen with a Validation Decision Block, and the forbidden/404 shell.

## 17. Open Questions

- **`Lecteur / Audit` capability model formal approval.** This spec treats it as a `read_only_audit` overlay on the four existing roles (per the confirmed decision in this planning session), not a fifth role. This still needs formal client sign-off before `CONTEXT.md` can move this dimension out of pending validation.
- **Final route/action permission matrix approval** — `CONTEXT.md` keeps this pending; this spec's capability-based approach is designed to absorb whatever the final matrix says without a navigation rewrite, but the matrix itself is not this document's to finalize.
- **Legacy route/file naming cleanup scope** (`dpafdashboard.php`, `conventions.php` as the Enveloppes route, POC-era bootstrap/fixture names) — not user-facing, so out of this UI spec's scope, but should be scheduled as a follow-up code-debt phase; confirm priority with the client/product owner.
- **Document library global search** (§11) — flagged as nice-to-have; confirm whether it's in scope for the current phase or deferred.
- **Dolibarr module dependency check for Track A (§3.4).** Before disabling `comm`/`hrm`/`holiday`/`expensereport`/`compta`/`accountancy`/`banque`/`tax`/`modulebuilder`, Codex must confirm none of MJL's own code (including scheduled scripts and exports, not just the screens in this spec) reads from their tables/classes. This is a discovery task, not a design question, but it blocks Phase 1 sign-off until done.
- **Dolibarr REST API module status.** Not investigated as part of this planning pass — is it currently enabled for the MJL entity, and if so, does anything (internal or external) actually consume it? This determines whether the recommended fix is "disable it" (simple) or "audit every endpoint for scope enforcement" (materially more work) — see §18.
- **`read_only_audit` scope breadth.** This spec anchors the capability to `ADMIN_PLATEFORME` (unrestricted scope) per the confirmed decision. If the client's real need is a *scoped* external auditor, that's a different, unaddressed design — flag for client clarification before broadening the capability model.

## 18. Risks And Loopholes

**Risk: Native-route guard is reintroduced as client-side-only (JS/CSS) again.**
Why it matters: this is exactly the root cause of the current FAIL verdict — a JS redirect and CSS hiding were built, but neither prevents the server from rendering the native page, so any JS-disabled or direct-fetch access sails straight through.
Prevention: treat §3.4's enforcement-layer ordering as mandatory — server-side (PHP hook verified to actually fire, or Apache-level deny) is the only layer counted toward acceptance; CSS/JS are cosmetic only.
Codex verification: fetch each route in §3.4's table with a plain HTTP client (no JS execution) as a non-admin session cookie and assert final URL/status per the table — this is the same method the audit used and caught the original failure.

**Risk: "Remove native chrome" implemented as `display: none` CSS on menu items rather than not rendering them.**
Why it matters: screen readers and view-source still expose the native menu/links; a user could still reach them via browser history, saved links, or assistive tech announcing hidden-but-present content depending on how the hiding is done.
Prevention: prefer not rendering the native chrome at the template/hook level over CSS-hiding it; if CSS-hiding is unavoidable for a specific element, use `display:none` (which is at least excluded from the accessibility tree) and confirm it, never `visibility:hidden`/`opacity:0` alone.
Codex verification: inspect rendered HTML (not just visual screenshot) for absence of the listed native menu strings, plus an axe/accessibility-tree check that the hidden elements aren't announced.

**Risk: Partial shell rollout — some routes get the MJL forbidden/404 shell, others still hit Dolibarr's native `accessforbidden()`.**
Why it matters: UI-HIGH-001 in the audit found exactly this inconsistency already; a route-by-route fix without a shared component invites regressions every time a new guarded route is added.
Prevention: implement the forbidden/404 shell as one shared component (§6 components #20/#21) that every guard call site uses, not a per-route copy-paste.
Codex verification: grep for remaining calls to Dolibarr's native `accessforbidden()` in `custom/mjlfinancement/` after Phase 1/5 and confirm each has been routed through the shared MJL component instead.

**Risk: Status-wording fixes applied inconsistently across surfaces (e.g. fixed in `reports.php` via string-replace patch but not at the source label function).**
Why it matters: the audit found exactly this pattern already (`reports.php:541`'s `str_replace('Validee legacy', ...)`) — a per-screen patch instead of a source fix guarantees future drift as new screens are added.
Prevention: fix status labels at the single source function(s) (`mjl_dashboard_activity_status_label()` and equivalents in `mjl_alerts.lib.php`), remove the reports.php-level string-replace patch once the source is fixed.
Codex verification: grep for `str_replace` calls touching status strings after the fix; there should be none needed for correctly-sourced labels.

**Risk: `read_only_audit` capability overlay is implemented as a UI-only hide (buttons removed) without a matching server-side POST guard.**
Why it matters: this is the same class of failure as the native-route blocker — `CONTEXT.md` records the durable rule that UI hiding is not access control.
Prevention: every write route must check the capability server-side independent of whether the triggering UI element was rendered.
Codex verification: with a `read_only_audit`-flagged session, attempt a direct POST to a write endpoint (e.g. activity submission) and confirm a server-side rejection, not just an absent button.

**Risk: Dashboard KPI/card set drifts toward generic Dolibarr widgets over time as new modules or reports are added.**
Why it matters: the audit confirmed the current card set is clean (no Factures/GRH/Comptabilité widgets), but nothing structurally prevents a future addition from reintroducing one.
Prevention: route all new dashboard cards through `MJL_DESIGN_GOVERNANCE.md`'s change-process (reason, affected screens/components, before merge).
Codex verification: periodic manual review of `index.php`'s card definitions against the "avoid" list in this spec's original prompt (§5, MJL Dashboard section) and `MJL_DASHBOARD_AND_DATA_VIZ.md`.

**Risk: a native-route redirect fires after Dolibarr's own POST handler has already executed, so data is mutated before the user is bounced back to MJL.**
Why it matters: a guard that checks "should I redirect?" only when building the *response* is too late if Dolibarr's controller already ran its business logic (e.g. created/updated a native `societe`/`projet` row) earlier in the same request — the user experience looks fixed (they land on the MJL page) while a native side effect has already happened invisibly.
Prevention: the Track B hook must run at the earliest point in Dolibarr's request lifecycle available to a custom hook (before the native controller's action-processing block), for both GET and POST, and must short-circuit the request entirely rather than letting native processing continue and only changing what's rendered.
Codex verification: for each Track B route, submit a POST that would create/modify a native object if unguarded, confirm the redirect happens, then directly inspect the relevant native table to confirm no row was created/changed.

**Risk: a Dolibarr module is disabled (Track A, §3.4) without first confirming MJL's own code doesn't depend on it, silently breaking a working MJL feature.**
Why it matters: this spec's own strongest recommendation (module-disable) becomes a self-inflicted regression if, say, MJL's document storage secretly relies on the ECM module being active, or an export script queries an `accountancy` table nobody remembered.
Prevention: treat the dependency-verification step in Phase 1 as a hard precondition, module by module — do not disable `comm`/`hrm`/`compta`/`modulebuilder` (or any Track A module) until that module specifically has been checked clean, and disable them one at a time with a full MJL regression pass (existing E2E suite) after each, not all at once.
Codex verification: full E2E suite green after each individual module disable, plus a manual grep of `custom/mjlfinancement/` for the disabled module's table names/class names turning up nothing outside comments/legacy-compat code already tracked as debt.

**Risk: Dolibarr's REST API bypasses MJL's custom Partenaire/Programme scope filtering entirely, since that filtering is MJL's own SQL-level logic, not a Dolibarr rights concept.**
Why it matters: this spec's whole security model (§2 Principle 2, §3.3) rests on "every visibility rule doubles as a route guard" — but that principle was built around MJL's own PHP routes; a generic Dolibarr REST API endpoint was not part of the audit's scope and may not apply MJL's scope filter at all, meaning a scoped `AGENT_SAISIE` could read data belonging to a Partenaire/Programme they aren't assigned to simply by calling the API directly.
Prevention: disable the API module unless a specific integration requires it; if kept, every reachable endpoint must be individually confirmed to apply the same scope filter as its MJL screen equivalent before "no native surface leaks data" can be considered true.
Codex verification: authenticate as a narrowly-scoped `AGENT_SAISIE` test user, call the API for an object type known to exist outside their scope, and confirm zero rows are returned (or the endpoint is confirmed disabled/404).
