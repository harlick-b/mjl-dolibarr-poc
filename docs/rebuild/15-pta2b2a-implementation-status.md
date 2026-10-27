# PTA-2B.2A Withdrawal Implementation Status

Status: **PTA_2B2A_COMPLETE** on 2026-10-27. All fourteen readiness gates and
the mandatory same-reviewer engineering and security/specification re-reviews
passed. This is development evidence for the user-authorized synthetic slice,
not application acceptance or production readiness.

## Implemented boundary

Migration `0008_pta2b2a` adds nullable `withdrawal_id` and the terminal
`withdrawn` state to the existing Activity table. It creates no table. The
schema constraints and deferred review trigger bind a canonical withdrawal group
to immutable approved content, require a valid distinct two-stage decision chain
and prevent a withdrawal revision from becoming approved executable content.
The exact A2.2 lifecycle schema guard now recognizes only this migration shape.

FastAPI adds withdrawal request/correction and reasoned cancellation routes and
an explicit withdrawal branch to the existing revision-decision route. A request
pauses execution while preserving the approved content. One eligible Supervisor
prevalidates and one distinct Validator approves. Final approval records the
effective time, ends current Agent assignments atomically and leaves the Activity
terminal and read-only. Cancellation from every pending or returned state restores
the approved Activity while retaining revisions, decisions, contributors and
append-only audit evidence.

The annual PTA context exposes a bounded approved-plan projection with optional
timezone-aware `as_of`. Pending/cancelled withdrawal does not change it; effective
withdrawal contributes zero while prior approved history remains visible. PTA
context/list reads use the approved shared advisory lock and Activity detail and
history acquire their shared row lock on the initial fetch.

The React Activity workspace adds reasoned request, correction and cancellation,
the paused/withdrawn status and merged history. It reuses the existing Query
client and invalidates detail, list, history, annual context and affected account
queries. Mutations remain online-only and have no retry or reconnect replay.

## C01-C08 and W01-W06 evidence

| Gate | Executed evidence |
| --- | --- |
| C01 | Public-route matrices cover verified Agent actions, role-wide eligible review, distinct actors, equal Agent access and anonymous/OTP-only/expired/revoked/CSRF/Origin/Admin/wrong-role/inactive/cross-resource denial. |
| C02 | Exact isolated provenance, required fixture literal and the complete auth/planning schema manifest are checked for request, correction, cancellation and decisions; missing or altered evidence fails closed. |
| C03 | Versions, base and group IDs reject stale/replayed calls. Deterministic PostgreSQL barriers cover amendment, content edit, assignment, review, cancellation, role change, deactivation, recovery and final assignment-ending in both relevant serial orders. Read-first detail/history cases directly observe Activity shared-row contention; write-first cases observe the earlier production authentication-row lock and then coherent post-commit Activity reads. |
| C04 | Audit, real SQL constraint and outer-commit failures cover request, correction, cancellation, both returns, prevalidation and approval; complete Activity, Operation, assignment, revision, decision, contributor and audit state is compared before/after. |
| C05 | Prior facts remain immutable; direct SQL rejects malformed lineage, purpose, pointers, noncanonical group IDs, withdrawal-as-content approval and invalid review chains. Maximum non-BMP Unicode and exact XOF history pass. |
| C06 | Exact `641ba13` predecessor histories migrated byte-stably from `0007_pta2b1`; distinct restricted runtime, tamper, old-artifact, clean downgrade/re-upgrade and evidence-bearing downgrade refusal gates passed. Existing A2.2 assignment eligibility and A1-A3/PTA regressions remain covered. |
| C07 | Strict request/response DTOs, required Origin/CSRF headers, status codes, scoped ancestry, list defaults/bounds and merged signed cursor history pass. No finance, restore or export route was added. |
| C08 | React unit and real-Chrome mobile journeys cover request, return, correction, approval, cancellation/history, loading/error and query reconciliation. Offline mutation replay remains absent; backend/frontend quality gates pass. |
| W01 | Only approved Activities in active Projects without an open amendment can enter withdrawal. Approved content/allocation remains authoritative and execution pauses at submission. |
| W02 | Withdrawal needs a fresh Supervisor then distinct Validator chain. Reasoned returns and corrected resubmission create a new immutable revision; old content approval cannot approve the request. |
| W03 | Reasoned cancellation works from all pending/returned states, retains history/assignments and has one serial winner against final approval. Post-effect cancellation fails. |
| W04 | Effective withdrawal preserves approved content and Operation identity/amounts, records request/effective time, ends assignments with actor/time and exposes read-only actions. |
| W05 | Current and historical annual totals cover initial approval, approved amendment and effective withdrawal. Context/list/detail/history overlap tests prove coherent before-or-after HTTP responses. |
| W06 | Closed Project and unverified obligation status fail closed. Project close remains blocked by contained Activity history; no financial waiver or hidden reopen exists. |

## Verification evidence

- Withdrawal-focused PostgreSQL suite: **70 passed**.
- Frontend Vitest: **45 passed**; ESLint, Stylelint, Prettier and Vite/PWA build passed.
- Real system Google Chrome journey: **1 passed** against fresh isolated database
  `mjl_test_pta2b2a_browser_final`.
- Full backend regression: **427 passed**. Ruff format/lint, mypy and
  `git diff --check` passed.
- The same independent engineering and security/specification reviewers each
  returned **PASS** after inspecting the corrected live diff and fresh evidence.
  No blocking, high or medium finding remains. Independent review does not imply
  acceptance, production readiness or authorization for another slice.

PC1 and PC2 remain pending. Only synthetic identities and disposable resources
are permitted. Cross-year transfers, execution/finance, restoration, real
accounts, production deployment, technical Admin recovery and later slices
remain deferred.
