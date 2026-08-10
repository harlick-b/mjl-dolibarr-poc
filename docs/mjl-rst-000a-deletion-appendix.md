# RST-000A Deletion Appendix Evidence

## Approval State

- Reset unit: `RST-000A`
- Unit-level approval: received on 2026-08-10
- Preparation state: complete
- Bundle checksum approval: received on 2026-08-10
- Destructive execution: complete
- Execution evidence: `docs/mjl-rst-000a-execution-report.md`

## Preserved Administrator

The sole preserved account is native Dolibarr user `llx_user.rowid=1`, entity
`0`, login `admin`, with `admin=1` and `statut=1` at inventory time.

The separate `admin_poc` and `admin.poc` accounts are sample accounts included
in the deletion inventory. No existing business user or assignment is
migrated.

## Private Exact Appendix

The exact appendix is stored in the ignored, permission-restricted local path:

```text
data/backups/rst000a-20260810T145929+0100/
```

It contains:

- `database-rows.tsv`: every table, row identifier, entity, ownership marker,
  and dependency class proposed for deletion;
- `preserved-admin.tsv`: the exact preserved administrator invariant;
- `document-files.sha256`: every proposed Dolibarr document path and hash;
- `repository-files.sha256`: every legacy seed/source path and hash affected by
  removal or replacement;
- `before-counts.tsv`: exact proposed database deletion counts by table;
- `checksums.sha256`: component hashes for the complete appendix.

The exact inventory is private because it is operational reset evidence, not
product documentation. It contains no password hashes, API keys, invitation
tokens, reset tokens, email addresses, or document contents.

## Sanitized Scope Summary

- Exact database rows proposed for deletion: `16,443`
- Custom MJL tables: all `15` current data tables, `15,996` rows total
- Native sample users: `15`
- Native sample groups: `14`
- Native group memberships: `15`
- Native direct user rights: `156`
- Native group rights: `206`
- Native third parties: `4`
- Native third-party/user links: `4`
- Native Projects: `6`
- Native Project tasks: `8`
- Native ECM metadata rows: `19`
- Exact Dolibarr MJL/test document files: `606`
- Exact legacy repository files inventoried: `48`

Dolibarr system/reference/configuration rows, table definitions, native module
configuration, document templates, installation files, and the preserved
administrator are excluded.

## Appendix Checksums

| Component | SHA-256 |
| --- | --- |
| Database rows | `427a7bdefba7d41ee66be1c1809173cf54f9fd10eb5c7d66c95e74eb7ecd57e2` |
| Preserved administrator | `6d897e4d1cccd9c8d327d79f017b44dd7007dc88214d5ba651295e7c2338a945` |
| Dolibarr document files | `99833bc878398effd4d2398be4eccf627799b2b625a8b3be04154a2c3fb722ae` |
| Repository files | `a09c2e43289ab667725752284d9c4228ec0700e13e1d714efaffdc3c9f08456a` |
| Before counts | `5ac714ed5c9f390db8a04bb03ccb403c65bc6518bb7ad5c065178e5886430789` |

Appendix bundle approval checksum:

```text
15ba42a2dba1e3e8c3f8171b93e1049ffcbee7ddea1fb12fb6f3cfe358ce593d
```

This is the SHA-256 of `checksums.sha256`. Any row, file, preserved-admin
invariant, or count drift should block execution until a new appendix is
generated and approved. Post-reset activation instead exposed one transient
out-of-appendix role row; the deviation and all supporting file changes are
now frozen in `docs/mjl-rst-000a-supplemental-appendix.md` and were explicitly
ratified on 2026-08-10.

## Executed Contract

Execution stopped the application, verified RST-000 recovery artifacts,
recomputed and compared the full appendix, deleted the originally approved
targets in dependency order, removed only hash-matched files, replaced the
bootstrap with a non-seeding activation path, and restarted the application.
The first activation then recreated a legacy role row outside this appendix;
that row was deleted and its historical backfill removed. Those corrective
actions are not claimed as covered by the original checksum; they were
separately ratified by the supplemental checksum. Verification then proved:

- the preserved `admin` account remains active and can authenticate;
- every appendix database target is absent;
- all persistent MJL business tables are empty;
- no non-appendix native row from the pre-reset inventory changed; the one
  transient generated custom-role row is separately disclosed;
- all approved MJL/test document files are absent;
- normal setup cannot recreate users or business/sample data;
- RST-000 remains the documented recovery route.
