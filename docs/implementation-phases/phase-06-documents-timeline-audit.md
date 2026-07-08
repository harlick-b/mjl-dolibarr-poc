# Phase 6 - Documents, Timeline, Exchanges, Audit

## Goal

Harden contextual documents and expose object-level timelines without turning
exchanges into a primary top-level workflow.

## Scope

- Keep global Documents read-only.
- Keep contextual uploads only.
- Keep guarded downloads only.
- Add `document_downloaded` audit.
- Add a reusable contextual timeline helper.
- Reuse workflow actions and exchange logs where possible.
- Scope all document and timeline queries by Partenaire / Programme.

## Verification

- Scoped document list E2E.
- Unauthorized direct document access fails.
- Guarded download works and creates audit.
- Timeline shows comments, decisions, document events, and status changes.

