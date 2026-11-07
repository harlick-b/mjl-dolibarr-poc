# PTA and Activity workflow — implementation plan

Status: slice 1 implemented, verified and independently reviewed, 2026-11-07.
Slices 2 onward remain pending; this plan does not authorize starting the next slice.
Remove this file when the work is complete; retain settled rules in the current
guides and actual completion/evidence in project-status.md.

## Sources and precedence

- The user's latest workflow brief and clarifications govern behavior.
- `docs/inspiration/pta/` supersedes older references for the same surfaces.
- The updated `docs/inspiration/mjl-prototype.html` supplies connected interactions
  and states. Its final overrides matter: it contains superseded earlier versions
  of the same functions. Do not port its demo state or layered overrides.
- Reproduce the supplied composition, spacing, typography, controls and copy;
  preserve approved tokens, role navigation and centered empty messages. Exclude
  prototype-only scenario/demo controls and sample records.
- Business/security rules govern whether a displayed action can run. Record any
  unavoidable reference exception explicitly rather than silently changing rules.

## Confirmed journey and invariants

1. A Supervisor or Validator creates a named PTA for one Project/year; description
   is optional. The year defaults to the current year. Project/year are immutable;
   those roles may edit name/description. One PTA per Project/year.
2. From an existing PTA, **Ajouter une activité au PTA** opens a quick modal for
   Supervisor/Validator, and the full editing workspace for an Agent.
3. Quick creation requires title, start date within the PTA year and at least one
   active Agent. Instructions and end date are optional; an entered end cannot
   precede the start. An absent end stays absent, not an invented three-month date.
   **Créer et affecter** saves atomically, closes the modal and refreshes the PTA.
   No standalone **Brief initial** page.
4. The brief is an ordinary incomplete draft, not an additional workflow stage.
   Missing budget is unknown, not zero. Assigned Agents complete the required
   planning, Operations and budget before submission. Preserve the three-month
   editable end-date suggestion in the full Agent form without overwriting dates.
5. Agents self-assign on creation. Only assigned Agents edit/submit/execute;
   other Agents may read. Reviewers may reassign, keeping at least one Agent,
   without changing programming or validation state.
6. Creating a brief as a reviewer does not bar that person from their normal
   planning review. Agent submission and distinct Supervisor/Validator stages
   remain required. Later content contribution/submission still excludes review.
   Financial contributor exclusions remain unchanged.
7. User clarification: Supervisors may upload Activity documents. Documents remain
   Activity-scoped, including those shown inside the operation drawer. This does
   not grant Supervisor content editing, withdrawal, sharing or post-closure
   evidence administration.
8. Financial amounts remain exact XOF. Approvals, execution prerequisites,
   settlement, closure and Partner isolation retain their existing rules.

## Reference map

All images below are under `docs/inspiration/pta/`.

| Connected surface | Governing references |
| --- | --- |
| PTA index, creation, editing | `pta-page.png`, `create-pta.png`, `create-pta-date-selector.png`, `pta-edit-modal.png` |
| PTA context, summaries, activity table and filters | `pta-details.png`, `pta-activity-table.png`, `pta-search-filter.png`; final prototype filter controls |
| Annual/monthly horizontal timeline | `pta-calendar.png`, `pta-calendar-one-month-selected.png`; prototype tooltips and inspection |
| Reviewer quick creation | `create-activity-quick.png`, `create-activity-quick+agent-selection.png` |
| Assignment changes | `change-affectation.png` |
| Activity workspace and editing | `activity-details-to-be-completed.png`, `activity-edit-1.png`, `activity-edit-2.png`; prototype submitted/returned/approved states |
| Planning decisions | `prevalidator-modal.png`, `validator-modal.png` |
| Execution workspace and operation drawer | `Réalisation-list.png`, `activity-realisation-1.png`, `activity-realisation-2.png`, `activity-realisation-edit.png` |
| Settlement and completed Activity | `reversement-modal.png`, `reversement-modal-calendar.png`, `activity-cloturer-1.png`, `activity-cloturer-2.png` |

## Current gaps established from code

- Slice 1 connects the existing migration 0027/create/update APIs to PTA modals
  and metadata presentation. Activity creation and annual transfers now require
  a previously created PTA. No implicit creation path remains.
- Activity creation currently permits Agents only and requires complete dates,
  positive allocation and Operations. Models, response schemas, audit validation
  and projections assume complete planning. Quick creation needs a coherent
  incomplete-draft contract, not placeholder dates, fake Operations or zero budgets.
- Assignment enforcement already exists. Reuse its transaction locks/version
  checks and extend the current UI instead of creating another permission system.
- PTA search supports text and one raw state, but no Agent/period filtering.
  Execution has text/Agent and limited physical-state filters. Agent choices lack
  server search. New filtering must run before pagination and counting.
- The current calendar loads all pages but renders month cards, not the new
  horizontal annual/monthly timeline.
- Activity detail and execution are separate large views. Reuse their commands,
  queries and authorization while composing the approved connected workspace.
- Supervisor upload is currently denied. Date inputs do not yet have a shared
  shadcn calendar; reuse the existing shadcn Select for year choice and add the
  selected library's date/popover primitives for actual consumers.

## Ordered implementation slices

### 1. PTA creation and metadata UI

Connect existing create/update APIs to the new modals and index/detail layouts.
Load active Project choices only on demand; handle no Projects, duplicate year,
stale edits and failures locally. Prefill edits with their original version.
Creating a PTA opens its detail as in the prototype. Keep Agents on existing PTAs.
Then require an existing PTA on Activity creation and annual transfer: reviewers
create a missing destination first. Preserve existing transfers/history and test
in-flight requests across the change. Use the existing transfer interaction;
identify any missing destination-selection visual before changing its composition.

### 2. Reviewer quick creation and Agent completion

Allow incomplete planning only on never-submitted drafts. Keep required start/year
placement, optional end and unknown allocation explicit; preserve constraints on
submitted/approved planning. Extend the existing Activity model/use cases with a
focused migration and explicit creation-role provenance for the planning review
exception; never infer historical creator roles from a user's current role.
Preserve financial contributor evidence separately from planning eligibility.
Create Activity, assignments and business audit in one transaction with replay
protection. Extend draft-safe list/detail, audit, summaries and calendar projections;
approved-only metrics, exports, Partner views and reminders must not consume briefs.
Connect the quick modal and full Agent form, including stale/assignment-loss cases.
Do not reset fields or report a failed creation merely because list refresh fails.

### 3. Activity workspace, assignments, decisions and documents

Reproduce the header, contextual primary action, Programmation/Historique/Pièces justificatives
tabs, validation summary and existing edit/revision composition. Add the approved
assignment modal with searchable paginated Agent choices, current assignees,
added/removed preview, nonempty validation and version-bound drafts.
Use server-authorized actions for complete/submit/correct/prevalidate/approve;
do not implement a second frontend state machine. Preserve reasons and immutable
revisions. Extend document upload authorization to Supervisors, with fresh checks
before parsing and under the final write lock, audit and matching UI capabilities.
For optional files alongside a save/decision, preserve the separate document
transaction: clearly handle partial success, never replay a confirmed decision,
and never label a failed upload as successful. Expose retry in the owning dialog.

### 4. Shared search/filter behavior and timeline

Add server text/reference, current assigned Agent and inclusive period-overlap
filters. A start-only draft matches a period containing its start date. Map
**En correction** to both returned states without inventing stored states.
Extend Execution's administrative filters using actual finance facts.
Bind cursor scope/counts to all normalized filters; validate reversed/invalid dates.
Use short-debounced text search, direct state buttons, searchable Agent popover,
additional filters, removable chips and reset. Router owns shared filter state;
Query keys include it. Switching views preserves criteria and resets no drafts.
Render the exact annual/monthly timeline, clipped cross-boundary spans, actual
date labels, start-only markers and keyboard-accessible inspection/detail links.
Calendar loads every matching page; table remains paginated. Reject incomplete
results rather than presenting a partial year. Whole-PTA summary stays unfiltered.

### 5. Execution and settlement presentation

Match the new execution list, Activity **Réalisation & finances** tab, operation
drawer, progress/administrative sections and settlement/closed layouts. Share
Activity context and documents, load tabs only when needed, preserve old deep links.
Keep explicit operation start, completion and reasoned spending correction guards;
the visual checkbox must not erase or bypass those facts. Preserve the existing
financial sequence and expose only eligible actions. Reversement is the exact
full required amount, even if the reference input looks freely editable.

## Explicit reference exceptions and coverage checks

- The draft screenshot offers **Fiche récapitulative**; the real Fiche requires an
  approved revision. Omit it until eligible; do not invent a draft report.
- The operation drawer shows Activity documents, not new operation attachments.
- Optional evidence must not become a required approval step. Supervisor upload
  is the only new evidence permission authorized here.
- Execution controls must retain explicit start/correction reasons, exact full
  settlement, zero-spending review and funding guards even where demo interactions
  are simplified. Use applicable prototype dialogs; flag genuinely uncovered
  controls before inventing a layout.
- Older references still cover untouched surfaces and missing empty/error states
  where compatible. New PTA references win on overlapping composition. Empty
  messages remain centered. No unrelated Admin/auth/Partner portal redesign.

## Verification and completion

For each slice, test the whole affected journey and adjacent failure paths before
moving on: PostgreSQL constraints, migration from populated predecessor, replay,
stale edits, audit rollback, role changes, assignment races and Partner isolation;
frontend Query invalidation, local errors, in-button progress and preserved drafts.
Test filters/counts and calendars beyond 100 activities, leap years, start-only
drafts and cross-year spans. Verify reviewer-created briefs through Agent completion,
two-stage review and subsequent financial exclusions. Check direct forbidden calls.

Compare actual rendered populated/empty/dialog states at reference viewport sizes
against each mapped image and final prototype state. Inspect mobile, keyboard,
focus return, nested popovers, outside dismissal and 200% zoom. Run relevant
Vitest/Playwright, lint/build and backend type/static checks; record actual commands,
source/artifact and passes/skips. Do not equate test passes with visual acceptance.

End each implemented slice with a separate review-only agent inspecting requirements,
actual diff, surrounding code and evidence; fix blockers and return to that reviewer.
Update current guides/status, evaluate durable lessons, and remove this plan once
all agreed slices are complete. Production/deployment/provider work is excluded.
