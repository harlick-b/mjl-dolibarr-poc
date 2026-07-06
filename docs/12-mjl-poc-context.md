# Codex Goal — MJL Dolibarr POC for Project and Activity Traceability

Note: `AGENTS.md` is the canonical in-repo agent instruction layer. This file
is retained as project background; if it conflicts with `AGENTS.md`, follow
`AGENTS.md`.

You are working on a Dolibarr POC for the Ministry of Justice and Legislation — MJL.

The purpose of this POC is to determine whether Dolibarr can be used as a reliable base for an internal web application focused on:

- project traceability;
- activity traceability;
- expense follow-up;
- hierarchical control;
- decision history;
- audit trail;
- centralized communication trace;
- DPAF-level visibility;
- Excel reporting;
- alerts for activities approaching their end date.

This is a POC, not the final production implementation.

Do not implement immediately. First inspect, understand, and produce a plan.

---

## 1. Mandatory Codex behavior

Before modifying any file:

1. Inspect the repository.
2. Identify the Docker setup.
3. Identify the Dolibarr version.
4. Identify whether `/custom/mjlfinancement` already exists.
5. Inspect existing documentation files.
6. Inspect sample data files if present.
7. Identify which Dolibarr native objects can be reused.
8. Identify which MJL-specific objects require a custom module.
9. Produce a full implementation plan.
10. Wait for explicit approval before coding.

Rules:

- Do not modify Dolibarr core files.
- All MJL-specific code must stay inside `/custom/mjlfinancement`.
- Keep user-facing labels in French.
- Keep technical explanations in English.
- Prefer small, incremental changes.
- Document every important decision in Markdown.
- Update documentation after implementation.
- Avoid overengineering.
- Do not introduce features outside the POC scope.
- The development team is junior and will rely heavily on AI agents, so code and documentation must be simple, explicit and maintainable.
- Every implementation step must be explainable by a junior developer.

---

## 2. Context from client meeting

The client clarified that the main goal is:

```txt
Traçabilité des projets et des activités, suivi des dépenses.
```

The client also needs:

- security;
- control;
- maintenance;
- decision history;
- audit trail;
- centralized visibility;
- centralized exchange trace;
- Excel exports;
- end-date alerts for activities;
- DPAF dashboard;
- monitoring of project/activity execution;
- monitoring of expenses;
- monitoring of expected funds and next expected funding.

The application will have fewer than 100 users during the first years.

The client currently has two main partners. Each partner pilots or funds several projects.

A partner may send funds for one mission or for a group of missions. The application must allow MJL to track:

- money received;
- money allocated;
- money spent;
- money remaining;
- money expected next;
- expected next funding date if known.

The client does not need a full accounting ERP in this POC. The POC must remain focused on activity traceability, expense follow-up, workflow, audit and reporting.

---

## 3. Product positioning

This POC must test whether Dolibarr can serve as the base for a controlled internal management tool.

The target workflow is:

```txt
Partner / Partenaire
→ Project / Projet
→ Mission or funding envelope
→ Activity / Activité
→ Budget line / Ligne budgétaire
→ Expense / Dépense
→ Supporting document / Pièce justificative
→ Hierarchical review
→ Decision history
→ Exchange trace
→ Alert
→ Excel export
→ DPAF dashboard
```

The POC must not focus on:

- complete accounting replacement;
- CRM;
- sales;
- invoicing;
- supplier management beyond what is strictly useful;
- SMS;
- bank API;
- OCR;
- external partner portal;
- offline mode;
- dynamic report builder;
- real-time chat.

---

## 4. Critical POC gates

This POC must decide whether Dolibarr remains a candidate.

Stop and recommend switching to a custom Symfony MVP if any of these happen:

1. MJL-specific logic requires modifying Dolibarr core files.
2. The activity workflow cannot be implemented clearly inside `/custom/mjlfinancement`.
3. Hierarchical review requires hacks that are hard to explain or maintain.
4. The audit trail cannot show who did what, when, why and what changed.
5. The DPAF dashboard cannot show ongoing activities, pending validations, deadlines, expenses and budget state clearly.
6. Excel exports cannot be generated in a Microsoft Excel-readable format.
7. AI agents cannot safely understand and modify the module after reading the documentation.
8. A junior developer cannot explain the custom module structure after inspection.
9. The module becomes more complex than a clean custom Symfony MVP would be.
10. Dolibarr core concepts fight the business model instead of supporting it.

The POC should prioritize:

1. Activity lifecycle.
2. Hierarchical validation.
3. Decision and exchange traceability.
4. Expense follow-up.
5. DPAF dashboard.
6. Excel exports.
7. Alert for approaching end date.
8. Security and permissions.
9. Maintainability.

---

## 5. Dolibarr mapping strategy

Reuse Dolibarr native objects where practical:

| Business concept                      | Dolibarr candidate                      |
| ------------------------------------- | --------------------------------------- |
| Partner / Partenaire / Bailleur / PTF | Third party / Tiers                     |
| Project / Projet                      | Project                                 |
| Users                                 | Dolibarr users                          |
| Permissions                           | User groups and permissions             |
| Supporting documents                  | Documents / ECM                         |
| Basic exports                         | Dolibarr export system or custom export |
| Dashboard entry point                 | Custom module page                      |

Create custom objects for MJL-specific logic:

| Custom object        | Purpose                                                                     |
| -------------------- | --------------------------------------------------------------------------- |
| `MjlMissionEnvelope` | Money sent by partner for one mission or group of missions                  |
| `MjlActivity`        | Central activity tracking object                                            |
| `MjlExpense`         | Expense linked to activity, project, partner and mission envelope           |
| `MjlWorkflowAction`  | Validation, rejection, correction request, reassignment                     |
| `MjlExchangeLog`     | Traceable comments/exchanges attached to activity                           |
| `MjlDecisionLog`     | Optional explicit decision/audit history if workflow actions are not enough |
| `MjlAlert`           | Optional in-app alerts for approaching or overdue end dates                 |
| `MjlKpiSnapshot`     | Optional KPI snapshot if computed fields are not enough                     |

Start with the minimal core objects only:

```txt
MjlMissionEnvelope
MjlActivity
MjlExpense
MjlWorkflowAction
MjlExchangeLog
```

Add optional objects only if needed.

Do not create too many objects too early.

---

## 6. Business vocabulary to use

Use this vocabulary in the POC:

| English technical term     | French UI label                     |
| -------------------------- | ----------------------------------- |
| Partner                    | Partenaire                          |
| Project                    | Projet                              |
| MissionEnvelope            | Mission / enveloppe de financement  |
| Activity                   | Activité                            |
| Expense                    | Dépense                             |
| Supporting document        | Pièce justificative                 |
| Workflow action            | Action de validation                |
| Exchange log               | Échanges                            |
| Decision log               | Historique des décisions            |
| Audit trail                | Journal d’audit                     |
| Dashboard                  | Tableau de bord                     |
| Alert                      | Alerte                              |
| Physical execution rate    | Taux d’exécution physique           |
| Activity performance index | Indice de performance de l’activité |

Avoid confusing the user with ERP vocabulary unless Dolibarr requires it internally.

---

## 7. User roles for the POC

Implement or simulate these roles:

```txt
AGENT
SUPERVISEUR_N1
SUPERVISEUR_N2
DPAF
ADMIN
LECTEUR
```

Role expectations:

| Role           | Expected permissions                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------ |
| AGENT          | Create activity, edit own draft, submit activity, add comments, add supporting documents         |
| SUPERVISEUR_N1 | Review activities submitted by AGENT, validate, reject, request correction, reassign             |
| SUPERVISEUR_N2 | Review validated or escalated activities, validate, reject, request correction                   |
| DPAF           | Highest business visibility, sees all projects, activities, expenses, alerts, decisions and KPIs |
| ADMIN          | Technical administration, setup, users, permissions                                              |
| LECTEUR        | Read-only access to authorized data                                                              |

Important rule:

```txt
An AGENT must not be able to validate his/her own activity as N+1.
```

---

## 8. Hierarchical workflow to prove

The POC must prove this workflow:

1. AGENT creates an activity.
2. AGENT fills required information.
3. AGENT submits the activity.
4. SUPERVISEUR_N1 reviews the activity.
5. SUPERVISEUR_N1 can:
   - validate;
   - reject;
   - request correction;
   - reassign to the AGENT with a comment.

6. If correction is requested, the activity returns to the AGENT.
7. AGENT corrects the activity.
8. AGENT resubmits.
9. SUPERVISEUR_N1 validates.
10. SUPERVISEUR_N2 or DPAF has visibility.
11. Every action is recorded in the workflow history.
12. DPAF can see the activity status in the dashboard.

For the POC, the workflow may be simple and configurable later.

Do not overbuild a complex workflow engine.

---

## 9. Activity statuses

Use these statuses for the POC:

```txt
draft
submitted
correction_requested
validated
in_progress
completed
rejected
overdue
cancelled
```

French labels:

```txt
Brouillon
Soumise
Correction demandée
Validée
En cours
Terminée
Rejetée
En retard
Annulée
```

---

## 10. Expense statuses

Use these statuses for the POC:

```txt
draft
submitted
correction_requested
validated
rejected
recorded
cancelled
```

French labels:

```txt
Brouillon
Soumise
Correction demandée
Validée
Rejetée
Enregistrée
Annulée
```

Do not implement payment automation.

The POC is about expense follow-up, not banking or online payment.

---

## 11. Minimal data model

### 11.1 `MjlMissionEnvelope`

Purpose:

Track money sent by a partner for one mission or a group of missions.

Fields:

```txt
ref
partner_id
project_id
title
description
amount_received
amount_allocated
amount_spent
amount_remaining
expected_next_amount
expected_next_date
status
comment
created_by
created_at
updated_at
```

Expected behavior:

- Link to one partner.
- Link to one project.
- Show received amount.
- Show allocated amount.
- Show spent amount.
- Show remaining amount.
- Show expected next amount and date if known.

For the POC, computed amounts can be simple.

---

### 11.2 `MjlActivity`

Purpose:

Central object of the application.

Fields:

```txt
ref
title
description
partner_id
project_id
mission_envelope_id
start_date
end_date
physical_progress_percent
status
created_by
current_reviewer_id
current_validation_level
deadline_alert_status
performance_index
created_at
updated_at
```

Expected behavior:

- Created by AGENT.
- Submitted for review.
- Reviewed by SUPERVISEUR_N1.
- Can be validated, rejected or returned for correction.
- Visible to DPAF.
- Has physical execution rate.
- Has performance index.
- Has exchanges/comments.
- Has workflow history.
- Can have linked expenses.
- Shows alert when approaching end date.

---

### 11.3 `MjlExpense`

Purpose:

Track expenses linked to activities.

Fields:

```txt
ref
activity_id
project_id
partner_id
mission_envelope_id
amount
expense_date
description
supporting_document_ref
supporting_document_present
status
created_by
submitted_at
validated_by
validated_at
correction_reason
created_at
updated_at
```

Expected behavior:

- Linked to activity.
- Linked to project.
- Linked to partner.
- Linked to mission envelope.
- Can have supporting document.
- Can be submitted.
- Can be validated, rejected or returned for correction.
- Appears in Excel export.
- Appears in DPAF dashboard.

---

### 11.4 `MjlWorkflowAction`

Purpose:

Trace validation and status changes.

Fields:

```txt
ref
object_type
object_ref
action
from_status
to_status
actor_user_id
actor_role
assigned_to_user_id
action_date
comment
previous_value
new_value
created_at
```

Expected behavior:

Track:

- creation;
- submission;
- validation;
- rejection;
- correction request;
- reassignment;
- status change;
- important data changes.

This object is mandatory.

---

### 11.5 `MjlExchangeLog`

Purpose:

Trace centralized communication around an activity.

Fields:

```txt
ref
activity_id
author_user_id
message
visibility
attachment_ref
related_workflow_action_ref
created_at
```

Expected behavior:

- Not a real-time chat.
- Simple traceable comment log.
- Attached to activity.
- Visible in activity detail.
- Exportable if needed.
- DPAF can view exchanges.

---

### 11.6 Optional `MjlDecisionLog`

Add only if `MjlWorkflowAction` is not enough.

Fields:

```txt
ref
object_type
object_ref
decision_type
decision_label
previous_value
new_value
actor_user_id
actor_role
decision_date
reason
created_at
```

Do not add this too early if workflow actions already cover the audit trail.

---

## 12. Alerts

Implement simple in-app alerts only.

Rules:

```txt
If activity end date is within 7 days and status is not completed:
  show "approaching end date" alert.

If activity end date is passed and status is not completed:
  show "overdue" alert.
```

French labels:

```txt
Échéance proche
En retard
```

Do not implement SMS.

Do not implement external notification service.

Email notification is not required for the POC.

---

## 13. KPIs

The client mentioned two important KPIs:

```txt
Indice de performance des activités
Taux d'exécution physique des activités
```

For the POC, use draft formulas only. Document clearly that they are provisional.

### 13.1 Taux d’exécution physique

Use:

```txt
physical_progress_percent
```

This value is manually updated by authorized users.

Range:

```txt
0 to 100
```

### 13.2 Indice de performance de l’activité

Suggested provisional formula:

```txt
Activity performance index =
40% deadline score
+ 40% physical execution score
+ 20% validation/control score
```

Deadline score:

```txt
100 if completed before or on end date
70 if ongoing and not overdue
40 if overdue by 1 to 7 days
0 if overdue by more than 7 days
```

Physical execution score:

```txt
physical_progress_percent
```

Validation/control score:

```txt
100 if validated
60 if submitted or pending review
30 if correction requested
0 if rejected
```

Important:

- Do not present this as a final business rule.
- Implement it in a simple way.
- Document it as a POC formula.
- Make it easy to change later.

---

## 14. DPAF dashboard

Create or simulate a DPAF dashboard inside the custom module.

The DPAF dashboard must show:

```txt
Total active projects
Total ongoing activities
Activities approaching end date
Overdue activities
Submitted activities awaiting validation
Expenses submitted
Expenses validated
Budget received
Budget spent
Budget remaining
Expected next funding
Average physical execution rate
Average activity performance index
Recent workflow actions
Recent exchanges
```

For the POC, this can be a simple page with KPI cards and tables.

Do not spend too much time on visual design.

Prioritize clarity.

---

## 15. Excel exports

Excel export is mandatory.

PDF is secondary.

Create or simulate at least three Excel-readable exports.

The export may be `.xlsx` if practical, or clean `.csv` compatible with Microsoft Excel.

Use French column labels.

### Export 1 — Suivi des activités

Columns:

```txt
Partenaire
Projet
Mission / enveloppe de financement
Référence activité
Titre activité
Date de début
Date de fin
Statut
Taux d’exécution physique
Indice de performance
Responsable actuel
Alerte échéance
Budget alloué
Dépenses validées
Budget restant
```

### Export 2 — Suivi des dépenses

Columns:

```txt
Partenaire
Projet
Mission / enveloppe de financement
Activité
Référence dépense
Date dépense
Montant
Statut
Pièce justificative présente
Créée par
Validée par
Date de validation
Motif de correction
```

### Export 3 — Historique décisions / audit

Columns:

```txt
Type d’objet
Référence objet
Action / décision
Ancien statut
Nouveau statut
Ancienne valeur
Nouvelle valeur
Acteur
Rôle
Date
Commentaire / motif
```

Acceptance rule:

```txt
The exported file must open cleanly in Microsoft Excel.
```

---

## 16. Sample data

If the sample data pack exists, use it.

Expected folder may be:

```txt
mjl_dolibarr_poc_sample_data/
```

Important sample files:

```txt
seed/users.csv
seed/roles_permissions.csv
seed/ptfs_bailleurs.csv
seed/projects.csv
seed/conventions.csv
seed/activities.csv
seed/budget_lines.csv
seed/fund_receipts.csv
seed/expenses.csv
seed/supporting_documents.csv
seed/validation_events.csv
seed/fixed_reports.csv
TEST_SCENARIOS.md
AI_AGENT_PROMPT.md
README_SAMPLE_DATA.md
```

Do not blindly import everything.

First inspect the sample data and explain:

1. What maps to Dolibarr native objects.
2. What maps to custom MJL objects.
3. What should be manually created first.
4. What can be scripted later.
5. What data needs adaptation because the client meeting changed the model.

The client meeting introduced `MissionEnvelope` as more central than `Convention`. If existing sample data uses conventions, keep compatibility but explain how the convention data maps to mission/funding envelope.

Suggested mapping:

```txt
Convention → can be treated as a legal/financial source document
MissionEnvelope → operational funding envelope used for activity and expense follow-up
```

If necessary, use `MjlMissionEnvelope` as the POC central funding object and keep convention reference optional.

---

## 17. Implementation phases

Do not do all phases at once.

### Phase 0 — Repository audit and plan

Deliver:

1. Repository audit summary.
2. Dolibarr version.
3. Docker status.
4. Custom module status.
5. Native object mapping.
6. Proposed custom data model.
7. Risk list.
8. Implementation plan.
9. Files expected to be modified.
10. Test plan.

No code changes in Phase 0.

---

### Phase 1 — Documentation and module skeleton

Create or update:

```txt
docs/00-context.md
docs/01-client-meeting-notes.md
docs/02-poc-scope.md
docs/03-data-model.md
docs/04-workflow.md
docs/05-permissions.md
docs/06-exports.md
docs/07-poc-gates.md
docs/08-ai-agent-rules.md
```

Create or verify:

```txt
/custom/mjlfinancement
```

Do not modify Dolibarr core.

---

### Phase 2 — Minimal custom objects

Implement minimal objects:

```txt
MjlMissionEnvelope
MjlActivity
MjlExpense
MjlWorkflowAction
MjlExchangeLog
```

Keep fields minimal and understandable.

Add French labels.

Add menu entries.

Add list and detail views if possible.

---

### Phase 3 — Activity workflow

Implement or simulate:

```txt
create activity
submit activity
request correction
resubmit
validate
reject
```

Every action must create a `MjlWorkflowAction`.

Prevent AGENT from validating his/her own activity as N+1.

---

### Phase 4 — Expense follow-up

Implement or simulate:

```txt
create expense
link expense to activity
link expense to mission envelope
attach supporting document reference
submit expense
validate expense
reject expense
request correction
```

Every status change must create a `MjlWorkflowAction`.

---

### Phase 5 — Exchange trace

Implement simple comments/exchanges attached to activity.

This is not chat.

Each exchange must show:

```txt
author
message
timestamp
activity
optional attachment reference
```

---

### Phase 6 — Alerts

Implement simple alert logic:

```txt
end date within 7 days and not completed → échéance proche
end date passed and not completed → en retard
```

Show alerts on:

```txt
activity list
activity detail
DPAF dashboard
```

---

### Phase 7 — DPAF dashboard

Create a simple DPAF dashboard page showing:

```txt
active projects
ongoing activities
activities approaching end date
overdue activities
pending validations
validated expenses
submitted expenses
budget received
budget spent
budget remaining
expected next funding
average physical execution
average performance index
recent workflow actions
recent exchanges
```

---

### Phase 8 — Excel exports

Implement or simulate three exports:

```txt
Suivi des activités
Suivi des dépenses
Historique décisions / audit
```

Use `.xlsx` if practical.

If `.xlsx` is too costly in the POC, use clean UTF-8 CSV with semicolon separator compatible with Microsoft Excel.

Document the chosen format.

---

### Phase 9 — Sample data and test scenarios

Use or adapt the sample data.

Create enough test records to prove:

```txt
2 partners
multiple projects
mission envelopes
activities
expenses
workflow actions
comments/exchanges
approaching deadline
overdue activity
DPAF dashboard
Excel exports
```

---

### Phase 10 — Final POC recommendation

At the end, produce a recommendation:

```txt
Continue with Dolibarr
or
Switch to custom Symfony MVP
or
Test ERPNext/Frappe
```

Justify the recommendation with evidence.

---

## 18. Acceptance tests

The POC is successful only if these tests pass.

### Test 1 — Partner and project structure

- A partner can have several projects.
- A project can have several activities.
- A mission envelope can be linked to partner and project.

Pass condition:

```txt
DPAF can clearly see which partner funds which project and which activities are ongoing.
```

---

### Test 2 — Activity creation by AGENT

- AGENT creates activity.
- AGENT fills required fields.
- Activity starts as draft.
- AGENT submits activity.

Pass condition:

```txt
Activity status becomes submitted and workflow history records the action.
```

---

### Test 3 — N+1 review

- SUPERVISEUR_N1 reviews submitted activity.
- SUPERVISEUR_N1 requests correction.
- Comment is required.
- Activity returns to AGENT.
- AGENT corrects and resubmits.
- SUPERVISEUR_N1 validates.

Pass condition:

```txt
Every action is visible in workflow history.
```

---

### Test 4 — DPAF visibility

- DPAF logs in.
- DPAF sees all ongoing activities.
- DPAF sees pending validations.
- DPAF sees overdue and approaching-end-date activities.
- DPAF sees recent workflow actions and exchanges.

Pass condition:

```txt
DPAF has a clear view of ongoing work.
```

---

### Test 5 — Expense follow-up

- Expense is created under an activity.
- Expense has amount and supporting document reference.
- Expense can be submitted.
- Expense can be validated, rejected or corrected.

Pass condition:

```txt
Expense is traceable by partner, project, mission envelope and activity.
```

---

### Test 6 — Audit trail

For activity and expense:

- creation is recorded;
- submission is recorded;
- validation is recorded;
- rejection is recorded;
- correction request is recorded;
- reassignment is recorded if applicable.

Pass condition:

```txt
The audit trail shows who did what, when, why and what changed.
```

---

### Test 7 — Exchange trace

- User adds a comment/exchange to an activity.
- Comment is visible on activity detail.
- DPAF can view it.

Pass condition:

```txt
Communication is centralized and traceable.
```

---

### Test 8 — Alerts

- One activity ends within 7 days and is not completed.
- One activity is past end date and not completed.

Pass condition:

```txt
The first shows échéance proche.
The second shows en retard.
```

---

### Test 9 — Excel export

Generate:

```txt
Suivi des activités
Suivi des dépenses
Historique décisions / audit
```

Pass condition:

```txt
Exports open cleanly in Microsoft Excel and contain French labels.
```

---

### Test 10 — Maintainability

Ask an AI agent to add a small field:

```txt
Add field reference_piece to MjlExpense.
Show it in form, list and export.
Do not modify Dolibarr core.
Update documentation.
```

Pass condition:

```txt
The AI agent makes the change only in the custom module and documentation.
```

---

## 19. Security and maintenance expectations

The client explicitly needs security, control and maintenance.

For the POC, verify and document:

```txt
Role-based access
No self-validation as N+1
Read-only role
Admin role separation
Audit trail
Persistent Docker volumes
Database backup command
Document storage persistence
Custom module persistence
```

Add a documentation file:

```txt
docs/09-security-maintenance.md
```

Include:

- roles;
- permissions;
- backup strategy;
- restore test;
- logs/audit strategy;
- update/maintenance caution;
- rule against modifying Dolibarr core.

---

## 20. Docker and deployment checks

If Docker is present, verify:

```txt
docker compose up -d
docker compose ps
docker compose logs
```

Check that these persist:

```txt
database data
Dolibarr documents
custom module files
```

Perform basic persistence test:

```txt
docker compose down
docker compose up -d
```

Data must still exist.

Prepare backup command for database.

Prepare restore notes.

Do not claim production readiness unless backup/restore was tested.

---

## 21. Final deliverables

At the end of the task, provide:

1. What was inspected.
2. What was implemented.
3. What was not implemented.
4. Files changed.
5. How to run locally.
6. How to test.
7. How to use sample data.
8. Known limitations.
9. POC gate results.
10. Recommendation:
    - continue Dolibarr;
    - switch to custom Symfony MVP;
    - or test ERPNext/Frappe.

---

## 22. Final recommendation rule

Recommend continuing with Dolibarr only if:

```txt
Activity workflow is clear.
Audit trail is clear.
DPAF dashboard is clear.
Excel exports work.
Custom module remains isolated.
AI-agent maintainability is acceptable.
Junior developer can understand the module.
No core Dolibarr files were modified.
```

Recommend switching to custom Symfony MVP if:

```txt
The POC works technically but feels forced.
The workflow is hard to explain.
The custom module becomes too complex.
Dolibarr objects fight the MJL business model.
Excel exports or dashboard are painful.
Core modifications are required.
```

Recommend ERPNext/Frappe only if:

```txt
Dolibarr fails mainly because its project/budget/accounting model is too limited,
and the team accepts the learning curve of Frappe.
```

---

## 23. First action now

Your first response must be a plan only.

Do not edit files yet.

Your first response must include:

```txt
Repository audit approach
Files/folders to inspect
Dolibarr native object mapping
Custom module proposal
Risks and stop gates
Implementation phases
Acceptance tests
Questions only if truly blocking
```

Do not ask unnecessary questions.

Make reasonable assumptions and document them.
