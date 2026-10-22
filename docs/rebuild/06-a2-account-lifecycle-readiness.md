# A2.2 — Ordinary account lifecycle readiness

Documentation-only review, 2026-10-22, against A2.1 completion `30b976a`.
No implementation or real-account enablement is authorized by this review.

## 1. Confirmed scope

[Readiness 05](05-a2-account-management-readiness.md) defines three deferred
responsibilities: R6 change an ordinary active user's exclusive business role;
R7 deactivate an ordinary active account; R8 reinvite an inactive ordinary
account through password setup and fresh password + email OTP authentication.
Admin alone performs these actions. No standalone activation toggle, additional
Admin provisioning, Admin self-management, identity editing/deletion, pending-role
editor, password recovery, A3/A4 or PTA implementation belongs here.

Authority: [functional specification §§4–5](../mjl-functional-specification-v2.md),
[approved PTA brief §2](../mjl_codex_authoritative_pta_change_brief.md), DEC-087–090,
[REST behavior inventory](../mjl-rest-api-contract.md), and readiness 05's LA3 gate.
The [roadmap](../mjl-implementation-roadmap-v2.md) owns completed A1/A2.1 evidence;
those audits and runtime checks were not repeated.

## 2. Approved rules and missing decisions

| Concern | Approved / retained | Still unresolved |
| --- | --- | --- |
| Actor and role | Backend-verified Admin only; exactly one of `AGENT_SAISIE`, `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`; no Admin target or promotion | No new permission model needed |
| Role change | Agent's current assignments must first be removed/transferred; historical attribution and contributor restrictions survive role changes | LA3 must reconcile the handoff with PTA coordination assignments; Admin is not their manager |
| Deactivation | Ordinary active account becomes inactive; subsequent authorization fails; outstanding invitation is revoked; historical identity/audit remains | Whether assigned accounts must await handoff, or may be disabled before coordination is resolved |
| Reinvitation | Authorized lifecycle concept, existing identity, invitation acceptance/password setup then fresh login/OTP; no direct activation | Whether previous role is retained or Admin may choose another; eligibility and treatment of retained coordination assignments |
| Accountability | Stable user identity; no deletion/recreation, rewritten audit or erasure of historical contributors | Future PTA enforcement must use historical contributors, not just current role |

Legacy `MjlAccessCommand::applyProfile/applyDeactivation` rejects current
assignments. That is implementation evidence; it does not resolve the new PTA
handoff policy. Readiness 05 explicitly says that absent business tables do not
settle LA3. This review neither waives that gate nor adopts a new handoff rule.

## 3. Role, deactivation and session behavior

For any subsequently authorized operation, lock and validate current actor, target,
state and expected user version. R6 changes one role; R7 changes active → inactive.
Increment `User.version` once per effective transition and append old/new role,
state and version facts in the same transaction. Reject stale requests without
partial mutation. Pending accounts use the existing invitation revoke action;
do not deactivate a passwordless pending account. Repeated/stale lifecycle writes
should return 409 without a second success event; a requested unchanged role
should return the unchanged projection without revocation or success event.
These HTTP/no-op choices are proposed technical contract, not additional business powers.

`AuthService.user_proof/context` already binds identity, version, state, role and
password hash. Reuse it: every old verified context and pending OTP context fails
on its next backend check after the transition commits. Fresh password + OTP is
required after role change. Inactive/pending users cannot log in. No target Context
or OTP row sweep is needed; never reset abuse counters or reuse old proofs.
A later return to the same role/active state must not resurrect an earlier context.
PC2's number of permitted concurrent sessions is **pending**; invalidation of
**all obsolete contexts** is mandatory regardless of that future number.

If R8 is authorized, inactive → pending increments security version, preserves
User id/email and all history, and rotates the existing invitation generation,
verifier and version. Preserve the old password hash until acceptance replaces it;
pending state denies its use. The role transition must follow the missing decision
in §2. Acceptance activates once and creates no verified session. Superseded
email success/failure must not update a newer generation or reactivate a user.

Reuse the invitation advisory lock before actor authorization, then actor Context
→ actor User → ordinary target User → Invitation. Never add User → target Context
locking to A1's Context → User flow. **One concrete lock gap needs correction:**
`login()` can lock a previous pending-context User before the submitted-email User.
A pending ordinary identity logging in as Admin can invert lifecycle's Admin →
ordinary order. Use the existing advisory lock before login's database locks as
the smallest candidate fix; verify the complete login/OTP/accept/delivery sequence
with real concurrent connections. Do not introduce a new locking framework.
Requests serialized before revocation may complete; requests authorized after its
commit must fail with obsolete privileges. UI cache clearing is not this boundary.

## 4. Activity-assignment dependency

PTA assignments coordinate work and notifications; they no longer restrict Agent
visibility. Supervisor and Validator manage them. An Admin role-change dialog must
not silently transfer/delete assignments or grant Admin business mutation rights.
Inactive/re-roled recipients and reinvited recipients also affect future reminders;
removing assignment-based access does not answer those questions.

Defer assigned-account handoff and its coordination/notification behavior to the
PTA decision and implementation. Before PTA creates assignments or contributor
history, integrate the approved eligibility guards and test role-change-to-Validator
against prior contribution. Stable identity/audit now preserves that possibility;
it does not implement or prove future no-self-validation. No placeholder assignment
table, fabricated eligibility flag or always-allow business guard is justified.

## 5. Minimal API, persistence and UI changes proposed

| Surface | Smallest change, after authorization |
| --- | --- |
| R6/R7 | One `PATCH /api/v1/access/users/{id}`: positive `expected_version` and exactly one business `role` or `deactivate=true`; existing safe User projection. Reject Admin/self targets 403, missing target 404, stale/ineligible state 409, invalid/extra input 422. Reuse Admin/CSRF/Origin/Host guards and error envelopes |
| R8, only if settled | Extend existing `POST /api/v1/access/invitations`; inactive branch requires the selected User's expected version. New-email behavior stays unchanged; active/pending duplicates still conflict. No separate reactivation endpoint. A role policy decision must precede finalizing its DTO/UI |
| PostgreSQL | **Zero new tables, columns or migrations identified.** Reuse User.version/state/role, one Invitation per User, invitation version/generation and append-only Audit.details. Extend the bounded facts allowlist only for necessary before-role facts. Preserve historical generation events even though the single invitation row represents current state |
| Shared authentication | Reuse `admin`, `prepare_invitation`, `deliver_invitation`, `invitation_bound`, `user_proof`, `context`, and `audit`. Preparation facts must describe actual pre/post User state/version, not infer them from an already-mutated User. Keep reinvitation preparation in the binding lookup's recognized actions. Send only after commit |
| React | Extend existing `AccessView` account rows with French role/deactivation confirmations; add inactive reinvite only if settled. Reuse approved users tokens/dialogs, focus return, responsive layout and Router filters. Add explicit PATCH support to existing `apiRequest`; no new client, route or dependency |
| Query/PWA | Invalidate account and invitation queries on success or uncertain outcome; show conflict and refetch before another attempt. Preserve cancellation/late-response guards, 401 cache clearing, 403 privilege removal and authoritative session refresh. Reject offline mutations; no optimistic privilege changes, automatic mutation retries, persisted sensitive cache or offline queue |

Lifecycle/preparation mutation and required success facts commit together; an audit
failure in that transaction rolls back its state/version changes and sends no mail. Reuse sanitized denial logging and
bounded DTOs: no password, OTP, verifier, session identifiers or raw delivery errors.
This applies security baseline controls MJL-SEC-01–07, 09–11, 13–14 through existing
mechanisms; this document is not a compliance attestation.

## 6. Smallest recommended implementation slice

Prefer one slice for R6–R8 **only after** LA3's affected boundaries and the
reinvitation role rule are settled. Do not split shared authentication infrastructure.

If full handoff remains unresolved, recommend **R6/R7 for synthetic ordinary
accounts with no current assignments or historical business contributions**, leaving
R8 and assigned-account lifecycle deferred. This is independently useful for
exclusive-role changes and immediate access withdrawal, and introduces no PTA
schema. It needs the domain owner's explicit agreement that this restricted scope
may proceed before LA3 is complete. The future PTA integration gate in §4 must
remain explicit. Empty tables alone are not that agreement. No arbitrary exemption
for particular business roles is proposed.

## 7. Focused acceptance checks for future authorization

These are behavioral oracles, not tests run by this documentation task. Checks
marked R8 apply only if R8 is included; PTA assertions remain deferred.

| ID | Concrete oracle |
| --- | --- |
| L01 | Direct lifecycle calls by anonymous, pending-OTP, expired/inactive or any ordinary-role principal fail; a verified Admin succeeds. Invalid CSRF/Origin/Host fails without mutation |
| L02 | Each permitted active business-role transition leaves exactly one role and increments version once; Admin/self/promotion/extra-field/mixed-action requests fail; pending/inactive targets conflict; unchanged role is a no-op |
| L03 | Deactivation preserves id/email/role/history, makes state inactive, increments version and revokes outstanding prepared/delivered invitation. Repeated stale call conflicts without a second success audit; pending target is not made inactive |
| L04 | Multiple pre-existing verified cookies and pending OTP proofs fail after either R6/R7 commits, including OTP resend/consumption and late delivery of an obsolete OTP. Old password login fails while inactive; role change requires fresh password/OTP with the new role; returning to the old role never revives an old cookie |
| L05 | R8: same User id/email, no second identity; approved role rule applied; inactive → pending → active only through current delivered invitation/password setup. Old password cannot log in while pending; acceptance creates no verified session |
| L06 | R8: old consumed/revoked/superseded invitation proofs and old OTP/cookies fail before and after activation; replay cannot activate twice. Pending revoked invitations remain terminal under A2.1; inactive reinvite must not become a pending-account workaround |
| L07 | Two Admin writes using the same expected User version yield one transition/success event and one 409; role-change/deactivation orders are serialized, with no mixed state |
| L08 | Real-connection login/OTP versus lifecycle races enforce the commit boundary in §3; pending ordinary-context login with Admin email versus Admin mutation of that ordinary User completes without deadlock or stale authorization |
| L09 | R8: concurrent reinvite/accept/resend/revoke and late old-generation email success AND failure cannot restore old eligibility or overwrite current delivery status; only the current generation can activate |
| L10 | Inject lifecycle/preparation transaction mutation/audit/commit failures: no partial User/Invitation/version changes or success record, and no precommit mail. R8 mail or delivery-completion audit failure preserves the prior durable pending state and a truthful failed/unconfirmed outcome; already-sent mail cannot be rolled back. Only deliberate eligible retry is allowed |
| L11 | Audit records actor, stable target, old/new role/state/version and invitation generation where applicable; previous events remain unchanged. Audit update/delete constraints hold; lifecycle DTOs/audit/logs expose no passwords, OTPs, verifiers or session secrets; sensitive Query state is not persisted (the existing in-memory session CSRF token remains valid) |
| L12 | PostgreSQL retains one normalized identity and one invitation row per User, valid role/state/password constraints and monotonically advanced versions; lifecycle never deletes/recreates User history |
| L13 | Browser Admin journey changes role and deactivates, plus R8 if included; French dialogs return/trap focus, work at 375px, refresh account/invitation lists, and explain stale/failed/uncertain responses without automatic retry |
| L14 | Browser offline/expired/forbidden/cross-tab logout/account-switch paths disable mutations and clear protected state; delayed list/mutation responses cannot repopulate another identity's cache; focus refresh obtains authoritative state |
| L15 | Generated OpenAPI describes PATCH's exclusive payload, cookie/CSRF/Origin security, safe response and error statuses; R8 expected-version contract only if included. No activation, Admin-management or unrelated endpoint appears |
| L16 | Focused A1/A2.1 regression journeys retain bootstrap binding, password/OTP/session limits, invitation replay/version/late-mail protection and synthetic-only fail-closed policy. Existing focused pytest, access unit and Playwright files are extended; disposable PostgreSQL/test mail is torn down |

For a restricted R6/R7 authorization, L02–L04/L11–L12 prove identity/access behavior
only. PTA assignment and historical-contributor authorization tests are required
before business integration, not simulated using new tables during A2.2.

## 8. Decisions, owners and timing

| Item | Timing | Owner / required outcome |
| --- | --- | --- |
| LA3 scope boundary | BEFORE_AUTHORIZATION | Domain owner with RSSI: settle full affected lifecycle behavior, or explicitly approve §6's restricted R6/R7 scope and defer assigned-account behavior. Existing LA3 is now reached, not silently waived |
| R8 role/eligibility | BEFORE_AUTHORIZATION | Domain owner: if R8 is included, decide retain previous role versus Admin-selected business role and assignment eligibility. Otherwise defer R8 without blocking an approved R6/R7 subset |
| Locking and audit correctness | BEFORE_AFFECTED_IMPLEMENTATION | Engineering: resolve cross-identity login lock inversion and preserve actual before/after audit facts; L07–L11 are completion gates, not new business decisions |
| PTA handoff and contributor enforcement | DEFERRED_TO_PTA | Domain owner decides coordination/notification handoff; Engineering implements guards before assignments/contributions are introduced, preserving no-self-validation |
| LA2 Admin lifecycle | BEFORE_AFFECTED_IMPLEMENTATION | Sponsor/RSSI; outside A2.2, including self/last Admin and recovery, before real operator dependence |
| PC1 / PC2 | BEFORE_REAL_ACCOUNT_ENABLEMENT | Sponsor/RSSI; both pending. Password/normalization/invitation/OTP/abuse/pre-auth policy and concurrent-session/foreground-activity policy remain unapproved; existing synthetic fixtures are not acceptance |
| E1/E3 real-data and identity assurance | BEFORE_REAL_ACCOUNT_ENABLEMENT | Ministry legal/RSSI/DSI/email operator: privacy/source applicability and real mail/key/OTP assurance; synthetic fixtures do not settle these |
| E2/E4 affected environments; E5/E6 deliverables | BEFORE_AFFECTED_IMPLEMENTATION | DSI/RSSI/host approve safeguards before sensitive hosted environments; sponsor/data owner and delivery lead retain migration/deliverable acceptance gates at their original timing in baseline 03 |
| PG1/PG2 release verification | PRODUCTION_ONLY | DSI/RSSI/host/client delivery owners: actual deployment and release evidence from readiness 04. No production assurance work or provider decision in A2.2 |

## 9. Readiness verdict and independent review

**A2_2_NOT_READY**. The technical change is bounded, but no approved scope yet
removes the pre-authorization business decisions above. Recommend the restricted
R6/R7 option if full LA3/R8 decisions are deferred. A readiness review cannot approve
that option for the domain owner. Implementation remains unauthorized.

Independent **Engineering: PASS** and **Security/Specification: PASS** for this
document after correcting delivery-failure audit semantics, the in-memory CSRF
exception and external gate timing. Both agree on the unresolved LA3 boundary.
Engineering identified the cross-identity login lock inversion required in §3/L08.
Document-review PASS does not change the readiness verdict. Only documentation
verification applies; runtime suites, production checks and repeated A1/A2.1
audits were skipped. No new durable lesson warranted a lessons-file update.
