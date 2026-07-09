# MJL Dashboard KPI Model

Target decisions come from `docs/mjl-authoritative-decisions.md`.

Status: `PENDING_CLIENT_VALIDATION`.

This document records the Phase 10R dashboard/KPI model for UAT. Final KPI
wording and permission exposure still require client approval.

## Shared Dashboard Rules

- Dashboard cards, queues, tables, and filters apply active Dolibarr entity.
- Non-admin users see only assigned Partenaires / Programmes.
- Tampered filters for unassigned scope fail closed to empty or zeroed results.
- Filters include Partenaire / Programme, project, period, and semantic status
  buckets where relevant.
- KPI formulas should match report and partner/project detail formulas.

## Role Dashboards

| Role | Primary dashboard focus | Expected queues and indicators |
| --- | --- | --- |
| AGENT_SAISIE | Operational entry and follow-up. | Assigned activities, corrections, physical execution follow-up, expenses to complete, document issues. |
| AGENT_VERIFICATEUR | Review and prevalidation. | Activities and expenses to prevalidate, correction requests, overdue review work. |
| VALIDATEUR_DEFINITIF | Business decision and disbursement. | Final-validation queues, final-validated-not-disbursed expenses, budget execution, financial risk. |
| ADMIN_PLATEFORME | Platform administration and diagnostics. | User/access tasks, global visibility, unresolved-data diagnostic, audit and supervision shortcuts. |

## KPI Families

| KPI family | Meaning | Scope behavior |
| --- | --- | --- |
| Activity status | Counts submitted, prevalidated, final validated, corrected, late, and physically executed activities. | Project/convention partner scope applies. |
| Expense workflow | Counts submitted, prevalidated, final validated, rejected/corrected, and disbursed expenses. | Expense project/convention scope applies. |
| Financial execution | Tracks allocated, submitted, prevalidated, final validated, disbursed, remaining, validation rate, and execution rate. | Budget/project/partner scope applies. |
| Alerts | Shows deadline, missing document, pending validation, budget, and validated-not-disbursed risks. | Alert target object scope applies. |
| Audit and timeline | Shows recent resolvable workflow/audit activity. | Unsupported or unresolved targets are hidden from non-admin users. |
| Admin diagnostics | Shows unresolved-data counts. | Admin-only. |

## UAT Expectations

- Each role sees action-oriented work, not global counts leaking another scope.
- Admin and Validateur definitif remain distinct: platform administration is
  not the same as business validation.
- Final validation and disbursement are visible as separate states.
- Dashboard filters must align with reports and detail pages.
- The Admin unresolved-data indicator is diagnostic; it does not convert
  unresolved objects into normal non-admin visibility.

## Pending Client Validation

- Final KPI labels and training wording.
- Final dashboard permission exposure by role.
- Final thresholds for client-specific risk language, if different from the
  current computed alert defaults.
