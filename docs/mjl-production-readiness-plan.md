# MJL Production Readiness Plan

This document defines how production readiness will be earned during the
phase-by-phase refactor. It complements
`docs/mjl-financement-production-readiness.md`; it does not replace that
evidence matrix.

## Readiness rule

A phase is not production-ready because code was written. It is ready only when
its route guards, data behavior, tests, documentation, and skipped-check notes
support that claim.

Use these statuses:

- `implemented` - code/docs for the phase exist, but production evidence may be
  incomplete.
- `partial` - some acceptance criteria are implemented or verified, but gaps
  remain.
- `blocked` - a missing decision, dependency, or failed check prevents safe
  progress.
- `ready` - all phase acceptance criteria and verification checks passed.

## Non-negotiable gates

- Dolibarr core files are untouched.
- Active entity filtering remains present.
- Every new or touched POST action has CSRF protection.
- Every new or touched user input is sanitized and escaped on output.
- Navigation hiding is paired with server-side direct URL and POST guards.
- Documents are uploaded contextually and downloaded through guarded MJL routes.
- Exports are server-filtered and audited when export audit is implemented.
- No public registration is added.
- Sample/default passwords remain dev-only and are never production behavior.

## Migration policy

- The first production-role/scope phase uses `update_0.8.0.sql` and bumps the
  module to `0.8.0`.
- Later migration filenames follow the module version they introduce.
- Migrations must be non-destructive and idempotent where possible.
- Backfills must log unresolved records instead of silently granting broad
  access.
- The module stays below `1.0.0` until every in-scope production row is ready.

## Verification policy

Use the smallest sufficient verification per phase, then expand when workflow,
security, documents, schema, exports, or UI are touched.

Expected checks include:

- PHP syntax checks for touched PHP files.
- Relevant schema audit scripts for schema changes.
- Relevant smoke scripts for workflow/document/export changes.
- `npm run test:e2e` for app UI, auth, dashboards, exports, official outputs,
  and workflow changes.
- Documentation diff/status for documentation-only phases.

Unavailable commands must be reported explicitly.

## Phase completion record

Every phase file in `docs/implementation-phases/` must be updated with:

- files changed;
- schema changes;
- migration/backfill notes;
- verification commands and results;
- skipped checks and reasons;
- known limitations;
- whether the phase is implemented, partial, blocked, or ready.

