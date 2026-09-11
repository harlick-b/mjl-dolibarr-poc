# MJL Current vs Target Gap Analysis

This is implementation-debt evidence beneath the canonical v2 documents.

RST-007A, RST-004, RST-008, and RST-009A completed the Phase 1 audit,
obsolete-finance, account-lifecycle, and navigation reset on 2026-08-14.

| Target | Current state | Remaining gap / owner |
| --- | --- | --- |
| One transactional audit | Append-only entity-scoped audit table, transaction-bound writer, and sanitized Activity chronology exist. | Later object adapters remain owned by their phases. |
| No obsolete finance core | Finance schemas, loaders, routes, reports, and update SQL are removed; RST-006A planning and RST-006B execution are active on the empty local tenant. | No Phase 3A gap. |
| Invitation-only access | Business-role-only selector/verifier invitation and reset lifecycle is active; groups/scopes are not authorization inputs. | Production email/base URL/secrets remain operator confirmations. |
| Dashboards, browsing and navigation | Financial-first Accueil, computed alerts, scoped browsing, permitted-action queues and Alertes/Rapports/exception navigation are implemented behind exact RST-012 readiness. Shared Phase 3A retains its predecessor surfaces. | Combined monitoring/report slice: 111/111 passed on September 11, including 32 export recovery and authorization-race checks. Focused and aggregate negative controls prove deliberate Phase 3B test discovery. Shared-state evidence matched and teardown completed. Disposable cutover proofs, human accessibility and guarded shared cutover remain pending. See `docs/mjl-phase-3b-recovery-validation-2026-09-11.md`, `docs/mjl-phase-3b-discovery-validation-2026-09-11.md` and `docs/mjl-phase-3b-validation-2026-09-10.md`. |
| Activity execution and exceptions | Module 0.20.0 provides integer-XOF execution, terminal locks, version-bound cancellation/reopening, Activity cancellation cascade, pure projections, and hourly reconciliation through the aggregate command. Its disposable gates, guarded shared cutover, and post-cutover checks pass. | The unsigned 170-combination human accessibility review remains a production/release blocker. |
| Documents/accounting/official outputs | RST-010A closes custom and native document delivery; obsolete assumptions are unreachable or removed. | Phase 4 strategy is approved but sequenced after Phase 3C; accounting and official-output decisions remain deferred. |
| Persistent empty tenant | Exactly one native Admin; target/custom business tables remain empty. | Disposable factories expand only with their owning feature units. |

RST-010A containment hardening is executed. Both MJL endpoints deny without
bootstrap, native ECM and generic delivery entrypoints are blocked, and
disposable plus shared filesystem/ECM state checks prove no document mutation.
DEC-041 approves the target Phase 4 strategy, not its out-of-sequence runtime
implementation. RST-005 was executed and independently verified under DEC-047
on 2026-09-01; the tenant remains business-empty with one native Admin.
RST-002B implementation was approved by DEC-048 and its DEC-049 fast guarded
local cutover completed under DEC-050 on 2026-09-02. RST-006A and the lean
Phase 2 completion units executed under DEC-052 on 2026-09-04. RST-005 and DEC-048 authorize no
Phase 4 or other later business work.
