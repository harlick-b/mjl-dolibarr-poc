# MJL UAT Data Readiness

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Executive verdict

`UAT_DATA_READY_WITH_GAPS`

The local/dev UAT dataset is sufficient to run internal UAT and client-demo scenarios. The remaining data gap is historical unresolved workflow/audit rows in the local database; E2E and route tests prove those unresolved objects fail closed for non-admin users.

## Users

The documented local bootstrap prepared dev/test users for:

- Admin plateforme: `admin.poc`
- Validateur definitif: `dpaf.mjl`
- Agent verificateur / prevalidateur: `superviseur.n1`, `superviseur.n2`
- Agent de saisie UNICEF: `agent.mjl`
- Audit/read-only legacy checks: `lecteur.audit`

These accounts and passwords are local fixture data only and must not be loaded into a production tenant.

## Partenaires / Programmes

Seed data created three partner/programme rows, including the Phase 13 required scopes:

- UNICEF
- Programme Redevabilite

## Projects

Seed data created three projects. E2E verified that Admin and Validateur definitif can create/edit projects inside the MJL workspace and that lower roles cannot.

## Funding envelopes

Seed data created three funding envelopes/conventions. E2E verified active-envelope selection rules and global programme envelope fund-receipt support.

## Funds received

Seed data created four fund receipts. E2E verified proof upload, received/not-received transitions, report/dashboard impact, and guarded proof downloads.

## Budgets

Seed data created eight budget lines. E2E verified budget-line creation, activation, filtering, history, locked edits, revised-budget floors, tamper rejection, inactive-line blocking, and computed amount recalculation.

## Activities

Seed data created five activities. E2E verified creation, submission, prevalidation, final validation, correction/resubmission, invalid execution percentage rejection, physical execution KPI update, late alerts, direct URL denial, and no-self-prevalidation.

## Expenses / Decaissements

Seed data created seven expenses. E2E verified document upload, submission, prevalidation, final validation, disbursement, missing-document blocking, overspend blocking, unavailable document alerts, direct POST rejection, and no-self-review/disbursement.

## Documents

E2E verified contextual uploads and guarded downloads for expenses, fund receipts, activities, and conventions. Global Documents remains read-only by target decision and route behavior.

## Timeline / audit

E2E verified workflow history, contextual comments, aggregate timeline scoping, read-only history without comment form, direct contextual POST denial, document audit labeling, and export audit visibility rules.

## Reports

E2E verified CSV/XLSX exports, stable filenames, French-readable statuses, server filters, POST token enforcement, unauthorized export denial, scope tampering fail-closed behavior, and Admin visibility of generic report audit rows.

## Missing data

- `audit_unresolved_scope.php` reports historical workflow/action rows pointing at deleted local test objects and generic report audit anchors.
- This is classified as local verification data debt, not a current feature-validation blocker, because E2E verified unresolved legacy readers and scoped users fail closed.

## How to regenerate test data

Use only on local/dev tenants:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php
```

Do not run these scripts on production tenants.
