# RST-010A Execution Report

Date: 2026-08-19

Verdict: `RST_010A_CONTAINMENT_COMPLETE`

## Implemented boundary

- Custom document routes return dependency-free French HTTP 403 for every
  method and do not bootstrap Dolibarr, inspect input, open sessions, query
  ECM, read files, audit, redirect, or emit attachment headers.
- Apache denies `/ecm/*`, `/document.php`, and `/viewimage.php` before native
  document delivery. Its internal error document is also dependency-free, so
  denial cannot fail while trying to render a Dolibarr page shell.
- The obsolete `tests/evidence/inter-font-live.js` script was removed.
- A dedicated disposable runner, hostile HTTP matrix, and exact filesystem/
  ECM snapshot fixture were added.
- No document business feature, persistent fixture, ECM row, or document file
  was added, removed, migrated, exposed, or restored in the shared tenant.

## Verification evidence

Commands run:

```text
php -l custom/mjlfinancement/documents.php
php -l custom/mjlfinancement/documentdownload.php
php -l custom/mjlfinancement/nativeforbidden.php
php -l tests/fixtures/rst010a-document-state.php
npm run test:rst010a
npm run test:unit
npm run test:phase1-reset
```

All PHP syntax checks passed. The final focused disposable suite ran 126 custom/native
requests across anonymous, native-Admin, and business-user contexts using GET
and POST. Every request returned HTTP 403, exposed no canary and no attachment,
and the exact before/after manifests matched.

Disposable manifest digests:

| Surface | Before and after SHA-256 |
| --- | --- |
| Aggregate | `9609f04c809f2d2038a50696e8dd6e57260d749f685b8bd270be051ab7b67504` |
| Filesystem | `83d63cea112de1e88b6619cf0a7369e9a04ab610ef878cd7e41ef32c9bd6e705` |
| `llx_ecm_files` | `2446252fb8f828f60b8e6b2bb94e1443219b557c0fe712d6a1e8b6bcb8ad6e73` |
| `llx_ecm_directories` | `31e013c8833c7027178a0051139e8180869616ba1e10d61ff0c37c290adf1504` |

The disposable project and its database, document, and configuration volumes
were destroyed after the pass.

The full Phase 1 cutover rehearsal requires a clean source commit. It was run
from an isolated local `/tmp` clone containing this exact diff in a temporary
local-only commit, leaving the working repository and its history unchanged.
All cutover preflight, failure-injection, rollback/fingerprint, exact-schema,
audit, authentication-concurrency, navigation, authorization, and RST-010A
checks passed: 10 browser tests passed and all disposable resources plus the
temporary clone were removed.

Shared log inspection initially exposed a hidden `llxHeader()` fatal inside
the pre-existing Apache error document even though HTTP remained 403. The root
cause was a full Dolibarr page render in an internal error subrequest. The
error document was reduced to a dependency-free denial response, a static and
browser regression assertion was added, and the narrow shared reproduction
then returned 403 with no PHP fatal.

## Shared-tenant preservation

The immediate pre-change shared baseline was:

| Surface | SHA-256 / count |
| --- | --- |
| Complete path/type/content filesystem manifest | `c32eba620bf66b2afd603e3c286ccc0ebc319843c27ee55e2ca276c1cf542159` / 38 entries |
| Ordered all-column dump of both ECM tables | `9ef36e1c6b9f119e5ab44d354a25a034f53a42673b2c9bb4b85206d451b395d8` |
| `llx_ecm_files` ordered all-column dump | `8169c41d8e01ba0f1693e1019a92ac5a1588f6378ab558c59f18d12862aab1db` / 0 rows |
| `llx_ecm_directories` ordered all-column dump | `ec83975a41f29f68bad4f6aab5e0c10dc91863b01208f4dfdbae534b2e9c43c7` / 1 row |

The post-change filesystem digest, combined ECM digest, and row counts matched
these values exactly after Apache reload and custom/native GET/POST smoke
probes. Recent container logs contained the expected Apache authorization
denials and no PHP fatal after the corrected error-page retry. Any unrelated
operational drift is reported rather than ratified by this unit. RST-010A
authorizes no change to DEC-039.

## Rollback

Rollback is containment-only as specified by
`docs/mjl-rst-010a-containment-strategy.md`. Legacy document behavior is not a
permitted restore target.

## Independent review

Separate Standards and Spec reviews examined the final worktree against
`AGENTS.md`, the authoritative v2 documents, and the explicitly approved plan.
After correcting their documentation-inventory and Phase 4 precision findings,
both reviews reported no remaining actionable finding. The three explicitly
accepted future Phase 4 residual risks remain documented; no Phase 4 runtime
behavior was introduced.
