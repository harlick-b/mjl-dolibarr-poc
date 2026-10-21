# MJL Scope Boundary v2

## Core Entry Point

The application begins after an Activity has already been agreed with the
Partenaire. It does not model negotiation or approval of the upstream PTA.

## Core Scope Through Phase 3C

- Partenaire and Projet reference data.
- Activity and Opération planning.
- Activity Agent assignments.
- Immutable submission revisions.
- Prevalidation, definitive validation, correction, and resubmission.
- Authorized and spent amount monitoring.
- Opération execution, completion, cancellation, and reopening.
- Derived Activity execution status and financial completeness.
- Append-only structured audit and human-readable timelines.
- Dashboards, monitoring, notifications, and operational exports.
- PDF and XLSX outputs plus supplemental audited CSV.
- Authentication, invitations, authorization, concurrency, and readiness hardening.

Core implementation exists against an empty persistent tenant after the
clean reset; user acceptance remains outstanding. Persistent demonstration
data is not part of Phases 1 through 6. Test-only records may exist solely inside disposable test tenants.

## REST API Direction (DEC-078)

The API becomes the backend foundation for web/PWA clients, with all available
MJL actions exposed and login plus OTP. The existing interface migrates
progressively as each feature is delivered. Scope includes MJL business
features, invitations/access administration, dashboards, audit and exports.
Native Dolibarr technical administration, installed native mobile clients and
external integrations are outside this delivery scope. Approved session limits
are 24 hours of inactivity or 24 hours total, whichever comes first. Expiry
requires login plus email OTP again; no remembered-device option is included.
The current-action inventory and target wire contract are defined in
`mjl-rest-api-contract.md` and `mjl-rest-api.openapi.yaml`; DEC-080 implements authentication and Partenaires with JavaScript-required screens. Other adapters remain pending. This does not expand deferred feature scope or authorize
Dolibarr core modifications.

## Outside Core Scope

- PTA proposal, negotiation, or Partner approval.
- Fund requests and receipt-of-funds workflows.
- TDR approval and Partner authorization messages.
- e-Tresor payment execution.
- Bank reconciliation.
- External audit execution.
- Public registration or a public project register.
- Full accounting ERP replacement.
- Payroll, procurement, SMS, bank APIs, OCR, external portals, offline mode,
  dynamic report builders, and AI reporting.
- Migration, transformation, or compatibility preservation of existing POC
  users or business data.
- A persistent sample/demo dataset before every implementation phase is
  complete and its later dataset specification is approved.

## Gated Modules

### Phase 4: contextual document management

Phase 4 planning is requested. Its current planning contract is
`docs/mjl-phase4-contextual-document-management.md`. Runtime implementation is
not authorized: current document routes and native delivery paths remain
denied. The Admin document exception is read-only and non-mutating within the
runtime active entity (`$conf->entity`) only.

### Phase 5: accounting entries

Current spending records already count as accounting entries. Their explicit
approval by the Validateur définitif and post-approval immutability requirement applies now
(functional specification section 15, DEC-076); it is not deferred to Phase 5.
DEC-077 authorizes separate expense entries and their approval/correction
workflow now. Only approved expenses count in totals; completion requires
approved expenses or an explicit approved zero-spending declaration. Accounting
corrections remain permitted after completion/cancellation without reopening
or changing execution status.

Implementation is blocked until approved entry structure, accounts, journals,
budget codes, dates, roles, validation, correction, reversal, closing,
reconciliation, document dependencies, and real examples exist.

### Phase 6: official Partner reports

Implementation is blocked until approved UNICEF and Coopération Suisse
templates, periods, mappings, formulas, dependencies, output rules, versions,
approval, and regeneration behavior exist.

## Non-speculative Future Seams

Core objects must have stable identifiers, versions, audit references, and
immutable revisions so later modules can reference approved records. This
requirement does not authorize new document, accounting, or report schemas.

## Production Boundary

Disposable reconciliation and restore checks are development evidence only.
The user decides which gated phases are required before launch. Production preparation and readiness
assessment require a fresh explicit request.
