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

- The W0 architecture-migration prerequisite is complete. W1 is complete for
  the Partner and Project empty-action list GETs: both stable roots hand off to
  one reference HTTP handler, which preserves direct authorization and
  entity-scoped reads, prepares list data, and renders through the dedicated
  reference template. Operation Types and all detail/create/edit/lifecycle/
  recovery/POST paths remain on the prior route. W2 is complete for the full
  `activities.php` GET/POST surface and its Activity-specific monitoring list,
  read, and render branch: the root has one HTTP-handler handoff, reads and
  audit chronology have explicit owners, prepared views render through Activity
  templates, and the superseded Activity route/render owners are removed. W3 is
  complete: one deep reference command owns reference writes, one deep access
  command owns standalone access writes, and invitation preparation uses the
  access command as a non-transaction-owning participant. Superseded procedural
  writers are removed. W4 is complete: one cohesive authentication command owns
  invitation, reset, and OTP orchestration; one private session adapter owns
  session storage; session validity is pure; access policy has one explicit
  owner; and email test capture remains email-owned. W5 is complete under
  DEC-067: report and audit previews now have selected HTTP, bounded read, and
  presentation owners; export delivery has an explicit checked stream owner;
  and only dashboard/index/alerts moved onto the retained W2 monitoring-read
  module. DEC-066 governs read-only preview rollback-call failure: rollback and
  exact budget restoration remain attempted while the public result stays the
  generic unavailable/HTTP 503 response. `MjlMonitoring`, durable export
  generation/evidence, shared Operation/request branches, formats, filters,
  filenames, CSS/JS, schema, and authentication remain unchanged. All W5 gates
  passed. DEC-068 closed the four W6 prerequisites: exact historical
  predecessor provisioning, activation-time exact auth-schema refusal, the
  RST-012 transition matrix, and descriptor lifecycle characterization.
  DEC-069 records the first W6 attempt as failed before movement. DEC-070 then
  authorized and completed the exact frozen delegation from clean named
  baseline `725821a` under amended Standard hash `b24021ac...`: the descriptor
  delegates once to the existing current-path lifecycle seam and retains native
  `_remove`/`_init` orchestration. Exact lifecycle behavior, schema, resources,
  auth rules, and prior-wave owners remain unchanged. W6 is complete. W7 is
  complete under DEC-071: only the unused
  `mjl_activity_access_can_mutate()` / `mjl_activity_access_require_mutation()`
  pair was removed after the named reachability proof. The surrounding access
  library, its read helpers, current route/command authorization, all other
  cleanup candidates, and every completed-wave owner remain unchanged. This
  closes the numbered architecture waves without recording user acceptance,
  production readiness, or an automatic migration-completion state. DEC-072
  separately reconciled all wave completions, frozen hashes, 35/35 preservation,
  current governance, and bounded residuals. Its binary gate passed with zero
  migration blockers, so the frozen architecture migration is now
  `MIGRATION_COMPLETE: YES`. Application acceptance and production readiness
  remain `NOT_CLAIMED`. The post-migration technical revalidation fixed the
  Activity GET allowlist and access/authentication transaction-start handling,
  activated 0.21.0 through the non-seeding path, and passed the focused Activity
  gate, authentication gate, and complete maintained E2E batches. Role-based
  UAT and manual accessibility sign-off remain outstanding.
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
  password rules. Version 0.21.0 and its exact empty OTP schema are installed
  locally through the non-seeding activation path. The retained technical Admin now has a configured email. OTP enablement
  was requested on 2026-10-20 but remains blocked by missing mail transport
  and delivery verification.

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

Planning was requested on 2026-10-12. The consolidated scope, domain model,
security boundary, lean sequence, acceptance criteria, and unresolved decisions
are in `docs/mjl-phase4-contextual-document-management.md`. Implementation is
not authorized. Document behavior remains behind the current deny-all
containment boundary until a separately reviewed slice and cutover are approved.

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
