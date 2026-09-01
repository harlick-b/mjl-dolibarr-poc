# RST-002B Activity Assignment Strategy

## Status

`APPROVED_FOR_IMPLEMENTATION; IMPLEMENTATION_IN_PROGRESS; SHARED_EXECUTION_NOT_AUTHORIZED`

The user approved implementation of this exact strategy and corrected path
inventory at commit `7676f1f` on 2026-09-01. That approval authorizes repository
implementation and disposable verification only. It authorizes no shared
mutation, rollback, persistent fixture, or RST-006A work. RST-005 is executed;
RST-002B is the next dependency. RST-006A remains only the subsequent
dependency and cannot be finalized or implemented until RST-002B has executed
evidence.

## Confidence result

The proposal is decision-complete for RST-002B if explicitly approved.
Canonical rules, the executed RST-005 schema, current access code, audit
transaction interface, role-change code, and reset manifest agree after the
loophole closures below. The future automatic creator-primary rule is recorded
only as an RST-006A dependency; RST-002B leaves its nullable physical seam
database-forced to a Validator identity. Runtime success still depends on clean
implementation gates and live preflight; an unknown or nonempty shared state
stops rather than being migrated or guessed.

No new safeguard is included without a material assignment, authorization,
concurrency, audit, or partial-DDL risk. The plan does not generalize the
RST-005 launcher, build a workflow framework, or prebuild RST-006A.

## Governing rules

- An Agent sees an Activity only while currently assigned.
- Every Activity has one current primary Agent and may have additional current
  Agents. Primary is coordination metadata, not stronger permission.
- Every current Agent has the same assignment-derived Activity capabilities.
- Only an active same-entity `VALIDATEUR_DEFINITIF` performs RST-002B
  assignment changes. Automatic creator-as-primary assignment remains an
  unimplemented RST-006A rule.
- A current assignment target must be an active, same-entity, non-Admin
  `AGENT_SAISIE`.
- Removal revokes direct URL, list, read, and open-form save access on the next
  server authorization check. Historical assignment and audit evidence stays.
- Every assignment command verifies the expected Activity version. A stale
  command changes no assignment, Activity, or audit row.
- Assignment change, Activity version increment, modifier identity, and one
  RST-007A audit event commit in one transaction or all roll back.
- An Agent with a current assignment cannot be deactivated, promoted to native
  Admin, or changed away from `AGENT_SAISIE`; assignments must first be removed
  or transferred.
- Every query and mutation is filtered by the runtime active Dolibarr entity.

## Closed implementation scope

### Assignment record

Create `llx_mjlfinancement_activity_assignment` with only:

| Field | Contract |
| --- | --- |
| `rowid` | signed BIGINT primary key |
| `entity` | positive signed INT, required |
| `fk_activity` | required same-entity Activity |
| `fk_user` | required same-entity active Agent |
| `is_primary` | required `0` or `1` |
| `date_start` | required server timestamp |
| `date_end` | nullable server timestamp; null means current |
| `fk_user_assign` | nullable physical seam; RST-002B requires an assigning Validator |
| `reason` | required nonblank reason |
| `date_creation` | required immutable creation timestamp |
| `tms` | database update timestamp |

Generated nullable keys plus unique indexes enforce at most one current row per
`(entity, Activity, Agent)` and at most one current primary per
`(entity, Activity)`. Foreign keys are restrictive. Supporting indexes cover
current lookup by Activity and by Agent. Checks enforce positive entity,
boolean primary, nonblank reason, and `date_end >= date_start`.

The database rejects hard deletion. An assignment row may change only once
from current to ended; its entity, Activity, Agent, primary flag, start,
assigner, reason, and creation time are immutable. Every RST-002B row requires
a same-entity active Validator assigner; insert triggers reject null. The
nullable column is only a dormant physical seam that RST-006A may amend after
RST-002B execution evidence and separate approval. Promotion of an additional
Agent ends the additional row and creates a new primary row, preserving history.

### Assignment module interface

One deep `MjlActivityAssignment` module owns locking, eligibility, assignment
history, Activity versioning, and audit behind one manual interface:
`changeAssignment(activityId, expectedVersion, authenticatedActor, operation,
targetAgentId, reason)`. The module reloads and locks every authoritative row;
callers cannot pass a pretrusted Activity, Agent, role, entity, timestamp, or
assignment state. It returns only a stable outcome code and the new Activity
version. Its exact operations are:

1. `ADD_ADDITIONAL` adds one unassigned Agent as additional.
2. `REMOVE_ADDITIONAL` ends one current additional assignment.
3. `TRANSFER_PRIMARY` atomically ends the current primary and, when necessary,
   an existing additional row for the replacement Agent, then creates the new
   primary row.

The result vocabulary is closed: `OK` with the new version; `INVALID_INPUT`,
`FORBIDDEN`, `NOT_FOUND`, or `CONFLICT`, all nonretryable until caller input or
state changes; `STALE_VERSION`, retryable only after an explicit reload; and
`FAILED`, an internal transactional failure that callers must not retry
automatically. Every non-`OK` result commits no assignment, Activity, or audit
change. Authorization failures do not reveal whether a cross-entity target
exists.

Primary removal without a replacement is forbidden. Duplicate add,
self-transfer, inactive/wrong-role/cross-entity targets, blank reasons, missing
Activity, wrong schema, and stale versions fail with no committed change.
Server time and authenticated actor identity are never accepted from request
fields.

Every command snapshots the actor, target, and every currently assigned Agent
ID; locks all of those native user rows in ascending ID order; locks their
active role rows in the same order; then locks the Activity and its current
assignment rows. It rereads every premise after locking. If the current
assignment identity set differs from the snapshot, the command returns
`STALE_VERSION` and the transaction rolls back. It then compares the expected
version, applies assignment rows, increments Activity `version` by exactly one,
sets `fk_user_modif`, and appends one summarized audit event. Every role-change
and deactivation path uses the reciprocal user-then-role lock order before
checking current assignments. This closes actor and target role/deactivation
races without a second locking framework.

Audit uses object type `activity_assignment` and actions
`ASSIGNMENT_ADDED`, `ASSIGNMENT_REMOVED`, or `PRIMARY_TRANSFERRED`. It records
  the Activity, actual authenticated actor ID/name/role snapshot, expected
  version, previous/current assignment identities and primary designation,
  reason, and success result. Manual actions additionally require the actor's
  locked role to be Validator. It records no secret or complete user object.
  Audit insertion failure rolls back the command.

### Activity and role guards

- Replace `llx_mjl_activity_rst005_bu` with
  `llx_mjl_activity_rst002b_bu`, permitting only `version = OLD.version + 1`,
  `fk_user_modif`, and automatic `tms` changes. Every structural, amount,
  status, cancellation, identity, creator, or timestamp change remains denied.
- Retain RST-005 insert containment, dormant workflow constraint, and delete
  denial unchanged. RST-002B exposes no Activity creation or workflow command.
- Assignment insert triggers validate immutable fields, same entity, target
  Agent eligibility, nonnull Validator eligibility, and current uniqueness.
  Update/delete triggers enforce
  the one-way end transition and historical immutability. Application source
  contracts forbid assignment DML outside the module; database triggers
  independently reject malformed/direct structural bypasses. Possession of
  the database credential is outside the application authorization boundary.
- Extend role/user invariant triggers and `mjl_scope` transactions so a current
  assignment blocks Agent role replacement, deactivation, native-Admin
  promotion, direct active-role row deactivation/deletion, and cross-entity
  change. These guards recheck under the same user-row lock used by the
  assignment module.
- Drop the verified-empty `fk_user_responsible` column and
  `chk_mjl_activity_responsible_dormant`; no value is mapped.
- Drop the verified-empty `llx_mjlfinancement_user_soc_scope` table; no Partner
  scope is mapped into an assignment.

### Read authorization

Replace the current reviewer-only access helper with two explicit decisions:

- Supervisor and Validator may list/read all same-entity Activities.
- Agent may enter the list route, but every list/detail lookup joins a current
  same-entity assignment for that authenticated Agent. No caller supplies a
  user ID, entity, column, or SQL fragment.

The Agent receives the existing Activity-read permission during role-right
projection, but permission alone never grants a row. Admin remains excluded
from normal Activity routes. POST and all Activity business mutation remain
denied. Assignment commands are module-only in RST-002B; no assignment UI,
menu, or public endpoint is added.

This makes removal effective on the next request and on every future save.
RST-006A must call the same row-level authorization immediately before its
future save transaction; it may not cache assignment permission from form
render time. RST-002B proves that reusable server decision immediately after
removal; the real open-form-save E2E remains mandatory for RST-006A/RST-013B
when a save endpoint exists.

### RST-006A dependency

RST-002B exposes no creator-primary interface or null-assigner insert path.
After RST-002B execution evidence, a separately approved RST-006A strategy must
amend this module and its insert trigger to create the authenticated Agent
creator's primary assignment atomically with Activity creation, and must own
the guarded Validator UI/route adapter for manual assignment operations. This
records ownership only; it does not finalize that interface, UI, trigger, or
audit shape now. No Activity creation, Opération, revision, contributor,
Review Decision, submission, validation, amount-balancing, structural edit, or
Activity form is implemented here.

## Exact proposed path inventory

Create:

- `custom/mjlfinancement/class/mjlactivityassignment.class.php`
- `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.sql`
- `custom/mjlfinancement/sql/llx_mjlfinancement_activity_assignment.key.sql`
- `custom/mjlfinancement/scripts/rst002b_activity_assignment.php`
- `custom/mjlfinancement/scripts/rst002b_shared_operation.lib.js`
- `custom/mjlfinancement/scripts/rst002b_shared_packet.js`
- `custom/mjlfinancement/scripts/rst002b_shared_launcher.js`
- `custom/mjlfinancement/scripts/verification/schema/activity_assignment.php`
- `tests/e2e/rst002b-activity-assignment.spec.js`
- `tests/runner/rst002b-shared-launcher-rehearsal.js`
- `tests/unit/rst002b-activity-assignment.test.js`
- `tests/unit/rst002b-shared-launcher.test.js`
- `docs/mjl-rst-002b-execution-report.md` only after shared execution

Modify:

- `custom/mjlfinancement/activities.php`
- `custom/mjlfinancement/class/mjlactivity.class.php`
- `custom/mjlfinancement/lib/mjl_activity_access.lib.php`
- `custom/mjlfinancement/lib/mjl_scope.lib.php`
- `custom/mjlfinancement/scripts/activity_schema_installer.lib.php`
- `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`
- `custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql`
- `custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql`
- `custom/mjlfinancement/sql/llx_mjlfinancement_user_role.key.sql`
- `tests/fixtures/database-evidence.php`
- `tests/unit/rst005-activity-foundation.test.js`
- `tests/runner/run-suite.js`
- `tests/runner/disposable-run.js`
- `playwright.config.js`
- `package.json`
- `docs/mjl-acceptance-tests.md`
- `docs/mjl-test-coverage-registry.md`
- `docs/mjl-authoritative-decisions.md`
- `docs/mjl-current-vs-target-gap-analysis.md`
- `docs/mjl-decision-register-v2.md`
- `docs/mjl-docs-index.md`
- `docs/mjl-implementation-roadmap-v2.md`
- `docs/mjl-reset-manifest-v2.md`
- this strategy, for synchronized approval/execution status only

Retain unchanged:

- `custom/mjlfinancement/lib/mjl_audit.lib.php`; its existing transaction-bound
  append interface already covers the required event
- RST-005 schema oracles, launcher code, immutable packet, backups, and evidence

Remove only after exact empty-state preflight:

- `custom/mjlfinancement/sql/llx_mjlfinancement_user_soc_scope.sql`
- `custom/mjlfinancement/sql/llx_mjlfinancement_user_soc_scope.key.sql`

The module descriptor and `tests/fixtures/database-evidence.php` remove their
references to the obsolete scope table through their already-listed edits.

The reset manifest's earlier path list omitted the scope/role/module files
needed for its own role-change and removal rules. Approval of this strategy
must explicitly approve this corrected inventory before implementation.

### Successor test policy

Add `npm run test:rst002b` as the focused disposable gate and make default
current-purpose discovery exercise the RST-002B target. Retarget the RST-005
source-contract unit so it verifies the retained predecessor oracles and
rollback contract instead of requiring the live SQL definitions to remain at
RST-005. Do not add compatibility columns, tables, or runtime branches merely
to keep a predecessor test unchanged.

After RST-002B executes, the two RST-005 operational commands are historical
C1 evidence, not current-target acceptance gates. Their committed C1 code,
oracles, report, and immutable packet remain retained; the current acceptance
guide must not advertise a known-inapplicable predecessor cutover as a live
target gate. RST-002B's disposable suite must instead prove rollback to the
sealed RST-005 schema and forward return to its own target.

## Implementation and verification sequence

1. After explicit approval, synchronize the decision register and reset
   manifest with the approved strategy and corrected path inventory. Then pin
   the exact RST-005 target schema, empty
   shared baseline, RST-007A audit
   interface, role triggers, access behavior, and forward/rollback schema
   oracles. Record discrepancies before editing.
2. Build vertical slices test-first: storage/invariants; module transaction
   and concurrency; role-change guard; row-level reads and immediate removal;
   migration/known-prefix convergence; rollback refusal.
3. Use only disposable RST-014A tenants with unit-scoped minimal users,
   reference rows, and Activities. Destroy the tenant after each suite. Do not
   create a reusable Phase 2 fixture package or shared business row.
4. Verify same/cross-entity IDs, every role, inactive/wrong-role targets,
   duplicate/primary invariants, blank reason, stale version, parallel
   assignment commands, audit failure rollback, direct structural SQL bypass,
   actor and target role-change/deactivation races, the closed result
   vocabulary, direct URL/list filtering, immediate server-side authorization
   denial after removal, and unknown/partial schema fail-closed. Do not invent
   an Activity form solely for this test.
5. Run the focused unit/E2E suites, current verification gates, PHP/Node syntax,
   `git diff --check`, full-feature validation, and final Standards, Spec, and
   Security/Isolation reviews once against the exact clean implementation
   commit. Correct only demonstrated blockers, then repeat only affected gates.
6. Compute the implementation commit, protected-tree digest, forward/rollback
   schema digests, and nonsecret manifest. Any protected change invalidates the
   candidate approval pair.
7. Request separate explicit approval naming RST-002B and that exact pair
   before generating a shared packet or stopping traffic.

## Shared cutover and recovery boundary

Shared preflight requires the exact finalized RST-005 schema, no RST-005
temporary object, zero Activity rows, zero assignment rows/table absence, zero
Partner-scope rows, null dormant responsible values, the expected audit
baseline, a clean approved tree, and no foreign writer. A mismatch stops.

The dedicated `rst002b_shared_packet.js`, `rst002b_shared_launcher.js`, and
`rst002b_shared_operation.lib.js` own root custody, exact approval/commit/tree/
target binding, stopped-service and fresh traffic checks, one exclusive target
lock, encrypted streaming backups, independent restore proof, immutable
before/checkpoint/after evidence, exact migration invocation, and exact-name
cleanup. They may reuse stable runtime commands, but must not modify,
generalize, or claim authorization from the completed RST-005 launcher. Their
focused rehearsal owns substitution, interruption at each DDL prefix,
restore-integrity, secret-custody, and zero-survivor proof.

After approval, stop only Dolibarr, retain MariaDB, capture encrypted schema
and full backups, independently restore-test them, and run that exact dedicated
RST-002B migration. Its ordered known states are: RST-005 baseline; assignment
table created but dormant; Activity guard/column cut over; obsolete scope table
removed; verified RST-002B target. Application code authorizes Agent reads or
assignment commands only at the complete target digest. A recognized partial
prefix remains fail-closed and may only continue forward with the original
approved packet; an unknown state stops for new approval. There is no automatic
rollback or broad restore.

Verify the exact target schema, one native Admin, zero business users/rows,
unchanged documents/ECM/nonallowlisted database evidence, unchanged audit
count/digest, backup restore attestation, and zero temporary survivors before
restarting Dolibarr and checking Compose plus local HTTP.

Rollback is separately approved, reverse-dependency-aware, and allowed only
before RST-006A or any later dependent unit, with zero Activity, assignment,
assignment-audit, and Partner-scope rows. It restores the exact RST-005
responsible column/constraint, empty scope table definition, unconditional
RST-005 update denial, access containment, and sealed schema digest; it never
reloads rows or legacy scope data. Backups and evidence remain retained until
the formal Phase 2 verdict. Disposal remains separately approval-gated.

## Explicit exclusions

- no Activity creation/edit/delete, assignment screen, navigation, or public API
- no RST-006A schema, workflow, revision, review, or Opération behavior
- no Partner-scope compatibility or legacy mapping
- no Admin/Supervisor assignment mutation
- no persistent/shared sample or test data
- no generic workflow, authorization, migration, or launcher framework
- no rollback, restore, or artifact destruction without separate approval

## Confidence-review loopholes closed

| Loophole | Closure |
| --- | --- |
| Removing the primary could leave an ownerless Activity. | Only atomic primary transfer may end the primary. |
| Additional-to-primary promotion could erase history or create two primaries. | End old rows, insert a new primary row, and enforce current-primary uniqueness. |
| Role change could race assignment creation. | Shared user-row lock order, transaction rechecks, assignment-module guard, and invariant triggers. |
| Activity-read permission could expose every row to Agents. | Permission opens the route; a current-assignment join filters every Agent lookup. |
| Open forms could survive removal. | Every future save must recheck current assignment and expected version server-side. |
| Stale or audit-failed commands could partially commit. | The assignment module owns one transaction; stale changes no audit; audit failure rolls back all changes. |
| Direct SQL could alter Activity structure or corrupt assignment history. | Sealed triggers allow only the narrow Activity version bump and one-way assignment ending. |
| Multi-DDL cutover could stop halfway. | Exact known-prefix classification, fail-closed application behavior, forward-only continuation, and separately approved rollback. |
| RST-002B could absorb RST-006A to make tests convenient. | Unit-scoped disposable records only; creation/workflow/revisions remain expressly excluded. |
| The reset manifest omitted files required by its own role-change rule. | This strategy exposes and approval-gates the corrected exact path inventory. |
| Implementing automatic creator-primary now would finalize RST-006A early. | RST-002B rejects null assigners; RST-006A owns any later creator exception after RST-002B evidence and separate approval. |
| Testing open-form revocation now would invent RST-006A UI. | RST-002B proves the reusable server decision after removal; the real stale-form E2E waits for the real save endpoint. |
| Stale RST-005 tests could force compatibility code or fail the default suite. | Retarget current-purpose discovery to RST-002B and preserve RST-005 as immutable predecessor/rollback evidence. |

## Remaining human confirmations

Implementation of this exact RST-002B strategy and corrected path inventory was
approved at commit `7676f1f`. Shared execution still requires a second approval
naming the clean implementation commit and protected-tree digest. RST-006A
remains unapproved.
