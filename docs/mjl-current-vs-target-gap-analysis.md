# MJL Current vs Target Gap Analysis

This is implementation-debt evidence beneath the canonical v2 documents.

RST-007A, RST-004, RST-008, and RST-009A completed the Phase 1 audit,
obsolete-finance, account-lifecycle, and navigation reset on 2026-08-14.

| Target | Current state | Remaining gap / owner |
| --- | --- | --- |
| One transactional audit | Append-only entity-scoped audit table and transaction-bound writer exist. | Revision chronology and later object adapters: RST-007B. |
| No obsolete finance core | Finance schemas, loaders, routes, reports, update SQL, and tests are removed; the initial RST-006A planning source is implemented behind a migration detector. | RST-006A still needs full normalized schema-contract detection, a durable dependent-unit rollback gate, and the complete acceptance matrix before shared cutover. |
| Invitation-only access | Business-role-only selector/verifier invitation and reset lifecycle is active; groups/scopes are not authorization inputs. | Production email/base URL/secrets remain operator confirmations. |
| Phase 1 navigation | Exact role-projected reference/audit/access destinations are active and direct guards agree. | Activity/Opération navigation remains gated by RST-009B. |
| Activity assignment model | RST-002B is executed; RST-006A source adds automatic creator-primary assignment, abandonment closure, restoration, and preserves manual Validator commands. | RST-006A still needs allowlisted list filters and 50-row pagination plus the remaining concurrency, workflow, reference-deactivation, and HTTP-abuse acceptance journeys. Shared cutover remains pending. |
| Documents/accounting/official outputs | RST-010A closes custom and native document delivery; obsolete assumptions are unreachable or removed. | Phase 4 strategy is approved but sequenced after Phase 3C; accounting and official-output decisions remain deferred. |
| Persistent empty tenant | Exactly one native Admin; target/custom business tables remain empty. | Disposable factories expand only with their owning feature units. |

RST-010A containment hardening is executed. Both MJL endpoints deny without
bootstrap, native ECM and generic delivery entrypoints are blocked, and
disposable plus shared filesystem/ECM state checks prove no document mutation.
DEC-041 approves the target Phase 4 strategy, not its out-of-sequence runtime
implementation. RST-005 was executed and independently verified under DEC-047
on 2026-09-01; the tenant remains business-empty with one native Admin.
RST-002B implementation was approved by DEC-048 and its DEC-049 fast guarded
local cutover completed under DEC-050 on 2026-09-02. RST-006A implementation is approved under DEC-051 and
sequenced after RST-002B execution evidence. RST-005 and DEC-048 authorize no
Phase 4 or other later business work.
