# MJL Clarity System - Full Interface And Design-System Redesign Brief

## Purpose Of This Brief

This file is intended to be copied into an online design agent. It must provide enough context for that agent to propose a complete refonte of the MJL interface and design system without direct access to the repository.

The expected output is not only visual polish. The online agent should produce a complete redesign package for:

- information architecture;
- role-based navigation;
- page layouts;
- reusable components;
- design tokens;
- French microcopy;
- workflow and alert patterns;
- official output patterns;
- accessibility rules;
- responsive behavior;
- E2E acceptance criteria;
- an implementation roadmap that respects the existing Dolibarr constraints.

## Product Context

MJL is a Dolibarr-based proof of concept for monitoring public-finance projects funded by external partners. The POC has proven the technical feasibility. The next objective is to make the application feel like a dedicated ministry workspace rather than a generic ERP.

The product direction is:

> A calm administrative control room for externally funded projects.

The interface must feel:

- institutional;
- serious;
- sober;
- clear;
- trustworthy;
- French-first;
- optimized for administrative users;
- centered on validation, traceability, alerts, documents, and reporting.

The interface must not feel like:

- a raw Dolibarr installation;
- a generic ERP;
- a decorative SaaS dashboard;
- a complex accounting back office;
- a developer-only technical tool.

Primary usage is desktop/laptop. Mobile must remain usable, but mobile is not the primary target.

## Domain Vocabulary And Object Model

The online agent should use these domain meanings when proposing navigation, labels, and page layouts.

| Term | Meaning for users | Design implication |
| --- | --- | --- |
| Projet | Public-finance project being monitored | Main organizing object for activities, budgets, documents, and reporting |
| Activite | Operational activity under a project/convention | Core workflow object for creation, submission, review, correction, validation, and audit |
| Depense | Expense linked to project, convention, optional activity, and budget line | Must show amount, document state, validation state, correction/rejection context, and budget impact |
| Convention | Funding agreement/frame attached to project and PTF/bailleur | Naming is not final; design agent may propose whether to keep `Convention` or use a clearer label such as mission/enveloppe |
| Ligne budgetaire | Budget allocation line | Usually advanced finance context; should be embedded where it helps validation rather than exposed raw to Level 1 |
| Reception de fonds | Fund receipt against project/convention | Supervision/Admin monitoring object |
| Piece justificative | Supporting document, stored through Dolibarr ECM | Must be visible in validation/document checklists; missing document state is an alert source |
| Validation | Decision action on an activity or expense | Must be represented as timeline plus decision panel, not only buttons |
| Historique / Audit | Trace of decisions, status changes, actors, comments, dates | Must remain trustworthy, readable, and hard to confuse with editable content |
| PTF / Bailleur | External funding partner, usually stored through native third-party data | Avoid generic Dolibarr labels such as customer/supplier for normal users |

Core relationships:

```txt
Projet
  -> Conventions
  -> Activites
  -> Lignes budgetaires
  -> Depenses
  -> Receptions de fonds
  -> Documents

Activite
  -> Projet
  -> Convention
  -> Optional native task
  -> Depenses liees
  -> Workflow actions / audit
  -> Echanges

Depense
  -> Projet
  -> Convention
  -> Optional activite
  -> Ligne budgetaire
  -> Piece justificative
  -> Validation history
```

## Non-Negotiable Constraints

- Do not propose Dolibarr core edits.
- MJL-specific implementation must stay inside `custom/mjlfinancement`, `docs/`, documented setup scripts, documented sample-data locations, or a documented custom theme boundary.
- Preserve invitation-only access.
- Do not create or suggest a public registration page.
- Only Admin can send invitations for now.
- Preserve the temporary access model: Level 1, Level 2, Level 3, Admin.
- Preserve active Dolibarr entity filtering for custom objects, dashboards, alerts, exports, audit lists, and workflow lookups.
- Preserve workflow rules, audit history, export behavior, and no-self-validation behavior.
- Preserve French-first UI and content.
- E2E tests are the primary validation method for app UI, auth, dashboards, alerts, exports, official outputs, and workflow changes.
- Native Dolibarr features can remain available for Admin or technical users, but normal users should experience an MJL-specific workspace.

## Temporary Access Model

The final permission matrix is not yet defined. The redesign must use only this temporary model.

### Level 1 - Operational User

Examples: agent, activity creator, basic project contributor.

Primary needs:

- see personal dashboard;
- create an activity;
- edit own draft activity;
- resubmit a returned activity;
- follow own submitted activities;
- see relevant alerts;
- upload or view supporting documents;
- access own profile/account.

Should not see:

- invitation management;
- global administration;
- system settings;
- unrelated audit screens;
- full portfolio supervision controls.

### Level 2 - Reviewer / Validator

Examples: N+1, N+2, hierarchical reviewer.

Primary needs:

- see validation queue;
- review submitted activities;
- validate, return for correction, or reject where allowed;
- add decision comments;
- inspect supporting documents;
- see decision history;
- see alerts related to pending validations.

N+1 and N+2 may be visually distinguished if useful, but both remain Level 2 for now.

### Level 3 - Supervision / DPAF

Examples: DPAF, project-finance supervisor, global monitoring role.

Primary needs:

- global dashboard;
- portfolio overview;
- project and activity status;
- validation bottlenecks;
- deadline risks;
- alerts;
- exports;
- audit visibility;
- reporting shortcuts;
- advanced filters.

### Admin

Admin is separate from the three functional levels.

Primary needs:

- user management;
- invitation sending;
- invitation revocation/resend;
- role assignment;
- account activation/suspension;
- technical configuration;
- module settings;
- advanced Dolibarr access where needed.

Admin is currently the only role that can send invitations.

## Information Architecture Target

The target app should be organized around MJL work, not Dolibarr internals.

Primary areas:

1. Tableau de bord
2. Projets
3. Activites
4. Validations
5. Alertes
6. Documents
7. Exports
8. Historique / Audit
9. Administration

Target hierarchy:

```txt
Tableau de bord
  - Mes actions attendues
  - Alertes
  - Activites recentes
  - Raccourcis d export

Projets
  - Liste des projets
  - Detail projet
  - Activites du projet
  - Documents du projet

Activites
  - Liste des activites
  - Creer une activite
  - Detail activite
  - Modifier brouillon
  - Historique de decision

Validations
  - File d attente
  - Detail a valider
  - Decisions passees

Alertes
  - Toutes les alertes
  - Alertes urgentes
  - Alertes resolues si applicable

Exports
  - Centre d exports
  - Export activites
  - Export projets
  - Export audit si autorise

Administration
  - Utilisateurs
  - Invitations
  - Roles
  - Parametres techniques
```

Role entry points:

- Level 1 lands on `Tableau de bord personnel`.
- Level 2 lands on `File de validation`.
- Level 3 lands on `Tableau de bord global`.
- Admin lands on `Administration / Utilisateurs`, unless also assigned to a functional role.

Use breadcrumbs on deep pages, for example:

```txt
Tableau de bord > Activites > Activite A-2026-014
```

Do not use breadcrumbs on simple auth pages.

## Route Inventory For Redesign

Custom MJL routes already visible in the repository:

| Route | Current role | Redesign priority |
| --- | --- | --- |
| `/custom/mjlfinancement/index.php` | Workspace shell | High |
| `/custom/mjlfinancement/dpafdashboard.php` | Level 3/Admin dashboard | High |
| `/custom/mjlfinancement/activities.php` | Activity create/list/detail/workflow | Critical |
| `/custom/mjlfinancement/expenses.php` | Expense create/list/upload/workflow | Critical |
| `/custom/mjlfinancement/alerts.php` | Alert/risk center | High |
| `/custom/mjlfinancement/reports.php` | Official export center | High |
| `/custom/mjlfinancement/conventions.php` | Read-only convention list | Medium, needs naming decision |
| `/custom/mjlfinancement/budgetlines.php` | Read-only budget lines | Medium, likely advanced/contextual |
| `/custom/mjlfinancement/fundreceipts.php` | Read-only fund receipts | Medium |
| `/custom/mjlfinancement/validations.php` | Expense validation history | Medium |
| `/custom/mjlfinancement/workflowactions.php` | Advanced activity workflow audit | Medium, advanced-only |
| `/custom/mjlfinancement/exchangelogs.php` | Exchange logs | Medium |
| `/custom/mjlfinancement/admin/access.php` | Admin invitation/access management | High for Admin |
| `/custom/mjlfinancement/invitation.php` | Invitation acceptance / first password | High for auth |

Native or inferred Dolibarr surfaces that may need MJL wrapping, hiding, or safe theme treatment:

- login page;
- forgotten password page;
- password reset page;
- native home/navigation;
- native third parties/PTF data;
- native projects/tasks;
- native ECM/documents;
- native users/groups/permissions/admin;
- native export module;
- module setup/configuration.

## Implemented Custom Screens

The following custom screens already exist and are the main scope for redesign.

### Workspace Shell

Route: `/custom/mjlfinancement/index.php`

Current implementation:

- role-aware MJL workspace header;
- Level 1 cards for drafts, submitted expenses, missing documents, and active alerts;
- Level 2 cards for submitted activities, submitted expenses, deadline risks, and active alerts;
- Level 3 DPAF cards for pending reviews, deadline risks, and reports;
- Admin cards for invitations, risks, and reports;
- quick links filtered by active rights.

Current problems:

- repeated risk/alert concepts can compete with each other;
- hierarchy between personal action, validation queue, and portfolio supervision can be clearer;
- empty states need stronger administrative guidance;
- the screen still depends on card grids more than task flow.

Redesign objective:

- make the dashboard answer "What needs my attention now?";
- show role-specific next actions first;
- show supervision and export shortcuts only where relevant;
- hide generic ERP complexity.

### DPAF Dashboard

Route: `/custom/mjlfinancement/dpafdashboard.php`

Current implementation:

- supervision KPIs;
- deadline-risk cards;
- pending review table;
- budget/expense table;
- recent funds;
- recent audit rows;
- activity rows link directly to activity detail where possible.

Current problems:

- dense table/KPI presentation;
- weak distinction between urgent, monitoring, and reference information;
- source/period context for dashboard data is limited;
- bottlenecks, missing documents, and deadline risks need stronger visual hierarchy.

Redesign objective:

- make this a Level 3 control room for risks, bottlenecks, missing documents, and official outputs;
- preserve active-entity filtering and role restrictions;
- keep audit and financial figures traceable.

### Activity Workflow

Route: `/custom/mjlfinancement/activities.php`

Current implementation:

- activity creation and list;
- activity detail view;
- status-first workflow panel;
- validation/correction/rejection actions;
- timeline-style audit evidence;
- document checklist context for linked expenses;
- role-aware visibility and no-self-validation protection.

Current problems:

- workflow timeline can become more central and legible;
- decision panel needs clearer Level 2 ergonomics;
- correction reasons and previous decisions should be easier to scan;
- activity list still needs stronger filtering, grouping, and task orientation.

Redesign objective:

- make the activity detail answer "Can this activity move to the next step?";
- put status, responsible actor, next action, deadline, document state, and audit trail above secondary details;
- preserve no-self-validation and audit history.

### Alerts And Risks

Route: `/custom/mjlfinancement/alerts.php`

Current implementation:

- standalone `Alertes MJL` center;
- alert cards with severity, object, audience, expected action, metadata, and action link;
- alert types include approaching/overdue activity deadlines, submitted activities, submitted expenses, and missing expense documents;
- alert dates use `DD/MM/YYYY`;
- Level 1 sees only own operational alerts;
- Level 2 sees validation alerts;
- Level 3 and Admin see portfolio alerts.

Current problems:

- the same object can appear as multiple alert cards if multiple alert conditions apply;
- severity language is still basic;
- "why this alert appears" can be clearer;
- expense alerts currently link to the expense list because expense detail redesign is deferred.

Redesign objective:

- make alerts actionable and explainable;
- decide whether alert conditions should be grouped by object;
- define severity levels and visual treatment: information, warning, urgent, blocking;
- preserve role-specific alert visibility.

### Reports And Exports

Route: `/custom/mjlfinancement/reports.php`

Current implementation:

- `Centre d exports MJL`;
- report selector with descriptions;
- report-aware filters that hide unsupported filters;
- required filter messaging for project and convention summary reports;
- export context: report, scope, period, active filters, format, role restriction, filename preview;
- CSV export with UTF-8 BOM, semicolon separator, French-readable statuses, and matching preview filename;
- server-side required-filter enforcement.

Current problems:

- wide preview tables are hard to scan;
- preview versus generated official CSV needs clearer explanation;
- filenames may still include internal IDs for project/convention filters;
- export audit logging, PDF, and print views are not implemented.

Redesign objective:

- make exports feel like official outputs, not technical downloads;
- keep filters, scope, period, filename, and role restrictions visible;
- preserve CSV guarantees and active-entity filtering.

### Auth And Access

Relevant implemented surfaces:

- invitation acceptance;
- first password setup;
- password reset lifecycle;
- invitation management for Admin.

Current implementation:

- invitation acceptance and password setup flows are hardened;
- password reset and invitation lifecycle have E2E coverage;
- no public registration page is created.

Current problems:

- native Dolibarr login/recovery pages may still expose generic Dolibarr identity;
- safe customization boundary for some auth surfaces must remain documented before UI source changes;
- account-enumeration-safe wording must be preserved.

Redesign objective:

- make auth feel like part of MJL, not separate Dolibarr plumbing;
- keep invitation-only access unmistakable;
- keep recovery/reset wording neutral and secure.

## Existing Or Deferred Screens That Need Design Decisions

The following screens exist or are inferred and should be included in the broader refonte strategy even if they are not all implemented as polished MJL screens yet.

| Area | Current state | Target direction |
| --- | --- | --- |
| Expenses | Dense list/form with upload and validation actions | Expense workflow workspace with document state, decision panel, and contextual audit |
| Conventions | Raw read-only list | Decide label and mental model: convention, mission, envelope, or project funding frame |
| Budget lines | Raw finance setup table | Advanced-only or embedded budget context inside activity/expense/report flows |
| Fund receipts | Raw read-only monitoring table | Level 3/Admin funding monitoring with project/convention/PTF labels and document state |
| Expense validation history | Isolated read-only audit list | Rename clearly and integrate relevant history into contextual views |
| Workflow actions | Advanced technical audit table | Keep advanced-only; normal users need contextual timelines |
| Exchange logs | Technical object-linked exchange list | Contextual exchange timeline tied to activities or MJL objects |
| Native Dolibarr home/nav | Generic ERP navigation | Hide/de-emphasize for normal users; preserve Admin technical access |
| Native third parties/PTF | Native reference data | Advanced/reference-data area or MJL wrapper if needed |
| Native projects/tasks | Useful model, generic UI | Surface project/task context through MJL screens |
| Native ECM/documents | Storage layer | Keep ECM as storage; expose documents through MJL checklists and previews |
| Native exports | Generic technical export module | Advanced-only; normal official outputs use MJL export center |
| Module setup/config | Technical setup | Admin/technical-only |

## Critical Business Workflows

The redesign must support these full journeys.

### Invitation And First Access

1. Admin sends invitation.
2. User receives invitation.
3. User opens invitation link.
4. User sets password.
5. User accesses role-appropriate workspace.
6. Invitation state becomes accepted.
7. Audit/history remains available.

Forbidden: public registration, sign-up wording, or unauthenticated account creation.

### Activity Lifecycle

1. Level 1 creates an activity.
2. Level 1 edits draft.
3. Level 1 submits activity.
4. Level 2 reviews.
5. Level 2 validates, rejects, or returns for correction.
6. If returned, Level 1 corrects and resubmits.
7. Timeline and audit history update.
8. Dashboard and alerts update.
9. No-self-validation remains enforced.

Activity status states currently used:

| Raw state | French label to use |
| --- | --- |
| `draft` / `0` | Brouillon |
| `ongoing` / `1` | En cours |
| `completed` / `2` | Terminee |
| `submitted` / `3` | Soumise |
| `correction_requested` / `4` | Correction demandee |
| `corrected` / `5` | Corrigee |
| `validated` / `6` | Validee |
| `rejected` / `8` | Rejetee |
| `cancelled` / `9` | Annulee |

Primary activity transitions:

```txt
Brouillon -> Soumise
Soumise -> Validee
Soumise -> Correction demandee
Soumise -> Rejetee
Correction demandee -> Corrigee
Corrigee -> Soumise
```

No-self-validation means a user must not validate, reject, or return their own submitted activity.

Expense status states currently used:

| Raw state | French label to use |
| --- | --- |
| `0` | Brouillon |
| `1` | Soumise |
| `2` | Validee |
| `3` | Corrigee |
| `8` | Rejetee |

Expense validation depends on supporting documents and budget integrity. Missing supporting documents are a blocking validation concern, not a decorative warning.

### Alerts

1. System detects risk: approaching deadline, overdue activity, pending validation, missing document.
2. Correct level sees the alert.
3. Alert states what happened, object affected, who should act, expected action, urgency, and destination.
4. User acts.
5. Alert disappears or changes state where applicable.

### Exports

1. Level 3/Admin opens export center.
2. User chooses report.
3. UI shows only supported filters.
4. Required scope is explicit.
5. Preview and CSV use the same filters.
6. CSV is Excel-readable and French-labeled.
7. Direct export URLs cannot bypass required filters.

## Design-System Rules To Preserve

- Every page must answer one dominant question.
- Status must appear before details.
- Validation should read as a timeline, not just buttons.
- Alerts must answer: problem, object, actor, expected action, urgency, destination.
- Exports must show: report name, scope, period, filters, format, filename, role restriction, generation action.
- Status and severity must never depend on color alone.
- Advanced Dolibarr complexity should be hidden, renamed, or moved to advanced access where safe.
- Empty states must guide action.
- Errors must explain what happened, what the user can do, and where to act.
- Mobile must not break, but desktop/laptop is the primary design target.

## Current Design Tokens And Component Needs

The design system should define or refine these token categories:

- primary colors;
- surface colors;
- text and muted text colors;
- semantic colors;
- status colors;
- alert severity colors;
- typography;
- spacing;
- border radius;
- borders;
- shadows;
- focus ring;
- table density;
- form density;
- email-safe equivalents.

Recommended token names:

```txt
--mjl-color-primary
--mjl-color-surface
--mjl-color-text
--mjl-color-muted
--mjl-color-border
--mjl-status-draft
--mjl-status-submitted
--mjl-status-returned
--mjl-status-validated
--mjl-status-rejected
--mjl-alert-info
--mjl-alert-warning
--mjl-alert-urgent
--mjl-alert-blocking
--mjl-space-1
--mjl-space-2
--mjl-space-3
--mjl-radius-card
--mjl-focus-ring
```

Priority components:

- MJL workspace shell;
- page header;
- role-aware navigation;
- dashboard card;
- KPI card;
- status badge;
- alert card;
- validation timeline;
- decision panel;
- activity summary card;
- project summary card;
- expense summary card;
- document checklist;
- export toolbar;
- filter bar;
- audit table;
- invitation status badge;
- auth form;
- empty state;
- error state;
- confirmation modal;
- email header;
- email CTA button;
- email footer.

Each component proposal should define:

- purpose;
- when to use it;
- when not to use it;
- layout;
- behavior;
- accessibility;
- French labels;
- role visibility;
- E2E coverage expectation.

## Content And Microcopy Rules

Use formal, clear, calm French administrative language.

Preferred labels:

```txt
Connexion
Mot de passe oublie
Reinitialiser le mot de passe
Invitation
Activite
Projet
Validation
Retourner pour correction
Rejeter
Valider
Soumettre
Exporter
Historique
Pieces justificatives
Tableau de bord
Alertes
```

Avoid or forbid:

```txt
Register
Sign up
Creer un compte
Third party
Customer
Supplier
ERP
Module technique
Object ID
Raw status
```

Button examples:

```txt
Soumettre l activite
Valider l activite
Retourner pour correction
Exporter les activites filtrees
Envoyer l invitation
Renvoyer l invitation
Revoquer l invitation
Reinitialiser le mot de passe
```

French formats:

```txt
26/06/2026
1 250 000 FCFA
```

Avoid ambiguous dates such as `06/26/2026`.

## Accessibility Requirements

The redesign must include accessibility criteria:

- keyboard navigation works;
- focus state is visible;
- status is never color-only;
- form labels are clear;
- errors appear near fields;
- tables remain readable;
- action buttons are keyboard reachable;
- modal focus is handled;
- 200% zoom remains usable;
- email layout remains readable;
- contrast is sufficient;
- alert severity is understandable without color.

## Official Outputs And Emails

Official outputs must feel like part of the product.

Exports:

- predictable;
- role-aware;
- Excel-readable;
- stable in filename;
- clear about filters;
- consistent with French labels.

Future PDF/print reports should include:

- title;
- project/activity reference;
- period;
- generated date;
- generated by;
- status;
- decision history if relevant;
- signature/validation block if needed;
- footer.

System emails should also follow MJL Clarity System:

- invitation email;
- password reset email;
- activity submitted;
- activity returned for correction;
- activity validated;
- activity rejected;
- approaching deadline;
- overdue activity;
- export ready if implemented.

Email tone example:

```txt
Une action est requise sur une activite liee a un projet a financement exterieur.
```

Avoid promotional or marketing urgency.

## What The Online Design Agent Should Produce

Produce a complete refonte proposal with these sections.

### 1. Product UX Diagnosis

Explain the current UX weaknesses and the target experience.

### 2. New Information Architecture

Define:

- top-level navigation;
- role-specific entry points;
- dashboard structure by role;
- page hierarchy;
- breadcrumbs;
- advanced/admin-only areas.

### 3. Complete Screen Redesign Specs

For every implemented or planned MJL screen, provide:

- screen purpose;
- primary user question;
- user levels;
- layout structure;
- main components;
- states;
- empty states;
- error states;
- French microcopy;
- actions;
- permissions and visibility notes;
- E2E acceptance criteria.

Include at minimum:

- workspace shell;
- DPAF dashboard;
- activities list/detail/create;
- validation queue;
- expenses list/detail/create/upload;
- alerts center;
- reports/export center;
- audit/history surfaces;
- invitation/admin access;
- auth pages;
- documents/checklists.

### 4. Component Catalog

Define the component system, including status, alerts, timeline, decision panels, tables, filters, official-output blocks, auth forms, and empty/error states.

### 5. Token System

Define color, typography, spacing, radius, border, shadow, focus, status, alert, table, form, and email-safe tokens.

### 6. French Content System

Define naming, labels, button text, error text, empty-state text, alert text, export text, and email text.

### 7. Accessibility And Responsive Rules

Define desktop-first layout rules, mobile fallback behavior, keyboard behavior, focus rules, contrast rules, and table responsiveness.

### 8. E2E Acceptance Matrix

For each redesigned area, define the minimum E2E tests that must pass.

### 9. Implementation Roadmap

Provide phased implementation order, dependencies, and risk notes. The roadmap must preserve:

- Dolibarr core boundaries;
- active-entity filtering;
- invitation-only access;
- no-self-validation;
- audit history;
- export guarantees.

## Output Format Requested From The Online Agent

Return the proposal as structured Markdown with:

- clear section headings;
- concise tables where useful;
- route names and user levels;
- French UI copy examples;
- no generic SaaS filler;
- no public-registration suggestions;
- no Dolibarr core-edit suggestions.

The proposal should be detailed enough that a coding agent can implement the redesign in phases without inventing product intent.

## Known Missing Inputs And Allowed Assumptions

The online agent will not receive screenshots unless they are provided separately. It should therefore produce a robust product/design-system proposal, not pixel-perfect visual QA of the current screens.

If brand assets are not provided, the agent may propose a sober institutional palette and typography system, but must mark it as a proposal rather than an existing official brand.

If final permissions are not provided, the agent must use only the temporary Level 1 / Level 2 / Level 3 / Admin model.

If a screen depends on native Dolibarr behavior, the agent must recommend a safe wrapper, theme, hook, configuration, or documentation step rather than assuming Dolibarr core can be edited.

## Definition Of Complete Enough

The online-agent output is complete only if it gives an implementer enough detail to redesign the interface without making product decisions. At minimum, it must include:

- a complete role-aware navigation proposal;
- dashboard layouts for Level 1, Level 2, Level 3, and Admin;
- activity and expense workflow layouts including timelines, decision panels, document state, and audit evidence;
- alert grouping/severity rules;
- export center layout and official-output rules;
- auth/invitation screens and secure wording;
- component catalog with usage rules;
- token system with semantic/status/alert/focus/table/form/email tokens;
- French microcopy examples for all critical actions and states;
- accessibility and responsive rules;
- E2E acceptance matrix;
- phased implementation roadmap with risks and safe-boundary notes.
