# PTA-2B.1 Implementation Status

Status: **PTA_2B1_COMPLETE** on 2026-10-26. This records development evidence
for the user-authorized synthetic slice. It is not application acceptance,
compliance evidence or production readiness.

## Implemented boundary

Migration `0007_pta2b1` adds `amendment_id` and `amendment_reason` to the
existing Activity table, extends the state/pointer constraints and strengthens
the deferred review-chain trigger. It creates no table. The exact schema guard
now covers the new columns, constraints and trigger definition.

FastAPI adds three responsibilities: open an amendment, read its scoped history
detail and cancel it with a reason. Existing Activity editing, submission and
two-stage decisions handle the candidate. Opening keeps the prior approved
revision authoritative and pauses execution. Approval requires a fresh
Supervisor prevalidation and distinct Validator approval before atomically
activating the replacement. Cancellation restores the prior approved structure,
retires candidate-only Operations without deletion and preserves revisions,
decisions, contributors, frozen Operation labels and cancellation evidence.

The existing Activity workspace shows approved and candidate versions, the
pause, amendment reasons and actor/time evidence. Its merged cursor history
includes opening and cancellation events. TanStack Query invalidates and
reconciles the Activity list/detail/current-revision/history queries; mutations
remain online-only with no retry, pause or replay.

## I3 and C3 evidence

I3 freezes the two-column/no-table persistence shape, state and pointer
constraints, amendment/base lineage in immutable snapshots, compact audit
transition facts, frozen cancellation payload, merged cursor markers and the
approved comparison UI. Amendment workflow audits avoid redundant structural
copies: immutable revisions retain reviewed content, while audits retain exact
versions, pointers, amendment/base identity, actors and decisions. A public-API
test approves a maximum valid non-BMP Unicode candidate, opens another maximum
candidate over that base and cancels it within both Python and PostgreSQL 1 MiB
bounds.

C3 used the exact `1f6c670` predecessor image and task-owned PostgreSQL data to
create one approved and one returned Activity under schema `0006_pta2a` (two
revisions and three decisions). The old writer exited before migration. The
corrected candidate migrated those preserved records to `0007_pta2b1` without
manufacturing amendment history. A distinct non-owner `mjl_c3_runtime` login
passed the exact candidate schema guard; the old artifact rejected the new
schema, and removing `activity_amendment_state` made the candidate guard reject.
The clean migration downgrades and upgrades repeatably, while a database holding
amendment evidence refuses destructive downgrade.

## M01–M20 verification matrix

| Gate | Executed evidence |
| --- | --- |
| M01 | `test_m01_authorization_validation_and_stale_cancellation_fail_closed` plus the existing full auth/session/Origin/CSRF matrices. |
| M02 | `test_m02_opening_preserves_effective_approval_and_blocks_second_candidate` and the multi-cycle cancellation/reopen check. |
| M03 | `test_m03_m04_m05_amendment_edits_are_isolated_and_submit_frozen_base` and `test_m03_m05_late_dates_same_year_and_unchanged_submission`. |
| M04 | Candidate isolation across every state plus edit→edit→revert→cancel assertions over bounded structural before/after audit evidence. |
| M05 | Frozen base/lineage and changed/no-op submission assertions in the two M03/M05 tests. |
| M06 | `test_m06_m08_amendment_requires_fresh_chain_and_activates_atomically`, `test_m06_cancelled_candidate_contributor_cannot_later_review` and predecessor reviewer-role regressions. |
| M07 | `test_m07_m13_cancellation_from_every_open_state_preserves_history` plus correction/resubmission planning regressions. |
| M08 | Atomic activation, completed-amendment detail and byte-stable prior history assertions in M06/M08 and the planning suite. |
| M09 | `test_m09_m10_cancel_and_approval_race_has_one_serial_winner` plus existing barrier opening/submission/decision races. |
| M10 | Both-order advisory races and cancellation versus edit, submit, both returns, prevalidation and approval in the M09/M10 tests. |
| M11 | Existing deterministic role-change, deactivation, recovery/session and review races in `test_planning.py`; coordination assignments remain non-authorizing. |
| M12 | `test_m12_http_reads_are_coherent_during_cancellation` observes PostgreSQL lock waits and exact approved/candidate/Operation/history projections for Activity detail, PTA list, merged history and amendment detail. |
| M13 | M07/M13 covers cancellation from every open state; M13 preserves history/contributors, restores inactive-reference content and retires candidate-only Operations. |
| M14 | Audit, real PostgreSQL constraint and outer-commit failures cover open/cancel and each amendment edit/submit/Supervisor return/prevalidate/Validator return/activate path, comparing every affected Activity, Operation, assignment, contributor, revision, decision and audit row. |
| M15 | Direct SQL rejects invalid amendment pointers, lineage and unreviewed approved bases; immutable-history tests and exact guard tamper checks pass. |
| M16 | Cross-Activity amendment detail, invalid/cross-parent cursors and merged one-item pagination prove scoped ancestry with no duplicate or omitted event. |
| M17 | Existing XOF boundary regressions plus maximum non-BMP payload, stable Operation identity, candidate-only retirement and inactive type restoration pass. |
| M18 | Generated OpenAPI/strict DTO, pagination and route-absence checks pass with the A1–A3/PTA-1/PTA-2A regressions. |
| M19 | 45 Vitest cases and one real-Chrome journey cover amendment return/correction/approval, cancellation/history/reopen, mobile/loading/error, reconciliation and offline no-send/no-replay. |
| M20 | C3, migrations, restricted runtime, 151 PTA PostgreSQL cases, 206 auth/access/lifecycle/recovery/health cases, all quality gates and both same-reviewer re-reviews pass. |

## Executed checks

- `pytest -q tests/test_planning.py tests/test_amendments.py`: **151 passed**.
- Focused auth/access/lifecycle/recovery/database regressions: **147 passed**;
  auth-policy/security/health regressions: **59 passed**.
- `npm run test:unit`: **45 passed**.
- Real Chrome `e2e/planning.spec.js`: **1 passed** against a fresh isolated
  `mjl_test_pta2b1_browser` database.
- Ruff lint/format, mypy, ESLint, Prettier, Stylelint, Vite/PWA build and
  `git diff --check`: passed.

The independent engineering and security/specification reviewers rejected the
initial candidate, then rejected its first correction for incomplete edit audit
history and verification oracles. After the accepted fixes, both same reviewers
performed a second read-only re-review and reported PASS with no blocking, high
or medium findings or mandatory evidence gaps.

PC1 and PC2 remain pending. Only synthetic identities and disposable resources
are permitted. Withdrawal, annual transfers, execution/finance, real accounts,
production deployment, technical Admin recovery and later slices remain
deferred.
