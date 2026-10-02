# MJL Current App Functional Map

This file is current-state evidence only. It does not override
`docs/mjl-authoritative-decisions.md`.

## Current local state

The shared local tenant has one native technical administrator and no
persistent MJL business or access records. Its installed custom schema remains
RST-012 at module version 0.20.0; the repository descriptor targets 0.21.0 and
adds the OTP table on the next module activation. MJL depends on native Third Parties and Projects.
MJL code lives in `custom/mjlfinancement`. Tests create minimal records in
isolated disposable tenants and remove those tenants after each run.

| Surface | Current behavior |
| --- | --- |
| Accueil | Active financial-first dashboard with role-projected totals, alerts, and permitted-action queues. |
| Partenaires, Projets, Types d’Opération | Same-entity business-role reads; Validator-only activation/deactivation and mutation. |
| Activities | Entity-scoped planning/review aggregate plus active derived execution status, financial completeness/totals, and guarded Activity cancellation request. |
| Opérations | Active 50-row execution list: current Assigned Agents enter explicit spending/observations and request exceptions; Supervisor/Validator read; Admin denied. |
| Demandes d’exception | Active bounded cancellation/reopening list with Agent withdrawal and Validator decision controls in MJL navigation. |
| Activity chronology | Detail/review pages show sanitized execution, request, assignment, automatic-transition and single-Activity export summaries, with stable 50-event cursors. Active entity/current assignment remain enforced; Admin denied. Oversized or unavailable details remain explicit. |
| Audit | Entity-filtered read of the immutable audit event table for Validator and native Admin. |
| Utilisateurs et accès | Native-Admin-only invitation, role change, deactivation, and revocation. |
| Administration technique | Native-Admin link to Dolibarr module administration. |
| Authentication | Configuration-gated email/password login followed by a six-digit email code. The password step creates no authenticated Dolibarr session; pending challenges are entity/account scoped, browser bound, hash only, single use, and rate limited. Native login/reset actions and pre-existing unverified sessions are rejected while the gate is active. |
| Invitation/reset | Shared five-rule password form; token-derived readonly email; public selector in the query string; secret verifier in the fragment; hash-only storage; same-origin POST redemption; single use; expiry; throttling; CSRF; transaction/audit coupling; and neutral reset-request response. |
| Activities / Operations / Fiche Activité / portfolio / audit reports | Active scoped `reports.php` previews and audited PDF/XLSX/CSV downloads require the current export schema. Audit remains Validator/Admin only; business reports retain role and assignment scope. |
| Documents | MJL `documents.php` and `documentdownload.php` return dependency-free HTTP 403 for every actor/method; Apache blocks `/ecm/*`, `/document.php`, and `/viewimage.php`. Native ECM storage remains dormant and unchanged. |
| Alertes | Computed alerts come from current scoped data. |

## Persistent custom tables

The following custom tables are installed and contain no persistent sample
records in the shared local tenant:

- `llx_mjlfinancement_audit_event` (append-only through database triggers)
- `llx_mjlfinancement_invitation`, `llx_mjlfinancement_password_reset`,
  `llx_mjlfinancement_user_role`
- `llx_mjlfinancement_activity`, `llx_mjlfinancement_activity_assignment`
- `llx_mjlfinancement_operation`, `llx_mjlfinancement_activity_revision`,
  `llx_mjlfinancement_revision_contributor`, `llx_mjlfinancement_review_decision`
- `llx_mjlfinancement_cancellation_request`,
  `llx_mjlfinancement_reopening_request`
- `llx_mjlfinancement_operation_type`
- `llx_mjlfinancement_export_record` (immutable export evidence)

Repository version 0.21.0 adds `llx_mjlfinancement_login_otp` when the module is
next activated; it is not part of the shared tenant's currently installed schema.

No legacy group membership participates in MJL authorization. Native Admin
status derives ADMIN_PLATEFORME; business roles are stored only for non-admin,
same-entity users.

## Dashboard source

The current schema readiness check enables financial-first Accueil, computed
Alertes, 50-row Activity/Opération browsing, and current-role action queues.
Admin remains technical/audit-only; Agents use current Activity assignments,
and reviewers use the active entity.

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

Navigation includes Alertes, Demandes d’exception and business Rapports when
the schema check passes; audit report variants select Audit. The obsolete
supervision route remains denied. These implementation facts do not record user
acceptance or production readiness.
