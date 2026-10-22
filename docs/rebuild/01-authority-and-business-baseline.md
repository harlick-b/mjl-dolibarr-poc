# MJL rebuild: authority and business baseline

Date: 2026-10-22. Documentation audit only; no implementation or application
acceptance. The user's rebuild instruction selects React/Vite JavaScript/JSX,
FastAPI and PostgreSQL. The proposed technical standard is
[02](02-target-architecture-and-engineering-standard.md); security requirements
are consolidated in [03](03-security-compliance-baseline.md). The existing
[roadmap](../mjl-implementation-roadmap-v2.md) owns readiness and future slices;
the [gap analysis](../mjl-current-vs-target-gap-analysis.md) owns unresolved work.

## Authority and disposition

Latest explicit user instructions prevail. Business authority remains the
[PTA brief](../mjl_codex_authoritative_pta_change_brief.md), clarified by
DEC-087–090 in the [decision register](../mjl-decision-register-v2.md), followed
by compatible v2 rules. Neither old code nor passing tests can override that
overlay. Contractual/security obligations and approved visual identity remain.
The frozen Dolibarr architecture and Engineering Standard remain unchanged
historical evidence, not technical authority for the rebuild. Their former
approval does not approve the proposed new standard or any implementation.

The targeted disposition inventory below covers **27 existing files** (explicit
paths, each counted once), plus the local inspiration collection as one
uncounted reference collection. It is not a count of approved requirements or
an exhaustive repository census. Split classifications apply to different
sections of mixed documents; they do not make obsolete prose authoritative.

| Existing paths under `docs/` | Classification | Necessary disposition / risk |
| --- | --- | --- |
| `mjl-authoritative-decisions.md` | CURRENT_BUSINESS_AUTHORITY; technical claims SUPERSEDED | Route new technical authority explicitly; high risk of following frozen Dolibarr boundaries as rebuild instructions. |
| `mjl-decision-register-v2.md` | CURRENT_BUSINESS_AUTHORITY; HISTORICAL | Append rebuild provenance; preserve prior decisions and their dates, applying later supersession. |
| `mjl-implementation-roadmap-v2.md` | REUSABLE_BEHAVIORAL_EVIDENCE; legacy technical sequence SUPERSEDED | Put proposed foundation first; completed migration remains completed historical work. |
| `mjl_codex_authoritative_pta_change_brief.md` | CURRENT_BUSINESS_AUTHORITY | Retain DEC-087–090 overlay; execution instructions requiring legacy architecture do not select the new stack. |
| `mjl-current-vs-target-gap-analysis.md` | REUSABLE_BEHAVIORAL_EVIDENCE; old architecture verdict SUPERSEDED | Preserve business gaps; identify new-stack owners instead of demanding PHP remediation. |
| `mjl-functional-specification-v2.md`, `mjl-permission-matrix-v2.md`, `mjl-status-and-transition-model-v2.md`, `mjl-data-dictionary-v2.md`, `mjl-scope-boundary-v2.md` | CURRENT_BUSINESS_AUTHORITY where compatible; conflicting pre-PTA sections SUPERSEDED | Preserve exact money, audit, segregation and deferred accounting/report inputs; PTA baseline below overrides old assignment, ledger, date, closure and document rules. |
| `mjl-phase4-contextual-document-management.md` | CURRENT_SECURITY_AUTHORITY for containment; REUSABLE_BEHAVIORAL_EVIDENCE; conflicting requirements SUPERSEDED; residual risks DECISION_REQUIRED | Keep deny-all gate. Optional documents replace mandatory-category/submission blockers. ECM implementation and old accepted preview/key risks do not silently transfer to the rebuild. |
| `mjl-security-compliance-baseline-codex-prompt.md` | CURRENT_SECURITY_AUTHORITY for confirmed contractual inputs; HISTORICAL execution instructions | Retain seven contractual requirement families. No pre-existing generated baseline was found; 03 is the consolidated baseline, not a competing second one. |
| `mjl-rest-api-contract.md`, `mjl-rest-api.openapi.yaml` | REUSABLE_BEHAVIORAL_EVIDENCE; LEGACY_TECHNICAL_REFERENCE | Preserve old wire inventory; classify all 75 operations below. No replacement OpenAPI generated in this audit. |
| `architecture-audit/14-preservation-ledger.md` | REUSABLE_BEHAVIORAL_EVIDENCE; LEGACY_TECHNICAL_REFERENCE | Historical 35-rule migration contract, reclassified below rather than automatically ported. |
| `architecture-audit/17-target-architecture-proposal.md`, `mjl-engineering-standard-v1.md` | LEGACY_TECHNICAL_REFERENCE; HISTORICAL | Keep byte-identical; the router scopes their frozen authority to the historical POC. |
| `design-system/README.md`, `design-system/DESIGN.md`, `design-system/approved/v3/DESIGN.md`, `design-system/approved/v3/design-tokens/tokens.json`, `design-system/approved/v3/design-tokens/semantic-tokens.json` | CURRENT_VISUAL_AUTHORITY; old implementation/product assertions SUPERSEDED | Retain tokens, Inter, density, responsive/accessibility intent. React components replace PHP widgets; no default shadcn visual reset. |
| `design-system/audit/current-screen-inventory.md`, `design-system/audit/current-ui-audit.md`, `mjl-current-app-functional-map.md`, `mjl-acceptance-tests.md` | REUSABLE_BEHAVIORAL_EVIDENCE | POC screen/test evidence only; no inherited demand to execute old matrices for this audit or scaffold. |
| `mjl-deployment-checklist.md` | LEGACY_TECHNICAL_REFERENCE; DECISION_REQUIRED for external facts | Keep unresolved operator/security facts; commercial cloud direction does not approve provider/region. |
| `inspiration/` (local, ignored collection; not included in 27-file count) | CURRENT_VISUAL_AUTHORITY for relevant composition references | Actual auth, dashboard, Partner, Project, Activity and history references exist; they do not define permissions. Missing PTA/settlement/portal/document screen references block those screen designs only. |

No missing authority-router target was identified in this audit. The security
prompt's requested generated baseline was absent; its absence is explicitly
resolved by 03. Inspiration files are local and may be absent in a fresh clone.

Eight superseded technical instruction families apply **only to the rebuild**:

| Family | Superseded requirement | Rebuild direction |
| --- | --- | --- |
| T1 | All MJL work must live in a Dolibarr custom module/theme | Dedicated frontend/backend; preserve old core and POC unchanged. |
| T2 | `main.inc.php`, native hooks and module descriptor bootstrap | React/Vite and FastAPI application entrypoints. |
| T3 | Native Dolibarr/PHP sessions, password adapters and login hooks | Application-managed FastAPI session boundary; retain invitation/password/OTP policy. |
| T4 | MariaDB adapter, native activation and predecessor-schema machinery | PostgreSQL, SQLAlchemy 2, reviewed Alembic migrations; clean database. |
| T5 | Native Societe/Project/User objects as mandatory domain persistence | Approved business entities independent of ERP object ownership. |
| T6 | PHP templates, jQuery/Select2, old DOM/form fallback and CSS emission | JSX, Router/Query, Tailwind/shadcn/Lucide; retain visual and accessibility contracts. |
| T7 | ECM/TCPDF/native spreadsheet and Dolibarr-specific delivery seams | Private guarded storage/export boundary; concrete engines selected only when required. |
| T8 | W0–W7/RST migration sequencing, PHP commands and historical proof matrices | Proposed foundation and focused new-stack checks; history remains evidence. |

## Business contracts: 21 classified

RETAIN preserves meaning, MODIFY preserves the objective with approved changed
behavior, SUPERSEDED retires old behavior, NOT_APPLICABLE is legacy-only, and
DECISION_REQUIRED marks an unresolved branch. These are carryover dispositions,
not authorization to implement.

| ID / contract | Disposition | Target rule / source |
| --- | --- | --- |
| B01 hierarchy and annual planning | MODIFY | Partner → Project → annual PTA → Activity → Operation; automatically create one Project/year PTA with first Agent-planned Activity; no independent Activity creation (brief §2, DEC-089). |
| B02 Project lifecycle | MODIFY | Validator creates/closes; at most one active Project per Partner; preserve past Projects; closure denied while any Activity/required financial step unfinished (DEC-090). Reopening/deactivation details remain L2. |
| B03 Agent access and assignments | MODIFY | Equal Agent read/edit rights across MJL authorized organizational scope, subject to state; Supervisor and Validator manage assignments for coordination/notifications, never Agent authorization (brief §2). No generic Ministry tenant platform. |
| B04 independent Activity approval | RETAIN | Agent submission, Supervisor prevalidation, Validator final approval, exact immutable revision and identity/contributor no-self-validation. Activities proceed independently; Validator return goes straight to Agent and structural resubmission repeats both stages. |
| B05 approved amendments | MODIFY | Keep approved/candidate content separate; formal two-stage additions/changes/withdrawals; preserve reasons and old decisions. Pause affected execution while proposed change awaits approval, unaffected Activities continue (DEC-090). |
| B06 dates and annual transfers | MODIFY | Controlled edits allowed after start/end. Planned start year owns PTA; audited cross-year transfer preserves history. All Partners get editable +3-calendar-month suggestion without overwriting manual end dates. Calendar convention is L7. |
| B07 allocation and actual money | RETAIN | XOF exact integer amounts, `F CFA`; one-or-more positive-allocation Operations balance Activity allocation. Explicit final spending may be zero; missing remains unknown. No binary float financial arithmetic (brief §§2–3). |
| B08 expense approval/reversal ledger | SUPERSEDED | Final Operation spending replaces itemized expense approval/reversal/replacement (DEC-088); no competing spending totals or additional expense approval chain. Validated-record integrity still applies. |
| B09 execution eligibility | MODIFY | Separate planning/realization modules; execute only approved scheduled Activities; physical completion and final Operation declarations are distinct from administrative closure. |
| B10 insufficiency authorization | MODIFY | Before décaissement: approved PTA budget revision plus a distinct Agent → Supervisor → Validator authorization; independent of décaissement/virement (DEC-089). Freeze settlement basis; late exception is L1. |
| B11 décaissement and virement | MODIFY | Two distinct administrative requests, each Agent → Supervisor → Validator, using finalized actual amount, not whole allocation. Do not impose irreversible one-virement-ever restriction. No bank execution. |
| B12 external confirmations and reversement | MODIFY | Agent declares external amount/date; preserve discrepancy. Required return = max(0, approved allocation − final spending); automatically initiate administrative requirement, distinguish due/actually returned, require full settlement. Never reallocate unused funds to another Activity; custody outside scope. |
| B13 Activity closure | MODIFY | Agent closes directly after work, explicit final spending, required decisions, transfer confirmation, full required return and discrepancy resolution; no extra closure approval. Only closed Activities count as realized. |
| B14 annual KPI and Fiche | MODIFY | Whole annual PTA approved revisions; physical numerator closed Activities, financial numerator their final spending; approved allocation denominator. Zero denominator non-calculable, no 100% cap. Regenerable PDF includes context, chronology, settlement, evidence references/date; no new signature system. Historical denominator details L3. |
| B15 administrative relance | MODIFY | Due 21 calendar days before current end; all assigned Agents, in-app/PWA and email; recalculate date/assignment changes, deduplicate, handle already due, stop closed, truthful delivery evidence. Push details L6. |
| B16 contextual documents | MODIFY | Optional contextual evidence in PTA/revision/decision/request/confirmation/return; no automatic attachment blocker. Phase 4 denial remains until separate guarded implementation authorization. Partner-visible fields/documents L5. |
| B17 Partner portal and audit exports | MODIFY | Admin-invited exclusive read-only identity bound to exactly one Partner; own current/past Project, approved PTA/progress/Fiche and authorized records only. Guard guessed IDs/files/exports. Global audit exports remain Validator/Admin only. |
| B18 identity and sessions | RETAIN | Invitation-only, Admin sends invites, email/password then email OTP, backend authorization; exclusive internal roles, technical Admin no business mutation. Idle and absolute maximum 24h, then password+OTP; no remembered devices, public registration, LDAP/SSO dependency. |
| B19 audit, concurrency and outputs | RETAIN | Append-only audit atomic with mutation; exact-revision/stale/replay guards, immutable validated records, traceable authorized correction. French PDF/XLSX and supplemental audited Excel-readable CSV; bounded authorized snapshots and guarded delivery. |
| B20 native Admin/sample reset | NOT_APPLICABLE | Do not migrate native Admin or POC sample/business records into clean PostgreSQL. Plan guarded first-admin setup without hard-coded credentials; no persistent demo data. Preserve existing POC, no reset executed here. |
| B21 accounting and bespoke official reports | DECISION_REQUIRED | Phase 5 accounting rules/examples and Phase 6 Partner templates/mappings remain client-gated (DEC-022/023); current Fiche requirement is not deferred behind those gates. Contractual validated accounting immutability remains. |

Totals: RETAIN 4, MODIFY 14, SUPERSEDED 1, NOT_APPLICABLE 1,
DECISION_REQUIRED 1. L1–L8 are later product decisions, not foundation blockers:
L1 settlement exception/correction authority and immutable-boundary mapping;
L2 Project reopening/Partner deactivation and Operation exception lifecycle;
L3 withdrawal/transfer historical KPI attribution;
L4 zero-amount stages and partial-return/discrepancy correction;
L5 Partner-visible evidence/decision fields and document policy;
L6 push and reminder rescheduling/re-notification policy;
L7 month-end convention and any incomplete-draft exception;
L8 Phase 5/6 client accounting/report inputs. Owners and stop boundaries belong
in the gap analysis; none licenses an invented default financial workflow.

## Migration-era preservation ledger: 35/35

IDs refer to the unchanged [ledger](../architecture-audit/14-preservation-ledger.md).
RETAIN means the invariant, not the named PHP class, must survive.

| IDs | Count | Disposition | Rebuild treatment |
| --- | ---: | --- | --- |
| RT-001 | 1 | SUPERSEDED | No Dolibarr bootstrap in the new application. |
| RT-002, RT-004, RT-006, RT-007, RT-008 | 5 | RETAIN | Route/backend guards, locked reauthorization, segregation, exact money, stale rejection. |
| RT-003 | 1 | MODIFY | CSRF remains for cookie-authenticated mutations; native token API is replaced. |
| RT-005 | 1 | MODIFY | Preserve cohesive Activity rules, adapt PTA/settlement boundaries; do not force every future command into one PHP aggregate. |
| RT-009 | 1 | DECISION_REQUIRED | Preserve terminal integrity; Operation cancellation/reopening and settled corrections need L1/L2, not old cascade copying. |
| RT-010 | 1 | MODIFY | Explicit organizational/Partner scope; equal Agents; no mandatory Dolibarr entity field or multi-tenant SaaS. |
| RT-011 | 1 | SUPERSEDED | No predecessor POC schema modes; explicit Alembic migration state replaces readiness branches. |
| RT-012 | 1 | MODIFY | Consistent bounded export snapshot, private render, fresh authorization and audit; no forced old spool implementation. |
| RT-013 | 1 | RETAIN | Keep existing POC document endpoints denied; rebuild exposes none before its document slice. |
| RT-014 | 1 | NOT_APPLICABLE | Native ERP object/PDF/spreadsheet adapters are not required dependencies. |
| RT-015 | 1 | SUPERSEDED | Old module-gated hourly auto-completion does not govern explicit Agent closure; relance is separate later work. |
| SEC-AUTH-001, SEC-AUTH-002 | 2 | RETAIN | Admin-only invitation, high-entropy link proof with stored verifier digest. |
| SEC-AUTH-003 | 1 | MODIFY | Neutral throttled reset remains; native entity-0 Admin recovery exception is legacy-only. |
| SEC-AUTH-004 | 1 | MODIFY | Expiring, bounded, single-use login-bound OTP; production access cannot rely on disabled-OTP POC configuration. |
| SEC-AUTH-005 | 1 | MODIFY | No authenticated protected session before OTP; no native login bypass to port. |
| SEC-AUTH-006 | 1 | MODIFY | Never store reusable cleartext passwords; no native legacy column in PostgreSQL. |
| SEC-AUTHZ-001 | 1 | MODIFY | Exclusive effective identity and technical Admin restrictions; no native-admin derivation, add one-Partner identity. |
| SEC-AUTHZ-002, SEC-AUTHZ-004 | 2 | RETAIN | Admin-only transactional account changes/revocation; layered enforcement at trust boundaries. |
| SEC-AUTHZ-003 | 1 | SUPERSEDED | Assignment-based Agent access explicitly removed by DEC-087. |
| SEC-DOC-001, SEC-DOC-002 | 2 | RETAIN | Existing denial/raw-link containment and separately authorized guarded delivery stay. |
| DB-001 | 1 | MODIFY | Preserve authorized scope/parent isolation without native entity-0 exception or generic tenancy. |
| DB-002 | 1 | RETAIN | Audit atomicity, failed transaction cannot continue; discard unusable connection. |
| DB-003 | 1 | MODIFY | PostgreSQL constraints enforce applicable role/scope/immutable invariants; no literal MariaDB trigger definitions. |
| DB-004 | 1 | SUPERSEDED | Guarded reviewed Alembic execution replaces resumable Dolibarr activation. |
| LIFE-001 | 1 | MODIFY | Guarded first Admin and empty new database; no migration of native account or fixtures. |
| LIFE-002 | 1 | RETAIN | Minimal isolated disposable test database data and teardown. |
| LIFE-003, LIFE-004 | 2 | NOT_APPLICABLE | No native schema activation or unsupported ERP module disabling in rebuild. |

Totals: RETAIN 14, MODIFY 12, SUPERSEDED 5, NOT_APPLICABLE 3,
DECISION_REQUIRED 1 = 35. This table does not authorize changing the retained POC.

## Existing REST operations: 75/75

Exact operation IDs below come from the existing OpenAPI; every ID occurs once.
RETAIN_SEMANTICS preserves a useful action, not its URL, PHP implementation or
exact schema. REVISE_FOR_PTA requires new scope/payload/lifecycle semantics.
SUPERSEDED removes incompatible behavior from the future product. NOT_REQUIRED
does not demand recreating an implementation mechanism. DECISION_REQUIRED
defers only the unresolved branch. All operations remain future work beyond the
foundation health/query example.

| Existing operation IDs | Count | Disposition | Reason / required boundary |
| --- | ---: | --- | --- |
| `getSession`, `logout`, `login`, `verifyOtp`, `resendOtp`, `inspectInvitation`, `acceptInvitation`, `inspectPasswordReset`, `consumePasswordReset`, `requestPasswordReset` | 10 | RETAIN_SEMANTICS | Shared invitation/password/OTP/session flow; new backend includes exclusive Partner identity, no native adapter/cookie dependency. |
| `issueSubmissionToken` | 1 | NOT_REQUIRED | Old one-use helper endpoint is not itself a product requirement. Preserve replay/stale safety with a deliberate per-action contract; do not add a generic exactly-once framework. |
| `listUsers`, `listInvitations`, `inviteUser`, `changeUserRole` | 4 | REVISE_FOR_PTA | Exclusive internal vs one-Partner identities, Admin scope and revocation; no role switching escalation. |
| `deactivateUser`, `revokeInvitation` | 2 | RETAIN_SEMANTICS | Admin authorization, immediate affected credential invalidation and audit. |
| `listPartners`, `createPartner`, `getPartner`, `renamePartner` | 4 | RETAIN_SEMANTICS | Internal reference actions retained; portal projections separately scoped, never grant internal list access by default. |
| `setPartnerActive`, `setProjectActive` | 2 | DECISION_REQUIRED | Deactivation/reactivation/reopening must respect Project closure guard; old boolean cascade is not a settled target contract. |
| `listProjects`, `createProject`, `getProject` | 3 | REVISE_FOR_PTA | One active Project, annual PTA relationship, closure eligibility; portal separate scoped projection. |
| `renameProject`, `listOperationTypes`, `createOperationType`, `getOperationType`, `renameOperationType`, `setOperationTypeActive` | 6 | RETAIN_SEMANTICS | Existing permitted reference maintenance; final Operation-type vocabulary remains client input. |
| `listActivities`, `createActivity`, `getActivity`, `replaceActivityStructure`, `submitActivity` | 5 | REVISE_FOR_PTA | PTA-only creation, equal Agent access, approved/candidate separation and revision transitions. |
| `abandonActivity`, `restoreActivity` | 2 | REVISE_FOR_PTA | Draft-only lifecycle must be PTA/state guarded; never use it as bypass for approved withdrawal/history. |
| `changeAssignment`, `listAssignmentAgents` | 2 | REVISE_FOR_PTA | Supervisor plus Validator coordination; assignment does not grant Agent access. |
| `requestActivityCancellation` | 1 | SUPERSEDED | Replace old Agent→Validator cancellation with formal two-stage PTA withdrawal. |
| `getActivityReview`, `reviewActivity`, `getActivityTimeline` | 3 | REVISE_FOR_PTA | Exact candidate decisions, history and controlled amendments, affected execution pause. |
| `listOperations`, `getOperation`, `updateExecution`, `listSpendingOperations` | 4 | REVISE_FOR_PTA | Approved context, final exact spending and closure eligibility; no ledger-derived total. |
| `requestOperationCancellation`, `requestOperationReopening`, `listExceptionRequests`, `withdrawCancellation`, `decideCancellation`, `withdrawReopening`, `decideReopening` | 7 | DECISION_REQUIRED | L1/L2 govern exceptions and settled corrections; do not blindly re-create old approval topology. |
| `listExpenses`, `createExpense`, `replaceExpenseDraft`, `submitExpense`, `withdrawExpense`, `decideExpense` | 6 | SUPERSEDED | DEC-088 replaces itemized ledger/approval/reversal with final Operation spending. |
| `getDashboard`, `listAlerts` | 2 | REVISE_FOR_PTA | Whole-PTA closed-only KPIs and 21-day delivered relance, not seven-day read-time warning. |
| `listAuditEvents`, `exportAudit` | 2 | RETAIN_SEMANTICS | Validator/Admin only, authorized sanitized immutable history; Partner exports are distinct. |
| `previewActivities`, `exportActivities`, `previewOperations`, `exportOperations`, `previewActivityDetail`, `exportActivityDetail`, `previewPortfolio`, `exportPortfolio`, `getMonitoringOptions` | 9 | REVISE_FOR_PTA | Approved annual context, settlement/Fiche, exact totals, current scoped filters; official denominators independent of UI paging/search. |

Totals: RETAIN_SEMANTICS 24, REVISE_FOR_PTA 34, SUPERSEDED 7,
NOT_REQUIRED 1, DECISION_REQUIRED 9 = 75. Future PTA transfer/amendment,
insufficiency/décaissement/virement, confirmation/reversement/closure,
notifications and Partner reads are missing from this old inventory; no new
route names or replacement OpenAPI are approved here.

The new REST contract must use generated OpenAPI, authenticated authorization,
one initial versioned application boundary, finite stable errors, bounded
pagination with deterministic ordering and allowlisted filters. Money uses exact
decimal integer strings over JSON. Backend scope never comes from a caller's
claimed role/Partner. Mutations return success only after commit and audit;
stale/uncertain outcomes require reconciliation, never automatic financial POST
replay. Authentication endpoints may be reachable before login but still need
their intended proof/CSRF/abuse controls. Cookie sessions require CSRF protection.
Do not persist authenticated API responses or confidential exports in the PWA.
An application REST API does not authorize an external public integration API.

## Project skills and instructions

Repository discovery found one root `AGENTS.md`, no nested `AGENTS.md`, and
three repository-owned skills. `.agents/` and `.codex/` are empty here; no
`.github/instructions/` was present. No user/global/plugin skill was modified.
Root instructions now route new-stack work, focused checks and legacy boundaries.

| Path | Purpose | Disposition | Reason / action |
| --- | --- | --- | --- |
| `skills/confidence-review-loop/SKILL.md` | Proportional architecture/risk challenge | KEEP | Existing scope/precedence and lean loop remain valid; unchanged. |
| `skills/design-system-guardian/SKILL.md` | Visual authority review | UPDATE | Remove duplicate reference; use v3/inspiration precedence, React scope and documentation-only verification boundary. |
| `skills/security-baseline-review/SKILL.md` | Security boundary review | UPDATE | Link consolidated baseline; explicit backend/resource scope/private delivery; separate foundation and external deployment blockers. |

References checked: root AGENTS routes all three; repository search found no
removed skill references to resolve. Counts: inspected 3, kept 1, updated 2,
removed 0, consolidated 0, historical-only 0, decision-required 0, new 0.
`tasks/lessons.md` was evaluated; no repeated mistake or new durable debugging
finding justified an entry. Existing legacy-specific lessons remain scoped to POC.

For final reporting, **16 current routing/subject-owner files** means router,
decision register, PTA brief, five compatible v2 business owners, Phase 4 gate,
roadmap, security baseline 03, design-system README, approved v3 DESIGN, base and
semantic tokens, and component inventory. This count includes the draft security
requirements owner's explicit review status, not approval of its proposed
mechanisms. Baseline 01 is audit evidence and 02 a technical proposal, excluded
from that count. The 27-file disposition inventory includes history/evidence;
these populations must not be conflated. Frozen files remain byte-identical.
