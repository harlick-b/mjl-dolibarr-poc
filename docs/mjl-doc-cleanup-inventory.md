# MJL Documentation Cleanup Inventory

MJL product decisions come from `docs/mjl-authoritative-decisions.md`.

Generated during the July 2026 documentation cleanup. The requested raw
inventory command found the same documentation set but also reported permission
errors under `data/`; the clean inventory pass pruned `data/`.

| Document | Current purpose | Status | Keep? | Merge into | Delete? | Reason | References found |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | Agent routing and safety guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active repo instruction layer | Active root file |
| `README.md` | Setup and verification entrypoint | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active user entrypoint | Active root file |
| `CONTEXT.md` | Domain memory | AUTHORITATIVE_KEEP | Yes | N/A | No | Active glossary/domain memory | Referenced by skills |
| `DESIGN.md` | Design memory | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI memory | Referenced by skills |
| `docs/mjl-authoritative-decisions.md` | Target authority | AUTHORITATIVE_KEEP | Yes | N/A | No | New single authority | Created |
| `docs/mjl-current-app-functional-map.md` | Current-state evidence | CURRENT_STATE_KEEP | Yes | N/A | No | Evidence only, refreshed | Active authority chain |
| `docs/mjl-current-vs-target-gap-analysis.md` | Gap/debt tracker | AUTHORITATIVE_KEEP | Yes | N/A | No | Active progress/debt doc | Active authority chain |
| `docs/mjl-production-readiness-plan.md` | Readiness policy | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active readiness rules | Active docs |
| `docs/mjl-implementation-summary.md` | Implemented-capability summary | CURRENT_STATE_KEEP | Yes | N/A | No | New consolidated summary | Created |
| `docs/mjl-acceptance-tests.md` | Test matrix | ACTIVE_TESTING_KEEP | Yes | N/A | No | New consolidated testing doc | Created |
| `docs/mjl-deployment-checklist.md` | Deployment operations | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | New consolidated deployment doc | Created |
| `docs/mjl-docs-index.md` | Documentation index | AUTHORITATIVE_KEEP | Yes | N/A | No | New cleanup index | Created |
| `docs/mjl-stale-reference-audit.md` | Stale-term classification | CURRENT_STATE_KEEP | Yes | N/A | No | New audit artifact | Created |
| `docs/00-context.md` through `docs/15-production-menu-scope.md` | Legacy POC context, plans, questions, and analysis | MERGE_THEN_DELETE | No | Active docs above | Yes | Superseded by authority/current/gap/testing docs | Internal refs removed |
| `docs/mjl-target-client-spec.md` | Previous target spec | MERGE_THEN_DELETE | No | `mjl-authoritative-decisions.md` | Yes | Would duplicate authority | References updated |
| `docs/mjl-financement-feature-coverage.md` | Feature coverage audit | MERGE_THEN_DELETE | No | `mjl-current-app-functional-map.md`, `mjl-implementation-summary.md` | Yes | Stale module version and POC wording | References updated |
| `docs/mjl-financement-production-deployment.md` | Deployment checklist | MERGE_THEN_DELETE | No | `mjl-deployment-checklist.md` | Yes | Consolidated | References updated |
| `docs/mjl-financement-production-readiness.md` | Readiness evidence matrix | MERGE_THEN_DELETE | No | `mjl-production-readiness-plan.md`, `mjl-implementation-summary.md` | Yes | Stale POC language and duplicate evidence | Skills updated |
| `docs/mjl_navigation_unification_*.md` | Executed navigation plan/tracker | EXECUTED_PLAN_DELETE | No | Active docs | Yes | Executed plan clutter | References updated |
| `docs/implementation-phases/*.md` | Executed/stale phase plans | EXECUTED_PLAN_DELETE | No | Summary/gap/testing docs | Yes | Stale progress truth | References updated |
| `docs/design-system/00_DESIGN_SYSTEM_PLAN.md` | Executed design plan | MERGE_THEN_DELETE | No | Active design-system docs | Yes | Skills updated; active docs retained | References updated |
| `docs/design-system/IMPLEMENTED_UI_RECAP_FOR_DESIGN_AGENT.md` | Generated design recap | DUPLICATE_DELETE | No | `DESIGN.md`, design-system docs | Yes | Duplicate background | No active refs after update |
| `docs/design-system/MJL_CURRENT_NAVIGATION_STRUCTURE_FOR_AGENT.md` | Stale navigation context | MERGE_THEN_DELETE | No | Current functional map and design audits | Yes | References deleted docs | References updated |
| `docs/design-system/MJL_TEMPORARY_ACCESS_MODEL.md` | Stale temporary access model | MERGE_THEN_DELETE | No | Authority and context | Yes | Superseded by production roles | References updated |
| `docs/design-system/audit/phase-*.md` | Executed phase compliance reports | EXECUTED_PLAN_DELETE | No | Current UI audit, implementation summary | Yes | Executed evidence clutter | References updated |
| `docs/design-system/audit/current-screen-inventory.md` | Current UI evidence | CURRENT_STATE_KEEP | Yes | N/A | No | Active evidence | Active design docs |
| `docs/design-system/audit/current-ui-audit.md` | Current UI audit | CURRENT_STATE_KEEP | Yes | N/A | No | Active evidence | Active design docs |
| `docs/design-system/MJL_*.md`, except deleted temporary/navigation docs | Active design guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Useful active UI guidance | Updated authority pointer |
| `docs/design-system/CODEX_UI_IMPLEMENTATION_GUIDE.md` and `docs/design-system/DESIGN.md` | Active design guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Useful active UI guidance | Updated authority pointer |
| `docs/agents/*.md` | Agent support docs | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active skills support docs | Kept |
| `docs/adr/0000-template.md` | ADR template | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active template | Kept |
| `docs/archive/agentic-skills-local-drafts/**` | Archived local skill drafts | HISTORICAL_DELETE | No | N/A | Yes | No active references found | Deleted |
| `mjl_dolibarr_poc_sample_data/AI_AGENT_PROMPT.md` | Generated sample-data prompt | DUPLICATE_DELETE | No | README/sample/test docs | Yes | Duplicate prompt | References removed |
| `mjl_dolibarr_poc_sample_data/README_SAMPLE_DATA.md` | Sample fixture docs | ACTIVE_TESTING_KEEP | Yes | N/A | No | Active sample-data background | Updated as fixture-only |
| `mjl_dolibarr_poc_sample_data/TEST_SCENARIOS.md` | Sample scenario docs | ACTIVE_TESTING_KEEP | Yes | N/A | No | Active sample-data scenarios | Updated as fixture-only |
| `skills/*/SKILL.md` | Local skill routing | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local skills | Updated stale doc refs |
| `tasks/lessons.md` | Durable lessons | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active lesson memory | Kept |
