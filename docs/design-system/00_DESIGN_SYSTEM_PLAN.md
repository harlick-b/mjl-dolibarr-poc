# MJL Clarity System — Complete Revised Implementation Plan v3

## 1. Purpose

The MJL POC has already proven that Dolibarr can respond to the client’s needs.

The next step is to transform the POC into a user-friendly, ministry-oriented project-finance monitoring workspace.

The design system must help us:

- simplify the interface;
- hide useless Dolibarr complexity;
- make the app feel like a dedicated MJL workspace;
- make workflows understandable;
- make validations, alerts, exports, documents, and audit trails visible;
- define consistent authentication pages;
- define invitation-only access;
- apply the same visual and content system to emails;
- guide Codex with strict implementation rules;
- protect Dolibarr core files;
- validate complete user journeys with end-to-end tests.

The design system will be called:

# MJL Clarity System

Subtitle:

> Design system for a Dolibarr-based public-finance project monitoring workspace.

---

## 2. Product Direction

The application should feel like:

> A calm administrative control room for externally funded projects.

It should not feel like:

- a generic ERP;
- a raw Dolibarr installation;
- a complex accounting back office;
- a decorative SaaS dashboard;
- a technical tool made only for developers.

The app must feel:

- institutional;
- serious;
- sober;
- clear;
- modern enough;
- trustworthy;
- French-first;
- optimized for administrative users;
- designed around validation, traceability, and reporting.

---

## 3. Core Assumptions

We assume:

- The application remains based on Dolibarr.
- Dolibarr core files must not be modified.
- MJL-specific logic remains inside the custom module, mainly `custom/mjlfinancement`.
- Custom UI should use safe Dolibarr extension mechanisms only.
- First-year users are below 100.
- Main usage is desktop/laptop.
- Mobile must not be broken, but mobile is not the primary target.
- The interface language is French.
- User access is invitation-based.
- There is no public register page.
- Only Admin can send invitations for now.
- The design system applies to app screens, auth pages, and system emails.
- E2E tests are the main validation method.
- Micro/unit tests may exist only when useful, but must not replace full feature E2E tests.

---

## 4. Strategic Design Principles

## 4.1 Hide the ERP, reveal the mission

The user should not feel they are navigating a generic ERP.

The interface should prioritize:

- projects;
- activities;
- validations;
- alerts;
- documents;
- exports;
- dashboards;
- audit history;
- user access by invitation.

Generic Dolibarr elements should be hidden, renamed, or moved to advanced access where possible.

## 4.2 Progressive disclosure, not blind hiding

We should not hide everything aggressively.

Some Dolibarr features may still be useful for Admin, DPAF, or technical roles.

Use progressive disclosure:

- normal users see only useful MJL features;
- supervisors see monitoring and reporting features;
- Admin keeps access to technical and advanced areas.

## 4.3 Every page must have one dominant purpose

Each page should answer one main question.

Examples:

- Dashboard: “What needs my attention?”
- Validation queue: “What must I review?”
- Activity detail: “Can this activity move to the next step?”
- Alerts: “What is at risk?”
- Exports: “What report can I generate?”
- Audit: “What happened and who did it?”
- Invitations: “Who has access and who still needs activation?”

## 4.4 Status before details

Users must understand the status of an activity or project before reading details.

Each activity should clearly show:

- current status;
- current responsible level;
- next expected action;
- deadline or risk;
- validation progress;
- supporting document state.

## 4.5 Validation is a timeline, not just buttons

The validation workflow must be visible as a timeline.

Example:

1. Created by agent.
2. Submitted.
3. Reviewed by Level 2 / N+1.
4. Returned, rejected, or validated.
5. Reviewed by Level 2 / N+2 if applicable.
6. Final decision.
7. Audit history.

Buttons alone are not enough.

## 4.6 Alerts must be actionable

An alert must answer:

- What is the problem?
- What object is affected?
- Who should act?
- What action is expected?
- How urgent is it?
- Where should the user click?

## 4.7 Exports are first-class outputs

Exports are not secondary technical features.

Each export screen should clearly show:

- report name;
- data scope;
- period;
- filters;
- format;
- filename;
- role restrictions;
- generation action.

## 4.8 Emails are part of the product

System emails must follow the same design system as the app.

Email templates must be:

- clear;
- sober;
- French-first;
- action-oriented;
- recognizable;
- readable on mobile;
- consistent with the MJL Clarity System.

## 4.9 Auth is part of the experience

The product needs regular authentication pages:

- login;
- forgotten password;
- password reset;
- invitation acceptance;
- first password setup;
- expired invitation;
- invalid invitation;
- session expired;
- account disabled.

There is no register page.

## 4.10 E2E-first validation

The product should not be validated with micro tests only.

Tests should cover complete business journeys:

- Admin invites a user;
- user activates account;
- user logs in;
- user creates an activity;
- user submits activity;
- reviewer validates or returns;
- audit is updated;
- dashboard changes;
- export reflects the result.

---

## 5. Temporary Access Model

For now, the design system should use a temporary access model with **3 functional levels + Admin**.

A detailed permission matrix will be provided later.

This temporary model is only used to structure the UI, navigation, dashboard visibility, and E2E testing.

## 5.1 Level 1 — Operational User

Equivalent examples:

- agent;
- activity creator;
- basic project contributor.

Primary needs:

- access dashboard;
- create activity;
- edit own draft activity;
- resubmit returned activity;
- view own submitted activities;
- view relevant alerts;
- upload or view supporting documents;
- access own profile/account.

Should not see:

- advanced Dolibarr menus;
- global administration;
- invitation management;
- system settings;
- unrelated audit screens;
- full portfolio controls.

## 5.2 Level 2 — Reviewer / Validator

Equivalent examples:

- N+1;
- N+2;
- reviewer;
- hierarchical validator.

Primary needs:

- view validation queue;
- review submitted activities;
- validate;
- return for correction;
- reject if allowed;
- add decision comments;
- inspect supporting documents;
- view decision history;
- view alerts related to pending validations.

Should not see:

- Admin-only invitation management;
- technical Dolibarr settings;
- full system configuration.

Note:

- If the real workflow distinguishes N+1 and N+2, the UI may show them separately.
- For now, both belong to Level 2 until the final permissions matrix is defined.

## 5.3 Level 3 — Supervision / DPAF

Equivalent examples:

- DPAF;
- project-finance supervisor;
- global monitoring role.

Primary needs:

- global dashboard;
- portfolio overview;
- project/activity status;
- validation bottlenecks;
- deadline risks;
- alerts;
- exports;
- audit visibility;
- reporting shortcuts;
- advanced filters.

May access:

- some advanced MJL settings;
- deeper Dolibarr views if useful;
- supervision-level audit.

Should not manage technical configuration unless explicitly also Admin.

## 5.4 Admin

Admin is separate from the 3 functional levels.

Primary needs:

- user management;
- invitation sending;
- invitation revocation/resend;
- role assignment;
- account activation/suspension;
- technical configuration;
- module settings;
- advanced Dolibarr access if needed.

Admin can send invitations.

No other role can send invitations for now.

## 5.5 Future permission matrix placeholder

Later, this temporary model must be replaced or refined with a true permission matrix.

The future matrix should define:

- exact roles;
- menu visibility;
- page access;
- create/read/update/delete permissions;
- validation permissions;
- export permissions;
- audit visibility;
- invitation permissions;
- document permissions;
- advanced Dolibarr access.

Until then, Codex must not invent fine-grained permissions.

---

## 6. Information Architecture Proposal

Add a dedicated file:

```txt
MJL_INFORMATION_ARCHITECTURE.md
```

Purpose:

Define how the app is mentally organized.

The app should be structured around the user’s work, not Dolibarr’s internal object model.

Recommended primary areas:

1. Tableau de bord
2. Projets
3. Activités
4. Validations
5. Alertes
6. Documents
7. Exports
8. Historique / Audit
9. Administration

## 6.1 Page hierarchy

Recommended hierarchy:

```txt
Tableau de bord
  ├── Mes actions attendues
  ├── Alertes
  ├── Activités récentes
  └── Raccourcis d’export

Projets
  ├── Liste des projets
  ├── Détail projet
  ├── Activités du projet
  └── Documents du projet

Activités
  ├── Liste des activités
  ├── Créer une activité
  ├── Détail activité
  ├── Modifier brouillon
  └── Historique de décision

Validations
  ├── File d’attente
  ├── Détail à valider
  └── Décisions passées

Alertes
  ├── Toutes les alertes
  ├── Alertes urgentes
  └── Alertes résolues si applicable

Exports
  ├── Centre d’exports
  ├── Export activités
  ├── Export projets
  └── Export audit si autorisé

Administration
  ├── Utilisateurs
  ├── Invitations
  ├── Rôles
  └── Paramètres techniques
```

## 6.2 Breadcrumbs

Use breadcrumbs for deep pages.

Example:

```txt
Tableau de bord > Activités > Activité A-2026-014
```

Do not use breadcrumbs on simple auth pages.

## 6.3 Entry points by level

Level 1 lands on:

```txt
Tableau de bord personnel
```

Level 2 lands on:

```txt
File de validation
```

Level 3 lands on:

```txt
Tableau de bord global
```

Admin lands on:

```txt
Administration / Utilisateurs
```

unless also assigned to a functional role.

---

## 7. Content and Wording Proposal

Add a dedicated file:

```txt
MJL_CONTENT_GUIDELINES.md
```

Purpose:

Ensure French labels are consistent, administrative, and understandable.

## 7.1 Tone

The interface should be:

- formal;
- clear;
- direct;
- calm;
- non-technical;
- respectful.

Avoid:

- playful SaaS tone;
- vague success messages;
- unexplained technical errors;
- English labels;
- raw Dolibarr wording when it confuses MJL users.

## 7.2 Preferred labels

Use:

```txt
Connexion
Mot de passe oublié
Réinitialiser le mot de passe
Invitation
Activité
Projet
Validation
Retourner pour correction
Rejeter
Valider
Soumettre
Exporter
Historique
Pièces justificatives
Tableau de bord
Alertes
```

Avoid:

```txt
Register
Sign up
Créer un compte
Third party
Customer
Supplier
ERP
Module technique
Object ID
Raw status
```

## 7.3 Button wording

Buttons should use verbs.

Examples:

```txt
Soumettre l’activité
Valider l’activité
Retourner pour correction
Exporter les activités filtrées
Envoyer l’invitation
Renvoyer l’invitation
Révoquer l’invitation
Réinitialiser le mot de passe
```

Avoid vague buttons:

```txt
OK
Go
Submit
Action
Export
Process
```

## 7.4 Error messages

Error messages should explain:

- what happened;
- what the user can do;
- where to act.

Example:

```txt
La date de fin est obligatoire pour soumettre cette activité.
```

Instead of:

```txt
Invalid field.
```

## 7.5 Empty states

Empty states should guide action.

Example:

```txt
Aucune activité n’est en attente de validation pour le moment.
```

or:

```txt
Vous n’avez pas encore créé d’activité. Commencez par ajouter une nouvelle activité.
```

---

## 8. Security UX Proposal

Add a dedicated file:

```txt
MJL_SECURITY_UX.md
```

Purpose:

Define secure interface behavior for access, password, invitation, and account states.

## 8.1 No account enumeration

Forgotten password should not reveal whether an account exists.

Use neutral confirmation:

```txt
Si un compte correspond à cette adresse, un lien de réinitialisation sera envoyé.
```

Do not say:

```txt
Aucun compte trouvé.
```

## 8.2 Invitation security

Invitation links should support:

- expired state;
- invalid state;
- revoked state;
- already accepted state;
- resend by Admin;
- audit log.

Expired invitation message:

```txt
Cette invitation a expiré. Veuillez contacter l’administrateur pour recevoir une nouvelle invitation.
```

## 8.3 Password reset security

Password reset pages should support:

- invalid link;
- expired link;
- password rules;
- confirmation;
- return to login.

## 8.4 Session expired

Session expired message should be calm:

```txt
Votre session a expiré pour des raisons de sécurité. Veuillez vous reconnecter.
```

## 8.5 Account disabled

Account disabled message should not expose technical details:

```txt
Votre accès est désactivé. Veuillez contacter l’administrateur.
```

---

## 9. Dashboard and Data Visualization Proposal

Add a dedicated file:

```txt
MJL_DASHBOARD_AND_DATA_VIZ.md
```

Purpose:

Avoid decorative dashboards and define meaningful supervision views.

## 9.1 Dashboard philosophy

Dashboards should help users act.

They should not be decorative.

Every card, table, or chart should answer:

- What is happening?
- Is there a risk?
- What should be done?
- Where can I click?

## 9.2 KPI cards

KPI cards should be limited and useful.

Examples:

```txt
Activités en attente
Activités en retard
Projets à risque
Validations cette semaine
Exports disponibles
Invitations en attente
```

Each KPI should include:

- value;
- label;
- short context;
- link to details;
- status if relevant.

## 9.3 Charts

Charts should be used only when they clarify.

Prefer tables or cards when exact action matters.

Allowed charts:

- simple progress indicator;
- validation bottleneck by level;
- activity status distribution;
- deadline risk summary.

Avoid:

- decorative pie charts;
- unexplained percentages;
- multiple charts without actions;
- charts with no source or period.

## 9.4 DPAF dashboard

The DPAF dashboard should prioritize:

- global project status;
- activity status distribution;
- validation bottlenecks;
- deadline risks;
- overdue activities;
- export shortcuts;
- audit indicators;
- missing documents.

---

## 10. Official Outputs Proposal

Add a dedicated file:

```txt
MJL_OFFICIAL_OUTPUTS.md
```

Purpose:

Define how reports, exports, PDFs, and print views should look and behave.

## 10.1 Export principles

Exports must be:

- predictable;
- role-aware;
- Excel-readable;
- stable in filename;
- clear about filters;
- consistent with French labels.

## 10.2 Export UI

Each export page should show:

- report name;
- description;
- filters;
- period;
- format;
- scope;
- generated filename preview if possible.

Example:

```txt
Exporter les activités filtrées
Période : 01/01/2026 - 31/12/2026
Format : Excel compatible
```

## 10.3 Official report layout

If PDF or printable reports are added, they should include:

- title;
- project/activity reference;
- period;
- generated date;
- generated by;
- status;
- decision history if relevant;
- signature/validation block if needed;
- footer.

## 10.4 Date and number formats

Use French administrative formatting:

```txt
26/06/2026
1 250 000 FCFA
```

Avoid ambiguous dates:

```txt
06/26/2026
```

## 10.5 File naming

Use stable filenames.

Examples:

```txt
mjl_activites_2026-01-01_2026-12-31.csv
mjl_alertes_2026-06-26.csv
mjl_audit_activite_A-2026-014.csv
```

---

## 11. Design Governance Proposal

Add a dedicated file:

```txt
MJL_DESIGN_GOVERNANCE.md
```

Purpose:

Prevent design drift after multiple Codex iterations.

## 11.1 Rule of reuse

Codex must reuse existing patterns before creating new ones.

Do not invent a new component if an existing component covers the need.

## 11.2 Change process

Any design-system change should include:

- reason for change;
- affected files;
- affected screens;
- affected components;
- backward compatibility notes;
- E2E impact;
- accessibility impact.

## 11.3 Changelog

Maintain a simple changelog inside the design-system folder.

Example:

```txt
v0.1 — Initial design system
v0.2 — Added auth and email rules
v0.3 — Updated role visibility model
```

## 11.4 Deprecated patterns

If a pattern is replaced, mark it as deprecated.

Do not silently keep multiple competing patterns.

## 11.5 Codex compliance

Every Codex UI implementation must state:

- which design-system files were used;
- which components were applied;
- which rules were followed;
- which exceptions were made;
- why exceptions were necessary.

---

## 12. Authentication and Invitation Model

Add a dedicated file:

```txt
MJL_AUTH_AND_ACCESS.md
```

## 12.1 No public registration

There is no public registration page.

Forbidden:

```txt
Créer un compte
Inscription
Register
Sign up
```

Allowed:

```txt
Connexion
Mot de passe oublié
Définir mon mot de passe
Invitation
Accéder à mon espace
```

## 12.2 Invitation-only access

Access flow:

1. Admin creates or selects user.
2. Admin sends invitation.
3. User receives email.
4. User opens invitation link.
5. User defines password.
6. User accesses app.
7. Invitation status becomes accepted.
8. Audit records the lifecycle.

## 12.3 Invitation states

Supported states:

```txt
Invitation non envoyée
Invitation envoyée
Invitation acceptée
Invitation expirée
Invitation révoquée
Invitation renvoyée
Échec d’envoi
```

## 12.4 Account states

Supported states:

```txt
Invité
Actif
Suspendu
Désactivé
Réinitialisation demandée
```

## 12.5 Required auth pages

Design system must cover:

- login;
- invitation acceptance;
- first password setup;
- forgotten password;
- password reset;
- expired invitation;
- invalid invitation;
- session expired;
- account disabled.

---

## 13. Email System

Add a dedicated file:

```txt
MJL_EMAIL_SYSTEM.md
```

## 13.1 Email principles

Emails should be:

- short;
- formal;
- French-first;
- action-oriented;
- consistent with MJL Clarity System;
- readable on mobile;
- plain-text compatible.

## 13.2 Email types

Required templates:

- invitation email;
- password reset email;
- activity submitted;
- activity returned for correction;
- activity validated;
- activity rejected;
- approaching deadline;
- overdue activity;
- export ready if implemented.

## 13.3 Email structure

Recommended structure:

1. Header with MJL identity.
2. Clear title.
3. Short message.
4. Main action button.
5. Context details.
6. Security/support note.
7. Footer.

## 13.4 Email tone

Use:

```txt
Une action est requise sur une activité liée à un projet à financement extérieur.
```

Avoid:

```txt
Great news!
Click now!
Amazing!
Hurry!
```

## 13.5 Email audit

Important emails should be logged when possible:

- invitation sent;
- invitation accepted;
- reset requested;
- activity returned;
- activity validated;
- alert sent.

---

## 14. Components Strategy

Add a dedicated file:

```txt
MJL_COMPONENTS.md
```

Priority components:

- MJL workspace shell;
- page header;
- dashboard card;
- KPI card;
- status badge;
- alert card;
- validation timeline;
- decision panel;
- activity summary card;
- project summary card;
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

Each component must define:

- purpose;
- when to use;
- when not to use;
- layout;
- behavior;
- accessibility;
- French labels;
- role visibility;
- E2E coverage expectation.

---

## 15. Tokens Strategy

Add a dedicated file:

```txt
MJL_TOKENS.md
```

Tokens should define:

- primary colors;
- semantic colors;
- status colors;
- typography;
- spacing;
- border radius;
- borders;
- shadows;
- focus ring;
- table density;
- form density;
- email-safe equivalents.

Recommended token naming:

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

---

## 16. Accessibility Strategy

Add a dedicated file:

```txt
MJL_ACCESSIBILITY_CHECKLIST.md
```

Acceptance checks:

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

---

## 17. E2E Testing Strategy

Add a dedicated file:

```txt
MJL_E2E_TESTING_STRATEGY.md
```

## 17.1 Main rule

End-to-end tests are the primary validation method.

Micro/unit tests are allowed only when useful for business rules or security-critical logic, but they must not replace E2E feature tests.

## 17.2 Required E2E scenarios

### Scenario 1 — Invitation and first access

1. Admin logs in.
2. Admin sends invitation.
3. Invitation status becomes sent.
4. User opens invitation link.
5. User defines password.
6. User logs in.
7. Account becomes active.
8. Audit records lifecycle.

### Scenario 2 — Forgotten password

1. User opens forgotten password page.
2. User requests reset.
3. Neutral confirmation appears.
4. User opens reset link.
5. User sets new password.
6. User logs in.

### Scenario 3 — Activity lifecycle

1. Level 1 user logs in.
2. User creates activity.
3. User submits activity.
4. Level 2 reviewer sees it.
5. Reviewer validates or returns it.
6. If validated, next validation step appears.
7. Timeline updates.
8. Audit updates.
9. Dashboard updates.

### Scenario 4 — Return for correction

1. Activity is submitted.
2. Reviewer returns with comment.
3. Level 1 user sees returned activity.
4. User corrects it.
5. User resubmits.
6. Previous decision remains visible.

### Scenario 5 — Alerts

1. Seed approaching or overdue activity.
2. Correct level sees alert.
3. Alert links to object.
4. User acts on item.
5. Alert state updates if applicable.

### Scenario 6 — Export

1. User applies filters.
2. User exports.
3. Export respects filters.
4. File is Excel-readable.
5. Filename is stable.
6. Export is logged if applicable.

### Scenario 7 — Role visibility

1. Level 1 sees only operational workspace.
2. Level 2 sees validation workspace.
3. Level 3 sees supervision dashboard.
4. Admin sees user/invitation management.
5. Unauthorized pages are blocked.

---

## 18. Screen Inventory

Add a dedicated file:

```txt
MJL_SCREEN_INVENTORY_TEMPLATE.md
```

Before any UI implementation, Codex must create:

```txt
docs/design-system/audit/current-screen-inventory.md
```

Each screen must include:

- URL/path;
- current purpose;
- target purpose;
- current users;
- target access level;
- current problems;
- recommended action;
- redesign/hide/rename/keep/advanced-only decision;
- safe files to modify;
- implementation risk;
- affected E2E scenarios.

No UI source code should be modified before this inventory is reviewed.

---

## 19. Planned File Structure

After validation, generate these files:

```txt
docs/design-system/
  00_DESIGN_SYSTEM_PLAN.md
  DESIGN.md

  MJL_INFORMATION_ARCHITECTURE.md
  MJL_UI_RULES.md
  MJL_TEMPORARY_ACCESS_MODEL.md
  MJL_COMPONENTS.md
  MJL_TOKENS.md
  MJL_DASHBOARD_AND_DATA_VIZ.md
  MJL_CONTENT_GUIDELINES.md

  MJL_AUTH_AND_ACCESS.md
  MJL_SECURITY_UX.md
  MJL_EMAIL_SYSTEM.md
  MJL_OFFICIAL_OUTPUTS.md

  MJL_SCREEN_INVENTORY_TEMPLATE.md
  MJL_ACCESSIBILITY_CHECKLIST.md
  MJL_E2E_TESTING_STRATEGY.md
  MJL_DESIGN_GOVERNANCE.md

  CODEX_UI_IMPLEMENTATION_GUIDE.md
```

Note:

`MJL_TEMPORARY_ACCESS_MODEL.md` replaces the full role visibility matrix for now.

A true permissions matrix will be added later.

---

## 20. Implementation Phases

## Phase 0 — Add design-system docs only

Add the design-system files.

No source code changes.

## Phase 1 — Screen inventory

Codex creates:

```txt
docs/design-system/audit/current-screen-inventory.md
```

No source code changes.

## Phase 2 — UI audit

Codex audits current UI against MJL Clarity System.

Creates:

```txt
docs/design-system/audit/current-ui-audit.md
```

No source code changes.

## Phase 3 — Human validation

Human validates:

- screens to redesign;
- screens to hide;
- screens to rename;
- screens to keep;
- advanced-only screens;
- first implementation scope.

## Phase 4 — Auth and access UI

Implement or improve:

- login;
- forgotten password;
- password reset;
- invitation acceptance;
- expired invitation;
- invalid invitation;
- session expired;
- account disabled;
- no register page.

## Phase 5 — MJL workspace shell

Implement:

- MJL-first dashboard structure;
- role-aware navigation;
- page header;
- status system;
- workspace layout.

## Phase 6 — Level dashboards

Implement dashboards for:

- Level 1 Operational User;
- Level 2 Reviewer / Validator;
- Level 3 Supervision / DPAF;
- Admin.

## Phase 7 — Activity workflow UI

Implement:

- activity detail redesign;
- status badge;
- validation timeline;
- decision panel;
- document checklist;
- audit preview;
- role-aware actions.

## Phase 8 — Alerts and risks

Implement:

- alert list;
- alert cards;
- severity system;
- deadline risk UI;
- action links.

## Phase 9 — Tables and exports

Implement:

- standardized tables;
- filter bars;
- export toolbar;
- clear export context;
- stable filename preview if possible.

## Phase 10 — Email templates

Implement or document:

- invitation email;
- password reset email;
- activity workflow emails;
- alert emails.

## Phase 11 — E2E tests

Implement E2E tests for complete feature flows.

Micro tests cannot be the main validation.

## Phase 12 — Compliance report

Codex produces:

```txt
docs/design-system/audit/ui-compliance-report.md
```

Report includes:

- modified files;
- design-system rules applied;
- E2E results;
- accessibility checks;
- risks;
- known limitations;
- screenshots if possible.

---

## 21. Codex Execution Rules

Codex must:

1. Read all design-system files.
2. Respect Dolibarr core boundaries.
3. Keep MJL logic inside the custom module.
4. Create screen inventory before UI changes.
5. Produce UI audit before UI changes.
6. Use French labels.
7. Respect invitation-only access.
8. Never create a public register page.
9. Apply design system to emails.
10. Use E2E tests as primary validation.
11. Preserve business rules.
12. Preserve no-self-validation.
13. Preserve exports.
14. Preserve audit history.
15. Produce compliance reports.

Codex must not:

- modify Dolibarr core;
- redesign everything at once;
- hide screens without inventory;
- invent final permissions;
- create a register page;
- use micro tests as the main QA;
- break existing workflows;
- copy external design systems directly;
- introduce heavy UI frameworks without approval;
- use color as the only status indicator.

---

## 22. Recommended First Implementation Scope

After the design-system docs are added, the first execution should be:

1. screen inventory;
2. UI audit;
3. auth/access pages;
4. MJL workspace shell;
5. temporary level-based dashboards;
6. activity workflow UI.

Do not begin with exports, charts, or visual polish.

The first goal is clarity of access, navigation, and workflow.

---

## 23. Step-by-Step Guide to Use the Future MD Files

## Step 1 — Add files

Add all generated files under:

```txt
docs/design-system/
```

## Step 2 — Ask Codex to read only

Prompt:

```txt
Read all files under docs/design-system/. Do not modify source code. Summarize the design-system rules, safe implementation boundaries, temporary access model, and required implementation order.
```

## Step 3 — Ask Codex for screen inventory

Prompt:

```txt
Create the current MJL screen inventory using MJL_SCREEN_INVENTORY_TEMPLATE.md. Do not modify source code.
```

## Step 4 — Review inventory manually

Decide what to:

- redesign;
- hide;
- rename;
- keep;
- make advanced-only.

## Step 5 — Ask Codex for UI audit

Prompt:

```txt
Audit the current interface against the MJL Clarity System. Produce docs/design-system/audit/current-ui-audit.md. Do not modify source code.
```

## Step 6 — Implement one phase only

Example prompt:

```txt
Implement Phase 4 only: Auth and access UI. Preserve business logic. Do not modify Dolibarr core. Do not create a public register page. Add or update E2E tests for complete auth and invitation flows.
```

## Step 7 — Require compliance report

Prompt:

```txt
Produce a compliance report showing modified files, design-system rules applied, E2E tests run, accessibility checks, risks, and known limitations.
```

---

## 24. Approval Gate

This plan is ready to generate actual markdown files only after confirming:

1. Name: **MJL Clarity System**.
2. Temporary access model: 3 levels + Admin.
3. Full permissions matrix postponed.
4. No public register page.
5. Invitation-only access.
6. Admin-only invitation sending for now.
7. Auth pages included.
8. Emails included.
9. Official outputs included.
10. E2E-first testing accepted.
11. Screen inventory before UI changes.
12. UI audit before UI changes.
13. Dolibarr core modifications forbidden.
14. Desktop-first, responsive-safe design.
15. First implementation scope accepted.
