# MJL Phase 0 Audit Report

Audit timestamp: `2026-08-10 12:07:58 Africa/Porto-Novo`
Baseline commit: `38a2a9c1f0b0081abb734ad2d0b37a6c49302acb`
Scope: repository plus read-only aggregate inspection of the existing local tenant

## Post-audit Decision Addendum

User decisions recorded on 2026-08-10 supersede this report's proposed
selective inactivation, legacy mapping, and phase-owned persistent fixture
strategy. The approved target is a clean local purge with no migration,
preservation of exactly one native technical administrator, no persistent
sample/demo data until every implementation phase is complete, and isolated
test-only fixtures destroyed with their tenants. This report remains factual
evidence of the pre-reset state; `docs/mjl-reset-manifest-v2.md` owns the
revised executable scope.

## Executive Finding

The current application is a mature implementation of a different product
model. It contains useful authentication, UI, security, export, and audit
mechanisms, but its Partner scopes, finance objects, Activity structure,
workflow states, dashboards, routes, fixtures, and tests conflict materially
with the post-cadrage target. A documented, explicitly approved reset is safer
than compatibility layering.

No application code, schema, migration, route, test, permission, seed, or data
was changed during Phase 0.

## Repository Evidence

- Custom module: `custom/mjlfinancement`, descriptor version `0.10.0`.
- Native dependencies: third parties, Projects, ECM/documents, exports.
- Current routes cover dashboards, Partners, Projects, Activities, Expenses,
  Documents, conventions, budget lines, fund receipts, alerts, audit, reports,
  access administration, invitation, and guarded downloads.
- Current SQL includes 15 MJL tables and update scripts through `0.11.0`.
- Current role codes match the stable target codes but their labels,
  permissions, Partner scopes, and native-admin behavior need replacement.
- Current Activity uses one responsible user and contains convention/task,
  physical execution, and mutable status fields.
- Current Expense implements prévalidation, final validation, rejection,
  supporting-document enforcement, and disbursement with floating-point money.
- Current reports are CSV/XLSX and finance-oriented.
- `custom/mjlfinancement/reports.php` defines 18 code-level report keys:
  `funding_received_partner`, `budget_allocation_partner`,
  `budget_allocation_project`, `financial_execution_partner`,
  `financial_execution_project`, `physical_execution_project`,
  `expense_documents`, `activities_tracking`, `expenses_disbursements`,
  `validated_not_disbursed`, `pending_prevalidations`,
  `pending_final_validations`, `corrections_rejections`,
  `workflow_decisions`, `contextual_comments`, `general_audit`,
  `convention_budget`, and `fund_receipts`. The live report registry separately
  contains eight rows, all declaring `CSV/XLSX`.
- Current approved v3 package remains valid for presentation, not product rules.
- Automated tests heavily encode current Partner scope, Expense, finance,
  document, dashboard, and report behavior.

### Invitation and Account Evidence

- `custom/mjlfinancement/sql/llx_mjlfinancement_invitation.sql` and
  `llx_mjlfinancement_password_reset.sql` store SHA-256 token hashes, expiry,
  lifecycle status, entity, user, and actor/timestamp metadata; raw tokens are
  not database columns.
- `custom/mjlfinancement/lib/mjl_auth.lib.php` generates 32 random bytes,
  hashes tokens with SHA-256, scopes user/token lookup by active entity, uses
  named locks for concurrent invitation/reset transitions, consumes prior
  reset tokens, throttles reset requests, and records hashed email/IP context.
- `custom/mjlfinancement/invitation.php` and
  `custom/mjlfinancement/admin/access.php` implement invitation-only account
  handling. `custom/mjlfinancement/register.php` does not exist.
- These security primitives are retained evidence. Invitation role and
  Partner-scope payload behavior is `REPLACE` because v2 requires one effective
  role and no Partner authorization scope. See C-021 and RST-008.

### Production-readiness Configuration Evidence

- `custom/mjlfinancement/scripts/check_production_readiness.php` checks the
  pre-1.0 module version, absent public registration, legacy role/scope/audit
  tables, guarded documents, CSV/XLSX helpers, and disabled E2E token exposure.
- The same diagnostic explicitly leaves permission matrix, official outputs,
  production email, public/base URL, secrets, document storage, backup/restore,
  monitoring, and log retention as `UNKNOWN`, and emits
  `BLOCKED_PENDING_CLIENT_AND_OPERATOR_CONFIRMATION`.
- `docs/mjl-deployment-checklist.md` still requires Partner/Programme scopes,
  Admin business management, CSV/XLSX-only outputs, and no PDF. Those product
  assertions conflict with v2. The underlying secret-storage, private ECM,
  email/base-URL, backup/restore, logging, and no-public-registration controls
  remain valid future gates. See C-020 and RST-015.

## Live Tenant Evidence

Only aggregate `SELECT` and `information_schema` queries were used. No names,
free text, secrets, document paths, or row-level business records were read.

- MariaDB version: `11.8.8-MariaDB-ubu2404`.
- The module-enabled constant is present; no live module-version constant was returned.
- 15 `llx_mjlfinancement_*` tables are present.
- No user has more than one active role row.
- Three active native admins exist; all three have active
  `ADMIN_PLATEFORME`, and none has a non-platform role.
- Eight active role rows exist: four Admin, one Agent, two Supervisors, and one
  Validator.
- Partner-scope history has 1,194 rows, including 18 active rows across seven users.
- Current monetary columns in Expense use `DOUBLE(24,8)`.
- Role and scope active indexes are non-unique; active-role uniqueness is not a
  database constraint.

| Table | Exact row count |
| --- | ---: |
| `llx_mjlfinancement_access_audit` | 39 |
| `llx_mjlfinancement_activity` | 7 |
| `llx_mjlfinancement_budget_line` | 8 |
| `llx_mjlfinancement_convention` | 3 |
| `llx_mjlfinancement_exchange_log` | 48 |
| `llx_mjlfinancement_expense` | 7 |
| `llx_mjlfinancement_fund_receipt` | 4 |
| `llx_mjlfinancement_invitation` | 1 |
| `llx_mjlfinancement_password_reset` | 14 |
| `llx_mjlfinancement_project_note` | 17 |
| `llx_mjlfinancement_report` | 8 |
| `llx_mjlfinancement_user_role` | 13,541 |
| `llx_mjlfinancement_user_soc_scope` | 1,194 |
| `llx_mjlfinancement_validation` | 4 |
| `llx_mjlfinancement_workflow_action` | 1,101 |

Native aggregate counts are 16 active users, 4 third parties, and 6 Projects.
These counts identify reset risk; they do not authorize deletion.

Follow-up aggregate/schema audit timestamps were `2026-08-10 12:27:11` and
`2026-08-10 12:27:53 Africa/Porto-Novo`. The first query safely stopped when it
confirmed that no column named `disbursement_status` exists; the valid
`disbursed_amount` aggregate was then used. No mutation occurred.

| Current aggregate distribution | Value | Count |
| --- | --- | ---: |
| Activity status | `0` | 1 |
| Activity status | `1` | 2 |
| Activity status | `2` | 3 |
| Activity status | `6` | 1 |
| Expense status | `0` | 1 |
| Expense status | `1` | 2 |
| Expense status | `2` | 2 |
| Expense status | `3` | 1 |
| Expense status | `8` | 1 |
| Expense disbursed amount | null | 7 |
| Convention status | `0` | 1 |
| Convention status | `1` | 2 |
| Fund-receipt status | `1` | 3 |
| Fund-receipt status | `8` | 1 |
| Invitation status | `accepted` | 1 |
| Password-reset status | `consumed` | 12 |
| Password-reset status | `sent` | 2 |
| Validation action | `corrected` | 1 |
| Validation action | `rejected` | 1 |
| Validation action | `validated` | 2 |
| Report expected format | `CSV/XLSX` | 8 |

Workflow-action distribution is: created 137, deleted 80, document downloaded
121, document uploaded 60, export generated 333, field changed 188, final
validated 1, not received 1, note added 17, prevalidated 1, proof uploaded 1,
received 1, submitted 1, and unsafe edit rejected 159. Live metadata has 100
MJL indexed-column entries, 33 unique-index column entries including primary
keys, and 32 foreign-key constraints.

At audit time, the stable local fixture predicate was
`entity=1 AND import_key='MJLPOC2026'`. It matches four native third parties and five native
Projects. One Project is outside that predicate and is excluded from reset.
Within the fixture set, each expected Project ref `PRJ-JE-2026`,
`PRJ-RED-2026`, and `PRJ-EXT-2026` occurs once. These predicates and counts
are now inputs to the checksum-approved RST-000A deletion appendix. They no
longer bound RST-003 or RST-014A.

At audit time, the six repository-declared local fixture logins were `admin.poc`, `agent.mjl`,
`superviseur.n1`, `superviseur.n2`, `dpaf.mjl`, and `lecteur.audit`. Read-only
live inspection found exactly one active `llx_user` row for each and six total.
The former RST-014A inactivation proposal is superseded. RST-000A owns their
checksum-scoped hard deletion while preserving exactly one separately
identified native technical-administrator account.

## Complete Conflict Matrix

| ID | Current repository concept | New authoritative concept | Conflict and risk | Disposition | Target phase | Expected files | Schema consequence | Test consequence | Data reset consequence | Reset ID |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-001 | Partner/Programme user scopes drive non-admin visibility | Agent sees assigned Activities; Supervisor/Validator see all | Current scope can deny authorized review or expose unrelated objects after partial migration | REPLACE | 1-2 | Exact RST-002A/RST-002B path inventory | Retire `user_soc_scope`; add assignments | Replace scope-security, dashboard, report, and fixture cases | Hard-delete legacy scope rows through approved RST-000A; create no mapped replacements | RST-000A, RST-002A, RST-002B |
| C-002 | Native admin bypass plus explicit role rows | Native admin implies platform Admin and cannot hold business role | Implicit bypass can violate one-role semantics or grant business actions | REPLACE | 1 | Exact RST-001 path inventory | Enforce effective-role invariant | Add native-admin/no-business journey | Hard-delete sample business-role rows; preserve exactly one identified native technical administrator | RST-000A, RST-001 |
| C-003 | Admin currently creates/edits Projects and accesses business surfaces | Validator alone manages business reference data; Admin is technical/audit-only | Separation between technical and business power is violated | REPLACE | 1 | Exact RST-001/RST-003 path inventory | No new table; permission changes | Replace Admin project-success assertions with denial | No native-row deletion implied | RST-001, RST-003 |
| C-004 | `Partenaires / Programmes` generic terminology | Partenaire and Projet | Programme is conflated with Partner scope | REPLACE | 1 | Exact RST-003/RST-009A path inventory | None | Remove wording-only tests; retain semantic contracts | None | RST-003, RST-009A |
| C-005 | One responsible Activity user | Primary plus additional time-bounded assignments | Current model cannot support shared editing or immediate removal | REPLACE | 2 | Exact RST-002B/RST-005 path inventory | Add assignment table; retire responsible field | Add assignment, transfer, removal, stale-save journeys | Map or reset seven local Activities | RST-002B, RST-005 |
| C-006 | Activity linked to convention/task with no authorized amount | Activity directly owns one proposed/validated amount and Opérations | Current structure cannot balance budget or preserve target hierarchy | REPLACE | 2 | Exact RST-005 path inventory | Replace legacy fields; integer amount/version | Replace current create/workflow journeys | Hard-delete legacy Activity rows; do not map them | RST-000A, RST-005 |
| C-007 | No first-class Opération | Opération is planned/executed child of Activity | Required lifecycle, amount, completeness, and cancellation cannot exist | REPLACE | 2-3A | Exact RST-006A/RST-006B path inventory | Add Opération and type structures | Add balanced planning and execution journeys | No automatic Expense-to-Opération inference | RST-006A, RST-006B |
| C-008 | Mutable Activity workflow rows, no immutable submitted revision | Every submission creates exact immutable revision and contributors | Review may apply to changed content and role changes can bypass identity rules | REPLACE | 2 | Exact RST-005/RST-006A/RST-007B path inventory | Add revision/contributor/review structures | Add same-revision, contributor, stale-decision cases | Do not fabricate revisions for legacy rows | RST-005, RST-006A, RST-007B |
| C-009 | Current statuses include legacy validated/corrected/completed patterns | Exact v2 validation, execution, request, and completeness models | Collapsed meanings can allow invalid transitions and misleading display | REPLACE | 2-3A | Exact RST-005/RST-006B path inventory | Replace enum values and derived-state storage | Replace transition and presentation assertions | Hard-delete legacy status rows; do not map them | RST-000A, RST-005, RST-006B |
| C-010 | Expense/disbursement is core execution model | Opération spent amount is core; payment/accounting flows are outside core | Retaining Expenses preserves obsolete scope and double-counts execution | REMOVE | 1 | Exact RST-004 path inventory | Retire Expense/validation tables after approval | Remove/replace Expense journeys by phase | Export evidence then approved clean reset | RST-004 |
| C-011 | Conventions, budgets, and fund receipts are top-level core finance | Upstream funding and receipt processes are outside core | Current screens imply unapproved upstream scope | REMOVE | 1 | Exact RST-004 path inventory | Retire related custom tables after approval | Retain only durable security patterns in replacements | Hard-delete all legacy rows through approved RST-000A; no archive or migration | RST-000A, RST-004 |
| C-012 | Money uses `DOUBLE(24,8)` | Integer-safe XOF; missing distinct from zero | Floating point and nullable/zero ambiguity threaten financial integrity | REPLACE | 2-3A | Exact RST-005/RST-006A/RST-012 path inventory | Integer columns with explicit nullability | Add zero/null/variance numeric tests | No unproven conversion of legacy values | RST-005, RST-006A, RST-012 |
| C-013 | Split validation/workflow/exchange/access/report logs | Transactional append-only audit plus Activity chronology | Split logs lack one immutable revision-linked contract | REPLACE | 1-2 | Exact RST-007A/RST-007B path inventory | Replace/adapt audit structures and constraints | Add mutation rollback and immutability tests | Archive/reset current audit only after export | RST-007A, RST-007B |
| C-014 | Implemented document library/uploads/downloads | Document behavior gated to Phase 4; guarded seam retained | Existing rules could be mistaken for approved target behavior | DEFER | 1 | Exact RST-010A path inventory | No new Phase 0 schema; later design gated | Keep security evidence, defer business journeys | Never delete files without inventory/snapshot | RST-010A |
| C-015 | Finance and Partner-scope dashboards/alerts | Revision-aware Activity/Opération metrics with separated totals | Current KPIs mix obsolete sources and scopes | REPLACE | 3B | Exact RST-011 path inventory | Query/read-model changes | Replace role queues and aggregation cases | No separate reset beyond sources | RST-011 |
| C-016 | CSV/XLSX-only finance report center | Required PDF/XLSX Activity/Opération outputs plus supplemental CSV | Required PDF is absent and existing report keys are obsolete | REPLACE | 3B | Exact RST-012 path inventory | Report registry/audit adaptation | Add PDF/XLSX plus retained CSV contract tests | Inventory generated files and report rows | RST-012 |
| C-017 | POC bootstrap and finance-heavy fixtures | Empty persistent tenant plus isolated disposable test fixtures | Current seed recreates obsolete roles, scopes, objects, and tests | REPLACE | 1-3B | Exact RST-000A/RST-014A/RST-014B/RST-014C/RST-014D path inventory | Test factories follow approved phases without persistent seed data | Replace fixture-dependent cases with isolated tenant journeys | Delete the legacy seed and persistent sample package; defer any new persistent sample dataset until all phases are complete | RST-000A, RST-014A, RST-014B, RST-014C, RST-014D |
| C-018 | Current tests are classified against old authority | Tests follow v2 journeys and phase ownership | Old green tests could falsely validate removed behavior | REPLACE | 1-3C | Exact RST-013A/RST-013B/RST-013C/RST-013D/RST-013E path inventory | None directly | Classify every test before later deletion; replace security invariants | Test data reset follows approved phase | RST-013A, RST-013B, RST-013C, RST-013D, RST-013E |
| C-019 | Approved v3 product text forbids PDF and describes old scope | v3 remains visual authority only | Product assertions could override v2 accidentally | KEEP | 0 | Exact C-019 crosswalk inventory below | None | Design conformance remains visual | None | None |
| C-020 | Historical readiness/deployment model describes old app | Phase 3C hardening and client-owned go-live scope | Old readiness claims can imply wrong completion gates | DEFER | 3C | Exact RST-015 path inventory | Configuration changes only if later approved | Replace readiness assertions at Phase 3C | None in Phase 0 | RST-015 |
| C-021 | Secure invitation/reset primitives carry old role and Partner-scope payload semantics | Keep secure invitation-only lifecycle while enforcing one revised effective role and no Partner scope | Reusing payload semantics can recreate obsolete authorization even if token handling remains safe | REPLACE | 1 | Exact RST-008 path inventory | `llx_mjlfinancement_invitation`, `llx_mjlfinancement_password_reset`, `llx_mjlfinancement_user_role`, `llx_user`; no raw-token migration | Replace role/scope journeys while retaining token, expiry, concurrency, enumeration, and audit security cases | Hard-delete all legacy invitation/reset rows; migrate no tokens or payloads | RST-000A, RST-008 |

## Conflict-to-Exact-Reset Inventory

This crosswalk is part of each conflict row. The cited reset unit contains the
repository-relative path list, exact existing/planned tables, data impact,
backup prerequisite, rollback, dependency order, and one target phase. No
category text in the summary matrix expands the cited inventory.

| Conflict | Exhaustive reset inventory for the conflict |
| --- | --- |
| C-001 | RST-002A, RST-002B, RST-013A, and RST-014A |
| C-002 | RST-001 |
| C-003 | RST-001 and RST-003 |
| C-004 | RST-003 and RST-009A |
| C-005 | RST-002B, RST-005, RST-013B, and RST-014B |
| C-006 | RST-005, RST-013B, and RST-014B |
| C-007 | RST-006A, RST-006B, RST-013B, RST-013C, RST-014B, and RST-014C |
| C-008 | RST-005, RST-006A, RST-007B, RST-013B, and RST-014B |
| C-009 | RST-005, RST-006B, RST-013B, RST-013C, RST-014B, and RST-014C |
| C-010 | RST-004, RST-009A, RST-010A, RST-011, RST-012, RST-013A, RST-013D, RST-014A, and RST-014D |
| C-011 | RST-004, RST-009A, RST-010A, RST-011, RST-012, RST-013A, RST-013D, RST-014A, and RST-014D |
| C-012 | RST-005, RST-006A, RST-012, RST-013B, RST-013C, RST-013D, RST-014B, RST-014C, and RST-014D |
| C-013 | RST-007A, RST-007B, RST-013B, RST-013C, and RST-013D |
| C-014 | RST-010A, RST-013A, RST-013C, and RST-014A; any Phase 4 implementation requires a new exact manifest after client decisions |
| C-015 | RST-011 and RST-013D |
| C-016 | RST-012, RST-013D, and RST-014D |
| C-017 | RST-014A, RST-014B, RST-014C, and RST-014D |
| C-018 | RST-013A, RST-013B, RST-013C, RST-013D, and RST-013E |
| C-019 | No reset. Exact classified paths are `docs/design-system/approved/v3/DESIGN.md`, `docs/design-system/approved/v3/PRODUCT.md`, `docs/design-system/approved/v3/MANUAL-REVIEW.md`, `docs/design-system/approved/v3/design-manifest.yaml`, `docs/design-system/approved/v3/design-tokens/README.md`, `docs/design-system/approved/v3/design-tokens/semantic-tokens.json`, `docs/design-system/approved/v3/design-tokens/tokens.json`, `docs/design-system/approved/v3/docs/design/component-inventory.md`, `docs/design-system/approved/v3/docs/design/design-assumptions.md`, `docs/design-system/approved/v3/docs/design/design-decisions.md`, and `docs/design-system/approved/v3/docs/design/design-validation-report.md`; Phase 0 leaves them unchanged. |
| C-020 | RST-015 and RST-013E |
| C-021 | RST-008, RST-013A, and RST-014A |

## Test Inventory Consequence

Current suites are evidence only. Security primitives such as CSRF, direct URL
guards, invitation token safety, guarded downloads, active entity filtering,
audit-before-export/download, output escaping, and stale-write denial should be
retained through replacement tests. Partner-scope, Expense, convention, fund,
budget, old status, Admin business-power, and CSV/XLSX-only assertions are
obsolete target behavior. No test was changed or deleted in Phase 0.

## Design and Documentation Finding

The approved v3 tokens, component contracts, focus states, density, responsive
behavior, and accessibility guidance remain authoritative presentation
evidence. Its product definition and current UI audits describe the old
application and are subordinate to v2. Historical docs remain in place and are
classified through the documentation index.

## Destructive Actions

None executed. Every reset-manifest row is `PENDING_APPROVAL`.

## Verification

- Repository and live aggregate inspection: completed.
- Canonical v2 files: created.
- Application code/schema/routes/tests/permissions/seed/data changes: none.
- Initial and final SHA-256 for user-owned `.gitignore`:
  `f90e549aaaa646e301c296084b23795771886471bb5f7ac59b7b677b607d3602`;
  the values match.
- Initial and final SHA-256 for user-owned
  `docs/mjl_fully_revised_implementation_prompts_by_phase.md`:
  `2bdee9ca34640ce71fc3df65b34541347195579f5a09b1956a4b7c1e42375b56`;
  the values match.
- Behavior suites: not run because Phase 0 is documentation-only and current
  suites encode the superseded model.
- UI screenshots: not applicable.
- Manual accessibility: not applicable.

## Known Notes and Deferred Decisions

- Reset actions require explicit human approval.
- Final Opération-type classification remains client input.
- Document, accounting, and official-report rules remain gated.
- Production configuration and go-live scope remain undecided.
- The live tenant is local evidence, not production-state evidence.

## Verdict

```text
PHASE_0_AUDIT_READY_WITH_NOTES
```

Phase 1 must not begin until the user reviews this package and explicitly
approves the required reset-manifest IDs.
