# MJL W7 readiness review

## Current implementation outcome

```text
W7_COMPLETE
Baseline: 3208bfc75f408de8d924c5668b80ec8af505ec11
Migration complete: NO
```

DEC-071 authorized exactly the two-wrapper retirement defined below. The two
definitions were removed together from the retained access library. G01 found
no remaining candidate symbol in `custom` or `tests` and no dynamic
registration target; G02 PHP syntax passed; G03 passed 1/1; and disposable G04
passed 3/3 with complete tenant teardown. G00 remained exact and G05 completed
with zero actionable Standards or Specification findings. No test, route,
schema, data, transaction, lifecycle, frontend, tooling, dependency, or other
cleanup candidate changed. W7 completion does not declare the application or
architecture migration accepted, production-ready, or `MIGRATION_COMPLETE`.

## Readiness verdict at authorization

```text
W7_READY_FOR_AUTHORIZATION
Baseline: 038eed4343f683d96a7ccb00d6de5128f9e3c8ef
W7 authorized: NO
Migration complete: NO
```

Everything from this heading onward is the pre-authorization control snapshot.
Its `W7 authorized: NO`, ledger statuses, and future-tense instructions describe
the baseline before DEC-071 execution; the current outcome is recorded above.

W7 is ready only as the frozen candidate-sized removal of
`mjl_activity_access_can_mutate()` and
`mjl_activity_access_require_mutation()`. This review authorizes no source,
test, schema, data, tooling, CI, or dependency change. A later authorization
must still name this exact pair and stop after its proof, removal, focused
verification, and documentation reconciliation.

## Review-first corrections

The pasted brief was not applied literally:

1. DEC-066 amended the frozen Engineering Standard. Its authoritative hash is
   `b24021ac52a55f5a9921801aac8d100d9238268c55b3775875a0709132fb9560`;
   `a47f2d...` is the historical pre-amendment hash.
2. W6 delegated lifecycle ownership exactly as frozen under DEC-070. The
   native `remove()` -> `_init()` behavior, lock/error boundary, detectors,
   resources, states, schema, and auth behavior remained unchanged; ownership
   itself did not remain embedded in the descriptor.
3. Frozen W7 is not a project-wide cleanup or a new migration-completion
   framework. The requested all-domain inventories are reduced to the one
   named candidate and concise preservation/exclusion records. A separate
   `MIGRATION_COMPLETE` decision is outside this wave.

These corrections reconcile the brief with current authority; they require no
architecture or Engineering Standard amendment.

## Authority and baseline

| Authority | Verified result |
| --- | --- |
| Frozen architecture | SHA-256 `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| Frozen Engineering Standard | amended SHA-256 `b24021ac52a55f5a9921801aac8d100d9238268c55b3775875a0709132fb9560` |
| Historical independent review | SHA-256 `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |
| Post-W6 source baseline | `038eed4343f683d96a7ccb00d6de5128f9e3c8ef` |
| W0-W6 ancestry | every named baseline is an ancestor of HEAD |
| Preservation inventory | 35/35 remains mapped; six IDs are directly relevant to W7 |
| W6 -> W7 dependency | `NONE_DEFINED`: W7 consumes the post-W6 baseline but no W6 output interface |

The current functional authority already makes the compatibility posture
explicit: the application is not live, backward compatibility is not required,
and obsolete logic is not retained merely because it exists. The descriptor
also declares `moduleforexternal => 0`. No document or source identifies the
two wrappers as a public extension interface.

## Exact W7 scope

The only removal candidate is the pair at
`custom/mjlfinancement/lib/mjl_activity_access.lib.php:61-67`:

- `mjl_activity_access_can_mutate()`; and
- `mjl_activity_access_require_mutation()`.

`mjl_activity_access_require_mutation()` calls the first function. Neither has
another repository caller. W7 may delete those definitions only after the
pre-movement reachability gate reconfirms that result and the finite dynamic
registration/include surfaces do not name or construct either symbol.

The containing library is live and must remain. Activity, Operation, request,
timeline, and test paths use its separate schema-readiness, list-entry, and
Activity-read functions. Current mutations already use action-specific route
checks and the locked `MjlActivityCommand` authorization boundary; the broad
unused role predicate is not their enforcement owner or replacement.

### Explicit exclusions

W7 excludes:

- the other five no-internal-caller helper candidates;
- recovery libraries and old export helpers;
- table helpers, CSS selectors, dormant/historical tests, and `project_note`;
- any route, action, command, query, transaction, template, JavaScript, CSS,
  schema, data, lifecycle, auth, audit, export, monitoring, or tooling move;
- any generic dead-code scanner, registry, migration framework, or new loading
  model;
- historical/frozen audit references that accurately describe the pre-W7
  baseline; and
- production preparation, acceptance, or a `MIGRATION_COMPLETE` declaration.

## Current and target ownership

| Concern | Current owner | W7 target | Classification |
| --- | --- | --- | --- |
| broad Activity mutation predicate | unused wrapper pair | absent after proof | `REMOVE_WITH_PROOF` |
| Activity list/read access | retained functions in `mjl_activity_access.lib.php` | unchanged | `MUST_REMAIN_UNCHANGED` |
| mutation authorization | route-specific eligibility plus locked Activity command | unchanged | `MUST_REMAIN_UNCHANGED` |
| library includes/loading | current class and Activity/Operation/request route includes | unchanged | `MUST_REMAIN_UNCHANGED` |
| Dolibarr hook/cron/module registration | descriptor and named hook/class methods | unchanged; neither candidate is registered | `MUST_REMAIN_UNCHANGED` |
| all W0-W6 owners | owners recorded in the roadmap/readiness records | unchanged | `MUST_REMAIN_UNCHANGED` |

There is no W7 database, query/write, transaction, frontend producer/consumer,
schema/lifecycle, route/action, or persistent-state cutover. Those relevant
denominators are `0/0`, not missing coverage.

## Master W7 ledger

| ID | Requirement | Action | Preservation / evidence | Status |
| --- | --- | --- | --- | --- |
| T01 | frozen authority and current hashes | guard | exact hashes above | `READY` |
| T02 | clean post-W6 baseline | guard | HEAD `038eed4`; W0-W6 ancestry verified | `READY` |
| T03 | exact candidate identity | limit | two definitions at one source site | `READY` |
| T04 | repository caller proof | characterize | only definition/self-call in `custom` and `tests` | `READY` |
| T05 | dynamic registration/include proof | reconfirm immediately before removal | descriptor, hooks, cron, callback and include inspection | `READY_WITH_CONSTRAINTS` |
| T06 | compatibility disposition | retain current authority | DEC-001 / functional specification: no backward-compatibility requirement; module is not external | `READY` |
| T07 | candidate-sized deletion | remove only the pair | no library/include relocation | `READY_WITH_CONSTRAINTS` |
| T08 | retained access behavior | preserve | RT-002/004, SEC-AUTHZ-003/004, DB-001 | `READY_WITH_CONSTRAINTS` |
| T09 | disposable browser isolation | preserve | LIFE-002 | `READY_WITH_CONSTRAINTS` |
| T10 | other candidates and historical evidence | retain | section 18 deferrals and exclusions above | `READY` |
| T11 | rollback | candidate-sized source revert | no schema/data recovery | `READY` |
| T12 | post-removal closure | reconcile current docs and stop | no W8 or migration-complete implication | `READY` |

Counts: 8 `READY`, 4 `READY_WITH_CONSTRAINTS`, 0 `BLOCKED`, and 0
`NOT_APPLICABLE`. The constrained rows resolve inside the authorized W7 unit
before or immediately after the single deletion; none requires a product or
architecture decision.

## Implementation skeleton and cutover

One source group is allowed:

1. G1, pre-movement: reconfirm T04-T06. If a live or constructed caller is
   found, stop, retain both functions, record the evidence, and defer W7.
2. G2, atomic removal: delete only the two definitions. Keep the file, every
   include, every read-access helper, and every current enforcement layer.
3. G3, closure: run the focused gates, update only current-state references,
   obtain clean independent Standards and Specification reviews, and stop.

Coexistence is not permitted: the pair is either retained together before the
gate or removed together. Rollback restores the candidate-sized source change.
There is no forward recovery, schema rollback, data repair, or dual authority.

## Verification gates and oracles

| Gate | Command / inspection | Passing oracle |
| --- | --- | --- |
| G00 | hashes, baseline, status, diff integrity | exact current authorities; W7 explicitly authorized before source edit; bounded diff |
| G01 | `rg -n 'mjl_activity_access_(can_mutate|require_mutation)' custom tests` plus descriptor/hook/cron/callback/include inspection | before: definition/self-call only and no dynamic target; after: zero matches in `custom`/`tests` |
| G02 | `php -l custom/mjlfinancement/lib/mjl_activity_access.lib.php` | no syntax error |
| G03 | `node --test tests/unit/access-audit-fail-closed.test.js` | focused access/audit fail-closed contract passes |
| G04 | `npm run test:vui03` | retained scoped Activity-list access passes in a disposable tenant with teardown |
| G05 | independent Standards and Specification reviews | no actionable finding; scope/exclusions/preservation match frozen W7 |

Text search alone is not the G01 oracle: the finite dynamic registration and
loading inspection is mandatory. An unknown untracked customization remains a
low compatibility risk, not an in-repository public contract; the current
no-backward-compatibility decision and candidate-sized revert bound that risk.

| Existing risk | W7 disposition | Reason |
| --- | --- | --- |
| W2-RSK-007 broad legacy-suite cost | `DEFERRED_POST_MIGRATION` | the frozen focused gates avoid an unbounded legacy run |
| BC-005 aggregate unit stall | `DEFERRED_POST_MIGRATION` | W7 does not select `npm run test:unit` |
| BC-006 incomplete discovery | `W7_GUARD` | every W7 command and file is named; no broad coverage claim is allowed |
| BC-007 dormant shared-port browser test | `NOT_RELEVANT` | it is not selected; G04 uses the disposable VUI03 path |

These items do not block the explicitly named gates and may not widen W7 into
a runner/tooling task.

## Preservation and completion boundary

Direct W7 preservation coverage is 6/6:

- RT-002 and RT-004: direct-route and locked-command authorization remain;
- SEC-AUTHZ-003 and SEC-AUTHZ-004: Activity policy and defense-in-depth remain;
- DB-001: active-entity data isolation is untouched; and
- LIFE-002: any browser verification uses a disposable tenant and teardown.

The 29 other preservation requirements remain mapped to unchanged owners and
are outside the zero-impact surfaces of this candidate.

W7 may later be marked complete only when T01-T12 and G00-G05 pass, the pair
has no live/dynamic caller, both definitions are absent, retained behavior is
proven, and current documentation is reconciled. Even then, this review does
not create or satisfy a separate `MIGRATION_COMPLETE` state. Any project-wide
final reconciliation requires a fresh explicit governance decision.

## Mechanical readiness result

```text
W6 baseline: 038eed4
W6 -> W7 dependency: NONE_DEFINED
Exact W7 scope: CLEAR
Master ledger: 12 / 12 classified
READY: 8
READY_WITH_CONSTRAINTS: 4
BLOCKED: 0
Authoritative scope coverage: 1 / 1 candidate pair
Current responsibility coverage: 6 / 6
Final target responsibility coverage: 6 / 6
Route/action coverage: 0 / 0 (no cutover)
DB/query/write coverage: 0 / 0 (no cutover)
Transaction coverage: 0 / 0 (no cutover)
Frontend contract coverage: 0 / 0 (no change; VUI03 is preservation proof)
Dolibarr dynamic/loading seam coverage: 1 / 1
Preservation coverage: 35 / 35 mapped; 6 / 6 directly relevant
Verification-gate coverage: 6 / 6
Cutover-group coverage: 3 / 3
Unresolved authority conflicts: 0
Unsafe retirement definitions: 0
Unclassified reachable legacy authorities: 0
Architecture amendment required: NO
Engineering Standard amendment required: NO
Runtime files modified: 0
Test files modified: 0
Tooling/config/dependencies/CI modified: 0
W7 authorized: NO
Migration complete: NO
Final verdict: W7_READY_FOR_AUTHORIZATION
```
