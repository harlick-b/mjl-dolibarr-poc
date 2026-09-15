# Phase 3C Integration Report — 2026-09-15

Authority: DEC-058 under `docs/mjl-authoritative-decisions.md`.

## Implemented scope

RST-015 adds the CLI-only, read-only production-readiness diagnostic and
replaces stale readiness and deployment guidance. The diagnostic emits one
sanitized JSON document, separates integration controls from release-only
controls, reports unavailable client configuration as `UNKNOWN`, and does not
issue an integration verdict.

RST-013E adds the focused disposable Phase 3C mode. It covers diagnostic
containment, real export evidence, reconciler pagination/idempotence/entity
isolation/timezone/rollback, an independently identified restore tenant,
incomplete-backup detection, exact pre-adaptation comparison, only the named
sentinel/base-URL adaptations, restored schema/access/storage, private backup
custody, and teardown. No shared tenant was mutated and no persistent fixture,
production preparation, Dolibarr core change, or Phase 4–6 behavior was added.

The implementation commits are `9f904f9`, `0792b72`, and `08c6578`. The last
commit adds one call to the runner's existing MariaDB readiness wait after the
restored application starts; this fixed a reproduced socket-readiness race
without adding a retry framework.

## Runtime identity

- Node 22.22.0; npm 10.9.4; PHP 8.2.31 in the disposable application.
- Dolibarr image ID `sha256:7793a238fd94809309fa9143513b2ce19e9393458d897d719ecc97851df652fd`.
- MariaDB image ID `sha256:068cbf783463efa481f20561812878dbae91d3dc6e9649999bb986a7fc3334b2`.
- `package-lock.json` SHA-256 `22b3c5844691c510b00f167f0a46ffdbc05151711f745b197e23cbd07f5352c4`.
- `docker-compose.yml` SHA-256 `db194006a07d6445d1dd95e5bed36924befe1a22486db1fe6d564ebcf10dfba6`.
- Disposable override SHA-256 `b1cbf51fb24eeb8733d79ced100072590a09c13e79ab1b4f0b6f72266c235fa1`.

## Gate evidence

The matrix ran serially from committed source. Commit `0792b72` supplied the
full matrix; commit `08c6578` changed only the Phase 3C restore branch. Syntax,
unit, positive/negative Phase 3C, and the previously interrupted Phase 3B gate
were rerun on `08c6578`. Other results map unchanged because their modes do not
execute that branch.

| Gate | Result | Evidence |
| --- | --- | --- |
| Changed PHP/Node syntax | PASS | `php -l` and `node --check` |
| `npm run test:unit` | PASS | 217/217 on `08c6578`, 6.4 s |
| `npm run test:verify` | PASS | 193.6 s; cleanup complete |
| `npm test` | FAIL | 221 browser cases passed; one Phase 3B navigation timed out and one later serial case did not run; cleanup complete. The same failed case subsequently passed in the standalone Phase 3B gate. |
| `npm run audit:production-readiness` | PASS | 184 s; read-only evidence, sanitized failure control, shared equality, cleanup |
| `npm run test:phase3c` | PASS | 6/6 focused cases plus restore, 584.8 s on `08c6578` |
| Injected Phase 3C restore failure | EXPECTED NONZERO | Exit 1; destination and source cleanup `OK`; private backup custody cleanup `OK` |
| `npm run test:phase1-reset` | FAIL | MJL module reactivation failed after the historical rollback sequence |
| `npm run test:rst003` | PASS | 9/9 browser cases, 230 s |
| `npm run test:rst013a` | FAIL | `RST-005 target columns do not match` |
| `npm run test:rst014a` | FAIL | `RST-005 target columns do not match` |
| `npm run test:rst005` | FAIL | Later foreign keys prevent the historical Activity-table drop |
| `npm run test:rst005-launcher` | FAIL | Same later foreign-key dependency in the rollback/SIGHUP probe |
| `npm run test:rst002b` | FAIL | Current schema passed; rollback refused because it is no longer a sealed RST-002B reverse prefix |
| `npm run test:rst006a` | FAIL | Historical exact-schema verifier rejects later Phase 3 additions |
| `npm run test:phase2` | PASS | RST-012 checks and 43/43 browser cases, 331 s |
| `npm run test:phase3a` | PASS | Schema/migration probes and 29/29 browser cases, 479 s |
| `npm run test:phase3b` | PASS | 111/111 browser cases, performance gate, wrapper rehearsal, shared equality, and teardown; 2,534.7 s on `08c6578` |

The positive restore used source project
`mjl-test-20260915t182708-59612-b0857b04` and destination project
`mjl-test-20260915t182708-59612-c708a6f2`. It detected the incomplete backup,
passed both pre-adaptation and permitted-adaptation comparisons, restored
representative counts `107, 107, 646, 2, 1`, passed restored access, and
recorded destination and backup-custody cleanup as `OK`.

The Phase 3B benchmark used 1,000 Activities, 10,000 Operations, and 50,000
audit events. The highest populated-page p95 was 1,034.96 ms against the
2,000 ms limit. The slowest measured export generation was 2,806.59 ms against
the 30,000 ms limit; peak export memory was 71,303,168 bytes under the 256 MB
PHP limit.

## Blockers and release unknowns

The failed aggregate and legacy regression gates block integration. The
legacy failures are compatibility debt in reverse-prefix rollback/exact-schema
checks after later phases added dependent tables and columns; repairing them is
separate scope. Client-owned public URL, mail transport, browser session and
error/logging posture, secret custody, persistent storage, operational
backup/restore evidence, final permissions, and decision dates remain
`Needs confirmation`. The signed human accessibility review remains deferred
and blocks release.

## Verdict

**CORE_SCOPE_BLOCKED**

This verdict does not authorize production launch.
