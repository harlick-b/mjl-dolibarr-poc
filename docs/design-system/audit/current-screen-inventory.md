# MJL Clarity System - Current Screen Inventory

MJL product decisions come from `docs/mjl-authoritative-decisions.md`. This
inventory records current routes and their access boundaries. It is
repository-visible evidence, not user acceptance.

## React PTA-6A/PTA-6D Activity evidence (DEC-125/128)

`/activities/$activityId` contains a compact optional-evidence panel. Agents and
Validators may add PDF/JPEG/PNG files; internal business roles may list and
download them. JPEG/PNG rows also expose an accessible, responsive preview modal
loaded through fresh protected authorization. PDF remains download-only. Admin
and Partner access, deletion, replacement and production document storage remain
outside this surface.

## React PTA-4A (DEC-121)

`/projects/$projectId/ptas/$year` shows the current whole-PTA physical and
financial metrics in the approved two-card dashboard composition. Exact server
facts remain independent of Activity pagination; percentages are French-formatted,
uncapped and explicitly non-calculable at a zero denominator. All business roles
may read; Admin remains denied by the planning workspace and backend.

## React PTA-3A–3F (DEC-115–120)

`/execution/$ptaId` lists approved Activities and their execution summaries.
`/execution/activities/$activityId` shows the approved Operations, start and
record/correction controls for Agents, pause/ineligibility reasons, exact XOF
variance and paginated execution history. Supervisor and Validator views are
read-only; Admin is denied. Mutations remain online-only and clear protected
state on session invalidation.
The same Activity workspace presents décaissement and virement authorizations,
then lets an Agent declare the fixed approved amount as transferred with its
effective date and optional note. Corrections require a reason and retain
paginated history. It then reconciles the approved Activity allocation with final
spending: a positive unused amount can be declared returned externally for the
exact server-owned amount, while a zero result needs no artificial declaration.
Reasoned date/note corrections remain append-only. Supervisors and Validators can
read these declarations.

## React A2.1–A2.2 (DEC-096/099)

`/access/users` is the verified-Admin account/invitation view with bounded filters,
ordinary-role invite/resend/revoke dialogs and safe status projections. Supplied
`docs/inspiration/users` governs composition; v3 governs tokens. No profile/name,
Partner or additional Admin editor is implemented. Restricted synthetic ordinary
active accounts have role/deactivation confirmations; backend eligibility remains
mandatory. Inactive reinvitation and assigned/responsible accounts are excluded.
Ordinary invitees use A1 routes and see their actual exclusive role on `/identity`.

## React A1 (DEC-094)

| Screen | Route | Current boundary |
| --- | --- | --- |
| Connexion | `/login` | Explicit synthetic-only backend; email/password then OTP, no registration or recovery link |
| Invitation | `/invitation` | Fragment proof removed before API inspection; readonly invited email, live password criteria/reveal |
| Vérification | `/verification` | One accessible OTP input with six visual slots, grouped 3+3; pending context only |
| Identité | `/identity` | Fresh verified server identity; blocked on invalidation/offline/expiry; confirmed logout |

Composition follows updated `docs/inspiration/auth` login, set-password and
login-otp references, with approved v3 palette, Inter and control/card radii.
The identity view is the minimal A1 projection, not an account administration
screen. The following inventory describes the retained historical POC.

| Screen | Route/path | Current purpose and access |
| --- | --- | --- |
| Tableau de bord | `/custom/mjlfinancement/index.php` | Role-specific scoped indicators, permitted actions, execution progress, financial disclosure, and alert preview; Admin receives supported access, audit, and technical navigation only. |
| Partenaires | `/custom/mjlfinancement/partners.php` | Responsive status list and progressive create/edit/lifecycle dialogs; business-role reads, Validator mutation, Admin denied. |
| Projets | `/custom/mjlfinancement/projects.php` | Responsive parent/status list and progressive create/edit/lifecycle dialogs; business-role reads, Validator mutation, immutable parent and lifecycle guards. |
| Types d’Opération | `/custom/mjlfinancement/operationtypes.php` | Entity-scoped reference list and forms; Validator mutation, no hard deletion. |
| Activities | `/custom/mjlfinancement/activities.php` | Planning, review, execution/completeness summaries, chronology, and contextual cancellation requests; assignment and role guards, Admin denied. |
| Opérations | `/custom/mjlfinancement/operations.php` | Execution cards and exception forms; current Assigned Agents mutate, Supervisor/Validator read, Admin denied. |
| Dépenses | `/custom/mjlfinancement/expenses.php` | Bounded Operation/expense lists, ordinary draft and decision forms; assigned Agent submission, independent Validator approval, linked corrections. Agents removed by Activity cancellation retain correction-only access. Admin denied. |
| Demandes d’exception | `/custom/mjlfinancement/operationrequests.php` | Filtered cancellation/reopening list; current requester withdrawal, Validator decisions, Supervisor reads, Admin denied. |
| Alertes | `/custom/mjlfinancement/alerts.php` | Computed alerts under entity and role/assignment scope; Admin denied. |
| Rapports | `/custom/mjlfinancement/reports.php` | Shared responsive filters, visible active selections, scoped previews, and complete-selection export actions for Activities, Opérations, Fiche Activité, portfolio, and Validator/Admin audit. |
| Report downloads | `/custom/mjlfinancement/api/index.php/v1/reports/{type}/exports` | CSRF-protected, audited PDF/XLSX/CSV REST delivery with report-specific access checks; the former form route rejects requests. |
| Workflow audit | `/custom/mjlfinancement/workflowactions.php` | Filtered chronological event history, recorded metadata/details, and audited downloads for Validator/Admin in the active entity. |
| Admin access | `/custom/mjlfinancement/admin/access.php` | Admin-only JavaScript-required REST user/invitation lists with progressive invitation, role-change, deactivation, and revocation dialogs, real delivery states, and a no-JavaScript message. |
| Invitation acceptance | `/custom/mjlfinancement/invitation.php` | Shared password-creation form with readonly invited email, five live rules, fragment verifier, and CSRF protection; no public registration. |
| Documents | `/custom/mjlfinancement/documents.php` | HTTP 403 for every actor and method; no document UI. |
| Document download | `/custom/mjlfinancement/documentdownload.php` | HTTP 403 for every actor and method; native `/ecm/*`, `/document.php`, and `/viewimage.php` delivery is also denied. |
| Login verification | `/index.php`, `/custom/mjlfinancement/auth.php` | Configuration-gated email/password screen and six-slot logical OTP input in the shared responsive auth shell. |
| Password recovery | `/user/passwordforgotten.php` | Generic reset request/invalid-link states and the shared five-rule password form. |

The obsolete finance, expense-validation, exchange-log, and roadmap routes are
removed. `/custom/mjlfinancement/dpafdashboard.php` remains a denied legacy
supervision route. Document delivery stays closed unless the user authorizes
new Phase 4 work.

Signed human accessibility review remains outstanding for active screens and
states. The retained technical Admin has a configured email; mail transport and
delivery verification remain required before OTP can be enabled. Production email/base URL and client approval of
non-protected copy and official outputs also remain outstanding.

REST migration (DEC-080/082/083/084/085/086): authentication/recovery, business
workflows, dashboards, alerts, audit and operational reports use JavaScript-required
REST clients. Current screen URLs, French labels, responsive presentation and
guarded actions remain. Protected REST is unavailable until OTP is enabled after
mail delivery verification.
