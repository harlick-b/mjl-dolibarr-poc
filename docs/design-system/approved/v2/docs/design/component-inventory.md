# MJL Financement — Component Inventory

Status: proposed; implementation not authorized

| Pattern | Class | Existing pattern | Action | Variants/states | Responsive/accessibility | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Application shell | context-reported | MJL sidebar/content shell | Consolidate | desktop, compact, drawer, forbidden | landmark order, skip access, drawer focus/escape | P0 |
| Page header | context-reported | workspace headers | Consolidate | title, scope, status, actions, breadcrumbs | logical heading; actions wrap without reordering | P0 |
| Role navigation | context-confirmed | role-aware helper | Preserve/consolidate | current, expanded, collapsed, hidden child | keyboard, current-location, no auth inference | P0 |
| Button/link/icon action | proposed | mixed helpers/classes | Consolidate | primary, secondary, quiet, danger, disabled, loading | 44px touch; name, focus, consequence | P0 |
| Status badge | context-reported | status pills | Consolidate | business, validation, invitation, alert | text/icon plus color; announced changes | P0 |
| Decision panel | proposed | workflow controls | Create | submit, return, reject, prevalidate, final validate, disburse | stage-specific labels, reason, confirmation | P0 |
| Validation timeline | context-reported | timelines | Consolidate | decision, correction, document, system event | semantic list; actor/reason/date; collapsible detail | P0 |
| Input/select/date/textarea | context-reported | Dolibarr forms | Consolidate | default, required, optional, error, disabled, readonly | persistent label, described error, 16px touch text | P0 |
| Checkbox/radio | proposed | native controls | Consolidate | selected, indeterminate, error, disabled | native semantics and enlarged hit area | P0 |
| Error summary/inline error | proposed | inconsistent messages | Create | single, multiple, server, partial | linked fields, focused summary, preserved values | P0 |
| Confirmation dialog | proposed | workflow confirms | Consolidate | final, destructive, financial | focus trap/restore, escape policy, consequence | P0 |
| File upload | context-reported | contextual forms | Consolidate | empty, selected, progress, failure, forbidden | clear rules, error recovery; parent scope retained | P0 |
| Document checklist/list | proposed | guarded links | Consolidate/create | present, missing, unavailable, removed, forbidden | no raw path/disclosure; labeled actions | P0 |
| Data table | context-reported | table wrappers | Consolidate | standard, compact, loading, empty, no-result, partial error | semantic table, caption, overflow/card transform | P0 |
| Filter bar | context-reported | filter panels | Consolidate | applied, collapsed, invalid, reset | explicit summary; keyboard order | P0 |
| Search | proposed | scoped list search | Create where justified | idle, query, loading, no-result, error | label, submit/clear, result announcement | P1 |
| Pagination | proposed | partial cues | Consolidate | first, middle, last, unknown total | current page programmatic; stable focus | P1 |
| Export toolbar | context-reported | export framing | Consolidate | filters, CSV, XLSX, preview, generating, failed | POST/token note; selection summary | P0 |
| KPI block | context-reported | metric cards | Consolidate | value, trend/context, alert, loading, unavailable | label, definition, scope/period/freshness, destination | P1 |
| Alert card/banner | context-reported | alerts | Consolidate | info, warning, danger, success, partial | persistent when actionable; icon/text/status | P0 |
| Toast | proposed | transient feedback | Restrict | low-risk success/info only | announced; never sole critical feedback | P1 |
| Empty state | context-reported | explanatory empties | Consolidate | initial, filtered, cleared, permission-limited | safe next action; no inaccessible counts | P0 |
| Partial-error panel | proposed | inconsistent | Create | local load/error/retry | preserves unrelated content; live status | P0 |
| Project/activity summary | proposed | detail blocks | Consolidate | compact, full, warning | status/next action first; labeled values | P1 |
| Auth form/panel | context-reported | styled Dolibarr auth | Consolidate | login, invite, reset, invalid/expired, session ended | non-enumerating, focus/error recovery | P0 |
| Invitation status | context-confirmed | access management | Create/consolidate | seven confirmed invitation states | text/icon, date/actor, safe resend visibility | P1 |
| Tabs | proposed | contextual views | Use sparingly | active, disabled, overflow | proper tab semantics or links; no hidden required state | P2 |
| Transactional email | context-reported | custom helpers/templates | Consolidate | invitation, reset, workflow, deadline | mobile/plain text; concise French; safe URL | P1 |

No component defines backend authorization, a new business status, bulk mutation, global upload, inline document preview, or audit-retention policy.
