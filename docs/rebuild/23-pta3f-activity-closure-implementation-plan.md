# PTA-3F implementation plan: direct Activity closure

Planning status: **ready for implementation authorization**, not implemented.
Authority: DEC-120, the approved PTA brief, standards 02/03 and the completed
PTA-3E boundary at `b7c13e8`. This is the only implementation contract needed for
PTA-3F; a short explicit authorization is sufficient.

## 1. Outcome and boundaries

An active Agent closes an Activity directly after MJL verifies that its current
approved work and administrative settlement are complete. The user supplies only
the expected Activity version and an explicit UI confirmation. The server records
the Agent and current time. No Supervisor or Validator closure approval, reason,
manual date or attachment is added. Supervisor and Validator retain read-only
visibility; Admin has no business access.

Closure requires all current approved Operations to be physically complete with
explicit final spending, the exact current décaissement and virement requests to
be finally approved, the latest external virement confirmation to exist, and the
reversement projection to be settled: zero requires no declaration and a positive
amount requires its exact current declaration. Missing history, overspending,
stale bases and every unresolved mismatch fail closed. The existing bounded flow
does not support a zero-total financial request or insufficiency/discrepancy
resolution, so those Activities remain ineligible rather than receiving a bypass.

Closure is terminal in this slice. It freezes planning, execution, confirmation
and reversement corrections, ends active Agent coordination assignments while
preserving their history, and supplies the closed fact consumed by later metrics.
Do not implement reopening, Project closure relaxation, zero-total settlement,
exceptions, annual KPIs, Fiche/PDF, documents, reminders, notifications, Partner
portal, real identities or production. Stop after PTA-3F.

## 2. Smallest data and module change

Add migration `0015_pta3f` after byte-unchanged `0014_pta3e`. Add `closed_at` and
`closed_by_id` to `pta_activity`, extend its existing state/check constraints with
`closed`, and require a closed Activity to retain the same approved/current
revision with both closure facts present. No new table is needed.

Add one closure eligibility helper in the execution/settlement module and reuse it
for read projections and the command. It must inspect the authoritative approved
revision/Operation set, immutable execution audits, current approved financial
requests and decisions, latest virement confirmation and latest reversement. It
returns stable blocker codes for presentation but the command always locks and
recomputes eligibility; a prior projection never grants authority.

Use a narrow PostgreSQL guard for the integrity that cannot be expressed by row
checks: permit only `approved -> closed` with the complete current settlement
chain, reject reopening or changes to closure facts, and prevent Operation,
virement-confirmation and reversement changes after closure. Extend the exact
schema/function manifest and audit-target validation. Evidence-bearing downgrade
must refuse and restore predecessor functions exactly when clean. Do not add a
closure table, snapshot, status framework or event system.

## 3. API and transaction contract

Add one responsibility:

`POST /api/v1/activities/{activity_id}/closure`

The body is `{expected_version}`. It is a transition of an existing resource, so
success returns `200` with the updated execution projection, including
`state`, `closure`, `closure_blockers` and server-derived `allowed_actions`.
Existing Activity and execution reads expose the same closure actor/time. Closed
Activities remain readable and in the annual execution list.

The command acquires the existing global advisory lock first, authenticates an
active `AGENT_SAISIE`, locks/rechecks the Activity/version, Project, approved
revision and Operations, current approved décaissement/virement chain, latest
confirmation/reversement and active assignments in the established order. It
then recomputes every prerequisite, sets `state=closed`, records actor/time,
increments the Activity version, ends active coordination assignments and appends
`activity.closed` audit evidence in one transaction. Constraint, audit or commit
failure rolls back all effects.

Reject anonymous/pending/inactive actors, Supervisor, Validator, Admin, missing
CSRF/origin evidence, foreign or guessed resources, stale/replayed versions,
pending planning requests, incomplete/missing execution facts, missing or stale
approvals/declarations, negative reversement and schema/provenance uncertainty.
Serialize closure against execution correction, confirmation/reversement
correction, assignment/account lifecycle and planning mutations. Exactly one
valid serial outcome may commit; no path may alter a closed Activity.

## 4. React experience

Extend the existing French realization workspace using the current realization
inspiration and approved v3 tokens. Add a compact “Clôture de l’activité” section:

- show the server-owned checklist and clear blockers while open;
- for an eligible Agent, require one explicit confirmation checkbox and submit
  the versioned closure action;
- after closure, show “Activité clôturée”, actor and time with no mutation controls;
- give Supervisor and Validator the same evidence in read-only form.

Reuse the existing Query mutation and Activity reconciliation seam. Invalidate
execution detail/list, Activity/planning data and relevant financial queries after
success or uncertain conflict. Keep retries disabled, clear protected state on
access loss and never queue or replay offline closure. Add no route, modal, upload
control or client-owned eligibility calculation.

## 5. Focused verification

Implement test-first through the public API and current workspace. These seven
gates are sufficient:

| Gate | Expected evidence |
| --- | --- |
| C01 eligibility | A complete positive-spending chain closes; allocation-equals-spending closes without a reversement row; positive unused funds require the exact latest declaration. Missing/incomplete Operations, missing spending, pending planning, missing/unapproved/stale requests or confirmation, overspending, zero-total unsupported settlement and mismatched history fail closed. |
| C02 authorization and replay | Only an active Agent closes. Supervisor, Validator, Admin, inactive/pending/anonymous actors, CSRF/origin failures, guessed/foreign IDs and stale or repeated requests deny server-side without mutation or disclosure. |
| C03 atomic terminal state | Success records closed state, actor/time, version, ended assignments and structured audit atomically. Planning, execution, assignment, confirmation and reversement mutations then fail while authorized history reads still work. Audit, real constraint and outer-commit failures leave all facts unchanged. |
| C04 deterministic races | PostgreSQL barriers cover closure versus Operation correction, reversement/confirmation correction, planning mutation, assignment/account lifecycle and duplicate closure. One valid serial outcome wins without deadlock or partial state. |
| C05 migration | Clean install and exact `0014_pta3e` upgrade preserve all prior facts, create no closed Activities and permit the first valid closure. Closure/audit evidence refuses downgrade; the predecessor runtime rejects the successor schema. |
| C06 React | Unit and focused real-Chromium coverage proves blocker display, Agent confirmation/success, closed read-only evidence for all business roles, Query reconciliation, navigation/session loss and offline non-replay. |
| C07 regression and quality | Run focused PTA-3A–3E regressions affected by the new terminal state, exhaustive REST/OpenAPI inventory, Ruff format/lint, mypy, ESLint, Stylelint, Prettier, Vitest and build. Run the combined backend regression once because Activity state, schema provenance and shared mutation guards change. |

Use synthetic identities, test mail and task-owned disposable PostgreSQL/browser
resources only. Record the exact candidate artifact, commands and real results.
Missing migration, rollback, race, browser or terminal-freeze evidence blocks
completion. PC1/PC2 remain pending.

## 6. Mandatory independent review and completion

After implementation and evidence are ready, hand the candidate to a separate
agent that did not implement it. That reviewer leads a read-only phase, does not
modify files and treats the plan, diff, surrounding PTA-3A–3E code, eligibility
query, migration/guards, transaction ordering and test claims as untrusted. It
reports every gap, bug, regression or security weakness with severity, file/line
evidence, impact, smallest correction and missing verification.

The implementer fixes accepted findings, reruns affected checks and returns the
same candidate to the same reviewer for focused re-review. Do not declare
completion until blocking findings and mandatory evidence gaps are resolved. If
no separate reviewer is available, report the review gate blocked. Only after
PASS: update DEC-120/roadmap and one concise status record, review the full diff,
run `git diff --check`, commit and report `PTA_3F_COMPLETE` or `PTA_3F_FAILED`,
evidence, commit and clean/preserved worktree state. Stop without starting
Project closure, metrics/Fiche or another slice.
