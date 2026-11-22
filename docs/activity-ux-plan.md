# Activity UX improvements — reviewed plan

> Current work: [Prop-driven modal simplification](#prop-driven-modal-simplification--implemented).
> That plan supersedes earlier modal deep-link and stored-selection-ID proposals.
> Its first financial-review slice is implemented and verified; the separate
> follow-ups remain outside the authorized scope.

2026-11-10, updated 2026-11-11. Implementation authorized and completed; focused verification and
independent code review are complete. Human visual review remains acceptance.
Source: user findings, supplied screenshots and follow-up decisions.
Existing unrelated working-tree changes must be preserved.
Approved behavior below governs this implementation. It supersedes older conflicting
creation requirements; synchronize the business/design guides in the relevant
authorized slice. All identified business choices are settled.

## Outcome and boundaries

Make Activity creation, assignment, submission and follow-up understandable with
the existing design system. Reuse existing forms, calendar, Query cache, Sonner,
notification inbox and history presentation. No new workflow engine, automatic
save, notification queue or unrelated Dashboard redesign.

Confirmed requirements:

- Use ASCII `-` in browser page titles, including loading titles.
- Audit application form labels: required fields have `*`; optional labels have
  no `(facultatif)`. Keep accessible required/error semantics.
- New PTA year defaults to current year; choices span current year minus two
  through current year plus ten, inclusive. Do not restrict existing PTA reads.
- Successful modal mutations show one contextual Sonner toast, never a success
  message for a failed/uncertain request or a duplicate of an existing toast.
- Activity creation title is `Créer une activité`; use `Assigner à`. Dates are
  optional at creation, start defaults to today, past dates are selectable.
  Month and year must be selectable independently.
- Prefetch ten active Agent-role identities before opening the assignment list;
  retain server search for other Agents and selected identities across searches.
- Agent creation generates no assignment notification in either channel.
  Assignment by another person notifies each newly assigned Agent in-app and by
  email, including reviewer creation; retain existing inbox/read conventions.
- Draft visibility follows the server assignment rules. The later approved list
  refinement removes the separate `Mes activités` control.
- History uses readable French, formatted dates and Agent identities, never raw
  identity IDs. Category modal follows Project composition with saved Nom and
  Description fields.
- Activity tab loading must not visually merge a skeleton with the table.
- Agent creation offers `Enregistrer le brouillon` and
  `Soumettre pour prévalidation`; submission stays disabled until complete.

## Settled workflow and implementation boundaries

### Create, resume and submit

- Agents keep the full creation/editing page; reviewers keep the quick modal.
  Both use `Créer une activité` for creation. Agents are automatically assigned
  to their own Activity; reviewers choose at least one active Agent. Permissions
  do not change, including who may reassign or edit an Activity.
- An Agent can save a title-only initial draft, reopen it and continue saving
  incomplete Activity-level information. Description, dates, Operations and
  allocation may be missing before first submission; missing budget is not zero.
  Preserve existing strict submitted revisions, correction/amendment and approval
  contracts; do not extend incomplete-save behavior to those workflows silently.
- Submission requires title, description, both dates, start in the PTA year,
  ordered dates, at least one complete Operation (category/name/positive amount),
  and positive exact Activity allocation equal to the Operations' sum. Both UI
  and server enforce this; hiding/disabling a button is not server validation.
- Mark fields required to save with `*`. Explain extra submission requirements
  beside the disabled submit action, with field-level guidance; do not mark draft
  dates required or let native form validation block an otherwise valid draft.
- Start defaults to today only for the current-year PTA, otherwise blank. It is
  clearable, and past dates within the chosen PTA year are allowed. End is optional
  and clearable. Validate order when both exist; no invented dates on save.
  Retain the existing Agent-only start-plus-three-calendar-month end suggestion,
  never overwrite a manual or deliberately cleared end. Reviewer end stays blank.
- Calendar shows no-start drafts under `Sans date`, including end-only drafts;
  dated/start-only entries retain their existing presentation. Apply the same
  filters and complete-page loading as the table. Missing start cannot satisfy
  an explicit start-date filter. No dates are invented for reports or summaries.
- Recommended navigation: successful draft save opens its Activity detail with
  the existing continue-editing action; successful submission opens the detail
  with its new status. Keep entered values on failure and avoid duplicate writes.
  If save succeeds but submission fails, retain that saved draft, explain the
  outcome and retry submission on it—not creation. Unknown outcomes are reconciled
  before retry; do not claim success or erase input prematurely.

**Confirmed — partly entered Operations.** Ignore wholly
blank new rows; a started Operation must have category, name and positive amount
before draft save. Show an inline error and retain all input so the user can
complete or explicitly remove that row. Never silently discard it. Persisting
partly filled Operations is out of scope. Title-only drafts with no Operations
remain allowed. This rule was explicitly confirmed by the user after review.

### Categories and shared controls

- Category creation saves `Nom` and `Description`, not merely a subtitle.
  Routine proposed defaults: required trimmed name up to the existing 200-character
  bound; optional description up to 4,000 characters, matching existing descriptive
  fields. Keep the existing `label` API field for Nom; add description to create,
  list/response and safe audit projection. Existing categories have no description;
  do not invent text or add an unrelated category edit/management screen.
- After category creation, select it in the originating Operation and show one
  Sonner success message. Do not submit/reset the parent Activity or lose its
  unsaved data; retain shared modal dismissal and focus-return behavior.
- PTA year choices constrain new creation only, not historical reads or existing
  fixed-year editing. Compute from the current year, never hard-code 2026.
- Audit visible labels and modal mutation owners across the app, not just planning.
  Preserve accessible required/error semantics; remove optional suffixes from
  labels, not legitimate explanatory prose. Success toasts name the actual action
  and appear once after confirmed success; dismissing a modal is not cancellation
  of an already sent write. Keep errors actionable in the relevant form.

### Assigned work and notifications

- Do not show a separate `Mes activités` filter. Initial drafts remain limited by
  the approved creator/assignment visibility rules; submitted Activities use the
  normal permitted list. Counts continue to match table/calendar and whole-PTA
  summary metrics remain unfiltered.
- No assignment notification for Agent creation. Reviewer creation and later
  assignment changes notify newly added Agents only. Unchanged/removed assignees
  receive none; a genuine later re-add is a new assignment. Replayed writes must
  not duplicate notifications or email attempts.
- Record assignment, authoritative audit and recipient notification atomically;
  attempt email after commit, never on rollback. Reuse existing mail policy:
  one bounded attempt, no automatic retry/queue. Email failure cannot roll back
  a saved assignment or erase its in-app notification. Distinguish saved assignment
  from email delivery failure; provider acceptance is not inbox receipt.
- Assignment message identifies the Activity and PTA/Project context, with an
  in-app link to the Activity. The shared full inbox/popover must distinguish
  assignment messages from deadline reminders instead of assuming an end date.
  Keep recipient-only reads and existing unread counts. Opening an unread item
  marks it read before navigating; preserve the current failure behavior.
- Keep deadline-reminder cycles and delivery unchanged. Extend only the narrow
  assignment notification storage/projection contract; no generic event system,
  realtime transport, delivery guarantees or production scheduling in this slice.

Existing `shared/ui/calendar.jsx` already supplies month/year dropdowns: inspect
the actual modal interaction before replacing anything. `/assignment-agents`
already filters active `AGENT_SAISIE` users and supports a limit and search;
the current brief query waits for expansion. Reuse it with `limit=10`, start
loading when the creation modal opens, and share its session-scoped query cache.
Slow requests still need an honest loading state; prefetch cannot promise instant
results. Agent self-assignment does not require opening reviewer-only APIs.

## Implementation slices

| Slice                          | Changes and existing seams                                                                                                                                                                                      | Focused verification                                                                                                                                                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Consistent presentation     | Inventory titles/labels/modal success owners; locales, Helmet/loading titles, PTA year choices; readable History and stable Activity-tab loading                                                                | Representative forms, modal success/error and history journey; desktop/mobile reference comparison; preserve permissions and safe projections                                                                                                                      |
| 2. Saved category descriptions | OperationType model/migration, create/list/output/audit, CategoryCreator and other creation consumers; Project-style modal                                                                                      | Disposable migration preserves old categories; create/read saved description; selecting new category neither submits nor resets Activity draft                                                                                                                     |
| 3. Create, resume, submit      | Enforce complete-or-remove for started Operations; nullable initial-draft dates; create/update/output/allowed-actions contracts; Agent full form and brief; calendar controls, prefetch, two actions, Sans date | Title-only save → GET → reopen/edit → submit; started incomplete row blocks save without losing input; empty new rows ignored; invalid direct submission rejected; migration integrity and adjacent null-safe reads; existing approved/revision workflows retained |
| 4. Find assigned work          | Router filter initialization/removal; API filtered count and pagination; table/calendar and empty state                                                                                                         | Agent own/all journey, reload/Back and view switch, whole-PTA metrics unchanged                                                                                                                                                                                    |
| 5. Assignment notifications    | Narrow recipient notification data/projection; assignment/create transactions and mail; shared inbox/popover/read behavior                                                                                      | Reviewer create and reassignment notify correct recipients; Agent creation and replay do not; read isolation, mail failure and existing reminder behavior                                                                                                          |

All identified business decisions are settled. Slice 3's read compatibility ships
with its write changes, not as a later repair. Slices 4–5 do not authorize unrelated
Dashboard or notification redesign. Each slice ends in independent review.

Concrete compatibility audit for slice 3: `Activity.planned_start` and completeness
constraints in models/migrations; create and `ActivityReplace` schemas/routes;
service/presentation `.isoformat()` calls and response schemas; list/detail,
calendar, Dashboard attention sorting, applicable reports/exports, and submission
eligibility. Current `.isoformat()` and date sorting assume a start exists. Missing
dates must serialize as unknown without read errors; approved snapshots and their
execution/finance remain strictly dated. Inspect affected consumers, not unrelated
workflows. Bind migration checks and schema-integrity manifest to the final source;
upgrade disposable existing data without inventing dates, and refuse destructive
downgrades where new data cannot be represented.

Reuse existing save and submission actions where safe. Do not invent an atomic
combined API without presenting why the existing flow is insufficient. Reuse
existing checks rather than creating a separate test for each label or toast.

History example: `Activité créée par Yoann Validateur`, `Assignée à Yoann Agent`,
`Début prévu : 3 janvier 2026`. On edits show the actual old/new values; preserve
immutable audit evidence and authorization. Resolve historical identities in a
bounded projection, not one request per event. Use a neutral human-readable
fallback for unavailable identities, never a UUID.

Recommended loading: keep the tab heading/filter frame stable and use one small
loader in the content region; retain existing rows during background refresh.
No additional fake table layered over the real table.

## Gates and progress

- User's five decisions recorded; first review found missing draft-resume/read
  compatibility, category persistence and assignment-message presentation, now
  included. The user subsequently confirmed complete-or-remove for started
  Operations, settling the final open choice.
- Slices 1-5 are implemented in the current candidate. Slice 1 aligned browser
  title separators, required/optional labels, PTA year choices, modal success
  feedback, readable History and Activity loading. Slice 2 persists category
  descriptions. Slice 3 supports resumable incomplete initial drafts, strict
  submission, complete-or-remove Operations, optional dates and `Sans date`.
  Slice 4 originally applied a removable Agent-owned filter through Router state;
  the approved 2026-11-11 refinement removes that control while retaining server
  draft visibility. Slice 5
  records recipient assignment notifications atomically and attempts email after
  commit while preserving the existing inbox/read flow.
- Implementation lessons: nullable initial drafts also required updating strict
  audit projections and every date serializer/sorter; the exact schema verifier
  had to be regenerated from a migrated disposable database. The existing shared
  calendar and Agent query APIs were sufficient; no replacement control or
  generic notification framework was needed.
- Before visual implementation, inspect applicable `docs/inspiration/pta/`
  references and prototype states. If the approved layout cannot accommodate the
  agreed creation flow, present a concrete composition proposal and stop for a
  decision; these screenshots are defect evidence, not a new complete mockup.
- After each slice update this plan with completed behavior, actual check results,
  remaining decisions and lessons affecting next steps. Update existing business,
  design and status guides only with settled changes; avoid duplicate contracts.
- Every implementation slice ends with a separate review-only agent inspecting
  requirements, actual diff, surrounding code and fresh evidence. The implementer
  fixes accepted findings and returns the candidate to the same reviewer. Stop
  when concrete blockers are resolved or recorded; no claim of absolute certainty.
- Final user visual review is acceptance, separate from automated checks and code
  review. Focused runtime evidence is required for the implemented workflows.
- Planning review: separate specification and standards reviewers rechecked the
  revised document and cleared their concrete findings before the final user
  confirmation. That confirmation selected the reviewed recommendation; the
  subsequent implementation request authorized these slices. The plan was checked with direct file
  review, `git status --short`, `git diff --stat`, `git diff --check` and
  `git diff --no-index --check /dev/null docs/activity-ux-plan.md` (the plan is
  currently untracked). Implementation verification and final independent review
  evidence are recorded in project status when this candidate clears its gates.

Final corrected-candidate evidence: repeatable migration to head passed on fresh
disposable PostgreSQL and the strict schema fingerprint was regenerated from that
database. The affected backend campaign completed with 26 passes and one
order-sensitive test assertion; after correcting the assertion to verify the
assigned set rather than unspecified ordering, its focused rerun passed. Backend
Ruff and strict mypy passed. The affected frontend campaign passed 104 tests in
seven files, including Planning, PTA metadata, quick creation, History,
notifications, authentication labels and the adjacent Execution file. ESLint and
the production build passed, retaining one pre-existing hooks warning and the
known large-chunk warning. A broad parallel frontend run completed 217 of 221
tests; the four Execution misses then passed together in the isolated 29-test
file rerun, so the broad run itself is not recorded as a pass. A later attempted
single-worker broad run was interrupted and is not evidence.

The focused reviewer quick-create Playwright journey passed and its desktop,
390px, calendar, Agent-selection and short-height captures were inspected against
the supplied composition. The Agent full-form two-action composition still awaits
the user's ongoing desktop/mobile visual review. Both independent review axes
cleared their concrete code findings; review is not user acceptance or production
readiness. After final review removed an unapproved end-year restriction, the
affected Planning frontend rerun passed 47 tests and the two-role reviewer-brief

PostgreSQL rerun passed 2 tests; cross-year ends retain ordered-date validation.

## Follow-up — review work, Activity History and notifications

Authorized 2026-11-10. Implementation is in progress. The supplied Activity
detail, History, finance and PTA-table references govern presentation.

### Confirmed outcome

- Activity confirmation dialogs name the decision and explain its result in
  ordinary French. Submitted Activities use `Soumise pour prévalidation` and
  prevalidated Activities use `Validation définitive attendue` consistently.
- Activity History is visible only on its tab. Initial loading, failure, empty
  and populated states are mutually exclusive; a background refresh preserves
  existing content. Attachments follow the same state rule.
- History uses the supplied timeline composition and human-readable event copy,
  names, roles, dates and amounts. Its API projection excludes email addresses,
  raw identifiers, internal role codes and contributor dumps. Older unavailable
  facts use a neutral fallback and are never invented.
- Revision numbers disappear from routine Activity headers and PTA rows. The
  immutable saved revisions remain the approval mechanism. History shows the
  resulting business event and actual before/after changes without raw snapshot
  panels or internal metadata.
- `Budget et validation` includes `Assignée à` with the responsible Agent names.
  Shared status badges use the approved semantic colors from the supplied
  references. `Réalisation & finances` remains available after final approval;
  before approval the screen explains when it becomes available.
- Supervisors enter a PTA with the removable actionable filter
  `Soumise pour prévalidation`. Validators enter with
  `Validation définitive attendue`. These defaults show only requests the
  current user is eligible to decide; explicit filters and other actions remain
  available. Agent lists do not expose a separate `Mes activités` control.

### Notification contract

- When an Activity or supported financial request reaches Supervisor review,
  notify every active Supervisor currently eligible to decide. After successful
  prevalidation, notify every active Validator currently eligible to decide.
  Eligibility reuses the actual no-self-review/contributor rules, not role alone.
- Notify assigned Agents when an Activity or financial request is returned for
  correction, in-app and by email. Notify assigned Agents after final approval
  in-app only.
- One notification exists per recipient, request identity and review stage.
  Replay creates none; a fresh resubmission after correction creates a new set.
  The notification is committed with the transition and email is attempted once
  after commit. Email failure never rolls back or invites a duplicate transition.
- Reading and handling are distinct. A notification remains historical when
  another reviewer acts, but presents `Déjà traitée`/`Consulter` rather than a
  stale action. Opening an Activity is not blocked by a mark-read failure, and an
  already-read update is harmless across tabs.
- The inbox and unread count work for Agents, Supervisors and Validators and are
  named `Notifications`, not `Relances`. Links reauthorize and show current state.
- New email content is plain text only in this slice. Approved HTML will be
  supplied later. New mail kinds: Activity to examine, Activity to approve,
  financial request to examine, financial request to approve, Activity returned
  for correction and financial request returned for correction. Activity and
  financial-request final approval are in-app only.

### Slices and progress

1. **Activity presentation and History** — implemented and independently
   reviewed. History is tab-scoped and exposes human names/roles without actor IDs
   or emails; loading and empty states are exclusive; submitted snapshots use
   formatted dates and XOF amounts. Confirmation copy, assignment summary,
   revision wording, finance availability and semantic badges are updated.
2. **Role work filters** — implemented and independently reviewed. The API
   applies actual contributor/no-self-review eligibility for `review=mine`;
   Router-backed Supervisor and Validator defaults use the canonical Activity
   state wording and are removable, including in the calendar, while explicit
   state filters stay broad.
3. **Review notifications and inbox** — implemented and independently reviewed.
   Activity transitions create durable eligible-recipient notifications, preserve
   separate read/handled state and use plain-text-only mail for examination,
   approval-stage and correction messages. Final approval is in-app only.
4. **Financial notifications** — implemented and independently reviewed. The
   existing additional-funding, décaissement, virement and zero-spending
   transitions now create the same eligible-recipient, handled/read and Agent
   outcome notifications. Review and correction mail is plain text only; final
   approval remains in-app only. Financial inbox entries open the current
   `Réalisation & finances` view.

Each slice gets focused workflow checks, updated progress/lessons and independent
review. HTML email output remains explicitly deferred until the user supplies the
approved templates.

Slice 1–2 evidence on the current candidate: 47 focused frontend tests passed
across Planning, calendar pagination and Activity timeline; ESLint had no errors
and retained one unrelated pre-existing hooks warning. Fourteen PostgreSQL-backed
History/filter workflow tests passed against a fresh disposable database, and
focused Ruff and strict audit mypy passed. The same independent reviewer cleared
the corrected candidate after raw identifiers, mixed loading/empty states and
current-role historical attribution were removed. A concrete test lesson was to
keep the global Admin audit shape unchanged while using a narrower Activity History response projection;
the role needed for human display is therefore added only to the Activity view.

Slice 3 evidence on the current candidate: repeatable upgrade to migration
`0033_activity_notifications` and plain-text-only mail rendering passed; the
complete affected notification/reminder file passed 19 PostgreSQL-backed tests.
The focused frontend Activity/History/notification campaign passed 49 tests.
Backend Ruff, strict mypy, frontend ESLint and `git diff --check` passed. The
adjacent-test lesson was to assert notification kinds rather than assume the
inbox contains only deadline reminders. Review found and cleared a stale inbox
cache after decisions by invalidating the current user's notification queries;
the two-branch contextual regression passed. Withdrawal approval remains a
separate lifecycle-copy/recipient boundary and is not mislabeled as ordinary
Activity approval. HTML email output remains deferred.

Slice 4 focused evidence on the current candidate: one complete backend journey
for each of the four financial request types passed, including staged recipient
progression and the final Agent in-app notice. The complete affected
notification/reminder file plus migration compatibility and representative
plain-text rendering passed 23 PostgreSQL-backed tests. Three focused financial
UI journeys and the two-notification inbox file passed. Backend Ruff and strict
mypy, frontend ESLint and the production build passed; the build retains the
known large-chunk warning. The implementation lesson was to reuse each request's
frozen contributor exclusions rather than introduce a separate manager hierarchy
or notification workflow. Inbox projection also verifies that the referenced
request still belongs to the Activity, and successful financial actions refresh
the current user's notification cache. Independent review cleared the slice with
no P1/P2 findings after rerunning all four workflow journeys, the affected inbox,
mail and migration checks, 31 frontend notification/Execution tests, Ruff,
strict mypy, ESLint and `git diff --check`. Real Resend delivery and browser E2E
remain acceptance evidence outside this code-review gate.

Final commit review corrected two findings: financial cancellation now marks the
pending reviewer notice handled while preserving unread status, and financial
source validation uses grouped queries rather than one query per inbox row.
Both independent reviewers cleared the corrections. The focused PostgreSQL
rerun passed seven funding/disbursement/virement cancellation, return, inbox and
rollback cases; Ruff, strict planning mypy and diff checks passed.

## Planned — human-readable information without revision numbers, 2026-11-11

Status: implemented and independently reviewed; human acceptance remains.
Existing uncommitted Execution, Fiche, routing and test work belongs to another
task and remains preserved.

### Outcome and boundaries

Remove internal revision/version numbers and technical revision terminology from
all human-facing Activity information, including Partner screens, History,
dialogs, accessible labels, notifications, emails, printed fiches and exports.
Do not simply rename `Révision 2` to `Version 2`. Keep immutable saved content,
approval evidence, request identifiers, concurrency tokens, API fields and
database structure intact. This is a presentation change, with no migration or
change to approval stages, financial rules or permissions.

Activity History already explains progress and changed facts adequately; preserve
its current composition and useful content. Do not add a parallel version
browser, comparison screen or extra approval banner just to replace a number.
Where existing views distinguish approved information from pending changes,
retain that distinction in ordinary language. Never make a proposed budget look
approved by removing its context. Preserve access to existing historical facts
where it is currently offered, with meaningful action/date wording.

### Initial inventory from the current working tree

These are source leads, not a claim that every string is currently rendered.
Trace each occurrence to its real consumer before changing it.

| Surface                                         | Starting points                                                                                             | Planned treatment                                                                                                                                                   |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Execution list and financial correction history | `frontend/src/features/execution/ExecutionView.jsx`                                                         | Remove approved revision numbers and `Version N`; retain event, amount, date, actor and correction reason where already permitted.                                  |
| Partner Activity decisions                      | `frontend/src/features/partner-portal/PartnerPortalView.jsx`                                                | Identify decisions by their action and date, with existing Partner privacy rules.                                                                                   |
| Internal and Partner fiches                     | `backend/app/planning/operations/fiche.py`, `backend/app/partner_portal/fiche.py`                           | Remove numbered revision metadata; describe submission, approval and correction events plainly. Preserve approved values and chronology.                            |
| Annual PDF/Excel/CSV and Partner CSV            | `backend/app/planning/reports/annual_report.py`, `annual_export.py`, `backend/app/partner_portal/export.py` | Remove revision columns and labels from human-readable output; retain business references and useful approval dates. Check column alignment and existing consumers. |
| Shared messages and empty states                | `frontend/src/locales/fr/PlanningView.js`, `ExecutionView.js`, `AuditHistoryView.js`, `EmptyContent.js`     | Trace live copy, remove unused revision copy where safe, and replace technical explanations with the action or missing information.                                 |
| Remaining app and communication surfaces        | Planning, Dashboard, global History, notifications, mail templates, dialogs, tooltips and accessible names  | Complete a rendered-text and source audit; avoid blind replacements of internal identifiers or the word `Prévisions`.                                               |

Examples of copy direction, subject to the actual context:
`Révision approuvée : 2` disappears; `Révision soumise` becomes
`Activité soumise pour examen` or `Modifications soumises pour examen` when the
recorded event supports that distinction. `Révision du budget` can become
`Modification du budget`. Explain any required separate funding approval without
changing that rule. Never invent an actor, date or event type to fill a gap.

### Information audit for older, nontechnical readers

Audit by user task and role, beginning with Activity creation, review, correction,
execution and finance, then PTA lists, Dashboard, Partner views, account/Admin
screens and documents. Source search alone is insufficient: review the rendered
information hierarchy and relevant states, including loading, empty, error,
returned, pending changes and approved content.

For each questionable item, record its screen, example, user purpose and a
recommendation: keep, clarify, remove, or place in existing details. An item earns
space if it helps answer: Which Activity is this? What needs my attention? Who
is responsible? What are the dates and amounts? What happened, and why? What can
I do next? A business reference such as `ACT-000021` remains useful for locating
and discussing an Activity; a UUID, concurrency counter or raw role code does not.

Check repeated dates/status/budget blocks, unexplained abbreviations, technical
errors, unnecessary precision and timestamps, redundant confirmations and vague
actions. Do not remove financial evidence, correction reasons, responsibility,
meaningful dates or required administrative facts merely to shorten the page.
Account email can be useful for account management; judge relevance and privacy
in context rather than hiding every email or identifier throughout the app.

Use respectful, familiar French, short sentences and concrete action labels.
Important instructions must be visible rather than available only on hover or
in a disappearing toast. Check text readability, contrast, clear control labels,
keyboard focus, comfortable click targets and 200% zoom using existing design
tokens/components. Do not shrink text to fit more information, rely on color
alone, or add a special "senior mode". Any change to shared tokens, navigation,
approved composition or business meaning requires a concrete proposal to the user
before implementation. Missing design references block only the affected redesign.

### Implementation slices after authorization

1. Complete the inventory and information audit. Record specific findings and
   proposed copy/removals here, prioritizing confusing or misleading information.
   Separate straightforward revision removal from broader UX proposals; the audit
   does not authorize removing every item the implementer considers unhelpful.
2. Remove revision/version presentation across screens and communications using
   existing components and localization. Keep History's current useful behavior.
   Reuse existing workflow checks; add coverage only for a meaningful risk such as
   confusing pending values with approved values.
3. Align fiches and human-readable exports. Check representative internal and
   Partner output, column layout, dates, exact XOF amounts and retained evidence.
   Removing the visible revision columns is in scope; do not change API contracts.
   Surface any discovered external dependency on an export column before changing it.
4. Apply only separately agreed broader audit improvements in small coherent
   slices. Update this plan after each slice with completed work, remaining
   findings, evidence and lessons that affect the next steps.
5. End with an independent review-only agent that did not implement the changes.
   Review actual diff, surrounding code, approved scope and verification evidence;
   resolve concrete findings and return fixes to the same reviewer. Confirm no
   revision/version metadata remains rendered, useful facts remain available,
   approved and pending values retain their meaning, and History stays readable.
   Human review of representative screens and documents remains acceptance.

Planning verification: documentation diff/reference checks only; no runtime
tests are needed because this task changes no application behavior. Implementation
verification should use focused existing tests and representative rendered/export
checks, not a new test for every removed label or an unbounded "100%" audit loop.

### Progress — Réalisations and Fiche alignment, 2026-11-11

The Réalisations list now shares the approved Prévisions filter composition,
including overlapping Activity dates and Agent search inside the filter panel.
Its Activity identity block uses the same compact title, context, status, period
and responsibility hierarchy; the technical revision number is no longer repeated
there. Execution-specific workflow states remain unchanged.

The internal Fiche now follows the supplied report reference: two-column identity,
plain Programming copy, three budget facts, a three-column Operations table,
human-readable authorization decisions, external declarations, documents and a
bordered chronology. Raw action identifiers and unchanged before/after values are
not rendered. Exact approved XOF values, unknown facts, reasons, actors and audit
dates remain authoritative. Broader revision terminology work described above is
now implemented as the candidate below.

### Progress — human-readable information, 2026-11-11

The candidate removes displayed revision numbers and technical revision wording
from the Activity list and detail, correction histories, Partner portal, dialogs,
empty states, internal and Partner fiches, annual PDF/Excel/CSV and Partner CSV.
Internal immutable records, approval evidence, API fields and concurrency checks
are unchanged, except for an additive human `actor_name` on the two financial
history responses. Approved information and changes awaiting approval remain
visibly distinct. Financial correction histories now say whether an entry is
initial or corrected, name the person responsible and format their dates for a
human reader; they no longer expose raw account identifiers.

The source and rendered-copy audit found no revision numbering in notification or
email copy. It also found broader information issues that are not silently changed
by this slice:

- current virement and reversement summary cards still show raw account IDs and
  machine-formatted dates; replacing the ID safely needs a named-user projection;
- financial request rows still show some machine-formatted timestamps;
- human CSV exports include internal Activity/export identifiers. They may support
  reconciliation by an external consumer, so their removal needs confirmation of
  that dependency rather than an assumption.

These are recommended follow-up slices, not blockers to hiding revision numbers.
No shared navigation, tokens or workflow was changed. Independent review found
that removing raw IDs had also removed useful authorship; the narrow history
projection above restores the name without changing mutation inputs or internal
identity fields. Annual CSV serialization now binds each header to an explicit
field so later internal row changes cannot silently misalign the document.
Representative screen review at 200% zoom and printed-document review remain
human acceptance, not a code-review claim.

Focused candidate evidence: the final three-file frontend run passed 83 tests.
ESLint had no errors and retained one existing hooks warning; touched Prettier
checks passed. Disposable-PostgreSQL verification passed 13 focused execution,
financial-history, Fiche, annual Excel and Partner Fiche tests, including pending
date corrections, exact XOF, named correction actors and maximum-length PDF
history. Four pure Partner/PDF/Excel rendering checks also passed. Ruff, backend
formatting, strict mypy over Planning and Partner Portal, source-copy search and
`git diff --check` passed.

The required independent reviews found and corrected authorship lost while
removing raw IDs, CSV rows coupled to dictionary order, stale spreadsheet/CSV
column assertions, a PDF row that could not split long valid history, and period
filters using an unapproved candidate schedule. The same reviewers rechecked the
corrected candidate; their final result is recorded with the commit review.

### Progress — Activity orientation, 2026-11-11

This small slice keeps the current navigation and workflow. Activity detail
places the saved purpose in the identity area and states the next responsible
role from the actual Activity state. Réalisations exposes the approved saved
description in the same identity area. Both Activity explorers now say that
search accepts an Activity title or reference, and filtered empty results explain
what was searched and offer a direct reset. No dashboard, workflow mechanism or
new business fact is introduced.

Final focused evidence passed 45 Planning tests and 30 Réalisations tests in
separate runs, plus one disposable-PostgreSQL execution-contract test. Lint,
format, Ruff, strict mypy and the production PWA build passed. Independent
specification and standards reviewers cleared the corrected copy after draft,
amendment and returned-request wording was made exact. Human visual and zoom
acceptance remains separate from this implementation review.

## Follow-up — automatic updates and faithful Activity presentation

Authorized 2026-11-12. The refreshed references in
`docs/inspiration/activities/`, `docs/inspiration/realisations/` and
`docs/inspiration/pta/pta-activity-table.png` govern this slice. The user's
explicit corrections take precedence over older update-prompt and presentation
rules.

### Outcome and boundaries

- A downloaded application update never exposes a version prompt. The waiting
  worker activates automatically and the browser performs a hard navigation
  through `/logout` before displaying `/login`, ensuring that the new bundle
  starts with the server session closed. This can
  discard an unfinished local form; that is the approved consequence of immediate
  replacement. No offline mutation or draft persistence is introduced.
- A session-service failure clears the unusable local session automatically and
  returns to the ready login form. Refreshing the login page retries normal
  session verification without requiring **Réessayer la connexion**.
- Dashboard attention rows keep their actual destination and use a concrete verb
  derived from the required action: complete/correct an Activity, prevalidate or
  validate the named planning or financial request, or declare a reversement.
- Planning and Execution Activity identity, tab order, panels and controls follow
  the refreshed Activity references. Existing permissions, workflow actions and
  server facts remain authoritative; prototype-only revision labels, demo data and
  controls are excluded.
- Planning and Execution lists follow their respective refreshed table references.
  Long Activity, Project and Agent names wrap inside bounded columns; the Agents
  column displays every returned assigned name without overlapping adjacent
  content. Empty, loading and error behavior remains distinct.
- The existing shared date and exact-XOF helpers become the sole presentation
  contract for touched Activity surfaces. Missing or invalid values display `—`;
  explicit zero displays `0 F CFA`; dates never shift across time zones. Screens
  and reports do not describe a missing amount as **Non renseigné**.

### Implementation slices and checks

| Slice                            | Existing seams and changes                                                                                       | Focused evidence                                                                                                                                                   |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Update and login recovery     | `PwaUpdate`, root composition, access coordinator, service-unavailable login and auth E2E                        | Waiting worker activates without UI; hard navigation completes `/logout` before `/login`; refreshed failed session reaches the form without a click                |
| 2. Attention actions             | Dashboard attention reason/action presentation, with the existing API facts and destinations                     | Agent, Supervisor and Validator examples expose the verb matching the row's actual work and retain the correct Activity link                                       |
| 3. Shared formatting             | `shared/lib/format`, Activity/Execution consumers and fiche formatting                                           | Missing, zero, large exact XOF, date-only and Benin timestamp cases; no touched money surface emits `Non renseigné`                                                |
| 4. Shared Activity presentation  | Planning detail, Execution detail, Programming, finance, History and documents using current actions and queries | Direct populated comparison with every applicable refreshed Activity reference; tabs remain Programming, Réalisation & finances, Historique, Pièces justificatives |
| 5. Planning and Execution tables | Shared column sizing/wrapping patterns, Planning table and Execution list                                        | Long Activity/Project/Agent names, narrow reflow, empty/filtered states and exact desktop comparison with PTA/Execution references                                 |

Use the existing Router, Query state, buttons, panels, status helpers and formatters.
Do not introduce a second Activity model, table framework, formatter layer or
update queue. After each vertical slice, run its focused behavioral check. At the
end, run affected lint/format/build checks, update project status and send the
candidate to an independent review-only agent. Visual automation is evidence;
human visual acceptance remains separate.

### Progress — automatic updates and Activity presentation, 2026-11-12

The waiting-worker prompt has been removed. A downloaded update now activates
immediately and, once the new worker controls the page, replaces the current
location with `/logout`; the existing logout flow then opens `/login` only after
the server session is closed. Session-service recovery clears the unusable session
automatically once per loaded application; remounting the login route cannot start
another logout, while a browser refresh creates a fresh coordinator and can retry.

Dashboard attention actions now name the actual work for planning and financial
requests. Planning and Execution Activity headers, tab spacing, Programming,
History, documents, finance summaries and operation tables were aligned with the
refreshed references without adding facts absent from the API. Administrative
finance now uses compact, expandable steps and opens the current actionable step.
Both Activity lists
use bounded columns, wrap long names and render assigned Agents one per line. The
shared formatters now own touched XOF, date-only and Benin timestamp presentation;
missing money is `—` and a real zero remains `0 F CFA`.

Focused final frontend evidence passed 45 Planning tests, 32 Execution tests and
63 update/auth/dashboard/format/history/portal tests. The production PWA build and
the real Chromium worker-activation journey passed, as did the focused Chromium
session-outage journey. ESLint passed with the existing coordinator cleanup
warning; frontend formatting, backend Ruff and backend formatting passed. The 13
focused backend fiche tests passed against a disposable PostgreSQL container,
which was removed after the run. A broader auth E2E file ran four tests successfully,
including the changed recovery journey, then exposed two pre-existing stale
**Relances** selectors after that sidebar item had already become
**Notifications**; the focused changed journey was rerun cleanly.

## Follow-up — focused Activity reading and entry, 2026-11-12

Authorized 2026-11-12. This slice removes information that distracts from the
person's next decision and completes the interaction patterns already approved in
`docs/inspiration/activities/`, `docs/inspiration/pta/` and
`docs/inspiration/realisations/`. Existing workflow permissions, exact XOF values,
draft visibility and immutable audit records remain unchanged.

### Outcome and boundaries

- The Activity timeline omits the routine draft-to-submission event and does not
  present a creation snapshot as a long list of artificial before/after changes.
  The underlying audit records remain available to the authorized global audit.
- Planning and Execution hold their page loading state until all data needed for
  the first complete view is ready. A missing annual PTA is explained with a
  compact status alert.
- Activity lists start without an active filter for every role. Planning exposes
  only **Soumise pour prévalidation** and **Validation définitive attendue** as
  quick choices. Agent search sits beside the Filters control; the filter panel
  contains workflow state and overlapping dates and applies choices immediately.
- The Execution row action follows the approved compact outlined button. Finance
  does not repeat a supporting-documents panel. Operation entry opens in a
  centered, content-sized modal with the approved fields and hierarchy, without a
  document block.
- **Fiche récapitulative** fetches the protected PDF into a preview dialog first;
  download remains an explicit action from that preview. Authorization and
  document-delivery errors keep their current handling.

### Implementation seams and focused checks

| Slice                    | Existing seams                                                                      | Focused evidence                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Human Activity history   | Activity-specific audit query and projection, Activity timeline                     | Submission is absent before pagination; creation has no invented changes; meaningful decisions and reasons remain       |
| Complete initial loading | Planning and Execution query readiness                                              | A resolved primary read cannot reveal a partial page while required reads remain pending                                |
| Activity list controls   | Shared Activity explorer filters, Planning quick states and reviewer query defaults | No initial state/review parameter; two Planning quick choices; Agent search outside the filter panel; no results button |
| Finance entry            | Execution detail, operation modal and administrative panels                         | Centered operation form retains valid fields; no supporting-documents block; compact row action remains usable          |
| Fiche preview            | Shared protected PDF preview used by Planning and Execution                         | CTA opens the fetched PDF preview without an automatic download; explicit download reuses the protected artifact        |

Implement each behavioral seam with a focused failing check first. Then run the
affected frontend and backend suites, lint/format/build checks justified by shared
changes, update project status and send the complete diff and evidence to an
independent review-only agent.

### Progress — focused Activity reading and entry, 2026-11-12

The Activity timeline now removes routine submission before pagination and keeps
creation as a valid dated event without rendering its stored snapshot as invented
before/after changes. The authorized global audit still retains both the complete
creation detail and submission event.

Planning and Execution now wait for every enabled first-view read before revealing
their page. Planning opens with the complete authorized Activity list for every
role, presents only the two review-stage shortcuts, and places searchable Agent
selection beside the compact state/date filter panel. Missing PTA guidance is a
small status alert. Execution uses the compact row action, no longer repeats
supporting-document panels in finance or Operation entry, and opens Operation
entry in a centered content-sized modal.

The shared protected Fiche control now opens the fetched PDF in a large centered
preview and downloads that same artifact only after an explicit action. Planning
and Execution both use this control.

Final frontend evidence passed 79 Planning and Execution tests. The corrected
Operation modal then passed the complete 33-test Execution file. ESLint, full
Prettier, the production PWA build and `git diff --check` passed; Vite retained its
existing large-bundle warning. The complete disposable-PostgreSQL audit-history
file passed 14 tests, including global-audit preservation, Activity pagination,
draft visibility and the concise timeline. Focused Ruff, backend formatting and
strict mypy passed. The disposable database container was removed. Independent
review cleared the corrected candidate with no blocking findings. Human visual
comparison at normal and zoomed sizes remains the acceptance boundary.

## Follow-up — Activity explorer control fidelity, 2026-11-12

Authorized 2026-11-12. Planning and Execution continue to share one Activity
explorer. Its search, Agent and Filters controls now follow the supplied PTA and
Réalisation references as one compact row with 8 px gaps. The Agent and filter
panels use the reference width, right-edge anchoring, typography and internal
spacing; the Agent trigger uses the supplied icon and short visible label. This
presentation change does not alter filter values, server queries, role visibility
or the previously approved immediate filter application.

### Progress — Activity explorer control fidelity, 2026-11-12

The shared explorer now uses the supplied icons, short trigger labels, 8 px row
gap, 13 px control copy, 300 px right-aligned panels and 36 px date triggers.
Agent search retains the reference title, focused search field and compact result
list. Final serial verification passed all 46 Planning tests and all 33 Execution
tests, plus ESLint, Prettier and the production PWA build. Independent review
cleared the corrected candidate. Human comparison at normal and 200% zoom and at
narrow widths remains the visual acceptance boundary.

## Activity finance and fiche alignment — progress, 2026-11-12

The execution detail contract now supplies realization status, signed unused
balance and settlement-based required reversement as server facts. The screen no
longer recomputes reversement in the browser. Approved zero spending reports a
zero required reversement while retaining the allocation as unused balance.

Internal and Partner fiches now share an A4 ReportLab layout derived from the two
supplied references, with packaged DejaVu fonts, six template sections, a separate
chronology page, continuation pages and page N/total. Their projections remain
separate: the internal chronology includes the first submission, while Partner
financial facts appear after closure and Partner documents remain explicitly
shared and current. Partner fiche delivery uses the protected preview.

Reversement entry accepts an optional Activity document. Declaration and upload
are separate outcomes; confirmed declaration success is retained, and an upload
can be retried without resubmitting the reversement. Uncertain upload responses are
reconciled against a pre-upload document baseline before any retry.

The corrected candidate also preserves returned and resubmitted initial
programming as one initial approval cycle, records decision roles and reasons in
the internal chronology, distinguishes the four realization states and lets long
valid history continue across pages. The operation-table headings, values, total
and following section were also measured against the supplied PDF; their anchors
match within 0.06 points and monetary values remain on one line. A clean final
selected backend run passed 25 finance, fiche, Partner and closure tests against
disposable PostgreSQL. The 41
affected frontend tests, Ruff, backend formatting, strict mypy, ESLint, Prettier,
the production PWA build and `git diff --check` passed. ESLint retained one
existing session-cleanup warning and Vite retained its existing large-chunk
warning. A broader diagnostic execution run completed 79 passes and nine
failures; seven failures are stale migration-head or downgrade-message assertions,
and the two report failures found there were corrected and included in the clean
final selected run. The same independent reviewer rechecked the corrected renderer,
dynamic operation rows, decision history and evidence and cleared the final
candidate with no blocking finding. Human visual acceptance remains separate.

Pre-commit review corrected French month names for server datetime values and
removed current-role inference from historical audit milestones. The Execution
summary now displays the server's realization status. Optional evidence upload
has an in-flight guard and Activity-scoped cancellation; its recovery test asserts
actual upload success without repeating the reversement. Partner fiche denial
clears the Activity detail and document cache, and scope revocation clears loaded
PDF previews. The obsolete internal and Partner renderers were removed. Separate
specification and standards reviewers cleared these corrections.

Pre-commit evidence: `pytest tests/reports/test_fiche.py
tests/reports/test_activity_fiche_pdf.py tests/partner_portal/test_partner_fiche.py
-q` completed 18 passes and one stale current-role assertion failure; the corrected
`test_closed_activity_fiche_contains_authoritative_history_and_is_audited` then
passed alone. The three-file frontend run (Execution, Partner portal and Planning,
`--maxWorkers=1`) completed 85 passes and two Planning timeouts; both timeout cases
passed their focused rerun. Earlier overlapping jobs produced additional timeouts,
and an initial backend attempt had no running database. These are focused final
reruns, not a claim that the earlier combined runs passed. Ruff, formatting,
strict mypy, ESLint, build and diff checks passed; existing warnings remain.

## Activity detail shell correction — progress, 2026-11-12

The Activity identity header now belongs to the canonical Activity page and stays
mounted while Programming, Realization and finance, History, and Supporting
documents change independently below it. Entry from Planning or Execution is
carried as route context, so the sidebar keeps the section from which the person
opened the Activity. Execution lists, dashboard attention items, financial
notifications, and legacy Execution detail URLs now lead into that canonical
page.

The finance tab no longer renders a second Activity header or the page-top refresh
spinner. Open administrative steps use the parent section surface without a nested
bordered card. The Operation dialog retains the required financial fields and
variance observation, uses the centered shared dialog, and omits the supporting-
document block. Internal **Fiche récapitulative** actions download the protected
PDF directly; the Partner portal keeps its separately approved preview flow.

Focused coverage verifies that one header DOM node survives Programming/finance
switches, Execution remains selected in the sidebar, and the fiche download does
not open a preview dialog. `npm run test:unit -- --run
src/features/execution/execution.test.jsx
src/features/dashboard/dashboard.test.jsx
src/features/notifications/notification.test.jsx` completed **39 passed**. ESLint,
Prettier, the production PWA build and `git diff --check` passed; Vite retained its
existing large-chunk warning. Human visual comparison at normal, narrow, and
zoomed widths remains the outstanding acceptance step.

## Agent finance action correction — progress, 2026-11-12

The finance tab now keeps planning mutations out of the Activity header while
retaining the direct fiche download. An assigned Agent enters each Operation
through **Renseigner** inside the expanded physical-realization accordion. That
accordion reports expenses entered rather than claiming unfinished Operations
are complete, and it collapses after the final Operation is completed.

The finance summary follows the supplied three-column composition: current
authorized budget, partial/final spending with Operation count, and amount to
return. Realization status and unused balance remain available under
**Autorisations et montants confirmés**; unknown financial values use the
reference copy **Non renseigné** while exact zero remains `0 F CFA`. Before
physical realization is complete,
the administrative rows remain collapsed and marked **À venir**; opening one
shows only the unmet-prerequisite message, without a nested card or premature
financial CTA. The external-virement row and disabled closure action remain
visible in their respective accordion blocks, matching the initial reference
state.

After approval, authorization, external-virement confirmation, reversement and
closure remain sibling accordion steps. Each declaration or correction CTA is
shown inside the step it changes; completing one step does not hide the completed
chronology required to understand the next one. An unfinished Activity whose
entered amounts currently total zero still shows the future finance sequence;
the zero-spending branch appears only after every Operation is complete.

The combined Planning and Execution run completed 82 tests on the final source.
ESLint passed with the existing session-cleanup warning, the production PWA
build passed with the existing large-chunk warning, and `git diff --check`
passed. Independent specification and standards re-review cleared the final
candidate. Human visual acceptance remains outstanding.

## Automatic Operation start — progress, 2026-11-12

The separate **Démarrer** action has been removed. An eligible Agent opens the
Operation form directly, and the first accepted submission records the immutable
start time together with the submitted amount, completion state, or observation.
An empty submission cannot start an Operation. Existing Activities whose history
contains the former separate start event remain verifiable by the financial
workflow.

Focused PostgreSQL verification completed 22 affected execution cases and eight
adjacent finance, access, and report cases. The focused frontend interaction
passed. Ruff, strict mypy, ESLint, Prettier, and `git diff --check` passed.

Pre-commit review removed an unapproved global 10px DatePicker override and
updated the reviewer-created Activity test to submit Operation completion once.
Its invisible-draft expectation and disposable downgrade setup now match the
current privacy and notification rules. Independent specification and standards
reviewers cleared these corrections.

Final candidate verification used disposable PostgreSQL with `pytest -q
tests/planning/test_activity_briefs.py::test_reviewer_brief_completed_by_assigned_agent_then_reviewed_by_creator
tests/execution/test_execution.py -k 'not clean_predecessor and not evidence_refuses
and not mutation_rejects_parent' --tb=short`: **30 passed, 3 deselected**.
The three exclusions are the previously identified PTA-creation fixture and
older downgrade expectations; this is not a full execution-suite pass.
A separate selected run of disbursement submission, legacy-history compatibility,
funding-approval races, reassignment access and both changed Fiche journeys passed
all **8 cases**. The focused frontend one-submission test passed (35 unselected).
Ruff check/format, strict mypy for both changed source modules, documentation
Prettier and `git diff --check` passed. Existing Starlette deprecation remains.

## Execution-context header correction — 2026-11-12

The execution entry context now controls the shared Activity breadcrumb and
planning-action visibility across Programming, finance, History and documents.
The execution header keeps the fiche action and omits the planning next-step
prompt. Planning entry retains its authorized planning actions. The finance
summary disclosure **Autorisations et montants confirmés** is removed at the
user's request. Missing amounts use the shared dash presentation; explicit zero
continues to display `0 F CFA`. Regression coverage follows the same header
through all tabs and checks the execution breadcrumb and action visibility.

History now loads inside its existing tab placeholder rather than replacing the
Activity page, preserving the header during its first visit.
Final combined Planning and Execution verification completed **82 passed**
(`npm run test:unit -- --run src/features/execution/execution.test.jsx
src/features/planning/pages/planning.test.jsx --maxWorkers=1`). ESLint, Prettier,
production build and `git diff --check` passed, retaining the existing hook and
bundle-size warnings. Independent specification and standards re-review cleared
the candidate. An earlier combined run caught the History remount (81 passed,
1 failed); the final run includes that correction. An independent concurrent
focused run timed out, then passed both selected tests with a 15-second timeout.
Human visual acceptance remains outstanding.

## Weighted Tasks and Subtasks — 2026-11-13

The Activity editor and execution view now use Tasks and one optional level of
Subtasks. Exact weights, date containment, child-budget allocation and submission
totals are server validated. Drafts retain incomplete weights. Approved execution
uses manual Task progress or binary weighted Subtask completion, independently
from spending, and consolidates child spending once at Task level.

Migration `0036_weighted_tasks` preserves Task identifiers and legacy snapshots.
Legacy approved Activities do not receive fabricated weights; weighted progress
remains unavailable until an approved amendment supplies complete planning data.
The next Activity slice must use the public `tasks` contract and the shared exact
number, date and wrapping badge controls rather than reintroducing local variants.

Review corrections completed the amendment and execution invariants: cancellation
reconciles the approved hierarchy, final approval invalidates stale parent totals,
zero is valid manual progress, and a second Subtask execution entry is treated as
a correction across the UI, API and history. Partner lists use creation-time
keysets, Partner/Fiche projections include derived progress, and the Subtask
foreign key proves that its parent belongs to the same Activity.
Financial verification now replays Subtask audit chains before consolidating
their facts at Task level, so it detects child-level tampering and excludes every
Agent who recorded either Task or Subtask execution from reviewing the request.
The funding-shortfall replay uses the same hierarchy without double counting;
an earlier child overspend remains blocking after a later amount correction.

### Review remediation plan — drafted 2026-11-13

Status: implemented and independently re-reviewed. The subsequent review
identified eight unresolved findings and superseded the earlier review clearance.
This plan covers those findings, their adjacent workflows and verification.
Existing business rules, exact XOF amounts, immutable approvals, role/resource
isolation and the existing financial approval process remain the governing
contracts. No standalone Tasks module or additional Subtask approval is planned.

**Approved transfer decision.** Shift every dated Task and Subtask by the calendar
day difference between the old approved Activity start and the proposed start.
Preserve durations and spacing; show the proposed hierarchy before submission.
If a shifted date falls outside its new parent period, require correction before
submission rather than clipping dates. Missing legacy child dates remain unknown;
do not invent dates or weights for previously approved legacy records.

For example, moving an Activity start forward seven days moves each child start
and end forward seven days. A shorter proposed Activity period requires the Agent
to extend its end or choose another start; child dates remain the exact reviewed
shift. Recalculate the preview from the approved baseline when the proposed start
changes, avoiding accumulated shifts.

1. **Restore current-contract regression coverage.** Update shared request
   fixtures and response assertions to `tasks`, valid weights and contained
   dates. Update migration expectations to `0036_weighted_tasks` and include
   `pta_subtask`. Retain dedicated predecessor/legacy snapshot cases using their
   historical shape; do not restore public `operations` aliases. Run affected
   suites to distinguish outdated fixtures from application failures. Add focused
   failing regressions for the remaining findings before their respective fixes.

2. **Make hierarchy edits atomic and preserve partial input.** In Activity update,
   assign or flush the fully populated new Task before constructing its children.
   Temporarily vacate current Subtask positions and flush before applying final
   ordering/removals, using the existing hierarchy restoration approach. Include
   description, dates and child presence in the frontend started-row predicate;
   only wholly blank rows may be ignored. Verify adding a new hierarchy to an
   existing draft, swapping children, removing the first child and retaining a
   description-only/date-only draft row with actionable validation. Verify failed
   saves roll back the whole edit and leave the entered frontend draft intact.

3. **Enforce funding pauses on effective progress.** Parse proposed manual
   progress and derive completion before checking the correction exception.
   During a funding pause, reject physical progress increases even when the
   request's completion flag disagrees. Keep eligible reasoned downward spending
   corrections available, without erasing historical funding obligations. Project
   the equivalent correction action for Subtasks and use the existing editor.
   Verify rejected progress advancement below and at 100%, contradictory request
   fields, accepted downward corrections, remaining pause and UI draft retention.

4. **Keep progress display truthful and transfer dates contained.** Reserve
   displayed 100.00% for an exactly complete weighted aggregate; show at most
   99.99% for an incomplete aggregate that would otherwise round up. Preserve
   exact calculation until formatting and apply the rule to internal, Partner
   and Fiche projections. Test the near-100% case and exact completion.
   Extend the existing transfer form and request contract with the proposed
   hierarchy dates, retaining Task/Subtask identities and approved financial
   facts. The server must validate exact membership, date ordering and containment
   before storing the immutable transfer revision. Approval persists exactly
   those reviewed dates; return/cancellation leaves the approved baseline intact.
   Verify day-offset shifting across year/leap-day boundaries, shortened periods,
   explicit corrections, altered/missing child IDs, legacy undated records and
   approval/return/cancellation. Inspect older pending transfer compatibility so
   approval cannot silently retain invalid child dates or invent reviewer consent.

5. **Verify, record evidence and obtain independent review.** Run affected
   planning, execution, funding, transfer, financial integrity and migration tests
   on disposable PostgreSQL, including adjacent authorization/isolation cases.
   Run focused frontend interactions and browser checks for changed transfer and
   correction forms, then applicable lint/type/format/build checks. Record exact
   commands, candidate, results, exclusions and migration compatibility evidence;
   a focused pass must not be presented as a full-suite pass. Update this section
   with progress and unresolved work after each slice, and update project status
   when remediation is complete. Finish with a separate review-only agent who
   did not implement the changes; resolve blocking findings and return the final
   candidate to that same reviewer. Review does not establish human acceptance
   or production readiness.

Primary seams: backend planning routes and hierarchy calculations, execution
mutation/action projection, migration tests and shared workflow fixtures;
frontend Activity editing, transfer form and execution tests. Reuse existing
components and transaction boundaries. No production migration or deployment is
authorized by this documentation-only task.

### Remediation implementation — 2026-11-16

The hierarchy update now flushes new Tasks before attaching Subtasks and vacates
existing child positions before reordering them. The Activity form retains rows
that contain descriptions, dates, weights or Subtasks, so validation can explain
incomplete entries instead of dropping them. Funding pauses evaluate the effective
manual or derived progress and expose the same correction path for Subtasks.
Weighted Activity progress remains below 100% until every weighted contribution is
complete.

Annual transfer requests now contain the reviewed Task and Subtask dates. The UI
previews an exact calendar-day shift from the approved baseline, and the server
requires the complete hierarchy with matching identities, the exact shift and
valid parent containment. Approval persists those reviewed dates. Migration
`0037_transfer_task_dates` narrows the immutable transfer comparison to permit
only these hierarchy-date changes and rejects older pending transfers that did
not capture reviewer consent for them.

Current-contract fixtures use the public `tasks` request and response shape while
historical snapshot tests keep their stored `operations` shape. Focused PostgreSQL
checks passed for hierarchy creation and reorder, weighted execution and funding
pause behavior, migration repeatability, transfer persistence and legacy pending
transfer rejection. The complete transfer suite first reported 53 passes and
three stale-fixture failures; each affected case passed after correction. The
focused frontend checks passed 51 tests across Activity planning, exact numbers
and dates, followed by all 49 Activity-planning tests after review corrections.
Ruff, mypy and ESLint passed. A broader planning run stopped at historical
multi-Agent draft-assignment scenarios that conflict with current draft privacy;
it is not reported as a full pass. Final format, build and independent-review
evidence follows on the final candidate.

Independent review then found that audit compaction omitted the new Task fields
and Subtasks, and that clearing the Activity amount could send an empty value even
though the form remained enabled. Safe audit facts and the human history projection
now cover Task descriptions, weights, dates and the Subtask hierarchy. The compact
record retains only changed allowlisted fields, uses bounded identity for additions
and removals, and omits unchanged children. A blank Activity amount now resolves
to the exact sum of its Tasks. Both focused regressions passed. The surrounding
audit file reported 10 passes and five historical current-contract fixture
failures; it is not reported as a full pass and does not replace the focused
hierarchy-audit result. The same independent reviewer cleared the corrected
candidate with no blocking finding.

### Follow-up review corrections — 2026-11-17

A later review found six remaining integration gaps. Active Activity replacement
audits now read the public `tasks` payload, reviewer screens show the full Task
and Subtask hierarchy, and legacy unweighted completed Tasks preserve completion
when an Agent corrects spending. Backend execution and Partner projections also
preserve that legacy completion after a weighted amendment. Consolidated Subtask
spending is range-checked before assigning the Task total, so an exact-XOF
overflow returns the intended 422 without changing execution or audit state.
Shared workflow fixtures now use Task execution routes and retain hierarchy
fields, weights, dates and progress.

The affected backend run passed 18 PostgreSQL tests across audit history and
weighted execution. Independent re-review then found that the funding-pause
guard still compared a legacy completed Task against stored zero progress after
a weighted amendment. The guard now uses the same effective completion fallback
as read projections. Its end-to-end regression failed before the correction and
passed afterward; the full weighted-execution file passed all four tests.

The combined frontend run passed 86 of 87 tests; one
unchanged zero-spending interaction exceeded its five-second timeout and passed
immediately on focused rerun. All 49 Activity-planning tests passed. Ruff, mypy,
Prettier, ESLint and the production PWA build passed, with the existing React
hook and bundle-size warnings. The corrected funding-pause candidate has been
returned to the same independent reviewer, who cleared the remaining P2 with no
additional blocking finding in the focused re-review.

## Authoritative Activity, Task and Subtask editor — 2026-11-18

Status: implemented; independent re-review cleared. The visuals in
`docs/inspiration/activities/edit` govern this slice, with the settled exceptions
recorded in business-rules.md and design.md.

The Activity amount remains a manual value and never defaults to the Task total.
Initial Drafts, amendment Drafts and returned corrections may preserve missing
Categories, dates and weights and mismatched allocation totals. A Task or Subtask
must have a name and positive amount before it can be saved into the Activity
Draft. Submission is blocked until Activity/Task/Subtask amounts balance, Task and
Subtask weights each total 100%, Categories and dates are present, and dates stay
within their parent periods.

The Activity editor keeps its Répartition card and compact Task rows. Task editing
uses a dedicated three-card page; Subtask editing uses the approved right drawer.
Both removal paths ask for confirmation. Activity detail keeps Task-only rows.
The editor accepts one optional Activity attachment: the Activity is saved first,
then the file is uploaded. Upload failure leaves the saved Draft in place and
stops a requested submission.

Implementation seams are the existing Activity create/replace/submission routes,
hierarchy normalization, amendment projection, Activity editor and shared number
and date controls. Migration `0038_draft_task_categories` makes a Task Category
nullable only so incomplete editable states can be restored; strict submission
continues to require an active Category. No standalone Task module or Subtask
approval workflow is added.

Final evidence must include focused hierarchy and Activity-editor behavior,
backend static checks, frontend lint/build, migration compatibility when a
disposable PostgreSQL database is available, and review by a separate review-only
agent. Runtime database checks that cannot run must be reported as unavailable,
not passed.

Implementation evidence: all 54 Activity-planning tests, the two shared exact
number tests and seven pure hierarchy tests pass. Ruff, mypy, ESLint, Prettier and
the production build pass with the existing hook and chunk-size warnings. The
responsive Activity → Task → Subtask Playwright journey passes, as does the
browser regression proving that attachment failure keeps the saved Draft and
skips submission. Alembic reports migration `0038_draft_task_categories` as its
single head. No `TEST_DATABASE_URL` is available, so disposable PostgreSQL and
migration upgrade/downgrade checks remain unavailable rather than passed.

The independent reviewer found Category-outage Draft blocking, dropped Category
pagination, a missing Task form boundary, incomplete visual hierarchy, stale
terminology, nonconforming number semantics, untranslated copy, missing focus
restoration and stale status documentation. The candidate now keeps Draft save
available during Category failure, restores cursor navigation and Task form
semantics, isolates drawer submission, restores focus, uses Pondération, keeps
formatted exact numbers as text inputs, centralizes the new French copy, and
records the current manual Activity-amount rule here and in project status.

The second re-review found one remaining route-level Category-outage gap and two
accessibility/localization issues. New Activity creation now treats the Category
query as nonblocking, renders its retry inline, and preserves Draft save while
Category controls and submission stay unavailable. Task cancel/save returns
focus to the stable Activity Task-section heading. Responsive amount and weight
labels are real localized text, and the remaining Task-page action and Subtask
count copy uses the page locale. Route-level Category failure and focus-return
regressions now pass, and the full planning plus exact-number run passes 56 tests.
The same independent reviewer completed the focused re-review with no concrete
finding. Disposable PostgreSQL migration compatibility remains the only
unavailable verification item.

### Authoritative visual alignment — 2026-11-18

The populated Activity detail, Activity editor and dedicated Task editor were
compared again with every applicable image in
`docs/inspiration/activities/edit`. The detail header now carries the reference,
context, state, responsible Agents and planned dates in the approved order;
its Programming and Task cards sit beside the Budget and validation card, with
submission at the bottom of the workspace. Dates remain header-only under the
user's settled exception, and technical revision numbers remain hidden.

The Activity editor keeps the approved wide form plus 280 px Répartition card,
uses the custom French attachment control and places its actions beneath both
columns. The Task page is centered at the approved bounded width with three
cards and no sidebar. Category creation is now an action inside the Category
selector. The Subtask drawer uses the approved 560 px desktop width, title and
parent-Task header, compact two-column fields and fixed bottom actions. Required
data rules, Draft behavior and validation workflows are unchanged.

The focused planning and exact-number run passes 58 tests, ESLint passes, and the
production build passes with the existing bundle-size warning. The complete
populated Activity → Task → Subtask Playwright visual flow passes at desktop,
reflow and mobile widths, and fresh rendered screenshots were inspected against
the references. The broader planning-reference browser flow reaches its
pre-existing calendar-dialog focus-return assertion and fails there; that
calendar interaction is outside this Activity visual slice and is not reported
as passed.

The final component-standard pass removed local card and list imitations from
these three screens. Activity, Task and Subtask cards now use the existing shared
`Panel`; actions use the shared `Button`; amount and weight fields use the shared
exact-number control at the full width of their existing field grid; and compact
Task/Subtask rows use the application's established responsive table pattern.
The shared status badge now shrinks and wraps inside its available space instead
of forcing overflow during viewport changes. No new UI component was introduced.

After this pass, the focused planning and exact-number run again passes 58 tests,
targeted ESLint passes, the production build passes with its existing chunk-size
warning, and the rebuilt Activity editing Playwright flow passes at desktop,
918 px reflow and 390 px mobile widths. Fresh Activity detail, Activity edit,
Task edit and Subtask drawer captures were inspected against the authoritative
references. Independent re-review and the unresolved Draft-fiche product conflict
were the final gates for this correction. The independent reviewer found no
component-standard, responsive or accessibility defect in the candidate and
confirmed the Draft-fiche conflict requires the user's product choice before the
screen can be called an exact reproduction.

### Authoritative Activity realization and finance detail — 2026-11-18

The later references in `docs/inspiration/activities/details` supersede the former
combined **Réalisation & finances** presentation. Approved Activities retain one
stable identity header and now expose separate **Réalisation** and **Finance**
tabs. Réalisation uses one compact card for its summary, Task/Subtask execution
table and readiness requirements. Subtasks are collapsed initially. Finance uses
three separate cards for financial totals, financial requests, and external
administration/closure. Technical revision numbers are absent from the header.

This visual slice preserves the existing assigned-Agent execution boundary and
the existing rule that approved final décaissement or approved zero spending
establishes validated realization. It does not add a separate realization
approval workflow, permit early financial requests, require reversement evidence,
or make recorded external amounts editable. Existing `api.request` and
`api.download` calls are sufficient; no shared REST-client contract change is
required.

Independent review corrected five gaps: validation wording is now distinct from
physical execution, authorized amounts come only from an approved décaissement,
readiness actions respect execution permission and group repeated blockers,
financial requests have the approved compact list, and execution-summary failure
has an inline retry. Blocked closure no longer exposes a disabled closure action.
The request list is the only inline financial workflow summary: it shows the
latest decision with its actor/date and opens submission or review in the shared
right-side modal.
Financial decision projections now include the authorized actor display name,
and each zero-spending row carries its own declaration identity into the modal.
The focused execution and Planning run passes 94 tests; targeted Prettier/ESLint,
the production build and the canonical Activity Playwright flow pass. That browser
flow covers desktop/mobile Réalisation, collapsed/expanded Subtasks, absent,
pending and approved authorization amounts, read-only readiness, financial request
columns and execution-summary failure. Fresh screenshots were inspected directly
against the references.

The final tab-level correction removes the remaining accordion treatment from
external administration and closure. Those facts now use the approved flat rows;
eligible actions open the existing right-side modal, including virement,
reversement and closure forms. Finance shows partial spending and realization
state in the approved summary hierarchy; it omits the variance row when there is
no discrepancy. Réalisation uses the
approved Subtask disclosure and explicit **Non renseigné** spending value.
Programmation keeps dates in the Activity header and removes the revision number
from its budget label. The screenshot's technical financial-request codes are
intentionally omitted under the user's explicit hidden-data decision; the API
does not add those identifiers. Independent re-review also made financially
blocked closure details reachable from the flat closure row. Closed Activities
show the closer's resolved display name and link to the existing History tab;
the execution projection adds only that display name and continues to keep the
internal user ID out of the interface. A pending financial blocker names the
responsible Agent, Supervisor or Validator and opens the existing request without
duplicating its approval flow. The final affected frontend run passes 97 tests,
ESLint, Prettier, the production build and the canonical Activity browser flow.
Ruff and mypy pass for the additive backend projection. PostgreSQL integration
could not run because `TEST_DATABASE_URL` is unavailable.

### Shared modal and remaining visual correction — 2026-11-19

The remaining Activity mismatch came from forms nested inside the shared modal:
those forms did not receive the established field borders, labels and control
spacing. `BusinessModal` now applies the existing field treatment to nested forms,
so Task, Subtask, financial, virement, reversement and closure dialogs use the
same visual standard without a new component.

The compact Task/Subtask execution dialog now matches the approved centered
composition: Activity context, planned amount and period, execution inputs and a
bordered **Annuler / Enregistrer** footer. The optional execution observation and
the required audit correction reason appear only when the entered values make
them necessary; this keeps the normal modal compact while preserving the server's
variance and correction rules. Progress values omit API-only trailing zeros in
the header and Task table.

Financial request creation remains a centered dialog while review is a 640 px
right-side drawer. The décaissement review drawer now presents Activity context,
status/date, requested budget facts and decisions in the approved hierarchy. The
return reason appears only after **Retourner en correction**. Technical revision
numbers and synthetic request references remain hidden. Closure and external
record forms use centered confirmation dialogs and retain their existing business
permissions and workflows.

Focused verification covers the 41 Execution tests, 57 Planning tests, 12 app
tests, targeted ESLint, production build and the canonical desktop/mobile
Activity browser flow. Fresh Task-dialog, request-drawer and Activity captures
were compared with the authoritative references. The build retains the known
large-chunk warning. Independent review remains the final implementation gate;
human visual review remains acceptance.

The independent review then found and corrected the last modal-state and layout
gaps. Task and Subtask observation-only corrections now request the audit reason
required by the API. A successful financial return closes its form, preventing
another submission against a terminal request. Execution-list percentages use
the shared human-readable formatter. Review drawers keep their header and action
footer visible while the content scrolls, and confirmation checkboxes stay beside
their labels in closure, virement and reversement dialogs.

The corrected candidate passes all 45 Execution tests, including the new Task,
Subtask and financial-return regressions. The combined affected run passed 112 of
113 tests; the lone Planning submission timeout passed on its immediate focused
rerun. Targeted ESLint, `git diff --check`, the production build and the canonical
Activity Playwright flow pass. The build retains the known large-chunk warning.
Correction detection now compares the same normalized business values as the API,
so equivalent numeric formatting and surrounding observation whitespace do not
create a false audit correction.

### Activity Draft visibility and shared UI correction — 2026-11-19

Incomplete Activity programming no longer hides facts already saved in the Draft.
Existing Tasks and entered amounts remain visible while the readiness message
continues to identify missing submission information. The Activity fiche remains
available only after approval.

Activity detail, Activity editing and Task editing now share one compact allocation
table with white headers, divided rows, the **Montant prévu** heading and the shared
exact-percentage formatter. The edit summary uses **Budget de l’activité** and
**Budget restant**. Required-before-submission fields show `*`; Draft saving still
accepts the missing category, dates and weights allowed by the business rules.

The existing business modal owns the common right-drawer shell and Finance and
Subtask flows consume that variant. Shared field styles now serve both `Panel` and
`Modal`, and Activity/decision attachments use one shared file selector. Mobile
workspace navigation uses contained vertical links rather than horizontal overflow.
No API or RestClient contract changed in this correction.

The follow-up findings correction keeps **Situation financière** focused on
financial facts: it no longer repeats realization status in the card heading or
shows an empty variance. The shared drawer now owns full-height content and
bottom-action behavior, while the administrative closure row stacks its action
below the description at 390 px. Incomplete Drafts retain the standard **Budget
et validation** card without a duplicate creator block.

Activity document and reversement evidence forms consume the shared file
selector. Link actions use the shared Button recipe, Finance cards consume
`Panel`, percentage totals use the exact French formatter and revision periods
use the shared human-readable date formatter. The combined affected unit run
passes 102 of 104 tests; the two order-sensitive reversement scenarios both pass
on their immediate focused rerun. Targeted ESLint, `git diff --check`, the
production build and five relevant Activity browser journeys pass. The build
retains the known large-chunk warning. Four older scenarios in the broader
Planning browser file remain outside this correction and failed on existing
dialog/focus expectations; they are not reported as passing evidence for this
candidate.

### Activity detail and validation refinement — 2026-11-19

The Activity detail header, programming review states, decision dialogs and edit
forms now follow the latest approved references. The header uses the full
**Affectations** action, detail-only review labels read **À prévalider** and **À
valider définitivement**, and technical revision data stays hidden. The Finance
tab no longer displays **Dépenses par tâche**. Task weighting totals use the
human-readable `0 / 100 %` form.

Activity, Task and Subtask Drafts retain incomplete categories, dates and
weights, while entered values may not exceed their parent amount or 100 %, or
leave their parent date period. These constraints are enforced in the form and
API. Submission still requires complete dates, categories, exact amount totals
and exact 100 % weight totals. Activity description is optional. The top warning
lists the affected Task or Subtask and preserves entered data.

Task breadcrumbs return to the preserved Activity Draft for new and existing
Activities. Task and Subtask dates continue to use the shared calendar with
their Activity or parent Task bounds. Drawers use the shared internal-scroll
layout; Category creation, file selection, loading feedback, toasts and logout
consume the shared UI contracts.

Focused verification passed 75 frontend tests, 10 pure backend hierarchy tests,
targeted ESLint, Ruff, Prettier, the production build and the Activity detail,
decision-dialog and complete-editing browser scenarios. The database-backed
optional-description submission test was collected but could not run because no
disposable `TEST_DATABASE_URL` was configured. Independent re-review found no
remaining blocking Activity-specific issue. The build retains the known
large-chunk warning.

### Activity detail and finance visual correction — 2026-11-19

The current correction aligns the Activity identity header with the approved
compact composition, keeps only **Affectations** and **Fiche récapitulative** in
that header, and moves amendment, withdrawal and PTA-transfer actions into the
Programming tab's **Budget et validation** card. Planning decisions no longer
offer a decision attachment; Activity documents remain managed in the existing
documents tab. Financial request creation and review use the shared centered
dialog, with a first-step request chooser, and review controls are explicit
non-submit buttons so opening or deciding a request cannot submit a surrounding
form. Task/Subtask execution always shows an optional Observation field.

The updated realization list uses the supplied task-completion wording rather
than repeating the percentage below its physical state, and displays **Non
renseigné** when no expenditure has been recorded. Activity detail displays a
sentence for the not-started and completed states, or one percentage while work
is in progress. It never combines the two. The PTA list identifies the pending
review below its status and exposes the stage-specific **Valider** action while
retaining the settled rule that technical revision numbers remain hidden.

Execution observations are optional for Tasks and Subtasks, including when the
recorded expenditure differs from the planned amount. The disbursement integrity
check applies the same rule so a completed realization with an empty observation
can proceed through the existing financial workflow. Financial dialogs use the
shared centered modal at its standard width, keep return observations visible
with the decision actions, and preserve the Activity programming fact when the
separate execution summary is temporarily unavailable.

### Financial decision drawer correction — 2026-11-19

Financial request review follows
`activity-task-prevalidation-and-validation-modal.png`: décaissement and virement
reviews open in the shared wide drawer, show the requested and authorized amounts
as read-only facts, and expose one observation field for prevalidation, final
authorization or return. The observation is optional for approval decisions and
required only when returning a request for correction. No decision attachment
control is presented or sent. Request creation remains a centered dialog. The
later editable-request refinement below supersedes its former fixed-amount rule.

The Activity summary download uses the shared outline action. The shared
modal owns the wide drawer dimensions and internal scrolling, so financial pages
do not recreate that layout locally.

### Finance summary and closure-action refinement — 2026-11-19

The Finance summary keeps its four primary facts on one desktop row and falls
back to two and then one column on narrower screens. The redundant execution
pause sentence is removed because the pending authorization is already visible
in the financial status and request list.

The **Clôture de l’activité** row remains status-only while any prerequisite is
outstanding and after closure. It exposes **Clôturer l’activité** only when the
API grants the existing `close` action. Pending financial decisions remain
accessible from **Demandes financières**. The Activity summary download uses the
shared standard outline-button size from the approved header reference.

### Financial summary projection follow-up — 2026-11-19

The execution-detail response owns the current décaissement state, approved
amount and current virement facts. History cursors remain responsible only for
the visible request rows. This keeps **Montant autorisé** and its pending state
unchanged when users move through older request pages or open a historical item.
Financial modal labels and decision errors use the execution locale owner.

The frontend regression covers an older page containing only a returned request;
the summary still displays the current pending authorization from the Activity
projection. Browser geometry coverage verifies the four desktop Finance facts
share one row and reflow into four mobile rows. No financial workflow, amount or
permission rule changes in this follow-up.

Independent re-review cleared the three originating findings. Database-backed
execution verification remains unavailable without a disposable
`TEST_DATABASE_URL`. A separate approved-virement drawer scenario for a
conflicting older history page remains a non-blocking test-depth gap; the current
page-independent implementation was inspected directly.

### Activity reminder and PTA identity refinement — 2026-11-19

The approved Activity Programming view now shows the standard **Relance
administrative** card during the existing 21-day eligibility window. It presents
the approved deadline, current assigned Agents and planned reminder date, and is
absent before that window, after the deadline, after closure or withdrawal, and
without an approved revision. This read-only card does not claim that an email
was delivered and does not create another reminder workflow.

The PTA page now uses the Project name as its main title while retaining `PTA
{year} · description` beneath it. Activity dates remain in the detail header and
are no longer repeated in Programming. Technical revision numbers stay hidden.
The Réalisation quick filters and badge-only administrative status, PTA review
wording, and sidebar branding were intentionally unchanged following the user's
decisions.

The focused Planning and reminder run passed 73 tests. Targeted ESLint and
Prettier checks and the production build passed; the build retains the known
large-chunk warning. Independent review found no implementation defect after the
required plan/status record was identified for correction.

### Shared Activity UI follow-up — 2026-11-19

Activity list navigation and Task breadcrumbs now use shared pagination and
Router-aware breadcrumb primitives. Activity attachments use the same protected
preview/download lifecycle as Partner documents while retaining Activity-specific
denial handling and existing authorization. The Task editor, Draft behavior and
submission rules are unchanged.

### Editable financial-request creation refinement — 2026-11-20

The Agent chooser follows `activity-agent-new-demand-modal.png`. Décaissement
and virement creation share the centered composition from
`activity-demande-virement-modal.png`: exact XOF amount, optional observation,
one optional PDF/JPEG/PNG attachment, then only **Annuler** and **Faire la
demande**. Financial requests have no Draft action or Draft state. Décaissement
must be positive and no greater than recorded spending; virement must be
positive and no greater than the approved décaissement still available.

Submission stores the amount, observation and attachment atomically before the
existing Supervisor/Validator notification starts. Review remains the wide
drawer from `activity-task-prevalidation-and-validation-modal.png`: the amount
is read-only, the applicant's observation is visible, and the reviewer enters an
optional observation or the required return reason. The optional creation
attachment is not repeated in this review drawer. Decision attachments remain
excluded. Partial authorized amounts do not change
recorded spending: reversement continues to use allocation minus actual spending,
while each external transfer confirmation must equal its approved virement amount.
After a partial approval, the creation form exposes only the remaining balance;
successive approved requests accumulate, and reversement and closure remain blocked
until approved décaissements, approved virements and confirmations fully reconcile.
The internal fiche keeps a partially financed completed realization in
**validation attendue** and records validation only when cumulative approved
décaissements equal recorded spending. The Partner closed-finance projection
likewise totals every approved virement's latest exact confirmation and uses the
latest transfer date, instead of selecting one request.

The shared Button now owns authentication-link, Activity-header, destructive and
unstyled-control variants. OTP secondary actions use the authentication-link
variant; **Affectations** and **Fiche récapitulative** use the same compact header
variant. Production button controls route through the shared Button base.
`BusinessForm` supplies consistent required-field invalid styling and accessible
feedback through its shared field contract. Financial request metadata travels
as bounded UTF-8 in the body when an attachment is present; user text is not
placed in transport headers.

Focused verification on the final candidate passed 64 frontend unit tests, the
two controlled-browser returned-request journeys, 14 disposable-PostgreSQL
financial/migration scenarios, and three focused internal/Partner projection
regressions. Backend Ruff, focused mypy, Python compilation,
targeted ESLint/Prettier, the production frontend build and `git diff --check`
also passed. The broader financial run exposed an existing weighted-Task fixture
that cannot record execution because its approved Task weights are incomplete;
that unrelated scenario remains outside this financial-request correction.

The final review correction makes reversement Activity-scoped when approved
spending is covered by several partial virements. One reversement is visible from
every related virement, points to the request that recorded it, and freezes later
confirmation corrections for the whole Activity. The displayed basis remains the
Activity's total recorded spending. The focused disposable-PostgreSQL rerun passed
the cumulative-request, shared-reversement, unsettled-reversement and schema-drift
scenarios (4 tests); the focused Activity-form and financial frontend run passed
118 tests.

### Activity submission and visual consistency follow-up — 2026-11-20

Activity editing and Activity details now call one submission validator for the
required Activity, Task and Subtask fields, date boundaries, amount equality and
weight totals. An invalid Draft remains visible on the detail page with the same
specific corrections as the editor, and its submission action stays unavailable.
Draft over-allocation behavior is unchanged pending the user's final métier
choice; server submission enforcement remains authoritative.

The PTA page identifies the Project first, the Activity header uses the approved
24 px title and 12 px metadata scale, and the five-value financial summary stays
on one desktop row before reflowing to three-plus-two and then smaller responsive
layouts. The new-demand chooser hides virement until the approved décaissement
step makes it available. Financial request creation uses the shared exact XOF
input; review drawers omit the creation attachment block.

Required-field feedback now uses real DOM messages connected to each invalid
control. Activity, Task and Subtask manual validation uses the same shared message
component, while native required fields receive the same linked message from the
shared form handlers. The focused Planning, Execution and shared-UI run passed 123
tests, targeted ESLint and the production build passed, and the same independent
reviewer cleared the corrected candidate. The responsive four/five-value financial
composition was verified from its breakpoint classes; no rendered browser
screenshot pass was run.

### Activity header and financial-review correction — 2026-11-21

Activity-header actions use the shared Button base with an Activity-specific
variant that owns their approved compact height, border, radius, spacing and
type scale. **Affectations** and **Fiche récapitulative** use that variant and
contain text only. Text action buttons across the touched application surfaces
also contain no decorative icons; icon-only controls and control-state symbols
remain where the icon is the control or communicates selection. The sidebar
entry previously labelled **Relances** is now **Notifications**.

Selecting **Examiner** for a décaissement or virement now opens a centered
Activity-scoped modal directly from the current table data. It no longer writes
the request ID into the URL, starts a second detail-page load or replaces the
Activity with a loading screen. Both request types share the standard modal
composition from `activity-demande-virement-modal.png`; the historical-request
expander is absent. Legacy links containing a request search parameter now reach
the Activity page without opening a modal. Cancelling a request closes
the local modal after the server accepts the cancellation so stale request data
is not left on screen.

Focused frontend evidence: 154 unit tests passed across Execution, Planning,
Access, Audit, Notifications, Partner documents and the Agent assignment modal;
targeted ESLint, Prettier, the production build and `git diff --check` passed.
The focused Playwright administrative-settlement journey did not reach this flow:
its fixture exposed a service-unavailable page before the first financial action
and timed out on its older submission-button locator. This failed browser run is
recorded as a verification gap rather than a pass.

## Prop-driven modal simplification — implemented

Date: 2026-11-21. Status: first financial-review slice implemented, verified and
independently reviewed.
Source: the user's modal ownership rules and the read-only frontend audit.
Existing uncommitted implementation and unrelated work must be preserved.

### Outcome and rules

Links open pages, never modals. A page CTA opens a modal using data already
loaded by the page. Close controls and successful submission close it through
one handler. Correctable failures keep the modal and entered values available.

- Reuse the shared `Modal`, `Button`, form controls and existing financial content.
- Pass current server records through props; do not copy records or their IDs
  into UI selection state just to open a modal.
- Keep visibility local to the component owning the CTA and current record.
  If a record row owns the trigger, it can own a visibility boolean and pass its
  current props to the shared modal content. Reuse one row/content composition;
  do not duplicate a modal implementation for each request type or record.
- Do not substitute array positions, DOM attributes, persistent browser storage,
  or captured JSX for stored selection IDs. Those do not solve stale selection.
- API records may retain IDs required for API actions, Query keys, stable React
  keys and page routes. Removing redundant UI selection state does not change
  API identity or server authorization requirements.
- Editable values and their original version token remain a form draft. Query
  refresh must update displayed server facts without overwriting unsaved edits
  or pairing old edits with a newer version token.
- Keep the existing page-owned financial `useMutation`. Query invalidation
  refreshes affected server data; callbacks close the modal after success.
- Do not build a generic modal manager, registry or new state framework.

### First implementation slice: financial review

1. **Remove URL-driven modal behavior.** In `frontend/src/app/router.jsx` and
   `frontend/src/features/execution/ExecutionView.jsx`, remove the
   `financeRequest` and `virementRequest` search contract, URL-selected modal
   branches, and navigation used solely for modal closing. Old links must still
   reach their page without opening a modal. Notification links already target
   the Activity Finance tab and should retain that behavior.
2. **Simplify ownership.** Replace the overlapping request-selection IDs, modal
   type, mode and URL precedence for décaissement/virement review with a
   prop-driven composition owned by the CTA's current record. Keep creation
   choice separate from reviewing an existing record only where the actual flow
   requires it. Use clear modal naming instead of obsolete drawer names.
3. **Use loaded data.** Opening Examiner must not navigate, refetch an already
   loaded request, or replace the page with a loading screen. Refreshed Query
   records flow through props. If the reviewed record becomes unavailable, close
   or show its unavailability; never silently display a different request.
4. **Remove only redundant queries.** Delete the disbursement detail read used
   solely for modal deep links. Compare virement list/detail projections and
   administrative consumers before removing any virement query: confirmation,
   reversement and their histories may still require additional server data.
   Keep necessary reads in the page and preserve the RestClient contract.
5. **Unify completion.** Use one close callback for Cancel, the shared modal's
   close controls, successful decision and successful cancellation. Remove
   mutation-path-specific navigation for closing. Retain existing error,
   authorization, version-conflict and uncertain-result handling. Invalidate the
   existing affected Query keys without introducing a new invalidation layer.
6. **Preserve the approved composition.** Both review types use the centered
   shared modal based on
   [activity-demande-virement-modal.png](inspiration/activities/details/activity-demande-virement-modal.png).
   Preserve their approved review actions and read-only amount; do not copy the
   creation screenshot's editable amount, attachment or obsolete Draft action
   into review. No request-history expander. Keep existing shared header-button
   work and unrelated visual changes intact.

No backend, schema, API payload, financial approval or permission changes are
planned. Stop for a concrete decision if inspecting required data reveals that
this scope cannot preserve an existing workflow.

### Impact map and separate follow-ups

This initial impact map now records completed follow-ups and the boundaries that
remain outside the authorized slices.

| Area                                     | Audit assessment                                                                                | Proposed follow-up                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Dashboard invitation link / Access route | The former `invite: true` link opened a modal.                                                  | Complete: links open Users only; its CTA opens the dialog.                                                             |
| Access submission                        | The former `finally` branch closed forms after correctable errors.                              | Complete: close after success; retain ordinary invalid submissions, errors and input.                                  |
| Timeline Activity preview                | Complete: each row owns only tooltip/preview visibility and renders its current Activity prop.  | Query refreshes update an open preview; removing the row closes it without stored record or identifier reconciliation. |
| Project closure                          | Complete: each closure action owns local visibility and renders its current Project prop.       | Refresh updates the confirmation/version; removing the row closes it and focuses the Projects heading.                 |
| Document withdrawal                      | Complete: each document row owns withdrawal visibility and renders its current Query record.    | Refresh updates document facts while the reason and optional replacement choice remain in the open form.               |
| Task/Subtask execution                   | The page stored separate Task/Subtask selection IDs and repeated close statements.              | Complete: current props, local visibility and one close callback retain draft/version protection.                      |
| Funding request review                   | Complete: each row opens only its current request; creation handles only the pending increment. | Pagination remains in the Finance card and opening a row performs no detail read.                                      |
| Zero-spending and funding submission     | Some successful actions kept the modal open.                                                    | Zero-spending complete; funding remains outside the authorized slice.                                                  |
| Partner/Project edit dialogs             | Complete: each editable row owns its dialog and renders the current Query record.               | Draft values and the opening concurrency baseline remain stable through refresh; removed rows close with safe focus.   |

### Mechanisms to retain

- Shared `BusinessModal` owns layout, native dialog behavior, focus and dismissal
  through props. It does not need API knowledge.
- PTA, Activity, Task and Subtask editable drafts protect unsaved input and
  concurrent-edit detection. Activity creation reconciliation prevents duplicate
  creation after an uncertain response.
- Agent, Partner and Category selectors may query missing options; the current
  page does not necessarily contain the full selectable collection.
- Protected file preview loads bytes absent from page metadata and requires
  cancellation, access checks and temporary URL cleanup.
- Notification count and full notification list are different reads. Neither
  requires modal-opening URL parameters.
- Existing page routes and meaningful tab/filter/cursor parameters remain.

### Verification and completion gate

Use existing focused tests and extend them only for changed behavior:

- Both Examiner CTAs open the correct modal immediately, without URL mutation,
  redundant detail reads or replacing the underlying Activity page.
- Background refresh updates status, decisions and permitted actions while the
  modal is open; a removed record cannot become another request silently.
- Cancel and shared close controls dismiss consistently. Successful decisions
  and cancellations close; failed submissions preserve input and expose errors.
- Old modal query parameters do not open a modal. Notification links still open
  the correct Activity tab. Retained administrative queries continue to support
  confirmation, reversement and closure.
- Compare rendered populated dialogs and header controls with their supplied
  references at desktop and narrow widths. Repair the bounded browser fixture
  needed to reach these states; previous failed browser runs are not evidence
  that the new plan passes.
- Run affected unit checks, targeted lint/formatting, production build and
  `git diff --check`. Record actual commands, candidate and results in this plan.
- Finish with a separate review-only agent inspecting requirements, actual diff,
  surrounding code and verification evidence. The implementer fixes accepted
  findings and returns the candidate to the same reviewer. Do not declare the
  slice complete with unresolved blocking findings or verification gaps.

The financial-review slice now uses one local visibility boolean at each current
request row. The current Query record and Activity context flow into the shared
centered modal through props; no request ID or server-record copy is stored for
modal selection. Legacy `financeRequest` and `virementRequest` search parameters
are discarded by the Activity redirect and cannot open a modal. Décaissement
review no longer performs a redundant detail read. The existing virement detail
read remains because settlement confirmation, reversement and their histories
need data absent from the financial-request row.

Decision and cancellation drafts retain the version present when editing starts,
so a background Query refresh cannot combine unsaved text with a newer concurrency
token. Successful actions invalidate the existing Query data and close through
the same handler as Cancel and the modal close control. Failed actions keep the
modal and entered observation available.

The follow-up slice applies the same ownership rule to Task/Subtask execution and
zero-spending review. Each current row receives its Query record through props and
owns only a local visibility boolean; no selected Task, Subtask or zero-spending
ID is stored. The draft keeps its starting Activity version while refreshed facts
continue to arrive through props. Access dialogs no longer open from the
`invite=true` query flag, and failed Access submissions retain entered fields and
show their error inside the dialog. Funding remains outside this slice.

Cursor controls for décaissement, virement and zero-spending history are rendered
in the **Demandes financières** card. They use the shared `Pagination` component
and Router-owned cursors, so changing pages may remount the page without coupling
pagination to modal state.

Verification for the implemented candidate:

- `npm run test:unit -- --run src/features/execution/execution.test.jsx src/features/notifications/notification.test.jsx src/features/planning/pages/planning.test.jsx` — 119 tests passed.
- `npx eslint src/app/router.jsx src/features/execution/ExecutionView.jsx src/features/execution/FinancialRequestDetails.jsx src/features/execution/execution.test.jsx` — passed.
- `npm run build` — passed with the existing large-chunk warning.
- `MJL_PLAYWRIGHT_PORT=4189 npm run test:e2e -- e2e/execution/execution.spec.js --grep 'PTA-3B through PTA-3E'` — one focused administrative-settlement journey passed.
- The same focused journey captured the populated review dialog at 1440×900 and
  390×844 in `/tmp/mjl-financial-review-desktop.png` and
  `/tmp/mjl-financial-review-mobile.png`. Direct inspection against the approved
  centered modal confirmed the composition, spacing and narrow-width fit; the
  narrow dialog keeps its content in its own scroll area.

No backend, schema, API payload, financial approval or permission contract changed.
No commit or additional follow-up slice is implied by this implementation.
The separate review-only agent found one hidden-error defect and one missing visual
verification gate. After the dialog error display, decision/cancellation coverage
and desktop/narrow comparison were added, the same reviewer cleared the corrected
candidate with no blocking findings.

Follow-up verification on 2026-11-21:

- `npm run test:unit -- --run src/features/access/access.test.jsx src/features/execution/execution.test.jsx` — 69 tests passed.
- Targeted ESLint for the touched Access, Execution, Router and Dashboard files — passed.
- `npm run build` — passed with the existing large-chunk warning.
- `git diff --check` — passed.
- The browser journey was not rebuilt or rerun after the final error-display
  correction, at the user's direction. Earlier browser results do not establish a
  pass for this final candidate.

The follow-up independent review found that a failed zero-spending creation kept
the form but displayed its error behind the modal. The creation modal now renders
that error, retains the entered reason and uses one clear/close handler. The test
performs a failed attempt before a successful retry. The same reviewer rechecked
the correction and reported no remaining blocking finding; its independent
focused rerun passed both zero-spending and financial-pagination scenarios.

Corrective review on 2026-11-21 found that financial cursor navigation still
targeted the legacy Execution route, zero-spending reasons could adopt a refreshed
version token, Task/Subtask errors remained behind their modal, and Access row
dialogs still retained copied records. The corrected candidate keeps pagination
on the Activity Finance tab and gives each cursor control only its own query
loading state. Zero-spending creation and return reasons retain their starting
version. Task/Subtask mutation errors render inside the open modal.

Access creation keeps one page-owned visibility boolean, while each account row
owns only its action kind and receives the current Query record through props.
Role drafts retain the version from their first edit. Confirmed validation errors
keep the dialog and fields without refreshing the list; successful and uncertain
outcomes still refresh server data. Funding-request ownership remains a separate
follow-up requiring its single-request versus collection decision.

Final evidence for this correction: the focused Access and Execution run passed
71/71 tests, targeted Prettier and ESLint passed, `git diff --check` passed, and
the production build completed with only the existing chunk-size warning. Both
independent reviewers inspected the corrected candidate and reported no remaining
blocking finding. Per the user's direction, the browser journey was not rerun.

### Funding-request modal follow-up — 2026-11-21

The user confirmed that a funding-request row reviews only that request. Each row
now owns its local modal visibility and receives the current Query record through
props; the page stores no selected funding record or identifier. **Nouvelle
demande** shows only the pending funding increment. Funding history pagination is
rendered in the Finance card and uses its own Query loading state.

Successful submission, decision, return or cancellation closes through the same
modal callback. A rejected action keeps the modal, reason and starting Activity
version available for retry. Opening a row does not issue the available funding
detail endpoint. No backend, payload, permission or approval rule changed.

Focused evidence: all 52 Execution tests passed, targeted Prettier and ESLint
passed, `git diff --check` passed, and the production build completed with only
the existing chunk-size warning. Specification review found no behavior defect.
Standards review found that actionable funding reviews lacked the shared footer
and explicit **Annuler** action. The correction uses one bordered action footer,
the existing close callback, and removes the repeated inner title. The full
52-test run and build passed after the correction; the same standards reviewer
cleared it after targeted lint, diff and two focused tests. Starting-version
retention during a simultaneous Query refresh was inspected in code rather than
exercised by a dedicated test; no browser visual journey was run.

### Activity timeline preview ownership — 2026-11-21

Each timeline row now owns only whether its tooltip and preview are open. The
preview renders the row supplied by the current Activity list, so a Query refresh
updates an open preview without storing a copied Activity or selection ID. If the
Activity disappears from the refreshed list, its row and preview unmount together.
The timeline layout, navigation and Activity API contracts are unchanged.

Focused evidence covers the open-preview refresh, hidden-content regression,
removed-row focus fallback and existing date-position calculations. The combined
Planning run passed 71/71 tests; targeted ESLint and Prettier, `git diff --check`,
and the production build passed. Review found and corrected hidden closed-modal
content and missing focus recovery when a refreshed list removes the open row.
Both independent reviewers cleared the corrected candidate. No browser visual
journey was run for this state-only slice.

### Project closure modal ownership — 2026-11-21

Each eligible Project row now owns only whether its closure confirmation is open.
The confirmation renders the current Project supplied by the latest Query result,
so refreshed names and concurrency versions are used without storing a selected
Project or identifier. Successful closure uses the existing page mutation and
shared invalidation. Failure keeps the confirmation open. If refresh removes the
Project while its confirmation is open, the dialog unmounts and focus moves to
the stable Projects heading. Project editing remains unchanged because its local
draft is legitimate editable state.

Review found that a rejected closure left its error behind the modal and that the
success test stopped at the request payload. The correction displays the safe
error inside the retained confirmation and supports retry through the same action.
The affected Planning and timeline run passed 74/74 tests, including refreshed
version submission, successful refreshed state, failed-then-successful retry and
removed-row focus recovery. Targeted ESLint passed and the production build
completed with the existing chunk-size warning. Both independent reviewers
cleared the corrected candidate. No browser visual journey was run.

### Activity document withdrawal ownership — 2026-11-21

Each withdrawable document row now owns only whether its withdrawal modal is
open. The modal renders the current document supplied by the latest paginated
Query result; the page no longer stores a selected document object or identifier.
The required reason, optional replacement choice and replacement-page cursor are
temporary form state and remain available when the document metadata refreshes.
The existing page mutation continues to own the API command, audit/history
invalidations and success toast. No document API, permission or withdrawal rule
changed.

An ordinary failure stays inside the open modal with the entered values and a
safe error. A successful or already-reconciled withdrawal removes the row action;
if that unmounts the open modal, focus moves to the stable **Pièces
justificatives** heading. Ordinary Cancel and close actions share one reset path.

Focused evidence: the full Planning unit file passed 70/70 tests, including
replacement pagination, current-record refresh, retained reason/replacement,
failed retry, ordinary success, conflict reconciliation and focus recovery.
Targeted ESLint and Prettier passed, `git diff --check` was clean, and the
production build passed with the existing chunk-size warning. The same
independent reviewer verified both corrected outcomes and reported no remaining
blocking finding. No browser journey was run.

### Partner and Project edit-dialog ownership — 2026-11-22

Partner and Project creation keep one page-owned creation flag. Editing is owned
by the current table row: the page no longer stores a selected record or its
identifier merely to open an edit dialog. An open form therefore receives the
latest Query row through props while keeping the user's unsaved fields and the
concurrency baseline captured when editing began. This preserves conflict
detection instead of silently rebasing an in-progress edit.

A failed edit remains open, displays its safe error inside the dialog and keeps
the entered values for retry. Success, Cancel and the close control use the same
local close path. If refresh removes the edited row or its edit permission, its
dialog unmounts and focus returns to the stable page heading. Partner/Project
permissions, relationships, API paths and payload fields are unchanged.

Final evidence: the complete Planning unit file passed 74/74 tests, targeted
ESLint and Prettier passed, `git diff --check` was clean, and the production build
completed with only the existing large-chunk warning. Independent review found
one missing visible-row assertion after successful refetch. Both Partner and
Project tests now prove that final outcome; the same reviewer reran the corrected
tests and cleared the candidate with no remaining blocking finding or gap.
