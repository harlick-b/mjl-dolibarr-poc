# MJL W6 readiness review

## Current implementation authorization

```text
W6_COMPLETE
Baseline: 725821a6a70f3ca158f55517a6a2386257d62277
Engineering Standard: b24021ac52a55f5a9921801aac8d100d9238268c55b3775875a0709132fb9560
W7 authorized: NO
```

DEC-070 supersedes the three conflicting inputs from the failed first attempt.
It retains the frozen W6 architecture and authorizes the exact delegation in
T03–T08, T14–T17, and T24 plus dependent T18–T20 closure. Every other ledger
constraint, gate, preservation requirement, and exclusion remains unchanged.
Implementation must stop before W7.

## Post-authorization implementation outcome

```text
W6_COMPLETE
Lifecycle ownership delegated: YES, exactly as authorized by DEC-070
W7 authorized: NO
```

DEC-070 resolved the three conflicts recorded by DEC-069 before implementation:
it authorized the exact frozen delegation, recognized Standard hash
`b24021ac...`, and named prerequisite baseline `725821a`. The descriptor now
contains one orchestration call to `mjl_lifecycle_prepare()` and retains the
native `_remove`/`_init` sequence. The existing activity schema installer seam
owns the moved activation logic. Exact detectors/installers, lock behavior,
failure injection, SQL-resource locations, states, DDL, auth behavior, and
guarded entrypoints are unchanged.

G01–G07 passed their maintained disposable or focused paths. G08 and G09 pass
the new ownership/loading contracts and PHP syntax checks. G10 completed with
zero actionable Standards or Specification findings. G00 confirms frozen
hashes, traceable scope, documentation reconciliation, and diff integrity.
All disposable tenants created by the W6 verification runs were removed.
Pre-existing historical Docker test resources remain outside this wave and
were not mutated. T03–T08, T14–T20, T23–T25, and T29 are verified complete;
retained and not-applicable rows remain unchanged. W7 is not authorized.

## Readiness verdict at authorization

Everything from this heading through the historical final-report block below is
the immutable pre-authorization readiness snapshot. Within that bounded
snapshot, terms such as “current,” row statuses, “future” gates, counts, and
implementation skeleton describe the state before DEC-070 execution; they are
not active post-W6 instructions. The current outcome is recorded above and in
the post-snapshot completion block at the end of this document.

```text
W6_READY_FOR_AUTHORIZATION
```

This re-review does not authorize or implement W6 or W7. The W6 boundary is
clear, and the four authorization prerequisites are now closed:

1. BC-021 uses narrow disposable profiles and exact-verifies the retained
   `rst002b` and `rst006a` predecessors before their matrices.
2. Module activation calls the schema-only half of the exact OTP detector
   before any repair helper and refuses missing indexes or weakened checks
   without mutation while retaining fingerprint-key initialization.
3. RST-012 has a maintained four-boundary interruption, resume,
   malformed-prefix, and empty-rollback matrix.
4. Descriptor clean/current/older/partial/unknown states are characterized
   through one schema-and-trigger fingerprint seam with lock-release proof.

The prerequisite implementation stays outside the W6 ownership move. W6 still
requires a separate explicit authorization.

## Authority and post-W5 baseline

| Authority | Verified result |
| --- | --- |
| Frozen architecture | `docs/architecture-audit/17-target-architecture-proposal.md`; SHA-256 `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| Frozen Engineering Standard | `docs/mjl-engineering-standard-v1.md`; amended SHA-256 `b24021ac52a55f5a9921801aac8d100d9238268c55b3775875a0709132fb9560` |
| Original Standard hash | `a47f2d942172a4685b02efce027ca04c0a2361f258ebd8c0b776117c97f8f62e`; historical after DEC-066 |
| Historical independent review | SHA-256 `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |
| Current implementation baseline | branch `main`; commit `2b05a78`; W0-W5 complete |
| Authorization at readiness snapshot | W6 and W7 `NOT_AUTHORIZED` |
| Preservation inventory | 35/35 present |

The pasted brief repeated the original Standard hash. DEC-066 amended the
Standard, so the authority router and current file hash control. This is a
reconciled prompt discrepancy, not an architecture/Standard amendment. The
Standard's embedded at-freeze wave-status block is historical context; the
authority router and roadmap own current status.

W5 produces no interface, schema, or owner required by W6. Its completed source
is the current baseline only: `NO_W5_W6_DEPENDENCY` (0/0), baseline `2b05a78`.
DEC-066 and DEC-067 remain unchanged.

### W1-W5 baseline protection

| Completed responsibility | Wave / owner | W6 classification | Relevant ledger IDs | Evidence / permitted relationship |
| --- | --- | --- | --- | --- |
| Partner / Project list ownership | W1 reference HTTP/read/presentation owners | MUST_REMAIN_UNCHANGED | T01,T29 | no reference route/frontend action in W6 |
| Activity HTTP ownership | W2 Activity HTTP handler | MUST_REMAIN_UNCHANGED | T20,T29 | detector-call closure only |
| Activity presentation | W2 Activity renderer/templates | MUST_REMAIN_UNCHANGED | T20,T29 | frontend contract is 0/0 |
| monitoring reads | W2 monitoring-read owner | MUST_REMAIN_UNCHANGED | T20,T29 | runtime detector result only; no query move |
| audit timeline reads | W2 Activity audit-read owner | MUST_REMAIN_UNCHANGED | T20,T29 | no audit query/projection move |
| Activity command dispatch | W2 `MjlActivityCommand` + HTTP handler | MUST_REMAIN_UNCHANGED | T20,T29 | no command/action move |
| deep reference command | W3 reference command | NOT_RELEVANT | T01 | no reference mutation/path touched |
| deep access command | W3 access command | NOT_RELEVANT | T01 | no access mutation/path touched |
| invitation non-owning participant | W3 access participant + auth command | MUST_REMAIN_UNCHANGED | T21-T23,T29 | no transaction participation change |
| access/auth transaction composition | W3/W4 command composition | MUST_REMAIN_UNCHANGED | T21-T23,T29 | activation guard owns no auth transaction |
| effective-role/access vocabulary | W3/W4 access policy | MUST_REMAIN_UNCHANGED | T21-T23,T29 | four-role/entity meaning unchanged |
| `MjlAuthCommand` | W4 auth command | MUST_REMAIN_UNCHANGED | T21-T23 | activation schema guard only; no flow cleanup |
| private session adapter | W4 session adapter | MUST_REMAIN_UNCHANGED | T21,T29 | not a lifecycle owner |
| pure session-validity policy | W4 session policy | MUST_REMAIN_UNCHANGED | T21,T29 | no session behavior change |
| email-owned test capture | W4 email library | MUST_REMAIN_UNCHANGED | T29 | no email/capture caller move |
| stable auth routes/hooks/templates | W4 routes, hook, templates | MUST_REMAIN_UNCHANGED | T21-T23,T29 | no external auth seam change |
| report/audit HTTP ownership | W5 report/audit handlers | MUST_REMAIN_UNCHANGED | T02,T20,T29 | no HTTP route move |
| report read ownership | W5 bounded reporting-read owner | MUST_REMAIN_UNCHANGED | T02,T20,T29 | no query/transaction move |
| report presentation ownership | W5 presentation/templates | MUST_REMAIN_UNCHANGED | T02,T29 | frontend contract is 0/0 |
| report generation ownership | W5 retained `MjlExport` / evidence owner | MUST_REMAIN_UNCHANGED | T02,T17,T20,T29 | RST-012 proof changes no generation meaning |
| report delivery ownership | W5 stream-delivery owner | MUST_REMAIN_UNCHANGED | T02,T29 | no delivery path change |
| dashboard monitoring reads | W5 dashboard consumer + W2 read owner | MUST_REMAIN_UNCHANGED | T02,T20,T29 | no query/consumer move |
| alerts monitoring reads | W5 alerts consumer + W2 read owner | MUST_REMAIN_UNCHANGED | T02,T20,T29 | no query/consumer move |
| `MjlMonitoring` query ownership | retained query owner | MUST_REMAIN_UNCHANGED | T02,T20,T29 | no query ownership change |
| DEC-066 generic 503 rollback-failure contract | W5 report/audit preview owner | MUST_REMAIN_UNCHANGED | T02,T29,T32 | preview path excluded; existing W5 evidence remains baseline |

No row is `PLANNED_W6_CHANGE`, and no W1-W5 product is `W6_DEPENDS_ON`.
Lifecycle detector consumers are inventory/verification inputs, not ownership
dependencies or permission to reopen completed waves.

## Exact scope and exclusions

W6 may only reduce `modMjlFinancement::init()` to explicit orchestration by
delegating to exact lifecycle detectors/installers at their current paths. It
may improve refusal diagnostics without recognizing a new state. Any necessary
extraction closes over every changed caller, include, and SQL/resource lookup
as one source unit.

The state machine remains: clean install; exact-current idempotent reactivation;
guarded refusal of maintained predecessors outside narrow disposable modes;
guarded handling of known interrupted prefixes; and fail-before-mutation for
unknown/malformed states. The named lock, data-retaining `remove()`, one native
technical Admin, empty business tenant, and bootstrap-only native-module
disablement remain unchanged.

Current exact-schema owners remain:

- `scripts/activity_schema_installer.lib.php`;
- `scripts/rst006a_schema.lib.php`;
- `scripts/rst006b_schema.lib.php`;
- `scripts/rst012_schema.lib.php`; and
- the existing guarded CLI scripts and SQL resources.

Explicitly excluded are a generic migration framework; DDL/schema/data/state
changes; silent repair; broad `MJL_TEST_MODE` forwarding; RST library or SQL
resource relocation without proven necessity; RST-005/shared-tool redesign;
historical-support removal; auth/authorization/workflow/report/monitoring/UI
behavior changes; cron redesign; production/shared-tenant work; persistent
fixtures; and all W7 cleanup.

### W6 exclusion ledger

| Excluded item | Authority / reason | Deferred to | W6 dependency? | Must remain unchanged? | Evidence |
| --- | --- | --- | --- | --- | --- |
| W7 implementation | A17 separate wave | W7 authorization | NO | YES | T30; W7 unauthorized |
| remaining W5 cleanup | DEC-067 bounded completion | separate evidence/decision | NO | YES | W5 baseline `2b05a78` |
| report cleanup | frozen W6 is lifecycle only | separate wave/decision | NO | YES | W5 owners unchanged |
| monitoring cleanup | frozen W6 is lifecycle only | separate wave/decision | NO | YES | W2/W5 owners unchanged |
| auth/session cleanup | W4 complete; W6 only activation exactness | separate decision | activation schema guard only | YES | T21-T23/G05-G06 |
| Activity cleanup | W2 complete | W7/candidate decision | detector calls only | YES | T20 inventory |
| reference cleanup | W1/W3 complete | separate decision | NO | YES | no reference row/action |
| access cleanup | W3/W4 complete | separate decision | NO | YES | no access owner moves |
| CSS cleanup | no W6 frontend scope | design task | NO | YES | frontend 0/0 |
| JavaScript cleanup | no W6 frontend scope | design/tooling task | NO | YES | frontend 0/0 |
| design-system cleanup | no W6 presentation scope | design task | NO | YES | frontend 0/0 |
| unrelated schema/lifecycle work | only exact descriptor delegation authorized in target | separate architecture decision | NO | YES | T03-T27 finite inventory |
| general `.lib.php` cleanup | no generic refactor authority | W7/candidate decision | NO | YES | current-path rule |
| general deduplication | ownership migration is not cleanup | W7/candidate decision | NO | YES | duplication audit below |
| runner cleanup | only BC-021 narrow profiles/gates relevant | separate tooling task | narrow G01/G02/G07 only | YES outside named profiles | BC-005/006/007 disposition |
| static-analysis adoption | no frozen W6 requirement | separate tooling decision | NO | YES | no config/dependency change |
| PHPCS | unavailable/not required | separate tooling decision | NO | YES | W0 tooling inventory |
| PHPStan | unavailable/not required | separate tooling decision | NO | YES | W0 tooling inventory |
| ESLint | unavailable/not required | separate tooling decision | NO | YES | W0 tooling inventory |
| Stylelint | unavailable/not required | separate tooling decision | NO | YES | W0 tooling inventory |
| dependency upgrades | no W6 dependency need | separate maintenance task | NO | YES | package/lock excluded |
| CI changes | no repository CI/W6 need | separate tooling task | NO | YES | CI mutation 0 |
| general formatting | no behavior/evidence need | separate maintenance task | NO | YES | diff limited to scoped blocker files and status docs |
| unrelated defects | latest authority + lean checkpoint | owning future task | NO | YES | gap analysis retains debt |

## Current-state discrepancy routing

The former blockers retain one canonical history: BLK-01 is ledger row T11,
BLK-02 is T22, BLK-03 is T17, and BLK-04 is T05. Those rows now record their
source evidence and closure. Other tables only cross-reference those rows.

The old lifecycle audit is stale where it says BC-020 is open: W0 fixed sticky
timeout results. It is incomplete where it treats BC-022 as wholly unresolved:
W4 established exact runtime refusal; activation-time recognition remains open.

## Master W6 traceability ledger

`SR` means revert the complete source group; `DR` means existing guarded
disposable recovery/teardown. Behavior change is `NO` for every applicable row.
The first table is a readable index. The following field matrix is the
canonical ledger and supplies every mandatory field for every ID.

| ID | Type | Concern | Current owner/evidence | W6 action/target | Preservation | Dependency/group/gates/recovery | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | GOVERNANCE | frozen boundary | verified hashes/authority | GUARD | all | CG0/G00 | READY |
| T02 | DEPENDENCY | W5 baseline | `2b05a78` | NONE | RT-010/012 | CG0/G00 | NOT_APPLICABLE: no W5 product |
| T03 | RESPONSIBILITY | descriptor orchestration | embedded `init()` | DELEGATE | RT-011,DB-004,LIFE-003 | T04-T25/CG3/G08-G10/SR | READY_WITH_CONSTRAINTS |
| T04 | TRANSITION | clean install | descriptor | DELEGATE | DB-003/004,LIFE-001/003 | T05/CG2-3/G06,G08/SR,DR | READY_WITH_CONSTRAINTS |
| T05 | TRANSITION | current reactivation | focused descriptor matrix | DELEGATE | RT-011,DB-004,LIFE-003 | CG2-3/G06,G08/SR,DR | READY_WITH_CONSTRAINTS |
| T06 | TRANSITION | older-state refusal | descriptor | DELEGATE | RT-011,DB-004,LIFE-003 | T05,T11/CG2-3/G01,G02,G06 | READY_WITH_CONSTRAINTS |
| T07 | TRANSITION | malformed-state refusal | descriptor fallback | DELEGATE | RT-011,DB-003/004,LIFE-003 | T05,T17/CG2-3/G03-G06 | READY_WITH_CONSTRAINTS |
| T08 | INVARIANT | lifecycle lock | descriptor | DELEGATE | DB-004,LIFE-003 | CG3/G06,G08/SR | READY_WITH_CONSTRAINTS |
| T09 | INVARIANT | guarded diagnostic | descriptor | RETAIN | RT-011,LIFE-003 | CG3/G06,G08/SR | READY |
| T10 | DEPENDENCY | BC-020 | W0 runner fix | RETAIN | LIFE-002 | CG1/G07 | READY |
| T11 | DEPENDENCY | RST-002B predecessor | explicit exact profile | GUARD | DB-003/004,LIFE-002/003 | CG1/G01,G07/DR | READY |
| T12 | DEPENDENCY | RST-006A predecessor | explicit exact profile | GUARD | DB-003/004,LIFE-002/003 | T11/CG1/G02,G07/DR | READY |
| T13 | RESPONSIBILITY | RST-005 tooling | retained current scripts | RETAIN | DB-003/004,LIFE-003 | source inventory | READY |
| T14 | RESPONSIBILITY | RST-002B lifecycle | exact library/CLI | DELEGATE | RT-011,DB-003/004,LIFE-003 | T11/CG3/G01,G08/SR,DR | READY_WITH_CONSTRAINTS |
| T15 | RESPONSIBILITY | RST-006A lifecycle | exact library/CLI | DELEGATE | RT-011,DB-003/004,LIFE-003 | T12/CG3/G02,G08/SR,DR | READY_WITH_CONSTRAINTS |
| T16 | RESPONSIBILITY | RST-006B lifecycle | exact full prefix matrix | DELEGATE | RT-011,DB-003/004,LIFE-003 | CG3/G03,G08/SR,DR | READY |
| T17 | RESPONSIBILITY | RST-012 lifecycle | exact maintained matrix | DELEGATE | RT-011,DB-003/004,LIFE-003 | CG2-3/G04,G08/SR,DR | READY_WITH_CONSTRAINTS |
| T18 | DATA_FLOW | base SQL path | descriptor `_load_tables` | RETAIN | DB-003/004,LIFE-001 | CG3/G08,G09/SR | READY_WITH_CONSTRAINTS |
| T19 | DATA_FLOW | RST-012 SQL path | `__DIR__/schema/rst012_report.sql` | RETAIN | DB-003/004,LIFE-003 | T17/CG3/G04,G09/SR | READY_WITH_CONSTRAINTS |
| T20 | DEPENDENCY | includes/runtime callers | inventoried call graph | GUARD | RT-011/014,DB-004 | CG3/G08-G10/SR | READY_WITH_CONSTRAINTS |
| T21 | INVARIANT | runtime OTP readiness | exact W4 detector | RETAIN | RT-011,SEC-AUTH-004,DB-003/004 | CG2-3/G05,G08 | READY |
| T22 | TRANSITION | activation auth schema | exact schema detector before ensure helpers | GUARD | DB-003/004,LIFE-001/003 | CG2-3/G05,G06/SR,DR | READY_WITH_CONSTRAINTS |
| T23 | INVARIANT | auth triggers/constraints/key | descriptor `ensure*` | RETAIN | RT-014,DB-003,LIFE-001 | T22/CG3/G05,G06,G08 | READY_WITH_CONSTRAINTS |
| T24 | RESPONSIBILITY | native remove/init | descriptor | DELEGATE | RT-014,LIFE-001/003 | T04-T23/CG3/G06,G08/SR | READY_WITH_CONSTRAINTS |
| T25 | INVARIANT | failure injection | attested descriptor branches | RETAIN | LIFE-002/003 | CG3/G06,G08/SR,DR | READY_WITH_CONSTRAINTS |
| T26 | RESPONSIBILITY | bootstrap/Admin | `bootstrap_poc.php` | RETAIN | RT-014,LIFE-001/004 | CG3/G06,G08/SR | READY |
| T27 | INVARIANT | retaining deactivation | native `_remove` | RETAIN | DB-004,LIFE-003 | CG3/G08/SR | READY |
| T28 | DEPENDENCY | disposable isolation | runner/sentinel/cleanup | RETAIN | LIFE-002 | CG1-4/G01-G07/DR | READY |
| T29 | GOVERNANCE | completion/status | W6 unauthorized | GUARD | all eight | CG4/G00-G10 | READY_WITH_CONSTRAINTS |
| T30 | W7_DEPENDENCY | wrapper removal | W7 candidate only | NONE | RT-002/004 | 0/0 dependency/G00 | READY |
| T31 | GOVERNANCE | architecture amendment check | frozen architecture unchanged | NONE | all | CG0/G00 | READY |
| T32 | GOVERNANCE | Engineering Standard amendment check | amended frozen Standard unchanged | NONE | all | CG0/G00 | READY |

Totals: 32 rows; `READY` 14; `READY_WITH_CONSTRAINTS` 17; `BLOCKED` 0;
`NOT_APPLICABLE` 1. Constrained rows resolve before affected W6 movement or
completion.

| Constrained rows | Before authorization | Before movement | Before cutover | Before completion |
| --- | --- | --- | --- | --- |
| T03,T04,T06-T08,T12,T14,T15,T18,T19,T20,T23,T24,T25 | NO | YES | YES | YES |
| T29 | NO | YES: requires a separate explicit W6 authorization | YES | YES |

### Canonical ledger field matrix

Authority abbreviations: `A17` = frozen architecture document 17; `P14` =
preservation ledger; `AR` = authority router; `D66/67` = DEC-066/067. Current
state is `VERIFIED_AT_HEAD` unless explicitly `DISCREPANCY`. `PRE`, `X`, and
`POST` mean pre-move, transition, and post-cutover. `N/A-0/0` means no frozen
dependency exists, with evidence stated in the row.

| ID | Type | Concern | Authority | Current evidence | Current state | Current owner | W6 target owner | W6 action | Preservation IDs | Depends on | Must precede | Cutover group | Behavior change allowed? | Verification gates | Transition | Rollback / recovery | W7 dependency | Status | Constraint / blocker |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | GOVERNANCE | frozen boundary | AR,A17 | verified hashes/status | VERIFIED_AT_HEAD | authority router | same | GUARD | all | none | T03-T32 | CG0 | NO | G00 | PRE/POST | doc revert | none | READY | none |
| T02 | DEPENDENCY | W5 baseline | D66/67,A17 | HEAD parent `2b05a78` | VERIFIED_AT_HEAD | W5 owners | none | NONE | RT-010/012 | none | T03 | CG0 | NO | G00 | PRE | N/A | N/A-0/0: W6 names no W5 product | NOT_APPLICABLE | no frozen W5 product |
| T03 | RESPONSIBILITY | descriptor orchestration | A17 | `modMjlFinancement::init` | VERIFIED_AT_HEAD | descriptor | thin descriptor + delegated current-path lifecycle owner | DELEGATE | RT-011,DB-004,LIFE-003 | T04-T25 | T29 | CG3 | NO | G08-G10 | X | SR | none | READY_WITH_CONSTRAINTS | G01-G09 before movement |
| T04 | TRANSITION | clean install | A17,P14 | descriptor clean branch | VERIFIED_AT_HEAD | descriptor | delegated lifecycle owner | DELEGATE | DB-003/004,LIFE-001/003 | T05,T18,T22,T26 | T03 | CG2/3 | NO | G06,G08 | PRE/X/POST | SR/DR | none | READY_WITH_CONSTRAINTS | T05 descriptor-matrix blocker first |
| T05 | TRANSITION | current reactivation and descriptor state matrix | A17,P14 | clean/current/older/partial/unknown fingerprint and lock-release characterization | VERIFIED_AT_HEAD | descriptor | delegated lifecycle owner | DELEGATE | RT-011,DB-004,LIFE-003 | T21-T24 | T03 | CG2/3 | NO | G05,G06,G08 | PRE/X/POST | SR/DR | none | READY_WITH_CONSTRAINTS | BLK-04 closed; preserve G06 through movement |
| T06 | TRANSITION | older-state refusal | A17,P14 | RST-006A/B guarded refusal | DISCREPANCY | descriptor | delegated lifecycle owner | DELEGATE | RT-011,DB-004,LIFE-003 | T05,T11,T12 | T03 | CG2/3 | NO | G01,G02,G06 | PRE/X/POST | SR/DR | none | READY_WITH_CONSTRAINTS | T05/T11 first |
| T07 | TRANSITION | malformed-state refusal | A17,P14 | descriptor fallback | DISCREPANCY | descriptor | delegated lifecycle owner | DELEGATE | RT-011,DB-003/004,LIFE-003 | T05,T14-T17 | T03 | CG2/3 | NO | G03-G06 | PRE/X/POST | SR/DR | none | READY_WITH_CONSTRAINTS | T05/T17 first |
| T08 | INVARIANT | lifecycle lock | A17,P14 | descriptor GET/RELEASE_LOCK | VERIFIED_AT_HEAD | descriptor | delegated lifecycle owner | DELEGATE | DB-004,LIFE-003 | T04-T07 | T29 | CG3 | NO | G06,G08 | X | SR | none | READY_WITH_CONSTRAINTS | prove release before movement |
| T09 | INVARIANT | guarded diagnostic | A17 | error/log/stderr | VERIFIED_AT_HEAD | descriptor | descriptor boundary | RETAIN | RT-011,LIFE-003 | T06,T07 | T29 | CG3 | NO | G06,G08 | X | SR | none | READY | diagnostics may improve only |
| T10 | DEPENDENCY | BC-020 | A17,W0 | timeout exit-zero regression | VERIFIED_AT_HEAD | runner | runner | RETAIN | LIFE-002 | none | T11,T12 | CG1 | NO | G07 | PRE/POST | SR | none | READY | fixed in W0 |
| T11 | DEPENDENCY | historical predecessor profiles | A17 | narrow profiles provision and exact-verify RST-002B/RST-006A | VERIFIED_AT_HEAD | runner/bootstrap | runner-owned explicit profiles | GUARD | DB-003/004,LIFE-002/003 | T10 | T12,T14,T15 | CG1 | NO | G01,G02,G07 | PRE | SR/DR | none | READY | BLK-01 closed; broad `MJL_TEST_MODE` remains outside the container |
| T12 | DEPENDENCY | RST-006A predecessor | A17 | narrow exact profile | VERIFIED_AT_HEAD | runner/bootstrap | runner-owned explicit profile | GUARD | DB-003/004,LIFE-002/003 | T11 | T15 | CG1 | NO | G02,G07 | PRE | SR/DR | none | READY | preserve exact verification |
| T13 | RESPONSIBILITY | RST-005 tooling | A17 | retained scripts/launcher | VERIFIED_AT_HEAD | RST-005 tooling | same | RETAIN | DB-003/004,LIFE-003 | none | T14 | none | NO | G08,G09 | PRE/POST | N/A | none | READY | must not move |
| T14 | RESPONSIBILITY | RST-002B lifecycle | A17,P14 | exact library + guarded CLI | VERIFIED_AT_HEAD | current library/CLI | same behind delegation | DELEGATE | RT-011,DB-003/004,LIFE-003 | T11 | T03 | CG3 | NO | G01,G08 | X | SR/DR | none | READY_WITH_CONSTRAINTS | T11 first |
| T15 | RESPONSIBILITY | RST-006A lifecycle | A17,P14 | exact library + guarded CLI | VERIFIED_AT_HEAD | current library/CLI | same behind delegation | DELEGATE | RT-011,DB-003/004,LIFE-003 | T12 | T03 | CG3 | NO | G02,G08 | X | SR/DR | none | READY_WITH_CONSTRAINTS | T12 first |
| T16 | RESPONSIBILITY | RST-006B lifecycle | A17,P14 | exact full prefix matrix | VERIFIED_AT_HEAD | current library/CLI | same behind delegation | DELEGATE | RT-011,DB-003/004,LIFE-003 | none | T03 | CG3 | NO | G03,G08 | X | SR/DR | none | READY | preserve BC-019 |
| T17 | RESPONSIBILITY | RST-012 lifecycle | A17,P14 | four exact interruption/resume/rollback boundaries plus mutation-free malformed refusal | VERIFIED_AT_HEAD | current library/CLI | same behind delegation | DELEGATE | RT-011,DB-003/004,LIFE-003 | none | T03,T19 | CG2/3 | NO | G04,G08 | PRE/X/POST | SR/DR | none | READY_WITH_CONSTRAINTS | BLK-03 closed; retain matrix through movement |
| T18 | DATA_FLOW | base SQL resource | A17 | `/mjlfinancement/sql/` | VERIFIED_AT_HEAD | descriptor/native loader | same | RETAIN | DB-003/004,LIFE-001 | T04 | T03 | CG3 | NO | G08,G09 | X | SR | none | READY_WITH_CONSTRAINTS | loading proof before movement |
| T19 | DATA_FLOW | RST-012 SQL resource | A17 | `schema/rst012_report.sql` | VERIFIED_AT_HEAD | RST-012 library | same | RETAIN | DB-003/004,LIFE-003 | T17 | T03 | CG3 | NO | G04,G09 | X | SR | none | READY_WITH_CONSTRAINTS | resource proof before movement |
| T20 | DEPENDENCY | includes/runtime callers | A17 | enumerated detector consumers | VERIFIED_AT_HEAD | current callers/includes | same call graph to delegated owner | GUARD | RT-011/014,DB-004 | T14-T19 | T29 | CG3 | NO | G08-G10 | X | SR | none | READY_WITH_CONSTRAINTS | exact source closure |
| T21 | INVARIANT | runtime OTP readiness | W4,P14 | exact schema detector | VERIFIED_AT_HEAD | auth library | same | RETAIN | RT-011,SEC-AUTH-004,DB-003/004 | none | T22 | CG2/3 | NO | G05,G08 | PRE/POST | SR | none | READY | normal runtime exact |
| T22 | TRANSITION | activation auth schema | A17,P14 | schema-only exact detector runs before ensure helpers; weak states refuse mutation-free and missing key initialization remains intact | VERIFIED_AT_HEAD | descriptor plus auth detector | delegated exact refusal | GUARD | DB-003/004,LIFE-001/003 | T21 | T03,T23 | CG2/3 | NO | G05,G06 | PRE/X/POST | SR/DR | none | READY_WITH_CONSTRAINTS | BLK-02 closed; no schema repair path added |
| T23 | INVARIANT | auth trigger/constraint/key order | P14 | descriptor ensure helpers | VERIFIED_AT_HEAD | descriptor | delegated lifecycle owner | RETAIN | RT-014,DB-003,LIFE-001 | T22 | T03 | CG3 | NO | G05,G06,G08 | X | SR | none | READY_WITH_CONSTRAINTS | activation exactness first |
| T24 | RESPONSIBILITY | native remove/init sequence | A17,P14 | descriptor `_remove/_init` | VERIFIED_AT_HEAD | descriptor | descriptor orchestration | DELEGATE | RT-014,LIFE-001/003 | T04-T23 | T29 | CG3 | NO | G06,G08 | X | SR | none | READY_WITH_CONSTRAINTS | reactivation oracle first |
| T25 | INVARIANT | disposable failure injection | A17,P14 | two attested branches | VERIFIED_AT_HEAD | descriptor/test runner | same | RETAIN | LIFE-002/003 | T04 | T29 | CG3 | NO | G06,G08 | X | SR/DR | none | READY_WITH_CONSTRAINTS | no production selector |
| T26 | RESPONSIBILITY | bootstrap/Admin/native disablement | P14 | `bootstrap_poc.php` | VERIFIED_AT_HEAD | bootstrap | same | RETAIN | RT-014,LIFE-001/004 | T04,T24 | T29 | CG3 | NO | G06,G08 | X | SR | none | READY | order unchanged |
| T27 | INVARIANT | retaining deactivation | P14 | descriptor `_remove` | VERIFIED_AT_HEAD | descriptor/native module | same | RETAIN | DB-004,LIFE-003 | none | T29 | CG3 | NO | G08 | X | SR | none | READY | no table drops |
| T28 | DEPENDENCY | disposable isolation | P14 | sentinel, evidence, cleanup | VERIFIED_AT_HEAD | runner/fixtures | same | RETAIN | LIFE-002 | T10-T12 | G01-G07 | CG1-4 | NO | G01-G07 | PRE/POST | DR | none | READY | no shared tenant |
| T29 | GOVERNANCE | completion/status | AR,A17 | W6 unauthorized | VERIFIED_AT_HEAD | authority router/roadmap | same | GUARD | all eight | T03-T28 | none | CG4 | NO | G00-G10 | POST | doc/source correction | none | READY_WITH_CONSTRAINTS | later authorization + all gates |
| T30 | W7_DEPENDENCY | residual wrapper removal | A17 | W7 candidate-specific | VERIFIED_AT_HEAD | W7 future decision | none in W6 | NONE | RT-002/004 | none | none | none | NO | G00 | PRE | N/A | N/A-0/0: no W6 artifact named | READY | W7 unauthorized |
| T31 | GOVERNANCE | architecture amendment check | AR,A17 | scope fits frozen W6; hash exact | VERIFIED_AT_HEAD | frozen architecture | same | NONE | all | T01 | T29 | CG0 | NO | G00 | PRE/POST | doc correction | none | READY | amendment required: NO |
| T32 | GOVERNANCE | Engineering Standard amendment check | AR,Standard | DEC-066 hash exact; no conflict | VERIFIED_AT_HEAD | frozen Standard | same | NONE | all | T01 | T29 | CG0 | NO | G00 | PRE/POST | doc correction | none | READY | amendment required: NO |

## Preservation and ownership reconciliation

| Classification | IDs | Count |
| --- | --- | --- |
| DIRECTLY_AFFECTED | RT-011, DB-003, DB-004, LIFE-003 | 4 |
| INDIRECTLY_AT_RISK | RT-014, LIFE-001, LIFE-002, LIFE-004 | 4 |
| NOT_TOUCHED | RT-001-010, RT-012-013, RT-015, SEC-AUTH-001-006, SEC-AUTHZ-001-004, SEC-DOC-001-002, DB-001-002 | 27 |

Total: 35/35. No HTTP route, frontend contract, authorization meaning,
business-audit event, report/export owner, monitoring owner, runtime query, or
transaction owner moves. DDL remains resumable rather than atomic; source
rollback never represents DDL reversal. Dolibarr `_load_tables`, `_init`,
`_remove`, `activateModule`, prefix, lock, and bootstrap-only disablement remain.

### Per-requirement preservation proof

| Preservation ID | Classification | Ledger IDs | Current enforcement | W6 target enforcement | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- |
| RT-001 | NOT_TOUCHED | none | existing route loaders | no route change | G00 source exclusion | MAPPED |
| RT-002 | NOT_TOUCHED | none | existing route guards | no route change | G00 source exclusion | MAPPED |
| RT-003 | NOT_TOUCHED | none | existing CSRF guards | no route/POST change | G00 source exclusion | MAPPED |
| RT-004 | NOT_TOUCHED | none | command reauthorization | no command change | G00 source exclusion | MAPPED |
| RT-005 | NOT_TOUCHED | none | Activity aggregate | no workflow change | G00 source exclusion | MAPPED |
| RT-006 | NOT_TOUCHED | none | workflow commands/DB guards | unchanged | G00 source exclusion | MAPPED |
| RT-007 | NOT_TOUCHED | none | server financial invariants | unchanged | G00 source exclusion | MAPPED |
| RT-008 | NOT_TOUCHED | none | command version checks | unchanged | G00 source exclusion | MAPPED |
| RT-009 | NOT_TOUCHED | none | exception commands/reconciler | unchanged | G00 source exclusion | MAPPED |
| RT-010 | NOT_TOUCHED | T02 only | W2 monitoring-read | unchanged W5 baseline | G00 ownership search | MAPPED |
| RT-011 | DIRECTLY_AFFECTED | T03-T09,T14-T22 | exact readiness/refusal | same exact detectors behind delegation | G01-G06,G08-G09 | MAPPED |
| RT-012 | NOT_TOUCHED | T02 only | W5 export owner/snapshot | unchanged | G00 ownership search | MAPPED |
| RT-013 | NOT_TOUCHED | none | deny-only document routes | unchanged | G00 source exclusion | MAPPED |
| RT-014 | INDIRECTLY_AT_RISK | T20,T23,T24,T26 | native module/auth adapters | same adapter boundaries/order | G05-G06,G08 | MAPPED |
| RT-015 | NOT_TOUCHED | none | current reconciler/cron | unchanged; cron excluded | G00 source exclusion | MAPPED |
| SEC-AUTH-001 | NOT_TOUCHED | none | W4 auth command/policy | unchanged | G00/G05 exclusion guard | MAPPED |
| SEC-AUTH-002 | NOT_TOUCHED | none | W4 selector/verifier storage | unchanged | G00/G05 exclusion guard | MAPPED |
| SEC-AUTH-003 | NOT_TOUCHED | none | W4 reset behavior | unchanged | G05 focused regression only | MAPPED |
| SEC-AUTH-004 | NOT_TOUCHED | T21 | exact OTP readiness | same exact runtime detector; verification guard only | G05 | MAPPED |
| SEC-AUTH-005 | NOT_TOUCHED | none | native-login hook | unchanged | G05 focused regression only | MAPPED |
| SEC-AUTH-006 | NOT_TOUCHED | none | private password adapter | unchanged | G05 focused regression only | MAPPED |
| SEC-AUTHZ-001 | NOT_TOUCHED | none | access policy/effective roles | unchanged | G00 source exclusion | MAPPED |
| SEC-AUTHZ-002 | NOT_TOUCHED | none | access command | unchanged | G00 source exclusion | MAPPED |
| SEC-AUTHZ-003 | NOT_TOUCHED | none | assignment/scope owners | unchanged | G00 source exclusion | MAPPED |
| SEC-AUTHZ-004 | NOT_TOUCHED | none | layered guards/DB invariants | no semantic change | G00/G05/G06 | MAPPED |
| SEC-DOC-001 | NOT_TOUCHED | none | deny-only document routes | unchanged | G00 source exclusion | MAPPED |
| SEC-DOC-002 | NOT_TOUCHED | none | raw ECM denial | unchanged | G00 source exclusion | MAPPED |
| DB-001 | NOT_TOUCHED | none | entity filters/DB rules | unchanged | G00 source exclusion | MAPPED |
| DB-002 | NOT_TOUCHED | none | audit/transaction owners | unchanged | G00 source exclusion | MAPPED |
| DB-003 | DIRECTLY_AFFECTED | T04,T07,T11-T19,T21-T23 | exact schema definitions | retained exact definitions/current paths | G01-G06,G08-G09 | MAPPED |
| DB-004 | DIRECTLY_AFFECTED | T03-T08,T11-T20,T22,T27 | exact guarded lifecycle | same classifiers/installers/guards | G01-G06,G08-G09 | MAPPED |
| LIFE-001 | INDIRECTLY_AT_RISK | T04,T18,T22-T24,T26 | clean bootstrap/one Admin | same clean orchestration | G05-G06,G08-G09 | MAPPED |
| LIFE-002 | INDIRECTLY_AT_RISK | T10-T12,T25,T28 | disposable runner/teardown | same isolation plus exact profiles | G01-G07 | MAPPED |
| LIFE-003 | DIRECTLY_AFFECTED | T03-T19,T22-T25,T27 | descriptor classifiers | one delegated exact classifier | G01-G06,G08-G09 | MAPPED |
| LIFE-004 | INDIRECTLY_AT_RISK | T26 | bootstrap-only disablement | unchanged bootstrap owner/order | G06,G08 | MAPPED |

### Exact coverage inventories

| Coverage | Enumerated denominator | Result |
| --- | --- | --- |
| Authoritative scope | delegation; current paths; no DDL; no state change; guarded entrypoints; SQL paths; exact prerequisites; preservation; rollback; exit | 10/10 |
| Current responsibilities | ledger T03-T27 | 25/25 |
| Target responsibilities | ledger T03-T27 | 25/25 |
| Route/action | bootstrap/descriptor activation; RST-002B CLI; RST-006A CLI; RST-006B CLI; RST-012 CLI | 5/5 |
| DB/query/write | lock; clean SQL load; RST-002B; RST-006A; RST-006B; RST-012; auth schema; native init/remove | 8/8 |
| Transaction/lifecycle atomicity | named lock; resumable implicit-commit DDL; source rollback boundary | 3/3 |
| Frontend | `NO_FRONTEND_CONTRACT_CHANGE` — no frontend producer or consumer is in frozen W6; W5 left CSS/JS unchanged | 0/0 |
| Dolibarr seams | `_load_tables`; `_init`; `_remove`; `activateModule`; `$db->prefix`; GET/RELEASE_LOCK; native dependencies; bootstrap-only disablement | 8/8 |
| Preservation | the 35 rows above | 35/35 |
| Verification | G00-G10 | 11/11 |
| Cutover | CG0-CG4 | 5/5 |
| W7 dependencies | no frozen W6-produced artifact | 0/0 |
| Exclusions | the 24 individually evidenced exclusion-ledger rows | 24/24 |

### Request, ownership, database, and failure views

| View | PRE | TRANSITION | POST |
| --- | --- | --- | --- |
| Descriptor activation | descriptor owns orchestration + embedded ensures | one atomic source switch; no dual classifier | descriptor declares/orchestrates; delegated current-path owner executes |
| Guarded CLI actions | each RST CLI owns apply/verify/rollback | unchanged, used only for disposable evidence | same entrypoints and guards |
| Runtime detector calls | existing Activity/auth/report/monitoring callers | only changed callers switch atomically if necessary | same outcomes through retained exact detectors |
| Database writes | current guarded DDL/installers | exact same statements/order; no new transaction owner | same schema and resumable states |
| Errors | detector/descriptor fail closed | descriptor preserves `-1`, log, stderr | same public/operational results; diagnostics may be clearer |

Request simulation: bootstrap -> `activateModule` -> descriptor -> named lock ->
exact classifier/installer -> native initialization -> lock release. This is
`EQUIVALENT_WITH_JUSTIFICATION`: one delegation call is introduced, while
guards, states, effects, and results remain identical.

Failure simulation: lock contention returns failure; exact predecessor requests
guarded migration; known disposable prefixes resume only through their CLI;
unknown/malformed states refuse before mutation; any thrown error is logged and
returns `-1`; `finally` releases the lock. This becomes proven, rather than
source-inferred, only after G01-G09.

#### Request/action ownership

No HTTP request, frontend action, or user-selected callback is affected. The
operational actions below are the complete W6 action population.

| Ledger ID | Endpoint/root | Method | Action | PRE owner | TRANSITION owner | POST owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T03-T09,T22-T27 | `bootstrap_poc.php` -> module descriptor | CLI / `init()` | activate/reactivate | descriptor | one atomic descriptor-to-lifecycle delegation | descriptor entry + delegated lifecycle owner | TARGET_OWNED |
| T11,T14 | `rst002b_activity_assignment.php` | CLI apply/verify/rollback | RST-002B transition | guarded CLI/library | unchanged | guarded CLI/library | LEGACY_RETAINED |
| T12,T15 | `rst006a_activity_planning.php` | CLI apply/verify/rollback | RST-006A transition | guarded CLI/library | unchanged | guarded CLI/library | LEGACY_RETAINED |
| T16 | `rst006b_execution.php` | CLI apply/verify/rollback | RST-006B transition | guarded CLI/library | unchanged | guarded CLI/library | LEGACY_RETAINED |
| T17,T19 | `rst012_export_schema.php` | CLI apply/verify/rollback/prefix | RST-012 transition | guarded CLI/library | unchanged | guarded CLI/library | LEGACY_RETAINED |

#### Current-owner reconciliation

| Responsibility | Current owner evidence | Classification | Reason / required action |
| --- | --- | --- | --- |
| activation orchestration | descriptor `init()` | CONFIRMED | embedded and reachable; W6 target is delegation |
| clean/current/older/unknown classification | descriptor + exact RST libraries | CONFIRMED | focused fingerprint/refusal/lock matrix now maintained |
| RST-002B transition | retained library/CLI | CONFIRMED | narrow profile provisions and exact-verifies the predecessor |
| RST-006A transition | retained library/CLI | CONFIRMED | narrow profile provisions and exact-verifies the predecessor |
| RST-006B transition | retained library/CLI | CONFIRMED | exact maintained matrix exists |
| RST-012 transition | retained library/CLI | CONFIRMED | four interruption prefixes, resume, rollback, and malformed refusal maintained |
| runtime OTP readiness | `mjl_auth_otp_table_ready()` | CONFIRMED | exact read-only detector and W4 refusal proof |
| activation OTP readiness | descriptor + exact auth detector | CONFIRMED | weakened existing table refuses before ensure helpers |
| lifecycle lock/error boundary | descriptor | CONFIRMED | GET/RELEASE lock and catch/finally mapped |
| native initialization/deactivation | descriptor + Dolibarr module base | CONFIRMED | `_init/_remove` order mapped |
| bootstrap/native disablement | `bootstrap_poc.php` | CONFIRMED | bootstrap-only owner mapped |
| runtime detector consumers | Activity/auth/report/monitoring owners | CONFIRMED | call sites inventoried; change only in atomic closure |
| SQL/include/resource loading | descriptor and retained libraries | CONFIRMED | both SQL roots and include model mapped; G09 protects |
| runner profiles/isolation | runner + disposable fixtures | CONFIRMED | only named lifecycle profiles enter the disposable container |

#### PRE / TRANSITION / POST owner roles

| Concern | State | Authoritative owner | Authorization owner | Read owner | Write owner | Transaction owner | Presentation owner | Audit owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| descriptor activation | PRE | descriptor | CLI/bootstrap guard + Dolibarr activation | descriptor/exact libraries | descriptor/exact installers | named lifecycle lock; native DB semantics | none | technical `dol_syslog`; no business event |
| descriptor activation | TRANSITION | exactly one delegated lifecycle owner behind descriptor | unchanged | retained exact libraries | retained exact installers | unchanged named lock | none | unchanged technical log |
| descriptor activation | POST | descriptor entry + delegated lifecycle owner | unchanged | retained exact libraries | retained exact installers | unchanged named lock | none | unchanged technical log |
| guarded migrations | PRE/TRANSITION/POST | each guarded CLI/library | CLI guard + confirmation + tenant attestation | exact detector | exact installer/rollback | CLI-owned lock/DDL semantics | CLI text only | technical output; no business event |
| runtime readiness | PRE/TRANSITION/POST | existing Activity/auth/report/monitoring caller plus exact detector | existing route/command policy | existing read owner | none | existing bounded read transaction where applicable | existing W2/W4/W5 owner | existing W2/W4/W5 owner |

At no reachable state is there an unowned or independently dual-executed
mutation. Authorization impact is `STRUCTURAL_OWNERSHIP_CHANGE` for descriptor
delegation and `NONE` elsewhere; semantic authorization change is forbidden.
Effective roles, four-role vocabulary, entity isolation, Activity assignment,
Admin behavior, no-self-validation, and resource scope remain unchanged.

#### Database / query / write view

| Ledger ID | Table/query/write | Current owner | Target owner | Impact | Transaction owner | Compatibility | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T08 | `GET_LOCK`/`RELEASE_LOCK` | descriptor | delegated lifecycle under descriptor | NONE | descriptor lifecycle | exact name/scope/order | READY_WITH_CONSTRAINTS |
| T04,T18 | native bulk SQL load | descriptor + `_load_tables` | same through delegation | NONE | native loader/implicit DDL | byte/path identical | READY_WITH_CONSTRAINTS |
| T11,T14 | RST-002B DDL/detector queries | retained library/CLI | same | NONE | guarded CLI; implicit DDL | exact predecessor/prefix | READY_WITH_CONSTRAINTS |
| T12,T15 | RST-006A DDL/detector queries | retained library/CLI | same | NONE | guarded CLI; implicit DDL | exact predecessor/prefix | READY_WITH_CONSTRAINTS |
| T16 | RST-006B DDL/detector queries | retained library/CLI | same | NONE | guarded CLI; implicit DDL | full matrix retained | READY |
| T17,T19 | RST-012 table/triggers/resource | retained library/CLI | same | NONE | guarded CLI; implicit DDL | exact prefix/resource | READY_WITH_CONSTRAINTS |
| T21,T22,T23 | OTP/auth definitions and key | descriptor + auth detector | exact detector + delegated lifecycle | NONE | activation lifecycle/native DB | no repair/new DDL | READY_WITH_CONSTRAINTS |
| T24,T27 | native module metadata/init/remove | descriptor/native module | same through thin descriptor | NONE | native Dolibarr | exact call order/data retention | READY_WITH_CONSTRAINTS |

No query, read, write, transaction, or schema ownership change is authorized.

#### Transaction ownership

| Concern | Current / target transaction owner | Begin | Commit | Rollback | Native depth interaction | Business audit relationship |
| --- | --- | --- | --- | --- | --- | --- |
| lifecycle serialization | descriptor / delegated lifecycle under descriptor | `GET_LOCK` | N/A | `RELEASE_LOCK` in `finally` | outside business transactions | none |
| lifecycle DDL | each retained installer / same | MariaDB implicit statement boundary | implicit DDL commit | guarded resume/empty rollback, never source revert | unchanged | none |
| native module initialization | Dolibarr `_init/_remove` / same | native Dolibarr | native Dolibarr | native Dolibarr | preserve native transaction depth | module metadata, not MJL business audit |
| auth activation ensures | descriptor / delegated lifecycle | current DB semantics | current DB semantics | fail closed; no invented repair rollback | unchanged | none |
| W2/W4/W5 runtime reads | existing owners / unchanged | existing checked begin | existing checked commit | existing failure contract, including DEC-066 | unchanged | existing audit/export meaning unchanged |

Failed begin remains fail-closed; failed commit cannot report success; rollback
failure remains surfaced under its existing owner; native depth exceptions and
DEC-066 generic preview 503 behavior remain unchanged.

DEC-066 classification: `MUST_REMAIN_UNCHANGED`. W6 does not own or change the
read-only report/audit preview path, so no W6 runtime gate falsely claims to
re-prove its 503/budget oracle. The existing W5 evidence remains the baseline;
touching that path is a scope breach requiring a new review and its own focused
regression gate.

DEC-067 reconciliation: W5 established the report/audit handler-read-
presentation split, export-delivery seam, W2 monitoring-read consumers, and
retained `MjlMonitoring`/durable-export/shared Operation owners. This maps to
T02 as an explicit non-dependency, T20 as a caller-closure guard, T21 as a
retained runtime detector pattern, and T29/T31/T32 as governance guards. It is
not permission for reporting, monitoring, frontend, or cleanup work.

#### Failure and audit ownership

| Failure class | Current owner | Target owner | Preserved result / gate |
| --- | --- | --- | --- |
| validation failure | exact detector/CLI parser | same | refuse before mutation; G01-G06 |
| authorization failure | CLI/bootstrap guard or existing route policy | same | deny/refuse; G01-G06 |
| DB failure | retained installer/descriptor boundary | retained installer -> descriptor boundary | `-1`, log/stderr, no false success; G04-G06 |
| transaction failure | current native/read/CLI owner | same | existing rollback/result contract; G03-G06 |
| business rejection | existing command owner | unchanged/not W6 | exact current result; G00 exclusion |
| not-found | existing route/read owner | unchanged/not W6 | exact current result; G00 exclusion |
| unexpected exception | descriptor catch + `dol_syslog` | descriptor boundary | failure, no exception leakage; G06 |
| legacy delegation failure | descriptor/include/resource loader | thin descriptor boundary | fail closed; G08-G09 |

Business audit impact is `NOT_APPLICABLE`: W6 moves no business mutation or
auditable action, actor/context/details, or transaction-bound event. Existing
W2-W5 audit and export-evidence owners remain unchanged; technical lifecycle
logging does not replace them.

## Dependency DAG, cutover, and recovery

```text
CG0 authority/baseline
  -> CG1 exact historical predecessor provisioning (BLK-01)
  -> CG2 pre-move lifecycle evidence (BLK-02/03/04)
  -> CG3 one atomic descriptor delegation/source closure
  -> CG4 focused regression, reviews, status, stop before W7
```

| Group | Content | Coexistence/recovery |
| --- | --- | --- |
| CG0 | T01-T02 | safe; documentation revert |
| CG1 | T10-T12,T28 | test-only safe coexistence; source revert + disposable teardown |
| CG2 | T04-T07,T17,T21-T23 | evidence only; source/test revert + disposable teardown |
| CG3 | T03,T08-T09,T13-T27 | NO_COEXISTENCE; revert complete source group; guarded disposable resume/rollback only |
| CG4 | T29-T30 | correct source and rerun; never rewrite DB history |

There are no cycles, unowned states, planned dual-authority states, or database
restore requirements. A partial CG3 source revert is not credible.

### Per-row coexistence view

| Ledger ID | PRE owner | TRANSITION owner | POST owner | Coexistence | Cutover condition | Legacy disposition | Atomic group |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T03 | descriptor | single delegated owner behind descriptor | thin descriptor + delegated owner | NO_COEXISTENCE | G01-G09 pass | embedded implementation RETIRED | CG3 |
| T04 | descriptor clean branch | delegated exact clean orchestration | delegated owner | COEXISTENCE_WITH_CONSTRAINTS | G06 pass | old branch RETIRED atomically | CG2/3 |
| T05 | descriptor current branch | delegated exact reactivation | delegated owner | COEXISTENCE_WITH_CONSTRAINTS | G05/G06 pass | old branch RETIRED atomically | CG2/3 |
| T06 | descriptor refusal | delegated exact refusal | delegated owner | COEXISTENCE_WITH_CONSTRAINTS | G01/G02/G06 pass | old branch RETIRED atomically | CG2/3 |
| T07 | descriptor fallback | delegated exact refusal | delegated owner | COEXISTENCE_WITH_CONSTRAINTS | G03-G06 pass | old fallback RETIRED atomically | CG2/3 |
| T08 | descriptor lock | one delegated call under same lock | delegated lifecycle lock | NO_COEXISTENCE | G06/G08 pass | old lock block RETIRED atomically | CG3 |
| T09 | descriptor diagnostic | same boundary | descriptor boundary | SAFE_TEMPORARY_COEXISTENCE | source switch complete | compatible diagnostic retained | CG3 |
| T10 | runner | runner | runner | SAFE_TEMPORARY_COEXISTENCE | G07 pass | W0 behavior RETAINED | CG1 |
| T11 | no exact profile | one test-only profile | runner profile | SAFE_TEMPORARY_COEXISTENCE | G01/G07 pass | ad-hoc baseline RETIRED | CG1 |
| T12 | unreachable selector | one test-only profile | runner profile | SAFE_TEMPORARY_COEXISTENCE | G02/G07 pass | ad-hoc baseline RETIRED | CG1 |
| T13 | RST-005 tooling | unchanged | unchanged | SAFE_TEMPORARY_COEXISTENCE | source inventory clean | RETAINED | none |
| T14 | RST-002B library/CLI | unchanged behind delegation | same | NO_COEXISTENCE | T11 + G01/G08 | RETAINED | CG3 |
| T15 | RST-006A library/CLI | unchanged behind delegation | same | NO_COEXISTENCE | T12 + G02/G08 | RETAINED | CG3 |
| T16 | RST-006B library/CLI | unchanged behind delegation | same | NO_COEXISTENCE | G03/G08 | RETAINED | CG3 |
| T17 | RST-012 library/CLI | unchanged behind delegation | same | COEXISTENCE_WITH_CONSTRAINTS | G04/G08 | RETAINED | CG2/3 |
| T18 | native SQL loader | unchanged call through delegate | same | NO_COEXISTENCE | G09 | RETAINED | CG3 |
| T19 | RST-012 resource owner | unchanged | unchanged | NO_COEXISTENCE | G04/G09 | RETAINED | CG3 |
| T20 | current callers/includes | atomic caller closure | updated callers/retained includes | NO_COEXISTENCE | G08/G09 | old references RETIRED | CG3 |
| T21 | auth runtime detector | unchanged | unchanged | SAFE_TEMPORARY_COEXISTENCE | G05 | RETAINED | CG2/3 |
| T22 | descriptor weak activation check | delegated exact refusal | exact lifecycle owner | NO_COEXISTENCE | G05/G06 | weak acceptance RETIRED | CG2/3 |
| T23 | descriptor auth ensures | unchanged order through delegate | delegated owner | NO_COEXISTENCE | T22 + G05/G06 | embedded owner RETIRED atomically | CG3 |
| T24 | descriptor native calls | same calls around delegate | thin descriptor | NO_COEXISTENCE | G06/G08 | embedded orchestration RETIRED | CG3 |
| T25 | attested injection branches | unchanged | unchanged | SAFE_TEMPORARY_COEXISTENCE | G06/G08 | RETAINED test-only | CG3 |
| T26 | bootstrap | unchanged | unchanged | SAFE_TEMPORARY_COEXISTENCE | G06/G08 | RETAINED | CG3 |
| T27 | descriptor `_remove` | unchanged | unchanged | SAFE_TEMPORARY_COEXISTENCE | G08 | RETAINED | CG3 |
| T28 | disposable runner | exact profiles added | runner + profiles | SAFE_TEMPORARY_COEXISTENCE | G01-G07 | RETAINED | CG1-4 |
| T29 | status docs | docs update after gates | reconciled docs | SAFE_TEMPORARY_COEXISTENCE | G00-G10 pass | stale status RETIRED | CG4 |

### Per-row rollback / forward-recovery view

| Ledger ID | Persistent impact | Last safe rollback point | Rollback model | Backward-compatible? | Forward recovery | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T03 | none beyond existing lifecycle effects | before CG3 source switch | complete SR | YES | finish atomic switch | SOURCE_REVERT_WITH_CONSTRAINTS |
| T04 | existing clean-install DDL only | before first existing DDL; otherwise guarded resume | SR + DR, not DDL reversal | YES by exact states | resume existing installer | SOURCE_REVERT_WITH_CONSTRAINTS |
| T05 | module metadata/trigger replacement | before reactivation | complete SR | YES | rerun exact reactivation | SOURCE_REVERT_WITH_CONSTRAINTS |
| T06 | none on refusal | before source switch | SR | YES | correct classifier | SOURCE_REVERT_SAFE |
| T07 | none on refusal | before source switch | SR | YES | correct classifier | SOURCE_REVERT_SAFE |
| T08 | advisory DB lock only | before source switch | SR; `finally` release | YES | correct lock owner | SOURCE_REVERT_SAFE |
| T09 | log/diagnostic only | before source switch | SR | YES | correct diagnostic | SOURCE_REVERT_SAFE |
| T10 | none | before runner change | SR | YES | correct runner | SOURCE_REVERT_SAFE |
| T11 | disposable schema only | before profile provisioning | SR + DR | YES | rebuild disposable tenant | SOURCE_REVERT_SAFE |
| T12 | disposable schema only | before profile provisioning | SR + DR | YES | rebuild disposable tenant | SOURCE_REVERT_SAFE |
| T13 | none | N/A unchanged | N/A | YES | N/A | SOURCE_REVERT_SAFE |
| T14 | existing guarded DDL in disposable matrix | before CG3; otherwise known prefix | SR + guarded DR | YES by maintained states | resume/rollback guarded CLI | SOURCE_REVERT_WITH_CONSTRAINTS |
| T15 | existing guarded DDL in disposable matrix | before CG3; otherwise known prefix | SR + guarded DR | YES by maintained states | resume/rollback guarded CLI | SOURCE_REVERT_WITH_CONSTRAINTS |
| T16 | existing guarded DDL in disposable matrix | before CG3; otherwise known prefix | SR + guarded DR | YES by maintained states | resume/rollback guarded CLI | SOURCE_REVERT_WITH_CONSTRAINTS |
| T17 | existing guarded DDL in disposable matrix | before CG3; otherwise known prefix | SR + guarded empty DR | YES by maintained states | resume installer | SOURCE_REVERT_WITH_CONSTRAINTS |
| T18 | existing clean DDL | before loader call | complete SR + guarded resume | YES | resume exact installer | SOURCE_REVERT_WITH_CONSTRAINTS |
| T19 | none from path itself | before source switch | SR | YES | correct resource reference | SOURCE_REVERT_SAFE |
| T20 | none | before atomic caller switch | complete SR | YES | finish caller/include closure | SOURCE_REVERT_WITH_CONSTRAINTS |
| T21 | none/read-only | N/A unchanged | N/A | YES | N/A | SOURCE_REVERT_SAFE |
| T22 | none on refusal; existing activation effects only | before CG3 | SR + rerun exact activation | YES | correct detector then reactivate | SOURCE_REVERT_WITH_CONSTRAINTS |
| T23 | existing auth definitions/key only | before CG3 | complete SR; no destructive reversal | YES | rerun exact ensures | SOURCE_REVERT_WITH_CONSTRAINTS |
| T24 | module metadata only | before native init/remove sequence | complete SR | YES | rerun native initialization | SOURCE_REVERT_WITH_CONSTRAINTS |
| T25 | disposable-only injected failure | before test run | SR + DR | YES | rebuild tenant | SOURCE_REVERT_SAFE |
| T26 | module metadata/native disablement | before bootstrap | SR; rerun documented bootstrap | YES | rerun bootstrap | SOURCE_REVERT_WITH_CONSTRAINTS |
| T27 | retained tables unchanged | before source switch | SR | YES | rerun native module operation | SOURCE_REVERT_SAFE |
| T28 | disposable volumes/artifacts | before run | SR + unconditional DR | YES | new disposable run | SOURCE_REVERT_SAFE |
| T29 | documentation only | before status commit | doc revert/correction | YES | correct and recommit | SOURCE_REVERT_SAFE |

## Verification matrix

These remain the known W6 execution paths. The prerequisite portions of
G01/G02/G04-G07 ran during this re-review; W6 movement gates remain future.

| Gate ID | Ledger IDs protected | Exact command/test | Oracle | Failure proven | Execution path | Stage | Environment | Mutation class | Blocking? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G00 | T01,T02,T29-T32 | `sha256sum docs/architecture-audit/17-target-architecture-proposal.md docs/mjl-engineering-standard-v1.md docs/architecture-audit/18-independent-architecture-review.md`; `git diff --check`; `git status --short`; `rg -n 'W6_(NOT_READY|READY_FOR_AUTHORIZATION|AUTHORIZED)|W6.*NOT_AUTHORIZED' docs` | exact hashes; no whitespace error; expected file set/status | authority drift or unauthorized file | host shell -> repository docs/Git | DOCUMENTATION_DIFF | host/read-only except authorized docs | DOCUMENTATION_ONLY | YES |
| G01 | T06,T11,T14,T28 | `npm run test:rst002b` | exact RST-002B predecessor first; 12 forward + 12 rollback points resume; malformed state leaves fingerprint unchanged | wrong predecessor, non-resumable prefix, mutation-before-refusal | npm -> `run-suite.js rst002b` -> disposable Compose -> CLI/verifier/E2E | PRE_MOVE_CHARACTERIZATION | isolated disposable tenant | TEST_DB_MUTATION | YES |
| G02 | T06,T12,T15,T28 | `npm run test:rst006a` | exact RST-006A predecessor first; 43 forward + 43 rollback points resume; malformed definitions leave fingerprint unchanged | wrong predecessor, prefix loss, weakened exact detector | npm -> runner `rst006a` -> disposable Compose -> CLI/verifier/E2E | PRE_MOVE_CHARACTERIZATION | isolated disposable tenant | TEST_DB_MUTATION | YES |
| G03 | T16,T28 | `npm run test:phase3a` | every maintained RST-006B prefix resumes/verifies/rolls back; exact mutations refuse | BC-019 regression or weak exact definition | npm -> runner `phase3a` -> disposable CLI + Playwright | POST_CUTOVER_REGRESSION | isolated disposable tenant | TEST_DB_MUTATION | YES |
| G04 | T07,T17,T19,T28 | `npm run test:rst012` | verified RST-006B predecessor; forward-001..004 report exact prefix, resume, verify and empty-rollback; malformed prefix is mutation-free | missing/broken RST-012 transition or resource | npm -> runner `rst012` -> existing RST-012 CLI | PRE_MOVE_CHARACTERIZATION and POST_CUTOVER_REGRESSION | isolated disposable tenant | TEST_DB_MUTATION | YES |
| G05 | T21-T23 | extended `npm run test:auth` | exact runtime/activation accepted; missing index/weakened check/current/older/partial states refuse without repair | BC-022 activation acceptance or auth-runtime drift | npm -> runner `auth` -> bootstrap/auth Playwright + DB fingerprint | PRE_MOVE_CHARACTERIZATION then POST_CUTOVER_REGRESSION | isolated disposable tenant | TEST_DB_MUTATION | YES |
| G06 | T04-T08,T22-T26 | descriptor cases under `npm run test:auth` | clean/current/older/partial/unknown exact result; before/after schema/trigger hash; lock released | descriptor state drift, mutation-before-refusal, lock leak | npm -> runner `auth` lifecycle setup -> bootstrap descriptor -> DB evidence | PRE_MOVE_CHARACTERIZATION then POST_CUTOVER_REGRESSION | isolated disposable tenant | TEST_DB_MUTATION | YES |
| G07 | T10-T12,T28 | `node --test tests/unit/disposable-run.test.js tests/unit/disposable-policy.test.js tests/unit/w6-lifecycle-profile.test.js` (third file added only by blocker-closing unit) | timeout sticky; only named profiles emitted; port 8080 rejected; teardown plan exact | broad mode leak, false timeout success, unsafe tenant | Node test runner -> runner/profile modules; no Compose | FOCUSED_IMPLEMENTATION | host temporary files only | TEST_FILESYSTEM_ONLY | YES if runner changes |
| G08 | T03-T27 | future `php tests/contracts/w6_lifecycle_ownership_test.php`; `php -l <each changed PHP>` | one orchestrator/schema authority; old embedded owners absent; signatures load; syntax valid | dual owner, duplicate schema model, broken PHP | host PHP contract -> source text/reflection; host syntax parser | FOCUSED_IMPLEMENTATION and POST_CUTOVER_REGRESSION | host/read-only | READ_ONLY | YES |
| G09 | T18-T20 | future `php tests/contracts/w6_lifecycle_loading_test.php` | every changed include/caller resolves; `/mjlfinancement/sql/` and `schema/rst012_report.sql` exist and remain referenced from their retained owners | broken include, callback, dynamic path, or SQL lookup | host PHP contract -> repository paths/source graph | PRE_MOVE_CHARACTERIZATION then POST_CUTOVER_REGRESSION | host/read-only | READ_ONLY | YES |
| G10 | T03,T20,T29 | independent review of `git diff <authorized-baseline>...HEAD` against AGENTS/Standard and W6 authorization | zero actionable Standards findings and zero Spec findings | standards breach or scope mismatch | committed diff -> independent Standards agent + independent Spec agent | POST_CUTOVER_REGRESSION | read-only repository review | READ_ONLY | YES |

Prerequisite execution evidence on 2026-10-09:

- G01: the exact RST-002B predecessor, full forward/rollback matrix, malformed
  recovery, and the 9-case current-target browser characterization passed in
  split disposable runs.
- G02: the exact RST-006A predecessor, all 43 forward and 43 rollback points,
  malformed-state checks, and the 42-case current-target browser
  characterization passed.
- G04: the focused `npm run test:rst012` gate passed the exact RST-006B
  predecessor, all four RST-012 interruption cycles, malformed-prefix refusal,
  final target verification, shared-state proof, and teardown. The 112-case
  Phase 3B browser suite remains separate regression coverage.
- G05/G06: `npm run test:auth` passed the descriptor matrix and 19/19 auth
  cases, including missing-index and weakened-check refusal before mutation.
- G07: the three focused Node files passed 29/29. PHP and Node syntax checks and
  `git diff --check` also passed.

G01, G02, G04, G05, and G06 are now maintained prerequisite gates. Runtime
refusal/cache/budget and include/loading/resource checkpoints for a changed call
graph are `MUST_ADD_BEFORE_MOVEMENT`; the final ownership contract is
`MUST_ADD_BEFORE_CUTOVER`.

Prior-wave dispositions: W4 auth/session and BC-019 are hard W6 gates; W2
readiness consumers, W5, DEC-066, and DEC-067 are focused regression guards;
W1, W3, BC-018, and reference transactions are not relevant. W2-RSK-007 and
BC-005 remain `DEFERRED`; BC-006 is a `W6_GUARD` addressed by named gates;
BC-007 is `NOT_RELEVANT` and its dormant shared-port test must not run.

### Residual-debt audit

| Debt / risk | Frozen authority | W6 relationship | Ledger IDs | Disposition | Blocks? |
| --- | --- | --- | --- | --- | --- |
| BC-005 aggregate unit stall | A17 | direct focused Node files avoid aggregate claim | T10,T28 | DEFER | NO |
| BC-006 incomplete discovery | A17 | every W6 gate names its path | T28,T29 | W6_GUARD | NO |
| BC-007 dormant shared-port test | A17 | not selected; prohibited to run | T28 | DEFER | NO |
| BC-020 timeout exit-zero | A17/W0 | fixed prerequisite to preserve | T10 | RETAIN | NO |
| BC-021 wrong historical baseline | A17 | exact named profiles and verification implemented | T06,T11,T12,T14,T15 | CLOSED | NO |
| BC-022 weak activation auth schema | A17/W4 evidence | exact activation refusal implemented | T21-T23 | CLOSED | NO |
| RST-012 missing matrix | A17 | exact maintained matrix implemented | T07,T17,T19 | CLOSED | NO |
| descriptor state characterization | A17 | focused lifecycle matrix implemented | T04-T08,T24-T26 | CLOSED | NO |
| cron multi-entity/fail-fast semantics | gap analysis | outside lifecycle delegation | none | DEFER | NO |
| broad-suite cost W2-RSK-007 | prior W2 risk | named focused gates only | T28,T29 | DEFER | NO |

### Duplication control

| Candidate | Class | Evidence | Disposition | W6 result |
| --- | --- | --- | --- | --- |
| descriptor schema knowledge vs retained exact libraries | D3 semantic | descriptor embeds orchestration while libraries own exact definitions | RECONCILE_BEFORE_CENTRALIZATION | delegate to existing authority; add no second model |
| repeated focused-mode names in runner | D2 structural | mode appears in plan/dispatch/environment | DEFER except narrow BC-021 profile | no generic registry/framework |
| runtime readiness calls to exact detectors | D4 intentional / defense-in-depth | multiple trust-boundary callers fail closed | KEEP_INTENTIONAL_DUPLICATION | no consolidation |
| exact schema contracts and SQL resources | D1 exact only where detector consumes resource | current paths are authoritative | MOVE_AS_IS / retain paths | no content deduplication |

### Historical / dead-code audit

| Candidate | Reachability evidence | Authority classification | W6 disposition |
| --- | --- | --- | --- |
| RST-005 scripts/shared launcher | guarded operational paths and frozen retention | MIGRATION_ONLY | retain at current paths |
| RST-002B/RST-006A CLIs and detectors | named package scripts and W6 gates | MIGRATION_ONLY | retain and repair baseline proof |
| RST-006B/RST-012 CLIs and detectors | descriptor/runtime/runner callers | MIGRATION_ONLY, reachable | retain |
| dormant shared-port browser file | absent from named discovery; unsafe default | UNRESOLVED | do not run/remove in W6 |
| Activity access wrapper pair | frozen first W7 candidate; reachability proof pending | UNRESOLVED W7 candidate | no W6 removal |
| other audit dead/removal candidates | no candidate-specific current proof in W6 | HISTORICAL/UNRESOLVED | defer |

No removal has all three required elements—current forensic evidence, frozen W6
authority, and reachability proof—so W6 removes none of these candidates.

## W7, risks, and implementation skeleton

W6 produces no frozen W7 artifact: 0/0 hard dependencies. W7 remains
`NOT_AUTHORIZED`.

BLK-01 through BLK-04 are closed. Six non-blocking risks remain:
include/resource breakage; partial source rollback; diagnostic drift; test-mode
leakage; false atomic-DDL claims; and broad-suite cost without a W6 oracle.

### Cross-cutting risk register

| Risk ID | Ledger IDs | Risk | Likelihood | Impact | Mitigation / gate | Blocks authorization? |
| --- | --- | --- | --- | --- | --- | --- |
| RSK-W6-05 | T18-T20 | include/SQL resource breakage | Medium | High | atomic source closure; G09 | NO |
| RSK-W6-06 | T03,T20,T24 | partial source rollback/dual owner | Low | High | CG3 NO_COEXISTENCE + complete SR; G08 | NO |
| RSK-W6-07 | T09 | diagnostic drift | Low | Medium | exact result/log assertions; G06 | NO |
| RSK-W6-08 | T11,T12,T25,T28 | test-mode leakage | Medium | High | explicit profiles only; G07 | NO |
| RSK-W6-09 | T04,T14-T18,T22 | false atomic-DDL/rollback claim | Medium | High | per-row recovery view; guarded resume/DR | NO |
| RSK-W6-10 | T10,T28,T29 | broad-suite cost without oracle | Medium | Low | named gates; defer W2-RSK-007/BC-005 | NO |

The four authorization blockers formerly recorded in T11, T22, T17, and T05
are closed by executable proof. No architecture or Standard amendment was
required.

Future skeleton, not authorization:

| Step | Ledger IDs | Action | Likely files | Preconditions | Verification gates | Cutover group | Recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | T10-T12,T28 | narrow runner-owned predecessor profiles and exact verification | runner, disposable override/profile, focused runner unit | complete | G01,G02,G07 | CG1 | source revert + DR |
| 2 | T04-T07,T17,T21-T23 | RST-012/descriptor characterization and exact activation refusal | descriptor, runner, focused RST-012/auth gates | complete | G04-G06 | CG2 | complete prerequisite SR + DR |
| 3 | T01,T29 | obtain explicit W6 authorization | authority/status docs only | BLK-01-04 closed | G00 | CG0 | doc correction |
| 4 | T03,T08-T09,T13-T27 | delegate exact lifecycle logic with complete caller/include/resource closure | descriptor, one current-path lifecycle seam, only necessary callers/includes | step 3 authorization | G03-G09 | CG3 | complete SR; guarded DR only |
| 5 | T29,T30 | run final gates/reviews, reconcile status, stop before W7 | focused contracts/status docs | step 4 complete | G00-G10 | CG4 | correct source and rerun |

### Change budget

| Estimate | Blocker-closing unit | Later authorized W6 |
| --- | --- | --- |
| files added | 0-2 focused test/contract files | 0-1 lifecycle seam, 0-2 focused contracts |
| files modified | 3-6 runner/test files plus 1-2 descriptor/lifecycle PHP files for the narrow activation guard | 2-6 runtime/caller/include files |
| files removed | 0 | 0 unless an embedded descriptor block is counted as source deletion |
| tests added/modified | 3-6 | 2-5 |
| documentation modified | 2-4 | 3-5 status/readiness files |

These are spread-detection estimates, not arbitrary limits. The completed
prerequisite made only the narrow activation refusal and disposable lifecycle
changes required by BLK-01 through BLK-04; it did not repair schema or move
lifecycle ownership. Later W6 remains the descriptor plus one current-path seam
and only necessary caller/include changes.
Any framework/config/dependency/schema/UI addition, generalized helper, or
unrelated cleanup triggers a new lean-scope review.

### Entry criteria for a future W6 authorization

| Criterion | Required state |
| --- | --- |
| W0-W5 | COMPLETE |
| authority hashes and DEC-066/067/068 | verified/current |
| BLK-01 through BLK-04 | closed by passing G01,G02,G04-G07 evidence |
| preservation ledger | 35/35 mapped with no unsupported exception |
| worktree/baseline | reviewed blocker-closing diff; establish a clean named baseline before W6 movement |
| authorization | new explicit user authorization after readiness re-review |

### Future W6 exit criteria

- CG3 is one source unit with no dual lifecycle authority.
- Descriptor contains declarations/orchestration, not detector implementations.
- All maintained exact-state and interruption matrices G01-G06 pass.
- G08/G09 prove one owner and unchanged caller/include/resource paths.
- All 35 preservation items retain their classified enforcement.
- Post-W5 behavior remains unchanged except the authorized structural
  delegation; DEC-066 generic preview 503 behavior is preserved.
- The recovery model remains valid and no source revert is described as DDL
  reversal.
- W7 dependency remains 0/0 unless frozen authority is separately amended; no
  W7 implementation occurs.
- Frozen governance and hashes remain unchanged; documentation is reconciled.
- No DDL/state/guard/SQL-resource/app behavior changes occurred.
- Standards and Specification reviews pass against the authorized diff.
- Status records W6 complete only after evidence, and execution stops before W7.
- The final committed worktree is clean.

### Recorded adversarial passes

| Pass | Questions applied | New findings | Findings invalidated | Readiness impact | Result |
| --- | --- | --- | --- | --- | --- | --- |
| A — Completeness | missing responsibility/owner/action/DB/frontend/Dolibarr/preservation/exclusion | initial compressed ledger, preservation, exclusion, gate, coexistence, and recovery evidence was insufficient; expanded in the initial review | claim that grouped summaries alone established exact denominators | initial verdict stayed NOT_READY; report completeness restored | PASS: no new material gap on final pass |
| B — Safety | dual authority, transaction/auth drift, DEC-066, coexistence, rollback, audit, characterization, false-positive gates | identified canonical blocker rows T11/T22/T17/T05 and need for per-row recovery/failure ownership | possible READY_WITH_CONSTRAINTS treatment of frozen prerequisites | four ledger conditions blocked initial authorization | PASS: prerequisites were not hidden as constraints |
| C — Scope discipline | W5/W7 leakage, generic refactor/tooling/design/auth/monitoring cleanup, deferred debt absorption | stale gap wording could permit retirement; corrected to retain historical support | assumption that remaining debt belongs in W6 because only W6/W7 remain | documentation only; 24/24 exclusions explicit | PASS: no unauthorized scope |
| D — Prerequisite re-review | exact predecessors, activation refusal, RST-012 matrix, descriptor states, lean scope | BLK-01 through BLK-04 closed by focused executable evidence | initial `W6_NOT_READY` status | W6 becomes READY_FOR_AUTHORIZATION; ownership move remains unauthorized | PASS: no remaining authorization blocker |

## Independent and mechanical reviews

Independent source, gate, and documentation audits agreed on the evidence.
This document follows repository authority, the amended Standard hash, real
paths, narrow scope, and evidence qualifications.

```text
Standards review: PASS
Specification review: PASS
```

Those passes validate the prerequisite re-review and its readiness verdict. No
architecture or Engineering Standard amendment is required.

| Mechanical condition | Result |
| --- | --- |
| scope/exclusions/current owners | COMPLETE |
| preservation | 35/35 |
| ledger/gates/cutovers | 32/32, 11/11, 5/5 |
| unresolved authority conflicts | 0 |
| current-state discrepancy rows / canonical blockers | 2 / 0 |
| missing scope / extra scope | 0 / 0 |
| cycles / unowned / dual authority | 0 / 0 / 0 |
| preservation without target enforcement/verification | 0 / 0 |
| gates without oracle/path | 0 / 0 |
| unsafe coexistence / non-credible recovery | 0 / 0 |
| ambiguous transactions/authorization | 0 / 0 |
| DEC-066 / post-W5 ownership conflicts | 0 / 0 |
| amendments required | NO / NO |
| blocking ledger conditions / cross-cutting blocking risks / non-blocking risks | 0 / 0 / 6 |
| frozen prerequisites satisfied | YES |

## Final report

```text
W6 Readiness Review: COMPLETE
Frozen architecture: VERIFIED
Frozen Engineering Standard: VERIFIED
W0 status: W0_COMPLETE
W1 status: W1_COMPLETE
W2 status: W2_COMPLETE
W3 status: W3_COMPLETE
W4 status: W4_COMPLETE
W5 status: W5_COMPLETE
W5 baseline commit: VERIFIED
W5 baseline: 2b05a78
W5 -> W6 explicit dependency: NONE_DEFINED
Preservation requirements: 35 / 35
Exact W6 scope: CLEAR
Master ledger rows: 32
Rows READY: 14
Rows READY_WITH_CONSTRAINTS: 17
Rows BLOCKED: 0
Rows NOT_APPLICABLE: 1
Coverage reconciliation: COMPLETE
Authoritative scope coverage: 10 / 10
Current responsibility coverage: 25 / 25
Target responsibility coverage: 25 / 25
Route/action coverage: 5 / 5
DB/query/write coverage: 8 / 8
Transaction coverage: 3 / 3
Frontend contract coverage: 0 / 0
Dolibarr seam coverage: 8 / 8
Preservation coverage: 35 / 35
Verification-gate coverage: 11 / 11
Cutover-group coverage: 5 / 5
W7 dependency coverage: 0 / 0
Exclusion coverage: 24 / 24
Unresolved authority conflicts: 0
Current-state discrepancies: 2
Missing authoritative scope items: 0
Unauthorized extra scope items: 0
Dependency graph: VALID
Unexplained dependency cycles: 0
Unowned transition states: 0
Dual-authority transition states: 0
Preservation items without target enforcement: 0
Preservation items without verification: 0
Mandatory gates without oracle: 0
Mandatory gates without known execution path: 0
Unsafe coexistence rows: 0
Non-credible rollback/recovery rows: 0
Ambiguous transaction ownership rows: 0
Unresolved authorization semantics: 0
DEC-066 conflicts: 0
Post-W5 ownership conflicts: 0
W2-RSK-007 disposition: DEFERRED
BC-005 disposition: DEFERRED
BC-006 disposition: W6_GUARD
BC-007 disposition: NOT_RELEVANT
Architecture amendment required: NO
Engineering Standard amendment required: NO
Standards review: PASS
Specification review: PASS
Cross-cutting blocking risks: 0
Non-blocking risks: 6
Runtime files modified: 3
Test files modified: 8
W0 implementation modified: NO
W1 implementation modified: NO
W2 implementation modified: NO
W3 implementation modified: NO
W4 implementation modified: NO
W5 implementation modified: NO
Tooling/config modified: 2 (`package.json` command and disposable test override)
Dependencies modified: 0
CI modified: 0
W6 authorized: NO
W7 authorized: NO
Final verdict: W6_READY_FOR_AUTHORIZATION
Review document: docs/mjl-w6-readiness-review.md
```

This final-report block is the historical pre-authorization readiness snapshot.
DEC-069 remains the record of the failed first attempt; DEC-070 superseded its
blocking inputs and governs the completed implementation recorded at the top of
this document.

```text
W6 implementation: COMPLETE
Final W6 status: W6_COMPLETE
Authorized baseline: 725821a
Required ledger rows implemented and verified: ALL
Failed or blocked ledger rows: 0
Verification gates: G00-G10 PASS
Cutover groups: CG0-CG4 COMPLETE
Unowned or dual-authority responsibilities: 0
Lifecycle delegation: exact frozen delegation complete
Behavior, DDL, state, auth, and SQL-resource changes: 0
Preservation requirements: 35 / 35
Architecture / Standard amendment required: NO / NO
W7 work performed / authorized: NO / NO
```
