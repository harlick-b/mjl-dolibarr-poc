# PTA-2B.2B Transfer Implementation Status

Status: **PTA_2B2B_COMPLETE** on 2026-10-28. This is
development evidence for the user-authorized synthetic slice, not application
acceptance or production readiness.

## Implemented boundary

Migration `0009_pta2b2b` adds nullable `transfer_id` and non-null
`placement_year` to the existing Activity table. It creates no table. Deferred
constraints bind every transfer revision to its current approved base, source
placement, forward target year, dates and immutable content. Creation provenance
remains unchanged. The exact auth/planning schema manifest now includes this
single migration shape.

FastAPI adds one request/correction POST and one reasoned-cancellation POST. An
approved Activity remains in its source annual plan and pauses while one eligible
Supervisor prevalidates and a distinct eligible Validator approves. Final
approval atomically creates or reuses the destination annual PTA and changes the
Activity's current placement and dates. Identity, Project, approved content,
Operations, allocations, assignments, request provenance and immutable history
remain intact. Cancellation restores the source approval while retaining all
request and review evidence.

The existing decision route handles transfer returns, prevalidation and final
approval. Advisory lock order is global mutation lock, Project, sorted existing
annual PTAs, Activity and revision. Project state is rechecked under lock.
Transfer requests block amendments and withdrawals; after approval, later
amendment and withdrawal work against the resolved current annual PTA. The
withdrawal SQL correction accepts a transferred approved base without rewriting
its snapshot or weakening content comparisons.

The React Activity workspace adds the reason, source/destination year and dates,
preserved budget/Operations context, correction and cancellation controls,
history and a current annual-plan link. Query invalidation covers source and
target contexts/lists, Activity detail/history and related account state.
Mutations remain online-only without automatic retry or reconnect replay.

## C01-C08 and T01-T08 evidence

| Gate | Executed evidence |
| --- | --- |
| C01 | Backend authorization covers Agent request/correction/cancellation, role-wide eligible review, distinct reviewers, Admin/wrong-role denial and scoped missing resources. Existing authentication regressions retain session, OTP, Origin and CSRF denial. |
| C02 | The per-mutation provenance guard requires the exact isolated `0009_pta2b2b` schema and fixture. Missing, altered, older and production-like schemas fail closed. |
| C03 | Expected Activity/base/revision/group versions reject stale and replayed mutations. PostgreSQL barriers cover competing transfers, approval/cancellation, missing target creation, assignment, Project close, role/deactivation, password recovery and annual-context/list reads in both serial orders. |
| C04 | Audit, real constraint and outer-commit failures roll back request, correction, cancellation, both returns, prevalidation and approval, including target-PTA creation. |
| C05 | Direct SQL rejects changed request provenance, placement/date bypass, missing ordinary PTA identity, malformed/orphan transfer objects, wrong base/source/target facts, mixed withdrawal purpose and out-of-range years. |
| C06 | Exact `a3c3bd0` predecessor fixtures for pending, cancelled and effective withdrawal migrate without changing Activity or revision hashes. Candidate non-owner guard passes and the predecessor runtime refuses the migrated schema. Clean downgrade/re-upgrade and evidence-bearing downgrade refusal are covered. |
| C07 | The two strict POST routes expose Origin/CSRF and version inputs in OpenAPI. Shared list/history pagination and error contracts remain unchanged; no finance, restore, export or reverse-transfer route was added. |
| C08 | React unit checks and the real-Chrome planning journey cover transfer opening, cancellation/history, return, correction, fresh approval, target navigation and subsequent withdrawal. Query reconciliation remains online-only. |
| T01 | Only approved Activities in active Projects enter a forward same-Project transfer. Source placement and approved content remain effective while pending. |
| T02 | One Supervisor prevalidation followed by a distinct Validator approval is required. Returns and corrections create immutable evidence and restart review. |
| T03 | Reasoned cancellation works in pending/returned states and has one serial winner against approval. |
| T04 | One Activity identity and original creation request survive two forward transfers; replay returns the same current Activity without recreating source records. |
| T05 | The exact 100→approved 120→pending/cancelled transfer→approved transfer→later amendment with changed destination-year dates→withdrawal chain preserves source/target current and `as_of` totals without double counting. Public read barriers return coherent before-or-after views. |
| T06 | Transfer races serialize against target creation, assignment, Project closure, account role/deactivation, recovery and historical reads without deadlock. |
| T07 | Final approval changes only current annual placement/dates and preserves Operations, amounts and assignments. Repeated transfers require new forward requests. |
| T08 | The React workspace reconciles both annual contexts and stable Activity/history links and does not queue offline mutations. |

## Exact predecessor evidence

The predecessor image was built from exact commit
`a3c3bd0d8b21df3c020f05e44f8ebbea424cad91`. Its tests created three fresh
`0008_pta2b2a` databases, which were each migrated once by the candidate:

| Fixture | Database | Activity hash before/after | Revision hash before/after |
| --- | --- | --- | --- |
| Pending withdrawal | `mjl_test_384de7d52f45400fba2ea7913a43acdf` | `42edeb0da1ede74cfb8835ca244c88cf` | `33130379bd8bfafa780a61466dec14be` |
| Cancelled withdrawal | `mjl_test_d976909d310f45409ed676cdfa3dc162` | `32f50b9760cc6c3035f008ecbbce941d` | `e28df61ce5a9723aed56d679fe4ff547` |
| Approved, amended and withdrawn | `mjl_test_322bf3a4c6c94718ba0ce50af494396c` | `ddd54e2513f11c7688f64f9ef5d4a6ee` | `34c8d8df8749ffc1521b096a5dd59e46` |

The final effective fixture returned `GUARD_PASS` under distinct non-owner role
`mjl_pta2b2b_runtime`. Running the exact predecessor runtime against that migrated
database returned `GUARD_REFUSED=eligibility_unverified`.

## Verification evidence

- Transfer-focused PostgreSQL suite after the final correction: **55 passed**.
- Frontend Vitest: **45 passed**; ESLint, Stylelint, Prettier and Vite/PWA build
  passed.
- Backend Ruff lint/format and mypy passed.
- Real system Google Chrome planning journey: **1 passed** against a fresh
  isolated database.
- Full backend regression before the final focused correction: **482 passed** in
  28 minutes 49 seconds. The affected transfer suite was rerun in full after the
  correction.
- The same independent engineering reviewer and security/specification reviewer
  re-inspected the corrected migration constraint, exact schema manifest and
  date-changing post-transfer amendment regression. Both returned **PASS** with
  no blocking findings. Reviewers modified no implementation files.

PC1 and PC2 remain pending. Only synthetic identities and disposable resources
are permitted. Reverse transfer, restoration, execution/finance, reports, real
accounts, production deployment, technical Admin recovery and later slices
remain deferred.
