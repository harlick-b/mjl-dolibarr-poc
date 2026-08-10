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

## Gated Modules

### Phase 4: contextual document management

Implementation is blocked until the client approves categories, entity links,
required documents, permissions, versions, replacement, cancellation,
retention, size, formats, and workflow dependencies. Existing guarded storage
and download code is current-state evidence, not approved Phase 4 behavior.

### Phase 5: accounting entries

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

Phase 3C decides only whether core scope is ready for integration. The client
and project owner decide which gated phases are mandatory before launch. No
Codex verdict authorizes production deployment.
