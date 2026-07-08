# MJL Target Client Specification

This document records the target behavior for converting the MJL Dolibarr POC
into a production-ready MJL workspace. It is a planning contract, not evidence
that the behavior has already been implemented.

## Product target

The workspace supports partner/programme-funded project execution, financial
traceability, activity tracking, expense and disbursement validation,
supporting documents, decisions, exchanges, dashboards, and audit-ready
CSV/XLSX exports.

The implementation remains a Dolibarr custom module. Dolibarr provides
authentication, users/groups/rights, third parties, projects, ECM/documents,
and export support. MJL-specific behavior stays in the custom module and
documented supporting areas.

## Binding terminology

- User-facing label: `Partenaires / Programmes`.
- Technical Dolibarr object: `llx_societe`.
- User-facing funding label: `Enveloppes de financement`.
- User-facing expense label: `Depenses / Decaissements`.
- Do not use `Tiers` in normal user-facing labels except where unavoidable in
  technical/admin documentation.

## Production roles

Use one global business role per user:

- `AGENT_SAISIE` - Agent de saisie
- `AGENT_VERIFICATEUR` - Agent verificateur / prevalidateur
- `VALIDATEUR_DEFINITIF` - Validateur definitif
- `ADMIN_PLATEFORME` - Admin plateforme

A user can be assigned to one or many Partenaires / Programmes. Admin sees all
Partenaires / Programmes, but Admin plateforme and Validateur definitif remain
separate concepts in code, permissions, UI, audit, and documentation.

## Scope model

- Non-admin users see only assigned Partenaires / Programmes.
- Admin sees all Partenaires / Programmes.
- Every custom business query must be filtered by active Dolibarr entity.
- Every non-admin object access must resolve to an assigned Partenaire /
  Programme.
- If an object cannot resolve to a Partenaire / Programme, non-admin access
  fails closed until the data is fixed.

## Workflow target

Final validation and disbursement are separate:

- Final validation means the business decision is approved.
- Disbursement means money has actually moved.

No self-prevalidation, self-final-validation, or self-disbursement is allowed
in production v1.

## Outputs and documents

- Reports are CSV/XLSX only in this phase.
- CSV exports must include UTF-8 BOM, semicolon separator, French headers, and
  stable filenames.
- Global Documents remains read-only.
- Uploads are contextual.
- Downloads must use guarded MJL routes, never raw public ECM paths.

## Out of scope

Do not implement SMS, OCR, bank API, public partner portal, offline mode,
public registration, PDF reports, or Word reports in this production-readiness
phase.

