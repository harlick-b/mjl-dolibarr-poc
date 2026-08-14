# MJL Reset Manifest v2

RST-000, RST-000A, RST-001, RST-002A, and RST-003 were explicitly approved and
executed. RST-003 completed on 2026-08-13 with an empty reference catalog;
every later action remains unapproved and unexecuted.
Each ID below is an independently scoped approval unit. Approval of a parent
number does not approve a suffixed unit.

## Safety and Approval Contract

- RST-000, RST-000A, RST-001, RST-002A, and RST-003 are `EXECUTED`; every other action is
  `PENDING_APPROVAL`.
- RST-000A deleted legacy local sample data without migration and preserved
  exactly one native technical administrator through a checksum-approved
  deletion appendix.
- No selective inactivation, old-to-new user/Partner/Project/Activity mapping,
  or phase-owned persistent seed is authorized.
- Persistent sample/demo data remains absent until every implementation phase
  is complete and a later dataset specification is separately approved.
- Test fixtures are authorized only inside disposable isolated tenants and
  must be destroyed with those tenants.
- Exact row identifiers must be exported and reviewed immediately before a
  later approved mutation; counts in this document never identify rows.
- Native `llx_user`, `llx_societe`, `llx_projet`, ECM tables, and
  `data/documents` must never be broadly truncated.
- A later execution report must name each approved ID, exact commands,
  before/after counts, backup artifact, and rollback result.

## Manifest Actions

### RST-000 - Recovery boundary

- Status: `EXECUTED`
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
- Execution evidence: `docs/mjl-phase-1-reset-report.md`; all database,
  document, and configuration restore comparisons passed.

### RST-000A - Clean local sample-data purge

- Status: `EXECUTED`
- Current component: legacy POC users, role/scope assignments, business rows, audit/log rows, generated files, documents, and persistent seed sources.
- Proposed action: delete all inventoried local sample data without migration while preserving exactly one native technical administrator account.
- Reason: the target must start from an empty persistent tenant, and legacy POC data is not business-rule evidence.
- Phase: Phase 1 destructive precondition
- Dependencies: RST-000
- Exact paths: `data/documents`, `custom/mjlfinancement/sample_data`, `mjl_dolibarr_poc_sample_data`, `custom/mjlfinancement/scripts/bootstrap_poc.php`, `custom/mjlfinancement/scripts/seed_sample_data.php`, `custom/mjlfinancement/lib/mjl_sample_data.lib.php`, and every database row/file path enumerated in the required deletion appendix.
- Exact tables/data: all appendix-inventoried rows in the 15 `llx_mjlfinancement_*` data tables, including legacy entity-0 backfill rows; all inventoried sample-owned `llx_user`, user-group/right, `llx_societe`, `llx_projet`, ECM, invitation/token, email-outbox, generated-output, and document rows/files; exactly one checksum-identified native administrator is excluded. Dolibarr system/reference/configuration rows and all table definitions are excluded.
- Action and data impact: dependency-ordered hard deletion of only appendix-listed sample rows/files; no value is copied, transformed, mapped, or retained for compatibility. Legacy CSVs, placeholder documents, and `seed_sample_data.php` are removed. `bootstrap_poc.php` is replaced or stripped to a non-seeding installation/activation path that preserves the one technical administrator and cannot recreate business data; Git history and RST-000 provide recovery.
- Backup prerequisite: satisfied by verified RST-000 artifacts and explicit approval of appendix bundle checksum `15ba42a2dba1e3e8c3f8171b93e1049ffcbee7ddea1fb12fb6f3cfe358ce593d` on 2026-08-10.
- Approval deviation: post-reset activation recreated one legacy Admin-role row, and its removal plus supporting source/test/evidence changes exceeded the first appendix. The user ratified that exact scope on 2026-08-10 through supplemental checksum `5ecc8e68574358526817051cc4ce4d3322d144775b978e7154f633dfe913a870`.
- Rollback/verification: restore RST-000; prove the preserved administrator can authenticate, all appendix targets are absent, no non-appendix native row changed, persistent business tables are empty, normal setup cannot repopulate them, and disposable-test infrastructure remains isolated.
- Execution evidence: `docs/mjl-rst-000a-execution-report.md`.

### RST-001 - Effective roles and native-admin invariant

- Status: `EXECUTED`
- Current component: role enforcement code, native-admin bypasses, groups, and rights after the RST-000A purge.
- Proposed action: implement target effective-role enforcement against an empty account set except for the preserved native administrator.
- Reason: the target requires one effective role and no native-admin business role.
- Phase: Phase 1
- Dependencies: RST-000A
- Exact paths: `custom/mjlfinancement/admin/access.php`, `custom/mjlfinancement/lib/mjl_scope.lib.php`, `custom/mjlfinancement/lib/mjl_workspace.lib.php`, `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_user_role.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_user_role.key.sql`, the non-seeding `custom/mjlfinancement/scripts/bootstrap_poc.php`, `custom/mjlfinancement/scripts/verification/schema/role_scope_schema.php`, `tests/e2e/auth-invitations.spec.js`, `tests/e2e/cases/auth-lifecycle.cases.js`, `tests/e2e/cases/role-dashboards.cases.js`, `tests/unit/access-audit-fail-closed.test.js`.
- Exact tables/data: target structure and guards for `llx_mjlfinancement_user_role`, `llx_user`, `llx_usergroup`, `llx_usergroup_user`, `llx_user_rights`, `llx_usergroup_rights`, and `llx_rights_def`; no deleted sample assignment is an input.
- Action and data impact: enforce one effective role for future accounts, derive `ADMIN_PLATEFORME` for the one preserved native administrator, and prohibit concurrent business-role rows for any native admin. No existing sample user or role assignment is migrated.
- Backup prerequisite: RST-000, the executed RST-000A report, and a schema/code baseline.
- Rollback/verification: restore prior code/schema; verify the preserved administrator retains technical access and disposable target users cannot acquire zero, multiple, or native-admin-plus-business roles.
- Execution evidence: `docs/mjl-rst-001-execution-report.md`; singular active-role persistence, derived native Admin, business-role rejection, Admin business-route denial, clean schema audit, and clean persistent tenant checks passed.

### RST-002A - Retire Partner authorization scopes

- Status: `EXECUTED`
- Current component: Partner-based authorization code and the empty legacy scope table after RST-000A.
- Proposed action: disable Partner scope as authorization and retain no compatibility mapping.
- Reason: target Agent visibility is Activity-assignment based.
- Phase: Phase 1
- Dependencies: RST-000A, RST-001
- Exact paths: `custom/mjlfinancement/lib/mjl_scope.lib.php`, `custom/mjlfinancement/lib/mjl_traceability_scope.lib.php`, `custom/mjlfinancement/lib/mjl_workspace.lib.php`, `custom/mjlfinancement/admin/access.php`, `custom/mjlfinancement/scripts/verify_scope_integrity.php`, `custom/mjlfinancement/scripts/verification/scope/access_model.php`, `custom/mjlfinancement/scripts/verification/scope/traceability_targets.php`, `custom/mjlfinancement/scripts/verification/scope/unresolved_scope.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_user_soc_scope.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_user_soc_scope.key.sql`, `tests/characterization/permissions.spec.js`, `tests/e2e/scope-security.spec.js`, `tests/e2e/cases/scope-security.cases.js`.
- Supplemental approval paths: the user explicitly adopted and hardened
  `tests/e2e/cases/rst002a-authorization.cases.js`, added the structural contract
  `tests/unit/rst002a-transition.test.js`, and authorized
  `custom/mjlfinancement/index.php` as the temporary Admin-only technical landing.
- Exact tables/data: empty `llx_mjlfinancement_user_soc_scope` definition and every code/query dependency listed below; its former rows are deleted only by RST-000A.
- Action and data impact: remove Partner scope from authorization inputs; retain the empty table only until RST-002B removes it. No row archive or user mapping is produced.
- Backup prerequisite: RST-000, the executed RST-000A report, and a code/schema baseline.
- Rollback/verification: restore prior guards only in an isolated rollback; until RST-002B is complete, affected Agent Activity routes fail closed.
- Execution evidence: `docs/mjl-rst-002a-execution-report.md`; the shared table
  remained globally empty, the focused disposable suite passed 6/6, the
  archived-HEAD rollback rehearsal passed in isolation, and both disposable
  projects left zero labeled Docker resources.
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
- Proposed action: create empty time-bounded Activity assignments, verify their guards, then remove legacy fields/table without mapping old values.
- Reason: the target supports primary and additional current Agents with immediate revocation.
- Phase: Phase 2
- Dependencies: RST-002A, RST-005
- Exact paths: `custom/mjlfinancement/activities.php`, `custom/mjlfinancement/class/mjlactivity.class.php`, `custom/mjlfinancement/lib/mjl_activity_access.lib.php`, planned `custom/mjlfinancement/class/mjlactivityassignment.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.key.sql`, `tests/e2e/activities.spec.js`, `tests/e2e/cases/activity-workflow.cases.js`, `tests/e2e/cases/scope-security.cases.js`.
- Exact tables/data: planned empty `llx_mjlfinancement_activity_assignment`; empty legacy `llx_mjlfinancement_activity.fk_user_responsible`; empty `llx_mjlfinancement_user_soc_scope` table definition.
- Action and data impact: introduce the assignment structure and remove the empty legacy responsible-user field and scope table through an explicit schema migration. No Activity-to-Agent mapping is authorized.
- Backup prerequisite: RST-000, executed RST-000A/RST-002A, and a schema baseline.
- Rollback/verification: rollback restores the empty responsible field and scope-table definitions and reinstates fail-closed legacy guards; no row export is reloaded.

### RST-003 - Partner, Project, and Opération-type reference foundation

- Status: `EXECUTED`
- Current component: empty native Partner/Project data after RST-000A and no target Opération-type reference.
- Proposed action: establish empty target reference structures and guarded management behavior.
- Reason: current Partner/Programme naming and one-project shape conflict with v2.
- Phase: Phase 1
- Dependencies: RST-000A, RST-001
- Exact paths: `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `custom/mjlfinancement/partners.php`, `custom/mjlfinancement/projects.php`, `custom/mjlfinancement/operationtypes.php`, `custom/mjlfinancement/lib/mjl_reference.lib.php`, `custom/mjlfinancement/lib/mjl_reference_route.lib.php`, `custom/mjlfinancement/class/mjloperationtype.class.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_operation_type.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_operation_type.key.sql`, `custom/mjlfinancement/sql/update_0.12.0.sql`, `custom/mjlfinancement/sql/update_0.12.1.sql`, `custom/mjlfinancement/scripts/audit_schema_current.php`, `custom/mjlfinancement/scripts/verification/schema/reference_foundation.php`, `package.json`, `tests/runner/disposable-run.js`, `tests/runner/run-suite.js`, `tests/e2e/partners-projects.spec.js`, `tests/e2e/cases/partner-project.cases.js`, `tests/unit/rst003-reference-foundation.test.js`, `tests/unit/disposable-run.test.js`, and `tests/unit/design-system-v3-remediation.test.js`.
- Exact tables/data: empty target-facing use of `llx_societe` and `llx_projet`; implemented empty `llx_mjlfinancement_operation_type`. Legacy native rows are deleted only by RST-000A.
- Action and data impact: implement stable identifiers, active/inactive behavior, and Validator-only management without creating UNICEF, Coopération Suisse, Project, or Opération-type sample rows. Final values come from later real entry or the post-all-phases dataset specification.
- Backup prerequisite: RST-000, the executed RST-000A report, and a schema/code baseline.
- Rollback/verification: focused schema/browser acceptance and rollback behavior passed in disposable tenants whose containers, network, database volume, and document volume were removed; the shared tenant retained exactly one Admin and zero business/reference/audit rows. See `docs/mjl-rst-003-execution-report.md`.

### RST-004 - Remove obsolete finance core

- Status: `PENDING_APPROVAL`
- Current component: conventions, budget lines, receipts, Expenses, validations, and finance routes.
- Proposed action: remove the exact obsolete custom finance surface after RST-000A has emptied its data.
- Reason: those upstream/payment objects are outside target core scope.
- Phase: Phase 1
- Dependencies: RST-000A
- Exact paths: `custom/mjlfinancement/conventions.php`, `custom/mjlfinancement/budgetlines.php`, `custom/mjlfinancement/fundreceipts.php`, `custom/mjlfinancement/expenses.php`, `custom/mjlfinancement/validations.php`, `custom/mjlfinancement/class/mjlconvention.class.php`, `custom/mjlfinancement/class/mjlbudgetline.class.php`, `custom/mjlfinancement/class/mjlfundreceipt.class.php`, `custom/mjlfinancement/class/mjlexpense.class.php`, `custom/mjlfinancement/class/mjlvalidation.class.php`, `custom/mjlfinancement/lib/mjl_expense_access.lib.php`, `custom/mjlfinancement/lib/mjl_expense_recovery.lib.php`, `custom/mjlfinancement/lib/mjl_finance_feedback.lib.php`, `custom/mjlfinancement/lib/mjl_finance_governance.lib.php`, `custom/mjlfinancement/lib/mjl_finance_metrics.lib.php`, `custom/mjlfinancement/lib/mjl_finance_recovery.lib.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_convention.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_convention.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_budget_line.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_budget_line.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_fund_receipt.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_fund_receipt.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_expense.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_expense.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_validation.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_validation.key.sql`, `custom/mjlfinancement/sql/update_0.2.0.sql`, `custom/mjlfinancement/sql/update_0.3.0.sql`, `custom/mjlfinancement/sql/update_0.8.0.sql`, `custom/mjlfinancement/sql/update_0.10.0.sql`, `custom/mjlfinancement/sql/update_0.11.0.sql`, `custom/mjlfinancement/scripts/verify_expense_workflow.php`, `custom/mjlfinancement/scripts/verification/schema/core_schema.php`, `custom/mjlfinancement/scripts/verification/schema/expense_workflow_schema.php`, `custom/mjlfinancement/scripts/verification/schema/relationship_integrity.php`, `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `custom/mjlfinancement/lib/mjl_navigation_registry.lib.php`, `tests/characterization/finance.spec.js`, `tests/characterization/cases/budget-integrity.cases.js`, `tests/characterization/cases/convention-integrity.cases.js`, `tests/characterization/cases/fund-receipt-integrity.cases.js`, `tests/e2e/expenses.spec.js`, `tests/e2e/finance.spec.js`, `tests/e2e/cases/expense-disbursement.cases.js`, `tests/e2e/cases/expense-workflow.cases.js`.
- Exact tables/data: `llx_mjlfinancement_convention`, `llx_mjlfinancement_budget_line`, `llx_mjlfinancement_fund_receipt`, `llx_mjlfinancement_expense`, `llx_mjlfinancement_validation`.
- Action and data impact: remove routes, module entries, and empty obsolete tables; no finance value is archived, inferred, or migrated to Opérations.
- Backup prerequisite: RST-000, the executed RST-000A report, and a schema/code baseline.
- Rollback/verification: restore prior empty tables and code; verify no legacy route or seed path remains and guarded-document security seams are retained where still required.

### RST-005 - Replace the legacy Activity model

- Status: `PENDING_APPROVAL`
- Current component: mutable legacy Activity schema and workflow linkage.
- Proposed action: replace the empty legacy Activity structure with target planning, amount, version, and validation-lock fields.
- Reason: the legacy model cannot represent balanced planning or immutable review.
- Phase: Phase 2
- Dependencies: RST-000A, RST-003, RST-004
- Exact paths: `custom/mjlfinancement/activities.php`, `custom/mjlfinancement/class/mjlactivity.class.php`, `custom/mjlfinancement/lib/mjl_activity_access.lib.php`, `custom/mjlfinancement/lib/mjl_activity_recovery.lib.php`, `custom/mjlfinancement/js/activities.js`, `custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql`, `custom/mjlfinancement/scripts/verification/schema/activity_status_integrity.php`, `tests/e2e/activities.spec.js`, `tests/e2e/cases/activity-workflow.cases.js`, `tests/e2e/cases/activity-execution.cases.js`.
- Exact tables/data: empty `llx_mjlfinancement_activity` and `llx_mjlfinancement_workflow_action` structures after RST-000A.
- Action and data impact: replace legacy convention/task/execution fields with planning, integer-safe amount, version, and validation-lock fields. No Activity, workflow, responsible-user, or historical value is converted.
- Backup prerequisite: RST-000, executed RST-000A/RST-003/RST-004, and a schema baseline.
- Rollback/verification: reverse the empty-schema migration and deploy prior code; validate target behavior with disposable fixtures.

### RST-006A - Opération planning and immutable revisions

- Status: `PENDING_APPROVAL`
- Current component: absent first-class Opérations, revisions, and contributor structures.
- Proposed action: add empty target planning and immutable-revision structures.
- Reason: target balancing and identity-based review require these entities.
- Phase: Phase 2
- Dependencies: RST-002B, RST-005
- Exact paths: planned `custom/mjlfinancement/operations.php`, planned `custom/mjlfinancement/class/mjloperation.class.php`, planned `custom/mjlfinancement/class/mjlactivityrevision.class.php`, planned `custom/mjlfinancement/class/mjlrevisioncontributor.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_operation.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_operation.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_revision.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_revision.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_revision_contributor.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_revision_contributor.key.sql`, `custom/mjlfinancement/activities.php`, `tests/e2e/activities.spec.js`, `tests/e2e/cases/activity-workflow.cases.js`.
- Exact tables/data: planned `llx_mjlfinancement_operation`, `llx_mjlfinancement_activity_revision`, `llx_mjlfinancement_revision_contributor`; no Expense data.
- Action and data impact: add empty target tables; only disposable tests may populate them during implementation. No legacy mapping, spending, or historical revision is fabricated.
- Backup prerequisite: schema dump before migration and executed RST-000A.
- Rollback/verification: drop only these new empty persistent tables, restore the pre-migration schema, and destroy disposable fixture rows with their tenant.

### RST-006B - Execution exception requests

- Status: `PENDING_APPROVAL`
- Current component: absent version-bound cancellation and reopening requests.
- Proposed action: add request structures and guarded transactional transitions.
- Reason: terminal exceptions must not bypass locks or audit.
- Phase: Phase 3A
- Dependencies: RST-006A, RST-007B
- Exact paths: planned `custom/mjlfinancement/operationrequests.php`, planned `custom/mjlfinancement/class/mjlcancellationrequest.class.php`, planned `custom/mjlfinancement/class/mjlreopeningrequest.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_cancellation_request.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_cancellation_request.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_reopening_request.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_reopening_request.key.sql`, `tests/e2e/cases/activity-execution.cases.js`.
- Exact tables/data: planned empty `llx_mjlfinancement_cancellation_request` and `llx_mjlfinancement_reopening_request`; persistent target Opération/Activity tables remain empty during implementation.
- Action and data impact: add empty request tables and guarded transactional transitions; only disposable tests create requests, and legacy data receives no synthetic request.
- Backup prerequisite: Phase 3A pre-migration dump.
- Rollback/verification: drop the new empty persistent request tables, restore the pre-migration schema, and destroy disposable request rows with their tenant.

### RST-007A - Transactional audit foundation

- Status: `PENDING_APPROVAL`
- Current component: five obsolete audit/log mechanisms emptied by RST-000A.
- Proposed action: add an empty append-only transactional target audit foundation and retire legacy mechanisms.
- Reason: v2 requires one revision-linked mutation/audit contract.
- Phase: Phase 1
- Dependencies: RST-000A, RST-001
- Exact paths: `custom/mjlfinancement/class/mjlexchangelog.class.php`, `custom/mjlfinancement/class/mjlreport.class.php`, `custom/mjlfinancement/class/mjlvalidation.class.php`, `custom/mjlfinancement/class/mjlworkflowaction.class.php`, `custom/mjlfinancement/lib/mjl_workflow_audit.lib.php`, `custom/mjlfinancement/lib/mjl_timeline.lib.php`, `custom/mjlfinancement/lib/mjl_timeline_result.lib.php`, `custom/mjlfinancement/exchangelogs.php`, `custom/mjlfinancement/workflowactions.php`, planned `custom/mjlfinancement/class/mjlauditevent.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.key.sql`, `tests/unit/access-audit-fail-closed.test.js`.
- Exact tables/data: `llx_mjlfinancement_workflow_action`, `llx_mjlfinancement_validation`, `llx_mjlfinancement_exchange_log`, `llx_mjlfinancement_access_audit`, `llx_mjlfinancement_report`, planned `llx_mjlfinancement_audit_event`.
- Action and data impact: introduce an empty append-only target audit table and remove legacy readers/tables only after their consumers are replaced. No old actor snapshot or event is migrated.
- Backup prerequisite: RST-000, the executed RST-000A report, and a schema/code baseline.
- Rollback/verification: drop only the new empty table and restore prior empty legacy structures/code.

### RST-007B - Revision-linked Activity chronology

- Status: `PENDING_APPROVAL`
- Current component: legacy Activity timeline readers without immutable revision linkage.
- Proposed action: switch target chronology to revision-linked audit events.
- Reason: reviewers and users need linear evidence tied to exact revisions.
- Phase: Phase 2
- Dependencies: RST-006A, RST-007A
- Exact paths: `custom/mjlfinancement/lib/mjl_timeline.lib.php`, `custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php`, `custom/mjlfinancement/lib/mjl_timeline_result.lib.php`, `custom/mjlfinancement/activities.php`, planned `custom/mjlfinancement/lib/mjl_audit.lib.php`, `tests/e2e/activities.spec.js`, `tests/e2e/documents-audit.spec.js`.
- Exact tables/data: planned `llx_mjlfinancement_audit_event`, `llx_mjlfinancement_activity_revision`; empty retired legacy structures from RST-007A.
- Action and data impact: switch target Activity chronology to revision-linked events; no legacy chronology is retained or rewritten.
- Backup prerequisite: Phase 2 dump and RST-007A baseline.
- Rollback/verification: restore prior timeline readers and the Phase 2 dump.

### RST-008 - Preserve and retarget invitation/account lifecycle

- Status: `PENDING_APPROVAL`
- Current component: secure invitation/reset primitives with obsolete role/scope payload semantics.
- Proposed action: retain security primitives and replace authorization payload behavior.
- Reason: invitation-only access remains required but Partner scope does not.
- Phase: Phase 1
- Dependencies: RST-000A, RST-001, RST-007A
- Exact paths: `custom/mjlfinancement/admin/access.php`, `custom/mjlfinancement/invitation.php`, `custom/mjlfinancement/core/tpl/login.tpl.php`, `custom/mjlfinancement/core/tpl/passwordforgotten.tpl.php`, `custom/mjlfinancement/core/tpl/passwordreset.tpl.php`, `custom/mjlfinancement/lib/mjl_auth.lib.php`, `custom/mjlfinancement/lib/mjl_email.lib.php`, `custom/mjlfinancement/lib/mjl_email_presentation.lib.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_invitation.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_invitation.key.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_password_reset.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_password_reset.key.sql`, `tests/e2e/auth-invitations.spec.js`, `tests/e2e/cases/auth-lifecycle.cases.js`, `tests/e2e/email-notifications.spec.js`, `tests/e2e/cases/email-notifications.cases.js`.
- Exact tables/data: `llx_mjlfinancement_invitation`, `llx_mjlfinancement_password_reset`, `llx_user`, `llx_mjlfinancement_user_role`.
- Action and data impact: retain hashed single-use token, expiry, throttling, activation, and audit primitives in empty target tables; remove obsolete scope payloads and enforce exactly one revised effective role. RST-000A deletes every legacy token/invitation row without exporting raw material.
- Backup prerequisite: RST-000, executed RST-000A, and a code/schema baseline.
- Rollback/verification: restore prior empty structures/code and invalidate tokens issued only inside disposable target tests.

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
- Dependencies: RST-000A, RST-004, RST-009A
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
- Current component: 18-key CSV/XLSX finance report code after RST-000A deletes its local sample report rows/files.
- Proposed action: replace the old code catalog with target PDF/XLSX plus supplemental CSV outputs.
- Reason: target sources, scopes, formats, and audit contract differ.
- Phase: Phase 3B
- Dependencies: RST-006B, RST-007B
- Exact paths: `custom/mjlfinancement/reports.php`, `custom/mjlfinancement/class/mjlreport.class.php`, `custom/mjlfinancement/lib/mjl_reporting.lib.php`, `custom/mjlfinancement/lib/mjl_csv_export.lib.php`, `custom/mjlfinancement/lib/mjl_xlsx_export.lib.php`, planned `custom/mjlfinancement/lib/mjl_pdf_export.lib.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_report.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_report.key.sql`, `custom/mjlfinancement/sql/update_0.3.0.sql`, `custom/mjlfinancement/scripts/verify_traceability_exports.php`, `custom/mjlfinancement/scripts/verification/scope/traceability_targets.php`, `custom/mjlfinancement/scripts/verification/schema/core_schema.php`, `custom/mjlfinancement/scripts/check_production_readiness.php`, `custom/mjlfinancement/lib/mjl_navigation_registry.lib.php`, `custom/mjlfinancement/lib/mjl_workspace.lib.php`, `custom/mjlfinancement/lib/mjl_dashboard.lib.php`, `custom/mjlfinancement/lib/mjl_integrity.lib.php`, `custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php`, `custom/mjlfinancement/lib/mjl_traceability_scope.lib.php`, `custom/mjlfinancement/index.php`, `tests/e2e/reports-exports.spec.js`, `tests/e2e/cases/report-exports.cases.js`, `tests/contracts/navigation_registry_test.php`, `tests/e2e/access-shell.spec.js`, `tests/e2e/cases/navigation-shell.cases.js`, `tests/e2e/cases/scope-security.cases.js`, `tests/e2e/screen-inventory.spec.js`, `tests/manual/accessibility-gate.spec.js`, `tests/runner/run-suite.js`, `tests/unit/operational-script-boundary.test.js`; continued absence of removed persistent report seed sources is an invariant.
- Exact tables/data: empty target `llx_mjlfinancement_report`; disposable generated test outputs; read-only target Activity/Opération/revision/audit sources.
- Action and data impact: replace all 18 legacy code keys with the approved PDF/XLSX catalog and retain supplemental CSV; create no persistent sample report row and label no output official without later approval.
- Backup prerequisite: RST-000, executed RST-000A, and a report code/schema baseline.
- Rollback/verification: restore prior registry/export code; disposable report fixtures and files are destroyed with their tenant.

### RST-013A - Phase 1 test reset

- Status: `PENDING_APPROVAL`
- Current component: Phase 1 tests encoding old roles, scopes, and finance behavior.
- Proposed action: classify and replace/remove only the exact named tests with security preservation.
- Reason: old green tests would validate superseded behavior.
- Phase: Phase 1
- Dependencies: RST-001, RST-003, RST-004, RST-008, RST-009A
- Exact paths: `tests/characterization/finance.spec.js`, `tests/characterization/permissions.spec.js`, `tests/characterization/cases/budget-integrity.cases.js`, `tests/characterization/cases/convention-integrity.cases.js`, `tests/characterization/cases/fund-receipt-integrity.cases.js`, `tests/e2e/access-shell.spec.js`, `tests/e2e/auth-invitations.spec.js`, `tests/e2e/expenses.spec.js`, `tests/e2e/finance.spec.js`, `tests/e2e/partners-projects.spec.js`, `tests/e2e/scope-security.spec.js`, `tests/e2e/cases/auth-lifecycle.cases.js`, `tests/e2e/cases/expense-disbursement.cases.js`, `tests/e2e/cases/expense-workflow.cases.js`, `tests/e2e/cases/partner-project.cases.js`, `tests/e2e/cases/scope-security.cases.js`, `tests/unit/access-audit-fail-closed.test.js`.
- Exact tables/data: disposable test fixtures inside isolated tenants only.
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
- Backup prerequisite: Phase 3A commit and disposable report-fixture definitions.
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

### RST-014A - Phase 1 disposable test-fixture infrastructure

- Status: `PENDING_APPROVAL`
- Current component: legacy persistent sources removed by RST-000A and no target disposable record factories.
- Proposed action: implement isolated Phase 1 test-record factories and enforce the continued absence of persistent seed behavior.
- Reason: target behavior needs disposable verification without recreating RST-000A data.
- Phase: Phase 1
- Dependencies: RST-000A, RST-001, RST-003, RST-004, RST-008
- Exact paths: the non-seeding replacement for `custom/mjlfinancement/scripts/bootstrap_poc.php`; continued absence of `custom/mjlfinancement/scripts/seed_sample_data.php`, `custom/mjlfinancement/lib/mjl_sample_data.lib.php`, `custom/mjlfinancement/sample_data`, and `mjl_dolibarr_poc_sample_data`; and disposable runner/factory paths approved with RST-013A.
- Exact tables/data: no persistent rows. Test factories may create only run-scoped Phase 1 accounts and reference records inside the runner's isolated database/entity and volumes.
- Action and data impact: keep legacy CSVs, placeholders, passwords, and auto-seeding absent; allow tests to create minimal records and require teardown to destroy them. Normal local startup remains empty.
- Backup prerequisite: Git baseline, RST-000, and executed RST-000A.
- Rollback/verification: restore source files only; verify normal startup creates no sample row, the preserved technical administrator remains, and test-run containers/volumes are removed on success, failure, and interruption.

### RST-014B - Phase 2 disposable test fixtures

- Status: `PENDING_APPROVAL`
- Current component: no persistent Phase 2 dataset and Phase 1 disposable test factories.
- Proposed action: extend isolated factories with the minimum balanced planning, assignment, Opération, revision, and validation records required by Phase 2 tests.
- Reason: Phase 2 requires evidence without introducing persistent sample data.
- Phase: Phase 2
- Dependencies: RST-002B, RST-005, RST-006A, RST-014A
- Exact paths: Phase 2 files under `tests/fixtures` or `tests/helpers` approved with RST-013B; no path under `custom/mjlfinancement/sample_data`.
- Exact tables/data: disposable target Activity, assignment, Opération-planning, revision, and contributor rows inside an isolated test tenant only.
- Action and data impact: create records per run and destroy them with the tenant; no execution amount, persistent seed, or legacy mapping.
- Backup prerequisite: Phase 1 commit and disposable-runner configuration snapshot.
- Rollback/verification: restore fixture helper code and prove tenant teardown removes every record/volume.

### RST-014C - Phase 3A disposable test fixtures

- Status: `PENDING_APPROVAL`
- Current component: Phase 2 isolated factories without execution and exception-request cases.
- Proposed action: add explicit spent/null/zero, status, cancellation, and reopening cases to disposable factories.
- Reason: Phase 3A edge cases require evidence without persistent sample data.
- Phase: Phase 3A
- Dependencies: RST-006B, RST-014B
- Exact paths: Phase 3A files under `tests/fixtures` or `tests/helpers` approved with RST-013C.
- Exact tables/data: disposable Opération, cancellation-request, and reopening-request rows inside an isolated test tenant only.
- Action and data impact: create explicit test values per run without converting null to zero or fabricating legacy history; destroy all records with the tenant.
- Backup prerequisite: Phase 2 commit and runner snapshot.
- Rollback/verification: restore helper code and prove teardown on success, failure, and interruption.

### RST-014D - Phase 3B disposable report fixtures

- Status: `PENDING_APPROVAL`
- Current component: isolated Phase 3A factories and no persistent report catalog data.
- Proposed action: add disposable target operational PDF/XLSX and supplemental CSV report cases.
- Reason: Phase 3B output behavior requires evidence without a persistent sample catalog.
- Phase: Phase 3B
- Dependencies: RST-012, RST-014C
- Exact paths: Phase 3B report files under `tests/fixtures` or `tests/helpers` approved with RST-013D; no persistent `fixed_reports.csv` replacement.
- Exact tables/data: disposable report rows and generated files inside run-scoped database/document volumes only.
- Action and data impact: generate target test outputs per run, label none official, and remove rows/files/volumes with the tenant.
- Backup prerequisite: Phase 3A commit and runner snapshot.
- Rollback/verification: restore helper code and prove no report fixture or generated output survives teardown.

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
