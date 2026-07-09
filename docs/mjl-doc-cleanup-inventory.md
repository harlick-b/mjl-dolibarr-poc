# MJL Documentation Cleanup Inventory

MJL product decisions come from `docs/mjl-authoritative-decisions.md`.

Generated during the July 2026 documentation cleanup and re-verified during the
alignment audit. The requested raw inventory command reports permission errors
under `data/`; the actionable inventory excludes `data/`, `.git`, `vendor`,
and `node_modules`.

## Active Documentation Inventory

| Document | Current purpose | Status | Keep? | Merge into | Delete? | Reason | References found |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AGENTS.md` | Agent routing and safety guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Canonical in-repo instruction layer | Root guidance |
| `README.md` | Setup and verification entrypoint | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local runtime entrypoint | Root guidance |
| `CONTEXT.md` | Durable domain vocabulary | AUTHORITATIVE_KEEP | Yes | N/A | No | Domain memory; defers to authority file | Referenced by AGENTS |
| `DESIGN.md` | Durable design memory | AUTHORITATIVE_KEEP | Yes | N/A | No | UI memory; defers to authority file | Referenced by AGENTS |
| `docs/mjl-authoritative-decisions.md` | Target authority | AUTHORITATIVE_KEEP | Yes | N/A | No | Single MJL target authority | Referenced broadly |
| `docs/mjl-current-app-functional-map.md` | Current implementation evidence | CURRENT_STATE_KEEP | Yes | N/A | No | Evidence only; not target authority | Authority chain |
| `docs/mjl-current-vs-target-gap-analysis.md` | Code/doc debt tracker | ACTIVE_PROGRESS_KEEP | Yes | N/A | No | Required gap matrix and next actions | Authority chain |
| `docs/mjl-production-readiness-plan.md` | Readiness policy | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active readiness gates | Active docs |
| `docs/mjl-implementation-summary.md` | Implemented-capability summary | CURRENT_STATE_KEEP | Yes | N/A | No | Evidence summary; not target authority | Active docs |
| `docs/mjl-acceptance-tests.md` | Test matrix | ACTIVE_TESTING_KEEP | Yes | N/A | No | Active E2E/smoke/schema guidance | AGENTS/README |
| `docs/mjl-deployment-checklist.md` | Deployment operations | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active deployment and diagnostics guidance | README |
| `docs/mjl-doc-cleanup-inventory.md` | Cleanup inventory | ACTIVE_PROGRESS_KEEP | Yes | N/A | No | Required cleanup artifact | This audit |
| `docs/mjl-docs-index.md` | Documentation index | AUTHORITATIVE_KEEP | Yes | N/A | No | Fresh-agent routing map | Active docs |
| `docs/mjl-stale-reference-audit.md` | Stale-term classification | ACTIVE_PROGRESS_KEEP | Yes | N/A | No | Required stale-reference audit | Gap/report docs |
| `docs/mjl-post-cleanup-alignment-report.md` | Final cleanup verdict | ACTIVE_PROGRESS_KEEP | Yes | N/A | No | Required alignment report | Created in this audit |
| `docs/adr/0000-template.md` | ADR template | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active template only | Kept |
| `docs/agents/README.md` | Agent support docs | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Local agent support | Kept |
| `docs/agents/domain.md` | Agent domain support | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Local agent support | Kept |
| `docs/agents/issue-tracker.md` | Agent issue-tracker support | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Local agent support | Kept |
| `docs/agents/triage-labels.md` | Agent triage labels | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Local agent support | Kept |
| `docs/design-system/CODEX_UI_IMPLEMENTATION_GUIDE.md` | UI implementation guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance; defers to MJL authority | Design routing |
| `docs/design-system/DESIGN.md` | Design-system memory | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance; defers to MJL authority | Design routing |
| `docs/design-system/MJL_ACCESSIBILITY_CHECKLIST.md` | Accessibility checklist | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI checklist | Design routing |
| `docs/design-system/MJL_AUTH_AND_ACCESS.md` | Auth/access UX guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance | Design routing |
| `docs/design-system/MJL_COMPONENTS.md` | Component guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance | Design routing |
| `docs/design-system/MJL_CONTENT_GUIDELINES.md` | Content guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance | Design routing |
| `docs/design-system/MJL_DASHBOARD_AND_DATA_VIZ.md` | Dashboard/data-viz guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance | Design routing |
| `docs/design-system/MJL_DESIGN_GOVERNANCE.md` | Design governance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI governance | Design routing |
| `docs/design-system/MJL_E2E_TESTING_STRATEGY.md` | UI E2E strategy | ACTIVE_TESTING_KEEP | Yes | N/A | No | Active UI testing guidance | Design routing |
| `docs/design-system/MJL_EMAIL_SYSTEM.md` | Email UI/content guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance | Design routing |
| `docs/design-system/MJL_INFORMATION_ARCHITECTURE.md` | IA guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance | Design routing |
| `docs/design-system/MJL_OFFICIAL_OUTPUTS.md` | Official-output UI guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active output guidance; no PDF/Word target | Design routing |
| `docs/design-system/MJL_SCREEN_INVENTORY_TEMPLATE.md` | Screen inventory template | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active template | Design routing |
| `docs/design-system/MJL_SECURITY_UX.md` | Security UX guidance | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance | Design routing |
| `docs/design-system/MJL_TOKENS.md` | Design tokens | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance | Design routing |
| `docs/design-system/MJL_UI_RULES.md` | UI rules | AUTHORITATIVE_KEEP | Yes | N/A | No | Active UI guidance | Design routing |
| `docs/design-system/audit/current-screen-inventory.md` | Current UI inventory | CURRENT_STATE_KEEP | Yes | N/A | No | Evidence only | AGENTS/design docs |
| `docs/design-system/audit/current-ui-audit.md` | Current UI audit | CURRENT_STATE_KEEP | Yes | N/A | No | Evidence only | AGENTS/design docs |
| `mjl_dolibarr_poc_sample_data/README_SAMPLE_DATA.md` | Fixture package notes | ACTIVE_TESTING_KEEP | Yes | N/A | No | Local fixture/testing documentation only | Kept |
| `mjl_dolibarr_poc_sample_data/TEST_SCENARIOS.md` | Fixture test scenarios | ACTIVE_TESTING_KEEP | Yes | N/A | No | Local fixture/testing documentation only | Kept |
| `skills/confidence-review-loop/SKILL.md` | Local confidence review skill | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local skill | AGENTS routing |
| `skills/design-system-guardian/SKILL.md` | Local design review skill | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local skill | AGENTS routing |
| `skills/diagnose/SKILL.md` | Local diagnosis skill | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local skill | AGENTS routing |
| `skills/full-feature-validation/SKILL.md` | Local feature validation skill | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local skill | AGENTS routing |
| `skills/mjl-design-system-gate/SKILL.md` | Local MJL design gate | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local skill | AGENTS routing |
| `skills/mjl-e2e-verification/SKILL.md` | Local MJL E2E verification skill | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local skill | AGENTS routing |
| `skills/mjl-production-readiness-audit/SKILL.md` | Local production-readiness audit skill | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local skill | AGENTS routing |
| `skills/security-baseline-review/SKILL.md` | Local security review skill | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active local skill | AGENTS routing |
| `tasks/lessons.md` | Durable lessons | ACTIVE_OPERATIONAL_KEEP | Yes | N/A | No | Active lesson memory | AGENTS routing |

## Absent Guidance Files

| Document | Current purpose | Status | Keep? | Merge into | Delete? | Reason | References found |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `CODEX.md` | N/A | UNKNOWN_REVIEW_REQUIRED | No | N/A | No | File does not exist | Checked absent |
| `CLAUDE.md` | N/A | UNKNOWN_REVIEW_REQUIRED | No | N/A | No | File does not exist | Checked absent |
| `custom/mjlfinancement/README.md` | N/A | UNKNOWN_REVIEW_REQUIRED | No | N/A | No | File does not exist | Checked absent |

## Deleted Or Merged Documentation

| Document | Current purpose | Status | Keep? | Merge into | Delete? | Reason | References found |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `docs/00-context.md` through `docs/15-production-menu-scope.md` | Legacy POC context, plans, questions, and analysis | MERGE_THEN_DELETE | No | Active docs above | Yes | Superseded by authority/current/gap/testing docs | Historical cleanup refs only |
| `docs/mjl-target-client-spec.md` | Previous target spec | MERGE_THEN_DELETE | No | `mjl-authoritative-decisions.md` | Yes | Would duplicate authority | Historical cleanup refs only |
| `docs/mjl-financement-feature-coverage.md` | Feature coverage audit | MERGE_THEN_DELETE | No | `mjl-current-app-functional-map.md`, `mjl-implementation-summary.md` | Yes | Stale module version and POC wording | Historical cleanup refs only |
| `docs/mjl-financement-production-deployment.md` | Deployment checklist | MERGE_THEN_DELETE | No | `mjl-deployment-checklist.md` | Yes | Consolidated | Historical cleanup refs only |
| `docs/mjl-financement-production-readiness.md` | Readiness evidence matrix | MERGE_THEN_DELETE | No | `mjl-production-readiness-plan.md`, `mjl-implementation-summary.md` | Yes | Stale POC language and duplicate evidence | Historical cleanup refs only |
| `docs/mjl_navigation_unification_*.md` | Executed navigation plan/tracker | EXECUTED_PLAN_DELETE | No | Active docs | Yes | Executed plan clutter | Historical cleanup refs only |
| `docs/implementation-phases/*.md` | Executed/stale phase plans | EXECUTED_PLAN_DELETE | No | Summary/gap/testing docs | Yes | Stale progress truth | Historical cleanup refs only |
| `docs/design-system/00_DESIGN_SYSTEM_PLAN.md` | Executed design plan | MERGE_THEN_DELETE | No | Active design-system docs | Yes | Active design docs retained | Historical cleanup refs only |
| `docs/design-system/IMPLEMENTED_UI_RECAP_FOR_DESIGN_AGENT.md` | Generated design recap | DUPLICATE_DELETE | No | `DESIGN.md`, design-system docs | Yes | Duplicate background | Historical cleanup refs only |
| `docs/design-system/MJL_CURRENT_NAVIGATION_STRUCTURE_FOR_AGENT.md` | Stale navigation context | MERGE_THEN_DELETE | No | Current functional map and design audits | Yes | References deleted docs | Historical cleanup refs only |
| `docs/design-system/MJL_TEMPORARY_ACCESS_MODEL.md` | Stale temporary access model | MERGE_THEN_DELETE | No | Authority and context | Yes | Superseded by production roles | Historical cleanup refs only |
| `docs/design-system/audit/phase-*.md` | Executed phase compliance reports | EXECUTED_PLAN_DELETE | No | Current UI audit, implementation summary | Yes | Executed evidence clutter | Historical cleanup refs only |
| `docs/archive/agentic-skills-local-drafts/**` | Archived local skill drafts | HISTORICAL_DELETE | No | N/A | Yes | No active references found | Deleted |
| `mjl_dolibarr_poc_sample_data/AI_AGENT_PROMPT.md` | Generated sample-data prompt | DUPLICATE_DELETE | No | README/sample/test docs | Yes | Duplicate prompt | Historical cleanup refs only |
