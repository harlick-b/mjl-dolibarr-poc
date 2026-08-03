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

### MJL workspace shell and navigation drawer

- **Purpose/use:** provide one persistent, role-projected route map around
  authenticated MJL pages. Do not use it on invitation acceptance or other
  intentionally shell-free routes, and do not treat a hidden link as access
  control.
- **Layout/behavior:** desktop uses a 256px edge-attached, full-height sticky
  rail with non-clickable category headings. At 980px and below, the visible
  in-flow fallback becomes a labelled overlay drawer only after JavaScript is
  ready. The enhanced drawer supports trigger, close button, backdrop,
  Escape, focus containment and restoration, scroll locking, background
  isolation, desktop reset, and reduced motion. While open, it preserves the
  sidebar/backdrop ancestry and makes every other branch inert, including
  branches added later; it restores only inert state owned by the drawer and
  preserves pre-existing inert state exactly.
- **Accessibility/French:** skip-link and landmark order are preserved. Focus
  never remains inside a drawer when it becomes hidden. Trigger state uses
  `aria-controls` and `aria-expanded`; the rail uses the French accessible
  name `Menu module MJL`.
- **Visibility/E2E:** the closed policy projection calls existing access
  helpers and removes inaccessible leaves and empty categories without
  replacing route guards. Pure registry and browser coverage verify exact
  paths, contextual audit state, role projection, no-JavaScript fallback,
  resize focus, external-focus rejection, dynamic background isolation,
  reduced-motion behavior, touch interaction, overflow, and the 390, 768,
  980, 1024, and 1366px widths. Half-width automation is supplemental reflow
  evidence only; real 100%/200% browser zoom requires the dedicated headed
  Phase 3D manual gate.

### Page header

- **Purpose/use:** identify the single dominant purpose of an authenticated
  MJL page and optionally expose useful orientation, status/scope context, and
  already-authorized actions. Do not repeat the workspace title, add a
  decorative kicker, repeat the title in prose, or make authorization
  decisions.
- **Layout/behavior:** exactly one `h1` leads a whitespace-based header without
  an enclosing card. Optional breadcrumbs precede it; useful description and
  semantic context follow it. One primary action precedes ordered secondary
  actions, and actions wrap without reordering on smaller screens.
- **Accessibility/French:** the header is labelled by its `h1`; breadcrumb
  navigation uses `Fil d’Ariane` and marks the final item as the current page.
  Action labels and context use concise French business wording, remain
  keyboard reachable, and retain visible focus.
- **Visibility/E2E:** each route decides which context and actions are already
  authorized before calling the pure renderer. Isolation coverage verifies
  escaping, ordering, optional regions, and exactly one `h1`; browser coverage
  verifies the shared contract across representative routes. The first
  rendered authorized-action journey is deferred to the guarded project
  create state in Workstream 3D.2.

### Business status badge

- **Purpose/use:** show an existing activity or expense business state before
  supporting detail. Do not use it for validation-stage guidance, alert
  severity, permission, or system availability.
- **Layout/behavior:** short text inside the existing status-pill pattern;
  unknown UI values use the neutral `Statut non reconnu` fallback. Runtime
  tones use the approved snapshot pairs: info `#164f7a` on `#eaf3f8` and
  success `#17633a` on `#e8f5ec`, with the foreground color also used for the
  solid border.
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

- **Purpose/use:** use for activity, project, expense, convention, budget-line,
  and fund-receipt create/edit, correction, execution, decision, and
  contextual-comment forms that need stable labels, required/optional wording,
  linked errors, and safe value recovery. Do not capture request payloads
  wholesale, tokens, identifiers, files, upload metadata, or computed amounts.
  The project route has one narrow selection exception: after validating the
  active entity/scope and the exact `0|1` status enum, it may derive
  session-internal `partner_scope` and `project_status` aliases. Raw `fk_*`
  values and caller-supplied aliases remain forbidden; aliases map back to form
  values only after a fresh scope/enum check when recovery is consumed.
- **Layout/behavior:** each control has a stable form-specific ID, visible
  `(obligatoire)` or `(facultatif)` text, optional description, inline error,
  and a focused linked summary. JavaScript installs its validation handler
  before adding `novalidate`; native validation remains without JavaScript.
  Recovery handles are random, one-use, ten-minute, context-bound, and capped.
  Recovery is selected by exact route, form, action, object, user, and entity
  from route-owned registries: actions sharing a visual form do not share
  recovered values or errors. Finance feedback is reconstructed from closed
  validation/database/timeline/unknown policy envelopes before recovery.
  Upload, delete, security, stale, and unknown actions never create recovery
  state. Registry membership and component visibility never authorize a POST;
  the caller retains CSRF, role, entity, scope, object, and transition guards.
  Substantive project forms additionally receive a random 128-bit, two-hour,
  one-use submission token bound to user, entity, route, form, action, and
  object. Issue and consume operations return a closed internal result reason;
  browser feedback deliberately remains one neutral French message. Tokens are
  capped per user and never recoverable. Update effects run
  after an entity-bound row lock; unchanged submissions create neither an
  update nor an audit event, and the native entity/reference uniqueness guard
  remains the create-side duplicate-effect backstop.
- **Accessibility/French:** invalid controls use `aria-invalid` and
  `aria-describedby`; summaries link to every invalid field and use
  exact allowlisted French domain translations. Composite failures stay
  form-level so valid controls are not falsely marked invalid.
  Substantive forms compare editable controls with their initial values,
  excluding hidden fields; recovered forms start dirty. Dirty same-origin
  navigation opens the keyboard-contained `Modifications non enregistrées`
  dialog, while modifier/new-tab, download, hash, and error-summary links keep
  their native behavior. A `beforeunload` warning is attached only while dirty
  and is a browser-lifecycle best effort. The first valid submit marks the form
  busy and disables submit controls; later submit events are rejected. With
  JavaScript disabled, native validation and server feedback remain available,
  and recovered project summaries use HTML autofocus.
- **Visibility/E2E:** the containing route/action guard controls access;
  Phase 2 and Phase 3 coverage verifies focus, links, native fallback, retained
  values, envelope tamper rejection, expiry, isolation, one-use behavior, and
  caps.

### Operational filter table and pagination

- **Purpose/use:** use for scoped activity, expense, partner/programme,
  project, convention, budget-line, and fund-receipt portfolios with
  allowlisted filters, deterministic sorting, and fixed 50-row pages. Do not
  add arbitrary search/sort SQL, page-size controls, bulk actions, or unscoped
  totals.
- **Layout/behavior:** identifier/status lead, `Ouvrir` ends the row, and the
  same entity/scope/filter fragments drive count and rows. Malformed or
  inaccessible filters fail closed. Project, activity, and expense routes use
  the shared select-filter renderer with stable labels, explicit active-filter
  summaries, apply/reset actions, and retained normalized GET state. One
  resource-labelled pagination renderer marks the current page
  programmatically and omits integer-zero ID defaults from retained links. At
  768px and below rows become labeled cards retaining the resource identity,
  its relevant status or key fact, the next action when one exists, and the
  open link.
- **Accessibility/French:** desktop markup remains a semantic table; compact
  cells expose visible French `data-label` headings and pagination has a named,
  resource-specific navigation landmark. Count failure may hide the exact
  total but must preserve working row navigation.
- **Visibility/E2E:** project options and query results follow server scope;
  callers retain all query, entity, scope, column, sort, and action ownership.
  Phase 2 and Phase 3 checks cover defaults, malformed inputs, columns,
  retained filters, count degradation, compact content, filter reflow, and
  390/768/1024 layouts.

### Validation timeline

- **Purpose/use:** present explicit creation, workflow/validation, document,
  and contextual-comment events on activity, expense, convention, budget-line,
  and fund-receipt details. Do not infer unavailable history or expose raw IDs,
  machine status codes, JSON, SQL, or unknown fields.
- **Layout/behavior:** normalized source envelopes merge by timestamp,
  source order, and row ID without collapsing repeated cycles. Successful
  sources remain visible with a persistent partial warning if another source
  fails.
- **Accessibility/French:** ordered-list chronology includes event, actor
  role, date, comment/reason, transition, and allowlisted human-readable
  changes. Action, role, object, channel, and status fields use a shared
  presentation registry; empty and unknown stored values render neutral
  French labels rather than database vocabulary.
- **Visibility/E2E:** detail-route access controls the timeline; workflow,
  contextual-exchange, document, finance source-failure, and pure
  partial-result tests cover it.

### Journey summary

- **Purpose/use:** place status, scope, next action, risk, evidence, and
  history context at the start of an already-authorized object detail journey.
  Do not use it as a second dashboard, an editable form, or a permission
  decision.
- **Layout/behavior:** a titled section contains short label/value pairs in
  reading order. Optional tones are restricted to the shared neutral, info,
  success, warning, and danger vocabulary; unknown tones become neutral.
- **Accessibility/French:** headings participate in the page hierarchy and
  every value remains meaningful without color. Labels use French business
  vocabulary such as `Statut`, `Périmètre`, and `Prochaine action`.
- **Visibility/E2E:** the caller owns server authorization and selects only
  role-appropriate facts. Pure rendering tests cover escaping and controlled
  tones; object journeys cover visible status/scope/next-action content.

### Guarded document panel

- **Purpose/use:** summarize supporting-evidence state and expose only guarded
  MJL downloads on project, activity, expense, convention, fund-receipt, and
  read-only aggregate document journeys. Do not expose raw ECM links, invent a
  preview, or add upload/removal controls outside contextual authorization.
- **Layout/behavior:** show exactly one controlled state: `missing` when no
  evidence is registered, `unavailable` when metadata exists but no guarded
  download resolves, `downloadable` when a guarded link is available,
  `upload-failed` after a contextual upload cannot be completed, `forbidden`
  when the caller may see the journey but not the document, or `read-only`
  when evidence is visible without a local mutation action. Verified document
  links follow the state; a local upload/retry action is permitted only when
  the route has independently authorized it. External and non-MJL URLs are
  discarded, and forbidden/read-only states never acquire upload or removal
  controls from the component.
- **Accessibility/French:** state text—not color—communicates all six
  conditions; links have document-specific French labels, unavailable and
  upload-failed states explain the next safe step, forbidden/read-only wording
  does not imply a missing file, and the section has a visible heading.
- **Visibility/E2E:** the caller retains object/entity/scope, document, and
  upload guards. Pure rendering covers the six allowlisted states and rejects
  unknown states/URLs; guarded-route, cross-entity, orphan, path-tamper, and
  helper URL tests are required for every adopted object family.

### Enriched dashboard card

- **Purpose/use:** communicate one decision-useful metric with its definition,
  active scope, period, freshness, and destination. Do not use a card for
  decorative statistics, unexplained percentages, or permission enforcement.
- **Layout/behavior:** label and value lead; definition, scope, period, and
  freshness remain visible as compact metadata; a destination explains where
  to act. A failed source replaces only its own card with a local unavailable
  state while successful sibling cards remain.
- **Accessibility/French:** unavailable text explains that the data cannot be
  loaded and suggests retrying without implying that the value is zero.
  Metadata and destination are readable without relying on icons or color.
- **Visibility/E2E:** the dashboard caller owns role/entity/scope filtering.
  Smoke and browser checks must prove metadata, destination, and sibling-card
  survival during one-source failure.

### Route-owned activity enhancement

- **Purpose/use:** `activities.js` enhances only the activity list/create/detail
  route. It is not a workspace-global dependency.
- **Layout/behavior:** `activities.php` emits it exactly once immediately
  before the shared shell end; `mjl_components.js` remains emitted exactly
  once by the authenticated shell.
- **Accessibility/French:** all activity forms retain native HTML validation
  when JavaScript is unavailable.
- **Visibility/E2E:** a production-source scan and rendered-route assertions
  enforce ownership, order, and absence on non-activity and forbidden shells.

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
