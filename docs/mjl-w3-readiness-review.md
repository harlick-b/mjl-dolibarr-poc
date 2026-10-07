# MJL W3 Readiness Review

## 1. Executive verdict

```text
ARCHITECTURE_FROZEN
STANDARD_FROZEN
W0_COMPLETE
W1_COMPLETE
W2_COMPLETE
W3_READY_FOR_AUTHORIZATION
W3: NOT_AUTHORIZED
W4–W7: NOT_AUTHORIZED
```

W3 is ready for a later, explicit implementation authorization. This review is
documentation-only and changes no runtime, test, schema, tooling, dependency,
CI, or frozen-governance file. Readiness does not authorize W3, W4, feature
acceptance, or production preparation.

The review found no authority conflict or post-W2 discrepancy. Twelve ledger
rows need characterization before their corresponding responsibility moves or
is retired. None requires resolution before W3 authorization.

## 2. Authority and post-W2 baseline

| Evidence | Result |
| --- | --- |
| Post-W2 HEAD | `143f89e2285e860cdaa45fd6d6580c74b39556aa`; clean at review entry |
| Frozen architecture | SHA-256 `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| Frozen Engineering Standard | SHA-256 `a47f2d942172a4685b02efce027ca04c0a2361f258ebd8c0b776117c97f8f62e` |
| Historical independent review | SHA-256 `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |
| Prior baselines | W0 `bccf5a708aec25f98499bed6b7da3f607c0541d5`; W1 `03aad09`; W2 commit above all exist |
| Preservation baseline | 35/35 requirements classified below |
| W2 output | one authoritative Activity handler/read/presentation path; legacy mixed owners absent |

The historical audit maps predate W1/W2. Their W3 reference/access facts remain
source-correct. Their Activity-owner references are `STALE_AUDIT_RECONCILED`
through the verified W2 output and are not copied as current facts. Every W3
ledger claim below was checked against post-W2 HEAD. Discrepancies: **0**.

### Post-W2 responsibilities

| W2 output | W3 classification | Evidence |
| --- | --- | --- |
| Activity root-to-handler handoff and HTTP orchestration | `MUST_REMAIN_UNCHANGED` | `activities.php`; `lib/activity/mjl_activity_http.lib.php` |
| Activity feedback/effects and templates | `MUST_REMAIN_UNCHANGED` | `lib/activity/*`; `tpl/activity/*` |
| Activity monitoring and audit reads | `MUST_REMAIN_UNCHANGED` | `lib/monitoring/mjl_monitoring_read.lib.php`; `lib/audit/mjl_audit_timeline_read.lib.php` |
| Activity POST command dispatch | `MUST_REMAIN_UNCHANGED` | W2 handler calls unchanged Activity/assignment interfaces |
| Removed Activity route/timeline owners | `W3_DEPENDS_ON` | files remain absent; W3 must not recreate or route through them |
| Clean ownership needed before the next command wave | `W3_DEPENDS_ON` | W2 ledger T23; reconciled below |

## 3. Exact W3 contract

| Contract part | Frozen result |
| --- | --- |
| Purpose | give reference and access writes explicit, deep transaction-owning modules |
| Current problem | stateful reference/access mutations live in procedural libraries; invitation calls a transaction-owning scope writer inside auth preparation |
| Target objective | `MjlReferenceCommand` owns reference writes; `MjlAccessCommand` owns standalone access writes and exposes one narrow transaction-participating operation used by invitation preparation |
| Reference scope | Partner, Project and Operation Type create, label update, activation/deactivation, locks, fingerprint checks, native calls, audit and current transaction failure contract |
| Access scope | access-profile assignment, deactivation, role rows, native rights, assignment guards, credential revocation, access audit and current transaction behavior |
| Composition scope | switch `mjl_auth_issue_invitation()` to the non-transaction-owning access operation atomically with removal of the old scope writer |
| Retained interfaces | current HTTP handlers, public URLs/actions, native `Societe`/`Project`/`User`/`MjlOperationType` behavior, current labels/results, schema and DB invariants |
| Prerequisites | W0–W2 complete; exact current outcomes characterized; effective-role vocabulary reconciled without weakening definitions |
| Behavior change | none; access transaction hardening is explicitly not implied |
| Cutover | callers and command ownership switch in bounded atomic groups; no independent dual executor |
| Recovery | source revert is safe because W3 creates no schema and writes only backward-compatible existing state |
| Exit | one transaction owner per write; old mutation helpers removed when caller-free; direct fault contracts and selected disposable suites pass |
| W4 output | stable access policy vocabulary and the invitation/access composition contract W4 can consume without reopening access writes |

The module interfaces are deliberately small and deep. Reference callers need
three commands (`create`, `updateLabel`, `setActive`). Standalone access callers
need profile assignment and deactivation; auth preparation uses one narrowly
named internal transaction-participating operation. There is no repository
interface, ORM, generic command bus, or second adapter without actual variation.

## 4. W3 exclusion ledger

| Excluded item | Authority / reason | Deferred to | W3 dependency? | Must remain unchanged? | Evidence |
| --- | --- | --- | --- | --- | --- |
| invitation/reset/OTP/password command ownership and session mutation | W4 scope | W4 | consumes W3 composition only | Yes | document 17 W4/TA-12 |
| email transport, delivery-result phases, outbox capture relocation | W4 or operator configuration | W4 | No | Yes | document 17 section 9 |
| Activity/W2 cleanup or command split | W2 complete; W3 scope is reference/access | none without new authority | W2 T23 only | Yes | W2 review; document 17 W3 |
| reference list/read/presentation redesign | W1 ownership and W3 write-only scope | later explicit wave if any | commands consume retained reads internally | Yes | DEC-062; document 17 W3 |
| access UI/presentation redesign | outcomes must be preserved | later UI authority | handler callers only | Yes | VUI-11 contract |
| dashboards, alerts, reports, exports | W5 | W5 | No | Yes | document 17 waves |
| lifecycle/schema extraction or DDL | W6; W3 forbids schema change | W6 | definitions guarded | Yes | TA-08; W3 forbidden list |
| dead-code cleanup beyond replaced mutation helpers | W7/remove-with-proof | W7/separate authority | No | Yes | document 17 W7/dead-code rules |
| general `.lib.php` cleanup or deduplication | no concrete W3 requirement | separate authority | No | Yes | TA-11 |
| generic repository/query builder/command bus | explicitly forbidden | none | No | Yes | document 17 sections 7–8/W3 |
| trigger or invariant removal | explicitly forbidden | separate architecture amendment | enforcement dependency | Yes | TA-09 |
| Admin business authority or role semantics | prohibited semantic change | none | No | Yes | permission matrix/W3 |
| Partner cascade or Project identity change | explicitly forbidden | separate product decision | No | Yes | document 17 W3 |
| broad runner cleanup and W2-RSK-007 | not needed by named W3 gates | separate verification task | No | Yes | section 15; W2 risk register |
| BC-005/006/007 general remediation | selected gates are explicit/disposable | separate task if selected evidence fails | No | Yes | section 15 |
| static analysis, PHPCS, PHPStan, ESLint, Stylelint | not a frozen W3 outcome | separate tooling request | No | Yes | lean checkpoint |
| dependency upgrades or CI changes | prohibited task mutation | separate request | No | Yes | W3 task boundary |
| unrelated defects and formatting cleanup | no W3 authority | gap analysis/separate request | No | Yes | AGENTS.md/lean checkpoint |
| W4–W7 implementation | separately gated | W4–W7 | W4 dependencies only | Yes | frozen sequence |

Explicit exclusions reconciled: **19/19**.

## 5. Master W3 traceability ledger

Abbreviations: `R` = READY, `C` = READY_WITH_CONSTRAINTS, `V` =
`VERIFIED_AT_HEAD`, `SR` = source revert, and `Gnn` = `G-W3-nn`. Every row
represents one independently migratable or independently verifiable concern.

| ID | Type | Concern / authority | Current evidence / state / owner | W3 target owner / action | Preservation | Depends on / precedes / cutover | Behavior change? / gates | Transition / recovery / W4 | Status / constraint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | DEPENDENCY | W2 T23 clean exit | W2 handler/read/templates and removed legacy owners; V | post-W2 baseline / GUARD | RT-001–011 | none / all moves / CG-06 | NO; G00/G09 | PRE=POST W2; SR; W4 none | R |
| T02 | ROUTE | reference POST caller dispatch | `mjl_reference_route_post`; V; route | retained handler -> command / DELEGATE | RT-002/003/014 | T01,T03–T15 / T16 / CG-01–03 | NO; G01–G04 | old call -> one switched call -> target; SR | R |
| T03 | RESPONSIBILITY | reference create | `mjl_reference_create`; V; procedural writer | `MjlReferenceCommand::create` / MOVE | RT-004/008/014, DB-001/002 | T06–T09,T11–T14 / T02,T16 / CG-01 | NO; G02–G04 | procedural -> one command -> command; SR | R |
| T04 | RESPONSIBILITY | reference label update | `mjl_reference_update_label`; V | `MjlReferenceCommand::updateLabel` / MOVE | RT-004/008/014, DB-001/002 | T06–T14 / T02,T16 / CG-02 | NO; G02–G04 | same pattern; SR | R |
| T05 | RESPONSIBILITY | reference lifecycle | `mjl_reference_set_active`; V | `MjlReferenceCommand::setActive` / MOVE | RT-004/008/014, DB-001/002/003 | T06–T14 / T02,T16 / CG-03 | NO; G02–G04 | same pattern; SR | R |
| T06 | INVARIANT | locked Validator authorization | `mjl_reference_lock_current_manager`; V | private command check / MOVE | RT-002/004, SEC-AUTHZ-004 | T15 / T03–T05 / CG-01–03 | NO; G02–G04 | old helper -> internal check -> private; SR | R |
| T07 | DATA_FLOW | native Partner writes | `Societe` create/update plus cascade owner; V | private native adapter in reference command / MOVE | RT-014, DB-001/002 | T06,T11–T14 / T03–T05 / CG-01–03 | NO; G03/G04 | one native path throughout; SR | R |
| T08 | DATA_FLOW | native Project identity/parent/cascade | `Project` plus parent-then-project locks; V | private native adapter/locks / MOVE | RT-008/014, DB-001–003 | T06,T10–T14 / T03–T05 / CG-01–03 | NO; G03/G04 | one native path; compatible state; SR | R |
| T09 | DATA_FLOW | Operation Type writes | `MjlOperationType`; V | private command collaborator / MOVE | RT-014, DB-001/002 | T06,T11–T14 / T03–T05 / CG-01–03 | NO; G02–G04 | one call path; SR | R |
| T10 | INVARIANT | optimistic fingerprint | `mjl_reference_fingerprint/check`; V | private command rule fed submitted fingerprint / MOVE | RT-008, DB-001 | T15 / T04,T05 / CG-02/03 | NO; G02–G04 | same stale outcome; SR | R |
| T11 | RESPONSIBILITY | reference audit append | `mjl_reference_audit`; V | command -> retained audit writer / DELEGATE | DB-002, SEC-AUTHZ-004 | T06–T10 / T03–T05 / CG-01–03 | NO; G02–G04 | same transaction; SR | R |
| T12 | INVARIANT | checked reference begin | reference functions check `begin`; V | command transaction owner / MOVE | DB-002, RT-004 | T15 / T03–T05 / CG-01–03 | NO; G02 | old owner -> command -> command; SR | R |
| T13 | INVARIANT | checked commit including no-op | reference functions check commit; V | command transaction owner / MOVE | DB-002, RT-008 | T12 / T03–T05 / CG-01–03 | NO; G02 | same finite failure; SR | R |
| T14 | INVARIANT | rollback/quarantine uncertainty | `mjl_reference_rollback`; V | private command recovery / MOVE | DB-002, RT-014 | T12,T13 / T03–T05 / CG-01–03 | NO; G02 | rollback/close preserved; SR | R |
| T15 | DATA_FLOW | reference reads/config/policy | read/config helpers in `mjl_reference.lib.php`; V | retained procedural read/policy / RETAIN | RT-002/010/014, DB-001 | T01 / T03–T14 / none | NO; G01/G03/G04 | same owner; SR N/A | R |
| T16 | TRANSITION | retire old reference mutation helpers | three functions have known route caller; V | no procedural mutation owner / RETIRE | RT-004/014 | T02–T14 / T33 / CG-01–03 | NO; G01/G02 | coexist only before caller switch; SR | R |
| T17 | ROUTE | access Admin caller switch | `admin/access.php` update/deactivate; V | retained HTTP adapter -> access command / DELEGATE | RT-002/003, SEC-AUTHZ-001/002/004 | T18,T19 / T30 / CG-04 | NO; G05–G07 | one call per action; SR | R |
| T18 | RESPONSIBILITY | standalone profile assignment | `mjl_scope_assign_access_profile`; V | `MjlAccessCommand::assignProfile` / MOVE | RT-004/008/014, SEC-AUTHZ-001/002/004, DB-001/002 | T22–T29 / T17,T30 / CG-04 | NO; G05–G08 | old -> command -> command; SR | C; characterize faults before move |
| T19 | RESPONSIBILITY | standalone deactivation | `mjl_scope_deactivate_access`; V | `MjlAccessCommand::deactivate` / MOVE | RT-004/008/014, SEC-AUTHZ-001/002/004, DB-001/002 | T22–T29 / T17,T30 / CG-04 | NO; G05–G07 | old -> command -> command; SR | C; characterize faults before move |
| T20 | RESPONSIBILITY | transaction-participating access operation | scope writer currently owns nested transaction; V | narrow internal operation, never begin/commit/rollback / EXTRACT | RT-004/014, SEC-AUTHZ-001/002/004, DB-001/002 | T22–T28 / T21 / CG-05 | NO; G05/G08 | nested old call -> same-step switch -> participant; SR | C; prove participation before move |
| T21 | DATA_FLOW | invitation caller switch | `mjl_auth_issue_invitation` calls profile writer; V | auth preparation calls T20 / DELEGATE | RT-004/008, SEC-AUTH-001/002, SEC-AUTHZ-002/004, DB-001/002 | T20 / T30,T33 / CG-05 | NO; G08 | one auth owner; SR; W4 consumes | C; add post-role failure proof before switch |
| T22 | INVARIANT | effective-role vocabulary/policy | read predicates in `mjl_scope.lib.php`; V | retained access policy vocabulary / RETAIN | SEC-AUTHZ-001/004, DB-001/003 | T01 / T18–T21 / none | NO; G05–G08 | same policy owner; W4 dependency | R |
| T23 | DATA_FLOW | lock user and active role | scope helper; V | private access command query / MOVE | RT-004, SEC-AUTHZ-001/004, DB-001/003 | T22 / T18–T20 / CG-04/05 | NO; G05/G08 | same lock order; SR | C; characterize exact failure outcome |
| T24 | INVARIANT | current Activity-assignment guard | scope helper/readiness probe; V | private access command guard / MOVE | SEC-AUTHZ-003/004, DB-001/003 | T23 / T18–T20 / CG-04/05 | NO; G05/G07/G08 | same entity/current assignment; SR | C; behavior contract before move |
| T25 | DATA_FLOW | role-row replacement | scope helper; V | internal access mutation / MOVE | SEC-AUTHZ-001/002/004, DB-001–003 | T23,T24 / T18–T20 / CG-04/05 | NO; G05/G08 | same rows/ordering; SR | C; fault oracle before move |
| T26 | DATA_FLOW | native rights replacement | scope helper; V | internal access mutation / MOVE | RT-014, SEC-AUTHZ-002/004, DB-001–003 | T23,T24 / T18–T20 / CG-04/05 | NO; G05/G07/G08 | same Dolibarr rights; SR | C; fault oracle before move |
| T27 | DATA_FLOW | invitation/reset credential revocation | profile/deactivate writers; V | internal access mutation / MOVE | RT-008, SEC-AUTH-001–003, SEC-AUTHZ-002/004, DB-001/002 | T23–T26 / T18–T20 / CG-04/05 | NO; G05/G08 | same statuses/hash clearing; SR | C; fault oracle before move |
| T28 | RESPONSIBILITY | access audit append | `mjl_auth_record_event` in scope writers; V | command/participant -> retained audit writer / DELEGATE | DB-002, SEC-AUTHZ-002/004 | T23–T27 / T18–T20 / CG-04/05 | NO; G05/G06/G08 | caller transaction retained; SR | C; behavioral DB proof before move |
| T29 | INVARIANT | current access transaction outcomes | unchecked begin and present commit/rollback outcomes; V | preserve exactly; no silent hardening / GUARD | RT-004/008, DB-002 | T23–T28 / T18–T21 / CG-04/05 | NO; G05/G08 | same observable failures; SR | C; characterize before move |
| T30 | TRANSITION | retire `mjl_scope_assign_active_role` and replaced writers | no discovered live caller for first; two live writers known; V | remove only after caller/dynamic proof / RETIRE | RT-004/014, LIFE-002 | T17–T29 / T33 / CG-06 | NO; G01/G05 | constrained coexistence then absent; SR | C; reachability proof before retirement |
| T31 | FRONTEND_CONTRACT | forms, feedback, recovery, dialogs and labels | reference/access UI and JS; V | unchanged producers/consumers / GUARD | RT-002/003, SEC-AUTHZ-004 | T02,T17 / T16,T30 / CG-01–05 | NO; G03/G07/G08 | equivalent DOM/results; SR | R |
| T32 | INVARIANT | role/admin/entity/schema triggers | SQL/RST definitions; V | unchanged DB enforcement / GUARD | SEC-AUTHZ-001/002/004, DB-001/003, LIFE-001 | T01 / T03–T30 / all | NO; G04/G07/G08 | same schema; no rollback data issue | R |
| T33 | W4_DEPENDENCY | invitation/access composition | reverse procedural dependency today; V | auth -> transaction participant; no access -> auth dependency / MOVE | TA-13, DB-002 | T20,T21,T28,T30 / W4 / CG-06 | NO; G01/G08 | W4 consumes stable interface; SR | R |
| T34 | W4_DEPENDENCY | effective-role policy vocabulary | current role codes/read policy; V | stable explicit actor/entity vocabulary / RETAIN | TA-03, SEC-AUTHZ-001 | T22 / W4 / CG-06 | NO; G05/G08 | W4 may relocate, not redefine | R |
| T35 | GOVERNANCE | architecture unchanged | frozen hash; V | unchanged / NONE | all | all / authorization / none | NO; G00 | immutable | R |
| T36 | GOVERNANCE | Engineering Standard unchanged | frozen hash; V | unchanged / NONE | all | all / authorization / none | NO; G00 | immutable | R |

Ledger totals: **36** rows; **24 READY**, **12 READY_WITH_CONSTRAINTS**,
**0 BLOCKED**, **0 NOT_APPLICABLE**. Rows with `W3 action != NONE`: **34**.

The compact execution ledger above is canonical together with the following
ID-linked field-completion view. It separates the fields that would otherwise
make the main table unreadably wide; every ID still denotes the same atomic
row. `Document 17/W3` means the frozen target-architecture proposal's W3
definition, traceability, prerequisites and exit criteria.

| ID | Exact authority | Current evidence | Current state | Current owner | W4 dependency |
| --- | --- | --- | --- | --- | --- |
| T01 | document 17 W2 exit/W3 prerequisite; W2 T23 | W2 handler/read/templates exist and legacy route/timeline owners are absent | VERIFIED_AT_HEAD | post-W2 Activity modules | NONE |
| T02 | document 17 W3 handlers-retained rule; RT-002/003/014 | `mjl_reference_route_post` dispatches all reference POST actions | VERIFIED_AT_HEAD | reference route | NONE |
| T03 | document 17 W3 reference command; RT-004/008/014; DB-001/002 | `mjl_reference_create` | VERIFIED_AT_HEAD | procedural reference writer | NONE |
| T04 | document 17 W3 reference command; RT-004/008/014; DB-001/002 | `mjl_reference_update_label` | VERIFIED_AT_HEAD | procedural reference writer | NONE |
| T05 | document 17 W3 reference command; RT-004/008/014; DB-001/002/003 | `mjl_reference_set_active` | VERIFIED_AT_HEAD | procedural reference writer | NONE |
| T06 | document 17 W3 authorization retention; RT-002/004; SEC-AUTHZ-004 | `mjl_reference_lock_current_manager` | VERIFIED_AT_HEAD | reference library | NONE |
| T07 | document 17 W3 native-call retention; RT-014; DB-001/002 | `Societe` create/update and partner cascade calls | VERIFIED_AT_HEAD | reference library plus native `Societe` | NONE |
| T08 | document 17 W3 Project identity/cascade retention; RT-008/014; DB-001–003 | `Project` calls and parent-then-project locks | VERIFIED_AT_HEAD | reference library plus native `Project` | NONE |
| T09 | document 17 W3 native-call retention; RT-014; DB-001/002 | `MjlOperationType` mutations | VERIFIED_AT_HEAD | reference library plus `MjlOperationType` | NONE |
| T10 | document 17 W3 behavior preservation; RT-008; DB-001 | `mjl_reference_fingerprint/check` | VERIFIED_AT_HEAD | reference library | NONE |
| T11 | document 17 W3 audit retention; DB-002; SEC-AUTHZ-004 | `mjl_reference_audit` | VERIFIED_AT_HEAD | reference writer delegating to retained audit writer | NONE |
| T12 | document 17 W3 transaction ownership; DB-002; RT-004 | checked `begin` in all three reference writers | VERIFIED_AT_HEAD | each procedural reference writer | NONE |
| T13 | document 17 W3 transaction ownership; DB-002; RT-008 | checked `commit`, including no-op path | VERIFIED_AT_HEAD | each procedural reference writer | NONE |
| T14 | document 17 W3 transaction ownership; DB-002; RT-014 | `mjl_reference_rollback` and connection quarantine | VERIFIED_AT_HEAD | reference library | NONE |
| T15 | document 17 W3 write-only scope; RT-002/010/014; DB-001 | reference read/config/policy helpers | VERIFIED_AT_HEAD | procedural reference library | NONE |
| T16 | document 17 W3 remove superseded writers; RT-004/014 | three reference writers called from the reference route | VERIFIED_AT_HEAD | procedural reference library | NONE |
| T17 | document 17 W3 handlers-retained rule; RT-002/003; SEC-AUTHZ-001/002/004 | `admin/access.php` dispatches `update_profile` and `deactivate` | VERIFIED_AT_HEAD | Admin access route | NONE |
| T18 | document 17 W3 access command; RT-004/008/014; SEC-AUTHZ-001/002/004; DB-001/002 | `mjl_scope_assign_access_profile` | VERIFIED_AT_HEAD | procedural scope writer | access/auth composition contract |
| T19 | document 17 W3 access command; RT-004/008/014; SEC-AUTHZ-001/002/004; DB-001/002 | `mjl_scope_deactivate_access` | VERIFIED_AT_HEAD | procedural scope writer | access/auth composition contract |
| T20 | document 17 W3 transaction-participating access operation; RT-004/014; SEC-AUTHZ-001/002/004; DB-001/002 | profile writer opens a nested transaction when called by invitation | VERIFIED_AT_HEAD | procedural scope writer | access/auth composition contract |
| T21 | document 17 W3 invitation caller switch; RT-004/008; SEC-AUTH-001/002; SEC-AUTHZ-002/004; DB-001/002 | `mjl_auth_issue_invitation` calls the profile writer | VERIFIED_AT_HEAD | auth preparation plus procedural scope writer | access/auth composition contract |
| T22 | document 17 W3/W4 policy boundary; SEC-AUTHZ-001/004; DB-001/003 | effective-role predicates in `mjl_scope.lib.php` | VERIFIED_AT_HEAD | scope policy reads | stable role/access vocabulary |
| T23 | document 17 W3 locked access writes; RT-004; SEC-AUTHZ-001/004; DB-001/003 | user and active-role lock helper | VERIFIED_AT_HEAD | scope library | access/auth composition contract |
| T24 | document 17 W3 invariant retention; SEC-AUTHZ-003/004; DB-001/003 | current Activity-assignment guard and schema-presence probe | VERIFIED_AT_HEAD | scope library | access/auth composition contract |
| T25 | document 17 W3 access mutations; SEC-AUTHZ-001/002/004; DB-001–003 | role-row replacement helper | VERIFIED_AT_HEAD | scope library | access/auth composition contract |
| T26 | document 17 W3 native behavior retention; RT-014; SEC-AUTHZ-002/004; DB-001–003 | native rights replacement helper | VERIFIED_AT_HEAD | scope library plus native `User` rights | access/auth composition contract |
| T27 | document 17 W3 access mutation boundary; RT-008; SEC-AUTH-001–003; SEC-AUTHZ-002/004; DB-001/002 | invitation/reset credential revocation in both scope writers | VERIFIED_AT_HEAD | scope library | access/auth composition contract |
| T28 | document 17 W3 business-audit retention; DB-002; SEC-AUTHZ-002/004 | scope writers call `mjl_auth_record_event` | VERIFIED_AT_HEAD | scope writers delegating to retained audit writer | access/auth composition contract |
| T29 | document 17 W3 behavior-preserving transaction move; RT-004/008; DB-002 | access begin is unchecked; present commit/rollback outcomes are observable | VERIFIED_AT_HEAD | standalone scope writer or outer auth writer | access/auth composition contract |
| T30 | document 17 W3 remove-with-proof rule; RT-004/014; LIFE-002 | no live caller found for `mjl_scope_assign_active_role`; two live scope writers remain | VERIFIED_AT_HEAD | scope library | access/auth composition contract |
| T31 | document 17 no-UI-redesign rule; RT-002/003; SEC-AUTHZ-004 | reference/access forms, feedback, recovery and dialogs | VERIFIED_AT_HEAD | existing route/UI/JS producers | NONE |
| T32 | document 17 W3 invariant-retention rule; SEC-AUTHZ-001/002/004; DB-001/003; LIFE-001 | role/admin/entity/schema SQL definitions and triggers | VERIFIED_AT_HEAD | database | stable role/access vocabulary |
| T33 | document 17 W4 dependency/TA-13; DB-002 | reverse auth/scope procedural dependency | VERIFIED_AT_HEAD | auth preparation and scope writer | access/auth composition contract |
| T34 | document 17 W4 dependency/TA-03; SEC-AUTHZ-001 | current role codes and read policy | VERIFIED_AT_HEAD | scope policy reads | stable role/access vocabulary |
| T35 | frozen architecture hash and task amendment check | architecture hash matches frozen value | VERIFIED_AT_HEAD | frozen governance | NONE |
| T36 | frozen Engineering Standard hash and task amendment check | Standard hash matches frozen value | VERIFIED_AT_HEAD | frozen governance | NONE |

### Constrained-row timing

| Rows | Classification | Constraint | Before authorization | Before movement | Before cutover | Before completion |
| --- | --- | --- | --- | --- | --- | --- |
| T18/T19/T23–T29 | MUST_ADD_BEFORE_MOVEMENT | executable current access outcomes and injected DB/audit failure contract | NO | YES | YES | YES |
| T20/T21 | MUST_ADD_BEFORE_MOVEMENT | invitation failure after role assignment rolls back user/role/rights/credential/issuance audit together | NO | YES | YES | YES |
| T30 | MUST_ADD_BEFORE_CUTOVER | repository plus dynamic/include reachability proves obsolete helper has no caller; other writers have switched | NO | NO | YES | YES |

No constraint is safe to defer past its named movement/cutover. An
implementation authorization must require these gates before making the change,
not after it.

## 6. W2 dependency reconciliation

| W2 source | W2 output | Current implementation | W3 consumption | Proof | Result |
| --- | --- | --- | --- | --- | --- |
| T23 / CG-W2-07 | W2 complete with one Activity owner, removed legacy branches, W3 separately gated | Activity root delegates once; handler/read/audit/templates exist; old route/timeline files absent | W3 changes only reference/access write owners and protects W2 files as baseline | commit `143f89e`; W2 ownership contracts; source/status inspection | YES |

T23 was produced exactly as W3 expects: **YES**.

## 7. Coverage reconciliation

| Population | Coverage | Denominator |
| --- | --- | --- |
| authoritative W3 scope items | 10/10 | purpose, reference writes, access writes, command owners, handlers retained, native behavior, invitation composition, characterization, invariants, exit/W4 |
| current responsibilities in scope | 30/30 | T02–T31 |
| target responsibilities | 30/30 | T02–T31 target owners/guards |
| affected routes/actions | 7/7 | reference create/update/activate/deactivate; access update_profile/deactivate; invitation issue composition |
| affected DB/query/write paths | 12/12 | `societe`, `projet`, Operation Type, audit event, user, user role, rights definition, user rights, Activity assignment, invitation, password reset, information-schema guard |
| affected transaction boundaries | 6/6 | three reference, two standalone access, one invitation preparation participant |
| affected frontend contracts | 2/2 | reference and access form/result contracts |
| affected Dolibarr seams | 8/8 | bootstrap/globals, DB, User, Societe, Project, Operation Type, tokens, rights/entity |
| preservation requirements | 35/35 | section 8 |
| required verification gates | 11/11 | G-W3-00–10 |
| cutover groups | 6/6 | CG-W3-01–06 |
| W4 dependencies | 2/2 | T33/T34 |
| explicit exclusions | 19/19 | section 4 |

Coverage is complete; no denominator is unknown.

## 8. Preservation reconciliation

| ID | Classification | Ledger enforcement / target / verification | Status |
| --- | --- | --- | --- |
| RT-001 | NOT_TOUCHED | stable roots retained; G03/G07 guard only | READY |
| RT-002 | DIRECTLY_AFFECTED | T02/T17/T31 handlers retain direct policy/token denial; G03/G07/G08 | READY |
| RT-003 | INDIRECTLY_AT_RISK | T02/T17/T31 current CSRF/submission/recovery effects unchanged; G03/G07 | READY |
| RT-004 | DIRECTLY_AFFECTED | T03–T06/T12/T18–T29 locked command checks; G02/G05/G08 | READY_WITH_CONSTRAINTS |
| RT-005 | NOT_TOUCHED | Activity aggregate unchanged; W2 baseline guard G09 | READY |
| RT-006 | NOT_TOUCHED | Activity review unchanged; G09 | READY |
| RT-007 | NOT_TOUCHED | Activity financial rules unchanged; G09 | READY |
| RT-008 | DIRECTLY_AFFECTED | T04/T05/T10/T13/T18/T21/T27/T29 stale/credential outcomes; G02/G05/G08 | READY_WITH_CONSTRAINTS |
| RT-009 | NOT_TOUCHED | Activity exceptions/reconciliation excluded | READY |
| RT-010 | NOT_TOUCHED | W2 monitoring reads protected by T01/G09 | READY |
| RT-011 | NOT_TOUCHED | runtime readiness behavior unchanged | READY |
| RT-012 | NOT_TOUCHED | exports excluded | READY |
| RT-013 | NOT_TOUCHED | document denial adapters excluded | READY |
| RT-014 | DIRECTLY_AFFECTED | T03–T09/T14/T18–T20/T26 private native collaborators; G02–G05/G08 | READY_WITH_CONSTRAINTS |
| RT-015 | NOT_TOUCHED | reconciler excluded | READY |
| SEC-AUTH-001 | INDIRECTLY_AT_RISK | T21/T27 invitation preparation preserved; G08 | READY_WITH_CONSTRAINTS |
| SEC-AUTH-002 | INDIRECTLY_AT_RISK | T21/T27 credential issuance/hash behavior preserved; G08 | READY_WITH_CONSTRAINTS |
| SEC-AUTH-003 | INDIRECTLY_AT_RISK | T27 reset revocation preserved; auth ownership unchanged; G05/G08 | READY_WITH_CONSTRAINTS |
| SEC-AUTH-004 | NOT_TOUCHED | OTP/session excluded | READY |
| SEC-AUTH-005 | NOT_TOUCHED | hooks/session validity excluded | READY |
| SEC-AUTH-006 | NOT_TOUCHED | password adapter excluded | READY |
| SEC-AUTHZ-001 | DIRECTLY_AFFECTED | T18–T29/T34 effective role/admin exclusion retained; G05/G07/G08 | READY_WITH_CONSTRAINTS |
| SEC-AUTHZ-002 | DIRECTLY_AFFECTED | T17–T29 Admin-only access/revocation moves to command; G05/G07/G08 | READY_WITH_CONSTRAINTS |
| SEC-AUTHZ-003 | INDIRECTLY_AT_RISK | T24 assignment guard retained; G05/G07/G08 | READY_WITH_CONSTRAINTS |
| SEC-AUTHZ-004 | DIRECTLY_AFFECTED | T06/T11/T17–T32 UI/handler/command/DB layers remain distinct; G02–G08 | READY_WITH_CONSTRAINTS |
| SEC-DOC-001 | NOT_TOUCHED | denial routes excluded | READY |
| SEC-DOC-002 | NOT_TOUCHED | deployment/native guard excluded | READY |
| DB-001 | DIRECTLY_AFFECTED | T03–T14/T18–T29 explicit entity-scoped commands; G02–G08 | READY_WITH_CONSTRAINTS |
| DB-002 | DIRECTLY_AFFECTED | T11–T14/T20/T21/T28/T29 one transaction owner/audit; G02/G05/G08 | READY_WITH_CONSTRAINTS |
| DB-003 | INDIRECTLY_AT_RISK | T22–T32 exact role/admin/reference definitions retained; G04/G07/G08 | READY |
| DB-004 | NOT_TOUCHED | installers/detectors excluded | READY |
| LIFE-001 | INDIRECTLY_AT_RISK | T32 no schema/bootstrap change; disposable clean tenant checks G04/G08 | READY |
| LIFE-002 | INDIRECTLY_AT_RISK | named disposable suites and teardown; G03/G04/G07/G08 | READY |
| LIFE-003 | NOT_TOUCHED | lifecycle classifier excluded | READY |
| LIFE-004 | NOT_TOUCHED | bootstrap-only disablement excluded | READY |

The preservation rows above are completed by the following explicit
current/target enforcement split. `Same` means W3 does not move that
enforcement owner; it does not mean the requirement was omitted.

| Preservation ID | Current enforcement | Target enforcement | Verification |
| --- | --- | --- | --- |
| RT-001 | stable public roots | Same | G03/G07 |
| RT-002 | route method/action/token policy | retained route plus locked command policy | G03/G07/G08 |
| RT-003 | route CSRF, submission and recovery effects | Same | G03/G07 |
| RT-004 | procedural locked authorization and write validation | command-owned locked authorization and validation | G02/G05/G08 |
| RT-005 | Activity aggregate owner | Same W2 owner | G09 |
| RT-006 | Activity review owner | Same W2 owner | G09 |
| RT-007 | Activity financial rules | Same W2 owner | G09 |
| RT-008 | procedural stale/credential outcome rules | command-owned equivalent rules | G02/G05/G08 |
| RT-009 | Activity exceptions/reconciliation | Same | G09 scope guard |
| RT-010 | W2 monitoring reads | Same W2 read owner | G09 |
| RT-011 | runtime readiness behavior | Same | G00/G10 scope guard |
| RT-012 | export owners | Same | G10 scope guard |
| RT-013 | document denial adapters | Same | G10 scope guard |
| RT-014 | procedural native collaborators | command-private native collaborators | G02–G05/G08 |
| RT-015 | Activity reconciler | Same | G09 scope guard |
| SEC-AUTH-001 | auth invitation preparation plus scope credential revocation | auth preparation plus access participant, with equivalent revocation | G08 |
| SEC-AUTH-002 | auth issuance/hash behavior | Same auth owner consuming access participant | G08 |
| SEC-AUTH-003 | scope reset revocation | access command/participant equivalent revocation | G05/G08 |
| SEC-AUTH-004 | OTP/session owner | Same | G10 scope guard |
| SEC-AUTH-005 | hooks/session-validity owner | Same | G10 scope guard |
| SEC-AUTH-006 | password adapter | Same | G10 scope guard |
| SEC-AUTHZ-001 | scope effective-role/admin exclusion | retained policy plus access command enforcement | G05/G07/G08 |
| SEC-AUTHZ-002 | Admin handler plus scope mutation guards | retained handler plus access command guards | G05/G07/G08 |
| SEC-AUTHZ-003 | scope Activity-assignment guard | command-private equivalent guard | G05/G07/G08 |
| SEC-AUTHZ-004 | UI/handler/procedural/DB defense layers | UI/handler/command/DB defense layers | G02–G08 |
| SEC-DOC-001 | guarded document routes | Same | G10 scope guard |
| SEC-DOC-002 | deployment/native document guard | Same | G10 scope guard |
| DB-001 | entity-scoped procedural reads/writes | entity-scoped command reads/writes | G02–G08 |
| DB-002 | procedural reference/access/auth transactions and in-transaction audit | command reference/access transactions, auth outer transaction and participant audit | G02/G05/G08 |
| DB-003 | database role/admin/reference definitions | Same | G04/G07/G08 |
| DB-004 | installers/detectors | Same | G10 scope guard |
| LIFE-001 | schema/bootstrap lifecycle | Same, with no W3 DDL | G04/G08 |
| LIFE-002 | disposable-suite lifecycle | Same runner/teardown | G03/G04/G07/G08 |
| LIFE-003 | lifecycle classifier | Same | G10 scope guard |
| LIFE-004 | bootstrap-only disablement | Same | G10 scope guard |

Affected items without target enforcement: **0**. Affected items without a
verification gate: **0**.

## 9. Request/action and ownership views

| Ledger | Endpoint | Method/action | PRE owner | TRANSITION owner | POST owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T02/T03 | reference roots | POST `create` | route -> procedural writer | route switches once after command exists | route -> reference command | TARGET_OWNED |
| T02/T04 | reference roots | POST `update` | route -> procedural writer | same | route -> reference command | TARGET_OWNED |
| T02/T05 | reference roots | POST `activate`/`deactivate` | route -> procedural writer | same | route -> reference command | TARGET_OWNED |
| T17/T18 | `admin/access.php` | POST `update_profile` | route -> scope writer | one caller switch | route -> access command | TARGET_OWNED |
| T17/T19 | `admin/access.php` | POST `deactivate` | route -> scope writer | one caller switch | route -> access command | TARGET_OWNED |
| T20/T21 | invitation preparation | internal access assignment | auth -> transaction-owning scope writer | participant and caller switch atomically | auth transaction -> access participant | TARGET_OWNED |

Authorization owners remain the handlers for early denial and the selected
command for locked checks. DB/write, transaction and business-audit ownership
move together. Presentation stays with existing reference/access producers.
There are no unowned or dual-authoritative externally reachable states.

## 10. Database and transaction view

| Ledger | Table/query/write | Current -> target owner | Impact | Transaction owner | Compatibility / status |
| --- | --- | --- | --- | --- | --- |
| T03/T07 | native `societe` | procedural reference -> reference command/private native collaborator | WRITE_OWNERSHIP_CHANGE | reference command | same rows/native calls; READY |
| T03–T05/T08 | native `projet` and parent locks | procedural reference -> reference command | WRITE_OWNERSHIP_CHANGE | reference command | cascade/identity unchanged; READY |
| T03–T05/T09 | `mjlfinancement_operation_type` | procedural reference -> reference command | WRITE_OWNERSHIP_CHANGE | reference command | same custom object; READY |
| T06/T10 | manager/fingerprint queries | procedural helper -> command-private read | QUERY_RELOCATION_ONLY | enclosing command | exact entity/lock/stale behavior; READY |
| T11 | `audit_event` reference rows | helper -> command/audit writer | WRITE_OWNERSHIP_CHANGE | reference command | same transaction; READY |
| T23/T25 | `user`, `user_role` | scope helpers -> access command/participant | WRITE_OWNERSHIP_CHANGE | access command or auth outer transaction | same lock/order/state; constrained |
| T24 | `activity_assignment` plus information-schema presence check | scope helper -> command-private guard | QUERY_RELOCATION_ONLY | enclosing owner | same current assignment semantics; constrained |
| T26 | `user_rights`, `rights_def` | scope helper -> internal access mutation | WRITE_OWNERSHIP_CHANGE | enclosing owner | native rights unchanged; constrained |
| T27 | invitation/reset credentials | scope helper -> internal access mutation | WRITE_OWNERSHIP_CHANGE | enclosing owner | statuses/hash clearing unchanged; constrained |
| T28 | access audit | scope -> access command/participant -> retained writer | WRITE_OWNERSHIP_CHANGE | enclosing owner | same event/payload/failure; constrained |
| T32 | DB triggers/constraints | DB -> DB | NONE | database | exact definitions unchanged; READY |

### Per-mutation transaction ownership

| Ledger rows / mutation | Current transaction owner | Target transaction owner | Begin owner | Commit owner | Rollback owner | Native transaction depth | Business-audit relationship |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T03/T07/T09/T11–T14 reference create | `mjl_reference_create` | `MjlReferenceCommand::create` | current writer -> target command | current writer -> target command; checked, including no-op | current writer/`mjl_reference_rollback` -> target command/private recovery | native calls participate in the one reference transaction | T11 append is in the same transaction; failure prevents success |
| T04/T08–T14 reference label update | `mjl_reference_update_label` | `MjlReferenceCommand::updateLabel` | current writer -> target command | current writer -> target command; checked | current writer/`mjl_reference_rollback` -> target command/private recovery | native calls participate; no independent commit | T11 append is in the same transaction |
| T05/T08–T14 reference lifecycle | `mjl_reference_set_active` | `MjlReferenceCommand::setActive` | current writer -> target command | current writer -> target command; checked | current writer/`mjl_reference_rollback` -> target command/private recovery | partner/project/operation-type calls participate in one transaction | T11 append is in the same transaction |
| T18/T23–T29 standalone profile assignment | `mjl_scope_assign_access_profile` | `MjlAccessCommand::assignProfile` | current scope writer -> target command; current unchecked result preserved pending G05 characterization | current scope writer -> target command; observable result preserved | current scope writer -> target command; observable result preserved | native rights calls use the enclosing Dolibarr transaction/depth | T28 append participates in the same command transaction and remains fail-closed |
| T19/T23–T29 standalone deactivation | `mjl_scope_deactivate_access` | `MjlAccessCommand::deactivate` | current scope writer -> target command; current unchecked result preserved pending G05 characterization | current scope writer -> target command; observable result preserved | current scope writer -> target command; observable result preserved | native rights/credential work uses the enclosing Dolibarr transaction/depth | T28 append participates in the same command transaction and remains fail-closed |
| T20/T21/T23–T29 invitation access assignment | `mjl_auth_issue_invitation` outer transaction plus nested scope writer today | `mjl_auth_issue_invitation` alone; access operation only participates | auth owner before and after; participant forbidden to begin | auth owner before and after; participant forbidden to commit | auth owner before and after; participant forbidden to roll back | current nested Dolibarr depth is removed at the participant seam; native writes remain inside auth's depth | access audit and issuance audit share the auth transaction; G08 proves post-role failure leaves no partial state |

Transaction boundaries are reference create/update/lifecycle, standalone access
profile/deactivation, and invitation preparation. Reference commands retain the
verified checked begin/commit/rollback/quarantine contract. Access commands and
the auth owner retain their current observable behavior; W3 must not advertise
or introduce reference-grade hardening for unchecked begin/commit/rollback
cases without separate approval. The invitation access operation participates
in the caller transaction and cannot begin, commit, roll back, or create a DB
connection.

All produced state uses the existing schema and is readable by predecessor and
target code. Last safe rollback point is any W3 commit: source revert is safe;
no DB restore or forward data conversion is required.

## 11. Frontend and Dolibarr integration

| Ledger ID | Contract | Producer | Consumer | PRE | POST | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T02–T10/T15/T31 | reference forms/actions, IDs, names, fingerprint, recovery, feedback, dialogs | reference route/templates/JS | browser and reference POST route | current markup/action/result contract | identical markup/action/result contract; only the internal command call changes | G03/G04 | READY |
| T17–T21/T31 | access forms/actions, role values, dialogs, feedback and invitation result | Admin access/auth route/templates/shared JS | browser and access/auth POST handlers | current markup/action/result contract | identical contract; only the internal access command/participant call changes | G07/G08 | READY |

`NO_FRONTEND_CONTRACT_CHANGE`: W3 moves write ownership only. It adds no AJAX,
storage, selector, CSS, label, or form redesign.

Material Dolibarr seams are `main.inc.php`, captured `$db/$user/$conf`, native
`User`, `Societe` and `Project`, `MjlOperationType`, CSRF/submission tokens,
rights/entity tables and the Dolibarr DB transaction-depth behavior already
used by invitation composition. New commands receive dependencies; they do not
introduce another request, auth, authorization, transaction, ORM or autoloading
framework. No request-selected callback, class, method, file, or include is
introduced.

## 12. Failure, audit and authorization ownership

- Invalid method/action/token remains handler-owned and reaches no command.
- Invalid label/role/ID, forbidden actor, wrong entity, assignment conflict,
  stale fingerprint and missing object retain current finite outcomes.
- Native/DB/audit failures remain command failures with current French feedback.
- Reference failed begin/commit/rollback retains the verified fail-closed and
  uncertain-connection quarantine behavior.
- Access begin/commit/rollback behavior is preserved, not silently hardened;
  the missing fault oracle is mandatory before movement.
- Invitation failure after access mutation propagates to the auth preparation
  owner so user, role, rights, credential and issuance audit roll back together.
- Reference/access success audit remains durable only inside the owning
  transaction. Technical logs do not replace it.
- Authorization impact is `STRUCTURAL_OWNERSHIP_CHANGE`, not semantic change:
  Admin-only access administration, Validator-only reference writes, entity,
  assignment, effective-role/admin exclusion and DB defenses remain exact.

| Ledger concerns | Authorization impact | Current enforcement | Target enforcement | Semantic change | Proof |
| --- | --- | --- | --- | --- | --- |
| T02/T06 reference route and Validator lock | STRUCTURAL_OWNERSHIP_CHANGE | handler early denial plus procedural locked manager check | same handler plus command-private locked manager check | NONE | G02–G04 |
| T03–T10 reference object/entity/stale rules | STRUCTURAL_OWNERSHIP_CHANGE | procedural writer/native object checks | command-private equivalent checks/native calls | NONE | G02–G04 |
| T17/T18/T19 Admin access actions | STRUCTURAL_OWNERSHIP_CHANGE | Admin handler denial plus locked scope-writer checks | same handler plus locked access-command checks | NONE | G05/G07 |
| T20/T21 invitation composition | STRUCTURAL_OWNERSHIP_CHANGE | auth authorization plus nested scope writer | same auth authorization plus non-owning access participant | NONE | G05/G08 |
| T22–T27 effective role, entity and Activity assignment | STRUCTURAL_OWNERSHIP_CHANGE | scope policy/guards and DB definitions | retained policy, command-private guards and same DB definitions | NONE | G05/G07/G08 |
| T28/T29 audit/failure authorization outcome | STRUCTURAL_OWNERSHIP_CHANGE | scope writer fails closed on access-audit rejection | command/participant preserves the same rejection inside the owning transaction | NONE | G05/G06/G08 |
| T31/T32 UI visibility and database defenses | NONE | UI hints plus handler/DB enforcement | Same; UI remains non-authoritative | NONE | G03/G04/G07/G08 |

## 13. Verification matrix

| Gate ID | Ledger IDs protected | Exact command/test | Oracle | Failure proven | Execution path | Stage | Environment | Mutation class | Blocking? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G-W3-00 | T01/T35/T36 | frozen `sha256sum`; `git cat-file -e` W0/W1/W2; status/diff inspection | exact frozen hashes and baseline commits resolve; only permitted docs differ | baseline/hash/scope mismatch is detected | direct shell inspection | PRE_W3_BASELINE + DOCUMENTATION_DIFF | local, read-only | NONE | Yes |
| G-W3-01 | T02/T15–T17/T30/T33 | planned `php tests/contracts/w3_write_ownership_test.php` | exactly one caller/definition owns each moved write; retained reads/W2 owners remain | old writer, dual caller, missing target, or recreated W2 owner fails | PHP source-contract runner | PRE_MOVE_CHARACTERIZATION + CUTOVER | local | TEST_ONLY, then SOURCE | Yes |
| G-W3-02 | T03–T14/T16 | `php tests/contracts/reference_transaction_test.php`, adapted to command interface | reference command preserves checked begin/commit/rollback/quarantine semantics | failed begin; failed/no-op commit; rollback request/failure; false success | PHP contract with DB double | PRE_MOVE_CHARACTERIZATION + FOCUSED_IMPLEMENTATION | local DB double | TEST_AND_SOURCE | Yes |
| G-W3-03 | T02–T10/T15/T31 | `npm run test:vui10` | Partner/Project policy, forms, identity, cascade-facing UI, lifecycle and DOM remain exact | unauthorized/stale/invalid UI or result drift | npm script -> disposable Playwright tenant | DISPOSABLE_E2E | disposable tenant | TEST_FIXTURE_ONLY | Yes |
| G-W3-04 | T03–T16/T32 | `npm run test:rst003` | native Partner/Project/Operation Type behavior, entity scope, identity/cascade and clean schema remain exact | native-call, entity, cascade, identity or schema drift | npm script -> disposable integration tenant | POST_CUTOVER_REGRESSION | disposable tenant | TEST_FIXTURE_ONLY | Yes |
| G-W3-05 | T17–T20/T22–T30/T34 | planned `php tests/contracts/access_command_test.php` | exact Admin/entity/role/assignment guards and current access transaction outcomes; participant never owns a transaction | injected role/right/credential/audit/begin/commit/rollback mismatch or participant transaction call | PHP contract with DB/native doubles | PRE_MOVE_CHARACTERIZATION + FOCUSED_IMPLEMENTATION | local DB/native doubles | TEST_AND_SOURCE | Yes |
| G-W3-06 | T18/T19/T28/T29 | `node --test tests/unit/access-audit-fail-closed.test.js`, adapted to new owner | both access paths still reject audit failure; this is a source guard, not DB proof | either path accepts/ignores rejected business audit | Node source-contract runner | FOCUSED_IMPLEMENTATION | local | TEST_AND_SOURCE | Yes |
| G-W3-07 | T17–T19/T22–T32 | `npm run test:vui11` | Admin-only update/deactivation, direct/form outcomes, role values, dialogs and feedback remain exact | unauthorized direct/form mutation or visible outcome drift | npm script -> disposable Playwright tenant | DISPOSABLE_E2E | disposable tenant | TEST_FIXTURE_ONLY | Yes |
| G-W3-08 | T20/T21/T25–T29/T33/T34 | `npm run test:auth`, extended before movement with injected post-role-assignment failure | invitation failure after access writes leaves no user/role/right/credential/issuance-audit partial state and existing auth behavior passes | injected post-role failure leaves any partial state or false success | npm auth runner -> disposable tenant | PRE_MOVE_CHARACTERIZATION + POST_CUTOVER_REGRESSION | disposable tenant | TEST_AND_FIXTURE | Yes |
| G-W3-09 | T01 | `php tests/contracts/activity_ownership_test.php` plus status/diff inspection | W2 roots/owners remain singular and removed legacy files remain absent | changed/recreated W2 ownership is detected | PHP source-contract runner plus shell inspection | POST_CUTOVER_REGRESSION | local, read-only | NONE | Yes |
| G-W3-10 | all changed source/docs | `php -l <changed.php>`; `node --check <changed.js>` if any; `git diff --check`; status/diff review | syntax, whitespace, scope, generated-file and hunk-to-ledger reconciliation pass | syntax error, whitespace error, unplanned file/hunk or generated artifact | direct CLI over exact changed-file list | every stage | local | NONE | Yes |

Mandatory gates without a meaningful oracle: **0**. Mandatory gates without a
known execution path: **0**. Existing tests are named; two focused contracts
are implementation deliverables because their target interfaces do not yet
exist.

### Prior-wave gate disposition

| Prior evidence | Disposition | Reason |
| --- | --- | --- |
| W0 authorization/BC-020 | NOT_RELEVANT beyond unchanged runner | W3 named suites already use the corrected disposable runner |
| W1 list/presentation contracts | REGRESSION_GATE through VUI-10 | W3 changes reference writes but must preserve W1 list/UI behavior |
| W2 Activity contracts | HARD_W3_GATE only for ownership/source scope G09 | T23 requires W2 owners remain complete; no broad W2 E2E rerun |
| W2 VUI/phase2 | NOT_RELEVANT | W3 changes no Activity behavior |

## 14. Deferred debt and duplication

| Debt/risk | W3 relationship | Ledger | Disposition | Blocks |
| --- | --- | --- | --- | --- |
| W2-RSK-007 broad legacy-suite cost | named focused W3 gates avoid broad suites | verification matrix | `DEFERRED` | No |
| BC-005 aggregate unit stall | W3 does not use `npm run test:unit` | gates | DEFERRED | No |
| BC-006 incomplete discovery | every W3 suite/file is named explicitly | gates | W3_GUARD | No |
| BC-007 dormant shared-port test | no W3 gate invokes it; browser gates are disposable | gates | NOT_RELEVANT | No |
| BC-008/009 cron behavior | Activity reconciler excluded | T01 | DEFERRED | No |
| BC-017/018/022 auth concerns | W4 ownership; W3 runs auth composition regression only | T21/T33 | DEFERRED_TO_W4 | No |

Duplication classification: UI/handler/command/DB authorization is D4 and stays
intentional. The three reference writers and two access writers contain D2/D3
transaction structure that moves as-is into their deep modules; W3 does not
create generic repositories. Audit syntax is delegated to the retained writer.
The auth/access nested transaction is D3 ownership conflict and is reconciled
only through T20/T21. Historical helpers are retained unless T30 reachability
proof permits exact retirement.

## 15. Dependency graph and cutover

```text
T01
 ├─ T15 ─> T06–T14 ─> T03/T04/T05 ─> T02 ─> T16
 └─ T22 ─> T23/T24 ─> T25/T26/T27/T28/T29
                         ├─> T18/T19 ─> T17
                         └─> T20 ─> T21
T02/T17/T21 ─> T31
T16/T17/T21/T30/T32 ─> T33/T34
T33/T34 ─> W4 dependency only
T35/T36 guard every branch
```

Dependency direction is **VALID**. Unexplained cycles: **0**.

| Group | Ledger rows | Atomicity | Coexistence / condition / legacy disposition |
| --- | --- | --- | --- |
| CG-W3-01 | T02/T03/T06/T07/T09/T11–T16/T31 | YES | reference create command and caller switch together; old create helper then removed |
| CG-W3-02 | T02/T04/T06–T14/T16/T31 | YES | update/fingerprint/native/audit switch together; no dual writer |
| CG-W3-03 | T02/T05–T16/T31/T32 | YES | lifecycle/cascade switch together; triggers and identity retained |
| CG-W3-04 | T17–T19/T22–T30/T31/T32 | YES | standalone access commands, callers and shared internal mutation move as one compatible slice |
| CG-W3-05 | T20/T21/T23–T29/T31–T33 | YES | invitation caller and non-owning participant switch in the same substep |
| CG-W3-06 | T01/T16/T30/T33–T36 | YES | legacy writers absent, W2 intact, W4 dependencies produced, governance unchanged |

### Per-ledger coexistence and cutover

| Ledger | PRE owner | TRANSITION owner | POST owner | Coexistence | Cutover condition | Legacy disposition | Atomic group |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T02 | reference route -> procedural writer | route switches once to unreachable-tested command | reference route -> command | SAFE_TEMPORARY_COEXISTENCE | matching command group passes G01/G02 | old call removed | CG-W3-01–03 |
| T03 | procedural create writer | old writer sole executor until caller switch | reference create command | SAFE_TEMPORARY_COEXISTENCE | create command and route switch together | helper retired | CG-W3-01 |
| T04 | procedural update writer | old writer sole executor until caller switch | reference update command | SAFE_TEMPORARY_COEXISTENCE | update command and route switch together | helper retired | CG-W3-02 |
| T05 | procedural lifecycle writer | old writer sole executor until caller switch | reference lifecycle command | SAFE_TEMPORARY_COEXISTENCE | lifecycle command and route switch together | helper retired | CG-W3-03 |
| T06 | reference authorization helper | old helper sole executor while command unreachable | command-private locked check | SAFE_TEMPORARY_COEXISTENCE | each command/caller group switches | helper code moves private | CG-W3-01–03 |
| T07 | reference library/native Partner | old path sole executor while command unreachable | command-private native Partner collaborator | SAFE_TEMPORARY_COEXISTENCE | relevant command/caller group switches | old mutation path removed | CG-W3-01–03 |
| T08 | reference library/native Project | old path sole executor while command unreachable | command-private native Project collaborator | SAFE_TEMPORARY_COEXISTENCE | relevant command/caller group switches | old mutation path removed | CG-W3-01–03 |
| T09 | reference library/Operation Type | old path sole executor while command unreachable | command-private Operation Type collaborator | SAFE_TEMPORARY_COEXISTENCE | relevant command/caller group switches | old mutation path removed | CG-W3-01–03 |
| T10 | reference fingerprint helper | old helper sole executor while command unreachable | command-private fingerprint rule | SAFE_TEMPORARY_COEXISTENCE | update/lifecycle group switches | helper code moves private | CG-W3-02/03 |
| T11 | reference helper -> audit writer | old helper sole executor while command unreachable | command -> retained audit writer | SAFE_TEMPORARY_COEXISTENCE | each reference group switches | mutation wrapper removed; audit writer retained | CG-W3-01–03 |
| T12 | procedural reference begin owner | old owner sole executor while command unreachable | reference command | SAFE_TEMPORARY_COEXISTENCE | each reference group switches | old transaction call removed | CG-W3-01–03 |
| T13 | procedural reference commit owner | old owner sole executor while command unreachable | reference command | SAFE_TEMPORARY_COEXISTENCE | each reference group switches | old transaction call removed | CG-W3-01–03 |
| T14 | reference rollback helper | old owner sole executor while command unreachable | command-private recovery | SAFE_TEMPORARY_COEXISTENCE | each reference group switches | helper code moves private | CG-W3-01–03 |
| T16 | procedural reference writers | caller switch and helper deletion in group | none | NO_COEXISTENCE | G01 proves no caller/definition remains | explicitly removed | CG-W3-01–03/06 |
| T17 | Admin route -> scope writer | route switches once after G05 | Admin route -> access command | SAFE_TEMPORARY_COEXISTENCE | standalone access group passes characterization | old calls removed | CG-W3-04 |
| T18 | procedural profile writer | old writer sole executor while command unreachable | access profile command | COEXISTENCE_WITH_CONSTRAINTS | G05/G06/G07 pass and caller switches | writer retired after T21 also switches | CG-W3-04/05 |
| T19 | procedural deactivate writer | old writer sole executor while command unreachable | access deactivate command | COEXISTENCE_WITH_CONSTRAINTS | G05/G06/G07 pass and caller switches | writer retired | CG-W3-04 |
| T20 | nested procedural scope writer | participant exists unreachable, then auth switches atomically | access transaction participant | COEXISTENCE_WITH_CONSTRAINTS | G05/G08 prove participant and rollback behavior | nested call removed | CG-W3-05 |
| T21 | auth -> transaction-owning scope writer | caller and participant switch in one substep | auth -> non-owning participant | NO_COEXISTENCE | G08 post-role failure oracle passes | old auth call removed | CG-W3-05 |
| T23 | scope lock helper | old helper sole executor until access callers switch | command-private lock query | COEXISTENCE_WITH_CONSTRAINTS | G05 current outcome characterized | helper code moves private | CG-W3-04/05 |
| T24 | scope assignment guard | old guard sole executor until access callers switch | command-private guard | COEXISTENCE_WITH_CONSTRAINTS | G05/G07/G08 characterize and pass | helper code moves private | CG-W3-04/05 |
| T25 | scope role mutation | old mutation sole executor until access callers switch | internal access mutation | COEXISTENCE_WITH_CONSTRAINTS | injected fault oracle passes | old mutation path removed | CG-W3-04/05 |
| T26 | scope/native-rights mutation | old mutation sole executor until access callers switch | internal access mutation | COEXISTENCE_WITH_CONSTRAINTS | injected fault oracle passes | old mutation path removed | CG-W3-04/05 |
| T27 | scope credential revocation | old mutation sole executor until access callers switch | internal access mutation | COEXISTENCE_WITH_CONSTRAINTS | G05/G08 pass | old mutation path removed | CG-W3-04/05 |
| T28 | scope -> audit writer | old path sole executor until access callers switch | command/participant -> retained audit writer | COEXISTENCE_WITH_CONSTRAINTS | DB-backed audit-failure oracle passes | mutation wrapper removed; audit writer retained | CG-W3-04/05 |
| T29 | scope/auth transaction behavior | old owner sole executor until access callers switch | command or outer auth owner | COEXISTENCE_WITH_CONSTRAINTS | G05/G08 characterize exact outcomes | old transaction calls removed | CG-W3-04/05 |
| T30 | scope mutation helpers | old live writers remain until callers switch | no superseded procedural writer | COEXISTENCE_WITH_CONSTRAINTS | caller plus dynamic/include reachability proof | remove only proven superseded helpers | CG-W3-06 |
| T33 | auth -> transaction-owning scope writer, with scope -> auth audit dependency | T20 participant and T21 caller switch atomically | auth -> non-owning access participant; both depend directly on retained audit writer | NO_COEXISTENCE | G01/G05/G08 pass and reverse access-to-auth dependency is absent | reverse dependency removed; W4 interface retained | CG-W3-05/06 |

Temporary coexistence is allowed only while the old caller remains the sole
executor and target commands are unreachable. Independent double execution is
never allowed. Unsafe coexistence rows: **0**.

## 16. Rollback and forward recovery

| Ledger | Persistent impact | Last safe rollback point | Model | Compatible state | Forward recovery | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T03–T16 | existing reference rows/audit only | any W3 commit | SOURCE_REVERT_SAFE | YES | reapply corrected bounded group | READY |
| T18/T19/T22–T30 | existing user/role/right/credential/audit rows | any W3 commit | SOURCE_REVERT_SAFE | YES | reapply corrected access group | READY_WITH_CONSTRAINTS until G05 |
| T20/T21/T33 | invitation preparation using same schema/state | any W3 commit | SOURCE_REVERT_SAFE | YES | reapply participant/caller switch together | READY_WITH_CONSTRAINTS until G08 |

No schema or data conversion exists. No DB restore is authorized or required.
Non-credible recovery rows: **0**.

## 17. Representative request and failure simulations

Reference create PRE:

```text
POST partners.php
-> stable root/W1 handler delegation
-> retained reference route token/policy
-> mjl_reference_create
-> checked transaction + Validator lock
-> Societe + audit
-> checked commit
-> existing recovery/feedback/redirect
```

POST:

```text
same request/handler
-> MjlReferenceCommand::create
-> same locked policy/native write/audit/transaction contract
-> same result mapping
```

Access invitation POST:

```text
admin/access.php -> mjl_auth_issue_invitation (outer preparation owner)
-> internal MjlAccessCommand transaction participant
-> locked user/role + rights + revocation + access audit
-> invitation credential + issuance audit
-> auth owner commit
-> unchanged email/delivery-result phases
```

Both target paths are **EASIER_TO_TRACE** because transaction and write
ownership are named without enlarging caller interfaces.

Failure simulation: inject failure after role/right assignment during
invitation preparation. The access participant returns/throws failure without
commit or rollback; auth catches it, rolls back its outer transaction, records
no success, releases identity locks, and returns the current sanitized error.
No user, active role, rights, live credential or issuance audit may survive.
G-W3-08 must prove this before T20/T21 move.

## 18. W4 dependency view

| W4 dependency | W3 ledger | Required outcome | Completion proof | Blocking W3 exit |
| --- | --- | --- | --- | --- |
| access/auth composition contract | T20/T21/T28/T30/T33 | auth owns preparation transaction; access participant never owns it; reverse access->auth dependency removed | G01/G05/G08; old writer absent | Yes |
| stable effective-role/access vocabulary | T22/T34 | explicit actor/entity role semantics and DB invariants unchanged | G05/G07/G08/G10 | Yes |

W4 implementation is not reviewed or authorized here.

## 19. Future implementation skeleton

| Step | Ledger | Action / likely files | Preconditions | Gates | Group / recovery |
| --- | --- | --- | --- | --- | --- |
| 1 | T01/T35/T36 | verify hashes, HEAD, W2 owners and clean scope | explicit W3 authorization | G00/G09 | none; no mutation |
| 2 | T18/T19/T23–T29 | add access current-outcome/fault characterization | step 1 | G05/G06 | test-only revert |
| 3 | T20/T21 | add invitation post-role failure injection/oracle | step 1 | G08 selected case | test-only revert |
| 4 | T03–T14 | add `class/mjlreferencecommand.class.php`; adapt reference contract without caller switch | G02 baseline | G02/G10 | unreachable target; source revert |
| 5 | T02/T03–T16/T31/T32 | switch create/update/lifecycle callers in bounded groups; remove replaced writers | steps 1/4 | G01–G04/G10 | CG-01–03; group revert |
| 6 | T18–T20/T22–T29 | add `class/mjlaccesscommand.class.php` with standalone and participant paths | steps 2/3 | G05/G06/G10 | unreachable target; source revert |
| 7 | T17–T21/T30–T34 | switch Admin and invitation callers atomically; retire proven old writers | steps 2/3/6 | G01/G05–G08/G10 | CG-04/05; group revert |
| 8 | T01/T16/T30/T33–T36 | run final ownership/governance gates and reconcile status | all groups pass | G00–G10 | CG-06; whole W3 revert |

Estimated budget: **2 files added**, **5–7 runtime files modified**, **0 runtime
files removed**, **2 focused test files added/modified plus 2 existing suites
extended/adapted**, and **3–4 status/readiness documents modified**. Growth
beyond this estimate triggers the lean checkpoint; it is not permission to add
frameworks.

## 20. Cross-cutting risks

| Risk | Risk | Ledger | Likelihood | Impact | Mitigation | Blocks authorization |
| --- | --- | --- | --- | --- | --- | --- |
| W3-RSK-001 | invitation retains two transaction owners or commits access early | T20/T21/T33 | Medium | High | atomic participant/caller switch plus G05/G08 | No |
| W3-RSK-002 | access extraction silently hardens or weakens current failures | T18/T19/T29 | Medium | High | characterize before move; separate approval for hardening | No |
| W3-RSK-003 | native reference behavior, cascade or identity drifts | T07–T10/T31 | Low | High | retained native collaborators, G02–G04 | No |
| W3-RSK-004 | authorization centralization removes D4 defenses | T06/T17–T29/T32 | Medium | High | retain handler, locked command and DB layers | No |
| W3-RSK-005 | old mutation functions remain callable beside commands | T16/T30 | Medium | High | caller/source contract and atomic retirement | No |
| W3-RSK-006 | auth/W4 scope leaks into W3 | T21/T33/T34 | Medium | Medium | freeze auth owner and delivery phases; stop at participant seam | No |
| W3-RSK-007 | test environment or broad-suite debt obscures selected proof | gates | Low | Medium | named focused/disposable gates; no `npm test` claim | No |
| W3-RSK-008 | rollback assumed unsafe after compatible writes | recovery rows | Low | Medium | same schema/outcomes; group revert; no DB restore | No |

Cross-cutting blocking risks: **0**. Non-blocking risks: **8**.

## 21. Mechanical readiness gate

| Condition | Result |
| --- | --- |
| coverage reconciliation complete | PASS |
| BLOCKED rows | 0 |
| constrained rows requiring pre-authorization resolution | 0 |
| authority conflicts / current discrepancies | 0 / 0 |
| W2 T23 reconciled | YES |
| dependency cycles | 0; VALID |
| unowned / dual transition states | 0 / 0 |
| unsafe/incomplete cutover groups | 0 |
| affected preservation without target/verification | 0 / 0 |
| mandatory gates without oracle/path | 0 / 0 |
| unsafe coexistence / non-credible recovery | 0 / 0 |
| ambiguous transaction ownership at target | 0 |
| unresolved authorization semantics | 0 |
| architecture / Standard amendment | NO / NO |
| blocking cross-cutting risks | 0 |
| scope / entry / exit / W4 dependencies | CLEAR / DERIVABLE / DERIVABLE / COMPLETE |

Entry is frozen governance, W0–W2 completion, reconciled T23, a clean bounded
worktree, 35/35 preservation classification, complete coverage and an explicit
future W3 authorization. Exit requires all 34 action rows complete, all six
cutover groups and eleven gates passing, twelve constraints resolved at their
named timing, no legacy/dual/unowned writer, W4 dependencies produced, frozen
governance unchanged, status reconciled and a clean worktree.

## 22. Final verdict

Final mutation report:

```text
Frozen architecture modified: NO
Frozen Engineering Standard modified: NO
Independent architecture review modified: NO

W0 implementation modified: NO
W1 implementation modified: NO
W2 implementation modified: NO

Runtime files modified: 0
Test files modified: 0
Tooling/config modified: 0
Dependencies modified: 0
CI modified: 0
```

```text
W3_READY_FOR_AUTHORIZATION
W3: NOT_AUTHORIZED
W4–W7: NOT_AUTHORIZED
```

The exact W3 root scope is clear, current and target owners are fully mapped,
all missing proof is safely deferrable only until before movement/cutover, and
the mechanical readiness gate passes. The next permissible task is a separate
W3 implementation authorization.
