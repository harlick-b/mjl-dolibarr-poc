# MJL forensic architecture audit

## Verdict

**Confidence gate: FAIL — `NOT_READY` for a target-architecture or broad refactor decision.**

The two original high-risk findings are resolved with focused regression proof. The closure review also established two additional high blockers: possible legacy cleartext password persistence through native password changes and a non-resumable early RST-006B interruption window. The gate therefore remains `NOT_READY`; it is not held open by either original finding.

This result does not mean the current application is unusable. It means the proposed confidence threshold was not met and the evidence does not authorize architecture implementation.

## Scope and evidence totals

| Measure | Result |
| --- | --- |
| Application-owned files discovered/classified | 157/157 |
| Application-owned files fully read | immutable snapshot: 157/157, 20,535 lines; current tree: 20,560 lines with all five closure-delta files re-read |
| Verification files discovered/classified | 81/81 after the closure contract was added |
| Verification files fully read | 81/81 |
| Verification files partially inspected | 0/81 |
| Named runtime functions/methods indexed | immutable snapshot: 594/594 in the runtime annex; closure delta: `mjl_reference_rollback()` behavior-mapped in `closure-evidence.md` |
| Application symbol/site records | immutable snapshot: 1,993 across 157/157 files (66 `BEHAVIOR_MAPPED`, 1,927 `DEFINITION_INDEXED`); current delta adds one behavior-mapped helper |
| Web/dynamic entry surfaces source-mapped | 21/21: 18 application HTTP routes and 3 dynamic assets |
| Database tables mapped at ownership level | 17 custom and 7 named primary native tables; additional native module/cron tables are materially used and not individually reconciled |
| Preservation-ledger items | 35 |
| Confirmed dead items | 0 |
| Dead/removal candidates | 7 helpers with no discovered live internal entry, 1 schema-only table surface and 9 unresolved/historical groups |
| High-risk findings | 2 original resolved; 2 newly established and open |
| Target architecture | deliberately not produced; excluded from this audit |

The exact baseline and source hashes are in [00-baseline.md](00-baseline.md), with per-file records in [annex-file-fingerprints.tsv](annex-file-fingerprints.tsv) and significant records in the [runtime](annex-runtime-symbols.tsv) and [supplemental](annex-supplemental-symbols.tsv) symbol annexes. “Mapped” and “verified” retain the evidence qualifications defined there and do not imply runtime execution.

## Gate matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| immutable source baseline recorded | PASS | branch, commit and manifests recorded |
| every application-owned file discovered and classified | PASS | 157-file inventory |
| every application-owned file read end to end | PASS | immutable complete-file pass covers 157/157 files and 20,535 lines; all five changed closure files were re-read, producing 20,560 current application lines |
| every verification file read end to end | PASS | immutable baseline 80/80 plus the fully read closure contract: 81/81 current files |
| every important symbol inventoried and reconciled | FAIL | the 1,993 immutable-snapshot records plus the closure helper are recorded, but 1,927 baseline records remain `DEFINITION_INDEXED` rather than end-to-end behavior-mapped |
| every entrypoint mapped | PASS | source mapping covers 18 HTTP routes and 3 dynamic assets |
| dependency and native boundary mapped | PASS | dependency map and bounded core inspection |
| request/action flow mapped | PASS | request map covers routes, guards and owners |
| database ownership and write sites complete | FAIL | ownership is mapped; exhaustive native/custom write-site proof is incomplete |
| module lifecycle understood | FAIL | state matrix is mapped; early RST-006B interruption recovery and historical runner provisioning remain defective |
| authentication state machine understood | FAIL | retained Admin reset now passes; encrypted-only native password persistence is not enforced |
| authorization paths complete | FAIL | primary layers and all source files are mapped; indexed-only symbols and absent runtime route execution prevent a completeness claim |
| core business workflows mapped | PASS | source maps planning through reconciliation and exceptions |
| frontend contract understood | PASS | all 14 production frontend files were read and source contracts mapped; runtime browser proof is separately absent |
| duplication classified | PASS | candidates classified without speculative consolidation |
| dead-code candidates conservatively classified | PASS | no candidate is declared absolutely dead from textual absence alone |
| standards assessed against applicable sources | PASS | repository, Dolibarr, PHP, JS/CSS and MariaDB considerations recorded |
| regression baseline trustworthy | FAIL | the two corrected contracts pass, but lifecycle and credential-storage blockers lack corrections and proof |
| preservation ledger complete for mapped critical behavior | PASS | 35 stable identifiers recorded with evidence qualifications |
| all high-risk findings resolved or fully bounded | FAIL | both original findings are closed; two newly established blockers remain open |
| current architecture documented | PASS | current-state architecture recorded without inventing a target |

## High-risk findings

Resolved:

1. **Retained Admin reset conflict.** Reset triggers and consumption now admit only the entity-0 native Admin into an active-entity reset while retaining exact same-entity rules for business users. The disposable auth suite passed 12/12.
2. **Reference transaction outcomes.** Reference writes now stop on failed begin, reject failed commits, attempt rollback, and close an uncertain connection after rollback failure. The direct failure contract passed.

Open:

1. **Legacy cleartext password persistence.** MJL does not force Dolibarr's encrypted-only password mode, so invitation/reset password changes can populate `llx_user.pass` when the deployment constant is absent.
2. **RST-006B early interruption recovery.** The prefix recognizer knows the first operation-check stages, but the top-level detector does not classify them as resumable partial states.

The canonical gap analysis records these as implementation debt. Medium and low risks, including server-side export read handling, cron semantics, activation interruption, global export serialization, retry identity, Apache loaded state and runner safety, are classified in [15-behavior-classification.md](15-behavior-classification.md).

## Verification outcome

Closure verification added two focused results: `php tests/contracts/reference_transaction_test.php` passed, and `npm run test:auth` passed 12/12 in an isolated disposable tenant with complete teardown. Changed PHP files passed syntax checks. The earlier broad-unit qualifications and four stale design assertions remain recorded; they were not rerun or changed as part of the approved two-fix scope. No shared-tenant write ran.

See [13-regression-baseline.md](13-regression-baseline.md) for exact qualifications. The audit deliberately did not convert environment-limited failures into application defects.

## Deliverables

1. [Baseline](00-baseline.md)
2. [File inventory](01-file-inventory.md)
3. [Dependency map](02-dependency-map.md)
4. [Request map](03-request-map.md)
5. [Database map](04-database-map.md)
6. [Module lifecycle](05-module-lifecycle.md)
7. [Authentication state](06-authentication-state.md)
8. [Authorization map](07-authorization-map.md)
9. [Business workflows](08-business-workflows.md)
10. [Frontend contracts](09-frontend-contracts.md)
11. [Duplication report](10-duplication-report.md)
12. [Dead-code analysis](11-dead-code-analysis.md)
13. [Standards assessment](12-standards-assessment.md)
14. [Regression baseline](13-regression-baseline.md)
15. [Preservation ledger](14-preservation-ledger.md)
16. [Behavior classification](15-behavior-classification.md)
17. [Current architecture](16-current-architecture.md)

There is intentionally no target-architecture document. Producing one would contradict the failed confidence gate and the user's prior exclusion of that deliverable.

## Safe next decisions

The next work should be split into narrow, approved corrections rather than one refactor:

1. enforce encrypted-only password persistence through the existing MJL password wrapper and prove `llx_user.pass IS NULL` after invitation and reset;
2. correct RST-006B early-prefix detection and prove resumption after every operation-check DDL interruption;
3. preserve the established `GENERATED` artifact contract and test server-side read failure handling;
4. repair runner discovery and stale design assertions so named verification commands state their real scope.

The first two are architecture-gate blockers. The remaining items are bounded follow-up recommendations. See [closure-evidence.md](closure-evidence.md) for the exact closure delta and final-count report.
