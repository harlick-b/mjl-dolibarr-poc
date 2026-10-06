# MJL Engineering Standard v1

## Status and authority

**Standard status: `STANDARD_READY_FOR_REVIEW`.**

This document is a review candidate derived from the frozen MJL target
architecture. It is not yet a frozen canonical standard, does not amend the
architecture, and authorizes no implementation, W0 prerequisite work, W1–W7
migration wave, production work, dependency change, or tooling rollout.

The frozen architecture remains
`docs/architecture-audit/17-target-architecture-proposal.md`, SHA-256
`b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c`.
Document 18 remains historical review evidence with verdict
`ARCHITECTURE_REVISION_REQUIRED`; the later correction reviews passed before
the architecture freeze.

## 1. Scope and normative language

This standard governs MJL-owned PHP and Dolibarr integration, entrypoints,
modules, adapters, policies, workflow commands, reads, authorization, database
access, transactions, templates/HTML, JavaScript, CSS, frontend contracts,
lifecycle and migrations, hooks, cron, exports, audit, errors, logging, tests,
static-analysis direction, documentation, Git and review practices.

It does not redesign product behavior or visual design, govern Dolibarr core or
third-party/vendor code, authorize deferred phases, or permit MJL changes in
Dolibarr core. The approved v3 design package governs visual presentation; the
canonical product documents govern business behavior.

- **MUST / MUST NOT**: mandatory for a conforming change.
- **SHOULD / SHOULD NOT**: expected unless the change records a concrete,
  reviewable reason.
- **MAY**: permitted, not required.

Security, data-integrity, preservation, transaction and lifecycle rules use
MUST/MUST NOT. These terms do not retroactively authorize correction of known
implementation debt during a structural migration.

## 2. Authority and conflict resolution

The repository authority router controls precedence. For engineering work:

1. the user's latest explicit instruction;
2. `docs/mjl-authoritative-decisions.md`;
3. the canonical document for the affected subject, including the frozen
   architecture for architecture boundaries and migration-wave contracts;
4. the approved v3 design package for visual presentation only;
5. gap analysis and current-state evidence;
6. existing code and tests as current-state evidence only;
7. this review-candidate standard until it is separately frozen;
8. applicable Dolibarr and generic language/tool conventions.

This document MUST NOT override a canonical business, permission, workflow,
data, scope or architecture decision. An irreconcilable conflict MUST stop the
change and be raised as an architecture amendment or product decision.

## 3. Responsibility and source-file standard

| Module role | Purpose and allowed contents | MUST NOT contain | Naming/location and review check |
| --- | --- | --- | --- |
| root web adapter | Dolibarr bootstrap, capture required globals, select one handler, dependency-free denial response | business SQL, workflows, large HTML, business transaction control | stable root URL; reviewer can trace one handoff |
| feature request handler | normalize method/action/input; route guard; CSRF/submission token; session-backed form effects; invoke command/read; map result to redirect/view/error | direct business SQL, trigger knowledge, HTML fragments, business transaction ownership | `lib/<feature>/mjl_<feature>_http.lib.php`; effects finish before rendering |
| policy module | answer one action-specific authorization or eligibility question using explicit actor/entity and current facts | mutation, rendering, vague permission bags, reliance on UI state | `lib/<feature>/...policy.lib.php`; commands still reauthorize locked facts |
| workflow command module | one mutation interface owning locks, authoritative authorization, writes, audit and its documented transaction behavior | HTTP globals, templates, event messages, browser state | deep `Mjl...` class in `class/`; finite outcomes or documented infrastructure failure |
| feature read module | orchestrate use-case reads and any bounded read snapshot, including isolation, begin/commit, failure result and DB-session budget restoration | mutation, HTML, write authorization | procedural feature read library; handler maps result |
| scoped query owner | entity/role-scoped read SQL | mutation, HTTP/session state, write authorization | retain `MjlMonitoring` where assigned; no competing query class without distinct need |
| presenter/template | render prepared values and eligibility flags as escaped French-first HTML | DB/session access, mutation, request parsing, authoritative policy | `lib/<feature>/...presentation.lib.php` and `tpl/<feature>/` |
| browser feature module | enhance documented DOM/form behavior with existing fallback | authorization, authoritative business/financial rules, undisclosed storage/network behavior | current public assets retained until an authorized producer/consumer migration |
| audit writer/projection | append evidence inside caller transaction; separately produce authorized/sanitized views | independent commit for a successful business mutation, route HTML | `lib/audit/`; log and audit are distinct |
| export workflow | capture snapshot, render privately, reacquire current authorization, persist evidence, return delivery handle | direct response streaming inside its DB transaction | retained `MjlExport`/spool seam |
| lifecycle functions | exact read-only recognition or guarded install/apply/resume/rollback with checkpoints | normal HTTP rendering, silent unknown-state repair, runtime DDL calls | retain current schema/CLI/SQL-resource paths unless a whole dependency closure is approved |
| descriptor adapter | metadata, rights, menus, hooks/assets/cron declarations and explicit lifecycle orchestration | embedded feature workflow or reabsorbed detector/installer implementation | `modMjlFinancement` |
| hook adapter | translate Dolibarr hook calls to auth/navigation modules | duplicate auth state machine or business mutation | Dolibarr-discovered class naming retained |
| low-level pure utility | stable calculation/encoding with no orchestration | DB/session globals, workflow decisions, mixed unrelated helpers | narrow feature name; no generic dumping ground |

MJL-specific code MUST remain under `custom/mjlfinancement`, documentation,
documented setup scripts, disposable test-fixture locations, tests, SQL/update
files, or an approved custom-theme seam. Dolibarr core MUST NOT be modified.

## 4. Entrypoints and `.lib.php`

Root entrypoints MAY bootstrap Dolibarr, capture required runtime values, issue
their existing dependency-free denial response, and call one handler. Method
normalization, CSRF/submission-token work, authorization policy, command/read
invocation, feedback and presentation belong to the handler. Root entrypoints
MUST NOT accumulate reusable rules, complex SQL, transactions or large HTML.

`.lib.php` is an approved procedural form, not a generic layer:

**Allowed**

- thin HTTP/compatibility adapters and action-specific policies;
- feature read and presentation preparation modules;
- existing token, recovery, feedback and navigation helpers invoked by the
  handler that owns their session-backed effect;
- the one private auth session adapter;
- narrowly named pure feature utilities;
- retained exact schema/lifecycle functions at their current guarded seams.

**Not allowed**

- a new long-lived business state machine or unowned business transaction;
- hidden commits, cross-feature workflow orchestration or authoritative UI-only
  policy;
- a catch-all `utils.php`, `helpers.php` or `common.php`;
- moving lifecycle DDL into a normal runtime feature library;
- direct session access below handlers except the frozen private auth adapter
  and retained form-effect helpers at their explicit seams.

A helper becomes shared only after demonstrated reuse, semantic equivalence,
stable responsibility, low business coupling and a named owner. The deletion
test applies: removing a proposed module should force meaningful behavior back
into its caller(s), resource lifecycle or tests, not merely delete a one-line
pass-through. A single-caller module is justified only when its small interface
hides real state, ordering, failure or resource complexity.

## 5. Classes, interfaces and dependencies

Classes are for deep modules that own stateful workflows, locks, transactions,
resources or a substantial interface. Procedural functions remain appropriate
for Dolibarr adapters, pure rules, HTTP adaptation and presentation. A change
MUST NOT add an interface-per-class or interchangeable adapter without a second
real adapter or another frozen requirement. Abstract base classes,
repository-per-table layers, containers and event buses remain prohibited
unless an approved material architecture amendment explicitly introduces them;
multiple implementations alone do not authorize such a layer.

A command class returns finite business outcomes or a documented infrastructure
failure; a scoped query class returns shaped read data; an adapter returns the
host-compatible result at its seam. Tests SHOULD exercise that public interface
and real trust seam. Private implementation helpers are not promoted merely to
make them directly testable.

Allowed dependency direction:

```text
root/hook adapter -> handler/orchestration
handler -> {policy, workflow command, feature read, presenter}
feature read -> {scoped query owner, exact read-only schema detector, DB}
workflow command -> {DB/native adapter, audit writer, pure rules}
auth orchestration/hook -> {pure validity policy, private session adapter}
presenter -> template -> documented DOM/CSS contract
runtime policy/query/command -> exact read-only schema detector
descriptor/guarded CLI -> retained lifecycle operation -> DB/DDL
cron adapter -> reconciler -> Activity command
```

Reverse dependencies MUST NOT be introduced. Templates MUST NOT call policies;
feature reads MUST NOT authorize writes; audit writers MUST NOT call commands;
lifecycle/schema libraries MUST NOT call runtime handlers. Runtime access to a
schema library MUST stop at exact read-only recognition and MUST NOT reach
install/apply/resume/rollback behavior.

Globals, environment and Dolibarr runtime context MUST be captured at an
adapter and passed explicitly, except where the frozen architecture names a
private compatibility adapter. Hidden global/session dependencies are part of
a module's interface and MUST be documented or removed in its authorized wave.

## 6. PHP baseline and typing

Architectural rules in this standard take precedence over style preferences.
New or changed PHP MUST remain compatible with PHP 7.4 and Dolibarr 23 callback
and discovery conventions unless a separately approved compatibility change
updates that baseline.

- Changed code SHOULD match the surrounding Dolibarr/MJL indentation and brace
  style; formatting-only churn MUST NOT be mixed into a structural migration.
- New code SHOULD keep one logical statement per line unless the surrounding
  compatibility style makes a short guard materially clearer.
- MJL classes use `Mjl...` and Dolibarr-compatible lowercase
  `mjl....class.php`; procedural names use `mjl_<feature>_<role>_*`.
- New constants use feature-scoped uppercase `MJL_*` names and MUST NOT silently
  redefine a host or cross-feature constant.
- Visibility MUST be explicit for new class members. Internal seams SHOULD be
  private unless a real caller/test interface requires otherwise.
- Comparisons involving security state, finite codes, nullable amounts or IDs
  MUST avoid truthiness that conflates valid zero, null and failure.
- Null financial data MUST remain distinct from zero. XOF calculations MUST
  remain integer-safe.
- Expected business rejection SHOULD use a finite result; infrastructure or
  programming failure MAY throw at a seam whose caller maps it once.
- Comments/PHPDoc SHOULD explain interface invariants, non-obvious ordering,
  compatibility and failure modes—not restate syntax.
- Dynamic invocation or registration MUST be retained only where required by a
  characterized Dolibarr interface and MUST be included in reachability review.

Native parameter/return types MAY be added gradually only when PHP 7.4,
Dolibarr callback signatures and all callers are proved compatible. PHPDoc MAY
describe stable array shapes or mixed native values where native typing is not
practical. Repository-wide typing conversion is forbidden without separate
approval.

Namespaces, PSR-4 and Composer autoload restructuring are **DEFERRED**. W0 and
W1–W7 MUST NOT introduce a second loading model opportunistically.

## 7. Database access and invariants

Only a frozen responsibility whose interface requires persisted facts MAY
access `$db`: an assigned workflow command or its private native adapter,
feature read/scoped query owner, action-specific read policy, audit module,
export workflow, retained email adapter for its existing configuration/delivery
evidence, or lifecycle function. Handlers, presenters/templates, browser code
and CSS MUST NOT.

- Every custom-object, dashboard, alert, export, audit, document and workflow
  query MUST filter by the active Dolibarr entity at its owning seam.
- SQL MUST remain local to the owner of its semantics. A private helper MAY
  remove repeated syntax inside one module. Cross-feature sharing requires
  proof of identical entity, lock, visibility, ordering, null and historical-
  schema semantics.
- External scalar values MUST be validated/cast and escaped through the
  supported DoliDB mechanism for their type. Identifiers/table fragments MUST
  come from fixed definitions, never raw request input.
- A read result MUST NOT authorize a later write; the command reloads and locks
  authoritative facts.
- Do not distribute SQL across arbitrary callers, and do not create a generic
  query builder or repository for every SELECT.

Application business rules belong in policies/commands. Structural invariants
belong in keys, foreign keys, nullability and checks. Cross-writer security or
integrity invariants MAY remain in verified triggers. Existing invariant
constraints/triggers MUST be retained unless an approved replacement protects
the same trust seam and remaps preservation evidence. A new trigger requires
explicit justification, exact-definition verification and focused DB tests.
Generated columns are structural definitions: application writes MUST NOT treat
them as mutable input, and a definition change requires guarded lifecycle work,
exact-state verification and affected calculation tests.

## 8. Transaction and read-snapshot standard

The following distinction is mandatory:

1. The reference write seam MUST preserve its verified checked
   begin/commit/rollback/connection-quarantine contract.
2. A new mutation owner or a separately approved transaction-hardening change
   MUST check `begin()` and `commit()`, return no success after failed commit,
   attempt rollback on failure, and prevent reuse of a connection whose
   rollback outcome is uncertain. It requires focused failure injection.
3. A structural relocation of another existing owner MUST preserve its
   characterized current behavior. It MUST NOT claim or silently introduce the
   stronger contract without separate behavioral approval and proof.

One workflow command owns the outer business transaction. A callee MAY join it
only through an explicitly transaction-participating operation that never
begins, commits or rolls back and propagates failure. Nested transaction
ownership is not a public feature. Success audit belongs in the mutation
transaction; a post-commit audit MUST NOT substitute for it.

Feature read modules may own bounded read-only snapshots. They MUST own and
restore isolation, statement/lock budgets, checked begin/commit and failure
results on every path. Handlers and templates MUST NOT own those snapshots.

## 9. Authentication and session standard

- Access remains invitation-only; public registration MUST NOT be introduced.
- Invitation/reset selectors and verifiers, expiry, throttling, single use,
  neutral reset response and entity scoping MUST retain their canonical rules.
- Password verification, OTP attempts/resends/cooldown, HMAC/hash binding and
  fingerprint invalidation MUST remain fail closed.
- The narrow technical-Admin reset exception MUST NOT become a business-role or
  cross-entity bypass.
- Native-login bypass protection MUST clear/reject authenticated state lacking
  verified OTP evidence when the gate is enabled.
- Pure validity policy returns a decision and MUST NOT mutate a session. The
  one private procedural auth session adapter owns pending-state mutation,
  clearing and regeneration at existing orchestration/hook decision points.
- Successful OTP persistence MUST commit before authenticated-session
  completion/regeneration.

Invitation/reset delivery preserves three existing completion boundaries:
preparation persists pending credential state and issuance audit and commits;
the email adapter then renders/sends while the current identity lock remains
held; a separate transaction records `sent` or `send_failed`, hash-clearing
behavior and delivery audit. SMTP MUST NOT move inside the preparation
transaction, and a delivery-result persistence failure MUST NOT be described as
rolling back either the earlier commit or a sent email.

BC-018 is mandatory: every MJL invitation/reset password write MUST use the
private encrypted-only native adapter, restore the prior configuration in
`finally`, and leave `llx_user.pass IS NULL`. No alternate native password
write or plaintext fallback is permitted.

## 10. Authorization standard

**UI visibility is NOT authorization.**

Handlers MUST enforce direct-route policy; commands MUST reload authoritative
entity, role, assignment, state, revision and version facts under their required
locks; database invariants remain the final cross-writer protection. Missing,
unknown or conflicting context MUST deny or return unavailable, never grant.

Policies SHOULD expose action-specific questions with explicit actor/entity
instead of permission bags or manual combinations of unrelated helpers. Agent
visibility follows current Activity assignment; Supervisor/Validator visibility
and Admin's technical-only role follow the canonical permission matrix. Admin
exceptions MUST be named and narrow. Revision contributor/prevalidator identity
checks MUST preserve no-self-validation.

## 11. Lifecycle and migration standard

The descriptor owns Dolibarr metadata, rights, menus, hooks, assets, cron
registration and explicit `init()`/`remove()` orchestration. It MUST NOT absorb
feature workflow or detailed detector/installer implementation. Module removal
MUST retain business data under the frozen lifecycle contract.

Runtime routes/policies/queries/commands MAY call retained exact read-only
schema detectors and verifiers. Only activation or guarded CLI entrypoints MAY
invoke install/apply/resume/rollback behavior.

An authorized migration MUST:

- acquire its existing database/prefix-scoped lock and retain entrypoint guards;
- recognize exact target, supported predecessor and every accepted contiguous
  partial prefix; refuse unknown/conflicting shape before writes;
- preserve named step order, failure points and checkpoint/postcondition checks;
- be safely resumable after MariaDB implicit commits; it MUST NOT claim generic
  DDL atomicity or rollback idempotency;
- preserve supported historical behavior until a support-horizon decision;
- keep production behavior independent of disposable test modes except behind
  the exact approved test-tenant guard;
- verify the exact target after completion and propagate failure;
- include every changed caller, require/include and SQL/resource lookup in one
  reversible code unit; code rollback MUST NOT be described as undoing
  committed DDL.

Retry/resume always begins by re-detecting persisted database truth. Exact
target performs no migration DDL and only verifies/returns through the permitted
entrypoint; a supported predecessor begins the guarded transition; an exact
known prefix resumes at its next verified step; unknown or non-contiguous state
refuses. In-memory progress or a previous process's success claim MUST NOT
substitute for detection. “Idempotent” MUST NOT be used to imply that arbitrary
DDL replay or transaction rollback is safe.

BC-019 remains explicit: every early RST-006B Operation-check prefix accepted
by `mjl_rst006b_is_known_prefix()` MUST be classified as partial by
`mjl_rst006b_detect_schema()`, and its interruption/resumption/target/rollback
matrix remains required evidence.

## 12. Templates, JavaScript, CSS and frontend contracts

Templates receive prepared data and eligibility flags. They MAY perform simple
presentation conditionals and escaping; they MUST NOT query/mutate the DB,
read/change sessions, parse requests or decide authoritative access. Output
MUST use context-appropriate escaping and retain French-first/XOF semantics.

JavaScript enhances ordinary forms/links where the current contract has a
fallback. It MUST bind behavior to documented `data-mjl-*` hooks rather than
incidental color/spacing classes, and MUST NOT be the sole enforcement of
authorization, money or workflow rules. New fetch/XHR or browser-storage
architecture requires separate approval; the frozen architecture introduces
none. Initialization MUST be explicit, scoped to present documented roots and
safe when the root is absent. Event handlers MUST preserve submitter/default
behavior and accessibility contracts. Existing approved Dolibarr/browser
globals MAY be consumed at the adapter edge; new mutable application globals
MUST NOT be introduced without an explicit interface need. Where the current
contract provides ordinary-form fallback, errors MUST preserve it. JS-required
security flows such as fragment-to-POST auth redemption instead fail closed and
preserve their characterized recovery. No error path may expose secrets.

CSS follows the approved v3 visual package. Tokens, global primitives, shared
components and feature/page rules SHOULD remain distinguishable; selectors
SHOULD use the lowest practical specificity. CSS MUST NOT encode business
authorization or become an undocumented JS interface. Dark/light behavior is
governed only if the approved design package defines it; this standard invents
none. Duplicate declarations MUST be classified as intentional compatibility,
cascade behavior or debt before consolidation; textual similarity alone is not
proof. New local class names SHOULD use the established `mjl-` feature/component
vocabulary. Responsive and accessibility contracts, including existing named
breakpoints such as the navigation drawer's 980px behavior, MUST be preserved;
changes require the relevant design authority and browser proof.

IDs, `data-*` hooks, form names/actions, submitter values, CSS state classes,
JS selectors, URLs, JSON shapes and ARIA state are frontend interfaces. A
change MUST inventory and migrate every producer/consumer in one bounded unit.
Temporary dual hooks MAY exist only inside that unit and MUST be removed with
their compatibility proof before exit.

## 13. Errors, logging and audit

- Invalid method/input/token: handler rejects before command with the current
  400/403 or safe redirect contract.
- Expected business conflict: finite result mapped once to sanitized French
  feedback; no success audit.
- Infrastructure/programming failure: documented failure result or exception
  mapped once at the owning seam; raw DB/internal details MUST NOT reach users.
- Migration unknown/conflicting state: fail activation and guarded CLI before
  writes. Activation also refuses partial state; the explicitly guarded CLI MAY
  resume only an exact known prefix supported by its detector and checkpoints.
- Cron/export failures: preserve the characterized completion boundary and
  return semantics until a separately approved behavior change.

`dol_syslog` is a technical operational log, not business evidence. A failure
SHOULD be logged once at the seam with useful entity/object/action/correlation
context when that behavior is approved; structural moves MUST NOT invent a
logging guarantee. New logging SHOULD use `LOG_ERR` for failed required
operations/security enforcement, `LOG_WARNING` for recoverable anomalies and
`LOG_INFO` sparingly for meaningful lifecycle milestones; debug detail remains
environment-controlled. Logs MUST NOT contain passwords, plaintext OTPs, invitation
or reset secrets, verifier material, raw credentials or sensitive payloads.

Business/audit events are durable immutable evidence. Required success evidence
MUST participate in the owning mutation transaction. A technical log MUST NOT
replace it. Failed-attempt audit is written only where the existing security
contract owns it, and audit payloads MUST obey the same secret prohibition.

## 14. Cron and export standards

Cron registration remains in the descriptor; execution remains in
`MjlExecutionReconciler`, which calls the Activity command. Current fail-fast
and `$conf->entity` behavior MUST be preserved. BC-008/009 leave continuation,
retry, multi-entity topology and concurrency semantics **DEFERRED**; changing
them requires a product/operational decision and focused tests. Cron code MUST
return a Dolibarr-compatible result, avoid fabricated completion and keep each
Activity mutation within the Activity command's transaction. Current timezone
and scheduling semantics MUST be characterized and preserved; host-local time
MUST NOT silently replace the configured Dolibarr context.

Export sequencing is:

```text
HTTP authentication/role/CSRF/filter validation
-> repeatable-read scoped capture and private rendering
-> fresh locked authorization plus evidence/audit transaction
-> delivery handle
-> HTTP headers and stream
```

Sensitive headers/output MUST NOT begin before generation and fresh
authorization succeed. Filenames, French labels, formats, MIME headers,
server-side filters, private spool and allowed columns MUST retain their
contracts. `GENERATED` records completed generation/evidence, not successful
client receipt; delivery failure MUST NOT rewrite that meaning. Server read
failure and retry identity remain explicitly gated residual decisions.

## 15. Duplication and anti-patterns

Classify duplication before changing it:

- D1 exact: consolidate only with caller/contract proof.
- D2 structural: similar shape is insufficient; compare semantics first.
- D3 semantic: centralize only when entity, lock, ordering, null and historical
  behavior are identical.
- D4 intentional/defense-in-depth: retain when checks protect different trust
  seams.

No duplicated implementation may be centralized until semantic equivalence and
security-seam intent are established.

| DON'T | WHY | USE INSTEAD |
| --- | --- | --- |
| business logic/SQL/HTML in a root entrypoint | destroys traceability | one handler handoff |
| mixed-responsibility `.lib.php` | hides owners and side effects | named feature module or deep command |
| template DB/session mutation | creates an alternate workflow | prepared data from handler/read module |
| frontend-only authorization | direct/concurrent bypass | route policy plus locked command checks |
| unchecked new transaction results | false success/uncertain connection | approved checked contract with fault tests |
| generic helper dumping ground | loses locality and ownership | narrow feature-owned pure helper |
| runtime path that can reach migration DDL | unauthorized schema mutation | exact read-only detector only |
| blind permission deduplication | removes defense in depth | classify D3/D4 and preserve trust seams |
| cosmetic CSS selector as JS interface | accidental coupling | documented `data-mjl-*` hook |
| swallowed failure or duplicate logging | hides the owning seam | one mapped result/log/audit owner |

## 16. Testing and regression standard

Verification is risk-based; no arbitrary coverage percentage applies. Select
the smallest maintained check covering the changed responsibility and its
authorization, security or data-integrity risk, following
`docs/mjl-acceptance-tests.md`.

- Characterization tests precede movement of unclear current behavior.
- Pure rules use focused unit tests; real DB/entity/lock/trigger behavior uses
  isolated disposable integration tests.
- Authorization tests cover UI visibility, direct URL/POST, locked command and
  DB invariant at their distinct seams.
- Transaction changes require owner-specific begin/write/commit/rollback fault
  injection; passing reference tests do not prove other owners.
- Lifecycle changes require exact current/predecessor/unknown/prefix,
  interruption, resume, target verification and teardown evidence.
- Frontend changes test the affected producer/consumer contract and ordinary
  fallback; exports test scoped content, evidence and relevant failure boundary.
- Cron behavior changes require the separately decided entity/retry/partial-
  failure contract before tests can encode it.

Every authorized migration/refactor MUST preserve applicable URLs, auth,
authorization, DB effects, transaction/session semantics, hooks, cron,
lifecycle, frontend interfaces and the preservation ledger unless a separately
approved functional change explicitly supersedes them. Tests are evidence, not
acceptance or permission for another phase.

## 17. Static analysis and formatting

| Tool | Current standard |
| --- | --- |
| `php -l` | MUST run on changed PHP when available |
| `node --check` | MUST run on changed JavaScript when applicable |
| PHP_CodeSniffer/Dolibarr rules | **DEFERRED / not configured**; requires a measured baseline and separate approval |
| PHPStan | **DEFERRED / not configured**; requires a scoped defect goal and baseline |
| ESLint | **DEFERRED / not configured**; must account for Dolibarr/browser globals and generated assets |
| Stylelint | **DEFERRED / not configured**; requires reconciliation with approved v3 and current dynamic CSS |

No unconfigured tool may be claimed as a gate. If later approved, existing debt
MAY be baselined and newly touched code SHOULD introduce no new in-scope
violations. Auto-fix MAY be used only on the bounded touched surface after diff
inspection; broad formatting that obscures an architecture migration is
forbidden.

## 18. Documentation, amendments and Git

Code changes MUST update the canonical owner of any changed business,
permission, workflow, data or implementation-state fact. Frozen architecture
changes only through explicit pre-implementation amendment. Preservation
mapping changes require architecture review. Ordinary implementation details
do not edit the frozen architecture or this standard merely to narrate code.

Material changes include responsibility ownership, dependency direction,
security seam, transaction owner, lifecycle architecture, preservation mapping
or major wave ordering. They require an approved architecture amendment or ADR
before implementation. Private extraction, local names/algorithms, a small
helper within an approved owner and local test refactoring are non-material if
all interfaces and behavior remain preserved.

Architecture migration commits SHOULD be bounded and omit unrelated cleanup.
Functional correction MUST NOT be hidden inside structural movement. Existing
user work MUST be preserved; a dirty worktree is not permission to revert it.
An authorized migration SHOULD start from a recorded baseline and exclude
unrelated dirty paths from its commit.
The authorized wave defines its rollback/forward unit, prerequisites, focused
checks and exit criteria. No arbitrary commit-size rule applies.

## 19. Review checklist

- [ ] Is the request authorized, and is W0/the relevant wave separately approved?
- [ ] Does each file own the responsibility it changes?
- [ ] Does dependency direction match section 5?
- [ ] Are hidden globals/session/environment dependencies explicit?
- [ ] Is UI visibility backed by server policy and locked authorization?
- [ ] Is entity/assignment/no-self-validation behavior preserved?
- [ ] Is transaction or snapshot ownership explicit and evidence-qualified?
- [ ] Are begin/commit/rollback claims valid for this owner?
- [ ] Is SQL at its semantic owner and entity scoped?
- [ ] Is duplication classified before consolidation?
- [ ] Did a URL, form, DOM, JS, CSS, JSON or ARIA interface change?
- [ ] Are all producers/consumers and preservation IDs mapped?
- [ ] Are lifecycle state, callers/includes/resources or DDL semantics touched?
- [ ] Are the smallest relevant tests and syntax checks named and run?
- [ ] Is the diff bounded, with documentation and rollback/forward needs met?
- [ ] Does this require an architecture amendment or product decision?

## 20. Definition of Done for authorized architecture work

An authorized W0 prerequisite unit or W1–W7 migration-wave unit is done only
when:

- its explicit authorization, prerequisites, preservation mapping and scope are
  recorded;
- implementation follows the frozen architecture without speculative modules;
- applicable authorization, transaction, session, DB, lifecycle and frontend
  interfaces are verified at their real seams;
- the smallest required tests/static checks pass with limitations reported;
- documentation is reconciled, old replaced ownership is removed, unrelated
  diff is absent, and the wave's rollback/forward strategy remains credible;
- independent review finds no actionable standards/specification issue; and
- passing checks are not represented as acceptance, production readiness or
  authorization of the next unit.

## 21. W0 and W1–W7 governance

W0 is a prerequisite, not a migration wave. It is `NOT_AUTHORIZED`, incomplete,
and may later be authorized only to add/repair the smallest focused
characterization required by the first selected responsibility, with isolated
fixtures and no runtime behavior change.

W1–W7 are seven separately authorization-gated migration waves. Each future
wave MUST verify its document-17 prerequisites, map affected preservation IDs,
characterize before movement, implement one bounded responsibility slice, run
focused after-checks, preserve a credible rollback/forward unit, meet its exit
criteria and receive clean review. This standard does not reproduce or approve
their scopes.

Current state:

```text
W0: NOT_AUTHORIZED
W1: NOT_AUTHORIZED
W2: NOT_AUTHORIZED
W3: NOT_AUTHORIZED
W4: NOT_AUTHORIZED
W5: NOT_AUTHORIZED
W6: NOT_AUTHORIZED
W7: NOT_AUTHORIZED
```

## 22. Illustrative patterns

These examples illustrate shape only; they are not mandatory new interfaces.

```php
// Thin root adapter: bootstrap/capture, then one handoff.
require '../../main.inc.php';
mjl_activity_http_handle($db, $user, $conf->entity);
```

```php
// Handler prepares effects and values; template only renders.
$token = mjl_form_submission_issue($context);
$view = $readModule($actor, $entity, $input);
require $template;
```

```html
<!-- Stable behavioral hook; visual classes may evolve independently. -->
<button type="button" class="mjl-button" data-mjl-dialog-open="review-dialog">
```

```php
<!-- Template output remains data-only and context-escaped. -->
<h1><?php echo dol_escape_htmltag($view['title']); ?></h1>
```

Implementations MUST still use the current approved interfaces and compatibility
contracts; examples do not authorize new functions or markup.

## 23. Scenario self-check

| Scenario | Standard answer |
| --- | --- |
| new Activity mutation | deep Activity command; handler route policy plus locked command authorization; command-owned transaction/SQL/audit; workflow, authz, DB and fault tests |
| proposed shared helper | `.lib.php` only if pure/stable/reused with one owner; deletion test; no generic helper file |
| new JS behavior | documented `data-mjl-*` producer/consumer contract, server remains authoritative, fallback and focused frontend test |
| migration work | guarded CLI/activation owner, exact-state/prefix refusal, lock/checkpoints/resume/target proof; BC-019 retained |
| password reset change | auth owner/private adapters, entity/Admin rules, token contract, BC-018 `pass IS NULL`, auth E2E |
| duplicate permission checks | classify D3 versus D4 and trust seams before consolidation; retain route/command/DB defense in depth |

All six scenarios have an unambiguous owner, prohibited shortcuts and evidence
gate. No architecture amendment is required to publish this review candidate.

## 24. Traceability

| Standard sections | Primary source classification |
| --- | --- |
| 1–2 status/scope/precedence | ARCHITECTURE; repository authority |
| 3–5 roles/files/dependencies | ARCHITECTURE sections 3–7; PRESERVATION RT-001–014 |
| 6 PHP/typing/loading | ARCHITECTURE section 7/18; DOLIBARR_STANDARD; FORENSIC_FINDING standards assessment |
| 7–8 DB/transactions/snapshots | ARCHITECTURE sections 8/12; PRESERVATION DB-001–004; FORENSIC_FINDING AR-REV-002/006 |
| 9–10 auth/authorization | SECURITY_REQUIREMENT; PRESERVATION SEC-AUTH-001–006 and SEC-AUTHZ-001–004 |
| 11 lifecycle/migrations | ARCHITECTURE section 11/W6; PRESERVATION LIFE-001–004; SECURITY_REQUIREMENT BC-019 |
| 12 frontend | ARCHITECTURE section 10; FORENSIC_FINDING frontend contracts; approved v3 visual authority |
| 13 errors/log/audit | ARCHITECTURE section 12; SECURITY_REQUIREMENT secret/audit handling |
| 14 cron/export | ARCHITECTURE sections 8/15/16; FORENSIC_FINDING BC-003/008/009/013 |
| 15 duplication/utilities | ARCHITECTURE section 13; FORENSIC_FINDING duplication report |
| 16 testing/regression | PRESERVATION ledger; FORENSIC_FINDING regression baseline; acceptance-test authority |
| 17 tooling/formatting | ARCHITECTURE non-goals; FORENSIC_FINDING standards assessment |
| 18 amendments/Git | frozen-baseline governance; repository instructions |
| 19–21 review/DoD/waves | ARCHITECTURE sections 16–19; PRESERVATION all affected IDs |
| 22–23 examples/self-check | derived illustrations; no new interface authority |

## 25. Review gate

- [x] compatible with the frozen architecture;
- [x] major target responsibilities and enforceable dependencies covered;
- [x] PHP, `.lib.php`, DB, transaction, auth, authorization, lifecycle,
  frontend, error/logging, testing and tooling direction defined;
- [x] review checklist and Definition of Done defined;
- [x] W0 and W1–W7 terminology correct;
- [x] no architecture redesign or implementation authorization introduced.

The checks above establish readiness for independent review only. They do not
freeze this standard.

```text
STANDARD_READY_FOR_REVIEW
```
