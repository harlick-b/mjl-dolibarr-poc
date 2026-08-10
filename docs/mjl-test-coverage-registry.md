# MJL Test Coverage Registry

This is the durable Gate 1 audit and coverage registry for the MJL verification system. Target behavior follows `docs/mjl-authoritative-decisions.md`; current-state evidence that is not yet approved is explicitly classified as characterization.

## Gate 2 implementation evidence

Gate 1 was approved on 2026-08-03 and Gate 2 is implemented. The maintained
suite now has:

- **114 blocking Playwright cases** behind 12 capability-named public specs;
- **28 executable characterization cases** behind two non-blocking public specs;
- **31 Node unit contracts** across runner isolation, cleanup, diagnostics, fixture-marker boundaries, deprecated-vocabulary rejection,
  verification-entrypoint behavior, the operational-script boundary, and the
  concurrently supplied v3 token contract;
- **7 PHP contracts** for durable behavior, presentation convergence,
  navigation, page headers, project-form security, table presentation, and
  verification-module safety;
- one current container-verification layer covering seven schema/data modules,
  sample data, three scope/integrity modules, activity workflow, expense
  workflow, traceability/exports, and dashboard resilience;
- **1 interactive real-application accessibility gate**.

Recorded disposable results:

| Command | Result | Tenant evidence |
| --- | --- | --- |
| `npm run test:unit` | Passed | No Docker tenant required. |
| `npm run test:verify` | Passed in 184.1 seconds | Unique loopback tenant; containers, network, and named volumes removed. |
| `npm run test:e2e` | Pre-final affected run: 113/113 passed; runner duration 399.2 seconds. The later strengthened inventory is included in the final `npm test` row. | Tenant `mjl-test-20260804t162004-941966-e614149e`, loopback port 46207; containers, network, and named volumes removed. |
| `npm run test:characterization` | Final C1/C2 evidence: 28/28 passed; runner duration 238.1 seconds including bootstrap. | Tenant `mjl-test-20260805t123629-44505-8ff6b050`, loopback port 33319; containers, network, and named volumes removed. |
| `npm run audit:production-readiness` | Final diagnostic: 11 local checks OK, 9 client/operator confirmations UNKNOWN, verdict `BLOCKED_PENDING_CLIENT_AND_OPERATOR_CONFIRMATION`; runner duration 176.0 seconds. | Tenant `mjl-test-20260805t124037-61357-2c67e47b`, loopback port 38347; containers, network, and named volumes removed. |
| `npm test` | Final strengthened-remediation proof: 31/31 Node contracts, 7/7 PHP contracts, complete container verification, and 114/114 blocking browser cases passed; runner duration 475.0 seconds. | Tenant `mjl-test-20260805t124354-71091-ed08d24c`, loopback port 36037; containers, network, database volume, and document volume removed. |

The interactive accessibility gate remains unsigned and must not be represented
as automated evidence. It cannot emit `signed_pass` without reviewer identity,
assistive-technology evidence, non-empty notes, an explicit pass verdict, and a
record for each of the 90 archetype/width/zoom combinations.

## Audit baseline

- Audit date: 2026-08-03.
- Current discovery snapshot: **253 Playwright cases in 26 files**. Three expense create/edit/recovery cases appeared after the 249-case baseline and passed a targeted disposable run (**3/3 in 49.3 seconds**). A later convention presentation-state case passed its own disposable run (**1/1 in 7.4 seconds**).
- Other verification: **5 Node isolation cases, 4 PHP isolation entrypoints, 2 manual cases, and 16 PHP schema/smoke/readiness entrypoints**.
- Disposable Playwright baseline: **185 passed, 10 failed, 54 did not run**, exit 1.
- Measured Playwright duration: **754 seconds (12.5 minutes)**, excluding first-start Compose readiness.
- Cleanup evidence: the disposable containers, volumes, network, and temporary bind directories were absent after teardown.
- The baseline used the existing bind-based Phase 3D override. Gate 2 replaces it with named volumes because the feasibility run proved root-owned bind contents cannot be reliably removed by the host runner.

### Baseline failures

| Existing case | Finding |
| --- | --- |
| `native-boundary-current-state.spec.js:68` | Assumes a tenant bootstrapped before the primary suite; times out on a clean tenant. |
| `phase10-email-templates.spec.js:120` and `phase4-auth-access.spec.js:108` | Stale exact invitation-success wording. |
| `phase11r-reports-exports-alignment.spec.js:71` and `phase9-tables-exports.spec.js:137` | Stale exact report-center heading. |
| `phase14-convention-management.spec.js:82` | Ambiguous `Fin` label selector after the current navigation/header design. |
| `phase2-v2-operational-components.spec.js:1399` | Historical mixed table/execution test conflicts with the new dedicated execution state. |
| `phase5-workspace-shell.spec.js:190` and `phase6-level-dashboards.spec.js:141` | Stale exact supervision wording. |
| `phase8-alerts-risks.spec.js:113` | Non-unique missing-document text locator. |

### Non-Playwright baseline

- Node isolation: **5/5 passed**.
- PHP isolation entrypoints: **4/4 passed**.
- PHP schema, fixture, smoke, integrity, and readiness entrypoints: **16/16 reported exit 0 individually** in a disposable tenant.
- The production-readiness diagnostic reported the expected deployment-dependent `UNKNOWN` values for email transport, public base URL, secrets, backup/restore, and monitoring/log retention.
- The PHP wrapper process returned 1 after all sixteen recorded successes; teardown nevertheless removed its containers, network, volumes, and temporary directory. Treat this as runner/orchestration evidence for Gate 2, not an application-test failure.

## Authority codes

| Code | Contract |
| --- | --- |
| A1 | Invitation-only access, Admin invitations, production roles, no public registration, guarded workspace/native boundary. |
| A2 | Active entity, assigned Partenaire / Programme scope, unresolved-data fail-closed behavior, direct URL/POST guards. |
| A3 | Activity/expense workflow, actor separation, no-self decisions, final validation distinct from disbursement. |
| A4 | Project creation/editing inside MJL for the confirmed roles. |
| A5 | Read-only global Documents, contextual uploads, guarded and audited downloads. |
| A6 | Contextual exchanges and supervision/audit-only aggregate access. |
| A7 | French server-filtered CSV/XLSX, stable format/name, safe cells, export auditing and fail-closed delivery. |
| D1 | Active semantic/accessibility design rules; no phase-specific pixel, color, class, or wording snapshots. |
| P1 | The approved cleanup plan's durable verification requirements, including functional email behavior and balanced test layers. |
| C1 | Current convention, budget-line, and fund-receipt management roles/lifecycle behavior retained as non-blocking characterization pending explicit product authority. |
| C2 | Current admission to supervision, reports/exports, validation history, workflow history, and exchange history, with route-by-route scope filtering, retained as non-blocking characterization pending explicit product authority. |
| S1 | Current schema and current-data integrity only; historical upgrade entrypoints are not retained. |
| O1 | Operational fixture/readiness evidence, not a product acceptance contract. |

## Classification totals

Across all **280** audited Playwright, isolation, manual, and PHP entries:

- authoritative: 208
- characterization: 25
- duplicate: 19
- implementation-shape: 6
- manual evidence: 2
- migration-only: 7
- operational check: 3
- stale: 10

## Playwright case dispositions

| ID | Existing case | Baseline | Class | Authority | Risk | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| E2E-001 | native-boundary-current-state.spec.js - current runtime keeps MJL pages inside MJL shell before bootstrap E2E runs | FAIL | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-002 | native-boundary-current-state.spec.js - current runtime blocks direct native browser routes before bootstrap E2E runs | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-003 | native-boundary-current-state.spec.js - current runtime preserves auth helper routes outside the native block | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-004 | phase05-expense-disbursement-workflow.spec.js - expense moves through prevalidation, final validation, and disbursement with audited amounts | PASS | duplicate | A2/A3 | Behavior regression | Fuse authoritative behavior → expenses.spec.js |
| E2E-005 | phase05-expense-disbursement-workflow.spec.js - missing document and overspend block final approval paths | PASS | duplicate | A5 | Document IDOR/audit | Fuse authoritative behavior → documents-audit.spec.js |
| E2E-006 | phase05-expense-disbursement-workflow.spec.js - wrong role and self-action direct POST attempts are rejected | PASS | duplicate | A2/A3 | Workflow integrity | Fuse authoritative behavior → expenses.spec.js |
| E2E-007 | phase1-v2-shell-foundation.spec.js - workspace exposes skip access and the exact current navigation location | PASS | stale | A1/A2 | Unauthorized access/data leakage | Rewrite authoritative/semantic subset → access-shell.spec.js |
| E2E-008 | phase1-v2-shell-foundation.spec.js - role dashboards retain one exact current location and unresolved access fails closed | PASS | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-009 | phase1-v2-shell-foundation.spec.js - workspace keeps focus visible and navigation usable across review widths | PASS | authoritative | D1 | Accessibility/usability regression | Rewrite → access-shell.spec.js |
| E2E-010 | phase1-v2-shell-foundation.spec.js - semantic action and focus tokens resolve to approved contrast pairs | PASS | stale | D1 | Accessibility/usability regression | Rewrite computed-contrast behavior without exact color pairs → access-shell.spec.js |
| E2E-011 | phase1-v2-shell-foundation.spec.js - shared page headers and touched shell labels use consistent French semantics | PASS | authoritative | D1 | Accessibility/usability regression | Rewrite → access-shell.spec.js |
| E2E-012 | phase1-v2-shell-foundation.spec.js - primary sections share the page-header contract and contextual audit location | PASS | authoritative | D1 | Accessibility/usability regression | Rewrite → access-shell.spec.js |
| E2E-013 | phase1-v2-shell-foundation.spec.js - forbidden shell presents one clear and keyboard-visible safe return action | PASS | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-014 | phase10-email-templates.spec.js - invitation and password reset emails use MJL templates and keep auth flows working | FAIL | authoritative | A1/P1 | Account security | Rewrite → email-notifications.spec.js |
| E2E-015 | phase10-email-templates.spec.js - activity submission notifies validators once per email address | NOT RUN | authoritative | A3/P1 | Behavior regression | Rewrite → email-notifications.spec.js |
| E2E-016 | phase10-email-templates.spec.js - correction, prevalidation, final validation, and rejection notify expected users | NOT RUN | authoritative | A3/P1 | Behavior regression | Rewrite → email-notifications.spec.js |
| E2E-017 | phase10-email-templates.spec.js - notrigger workflow calls do not send workflow emails | NOT RUN | authoritative | A3/P1 | Behavior regression | Rewrite → email-notifications.spec.js |
| E2E-018 | phase10-email-templates.spec.js - alert templates render but scheduled alert sending is absent | NOT RUN | stale | P1 | Misleading or leaked supervision data | Rewrite durable template rendering; delete absence assertion → email-notifications.spec.js |
| E2E-019 | phase10r-dashboards-alignment.spec.js - production role dashboards use role-specific sections and no legacy dashboard wording | PASS | authoritative | A2/D1 | Unauthorized access/data leakage | Retain role/scope security only; delete wording snapshot → dashboards-alerts.spec.js |
| E2E-020 | phase10r-dashboards-alignment.spec.js - dashboard filters scope cards, queues, funds, budgets, and audit rows | PASS | authoritative | A2/D1 | Unauthorized access/data leakage | Rewrite → dashboards-alerts.spec.js |
| E2E-021 | phase10r-dashboards-alignment.spec.js - final validator and platform admin stay distinct on filtered supervision | PASS | authoritative | A2/D1 | Behavior regression | Rewrite → dashboards-alerts.spec.js |
| E2E-022 | phase10r-dashboards-alignment.spec.js - direct dashboard access remains guarded for non-supervision users | PASS | authoritative | A2/D1 | Unauthorized access/data leakage | Rewrite → dashboards-alerts.spec.js |
| E2E-023 | phase11-expense-workflow.spec.js - Level 1 opens own expense detail, uploads document, submits, and loses missing-document alert | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-024 | phase11-expense-workflow.spec.js - Level 1 cannot open another operational user expense or another entity expense | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → expenses.spec.js |
| E2E-025 | phase11-expense-workflow.spec.js - Level 2 prevalidates submitted expense, DPAF final-validates it, and ECM-only document fallback remains available | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-026 | phase11-expense-workflow.spec.js - Direct document downloads reject unauthorized or unsafe ECM rows | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-027 | phase11-expense-workflow.spec.js - Missing document blocks validation UI and direct POST | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-028 | phase11-expense-workflow.spec.js - Unavailable referenced document blocks validation and stays visible in alerts | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-029 | phase11-expense-workflow.spec.js - Reject, correct, and resubmit preserves decision comments | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → expenses.spec.js |
| E2E-030 | phase11-expense-workflow.spec.js - Self reviewer decisions are absent from UI and blocked server-side | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → expenses.spec.js |
| E2E-031 | phase11-expense-workflow.spec.js - Tampered create POST with mismatched project and convention is rejected server-side | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → expenses.spec.js |
| E2E-032 | phase11-expense-workflow.spec.js - DPAF, Admin, and unresolved legacy reader visibility stays role-aware | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → expenses.spec.js |
| E2E-033 | phase11r-reports-exports-alignment.spec.js - report center denies unauthorized users and avoids legacy wording | FAIL | authoritative | A7 | Unauthorized access/data leakage | Retain access denial only; delete wording snapshot → reports-exports.spec.js |
| E2E-034 | phase11r-reports-exports-alignment.spec.js - final validator and Admin can export scoped CSV and XLSX with stable names | NOT RUN | authoritative | A7 | Unauthorized access/data leakage | Rewrite → reports-exports.spec.js |
| E2E-035 | phase11r-reports-exports-alignment.spec.js - partner/project tampering fails closed and POST token is required | NOT RUN | authoritative | A7 | Safe failure/data integrity | Rewrite → reports-exports.spec.js |
| E2E-036 | phase11r-reports-exports-alignment.spec.js - general audit hides generic report audit rows from scoped users but Admin can see them | NOT RUN | authoritative | A7 | Unauthorized access/data leakage | Rewrite → reports-exports.spec.js |
| E2E-037 | phase14-convention-management.spec.js - DPAF receives convention write without routine operation rights | PASS | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-038 | phase14-convention-management.spec.js - DPAF creates, edits, activates, closes, and views convention history | FAIL | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-039 | phase14-convention-management.spec.js - Admin can open convention management, while non-DPAF direct access and POST are blocked | NOT RUN | characterization | C1 | Unauthorized access/data leakage | Rewrite → tests/characterization/finance.spec.js |
| E2E-040 | phase14-convention-management.spec.js - Linked conventions reject locked-field edits and store sanitized unsafe history | NOT RUN | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-041 | phase14-convention-management.spec.js - Unlinked draft deletion works but linked deletion is blocked | NOT RUN | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-042 | phase14-convention-management.spec.js - Only active conventions can be selected or posted for new activities and expenses | NOT RUN | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-043 | phase15-budget-line-management.spec.js - DPAF receives budget-line write without routine operation rights | PASS | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-044 | phase15-budget-line-management.spec.js - DPAF creates, edits, activates, filters, and views budget-line history | PASS | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-045 | phase15-budget-line-management.spec.js - Admin can open management, while Agent direct URL and POST are blocked | PASS | characterization | C1 | Behavior regression | Rewrite → tests/characterization/finance.spec.js |
| E2E-046 | phase15-budget-line-management.spec.js - Draft convention is unavailable and rejected for budget-line creation | PASS | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-047 | phase15-budget-line-management.spec.js - Locked edits, revised-budget floor, and computed amount tampering are rejected or recalculated | PASS | characterization | C1 | Safe failure/data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-048 | phase15-budget-line-management.spec.js - Inactive budget lines cannot be used by expense create, submit, or validate | PASS | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-049 | phase16-fund-receipt-management.spec.js - DPAF receives fund-receipt write without native ECM or routine operation rights | PASS | characterization | A5 | Document IDOR/audit | Rewrite → tests/characterization/finance.spec.js |
| E2E-050 | phase16-fund-receipt-management.spec.js - DPAF creates, edits, uploads proof, marks received, and sees report/dashboard impact | PASS | characterization | A5/C1 | Financial data integrity and document audit | Split: finance lifecycle → tests/characterization/finance.spec.js; guarded proof behavior → documents-audit.spec.js |
| E2E-051 | phase16-fund-receipt-management.spec.js - Seeded fund receipt proof labels prefer public ECM filenames over stored document ids | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-052 | phase16-fund-receipt-management.spec.js - Global programme envelope can create a fund receipt without project | PASS | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-053 | phase16-fund-receipt-management.spec.js - Fund proof label resolution ignores path-tampered rows when a valid download exists | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-054 | phase16-fund-receipt-management.spec.js - Received transition is blocked without proof and draft conventions are rejected | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-055 | phase16-fund-receipt-management.spec.js - Not-received receipts are finalized, zeroed, and excluded from totals | PASS | characterization | C1 | Behavior regression | Rewrite → tests/characterization/finance.spec.js |
| E2E-056 | phase16-fund-receipt-management.spec.js - Agent and read-only users are blocked from mutations and fund proof downloads | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-057 | phase16-fund-receipt-management.spec.js - Fund proof downloads allow valid DPAF rows and deny cross-object, cross-entity, orphan, and path-tampered rows | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-058 | phase18-activity-convention-documents.spec.js - Activity creator uploads and downloads a direct activity document | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-059 | phase18-activity-convention-documents.spec.js - DPAF uploads and downloads an activity document without activity write | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-060 | phase18-activity-convention-documents.spec.js - Activity direct downloads deny unrelated Level 1, cross-entity, orphan, and path-tampered ECM rows | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-061 | phase18-activity-convention-documents.spec.js - Activity document states show available, unavailable, and missing labels | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-062 | phase18-activity-convention-documents.spec.js - DPAF uploads and downloads convention documents; normal users are denied direct convention downloads | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-063 | phase18-activity-convention-documents.spec.js - Convention direct downloads deny cross-entity, orphan, and path-tampered ECM rows | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-064 | phase18-activity-convention-documents.spec.js - Convention document states show available, unavailable, and missing labels; closed conventions block uploads | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-065 | phase18-activity-convention-documents.spec.js - Workflow audit, DPAF dashboard, and reports label document uploads explicitly | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-066 | phase2-v2-operational-components.spec.js - shared UI vocabulary separates business status and renders unknown values safely | PASS | authoritative | D1 | Behavior regression | Relocate → behavior_contracts_test.php |
| E2E-067 | phase2-v2-operational-components.spec.js - activity recovery registry is exact and excludes upload or unknown actions | PASS | authoritative | A2/A3 | Safe failure/data integrity | Relocate → behavior_contracts_test.php |
| E2E-068 | phase2-v2-operational-components.spec.js - timeline presentation registry covers emitted and legacy values without raw fallbacks | PASS | authoritative | D1 | Behavior regression | Relocate → behavior_contracts_test.php |
| E2E-069 | phase2-v2-operational-components.spec.js - unknown legacy audit values render neutral labels on guarded activity and audit routes | PASS | authoritative | A2/A3 | Accessibility/usability regression | Rewrite → activities.spec.js |
| E2E-070 | phase2-v2-operational-components.spec.js - activity JavaScript has one route owner and shared components remain shell-owned | PASS | implementation-shape | - | No durable product risk | Delete - no durable replacement |
| E2E-071 | phase2-v2-operational-components.spec.js - real activity info and success badges use approved computed colors and contrast | PASS | stale | A2/A3 | Accessibility/usability regression | Rewrite durable subset → activities.spec.js |
| E2E-072 | phase2-v2-operational-components.spec.js - activity script loads once before shared components and nowhere else | PASS | implementation-shape | - | No durable product risk | Delete - no durable replacement |
| E2E-073 | phase2-v2-operational-components.spec.js - partial-result aggregation preserves successful items and stable ordering | PASS | authoritative | D1 | Accessibility/usability regression | Relocate → behavior_contracts_test.php |
| E2E-074 | phase2-v2-operational-components.spec.js - partial timeline and alert warnings render successful content without technical leakage | PASS | authoritative | A2/D1 | Misleading or leaked supervision data | Rewrite → dashboards-alerts.spec.js |
| E2E-075 | phase2-v2-operational-components.spec.js - activity route distinguishes an initially empty scope from filtered-empty recovery | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-076 | phase2-v2-operational-components.spec.js - exact activity execution failures translate only to their linked fields | PASS | authoritative | A2/A3 | Behavior regression | Relocate → behavior_contracts_test.php |
| E2E-077 | phase2-v2-operational-components.spec.js - form recovery handles are opaque, one-use, bounded, and context-bound | PASS | authoritative | A2/A3 | Safe failure/data integrity | Relocate core isolation → behavior_contracts_test.php; browser recovery stays in capability suites |
| E2E-078 | phase2-v2-operational-components.spec.js - technical logging redacts sensitive values, SQL, and paths | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → `tests/contracts/behavior_contracts_test.php` |
| E2E-079 | phase2-v2-operational-components.spec.js - table request normalization fails closed and clamps safe pages | PASS | authoritative | A2/A3 | Accessibility/usability regression | Relocate → behavior_contracts_test.php |
| E2E-080 | phase2-v2-operational-components.spec.js - activity form progressively enhances linked French validation errors | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-081 | phase2-v2-operational-components.spec.js - activity server recovery retains safe values once and rejects invalid security context | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-082 | phase2-v2-operational-components.spec.js - two tabs keep recovery isolated and expired or cross-context handles reveal nothing | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-083 | phase2-v2-operational-components.spec.js - activity form keeps native validation without JavaScript | PASS | authoritative | D1 | Accessibility/usability regression | Rewrite durable no-JavaScript form behavior → activities.spec.js |
| E2E-084 | phase2-v2-operational-components.spec.js - activity recovery is isolated by exact action and absent for upload failures | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-085 | phase2-v2-operational-components.spec.js - activity list exposes normalized filters, eight columns, and fail-closed empty state | PASS | stale | A2/A3 | Behavior regression | Rewrite durable subset → activities.spec.js |
| E2E-086 | phase2-v2-operational-components.spec.js - activity table retains semantic desktop layout at 1366px/1024px and labeled cards at 768px/390px | FAIL | authoritative | A2/A3 | Accessibility/usability regression | Rewrite → activities.spec.js |
| E2E-087 | phase2-v2-operational-components.spec.js - activity pagination retains normalized sort and filter queries at boundaries | NOT RUN | authoritative | A2/A3 | Behavior regression | Rewrite → activities.spec.js |
| E2E-088 | phase2-v2-operational-components.spec.js - expense consequences remain visible in dedicated action states with and without JavaScript | NOT RUN | authoritative | A3/D1 | Workflow and accessibility regression | Rewrite durable state/consequence behavior → expenses.spec.js |
| E2E-089 | phase2-v2-operational-components.spec.js - stale, invalid-token, and premature expense decisions remain server-rejected | NOT RUN | authoritative | A2/A3 | Workflow integrity | Rewrite → expenses.spec.js |
| E2E-090 | phase2-v2-operational-components.spec.js - repeated submission is rejected and repeated correction cycles stay strictly chronological | NOT RUN | authoritative | A2/A3 | Behavior regression | Rewrite → expenses.spec.js |
| E2E-091 | phase2-v2-operational-components.spec.js - Phase 2 expense decisions are exact-one with fresh-token stale replays | NOT RUN | authoritative | A2/A3 | Workflow integrity | Rewrite → expenses.spec.js |
| E2E-092 | phase2-v2-operational-components.spec.js - invalid CSRF and near-simultaneous clients cannot duplicate a final decision | NOT RUN | authoritative | A2/A3 | Workflow integrity | Rewrite → expenses.spec.js |
| E2E-093 | phase2-v2-operational-components.spec.js - Phase 2 seam proves all four no-self decisions through UI and direct POST | NOT RUN | authoritative | A2/A3 | Workflow integrity | Rewrite → expenses.spec.js |
| E2E-094 | phase3-partners-project-finance.spec.js - partner list/detail stay inside assigned partner scope and finance reference pages are blocked | PASS | authoritative | A2/A4 | Unauthorized access/data leakage | Rewrite → partners-projects.spec.js |
| E2E-095 | phase3-partners-project-finance.spec.js - partner workspace shows 5R portfolio metrics without leaking cross-scope rows | PASS | stale | A2/A4 | Unauthorized access/data leakage | Rewrite durable subset → partners-projects.spec.js |
| E2E-096 | phase3-partners-project-finance.spec.js - UNICEF project detail excludes cross-scope related rows and aggregates | PASS | authoritative | A2/A4 | Unauthorized access/data leakage | Rewrite → partners-projects.spec.js |
| E2E-097 | phase3-partners-project-finance.spec.js - admin sees all partners and final validator can create and edit projects while lower roles cannot | PASS | authoritative | A2/A4 | Unauthorized access/data leakage | Rewrite → partners-projects.spec.js |
| E2E-098 | phase3-partners-project-finance.spec.js - public registration remains absent | PASS | authoritative | A2/A4 | Behavior regression | Rewrite → partners-projects.spec.js |
| E2E-099 | phase3-v2-core-journeys.spec.js - Phase 3A journey presentation escapes content and accepts only controlled states | PASS | authoritative | D1 | Behavior regression | Rewrite → `tests/contracts/behavior_contracts_test.php` |
| E2E-100 | phase3-v2-core-journeys.spec.js - Phase 3A table contract retains additive filters and uses resource-aware labels | PASS | authoritative | D1 | Accessibility/usability regression | Rewrite → `tests/contracts/table_presentation_test.php` and representative browser lists |
| E2E-101 | phase3-v2-core-journeys.spec.js - Phase 3 finance row and count queries share exact scope/filter fragments | PASS | implementation-shape | D1 | Unauthorized access/data leakage | Delete source scan; behavior covered by `verification/scope/access_model.php` and scoped browser lists |
| E2E-102 | phase3-v2-core-journeys.spec.js - Phase 3 count-query failure remains distinct from a successful row source | PASS | authoritative | A2/A3 | Behavior regression | Rewrite → `tests/contracts/container/dashboard_resilience_test.php` |
| E2E-103 | phase3-v2-core-journeys.spec.js - Phase 3 dedicated evidence ledger binds every mandatory gate to an executed regression | PASS | implementation-shape | - | No durable product risk | Delete - no durable replacement |
| E2E-104 | phase3-v2-core-journeys.spec.js - Phase 3A project recovery registry is exact and excludes uploads or unknown actions | PASS | authoritative | A2/A4 | Safe failure/data integrity | Rewrite → partners-projects.spec.js |
| E2E-105 | phase3-v2-core-journeys.spec.js - Phase 3A portfolio routes expose scoped filters, deterministic sorts, and retained drill-down context | PASS | authoritative | A2/A4 | Unauthorized access/data leakage | Rewrite → partners-projects.spec.js |
| E2E-106 | phase3-v2-core-journeys.spec.js - Phase 3A project create recovery preserves allowlisted fields once with linked errors | PASS | authoritative | A2/A4 | Safe failure/data integrity | Rewrite → partners-projects.spec.js |
| E2E-107 | phase3-v2-core-journeys.spec.js - Phase 3B expense recovery registry is exact and excludes security or upload failures | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → expenses.spec.js |
| E2E-108 | phase3-v2-core-journeys.spec.js - Phase 3B recovery handles stay isolated by route and remain one-use | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → `tests/contracts/behavior_contracts_test.php` and `project_form_security_test.php` |
| E2E-109 | phase3-v2-core-journeys.spec.js - Phase 3B expense list retains scoped filters and exposes resource-aware pagination | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → expenses.spec.js |
| E2E-110 | phase3-v2-core-journeys.spec.js - Phase 3B expense and global document surfaces use guarded shared presentation states | PASS | authoritative | A2/A3 | Document IDOR/audit | Rewrite → expenses.spec.js |
| E2E-111 | phase3-v2-core-journeys.spec.js - Phase 3B expense create recovery is exact, one-use, and keeps linked safe values | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → expenses.spec.js |
| E2E-112 | phase3-v2-core-journeys.spec.js - Phase 3C finance recovery registries are exact and exclude uploads, deletes, and unknown actions | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → `tests/contracts/behavior_contracts_test.php` |
| E2E-113 | phase3-v2-core-journeys.spec.js - Phase 3 remediation recovery registry leaf rejects every malformed registry as a whole | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → `tests/contracts/behavior_contracts_test.php` |
| E2E-114 | phase3-v2-core-journeys.spec.js - Phase 3 remediation recovery wrappers load standalone through the shared leaf | PASS | implementation-shape | A2/A3 | Safe failure/data integrity | Delete source scan; standalone loading is exercised by `tests/contracts/behavior_contracts_test.php` |
| E2E-115 | phase3-v2-core-journeys.spec.js - Phase 3 remediation finance update reasons reject semantic blanks and standard wrappers fail closed | PASS | authoritative | A2/A3 | Financial data integrity | Rewrite → `tests/contracts/behavior_contracts_test.php` |
| E2E-116 | phase3-v2-core-journeys.spec.js - Phase 3 remediation workflow cleanup deletes only matching audit identity for the same fixture target | PASS | authoritative | A2 | Unauthorized access/data leakage | Fuse into workflow browser cases with target-specific cleanup |
| E2E-117 | phase3-v2-core-journeys.spec.js - Phase 3C finance failures keep technical diagnostics out of browser messages | PASS | implementation-shape | A2/A3 | Safe failure/data integrity | Delete source scan; behavior covered by `tests/contracts/behavior_contracts_test.php` |
| E2E-118 | phase3-v2-core-journeys.spec.js - Phase 3 remediation finance feedback classifies only exact allowlisted domain failures | PASS | authoritative | A2/A3 | Financial data integrity | Rewrite → `tests/contracts/behavior_contracts_test.php` |
| E2E-119 | phase3-v2-core-journeys.spec.js - Phase 3 remediation finance source queries expose canonical feedback without raw diagnostics | PASS | authoritative | D1 | Safe failure/data integrity | Rewrite → `tests/contracts/behavior_contracts_test.php` and finance browser error paths |
| E2E-120 | phase3-v2-core-journeys.spec.js - Phase 3 remediation finance feedback rejects tampering and filters recovery errors exactly | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → `tests/contracts/behavior_contracts_test.php` |
| E2E-121 | phase3-v2-core-journeys.spec.js - Phase 3C integrity registry resolves valid report anchors and preserves missing-target detection | PASS | authoritative | A2 | Export integrity/data leakage | Relocate → verify-scope-integrity |
| E2E-122 | phase3-v2-core-journeys.spec.js - Phase 3C dashboard source failure stays local while successful cards survive | PASS | authoritative | A2/A3 | Misleading or leaked supervision data | Rewrite → `tests/contracts/container/dashboard_resilience_test.php` |
| E2E-123 | phase3-v2-core-journeys.spec.js - Phase 3 shared form summaries do not link form-level errors to missing controls | PASS | authoritative | D1 | Safe failure/data integrity | Rewrite → `tests/contracts/behavior_contracts_test.php` |
| E2E-124 | phase3-v2-core-journeys.spec.js - Phase 3C finance recovery is opaque, one-use, and keeps only registered values | PASS | characterization | C1 | Safe failure/data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-125 | phase3-v2-core-journeys.spec.js - Phase 3 remediation links only exact finance field errors and keeps composite failures form-level | PASS | characterization | C1 | Safe failure/data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-126 | phase3-v2-core-journeys.spec.js - Phase 3 remediation renders every finance decision precondition in its recoverable production form | PASS | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-127 | phase3-v2-core-journeys.spec.js - Phase 3 remediation forbids every supplied positive unknown finance relationship even when a sibling is missing | PASS | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-128 | phase3-v2-core-journeys.spec.js - Phase 3C finance lists retain partner filters, deterministic sorts, and resource pagination | PASS | characterization | C1 | Financial data integrity | Rewrite → tests/characterization/finance.spec.js |
| E2E-129 | phase3-v2-core-journeys.spec.js - Phase 3 real 51+ lists expose first, middle, and last 50-row pages with retained scope | PASS | authoritative | A2/D1 | Unauthorized access/data leakage | Fuse → `tests/contracts/table_presentation_test.php` plus scoped browser list cases |
| E2E-130 | phase3-v2-core-journeys.spec.js - Phase 3C dashboards and reports expose richer local context without changing export actions | PASS | authoritative | A2/A7/D1 | Export integrity/data leakage | Rewrite → dashboards-alerts.spec.js / reports-exports.spec.js |
| E2E-131 | phase3-v2-core-journeys.spec.js - Phase 3 combined partner-to-report journey keeps scope and guarded destinations visible | PASS | authoritative | A2/A7 | Unauthorized access/data leakage | Rewrite → dashboards-alerts.spec.js / reports-exports.spec.js |
| E2E-132 | phase3d-navigation-shell.spec.js - responsive navigation drawer preserves fallback, focus, and background isolation | PASS | authoritative | D1 | Accessibility/usability regression | Rewrite → access-shell.spec.js |
| E2E-133 | phase3d-navigation-shell.spec.js - reduced-motion preference removes drawer transitions without breaking focus restoration | PASS | authoritative | D1 | Accessibility/usability regression | Rewrite → access-shell.spec.js |
| E2E-134 | phase3d-navigation-shell.spec.js - canonical navigation remains role-projected and exact-path active | PASS | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-135 | phase3d-navigation-shell.spec.js - migrated page headers render corrected French accents and apostrophes | PASS | stale | D1 | Accessibility/usability regression | Rewrite authoritative/semantic subset → access-shell.spec.js |
| E2E-136 | phase3d-navigation-shell.spec.js - production roles receive the exact canonical navigation leaves | PASS | stale | A1/A2 | Unauthorized access/data leakage | Rewrite durable subset → access-shell.spec.js |
| E2E-137 | phase3d-navigation-shell.spec.js - desktop sidebar is edge-attached, stable, and fills the available workspace height | PASS | stale | D1 | Accessibility/usability regression | Rewrite durable subset → access-shell.spec.js |
| E2E-138 | phase3d-operational-interactions.spec.js - project creation uses an authorized dedicated presentation state | PASS | authoritative | A2/A4 | Unauthorized access/data leakage | Rewrite → partners-projects.spec.js |
| E2E-139 | phase3d-operational-interactions.spec.js - activity creation uses an authorized dedicated presentation state | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-140 | phase3d-operational-interactions.spec.js - activity editing uses an authorized dedicated presentation state | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-141 | phase3d-operational-interactions.spec.js - activity execution uses an authorized dedicated presentation state | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-142 | phase3d-operational-interactions.spec.js - activity execution guards fields and recovery before consumption | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-143 | phase3d-operational-interactions.spec.js - expense creation uses an authorized dedicated presentation state | PASS (targeted) | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → expenses.spec.js |
| E2E-144 | phase3d-operational-interactions.spec.js - expense editing uses an authorized dedicated presentation state | PASS (targeted) | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → expenses.spec.js |
| E2E-145 | phase3d-operational-interactions.spec.js - expense create and edit recovery stay guarded and one-use | PASS (targeted) | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → expenses.spec.js |
| E2E-146 | phase3d-operational-interactions.spec.js - activity supporting-document upload uses an authorized dedicated presentation state | PASS | authoritative | A2/A3 | Document IDOR/audit | Rewrite → activities.spec.js |
| E2E-147 | phase3d-operational-interactions.spec.js - expense supporting-document upload uses an authorized dedicated presentation state | PASS | authoritative | A2/A3 | Document IDOR/audit | Rewrite → expenses.spec.js |
| E2E-148 | phase3d-operational-interactions.spec.js - supporting-document upload states deny the wrong role and retain failures without recovery handles | PASS | authoritative | A2/A3 | Document IDOR/audit | Rewrite → `documents-audit.spec.js` plus `tests/contracts/behavior_contracts_test.php` |
| E2E-149 | phase3d-operational-interactions.spec.js - activity create and edit presentation guards deny the wrong role before rendering options | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-150 | phase3d-operational-interactions.spec.js - activity creation recovery returns to the guarded state and is consumed once | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-151 | phase3d-operational-interactions.spec.js - activity creation recovery rejects request-controlled selection aliases | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-152 | phase3d-operational-interactions.spec.js - activity edit recovery returns to the guarded state and is consumed once | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-153 | phase3d-operational-interactions.spec.js - project editing uses an authorized dedicated presentation state | PASS | authoritative | A2/A4 | Unauthorized access/data leakage | Rewrite → partners-projects.spec.js |
| E2E-154 | phase3d-operational-interactions.spec.js - project edit recovery stays on the guarded edit state and is consumed once | PASS | authoritative | A2/A4 | Safe failure/data integrity | Rewrite → partners-projects.spec.js |
| E2E-155 | phase3d-operational-interactions.spec.js - project recovery rejects injected aliases and invalid or stale selections | PASS | authoritative | A2/A4 | Workflow integrity | Rewrite → partners-projects.spec.js |
| E2E-156 | phase3d-operational-interactions.spec.js - substantive project forms focus invalid input, warn on dirty navigation, and lock duplicate submits | PASS | authoritative | A2/A4 | Accessibility/usability regression | Rewrite → partners-projects.spec.js |
| E2E-157 | phase3d-operational-interactions.spec.js - project submission tokens prevent replay and unchanged updates create no audit | PASS | authoritative | A2/A4 | Workflow integrity | Rewrite → partners-projects.spec.js |
| E2E-158 | phase3d-operational-interactions.spec.js - project tokens reject missing and mismatched contexts while concurrent effects stay singular | PASS | authoritative | A2/A4 | Workflow integrity | Rewrite → partners-projects.spec.js |
| E2E-159 | phase3d-operational-interactions.spec.js - recovered project error summary receives focus without JavaScript | PASS | authoritative | A2/A4 | Safe failure/data integrity | Rewrite → partners-projects.spec.js |
| E2E-160 | phase3d-operational-interactions.spec.js - project filters use the shared presentation and retain applied state | PASS | authoritative | A2/A4 | Behavior regression | Rewrite → partners-projects.spec.js |
| E2E-161 | phase3d-operational-interactions.spec.js - project list remains a semantic table at 1366px/1024px and labeled cards at 768px/390px | PASS | authoritative | A2/A4 | Accessibility/usability regression | Rewrite → partners-projects.spec.js |
| E2E-162 | phase3d-operational-interactions.spec.js - activity filters and pagination use the same shared presentation | PASS | authoritative | A2/A3 | Behavior regression | Rewrite → activities.spec.js |
| E2E-163 | phase3d-operational-interactions.spec.js - expense filters and pagination use the same shared presentation | PASS | authoritative | A2/A3 | Behavior regression | Rewrite → expenses.spec.js |
| E2E-164 | phase3d-operational-interactions.spec.js - expense list remains a semantic table at 1366px/1024px and labeled cards at 768px/390px | PASS | authoritative | A2/A3 | Accessibility/usability regression | Rewrite → expenses.spec.js |
| E2E-165 | phase3d-operational-interactions.spec.js - project and expense lists distinguish initial, filtered, and unavailable shared states | PASS | authoritative | A2/A3 | Behavior regression | Rewrite → expenses.spec.js |
| E2E-166 | phase3d-operational-interactions.spec.js - activity correction review uses an authorized same-route action state | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-167 | phase3d-operational-interactions.spec.js - activity correction review recovery returns to the guarded substantive state | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-168 | phase3d-operational-interactions.spec.js - activity verifier decisions leave the default detail and enter guarded action states | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → activities.spec.js |
| E2E-169 | phase3d-operational-interactions.spec.js - activity final-validator decisions use guarded action states and reject the verifier role | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → activities.spec.js |
| E2E-170 | phase3d-operational-interactions.spec.js - activity guarded review states fail closed for self-review and cross-scope access | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → activities.spec.js |
| E2E-171 | phase3d-operational-interactions.spec.js - stale activity review denies before recovery consumption and recovery remains one-use | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → activities.spec.js |
| E2E-172 | phase3d-operational-interactions.spec.js - expense verifier decisions leave the default detail for a guarded action state | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → expenses.spec.js |
| E2E-173 | phase3d-operational-interactions.spec.js - expense final validation and disbursement use guarded no-modal action states | PASS | authoritative | A2/A3 | Behavior regression | Rewrite → expenses.spec.js |
| E2E-174 | phase3d-operational-interactions.spec.js - expense review recovery is guarded before consumption and remains one-use | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → expenses.spec.js |
| E2E-175 | phase3d-operational-interactions.spec.js - expense guarded action states fail closed for self-review and cross-scope access | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → expenses.spec.js |
| E2E-176 | phase3d-operational-interactions.spec.js - shared operational filters reflow without local overflow at review widths | PASS | authoritative | A2/A3 | Behavior regression | Rewrite → activities.spec.js |
| E2E-177 | phase3d-prerequisite-security.spec.js - non-admin validation and audit routes show only resolved assigned-partner records | PASS | authoritative | A2 | Behavior regression | Rewrite → scope-security.spec.js |
| E2E-178 | phase3d-prerequisite-security.spec.js - Admin sees active-entity unresolved diagnostics but no cross-entity targets or parents | PASS | authoritative | A2 | Unauthorized access/data leakage | Rewrite → scope-security.spec.js |
| E2E-179 | phase3d-prerequisite-security.spec.js - workflow audit filter options use the same visibility predicate as result rows | PASS | authoritative | A2 | Behavior regression | Rewrite → scope-security.spec.js |
| E2E-180 | phase3d-prerequisite-security.spec.js - validation-history query failures render a safe persistent state | PASS | authoritative | A2 | Behavior regression | Rewrite → scope-security.spec.js |
| E2E-181 | phase3d-prerequisite-security.spec.js - convention and fund-receipt downloads deny cross-scope IDs without audit rows | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-182 | phase3d-prerequisite-security.spec.js - download delivery fails closed when its audit event cannot be persisted | PASS | authoritative | A5 | Document IDOR/audit | Rewrite → documents-audit.spec.js |
| E2E-183 | phase3d-prerequisite-security.spec.js - CSV neutralizes dangerous text while negative money stays numeric and XLSX emits typed cells | PASS | authoritative | A7 | Export integrity/data leakage | Rewrite → reports-exports.spec.js |
| E2E-184 | phase3d-prerequisite-security.spec.js - CSV neutralizes textual money cells while XLSX rejects non-numeric money | PASS | authoritative | A7 | Export integrity/data leakage | Rewrite → reports-exports.spec.js |
| E2E-185 | phase3d-prerequisite-security.spec.js - export generation and audit failures create no audit event and deliver no file | PASS | authoritative | A7 | Export integrity/data leakage | Rewrite → reports-exports.spec.js |
| E2E-186 | phase4-auth-access.spec.js - MJL login and forgotten-password pages replace raw native auth UI | PASS | authoritative | A1 | Account security | Rewrite → auth-invitations.spec.js |
| E2E-187 | phase4-auth-access.spec.js - phase 4 auth schema exposes reset lifecycle status | PASS | operational check | A1 | Account security | Relocate → current schema verification |
| E2E-188 | phase4-auth-access.spec.js - Admin invitation flow, landing page, and non-admin access blocking | FAIL | authoritative | A1 | Unauthorized access/data leakage | Rewrite → auth-invitations.spec.js |
| E2E-189 | phase4-auth-access.spec.js - Admin assignment UI blocks self-deactivation and unresolved legacy access fails closed | NOT RUN | authoritative | A1 | Workflow integrity | Rewrite → auth-invitations.spec.js |
| E2E-190 | phase4-auth-access.spec.js - double-submit invitation acceptance cannot disable an activated user | NOT RUN | authoritative | A1 | Account security | Rewrite → auth-invitations.spec.js |
| E2E-191 | phase4-auth-access.spec.js - stale revoke cannot overwrite an accepted invitation or deactivate user | NOT RUN | authoritative | A1 | Workflow integrity | Rewrite → auth-invitations.spec.js |
| E2E-192 | phase4-auth-access.spec.js - revoked invitation link cannot be accepted later | NOT RUN | authoritative | A1 | Account security | Rewrite → auth-invitations.spec.js |
| E2E-193 | phase4-auth-access.spec.js - forgotten password uses neutral response and does not mutate sample users | NOT RUN | authoritative | A1 | Account security | Rewrite → auth-invitations.spec.js |
| E2E-194 | phase4-auth-access.spec.js - password reset lifecycle invalidates old and pending links | NOT RUN | authoritative | A1 | Account security | Rewrite → auth-invitations.spec.js |
| E2E-195 | phase4-auth-access.spec.js - unsafe invitation targets are rejected without changing existing users | NOT RUN | authoritative | A1 | Account security | Rewrite → auth-invitations.spec.js |
| E2E-196 | phase4-auth-access.spec.js - bad invitation password does not activate user and invalid links are safe | NOT RUN | authoritative | A1 | Account security | Rewrite → auth-invitations.spec.js |
| E2E-197 | phase4-auth-access.spec.js - password reset POST without a valid CSRF token is ignored safely | NOT RUN | authoritative | A1 | Workflow integrity | Rewrite → auth-invitations.spec.js |
| E2E-198 | phase5-workspace-shell.spec.js - Level 1 user sees operational workspace and cannot access supervision pages | PASS | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-199 | phase5-workspace-shell.spec.js - Level 2 reviewer sees validation workspace and cannot access supervision pages | PASS | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-200 | phase5-workspace-shell.spec.js - Finance validator sees supervision workspace and can access finance reports | FAIL | authoritative | A1/A2 | Unauthorized access/data leakage | Retain confirmed final-validator access boundary → dashboards-alerts.spec.js and reports-exports.spec.js |
| E2E-201 | phase5-workspace-shell.spec.js - Admin sees administration access and can access invitations plus supervision pages | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-202 | phase5-workspace-shell.spec.js - Unresolved legacy reader fails closed | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-203 | phase5-workspace-shell.spec.js - Business roles do not see native Dolibarr workspaces as normal navigation | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-204 | phase5-workspace-shell.spec.js - MJL users receive a branded 403 for direct native workspace URLs | NOT RUN | authoritative | A1/A2 | Behavior regression | Rewrite → access-shell.spec.js |
| E2E-205 | phase5-workspace-shell.spec.js - Required authentication helper routes stay reachable outside the native route block | NOT RUN | authoritative | A1/A2 | Account security | Rewrite → access-shell.spec.js |
| E2E-206 | phase5-workspace-shell.spec.js - Native module state keeps only required Dolibarr support modules enabled | NOT RUN | authoritative | A1/A2 | Behavior regression | Rewrite → access-shell.spec.js |
| E2E-207 | phase5-workspace-shell.spec.js - Narrow workflow-action reader without production role fails closed | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-208 | phase5-workspace-shell.spec.js - Narrow activity reader without production role fails closed | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-209 | phase5-workspace-shell.spec.js - Narrow reviewer without production role fails closed | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-210 | phase5-workspace-shell.spec.js - Narrow activity reviewer without production role fails closed | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-211 | phase5-workspace-shell.spec.js - Workspace keeps forbidden public registration labels out of the UI | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-212 | phase5-workspace-shell.spec.js - Project detail exposes timeline notes and Reader cannot add notes | NOT RUN | authoritative | A5 | Unauthorized access/data leakage | Rewrite → documents-audit.spec.js |
| E2E-213 | phase5-workspace-shell.spec.js - Every visible sidebar link opens for the role that sees it | NOT RUN | authoritative | A1/A2 | Unauthorized access/data leakage | Rewrite → access-shell.spec.js |
| E2E-214 | phase5-workspace-shell.spec.js - Invitation surface does not render the authenticated module sidebar | NOT RUN | authoritative | A1/D1 | Account security | Rewrite → access-shell.spec.js |
| E2E-215 | phase6-level-dashboards.spec.js - Level 1 dashboard focuses on operational next actions | PASS | duplicate | A2/D1 | Accessibility/usability regression | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-216 | phase6-level-dashboards.spec.js - Level 2 dashboard focuses on validation workload and delay risk | PASS | duplicate | A2/D1 | Accessibility/usability regression | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-217 | phase6-level-dashboards.spec.js - Finance dashboard exposes supervision sections and actionable risk context | FAIL | duplicate | A2/D1 | Financial data integrity | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-218 | phase6-level-dashboards.spec.js - Admin dashboard is administration-first with supervision shortcuts | NOT RUN | duplicate | A2/D1 | Misleading or leaked supervision data | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-219 | phase6-level-dashboards.spec.js - Read-only user fails closed | NOT RUN | duplicate | A2/D1 | Behavior regression | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-220 | phase6-level-dashboards.spec.js - Phase 6 dashboards keep forbidden public registration labels out | NOT RUN | duplicate | A2/D1 | Unauthorized access/data leakage | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-221 | phase6r-project-activity-execution.spec.js - P6R project create/edit is allowed for admin and final validator but denied to agent | PASS | authoritative | A2/A4 | Behavior regression | Rewrite → partners-projects.spec.js |
| E2E-222 | phase6r-project-activity-execution.spec.js - P6R activity options are scoped and mismatched project/convention POST is rejected | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-223 | phase6r-project-activity-execution.spec.js - P6R update_execution updates only execution fields and writes production audit role | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-224 | phase6r-project-activity-execution.spec.js - P6R project and dashboard execution KPIs reflect execution update and late alert is visible | PASS | authoritative | A2/A3 | Misleading or leaked supervision data | Rewrite → activities.spec.js |
| E2E-225 | phase6r-project-activity-execution.spec.js - P6R no-self-prevalidation still holds after execution work | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → activities.spec.js |
| E2E-226 | phase7-activity-workflow.spec.js - Level 1 creates, opens, submits, and sees timeline updates | PASS | authoritative | A2/A3 | Behavior regression | Rewrite → activities.spec.js |
| E2E-227 | phase7-activity-workflow.spec.js - Create form filters conventions and tasks by selected project | PASS | authoritative | A2/A3 | Financial data integrity | Rewrite → activities.spec.js |
| E2E-228 | phase7-activity-workflow.spec.js - Tampered create POST with mismatched project and convention is rejected server-side | PASS | authoritative | A2/A3 | Safe failure/data integrity | Rewrite → activities.spec.js |
| E2E-229 | phase7-activity-workflow.spec.js - Invalid physical execution percentage is rejected server-side | PASS | authoritative | A2/A3 | Behavior regression | Rewrite → activities.spec.js |
| E2E-230 | phase7-activity-workflow.spec.js - Level 1 cannot open another operational user activity or another entity activity | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-231 | phase7-activity-workflow.spec.js - Level 2 prevalidates submitted activity, then final validator validates it | PASS | authoritative | A2/A3 | Behavior regression | Rewrite → activities.spec.js |
| E2E-232 | phase7-activity-workflow.spec.js - Return for correction preserves previous decision through correction and resubmission | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → activities.spec.js |
| E2E-233 | phase7-activity-workflow.spec.js - Self reviewer decisions are absent from UI and blocked server-side | PASS | authoritative | A2/A3 | Workflow integrity | Rewrite → activities.spec.js |
| E2E-234 | phase7-activity-workflow.spec.js - DPAF, Admin, and unresolved legacy reader visibility stays role-aware | PASS | authoritative | A2/A3 | Unauthorized access/data leakage | Rewrite → activities.spec.js |
| E2E-235 | phase8-alerts-risks.spec.js - Level 1 sees only own operational alerts | FAIL | duplicate | A2/D1 | Misleading or leaked supervision data | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-236 | phase8-alerts-risks.spec.js - Level 2 sees validation alerts with actionable links | NOT RUN | duplicate | A2/D1 | Misleading or leaked supervision data | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-237 | phase8-alerts-risks.spec.js - DPAF and Admin see portfolio alerts | NOT RUN | duplicate | A2/D1 | Misleading or leaked supervision data | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-238 | phase8-alerts-risks.spec.js - Activity alert disappears from verifier queue after prevalidation | NOT RUN | duplicate | A2/D1 | Misleading or leaked supervision data | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-239 | phase8-alerts-risks.spec.js - Legacy read-only users and workflow-only users are blocked | NOT RUN | duplicate | A2/D1 | Behavior regression | Fuse authoritative behavior → dashboards-alerts.spec.js |
| E2E-240 | phase8r-contextual-exchanges.spec.js - authorized user adds contextual comments across object timelines and aggregate views stay scoped | PASS | authoritative | A6 | Unauthorized access/data leakage | Rewrite → documents-audit.spec.js |
| E2E-241 | phase8r-contextual-exchanges.spec.js - readonly user sees contextual history without a comment form | PASS | authoritative | A6 | Behavior regression | Rewrite → documents-audit.spec.js |
| E2E-242 | phase8r-contextual-exchanges.spec.js - direct contextual POST fails closed when route-specific access denies the object | PASS | authoritative | A5 | Unauthorized access/data leakage | Rewrite → documents-audit.spec.js |
| E2E-243 | phase8r-contextual-exchanges.spec.js - global exchanges route is advanced audit only and absent from primary navigation | PASS | authoritative | A6 | Accessibility/usability regression | Rewrite → documents-audit.spec.js |
| E2E-244 | phase9-tables-exports.spec.js - reports access stays limited to final validator and Admin | FAIL | duplicate | A7 | Unauthorized access/data leakage | Fuse authoritative behavior → reports-exports.spec.js |
| E2E-245 | phase9-tables-exports.spec.js - report metadata, required filters, and unsupported filters are explicit | NOT RUN | duplicate | A7 | Export integrity/data leakage | Fuse authoritative behavior → reports-exports.spec.js |
| E2E-246 | phase9-tables-exports.spec.js - filtered activity preview and CSV export share filters, filename, and entity scope | NOT RUN | duplicate | A7 | Unauthorized access/data leakage | Fuse authoritative behavior → reports-exports.spec.js |
| E2E-247 | phase9-tables-exports.spec.js - expense report exports French-readable statuses and document flags | NOT RUN | duplicate | A7 | Document IDOR/audit | Fuse authoritative behavior → reports-exports.spec.js |
| E2E-248 | phase9-tables-exports.spec.js - forced export without required filters is refused server-side | NOT RUN | duplicate | A7 | Export integrity/data leakage | Fuse authoritative behavior → reports-exports.spec.js |
| E2E-249 | phase9r-alerts-alignment.spec.js - agent sees operational activity and expense alerts only in assigned partner scope | PASS | authoritative | A2/D1 | Unauthorized access/data leakage | Rewrite → dashboards-alerts.spec.js |
| E2E-250 | phase9r-alerts-alignment.spec.js - validation queues are role-specific | PASS | authoritative | A2/D1 | Unauthorized access/data leakage | Rewrite production-role security subset → dashboards-alerts.spec.js |
| E2E-251 | phase9r-alerts-alignment.spec.js - scope filter separates activities, expenses, and finance alerts | PASS | authoritative | A2/D1 | Unauthorized access/data leakage | Rewrite → dashboards-alerts.spec.js |
| E2E-252 | phase9r-alerts-alignment.spec.js - finance alerts are suppressed when the user cannot open finance routes | PASS | authoritative | A2/D1 | Financial data integrity | Rewrite → dashboards-alerts.spec.js |
| E2E-253 | phase3d-operational-interactions.spec.js - convention management uses guarded route-owned presentation states | PASS (targeted) | authoritative | D1 | Safe route/action presentation | Rewrite semantic route/action separation without exact link inventory → `tests/contracts/navigation_registry_test.php` and `finance.spec.js` |

## Isolation, manual, and PHP verification dispositions

| ID | Existing case | Class | Authority | Risk | Disposition |
| --- | --- | --- | --- | --- | --- |
| ISO-NODE-001 | tests/isolation/phase3d-prerequisite-isolation.test.js - accepts a matching disposable Compose environment | authoritative | A2 | Shared-state destruction | Rewrite → disposable environment unit contract |
| ISO-NODE-002 | tests/isolation/phase3d-prerequisite-isolation.test.js - rejects the shared default browser URL | authoritative | A2 | Shared-state destruction | Rewrite → disposable environment unit contract |
| ISO-NODE-003 | tests/isolation/phase3d-prerequisite-isolation.test.js - rejects repository data binds | authoritative | A2 | Repository data destruction | Rewrite for named-volume isolation |
| ISO-NODE-004 | tests/isolation/phase3d-prerequisite-isolation.test.js - rejects a mismatched DOLI_URL_ROOT | authoritative | A2 | Wrong-tenant testing | Rewrite → disposable environment unit contract |
| ISO-NODE-005 | tests/isolation/phase3d-prerequisite-isolation.test.js - rejects a mismatched published port | authoritative | A2 | Wrong-tenant testing | Rewrite → disposable environment unit contract |
| ISO-PHP-001 | tests/isolation/phase3d_navigation_registry_test.php - navigation registry contract | stale | A1/D1 | Unauthorized navigation/accessibility | Rewrite semantic/access subset → `tests/contracts/navigation_registry_test.php` |
| ISO-PHP-002 | tests/isolation/phase3d_page_header_test.php - page-header rendering contract | authoritative | D1 | Accessibility/usability regression | Relocate → `tests/contracts/page_header_test.php` |
| ISO-PHP-003 | tests/isolation/phase3d_project_form_hardening_test.php - project recovery and submission hardening | authoritative | A2/A4 | Replay/tampering | Relocate → `tests/contracts/project_form_security_test.php` |
| ISO-PHP-004 | tests/isolation/phase3d_table_presentation_test.php - table filter and pagination rendering | authoritative | D1 | Accessibility/filter integrity | Relocate → `tests/contracts/table_presentation_test.php` |
| MAN-001 | tests/manual/phase2-accessibility-harness.spec.js - headed accessibility and injected partial-state harness | manual evidence | D1 | Manual accessibility gap | Rewrite real app journey → manual accessibility gate |
| MAN-002 | tests/manual/phase3d-navigation-zoom-harness.spec.js - real Chromium 100%/200% zoom review | manual evidence | D1 | Zoom/reflow regression | Fuse → manual accessibility gate |
| VER-PHP-001 | custom/mjlfinancement/scripts/audit_schema_0.2.0.php - schema/data checks for 0.2.0 | migration-only | S1 | Current schema/data drift | Consolidate valid checks → audit_schema_current.php |
| VER-PHP-002 | custom/mjlfinancement/scripts/audit_schema_0.3.0.php - schema/data checks for 0.3.0 | migration-only | S1 | Current schema/data drift | Consolidate valid checks → audit_schema_current.php |
| VER-PHP-003 | custom/mjlfinancement/scripts/audit_schema_0.4.0.php - schema/data checks for 0.4.0 | migration-only | S1 | Current schema/data drift | Consolidate valid checks → audit_schema_current.php |
| VER-PHP-004 | custom/mjlfinancement/scripts/audit_schema_0.5.0.php - schema/data checks for 0.5.0 | migration-only | S1 | Current schema/data drift | Consolidate valid checks → audit_schema_current.php |
| VER-PHP-005 | custom/mjlfinancement/scripts/audit_schema_0.8.0.php - schema/data checks for 0.8.0 | migration-only | S1 | Current schema/data drift | Consolidate valid checks → audit_schema_current.php |
| VER-PHP-006 | custom/mjlfinancement/scripts/audit_schema_0.9.0.php - schema/data checks for 0.9.0 | migration-only | S1 | Current schema/data drift | Consolidate valid checks → audit_schema_current.php |
| VER-PHP-007 | custom/mjlfinancement/scripts/audit_schema_0.10.0.php - schema/data checks for 0.10.0 | migration-only | S1 | Current schema/data drift | Consolidate valid checks → audit_schema_current.php |
| VER-PHP-008 | custom/mjlfinancement/scripts/audit_unresolved_scope.php - unresolved scope audit | authoritative | A2 | Unresolved/cross-scope data | Fuse → verify_scope_integrity.php |
| VER-PHP-009 | custom/mjlfinancement/scripts/acceptance_sample_data.php - sample-data acceptance | operational check | O1 | Invalid test fixtures | Rename/consolidate → verify_sample_data.php |
| VER-PHP-010 | custom/mjlfinancement/scripts/smoke_activity_workflow.php - activity workflow smoke | authoritative | A3 | Workflow integrity | Rename/consolidate → verify_activity_workflow.php |
| VER-PHP-011 | custom/mjlfinancement/scripts/smoke_dashboard_partial_failure.php - dashboard partial-failure smoke | authoritative | D1 | Misleading unavailable data | Relocate → tests/contracts/container/dashboard_resilience_test.php |
| VER-PHP-012 | custom/mjlfinancement/scripts/smoke_expense_validation.php - expense workflow smoke | authoritative | A3 | Financial/workflow integrity | Rename/consolidate → verify_expense_workflow.php |
| VER-PHP-013 | custom/mjlfinancement/scripts/smoke_integrity_targets.php - traceability target integrity smoke | authoritative | A2 | Orphan/cross-entity audit data | Fuse → verify_scope_integrity.php |
| VER-PHP-014 | custom/mjlfinancement/scripts/smoke_scope_model.php - scope model smoke | authoritative | A2 | Unauthorized data access | Fuse → verify_scope_integrity.php |
| VER-PHP-015 | custom/mjlfinancement/scripts/smoke_traceability_exports.php - traceability/export smoke | authoritative | A6/A7 | Audit/export integrity | Rename/consolidate → verify_traceability_exports.php |
| VER-PHP-016 | custom/mjlfinancement/scripts/check_production_readiness.php - production-readiness diagnostic | operational check | O1 | Deployment readiness uncertainty | Retain outside npm test verification gate |

## Gate 2 destination coverage

| Destination | Required primary coverage |
| --- | --- |
| `access-shell.spec.js` | Login boundary, role-projected access principles, direct native-route denial, shell accessibility, no public registration. |
| `auth-invitations.spec.js` | Admin invitation lifecycle, neutral password reset, stale/revoked/replayed links, CSRF and unsafe-target rejection. |
| `partners-projects.spec.js` | Scoped partner/project journeys, authorized project create/edit, tampered relationships, replay-safe submissions. |
| `activities.spec.js` | Create/edit/execute/submit/correct/review journeys, scoped options, dedicated states, recovery, no-self and direct POST guards. |
| `expenses.spec.js` | Create/edit/upload/submit/prevalidate/final-validate/reject/correct/disburse, exact-one effects, CSRF, stale replay, concurrency and no-self. |
| `finance.spec.js` | Confirmed finance integrity and references; unapproved management-role behavior moves to characterization. |
| `documents-audit.spec.js` | Contextual uploads/comments, read-only aggregate views, guarded downloads, path/entity/scope denial, audit-before-delivery. |
| `scope-security.spec.js` | Representative browser scope/isolation routes plus all-family lower-level query/access contracts. |
| `dashboards-alerts.spec.js` | Scoped filters, actionable alerts, partial-source behavior and authority-backed Admin/final-validator distinction. |
| `reports-exports.spec.js` | CSV/XLSX contract, filtering/tampering, dangerous cells, numeric money, stable names and audit/generation failure. |
| `email-notifications.spec.js` | Functional invitation/reset/workflow email behavior without freezing unapproved final production wording. |
| `tests/characterization/` | Non-blocking executable security/data-integrity behavior pending product authority. |
| Unit contracts | Pure rendering, navigation, recovery, normalization, error-safety, scope-query, export-encoding and runner-isolation contracts. |
| Current PHP verification | One current-schema auditor plus sample, scope/integrity, activity, expense and traceability/export verifiers. |
| Manual accessibility gate | One real-app keyboard, focus, reflow and real 100%/200% Chromium zoom review. |

The lower-level scope matrix in `verification/scope/access_model.php` is
parameterized across 11 canonical object-access families: projects, conventions, receipts,
activities, expenses, budgets, decision history, workflow audit, contextual
exchanges, ECM documents, and project-note timelines. Every family proves the
assigned-partner path and fail-closed unresolved-user and cross-entity paths.
Partner/programme filtering is additionally exercised directly by its SQL
filter and access predicates. This matrix complements, rather than duplicates,
the representative route-level browser cases. It does not yet satisfy the
approved requirement to exercise every inline list/aggregate query family;
closing that gap requires extracting callable query builders or explicit
approval to narrow Gate 2 to canonical object-access coverage.

No current production surface uses a modal dialog as an authoritative
interaction. Dialog-specific automation is therefore N/A; navigation focus
containment and form-error focus behavior remain automated, and the interactive
accessibility gate records any future modal behavior.

The literal login `dpaf.mjl` remains only as the current bootstrap fixture for
the authoritative `VALIDATEUR_DEFINITIF` role. Maintained tests describe and
assert that user exclusively as the final validator; the login is compatibility
data, not an accepted legacy role or product term. The runner's negative
`phase3` mode input is likewise intentional proof that historical suite modes
are rejected.

## Approval checkpoint

Gate 1 was explicitly approved on 2026-08-03. Gate 2 preserves every retained
authoritative row through the destination matrix above. Characterization stays
executable and fail-loud but is excluded from blocking `npm test` pending
product authority.
