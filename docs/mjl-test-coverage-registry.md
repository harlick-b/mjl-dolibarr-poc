# MJL Current Test Coverage Registry

This registry describes only current-purpose executable coverage. Target rules
come from `docs/mjl-authoritative-decisions.md`; command behavior comes from
`docs/mjl-acceptance-tests.md`. Historical POC suite names, seeded counts,
Partner-scope authorization, legacy finance behavior, and live document-library
behavior are not current evidence.

## Public commands

| Command | Current purpose | Isolation / cleanup |
| --- | --- | --- |
| `npm run test:unit` | Static Node contracts and PHP presentation/navigation contracts | No business fixture writes |
| `npm run test:verify` | Current RST-002B exact schema and empty-tenant verification | Unique disposable tenant, whole-tenant teardown |
| `npm run test:e2e` | Current reference/auth/document/fixture and RST-002B browser suites in `playwright.config.js` | Unique disposable tenant, whole-tenant teardown |
| `npm run test:rst003` | Partenaire/Projet/Type d'Opération references, entity isolation, CSRF, concurrency, and rollback | RST-014A fixtures; focused rollback rehearsal; whole-tenant teardown |
| `npm run test:rst007a` | Append-only transactional audit behavior | RST-014A fixtures; whole-tenant teardown |
| `npm run test:rst004` | Removed finance/schema/route absence | RST-014A fixtures; whole-tenant teardown |
| `npm run test:rst008` | Invitation/reset lifecycle, concurrency, rollback, replay, and secret handling | Per-run credentials and secret registry; whole-tenant teardown |
| `npm run test:rst009a` | Role-projected navigation and technical Admin boundary | RST-014A fixtures; whole-tenant teardown |
| `npm run test:rst010a` | Anonymous/authenticated document containment and filesystem/ECM preservation | Disposable ECM/document canaries; whole-tenant teardown |
| `npm run test:rst013a` | Current Activity authorization/projection replacement plus repeated-signal teardown | Shared before/after evidence; retention disabled; whole-tenant teardown |
| `npm run test:rst014a` | Fixture allowlist, isolation, credentials, evidence, artifact safety, and all-outcome teardown | Shared before/after evidence; retention disabled; whole-tenant teardown |
| `npm run test:rst005` | Exact Activity foundation migration, guarded cutover, encrypted restore, rollback/resumption, read/denial matrix, SQL invariants, and retained RST-010A custom/native GET/POST containment | Shared before/after evidence; retention disabled; whole-tenant teardown |
| `npm run test:rst005-launcher` | Exact root-only fixed-name/no-follow launcher, exact CLI/negative substitution matrix, full live-binding rechecks, launcher-owned interruption cleanup, isolated encrypted restore, disposable rehearsal, and isolated shared-shaped production execute plus standalone rollback | Temporary committed snapshots plus unique disposable tenants/bind roots; Compose, nonce-scoped restore, one-off, operator, client-config, and custody resources proven absent |
| `npm run test:rst002b` | RST-002B schema/rollback convergence, assignment module, immediate row-level revocation, role guards, audit atomicity, concurrency, and direct SQL denial | Shared before/after evidence; unique disposable tenant; whole-tenant teardown |
| `npm run test:rst002b-launcher` | Dedicated packet/launcher source contracts and immutable evidence-record rehearsal | Temporary root under the system temp directory; no shared mutation |
| `npm run test:phase1-reset` | Combined Phase 1 cutover, schema mutation, failure/restore, browser, and containment proof | Shared-source rehearsal plus unique disposable tenant; retention disabled |
| `npm run test:characterization` | Temporary empty Partner-scope-table source characterization only | Read-only source check in a disposable tenant |
| `npm run test:manual-accessibility` | Human-run accessibility gate | Not an automated completion substitute |

## Retained executable suites

| Path | Owned current behavior |
| --- | --- |
| `tests/e2e/partners-projects.spec.js` and `tests/e2e/cases/partner-project.cases.js` | RST-003 reference lifecycle, active-entity isolation, CSRF, concurrency, native-route, and direct guards |
| `tests/e2e/phase1-reset.spec.js` | RST-004/RST-007A/RST-008/RST-009A browser contracts and RST-013A Activity security replacement |
| `tests/e2e/auth-concurrency.spec.js` | RST-008 invitation/reset collision, single-use, rollback, retry, and non-leakage behavior |
| `tests/e2e/document-containment.spec.js` | RST-010A custom/native authenticated/anonymous GET/POST denial and exact ECM/filesystem preservation |
| `tests/e2e/fixture-isolation.spec.js` | RST-014A factory, attestation, namespace, evidence, failure, signal, artifact, and teardown behavior |
| `tests/e2e/rst005-activity-foundation.spec.js` | RST-005 anonymous/authenticated role matrix, active-entity projection, cross-entity/parent/orphan denials, dormant-state checks, immutable-field denial, and complete evidence equality |
| `tests/e2e/rst002b-activity-assignment.spec.js` | RST-002B current-assignment role matrix, entity isolation, add/remove/transfer, immediate revocation, stale/concurrent commands, audit rollback, reciprocal role guards, and structural SQL denial |
| `tests/characterization/permissions.spec.js` | Temporary RST-002A proof that the retained empty scope table is absent from runtime authorization; RST-002B owns removal |
| `tests/unit/*.test.js` | Current static reset, schema, security, canonical-document, runner, and presentation contracts |
| `tests/contracts/*_test.php` | Current PHP behavior, navigation, presentation, and status contracts |

## RST-013A replacement contract

The `[RST-013A]` cases in `tests/e2e/phase1-reset.spec.js` dynamically prove:

- zero and poisoned `llx_mjlfinancement_user_soc_scope` rows produce identical
  authorization and reviewer projections;
- hostile `scope_soc_ids[]` GET/POST input cannot grant or broaden access;
- Agent Activity GET/POST fails closed;
- Supervisor and Validator output excludes cross-entity, cross-parent, and
  orphan-parent Activities;
- every current `MjlActivity` create/update/delete call returns denial with
  `notrigger` values `0` and `1`, and retired mutation methods remain absent;
- output contains only Activity reference/label, matched Projet reference/title,
  and technical status; unique planning, execution, note, private, and
  cross-entity canaries plus forms/actions never render;
- DB, native Admin, audit, ECM, and document-tree evidence is byte-digest equal
  before and after all denial probes;
- actual repeated SIGINT and SIGTERM runs leave no disposable container,
  network, volume, evidence directory containing the injected secret, or
  retained tenant.

The removed `MjlExchangeLog`, timeline-comment upload/mutation helpers,
Activity-to-Convention/amount fields, legacy finance routes/schema, and live
document behavior remain absence-gated by RST-004, RST-010A, the Phase 1 reset
verifiers, and unit contracts. They are never recreated for testing.

## Retired inventory

Commit `3b5f767` removed the 13 paths recorded in the RST-013A strategy. They
remain absent. In particular, `tests/characterization/finance.spec.js` is no
longer configured, and the deleted `scope-security` suite is replaced by the
current-model cases above rather than restored.

Persistent sample/demo fixtures remain forbidden. Every test business row is
created only in an RST-014A-attested disposable tenant and disappears with the
entire database/document-volume teardown; tests do not selectively delete
fixture or audit rows.
