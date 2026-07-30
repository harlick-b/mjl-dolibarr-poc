# MJL Financement v2 — Phase 3 Implementation Report

## Verdict

`MJL_V2_PHASE3_IMPLEMENTED_PENDING_CROSS_PHASE_ACCESSIBILITY_VALIDATION`

## Remediation evidence status

The post-Phase-3 remediation was implemented and reviewed at the exact
pre-evidence commit
`1732b694614661976fbed371f45e64f698f0147c`. All three fixed-point reviews
reported 0 High, 0 Medium, and 0 Low findings on that tree. The automated
verification recorded below was also run against that tree before this
evidence-only report update.

Phase 3 implements the three authorized journey slices from the recorded
rollback base `ffeed1e58ef209c8b65e41274710b895cc1b208c`. The implementation
and automated repository gates are complete. This verdict is not a
phase-scoped accessibility validation, WCAG conformance claim, production
readiness finding, release approval, or deployment authorization.

## Checkpoints

| Slice | Commit |
| --- | --- |
| Phase 3A — portfolio and activity journeys | `0399646` |
| Phase 3B — expense and evidence journeys | `06fe50c` |
| Phase 3C — finance and supervision integration | `e81f8b1` |
| Finance feedback contract correction | `778cc5b` |
| Shared recovery-registry extraction | `3a2c236` |
| Initial remediation closure | `26e06f1` |
| Validation and document-link hardening | `8b9bbf9` |
| Route and guard invariant proof | `a642c16` |
| Semantic update-comment edge cases | `88dbf50` |
| Workflow cleanup identity discrimination | `1732b69` |

The slices can be rolled back in reverse order to the recorded base. No
Dolibarr core file, schema, migration, dependency, deployment state, or
production data was changed.

## Implemented journeys

- Phase 3A adds scoped, deterministic, paginated partner, project, and activity
  journeys; shared summaries, recovery, next actions, document states, and
  contextual histories.
- Phase 3B applies the shared presentation, recovery, filtering, pagination,
  evidence, decision, and timeline contracts to expenses without changing
  workflow stages, financial projections, no-self rules, permissions, POST
  names, or guarded download rules.
- Phase 3C applies the contracts to envelopes, budget lines, and fund receipts;
  retains projectless programme receipts; enriches dashboard card context and
  local unavailable states; preserves successful regions on source failure;
  and improves report summaries, generation feedback, guarded delivery
  explanation, and permission-preserving audit history.
- The shared integrity target registry now includes
  `mjlfinancement_report` and is used by both the audit script and dashboard
  diagnostic. A transaction-rolled-back smoke proves a valid report anchor is
  accepted and a missing report target remains detectable.
- Finance failures now use closed, allowlisted validation, database, timeline,
  and unknown categories. Each of the nine route/action sources supplies its
  category explicitly, and recovery actions are limited to the matching
  route-owned form/action allowlist.
- Activity, project, expense, and finance recovery wrappers now share one pure,
  fail-closed registry lookup/grouping implementation while retaining their
  exact route-owned registries.
- The journey summary, document panel, and enriched dashboard availability
  behavior are catalogued with purpose, permitted and prohibited use, layout,
  behavior, accessibility, French wording, role visibility, and E2E
  expectations.
- Finance update comments reject semantically blank, invalid UTF-8, and
  non-stabilizing entity-encoded content, and public update wrappers fail
  closed when the required audit reason is absent.

## Protected contracts

- Entity, active-partner, object, route, and POST guards remain server-side.
- Finance invariants, exact workflow transitions, stage actors/dates, audit
  rows, no-self validation, and projectless fund receipts remain covered.
- Official report permissions, required filters, columns, ordering, filenames,
  CSV/XLSX bytes, POST actions, and on-demand delivery behavior are unchanged.
- Supporting documents continue through guarded MJL download routes; no public
  ECM/document link was added.
- The approved v2 snapshot was not modified. Its tree hash remains
  `98d0053a934b83b4a21a6c67207e86b3c89fe7d0`.

## Post-remediation verification

| Check | Result |
| --- | --- |
| Phase 3 remediation journey spec | 33/33 passed |
| Convention, budget-line, and fund-receipt regression specs | 21/21 passed |
| Combined partner → project → activity → expense → financing → report journey | Passed |
| Complete `npm run test:e2e` gate | 198/198 passed in 9.6 minutes |
| Scope model smoke | Passed |
| Activity workflow smoke | Passed |
| Expense validation smoke | Passed |
| Traceability/export smoke | Passed |
| Integrity target smoke | Passed |
| Dashboard/workspace/alerts partial-failure smoke | Passed |
| PHP 7.4 syntax for all 14 changed PHP files | Passed |
| Phase 3 JavaScript syntax | Passed |
| `git diff --check` | Passed |
| Approved snapshot comparison against rollback base | Unchanged |
| Fixed-point Standards review | 0 High, 0 Medium, 0 Low |
| Fixed-point Specification review | 0 High, 0 Medium, 0 Low |
| Fixed-point Security review | 0 High, 0 Medium, 0 Low |

The complete browser gate includes all four roles, direct URL and POST
denials, CSRF, cross-scope and cross-entity failures, no-self decisions,
stale-action rejection, deterministic filters and pagination, empty and
partial states, guarded documents, workflow projections, official exports,
390/768/1024/1366 automated layout checks, keyboard behavior, and
JavaScript-disabled fallback.

## Integrity debt retained

The read-only unresolved-scope audit exited non-zero at both evidence points
for the same sole category,
`workflow_action_without_resolvable_target`. The baseline captured at
`2026-07-30T15:41:24.583Z` contained 468 rows. The final capture at
`2026-07-30T18:34:01+01:00` contained 508 rows. The 40-row increase is fully
accounted for by the two authorized complete E2E runs after the baseline:
each run leaves 20 convention/document/project audit rows from ten temporary
fixture targets after those target objects are removed.

These rows are local historical/test data-remediation debt, not a new
category, scope relaxation, or report-registry failure. No unresolved row was
deleted or rewritten because data remediation is outside Phase 3. The
transaction-rolled-back integrity smoke passed on the reviewed tree, proving
that a valid report anchor resolves and a missing report target remains
detectable.

## Remaining gates

- Cross-phase manual accessibility validation and sign-off remain pending on
  the final post-Phase-3 screens.
- Production operator confirmations remain pending, including email/base URL,
  secrets, final permissions and report templates, backup/restore,
  monitoring, and log retention.
- The known unresolved local audit rows require a separately authorized
  investigation or remediation; fail-closed behavior remains in force.

## Accessibility sequencing boundary

The user authorized Phase 3 to proceed before the unsigned Phase 2 manual
accessibility matrix was completed. That sequencing override does not convert
any pending Phase 2 evidence to passed. Phase 4 must validate the final
post-Phase-3 screens across the cross-phase manual matrix; recordings of the
older Phase 2 UI would not prove the resulting interface.

Until that evidence is completed and signed, this report must retain the
verdict above and must not be used as an accessibility, production-readiness,
release, merge, or deployment approval.
