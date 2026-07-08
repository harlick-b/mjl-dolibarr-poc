# MJL Dolibarr Context

This file records durable product and domain vocabulary. Target decisions live
in `docs/mjl-authoritative-decisions.md`; if this file conflicts with that
authority, update this file.

## Project Purpose

The MJL app is a production-target custom workspace inside Dolibarr for
monitoring externally funded Ministry of Justice and Legislation projects.
Dolibarr provides authentication, users/groups/rights, third parties, projects,
ECM/documents, and export support. MJL-specific behavior stays in the custom
module and documented supporting areas.

Confirmed goals:

- trace projects and activities;
- follow expenses, disbursements, and supporting documents;
- support verification, final validation, and audit history;
- provide supervised portfolio visibility;
- produce French, Excel-readable CSV/XLSX reports and exports;
- show scoped alerts for deadlines, pending reviews, budget risk, and document
  issues.

Confirmed non-goals for the current production-readiness phase:

- full accounting ERP replacement;
- public registration;
- SMS, bank API, OCR, external partner portal, offline mode, dynamic report
  builder, payroll, procurement, PDF reports, Word reports, or AI reporting.

## Runtime And Deployment Assumptions

- Local runtime uses Docker Compose.
- `docker-compose.yml` runs Dolibarr `23.0.2` with MariaDB `11`.
- Dolibarr is exposed locally on `http://127.0.0.1:8080/`.
- The custom module lives under `custom/mjlfinancement`.
- The module declaration reports version `0.10.0`.
- The module requires Dolibarr `23.0.x` and PHP `7.4+`.
- Dolibarr documents are mounted under `./data/documents`.
- Production deployment requires persistent database/document storage,
  backup/restore procedures, schema audits, guarded document access, and
  production secrets/email/base-URL configuration outside source control.

## Language

**Partenaire / Programme**:
User-facing partner/programme scope for MJL data access and reporting,
represented technically by native Dolibarr third parties.
_Avoid_: Bailleurs / Programmes, Tiers in normal UI, PTF in production UI.

**Projet**:
Native Dolibarr project exposed through MJL workspace screens.
_Avoid_: raw native project screens for normal MJL business users.

**Convention**:
Current MJL funding-envelope object linked to a partner/programme, project,
dates, amount, currency, and status.
_Avoid_: MjlMissionEnvelope unless future business rules prove it necessary.

**Activite**:
Operational activity under a project/convention with physical execution,
documents, and staged validation.
_Avoid_: task when referring to MJL business workflow; task is a native
Dolibarr technical object.

**Ligne budgetaire**:
Budget allocation and execution tracking line.

**Fonds recu**:
Funding receipt trace linked to a convention/project/partner with proof
documents and received/not-received lifecycle.

**Depense**:
Expense linked to project, convention, optional activity, budget line,
supporting document, staged validation, and possible disbursement.

**Piece justificative**:
Supporting document stored in ECM and served only through guarded MJL routes.

**Prevalidation**:
Verifier decision that accepts a submitted activity or expense before final
business validation.

**Validation definitive**:
Final business decision approving an activity or expense.

**Decaissement**:
Record that money actually moved for a final-validated expense.

**Admin plateforme**:
Technical/platform administration responsibility for access, invitations, and
configuration.
_Avoid_: treating Admin plateforme as the same concept as final business
validation.

**Validateur definitif**:
Business role responsible for final validation and disbursement decisions.

**Historique / audit**:
Trace of decisions, status changes, actors, comments, dates, important changed
values, exports, document uploads, and expected document downloads.

## Roles

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
separate concepts; one person may hold both powers.

Legacy role terms are migration-only vocabulary:

- `AGENT` maps to `AGENT_SAISIE`.
- `SUPERVISEUR_N1` maps to `AGENT_VERIFICATEUR`.
- `SUPERVISEUR_N2` maps to `AGENT_VERIFICATEUR` unless explicitly migrated
  otherwise.
- `DPAF` maps to `VALIDATEUR_DEFINITIF` or `ADMIN_PLATEFORME` depending user
  intent.
- `LECTEUR` has no approved production role equivalent.

## Business Rules

- MJL-specific implementation must remain outside Dolibarr core files.
- User-facing labels and content are French-first.
- Access is invitation-only.
- Only Admin can send invitations for now.
- Public registration is forbidden.
- Active Dolibarr entity filtering is required for custom objects, dashboards,
  alerts, exports, audit lists, workflow lookups, and document lookups.
- Non-admin users can access only data connected to assigned Partenaires /
  Programmes.
- If an object cannot resolve to a Partenaire / Programme, only Admin can
  access it until the data is fixed.
- UI hiding is not access control; direct URL and POST guards are required.
- No-self-prevalidation, no-self-final-validation, and no-self-disbursement are
  mandatory unless a future audited override is explicitly designed.
- Workflow status is distinct from computed alert state.
- Supporting documents are stored through ECM and exposed through guarded MJL
  routes rather than raw public document links.
- Global Documents remains read-only; uploads are contextual.
- Official exports are French-labeled, Excel-readable, server-filtered,
  audited, and stable in filename/format.

## Current MJL Custom Objects

- `MjlConvention`
- `MjlActivity`
- `MjlBudgetLine`
- `MjlFundReceipt`
- `MjlExpense`
- `MjlValidation`
- `MjlWorkflowAction`
- `MjlExchangeLog`
- `MjlReport`

## Needs Confirmation

- Final client-approved route/action permission matrix.
- Final donor report canevas and official output columns.
- Production email transport, public/base URL, and secrets configuration.
- Budget-line close/deactivation lifecycle policy.
- Document preview policy and final document ergonomics.
- Final client-approved wording for production screens and official outputs.
