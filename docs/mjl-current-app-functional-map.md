# MJL Current App Functional Map

This file is current-state evidence only. It does not override
'docs/mjl-authoritative-decisions.md'.

## Shared Phase 3A state

The local tenant contains exactly one preserved native technical
administrator and no persistent business, invitation, reset, role, scope, or
audit rows. The shared schema is at RST-006B. Module version 0.20.0 depends on native Third Parties and Projects.
MJL-specific code remains under 'custom/mjlfinancement'.
DEC-055 records `PHASE_3A_READY_WITH_NOTES` and permits Phase 3B development;
the unsigned human accessibility review remains a production/release blocker.

| Surface | Current behavior |
| --- | --- |
| Accueil | Role-projected static Phase 1 landing; no finance aggregates. |
| Partenaires, Projets, Types d’Opération | Same-entity business-role reads; Validator-only activation/deactivation and mutation. |
| Activities | Entity-scoped planning/review aggregate plus active derived execution status, financial completeness/totals, and guarded Activity cancellation request. |
| Opérations | Active 50-row execution list: current Assigned Agents enter explicit spending/observations and request exceptions; Supervisor/Validator read; Admin denied. |
| Demandes d’exception | Active bounded cancellation/reopening list with Agent withdrawal and Validator decision controls; no Phase 3B navigation entry. |
| Activity chronology | Detail/review pages show sanitized execution, request, assignment, automatic-transition and single-Activity export summaries, with stable 50-event cursors. Active entity/current assignment remain enforced; Admin denied. Oversized or unavailable details remain explicit. |
| Audit | Entity-filtered read of the immutable audit event table for Validator and native Admin. |
| Utilisateurs et accès | Native-Admin-only invitation, role change, deactivation, and revocation. |
| Administration technique | Native-Admin link to Dolibarr module administration. |
| Invitation/reset | Public selector in the query string, secret verifier in the fragment, hash-only storage, same-origin POST redemption, single use, expiry, throttling, CSRF, transaction/audit coupling, and neutral reset-request response. |
| Legacy finance, reports, validations, exchanges | Obsolete implementations remain removed. |
| Phase 3B Activities / Operations / Fiche Activité / portfolio / audit report source | New scoped `reports.php` preview (Activities by default, Operations via `report=operations`, Fiche via `report=activity_detail&activity_id=ID`, portfolio via `report=portfolio`, complete audit via `report=audit` for Validator/Admin) and `reportexport.php` downloads require exact RST-012 schema. All 64 combined report/chronology checks passed in disposable tenants. `workflowactions.php` delegates to the new audit preview only when RST-012 is present; shared Phase 3A retains its existing audit screen until guarded cutover. |
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
  'llx_mjlfinancement_review_decision' (empty RST-006B targets)
- 'llx_mjlfinancement_cancellation_request' and
  'llx_mjlfinancement_reopening_request' (empty RST-006B targets)
- 'llx_mjlfinancement_operation_type' (empty RST-003 reference table)

No legacy group membership participates in MJL authorization. Native Admin
status derives ADMIN_PLATEFORME; business roles are stored only for non-admin,
same-entity users.

## Phase 3B dashboard source (shared cutover pending)

Exact RST-012 readiness enables financial-first Accueil, computed Alertes,
50-row Activity/Opération browsing and current-role action queues. Shared
Phase 3A retains the predecessor screens. Admin remains technical/audit-only;
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
route remains denied. Combined monitoring/report verification passed 111/111 checks on 2026-09-11, including 32 export recovery and authorization-race checks, equal shared-state evidence and complete disposable teardown. See `docs/mjl-phase-3b-recovery-validation-2026-09-11.md`. Focused and aggregate negative controls also prove deliberate Phase 3B test discovery; see `docs/mjl-phase-3b-discovery-validation-2026-09-11.md`. The September 10 aggregate passed 211 Node and 192 browser tests, including the scale benchmark and schema/renderer probes. Disposable cutover proofs, human accessibility and guarded shared cutover remain pending.
