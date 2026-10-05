# Dependency map

## Runtime layers

```text
Apache native-route guard
  -> Dolibarr main.inc.php / login and template hooks
    -> thin MJL route files
      -> procedural route modules
        -> scope/policy, form-token and domain command modules
          -> Dolibarr database adapter and native User/Societe/Project models
            -> MJL + selected native tables, triggers and audit rows
      -> PHP-rendered DOM
        -> module CSS + native_guard + feature/browser modules
```

This is the architecture that exists. The labels describe observable seams; they are not a target layer proposal.

## Entrypoint-to-module graph

| Entrypoint group | Primary module(s) | Main downstream dependencies |
| --- | --- | --- |
| `activities.php` | `mjl_activity_route` | Activity command/assignment models, access/scope, recovery/submission tokens, monitoring, timeline, presentation |
| `operations.php` | `mjl_operation_route` | Activity command aggregate, activity access, execution projection, feedback/forms |
| `operationrequests.php` | `mjl_operation_request_route` | cancellation/reopening adapters, activity access, command aggregate, exception UI |
| `partners.php`, `projects.php`, `operationtypes.php` | `mjl_reference_route` | reference CRUD/lifecycle, scope, recovery/submission tokens, audit, native Societe/Project |
| `index.php`, `alerts.php` | monitoring route and dashboard presentation | monitoring adapter/projections, navigation policy, shared tables/forms |
| `reports.php`, `reportexport.php` | report route | monitoring and audit projections, export object/spool, PDF/XLSX/CSV renderers, audited export record |
| `workflowactions.php` | report route when export schema exists; legacy inline audit otherwise | audit table/projection, navigation/scope |
| `admin/access.php` | auth + scope access commands | native User, roles/rights, invitations, email, audit |
| `auth.php`, `invitation.php`, native login/reset hooks | auth and email modules | sessions, native User password/login, OTP/invitation/reset tables, audit |
| `documents.php`, `documentdownload.php`, `nativeforbidden.php` | dependency-free denial | HTTP headers only |
| module descriptor | Dolibarr module lifecycle | schema installers RST-005/006A/006B/012, native module activation, hooks, cron |
| cron | `MjlExecutionReconciler::run` | Activity command aggregate and automatic-status audit |
| CLI scripts | guarded reset/install/verify modules | Dolibarr activation, exact schema detectors, disposable/shared-operation protocols |

## Dynamic invocation

- Dolibarr locates `ActionsMjlFinancement` by naming convention. Its implemented hook methods are `beforeLoginAuthentication`, `updateSession`, `afterLoginFailed`, `doActions`, `llxHeader` and `addHtmlHeader`.
- The module descriptor registers templates, CSS, dynamic JS, rights, one top menu and the hourly reconciliation method.
- Route adapters dispatch on sanitized `action` values and HTTP method. Reference kind (`partner`, `project`, `operation_type`) parameterizes one shared route.
- Navigation destinations and access policies are data in `mjl_navigation_registry`; active-item aliases couple URLs to shell presentation.
- Test runners select suites through string mode maps; Playwright discovery adds another independent filter.

## Frontend loading graph

- Module CSS loads `mjl_auth.css.php` and `mjl_app.css.php`; hook output adds approved Inter resources only to eligible browser documents.
- `native_guard.js.php` is registered globally and redirects/guards native workspace affordances.
- Activity pages load `mjl_financial_preview.js`, `mjl_form_controls.js`, `activities.js`, and the shared `mjl_components.js` behavior through rendered script registrations.
- `activities.js` requires the financial preview global before enhancement. The shared UI module owns dialog reparenting, dirty-state behavior, Select2/calendar lifecycle, disclosure, tabs and navigation drawer.
- Production browser code uses ordinary forms and navigation; no production `fetch`, XHR, localStorage or sessionStorage call was found.

## Coupling and depth findings

- Thin route files provide useful stable entry seams, but the large route modules mix request parsing, policy decisions, mutations and rendering.
- `MjlActivityCommand` is the deepest business module: it owns transactions, locks, revision snapshots, review/execution/exception transitions and audit coupling. Its 15 public operational commands plus constructor expose one cohesive aggregate-oriented contract; its 70 private methods are implementation depth rather than interface cost.
- Scope and authorization are centralized enough to provide locality, while route-specific eligibility remains deliberately repeated near mutations.
- Schema installers and the module descriptor form a tightly coupled lifecycle subsystem with test-mode branches; it must be treated separately from normal HTTP architecture.

## Evidence and limitations

All 157 custom files were included in the source pass. Native Dolibarr inspection was deliberately limited to reached bootstrap, input, CSRF, denial and login-hook mechanisms. Dynamic behavior supplied by an uninstalled third-party module is outside the discovered population.
