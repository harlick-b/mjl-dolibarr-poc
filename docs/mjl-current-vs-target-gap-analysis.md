# MJL Current vs Target Gap Analysis

This file summarizes implementation debt against the canonical v2 package.
Detailed current evidence and the complete conflict matrix live in
`docs/mjl-phase-0-audit-report.md`. This file is not target authority.

## Summary

The current repository implements a different finance-centered application.
The target is an Activity-and-Opération application with immutable revisions,
assignment-based Agent access, identity-based review separation, integer XOF,
exception request workflows, and gated future modules. Backward compatibility
is not required. RST-000 and the checksum-approved clean sample-data purge
RST-000A are complete, including ratification of RST-000A's recorded
approval-boundary deviation. RST-001 completed the effective-role and native
Admin invariant.

## Current Gaps

| Target | Current state | Gap | Risk | Planned phase |
| --- | --- | --- | --- | --- |
| One effective revised role | RST-001 enforces one active role, derives native Admin, rejects native-admin business roles, and excludes Admin from normal business workspace routes; failed new-account compensation is either completed or exposed as an inactive, current-state-discoverable recovery blocker whose audit is attempted but non-authoritative | Invitation/session invalidation details remain owned by RST-008; legacy groups remain non-authoritative compatibility data | Later unapproved account-lifecycle work must preserve the invariant and resolve any explicit recovery blocker | 1 |
| Agent Activity assignment | Partner scopes plus one responsible user drive access; Agent role changes now fail closed | No primary/additional assignment history or transfer proof | Assignment visibility remains wrong and Agent role changes remain unavailable until the target guard exists | 1-2 |
| Supervisor/Validator global Activity view | Non-admin queries commonly filter Partner scope | Current filters contradict target review visibility | Missing queues or partial authorization | 1-2 |
| Validator-only business reference management | RST-001 excludes Admin from normal Partner, Project, Activity, expense, document, reference-data, business-supervision, and mixed-report routes | Validator ownership and target reference structures remain incomplete; the dedicated Admin complete-audit export is missing and the dashboard still links to the denied mixed report route | Later route work could accidentally revive mixed authority or leave Admin without required audit export | 1-2 |
| Partner to many Projects | Native model supports it, but terminology and selection behavior remain old | Target UX and inactive rules are incomplete | Wrong creation choices | 1-2 |
| Activity authorized amount | Current Activity has no target amount model | Cannot balance Opérations or preserve proposals | Invalid financial structure | 2 |
| First-class Opérations | No target Opération model exists | Core execution entity is missing | Target workflow cannot be implemented | 2-3A |
| Immutable business revisions | Current audit/status rows are mutable-object history | No exact reviewed snapshot or contributors | Stale or self-review decisions | 2 |
| Exact v2 states | Current Activity and Expense statuses encode different semantics | Validation/execution/completeness are mixed or absent | Invalid transitions and misleading totals | 2-3A |
| Integer-safe XOF | Expense money uses `DOUBLE(24,8)` | Floating-point storage conflicts with target | Financial precision and null/zero ambiguity | 2-3A |
| Opération cancellation/reopening requests | No structured request entities exist | Version-bound exceptions are missing | Direct mutation or lost reason/history | 3A |
| Append-only transactional audit | Audit is split across several custom tables | No single revision-linked immutable contract | Incomplete reconstruction and rollback risk | 1-3B |
| Target dashboards | Current metrics use Partner scopes, Expenses, funds, and budgets | Aggregations use obsolete sources | Mixed proposals, validated, cancelled, and missing data | 3B |
| Required PDF/XLSX plus supplemental CSV | Current reports are CSV/XLSX finance reports | Required PDF and target catalogs are absent | Mislabelled or incomplete outputs | 3B |
| Gated document behavior | Guarded documents are already implemented with unapproved business assumptions | Security primitives and business policy are conflated | Premature Phase 4 behavior | 1 and 4 |
| Gated accounting and official reports | No approved accounting rules or Partner templates exist | Required client inputs are missing | Invented financial/reporting behavior | 5-6 |
| Empty persistent tenant plus disposable test fixtures | Persistent seed and bootstrap creation paths are removed; target disposable factories do not yet exist | Container-backed legacy journeys cannot yet provide target acceptance | Reintroducing the old seed would make obsolete data authoritative | 1-3C |
| Core integration readiness | Existing readiness docs describe the old product | Target security, restore, performance, and go-live gates are not evaluated | False production claim | 3C |

## Live Data Risk

RST-000A deleted the inventoried role/scope/workflow history and other local
sample data without migration. The exact pre-reset inventory and recovery
boundary remain private checksum evidence. Persistent business tables are now
empty.

## Next Action

Review and explicitly approve RST-002A before retiring Partner authorization
scopes. RST-001 approval does not approve RST-002A.
