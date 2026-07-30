# MJL Financement v2 Phase 3D Implementation Prompt

## Phase 3D: UX/UI convergence and professional application experience

Work only inside the current `mjl-dolibarr-poc` repository.

This is an implementation task for Phase 3D only.

Do not start Phase 4 or Phase 5.

Do not modify the immutable approved design snapshot under:

```text
docs/design-system/approved/v2/
```

The approved v2 design and the confirmed Phase 3D directives in this prompt are authoritative for:

- Visual presentation
- Interaction patterns
- Layout
- Navigation presentation
- Shared component behaviour
- User-facing formatting
- User-facing French content
- Responsive presentation
- Accessibility behaviour of changed components

Legacy UI values and page-specific patterns must not be retained merely because they already exist.

However, the approved design and this prompt must not redefine protected business behaviour, routes, permissions, workflows, statuses, financial meanings, database contracts, document rules, or export contracts.

# 1. Context

The design-system v2 implementation was split as follows:

- Phase 3A: Partenaire/Projet to activity lifecycle
- Phase 3B: Expense validation/disbursement to supporting documents
- Phase 3C: Financing to dashboards/alerts to generic report integration
- Phase 3D: UX/UI convergence and professional application experience

Phase 2 was committed before Phase 3.

Phase 3 work is also committed through its completed implementation boundaries.

Phase 3D must have its own clear implementation and rollback boundary.

Phase 3D exists to consolidate the UI and UX produced by Phases 3A, 3B, and 3C into one coherent, professional MJL application experience.

This is not a new product-design phase and not a business-rule redesign.

# 2. Mandatory completion gate

Do not begin Phase 3D implementation until Phase 3C is complete.

Before changing code, verify all of the following:

- Phase 3C implementation is complete
- Phase 3C has a committed baseline
- Financing journeys are implemented
- Dashboard journeys are implemented
- Alert presentation is implemented
- Generic report integration is implemented
- Targeted Phase 3C validation has passed or current limitations are documented
- No critical Phase 3C regression remains unresolved
- Phase 4 has not started

Run and record:

```bash
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --porcelain=v1
git log --oneline --decorate -n 25
git diff --name-only
git diff --cached --name-only
git ls-files --others --exclude-standard
```

Inspect Phase 3A, Phase 3B, and Phase 3C reports, plans, screenshots, tests, and implementation files when present.

If Phase 3C is not complete or not committed, do not begin implementation.

Create only:

```text
docs/implementation/mjl-design-system-v2-phase-3d-blocked.md
```

Include:

- Failed completion gate
- Current branch and commit
- Current working-tree state
- Missing Phase 3C evidence
- Required corrective action
- Confirmation that Phase 3D did not begin

Use verdict:

```text
MJL_V2_PHASE_3D_BLOCKED
```

Then stop.

# 3. Required reading

Read applicable repository instructions first, including when present:

- `AGENTS.md`
- `CODEX.md`
- Main `README.md`
- `docs/mjl-docs-index.md`
- Active architecture documentation
- Active navigation documentation
- Active permissions documentation
- Active workflow documentation
- Active testing-strategy documentation
- Phase 3A implementation plan and report
- Phase 3B implementation plan and report
- Phase 3C implementation plan and report
- Current design-system implementation reports
- Current UI target specifications
- Current client-validation and production-readiness reports

Read the active design entry points:

- `docs/design-system/README.md`
- `docs/design-system/approved/v2/PRODUCT.md`
- `docs/design-system/approved/v2/DESIGN.md`
- `docs/design-system/approved/v2/design-manifest.yaml`
- `docs/design-system/approved/v2/MANUAL-REVIEW.md`
- `docs/design-system/approved/v2/docs/design/design-brief.md`
- `docs/design-system/approved/v2/docs/design/product-model.md`
- `docs/design-system/approved/v2/docs/design/interaction-flows.md`
- `docs/design-system/approved/v2/docs/design/design-decisions.md`
- `docs/design-system/approved/v2/docs/design/design-assumptions.md`
- `docs/design-system/approved/v2/docs/design/component-inventory.md`
- `docs/design-system/approved/v2/docs/design/implementation-plan.md`
- `docs/design-system/approved/v2/design-tokens/tokens.json`
- `docs/design-system/approved/v2/design-tokens/semantic-tokens.json`

Do not modify anything under `docs/design-system/approved/v2/`.

# 4. Focused delta review before implementation

Do not repeat the full v2 implementation-readiness audit.

Perform a focused delta review of the implementation created by Phases 3A, 3B, and 3C.

Inspect:

- Shared application shell
- Sidebar implementation
- Navigation registry or navigation helper
- Active-route logic
- Workspace header
- Page headers
- Lists and tables
- Forms
- Dialogs
- Row actions
- Status presentation
- Toasts, banners, alerts, and error messages
- Currency formatting
- Date and number formatting
- User-facing French content
- Loading, empty, error, success, and permission states
- Responsive behaviour
- Keyboard and focus behaviour
- Shared CSS and JavaScript
- Page-specific duplication
- Existing feature-journey tests

Identify:

- Existing v2 patterns to preserve
- Existing helpers to consolidate
- Legacy patterns to replace
- Duplicate patterns to remove
- Missing shared states to create
- Current behaviour that must remain protected

Prefer consolidation of existing helpers over unnecessary new abstractions.

Create or update:

```text
docs/implementation/mjl-design-system-v2-phase-3d-plan.md
```

The plan must contain:

- Baseline commit
- Working-tree state
- Phase 3A to Phase 3C implementation summary
- Current shared UI foundations
- Phase 3D scope
- Files likely to change
- Protected behaviour
- Main risks
- Test journeys
- Rollback approach
- Explicit exclusions

Do not spend the task producing another broad audit when current evidence is sufficient to implement.

# 5. Authority order

When evidence conflicts, use this order:

1. Explicit user decisions in this prompt
2. Approved v2 design decisions
3. Confirmed active MJL business requirements
4. Protected routes, permissions, workflows, data meanings, and export contracts
5. Current committed Phase 3 implementation
6. Current relevant journey tests
7. Active project documentation
8. Historical documentation
9. General design preferences

Do not let visual preferences redefine authorization or business logic.

# 6. Protected invariants

Preserve all confirmed invariants, including:

- MJL remains a custom Dolibarr module
- Dolibarr core must not be modified
- Native Dolibarr UI remains hidden from the MJL workspace
- The MJL application shell remains consistent
- Project creation remains limited to authorized roles
- `Historique des validations` remains the approved terminology
- `Partenaires / Programmes` terminology remains preserved
- `Validé définitivement` and `Décaissé` remain separate concepts
- Global documents remain read-only when confirmed
- Document uploads remain contextual when confirmed
- Reports remain Excel/XLSX-first when confirmed
- Routes remain protected
- Permissions remain protected
- Workflow meanings remain protected
- Database-field meanings remain protected
- Export contracts remain protected
- Existing tested business behaviour remains protected
- Unresolved permissions must not be invented

Do not change backend authorization policy.

Do not use hidden buttons as a replacement for backend security.

# 7. Phase 3D objectives

Phase 3D must produce a coherent, professional application experience across all journeys completed in Phases 3A, 3B, and 3C.

The implementation must:

1. Standardize the sidebar and navigation model
2. Standardize the workspace shell and page-header hierarchy
3. Standardize list, table, and action-menu behaviour
4. Separate substantive create/edit forms from operational lists
5. Standardize concise operation notifications
6. Preserve concise computed business alerts
7. Standardize currency, date, number, and percentage formatting
8. Correct user-facing French and accents
9. Standardize loading, empty, error, success, and permission states
10. Improve responsive and keyboard behaviour for changed components
11. Remove legacy and duplicated UI patterns replaced by the shared system
12. Validate full user journeys without creating test noise

# 8. Sidebar and navigation

## 8.1 Layout

The sidebar must:

- Be attached to the left edge of the viewport
- Have no external left margin
- Use the full available application height
- Use a stable desktop width
- Remain visually distinct from the main workspace
- Follow approved v2 tokens and visual rules
- Avoid a floating-card appearance
- Avoid unnecessary outer radius around the complete sidebar
- Keep the user/account area stable when present
- Become an accessible overlay drawer on smaller screens

Do not copy the reference screenshot visually. Use it only as structural inspiration.

MJL colours, typography, tokens, identity, and approved design rules remain authoritative.

## 8.2 Navigation registry

Establish one authoritative navigation registry or consolidate the current shared helper into one authoritative source.

Each destination must define, directly or through an equivalent structure:

- Stable item identifier
- Stable category identifier
- User-facing label
- Canonical route
- Optional child routes
- Display order
- Permission requirement
- Active-route matcher
- Icon when appropriate

Do not generate a different navigation structure independently on each page.

## 8.3 Categories

Use business-oriented categories.

Use the following target structure when matching routes exist:

```text
PILOTAGE
- Tableau de bord
- Alertes

EXÉCUTION DES PROJETS
- Projets
- Activités
- Dépenses / Décaissements
- Documents

FINANCEMENT
- Enveloppes de financement
- Fonds reçus
- Conventions

CONTRÔLE ET RAPPORTS
- Historique des validations
- Rapports

ADMINISTRATION
- Partenaires / Programmes
- Utilisateurs et accès
- Paramètres
```

Do not create new routes merely to satisfy this structure.

Adapt the structure to existing confirmed destinations while preserving the category intent.

Hide empty categories after permission filtering.

Permission filtering must not change the relative order of remaining items.

## 8.4 Leaf-link and submenu rules

Mandatory rules:

- A main link without genuine child destinations renders as one direct link
- A direct link must not display a chevron
- A direct link must not render an empty submenu container
- When a main link and its only child point to the same canonical page, remove the child
- Do not display patterns such as `Projets > Projets`
- A submenu is allowed only when it contains distinct, useful destinations
- A category heading is not automatically a clickable route
- A clickable parent with children is allowed only when its destination is meaningfully different from every child destination
- Every destination belongs to exactly one navigation entry
- Query parameters must not activate an unrelated navigation item
- Workflow-action pages must remain associated with their correct business area
- Only one destination may be active at a time
- Only the group containing the active child should expand automatically
- Navigation expansion must not cause visible layout jumping

## 8.5 `Partenaires / Programmes`

Apply this confirmed rule:

- Creation, modification, activation, deactivation, and configuration remain under `Administration`
- Business users consult partner/programme information contextually through projects, financing, filters, details, and reports
- Do not duplicate a dedicated `Partenaires / Programmes` destination under `Financement`
- Contextual consultation must not grant administrative modification rights

# 9. Workspace header and page hierarchy

Standardize the shared `mjl-workspace-header` and related page-header patterns.

Requirements:

- Add deliberate top spacing through the shared workspace layout
- Do not apply a repeated page-specific top margin when the layout can own it
- Remove unnecessary enclosing borders or card treatment around page headers
- Use whitespace and typography for hierarchy
- Avoid isolating the header from the page content without a functional reason
- Avoid repeating the same title in the global header and page header
- Keep breadcrumb use contextual and minimal
- Align primary actions consistently
- Place secondary actions consistently
- Use a subtle divider only when needed, such as for sticky behaviour

Recommended hierarchy:

```text
Optional breadcrumb or context
Page title                         Primary action
Short useful description          Secondary actions or overflow
```

Do not add decorative descriptions that repeat the title.

# 10. Lists, tables, and row actions

Standardize operational lists and tables.

Cover:

- Search
- Filters
- Sorting
- Pagination
- Column hierarchy
- Status display
- Horizontal scrolling
- Empty state
- No-results state
- Error state
- Loading state
- Permission-limited state
- Row actions
- Export access

## 10.1 Row actions

When actions apply to a record, display a three-dot overflow menu for secondary and contextual actions.

Rules:

- The record title or explicit consultation action opens the detail page
- Do not make the complete row clickable when it contains interactive controls
- Keep the page primary action visible
- Keep a central workflow action visible when it is the main purpose of the page
- Use the three-dot menu for secondary actions
- Do not hide every action inside the overflow menu
- Do not render an empty overflow menu
- Do not render the three-dot button when no action applies
- Order menu actions consistently
- Separate destructive actions visually
- Require confirmation for destructive actions
- Restore focus after the menu closes
- Support keyboard navigation
- Support Escape and outside click
- Keep menus inside the visible viewport
- Filter actions according to the same confirmed authorization rules used by the backend

Do not introduce bulk actions unless a real operational need already exists.

# 11. Forms and dialogs

Substantive create and edit forms must not remain inline inside operational lists.

Use a modal only when the operation is:

- Short
- Low risk
- Reversible
- Approximately six fields or fewer
- Not dependent on complex document upload
- Not a multi-step workflow decision
- Better completed without losing list context

Use a dedicated page when the operation includes:

- Projects
- Activities with meaningful detail
- Expenses
- Disbursements
- Financing
- Conventions
- Partner/programme administration
- Supporting documents
- Financial values
- Multiple sections
- Complex validation
- Workflow decisions
- Review or confirmation
- Destructive impact

Allowed inline controls are limited to:

- Search
- Filters
- Sorting
- Pagination
- Small reversible settings
- Short comments when the confirmed workflow requires contextual entry
- Quick confirmation controls when already supported by the workflow

Every changed form must support:

- Clear labels
- Required-field communication
- Logical grouping
- Professional help text only when useful
- Inline errors
- Form-level error summary
- Stable action placement
- Explicit cancel action
- Duplicate-submission prevention
- Unsaved-change protection when loss is significant
- Keyboard use
- Focus placement after validation failure
- Responsive layout

Do not introduce draft or save-and-resume behaviour unless current product rules already support it.

# 12. Notifications and business alerts

Do not use one generic mechanism for every type of feedback.

Distinguish:

1. Operation notifications
2. Form validation feedback
3. Business alerts
4. Page-level technical errors

## 12.1 Operation notifications

Operation notifications appear after an action performed by the user.

They must be concise.

Examples:

```text
Le projet « Projet XXX » a été créé avec succès.
L’activité « Activité XXX » a été mise à jour.
La dépense « DEP-2026-014 » a été soumise pour validation.
Le décaissement a été enregistré avec succès.
Le document « Convention signée.pdf » a été ajouté.
Le rapport a été généré avec succès.
```

A notification should normally communicate only:

- What happened
- Which object was affected, when useful
- Whether the operation succeeded, failed, or requires attention

Do not add unnecessary metadata, amounts, dates, project descriptions, responsibilities, or long explanatory text.

Display success only after the server confirms success.

Do not display a success notification when:

- The request failed
- Validation failed
- Only part of the operation completed
- An asynchronous process has only started

For an asynchronous operation, use concise state-specific messages:

```text
Le rapport est en cours de génération.
Le rapport a été généré avec succès.
```

For partial completion, use concise accurate wording:

```text
Le projet a été créé, mais le document n’a pas pu être ajouté.
```

## 12.2 Notification levels

Use these semantic levels:

- Success
- Information
- Warning
- Error

The visual level is primarily indicated by colour.

Use approved semantic tokens rather than page-specific colour values.

Colour must also be supported by:

- Appropriate icon
- Semantic notification type
- Accessible live-region behaviour
- Clear outcome wording

Do not add a visible heading such as `Succès` to every notification unless the component needs one for clarity.

Recommended behaviour:

- Success: dismiss automatically after approximately 4 seconds
- Information: dismiss automatically after approximately 5 seconds
- Warning: remain longer or until dismissed when attention is required
- Error: remain until dismissed or corrected
- Pause automatic dismissal while hovered or keyboard-focused

Use one feedback channel per operation.

Avoid displaying the same result simultaneously as a toast, inline banner, browser alert, redirect message, and dashboard alert.

## 12.3 Form validation feedback

Use:

- Inline field errors for field-specific issues
- A form-level error summary for failed submissions
- Focus movement to the error summary or first invalid field
- No success notification when validation fails

## 12.4 Business alerts

Business alerts are computed from operational data and appear in the alerts area or dashboard.

They are not operation confirmations.

Keep them concise.

Examples:

```text
La convention « CONV-2026-014 » arrive à échéance dans 7 jours.
Le projet « Projet XXX » ne contient aucune activité active.
La dépense « DEP-2026-014 » nécessite une pièce justificative.
```

A business alert should contain only the information required to understand the condition and open the affected object.

Do not create long explanatory cards.

Do not introduce an alert lifecycle in Phase 3D.

Do not introduce:

- Acknowledgement
- Assignment
- Ownership
- `Nouvelle`
- `Consultée`
- `Prise en charge`
- `Résolue`
- Manual closure
- Alert-specific persistence tables
- Alert-specific audit events

Business alerts remain computed and informational.

They should update or disappear when the underlying condition changes.

# 13. Currency and numeric formatting

Keep `XOF` as the internal currency code.

Display `F CFA` to users.

Use one shared formatter rather than manual page-level formatting.

Required user-facing format:

```text
1 657 000 F CFA
250 000 F CFA
0 F CFA
-75 000 F CFA
```

Apply the shared formatter to:

- Dashboards
- Lists
- Tables
- Detail pages
- Forms
- Confirmation dialogs
- Operation notifications when an amount is necessary
- Business alerts when an amount is necessary
- Emails
- Printable documents
- User-facing reports and exports when the existing export contract permits it

For Excel/XLSX:

- Use a heading such as `Montant (F CFA)`
- Keep amount cells numeric
- Do not append `F CFA` text to every cell when that would prevent calculations
- Preserve stable columns, filenames, and export contracts

Also centralize French display formatting for:

- Dates
- Times
- Percentages
- Counts
- Decimal values
- Negative values
- Empty values

Do not change stored values, database types, API values, or financial calculations.

# 14. Professional French and accents

All user-facing content changed or migrated in Phase 3D must use professional French.

Requirements:

- Correct accents
- Correct grammar
- Consistent punctuation
- Sentence case
- Consistent approved terminology
- Clear institutional tone
- No raw internal codes when a user-facing label exists
- No unnecessary technical language
- No unnecessary verbosity

Examples:

```text
Creer une activite
```

becomes:

```text
Créer une activité
```

```text
Depense validee
```

becomes:

```text
Dépense validée
```

```text
Aucune donnee trouvee
```

becomes:

```text
Aucune donnée trouvée
```

Only change user-facing text.

Do not modify:

- Route paths
- Variable names
- Database columns
- Internal status codes
- Translation keys unless their displayed value is being corrected safely
- API values
- Programmatic constants
- Contractual export identifiers
- File names used by integrations

Do not perform a blind repository-wide search and replace.

Do not create isolated tests for each accent, label, or wording correction.

Group wording improvements with the shared component or complete user journey being changed.

Do not use the em dash character in documentation, UI content, code comments, tests, or generated reports.

Use commas, colons, parentheses, or standard hyphens instead.

# 15. Shared states

Create or consolidate shared patterns for:

- Initial empty state
- Filtered no-results state
- Loading state
- Page-level error state
- Form validation state
- Permission-limited state
- Read-only state
- Success state
- Partial-completion state

Rules:

- An initial empty state should explain what is missing and offer the next authorized action
- A no-results state should preserve filters and offer a reset action
- A loading state should not appear as a blank page
- A technical error should not be hidden only in a disappearing toast
- A read-only state should be understandable without exposing unauthorized details
- A permission-limited state must not replace backend authorization
- Success feedback must not be duplicated

# 16. Status presentation

Consolidate status presentation across the application.

Keep separate concepts visually and semantically distinct:

- Business status
- Validation status
- Permission state
- System state

Do not invent new statuses.

Do not merge `Validé définitivement` and `Décaissé`.

Do not rely on colour alone.

Use:

- Approved semantic colours
- User-facing status labels
- Optional icons when useful
- Text readable by assistive technology

# 17. Responsive behaviour

Phase 3D must establish a stable responsive baseline for changed components.

Target:

- Full operational desktop support
- Strong tablet support
- Mobile consultation and essential actions
- No forced first-pass mobile parity for dense administrative tables or long financial workflows

Requirements:

- Sidebar becomes an accessible overlay drawer on smaller screens
- Tables support safe horizontal scrolling when necessary
- Primary actions remain reachable
- Action menus remain usable on touch devices
- Forms reflow without clipped labels or controls
- Dialogs remain within the viewport
- Touch targets remain usable
- Content remains usable at browser zoom
- No horizontal page overflow caused by the shared shell

Do not redesign the whole application around mobile if current requirements remain desktop-first.

# 18. Accessibility

Integrate accessibility into every changed shared component.

Cover:

- Semantic headings
- Keyboard navigation
- Visible focus
- Focus restoration
- Form-label association
- Error identification
- Live-region behaviour for notifications
- Status communication beyond colour
- Dialog focus management
- Escape behaviour
- Reflow
- Zoom
- Touch targets
- Reduced motion when animation exists

Do not claim WCAG conformance unless it is actually validated and documented.

# 19. Implementation structure

Implement Phase 3D through four coherent workstreams.

Do not create separate repository phases unless existing governance requires them.

## Workstream 3D.1: Navigation and application shell

Include:

- Canonical navigation registry
- Sidebar categories
- Leaf-link rules
- Stable active-route logic
- Permission-aware visibility
- Responsive drawer behaviour
- Workspace layout
- Workspace header
- Page-header hierarchy

## Workstream 3D.2: Operational interaction patterns

Include:

- Lists
- Tables
- Search
- Filters
- Sorting
- Pagination
- Three-dot action menus
- Detail access
- Form separation
- Modal-versus-page rules
- Confirmation dialogs
- Duplicate-submission prevention

## Workstream 3D.3: Shared presentation and content quality

Include:

- Operation notifications
- Business-alert presentation
- Shared state patterns
- Status presentation
- `F CFA` formatting
- Date, time, percentage, and number formatting
- Professional French
- Icon consistency

## Workstream 3D.4: Journey convergence and validation

Apply the shared patterns across completed Phase 3 journeys:

- Partenaires / Programmes
- Projects
- Activities
- Expenses
- Expense validation
- Disbursement
- Supporting documents
- Financing
- Fund receipts
- Conventions
- Dashboards
- Alerts
- Validation history
- Generic reports

Do not migrate page by page without first stabilizing the high-reuse shared patterns.

# 20. Technical constraints

Use the existing Dolibarr/PHP architecture.

Do not assume or introduce:

- React
- Tailwind
- shadcn/ui
- A frontend-framework migration
- A full rewrite
- A new SPA architecture

Do not modify Dolibarr core.

Prefer:

- Existing MJL shared helpers
- Consolidation of shared rendering functions
- Shared CSS tokens
- Shared JavaScript behaviour
- Incremental migration
- Backward-compatible route behaviour

Avoid:

- Page-specific copies of the same component
- New global CSS leakage
- Inline styles when shared tokens and classes are appropriate
- Hard-coded colours outside the approved token system
- Hard-coded `XOF` user-facing strings
- Repeated formatting logic
- Repeated route-matching logic
- Repeated notification markup

Do not install a dependency unless the repository cannot safely provide the required behaviour without it.

When a dependency appears necessary, stop and document the reason instead of installing it automatically.

# 21. Explicit exclusions

Phase 3D must not:

- Start Phase 4
- Start Phase 5
- Change business workflows
- Change permission rules
- Add new roles
- Add new business statuses
- Merge existing statuses
- Change financial calculations
- Change database-field meanings
- Add database migrations
- Add alert persistence
- Add alert acknowledgement or resolution workflows
- Change document access rules
- Change route authorization
- Change export contracts
- Change report formulas
- Modify Dolibarr core
- Introduce a frontend rewrite
- Perform unrelated refactoring
- Perform data cleanup
- Modify production deployment configuration
- Modify secrets or environment files
- Modify the approved v2 snapshot

# 22. Testing strategy

Use the established journey-based testing strategy.

Requirements:

- Test complete user journeys
- Prefer end-to-end or feature-level coverage
- Cover failure scenarios
- Cover permission scenarios
- Reuse existing tests when possible
- Avoid one test per function
- Avoid tests for labels alone
- Avoid tests for accents alone
- Avoid tests for icon presence alone
- Avoid tests for exact spacing or CSS declarations
- Avoid duplicate coverage
- Use targeted test selection during implementation
- Run broader suites only at integration gates
- Protect business behaviour rather than incidental markup

## 22.1 Required journey coverage

At minimum, validate these journeys when supported by the repository:

### Project creation

- Authorized user opens the project list
- User starts project creation from the page primary action
- Creation occurs on a dedicated page or approved modal
- Valid submission succeeds
- One concise success notification appears
- The new project appears in the list
- The project detail opens correctly
- The correct sidebar item remains active

### Unauthorized project creation

- Unauthorized user opens the project area
- Create action is not available
- Direct create-route access remains denied
- No project is created

### Activity lifecycle

- Authorized user opens a project
- User accesses related activities
- User creates or edits an activity through the correct form pattern
- Status and navigation remain correct
- Success or failure feedback is accurate

### Expense and supporting documents

- Authorized user creates or reviews an expense
- Supporting-document requirements remain enforced
- Validation errors appear inline and in the error summary
- No false success notification appears
- Successful submission shows one concise confirmation

### Expense validation and disbursement

- Authorized validator opens a pending expense
- Supporting documents remain accessible according to permissions
- Main workflow action remains visible when central to the page
- Secondary actions use the overflow menu
- The resulting business status remains correct
- Validation history remains correct
- `Validé définitivement` and `Décaissé` remain separate

### Financing and fund receipts

- Authorized user opens financing information
- Currency displays as `F CFA`
- Internal calculations remain unchanged
- Contextual partner/programme information is visible without administrative edit rights

### Dashboard and business alerts

- Role-relevant dashboard content remains available
- Business alerts remain concise and computed
- Alerts link to the affected object when applicable
- Operation notifications do not appear in the business-alert list

### Generic reports

- User launches report generation
- In-progress feedback is accurate when asynchronous
- Success appears only after completion
- Excel/XLSX values remain numeric
- User-facing currency headings use `F CFA`
- Existing export contracts remain stable

### Navigation

- Leaf links do not display submenus
- Duplicate parent and child links do not appear
- Only the correct group expands
- Only one item is active
- Active state remains stable across query parameters and workflow pages
- Permission filtering does not reorder remaining links
- Empty categories do not appear

### Failure handling

- Invalid submission does not display success
- Server failure displays a persistent useful error
- Partial completion displays accurate concise feedback
- User can recover without losing unnecessary work

### Responsive and keyboard behaviour

- Sidebar drawer opens and closes by keyboard
- Escape closes menus and dialogs when appropriate
- Focus returns to the trigger
- Action menus remain reachable
- Forms remain usable at smaller widths
- Tables remain consultable without breaking the complete page layout

## 22.2 Full-suite conditions

Run the full relevant suite only when:

- Shared shell changes affect nearly every page
- Navigation helpers affect all routes
- Shared form submission behaviour changes globally
- Shared authorization presentation changes broadly
- Shared formatting changes affect exports and reports
- Integration-gate validation is reached
- A targeted failure suggests wider regression

Do not run the full suite after every small implementation change.

# 23. Validation policy

Before running project scripts, inspect them for side effects.

Do not run scripts that may:

- Reset data
- Seed fixtures into persistent environments
- Delete records
- Run migrations
- Change configuration
- Restart services
- Modify generated production files
- Deploy the application

Use safe test fixtures or the existing test environment only.

At minimum, run:

```bash
git diff --check
git status --short
git diff --stat
git diff --name-only
git diff --cached --name-only
git ls-files --others --exclude-standard
```

Run focused linting, static checks, unit checks, or journey tests supported by the repository.

Record every command actually run and its result.

Do not describe historical test results as newly executed.

# 24. Rollback and commit boundary

Phase 3D must remain independently reviewable and reversible.

Do not amend or squash completed Phase 3 commits during implementation.

Group changes by coherent foundation rather than individual pages.

Recommended commit boundaries, without committing automatically unless the active repository workflow explicitly requires manual commits:

1. Navigation registry, sidebar, and workspace shell
2. Shared lists, tables, action menus, forms, and dialogs
3. Notifications, alerts, formatting, statuses, and professional French
4. Journey migration, responsive hardening, and integration validation

Do not commit, push, merge, tag, or create a release automatically.

# 25. Documentation outputs

Create or update:

```text
docs/implementation/mjl-design-system-v2-phase-3d-plan.md
docs/implementation/mjl-design-system-v2-phase-3d-report.md
docs/mjl-docs-index.md
```

Create the blocked report only when the Phase 3C completion gate fails:

```text
docs/implementation/mjl-design-system-v2-phase-3d-blocked.md
```

The implementation report must include:

- Baseline branch and commit
- Phase 3C completion-gate result
- Focused delta-review summary
- Files changed
- Shared helpers created or consolidated
- Legacy patterns removed
- Sidebar and navigation changes
- Workspace-header changes
- List and table changes
- Form changes
- Notification changes
- Business-alert changes
- Currency and formatting changes
- Professional French changes
- Responsive changes
- Accessibility changes
- Protected behaviour confirmation
- Tests added, reused, changed, and removed
- Exact commands run
- Test results
- Known limitations
- Remaining Phase 4 concerns
- Remaining Phase 5 concerns
- Working-tree state
- Confirmation that the approved v2 snapshot was not modified
- Confirmation that Phase 4 and Phase 5 did not begin

Use one verdict:

```text
MJL_V2_PHASE_3D_COMPLETE
MJL_V2_PHASE_3D_COMPLETE_WITH_NOTES
MJL_V2_PHASE_3D_BLOCKED
MJL_V2_PHASE_3D_FAILED
```

# 26. Completion criteria

Phase 3D is complete only when:

- Phase 3C completion gate passed
- The focused delta review was performed
- The sidebar is flush with the left viewport edge
- The sidebar no longer has an unnecessary global left margin
- Navigation is generated from one authoritative source
- Leaf links do not render submenus or chevrons
- Duplicate parent and child destinations are removed
- Active navigation no longer jumps between unrelated groups
- Permission filtering preserves stable order
- `Partenaires / Programmes` administration remains under `Administration`
- Business users can consult partner/programme information contextually without receiving admin rights
- Workspace headers use a consistent hierarchy and top spacing
- Unnecessary header borders or card isolation are removed
- Lists and tables use shared operational patterns
- Applicable secondary row actions use a three-dot menu
- Important primary workflow actions remain visible
- Empty action menus are not rendered
- Substantive create/edit forms are no longer inline inside operational lists
- Modal-versus-page rules are applied consistently
- Success notifications are concise and appear only after confirmed success
- Error and partial-completion notifications are accurate
- Notification level uses approved semantic colours
- Notification meaning is also available through icon, semantics, and wording
- Business alerts remain concise, computed, and informational
- No alert acknowledgement or resolution lifecycle was introduced
- User-facing currency displays as `F CFA`
- `XOF` remains internal
- Excel/XLSX amount cells remain numeric
- User-facing French is professional and accented
- No blind replacement changed technical identifiers
- Shared loading, empty, error, success, and permission states exist
- Responsive behaviour is stable for changed components
- Keyboard and focus behaviour is validated
- Protected routes, permissions, workflows, statuses, calculations, and exports remain unchanged
- Journey-level tests cover success, failure, and permission scenarios
- No wording-only or CSS-only test noise was added
- Phase 3D remains independently reviewable and reversible
- The approved v2 snapshot remains unchanged
- Phase 4 and Phase 5 were not started

# 27. Final response

At completion, return a concise execution summary containing:

- Verdict
- Baseline commit
- Main files changed
- Main shared foundations created or consolidated
- Journeys validated
- Tests run and results
- Known limitations
- Documentation created or updated
- Confirmation that Phase 4 and Phase 5 were not started
- Recommended next action

The recommended next action must be exactly one of:

- Review and approve Phase 3D
- Correct Phase 3D blockers
- Authorize Phase 4

Do not begin the recommended action automatically.
