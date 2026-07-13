# MJL Client Demo Readiness Checklist

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Executive verdict

`DEMO_READY_WITH_MINOR_GAPS`

The app is ready for a controlled client feature-validation demo if the local
demo stack is prepared and the known gaps below are kept explicit. This is not
a production release verdict.

## Repository status

- Baseline worktree before Phase 14 documentation edits: clean.
- Phase 14 changes are documentation, prompt evidence, demo preparation, and
  validation classification only.
- Dolibarr core files are not part of the Phase 14 change set.

## Tests/checks run

Final Phase 14 verification is recorded in
`docs/mjl-phase-14-final-report.md`.

Required checks before the demo:

- `git diff --check`.
- PHP syntax check for all `custom/mjlfinancement/*.php` files.
- Available Docker-backed schema, smoke, sample-data, scope, workflow, export,
  unresolved-scope, and production-readiness scripts.
- `npm run test:e2e` when the local Docker/browser environment is available.

## Demo users

Use local/dev fixture users only:

- `admin.poc` for `ADMIN_PLATEFORME`.
- `agent.mjl` for `AGENT_SAISIE`.
- `superviseur.n1` or mapped verification account for
  `AGENT_VERIFICATEUR`.
- `superviseur.n2` or `dpaf.mjl`, according to the seeded production-role
  mapping, for `VALIDATEUR_DEFINITIF`.

Do not present fixture login names as final production usernames.

## Demo data

Required demo data:

- UNICEF.
- Programme Redevabilite.
- Funding envelope.
- Funds received with proof.
- Project.
- Budget line.
- Activity and physical execution.
- Expense, supporting document, final validation, and disbursement.
- Dashboard KPI, alert, timeline, audit, CSV, and XLSX evidence.

## Demo scenario readiness

Use `docs/mjl-client-demo-runbook.md` as the operator guide and
`docs/mjl-client-demo-scenario.md` as supporting scenario evidence.

The required demo path is:

UNICEF financing to funding envelope, funds received, project, budget,
activity, activity prevalidation, final validation, physical execution,
expense with justificatif, expense prevalidation, final validation,
disbursement, dashboard update, CSV/XLSX export, and timeline traceability.

## Exports to show

- CSV activity or financial execution export.
- XLSX expense/disbursement or workflow-decision export.
- Show French headers, server-side filters, stable filenames, and scoped rows.

## Known issues not to show unless asked

- Raw local database internals.
- Fixture-only POC/N1/N2/DPAF compatibility names.
- Internal roadmap/readiness page.
- Debug or server logs.
- Raw filesystem paths.

## Known issues to explain proactively

- Client approval is still pending.
- Historical unresolved local audit rows and generic report audit anchors are
  local data debt.
- Production email transport, public/base URL, production secrets,
  backup/restore, monitoring/log retention, and final deployment procedure are
  outside this demo.
- PDF/Word reports, SMS, OCR, bank API, public partner portal, and offline mode
  are not in the current phase.

## Client decisions to collect

- Final permission matrix.
- Role labels and training wording.
- Scope model by Partenaires / Programmes.
- Workflow labels.
- Physical execution formula wording.
- Financial execution formula wording.
- Dashboard KPI labels and exposure by role.
- Alert thresholds.
- Report/export list, columns, wording, ordering, and allowed export roles.
- Final official report canevas.

## Production-release items outside this demo

- Production SMTP.
- Public/base URL.
- Production secrets.
- Backup/restore procedure.
- Monitoring/log retention.
- Final hosting/deployment procedure.
- Final client-approved permission and official export templates.

## Go / No-Go

`GO_WITH_MINOR_GAPS`

Proceed with client feature validation only. Do not present the session as
production release closure.
