# MJL Financement v2 — Phased Implementation Plan

## Status and approach

Implementation is `NOT_AUTHORIZED`. Each phase requires separate user
authorization. The plan uses six coherent phases and incremental consolidation
inside `custom/mjlfinancement`; it assumes no frontend framework migration,
Dolibarr core edit, schema rewrite, or business-contract change.

Baseline: `main` at `e8bfb15b5c1f359f45824ff14f7d72e869386587`.

## Phase 0 — Prerequisites and blocking tracks

- Goal: resolve or explicitly bound only decisions/integrity work that blocks
  a later phase or release.
- Gap IDs: GAP-021, GAP-028, GAP-029; track GAP-024 without forcing
  release-only operations work ahead of Phase 1.
- Journeys/areas: official reports, advanced audit/history, scope-integrity
  diagnostics.
- Likely files: scope/integrity validator and active implementation
  documentation; data remediation requires a separately authorized procedure.
- Protected behavior: fail-closed scope, four roles, existing audit history,
  generic export contracts.
- Dependencies: client report/right decisions; intentional tombstone policy;
  current data investigation.
- Assumptions: ASM-002, ASM-010; ASM-003 remains release-only.
- Blocking decisions: donor canevas/rights and any new audit overlay.
- Explicit exclusions: UI implementation, data cleanup, migration, new role,
  production deployment.
- Tasks:
  1. Correct validator coverage for supported report anchors.
  2. Specify history behavior when a parent object is deleted.
  3. Investigate 236 genuine unresolved targets without granting scope.
  4. Record client decisions only when supplied.
- Existing tests: scope model, traceability/export smoke, dashboard/audit and
  report E2E specs.
- New journeys: corrected unresolved-scope audit; retained/deleted object
  audit history; report-anchor resolution.
- Failure scenarios: unsupported type, cross-entity target, missing target,
  false-positive report anchor.
- Permission scenarios: unresolved rows remain Admin-only/fail-closed.
- Targeted validation: corrected validator plus focused scope/audit tests.
- Integration gate: Phase 5 integrity and release review.
- Full-suite trigger: any scope, permission, workflow-audit, or export-anchor
  behavior change.
- Rollback: revert validator/code slice; never roll back by deleting audit
  history or widening access.
- Exit criteria: each blocker has a confirmed status and validation path;
  `FACT-001` remains open until a corrected clean result.
- Risks: integrity loss, audit-history loss, false closure.
- Required authorization: separate technical authorization and, for data
  remediation, separate destructive/data-change authorization.

## Phase 1 — Shared visual foundation and application shell

- Implementation status: `COMPLETED_AND_VALIDATED` on 28 July 2026; see
  [`mjl-design-system-v2-phase1-implementation-report.md`](mjl-design-system-v2-phase1-implementation-report.md).
- Goal: establish tokens, focus, reusable shell/navigation/header/action
  foundations before page-specific styling.
- Gap IDs: GAP-003, GAP-004, GAP-005, GAP-006, GAP-026, GAP-027, GAP-030.
- Journeys/areas: entry into MJL, role navigation, page headers, guarded
  forbidden return, keyboard traversal.
- Likely files:
  [`mjl_app.css.php`](../../custom/mjlfinancement/css/mjl_app.css.php),
  [`mjl_navigation.lib.php`](../../custom/mjlfinancement/lib/mjl_navigation.lib.php),
  and the shared hook/shell helpers.
- Protected behavior: native boundary, capability-derived navigation, direct
  guards, existing URLs, French terminology.
- Dependencies: approved v2 tokens; ASM-006 conservative default.
- Assumptions: current palette/type/pictos remain provisional.
- Blocking decisions: none; final brand approval is not required to map
  semantic tokens.
- Explicit exclusions: workflow forms, tables, business data, auth/email,
  mobile parity, backend authorization.
- Tasks: semantic CSS variables, focus contract, shell/header renderer,
  `aria-current`, skip access, action hierarchy, scoped CSS, compatibility
  wording removal on touched shell surfaces.
- Existing tests: native-boundary, workspace-shell, role-dashboard navigation.
- New journeys: keyboard skip/navigation, active-location semantics, forbidden
  return, shell at desktop/tablet/mobile widths.
- Failure scenarios: no accessible children, expired session, restricted
  direct route, long French labels.
- Permission scenarios: each of four roles plus unauthorized user; hidden
  sections must remain directly guarded.
- Targeted validation: PHP syntax, shell/navigation specs, focused
  keyboard/viewport checks.
- Integration gate: representative page from every primary section.
- Full-suite trigger: change to hook, native guard, navigation capability
  source, or global CSS boundary.
- Rollback: revert token/shell slice while retaining prior helpers until the
  gate passes.
- Exit criteria: shared shell is consistent, focus visible, no native leakage,
  no route/permission behavior change.
- Risks: global CSS leakage and navigation concealment.
- Required authorization: separate Phase 1 implementation authorization.

## Phase 2 — Operational components and reusable states

- Goal: consolidate repeated forms, decisions, statuses, tables, filters,
  timelines, alerts, and system states.
- Gap IDs: GAP-007, GAP-008, GAP-009, GAP-010, GAP-011, GAP-012, GAP-015,
  GAP-026, GAP-030.
- Journeys/areas: list/filter/open, edit/submit/recover, decision confirmation,
  empty/error/permission handling, history review.
- Likely files: shared MJL libraries plus scoped CSS/JavaScript; page files
  only as vertical adopters.
- Protected behavior: POST payloads/tokens, status values, permission checks,
  workflow transitions, server filtering.
- Dependencies: Phase 1 foundations.
- Assumptions: no new status, search domain, bulk action, or toast authority.
- Blocking decisions: none for shared primitives.
- Explicit exclusions: rewriting every page, schema changes, global search,
  bulk mutation, document preview/removal.
- Tasks: shared status renderer, field/error summary, decision panel/dialog,
  table/filter/pagination contract, empty/no-result/loading/partial-error
  states, timeline/alert renderers.
- Existing tests: activity/expense/finance workflow, table/export, alert,
  contextual-exchange specs.
- New journeys: invalid multi-field form recovery, dialog keyboard/focus,
  filtered-empty vs initial-empty, pagination scope, partial table/card error.
- Failure scenarios: validation error, server error, stale token, unavailable
  data, no results.
- Permission scenarios: hidden action plus rejected direct POST; read-only and
  forbidden variants.
- Targeted validation: adopted component journey specs and PHP syntax.
- Integration gate: one operational list, one complex form, one decision
  panel, one timeline.
- Full-suite trigger: shared status/action/filter payload behavior changes.
- Rollback: component-by-component; retain server markup fallback.
- Exit criteria: reusable components cover all required states and preserve
  existing contracts.
- Risks: accidental payload/status changes and over-abstraction.
- Required authorization: separate Phase 2 implementation authorization.

## Phase 3 — Core MJL journeys

- Goal: apply shared patterns to complete business journeys without changing
  their rules.
- Gap IDs: GAP-013, GAP-014, GAP-016, GAP-017, GAP-018, GAP-019, GAP-020,
  GAP-021 where decided, GAP-027, GAP-029 where audit history is shown,
  GAP-030.
- Journeys/areas: partner/project; activity lifecycle; expense validation and
  disbursement; financing; documents; dashboards; alerts; reports/history.
- Likely files: relevant route pages and existing domain/shared libraries
  under `custom/mjlfinancement`.
- Protected behavior: all scope/entity/no-self/workflow/document/export
  invariants.
- Dependencies: Phases 1–2; report-specific work depends on GAP-021 decisions.
- Assumptions: ASM-002, ASM-008, ASM-009, ASM-010.
- Blocking decisions: only donor-specific reports and any new audit overlay;
  generic journeys remain implementable.
- Explicit exclusions: preview/removal, PDF/Word, fifth role, new workflow
  status, data remediation.
- Tasks: migrate coherent journeys, prioritize next action/evidence/history,
  unify document states, deepen KPI context, preserve generic exports.
- Existing tests: all project/activity/expense/finance/document/dashboard/
  alert/report E2E specs.
- New journeys: complete correction loops with new UI states, page-level error
  recovery, pagination/filter retention, contextual evidence/history.
- Failure scenarios: missing/unavailable evidence, over-budget, invalid scope,
  export failure, local dashboard failure.
- Permission scenarios: all four roles, wrong-role direct URL/POST, scope
  tampering, no-self-action.
- Targeted validation: affected vertical journey specs, PHP syntax, relevant
  read-only audits where proven safe.
- Integration gate: combined project → activity → expense → report journey.
- Full-suite trigger: shared route, workflow, document, export, or dashboard
  changes across multiple objects.
- Rollback: journey slices; presentation rollback must not rewrite data.
- Exit criteria: each migrated journey passes success/failure/permission
  scenarios and preserves export/audit behavior.
- Risks: business regression, density loss, document/audit leakage.
- Required authorization: one or more explicitly scoped Phase 3 slice
  authorizations.

## Phase 4 — Authentication, communication, responsive, and accessibility hardening

- Goal: complete auth/email presentation and prove practical responsive and
  keyboard behavior.
- Gap IDs: GAP-022, GAP-023, GAP-025, GAP-026, GAP-027, GAP-030.
- Journeys/areas: login, invitation, forgotten/reset, session/account states,
  workflow emails, tablet/mobile/zoom/keyboard across critical journeys.
- Likely files: auth templates/CSS, auth/email helpers, shared shell/components.
- Protected behavior: invitation-only access, non-enumeration, token security,
  Admin-only invitation sending, safe URLs.
- Dependencies: stable Phase 1 tokens and Phase 2 states; ASM-003/005/011.
- Assumptions: production transport is not proven; desktop-first, no offline.
- Blocking decisions: none for local implementation; runtime evidence is
  required for exit.
- Explicit exclusions: production secrets/configuration, public
  registration, offline mode.
- Tasks: unify token/account/session states, email structure/plain text,
  responsive drawer/reflow/tables/actions, focus order/restore, reduced motion.
- Existing tests: auth/access and email-template specs.
- New journeys: expired/invalid/revoked/already-used invitation; session ended;
  account disabled; keyboard-only auth/workflow; 390/768/1024/1366 and 200%
  zoom.
- Failure scenarios: email send failure, invalid token, interrupted session,
  narrow dense table, long French content.
- Permission scenarios: non-admin invitation attempt, disabled account,
  unauthorized direct auth-adjacent route.
- Targeted validation: auth/email specs plus focused responsive/accessibility
  journeys and manual checks.
- Integration gate: invitation → first access and forgotten-password journeys
  at desktop/mobile widths.
- Full-suite trigger: authentication hook, token, session, or shared responsive
  shell change.
- Rollback: template/style slices; retain secure backend behavior.
- Exit criteria: required states are consistent and runtime matrix results are
  recorded without claiming unsupported conformance.
- Risks: account disclosure, focus loss, email rendering variance.
- Required authorization: separate Phase 4 implementation authorization.

## Phase 5 — Integration validation and release readiness

- Goal: validate all journeys together and close or explicitly retain release
  blockers.
- Gap IDs: GAP-021, GAP-024, GAP-025, GAP-026, GAP-029, GAP-030.
- Journeys/areas: cross-role regression, scope/integrity, documents, exports,
  auth, accessibility, responsive, deployment/operations.
- Likely files: tests and active readiness/deployment documentation; production
  configuration remains external.
- Protected behavior: every authoritative invariant and stable contract.
- Dependencies: prior phases, operations/client confirmations, corrected
  `FACT-001`.
- Assumptions: all eight must have current statuses.
- Blocking decisions: production permissions/reports/operations and clean
  integrity evidence.
- Explicit exclusions: release approval itself and unauthorized production
  changes.
- Tasks: targeted regressions, full suite when stable, human accessibility,
  cross-browser/performance review, corrected integrity validation,
  production-readiness evidence review.
- Existing tests: full 130-test E2E inventory and relevant audits/smokes.
- New journeys: only uncovered cross-phase, accessibility, responsive, and
  release-gate cases; avoid duplicate label-only tests.
- Failure scenarios: partial subsystem failure, stale data, deployment guard
  missing, transport failure, restore failure.
- Permission scenarios: full role/scope/direct-route/POST matrix.
- Targeted validation: affected areas first.
- Integration gate: full E2E plus approved safe audits/smokes, human review,
  deployment evidence.
- Full-suite trigger: mandatory for the final integration candidate.
- Rollback: release candidate rollback by reversible application slices; no
  destructive schema/data rollback.
- Exit criteria: no unresolved release blocker; signed operations/client
  confirmations; immutable contracts and audit evidence verified.
- Risks: false readiness claim and environment-specific failure.
- Required authorization: validation authorization does not equal release
  approval; release remains a separate human decision.

## Recommended first implementation candidate

**Phase 1 — Shared visual foundation and application shell**

- Why first: no finding is `BLOCKS_IMPLEMENTATION`; this phase has the highest
  reuse and creates the safe presentation boundary for every later journey.
- Preconditions: recapture a clean/qualified baseline, confirm v2 remains
  immutable, and authorize Phase 1 explicitly.
- Included gaps: GAP-003, GAP-004, GAP-005, GAP-006, GAP-026, GAP-027,
  GAP-030.
- Included journeys: enter MJL, navigate by role, identify current location,
  read page purpose/actions, recover from forbidden routes.
- Exclusions: business forms/workflows, data, permissions, documents, exports,
  auth/email, full mobile parity.
- Risk reduction: prevents page-by-page CSS divergence and establishes focus,
  tokens, semantics, and rollback before high-risk workflows migrate.
- Required tests: shell/native-boundary/navigation plus new keyboard and
  representative viewport checks.
- Permission scenarios: four production roles, unauthorized user, no
  accessible child, restricted direct route.
- `FACT-001`: does not need resolution before Phase 1, but remains mandatory
  before integrity/release exit.
- Assumptions required first: none; ASM-006 uses the approved conservative
  current-brand default.
