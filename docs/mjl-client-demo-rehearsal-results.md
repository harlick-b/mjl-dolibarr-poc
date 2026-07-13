# MJL Client Demo Rehearsal Results

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Executive verdict

`DEMO_REHEARSAL_PASS_WITH_NOTES`

No live client session has been recorded. The rehearsal verdict is based on
current Phase 13 internal UAT evidence, the Phase 14 runbook, and final Phase
14 verification results recorded in `docs/mjl-phase-14-final-report.md`.

## Environment

- Local Docker Dolibarr/MariaDB environment.
- Local/dev fixture data only.
- Phase 13 evidence date: July 13, 2026.
- Phase 14 verification date: July 13, 2026.

## Demo users tested

Evidence relies on fixture users exercised by Phase 13 internal UAT and Phase
14 verification:

- `admin.poc`.
- `agent.mjl`.
- `superviseur.n1`.
- `superviseur.n2`.
- `dpaf.mjl`.
- `lecteur.audit`.

## Scenario rehearsed

- UNICEF main scenario from funding to traceable export.
- Programme Redevabilite scope-isolation scenario.
- Dashboard, alert, document, guarded download, timeline, and CSV/XLSX export
  evidence.

## Steps completed

- Internal UAT in Phase 13 covered invitation/access, scope isolation, project
  creation, finance/budget, activity workflow, expense/disbursement,
  documents, timeline/exchanges, alerts, dashboards, and reports/exports.
- Phase 14 created a repeatable client demo runbook and hygiene checklist.
- Phase 14 final verification results are recorded in the final report.

## Exports generated

Phase 13 E2E verified CSV/XLSX report generation, stable filenames, French
headers, server-side filters, authorization, scope behavior, and export audit.
Any exports generated during final Phase 14 checks are recorded in
`docs/mjl-phase-14-final-report.md`.

## Evidence captured

- `docs/mjl-internal-uat-results.md`.
- `docs/mjl-phase-13-final-report.md`.
- `docs/mjl-client-demo-runbook.md`.
- `docs/mjl-client-demo-readiness-checklist.md`.
- `docs/mjl-client-demo-hygiene-checklist.md`.
- `docs/mjl-phase-14-final-report.md`.

## Issues found

- Historical unresolved local audit rows and generic report audit anchors remain
  local data debt.
- Production SMTP, public/base URL, production secrets, backup/restore,
  monitoring/log retention, and final deployment procedure remain outside this
  validation phase.
- Final client decisions remain pending because no real client session has been
  recorded.

## Fixes applied

No production code fixes were applied in Phase 14. Documentation and validation
evidence artifacts were prepared.

## Remaining demo risks

- Client may reject or request changes to permissions, workflow labels, KPI
  wording/formulas, alert thresholds, or report columns.
- Live production email/invitation behavior cannot be represented as
  production-ready until production SMTP and public/base URL are configured.
- Historical local audit data debt should be cleaned before using the local
  database for a detailed audit-data demonstration.

## Go / No-Go for client demo

`GO_WITH_NOTES`

Proceed to the actual client validation session. Do not claim client approval
or production release readiness.
