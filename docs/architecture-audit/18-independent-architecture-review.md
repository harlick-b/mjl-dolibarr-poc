# Independent review of the MJL target architecture

## 1. Executive verdict

**ARCHITECTURE_REVISION_REQUIRED**

The proposal has a sound general direction: retain Dolibarr, the Activity
aggregate, native adapters, database invariants, guarded lifecycle tooling,
and layered authorization; extract mixed HTTP and presentation responsibilities.
However, the proposed dependency rules prohibit a dependency that runtime
authorization actually requires: exact schema recognition. Read snapshots and
several session effects also lack a consistently permitted target owner.

This is an independent source-and-evidence review of document 17, not acceptance
of its internal adversarial report or the earlier focused review results.
All 35 preservation requirements were examined. **29 have complete mappings;
6 have weak, ambiguous, or incorrect mappings** under the stricter freeze
criteria below. There are **0 CRITICAL, 1 HIGH, 6 MEDIUM, and 0 LOW findings**.
These are architecture findings, not seven reproduced runtime defects.

All seven implementation waves W1–W7 were reviewed, plus W0 as a preparation
step. **3/7 are READY as bounded plans**, and four need proposal corrections.
READY means feasible subject to the stated future prerequisites; it does not
mean tests have run, the architecture is frozen, or implementation is authorized.

## 2. Review scope

The candidate is [17-target-architecture-proposal.md](17-target-architecture-proposal.md),
SHA-256 `39be757d0f1b39813bf87e42daafb879d01c1638e07e336f2164e3605e82e51e`.
The review uses the working-tree proposal, not an assumed committed version.
Its existing untracked state and the pre-existing README changes were preserved.
Proposal line references below refer to this exact candidate.

Only this document and the audit README review-status/link entry are outputs.
Document 17, runtime, tests, schema, assets, hooks and migration tooling remain
unchanged. No tenant, authentication flow, migration or runtime test was run.
No new engineering standard or target directory was created.

The request describes seven waves. The actual document contains W0–W7: seven
implementation waves and one characterization prerequisite. This review reports
W1–W7 in the requested denominator and evaluates W0 separately.

The code-review and confidence-review workflows were used to check standards,
requirements and counterexamples. Independent security/preservation,
wave/lifecycle and responsibility/navigation audits were consolidated against
source. Disagreement over severity was resolved explicitly: the session issues
are MEDIUM because an explicit-state implementation is possible under the
proposal; the forbidden runtime-readiness dependency is HIGH because the stated
architecture currently has no legal path for a required authorization check.

## 3. Evidence reviewed

| Evidence | Use and qualification |
| --- | --- |
| `docs/mjl-authoritative-decisions.md`, `CONTEXT.md`, `AGENTS.md`, acceptance guidance | product invariants, custom-module boundary, lean execution and test scope |
| [00 baseline](00-baseline.md), [01 inventory](01-file-inventory.md), file/symbol annexes | baseline identity, responsibility population and source lookup; indexed symbols are not automatically executed behavior |
| [02 dependencies](02-dependency-map.md), [03 requests](03-request-map.md) | route-to-command/read/presentation paths and dynamic invocation |
| [04 database](04-database-map.md), [05 lifecycle](05-module-lifecycle.md) | transaction owners, native boundaries, exact states, DDL and cron |
| [06 authentication](06-authentication-state.md), [07 authorization](07-authorization-map.md), [08 workflows](08-business-workflows.md) | auth transitions, Admin exception, assignments, immutable revisions, no-self-validation |
| [09 frontend](09-frontend-contracts.md), [10 duplication](10-duplication-report.md), [11 dead code](11-dead-code-analysis.md) | DOM contracts, intentional duplication and unproven removal candidates |
| [12 standards](12-standards-assessment.md), [13 regression](13-regression-baseline.md) | host conventions, known test scope/drift; closure supersedes the old resolved HIGH rows in document 12 |
| [14 preservation](14-preservation-ledger.md), [15 classification](15-behavior-classification.md), [16 current architecture](16-current-architecture.md) | all stable contracts, residual risks and current owners |
| [closure evidence](closure-evidence.md), canonical gap analysis | four resolved HIGH findings and remaining evidence limitations |
| actual auth/scope/email/hooks, reference commands, Activity/access/form libraries, monitoring/report/export, schema libraries, descriptor, cron and bootstrap | reconstructed critical call chains, commit/session order, read snapshots, exact detectors and relative paths |
| `package.json`, `tests/runner/run-suite.js`, named unit/PHP/browser tests | command existence, selected suites and missing proofs; no passing result inferred from test presence |

The closure records passing reference fault injection, 12 auth tests, and the
RST-006B interruption matrix plus 27 Phase 3A browser tests. This review relies
on that recorded evidence and targeted current-source checks; it does not claim
to have re-executed them or independently repeated the exhaustive forensic audit.
External framework guidance was not substituted for the audited Dolibarr usage.

Review-output checks: all 24 required sections and 35 unique ledger rows are
present; local document links resolve; `git diff --check` passed. The proposal
hash remained identical to section 2. The application/test manifest remained
`36e9bc9c2712df4222cc06bbcee171ebd493fcfc565f4142587b9c3e34783763`,
matching closure evidence. Runtime/E2E and PHP syntax tests were skipped because
no executable files changed. No new reusable lesson was added: these are
task-specific design corrections and the output scope is document 18/README.

## 4. Preservation traceability review

Classification measures the complete chain, not merely presence of an ID:
current behavior -> named target owner/location -> wave -> regression protection
-> rollback. COMPLETE permits explicitly planned, not-yet-executed tests where
the wave prevents migration until they exist. WEAK means part of that chain is
insufficient. AMBIGUOUS means competing target ownership remains. INCORRECT
means a stated target rule conflicts with a required dependency. No ID is absent.

Location shorthand below is relative to `custom/mjlfinancement/`:
AC = `class/mjlactivitycommand.class.php`; AA = assignment class;
HTTP = named `lib/<feature>/*_http.lib.php` handlers; AUTH = proposed
`class/mjlauthcommand.class.php`; ACCESS = proposed access command;
REF = proposed reference command; MON = retained `class/mjlmonitoring.class.php`;
AUD = `lib/audit/mjl_audit_writer.lib.php`; LIFE = proposed `scripts/lifecycle/`.

Regression shorthand: AUTH gate = `npm run test:auth`; P2 = `test:phase2`;
P3A = `test:phase3a`; P3B = `test:phase3b`, each via `npm run`.
V03–V12 refer to the actual `npm run test:vuiNN` scripts. These are scoped
future gates, not commands run in this review.

Rollback shorthand: R = revert the complete code/caller/resource unit while
keeping compatible durable data; U = retained behavior, no move needed;
L = lifecycle code rollback only, never an implied undo of committed DDL;
S = also retain session/credential representation and current side-effect order.

| ID | Classification | Current implementation | Target owner/location | Wave | Regression protection | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| RT-001 | COMPLETE | root routes load `main.inc.php`; denial/dynamic exceptions | same root adapters -> HTTP; denial roots unchanged | W1/2/4/5 | route/browser checks, deny-only source contract | R/U |
| RT-002 | COMPLETE | `mjl_*_route`, direct access guards | feature HTTP and action-specific policy libraries | each HTTP wave | direct forbidden GET/POST characterization before move | R |
| RT-003 | WEAK | CSRF plus `mjl_form_submission_issue/consume` | HTTP owns checks, but session issuance/recovery still mixed with `lib/ui` mapping | W1/2/4 | V10/V04 and AUTH; issue/consume ordering must be explicit, AR-REV-004 | R/S |
| RT-004 | COMPLETE | AC locked identity/state checks; `AA::changeAssignment` | same AC/AA command classes | W2; relevant W3/4 owners | P2/P3A plus direct under-lock tests | R |
| RT-005 | COMPLETE | AC planning/revision/review/execution/exception methods | same AC, private implementation retained | W2 | command behavior retained; routing characterization | R |
| RT-006 | COMPLETE | `AC::reviewRevision`, contributors/prevalidator identities | same locked aggregate | W2 | P2 and V06; browser visibility cannot replace command proof | R |
| RT-007 | COMPLETE | AC server financial rules; pure browser preview | AC and existing financial helpers | W2 | P2/P3A; financial-preview unit test | R; integer/null formats unchanged |
| RT-008 | COMPLETE | AC versions, assignment version, reference fingerprint | AC/AA/REF locked checks | W2/3 | stale-write/no-op reference fault contract, workflow gates | R; preserve versions/fingerprints |
| RT-009 | COMPLETE | `decideCancellation`, `decideReopening`, reconciliation | same AC and reconciler | W2 | P3A terminal/cascade checks | R; retain terminal representations |
| RT-010 | WEAK | MON scoped reads and monitoring route snapshots | MON + `lib/monitoring`/`tpl/monitoring` | W1/W5 claimed, but neither names full monitoring move | named report tests exist; dashboard/alerts wave and read snapshot owner missing, AR-REV-002/003 | R |
| RT-011 | INCORRECT | Activity/monitoring readiness directly calls RST detectors | readiness policies -> LIFE conflicts with prohibition on runtime lifecycle calls | W2/5/6 | exact state gates exist, but target path forbidden, AR-REV-001 | L/R |
| RT-012 | COMPLETE | `MjlExport::generate`, private spool, final locks/evidence | retained export/spool classes + reporting HTTP | W5 | P3B/V12/spool tests; server-read fault explicitly planned | R; GENERATED survives delivery failure |
| RT-013 | COMPLETE | custom documents deny without bootstrap/storage | same deny-only root files | retained | containment contract/P3A | U |
| RT-014 | COMPLETE | native Societe/Project/User and output libraries | private REF/AUTH/native render adapters | W3/4/5 | reference fault, AUTH, report format/native behavior tests | R |
| RT-015 | COMPLETE | `MjlExecutionReconciler::run` -> AC | retained class and hourly descriptor registration | retained | module/cron gate; current fail-fast/entity caveats explicit | U; earlier per-row commits remain |
| SEC-AUTH-001 | COMPLETE | Admin invitation issue; inactive account/role | AUTH + participating access operation | W3/4 | AUTH plus planned post-role-assignment failure injection | R/S |
| SEC-AUTH-002 | COMPLETE | token pair/hash, locked redemption | private AUTH token implementation | W4 | AUTH digest/single-use behavior | S; credential format retained |
| SEC-AUTH-003 | COMPLETE | neutral/throttled reset and exact Admin exception | AUTH reset methods + native route adapter | W4 | AUTH active-entity reset/consume; selector privacy separately deferred | S |
| SEC-AUTH-004 | AMBIGUOUS | OTP hashing/limits, pending binding, session completion | AUTH versus `lib/auth` session policy/adapter | W4 | AUTH; session mutation ownership/order must be named, AR-REV-005 | S |
| SEC-AUTH-005 | AMBIGUOUS | login/updateSession hooks and OTP verification check | hooks + auth/session policy with unclear effect owner | W4 | AUTH native bypass/clearing; AR-REV-005 | S |
| SEC-AUTH-006 | COMPLETE | `mjl_auth_set_password` encrypted-only native adapter | private AUTH password adapter | W4 | both native `pass IS NULL` assertions | S; restore runtime config |
| SEC-AUTHZ-001 | COMPLETE | `mjl_scope_effective_role_code`, DB role guards | `lib/access/mjl_access_policy.lib.php` + same guards | W3/4 | AUTH/access guards; exact role/Admin exclusions | R/S |
| SEC-AUTHZ-002 | COMPLETE | profile/deactivation, revocation and audit | ACCESS plus participating access operation | W3 | V11/AUTH and planned composition fault | R/S |
| SEC-AUTHZ-003 | COMPLETE | Activity assignment/entity queries and locked mutation guards | Activity policy + MON/AC/AA | W2 | P2/P3A/V03; required readiness-path correction tracked under RT-011 | R |
| SEC-AUTHZ-004 | COMPLETE | UI/route/command/database defenses | same four trust boundaries | every touched wave | source, direct-route, locked-command and DB proofs retained | R |
| SEC-DOC-001 | COMPLETE | dependency-free document denials | same root denial files | retained | containment checks; no storage/bootstrap added | U |
| SEC-DOC-002 | COMPLETE | Apache guard and no raw ECM links | same deployment guard and UI restrictions | retained | source proof; loaded-state deployment check explicitly deferred | U |
| DB-001 | COMPLETE | entity predicates/relations, narrow reset exception | every command/projection and same DB invariants | relevant DB waves | scoped reads/writes and AUTH reset assertions | R; no data/entity conversion |
| DB-002 | WEAK | append-in-transaction audit; reference quarantine; other owners vary | AUD + command owners | W2–5 | reference proof complete, universal failure promise exceeds scoped proofs, AR-REV-006 | R; audit remains immutable |
| DB-003 | COMPLETE | triggers/constraints and exact verifiers | same SQL + exact LIFE checks | W3/4/6 | DB guards; BC-022 proof is explicit prerequisite | L |
| DB-004 | COMPLETE | known-prefix recognition and guarded transitions | RST detectors/installers in LIFE | W6 | complete RST-006B interruption matrix | L; do not equate Git revert with DDL reversal |
| LIFE-001 | COMPLETE | bootstrap/preserved native Admin loader | retained guarded bootstrap/lifecycle | W4/6 | single Admin/empty business state checks | U/L |
| LIFE-002 | COMPLETE | isolated runner, fixtures, teardown/evidence | retained disposable infrastructure | W0 and every tenant gate | named gates and teardown; runner debt remains explicit | U; no shared fixture recovery |
| LIFE-003 | COMPLETE | descriptor exact-state classification/refusal | descriptor + LIFE classifier | W6 | predecessor/current/partial refusal and checkpoint gates | L |
| LIFE-004 | COMPLETE | bootstrap calls native-module disable helper | same bootstrap-only owner | retained | operational-script boundary contract | U |

Counts: COMPLETE 29; WEAK 3; AMBIGUOUS 2; INCORRECT 1; MISSING 0.
The six incomplete mappings do not mean those runtime protections are absent.
They mean the candidate has not unambiguously preserved their complete target
ownership/dependency/verification chain. Dependencies between ledger rows are
cross-referenced rather than counting the same weakness against every row.

## 5. Responsibility-boundary review

| Proposed responsibility | Audited problem and reverse trace | Assessment / simpler adequate form |
| --- | --- | --- |
| root web adapter | mixed route paths in audit 03; RT-001/002 | KEEP procedural Dolibarr bootstrap/dispatch; no controller class needed |
| request handler | parsing, guards, action selection, result mapping mixed with rendering; RT-002/003/008 | KEEP one feature handler; “exactly one command or query” must not force wrapper classes for several reads composing one view |
| policy | persisted effective role and assignments; audit 07, SEC-AUTHZ family | KEEP action-specific decisions; fail closed on absent context; clarify session effects and readiness dependency |
| command | real locks, versions, audit and transaction owners; audit 04/08 | KEEP AC/AA/export depth; REF/ACCESS/AUTH justified by stateful behavior, not by `.lib.php` extension |
| projection/query | MON and mixed route SQL; RT-010/012 | KEEP scoped reads; choose one Activity read owner before extraction; permit existing non-export read snapshots |
| native business objects | Societe/Project/User integration; RT-014 | KEEP native adapters inside owners; no new object hierarchy |
| audit writer/projection | transaction-bound evidence versus sanitized chronology; DB-002 | KEEP append and outcome distinctions; preserve trigger-backed immutability |
| presenter/templates | route render bodies and audit 09 DOM contracts | KEEP prepared data; assign token/recovery/feedback effects before template calls |
| JS/CSS | producer/consumer contracts in audit 09 | KEEP existing feature files until a proven split pays for itself; no bundler or AJAX architecture |
| lifecycle/descriptor | registration mixed with exact checks and DDL; audit 05 | SIMPLIFY first by delegation; separate permitted read-only recognition from guarded transitions |
| pure/shared helper | repeated calculations and UI mechanics; audit 10 | KEEP only proven reuse; session stores are not pure utilities |

No repository-per-table, container, general event system or substitute ORM is
proposed. The potential future AUTH god class is a review risk, not proof that
more classes are needed: keep cohesive state transitions and small public
interfaces, and avoid simply wrapping all current global helpers as methods.

## 6. Over-engineering review

| Element | Claimed benefit / actual evidence | Complexity cost | Simpler alternative | Disposition |
| --- | --- | --- | --- | --- |
| root -> handler -> command | inspectable write path; current mixed routes support it | one extra named dispatch location | procedural handler with direct command call | KEEP |
| `MjlActivityQuery` or a feature projection | relocate Activity reads; current `MjlActivity` and MON already exist | parallel read owners if both survive without distinct purpose | choose retained MON/read projection for actual current path; reserve a new class for distinct predecessor/detail contract only if needed | SIMPLIFY before W2 |
| feature directories in both `lib/` and `tpl/` | separate data preparation from markup | additional file navigation | create only files for responsibilities actually moved; do not precreate the tree | KEEP conditionally |
| wrappers around native calls | preserve native semantics | shallow wrappers if every call gets a class | private named operation inside existing command | MERGE into owner |
| shared UI module | existing repeated dialog/form mechanics | dumping-ground risk, especially stateful session helpers | distinguish request-state effects from pure rendering using existing functions | SIMPLIFY |
| lifecycle directory relocation | separate descriptor implementation | relative include/SQL paths and runtime consumers increase migration cost | delegate descriptor internals at current paths first | DEFER physical moves unless justified |
| deeper JS/CSS split | localize contracts | load-order/selector proliferation | retain current files with explicit contract sections until independently testable split | DEFER |
| generic error/result/DI layer | no current requirement | extra navigation with no proved behavior | existing finite outcomes and platform exceptions | REMOVE if introduced; currently rejected by proposal |

File count cannot be predicted exactly because template partial and auth class
counts are deliberately undecided. A representative Activity route currently
needs roughly three principal locations plus cross-cutting helpers; the target
would need about five or six (root, handler, policy, query/command, view
preparation, template). That increase is acceptable only if each location
answers a distinct investigation question. One file per SQL statement or action
would not improve the demonstrated problem. References similarly need roughly
four or five principal locations, not a controller/service/repository stack.

## 7. Under-engineering review

The proposal adequately protects aggregate writes, native password persistence,
export evidence and database invariants. Four seams remain insufficiently
specified: runtime readiness, consistent read snapshots, session effects, and
monitoring's migration assignment. Simply moving the current functions would
leave some route business effects hidden; following the prohibition literally
could remove required behavior. AR-REV-001 through 005 identify the specific
symbols and smallest corrections. No additional general abstraction is needed.

The finite command-result direction is adequate for design approval once
failure-contract scope is corrected. A detailed PHP enum/class or exact message
catalog is not required before freeze. The later standard must distinguish
expected rejections from infrastructure failure without homogenizing existing
public behavior accidentally.

## 8. Dolibarr compatibility review

| Surface | Classification | Evidence/constraint |
| --- | --- | --- |
| `main.inc.php`, root paths, public flags | COMPATIBLE | stable root adapters and explicit denial exceptions preserve native bootstrap |
| `$db`, `$user`, `$conf`, `$langs` | COMPATIBLE_WITH_CONSTRAINTS | capture real host objects/context; do not invent independent sessions/entities/translations; globals-to-parameters is an implementation change requiring caller checks |
| descriptor, native rights, hook class/signatures | COMPATIBLE | retained registration and callback naming; no autoload replacement |
| native User/Societe/Project and DoliDB | COMPATIBLE_WITH_CONSTRAINTS | native nested transaction behavior remains characterized, outer MJL success checked; no ORM |
| entities and technical Admin | COMPATIBLE | business entity restrictions and narrow entity-0 reset exception remain |
| cron | COMPATIBLE_WITH_CONSTRAINTS | same method/registration, entity context and fail-fast semantics; no multi-entity claim |
| `core/tpl`, assets, dynamic PHP assets | COMPATIBLE_WITH_CONSTRAINTS | native override and registration interfaces retained; module-relative and public URLs must survive moves |
| activation/deactivation versus CLI migration | COMPATIBLE_WITH_CONSTRAINTS | revised activation refusal branches agree with source; DDL remains implicitly committing |
| runtime exact schema recognition | QUESTIONABLE | required host-runtime dependency conflicts with target prohibition, AR-REV-001 |
| proposed file relocation | COMPATIBLE_WITH_CONSTRAINTS | update resource/include closure, AR-REV-007 |
| namespaces/autoload/request frameworks | COMPATIBLE | none required; explicitly deferred/rejected |

Overall host-platform compatibility: **PASS_WITH_NOTES**. No standalone PHP
framework assumption was found. This platform assessment does not override the
separate blocking architectural dependency finding.

## 9. Dependency review

Declared graph reconstructed from the proposal:

```text
Dolibarr/root/hook -> handler -> policy / command / query / presentation
auth preparation -> participating access operation -> DB + audit
auth delivery -> email -> native mail + presentation + failed-outcome audit
command -> native objects + DB + transaction-bound audit
descriptor -> lifecycle -> DB/DDL
cron -> reconciler -> Activity command
presentation -> template -> DOM contract <- JS/CSS
```

The repaired auth/access and email/outbox ownership removes the previously
identified reverse callbacks in the intended final design. No unavoidable
command-policy-command or descriptor-lifecycle-descriptor cycle is required.
But the declared graph omits a necessary edge:

```text
runtime access / monitoring / export / Activity command
    -> exact read-only schema recognition
```

Actual evidence: `mjl_activity_access.lib.php:3–17` loads RST libraries and
checks them; `mjl_monitoring_access.lib.php:3–23` calls RST-012 verification;
`mjl_activity_route.lib.php:145` requires RST-006B; export requires the report
target. These are not requests to execute migration DDL. AR-REV-001 must make
this distinction legal without duplicating schema definitions.

| Hidden runtime dependency | Required treatment |
| --- | --- |
| PHP session bindings, pending/verified auth state, regeneration | explicit mutation owner and post-commit order, AR-REV-005 |
| form submission store, recovery and `dol_events` | request-state effects before pure render, AR-REV-004 |
| DB session isolation/statement/lock timeouts | read owner restores them even on failure, AR-REV-002 |
| `DOL_DOCUMENT_ROOT`, `__DIR__`, SQL asset paths | include/resource closure in W6, AR-REV-007 |
| `MJL_DISPOSABLE_TEST_TENANT`, test modes/exposure flags | retain guards, do not treat them as production configuration |
| schema-readiness request cache | retain exact current/predecessor/unavailable behavior; do not cache an actor's permission for later mutations |

## 10. Investigation-ergonomics simulations

Boundary counts are conceptual investigation stops, not measured call depth.
The assessment applies to the candidate as written, not to a silently repaired
version.

| Scenario | Target investigation path and checks | Approximate stops | Result |
| --- | --- | ---: | --- |
| A: technical Admin cannot reset | native reset hook/HTTP -> AUTH reset issue/consume -> active-entity lookup and native encrypted-only password adapter -> reset DB guards/audit -> OTP/session effects; issuance adds email prepare/send/finalize | 5, plus mail when relevant | SIMILAR_TO_CURRENT; entity and password rules are clear, but session effect ownership needs AR-REV-005 |
| B: Agent sees unauthorized Activity | handler -> effective role/Activity policy -> readiness and current assignment -> entity/assignment-scoped MON or Activity query -> result/template | 5 | HARDER_THAN_CURRENT: source has a runnable detector path, target forbids it and leaves current-list ownership imprecise; AR-REV-001/002/003 required |
| C: false success saving reference | route/handler -> REF transaction owner -> native/DB write and checked commit -> finite result/feedback; inspect rollback/quarantine on failure | 4 | EASIER_THAN_CURRENT: one named transaction owner replaces mixed reference helpers |
| D: unauthorized exported rows | report handler policy/filter normalization -> export snapshot and scoped projection -> renderer/private spool -> fresh locked identity/assignment checks and evidence -> HTTP stream | 5–6 | SIMILAR_TO_CURRENT: existing export class already provides most of this clarity; keep final authorization before stream |
| E: partial reconciliation | descriptor cron registration -> reconciler entity/cursor -> AC per-Activity lock/transaction -> failure result/log | 4 | SIMILAR_TO_CURRENT: earlier commits are intentional current behavior; no generic runner added |
| F: interrupted RST-006B | activation classification/refusal -> explicit guarded CLI -> exact prefix detector -> checkpoint/resume -> exact target verification | 5 | SIMILAR_TO_CURRENT: descriptor must not auto-resume; four early prefixes remain visible |

Thus **5/6 are improved or acceptably equivalent**. Scenario B requires a
design correction before freeze. For A, no extra session framework is needed;
selecting and documenting the existing effect owner resolves the ambiguity.

## 11. Authentication/security review

Independently checked source and proposed placement:

- Invitation-only creation and Admin-only invitation issuance remain in AUTH
  with role/right assignment participating in the same preparation transaction.
- Selector/verifier digests, expiry, single consumption, neutral reset request,
  throttling, fragment-to-POST handoff and no-store/referrer restrictions remain
  required behavior. AUTH-F04 email disclosure is separately and visibly deferred.
- OTP challenge, attempt/resend/cooldown rules, HMAC binding and credential
  fingerprint remain. A role/password/status/entity change must invalidate the
  same verified evidence.
- Preparation commit -> email -> delivery-result commit remains explicit.
  The email capture callback and predicate are planned to move together,
  preserving flags, output/failure behavior and test-only secrecy constraints.
- **BC-018: YES.** `mjl_auth_set_password():171–187` is the only MJL native
  password adapter; it forces encrypted-only storage and restores configuration
  in `finally`. Invitation and reset use it, and the two existing E2E database
  assertions require `llx_user.pass IS NULL`. Proposal section 9 and W4 retain
  that exact owner/proof. No alternate native password write is proposed.
- **Technical Admin reset: YES.** Reset lookup uses active entity; consumption
  at `mjl_auth.lib.php:431–432` admits only entity-0 native Admin or same-entity
  non-admin. Descriptor INSERT/UPDATE guards agree. The target explicitly retains
  the exception without an Admin business bypass.

Session handling is the unresolved architectural point. The read-only policy
row says it invalidates sessions, while AUTH owns session effects and commands
forbid HTTP globals. Passing dependencies explicitly is possible, so this is
MEDIUM ambiguity rather than evidence of an implemented bypass. AR-REV-005
must state who regenerates/clears native session state and preserve
`verify_otp()` commit-before-`complete_session()` ordering.

## 12. Authorization review

| Question | Answer in target | Assessment |
| --- | --- | --- |
| authoritative write authorization | command reloads actor/entity/assignment/state/revision/version under locks | sound; UI and route decisions cannot replace it |
| resource scope | scoped query owner plus locked command predicates | sound intent; runtime readiness path must be repaired |
| effective roles | `lib/access/mjl_access_policy.lib.php`, persisted exactly-one-role rules | explicit; missing/invalid facts must return denial |
| assignments | Activity access/MON predicates, AC/AA under locks | no Partner-based substitute or UI-only check |
| no-self-validation | `AC::reviewRevision` contributor and prevalidator identity checks | retained at correct trust boundary |
| entity restrictions | every custom query/aggregate and DB relations | retained; technical reset exception narrowly named |
| absent context/schema | deny or unavailable, never default permission | current behavior preserved in principle; AR-REV-001 gives it an allowed implementation path |

No proposed removal of defense-in-depth checks was found. The correction should
not make callers manually combine unrelated role, readiness and assignment
helpers. Keep action-specific policy/query interfaces, with shared read-only
readiness behind them and locked checks in commands.

## 13. Database/transaction review

**Reference transaction contract: YES.** The target retains failed-begin stop,
checked commit including no-op paths, rollback attempt and connection closure
on uncertain rollback. These correspond to `mjl_reference_create`,
`mjl_reference_update_label`, `mjl_reference_set_active`, and
`mjl_reference_rollback`; the focused PHP contract exercises each relevant
failure. Native objects remain inside the characterized outer transaction.

Auth/access transaction participation and distinct email-result transactions
are now explicitly described. Append audit stays with its business mutation;
failed-attempt `mjl_audit_record_outcome` remains a separate, limited exception.
Triggers retain role/entity/immutability/live-state protections. No general
transaction wrapper is needed or proposed.

Two remaining issues:

1. **Read snapshots:** Activity detail/review, monitoring pages and report
   previews already use repeatable-read transactions and restore DB session
   budgets. Proposal line 124 permits projection transactions only for export.
   Moving these reads either leaves the old mixed route owner or violates the
   new rule. Name the read-use-case owner and preserve begin/commit/failure/
   timeout restoration (AR-REV-002).
2. **Universal hardening claim:** section 8 universally promises rollback
   quarantine, but AC/AA/auth currently do not uniformly implement it. For
   example, `AA::rollbackOutcome():246–250` ignores rollback failure; auth reset
   and OTP have unchecked begins and rollback returns. W2 excludes aggregate
   changes. The architecture must distinguish the proved reference contract
   from new hardening work and its fault tests (AR-REV-006). This review does
   not independently classify every existing unchecked site as a reproduced
   runtime defect.

## 14. Lifecycle/migration review

**BC-019: YES.** `mjl_rst006b_detect_schema()` retains target/predecessor fast
paths and returns PARTIAL for the exact states recognized by
`mjl_rst006b_is_known_prefix()`. The four early checkpoints remain named in
the runner: `operation-phase2-dropped`, `operation-execution-status-added`,
`operation-spent-amount-added`, `operation-observation-added`. The existing
matrix applies, resumes, verifies and exercises supported rollback; unknown
shapes still fail closed.

Proposal section 11 now correctly distinguishes clean install, current-state
reactivation, upgrade refusal, partial refusal and guarded CLI transitions.
It preserves native initialization ordering, named lock lifetime and
data-retaining removal. Recognizing a partial prefix is not permission for
ordinary activation to resume it.

Remaining W6 concerns are runtime detector ownership (AR-REV-001) and the
relocation closure (AR-REV-007). RST-006A/B/012 libraries load other schema
libraries and SQL using `__DIR__`/`dirname(__DIR__)`. Moving only a library and
descriptor include changes both runtime requires and SQL roots. The smallest
first step may be delegation at current locations. Physical movement needs a
complete caller/resource unit and a matching rollback unit, with no new DDL.

## 15. Frontend-contract review

The proposal accounts for indexed Operation fields, stable IDs/versions, row
cap, `data-partner-id`, BigInt XOF, null-versus-zero, date/select enhancement,
submitter identity, CSRF/nonces, duplicate-submit handling, dialogs, dirty
state, drawer focus/inert/Escape, tabs and French accessibility feedback.

No production AJAX/fetch/XHR or browser-storage contract exists in the audit;
the target correctly introduces none. Auth fragment redemption remains
JavaScript-dependent, so general progressive-enhancement language must not be
read as a new no-JS guarantee. Old/new `data-*` hooks may coexist only in the
bounded producer/consumer move; CSS-state classes and asset order remain
observable contracts.

AR-REV-004 is consequential here: `mjl_activity_hidden()` currently issues a
session-backed token while rendering HTML; `mjl_activity_render_form()` consumes
recovery. Extracting templates without separating those effects can duplicate
issuance, prematurely evict pending tokens, or consume recovery twice. Preserve
the 7,200-second token TTL, 20-token cap, exact context and mismatch
non-consumption, plus current partial recovery behavior. This task does not
authorize fixing the separate multi-form token-cap product issue.

## 16. Duplication review

| Category | Evidence and disposition |
| --- | --- |
| exact duplication | consolidate only after actual equality/caller proof; no automatic dead-helper deletion |
| structural duplication | similar ID/decimal parsers and dialog movers have distinct inputs/errors/state policies; reconcile first |
| semantic duplication | business-role vocabulary needs one application owner in access policy; DB definitions remain independently checked |
| intentional duplication | server/browser financial checks serve different trust roles; retain both |
| defense in depth | UI/route/locked-command/DB checks protect different boundaries; retain all |
| historical compatibility | predecessor queries and migration definitions remain until explicit support-horizon decision |

The proposed strategy agrees with audit 10. No consolidation is justified merely
by similar SQL text; entity scope, locking, ordering, nulls and predecessor
semantics must match. Shared schema recognition should reuse exact definitions,
not copy them into runtime code to evade the lifecycle prohibition.

## 17. Residual-risk review

This includes every explicitly MEDIUM audit item plus adjacent verification and
deployment uncertainties, rather than considering only BC-numbered rows.
No new permanent preservation ID is required merely to preserve a known defect;
existing IDs cover invariants while corrections need explicit behavior decisions.

| Residual item | Classification | Architectural effect, wave condition, preservation |
| --- | --- | --- |
| BC-003 stream read failure | MUST_BE_RESOLVED_BEFORE_WAVE | W5 delivery move requires injected server-read failure and defined response; RT-012 GENERATED meaning retained |
| BC-004 stale design assertions | MUST_BE_RESOLVED_BEFORE_WAVE | selected CSS/UI move in W5 needs authority reconciliation; unrelated backend work need not wait |
| BC-005 stalled unit command | DEFERRED_SAFELY | direct focused gates avoid claiming broad pass; reproduce/fix only if selected gate depends on runner |
| BC-006 incomplete discovery | ADDRESSED | proposal names real commands and coverage limitations; LIFE-002; no universal-coverage claim |
| BC-007 dormant shared-port test | DEFERRED_SAFELY | do not run; removal/preflight required before any use; LIFE-002 |
| BC-008 cron stops after first failure | DEFERRED_SAFELY | reconciler retained; decide before changing batch semantics; RT-015 |
| BC-009 cron entity context | DEFERRED_SAFELY | no topology change; decide before multi-entity scheduling; DB-001/RT-015 |
| BC-010 activation implicit commits | ADDRESSED | explicit CLI/activation distinction and resumability; DB-004/LIFE-003; relocation still AR-REV-007 |
| BC-011 resend before delivery, LOW | DEFERRED_SAFELY | preserve replacement/failure state; no resurrection of old code; SEC-AUTH-004 |
| BC-012 global export lock | DEFERRED_SAFELY | unchanged until measured demand; RT-012 |
| BC-013 post-commit retry identity | MUST_BE_RESOLVED_BEFORE_WAVE | only W5 substeps touching retry/cleanup require decision; unchanged semantics can remain |
| BC-014 predecessor audit cap, LOW | DEFERRED_SAFELY | retain until support horizon/completeness decision; RT-011 |
| BC-015 Apache loaded state | DEFERRED_SAFELY | deployment fact remains unverified; no guard/config change or deployment approval here; SEC-DOC-001/002 |
| BC-016 external font, LOW | DEFERRED_SAFELY | no new external request; production privacy/CSP task deferred |
| BC-017 password HTTP method | MUST_BE_RESOLVED_BEFORE_WAVE | direct GET/native dispatch characterization before W4; smallest confirmed correction separately bounded |
| BC-020 cooperative zero timeout | MUST_BE_RESOLVED_BEFORE_WAVE | correct before relying on deadline-aware lifecycle gates, particularly W6; LIFE-002 |
| BC-021 wrong historical baseline | MUST_BE_RESOLVED_BEFORE_WAVE | W6 RST-002B/006A modes require verified provisioning; do not forward modes blindly |
| BC-022 weak auth-schema acceptance | MUST_BE_RESOLVED_BEFORE_WAVE | exact checks/repair policy and proof before W4/W6; DB-003; no present runtime guarantee invented |
| AUTH-F04 selector reveals email | DEFERRED_SAFELY | now explicitly mapped to reset presentation; characterization before W4, masking requires separate decision |
| fixture workers bootstrap before preflight (audit 13) | MUST_BE_RESOLVED_BEFORE_WAVE | retain isolation; correct/check affected worker execution order before using those modes, not every unrelated gate |
| current runtime readiness mapping | ARCHITECTURE_REVISION_REQUIRED | AR-REV-001; underlying exact checks exist but proposed allowed dependency is contradictory |

The four resolved HIGH audit findings remain resolved; new architecture
findings do not reopen them. Historical runner or runtime deployment limits
are not proof of a newly failing application.

## 18. Migration-wave review

| Wave | Classification | Scope, dependency, coexistence and proof assessment |
| --- | --- | --- |
| W0 prerequisite | READY | reference-list characterization is concrete; selected-gate drift may be repaired; no runtime behavior change; tenant isolation remains mandatory |
| W1 reference GET | READY | bounded list extraction can keep current mutation handlers; root/handler/template move together; V10 and reference contracts are named; preserve stateful helpers until explicitly prepared as AR-REV-004 requires |
| W2 Activity | READY_WITH_CORRECTIONS | actual current list dispatches to monitoring; detail/review owns a read snapshot. AR-REV-001/002/004 must map these before claiming Activity extraction complete; no future W5 abstraction may be required for W2 to work |
| W3 reference/access | READY | real transaction owner replaces helpers; invitation caller switches atomically with participating access operation; existing plus planned fault gates named; retain serialized outcomes/roles/credentials |
| W4 auth | READY_WITH_CORRECTIONS | W3 dependency and prepare/send/finalize/outbox moves are explicit; AR-REV-005 must select session effect ownership; AR-REV-006 separates fault hardening from relocation; named missing proofs precede extraction |
| W5 reporting/frontend | READY_WITH_CORRECTIONS | report snapshots need AR-REV-002; monitoring move/retention needs AR-REV-003; no implicit dashboard expansion. Report versus frontend substeps may merge independently with existing public contracts |
| W6 lifecycle | READY_WITH_CORRECTIONS | correct activation/CLI behavior and BC-019 gates; AR-REV-001/007 must include runtime detector consumers, CLI includes and SQL resources; historical provisioning/BC-022 are explicit prerequisites |
| W7 wrapper removal | READY | only two named Activity access wrappers; unproved dynamic reachability means defer rather than delete; reference search plus guarded browser gate and candidate revert are credible |

No mandatory reorder or big-bang rewrite is justified. Name W2's stable
readiness/read-snapshot interface first; W5 reuses it and W6 relocates its
implementation only with all callers/resources. Changes to one file in two
waves are acceptable when the responsibilities differ and later code depends
only on the earlier stable interface.

READY count is **3/7** (W1, W3, W7), excluding W0. This is deliberately stricter
than counting W4 ready solely because missing tests are listed: ownership of
session effects is a design decision, not a future test implementation detail.

## 19. Rollback review

| Wave | Credible rollback and limits |
| --- | --- |
| W0 | revert test/runner changes; teardown disposable data; no business-data reversal |
| W1 | revert list handler/templates/callers together; old code reads the same data and tokens; preserve POST handlers and asset compatibility |
| W2 | revert all Activity/monitoring call changes for that substep; same revisions/versions/assignments; no dual-write or backup restore needed if representations remain unchanged |
| W3 | revert new commands, participating access operation and invitation call change together; completed legitimate mutations/audit remain, not undone |
| W4 | revert the complete auth/email/session include unit; existing pending/verified sessions and credential rows must remain readable; sent email and completed password changes cannot be recalled |
| W5 | revert report/render/DOM producer-consumer unit; preserve GENERATED records and artifacts' existing lifecycle; avoid reverting only one side of dual hooks |
| W6 | revert complete code/resource/include closure; do not assume code revert reverses DDL. Interrupted state needs its existing supported resume/rollback runner. If representation or DDL changes, this wave's rollback claim no longer applies |
| W7 | restore the removed functions and callers as one candidate commit; no schema removal is authorized |

Rollback windows are dependency-bound: after later waves use an earlier
interface, revert dependent changes together or in reverse dependency order.
An arbitrary isolated Git revert of an early wave is not promised. Database
backup restoration and dual-read/dual-write are unnecessary for the proposed
code-only representations, and would be an expansion if introduced here.
Session keys, credential format, DOM hooks and stored schema state are part of
compatibility, not just table layouts. AR-REV-005/007 must make the relevant
rollback units explicit.

## 20. Current-to-target completeness

| Current responsibility cluster | Coverage and disposition |
| --- | --- |
| Activity route parsing/mutation/rendering | mapped to HTTP, retained AC and templates, but `mjl_activity_monitoring_context` snapshot and current monitoring dispatch need AR-REV-002 |
| Activity aggregate/assignment/exceptions | cohesive owners retained; avoid splitting merely for line count; fault-contract scope needs AR-REV-006 |
| auth/scope/native password/email | role participation, password adapter, delivery and outbox now mapped; session mutation boundary remains AR-REV-005 |
| reference reads/writes/native adapters | covered by W1/W3; fingerprints/cascade/identity preserved |
| MON/dashboard/alerts | target directories named, but no actual wave owns dashboard/alerts extraction; AR-REV-003 |
| reports/export/spool/audit/timeline | target owners present; snapshot ownership is broader than export and needs AR-REV-002 |
| descriptor/RST libraries/bootstrap/shared tooling | owners present; runtime recognition exception and relative dependency closure need AR-REV-001/007; RST-005 unsupported relocation explicitly deferred |
| form/recovery/feedback/navigation | file groups mapped but stateful symbols insufficiently separated from renderers; AR-REV-004 |
| JS/CSS/native auth templates/languages | contract preservation/deferred split appropriate; no invented AJAX or redesign |
| deny-only documents/native guard | retain unchanged, no new delivery module |
| dead/historical candidates | retain or explicitly prove removal; no silently orphaned table/function |

The proposed target is therefore broadly evidence-backed, but the assertion
that no important responsibility is orphaned is premature at wave and
side-effect level. These are not requests to create more classes: retention
or a small procedural ownership correction is often sufficient.

Engineering Standard readiness is incomplete. Business writes, ordinary SQL,
native adapters, templates and JS/CSS direction are mostly clear. The standard
cannot yet unambiguously state which runtime code may call schema checks,
which read owner may begin a snapshot, which owner changes sessions, and which
transaction guarantees are already preserved versus newly required.

## 21. Deferred decisions

| Proposal deferral | Classification | Reason/trigger |
| --- | --- | --- |
| namespaces/PSR-4/Composer | CORRECTLY_DEFERRED | no audited need; native discovery retained |
| static analysis/format tools | CORRECTLY_DEFERRED | need measured defect goal and supported baseline |
| external split of AC | CORRECTLY_DEFERRED | current aggregate is cohesive and deep |
| exact auth class count | MUST_DECIDE_BEFORE_WAVE_4 | count can wait; session effect ownership cannot and is MUST_DECIDE_BEFORE_FREEZE under AR-REV-005 |
| deeper CSS/JS decomposition | MUST_DECIDE_BEFORE_WAVE_5 | only if splitting; retain otherwise; authority/DOM characterization first |
| legacy helper removal | MUST_DECIDE_BEFORE_WAVE_7 | caller proof; otherwise defer removal |
| historical branch/migration retirement | CORRECTLY_DEFERRED | current proposal retains it; decide supported baselines before W6 moves affected implementations |
| `project_note` deletion | CORRECTLY_DEFERRED | not code cleanup; lifecycle compatibility decision required |
| cron continuation/entity topology | CORRECTLY_DEFERRED | reconciler behavior unchanged |
| export concurrency | CORRECTLY_DEFERRED | no observed workload requirement |
| export retry identity | MUST_DECIDE_BEFORE_WAVE_5 | only substeps touching cleanup/retry semantics |
| Phase 4/accounting/official reports | CORRECTLY_DEFERRED | explicit product gates |
| production fonts/CSP/mail/URL/secrets | CORRECTLY_DEFERRED | no production preparation authorized |
| runtime readiness, read snapshots, stateful helper ownership | MUST_DECIDE_BEFORE_FREEZE | these are current responsibilities whose target rules conflict or are incomplete, not optional future mechanisms |

No deferred item is declared NO_LONGER_RELEVANT without reachability or scope
evidence. Safe deferral means an explicit retained current owner, not a target
box with no migration destination.

## 22. Consolidated findings

| ID | Severity | Architecture section | Finding | Audit/source evidence | Impact | Required correction | Blocks freeze? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AR-REV-001 | HIGH | 3/4/5/6/16, especially lines 130/185/267/306 | required runtime schema checks have no permitted dependency | audit 02/05/07; Activity access 3–17; monitoring access 3–23; export target checks | compliant implementation must either skip readiness or violate the architecture; authorization/current-vs-predecessor path unclear | permit shared non-DDL exact recognition for runtime; reserve transitions for guarded lifecycle entrypoints; map callers | YES |
| AR-REV-002 | MEDIUM | 3/6/8/16, line 124 | non-export read snapshots have no named legal owner | Activity route 290–310; monitoring route 208–222; report route 122–142 | lost read consistency/timeouts or retained mixed route transactions | name read-use-case owner and exception, snapshot/error/budget contract and W2/W5 handoff | YES, incomplete RT-010 chain |
| AR-REV-003 | MEDIUM | 6/16/17, lines 296/322/951/974 | monitoring targets lack a wave after W1 was narrowed | audit 02/16; current index/alerts/monitoring routes; W1 reference-only, W5 report-only scope | final target cannot be reached by declared waves; misleading preservation trace | retain/defer explicitly or name bounded monitoring substep and exact gate | YES, incomplete RT-010 chain |
| AR-REV-004 | MEDIUM | 3/6/7/10, lines 127/326/339/521 | session-backed form/UI effects hidden by broad file mapping | Activity hidden 250–252, render_form 341; form submission store; feedback render-and-clear; navigation shell | duplicate/early token issue, recovery consumption or policy work in supposedly pure templates | assign effectful preparation to handler and pure markup to presenter; retain existing helpers/contracts | YES, incomplete RT-003 chain |
| AR-REV-005 | MEDIUM | 3/4/9/16, lines 123/172/283/381/447 | session invalidation/completion ownership ambiguous | auth binding/clear 487–500; complete_session 629–640; verify_otp 675–677; hooks | security-sensitive effect/commit order depends on implementer interpretation | choose explicit session effect owner/dependency and preserve exact binding/regeneration/clear order | YES, ambiguous SEC-AUTH-004/005 |
| AR-REV-006 | MEDIUM | 8/16, lines 390–400 and W2/W4 | universal transaction failure promises exceed relocation scope | reference closure proof; auth unchecked begins/rollbacks; AA rollbackOutcome 246–250; AC transaction | falsely certifies existing guarantees or introduces unplanned hardening during moves | distinguish reference preservation from target-wide corrections; allocate fault proof/work or qualify pending debt | YES, weak DB-002 scope |
| AR-REV-007 | MEDIUM | 5/6/16 W6 | relocation/rollback unit omits runtime callers and relative SQL resources | RST-006A 226/388–391; RST-006B 226/233; RST-012 3/93; runtime includes | moved libraries may load wrong/missing SQL or old includes; descriptor-only revert insufficient | define caller/resource-closed move, or delegate at existing paths; preserve source/load checks and exact-state gates | NO independently; required before W6 |

Medium findings can block this review's approval because the user requires all
35 mappings and standard-ready ownership, not merely zero HIGH findings.
There are no LOW or NOTE findings counted; accepted trade-offs are observations
in sections 5/6/21, not extra unnumbered defects.

## 23. Required corrections

1. **AR-REV-001**
   - Affected sections: 3–6, 11, 16–17 and dependency review.
   - Evidence: exact runtime detector consumers listed in sections 9/22.
   - Problem: read-only readiness is categorized with forbidden lifecycle calls.
   - Required correction: distinguish recognition from transition execution;
     name the shared read-only owner/location and permitted consumers; preserve
     exact definitions, unknown -> deny/unavailable and current/predecessor
     selection without granting HTTP DDL access.
   - Preservation IDs: RT-011, SEC-AUTHZ-003/004, DB-003/004, LIFE-003.
   - Waves: W2/W5/W6; runtime callers must work before W6.
   - Re-review: trace Activity access, monitoring, export and AC readiness through
     the allowed graph; verify no duplicated schema contract or reverse edge.

2. **AR-REV-002**
   - Affected sections: 3, 6, 8, 16–17.
   - Evidence: the three read snapshot owners listed in section 13.
   - Problem: export-only transaction exception excludes existing consistent reads.
   - Required correction: name the smallest read orchestration owner, preserving
     repeatable-read scope, checked begin/commit, unavailable behavior and DB
     budget restoration. State what moves in W2 and what remains stable for W5.
   - Preservation IDs: RT-010/011, DB-001, SEC-AUTHZ-003/004.
   - Waves: W2/W5.
   - Re-review: follow current list/detail/review/preview paths and their failure
     handling, with focused existing or planned characterization identified.

3. **AR-REV-003**
   - Affected sections: 6, 16–18.
   - Evidence: target monitoring rows versus actual W1/W5 scopes.
   - Problem: index/dashboard/alerts have target owners but no migration owner.
   - Required correction: explicitly retain/defer them, or name a bounded
     monitoring substep with its actual files and `test:vui09`/monitoring proof
     as appropriate; do not silently broaden reporting work.
   - Preservation IDs: RT-010/011, DB-001, SEC-AUTHZ-003/004.
   - Waves: W1/W5 trace correction; W2 shared current-list dependency.
   - Re-review: reverse-trace every monitoring target to a retained or moved
     responsibility, exact gate and rollback unit.

4. **AR-REV-004**
   - Affected sections: 3, 6–7, 10, 16.
   - Evidence: form issuance/recovery/feedback/navigation sources in section 15.
   - Problem: state effects are hidden under UI/presentation mappings.
   - Required correction: map issue/consume/recovery/feedback draining and shell
     eligibility to request preparation; rendering receives prepared values.
     Retain TTL/cap/context/mismatch behavior and current partial recovery;
     no new session service or token redesign is required.
   - Preservation IDs: RT-002/003/008, SEC-AUTHZ-004.
   - Waves: W1 where controls are prepared, W2 and any W5 shared UI extraction.
   - Re-review: ensure each effect occurs once and pure renderers do not mutate
     session state or query policy.

5. **AR-REV-005**
   - Affected sections: 3–4, 6, 9, 16 and deferred auth decisions.
   - Evidence: `mjl_auth_complete_session`, verify/clear/binding functions and hooks.
   - Problem: read-only policy and auth command both appear to own session effects.
   - Required correction: select a minimal explicit contract, such as pure
     validity decisions plus a private Dolibarr session adapter owned by auth.
     Name the mutation owner, data dependency, regeneration/clear/binding and
     post-successful-commit sequencing; preserve native session representation.
   - Preservation IDs: SEC-AUTH-004/005, SEC-AUTHZ-001/002.
   - Waves: W4.
   - Re-review: simulate OTP success, failed commit, role/password change and
     native login bypass; confirm the policy itself performs no undeclared effect.

6. **AR-REV-006**
   - Affected sections: 8, 14–17 and error handling.
   - Evidence: checked reference closure versus other owners' current behavior.
   - Problem: relocation cannot establish new universal failure guarantees.
   - Required correction: preserve the reference contract exactly; separately
     identify any desired new transaction-failure corrections and smallest fault
     tests under their owning future wave, or state them as unapproved debt.
     Do not broaden W2 silently or weaken essential reference quarantine.
   - Preservation IDs: DB-002, RT-004/014; reference RT-008 remains protected.
   - Waves: W2/W3/W4, according to the owners actually changed.
   - Re-review: match every mandatory failure guarantee to current evidence or
     an explicit scoped future correction and gate.

7. **AR-REV-007**
   - Affected sections: 5–6, 11, 16 rollback and tests.
   - Evidence: schema include and SQL asset paths listed in section 14.
   - Problem: path relocation affects more than the descriptor/library files.
   - Required correction: prefer delegation at current paths, or list the whole
     runtime/CLI/include/resource closure for a move and revert. Preserve SQL
     locations or deliberately fix their resolved roots in the same unit; add
     source/load-path checks to the already named affected lifecycle gates.
   - Preservation IDs: RT-011/014, DB-003/004, LIFE-003.
   - Waves: W6 with W2/W5 consumers.
   - Re-review: resolve all requires/assets before and after relocation and
     verify rollback reverses the complete dependency unit without claiming DDL undo.

Adversarial consistency pass: each finding was checked against the related
wave, preservation mapping and actual source. Existing section 9 fixes for
auth/access composition and email delivery were retained as valid counterevidence,
not rediscovered as defects. Session findings were reduced to MEDIUM because
explicit dependency passing is allowed. The concrete prohibition on runtime
readiness remains HIGH. No additional framework, schema change or runtime fix
is required to revise the proposal. A subsequent task must edit document 17;
this review intentionally does not.

## 24. Final architecture verdict

```text
Architecture proposal reviewed: YES
Preservation requirements examined: 35 / 35
Preservation requirements verified as completely mapped: 29 / 35
CRITICAL findings: 0
HIGH findings: 1
MEDIUM findings: 6
LOW findings: 0
Migration waves reviewed: 7 / 7 (plus W0 prerequisite)
Migration waves ready: 3 / 7 (plan feasibility, subject to prerequisites)
Investigation scenarios improved/equivalent: 5 / 6
Dolibarr compatibility: PASS_WITH_NOTES
BC-018 preserved: YES
BC-019 preserved: YES
Technical Admin reset contract preserved: YES
Reference transaction contract preserved: YES
Final verdict: ARCHITECTURE_REVISION_REQUIRED
```

Approval conditions fail on the runtime-readiness dependency, incomplete
preservation chains, one harder investigation path, and insufficient precision
for the later Engineering Standard. Document 17 remains unchanged and the
architecture is not frozen. The numbered corrections above define the next
revision/re-review scope; no implementation wave is authorized.
