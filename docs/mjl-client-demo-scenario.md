# MJL Client Demo Scenario

Target decisions come from `docs/mjl-authoritative-decisions.md`. This scenario
is for client-facing feature validation, not production deployment closure.

Status: `PENDING_CLIENT_VALIDATION`.

## Scenario A: UNICEF Funding To Export Trace

Purpose: demonstrate one complete, audited monitoring path from external
funding to execution reporting.

1. `ADMIN_PLATEFORME` invites the demo users and assigns production roles.
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
17. The dashboard shows updated activity, financial, validation, and
    disbursement indicators.
18. The reports center exports CSV and XLSX outputs for activity, financial
    execution, expense/disbursement, and workflow history.
19. The object timelines and audit screens show decisions, comments, document
    activity, and export audit rows.

Expected result: the client can follow the full path without native Dolibarr
business screens, raw ECM links, public registration, PDF/Word reports, or
cross-scope leakage.

## Scenario B: Programme Redevabilite Scope Isolation

Purpose: prove assigned-scope isolation.

1. `ADMIN_PLATEFORME` assigns a user only to Programme Redevabilite.
2. The user opens the Partenaires / Programmes workspace.
3. The user opens dashboards, alerts, reports, documents, and timelines.
4. The user attempts direct navigation or filtered URLs for UNICEF data.
5. `ADMIN_PLATEFORME` opens the same areas with unrestricted visibility.

Expected result: the Programme Redevabilite user sees only assigned data or
empty results for unassigned filters, while Admin can see all scopes and
diagnostics.

## Demonstration Notes

- Use French labels during the demo.
- Keep `ADMIN_PLATEFORME` and `VALIDATEUR_DEFINITIF` distinct.
- Treat final validation and disbursement as separate decisions.
- Do not present the permission matrix or report columns as client-approved
  final templates until the client confirms them.
- Do not claim production release readiness during this demo.
