# MJL Current vs Target Gap Analysis

This file summarizes implementation debt against the canonical v2 package.
Detailed current evidence and the complete conflict matrix live in
`docs/mjl-phase-0-audit-report.md`. This file is not target authority.

## Summary

The current repository implements a different finance-centered application.
The target is an Activity-and-Opération application with immutable revisions,
assignment-based Agent access, identity-based review separation, integer XOF,
exception request workflows, and gated future modules. Backward compatibility
is not required. RST-000 is complete; the clean sample-data purge still needs
its exact deletion appendix and explicit approval.

## Current Gaps

| Target | Current state | Gap | Risk | Planned phase |
| --- | --- | --- | --- | --- |
| One effective revised role | Stable codes exist, but permissions and group backfills reflect the old model | Role semantics and native-admin invariants need replacement | Technical Admin may retain business power | 1 |
| Agent Activity assignment | Partner scopes plus one responsible user drive access | No primary/additional assignment history | Incorrect visibility and unsafe role changes | 1-2 |
| Supervisor/Validator global Activity view | Non-admin queries commonly filter Partner scope | Current filters contradict target review visibility | Missing queues or partial authorization | 1-2 |
| Validator-only business reference management | Admin currently creates/edits Projects and sees business controls | Business and technical authority remain mixed | Invalid business actions | 1 |
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
| Empty persistent tenant plus disposable test fixtures | Current suites and bootstrap encode and persist old scope/finance sample data | Green legacy tests can recreate removed behavior | Obsolete data appears authoritative or leaks between tests | 1-3C |
| Core integration readiness | Existing readiness docs describe the old product | Target security, restore, performance, and go-live gates are not evaluated | False production claim | 3C |

## Live Data Risk

The existing local tenant contains substantial role/scope and workflow history,
including 13,541 role rows, 1,194 scope rows, and 1,101 workflow events. It is
not production evidence and will not be migrated. It proves that the clean
purge still needs exact targets, dependency ordering, backups, rollback, and
explicit approval.

## Next Action

Prepare the read-only clean-purge deletion appendix and preservation allowlist
for the next reset unit. Do not delete data or start Phase 1 until its checksum
and exact ID are explicitly approved.
