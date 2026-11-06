# Business rules

This is the current product contract. The user's latest explicit instruction
prevails, followed by this guide and the engineering/security requirements for
their subjects. Design controls presentation, not permissions or business rules.
Code and tests show implementation; they do not override approved requirements
or establish user acceptance. Ask about genuine contradictions or missing
business choices; do not invent exception workflows.

## Domain and roles

The hierarchy is **Partenaire → Projet → PTA annuel → Activité → Opération**.
A Partner is the supporting organization, with a name and an optional saved
description (up to 4,000 characters). A Project belongs permanently to one
Partner and may span years. A PTA is its calendar-year planning collection.
An Activity is a planned body of work; Operations are its planned work units.
Use these names consistently; Programme is not a generic entity.

One Partner has at most one active Project. A Validator creates and closes
Projects. Past Projects remain consultable. A Project/year PTA is created
atomically with its first Activity, not through an independent empty-PTA action.
Activity creation always belongs to a PTA matching its planned start year.

| Role                               | Allowed work                                                                                                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent de saisie                    | Plan, correct, submit and execute Activities; initiate financial requests, declare external settlement and close eligible Activities. All Agents share state-qualified access across the authorized MJL scope. |
| Agent superviseur et prévalidateur | Prevalidate or return eligible requests; manage Agent assignments.                                                                                                                                             |
| Validateur définitif               | Final approval/return, Project lifecycle, Agent assignments and authorized evidence administration.                                                                                                            |
| Admin                              | Invite/manage accounts and consult/export global audit. No business mutation.                                                                                                                                  |
| Partner user                       | Read-only portal permanently bound to exactly one Partner. No internal role or scope switching.                                                                                                                |

Internal identities have one exclusive role. Assignments coordinate work and
notifications; they never restrict Agent read/edit access. Backend role, resource,
state and contributor checks apply to direct requests as well as visible buttons.
All business amounts are exact integer XOF, displayed F CFA; missing is not zero.

## Accounts and mail

Access is Admin-invited, email/password followed by email OTP; no public signup,
remembered devices or LDAP/SSO dependency. Invitations bind normalized identity,
role and security version. Only delivered, current, unexpired single-use proof
activates a pending account. Acceptance/reset never signs the user in.
Eligible resend rotates proof; revocation is terminal and cannot be bypassed
by recreating the same pending identity. Commit invitation/audit before sending;
mark only the matching eligible generation delivered. Report failure truthfully.

Passwords are 8–128 characters with matching confirmation, an uppercase letter,
a lowercase letter, a decimal digit and a non-whitespace symbol; Unicode categories
apply. Do not silently trim or normalize passwords. Invitations last seven days.
OTP lasts ten minutes with five attempts, a
ten-minute lock, and at most three resends separated by 60 seconds; retain
bounded abuse checks. Pre-authentication context lasts 15 minutes; failed
credentials are limited to ten per account in 15 minutes and endpoint abuse to
120 requests per IP per minute. Independent device sessions are allowed. Server idle and
absolute limits are both 24 hours; background refresh does not extend idle time.
Credential, role and lifecycle changes revoke all sessions and pending OTPs.
Ordinary lifecycle changes preserve identity/history and assignment eligibility.
Technical Admin recovery, reactivation and reinvitation are not enabled.

Recovery replies remain neutral for unknown, ineligible, throttled and mail-error
cases. A valid ten-minute proof is preserved without resend/replacement/extension,
including uncertain or failed delivery. Limits are three requests per email in
ten minutes and twenty per IP per minute. Reset
atomically invalidates credentials/sessions, then attempts one best-effort notice.

Local development permits real email addresses and requires a trimmed, control-free
Unicode full name (maximum 200 characters) for new invitations/first Admin.
Existing unnamed accounts use a generic greeting. Resend is the sole runtime
mail provider. The five messages are invitation, login OTP, password recovery,
password-change notice and Activity reminder. HTML/plain-text sources live in
backend/app/auth/templates; rendering escapes values and rejects missing fields.
Links retain secrets in fragments; OTP leading zeros are preserved. Password-change
and reminder notices have no action button. A reminder names its approved end date.
There is one bounded synchronous attempt, no automatic retry/queue/webhook.
Provider acceptance is not proof of inbox receipt. See README for local setup
and [security](security.md) for external acceptance requirements.

## Planning and approval

Agents de saisie and final Validators may create operation categories (types).
Agents create and select categories directly in the Activity's operation form.
Supervisors, Admins and Partner users cannot create them. Category creation is
separate from saving the Activity and does not change its approval or contributor
history; the existing Activity validation rules still apply.

An Activity has one or more Operations with positive allocations whose sum equals
its allocation. Default end date is start plus three calendar months for every
Partner: preserve the day when valid, otherwise clamp to the month's last day.
This is an editable suggestion; never overwrite a manual end date.

Validation is per Activity, not for an entire PTA. Submission creates an immutable
revision. One eligible Supervisor prevalidates, then a distinct eligible Validator
approves. Either may return with a reason; Validator return goes straight to Agent.
Fresh submission repeats both stages. Creator, submitters and cumulative structural
contributors cannot review their lineage, including after role changes. There is
no reviewer assignment, claim or quorum. Valid decisions survive personnel changes;
absence of an eligible reviewer never permits bypass.

Draft removal preserves history. An Operation already included in a submitted
revision cannot be removed through draft removal. User-facing states remain few
and follow business actions; there is no manual Activity status selector.

Approved changes use a separate candidate revision and two-stage review while
preserving the approved baseline, reasons and decisions. Execution pauses from
opening the amendment; unaffected Activities continue. Reasoned Agent cancellation
restores the approved baseline without erasing history. Changes after planned
start/end are allowed through controlled revision, subject to financial freezes.

Withdrawal and annual transfer require an approved, unstarted Activity with no
financial processing; resolve any pending amendment first. Submission pauses the
affected Activity and requires Supervisor then Validator approval. Pending requests
may be cancelled with a reason. Withdrawal is terminal, ends assignments and
excludes the Activity from current metrics. Transfer moves the same Activity only
forward to a later PTA in the same Project, preserving identity, Operations,
allocations, assignment history and decisions. Source placement remains effective
until final approval; no reverse transfer or restoration is enabled.

## Execution and additional funding

Prévisions d'activités owns planning; Réalisation d'activités executes approved,
scheduled Activities. Operations cannot start before the approved planned start
date. Agent explicitly starts Operations, records physical
completion and final actual spending. Start facts are immutable; spending
corrections require a reason and preserve history. Explicit zero is valid;
unknown spending is not completion. Verify exact approved Operation membership
and ordered execution/approval audit evidence before financial submission.

Budget insufficiency requires an approved budget revision **and a separate
funding approval** before work or financial processing resumes. Funding is the
server-calculated positive increment bound to that approved revision: 100,000 →
120,000 authorizes 20,000 F CFA, not the whole allocation or final spending.
Both reviews require Supervisor then distinct Validator. Forecast increases do
not require completed Operations. Already-spent cases before finance retain
truthful spending but pause further work and requests.

Financial and funding reviewers must not be the request submitter, an execution
author or a contributor to the protected Activity lineage, even after role changes.

All outstanding increments remain due: 100 → 120 → 150 needs 20 and 30 approved.
Later decreases, return or cancellation cannot erase an outstanding funding
requirement or a genuine historical shortfall. Downward spending correction may
fix a mistake but cannot silently remove that pause. An individual Operation
variance alone is not Activity-level insufficiency. Frozen settlement cannot be
changed through a late budget exception.

## Financial requests and closure

For positive final spending, after every approved Operation is physically complete:

1. Agent requests décaissement for server-calculated actual final spending, not
   the allocation. Supervisor prevalidates; distinct Validator approves.
2. Agent requests virement from the immutable approved décaissement amount,
   with a fresh Supervisor/Validator approval chain.
3. Agent confirms the external virement for the exact approved amount, effective
   date and optional note. MJL records the declaration; it never executes banking.
4. Required reversement is max(0, approved allocation − final spending). If positive,
   Agent records the exact full external return once, with date and optional note.
   No split, alternative amount or reallocation to another Activity is supported.
5. Agent directly closes after all work and required settlement checks pass.
   No additional closure approval, manual closure date or reopening is enabled.

Pending financial requests freeze their basis. Supervisor/Validator return ends
that request and permits correction and fresh submission without cancellation.
Original facts/reasons remain; fresh requests need both approvals. Reasoned
cancellation abandons a pending request. Approved décaissement remains frozen
even after a virement return; approvals are not rewritten. Virement date/note
corrections require a reason and stop at reversement/closure; reversement date/note
corrections require a reason and stop at closure. Amounts never become editable.

For zero spending, every Operation must be complete with explicit zero. Agent
submits a reasoned declaration, Supervisor prevalidates and distinct Validator
approves. Submitted/prevalidated/approved declarations freeze planning/execution.
Return is terminal and releases correction for a fresh declaration; there is no
cancellation action. Closure rechecks the exact approved revision and zero basis.
No artificial décaissement, virement or reversement is created.

Validator may close an empty Project or one containing only closed/withdrawn
Activities. Every unfinished Activity blocks closure. Closed Projects do not reopen.

## Evidence and Partner access

Evidence is optional and Activity-scoped; missing files never block submission
or closure. Agents/Validators upload PDF/JPEG/PNG up to 20 MiB, validating display
name, extension, declared media type, signature and parsed structure. Original
bytes/metadata are immutable. Internal business roles list/download through fresh
server authorization; JPEG/PNG also support protected inline preview, PDF does not.
Delivery is audited; no public storage URL or confidential browser cache.

Agent may withdraw only their own file with a reason; Validator may withdraw any
file and is the only role permitted after Activity closure. Withdrawal preserves
history and revokes download/preview. Optional correction is a new upload linked
to the withdrawn item. No restoration or general versioning is enabled.

Every file is private by default. Validator may explicitly share a current file
on an approved, currently Partner-visible Activity, including ongoing work, and
stop sharing even after closure. Withdrawal revokes sharing; replacements never
inherit it. Already downloaded copies cannot be recalled.

Several invited users may belong to one Partner, each permanently bound to it.
The separate portal shows only that Partner's current/past Projects, approved
PTAs/Activities/Operations, progress, successful final Validator decisions,
definitive closed finance and sanitized Fiche. Draft/candidate content, internal
identities/comments/correction reasons, global audit and access administration
remain hidden. Shared file projection is name/type/size and protected delivery.
All detail, guessed IDs, files and exports enforce Partner scope server-side.

## Reminders, metrics and outputs

One durable reminder cycle exists per assigned Agent, Activity and approved end
date. Eligibility begins 21 calendar days before that date and excludes past-end,
closed and withdrawn Activities. Current active assignments and approved date
changes determine eligibility; a new assignee/date gets its applicable cycle.
One in-app notification/email attempt is recorded; success, failure and uncertain
delivery are never automatically resent. Notification APIs are recipient-only;
Admin has no general inbox. Browser push and production scheduling are deferred.

Whole-current-PTA metrics use approved baselines, independent of screen filters
or pagination. Physical rate = closed Activities / approved planned Activities.
Financial rate = final spending of closed Activities / approved PTA allocation.
Expose exact supporting facts; zero denominator is mathematically non-calculable,
with no silent 100% cap. Dashboard presentation displays `0 %` for an empty
denominator and `-` for missing/unconfirmed finance, per the user’s explicit
display instruction; underlying facts and export semantics remain unchanged.
Effective withdrawal is excluded; approved transfer uses its destination.

Internal Fiche PDF regenerates approved planning, Operations, execution,
settlement, chronology, document references and generation date; it remains
available after withdrawal/closure when an approved revision exists. Partner
Fiche uses a separate sanitized projection. No stored PDF or signature system.

Internal business roles may export current PTA CSV and annual Excel/PDF working
reports; Partner export is selected-PTA CSV of its public facts only. Global audit
is sanitized, newest-first and restricted to Validator/Admin, including CSV export.
Exports capture bounded coherent complete snapshots, reauthorize under lifecycle
serialization and atomically audit relevant IDs/time/rows/bytes/hash before delivery.
Audit export excludes its own generation event. No stored artifact/report job.

CSV uses UTF-8 BOM, semicolons, French headings and formula-safe cells. Excel
writes user text literally (no formula/URL inference), and integers beyond 15
significant digits as exact labeled decimal text. Unfinished finance stays blank;
validated closed zero is explicit zero. PDF/Excel use the same current annual facts.
These are working reports, not official templates or past-date reconstruction.
