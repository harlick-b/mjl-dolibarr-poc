# PTA-4C — Project closure readiness and implementation plan

Authority: DEC-090/123, the approved PTA brief, DEC-102, the security baseline
and completed PTA planning/execution through PTA-4B.

Historical implementation contract. PTA-4C completed on 2026-11-02; see
[status 30](30-pta4c-implementation-status.md).

## Audit verdict

`PTA_4C_READY_FOR_IMPLEMENTATION`

DEC-090 already settles the business rule: a Validator may close a Project only
when no Activity or required financial step remains unfinished. The completed
withdrawal and Activity-closure workflows now provide the two terminal Activity
states needed to apply that rule. The current guard still rejects every Project
that has ever contained an Activity, so the approved lifecycle cannot finish.

## Outcome and boundaries

Keep the existing Validator-only Project PATCH responsibility. It may close an
empty Project or a Project whose Activities, across every annual PTA, are all
`closed` or `withdrawn`. Any other Activity state blocks closure. `closed` is the
existing proof that Operations and required financial settlement completed;
`withdrawn` is the existing terminal path that rejects execution or financial
obligations. Do not duplicate those completed aggregate checks in Project
closure.

Preserve the current version conflict, CSRF/origin, authenticated-role,
transactional audit and shared advisory-lock behavior. Keep the existing stable
`project_not_empty` conflict code for callers; after this slice it means that at
least one contained Activity remains nonterminal.

Add no route, table, column, migration, page, component or abstraction. The
existing React Project action and TanStack Query invalidation remain the UI.
Project reopening, Partner deactivation, Activity restoration, reminders,
documents, exports, Partner access, real accounts and production remain
excluded.

## Focused verification

- Empty Projects still close; only Validators may close them; stale and replayed
  requests still fail.
- Projects containing only closed Activities close, and Projects containing only
  withdrawn Activities close.
- Every nonterminal Activity state represented by adjacent planning/execution
  coverage continues to block closure; one terminal Activity cannot hide an
  unfinished sibling.
- Deterministic PostgreSQL ordering proves Activity closure and Project closure
  serialize without closing over unfinished work.
- Project-close audit and commit rollback remain atomic; creating an Activity
  concurrently with closure remains safe.
- Focused planning, withdrawal, transfer and Activity-closure regressions pass.
  The unchanged React Project action and Query invalidation retain focused
  Vitest coverage. Run Ruff, strict mypy, OpenAPI validation and
  `git diff --check`. No migration compatibility run is required because the
  schema is unchanged.

## Mandatory independent review

After implementation and verification, a separate agent that did not implement
the change leads a read-only review of this contract, the actual diff,
surrounding terminal-state invariants and evidence. It reports gaps with
severity, file/line evidence, impact and the smallest correction. The implementer
fixes accepted findings and returns the candidate to the same reviewer for
focused re-review. Do not declare PTA-4C complete until blocking findings and
verification gaps are resolved. Stop after PTA-4C.
