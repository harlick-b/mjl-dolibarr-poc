# MJL Current App Functional Map

This file is current-state evidence only. It does not override
'docs/mjl-authoritative-decisions.md'.

## Shared Phase 3B state

The local tenant contains exactly one preserved native technical
administrator and no persistent business, invitation, reset, role, scope, or
audit rows. The shared schema is at exact RST-012. Module version 0.20.0 depends on native Third Parties and Projects.
MJL-specific code remains under 'custom/mjlfinancement'.
DEC-057 records the guarded shared RST-012 cutover and
`PHASE_3B_READY_WITH_NOTES`. The unsigned human accessibility review does not
block local development or Phase 3C planning; it remains a production/release
blocker.

| Surface | Current behavior |
| --- | --- |
| Accueil | Active financial-first dashboard with role-projected totals, alerts, and permitted-action queues. |
| Partenaires, Projets, Types d’Opération | Same-entity business-role reads; Validator-only activation/deactivation and mutation. |
| Activities | Entity-scoped planning/review aggregate plus active derived execution status, financial completeness/totals, and guarded Activity cancellation request. |
| Opérations | Active 50-row execution list: current Assigned Agents enter explicit spending/observations and request exceptions; Supervisor/Validator read; Admin denied. |
| Demandes d’exception | Active bounded cancellation/reopening list with Agent withdrawal and Validator decision controls and Phase 3B navigation. |
| Activity chronology | Detail/review pages show sanitized execution, request, assignment, automatic-transition and single-Activity export summaries, with stable 50-event cursors. Active entity/current assignment remain enforced; Admin denied. Oversized or unavailable details remain explicit. |
| Audit | Entity-filtered read of the immutable audit event table for Validator and native Admin. |
| Utilisateurs et accès | Native-Admin-only invitation, role change, deactivation, and revocation. |
| Administration technique | Native-Admin link to Dolibarr module administration. |
| Invitation/reset | Public selector in the query string, secret verifier in the fragment, hash-only storage, same-origin POST redemption, single use, expiry, throttling, CSRF, transaction/audit coupling, and neutral reset-request response. |
| Legacy finance, reports, validations, exchanges | Obsolete implementations remain removed. |
| Activities / Operations / Fiche Activité / portfolio / audit reports | Active scoped `reports.php` previews and audited PDF/XLSX/CSV downloads require exact RST-012. Audit remains Validator/Admin only; business reports retain role and assignment scope. |
| Documents | MJL `documents.php` and `documentdownload.php` return dependency-free HTTP 403 for every actor/method; Apache blocks `/ecm/*`, `/document.php`, and `/viewimage.php`. Native ECM storage remains dormant and unchanged. |
| Alertes and old supervision | Active computed Alertes are derived from current scoped data; obsolete supervision remains denied. |

## Persistent custom tables in the touched boundary

- 'llx_mjlfinancement_audit_event' (append-only through database triggers)
- 'llx_mjlfinancement_invitation'
- 'llx_mjlfinancement_password_reset'
- 'llx_mjlfinancement_user_role'
- 'llx_mjlfinancement_activity' and 'llx_mjlfinancement_activity_assignment' (empty RST-006A target)
- 'llx_mjlfinancement_operation', 'llx_mjlfinancement_activity_revision',
  'llx_mjlfinancement_revision_contributor', and
  'llx_mjlfinancement_review_decision' (empty RST-006B targets)
- 'llx_mjlfinancement_cancellation_request' and
  'llx_mjlfinancement_reopening_request' (empty RST-006B targets)
- 'llx_mjlfinancement_operation_type' (empty RST-003 reference table)
- 'llx_mjlfinancement_export_record' (empty immutable RST-012 export evidence)

No legacy group membership participates in MJL authorization. Native Admin
status derives ADMIN_PLATEFORME; business roles are stored only for non-admin,
same-entity users.

## Phase 3B dashboard source

Exact RST-012 readiness enables financial-first Accueil, computed Alertes,
50-row Activity/Opération browsing and current-role action queues. Admin remains technical/audit-only;
Agents use current Activity assignments, and reviewers use the active entity.

The shared filters are Partenaire, Projet, Activity reference/name, validation,
execution, completeness and inclusive Activity-date overlap. Opération
type/state filters narrow children after complete parent projection. Typed
request selection uses `type` plus `request_id`; `status` remains a stored
request state. Requests that can no longer be approved display `À clôturer`,
with eligible rejection or withdrawal. No stale state or alert row is stored.

Detail/review controls reuse queue eligibility. Structural editing and return
freeze at start; unchanged submitted reviews may finish and unsubmitted drafts
may still be abandoned. Pending proposals and validated authorization/spending
remain separately labeled. Query failures produce unavailable sections.

The navigation adds Alertes, Demandes d’exception and business Rapports only
after readiness; audit report variants select Audit. The obsolete supervision
route remains denied. The complete Phase 3B gate passed on 2026-09-11, including
111 monitoring/report/recovery checks, the scale benchmark, and the disposable
RST-012 cutover matrix. The final aggregate passed 214 Node/static checks, 223
functional browser checks, and the scale case. Shared evidence remained equal
and teardown completed. See `docs/mjl-phase-3b-final-validation-2026-09-11.md`.
The guarded shared cutover completed on 2026-09-14 with the tenant empty and
the prior Admin, ECM, business-document, and reconciler evidence preserved.
See `docs/mjl-phase-3b-cutover-execution-report-2026-09-14.md`. Signed human
accessibility remains a production/release blocker.
