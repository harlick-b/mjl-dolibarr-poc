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
| `AGENTS.md` | AUTHORITATIVE | Agent routing, safety, and verification rules. | Yes | Defers to authority file for MJL decisions. |
| `CONTEXT.md` | AUTHORITATIVE | Durable domain vocabulary and business rules. | Yes | Must defer to authority file. |
| `DESIGN.md` | AUTHORITATIVE | Durable design memory. | Yes for UI | Must defer to authority file for product decisions. |
| `README.md` | ACTIVE_OPERATIONAL | Local setup and verification entrypoint. | Yes | Points to active docs. |
| `docs/mjl-current-vs-target-gap-analysis.md` | ACTIVE_PROGRESS | Implementation debt and current-vs-target gaps. | Yes | Tracks debt; does not override authority file. |
| `docs/mjl-production-readiness-plan.md` | ACTIVE_OPERATIONAL | Readiness gates and policy. | Yes | Does not duplicate historical readiness matrices. |
| `docs/mjl-doc-cleanup-inventory.md` | ACTIVE_PROGRESS | Documentation classification inventory. | Yes for doc cleanup | Records keep/delete/merge decisions. |
| `docs/mjl-stale-reference-audit.md` | ACTIVE_PROGRESS | Stale-term classification. | Yes for cleanup/debt triage | Classifies remaining stale terms. |
| `docs/mjl-post-cleanup-alignment-report.md` | ACTIVE_PROGRESS | Final alignment verdict and gate results. | Yes for next phase planning | Created by cleanup audit. |

## Current-State Evidence

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/mjl-current-app-functional-map.md` | CURRENT_STATE_ONLY | Current repo implementation map. | Evidence only | Cannot override target decisions. |
| `docs/mjl-implementation-summary.md` | CURRENT_STATE_ONLY | Consolidated implemented-capability summary. | Evidence only | Historical pass counts are not current verification. |
| `docs/design-system/audit/current-screen-inventory.md` | CURRENT_STATE_ONLY | Current UI screen inventory. | Evidence only | Use with authority file for UI work. |
| `docs/design-system/audit/current-ui-audit.md` | CURRENT_STATE_ONLY | Current UI audit. | Evidence only | Use with authority file for UI work. |

## Operational Documentation

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/mjl-deployment-checklist.md` | ACTIVE_OPERATIONAL | Deployment, backup, restore, diagnostics. | Yes | Supersedes old production deployment doc. |
| `docs/agents/README.md` | ACTIVE_OPERATIONAL | Agent support docs. | Yes | Not MJL target authority. |
| `docs/agents/domain.md` | ACTIVE_OPERATIONAL | Agent domain support docs. | Yes | Not MJL target authority. |
| `docs/agents/issue-tracker.md` | ACTIVE_OPERATIONAL | Agent issue-tracker support docs. | Yes | Not MJL target authority. |
| `docs/agents/triage-labels.md` | ACTIVE_OPERATIONAL | Agent triage labels. | Yes | Not MJL target authority. |
| `docs/adr/0000-template.md` | ACTIVE_OPERATIONAL | ADR template. | Yes when ADRs are needed | Template only. |
| `skills/confidence-review-loop/SKILL.md` | ACTIVE_OPERATIONAL | Local confidence review skill. | Yes | Active local skill. |
| `skills/design-system-guardian/SKILL.md` | ACTIVE_OPERATIONAL | Local design review skill. | Yes | Active local skill. |
| `skills/diagnose/SKILL.md` | ACTIVE_OPERATIONAL | Local diagnosis skill. | Yes | Active local skill. |
| `skills/full-feature-validation/SKILL.md` | ACTIVE_OPERATIONAL | Local feature validation skill. | Yes | Active local skill. |
| `skills/mjl-design-system-gate/SKILL.md` | ACTIVE_OPERATIONAL | Local MJL design gate. | Yes | Active local skill. |
| `skills/mjl-e2e-verification/SKILL.md` | ACTIVE_OPERATIONAL | Local MJL E2E verification skill. | Yes | Active local skill. |
| `skills/mjl-production-readiness-audit/SKILL.md` | ACTIVE_OPERATIONAL | Local readiness audit skill. | Yes | Active local skill. |
| `skills/security-baseline-review/SKILL.md` | ACTIVE_OPERATIONAL | Local security review skill. | Yes | Active local skill. |
| `tasks/lessons.md` | ACTIVE_OPERATIONAL | Durable lessons. | Yes | Update only for durable repeated lessons. |

## Testing Documentation

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/mjl-acceptance-tests.md` | ACTIVE_TESTING | E2E, smoke, schema, clean-install checks. | Yes | Supersedes old clean-install/test docs. |
| `docs/design-system/MJL_E2E_TESTING_STRATEGY.md` | ACTIVE_TESTING | UI E2E strategy. | Yes for UI tests | Defers to authority file. |
| `mjl_dolibarr_poc_sample_data/README_SAMPLE_DATA.md` | ACTIVE_TESTING | Fixture package notes. | Testing only | Not production guidance. |
| `mjl_dolibarr_poc_sample_data/TEST_SCENARIOS.md` | ACTIVE_TESTING | Fixture scenarios. | Testing only | Not production guidance. |

## Design Documentation

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/design-system/CODEX_UI_IMPLEMENTATION_GUIDE.md` | AUTHORITATIVE | UI implementation guidance. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/DESIGN.md` | AUTHORITATIVE | Design-system memory. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_ACCESSIBILITY_CHECKLIST.md` | AUTHORITATIVE | Accessibility checklist. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_AUTH_AND_ACCESS.md` | AUTHORITATIVE | Auth/access UX guidance. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_COMPONENTS.md` | AUTHORITATIVE | Component guidance. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_CONTENT_GUIDELINES.md` | AUTHORITATIVE | Content guidance. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_DASHBOARD_AND_DATA_VIZ.md` | AUTHORITATIVE | Dashboard/data-viz guidance. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_DESIGN_GOVERNANCE.md` | AUTHORITATIVE | Design governance. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_EMAIL_SYSTEM.md` | AUTHORITATIVE | Email UI/content guidance. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_INFORMATION_ARCHITECTURE.md` | AUTHORITATIVE | Information architecture guidance. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_OFFICIAL_OUTPUTS.md` | AUTHORITATIVE | Official output guidance. | Yes for UI/exports | Defers to MJL authority; no PDF/Word reports in current phase. |
| `docs/design-system/MJL_SCREEN_INVENTORY_TEMPLATE.md` | ACTIVE_OPERATIONAL | Screen inventory template. | Yes for UI audits | Template only. |
| `docs/design-system/MJL_SECURITY_UX.md` | AUTHORITATIVE | Security UX guidance. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_TOKENS.md` | AUTHORITATIVE | Design tokens. | Yes for UI | Defers to MJL authority. |
| `docs/design-system/MJL_UI_RULES.md` | AUTHORITATIVE | UI rules. | Yes for UI | Defers to MJL authority. |

## Deleted Documentation

| Document | Status | Purpose | Use for implementation? | Notes |
| --- | --- | --- | --- | --- |
| `docs/00-context.md` through `docs/15-production-menu-scope.md` | DELETED_STALE | Legacy POC context, questions, plans, and analyses. | No | Durable content merged. |
| `docs/mjl_navigation_unification_implementation_plan.md` | DELETED_EXECUTED_PLAN | Navigation implementation plan. | No | Executed decisions merged. |
| `docs/mjl_navigation_unification_phase_tracker.md` | DELETED_EXECUTED_PLAN | Navigation tracker. | No | Executed decisions merged. |
| `docs/implementation-phases/*.md` | DELETED_EXECUTED_PLAN | Phase plans/trackers. | No | Stale progress truth merged. |
| `docs/design-system/audit/phase-*.md` | DELETED_EXECUTED_PLAN | Executed UI compliance reports. | No | Durable conclusions merged. |
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
| `CODEX.md` | REVIEW_REQUIRED | Optional guidance file. | No | File does not exist. |
| `CLAUDE.md` | REVIEW_REQUIRED | Optional guidance file. | No | File does not exist. |
| `custom/mjlfinancement/README.md` | REVIEW_REQUIRED | Optional module README. | No | File does not exist. |
| `docs/mjl-current-vs-target-gap-analysis.md` | ACTIVE_PROGRESS | Tracks code-vs-target debt. | Yes | Must be updated when debt is fixed. |
| `docs/mjl-stale-reference-audit.md` | ACTIVE_PROGRESS | Classifies remaining stale terms. | Yes | Must be updated when stale references are fixed. |
