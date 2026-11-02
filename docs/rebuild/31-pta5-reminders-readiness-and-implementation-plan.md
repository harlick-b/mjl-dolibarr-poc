# PTA-5 — Administrative reminders

Status: `PTA_5_READY_FOR_IMPLEMENTATION`

## Outcome and boundary

Twenty-one calendar days before an approved Activity's current end date, MJL
creates one notification for every currently assigned, active Agent and makes one
email attempt. The notification remains in a French notification centre reached
from the MJL sidebar. Already-due Activities inside the 21-day window are handled
on the next run.

The approved revision is the source of the end date while a candidate amendment
is pending. A newly assigned Agent receives the current reminder. Approval of a
new end date starts a new cycle while prior notifications remain history. Closed
or withdrawn Activities, ended assignments and dates already past do not create
new reminders.

Email is attempted once per Agent, Activity and approved end date. A failure is
recorded and is not retried automatically. A successful or unconfirmed attempt is
never sent again. The in-app notification remains available regardless of the
email result.

This slice adds no browser push, queue, generic notification framework, recurring
deployment service, real SMTP, manual resend, notification deletion or production
enablement. The focused command is suitable for an external scheduler later; no
provider or hosting decision is implied.

## Smallest implementation

- Migration `0016_pta5` adds one `pta_activity_reminder` table. Its unique cycle
  key is Activity, assigned Agent and approved planned end. It retains the
  approved revision, due date, read state and terminal email outcome.
- A focused dispatcher uses the existing synthetic provenance gate, advisory
  lock, assignments, immutable approved revision and test mailbox. It inserts the
  in-app record transactionally, then makes at most one email attempt and records
  `delivered`, `failed`, `skipped` or conservatively leaves `unconfirmed` if the
  database cannot confirm a successful external side effect.
- `GET /api/v1/notifications` returns only the authenticated recipient's paginated
  notifications. `PATCH /api/v1/notifications/{id}` marks one notification read
  with version conflict and replay protection. Admin access is denied server side.
- The React business workspace gains a responsive sidebar, unread badge and
  `/notifications` centre. Query owns the list and badge; read mutations do not
  replay offline and invalidate both projections.

## Focused checks

1. Exact 21-day, already-due and past-end boundaries use approved revision dates.
2. Every current assigned active Agent receives one cycle; unassigned, ended and
   inactive Agents do not.
3. Repeated and concurrent dispatcher runs create one record and at most one mail.
4. A new assignment gets the current cycle; an approved date change gets a new
   cycle without changing old history.
5. Closed and withdrawn Activities stop future reminders.
6. Mail success, failure and unconfirmed persistence outcomes are truthful; no
   failed, successful or unconfirmed attempt is resent automatically.
7. Recipient-only listing, Admin denial, isolation, pagination, read, stale-read
   and replay behavior pass with transactional audit.
8. Migration upgrade/downgrade safety, OpenAPI, focused planning/auth regressions,
   frontend interaction, lint, format, typing and build checks pass on the exact
   candidate with synthetic identities and disposable PostgreSQL.

## Independent review handoff

After implementation and focused verification, a separate agent that did not
implement the change leads a review-only phase. It independently reads this
contract, the governing decisions, actual diff, surrounding code and raw evidence;
it does not modify files or trust implementer claims. It reports bugs, gaps,
regressions, security weaknesses and missing checks with severity, file/line
evidence, impact and the smallest correction. The implementer fixes accepted
findings and returns the exact candidate to the same reviewer for focused
re-review. Completion is blocked until mandatory evidence and blocking findings
are resolved.

Stop after PTA-5. Documents, Partner access, production scheduling, real mail,
real accounts and later slices remain excluded. PC1/PC2 remain pending.
