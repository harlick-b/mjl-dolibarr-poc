# MJL Reset Manifest v2

No action is approved or executed. Each ID below is an independently scoped
approval unit. Approval of a parent number does not approve a suffixed unit.

## Safety and Approval Contract

- Every action is `PENDING_APPROVAL`.
- RST-000 must complete and its restore rehearsal must pass before any action
  that mutates existing data.
- Exact row identifiers must be exported and reviewed immediately before a
  later approved mutation; counts in this document never identify rows.
- Native `llx_user`, `llx_societe`, `llx_projet`, ECM tables, and
  `data/documents` must never be broadly truncated.
- A later execution report must name each approved ID, exact commands,
  before/after counts, backup artifact, and rollback result.

## Manifest Actions

### RST-000 - Recovery boundary

- Status: `PENDING_APPROVAL`
- Current component: existing local Compose tenant, configuration, and document storage.
- Proposed action: capture and restore-test a complete recovery boundary.
- Reason: later approved destructive actions require proven recovery.
- Phase: Phase 1 precondition
- Dependencies: none
- Exact paths: `docker-compose.yml`, `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `data/documents`, and the MariaDB volume selected by `docker-compose.yml`; documentation output goes to `docs/mjl-phase-1-reset-report.md`.
- Exact tables/data: all MariaDB schemas in the local Compose tenant; Dolibarr configuration constants; document inventory under `data/documents`.
- Action and data impact: create a logical database dump, configuration export, and document snapshot/inventory; no business-data mutation.
- Backup prerequisite: destination capacity and checksum algorithm confirmed before capture; dump and document archive checksums recorded.
- Rollback/verification: restore into an isolated disposable tenant and compare schema plus row counts before any dependent approval may execute.

### RST-001 - Effective roles and native-admin invariant

- Status: `PENDING_APPROVAL`
- Current component: legacy role history, native-admin bypasses, groups, and rights.
- Proposed action: replace effective-role enforcement and synchronize native admins.
- Reason: the target requires one effective role and no native-admin business role.
- Phase: Phase 1
- Dependencies: RST-000
- Exact paths: `custom/mjlfinancement/admin/access.php`, `custom/mjlfinancement/lib/mjl_scope.lib.php`, `custom/mjlfinancement/lib/mjl_workspace.lib.php`, `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_user_role.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_user_role.key.sql`, `custom/mjlfinancement/scripts/bootstrap_poc.php`, `custom/mjlfinancement/scripts/seed_sample_data.php`, `custom/mjlfinancement/scripts/verification/schema/role_scope_schema.php`, `tests/e2e/auth-invitations.spec.js`, `tests/e2e/cases/auth-lifecycle.cases.js`, `tests/e2e/cases/role-dashboards.cases.js`, `tests/unit/access-audit-fail-closed.test.js`.
- Exact tables/data: `llx_mjlfinancement_user_role`, `llx_user`, `llx_usergroup`, `llx_usergroup_user`, `llx_user_rights`, `llx_usergroup_rights`, `llx_rights_def`.
- Action and data impact: replace active-role enforcement, synchronize native admins to effective `ADMIN_PLATEFORME`, prohibit active business-role rows for native admins, and retire only explicitly inventoried obsolete fixture role rows; actor-role text already stored in audit remains unchanged.
- Backup prerequisite: RST-000 dump plus CSV mapping of every active role row and native-admin flag.
- Rollback/verification: restore the dump and prior code; compare active-role mapping and verify no historical actor label was rewritten.

### RST-002A - Retire Partner authorization scopes

- Status: `PENDING_APPROVAL`
- Current component: Partner-based user authorization and its history table.
- Proposed action: disable Partner scope as authorization and archive/remove its exact rows.
- Reason: target Agent visibility is Activity-assignment based.
- Phase: Phase 1
- Dependencies: RST-000, RST-001
- Exact paths: `custom/mjlfinancement/lib/mjl_scope.lib.php`, `custom/mjlfinancement/lib/mjl_traceability_scope.lib.php`, `custom/mjlfinancement/lib/mjl_workspace.lib.php`, `custom/mjlfinancement/admin/access.php`, `custom/mjlfinancement/scripts/verify_scope_integrity.php`, `custom/mjlfinancement/scripts/verification/scope/access_model.php`, `custom/mjlfinancement/scripts/verification/scope/traceability_targets.php`, `custom/mjlfinancement/scripts/verification/scope/unresolved_scope.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_user_soc_scope.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_user_soc_scope.key.sql`, `tests/characterization/permissions.spec.js`, `tests/e2e/scope-security.spec.js`, `tests/e2e/cases/scope-security.cases.js`.
- Exact tables/data: `llx_mjlfinancement_user_soc_scope` only.
- Action and data impact: disable Partner scope as an authorization input, then archive and remove the 1,194 currently counted local scope-history rows only after the exact row inventory is approved; the table is retained until RST-002B passes.
- Backup prerequisite: RST-000 dump and CSV export of all scope rows with entity, user, Partner, active flag, and timestamps.
- Rollback/verification: restore rows and prior guards; until RST-002B is complete, affected Agent Activity routes fail closed.
- Exhaustive current dependency paths additionally covered by this approval:
  `custom/mjlfinancement/activities.php`,
  `custom/mjlfinancement/alerts.php`,
  `custom/mjlfinancement/budgetlines.php`,
  `custom/mjlfinancement/class/mjlactivity.class.php`,
  `custom/mjlfinancement/class/mjlexpense.class.php`,
  `custom/mjlfinancement/conventions.php`,
  `custom/mjlfinancement/documentdownload.php`,
  `custom/mjlfinancement/documents.php`,
  `custom/mjlfinancement/exchangelogs.php`,
  `custom/mjlfinancement/expenses.php`,
  `custom/mjlfinancement/fundreceipts.php`,
  `custom/mjlfinancement/lib/mjl_activity_access.lib.php`,
  `custom/mjlfinancement/lib/mjl_alerts.lib.php`,
  `custom/mjlfinancement/lib/mjl_dashboard.lib.php`,
  `custom/mjlfinancement/lib/mjl_document.lib.php`,
  `custom/mjlfinancement/lib/mjl_expense_access.lib.php`,
  `custom/mjlfinancement/lib/mjl_integrity.lib.php`,
  `custom/mjlfinancement/lib/mjl_reporting.lib.php`,
  `custom/mjlfinancement/lib/mjl_sample_data.lib.php`,
  `custom/mjlfinancement/lib/mjl_timeline.lib.php`,
  `custom/mjlfinancement/partners.php`,
  `custom/mjlfinancement/projects.php`,
  `custom/mjlfinancement/reports.php`,
  `custom/mjlfinancement/scripts/check_production_readiness.php`,
  `custom/mjlfinancement/scripts/verification/schema/role_scope_schema.php`,
  `custom/mjlfinancement/sql/update_0.8.0.sql`,
  `custom/mjlfinancement/validations.php`,
  `custom/mjlfinancement/workflowactions.php`,
  `tests/e2e/cases/contextual-exchanges.cases.js`,
  `tests/e2e/cases/document-lifecycle.cases.js`,
  `tests/e2e/cases/email-notifications.cases.js`,
  `tests/e2e/cases/partner-project.cases.js`,
  `tests/e2e/cases/role-dashboards.cases.js`,
  `tests/e2e/cases/scoped-alerts.cases.js`,
  `tests/e2e/screen-inventory.spec.js`,
  `tests/manual/accessibility-gate.spec.js`, and
  `tests/unit/access-audit-fail-closed.test.js`.

### RST-002B - Activity-assignment authorization

- Status: `PENDING_APPROVAL`
- Current component: one responsible Activity user and retained scope-table structure.
- Proposed action: migrate to time-bounded Activity assignments, verify, then remove legacy fields/table.
- Reason: the target supports primary and additional current Agents with immediate revocation.
- Phase: Phase 2
- Dependencies: RST-002A, RST-005
- Exact paths: `custom/mjlfinancement/activities.php`, `custom/mjlfinancement/class/mjlactivity.class.php`, `custom/mjlfinancement/lib/mjl_activity_access.lib.php`, planned `custom/mjlfinancement/class/mjlactivityassignment.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.key.sql`, `tests/e2e/activities.spec.js`, `tests/e2e/cases/activity-workflow.cases.js`, `tests/e2e/cases/scope-security.cases.js`.
- Exact tables/data: planned `llx_mjlfinancement_activity_assignment`; legacy `llx_mjlfinancement_activity.fk_user_responsible`; `llx_mjlfinancement_user_soc_scope` table definition.
- Action and data impact: introduce time-bounded Activity assignments and remove the legacy responsible-user field only after an approved seven-Activity mapping or clean local reset; then drop the obsolete scope table in an explicit migration.
- Backup prerequisite: RST-000 dump plus approved Activity-to-Agent mapping and RST-002A archive.
- Rollback/verification: rollback migration restores the responsible field and scope table, reloads their exports, and reinstates fail-closed legacy guards.

### RST-003 - Partner, Project, and Opération-type reference foundation

- Status: `PENDING_APPROVAL`
- Current component: fixture-owned native references and no target Opération-type reference.
- Proposed action: inactivate the exact old fixture set and establish clean target references/types.
- Reason: current Partner/Programme naming and one-project shape conflict with v2.
- Phase: Phase 1
- Dependencies: RST-000, RST-001
- Exact paths: `custom/mjlfinancement/partners.php`, `custom/mjlfinancement/projects.php`, `custom/mjlfinancement/lib/mjl_project_recovery.lib.php`, `custom/mjlfinancement/lib/mjl_recovery_registry.lib.php`, `custom/mjlfinancement/sample_data/seed/ptfs_bailleurs.csv`, `custom/mjlfinancement/sample_data/seed/projects.csv`, planned `custom/mjlfinancement/operationtypes.php`, planned `custom/mjlfinancement/class/mjloperationtype.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_operation_type.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_operation_type.key.sql`, `tests/e2e/partners-projects.spec.js`, `tests/e2e/cases/partner-project.cases.js`, `tests/contracts/project_form_security_test.php`.
- Exact tables/data: only `llx_societe` and `llx_projet` rows where `entity=1 AND import_key='MJLPOC2026'`; planned `llx_mjlfinancement_operation_type`. The read-only audit found four matching third parties and five matching Projects. One Project does not match and is excluded. The three expected fixture Project refs `PRJ-JE-2026`, `PRJ-RED-2026`, and `PRJ-EXT-2026` each occur once inside the matching set.
- Action and data impact: inactivate, rather than delete, only that exact `entity=1 AND import_key='MJLPOC2026'` native set; create the authoritative initial UNICEF/UNICEF and Coopération Suisse/Programme Redevabilité references as new stable target records; introduce temporary clearly labelled Opération types. Any changed predicate count blocks execution and requires a revised manifest approval. No name-based match or automatic old-to-new mapping is authorized.
- Backup prerequisite: RST-000 dump and an identifier appendix containing row ID, entity, import key, Project ref where applicable, and proposed inactivation for exactly the four/five matching rows; the appendix checksum must be approved before mutation.
- Rollback/verification: reverse only recorded upserts/inactivations and drop only the new custom type table through its rollback migration.

### RST-004 - Remove obsolete finance core

- Status: `PENDING_APPROVAL`
- Current component: conventions, budget lines, receipts, Expenses, validations, and finance routes.
- Proposed action: archive and remove the exact obsolete custom finance surface.
- Reason: those upstream/payment objects are outside target core scope.
- Phase: Phase 1
- Dependencies: RST-000
- Exact paths: `custom/mjlfinancement/conventions.php`, `custom/mjlfinancement/budgetlines.php`, `custom/mjlfinancement/fundreceipts.php`, `custom/mjlfinancement/expenses.php`, `custom/mjlfinancement/validations.php`, `custom/mjlfinancement/class/mjlconvention.class.php`, `custom/mjlfinancement/class/mjlbudgetline.class.php`, `custom/mjlfinancement/class/mjlfundreceipt.class.php`, `custom/mjlfinancement/class/mjlexpense.class.php`, `custom/mjlfinancement/class/mjlvalidation.class.php`, `custom/mjlfinancement/lib/mjl_expense_access.lib.php`, `custom/mjlfinancement/lib/mjl_expense_recovery.lib.php`, `custom/mjlfinancement/lib/mjl_finance_feedback.lib.php`, `custom/mjlfinancement/lib/mjl_finance_governance.lib.php`, `custom/mjlfinancement/lib/mjl_finance_metrics.lib.php`, `custom/mjlfinancement/lib/mjl_finance_recovery.lib.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_convention.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_convention.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_budget_line.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_budget_line.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_fund_receipt.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_fund_receipt.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_expense.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_expense.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_validation.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_validation.key.sql`, `custom/mjlfinancement/sql/update_0.2.0.sql`, `custom/mjlfinancement/sql/update_0.3.0.sql`, `custom/mjlfinancement/sql/update_0.8.0.sql`, `custom/mjlfinancement/sql/update_0.10.0.sql`, `custom/mjlfinancement/sql/update_0.11.0.sql`, `custom/mjlfinancement/scripts/verify_expense_workflow.php`, `custom/mjlfinancement/scripts/verification/schema/core_schema.php`, `custom/mjlfinancement/scripts/verification/schema/expense_workflow_schema.php`, `custom/mjlfinancement/scripts/verification/schema/relationship_integrity.php`, `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `custom/mjlfinancement/lib/mjl_navigation_registry.lib.php`, `tests/characterization/finance.spec.js`, `tests/characterization/cases/budget-integrity.cases.js`, `tests/characterization/cases/convention-integrity.cases.js`, `tests/characterization/cases/fund-receipt-integrity.cases.js`, `tests/e2e/expenses.spec.js`, `tests/e2e/finance.spec.js`, `tests/e2e/cases/expense-disbursement.cases.js`, `tests/e2e/cases/expense-workflow.cases.js`.
- Exact tables/data: `llx_mjlfinancement_convention`, `llx_mjlfinancement_budget_line`, `llx_mjlfinancement_fund_receipt`, `llx_mjlfinancement_expense`, `llx_mjlfinancement_validation`.
- Action and data impact: remove routes and module entries from core scope, archive exact current rows, and delete those custom rows/tables only in the approved disposable/local reset; no value is inferred or migrated to Opérations.
- Backup prerequisite: RST-000 dump, relational CSV exports, row counts, and inventory of linked document identifiers.
- Rollback/verification: restore database and prior code; verify archived relationship counts and guarded-document links.

### RST-005 - Replace the legacy Activity model

- Status: `PENDING_APPROVAL`
- Current component: mutable legacy Activity schema and workflow linkage.
- Proposed action: migrate to target planning, amount, version, and validation-lock fields while preserving the assignment source.
- Reason: the legacy model cannot represent balanced planning or immutable review.
- Phase: Phase 2
- Dependencies: RST-000, RST-003, RST-004
- Exact paths: `custom/mjlfinancement/activities.php`, `custom/mjlfinancement/class/mjlactivity.class.php`, `custom/mjlfinancement/lib/mjl_activity_access.lib.php`, `custom/mjlfinancement/lib/mjl_activity_recovery.lib.php`, `custom/mjlfinancement/js/activities.js`, `custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql`, `custom/mjlfinancement/scripts/verification/schema/activity_status_integrity.php`, `tests/e2e/activities.spec.js`, `tests/e2e/cases/activity-workflow.cases.js`, `tests/e2e/cases/activity-execution.cases.js`.
- Exact tables/data: `llx_mjlfinancement_activity`, `llx_mjlfinancement_workflow_action` rows linked to the seven current local Activities.
- Action and data impact: replace legacy convention/task/execution fields with planning, integer-safe amount, version, and validation-lock fields; preserve `fk_user_responsible` unchanged as the assignment-migration source. Current rows require an approved mapping or clean reset and are never silently converted. Only RST-002B may map, verify, and then remove `fk_user_responsible`.
- Backup prerequisite: RST-000 dump and per-Activity structural mapping report without free-text disclosure in committed docs.
- Rollback/verification: reverse migration, restore the seven rows and linked workflow rows, and deploy prior code.

### RST-006A - Opération planning and immutable revisions

- Status: `PENDING_APPROVAL`
- Current component: absent first-class Opérations, revisions, and contributor structures.
- Proposed action: add empty target planning and immutable-revision structures.
- Reason: target balancing and identity-based review require these entities.
- Phase: Phase 2
- Dependencies: RST-002B, RST-005
- Exact paths: planned `custom/mjlfinancement/operations.php`, planned `custom/mjlfinancement/class/mjloperation.class.php`, planned `custom/mjlfinancement/class/mjlactivityrevision.class.php`, planned `custom/mjlfinancement/class/mjlrevisioncontributor.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_operation.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_operation.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_revision.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_revision.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_revision_contributor.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_revision_contributor.key.sql`, `custom/mjlfinancement/activities.php`, `tests/e2e/activities.spec.js`, `tests/e2e/cases/activity-workflow.cases.js`.
- Exact tables/data: planned `llx_mjlfinancement_operation`, `llx_mjlfinancement_activity_revision`, `llx_mjlfinancement_revision_contributor`; no Expense data.
- Action and data impact: add empty target tables and populate them only from new target submissions or an explicitly approved mapping; no spending or historical revision is fabricated.
- Backup prerequisite: schema dump before migration; RST-000 for any mapping.
- Rollback/verification: delete only rows introduced by this migration, drop only these new tables, and restore the pre-migration schema.

### RST-006B - Execution exception requests

- Status: `PENDING_APPROVAL`
- Current component: absent version-bound cancellation and reopening requests.
- Proposed action: add request structures and guarded transactional transitions.
- Reason: terminal exceptions must not bypass locks or audit.
- Phase: Phase 3A
- Dependencies: RST-006A, RST-007B
- Exact paths: planned `custom/mjlfinancement/operationrequests.php`, planned `custom/mjlfinancement/class/mjlcancellationrequest.class.php`, planned `custom/mjlfinancement/class/mjlreopeningrequest.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_cancellation_request.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_cancellation_request.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_reopening_request.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_reopening_request.key.sql`, `tests/e2e/cases/activity-execution.cases.js`.
- Exact tables/data: planned `llx_mjlfinancement_cancellation_request`, `llx_mjlfinancement_reopening_request`, and target rows in planned `llx_mjlfinancement_operation`/`llx_mjlfinancement_activity`.
- Action and data impact: add empty request tables and guarded transactional transitions; legacy data receives no synthetic requests.
- Backup prerequisite: Phase 3A pre-migration dump.
- Rollback/verification: rollback only new request rows/tables and restore target versions/statuses from the pre-migration dump.

### RST-007A - Transactional audit foundation

- Status: `PENDING_APPROVAL`
- Current component: five split mutable-purpose audit/log mechanisms.
- Proposed action: add an append-only transactional target audit foundation and archive legacy evidence.
- Reason: v2 requires one revision-linked mutation/audit contract.
- Phase: Phase 1
- Dependencies: RST-000, RST-001
- Exact paths: `custom/mjlfinancement/class/mjlexchangelog.class.php`, `custom/mjlfinancement/class/mjlreport.class.php`, `custom/mjlfinancement/class/mjlvalidation.class.php`, `custom/mjlfinancement/class/mjlworkflowaction.class.php`, `custom/mjlfinancement/lib/mjl_workflow_audit.lib.php`, `custom/mjlfinancement/lib/mjl_timeline.lib.php`, `custom/mjlfinancement/lib/mjl_timeline_result.lib.php`, `custom/mjlfinancement/exchangelogs.php`, `custom/mjlfinancement/workflowactions.php`, planned `custom/mjlfinancement/class/mjlauditevent.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.key.sql`, `tests/unit/access-audit-fail-closed.test.js`.
- Exact tables/data: `llx_mjlfinancement_workflow_action`, `llx_mjlfinancement_validation`, `llx_mjlfinancement_exchange_log`, `llx_mjlfinancement_access_audit`, `llx_mjlfinancement_report`, planned `llx_mjlfinancement_audit_event`.
- Action and data impact: introduce an append-only target audit table; export and archive legacy rows, but never reinterpret actor snapshots or delete legacy tables until their final consumer is replaced.
- Backup prerequisite: RST-000 plus immutable CSV exports and checksums for all five legacy log tables.
- Rollback/verification: drop only the new table, restore prior audit code, and checksum-compare legacy tables.

### RST-007B - Revision-linked Activity chronology

- Status: `PENDING_APPROVAL`
- Current component: legacy Activity timeline readers without immutable revision linkage.
- Proposed action: switch target chronology to revision-linked audit events.
- Reason: reviewers and users need linear evidence tied to exact revisions.
- Phase: Phase 2
- Dependencies: RST-006A, RST-007A
- Exact paths: `custom/mjlfinancement/lib/mjl_timeline.lib.php`, `custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php`, `custom/mjlfinancement/lib/mjl_timeline_result.lib.php`, `custom/mjlfinancement/activities.php`, planned `custom/mjlfinancement/lib/mjl_audit.lib.php`, `tests/e2e/activities.spec.js`, `tests/e2e/documents-audit.spec.js`.
- Exact tables/data: planned `llx_mjlfinancement_audit_event`, `llx_mjlfinancement_activity_revision`; archived legacy log tables from RST-007A.
- Action and data impact: switch target Activity chronology to revision-linked events; legacy chronology remains read-only evidence and is not rewritten.
- Backup prerequisite: Phase 2 dump and RST-007A archives.
- Rollback/verification: restore prior timeline readers and the Phase 2 dump.

### RST-008 - Preserve and retarget invitation/account lifecycle

- Status: `PENDING_APPROVAL`
- Current component: secure invitation/reset primitives with obsolete role/scope payload semantics.
- Proposed action: retain security primitives and replace authorization payload behavior.
- Reason: invitation-only access remains required but Partner scope does not.
- Phase: Phase 1
- Dependencies: RST-000, RST-001, RST-007A
- Exact paths: `custom/mjlfinancement/admin/access.php`, `custom/mjlfinancement/invitation.php`, `custom/mjlfinancement/core/tpl/login.tpl.php`, `custom/mjlfinancement/core/tpl/passwordforgotten.tpl.php`, `custom/mjlfinancement/core/tpl/passwordreset.tpl.php`, `custom/mjlfinancement/lib/mjl_auth.lib.php`, `custom/mjlfinancement/lib/mjl_email.lib.php`, `custom/mjlfinancement/lib/mjl_email_presentation.lib.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_invitation.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_invitation.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_password_reset.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_password_reset.key.sql`, `tests/e2e/auth-invitations.spec.js`, `tests/e2e/cases/auth-lifecycle.cases.js`, `tests/e2e/email-notifications.spec.js`, `tests/e2e/cases/email-notifications.cases.js`.
- Exact tables/data: `llx_mjlfinancement_invitation`, `llx_mjlfinancement_password_reset`, `llx_user`, `llx_mjlfinancement_user_role`.
- Action and data impact: retain hashed single-use token, expiry, throttling, activation, and audit primitives; remove obsolete scope payloads and enforce exactly one revised effective role. Only expired local token rows may be deleted after inventory; raw token material is never exported.
- Backup prerequisite: RST-000 dump with token columns excluded from human-readable exports.
- Rollback/verification: restore dump/code and invalidate tokens issued during target testing.

### RST-009A - Phase 1 navigation reset

- Status: `PENDING_APPROVAL`
- Current component: finance-era routes, menu entries, and terminology.
- Proposed action: expose only guarded Phase 1 access/reference surfaces.
- Reason: navigation must not advertise removed or unauthorized business behavior.
- Phase: Phase 1
- Dependencies: RST-001, RST-003, RST-004, RST-008
- Exact paths: `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `custom/mjlfinancement/lib/mjl_navigation.lib.php`, `custom/mjlfinancement/lib/mjl_navigation_registry.lib.php`, `custom/mjlfinancement/index.php`, `custom/mjlfinancement/nativeforbidden.php`, `tests/contracts/navigation_registry_test.php`, `tests/e2e/access-shell.spec.js`, `tests/e2e/cases/navigation-shell.cases.js`.
- Exact tables/data: Dolibarr module menu/rights metadata created from the descriptor; no business table rows.
- Action and data impact: remove obsolete finance entries and expose only approved Phase 1 reference/access routes after their guards pass.
- Backup prerequisite: prior descriptor/menu export and phase commit.
- Rollback/verification: restore descriptor/navigation files and re-enable prior menu metadata.
- Exact terminology paths also covered: `custom/mjlfinancement/langs/fr_FR/mjlfinancement.lang`, `custom/mjlfinancement/langs/en_US/mjlfinancement.lang`, and `tests/unit/deprecated-vocabulary.test.js`.

### RST-009B - Phase 2 Activity navigation

- Status: `PENDING_APPROVAL`
- Current component: navigation without target Activity/Opération planning routes.
- Proposed action: add guarded target planning entries after their implementation passes.
- Reason: target workflows require explicit full-page navigation.
- Phase: Phase 2
- Dependencies: RST-005, RST-006A, RST-009A
- Exact paths: `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `custom/mjlfinancement/lib/mjl_navigation_registry.lib.php`, `custom/mjlfinancement/activities.php`, planned `custom/mjlfinancement/operations.php`, `tests/contracts/navigation_registry_test.php`, `tests/e2e/cases/navigation-shell.cases.js`.
- Exact tables/data: module menu metadata only.
- Action and data impact: add guarded Activity and Opération planning entries; no business-data reset.
- Backup prerequisite: Phase 2 descriptor/menu export.
- Rollback/verification: restore prior navigation and remove only menu entries introduced by this unit.

### RST-009C - Phase 3 navigation

- Status: `PENDING_APPROVAL`
- Current component: legacy dashboard/report navigation and absent target execution entries.
- Proposed action: expose approved Phase 3 execution, monitoring, audit, and reporting routes.
- Reason: routes must follow completed guards and phase scope.
- Phase: Phase 3B
- Dependencies: RST-006B, RST-011, RST-012
- Exact paths: `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `custom/mjlfinancement/lib/mjl_navigation_registry.lib.php`, `custom/mjlfinancement/index.php`, `custom/mjlfinancement/alerts.php`, `custom/mjlfinancement/reports.php`, `tests/contracts/navigation_registry_test.php`, `tests/e2e/cases/navigation-shell.cases.js`.
- Exact tables/data: module menu metadata only.
- Action and data impact: expose approved execution, dashboards, audit, and reporting routes after their guards pass.
- Backup prerequisite: Phase 3B descriptor/menu export.
- Rollback/verification: restore prior navigation metadata and files.

### RST-010A - Disable unapproved document business behavior

- Status: `PENDING_APPROVAL`
- Current component: implemented document library and business upload/download journeys.
- Proposed action: disable unapproved document behavior while retaining guarded security seams.
- Reason: document business rules are gated to client input in Phase 4.
- Phase: Phase 1
- Dependencies: RST-000, RST-004, RST-009A
- Exact paths: `custom/mjlfinancement/documents.php`, `custom/mjlfinancement/documentdownload.php`, `custom/mjlfinancement/lib/mjl_document.lib.php`, `custom/mjlfinancement/lib/mjl_document_audit_persistence.lib.php`, `custom/mjlfinancement/deployment/apache-native-guard.conf`, `tests/e2e/documents-audit.spec.js`, `tests/e2e/cases/document-lifecycle.cases.js`.
- Exact tables/data: Dolibarr ECM metadata referenced by these routes; `data/documents`; `llx_mjlfinancement_exchange_log` document events.
- Action and data impact: disable current business document creation/navigation while retaining guarded-download and audit primitives as dormant seams; delete no file or ECM row.
- Backup prerequisite: RST-000 document snapshot and ECM identifier inventory.
- Rollback/verification: restore route/navigation behavior and compare document snapshot checksums.

### RST-011 - Replace dashboards and alerts

- Status: `PENDING_APPROVAL`
- Current component: finance and Partner-scope dashboard/alert queries.
- Proposed action: replace them with revision-aware Activity/Opération metrics.
- Reason: current KPIs mix obsolete sources, states, and authorization.
- Phase: Phase 3B
- Dependencies: RST-006B, RST-007B
- Exact paths: `custom/mjlfinancement/index.php`, `custom/mjlfinancement/dpafdashboard.php`, `custom/mjlfinancement/alerts.php`, `custom/mjlfinancement/lib/mjl_dashboard.lib.php`, `custom/mjlfinancement/lib/mjl_alert_condition.lib.php`, `custom/mjlfinancement/lib/mjl_alert_presentation.lib.php`, `custom/mjlfinancement/lib/mjl_alerts.lib.php`, `custom/mjlfinancement/lib/mjl_workspace.lib.php`, `tests/contracts/container/dashboard_resilience_test.php`, `tests/e2e/dashboards-alerts.spec.js`, `tests/e2e/cases/role-dashboards.cases.js`, `tests/e2e/cases/scoped-alerts.cases.js`.
- Exact tables/data: read-only queries over target Activity, Opération, assignment, revision, and audit tables; no cache table authorized.
- Action and data impact: replace finance/Partner-scope queries with separated revision-aware target totals; no source data mutation.
- Backup prerequisite: phase commit and captured old/new aggregate fixtures.
- Rollback/verification: restore prior query/UI files; source data remains unchanged.

### RST-012 - Replace report catalog

- Status: `PENDING_APPROVAL`
- Current component: 18-key CSV/XLSX finance report center and eight local report rows.
- Proposed action: archive the old catalog and implement target PDF/XLSX plus supplemental CSV outputs.
- Reason: target sources, scopes, formats, and audit contract differ.
- Phase: Phase 3B
- Dependencies: RST-006B, RST-007B
- Exact paths: `custom/mjlfinancement/reports.php`, `custom/mjlfinancement/class/mjlreport.class.php`, `custom/mjlfinancement/lib/mjl_reporting.lib.php`, `custom/mjlfinancement/lib/mjl_csv_export.lib.php`, `custom/mjlfinancement/lib/mjl_xlsx_export.lib.php`, planned `custom/mjlfinancement/lib/mjl_pdf_export.lib.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_report.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_report.key.sql`, `custom/mjlfinancement/sql/update_0.3.0.sql`, `custom/mjlfinancement/scripts/verify_traceability_exports.php`, `custom/mjlfinancement/scripts/verification/scope/traceability_targets.php`, `custom/mjlfinancement/scripts/verification/schema/core_schema.php`, `custom/mjlfinancement/scripts/check_production_readiness.php`, `custom/mjlfinancement/sample_data/seed/fixed_reports.csv`, `custom/mjlfinancement/scripts/seed_sample_data.php`, `custom/mjlfinancement/lib/mjl_sample_data.lib.php`, `custom/mjlfinancement/lib/mjl_navigation_registry.lib.php`, `custom/mjlfinancement/lib/mjl_workspace.lib.php`, `custom/mjlfinancement/lib/mjl_dashboard.lib.php`, `custom/mjlfinancement/lib/mjl_integrity.lib.php`, `custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php`, `custom/mjlfinancement/lib/mjl_traceability_scope.lib.php`, `custom/mjlfinancement/index.php`, `tests/e2e/reports-exports.spec.js`, `tests/e2e/cases/report-exports.cases.js`, `tests/contracts/navigation_registry_test.php`, `tests/e2e/access-shell.spec.js`, `tests/e2e/cases/navigation-shell.cases.js`, `tests/e2e/cases/scope-security.cases.js`, `tests/e2e/screen-inventory.spec.js`, `tests/manual/accessibility-gate.spec.js`, `tests/runner/run-suite.js`, `tests/unit/operational-script-boundary.test.js`.
- Exact tables/data: `llx_mjlfinancement_report`; generated report files identified by that table; read-only target Activity/Opération/revision/audit sources.
- Action and data impact: archive eight current local report rows and inventoried files, replace all 18 legacy code keys with the approved PDF/XLSX catalog, and retain supplemental CSV; no output is labelled official without later approval.
- Backup prerequisite: RST-000, report-row CSV, generated-file inventory/checksums.
- Rollback/verification: restore report rows/files and prior registry/export code.

### RST-013A - Phase 1 test reset

- Status: `PENDING_APPROVAL`
- Current component: Phase 1 tests encoding old roles, scopes, and finance behavior.
- Proposed action: classify and replace/remove only the exact named tests with security preservation.
- Reason: old green tests would validate superseded behavior.
- Phase: Phase 1
- Dependencies: RST-001, RST-003, RST-004, RST-008, RST-009A
- Exact paths: `tests/characterization/finance.spec.js`, `tests/characterization/permissions.spec.js`, `tests/characterization/cases/budget-integrity.cases.js`, `tests/characterization/cases/convention-integrity.cases.js`, `tests/characterization/cases/fund-receipt-integrity.cases.js`, `tests/e2e/access-shell.spec.js`, `tests/e2e/auth-invitations.spec.js`, `tests/e2e/expenses.spec.js`, `tests/e2e/finance.spec.js`, `tests/e2e/partners-projects.spec.js`, `tests/e2e/scope-security.spec.js`, `tests/e2e/cases/auth-lifecycle.cases.js`, `tests/e2e/cases/expense-disbursement.cases.js`, `tests/e2e/cases/expense-workflow.cases.js`, `tests/e2e/cases/partner-project.cases.js`, `tests/e2e/cases/scope-security.cases.js`, `tests/unit/access-audit-fail-closed.test.js`.
- Exact tables/data: test fixtures only.
- Action and data impact: classify each named test as KEEP/REPLACE/REMOVE in the Phase 1 report; removal is allowed only with a named replacement or obsolete-behavior rationale.
- Backup prerequisite: baseline commit and diff of each named test.
- Rollback/verification: restore from the phase commit and run retained security tests.

### RST-013B - Phase 2 test reset

- Status: `PENDING_APPROVAL`
- Current component: Activity planning/validation tests encoding the legacy model.
- Proposed action: replace them with Phase 2 revision, assignment, separation, correction, validation, and locking journeys.
- Reason: Phase 2 must validate its target behavior before its phase verdict.
- Phase: Phase 2
- Dependencies: RST-002B, RST-005, RST-006A, RST-007B
- Exact paths: `tests/e2e/activities.spec.js`, `tests/e2e/cases/activity-workflow.cases.js`, `tests/contracts/behavior_contracts_test.php`, `custom/mjlfinancement/scripts/verification/schema/activity_status_integrity.php`, `custom/mjlfinancement/scripts/verify_activity_workflow.php`.
- Exact tables/data: disposable test fixtures only.
- Action and data impact: replace old Activity planning/workflow assertions in Phase 2; production/local business rows are untouched.
- Backup prerequisite: baseline/phase commits.
- Rollback/verification: restore named files and rerun the prior Phase 2 suite.

### RST-013C - Phase 3A test reset

- Status: `PENDING_APPROVAL`
- Current component: legacy Activity execution/document tests without target request workflows.
- Proposed action: replace them with spent, lifecycle, cancellation, reopening, derivation, completeness, and concurrency journeys.
- Reason: Phase 3A must validate execution and exception behavior before its verdict.
- Phase: Phase 3A
- Dependencies: RST-006B, RST-007B, RST-013B
- Exact paths: `tests/e2e/cases/activity-execution.cases.js`, `tests/e2e/documents-audit.spec.js`, `custom/mjlfinancement/scripts/verification/schema/activity_execution_schema.php`.
- Exact tables/data: disposable Phase 3A test fixtures only.
- Action and data impact: replace execution/request assertions while retaining guarded-document security evidence; local business rows are untouched.
- Backup prerequisite: baseline and Phase 2 commits.
- Rollback/verification: restore named files and rerun the prior Phase 3A suite.

### RST-013D - Phase 3B test reset

- Status: `PENDING_APPROVAL`
- Current component: legacy dashboard, alert, report, audit, and presentation tests.
- Proposed action: align tests with target metrics and PDF/XLSX plus supplemental CSV outputs.
- Reason: Phase 3B behavior must be tested in Phase 3B rather than deferred to hardening.
- Phase: Phase 3B
- Dependencies: RST-009C, RST-011, RST-012, RST-013C
- Exact paths: `tests/e2e/dashboards-alerts.spec.js`, `tests/e2e/reports-exports.spec.js`, `tests/e2e/cases/report-exports.cases.js`, `tests/e2e/cases/role-dashboards.cases.js`, `tests/e2e/cases/scoped-alerts.cases.js`, `tests/manual/accessibility-gate.spec.js`, `tests/unit/design-system-v3-remediation.test.js`, `tests/unit/design-system-v3.test.js`, `tests/contracts/page_header_test.php`, `tests/contracts/presentation_convergence_test.php`, `tests/contracts/table_presentation_test.php`, `tests/evidence/inter-font-css.js`, `tests/evidence/inter-font-live.js`, `tests/helpers/responsive-shell.js`.
- Exact tables/data: disposable Phase 3B fixtures and generated report/UI evidence only.
- Action and data impact: replace dashboard/report assertions without deleting visual accessibility contracts.
- Backup prerequisite: Phase 3A commit and retained report fixtures.
- Rollback/verification: restore named files and run the prior Phase 3B suite.

### RST-013E - Phase 3C test and runner reset

- Status: `PENDING_APPROVAL`
- Current component: old readiness assertions and shared runner/disposable infrastructure.
- Proposed action: align readiness tests and revalidate all exact supporting infrastructure.
- Reason: Phase 3C must prove target hardening without weakening disposable-test safety.
- Phase: Phase 3C
- Dependencies: RST-013D, RST-015
- Exact paths: `custom/mjlfinancement/scripts/check_production_readiness.php`, `custom/mjlfinancement/scripts/verification/runner.php`, `tests/characterization/playwright.config.js`, `tests/contracts/verification_runner_test.php`, `tests/fixtures/disposable-compose.override.yml`, `tests/helpers/mjl-test-runtime.js`, `tests/helpers/playwright-global-setup.js`, `tests/helpers/verify-disposable-environment.js`, `tests/manual/playwright.config.js`, `tests/runner/disposable-policy.js`, `tests/runner/disposable-run.js`, `tests/runner/run-suite.js`, `tests/unit/disposable-policy.test.js`, `tests/unit/disposable-run.test.js`, `tests/unit/operational-script-boundary.test.js`, `tests/unit/verification-entrypoints.test.js`.
- Exact tables/data: disposable test fixtures and generated test outputs only.
- Action and data impact: replace readiness assertions and revalidate runner safety; no local or production business rows.
- Backup prerequisite: Phase 3B commit and disposable-runner configuration snapshot.
- Rollback/verification: restore named files and run the prior Phase 3C readiness/runner tests.

### RST-014A - Phase 1 fixture reset

- Status: `PENDING_APPROVAL`
- Current component: bootstrap and fixture files that create old roles, scopes, and finance objects.
- Proposed action: replace exact fixture-owned rows and files with Phase 1 target data.
- Reason: current fixtures would recreate removed behavior after reset.
- Phase: Phase 1
- Dependencies: RST-001, RST-003, RST-004, RST-008
- Exact paths: `custom/mjlfinancement/scripts/bootstrap_poc.php`, `custom/mjlfinancement/scripts/seed_sample_data.php`, `custom/mjlfinancement/lib/mjl_sample_data.lib.php`, `custom/mjlfinancement/sample_data/seed/ptfs_bailleurs.csv`, `custom/mjlfinancement/sample_data/seed/projects.csv`, `custom/mjlfinancement/sample_data/seed/roles_permissions.csv`, `custom/mjlfinancement/sample_data/seed/users.csv`, `custom/mjlfinancement/sample_data/seed/conventions.csv`, `custom/mjlfinancement/sample_data/seed/budget_lines.csv`, `custom/mjlfinancement/sample_data/seed/fund_receipts.csv`, `custom/mjlfinancement/sample_data/seed/expenses.csv`, `custom/mjlfinancement/sample_data/seed/validation_events.csv`, `custom/mjlfinancement/sample_data/seed/supporting_documents.csv`, `custom/mjlfinancement/sample_data/documents_placeholders/EXP-JE-001_facture-location-salle.txt`, `custom/mjlfinancement/sample_data/documents_placeholders/EXP-JE-002_ordre-mission.txt`, `custom/mjlfinancement/sample_data/documents_placeholders/EXP-JE-003_etat-perdiem.txt`, `custom/mjlfinancement/sample_data/documents_placeholders/EXP-JE-004_facture-corrigee.txt`, `custom/mjlfinancement/sample_data/documents_placeholders/EXP-RED-001_facture-atelier.txt`, `custom/mjlfinancement/sample_data/documents_placeholders/EXP-RED-002_bon-commande.txt`, `custom/mjlfinancement/sample_data/documents_placeholders/FR-RED-001_avis-credit.txt`, `custom/mjlfinancement/sample_data/documents_placeholders/FR-UNICEF-001_avis-credit.txt`, `custom/mjlfinancement/sample_data/documents_placeholders/FR-UNICEF-002_avis-credit.txt`.
- Exact tables/data: six `llx_user` rows where `entity IN (0,1)` and login is exactly one of `admin.poc`, `agent.mjl`, `superviseur.n1`, `superviseur.n2`, `dpaf.mjl`, or `lecteur.audit` (each currently occurs once and is active); plus rows in `llx_societe`, `llx_projet`, `llx_mjlfinancement_user_role`, `llx_mjlfinancement_user_soc_scope`, `llx_mjlfinancement_invitation`, `llx_ecm_files`, and the five RST-004 finance tables only where `entity=1 AND import_key='MJLPOC2026'`. For native references that predicate currently matches four third parties and five Projects; the one nonmatching Project is excluded.
- Action and data impact: inactivate, never delete, only the six exact fixture accounts; replace the local bootstrap with approved reference/users/roles data; stop seeding obsolete finance/document objects. A missing, duplicate, or changed account/predicate count blocks execution and requires revised approval. Production execution remains prohibited.
- Backup prerequisite: RST-000 plus a checksum-approved row-identifier export for the six exact logins and the exact `entity=1 AND import_key='MJLPOC2026'` set; no other native row is authorized.
- Rollback/verification: restore fixture files and local database snapshot.

### RST-014B - Phase 2 fixture reset

- Status: `PENDING_APPROVAL`
- Current component: finance-era Activity fixture without target assignments, Opérations, or revisions.
- Proposed action: replace it with Phase 2 balanced planning and validation fixtures.
- Reason: Phase 2 tests require target data in the same phase.
- Phase: Phase 2
- Dependencies: RST-002B, RST-005, RST-006A, RST-014A
- Exact paths: `custom/mjlfinancement/sample_data/seed/activities.csv`, planned `custom/mjlfinancement/sample_data/seed/activity_assignments.csv`, planned `custom/mjlfinancement/sample_data/seed/operations.csv`, planned `custom/mjlfinancement/sample_data/seed/activity_revisions.csv`.
- Exact tables/data: fixture-owned target Activity, assignment, Opération-planning, revision, and contributor rows only.
- Action and data impact: replace the legacy Activity fixture with balanced Phase 2 target fixtures; no execution amounts or request history is inferred; do not load into production.
- Backup prerequisite: RST-000 and preserved original fixture package.
- Rollback/verification: restore fixture package and local snapshot.

### RST-014C - Phase 3A fixture reset

- Status: `PENDING_APPROVAL`
- Current component: Phase 2 fixtures without execution and exception-request cases.
- Proposed action: add explicit spent/null/zero, status, cancellation, and reopening fixtures.
- Reason: Phase 3A tests require exact execution edge cases in the same phase.
- Phase: Phase 3A
- Dependencies: RST-006B, RST-014B
- Exact paths: `custom/mjlfinancement/sample_data/seed/operations.csv`, planned `custom/mjlfinancement/sample_data/seed/cancellation_requests.csv`, planned `custom/mjlfinancement/sample_data/seed/reopening_requests.csv`.
- Exact tables/data: fixture-owned target Opération, cancellation-request, and reopening-request rows only.
- Action and data impact: add explicit test values without converting null to zero or fabricating legacy requests; do not load into production.
- Backup prerequisite: Phase 2 fixture package and local snapshot.
- Rollback/verification: restore Phase 2 fixtures and snapshot.

### RST-014D - Phase 3B report fixture reset

- Status: `PENDING_APPROVAL`
- Current component: finance-era fixed report catalog fixture.
- Proposed action: replace it with target operational PDF/XLSX and supplemental CSV report fixtures.
- Reason: Phase 3B outputs need target catalog data in the same phase.
- Phase: Phase 3B
- Dependencies: RST-012, RST-014C
- Exact paths: `custom/mjlfinancement/sample_data/seed/fixed_reports.csv`.
- Exact tables/data: fixture-owned `llx_mjlfinancement_report` rows and generated test outputs only.
- Action and data impact: archive old fixture report rows and seed only the target operational catalog; no output becomes official.
- Backup prerequisite: Phase 3A fixture snapshot and report-row/file inventory.
- Rollback/verification: restore the prior report fixture and generated-output inventory.

### RST-015 - Production-readiness model rewrite

- Status: `PENDING_APPROVAL`
- Current component: old-product readiness diagnostic, deployment docs, and package mappings.
- Proposed action: rewrite diagnostics/documentation after Phase 3B and its tests complete.
- Reason: current readiness gates assert obsolete scope and formats.
- Phase: Phase 3C
- Dependencies: RST-009C, RST-011, RST-012, RST-013D
- Exact paths: `custom/mjlfinancement/scripts/check_production_readiness.php`, `custom/mjlfinancement/roadmap.php`, `docs/mjl-production-readiness-plan.md`, `docs/mjl-deployment-checklist.md`, `docs/mjl-acceptance-tests.md`, `docs/mjl-test-coverage-registry.md`, and `package.json`. Phase 3C tests are owned separately by RST-013E.
- Exact tables/data: Dolibarr configuration constants read by the diagnostic; no production constant mutation is authorized.
- Action and data impact: replace old-product readiness assertions and diagnostics after Phase 3B; public/base URL, email transport, secrets, final permissions, deployment rehearsal, and go-live remain client-owned gates.
- Backup prerequisite: configuration export with secrets redacted from reports and Phase 3C code/docs baseline.
- Rollback/verification: restore prior diagnostic/docs/package mapping; configuration remains unchanged unless separately approved.

## Approval Procedure

The user must approve exact IDs, including suffixes. Approval may narrow an
action but cannot broaden it. Missing dependencies, backups, row inventories,
or restore evidence block execution. Unapproved units remain blocked.
