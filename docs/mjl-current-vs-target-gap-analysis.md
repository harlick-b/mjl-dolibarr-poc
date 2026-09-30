# MJL Current vs Target Gap Analysis

This is implementation-debt evidence beneath the canonical v2 documents.

| Target | Current state | Remaining gap / owner |
| --- | --- | --- |
| One transactional audit | Append-only entity-scoped audit table, transaction-bound writer, and sanitized Activity chronology exist. | Later object adapters remain owned by their phases. |
| No obsolete finance core | Finance schemas, loaders, routes, reports, and update SQL are removed; RST-006A planning and RST-006B execution are active on the empty local tenant. | No Phase 3A gap. |
| Invitation-only access | Business-role-only selector/verifier invitation and reset lifecycle is active; groups/scopes are not authorization inputs. | Production email/base URL/secrets remain operator confirmations. |
| Dashboards, browsing and navigation | Role-specific dashboards, computed alerts, scoped browsing, permission-aware action queues, financial disclosure, and Alertes/Rapports/exception navigation are implemented behind RST-012 readiness. Admin receives supported access, audit, and technical destinations without fabricated metrics. | User acceptance remains outstanding. |
| Activity execution and exceptions | Module 0.20.0 provides integer-XOF execution, terminal locks, version-bound cancellation/reopening, Activity cancellation cascade, pure projections, and hourly reconciliation through the aggregate command. | The unsigned 170-combination human accessibility review remains a production/release blocker. |
| Documents/accounting/official outputs | RST-010A closes custom and native document delivery; obsolete assumptions are unreachable or removed. | Phase 4 is unaccepted and unrequested; accounting and official-output decisions remain deferred. |
| Persistent empty tenant | Exactly one native Admin; target/custom business tables remain empty. | Disposable factories expand only with their owning feature units. |
| Historical reverse-prefix gates | Retained reset suites still expect predecessor schemas. | `rst013a`, `rst014a`, `rst002b`, and `rst006a` reject later dependent tables or columns. They are not current acceptance gates; adapt or retire them only when requested work needs those checks. |
| Test-suite cost and duplication | Focused commands and isolated disposable tenants exist; focused mode names are repeated across runner maps and dispatch conditions. | **Unapproved recommendation:** simplify overlapping historical phase and reset suites where a smaller maintained test proves the same behavior, and centralize focused-mode metadata when runner work is otherwise required; retain authorization, entity isolation, security, and data-integrity coverage. |
| Production preparation | Development configuration exists. | Production work and readiness assessment are deferred until the user explicitly requests them. Client configuration remains unknown and no feature or application has been accepted. |

## Post-cadrage UI dependencies outside the approved design pass

These are deferred backend or data-contract gaps, not instructions to expand a
visual wave. Stop and ask before changing their queries, endpoints, schema,
permissions, authentication, or business rules.

| Reference behavior | Current evidence | Deferred dependency |
| --- | --- | --- |
| Editable Operation drawer | Execution is available through guarded Operation routes, but forms issue one-use submission tokens and the session keeps at most 20 pending tokens. A 21-form probe invalidated the first form. | Keep the new drawer read-only. A single-Operation form-loading contract and the existing multi-form token problem need a separate backend decision. |
| Email OTP during login | The MJL login template and auth library expose password login and invitation/reset flows; no matching email-OTP stage was found in the reviewed code. | Do not claim or simulate two-step login. Authentication work requires a separate request. |
| Reference and account fields/actions | Partner/Project screens expose only current name, parent, status, and guarded lifecycle facts through shared responsive lists and progressive forms; Project edit preserves its original Partner. Admin access presents invitation, role update, deactivation, and revocation through shared responsive tables and progressive exact-form dialogs, including real invitation delivery states. | Defer Partner description, reference counts/timestamps, unsupported account profile/reactivation actions, and bulk assignment replacement. |
| Extra list and dashboard data | Current monitoring filters support search, Partner, Project, validation, execution, completeness, and period overlap. The reference also depicts Agent/deadline filters and Admin metrics not supplied by the current read contracts. | Use supported filters and real projections only; seek a separate decision for missing read contracts. |
| Complete failed-form recovery | Activity recovery stores a subset of selections and rebuilds draft Operations by index. | Preserve current behavior and do not claim full restoration without a separate backend change. |
