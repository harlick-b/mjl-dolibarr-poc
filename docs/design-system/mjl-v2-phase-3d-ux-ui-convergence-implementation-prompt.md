# MJL Financement v2 Phase 3D Revised Implementation Prompt

## 0. Operating mode and authorization

Work only inside the current `mjl-dolibarr-poc` repository.

This prompt defines:

1. A mandatory prerequisite security and export-hardening stage
2. A new committed baseline after that stage
3. Phase 3D UX/UI convergence
4. Validation, rollback, and reporting requirements

This prompt does not authorize implementation while the conversation remains in Plan Mode.

Do not start Phase 4 or Phase 5.

Do not modify anything under:

```text
docs/design-system/approved/v2/
```

Do not modify Dolibarr core.

Do not install dependencies, add database migrations, change deployment configuration, alter production data, or introduce a frontend framework.

Do not commit, push, merge, tag, or create a release automatically. Stop at any point where the required committed baseline does not exist.

## 1. Authority order

Use this order when evidence conflicts:

1. Direct instructions in this prompt
2. `AGENTS.md`
3. `docs/mjl-authoritative-decisions.md`
4. The approved v2 design package
5. Protected routes, permissions, workflows, statuses, financial meanings, document rules, and export contracts
6. `docs/mjl-current-vs-target-gap-analysis.md`
7. `docs/mjl-current-app-functional-map.md` as current-state evidence
8. Current committed implementation and journey tests
9. Historical Git evidence

Do not use deleted Phase 1, Phase 2, or older Phase 3 planning documents as active authority.

Use Git history only to inspect the committed Phase 3A, 3B, and 3C implementation when their former reports are no longer present.

## 2. Known planning baseline

At the latest read-only planning inspection:

- Branch: `main`
- HEAD: `a3b92ee`
- Phase 3A checkpoint: `0399646`
- Phase 3B checkpoint: `06fe50c`
- Phase 3C checkpoint: `e81f8b1`
- Phase 3 remediation evidence: `15d94eb`
- No application or test files changed between `15d94eb` and `a3b92ee`
- The Phase 3D prompt was the only untracked file
- The Phase 3 implementation report recorded 198 passing E2E tests
- Those results are historical evidence and must not be described as newly executed

Do not assume this state is unchanged. Re-run the repository checks below.

## 3. Initial repository gate

Before changing any file, run and record:

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --porcelain=v1
git log --oneline --decorate -n 30
git diff --name-only
git diff --cached --name-only
git ls-files --others --exclude-standard
```

Confirm:

- The repository root is correct
- Phase 3A, Phase 3B, and Phase 3C remain committed
- No Phase 4 or Phase 5 implementation has begun
- The approved v2 snapshot is unchanged
- The Phase 3D prompt is tracked
- Unrelated user changes are identified and preserved
- No application changes are mixed into the documentation baseline

If the Phase 3D prompt is untracked, do not commit it automatically. Report that the specification must be checkpointed and stop.

If prerequisite security work is uncommitted or mixed with Phase 3D UI work, do not begin Phase 3D.

## 4. Required reading

Read:

- `AGENTS.md`
- `README.md`
- `CONTEXT.md`
- `DESIGN.md`
- `docs/mjl-authoritative-decisions.md`
- `docs/mjl-docs-index.md`
- `docs/mjl-current-app-functional-map.md`
- `docs/mjl-current-vs-target-gap-analysis.md`
- `docs/mjl-acceptance-tests.md`
- `docs/design-context.md`
- `docs/design-system/README.md`
- `docs/design-system/audit/current-screen-inventory.md`
- `docs/design-system/audit/current-ui-audit.md`
- `docs/implementation/mjl-design-system-v2-phase3-implementation-report.md`
- `docs/implementation/mjl-design-system-v2-phase2-manual-accessibility-evidence.md`
- `tests/manual/phase2-accessibility-fixture-manifest.md`
- This revised Phase 3D prompt

Read the immutable approved v2 entry points:

- `docs/design-system/approved/v2/PRODUCT.md`
- `docs/design-system/approved/v2/DESIGN.md`
- `docs/design-system/approved/v2/MANUAL-REVIEW.md`
- `docs/design-system/approved/v2/design-manifest.yaml`
- `docs/design-system/approved/v2/docs/design/design-brief.md`
- `docs/design-system/approved/v2/docs/design/product-model.md`
- `docs/design-system/approved/v2/docs/design/interaction-flows.md`
- `docs/design-system/approved/v2/docs/design/design-decisions.md`
- `docs/design-system/approved/v2/docs/design/design-assumptions.md`
- `docs/design-system/approved/v2/docs/design/component-inventory.md`
- `docs/design-system/approved/v2/docs/design/implementation-plan.md`
- `docs/design-system/approved/v2/design-tokens/tokens.json`
- `docs/design-system/approved/v2/design-tokens/semantic-tokens.json`

Inspect Phase 3A, 3B, and 3C through their commits and current code. Do not restore deleted historical documents merely to satisfy a reading list.

## 5. Mandatory prerequisite stage

Phase 3D must not absorb authorization or export-security corrections into its presentation rollback boundary.

Implement the following as a separately reviewed prerequisite change set.

### 5.1 Validation-history scope

Current defect:

- `custom/mjlfinancement/validations.php` filters validation rows only by active entity.
- Its expense join does not require matching entity.
- Scoped reviewers and final validators can receive validation history outside their assigned Partenaires / Programmes.
- Query failure displays raw database output.

Required correction:

- Keep `mjl_workspace_require_validation_history_access($user)`.
- Join validation, expense, and convention records with matching entity.
- Apply active-entity filtering to every participating custom object.
- Apply partner/programme scope to every non-admin result.
- Admin retains active-entity-wide visibility.
- Exclude unresolved, orphaned, cross-entity, or unscoped records from non-admin results.
- Use the established safe page-level error state and structured redacted logging.
- Do not disclose inaccessible counts, references, statuses, comments, actors, or filter metadata.

### 5.2 Workflow-audit scope

Current defect:

- `custom/mjlfinancement/workflowactions.php` filters result rows only by entity.
- Its distinct object, action, and actor-role filter values are also entity-wide.
- Scoped final validators can receive rows or metadata outside their partner/programme scope.

Required correction:

- Introduce one shared traceability-scope helper.
- Resolve project, activity, expense, convention, budget-line, and fund-receipt audit targets to a Partenaire / Programme.
- Apply the same scope predicate to result rows and distinct filter options.
- Admin retains active-entity-wide visibility.
- Non-admin report audit targets without an approved scope anchor remain hidden.
- Unresolved targets fail closed.
- Keep the route guard and existing workflow audit meanings unchanged.
- Do not introduce a new audit role or overlay.

Preferred shared file:

```text
custom/mjlfinancement/lib/mjl_traceability_scope.lib.php
```

### 5.3 Convention and fund-receipt download scope

Current defect:

- Convention and fund-receipt download fetchers validate entity and coarse route capability.
- They do not recheck that the requesting user can access the file’s parent object.

Required correction:

- Resolve the parent convention or fund receipt before returning the ECM row.
- Call `mjl_scope_can_access_object()` for the resolved parent.
- Preserve existing activity and expense download guards.
- Preserve path containment, source-object type, entity, and file existence checks.
- Return the existing non-disclosing forbidden response for denied requests.
- Do not create a document-download audit event for a denied request.
- Do not expose raw ECM paths.

Likely files:

```text
custom/mjlfinancement/documentdownload.php
custom/mjlfinancement/lib/mjl_document.lib.php
```

### 5.4 Fail-closed audit persistence

Apply this policy to official report exports and guarded document downloads:

- If the required audit event cannot be persisted, do not deliver the export or document.
- Log the internal failure through the existing redacted logging mechanism.
- Show no database or driver details to the user.
- Preserve audit event names, object types, actor roles, filters, and row counts.

For exports:

1. Validate request method, token, permission, scope, and filters.
2. Generate the complete CSV or XLSX into a temporary file.
3. Confirm generation and file readability.
4. Insert the existing `export_generated` audit event.
5. Stream the file only after the audit insert succeeds.
6. Delete the temporary file on every terminal path.

For document downloads:

1. Resolve and authorize the parent object.
2. Resolve and open the guarded file.
3. Persist the existing download audit event.
4. Begin the server-side transfer only after the audit succeeds.

The download audit proves authorized server-side transfer initiation. Do not claim that the client received every byte, because HTTP cannot establish that fact.

### 5.5 Spreadsheet formula neutralization

CSV:

- Preserve UTF-8 BOM.
- Preserve semicolon delimiters.
- Preserve current column keys, order, French headers, filenames, filters, and numeric magnitudes.
- Keep legitimate numeric fields, including negative money values, numeric.
- For textual cells whose first effective character is `=`, `+`, `-`, `@`, tab, carriage return, or line feed, prefix a literal apostrophe.
- Treat this neutralization as the only approved security exception to byte-for-byte textual value stability.
- Do not suffix every money cell with `F CFA`.

XLSX:

- Use `Numeric` only for fields declared in `money_fields`.
- Pass raw numeric money values to the XLSX driver.
- Use explicit `Text` for other exported fields.
- Do not convert date fields incidentally.
- Preserve report keys, filters, formulas, row meanings, filenames, MIME type, and column order.

### 5.6 Prerequisite validation

Use a fixture user assigned to exactly one Partenaire / Programme. Existing sample users assigned to every partner cannot prove scope isolation.

At minimum, validate:

- Admin sees all eligible active-entity validation and audit rows.
- A verifier or final validator assigned only to partner A cannot see partner B rows or filter options.
- Cross-entity, orphaned, and unresolved targets fail closed.
- Direct convention and fund-receipt download attempts across partner scope return forbidden.
- A denied download creates no audit event.
- Audit persistence failure prevents export or document delivery.
- Export generation failure creates no `export_generated` event.
- Dangerous CSV text opens as literal text.
- Negative numeric money remains numeric.
- XLSX worksheet XML proves money cells are numeric and text fields are not formulas.
- Existing route, token, role, status, and audit tests continue to pass.

### 5.7 Prerequisite stop point

After implementing and validating the prerequisite stage:

- Run diff, syntax, targeted E2E, and relevant smoke checks.
- Create or update a prerequisite security report under `docs/implementation/`.
- Report all changed files and commands.
- Stop for review and manual commit.
- Do not start Phase 3D until the prerequisite changes and the Phase 3D prompt are committed and the working tree is suitable for a new baseline.

## 6. Phase 3D baseline gate

After the prerequisite stage has been committed, run the initial repository checks again.

Record:

- New branch and HEAD
- Prompt commit
- Prerequisite security/export commit or commits
- Clean or explicitly understood working-tree state
- Prerequisite test results
- Confirmation that Phase 4 and Phase 5 have not started

This new HEAD is the Phase 3D rollback baseline.

If any prerequisite remains unresolved, create only:

```text
docs/implementation/mjl-design-system-v2-phase-3d-blocked.md
```

Include:

- Failed gate
- Branch and commit
- Working-tree state
- Remaining prerequisite
- Required corrective action
- Confirmation that Phase 3D did not begin

Use:

```text
MJL_V2_PHASE_3D_BLOCKED
```

Then stop.

## 7. Protected behavior

Phase 3D must preserve:

- MJL as a custom Dolibarr module
- No Dolibarr core modification
- Invitation-only access
- No public registration
- Existing route paths
- Direct URL and POST guards
- Active Dolibarr entity filtering
- One global business role per user
- Partner/programme scope for non-admin users
- Admin active-entity-wide access
- Fail-closed unresolved scope
- Project creation/edit restrictions
- No-self prevalidation, final validation, rejection, and disbursement
- Existing token checks
- Existing expected-status and stale-state checks
- Existing server-side object refetches
- Existing workflow transitions
- Existing audit event meanings
- Separate `Validé définitivement` and `Décaissé` meanings
- Existing financial formulas and database-field meanings
- XOF as the internal currency code
- Global Documents as read-only
- Contextual document uploads
- Guarded MJL downloads
- Contextual exchanges
- No primary Échanges destination
- CSV/XLSX-only reports
- Stable CSV BOM, delimiter, columns, order, and filenames
- Existing report keys, filters, formulas, and access guards
- Existing tested business behavior

Freeze the current backend permission model during Phase 3D.

Final client approval of the complete route/action/export permission matrix remains a release gate, not a Phase 3D implementation blocker.

Do not infer permissions from navigation visibility or visual design.

## 8. Current shared implementation to preserve

Preserve or deepen these existing foundations:

- `mjl_navigation.lib.php`
- `mjl_ui.lib.php`
- `mjl_form.lib.php`
- `mjl_table.lib.php`
- `mjl_journey.lib.php`
- `mjl_timeline_presentation.lib.php`
- `mjl_finance_metrics.lib.php`
- Existing project, activity, expense, and finance recovery helpers
- Finance feedback helpers
- Dashboard partial-error handling
- Computed alert helpers
- Guarded document helpers
- Existing route-specific authorization and action-availability functions
- Progressive form validation and duplicate-submit protection where appropriate
- Approved CSS variables, focus treatment, status styles, system states, dialog mechanics, timelines, and reduced-motion rules when they remain applicable

Shared renderers remain presentation-only. They must not determine authorization, workflow availability, or object scope.

## 9. Navigation registry and route mapping

### 9.1 Registry contract

Consolidate the current navigation helper into one authoritative registry.

Each leaf defines:

- Stable item ID
- Stable category ID
- User-facing French label
- Exact canonical path
- Optional exact contextual path aliases
- Stable order
- Icon, when useful
- Closed access-policy identifier
- Active-path matcher

Access-policy identifiers must map to existing exact access helpers. Do not use arbitrary callbacks or duplicate permission logic in the registry.

The registry is unfiltered data. A separate projection applies the current user’s existing access helpers.

Permission filtering must:

- Preserve relative order
- Hide inaccessible leaves
- Hide empty categories
- Never grant access
- Never replace direct route or POST guards

### 9.2 Canonical categories and routes

Use non-clickable category headings.

#### PILOTAGE

- `Tableau de bord` -> `/custom/mjlfinancement/index.php`
- `Alertes` -> `/custom/mjlfinancement/alerts.php`
- `Supervision financière` -> `/custom/mjlfinancement/dpafdashboard.php`

#### EXÉCUTION DES PROJETS

- `Projets` -> `/custom/mjlfinancement/projects.php`
- `Activités` -> `/custom/mjlfinancement/activities.php`
- `Dépenses / Décaissements` -> `/custom/mjlfinancement/expenses.php`
- `Documents` -> `/custom/mjlfinancement/documents.php`

#### FINANCEMENT

- `Enveloppes de financement` -> `/custom/mjlfinancement/conventions.php`
- `Lignes budgétaires` -> `/custom/mjlfinancement/budgetlines.php`
- `Fonds reçus` -> `/custom/mjlfinancement/fundreceipts.php`

Do not create a second `Conventions` leaf pointing to `conventions.php`. The current technical convention object is the existing funding-envelope route.

#### CONTRÔLE ET RAPPORTS

- `Historique des validations` -> `/custom/mjlfinancement/validations.php`
- `Rapports` -> `/custom/mjlfinancement/reports.php`
- `Historique / Audit` -> `/custom/mjlfinancement/workflowactions.php`

Treat `/custom/mjlfinancement/exchangelogs.php` as a hidden contextual alias of `Historique / Audit`. Do not expose Échanges as a primary destination.

#### ADMINISTRATION

- `Partenaires / Programmes` -> `/custom/mjlfinancement/partners.php`, Admin only
- `Utilisateurs et accès` -> `/custom/mjlfinancement/admin/access.php`
- `Préparation production` -> `/custom/mjlfinancement/roadmap.php`, only under its existing capability

Do not create a `Paramètres` destination because no matching approved route exists.

### 9.3 Active-path rules

- Derive the current path centrally from the request path.
- Remove query strings and fragments.
- Normalize against `DOL_URL_ROOT`.
- Match exact allowlisted paths only.
- Do not rely on page-supplied active keys.
- Query parameters never activate another destination.
- Presentation states such as `action=create` or `action=edit` retain the route’s leaf.
- Only zero or one leaf may be active.
- Non-admin `partners.php` has no active primary leaf because it is contextual and spans several business areas.
- `nativeforbidden.php` has no active leaf.
- Document downloads and export responses have no navigation state.

### 9.4 Redundant links to remove

Remove:

- `Partenaires / Programmes > Liste des partenaires`
- `Projets > Liste des projets`
- `Activités > Liste des activités`
- `Dépenses > Liste des dépenses`
- `Documents > Bibliothèque`
- Clickable Finance, Supervision, or Administration parents that merely open their first child
- Query-specific alert children
- Empty submenu containers and chevrons
- Dashboard quick links that duplicate the persistent sidebar

## 10. Workspace shell and page headers

### 10.1 Desktop shell

At 1024px and wider:

- Attach the sidebar to the left viewport edge
- Remove its external left margin
- Use full available application height
- Use a stable width
- Avoid a floating-card appearance
- Remove unnecessary global sidebar radius and shadow
- Keep the main workspace independently readable
- Preserve skip-link and landmark order

### 10.2 Responsive shell

At 980px and below:

- Keep navigation usable in an in-flow fallback when JavaScript is unavailable
- Enhance it into an overlay drawer when JavaScript is available
- Provide a labelled trigger with `aria-controls` and `aria-expanded`
- Support Escape and outside-click closing
- Contain focus while open
- Restore focus to the trigger
- Lock background scrolling
- Prevent background interaction
- Reset state when resizing to desktop
- Respect reduced motion
- Avoid page-level horizontal overflow

Validate at 390, 768, 980, 1024, and 1366 pixels and at 200% browser zoom.

### 10.3 Page-header API

Introduce one general page-header helper outside the dashboard-specific concern.

It accepts:

- Required page title
- Optional breadcrumb or context
- Optional useful description
- Optional already-authorized primary action
- Ordered already-authorized secondary actions
- Optional status or scope context

It must:

- Render exactly one `h1`
- Use whitespace and typography rather than an enclosing card
- Avoid repeating the global workspace title
- Avoid decorative copy that repeats the title
- Keep primary actions visible
- Wrap actions predictably on smaller screens
- Perform no authorization decisions

Keep a compatibility wrapper for `mjl_dashboard_render_header()` only during migration. Remove it after confirming zero callers.

## 11. Lists, tables, and shared states

Consolidate stable seams, not entire page models.

### 11.1 Table boundaries

Keep route ownership of:

- Queries
- Entity and scope filtering
- Columns
- Row construction
- Sorting rules
- Action availability
- Export access

Consolidate:

- The two pagination renderers
- Retained filter-query handling
- Filter-bar presentation
- Initial empty state
- Filtered no-results state
- Loading state
- Persistent page-level error
- Partial-completion state
- Permission-limited state
- Read-only state
- Success state
- Horizontal overflow treatment
- Optional authorized action-menu rendering

Do not create a universal declarative table renderer.

### 11.2 Responsive table policy

Use responsive cards only for:

- Project operational lists
- Activity operational lists
- Expense operational lists

Do so only after every displayed cell has a complete `data-label` contract and the record identifier, status, next action, and detail link remain clear.

Use controlled horizontal scrolling for:

- Partner aggregates
- Envelopes
- Budget lines
- Fund receipts
- Documents
- Validation history
- Workflow audit
- Report previews
- Dense administration tables

### 11.3 Row actions

- The record title or explicit consultation link opens detail.
- Do not make rows containing controls wholly clickable.
- Keep a central workflow action visible.
- Use a three-dot menu only for existing secondary actions.
- Do not invent actions to exercise the component.
- Do not render an empty trigger.
- Keep destructive actions visually separated and confirmed.
- The menu accepts only action descriptors already authorized by the route.
- State changes remain POST-only with existing tokens and server guards.
- Support keyboard navigation, Escape, outside click, viewport containment, and focus restoration.

`admin/access.php` receives shell, navigation, and header convergence only. Its interaction controls remain an explicitly documented legacy exception in Phase 3D.

## 12. Form and workflow presentation

Substantive create/edit forms must not remain inside operational lists or default detail views.

Reuse existing routes and the existing `action` parameter:

- GET `action=create`, `id=0`: dedicated creation state
- GET `action=edit`, valid `id`: dedicated editing state
- Existing POST `action=create`, `action=update`, and workflow action names remain unchanged

Do not add new route paths.

### 12.1 Guard ordering

Before loading form options or consuming one-use recovery data:

1. Parse the allowlisted GET presentation action.
2. Check the existing route permission.
3. Resolve and authorize the parent object when applicable.
4. Check current action availability and status.
5. Only then load scoped options and recovery data.

Invalid or unauthorized presentation states must fail closed or return to the canonical read-only destination without exposing form fields or option data.

### 12.2 Recovery

- Failed creation returns to `action=create&mjl_recovery=<handle>`.
- Failed update returns to `id=<id>&action=edit&mjl_recovery=<handle>`.
- Workflow recovery returns to its guarded action state.
- Short contextual comments continue returning to detail.
- Preserve current user/entity/route/object/action binding and one-use consumption.
- Cancel returns to list from create and to detail from edit.

### 12.3 Consequential actions

Use guarded dedicated action states on the same parent route for:

- Activity review decisions
- Expense review decisions
- Final validation
- Disbursement
- Consequential finance transitions
- Contextual supporting-document upload

Keep short workflow-required comments inline where already supported.

Remove the current expense decision modal after its workflow moves to a dedicated state. Financial and validation decisions do not satisfy the approved low-risk modal criteria.

Apply unsaved-change and duplicate-submit protection only to substantive forms. Do not apply it globally to filters, comments, or ordinary navigation.

## 13. Notifications, validation, alerts, and technical errors

Use one feedback channel for each outcome.

### 13.1 Operation feedback

Retain Dolibarr’s current event-session transport as the sole operation-message storage.

Create one MJL adapter that:

- Allows only fixed semantic levels
- Uses concise professional French
- Escapes object labels and references
- Never accepts raw database or driver errors
- Prevents duplicate messages for the same operation

Render and consume the events once inside the MJL shell before `llxFooter()` can render them again.

Behavior:

- Success is transient
- Warning and error remain persistent
- Non-outcome information uses the shared persistent information state
- Success appears only after confirmed server success
- Partial completion uses accurate warning wording
- Failed validation never creates success feedback
- JavaScript-disabled users receive equivalent inline feedback

Synchronous file downloads use the completed browser download as their success signal. Do not display an immediate “generated successfully” message before generation or delivery.

### 13.2 Form validation

Use:

- Field-specific inline errors
- One form-level error summary
- Links from summary entries to fields
- Focus on the summary or first invalid field
- Preserved safe input
- No success notification on invalid submission

### 13.3 Business alerts

Preserve alerts as concise, computed, informational conditions.

Do not add:

- Acknowledgement
- Assignment
- Ownership
- Manual closure
- Resolution states
- Persistence tables
- Alert-specific audit events

Operation messages must never appear in the business-alert list.

### 13.4 Technical errors

Use persistent page or component states.

Never expose:

- SQL
- Database driver text
- Filesystem paths
- Stack traces
- Raw internal codes when a user-facing label exists

Log structured, redacted context separately.

## 14. Shared formatting and French content

Add:

```text
custom/mjlfinancement/lib/mjl_format.lib.php
```

Centralize display formatting for:

- XOF money shown as `F CFA`
- Dates
- Times
- Percentages
- Counts
- Decimal values
- Negative values
- Empty values

Required money examples:

```text
1 657 000 F CFA
250 000 F CFA
0 F CFA
-75 000 F CFA
```

Formatting is display-only.

Do not alter:

- Stored values
- Database types
- Financial calculations
- API or POST values
- ISO date input values
- Filter query values
- Internal XOF identifiers
- Programmatic status codes
- Export field keys

Preserve current zero-decimal XOF display unless a report definition explicitly requires another precision.

Correct French and accents only on migrated user-facing surfaces. Do not perform blind repository-wide replacement.

Do not use the em dash character.

## 15. Reports and exports

Maintain four explicit data representations:

1. Raw typed query rows
2. HTML display rows
3. CSV contract rows
4. Typed XLSX rows

### 15.1 HTML

- Display money with the shared `F CFA` formatter.
- Add `(F CFA)` to user-facing money headings.
- Preserve report formulas and row meanings.

### 15.2 CSV

- Preserve current French headers.
- Preserve field keys, columns, order, filenames, BOM, semicolon delimiter, filters, and numeric magnitudes.
- Apply only the approved spreadsheet-formula neutralization to textual cells.
- Do not append `F CFA` to every amount cell.
- Do not change current CSV headers to add `(F CFA)`.

### 15.3 XLSX

- Add `(F CFA)` to money headings.
- Keep money cells numeric using declared `money_fields`.
- Use explicit text types for non-money fields.
- Preserve dates on their current contract.
- Preserve field keys, order, filenames, MIME type, filters, and formulas.

### 15.4 Export feedback and audit

- Keep export submission POST-only.
- Preserve token and permission checks.
- Generate the file before auditing.
- Fail closed when audit persistence fails.
- Do not claim asynchronous progress because the current export is synchronous.
- Do not show a success toast before download completion.

## 16. Implementation workstreams

### Workstream 3D.1: Navigation, shell, and headers

Include:

- Canonical registry
- Closed access-policy mapping
- Exact path matching
- Non-clickable categories
- Duplicate-link removal
- Sidebar desktop geometry
- Responsive drawer
- Page-header API
- Removal of dashboard quick-link duplication

Likely files:

```text
custom/mjlfinancement/lib/mjl_navigation.lib.php
custom/mjlfinancement/lib/mjl_dashboard.lib.php
custom/mjlfinancement/lib/mjl_ui.lib.php
custom/mjlfinancement/css/mjl_app.css.php
custom/mjlfinancement/js/mjl_components.js
```

Migrate all current shell callers:

```text
custom/mjlfinancement/index.php
custom/mjlfinancement/partners.php
custom/mjlfinancement/projects.php
custom/mjlfinancement/activities.php
custom/mjlfinancement/expenses.php
custom/mjlfinancement/documents.php
custom/mjlfinancement/conventions.php
custom/mjlfinancement/budgetlines.php
custom/mjlfinancement/fundreceipts.php
custom/mjlfinancement/alerts.php
custom/mjlfinancement/dpafdashboard.php
custom/mjlfinancement/validations.php
custom/mjlfinancement/workflowactions.php
custom/mjlfinancement/exchangelogs.php
custom/mjlfinancement/reports.php
custom/mjlfinancement/admin/access.php
custom/mjlfinancement/roadmap.php
custom/mjlfinancement/nativeforbidden.php
```

### Workstream 3D.2: Operational interactions

Include:

- Pagination consolidation
- Filter and shared-state presentation
- Per-table responsive treatment
- Conditional secondary action menus
- Dedicated create/edit states
- Guarded workflow action states
- Recovery-aware redirects
- Unsaved-change and duplicate-submit behavior

Likely files:

```text
custom/mjlfinancement/lib/mjl_table.lib.php
custom/mjlfinancement/lib/mjl_form.lib.php
custom/mjlfinancement/lib/mjl_journey.lib.php
custom/mjlfinancement/js/mjl_components.js
custom/mjlfinancement/css/mjl_app.css.php
custom/mjlfinancement/projects.php
custom/mjlfinancement/activities.php
custom/mjlfinancement/expenses.php
custom/mjlfinancement/conventions.php
custom/mjlfinancement/budgetlines.php
custom/mjlfinancement/fundreceipts.php
```

Update the existing recovery helpers rather than creating a second recovery system.

### Workstream 3D.3: Presentation and content

Include:

- Single operation-feedback adapter
- Shared states
- Shared formatting
- Status consolidation
- Alert presentation
- Professional French
- Raw/display/CSV/XLSX separation

Likely files:

```text
custom/mjlfinancement/lib/mjl_ui.lib.php
custom/mjlfinancement/lib/mjl_format.lib.php
custom/mjlfinancement/lib/mjl_timeline_presentation.lib.php
custom/mjlfinancement/lib/mjl_alerts.lib.php
custom/mjlfinancement/lib/mjl_dashboard.lib.php
custom/mjlfinancement/lib/mjl_csv_export.lib.php
custom/mjlfinancement/lib/mjl_xlsx_export.lib.php
custom/mjlfinancement/reports.php
```

### Workstream 3D.4: Journey convergence

Apply the stabilized shared patterns to:

- Partenaires / Programmes
- Projects
- Activities
- Expenses
- Expense validation
- Final validation
- Disbursement
- Supporting documents
- Envelopes
- Budget lines
- Fund receipts
- Dashboards
- Alerts
- Validation history
- Workflow audit
- Generic reports

Do not migrate route by route before stabilizing the shared foundation and its first representative journey.

## 17. Journey validation by workstream

### 17.1 Prerequisite security journeys

Validate:

- Single-partner verifier and final-validator isolation
- Admin active-entity-wide visibility
- Validation-history row scope
- Workflow-audit row and filter-option scope
- Convention and fund-receipt document IDOR rejection
- No audit event on denied download
- Fail-closed export/download audit persistence
- CSV formula neutralization
- Numeric XLSX money cells

### 17.2 Navigation and shell journeys

Validate every production role:

- Visible leaves match existing route access
- Hidden leaves do not grant or remove backend rights
- Relative order is stable
- Empty categories disappear
- Leaf links have no chevrons or submenu
- No duplicate canonical href exists
- Query parameters do not alter active state
- `exchangelogs.php` activates audit context
- Non-admin `partners.php` has no false active leaf
- `nativeforbidden.php` has no false active leaf
- Drawer works with keyboard, touch, Escape, outside click, resize, and focus restoration
- No-JavaScript navigation remains usable
- No shared-shell horizontal overflow occurs at target widths and zoom

### 17.3 Project and activity journeys

Validate:

- Authorized project creation from the primary action
- Unauthorized create action absent
- Unauthorized direct GET create/edit denied
- Unauthorized direct POST denied
- Invalid submission preserves safe values and shows no success
- Successful creation shows one concise result
- Project detail and navigation remain correct
- Activity creation/edit uses dedicated guarded states
- Activity status and next action remain accurate
- No-self, wrong-role, stale-state, and cross-scope activity actions fail closed
- Contextual comments remain attached to the correct object

### 17.4 Expense and document journeys

Validate:

- Expense creation/edit recovery
- Supporting-document requirements
- Guarded contextual upload
- Inline and summary validation feedback
- No false success
- Separate prevalidation, final validation, and disbursement states
- Main workflow action remains visible
- Secondary actions are not invented
- Wrong-role, self-action, stale-status, cross-scope, missing-evidence, and no-JavaScript direct POST attempts fail closed
- Guarded document downloads preserve scope and audit rules

### 17.5 Financing journeys

Validate:

- Envelopes, budget lines, and fund receipts use dedicated create/edit states
- Existing structural-lock and status rules remain unchanged
- Contextual partner/programme information does not grant admin modification
- Financial calculations remain unchanged
- Money displays as `F CFA`
- Negative and zero values remain accurate
- Contextual documents remain guarded

### 17.6 Dashboard and alerts journeys

Validate:

- Role-relevant dashboard content remains available
- Existing KPI formulas and scope remain unchanged
- Partial query failure preserves unaffected content
- Business alerts remain concise, computed, and scope-aware
- Alerts disappear when their underlying condition changes
- Operation notifications never enter the business-alert list

### 17.7 Reports and exports journeys

Validate every report definition:

- Existing permission, filter, and required-filter guards
- Stable CSV field keys, headers, order, BOM, delimiter, and filenames
- Formula-neutralized text
- Numeric money preservation
- XLSX money headings containing `(F CFA)`
- XLSX numeric amount cells
- Existing date/status representation
- No audit event when generation fails
- No delivery when audit persistence fails
- Exactly one audit event after successful generation
- No premature success notification

### 17.8 Failure and recovery journeys

Validate:

- Invalid action/id combinations
- Database failure
- Partial completion
- Recovery-handle replay
- Recovery under another user, entity, route, object, or action
- JavaScript disabled
- Keyboard-only use
- Focus after invalid submission
- Unsaved-change warning only on substantive dirty forms
- Duplicate submission prevention

## 18. Test isolation

Existing E2E and smoke tests can mutate:

- Users
- Groups and rights
- Fixture data
- Audit history
- Database records
- Document files

Do not run bootstrap, seed, full E2E, or mutating smoke scripts against the shared persistent workspace.

Before test execution:

1. Create a temporary directory outside the repository.
2. Create a temporary Compose override there.
3. Use unique MariaDB and document bind directories.
4. Allocate a free host port.
5. Override `DOLI_URL_ROOT` to the isolated URL.
6. Set a unique `COMPOSE_PROJECT_NAME`.
7. Set `COMPOSE_FILE` so child `docker compose` commands inherit the disposable project.
8. Set `MJL_BASE_URL` to the isolated instance.
9. Confirm the database and document paths do not resolve to the shared workspace.
10. Bootstrap and seed only the disposable environment.

Classify each selected smoke script before execution:

- Read-only
- Transaction rollback
- Self-cleaning
- Residue-producing

Run residue-producing scripts only in the disposable environment.

On teardown:

- Target only the exact disposable Compose project.
- Remove only its verified temporary database and document directories.
- Preserve the shared repository data and running services.
- Record setup and teardown commands.

## 19. Validation sequence

For each workstream:

1. Run PHP syntax checks on changed PHP files.
2. Run `git diff --check`.
3. Run targeted journey tests.
4. Inspect failure artifacts.
5. Re-run the targeted journey after correction.
6. Run the wider affected suite at the workstream integration gate.
7. Record exact commands and results.

At final integration, run the full relevant E2E suite only in the disposable environment.

Also run applicable audits and smoke scripts from `docs/mjl-acceptance-tests.md`, subject to side-effect classification.

Do not describe historical results as newly executed.

## 20. Accessibility decision

Automated validation must cover:

- Semantic headings
- Labels and descriptions
- Error identification
- Live-region behavior
- Status meaning beyond color
- Keyboard navigation
- Drawer focus containment and restoration
- Menu focus restoration
- Escape behavior
- Dialog removal or compliant remaining dialogs
- Responsive reflow
- Touch targets
- Reduced motion
- 100% and 200% zoom automation where supported

Manual User/QA sign-off is not required to issue:

```text
MJL_V2_PHASE_3D_COMPLETE_WITH_NOTES
```

If the existing manual matrix remains unsigned:

- Record it explicitly as a release blocker
- Do not claim WCAG conformance
- Do not use the unqualified complete verdict
- Keep the evidence template current

## 21. Explicit exclusions

Do not:

- Start Phase 4 or Phase 5
- Add roles
- Change the current permission matrix during Phase 3D
- Add or merge business statuses
- Change workflow meanings
- Change financial formulas
- Change database meanings
- Add schema migrations
- Add public registration
- Add global document upload
- Add document preview or removal
- Add alert persistence or lifecycle
- Add bulk mutations
- Add a dedicated audit role or overlay
- Create new routes to satisfy navigation
- Modify Dolibarr core
- Install dependencies
- Introduce a SPA or frontend framework
- Change production configuration
- Modify secrets or environment files
- Perform production data cleanup
- Modify the approved v2 snapshot
- Reintroduce deleted historical documentation
- Perform unrelated refactoring

## 22. Rollback boundaries

Prerequisite corrections are outside the Phase 3D rollback boundary and must remain after any Phase 3D rollback.

Recommended source checkpoints:

1. Prerequisite scope, download, audit, and spreadsheet security
2. Phase 3D navigation, shell, and headers
3. Phase 3D lists, forms, action states, menus, and shared states
4. Phase 3D feedback, formatting, status, alerts, and exports
5. Phase 3D journey convergence, integration tests, and documentation

Rules:

- Establish the Phase 3D baseline only after checkpoint 1 is committed.
- Each Phase 3D checkpoint must be internally deployable.
- Ship a shared helper with its first adopter and tests.
- Do not leave duplicate old and new renderers active at a checkpoint.
- Roll back Phase 3D strictly in reverse order.
- Do not roll back prerequisite security corrections with presentation changes.
- No Phase 3D database rollback should be necessary.
- Disposable test data is destroyed with the isolated environment, not cleaned from the shared workspace.

## 23. Documentation outputs

Prerequisite stage:

```text
docs/implementation/mjl-phase-3d-prerequisite-security-report.md
```

Phase 3D:

```text
docs/implementation/mjl-design-system-v2-phase-3d-plan.md
docs/implementation/mjl-design-system-v2-phase-3d-report.md
docs/mjl-docs-index.md
```

Update only when current-state evidence materially changes:

```text
docs/mjl-current-app-functional-map.md
docs/mjl-current-vs-target-gap-analysis.md
docs/mjl-acceptance-tests.md
```

The Phase 3D report must include:

- Baseline branch and commit
- Prompt and prerequisite commit evidence
- Working-tree state
- Phase 3C gate result
- Prerequisite security result
- Focused delta-review summary
- Files changed
- Helpers created, preserved, consolidated, and removed
- Navigation and route mapping
- Redundant links removed
- Shell and header changes
- Table and form changes
- Feedback and alert changes
- Formatting and French changes
- Export changes and allowed deltas
- Responsive and accessibility changes
- Protected behavior confirmation
- Tests added, reused, modified, and removed
- Isolated environment setup
- Exact commands and results
- Known limitations
- Manual accessibility status
- Remaining release blockers
- Working-tree state at handoff
- Confirmation that the approved snapshot was unchanged
- Confirmation that Phase 4 and Phase 5 did not begin

## 24. Completion criteria

Phase 3D may use `MJL_V2_PHASE_3D_COMPLETE_WITH_NOTES` only when:

- The prompt and prerequisite changes are committed
- All verified scope and document IDOR defects are corrected
- Export and download audit persistence fails closed
- Spreadsheet formula neutralization is tested
- Phase 3D has its own baseline and rollback boundary
- Navigation comes from one authoritative registry
- Categories are non-clickable
- Redundant parent/child links are removed
- Active state uses exact centralized path matching
- Permission filtering preserves order
- The sidebar meets desktop and drawer requirements
- No-JavaScript navigation remains usable
- Page headers are consistent
- Substantive create/edit forms are separated
- Guarded presentation states do not expose scoped form data
- Central workflow actions remain visible
- Secondary menus are used only when applicable
- Shared pagination and states are consolidated
- Operation feedback is not duplicated
- Technical errors remain persistent and safe
- Business alerts remain computed
- User-facing money displays as `F CFA`
- CSV headers remain stable
- XLSX headings use `F CFA` and money cells are numeric
- Existing statuses, workflows, financial meanings, routes, and permissions remain unchanged
- Journey tests pass in the disposable environment
- Automated responsive, keyboard, focus, and zoom checks pass
- Unsigned manual accessibility evidence is recorded as a release blocker
- The approved v2 snapshot remains unchanged
- Phase 4 and Phase 5 remain untouched

Use `MJL_V2_PHASE_3D_COMPLETE` only if the manual accessibility matrix is also completed and signed and no Phase 3D limitation remains.

## 25. Final response

Return:

- Verdict
- Baseline and final commit or working-tree state
- Prerequisite security result
- Main files changed
- Shared foundations created or consolidated
- Journeys validated
- Exact tests and results
- Accessibility evidence status
- Known limitations
- Documentation created or updated
- Confirmation that the approved snapshot was unchanged
- Confirmation that Phase 4 and Phase 5 did not begin
- One recommended next action

Use exactly one implementation verdict:

```text
MJL_V2_PHASE_3D_COMPLETE
MJL_V2_PHASE_3D_COMPLETE_WITH_NOTES
MJL_V2_PHASE_3D_BLOCKED
MJL_V2_PHASE_3D_FAILED
```

The recommended next action must be exactly one of:

```text
Review and approve Phase 3D
Correct Phase 3D blockers
Authorize Phase 4
```

Do not begin the recommended action automatically.
