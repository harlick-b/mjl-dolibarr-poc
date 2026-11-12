# Activity UX improvements — reviewed plan

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
