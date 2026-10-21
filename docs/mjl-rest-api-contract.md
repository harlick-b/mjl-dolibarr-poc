# MJL REST API contract and action inventory

Status: **authentication, reference screens and Activity workflows implemented; remaining operations are targets, not accepted**. Inventory date:
2026-10-21. User decisions: DEC-078 (web/PWA, progressive migration, all current
MJL business and administration actions, login + email OTP, 24-hour idle and
24-hour absolute session limits). Native Dolibarr technical administration,
external integrations and offline mode are excluded. Deferred document Phase 4
is unchanged. This contract does not authorize those deferred features.

[OpenAPI 3.1.1 contract](mjl-rest-api.openapi.yaml) owns paths, operationIds,
wire fields and response shapes. This document owns the current-action mapping,
shared behavioral constraints and migration requirements. Canonical business
rules and permissions remain authoritative; code is current-state evidence.
PHP pages render shells for migrated screens. Forty operations are implemented: 10 authentication operations, 15 reference operations, 13 Activity operations, monitoring filter options and submission-token issuance. Other endpoints below remain pending.

## Scope and architecture

The inventory and OpenAPI describe the complete target. DEC-080 authorizes the first runtime slice: authentication/session/recovery and Partenaires. Migrated screens require JavaScript, show a default-visible JavaScript requirement message, and use REST for reads and mutations. Legacy form POSTs cannot mutate those resources. No schema, dependency or Dolibarr core edits are needed.
The mechanism-to-requirement map is:

| Requirement | Smallest implementation direction |
| --- | --- |
| Existing web/PWA uses REST progressively | Custom-module JSON HTTP adapter at `/custom/mjlfinancement/api/index.php/v1`; keep current screen URLs |
| Preserve business rules and audit | Adapter → existing policy → command/scoped read → explicit JSON projection; commands retain transaction ownership |
| Login + OTP and approved time limits | Reuse private PHP/Dolibarr session adapter; shared enforcement for REST and remaining HTML routes |
| Preserve one-use form protection | One just-in-time submission-token endpoint using the current helper, not a new retry/job framework |
| Exact amounts and race protection | Decimal strings, current numeric versions/fingerprints and locked command authorization |
| Existing audited downloads | Synchronous binary export through `MjlExport` and checked delivery; no new download storage or jobs |

The custom front-controller path works with PATH_INFO in the current Docker deployment without native Dolibarr REST activation. Native bootstrap exits are converted into sanitized JSON errors. Configured native IP restrictions are preserved. No new application framework, JWT,
refresh-token service or parallel business-rule implementation is needed.

Current seams: `MjlReferenceCommand`, `MjlActivityCommand`,
`MjlActivityAssignment`, `MjlAuthCommand`, `MjlAccessCommand`, `MjlExport`,
`lib/monitoring/mjl_monitoring_read.lib.php`,
`lib/reporting/mjl_reporting_read.lib.php` and
`lib/spending/mjl_spending_read.lib.php`. Keep actor/entity capture in the
adapter and current lock/order/audit checks inside commands. Normalize JSON to
the exact existing command input; PHP array-order checks must not require JSON
property ordering. Do not serialize native objects or database rows wholesale.

## Action inventory

Paths below are relative to the OpenAPI server URL. Role labels:
A = Agent de saisie, R = Supervisor or Validator, V = Validateur définitif,
B = any business role, T = Admin, VT = Validator/Admin, ALL = valid MJL actor.
`public` means no completed session required, not unrestricted: CSRF, pending
OTP browser binding or invitation/reset proof applies. All scoped reads and
writes use the runtime active entity; callers cannot supply actor, role or entity.

Every B/A/R/V endpoint excludes Admin. Agent scope means current assignment
except the explicitly narrow expense-correction exception. R review decisions
still enforce the exact role/stage and contributor exclusions. VT audit access
does not grant Admin business-report or business-dashboard access.

Evidence paths are relative to `custom/mjlfinancement/`. Root page aliases and
form actions map to these operations; transport changes do not add business rights.

| operationId | Target method/path | Current action / target adapter | Roles | Source evidence |
| --- | --- | --- | --- | --- |
| `getSession` | `GET /auth/session` | Session, OTP state and CSRF bootstrap | public | `class/mjlauthcommand.class.php` |
| `login` | `POST /auth/login` | Verify email/password and begin OTP | public | `class/mjlauthcommand.class.php` |
| `verifyOtp` | `POST /auth/otp/verify` | Verify pending OTP | public | `class/mjlauthcommand.class.php` |
| `resendOtp` | `POST /auth/otp/resend` | Resend pending OTP | public | `class/mjlauthcommand.class.php` |
| `logout` | `DELETE /auth/session` | Cancel pending login or log out | public | `class/mjlauthcommand.class.php` |
| `inspectInvitation` | `POST /auth/invitations/inspect` | Inspect invitations link | public | `class/mjlauthcommand.class.php` |
| `acceptInvitation` | `POST /auth/invitations/accept` | Accept invitations link | public | `class/mjlauthcommand.class.php` |
| `inspectPasswordReset` | `POST /auth/password-resets/inspect` | Inspect password-resets link | public | `class/mjlauthcommand.class.php` |
| `consumePasswordReset` | `POST /auth/password-resets/consume` | Consume password-resets link | public | `class/mjlauthcommand.class.php` |
| `requestPasswordReset` | `POST /auth/password-resets` | Request password reset | public | `class/mjlauthcommand.class.php` |
| `issueSubmissionToken` | `POST /submission-tokens` | Prepare one existing one-use submission context | ALL | `lib/mjl_form_submission.lib.php` |
| `listUsers` | `GET /admin/users` | List scoped MJL users | T | `admin/access.php` |
| `listInvitations` | `GET /admin/invitations` | List scoped invitations | T | `admin/access.php` |
| `inviteUser` | `POST /admin/invitations` | Invite or reinvite inactive user | T | `admin/access.php` |
| `changeUserRole` | `PATCH /admin/users/{user_id}/role` | Change effective business role | T | `admin/access.php` |
| `deactivateUser` | `POST /admin/users/{user_id}/deactivation` | Deactivate user access | T | `admin/access.php` |
| `revokeInvitation` | `POST /admin/invitations/{invitation_id}/revocation` | Revoke invitation | T | `admin/access.php` |
| `listPartners` | `GET /partners` | List partners | B | `lib/api/mjl_api_references.lib.php` |
| `getPartner` | `GET /partners/{id}` | Read Partner | B | `lib/api/mjl_api_references.lib.php` |
| `createPartner` | `POST /partners` | Create Partner | V | `lib/api/mjl_api_references.lib.php` |
| `renamePartner` | `PATCH /partners/{id}` | Rename Partner | V | `lib/api/mjl_api_references.lib.php` |
| `setPartnerActive` | `PUT /partners/{id}/activation` | Activate/deactivate Partner | V | `lib/api/mjl_api_references.lib.php` |
| `listProjects` | `GET /projects` | List projects | B | `lib/api/mjl_api_references.lib.php` |
| `getProject` | `GET /projects/{id}` | Read Project | B | `lib/api/mjl_api_references.lib.php` |
| `createProject` | `POST /projects` | Create Project | V | `lib/api/mjl_api_references.lib.php` |
| `renameProject` | `PATCH /projects/{id}` | Rename Project | V | `lib/api/mjl_api_references.lib.php` |
| `setProjectActive` | `PUT /projects/{id}/activation` | Activate/deactivate Project | V | `lib/api/mjl_api_references.lib.php` |
| `listOperationTypes` | `GET /operation-types` | List operation-types | B | `lib/api/mjl_api_references.lib.php` |
| `getOperationType` | `GET /operation-types/{id}` | Read OperationType | B | `lib/api/mjl_api_references.lib.php` |
| `createOperationType` | `POST /operation-types` | Create OperationType | V | `lib/api/mjl_api_references.lib.php` |
| `renameOperationType` | `PATCH /operation-types/{id}` | Rename OperationType | V | `lib/api/mjl_api_references.lib.php` |
| `setOperationTypeActive` | `PUT /operation-types/{id}/activation` | Activate/deactivate OperationType | V | `lib/api/mjl_api_references.lib.php` |
| `listActivities` | `GET /activities` | List current visible Activities | B | `lib/api/mjl_api_activities.lib.php` |
| `getActivity` | `GET /activities/{activity_id}` | Read Activity and current structure | B | `lib/api/mjl_api_activities.lib.php` |
| `createActivity` | `POST /activities` | Create draft or create-and-submit atomically | A | `lib/api/mjl_api_activities.lib.php` |
| `replaceActivityStructure` | `PUT /activities/{activity_id}/structure` | Save complete editable Activity structure | A | `lib/api/mjl_api_activities.lib.php` |
| `submitActivity` | `POST /activities/{activity_id}/submissions` | Submit/resubmit Activity | A | `lib/api/mjl_api_activities.lib.php` |
| `abandonActivity` | `POST /activities/{activity_id}/abandonment` | Abandon draft | A | `lib/api/mjl_api_activities.lib.php` |
| `restoreActivity` | `POST /activities/{activity_id}/restoration` | Restore draft with primary Agent | V | `lib/api/mjl_api_activities.lib.php` |
| `changeAssignment` | `POST /activities/{activity_id}/assignment-changes` | Add/remove/transfer assignment | V | `lib/api/mjl_api_activities.lib.php` |
| `requestActivityCancellation` | `POST /activities/{activity_id}/cancellation-requests` | Request Activity cancellation | A | `lib/api/mjl_api_activities.lib.php` |
| `listAssignmentAgents` | `GET /assignment-agents` | Eligible Agents for assignment/restoration | V | `lib/api/mjl_api_activities.lib.php` |
| `getActivityReview` | `GET /activities/{activity_id}/review` | Read current immutable revision and decisions | R | `lib/api/mjl_api_activities.lib.php` |
| `reviewActivity` | `POST /activities/{activity_id}/revisions/{revision_id}/decisions` | Prevalidate, validate or return exact revision | R | `lib/api/mjl_api_activities.lib.php` |
| `getActivityTimeline` | `GET /activities/{activity_id}/timeline` | Read sanitized Activity chronology | B | `lib/audit/mjl_audit_timeline_read.lib.php` |
| `listOperations` | `GET /operations` | List visible Operations | B | `lib/mjl_operation_route.lib.php` |
| `getOperation` | `GET /operations/{operation_id}` | Read Operation consultation | B | `lib/mjl_operation_route.lib.php` |
| `updateExecution` | `PUT /operations/{operation_id}/execution` | Update execution status and observation | A | `lib/mjl_operation_route.lib.php` |
| `requestOperationCancellation` | `POST /operations/{operation_id}/cancellation-requests` | Request Operation cancellation | A | `lib/mjl_operation_route.lib.php` |
| `requestOperationReopening` | `POST /operations/{operation_id}/reopening-requests` | Request Operation reopening | A | `lib/mjl_operation_route.lib.php` |
| `listExceptionRequests` | `GET /exception-requests` | List typed exception requests | B | `lib/mjl_operation_request_route.lib.php` |
| `withdrawCancellation` | `POST /cancellation-requests/{request_id}/withdrawal` | Withdraw Cancellation request | A | `lib/mjl_operation_request_route.lib.php` |
| `decideCancellation` | `POST /cancellation-requests/{request_id}/decisions` | Approve/reject Cancellation request | V | `lib/mjl_operation_request_route.lib.php` |
| `withdrawReopening` | `POST /reopening-requests/{request_id}/withdrawal` | Withdraw Reopening request | A | `lib/mjl_operation_request_route.lib.php` |
| `decideReopening` | `POST /reopening-requests/{request_id}/decisions` | Approve/reject Reopening request | V | `lib/mjl_operation_request_route.lib.php` |
| `listSpendingOperations` | `GET /spending-operations` | List Operations accessible for spending | B | `lib/spending/mjl_spending_http.lib.php` |
| `listExpenses` | `GET /operations/{operation_id}/expenses` | Read expense ledger and correction context | B | `lib/spending/mjl_spending_http.lib.php` |
| `createExpense` | `POST /operations/{operation_id}/expenses` | Create expense, explicit zero or correction draft | A | `lib/spending/mjl_spending_http.lib.php` |
| `replaceExpenseDraft` | `PUT /operations/{operation_id}/expenses/{expense_id}` | Edit expense/correction draft | A | `lib/spending/mjl_spending_http.lib.php` |
| `submitExpense` | `POST /operations/{operation_id}/expenses/{expense_id}/submission` | Submit expense/correction | A | `lib/spending/mjl_spending_http.lib.php` |
| `withdrawExpense` | `POST /operations/{operation_id}/expenses/{expense_id}/withdrawal` | Withdraw draft/submitted expense | A | `lib/spending/mjl_spending_http.lib.php` |
| `decideExpense` | `POST /operations/{operation_id}/expenses/{expense_id}/decisions` | Approve/reject expense/correction | V | `lib/spending/mjl_spending_http.lib.php` |
| `getDashboard` | `GET /dashboard` | Financial dashboard and actionable queue | B | `lib/monitoring/mjl_monitoring_read.lib.php` |
| `listAlerts` | `GET /alerts` | Computed scoped alerts | B | `lib/monitoring/mjl_monitoring_read.lib.php` |
| `listAuditEvents` | `GET /audit-events` | Browse global active-entity audit | VT | `lib/reporting/mjl_reporting_read.lib.php` |
| `previewActivities` | `GET /reports/activities` | Preview activities | B | `lib/mjl_report_data.lib.php` |
| `exportActivities` | `POST /reports/activities/exports` | Generate and download activities | B | `class/mjlexport.class.php` |
| `previewOperations` | `GET /reports/operations` | Preview operations | B | `lib/mjl_report_data.lib.php` |
| `exportOperations` | `POST /reports/operations/exports` | Generate and download operations | B | `class/mjlexport.class.php` |
| `previewActivityDetail` | `GET /reports/activity_detail` | Preview activity_detail | B | `lib/mjl_report_data.lib.php` |
| `exportActivityDetail` | `POST /reports/activity_detail/exports` | Generate and download activity_detail | B | `class/mjlexport.class.php` |
| `previewPortfolio` | `GET /reports/portfolio` | Preview portfolio | B | `lib/mjl_report_data.lib.php` |
| `exportPortfolio` | `POST /reports/portfolio/exports` | Generate and download portfolio | B | `class/mjlexport.class.php` |
| `exportAudit` | `POST /reports/audit/exports` | Generate and download audit | VT | `class/mjlexport.class.php` |
| `getMonitoringOptions` | `GET /monitoring-options` | Scoped filter choices for current monitoring/report screens | B | `lib/monitoring/mjl_monitoring_read.lib.php` |


### Coverage notes

- Reference lists/details/create/edit/lifecycle are `partners.php`,
  `projects.php`, `operationtypes.php`. Activation/deactivation share a boolean
  state endpoint; rename is separate so a single request never chains commands.
  Agent/Supervisor reference reads are active-only; Validator can see inactive.
  Active Projects also require active parent Partners for ordinary readers.
- `activities.php` create, edit, detail and review include assignments,
  Opérations, financial projections and chronology. `submit: true` preserves
  atomic create-and-submit. Adding/editing/removing draft Opérations is complete
  Activity structure replacement, not standalone Operation CRUD. A selected
  inactive reference stays represented by its existing Activity/Operation labels;
  it is not made generally visible or eligible for a new selection.
- The review read exposes the **current** immutable revision and its decisions,
  as the existing screen does. This does not invent a historical-revision browser.
  Submission/review mutations name exact versions and revision IDs.
  `allowed_decisions` distinguishes acceptance from return/rejection eligibility;
  an operationId alone does not imply every decision is allowed.
- `operations.php` and its consultation drawer map to scoped Operation reads and
  execution writes. `spent_amount` is read-only, derived from approved expenses.
- `operationrequests.php` lists both request tables. Request IDs are meaningful
  only with their type; `request_id` filtering requires `type`. Withdrawal is
  requester-only with a current assignment. Both approval and rejection require
  a reason. Stale requests may be rejected/withdrawn where policy allows; `stale`
  is computed, never a new stored status.
- `expenses.php` has its own Operation index and ledger. Ordinary/zero expense,
  correction draft and editing use the same save command. `original_id` identifies
  a correction; its reason is mandatory. Withdrawal, submission and review cover
  ordinary expenses and corrections. Full reversal is created internally and
  atomically with replacement approval: no independent reversal route.
- After Activity cancellation, only Agents assigned immediately before that
  cancellation can use correction-only spending access. Their ledger exposes the
  minimum Operation/expense context necessary; it never grants Activity detail,
  ordinary Operation detail, timeline, monitoring, export or general editing.
- `index.php` and `alerts.php` expose calculated dashboard/alert views. Work queue
  pagination is in the dashboard response. Alerts have no dismissal or stored
  read state. Admin's home contains administration/audit navigation, not business
  financial data; the session role/capabilities are sufficient for that shell.
- `workflowactions.php` is the current audit-report alias, not an additional
  mutation. `reports.php?report=audit` maps to `GET /audit-events`; audit downloads
  retain their separate export operation. The four business preview types and
  all five PDF/XLSX/CSV export types are covered explicitly.
- `admin/access.php` covers invitation/reinvitation, user/role lists, business-role
  changes, deactivation and invitation revocation. Activation happens through
  invitation acceptance. There is no standalone reactivation, arbitrary identity
  edit, user deletion or native-admin promotion action to expose.
- `auth.php`, `invitation.php`, login/reset hooks and native logout map to the auth
  operations. Session inspection and token preparation are new JSON adapters for
  existing session/form behavior, not extra business features. Successful
  invitation/reset completion requires subsequent login + OTP.
- Form cancel buttons, inline drawers, menu links, validation feedback, local
  unsaved-form recovery and filter controls are presentation behavior. They use
  the listed reads/writes and do not need individual endpoints. Preserve current
  unsaved-input/error UX when migrating the screen.
- No API actions for `documents.php`, `documentdownload.php` (both deny all),
  obsolete `dpafdashboard.php`, native technical administration, setup/installer
  scripts, scheduled reconciliation, test helpers, static assets or guard pages.
  They are deferred, denied, excluded or internal, not overlooked app actions.

## Authentication and session contract

Use same-origin browser requests and the existing server-side session. No token
in localStorage, no browser bearer JWT, no cross-origin credential allowance.
Cookies are HttpOnly, SameSite=Lax and Secure over HTTPS; HTTP is only the existing
local development exception. The native cookie name is deployment-specific:
OpenAPI's `DOLSESSID_<deployment-suffix>` represents the actual native `session_name()`, not a new cookie;
browser clients use `credentials: same-origin` and never read its value.

1. `GET /auth/session` provides anonymous CSRF bootstrap or current pending/verified
   state. It does not extend idle lifetime. It returns 401 `session_expired` for
   an expired formerly authenticated session, then anonymous state on a fresh
   bootstrap. No business data is exposed while OTP is pending.
2. Every non-GET request requires `X-CSRF-Token`, including public login,
   invitation inspection/acceptance, reset requests, OTP and logout. Validate
   same-origin requests; cookies/SameSite alone are not the CSRF check.
3. Password login invokes the native verifier and failed-login recording. It
   returns 202 pending, never authenticated. OTP verification rotates the session
   and returns 200 authenticated. Login does not accept a caller-selected entity
   or arbitrary redirect URL.
4. Preserve current six-digit OTP, ten-minute challenge expiry, five wrong
   well-formed attempts then ten-minute account lockout, 60-second resend cooldown
   and three-resend maximum. Re-login must preserve live counters/lockouts; an
   expired challenge can be replaced after a fresh password check. Malformed
   input does not count as a well-formed failed code in the existing policy.
5. At successful OTP, set server-side authentication time and last activity.
   Expire at **86,400 seconds idle or 86,400 seconds absolute**, whichever occurs
   first. Absolute lifetime never slides. No remembered device or refresh path.
   Accepted foreground application requests update idle time; session inspection,
   static assets and background polling do not. Do not introduce polling or a
   heartbeat that silently keeps the user signed in. Shared enforcement must
   cover API and remaining MJL HTML routes so switching interfaces cannot bypass
   expiry. The API returns JSON 401, never a redirect or an HTML login page.
6. Retain credential/role/status/entity proof validation and account deactivation
   checks. Changes invalidate stale authentication; permissions are rechecked on
   requests, not cached until timeout. Logout clears pending and authenticated
   state and expires the session cookie. Expiry requires fresh password + OTP.
7. Invitation and reset verifiers remain hash-only, single-use and expiring
   (seven days and one hour respectively). Link fragments enter request bodies;
   never URLs, logs or analytics. Inspect is non-consuming; disclose the readonly
   email only after valid proof. Reset requests return the same generic 202 for
   unknown account, throttle and delivery outcome. Preserve existing password
   rules and native password throttling; do not invent a contractual numeric
   native-password limit from an unknown deployment setting.
8. Mail may fail after invitation preparation committed an inactive account/token.
   Return sanitized 503 `invitation_delivery_failed`; do not claim rollback or
   activation, return raw links, or automatically retry. Admin can inspect and
   reissue using the existing invitation command. Public reset responses stay
   neutral regardless of mail outcome.

Mail is still absent and OTP is disabled. The API returns 503
`authentication_unavailable` for password login/protected use without required
OTP availability; it must not copy the legacy disabled-OTP session bypass.
Configure supplied mail and verify delivery before enabling actual OTP. No mail
or OTP configuration changes are part of this implementation slice.

## Requests, concurrency and retries

JSON is UTF-8; unknown fields/query keys, malformed JSON, duplicate JSON keys,
invalid types and ambiguous repeated query keys are rejected. Only documented
methods are allowed (otherwise 405 with Allow). Reject unsupported content type
with 415. Maximum JSON body is 64 KiB for Activity structure/create, 16 KiB for
other bodies. No file-upload request or client-supplied SQL/sort expression.
Dates are real `YYYY-MM-DD` calendar dates, business calendar Africa/Porto-Novo;
timestamps are RFC3339 with an explicit offset. IDs, versions and XOF amounts
are canonical decimal strings, not JavaScript numbers. Stored input amounts remain bounded by
signed BIGINT; read-only aggregate sums remain exact decimal strings and may
exceed a single stored amount. Missing money is null; approved zero is `"0"`. Reversal read values
may be negative. Clients may ignore unknown response fields, never infer missing
money as zero. Stable English field/status codes coexist with French UI messages.

| Write | Required concurrency context |
| --- | --- |
| Reference rename/activation | Existing SHA256 `fingerprint` from visible reference read |
| Activity structure | Activity `expected_version` and each retained Operation's `id`/`expected_version` |
| Submit/abandon/restore/assignment/Activity cancellation | Activity `expected_version` |
| Activity review | Activity `expected_version` plus exact path `revision_id` |
| Execution/Operation exception creation | Operation `expected_version`; server resolves and checks parent |
| New expense/correction | **Operation** `expected_version` |
| Existing expense edit/submit/withdraw/review | **Expense** `expected_version` |
| Exception withdrawal/decision | Request `expected_version`; stored target revision/version/set checked by command |
| Access administration/auth | Existing command locks and state guards; do not invent version fields |

OpenAPI operations marked `x-submission-token: true` require
`X-MJL-Submission` in addition to CSRF. Before committing a user action, request
one token with `POST /submission-tokens`: whitelisted `operation_id` (OpenAPI
operationId), exact `path_parameters`, plus `expected_version` when that target
requires it. `revision_id` is the path revision for review (if also provided in
body it must match). No caller-controlled actor/entity/route/form strings.
The server checks eligibility and builds a canonical context for the existing
`mjl_form_submission_issue/consume` helper. Bind all target IDs (including
parent Operation for new expenses), action, user, entity and required versions.
Use an API-specific route/form mapping so tokens cannot cross HTML/API actions.
For versionless reference writes the command fingerprint remains mandatory.

Issue tokens just in time, never preallocate them for every row: current storage
is capped at 20 pending tokens and two-hour token TTL, additionally constrained
by the shorter authenticated-session lifetime. A token is consumed once before
calling the command. Reuse fails with 403 `submission_invalid`; request a fresh
token after reading current state. Existing auth/access/export paths without
one-use form tokens retain their own command/state/CSRF guards.

This prevents a repeated request with the same submission token from creating
two expense drafts; an Operation version alone cannot do so because expense
creation does not bump that version. It is **not** an exactly-once retry store.
After a timeout/disconnection/uncertain commit, never automatically retry a write
with a new token. Read the ledger/activity/audit state first, then let the user
act. A known failed validation still consumes its token. No mutation success is
returned before command commit; no command error exposes internal exception text.

## Reads, filters and financial projections

Default page size50, ledger entries5, timeline/audit cursors50. Reference and
admin lists gain bounded pages as JSON adaptations of existing lists. Stable
ordering: references by label/id ascending, eligible Agents by name/id ascending,
admin users by login/id ascending, invitations and spending lists by id descending;
Activity/Operation lists retain the current monitoring sort, with id tie-breaker.
Exception requests use request date descending, then type and id. Timeline is
chronological `(event_date,id)`; audit uses event ID in the requested direction.
Cursor values are event IDs resolved within the authorized scope; no cross-scope
cursor data. Page reads are current snapshots, not a promise of an immutable
multi-page view. Use returned `has_next`/`next_cursor`, not guessed row counts.

The `/monitoring-options` read supplies only choices used by currently visible
Activities, including now-inactive references; active-only creation reference
lists cannot substitute for these filter menus. OpenAPI lists allowed filters. Shared business filters: `q`, `partner_id`,
`project_id`, `activity_id`, `validation_status`, `execution_status`,
`completeness`, `date_from`, `date_to`. Operation lists/reports additionally use
`type_id` and `operation_status`. Portfolio alone has `grouping=project|partner`.
Reference Projects have optional parent filtering for form options. Audit uses
its separate event/actor/object/action/result/date filters. Exception selection
uses `type`, `request_id`, `status`. Date ranges must be ordered.

Business date ranges select Activities by **inclusive date overlap**, not expense
posting date. Money remains current cumulative approved-ledger totals. Activity
and dashboard financial aggregates cover the entire authorized filtered selection,
not the displayed page. Child Operation filters never recompute parent totals
from just matching children. Preserve proposed vs validated amounts, cancelled
amounts and incomplete-spending counters; zero never substitutes for missing data.

Complete selection reads remain bounded by the existing reader budgets (10,000
Activities, 100,000 Opérations, 5 MiB selected text). Limit failures return 422
`selection_too_large`, never truncated data or misleading partial totals. Report
previews remain bounded complete documents; API list paging does not restrict
exports. Query/dependency failure returns 503 and no invented empty list/zero
summary. Allowlisted JSON fields project current reads; raw SQL columns, internal
credential metadata and arbitrary audit JSON are not exposed.

## Exports and errors

`POST /reports/{fixed_type}/exports` accepts only `format` and the type's filter
object. The five concrete paths are in OpenAPI; no dynamic unvalidated report
name. Successful response is a synchronous PDF/XLSX/CSV attachment with existing
French labels, filename convention and formula-safe cells. No cursor/page filter,
export job, storage URL, historical download ID or unaudited GET download.
`activity_detail` requires `activity_id`. Audit export requires Validator/Admin;
other exports require business scope. Recheck role/assignments under current-state
locks and commit immutable export evidence before delivering. Uncertain commit
means no artifact delivery; an authorized response may finish after later revocation
as already defined by DEC-056. A transport interruption after delivery starts
cannot be replaced with JSON; do not claim a completed download.

All responses use `Cache-Control: private, no-store` and `X-Content-Type-Options:
nosniff`; auth/link responses also use `Referrer-Policy: no-referrer`. PWA service
workers must not persist authenticated API data or exports. Success reads use
`data` and explicit page/cursor metadata; mutations return only committed IDs and
versions, followed by scoped refetch. Error body:

```json
{"error":{"code":"stale_version","message":"La fiche a changé. Rechargez-la."}}
```

| HTTP | Stable code examples / treatment |
| --- | --- |
| 400 | `invalid_request`: malformed/ambiguous/unknown fields |
| 401 | `authentication_required`, `session_expired`, `session_invalidated`, `invalid_credentials`; no HTML redirect |
| 403 | `forbidden`, `csrf_invalid`, `submission_invalid`; role/context/replay denied |
| 404 | `not_found`: indistinguishable absent and inaccessible object after endpoint role checks |
| 405 / 413 / 415 | `method_not_allowed` / `payload_too_large` / `unsupported_media_type` |
| 409 | `stale_version`, `stale_fingerprint`, `conflict`, `retryable_conflict`, `export_busy`; refresh before deliberate retry |
| 422 | `invalid_input`, `selection_too_large`, `unsupported_record`; safe field errors where known |
| 429 | `rate_limited`; safe Retry-After for login/OTP, neutral reset requests still202 |
| 503 | `unavailable`, `authentication_unavailable`, `invitation_delivery_failed`, `outcome_unknown`; never raw SQL/exception text |

Normalize finite command outcomes and existing auth/reference/access errors in
the adapter; do not rely on parsing arbitrary French error strings. Migration
required is 503. Unexpected exceptions are generic503 with internal sanitized
logging; failed business writes do not emit successful business audit events.
A returned 503 does not assert transaction rollback when the commit outcome is
uncertain. Export and invitation failure semantics above take precedence over
any generic UI message. Do not log passwords, OTPs, selectors/verifiers, CSRF,
submission/session tokens or raw authenticated request bodies.

## Delivery sequence and completion evidence

API stages below are **not** the product Phase4 document plan.

1. Authentication/session/recovery and reference data, starting with Partenaires
   as the first end-to-end screen. Bind native cookie/routing details, preserve
   native failed-login recording, enforce shared session expiry, test mocked mail
   in an isolated tenant. Working configured mail is required before real OTP
   enablement. No acceptance of the application is implied.
2. Activities, structure, assignment, review and chronology, with same exact
   revision/contributor rules and active reference selection.
3. Operation execution, exceptions and separate spending/correction workflow.
4. Dashboard, alerts, audit, previews and synchronous audited exports.
5. MJL invitation/user administration and final current-action coverage check.

A migrated screen must perform its reads and writes through the defined API,
retain French UI/error/accessibility behavior, and preserve direct endpoint
security. Existing HTML handlers can coexist until that screen's migration;
shared commands and common authentication controls must serve both. Remove
superseded HTTP mutation dispatch only once the migrated screen and entry routes
are verified; do not leave a bypass through the older route.

Focused slice checks must cover: happy path plus forbidden role/entity/assignment;
CSRF and repeat submission; stale fingerprints/versions; audit rollback and exact
financial totals; relevant UI read/write through REST; JSON errors rather than
redirects. Auth checks cover challenge expiry recovery, throttling, session
rotation, idle/absolute expiry, password/role/deactivation invalidation and logout
across both old/new routes. Spending checks additionally cover correction-only
access and atomic reversal/replacement; export checks cover revocation and
uncertain-commit non-delivery. Use disposable tenants, never persistent samples.
No full historical suite or production assessment is required by this document.

## Remaining implementation facts and risks

The first slice is implemented using the existing authentication/reference commands.
The native `DOLSESSID_` cookie name has a deployment-specific suffix; clients use
browser-managed cookies rather than hard-coding that suffix. API CSRF is kept in
the same PHP session and rotated with authentication. No tokens are persisted in
browser storage. Protected API routes fail closed while OTP is disabled; the
native technical administrator login remains available for local configuration.

`GET /auth/session` and submission-token issuance do not extend idle time.
Successful business reads/writes and foreground protected HTML requests do.
Invitation/reset inspection requires the full link proof before disclosing an
email. Authenticated and pending logout use `DELETE /auth/session`.

Mail configuration and verified delivery remain outstanding before enabling OTP.
Partenaires, Projets and Types d’Opération now use REST for lists, details, creation,
renaming and activation. Projects support the `partner_id` list filter; their
parent and technical reference remain immutable. Invalid/inactive parents return
422 `inactive_parent`; the command checks the parent under its existing locks.
Submission tokens cover nine reference and eight Activity mutations. Activities,
assignments, planning, immutable review and sanitized chronology now use REST,
including the existing Activity cancellation request. The list uses full-selection
totals and scoped filter options. Exact Activity/Operation/revision versions,
one-use tokens, contributor exclusions and command-owned audit transactions remain.
Superseded HTML mutation/render/recovery handlers are removed. Operation execution,
spending, exception decisions, reporting and MJL administration remain pending.
Phase 4 is unchanged. Remaining adapters need their own typed mappings and checks.
The gap analysis owns unresolved work; tests establish behavior, not acceptance.

Technical references used to define the wire/security contract:
[OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html),
[OWASP REST guidance](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html),
[OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
Session durations are the user's approved policy, not an externally mandated value.

Container PHP session storage retains sessions for 86,400 seconds via
`deployment/php-session.ini`; the server-side MJL gate enforces the absolute
deadline independently. Browser session cookies remain nonpersistent: closing
the browser or clearing cookies can require an earlier login.
