# Module lifecycle

## Declared lifecycle

- Module 0.21.0 requires PHP 7.4 and Dolibarr 23.0, depends on Third Parties and Projects, registers templates, global assets/hooks, five rights, a top menu and one hourly cron.
- Clean activation loads SQL, normalizes predecessor objects, installs Activity, planning, execution and export targets, creates invariant triggers, creates OTP/auth state, then calls native module initialization.
- For an already-enabled tenant, `bootstrap_poc.php` force-initializes the custom module. This is the required deployment path for replacing stored trigger definitions, including the corrected technical-Admin reset invariant; source-only file deployment does not alter an existing database trigger. Clean activation is E2E-covered, while replacement during reactivation remains source-characterized rather than separately executed in this closure.
- Existing installations are classified through exact RST-006A/RST-006B/RST-012 detectors. A required transition is refused with `MJL guarded migration required`; activation does not silently migrate an unknown/older target.
- Named `GET_LOCK`/`RELEASE_LOCK` serializes activation for the database/prefix. Unknown schema states fail closed.
- Disposable test modes intentionally retain predecessor targets and expose failure injection. These branches are verification infrastructure, not production configuration.
- `bootstrap_poc.php` requires CLI, loads the exact retained Admin, activates native dependencies and MJL, then disables unsafe native workspace modules. It creates no business fixtures.

## Recognized states

| State | Detection/transition | Failure behavior |
| --- | --- | --- |
| no Activity table and no other MJL tables | load base SQL then sequential target installers | refuse dirty partial clean install; activation returns failure |
| RST-006A target | require exact planning schema; later target becomes guarded migration | activation refuses unless matching disposable predecessor mode |
| RST-006B target | require exact execution schema; RST-012 may be installed/required | later target required or refused according to test mode |
| RST-012 target | require exact report/export schema and auth additions | continue module initialization |
| any unrecognized/partial state | none | fail closed; diagnostic log/CLI stderr |

## Deactivation and data retention

`remove()` delegates to native module removal without dropping MJL business tables. This preserves data but means reactivation must classify the retained schema exactly. No general rollback migration exists.

## Cron

`MjlExecutionReconciler::run` pages through same-entity Activities in rowid order, 100 at a time, until a short page is reached. Each Activity is reconciled through the aggregate command. One non-OK result stops all later rowids while earlier committed rows remain processed. The runtime semantics for multiple Dolibarr entities are unresolved.

## Risks and preservation

- Preserve the schema lock, exact detectors, fail-closed unknown-state behavior, test-only predecessor modes, retained-Admin invariant and data-retaining removal.
- **RESOLVED LIFE-F01:** `mjl_rst006b_detect_schema()` now classifies every exact prefix accepted by the RST-006B recognizer as `PARTIAL`. Failure points after dropping the old Operation check and after adding each of the first three replacement checks prove resumption, exact-target verification and rollback through `npm run test:phase3a`.
- Historical `rst002b`/`rst006a` runner modes set `MJL_TEST_MODE` only in the host runner environment, not the bootstrap container. Their descriptor retention branches are therefore unreachable through ordinary provisioning; `phase2` also documents why forwarding every mode blindly would be incorrect.
- A subprocess that exits zero in response to the runner's timeout SIGTERM can currently be reported as successful because exit zero is checked before the elapsed deadline flag.
- Existing OTP schema is accepted by table existence and named auth checks by constraint name, so a missing live-user unique index or weakened same-name check can survive activation.
- Do not enable OTP before 0.21 schema/auth triggers exist: the feature fails closed, but login availability can be lost.
- Cron failure isolation and multi-entity scheduling require decisions before any lifecycle refactor.
