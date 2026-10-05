# Behavior classification

The classifications are conservative: expected behavior is not automatically correct, and source-level risk is not automatically a reproduced runtime defect.

## Expected and intentional behavior

| Behavior | Classification | Basis |
| --- | --- | --- |
| native Admin plus one exact business role model | EXPECTED_BEHAVIOR | authoritative decisions and source agree |
| invitation-only access and Admin-only invitations | EXPECTED_BEHAVIOR | authority/source agreement |
| UI, route, command and database authorization duplication | INTENTIONAL_EXCEPTION | each layer protects a different trust boundary |
| dependency-free denial of custom and native document access | EXPECTED_SECURITY_BEHAVIOR | current source denies all custom document methods and deployment rules block native paths; authorized Phase 4 delivery is deferred |
| append-only transaction-bound audit | EXPECTED_DATA_INTEGRITY_BEHAVIOR | authority/schema/source agreement |
| server-side integer-XOF and workflow validation | EXPECTED_DATA_INTEGRITY_BEHAVIOR | authority/source agreement |
| client-side validation repeated for usability | INTENTIONAL_DUPLICATION | server remains authoritative |
| readiness branches for predecessor/current schemas | LEGACY_COMPATIBILITY | deliberate migration support; retirement unapproved |
| exact trigger-definition checks during activation | EXPECTED_LIFECYCLE_BEHAVIOR | guards partial/conflicting schemas |
| disposable tenant isolation and shared-data hashing | EXPECTED_TEST_SAFETY_BEHAVIOR | prevents persistent fixture contamination |

## Defects and material risks

| ID | Classification | Evidence | Required next decision or proof |
| --- | --- | --- | --- |
| BC-001 retained Admin reset conflict | RESOLVED_CONFIRMED_DEFECT | trigger and consume guards now allow only the native entity-0 Admin exception while retaining same-entity business-user isolation; disposable auth suite passed 12/12 | preserve SEC-AUTH-003, SEC-AUTHZ-001, DB-001 and DB-003 |
| BC-002 reference transaction results ignored | RESOLVED_DATA_INTEGRITY_DEFECT | Dolibarr driver semantics were inspected; all reference begins/commits are checked and rollback failure closes the uncertain connection; focused failure contract passed | preserve DB-001, DB-002, RT-008 and RT-014 |
| BC-003 export stream read failure exits silently | MEDIUM_RELIABILITY_DEFECT_IN_SOURCE; runtime failure UNREPRODUCED | `GENERATED` intentionally describes the completed spool artifact and an E2E test preserves it after client abort; separately, `fread() === false` exits the response loop without the exception path | inject a server read failure and define response handling without changing the generation record |
| BC-004 design assertions diverge | CONFIRMED_VERIFICATION_DEFECT | focused execution produced four static assertion failures against current source | reconcile tests with authoritative v3 design in a dedicated UI task |
| BC-005 public unit command can stall | REPRODUCED_ENVIRONMENT_LIMITED_FAILURE | aggregate command exceeded two minutes; isolated PHP-spawning tests reported sandbox `EPERM`; timeline test timed out | reproduce in the supported host/container environment and improve per-file failure/timeout reporting if still present |
| BC-006 incomplete runner discovery | CONFIRMED_VERIFICATION_DEFECT | nested contract is not selected and E2E script lists only a subset of configured suites | define named gates explicitly; avoid claims of complete coverage |
| BC-007 dormant shared-port browser test | SECURITY_RISK / DORMANT | undiscovered test defaults to port 8080 without disposable preflight | remove it with proof or route it through disposable preflight before execution |
| BC-008 cron aborts after first failing row | MEDIUM_RISK_UNKNOWN_BEHAVIOR | source control flow stops subsequent rowids | decide batch failure semantics and characterize partial progress |
| BC-009 cron entity context | MEDIUM_RISK_UNKNOWN_BEHAVIOR | behavior depends on `$conf->entity`; multi-entity runtime not exercised | establish supported entity topology before changing code |
| BC-010 activation atomicity | MEDIUM_ARCHITECTURAL_RISK | MariaDB DDL can commit implicitly; source relies on locks/detectors | preserve resumability and exercise interrupted activation when lifecycle work is requested |
| BC-011 OTP resend replacement before delivery | LOW_RISK_KNOWN_BEHAVIOR | replacement state commits before mail result is known | retain delivery-failure state and decide whether the user experience requires another model |
| BC-012 export global spool lock | MEDIUM_SCALABILITY_RISK | one global `/tmp` spool and nonblocking generation lock serialize entities | change only if observed workload requires concurrency |
| BC-013 export post-commit cleanup/session restoration | MEDIUM_IDEMPOTENCY_RISK | a durable record may exist when later cleanup returns an error, allowing retry duplicates | define retry identity and response semantics before a fix |
| BC-014 predecessor audit cap | LOW_OBSERVABILITY_RISK | predecessor audit lookup is capped at 200 | retain until predecessor retirement or a concrete completeness requirement |
| BC-015 Apache protection loaded state | UNRESOLVED_SECURITY_DEPLOYMENT_FACT | configuration exists but loaded runtime config was not inspected | verify in a deployment-specific security review |
| BC-016 external font request | LOW_PRIVACY_DEPLOYMENT_DEPENDENCY | the header hook loads Google Fonts on anonymous auth and MJL pages | decide production CSP/privacy and asset-hosting policy during explicitly requested deployment work |
| BC-017 password state-change method enforcement | MEDIUM_SECURITY_RISK | `invitation.php` dispatches `accept` through `GETPOST` without a method guard; native reset actions also lack a custom method check, although generated forms use POST and CSRF is required | add focused direct-GET characterization and inspect the exact native dispatcher before deciding the smallest method guard |
| BC-018 legacy cleartext password persistence | HIGH_SECURITY_BLOCKER | native Dolibarr 23 `User::setPassword()` writes `llx_user.pass` unless encrypted-only mode is enabled; MJL's wrapper does not force it and the shared tenant has no deployment constant enabling it | enforce encrypted-only storage in the existing wrapper and assert `pass IS NULL` after invitation and reset in a disposable tenant |
| BC-019 early RST-006B interruption is not resumable | HIGH_LIFECYCLE_BLOCKER | the prefix recognizer models the early Operation-check prefixes, but the top-level detector returns `UNKNOWN` before execution-shape or later markers | classify the known exact prefixes as partial and prove resume after every individual Operation DDL interruption |
| BC-020 runner deadline accepts cooperative zero exit | MEDIUM_VERIFICATION_DEFECT | timeout state is recorded, but exit code zero is accepted before the deadline flag is checked | reject elapsed deadlines before evaluating child exit status |
| BC-021 historical schema modes provision the wrong target | MEDIUM_VERIFICATION_DEFECT | host `MJL_TEST_MODE` is not forwarded into bootstrap; retained target branches are unreachable, while global forwarding would conflict with current `phase2` expectations | define and provision each maintained historical baseline explicitly |
| BC-022 activation accepts weakened auth schema | MEDIUM_LIFECYCLE_SECURITY_RISK | existing OTP tables are accepted by existence and auth checks by constraint name | verify exact required columns, unique index, checks and foreign key or define an explicit repair policy |

## Unproven removal claims

Seven helper functions have no discovered live internal entry in `11-dead-code-analysis.md`; one only participates in an otherwise unreachable two-function pair. They remain candidates because dynamic or external reachability is unproven. Recovery libraries, older export helpers, remaining wrappers, CSS selectors and historical tests remain candidates for the same conservative reason or for compatibility concerns.
