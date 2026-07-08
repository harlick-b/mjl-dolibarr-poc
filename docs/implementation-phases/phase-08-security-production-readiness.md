# Phase 8 - Security And Production Readiness Gate

## Goal

Run the production security and readiness gate after the main functional
surfaces have been converted.

## Scope

- Review authentication, authorization, role checks, partner/programme scope,
  CSRF, input handling, SQL safety, XSS, redirects, uploads, downloads,
  no-self-validation, and audit events.
- Verify native Dolibarr route guard behavior for normal MJL users.
- Add an Admin-only production readiness page or CLI script.
- Check required configuration without exposing secrets.

## Verification

- Security-focused direct URL and POST checks.
- Readiness check reports missing config clearly.
- Runtime guard limitations are documented.

