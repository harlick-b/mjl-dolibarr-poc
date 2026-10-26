# MJL Current vs Target Gap Analysis

This is implementation-debt evidence beneath the authority router and approved
PTA brief (DEC-087). The pre-PTA rows below describe prior implementation,
not satisfaction of the new target.

## PTA-2 readiness decision closure (2026-10-26)

PTA-1 completion remains `70ff0f9`. [Readiness 09](rebuild/09-pta2-validation-readiness.md)
records B1 resolved by DEC-108: role-wide Supervisor/Validator review, one eligible
decision per stage, preserved decisions after personnel changes, and reviewer
account deactivation without Activity handoff. No Activity reviewer assignments
or reviewer-responsibility lifecycle guard are required. Existing Agent assignment
guards and no-self-validation remain. PTA-2A is ready for separate authorization;
no implementation is authorized here. B2/L1–L3 withdrawal, amendment pause and
annual transfer/history decisions still block 2B only; complete PTA-2 is not ready.
Older implementation-debt sections below remain historical evidence.

## A1 enablement boundary (DEC-094)

Synthetic A1 is implemented; PC1 (exact password/Unicode/normalization,
invitation/OTP/abuse/pre-auth policies) and PC2 (concurrent sessions/foreground
activity classification) remain pending sponsor/RSSI approval. They block real
accounts, not isolated verification. A2 account management, A3 recovery, A4
business authorization and PTA remain unapproved. E1–E6 and production mail/TLS/
operations evidence are unchanged. See readiness §10/§12; do not infer approval
from the synthetic fixture values. The existing frontend developer-tool advisory
below remains separate from A1's Argon2id dependency.

## Foundation dependency follow-up (DEC-092)

`npm audit` on the locked frontend graph reports seven high-severity entries
propagating one `braces <=3.0.3` stack-exhaustion advisory
([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)) through
developer Stylelint/glob tooling. The selected current release has no compatible
patched braces version; npm's suggested force fix downgrades Stylelint to 7.7.0.
Do not apply that obsolete downgrade. The foundation passes fixed local glob
patterns to this developer tool; no user-supplied glob input or runtime API uses
this dependency. It is not bundled into the browser application. Recheck and
update the lockfile when a supported upstream fix becomes available. This is a
tracked tooling limitation, not a production security or compliance clearance.

## Rebuild decisions and boundaries (DEC-091, 2026-10-22)

**FOUNDATION_BLOCKER: 0.** Proposed stack, sessions, transactions and PWA boundaries
are explicit in rebuild baseline 02. Old custom-module/lifecycle/native-object/
PDF-engine recommendations below are HISTORICAL_ONLY technical evidence, not
instructions for the new stack. No PHP remediation or old test campaign follows
from this audit. The architecture verdict in the older PTA audit is superseded
for future development, while its business gaps remain useful.

Eight LATER_PRODUCT_DECISION groups remain. They block only the named feature,
not the health-only local foundation. Current approved behavior must not be
reopened as a question; banking custody and reallocation remain excluded.

| ID | Decision and smallest required clarification | Owner / blocked scope |
| --- | --- | --- |
| L1 | Who resolves late settlement discrepancies, what evidence releases closure, and where definitive financial facts become immutable with linked correction? No expense-ledger revival. | Client business sponsor/finance; exceptional settlement and correction branch |
| L2 | Project reopening, Partner deactivation and Operation cancellation/reopening after PTA approval; no bypass of Project closure guard. | Client business sponsor; affected lifecycle branches |
| L3 | Annual denominator/history treatment after approved withdrawal or cross-year transfer. | Client reporting owner; historical KPI/export cases |
| L4 | Zero-spending request/confirmation waivers, partial reversement and correction of declarations. | Client finance owner; those settlement cases |
| L5 | Partner-visible decision/evidence fields and allowed document contexts; file policy, retention, scanner and key/storage responsibility. | Client data owner/RSSI; Partner disclosure and Phase 4 |
| L6 | Whether PWA relance includes background push; re-notification/reschedule and delivery policy. | Client product owner/email operator; notification slice |
| L7 | Whether a future slice permits incomplete drafts. PTA-1 requires one-or-more balanced positive Operation allocations; DEC-106 resolves its calendar-date default. | Client product owner; any future incomplete-draft behavior |
| L8 | Phase 5 accounting structure/examples and Phase 6 official Partner templates/mappings, plus client meaning of SPD. | Client accounting/reporting/delivery owners; relevant later outputs |

Six EXTERNAL_SECURITY_DEPENDENCY groups SEC-E1–E6 are detailed in
[baseline 03](rebuild/03-security-compliance-baseline.md): legal/source currency,
hosting approval, cryptography/mail, operational evidence, no-reprise migration
interpretation, and contractual delivery acceptance. Their named Ministry,
RSSI/DSI, legal, provider and client owners must resolve them before sensitive
use/deployment or relevant acceptance, not before an empty local scaffold.

POST_FOUNDATION_WORK includes actual auth/OTP, PTA/finance, private optional
documents, Partner portal, relance and operational evidence. Missing product
screen inspiration blocks those screens only; v3 tokens already outrank the
green HTML inspiration palette. No new visual design is generated here.

## Retained POC implementation evidence

| Target | Current state | Remaining gap / owner |
| --- | --- | --- |
| One transactional audit | Append-only entity-scoped audit table, transaction-bound writer, and sanitized Activity chronology exist. | Later object adapters remain owned by their phases. |
| No obsolete finance core | Finance schemas, loaders, routes, reports, and update SQL are removed; RST-006A planning and RST-006B execution are active on the empty local tenant. | No Phase 3A gap. |
| Invitation-only access and login verification | Business-role-only invitation/reset lifecycle and configuration-gated email OTP login are implemented; groups/scopes are not authorization inputs. | Local check on 2026-10-20: the retained Admin has a unique configured email, but OTP remains disabled. No SMTP server/credentials are configured, the sender is a placeholder, and the container has no sendmail executable. Configure mail and verify delivery before setting `MJL_AUTH_OTP_ENABLED=1`. Production email/base URL/secrets remain operator confirmations. |
| Failed-login recording and OTP expiry recovery (DEC-077) | Native failed-login recording is enabled in the local tenant and retained by bootstrap. `startOtp()` replaces expired challenges while preserving live-challenge counters and active lockouts. | Focused authentication suite passed 19/19 after reproducing the missing event; transaction contract and PHP syntax checks passed. Mail remains absent and OTP remains disabled. |
| Dashboards, browsing and navigation | Role-specific dashboards, computed alerts, scoped browsing, permission-aware action queues, financial disclosure, and Alertes/Rapports/exception navigation are implemented behind RST-012 readiness. Admin receives supported access, audit, and technical destinations without fabricated metrics. | User acceptance remains outstanding. |
| Activity execution and exceptions | Module 0.21.0 provides integer-XOF execution, terminal locks, version-bound cancellation/reopening, Activity cancellation cascade, pure projections, and hourly reconciliation through the aggregate command. | The unsigned 170-combination human accessibility review remains a production/release blocker. |
| Approved spending-entry immutability (DEC-076) | Implemented and installed in the empty local tenant: separate draft/submitted/approved expenses and atomic reversal/replacement. Six focused checks passed, including cancelled-Activity correction-only access and approved totals/audit exports. Manual user acceptance remains outstanding. | Role-based user acceptance and manual accessibility review remain outstanding. Canonical workflow rules are in the functional specification and status model; Phase 4 is unchanged. |
| REST API (DEC-077/078/080/082/083/084/085/086) | All 75 inventoried MJL actions have REST adapters, including access administration; 86,400-second idle / 86,400-second absolute expiry is shared by REST and remaining protected HTML. | Endpoint coverage is complete, while user acceptance remains outstanding. Mail must be configured and delivery verified before OTP enablement. Migrated screens require JavaScript. |
| REST migration controls | Migrated routes use strict JSON inputs, CSRF, command-owned guards and explicit safe errors. Expense creation checks but does not increment Operation version. Reporting calculates full-selection aggregates. | Preserve replay protection, exact version/fingerprint targets, correction-only access and full-selection totals as specified in the REST contract. Shared expiry enforcement must cover remaining HTML routes too; no raw SQL/exception text. |
| Documents/additional accounting/official outputs | Current custom document endpoints deny every method without storage access, and deployment rules block native document paths. | Phase 4 document planning is defined in `docs/mjl-phase4-contextual-document-management.md`; implementation remains unauthorized and its listed client/operator decisions remain open. Additional Phase 5 accounting structure and official-output decisions remain deferred to their own gates; current spending approval is covered separately by DEC-076. |
| Persistent empty tenant | Exactly one native Admin; target/custom business tables remain empty. | Disposable factories expand only with their owning feature units. |
| W5 reporting and monitoring ownership | Selected report/audit HTTP, bounded read, presentation, and stream-delivery owners are active. Dashboard/index/alerts consume W2 monitoring-read; `MjlMonitoring`, durable export generation/evidence, and shared Operation/request branches remain retained owners. | No W5 ownership gap or later-wave regression. |
| Historical reverse-prefix gates | BC-021 is closed: `rst002b` and `rst006a` receive narrow disposable bootstrap profiles and exact verification before their matrices. The broad host `MJL_TEST_MODE` is not forwarded. | Preserve the named profiles and exact gates after W6. |
| W6 lifecycle ownership | Complete under DEC-070. The descriptor delegates once to `mjl_lifecycle_prepare()` in the existing activity schema installer seam; native lifecycle calls and exact detector/installer/resource ownership are retained. Focused ownership/loading contracts and all lifecycle regression gates passed. | No W6 ownership gap or W7 regression. |
| W7 obsolete Activity mutation wrappers | Complete under DEC-071. The two unused broad mutation wrappers are absent; the surrounding access library, read helpers, and action-specific/locked mutation authorization remain. | No W7 ownership gap. Other dead-code candidates remain separately deferred; do not infer acceptance, production readiness, or general cleanup authority. |
| Final architecture-migration reconciliation | DEC-072 verified W0-W7 ancestry/completion, exact frozen hashes, 35/35 preservation, current authority consistency and 12 bounded residual groups with zero migration blockers. | `MIGRATION_COMPLETE: YES` for the frozen architecture migration only. Application acceptance and production readiness remain unclaimed. |
| Test-suite cost and duplication | Focused commands and isolated disposable tenants exist; focused mode names are repeated across runner maps and dispatch conditions. | **Unapproved recommendation:** simplify overlapping historical phase and reset suites where a smaller maintained test proves the same behavior, and centralize focused-mode metadata when runner work is otherwise required; retain authorization, entity isolation, security, and data-integrity coverage. |
| Production preparation | Development configuration exists. | Production work and readiness assessment are deferred until the user explicitly requests them. Client configuration remains unknown and no feature or application has been accepted. |

## Forensic architecture audit findings

The completed forensic audit is retained in Git history. Its unresolved
findings below are implementation debt, not approved work:

| Area | Current evidence | Gap / required decision |
| --- | --- | --- |
| Retained Admin password reset | **Resolved.** Trigger and consume guards permit the native entity-0 Admin through an active-entity reset while preserving same-entity rules for business users. The current disposable auth suite passed 19/19. | Preserve the focused regression and entity rule. |
| Reference transaction results | **Resolved.** Create/update/lifecycle stop on failed begin, reject failed commits, attempt rollback and close an uncertain connection after rollback failure. | Preserve the direct failure contract and existing business outcomes. |
| Access and authentication transaction starts | **Resolved.** Standalone access and authentication mutations stop before writes when transaction start fails; commit failure requests rollback, and rollback uncertainty closes/quarantines the connection. Participant access writes still do not own the caller transaction. | Preserve the focused begin/commit/rollback contracts and generic public failure outcomes. |
| Native password persistence | **Resolved.** The MJL password adapter forces encrypted-only native storage for each invitation/reset write and restores the prior runtime setting. The disposable auth suite proves `llx_user.pass IS NULL` after both flows. | Preserve `SEC-AUTH-006` and both database assertions. |
| RST-006B early interruption | **Resolved.** Every exact early Operation-check prefix is classified as resumable, with four new injected interruptions passing apply, exact verification and rollback in the Phase 3A suite. | Preserve the failure-point matrix and fail-closed handling of unknown shapes. |
| Export stream failure handling | **Resolved in W5.** `GENERATED` still records the completed private artifact before HTTP delivery. The delivery adapter treats `fread() === false` as explicit incomplete delivery, closes the stream, emits no false-success body, and preserves committed evidence. | Preserve the focused contract and real injected server-read-failure E2E oracle. |
| Cron reconciliation | One row failure stops later rowids, and multi-entity behavior depends on the process `$conf->entity`. | Decide supported batch-failure and entity semantics before changing the reconciler. |
| Verification command scope | The public unit command stalled in this managed environment; PHP-spawning files hit sandbox limits, four design assertions conflict with current source, a nested contract is undiscovered, and the E2E script names only a subset of configured suites. | Reproduce in the supported execution environment, resolve each design assertion against current authority, and make each named gate's discovery and timeout behavior explicit. |
| Forensic coverage | All 157 application files and the immutable 80-file verification baseline were read in full; the added closure contract was also fully read, for 81/81 current verification files. File fingerprints, symbol/site annexes, and the closure delta make the population inspectable. | Most baseline symbols are indexed rather than behavior-mapped end to end, and runtime/database/browser evidence remains limited. Do not claim exhaustive behavioral comprehension or target-architecture confidence. |
| External font dependency | The module header hook loads Google Fonts on anonymous authentication and MJL pages. | Production CSP, privacy and asset-hosting policy remain operator/product decisions for explicitly requested deployment work. |
| Password action HTTP methods | **Resolved in W4.** Direct GET characterization confirmed the gap; invitation acceptance and MJL reset issue/consume mutations now require POST while retaining CSRF and existing redirects. | Preserve the focused direct-method regression. |

## Post-cadrage UI dependencies outside the approved design pass

These are deferred backend or data-contract gaps, not instructions to expand a
visual wave. Stop and ask before changing their queries, endpoints, schema,
permissions, authentication, or business rules.

| Reference behavior | Current evidence | Deferred dependency |
| --- | --- | --- |
| Editable Operation drawer | Execution now uses REST and issues tokens on submission, eliminating the former page-load token exhaustion. The consultation drawer remains read-only. | An editable drawer is an optional UI change, not authorized by the transport migration. |
| Reference and account fields/actions | Partner/Project screens expose only current name, parent, status, and guarded lifecycle facts through shared responsive lists and progressive forms; Project edit preserves its original Partner. Admin access presents invitation, role update, deactivation, and revocation through shared responsive tables and progressive exact-form dialogs, including real invitation delivery states. | Defer Partner description, reference counts/timestamps, unsupported account profile/reactivation actions, and bulk assignment replacement. |
| Extra list and dashboard data | Current monitoring filters support search, Partner, Project, validation, execution, completeness, and period overlap. The reference also depicts Agent/deadline filters and Admin metrics not supplied by the current read contracts. | Use supported filters and real projections only; seek a separate decision for missing read contracts. |

## Approved PTA impact audit — 2026-10-21

**Historical 2026-10-21 verdict, superseded technically by DEC-091:** retain the
existing custom-module/REST/command/audit architecture.
The approved direction is feasible without a core edit or a framework rewrite.
Confidence is high in the major impact areas, conditional in settlement details
and historical metrics. This is static source analysis at `18d55d1`, with three
independent domain, access/side-effect and UI/test audits consolidated. It is
not runtime verification, legal certification or implementation approval.
The user-supplied brief was already untracked at audit start and is unmodified.

### Scope and conflict register

Paths below are relative to `custom/mjlfinancement` unless prefixed `docs/` or
`tests/`. Line references identify the audited baseline, not stable future anchors.
Risk indicates impact of an incomplete migration, not a claimed active exploit.

| Risk / approved requirement | Current source evidence | Required replacement or preservation |
| --- | --- | --- |
| High — annual PTA; creation only within PTA | `class/mjlactivitycommand.class.php:447,704`; `lib/api/mjl_api_activities.lib.php:79`; `sql/llx_mjlfinancement_activity.sql:6` | Add Project/year PTA identity, automatically created with the first Agent-planned Activity; resolve/require PTA in creation/token/input/read paths and validate planned-start-year. Remove standalone create semantics. Preserve native Partner/Project objects. |
| High — one active Project per Partner | `class/mjlreferencecommand.class.php:43,188` | Validator ownership already exists. Serialize create/reactivation on Partner and reject a second active Project; retain past Projects. Closure must reject unfinished Activities or financial steps (DEC-090); reopening details remain open. |
| High — equal Agent access | `lib/mjl_activity_access.lib.php:37`; `class/mjlmonitoring.class.php:42`; `class/mjlactivitycommand.class.php:47,193`; `class/mjlexport.class.php:68` | Replace assignment-based read/write/final-export guards together, including timeline, filters, exception/correction paths and allowed-action tokens. Preserve entity, role, state, optimistic version and contributor guards. |
| High — Supervisor and Validator assign Agents | `class/mjlactivityassignment.class.php:122`; `lib/api/mjl_api_activities.lib.php:19,113` | Allow both roles through route, token, locked command and DB checks. Remove hard-coded Validator audit attribution; record actual role. Assignment loss no longer revokes Agent business access. |
| High — approved PTA amendments | `class/mjlactivitycommand.class.php:47,77,596,638`; `scripts/rst006a_schema.lib.php:125,349` | Separate candidate revision from effective approved revision. Current mutable Activity/Operation rows cannot be overwritten by a pending amendment. Change DB checks/triggers, revision pointers, decision targets and projections together. Keep immutable snapshots/contributors and exact two-stage decisions. Pause affected execution while approval is pending; unrelated approved Activities continue (DEC-090). |
| High — edits after start/end | `class/mjlactivitycommand.class.php:48,78,153` | Remove blanket future-date prohibitions and conflicting action flags/UI/tests. Retain date ordering, formal amendment approval and financial-basis freeze once settlement begins. |
| High — cross-year transfer | Current revision snapshot at `class/mjlactivitycommand.class.php:649` lacks PTA membership | Record old/new PTA and effective approved revision in one audited transfer. Lock both years in deterministic order. Retain historical attribution; do not move rows silently or count both years as current ownership. |
| Medium — all-Partner +3-calendar-month suggestion | `js/activities.js:37`; no existing suggestion found | DEC-106: add three calendar months to a date-only value, preserve the day when valid and otherwise clamp to the destination month's last day. Do not use 90 days, timezone shifts or automatic end-of-month preservation; never overwrite a manual date. No UNICEF exception. |
| High — final spending and administrative settlement | `class/mjlactivitycommand.class.php:200,267,300`; `scripts/spending_schema.lib.php:37`; `scripts/schema/spending.sql` | New request/declaration/return facts are absent. User confirmed final Operation spending replaces the ledger. Remove obsolete expense approval/reversal routes, schema and test callers together; never maintain competing totals or an extra approval chain. |
| High — explicit Agent closure | `lib/mjl_execution.lib.php:12,26`; `class/mjlexecutionreconciler.class.php` | Replace automatic Activity completion as realization criterion. Physical completion is distinct from closure; closure checks finalized spending, required approvals, confirmed transfer, settled reversement and no unresolved discrepancy in one transaction. No closure approval stage. |
| High — formal PTA withdrawal | `class/mjlactivitycommand.class.php:318,349,366` | Replace conflicting Agent-to-Validator Activity cancellation with two-stage PTA withdrawal. Do not automatically preserve Operation cancellation/reopening behavior where it would alter settled amounts; clarify that branch first. Never delete history. |
| High — whole-year official KPIs | `lib/mjl_monitoring.lib.php:40,81`; `lib/mjl_report_data.lib.php:206,215`; `lib/api/mjl_api_reporting.lib.php:50` | Use entire selected PTA's effective approved revisions; UI search/page/status filters must not silently change denominators. Closed-only numerators, null/zero distinction, report-date context and uncapped anomalies. Withdrawal and historical-transfer denominator policy needs precision. |
| High — 21-day delivered relance | `lib/mjl_monitoring.lib.php:117`; `core/modules/modMjlFinancement.class.php:55` | Existing read-time seven-day warning is not delivery. Reuse cron integration, but add a focused reminder job, inbox and durable recipient/channel outcomes. Recompute on dates/assignments, handle already-due records, stop closed records. Push infrastructure was not found. |
| High — exclusive Partner portal identity | `lib/access/mjl_access_policy.lib.php:3`; `class/mjlauthcommand.class.php:108,167`; `class/mjlmonitoring.class.php:22` | Extend invitation, login, reset, session, access administration and reads for exactly one entity-scoped Partner binding. Do not treat Partner as an internal business role or reuse arbitrary legacy multi-Partner scope rows. |
| High — Partner isolation, global audit exclusion | `class/mjlexport.class.php:45,54,68`; `lib/api/mjl_api_reporting.lib.php:13` | Dedicated allowed-field read/export projection with Partner ownership joins and fresh authorization before delivery. Global audit remains Validator/Admin only. Test guessed IDs, filenames, filters and changed identity scope. Allowed supporting-document visibility still needs definition. |
| High — optional contextual documents | `documents.php:2`; `documentdownload.php:2`; `docs/mjl-phase4-contextual-document-management.md` | Keep current deny-all until the explicitly gated slice. Remove mandatory-attachment/requirement-snapshot obligations; extend contexts to PTA/revision/decision/request/confirmation/reversement. Preserve guarded storage, entity scope and historical evidence. |
| Medium — complete regenerable Fiche PDF | `lib/mjl_report_data.lib.php:175`; `lib/mjl_report_render.lib.php:22,109,140`; `class/mjlexport.class.php:122` | Extend existing Fiche and TCPDF/export workflow with approved context, full administrative chronology and reconciliation. Existing row/section caps must fail explicitly or be deliberately adapted, never silently omit history. No new PDF engine, signatures or permanent PDF-snapshot subsystem. |
| High — real OTP delivery | `lib/mjl_auth.lib.php:248,499`; `lib/mjl_email.lib.php:156` | Auth and email adapters exist; OTP is configurable and protected REST fails closed when disabled. Last documented local mail absence/OTP-disabled state was not rechecked. Verify actual delivery before enabling internal or Partner OTP. Do not confuse disposable outbox capture or transport acceptance with inbox receipt. |

### Authority and removal boundaries

The brief supersedes related sections of functional specification v2 (3, 6–10,
13–23, 26, 30), permission matrix (visibility, assignments, new Partner identity),
status model, data dictionary and scope exclusions. DEC-076/077 itemized expense approval and reversal/replacement details are
superseded: the user explicitly chose final Operation spending instead.
DEC-083–086 preservation of assignment/finance behavior is baseline evidence,
not a veto on the new rules. Current REST/OpenAPI describes 75 old-scope actions,
not coverage of new PTA functionality.

The Phase 4 security gate stays, but its mandatory-category modes, requirement
snapshots as submission blockers, assignment authorization, limited parent types
and blanket Activity attachment lock conflict with optional later-context evidence.
Reconcile those rules in the document slice. A supplied Fiche is not the old
Phase 6 bespoke Partner-template/signature product; do not import those gates.
Current completed-phase reports, historical matrices and accessibility sign-off
must not become new audit execution obligations.

Keep the frozen engineering responsibilities: guarded REST transport, finite
commands, locked authorization, command-owned writes and audit, bounded reads,
private rendering and fresh export authorization. Record only the narrow new
PTA/settlement/Partner/document ownership amendments needed before their slices;
do not restart W0–W7 or silently rewrite frozen fingerprints. Preserve the
project security baseline (including its PSSIE requirement); this audit makes
no legal interpretation or compliance claim and does not reopen a production audit.

### Minimal domain and state proposal (not implemented)

| Object / state dimension | Minimal facts and transitions | Existing owner / change |
| --- | --- | --- |
| Annual PTA | Entity, Project, calendar year; unique `(entity, project, year)`; no collective all-Activities approval barrier | Small annual-planning command/read responsibility; use current lifecycle seam for DDL. Automatically create on first Agent-planned Activity for that Project/year; concurrent first creations must resolve to one PTA. |
| Activity identity and planning | Stable identity, approved revision pointer, candidate pointer, current PTA; approved and candidate values coexist | Extend Activity command and immutable revisions; do not build a generic workflow engine. |
| Candidate revision | Draft → submitted → prevalidated → approved; either reviewer may return to Agent; resubmission repeats both stages | Existing exact-revision/contributor decisions reused; reason, change type, old/new PTA and Operation identity/content included. Withdrawal and transfer are changes, not deletion. |
| Operation realization | Stable Operation identity plus approved allocation; physical progress and explicit nullable final XOF spending | Final Operation declaration replaces itemized expenses; preserve positive allocation and exact Activity sum. Do not infer missing final values from partial totals. |
| Administrative requests | Separate décaissement and virement records; each Agent submission → Supervisor → Validator, or returned correction; target finalized amount and approved basis | Activity-owned settlement commands are the smallest default. A separate class is justified only by real responsibility separation, not file length. Keep request IDs/versions; no unique-one-virement-ever constraint. |
| Insufficiency authorization | Approved budget revision plus distinct financial authorization before décaissement | Separate Agent → Supervisor → Validator request, distinct from both décaissement and virement (DEC-089). |
| External facts | Confirmed virement amount/date; required reversement; declared returned amount/date and optional evidence | Administrative declarations, never bank execution. Preserve discrepancies and immutable prior facts; correction/resolution permissions require decisions. |
| Closure | Open → closed directly by Agent once all current prerequisites pass | Lock approved basis, final spending, decisions and declarations together; reject concurrent stale changes. Persist actor/time/audit. No extra reviewer action. |
| Partner identity | Exclusive read-only identity bound to one Partner within entity | Extend existing access/auth owners; no second login stack, role switching or public registration. |

Schema work includes PTA, approved/candidate pointers and immutable revision
content/Operation relationships, independent request decisions, external declarations,
reversement obligation and closure facts, Partner binding and reminder delivery
records. Reuse existing audit and export evidence tables. Every parent/child
reference needs entity-consistent checks; amounts remain integer XOF/decimal
strings through JSON and JavaScript. No float arithmetic for money.

Approved revision activation must atomically update all effective values and
annual attribution. Candidate changes cannot alter live execution budgets or
official totals. Pin both the approved budget revision and finalized spending
snapshot when décaissement begins. Block silent rebasing; report a late exception
for a defined resolution. No asynchronous mail or PDF rendering inside a mutation
transaction. Record success evidence in that transaction; perform external effects
after commit, with truthful outcome records.

### Permission target

| Action | Agent | Supervisor | Validator | Admin | Partner identity |
| --- | --- | --- | --- | --- | --- |
| Read PTA/Activity | All within active entity | All within active entity | All within active entity | Existing technical/audit scope | Own Partner's authorized records only |
| Plan/submit/revise | Yes, workflow guards | No direct editing | No direct editing | No | No |
| Manage Activity assignments | No ordinary reassignment | Yes | Yes | No | No |
| Prevalidate / final approve | No | Prevalidate | Final approve | No | No |
| Create/close Project | No | No | Yes | No | No |
| Declare physical work/final spending/external transfers/returns; close | Yes, prerequisite guards | No | No | No | No |
| Approve décaissement/virement | No | First stage | Final stage | No | No |
| Invite accounts | No | No | No | Yes | No |
| Full audit-history export | No | No | Yes | Yes | No |
| Own authorized portal records/Fiche export | N/A | N/A | N/A | N/A | Read-only, Partner-scoped |

No-self-validation tracks actual contributors and reviewers even after role
changes. Broader Agent access does not remove role, state, entity, stale-version
or immutable-history safeguards. Optional attachments do not weaken file access
controls. The exact Partner-visible subset of documents/decisions must be explicit.

### API, UI and external effects

Update existing `/activities` creation/structure/submission/revision decisions,
assignment options/tokens, `/projects` create/activation, `/operations` execution,
expense/exception paths as applicable, `/dashboard`, `/alerts`, `/reports`, and
Admin invitation/session payloads. Add explicit PTA, amendment/transfer,
settlement/declaration/closure and Partner read/export operations; exact route
names are slice design, not a new committed wire contract. Change strict route
allowlists, OpenAPI, CSRF/submission-token contexts, allowed-action projections,
JS clients and tests together. No front-end-only transition or old bypass route.

`js/mjl_activities.js`, `mjl_execution.js`, `mjl_reporting.js`,
`mjl_references.js`, `mjl_access.js`, navigation and their shells are affected.
Reuse v3 tables, forms, dialogs, review steps, chronology, auth shell and exact
money formatting. Current loading text is not skeleton loading. Add appropriate
loading/empty/error states and accessibility checks with eventual screen work.
No applicable screen inspirations were found for PTA overview/amendment/transfer,
settlement, Partner portal or contextual documents. **Stop and ask before
implementing an uninspired screen**, while independent backend work may proceed.

Reminder delivery requires a focused persisted schedule/recipient/channel key,
attempt status and current-date/assignment/closure recheck. It must handle new
assignees after a due date, changed dates, retry without duplicate successful
notifications and inactive recipients. Exact re-notification policy and push
requirements should be settled in that slice. In-app evidence, SMTP acceptance
and browser push acceptance are different outcomes; none alone proves reading.
Reuse cron registration/email adapters, not a general messaging platform.

### Open details and dependent stops

Resolved during audit: the user chose final Operation spending instead of the
itemized expense approval/reversal ledger. External fund custody is out of scope:
no custody/source-of-funds model or clarification is needed. Keep the approved
reversement formula and record only the specified administrative declarations.

Also resolved (DEC-089): automatically create the annual PTA when an Agent first
plans an Activity for that Project/year. Insufficiency authorization is a separate
Agent → Supervisor → Validator request, distinct from décaissement and virement.

Also resolved (DEC-090): Project closure is blocked while any Activity or required
financial step remains unfinished. Execution of an Activity pauses while its
proposed amendment awaits approval; unrelated approved Activities continue.

1. Who resolves late exceptions/amount discrepancies, and which evidence releases
   closure? Blocks the exception branch of settlement design.
2. What are Project reopening rules and the effect of Partner deactivation?
   Deactivation must not bypass the approved Project closure guard. How do
   approved withdrawal/transfer affect historical annual denominators? These
   details block only their lifecycle and reporting branches.
3. For explicit zero final spending, are zero-amount request/confirmation stages
   required or waived? How are partial reversements recorded and discrepancies
   corrected? No automatic exception or fabricated settlement will be added.
4. Which justificatifs/decision fields are Partner-visible, and who determines
   that? Is PWA notification intended to include background browser push? These
   block only the relevant portal/document/notification slices.

Do not require all answers before independent planning can progress. Prefer the
smallest direct choices (one current candidate per Activity; no aggregate PTA
approval; exact year identity). DEC-106 approves the calendar-month clamp. The
brief requires one-or-more Operations with balanced allocation; do not preserve
incomplete-draft exceptions without a later decision.

### Focused future verification and audit limitations

Port the distinct domain cases into current REST E2E specs:
`tests/e2e/api-activities.spec.js` (PTA, amendments, equal Agent rights),
`api-execution.spec.js` (spending, independent decisions, settlement, closure),
`api-reporting.spec.js` (annual denominators, Fiche, export scope), and
`api-access.spec.js` / `api-auth-partners.spec.js` (exclusive Partner invitation,
OTP and forbidden internal access). These names describe future extensions,
not tests that already prove the new behavior.

Replace obsolete assignment-denial, independent creation, post-start prohibition,
automatic-completion and incompatible ledger expectations. Preserve transaction
rollback, exact revision, no-self-approval, replay/stale-write, entity isolation,
secret protection and export delivery tests. Legacy form/VUI matrices are case
sources, not mandatory runs. Keep deny-all document checks until guarded cutover.

Include concurrent Project create/reactivate and first-Activity PTA creation;
candidate-versus-approved reads and affected-only execution pause;
Project closure denial for unfinished Activities or financial obligations;
late edits and fresh two-stage review; cross-year transfer; missing/zero/large
XOF; no closing before confirmed transfer/full reversement; stale settlements;
whole-PTA metrics despite UI filters; deduplicated reminders; guessed other-Partner
API/file/PDF/export IDs. Use pure calendar/money/KPI checks and disposable DB
constraint/transaction tests where they add distinct coverage.

Run only the affected `MJL_TEST_GREP='…' npm run test:api` cases through the
existing disposable runner, relevant changed-schema checks and changed PHP/JS
syntax checks. No test, browser, tenant query, SMTP probe or runtime configuration
change was performed for this documentation audit. No current tenant emptiness,
actual delivery, new workflow correctness or production readiness is asserted.
