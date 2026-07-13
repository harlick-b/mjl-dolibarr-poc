# MJL Documentation Index

MJL product decisions come from `docs/mjl-authoritative-decisions.md`.

## Authority Order

1. Direct user instruction in the current Codex task.
2. `docs/mjl-authoritative-decisions.md`.
3. `docs/mjl-current-vs-target-gap-analysis.md`.
4. `docs/mjl-current-app-functional-map.md` for current-state evidence only.
5. Existing implementation code.

Historical prompts, executed plans, phase reports, demo/UAT packs, cleanup
records, and stale POC notes are not active implementation guidance.

## Core Product And Domain Docs

| Document | Purpose |
| --- | --- |
| `AGENTS.md` | Agent routing, safety, repository conventions, and verification rules. |
| `README.md` | Local setup and project entrypoint. |
| `CONTEXT.md` | Durable product/domain vocabulary, role rules, reports, dashboard KPI families, and pending confirmations. |
| `docs/mjl-authoritative-decisions.md` | Highest MJL target-decision authority. |
| `docs/mjl-current-app-functional-map.md` | Current implementation evidence only. |
| `docs/mjl-current-vs-target-gap-analysis.md` | Current implementation debt, blockers, and pending client decisions. |

## Operational And Verification Docs

| Document | Purpose |
| --- | --- |
| `docs/mjl-acceptance-tests.md` | E2E, smoke, schema, and clean-install verification guidance. |
| `docs/mjl-deployment-checklist.md` | Deployment, backup, restore, diagnostics, and production operations checklist. |
| `docs/mjl-production-readiness-plan.md` | Production readiness gates and unresolved deployment confirmations. |
| `mjl_dolibarr_poc_sample_data/README_SAMPLE_DATA.md` | Local fixture package notes for development/test data only. |
| `mjl_dolibarr_poc_sample_data/TEST_SCENARIOS.md` | Fixture scenarios for development/test data only. |

## Design And UI Docs

| Document | Purpose |
| --- | --- |
| `DESIGN.md` | Durable design memory. |
| `docs/mjl-ui-navigation-design-target-specification.md` | Kept UI/navigation target specification and repair plan. |
| `docs/audits/mjl-navigation-design-full-audit.md` | Kept historical navigation/design audit evidence, including referenced screenshots. |
| `docs/design-system/CODEX_UI_IMPLEMENTATION_GUIDE.md` | UI implementation guidance. |
| `docs/design-system/DESIGN.md` | Design-system memory. |
| `docs/design-system/MJL_ACCESSIBILITY_CHECKLIST.md` | Accessibility checklist. |
| `docs/design-system/MJL_AUTH_AND_ACCESS.md` | Auth/access UX guidance. |
| `docs/design-system/MJL_COMPONENTS.md` | Component guidance. |
| `docs/design-system/MJL_CONTENT_GUIDELINES.md` | Content guidance. |
| `docs/design-system/MJL_DASHBOARD_AND_DATA_VIZ.md` | Dashboard/data-viz guidance. |
| `docs/design-system/MJL_DESIGN_GOVERNANCE.md` | Design governance. |
| `docs/design-system/MJL_E2E_TESTING_STRATEGY.md` | UI E2E strategy. |
| `docs/design-system/MJL_EMAIL_SYSTEM.md` | Email UI/content guidance. |
| `docs/design-system/MJL_INFORMATION_ARCHITECTURE.md` | Information architecture guidance. |
| `docs/design-system/MJL_OFFICIAL_OUTPUTS.md` | Official output guidance. |
| `docs/design-system/MJL_SCREEN_INVENTORY_TEMPLATE.md` | Screen inventory template. |
| `docs/design-system/MJL_SECURITY_UX.md` | Security UX guidance. |
| `docs/design-system/MJL_TOKENS.md` | Design tokens. |
| `docs/design-system/MJL_UI_RULES.md` | UI rules. |
| `docs/design-system/audit/current-screen-inventory.md` | Current UI screen inventory. |
| `docs/design-system/audit/current-ui-audit.md` | Current UI audit. |

## Agent Support Docs

| Document | Purpose |
| --- | --- |
| `docs/agents/README.md` | Agent support docs overview. |
| `docs/agents/domain.md` | Agent domain support docs. |
| `docs/agents/issue-tracker.md` | Agent issue-tracker support docs. |
| `docs/agents/triage-labels.md` | Agent triage labels. |
| `docs/adr/0000-template.md` | ADR template. |
| `tasks/lessons.md` | Durable lessons from repeated mistakes or debugging discoveries. |

## Local Skills

| Document | Purpose |
| --- | --- |
| `skills/confidence-review-loop/SKILL.md` | Local confidence review skill. |
| `skills/design-system-guardian/SKILL.md` | Local design review skill. |
| `skills/diagnose/SKILL.md` | Local diagnosis skill. |
| `skills/full-feature-validation/SKILL.md` | Local feature validation skill. |
| `skills/mjl-design-system-gate/SKILL.md` | Local MJL design gate. |
| `skills/mjl-e2e-verification/SKILL.md` | Local MJL E2E verification skill. |
| `skills/mjl-production-readiness-audit/SKILL.md` | Local readiness audit skill. |
| `skills/security-baseline-review/SKILL.md` | Local security review skill. |

## Deleted Or Merged

Deleted historical docs included prompt archives, cleanup-history docs, phase
reports, demo/UAT/client-validation packs, the standalone role matrix,
reports/exports model, dashboard KPI model, the standalone implementation
summary, and superseded native-boundary audit artifacts. Durable content from
those files was consolidated into `CONTEXT.md`,
`docs/mjl-current-app-functional-map.md`, and
`docs/mjl-current-vs-target-gap-analysis.md`.
