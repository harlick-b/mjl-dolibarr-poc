# MJL Phase 1 Reset Precondition Report

## Authorization and Scope

- Reset unit: `RST-000`
- User authorization: explicit approval received on 2026-08-10
- Execution window: 2026-08-10 13:48-14:16 Africa/Porto-Novo
- Source commit: `e526e09bc0ab187f01e32938ff6536faa5763184`
- Target: local Docker Compose tenant only
- Business-data mutation: none
- Other reset units executed: none

The pre-existing `.gitignore` modification and a concurrent user-owned change
to `docs/mjl_fully_revised_implementation_prompts_by_phase.md` were preserved
and excluded from this execution.

The final recovery boundary was captured while the Dolibarr application was
stopped, then the service was restarted immediately. Earlier private captures
remain ignored as provisional evidence and are not the authoritative backup.

## Recovery Artifacts

Private artifacts are stored below the ignored, permission-restricted path:

```text
data/backups/rst000-20260810T141446+0100/
```

The directory and contained files deny group and other access. It contains
local credentials and database/document content and must never be committed.

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| Dolibarr database logical dump | 4,057,684 bytes | `ca00419a7b68d1eaffdd6ad0da31f82ba0c3f58d28f141217b403d4df23d4aa6` |
| MariaDB all-restorable-databases dump | 7,544,297 bytes | `8fae2c4fa139a35a7008516cc6271a6ed225c91a806d8509141b6076085da3cc` |
| Explicit `sys` schema dump | 551,456 bytes | `76e6efd77b560403113661b21b439d555b4ecadf1611be48bc8ff0da3187a21b` |
| Supplemental MariaDB system state | 1,282,653 bytes | `fddf02d727fecbe49b46db2a60252671c7ee2ae76592f48544f59e87ccaa54c5` |
| Document archive | 124,482 bytes | `3affeb129504fb45943eef2ad64f67a915281e213254ec1dad2397d219d3350c` |
| Configuration archive | 3,134 bytes | `d8f24a2d1096d7ee34a329900b22cbb1ec981b896113ab953dd597f170c7a3f5` |

The configuration snapshot includes the Compose source, rendered Compose
configuration, MJL module descriptor, and native-route guard configuration.
The document archive contains 614 files. Preflight found approximately 12.6 GB
available, which was sufficient for the approximately 13.6 MB artifact set.

The source server exposed five schemas. `dolidb` and `mysql` are in the
all-restorable dump. MariaDB excludes `sys` from `--all-databases`, so it was
captured explicitly. It also omits the derived optimizer-stat tables
`mysql.innodb_index_stats` and `mysql.innodb_table_stats`, while recreating
system routines can normalize `mysql.proc` timestamps. Those three tables are
captured in the supplemental state artifact and restored last.
`information_schema` and `performance_schema` are virtual runtime schemas;
their presence was verified after restore rather than represented as files.

## Isolated Restore Rehearsal

The database artifacts were restored into a disposable MariaDB 11 container backed
by temporary storage. The container had no published port and was removed
after verification. The document and configuration archives were extracted
into permission-restricted temporary restore directories; their generated
restore copies were removed after comparison.

| Verification | Result | Evidence |
| --- | --- | --- |
| Backup artifact checksum verification | PASS | `checksums.sha256` |
| Dolibarr database dump comparison | PASS | Identical SHA-256 `ca00419a...d4aa6` |
| All-restorable-databases dump comparison | PASS | Identical SHA-256 `8fae2c4f...a3cc` |
| Explicit `sys` dump comparison | PASS | Identical SHA-256 `76e6efd7...21b` |
| Supplemental system-state data comparison | PASS | Identical SHA-256 `fddf02d7...54c5` |
| Complete database schema comparison | PASS | Identical SHA-256 `c0fa30d5...80b0` |
| Five-schema inventory comparison | PASS | `dolidb`, `information_schema`, `mysql`, `performance_schema`, `sys` |
| Complete physical table-count comparison | PASS | All 445 base tables matched; manifest SHA-256 `7aa5b062...90b` |
| Exact MJL table-count comparison | PASS | All 15 tables matched |
| Document file-manifest comparison | PASS | 614 files; manifest SHA-256 `b12a68a5...863c` |
| Configuration tree comparison | PASS | No differing path or content |
| Temporary database cleanup | PASS | No RST-000 restore container remains |

## Exact MJL Row-count Comparison

| Table | Source | Restored |
| --- | ---: | ---: |
| `llx_mjlfinancement_access_audit` | 39 | 39 |
| `llx_mjlfinancement_activity` | 7 | 7 |
| `llx_mjlfinancement_budget_line` | 8 | 8 |
| `llx_mjlfinancement_convention` | 3 | 3 |
| `llx_mjlfinancement_exchange_log` | 48 | 48 |
| `llx_mjlfinancement_expense` | 7 | 7 |
| `llx_mjlfinancement_fund_receipt` | 4 | 4 |
| `llx_mjlfinancement_invitation` | 1 | 1 |
| `llx_mjlfinancement_password_reset` | 14 | 14 |
| `llx_mjlfinancement_project_note` | 17 | 17 |
| `llx_mjlfinancement_report` | 8 | 8 |
| `llx_mjlfinancement_user_role` | 13,541 | 13,541 |
| `llx_mjlfinancement_user_soc_scope` | 1,194 | 1,194 |
| `llx_mjlfinancement_validation` | 4 | 4 |
| `llx_mjlfinancement_workflow_action` | 1,101 | 1,101 |

## Sanitized Exact Command Inventory

The following records the successful command structure and exact material
arguments. Only the existing local database password and the disposable
restore password are replaced with named redactions. The private artifacts
retain no command transcript containing those values.

```bash
set -euo pipefail
install -d -m 700 data/backups/rst000-20260810T141446+0100/{artifacts/configuration,verification}
install -m 600 docker-compose.yml data/backups/rst000-20260810T141446+0100/artifacts/configuration/docker-compose.yml
install -m 600 custom/mjlfinancement/core/modules/modMjlFinancement.class.php data/backups/rst000-20260810T141446+0100/artifacts/configuration/modMjlFinancement.class.php
install -m 600 custom/mjlfinancement/deployment/apache-native-guard.conf data/backups/rst000-20260810T141446+0100/artifacts/configuration/apache-native-guard.conf

docker compose config > data/backups/rst000-20260810T141446+0100/artifacts/configuration/docker-compose.rendered.yml
git rev-parse HEAD > data/backups/rst000-20260810T141446+0100/verification/source-commit.txt
df -Pk . > data/backups/rst000-20260810T141446+0100/verification/preflight-capacity.txt
docker compose exec -T mariadb mariadb --version > data/backups/rst000-20260810T141446+0100/verification/tool-versions.txt
docker compose exec -T mariadb mariadb-dump --version >> data/backups/rst000-20260810T141446+0100/verification/tool-versions.txt
tar --version | sed -n '1p' >> data/backups/rst000-20260810T141446+0100/verification/tool-versions.txt
docker version --format 'Docker Server {{.Server.Version}}' >> data/backups/rst000-20260810T141446+0100/verification/tool-versions.txt
app_container=$(docker compose ps -q dolibarr)
app_was_stopped=0
restart_app() { if [ "$app_was_stopped" -eq 1 ]; then docker compose start dolibarr >/dev/null; fi; }
trap restart_app EXIT
docker compose stop dolibarr
app_was_stopped=1
docker compose exec -T mariadb mariadb-dump -uroot -p<LOCAL_DB_ROOT_PASSWORD> --single-transaction --quick --routines --events --triggers --hex-blob --order-by-primary --skip-comments --databases dolidb > data/backups/rst000-20260810T141446+0100/artifacts/dolidb.sql
docker compose exec -T mariadb mariadb-dump -uroot -p<LOCAL_DB_ROOT_PASSWORD> --single-transaction --quick --routines --events --triggers --hex-blob --order-by-primary --skip-comments --all-databases > data/backups/rst000-20260810T141446+0100/artifacts/mariadb-all-restorable.sql
docker compose exec -T mariadb mariadb-dump -uroot -p<LOCAL_DB_ROOT_PASSWORD> --single-transaction --quick --routines --events --triggers --hex-blob --order-by-primary --skip-comments --databases sys > data/backups/rst000-20260810T141446+0100/artifacts/mariadb-sys.sql
docker compose exec -T mariadb mariadb-dump -uroot -p<LOCAL_DB_ROOT_PASSWORD> --single-transaction --quick --hex-blob --order-by-primary --skip-comments mysql proc innodb_index_stats innodb_table_stats > data/backups/rst000-20260810T141446+0100/artifacts/mariadb-system-state.sql
docker compose exec -T mariadb mariadb-dump -uroot -p<LOCAL_DB_ROOT_PASSWORD> --no-data --routines --events --triggers --skip-comments --databases dolidb > data/backups/rst000-20260810T141446+0100/verification/dolidb-source-schema.sql
docker compose exec -T mariadb mariadb-dump -uroot -p<LOCAL_DB_ROOT_PASSWORD> --no-data --routines --events --triggers --skip-comments --all-databases > data/backups/rst000-20260810T141446+0100/verification/mariadb-source-all-schema.sql
docker compose exec -T mariadb mariadb -uroot -p<LOCAL_DB_ROOT_PASSWORD> --batch --skip-column-names -e 'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME' > data/backups/rst000-20260810T141446+0100/verification/source-schema-names.txt
awk '{kind="RESTORABLE_PHYSICAL"; if ($1=="information_schema" || $1=="performance_schema") kind="VIRTUAL_RUNTIME"; print $1 "\t" kind}' data/backups/rst000-20260810T141446+0100/verification/source-schema-names.txt > data/backups/rst000-20260810T141446+0100/verification/source-schema-inventory.tsv
docker compose exec -T mariadb mariadb -uroot -p<LOCAL_DB_ROOT_PASSWORD> --batch --skip-column-names -e 'SELECT TABLE_SCHEMA,TABLE_NAME FROM information_schema.TABLES WHERE TABLE_TYPE="BASE TABLE" AND TABLE_SCHEMA NOT IN ("information_schema","performance_schema") ORDER BY TABLE_SCHEMA,TABLE_NAME' > data/backups/rst000-20260810T141446+0100/verification/source-base-tables.tsv
awk -F '\t' '{printf "SELECT CONCAT(%c%s%c, CHAR(9), %c%s%c, CHAR(9), COUNT(*)) FROM `%s`.`%s`;\\n", 39,$1,39,39,$2,39,$1,$2}' data/backups/rst000-20260810T141446+0100/verification/source-base-tables.tsv > data/backups/rst000-20260810T141446+0100/verification/source-count-queries.sql
docker compose exec -T mariadb mariadb -uroot -p<LOCAL_DB_ROOT_PASSWORD> --batch --skip-column-names < data/backups/rst000-20260810T141446+0100/verification/source-count-queries.sql | sed 's/\\t/\t/g' > data/backups/rst000-20260810T141446+0100/verification/source-all-base-table-counts.tsv
awk -F '\t' '$1 == "dolidb" && $2 ~ /^llx_mjlfinancement_/ {print $2 "\t" $3}' data/backups/rst000-20260810T141446+0100/verification/source-all-base-table-counts.tsv > data/backups/rst000-20260810T141446+0100/verification/source-mjl-counts.tsv
docker run --rm --volumes-from "$app_container":ro --entrypoint tar dolibarr/dolibarr:23.0.2 --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -czf - -C /var/www documents > data/backups/rst000-20260810T141446+0100/artifacts/documents.tar.gz
docker run --rm --volumes-from "$app_container":ro --entrypoint bash dolibarr/dolibarr:23.0.2 -o pipefail -lc 'cd /var/www && find documents -type f -print0 | sort -z | xargs -0 sha256sum' > data/backups/rst000-20260810T141446+0100/verification/documents-source.sha256
restart_app
app_was_stopped=0
trap - EXIT
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -czf data/backups/rst000-20260810T141446+0100/artifacts/configuration.tar.gz -C data/backups/rst000-20260810T141446+0100/artifacts configuration
sha256sum data/backups/rst000-20260810T141446+0100/artifacts/dolidb.sql data/backups/rst000-20260810T141446+0100/artifacts/mariadb-all-restorable.sql data/backups/rst000-20260810T141446+0100/artifacts/mariadb-sys.sql data/backups/rst000-20260810T141446+0100/artifacts/mariadb-system-state.sql data/backups/rst000-20260810T141446+0100/artifacts/documents.tar.gz data/backups/rst000-20260810T141446+0100/artifacts/configuration.tar.gz > data/backups/rst000-20260810T141446+0100/checksums.sha256

install -d -m 700 data/backups/rst000-20260810T141446+0100/verification/documents-restore data/backups/rst000-20260810T141446+0100/verification/configuration-restore
cleanup() {
  docker rm -f mjl-rst000-final-restore-20260810t141446 >/dev/null 2>&1 || true
  rm -rf data/backups/rst000-20260810T141446+0100/verification/documents-restore data/backups/rst000-20260810T141446+0100/verification/configuration-restore
}
trap cleanup EXIT
tar --no-same-owner -xzf data/backups/rst000-20260810T141446+0100/artifacts/documents.tar.gz -C data/backups/rst000-20260810T141446+0100/verification/documents-restore
tar --no-same-owner -xzf data/backups/rst000-20260810T141446+0100/artifacts/configuration.tar.gz -C data/backups/rst000-20260810T141446+0100/verification/configuration-restore
(cd data/backups/rst000-20260810T141446+0100/verification/documents-restore && find documents -type f -print0 | sort -z | xargs -0 sha256sum) > data/backups/rst000-20260810T141446+0100/verification/documents-restored.sha256
cmp data/backups/rst000-20260810T141446+0100/verification/documents-source.sha256 data/backups/rst000-20260810T141446+0100/verification/documents-restored.sha256
diff -qr data/backups/rst000-20260810T141446+0100/artifacts/configuration data/backups/rst000-20260810T141446+0100/verification/configuration-restore/configuration

docker run -d --name mjl-rst000-final-restore-20260810t141446 --tmpfs /var/lib/mysql:rw,size=1024m -e MARIADB_ROOT_PASSWORD=<EPHEMERAL_RESTORE_PASSWORD> mariadb:11
ready=0
for attempt in $(seq 1 60); do if docker exec mjl-rst000-final-restore-20260810t141446 mariadb-admin -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> ping --silent; then ready=1; break; fi; sleep 1; done
test "$ready" -eq 1
docker exec -i mjl-rst000-final-restore-20260810t141446 mariadb -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> < data/backups/rst000-20260810T141446+0100/artifacts/mariadb-all-restorable.sql
docker exec -i mjl-rst000-final-restore-20260810t141446 mariadb -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> < data/backups/rst000-20260810T141446+0100/artifacts/mariadb-sys.sql
docker exec -i mjl-rst000-final-restore-20260810t141446 mariadb -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> mysql < data/backups/rst000-20260810T141446+0100/artifacts/mariadb-system-state.sql
docker exec mjl-rst000-final-restore-20260810t141446 mariadb-dump -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> --single-transaction --quick --routines --events --triggers --hex-blob --order-by-primary --skip-comments --all-databases > data/backups/rst000-20260810T141446+0100/verification/mariadb-restored-all-restorable.sql
docker exec mjl-rst000-final-restore-20260810t141446 mariadb-dump -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> --single-transaction --quick --routines --events --triggers --hex-blob --order-by-primary --skip-comments --databases sys > data/backups/rst000-20260810T141446+0100/verification/mariadb-restored-sys.sql
docker exec mjl-rst000-final-restore-20260810t141446 mariadb-dump -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> --single-transaction --quick --hex-blob --order-by-primary --skip-comments mysql proc innodb_index_stats innodb_table_stats > data/backups/rst000-20260810T141446+0100/verification/mariadb-restored-system-state.sql
docker exec mjl-rst000-final-restore-20260810t141446 mariadb-dump -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> --no-data --routines --events --triggers --skip-comments --all-databases > data/backups/rst000-20260810T141446+0100/verification/mariadb-restored-all-schema.sql
docker exec mjl-rst000-final-restore-20260810t141446 mariadb -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> --batch --skip-column-names -e 'SELECT SCHEMA_NAME FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME' > data/backups/rst000-20260810T141446+0100/verification/restored-schema-names.txt
awk -F '\t' '{printf "SELECT CONCAT(%c%s%c, CHAR(9), %c%s%c, CHAR(9), COUNT(*)) FROM `%s`.`%s`;\\n", 39,$1,39,39,$2,39,$1,$2}' data/backups/rst000-20260810T141446+0100/verification/source-base-tables.tsv > data/backups/rst000-20260810T141446+0100/verification/restored-count-queries.sql
docker exec -i mjl-rst000-final-restore-20260810t141446 mariadb -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> --batch --skip-column-names < data/backups/rst000-20260810T141446+0100/verification/restored-count-queries.sql | sed 's/\\t/\t/g' > data/backups/rst000-20260810T141446+0100/verification/restored-all-base-table-counts.tsv
awk -F '\t' '$1 == "dolidb" && $2 ~ /^llx_mjlfinancement_/ {print $2 "\t" $3}' data/backups/rst000-20260810T141446+0100/verification/restored-all-base-table-counts.tsv > data/backups/rst000-20260810T141446+0100/verification/restored-mjl-counts.tsv
cmp data/backups/rst000-20260810T141446+0100/artifacts/dolidb.sql <(docker exec mjl-rst000-final-restore-20260810t141446 mariadb-dump -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> --single-transaction --quick --routines --events --triggers --hex-blob --order-by-primary --skip-comments --databases dolidb)
cmp data/backups/rst000-20260810T141446+0100/artifacts/mariadb-all-restorable.sql data/backups/rst000-20260810T141446+0100/verification/mariadb-restored-all-restorable.sql
cmp data/backups/rst000-20260810T141446+0100/artifacts/mariadb-sys.sql data/backups/rst000-20260810T141446+0100/verification/mariadb-restored-sys.sql
cmp data/backups/rst000-20260810T141446+0100/artifacts/mariadb-system-state.sql data/backups/rst000-20260810T141446+0100/verification/mariadb-restored-system-state.sql
cmp data/backups/rst000-20260810T141446+0100/verification/dolidb-source-schema.sql <(docker exec mjl-rst000-final-restore-20260810t141446 mariadb-dump -h127.0.0.1 -uroot -p<EPHEMERAL_RESTORE_PASSWORD> --no-data --routines --events --triggers --skip-comments --databases dolidb)
cmp data/backups/rst000-20260810T141446+0100/verification/mariadb-source-all-schema.sql data/backups/rst000-20260810T141446+0100/verification/mariadb-restored-all-schema.sql
cmp data/backups/rst000-20260810T141446+0100/verification/source-schema-names.txt data/backups/rst000-20260810T141446+0100/verification/restored-schema-names.txt
cmp data/backups/rst000-20260810T141446+0100/verification/source-all-base-table-counts.tsv data/backups/rst000-20260810T141446+0100/verification/restored-all-base-table-counts.tsv
cmp data/backups/rst000-20260810T141446+0100/verification/source-mjl-counts.tsv data/backups/rst000-20260810T141446+0100/verification/restored-mjl-counts.tsv
cleanup
trap - EXIT

sha256sum -c data/backups/rst000-20260810T141446+0100/checksums.sha256
chmod -R go-rwx data/backups/rst000-20260810T141446+0100
```

Exact table-count query output is retained privately in
`verification/source-mjl-counts.tsv` and
`verification/restored-mjl-counts.tsv`; the before/after values are reproduced
above. Complete counts for all 445 physical base tables are retained in
`verification/source-all-base-table-counts.tsv` and
`verification/restored-all-base-table-counts.tsv`.

The recorded tool versions were MariaDB client/server tools 11.8.8,
GNU tar 1.34, and Docker Server 28.1.1. Every command in the final successful
capture, rehearsal, comparison, and cleanup chain exited with status 0.
Superseded attempts and their fail-closed disposition are described below.

## Rollback Result

Business rollback was not applicable because RST-000 performed no business,
schema, permission, seed, or document mutation. Operational cleanup passed:
the disposable MariaDB containers and temporary document and configuration
extraction trees were removed. The verified source artifacts and their
comparison evidence were intentionally retained. No other reset action ran.

## Operational Notes

- An initial document/configuration comparison command used the wrong relative
  working directory and did not perform its intended comparisons. It changed
  no source or backup data. The comparison was rerun with fail-fast behavior
  and isolated paths and passed.
- The first disposable database attempt encountered a local socket connection
  error and was removed by its cleanup trap. The rehearsal was rerun using
  explicit container-local TCP connections and passed every comparison.
- The expanded database rehearsal first revealed MariaDB's cached grant
  behavior after importing `mysql`, then exposed the system-stat and routine
  timestamp exceptions described above. Both disposable attempts failed
  closed and were removed. The final rehearsal used the still-active ephemeral
  grant cache and restored the supplemental system state last; every exact
  comparison then passed.
- The confidence loop rejected a live-application capture because consistency
  between database and document artifacts was assumed rather than proven. A
  first quiesced recapture could not read container-owned documents as the
  host user; its restart trap restored Dolibarr. The authoritative recapture
  used a read-only helper container sharing the stopped app's volumes, then
  restarted Dolibarr and passed the full restore rehearsal.
- Raw configuration, database content, document names, and document paths are
  intentionally absent from this committed report.

## Result and Next Gate

```text
RST_000_RECOVERY_BOUNDARY_VERIFIED
```

RST-000 is complete. This result does not approve any other reset action.
RST-003 and RST-014A still require their checksum-approved row-identifier
appendix and explicit user approval before mutation.
