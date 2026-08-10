# MJL Domain Language

This glossary defines the ubiquitous language for the post-cadrage MJL
application. Target rules live in the canonical v2 documents.

## Portfolio

**Partenaire**:
Organization that agrees and supports Activities through one or more Projects.
_Avoid_: Partenaire / Programme, Tiers in normal user-facing language, PTF as a generic application entity

**Projet**:
Stable MJL project belonging to one Partenaire and containing Activities.
_Avoid_: Programme as a generic entity, native Dolibarr project screen as the normal MJL experience

**Activité**:
Planned and validated body of work under one Project, composed of Opérations.
_Avoid_: Task, Dépense as a substitute for execution

**Opération**:
Planned unit of Activity execution with a type, authorized amount, spent
amount, observation, and execution status.
_Avoid_: Expense as the core execution unit

**Type d'Opération**:
Active or inactive reference classification selected for an Opération.
_Avoid_: Invented accounting, budget, or document categories

## Planning and review

**Montant autorisé**:
Single Activity budget concept balanced by the authorized amounts of its
Opérations.
_Avoid_: Montant final

**Révision métier**:
Immutable snapshot created when an Activity is submitted or resubmitted for
review.
_Avoid_: Mutable validation payload, draft history as a submitted revision

**Contributeur de révision**:
User who created or structurally modified information contained in a submitted
business revision.
_Avoid_: Role-only separation of duties

**Prévalidation**:
Supervisor decision accepting one exact submitted revision before definitive
validation.
_Avoid_: Generic validation, direct structural correction by the reviewer

**Validation définitive**:
Validator decision approving the same exact revision that was prevalidated.
_Avoid_: Admin approval, disbursement, payment

**Retour en correction**:
Reasoned review decision requiring an assigned Agent to change and resubmit
the Activity.
_Avoid_: Silent return to draft, reviewer editing

## Assignment and access

**Agent principal**:
Current assigned Agent used for coordination and display, without exclusive
editing permission.
_Avoid_: Owner with exclusive business rights

**Agent additionnel**:
Currently assigned Agent with the same authorized Activity editing and
submission capabilities as the primary Agent.
_Avoid_: Partner-scoped user assignment

**Agent superviseur et prévalidateur**:
Independent business reviewer who can view all Activities, request correction,
and prevalidate.
_Avoid_: Agent vérificateur as a user-facing label, N1, N2

**Validateur définitif**:
Business superuser who manages reference data and assignments, performs final
validation, and decides cancellation and reopening requests.
_Avoid_: Admin, DPAF as an application role

**Admin**:
Technical and audit role for access administration, diagnostics, audit export,
and controlled recovery.
_Avoid_: Business superuser, reviewer, reference-data manager

## Execution

**Montant dépensé**:
Explicit XOF amount entered for an Opération after definitive validation; it
may be null or explicitly zero.
_Avoid_: Inferring zero from missing information

**Écart**:
Difference between an Opération's spent amount and authorized amount.
_Avoid_: Missing value presented as zero

**Complétude financière**:
Derived indication of whether relevant Opérations have explicit spent amounts.
_Avoid_: Activity execution status, cancellation as proof of completeness

**Statut d'exécution de l'Activité**:
Derived operational state calculated from validation, dates, cancellation,
and Opération terminal states.
_Avoid_: Validation status, manually edited Activity execution status

## Exception workflows

**Demande d'annulation**:
Version-bound request by an assigned Agent for a Validator decision that may
make an Activity or Opération terminal.
_Avoid_: Direct deletion, silent budget rewrite

**Demande de réouverture**:
Version-bound request to return a completed Opération to in-progress execution
after Validator approval.
_Avoid_: Direct edit of a completed Opération, reopening a cancelled Opération

## Evidence and reporting

**Audit structure**:
Append-only immutable record of committed business and technical actions.
_Avoid_: Editable log, keystroke history, secret storage

**Chronologie d'Activité**:
Human-readable linear presentation of Activity, Opération, revision, request,
assignment, and status events.
_Avoid_: Raw audit payload as the primary user experience

**Export opérationnel**:
Audited PDF, XLSX, or supplemental CSV generated from authorized application
data and filters.
_Avoid_: Official Partner report without an approved template

**Rapport officiel Partenaire**:
Partner-specific output generated from an approved versioned template and
preserved as an immutable snapshot.
_Avoid_: Generic operational export labeled official
