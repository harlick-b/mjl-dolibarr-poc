# MJL Financement — Product Definition

Status: `READY_WITH_ASSUMPTIONS`

## Purpose

MJL Financement is a French-first institutional workspace for monitoring externally funded Ministry of Justice and Legislation projects. It brings project execution, activities, financing, expenses, validation, disbursement, documents, alerts, reporting, and contextual history into one guarded MJL experience instead of exposing users to raw Dolibarr navigation.

The product succeeds when each user sees the right scoped work, understands its status and next action, can recover safely from errors, and can trace decisions and supporting evidence without weakening authorization or business rules.

## Users and roles

- `AGENT_SAISIE`: creates, completes, corrects, submits, attaches evidence, and follows assigned work.
- `AGENT_VERIFICATEUR`: independently reviews, requests corrections, invalidates where permitted, and prevalidates.
- `VALIDATEUR_DEFINITIF`: makes final business decisions, supervises financing, creates or edits projects, and records disbursement separately.
- `ADMIN_PLATEFORME`: manages invitations, access, roles, scopes, configuration, and unresolved-data diagnostics.

Exactly four production roles are approved. No fifth role or dedicated read-only audit overlay is approved. Generic internal `readonly` behavior and legacy `LECTEUR` fixtures are compatibility mechanisms, not production roles. Non-admin users are limited to assigned Partenaires / Programmes; unresolved scope authoritatively fails closed.

## Core product model

Partenaires / Programmes provide the governing scope. Projects contain activities and financing context. Expenses belong to project/convention context and may reference activities and budget lines. Documents and exchanges attach to their parent object. Validation decisions, workflow actions, alerts, reports, and history make execution traceable.

The primary journeys are:

1. Draft, submit, independently prevalidate, and finally validate an activity.
2. Draft, submit, independently prevalidate, finally validate, and separately disburse an expense.
3. Create or edit projects and manage approved financing structures.
4. Add and retrieve contextual evidence through guarded routes.
5. Preview and generate scoped CSV/XLSX reports.
6. Invite users and handle login, recovery, session, and unavailable-account states.

## Operational priorities

- Scope and permissions fail closed.
- Prevalidation, final validation, and disbursement stay unmistakably distinct.
- Status, next action, evidence, prior decisions, actor, reason, and date remain visible in context.
- Dense administrative data remains scannable, searchable, filterable, sortable, and paginated.
- Dashboards answer what is happening, what is at risk, and what the current user should do.
- Errors preserve valid input, avoid disclosing restricted object existence, and offer a safe recovery path.
- French labels and institutional tone remain consistent across UI, emails, and exports.

## Product personality

Institutional, sober, calm, trustworthy, administrative, mission-oriented, and efficient. The experience should resemble a well-organized control room: restrained color, strong hierarchy, readable density, visible focus, explicit status, and conservative motion.

Avoid raw ERP complexity, decorative SaaS dashboards, promotional styling, technical vocabulary, hidden-only access control, color-only meaning, transient-only critical errors, and concealed history.

## Accessibility and content

Design guidance targets WCAG 2.2 AA outcomes without claiming conformance. All actions must be keyboard operable; focus must be visible; labels and errors must be associated; text and interface contrast must be tested; content must reflow and zoom; status must not rely on color; and implemented work must undergo automated, keyboard, screen-reader, zoom, contrast, and human testing.

Content is formal, concise, French-first, and action-oriented. Labels use approved business language, state consequences before irreversible decisions, distinguish unavailable from forbidden, and never expose inaccessible records.

## Technical and protected constraints

The confirmed stack is server-rendered Dolibarr 23.0.2/PHP with MariaDB, custom MJL CSS/JavaScript, reusable PHP helpers, Dolibarr pictos, and Playwright-led UI testing.

This design package authorizes no changes to routes, APIs, database/schema, core Dolibarr files, permissions, business rules, workflow transitions, export contracts, or implementation framework. It preserves invitation-only access, contextual uploads, guarded downloads, entity/scope checks, no-self-action, CSV/XLSX rules, and stable French terminology.

## Success criteria

- Users complete normal work in the MJL workspace without raw Dolibarr screens.
- Each role receives a relevant queue and safe next action.
- Scope and entity boundaries fail closed at UI, route, and POST levels.
- Validation and disbursement remain distinct.
- Documents, reports, alerts, and history are contextual and traceable.
- Desktop work is efficient; tablet/mobile preserve priority content and actions.
- No accessibility, security, production-readiness, or client-approval claim is made without evidence.

## Assumptions

Final brand governance, the pending permission/report matrix, report canevas details, production readiness, dedicated accessibility/responsive evidence, document preview/removal decisions, a dedicated read-only audit overlay, general microcopy, browser/data-volume expectations, and current mobile/tablet usability remain unresolved. The reported runtime snapshot is 127 E2E passed, 1 failed, and 2 not run; the unresolved-scope integrity audit failed. See [design assumptions](docs/design/design-assumptions.md).
