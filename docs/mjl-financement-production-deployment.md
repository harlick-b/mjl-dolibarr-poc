# MJL-Financement Production Deployment

This document defines the production operations checklist for the
MJL-Financement Dolibarr module. It is intentionally separate from POC sample
data instructions.

## Deployment Steps

1. Deploy Dolibarr 23.0.x with the MJL custom module available under
   `custom/mjlfinancement`.
2. Configure the Dolibarr database and document storage paths before enabling
   the module.
3. Enable the native modules required by MJL-Financement:
   - third parties;
   - projects;
   - ECM/documents;
   - expense reports, if retained for native compatibility;
   - export;
   - `MjlFinancement`.
4. Activate or reactivate the MJL module so Dolibarr loads the SQL table
   definitions and guarded update scripts.
5. Configure groups, users, and rights according to the final production
   permission matrix. The sample `MJL POC - ...` groups are a development
   baseline, not a final client-approved permission matrix. Until that matrix
   is available, production-readiness tests continue to use the current role
   simulation.
6. Confirm that access remains invitation-only and that no public registration
   link is available.

## Environment And Configuration

- Configure the public/base URL used in generated invitation and password-reset
  links when email features are selected for production.
- Configure production email transport before sending real invitations. Email
  features and production email settings are deferred for a later batch.
- Configure `DOL_DATA_ROOT` and ECM storage on persistent storage.
- Restrict filesystem and web-server access so ECM files are not exposed
  through unauthenticated public paths.
- Keep PHP, database, and web-server logs available to Admin/technical
  operators.

## Database Update Procedure

1. Back up the database and document storage before every deployment.
2. Put the application in a maintenance window if schema updates are expected.
3. Deploy code.
4. Reactivate the module or run the documented Dolibarr module update path so
   guarded SQL scripts execute.
5. Run schema audits:
   - `audit_schema_0.3.0.php`
   - `audit_schema_0.4.0.php`
   - `audit_schema_0.5.0.php`
6. Review any reported legacy columns, broken links, duplicate references, or
   cross-entity data before reopening user access.

## Backup Procedure

- Back up the MariaDB database.
- Back up Dolibarr document storage, including ECM files and MJL upload
  directories.
- Back up production configuration files and secrets separately from source.
- Store backups outside the application host and test restore access.

## Restore Procedure

1. Restore the database backup.
2. Restore Dolibarr document storage to the matching path.
3. Restore production configuration.
4. Start Dolibarr and verify the MJL module is enabled.
5. Run schema audits and smoke checks.
6. Verify a sample Admin, DPAF, Supervisor, Agent, and Reader login.

## Diagnostics Checklist

- Confirm the module version is still below `1.0.0` unless every production
  matrix row is `READY`.
- Confirm active entity filtering on dashboards, exports, audit lists, and
  workflow lookups.
- Confirm Admin-only access to invitation management and internal roadmap.
- Confirm DPAF/Admin-only access to reports and DPAF dashboard.
- Confirm normal users cannot reach hidden advanced/reference pages by direct
  URL.
- Confirm DPAF/Admin can manage conventions and budget lines only after the
  production management flows are implemented and tested.
- Confirm fund receipts remain a read-only supervision/reference surface until
  a production management workflow is selected.
- Confirm official exports provide both CSV compatible with Microsoft Excel
  and XLSX before the export row is marked `READY`.
- Confirm no public registration labels or links appear in auth or workspace
  screens.
- Confirm uploaded supporting documents are stored in ECM, are not publicly
  exposed, and are available through a guarded MJL download route once the
  document-download batch is implemented.

## Smoke-Test Checklist

Run these after deployment or restore:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.3.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.4.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_schema_0.5.0.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_activity_workflow.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_expense_validation.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/smoke_traceability_exports.php
npm run test:e2e
```

The `bootstrap_poc.php`, `seed_sample_data.php`, and sample-data CSVs are for
development/POC rehearsal. Do not load sample data into a production tenant.

## Rollback Guidance

- Roll back code and database together to the same backup point.
- Restore document storage from the matching backup if uploads occurred after
  the backup.
- Re-run schema audits after rollback.
- Do not partially roll back only PHP files when schema changes have already
  been applied.

## Remaining Production Blockers

- Final client-approved permission matrix.
- Final report/export columns and any official templates.
- Final DPAF/N2 escalation rules.
- Convention/envelope production management implementation.
- Budget-line production management implementation and unsafe-edit rules.
- Fund-receipt full management remains deferred; current selected scope is
  read-only supervision/reference.
- Guarded document download implementation; preview remains planned later.
- XLSX export implementation.
- Production email/base URL/secrets configuration when email features are
  selected.
