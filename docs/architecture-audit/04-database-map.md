# Database forensic map

## Custom tables

| Table suffix | Purpose | Primary writers | Integrity and lifecycle |
| --- | --- | --- | --- |
| `audit_event` | immutable business/technical evidence | audit writer, commands, auth/scope/reference/export modules | entity scoped; UPDATE/DELETE rejection triggers; actor snapshots and before/after/context |
| `user_role` | one effective non-Admin role | scope/access module, activation/reset scripts | active-row uniqueness and admin/business exclusion triggers |
| `invitation` | invitation selector/verifier lifecycle | auth module | hashed verifier, expiry/status; one live credential; terminal hash clearing |
| `password_reset` | reset selector/verifier lifecycle | auth module | hashed verifier, expiry/status/throttling; target/entity trigger |
| `login_otp` | pending OTP challenges | auth module and activation installer | HMAC code/bindings, expiry/attempt/resend counters, generated live-state uniqueness |
| `operation_type` | entity-scoped reference | reference module | immutable identity, active/inactive, no application hard delete |
| `activity` | Activity aggregate root | Activity command | entity/ref/version/state/current-revision, integer XOF and lifecycle constraints |
| `activity_assignment` | current/historical Agents | assignment and command modules | primary/current uniqueness and same-entity/role triggers |
| `activity_reference_sequence` | generated Activity reference counter | command module | entity/year scoped allocation under lock |
| `activity_revision` | immutable submitted snapshot | command module | numbered current revision, hashes and amount |
| `revision_contributor` | identity-based separation history | command module | revision/user uniqueness |
| `review_decision` | exact-revision Supervisor/Validator decisions | command module | stage/decision/reviewer constraints |
| `operation` | planned and executed Operations | command module | status, explicit nullable spending, optimistic version, parent entity/activity |
| `cancellation_request` | version-bound exception | command module | generated live-request uniqueness, terminal decisions |
| `reopening_request` | completed-Operation reopening | command module | generated live-request uniqueness, terminal decisions |
| `export_record` | immutable generated-output evidence | export module | report/filter/hash/byte count metadata; current schema RST-012 |
| `project_note` | historical/custom Project notes | no runtime writer found | installed and preserved by migration code, but source-level runtime reachability is absent; lifecycle compatibility blocks automatic deletion |

## Material native tables

`llx_user`, `llx_user_rights`, `llx_rights_def`, `llx_societe`, `llx_projet`, `llx_ecm_files`, `llx_const`, module and cron tables are materially queried or changed. MJL uses native User, Third Party and Project objects but applies additional entity, role and lifecycle checks around them.

## Mutation ownership

- Auth: native user password/status plus invitation/reset/OTP/audit rows.
- Scope: user role, native rights and access status, credential revocation and audit.
- Activity aggregate: Activity, assignments, Operations, revisions, contributors, decisions, exception requests, reference sequence and audit.
- References: native Partner/Project and custom Operation Type plus audit.
- Export: a repeatable-read transaction captures report data, then a separate read-committed final-authorization transaction writes the export record and audit.
- Lifecycle: DDL, constraints, triggers, module constants and cron registration.

## Transaction and locking behavior

- Activity commands use `READ COMMITTED`, deterministic actor/aggregate/child locks, expected versions, active-entity predicates and transaction-bound audit.
- Export generation reads a repeatable snapshot, renders privately, then reacquires identity/assignment locks before committing audit and export evidence.
- Auth uses named identity locks and user/credential row locks for invitation/reset/OTP concurrency.
- Reference writes lock the current manager and target native row; Partner deactivation cascades to active Projects atomically in intent.
- Installation uses database-scoped named locks plus exact schema detection. MariaDB DDL remains implicitly committing; failure recovery relies on recognizers rather than transaction rollback.

## Forensic findings

| ID | Severity | Finding | Evidence/status |
| --- | --- | --- | --- |
| DB-F01 | RESOLVED | Reference create/rename/lifecycle now fail before writes when outer `begin()` fails, reject every failed commit including no-op paths, attempt rollback, and close the connection if rollback fails. | SOURCE plus passing `tests/contracts/reference_transaction_test.php`; native Dolibarr 23.0.2 driver semantics inspected read-only |
| DB-F02 | RESOLVED | Reset trigger and consume guard now permit only the native entity-0 Admin exception while preserving same-entity rules for non-admin targets. | SOURCE plus disposable auth E2E 12/12 |
| DB-F03 | MEDIUM | DDL activation cannot be described as atomic rollback; historical reverse-prefix tests conflict with later schemas. | SOURCE + DOC; runtime recovery unverified |
| DB-F04 | VERIFIED_WITH_NOTES | Native Dolibarr 23 transaction depth and return behavior were inspected read-only. Nested native calls remain inside the checked MJL outer transaction; external native side effects remain bounded adapter behavior. | native `DoliDB`, `Societe`, and `Project` inspection |

Every query path found for custom business objects includes active entity either directly or through the locked aggregate. The annexes index SQL/PHP database and DDL sites using different lexical categories, but those records are not reconciled to a unique statement denominator or individually reviewed write records; the 100%-write-coverage gate therefore fails.
