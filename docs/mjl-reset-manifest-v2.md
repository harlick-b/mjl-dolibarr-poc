# MJL Reset Manifest v2

RST-000, RST-000A, RST-001, RST-002A, and RST-003 were explicitly approved and
executed. RST-003 completed on 2026-08-13 with an empty reference catalog;
RST-007A, RST-004, RST-008, and RST-009A are executed; their operational-log
exception was ratified by DEC-039. RST-010A, RST-013A, and RST-014A are
executed. Phase 1 is `PHASE_1_READY_WITH_NOTES`; the signed human accessibility
gate is deferred and Phase 2 remains separately gated.
All other later actions remain unapproved and unexecuted.
Each ID below is an independently scoped approval unit. Approval of a parent
number does not approve a suffixed unit.

## Safety and Approval Contract

- RST-000, RST-000A, RST-001, RST-002A, RST-003, RST-007A, RST-004, RST-008,
  RST-009A, RST-010A, RST-013A, and RST-014A are `EXECUTED`; every other action
  is `PENDING_APPROVAL`.
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
- Current component: a verified-empty nullable responsible-user column forced
  null by `chk_mjl_activity_responsible_dormant`, plus the empty retained scope
  table; no Activity row or responsible relationship exists. Any nonzero
  Activity/responsible/scope row is a hard preflight stop, never migration input.
- Proposed action: create time-bounded Activity assignments and guarded,
  expected-version, transactionally audited add/remove/transfer/primary commands;
  verify their guards; then atomically remove the exact dormant responsible-user
  constraint/column and empty legacy scope table without mapping old values.
  Atomically replace `llx_mjl_activity_rst005_bu` with the sealed
  assignment-only `llx_mjl_activity_rst002b_bu` guard.
- Reason: the target supports primary and additional current Agents with immediate revocation.
- Phase: Phase 2
- Dependencies: RST-002A, RST-005, RST-007A
- Exact paths: `custom/mjlfinancement/activities.php`, `custom/mjlfinancement/class/mjlactivity.class.php`, `custom/mjlfinancement/lib/mjl_activity_access.lib.php`, `custom/mjlfinancement/lib/mjl_audit.lib.php`, `custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql`, `custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql`, planned `custom/mjlfinancement/class/mjlactivityassignment.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.key.sql`, planned `custom/mjlfinancement/scripts/rst002b_activity_assignment.php`, planned `custom/mjlfinancement/scripts/verification/schema/activity_assignment.php`, planned `tests/e2e/rst002b-activity-assignment.spec.js`, and planned `tests/unit/rst002b-activity-assignment.test.js`. Shared Phase 2 suites remain reserved for RST-013B.
- Exact tables/data: planned empty `llx_mjlfinancement_activity_assignment`;
  exact RST-005 `chk_mjl_activity_responsible_dormant` and empty
  `llx_mjlfinancement_activity.fk_user_responsible`; empty
  `llx_mjlfinancement_user_soc_scope` table definition; RST-007A audit events
  only for authorized disposable assignment commands.
- Action and data impact: introduce the assignment structure and versioned
  service, append each assignment mutation and Activity-version change with its
  audit event in one transaction, and remove the named empty responsible-user
  check/field and scope table through one explicit migration. No legacy
  Activity-to-Agent mapping is authorized. RST-006A creation must invoke this
  service so Activity, creator-as-primary assignment, version, and audit commit
  atomically.
  The RST-002B Activity trigger permits only `version = old.version + 1`,
  `fk_user_modif`, and automatic `tms` changes made by that expected-version
  assignment service; it rejects changes to entity, reference, creator,
  creation date, every structural field, amounts, status, cancellation, and all
  other columns. Its separately reviewed strategy must seal the exact forward
  and rollback trigger bodies/digests and prove structural/direct-SQL bypasses
  fail before implementation.
- Backup prerequisite: RST-000, executed RST-000A/RST-002A/RST-005/RST-007A,
  exact empty-row proof, and forward/rollback schema digests sealed by the
  separately reviewed RST-002B strategy.
- Rollback/verification: after reverse-dependent rollback and only with empty
  Activity/assignment/audit targets, atomically restore the exact nullable
  responsible field plus `chk_mjl_activity_responsible_dormant` and the empty
  scope-table definition, replace `llx_mjl_activity_rst002b_bu` with the exact
  RST-005 unconditional update denial, reinstate fail-closed assignment guards,
  and prove the sealed rollback digest. No row export is reloaded.

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

- Status: `EXECUTED` (implemented 2026-08-14; operational-log checksum deviation ratified by DEC-039 on 2026-08-18)
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

- Status: `EXECUTED` on 2026-09-01 under DEC-047 at commit
  `b9520f5aaf38629d13618034cce546e71637ebab` and exact
  `complete_tree_sha256`
  `a01bfd02d6e0bff4c1039f5f191233bfa5fe9cbc170c715f640737d75403f40f`.
- Current component: the verified-empty finalized target Activity foundation,
  a Supervisor/Validator-only read projection, fail-closed mutation seams, no
  Activity navigation, and no workflow-action table.
- Executed action: replaced only the verified-empty interim table with the exact
  target Activity foundation, database invariants, entity-scoped read model,
  and optimistic-lock seam. Keep all business mutation and downstream Phase 2
  structures dormant.
- Reason: the legacy model cannot represent target planning safely, while
  assignments, revisions, review decisions, audit coverage, UI, and reusable
  fixtures have later separately approved owners.
- Phase: Phase 2
- Dependencies: the formal Phase 1 verdict and retained executed RST-000A,
  RST-001, RST-002A, RST-003, RST-004, RST-007A, RST-008, RST-009A, RST-010A,
  RST-013A, and RST-014A
- Exact paths: the closed create/modify/retain inventory in
  `docs/mjl-rst-005-activity-foundation-strategy.md`. The formerly listed
  recovery helper, Activity JavaScript, status-integrity script, and
  workflow/execution case files are absent and remain absent.
- Exact schema oracles: `docs/mjl-rst-005-phase1-activity-schema.sql` at
  SHA-256 `db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2`
  and `docs/mjl-rst-005-target-activity-schema.sql` at SHA-256
  `8eb99ee99c6dc748bd368e925e9938ccf086291d264e3812ac6320c8ec06b745`.
- Exact tables/data: verified-empty `llx_mjlfinancement_activity` only.
  `llx_mjlfinancement_workflow_action` is absent and remains absent. RST-005
  creates no persistent business or audit row.
- Action and data impact: atomically replace the empty interim schema with the
  exact target Activity foundation. No Activity, workflow, assignment,
  responsible-user, revision, review, audit, or historical value is converted.
  Disposable direct-SQL canaries are restricted to the isolated RST-014A
  tenant and destroyed with it.
- Backup prerequisite: executed RST-000A/RST-003/RST-004, an exact approved old
  schema/source digest, zero Activity/downstream rows, and checksummed schema
  plus full-database backups captured immediately before cutover.
- Rollback/verification: before downstream execution and only while empty,
  atomically restore the Phase 1 containment/read-only interim schema. After a
  dependent unit or target row exists, standalone rollback refuses and leaves
  the target schema read-only pending reverse-dependency rollback or an
  explicitly approved full restore. Never restore legacy document, Convention,
  workflow, execution, email, navigation, or sample behavior. The exact
  migration, verification, checksum, and rollback contract is
  `docs/mjl-rst-005-activity-foundation-strategy.md`.

### RST-006A - Opération planning, immutable revisions, and review decisions

- Status: `PENDING_APPROVAL`
- Current component: absent first-class Opérations, revisions, contributors,
  and revision-bound Review Decisions.
- Proposed action: add empty target planning, immutable-revision, contributor,
  and append-only Review Decision structures plus dedicated Activity creation,
  structural editing, balanced planning, submission/resubmission, correction,
  revision-bound review, separation-of-duties, optimistic-lock, and start-freeze
  transactions. Every mutation appends its RST-007A audit event in the same
  transaction. Atomically replace RST-005's named dormant-state constraint with
  a Phase 2-only constraint and replace RST-002B's assignment-only update guard
  with the full structural/assignment expected-version guard only when all
  guards and structures activate; retain RST-005's delete-denial trigger.
  Creation rejects inactive Partner/Project references and invokes RST-002B's
  creator-primary assignment seam atomically. Revision 1 sets
  `first_submitted_amount` exactly once; final validation alone projects the
  current revision amount to `latest_validated_amount` in the same guarded
  revision/status/decision/audit transaction.
- Reason: target balancing and identity-based review require these entities;
  no other reset unit owns the canonical Review Decision record.
- Phase: Phase 2
- Dependencies: RST-002B, RST-005, RST-007A
- Exact paths: planned `custom/mjlfinancement/operations.php`, planned `custom/mjlfinancement/class/mjloperation.class.php`, planned `custom/mjlfinancement/class/mjlactivityrevision.class.php`, planned `custom/mjlfinancement/class/mjlrevisioncontributor.class.php`, planned `custom/mjlfinancement/class/mjlreviewdecision.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_operation.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_operation.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_revision.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_activity_revision.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_revision_contributor.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_revision_contributor.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_review_decision.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_review_decision.key.sql`, `custom/mjlfinancement/activities.php`, planned `tests/e2e/rst006a-activity-planning.spec.js`, and planned `tests/unit/rst006a-activity-planning.test.js`. Shared Phase 2 suites remain reserved for RST-013B.
- Additional exact Activity/audit paths required by the guarded transaction:
  `custom/mjlfinancement/class/mjlactivity.class.php`,
  `custom/mjlfinancement/lib/mjl_audit.lib.php`,
  `custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql`,
  `custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql`, and planned
  `custom/mjlfinancement/scripts/rst006a_activity_planning.php`.
- Exact tables/data: planned `llx_mjlfinancement_operation`,
  `llx_mjlfinancement_activity_revision`,
  `llx_mjlfinancement_revision_contributor`, and
  `llx_mjlfinancement_review_decision`; no Expense data.
- Action and data impact: add empty target tables; only disposable tests may populate them during implementation. No legacy mapping, spending, or historical revision is fabricated.
- Backup prerequisite: executed RST-002B/RST-005/RST-007A evidence; exact
  post-RST-002B Activity, assignment, audit schema/row digests; and checksummed
  forward/rollback manifests sealed by the separately approved RST-006A
  strategy before migration.
- Rollback/verification: after reverse-dependent rollback and only while target
  persistent tables are empty, drop only the new tables, atomically restore
  RST-005's exact dormant-state constraint and RST-002B's sealed assignment-only
  update guard, retain RST-005's delete denial, and destroy disposable fixture
  rows with their tenant. Never leave mutation enabled without revision/audit
  guards.

### RST-006B - Execution exception requests

- Status: `PENDING_APPROVAL`
- Current component: absent version-bound cancellation and reopening requests.
- Proposed action: add request structures and guarded transactional transitions.
- Reason: terminal exceptions must not bypass locks or audit.
- Phase: Phase 3A
- Dependencies: RST-006A, RST-007B
- Exact paths: planned `custom/mjlfinancement/operationrequests.php`, planned `custom/mjlfinancement/class/mjlcancellationrequest.class.php`, planned `custom/mjlfinancement/class/mjlreopeningrequest.class.php`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_cancellation_request.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_cancellation_request.key.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_reopening_request.sql`, planned `custom/mjlfinancement/sql/llx_mjlfinancement_reopening_request.key.sql`, `tests/e2e/cases/activity-execution.cases.js`.
- Activity cancellation also owns the guarded replacement of
  `chk_mjl_activity_rst006a_phase2`; its separately reviewed exact inventory
  must include `custom/mjlfinancement/class/mjlactivity.class.php`,
  `custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql`, and
  `custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql` before that
  status can be enabled.
- Exact tables/data: planned empty `llx_mjlfinancement_cancellation_request` and `llx_mjlfinancement_reopening_request`; persistent target Opération/Activity tables remain empty during implementation.
- Action and data impact: add empty request tables and guarded transactional transitions; only disposable tests create requests, and legacy data receives no synthetic request.
- Backup prerequisite: Phase 3A pre-migration dump.
- Rollback/verification: drop the new empty persistent request tables, restore the pre-migration schema, and destroy disposable request rows with their tenant.

### RST-007A - Transactional audit foundation

- Status: `EXECUTED` (implemented 2026-08-14; operational-log checksum deviation ratified by DEC-039 on 2026-08-18)
- Current component: five obsolete audit/log mechanisms emptied by RST-000A.
- Proposed action: add an empty append-only transactional target audit foundation and retire legacy mechanisms.
- Reason: v2 requires one revision-linked mutation/audit contract.
- Phase: Phase 1
- Dependencies: RST-000A, RST-001
- Exact paths: removed `custom/mjlfinancement/class/mjlexchangelog.class.php`,
  `custom/mjlfinancement/class/mjlreport.class.php`,
  `custom/mjlfinancement/class/mjlvalidation.class.php`,
  `custom/mjlfinancement/class/mjlworkflowaction.class.php`,
  `custom/mjlfinancement/lib/mjl_timeline.lib.php`,
  `custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php`, and
  `custom/mjlfinancement/exchangelogs.php`; retained/retargeted
  `custom/mjlfinancement/lib/mjl_audit.lib.php`,
  `custom/mjlfinancement/lib/mjl_workflow_audit.lib.php`,
  `custom/mjlfinancement/lib/mjl_timeline_result.lib.php`,
  `custom/mjlfinancement/workflowactions.php`,
  `custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.sql`,
  `custom/mjlfinancement/sql/llx_mjlfinancement_audit_event.key.sql`, and
  `tests/unit/access-audit-fail-closed.test.js`.
- Exact tables/data: absent `llx_mjlfinancement_workflow_action`,
  `llx_mjlfinancement_validation`, `llx_mjlfinancement_exchange_log`,
  `llx_mjlfinancement_access_audit`, and `llx_mjlfinancement_report`; existing
  empty append-only `llx_mjlfinancement_audit_event`.
- Action and data impact: introduce an empty append-only target audit table and remove legacy readers/tables only after their consumers are replaced. No old actor snapshot or event is migrated.
- Backup prerequisite: RST-000, the executed RST-000A report, and a schema/code baseline.
- Rollback/verification: once any dependent unit exists, standalone rollback
  refuses, retains the append-only audit foundation read-only, and disables
  dependent mutations pending reverse-dependency rollback or an explicitly
  approved full-baseline restore. Never independently drop the audit table or
  recreate retired audit tables, classes, readers, or routes.

### RST-007B - Revision-linked Activity chronology

- Status: `PENDING_APPROVAL`
- Current component: Activity chronology presentation/readers are absent after
  RST-007A; the append-only audit foundation exists and is empty in the shared
  tenant, while Activity revisions are not yet implemented.
- Proposed action: create a new read-only target chronology projection from the
  revision-linked audit events already appended atomically by their owning
  business transactions. Restore no legacy reader or chronology data.
- Reason: reviewers and users need linear evidence tied to exact revisions.
- Phase: Phase 2
- Dependencies: RST-006A, RST-007A
- Exact paths: planned `custom/mjlfinancement/lib/mjl_timeline.lib.php`, planned
  `custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php`, planned
  `tests/e2e/rst007b-activity-chronology.spec.js`, and planned
  `tests/unit/rst007b-activity-chronology.test.js`; retained
  `custom/mjlfinancement/lib/mjl_timeline_result.lib.php`,
  `custom/mjlfinancement/activities.php`, and
  `custom/mjlfinancement/lib/mjl_audit.lib.php`,
  as current inputs. Shared Activity/document suites remain reserved for
  RST-013B/RST-013C.
- Exact tables/data: executed RST-007A
  `llx_mjlfinancement_audit_event` as retained read-only input and planned
  `llx_mjlfinancement_activity_revision`; empty retired legacy structures from
  RST-007A.
- Action and data impact: create the target Activity chronology projection over
  revision-linked events; no legacy chronology is retained, restored, or
  rewritten.
- Backup prerequisite: Phase 2 dump and RST-007A baseline.
- Rollback/verification: disable/remove only the RST-007B chronology projection,
  retain the RST-007A audit source and RST-006A business state read-only, and
  verify exact source/schema/data digests. Never restore legacy timeline readers
  or overwrite audit/business state from a broad Phase 2 dump.

### RST-008 - Preserve and retarget invitation/account lifecycle

- Status: `EXECUTED` (implemented 2026-08-14; operational-log checksum deviation ratified by DEC-039 on 2026-08-18)
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

- Status: `EXECUTED` (implemented 2026-08-14; operational-log checksum deviation ratified by DEC-039 on 2026-08-18)
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

- Status: `EXECUTED` on 2026-08-19 after separate explicit approval.
- Current component: denial-only MJL document routes, enabled native ECM storage,
  an entity-filtered ECM pointer helper, and incomplete native delivery guards.
  The former document library, upload/download helpers, audit adapter, lifecycle
  tests, and exchange-log table are already absent.
- Proposed action: harden containment without implementing document management:
  make authenticated and anonymous GET/POST requests fail with HTTP 403, close
  native ECM delivery bypasses, retain only the enumerated dormant seams, and
  prove that filesystem and ECM state are byte-for-byte/row-for-row unchanged.
- Reason: document business behavior remains disabled until the sequenced
  Phase 4 implementation, while the pre-implementation denial routes returned
  an anonymous login page with HTTP 200 and native root-level delivery
  entrypoints were not fully contained.
- Phase: Phase 1
- Dependencies: RST-000A, RST-004, RST-009A
- Exact paths: `custom/mjlfinancement/documents.php`,
  `custom/mjlfinancement/documentdownload.php`,
  `custom/mjlfinancement/nativeforbidden.php`,
  `custom/mjlfinancement/deployment/apache-native-guard.conf`,
  `custom/mjlfinancement/js/native_guard.js.php`,
  `custom/mjlfinancement/css/mjl_app.css.php`,
  `custom/mjlfinancement/lib/mjl_scope.lib.php`,
  `custom/mjlfinancement/class/actions_mjlfinancement.class.php`,
  `custom/mjlfinancement/scripts/bootstrap_poc.php`, `package.json`, the
  disposable runner/configuration under `tests/runner` and `tests/fixtures`, a
  focused document-containment E2E/contract suite, and removal of
  `tests/evidence/inter-font-live.js`. The complete inventory and behavior are
  fixed by `docs/mjl-rst-010a-containment-strategy.md`.
- Exact tables/data: read-only native `llx_ecm_files` and
  `llx_ecm_directories`, native ECM module configuration, and the full
  `data/documents` tree. At review time `llx_ecm_files` has zero rows,
  `llx_ecm_directories` has one retained legacy metadata row, the obsolete
  `llx_mjlfinancement_exchange_log` table is absent, and the document tree has
  eight non-business files. None is an RST-010A mutation target.
- Action and data impact: change containment code/tests/docs only. Create no
  persistent row or file; delete, move, rename, expose, restore, or migrate no
  ECM row or document; add no navigation, rights, upload, download, preview,
  category, version, retention, replacement, or document-audit behavior.
- Backup prerequisite: immediately before implementation, capture a NUL-safe
  path/type/content manifest for the complete document tree and canonical
  all-column ordered row manifests for both ECM tables, with individual and
  aggregate SHA-256 digests. Record current state rather than reusing an RST-000
  or DEC-039 digest.
- Rollback/verification: rollback may restore only a denial-only containment
  baseline. It must never restore the former library, guarded-download
  implementation, document helpers, document audit events, lifecycle tests,
  navigation, or legacy ECM behavior. Disposable authenticated/anonymous GET
  and POST, traversal, cross-entity, native ECM, and before/after filesystem and
  ECM checksum checks passed as recorded in
  `docs/mjl-rst-010a-execution-report.md`.
- Later authority clarification: DEC-042 narrows future Phase 4 Admin document
  reads/recovery to the runtime active Dolibarr entity and defines append-only
  category-rule and lifecycle records. It changes no executed RST-010A path,
  data, checksum, rollback boundary, or denial behavior.

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

- Status: `EXECUTED` on 2026-08-21 by DEC-044 after complete committed-source
  gates and clean final Standards, Spec, and Security/Isolation reviews.
- Current component: the executed implementation preserves the four named
  current-purpose paths, records the 13 legacy paths already deleted by
  `3b5f767`, retargets characterization to `permissions.spec.js`, replaces the
  stale coverage registry, and adds the approved current-model security cases.
- Approved action: preserve the four current-purpose tests, record the 13 prior
  deletions without reclaiming them, retarget configs/evidence to maintained
  Phase 1 suites, and consume only the approved RST-014A fixture interface.
- Reason: old green tests would validate superseded behavior.
- Phase: Phase 1
- Dependencies: executed RST-001, RST-002A, RST-003, RST-004, RST-007A,
  RST-008, RST-009A, RST-010A, and RST-014A
- Exact paths: `tests/characterization/finance.spec.js`, `tests/characterization/permissions.spec.js`, `tests/characterization/cases/budget-integrity.cases.js`, `tests/characterization/cases/convention-integrity.cases.js`, `tests/characterization/cases/fund-receipt-integrity.cases.js`, `tests/e2e/access-shell.spec.js`, `tests/e2e/auth-invitations.spec.js`, `tests/e2e/expenses.spec.js`, `tests/e2e/finance.spec.js`, `tests/e2e/partners-projects.spec.js`, `tests/e2e/scope-security.spec.js`, `tests/e2e/cases/auth-lifecycle.cases.js`, `tests/e2e/cases/expense-disbursement.cases.js`, `tests/e2e/cases/expense-workflow.cases.js`, `tests/e2e/cases/partner-project.cases.js`, `tests/e2e/cases/scope-security.cases.js`, `tests/unit/access-audit-fail-closed.test.js`.
- Exact supporting paths: `tests/characterization/playwright.config.js`,
  `tests/e2e/phase1-reset.spec.js`, `tests/runner/run-suite.js`,
  `tests/runner/disposable-run.js`, `package.json`, `playwright.config.js`,
  `docs/mjl-acceptance-tests.md`, `docs/mjl-test-coverage-registry.md`,
  `docs/mjl-reset-manifest-v2.md`, `docs/mjl-implementation-roadmap-v2.md`,
  `docs/mjl-docs-index.md`, `docs/mjl-authoritative-decisions.md`,
  `docs/mjl-decision-register-v2.md`,
  `docs/mjl-rst-013a-test-reset-strategy.md`, and
  `docs/mjl-rst-013a-execution-report.md`.
- Exact tables/data: RST-014A disposable test fixtures inside isolated tenants
  plus exactly one same-entity/matched-parent Activity projection control with
  unique current-field canaries, focused poison
  `llx_mjlfinancement_user_soc_scope`, deliberately cross-entity/corrupt-parent
  `llx_mjlfinancement_activity`, and no direct-SQL audit rows. Fixture setup is
  factory-only in a serial group and SQL fixture resumption is forbidden;
  shared database, ECM, documents, and the
  exact protected source paths enumerated by the strategy are read-only
  evidence. Plaintext database manifests are never materialized; retained
  evidence contains only streaming digests, schema summaries, and nonsensitive
  counts.
- Action and data impact: preserve the four present paths; record the 13 paths
  deleted by `3b5f767` with named replacement/obsolete rationale; recreate none.
  Add current-model dynamic poison-scope, hostile scope-input, Agent direct
  GET/POST no-side-effect, current Activity class/notrigger, exact safe reviewer
  projection, and corrupt/cross-entity reviewer-read coverage to a retained
  path. Prove removed ExchangeLog/timeline/document/Convention seams through
  maintained absence gates; never recreate them for a dynamic test.
- Backup prerequisite: baseline commit and diff of each named test.
- Rollback/verification: restore only RST-013A source/docs; never recreate absent
  tests or legacy behavior. Run every focused Phase 1 suite, unit, verify,
  characterization, E2E, shared-state checks, and unconditional teardown proof.
  Any prior ready verdict becomes `PHASE_1_BLOCKED` until equivalent replacement
  coverage is separately approved and cleanly reviewed.
  The exact reviewed contract is `docs/mjl-rst-013a-test-reset-strategy.md`.

### RST-013B - Phase 2 test reset

- Status: `PENDING_APPROVAL`
- Current component: the shared Activity planning/validation suite and all six
  formerly listed legacy paths are absent after RST-013A; only focused
  RST-002B/RST-005/RST-006A/RST-007B verification exists by this point.
- Proposed action: create new target Phase 2 revision, assignment, separation,
  correction, validation, scope-security, and locking journeys from the
  RST-014B disposable factory. Restore no legacy assertion.
- Reason: Phase 2 must validate its target behavior before its phase verdict.
- Phase: Phase 2
- Dependencies: RST-002B, RST-005, RST-006A, RST-007B, RST-014B
- Exact paths: planned `tests/e2e/activities.spec.js`, planned `tests/e2e/cases/activity-workflow.cases.js`, planned `tests/e2e/cases/scope-security.cases.js`, planned `tests/contracts/behavior_contracts_test.php`, planned `custom/mjlfinancement/scripts/verification/schema/activity_status_integrity.php`, and planned `custom/mjlfinancement/scripts/verify_activity_workflow.php`.
- Exact tables/data: disposable test fixtures only.
- Action and data impact: add only target Activity planning/workflow assertions
  in Phase 2; production/local business rows are untouched.
- Backup prerequisite: baseline/phase commits.
- Rollback/verification: remove/disable only the RST-013B-created target suites
  and retain focused per-unit tests plus every RST-013A absence gate. Never
  restore a legacy suite, path, assertion, or behavior.

### RST-013C - Phase 3A test reset

- Status: `PENDING_APPROVAL`
- Current component: the three formerly listed execution/document suite paths
  are absent after RST-013A; focused Phase 3A unit verification is the only
  permitted precursor.
- Proposed action: create new target spent, lifecycle, cancellation, reopening,
  derivation, completeness, document-audit, and concurrency journeys.
- Reason: Phase 3A must validate execution and exception behavior before its verdict.
- Phase: Phase 3A
- Dependencies: RST-006B, RST-007B, RST-013B
- Exact paths: planned `tests/e2e/cases/activity-execution.cases.js`, planned
  `tests/e2e/documents-audit.spec.js`, and planned
  `custom/mjlfinancement/scripts/verification/schema/activity_execution_schema.php`.
- Exact tables/data: disposable Phase 3A test fixtures only.
- Action and data impact: add target execution/request assertions while
  retaining guarded-document security evidence; local business rows are
  untouched.
- Backup prerequisite: baseline and Phase 2 commits.
- Rollback/verification: remove/disable only RST-013C-created target suites and
  retain prior focused/Phase 2 tests and RST-013A absence gates. Never restore
  legacy execution/document assertions.

### RST-013D - Phase 3B test reset

- Status: `PENDING_APPROVAL`
- Current component: legacy dashboard, alert, report, audit, and presentation tests.
- Proposed action: align tests with target metrics and PDF/XLSX plus supplemental CSV outputs.
- Reason: Phase 3B behavior must be tested in Phase 3B rather than deferred to hardening.
- Phase: Phase 3B
- Dependencies: RST-009C, RST-011, RST-012, RST-013C
- Exact paths: `tests/e2e/dashboards-alerts.spec.js`, `tests/e2e/reports-exports.spec.js`, `tests/e2e/cases/report-exports.cases.js`, `tests/e2e/cases/role-dashboards.cases.js`, `tests/e2e/cases/scoped-alerts.cases.js`, `tests/manual/accessibility-gate.spec.js`, `tests/unit/design-system-v3-remediation.test.js`, `tests/unit/design-system-v3.test.js`, `tests/contracts/page_header_test.php`, `tests/contracts/presentation_convergence_test.php`, `tests/contracts/table_presentation_test.php`, `tests/evidence/inter-font-css.js`, `tests/helpers/responsive-shell.js`.
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

- Status: `EXECUTED` (verified and independently reviewed 2026-08-21)
- Current component: the executed disposable Compose/runner isolation includes
  one guarded general Phase 1 record-factory interface; migrated Phase 1 specs
  consume it instead of duplicating raw SQL principal/reference setup.
- Executed action: added one guarded structured factory for minimal users and
  Partenaire/Projet/Type d'Opération preconditions, retained existing
  isolation, and enforced the continued absence of persistent seed behavior.
- Reason: target behavior needs disposable verification without recreating RST-000A data.
- Phase: Phase 1
- Dependencies: executed RST-000A, RST-001, RST-002A, RST-003, RST-004,
  RST-007A, RST-008, RST-009A, and RST-010A
- Exact paths: `tests/helpers/phase1-fixture.js`,
  `tests/fixtures/phase1-fixture.php`,
  `tests/fixtures/phase1-fixture-preflight.php`,
  `tests/fixtures/database-evidence.php`,
  `tests/runner/disposable-evidence.js`,
  `tests/unit/phase1-fixture.test.js`,
  `tests/unit/disposable-evidence.test.js`, and
  `tests/e2e/fixture-isolation.spec.js`; modified
  `tests/fixtures/disposable-compose.override.yml`,
  `tests/helpers/mjl-test-runtime.js`,
  `tests/helpers/verify-disposable-environment.js`,
  `tests/runner/disposable-policy.js`, `tests/runner/disposable-run.js`,
  `tests/runner/phase1-cutover-rehearsal.js`, `tests/runner/run-suite.js`,
  `tests/unit/disposable-policy.test.js`, `tests/unit/disposable-run.test.js`,
  `tests/e2e/phase1-reset.spec.js`, `tests/e2e/auth-concurrency.spec.js`,
  `tests/e2e/cases/partner-project.cases.js`,
  `tests/e2e/document-containment.spec.js`,
  `tests/fixtures/auth-parallel-worker.php`,
  `tests/fixtures/rst010a-document-state.php`,
  `tests/manual/accessibility-gate.spec.js`,
  `tests/manual/playwright.config.js`, `playwright.config.js`,
  `package.json`, `docs/mjl-acceptance-tests.md`,
  `docs/mjl-test-coverage-registry.md`, `docs/mjl-reset-manifest-v2.md`,
  `docs/mjl-implementation-roadmap-v2.md`, `docs/mjl-docs-index.md`,
  `docs/mjl-authoritative-decisions.md`,
  `docs/mjl-decision-register-v2.md`,
  `docs/mjl-rst-014a-disposable-fixture-strategy.md`, and
  `docs/mjl-rst-014a-execution-report.md`. Retained/absent invariants are
  enumerated in the strategy.
- Exact tables/data: no shared or post-teardown rows. Inside the disposable
  database only, the runner may create one entity-0 `llx_const` run-sentinel
  row; each successful factory request may create one entity-0 `llx_const`
  namespace-reservation row plus its allowlisted `llx_user`,
  `llx_mjlfinancement_user_role`, `llx_societe`, `llx_projet`, and
  `llx_mjlfinancement_operation_type` rows. The exact filesystem support writes
  are `/var/www/documents/.mjl-disposable-fixture-sentinel` in the disposable
  document volume and `/run/mjl-test/client.cnf` in a dedicated disposable
  MariaDB tmpfs; the latter is root-owned mode 0600, is created atomically only
  after topology validation, is unlinked by the finalizer when reachable, and
  is unconditionally destroyed with the service. Plaintext shared-state
  manifests are never materialized; retained evidence contains only streaming
  digests, schema summaries, and
  nonsensitive counts. The exact protected read-only source paths and generated
  evidence boundary are enumerated in the strategy. This closed list governs
  new RST-014A factory/support writes. Pre-existing RST-003, RST-007A, RST-008,
  RST-009A, RST-010A, and Phase 1 reset suites retain only their already
  approved disposable mutation/canary/output contracts while being rerun as
  gates; RST-014A neither owns nor broadens them. No other new fixture/support
  table, row, file, or volume is authorized.
- Action and data impact: keep legacy CSVs, placeholders, passwords, and
  auto-seeding absent; create only allowlisted namespace/entity-scoped records
  in an isolated tenant; authenticate the factory with a run-specific
  database/file sentinel; use a runner-owned disposable credential without
  reading the native Admin hash; return IDs/logins only; tenant teardown
  destroys them.
- Backup prerequisite: Git baseline, RST-000, and executed RST-000A.
- Rollback/verification: remove only the general factory seam and restore
  caller-specific setup only in hardened non-Admin, safe-SQL, tenant-teardown
  form; retain credential/sanitizer/scanner/unconditional-cleanup hardening and
  never restore seeding or selective fixture/audit deletion. Verify normal startup/shared checksums, factory input
  rejection, transaction rollback, secret-free output, and teardown on success,
  setup/test/diagnostics failure, SIGINT, and SIGTERM. The exact reviewed
  contract is `docs/mjl-rst-014a-disposable-fixture-strategy.md`.

### RST-014B - Phase 2 disposable test fixtures

- Status: `PENDING_APPROVAL`
- Current component: no persistent Phase 2 dataset and Phase 1 disposable test factories.
- Proposed action: extend isolated factories with the minimum balanced planning, assignment, Opération, revision, and validation records required by Phase 2 tests.
- Reason: Phase 2 requires evidence without introducing persistent sample data.
- Phase: Phase 2
- Dependencies: RST-002B, RST-005, RST-006A, RST-007A, RST-014A
- Exact paths: planned `tests/helpers/phase2-fixture.js`, planned
  `tests/fixtures/phase2-fixture.php`, planned
  `tests/fixtures/phase2-fixture-preflight.php`, planned
  `tests/unit/phase2-fixture.test.js`, and planned
  `tests/e2e/phase2-fixture-isolation.spec.js`; modify
  `tests/runner/disposable-run.js`, `tests/runner/run-suite.js`,
  `tests/unit/disposable-run.test.js`, `playwright.config.js`, `package.json`,
  `docs/mjl-acceptance-tests.md`, `docs/mjl-test-coverage-registry.md`,
  `docs/mjl-reset-manifest-v2.md`, `docs/mjl-implementation-roadmap-v2.md`, and
  `docs/mjl-docs-index.md`. No path under
  `custom/mjlfinancement/sample_data` is authorized. RST-014B approval is
  independent of RST-013B.
- Exact tables/data: disposable target Activity, assignment, Opération-planning,
  revision, contributor, Review Decision, and command-created audit-event rows
  inside an isolated test tenant only. Fixtures that do not need review stop at
  a pre-review state; no fixture fabricates a decision or audit row directly.
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
