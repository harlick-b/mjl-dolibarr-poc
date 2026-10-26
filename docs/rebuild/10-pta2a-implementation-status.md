# PTA-2A Implementation Status

Status: **PTA_2A_COMPLETE** on 2026-10-26. This records
development evidence for the user-authorized synthetic slice; it is not
application acceptance, compliance evidence or production readiness.

## Implemented boundary

Migration `0006_pta2a` adds exactly `pta_activity_revision`,
`pta_activity_revision_decision` and `pta_activity_contributor`, extends Activity
state and revision pointers, reconstructs contributors from the complete PTA-1
audit chain, and rejects inconsistent predecessor evidence. Revisions, decisions
and contributor membership are append-only. Deferred database constraints bind
Activity state to the exact current decision chain and require a distinct
successful Supervisor prevalidation before final approval.

FastAPI adds submission, decision, revision-list and revision-detail
responsibilities. Any eligible Agent may submit. Every eligible Supervisor and
Validator may review every Activity without assignment or quorum; cumulative
contributors cannot review, and the prevalidator cannot later approve the same
revision after a role change. Returns unlock controlled correction, every
structural resubmission creates a fresh immutable revision, and final approved
amounts come only from the approved snapshot.

The existing `/activities/$activityId` React workspace now shows French
state/progress, proposed and approved budgets, return reasons and advisory
amounts, permitted confirmation dialogs and cursor-bound immutable history.
TanStack Query invalidates the full planning key after confirmed mutations and
refetches after version conflicts or uncertain network/malformed responses;
mutations do not retry, pause or replay offline. Revision browsing renders the
captured hierarchy, labels, structure, assignments, submitter, contributors and
decision chronology, and identifies the current revision independently of the
selected history page.

## I2 and C2 evidence

I2 freezes strict snapshot and decision DTOs, the one-decision-per-stage model,
1 MiB snapshot limit, cumulative contributor proof, database immutability,
state/pointer constraints and the approved v3 workspace treatment. The revision
fingerprint is the digest of normalized structural content and is also embedded
in the snapshot. Strict workflow audits retain submitter identity/role/time and
each decision actor/role/time, reason, advisory amount and exact prevalidation
link.

C2 used a separate task-owned `mjl_test_pta2a_c2` database and the exact PTA-1
application artifact from commit `1f3fd91` (image
`sha256:0cfa72fb6e6ba7f626d3f28bb4a9f879d7f0cdc3a9733876d3ea57db39a7d4e1`).
That predecessor wrote synthetic no-op, reverted and removed-Operation histories
under schema `0005_pta1`, then exited before the candidate migration ran. The
candidate upgraded those records to `0006_pta2a`; the exact guard passed under a
separate `c2_runtime` login. Candidate HTTP submission and Supervisor
prevalidation both returned 201 through that restricted login, while DDL,
TRUNCATE and immutable-row UPDATE were denied. Contributor reconstruction and
full tombstone reconciliation passed; focused corrupt-history and corrupt-
tombstone fixtures abort migration. The existing Agent-assignment lifecycle
blocker remained active while review history created no lifecycle blocker.

## Verification

The initial 20/20 claim was withdrawn after independent review found missing
oracles. Corrections add the new POSTs to the Origin/CSRF matrix, frozen-
snapshot and exact-audit assertions, obsolete-revision SQL rejection, both-order
correction/approval and role/reset/review races, coherent-read barriers, every-
stage rollback injection, full tombstone corruption fixtures, conflict refetch,
protected-history error handling and full frozen-history rendering. The
corrected broad evidence run recorded 105 passing planning/PostgreSQL cases.
After focused independent-review corrections, 10 targeted cases additionally
pass for legal correction/approval orderings, PostgreSQL-observed HTTP read
locking, runtime contributor eligibility, frozen identities after account
changes, exact duplicate-action audit cardinality, late and reverted
corrections, and an empty reviewer pool. The earlier reviewer-gap matrix
recorded 28 passes and A1–A3 backend regressions recorded 71 passes. All 42
Vitest cases pass, including delayed and failed uncertain workflow-response
reconciliation with controls blocked and no replay. One actual Chromium
correction-to-approval journey passes, including selection and rendering of the
frozen first revision and protected revision-query failure handling. Ruff lint/
format, mypy, ESLint, Prettier, Stylelint and the Vite/PWA build pass.
All V01–V20 mandatory acceptance checks pass.

The same independent engineering and security/specification reviewers inspected
the corrections and their focused evidence. Both final re-reviews passed with no
blocking, high or medium findings. Independent review is development evidence;
it is not application acceptance or production authorization.

PC1 and PC2 remain pending. Only synthetic identities and disposable resources
are permitted. Real accounts, production deployment, PTA-2B amendments,
withdrawal, annual transfers, execution, finance, documents, reports, technical
Admin recovery and later slices remain deferred.
