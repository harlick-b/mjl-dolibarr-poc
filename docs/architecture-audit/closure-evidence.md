# Audit closure evidence

## Scope boundary

This pass implemented only the two high-risk corrections named by the original
forensic audit. It did not change routing, exports, cron behavior, test-runner
orchestration, migration behavior, UI structure, or application architecture.
The audit baseline remains commit
`ca6139b57597a4e9dc32216e167e57f8be53d7d4` on `main`.

The closure work changes three application files and two verification files:

- `core/modules/modMjlFinancement.class.php`;
- `lib/mjl_auth.lib.php`;
- `lib/mjl_reference.lib.php`;
- `tests/e2e/authentication.spec.js`;
- `tests/contracts/reference_transaction_test.php`.

The changed files were read again in full. Their post-change combined
application/test manifest is
`984ce3aab8d499b4d7acf2d0703b1322ab6bd04bf22d6db65a94561617919b76`;
the application-only manifest is
`894b18928e83a2649990985e6d3b3dc972fef6fbf1633cfd930656f4a50e7eba`.
The original annexes remain the immutable baseline inventory; this document is
the delta record for the five changed files.

The application tree grew from 20,535 to 20,560 lines. Its only new named
runtime symbol is `mjl_reference_rollback()`, a behavior-mapped local helper
that attempts rollback and closes the database connection when rollback fails.
The immutable annex population remains 1,993 records; the current population
is those records plus this explicitly recorded closure helper.

## Original high-risk findings

### Technical Admin password reset — resolved

The retained technical Admin is the active native administrator at user entity
0. Reset requests are stored in the active positive runtime entity so selectors,
throttling, audit, and lookup remain tenant-scoped. The reset insert/update
triggers now allow exactly the same narrow global-Admin relation as OTP:

```text
native Admin: admin=1, user.entity=0, reset.entity>=1
business user: admin=0, user.entity=reset.entity
```

The consume guard applies the same distinction after fetching the target user.
It still requires an active account and a nonempty effective role. Reset rows
remain immutable in entity, user, and selector. This closes the former mismatch
without allowing cross-entity business-user reset.

`npm run test:auth` passed 12/12 in a disposable tenant. The added regression
discovered the retained Admin dynamically, created its active-entity reset, consumed it, verified the
terminal credential state, and reached OTP verification with the new password.
The runner removed its containers, network, and volumes. No shared-tenant write
occurred.

For an already-enabled tenant, copying the changed descriptor does not replace
the stored database triggers. The existing `bootstrap_poc.php` deployment path
force-initializes `modMjlFinancement`; that step is required to install the
corrected triggers. The disposable E2E proves clean activation and the complete
reset flow. Trigger replacement during reactivation was source-inspected but
was not executed as a separate lifecycle test.

### Reference transaction outcomes — resolved

Inspection of Dolibarr 23.0.2 `DoliDB` established that a failed outer
`begin()` returns zero without opening a transaction, a failed outer `commit()`
returns zero while leaving transaction depth open, and `rollback()` can itself
fail. Continuing after failed `begin()` could therefore autocommit a native or
custom write independently from its audit. Ignoring failed `commit()` could
return false success with uncertain durability.

Reference create, rename, and lifecycle paths now:

- stop before locks or writes when `begin()` fails;
- check every commit, including no-op branches;
- attempt rollback after any failed commit;
- close the database connection when rollback fails so uncertain connection
  state is not reused;
- retain the existing user-facing failure outcomes and business behavior.

`php tests/contracts/reference_transaction_test.php` passed. It exercises
failed begin for all three public write functions, failed commit for create and
both no-op and mutating update/lifecycle branches, rollback requests after commit uncertainty, and connection
closure after rollback failure. Syntax checks passed for every changed PHP
file.

## Preservation reverse links

| Requirement | Closure implementation/evidence |
| --- | --- |
| `SEC-AUTH-003`, `SEC-AUTHZ-001`, `DB-001`, `DB-003`, `LIFE-001` | reset trigger definitions in `modMjlFinancement`, consume scope guard in `mjl_auth.lib.php`, retained-Admin disposable E2E |
| `DB-001`, `DB-002`, `RT-008`, `RT-014` | checked transaction boundaries and rollback quarantine in `mjl_reference.lib.php`, direct failure contract |
| `SEC-AUTH-006` | open blocker at `mjl_auth_set_password()` and native `User::setPassword()` boundary; no implementation yet |
| `DB-004`, `LIFE-003`, `RT-011` | open RST-006B early-prefix blocker in `mjl_rst006b_detect_schema()`; no implementation yet |

## Secondary-risk closure

The independent closure review converted several unknowns into bounded
classifications. They were not implemented because the approved correction
scope was limited to the two findings above.

| Area | Classification | Evidence and disposition |
| --- | --- | --- |
| password storage | **HIGH blocker** | Native `User::setPassword()` can populate legacy `llx_user.pass` unless `DATABASE_PWD_ENCRYPTED` is enabled. MJL does not force that setting, and the shared tenant has no such constant. Existing retained credentials were not found in cleartext, but the next invitation/reset can traverse the unsafe branch. Add encrypted-only enforcement and a `pass IS NULL` regression before the gate can pass. |
| RST-006B interrupted apply | **HIGH blocker** | The exact prefix recognizer accepts the early operation-check stages, but the top-level detector returns `UNKNOWN` before a later marker appears. Apply therefore cannot resume the first four legitimate DDL interruption states. Correct detection and prove interruption after each operation-check DDL. |
| HTTP mutation methods | **MEDIUM confirmed weakness** | Primary business/admin/report routes enforce POST. Invitation acceptance and both custom native-reset actions rely on POST forms plus CSRF but have no explicit server method guard; the native dispatcher also lacks one. Add direct GET/HEAD characterization and narrow 405 guards in a separately approved security correction. |
| export streaming | **MEDIUM reliability defect** | Authorization and validation complete before output, and `GENERATED` intentionally records a complete private artifact before delivery. A server `fread() === false` is treated as EOF and can produce a truncated 200 response. Preserve generation semantics when adding a read-failure contract. |
| cron | **VERIFIED_WITH_NOTES / MEDIUM availability risk** | The single hourly entity-local reconciler is command-idempotent under Activity locks. Native launch claims can overlap; a failing early Activity stops later rowids; the installed shared job was enabled but overdue and had never run when inspected. Runtime scheduling is an operator gap, while poison-row starvation needs a separate behavior decision. |
| runner | **MEDIUM verification defects** | A child that exits zero after deadline can be reported successful. Historical schema modes do not pass `MJL_TEST_MODE` into bootstrap and therefore provision incompatible targets. These defects weaken lifecycle evidence but did not invalidate the focused auth or direct transaction results above. |
| auth schema activation | **MEDIUM lifecycle risk** | Existing OTP tables are accepted by existence and auth checks by constraint name. A missing OTP live-user unique index or weakened same-name check can survive activation. Exact verification or an explicit repair policy remains required. |
| privacy | **MEDIUM/LOW residual risks** | A valid reset selector reveals the full email before verifier proof; failed-login native event context retains the supplied identifier. Test outboxes remain expected disposable-only secret stores. |

## Lifecycle facts

Clean installation, predecessor recognition, RST-005/RST-002B/RST-006A/RST-006B/RST-012
prefixes, retained disposable modes, and fail-closed unknown states are mapped in
`05-module-lifecycle.md`. That mapping is sufficient to locate each transition,
but the RST-006B early-prefix defect and historical runner-mode mismatch mean
lifecycle verification is not yet sufficient for the architecture gate.

## Gate rerun

| Gate | Result |
| --- | --- |
| application and verification populations remain classified | PASS |
| changed files re-audited and delta-manifested | PASS |
| request, database, authorization, workflow, frontend, and current-architecture maps remain valid | PASS WITH RECORDED DELTAS |
| original technical Admin reset blocker resolved | PASS |
| original reference transaction blocker resolved | PASS |
| CRITICAL unresolved findings | PASS — 0 |
| HIGH unresolved architecture blockers | **FAIL — 2 newly established blockers** |
| lifecycle sufficiently verified | FAIL |
| authentication state sufficiently verified | FAIL because cleartext credential persistence remains possible |
| preservation ledger reconciled | PASS |
| regression baseline sufficient for the first architecture migration waves | FAIL while the two high blockers remain |

## Required final report

```text
Starting verdict:
NOT_READY

Final verdict:
NOT_READY

HIGH findings at start:
2

HIGH findings resolved:
2

HIGH findings remaining:
2 newly established during closure

CRITICAL findings:
0

Confirmed defects fixed:
2

False positives / audit misunderstandings closed:
0

New preservation requirements:
1

Regression tests added/updated:
2

Verification suite:
PASS for the approved focused corrections

Architecture gate:
FAIL
```

No target-architecture proposal is authorized or included.
