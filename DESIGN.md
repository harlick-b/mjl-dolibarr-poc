# MJL Design Memory

MJL product decisions come from `docs/mjl-authoritative-decisions.md`. This
file records durable design evidence and must defer to that authority.

This file records confirmed design facts from current CSS and design-system
documentation. It is not a redesign brief.

## Evidence checked

- `custom/mjlfinancement/css/mjl_app.css.php`
- `custom/mjlfinancement/css/mjl_auth.css.php`
- `docs/design-system/DESIGN.md`
- `docs/design-system/MJL_TOKENS.md`
- `docs/design-system/MJL_COMPONENTS.md`
- `docs/design-system/MJL_UI_RULES.md`
- `docs/design-system/MJL_ACCESSIBILITY_CHECKLIST.md`
- `docs/design-system/audit/current-ui-audit.md`
- `docs/design-system/audit/current-screen-inventory.md`

No Tailwind config, shadcn setup, screenshots, or separate component library
files were found in the repository scan.

## Visual personality

- Institutional, sober, calm, clear, trustworthy, administrative.
- French-first and mission-oriented rather than raw ERP-oriented.
- The UI should hide unnecessary Dolibarr complexity where safe and reveal MJL
  project, activity, validation, document, alert, and reporting work.

## Typography

- Current CSS uses `Arial, Helvetica, sans-serif`.
- Main page headings use navy text and compact sizing:
  - `h1`: around `26px`, line-height `1.2`.
  - `h2`: around `18px`, line-height `1.3`.
  - Auth title: around `24px`.
- Body/help text is generally `14px` with line-height around `1.45`.
- Labels and kickers are uppercase, bold, around `12px`.
- Letter spacing is explicitly `0` in current MJL CSS.

## Current palette

Confirmed colors in current CSS:

- Primary navy: `#16324f`.
- Link/action blue: `#164f7a`.
- Body text: `#202529`.
- Secondary text: `#34414a`.
- Muted text: `#5c6870`.
- Surface: `#ffffff`.
- Page/background tint: `#f5f7f8`.
- Border: `#d7dee2`.
- Stronger border: `#c5ced4`.
- Form border: `#b7c2c9`.
- Focus blue: `#7fb3d5`.
- Warning background/border/text: `#fff4df`, `#d99a2b`, `#6f4200`.
- Danger background/border/text: `#fff0ed`, `#e08a80`, `#8a1f15`.
- Success background/border/text: `#edf7f1`, `#8ac09c`, `#1f6b3a`.
- Auth success background/border/text: `#edf7f2`, `#b9decf`, `#1e5b43`.
- Auth error background/border/text: `#fff1f1`, `#e3b7b7`, `#8a2f2f`.

`docs/design-system/MJL_TOKENS.md` defines recommended token names, but the
current CSS is still literal-value based rather than a complete tokenized
implementation.

## Spacing, radius, shadows

- Cards, panels, sidebars, and workspace headers use `6px` border radius.
- Auth inputs and buttons use `4px` border radius.
- Status pills use `999px` radius.
- Current shell/page spacing commonly uses `12px`, `14px`, `18px`, `22px`,
  and `24px`.
- Shadows are light and administrative:
  - cards/sidebar: `0 6px 16px rgba(32, 37, 41, 0.05)`;
  - workspace header: `0 8px 22px rgba(32, 37, 41, 0.06)`;
  - auth panel: `0 12px 30px rgba(32, 37, 41, 0.08)`.

## Layout rules

- The MJL workspace uses a two-column shell: sticky sidebar plus main content.
- Sidebar width is constrained with a `minmax(180px, 230px)` track.
- Card grids use `repeat(auto-fit, minmax(220px, 1fr))`.
- Page headers are white bordered panels with clear title/copy and optional
  user context.
- Auth pages center a single panel on a muted full-height background.
- On narrow screens, the module shell collapses to a single column and sidebar
  navigation becomes a responsive grid.

## Component rules

Confirmed recurring components and patterns:

- MJL workspace shell and grouped sidebar.
- Page header with kicker, title, descriptive copy, and user context.
- Dashboard/KPI cards with labels, values, status pills, and action links.
- Alert cards with severity tone, affected object, metadata, and destination.
- Status pills with semantic tone classes.
- Timeline/comment blocks for workflow history and project notes.
- Filter panels and table wrappers for dense administrative data.
- Auth panels, fields, messages, error states, and primary auth buttons.
- Empty states use dashed/bordered panels and explanatory text.

Design-system docs require components to define purpose, usage, layout,
behavior, accessibility, French labels, role visibility, and E2E expectations.

## Icon rules

- No separate icon library setup was found.
- Current Dolibarr module/object classes use Dolibarr `picto` names such as
  `money-bill`, `contract`, `projecttask`, `expense`, `payment`, `check`,
  `comments`, `accounting`, and `generic`.
- Avoid introducing a new icon framework without a documented decision.

## Responsive behavior

- Desktop/laptop is the primary target.
- Mobile must remain usable.
- Current CSS includes responsive behavior for the MJL module shell and
  sidebar navigation.
- Text and actions should not overlap or rely on fixed wide layouts.

## Accessibility expectations

- Status and severity must never rely on color alone.
- Keyboard focus must be visible; current action/sidebar focus uses a
  `3px solid #7fb3d5` outline.
- Labels, errors, forms, tables, and action buttons must remain understandable.
- Alerts should state the problem, object, actor, expected action, urgency, and
  destination.
- Auth wording should avoid account enumeration and public registration cues.

## Good existing patterns

- Role-aware MJL workspace shell and sidebar.
- Auth panel styling with a single focused task.
- Status-first workflow detail patterns using status pills and timelines.
- Alert cards that link to the affected object.
- Guarded document access surfaced through MJL object/document pages.
- Export center framing outputs with filters, scope, format, and filenames.

## Anti-patterns to avoid

- Raw Dolibarr ERP navigation as the normal business user workflow.
- Public registration labels or sign-up flows.
- Technical object IDs, raw object types, and JSON audit details in normal user
  workflows unless the screen is explicitly advanced/audit-only.
- Hiding screens without reviewed inventory and direct-route guards.
- Color-only status or severity.
- Heavy UI frameworks or a new icon system without a documented decision.
- Redesigning every surface at once.

## Needs design decision

- Final MJL brand assets and whether an official brand palette exists.
- Formal CSS custom-property token implementation.
- Final icon-library policy, if Dolibarr pictos are not enough.
- Official report/export visual templates.
- Inline document preview design.
- Final production wording after client review.
