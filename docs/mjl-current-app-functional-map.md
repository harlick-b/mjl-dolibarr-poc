# MJL Current App Functional Map

This file is current-state evidence only. It does not override
'docs/mjl-authoritative-decisions.md'.

## Executed Phase 1 state

The local tenant contains exactly one preserved native technical
administrator and no persistent business, invitation, reset, role, scope, or
audit rows. Module version 0.16.0 depends on native Third Parties and Projects.
MJL-specific code remains under 'custom/mjlfinancement'.

| Surface | Current behavior |
| --- | --- |
| Accueil | Role-projected static Phase 1 landing; no finance aggregates. |
| Partenaires, Projets, Types d’Opération | Same-entity business-role reads; Validator-only activation/deactivation and mutation. |
| Activities | RST-006A source implements the entity-scoped list/create/detail/edit/review aggregate, Activity-scoped Opérations, assignments, abandonment/restoration, immutable revisions, and exact-revision review. Shared cutover remains pending and the route stays absent from navigation until RST-009B. |
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
- 'llx_mjlfinancement_user_soc_scope' (retained empty; non-authoritative)
- 'llx_mjlfinancement_activity' (interim read-only projection)
- RST-003 reference tables

No legacy group membership participates in MJL authorization. Native Admin
status derives ADMIN_PLATEFORME; business roles are stored only for non-admin,
same-entity users.
