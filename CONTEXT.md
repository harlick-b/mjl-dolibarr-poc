# MJL Domain Language

## Rebuild scope (DEC-091)

This glossary retains business meaning under the PTA brief. React/FastAPI and
PostgreSQL replace Dolibarr as the future technical foundation; native object,
Admin-reset, ECM and tenant implementation terms below describe the retained POC.
The new database imports no sample data or native accounts. A guarded first Admin
will be separately provisioned. Document series/version-engine terminology below
is historical Phase 4 planning only: the rebuild needs optional private contextual
evidence, not a generic document lifecycle. DEC-092 authorizes only the technical
React/FastAPI/PostgreSQL foundation; business implementation remains deferred.

This glossary defines the ubiquitous language for the post-cadrage MJL
application. The approved PTA brief and DEC-087/088 supersede conflicting
pre-PTA definitions. Remaining exception/document details follow the authority
router and are reconciled before their implementation slice.

## Portfolio

**Partenaire**:
Organization supporting Activities through current and past Projects, with at
most one active Project. Deactivation effects on unfinished work remain to be
settled for the PTA lifecycle.
_Avoid_: Partenaire / Programme, Tiers in normal user-facing language, PTF as a generic application entity

**Projet**:
Stable MJL project belonging to one Partenaire and containing annual PTAs.
A Partner has at most one active Project; past Projects remain consultable.
A Project cannot close while Activities or required financial steps are unfinished.
Its internal identity, generated technical reference, and original Partenaire
are immutable; only its display name and controlled lifecycle may change.
_Avoid_: Programme as a generic entity, native Dolibarr project screen as the normal MJL experience

**PTA (Plan de travail annuel)**:
Annual planning collection for one Project and one calendar year, with
independent per-Activity review and approval, created automatically when an
Agent first plans an Activity for that Project/year.
_Avoid_: Whole-PTA approval blocking all Activities

**Activité**:
Planned body of work belonging to the PTA of its planned start year, composed
of Opérations and revised through controlled approval.
_Avoid_: Task, Dépense as a substitute for execution

**Opération**:
Planned unit of Activity execution with a type, authorized amount, spent
amount, observation, and execution status.
_Avoid_: Expense as the core execution unit

**Type d'Opération**:
Active or inactive reference classification selected for an Opération.
It has an entity-scoped immutable identity and cannot be hard-deleted through
MJL.
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
Reasoned review decision requiring an Agent to change and resubmit
the Activity.
_Avoid_: Silent return to draft, reviewer editing

**Abandon d’Activité**:
Reasoned disposition of an unsubmitted draft by an Agent, distinct from formal
withdrawal of an Activity with administrative history.
_Avoid_: Annulation, deletion, post-submission cancellation

**Restauration de brouillon**:
Return of an abandoned draft to editable planning; the pre-PTA restoration
procedure requires reconciliation with the approved PTA lifecycle.
_Avoid_: Reopening a submitted or definitively validated Activity

## Assignment and access

**Agent principal**:
Current assigned Agent used for coordination and display, without exclusive
editing permission.
_Avoid_: Owner with exclusive business rights

**Agent additionnel**:
Agent designated for coordination and notifications; every Agent has the same
PTA/Activity visibility and editing rights subject to workflow state.
_Avoid_: Partner-scoped user assignment

**Agent superviseur et prévalidateur**:
Independent business reviewer who can view all Activities, request correction,
and prevalidate.
_Avoid_: Agent vérificateur as a user-facing label, N1, N2

**Validateur définitif**:
Business reviewer who creates/closes Projects, manages reference data and
assignments, and performs final planning and administrative request approval.
_Avoid_: Admin, DPAF as an application role

**Admin**:
Technical and audit role for access administration, diagnostics, audit export,
and controlled recovery.
_Avoid_: Business superuser, reviewer, reference-data manager

## Execution

**Montant dépensé**:
Explicit final spending declared per Opération; the Activity amount is the sum
of its complete final Operation values. Missing information differs from zero.
_Avoid_: Approved expense-ledger sum, inferring zero from missing information

**Autorisation financière pour insuffisance budgétaire**:
Separate Agent request approved by the Superviseur then the Validateur,
required alongside an approved PTA budget revision before décaissement starts.
_Avoid_: Décaissement approval, virement approval

**Demande d'autorisation de décaissement**:
Agent administrative request for finalized actual spending, approved first by
the Superviseur and then the Validateur définitif.
_Avoid_: Full-allocation request, execution of a bank payment

**Demande de virement**:
Separate administrative request for the actual amount, with the same two-stage
approval; distinct from confirmation of the external transfer.
_Avoid_: Bank instruction, irreversible one-request-ever rule

**Confirmation de virement**:
Agent declaration of the actual external transfer amount and date, with optional
supporting evidence.
_Avoid_: Independent bank verification by MJL

**Reversement**:
External return to the Partner of unused authorized budget. The required amount
is distinct from the amount actually declared returned.
_Avoid_: Reallocation to another Activity, in-app payment, inferred completion

**Clôture de l'Activité**:
Direct Agent action after physical completion, final spending and all required
administrative settlement checks; only closed Activities count as realized.
_Avoid_: Extra closure approval, automatic closure from Operation completion

**Écart**:
Difference between an Opération's spent amount and authorized amount.
_Avoid_: Missing value presented as zero

**Complétude financière**:
Derived indication of whether relevant Opérations have explicit spent amounts.
_Avoid_: Activity execution status, cancellation as proof of completeness

**Réalisation d'activités**:
Execution of approved scheduled PTA Activities, including final spending and
administrative settlement leading to explicit closure.
_Avoid_: Independent executable Activity creation, planning approval status

**Révision du PTA**:
Formal change to affected Activity content, allocation, dates or inclusion,
requiring fresh two-stage approval while retaining earlier approved history.
Execution of the affected Activity pauses while the change awaits approval;
unaffected approved Activities continue.
_Avoid_: Silent overwrite of approved values, approval of all Activities together

**Transfert entre PTAs**:
Audited change of annual attribution when an approved postponement changes the
Activity's planned start year.
_Avoid_: Moving history silently, attribution by end year

**Identité Partenaire**:
Admin-invited read-only identity linked to exactly one Partner, for consultation
of that Partner's authorized records.
_Avoid_: Internal business role, multi-role switch, public registration

## Exception workflows

**Retrait d'Activité du PTA**:
Formal revision withdrawing an Activity through Supervisor and Validator review
while preserving approved history and recorded administrative actions.
_Avoid_: Validator-only cancellation, deletion

**Annulation / réouverture d'Opération**:
Existing exception concepts whose future treatment requires reconciliation with
PTA revisions and settlement; no right to change settled amounts is implied.
_Avoid_: Preserving the pre-PTA approval procedure by default

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

## Contextual document evidence

**Document justificatif contextuel**:
Optional evidence tied to its PTA, Activity, revision, decision, request or
external declaration context and delivered only through guarded MJL routes.
_Avoid_: Partenaire attachment, public link, raw ECM document

**Catégorie documentaire**:
Entity-scoped classification of optional supporting evidence; its initial
values are client input and do not create submission or closure blockers.
_Avoid_: Type d'Opération, mutable requirement setting

**Série documentaire**:
Stable identity for one item of evidence, containing append-only immutable
versions and at most one current published version.
_Avoid_: Folder, replaceable file row

**Version documentaire**:
Immutable accepted file in a document series.
_Avoid_: Overwritten upload, editable original

**Retrait documentaire**:
Reasoned, audited, irreversible removal of a current version from current use,
without physical deletion of its historical evidence.
_Avoid_: Delete, restore as current, silent hide

## Local data lifecycle

**Administrateur technique conservé**:
The single native Dolibarr administrator account retained across the clean
local reset solely for platform administration and recovery.
_Avoid_: Migrated sample Admin, business superuser

**Données de démonstration persistantes**:
User-visible local sample records intended to demonstrate the completed
application; none exist until all implementation phases and the later dataset
specification are complete.
_Avoid_: Legacy POC seed, business-rule evidence

**Fixture de test jetable**:
Test-scoped data created only inside an isolated tenant and destroyed with that
tenant after verification.
_Avoid_: Shared sample database, persistent seed, production example

**Réinitialisation locale propre**:
Approved deletion of legacy sample data without mapping or migrating it into
the target model, while preserving the one technical administrator.
_Avoid_: Selective compatibility migration, old-to-new data mapping
