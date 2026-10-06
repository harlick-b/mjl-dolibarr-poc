# Regression baseline

## Public commands and actual coverage

| Command | Declared role | Audit result |
| --- | --- | --- |
| `npm test` | `run-suite.js all`, a broader orchestrated selection | not run; its complete branch includes work beyond the required single unit attempt |
| `npm run test:unit` | Node unit files followed by top-level PHP contracts | interrupted with exit 130 after more than two minutes with only the suite header; the command did not reach a trustworthy aggregate result |
| `npm run test:verify` | disposable/container verification | not run; broad container-backed execution was outside this read-only audit |
| `npm run test:e2e` | an explicit Playwright batch | not run; the script does not represent every file in the Playwright configuration |
| `npm run test:manual-accessibility` | manual accessibility support | not run; no human review was requested |

The E2E script's explicit file list omits auth, reconciliation, reset and visual-UI groups that exist in the configured test tree. A passing `npm run test:e2e` therefore must not be described as complete Playwright coverage.

All 31 E2E files were read in full. Several selected files perform substantial infrastructure work: `fixture-isolation.spec.js` launches nested disposable lifecycle probes and intentional failure/retention cases, `reset-boundaries.spec.js` launches signal/cleanup probes, and planning tests create large fixtures plus real lock-timeout/deadlock cases. Their inclusion prevents the `e2e` mode from being treated as a lightweight browser-only check.

## Focused execution evidence

### Audit-closure delta

- `php tests/contracts/reference_transaction_test.php`: PASS. The contract covers failed transaction start for all three reference mutation functions, failed commit including no-op paths, rollback attempts, and connection closure when rollback fails.
- `npm run test:auth`: PASS, 12/12 in one isolated disposable tenant. The suite proves retained technical Admin request, active-entity reset storage, token consumption, password change and entry into OTP verification. It also proves the legacy native `pass` column remains `NULL` after both reset and invitation acceptance. Containers, network and volumes were removed.
- `npm run test:phase3a`: PASS. The runner exercised the complete RST-006B interruption matrix, including four new failure points after the early Operation-check DDL stages, then passed 27/27 Playwright tests covering execution, authorization, database guards and document containment. Containers, network and volumes were removed.
- `php -l` passed for all changed application PHP files. `node --check` passed for all changed JavaScript files. `git diff --check` passed before documentation reconciliation.

No shared tenant was mutated. The focused results supersede the original "no auth E2E" and "reference failure behavior uncharacterized" gaps only; they do not erase the broader baseline qualifications below.

The 17 discovered Node unit files were invoked separately with a 20-second ceiling to diagnose the aggregate hang:

- 7 completed successfully: access-audit fail-closed, disposable evidence, disposable fixture request, disposable policy, document containment boundaries, financial preview, and operational script boundary.
- 9 exited nonzero: audit projection, dashboard projection, design system v3, disposable run, execution projection, export spool, monitoring reports, navigation shell, and report format.
- timeline presentation exceeded the 20-second ceiling.

Several nonzero files attempt to spawn PHP and reported `EPERM` in the managed sandbox. Those results are environment-limited and are not evidence that the application behavior fails. The design-system file independently reported four static assertion failures against the current CSS/template source, so that verification drift is a source-supported failure. The timeline timeout remains unresolved.

Full source inspection also found static selector drift in older E2E files. Twenty files across the complete E2E tree use the former login button label `Connexion`, while the current template renders `Se connecter`. `reset-boundaries.spec.js` additionally expects former forgot-password labels and a labeled verifier control that current source does not render. `activity-planning.spec.js` fills named date inputs directly even though enhanced mode hides them and creates nameless visible controls. These are test/source contradictions; deciding whether the test or product should change requires the authoritative UI decision for each surface.

Four top-level PHP contracts were invoked directly and passed: navigation registry, page header, project form security, and table presentation. `tests/contracts/container/dashboard_resilience_test.php` was not discovered by the top-level-only runner and references an absent `mjl_dashboard.lib.php`; it is dormant historical coverage.

Commands used, from the recorded host environment in `00-baseline.md`:

```bash
env -u MJL_TEST_RETAIN npm run test:unit
timeout 20s node --test tests/unit/<discovered-file>.test.js
php tests/contracts/<top-level-contract>.php
```

The first command was run once and interrupted with `Ctrl-C` after more than two minutes (exit 130). Each discovered Node unit file was then run once; there were no retries. Each of the four named top-level contracts was run once. These host-only commands created no disposable tenant, so there was no container setup or cleanup result. Their console results were observed in-session; no durable raw-output artifact was created.

During the immutable baseline pass, no E2E, disposable-tenant, database mutation, application login, bootstrap, module activation, or shared-tenant operation was performed. The later closure waves ran the focused reference contract, disposable auth suite and disposable Phase 3A migration/browser suite described above; none mutated the shared tenant.

## Coverage map

| Surface | Existing evidence | Gap |
| --- | --- | --- |
| access and audit fail-closed behavior | focused Node assertions passed; auth and Phase 3A runtime requests reject forbidden access and invalid direct mutations | runtime execution covers focused surfaces rather than every mapped route |
| document containment | focused Node assertions passed; guarded routes mapped | Apache loaded configuration not verified |
| financial preview | focused Node assertions passed | does not prove database write behavior |
| navigation/page/table presentation | four PHP contracts passed | runner would skip these when an earlier Node file fails or hangs |
| auth/invitation/reset/OTP | focused auth E2E passed 12/12, including retained Admin reset and encrypted-only storage after both password-write flows | external email delivery and operator configuration remain outside this gate |
| workflows and transactions | reference begin/commit/rollback failure contract passed; source map and extensive test sources remain | broader workflow PHP child-process execution was sandbox-limited |
| exports | source and test bodies specify durable `GENERATED` evidence even after client abort | server `fread()` failure and post-commit cleanup retry behavior remain unresolved |
| visual design | production frontend fully inspected | focused design assertions currently fail; human accessibility matrix outstanding |
| lifecycle and Phase 3A execution | exact RST-006B interruption matrix and 27/27 browser checks passed | historical runner provisioning and deadline handling remain medium verification debt |
| multi-entity behavior | entity filters mapped | cron semantics and live shared schema not verified |

Textual test declarations are an inventory aid only: the tree contains 106 Node-unit `test(...)` declarations and 225 Playwright `test(...)` declarations. These counts do not imply execution, independence, or requirement coverage.

## Runner risks to preserve or correct deliberately

- Disposable runners' preflight, tenant isolation, cleanup and integrity evidence are security controls.
- Two worker fixtures load Dolibarr before caller-side preflight; this ordering deserves correction before relying on the affected modes.
- The dormant browser-foundation test defaults to the shared port 8080 without disposable preflight and must not be run there.
- Shared-integrity evidence hashes read-only `SELECT *` snapshots as well as metadata. It should not be weakened to schema-only evidence.
- `MJL_TEST_RETAIN` was explicitly removed from the environment for the attempted run so a stale value could not retain fixtures.

This qualified baseline is sufficient to protect the first architecture proposal and migration-wave design. It establishes what was executed and observed; it does not establish user acceptance or production readiness.
