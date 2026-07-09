You are working inside the existing Dolibarr MJL repository.

Goal: resume and complete MJL client feature alignment after documentation cleanup and production-code foundation alignment.

This is a rebased continuation.

Do not restart the old POC-to-production refactor from scratch.

Do not blindly re-run old phases that are already implemented, verified, or marked as complete in the current documentation.

This task focuses on client-facing feature alignment:

- Partenaires / Programmes workspace;
- project execution view;
- activity physical execution tracking;
- funding envelopes;
- funds received;
- budget allocation and execution;
- expenses / décaissements;
- contextual timeline / exchanges;
- alerts;
- dashboards and KPI;
- CSV/XLSX reports aligned with client needs;
- UAT/demo documents and acceptance scenarios.

This is not production release closure.

Do not spend this task closing manual infrastructure blockers such as SMTP, final public URL, production secrets, backup/restore procedure, monitoring/log retention, or final hosting configuration. Keep those blockers visible in documentation, but do not make them the focus of this task.

---

# Current project state

Previous work produced this status:

```md
MOSTLY_ON_TRACK_WITH_GAPS
```

The code foundation is mostly aligned:

- syntax checks passed;
- schema audits passed;
- smoke checks passed;
- unresolved-scope audit passed;
- sample-data acceptance passed;
- readiness script exists;
- full E2E passed;
- production-code alignment is strong.

Remaining production-release blockers are manual/operational:

```md
production email transport
public/base URL
production secrets
backup/restore procedure
monitoring/log retention
final client-approved permission matrix
final client-approved report templates
```

Do not close those deployment blockers in this task.

This task resumes and completes business feature alignment with client needs.

---

# Mandatory reading before coding

Read these files first:

```md
docs/mjl-authoritative-decisions.md
docs/mjl-current-vs-target-gap-analysis.md
docs/mjl-implementation-summary.md
docs/mjl-post-cleanup-alignment-report.md
docs/mjl-stale-reference-audit.md
docs/mjl-current-app-functional-map.md
docs/mjl-docs-index.md
docs/mjl-deployment-checklist.md
```

Use this authority order:

```md
Current user instruction
docs/mjl-authoritative-decisions.md
Active implementation prompt/task
docs/mjl-current-vs-target-gap-analysis.md
docs/mjl-implementation-summary.md
docs/mjl-current-app-functional-map.md as current-state evidence only
Existing code
Older docs/prompts/POC notes
```

If older docs conflict with `docs/mjl-authoritative-decisions.md`, ignore the older docs.

If current code conflicts with `docs/mjl-authoritative-decisions.md`, treat the code as implementation debt and record it in `docs/mjl-current-vs-target-gap-analysis.md`.

---

# Final business decisions

These decisions are binding.

## Product stance

The MJL app is production-ready work.

Do not describe the target app as POC or MVP.

## User-facing terminology

Use:

```md
Partenaires / Programmes
```

Do not use:

```md
Bailleurs / Programmes
```

Do not use `Tiers` as normal user-facing wording except in technical Dolibarr documentation.

Dolibarr technical object remains `llx_societe`.

## Known Partenaires / Programmes

Test/seed data must include:

```md
UNICEF
Programme Redevabilité
```

## Role model

Use one global business role per user.

A user can be assigned to one or many Partenaires / Programmes.

A user does not have different roles per Partenaire / Programme for current production/test data.

Required roles:

```md
AGENT_SAISIE — Agent de saisie
AGENT_VERIFICATEUR — Agent vérificateur / prévalidateur
VALIDATEUR_DEFINITIF — Validateur définitif
ADMIN_PLATEFORME — Admin plateforme
```

Important distinction:

```md
ADMIN_PLATEFORME = technical/platform administration
VALIDATEUR_DEFINITIF = business validation
```

They are separate concepts, even if one person can have both powers.

## Scope model

Admin sees all Partenaires / Programmes.

A non-admin user can access only data connected to assigned Partenaires / Programmes.

Fail closed:

```md
If an object cannot resolve to a Partenaire / Programme, only Admin can access it until the data is fixed.
```

## Workflow

`Validé définitivement` and `Décaissé` are separate states.

Final validation means business approval.

Décaissement means money actually moved.

Mandatory rules:

```md
no self-validation
no self-prevalidation
no self-final-validation
no self-disbursement
```

Do not implement emergency override.

## Projects

Project creation and editing must be available inside the MJL workspace.

Only these roles can create/edit projects:

```md
ADMIN_PLATEFORME
VALIDATEUR_DEFINITIF
```

Normal MJL users must not need native Dolibarr project screens.

## Documents

Global Documents page remains read-only.

Uploads remain contextual.

Guarded downloads are mandatory.

Document uploads and downloads should be audited.

## Exchanges

Do not expose `Échanges` as a primary top-level menu item.

Use contextual timeline/exchanges inside object detail pages.

A global search/audit view may exist under Supervision/Audit only.

## Reports

Do not implement PDF or Word reports in this phase.

Use CSV/XLSX only.

CSV must remain:

```md
UTF-8 BOM
semicolon-separated
French headers
stable filenames
```

Every export should be audited.

---

# Hard rules

1. Do not modify Dolibarr core files.
2. Keep MJL-specific changes inside:
   - `custom/mjlfinancement`
   - `docs`
   - tests
   - scripts
   - module SQL/update files

3. Do not reintroduce POC/DPAF/N1/N2 as target concepts.
4. Preserve invitation-only access.
5. Do not add public registration.
6. Preserve guarded document downloads.
7. Preserve contextual document uploads.
8. Preserve read-only global Documents library.
9. Preserve no-self-validation rules.
10. Preserve the internal roadmap feature flag.
11. `roadmap.php` must remain hidden unless `MJL_SHOW_INTERNAL_ROADMAP=1`.
12. Add migrations/update scripts for schema changes.
13. Do not use destructive schema changes.
14. Every permission check must be server-side.
15. Navigation hiding is never sufficient.
16. Every business query touched in this task must be scoped by Partenaire / Programme unless the user is Admin.
17. All POST actions touched in this task must use CSRF protection.
18. All inputs touched in this task must be sanitized.
19. All file uploads and downloads must remain guarded.
20. Do not implement SMS, OCR, bank API, public partner portal, offline mode, PDF reports, or Word reports.
21. Do not claim production release readiness in this task.
22. Do not close manual infrastructure blockers unless they directly block feature acceptance.
23. Do not duplicate existing features. Improve and connect existing pages/classes/helpers where possible.
24. Do not create parallel concepts when existing MJL classes can be safely adapted.
25. Every changed PHP file must pass syntax checks.
26. Update docs after code changes.
27. Stop and report if a sub-phase introduces schema uncertainty, permission ambiguity, or failing tests that cannot be safely fixed.

---

# Critical execution model

This task must be executed in gated sub-phases.

Do not implement everything in one uncontrolled pass.

Each sub-phase must include:

```md
1. Brief plan
2. Files expected to change
3. Implementation
4. Validation
5. Gap-file update
6. Continue/stop decision
```

After each sub-phase, update:

```md
docs/mjl-current-vs-target-gap-analysis.md
docs/mjl-implementation-summary.md
```

Use these statuses:

```md
DONE
PARTIAL
CODE_LEGACY_DEBT
BLOCKED
UNKNOWN_REVIEW_REQUIRED
PENDING_CLIENT_VALIDATION
```

If a sub-phase introduces schema uncertainty, permission ambiguity, or failing tests that cannot be fixed safely, stop and report.

---

# Sub-phase 0 — Baseline and rebasing checkpoint

Before changing code:

1. Run:

```sh
git status
```

2. Read the mandatory docs.

3. Confirm which earlier foundations are already done, partial, or still debt:

```md
role helper alignment
Partenaires / Programmes scope enforcement
project create/edit wrapper
download audit
export audit
workflow alignment
production readiness script
sample-data acceptance
E2E tests
```

4. Inspect key files:

```md
custom/mjlfinancement/lib/mjl_scope.lib.php
custom/mjlfinancement/lib/mjl_workspace.lib.php
custom/mjlfinancement/lib/mjl_navigation.lib.php
custom/mjlfinancement/lib/mjl_dashboard.lib.php
custom/mjlfinancement/lib/mjl_alerts.lib.php
custom/mjlfinancement/lib/mjl_document.lib.php
custom/mjlfinancement/lib/mjl_reporting.lib.php
custom/mjlfinancement/lib/mjl_csv_export.lib.php
custom/mjlfinancement/lib/mjl_xlsx_export.lib.php
custom/mjlfinancement/lib/mjl_timeline.lib.php
custom/mjlfinancement/admin/access.php
custom/mjlfinancement/partners.php
custom/mjlfinancement/projects.php
custom/mjlfinancement/activities.php
custom/mjlfinancement/expenses.php
custom/mjlfinancement/conventions.php
custom/mjlfinancement/budgetlines.php
custom/mjlfinancement/fundreceipts.php
custom/mjlfinancement/documents.php
custom/mjlfinancement/reports.php
custom/mjlfinancement/alerts.php
custom/mjlfinancement/workflowactions.php
custom/mjlfinancement/exchangelogs.php
custom/mjlfinancement/class/_.class.php
custom/mjlfinancement/sql/_.sql
custom/mjlfinancement/scripts/_
custom/mjlfinancement/sample_data/seed/_
```

5. Run baseline validation:

```sh
git diff --check
find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l
```

6. Run available tests only if commands exist:

```sh
composer test
vendor/bin/phpunit
npm test
npm run test
npm run e2e
```

7. Record baseline result in:

```md
docs/mjl-implementation-summary.md
```

Do not continue if baseline syntax is failing due to unrelated issues unless those issues are documented and clearly unrelated.

---

# Sub-phase 5R — Rebased Partenaires / Programmes workspace

Goal: make `Partenaires / Programmes` a real client-facing workspace, not only a technical scope concept.

Target file:

```php
custom/mjlfinancement/partners.php
```

Create or improve this page.

## Required list view

The list view must show accessible Partenaires / Programmes.

For each Partenaire / Programme, show:

```md
Nom
Nombre de projets
Financement total reçu
Budget alloué
Budget non alloué
Montant validé définitivement
Montant décaissé
Solde disponible
Taux d’exécution financière
Taux de validation financière
Taux d’exécution physique
Activités en cours
Activités en retard
Dépenses à vérifier / prévalider
Dépenses à valider définitivement
Dépenses validées non décaissées
Justificatifs manquants
Dernière activité / décision
```

Access rules:

```md
Admin sees all.
Validateur définitif sees assigned Partenaires / Programmes unless Admin.
Agent vérificateur sees assigned Partenaires / Programmes.
Agent de saisie sees assigned Partenaires / Programmes.
Unresolved Partenaire / Programme relation fails closed for non-admin.
```

## Required detail view

The detail view must show:

```md
identity block
key KPI cards
related projects
funding envelopes
funds received
budget allocations
activities
expenses / décaissements
documents
alerts
contextual timeline
assigned users for Admin only
```

Do not fully replace Dolibarr third-party management.

Use Dolibarr `Societe` / `llx_societe` as the source of partner identity.

Admin may have a safe link to native Dolibarr third-party admin if already allowed.

Normal MJL users must remain inside MJL workspace.

## KPI formulas

Use these formulas consistently:

```md
Total financements reçus =
sum of received fund receipts or active funding envelopes, depending available data
```

```md
Budget alloué =
sum of budget lines allocated to the Partenaire / Programme
```

```md
Budget non alloué =
funding total - allocated budget
```

```md
Montant validé définitivement =
sum of expenses in VALIDE_DEFINITIVEMENT and DECAISSE where applicable
```

```md
Montant décaissé =
sum of expenses in DECAISSE
```

```md
Taux d’exécution financière =
Montant décaissé / Budget alloué
```

```md
Taux de validation financière =
Montant validé définitivement / Budget alloué
```

```md
Taux d’exécution physique =
average physical execution percentage of activities in scope
```

If some data is missing or transitional, show safe zero values or `Non disponible` instead of breaking the page, and document the limitation.

## Validation after Sub-phase 5R

Run:

```sh
git diff --check
find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l
```

Run or add an acceptance check verifying:

```md
UNICEF user sees UNICEF only.
Programme Redevabilité user sees Programme Redevabilité only.
Admin sees both.
Partner detail shows projects, funding, activities, expenses, documents, timeline.
Partner KPIs do not leak cross-partner data.
```

Update:

```md
docs/mjl-current-vs-target-gap-analysis.md
docs/mjl-implementation-summary.md
```

---

# Sub-phase 6R — Project and activity execution alignment

Goal: make projects and activities reflect the client need to track physical execution.

Target files likely include:

```md
custom/mjlfinancement/projects.php
custom/mjlfinancement/activities.php
custom/mjlfinancement/class/mjlactivity.class.php
custom/mjlfinancement/lib/mjl_dashboard.lib.php
custom/mjlfinancement/lib/mjl_reporting.lib.php
custom/mjlfinancement/sql/\*
```

## Project detail alignment

Project detail must show:

```md
Partenaire / Programme
project identity
funding envelope summary
budget allocation
physical execution KPI
financial execution KPI
activities summary
expenses / décaissements summary
documents
alerts
contextual timeline
```

Project create/edit must already exist or be implemented safely:

```md
Admin plateforme and Validateur définitif can create/edit.
Agent de saisie cannot create/edit.
Agent vérificateur cannot create/edit unless also Validateur/Admin.
Every project must resolve to a Partenaire / Programme.
Project creation/update is audited.
```

## Activity physical execution fields

Add or verify activity fields:

```md
date_debut_prevue
date_fin_prevue
date_debut_reelle
date_fin_reelle
taux_execution_physique
statut_execution
commentaire_execution
responsable
```

If existing field names differ, reuse existing fields and add mapping helpers.

Do not destructively rename existing columns without migration/backward compatibility.

Execution statuses:

```md
PLANIFIEE — Planifiée
EN_COURS — En cours
EXECUTEE — Exécutée
PARTIELLEMENT_EXECUTEE — Partiellement exécutée
NON_EXECUTEE — Non exécutée
ANNULEE — Annulée
EN_RETARD — En retard
```

Validation rules:

```md
Physical execution percentage must be between 0 and 100.
An activity marked EXECUTEE should have 100% execution or require explicit justification.
An activity marked NON_EXECUTEE should have 0% execution or require explicit justification.
An activity with past planned end date and not executed should be shown as late or flagged.
```

## Activity workflow alignment

Verify or implement:

```md
BROUILLON
SOUMIS
A_CORRIGER
CORRIGE
PREVALIDE
INVALIDE
VALIDE_DEFINITIVEMENT
REJETE
ANNULE
CLOTURE
```

Actions:

```md
Agent de saisie:

- create
- edit draft
- submit
- correct
- upload document
- update execution progress when allowed

Agent vérificateur / prévalidateur:

- request correction
- invalidate
- prevalidate

Validateur définitif:

- final validate
- reject
- request correction
- close
- cancel
```

Rules:

```md
No self-prevalidation.
No self-final-validation.
Every decision is audited.
Every status change stores actor, role, previous status, new status, date, and comment/reason.
```

## Validation after Sub-phase 6R

Run syntax checks.

Run or add acceptance checks:

```md
Activity physical execution can be updated.
Invalid percentage is rejected.
Project physical execution KPI changes.
Partner physical execution KPI changes.
Dashboard physical execution KPI changes.
Late activity appears in alerts.
No self-prevalidation/final-validation.
```

Update docs.

---

# Sub-phase 7R — Funding, budget, and décaissement execution model

Goal: align financing objects with the client’s need to trace money from partner funding to project/activity spending and décaissement.

Target files likely include:

```md
custom/mjlfinancement/conventions.php
custom/mjlfinancement/budgetlines.php
custom/mjlfinancement/fundreceipts.php
custom/mjlfinancement/expenses.php
custom/mjlfinancement/class/mjlconvention.class.php
custom/mjlfinancement/class/mjlbudgetline.class.php
custom/mjlfinancement/class/mjlfundreceipt.class.php
custom/mjlfinancement/class/mjlexpense.class.php
custom/mjlfinancement/lib/mjl_dashboard.lib.php
custom/mjlfinancement/lib/mjl_reporting.lib.php
custom/mjlfinancement/sql/\*
```

## Enveloppes de financement

User-facing label:

```md
Enveloppes de financement
```

Old technical class may remain `MjlConvention`.

Required behavior:

```md
belongs to one Partenaire / Programme
may be global to the Partenaire / Programme
may be linked to one project
can be allocated through budget lines
supports documents
has audit history
```

Fields:

```md
Partenaire / Programme
Référence
Titre
Montant
Devise
Date début
Date fin
Statut
Projet optionnel
Document justificatif
```

## Fonds reçus

Required behavior:

```md
linked to Partenaire / Programme
linked to Enveloppe de financement when possible
optional project link
amount
receipt date
supporting document
status
audit history
```

## Budgets

Budget line can be linked to:

```md
Partenaire / Programme
project
activity
funding envelope
```

Required calculated values:

```md
Montant alloué
Montant soumis
Montant prévalidé
Montant validé définitivement
Montant décaissé
Reste disponible
Taux de validation financière
Taux d’exécution financière
```

Budget rules:

```md
SOUMIS does not consume final budget.
PREVALIDE is tracked separately.
VALIDE_DEFINITIVEMENT consumes/commits validated budget.
DECAISSE represents actual money movement.
DECAISSE cannot exceed validated amount.
Final validation cannot exceed available budget.
Disbursement cannot exceed available validated amount.
```

## Expenses / Décaissements

Required fields or mapped fields:

```md
Partenaire / Programme
Projet
Activité optionnelle
Enveloppe de financement optionnelle
Budget
Montant demandé
Montant prévalidé
Montant validé définitivement
Montant décaissé
Date de dépense
Date de décaissement
Bénéficiaire / destinataire optionnel
Description
Justificatif
Statut
Créé par
Prévalidé par
Validé définitivement par
Décaissé par
Commentaires de décision
```

Workflow statuses:

```md
BROUILLON
SOUMIS
A_CORRIGER
CORRIGE
PREVALIDE
INVALIDE
VALIDE_DEFINITIVEMENT
DECAISSE
REJETE
ANNULE
```

Rules:

```md
No self-prevalidation.
No self-final-validation.
No self-disbursement.
Justificatif is required before final validation.
DECAISSE cannot happen before VALIDE_DEFINITIVEMENT.
Insufficient budget blocks final validation or disbursement.
Every decision is audited.
```

## Validation after Sub-phase 7R

Run syntax checks.

Run or add acceptance checks:

```md
Funding envelope can be global to partner or linked to project.
Budget line can show allocated/submitted/prevalidated/final validated/disbursed/remaining.
Expense can be prevalidated, final validated, and disbursed in correct order.
Missing justificatif blocks final validation.
Insufficient budget blocks final validation/disbursement.
Partner and project financial KPIs update correctly.
```

Update docs.

---

# Sub-phase 8R — Contextual timeline, comments, and exchange alignment

Goal: implement or complete contextual timeline behavior without turning `Échanges` into a primary module.

Target files likely include:

```md
custom/mjlfinancement/lib/mjl_timeline.lib.php
custom/mjlfinancement/lib/mjl_exchange.lib.php
custom/mjlfinancement/exchangelogs.php
custom/mjlfinancement/class/mjlexchangelog.class.php
custom/mjlfinancement/projects.php
custom/mjlfinancement/partners.php
custom/mjlfinancement/activities.php
custom/mjlfinancement/expenses.php
custom/mjlfinancement/conventions.php
custom/mjlfinancement/budgetlines.php
custom/mjlfinancement/fundreceipts.php
```

## Required behavior

Do not expose `Échanges` as a primary menu item.

Create or improve a reusable timeline helper that can display:

```md
manual comments
workflow decisions
correction requests
prevalidations
final validations
rejections
status changes
document uploads
document downloads
export events when object-specific
project notes
```

Timeline must be visible on:

```md
Partenaire / Programme detail
Project detail
Activity detail
Expense / Décaissement detail
Funding envelope detail
Budget line detail if useful
Fund receipt detail if useful
```

Supported object types:

```md
societe
project
mjlfinancement_activity
mjlfinancement_expense
mjlfinancement_convention
mjlfinancement_budget_line
mjlfinancement_fund_receipt
```

Rules:

```md
comments are append-only for production v1
no edit/delete unless Admin and audited
every entry stores user, role, date, object type, object ID, Partenaire / Programme if resolvable, type/channel, subject, message
all timeline queries enforce scope
global search remains under Supervision/Audit only
```

If full timeline integration on every object is too risky, implement the helper and integrate at least:

```md
Partenaire / Programme detail
Project detail
Activity detail
Expense / Décaissement detail
```

Then record remaining object integrations in the gap file.

## Validation after Sub-phase 8R

Run syntax checks.

Run or add checks:

```md
Agent can add contextual comment on accessible object.
User cannot see timeline entries outside assigned Partenaire / Programme.
Workflow decisions appear in timeline.
Document upload/download events appear when audited.
Échanges is not a primary menu item.
Global exchange/audit remains under Supervision/Audit only.
```

Update docs.

---

# Sub-phase 9R — Alerts alignment

Goal: make alerts reflect the client’s operational risks.

Target files:

```md
custom/mjlfinancement/alerts.php
custom/mjlfinancement/lib/mjl_alerts.lib.php
custom/mjlfinancement/index.php
custom/mjlfinancement/partners.php
custom/mjlfinancement/projects.php
```

Keep alerts computed live unless a persistent alert table already exists and is safe.

Required alerts:

```md
activity approaching planned end date
activity overdue
activity submitted waiting for prevalidation
activity prevalidated waiting for final validation
activity returned for correction
activity low/stale physical execution
expense submitted waiting for prevalidation
expense prevalidated waiting for final validation
expense returned for correction
expense missing justificatif
expense exceeding available budget
expense validated but not disbursed
budget nearly consumed
funding envelope near end date
```

Default thresholds:

```md
Deadline soon: 7 days
Budget warning: 80% consumed
Budget critical: 95% consumed
Stale execution update: no update for 14 days on active activity
```

Rules:

```md
all alerts are scoped by Partenaire / Programme
Admin sees all
non-admin sees assigned scope only
alerts should link to the relevant object detail page
alerts should appear on relevant dashboards
```

## Validation after Sub-phase 9R

Run syntax checks.

Run or add checks:

```md
Overdue activity generates alert.
Submitted/prevalidated queues generate alert.
Expense missing justificatif generates alert.
Validated-not-disbursed expense generates alert.
Budget warning/critical alert appears.
Scoped users do not see other partner alerts.
```

Update docs.

---

# Sub-phase 10R — Dashboards and KPI alignment

Goal: make dashboards tell the client what is happening in real time.

Target files:

```md
custom/mjlfinancement/index.php
custom/mjlfinancement/dpafdashboard.php or equivalent global dashboard
custom/mjlfinancement/lib/mjl_dashboard.lib.php
custom/mjlfinancement/lib/mjl_navigation.lib.php
custom/mjlfinancement/partners.php
custom/mjlfinancement/projects.php
```

Update dashboards around roles and Partenaires / Programmes.

## Agent de saisie dashboard

Show:

```md
Mes activités
Mes dépenses / décaissements
À corriger
Justificatifs manquants
Échéances proches
Dernières décisions
```

## Agent vérificateur / prévalidateur dashboard

Show:

```md
Activités à vérifier / prévalider
Dépenses à vérifier / prévalider
Justificatifs manquants
Retours / invalidations
Activités en retard
Alertes budget
```

## Validateur définitif dashboard

Show:

```md
Vue globale ou filtrée par Partenaire / Programme
File de validation définitive
Financements reçus
Budget alloué
Budget non alloué
Dépenses soumises
Dépenses prévalidées
Dépenses validées définitivement
Montant décaissé
Solde disponible
Taux d’exécution financière
Taux de validation financière
Taux d’exécution physique
Activités planifiées
Activités exécutées
Activités en retard
Éléments à corriger
Justificatifs manquants
Décisions récentes
Échanges récents
```

## Admin dashboard

Show:

```md
All Validateur définitif indicators
Utilisateurs actifs
Invitations en attente
Partenaires / Programmes configurés
Données non résolues / sans Partenaire
Erreurs de configuration production
```

Required filters:

```md
Tous les Partenaires / Programmes
Un Partenaire / Programme
Un projet
Période
Statut
```

KPI formulas:

```md
Taux d’exécution physique =
average physical execution percentage of activities in selected scope
```

```md
Taux d’exécution financière =
total disbursed amount / allocated budget
```

```md
Taux de validation financière =
total definitively validated amount / allocated budget
```

Rules:

```md
All dashboard queries must enforce Partenaire / Programme scope.
Admin sees all.
Dashboards must not leak unassigned data.
No chart is required unless already supported; cards/tables are enough.
```

## Validation after Sub-phase 10R

Run syntax checks.

Run or add checks:

```md
Agent sees own/scoped queues.
Prévalidateur sees review queues.
Validateur sees final validation and execution KPIs.
Admin sees global and unresolved-data indicators.
Partner/project filters affect KPI values.
No cross-partner leakage.
```

Update docs.

---

# Sub-phase 11R — Reports and exports aligned with client use

Goal: make CSV/XLSX reports useful for client monitoring.

Target files:

```md
custom/mjlfinancement/reports.php
custom/mjlfinancement/lib/mjl_reporting.lib.php
custom/mjlfinancement/lib/mjl_csv_export.lib.php
custom/mjlfinancement/lib/mjl_xlsx_export.lib.php
```

Do not implement PDF or Word reports.

Required reports:

```md
Financements reçus par Partenaire / Programme
Allocation budgétaire par Partenaire / Programme
Allocation budgétaire par projet
Exécution financière par Partenaire / Programme
Exécution financière par projet
Exécution physique par projet
Suivi des activités
Suivi des dépenses / décaissements
Dépenses avec justificatifs
Dépenses validées non décaissées
Prévalidations en attente
Validations définitives en attente
Corrections / invalidations / rejets
Historique des décisions
Historique des échanges / commentaires
Audit général
```

Every report must:

```md
require permission
enforce Partenaire / Programme scope
support useful filters
use French headers
export CSV and XLSX
keep CSV Excel-readable
use stable filenames
audit export generation
avoid leaking unassigned scope
```

Useful filters:

```md
Partenaire / Programme
Projet
Période
Statut
Type de workflow/action
Utilisateur
Budget line / envelope when relevant
```

Required columns should be client-readable, not technical-only.

## Suivi des activités

```md
Partenaire / Programme
Projet
Référence activité
Intitulé
Responsable
Statut workflow
Statut d’exécution
Date début prévue
Date fin prévue
Date début réelle
Date fin réelle
Taux d’exécution physique
Budget associé
Montant validé
Montant décaissé
Dernière décision
```

## Suivi des dépenses / décaissements

```md
Partenaire / Programme
Projet
Activité
Budget
Référence dépense
Description
Montant demandé
Montant prévalidé
Montant validé définitivement
Montant décaissé
Statut
Date dépense
Date décaissement
Justificatif présent
Créé par
Prévalidé par
Validé définitivement par
Décaissé par
Dernière décision
```

## Exécution financière

```md
Partenaire / Programme
Projet
Budget alloué
Montant soumis
Montant prévalidé
Montant validé définitivement
Montant décaissé
Solde disponible
Taux de validation financière
Taux d’exécution financière
```

## Exécution physique

```md
Partenaire / Programme
Projet
Activités planifiées
Activités en cours
Activités exécutées
Activités en retard
Taux d’exécution physique moyen
```

## Validation after Sub-phase 11R

Run syntax checks.

Run or add checks:

```md
CSV has UTF-8 BOM.
CSV uses semicolon separator.
Headers are French.
XLSX export works.
Exports respect scope.
Unauthorized user cannot export.
Export audit is created.
Report filenames are stable and include scope/filter context where practical.
```

Update docs.

---

# Sub-phase 12R — Client UAT pack and feature acceptance

Goal: prepare the app for client-facing validation.

Do not add new features here unless needed to fix acceptance blockers.

Create or update:

```md
docs/mjl-client-uat-checklist.md
docs/mjl-client-demo-scenario.md
docs/mjl-roles-permissions-matrix.md
docs/mjl-reports-exports-model.md
docs/mjl-dashboard-kpi-model.md
docs/mjl-implementation-summary.md
```

## UAT checklist must cover

```md
Login and invitation
User scope by Partenaire / Programme
Project creation by Admin / Validateur définitif
Funding envelope creation
Fund receipt recording
Budget allocation
Activity creation
Activity prevalidation
Activity final validation
Physical execution update
Expense creation
Justificatif upload
Expense prevalidation
Expense final validation
Décaissement
Documents library
Guarded download
Timeline / decisions
Alerts
Dashboard
Reports / exports
Audit
```

For each UAT item, include:

```md
Role
Action
Expected result
Pass/Fail
Comment
```

## Demo scenario

Create one complete scenario:

```md
UNICEF gives funding
→ MJL records funding envelope
→ MJL records fund receipt
→ MJL creates project
→ MJL allocates budget
→ Agent creates activity
→ Agent submits activity
→ Agent vérificateur prevalidates
→ Validateur définitif validates
→ Agent updates physical execution
→ Agent creates expense with justificatif
→ Agent submits expense
→ Agent vérificateur prevalidates
→ Validateur définitif validates
→ Validateur définitif marks as décaissé
→ Dashboard updates
→ Reports export
→ Timeline/audit proves traceability
```

Also create one Programme Redevabilité scope-isolation scenario.

## Validation after Sub-phase 12R

Run syntax checks.

Run all available acceptance/E2E/smoke checks.

Update implementation summary and gap analysis.

---

# Final validation

At the end, run:

```sh
git diff --check
find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l
```

Run available tests only if commands exist:

```sh
composer test
vendor/bin/phpunit
npm test
npm run test
npm run e2e
```

Run available custom scripts under:

```md
custom/mjlfinancement/scripts
```

Run stale-term check:

```sh
grep -RIn "SUPERVISEUR_N1\|SUPERVISEUR_N2\|DPAF\|N1\|N2\|MJL POC\|MVP\|Bailleurs / Programmes\|role per Tiers\|role-per-Tiers" \
  custom/mjlfinancement docs AGENTS.md README.md 2>/dev/null || true
```

Remaining results must be classified in:

```md
docs/mjl-stale-reference-audit.md
```

Do not require zero stale terms if remaining terms are legacy/migration/current-state/code-debt only.

---

# Final documentation update

Update:

```md
docs/mjl-current-vs-target-gap-analysis.md
docs/mjl-implementation-summary.md
docs/mjl-stale-reference-audit.md
docs/mjl-post-cleanup-alignment-report.md
docs/mjl-target-client-spec.md
docs/mjl-dashboard-kpi-model.md
docs/mjl-reports-exports-model.md
docs/mjl-client-uat-checklist.md
docs/mjl-client-demo-scenario.md
```

Do not claim production release readiness.

If production blockers remain, keep them visible:

```md
production email transport
public/base URL
production secrets
backup/restore procedure
monitoring/log retention
final client-approved permission matrix
final client-approved report templates
```

If feature alignment is complete but client approval is pending, mark it as:

```md
FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION
```

Use evidence-based statuses:

```md
DONE
PARTIAL
CODE_LEGACY_DEBT
BLOCKED
UNKNOWN_REVIEW_REQUIRED
PENDING_CLIENT_VALIDATION
```

---

# Final Codex response required

When complete, reply with:

1. Final verdict:
   - FEATURE_ALIGNED
   - FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION
   - MOSTLY_ALIGNED_WITH_GAPS
   - NOT_ALIGNED

2. Sub-phases completed.
3. Sub-phases skipped or stopped and why.
4. Summary of what changed.
5. Files changed.
6. Schema/migration changes, if any.
7. Partenaires / Programmes workspace behavior.
8. Project/activity execution behavior.
9. Funding/budget behavior.
10. Expense/décaissement behavior.
11. Timeline/exchange behavior.
12. Alerts behavior.
13. Dashboard/KPI behavior.
14. Reports/export behavior.
15. UAT/demo documents created or updated.
16. Tests run and results.
17. Remaining client-feature gaps.
18. Remaining production-release blockers.
19. Remaining stale references and classification.
20. Manual deployment/migration steps.
21. Confirmation that Dolibarr core files were not modified.

Do not claim `FEATURE_ALIGNED` unless:

```md
Partenaires / Programmes workspace is usable.
Project/activity execution tracking is implemented or verified.
Physical execution rate is implemented or verified.
Funding/budget execution KPIs are implemented or verified.
Expense/décaissement flow is implemented or verified.
Contextual timeline is available on key detail pages.
Alerts reflect operational risks.
Dashboards show role-appropriate KPIs.
CSV/XLSX reports cover client monitoring needs.
Scope isolation is verified.
Acceptance tests or UAT checks exist.
Remaining client decisions are clearly marked.
```

If implementation is technically strong but client validation is still pending, use:

```md
FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION
```

Do not claim production release readiness in this task.
