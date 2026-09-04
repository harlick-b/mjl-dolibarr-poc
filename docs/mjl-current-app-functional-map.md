# MJL Current App Functional Map

This file is current-state evidence only. It does not override
'docs/mjl-authoritative-decisions.md'.

## Executed Phase 2 state

The local tenant contains exactly one preserved native technical
administrator and no persistent business, invitation, reset, role, scope, or
audit rows. Module version 0.19.0 depends on native Third Parties and Projects.
MJL-specific code remains under 'custom/mjlfinancement'.
DEC-053 permits Phase 3 development under `PHASE_2_READY_WITH_NOTES`; the
unsigned human accessibility review remains a production/release blocker.

| Surface | Current behavior |
| --- | --- |
| Accueil | Role-projected static Phase 1 landing; no finance aggregates. |
| Partenaires, Projets, Types d’Opération | Same-entity business-role reads; Validator-only activation/deactivation and mutation. |
| Activities | Active entity-scoped list/create/detail/edit/review aggregate with assignments, immutable revisions, exact-revision review, fixed pagination, and sanitized chronology. |
| Opérations | Active read-only 50-row planning list; Agent current-assignment scope, Supervisor/Validator active-entity portfolio, Admin denied. |
| Audit | Entity-filtered read of the immutable audit event table for Validator and native Admin. |
| Utilisateurs et accès | Native-Admin-only invitation, role change, deactivation, and revocation. |
| Administration technique | Native-Admin link to Dolibarr module administration. |
| Invitation/reset | Public selector in the query string, secret verifier in the fragment, hash-only storage, same-origin POST redemption, single use, expiry, throttling, CSRF, transaction/audit coupling, and neutral reset-request response. |
| Finance, reports, validations, exchanges | Routes, classes, loaders, schema, historical update SQL, and obsolete tests removed. |
| Documents | MJL `documents.php` and `documentdownload.php` return dependency-free HTTP 403 for every actor/method; Apache blocks `/ecm/*`, `/document.php`, and `/viewimage.php`. Native ECM storage remains dormant and unchanged. |
| Alerts and old supervision | Retained containment routes return explicit 403 pending their approved target units. |

## Persistent custom tables in the touched boundary

- 'llx_mjlfinancement_audit_event' (append-only through database triggers)
- 'llx_mjlfinancement_invitation'
- 'llx_mjlfinancement_password_reset'
- 'llx_mjlfinancement_user_role'
- 'llx_mjlfinancement_activity' and 'llx_mjlfinancement_activity_assignment' (empty RST-006A target)
- 'llx_mjlfinancement_operation', 'llx_mjlfinancement_activity_revision',
  'llx_mjlfinancement_revision_contributor', and
  'llx_mjlfinancement_review_decision' (empty RST-006A targets)
- 'llx_mjlfinancement_operation_type' (empty RST-003 reference table)

No legacy group membership participates in MJL authorization. Native Admin
status derives ADMIN_PLATEFORME; business roles are stored only for non-admin,
same-entity users.
