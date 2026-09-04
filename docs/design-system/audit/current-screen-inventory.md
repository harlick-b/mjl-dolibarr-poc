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
| Partenaires | `/custom/mjlfinancement/partners.php` | RST-003 reference list/detail/create/edit/activate/deactivate. | Active business-role reads; Validator-only mutation and inactive visibility; Admin denied. | Browser-verified at the focused RST-003 seam; primary navigation remains unchanged until RST-009A. |
| Projets | `/custom/mjlfinancement/projects.php` | RST-003 reference list/detail/create/edit/activate/deactivate. | Same role boundary; immutable Partenaire/ref; parent lifecycle guards. | Browser-verified, including 390-pixel containment and concurrency ordering. |
| Types d’Opération | `/custom/mjlfinancement/operationtypes.php` | Entity-scoped reference list/detail/create/edit/activate/deactivate. | Same role boundary; no hard deletion. | Browser/schema-verified; catalog remains empty in the shared tenant. |
| Activities | `/custom/mjlfinancement/activities.php` | Active French-first list/create/detail/edit/review states, Activity-scoped Opérations, and sanitized chronology. | Agent assignment scope; Supervisor/Validator portfolio reads and exact-revision review; Admin denied. | Signed accessibility evidence remains pending. |
| Opérations | `/custom/mjlfinancement/operations.php` | Read-only planning list with Activity links. | Agent current-assignment scope; Supervisor/Validator active-entity portfolio; Admin denied. | No execution editing in Phase 2. |
| Expenses | `/custom/mjlfinancement/expenses.php` | Removed obsolete finance route. | Returns 404. | Historical contextual-upload/evidence states are retired. |
| Documents containment | `/custom/mjlfinancement/documents.php` | Dependency-free French HTTP 403; no document UI or data access. | Denied for every actor and method; not navigation-visible. | Phase 4 is approved but not implemented. |
| Conventions | `/custom/mjlfinancement/conventions.php` | Removed obsolete finance route. | Returns 404. | Historical document behavior is retired. |
| Budget lines | `/custom/mjlfinancement/budgetlines.php` | Removed obsolete finance route. | Returns 404. | Historical interaction evidence below is not current behavior. |
| Fund receipts | `/custom/mjlfinancement/fundreceipts.php` | Removed obsolete finance route. | Returns 404. | Historical proof-document behavior is retired. |
| Alerts | `/custom/mjlfinancement/alerts.php` | Computed activity/expense alerts. | Activity or expense alert visibility. | Alerts are computed, not stored. |
| Supervision dashboard | `/custom/mjlfinancement/dpafdashboard.php` | Portfolio supervision metrics, role-specific queues, scoped filters, fund rows, and resolvable audit history. | Supervision access. | Route filename remains DPAF-era compatibility debt; UI labels use production wording. |
| Reports / exports | `/custom/mjlfinancement/reports.php` | Removed obsolete report-center route. | Returns 404. | Target Phase 3B outputs are not implemented. |
| Validation history | `/custom/mjlfinancement/validations.php` | Removed obsolete expense-validation route. | Returns 404. | Workflow audit remains a separate current route. |
| Workflow audit | `/custom/mjlfinancement/workflowactions.php` | Generic workflow audit rows. | Advanced traceability helper. | Advanced technical screen. |
| Exchange logs | `/custom/mjlfinancement/exchangelogs.php` | Removed obsolete exchange-log route. | Returns 404. | Append-only audit is the retained current evidence source. |
| Admin access | `/custom/mjlfinancement/admin/access.php` | Invitations and access administration. | Admin only. | Production email/base URL pending. |
| Invitation acceptance | `/custom/mjlfinancement/invitation.php` | Public token invitation flow. | Token and CSRF checks. | Outside app shell by design. |
| Document download containment | `/custom/mjlfinancement/documentdownload.php` | Dependency-free French HTTP 403; no ECM/file lookup or attachment. | Denied for every actor and method. | Native `/ecm/*`, `/document.php`, and `/viewimage.php` are also denied. |
| Roadmap | `/custom/mjlfinancement/roadmap.php` | Removed internal roadmap route. | Returns 404. | Roadmap authority is documentation-only. |
| Login/password pages | Dolibarr auth templates/hooks | Auth and password flows with MJL styling. | Native auth plus MJL hooks. | No public registration should appear. |

## Historical Phase 3D.2 interaction evidence

- Projects retain visible `Ouvrir` links and add conditional authorized
  secondary row menus.
- Conventions now use guarded create, edit, activate, close,
  delete-confirmation, and upload states.
- Budget lines now use guarded create, edit, and activate states.
- Fund receipts now use guarded create, edit, received, not-received, and
  upload states.
- Finance guards run before fields, options, or exact recovery. Uploads and
  convention deletion remain nonrecoverable; mutations remain POST-only.

## Historical Phase 3D.4 integration evidence

The historical Phase 3D.4 browser inventory covered every one of the then-active
application screens plus invitation, registration, document-download, roadmap,
and operational-script helper routes. Each application route asserts its exact
document title and H1, a unique visible `main` landmark, the MJL shell, safe
rendering without raw diagnostics, and Admin access. Separate assertions cover
an authenticated user with no MJL role, the former global Documents behavior,
former guarded downloads, hidden roadmap, absent public registration, and HTTP denial
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

The historical manual gate named auth, dashboard, list, form, workflow, Documents,
alerts, reports, and administration archetypes and requires reviewer identity,
assistive technology, explicit verdict, and real Chromium 100%/200% evidence at
390/768/980/1024/1366. Every one of the 90 combinations must record its result,
geometry, visible-focus observation, reviewer, and non-empty notes. It remains
unsigned, so the integration verdict is
`BLOCKED_PENDING_MANUAL_ACCESSIBILITY` and does not claim WCAG conformance.
RST-010A retires the document-library/download portions of that historical
evidence; current document routes are containment-only and have no UI
accessibility claim.

The current Phase 2 manual gate supersedes that historical count with fourteen
active archetypes and five Activity states across the same five widths and real
100%/200% browser zoom, for exactly 140 combinations. It additionally records
forced-colors and reduced-motion checks for each Activity state and writes a
private checksummed artifact. It remains unsigned.

The final strengthened-remediation `npm test` passed 31/31 Node contracts,
7/7 PHP contracts, the complete container-verification layer, and 114/114
blocking browser cases. It ran in tenant
`mjl-test-20260805t124354-71091-ed08d24c` on port 36037 for 475.0 seconds and
removed its containers, network, database volume, and document volume. The
separate final C1/C2 characterization passed 28/28 in tenant
`mjl-test-20260805t123629-44505-8ff6b050`; that tenant was also removed.
