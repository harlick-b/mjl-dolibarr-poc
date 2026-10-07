# MJL W1 readiness review

## 1. Executive verdict

```text
W1_READY_FOR_AUTHORIZATION
```

The user resolved W1-BLK-001 by approving Partner and Project list GETs as one
shared W1 presentation slice. Operation Type and every detail, create, edit,
lifecycle, recovery, and POST path remain outside W1. This focused architecture
amendment is recorded as DEC-061 and supersedes only document 17's literal
“one root adapter” wording for W1.

This review is documentation-only. It does not authorize W1, edit the frozen
architecture baseline file or its hash, amend the Engineering Standard, or
modify runtime, tests, schema, tooling, dependencies, or CI. DEC-061 is the
authoritative focused amendment layered over the unchanged frozen baseline.
The analysis below consolidates the requested readiness evidence for the
now-exact Partner/Project boundary.

## 2. Verified authority and W0 baseline

| Authority | Verified result |
| --- | --- |
| Frozen architecture | `ARCHITECTURE_FROZEN`; SHA-256 `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| Frozen Engineering Standard | `STANDARD_FROZEN`; SHA-256 `a47f2d942172a4685b02efce027ca04c0a2361f258ebd8c0b776117c97f8f62e` |
| Historical independent review | unchanged; SHA-256 `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |
| W0 baseline | commit `bccf5a708aec25f98499bed6b7da3f607c0541d5`; `W0_COMPLETE` |
| Preservation ledger | 35/35 identifiers present |
| Review baseline | branch `main`; clean worktree before documentation edits |
| Focused W1 amendment | DEC-061: Partner + Project empty-action list GETs form one shared slice; all other reference paths excluded. |
| Authorization | W1 is ready for later authorization but remains `NOT_AUTHORIZED`; W2–W7 remain `NOT_AUTHORIZED`. |

W0 supplies the required Partner/Project allowed and direct-denial
characterization, stable VUI-10 discovery, BC-020 sticky timeout behavior, the
two PHP contracts, and disposable integrity/teardown evidence. No W0
implementation file is changed by this review.

## 3. Exact W1 contract after DEC-061

| Contract element | Authoritative result |
| --- | --- |
| Purpose | Prove the target request path with one reference-list GET extraction and no core-write change. |
| Scope | Separate handler, prepared view data, and template for the Partner and Project empty-action list GETs while keeping both root URLs and output contracts. |
| Affected | `partners.php` and `projects.php`, their shared route/list-render responsibility, presentation helpers, and existing shell/form-effect dependencies used by those requests. |
| Target path | Root adapter -> handler -> unchanged policy/read -> prepared data -> pure presenter/template. |
| Allowed | Responsibility movement, equivalent markup, temporary dual DOM hooks inside the bounded wave. |
| Forbidden | Query, role, filter, URL, label, workflow, command, schema, or functional redesign. |
| Preservation | RT-001–003/010/011/014 plus applicable SEC-AUTHZ and DB-001; LIFE-002 for disposable proof. |
| Gates | Two named PHP contracts, disposable VUI-10, syntax checks for changed PHP, and `git diff --check`. |
| Rollback | Source revert to the old root require/call; no data conversion or schema reversal. |
| Exit | Identical authorized/forbidden outcomes and usable rendering; selected old list-render path removed rather than retained in parallel. |
| W2 dependency | The handler/prepared-data/pure-template pattern is accepted before the Activity extraction. |

The amended boundary is exact: W1 contains the Partner and Project empty-action
list GETs together because they share one presentation branch and W0 evidence.
Operation Type and every detail, create/edit, lifecycle, recovery, and POST
path remain delegated unchanged to the legacy route.

## 4. Current-to-target responsibility and traceability

| Current file/symbol | Current responsibility | Target owner/action | Preservation | Protection |
| --- | --- | --- | --- | --- |
| `partners.php` and `projects.php` | bootstrap, direct read guard, shared route call, DB close | keep stable URLs/bootstrap/close, capture context, and call one shared handler; remove both root-owned `mjl_reference_require_read()` calls at atomic cutover | RT-001/002, SEC-AUTHZ-001/004 | direct denial and list outcomes in VUI-10 |
| `mjl_reference_route()` Partner/Project empty-action GET branch | method/action validation, list-path selection, shell ownership | new handler invokes `mjl_reference_require_read()` before its list path or delegation; move only Partner/Project list dispatch to `lib/reference/mjl_reference_http.lib.php` | RT-002/003 | focused dispatch/denial characterization plus VUI-10 |
| `mjl_reference_render_list()` | management eligibility, page-header options, list read, render invocation | handler prepares explicit eligibility/header/list data; remove the selected old list-render branch at cutover | RT-002/014, SEC-AUTHZ-004, DB-001 | prepared-data contract plus VUI-10 |
| `mjl_reference_ui_list()` Partner/Project paths | escaped tables, empty state, actions, DOM/ARIA hooks | pure shared presentation helper and `tpl/reference/*`; no DB/session/request/policy access | frontend contract, RT-014 | focused presentation contract plus VUI-10 |
| `mjl_reference_config()`, `mjl_reference_can_manage()`, `mjl_reference_list()` | fixed vocabulary, eligibility, entity-scoped read SQL | retained behavior; called through the selected handler/read seam, with no query redesign | SEC-AUTHZ-001/004, DB-001, RT-014 | source review, cross-entity characterization, VUI-10 |
| `mjl_navigation_shell_start/end()` and feedback helpers | combined shell policy/readiness, session-backed feedback drain, and direct shell HTML output | `POSSIBLE_WITH_JUSTIFICATION`: introduce the smallest prepared-shell/feedback seam the handler can invoke before pure rendering, with legacy wrappers delegating to it; do not redesign navigation | RT-003 | characterize drain/order and identical shell output before changing ownership |

Audit finding D-01/D-13 maps the mixed shared route to the handler and
presentation targets above. No responsibility is orphaned after the amended
slice is implemented: non-list requests and Operation Type remain on the existing route;
the Partner/Project list slice has one new authoritative path; reference writes
remain W3.

Likely new/populated targets are
`lib/reference/mjl_reference_http.lib.php`, a narrowly named prepared-data or
presentation library under `lib/reference/`, and `tpl/reference/*`. Existing
`lib/mjl_reference.lib.php` changes are allowed only if the selected list read
is moved at responsibility level with identical SQL semantics. Shared shell,
feedback, form, page-header, JS, and CSS files are dependencies to preserve,
not redesign targets.

## 5. Scope classification and protected areas

| Candidate | Classification |
| --- | --- |
| Partner and Project empty-action list GETs as one shared slice | `REQUIRED_FOR_W1` |
| Handler, prepared view data, pure selected list template, atomic cutover, old selected list-path removal | `REQUIRED_FOR_W1` |
| Smallest selected-surface characterization, prepared shell/feedback seam, and stale source-location assertion update | `ALLOWED_IF_NECESSARY` |
| Operation Type and all detail/create/edit/lifecycle/recovery/POST paths | `PROTECTED` / `NOT_W1` |
| Reference create/update/lifecycle commands, transactions, locks and audit | `DEFER_TO_W3` / `PROHIBITED_IN_W1` |
| Activity, auth, monitoring/dashboard, reporting/export, lifecycle, cron, hooks and document work | `DEFER_TO_LATER_WAVE` |
| Query/filter/role/URL/label/markup behavior redesign, schema, dependencies, CI, general cleanup | `PROHIBITED_IN_W1` |
| BC-005, BC-006 aggregate debt, BC-007, broad tooling/static analysis | `DEFERRED_BEYOND_W1` |

Authentication/session semantics, effective-role meanings, active-entity
isolation, native Admin behavior, frontend producer/consumer contracts, W0
runner semantics, and all business workflows remain functionally unchanged.
Authorization invocation moves from both selected roots into their shared
handler at cutover. The handler must guard both new list paths and delegated legacy
paths before query, mutation dispatch, or rendering; semantics do not change.

## 6. Preservation impact — all 35 requirements

| Classification | Preservation IDs | W1 handling |
| --- | --- | --- |
| `DIRECTLY_AFFECTED` | RT-001, RT-002, SEC-AUTHZ-001, SEC-AUTHZ-004, DB-001 | preserve bootstrap/URL, fail-closed direct guard, role/Admin outcomes, layered enforcement, and exact entity-scoped list semantics |
| `INDIRECTLY_AT_RISK` | RT-003, RT-010, RT-011, RT-014, LIFE-002 | keep adjacent form/session effects unchanged; do not invent monitoring/readiness dependencies; retain native identities; preserve disposable safety |
| `NOT_TOUCHED` | RT-004–009, RT-012, RT-013, RT-015; SEC-AUTH-001–006; SEC-AUTHZ-002, SEC-AUTHZ-003; SEC-DOC-001, SEC-DOC-002; DB-002–004; LIFE-001, LIFE-003, LIFE-004 | protected from W1; no new proof unless actual scope changes |

This accounts for every ledger identifier. RT-010/011 are listed by frozen W1
but the current reference list does not call `MjlMonitoring` or schema
readiness; their correct W1 treatment is non-interference, not speculative
dependency creation. DB-002 and reference transaction behavior are protected
because W1 moves no write owner.

| ID | Current enforcement | Target/migration step | Verification | Rollback concern |
| --- | --- | --- | --- | --- |
| RT-001 | Partner/Project roots load `main.inc.php`, call route, close DB | both roots keep bootstrap/close and make one shared handler handoff | syntax plus both routes in VUI-10 | revert roots and handler as one unit |
| RT-002 | root guard plus shared method/action/direct checks | handler owns `mjl_reference_require_read()` and selected dispatch before all delegated/new paths | direct no-role/Admin/anonymous denial and data absence | restore root guard and legacy call together |
| RT-003 | shared route owns method/action, adjacent tokens/recovery; shell helpers drain feedback | non-list token/recovery paths stay unchanged; any prepared shell/feedback seam completes effects before template | PHP form contract plus focused effect/order proof if helper changes | compatibility wrapper and handler revert together |
| RT-010 | not invoked by current reference list | introduce no monitoring read dependency | source/dependency review | none beyond source revert |
| RT-011 | not invoked by current reference list | introduce no schema-readiness dependency | source/dependency review | none beyond source revert |
| RT-014 | native Partner/Project tables and adapters remain the source | prepared data retains native identity and shapes | project form contract, selected list contract, VUI-10 | source revert; no data conversion |
| SEC-AUTHZ-001 | effective role makes Admin technical-only and business roles readable | same policy invoked by handler with explicit actor/entity context | direct-denial and allowed-role VUI-10 cases | restore invocation location only |
| SEC-AUTHZ-004 | root, shared route, UI eligibility and DB/entity predicates form layered checks | move only route-layer invocation; retain UI and DB trust boundaries | source review plus direct-route and entity proof | no layer may be removed during revert/cutover |
| DB-001 | `mjl_reference_list()` filters active entity and Project joins same-entity Partner | query semantics remain byte-for-byte equivalent or responsibility-moved without predicate/order change | smallest selected cross-entity fixture plus source diff | source revert; no schema/data rollback |
| LIFE-002 | VUI-10 runner enforces isolated tenant, integrity and teardown | runner remains untouched and selected gate uses it | successful disposable run with teardown/integrity | no retained tenant or test-infrastructure change |

## 7. Authorization, DB, globals, frontend and Dolibarr impact

| Area | Readiness result |
| --- | --- |
| Authorization | Semantics understood: active same-entity Agent/Supervisor/Validator read; Validator alone receives management eligibility; native Admin/no-role denied. Ownership relocation only. |
| Database | Read-only impact on native `llx_societe` and `llx_projet` with the same-entity Partner join. Operation Type is excluded. No write, DDL, snapshot or transaction. |
| Transaction | Not applicable to the list GET. Reference begin/commit/rollback/quarantine behavior is untouched. |
| Globals/input | Root captures Dolibarr `$db`, `$user`, active entity and request context for the handler. Handler owns method/action normalization. Existing retained reads may keep their characterized Dolibarr globals; no new hidden global is introduced. |
| Session | No template access. If W1 changes shell ownership, the smallest prepared-shell/feedback seam drains session feedback and computes shell values before pure rendering; existing wrappers preserve other callers. |
| Dolibarr integration | `main.inc.php`, `GETPOST()`, active entity, native `User`/`Societe`/`Project`, DoliDB and stable public roots remain. No second framework, request abstraction, transaction abstraction or loading model. |
| Frontend | Equivalent output only: page shell/header, French labels, links, table/empty state, status badges, action eligibility, ARIA, responsive/forced-colors/no-JS behavior remain. |

Known Partner/Project producer/consumer hooks include
`[data-mjl-reference-list]`, `[data-reference-row]`,
`.mjl-reference-table`, `.mjl-row-interactive`, `.mjl-table-link`, and the
action-menu hooks consumed by `mjl_components.js`, application CSS, VUI-10 and
design-system source assertions. Every producer/consumer for the Partner/Project slice
must move in one unit; temporary dual hooks must be gone at exit.

Dependency direction is valid and has no identified cycle:

```text
Partner/Project root adapters
  -> reference HTTP handler
     -> retained policy/read seam
     -> prepared reference view data
     -> pure reference presenter/template
```

## 8. Coexistence, cutover, rollback and recovery

The model is `COEXISTENCE_WITH_CONSTRAINTS` until both selected roots are cut
over. Only Partner/Project empty-action GETs may use the new handler;
non-list requests continue through the legacy route after the handler performs
the same read guard. There must be no double execution: the root calls one
handler, its dispatch chooses one path, and only the new path renders the
selected list after cutover.

Cutover is an atomic source change for both roots and their shared list branch.
The superseded Partner/Project branch in `mjl_reference_render_list()` and
presentation path must be removed in the same bounded unit, while the Operation
Type path remains. Rollback is `SOURCE_REVERT_SAFE`: switch both root dispatches
back and restore the removed branch in the same revert. No data/schema
state changes, so no DB restore or special forward-recovery machinery is
needed. A normal forward fix is credible if a post-merge presentation defect
is found.

## 9. Characterization, W0 dependencies and verification

| Check/evidence | W1 role | When/blocking |
| --- | --- | --- |
| Partner/Project direct denial and allowed list behavior | hard prerequisite for the amended shared slice | W0 satisfied; must remain green after cutover |
| BC-020 sticky timeout and explicit VUI-10 discovery | reliable test-environment prerequisite | W0 satisfied; protect runner, do not modify it |
| `php tests/contracts/table_presentation_test.php` | shared table/output contract | pre/post implementation; blocking |
| `php tests/contracts/project_form_security_test.php` | adjacent form/token regression | pre/post implementation; blocking where shared route changes |
| selected prepared-data/template contract | new seam behavior, escaping, eligibility and empty state | add test-first during W1 before cutover if not already directly covered |
| selected cross-entity non-disclosure | DB-001 at the real boundary | add smallest disposable case during W1 before read cutover |
| `env -u MJL_TEST_RETAIN npm run test:vui10` | authorization, DOM, forms, disposable integrity | post-cutover; blocking for Partner/Project |
| `php -l <each changed PHP file>` | syntax/PHP surface | after edits; blocking |
| fresh server-log inspection after route run | route failure evidence | post-cutover; blocking for unexplained errors |
| `git diff --check` and status/diff review | bounded diff/docs | before commit; blocking |

Operation Type is excluded from W1, so its missing VUI-10 characterization does
not block this wave and must not be added as W1 work.

BC-005 and BC-006 aggregate-runner debt are `DEFERRED_BEYOND_W1`; exact VUI-10
discovery separately satisfies this selected gate. BC-007 is
`DEFERRED_BEYOND_W1` and its unsafe shared-port surface must not run. The
focused runner unit suite is not a W1 gate because runner changes are outside
scope. PHPCS, PHPStan, ESLint and Stylelint remain deferred.

VUI-10 mutates only its isolated tenant, requires Docker/Compose, an unset
`MJL_TEST_RETAIN`, loopback/non-8080 routing, disposable sentinels and volumes,
shared-state hashing, secret handling, and complete teardown. The PHP
contracts, syntax checks and diff checks are host read-only. No test is needed
for this documentation-only review.

## 10. Request and failure simulations

Target successful request after selection:

```text
Partner or Project stable root GET with empty action
-> Dolibarr bootstrap/login
-> reference handler method/action normalization
-> direct read authorization
-> unchanged entity-scoped reference read
-> prepared header/eligibility/rows
-> pure template inside retained shell
-> identical HTML response
```

Representative denial path:

```text
native Admin or authenticated no-role Partner/Project GET
-> Dolibarr bootstrap
-> reference handler direct policy
-> HTTP 403 before list query/template
-> no protected fixture label and no success audit
```

Current list-query failure is fail-closed but not explicit:
`mjl_reference_list()` converts `$db->query()` failure to an empty array, so the
route renders the ordinary empty state with no distinct user error or audit.
W1 must preserve that exact behavior because query/error redesign is forbidden.
Improving failure visibility is separate work; the template must not invent an
error distinction it did not receive, and no new log may expose secrets.

## 11. Entry, exit, W2 dependency and conditional implementation skeleton

Entry is satisfied for later authorization: frozen hashes match, W0 is complete,
35/35 identifiers remain, the Partner/Project shared slice and exclusions are
explicit, the mapping is complete, and no blocker remains.

W1 exit requires one authoritative selected list path, old selected render
ownership removed, all other reference paths unchanged, authorization/entity/
markup behavior preserved, focused gates passing with disposable teardown,
no W2 work, frozen governance unchanged, concise status reconciliation, clean
review, and a clean worktree after the bounded commit.

W2 depends only on W1 proving the stable adapter -> handler -> prepared data ->
pure template pattern and its behavior-preserving cutover. W1 must not create
Activity abstractions or move Activity code.

Proposed implementation steps after explicit W1 authorization:

1. add only the missing Partner/Project cross-entity characterization;
2. add the reference handler/prepared-data/template owners without changing
   the authoritative path;
3. cut both Partner and Project empty-action GETs atomically to the new handler;
4. remove the superseded Partner/Project list branch while keeping other roots
   and non-list requests intact;
5. run the focused command set, independently review the bounded diff, reconcile
   status, and stop before W2.

Expected budget is two root edits, the two current shared reference libraries
as needed, a small `lib/reference/` and `tpl/reference/` target set, focused
tests, and concise status docs. Dramatic growth, shared query redesign, or
write-path edits trigger a scope stop. Bounded characterization, additive
owners, atomic cutover/removal, and status may be separate coherent commits;
no arbitrary commit count is imposed.

## 12. Risks, blocker and amendment outcome

| ID | Risk | Likelihood / impact | Mitigation | Blocks now? |
| --- | --- | --- | --- | --- |
| W1-RSK-001 | Guard runs after read/render. | Low / High | handler denies before query/template; direct VUI-10 denial | No |
| W1-RSK-002 | Entity or inactive filtering drifts. | Medium / High | preserve SQL semantics; selected cross-entity fixture | No |
| W1-RSK-003 | Feedback/shell session-effect order changes. | Medium / Medium | retain owner; characterize only moved effect | No |
| W1-RSK-004 | Old and new list renderers remain authoritative. | Medium / Medium | atomic cutover and selected old-path removal | No |
| W1-RSK-005 | Source-location test preserves obsolete file placement. | High / Low | update/remove only stale location assertion; retain behavior proof | No |
| W1-RSK-006 | Scope expands into writes, W2 or deferred debt. | Medium / High | file/symbol boundary and lean checkpoint | No |

W1-BLK-001 is resolved by the user's explicit Partner+Project selection and the
focused amendment recorded as DEC-061. This amendment changes only W1's root
cardinality and exact selected surface. It does not change target owners,
dependency direction, preservation semantics, wave order, or the exclusions
above. No Engineering Standard amendment and no further architecture amendment
are required. W1 implementation remains separately authorization-gated.

## 13. Final readiness state

```text
W0_COMPLETE
W1_READY_FOR_AUTHORIZATION
W1: NOT_AUTHORIZED
W2–W7: NOT_AUTHORIZED
```

Pre-authorization blockers: **0**. Non-blocking W1 risks: **6**.

The next possible action is a separate explicit W1 implementation
authorization. This readiness verdict does not begin W1.
