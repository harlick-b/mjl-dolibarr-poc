# MJL Clarity System - Current Screen Inventory

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file is current-state evidence only.

## Scope

This inventory is documentation-only. It lists repo-visible screens and helper
routes that matter for UI, auth, dashboards, exports, documents, and workflow
coverage.

| Screen | Route/path | Current purpose | Access notes | Current-state caveat |
| --- | --- | --- | --- | --- |
| Workspace dashboard | `/custom/mjlfinancement/index.php` | Role-aware enriched cards with definition/scope/period/freshness/destination metadata, local source-unavailable states, scoped filters, alerts context, and Admin-only unresolved-data diagnostics. | Any user who can enter the MJL workspace; server queries retain role/entity/scope guards. | Fixture and compatibility identifiers still contain POC-era vocabulary. |
| Partenaires / Programmes | `/custom/mjlfinancement/partners.php` | Partner/programme list/detail and related data. | Scoped by MJL helpers. | Inventory rendering is browser-verified; deeper role journeys remain in capability suites. |
| Projects | `/custom/mjlfinancement/projects.php` | Project list/detail, dedicated create/edit states, shared scoped filters/pagination and list states, responsive operational cards, related MJL objects, notes. | Create/edit actions are caller-authorized; direct presentation routes, POST actions, project objects, recovery state, filters, and partner options retain MJL permission/entity/scope guards. | Dense related-detail tables remain outside the responsive operational-list treatment. |
| Activities | `/custom/mjlfinancement/activities.php` | Activity lifecycle, dedicated create/edit/execution/contextual-upload states, shared scoped filters/pagination, responsive operational list, guarded review-decision states, documents, and timeline. | Direct create/edit/execution, upload, and review-state routes recheck write/read access, active entity, scope, role, ownership, and current workflow state before loading options, consuming recovery, or exposing fields; POST guards remain authoritative. | Short submission/correction comments remain contextual on detail by design. |
| Expenses | `/custom/mjlfinancement/expenses.php` | Expense lifecycle, dedicated create/edit/contextual-upload states, shared scoped filters/pagination and list states, responsive operational cards, evidence, and review/final-validation/disbursement states. | Direct create/edit/upload and decision-state routes recheck write/read access, active entity, scope, ownership, role, actor separation, and current workflow state before loading options, consuming recovery, or exposing fields; POST guards remain authoritative. | Short submission/correction comments remain contextual on detail by design. |
| Documents library | `/custom/mjlfinancement/documents.php` | Read-only accessible document list. | Document helper plus object access. | Uploads are contextual only. |
| Conventions | `/custom/mjlfinancement/conventions.php` | Governed funding-envelope management with journey summary, guarded documents, exact recovery, pagination, timeline, and canonical finance feedback. | Reference-data/supervision guards remain caller-owned. | Legacy label/role wording remains. |
| Budget lines | `/custom/mjlfinancement/budgetlines.php` | Governed budget-line management with journey summary, exact recovery, pagination, timeline, and canonical finance feedback. | Reference-data/supervision guards remain caller-owned. | Advanced finance setup surface. |
| Fund receipts | `/custom/mjlfinancement/fundreceipts.php` | Fund receipt management with journey summary, guarded proof documents, exact recovery, pagination, timeline, and canonical finance feedback. | Reference-data/supervision guards remain caller-owned. | Final wording remains subject to client review. |
| Alerts | `/custom/mjlfinancement/alerts.php` | Computed activity/expense alerts. | Activity or expense alert visibility. | Alerts are computed, not stored. |
| Supervision dashboard | `/custom/mjlfinancement/dpafdashboard.php` | Portfolio supervision metrics, role-specific queues, scoped filters, fund rows, and resolvable audit history. | Supervision access. | Route filename remains DPAF-era compatibility debt; UI labels use production wording. |
| Reports / exports | `/custom/mjlfinancement/reports.php` | Report center with 16 report keys, GET previews/filters, explicit Partenaire / Programme filtering, CSV/XLSX POST exports, stable filenames, and export audit rows. | Supervision; export requires export write/Admin and a valid Dolibarr token. | Final donor/client canevas and final permission matrix remain pending; generic report audit rows are Admin-only in scoped audit views. |
| Validation history | `/custom/mjlfinancement/validations.php` | Expense validation history. | Reviewer/supervision/audit helper. | Read-only and not fully contextual. |
| Workflow audit | `/custom/mjlfinancement/workflowactions.php` | Generic workflow audit rows. | Advanced traceability helper. | Advanced technical screen. |
| Exchange logs | `/custom/mjlfinancement/exchangelogs.php` | Exchange log list/create surface. | Advanced traceability helper. | Should not be primary navigation. |
| Admin access | `/custom/mjlfinancement/admin/access.php` | Invitations and access administration. | Admin only. | Production email/base URL pending. |
| Invitation acceptance | `/custom/mjlfinancement/invitation.php` | Public token invitation flow. | Token and CSRF checks. | Outside app shell by design. |
| Document download | `/custom/mjlfinancement/documentdownload.php` | Guarded ECM download route. | Object-specific guards. | Helper route, not navigation. |
| Roadmap | `/custom/mjlfinancement/roadmap.php` | Internal roadmap/readiness page. | Admin plus feature flag. | Not a production user feature. |
| Login/password pages | Dolibarr auth templates/hooks | Auth and password flows with MJL styling. | Native auth plus MJL hooks. | No public registration should appear. |

## Phase 3D.2 interaction update

- Projects retain visible `Ouvrir` links and add conditional authorized
  secondary row menus.
- Conventions now use guarded create, edit, activate, close,
  delete-confirmation, and upload states.
- Budget lines now use guarded create, edit, and activate states.
- Fund receipts now use guarded create, edit, received, not-received, and
  upload states.
- Finance guards run before fields, options, or exact recovery. Uploads and
  convention deletion remain nonrecoverable; mutations remain POST-only.

## Phase 3D.4 integration evidence

The maintained browser inventory covers every one of the sixteen active
application screens plus invitation, registration, document-download, roadmap,
and operational-script helper routes. Each application route asserts its exact
document title and H1, a unique visible `main` landmark, the MJL shell, safe
rendering without raw diagnostics, and Admin access. Separate assertions cover
an authenticated user with no MJL role, global Documents read-only behavior,
guarded downloads, hidden roadmap, absent public registration, and HTTP denial
of the entire operational-script family. Exact advanced-route admissions stay
in non-blocking characterization C2 pending the client permission matrix.

The affected browser run passed 113/113 cases in tenant
`mjl-test-20260804t162004-941966-e614149e` on
`http://127.0.0.1:46207` in 399.2 seconds; containers, network, and named volumes
were removed. Finance behavior without final authority remains isolated in
characterization and passed 21/21 in separate tenant
`mjl-test-20260804t162933-982937-3ed3dd46` on port 44551 in 208.4 seconds,
including bootstrap and cleanup.

After audit review, the inventory added route-by-route Agent checks for the
dashboard plus six displayed business routes using positive assigned markers,
same-entity out-of-scope markers, and equivalent entity-2 markers assigned to
the same Agent. It does not freeze the pending role-to-advanced-route matrix;
C2 records those current admissions. The fixture is removed in suite teardown.
The then-current intermediate run passed 116/116
browser cases in tenant `mjl-test-20260804t165458-1076689-96f5f821` on port
46729; the total includes
two concurrent v3 font-resource checks outside 3D.4. Runner duration was 601.3
seconds including 20 Node contracts, 7 PHP contracts, full container
verification, and complete resource cleanup.

The manual gate now names auth, dashboard, list, form, workflow, Documents,
alerts, reports, and administration archetypes and requires reviewer identity,
assistive technology, explicit verdict, and real Chromium 100%/200% evidence at
390/768/980/1024/1366. Every one of the 90 combinations must record its result,
geometry, visible-focus observation, reviewer, and non-empty notes. It remains
unsigned, so the integration verdict is
`BLOCKED_PENDING_MANUAL_ACCESSIBILITY` and does not claim WCAG conformance.

The final strengthened-remediation `npm test` passed 31/31 Node contracts,
7/7 PHP contracts, the complete container-verification layer, and 114/114
blocking browser cases. It ran in tenant
`mjl-test-20260805t124354-71091-ed08d24c` on port 36037 for 475.0 seconds and
removed its containers, network, database volume, and document volume. The
separate final C1/C2 characterization passed 28/28 in tenant
`mjl-test-20260805t123629-44505-8ff6b050`; that tenant was also removed.
