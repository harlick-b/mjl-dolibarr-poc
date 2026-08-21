# RST-013A Execution Report

Status: `IMPLEMENTED_PENDING_COMMITTED_GATES_AND_REVIEW`.

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

## Pre-commit evidence

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
| `npm run test:phase1-reset` | FAIL, then expected dirty-worktree refusal during correction | The first committed-source rehearsal completed cutover/rollback verification but exposed a missing post-cutover RST-014A document sentinel before Playwright setup. The runner now reapplies the same disposable fixture controls after cutover; its uncommitted correction was then correctly refused by the clean-source precondition. A clean committed rerun remains mandatory. |

The first focused RST-013A red run correctly exposed two probe defects: the
interim class has no generic `fetch()` and a Playwright worker restart replayed
the one-time fixture namespace. The corrected probe populates the denied object
directly and resumes fixture IDs through read-only discovery. The next run
passed 3/3. The first independent review then identified the missing explicit
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

The following before/after values were identical:

| Evidence | SHA-256 |
| --- | --- |
| Protected source tree | `b145a57135e55b27454d27881be3a4f0736460ad6fc22ac6210f8ec324b3e4bb` |
| Complete shared database/schema | `b0f2a2b8500826dab6a76d21ef919c5d4be1816cba43b3b3a134370560124857` |
| Native Admin all-column row | `8051d600e0740b2a2a9d4a2a85eb2674ffa3742e197e0604f5414e688236d987` |
| ECM all-column rows | `1dc830d123a3ca805d66f23e0d80e966dc43f0543fb46b334462b3e14308746b` |
| Complete document tree | `8934c44974ff2e4a1c4d65686bb44d2c3b2da1dec38275b3f4b5b249d14daf3b` |

Shared identity remained exactly native Admin row 1 (`entity=0`, `admin=1`,
`statut=1`), with zero non-Admin users, Partners, Projects, business roles,
Partner scopes, Activities, Opération types, invitations, password resets,
audit events, and ECM files. Shared Compose resource inventory was identical.

## Remaining completion gates

- commit the complete candidate;
- rerun `test:phase1-reset`, `test:rst014a`, and public `test:e2e` from that
  clean committed source, plus any gate affected by review fixes;
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
