# MJL forensic architecture audit

## Verdict

**Confidence gate: PASS — `READY_FOR_PROPOSAL`.**

The two original high-risk findings and the two additional blockers discovered
during closure are resolved with focused regression proof. No unresolved
CRITICAL or HIGH architecture blocker remains. The audit gate authorized a
separate target-architecture proposal task; the completed audit itself still
does not authorize implementation or production preparation.

The separately requested [target architecture](17-target-architecture-proposal.md)
is now the authoritative frozen baseline with status `ARCHITECTURE_FROZEN`.
Freeze does not establish feature acceptance, authorize implementation or an
Engineering Standard, or establish production readiness.

The [independent architecture review](18-independent-architecture-review.md)
is complete: **`ARCHITECTURE_REVISION_REQUIRED`**. Its required corrections
remain preserved as the original review record. Document 17 has since been
revised for AR-REV-001 through AR-REV-007. Separate standards and specification
correction reviews now pass with no actionable findings. The revised proposal
was then explicitly frozen. Document 18 remains historical evidence of the
pre-correction verdict; it was not rewritten into a passing review.

```text
FORENSIC AUDIT: PASS
        ↓
AUDIT CLOSURE: PASS
        ↓
READY_FOR_PROPOSAL
        ↓
TARGET ARCHITECTURE PROPOSAL
        ↓
INDEPENDENT REVIEW: ARCHITECTURE_REVISION_REQUIRED
        ↓
AR-REV-001–007 CORRECTIONS
        ↓
STANDARDS + SPECIFICATION CORRECTION REVIEWS: PASS
        ↓
ARCHITECTURE_FROZEN
```

## Frozen target architecture baseline

| Field | Frozen value |
| --- | --- |
| Architecture status | `ARCHITECTURE_FROZEN` |
| Architecture document | `docs/architecture-audit/17-target-architecture-proposal.md` |
| Architecture SHA-256 | `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| Historical independent review | `docs/architecture-audit/18-independent-architecture-review.md` |
| Independent review SHA-256 | `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |
| Preservation requirements | 35/35 mapped |
| Migration units | W0 prerequisite plus seven migration waves W1–W7; all `NOT_AUTHORIZED` |
| Investigation simulations | 6/6 reconciled |
| Current actionable architecture findings | 0 CRITICAL, 0 HIGH, none from the final correction reviews |
| Pre-freeze Git baseline | branch `main`, commit `d7da3aa74b784a4f385e33120210cc860837b6eb` |

The freeze commit is repository history and may be reported after creation; it
is not embedded here because a commit cannot contain its own final hash.

## Scope and evidence totals

| Measure | Result |
| --- | --- |
| Application-owned files discovered/classified | 157/157 |
| Application-owned files fully read | immutable snapshot: 157/157, 20,535 lines; current tree: 20,573 lines with all changed closure files re-read |
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
| High-risk findings | 4 established; 4 resolved; 0 open |
| Target architecture | frozen in `17-target-architecture-proposal.md`; not implemented |

The exact baseline and source hashes are in [00-baseline.md](00-baseline.md), with per-file records in [annex-file-fingerprints.tsv](annex-file-fingerprints.tsv) and significant records in the [runtime](annex-runtime-symbols.tsv) and [supplemental](annex-supplemental-symbols.tsv) symbol annexes. “Mapped” and “verified” retain the evidence qualifications defined there and do not imply runtime execution.

## Gate matrix

| Gate | Status | Evidence |
| --- | --- | --- |
| immutable source baseline recorded | PASS | branch, commit and manifests recorded |
| every application-owned file discovered and classified | PASS | 157-file inventory |
| every application-owned file read end to end | PASS | immutable complete-file pass covers 157/157 files and 20,535 lines; every changed closure file was re-read, producing 20,573 current application lines |
| every verification file read end to end | PASS | immutable baseline 80/80 plus the fully read closure contract: 81/81 current files |
| every important symbol inventoried and reconciled | PASS WITH QUALIFICATION | all 1,993 immutable-snapshot records plus the closure helper remain indexed; 1,927 baseline records are definition-indexed rather than claimed as end-to-end behavior proof |
| every entrypoint mapped | PASS | source mapping covers 18 HTTP routes and 3 dynamic assets |
| dependency and native boundary mapped | PASS | dependency map and bounded core inspection |
| request/action flow mapped | PASS | request map covers routes, guards and owners |
| database ownership and architecture-relevant write sites understood | PASS WITH QUALIFICATION | ownership and critical mutation paths are mapped; no claim is made for every incidental native write |
| module lifecycle understood | PASS WITH QUALIFICATION | the state matrix is mapped and every RST-006B DDL interruption resumes; historical runner provisioning defects remain medium verification debt |
| authentication state machine understood | PASS | retained Admin reset and encrypted-only invitation/reset password persistence pass in a disposable tenant |
| authorization paths sufficiently characterized | PASS WITH QUALIFICATION | primary UI, route, command and database layers are mapped and focused runtime checks fail closed; this is not a claim that every indexed symbol was dynamically executed |
| core business workflows mapped | PASS | source maps planning through reconciliation and exceptions |
| frontend contract understood | PASS WITH QUALIFICATION | all 14 production frontend files were read and source contracts mapped; Phase 3A passed 27 browser tests, while full-tree runtime coverage remains qualified |
| duplication classified | PASS | candidates classified without speculative consolidation |
| dead-code candidates conservatively classified | PASS | no candidate is declared absolutely dead from textual absence alone |
| standards assessed against applicable sources | PASS | repository, Dolibarr, PHP, JS/CSS and MariaDB considerations recorded |
| regression baseline sufficient for the first architecture migration waves | PASS WITH QUALIFICATION | the critical transaction/auth contracts and Phase 3A lifecycle/authorization suite pass; broader runner and design-test debt remains recorded |
| preservation ledger complete for mapped critical behavior | PASS | 35 stable identifiers recorded with evidence qualifications |
| all high-risk findings resolved or fully bounded | PASS | 0 CRITICAL and 0 HIGH findings remain open |
| current architecture documented | PASS | current-state architecture recorded without inventing a target |

## High-risk findings

Resolved:

1. **Retained Admin reset conflict.** Reset triggers and consumption now admit only the entity-0 native Admin into an active-entity reset while retaining exact same-entity rules for business users. The disposable auth suite passed 12/12.
2. **Reference transaction outcomes.** Reference writes now stop on failed begin, reject failed commits, attempt rollback, and close an uncertain connection after rollback failure. The direct failure contract passed.
3. **Legacy cleartext password persistence.** The shared MJL password adapter now temporarily forces Dolibarr's encrypted-only mode for invitation and reset writes, restores the prior runtime setting, and the disposable auth suite proves `llx_user.pass IS NULL` after both flows.
4. **RST-006B early interruption recovery.** The detector now recognizes every exact early Operation-check prefix as partial. Four new DDL failure points prove resume, exact target verification and rollback through the public Phase 3A suite.

The canonical gap analysis records these as implementation debt. Medium and low risks, including server-side export read handling, cron semantics, activation interruption, global export serialization, retry identity, Apache loaded state and runner safety, are classified in [15-behavior-classification.md](15-behavior-classification.md).

## Verification outcome

Closure verification includes `php tests/contracts/reference_transaction_test.php` passing, `npm run test:auth` passing 12/12 with both encrypted-storage assertions, and `npm run test:phase3a` passing its full migration matrix plus 27/27 Playwright tests. Both disposable tenants completed teardown. Changed PHP and JavaScript files passed syntax checks. The earlier broad-unit qualifications and design-test debt remain recorded; no shared-tenant write ran.

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
18. [Frozen target architecture](17-target-architecture-proposal.md) — the
    authoritative architecture baseline; not implementation authorization
19. [Independent architecture review](18-independent-architecture-review.md) —
    immutable original review; `ARCHITECTURE_REVISION_REQUIRED` at that review
    point. The correction-review status is recorded above.

## Safe next decisions

The architecture is frozen. W0 and W1–W7 remain unauthorized.
Server-side export read handling, runner discovery/deadline behavior,
historical runner provisioning, auth-schema exactness, cron failure semantics,
and stale design assertions remain bounded findings in the proposal and gap
analysis. The next expected documentation phase is a separately requested MJL
Engineering Standard v1; this freeze does not create or authorize it. See
[closure-evidence.md](closure-evidence.md) for the exact closure delta and
final-count report.
