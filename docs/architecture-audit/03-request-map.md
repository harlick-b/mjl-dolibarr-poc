# Request and action map

Apache rules are evaluated before the PHP chains below. The declared deployment denies direct access to MJL `scripts/`, native ECM/document routes and selected native workspace pages, using `nativeforbidden.php` as the 403 surface.

| Endpoint | Method/actions and inputs | Authentication/authorization | Processing and effects | Result/contracts |
| --- | --- | --- | --- | --- |
| `/custom/mjlfinancement/index.php` | GET | `workspace_enter` navigation policy | resolve effective role; Admin cards or monitoring home | HTML shell/dashboard |
| `activities.php` | GET list/detail/create/edit/review; POST structure, assignment, abandon/restore, submit/review actions | login, role, entity, current assignment, state/revision guards | command aggregate; Activity/Operation/revision/assignment/audit mutations | HTML, feedback, redirects; Activity JS/CSS contracts |
| `operations.php` | GET list; POST execution update | login; Admin denied; Agent mutation only when currently assigned; reviewer read | row/version checks, command transaction, audit | HTML/redirect |
| `operationrequests.php` | GET; POST request/withdraw/decide | role, assignment, exact target/version and state | cancellation/reopening command transaction and audit | HTML/redirect; progressive dialogs |
| `partners.php` | GET; POST create/update/activate/deactivate | business-role read; Validator manage | native third-party mutation, entity/fingerprint locks, audit; partner deactivation closes active Projects | HTML/redirect |
| `projects.php` | GET; POST create/update/activate/deactivate | same as references; immutable original Partner | native Project mutation and audit | HTML/redirect |
| `operationtypes.php` | GET; POST create/update/activate/deactivate | same reference policy | entity-scoped custom table mutation and audit | HTML/redirect |
| `alerts.php` | GET filters | planning read + monitoring readiness | computed scoped projection | HTML |
| `reports.php` | GET report/filter/page/cursor inputs | report-specific planning/audit policy | server-filtered projection and preview | HTML |
| `reportexport.php` | POST report/format/filters + CSRF | report-specific policy | generate bounded PDF/XLSX/CSV in spool; record immutable export event | attachment or explicit HTTP error |
| `workflowactions.php` | GET audit filters | Validator/Admin audit read | current schema delegates to audit report; predecessor schema queries 200 entity-filtered rows | HTML |
| `admin/access.php` | GET; POST `invite`, `update_profile`, `deactivate`, `revoke` | native platform Admin only + CSRF | native User, role/rights, invitation/email and audit transactions | HTML/redirect/feedback |
| `auth.php` | public GET; POST `login`, `verify`, `resend`, `cancel` | OTP feature enabled; CSRF; pending challenge/session binding | password verification, OTP lifecycle, native-session creation/clear | no-store HTML or safe redirect |
| `invitation.php` | public GET; POST `accept` | selector + fragment-supplied verifier + CSRF | password rules, single-use invitation transaction, role activation, audit | no-store HTML/redirect |
| native login/forgot/reset pages | native actions intercepted by hooks | feature flag, CSRF and native-path guards | login redirection; neutral reset issue/consume | MJL auth templates or redirect |
| `documents.php`, `documentdownload.php` | every method | unconditional | no bootstrap, no storage access | dependency-free 403 text and security headers |
| `dpafdashboard.php` | every request | unconditional after bootstrap | no business processing | 403 |
| `nativeforbidden.php` | every method | unconditional | no bootstrap or storage access; Apache error surface | dependency-free 403 text and security headers |
| `css/mjl_app.css.php` | GET asset request | module asset registration/browser request | emits application CSS | CSS response |
| `css/mjl_auth.css.php` | GET asset request | module asset registration/browser request | imports/emits authentication CSS | CSS response |
| `js/native_guard.js.php` | GET asset request | session-aware route eligibility | emits supplemental native-route redirect script; server access checks remain authoritative | JavaScript response |

## Exact action vocabulary

| Endpoint | Method | Accepted action values | Mutation owner/effect |
| --- | --- | --- | --- |
| `activities.php` | GET | empty list/detail, `create`, `edit`, `review` | read/render only |
| `activities.php` | POST | `create_draft`, `create_submit`, `save_structure`, `submit_revision`, `abandon`, `restore`, `review_revision`, `request_cancellation`, `assignment_change` | Activity aggregate; assignment change additionally requires the exact Activity/version, target Agent(s), assignment policy and its transactional audit owner |
| `operations.php` | GET | empty list | scoped projection |
| `operations.php` | POST | `update_execution`, `request_cancellation`, `request_reopening` | Activity aggregate; exact Activity/Operation/version, execution or reason inputs, current assignment/role and workflow state are rechecked |
| `operationrequests.php` | GET | empty queue | scoped exception projection |
| `operationrequests.php` | POST | `withdraw`, `approve`, `reject`, each bound to `CANCELLATION` or `REOPENING` | Activity aggregate |
| `partners.php`, `projects.php`, `operationtypes.php` | GET | empty list, `create`, `edit` | read/render only |
| same reference routes | POST | `create`, `update`, `activate`, `deactivate` | reference writer/native adapters and audit |
| `admin/access.php` | POST | `invite`, `update_profile`, `deactivate`, `revoke` | auth/scope access writers and audit |
| `auth.php` | POST | `login`, `verify`, `resend`, `cancel` | session/OTP lifecycle |
| `invitation.php` | GET or POST parameter dispatch | `accept`; the rendered form is POST, but the controller uses `GETPOST` and has no explicit method guard | invitation consume, native password/role activation and audit; exact CSRF token still required |
| native `/user/passwordforgotten.php` hook | dispatcher-supplied action; custom hook does not enforce HTTP method | legacy `buildnewpassword`, `validatenewpassword` redirect to the neutral form; `mjl_build_password_reset` issues a neutral reset request; `mjl_validate_password_reset` consumes selector/verifier and changes the password | CSRF validation, reset lifecycle, session/OTP clearing and safe redirects; native method enforcement remains unresolved |
| `reportexport.php` | POST | no action discriminator; exact `format` vocabulary is `csv`, `xlsx`, `pdf` | export generation/audit |

All other listed report, monitoring, dashboard, denial and dynamic-asset endpoints reject mutation actions or use exact filter/query contracts rather than an `action` dispatcher. The invitation and native-reset rows explicitly record where a rendered POST form is not equivalent to a source-proven POST-only controller.

## Common request invariants

- State-changing routes compare Dolibarr CSRF tokens; high-value repeated forms also consume one-use context-bound MJL submission tokens.
- Custom-object reads and mutations include the active entity. Native reference access additionally verifies entity ownership.
- UI visibility is derived from policy but is not relied upon as the direct-route guard.
- Redirects use fixed MJL destinations or sanitized internal paths. Authentication responses use `Cache-Control: no-store`; sensitive public URLs keep verifiers in fragments until JavaScript copies them into POST fields.
- Route failures generally fail closed with HTTP 403, a redirect plus sanitized feedback, or an explicit unavailable section. Database command failures roll back and log/audit only after successful commits as designed.

## Unresolved runtime evidence

No HTTP route was exercised during the immutable baseline pass. The closure delta later exercised the password-reset and login/OTP routes in a disposable tenant; the focused suite passed 12/12 and was torn down. Other reachability and behavior above remain source-verified rather than runtime-proven.
