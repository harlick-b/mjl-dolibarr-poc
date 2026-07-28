# MJL Financement — Design System

Status: `READY_WITH_ASSUMPTIONS`

Brand status: `provisional-brand-foundation`

## Principles

1. **Institutional clarity:** show the business object, scope, status, and purpose before secondary detail.
2. **Operational efficiency:** optimize repeated expert work without removing labels, recovery, or safeguards.
3. **Traceability:** keep decisions, actors, reasons, dates, documents, and changed status visible in context.
4. **Visible system state:** distinguish loading, populated, initial-empty, filtered-empty, partial-error, forbidden, unavailable, and not-found states.
5. **Error prevention and recovery:** state consequences, validate at the right commitment point, preserve valid input, and focus recovery.
6. **Accessibility:** require keyboard operation, visible focus, semantic structure, tested contrast, reflow, zoom, and non-color meaning.
7. **Permission awareness:** show only capability-appropriate actions while preserving server-side enforcement and non-disclosure.
8. **Controlled density:** use compact tables for comparison and spacious grouping for forms, errors, and confirmations.
9. **Progressive disclosure:** keep technical and audit detail available without dominating routine tasks.
10. **Conservative motion:** use motion only to explain functional state change and respect reduced motion.

## Visual foundation

Use light surfaces, a quiet background, compact radii, restrained elevation, and a strong navy hierarchy. The baseline colors derive from the MJL context, not an external source palette: navy `#16324f`, action blue `#164f7a`, body `#202529`, secondary `#34414a`, muted `#5c6870`, white surfaces, and background `#f5f7f8`.

Use `#164f7a` for critical focus outlines on light surfaces. The existing lighter `#7fb3d5` is supporting emphasis only because it is insufficient as the sole focus boundary against white. Status colors always pair with text or an icon. All brand values remain provisional replacement points.

Typography uses `Arial, Helvetica, sans-serif`. Default body/table text is 14px for desktop operational work, with at least 16px for touch-oriented form controls. Headings use a compact, predictable hierarchy. Numeric table data uses tabular numerals where supported. French labels must tolerate longer wording without truncating meaning.

Use a 4px spacing base. Standard form rhythm is 16–24px between groups; compact table rhythm is 8–12px. Suggested radii are 4px for controls, 6px for cards, and 8px for dialogs/auth panels. Touch layouts require 44×44px targets.

## Application shell and navigation

Desktop uses a persistent grouped sidebar, minimal utility header, page header, breadcrumb/context where needed, and one dominant page action. Tablet uses compact navigation. Mobile uses a dismissible drawer with restored focus and no hover-only action.

Primary sections are Tableau de bord, Partenaires / Programmes, Projets, Activités, Dépenses, Documents, Financement, Supervision, and Administration. Hide a section with no accessible child, but never treat hiding as authorization. Restricted direct routes use a non-disclosing forbidden/not-found presentation inside the MJL shell with a safe return route.

Object pages connect project, activity, expense, financing, documents, alerts, and timeline information. Échanges stays contextual rather than becoming primary navigation.

## Components

Every component defines purpose, use/avoid rules, variants, state coverage, French labels, responsive behavior, accessibility, capability visibility, and expected workflow tests. The core families are:

- Buttons, links, icon buttons, menus, tabs, and dialogs.
- Inputs, selects, dates, text areas, checkboxes, radios, file uploads, search, and filters.
- Tables, pagination, row actions, export toolbar, document list/checklist, and audit history.
- Status badges, alerts, banners, toasts, error summaries, inline errors, and confirmations.
- Cards, KPI blocks, decision panels, timelines, project/activity summaries, and invitation/account states.
- Local loading, skeleton/progress, empty, no-results, partial-error, unavailable, forbidden, and not-found patterns.

Disabled controls explain prerequisites when visible. Permission-denied and unavailable are not interchangeable. Critical failure or required action remains persistent; a toast is reserved for low-risk confirmation.

## Tables and operational data

Desktop tables target 6–8 decision-relevant columns. Lead with identifier and business status, then decision context; technical IDs are secondary. Filters sit above results, are scope-aware, resettable, and summarized for export. Stable sorting uses urgency/deadline when relevant, otherwise recency.

Use page-based pagination with current position, visible total when supported, and stable recovery after filter/sort changes. Bulk mutation is absent from the current scope and is not introduced by this package; this is not a permanent product prohibition. Keep the primary row action discoverable; secondary actions use progressive disclosure.

On narrow screens, convert priority rows to labeled cards when relationships remain clear. Otherwise use controlled horizontal overflow with persistent row identity and reachable actions. Never hide status, primary identifier, or required next action.

## Forms and workflow decisions

Keep visible labels and textual required/optional indication. Group complex activity and expense forms into named page sections rather than inventing a wizard. Draft saving and workflow submission are distinct commitments.

Validate fields as useful, then enforce action-specific completeness on submit or decision. Multiple errors produce a page summary linked to inline messages. Preserve valid values and move focus to the recovery entry point. Return/rejection requires a reason. Final validation, rejection, invalidation, disbursement, and destructive actions use consequence-aware confirmation.

Do not invent budget-line closure/deactivation, document deletion, replacement, approval, or bulk workflows.

## Dashboards

Each role starts with work requiring attention:

- `AGENT_SAISIE`: drafts, corrections, missing evidence, and submissions.
- `AGENT_VERIFICATEUR`: independent review queue and approaching deadlines.
- `VALIDATEUR_DEFINITIF`: final decisions, finance risk, and validated-undisbursed expenses.
- `ADMIN_PLATEFORME`: access/scope configuration and unresolved-data diagnostics.

Every KPI includes scope, period, definition, freshness, and a route to investigation. Prefer exact cards, queues, and tables. Add a chart only when it improves a specific comparison and supplies labels, accessible summary, and drill-down. Fail individual cards locally.

## Business, permission, and system states

Keep four separate concepts:

- Business status: only context-confirmed activity/expense lifecycle terms.
- Validation stage: submitted, prevalidated, final validated, returned/rejected/invalidation where applicable.
- Permission state: available, unavailable by prerequisite, or inaccessible.
- System state: loading, empty, partial error, failure, session expiry, or unavailable service.

Final validation must never imply that funds moved. Disbursement is a later explicit event.

## Authentication, emails, and feedback

Login is single-purpose and has no public-registration cue. Invitation, reset, invalid/expired token, already accepted, session expiry, suspended/disabled account, and delivery failure use calm non-enumerating language with safe next steps.

Transactional emails are formal, concise, French-first, mobile-readable, plain-text compatible, and limited to approved workflow/account events. Current exports remain synchronous POST actions; do not imply an asynchronous export flow.

## Responsive behavior

- Compact: 390px review baseline; drawer navigation, stacked content, 44px controls, priority cards.
- Tablet: 768px; compact navigation, readable grouped forms, selective table adaptation.
- Desktop: 1024px; persistent sidebar and operational density.
- Wide review: 1366px; maximum working width while retaining readable line lengths.

No action is hover-only. Fixed elements must not obscure content at 200% zoom. Offline mode is out of scope.

## Accessibility

Apply WCAG 2.2 requirement reasoning and public-service implementation guidance without claiming conformance. Require logical heading and focus order, skip access where appropriate, native controls, programmatic labels/errors, semantic tables, accessible names, status announcements, target-tested contrast, usable 200% zoom/reflow, reduced-motion alternatives, and focus management/restoration for dialogs and drawers.

Implementation acceptance requires automated checks plus keyboard, screen-reader, zoom, contrast, responsive, and human testing.

## Content and motion

Use direct French actions such as “Soumettre l’activité”, “Retourner pour correction”, and “Enregistrer le décaissement”. Avoid technical route/entity vocabulary, ambiguous “Valider” where stage matters, and blame-oriented errors. Permission messages do not reveal inaccessible object existence.

Motion durations remain brief and functional. Reduced-motion mode removes transforms and nonessential transitions while preserving immediate state feedback.

## Anti-patterns

- Native Dolibarr UI leaking into normal MJL work.
- Inconsistent shells or status wording.
- Dense tables without hierarchy or responsive recovery.
- Critical errors shown only in toasts.
- Color-only status communication.
- Hidden validation history.
- Decorative KPI-card grids.
- Permission failures that expose restricted information.
- Modal-first workflow design.
- Copied source branding, code, components, tokens, or complete compositions.

Detailed artifacts: [brief](docs/design/design-brief.md), [product model](docs/design/product-model.md), [flows](docs/design/interaction-flows.md), [decisions](docs/design/design-decisions.md), [assumptions](docs/design/design-assumptions.md), [components](docs/design/component-inventory.md), and [implementation plan](docs/design/implementation-plan.md).
