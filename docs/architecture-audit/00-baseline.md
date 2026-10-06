# Audit baseline

## Source identity

| Item | Observed value | Evidence kind |
| --- | --- | --- |
| Branch | `main` | Git |
| Commit | `b5499e67d7b0a205db4fe51044dfe5926afe9741` | Git |
| Pre-audit tracked diff | empty | Git |
| Pre-existing untracked content | six files under `docs/inspiration/auth/` | Git/filesystem |
| Runtime/test source manifest | `e4dd8c4d478bcbdbc9f58cfba5707987623fcee9902614ce71c463d51176c0c9` | SHA-256 of sorted per-file SHA-256 records for `custom/mjlfinancement` and `tests` |
| Application-only source manifest | `68af096c197088305cc9041b2e358853c9c0fdf1e36fa8f9cd467f126bb80106` | SHA-256 of sorted per-file SHA-256 records for all 157 files under `custom/mjlfinancement` |
| Untracked auth-inspiration manifest | `a496399be76ca97a82e3f5ddfc7361a32ac81b6b15b2f0ba9a2bb451722df36f` | SHA-256 manifest; user-owned and preserved |
| Application-owned source count | 157 files: 109 PHP, 34 SQL, 10 JS, 2 language files, 1 JSON, 1 Apache configuration | Filesystem |
| Verification source count | 80 files: 61 JS, 18 PHP, 1 YAML | Filesystem |

Audit documents are excluded from the source manifest so that writing the audit does not recursively change its own denominator. The final reconciliation must reproduce both source manifests or identify and re-audit every changed file.

## Closure delta

The immutable forensic snapshot was committed separately as
`ca6139b57597a4e9dc32216e167e57f8be53d7d4`. The closure work changed five
application files across its two correction waves, added one contract file and
updated four E2E/runner files. Every changed file was re-read and is covered by
`closure-evidence.md`. The current combined application/test manifest is
`36e9bc9c2712df4222cc06bbcee171ebd493fcfc565f4142587b9c3e34783763`;
the current application-only manifest is
`0a03b373302f8132d3ecf86ec69520bc1fcb027f033a176865992f8caeabfdbf`.
The original annex hashes and population counts above intentionally remain the
audit-snapshot values. The current application tree contains 20,573 lines; the
new `mjl_reference_rollback()` helper is behavior-mapped in the closure delta
rather than retroactively inserted into the immutable symbol annex.

The 237 source/test records, including individual SHA-256, byte and line counts, are in [annex-file-fingerprints.tsv](annex-file-fingerprints.tsv). They were generated from the sorted regular files under `custom/mjlfinancement` and `tests`. The combined and application-only manifests are reproduced with:

```bash
find custom/mjlfinancement tests -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum
find custom/mjlfinancement -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum
```

The untracked inspiration manifest uses the same command shape with `docs/inspiration/auth` as the root. The final run reproduced both hashes exactly.

Significant runtime and non-runtime records are in [annex-runtime-symbols.tsv](annex-runtime-symbols.tsv) and [annex-supplemental-symbols.tsv](annex-supplemental-symbols.tsv). Together they cover 157/157 application files with 1,993 records and no file overlap. After preservation-link reconciliation, the annex SHA-256 values are `3804fbbd1c9b13911518e8c4fa4d77f2363c46bf2624a48005123e947b8b84c8` and `e4de98a9095f28a9cdb5f9fbdb6bb3cff3c26948731ba7d8bee8da4f5dc4b437` respectively. Only 66 runtime records are `BEHAVIOR_MAPPED`; all 1,119 supplemental records and 808 runtime records are conservatively `DEFINITION_INDEXED`. Supplemental lexical categories and effect text are indexing aids, not established behavior; ambiguous operation/database matches are explicitly named `LEXICAL_*_CANDIDATE`. All 34 preservation IDs have at least one annex link and no undefined ID remains.

## Declared and observed platform

| Layer | Declared | Observed | Qualification |
| --- | --- | --- | --- |
| Dolibarr | `dolibarr/dolibarr:23.0.2`; module minimum 23.0 | running image tag 23.0.2, digest `sha256:7793a238...` | runtime metadata, no application bootstrap |
| MariaDB | `mariadb:11` | image 11.8.8, digest `sha256:068cbf78...`; client 11.8.8 | runtime metadata |
| PHP | module minimum 7.4 | host CLI 8.1.2; running Dolibarr CLI 8.2.31 | host tests and container runtime differ |
| Node/npm | Playwright development dependency | Node 22.22.0, npm 10.9.4 | host tooling |
| MJL module | descriptor 0.21.0 | installed module state not queried | source evidence only |

The shared Compose services were already running when inspected. The audit did not start, reset, activate, migrate, browse, or repair them. Exact installed MJL schema and module version therefore remain `UNRESOLVED`; the current-state document says the tenant is still at schema RST-012/module 0.20.0 with the 0.21.0 OTP addition pending activation.

## Module integration

- Native dependencies: `modSociete`, `modProjet`; bootstrap additionally activates User, ECM and Export before disabling unsupported native workspace modules.
- Registered hook contexts: `all`, `login`, `passwordforgottenpage`; template override enabled; module CSS and `native_guard.js.php` are globally registered.
- Rights declared: reference read/write, Activity read, audit read, access administration.
- Cron: hourly `MjlExecutionReconciler::run`, guarded by module enablement.
- Environment inputs include Dolibarr DB/base URL settings, `MJL_POC_DEFAULT_PASSWORD`, `MJL_AUTH_OTP_ENABLED`, disposable-tenant/test-mode controls and guarded failure-injection controls. Values are deliberately omitted.
- Schema state is detected through `information_schema`, exact-definition comparisons, migration locks, target guards and module-activation checks.

## Native boundary inspected

The exact running Dolibarr core was searched read-only for the reached interfaces. `GETPOST` is defined in `core/lib/functions.lib.php`; CSRF token helpers are in the same file; `accessforbidden` is in `core/lib/security.lib.php`; login hooks dispatch through `core/lib/security2.lib.php`. This is a bounded integration inspection, not a Dolibarr-core audit. Apache enforcement precedes PHP and is mapped separately.

## Audit evidence vocabulary

- `SOURCE`: direct reading or static search of the recorded source manifest.
- `RUNTIME_METADATA`: read-only process/image/version observation without application bootstrap.
- `TEST`: an executed assertion, with the exact command and result.
- `DOC`: canonical requirement or current-state statement.
- `VERIFIED`: the stated claim is supported within the scope of its cited evidence; it never silently means end-to-end runtime proof.
- `UNRESOLVED`: evidence was unavailable, contradictory, or insufficient.

## Safety outcome

No runtime source, schema, persistent tenant, configuration, dependency, or test was modified. Docker inspection initially failed inside the sandbox and was repeated read-only with approved access. The only repository changes made by this pass are under `docs/architecture-audit/` and the required gap-analysis cross-reference.
