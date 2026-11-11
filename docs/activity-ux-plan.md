# Activity UX improvements — reviewed plan

2026-11-10. Implementation authorized and completed; focused verification and
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
- Agents initially see their assigned Activities in a PTA, with a visible,
  removable filter to see all permitted Activities.
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

- Show a visible `Mes activités` filter by default for Agents entering a PTA
  without an explicit filter choice. Removing/resetting it means all permitted
  Activities; preserve that explicit choice through pagination, view changes,
  reload and browser Back via Router search state, not a new preference store.
  Filter before pagination; counts for results match table/calendar. Whole-PTA
  summary metrics remain unfiltered. Empty own results offer `Voir toutes les
  activités`, not a misleading empty-PTA message.
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

| Slice | Changes and existing seams | Focused verification |
| --- | --- | --- |
| 1. Consistent presentation | Inventory titles/labels/modal success owners; locales, Helmet/loading titles, PTA year choices; readable History and stable Activity-tab loading | Representative forms, modal success/error and history journey; desktop/mobile reference comparison; preserve permissions and safe projections |
| 2. Saved category descriptions | OperationType model/migration, create/list/output/audit, CategoryCreator and other creation consumers; Project-style modal | Disposable migration preserves old categories; create/read saved description; selecting new category neither submits nor resets Activity draft |
| 3. Create, resume, submit | Enforce complete-or-remove for started Operations; nullable initial-draft dates; create/update/output/allowed-actions contracts; Agent full form and brief; calendar controls, prefetch, two actions, Sans date | Title-only save → GET → reopen/edit → submit; started incomplete row blocks save without losing input; empty new rows ignored; invalid direct submission rejected; migration integrity and adjacent null-safe reads; existing approved/revision workflows retained |
| 4. Find assigned work | Router filter initialization/removal; API filtered count and pagination; table/calendar and empty state | Agent own/all journey, reload/Back and view switch, whole-PTA metrics unchanged |
| 5. Assignment notifications | Narrow recipient notification data/projection; assignment/create transactions and mail; shared inbox/popover/read behavior | Reviewer create and reassignment notify correct recipients; Agent creation and replay do not; read isolation, mail failure and existing reminder behavior |

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
  Slice 4 applies the removable Agent-owned filter through Router state. Slice 5
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
  immutable saved revisions remain the approval mechanism and may be opened from
  History through human wording such as `Voir les informations soumises`.
- `Budget et validation` includes `Assignée à` with the responsible Agent names.
  Shared status badges use the approved semantic colors from the supplied
  references. `Réalisation & finances` remains available after final approval;
  before approval the screen explains when it becomes available.
- Supervisors enter a PTA with the removable actionable filter
  `Soumise pour prévalidation`. Validators enter with
  `Validation définitive attendue`. These defaults show only requests the
  current user is eligible to decide; explicit filters and other actions remain
  available. Agent `Mes activités` behavior remains unchanged.

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
