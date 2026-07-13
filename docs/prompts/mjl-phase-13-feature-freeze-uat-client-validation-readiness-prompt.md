You are working inside the existing Dolibarr MJL repository.

Goal: execute Phase 13 — Feature Freeze, Internal UAT, and Client Validation Readiness.

This phase happens after client feature alignment.

This is not a new feature phase.

This is not production release closure.

This is not deployment.

This phase must prove, with evidence, whether the MJL app is ready for structured client validation.

The final question to answer is:

```md
Can we safely present this app to the client for workflow, permissions, dashboard, report, and business validation?
```

---

# Current context

Previous work should have completed:

* documentation cleanup;
* production-code foundation alignment;
* client feature alignment through 12R;
* Partenaires / Programmes workspace;
* project/activity execution alignment;
* funding, budget, and décaissement alignment;
* contextual timeline/exchanges;
* alerts;
* dashboards/KPIs;
* CSV/XLSX reports;
* UAT/demo documentation.

Expected status before Phase 13 is one of:

```md
FEATURE_ALIGNED
FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION
MOSTLY_ALIGNED_WITH_GAPS
```

If the current repo is `NOT_ALIGNED`, stop and report before starting Phase 13.

---

# Mandatory reading before doing anything

Read these files first:

```md
docs/mjl-authoritative-decisions.md
docs/mjl-current-vs-target-gap-analysis.md
docs/mjl-implementation-summary.md
docs/mjl-post-cleanup-alignment-report.md
docs/mjl-stale-reference-audit.md
docs/mjl-current-app-functional-map.md
docs/mjl-docs-index.md
docs/mjl-client-uat-checklist.md
docs/mjl-client-demo-scenario.md
docs/mjl-dashboard-kpi-model.md
docs/mjl-reports-exports-model.md
docs/mjl-roles-permissions-matrix.md
docs/mjl-deployment-checklist.md
```

Some files may not exist yet. If a file is missing:

* record it as a Phase 13 gap;
* create it only if it belongs to UAT/client validation;
* do not recreate old noisy planning docs.

Use this authority order:

```md
Current user instruction
docs/mjl-authoritative-decisions.md
Active Phase 13 task
docs/mjl-current-vs-target-gap-analysis.md
docs/mjl-implementation-summary.md
docs/mjl-current-app-functional-map.md as current-state evidence only
Existing code
Older docs/prompts/POC notes
```

If older docs conflict with `docs/mjl-authoritative-decisions.md`, ignore the older docs.

If current code conflicts with `docs/mjl-authoritative-decisions.md`, treat the code as implementation debt and record it in `docs/mjl-current-vs-target-gap-analysis.md`.

---

# Binding business decisions

## Product stance

The MJL app is production-ready work.

Do not describe the target product as POC or MVP.

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

## Known Partenaires / Programmes

Validation scenarios must include:

```md
UNICEF
Programme Redevabilité
```

## Role model

Use one global business role per user.

A user can be assigned to one or many Partenaires / Programmes.

A user does not have different roles per Partenaire / Programme for current production/test data.

Roles:

```md
AGENT_SAISIE — Agent de saisie
AGENT_VERIFICATEUR — Agent vérificateur / prévalidateur
VALIDATEUR_DEFINITIF — Validateur définitif
ADMIN_PLATEFORME — Admin plateforme
```

`ADMIN_PLATEFORME` and `VALIDATEUR_DEFINITIF` are separate concepts.

## Workflow

`Validé définitivement` and `Décaissé` are separate states.

No self-validation.

No self-prevalidation.

No self-final-validation.

No self-disbursement.

## Documents

Global Documents page is read-only.

Uploads are contextual.

Downloads are guarded.

Document uploads and downloads should be audited.

## Exchanges

`Échanges` is not a primary top-level menu.

Contextual timeline/exchanges appear inside detail pages.

A global history/search view may exist under Supervision/Audit.

## Reports

No PDF or Word reports in this phase.

CSV/XLSX only.

CSV must remain:

```md
UTF-8 BOM
semicolon-separated
French headers
stable filenames
```

---

# Hard rules

1. Do not modify Dolibarr core files.
2. Do not add new features in this phase.
3. Do not reopen old POC/N1/N2/DPAF decisions.
4. Do not close production infrastructure blockers in this phase.
5. Do not implement SMTP, final public URL, production secrets, backup/restore, monitoring, or hosting changes.
6. Only fix:

   * blockers;
   * high-priority UAT issues;
   * wording issues;
   * report column issues;
   * permission/scope bugs;
   * workflow bugs;
   * dashboard KPI bugs;
   * broken tests;
   * broken UAT flow.
7. Do not change schema unless a UAT blocker cannot be fixed safely without a migration.
8. All changed PHP files must pass syntax checks.
9. All changed docs must align with `docs/mjl-authoritative-decisions.md`.
10. Do not claim production release readiness.
11. Do not claim client approval.
12. Mark client-dependent items as `PENDING_CLIENT_VALIDATION`.
13. Preserve scope isolation by Partenaires / Programmes.
14. Preserve no-self-validation rules.
15. Preserve guarded downloads and contextual uploads.
16. Preserve CSV/XLSX export rules.
17. Stop and report if a blocker is too risky to fix in this phase.
18. Do not use this phase to redesign dashboards, workflows, reports, or navigation unless an existing UAT blocker proves they are unusable.
19. If a requested fix would become a new feature, classify it as `CLIENT_DECISION` or `DEFERRED`.
20. Every final claim must be backed by a test, manual UAT result, script output, or documented inspection.

---

# Phase 13 outcome

At the end of this phase, the repository should have:

```md
docs/mjl-feature-freeze-notes.md
docs/mjl-uat-data-readiness.md
docs/mjl-internal-uat-results.md
docs/mjl-client-validation-pack.md
docs/mjl-client-demo-scenario.md
docs/mjl-client-uat-checklist.md
docs/mjl-phase-13-final-report.md
```

The final verdict must be one of:

```md
READY_FOR_CLIENT_VALIDATION
READY_FOR_CLIENT_VALIDATION_WITH_MINOR_GAPS
NOT_READY_FOR_CLIENT_VALIDATION
```

Do not use `ON_TRACK` as the final verdict here.

This phase is about client validation readiness, not production release readiness.

---

# Sub-phase 13.0 — Baseline, evidence capture, and feature-freeze declaration

## Goal

Freeze feature scope and capture the current state before UAT.

## Actions

1. Run:

```sh
git status
```

2. Run:

```sh
git diff --check
find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l
```

3. Run available tests only if commands exist:

```sh
composer test
vendor/bin/phpunit
npm test
npm run test
npm run e2e
```

4. Run available custom scripts under:

```md
custom/mjlfinancement/scripts
```

5. Create or update:

```md
docs/mjl-feature-freeze-notes.md
```

It must state:

```md
# MJL Feature Freeze Notes

## Freeze status

Feature scope is frozen after 12R.

No new features are allowed before client validation.

Allowed changes:
- blocker fixes;
- high-priority UAT fixes;
- wording fixes;
- report column fixes;
- permission/scope bug fixes;
- workflow bug fixes;
- dashboard KPI bug fixes;
- test fixes;
- documentation corrections.

Not allowed:
- new modules;
- new workflow concepts;
- new report families unless replacing broken required reports;
- PDF/Word reports;
- SMS/OCR/bank API/public partner portal/offline mode;
- production infrastructure closure.
```

6. Update:

```md
docs/mjl-implementation-summary.md
docs/mjl-current-vs-target-gap-analysis.md
```

## Pass criteria

Sub-phase 13.0 passes only if:

* syntax checks pass;
* existing tests either pass or unavailable commands are documented;
* feature-freeze notes exist;
* no new feature work was started.

Stop if baseline is broken.

---

# Sub-phase 13.1 — UAT readiness gate

## Goal

Confirm that internal UAT can be run with realistic users, scopes, partners, projects, funding, activities, expenses, documents, timeline entries, alerts, and exports.

## Required test users

Verify or document test users for:

```md
Admin plateforme
Validateur définitif
Agent vérificateur / prévalidateur
Agent de saisie UNICEF
Agent de saisie Programme Redevabilité
```

## Required Partenaires / Programmes

Verify:

```md
UNICEF
Programme Redevabilité
```

## Required test data

Verify or create safe test/seed data for:

```md
UNICEF funding envelope
Programme Redevabilité funding envelope
fund receipt for UNICEF
fund receipt for Programme Redevabilité
UNICEF project
Programme Redevabilité project
budget allocation
activity draft
activity submitted
activity prevalidated
activity final validated
activity with physical execution
activity overdue
expense draft
expense submitted
expense missing justificatif
expense prevalidated
expense final validated
expense disbursed
document uploads
timeline entries
alerts
exports
```

Do not create unsafe production default passwords.

If test users or seed data rely on dev credentials, label them as dev/test only.

## Create or update

```md
docs/mjl-uat-data-readiness.md
```

Use this structure:

```md
# MJL UAT Data Readiness

## Executive verdict

Use one:
- UAT_DATA_READY
- UAT_DATA_READY_WITH_GAPS
- UAT_DATA_NOT_READY

## Users

## Partenaires / Programmes

## Projects

## Funding envelopes

## Funds received

## Budgets

## Activities

## Expenses / Décaissements

## Documents

## Timeline / audit

## Reports

## Missing data

## How to regenerate test data
```

## Pass criteria

Sub-phase 13.1 passes only if:

* UAT users exist or are safely created;
* UNICEF and Programme Redevabilité exist;
* each required workflow has enough data to test;
* missing data is clearly documented;
* unresolved-scope audit passes or unresolved cases are documented.

Stop if UAT data is not sufficient to run internal UAT.

---

# Sub-phase 13.2 — Dry-run UAT plan, without fixing

## Goal

Create a precise internal UAT execution plan before changing any code.

This sub-phase is inspection and planning only.

Do not fix issues yet.

Create or update:

```md
docs/mjl-internal-uat-dry-run-plan.md
```

Use this structure:

```md
# MJL Internal UAT Dry-Run Plan

## Environment

## Test users

## Test data

## Test execution order

## Expected evidence for each scenario

## Stop conditions

## Known pre-UAT risks

## Commands/scripts to run

## Manual checks required
```

For every UAT scenario, define:

```md
Scenario
Role
Precondition
Action
Expected result
Evidence to capture
Pass/fail rule
```

Evidence can be:

```md
script output
E2E result
screenshot path if existing test tooling supports screenshots
exported CSV/XLSX file path
audit row evidence
manual observation
```

## Pass criteria

Sub-phase 13.2 passes only if:

* every scenario has a clear pass/fail rule;
* evidence requirements are clear;
* stop conditions are documented;
* no code was changed.

---

# Sub-phase 13.3 — Internal UAT execution

## Goal

Execute the complete MJL workflow internally before client demo.

Create or update:

```md
docs/mjl-internal-uat-results.md
```

Use this structure:

```md
# MJL Internal UAT Results

## Executive verdict

Use one:
- INTERNAL_UAT_PASS
- INTERNAL_UAT_PASS_WITH_MINOR_GAPS
- INTERNAL_UAT_FAIL

## Environment tested

## Test users

## Test data

## Scenario results

## Evidence collected

## Issues found

## Fixes applied

## Remaining gaps

## Client-validation risks

## Final recommendation
```

## Required scenarios

### Scenario 1 — Invitation and access

Test:

```md
Admin creates or selects a user
Admin assigns one global role
Admin assigns one or many Partenaires / Programmes
Admin sends invitation or verifies invitation flow
User accepts invitation if email/base URL are available
User logs in
User sees only allowed scope
```

If production email/base URL is not configured, classify the live email acceptance part as:

```md
DEFERRED_PRODUCTION_RELEASE
```

but still test local/dev invitation mechanics where possible.

### Scenario 2 — Scope isolation

Test:

```md
Agent de saisie UNICEF sees UNICEF only
Agent de saisie Programme Redevabilité sees Programme Redevabilité only
Agent cannot open unassigned object by direct URL
Admin sees both
Unresolved object fails closed for non-admin
```

### Scenario 3 — Project creation

Test:

```md
Validateur définitif creates UNICEF project inside MJL
Admin creates Programme Redevabilité project inside MJL
Agent de saisie cannot create project
Agent vérificateur cannot create project
Project appears only in allowed scope
Project creation is audited
```

### Scenario 4 — Funding and budget

Test:

```md
Funding envelope exists for UNICEF
Fund receipt exists for UNICEF
Budget allocation exists
Budget alloué is displayed
Budget non alloué is displayed
Montant validé définitivement is displayed
Montant décaissé is displayed
Taux de validation financière is displayed
Taux d’exécution financière is displayed
```

### Scenario 5 — Activity workflow and physical execution

Test:

```md
Agent creates activity
Agent submits activity
Agent cannot prevalidate own activity
Agent vérificateur prevalidates
Validateur définitif final validates
Physical execution percentage can be updated
Invalid physical execution percentage is rejected
Late activity appears in alerts
Project and partner physical execution KPIs update
Timeline shows decisions
```

### Scenario 6 — Expense / Décaissement workflow

Test:

```md
Agent creates expense
Agent uploads justificatif
Agent submits expense
Agent cannot prevalidate own expense
Agent cannot final validate own expense
Agent cannot disburse own expense
Agent vérificateur prevalidates
Validateur définitif final validates
Validateur définitif marks as décaissé
Décaissé cannot happen before Validé définitivement
Missing justificatif blocks final validation
Insufficient budget blocks final validation or disbursement
Financial KPIs update
Timeline shows decisions
```

### Scenario 7 — Documents

Test:

```md
Contextual document upload works
Global Documents page is read-only
Documents are scoped by Partenaire / Programme
Guarded download works
Unauthorized scoped user cannot download
Download audit exists
```

### Scenario 8 — Timeline / exchanges

Test:

```md
Contextual timeline visible on partner detail
Contextual timeline visible on project detail
Contextual timeline visible on activity detail
Contextual timeline visible on expense detail
Manual comment can be added on accessible object
Workflow decisions appear in timeline
Document events appear in timeline when audited
User cannot see timeline entries outside scope
Échanges is not a primary menu item
```

### Scenario 9 — Alerts

Test:

```md
Overdue activity alert appears
Approaching deadline alert appears
Submitted activity awaiting prevalidation appears
Prevalidated activity awaiting final validation appears
Expense missing justificatif alert appears
Expense validated but not disbursed alert appears
Budget warning/critical alert appears
Alerts are scoped by Partenaire / Programme
```

### Scenario 10 — Dashboards and KPIs

Test:

```md
Agent dashboard shows own/scoped work
Agent vérificateur dashboard shows review queues
Validateur définitif dashboard shows final validation and execution KPIs
Admin dashboard shows global indicators
Partner filter changes values
Project filter changes values
No cross-partner data leakage
```

### Scenario 11 — Reports and exports

Test:

```md
CSV export works
XLSX export works
CSV has UTF-8 BOM
CSV uses semicolon separator
Headers are French
Reports respect Partenaire / Programme scope
Unauthorized user cannot export
Export audit exists
Reports include client-readable columns
```

## Issue classification

Classify every issue:

```md
BLOCKER
HIGH
MEDIUM
LOW
WORDING
CLIENT_DECISION
DEFERRED_PRODUCTION_RELEASE
```

Definitions:

```md
BLOCKER = prevents client validation
HIGH = client validation possible but serious workflow/report issue
MEDIUM = important but can be shown with explanation
LOW = minor issue
WORDING = label/copy issue
CLIENT_DECISION = requires MJL approval
DEFERRED_PRODUCTION_RELEASE = infrastructure/release issue not part of this phase
```

## Pass criteria

Sub-phase 13.3 passes if UAT verdict is:

```md
INTERNAL_UAT_PASS
```

or:

```md
INTERNAL_UAT_PASS_WITH_MINOR_GAPS
```

Stop if the verdict is:

```md
INTERNAL_UAT_FAIL
```

Do not proceed to client validation pack if internal UAT fails.

---

# Sub-phase 13.4 — Fix UAT blockers and high-priority issues only

## Goal

Fix only issues that block client validation.

Allowed fixes:

```md
BLOCKER
HIGH
critical WORDING
broken report columns
broken permission/scope behavior
broken workflow transition
broken dashboard KPI
broken export
broken timeline visibility
broken alert
test failure caused by current feature alignment
```

Not allowed:

```md
new features
new modules
PDF/Word reports
production infrastructure closure
nice-to-have design changes
large refactors unrelated to UAT
```

## Process

For each issue fixed:

1. Identify the issue from `docs/mjl-internal-uat-results.md`.
2. State the minimal fix.
3. Modify only necessary files.
4. Run relevant tests.
5. Update UAT result.
6. Update implementation summary.
7. Update gap analysis.

## Validation

Run:

```sh
git diff --check
find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l
```

Run relevant acceptance tests.

Sub-phase passes only if:

* all BLOCKER issues are resolved; or
* unresolved BLOCKER issues are reclassified as `CLIENT_DECISION` only with strong justification; or
* unresolved BLOCKER issues are reclassified as `DEFERRED_PRODUCTION_RELEASE` only if they are infrastructure/release issues, not feature validation issues.

If a feature-validation BLOCKER remains, stop.

---

# Sub-phase 13.5 — Client validation pack

## Goal

Prepare a clean client-facing validation pack.

Create or update:

```md
docs/mjl-client-validation-pack.md
```

This document must be written for client/cadrage validation.

Use clear French business wording.

Use this structure:

```md
# Pack de validation client — MJL

## Objectif de la validation

## Périmètre validé

## Hors périmètre de cette validation

## Rôles utilisateurs

## Règles d’accès par Partenaire / Programme

## Parcours 1 — Gestion des Partenaires / Programmes

## Parcours 2 — Création et suivi de projet

## Parcours 3 — Enveloppe de financement, fonds reçus et budget

## Parcours 4 — Activités et exécution physique

## Parcours 5 — Dépenses / Décaissements

## Parcours 6 — Documents et justificatifs

## Parcours 7 — Historique, décisions et commentaires

## Parcours 8 — Alertes

## Parcours 9 — Tableaux de bord et KPI

## Parcours 10 — Rapports CSV/XLSX

## Points à valider par le client

## Limites connues

## Points reportés à la préparation de production
```

## Must include final decisions clearly

Include:

```md
Partenaires / Programmes
UNICEF
Programme Redevabilité
Agent de saisie
Agent vérificateur / prévalidateur
Validateur définitif
Admin plateforme
Validé définitivement
Décaissé
Dépenses / Décaissements
Enveloppes de financement
```

Do not use stale POC labels as target terms.

## Points to validate by client

At minimum:

```md
permission matrix
dashboard KPI labels
report/export columns
workflow labels
physical execution formula
financial execution formula
alert thresholds
final report templates
```

## Hors périmètre

Explicitly list:

```md
PDF/Word reports
SMS
OCR
bank API
public partner portal
offline mode
production SMTP
production domain/base URL
production secrets
backup/restore
monitoring/log retention
```

Sub-phase passes when:

* the pack is coherent;
* it is aligned with authoritative decisions;
* it uses client-readable French wording;
* it separates client validation items from production release items.

---

# Sub-phase 13.6 — Client demo scenario and execution guide

## Goal

Make the client demo repeatable.

Create or update:

```md
docs/mjl-client-demo-scenario.md
```

Use this structure:

```md
# Scénario de démonstration client — MJL

## Préparation avant démonstration

## Utilisateurs de démonstration

## Données de démonstration

## Scénario principal — UNICEF

## Scénario d’isolation — Programme Redevabilité

## Points à montrer

## Exports à produire

## Questions à poser au client

## Points à ne pas promettre pendant la démonstration

## Critères de réussite de la démonstration
```

Main scenario:

```md
UNICEF donne un financement
→ MJL enregistre l’enveloppe de financement
→ MJL enregistre les fonds reçus
→ MJL crée un projet
→ MJL alloue le budget
→ Agent de saisie crée une activité
→ Agent de saisie soumet l’activité
→ Agent vérificateur / prévalidateur prévalide
→ Validateur définitif valide définitivement
→ Agent met à jour l’exécution physique
→ Agent crée une dépense avec justificatif
→ Agent soumet la dépense
→ Agent vérificateur / prévalidateur prévalide
→ Validateur définitif valide définitivement
→ Validateur définitif marque la dépense comme décaissée
→ Le tableau de bord se met à jour
→ Un export CSV/XLSX est généré
→ L’historique/timeline prouve la traçabilité
```

Programme Redevabilité scenario:

```md
Show that a user assigned only to Programme Redevabilité cannot access UNICEF objects, and vice versa.
```

Points not to promise:

```md
production SMTP
final public URL
production secrets
backup/restore
monitoring/log retention
PDF/Word reports
SMS
OCR
bank API
public partner portal
offline mode
```

---

# Sub-phase 13.7 — Final Phase 13 report

## Goal

Produce the final decision on whether the app is ready for client validation.

Create or update:

```md
docs/mjl-phase-13-final-report.md
```

Use this structure:

```md
# MJL Phase 13 Final Report

## Final verdict

Use one:
- READY_FOR_CLIENT_VALIDATION
- READY_FOR_CLIENT_VALIDATION_WITH_MINOR_GAPS
- NOT_READY_FOR_CLIENT_VALIDATION

## Summary

## Feature freeze status

## UAT data readiness result

## Internal UAT result

## Client validation pack status

## Client demo scenario status

## Issues fixed during Phase 13

## Remaining issues

## Remaining client decisions

## Remaining production-release blockers

## Tests run

## Files changed

## Manual steps before client demo

## Recommendation
```

## Verdict rules

Use:

```md
READY_FOR_CLIENT_VALIDATION
```

only if:

* internal UAT passed;
* no feature-validation BLOCKER issues remain;
* no HIGH issues remain unless explicitly accepted as client decision;
* validation pack exists;
* demo scenario exists;
* UAT checklist exists;
* reports/exports work;
* dashboards/KPIs are testable;
* scope isolation is verified;
* timeline/audit is testable.

Use:

```md
READY_FOR_CLIENT_VALIDATION_WITH_MINOR_GAPS
```

if:

* internal UAT passes with minor gaps;
* only MEDIUM/LOW/WORDING/CLIENT_DECISION/DEFERRED_PRODUCTION_RELEASE issues remain;
* all remaining issues are documented;
* client demo can proceed safely.

Use:

```md
NOT_READY_FOR_CLIENT_VALIDATION
```

if:

* any feature-validation BLOCKER remains;
* scope isolation is broken;
* workflow cannot complete;
* reports/exports fail;
* dashboards are misleading;
* validation pack is missing;
* demo scenario is missing.

---

# Final validation commands

At the end of Phase 13, run:

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

# Final response required from Codex

When complete, reply with:

1. Final Phase 13 verdict:

   * READY_FOR_CLIENT_VALIDATION
   * READY_FOR_CLIENT_VALIDATION_WITH_MINOR_GAPS
   * NOT_READY_FOR_CLIENT_VALIDATION
2. Sub-phases completed.
3. Sub-phases skipped or stopped and why.
4. Summary of what changed.
5. Files changed.
6. Internal UAT verdict.
7. UAT data readiness verdict.
8. UAT issues found.
9. UAT issues fixed.
10. Remaining UAT issues.
11. Client validation pack status.
12. Client demo scenario status.
13. Remaining client decisions.
14. Remaining production-release blockers.
15. Tests run and results.
16. Manual steps before client demo.
17. Confirmation that Dolibarr core files were not modified.

Do not claim production release readiness.
