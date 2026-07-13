You are working inside the existing Dolibarr MJL repository.

Goal: execute Phase 14 — Client Validation Preparation, Evidence Capture, and Feedback Classification.

The app is currently at:

```md
READY_FOR_CLIENT_VALIDATION_WITH_MINOR_GAPS
```

Phase 13 completed internal UAT and produced client validation materials.

Phase 14 must prepare the client validation session, make the demo safe and repeatable, capture real client feedback if available, and classify the result.

Important: Codex must not invent client feedback.

If no real client validation session has happened, the final verdict must be:

```md
CLIENT_VALIDATION_NOT_RUN
```

This is not a new feature phase.

This is not production release closure.

This is not deployment.

Do not claim production release readiness.

---

# Phase 14 structure

This phase is split into three conceptual parts:

```md
Phase 14A — Prepare and rehearse client validation
Phase 14B — Record actual client validation feedback
Phase 14C — Classify feedback and decide next phase
```

If the real client meeting has not happened yet, complete Phase 14A and prepare Phase 14B/C templates, but set the final verdict to:

```md
CLIENT_VALIDATION_NOT_RUN
```

If real client feedback is provided, record it exactly, classify it, and update the final verdict accordingly.

---

# Current state

Phase 13 result:

```md
READY_FOR_CLIENT_VALIDATION_WITH_MINOR_GAPS
```

Internal UAT result:

```md
INTERNAL_UAT_PASS_WITH_MINOR_GAPS
```

Known remaining issues from Phase 13:

```md
historical unresolved local audit-row data debt
production email transport unknown
public/base URL unknown
production secrets unknown
backup/restore procedure unknown
monitoring/log retention unknown
final deployment procedure unknown
client decisions pending
```

The app is ready for business validation, but not production release.

---

# Mandatory reading before doing anything

Read these files first:

```md
docs/mjl-authoritative-decisions.md
docs/mjl-current-vs-target-gap-analysis.md
docs/mjl-implementation-summary.md
docs/mjl-phase-13-final-report.md
docs/mjl-internal-uat-results.md
docs/mjl-client-validation-pack.md
docs/mjl-client-demo-scenario.md
docs/mjl-client-uat-checklist.md
docs/mjl-dashboard-kpi-model.md
docs/mjl-reports-exports-model.md
docs/mjl-roles-permissions-matrix.md
docs/mjl-feature-freeze-notes.md
docs/mjl-deployment-checklist.md
docs/mjl-stale-reference-audit.md
```

Some files may not exist. If a file is missing:

* record it in the Phase 14 final report;
* create it only if it belongs to client validation;
* do not recreate old noisy planning docs.

Use this authority order:

```md
Current user instruction
docs/mjl-authoritative-decisions.md
Active Phase 14 task
docs/mjl-client-validation-pack.md
docs/mjl-client-demo-scenario.md
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

These decisions remain binding unless the client explicitly rejects or changes them during real validation.

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

Do not use `Tiers` as normal user-facing wording except in technical Dolibarr explanations.

## Known Partenaires / Programmes

Validation must include:

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

No PDF or Word reports in the current phase.

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
2. Do not implement new features in this phase.
3. Do not close production infrastructure blockers in this phase.
4. Do not implement SMTP, final public URL, production secrets, backup/restore, monitoring, or hosting changes.
5. Do not reopen old POC/N1/N2/DPAF decisions unless documenting real client rejection or requested change.
6. Only documentation, validation evidence, demo preparation, rehearsal evidence, and client feedback classification are expected.
7. Code changes are allowed only for:

   * critical demo blocker;
   * broken wording that would mislead the client;
   * broken report column or export needed for validation;
   * broken permission/scope behavior discovered during demo rehearsal;
   * broken UAT script/check.
8. No schema change unless a client-validation blocker cannot be fixed safely otherwise.
9. Preserve feature freeze.
10. Preserve scope isolation.
11. Preserve no-self-validation.
12. Preserve guarded downloads and contextual uploads.
13. Preserve CSV/XLSX export rules.
14. Do not claim production release readiness.
15. Do not claim client approval unless the validation result explicitly supports it.
16. Do not invent client feedback.
17. Every client decision or change request must be documented.
18. Every issue must be classified.
19. Every final claim must be backed by UAT result, demo rehearsal result, client feedback, script output, or documented inspection.
20. If no client session has happened, final verdict must be `CLIENT_VALIDATION_NOT_RUN`.

---

# Phase 14 outcome

At the end of this phase, the repository should contain:

```md
docs/mjl-client-decision-log.md
docs/mjl-client-validation-results.md
docs/mjl-client-change-requests.md
docs/mjl-client-demo-hygiene-checklist.md
docs/mjl-client-demo-readiness-checklist.md
docs/mjl-client-demo-runbook.md
docs/mjl-phase-14-final-report.md
```

The final verdict must be one of:

```md
CLIENT_VALIDATED
CLIENT_VALIDATED_WITH_CHANGES
CLIENT_REQUIRES_REWORK
CLIENT_VALIDATION_NOT_RUN
```

Do not use `ON_TRACK`.

Do not use `PRODUCTION_READY`.

---

# Phase 14A — Prepare and rehearse client validation

## Sub-phase 14.0 — Client demo readiness check

### Goal

Confirm the app and documentation are ready for a client-facing demo.

### Actions

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

5. Review:

```md
docs/mjl-client-validation-pack.md
docs/mjl-client-demo-scenario.md
docs/mjl-client-uat-checklist.md
docs/mjl-internal-uat-results.md
docs/mjl-phase-13-final-report.md
```

6. Create or update:

```md
docs/mjl-client-demo-readiness-checklist.md
```

Use this structure:

```md
# MJL Client Demo Readiness Checklist

## Executive verdict

Use one:
- DEMO_READY
- DEMO_READY_WITH_MINOR_GAPS
- DEMO_NOT_READY

## Repository status

## Tests/checks run

## Demo users

## Demo data

## Demo scenario readiness

## Exports to show

## Known issues not to show unless asked

## Known issues to explain proactively

## Client decisions to collect

## Production-release items outside this demo

## Go / No-Go
```

### Pass criteria

Sub-phase 14.0 passes if:

* syntax checks pass;
* no known demo blocker remains;
* demo users and demo data are available;
* demo scenario is documented;
* production-release blockers are separated from client-feature validation;
* demo readiness verdict is `DEMO_READY` or `DEMO_READY_WITH_MINOR_GAPS`.

Stop if verdict is `DEMO_NOT_READY`.

---

## Sub-phase 14.1 — Demo hygiene checklist

### Goal

Avoid showing confusing local/test noise during the client demo.

Create or update:

```md
docs/mjl-client-demo-hygiene-checklist.md
```

Use this structure:

```md
# MJL Client Demo Hygiene Checklist

## Executive verdict

Use one:
- DEMO_HYGIENE_READY
- DEMO_HYGIENE_READY_WITH_NOTES
- DEMO_HYGIENE_NOT_READY

## Data hygiene

## Audit/history hygiene

## Demo users

## Demo credentials handling

## Demo exports

## Demo browser/session preparation

## Known local/test noise

## Items to clean before demo

## Items safe to explain if asked

## Do-not-show list

## Do-not-promise list
```

Must explicitly check:

```md
historical unresolved local audit rows
generic report anchors
test/dev credentials
sample passwords
local file paths
debug output
roadmap/internal page visibility
unresolved-scope diagnostic output
production readiness UNKNOWN items
```

Do not hide real limitations dishonestly.

If historical unresolved local audit rows appear in visible demo screens, recommend cleaning or avoiding those screens during demo, but document the choice.

---

## Sub-phase 14.2 — Client decision log setup

### Goal

Create a structured place to capture all client decisions.

Create or update:

```md
docs/mjl-client-decision-log.md
```

Use this structure:

```md
# MJL Client Decision Log

## Decision status values

- APPROVED
- APPROVED_WITH_CHANGES
- TO_REVIEW
- REJECTED
- DEFERRED

## Decision categories

- Permissions
- Workflow
- Partenaires / Programmes
- Projects
- Activities
- Physical execution
- Funding
- Budget
- Expenses / Décaissements
- Documents
- Timeline / Historique
- Alerts
- Dashboards / KPI
- Reports / Exports
- Audit
- Production preparation

## Decisions

| ID | Category | Decision item | Current proposal | Client feedback | Status | Owner | Impact | Follow-up |
```

Pre-fill the decision log with at least these items:

```md
Permission matrix
Role names
Scope by Partenaires / Programmes
Project creation by Admin / Validateur définitif
Activity workflow labels
Expense / Décaissement workflow labels
Validé définitivement vs Décaissé
Physical execution formula
Financial execution formula
Dashboard KPI labels
Alert thresholds
Report/export list
Report/export columns
Timeline / Historique behavior
Global Documents read-only
Contextual uploads
CSV/XLSX only for current phase
PDF/Word reports deferred
Production SMTP deferred
Public URL/base URL deferred
Backup/restore deferred
Monitoring/log retention deferred
```

---

## Sub-phase 14.3 — Client demo runbook

### Goal

Make the demo repeatable and safe.

Create or update:

```md
docs/mjl-client-demo-runbook.md
```

Use clear French business wording.

Use this structure:

```md
# Guide de démonstration client — MJL

## Objectif de la démonstration

## Préparation avant la démonstration

## Comptes de démonstration

## Données de démonstration

## Scénario principal — UNICEF

## Scénario d’isolation — Programme Redevabilité

## Déroulé détaillé

## Exports à produire pendant la démonstration

## Points à faire valider

## Questions à poser

## Points à ne pas promettre

## Que faire si une question dépasse le périmètre
```

The main demo flow must include:

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

The scope-isolation flow must include:

```md
A user assigned only to Programme Redevabilité cannot access UNICEF objects.
A user assigned only to UNICEF cannot access Programme Redevabilité objects.
Admin sees both.
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

## Sub-phase 14.4 — Demo rehearsal evidence

### Goal

Run or document an internal demo rehearsal before client validation.

Create or update:

```md
docs/mjl-client-demo-rehearsal-results.md
```

Use this structure:

```md
# MJL Client Demo Rehearsal Results

## Executive verdict

Use one:
- DEMO_REHEARSAL_PASS
- DEMO_REHEARSAL_PASS_WITH_NOTES
- DEMO_REHEARSAL_FAIL

## Environment

## Demo users tested

## Scenario rehearsed

## Steps completed

## Exports generated

## Evidence captured

## Issues found

## Fixes applied

## Remaining demo risks

## Go / No-Go for client demo
```

If the rehearsal cannot be run fully, explain why and classify the gap.

Pass criteria:

* UNICEF main scenario can be demonstrated;
* Programme Redevabilité isolation can be demonstrated;
* dashboards and exports to show are identified;
* known issues are documented;
* no demo-blocking issue remains.

---

# Phase 14B — Record actual client validation feedback

## Sub-phase 14.5 — Client validation results structure

### Goal

Prepare or update the document that records actual validation outcomes.

Create or update:

```md
docs/mjl-client-validation-results.md
```

Use this structure:

```md
# Résultats de validation client — MJL

## Validation session

Date:
Participants:
Environment:
Version / commit:
Facilitator:
Recorder:

## Executive verdict

Use one:
- CLIENT_VALIDATED
- CLIENT_VALIDATED_WITH_CHANGES
- CLIENT_REQUIRES_REWORK
- CLIENT_VALIDATION_NOT_RUN

## What was demonstrated

## Validation by area

### Partenaires / Programmes

### Projets

### Enveloppes de financement / Fonds reçus

### Budgets

### Activités / Exécution physique

### Dépenses / Décaissements

### Documents / Justificatifs

### Historique / Timeline / Décisions

### Alertes

### Tableaux de bord / KPI

### Rapports / Exports CSV/XLSX

### Permissions / Rôles

### Audit / Traçabilité

## Client feedback

## Decisions approved

## Decisions approved with changes

## Decisions rejected

## Open questions

## Change requests

## Production-release reminders

## Final recommendation
```

If the client validation has not happened yet, fill the file as a template and set verdict:

```md
CLIENT_VALIDATION_NOT_RUN
```

Do not invent client feedback.

---

## Sub-phase 14.6 — Actual client feedback recording

### Goal

If actual client feedback is available, record it exactly.

If no real client session has happened yet, do not invent feedback and skip this sub-phase with verdict `CLIENT_VALIDATION_NOT_RUN`.

When feedback is available:

1. Update:

```md
docs/mjl-client-validation-results.md
docs/mjl-client-decision-log.md
docs/mjl-client-change-requests.md
```

2. Classify each decision as:

```md
APPROVED
APPROVED_WITH_CHANGES
TO_REVIEW
REJECTED
DEFERRED
```

3. Classify each change request priority as:

```md
BLOCKER
HIGH
MEDIUM
LOW
NICE_TO_HAVE
```

4. Classify each change request status as:

```md
NEW
ACCEPTED
REJECTED
DEFERRED
NEEDS_ESTIMATION
IMPLEMENTED
BLOCKED
```

5. Update final client validation verdict:

```md
CLIENT_VALIDATED
CLIENT_VALIDATED_WITH_CHANGES
CLIENT_REQUIRES_REWORK
CLIENT_VALIDATION_NOT_RUN
```

Do not modify code in this sub-phase unless the client feedback identifies a simple wording correction required for documentation coherence.

---

## Sub-phase 14.7 — Change request classification

### Goal

Ensure client feedback does not become uncontrolled scope creep.

Create or update:

```md
docs/mjl-client-change-requests.md
```

Use this structure:

```md
# MJL Client Change Requests

## Change request statuses

- NEW
- ACCEPTED
- REJECTED
- DEFERRED
- NEEDS_ESTIMATION
- IMPLEMENTED
- BLOCKED

## Priority levels

- BLOCKER
- HIGH
- MEDIUM
- LOW
- NICE_TO_HAVE

## Change requests

| ID | Source | Area | Request | Priority | Status | Rationale | Impact | Estimate | Decision |
```

Classification rules:

```md
BLOCKER = prevents client validation or legal/business acceptability
HIGH = required before production release but does not block validation
MEDIUM = important improvement after validation
LOW = minor improvement
NICE_TO_HAVE = future enhancement
```

Out-of-scope requests must be classified as `DEFERRED` unless the user explicitly approves expanding the scope.

Examples of likely deferred requests:

```md
PDF/Word reports
SMS
OCR
bank API
public partner portal
offline mode
advanced BI dashboards
automatic email notifications beyond configured app emails
```

---

# Phase 14C — Classify feedback and decide next phase

## Sub-phase 14.8 — Final Phase 14 report

### Goal

Produce the final decision on client validation status.

Create or update:

```md
docs/mjl-phase-14-final-report.md
```

Use this structure:

```md
# MJL Phase 14 Final Report

## Final verdict

Use one:
- CLIENT_VALIDATED
- CLIENT_VALIDATED_WITH_CHANGES
- CLIENT_REQUIRES_REWORK
- CLIENT_VALIDATION_NOT_RUN

## Summary

## Demo readiness result

## Demo hygiene result

## Demo rehearsal result

## Validation session status

## Client validation result

## Decision log status

## Change request status

## Issues requiring follow-up

## Remaining client decisions

## Remaining production-release blockers

## Tests run

## Files changed

## Recommended next phase
```

## Verdict rules

Use:

```md
CLIENT_VALIDATED
```

only if:

* real client validation was run;
* client approved the workflows;
* client approved the permission model;
* client approved dashboard/KPI direction;
* client approved CSV/XLSX report direction;
* no blocker change request remains.

Use:

```md
CLIENT_VALIDATED_WITH_CHANGES
```

if:

* real client validation was run;
* client mostly approved the app;
* changes are required but do not invalidate the architecture;
* change requests are documented and prioritized.

Use:

```md
CLIENT_REQUIRES_REWORK
```

if:

* client rejected a core workflow;
* client rejected the role/scope model;
* client rejected dashboard/report structure;
* client requires major changes before validation can continue.

Use:

```md
CLIENT_VALIDATION_NOT_RUN
```

if:

* no real client validation session has happened yet;
* this phase only prepared validation documents, demo hygiene, demo rehearsal, runbook, decision log, and feedback templates.

Recommended next phase mapping:

```md
CLIENT_VALIDATION_NOT_RUN
→ Run the actual client validation session.

CLIENT_VALIDATED
→ Production release readiness closure.

CLIENT_VALIDATED_WITH_CHANGES
→ Phase 15 client-request implementation / adjustment pass.

CLIENT_REQUIRES_REWORK
→ Rework planning and architecture impact review.
```

---

# Final validation commands

At the end of Phase 14, run:

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

1. Final Phase 14 verdict:

   * CLIENT_VALIDATED
   * CLIENT_VALIDATED_WITH_CHANGES
   * CLIENT_REQUIRES_REWORK
   * CLIENT_VALIDATION_NOT_RUN
2. Sub-phases completed.
3. Sub-phases skipped and why.
4. Summary of what changed.
5. Files changed.
6. Demo readiness verdict.
7. Demo hygiene verdict.
8. Demo rehearsal verdict.
9. Client validation result.
10. Decision log status.
11. Change request status.
12. Remaining client decisions.
13. Remaining production-release blockers.
14. Tests run and results.
15. Manual steps before/after client demo.
16. Recommended next phase.
17. Confirmation that Dolibarr core files were not modified.

Do not claim production release readiness.
