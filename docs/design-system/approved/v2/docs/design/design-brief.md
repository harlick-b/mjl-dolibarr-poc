# MJL Financement — Design Brief

Status: `READY_WITH_ASSUMPTIONS`

## Project and purpose

MJL Financement is a French-first institutional public-finance monitoring application implemented as a custom Dolibarr workspace. It must help authorized administrative users create, review, validate, finance, document, report, and audit scoped work without navigating generic ERP surfaces.

## Outcomes

- Make role-specific work and next actions immediately understandable.
- Preserve strict scope, entity, capability, no-self-action, and guarded-route boundaries.
- Keep validation stages, disbursement, supporting evidence, and history traceable.
- Improve dense tables, complex forms, dashboards, responsive behavior, authentication, and feedback without changing business rules.

## Users and roles

The only production roles are `AGENT_SAISIE`, `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`, and `ADMIN_PLATEFORME`. Administration and business validation remain separate responsibilities. A fifth role or dedicated read-only audit overlay is not authorized; generic internal `readonly` behavior and legacy `LECTEUR` fixtures do not create a production role.

## Included surfaces

Application shell and navigation; role dashboards; Partenaires / Programmes; projects; activities; expenses; financing; documents and contextual exchanges; supervision/reports; administration; authentication/account states; transactional emails; alerts; histories; empty/error/loading/permission states.

## Excluded

Public registration/register, external partner portal, offline mode, SMS, banking API, OCR, AI reporting, dynamic report builder, PDF/Word report design, new permissions/roles/statuses, route/API/schema changes, implementation code, and target writes.

## Direction

Create a sober, calm, trustworthy administrative control room with clear hierarchy, restrained provisional color, compact radii, readable operational density, visible focus, explicit status, progressive disclosure, and conservative motion. Preserve familiar MJL patterns while eliminating raw Dolibarr leakage and inconsistent workflow presentation.

## Key behavior

- Persistent desktop sidebar; compact tablet and dismissible mobile navigation.
- One dominant purpose/action per page.
- Status-first object summaries with contextual documents, decisions, and timelines.
- Scope-aware filters above lists; stable search/sort/pagination and explicit empty/no-result states.
- Grouped forms, page error summaries, inline errors, preserved input, and consequence-aware confirmation.
- Actionable role dashboards with KPI definition, scope, period, freshness, and drill-down.
- Non-disclosing permission failures and server-enforced authorization.

## Accessibility and content

Target WCAG 2.2 AA outcomes without claiming conformance. Require keyboard operation, visible focus, semantic headings/tables, associated labels and errors, non-color meaning, reflow/zoom, reduced motion, accessible authentication, status announcements, and target testing.

Use concise formal French, approved role/object language, explicit action verbs, and non-technical recovery messages.

## Technical fit

Guidance may acknowledge server-rendered Dolibarr/PHP, custom CSS/JavaScript, reusable PHP helpers, existing pictos, and Playwright E2E. It must not prescribe a framework migration or implementation file changes.

## Evidence limitation

Evidence paths and interpretations were supplied by the target-project context. The
v2 runtime/classification correction was supplied directly by the user. Neither was
independently retrieved or executed by `proj-design`.

## Readiness

The design brief is usable with the corrected facts, runtime evidence, and remaining assumptions recorded in [design-assumptions.md](design-assumptions.md). The reported suite is not fully green, and final brand governance, pending permission/report details, operations, dedicated accessibility/responsive evidence, and other unresolved decisions require manual confirmation.
