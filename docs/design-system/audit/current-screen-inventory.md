# MJL Clarity System - Current Screen Inventory

MJL product decisions come from `docs/mjl-authoritative-decisions.md`. This
inventory records current routes and their access boundaries. It is
repository-visible evidence, not user acceptance.

| Screen | Route/path | Current purpose and access |
| --- | --- | --- |
| Accueil | `/custom/mjlfinancement/index.php` | Financial indicators, workflow counts, permitted actions, and alert preview; entity and current-assignment scope; Admin technical/audit only. |
| Partenaires | `/custom/mjlfinancement/partners.php` | Reference list and lifecycle forms; business-role reads, Validator mutation, Admin denied. |
| Projets | `/custom/mjlfinancement/projects.php` | Reference list and lifecycle forms; business-role reads, Validator mutation, parent lifecycle guards. |
| Types d’Opération | `/custom/mjlfinancement/operationtypes.php` | Entity-scoped reference list and forms; Validator mutation, no hard deletion. |
| Activities | `/custom/mjlfinancement/activities.php` | Planning, review, execution/completeness summaries, chronology, and contextual cancellation requests; assignment and role guards, Admin denied. |
| Opérations | `/custom/mjlfinancement/operations.php` | Execution cards and exception forms; current Assigned Agents mutate, Supervisor/Validator read, Admin denied. |
| Demandes d’exception | `/custom/mjlfinancement/operationrequests.php` | Filtered cancellation/reopening list; current requester withdrawal, Validator decisions, Supervisor reads, Admin denied. |
| Alertes | `/custom/mjlfinancement/alerts.php` | Computed alerts under entity and role/assignment scope; Admin denied. |
| Rapports | `/custom/mjlfinancement/reports.php` | Scoped Activities, Opérations, Fiche Activité, and portfolio previews; audit report limited to Validator/Admin. |
| Report downloads | `/custom/mjlfinancement/reportexport.php` | CSRF-protected, audited PDF/XLSX/CSV POST delivery with report-specific access checks. |
| Workflow audit | `/custom/mjlfinancement/workflowactions.php` | Filtered event history and details for Validator/Admin in the active entity. |
| Admin access | `/custom/mjlfinancement/admin/access.php` | Admin-only invitations and access management. |
| Invitation acceptance | `/custom/mjlfinancement/invitation.php` | Public token redemption with CSRF protection; no public registration. |
| Documents | `/custom/mjlfinancement/documents.php` | HTTP 403 for every actor and method; no document UI. |
| Document download | `/custom/mjlfinancement/documentdownload.php` | HTTP 403 for every actor and method; native `/ecm/*`, `/document.php`, and `/viewimage.php` delivery is also denied. |
| Login/password pages | Dolibarr auth templates/hooks | Native authentication with MJL styling; invitation-only access. |

The obsolete finance, expense-validation, exchange-log, and roadmap routes are
removed. `/custom/mjlfinancement/dpafdashboard.php` remains a denied legacy
supervision route. Document delivery stays closed unless the user authorizes
new Phase 4 work.

Signed human accessibility review remains outstanding for active screens and
states. Production email/base URL and client approval of non-protected copy and
official outputs also remain outstanding.
