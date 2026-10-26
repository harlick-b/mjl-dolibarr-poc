# PTA-2B.1 implementation plan — approved Activity amendments

Planning only. Implementation requires a separate explicit authorization.
Independent engineering and security/specification plan reviews: PASS.
Amendment readiness: `PTA_2B1_READY_FOR_AUTHORIZATION`; full PTA-2B is not ready.
Contract: [readiness 10](10-pta2b-amendments-readiness.md), DEC-087–090/108–110,
AGENTS.md and the approved Engineering/Security/UI standards. PTA-2A runtime
baseline is `1f6c670`; do not use the legacy PHP commands or database.

## 1. Scope and stop boundaries

Deliver one complete synthetic same-year amendment journey: opening pauses the
Activity, Agent edits/submits, fresh Supervisor then distinct Validator review,
returns/correction, atomic replacement approval, or reasoned Agent cancellation
with preserved candidate history and restoration of the prior approved version.
One open amendment; no opener/assignment access restriction. Current verified
roles and cumulative contributor exclusion remain authoritative on the server.

Exclude withdrawal, annual transfers, individual submitted Operation cancellation,
financial execution/settlement, reports/documents, Partner portal, Admin business
mutations, real accounts and production. PC1/PC2 remain pending. No new framework,
dependency or tables are needed. Three new API responsibilities are defined in
readiness §7; extend existing review and history contracts.

## 2. Establish I3 and disposable verification before edits

Read authority, readiness, this plan, A1–A3/PTA-1/2A implementation and applicable
local security/confidence/design skills. Capture HEAD/status and preserve unrelated
changes. Use `backend/app/planning/{models,routes,service}.py`,
`backend/migrations/versions/0006_pta2a.py`, `backend/app/auth/service.py`,
`frontend/src/PlanningView.jsx` and current tests as implementation seams.

Record I3 as a short contract checklist in completion evidence: nullable amendment
ID/reason, allowed pointer/state combinations, immutable base in submitted
snapshots, strict DTO/audit shapes, merged history cursor ordering and UI states.
Use readiness rules, not new business choices. Stop affected work if genuine
contradictions appear; do not reopen DEC-110.

Allocate task-owned disposable PostgreSQL/Compose project, mailbox and ports.
Verify isolated database provenance before migration or synthetic seeding. Read
README's rebuild/PTA-2A recipes and test fixtures for current commands; replace
old named containers with this task's resources. Never run teardown against the
legacy or shared development project. Retain exact predecessor artifact for C3.

## 3. Tests first: approved/candidate isolation and persistence

Extend `backend/tests/test_planning.py` or a focused amendment test file sharing
its fixtures. Add failing tests mapped to M01–M20, starting with opening and
unchanged approved projections. Capture expected initial PTA-2A behavior too.

One new Alembic migration (do not edit 0006) adds Activity amendment ID/reason,
state/check changes and exact deferred chain validation. No new tables. Keep
initial-flow invariants, history immutability, same-resource FKs and restricted
runtime permissions. Validate approved chain independently of current candidate;
when candidate exists verify its amendment ID/base matches the open Activity.
Historical snapshots remain byte-identical and render without new amendment keys.

Reuse existing structural-content/snapshot mechanisms and working Operations.
Expose approved content exclusively from approved snapshot. Candidate content is
separate and nullable; active amendment determines pause. Never let current
mutable fields or candidate amounts leak into effective values. Existing initial
draft/review UI must still work with no approved snapshot.

Update exact schema/trigger/function guard together with migration, not a relaxed
allowlist. Prove direct SQL invalid pointer/chain mutations fail. Extend strict
business-audit shapes for open/cancel and amendment metadata on approval without
weakening validation of existing events. Reserve bounded cancellation payload
capacity on writes: all valid persisted candidates must remain cancellable.
Check Python encoding and PostgreSQL `octet_length(business::text)` independently;
JSONB text size differs from compact JSON.

## 4. Implement opening, review and cancellation transactions

All mutations: advisory `1843201` → authentication Context/User → Activity →
revision/Operations → audit, inside existing outer transaction ownership. Check
current verified role, trusted resource ancestry, Activity version and supplied
base/amendment identity after locks. Never acquire User locks after Activity.

Opening POST requires approved state, no existing amendment and reason. Generate
fresh UUID, preserve approved/current pointer, enter amendment draft, increment
version once and audit. Return only after successful commit.

Extend PATCH and submission to amendment draft/returned states. First submission
compares structure against approved base; correction compares returned snapshot.
Opening alone is not a contribution; real structural editing/submission is.
Scope return amount constraints to this amendment's current returned revision.
Revision numbering uses the historical maximum, not the current approved pointer.
Snapshot captures amendment identity, reason and immutable base. Fresh Supervisor
review and distinct Validator approval remain mandatory. Final approval checks
exact current candidate/base and atomically changes approved pointer, state,
version, metadata and audit. Never reuse a preceding amendment's prevalidation.

Cancellation POST is available to any eligible Agent in every open amendment
state. Require version, current amendment ID, approved base and nonblank reason.
Before restoration, freeze full persisted candidate content and last submission
identity in the cancellation audit record. Do not create a fake submission.
Restore approved fields and Operation identities/amounts/positions; soft-remove
candidate-only additions, preserve their historical evidence and all contributors.
Do not restore historical assignments or erase review decisions. Clear amendment
metadata, current = approved, state = approved, increment version and commit audit
atomically. Inactive reference types must not block restoration of approved facts.
Never use ordinary editable-form validation to discard or reprice approved data.

No-op cancellation/replay returns 409. Cancellation racing approval/edit/submission
or a reopened amendment must never affect the wrong candidate. Old requests cannot
match the fresh UUID/version. A failed transaction leaves the pause and candidate
intact, with no success audit. Unknown/inconsistent base fails closed.

## 5. History and minimum React experience

Extend existing revision history list with tagged opening/cancellation summaries,
stable source-aware cursor and existing DEC-102 envelope/limit validation. Keep
snapshot payloads out of lists. The new amendment detail GET returns only scoped
opening/cancellation business facts, never unrelated auth audit data. Existing
revision detail stays revision-only. Apply Activity share locks for coherent
approved/candidate/history reads; list locking remains deterministic.

Extend `PlanningView.jsx`, its existing API/Query hooks and localized text. Read
DESIGN.md, design-system index/v3 tokens and supplied amendment/detail/history
inspiration before touching screens. Reuse existing forms/dialogs; no new page.
Show approved and candidate values distinctly, pause explanation, opening reason,
“Annuler la modification” with required reason/confirmation, and cancelled history.
Closing an edit dialog is not cancellation. Cancelled detail is read-only.

TanStack Router owns selection; Query owns server projections/history. Invalidate
and reconcile Activity lists/detail/history after opening/edit/submission/decision/
cancellation, including failed or delayed refetch. Disable obsolete actions until
fresh state is known; auth change masks data and rejects old responses. Preserve
online-only behavior, no persisted mutation queue/replay, exact XOF, French copy,
keyboard/mobile accessibility, Sonner and Helmet.

## 6. Execute all twenty acceptance checks and C3

Map each M01–M20 to named tests and actual results in completion evidence; a check
passes only if all its branches ran. No skipped DB/browser tests count as passed.
Use real disposable PostgreSQL and observed locks/barriers, not sleeps, for
opening/decision/cancellation races in both acquisition orders. Verify cancellation
from every allowed state, before any submission and after correction, plus new
opening, numbering, retained contributors, immutable decisions and assignments.
Inject audit, actual constraint and outer commit failures for rollback evidence.

C3: start actual `1f6c670` artifact on isolated predecessor schema, create synthetic
approved/returned histories, stop/drain predecessor writers, migrate, run candidate
under a distinct restricted non-owner login. Verify exact new guard, old artifact
rejecting new schema, no mixed workers, history equality and guard tamper failures.
Run focused A2.2/A3 lifecycle/recovery tests and A1/A2.1 regressions. Do not weaken
provenance or responsibility eligibility to make tests pass.

Use current environment's configured Python runner for:
`pytest -q tests/test_planning.py` plus amendment tests and focused auth/access/
lifecycle/recovery files; `ruff check .`, `ruff format --check .`, `mypy app` from
backend. Validate generated REST/OpenAPI through existing schema checks. From
frontend run `npm run test:unit -- src/planning.test.jsx` and affected auth tests,
`npm run test:e2e -- e2e/planning.spec.js` against the isolated running app,
`npm run lint`, `npm run format:check`, `npm run lint:css`, and `npm run build`.
Build the frontend before Playwright (its server uses preview), with the isolated
API proxy target set for the build/preview; ensure port 4173 is task-owned and
use the mailbox/container variables expected by planning.spec.js.
Use supported Node and installed dependencies. Verify test collection, DB target,
browser target and exit results; an unavailable prerequisite is a failed gate.

Inspect full diff for scope/dependencies, run `git diff --check`, evaluate lessons
without adding speculative entries, and prepare concise completion documentation.
Do not claim production readiness or move to withdrawal/transfers.

## 7. Mandatory independent review handoff, corrections and completion

After implementation and checks, hand the candidate to separate agents that did
not implement it, for engineering and security/specification review. Reviewers
lead a review-only phase: read governing requirements, complete diff/new files,
surrounding code and actual verification evidence. Treat implementer assertions
and passing-test claims as unverified. They must not edit implementation or fix
their own findings. Require severity, file/line evidence, impact, smallest fix
and missing verification for every gap, bug, regression or security weakness.

The implementation agent fixes accepted findings and reruns affected checks,
then returns the candidate to the same reviewers for focused re-review. Repeat
until blocking findings and mandatory evidence gaps are resolved. If a reviewer
is unavailable, record the gate blocked; self-review is not a substitute.

Only after I3/C3, all M01–M20, focused quality/regression checks and both reviews
pass, update completion status and commit the authorized changes. Report
`PTA_2B1_COMPLETE` or `PTA_2B1_FAILED`, passed checks out of 20, actual concurrency/
rollback/provenance evidence, review outcomes, files/commit/worktree and deferred
responsibilities. Teardown task-owned resources only. Stop after PTA-2B.1;
withdrawal, transfers, realization and real accounts remain unauthorized.
