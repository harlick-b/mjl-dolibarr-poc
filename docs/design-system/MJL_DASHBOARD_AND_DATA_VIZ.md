# MJL Clarity System — Dashboard And Data Visualization

## Purpose

Define meaningful dashboards and data visualization for administrative action, not decoration.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
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

Each KPI should include value, label, short context, link to details, and status if relevant.

## Charts

Charts are allowed only when they clarify decisions. Prefer tables or cards when exact action matters.

Allowed examples:

- simple progress indicator;
- validation bottleneck by level;
- activity status distribution;
- deadline risk summary.

Avoid decorative pie charts, unexplained percentages, multiple charts without actions, and charts without source or period.

## DPAF Dashboard Priorities

Level 3 / DPAF dashboard should prioritize global project status, activity status distribution, validation bottlenecks, deadline risks, overdue activities, export shortcuts, audit indicators, and missing documents.
