# MJL Documentation Index

MJL product decisions come from `docs/mjl-authoritative-decisions.md`.

## Authority Order

1. Direct user instruction in the current Codex task.
2. `docs/mjl-authoritative-decisions.md`.
3. Active implementation prompt or task file for the current phase.
4. `docs/mjl-current-vs-target-gap-analysis.md`.
5. `docs/mjl-current-app-functional-map.md` for current-state evidence only.
6. Existing implementation code.
7. Older docs, historical prompts, executed plans, or POC notes.

## Active Documentation

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/mjl-authoritative-decisions.md` | AUTHORITATIVE | Final MJL target decisions and authority order. | Yes | Highest repo doc authority. |
| `CONTEXT.md` | AUTHORITATIVE | Durable domain vocabulary and business rules. | Yes | Must defer to authority file. |
| `AGENTS.md` | AUTHORITATIVE | Agent routing, safety, and verification rules. | Yes | Must defer to authority file for MJL decisions. |
| `README.md` | ACTIVE_OPERATIONAL | Local setup and verification entrypoint. | Yes | Points to active docs. |
| `DESIGN.md` | AUTHORITATIVE | Durable design memory. | Yes for UI | Defers to authority file for product decisions. |
| `docs/mjl-current-vs-target-gap-analysis.md` | ACTIVE_PROGRESS | Implementation debt and current-vs-target gaps. | Yes | Does not override authority file. |
| `docs/mjl-production-readiness-plan.md` | ACTIVE_OPERATIONAL | Readiness gates and policy. | Yes | Does not duplicate readiness matrix history. |
| `docs/mjl-implementation-summary.md` | CURRENT_STATE_ONLY | Consolidated implemented-capability summary. | Yes as evidence | Historical pass counts are not current verification. |

## Current-State Evidence

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/mjl-current-app-functional-map.md` | CURRENT_STATE_ONLY | Current repo implementation map. | Evidence only | Cannot override target decisions. |
| `docs/design-system/audit/current-screen-inventory.md` | CURRENT_STATE_ONLY | Current UI screen inventory. | Evidence only | Use for UI work with authority file. |
| `docs/design-system/audit/current-ui-audit.md` | CURRENT_STATE_ONLY | Current UI audit. | Evidence only | Use for UI work with authority file. |

## Operational Documentation

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/mjl-deployment-checklist.md` | ACTIVE_OPERATIONAL | Deployment, backup, restore, diagnostics. | Yes | Supersedes old production deployment doc. |
| `docs/agents/*.md` | ACTIVE_OPERATIONAL | Agent support config. | Yes | Not MJL target authority. |
| `docs/adr/0000-template.md` | ACTIVE_OPERATIONAL | ADR template. | Yes when ADRs are needed | Template only. |
| `skills/*/SKILL.md` | ACTIVE_OPERATIONAL | Local skill routing. | Yes | Updated to active doc names. |
| `tasks/lessons.md` | ACTIVE_OPERATIONAL | Durable lessons. | Yes | No update needed for this one-off cleanup. |

## Testing Documentation

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/mjl-acceptance-tests.md` | ACTIVE_TESTING | E2E, smoke, schema, clean-install checks. | Yes | Supersedes old clean-install/test docs. |
| `mjl_dolibarr_poc_sample_data/README_SAMPLE_DATA.md` | ACTIVE_TESTING | Fixture package notes. | Testing only | Not production guidance. |
| `mjl_dolibarr_poc_sample_data/TEST_SCENARIOS.md` | ACTIVE_TESTING | Fixture scenarios. | Testing only | Not production guidance. |

## Deleted Documentation

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/00-context.md` through `docs/15-production-menu-scope.md` | DELETED_STALE | Legacy POC context, questions, plans, and analyses. | No | Durable content merged. |
| `docs/mjl_navigation_unification_implementation_plan.md` | DELETED_EXECUTED_PLAN | Navigation implementation plan. | No | Executed decisions merged. |
| `docs/mjl_navigation_unification_phase_tracker.md` | DELETED_EXECUTED_PLAN | Navigation tracker. | No | Executed decisions merged. |
| `docs/implementation-phases/*.md` | DELETED_EXECUTED_PLAN | Phase plans/trackers. | No | Stale progress truth merged. |
| `docs/design-system/audit/phase-*.md` | DELETED_EXECUTED_PLAN | Executed UI compliance reports. | No | Durable conclusions merged into active docs. |
| `docs/archive/agentic-skills-local-drafts/**` | DELETED_STALE | Archived local skill drafts. | No | No active references found. |
| `mjl_dolibarr_poc_sample_data/AI_AGENT_PROMPT.md` | DELETED_DUPLICATE | Generated sample-data prompt. | No | Superseded by active sample-data docs and AGENTS. |

## Merged Documentation

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/mjl-target-client-spec.md` | MERGED_AND_DELETED | Previous target spec. | No | Merged into authoritative decisions. |
| `docs/mjl-financement-feature-coverage.md` | MERGED_AND_DELETED | Feature coverage audit. | No | Merged into current map and implementation summary. |
| `docs/mjl-financement-production-deployment.md` | MERGED_AND_DELETED | Deployment operations. | No | Merged into deployment checklist. |
| `docs/mjl-financement-production-readiness.md` | MERGED_AND_DELETED | Readiness evidence matrix. | No | Merged into readiness plan and implementation summary. |
| `docs/design-system/00_DESIGN_SYSTEM_PLAN.md` | MERGED_AND_DELETED | Executed design plan. | No | Active design docs retained. |
| `docs/design-system/IMPLEMENTED_UI_RECAP_FOR_DESIGN_AGENT.md` | MERGED_AND_DELETED | Generated design recap. | No | Active design memory retained. |
| `docs/design-system/MJL_CURRENT_NAVIGATION_STRUCTURE_FOR_AGENT.md` | MERGED_AND_DELETED | Navigation context. | No | Superseded by current functional map. |
| `docs/design-system/MJL_TEMPORARY_ACCESS_MODEL.md` | MERGED_AND_DELETED | Temporary access model. | No | Superseded by production role model. |

## Superseded But Retained

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | Cleanup preferred deletion once durable content was merged. |

## Remaining Review Items

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/mjl-stale-reference-audit.md` | REVIEW_REQUIRED | Classifies remaining stale terms. | Yes | Code-level debt remains intentionally unfixed. |
| `docs/mjl-current-vs-target-gap-analysis.md` | ACTIVE_PROGRESS | Tracks code-vs-target debt. | Yes | Must be updated when debt is fixed. |
