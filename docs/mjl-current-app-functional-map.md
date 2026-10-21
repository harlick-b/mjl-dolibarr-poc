# MJL Current App Functional Map

This file is current-state evidence only. It does not override
`docs/mjl-authoritative-decisions.md`.

## Current local state

The shared local tenant has one native technical administrator and no
persistent MJL business or access records. Module version 0.21.0 is activated
through the non-seeding bootstrap path, and its exact RST-012 OTP schema is
installed empty. The retained Admin has a configured email and password; OTP
remains disabled pending a working mail transport and delivery verification
(local check: 2026-10-20). MJL depends on native Third Parties and Projects.
MJL code lives in `custom/mjlfinancement`. Tests create minimal records in
isolated disposable tenants and remove those tenants after each run.

| Surface | Current behavior |
| --- | --- |
| Accueil | Active financial-first dashboard with role-projected totals, alerts, and permitted-action queues. Its GET handler consumes the W2 monitoring-read owner and renders a prepared monitoring view. |
| Partenaires, Projets, Types d’Opération | Partenaires now reads and writes through the custom REST API; JavaScript required. Projets/Types retain their HTML adapters. Same-entity business-role reads; Validator-only activation/deactivation and mutation. One deep reference command owns create, label-update, and lifecycle writes. |
| Activities | Entity-scoped planning/review aggregate plus active derived execution status, financial completeness/totals, and guarded Activity cancellation request. |
| Opérations | Active 50-row execution list: current Assigned Agents enter status/observations and request exceptions; Supervisor/Validator read; Admin denied. Direct spending edits are replaced by the approval workflow below. |
| Dépenses | Separate draft/submitted expenses per Opération, independent Validator approval, immutable approved entries and linked full reversal/replacement. Approved totals feed existing projections. Former Agents removed by Activity cancellation have correction-only access. The schema is installed locally; six focused workflow/export checks passed. |
| Demandes d’exception | Active bounded cancellation/reopening list with Agent withdrawal and Validator decision controls in MJL navigation. |
| Activity chronology | Detail/review pages show sanitized execution, request, assignment, automatic-transition and single-Activity export summaries, with stable 50-event cursors. Active entity/current assignment remain enforced; Admin denied. Oversized or unavailable details remain explicit. |
| Audit | Entity-filtered read of the immutable audit event table for Validator and native Admin. |
| Utilisateurs et accès | Native-Admin-only invitation, role change, deactivation, and revocation. One deep access command owns standalone role/deactivation writes; invitation preparation uses its non-transaction-owning participant inside the authentication caller transaction. |
| Administration technique | Native-Admin link to Dolibarr module administration. |
| Authentication | Login/OTP/recovery and logout use REST. A shared session gate enforces 24-hour idle and 24-hour absolute expiry; API session polling does not refresh idle time. One cohesive auth command owns configuration-gated email/password, six-digit OTP, invitation, and reset orchestration. One private adapter owns session mutation and a pure policy decides validity. The password step creates no authenticated session; pending challenges remain entity/account scoped, browser bound, hash only, single use, and rate limited. Native bypasses and weakened OTP schemas fail closed. |
| Invitation/reset | Shared five-rule password form; token-derived readonly email; public selector in the query string; secret verifier in the fragment; hash-only storage; POST-only mutation with CSRF; single use; expiry; throttling; caller-owned transaction/audit coupling; neutral reset-request response; and email-owned delivery capture. |
| Activities / Operations / Fiche Activité / portfolio / audit reports | Active scoped `reports.php` previews delegate to selected report/audit HTTP, bounded read, and presentation owners. Audited PDF/XLSX/CSV generation retains `MjlExport`; checked HTTP stream delivery is separately owned. Audit remains Validator/Admin only; business reports retain role and assignment scope. |
| Documents | MJL `documents.php` and `documentdownload.php` return dependency-free HTTP 403 for every actor/method; Apache blocks `/ecm/*`, `/document.php`, and `/viewimage.php`. Native ECM storage remains dormant and unchanged. |
| Alertes | Computed alerts come from the W2 monitoring-read owner through the selected alerts GET handler and prepared template. |

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
- `llx_mjlfinancement_login_otp` (installed by the 0.21.0 activation and empty)

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
