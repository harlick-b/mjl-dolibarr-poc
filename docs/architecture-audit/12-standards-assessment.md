# Standards assessment

This assessment uses the repository's documented conventions first. External standards are comparison points, not automatic refactoring mandates.

## Applicable references

- Dolibarr's [module development guide](https://wiki.dolibarr.org/index.php/Module_development), [hook system](https://wiki.dolibarr.org/index.php/Hooks_system), and [language/development rules](https://wiki.dolibarr.org/index.php/Language_and_development_rules) describe the native extension seams used here.
- [PSR-1](https://www.php-fig.org/psr/psr-1/) and [PSR-12](https://www.php-fig.org/psr/psr-12/) are useful PHP structure and formatting references. They do not override Dolibarr's procedural entrypoint and hook conventions.
- [PHPStan baselines](https://phpstan.org/user-guide/baseline), [ESLint configuration](https://eslint.org/docs/latest/use/configure/), and [Stylelint configuration](https://stylelint.io/user-guide/configure/) describe possible incremental static-analysis paths. None is configured in this repository.
- MariaDB documents [implicit-commit statements](https://mariadb.com/docs/server/reference/sql-statements/transactions/sql-statements-that-cause-an-implicit-commit) and [trigger behavior](https://mariadb.com/docs/server/server-usage/triggers-events/triggers/trigger-overview). These constraints matter to the module's activation and database-invariant design.

## Assessment

| Area | Classification | Evidence | Disposition |
| --- | --- | --- | --- |
| MJL code isolation | COMPLIANT | application code is under `custom/mjlfinancement`; no core edit was found in the audit denominator | preserve |
| Native Dolibarr seams | COMPLIANT | module descriptor, hooks, rights, native objects, CSRF helpers and guarded routes are used | preserve and characterize before refactoring |
| Entity isolation | SECURITY / COMPLIANT_WITH_UNRESOLVED_EDGES | custom query owners generally pass or filter active entity; cron entity semantics remain unresolved | verify cron behavior before any multi-entity claim |
| Route authorization | SECURITY / COMPLIANT | source maps show direct guards and command-level reauthorization for sensitive actions | retain layered checks |
| Transaction result handling in references | ARCHITECTURAL_DEBT / HIGH | reference writes do not inspect `begin()` or `commit()` results | fix only with a focused failure contract and native-driver semantics established |
| Export stream error handling | RELIABILITY / MEDIUM | `GENERATED` deliberately records the complete spooled artifact before delivery, including on client abort; `fread() === false` is nevertheless treated like EOF | characterize a server read failure and return/terminate consistently without changing the generation-audit contract |
| Retained Admin password reset | SECURITY / HIGH | reset code admits Admin, while target trigger/source requires user entity to equal reset entity; retained Admin is entity 0 | reconcile the policy and schema before enabling the target path |
| PHP organization | LEGACY_COMPATIBILITY / MAINTAINABILITY | route files are mostly thin, while libraries remain procedural and some classes are large | do not force PSR-4 or class-only structure across Dolibarr entrypoints |
| Formatting/static analysis | UNRESOLVED | no confirmed lint command or PHPStan/PHP_CodeSniffer configuration | introduce only against an explicit defect-reduction goal and a measured baseline |
| JavaScript/CSS analysis | UNRESOLVED | no ESLint or Stylelint configuration; JS includes PHP-generated browser assets and Dolibarr globals | any future setup needs narrow environments and generated-asset handling |
| Database triggers | INTENTIONAL_EXCEPTION | triggers duplicate critical role/entity/immutability rules at the database boundary | preserve D4 duplication; validate exact definitions during activation |
| Activation DDL | ARCHITECTURAL_DEBT / MEDIUM | DDL can implicitly commit; activation relies on locks, guards and definition recognition rather than one atomic transaction | retain resumability and test interruption paths before simplification |
| Test runner discovery | MAINTAINABILITY / CONFIRMED_DEFECT | nested contract is undiscovered; browser test is dormant; public E2E script omits suites | make suite scope explicit before treating the scripts as complete gates |
| Design-system assertions | MAINTAINABILITY / CONFIRMED_DEFECT | four focused static assertions disagree with current CSS/template source | reconcile tests with the authoritative design state in a dedicated UI task |
| French-first/XOF behavior | COMPLIANT | UI strings and financial contracts follow French-first and integer-XOF conventions | preserve |

No formatting-only rewrite, static-analysis rollout, dependency change, or runtime correction is authorized by this audit. Each proposed tool or code change needs a current requirement and the smallest focused verification that proves it.
