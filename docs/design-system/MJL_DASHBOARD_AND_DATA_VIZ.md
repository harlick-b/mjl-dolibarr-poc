# MJL Clarity System — Dashboard And Data Visualization

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers dashboard and data-visualization UX only.

## Purpose

Define meaningful dashboards and data visualization for administrative action, not decoration.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The production access model uses one global business role per user: AGENT_SAISIE, AGENT_VERIFICATEUR, VALIDATEUR_DEFINITIF, or ADMIN_PLATEFORME.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Dashboard Philosophy

Every card, table, or chart must answer:

- What is happening?
- Is there a risk?
- What should be done?
- Where can the user click?

## KPI Cards

Use limited, useful KPIs such as:

- Activités en attente
- Activités en retard
- Projets à risque
- Validations cette semaine
- Exports disponibles
- Invitations en attente

Each KPI should include value, label, definition, active Partenaire /
Programme or global scope, period, freshness, destination, and status if
relevant.

The route owns role, entity, and scope authorization. Card configuration and
visibility are never substitutes for server-side query and direct-route
guards.

If one source fails, render a local unavailable state for that card or region.
Do not convert the failure to zero, remove successful sibling cards, or expose
SQL/driver details. The unavailable state should explain that the data cannot
currently be loaded and that the user can retry.

## Charts

Charts are allowed only when they clarify decisions. Prefer tables or cards when exact action matters.

Allowed examples:

- simple progress indicator;
- validation bottleneck by level;
- activity status distribution;
- deadline risk summary.

Avoid decorative pie charts, unexplained percentages, multiple charts without actions, and charts without source or period.

## Supervision Dashboard Priorities

The supervision dashboard should prioritize global project status, activity status distribution, validation bottlenecks, deadline risks, overdue activities, export shortcuts, audit indicators, and missing documents.
