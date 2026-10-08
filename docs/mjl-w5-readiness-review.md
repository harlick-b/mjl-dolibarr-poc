# MJL W5 Readiness Review

Original readiness verdict: `W5_READY_FOR_AUTHORIZATION`

Current governance status: `W5_FAILED`; re-execution is not authorized by the
DEC-066 documentation amendment.

This is a documentation-only pre-authorization review. It does not authorize
W5, runtime changes, test changes, schema changes, or any later wave.

Post-review amendment DEC-066 resolves the T02 rollback-result assumption.
For W5 report and audit preview snapshots, rollback remains attempted, but a
rollback call that reports failure preserves the existing generic unavailable/
HTTP 503 result. It does not produce a distinct rollback-failure outcome. Exact
session-budget restoration remains required, and no partial report content or
download action may be exposed. This amendment does not authorize or resume
runtime implementation.

## 1. Executive verdict

W5 is three bounded, independently controlled families: report/export
ownership separation; an independently mergeable dashboard/index/alerts move
onto the W2 monitoring-read module; and only the frontend producer/consumer
changes proven necessary by those two families. `MjlMonitoring` remains the
scoped query owner. Public routes, report meanings, formats, filters,
filenames, authorization, durable evidence, and visible behavior remain stable.

The frozen contract and post-W4 source agree. All current owners, routes,
database paths, transition states, preservation requirements, verification
gates, cutover groups, exclusions, and recovery paths have known denominators.
There are no blocked rows, authority conflicts, or current-state
discrepancies.

Six rows are `READY_WITH_CONSTRAINTS`. Their conditions are hard stops before
the affected movement or cutover, not pre-authorization requirements: report
snapshot fault characterization; BC-003 server-side delivery-read failure;
the conditional BC-013 retry decision; stale browser-login selector repair;
focused alerts coverage; and producer/consumer proof before a frontend or CSS
split. Authorization may permit creating those proofs, but no selected
responsibility may move until its gate passes.

```text
W5_FAILED
W5 RE-EXECUTION: NOT_AUTHORIZED
W6-W7: NOT_AUTHORIZED
```

## 2. Authority baseline

| Authority | Verified value |
| --- | --- |
| Frozen architecture | `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| Frozen Engineering Standard | `b24021ac52a55f5a9921801aac8d100d9238268c55b3775875a0709132fb9560` after DEC-066; original freeze hash `a47f2d942172a4685b02efce027ca04c0a2361f258ebd8c0b776117c97f8f62e` |
| Independent review | `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |
| Post-W4 baseline | `2ccbc37c76c1a752f92eeb813621af3a8bbb345c` |
| Earlier baselines | W0 `bccf5a708aec25f98499bed6b7da3f607c0541d5`; W1 `03aad09`; W2 `143f89e2285e860cdaa45fd6d6580c74b39556aa`; W3 `ee4afa8d7b7ff6af98f0b5c7b70a071ce96c3dd6` |
| Preservation ledger | 35/35 |

All baseline commits are ancestors of HEAD. The worktree was clean when the
review began. The frozen architecture, Engineering Standard, and independent
review require no amendment.

Current-state classifications in this document mean:

- `VERIFIED_AT_HEAD`: inspected directly at post-W4 HEAD.
- `STALE_AUDIT_RECONCILED`: older ownership text was checked and replaced by
  post-W4 evidence.
- `DISCREPANCY`: unresolved conflict. There are zero such rows.

Current reconciliation found one stale audit count, not a behavioral conflict:
the frontend audit's freeze-time `14 files / 3,856 lines` inventory is
`STALE_AUDIT_RECONCILED` against the larger post-W4 template/frontend
population. Its named contracts remain applicable and are mapped below. The
principal W5 owners remain as audited, except the W2-completed Activity branch
has already left the shared monitoring route. All master-ledger owner claims
are therefore `VERIFIED_AT_HEAD`; current-state discrepancies are zero.

## 3. Post-W4 baseline

| W4-established responsibility | W5 classification | Evidence / constraint |
| --- | --- | --- |
| `MjlAuthCommand` | `MUST_REMAIN_UNCHANGED` | no W5 auth ownership |
| private auth session adapter | `MUST_REMAIN_UNCHANGED` | no report/monitoring session use may enter it |
| pure session-validity policy | `MUST_REMAIN_UNCHANGED` | browser login is test setup, not a W5 dependency |
| email-owned delivery capture | `NOT_RELEVANT` | export HTTP delivery is a different owner |
| stable auth routes/hooks/templates | `MUST_REMAIN_UNCHANGED` | only a stale test selector may be corrected |
| W3 non-owning access participant | `NOT_RELEVANT` | no access write moves |
| access/auth transaction composition | `MUST_REMAIN_UNCHANGED` | W5 owns no auth transaction |
| effective-role/access vocabulary | `W5_DEPENDS_ON` | roles are consumed unchanged by report/monitoring guards |

W5 changes no W4 owner and adds no dependency back into W4.

## 4. W4 to W5 dependency check

```text
NO_W4_W5_DEPENDENCY
```

Frozen W5 prerequisites name no W4 output. W4's stable role/auth/session
behavior is a platform baseline, not a produced W5 interface. The W4 readiness
ledger likewise records 0/0 explicit W5 dependencies. Browser authentication
used by a W5 E2E gate does not make authentication ownership part of W5.

## 5. Exact W5 contract

| Contract element | Frozen result |
| --- | --- |
| Purpose | make report/export completion boundaries and frontend ownership traceable without behavior redesign |
| Current problem | report HTTP, preview snapshots, generation, durable evidence, streaming, dashboard/alerts reads, and presentation remain mixed |
| Target objective | separate report HTTP, procedural preview read, renderer, durable generation, and delivery; move dashboard/index/alerts presentation to the W2 read orchestration; migrate only proven frontend hooks/modules/CSS |
| In-scope responsibilities | reports route/data/render/UI; `MjlExport`, spool and stream delivery; index/dashboard/alerts handlers and presentation; directly relevant templates/JS/CSS |
| Retained owner | `MjlMonitoring` remains the scoped query owner |
| Required prerequisites | BC-003 injection; approved-v3 authority for any touched CSS; BC-013 decision only if retry/cleanup meaning is touched; monitoring filter/permission/unavailable/URL baseline; missing alerts assertions |
| Preservation | RT-001/002/010-012/014, SEC-AUTHZ-004, DB-001/002, and section-10 frontend contracts; this review additionally guards four indirectly exposed requirements |
| Coexistence | additive target modules may exist, but each reachable route/operation has one authoritative executor; old selected branches retire at cutover |
| Recovery | whole cutover-group source revert; existing generated rows retain `GENERATED` meaning; no schema rollback |
| Exit | generation and delivery failures distinguished; private artifacts; fresh locked authorization; duplicate selected path removed; dashboard/index/alerts preserve filters, permissions, unavailable states, URLs, and visible behavior through the W2 read module |
| W6 dependency | 0/0 formal W5-produced dependencies |

W5 has three authoritative scope items: **3/3 mapped**.

## 6. W5 exclusion ledger

| Excluded item | Authority / reason | Deferred to | W5 dependency? | Must remain unchanged? | Evidence |
| --- | --- | --- | --- | --- | --- |
| W6-W7 implementation | separately gated waves | W6/W7 | No | Yes | frozen wave table |
| remaining W4/auth/session/email/access cleanup | no W5 authority | later explicit request | No | Yes | W4 baseline |
| reference-command cleanup | W3 owner not selected | later explicit request | No | Yes | W3 completion |
| Activity/W2 command or query redesign | W5 reuses W2 read; retains `MjlMonitoring` | later explicit request | W5 consumes only | Yes | W2 completion/W5 affected list |
| schema/data migration or DDL | absent from W5; rollback says none | W6 or explicit decision | No | Yes | W5 rollback |
| lifecycle/detector relocation | W6 scope | W6 | No | Yes | W6 contract |
| Operation/request handlers | absent from affected list | later wave/request | No | Yes | request map |
| document/cron/reconciler work | unrelated owners | separate scope | No | Yes | current architecture |
| report format/filter/filename change | explicitly forbidden | product decision | No | Yes | W5 forbidden list |
| export audit or `GENERATED` meaning change | explicitly forbidden | product decision | No | Yes | BC-003/W5 exit |
| global export-lock redesign | requires workload evidence | separate decision | No | Yes | BC-012/W5 forbidden list |
| retry/cleanup identity redesign | BC-013 decision absent | separate decision | Conditional only if touched | Yes | BC-013 |
| UI redesign | explicitly forbidden | design task | No | Yes | W5 forbidden list |
| unrelated shared frontend rewrite | only proven producer/consumer splits allowed | later explicit request | No | Yes | frontend architecture |
| general CSS decomposition | BC-004 applies only to touched sections | design task | No | Yes | BC-004 |
| general `.lib.php` cleanup | no authority | later explicit request | No | Yes | lean checkpoint |
| general deduplication | movement does not authorize consolidation | later explicit request | No | Yes | duplication policy |
| historical/dead-code deletion without proof | forensic proof plus W5 scope required | W7/explicit scope | No | Yes | dead-code rule |
| runner cleanup / broad legacy-suite repair | focused named gates exist | verification task | No | Yes | acceptance guidance |
| PHPCS/PHPStan/ESLint/Stylelint/static-analysis rollout | no configured W5 need | tooling task | No | Yes | frozen deferred table |
| dependency upgrades | prohibited | separate request | No | Yes | task mode |
| CI changes | prohibited | separate request | No | Yes | task mode |
| general formatting/unrelated defects | outside current criteria | separate request | No | Yes | lean checkpoint |

Exclusions reconciled: **23/23**.

## 7. Master W5 traceability ledger

Abbreviations: `R` = READY; `C` = READY_WITH_CONSTRAINTS; `NA` =
NOT_APPLICABLE; `SR` = whole-group source revert. All rows have behavior change
`NO`. Current state is `VERIFIED_AT_HEAD` unless explicitly stated otherwise.

Authority keys are exact document locations: `A1` = frozen architecture
section 16, W5 Scope/Rationale/Affected; `A2` = section 16, W5 Prerequisites,
Preservation, Tests, Allowed/Forbidden, Rollback/Exit; `A3` = frozen
architecture section 10 Frontend architecture; `A4` = frozen architecture
section 17 TA/RT/DB mappings; `A5` = preservation ledger; `A6` = Engineering
Standard sections 3-12; `A7` = W2 readiness/completion and DEC-063; `A8` =
request, DB, frontend, and current-architecture audit maps; `A9` = W4 readiness
W5-dependency row; `A10` = frozen W6 contract.

| ID | Type | Concern | Authority | Current evidence / state / owner | Target / action | Preservation | Depends on | Must precede | Group | Gates | Transition / recovery / W6 | Status / constraint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | ROUTE | report preview HTTP | A1,A4,A6 | `reports.php` -> `mjl_report_page`; route owner | thin root + report handler; DELEGATE | RT-001/002/014 | T04,T23,T27,T28 | T05,T32,T33,T31 | CG-W5-01 | G01,G04 | mixed route > selected handler > handler; SR; none | R |
| T02 | RESPONSIBILITY | preview snapshot | A1,A2,A4,A6 | inline `mjl_report_page`; route lib owns transaction/budgets | procedural report read; MOVE | RT-010/011,DB-001/002 | T04,T25,T27,T28 | T03,T05,T32,T31 | CG-W5-01 | G01,G05 | route lib > selected read > read module; SR; none | C: fault/budget proof, including DEC-066 rollback-failure oracle, before movement/cutover |
| T03 | DATA_FLOW | preview projections/choices | A1,A4,A5 | `MjlMonitoring` + report helpers; scoped query owner | read delegates retained query owner; RETAIN/DELEGATE | RT-010/014,DB-001 | T02,T25 | T05,T07,T35,T31 | CG-W5-01 | G02,G03,G05 | mixed caller > same query owner > same owner; SR; none | R |
| T04 | RESPONSIBILITY | validation/fixed builder map | A1,A2,A6 | validation helper and fixed five-type map; report route owner | handler/read boundary; MOVE | RT-002/010/014 | T23,T27,T28 | T01,T02,T06,T35,T31 | CG-W5-01/02 | G01,G03,G04 | mixed lib > handler input owner > handler; SR; none | R |
| T05 | RESPONSIBILITY | report preview presentation | A1,A2,A3,A6 | route/UI helpers emit HTML; presentation owner | prepared presenter/templates; EXTRACT | RT-001/002,frontend | T01,T02,T03,T32 | T20,T21,T24,T31 | CG-W5-01 | G01,G04 | mixed render > selected presenter > template; SR; none | R |
| T06 | ROUTE | export POST HTTP | A1,A2,A4,A6 | `reportexport.php` -> export HTTP function; route owner | thin root + export handler; DELEGATE | RT-001-003/014 | T04,T23,T27,T28 | T12,T21,T24,T31 | CG-W5-02 | G01,G04,G05 | root+mixed lib > handler > handler; SR; none | R |
| T07 | RESPONSIBILITY | durable generation | A1,A2,A4,A6 | `MjlExport::generate`; generation owner | explicit generation owner; RETAIN/EXTRACT only as needed | RT-012/014,DB-001/002 | T03,T08,T09,T25 | T10,T13,T31 | CG-W5-02 | G01,G03,G05 | export class > selected owner > generation owner; SR; none | R |
| T08 | RESPONSIBILITY | private spool/lock/artifact | A1,A2,A4,A5 | `MjlExportSpool`; spool owner | retained private adapter; RETAIN | RT-012/014 | T27,T28 | T07,T31 | CG-W5-02 | G03,G05 | spool > spool > spool; SR; none | R |
| T09 | RESPONSIBILITY | CSV/XLSX/PDF renderers | A1,A2,A4,A6 | report render/format libs + native adapters | renderer owner; RETAIN/EXTRACT | RT-012/014 | T08,T27,T28 | T07,T31 | CG-W5-02 | G03-G05 | helpers > selected renderer > renderer; SR; none | R |
| T10 | INVARIANT | fresh locked authorization | A2,A4,A5 | export identity/current-scope locks; export owner | generation retains fresh authorization | RT-002/012,SEC-AUTHZ-004,DB-001 | T07,T25 | T11,T31 | CG-W5-02 | G05 | export class > same locks > same; SR; none | R |
| T11 | RESPONSIBILITY | audit + export record | A1,A2,A4,A5 | final export transaction; export owner | durable generation owner; RETAIN | RT-012,DB-001/002 | T10 | T12,T31 | CG-W5-02 | G05 | export class > same transaction > generation; SR; none | R |
| T12 | DATA_FLOW | HTTP streaming/BC-003 | A2,A4 | current `fread()` false silently breaks; route lib | delivery adapter with explicit failure; MOVE | RT-012,DB-002 | T06,T11 | T13,T24,T31 | CG-W5-02 | G06 | mixed lib > delivery only > adapter; SR after commit keeps evidence | C: server read-failure proof before movement/cutover |
| T13 | RISK | cleanup/retry identity/BC-013 | A2 | post-commit cleanup/retry semantics; export owner | RETAIN/GUARD | RT-012,DB-002 | T07,T12 | T31 | CG-W5-02 | G05,G06 | current > untouched > unchanged; SR/forward fix | C: if touched, decide before movement; otherwise prove untouched |
| T14 | ROUTE | dashboard/index GET | A1,A2,A4,A6 | `index.php` -> monitoring home; route owner | thin root + monitoring handler; DELEGATE | RT-001/002/010/011 | T16,T19,T23,T34 | T17,T20,T24,T31 | CG-W5-03 | G01,G05 | root+route > selected handler > handler; SR; none | R |
| T15 | ROUTE | alerts GET | A1,A2,A4,A6 | `alerts.php` -> monitoring alerts; route owner | thin root + monitoring handler; DELEGATE | RT-001/002/010/011 | T16,T19,T23,T34 | T18,T20,T24,T31 | CG-W5-03 | G01,G05 | root+route > selected handler > handler; SR; none | R |
| T16 | RESPONSIBILITY | home/alerts read snapshot | A1,A2,A4,A7 | monitoring route snapshot; W2 read exists | W2 monitoring read module; MOVE | RT-010/011,DB-001/002 | T19,T25,T34 | T14,T15,T17,T18,T35,T31 | CG-W5-03 | G02,G05,G07 | route snapshot > sole W2 read > W2 read; SR; none | C: selector, alerts, and fault proof before movement |
| T17 | RESPONSIBILITY | dashboard presentation | A1,A2,A3,A4 | monitoring route + dashboard UI; presentation owner | presenter/template; EXTRACT | RT-001/002/010,frontend | T14,T16 | T20,T21,T24,T31 | CG-W5-03 | G05,G07 | mixed route > prepared view > template; SR; none | R |
| T18 | RESPONSIBILITY | alerts calculation/presentation | A1,A2,A3,A4 | monitoring helpers + inline output | W2 facts + alerts presenter; EXTRACT | RT-010,SEC-AUTHZ-004,DB-001 | T15,T16 | T20,T21,T24,T31 | CG-W5-03 | G03,G05,G07 | mixed route > prepared view > template; SR; none | R |
| T19 | INVARIANT | readiness/unavailable selection | A2,A4,A5 | retained readiness detector; detector owner | retained exact detector; GUARD | RT-011,DB-004 | T27,T28 | T14-T16,T30,T31 | CG-W5-03 | G02,G05 | same detector > same > same; SR; W6 inventory only | R |
| T20 | FRONTEND_CONTRACT | touched behavior hooks | A1-A3,A6 | report/dashboard markup + shared assets | compatible `data-mjl-*` pair; GUARD/EXTRACT | frontend section 10 | T05,T14,T15,T17,T18 | T21,T22,T31 | CG-W5-04 | G04,G07,G08 | old > bounded dual > new; SR; none | C: producer/consumer proof before movement |
| T21 | FRONTEND_CONTRACT | forms/navigation/ARIA/no-JS | A2,A3,A6 | server HTML + shared components | preserve; GUARD | RT-003,frontend | T05,T06,T17,T18,T20 | T31 | CG-W5-04 | G04,G05,G07 | existing > compatible > equivalent; SR; none | R |
| T22 | FRONTEND_CONTRACT | touched CSS/BC-004 | A2,A3 | approved v3; stale assertions | split proven section only; GUARD | frontend section 10 | T20 | T31 | CG-W5-04 | G08 | current > bounded compatible > selected section; SR | C: only if CSS touched; reconcile first |
| T23 | INVARIANT | routes/methods/URLs stable | A1,A2,A4,A5 | five route adapters/actions; route owners | unchanged; GUARD | RT-001-003 | T27,T28 | T01,T04,T06,T14,T15,T31 | all | G01,G04,G05,G07 | stable > stable > stable; SR | R |
| T24 | RESPONSIBILITY | failure mapping | A2,A6 | current HTTP and unavailable outcomes; mixed owners | equivalent handler/read/delivery mapping; MOVE | RT-002/011/012 | T05,T06,T12,T14,T15,T17,T18 | T31 | groups 1-3 | G04-G07 | mixed > selected owners > explicit owners; SR | R |
| T25 | INVARIANT | role/entity/assignment scope | A2,A4,A5 | policies, `MjlMonitoring`, fresh locks | same policies/query/locks; GUARD | SEC-AUTHZ-001/003/004,DB-001 | T26-T28 | T02,T03,T07,T10,T16,T31 | groups 1-3 | G02,G05,G07 | current > same > same; SR | R |
| T26 | INVARIANT | post-W4 auth/session | A9,A5 | W4 owners at HEAD | unchanged; NONE/GUARD | SEC-AUTH-001-006 | none | T25,T31 | none | G00,G08 | W4 > W4 > W4; N/A | R |
| T27 | GOVERNANCE | architecture amendment | frozen architecture/W5 | frozen hash and contract | none; NONE | all | none | T01-T26,T29-T35 | none | G00 | frozen > frozen > frozen; N/A | R: amendment NO |
| T28 | GOVERNANCE | Standard amendment | original review found none; DEC-066 later amended only the T02 rollback-failure oracle | amended frozen hash/module vocabulary | documentation amendment only; no runtime move | all | none | T01-T26,T29-T35 | none | G00 | original frozen Standard > DEC-066 amended frozen Standard; N/A | R: amendment YES — DEC-066 |
| T29 | DEPENDENCY | W4-produced W5 dependency | A9,A1 | none in W4 ledger/W5 prerequisites | none; NONE | none | T27,T28 | none | none | G00 | stable baseline only; N/A | NA: 0/0 with evidence |
| T30 | W6_DEPENDENCY | W5-produced W6 dependency | A10,A4 | W6 names no W5 outcome | none; NONE | RT-011/DB-004 guard | T19,T27,T28 | none | none | G00,G08 | no produced interface; N/A | NA: 0/0; preserve caller inventory |
| T31 | TRANSITION | cutover/recovery | A2,A6 | compatible source/schema; current owners | group-atomic cutover; GUARD | all affected | T01-T28,T32-T35 | none | CG-W5-01-04 | G01-G08 | old sole > selected sole > target sole; SR/forward fix | R |
| T32 | RESPONSIBILITY | current-schema audit preview | A1,A2,A4 | audit route owns snapshot/cursor/render | audit read + prepared presenter; EXTRACT/MOVE | RT-010/012,SEC-AUTHZ-004,DB-001/002 | T01,T02,T25 | T05,T33,T31 | CG-W5-01 | G01,G04,G05 | audit mix > selected owners > target; SR | R |
| T33 | ROUTE | predecessor audit compatibility | A2,A8 | workflow route selects current or predecessor | current delegation only; RETAIN predecessor | RT-001/002/011 | T01,T32 | T31 | CG-W5-01 | G01,G05 | explicit branch > explicit > `LEGACY_RETAINED`; SR | R |
| T34 | INVARIANT | shared Operations/request branches | A1,A2,A7 | shared monitoring route has excluded callers | keep current owner; GUARD | RT-001-011 | T27,T28 | T14-T16,T31 | CG-W5-03 | G01,G02,G05 | current > home/alerts only > excluded unchanged; SR | R |
| T35 | DEPENDENCY | monitoring imports report route helpers | A1,A4,A6 | monitoring route requires report route; incidental owner | move helpers to actual owners; no framework | RT-010-012/014 | T03,T04,T16 | T31 | CG-W5-01/03 | G01-G03 | incidental dependency > explicit owners > decoupled; SR | R |

Row totals: **35**; READY **27**; READY_WITH_CONSTRAINTS **6**;
BLOCKED **0**; NOT_APPLICABLE **2**. Every constrained row says whether
resolution is required before authorization/movement/cutover/completion:

| Rows | Before authorization | Before movement | Before cutover | Before completion |
| --- | --- | --- | --- | --- |
| T02 | No | Yes | Yes | Yes |
| T12 | No | Yes | Yes | Yes |
| T13 | No | Yes only if cleanup/retry touched | Yes only if touched; otherwise prove untouched | Yes |
| T16 | No | Yes | Yes | Yes |
| T20 | No | Yes for selected hook | Yes | Yes |
| T22 | No | Yes only if CSS touched | Yes if touched | Yes or documented untouched |

## 8. Coverage reconciliation

| Population | Coverage | Denominator |
| --- | --- | --- |
| authoritative W5 scope items | 3/3 | report/export; monitoring; directly relevant frontend |
| current responsibilities in scope | 22/22 | HTTP preview/export; validation; preview snapshot; projections/choices; preview UI; audit preview; predecessor delegation; generation; spool; render; fresh auth; evidence; streaming; dashboard root/read/presentation; alerts root/read/presentation; shared-branch boundary; route coupling; frontend hooks |
| target responsibilities | 15/15 | thin report/export/index/alerts adapters and handlers; report/audit read; retained query; presenter/templates; generation; spool; renderer; delivery; monitoring read/presentation; explicit compatibility branch; frontend pair |
| affected routes/actions | 5/5 | `reports.php` GET; `reportexport.php` POST; `index.php` GET; `alerts.php` GET; current-schema `workflowactions.php` GET delegation |
| affected DB/query/write paths | 14/14 | readiness; budgets; preview snapshot; Activity/Operation/reference/audit projections; export snapshot; identity; Activity/assignment locks; audit insert; export-record insert; monitoring snapshot; work/request facts |
| affected transaction boundaries | 4/4 | preview read; monitoring read; export snapshot; export final authorization/evidence |
| affected frontend contracts | 11/11 | all section-10 contract groups classified |
| affected Dolibarr seams | 12/12 | bootstrap, DB, user, entity config, navigation rights, CSRF token, module paths, class loading, native PDF, native XLSX, hooks/current audit delegation, response/session-close boundary |
| preservation requirements | 35/35 | section 9 |
| required verification gates | 9/9 | G00-G08 |
| cutover groups | 4/4 | CG-W5-01-04 |
| W6 dependencies | 0/0 | none defined |
| explicit exclusions | 23/23 | section 6 |

Coverage is `COMPLETE`; there is no unknown denominator.

## 9. Preservation view

| Preservation ID | Classification | Ledger IDs | Current enforcement | W5 target enforcement | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| RT-001 | DIRECTLY_AFFECTED | T01,T06,T14,T15,T23 | bootstrapped roots | thin stable roots | G01,G04,G05,G07 | READY |
| RT-002 | DIRECTLY_AFFECTED | T01,T06,T14,T15,T24,T25 | route/policy guards | handlers before read/render/delivery | G01,G04-G07 | READY |
| RT-003 | INDIRECTLY_AT_RISK | T06,T21,T23 | export POST CSRF | same handler check/form | G01,G04,G05 | READY |
| RT-004 | NOT_TOUCHED | T26 | W2-W4 locked commands | unchanged; no W5 mutation command | G08 exclusion diff | READY |
| RT-005 | NOT_TOUCHED | T26 | `MjlActivityCommand` aggregate | unchanged | G02,G08 | READY |
| RT-006 | NOT_TOUCHED | T26 | review command/policy | unchanged | G08 | READY |
| RT-007 | NOT_TOUCHED | T26 | server financial command rules | unchanged; read formatting only | G03,G08 | READY |
| RT-008 | NOT_TOUCHED | T26 | command versions | unchanged | G08 | READY |
| RT-009 | NOT_TOUCHED | T26 | Activity exception commands | unchanged | G08 | READY |
| RT-010 | DIRECTLY_AFFECTED | T02,T03,T16-T19,T25 | `MjlMonitoring` + W2 read | same query owner under report/W2 reads | G02,G03,G05,G07 | READY |
| RT-011 | DIRECTLY_AFFECTED | T02,T19,T24 | exact readiness detectors | retained detector callers/fail closed | G02,G05,G07 | READY |
| RT-012 | DIRECTLY_AFFECTED | T06-T13 | export workflow/spool/stream | separated generation/delivery, same meaning | G03-G06 | READY_WITH_CONSTRAINTS |
| RT-013 | NOT_TOUCHED | T26 | deny-only documents | unchanged | G08 | READY |
| RT-014 | DIRECTLY_AFFECTED | T01,T03,T06-T09 | native adapter boundaries | private/fixed adapters | G01,G03,G05 | READY |
| RT-015 | NOT_TOUCHED | T26 | reconciler | unchanged | G08 | READY |
| SEC-AUTH-001 | NOT_TOUCHED | T26 | W4 auth command | unchanged | G08 | READY |
| SEC-AUTH-002 | NOT_TOUCHED | T26 | auth token owner | unchanged | G08 | READY |
| SEC-AUTH-003 | NOT_TOUCHED | T26 | reset command | unchanged | G08 | READY |
| SEC-AUTH-004 | NOT_TOUCHED | T26 | OTP command/session adapter | unchanged | G08 | READY |
| SEC-AUTH-005 | NOT_TOUCHED | T26 | hook/pure policy/session adapter | unchanged | G08 | READY |
| SEC-AUTH-006 | NOT_TOUCHED | T26 | encrypted native adapter | unchanged | G08 | READY |
| SEC-AUTHZ-001 | INDIRECTLY_AT_RISK | T25,T26 | four-role policy | same report/dashboard role semantics | G04,G05,G07 | READY |
| SEC-AUTHZ-002 | NOT_TOUCHED | T26 | access command | unchanged | G08 | READY |
| SEC-AUTHZ-003 | INDIRECTLY_AT_RISK | T10,T16,T25 | assignment-scoped query/locks | same query/locks | G02,G05,G07 | READY |
| SEC-AUTHZ-004 | DIRECTLY_AFFECTED | T10,T18,T21,T25 | layered UI/route/read/lock guards | same layers under new owners | G01,G04,G05,G07 | READY |
| SEC-DOC-001 | NOT_TOUCHED | T26 | deny-only routes | unchanged | G08 | READY |
| SEC-DOC-002 | NOT_TOUCHED | T26 | no public ECM links | unchanged | G08 | READY |
| DB-001 | DIRECTLY_AFFECTED | T02,T03,T10,T11,T16,T25 | entity predicates/locks | same retained query/transaction owners | G02,G05,G07 | READY |
| DB-002 | DIRECTLY_AFFECTED | T02,T07,T10-T13,T16 | read snapshots + export audit transaction | explicit owner, same evidence semantics | G02,G05,G06 | READY_WITH_CONSTRAINTS |
| DB-003 | NOT_TOUCHED | T26 | exact DB definitions | unchanged/no DDL | G08 | READY |
| DB-004 | NOT_TOUCHED | T19,T30 | exact detector/installers | detector only retained; installers unchanged | G02,G05,G07,G08 | READY |
| LIFE-001 | NOT_TOUCHED | T26 | clean bootstrap | unchanged | G08 | READY |
| LIFE-002 | INDIRECTLY_AT_RISK | all test rows | disposable runner | named suites and teardown | G04-G07 | READY |
| LIFE-003 | NOT_TOUCHED | T19,T30 | lifecycle classifier | unchanged | G08 | READY |
| LIFE-004 | NOT_TOUCHED | T26 | bootstrap disablement | unchanged | G08 | READY |

Totals: **9 DIRECTLY_AFFECTED, 4 INDIRECTLY_AT_RISK, 22 NOT_TOUCHED**.
Every affected item has target enforcement and verification.

## 10. Request/action ownership view

| Ledger ID | Root/endpoint | Method/action | PRE owner | TRANSITION owner | POST owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T01-T05 | `reports.php` | GET, five fixed report types | root + report route | selected handler/read/presenter only | `TARGET_OWNED` | READY |
| T06-T13 | `reportexport.php` | POST, `csv/xlsx/pdf` | root + report route + export class | selected handler/generation/delivery only | `TARGET_OWNED` | READY_WITH_CONSTRAINTS |
| T14,T16,T17 | `index.php` | GET dashboard | root + monitoring route | selected handler + W2 read + presenter | `TARGET_OWNED` | READY_WITH_CONSTRAINTS |
| T15,T16,T18 | `alerts.php` | GET alerts | root + monitoring route | selected handler + W2 read + presenter | `TARGET_OWNED` | READY_WITH_CONSTRAINTS |
| T01-T05 | `workflowactions.php` current-schema audit delegation | GET | workflow route -> report/audit route | same selected report handler/read/presenter | `TARGET_OWNED`; predecessor branch `LEGACY_RETAINED` | READY |

There is no `UNOWNED` or `DUAL_AUTHORITATIVE` state. The POST export path has
one HTTP owner, one generation/transaction owner, and one delivery owner; it
never executes old and new generation independently.

## 11. DB/transaction view

| Ledger ID | Table/query/write | Current -> target owner | Impact | Transaction owner | State compatibility | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T02,T03 | report preview reads/choices | route lib -> report read -> retained `MjlMonitoring` | READ_OWNERSHIP_CHANGE | report read snapshot | no persistent change | constrained |
| T07 | export projection reads | `MjlExport` -> explicit generation/read owner | QUERY_RELOCATION_ONLY | export snapshot | compatible | ready |
| T10 | user/role/Activity/assignment locks | `MjlExport` -> generation owner | NONE/owner clarified | final auth transaction | compatible | ready |
| T11 | `audit_event`, `export_record` writes | `MjlExport` -> generation owner | NONE/owner clarified | same final transaction | compatible | ready |
| T16 | dashboard/alerts reads | monitoring route -> W2 read -> retained `MjlMonitoring` | READ_OWNERSHIP_CHANGE | W2 read snapshot | no persistent change | constrained |
| T19 | exact schema reads | current callers -> selected handlers/read | QUERY_RELOCATION_ONLY | none | compatible | ready |

Transaction ownership is complete:

- Report and audit preview: the report-read module begins, commits, attempts
  rollback, and restores all changed session budgets. Failed begin/commit/read
  fails closed. Under DEC-066, rollback-call failure preserves the generic
  unavailable/HTTP 503 outcome; restoration failure also produces the generic
  unavailable/HTTP 503 outcome. Neither exposes partial content or downloads.
- Monitoring dashboard/alerts: W2 monitoring-read module owns the same bounded
  snapshot. `MjlMonitoring` owns SQL, not transaction orchestration.
- Export capture: generation owner retains the repeatable-read snapshot.
- Export evidence: generation owner retains the separate read-committed fresh
  authorization/audit/export-record transaction. Failed begin or commit never
  yields a success response; rollback failures surface. Native renderers do not
  own these transactions.

No schema change is authorized. Persistent export rows remain backward
compatible. The last safe source-revert point is before a cutover request; once
an export record commits, source revert remains safe because its existing
meaning is unchanged. BC-003 changes only explicit delivery failure handling,
not durable generation status.

## 12. Frontend contract view

| Ledger ID | Contract | Producer -> consumer | PRE | POST | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T05,T21 | report filters, names, URLs, active selections, export forms | report presenter -> browser/server | current server HTML | equivalent prepared template | G04/G05 | READY |
| T17,T18,T21 | dashboard metrics/work/alerts IDs and `data-*` values | monitoring presentation -> browser/tests | inline output | prepared templates | G05/G07 | READY_WITH_CONSTRAINTS |
| T20 | behavioral selectors | touched template -> shared/feature JS | mixed class/data hooks | documented `data-mjl-*` | G04/G07/G08 | constrained |
| T20-T22 | ARIA/no-JS/responsive state and CSS | templates/JS -> CSS/browser | current | behavior-equivalent selected section | G04/G07/G08 | constrained |
| T21 | navigation/form shared behavior | shell/forms -> `mjl_components.js` | existing | unchanged | G04/G07 | READY |

All 11 section-10 contract groups are classified: prepared-only templates;
submission-token effects; approved reusable structures; stable IDs/names/
indexed fields; compatible data hooks; presentation-only CSS classes;
server-rendered/no-browser-storage architecture; BigInt-safe finance; shared
form behavior; navigation/dialog behavior; and native-auth-template boundary.
Only contracts with a report/dashboard/alerts producer or consumer may move.

## 13. Dolibarr integration notes

The five roots retain `main.inc.php` bootstrap directly or through their
existing route. Handlers capture `$db`, `$user`, `$conf->entity`, navigation
rights, and Dolibarr CSRF state at the adapter boundary. Reads continue through
the Dolibarr DB abstraction and active entity predicates. Native PDF and XLSX
libraries remain private renderer adapters. Module paths and explicit class
loads remain stable; current-schema audit delegation remains finite and fixed.

The internal export builder map is a finite allowlist. No request-selected
function, class, method, callback, file, or include path may be added. W5 adds
no request, auth, authorization, transaction, ORM, or autoloading framework.

Authorization impact is `STRUCTURAL_OWNERSHIP_CHANGE` for HTTP/read/presentation
placement and `NONE` semantically. Effective role, entity isolation, Agent
assignment, Admin denial/audit access, and resource scope remain unchanged.
UI eligibility never authorizes a write or export.

Failure owners after cutover are explicit: handler validation/method/CSRF and
authorization; read module DB/snapshot/unavailable; generation owner business
rejection/fresh scope/audit/commit; renderer format/artifact failures; delivery
adapter stream failures; handler maps safe French HTTP/UI results. Technical
logs do not replace the export audit record.

## 14. Verification matrix

| Gate | Ledger IDs protected | Exact command/test | Oracle / failure proven | Execution path | Stage / environment | Mutation class | Blocking? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G00 | T27-T30 | `sha256sum` frozen files; `git cat-file -t` and `git merge-base --is-ancestor` for W0-W4; `git status --short`; `git diff --check` | hashes/ancestry exact, no governance mutation, clean baseline/diff | repository/Git | PRE_W5_BASELINE + DOCUMENTATION_DIFF; host | none | Yes |
| G01 | T01,T04-T07,T14,T15,T23,T24,T31 | `php tests/contracts/w5_reporting_ownership_test.php` (add before first move) | five stable roots delegate once; handler/read/presenter/generation/delivery owners unique; retained `MjlMonitoring`; selected legacy branches absent; exclusions retained | source contract loads production paths | PRE_MOVE_CHARACTERIZATION/CUTOVER; host | source only | Yes before movement |
| G02 | T02,T03,T16,T19,T25 | `php tests/contracts/activity_ownership_test.php && php tests/contracts/activity_read_ownership_test.php` | W2 read owner, snapshot failure/rollback/budget restoration, readiness and scoped query owner remain exact | production W2 read/source contract | PRE_W5_BASELINE + POST_CUTOVER; host/DB doubles | none | Yes |
| G03 | T03,T08,T09,T18 | `node --test tests/unit/report-format.test.js tests/unit/export-spool.test.js tests/unit/monitoring-reports.test.js` | exact/null-safe French formats, formula-safe cells, bounded private spool/lock/cleanup, projection/alert rules | Node -> PHP production helpers | FOCUSED_IMPLEMENTATION; host temp files | temporary files | Yes when touched |
| G04 | T01,T05,T06,T20-T24 | `npm run test:vui12` after replacing stale test-only `Connexion` selector with `Se connecter` | report navigation, filters, URLs, forms, formats, audit visibility, responsive/no-JS presentation and CSRF POST remain usable | disposable browser -> real routes | PRE_MOVE_CHARACTERIZATION + POST_CUTOVER; disposable tenant | isolated fixtures | Yes |
| G05 | T02-T13,T16,T19,T24,T25,T31 | `npm run test:phase3b`, explicitly selected, with focused T02 rollback-failure injection at the production read seam | scoped repeatable previews, all report types/formats, fresh locked authorization, durable evidence, private artifacts, unavailable/foreign/revoked behavior, session budgets and teardown; rollback-call failure yields generic unavailable/HTTP 503, exposes no partial rows/totals/download, attempts budget restoration, and emits no distinct rollback-failure result | disposable browser/fixture -> real DB/routes/classes | PRE_MOVE_CHARACTERIZATION + CUTOVER + DISPOSABLE_E2E | isolated fixtures/export rows | Yes for moved snapshot/auth/evidence |
| G06 | T12,T13 | `npm run test:phase3b` after extending `tests/e2e/export-recovery.spec.js` with server-side read-failure injection | `fread() === false` is observed as failed/incomplete delivery; no false complete response; already committed `GENERATED` evidence is unchanged; stream/spool resources close | real export route with injectable delivery seam | PRE_MOVE_CHARACTERIZATION + CUTOVER; disposable tenant | isolated export/evidence | Yes before T12 move |
| G07 | T14-T21,T24,T25 | `npm run test:vui09` after stale selector repair and focused alerts-page assertions | role/assignment/entity-scoped dashboard and alerts, Admin/no-role denial, filters/URLs/empty/unavailable states and visible behavior remain exact; teardown succeeds | disposable browser -> real index/alerts/read | PRE_MOVE_CHARACTERIZATION + CUTOVER | isolated fixtures | Yes before monitoring move |
| G08 | all changed rows | `node --test tests/unit/design-system-v3.test.js` only if CSS changes; `php -l <each changed PHP>`; `node --check <each changed JS>`; `git diff --check`; ownership/exclusion searches | touched CSS matches approved v3; files parse; no forbidden owners/schema/auth/lifecycle/tooling changes; old selected path removed | exact diff files/source | FOCUSED_IMPLEMENTATION + DOCUMENTATION_DIFF; host | source only | Yes as applicable |

Missing characterization classifications:

| Missing evidence | Classification | Ledger rows |
| --- | --- | --- |
| stale `Connexion` selector in the three selected browser files | MUST_ADD_BEFORE_MOVEMENT | T16 plus G04-G07 baseline |
| report/audit preview begin/commit/read/rollback-call/restore faults at target seam, with the DEC-066 generic unavailable/HTTP 503 rollback oracle | MUST_ADD_BEFORE_MOVEMENT | T02 |
| BC-003 server-side delivery read failure | MUST_ADD_BEFORE_MOVEMENT | T12 |
| focused alerts-page assertions in VUI09 | MUST_ADD_BEFORE_MOVEMENT | T16,T18 |
| producer/consumer proof for selected hook | MUST_ADD_BEFORE_MOVEMENT | T20 |
| focused approved-v3 assertion reconciliation | MUST_ADD_BEFORE_MOVEMENT only if CSS touched | T22 |
| BC-013 retry decision | NOT_REQUIRED while cleanup/retry remains untouched; MUST_ADD_BEFORE_MOVEMENT if touched | T13 |

No characterization is required before authorization. Every mandatory gate has
an exact oracle and known execution path; passing unrelated code does not count.
At this review baseline, `node tests/unit/design-system-v3.test.js` reports
0/4 because its existing auth-CSS/font/hover and forgot-password expectations
are stale. This is the known BC-004 constraint: CSS decomposition is not a
selected mandatory W5 action and remains prohibited until that focused evidence
is reconciled. It is not evidence of a W5 runtime regression.

Prior-wave gates: W2 Activity ownership/read contracts are `HARD_W5_GATE`.
W1, W3, W4, BC-018, Technical Admin reset, and BC-019 are `NOT_RELEVANT` to
owner movement; their behavior remains guarded by exclusions. VUI09/VUI12 and
the explicitly selected Phase 3B suite are W5 regression/cutover gates.

## 15. Deferred-debt view

| Debt/risk | W5 relationship | Ledger IDs | Disposition | Blocks? |
| --- | --- | --- | --- | --- |
| W2-RSK-007 broad legacy-suite cost | exact W5 gates cover moved trust boundaries | all verification rows | `DEFERRED`; `phase3b` is selected by frozen W5, not a blanket suite | No |
| BC-003 server `fread()` failure | direct delivery seam | T12 | W5 pre-movement constraint | No before authorization; hard before movement |
| BC-004 design assertions | approved v3 is authority | T22 | W5 guard only if CSS touched | No |
| BC-005 aggregate unit stall | no `npm run test:unit` | gates | DEFERRED | No |
| BC-006 incomplete discovery | every command/file is explicit | gates | W5_GUARD | No |
| BC-007 dormant shared-port test | not invoked; browser suites disposable | gates | NOT_RELEVANT | No |
| BC-012 global export lock | redesign forbidden | T08,T13 | DEFERRED | No |
| BC-013 retry identity | not touched by default | T13 | DEFERRED/conditional decision | No while untouched |
| other W0-W4 residual debt | owners outside W5 | T26/exclusions | DEFERRED or NOT_RELEVANT | No |

Duplication is classified narrowly. Mixed report/monitoring HTTP and
presentation are D2 structural and move without semantic consolidation.
Repeated route versus fresh-lock authorization is D4 defense-in-depth and
stays. Predecessor/current report paths are D3 intentional compatibility and
stay. Older CSV/XLSX helpers are `UNRESOLVED`; no removal occurs without static
and dynamic reachability proof plus W5 authority. No historical, migration-only,
or unresolved file is a deletion candidate merely because an owner moves.

## 16. Dependency graph validation

```text
{T27,T28} -> all selected rows
T26 -> T25

report:     T04 -> {T01,T02}; T02 -> {T03,T32};
            {T01,T03,T32} -> T05; {T01,T32} -> T33
export:     {T03,T08,T09} -> T07 -> T10 -> T11;
            T04 -> T06; {T06,T11} -> T12 -> T13
monitoring: {T19,T25,T34} -> T16 -> {T14,T15};
            {T14,T16} -> T17; {T15,T16} -> T18
coupling:   {T03,T04,T16} -> T35
frontend:   {T05,T14,T15,T17,T18} -> T20 -> {T21,T22}

all selected rows -> T31
```

Dependency direction and ordering are `VALID`. There are zero unexplained
cycles. CG-W5-04 is consumer-driven and cannot precede its selected PHP
producer. Monitoring is independently mergeable from reporting/export.

## 17. Coexistence/cutover view

| Group | Rows | Atomicity | PRE / transition / POST | Coexistence and cutover condition | Legacy disposition |
| --- | --- | --- | --- | --- | --- |
| CG-W5-01 report preview | T01-T05,T23-T25 | YES | mixed report route / one selected handler-read-presenter / target owners | additive internals allowed; reachable root switches once after G01-G05 | selected old HTTP/read/render branch removed |
| CG-W5-02 export generation/delivery | T06-T13,T23-T25 | YES | mixed route+class / one handler-generation-delivery chain / target chain | no dual generation; G03-G06 and BC-003 pass; BC-013 untouched/decided | selected old delivery branch removed; durable meaning retained |
| CG-W5-03 monitoring | T14-T19,T23-T25 | YES | monitoring route / one handler using W2 read / target presentation | dashboard and alerts may move together after G02/G05/G07; report family independent | old dashboard/alerts snapshot/render branches removed |
| CG-W5-04 frontend pair | T20-T22 | YES per selected hook | old pair / bounded dual hook / new pair | only producer+consumer pair coexists; proof passes before old hook removal | old hook/test removed in same substep |

All coexistence is `SAFE_TEMPORARY_COEXISTENCE` under the stated constraints.
There is no independently executable dual mutation or dual export generation.

## 18. Rollback/forward-recovery view

| Rows | Persistent impact | Last safe rollback point | Rollback model | Backward-compatible state? | Forward recovery | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T01-T05 | none | route cutover | SOURCE_REVERT_SAFE by group | Yes | not required | READY |
| T06-T10,T12 | private transient artifact only | before durable final commit | SOURCE_REVERT_SAFE; close/delete private attempt | Yes | failed delivery may need retry outside W5 semantics | READY_WITH_CONSTRAINTS |
| T11,T13 | existing audit/export rows | before final commit; after commit row is authoritative | SOURCE_REVERT_WITH_CONSTRAINTS | Yes because meaning unchanged | FORWARD_FIX_PREFERRED for delivery defect; never rewrite `GENERATED` | READY_WITH_CONSTRAINTS |
| T14-T19 | none | route cutover | SOURCE_REVERT_SAFE by group | Yes | not required | READY_WITH_CONSTRAINTS |
| T20-T22 | none | producer/consumer cutover | SOURCE_REVERT_SAFE by pair | Yes | restore compatible pair | READY_WITH_CONSTRAINTS |

All recovery models are credible; no DB restore is required.

## 19. Request/failure simulations

Report preview, PRE:

```text
GET reports.php -> main.inc.php -> mixed report route -> role check ->
inline repeatable snapshot -> MjlMonitoring -> inline/UI helpers -> HTML
```

POST:

```text
GET reports.php -> main.inc.php -> report handler -> role/input policy ->
report read snapshot -> retained MjlMonitoring -> prepared presenter/template
-> HTML
```

Dashboard/alerts, POST:

```text
GET index.php|alerts.php -> bootstrap -> route guard/readiness -> monitoring
handler -> W2 monitoring-read snapshot -> retained MjlMonitoring -> prepared
dashboard/alerts presenter -> HTML
```

Both target paths are `EASIER_TO_TRACE`: HTTP, snapshot, scoped query, and
presentation owners are explicit.

BC-003 failure, POST target:

```text
reportexport POST -> handler/CSRF/role -> generation snapshot -> private
renderer/spool -> fresh locked authorization -> audit + export_record commit
-> delivery adapter fread failure -> stream closes -> explicit incomplete/
failed transport termination; committed GENERATED evidence remains unchanged
```

Failure ownership is unambiguous. No rollback is attempted for a transaction
already committed, and no false successful complete delivery is claimed.

## 20. W6 dependency view

```text
0 / 0 — NONE_DEFINED
```

| W6 dependency | W5 ledger ID | Required W5 outcome | Proof at W5 completion | Blocking? |
| --- | --- | --- | --- | --- |
| none defined | T30 | N/A: W6 prerequisites do not name a W5 product | frozen W6 contract | No |

W5 must nevertheless leave the exact monitoring/export detector callers and
their refusal/cache/budget evidence identifiable so W6 can later move the
lifecycle closure. That is preservation of current consumers, not a new W5 to
W6 interface or implementation dependency.

## 21. W5 implementation skeleton

| Step | Ledger IDs | Action | Likely files | Preconditions | Gates | Group | Recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | T27-T30 | reverify governance/baseline; add only missing characterization | named tests only | W5 authorization | G00,G02,G04,G06,G07 | none | revert tests |
| 2 | T01-T05,T24,T25,T32,T33,T35 | extract report/audit handler, `lib/reporting/mjl_reporting_read.lib.php`, presenter and `tpl/reporting/` templates; retain predecessor audit | `reports.php`, `workflowactions.php`, report/audit libs, `lib/reporting/`, `tpl/reporting/` | T02 proof | G01-G05 | CG-W5-01 | group source revert |
| 3 | T06-T13,T24,T25 | separate export handler, generation, and delivery without changing durable meaning | `reportexport.php`, report route, `MjlExport`, selected export libs | BC-003 proof; BC-013 untouched/decided | G01,G03-G06 | CG-W5-02 | group revert; forward-fix after committed row |
| 4 | T14-T19,T24,T25,T34,T35 | migrate only dashboard/index/alerts to W2 read and prepared presentation; retain shared Operations/request branches | `index.php`, `alerts.php`, monitoring read/route/UI, templates | selector repair, alerts and snapshot proofs | G01,G02,G05,G07 | CG-W5-03 | group source revert |
| 5 | T20-T22 | migrate only proven producer/consumer hooks and CSS sections | selected templates, `mjl_components.js`, `mjl_app.css.php` | exact pair proof; approved-v3 test if CSS | G04,G07,G08 | CG-W5-04 | pair source revert |
| 6 | T23-T35 | remove only superseded selected branches; reconcile docs | selected old owners/docs | all group gates pass | G00-G08 as applicable | all | revert incomplete group/forward fix durable fact |

No patch, runtime implementation, or target file is created by this review.

## 22. Change-budget estimate

This is an estimate for a future authorized implementation, not a limit:

- files added: 5-9 (focused handlers/reads/templates and one ownership test);
- files modified: 10-16 (four roots/routes, export/monitoring collaborators,
  selected JS/CSS only when proven, focused tests, status docs);
- files removed: 0-2 only if a selected owner becomes wholly unreachable;
- tests added/modified: 4-7, including ownership, BC-003, alerts, and stale
  selector corrections;
- documentation modified: 3-5.

A generic frontend framework, new query class, schema change, or broad cleanup
would exceed this mapped mechanism budget and must stop for scope review.

## 23. Cross-cutting risk register

| Risk | Ledger IDs | Likelihood | Impact | Mitigation | Blocks authorization? |
| --- | --- | --- | --- | --- | --- |
| RSK-W5-01 stale login selectors prevent honest browser baseline | T16,G04-G07 | High | High | test-only correction before characterization | No; hard pre-movement |
| RSK-W5-02 BC-003 omitted or client abort mistaken for server read failure | T12 | Medium | High | injected server-read failure oracle in G06 | No; hard pre-movement |
| RSK-W5-03 frontend scope expands beyond proven pairs | T20-T22 | Medium | High | CG-W5-04 pair rule and exclusion ledger | No |
| RSK-W5-04 retry/cleanup semantics drift without BC-013 decision | T13 | Low if excluded | High | preserve untouched; stop for decision if necessary | No while untouched |
| RSK-W5-05 hidden route/query authority remains after cutover | T01-T19,T31 | Low | High | G01 ownership contract and group-atomic removal | No |
| RSK-W5-06 broad suites create cost without W5 oracle | gates | Medium | Low | exact focused matrix; W2-RSK-007 deferred | No |

Cross-cutting blocking risks: **0**. Non-blocking risks: **6**. Row-specific
constraints remain solely in the master ledger.

## 24. Mechanical readiness gate

| Condition | Result |
| --- | --- |
| coverage reconciliation | COMPLETE |
| BLOCKED rows | 0 |
| constraints requiring pre-authorization resolution | 0 |
| unresolved authority conflicts / current-state discrepancies | 0 / 0 |
| W4 to W5 explicit dependency | NONE_DEFINED |
| unexplained dependency cycles | 0 |
| unowned / dual-authority transition states | 0 / 0 |
| incomplete atomic cutover definitions | 0 |
| affected preservation without target enforcement / verification | 0 / 0 |
| mandatory gates without oracle / execution path | 0 / 0 |
| unsafe coexistence / non-credible recovery | 0 / 0 |
| ambiguous transaction ownership / authorization semantics | 0 / 0 |
| post-W4 auth/session conflicts | 0 |
| architecture / Standard amendment | NO / YES — DEC-066 (post-review, documentation only) |
| cross-cutting blocking risks | 0 |
| W5 scope | CLEAR |
| entry / exit derivable | YES / YES |
| W6 dependencies | COMPLETE, 0/0 |

Entry is therefore: frozen governance verified; W0-W4 complete; clean
worktree; 35/35 preservation classified; complete coverage; and this
mechanical gate passed. No additional pre-authorization condition exists.

Future exit is derived from every row whose action is not `NONE`: target owners
are sole and authoritative; selected old owners retire; all four applicable
cutover groups complete; G00-G08 pass as selected; preservation and W4 baseline
hold; recovery state is acceptable; no W6 implementation occurs; governance
and documentation remain reconciled; and the worktree is clean.

## 25. Final verdict

```text
W5_READY_FOR_AUTHORIZATION
```

The exact scope is clear, the post-W4 owners match it, coverage is complete,
all six constraints resolve before their affected movement rather than before
authorization, and no blocker exists. This verdict authorizes nothing. The
next task, if the user chooses to proceed, must be a separate **W5
IMPLEMENTATION AUTHORIZATION**.

Final mutation report:

```text
Frozen architecture modified: NO
Frozen Engineering Standard modified during the original readiness review: NO
Post-review Engineering Standard amendment: YES — DEC-066
Independent architecture review modified: NO
W0 implementation modified: NO
W1 implementation modified: NO
W2 implementation modified: NO
W3 implementation modified: NO
W4 implementation modified: NO
Runtime files modified: 0
Test files modified: 0
Tooling/config modified: 0
Dependencies modified: 0
CI modified: 0
```
