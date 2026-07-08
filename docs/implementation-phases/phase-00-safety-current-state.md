# Phase 0 - Baseline And Target Spec

## Goal

Lock the production target, compare it to the current POC, and create the
execution gates for later phases without changing runtime behavior.

## Scope

- Preserve the current repository state and dirty/untracked work.
- Create target, gap, and readiness planning documents.
- Create per-phase execution files for the production-readiness work.
- Update durable domain vocabulary for the now-confirmed production roles and
  Partenaires / Programmes terminology.

## Implementation notes

- No PHP, SQL, JS, CSS, E2E, or runtime files should be changed in this phase.
- The existing untracked `docs/mjl-current-app-functional-map.md` is preserved
  as current-state evidence.
- Later phases must use these docs as gates, not as proof of implementation.

## Verification

- `git status --short`
- Documentation diff/status review

## Validation record

Validated on 2026-07-08.

Files changed in this phase:

- `CONTEXT.md`
- `docs/mjl-target-client-spec.md`
- `docs/mjl-current-vs-target-gap-analysis.md`
- `docs/mjl-production-readiness-plan.md`
- `docs/implementation-phases/phase-tracker.md`
- `docs/implementation-phases/phase-00-safety-current-state.md`
- `docs/implementation-phases/phase-01-role-scope-foundation.md`
- `docs/implementation-phases/phase-02-access-navigation-admin.md`
- `docs/implementation-phases/phase-03-partners-projects-financing.md`
- `docs/implementation-phases/phase-04-activity-workflow.md`
- `docs/implementation-phases/phase-05-expense-disbursement-workflow.md`
- `docs/implementation-phases/phase-06-documents-timeline-audit.md`
- `docs/implementation-phases/phase-07-dashboards-alerts-reports.md`
- `docs/implementation-phases/phase-08-security-production-readiness.md`
- `docs/implementation-phases/phase-09-seed-tests-documentation.md`

Validation commands:

- `git status --short` showed documentation-only changes plus the preserved
  untracked current-state map.
- `git diff --check` passed.

Skipped checks:

- PHP syntax checks were skipped because no PHP files changed.
- Schema, smoke, and E2E checks were skipped because Phase 0 has no runtime,
  SQL, workflow, document, export, or UI behavior changes.

Known limitations:

- Phase 0 is a planning baseline and does not implement production behavior.
- `docs/mjl-current-app-functional-map.md` remains untracked current-state
  evidence and must not be overwritten without explicit intent.

## Exit status

Implemented as documentation-only baseline.
