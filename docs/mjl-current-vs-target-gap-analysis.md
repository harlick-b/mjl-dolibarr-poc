# MJL Current vs Target Gap Analysis

This file tracks implementation debt against
`docs/mjl-authoritative-decisions.md`. It is not the source of target
decisions.

## Summary

The repository contains a strong production-readiness base: production role and
scope tables, activity prevalidation/final validation, expense
prevalidation/final validation/disbursement, guarded documents, dashboards,
reports, exports, invitations, and audit helpers. Remaining gaps are mostly
terminology cleanup in code, contextual exchange/timeline polish, audit events
for downloads/exports, production permission finalization, deployment
configuration, and final client report templates.

## Gap Matrix

| Area | Current state | Target state | Status |
| --- | --- | --- | --- |
| Product stance | Repo and code still contain POC wording in bootstrap, sample data, module description, and local fixture names. | Production-ready MJL workspace inside Dolibarr. | Code/document wording debt. |
| Roles | Production role/scope tables and helpers exist; legacy POC groups still backfill and simulate fixtures. | One global role per user: Agent de saisie, Agent verificateur, Validateur definitif, Admin plateforme. | Partially implemented; legacy mapping remains. |
| Scope | User-to-partner scope helpers exist and fail closed in tested paths; some current-state docs were stale. | Non-admin access only to assigned Partenaires / Programmes; unresolved objects fail closed. | Implemented foundation; keep auditing each route. |
| Admin vs validation | Code has `ADMIN_PLATEFORME` and `VALIDATEUR_DEFINITIF`, but UI/code labels still use DPAF/Admin in places. | Platform admin and business final validation are distinct concepts. | Terminology debt. |
| Projects | MJL project list/detail and partner pages exist; project creation/editing inside MJL needs current runtime verification. | Admin plateforme and Validateur definitif can create/edit projects inside MJL. | Review required. |
| Documents | Contextual uploads and guarded downloads exist for key objects; global Documents is read-only. | Contextual uploads, guarded downloads, upload/download audit. | Download audit remains debt. |
| Exchanges | Standalone exchange log route exists and is hidden from primary navigation. | Contextual timelines/exchanges inside object detail pages; global search/audit only under Supervision/Audit. | Contextual UX debt. |
| Reports/exports | CSV/XLSX exports exist with French headers and stable filenames in code. | CSV/XLSX only, UTF-8 BOM semicolon CSV, server-side filters, audited exports. | Export audit and final templates remain debt. |
| Production config | Deployment docs exist but email/base URL/secrets remain unconfirmed. | Production tenant configured with secrets, email transport, base URL, storage, backup/restore. | Deployment blocker. |
| Current-state evidence | `docs/mjl-current-app-functional-map.md` refreshed during cleanup. | Evidence docs describe code without overriding target decisions. | Active. |

## Code-Level Conflicts Not Fixed In Documentation Cleanup

- `bootstrap_poc.php`, sample-data CSVs, SQL migrations, and local fixture names
  use POC and legacy role terms for compatibility.
- Some PHP UI labels/routes still use `DPAF`, `Conventions`, `Depenses`, or
  `Echanges`.
- Module language/descriptor strings still say POC.
- Sample document placeholders say POC.

These are classified in `docs/mjl-stale-reference-audit.md`; they are not fixed
in this documentation-only task.
