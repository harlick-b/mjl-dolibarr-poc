# MJL Production Readiness Plan

This plan defines how production readiness is evaluated. Target decisions come
from `docs/mjl-authoritative-decisions.md`; current implementation evidence
comes from `docs/mjl-current-app-functional-map.md`.

## Readiness Rule

A feature is production-ready only when route guards, direct POST guards, data
behavior, tests, documentation, and skipped-check notes support that claim.

Use these statuses:

- `ready`: all acceptance criteria and verification checks passed.
- `partial`: implemented or partly verified, with remaining gaps.
- `blocked`: missing decision, dependency, or failed check prevents safe
  production use.
- `out_of_scope`: explicitly excluded from the current phase.

## Non-Negotiable Gates

- Dolibarr core files are untouched.
- Active entity filtering remains present.
- Every new or touched POST action has CSRF protection.
- Every new or touched user input is sanitized and escaped on output.
- Navigation hiding is paired with server-side direct URL and POST guards.
- Documents are uploaded contextually and downloaded through guarded MJL routes.
- Exports are server-filtered and audited when export audit is implemented.
- No public registration is added.
- Sample/default passwords remain local development/test behavior only.

## Migration Policy

- Migration filenames follow the module version they introduce.
- Migrations must be non-destructive and idempotent where possible.
- Backfills must log unresolved records instead of silently granting broad
  access.
- The module stays below `1.0.0` until every in-scope production row is ready.

## Verification Policy

Use the smallest sufficient verification per change, then expand when workflow,
security, documents, schema, exports, or UI are touched.

Expected checks include:

- PHP syntax checks for touched PHP files.
- Relevant schema audit scripts for schema changes.
- Relevant smoke scripts for workflow/document/export changes.
- `npm run test:e2e` for app UI, auth, dashboards, exports, official outputs,
  and workflow changes.
- Documentation diff/status for documentation-only phases.

Unavailable commands must be reported explicitly.

## Current Readiness Summary

- `ready`: no full production release claim yet.
- `partial`: workspace, role/scope foundation, activities, expenses,
  disbursement, guarded documents, dashboards, reports, exports, invitations,
  and audit helpers.
- `blocked`: final client permission matrix, official report templates,
  production email/base URL/secrets, and deployment rehearsal.
- `out_of_scope`: public registration, PDF/Word reports, full accounting ERP,
  payroll, procurement, bank API, SMS, OCR, external portal, offline mode, and
  AI reporting.
