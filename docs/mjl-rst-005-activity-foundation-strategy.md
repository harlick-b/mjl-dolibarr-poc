# RST-005 Activity Foundation Strategy

## Status and approval boundary

- Strategy status: `AMENDMENT_REVIEW_REQUIRED`. DEC-045 approved the original
  strategy on 2026-08-24; disposable implementation then proved MariaDB refuses
  `RENAME TABLE` while explicit table locks remain held. The exact guarded-lock
  amendment below requires separate explicit RST-005 approval before shared
  execution.
- Reset unit: `RST-005`.
- Phase: Phase 2.
- Dependencies: the formal Phase 1 verdict and every retained executed Phase 1
  unit: RST-000A, RST-001, RST-002A, RST-003, RST-004, RST-007A, RST-008,
  RST-009A, RST-010A, RST-013A, and RST-014A.
- This document is a strategy only. It authorizes no implementation, database
  mutation, route exposure, navigation, or persistent fixture.
- The required later, separate, explicit approval naming `RST-005` was received
  on 2026-08-24. Phase 2 approval by itself would not have been sufficient.
- Approval of the amended RST-005 will authorize only the closed scope in this document.
  RST-002B, RST-006A, RST-007B, RST-009B, RST-013B, and RST-014B remain
  separately reviewable and separately approvable units.

## Outcome

RST-005 replaces the empty interim Activity table with the empty target
Activity foundation and makes the Activity model one deep, fail-closed module.
It preserves the Phase 1 read-only reviewer projection but exposes no target
business mutation. The unit prepares exact storage and concurrency seams for
later assignments, immutable revisions, review decisions, audit, and UI work
without implementing any of those behaviors early.

This boundary is intentional. RST-014B owns reusable Phase 2 business fixtures
and depends on RST-002B, RST-005, RST-006A, RST-007A, and RST-014A. RST-013B
owns integrated Phase 2 Activity behavior tests and depends on RST-002B,
RST-005, RST-006A, RST-007B, and RST-014B. Making either a prerequisite of
RST-005 would be circular.

## Governing authority

Canonical documents are coequal within their owned subjects:

- `docs/mjl-authoritative-decisions.md` routes authority and records approved
  cross-cutting decisions;
- `docs/mjl-scope-boundary-v2.md` owns scope;
- `docs/mjl-functional-specification-v2.md` owns functional behavior;
- `docs/mjl-permission-matrix-v2.md` owns roles and authorization;
- `docs/mjl-status-and-transition-model-v2.md` owns states and transitions;
- `docs/mjl-data-dictionary-v2.md` owns target data semantics;
- `docs/mjl-decision-register-v2.md` owns recorded decisions;
- `docs/mjl-reset-manifest-v2.md` owns reset-unit boundaries;
- `docs/mjl-implementation-roadmap-v2.md` owns phase sequencing.

This reviewed strategy narrows RST-005 inside those authorities.
`docs/mjl-current-app-functional-map.md` is implementation evidence only. If
canonical owners contradict one another, implementation stops for an explicit
reconciliation; no precedence is inferred.

No legacy POC document, historical prompt, old test expectation, or current
code behavior may widen this scope. A conflict with authority is debt to remove,
not compatibility to preserve.

## Reviewed live baseline

The planning review established the following current facts:

- `llx_mjlfinancement_activity` exists and has zero rows in the shared tenant.
- `llx_mjlfinancement_workflow_action` is absent and must remain absent.
- The current Activity columns are `rowid`, `entity`, `ref`, `label`,
  `fk_project`, `fk_task`, `date_start`, `date_end`, `note_public`,
  `note_private`, `date_creation`, `tms`, `fk_user_creat`, `fk_user_modif`,
  `import_key`, `status`, `fk_user_responsible`, `date_actual_start`,
  `date_actual_end`, `physical_execution_percent`, `execution_status`, and
  `execution_comment`.
- `activities.php` is a read-only Supervisor/Validator route. Authenticated
  POST and any action parameter fail with HTTP 403. Its query is entity-scoped
  and joins an entity-matched Project.
- `mjlactivity.class.php` is an interim six-field read model. Its create,
  update, and delete methods fail closed.
- `mjl_activity_access.lib.php` permits Supervisor/Validator reads and denies
  every Activity mutation. Activity permission `520006` exists only in those
  business-role projections. There is no Activity navigation entry.
- The descriptor currently initializes base SQL whenever module activation is
  forced. It has no reliable version ledger. A destructive or non-idempotent
  migration therefore cannot be hidden in `_load_tables()`, a version bump, or
  an `update_*.sql` file.
- `bootstrap_poc.php` is a retained non-seeding activation path and may be run
  again against an already-enabled module.
- Dormant legacy Activity presentation/email/feedback seams still refer to the
  old schema or states. They have no live call sites and are not target
  behavior.
- The Phase 1 reset and exact-schema verifiers still describe the interim
  Activity table. The RST-013A positive control writes its legacy columns.
- The paths formerly listed for an Activity recovery helper, Activity
  JavaScript, an Activity status-integrity verifier, and workflow/execution
  case files do not exist.

Implementation must recapture these facts immediately before cutover. A
nonzero shared-tenant Activity count, an unexpected workflow/downstream row,
an unknown schema digest, or an unexpected source digest is a hard stop.

## Exact target Activity schema

The executable-exact canonical manifests are:

- `docs/mjl-rst-005-phase1-activity-schema.sql`, SHA-256
  `db69168768515aa2ea4d46f8e8bb61ce5901bc87ed76df2723c9834ccb0dc7e2`;
- `docs/mjl-rst-005-target-activity-schema.sql`, SHA-256
  `8eb99ee99c6dc748bd368e925e9938ccf086291d264e3812ac6320c8ec06b745`.

The hashes are over the exact UTF-8 file bytes with LF endings and seal the two
reviewed source oracles. Runtime verification uses a second, exhaustive
structured physical contract rendered directly from `information_schema` and
trigger bodies: it compares column ordinal/name/type/signedness/nullability/
default/extra/generation/charset/collation, engine and table collation, every
index name/uniqueness/type/column ordinal/collation/prefix length, every foreign
key name/column/referent/update/delete action, every check name/expression, and
every trigger name/timing/event/body. SQL parser presentation artifacts are
canonicalized only outside quoted literals: keyword/identifier case,
whitespace, identifier backticks, and a whole-expression outer parenthesis
pair. Quoted literal bytes and all operators/names remain exact. Column order
is checked separately. The verifier returns the corresponding sealed source-
oracle SHA only after this entire independent physical contract matches; it
does not claim to hash reconstructed oracle bytes. This dual-oracle correction
is part of the pending amendment and requires separate approval before shared
execution. Any source-oracle or physical-contract change requires another
amended strategy and separate approval.
Prefix substitution accepts only the configured Dolibarr prefix after a strict
ASCII identifier check (`^[A-Za-z][A-Za-z0-9_]*$`). Before backup or DDL, the
script materializes every derived table, index, constraint, trigger, lock, and
recovery identifier; requires each database identifier to be at most 64 bytes;
requires the complete set to be pairwise distinct; checks the expected-present
and expected-absent names in `information_schema`; quotes every identifier; and
refuses any mismatch or collision. Boundary-length, overlength, multibyte, and
collision prefixes are negative tests. No caller supplies a table, schema,
trigger, constraint, or prefix name.

The shared prefixed table remains `llx_mjlfinancement_activity`. Before its
normal disposable migration, the focused runner must create an isolated
non-`llx_` scratch prefix with minimal native referents, execute the complete
target SQL oracle including all keys/checks/triggers under that prefix, verify
the physical object counts, and drop the entire scratch set. The migration
state machine itself then runs with the disposable tenant's configured prefix;
this is the strongest non-mutating prefix proof available without rewriting
Dolibarr's immutable process-wide prefix configuration. This correction and
the exact boundary/overlength/multibyte/synthetic-collision helper matrix are
part of the pending amendment. The table below is a semantic index; the target
SQL manifest is the physical contract.

| Column | SQL contract | Meaning |
| --- | --- | --- |
| `rowid` | signed integer, primary key, auto-increment | Immutable identity |
| `entity` | signed integer, required | Active Dolibarr entity |
| `ref` | `varchar(128)`, required | Immutable entity-local reference |
| `fk_partner` | signed integer, required | Structural Partner |
| `fk_project` | signed integer, required | Structural Project |
| `name` | `varchar(255)`, required | Planned Activity name |
| `description` | text, required and nonblank after trimming | Planned description |
| `date_start` | date, required | Inclusive start date |
| `date_end` | date, required | Inclusive end date |
| `draft_authorized_amount` | signed `BIGINT`, required | Current integer-XOF proposal |
| `first_submitted_amount` | signed `BIGINT`, nullable | Revision 1 amount; absent before submission |
| `latest_validated_amount` | signed `BIGINT`, nullable | Latest final-validated revision amount |
| `validation_status` | `varchar(40)`, required, default `DRAFT` | Validation state only |
| `is_cancelled` | `tinyint`, required, default `0` | Explicit terminal cancellation fact |
| `version` | signed `BIGINT`, required, default `1` | PHP-safe optimistic-lock token |
| `date_creation` | datetime, required | Immutable creation timestamp |
| `tms` | timestamp, required, current/update timestamp | Last-write metadata |
| `fk_user_creat` | signed integer, required | Immutable creating identity |
| `fk_user_modif` | signed integer, nullable | Last modifying identity |
| `fk_user_responsible` | signed integer, nullable, forced null | Temporary dormant seam removed by RST-002B |

No other column is retained. In particular, RST-005 removes the legacy label,
task, notes, import key, integer status, actual dates, physical percentage,
execution status, and execution comment columns. It does not add a Convention,
workflow-action, execution, revision pointer, prevalidator, validator,
requested-amount, operation-total, spent-total, or document column.

The internal validation codes are exactly:

- `DRAFT`;
- `SUBMITTED`;
- `RETURNED_SUPERVISOR`;
- `PREVALIDATED`;
- `RETURNED_VALIDATOR`;
- `FINAL_VALIDATED`;
- `CANCELLED`.

RST-005 stores the vocabulary but authorizes only an empty table and the
default `DRAFT` value in disposable schema probes. It implements no transition.
The temporary `chk_mjl_activity_rst005_dormant` constraint makes this boundary
physical: every row must be `DRAFT`, uncancelled, with both historical amount
fields null. RST-006A must replace that named constraint atomically with its
revision-linked Phase 2 constraint before exposing any workflow command. The
successor is named `chk_mjl_activity_rst006a_phase2` and permits exactly
`DRAFT`, `SUBMITTED`, `RETURNED_SUPERVISOR`, `PREVALIDATED`,
`RETURNED_VALIDATOR`, and `FINAL_VALIDATED`, while requiring
`is_cancelled = 0`. RST-006B alone may later replace that constraint to permit
revision-bound Activity cancellation after its request/decision guards exist.

The schema constraints are exact:

- unique `(entity, ref)`;
- `entity > 0`;
- `ref`, `name`, and `description` contain at least one non-whitespace
  character; spaces, tabs, newlines, and mixed-whitespace-only values fail;
- `date_end >= date_start`;
- all three amount fields are integer XOF and nonnegative when present;
- `first_submitted_amount` and `latest_validated_amount` remain null in every
  RST-005-created canary because revisions are not yet authorized;
- `version >= 1`;
- `is_cancelled IN (0, 1)` and `is_cancelled = 1` if and only if
  `validation_status = 'CANCELLED'`;
- `fk_user_responsible IS NULL` until RST-002B removes this seam;
- each status belongs to the exact code set above;
- foreign keys to native Partner, Project, creator, and modifier identities use
  restrictive update/delete behavior; no native/core table is altered;
- indexes cover `(entity, fk_project)`, `(entity, fk_partner)`,
  `(entity, validation_status)`, the individual Partner/Project foreign keys,
  and the creator/modifier foreign keys.

Draft amount zero is explicit data, not missing data. RST-005 permits zero
only because no submission exists yet; it never infers a missing amount as
zero. RST-006A must require at least one positive Opération and exact balance
at submission, which necessarily makes a submitted Activity amount positive.
No JavaScript numeric conversion is authorized for XOF amounts. RST-005 tests
signed-BIGINT storage bounds and negative-value rejection. Canonical decimal
digit-string parsing, fractional/overflow input rejection, and optimistic
compare-and-swap behavior belong to the first later command unit; RST-005 does
not pretend that MariaDB coercion or a denied mutation proves those behaviors.

`entity`, `ref`, `fk_user_creat`, and `date_creation` are immutable after
insert. Partner, Project, name, description, dates, and draft amount are
structural fields, not immutable metadata; later units may change them only
through the versioned deep-module commands and freeze rules. Direct generic
mass assignment is forbidden.

Database guards must reject a missing/cross-entity Partner, a missing or
cross-entity Project, a Project whose native `fk_soc` does not match
`fk_partner`, and a missing/cross-entity creator or modifier. These checks must
exist below the route boundary so direct SQL cannot create a cross-entity or
cross-parent target row. They use explicit existence counts and NULL-safe
equality; a Project with null Partner/entity data is rejected. The
implementation may use narrowly named custom
triggers plus application guards; it must not modify Dolibarr core schema.

## Exact dormant seams retained

RST-005 retains only these seams:

- the Activity table name and entity-local `ref` identity;
- the target Activity columns and invariants enumerated above;
- `fk_user_responsible`, nullable and database-forced to null solely so the
  later RST-002B cutover can prove and remove the legacy responsibility seam;
- Activity permission `520006` and the existing Supervisor/Validator
  read-only route projection;
- the current read-only access helper with every mutation denied;
- an Activity class that owns entity-scoped lookup/projection and fail-closed
  mutation entry points;
- dormant CSS selectors only where they are unreferenced and schema-neutral;
- the non-seeding module activation path;
- the RST-014A isolated-tenant/principal/reference factory as test
  infrastructure, not as a Phase 2 business-data factory.

The primary Agent is not a second Activity foreign key. It is a projection of
the one current primary Activity Assignment owned by RST-002B. Until that unit
lands, no Agent can see or mutate an Activity through target assignment rules.

The Activity module is the future transaction boundary for create, structural
edit, submit/resubmit, and optimistic compare-and-swap. RST-005 gives it
read-only lookup and explicit denial methods only. Later units must route all
business writes through commands that check active entity, current assignment,
role, expected version, structural freeze, revision identity, separation of
duties, and audit atomicity. Routes must not own those rules.

The RST-005 class and route must remain containment-compatible with both sealed
schema digests. They use two fixed, separately tested read projections selected
only after matching the complete target or Phase 1 schema oracle: target
`name`/`validation_status`, or interim `label`/integer `status`. An unknown or
partial schema fails with HTTP 503 and returns no Activity data. No caller
controls a selected column or SQL fragment. The same committed source is kept
during eligible rollback; no pre-RST-005 commit or removed legacy email,
feedback, mutation, or document code is restored.

## Explicitly absent behavior and structures

RST-005 must not create, restore, expose, or simulate:

- Activity create, edit, delete, abandon, submit, return, prevalidate, validate,
  cancel, recreate, execution, recovery, email, or feedback behavior;
- an Activity form/detail/timeline, JavaScript workflow, navigation item, or
  authenticated Agent Activity view;
- Opérations, Activity Assignments, Business Revisions, Revision Contributors,
  Review Decisions, cancellation/reopening requests, or workflow actions;
- any `llx_mjlfinancement_workflow_action` table or generic workflow log;
- audit events for a business action that RST-005 does not authorize;
- document behavior or references;
- legacy Convention/task/execution compatibility;
- persistent sample data or a reusable Phase 2 fixture package.

The first-release disposition of an unsubmitted draft is not specified by the
authority. RST-005 therefore exposes no delete/abandon command. That question
must be decided before a later unit exposes Activity creation; it does not
block an empty schema foundation.

RST-006A is amended prospectively to own the missing Review Decision table and
model together with immutable revisions. RST-005 contains only the Activity
status value; it owns no review history or transition.

### Deferred behavior ownership

| Requirement | Owning reset unit |
| --- | --- |
| Primary/additional assignments, creator-as-primary, assignment visibility, immediate revocation | RST-002B |
| Dedicated creation, structural edit, Opération planning, integer-string input validation, exact balancing | RST-006A |
| Immutable submission/resubmission revisions and contributor snapshots | RST-006A |
| Revision-bound returns, prévalidation, definitive validation, requested amounts, separation of duties | RST-006A |
| Expected-version compare-and-swap and start-date structural freeze | RST-006A |
| Append-only Review Decisions and atomic audit-event append through the executed RST-007A foundation | RST-006A |
| Revision-linked chronology projection over already-recorded audit events | RST-007B |
| Activity/Opération planning navigation, after guards pass | RST-009B |
| Reusable Phase 2 business fixtures | RST-014B |
| Cross-role Activity workflow/authorization acceptance suite | RST-013B |

RST-006A's manifest entry must carry every behavior assigned to it here before
its separate review and approval. No RST-006A command may commit unless its
RST-007A audit event commits in the same transaction; stale or denied commands
change neither business nor audit data except where the canonical audit policy
explicitly requires a denial event. RST-007B owns chronology presentation, not
late audit persistence or business transitions; RST-009B owns exposure, not
authorization.

RST-006A creation must use the active-reference service and reject inactive
Partners or Projects even when their entity and parent relationship match. It
must invoke the RST-002B assignment command in the same transaction so the new
Activity, creator-as-primary current assignment, Activity version, and audit
events either all commit or all roll back. `first_submitted_amount` is written
exactly once from immutable revision 1; `latest_validated_amount` changes only
to the amount of the current definitively validated revision. Both projections
are updated atomically with revision, status, expected-version, Review Decision,
and audit-event changes and are never caller-supplied independent values.

## Closed implementation path inventory

### Modify

- `custom/mjlfinancement/activities.php`
- `custom/mjlfinancement/class/mjlactivity.class.php`
- `custom/mjlfinancement/lib/mjl_ui.lib.php`
- `custom/mjlfinancement/lib/mjl_email.lib.php`
- `custom/mjlfinancement/lib/mjl_email_presentation.lib.php`
- `custom/mjlfinancement/lib/mjl_feedback.lib.php`
- `custom/mjlfinancement/sql/llx_mjlfinancement_activity.sql`
- `custom/mjlfinancement/sql/llx_mjlfinancement_activity.key.sql`
- `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`
- `custom/mjlfinancement/scripts/rst_phase1_reset.php`
- `custom/mjlfinancement/scripts/verify_phase1_reset.php`
- `custom/mjlfinancement/scripts/verify_phase1_schema_exact.php`
- `tests/e2e/phase1-reset.spec.js`
- `tests/unit/rst-phase1-reset.test.js`
- `tests/runner/phase1-cutover-rehearsal.js`
- `tests/runner/disposable-run.js`
- `tests/runner/run-suite.js`
- `tests/fixtures/database-evidence.php` (disposable RST-005 restored-database
  mode plus additive restorable/component fields; every pre-existing canonical
  `dolidb` field and forensic-hash encoding remains byte-for-byte unchanged)
- `tests/unit/disposable-evidence.test.js` (assert only the additive RST-005
  restorable-evidence boundary and preservation of generated metadata)
- `tests/unit/disposable-run.test.js`
- `tests/unit/operational-script-boundary.test.js`
- `package.json`
- `playwright.config.js`
- `docs/mjl-current-app-functional-map.md`
- `docs/mjl-current-vs-target-gap-analysis.md`
- `docs/mjl-acceptance-tests.md`
- `docs/mjl-test-coverage-registry.md`
- `docs/mjl-authoritative-decisions.md` (approval/execution status only)
- `docs/mjl-decision-register-v2.md` (approval/execution record only)
- `docs/mjl-reset-manifest-v2.md`
- `docs/mjl-implementation-roadmap-v2.md`
- `docs/mjl-docs-index.md`
- `CONTEXT.md` (executed-current-state summary only)
- `tasks/lessons.md` (only durable MariaDB cutover/restart discoveries required
  by the repository lessons policy)

The three dormant email/presentation/feedback files are modified only to
remove obsolete old-schema Activity states and messages. RST-006A may later
introduce revision-aware messages under separate approval.

### Create

- `custom/mjlfinancement/scripts/rst005_activity_foundation.php`
- `custom/mjlfinancement/scripts/activity_schema_installer.lib.php`
- `custom/mjlfinancement/scripts/verification/schema/activity_foundation.php`
- `custom/mjlfinancement/scripts/oracles/rst005_phase1_activity.sql` (deployed,
  byte-identical copy of the sealed Phase 1 rollback oracle)
- `tests/runner/rst005-cutover-rehearsal.js`
- `tests/unit/rst005-activity-foundation.test.js`
- `tests/e2e/rst005-activity-foundation.spec.js`
- `docs/mjl-rst-005-execution-report.md`

### Reviewed strategy artifacts already created

- `docs/mjl-rst-005-activity-foundation-strategy.md`
- `docs/mjl-rst-005-phase1-activity-schema.sql`
- `docs/mjl-rst-005-target-activity-schema.sql`

### Retain and verify without behavior expansion

- `custom/mjlfinancement/lib/mjl_activity_access.lib.php`
- `custom/mjlfinancement/lib/mjl_scope.lib.php`
- `custom/mjlfinancement/lib/mjl_navigation_registry.lib.php`
- `custom/mjlfinancement/scripts/bootstrap_poc.php`
- `custom/mjlfinancement/css/mjl_app.css.php`
- `custom/mjlfinancement/documents.php`
- `custom/mjlfinancement/documentdownload.php`
- `custom/mjlfinancement/nativeforbidden.php`
- `custom/mjlfinancement/deployment/apache-native-guard.conf`
- `custom/mjlfinancement/js/native_guard.js.php`
- `custom/mjlfinancement/class/actions_mjlfinancement.class.php`
- `tests/helpers/phase1-fixture.js`
- `tests/fixtures/phase1-fixture.php`
- `tests/fixtures/phase1-fixture-preflight.php`
- `tests/runner/disposable-evidence.js`
- `tests/runner/disposable-policy.js`

If implementation proves that a path outside this inventory must change, work
stops for an amended strategy and separate explicit approval. Generated local
test evidence may be written only to the already-approved ignored evidence
root; it is not a source-path expansion.

## Migration and activation protocol

MariaDB DDL is not assumed transactional. The migration is a dedicated,
one-shot, fail-closed script, never an implicit base-SQL/module-init upgrade.
The reviewed implementation keeps `apply`, `finalize`, and `rollback`
unconditionally disabled outside an attested RST-014A disposable tenant while
this amendment is pending. Separate approval does not by itself remove that
technical stop: a later reviewed, approval-bound shared launcher must first
enforce the exact approved commit, a clean complete worktree, traffic stop,
root-owned backup/manifest custody, FD-held hashing, and separate key escrow
before it may enable any shared mutation.

1. Stop application traffic and record the maintenance boundary.
2. Capture commit, source-path hashes, module state, exact table/column/index/
   constraint/trigger definitions, row counts, and all protected Phase 1 data
   and filesystem/ECM digests.
3. Require the approved old Activity schema digest, zero Activity rows, absent
   workflow-action/revision/operation/assignment/review/request tables, and
   zero Activity-linked audit rows. Refuse any mismatch.
4. Produce a checksummed schema-only backup and a checksummed full database
   rollback backup. The shared rollback backup is created outside the repository,
   generated evidence, web roots, and Compose volumes in a newly created
   root-owned directory with mode `0700`; files are mode `0600`, never named in
   argv, never written to stdout, and checksummed by streaming. It is encrypted
   at rest with an operator-supplied key that is never committed, logged, or
   passed in argv. Record only opaque location identity, size, cipher metadata,
   and digest. Retain it only through the dependent rollback window under
   operator custody, then require separately authorized secure destruction.
   Encryption uses PHP libsodium XChaCha20-Poly1305 secretstream with a fresh
   header, final authenticated tag, and a 32-byte key generated from the OS
   CSPRNG—never a password or operator-authored string. The key arrives at each
   process on a dedicated inherited file descriptor, never argv/environment/
   artifact; plaintext dump bytes stream directly into encryption and are never
   stored. The shared-backup key is escrowed separately under protected
   operator custody for exactly the same rollback window as the ciphertext.
   Disposable rehearsal backups use an isolated `0700` temp directory, are
   secret-scanned as opaque artifacts, and are unconditionally destroyed with
   tenant teardown. Before DDL, decrypt and restore each artifact with the same
   FD-only key into a separate isolated disposable database: the schema backup
   must match the sealed preflight schema digest, and the full backup must match
   a complete preflight restorable-logical database digest covering every
   definition and row while excluding only MariaDB-generated trigger/routine/
   event creation/alteration/execution timestamps that dump/restore cannot
   preserve. Only the isolated restore database's schema identity is
   canonicalized back to `dolidb`; component hashes identify a differing
   database definition, table, or schema-object class without exposing row
   data. The original all-field forensic digest and its existing encoding
   remain mandatory for
   before/after drift checks and is never weakened. At least one restore runs in a fresh
   process using the separately custodied key, not an in-memory producer copy.
   Then destroy restored databases, plaintext streams, transient FD buffers,
   rehearsal keys, and disposable backup artifacts. The shared ciphertext and
   escrowed key remain separately protected until their joint, separately
   authorized destruction after the rollback window. Existence or decryption
   without digest equality is insufficient.
5. Create the complete target Activity table, indexes, foreign keys, checks,
   and triggers under the prefix-substituted exact temporary name
   `llx_mjlfinancement_activity_rst005_target`. Verify its canonical logical
   schema digest and empty row count. The digest normalization changes only the
   physical table name to the live logical name; it preserves every column,
   type, default, index, foreign-key action, check, and trigger body.
6. In one atomic `RENAME TABLE`, move the interim table to one exact quarantine
   name, `llx_mjlfinancement_activity_rst005_phase1_quarantine`, and the
   verified target table to the live name. Never use drop-then-create against
   the live name.

Immediately before step 6, the migration installs one exact temporary
`BEFORE INSERT` containment trigger on the empty Phase 1 table. This is the
sealed guarded-pre-rename state and rejects every direct writer. The migration
session then holds both a nonblocking database-scoped advisory lock unique to
database/prefix/RST-005 and exclusive MariaDB table locks covering the live and
target Activity tables plus read locks for every preflight table whose rows are
required absent. After those locks are acquired—and therefore after earlier
writers have completed—it rechecks the exact guarded-old/target schema digests,
zero live/target rows, zero Activity-linked audit/downstream rows, and the
sealed object-name set. MariaDB factually refuses `RENAME TABLE` while explicit
table locks remain held, so the session releases those locks only after the
recheck and immediately performs the atomic rename while the insert guard still
closes the writer boundary. The guard moves with the quarantined table and is
then removed by exact name. A crash before guard removal is a recognized sealed
state; resumption verifies the guarded quarantine and removes only that trigger.
Failure to acquire or retain either lock or guard aborts. Rehearsal holds a
competing direct-SQL writer across each boundary and proves it cannot commit a
row into the quarantined schema. Module activation and every RST-005 runner
also take the advisory lock, so migration, activation, rollback, and
finalization cannot overlap.
7. Run target schema, denial, activation-idempotence, and disposable-tenant
   probes. Force module activation twice and prove that neither activation
   changes the target schema or data.
8. Retain the quarantine table through preliminary reversible-state gates only.
   Those preliminary digests are diagnostic and are not completion evidence.
   Module activation may deterministically rewrite descriptor/permission/menu
   metadata even when Activity schema/data stays unchanged, so finalization must
   not reuse the pre-activation protected-database attestation. After the two
   activation probes, recapture the complete RST-014A database/filesystem/ECM
   evidence and seal a second checksummed
   `post-activation-pre-finalization` manifest. Finalize and any later eligible
   reconstruction rollback accept only that second checkpoint; neither
   checkpoint permits an unobserved protected-surface change.
   After verifying the quarantine identity and zero rows, finalization may drop
   only that named table. It then recaptures the complete database, protected
   projection, exact schema delta, source, filesystem/ECM, Admin, audit, module,
   and Compose evidence and seals only this post-finalization set. If final
   recapture fails, retain the target read-only, mark RST-005 failed, and use the
   eligible reconstruction/full-backup rollback policy; never claim completion
   from the preliminary set.

Every stage is resumable by observed state, not by an unchecked marker. Exact
preflight, pre-rename, post-rename, activation-failure, verification-failure,
and finalization-failure simulations must prove that the script either leaves
the old containment schema live or leaves the verified target schema live and
read-only. A third/duplicate execution against the completed target is a
no-op verification, not another migration.

Crash/restart tests open a fresh database connection and restart the disposable
MariaDB container after each DDL boundary: before target creation, after table
creation, after each target index/FK/check/trigger group, immediately before
and after atomic rename, during activation, during verification, and during
finalization. The state machine recognizes only the sealed combinations of the
live, target, quarantine, restore, and failed-target names described here. It
may drop only a positively identified empty pre-rename target or a verified
empty failed-target after recovery succeeds. Every other combination refuses
without cleanup.

Before quarantine finalization, eligible rollback uses one atomic reverse
rename after verifying both table identities and zero row counts. After
finalization but before a dependent unit, eligible rollback creates the exact
interim schema under `llx_mjlfinancement_activity_rst005_phase1_restore`,
verifies it against the sealed pre-cutover schema digest, then atomically
renames the empty target to `llx_mjlfinancement_activity_rst005_target_failed`
and the verified restore table to the live name. The failed target is retained
until rollback checks pass and only then dropped. Unknown combinations of live,
temporary, quarantine, restore, or failed-target tables always refuse.

Clean installation and upgrade must converge on the same canonical target
schema digest. Base SQL defines the target for clean installs; the dedicated
script owns the known empty interim-to-target replacement. Descriptor init has
three exact branches: when no MJL module table exists, load the complete target
base SQL as a clean install; when the complete approved Phase 1 schema including
the interim Activity digest is present, register containment-safe descriptor
metadata without Activity DDL and return the explicit nonpersistent result
`RST005_MIGRATION_REQUIRED`; when the complete approved target plus retained
Phase 1 schema digests are present, register descriptor metadata without
Activity DDL and return success. Pre-migration and eligible post-rollback Phase
1 states deliberately take the same migration-required branch. Every partial
or unknown state refuses. The descriptor may record the new source version but
creates no persistent readiness marker and must never destructively rewrite an
existing Activity table during activation.

The retained `user_role.active_user_id` generated column has two observed and
separately sealed physical ordinals: the Phase 1 live tenant appended it by
`ALTER TABLE`, while clean installation creates it beside `is_active`. MariaDB
semantics, keys, expressions, and every other retained definition are identical.
RST-005 accepts only those two complete retained-schema digests and performs no
column reorder or other retained-table repair; an unrecognized third form is a
hard stop.

The exact clean-install/upgrade trigger driver is
`custom/mjlfinancement/scripts/activity_schema_installer.lib.php`. It sends
each complete `CREATE TRIGGER` body as one database-driver statement after
strict prefix/name validation. The documentary `DELIMITER` lines in the schema
oracle are never sent to MariaDB and are not parsed by `_load_tables()`. Both
clean install and dedicated migration call this helper and then compare every
trigger name, timing/event, table, and body with the same canonical digest.

The composed Phase 1 rehearsal remains historical evidence: it first proves
the fixed Phase 1 interim schema with a retained historical verifier, then runs
the explicit RST-005 migration, then runs target activation and target
verifiers. `test:phase1-reset` must not silently call bootstrap and expect an
interim table to become target. The runtime `verify_phase1_schema_exact.php`
recognizes the current target only after the explicit migration; the sealed
Phase 1 schema manifest above remains the rollback/replay oracle.

## Disposable verification contract

RST-005 may consume the RST-014A serial isolated-tenant factory for principals
and active Partner/Project references. It may not add reusable Phase 2 business
fixtures. The focused RST-005 verifier alone may directly insert these
transaction-local or disposable-tenant canaries:

- exactly one valid same-entity, matched-Partner/Project `DRAFT` Activity with
  unique field canaries, explicit integer-XOF amount, `version = 1`, null
  submitted/validated amounts, null responsible user, and no audit row;
- exactly one otherwise-valid Activity in a second disposable entity, used
  only to prove the first entity's projection cannot read it;
- rejected insert/update attempts for cross-entity Partner, cross-entity
  Project, mismatched Partner/Project, orphan parent/user, duplicate
  entity-local reference, entity zero, null Project parent/entity, blank or
  spaces/tabs/newlines-only required text, reversed dates, negative amount,
  illegal status, inconsistent cancellation, zero version, nonnull responsible
  user, and mutation of immutable identity metadata.

No canary may be resumed from SQL, shared with another suite, or selectively
cleaned up. Fixture setup must use the RST-014A factory in its serial fixture
group, transmit authentication secrets through its canonical stdin transport,
and destroy the whole disposable tenant on success, failure, timeout, or
signal. The shared tenant remains read-only and empty.

The tests must also prove:

- anonymous GET returns HTTP 403 with no redirect `Location`, login form, or
  business content;
- anonymous POST plus action parameters in query and body return the exact
  HTTP 403 status, no redirect `Location`, and no login form or business content,
  with unchanged Activity, audit, and complete-database digests;
- every authenticated role's POST/action attempt is denied with no row/audit
  change;
- Agent and Admin direct GET are denied; Supervisor/Validator GET is a minimal
  active-entity read-only projection;
- direct URL, query, identifier-tampering, cross-entity, cross-parent, orphan,
  and duplicate probes fail closed;
- Activity permission/nav state does not expand;
- the class exposes no successful generic create/update/delete path;
- the absent paths/tables listed above remain absent;
- module activation, bootstrap, verification, and rollback are idempotent;
- no real credential, fixture password, token, document content, or raw auth
  material appears in logs or committed evidence.

## Before/after evidence and checksums

The execution report must reuse RST-014A's server-enforced read-only,
consistent-transaction, lossless all-table/all-column evidence implementation.
It must contain canonical before/after SHA-256 digests for:

- the complete protected source roots `custom/`, `docs/`, `tests/`, plus
  `AGENTS.md`, `CONTEXT.md`, `DESIGN.md`, `README.md`, `docker-compose.yml`,
  `package.json`, `package-lock.json`, and `playwright.config.js`, with path,
  type, mode, and content and no exclusions, captured by the external RST-014A
  evidence boundary and bound to the exact commit presented for separate
  amendment approval;
- exact Activity schema, indexes, foreign keys, checks, triggers, and row count;
- the complete application database: defaults plus every base table, sequence,
  view, trigger, routine/parameter, event, column, and row, with no exclusions;
- a separate all-column native Admin attestation and all business-role counts;
- audit-event count and digest;
- module constants, permissions, menu metadata, and activation state;
- complete `data/documents` NUL-safe path/type/mode/content manifest and native ECM
  all-column ordered row manifests;
- the exact Compose container/network/volume, disposable tenant/database/user,
  and resource manifest before and after teardown;
- backup artifact digests and the final absence of temporary/quarantine objects.

Raw database/filesystem manifests must be streamed to digests and never
materialized. Evidence includes only digests, counts, and nonsecret summaries.
The complete before/after database digests are both retained and are expected
to differ because the Activity schema changes. A second deterministic protected
database projection excludes only the enumerated Activity columns, indexes,
foreign keys, checks, and triggers—but never Activity rows—and must compare
equal. A third comparison proves that the complete schema delta is exactly the
sealed old-oracle removal plus target-oracle addition. All other protected
surfaces match except the approved source-path delta. The shared Activity row
count remains zero. Any non-allowlisted mismatch is a failed unit, not a note.

The disposable migration contains a compile-time SHA-256 of every dependent file in
`custom/mjlfinancement` except its own orchestrator, and independently compares
that digest with the evidence manifest at every mutating entry. The orchestrator
cannot self-hash an embedded digest without a circular fixed-point problem; it
is not claimed as covered by that internal seal. All mutating modes refuse
outside the attested disposable boundary. Before shared execution can be
implemented, the separate root/operator-owned launcher described above must
close the orchestrator and every non-module protected path with the complete
source digest and exact Git commit separately approved by the user. A
caller-supplied manifest or regenerated digest cannot substitute for that
approval. Any mismatch must stop before backup or DDL. This disabled-until-
approval source boundary is part of the pending amendment.

## Rollback boundary

Rollback is containment-only and dependency-aware:

- Before any downstream Phase 2 unit and while the target Activity table is
  empty, rollback may atomically restore only the verified Phase 1 interim
  Activity schema. The committed dual-oracle class/route remains deployed and
  selects its fixed interim read-only Supervisor/Validator projection; its
  target projection is re-proved when RST-005 is reapplied.
- It must not restore Convention linkage, task/execution fields as behavior,
  legacy mutations, workflow actions, old email/feedback behavior, navigation,
  documents, samples, or any removed finance surface.
- After RST-002B/RST-006A/RST-007B/RST-009B/RST-013B/RST-014B executes, or if
  any target Activity/downstream row exists, standalone RST-005 rollback must
  refuse. The safe response is to revoke Phase 2 readiness, disable all Phase 2
  mutation/navigation, retain the target schema read-only, and require reverse-
  dependency rollback or an explicitly approved full-backup restore.
- This refusal is based on direct canonical schema/object/row/source evidence,
  not a status or readiness marker alone.
- The Phase 1 reset script is not an RST-005 rollback mechanism. It must detect
  the target schema and refuse any stale reconstruction that could restore
  Convention or legacy document/business behavior.
- Rollback must preserve RST-010A containment and every completed Phase 1
  invariant and must finish with before/after database, filesystem, and ECM
  checksum comparison.

## Acceptance gates

RST-005 is complete only when all of the following are true:

1. The committed implementation matches this exact inventory and boundary.
2. Shared preflight proves the approved empty baseline and exact old digest.
3. Clean install, one-shot upgrade, duplicate run, double activation, every
   failpoint, and eligible rollback converge to their canonical digests.
4. Target schema and database triggers reject every invalid direct-SQL probe.
5. HTTP/auth/entity/parent/role/POST denial tests pass in disposable tenants.
6. The shared tenant still contains one native Admin, no business Activity,
   no new audit event, no persistent fixture, and unchanged protected data,
   document, and ECM digests.
7. RST-002B/RST-006A/RST-007B/RST-009B behavior remains absent.
8. PHP syntax, focused unit, focused E2E, phase verification, teardown audit,
   secret scan, and operational-boundary tests pass.
9. Independent Standards and Spec reviews report no actionable findings.
10. The execution report records commands, outputs, digests, skipped checks,
    and the exact committed implementation SHA.

## Reviewed sequence after RST-005

After separate approval, implementation, evidence, and clean review of
RST-005, Phase 2 proceeds in this order:

1. separately review/approve and execute RST-002B assignment scope;
2. separately review/approve and execute amended RST-006A, including immutable
   revisions, contributors, Review Decisions, and planning transactions;
3. separately review/approve and execute RST-007B chronology projection;
4. separately review/approve and execute RST-009B navigation;
5. separately review/approve and execute RST-014B disposable Phase 2 fixtures;
6. separately review/approve and execute RST-013B integrated Phase 2 tests;
7. issue the formal Phase 2 verdict.

No step inherits approval from this strategy or from general Phase 2 approval.
