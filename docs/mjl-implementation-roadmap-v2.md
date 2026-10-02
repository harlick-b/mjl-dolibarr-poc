# MJL Implementation Roadmap v2

## Working rule

Development is unfinished and no feature or phase is accepted unless the user
explicitly says so. The user's latest instruction supersedes earlier plans,
approvals, verdicts, and phase sequencing. Implement only the requested slice,
check scope before editing, and use focused verification. Production
preparation remains deferred until explicitly requested.

Completed phase plans and reports are kept in Git history rather than as active
documents. The decision register preserves provenance; the gap analysis owns
unresolved weaknesses and unapproved recommendations.

## Current implementation state

- Phase 0 authority and reset structure are implemented.
- Phase 1 foundations are implemented: effective roles, invitations and account
  lifecycle, Partenaires, Projets, Types d’opération, audit, navigation, and
  document containment.
- Phase 2 Activity and Opération planning, assignments, immutable revisions,
  review decisions, and chronology are implemented.
- Phase 3A execution and exception workflows are implemented.
- Phase 3B dashboards, alerts, browsing, audit views, and operational exports
  are implemented.
- Phase 3C reconciliation and disposable restore checks are implemented. Some
  historical rollback and exact-schema suites conflict with later schemas; the
  gap analysis records this unresolved compatibility debt.
- The MJL authentication pass is implemented behind `MJL_AUTH_OTP_ENABLED`:
  email-only password verification, six-digit email OTP, verified-session
  enforcement, native login/reset bypass guards, and shared invitation/reset
  password rules. Activation remains an operator action after the retained
  technical Admin has a unique reachable email and mail delivery works.

These statements describe repository state only. They do not record user
acceptance or readiness for production.

## Post-cadrage UI pass

VUI-00 records the agreed implementation map. VUI-01 shared foundations are
implemented with Activity create/edit as the first consumer. VUI-02 shared
shell/navigation is implemented with six permission-filtered primary entries,
contextual secondary links, a real-user profile, and responsive drawer.
VUI-03 Activities list is implemented with the existing scoped monitoring
projection, supported filters, separated states, exact counts, pagination,
and read-only Operation expansion. VUI-04 Activity planning is implemented
with a redesigned create/edit form, shared controls, exact budget feedback,
browser-side validation, and dependent Partner-to-Project selection using
active-entity Project data. VUI-05 Activity workspace is implemented with
status and financial summaries, progressive tabs, current assignments, an
Operation table, lock explanations, and individual reasoned assignment
actions. VUI-06 review/revisions is implemented with immutable submitted
snapshots, staged progress, role-aware decisions, reasoned correction dialogs,
revision history, late-validation guidance, and read-only reviewer states.
VUI-07 Operation consultation is implemented with a shared read-only contextual
drawer, exact financial and execution facts, role-aware execution navigation,
and ordinary-link fallback. VUI-08 exception dialogs are implemented with one
shared progressive dialog host that moves each existing guarded form without
cloning it or issuing another token, while preserving visible no-JavaScript
forms, role eligibility, exact versions, financial facts, and terminal rules.
VUI-09 role dashboards are implemented with role-specific headings and
indicators derived from the existing scoped Activity projection, current
permission-aware work queues, execution progress, financial disclosure, and
alert previews. The Admin dashboard exposes only the existing guarded access,
history, audit-report, and technical-administration destinations; it fabricates
no account or health metrics. VUI-10 Partner/Project management is implemented
with shared responsive reference tables, current status and parent facts,
role-aware row actions, progressive create/edit and lifecycle dialogs, shared
dirty-state protection, and ordinary-form fallback. Project ownership stays
immutable after creation and the existing lifecycle, permission, token, and
entity boundaries remain under their current backend owners. VUI-11 Users and
invitations is implemented with shared responsive access tables, progressive
invitation and account-action dialogs, French invitation statuses, exact
existing guarded forms, real delivery outcomes, dirty-state protection, and
ordinary-form fallback. Invitation, role, deactivation, revocation, Admin-only,
token, and entity boundaries remain under their current backend owners.
VUI-12 history and exports is implemented with shared report navigation,
responsive filter/date controls, visible active selections, complete-selection
export actions, and a chronological global-audit presentation. Existing
server-side filters, cursor and page behavior, report-specific access, audited
PDF/XLSX/CSV generation, filenames, formats, projections, and active-entity
boundaries remain under their current backend owners. VUI-13 cross-screen
consistency is implemented with one shared section-heading owner, one shared
chronology primitive across contextual and global history, removal of dormant
report/timeline presentation selectors, and focused structural, responsive,
accessibility-preference, and four-role boundary checks across completed
surfaces. No query, workflow, permission, schema, or export contract changed.
No UI wave has been accepted. The user authorized
a phased design pass using `docs/inspiration/` for composition and interaction,
while the approved v3 design tokens remain the visual authority. Reuse the
current PHP/JavaScript stack, shared MJL presentation helpers, and installed
compatible widgets. Keep business rules, authorization, queries, endpoints,
schema, authentication, and exports under their existing owners. Stop and ask
before a UI wave requires a backend change.

UI wave order: VUI-01 shared foundations; VUI-02 shell/navigation; VUI-03
Activities list; VUI-04 Activity planning; VUI-05 Activity workspace and
assignments; VUI-06 review/revisions; VUI-07 read-only Operation consultation;
VUI-08 exception dialogs; VUI-09 role dashboards; VUI-10 Partner/Project
management; VUI-11 Users/invitations; VUI-12 history/exports; VUI-13
cross-screen consistency. Each wave is scoped, verified, reported, and stopped
before the next wave. Create a shared presentation mechanism with its first
actual consumer, reuse it on later screens, and remove replaced UI code and CSS.
The route map, component plan, and visual precedence are in the active
design-system README; deferred backend dependencies are in the gap analysis.

## Unfinished product work

### Phase 4: Documents

Document behavior remains behind the current containment boundary. Phase 4
is unrequested; its requirements need a fresh user request and scope review
before implementation.

### Phase 5: Accounting

Accounting remains blocked until the user supplies or accepts its structure,
classifications, roles, validation, correction, reconciliation, dependencies,
and representative examples.

### Phase 6: Official Partner reports

Official reports remain blocked until the user accepts templates, mappings,
periods, formulas, outputs, versioning, and approval behavior.

## Data and deployment boundaries

Keep the persistent development tenant free of sample/demo business data until
the user approves a dataset specification. Use only isolated disposable
fixtures for tests and remove them during teardown.

Do not perform deployment preparation, production configuration, production
backup work, go-live checks, or a production-readiness verdict until the user
explicitly requests them. Passing development checks cannot authorize those
activities.
