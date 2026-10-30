# PTA-3E implementation plan: reversement of unused funds

Historical planning status: **implemented and independently reviewed** on
2026-10-30. Completion evidence is in
[status 22](22-pta3e-implementation-status.md).
Authority: DEC-119, the approved PTA brief, standards 02/03 and the completed
PTA-3D boundary at `4cd704a`. This is the only implementation contract needed for
PTA-3E. A short explicit authorization is sufficient.

## 1. Outcome and exclusions

After an Agent has confirmed the external virement, MJL shows the administrative
amount owed to the Partner:

`required reversement = max(0, approved Activity allocation - final spending)`.

For a positive result, the Agent declares one external return for the exact
server-calculated amount, supplies its effective date and may add a reference or
comment. MJL records but does not perform or verify the banking action. The Agent
may append a reasoned correction to the date or note before future Activity
closure; every prior declaration remains immutable. No reviewer approves the
declaration. A zero result is already settled and creates no declaration.

This slice excludes partial or different amounts, multiple instalments,
discrepancy resolution, insufficient-budget exceptions, confirmation cancellation,
Activity closure, documents, notifications, bank integration, real identities and
production. Explicit-zero final-spending settlement remains deferred by PTA-3B;
the zero case here means final spending equals the approved allocation. Stop after
PTA-3E.

## 2. Smallest persistence change

Add migration `0014_pta3e` after `0013_pta3d` and one append-only table,
`pta_reversement_declaration`. Do not add a separate requirement table: the
obligation is derived from the already frozen approved allocation and final
spending. The declaration records its Activity, approved virement request, exact
virement confirmation, revision, actual returned amount, effective return date,
optional note, actor/time and correction reason.

Use foreign keys to the existing Activity/virement/confirmation chain, a unique
`(request_id, revision)`, positive revision/amount checks and the same bounded
reason rules as virement confirmation. A narrow PostgreSQL trigger makes rows
append-only and validates that:

- the virement is approved and its current confirmation exists;
- the derived requirement is positive and the declared amount equals it exactly;
- the first row is revision 1 and later rows increment without gaps;
- every correction retains the same financial and confirmation basis;
- the effective return date is on or after the confirmed virement date and no
  later than the current Porto-Novo date; and
- recorded chronology follows the confirmation and previous declaration.

The API supplies the amount; clients cannot submit it. Extend the existing exact
schema/provenance manifest, ORM model and audit-target validation for this table
and trigger. Downgrade is allowed only with no reversement rows or audit evidence.
In the same migration, narrow the existing virement-confirmation guard so it
rejects any later confirmation revision once a reversement row exists; enforce
this in both PostgreSQL and the command path. Preserve its current behavior when
no reversement exists. Do not introduce a settlement framework, state-machine
table or new dependency.

## 3. API and transaction contract

Add three responsibilities under the existing approved virement resource:

1. `POST /api/v1/activities/{activity_id}/virement-requests/{request_id}/reversement`
   with `{expected_version, return_date, note?}` creates the first declaration.
2. `POST /api/v1/activities/{activity_id}/virement-requests/{request_id}/reversement/corrections`
   with `{expected_version, return_date, note?, reason}` appends a changed date or
   note. Reject a no-op correction.
3. `GET /api/v1/activities/{activity_id}/virement-requests/{request_id}/reversement/history`
   returns the standard cursor envelope, default 60 and maximum 100.

Extend the existing virement detail with one `reversement` projection containing
the required amount, declared amount, `not_required|required|declared` status,
current declaration and server-derived allowed actions. This is a projection, not
a persisted workflow state. It is `null` until an approved virement has a current
external confirmation. Supervisor and Validator can read it; only an active Agent
may declare or correct. Admin and foreign-resource requests remain denied.

Every mutation acquires the existing global advisory lock first, then authenticates
and authorizes, locks/rechecks the Activity version, exact approved virement,
approved disbursement/final-spending basis, latest virement confirmation and latest
reversement declaration. Reject absent or stale confirmation, changed financial
basis, stale version, future/too-early date and unknown schema. Equality between
allocation and spending produces the supported zero requirement. Spending above
allocation is an unsupported insufficiency/discrepancy case and must fail closed;
it must not be presented as “nothing owed” merely because the formula clamps at
zero. A declaration against a supported zero requirement is rejected.
Insert the declaration, increment the Activity version and append the structured
business audit in one transaction. Audit/constraint/commit failure rolls back all
three effects.

Once any reversement declaration exists, PTA-3D confirmation correction must fail
closed. Serialize confirmation-correction versus reversement-declaration races so
the correction may commit first and become the bound basis, or the reversement may
commit first and permanently block that correction. Do not add speculative closure
columns or checks; the later closure slice will consume the settled projection and
block further corrections.

## 4. React experience

Extend the existing French realization workspace and virement card using
`docs/inspiration/realisations/realisation.png` plus the approved v3 tokens. Show a
compact reconciliation of approved allocation, final spending, amount to return
and amount declared returned.

- For `0 F CFA`, show “Aucun reversement requis” and no form.
- For a positive undeclared amount, show the fixed amount, required date, optional
  reference/comment and an explicit declaration checkbox.
- After declaration, show actor/time and permit only a reasoned date/note
  correction to Agents. Reviewers receive the same read-only evidence.
- Show immutable cursor history using Router-owned `reversementCursor` state.

Reuse the current Query mutation and reconciliation seam. Invalidate Activity,
virement, reversement history, execution list and planning data after success or an
uncertain conflict. Keep retries disabled, clear protected state on access loss and
never queue or replay an offline mutation. Retain accessible labels, focus,
loading/empty/error states, Sonner feedback and exact XOF formatting. Add no page,
modal, upload control or document requirement.

## 5. Focused test-first verification

Implement in vertical red/green slices through public API and UI seams. These eight
gates are sufficient; do not expand them into a generic finance test program.

| Gate | Expected evidence |
| --- | --- |
| R01 calculation | Worked examples prove `3,000,000 - 2,700,000 = 300,000 F CFA` and equal allocation/spending produces `0 F CFA`, no declaration and no fake audit row. Overspending fails closed instead of appearing settled. |
| R02 authorization and scope | Only active Agents mutate; Supervisor/Validator read; Admin, wrong role, CSRF/origin failure, foreign Activity/request and guessed IDs deny server-side. |
| R03 declaration and correction | Amount never comes from the request; exact positive declaration succeeds; invalid chronology/future date/no-op correction fail; reasoned corrections preserve immutable ordered history and large exact XOF. |
| R04 frozen basis | Missing/unapproved/stale virement or confirmation, changed allocation/spending/source chain and schema/trigger tamper fail closed. Existing confirmation correction becomes unavailable after reversement starts. |
| R05 atomicity and races | Deterministic PostgreSQL barriers prove one winner for duplicate declarations, correction-versus-declaration and deactivation-versus-declaration, without deadlock. Audit, real constraint and outer-commit failures leave no partial row, version or audit. |
| R06 migration | Clean install and exact `0013_pta3d` predecessor upgrade preserve all earlier facts, add zero reversement rows and allow the first valid declaration. Evidence-bearing downgrade refuses; predecessor runtime rejects successor schema. |
| R07 React behavior | Unit and one focused real-Chromium journey cover zero/positive display, declaration, correction/history, reviewer read-only state, Query reconciliation, browser navigation and offline non-replay. |
| R08 regression and quality | PTA-3D confirmation plus adjacent PTA-3A–3C focused regressions pass. Run REST/OpenAPI inventory, Ruff format/lint, mypy, ESLint, Stylelint, Prettier, Vitest and build. Because the router, shared model and exact schema guard change, run the final combined backend regression once on the reviewed candidate. |

Use only synthetic identities, test mail and task-owned disposable PostgreSQL and
browser resources. Record candidate source/image, exact commands, counts and real
results together. Missing migration, race, rollback or browser evidence blocks
completion. PC1/PC2 remain pending.

## 6. Mandatory independent review and completion

After implementation and all evidence are ready, hand the candidate to a separate
agent who did not implement it. That agent leads a review-only phase, does not edit
implementation files, and treats the plan, diff, surrounding PTA-3C/3D code,
migration, schema guard, transaction ordering and test claims as untrusted. It
reports gaps, bugs, regressions and security weaknesses with severity, file/line
evidence, impact, smallest correction and missing verification.

The implementer fixes accepted findings, reruns the affected checks and returns the
candidate to the same reviewer for focused re-review. Completion remains blocked if
no separate reviewer is available or any blocking finding or mandatory evidence
gap remains. Only after PASS: update DEC-119/roadmap and one concise status record,
review the full diff, run `git diff --check`, commit, and report
`PTA_3E_COMPLETE` or `PTA_3E_FAILED`, evidence, commit and clean/preserved worktree
state. Stop without starting Activity closure or another slice.
