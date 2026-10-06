# MJL Current vs Target Gap Analysis

This is implementation-debt evidence beneath the canonical v2 documents.

| Target | Current state | Remaining gap / owner |
| --- | --- | --- |
| One transactional audit | Append-only entity-scoped audit table, transaction-bound writer, and sanitized Activity chronology exist. | Later object adapters remain owned by their phases. |
| No obsolete finance core | Finance schemas, loaders, routes, reports, and update SQL are removed; RST-006A planning and RST-006B execution are active on the empty local tenant. | No Phase 3A gap. |
| Invitation-only access and login verification | Business-role-only invitation/reset lifecycle and configuration-gated email OTP login are implemented; groups/scopes are not authorization inputs. | Enabling OTP requires a unique reachable address for the retained technical Admin, working email delivery, and explicit `MJL_AUTH_OTP_ENABLED=1`. Production email/base URL/secrets remain operator confirmations. |
| Dashboards, browsing and navigation | Role-specific dashboards, computed alerts, scoped browsing, permission-aware action queues, financial disclosure, and Alertes/Rapports/exception navigation are implemented behind RST-012 readiness. Admin receives supported access, audit, and technical destinations without fabricated metrics. | User acceptance remains outstanding. |
| Activity execution and exceptions | Module 0.20.0 provides integer-XOF execution, terminal locks, version-bound cancellation/reopening, Activity cancellation cascade, pure projections, and hourly reconciliation through the aggregate command. | The unsigned 170-combination human accessibility review remains a production/release blocker. |
| Documents/accounting/official outputs | Current custom document endpoints deny every method without storage access, and deployment rules block native document paths. | Authorized document delivery, accounting and official-output decisions remain deferred to a fresh Phase 4 request. |
| Persistent empty tenant | Exactly one native Admin; target/custom business tables remain empty. | Disposable factories expand only with their owning feature units. |
| Historical reverse-prefix gates | Retained reset suites still expect predecessor schemas. | `rst013a`, `rst014a`, `rst002b`, and `rst006a` reject later dependent tables or columns. They are not current acceptance gates; adapt or retire them only when requested work needs those checks. |
| Test-suite cost and duplication | Focused commands and isolated disposable tenants exist; focused mode names are repeated across runner maps and dispatch conditions. | **Unapproved recommendation:** simplify overlapping historical phase and reset suites where a smaller maintained test proves the same behavior, and centralize focused-mode metadata when runner work is otherwise required; retain authorization, entity isolation, security, and data-integrity coverage. |
| Production preparation | Development configuration exists. | Production work and readiness assessment are deferred until the user explicitly requests them. Client configuration remains unknown and no feature or application has been accepted. |

## Forensic architecture audit findings

The source baseline and evidence qualifications are recorded in
`docs/architecture-audit/`. These items are implementation debt, not approved
work:

| Area | Current evidence | Gap / required decision |
| --- | --- | --- |
| Retained Admin password reset | **Resolved.** Trigger and consume guards now permit the native entity-0 Admin through an active-entity reset while preserving same-entity rules for business users. The disposable auth suite passed 12/12. | Preserve the focused regression and entity rule. |
| Reference transaction results | **Resolved.** Create/update/lifecycle stop on failed begin, reject failed commits, attempt rollback and close an uncertain connection after rollback failure. | Preserve the direct failure contract and existing business outcomes. |
| Native password persistence | **Resolved.** The MJL password adapter forces encrypted-only native storage for each invitation/reset write and restores the prior runtime setting. The disposable auth suite proves `llx_user.pass IS NULL` after both flows. | Preserve `SEC-AUTH-006` and both database assertions. |
| RST-006B early interruption | **Resolved.** Every exact early Operation-check prefix is classified as resumable, with four new injected interruptions passing apply, exact verification and rollback in the Phase 3A suite. | Preserve the failure-point matrix and fail-closed handling of unknown shapes. |
| Export stream failure handling | `GENERATED` intentionally records the completed private artifact before HTTP delivery, and E2E source preserves it after client abort. A server-side `fread()` failure still exits the response loop like EOF. | Preserve the generation contract; inject a server read failure and define response handling before changing the stream loop. |
| Cron reconciliation | One row failure stops later rowids, and multi-entity behavior depends on the process `$conf->entity`. | Decide supported batch-failure and entity semantics before changing the reconciler. |
| Verification command scope | The public unit command stalled in this managed environment; PHP-spawning files hit sandbox limits, four design assertions conflict with current source, a nested contract is undiscovered, and the E2E script names only a subset of configured suites. | Reproduce in the supported execution environment, resolve each design assertion against current authority, and make each named gate's discovery and timeout behavior explicit. |
| Forensic coverage | All 157 application files and the immutable 80-file verification baseline were read in full; the added closure contract was also fully read, for 81/81 current verification files. File fingerprints, symbol/site annexes, and the closure delta make the population inspectable. | Most baseline symbols are indexed rather than behavior-mapped end to end, and runtime/database/browser evidence remains limited. Do not claim exhaustive behavioral comprehension or target-architecture confidence. |
| External font dependency | The module header hook loads Google Fonts on anonymous authentication and MJL pages. | Production CSP, privacy and asset-hosting policy remain operator/product decisions for explicitly requested deployment work. |
| Password action HTTP methods | Invitation acceptance and native-reset hook actions render POST forms and validate CSRF, but custom source does not enforce POST; the invitation controller reads its action and credentials through `GETPOST`. | Characterize direct GET against an isolated tenant and inspect native dispatcher enforcement, then add the smallest explicit method guard if the risk is confirmed. |

## Post-cadrage UI dependencies outside the approved design pass

These are deferred backend or data-contract gaps, not instructions to expand a
visual wave. Stop and ask before changing their queries, endpoints, schema,
permissions, authentication, or business rules.

| Reference behavior | Current evidence | Deferred dependency |
| --- | --- | --- |
| Editable Operation drawer | Execution is available through guarded Operation routes, but forms issue one-use submission tokens and the session keeps at most 20 pending tokens. A 21-form probe invalidated the first form. | Keep the new drawer read-only. A single-Operation form-loading contract and the existing multi-form token problem need a separate backend decision. |
| Reference and account fields/actions | Partner/Project screens expose only current name, parent, status, and guarded lifecycle facts through shared responsive lists and progressive forms; Project edit preserves its original Partner. Admin access presents invitation, role update, deactivation, and revocation through shared responsive tables and progressive exact-form dialogs, including real invitation delivery states. | Defer Partner description, reference counts/timestamps, unsupported account profile/reactivation actions, and bulk assignment replacement. |
| Extra list and dashboard data | Current monitoring filters support search, Partner, Project, validation, execution, completeness, and period overlap. The reference also depicts Agent/deadline filters and Admin metrics not supplied by the current read contracts. | Use supported filters and real projections only; seek a separate decision for missing read contracts. |
| Complete failed-form recovery | Activity recovery stores a subset of selections and rebuilds draft Operations by index. | Preserve current behavior and do not claim full restoration without a separate backend change. |
