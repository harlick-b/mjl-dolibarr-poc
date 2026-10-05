# MJL forensic architecture audit

## Verdict

**Confidence gate: FAIL — `NOT_READY` for a target-architecture or broad refactor decision.**

The audit is factually confident about its recorded evidence and limitations. It cannot truthfully claim 100% behavioral confidence: source inspection now covers the discovered application and verification populations, while symbol behavior reconciliation remains qualified, live MJL schema state was deliberately not queried, and no database-backed or browser suite ran. Two high-risk source findings also require resolution or focused runtime proof.

This result does not mean the current application is unusable. It means the proposed confidence threshold was not met and the evidence does not authorize architecture implementation.

## Scope and evidence totals

| Measure | Result |
| --- | --- |
| Application-owned files discovered/classified | 157/157 |
| Application-owned files fully read | 157/157, 20,535 lines |
| Verification files discovered/classified | 80/80 |
| Verification files fully read | 80/80 |
| Verification files partially inspected | 0/80 |
| Named runtime functions/methods indexed | 594/594 in the runtime annex; 43 named symbols plus 23 top-level handlers behavior-mapped in that pass |
| Application symbol/site records | 1,993 across 157/157 files: 66 `BEHAVIOR_MAPPED`, 1,927 `DEFINITION_INDEXED` |
| Web/dynamic entry surfaces source-mapped | 21/21: 18 application HTTP routes and 3 dynamic assets |
| Database tables mapped at ownership level | 17 custom and 7 named primary native tables; additional native module/cron tables are materially used and not individually reconciled |
| Preservation-ledger items | 34 |
| Confirmed dead items | 0 |
| Dead/removal candidates | 7 helpers with no discovered live internal entry, 1 schema-only table surface and 9 unresolved/historical groups |
| High-risk findings | 2 |
| Target architecture | deliberately not produced; excluded from this audit |

The exact baseline and source hashes are in [00-baseline.md](00-baseline.md), with per-file records in [annex-file-fingerprints.tsv](annex-file-fingerprints.tsv) and significant records in the [runtime](annex-runtime-symbols.tsv) and [supplemental](annex-supplemental-symbols.tsv) symbol annexes. “Mapped” and “verified” retain the evidence qualifications defined there and do not imply runtime execution.

## Gate matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| immutable source baseline recorded | PASS | branch, commit and manifests recorded |
| every application-owned file discovered and classified | PASS | 157-file inventory |
| every application-owned file read end to end | PASS | final complete-file pass covers 157/157 files and 20,535 lines |
| every verification file read end to end | PASS | 80/80 files; 31/31 E2E files and 11,200 total verification lines |
| every important symbol inventoried and reconciled | FAIL | all 1,993 discovered significant records are indexed, but 1,927 remain `DEFINITION_INDEXED` rather than end-to-end behavior-mapped |
| every entrypoint mapped | PASS | source mapping covers 18 HTTP routes and 3 dynamic assets |
| dependency and native boundary mapped | PASS | dependency map and bounded core inspection |
| request/action flow mapped | PASS | request map covers routes, guards and owners |
| database ownership and write sites complete | FAIL | ownership is mapped; exhaustive native/custom write-site proof is incomplete |
| module lifecycle understood | FAIL | activation/upgrade/bootstrap source is mapped; live installed state and interruption behavior remain unresolved |
| authentication state machine understood | FAIL | state is mapped; retained Admin reset contradiction remains |
| authorization paths complete | FAIL | primary layers and all source files are mapped; indexed-only symbols and absent runtime route execution prevent a completeness claim |
| core business workflows mapped | PASS | source maps planning through reconciliation and exceptions |
| frontend contract understood | PASS | all 14 production frontend files were read and source contracts mapped; runtime browser proof is separately absent |
| duplication classified | PASS | candidates classified without speculative consolidation |
| dead-code candidates conservatively classified | PASS | no candidate is declared absolutely dead from textual absence alone |
| standards assessed against applicable sources | PASS | repository, Dolibarr, PHP, JS/CSS and MariaDB considerations recorded |
| regression baseline trustworthy | FAIL | public unit command stalled; isolated results include sandbox limitations and stale assertions |
| preservation ledger complete for mapped critical behavior | PASS | 34 stable identifiers recorded with evidence qualifications |
| all high-risk findings resolved or fully bounded | FAIL | two remain open |
| current architecture documented | PASS | current-state architecture recorded without inventing a target |

## High-risk findings

1. **Retained Admin reset conflict.** The reset flow admits ADMIN and writes an active-entity request, while the target trigger requires the target user's entity to match; the retained technical Admin is entity 0. This is a target-source defect, with live installation still unverified.
2. **Reference transaction outcomes.** Reference write paths do not check `begin()` or `commit()` return values. Driver failure behavior must be characterized before a safe correction can be specified.

The canonical gap analysis records these as implementation debt. Medium and low risks, including server-side export read handling, cron semantics, activation interruption, global export serialization, retry identity, Apache loaded state and runner safety, are classified in [15-behavior-classification.md](15-behavior-classification.md).

## Verification outcome

`npm run test:unit` was attempted with `MJL_TEST_RETAIN` removed and interrupted after more than two minutes without an aggregate result. Isolation found 7 passing Node files, 9 nonzero files and 1 timeout; several failures were caused by sandbox-denied PHP child processes. Four directly invoked top-level PHP contracts passed. Four design-system assertions conflict with current source; authority must determine which side is stale. No E2E, disposable database, activation, bootstrap or shared-tenant action ran.

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

1. decide the technical Admin reset policy and prove it in an isolated database tenant;
2. characterize Dolibarr transaction failure returns for reference writes;
3. preserve the established `GENERATED` artifact contract and test server-side read failure handling;
4. repair runner discovery and stale design assertions so named verification commands state their real scope;
5. behavior-map the 1,927 records currently limited to definition indexing before reconsidering an architecture confidence gate.

These are recommendations only. No runtime or test implementation was changed by the audit.
