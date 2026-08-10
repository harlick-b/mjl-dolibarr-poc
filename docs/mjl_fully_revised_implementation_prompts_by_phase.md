# MJL Fully Revised Implementation Prompts by Phase

## Status of this document

This document is the fully revised implementation package following the MJL/DPAF cadrage meeting and the subsequent decision review.

It supersedes the previous `mjl_implementation_prompts_by_phase.md` package.

All confirmed decisions in this document supersede every conflicting previous MJL assumption, specification, schema, route, permission, workflow, test and implementation choice.

The application is not live. Backward compatibility is not required unless it is explicitly reintroduced in a later approved decision.

## How to use this package

Run one phase at a time in Codex, in normal execution mode.

Do not run this entire document as one Codex request.

### Recommended workflow

1. Create a dedicated branch for the phase.
2. Start a new Codex session.
3. For Phase 0, provide the global authoritative rules and the Phase 0 prompt.
4. For Phase 1 and every later phase, instruct Codex to read the canonical v2 repository documents before planning or modifying code.
5. Codex must inspect the repository, produce a short implementation plan, then execute only the requested phase.
6. Review the phase report, migrations, tests, screenshots and known limitations.
7. Resolve blocking issues.
8. Commit the phase as a stable rollback boundary.
9. Explicitly authorize the next phase.
10. Never let Codex continue automatically to a later phase.

### Required canonical documents after Phase 0

Every phase after Phase 0 must begin by reading and treating these files as authoritative:

```text
docs/mjl-functional-specification-v2.md
docs/mjl-decision-register-v2.md
docs/mjl-scope-boundary-v2.md
docs/mjl-permission-matrix-v2.md
docs/mjl-status-and-transition-model-v2.md
docs/mjl-data-dictionary-v2.md
docs/mjl-reset-manifest-v2.md
docs/mjl-implementation-roadmap-v2.md
```

If any required canonical file is missing, contradictory or not approved, Codex must stop and report the problem.

### Production boundary

Phase 3C is a core-scope readiness checkpoint only.

It does not authorize production launch.

Actual go-live must wait until the client and project owner explicitly confirm which of the following are mandatory before production:

- Phase 4: Document management
- Phase 5: Accounting entries
- Phase 6: Official Partner financial reports

No phase verdict may silently redefine the final go-live scope.

---

# Global Authoritative Rules

These rules apply to every implementation phase.

## 1. Business context and application boundary

The client is MJL/DPAF.

The broader manual process includes planning, implementation, accounting treatment, supporting documents, accounting entries, accountability and official Partner financial reporting.

The current core application scope begins only when an Activity has already been agreed with the Partner.

The current core scope includes:

- Partner and Project reference data
- Activity planning
- Operation planning
- Activity prevalidation and definitive validation
- Correction and resubmission cycles
- Assignment of Agents de saisie
- Execution monitoring
- Authorized and spent amount monitoring
- Activity and Operation lifecycle
- Human-readable audit history
- Dashboards
- Operational PDF and Excel exports
- Preparation for later document, accounting and official report modules

The current core scope does not implement:

- PTA proposal or negotiation
- Partner approval of the PTA
- Fund requests
- Receipt of funds
- TDR approval
- Partner authorization messages
- e-Trésor payment processing
- Bank reconciliation
- External audit execution

Do not remove document-management extension points. Document management is deferred, not abandoned.

Accounting entries must be planned architecturally but implemented only after the client provides authoritative accounting rules and examples.

Official UNICEF and Coopération Suisse financial reports must be planned architecturally but implemented only after the core scope and approved report templates are available.

## 2. Product reset

- The application is not live.
- Backward compatibility is not required.
- Do not preserve obsolete business logic merely because it already exists.
- Do not add compatibility adapters unless explicitly approved.
- Prefer clean authoritative data structures.
- Prefer a clean database reset or destructive migration when it is safer and is approved through the reset manifest.
- Do not execute destructive repository or database changes during Phase 0.
- Mark conflicting documentation as superseded.
- Do not reintroduce legacy concepts from older MJL phases.
- Existing legacy sample data is based on obsolete business rules and must not be treated as authoritative. Its replacement with a new deterministic QA dataset will be specified after the MJL Fully Revised Implementation Prompts by Phase is finalized. Do not design or implement the replacement QA dataset yet.
- **SAFETY RULE:** Until the new QA dataset is defined, existing legacy sample data must not be used to infer, validate or justify current business rules.
- **CONFIRMED CLEAN-RESET DECISION (2026-08-10):** Delete all existing local sample data without migrating users, role assignments, Partners, Projects, Activities, finance records, logs, or documents. Preserve exactly one native technical administrator account.
- **CONFIRMED DATASET DECISION (2026-08-10):** Keep persistent sample/demo data absent through every implementation phase. A new persistent dataset may be specified only after all phases are complete. Tests may create minimal disposable fixtures only inside isolated tenants and must destroy them with the tenant.
- Any later instruction in this prompt package to migrate existing POC data, create an initial/core persistent seed, or build phase-owned persistent fixtures is superseded by these confirmed decisions.

## 3. Authoritative hierarchy

```text
Partenaire
    -> Projet
        -> Activité
            -> Opérations
```

The database must support:

```text
1 Partenaire -> plusieurs Projets
```

The current initial production data happens to contain one Project per Partner. This is not a permanent one-to-one rule.

Initial records:

- Partenaire: UNICEF
  - Projet: UNICEF
- Partenaire: Coopération Suisse
  - Projet: Programme Redevabilité

The user-facing term is `Projet`.

Do not use `Programme` as the generic application entity name.

## 4. Roles and role exclusivity

Each user can have exactly one active role:

- Agent de saisie
- Agent superviseur et prévalidateur
- Validateur définitif
- Admin

Role combinations are prohibited.

The Validateur définitif is the business superuser.

The Admin is a technical and audit role only.

### Admin may

- Invite users
- Assign or change one role
- Activate or deactivate accounts
- Access technical administration
- Access complete audit history
- Export audit information
- Perform controlled technical recovery actions

### Admin may not

- Create business validation decisions
- Prevalidate an Activity
- Definitively validate an Activity
- Return an Activity for business correction
- Revise a business budget
- Manage Partner or Project business content
- Modify Agent-entered execution data
- Approve business cancellation or reopening requests

### Validateur définitif may

- View all Activities
- Create and edit Partners
- Create and edit Projects
- Manage Operation type reference data
- Manage Activity Agent assignments
- Review Activities after prevalidation
- Definitively validate
- Return an Activity for correction
- Request a revised authorized amount through the correction workflow
- Approve or reject Activity and Operation cancellation requests
- Approve or reject completed Operation reopening requests
- Access complete audit history
- Export audit history

## 5. Role changes

A role change must never leave a user with two active roles.

Before changing an Agent de saisie to another role:

- Remove or transfer every current Activity assignment
- Reject the role change while active assignments remain
- Preserve historical assignments
- Preserve historical role records
- Invalidate or refresh active sessions
- Re-evaluate authorization immediately

A role change does not remove identity-based separation-of-duties restrictions for revisions that the user previously created or modified.

## 6. Visibility and assignments

### Agent de saisie

An Agent de saisie can view only Activities to which they are currently assigned.

An Activity has:

- One creator
- One primary assigned Agent
- Optional additional assigned Agents

At creation:

- The creator becomes the primary assigned Agent automatically.
- The creator does not select themselves.
- The primary Agent is coordination and display metadata only.

Every currently assigned Agent de saisie may:

- Edit an Activity while it is in an authorized editable state
- Apply requested corrections
- Submit or resubmit the Activity
- Update Operation execution data after validation

All changes are attributed to the actual actor.

Only the Validateur définitif may:

- Add an Agent
- Remove an Agent
- Transfer the primary assignment
- Change the primary Agent

When an Agent is removed:

- Read access ends immediately
- Edit access ends immediately
- Direct URL access must fail
- An already open form must fail safely on save
- Historical assignments and actions remain visible in audit

### Superviseur

The Agent superviseur et prévalidateur can view all Activities.

The Superviseur cannot directly modify Activity structural data during review.

The Superviseur cannot manage Activity assignments.

The Superviseur cannot access the complete audit history for the first release.

### Validateur définitif

The Validateur définitif can view all Activities and manage business reference data, assignments, validation, cancellation and reopening decisions.

The Validateur définitif cannot directly modify Agent-entered execution data.

### Admin

The Admin can access technical administration and complete audit history, but receives no business workflow action buttons.

## 7. Partner, Project and Operation type reference data

Partners and Projects use stable internal identifiers.

Once referenced by an Activity, a Partner or Project cannot be hard-deleted.

Use active and inactive states.

An inactive record:

- Remains visible in historical Activities
- Remains visible in audit and exports
- Cannot be selected for a new Activity

Selecting a Partner in Activity creation behaves as follows:

- Exactly one active Project: auto-fill and display it read-only
- Several active Projects: require Project selection
- No active Project: block Activity submission

Operation types are configurable business reference data.

The final classification will be provided later.

Do not invent a final classification.

Operation type management belongs to the Validateur définitif.

Admin may support a technical import but must not define business classifications.

## 8. Activity creation

Activity creation uses a modern dedicated full page.

Do not use legacy Dolibarr inline forms.

Required sections:

1. General information
   - Partenaire
   - Projet
   - Activity name
   - Description

2. Planning
   - Start date
   - End date
   - Montant autorisé proposé

3. Operations
   - Name
   - Type
   - Montant autorisé
   - Add, edit and remove while allowed

4. Verification
   - Activity proposed authorized amount
   - Sum of Operation authorized amounts
   - Difference to allocate
   - Blocking validation messages
   - Submission action

The Activity must contain at least one Operation before submission.

## 9. Activity and Operation authorized amounts

There is one Activity budget concept:

```text
Montant autorisé
```

Before definitive validation, display:

```text
Montant autorisé proposé
```

After definitive validation, display:

```text
Montant autorisé validé
```

Do not create or retain a misleading business field named `Montant final`.

Definitions for reporting:

- Initial proposed amount: amount included in the first submitted business revision
- Current validated amount: amount included in the latest definitively validated business revision
- Draft edits before first submission do not redefine the initial submitted amount
- Unvalidated proposals must not be mixed into validated authorized dashboard totals

The Activity Montant dépensé is calculated from explicit Operation Montants dépensés.

Each Operation Montant autorisé must be strictly greater than 0.

Prevent zero-value Operations.

The Activity cannot be submitted or resubmitted unless:

```text
Activity Montant autorisé
=
Sum of Operation Montants autorisés
```

This equality is mandatory for every submitted business revision.

A cancelled Operation keeps its approved authorized amount. Cancellation must not silently rewrite the approved Activity budget.

A real budget reduction or reallocation is a structural revision, not a cancellation.

## 10. Business revision snapshots

Validation decisions must apply to an exact immutable business revision.

Every submission or resubmission creates a new revision snapshot.

The snapshot must contain at least:

- Revision number
- Activity identifier
- Partner
- Project
- Activity name and description
- Start date
- End date
- Activity proposed authorized amount
- Complete Operation list
- Operation names
- Operation types
- Operation authorized amounts
- Assigned Agents at submission time
- Submitter
- Submission date and time
- Content hash or equivalent immutable integrity reference where practical

Assignment changes may be recorded in the snapshot for traceability, but an assignment-only change does not automatically invalidate a prevalidated financial revision unless the canonical specification explicitly says otherwise.

Every review decision references the exact revision number.

Any structural edit creates a new revision on the next submission.

Rules:

- A previous prevalidation does not apply to a new structural revision.
- Definitive validation is allowed only when the current revision has been prevalidated.
- The prevalidator and definitive validator must act on the same revision.
- A stale review action must fail.
- The UI must clearly display the revision being reviewed.
- Audit events must include the revision number.

## 11. Separation of duties

No-self-validation is identity-based and revision-based.

For a given business revision:

- A user who created that revision cannot prevalidate it.
- A user who structurally modified data included in that revision cannot prevalidate it.
- A user who created or structurally modified the revision cannot definitively validate it.
- The user who prevalidated the revision cannot definitively validate the same revision.
- A later role change does not remove these restrictions.

Track revision contributors sufficiently to enforce these rules.

Do not rely only on role exclusivity.

## 12. Validation workflow

Required semantic states:

- Brouillon
- Soumise pour prévalidation
- Retournée en correction par le Superviseur
- Prévalidée, en attente de validation définitive
- Retournée en correction par le Validateur définitif
- Validée définitivement
- Annulée

Internal enum names may follow repository conventions, but business meaning must remain exact.

### Main flow

```text
Brouillon
    -> Soumise pour prévalidation
    -> Prévalidée, en attente de validation définitive
    -> Validée définitivement
```

### Superviseur correction flow

```text
Soumise pour prévalidation
    -> Retournée en correction par le Superviseur
    -> Agent edits
    -> New revision submitted for prevalidation
```

### Validateur correction flow

```text
Prévalidée, en attente de validation définitive
    -> Retournée en correction par le Validateur définitif
    -> Agent edits
    -> New revision submitted for prevalidation
    -> New prevalidation
    -> Definitive validation
```

A correction reason is mandatory.

Superviseur and Validateur do not directly correct Activity structural data during review.

Do not collapse correction states into a generic draft without preserving the origin and reason.

## 13. Authorized amount revision

The Validateur définitif may decide before the Activity starts that the proposed Activity Montant autorisé must change.

The Validateur must not silently overwrite only the Activity amount.

Required flow:

1. Validateur returns the Activity for correction.
2. Validateur records the requested amount and a mandatory reason.
3. An assigned Agent edits the Activity amount.
4. The Agent adjusts Operation authorized amounts.
5. Totals must match.
6. The Agent submits a new revision.
7. The Superviseur prevalidates the new revision.
8. The Validateur definitively validates the same revision.

Keep the first submitted proposed amount and every later revision.

## 14. Late validation and start-date freeze

The expected rule is that an Activity is definitively validated before its start date.

Execution cannot begin until definitive validation.

Use proactive monitoring and alerts before the start date.

Once the start date is reached:

- Structural editing is prohibited.
- An unchanged already-submitted revision may still complete its pending review and receive definitive validation.
- The review action must reference the same unchanged revision.
- If the Superviseur or Validateur requires a structural correction, the Activity cannot be edited.
- The Activity must be cancelled and recreated for the first release.
- Cancellation and recreation remain separate auditable records.
- Do not silently copy or replace the old Activity unless a separately approved copy feature exists.

Before the start date, any post-validation structural change requires the complete correction, prevalidation and definitive validation cycle.

Structural data includes:

- Partner
- Project
- Activity timeline
- Activity Montant autorisé
- Operation list
- Operation type
- Operation Montant autorisé

The backend must enforce these rules.

## 15. Operation execution data

Operation creation fields:

- Name
- Type
- Montant autorisé

Montant dépensé is entered later.

Rules:

- Initial Montant dépensé is `null`
- Never default missing expenditure to zero
- Montant dépensé may be explicitly entered as `0 F CFA`
- Only assigned Agents may edit execution data
- Every saved change is audited
- Use optimistic locking or equivalent stale-write protection

Only assigned Agents may update:

- Montant dépensé
- Operation status
- Execution observations

Superviseur and Validateur can consult but do not directly modify these values.

## 16. Financial calculations and display

```text
Écart = Montant dépensé - Montant autorisé
```

```text
Variance % = ((Montant dépensé - Montant autorisé) / Montant autorisé) * 100
```

Variance is displayed with two decimal places.

Display rules:

- Écart equal to 0: `-`
- Variance equal to 0: `-`
- Positive Écart: include `+`
- Negative Écart: include `-`
- Positive Variance: include `+` and two decimals
- Negative Variance: include `-` and two decimals
- Missing Montant dépensé: `Non renseigné`

`-` means a valid calculated numeric zero.

It must never mean missing information.

When Montant dépensé differs from Montant autorisé, an Observation is mandatory.

For Excel:

- Keep zero numeric
- Apply a number format that displays zero as `-`
- Keep money and percentages numeric
- Do not convert calculated cells to text

## 17. Currency

The first release supports XOF only.

Do not display a currency selector.

Store money using integer-safe values.

Do not use binary floating point for money.

Display amounts as:

```text
1 500 000 F CFA
```

## 18. Operation lifecycle

Operation statuses:

- À faire
- En cours
- Terminée
- Annulée

An Operation cannot become `Terminée` while Montant dépensé is `null`.

An explicit `0 F CFA` permits completion only when the mandatory Observation is present because it differs from Montant autorisé.

A completed Operation is locked.

It cannot be directly edited.

A cancelled Operation cannot be reopened in the first release.

## 19. Cancellation request workflow

Cancellation is a dedicated terminal workflow.

It is an authorized exception to normal structural freeze rules.

It does not permit any other structural modification.

Before first Activity submission:

- An assigned Agent may remove a draft Operation.

After first submission:

- An assigned Agent may request Activity or Operation cancellation.
- Only the Validateur définitif may approve or reject the request.
- The requester may withdraw a pending request.
- Only one pending cancellation request may exist for the same target.

Use a structured cancellation request entity or equivalent model with states:

- PENDING
- APPROVED
- REJECTED
- WITHDRAWN

Store:

- Target type
- Target identifier
- Target revision or version
- Requester
- Request reason
- Request date
- Reviewer
- Decision
- Decision reason
- Decision date
- Withdrawal date where applicable

Rules:

- Request reason is mandatory.
- Approval and rejection remain audited.
- Withdrawal remains audited.
- Approval must fail if the target materially changed after the request.
- The reviewer must see the current target version and requested target version.
- Target status changes only after approval.

### Operation cancellation

A cancelled Operation retains:

- Montant autorisé
- Montant dépensé
- Observation
- Audit history

An Operation with Montant dépensé greater than 0 may be cancelled.

Its spending remains included in Activity historical and actual spent totals.

Cancellation does not infer a missing Montant dépensé as zero.

A cancelled Operation may therefore display:

```text
Opération annulée, situation financière non renseignée
```

### Activity cancellation

When Activity cancellation is approved, perform one controlled transaction:

- Set Activity to Annulée
- Cancel every unfinished Operation
- Keep completed Operations completed
- Preserve all authorized and spent amounts
- Record the Activity cancellation
- Record resulting Operation status changes
- Preserve the mandatory reason

If all Operations are Annulées, the Activity is Annulée, not Terminée.

## 20. Completed Operation reopening workflow

A completed Operation is locked.

An assigned Agent may request reopening.

Only the Validateur définitif may approve or reject reopening.

Use a structured request model with states:

- PENDING
- APPROVED
- REJECTED
- WITHDRAWN

Store:

- Operation
- Target version
- Requester
- Reason
- Request date
- Reviewer
- Decision
- Decision reason
- Decision date

Rules:

- Only one pending reopening request per Operation
- Requester may withdraw before decision
- Approval fails if the target version changed
- On approval, Operation returns to `En cours`
- The assigned Agent may then correct execution information
- If the Activity was `Terminée`, recalculate its execution status
- Cancelled Operations cannot be reopened in the first release
- Every event is audited

## 21. Activity execution status

Validation status and execution status are separate.

Before definitive validation, display:

```text
Exécution non démarrée
```

Do not present an unvalidated Activity as operationally `À venir` or `En cours`.

After definitive validation, execution status is derived from facts.

Statuses:

- À venir
- En cours
- Terminée
- En retard
- Annulée

Use the Benin application timezone:

```text
Africa/Porto-Novo
```

The end date is inclusive.

Status precedence:

1. Explicitly cancelled Activity: Annulée
2. All Operations cancelled: Annulée
3. All Operations terminal and at least one completed: Terminée
4. At least one unfinished Operation and current local date is after the inclusive end date: En retard
5. Start date is in the future: À venir
6. Otherwise: En cours

Terminal Operation statuses:

- Terminée
- Annulée

Do not mark an Activity complete while an Operation remains À faire or En cours.

## 22. Execution-status transition events

Execution status is derived, but date-driven changes still need reliable audit events.

Use one source of truth for calculation.

Implement:

- Deterministic status calculation service
- Idempotent scheduled reconciliation in `Africa/Porto-Novo`
- First-transition audit event for date-driven changes
- Transactional transition events for Operation-driven changes
- Defensive recalculation in the UI to avoid stale display

Do not create duplicate transition events when the reconciliation job runs more than once.

## 23. Financial completeness

Financial completeness is a derived indicator separate from validation and execution status.

Recommended values:

- Non démarrée
- Partiellement renseignée
- Complète

At minimum:

- No Operation has explicit Montant dépensé: Non démarrée
- Some but not all relevant Operations have explicit Montant dépensé: Partiellement renseignée
- All relevant Operations have explicit Montant dépensé: Complète

A cancelled Operation with missing Montant dépensé remains financially incomplete.

Activity terminal status and financial completeness may therefore differ.

Do not infer completeness from cancellation.

## 24. Audit integrity

The audit history is append-only.

Keep two representations:

1. Structured immutable audit data
2. Human-readable Activity timeline events

Every auditable business mutation and its audit event must succeed or fail in the same database transaction.

Application code must not update or delete existing audit events.

Audit records should include where applicable:

- Immutable audit identifier
- Entity type
- Entity identifier
- Activity identifier
- Operation identifier
- Business revision number
- Actor identifier
- Actor name snapshot
- Actor role snapshot
- Timestamp
- Action
- Previous value
- New value
- Reason
- Workflow state before
- Workflow state after
- Target version
- Result

Never record:

- Invitation secrets
- Passwords
- Session tokens
- Raw authentication tokens
- Sensitive configuration secrets

Audit committed business actions, not keystrokes or form openings.

The Activity timeline must linearly include:

- Creation
- Initial Operations
- Submission
- Revision number
- Correction request
- Edits
- Resubmission
- Prevalidation
- Definitive validation
- Authorized amount revision
- Assignment changes
- Execution changes
- Cancellation requests and decisions
- Reopening requests and decisions
- Automatic status transitions
- Admin technical interventions
- Audit exports

Full audit access is limited to:

- Validateur définitif
- Admin

Agents and Superviseurs may see current workflow messages needed for their task without seeing the complete audit timeline.

## 25. Export integrity

Every export must include:

- Export identifier where practical
- Generated by
- Generated at
- `As of` timestamp
- Applied filters
- Relevant Activity or Partner scope

Record an export audit event only after successful generation.

PDF displays zero Écart and zero Variance as `-`.

Excel preserves numeric zero and uses display formatting.

Generated official Partner reports in Phase 6 must become immutable report snapshots.

## 26. Dashboard rules

Dashboards must not silently mix:

- Unvalidated proposed amounts
- Validated authorized amounts
- Active authorized amounts
- Cancelled authorized amounts
- Active spending
- Spending on cancelled Operations
- Missing spending

At minimum, provide separate metrics for:

- Initial proposed amount
- Current validated amount
- Validated active authorized amount
- Cancelled authorized amount
- Spending on active Operations
- Spending on cancelled Operations
- Operations without Montant dépensé
- Cancelled Operations with incomplete financial information

For pending Activities, label proposal values clearly and exclude them from validated totals.

## 27. User experience

Use the current authoritative MJL design system.

Do not use legacy Dolibarr inline forms.

Use:

- Full-page Activity creation
- Dedicated detail pages
- Controlled drawers
- Controlled dialogs
- Expandable Activity rows for Operation consultation
- Read-only tables with explicit actions

The expanded Operation table must not become uncontrolled inline editing.

Use concise alerts.

Examples:

- `Activité XXX créée avec succès`
- `Activité XXX soumise pour prévalidation`
- `Correction demandée pour l’Activité XXX`
- `Activité XXX prévalidée`
- `Activité XXX validée définitivement`

Do not use long explanatory alert messages.

Do not use the em dash character in MJL prompts, labels, comments, documentation or generated reports.

## 28. Concurrency

Use optimistic locking or an equivalent version mechanism for:

- Activity structural edits
- Operation planning edits
- Operation execution edits
- Validation decisions
- Cancellation decisions
- Reopening decisions
- Assignment changes

A stale action must fail safely.

Do not silently overwrite another user's committed change.

## 29. Testing strategy

Test business journeys, permissions, calculations and state transitions.

Do not add wording-only tests.

Do not create one micro-test per field when a complete journey gives stronger protection.

Use focused unit or integration tests for:

- Money calculations
- Variance
- Status derivation
- Revision matching
- Permission checks
- Separation of duties
- State transitions
- Transactional audit

Use E2E tests for:

- Activity creation
- Budget balancing
- Correction loop
- Validation
- Assignment
- Execution
- Cancellation
- Reopening
- Access removal
- Audit
- Dashboards
- Exports

Run the smallest relevant test set during implementation.

Run the full relevant core regression suite at phase gates.

Report unrelated pre-existing failures separately.

Never hide failing tests.

## 30. Codex execution discipline

For each phase:

1. Read canonical documents.
2. Inspect the current repository implementation.
3. Identify conflicts with the requested phase.
4. Produce a short plan.
5. Execute only the requested phase.
6. Do not start a later phase.
7. Remove obsolete code only when authorized by the approved reset manifest.
8. Update canonical documentation.
9. Add targeted tests.
10. Run validation.
11. Produce a phase report containing:
    - Scope implemented
    - Files changed
    - Schema and migration impact
    - Destructive actions
    - Permissions
    - Business rules
    - Tests run
    - Results
    - Screenshots or UI evidence
    - Known limitations
    - Deferred decisions
    - Explicit verdict

If repository facts contradict the prompt, do not guess. Report the contradiction and stop when it affects correctness.

---

# Phase 0 Prompt: Authoritative Audit and Reset Manifest

## Goal

Create the authoritative post-cadrage specification and a repository reset manifest without modifying production code or executing destructive changes.

Use normal execution mode.

Plan briefly, perform the audit and documentation work, then stop.

## Prompt for Codex

You are working in the MJL repository.

Implement Phase 0: Authoritative Audit and Reset Manifest.

The Global Authoritative Rules in this package are mandatory.

### Hard Phase 0 restriction

Phase 0 is audit and documentation only.

Do not:

- Modify production application code
- Modify production database schemas
- Execute migrations
- Delete routes
- Delete tables
- Delete tests
- Change permissions
- Change production seed data
- Implement new business behavior

You may create or update documentation and non-executable audit artifacts.

### Repository audit

Inspect:

- Dolibarr module structure
- Database tables
- Existing migrations
- Roles and permissions
- User invitation and account model
- Partner and Project concepts
- Activity concepts
- Expense, disbursement and financing concepts
- Validation workflows
- Current status models
- Current audit mechanisms
- Current exports
- Current dashboards
- Current forms and UI shell
- Navigation and routes
- Existing automated tests
- Current authoritative design-system documents
- Production-readiness configuration
- Existing data and reset assumptions

### Conflict matrix

Create a complete matrix containing:

- Current repository concept
- New authoritative concept
- Conflict
- Risk
- Keep, replace, remove, archive or defer
- Target phase
- Expected files
- Schema consequence
- Test consequence
- Data reset consequence

Pay special attention to:

- Previous role models
- Admin business-superuser behavior
- Previous Partner or Programme naming
- Previous Project cardinality
- Previous Activity amount fields
- Previous expense and disbursement workflows
- Previous financing assumptions
- Previous validation states
- Legacy inline forms
- Previous supporting-document assumptions
- Existing accounting or report code
- Old tests that encode obsolete behavior

### Canonical documents

Create or update:

```text
docs/mjl-functional-specification-v2.md
docs/mjl-decision-register-v2.md
docs/mjl-scope-boundary-v2.md
docs/mjl-permission-matrix-v2.md
docs/mjl-status-and-transition-model-v2.md
docs/mjl-data-dictionary-v2.md
docs/mjl-reset-manifest-v2.md
docs/mjl-implementation-roadmap-v2.md
docs/mjl-phase-0-audit-report.md
```

The functional specification must:

- State that it supersedes conflicting earlier MJL material
- State that backward compatibility is not required
- Include the complete Global Authoritative Rules
- Include the product principle verbatim
- Separate core scope from deferred phases
- Describe business revision snapshots
- Describe identity-based separation of duties
- Describe cancellation and reopening request workflows
- Describe the Phase 3C non-go-live boundary

Include this sentence verbatim:

> The application must never infer that missing financial information equals zero, and must never allow a validated financial structure to be silently modified.

### Reset manifest

The reset manifest must list every proposed destructive or replacement action.

For each action include:

- Identifier
- Current component
- Proposed action
- Reason
- Affected files
- Affected tables
- Data impact
- Rollback approach
- Target phase
- Approval status

Set every destructive action to:

```text
PENDING_APPROVAL
```

Do not execute it in Phase 0.

### Legacy documentation

For every conflicting document:

- Add a superseded notice, or
- Move it to a clearly archived documentation area, or
- Update the documentation index to mark it non-authoritative

Do not alter historical evidence unnecessarily.

### Future-module boundaries

Document non-speculative extension points for:

- Contextual document management
- Accounting entries
- Supporting-document links
- Partner-specific official financial reports
- Immutable report snapshots

Do not invent:

- Accounting journals
- Account codes
- Budget codes
- Document categories
- Partner template mappings
- Report approval rules

### Acceptance criteria

Phase 0 is complete only when:

- The repository has been inspected
- Canonical v2 documents exist
- The conflict matrix is complete
- The reset manifest is complete
- No destructive action has been executed
- Every reset action remains pending approval
- Deferred modules are gated
- Repository facts and uncertainties are documented
- The report has an explicit verdict

### Required verdict

Use one:

```text
PHASE_0_AUDIT_READY
PHASE_0_AUDIT_READY_WITH_NOTES
PHASE_0_AUDIT_BLOCKED
```

Stop after Phase 0.

---

# Phase 1 Prompt: Approved Reset, Roles and Master Data Foundation

## Goal

Execute only the approved reset-manifest actions required for the new foundation, then implement roles, invitations, Partner, Project, Operation types and transactional audit infrastructure.

Use normal execution mode.

## Prompt for Codex

You are working in the MJL repository after Phase 0 has been reviewed.

Implement Phase 1: Approved Reset, Roles and Master Data Foundation.

### Mandatory preconditions

Read all canonical v2 documents.

Verify that:

- Phase 0 verdict is acceptable
- `docs/mjl-reset-manifest-v2.md` exists
- Destructive actions intended for Phase 1 are explicitly marked approved
- No conflicting canonical decision remains unresolved

If an intended destructive action is not approved, do not execute it.

### Scope

Implement:

- Approved Phase 1 reset actions
- Exclusive roles
- Safe role changes
- Invitations
- Account activation and deactivation
- Partner management
- Project management
- Empty-state Partner and Project behavior
- Operation type reference management
- Stable identifiers
- Transactional append-only audit infrastructure
- Modern reference-data UI
- Backend and UI permission enforcement

Do not implement Activities in this phase.

### Approved cleanup

Execute only reset-manifest entries approved for Phase 1.

For every destructive action:

- Record what was changed
- Record migration impact
- Provide rollback instructions
- Remove obsolete tests that only encode removed behavior
- Add replacement tests where required

### Roles

Enforce exactly one active role per user.

Implement safe role change behavior:

- Reject change while Agent assignments remain
- Require assignment transfer or removal first
- Preserve historical roles
- Invalidate or refresh sessions
- Re-evaluate permissions
- Audit role change transactionally

### Invitations

Admin can:

- Invite a user
- Assign exactly one role
- Resend or revoke according to existing safe repository conventions
- Activate or deactivate account access

Requirements:

- No multi-role invitation
- Expiring secure token
- Replay protection
- Audit invitation creation, acceptance, revocation and account changes
- Never record raw invitation secrets in audit

### Partner and Project

Implement one-to-many Partner to Project.

Create no Partner or Project seed. UNICEF, Coopération Suisse, and their
Projects may appear only in disposable tests until the post-all-phases dataset
specification is approved.

Validateur définitif manages Partner and Project business data.

Admin cannot create or edit them.

Use active and inactive states.

Prevent hard deletion once referenced.

Use stable codes or identifiers that do not change when display names change.

### Operation types

Create configurable Operation type reference data.

Validateur définitif manages it.

Do not invent the final client classification.

Use temporary values only inside disposable tests; persist no development catalog.

### Transactional audit foundation

Create or adapt structured append-only audit support.

Every audited mutation and audit insertion must share one database transaction.

Prevent application-level update or deletion of audit events.

Snapshot actor name and role.

Phase 1 audit covers:

- Invitation
- Invitation acceptance
- Role assignment
- Role change
- Account activation or deactivation
- Partner creation and update
- Project creation and update
- Operation type creation and update
- Activation and deactivation

### Modern UI

Use authoritative MJL components.

Do not use legacy inline forms.

Use dedicated pages, drawers or controlled dialogs.

Use concise feedback.

### Tests

Cover journeys:

1. Admin invites one-role user.
2. Multi-role assignment fails.
3. Role change fails while Agent assignments remain.
4. Role change succeeds after assignments are cleared.
5. Session authorization changes after role change.
6. Admin cannot manage Partner, Project or Operation types.
7. Validateur manages Partner and Project.
8. Partner supports multiple Projects.
9. Inactive Project cannot be used for future Activity creation.
10. Referenced Partner or Project cannot be hard-deleted.
11. Normal startup remains empty and disposable test fixtures are isolated and fully removed.
12. Audit and business mutation are transactional.
13. Audit records cannot be updated or deleted through application services.
14. Invitation secrets do not appear in audit.

### Deliverables

Create or update:

```text
docs/mjl-phase-1-foundation-plan.md
docs/mjl-phase-1-foundation-report.md
```

Update canonical documents for implemented repository details.

### Verdict

Use one:

```text
PHASE_1_READY
PHASE_1_READY_WITH_NOTES
PHASE_1_BLOCKED
```

Stop after Phase 1.

---

# Phase 2 Prompt: Activity Planning, Business Revisions and Validation

## Goal

Implement Activity planning from creation through definitive validation with immutable submitted revisions, balanced Operations, multi-Agent editing, separation of duties, correction cycles and late-validation safeguards.

Use normal execution mode.

## Prompt for Codex

You are working in the MJL repository after approved Phases 0 and 1.

Implement Phase 2: Activity Planning, Business Revisions and Validation.

### Preconditions

Read all canonical v2 documents.

Verify that foundation roles, reference data and transactional audit are ready.

Stop if the repository cannot enforce immutable revision-linked validation decisions.

### Scope

Implement:

- Activity planning model
- Operation planning model
- Assignment model
- Full-page Activity creation
- Multi-Agent editable workflow
- Balanced budget validation
- Immutable business revision snapshots
- Prevalidation
- Definitive validation
- Correction loops
- Authorized amount revision flow
- Identity-based separation of duties
- Late validation rule
- Structural locks
- Human-readable planning and validation history
- Concurrency protection
- Tests

Do not implement execution-data editing in this phase.

### Activity model

Required concepts:

- Stable Activity identifier
- Partner
- Project
- Name
- Description
- Start date
- End date
- Current draft proposed amount
- First submitted proposed amount
- Latest definitively validated amount
- Validation status
- Creator
- Primary Agent
- Optimistic lock version
- Created and updated timestamps

Use a version table when it produces cleaner history.

Do not use a `Montant final` business field.

### Assignments

Implement:

- Creator
- Primary Agent
- Additional Agents
- Assignment start
- Assignment end
- Assigned by
- Reason

At creation, creator becomes primary Agent.

All currently assigned Agents may edit, correct and submit while Activity is editable.

Primary Agent has no exclusive business permission.

Only Validateur manages assignments.

Assignment-only changes are audited and snapshotted for traceability.

### Operation planning

Each Operation includes:

- Stable identifier
- Activity
- Name
- Type
- Montant autorisé
- Initial status À faire
- Optimistic lock version
- Created and updated metadata

Rules:

- Montant autorisé greater than 0
- Montant dépensé remains null
- At least one Operation
- No hard deletion after first submission

### Full-page Activity creation

Implement the four sections defined in Global Rules.

Show live reconciliation:

- Activity proposed authorized amount
- Total Operation authorized amount
- Difference to allocate

Block submission unless totals match exactly.

### Business revision snapshots

Every submission and resubmission creates an immutable revision.

The revision contains the complete planning structure.

Track contributors who created or structurally modified the submitted revision.

Reviews must reference exact revision.

Stale review actions fail.

A new structural revision invalidates prior prevalidation for definitive validation purposes.

### Validation flow

Implement exact semantic states.

Superviseur may:

- Prevalidate current revision
- Return current revision for correction with mandatory reason

Validateur may:

- Definitively validate the prevalidated current revision
- Return it for correction with mandatory reason and optional requested amount

Neither reviewer edits structural data directly.

### Separation of duties

Enforce per revision:

- Contributor cannot prevalidate
- Contributor cannot definitively validate
- Prevalidator cannot definitively validate same revision
- Role change does not bypass restriction

Provide clear authorization errors without exposing sensitive internals.

### Authorized amount revision

Implement the full return, Agent edit, new revision, new prevalidation and final validation flow.

Never overwrite the first submitted proposed amount.

### Late validation

Expected state: definitive validation before start date.

Implement:

- Alerts or warning indicators for unvalidated Activities approaching start
- Execution blocked before definitive validation
- Structural edits prohibited at or after start date
- Unchanged submitted revision may continue pending review after start
- Any required structural correction at or after start requires cancellation and recreation
- No hidden exceptional edit path

The cancellation workflow itself is implemented in Phase 3A. In Phase 2, block the impossible correction and present the required next action without implementing an unauthorized bypass.

### Structural locks

Backend and UI enforce locks.

Before start and after definitive validation, structural change requires a new correction cycle.

At or after start, structural change is prohibited.

### Activity list and detail

Implement:

- Role-filtered Activity list
- Expandable Operation consultation
- Dedicated Activity detail
- Current validation status
- Current revision
- Current correction reason
- Current assignments
- Proposed and validated amount labels
- No Admin business actions

### Audit

Timeline includes:

- Creation
- Draft save where committed
- Initial Operations
- Submission and revision
- Correction reason
- Field changes
- Operation changes
- Resubmission
- Prevalidation
- Definitive validation
- Requested amount revision
- Assignment changes

Full audit access remains Validateur and Admin only.

### Concurrency

Protect:

- Activity edits
- Operation planning edits
- Submission
- Review decision
- Assignment changes

### Tests

Cover:

1. Agent creates balanced Activity.
2. Submission fails without Operation.
3. Submission fails for zero Operation amount.
4. Submission fails when totals differ.
5. Partner auto-fills one Project.
6. Several Projects require selection.
7. Creator becomes primary Agent.
8. Additional assigned Agent edits and submits.
9. Primary Agent has no exclusive permission.
10. Only Validateur manages assignments.
11. Removed Agent loses access.
12. Submission creates immutable revision.
13. Superviseur decision references revision.
14. New structural revision invalidates previous prevalidation.
15. Contributor cannot prevalidate.
16. Contributor cannot definitively validate.
17. Prevalidator cannot definitively validate.
18. Superviseur returns with reason.
19. Agent corrects and resubmits.
20. Validateur requests amount revision.
21. Full new prevalidation occurs.
22. Definitive validation references same revision.
23. Admin cannot act in workflow.
24. Structural edits require correction before start.
25. Structural edits fail at or after start.
26. Unchanged submitted revision can be validated late.
27. Required late structural correction is blocked.
28. Optimistic locking prevents stale overwrite.
29. Audit reconstructs the full sequence.

### Deliverables

```text
docs/mjl-phase-2-activity-plan.md
docs/mjl-phase-2-activity-report.md
```

### Verdict

```text
PHASE_2_READY
PHASE_2_READY_WITH_NOTES
PHASE_2_BLOCKED
```

Stop after Phase 2.

---

# Phase 3A Prompt: Execution, Cancellation, Reopening and Statuses

## Goal

Implement Operation execution data, financial calculations, cancellation requests, completed Operation reopening, Activity cancellation, derived statuses, deadline handling and financial completeness.

Use normal execution mode.

## Prompt for Codex

You are working in the MJL repository after approved Phases 0, 1 and 2.

Implement Phase 3A: Execution, Cancellation, Reopening and Statuses.

### Preconditions

Read canonical v2 documents.

Verify definitive validation, assignments, revisions and audit transactions are operational.

### Scope

Implement:

- Assigned-Agent execution editing
- Montant dépensé
- Observation enforcement
- Écart and Variance
- Operation lifecycle
- Completion lock
- Cancellation request workflow
- Activity cancellation cascade
- Reopening request workflow
- Derived Activity execution status
- Date reconciliation
- Financial completeness
- Cancelled-data preservation
- Concurrency
- Audit
- Tests

### Execution permissions

Only currently assigned Agents may change:

- Montant dépensé
- A faire, En cours and Terminée status
- Execution Observation

Superviseur and Validateur consult only.

Validateur decides cancellation and reopening requests but does not directly edit execution values.

Admin has no business actions.

### Montant dépensé

- Starts null
- May be explicit zero
- Uses integer-safe storage
- Is never inferred from missing data
- Is audited on every committed change

Observation is mandatory when spent differs from authorized.

### Calculations

Implement formulas and display rules exactly as defined globally.

Variance uses two decimal places.

### Completion

Operation cannot become Terminée with null spent amount.

Explicit zero requires Observation.

A completed Operation is locked.

### Cancellation request

Implement structured request states and version checks.

Agent may request or withdraw.

Validateur may approve or reject.

Only one pending request per target.

Approval fails on material version mismatch.

### Operation cancellation

Preserve authorized and spent amounts.

Do not convert null spent amount to zero.

Include spending in Activity totals.

Keep separate cancelled metrics.

### Activity cancellation

Implement controlled transaction:

- Activity Annulée
- Unfinished Operations Annulées
- Completed Operations unchanged
- Amounts preserved
- All audit events transactional

If cancellation is required because late structural correction is impossible, the normal cancellation request and approval rules still apply.

### Reopening completed Operation

Assigned Agent requests reopening.

Validateur approves or rejects.

On approval:

- Operation returns to En cours
- Activity status recalculates
- Execution fields become editable by assigned Agents
- Audit records request and decision

Cancelled Operation reopening is prohibited.

### Activity execution status

Implement deterministic service and status precedence.

Before definitive validation, show Exécution non démarrée.

Use Africa/Porto-Novo.

End date inclusive.

### Scheduled reconciliation

Implement idempotent date-driven transition detection.

Record only the first actual status transition.

Do not create duplicate events.

### Financial completeness

Implement Non démarrée, Partiellement renseignée and Complète.

Cancelled Operations with null spent amount remain incomplete.

### Cancelled totals

Expose separately:

- Active authorized amount
- Cancelled authorized amount
- Active Operation spending
- Cancelled Operation spending
- Missing spent amount count
- Cancelled incomplete count

Do not break the approved Activity budget invariant by deleting cancelled amounts.

### Structural freeze

At or after start date, only authorized terminal workflows and execution data remain available.

No structural edit path.

### Access revocation

Verify open and direct access fail after Agent removal.

### Concurrency

Protect execution save, cancellation decision, reopening decision and status update.

### Tests

Cover:

1. Assigned Agent enters spent amount.
2. Unassigned Agent denied.
3. Removed Agent denied.
4. Superviseur cannot edit.
5. Validateur cannot directly edit.
6. Missing displays Non renseigné.
7. Explicit zero remains distinct.
8. Completion blocked with null.
9. Zero completion requires Observation.
10. Difference requires Observation.
11. Equal result displays `-`.
12. Variance has two decimals.
13. Cancellation request lifecycle.
14. Duplicate pending request blocked.
15. Withdrawal audited.
16. Stale approval blocked.
17. Operation with spending can be cancelled.
18. Null spending remains null after cancellation.
19. Cancelled amount remains in historical totals.
20. Activity cancellation cascades only unfinished Operations.
21. All cancelled makes Activity Annulée.
22. Completed plus cancelled makes Activity Terminée.
23. Completed Operation locks.
24. Reopening request lifecycle.
25. Approved reopening returns En cours.
26. Activity status recalculates after reopening.
27. Cancelled Operation cannot reopen.
28. End date is inclusive.
29. Overdue starts the following local day.
30. Scheduled reconciliation is idempotent.
31. Cancelled incomplete records remain financially incomplete.
32. Stale execution overwrite fails.
33. Audit and mutation are transactional.

### Deliverables

```text
docs/mjl-phase-3a-execution-plan.md
docs/mjl-phase-3a-execution-report.md
```

### Verdict

```text
PHASE_3A_READY
PHASE_3A_READY_WITH_NOTES
PHASE_3A_BLOCKED
```

Stop after Phase 3A.

---

# Phase 3B Prompt: Audit Experience, Dashboards and Operational Exports

## Goal

Deliver complete human-readable audit, core monitoring dashboards, operational PDF and Excel exports, notifications and UX consolidation.

Use normal execution mode.

## Prompt for Codex

You are working in the MJL repository after approved Phases 0, 1, 2 and 3A.

Implement Phase 3B: Audit Experience, Dashboards and Operational Exports.

### Preconditions

Read canonical v2 documents.

Verify structured audit, revisions, execution statuses, cancellation and reopening are stable.

### Scope

Implement:

- Linear Activity audit timeline
- Structured audit search and filters
- Audit permissions
- Audit PDF and Excel export
- Partner and Activity dashboards
- Validation monitoring
- Deadline monitoring
- Over and under budget monitoring
- Assignment monitoring
- Cancelled-data reporting
- Financial completeness reporting
- Expandable Operation consultation
- Operational PDF and Excel exports
- Concise notifications
- Accessibility, responsiveness and performance consolidation

These are operational reports.

Do not label them official UNICEF or Coopération Suisse reports.

### Audit timeline

Merge Activity and Operation events chronologically.

Include revision numbers and request lifecycles.

Show:

- Timestamp
- Actor
- Role at the time
- Action
- Previous and new values
- Reason
- Revision
- Status transition
- Related Operation

Do not expose raw payloads as the primary UI.

### Audit permissions

Full audit is limited to Validateur and Admin.

Enforce route, API and export authorization.

### Audit exports

Implement Activity PDF, Activity Excel and global audit Excel.

Global PDF is optional only if readability and bounded volume are proven.

Every export includes generated-at and as-of timestamps.

Audit export event is written only after successful file generation.

### Dashboard definitions

#### Partner view

- First submitted proposed amount
- Latest validated amount
- Active validated authorized amount
- Cancelled authorized amount
- Spending on active Operations
- Spending on cancelled Operations
- Missing spent amount count
- Cancelled incomplete count
- Activities by validation status
- Activities by execution status

#### Activity view

- Partner
- Project
- Dates
- First submitted proposed amount
- Latest validated amount
- Total explicit spending
- Active and cancelled spending split
- Écart and Variance where meaningful
- Operation progress
- Financial completeness
- Validation status
- Execution status
- Current assigned Agents
- Current revision

#### Monitoring

- Awaiting prevalidation
- Awaiting definitive validation
- Returned for correction
- Approaching start without definitive validation
- Late pending review
- Approaching end date
- Overdue
- Over-budget Operations
- Under-budget Operations
- Missing spent amounts
- Activities by current Agent
- Cancelled Activities
- Cancelled Operations with spending
- Cancelled Operations with missing financial data
- Reopening requests
- Cancellation requests

### Aggregation rules

- Pending proposed amounts do not enter validated totals.
- Sum only explicit spent values.
- Never replace missing with zero.
- Keep cancelled and active metrics separate.
- Use F CFA.
- Display zero Écart and Variance as `-`.
- Use two-decimal Variance.
- Document formulas.

### Operational exports

Implement:

- Activity list
- Activity financial summary
- Operation detail
- Partner financial summary
- Deadline monitoring
- Over-budget Operations
- Activities by Agent
- Validation queues
- Cancellation and reopening request queues

PDF and Excel follow display and numeric rules.

### Activity and Operation browsing

Use compact Activity rows or cards.

Allow expand and collapse for read-only Operation consultation.

Editing remains through controlled forms.

### Notifications

Create concise targeted notifications for:

- Submission
- Correction request
- Prevalidation
- Definitive validation
- Assignment added
- Assignment ended
- Cancellation requested
- Cancellation approved or rejected
- Reopening requested
- Reopening approved or rejected
- Approaching start without validation
- Approaching deadline
- Overdue status

Do not add verbose detail to alerts.

### Accessibility and performance

Verify:

- Keyboard support
- Focus visibility
- Error association
- Locked-state clarity
- Responsive layout
- Bounded queries
- Pagination
- Expand-on-demand
- Indexed filters
- No full audit history loaded into dashboard queries
- No native Dolibarr chrome leakage for normal MJL users

### Tests

Cover:

1. Validateur full audit access.
2. Admin full audit access.
3. Superviseur denied full audit.
4. Agent denied full audit.
5. Timeline order and revision display.
6. Cancellation and reopening events appear.
7. Audit PDF generated.
8. Audit Excel remains numeric.
9. As-of timestamp present.
10. Export event only after success.
11. Pending proposals excluded from validated totals.
12. Active and cancelled totals separate.
13. Missing not treated as zero.
14. Equal results display `-`.
15. Partner summary initial and validated amounts differ correctly.
16. Deadline and late-validation monitoring correct.
17. Current Agent dashboard excludes removed Agents.
18. Historical audit retains removed Agents.
19. Cancelled incomplete records visible.
20. Operation expansion loads on demand.
21. Notifications remain concise.
22. Permission checks apply to direct export URLs.
23. Dashboard queries are bounded.
24. Core accessibility checks pass.
25. No output is falsely labeled official Partner report.

### Deliverables

```text
docs/mjl-phase-3b-monitoring-plan.md
docs/mjl-phase-3b-monitoring-report.md
docs/mjl-dashboard-formulas-v2.md
docs/mjl-export-catalog-v2.md
```

### Verdict

```text
PHASE_3B_READY
PHASE_3B_READY_WITH_NOTES
PHASE_3B_BLOCKED
```

Stop after Phase 3B.

---

# Phase 3C Prompt: Core Scope Hardening and Readiness Checkpoint

## Goal

Harden the core implementation and determine whether it is ready for integration with deferred modules.

This phase does not authorize production launch.

Use normal execution mode.

## Prompt for Codex

You are working in the MJL repository after approved Phases 0, 1, 2, 3A and 3B.

Implement Phase 3C: Core Scope Hardening and Readiness Checkpoint.

### Non-go-live rule

This phase must not deploy to production or declare the complete MJL application production-ready.

Actual go-live waits until the project owner and client confirm which of Phases 4, 5 and 6 are mandatory before launch.

### Scope

Harden:

- Authentication
- Authorization
- Invitations
- Data integrity
- Transactional audit
- Revisions
- Concurrency
- Scheduled status reconciliation
- Empty-state and disposable-fixture isolation
- Configuration
- Backup and restore
- Logging and monitoring
- Security
- Performance
- Accessibility
- Error handling
- Core regression suite
- Integration readiness documentation

Do not implement deferred modules.

### Empty persistent tenant and disposable tests

Prove that normal startup creates no persistent sample user, Partner, Project,
Activity, Opération, report, or document. Test factories may create only the
minimum records needed inside an isolated tenant, must use no shared secrets,
and must remove all database/document state with tenant teardown.

### Authorization audit

Verify every role and direct route.

Include:

- Admin cannot validate
- Admin cannot manage business reference data
- Superviseur cannot edit reviewed Activity
- Superviseur cannot manage assignments
- Validateur cannot directly edit Agent execution data
- Only Validateur handles assignments, cancellations and reopening decisions
- Unassigned Agent cannot view Activity
- Removed Agent loses access
- Revision contributor cannot review prohibited revision
- Prevalidator cannot final-validate same revision
- Full audit remains restricted
- Structural freeze holds at and after start date

### Data integrity

Verify constraints or service guards for:

- One active role
- Role change assignment rule
- Partner and Project relation
- Operation authorized amount greater than zero
- Nullable spent amount
- Balanced submitted revision
- Immutable submitted revision
- Same-revision validation
- Valid transitions
- One pending request per target and request type
- Append-only audit
- Transactional mutation and audit
- Optimistic locking
- Stable identifiers
- No hard deletion of referenced master data
- Cancelled amount preservation

Document every rule that cannot be a database constraint.

### Scheduled jobs

Verify:

- Benin timezone
- Idempotency
- Duplicate prevention
- Failure logging
- Safe retry
- Status consistency
- Notification deduplication

### Backup and restore

Test:

- Database backup
- File backup for any implemented files
- Restore into clean environment
- Stable identifiers
- Revision preservation
- Audit preservation
- Request preservation
- Validation after restore

### Configuration

Document:

- Base URL
- Mail transport
- Timezone
- Locale
- XOF and F CFA formatting
- Secrets
- Session security
- Logging
- Error reporting
- Scheduled job configuration
- Backup schedule
- Audit retention
- Feature flags
- Deferred-module flags

### Security review

Cover:

- CSRF
- IDOR
- Route authorization
- Export authorization
- Invitation token safety
- Session invalidation
- SQL injection
- Escaping
- Audit tampering
- Stale decision attacks
- Request replay
- Background job authentication
- Technical Admin actions

### Performance

Test realistic bounded volumes for:

- Activities
- Operations
- Revisions
- Audit events
- Requests
- Dashboards
- Exports
- Expand-on-demand

### Core regression

Run:

- Focused unit and integration tests
- E2E business journeys
- Permission matrix
- Revision and validation suite
- Cancellation suite
- Reopening suite
- Status and deadline suite
- Audit reconstruction
- Export suite
- Accessibility smoke
- Responsive smoke
- Backup and restore
- Production build or equivalent

### Readiness decision document

Create a clear decision matrix for Phases 4, 5 and 6:

- Client input available
- Required for go-live
- Dependency
- Current blocker
- Decision owner
- Decision date
- Status

Do not choose the go-live boundary on behalf of the client.

### Deliverables

```text
docs/mjl-phase-3c-readiness-plan.md
docs/mjl-phase-3c-readiness-report.md
docs/mjl-core-readiness-checklist.md
docs/mjl-backup-restore-runbook.md
docs/mjl-production-configuration.md
docs/mjl-security-review-v2.md
docs/mjl-go-live-scope-decision-matrix.md
```

### Verdict

Use one:

```text
CORE_SCOPE_READY_FOR_INTEGRATION
CORE_SCOPE_READY_WITH_NOTES
CORE_SCOPE_BLOCKED
```

Every verdict must include:

```text
This verdict does not authorize production launch.
```

Stop after Phase 3C.

---

# Phase 4 Prompt: Document Management, Client-Input Gate

## Goal

Design and implement contextual document management only after authoritative client rules exist.

Use normal execution mode.

## Prompt for Codex

You are working in the MJL repository after the core readiness checkpoint.

Implement or assess Phase 4: Document Management.

### Mandatory client-input check

Before changing production code, verify approved decisions for:

- Document categories
- Entity links
- Required and optional documents
- Upload roles
- Read roles
- Download roles
- Version replacement
- Cancellation
- Retention
- File size
- Allowed formats
- Validation dependencies
- Operation completion dependencies
- Accounting dependencies
- Official report dependencies

If missing:

- Do not invent rules
- Produce a gap analysis
- Produce a focused client questionnaire
- Stop

### Architecture when approved

Documents are contextual.

Possible entity links must follow approved rules:

- Partner
- Project
- Activity
- Operation
- Accounting Entry later

Requirements:

- Stable identifier
- Version history
- No silent replacement
- Soft deletion or cancellation
- Audit
- Direct-download authorization
- Historical reference preservation
- Controlled global read-only library where approved
- Contextual upload by default

### Tests

Cover complete document journeys and direct access.

### Deliverables

```text
docs/mjl-phase-4-document-gap-analysis.md
docs/mjl-phase-4-document-plan.md
```

When implemented:

```text
docs/mjl-phase-4-document-report.md
```

### Verdict

```text
PHASE_4_READY
PHASE_4_READY_WITH_NOTES
PHASE_4_BLOCKED_CLIENT_INPUT
PHASE_4_BLOCKED_TECHNICAL
```

Stop after Phase 4.

---

# Phase 5 Prompt: Accounting Entries, Accounting-Rule Gate

## Goal

Design and implement accounting entries only after authoritative accounting rules and real examples exist.

Use normal execution mode.

## Prompt for Codex

You are working in the MJL repository after the core readiness checkpoint and any required approved document phase.

Implement or assess Phase 5: Accounting Entries.

### Context

Accounting entries are part of the planned target and the client's wider manual process.

Do not infer the accounting model from operational spending alone.

### Mandatory client-input check

Verify authoritative material for:

- Entry structure
- Debit and credit model or alternative
- Chart of accounts
- Journals
- Budget codes
- Dates
- References
- Supporting documents
- Roles
- Validation
- No-self-validation
- Posting
- Correction
- Reversal
- Closing
- Relationship to Operation spending
- Relationship to Partner reports
- Real examples

If missing:

- Do not invent
- Produce accounting gap analysis
- Produce client questionnaire
- Produce target accounting mapping gaps only; do not map legacy POC sample data
- Stop

### Architecture when approved

Accounting Entry must reference approved combinations of:

- Partner
- Project
- Activity
- Operation
- Documents
- Dates
- Amounts
- Accounts or budget classifications
- Creator
- Validator
- Status
- Audit

Requirements:

- Stable identifiers
- Controlled correction or reversal
- No hard deletion of posted entries
- Transactional audit
- XOF unless scope changes
- Structured exports
- Report snapshot compatibility

Do not automatically create entries from Montant dépensé without explicit client approval.

### Reconciliation

Implement only approved rules for:

- Operational versus accounting totals
- Partial accounting
- Timing differences
- Cancelled Operations
- Adjustments
- Reversals
- Closed periods
- Missing documents

### Tests

Cover full accounting journeys, reconciliation and permissions.

### Deliverables

```text
docs/mjl-phase-5-accounting-gap-analysis.md
docs/mjl-phase-5-accounting-plan.md
docs/mjl-accounting-data-mapping.md
```

When implemented:

```text
docs/mjl-phase-5-accounting-report.md
```

### Verdict

```text
PHASE_5_READY
PHASE_5_READY_WITH_NOTES
PHASE_5_BLOCKED_CLIENT_INPUT
PHASE_5_BLOCKED_TECHNICAL
```

Stop after Phase 5.

---

# Phase 6 Prompt: Official Partner Financial Reports, Template Gate

## Goal

Implement official UNICEF and Coopération Suisse financial reports only after approved real templates and mappings are available.

Use normal execution mode.

## Prompt for Codex

You are working in the MJL repository after required core, document and accounting phases.

Implement or assess Phase 6: Official Partner Financial Reports.

### Mandatory template check

Verify approved current templates for:

- UNICEF
- Coopération Suisse

Verify decisions for:

- Reporting periods
- Fields
- Accounting dependencies
- Document dependencies
- Grouping
- Formulas
- Sign conventions
- Zero rules
- Missing-data rules
- Currency
- Signatures
- Approval
- Excel
- PDF
- Template versions
- Regeneration
- Immutability

If missing:

- Do not generate a generic report and call it official
- Do not guess mappings
- Produce template inventory
- Produce mapping gap analysis
- Produce focused questionnaire
- Stop

### Template analysis

For each template identify:

- Sheets or sections
- Fixed labels
- Inputs
- Calculations
- Totals
- Source fields
- Missing fields
- Accounting dependencies
- Document dependencies
- Print requirements
- Approval requirements

Require approved mapping before coding.

### Architecture

```text
Validated application data
    -> Partner-specific mapping
        -> Versioned Partner template
            -> Excel and PDF
                -> Immutable report snapshot
```

Snapshot includes:

- Report identifier
- Partner
- Project
- Period
- Template version
- Included Activities
- Included Operations
- Included accounting entries
- Included document references
- Generated values
- Generator
- Generation timestamp
- As-of timestamp
- Approval status
- Immutable file reference or checksum

A later rename, correction or template update must not silently alter an approved report.

### Data-quality gate

Validate:

- Missing spending
- Financial incompleteness
- Unbalanced data
- Missing accounting
- Missing documents
- Cancelled records
- Period boundaries
- Duplicate inclusion
- Partner mapping
- Currency
- Approval state

Produce a clear blocking report.

### Output integrity

- Keep Excel values numeric
- Preserve required formulas
- Use F CFA
- Apply approved zero display
- Preserve print areas
- Generate controlled PDF
- Store snapshot
- Audit generation, approval, regeneration and download

### Tests

For each Partner:

- Known data to known totals
- Template structure
- Period boundaries
- Missing-data blocking
- Cancelled data
- Zero versus missing
- Versioning
- Snapshot immutability
- Numeric Excel cells
- PDF
- Permissions
- Audit

### Deliverables

```text
docs/mjl-phase-6-template-inventory.md
docs/mjl-phase-6-mapping-gap-analysis.md
docs/mjl-phase-6-report-plan.md
```

When implemented:

```text
docs/mjl-unicef-report-mapping.md
docs/mjl-cooperation-suisse-report-mapping.md
docs/mjl-phase-6-report-report.md
```

### Verdict

```text
PHASE_6_READY
PHASE_6_READY_WITH_NOTES
PHASE_6_BLOCKED_CLIENT_INPUT
PHASE_6_BLOCKED_TECHNICAL
```

Stop after Phase 6.

---

# Final Phase Discipline

Recommended rollback boundaries:

```text
Phase 0 audit commit
Phase 1 foundation commit
Phase 2 planning and validation commit
Phase 3A execution commit
Phase 3B monitoring commit
Phase 3C readiness commit
Phase 4 document commit
Phase 5 accounting commit
Phase 6 report commit
```

Recommended current sequence:

```text
Phase 0
-> human review and reset approval
-> Phase 1
-> review
-> Phase 2
-> review
-> Phase 3A
-> review
-> Phase 3B
-> review
-> Phase 3C
-> client and project-owner go-live scope decision
```

Phases 4, 5 and 6 are gated by client material.

The application must not go live until the client and project owner explicitly decide which gated phases are mandatory before launch.

No Codex verdict replaces that decision.
