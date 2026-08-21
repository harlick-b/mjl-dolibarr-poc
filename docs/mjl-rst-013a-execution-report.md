# RST-013A Execution Report

Status: `IMPLEMENTED_COMMITTED_GATES_COMPLETE_PENDING_FINAL_REVIEWS`.

Approval provenance: DEC-044 records the user's explicit statement
`I approve RST-013A` on 2026-08-21, after RST-014A reached `EXECUTED`. The user
then separately approved the exact same-entity/matched-parent projection-control
row and serial factory-only setup amendment after the first independent review.

Baseline: `de67763` (`Align executed RST-014A documentation`).

## Implemented candidate

- Retargeted characterization to its sole maintained
  `permissions.spec.js` contract and removed the absent finance entry.
- Added `npm run test:rst013a`, a dedicated disposable runner layer, disabled
  retention, exact shared-state evidence, artifact scanning, and real repeated
  SIGINT/SIGTERM lifecycle probes.
- Added current-model dynamic Activity coverage for poisoned legacy scope rows,
  hostile `scope_soc_ids[]` GET/POST input, Agent denial, same-entity and
  matched-parent reviewer filtering, exact safe projection, current class
  create/update/delete denial with both trigger modes, retired method absence,
  and full database/Admin/audit/ECM/document before/after equality.
- Replaced the stale 467-line historical coverage matrix with a current-purpose
  registry. No deleted suite or legacy behavior was recreated.

All fixture/business rows exist only in an RST-014A-attested disposable tenant.
The tests perform no selective fixture or audit deletion; whole-tenant teardown
owns removal.

## Pre-commit and first committed-run evidence

| Command | Result | Duration / notes |
| --- | --- | --- |
| `npm run test:rst013a` | PASS, 3/3 | 170.0 s after the complete amendment/review fixes; includes independent zero/hostile/poison matrices and real repeated SIGINT/SIGTERM; each child proved its own scanner/teardown state before the safety fallback, and all run-owned resources were absent |
| `npm run test:unit` | PASS, 79/79 plus PHP contracts | 0.8 s; requires loopback socket permission for the secret-registry unit cases |
| `npm run test:verify` | PASS | 134.1 s; disposable tenant removed |
| `npm run test:characterization` | PASS, 1/1 | 169.6 s; one bounded automatic cleanup retry removed a briefly busy DB volume; zero survivors |
| `npm run test:rst003` | PASS, 9/9 | 185.9 s; disposable tenant removed |
| `npm run test:rst007a` | PASS, 1/1 | 142.7 s; disposable tenant removed |
| `npm run test:rst004` | PASS, 1/1 | 150.3 s; disposable tenant removed |
| `npm run test:rst008` | PASS, 5/5 | 228.2 s; disposable tenant removed |
| `npm run test:rst009a` | PASS, 2/2 | 174.8 s; disposable tenant removed |
| `npm run test:rst010a` | PASS, 1/1 | 120.5 s; filesystem and both ECM digests unchanged; disposable tenant removed |
| `npm run test:phase1-reset` | FAIL, then expected dirty-worktree refusal during correction | The first committed-source rehearsal completed cutover/rollback verification but exposed a missing post-cutover RST-014A document sentinel before Playwright setup. The runner then correctly refused to exercise its uncommitted correction. |

The first focused RST-013A red run correctly exposed two probe defects: the
interim class has no generic `fetch()` and a Playwright worker restart replayed
the one-time fixture namespace. An intermediate probe used read-only ID
discovery, but the approved amendment removed fixture resumption entirely: the
final serial setup retains only IDs returned by its unconditional factory
calls and populates the denied object directly. The next run passed 3/3. The
first independent review then identified the missing explicit
positive-control authorization, confounded GET matrices, incomplete evidence
bracketing/exact cell assertions, SQL fixture resumption, and lifecycle-harness
fallback gaps. The user explicitly approved the narrow data amendment; the
candidate now uses factory-only serial setup, separately proves all four GET
states with full evidence, asserts exact cells, and records the child outcome,
scanner acknowledgement, artifact absence, and zero resources before any
safety fallback. The fallback independently performs bounded termination,
three teardown attempts, artifact removal, and survivor enumeration without
being allowed to satisfy the proof. The amended focused suite passed 3/3.

The first clean committed Phase 1 rehearsal then found an orchestration handoff
gap rather than a product assertion failure: the cutover restore correctly
discarded disposable state, including the RST-014A database and filesystem
sentinels, but the runner entered Playwright setup without recreating those
controls. The guard failed closed on the absent document sentinel. Normal and
post-cutover setup now share one fixture-control provisioning function; no
fixture row, business mutation, or SQL-based fixture resumption was added.
The failed run removed all of its run-owned resources.

One orchestration-channel interruption terminated three concurrently launched
focused parent runners before their finalizers. The exact three `mjl-test-*`
projects were enumerated and explicitly removed; subsequent read-only Docker
inventory confirmed no surviving process, container, network, or volume. Their
results were discarded and the affected commands were rerun sequentially.

## Shared-state evidence from focused RST-013A

The final focused rerun from committed source `f08c7f2`, disposable project
`mjl-test-20260821t152417-665293-788c3d7c`, produced the following identical
before/after values:

| Evidence | SHA-256 |
| --- | --- |
| Protected source tree | `cf78f5c06ee2b7493902b8e9ef4229b95a026746db56d6da08667308db5ca8a5` |
| Complete shared database/schema | `b0f2a2b8500826dab6a76d21ef919c5d4be1816cba43b3b3a134370560124857` |
| Native Admin all-column row | `8051d600e0740b2a2a9d4a2a85eb2674ffa3742e197e0604f5414e688236d987` |
| ECM all-column rows | `1dc830d123a3ca805d66f23e0d80e966dc43f0543fb46b334462b3e14308746b` |
| Complete document tree | `8934c44974ff2e4a1c4d65686bb44d2c3b2da1dec38275b3f4b5b249d14daf3b` |

Shared identity remained exactly native Admin row 1 (`entity=0`, `admin=1`,
`statut=1`), with zero non-Admin users, Partners, Projects, business roles,
Partner scopes, Activities, Opération types, invitations, password resets,
audit events, and ECM files. Shared Compose resource inventory was identical.

## Post-commit correction evidence

| Command | Result | Duration / notes |
| --- | --- | --- |
| `node --check tests/runner/run-suite.js` | PASS | Corrected shared provisioning helper parses successfully |
| `npm run test:unit` | PASS, 79/79 plus PHP contracts | 0.7 s; loopback socket permission was required for the secret-registry unit cases |
| `npm run test:phase1-reset` | PASS, 11/11 applicable browser tests | 525.9 s; five cutover/schema/audit rounds passed; two focused lifecycle cases intentionally skipped; zero run-owned survivors |
| `npm run test:rst013a` | PASS, 3/3 | 194.7 s; exact projection/hostile-scope matrix plus real repeated SIGINT/SIGTERM; zero run-owned survivors |
| `npm run test:rst014a` | PASS, 38/38 applicable | 437.1 s; factory, isolation, secret, sentinel, failure-path, and teardown coverage passed; two focused RST-013A lifecycle cases intentionally skipped; zero run-owned survivors |
| `npm run test:e2e` | PASS, 38/38 applicable | 388.6 s; combined public browser surface passed; two focused RST-013A lifecycle cases intentionally skipped; filesystem and native ECM hashes remained unchanged; zero run-owned survivors |
| `npm run test:verify` | PASS | 139.0 s on the explicit rerun; exit code 0 and zero run-owned survivors. The preceding run completed its assertion layer and cleanup but emitted an ambiguous transient network-removal message, so it was not counted. |

The first final-range review found that focused RST-013A inherited an unrelated
direct-SQL auth-token exposure constant and that project identifiers were not
recorded with the evidence. The focused setup now suppresses that constant only
for `MJL_TEST_MODE=rst013a`, and each lifecycle child emits its nonsensitive
project identifier. The affected focused/public reruns and complete reviews are
required again before status promotion; the reruns below are complete and the
full-range reviews remain pending.

## Disposable project manifests

For every identifier `P` below, the nonsensitive disposable manifest is exact:
Compose project `P`, network `P_default`, volumes `P_mjl_test_db`,
`P_mjl_test_docs`, and `P_mjl_test_conf`, and artifact root
`test-results/runs/P/`. Lifecycle probes start only the service subset they
need but retain the same bounded naming contract. Every listed project had zero
container, network, and volume survivors; retained artifacts contain sanitized
diagnostics/evidence only.

| Disposition | Command / purpose | Exact project ID(s) |
| --- | --- | --- |
| Discarded | Interrupted concurrent focused parents | `mjl-test-20260821t132236-305308-af17824d`; `mjl-test-20260821t132240-305538-bfb787a6`; `mjl-test-20260821t132241-305671-4f0d5d12` |
| Pre-commit pass | `test:rst013a` | `mjl-test-20260821t135816-365701-741621e4` |
| Pre-commit pass | `test:verify` | `mjl-test-20260821t140130-379187-d16133e1` |
| Pre-commit pass | `test:characterization` | `mjl-test-20260821t140400-388718-fe1d3509` |
| Pre-commit pass | `test:rst003` | `mjl-test-20260821t140640-398360-5bb9b905` |
| Pre-commit pass | `test:rst007a` | `mjl-test-20260821t140945-408715-2b740fc4` |
| Pre-commit pass | `test:rst004` | `mjl-test-20260821t141340-425259-eedfd9f5` |
| Pre-commit pass | `test:rst008` | `mjl-test-20260821t141549-433532-e4092ed5` |
| Pre-commit pass | `test:rst009a` | `mjl-test-20260821t142523-449360-7bdbf8e3` |
| Pre-commit pass | `test:rst010a` | `mjl-test-20260821t143211-467654-1536ad2f` |
| Failed, cleaned | First committed `test:phase1-reset` sentinel handoff | `mjl-test-20260821t143736-483649-d9878818` |
| Refused before provisioning | Dirty-source `test:phase1-reset` | `mjl-test-20260821t144700-514104-340b60f9` |
| Post-correction pass | `test:phase1-reset` | `mjl-test-20260821t144750-515679-f4c5f91a` |
| Post-correction pass | `test:rst013a` | `mjl-test-20260821t145653-552170-afa8111c` |
| Post-correction pass | `test:rst014a` | `mjl-test-20260821t150016-564718-776a5c82` |
| Post-correction pass | `test:e2e` | `mjl-test-20260821t150743-603114-d43531d8` |
| Discarded as ambiguous, cleaned | First `test:verify` teardown output | `mjl-test-20260821t151420-640071-a501d96b` |
| Post-correction pass | Counted `test:verify` | `mjl-test-20260821t151709-649151-32331747` |
| Review-fix pass | `test:rst013a` parent; SIGINT child; SIGTERM child | `mjl-test-20260821t152417-665293-788c3d7c`; `mjl-test-20260821t152701-675152-52bb825e`; `mjl-test-20260821t152713-676131-80129252` |
| Review-fix pass | `test:e2e` | `mjl-test-20260821t152755-678448-28314770` |

## Review-fix reruns

| Command | Result | Duration / notes |
| --- | --- | --- |
| `npm run test:unit` | PASS, 79/79 plus PHP contracts | 0.7 s; no tenant |
| `npm run test:rst013a` | PASS, 3/3 | 191.0 s; unrelated auth-token constant absent; both emitted lifecycle projects and parent had zero survivors; final shared evidence matched exactly |
| `npm run test:e2e` | PASS, 38/38 applicable | 428.3 s; two focused RST-013A lifecycle cases intentionally skipped and already passed above; exit code 0 and zero survivors |

## Remaining completion gates

- independently review the fixed baseline-to-candidate range on Standards,
  Spec, and Security/Isolation axes;
- resolve every actionable finding and rerun affected/public gates;
- only then promote RST-013A to `EXECUTED` and issue the formal Phase 1 verdict.

The signed manual accessibility gate is human-only and has not been run. This
is an explicit deferred operational note, not an automated pass.

No Phase 1 verdict and no Phase 2 authorization is issued by this report state.

## Pre-commit review closure

After the explicit amendment and focused rerun, independent Standards, Spec,
and Security/Isolation reviews reported zero actionable findings. This closes
the implementation-candidate review loop only; the fixed committed range must
still receive its required final reviews after the remaining public gates.
