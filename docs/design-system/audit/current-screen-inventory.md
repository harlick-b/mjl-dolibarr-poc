# MJL Clarity System - Current Screen Inventory

MJL product decisions come from `docs/mjl-authoritative-decisions.md`. This
inventory records current routes and their access boundaries. It is
repository-visible evidence, not user acceptance.

| Screen | Route/path | Current purpose and access |
| --- | --- | --- |
| Tableau de bord | `/custom/mjlfinancement/index.php` | Role-specific scoped indicators, permitted actions, execution progress, financial disclosure, and alert preview; Admin receives supported access, audit, and technical navigation only. |
| Partenaires | `/custom/mjlfinancement/partners.php` | Responsive status list and progressive create/edit/lifecycle dialogs; business-role reads, Validator mutation, Admin denied. |
| Projets | `/custom/mjlfinancement/projects.php` | Responsive parent/status list and progressive create/edit/lifecycle dialogs; business-role reads, Validator mutation, immutable parent and lifecycle guards. |
| Types d’Opération | `/custom/mjlfinancement/operationtypes.php` | Entity-scoped reference list and forms; Validator mutation, no hard deletion. |
| Activities | `/custom/mjlfinancement/activities.php` | Planning, review, execution/completeness summaries, chronology, and contextual cancellation requests; assignment and role guards, Admin denied. |
| Opérations | `/custom/mjlfinancement/operations.php` | Execution cards and exception forms; current Assigned Agents mutate, Supervisor/Validator read, Admin denied. |
| Demandes d’exception | `/custom/mjlfinancement/operationrequests.php` | Filtered cancellation/reopening list; current requester withdrawal, Validator decisions, Supervisor reads, Admin denied. |
| Alertes | `/custom/mjlfinancement/alerts.php` | Computed alerts under entity and role/assignment scope; Admin denied. |
| Rapports | `/custom/mjlfinancement/reports.php` | Shared responsive filters, visible active selections, scoped previews, and complete-selection export actions for Activities, Opérations, Fiche Activité, portfolio, and Validator/Admin audit. |
| Report downloads | `/custom/mjlfinancement/reportexport.php` | CSRF-protected, audited PDF/XLSX/CSV POST delivery with report-specific access checks. |
| Workflow audit | `/custom/mjlfinancement/workflowactions.php` | Filtered chronological event history, recorded metadata/details, and audited downloads for Validator/Admin in the active entity. |
| Admin access | `/custom/mjlfinancement/admin/access.php` | Admin-only responsive user/invitation lists with progressive invitation, role-change, deactivation, and revocation dialogs; real delivery states and ordinary-form fallback. |
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
states. The retained technical Admin still needs a unique reachable email
before OTP can be enabled. Production email/base URL and client approval of
non-protected copy and official outputs also remain outstanding.
