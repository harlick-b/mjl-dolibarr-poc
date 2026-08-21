# RST-013A Phase 1 Test Reset Strategy

Status: `APPROVED` on 2026-08-21; implementation and verification are in
progress. Approval provenance: the user stated `I approve RST-013A` after
RST-014A reached `EXECUTED`. The user separately approved the 2026-08-21
amendment authorizing exactly one disposable same-entity, matched-parent
Activity projection-control row with unique canaries, while forbidding any
SQL fixture resumption and requiring factory-only setup in a serial group.

This unit reconciles the Phase 1 test inventory after earlier approved reset
commits. It does not retroactively claim prior deletions and cannot execute
until RST-014A is separately approved, implemented, verified, and reviewed.
Its other execution dependencies are executed RST-001, RST-002A, RST-003,
RST-004, RST-007A, RST-008, RST-009A, and RST-010A; any missing, rolled-back,
or unverified dependency blocks the unit.

## Exact current inventory and disposition

Present paths:

| Path | Disposition | Reason / later owner |
| --- | --- | --- |
| `tests/characterization/permissions.spec.js` | KEEP temporarily | Retained RST-002A scope-table characterization; RST-002B later replaces/removes it. |
| `tests/e2e/partners-projects.spec.js` | KEEP | Current RST-003 reference-foundation public suite. |
| `tests/e2e/cases/partner-project.cases.js` | KEEP and move fixture setup behind RST-014A | Current RST-003 lifecycle, entity, CSRF, concurrency, and direct-guard coverage. |
| `tests/unit/access-audit-fail-closed.test.js` | KEEP | Current append-only audit rollback/static contract. |

The following 13 manifest paths were already deleted by commit `3b5f767`
(`feat: execute phase 1 reset hardening`, 2026-08-14); RST-013A records rather
than repeats that action:

| Already-absent paths | Classification and maintained replacement |
| --- | --- |
| `tests/characterization/finance.spec.js` | Obsolete finance characterization removed with RST-004; absence/schema/route gates live in the Phase 1 reset suite. |
| `tests/characterization/cases/budget-integrity.cases.js` | Obsolete budget characterization removed with RST-004; absence/schema/route gates live in the Phase 1 reset suite. |
| `tests/characterization/cases/convention-integrity.cases.js` | Obsolete Convention characterization removed with RST-004; absence/schema/route gates live in the Phase 1 reset suite. |
| `tests/characterization/cases/fund-receipt-integrity.cases.js` | Obsolete fund-receipt characterization removed with RST-004; absence/schema/route gates live in the Phase 1 reset suite. |
| `tests/e2e/expenses.spec.js` | Obsolete Expense behavior removed with RST-004; no legacy behavior is restored. |
| `tests/e2e/finance.spec.js` | Obsolete finance behavior removed with RST-004; no legacy behavior is restored. |
| `tests/e2e/cases/expense-disbursement.cases.js` | Obsolete disbursement behavior removed with RST-004; no legacy behavior is restored. |
| `tests/e2e/cases/expense-workflow.cases.js` | Obsolete Expense workflow removed with RST-004; no legacy behavior is restored. |
| `tests/e2e/auth-invitations.spec.js` | Replaced by maintained `tests/e2e/phase1-reset.spec.js` and `tests/e2e/auth-concurrency.spec.js`. |
| `tests/e2e/cases/auth-lifecycle.cases.js` | Replaced by maintained `tests/e2e/phase1-reset.spec.js` and `tests/e2e/auth-concurrency.spec.js`. |
| `tests/e2e/access-shell.spec.js` | Replaced by maintained Phase 1 navigation/direct guards. |
| `tests/e2e/scope-security.spec.js` | Requires the current-model dynamic replacements defined below before certification. |
| `tests/e2e/cases/scope-security.cases.js` | Requires the current-model dynamic replacements defined below before certification. |

## Retargeted maintained suite

RST-013A removes the absent `finance.spec.js` entry from the characterization
configuration and leaves `permissions.spec.js` as its only Phase 1
characterization. It updates the acceptance guide and test-coverage registry
to stop presenting deleted suites, obsolete seeded counts, Partner-scope
authorization, legacy finance, or live document behavior as current evidence.

The public Phase 1 replacement matrix is:

- `npm run test:rst003`: Partenaire/Projet/Type d'Opération reference behavior,
  active-entity isolation, CSRF, concurrency, native-route, and direct guards;
- `npm run test:rst007a`: transactional append-only audit and failure behavior;
- `npm run test:rst004`: obsolete finance/schema/route absence;
- `npm run test:rst008`: invitation/reset lifecycle, immediate role/deactivation
  effects, concurrency, rollback, replay, and secret non-leakage;
- `npm run test:rst009a`: role-projected navigation and native technical Admin
  boundary;
- `npm run test:rst010a`: anonymous/authenticated GET/POST document containment,
  traversal/cross-entity/native probes, and filesystem/ECM preservation;
- `npm run test:phase1-reset`: combined cutover, schema mutation,
  failure/restore, empty-tenant, and teardown evidence;
- RST-014A's focused factory/isolation suite.

RST-013A must add current-model dynamic cases for the security invariants that
the deleted scope suite previously carried: zero-versus-poison
`llx_mjlfinancement_user_soc_scope` equivalence; hostile `scope_soc_ids[]` GET
and POST inputs ignored as authorization; Agent Activity direct GET/POST
fail-closed with no data/audit side effect; and Supervisor/Validator reads
rejecting cross-entity or corrupt-parent Activity rows. It also preserves the
rest of RST-002A that still exists after the later RST-004 and RST-010A resets:
every current `MjlActivity` create/update/delete entrypoint fails with both
trigger modes; retired mutation method names remain absent; and the reviewer
projection exposes only same-entity Activity reference, label, matched Projet
reference/title, and technical status. Unique canary values in current note,
planning-date, execution, and private fields plus forms/actions must never
render. Every dynamic denial probe compares current Activity, workflow, ECM,
document-tree, and audit state before/after and permits no unauthorized side
effect.

The removed `MjlExchangeLog` class/table, timeline-comment helper, document-
upload helper, and Activity-to-Convention/amount seams are classified as
obsolete after executed RST-004/RST-010A, not dynamically revived. Their
continued source, schema, and route absence is proven by the maintained
`rst004`, `rst010a`, and Phase 1 reset gates.

RST-014A supplies only the principals and safe references. Focused SQL may
create exactly one same-entity, matched-parent Activity positive-control row
with unique canaries in the current fields, the poison/cross-entity/corrupt-
parent rows, and independent before/after evidence. The positive-control row
exists only to prove the exact safe reviewer projection; it authorizes no
runtime mutation behavior. These cases belong in the maintained
`tests/e2e/phase1-reset.spec.js`, not a recreated legacy path.

All fixture preconditions use one serial setup, with one approved RST-014A
factory call per required entity/namespace. SQL-based fixture resumption is
forbidden. Business
journeys remain browser/HTTP-driven. Focused SQL remains only for deliberate
mutation/corruption/concurrency probes and independent evidence reads.

## Exact implementation paths and data

Modify:

- `tests/characterization/playwright.config.js`;
- `tests/e2e/phase1-reset.spec.js`;
- `tests/runner/run-suite.js`;
- `tests/runner/disposable-run.js`;
- `package.json`;
- `playwright.config.js`;
- `docs/mjl-acceptance-tests.md`;
- `docs/mjl-test-coverage-registry.md`;
- `docs/mjl-reset-manifest-v2.md`;
- `docs/mjl-implementation-roadmap-v2.md`;
- `docs/mjl-docs-index.md`;
- `docs/mjl-authoritative-decisions.md`;
- `docs/mjl-decision-register-v2.md`;
- `docs/mjl-rst-013a-test-reset-strategy.md`;
- `docs/mjl-rst-013a-execution-report.md`.

RST-014A, not RST-013A, owns fixture-consumer edits to other retained Phase 1
specs. Any RST-013A implementation need outside this literal list stops the
unit for an amended strategy review and separate explicit approval.

Do not recreate any of the 13 absent paths or restore their behavior. Create no
persistent row or file. Inside the RST-014A disposable tenant only, focused
RST-013A security probes may add poison rows to
`llx_mjlfinancement_user_soc_scope`, deliberately cross-entity/corrupt-parent
rows to `llx_mjlfinancement_activity`, and exactly one same-entity,
matched-parent positive-control Activity row with the approved projection and
unique canaries in the current planning, execution, note, and private fields.
These focused probes must leave every audit table unchanged; no direct-SQL
audit row is authorized. No other direct-SQL test data is authorized. None
is selectively deleted: tenant teardown removes the whole database. The shared
database, ECM tables, document tree, native administrator, and local startup
remain unchanged.

## Verification, verdict, and rollback

Run `npm run test:rst013a`, `npm run test:unit`, `npm run test:verify`, every
focused Phase 1 command, `npm run test:characterization`, and
`npm run test:e2e`. Record exact commands,
case counts, durations, disposable project manifests, cleanup results, and all
skips. The signed manual accessibility gate remains a human-only check and any
skip must be explicit.

Before/after canonical shared all-table schema/data digest, exact tenant counts,
ECM all-column digest, complete document-tree path/type/content digest, and
Compose resource inventory must match. The protected source-tree
path/type/mode/content digest must also match for exactly `custom/`, `docs/`,
`tests/`, `AGENTS.md`, `CONTEXT.md`, `DESIGN.md`, `README.md`,
`docker-compose.yml`, `package.json`, `package-lock.json`, and
`playwright.config.js`, with no exclusion inside those paths; generated evidence
is confined to `test-results/runs/<projectName>/`. Database capture uses one consistent
transaction and lossless encoding of every schema definition, column, and row
in `dolidb`, including every native-Admin and append-only audit field; no
application field or row is excluded. Plaintext manifests are never written to
any pathname or artifact: the read-only evidence process feeds length-delimited,
type-tagged canonical bytes directly into SHA-256 contexts and retains only
digests, schema summaries, and nonsensitive counts.
RST-013A proof mode ignores `MJL_TEST_RETAIN`, uses the
same bounded diagnostics/unconditional cleanup and artifact-secret scan as
RST-014A, and exercises actual repeated SIGINT/SIGTERM teardown. Any
authorization, active-entity, secret, persistent-data, containment, cleanup,
or canonical contradiction blocks the unit.

Rollback restores only the RST-013A source/document changes from its baseline
commit. It does not recreate absent tests, old fixtures, persistent seed data,
legacy finance/document behavior, or selectively erase immutable audit rows.
It immediately revokes any `PHASE_1_READY` or `PHASE_1_READY_WITH_NOTES` verdict
in the authority, decision register, roadmap/report state, and replaces it with
`PHASE_1_BLOCKED` until equivalent current security coverage is separately
reviewed, approved, executed, and both review axes are clean again.

After both RST-014A and RST-013A pass independent Standards/Spec review, issue:

- `PHASE_1_READY` only with every required gate passing and no blocker;
- `PHASE_1_READY_WITH_NOTES` only for explicitly deferred manual/operational
  evidence;
- `PHASE_1_BLOCKED` for any security, isolation, persistence, cleanup, or canon
  failure.

The verdict does not authorize Phase 2.

RST-013A completion is likewise fixed: record exact evidence and the provisional
verdict in its execution report, commit the complete unit, rerun any gate not
captured from committed source, and independently review the fixed
baseline-to-unit range on both Standards and Spec axes. Narrow fixes require
affected/public reruns, a new commit, and both full-range reviews again. The
formal Phase 1 verdict is final only after both axes report zero actionable
findings.

Once separately approved, implementation records approval provenance and unit
status in the decision register and updates the authority's current reset
state. Execution or rollback appends its status/provenance and updates current
state without erasing prior approval history.

## Approval boundary

Only an explicit `I approve RST-013A` authorizes implementation, and execution
remains ordered after executed RST-014A. Approval of RST-014A, Phase 1, Phase 4,
this overall plan, or another reset ID is not a substitute.
