# MJL Deployment Checklist

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Deployment Steps

1. Deploy Dolibarr 23.0.x with the MJL custom module under
   `custom/mjlfinancement`.
2. Configure the Dolibarr database and document storage paths before enabling
   the module.
3. Enable required native modules:
   - third parties;
   - projects;
   - ECM/documents;
   - export;
   - `MjlFinancement`.
4. Activate or reactivate the MJL module so SQL definitions and guarded update
   scripts run.
5. Configure production users, groups, rights, roles, and Partenaires /
   Programmes according to the final permission matrix.
6. Confirm invitation-only access and no public registration.

## Environment And Configuration

- Configure public/base URL for invitation and password-reset links.
- Configure production email transport before sending real invitations.
- Configure `DOL_DATA_ROOT` and ECM storage on persistent storage.
- Restrict filesystem and web-server access so ECM files are not publicly
  exposed.
- Store real secrets outside the repository.
- Keep PHP, database, and web-server logs available to technical operators.

## Database Update Procedure

1. Back up the database and document storage before every deployment.
2. Use a maintenance window if schema updates are expected.
3. Deploy code.
4. Reactivate the module or run the documented Dolibarr module update path.
5. Run relevant schema audits from `docs/mjl-acceptance-tests.md`.
6. Review reported legacy columns, broken links, duplicate references, or
   cross-entity data before reopening access.

## Backup And Restore

- Back up MariaDB.
- Back up Dolibarr document storage, including ECM and MJL upload directories.
- Back up production configuration and secrets separately from source.
- Store backups outside the application host and test restore access.
- After restore, run schema audits and smoke checks.

## Production Diagnostics

- Confirm module version remains below `1.0.0` unless every in-scope readiness
  row is ready.
- Confirm active entity filtering on dashboards, exports, audit lists,
  document lookups, and workflow lookups.
- Confirm normal users cannot reach hidden advanced/reference pages by direct
  URL.
- Confirm project creation/editing is available inside MJL only for Admin
  plateforme and Validateur definitif.
- Confirm documents are stored in ECM, not publicly exposed, and downloaded
  through `/custom/mjlfinancement/documentdownload.php`.
- Confirm CSV/XLSX exports are server-filtered and French-labeled.
- Confirm no PDF/Word report feature is exposed for this phase.

## Production Blockers To Resolve

- Final client-approved permission matrix.
- Final official report/export columns and templates.
- Production email transport, public/base URL, and secrets configuration.
- Final deployment storage, backup, restore, and monitoring procedure.
