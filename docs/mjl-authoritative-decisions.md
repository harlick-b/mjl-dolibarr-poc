# MJL Authoritative Decisions

This file routes current MJL authority. Development is unfinished. Recorded
implementation, verification, readiness, and approval states are evidence only
and never imply current user acceptance.

## Authority order

1. The user's latest explicit instruction.
2. This authority router.
3. The canonical documents below for their assigned subjects.
4. Approved v3 design guidance for visual presentation only.
5. Gap analysis and current-state evidence.
6. Existing code and tests as current-state evidence only.

The latest user instruction supersedes every conflicting earlier project
decision, approval, plan, report, test convention, and skill procedure. Update
conflicting active guidance instead of applying an older rule. If canonical
documents still contradict each other after applying the latest instruction,
stop and surface the contradiction.

## PTA-6D safe Activity image-preview authorization (DEC-128)

The user instructed Codex to review PTA-6C, then audit and implement the next
smallest ready slice on 2026-11-02. The audit selected inline preview of already
verified JPEG/PNG Activity evidence for authorized internal business users.
[Plan 39](rebuild/39-pta6d-safe-image-preview-plan.md) is the bounded
implementation and independent-review contract. PDF remains download-only; the
slice adds no migration, table, converter, sanitizer, thumbnail service, Partner
access or production document infrastructure.

PTA-6D completed after current-role and parent-resource authorization, lifecycle
serialization, transactional preview-audit rollback, protected cancellable blob
loading, offline/authorization-loss handling, responsive Chromium checks and the
mandatory independent correction/re-review cycle. [Status 40](rebuild/40-pta6d-implementation-status.md)
records the evidence. PDF preview, document lifecycle changes, production
storage/scanning/retention and later slices remain deferred.

## PTA-6C audited global-history CSV authorization (DEC-127)

The user instructed Codex to review PTA-6B, then audit and implement the next
smallest ready slice on 2026-11-02. The bounded slice is the CSV action shown in
the approved global-history design for Validateurs définitifs and Admins.
[Plan 37](rebuild/37-pta6c-audit-csv-export-plan.md) is the implementation and
independent-review contract. It adds one audited synchronous POST and extends the
existing history screen without a migration, table, stored artifact, background
job or generic reporting framework.

PTA-6C completed after exact snapshot, authorization/CSRF, deterministic
deactivation race, sanitized formula-safe CSV, transactional audit rollback,
bounded-size, OpenAPI, frontend and Chromium checks plus the mandatory
independent correction/re-review cycle. [Status 38](rebuild/38-pta6c-implementation-status.md)
records the evidence. PDF/XLSX audit exports, Partner access and later slices
remain deferred.

## PTA-6B global audit history authorization (DEC-126)

The user instructed Codex to review the completed change, then audit and
implement the smallest ready next slice on 2026-11-02. The audit selected a
sanitized read-only global chronology for Validateur définitif and Admin from
the existing append-only audit evidence. [Plan 35](rebuild/35-pta6b-global-audit-history-plan.md)
is the bounded implementation and independent-review contract. It adds no
migration, mutation, raw audit JSON disclosure, Partner access, export engine or
generic reporting framework.

PTA-6B completed after signed-cursor, authorization, historical-actor,
sanitization, offline-cache, OpenAPI and browser checks plus the mandatory
independent correction/re-review cycle. [Status 36](rebuild/36-pta6b-implementation-status.md)
records the evidence. Global audit export, document preview and later slices
remain deferred.

## PTA-6A optional Activity attachments authorization (DEC-125)

The user instructed Codex to review PTA-5, then audit and implement the next
slice on 2026-11-02. The audit bounds that slice to optional Activity attachments
under the existing isolated synthetic-test gate. [Plan 33](rebuild/33-pta6a-activity-documents-plan.md)
is the implementation and independent-review contract. Partner disclosure,
safe inline preview, production scanner/storage/key custody, retention/deletion
and broader document contexts remain later decisions; the old complex ECM design
does not return.

PTA-6A completed on 2026-11-02 after bounded streaming, lifecycle and audit
rollback checks, migration regressions, the focused browser journey and the
mandatory independent correction/re-review cycle. [Status 34](rebuild/34-pta6a-implementation-status.md)
records the evidence.

## PTA-5 administrative reminders authorization (DEC-124)

The user instructed Codex to audit and implement the next slice and approved the
remaining reminder choices on 2026-11-02. MJL creates an in-app notification,
visible from the sidebar, and attempts email once for every assigned Agent 21
calendar days before the current approved Activity end date. A new assignment
receives the current cycle; an approved end-date change starts a new cycle while
history remains. Failed email has no automatic retry, and successful email is
never resent. Browser push is not required.

[Readiness and plan 31](rebuild/31-pta5-reminders-readiness-and-implementation-plan.md)
is the bounded implementation and mandatory independent-review contract. It adds
one focused reminder representation and dispatcher, not a generic notification
platform, queue, push service or production scheduler.
[Status 32](rebuild/32-pta5-implementation-status.md) records
`PTA_5_COMPLETE` after focused verification and independent correction/re-review.

## PTA-4B Activity Fiche authorization (DEC-122)

The user instructed Codex on 2026-11-02 to audit and then implement the next
slice. The bounded next slice is the approved per-Activity Fiche récapitulative
PDF. It is generated from current authoritative data for an Activity with an
approved revision and includes its context, approved plan/Operations, execution,
decision/correction chronology, administrative settlement, reversement, closure,
supporting-document availability and generation date. The immutable source rows
remain the proof; no signature system is added.

[Readiness and plan 27](rebuild/27-pta4b-fiche-readiness-and-implementation-plan.md)
records `PTA_4B_READY_FOR_IMPLEMENTATION` and the smallest authorized
implementation. It adds no stored PDF, migration, document storage, generic
export framework, Partner portal or historical as-of regeneration. The same
instruction authorizes implementation after the audit without another approval.
[Status 28](rebuild/28-pta4b-implementation-status.md) records
`PTA_4B_COMPLETE` after focused verification and independent correction/re-review.

## PTA-4A current annual metrics authorization (DEC-121)

The user explicitly authorized PTA-4A on 2026-10-30. The bounded slice exposes
current whole-PTA physical and financial progress using the already approved
rules: closed Activities over definitively approved planned Activities, and the
final spending of closed Activities over the definitively approved annual
allocation. Zero denominators are non-calculable and results are not capped at
100 percent. Pending amendments retain their approved baseline, approved
withdrawals are excluded, and approved transfers count in their current
destination year.

[Plan 25](rebuild/25-pta4a-annual-metrics-implementation-plan.md) is the concise
implementation and independent-review contract. Historical as-of KPI
reconstruction, Fiche generation, exports, reminders, documents, Partner access,
real accounts and production remain outside PTA-4A.

PTA-4A completed on 2026-11-02 after focused disposable-PostgreSQL, adjacent
workflow, OpenAPI, frontend quality/build and real-Chromium checks passed. The
mandatory independent correction/re-review returned PASS. [Status 26](rebuild/26-pta4a-implementation-status.md)
records the exact evidence. This completion authorizes no later slice.

The roadmap owns current completion state. Earlier dated authorization and
readiness statements below record their stage in history; they do not revoke
later explicit authorizations. Future planning follows the minimal-overhead rules
in `AGENTS.md`, updated at the user's request on 2026-10-28. No external detailed
execution prompt is required after a concrete slice is authorized. This process
review does not authorize any additional runtime slice or relax security gates.

## PTA-3F direct Activity closure planning contract (DEC-120)

The approved PTA brief already settles formal Activity closure: an active Agent
closes directly after every Operation is physically complete with explicit final
spending, the current décaissement and virement chains are finally approved, the
external virement is confirmed, any positive reversement is fully declared and no
settlement discrepancy remains. No Supervisor or Validator closure decision,
manual closure date, reason or document is required. The server records actor/time
and only closed Activities count as physically realized.

The user instructed Codex to proceed with the next planning step and then
explicitly authorized PTA-3F implementation on 2026-10-30.
[Plan 23](rebuild/23-pta3f-activity-closure-implementation-plan.md) defines the
smallest bounded implementation and independent-review contract. Implementation
evidence is recorded in [status 24](rebuild/24-pta3f-implementation-status.md);
`PTA_3F_COMPLETE` was recorded on 2026-10-30 after mandatory independent review
passed. Zero-total and
insufficient/discrepant settlement,
nonempty Project closure, annual KPIs/Fiche, documents, notifications, real
accounts and production remain separate work.

## PTA-3E reversement decision closure (DEC-119)

The user approved the bounded first reversement rules on 2026-10-29 and explicitly
authorized implementation on 2026-10-30. After the
external virement confirmation, MJL derives the unused amount as
`max(0, approved Activity allocation - final spending)`. When positive, an Agent
records one external return for exactly that server-owned amount, with a required
effective date and an optional reference/comment. No Supervisor or Validator
approval is added, and MJL neither executes nor independently verifies the return.

Partial or different returned amounts remain blocked for a later discrepancy
workflow. Before Activity closure, an Agent may append a reasoned correction to
the date or note while preserving prior declarations. A derived amount of
`0 F CFA` means that nothing is owed and requires no artificial declaration.
Unused funds are never reassigned to another Activity. Migration `0014_pta3e`,
three REST responsibilities and the existing French realization workspace now
implement this synthetic boundary. [Status 22](rebuild/22-pta3e-implementation-status.md)
records the completed verification and independent review evidence.
Formal Activity closure, insufficiency and discrepancy handling, documents,
banking integration, real accounts and production remain separate work.

## PTA-3D external virement confirmation (DEC-118)

The user explicitly authorized the bounded synthetic PTA-3D implementation on
2026-10-29. After PTA-3C approval, an Agent declares that the exact approved
amount was transferred outside MJL. The server supplies that amount; the Agent
records the effective date and may add an optional reference/comment. MJL does
not execute or independently verify the banking transaction.

The user approved blocking different amounts pending a later discrepancy
workflow. An Agent may append a reasoned correction to the date or note before
future reversement or closure begins, preserving every earlier declaration.
No additional business approval applies to the external declaration. Migration
`0013_pta3d`, three REST responsibilities and the existing realization workspace
implement this boundary. Reversement, discrepancy handling, formal closure,
documents and banking integration remain deferred.

## PTA-3C virement request authorization (DEC-117)

The user explicitly authorized the bounded synthetic PTA-3C implementation on
2026-10-29. After PTA-3B approval, an Agent may submit a separate virement
request for exactly the approved PTA-3B amount; the server supplies that amount
and accepts no alternative. One eligible Supervisor prevalidates and one
distinct eligible Validator approves through fresh decisions.

An Agent may cancel a submitted, prevalidated or returned virement request with
a reason and submit a fresh request for the same locked amount. Cancellation
does not cancel the source décaissement authorization or release its execution
and planning freeze. External transfer confirmation, bank execution,
discrepancy handling, reversement and formal Activity closure remain deferred.
The implementation contract supplied with the authorization is the only PTA-3C
plan; no additional readiness cycle is required.

PTA-3C completed its disposable PostgreSQL, exact-predecessor migration,
combined backend, frontend quality/build, real-Chrome and independent
correction/re-review gates on 2026-10-29. Migration `0012_pta3c` and the five
REST responsibilities implement the bounded workflow. [Status 19](rebuild/19-pta3c-implementation-status.md)
records the evidence. This synthetic completion authorizes no later slice;
PC1/PC2, real accounts and production remain prohibited.

## PTA-3B disbursement authorization and completion (DEC-116)

The user explicitly authorized the bounded synthetic PTA-3B implementation from
the implementation contract supplied on 2026-10-28. Once every approved
Operation is physically complete and has a final actual XOF amount, an Agent may
submit the server-calculated Activity total. One eligible Supervisor may
prevalidate it and one distinct eligible Validator may grant the final
administrative authorization. Contributors, execution authors and the submitter
cannot review their own work.

A returned request remains frozen until an Agent cancels it with a reason. A
reasoned cancellation before final approval releases execution and planning for
correction and permits a fresh request. An approved request is permanent in this
bounded version. The workflow records authorization only; it does not claim that
funds were paid or moved. Zero-total and insufficient-budget settlement,
external payment/virement confirmation, reversement and formal Activity closure
remain deferred.

Migration `0011_pta3b` adds the request and immutable decision tables. Five REST
responsibilities and the French realization workspace provide submission,
paginated history/detail, review and cancellation. The implementation verifies
the complete immutable execution/audit chain, rejects historical overspending,
uses Activity version conflicts and advisory-lock ordering, freezes adjacent
mutations, and records state changes with their audit in one transaction.

PTA-3B completed its disposable PostgreSQL, combined backend, frontend
quality/build, real-Chrome and independent correction/re-review gates on
2026-10-29. [Status 18](rebuild/18-pta3b-implementation-status.md) records the
evidence. This synthetic completion authorizes no later slice. PC1/PC2, real
accounts and production remain prohibited.

## PTA-3A Operation execution authorization (DEC-115)

The user explicitly authorized the bounded synthetic PTA-3A implementation from
the single implementation contract supplied on 2026-10-28. An Agent may start an
approved Operation from its approved start date, record exact integer XOF
spending and physical completion, and correct mistakes with a reason before any
future financial request exists. Starting work remains immutable. All internal
business roles may read; Supervisor and Validator access is read-only.

Migration `0010_pta3a` extends the existing Operation with four execution fields
and no table. The slice adds four REST responsibilities and the French React
realization workspace. It replaces the temporary no-execution planning guard
with per-Activity evidence, so started Activities cannot enter withdrawal or
transfer review while reasoned cancellation of an already pending request stays
available. Financial requests, payment declarations, reversement, formal
Activity closure, documents, notifications, real accounts and production remain
deferred.

PTA-3A completed on 2026-10-28 after the focused disposable PostgreSQL suite,
the 509-test combined backend regression, frontend quality/build checks, two
real-Chrome journeys and the mandatory independent engineering and
security/specification correction/re-review cycle passed. Completion evidence is
recorded in [status 17](rebuild/17-pta3a-implementation-status.md). This is
synthetic development completion only and does not authorize the next slice.

## PTA-2B.2B transfer implementation authorization and completion (DEC-114)

The user explicitly authorized the bounded synthetic PTA-2B.2B cross-year
transfer implementation defined by DEC-112, the reconciled
[readiness](rebuild/11-pta2b2-withdrawal-transfer-readiness.md) and the reviewed
[transfer plan](rebuild/14-pta2b2b-transfer-implementation-plan.md). One Activity
identity retains its approved source placement while a reasoned forward transfer
awaits fresh eligible Supervisor prevalidation and distinct eligible Validator
approval. Final approval atomically activates the later annual placement and
dates while preserving Operations, amounts, assignments, creation provenance and
immutable earlier-year history. An Agent may correct or cancel a pending request
with a reason.

PTA-2B.2B completed on 2026-10-28 after migration `0009_pta2b2b`, all
C01–C08/T01–T08 gates, the exact `a3c3bd0` predecessor cutover, focused/full
regression, quality/browser checks and the mandatory independent engineering and
security/specification correction/re-review cycle passed. Completion evidence is
recorded in [status 16](rebuild/16-pta2b2b-transfer-implementation-status.md).
This is synthetic development completion only. PC1/PC2, real accounts,
production, reverse transfer, restoration, execution/finance, reports and later
slices remain deferred. Stop after PTA-2B.2B and do not infer authorization for
another slice. No withdrawal decision is reopened.

## PTA-2B.2A withdrawal implementation authorization and completion (DEC-113)

The user explicitly authorized the bounded synthetic PTA-2B.2A Activity
withdrawal implementation defined by DEC-112, the reconciled
[readiness](rebuild/11-pta2b2-withdrawal-transfer-readiness.md) and the reviewed
[withdrawal plan](rebuild/13-pta2b2a-withdrawal-implementation-plan.md). The
slice permits an Agent to submit, correct or cancel a reasoned withdrawal request
and requires a fresh eligible Supervisor prevalidation followed by a distinct
eligible Validator approval. Pending withdrawal pauses execution while preserving
approved content. Effective withdrawal is terminal, ends current Agent
assignments, removes the Activity only from current annual approved totals and
preserves all earlier facts and totals.

PTA-2B.2A completed on 2026-10-27 after migration `0008_pta2b2a`, all
C01–C08/W01–W06 gates, exact-predecessor cutover, focused/full regression,
quality/browser checks and the mandatory independent engineering and
security/specification correction/re-review cycle passed. Completion evidence is
recorded in [status 15](rebuild/15-pta2b2a-implementation-status.md). This is
synthetic development completion only. PC1/PC2, real accounts, production,
restoration, execution/finance and later slices remain deferred. PTA-2B.2B
cross-year transfer required and received its own later authorization under
DEC-114.

## PTA-2B.2 business decision closure (DEC-112)

The user explicitly approved all five plain-language recommendations following
the [withdrawal/transfer readiness review](rebuild/11-pta2b2-withdrawal-transfer-readiness.md):

1. An Agent requests withdrawal with a reason; one Supervisor checks it and one
   distinct Validator approves. Pause starts at request submission. Resolve any
   pending amendment first.
2. An Agent may cancel a pending withdrawal request with a reason, resuming the
   Activity. Effective withdrawal preserves history and ends Agent assignments;
   restoration and unapproved-draft withdrawal are excluded from this first version.
3. Effective withdrawal removes the Activity from current annual planned counts
   and budget totals only after approval. Earlier historical figures remain
   unchanged. No allocation becomes reusable or is recorded as returned.
4. An approved Activity may move only to a later year within the same Project,
   preserving identity, Operations, budget and assigned Agents. It pauses while
   fresh Supervisor and Validator approval is sought; the Agent may cancel the
   pending request. After approval it counts in the destination year, preserving
   earlier history.
5. The first version is limited to verified synthetic test Activities that have
   never started execution. Work performed, spending, unresolved obligations or
   unknown financial status block both actions pending later financial rules.

The subsequent user request authorized technical readiness finalization and
sequential implementation plans, not runtime work. The reconciled
[readiness](rebuild/11-pta2b2-withdrawal-transfer-readiness.md),
[withdrawal plan](rebuild/13-pta2b2a-withdrawal-implementation-plan.md) and
[transfer plan](rebuild/14-pta2b2b-transfer-implementation-plan.md) passed
independent engineering and security/specification correction/re-review.
**PTA_2B2_WITHDRAWAL_READY_FOR_AUTHORIZATION** and
**PTA_2B2_TRANSFER_READY_FOR_AUTHORIZATION** apply only to these bounded synthetic
contracts. Withdrawal precedes transfer; actual withdrawal completion/artifact is
a mandatory transfer prerequisite. Each slice requires separate implementation
authorization and ends with independent review-only handoff, corrections and
same-reviewer re-review. No further approval of the five settled business choices
is needed. Runtime evidence gates remain mandatory. PC1/PC2 remain pending;
real accounts, financial execution and production remain prohibited.

## PTA-2B.1 implementation authorization and completion (DEC-111)

The user authorized the bounded synthetic PTA-2B.1 amendment implementation
defined by DEC-110, [readiness 10](rebuild/10-pta2b-amendments-readiness.md) and
the reviewed [implementation plan](rebuild/11-pta2b1-implementation-plan.md).
The slice opens and edits one amendment while preserving the approved version,
pauses execution from opening, requires a fresh two-stage review for replacement
approval and permits reasoned cancellation back to the approved version. It adds
three API responsibilities, two columns and migration `0007_pta2b1`, with no new
tables.

PTA-2B.1 completed on 2026-10-26 after I3/C3, all M01–M20 checks, focused
regressions, quality/browser checks and the mandatory independent engineering
and security/specification correction/re-review cycle passed. Completion evidence
is recorded in [status 12](rebuild/12-pta2b1-implementation-status.md). This is
synthetic development completion only. PC1/PC2, real accounts, production,
withdrawal, annual transfers, execution/finance and later slices remain deferred.
Stop after PTA-2B.1 and do not infer authorization for another slice.

## PTA-2B amendment pause and cancellation (DEC-110)

The user approves pausing the affected Activity from amendment opening, through
preparation, review and correction, until replacement approval or cancellation.
This concerns execution/spending, not access to review or history; other
Activities continue. The previous approved content remains authoritative and
candidate amounts cannot authorize execution.

The user also approves one open amendment per Activity and Agent cancellation
with a mandatory reason. Cancellation preserves amendment history and the prior
approval, releases this amendment's pause and resumes the prior approved version.
Cancellation of an amendment is not withdrawal of the Activity. These decisions
close the A1/A2 business choices in
[PTA-2B readiness](rebuild/10-pta2b-amendments-readiness.md).

The cancellation API, history, version/race and verification contract is now
reconciled; independent engineering and security/specification reviews PASS.
The amendment subset reached `PTA_2B1_READY_FOR_AUTHORIZATION` under readiness 10
and [its implementation plan](rebuild/11-pta2b1-implementation-plan.md). DEC-111
later authorized and completed that subset. Withdrawal and annual-history
decisions remain separate. No execution infrastructure or real-account
enablement is authorized; PC1/PC2 remain pending.

## PTA-2A implementation authorization (DEC-109)

The user authorized the bounded synthetic PTA-2A implementation defined by
DEC-108, [readiness 09](rebuild/09-pta2-validation-readiness.md), and the approved
implementation plan. The slice adds immutable Activity submissions, role-wide
Supervisor prevalidation, distinct Validator final approval, reasoned returns,
correction/resubmission cycles and revision history. It adds exactly three tables,
four API responsibilities and the minimum existing-workspace React interactions;
it adds no reviewer assignments, quorum, claiming or handoff mechanism.

I2, C2, all V01–V20 checks, focused A1–A3/PTA-1 regressions and the mandatory
independent engineering and security/specification review cycle remain completion
gates. Only synthetic identities and disposable resources are authorized. PTA-2B,
post-approval amendments, withdrawal, annual transfers, execution, finance,
documents, reports, production deployment and real accounts remain excluded.
PC1/PC2 remain pending. Stop after PTA-2A and do not infer authorization for a
later slice.

PTA-2A implementation completed on 2026-10-26 after I2/C2, V01–V20, focused
A1–A3/PTA-1 regressions, quality checks and the mandatory independent
engineering and security/specification correction/re-review cycle passed. This
records synthetic development completion only; it does not authorize real
accounts, production deployment or another slice.

## PTA-2A review policy closure (DEC-108)

The user approves review by every active Admin-invited Supervisor and Validator
within trusted MJL scope, without Activity-specific reviewer assignment. One
eligible Supervisor prevalidation followed by one eligible distinct Validator
approval is sufficient, not approval by every reviewer. Current role/session,
exact revision/state, cumulative contributor and no-self-validation guards remain.
This supersedes only DEC-105's Activity-specific reviewer-authorization requirement.
Agent coordination assignments and equal Agent access remain unchanged.

Completed decisions survive reviewer replacement, role change and deactivation;
another eligible reviewer continues the remaining stage. Structural correction
and resubmission still require fresh prevalidation and final approval. Admin may
deactivate ordinary reviewers immediately through existing secured lifecycle
commands without transferring Activities, including the last eligible reviewer;
affected Activities then wait, without approval bypass. Pending reviews and old
decisions create no individual lifecycle blocker. Existing Agent-assignment and
self/Admin-target restrictions remain. No reviewer-pool staffing check blocks
submission. These approvals supersede the earlier replacement/handoff proposal.

[Readiness 09](rebuild/09-pta2-validation-readiness.md) now bounds initial validation
with three proposed tables, four new API responsibilities and 20 focused gates.
**PTA_2A_READY_FOR_AUTHORIZATION** after independent review; **PTA_2B_NOT_READY**
and overall **PTA_2_NOT_READY** because amendment/withdrawal/annual-history
questions remain with business/finance/reporting owners. This is decision closure
and documentation only, not implementation authorization. The Admin direct-database
provisioning comment remains separate; no bootstrap bypass, direct SQL account
write, production use or real-account enablement is authorized. PC1/PC2 remain pending.

## PTA-1 implementation authorization and completion (DEC-107)

The user authorized the bounded synthetic PTA-1 slice defined by
[readiness 08](rebuild/08-pta-a4-foundation-readiness.md) and DEC-104–106. It
implements the single MJL ownership context, references, Projects, automatic
annual PTAs, draft Activities and Operations, and Agent coordination assignments.
The exact-schema guard replaces the temporary auth-only guard, and all 24 checks,
I1, C1 and the mandatory independent engineering and security/specification
review cycle passed. The slice is **PTA_1_COMPLETE** without application
acceptance. PC1/PC2 remain pending; real identities and production use remain
prohibited. Activity review assignments/actions, approval workflow, A4 beyond
the resource-specific authorization enforced here, and every later PTA slice
remain deferred. Stop after PTA-1 and do not infer authorization for another
slice.

## UI/API standards (DEC-102)

The 2026-10-23 user request requires cursor pagination for collection APIs,
default limit 60, the `count/data/next/previous/object: "list"` envelope, a shared
RestClient with Context/Provider/useAPI, Sonner, react-localization and
react-helmet-async HelmetProvider. Engineering Standard 02 owns these rules,
security-preserving example corrections and shared helper contracts. The user
subsequently approved applying these rules, including the additional API details,
during page implementation. They are mandatory for each separately authorized
page and related API slice; verify applicable rules with focused checks.
Earlier pagination targets, including readiness 05 page/size, are superseded;
existing implementation remains migration evidence only. This is standard setting,
not runtime/dependency changes or authorization for later slices.

## A3 implementation authorization (DEC-103)

The user authorizes only the ordinary synthetic-account password-recovery slice
defined by DEC-101 and [readiness 07](rebuild/07-a3-password-recovery-readiness.md).
The authorized development fixtures are a 600-second proof, three requests per
email per 600 seconds and twenty requests per IP per 60 seconds, guarded by a
literal `TEST_ONLY` policy marker and exact disposable-database attestation.
Implement the three POST responsibilities, one recovery table/migration, fixed
A2.2 schema compatibility and the minimum React journey using DEC-102's shared
client rules. All sixteen readiness checks and mandatory independent review must
pass before recording completion. Those gates passed in isolated development:
200 combined PostgreSQL cases, three recovery browser journeys, focused A1/A2
regressions, all quality checks and the independent correction/re-review cycle.
The slice is **A3_COMPLETE** without application acceptance. Admin recovery,
real accounts, A4, PTA,
production mail and deployment remain prohibited; PC1/PC2 remain pending. Stop
after A3 and do not infer authorization for another slice.

## A3 security decisions approved (DEC-101)

The user explicitly approves preserving unexpired recovery proofs without resend
or expiry extension, including waiting after failed initial delivery, and one
best-effort post-reset notification. Link possession authorizes password definition;
fresh password-plus-email-OTP login remains mandatory. Scope is ordinary synthetic
accounts only; all technical Admin recovery is deferred without bootstrap changes
or a bypass. [Readiness 07](rebuild/07-a3-password-recovery-readiness.md) is now
**A3_READY_FOR_AUTHORIZATION**, superseding DEC-100's pending-decision verdict.
Finite recovery lifetime/direct-request limits or explicit synthetic-fixture
permission remain required before affected implementation. This approval does not
authorize implementation. PC1/PC2 remain pending; real accounts remain prohibited.

## A2.2 implementation authorization (DEC-099)

The user authorizes restricted A2.2 only under readiness 06 at `6659a05`: ordinary
synthetic role changes/deactivation, one PATCH and minimal existing Admin UI,
no new tables/migrations. Provenance, per-mutation fail-closed schema eligibility,
login advisory ordering and deterministic race/invalidation checks are mandatory
before mutation enablement. Complete all sixteen gates, update status, commit,
and stop. No assigned/responsible accounts, handoff, R8/Admin lifecycle, A3/A4/PTA
or real accounts. PC1/PC2 remain pending. The roadmap owns completion evidence.

## Restricted A2.2 scope and readiness (DEC-098)

The user approves synthetic ordinary-account role changes and deactivation only
when no Activity assignments or outstanding workflow responsibilities exist.
[Readiness 06](rebuild/06-a2-account-lifecycle-readiness.md) records the fail-closed
auth-only eligibility boundary, mandatory login lock correction and pre-mutation
verification gates. **A2_2_READY_FOR_AUTHORIZATION** applies only to this scope.
That scope recheck was documentation-only; DEC-099 now authorizes its implementation.
Assigned/responsible accounts, handoff, inactive reinvitation, Admin lifecycle,
A3/A4/PTA and real accounts remain deferred/prohibited. PC1/PC2 remain pending.
DEC-097's earlier unapproved-scope verdict is superseded by this restricted approval.

## A2.1 implementation authorization (DEC-096)

The user authorizes A2.1 from readiness 05 at `2c1929e`: five access APIs,
two existing-table extensions, ordinary-role A1 authentication, one Admin view
and all sixteen acceptance gates. Synthetic identities and isolated test mail
only. PC1/PC2 remain pending; no A2.2/A3/A4/PTA or real accounts. Implement,
verify, update status, commit and stop after A2.1.

## A2 account-management readiness (DEC-095)

The earlier request authorized documentation-only A2 readiness after A1 commit
`0a2cf22`. [Readiness 05](rebuild/05-a2-account-management-readiness.md) owns the
proposed ordinary-account invitation/listing slice and deferred lifecycle gates.
No A2 implementation, tests, schema/data, dependencies, Docker/CI or skills changes
are authorized. PC1/PC2 remain pending; real accounts, A3/A4/PTA and production
remain unauthorized. Supplied users inspiration governs composition, not privileges.

## A1 implementation authorization (DEC-094)

The A1 user request authorized the exact seven A1 API and six persistence
responsibilities and T01–T18 in readiness 04, following commits 48c2bea/6007159.
Only synthetic identities, isolated PostgreSQL and test mail are authorized.
PC1/PC2 remain pending sponsor/RSSI approval. Real-account enablement must fail
closed; no A2/A3/A4, recovery, PTA, production mail/deployment or POC changes.
Updated local inspiration supplies visual composition, not extra feature scope.

## Authentication & Access readiness (DEC-093)

The earlier auth request authorized documentation-only readiness review after foundation
`48c2bea`. [Readiness contract](rebuild/04-authentication-access-readiness.md) owns
the bounded proposed first-Admin invitation-to-session slice, policy stage gates
and future test oracles. Auth inspiration is supplied in `docs/inspiration/auth/`.
Readiness is not implementation authorization: no auth/user/schema/test/dependency,
Docker, skill or deployment changes. Confirmed rules remain authoritative;
historical numeric settings are clearly distinguished from approved policy.

## First foundation implementation authorization (DEC-092)

The user explicitly authorized the first technical React/FastAPI/PostgreSQL
slice following audit commit `3e7443d`. Scope: two frontend routes (`/`, `/health`),
PWA static assets only, health endpoints `/api/health/live` and `/api/health/ready`,
PostgreSQL connectivity, SQLAlchemy session lifecycle, empty Alembic bookkeeping,
quality tools/tests, separate Docker services and minimal CI/development docs.
This supersedes DEC-091's documentation-only stop for this slice only. Proposed
future authentication/financial mechanisms are not thereby approved or implemented.
No users, business tables/data, auth, PTA, documents or production deployment.
Keep POC files, tests, databases and Docker resources unchanged. Use an explicitly
named rebuild Compose file so default POC startup remains unchanged. The first
technical slice is implemented and its mandatory gates passed (see roadmap).
This authorizes no next slice and records no application acceptance.

## Dedicated application rebuild — 2026-10-22 (DEC-091)

The rebuild instruction selects React/Vite JavaScript/JSX, TanStack
Router/Query, Tailwind/shadcn/ui/Lucide, FastAPI REST/OpenAPI, PostgreSQL,
SQLAlchemy 2/Alembic and Docker Compose. PWA business operations are online-only.
Frontend/backend deploy separately; commercial cloud provider/region are unapproved.
This authorizes documentation and repository-owned skill maintenance only.

The new technical proposal is `docs/rebuild/02-target-architecture-and-engineering-standard.md`;
security requirements are consolidated in `docs/rebuild/03-security-compliance-baseline.md`.
Both remain proposals for review, not evidence of conformity or permission to build.
`docs/rebuild/01-authority-and-business-baseline.md` classifies business contracts,
all 35 migration preservation rules and all 75 existing API operations.
The roadmap owns the first foundation slice/readiness; the gap analysis owns
remaining decisions. No implementation, production work, Phase 4 activation,
POC removal or migration of old accounts/data is authorized.

The frozen Dolibarr architecture and Engineering Standard v1 remain historical
engineering evidence, byte-identical. Their custom-module, PHP/bootstrap,
native-session, MariaDB/lifecycle, ERP-object and delivery requirements are
superseded for the new rebuild, not retroactively unapproved. Existing POC
commands, source paths and test matrices describe legacy maintenance only.
Approved business, contractual/security and v3 visual requirements survive
according to the disposition register. The old 35 rules are not copied wholesale.
Phase 4's complex document series/ECM/preview design and accepted risks are not
automatically transferred: target optional private PDF/image evidence only,
with separately approved file-security and retention decisions.

## Approved PTA change — 2026-10-21 (DEC-087)

The user explicitly approved the business rules in
`docs/mjl_codex_authoritative_pta_change_brief.md`. They supersede related
rules in code, tests, the v2 documents, and preservation requirements that
merely describe the former business behavior. Code remains the source of truth
for what is implemented, not a reason to reject the approved changes.

The current task authorizes impact audit and planning, not runtime implementation.
The gap analysis owns findings and unresolved questions; the roadmap owns the
proposed implementation sequence. Existing security and engineering controls
remain unless expressly superseded. The brief preserves the Phase 4 document
security gate. Before implementing any screen, check for an applicable supplied
design inspiration; if absent, stop that screen work and ask the user.

The brief is the canonical business-change overlay until the affected v2
sections are reconciled in their implementation slices. Their conflicting
pre-PTA statements are not active requirements. In particular, do not retain
assignment-based Agent access, independent Activity creation, post-start edit
bans, automatic Activity closure, or mandatory attachments because old tests
or documentation describe them. Unresolved details are not implementation
permission.

## Canonical ownership

| Subject | Canonical document |
| --- | --- |
| Legacy REST action inventory and wire contract (behavioral evidence) | `docs/mjl-rest-api-contract.md`, `docs/mjl-rest-api.openapi.yaml` (75/75 inventoried operations implemented; not accepted) |
| Complete business rules | `docs/mjl-functional-specification-v2.md` |
| Decision history and provenance | `docs/mjl-decision-register-v2.md` |
| Core, excluded, and gated scope | `docs/mjl-scope-boundary-v2.md` |
| Visibility and permitted actions | `docs/mjl-permission-matrix-v2.md` |
| States, transitions, and guards | `docs/mjl-status-and-transition-model-v2.md` |
| Target entities, fields, and invariants | `docs/mjl-data-dictionary-v2.md` |
| Phase 4 cross-cutting planning and handoff index | `docs/mjl-phase4-contextual-document-management.md` |
| Implementation state and unfinished phases | `docs/mjl-implementation-roadmap-v2.md` |
| Historical architecture preservation requirements | `docs/architecture-audit/14-preservation-ledger.md` |
| Historical frozen Dolibarr architecture and migration-wave contracts | `docs/architecture-audit/17-target-architecture-proposal.md` |
| Historical implementation rules within the frozen Dolibarr architecture | `docs/mjl-engineering-standard-v1.md` |
| New-stack architecture and Engineering Standard proposal | `docs/rebuild/02-target-architecture-and-engineering-standard.md` |
| Consolidated security requirements | `docs/rebuild/03-security-compliance-baseline.md` |
| Rebuild authority/business/API disposition | `docs/rebuild/01-authority-and-business-baseline.md` |

## Historical Dolibarr engineering authority and implementation state

The legacy architecture and Engineering Standard retain their frozen historical
technical contracts; they do not govern the rebuild. DEC-075 authorizes documentation cleanup only; it changes
no architectural boundary or runtime behavior. Current document fingerprints:

| Authority | Status | SHA-256 |
| --- | --- | --- |
| `docs/architecture-audit/17-target-architecture-proposal.md` | `ARCHITECTURE_FROZEN`; REST destinations through DEC-086 | `e9c31d37a0e46d7dedb3797980fab90bc8ff8f3c02b8af53630162699a87a19b` |
| `docs/mjl-engineering-standard-v1.md` | `STANDARD_FROZEN`; DEC-066 transaction amendment retained | `03ea3aabcd703242986330cbd238d90b9a1f6bb6a80e377060a9ebabc2553841` |

DEC-083 amends Activity HTTP/presentation destinations for REST while preserving
command and bounded-read ownership. DEC-084 applies the same REST migration to
Opérations, expenses, accounting corrections and exception workflows. DEC-085
applies it to monitoring, audit previews and checked report delivery. DEC-086
applies it to MJL access administration.

W0 and W1–W7 are complete. DEC-072 records `MIGRATION_COMPLETE: YES`.
The roadmap owns concise implementation state, the decision register owns
history, and the gap analysis owns unresolved issues. Completed audit snapshots,
readiness reviews, and execution/validation reports are retained in Git history
rather than as active documents. The historical preservation ledger retains all 35 rules, classified for rebuild
applicability in document 01.

DEC-073 records post-migration technical revalidation. Role-based UAT and manual
accessibility sign-off remain outstanding; application acceptance and production
readiness remain unclaimed. DEC-074 and its Phase 4 planning brief are unchanged:
implementation is not authorized and document routes remain deny-all.

## Current product decisions

- The application is under development and nothing is accepted by default.
- No phase, passing test, verdict, or registered approval authorizes later work.
- Production preparation and production-readiness assessment are deferred until
  the user explicitly requests them.
- The application is not live. Existing local sample data is not migrated.
- Preserve the existing POC tenant and its native technical administrator. The
  rebuild starts clean with a separately guarded first-admin bootstrap, not
  migration of native accounts or sample data.
- Create no persistent sample/demo dataset until the user approves one. Tests
  may create minimal records only in isolated disposable tenants and must tear
  them down.
- The hierarchy is `Partenaire -> Projet -> PTA annuel -> Activités -> Opérations`.
  One Partner has at most one active Project; the Validator creates/closes
  Projects. Each relevant Project/year has one PTA; Activity creation requires
  that PTA and planned-start-year attribution. Create it automatically when an
  Agent first plans an Activity for that Project/year (DEC-089).
  Project closure is blocked while any Activity or required financial step
  remains unfinished (DEC-090). DEC-123 applies that settled rule to the
  completed rebuild lifecycle: empty Projects and Projects containing only
  terminal `closed` or `withdrawn` Activities may close; any other Activity
  state blocks closure.
- All Agents have the same visibility and editing rights across PTAs and
  Activities within the active entity, subject to workflow state. Assignments
  are coordination/notification metadata managed by Supervisor and Validator.
- Per-Activity immutable revisions and two-stage approval remain. Approved
  content can change through formal PTA revision, including after its dates;
  cross-year postponement requires audited transfer. Preserve approved history,
  exact-revision decisions and no-self-validation. Pause execution of the
  affected Activity while its proposed change awaits approval; other approved
  Activities continue normally (DEC-090).
- Default end date is start plus three calendar months for every Partner: preserve
  the day when valid, otherwise clamp to the target month's last day. It is a
  date-only suggestion, not 90 days or automatic end-of-month preservation, and
  never overwrites a manually selected end date (DEC-106).
- Planning and realization are distinct modules. Only approved scheduled
  Activities execute. Final Operation spending is explicit exact XOF; missing
  is not zero. The user confirmed that final Operation spending replaces the itemized
  expense approval/reversal ledger. External fund custody is outside MJL scope;
  record only the specified administrative amounts and declarations.
- Décaissement and virement are separate administrative requests, each approved
  by Supervisor then Validator. Requests use actual finalized spending, not the
  whole allocation. Budget insufficiency requires approved PTA revision and a
  distinct financial authorization before décaissement starts. This is a separate
  Agent → Supervisor → Validator request, distinct from décaissement and virement
  (DEC-089). Later exceptions require controlled resolution, never silent budget
  adjustment.
- External virement confirmation and reversement record declared actual amounts
  and dates. Required reversement is `max(0, approved allocation - final spending)`;
  distinguish required and actually returned amounts. No in-app banking or
  redistribution of leftover funds. Agent closes directly only after every
  required settlement check; only closed Activities count as physically realized.
- Annual PTA KPIs use approved revisions, closed-only realized counts/spending,
  non-calculable zero denominators and no silent cap at 100 percent.
- Relance is due 21 calendar days before current end date, for all assigned
  Agents through in-app/PWA and email, with rescheduling and delivery evidence.
- The regenerable Activity Fiche PDF includes planning, decision history and
  settlement reconciliation. Supporting documents are optional; the Phase 4
  guarded-delivery implementation gate remains in force.
- Partner portal identities are Admin-invited, read-only and bound to exactly
  one Partner. Internal roles remain exclusive; no role switching or public
  registration. Full audit-history exports remain Validator/Admin only.
- `Programme` is not a generic entity name; it may remain in a proper name.
- Existing internal role codes and French labels remain. In the POC, native Admin implies
  `ADMIN_PLATEFORME`; the rebuild provisions that technical role independently.
  Admin cannot combine with a business identity and grants no business mutation. Preserve entity isolation and guarded document delivery.
- Authentication target remains email/password plus email OTP, with 24-hour
  idle and absolute session limits and no remembered devices. Code supports
  configuration-gated OTP; the last recorded local state has it disabled and
  mail unconfigured. This audit did not recheck runtime configuration. Verify
  actual mail delivery before enablement.
- REST remains the backend foundation. The 75-operation inventory describes
  the implemented pre-PTA scope, not coverage of the newly approved scope.
  Migrated screens require JavaScript. French PDF/XLSX and audited supplemental
  CSV remain supported outputs. No acceptance or production readiness is implied.

## Implementation boundary

The POC remains outside Dolibarr core. Native capabilities are legacy reference
only; the rebuild uses the proposed dedicated frontend/backend boundaries. The roadmap records which phases are
implemented; that status does not establish acceptance.

Over-engineering is banned. Remove obsolete mechanisms and their stale
callers together; historical references do not justify keeping them. Use the
smallest implementation that satisfies the current request and a concrete
authorization, security, or data-integrity risk. Check scope before
editing and when new work appears. Record useful optional work as an unapproved
recommendation rather than implementing it.

## Design authority

The approved v3 design package is authority for visual presentation only.
`docs/design-system/approved/v3/` owns visual tokens, components, density,
interaction states, responsive behavior, and accessibility guidance. Product,
role, permission, workflow, document, and export assertions are superseded by
the canonical documents when they conflict.
