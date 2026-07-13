# MJL Phase 14 Final Report

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Final verdict

`CLIENT_VALIDATION_NOT_RUN`

## Summary

Phase 14 prepared client validation, demo hygiene, decision capture, feedback
classification, and final reporting artifacts. No real client validation
session or client feedback was provided, so the phase cannot claim client
approval.

This is not production release closure.

## Demo readiness result

`DEMO_READY_WITH_MINOR_GAPS`

The demo is ready for structured business validation with documented local data
debt and production-release blockers kept outside the demo verdict.

## Demo hygiene result

`DEMO_HYGIENE_READY_WITH_NOTES`

The demo hygiene checklist documents local/test noise, credentials handling,
do-not-show items, and do-not-promise items.

## Demo rehearsal result

`DEMO_REHEARSAL_PASS_WITH_NOTES`

The rehearsal result is based on Phase 13 internal UAT evidence, Phase 14 demo
runbook preparation, and final Phase 14 verification. No client session was
run.

## Validation session status

No real client validation session has been recorded.

## Client validation result

`CLIENT_VALIDATION_NOT_RUN`

No client approvals, rejections, or change requests are recorded.

## Decision log status

`PREPARED_PENDING_CLIENT_FEEDBACK`

The decision log is pre-filled with required validation decisions and all
business decisions remain pending unless explicitly deferred as production
preparation topics.

## Change request status

`NO_CLIENT_CHANGE_REQUESTS_RECORDED`

The change-request classification table exists, but no real client change
request was provided.

## Issues requiring follow-up

- Run the actual client validation session.
- Record client feedback exactly.
- Classify every decision and every change request.
- Decide whether to clean historical unresolved local audit rows before a deep
  audit-data demonstration.
- Keep production-release blockers separate from feature validation.

## Remaining client decisions

- Final permission matrix.
- Role labels and operational wording.
- Scope model wording by Partenaires / Programmes.
- Project creation/editing expectations.
- Activity workflow labels.
- Expense / Decaissement workflow labels.
- `Valide definitivement` versus `Decaisse` wording.
- Physical execution formula wording.
- Financial execution formula wording.
- Dashboard KPI labels and exposure by role.
- Alert thresholds.
- Report/export list, columns, ordering, wording, and export rights.
- Final official report canevas.
- Document upload/download expectations.
- Timeline/history/audit presentation.

## Remaining production-release blockers

- Production email transport.
- Public/base URL.
- Production secrets.
- Backup/restore procedure.
- Monitoring/log retention.
- Final deployment storage/hosting procedure.
- Final client-approved permission matrix.
- Final official report/export templates.

## Tests run

- `git status --short --untracked-files=all`: baseline worktree was clean
  before Phase 14 documentation edits.
- `git diff --check`: passed.
- `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`:
  passed for all MJL PHP files.
- `npm run`: confirmed only `test:e2e` is available.
- `composer test`: unavailable; no `composer.json`.
- `vendor/bin/phpunit`: unavailable.
- `npm test`: unavailable.
- `npm run test`: unavailable.
- `npm run e2e`: unavailable.
- `docker compose ps`: Dolibarr and MariaDB running.
- `bootstrap_poc.php`: completed for local/dev setup.
- `seed_sample_data.php`: completed.
- `audit_schema_0.2.0.php`: passed.
- `audit_schema_0.3.0.php`: passed.
- `audit_schema_0.4.0.php`: passed.
- `audit_schema_0.5.0.php`: passed.
- `audit_schema_0.8.0.php`: passed with known legacy lecteur warnings.
- `audit_schema_0.9.0.php`: passed.
- `audit_schema_0.10.0.php`: passed.
- `acceptance_sample_data.php`: passed.
- `smoke_scope_model.php`: passed.
- `smoke_activity_workflow.php`: passed.
- `smoke_expense_validation.php`: passed.
- `smoke_traceability_exports.php`: passed.
- `audit_unresolved_scope.php`: failed on historical local unresolved
  workflow/action rows and generic report audit anchors; classified as local
  data debt because fail-closed E2E checks passed.
- `check_production_readiness.php`: source-provable checks passed; expected
  production deployment confirmations remained `UNKNOWN`.
- `npm run test:e2e`: sandboxed run failed before app assertions with
  `spawnSync /bin/sh EPERM`; rerun with Docker access passed with 125 tests in
  12.5 minutes.
- Stale-term scan: completed; new Phase 14 prompt/checklist hits are classified
  in `docs/mjl-stale-reference-audit.md`.

## Files changed

- `docs/prompts/mjl-phase-14-client-validation-preparation-prompt.md`
- `docs/mjl-client-demo-readiness-checklist.md`
- `docs/mjl-client-demo-hygiene-checklist.md`
- `docs/mjl-client-demo-runbook.md`
- `docs/mjl-client-demo-rehearsal-results.md`
- `docs/mjl-client-decision-log.md`
- `docs/mjl-client-validation-results.md`
- `docs/mjl-client-change-requests.md`
- `docs/mjl-phase-14-final-report.md`
- `docs/mjl-docs-index.md`
- `docs/mjl-implementation-summary.md`
- `docs/mjl-stale-reference-audit.md`

## Recommended next phase

Run the actual client validation session. Do not proceed to production release
readiness closure until client validation has been recorded and classified.
