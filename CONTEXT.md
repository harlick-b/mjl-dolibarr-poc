# MJL Dolibarr POC Context

This file is the project memory layer for durable, repo-confirmed facts. It
summarizes product and technical context without replacing detailed evidence in
`docs/`.

## Project purpose

This repository is a Dolibarr proof of concept for the Ministry of Justice and
Legislation (MJL). The POC tests whether Dolibarr can support an internal web
workspace for externally funded project monitoring.

Confirmed goals:

- trace projects and activities;
- follow expenses and supporting documents;
- support hierarchical review;
- preserve decision history and audit evidence;
- provide DPAF-level visibility;
- produce Excel-readable reports and exports;
- show alerts for deadlines, pending reviews, and document issues.

Confirmed non-goals for the current POC:

- full accounting ERP replacement;
- public registration;
- SMS, bank API, OCR, external partner portal, offline mode, dynamic report
  builder, payroll, procurement, or AI reporting.

## Runtime and deployment assumptions

- Local runtime uses Docker Compose.
- `docker-compose.yml` runs Dolibarr `23.0.2` with MariaDB `11`.
- Dolibarr is exposed locally on `http://127.0.0.1:8080/`.
- The custom module lives under `custom/mjlfinancement`.
- The module declaration reports version `0.9.0`.
- The module requires Dolibarr `23.0.x` and PHP `7.4+`.
- Dolibarr documents are mounted under `./data/documents`.
- The custom module is mounted into the container at `/var/www/html/custom`.
- Production deployment documentation requires persistent database and document
  storage, backup/restore procedures, schema audits, and guarded document
  access.

## User roles

The confirmed production business roles are:

- `AGENT_SAISIE`: operational creation, submission, correction, supporting
  documents, and follow-up for assigned Partenaires / Programmes.
- `AGENT_VERIFICATEUR`: verification, correction requests, invalidation, and
  prevalidation for assigned Partenaires / Programmes.
- `VALIDATEUR_DEFINITIF`: final business validation, rejection, closure, and
  disbursement decisions for assigned Partenaires / Programmes.
- `ADMIN_PLATEFORME`: platform administration, user access, invitations, and
  configuration.

A user has one global business role and may be assigned to one or many
Partenaires / Programmes. Admin plateforme and Validateur definitif are
separate concepts; a person may hold platform admin rights and also have the
business validation role, but those responsibilities remain distinct.

The legacy POC role simulation (`AGENT`, `SUPERVISEUR_N1`, `SUPERVISEUR_N2`,
`DPAF`, `ADMIN`, and `LECTEUR`) remains relevant only for migration and
backward compatibility until replaced.
`LECTEUR` has no approved production role equivalent yet and remains an
unresolved legacy read-only profile.

## Core domain entities

Native Dolibarr concepts are reused where they fit:

- Partenaire / Programme: user-facing name for the partner/programme scope,
  represented technically by native Third Party.
- Project: native Project.
- Users, groups, and permissions: native Dolibarr users/groups/rights.
- Supporting documents: native ECM/documents.
- Exports: MJL custom reports with Dolibarr export helpers where safe.

Current MJL custom objects:

- `MjlConvention`: convention/funding-envelope candidate linked to partner,
  project, dates, amount, currency, and status.
- `MjlActivity`: activity tracking and lifecycle workflow.
- `MjlBudgetLine`: budget allocation and execution tracking.
- `MjlFundReceipt`: received/not-received funding trace with proof documents.
- `MjlExpense`: expense workflow, budget impact, and document validation.
- `MjlValidation`: expense validation history.
- `MjlWorkflowAction`: generic workflow and field-change audit.
- `MjlExchangeLog`: queryable exchange/comment trace.
- `MjlReport`: fixed report definitions.

`MjlConvention` is the current funding-envelope model. `MjlMissionEnvelope` is
not implemented and should remain deferred unless confirmed business rules
prove the convention model insufficient.

## Business rules

- MJL-specific implementation must remain outside Dolibarr core files.
- User-facing labels and content are French-first.
- Access is invitation-only.
- Only Admin can send invitations for now.
- Public registration is forbidden.
- Active Dolibarr entity filtering is required for custom objects, dashboards,
  alerts, exports, audit lists, workflow lookups, and document lookups.
- No-self-validation is a domain rule and must not depend only on hidden UI.
- Workflow status is distinct from computed alert state.
- `Échéance proche` and `En retard` are computed from activity dates and
  completion/cancellation state.
- Audit history should show actor, actor role, action date, from/to status,
  reason/comment when relevant, and important changed values.
- Supporting documents are stored through ECM and exposed through guarded MJL
  routes rather than raw public document links.
- Official exports should be French-labeled and Excel-readable.

## Permissions and visibility

Confirmed visibility patterns:

- Sidebar/navigation visibility is capability-based, not raw read-right based.
- DPAF/Admin-only surfaces include supervision dashboards, report/export center,
  governed convention management, budget-line management, and fund-receipt
  management.
- Advanced audit and exchange-log surfaces are guarded and should not be normal
  operational navigation.
- Invitation acceptance and guarded document-download routes are contextual
  helper routes, not sidebar destinations.
- Normal MJL business users should work through MJL screens rather than raw
  native Dolibarr menus.
- Direct URL and direct POST guards are required; hiding links is not enough.

## Key workflows

- Invitation and first access: Admin sends invitation, user opens token link,
  defines password, account becomes active, and lifecycle is audited.
- Activity lifecycle: create, update production execution fields, upload
  documents, submit, request correction, correct/resubmit, prevalidate as
  `AGENT_VERIFICATEUR`, final-validate as `VALIDATEUR_DEFINITIF`, reject, and
  cancel/complete where applicable, with timeline/audit evidence.
- Expense lifecycle: create draft, upload supporting document, submit, validate
  or reject, correct/resubmit, with budget checks and validation history.
- Documents: upload from contextual object pages, store in ECM, download only
  through guarded MJL document routes.
- Finance/reference management: DPAF/Admin manage conventions, budget lines,
  and fund receipts through governed MJL screens.
- Reporting: DPAF/Admin use fixed MJL report/export center with server-side
  filters and stable filenames.
- Alerts: users see role-scoped actionable alerts for deadlines, pending
  reviews, and missing/unavailable documents.

## Integrations

- Native Dolibarr modules used by the POC include third parties, projects,
  ECM/documents, exports, users/groups, and module activation/update behavior.
- Documents rely on Dolibarr ECM storage and MJL object-level access helpers.
- XLSX output is allowed only through existing safe Dolibarr helpers or
  dependencies already present.
- Email/invitation/password-reset behavior exists in the custom module, but
  production email transport and base URL settings are not finalized.

## Terminology and glossary

| Term | Meaning |
| --- | --- |
| MJL | Ministry of Justice and Legislation |
| Partenaire / Programme | User-facing partner/programme scope, represented technically by native Dolibarr third party |
| PTF / bailleur | Legacy POC wording for funding partner; avoid in normal production UI |
| Projet | Native Dolibarr project exposed through MJL context where possible |
| Convention | Current MJL funding-envelope object |
| Activité | Operational activity under project/convention |
| Ligne budgétaire | Budget allocation line |
| Fonds reçu | Funding receipt linked to convention/project/PTF |
| Dépense | Expense linked to project, convention, optional activity, and budget line |
| Pièce justificative | Supporting document stored in ECM |
| DPAF | Supervision/finance-level profile for dashboards and reports |
| Historique / audit | Trace of decisions, status changes, actors, comments, and dates |

## Known constraints

- Dolibarr core files are out of scope.
- The current module is not production-ready `1.0.0`.
- Production readiness is evidence-gated and currently blocked by client and
  deployment decisions.
- Browser E2E tests are the primary validation method for UI, auth, dashboards,
  exports, official outputs, and workflow changes.
- Final production wording and donor-specific official outputs are not yet
  confirmed.

## Needs confirmation

- Final production permission matrix details for every route/action.
- Final donor report canevas and official output columns.
- Production email transport, public/base URL, and secrets configuration.
- Budget-line close/deactivation lifecycle policy.
- Document preview policy and final document ergonomics.
- Final client-approved wording for production screens and official outputs.
