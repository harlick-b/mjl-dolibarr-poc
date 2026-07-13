# Scenario de demonstration client - MJL

Target decisions come from `docs/mjl-authoritative-decisions.md`. This scenario
is for client-facing feature validation, not production deployment closure.

Status: `PENDING_CLIENT_VALIDATION`.

## Preparation avant demonstration

- Use the local/dev UAT dataset only.
- Confirm Dolibarr and MariaDB are running.
- Confirm demo users can log in.
- Confirm no production SMTP, public URL, secrets, backup/restore, or
  monitoring claim is made during the demonstration.

## Utilisateurs de demonstration

- `ADMIN_PLATEFORME`: invitations, roles, scopes, diagnostics.
- `VALIDATEUR_DEFINITIF`: projects, financing, final validation,
  decaissement.
- `AGENT_VERIFICATEUR`: prevalidation.
- `AGENT_SAISIE`: activity and expense entry.

## Donnees de demonstration

- UNICEF.
- Programme Redevabilite.
- Funding envelope, funds received, budget line, project, activity, expense,
  justificatif, timeline entries, alerts, dashboard KPIs, CSV/XLSX reports.

## Scenario principal - UNICEF

1. `ADMIN_PLATEFORME` invites or confirms the demo users and assigns production roles.
2. `ADMIN_PLATEFORME` assigns UNICEF to the users who should see the scenario.
3. `VALIDATEUR_DEFINITIF` creates or confirms the UNICEF funding envelope.
4. `VALIDATEUR_DEFINITIF` records funds received and attaches proof.
5. `VALIDATEUR_DEFINITIF` creates an MJL project inside the workspace.
6. `VALIDATEUR_DEFINITIF` allocates a budget line to the project.
7. `AGENT_SAISIE` creates an activity under the project.
8. `AGENT_SAISIE` submits the activity for prevalidation.
9. `AGENT_VERIFICATEUR` prevalidates the activity.
10. `VALIDATEUR_DEFINITIF` validates the activity definitively.
11. `AGENT_SAISIE` updates physical execution rate and actual dates.
12. `AGENT_SAISIE` creates an expense with a justificatif.
13. `AGENT_SAISIE` submits the expense for prevalidation.
14. `AGENT_VERIFICATEUR` prevalidates the expense.
15. `VALIDATEUR_DEFINITIF` validates the expense definitively.
16. `VALIDATEUR_DEFINITIF` marks the expense as decaisse.
17. The dashboard shows updated activity, financial, validation, and disbursement indicators.
18. The object timeline shows decisions, comments, and document activity.

## Scenario d'isolation - Programme Redevabilite

1. `ADMIN_PLATEFORME` assigns a user only to Programme Redevabilite.
2. The user opens the Partenaires / Programmes workspace.
3. The user opens dashboards, alerts, reports, documents, and timelines.
4. The user attempts direct navigation or filtered URLs for UNICEF data.
5. `ADMIN_PLATEFORME` opens the same areas with unrestricted visibility.

Expected result: the Programme Redevabilite user sees only assigned data or
empty results for unassigned filters, while Admin can see all scopes and
diagnostics.

## Points a montrer

- Partenaires / Programmes.
- One global role plus one or many assigned scopes.
- No public registration.
- No self-prevalidation, no self-final-validation, no self-disbursement.
- Valide definitivement and Decaisse as separate states.
- Contextual uploads and guarded downloads.
- Contextual timeline/exchanges inside detail pages.
- Scoped alerts, dashboards, and reports.

## Exports a produire

- CSV activity tracking or financial execution export.
- XLSX expense/disbursement or workflow decision export.
- Show stable filename, French headers, and server-side filters.

## Questions a poser au client

- Are the permission matrix and role labels approved?
- Are dashboard KPI labels and formulas approved?
- Are report/export columns, ordering, and wording approved?
- Are alert thresholds approved?
- Are final report templates approved?

## Points a ne pas promettre pendant la demonstration

- Production SMTP.
- Final public URL.
- Production secrets.
- Backup/restore.
- Monitoring/log retention.
- PDF/Word reports.
- SMS.
- OCR.
- Bank API.
- Public partner portal.
- Offline mode.

## Criteres de reussite de la demonstration

- The client can follow the full UNICEF path from funding to export trace.
- Programme Redevabilite isolation is visible and understandable.
- Workflow, permissions, dashboard, report, and business validation questions
  are captured as client decisions.
- No production release readiness or client approval is claimed prematurely.
