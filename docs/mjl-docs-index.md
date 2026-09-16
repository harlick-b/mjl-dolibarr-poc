# MJL Documentation Index

Read `docs/mjl-authoritative-decisions.md` first. The user's latest explicit
instruction supersedes every conflicting repository document or recorded
decision.

## Active authority

| Subject | Document |
| --- | --- |
| Authority order and current decisions | `docs/mjl-authoritative-decisions.md` |
| Complete business rules | `docs/mjl-functional-specification-v2.md` |
| Decision history and provenance | `docs/mjl-decision-register-v2.md` |
| Core, excluded, and gated scope | `docs/mjl-scope-boundary-v2.md` |
| Visibility and permitted actions | `docs/mjl-permission-matrix-v2.md` |
| States, transitions, and guards | `docs/mjl-status-and-transition-model-v2.md` |
| Entities, fields, and invariants | `docs/mjl-data-dictionary-v2.md` |
| Reset-unit state | `docs/mjl-reset-manifest-v2.md` |
| Current implementation and unfinished phases | `docs/mjl-implementation-roadmap-v2.md` |

## Active supporting guidance

| Subject | Document |
| --- | --- |
| Current implementation evidence | `docs/mjl-current-app-functional-map.md` |
| Weaknesses and unapproved recommendations | `docs/mjl-current-vs-target-gap-analysis.md` |
| Focused verification selection | `docs/mjl-acceptance-tests.md` |
| Historical/current suite inventory | `docs/mjl-test-coverage-registry.md` |
| Later deployment questions | `docs/mjl-deployment-checklist.md` |
| Deferred production-readiness questions | `docs/mjl-production-readiness-plan.md` |
| Domain memory | `CONTEXT.md` |
| Visual memory | `DESIGN.md` |

The two RST-005 schema SQL files remain active technical oracles used by the
migration and tests. They are not plans.

## Design documents

`docs/design-system/approved/v3/` is approved visual authority; old product
assertions are superseded. Product rules, roles, permissions, workflows,
documents, and exports come from the canonical documents above. The current
screen audits are current-state evidence only. Older design context and handoff
documents are historical input, not authority.

## Completed work

Separate plans, strategies, execution reports, appendices, and validation
reports for completed phases and reset units are removed from the active tree.
Their history remains available in Git. Concise implementation state belongs in
the roadmap, unresolved findings belong in the gap analysis, and decision
provenance belongs in the decision register.
