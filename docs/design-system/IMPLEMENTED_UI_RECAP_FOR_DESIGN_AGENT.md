# MJL Clarity System - Implemented UI Recap For Design Agent

## Purpose

This file is a compact brief for an external design agent. The goal is to improve the screens already implemented in the MJL Dolibarr POC while preserving the existing business rules, access model, audit trail, and safe implementation boundaries.

The product direction is a calm administrative control room for externally funded public-finance projects. The UI must feel institutional, sober, French-first, trustworthy, and optimized for repeated administrative work.

## Non-Negotiable Constraints

- Do not propose Dolibarr core edits.
- MJL-specific work must stay inside `custom/mjlfinancement`, `docs/`, documented setup scripts, sample data, or a documented custom theme boundary.
- Preserve invitation-only access.
- Do not create or suggest a public registration page.
- Only Admin can send invitations for now.
- Preserve the temporary access model: Level 1 operational user, Level 2 validator, Level 3 DPAF/supervision, Admin.
- Preserve active Dolibarr entity filtering for custom objects, dashboards, alerts, exports, audit lists, and workflow lookups.
- Preserve workflow rules, audit history, exports, and no-self-validation behavior.
- Keep UI and content French-first.
- E2E tests are the primary validation method for UI, auth, dashboard, alert, export, official output, and workflow changes.

## Implemented Screens And Current State

### Workspace Shell

Route: `/custom/mjlfinancement/index.php`

Implemented:

- Role-aware MJL workspace header.
- Level 1 operational cards for drafts, submitted expenses, missing documents, and active alerts.
- Level 2 validation cards for submitted activities, submitted expenses, deadline risks, and active alerts.
- Level 3 DPAF cards for pending reviews, deadline risks, and reports.
- Admin card set for invitations, risks, and reports.
- Quick links are filtered by active rights.

Design improvement opportunities:

- Reduce repeated alert/risk cards where the same concept appears twice.
- Make the hierarchy between "my actions", "validation queue", and "portfolio supervision" more visually distinct.
- Improve empty states so they still guide the user toward useful next steps.

### DPAF Dashboard

Route: `/custom/mjlfinancement/dpafdashboard.php`

Implemented:

- Supervision KPIs.
- Deadline-risk cards.
- Pending review table.
- Budget/expense table.
- Recent funds and recent audit sections.
- Activity rows link directly to the activity detail when possible.

Design improvement opportunities:

- Clarify which sections are urgent versus informational.
- Convert the densest tables into scan-friendly supervision blocks where useful.
- Add clearer period/source context for KPI and audit data.

### Activity Workflow

Route: `/custom/mjlfinancement/activities.php`

Implemented:

- Activity creation and list.
- Activity detail view.
- Status-first workflow panel.
- Validation/correction/rejection actions.
- Timeline-style audit evidence.
- Document checklist context for linked expenses.
- Role-aware visibility and no-self-validation protection.

Design improvement opportunities:

- Strengthen the timeline as the primary explanation of workflow state.
- Improve decision-panel layout for Level 2 users.
- Make required correction reasons and previous decisions easier to scan.
- Keep all action labels formal and French administrative.

### Alerts And Risks

Route: `/custom/mjlfinancement/alerts.php`

Implemented:

- Standalone `Alertes MJL` center.
- Alert cards with severity, object, audience, expected action, context metadata, and action link.
- Alert types include approaching/overdue activity deadlines, submitted activities, submitted expenses, and missing expense documents.
- Alert dates are formatted as `DD/MM/YYYY`.
- Level 1 sees only own operational alerts.
- Level 2 sees validation alerts.
- Level 3 and Admin see portfolio alerts.

Design improvement opportunities:

- Decide whether multiple alert reasons for the same object should be grouped into one card.
- Improve severity language beyond warning/danger: information, warning, urgent, blocking.
- Add clearer "why this alert appears" text without making cards verbose.
- Expense alerts currently link to the expense list because expense detail redesign is deferred.

### Reports And Exports

Route: `/custom/mjlfinancement/reports.php`

Implemented:

- `Centre d'exports MJL` official-output center.
- Report selector with descriptions.
- Report-aware filters that hide unsupported filters.
- Required-filter messaging for project and convention summary reports.
- Export context: report, scope, period, filters, format, role restriction, and filename preview.
- CSV export with UTF-8 BOM, semicolon separator, French-readable statuses, and matching preview filename.
- Server-side required-filter enforcement for exports.

Design improvement opportunities:

- Improve table readability for wide official outputs.
- Clarify the difference between preview and generated official CSV.
- Consider filename previews based on stable business references instead of internal IDs in a future compatibility decision.
- Export audit logging, PDF, and print views are not implemented yet.

### Auth And Access

Implemented:

- Invitation acceptance and password setup flows are hardened.
- Password reset and invitation lifecycle have E2E coverage.
- No public registration page is created.

Design improvement opportunities:

- Continue moving auth surfaces toward MJL branding only through documented safe boundaries.
- Keep account-enumeration-safe wording for password recovery.
- Do not expose generic Dolibarr identity more than necessary.

## Design Rules To Preserve

- Every page must answer one dominant question.
- Status must appear before details.
- Validation should read as a timeline, not just buttons.
- Alerts must answer: problem, object, actor, expected action, urgency, and click destination.
- Exports must show: report name, scope, period, filters, format, filename, role restriction, and generation action.
- Status must never be color-only.
- Use restrained institutional styling; avoid decorative SaaS patterns.
- Mobile must not break, but desktop/laptop is the primary usage context.

## Requested Output From The Design Agent

Provide screen-by-screen improvement recommendations for the implemented screens above.

For each recommendation, include:

- Target screen and user level.
- Problem being solved.
- Proposed layout or component change.
- French UI copy if wording changes are needed.
- Accessibility considerations.
- E2E acceptance criteria.
- Any implementation caution tied to permissions, active-entity filtering, audit history, exports, or no-self-validation.

Do not propose changes that require Dolibarr core edits, public registration, weakened access controls, bypassed workflow rules, or removal of audit/export guarantees.
