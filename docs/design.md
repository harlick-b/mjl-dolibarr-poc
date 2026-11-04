# Design system

One visual guide for the current React application. Product behavior and access
come from [business rules](business-rules.md); this guide controls presentation.
Use institutional, sober, calm, clear, French-first screens with one dominant
purpose and concise actionable feedback. Reuse existing components and customize
accessible shadcn primitives only for real consumers; use Lucide consistently.

## Identity and tokens

Inter is packaged locally through @fontsource, weights 400/500/600/700, with
Arial, Helvetica, sans-serif fallbacks. Browser rendering does not depend on a
remote font service. Runtime mapping lives in frontend/src/app/styles.css; changes
to approved values require explicit user authorization. No generated token file
or separate design manifest is required.

| Color role | Value |
| --- | --- |
| navy | #16324f |
| actionBlue | #164f7a |
| focusBlue | #164f7a |
| supportBlue | #7fb3d5 |
| text.strong | #202529 |
| text.secondary | #34414a |
| text.muted | #5c6870 |
| text.inverse | #ffffff |
| surface.base | #ffffff |
| surface.subtle | #f5f7f8 |
| surface.disabled | #e3e8eb |
| surface.selected | #eaf3f8 |
| border.default | #8a969e |
| border.subtle | #c8d0d5 |
| border.strong | #5c6870 |
| status.successText | #17633a |
| status.successSurface | #e8f5ec |
| status.successBadgeSurface | #caface |
| status.warningText | #6b4900 |
| status.warningSurface | #fff4cc |
| status.dangerText | #8a1c1c |
| status.dangerSurface | #fdecec |
| status.infoText | #164f7a |
| status.infoSurface | #eaf3f8 |
| overlay | #202529b8 |

Page uses surface.subtle; panels use surface.base. Primary actions use actionBlue
and inverse text; secondary actions use base and actionBlue. Links use actionBlue.
Disabled uses surface.disabled and text.muted; selected uses surface.selected.
Status pairs use their matching text/surface colors. Success badge alone uses
#caface; general success feedback uses #e8f5ec. Meaning never depends on color alone.

| Token / role | Value |
| --- | --- |
| Metadata / label / body / functional text | .75 / .8125 / .875 / 1rem |
| Section / page / KPI text and line height | 1.25/1.5, 1.5/2, 2/2.5rem |
| Font weights | 400 regular, 500 medium, 600 semibold, 700 bold |
| Line-height scale | 1, 1.25, 1.5, 2, 2.5rem |
| Spacing scale | 0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px |
| Page/form-group gap; section gap | 24px; 16px |
| Compact / standard / important or coarse-pointer control | 32 / 40 / 44px |
| Data / interactive row height | 40 / 44px through cell metrics |
| Compact / standard cell inline padding | 8 / 12px |
| Control / card / panel radius | 10 / 6 / 8px |
| Small / medium / large radius | 4 / 6 / 8px |
| Status badge | 6px radius, minimum 20px height |
| True chip/pill radius | 999px; not ordinary workflow badges |
| Sidebar / content maximum | 256 / 1440px |
| Border / focus width / focus offset | 1 / 2 / 4px |
| Feedback / transition duration | 120 / 180ms |
| Motion easing | cubic-bezier(.2,0,0,1) |
| Reduced motion | 0ms |

Typography stays in rem so it follows user font-size preferences. At a 16px
root, the type sizes above are 12, 13, 14, 16, 20, 24 and 32px.

## Components and interaction

| Component | Contract |
| --- | --- |
| Authentication shell | Clear bounded controls, 44px primary action, explicit error/focus/disabled states. |
| Workspace | Responsive navigation, contextual heading and only authorized actions. |
| Page/section heading | One page heading, compact supporting context, typography above. |
| KPI | Defined measure, freshness context, exact supporting facts and guarded destination. |
| Form | Standard 40px strong-border controls, labels, inline errors, visible focus and unsaved/saving feedback. |
| Compact menu | 32px on fine pointers; 44px on coarse pointers. |
| Data table | Readable 40px rows; interactive 44px rows; responsive containment or reflow. |
| Status badge | Visible text and matching semantic pair; no color-only meaning. |
| Timeline/audit | Clear actor/action/date/status/comment evidence within the authorized projection. |
| Image preview | Bounded modal, loading/offline/failure states, keyboard close and focus return; mobile containment. |
| Report | Filters/export controls on screen; preserve evidence in print. |

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

Focused browser checks should cover keyboard/focus behavior, narrow reflow and
loading/error/offline states for changed surfaces. Human visual, screen-reader,
keyboard/reflow and 100%/200% zoom acceptance remain outstanding; passing automated
checks is not accessibility conformance or user acceptance.
