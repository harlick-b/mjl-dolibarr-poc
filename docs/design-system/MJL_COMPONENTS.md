# MJL Clarity System — Components

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers UI components only.

## Purpose

Define the reusable component catalog for app UI, auth pages, system emails, official outputs, and E2E-covered flows.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The production access model uses one global business role per user: AGENT_SAISIE, AGENT_VERIFICATEUR, VALIDATEUR_DEFINITIF, or ADMIN_PLATEFORME.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Component Definition Standard

Each component must define purpose, when to use it, when not to use it, layout, behavior, accessibility, French labels, role visibility, and E2E coverage expectation.

## Priority Components

- MJL workspace shell
- Page header
- Dashboard card
- KPI card
- Status badge
- Alert card
- Validation timeline
- Decision panel
- Activity summary card
- Project summary card
- Document checklist
- Export toolbar
- Filter bar
- Audit table
- Invitation status badge
- Auth form
- Empty state
- Error state
- Confirmation modal
- Email header
- Email CTA button
- Email footer

## Implemented Operational Components

### Business status badge

- **Purpose/use:** show an existing activity or expense business state before
  supporting detail. Do not use it for validation-stage guidance, alert
  severity, permission, or system availability.
- **Layout/behavior:** short text inside the existing status-pill pattern;
  unknown UI values use the neutral `Statut non reconnu` fallback.
- **Accessibility/French:** the label always carries the meaning without
  relying on tone. Final validation and disbursement use distinct French
  labels.
- **Visibility/E2E:** visibility follows the containing guarded route; browser
  and pure helper coverage verify known, distinct, and unknown values.

### Persistent system state

- **Purpose/use:** explain information, success, warning, danger,
  unavailability, initial/filtered emptiness, permission, loading, or a
  partial-result failure. Do not replace field errors or use transient toasts
  for workflow-critical feedback.
- **Layout/behavior:** bordered persistent block with a title, explanation,
  and optional normalized retry action. Loading uses `aria-busy`; danger,
  unavailable, permission, and partial errors use alert semantics.
- **Accessibility/French:** text states the condition and recovery without
  exposing SQL, driver details, paths, or internal identifiers.
- **Visibility/E2E:** role-neutral inside an already authorized surface;
  Phase 2 helper/page checks cover safe output and partial states.

### Shared field, error summary, and recovery

- **Purpose/use:** use for activity create, correction, execution, decision,
  and contextual-comment forms that need stable labels, required/optional
  wording, linked errors, and safe value recovery. Do not capture request
  payloads wholesale, tokens, files, or upload metadata.
- **Layout/behavior:** each control has a stable form-specific ID, visible
  `(obligatoire)` or `(facultatif)` text, optional description, inline error,
  and a focused linked summary. JavaScript installs its validation handler
  before adding `novalidate`; native validation remains without JavaScript.
  Recovery handles are random, one-use, ten-minute, context-bound, and capped.
- **Accessibility/French:** invalid controls use `aria-invalid` and
  `aria-describedby`; summaries link to every invalid field and use
  allowlisted French domain translations.
- **Visibility/E2E:** the containing route/action guard controls access;
  Phase 2 coverage verifies focus, links, native fallback, retained values,
  expiry, isolation, one-use behavior, and caps.

### Operational filter table and pagination

- **Purpose/use:** use for the activity decision list with allowlisted status,
  scoped project, deadline risk, sort, and fixed 50-row pages. Do not add
  arbitrary search/sort SQL, page-size controls, bulk actions, or unscoped
  totals.
- **Layout/behavior:** identifier/status lead, `Ouvrir` ends the row, and the
  same entity/scope/filter fragments drive count and rows. Malformed or
  inaccessible filters fail closed. At 768px and below rows become labeled
  cards retaining activity, status, next action, and open link.
- **Accessibility/French:** desktop markup remains a semantic table; compact
  cells expose visible French `data-label` headings and pagination has a
  named navigation landmark.
- **Visibility/E2E:** project options and query results follow server scope;
  Phase 2 checks cover defaults, malformed inputs, columns, retained compact
  content, and 390/768/1024 layouts.

### Validation timeline

- **Purpose/use:** present explicit creation, workflow/validation, document,
  and contextual-comment events. Do not infer unavailable expense history or
  expose raw IDs, machine status codes, JSON, or unknown fields.
- **Layout/behavior:** normalized source envelopes merge by timestamp,
  source order, and row ID without collapsing repeated cycles. Successful
  sources remain visible with a persistent partial warning if another source
  fails.
- **Accessibility/French:** ordered-list chronology includes event, actor
  role, date, comment/reason, transition, and allowlisted human-readable
  changes.
- **Visibility/E2E:** detail-route access controls the timeline; workflow,
  contextual-exchange, document, and pure partial-result tests cover it.

### Consequence confirmation

- **Purpose/use:** enhance only expense final validation, rejection, and
  disbursement after the server has already authorized the action. Do not use
  it for prevalidation, comments, corrections, uploads, or as permission
  enforcement.
- **Layout/behavior:** server markup always exposes the consequence. The
  shared dialog shows the actual object, transition, and entered
  amount/beneficiary/date, traps focus, closes on Escape, restores the
  trigger, and submits the original form once after confirmation.
- **Accessibility/French:** native required fields validate before opening;
  the dialog has a French accessible name and explicit Annuler/Confirmer
  actions.
- **Visibility/E2E:** forms are rendered only from
  `mjl_expenses_available_actions()`; browser coverage verifies keyboard,
  consequence, original payload, no-JavaScript fallback, and direct
  prevalidation.

## Reuse Rule

Reuse existing MJL patterns before creating new ones. Do not introduce a heavy UI framework without approval.
