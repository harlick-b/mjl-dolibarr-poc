# Design system

One visual guide for the current React application. Product behavior and access
come from [business rules](business-rules.md); this guide controls presentation.
Use institutional, sober, calm, clear, French-first screens with one dominant
purpose and concise actionable feedback. Reuse existing components and customize
accessible shadcn primitives only for real consumers; use Lucide consistently.

## Identity and tokens

Inter is packaged locally through @fontsource, weights 400/500/600/700, with
Arial, Helvetica, sans-serif fallbacks. Browser rendering does not depend on a
remote font service. Runtime mapping lives in frontend/src/app/tailwind.css; changes
to approved values require explicit user authorization. No generated token file
or separate design manifest is required.

Use Tailwind utilities for application styling. `tailwind.css` is the build entry:
it contains only local font imports, the Tailwind import and approved `@theme`
tokens. Page/component selectors and `@apply` blocks do not belong there. Shared
panels, workspace frames and buttons live in `frontend/src/shared/ui`; auth form
defaults live in `AuthCard`. Keep component-specific states on the affected
control, and use low-specificity defaults where a specialized control (such as
OTP) needs to override a form default. `data-ui` attributes are structural/test
hooks, not a second stylesheet. Document-wide focus, coarse-pointer and reduced
motion defaults use Tailwind variants on the document body.

| Color role                 | Value     |
| -------------------------- | --------- |
| navy                       | #16324f   |
| actionBlue                 | #164f7a   |
| focusBlue                  | #164f7a   |
| supportBlue                | #7fb3d5   |
| text.strong                | #202529   |
| text.secondary             | #34414a   |
| text.muted                 | #5c6870   |
| text.inverse               | #ffffff   |
| surface.base               | #ffffff   |
| surface.subtle             | #f5f7f8   |
| surface.disabled           | #e3e8eb   |
| surface.selected           | #eaf3f8   |
| border.default             | #8a969e   |
| border.subtle              | #c8d0d5   |
| border.strong              | #5c6870   |
| status.successText         | #17633a   |
| status.successSurface      | #e8f5ec   |
| status.successBadgeSurface | #caface   |
| status.warningText         | #6b4900   |
| status.warningSurface      | #fff4cc   |
| status.dangerText          | #8a1c1c   |
| status.dangerSurface       | #fdecec   |
| status.infoText            | #164f7a   |
| status.infoSurface         | #eaf3f8   |
| overlay                    | #202529b8 |

Page uses surface.subtle; panels use surface.base. Primary actions use actionBlue
and inverse text; secondary actions use base and actionBlue. Links use actionBlue.
Disabled uses surface.disabled and text.muted; selected uses surface.selected.
Status pairs use their matching text/surface colors. Success badge alone uses
#caface; general success feedback uses #e8f5ec. Meaning never depends on color alone.

| Token / role                                             | Value                                           |
| -------------------------------------------------------- | ----------------------------------------------- |
| Metadata / label / body / functional text                | .75 / .8125 / .875 / 1rem                       |
| Section / page / KPI text and line height                | 1.25/1.5, 1.5/2, 2/2.5rem                       |
| Font weights                                             | 400 regular, 500 medium, 600 semibold, 700 bold |
| Line-height scale                                        | 1, 1.25, 1.5, 2, 2.5rem                         |
| Spacing scale                                            | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px       |
| Page/form-group gap; section gap                         | 24px; 16px                                      |
| Compact / standard / important or coarse-pointer control | 32 / 40 / 44px                                  |
| Data / interactive row height                            | 40 / 44px through cell metrics                  |
| Compact / standard cell inline padding                   | 8 / 12px                                        |
| Control / card / panel radius                            | 10 / 6 / 8px                                    |
| Small / medium / large radius                            | 4 / 6 / 8px                                     |
| Status badge                                             | 6px radius, minimum 20px height                 |
| True chip/pill radius                                    | 999px; not ordinary workflow badges             |
| Sidebar / content maximum                                | 256 / 1440px                                    |
| Border / focus width / focus offset                      | 1 / 2 / 4px                                     |
| Feedback / transition duration                           | 120 / 180ms                                     |
| Motion easing                                            | cubic-bezier(.2,0,0,1)                          |
| Reduced motion                                           | 0ms                                             |

Typography stays in rem so it follows user font-size preferences. At a 16px
root, the type sizes above are 12, 13, 14, 16, 20, 24 and 32px.

## Components and interaction

| Component            | Contract                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Authentication shell | Clear bounded controls, 44px primary action, explicit error/focus/disabled states.                      |
| Workspace            | Responsive navigation, contextual heading and only authorized actions.                                  |
| Page/section heading | One page heading, compact supporting context, typography above.                                         |
| KPI                  | Defined measure, freshness context, exact supporting facts and guarded destination.                     |
| Form                 | Standard 40px strong-border controls, labels, inline errors, visible focus and unsaved/saving feedback. |
| Compact menu         | 32px on fine pointers; 44px on coarse pointers.                                                         |
| Data table           | Readable 40px rows; interactive 44px rows; responsive containment or reflow.                            |
| Status badge         | Visible text and matching semantic pair; no color-only meaning.                                         |
| Timeline/audit       | Clear actor/action/date/status/comment evidence within the authorized projection.                       |
| Image preview        | Bounded modal, loading/offline/failure states, keyboard close and focus return; mobile containment.     |
| Report               | Filters/export controls on screen; preserve evidence in print.                                          |

Do not add a standalone loading sentence beneath or beside action buttons.
Keep the existing disabled and accessible busy states while a request is pending.
Initial access checks use the two-column authentication frame with a restrained
indicator and keep protected content hidden. Authenticated page navigation keeps
the verified workspace shell and uses one centered minimal loader, optionally
labelled “Chargement des données…”. Full-page skeletons, fake cards and fake
tables are not the default page-loading treatment. Local table, KPI and document
waits may use a few subtle placeholders when preserving their layout helps.
Distinguish pending data from empty results and service errors. Keep editable
forms mounted during list refreshes; background reads use a compact indicator
without replacing drafts.

Keyboard focus is always visible: blue 2px ring/4px offset, two-color blue/white
treatment on dark/accent surfaces. Hover applies only to hover-capable devices;
active to activatable controls; disabled only where supported. Omit unauthorized
or unavailable links rather than rendering disabled links. Icon-only controls
need accessible names. Support keyboard navigation, forced colors, reduced
motion, narrow screens, reflow and browser zoom. Print hides navigation/transient
controls while retaining headings, status and permitted report/audit evidence.
Email and server exports have no CDN dependency.

## Composition and verification

Use applicable supplied local docs/inspiration references for product screens;
they are ignored by Git and may be absent in a fresh checkout. Missing inspiration
blocks the affected screen, not independent backend work. Composition references
do not override the navy/blue identity, tokens or business permissions. They are
not sample data. Do not create unrelated screens or components during cleanup.

The new `docs/inspiration/pta/` screens supersede older references for the same
pages and elements. The updated `mjl-prototype.html` supplies connected states and
interactions; use its final refinements, not superseded earlier function versions.
Preserve its latest horizontal annual/monthly timeline and Activity edit layout.

Focused browser checks should cover keyboard/focus behavior, narrow reflow and
loading/error/offline states for changed surfaces. Human visual, screen-reader,
keyboard/reflow and 100%/200% zoom acceptance remain outstanding; passing automated
checks is not accessibility conformance or user acceptance.

Compare rendered populated pages, empty states and dialogs directly with their
applicable references before claiming visual completion. Check alignment, spacing,
typography and controls as well as functionality; explicit user corrections take
precedence over a differing reference detail.

Sidebar identity opens an anchored account menu with explicit profile/workspace
links and logout. Enter/Space and ArrowDown open and focus the menu; Escape closes
and restores focus. Password criteria use primary blue text on the selected surface
when met, with a visible check mark. Auth form transitions keep the current CTA
busy until the next auth context is ready; initial auth loading uses an unboxed
page indicator. Logout uses one centered page indicator, without protected identity
or content, then shows the ready login form.

The application sidebar shares one composition across verified roles; its links
come from the page catalog. Identity uses first/last name initials, falling back
to an email initial for existing unnamed accounts. Truncate long names in the
trigger; expose the name/email in the menu with full title text. The popup opens
below its trigger on narrow screens to remain inside the viewport. PTA entry
tables and Dashboard metrics use actual bounded API projections; missing summary
facts must not be replaced with demo values or totals from one list page.

Empty states follow `docs/inspiration/empty/`: retain table headers and section
borders except Execution, whose empty reference shows only the count and message.
Center both the empty title and explanation within the content block
(the explicit user correction overrides left-aligned reference copy). Keep empty,
filtered-no-results, failed-load and unshared Partner data states distinct. Never
replace failed reads with zero metrics. The Dashboard displays `0 %` for empty
denominators and `-` for missing/unconfirmed finance; API facts remain exact.

`/profile` replaces `/identity` (legacy links redirect). Center the 720px personal
information form within the workspace content, with initials/name/role above it,
two name inputs, read-only email/role and a save action. The supplied profile
screenshot governs composition; omit prototype-only demo/scenario controls.
The Admin Dashboard is hidden for now; Admin opens on Users and its sidebar shows
Users and History. Users and pending invitations share one table:
name with email underneath, role, attachment, state and permitted row actions.
The table shows newest accounts first. Search matches name or email. The only
account filter is Role; its collapsible
panel and removable criteria follow the supplied PTA filter composition. Successful
invitations use a toast instead of an inline page notice. Invite given/family names share a row on desktop and stack
on mobile. Shared shadcn Select popups stay inside native dialogs; submit buttons
retain an inline spinner through submission and the required refresh.
Password criteria use the selected blue background/primary text when satisfied;
OTP boxes are centered. Successful invitation activation prefills only the login
email through navigation state, never the password or URL.
Partners and Projects retain their reference table/empty-state composition.
Agents create operation categories in the Activity operation form using the shared
dialog. Saving selects the category without submitting or resetting the Activity
draft. Category management does not appear on Partners. Execution lists show period, progress,
current assigned names and administrative stage from server facts.

The workspace has no horizontal navigation/header. Relances sits above sidebar
identity and opens the administrative reminder modal from `docs/inspiration/relances/`.
Not-found content uses the application sidebar when verified and the decorative
auth frame otherwise. Logout links target `/logout`. Session-service failure returns
to login with an unavailable message and deliberate recovery, never an endless
verification loop. Invitation HTML and plain text follow the supplied
`mjl-email-invitation-final.html` wording, including the invited role.

### Shared business dialogs

Reuse `frontend/src/shared/ui/BusinessModal.jsx` for business dialogs, including
read-only inspection where applicable. Keep outside-click, Escape and focus-return
behavior in that shared component instead of recreating it in individual screens.

Use the supplied project dialog structure: visible title and right-hand close
control, padded body, and a bordered footer with Cancel before the primary action.
Keep selector pagination in the body, above the action footer. Clicking outside
the content dismisses dialogs; clicks inside, including Select popups, do not.
Return focus to the opener. Dismissal does not cancel a write already sent.

### Planning and catalog refinement

Partners expose Validator editing of name/description; Projects expose name editing,
“Voir les PTA” and eligible closure. Projects has no year selector: its link opens
the project-filtered PTA index. The PTA screen owns project/year navigation,
whole-PTA summary, filters and table/calendar modes. Summary stage counts describe
current workflow states (an amendment under review appears under review); the
approved budget retains the authoritative approved baseline. Withdrawn rows remain
consultable but are excluded from current planning totals. Calendar uses the selected PTA and the same filters as the table, but includes
all matching pages. Table pagination must not omit calendar entries. Failed or
incomplete calendar reads remain errors, never a partial successful year.
Only the active page's sidebar entry is highlighted, including nested PTA routes.

Activity creation groups general information, dates and operations alongside the
budget breakdown. Details separate programming, History and documents; approved
Activities link to their existing financial workspace. Saving, submission and
file attachment retain their existing separate workflow steps. Prototype controls
do not authorize new mutations. Empty planning tables retain headers and distinguish
filtered results from an unused PTA. Shared controls use the approved compact and
standard sizes; XOF amounts display as F CFA without changing exact stored values.

PTA creation/edit, metadata placement, reviewer quick creation and assignments
now have supplied references in `docs/inspiration/pta/`. Reviewer creation opens
the **Créer une activité** modal directly from the PTA; Agent creation
opens the full editing workspace. Do not use the old standalone **Brief initial**
page. Required form labels end with `*`; optional labels have no parenthetical
suffix. The reviewer modal uses **Assigner à**, preloads the first ten active
Agents and keeps server search. PTA Activity lists do not expose a **Mes activités**
button; draft visibility is already enforced by the server. Undated drafts appear
under **Sans date**. Activity detail keeps reference, title, Project/Partner/PTA,
state, period and responsible Agents in one compact identity block. Its
tabs always place **Réalisation & finances** second when available; Programming
does not repeat the dates already shown above. Activity detail prioritizes context, responsibility, validation and one
authorized next action. Table/calendar share search and filters, removable chips
and reset. The filter trigger opens the supplied floating panel with canonical
state chips and an overlapping date range. The Agent selector stays inside that
panel and all searchable Agent lists reuse the supplied titled search composition.
Canonical state wording prevents duplicate review chips. Activity History uses the
supplied compact vertical timeline with event, date, actor and reason; it shows
before/after values only for facts that changed and omits raw snapshots and metadata.
Calendars use horizontal spans and a distinct start-only marker.

The Activity fiche follows the supplied administrative report composition: MJL
identity and Activity reference in the page header, a clear Activity title,
institutional navy section hierarchy, Planification, budget/Operations,
authorizations, external declarations, evidence and administrative chronology.
It retains authoritative approved values and unknown values without inventing data.
The Réalisation Activity explorer reuses the same floating filter, overlapping
period controls, Agent search and compact Activity identity hierarchy as
Prévisions. Execution-specific states and financial facts keep their own wording.
Fiche content uses ordinary French labels and displays only meaningful changes in
its chronology; raw action names, empty before/after transitions and internal
assignment cleanup are omitted. Tables use the light administrative header style
from the supplied Fiche reference.
The new-Activity assignment email reuses the approved Activity-review visual shell,
with its Activity summary and direct Activity link in HTML and plain text.
