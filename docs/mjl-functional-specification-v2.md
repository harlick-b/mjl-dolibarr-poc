# MJL Functional Specification v2

Status: `AUTHORITATIVE_POST_CADRAGE`

This specification supersedes every conflicting earlier MJL assumption,
specification, schema, route, permission, workflow, test, and implementation
choice. The application is not live. Backward compatibility is not required.

The application must never infer that missing financial information equals zero, and must never allow a validated financial structure to be silently modified.

## 1. Business Context and Application Boundary

The client is MJL/DPAF. `DPAF` in this sentence identifies the organization,
not an application role.

The broader manual process includes planning, implementation, accounting
treatment, supporting documents, accounting entries, accountability, and
official Partner financial reporting. Core application scope starts only when
an Activity has already been agreed with the Partner.

Core scope includes Partner and Project reference data, Activity and Opération
planning, staged validation, correction cycles, Agent assignments, execution,
authorized and spent amounts, lifecycles, audit, dashboards, monitoring,
operational PDF/XLSX, and supplemental audited CSV.

Core scope excludes PTA negotiation, fund requests, receipt of funds, TDR
approval, Partner authorization messages, e-Tresor payment processing, bank
reconciliation, and external audit execution.

Document containment remains active until the approved Phase 4 implementation
reaches its roadmap position after Phases 2 through 3C.
Accounting waits for approved rules and examples. Official Partner reporting
waits for approved templates and mappings.

## 2. Product Reset

- Do not preserve obsolete logic merely because it exists.
- Do not add compatibility adapters unless explicitly approved.
- Prefer clean authoritative structures and an approved clean reset when safer.
- Phase 0 executes no reset, migration, deletion, permission change, seed
  change, or new behavior.
- Conflicting documentation is superseded or classified as non-authoritative.

## 2A. Clean Local Data Strategy

The existing local tenant is disposable POC evidence, not a migration source.
After an exact checksum-approved deletion appendix is reviewed, all existing
sample users except one preserved native technical administrator, and all
sample role assignments, Partners, Projects, Activities, finance objects,
audit/log records, invitations, tokens, reports, and documents are deleted.
No existing record is mapped, transformed, inactivated for compatibility, or
used to seed a target record.

Target tables and services begin empty. Persistent sample/demo data remains
absent until all implementation phases are complete and a later dataset
specification is approved. Tests may create only disposable test-scoped
fixtures inside isolated tenants; teardown must remove the tenant and its data.
Neither legacy sample data nor disposable fixtures define business rules.

## 3. Authoritative Hierarchy

```text
Partenaire
    -> Projet
        -> Activité
            -> Opérations
```

One Partenaire supports several Projects. `Projet` is the generic user-facing
entity name. Existing UNICEF, Coopération Suisse, and Project rows are legacy
sample data and are deleted without migration. No replacement record is
created until entered through the finished target application or defined by
the post-all-phases dataset specification.

## 4. Roles and Exclusivity

Each target user has one effective role: Agent, Supervisor, Validator, or Admin. Role
combinations are forbidden. Native Dolibarr admin status implies Admin and
cannot coexist with an active business role.

The clean local reset preserves exactly one native technical administrator.
No existing sample user's role assignment is migrated.

The Validator is the business superuser. Admin is technical and audit-only,
apart from the narrowly approved Phase 4 read-only document exception within
the runtime active Dolibarr entity (`$conf->entity`).
Admin may invite users, assign one role, activate/deactivate accounts, access
technical administration and complete audit, export audit, and perform
controlled audited recovery. Admin may not create business decisions, review
or validate Activities, revise budgets, manage business reference data,
modify execution data, or decide cancellation/reopening requests.

The Validator manages Partners, Projects, Opération types, Activity
assignments, final review, amount-correction requests, cancellation and
reopening decisions, complete audit, and audit export.

## 5. Role Changes

- A role change never leaves two effective roles.
- An Agent must have all current Activity assignments removed or transferred
  before changing role.
- Historical assignments and role records remain attributable.
- Active sessions are invalidated or refreshed and authorization is
  re-evaluated immediately.
- Historical revision-contributor restrictions survive role changes.

## 6. Visibility and Assignments

An Agent sees only currently assigned Activities. Each Activity has one
creator, one primary Agent, and optional additional Agents. The creator becomes
primary automatically. Primary is display and coordination metadata only.
Every assigned Agent may perform authorized edits, corrections, submissions,
and execution updates, with actions attributed to the actual actor.

Only the Validator changes assignments. Removal revokes direct URL, read,
edit, and open-form save access immediately. Historical evidence remains.

Supervisor and Validator view all Activities. Admin receives no normal
business workflow buttons and accesses business evidence through audit or
controlled recovery. In Phase 4 only, Admin may browse metadata and use
guarded download or preview for current documents in the runtime active entity;
historical access remains controlled recovery. Partner-based user scope is not
target authorization.
The Supervisor cannot manage assignments or access complete audit in the first
release. Agents and Supervisors see only current workflow messages needed for
their task. The Validator cannot directly modify Agent-entered execution data.

## 7. Partner, Project, and Opération Types

Partners, Projects, and Opération types have stable identifiers plus active or
inactive state. Referenced records cannot be hard-deleted. Inactive records
remain historical but cannot be selected for new work.

When choosing a Partner for an Activity:

- one active Project is selected automatically and displayed read-only;
- several active Projects require selection;
- no active Project blocks submission.

Only the Validator manages business reference data. The final Opération-type
classification is not invented. Admin may support a technical import without
defining business classifications.

## 8. Activity Creation

Activity creation uses a dedicated full page, not a legacy inline form. It
contains general information, planning, Opérations, and verification.

Required planning data is Partner, Project, name, description, start date, end
date, and proposed authorized amount. Each Opération has a name, type, and
authorized amount. Verification displays the Activity amount, Opération sum,
difference to allocate, blocking errors, and submission action. Submission
requires at least one Opération.

## 9. Authorized Amounts

There is one Activity budget concept: `Montant autorisé`. Before final
validation it is proposed; after final validation it is validated. Do not use
`Montant final`.

The initial proposed amount is the first submitted revision amount. Draft
changes before first submission do not redefine it. The current validated
amount comes from the latest definitively validated revision. Pending
proposals never enter validated totals.

Activity `Montant dépensé` is calculated exclusively from explicit Opération
`Montant dépensé` values. Missing Opération spending is never converted to
zero for this calculation.

Every Opération authorized amount is strictly greater than zero. Submission
and resubmission require exact equality between the Activity amount and the
sum of Opération authorized amounts. Cancellation preserves the approved
amount. A real budget reduction or reallocation is a structural revision.

## 10. Business Revision Snapshots

Every submission or resubmission creates an immutable numbered revision with:

- Activity, Partner, Project, name, description, dates, and proposed amount;
- the complete Opération list, types, and authorized amounts;
- assigned Agents at submission time;
- submitter and timestamp;
- revision contributors;
- a content hash or equivalent integrity reference where practical.

Every review decision names the exact revision. Structural edits result in a
new revision on submission. Prior prévalidation never applies to a new
structural revision. Final validation requires the current revision to be
prevalidated by a different eligible identity. Stale review fails safely. The
review UI clearly displays the exact revision being reviewed. Every review and
its audit event records that revision number.

Assignment-only changes are audited and may appear in snapshots, but do not
automatically invalidate a prevalidated financial revision.

## 11. Separation of Duties

For one revision, its creator and every structural contributor cannot
prevalidate or definitively validate it. Its prevalidator cannot definitively
validate it. Role exclusivity alone is insufficient. Identity restrictions
survive later role changes.

No self-disbursement is allowed if a later approved module reintroduces a
disbursement action. No audited override is designed or authorized.

## 12. Validation Workflow

Semantic Activity validation states are:

- Brouillon;
- Soumise pour prévalidation;
- Retournée en correction par le Superviseur;
- Prévalidée, en attente de validation définitive;
- Retournée en correction par le Validateur définitif;
- Validée définitivement;
- Annulée.

Main flow is `Brouillon` to `Soumise pour prévalidation` to `Prévalidée, en
attente de validation définitive` to `Validée définitivement`.
Supervisor and Validator returns require a reason. Reviewers do not directly
edit structural data. A returned Activity preserves the origin and reason.
After a Validator return, the new revision requires new prévalidation.

## 13. Authorized Amount Revision

Before Activity start, the Validator may request a different proposed amount
only by returning the Activity with requested amount and reason. An assigned
Agent changes the Activity and Opérations, restores exact balance, submits a
new revision, obtains new prévalidation, and then final validation. Every
submitted amount remains historical.

## 14. Late Validation and Start Freeze

Definitive validation is expected before the start date. Execution cannot
begin before it. Proactive monitoring and alerts warn before the start date.
At or after the start date, structural editing is prohibited.
An unchanged already-submitted revision may complete pending review. If review
requires structural correction, the Activity must be cancelled and recreated
in the first release. Cancellation and recreation remain separate audited
records. There is no hidden copy or bypass.

Before start, any post-validation structural change requires the complete
correction, submission, prevalidation, and definitive-validation cycle.
Structure includes Partner, Project, dates, Activity amount, Opération list,
Opération types, and Opération authorized amounts. Backend guards enforce the
freeze independently of UI state.

## 15. Opération Execution Data

Spent amount starts null and may be explicitly zero. Only currently assigned
Agents update spent amount, Opération status, and execution observation.
Supervisor and Validator consult but do not edit. Every committed change is
audited and protected against stale writes.

## 16. Financial Calculation and Display

```text
Écart = Montant dépensé - Montant autorisé
Variance % = ((Montant dépensé - Montant autorisé) / Montant autorisé) * 100
```

Variance displays two decimals. Valid calculated zero displays `-`. Positive
values include `+`; negative values include `-`. Missing spent amount displays
`Non renseigné`. The symbol `-` never means missing information. Observation
is required when spent differs from authorized.

XLSX keeps amounts, zero, and percentages numeric, using number formats for
display. PDF follows the human display rules. CSV remains numeric where
declared numeric and follows its supplemental export contract.

## 17. Currency

The first release supports XOF only, without a currency selector. Money uses
integer-safe values and never binary floating point. Display is French and
uses `F CFA`, for example `1 500 000 F CFA`.

## 18. Opération Lifecycle

Opération states are À faire, En cours, Terminée, and Annulée. Completion is
forbidden while spent amount is null. Explicit zero permits completion only
with an observation because it differs from the positive authorized amount.
A completed Opération is locked. A cancelled Opération cannot reopen in the
first release.

## 19. Cancellation Requests

Before first Activity submission, an assigned Agent may remove a draft
Opération. Afterwards, cancellation requires a structured request. An
assigned Agent requests or withdraws; only the Validator approves or rejects.
One pending request is allowed per target. Requests record target type and ID,
target revision/version, requester, reason, dates, reviewer, decision, and
decision reason. Request states are PENDING, APPROVED, REJECTED, and WITHDRAWN.
Reasons are mandatory. Approval fails if the target changed. Before deciding,
the reviewer sees both the requested target version and the current target
version. Target status changes only after approval.

Opération cancellation preserves authorized amount, spent amount, observation,
and audit. An Opération with spent amount greater than zero may be cancelled.
Spending remains in historical and actual totals. Null stays null and may be
displayed as `Opération annulée, situation financière non renseignée`.

Approved Activity cancellation is one transaction: cancel the Activity,
cancel unfinished Opérations, keep completed Opérations completed, preserve
all amounts, and audit every consequence. If every Opération is cancelled, the
Activity is cancelled, not completed.

## 20. Completed Opération Reopening

An assigned Agent may request reopening of a completed Opération. Only the
Validator approves or rejects. One pending request is allowed. The requester
may withdraw. Approval fails on version change and, when approved, returns the
Opération to `En cours`, after which assigned Agents may edit execution.
Activity status is recalculated. Cancelled Opérations cannot reopen. Every event is audited.
Reopening requests use PENDING, APPROVED, REJECTED, and WITHDRAWN states and
store Opération, target version, requester, reason/date, reviewer, decision,
decision reason/date, and withdrawal date.

## 21. Activity Execution Status

Validation status and execution status are separate. Before definitive
validation, display `Exécution non démarrée`. After validation, calculate in
Africa/Porto-Novo with inclusive end date and this precedence:

1. explicitly cancelled Activity: Annulée;
2. all Opérations cancelled: Annulée;
3. all Opérations terminal and at least one completed: Terminée;
4. unfinished Opération after inclusive end date: En retard;
5. future start date: À venir;
6. otherwise: En cours.

Terminée and Annulée are terminal Opération states. An unfinished Opération
prevents Activity completion.

## 22. Execution Status Events

Use one deterministic calculation source, idempotent scheduled reconciliation
in Africa/Porto-Novo, one first-transition audit event for date changes,
transactional Opération-driven events, and defensive UI recalculation. Repeated
jobs never duplicate transition events.

## 23. Financial Completeness

Financial completeness is separate from validation and execution status:

- Non démarrée: no relevant Opération has explicit spent amount;
- Partiellement renseignée: some but not all do;
- Complète: all relevant Opérations do.

A cancelled Opération with null spent amount remains incomplete. Terminal
Activity status never implies financial completeness.

## 24. Audit Integrity

Keep structured immutable audit data and human-readable Activity chronology.
Every audited mutation and its audit event succeed or fail in one transaction.
Application code cannot update or delete audit events.

Audit records include applicable object identifiers, revision, actor identity,
actor-name and role snapshots, timestamp, action, previous/new values, reason,
states before/after, target version, and result. Never record passwords,
invitation secrets, sessions, raw tokens, or sensitive configuration.

Audit committed actions, not keystrokes or form openings. Chronology includes
creation, Opérations, submission, revision, correction, edits, review,
assignment, execution, requests, automatic transitions, recovery, and export.
Complete audit is limited to Validator and Admin.

## 25. Export Integrity

Every export includes a practical identifier, generator, generation time,
as-of time, applied filters, and relevant Activity or Partner scope. Record the
audit event only after successful generation.

PDF and XLSX are required operational formats. CSV is supplemental, audited,
UTF-8 BOM, semicolon-separated, French-headed, and stable in filename. XLSX
keeps numeric values numeric. Phase 6 official reports become immutable
snapshots and are never inferred from generic operational exports.

## 26. Dashboard Rules

Dashboards never mix pending proposals, validated amounts, active authorized
amounts, cancelled authorized amounts, active spending, cancelled spending, or
missing spending. At minimum expose initial proposal, current validated amount,
active validated authorization, cancelled authorization, active spending,
cancelled spending, missing spent count, and cancelled incomplete count.
Pending proposals are labeled and excluded from validated totals.

## 27. User Experience

Use the approved v3 visual system within v2 business rules. Use full pages,
dedicated details, controlled drawers/dialogs, expandable read-only Opération
tables, and explicit actions. Do not use uncontrolled inline editing. Feedback
is concise and French-first, for example `Activité XXX créée avec succès`,
`Activité XXX soumise pour prévalidation`, `Correction demandée pour
l’Activité XXX`, `Activité XXX prévalidée`, and `Activité XXX validée
définitivement`. Do not use the em dash character in MJL prompts,
labels, comments, documentation, or generated reports.
Do not replace concise feedback with long explanatory alerts.

## 28. Concurrency

Use optimistic locking or equivalent version checks for Activity structure,
Opération planning/execution, review decisions, cancellation, reopening, and
assignments. A stale action fails safely and never overwrites committed work.

## 29. Testing Strategy

Test complete journeys, permissions, calculations, and transitions. Use
focused unit/integration coverage for money, variance, status, revision
matching, permissions, separation of duties, transitions, and transactional
audit. Use E2E for creation, balancing, correction, validation, assignment,
execution, requests, access removal, audit, dashboards, and exports. Do not
freeze wording or create one micro-test per field. Run the smallest relevant
set during implementation and the full relevant core regression at phase
gates. Report unrelated pre-existing failures separately. Never hide failures.

## 30. Execution Discipline

For each later phase: read every canonical v2 document, inspect current code,
identify conflicts, plan briefly, execute only that phase, perform only
approved reset actions, update canon, test the changed behavior, report exact
results, emit the required verdict, and stop. Repository contradictions that
affect correctness block implementation.

Every phase report records scope, changed files, schema/migration impact,
destructive actions, permissions, business rules, tests and results, UI
evidence where applicable, known limitations, deferred decisions, and the
explicit phase verdict.

## 31. Approved Phase 4 Document Strategy

Phase 4 is approved as a future contextual supporting-evidence module. It may
start only after Phases 2, 3A, 3B, and 3C supply the parent objects, revisions,
workflow states, assignments, audit, security, and operational controls it
depends on. Approval does not authorize implementation out of sequence.

A document attaches to exactly one Projet, Activité, or Opération. The global
document library is read-only and authorization-scoped; every mutation begins
from an authorized parent context. There is no Partner attachment, public
share, raw native ECM link, public register, bulk document operation, or
physical delete.

The Validateur définitif manages an entity-scoped category catalog. The
catalog starts empty and every configured category applies to all three parent
types. A stable category identity is never deleted. Activation, deactivation,
label, and requirement changes append a monotonic immutable
Category Rule Revision containing the label, active state, every parent
applicability rule fixed to Projet, Activité, and Opération, requirement mode,
effective timestamp, actor, canonical payload, and payload hash. A category may be optional, required for an
Activité, or required once for each planned Opération. Requirement changes are
prospective.

Drafts do not freeze category rules. Submission atomically selects exactly one
committed effective Category Rule Revision per applicable requirement and
creates an immutable snapshot containing its stable category identifier,
revision identifier and number, complete canonical payload and payload hash,
and the qualifying document series and version identifiers used for review.
Correction and resubmission use the then-current rules and create a new
immutable snapshot. Submitted, prevalidated, and finalized reviews always use
the frozen snapshot, never the current catalog view. A concurrent rule change
either leaves submission with one coherent committed revision or causes a
retryable stale-submission conflict without a partial snapshot.

Each parent/category combination may contain multiple document series. A
series receives append-only versions. At least one qualifying current series
satisfies a requirement. Immutable content/storage/scan metadata is separate
from append-only per-series lifecycle events. Publication appends `PUBLISHED`;
replacement publishes a new version and atomically appends `SUPERSEDED` for the
prior current version; reasoned withdrawal appends irreversible `WITHDRAWN`.
No transition deletes metadata, bytes, history, or audit evidence. A
per-series sequence and lock or optimistic version makes concurrent publish
and withdrawal operations select one order; a loser receives a retryable
conflict. The effective current version is a rebuildable lifecycle projection,
not authoritative mutable version metadata, and at most one version per series
is current. Each lifecycle event and its audit event commit in the same
transaction.

Every identity that uploaded a qualifying document version included in a
submitted revision is a contributor to that revision and cannot prevalidate or
definitively validate it. The Agent manages evidence for assigned Activités
and their Opérations. The Validator may add separate evidence everywhere but cannot replace or
withdraw Agent evidence. The Supervisor is read-only. Admin may list metadata,
guardedly download, and guardedly preview current documents only in the runtime
active Dolibarr entity (`$conf->entity`). Admin may not upload, append, replace,
withdraw, categorize, review, validate, or use raw/native ECM delivery.
Historical recovery is limited to Validator and Admin within that same active
entity, requires a reason, and creates a separate recovery audit event for
either role. Cross-entity identifiers are denied for every role, including
Admin. Permitted platform entity switching changes the active scope but never
provides cross-entity aggregation.

Submission locks the exact qualifying versions used by that revision and all
evidence is immutable during submitted or prevalidated review. An Activité
locks its current evidence after definitive validation. Post-validation
Opération evidence remains open until the Opération becomes terminal; an
approved reopening unlocks future append-only evidence entry. Historical
versions remain immutable.

The custom MJL document model is authoritative and sits behind one deep
contextual interface: callers provide an authorized parent context and a
document intent, while the module owns validation, permissions, lifecycle,
storage, quota, ECM linkage, and audit. Scoped reads and one-time preview-grant
issuance use the same policy seam. Native ECM is an internal adapter, never a
caller-facing authorization or delivery interface. Accepted uploads are PDF,
JPEG, and PNG up to 20 MiB.
Validation checks decoded extension, detected MIME type, file signature,
structure, image dimensions, and PDF complexity; encrypted PDFs, JavaScript,
embedded files, launch actions, malformed content, and decompression or
resource bombs are rejected. A synchronous local malware scan is mandatory.
Scanner failures and timeouts fail closed, and signatures may be at most 24
hours old. Plaintext quarantine is outside the web root and failed or rejected
temporary bytes are removed.

Stored objects are extensionless, outside the web root, and encrypted per file
using authenticated streaming encryption with a random data-encryption key
wrapped by a permanent environment key. The effective key is never logged or
persisted. Key rotation is not part of the approved first implementation.
Limits are 10 upload attempts per user per 10 minutes and 10 GiB per Dolibarr
entity, counting every retained current, superseded, or withdrawn ciphertext
version. Exactly one published document version maps to one entity-matched
native ECM row and one immutable ciphertext file.

The encrypted file is durably staged before a database transaction commits
custom metadata, the ECM row, immutable audit, and quota effects together.
The operation remains recoverable through reconciliation for interrupted
storage work.
Reservations and a unique-current constraint prevent concurrent quota and
replacement races. A failed metadata commit removes its unreachable staged
file; reconciliation detects every orphan, missing file, hash mismatch, and
cross-entity adapter link.

Downloads are audited, attachment-only, `no-store`, `nosniff`, and authorized
immediately before streaming bytes. Preview uses a separate HTTPS
registrable origin with no application cookies. A one-time opaque grant is
exchanged only by POST for a one-minute `Secure`, `HttpOnly`, host-only,
`SameSite=Strict` preview cookie, followed by redirect to a token-free URL.
Preview decrypts only into bounded preview-only tmpfs and supports guarded
range requests. The origin has no CORS, external resources, token logging, or
native ECM delivery. The approved first implementation
accepts that deactivation, assignment removal, replacement, or withdrawal does
not invalidate an already issued preview cookie for up to one minute. It also
accepts a permanent environment wrapping
key without rotation and browser-side original rendering after server-side
scanning. These residual risks must remain explicit in readiness evidence.

Production remains blocked until the isolated preview origin and TLS,
scanner/signature operations, key escrow, backup and restore, monitoring, and
legal retention obligations are implemented and verified.

Phase 4 module tests must cover category activation/versioning, prospective
requiredness, revision snapshots, contributor separation, lifecycle locks,
replacement and withdrawal, rate/quota concurrency, audit failure, encryption
integrity, and filesystem/database compensation. Disposable E2E matrices must
cover every role, assignment removal, cross-entity and cross-object IDs, stale
forms, CSRF, concurrent upload/replacement/submission, malicious filenames,
MIME and polyglot bypasses, EICAR, scanner outage and stale signatures, quota
exhaustion, encrypted restore, preview exchange/replay/range behavior, and
reasoned historical recovery.

Completion must prove native ECM remains blocked and no public hash bypasses
MJL delivery. It must reconcile filesystem, ECM, custom metadata, audit, quota,
and encrypted-content hashes after success, injected failures, rollback, and
backup/restore. The future Phase 4 execution report is separate from RST-010A,
and Phase 4 rollback returns to RST-010A containment, never legacy behavior.
Upload defenses follow the OWASP defense-in-depth file-upload guidance:
[OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## Phase 3C Non-go-live Boundary

Phase 3C hardens core and decides integration readiness only. Production launch
waits for the client and project owner to decide whether Phases 4, 5, and 6 are
mandatory before launch. No automated or Codex verdict replaces that decision.
