# MJL W2 Readiness Review

## Verdict

```text
W0_COMPLETE
W1_COMPLETE
W2_COMPLETE
W3–W7: NOT_AUTHORIZED
```

This document remains the W2 pre-authorization evidence and traceability
ledger. The user subsequently authorized its exact bounded slice, and every
constrained characterization, cutover gate, disposable Phase 2 check, and final
independent review passed. Completion does not imply feature acceptance or
production readiness and authorizes no W3 work.

## Review basis and confidence

| Evidence | Result |
| --- | --- |
| Post-W1 baseline | `03aad09` on `main`; clean worktree before this review |
| Frozen target architecture | `ARCHITECTURE_FROZEN`; SHA-256 `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| Frozen Engineering Standard | `STANDARD_FROZEN`; SHA-256 `a47f2d942172a4685b02efce027ca04c0a2361f258ebd8c0b776117c97f8f62e` |
| Historical independent review | unchanged; SHA-256 `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |
| Prior wave | W1 completed the accepted adapter -> handler -> prepared data -> template pattern |
| Preservation baseline | all 35 identifiers remain present; W2 maps the 15 identifiers named below |
| Current-state sources | Activity root, route/form/access libraries, Activity and monitoring classes, monitoring route, browser module, focused suites, current UI audits |

Confidence was **high** for authorization readiness. The route, owner,
security, data, session-effect, presentation, frontend, verification and
rollback seams were identifiable at the post-W1 baseline. The bounded proof
identified here was added before the corresponding responsibilities moved and
passed again after cutover; no product or architecture amendment was needed.

## Exact W2 boundary

| Frozen contract field | W2 value |
| --- | --- |
| Purpose | separate Activity HTTP/read/presentation responsibilities while protecting the existing deep aggregate seam |
| Current problem | the 549-line Activity route and Activity branch of monitoring mix request, access, session effects, reads and HTML, obscuring ownership and failure flow |
| Target objective | traceable `request -> policy -> command/query -> presenter` with one owner for every old read/render/session effect |
| Prerequisites | accepted W1 pattern and Activity route characterization before movement |
| Required outcome | handler, procedural monitoring read orchestration at `lib/monitoring/mjl_monitoring_read.lib.php`, pure preparation/templates; unchanged `MjlActivityCommand` and `MjlMonitoring` interfaces |
| Coexistence | additive modules and branch-by-branch delegation are temporary; each reachable request has one authoritative executor |
| Rollback | source revert of the affected handler/template switch; no schema/data reversal |
| Exit | target path traceable, superseded ownership removed, preservation and affected gates pass |
| W3 relationship | W2 completes cleanly and stops; W3 remains separately reviewed and authorized |

W2 separates the complete `/custom/mjlfinancement/activities.php` HTTP and
presentation surface while preserving behavior. It covers:

- GET list, detail, `create`, `edit`, and `review` views;
- POST `create_draft`, `create_submit`, `save_structure`, `submit_revision`,
  `abandon`, `restore`, `review_revision`, `assignment_change`, and
  `request_cancellation` dispatch;
- the Activity-only list/read/render branch currently reached through
  `mjl_monitoring_page('activities')`;
- Activity-specific request parsing, route policy, CSRF/submission tokens,
  recovery, feedback, redirects, shell preparation, read orchestration, view
  preparation, templates, and the existing Activity DOM/JavaScript contract.

The root URL and every action name remain stable. `activities.php` becomes the
thin root adapter and hands off once to the Activity HTTP handler. The handler
owns HTTP and session-backed effects; the frozen procedural monitoring read
module at `lib/monitoring/mjl_monitoring_read.lib.php` owns bounded snapshots
and read-failure mapping; `MjlMonitoring` remains the scoped query owner;
presentation preparation supplies pure templates.

### Explicit exclusions

- no split or behavior change inside `MjlActivityCommand`,
  `MjlActivityAssignment`, or `MjlMonitoring`;
- no workflow, role, assignment, financial, revision, cancellation, label,
  URL, filter, pagination, redirect, error, audit, or entity-scope redesign;
- no `operations.php` or `operationrequests.php` handler extraction;
- no dashboard, alerts, report/export generation, chronology behavior/content,
  navigation, auth, lifecycle, cron, document, schema, DDL, dependency, or
  Dolibarr-core redesign; only the chronology ownership split in T11I–T11K
  and preparation of the existing conditional Activity report links move;
- no DOM redesign, CSS redesign, new browser storage/network behavior, generic
  repository, `MjlActivityQuery`, framework, container, or general cleanup;
- no W3–W7 work, production preparation, or persistent fixture data.

The Activity cancellation form and its POST dispatch are in W2 because they
are produced and received by `activities.php`. The cancellation command's
locked business behavior remains protected inside `MjlActivityCommand`.
Operation execution and request-queue handlers remain outside W2.

### Exclusion ledger

| Excluded item | Authority / reason | Deferred to | W2 dependency? | Must remain unchanged? | Evidence |
| --- | --- | --- | --- | --- | --- |
| Operation execution handler | frozen W2 names Activity route only | later authorized handler wave | No | Yes | `operations.php`, `mjl_operation_route.lib.php` |
| Exception request-queue handler | frozen W2 names Activity route only | later authorized handler wave | No | Yes | `operationrequests.php`, its route library |
| Dashboard and alerts presentation | explicitly excluded by W2 exit | W5 | No | Yes | monitoring route non-Activity branches |
| Report/export generation and audit reports | not in W2 affected list; T11L/T11M only prepare existing Activity-link visibility/URLs | W5 | No | Yes | report/export routes and classes |
| Reference and access writes | frozen W3 scope | W3 | No | Yes | document 17 W3 |
| Authentication split | frozen W4 scope | W4 | No | Yes | document 17 W4 |
| Lifecycle/descriptor extraction | later frozen wave | W6/W7 as frozen | No | Yes | document 17 later waves |
| Command aggregate split | explicitly forbidden | no approved destination | No | Yes | document 17 W2 |
| `MjlMonitoring` interface/query redesign | explicitly unchanged; no competing query class | W5 only if separately authorized | No | Yes | document 17 W2 |
| General `.lib.php` cleanup | no responsibility-specific authority | unapproved | No | Yes | Engineering Standard sections 3–5 |
| General reference cleanup | completed W1 slice is outside W2 | W3 or separate authority | No | Yes | DEC-062 |
| General deduplication | structural movement does not authorize it | case-specific later work | No | Yes | Engineering Standard section 15 |
| General runner cleanup | risk-based checks only | separate tooling task | No | Yes | acceptance guide |
| BC-005/006/007 cleanup | deferred verification debt; not required by named gates here | separate task if encountered | No | Yes | architecture section 15 |
| Static-analysis rollout | frozen Standard says deferred | separately approved tooling | No | Yes | Standard section 17 |
| PHPCS | not configured | separately approved tooling | No | Yes | Standard section 17 |
| PHPStan | not configured | separately approved tooling | No | Yes | Standard section 17 |
| ESLint | not configured | separately approved tooling | No | Yes | Standard section 17 |
| Stylelint | not configured | separately approved tooling | No | Yes | Standard section 17 |
| Dependency upgrades | no W2 need | separate approved maintenance | No | Yes | W2 non-goals |
| CI changes | no W2 need | separate approved tooling | No | Yes | task mode |
| Schema/DDL/data conversion | W2 is source-only separation | no W2 destination | No | Yes | document 17 W2 rollback |
| Formatting/general defects | unrelated cleanup is prohibited | owning future task | No | Yes | Standard section 18 |
| Dolibarr core | repository invariant | never through W2 | No | Yes | `AGENTS.md` and Standard section 3 |
| W0/W1 implementation | completed baselines are protected | none | W1 pattern is prerequisite only | Yes | commits `bccf5a7`, `03aad09` |

All **25/25** explicit exclusions are reconciled. None is a hidden W2
requirement.

## Preservation and security mapping

| IDs | W2 obligation |
| --- | --- |
| RT-001–003 | Preserve Dolibarr bootstrap, deny-before-render/mutation, CSRF and contextual one-use submission validation. |
| RT-004–009 | Preserve command/assignment interfaces, locked reauthorization, aggregate ownership, separation of duties, integer-XOF rules, versions and terminal transitions without moving internals. |
| RT-010 | Preserve active-entity and role/current-assignment scoping in `MjlMonitoring` and Activity access checks. |
| RT-011 | Preserve current/predecessor/unavailable schema selection and the target-schema monitoring list path. |
| SEC-AUTHZ-003/004 | Preserve current Activity assignment visibility and layered UI, route, command and DB enforcement. |
| DB-001/002 | Preserve entity predicates and transaction-bound audit; W2 introduces no business write transaction. |

The other 20 preservation identifiers remain protected but are not moved by
W2. Authentication, document containment, exports, lifecycle, cron, bootstrap,
access administration and reference behavior stay with their existing owners.

## Atomic traceability ledger

Each row is one reviewable responsibility. `Characterize first` means the
proof must be added and pass before that responsibility moves; it is not
permission to alter behavior.

| ID | Current owner/evidence | W2 owner | Preserved contract | Entry proof | State |
| --- | --- | --- | --- | --- | --- |
| W2-T01 | `activities.php` bootstraps, requires route, calls `mjl_activity_route()` | root adapter -> one Activity handler | URL, Dolibarr bootstrap, DB close | source contract plus direct route checks | READY |
| W2-T02 | `mjl_activity_route()` lines 144–184 | HTTP handler + narrow Activity policy | login, role, entity, assignment, state and exact action/method denial | `test:phase2`, VUI-03–06; retain direct 403 cases | READY |
| W2-T03 | route lines 148–176 | HTTP handler | content length, 64 KiB cap, scalar IDs/actions, allowed GET keys and POST action vocabulary | existing malformed/oversized/unknown-input cases | READY |
| W2-T04 | route lines 217–247 | HTTP handler | CSRF, contextual token, payload mapping, finite result, recovery and 303 redirect | existing replay/mutation-count proof plus focused effect contract | READY_WITH_CONSTRAINTS |
| W2-T05 | `mjl_form_submission.lib.php` | retained helper invoked by handler | one use, 7,200 s TTL, 20-token per-user cap, mismatch non-consumption | reuse focused contract; add Activity context/ordering assertions | READY_WITH_CONSTRAINTS |
| W2-T06 | `mjl_activity_form.lib.php`; form render consumes recovery | retained helper invoked by handler before rendering | user/entity/object/view binding, 600 s TTL, 64 KiB cap, success-only consumption | add focused valid/mismatch/expired/once assertions | READY_WITH_CONSTRAINTS |
| W2-T07 | `mjl_activity_result_feedback()` reads query state while rendering | handler prepares feedback; presenter renders value | existing code/message mapping and one read per request | focused prepared-feedback assertion | READY_WITH_CONSTRAINTS |
| W2-T08A | route uses `mjl_monitoring_readiness()` to select predecessor versus target list/read behavior | handler using the retained read-only readiness detector | exact 0/1/unavailable selection and DB-session budget restoration | focused readiness-selection characterization | READY_WITH_CONSTRAINTS |
| W2-T08B | target-schema list delegates to `mjl_monitoring_page('activities')` | monitoring read + presenter/template; monitoring caller may reuse read until W5 | filters, 50-row page, exact counts, role/assignment/entity scope, read-only expansions | VUI-03 plus route/access cases | READY |
| W2-T09 | monitoring route owns list snapshot and three session budgets | `mjl_monitoring_read.lib.php` list snapshot | checked repeatable-read begin/commit/rollback and restoration on every path | add begin/commit/read-failure/restoration fault assertions | READY_WITH_CONSTRAINTS |
| W2-T09A | readiness-0 list calls `MjlActivity::fetchReadProjection()` without monitoring snapshot | monitoring read orchestrates the retained compatibility query owner | same filters, 51-row fetch, assignment/entity scope, false-to-bad-request outcome | focused fallback list characterization | READY_WITH_CONSTRAINTS |
| W2-T10A | detail/review snapshot boundary in `mjl_activity_monitoring_context()` | `mjl_monitoring_read.lib.php` snapshot owner | checked isolation/begin/commit/rollback and statement-time restoration | add begin/commit/read-failure/restoration fault assertions | READY_WITH_CONSTRAINTS |
| W2-T10B | detail/review calls `MjlMonitoring::activities()` for one scoped Activity | retained `MjlMonitoring`, orchestrated by monitoring read | exactly one authorized scoped row or current failure | focused scoped-row/read-failure assertion | READY_WITH_CONSTRAINTS |
| W2-T10C | detail/review calls `MjlMonitoring::reviewFacts()` and action projection | retained `MjlMonitoring`, orchestrated by monitoring read | identical review facts and eligibility inputs | focused review-facts/action assertion | READY_WITH_CONSTRAINTS |
| W2-T10D | readiness-0 review eligibility queries revision contributors | monitoring read returns contributor fact; Activity policy decides | entity/revision/actor binding and no-self-review denial | focused fallback contributor characterization | READY_WITH_CONSTRAINTS |
| W2-T10E | readiness-0 final review eligibility queries prior prevalidator | monitoring read returns prevalidator fact; Activity policy decides | entity/revision binding and distinct-reviewer denial | focused fallback prevalidator characterization | READY_WITH_CONSTRAINTS |
| W2-T11A | `mjl_activity_fetch()` queries the Activity/native parent labels | monitoring read | same entity joins, row shape and not-found outcome | focused read-shape characterization | READY_WITH_CONSTRAINTS |
| W2-T11B | `mjl_activity_operations()` queries ordered Activity Operations/types | monitoring read | entity/Activity scope, removed-row option and row order | focused read-shape characterization | READY_WITH_CONSTRAINTS |
| W2-T11C | `mjl_activity_revision()` queries one exact Activity revision | monitoring read | entity/Activity/revision binding and not-found outcome | focused read-shape characterization | READY_WITH_CONSTRAINTS |
| W2-T11D | review renderer queries decision history | monitoring read | entity/revision binding and chronological order | focused read-shape/failure characterization | READY_WITH_CONSTRAINTS |
| W2-T11E | `mjl_activity_reference_options()` queries Partner/Project choices | monitoring read | entity, active-or-selected semantics, Project parent data and ordering | focused option-shape characterization | READY_WITH_CONSTRAINTS |
| W2-T11F | `mjl_activity_type_options()` queries Operation Type choices | monitoring read | entity, active-or-selected semantics and ordering | focused option-shape characterization | READY_WITH_CONSTRAINTS |
| W2-T11G | `mjl_activity_agent_options()` queries eligible active Agents | monitoring read | same-entity active non-Admin Agent role, flags and ordering | focused option-shape characterization | READY_WITH_CONSTRAINTS |
| W2-T11H | detail obtains current assignments from `MjlActivityAssignment` | retained assignment reader, orchestrated by monitoring read | current entity/Activity assignments and primary flag | focused read-shape characterization | READY_WITH_CONSTRAINTS |
| W2-T11I | `mjl_activity_render_timeline()` parses `chronology_cursor` and review/list URL state | Activity HTTP handler | same cursor validation, allowed query keys and view-bound pagination inputs | focused cursor/URL characterization | READY_WITH_CONSTRAINTS |
| W2-T11J | `mjl_activity_timeline()` authorizes and queries bounded audit events | frozen audit/timeline projection owner under `lib/audit/` | same entity/assignment scope, export-event filter, cursor anchor, 51-row bound and failure outcome | focused authorized/denied/cursor/read-failure characterization | READY_WITH_CONSTRAINTS |
| W2-T11K | `mjl_activity_render_timeline()` emits chronology HTML | Activity preparation + detail/review templates using prepared timeline projection | same heading, unavailable/empty/events, escaping and pagination links | extended VUI-05/VUI-06 chronology assertions | READY_WITH_CONSTRAINTS |
| W2-T11L | legacy list renderer checks export-table availability before showing its report link | monitoring read prepares list report-link availability through retained detector | same table-exists condition, filter mapping and hidden state | focused predecessor list/link characterization | READY_WITH_CONSTRAINTS |
| W2-T11M | detail renderer checks export-table availability before showing Activity report link | monitoring read prepares detail report-link availability through retained detector | same table-exists condition, Activity ID URL and hidden state | focused detail/link characterization | READY_WITH_CONSTRAINTS |
| W2-T12 | `mjl_activity_render_list()` and Activity branch of monitoring route | Activity presentation + list template | French labels, filters, empty/error states, links, pagination and escaping | VUI-03 and phase2 list cases | READY |
| W2-T13 | `mjl_activity_render_form()`/operation row | Activity preparation + form template | recovery subset, field names, 50-row cap, native fallback, two create submitters | VUI-04, financial-preview unit, phase2 POST cases | READY |
| W2-T14 | `mjl_activity_render_detail()` | Activity preparation + detail templates | financial/assignment/operation facts, tabs, chronology, exact guarded forms | VUI-05; affected VUI-08 case | READY |
| W2-T15 | `mjl_activity_render_review()` | Activity preparation + review templates | immutable snapshot, eligibility, decisions, reasons, late-validation and chronology | VUI-06, phase2 command proof | READY |
| W2-T16 | `mjl_activity_hidden()` issues CSRF/context tokens during rendering | handler prepares form effects; template receives fields | exact action/object/revision/version context and no template session effect | focused form-effect contract then VUI-04–06 | READY_WITH_CONSTRAINTS |
| W2-T17A | POST `create_draft` calls `createDraft()` | handler invokes unchanged interface | validation, reference allocation, primary assignment, transaction/audit | `test:phase2`; exact create-draft route/command outcome | READY |
| W2-T17B | POST `create_submit` calls `createAndSubmit()` | handler invokes unchanged interface | balanced structure, immutable revision, assignment, transaction/audit | `test:phase2`; exact create-submit outcome | READY |
| W2-T17C | POST `save_structure` calls `saveStructure()` | handler invokes unchanged interface | assignment/state/date/version/financial checks and audit | `test:phase2`; exact save outcome | READY |
| W2-T17D | POST `submit_revision` calls `submitRevision()` | handler invokes unchanged interface | exact version, changed structure, immutable revision and audit | `test:phase2`; exact submit outcome | READY |
| W2-T17E | POST `abandon` calls `abandonDraft()` | handler invokes unchanged interface | assigned Agent, unsubmitted draft, reason, assignment closure and audit | `test:phase2`; exact abandon outcome | READY |
| W2-T17F | POST `restore` calls `restoreDraft()` | handler invokes unchanged interface | Validator, pre-start abandoned Activity, selected Agent, reason and audit | `test:phase2`; exact restore outcome | READY |
| W2-T17G | POST `review_revision` calls `reviewRevision()` | handler invokes unchanged interface | exact revision/version, role/no-self-validation, decision/reason and audit | `test:phase2` + VUI-06 | READY |
| W2-T17H | POST `request_cancellation` calls `requestCancellation()` | handler invokes unchanged interface | assignment, exact version/state/reason and command transaction/audit | affected VUI-08 + focused command proof | READY |
| W2-T18 | route invokes `MjlActivityAssignment::changeAssignment()` | handler invokes unchanged interface | Validator role, active Agent, exact version, transaction/audit | VUI-05 plus existing assignment/phase2 proof as affected | READY |
| W2-T19 | Activity cancellation form is produced on detail | prepared detail presentation + template | current eligibility, exact version/reason fields, one guarded progressive/no-JS form | affected VUI-08 scenario | READY |
| W2-T20 | `activities.js` consumes form DOM; shared UI consumes dialogs/tabs/forms | retained browser modules; templates produce same contract | indexed names, stable IDs/data hooks, BigInt-safe preview, submitter/default and no-JS fallback | financial-preview unit and VUI-04–06/08 | READY |
| W2-T21 | shell/header/footer and unavailable rendering occur in route/monitoring route | handler prepares shell state; presenter renders | private no-store where currently set, French unavailable state, navigation and asset conditions | focused response/source contract and selected VUI suites | READY |
| W2-T22 | old route and monitoring Activity branch are authoritative | old moved branches deleted after cutover | one owner per HTTP/read/render/session responsibility; monitoring callers may use the same monitoring read only | source ownership contract and diff review | READY |
| W2-T23 | W3 follows W2 in the frozen sequence | completed Activity separation only; no reference/access implementation | W3 starts from a stable handler/presentation pattern and no Activity ownership debt | W2 exit review | READY |
| W2-T24 | frozen architecture defines W2 completely | governance retained | no architecture amendment | frozen hash and scope reconciliation | READY |
| W2-T25 | frozen Standard permits the required owners and sequencing | governance retained | no Standard amendment | frozen hash and rules reconciliation | READY |

Ledger coverage is **50/50 identified concerns**. Twenty-six rows require
characterization before their movement; none requires a new product,
architecture, schema, or operational decision. The ledger does not claim that
the current tests already inject every listed failure.

### Ledger control details

The preceding evidence/owner table and this control table form one ledger
joined by stable ID. Behavior change is `NO` for every row.

| IDs | Type | Authority | Action | Depends on / must precede | Cutover | PRE -> TRANSITION -> POST | Rollback / W3 / constraint | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | ROUTE | architecture W2; Standard 3–5; RT-001 | EXTRACT | W1 pattern; precedes T02–04/T21 | CG-W2-01 | root+legacy route -> root+new handler with one delegated owner -> root+new handler | source revert; no W3 output | READY |
| T02 | INVARIANT | W2; SEC-AUTHZ-003/004; RT-002 | MOVE | T01; precedes every view/POST | CG-W2-01 | route guard -> one handler/policy branch -> handler/policy | source revert | READY |
| T03 | RESPONSIBILITY | W2; Standard 4; RT-002 | MOVE | T01; precedes T04/T08–19 | CG-W2-01 | route normalization -> one selected handler branch -> handler | source revert | READY |
| T04 | ROUTE | W2; RT-002–009 | MOVE | T03/T05/T06; precedes T17A–T17H/T18/T19 | CG-W2-06 | route dispatch -> handler delegates one executor per action -> handler dispatch | source revert; characterize before movement/cutover, not authorization | READY_WITH_CONSTRAINTS |
| T05 | INVARIANT | W2; Standard 4/9; RT-003 | RETAIN | T02; precedes T04/T16–19 | CG-W2-03/06 | helper called while rendering/dispatching -> handler calls helper -> same helper, handler-owned ordering | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T06 | RESPONSIBILITY | W2 allowed effects; Standard 4 | DELEGATE | T03; precedes T13/T16 | CG-W2-03 | render helper consumes -> handler consumes, legacy renderer receives prepared values -> handler only | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T07 | RESPONSIBILITY | W2 allowed effects; Standard 4/13 | MOVE | T03; precedes T12–15/T21 | CG-W2-01 | renderer reads result -> handler prepares -> presenter renders value | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T08A | INVARIANT | architecture W2; RT-011 | RETAIN | T02/T03; precedes T08B/T09/T09A/T10A–T10E | CG-W2-01/02 | route invokes readiness detector -> handler invokes same detector -> handler | source revert; characterize selection/budget failure before movement/cutover | READY_WITH_CONSTRAINTS |
| T08B | DATA_FLOW | architecture W2/W5 boundary; RT-010/011 | EXTRACT | T02/T08A/T09; precedes T12 | CG-W2-02 | monitoring Activity branch -> same branch calls new read during transition -> Activity handler/caller use one read | source revert; W3 none | READY |
| T09 | RESPONSIBILITY | W2 required characterization; Standard 8 | MOVE | T02/T08A; precedes T08B/T12 | CG-W2-02 | monitoring route snapshot -> one selected read owner -> procedural monitoring read | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T09A | DATA_FLOW | architecture mapping section 6; RT-010/011 | DELEGATE | T02/T08A; precedes T12 | CG-W2-02 | route -> retained `MjlActivity` fallback -> monitoring read -> retained fallback owner -> same post state | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T10A | RESPONSIBILITY | W2 characterization; Standard 8 | MOVE | T02; precedes T10B/T10C/T14/T15 | CG-W2-04/05 | route snapshot -> monitoring read snapshot for selected branch -> monitoring read | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T10B | DATA_FLOW | W2 mapping section 6; RT-010/DB-001 | DELEGATE | T10A; precedes T14/T15 | CG-W2-04/05 | route -> `MjlMonitoring::activities` -> monitoring read -> same query owner -> same post state | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T10C | DATA_FLOW | W2 mapping section 6; RT-010 | DELEGATE | T10B; precedes T14/T15 | CG-W2-04/05 | route -> `reviewFacts`/actions -> monitoring read -> same query/projection -> same post state | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T10D | INVARIANT | W2 policy/read split; RT-006/011; DB-001 | MOVE | T08A/T11C; precedes T15/T17G | CG-W2-05 | route scalar contributor query/policy -> monitoring read fact + selected policy -> same post owners | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T10E | INVARIANT | W2 policy/read split; RT-006/011; DB-001 | MOVE | T08A/T11C; precedes T15/T17G | CG-W2-05 | route scalar prevalidator query/policy -> monitoring read fact + selected policy -> same post owners | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11A | DATA_FLOW | W2 mapping section 6; DB-001 | MOVE | T02; precedes T13–15 | CG-W2-03/04/05 | route Activity query -> additive monitoring read with legacy sole caller -> monitoring read | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11B | DATA_FLOW | W2 mapping section 6; RT-007/DB-001 | MOVE | T02; precedes T13/T14 | CG-W2-03/04 | route Operation query -> additive monitoring read with legacy sole caller -> monitoring read | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11C | DATA_FLOW | W2 mapping section 6; RT-006/DB-001 | MOVE | T02; precedes T15 | CG-W2-05 | route revision query -> additive monitoring read with legacy sole caller -> monitoring read | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11D | DATA_FLOW | W2 mapping section 6; RT-006/DB-001 | MOVE | T11C; precedes T15 | CG-W2-05 | inline decision query -> additive monitoring read with legacy sole caller -> monitoring read | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11E | DATA_FLOW | W2 mapping section 6; DB-001 | MOVE | T02; precedes T13 | CG-W2-03 | route Partner/Project option query -> additive monitoring read -> monitoring read | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11F | DATA_FLOW | W2 mapping section 6; DB-001 | MOVE | T02; precedes T13 | CG-W2-03 | route type option query -> additive monitoring read -> monitoring read | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11G | DATA_FLOW | W2 mapping section 6; SEC-AUTHZ-004/DB-001 | MOVE | T02; precedes T14 | CG-W2-04 | route Agent option query -> additive monitoring read -> monitoring read | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11H | DATA_FLOW | W2 mapping section 6; SEC-AUTHZ-003 | DELEGATE | T02; precedes T14 | CG-W2-04 | renderer -> assignment reader -> monitoring read orchestration -> retained reader | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11I | RESPONSIBILITY | W2 HTTP/presentation boundary; RT-002 | MOVE | T03; precedes T11J/T11K/T14/T15 | CG-W2-04/05 | timeline renderer parses cursor -> handler prepares cursor/view -> handler owns request input | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11J | DATA_FLOW | architecture mapping section 6 monitoring + audit/timeline owners; RT-010/DB-001 | MOVE | T02/T11I; precedes T11K/T14/T15 | CG-W2-04/05 | mixed timeline query -> monitoring read orchestrates additive audit/timeline projection with old caller -> same two owners | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11K | RESPONSIBILITY | architecture mapping section 6; Standard 12 | EXTRACT | T11I/T11J; precedes T14/T15/T20 | CG-W2-04/05 | mixed timeline HTML -> prepared selected partial -> Activity detail/review templates | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11L | DATA_FLOW | W2 read/preparation split; RT-011 | MOVE | T08A; precedes T12 | CG-W2-02 | inline list table-exists call -> monitoring read prepared boolean -> template condition | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T11M | DATA_FLOW | W2 read/preparation split; RT-011 | MOVE | T08A/T11A; precedes T14 | CG-W2-04 | inline detail table-exists call -> monitoring read prepared boolean -> template condition | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T12 | RESPONSIBILITY | W2 pure view; Standard 3/12 | EXTRACT | T07/T08A/T08B/T09/T09A/T11L; precedes T22 | CG-W2-02 | inline list HTML -> one selected presenter/template branch -> pure list template | source revert | READY |
| T13 | RESPONSIBILITY | W2 pure view; Standard 12 | EXTRACT | T05–07/T11A–T11F/T16; precedes T20/T22 | CG-W2-03 | inline form HTML -> selected template -> pure form template | source revert | READY |
| T14 | RESPONSIBILITY | W2 pure view; Standard 12 | EXTRACT | T07/T10A–T10C/T11A–T11B/T11G–T11K/T11M/T16; precedes T20/T22 | CG-W2-04 | inline detail HTML -> selected template -> pure detail templates | source revert | READY |
| T15 | RESPONSIBILITY | W2 pure view; Standard 12 | EXTRACT | T07/T10A–T10E/T11A/T11C–T11D/T11I–T11K/T16; precedes T20/T22 | CG-W2-05 | inline review HTML -> selected template -> pure review templates | source revert | READY |
| T16 | INVARIANT | W2 form effects; RT-003 | MOVE | T05; precedes T13–T15/T17A–T17H/T18/T19 | CG-W2-03–06 | renderer issues -> handler prepares only for selected view -> handler issues, template receives | source revert; characterize before movement/cutover only | READY_WITH_CONSTRAINTS |
| T17A | RESPONSIBILITY | W2 unchanged command; RT-004/005/007; DB-002 | DELEGATE | T02–05/T16; precedes T22 | CG-W2-06 | route `create_draft` -> handler branch -> same `createDraft` -> handler -> same command | source revert; command transaction/audit retained | READY |
| T17B | RESPONSIBILITY | W2 unchanged command; RT-004–008; DB-002 | DELEGATE | T02–05/T16; precedes T22 | CG-W2-06 | route `create_submit` -> handler branch -> same `createAndSubmit` -> handler -> same command | source revert; command transaction/audit retained | READY |
| T17C | RESPONSIBILITY | W2 unchanged command; RT-004/005/007/008; DB-002 | DELEGATE | T02–05/T16; precedes T22 | CG-W2-06 | route `save_structure` -> handler branch -> same `saveStructure` -> handler -> same command | source revert; command transaction/audit retained | READY |
| T17D | RESPONSIBILITY | W2 unchanged command; RT-004–008; DB-002 | DELEGATE | T02–05/T16; precedes T22 | CG-W2-06 | route `submit_revision` -> handler branch -> same `submitRevision` -> handler -> same command | source revert; command transaction/audit retained | READY |
| T17E | RESPONSIBILITY | W2 unchanged command; RT-004/005/008; DB-002 | DELEGATE | T02–05/T16; precedes T22 | CG-W2-06 | route `abandon` -> handler branch -> same `abandonDraft` -> handler -> same command | source revert; command transaction/audit retained | READY |
| T17F | RESPONSIBILITY | W2 unchanged command; RT-004/005/008; DB-002 | DELEGATE | T02–05/T16; precedes T22 | CG-W2-06 | route `restore` -> handler branch -> same `restoreDraft` -> handler -> same command | source revert; command transaction/audit retained | READY |
| T17G | RESPONSIBILITY | W2 unchanged command; RT-004–008; DB-002 | DELEGATE | T02–05/T16; precedes T22 | CG-W2-06 | route `review_revision` -> handler branch -> same `reviewRevision` -> handler -> same command | source revert; command transaction/audit retained | READY |
| T17H | RESPONSIBILITY | W2 unchanged command; RT-004/005/008/009; DB-002 | DELEGATE | T02–05/T16/T19; precedes T22 | CG-W2-06 | route `request_cancellation` -> handler branch -> same command -> handler -> same command | source revert; command transaction/audit retained | READY |
| T18 | RESPONSIBILITY | W2 affected assignment dispatch; SEC-AUTHZ-004; DB-002 | DELEGATE | T02–05/T16; precedes T22 | CG-W2-06 | route -> assignment command -> handler branch -> same command -> handler -> same command | source revert; audit/transaction remain assignment-owned | READY |
| T19 | FRONTEND_CONTRACT | W2 Activity detail presentation; RT-003/009 | EXTRACT | T14/T16; precedes T17H/T20/T22 | CG-W2-04/06 | inline cancellation form -> prepared selected form -> pure detail template | source revert; dispatch remains T17H | READY |
| T20 | FRONTEND_CONTRACT | W2 DOM constraint; Standard 12; frontend audit | GUARD | T12–15; precedes T22 | CG-W2-02–05 | current producers -> compatible selected producers -> equivalent target producers | source revert; no redesign | READY |
| T21 | RESPONSIBILITY | Standard 3/4/13 | MOVE | T01/T07; precedes T22 | CG-W2-01 | route shell/error -> handler-prepared selected state -> handler + presenter | source revert | READY |
| T22 | TRANSITION | W2 exit | RETIRE | T01–21; precedes T23 | CG-W2-07 | legacy authoritative -> one branch owner at every switch -> superseded branches removed | revert whole affected cutover; produces clean W2 exit | READY |
| T23 | W3_DEPENDENCY | frozen sequence and W2 exit | GUARD | T22; must precede any W3 authorization | CG-W2-07 | W2 incomplete -> W2 complete/no Activity debt -> W3 may be separately reviewed | source revert; W3 remains unauthorized | READY |
| T24 | GOVERNANCE | frozen architecture/hash | NONE | scope ledger; precedes authorization | none | frozen -> unchanged -> unchanged | N/A constraint; amendment required: NO | READY |
| T25 | GOVERNANCE | frozen Standard/hash | NONE | control ledger; precedes authorization | none | frozen -> unchanged -> unchanged | N/A constraint; amendment required: NO | READY |

`READY_WITH_CONSTRAINTS` resolution rule for T04–T07, T08A, T09/T09A,
T10A–T10E, T11A–T11M and T16:
before authorization **NO**; before the named responsibility moves **YES**;
before its cutover **YES**. There are no `BLOCKED` or `NOT_APPLICABLE` rows.
All 26 are classified `MUST_ADD_BEFORE_MOVEMENT`; none is
`MUST_ADD_BEFORE_AUTHORIZATION`. Remaining rows are `NOT_REQUIRED` beyond their
listed regression gate; no characterization is merely labelled `OPTIONAL`.

### Current-state reconciliation

All 50 ledger evidence/current-state claims are `VERIFIED_AT_HEAD`. The historical maps remain
consistent after one expected reconciliation: W1 changed only Partner/Project
list ownership, which is outside W2. The post-W1 Activity list still enters the
legacy Activity route and, on target schema, delegates to the Activity branch
of the monitoring route. `CURRENT_STATE_DISCREPANCY` count: **0**.

### Coverage reconciliation

| Population | Coverage | Established denominator |
| --- | --- | --- |
| authoritative W2 scope items | 10/10 | purpose, problem, target, scope, exclusions, prerequisites, outcomes, preservation, verification, exit/rollback/W3 |
| current responsibilities in scope | 47/47 | implementation rows T01–T22, including atomic T08/T09/T10/T11/T17 families |
| target responsibilities | 9/9 | root, handler, policy, procedural monitoring read, retained query owner, audit/timeline projection, preparation, templates, browser consumer |
| affected routes/actions | 14/14 | five GET paths and nine POST actions |
| affected DB/query/write path groups | 28/28 | readiness detection; target and fallback list reads; detail snapshot/Activity/review facts; two fallback authorization reads; nine direct read groups including timeline; two export-link checks; eight aggregate commands; assignment command |
| affected transaction boundaries | 4/4 | list snapshot, detail/review snapshot, aggregate command, assignment command |
| affected frontend contracts | 10/10 | filters/query, indexed rows, Partner/Project relation, finance preview, submitter/form validation, dialogs, tabs, chronology pagination/IDs, conditional report links, ARIA/no-JS |
| affected Dolibarr integration seams | 10/10 | bootstrap, DB, user, entity/config, tokens, header/footer, module paths/loading, DB abstraction, native adapters, session helpers |
| preservation requirements | 35/35 | derived view below |
| required verification gates | 13/13 | G-W2-00–12 below |
| cutover groups | 7/7 | CG-W2-01–07 below |
| W3 dependencies | 1/1 | T23 |
| explicit exclusions | 25/25 | exclusion ledger above |

Coverage reconciliation is **COMPLETE**.

### Preservation derived view

| Preservation ID | Classification | Ledger IDs / enforcement and verification |
| --- | --- | --- |
| RT-001 | DIRECTLY_AFFECTED | T01; root bootstrap -> root bootstrap; G01/G11 |
| RT-002 | DIRECTLY_AFFECTED | T02–04; handler denies before render/mutation; G02/G06–11 |
| RT-003 | DIRECTLY_AFFECTED | T04/T05/T16; handler + retained CSRF/submission helper; G02/G03/G11 |
| RT-004 | INDIRECTLY_AT_RISK | T17A–T17H/T18; unchanged locked commands; G11 |
| RT-005 | INDIRECTLY_AT_RISK | T17A–T17H; unchanged aggregate; G11 |
| RT-006 | INDIRECTLY_AT_RISK | T10D/T10E/T15/T17B/T17D/T17G; unchanged no-self-review and revision/review commands; G04/G09/G11 |
| RT-007 | INDIRECTLY_AT_RISK | T13/T17A–T17D/T20; unchanged server command and preview contract; G05/G07/G11 |
| RT-008 | INDIRECTLY_AT_RISK | T17B–T17H/T18; unchanged expected-version command calls; G08/G09/G11 |
| RT-009 | INDIRECTLY_AT_RISK | T17H/T19; unchanged cancellation command plus equivalent guarded form; G10/G11 |
| RT-010 | DIRECTLY_AFFECTED | T08B/T09/T09A/T10A–T10E/T11A–T11M; retained scoped query/audit projection owners; G04/G06/G08/G09 |
| RT-011 | DIRECTLY_AFFECTED | T02/T08A/T08B/T09A/T10D/T10E/T11L/T11M/T21; same predecessor/target/unavailable behavior; G02/G04/G06/G08/G09 |
| RT-012 | NOT_TOUCHED | exports excluded; current export owner retained; no W2 gate required |
| RT-013 | NOT_TOUCHED | document routes excluded and retained; no W2 gate required |
| RT-014 | NOT_TOUCHED | native adapter behavior not moved; Activity reads retain native boundaries |
| RT-015 | NOT_TOUCHED | cron/reconciler excluded and retained |
| SEC-AUTH-001 | NOT_TOUCHED | invitation lifecycle excluded |
| SEC-AUTH-002 | NOT_TOUCHED | invitation verifier excluded |
| SEC-AUTH-003 | NOT_TOUCHED | reset lifecycle excluded |
| SEC-AUTH-004 | NOT_TOUCHED | OTP excluded |
| SEC-AUTH-005 | NOT_TOUCHED | login hook excluded |
| SEC-AUTH-006 | NOT_TOUCHED | password adapter excluded |
| SEC-AUTHZ-001 | NOT_TOUCHED | role vocabulary retained, not moved |
| SEC-AUTHZ-002 | NOT_TOUCHED | access administration excluded |
| SEC-AUTHZ-003 | DIRECTLY_AFFECTED | T02/T08B/T09/T09A/T10A–T10E/T11A–T11M; route + query assignment scope; G02/G04/G06/G08/G11 |
| SEC-AUTHZ-004 | INDIRECTLY_AT_RISK | T02/T13–T16/T17A–T17H/T18/T19; layered UI/route/command/DB enforcement; G02/G07–11 |
| SEC-DOC-001 | NOT_TOUCHED | denial routes excluded |
| SEC-DOC-002 | NOT_TOUCHED | ECM boundary excluded |
| DB-001 | DIRECTLY_AFFECTED | T02/T08A/T08B/T09/T09A/T10A–T10E/T11A–T11M; explicit entity in policies/reads; G02/G04/G06/G08/G09 |
| DB-002 | INDIRECTLY_AT_RISK | T17A–T17H/T18; audit stays inside unchanged command transactions; G08–11 |
| DB-003 | NOT_TOUCHED | trigger/schema definitions unchanged |
| DB-004 | NOT_TOUCHED | activation/lifecycle unchanged |
| LIFE-001 | NOT_TOUCHED | clean bootstrap unchanged |
| LIFE-002 | NOT_TOUCHED | no review-time tenant; later E2E retains disposable runner/teardown |
| LIFE-003 | NOT_TOUCHED | shared lifecycle/readiness behavior unchanged; T08A exposes the same finite probe for G04 characterization only |
| LIFE-004 | NOT_TOUCHED | unsupported module bootstrap excluded |

All directly affected/at-risk items have target enforcement and a concrete
gate. Items classified `NOT_TOUCHED` include the retained owner and reason;
none is an unqualified N/A.

### Request/action ownership view

| ID | Method/action | PRE owner | TRANSITION owner | POST owner | Resolution |
| --- | --- | --- | --- | --- | --- |
| T08A/T08B/T09/T09A/T12 | GET empty, no `id` (list) | Activity route -> readiness-selected legacy/monitoring branch | exactly one selected handler branch | Activity handler -> monitoring read -> presenter | TARGET_OWNED |
| T14 | GET empty + `id` (detail) | Activity route | exactly one selected handler branch | Activity handler/read/presenter | TARGET_OWNED |
| T13 | GET `create` | Activity route | exactly one selected handler branch | Activity handler/read/presenter | TARGET_OWNED |
| T13 | GET `edit` | Activity route | exactly one selected handler branch | Activity handler/read/presenter | TARGET_OWNED |
| T15 | GET `review` | Activity route | exactly one selected handler branch | Activity handler/read/presenter | TARGET_OWNED |
| T17A | POST `create_draft` | route -> aggregate | handler branch -> same aggregate | handler -> aggregate | TARGET_OWNED |
| T17B | POST `create_submit` | route -> aggregate | handler branch -> same aggregate | handler -> aggregate | TARGET_OWNED |
| T17C | POST `save_structure` | route -> aggregate | handler branch -> same aggregate | handler -> aggregate | TARGET_OWNED |
| T17D | POST `submit_revision` | route -> aggregate | handler branch -> same aggregate | handler -> aggregate | TARGET_OWNED |
| T17E | POST `abandon` | route -> aggregate | handler branch -> same aggregate | handler -> aggregate | TARGET_OWNED |
| T17F | POST `restore` | route -> aggregate | handler branch -> same aggregate | handler -> aggregate | TARGET_OWNED |
| T17G | POST `review_revision` | route -> aggregate | handler branch -> same aggregate | handler -> aggregate | TARGET_OWNED |
| T18 | POST `assignment_change` | route -> assignment command | handler branch -> same command | handler -> assignment command | TARGET_OWNED |
| T17H | POST `request_cancellation` | route -> aggregate | handler branch -> same aggregate | handler -> aggregate | TARGET_OWNED |

No transition permits independent dual mutation execution. Unknown methods or
actions remain denied.

### DB and transaction view

| IDs | Path group | Current -> target owner | Impact | Transaction owner | Compatibility / recovery | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T08A | readiness selection query/budget | route/retained detector -> handler/same detector | NONE | detector-local bounded session change | no persistent change; source revert | READY_WITH_CONSTRAINTS |
| T08B/T09 | target list projection | monitoring route/`MjlMonitoring` -> monitoring read/unchanged `MjlMonitoring` | READ_OWNERSHIP_CHANGE | monitoring read snapshot | no persistent change; source revert | READY_WITH_CONSTRAINTS |
| T09A | predecessor list projection | route/`MjlActivity` -> monitoring read/unchanged compatibility owner | READ_OWNERSHIP_CHANGE | none | no persistent change; source revert | READY_WITH_CONSTRAINTS |
| T10A–T10C | detail/review snapshot, scoped Activity and review facts | Activity route/`MjlMonitoring` -> monitoring read/unchanged `MjlMonitoring` | READ_OWNERSHIP_CHANGE | monitoring read snapshot | no persistent change; source revert | READY_WITH_CONSTRAINTS |
| T10D/T10E | predecessor contributor/prevalidator authorization facts | route scalar queries/policy -> monitoring read facts/Activity policy | READ_OWNERSHIP_CHANGE | none | no persistent change; source revert | READY_WITH_CONSTRAINTS |
| T11A–T11K | nine atomic DB/read paths plus cursor and chronology presentation | route helpers/retained collaborators -> handler + monitoring read + audit projection + prepared presentation | QUERY_RELOCATION_ONLY | none or enclosing monitoring read snapshot as current | no persistent change; source revert | READY_WITH_CONSTRAINTS |
| T11L/T11M | list/detail export-link availability | inline table checks -> monitoring read prepared booleans | QUERY_RELOCATION_ONLY | none | no persistent change; source revert | READY_WITH_CONSTRAINTS |
| T17A–T17H | eight atomic aggregate writes and audit paths | unchanged `MjlActivityCommand` | NONE | unchanged command | state backward compatible: YES; no forward recovery from extraction | READY |
| T18 | assignment writes and audit | unchanged `MjlActivityAssignment` | NONE | unchanged assignment command | state backward compatible: YES; no forward recovery from extraction | READY |

There are 28/28 path groups within these nine derived ownership rows. Last safe
rollback is before each source cutover; no W2 row requires DB restore. Failed
begin/commit/read and budget restoration apply to the two moved read snapshots.
Business commands retain their existing begin/commit/rollback and uncertain-
connection semantics; W2 neither claims nor changes them.

### Frontend contract view

| ID | Contract | Producer -> consumer | PRE -> POST | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| T12 | filter/query names and pagination URLs | list template -> browser/server navigation | same names/values | G06/G11 | READY |
| T13/T20 | indexed Operation IDs, versions, names and 50-row hooks | form template -> `activities.js` | equivalent | G05/G07/G11 | READY |
| T13/T20 | `data-partner-id` dependent Project options | form template -> `activities.js` | equivalent | G07 | READY |
| T13/T20 | amount/date inputs and `MjlFinance.summary` | form template -> preview JS | equivalent | G05/G07 | READY |
| T13/T16/T20 | form actions, submitter names/values, tokens, validation/dirty state | handler/template -> shared UI | equivalent | G03/G07/G11 | READY_WITH_CONSTRAINTS |
| T14/T15/T20 | dialog IDs/data hooks/focus | detail/review templates -> shared UI | equivalent | G08–G10 | READY |
| T14/T20 | tab IDs/ARIA | detail template -> shared UI | equivalent | G08 | READY |
| T11I–T11K/T14/T15 | chronology cursor, section/event IDs and pagination links | handler/audit projection/templates -> browser navigation | equivalent | G08/G09 | READY_WITH_CONSTRAINTS |
| T11L/T11M/T12/T14 | conditional list/detail report links and exact URLs | prepared availability/filters -> templates/browser | equivalent | G06/G08 | READY_WITH_CONSTRAINTS |
| T12–15/T20 | table labels, ARIA states and no-JS fallback | templates -> browser/assistive tech | equivalent | G06–G10 | READY |

No AJAX URL or JSON shape is introduced. Behavioral hooks stay explicit; a
cosmetic selector does not become authorization.

### Dolibarr and callback/resource integration

T01–T03/T05/T08A/T08B/T09/T09A/T10A–T10E/T11A–T11M/T16/T17A–T17H/T18/T19/T21 cover `main.inc.php`, `$db`, `$user`,
`$conf->entity`, native CSRF helpers, session-backed form helpers,
`llxHeader`/`llxFooter`, `DOL_DOCUMENT_ROOT`/`DOL_URL_ROOT`, explicit class
loading, Dolibarr DB methods and retained native objects. `$langs` and
`$hookmanager` are not used by the affected route and remain untouched.

Dispatch remains a finite method/action allowlist. No request value selects a
function, class, method, callback, include path or resource. W2 creates no
parallel request framework, authorization framework, transaction abstraction,
ORM or autoloader.

### Verification matrix

These are conditional W2 implementation gates, not commands run by this
documentation review.

| Gate | Ledger IDs | Exact command/test | Oracle and failure proven | Execution path / stage / environment | Mutation class | Blocking? |
| --- | --- | --- | --- | --- | --- | --- |
| G-W2-00 | T24/T25 | frozen `sha256sum`; `git cat-file -e` for W0/W1; `git diff --cached --check`; status/diff inspection | three hashes and two commits resolve exactly; only permitted docs changed; catches governance drift or unauthorized mutation | repository evidence; PRE_W2_BASELINE/DOCUMENTATION_DIFF; local | documentation only | Yes for readiness |
| G-W2-01 | T01/T22/T24/T25 | focused Activity ownership PHP/source contract | root has one handoff; templates lack request/session/DB effects; old branches absent; catches dual authority | source load/inspection; PRE_MOVE/CUTOVER; local | test/source only | Yes at affected cutover |
| G-W2-02 | T02–T04/T21 | focused direct HTTP cases within `npm run test:phase2` | anonymous/Admin/no-role/unassigned/cross-entity/invalid method-action stay denied before protected output or mutation | real route in disposable tenant; PRE_MOVE/POST_CUTOVER | disposable fixtures only | Yes |
| G-W2-03 | T04–T07/T16 | focused PHP contract for Activity form effects | exact context succeeds once; replay/expiry/cap/mismatch, recovery binding/TTL and feedback preparation retain outcomes; catches double/early consumption | real helper + handler seam; PRE_MOVE_CHARACTERIZATION; local/disposable where HTTP needed | session test state | Yes before corresponding move |
| G-W2-04 | T08A/T08B/T09/T09A/T10A–T10E/T11A–T11M | focused read-owner fault/compatibility contract | predecessor/target selection stays exact; failed begin/commit/read yields no partial view; contributor/prevalidator and link conditions stay scoped; changed budgets restore | detector + monitoring read + retained query/projection owners; PRE_MOVE_CHARACTERIZATION; isolated DB double or disposable tenant | disposable DB only | Yes before corresponding move |
| G-W2-05 | T13/T20 | `node --test tests/unit/mjl-financial-preview.test.js` | null/zero, >safe-integer difference and invalid/overflow rendering remain exact | production JS module; FOCUSED_IMPLEMENTATION; local | none | Yes when form producer moves |
| G-W2-06 | T02/T08A/T08B/T09/T09A/T11L/T12/T20 | `npm run test:vui03`, extended with predecessor list/link characterization before its move | assigned scoped target/fallback lists, filters/counts/pagination, conditional report link, read-only Operations and no-JS reflow remain usable | real route/browser; DISPOSABLE_E2E/POST_CUTOVER | disposable tenant | Yes when list moves |
| G-W2-07 | T05/T06/T11A–T11F/T13/T16/T20 | `npm run test:vui04` | create/edit dependent selectors, draft/submit behavior and no-JS form remain exact; catches form producer/effect drift | real route/browser; DISPOSABLE_E2E/POST_CUTOVER | disposable tenant | Yes when form moves |
| G-W2-08 | T10A–T10C/T11A–T11B/T11G–T11M/T14/T18/T20 | `npm run test:vui05`, extended with chronology/link assertions | workspace facts/tabs/assignment, conditional report link, chronology cursor/empty/unavailable/events, and no-JS remain exact | real route/browser/command; DISPOSABLE_E2E/POST_CUTOVER | disposable tenant | Yes when detail/assignment moves |
| G-W2-09 | T10A–T10E/T11A/T11C–T11D/T11I–T11K/T15/T17G/T20 | `npm run test:vui06`, extended with readiness-0 eligibility and chronology assertions | immutable revision, both no-self-review facts, reasons/cycles/late review, chronology and no-JS remain exact | real route/browser/command; DISPOSABLE_E2E/POST_CUTOVER | disposable tenant | Yes when review moves |
| G-W2-10 | T14/T17H/T19/T20 | affected Activity scenarios from `npm run test:vui08` | one visible/fallback cancellation form, exact guarded fields, command dispatch and dialog movement remain; catches duplicate token/form or hook drift | real Activity route/browser; DISPOSABLE_E2E/POST_CUTOVER | disposable tenant | Yes when cancellation form/dispatch moves |
| G-W2-11 | T02–T04/T13–T16/T17A–T17G | `npm run test:phase2` | planning/review actions, navigation, direct denial, exact mutation counts, command outcomes and audit/rollback cases remain; catches GET-only false confidence and planning dispatch drift | real routes plus command/DB fixtures; CUTOVER/POST_CUTOVER; disposable tenant | disposable tenant | Yes when planning/review POST dispatch moves |
| G-W2-12 | all changed source/docs | `php -l <changed.php>`; `node --check <changed.js>` if any; `git diff --check`; status/diff inspection | syntax succeeds, no whitespace errors or out-of-scope files; catches invalid source and scope drift | changed files; every implementation stage; local | none | Yes |

Gate coverage is **13/13**. Every mandatory gate has a concrete oracle and a
known production-equivalent or direct seam. Each disposable gate must prove
teardown and shared-state preservation through the retained runner.

W0/W1 gate relevance: Partner/Project unauthorized GET, reference list
presentation, VUI-10 and the two W0 reference contracts are `NOT_RELEVANT`
because W2 changes no reference path. The BC-020 runner deadline behavior is a
`REGRESSION_GATE` only through the retained disposable runner, not a reason to
rerun its unit test. No W0/W1 check is a separate `HARD_W2_GATE`.

### Deferred debt, duplication and historical code

| Debt / risk | W2 relationship | Ledger IDs | Disposition | Blocks? |
| --- | --- | --- | --- | --- |
| BC-005 broad unit stall | named focused tests do not depend on broad `test:unit` | gates | DEFER_TO_LATER | No |
| BC-006 discovery gaps | all W2 commands resolve to explicit files in runner mapping | gates | W2_GUARD | No |
| BC-007 dormant shared-port test | W2 uses disposable named suites | gates | NOT_RELEVANT | No |
| current UI human sign-off | structural equivalence only; no conformance claim | T20 | DEFER_TO_LATER | No |
| complete failed-form recovery | behavior must be preserved, not improved | T06/T13 | W2_GUARD | No |
| cron/export/auth residuals | excluded owners | exclusions | NOT_RELEVANT | No |

Relevant duplication is classified before movement: route/presenter shapes are
D2 structural and move without general consolidation; list/detail monitoring
facts are D3 only where the same `MjlMonitoring` use-case is proved and then
share one monitoring read orchestration; route versus locked command checks are
D4 defense in depth and remain duplicated. No historical/migration-only code
is removed. Only branches superseded by T22 within frozen W2 are retired after
their target owner is authoritative.

### Cutover, dependency graph and recovery

| Group | Ledger IDs | Atomic condition | Coexistence and legacy disposition |
| --- | --- | --- | --- |
| CG-W2-01 | T01–T03/T07/T08A/T21 | root selects one handler; guards/normalization/readiness/shell remain complete | safe temporary delegation with one owner per request; old root call retired |
| CG-W2-02 | T08A/T08B/T09/T09A/T11L/T12/T20 | predecessor and target list reads plus compatible producer switch together | safe additive modules before switch; both old selected branches removed after proof |
| CG-W2-03 | T05/T06/T11A–T11F/T13/T16/T20 | form effects, reads and template switch as one view | no template effect ownership; old form renderer retired |
| CG-W2-04 | T10A–T10C/T11A–T11B/T11G–T11M/T14/T16/T19/T20 | detail facts/forms/chronology/link and template switch together | retained collaborators; old detail/timeline renderer retired |
| CG-W2-05 | T10A–T10E/T11A/T11C–T11D/T11I–T11K/T15/T16/T20 | target/fallback review facts, chronology and template switch together | retained command/policy; old review/timeline renderer retired |
| CG-W2-06 | T04/T05/T16/T17A–T17H/T18 | each action maps to exactly one dispatcher and unchanged command | no independent dual execution; old dispatch branch retired atomically |
| CG-W2-07 | T22/T23 | every selected branch has passed before legacy file/branches disappear | final coexistence: none; W3 remains separately gated |

Cutover coverage is **7/7**. Additive, unreachable target modules may coexist
with legacy code. Once a request branch switches, only one executor is
reachable. Mutation delegation never invokes old and new dispatchers together.

The dependency graph is:

```text
T24/T25 + W1 complete
  -> T01/T02/T03
  -> {T05/T06/T07/T09/T09A/T10A–T10E/T11A–T11M/T16 characterization}
  -> {CG-W2-02, CG-W2-03, CG-W2-04, CG-W2-05}
  -> CG-W2-06
  -> T22/CG-W2-07
  -> T23
```

`DEPENDENCY_GRAPH_VALID`: no unexplained cycle, unowned state or dual-authority
state exists. All rows are `SOURCE_REVERT_SAFE`; persistent data remains
backward compatible, and no DB restore or data forward recovery is required.
If a cutover fails, revert that complete group to its last legacy-owned source
state. If a business command succeeds before an HTTP delivery failure, its
existing committed result/audit semantics remain authoritative; W2 does not
invent compensating mutation.

### Representative request and failure simulations

List PRE: request -> Dolibarr root -> Activity guard -> readiness -> either
`MjlActivity` fallback or monitoring snapshot/`MjlMonitoring` -> inline list.
POST: request -> Dolibarr root -> Activity handler/policy -> same readiness ->
monitoring read orchestrates the retained selected query owner -> prepared
list/link state -> template. Result: `EASIER_TO_TRACE` with identical schema
selection, scope and presentation contract.

Review POST PRE: request -> route validation/tokens -> `MjlActivityCommand` ->
locked authorization/transaction/audit -> 303. POST: request -> handler
validation/tokens -> the same command and locked work -> 303. Result:
`EASIER_TO_TRACE`; transaction and audit ownership do not move.

Representative read failure: an Activity snapshot query/commit fails -> the
monitoring read owner rolls back when open -> restores every changed session
budget -> returns failure -> handler selects the existing unavailable/error
outcome -> presenter receives no partial facts. No business audit is required
for this read-only failure. G-W2-04 must prove this before movement.

Representative mutation rejection: token/route rejection stops in the handler
before command and retains current denial; a business conflict returned by the
unchanged command already owns rollback/audit semantics and maps to the same
sanitized result/303. Technical logging is not substituted for business audit.

### W3 dependency and change budget

| W3 dependency | W2 row | Required W2 outcome | Completion proof | Blocking? |
| --- | --- | --- | --- | --- |
| stable deep-module request/presentation pattern with no Activity legacy ownership | T23 | T22 complete, all target owners singular, W3 code absent | ownership contract, focused gates, clean standards/spec review | Yes for a later W3 authorization, not for W2 authorization |

W3 dependency coverage is **1/1**. W2 does not review or implement W3.

Estimated W2 change budget: 4–8 Activity-owned PHP/template files added, 3–6
existing Activity/monitoring/root files modified, 0–1 fully superseded legacy
file removed, 2–5 focused test files added/modified, and 2–4 status/readiness
documents modified. This is an estimate, not a cap. Growth into a framework,
new query class, unrelated monitoring branches, schema, or broad suite rewrite
is scope drift.

### Mechanical readiness gate

| Check | Result |
| --- | --- |
| coverage reconciliation | COMPLETE |
| BLOCKED rows | 0 |
| constraints requiring pre-authorization resolution | 0 |
| unresolved authority conflicts/current discrepancies/cycles | 0 / 0 / 0 |
| unowned/dual-authority transitions | 0 / 0 |
| preservation without target enforcement/verification | 0 / 0 |
| mandatory gates without oracle/execution path | 0 / 0 |
| unsafe coexistence/non-credible recovery | 0 / 0 |
| architecture/Standard amendment required | NO / NO |
| cross-cutting blocking risks | 0 |
| scope/entry/exit/W3 dependency | CLEAR / DERIVABLE / DERIVABLE / COMPLETE |

The mechanical gate passes.

## Database, transaction and Dolibarr constraints

W2 does not move or harden business mutation transactions. All command-owned
locks, writes, audit appends, commit/rollback behavior and finite result codes
remain behind the unchanged command interfaces. Route policy continues to be
defense in depth; it cannot replace locked command authorization.

The procedural monitoring read module may own the existing bounded
repeatable-read snapshots only. Before a snapshot moves, focused tests must prove failed begin, failed
commit, read failure, rollback when open, and restoration of every changed DB
session budget. A failure must not yield partial totals or enabled actions.
W2 must preserve active-entity predicates, current Agent assignment scope and
the explicit unavailable/403 distinctions. It must not infer that a successful
GET proves a write, transaction, or audit contract.

Dolibarr remains the owner of bootstrap, authenticated user/session, CSRF,
header/footer, native Partner/Project/User adapters, and DB connection. No core
file changes are permitted.

## Frontend and presentation contract

The approved v3 design guidance and current screen audit are present and do not
block this structural wave. W2 preserves the current visual design. Templates
must receive prepared values and may perform only presentation conditionals and
context-appropriate escaping; they must not read requests/sessions, query the
DB, authorize, issue tokens, or mutate state.

Existing consumers retain stable field names, IDs, ARIA relationships and
behavioral hooks, including operation-row indexing, `data-partner-id`, the
50-row cap, amount/date controls, dialogs, tabs, dirty-state handling, clicked
submitter semantics and ordinary no-JavaScript forms. Compatible dual hooks
are allowed only temporarily within W2 and must be removed at exit. Signed
human accessibility review remains a release concern, not a blocker to an
equivalent structural extraction.

## Conditional implementation skeleton

Only a later explicit W2 authorization may execute this sequence:

1. Record the authorized baseline and add the nine bounded characterization
   groups in W2-T04–T07, T08A, T09/T09A, T10A–T10E, T11A–T11M and T16; run each
   smallest direct check.
2. Add only the Activity HTTP, procedural monitoring read, audit/timeline
   projection, presentation and template owners required by the ledger. Keep
   `MjlActivityCommand`, `MjlActivityAssignment`, `MjlActivity` compatibility
   projection and `MjlMonitoring` interfaces unchanged.
3. Cut the root to one handler and move one vertical GET surface at a time:
   list, create/edit form, detail, then review. Let the monitoring Activity
   caller reuse the same monitoring read implementation; do not move its
   dashboard/alerts/operations/requests presentation.
4. Move the nine POST dispatch branches only after their exact token, redirect,
   recovery, authorization and unchanged-command contracts pass.
5. Move form effects out of rendering, cut to prepared templates, preserve the
   DOM/JS contract, then delete superseded monitoring read/render/session-effect
   branches. Do not retain parallel authoritative paths.
6. Run the affected focused gates, syntax checks, ownership checks and
   independent standards/spec review; reconcile status and stop before W3.

Each substep must remain a reversible source change with no data conversion.
If an extracted module starts owning business rules, a business transaction,
another feature's presentation, or a competing query abstraction, stop and
remove that expansion before proceeding.

## Focused verification plan

| Changed responsibility | Smallest required gate after authorization |
| --- | --- |
| request/form effects and direct route boundary | focused PHP/source contract plus the relevant direct HTTP cases in `test:phase2` |
| list read/presentation | `npm run test:vui03` |
| create/edit form and DOM producer | `node --test tests/unit/mjl-financial-preview.test.js` and `npm run test:vui04` |
| detail/workspace and assignments | `npm run test:vui05`; add the existing assignment gate only if dispatch/eligibility moved |
| review | `npm run test:vui06` |
| Activity cancellation dialog/POST | affected Activity scenarios from `npm run test:vui08`; use the smallest maintained command/DB proof if dispatch changed |
| planning POST dispatch/navigation | `npm run test:phase2` |
| every changed PHP/JS file | `php -l <file>` / `node --check <file>` as applicable, then `git diff --check` |

Do not run `npm test`, broad E2E, all historical matrices, or full Phase 3A
merely because W2 exists. A larger gate is justified only by a responsibility
actually moved and must still use a disposable tenant with verified teardown.

## Entry, exit, rollback and forward recovery

Entry requires explicit user authorization for this exact W2 boundary, the
unchanged frozen hashes, W0/W1 complete, a clean or safely bounded worktree,
and characterization passing before its corresponding movement.

Exit requires all 47 implementation rows (T01–T22 including the atomic
T08/T09/T10/T11/T17 families) to have one authoritative owner, T23 to remain
satisfied, and governance rows T24–T25 to remain verified. All moved session
effects must finish before pure rendering, with identical route/authorization/
entity/workflow/DOM outcomes, passing affected gates with disposable teardown,
superseded branches removed, clean independent review, concise status
reconciliation, and no W3 work.

Rollback is a code revert of the handler/read/presentation/template cutover and
its tests. W2 has no schema or data migration, so rollback must not run DDL,
restore a database, or rewrite business records. Forward recovery is the same
bounded substep applied again after correcting its source/test defect.

## Risks and blockers

| ID | Risk | Likelihood / impact | Control | Authorization blocker |
| --- | --- | --- | --- | --- |
| W2-RSK-001 | Activity list ownership is accidentally duplicated between Activity and monitoring routes. | Medium / High | one shared monitoring read/presenter; delete selected old branch; no `MjlActivityQuery` | No |
| W2-RSK-002 | Tokens, recovery or feedback remain hidden template effects or are consumed twice. | Medium / High | characterize first; handler-owned exactly-once effects | No |
| W2-RSK-003 | Read snapshot failure leaks partial facts or DB session budgets. | Medium / High | focused fault assertions before movement; one read owner | No |
| W2-RSK-004 | Route extraction weakens assignment/entity/direct-POST denial. | Medium / High | preserve route policy and unchanged locked command checks; direct tests | No |
| W2-RSK-005 | Equivalent templates break Activity JS/shared UI hooks. | Medium / Medium | producer/consumer map, dual hooks only temporarily, VUI/no-JS gates | No |
| W2-RSK-006 | W2 expands into command split, monitoring redesign, W3, or broad cleanup. | Medium / High | ledger boundary and lean checkpoint; stop on unplanned ownership | No |
| W2-RSK-007 | Broad legacy suites create cost without proving the moved seam. | Medium / Low | risk-based gate table and current acceptance guidance | No |

Pre-authorization blockers: **0**. Non-blocking bounded risks: **7**.

## Final implementation state

The frozen W2 scope, affected routes/actions, current and target owners,
preservation IDs, security and data boundaries, session effects, frontend
contracts, missing characterization, focused gates, cutover, rollback and exit
criteria are explicit. No architecture or Engineering Standard amendment is
needed.

```text
W2_COMPLETE
W3–W7: NOT_AUTHORIZED
```
