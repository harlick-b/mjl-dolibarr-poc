# MJL W0 readiness review

## 1. Executive verdict

```text
W0_READY_FOR_AUTHORIZATION
```

W0 is ready to be considered for a separate, explicit implementation
authorization. This verdict does **not** authorize or begin W0, W1, or any
later migration wave.

The pasted review brief assumed W0 might establish a general lint,
static-analysis, baseline, CI, or developer-tooling foundation. That assumption
conflicts with the frozen architecture. W0 is only the bounded characterization
and runner-safety prerequisite for the first W1 reference-list GET slice.

No architecture amendment or Engineering Standard amendment is required for
that bounded unit.

## 2. Authority baseline

| Authority | Verified state |
| --- | --- |
| Frozen architecture | `docs/architecture-audit/17-target-architecture-proposal.md`; `ARCHITECTURE_FROZEN`; SHA-256 `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| Frozen Engineering Standard | `docs/mjl-engineering-standard-v1.md`; `STANDARD_FROZEN`; SHA-256 `a47f2d942172a4685b02efce027ca04c0a2361f258ebd8c0b776117c97f8f62e` |
| Historical architecture review | `docs/architecture-audit/18-independent-architecture-review.md`; unchanged; SHA-256 `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |
| Preservation ledger | 35/35 identifiers present |
| Current authorization | W0 and W1–W7 remain `NOT_AUTHORIZED` |
| Review baseline | branch `main`; commit `61fc628946d7f34d22b7fea790dcb243567396f4`; clean worktree |

## 3. Exact W0 contract

The frozen architecture defines W0 as follows:

| Contract element | Authoritative result |
| --- | --- |
| Purpose | Lock the observable seam needed before the first responsibility move. |
| Selected next slice | W1 reference-list GET surface. |
| Scope | Add or repair only focused characterization for that surface and make selected-runner discovery explicit. |
| Prerequisites | No shared-tenant mutation; use isolated disposable fixtures. |
| Affected verification | Selected reference-route tests and BC-005/006/007/020 only when necessary for this gate. |
| Preservation | LIFE-002 plus the preservation IDs owned by the reference-list slice. |
| Required commands | Two named PHP contracts and `npm run test:vui10`; focused runner unit tests if runner behavior changes. |
| Allowed | Characterization and runner safety only. |
| Forbidden | Runtime behavior, schema, UI, business-rule, dependency, or architecture changes. |
| Rollback | Revert the bounded test/runner commit; no persistent data or schema state exists. |
| Exit | The focused gate reliably discovers and proves the current reference-list seam. |
| W1 dependency | W1 cannot move the reference-list GET surface until this contract is satisfied. |

The readiness audit found two required W0 outputs:

1. Add direct unauthorized Partner and Project list-GET characterization to
   `tests/e2e/vui-reference-management.spec.js` for no-role, native Admin, and
   anonymous contexts while retaining allowed Agent/Supervisor/Validator reads.
2. Correct BC-020 in `tests/runner/run-suite.js` so an elapsed timeout is a
   failure even if the terminated child exits with code 0, and add the focused
   regression to `tests/unit/disposable-run.test.js`.

The missing assertions and BC-020 correction are the work W0 exists to perform;
they are not pre-authorization blockers.

## 4. W0 scope and non-scope

| Activity | Classification | Reason |
| --- | --- | --- |
| Direct unauthorized reference-list GET characterization | REQUIRED | Explicit missing W0 prerequisite for W1. |
| Explicit VUI-10 discovery | REQUIRED, ALREADY PRESENT | `package.json` maps `test:vui10` to the runner, which maps it to the exact spec. Preserve and assert this mapping while changing runner tests. |
| BC-020 deadline false-success repair | REQUIRED | VUI-10 runs through a deadline-aware subprocess and cannot be relied upon while elapsed deadlines may accept exit 0. |
| Two named PHP presentation/form contracts | REQUIRED VERIFICATION | Frozen W0 gate. |
| Disposable VUI-10 browser gate | REQUIRED VERIFICATION | Frozen W0 gate; mutates only an isolated tenant. |
| `php -l` / `node --check` on changed source types | REQUIRED WHEN APPLICABLE | Frozen Engineering Standard. W0 is expected to change JavaScript test/runner files, not PHP. |
| General test-runner normalization | DEFERRED | BC-005/006 outside the selected gate remain bounded debt. |
| Dormant shared-port test repair/removal | DEFERRED | BC-007 is not discovered by VUI-10 and is not required for the selected seam. |
| PHPCS, PHPStan, ESLint, Stylelint, baselines | DEFERRED | Frozen architecture and standard require a separate evidence-based approval. |
| CI, Git hooks, coverage, formatter/auto-fix rollout | NOT NEEDED | No frozen W0 requirement. |
| Composer, PSR-4, namespaces, second loading model | PROHIBITED | Explicit frozen non-goal. |
| Runtime architecture migration, DB/schema, auth, authorization, UI or business changes | PROHIBITED | W0 is characterization and runner safety only. |

W0 is not a generic cleanup phase, toolchain rollout, or hidden W1 wave.

## 5. Current tooling inventory and command resolution

Observed host/tooling state on 2026-10-07:

| Area | Current state |
| --- | --- |
| PHP | Host PHP 8.1.2; `php` and `php -l` resolve. Runtime compatibility remains PHP 7.4/Dolibarr 23. |
| JavaScript | Node 22.22.0 and npm 10.9.4. |
| Package manager | npm with `package-lock.json`; no pnpm/yarn evidence. |
| Browser tests | `@playwright/test` declared as `^1.46.0`; lock/install resolves Playwright 1.61.1. |
| Containers | Docker 28.1.1 and Compose 2.35.1 commands resolve. |
| Composer/PHPUnit | No repository Composer manifest/lock or PHPUnit configuration; Composer executable absent. |
| PHPCS/PHPStan | Not installed or configured. |
| ESLint/Stylelint | Not installed or configured. |
| CSS/build tooling | No preprocessor or build pipeline found. |
| CI | No repository CI workflow found. |
| Task wrappers | No Makefile or pre-commit configuration found. |
| Documentation validation | Reference search, path existence, hash comparison, `git diff --check`, and status inspection. |

| Command | Resolution | Mutation class | W0 use |
| --- | --- | --- | --- |
| `php tests/contracts/table_presentation_test.php` | EXISTS_AND_RESOLVES | READ_ONLY | Required. |
| `php tests/contracts/project_form_security_test.php` | EXISTS_AND_RESOLVES | READ_ONLY | Required. |
| `npm run test:vui10` | EXISTS_AND_RESOLVES to the exact VUI-10 spec | TEST_DB_MUTATION in disposable tenant | Required. |
| `node --test tests/unit/disposable-run.test.js tests/unit/disposable-policy.test.js` | EXISTS_AND_RESOLVES | temporary test filesystem only | Required after runner change. |
| `node --check <changed-js>` | EXISTS_AND_RESOLVES | READ_ONLY | Required for changed JS. |
| `git diff --check` | EXISTS_AND_RESOLVES | READ_ONLY | Required. |
| `npm test` / `npm run test:unit` | Existing but unsuitable as W0 evidence | broad/known qualified behavior | NOT_REQUIRED_FOR_W0. |

The direct PHP contracts previously passed in the forensic regression baseline.
No runtime test was repeated during this documentation-only review.

## 6. Tool compatibility and dynamic assets

The existing W0 tools are compatible enough for authorization: Node satisfies
the installed Playwright requirement, the named scripts and files resolve, and
the disposable runner uses Docker Compose already present in the repository.
Actual W0 execution must confirm Docker access and the expected clean shared
baseline before starting the disposable tenant.

Host PHP 8.1 syntax checks do not prove PHP 7.4 compatibility. This is not a W0
blocker because W0 must not edit runtime PHP. Any unexpected PHP runtime edit
would be scope breach, not a reason to broaden the gate.

The PHP-served assets `mjl_app.css.php`, `mjl_auth.css.php`, and
`native_guard.js.php` confirm that a future lint rollout would need a specific
mixed-language strategy. W0 does not lint, extract, baseline, or change those
assets.

## 7. PHP/JS/CSS quality-gate readiness

| Proposed gate | Readiness for actual W0 |
| --- | --- |
| PHP syntax | READY when a PHP file is changed; no PHP change is expected. |
| JavaScript syntax | READY and required for changed test/runner JS. |
| PHPCS | NOT_REQUIRED; separately deferred. |
| PHPStan | NOT_REQUIRED; separately deferred. |
| ESLint | NOT_REQUIRED; separately deferred. |
| Stylelint | NOT_REQUIRED; separately deferred. |
| CSS validation | NOT_REQUIRED; W0 must not change CSS. |

No new dependency, config file, lockfile change, baseline, formatter, or
auto-fix mode is justified by W0.

## 8. Test harness, environment, and failure-injection safety

VUI-10 discovery is explicit from `package.json` through
`tests/runner/disposable-run.js` and `tests/runner/run-suite.js` to
`tests/e2e/vui-reference-management.spec.js`.

The selected runner:

- allocates a unique loopback port and rejects port 8080;
- requires the disposable project name, environment marker, and sentinel;
- uses named disposable database/document/config volumes;
- mounts repository source and tests read-only;
- tears down disposable containers and volumes;
- compares shared state before and after the run; and
- prevents VUI modes from retaining failed tenants.

`npm run test:vui10` is therefore a controlled `TEST_DB_MUTATION`, not a
read-only command. It must run only through the named runner. Bare Playwright
against the shared port is prohibited.

BC-020 is the only selected-runner defect that must be repaired in W0. Its
failure injection remains test-only: the new unit regression should use a child
that handles termination and exits 0 after the deadline, then require the
runner to report timeout failure.

## 9. Regression and security-critical gates

W0 must hard-fail on:

- either required PHP contract failing;
- VUI-10 not discovering the exact spec;
- allowed-role list GET behavior changing;
- no-role or native Admin list GET not failing closed;
- anonymous access rendering a protected list instead of reaching login;
- any disposable preflight, sentinel, cleanup, or shared-integrity failure;
- BC-020 accepting an elapsed deadline as success; or
- any runtime, schema, UI, dependency, configuration, or unrelated test change.

BC-018, BC-019, Technical Admin reset, reference transaction behavior,
effective-role invariants, Activity authorization, no-self-validation, and
migration recovery remain protected by their existing focused gates. W0 does
not touch those owners and must not rerun or weaken them merely to claim broad
coverage.

## 10. Preservation impact

| Classification | Preservation IDs |
| --- | --- |
| APPLICABLE W0 SET | LIFE-002 plus RT-001–003, RT-010/011/014, SEC-AUTHZ-001/004, and DB-001 for the selected reference-list slice. |
| NOT_TOUCHED | RT-004–009, RT-012/013/015, SEC-AUTH-001–006, SEC-AUTHZ-002/003, SEC-DOC-001/002, DB-002–004, LIFE-001/003/004. |

W0 changes evidence and runner failure semantics only. It must not change any
preserved functional behavior.

## 11. Allowed and protected files

| File/category | Readiness classification |
| --- | --- |
| `tests/e2e/vui-reference-management.spec.js` | ALLOWED: focused characterization only. |
| `tests/runner/run-suite.js` | ALLOWED_WITH_CONSTRAINTS: BC-020 timeout result only. |
| `tests/unit/disposable-run.test.js` | ALLOWED: BC-020 and selected VUI-10 mapping regression. |
| `tests/unit/disposable-policy.test.js` | ALLOWED only if the existing safety contract needs a matching assertion; no policy change is currently identified. |
| W0 documentation/authority status | ALLOWED: record actual W0 result without authorizing W1. |
| Other tests/fixtures/helpers | NOT_NEEDED unless the authorized unit proves the exact characterization cannot be added without one; stop and re-review before expansion. |
| package/lock, Composer, lint/static-analysis config, CI, Git hooks | PROHIBITED for this W0 unit. |
| runtime PHP/JS/CSS/templates, module descriptor, SQL/schema/migrations, auth, authorization, business logic, cron | PROTECTED / PROHIBITED. |

Expected implementation footprint is approximately three test/runner files
plus concise status documentation. Growth beyond that boundary is a scope
checkpoint, not permission to continue.

## 12. Dependencies, production impact, and verification model

No new dependency is required. Existing Node, Playwright, PHP, Docker, and
Compose facilities are sufficient. W0 has no production runtime impact:
changes stay in tests, test orchestration, and documentation.

The canonical W0 verification model is the existing set of focused commands,
not a new universal entrypoint. Checks are local or CI-capable where Docker is
available, but W0 does not add CI. Database/browser verification is manual-on-
demand through the named disposable runner; syntax, focused runner unit tests,
the PHP contracts, and diff checks run locally.

## 13. Enforcement matrix

| Frozen standard area | W0 enforcement |
| --- | --- |
| File responsibility/dependency direction/`.lib.php` rules | Documentation gate and manual review; W0 makes no runtime move. |
| Transaction handling/DB access | Not touched; existing focused tests remain authoritative. |
| Authorization | Focused direct GET browser characterization plus manual review. |
| Templates and JS/DOM contracts | Existing PHP contracts and VUI-10 test; no UI change allowed. |
| CSS | Not touched; manual scope check. |
| Migration/lifecycle safety | Disposable policy/cleanup evidence; activation and current-schema initialization stay inside the disposable tenant, with no explicit recovery-migration rehearsal. |
| Errors/logging/audit | Not touched. |
| Test discovery and deadlines | Exact runner mapping plus BC-020 unit regression. |
| Duplication/ADR requirements | Manual review; no new abstraction or amendment needed. |

Semantic architecture rules are not candidates for speculative regex
enforcement in W0. Preservation-ledger automation, link checkers, architecture
validators, and generalized compliance scripts are `NOT_NEEDED` for this
unit.

## 14. Debt, baseline, and false-positive policy

Static-analysis and lint baselines are outside W0, so baseline governance is
clear: create none, suppress nothing, and add no tool ignore. Existing broad
runner debt is not converted into W0 failure:

- BC-005 aggregate unit stall remains deferred because W0 does not use that
  aggregate as evidence;
- BC-006 broad discovery debt remains deferred because VUI-10 discovery is
  explicit;
- BC-007 dormant shared-port test remains excluded and must not be run; and
- PHPCS/PHPStan/ESLint/Stylelint noise is not measured or baselined.

Auto-fix is prohibited in W0. Functional defects discovered while adding the
characterization must be reported and separately authorized rather than fixed
inside the prerequisite.

## 15. Git, rollback, entry, and exit

### Entry criteria

- frozen architecture and standard hashes match;
- 35/35 preservation identifiers remain present;
- W0 receives explicit authorization for the bounded unit;
- W1 remains unauthorized;
- worktree is clean or unrelated user changes are identified and excluded;
- Docker/Compose access and exact disposable/shared-state preflight succeed;
- the three-file test/runner boundary and preservation mapping are recorded.

### Exit criteria

- direct unauthorized Partner and Project list GETs are characterized in
  VUI-10 without changing allowed behavior;
- BC-020 rejects all elapsed deadlines, including cooperative exit 0;
- selected VUI-10 discovery is asserted;
- the two PHP contracts, focused runner unit tests, and `npm run test:vui10`
  pass once in the authorized environment;
- disposable cleanup and shared-state integrity evidence pass;
- changed JavaScript passes `node --check` and the diff passes
  `git diff --check`;
- only authorized tests/runner/docs changed; and
- no W1 work or later authorization is implied.

One bounded commit is sufficient unless preserving unrelated user work requires
separation. Rollback is a normal commit revert; there is no schema, runtime,
asset, dependency, or persistent-data rollback.

## 16. W1 dependencies

| W1 dependency | W0 responsibility | Verification | Blocking W1? |
| --- | --- | --- | --- |
| Observable list rendering/form contract | Preserve named PHP contracts | Both direct PHP commands pass | YES |
| Allowed reference-list GET behavior | Characterize current Agent/Supervisor/Validator reads | VUI-10 | YES |
| Direct denial boundary | Add no-role/Admin/anonymous Partner+Project GET assertions | VUI-10 | YES |
| Reliable selected gate | Fix BC-020 and preserve explicit discovery | Runner unit tests plus VUI-10 | YES |
| Disposable isolation | Preserve LIFE-002 preflight, teardown and shared-integrity proof | Runner evidence | YES |

W0 completion would satisfy only these W1 prerequisites. It would not authorize
the W1 extraction.

## 17. Residual-risk disposition and implementation skeleton

| ID | Risk | Likelihood / impact | Mitigation | Blocks W0 authorization? |
| --- | --- | --- | --- | --- |
| W0-RSK-001 | Direct-denial characterization is omitted or asserts only hidden UI | Medium / High | Require direct Partner+Project response behavior in the existing VUI-10 spec. | NO; blocks W0 exit. |
| W0-RSK-002 | Deadline child exits 0 and falsely passes | Low / High | Fix BC-020 before relying on VUI-10; add cooperative-exit regression. | NO; blocks W0 exit. |
| W0-RSK-003 | Docker/shared baseline unavailable during implementation | Medium / Medium | Fail preflight and stop; do not fall back to port 8080 or a shared write. | NO; execution prerequisite. |
| W0-RSK-004 | Scope expands into general tooling or legacy runner cleanup | Medium / High | Enforce the file allowlist and stop at the lean checkpoint. | NO. |

| Step | Purpose | Likely files | Runtime impact | Verification / rollback |
| --- | --- | --- | --- | --- |
| 1 | Record authorized baseline and preservation mapping | documentation only | None | hash/status check; revert docs |
| 2 | Add direct unauthorized GET characterization | VUI-10 spec | None | VUI-10; revert test |
| 3 | Correct BC-020 and assert selected discovery | runner + runner unit test | None | focused Node tests; revert runner/test |
| 4 | Run exact W0 gates | no source change | Disposable test tenant only | two PHP contracts, Node tests, VUI-10, syntax/diff checks |
| 5 | Record W0 result and stop | authority/roadmap documentation as required | None | diff/status review; W1 remains unauthorized |

## 18. Blockers and final verdict

Pre-authorization blockers: **0**.

The exact scope, allowed files, protected runtime boundary, existing toolchain,
disposable test safety, required characterization, BC-020 repair, verification,
rollback, and W1 dependencies are sufficiently defined. The two missing proofs
are deliberately the bounded outputs of W0 rather than prerequisites that must
already exist before W0 can be authorized.

```text
W0_READY_FOR_AUTHORIZATION
W0: NOT_AUTHORIZED
W1–W7: NOT_AUTHORIZED
```

The next possible task is a separate explicit W0 implementation authorization.
No implementation is authorized by this review.
