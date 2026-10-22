# A2.2 — Restricted ordinary account lifecycle readiness

Current authorization: DEC-099 authorizes implementation of this contract at
`6659a05`; the roadmap owns execution evidence. The sections below preserve the
review contract, not a new implementation status.

Documentation-only recheck, 2026-10-22, against A1/A2.1 code at `30b976a`.
DEC-098 approves the scope below, **not runtime implementation**. It supersedes
this document's earlier unapproved-scope verdict at `144e164`.

## 1. Approved scope

R6: Admin changes an active ordinary account's exclusive business role.
R7: Admin deactivates an active ordinary account. Both require authoritative
absence of Activity assignments **and outstanding workflow responsibilities**.
Only synthetic development identities in the existing isolated environment qualify.

Defer assigned/responsible accounts, handoff, inactive-account reinvitation (R8),
Admin self-management/additional Admin lifecycle, A3/A4 and PTA. No activation,
pending-role edit, identity edit/delete or recovery endpoint. PC1/PC2 remain
pending; real-account enablement remains prohibited.

Authority: user's restricted approval (DEC-098),
[readiness 05](05-a2-account-management-readiness.md),
[functional specification §§4–5](../mjl-functional-specification-v2.md),
[PTA brief §2](../mjl_codex_authoritative_pta_change_brief.md), and
[security baseline](03-security-compliance-baseline.md).
The [roadmap](../mjl-implementation-roadmap-v2.md) owns completed A1/A2.1 evidence.

## 2. Approved rules and remaining decisions

Admin alone can perform backend-authorized R6/R7; no self/Admin target or Admin
promotion. Exactly one of `AGENT_SAISIE`, `AGENT_VERIFICATEUR`,
`VALIDATEUR_DEFINITIF` remains stored. Inactivity removes all effective authority.
Stable identity, role history in audit and historical contributor restrictions
survive lifecycle changes. A role change must never erase prior participation to
permit self-validation later.

The restricted scope decision is resolved. LA3 handoff for assigned/responsible
accounts and R8's retained-versus-selected role decision remain deferred; neither
blocks this restricted slice. Supervisor/Validator manage PTA assignments, not
Admin. Assignments are coordination/notification metadata, not Agent visibility
restrictions. There is no approval to silently transfer/delete them.

## 3. Account/session transaction contract

Validate the current actor, target, eligibility (§4), active state and positive
expected User version before writing. R6 updates one role; R7 sets inactive and
revokes any prepared/delivered invitation, incrementing its version. Preserve
consumed/revoked invitation history. Increment User.version once per effective
transition and append actual old/new role/state/version facts atomically. Stale
version or ineligible state returns 409 without success audit. With matching
version and eligibility, unchanged role returns the unchanged projection without
revocation/success event. Pending accounts use existing invitation revocation;
never make a passwordless pending account inactive. Repeated deactivation conflicts.

Reuse `AuthService.user_proof/context`: proof includes id/version/state/role/password
hash. All previous verified and pending OTP contexts fail the next backend check
after commit. Role change requires fresh password + OTP; inactive accounts cannot
log in. Returning to an earlier role cannot restore an old cookie. Do not sweep
Context/OTP rows or reset credential/abuse counters. PC2 session cardinality remains
pending independently of mandatory invalidation of **all obsolete contexts**.

**Mandatory correction before enabling PATCH:** in `AuthService.login`, acquire
existing `pg_advisory_xact_lock(1843201)` as the first database statement inside
its transaction, before network/account Abuse locks. Current login can lock a
pending context's ordinary User then submitted-email Admin User, opposite to an
Admin lifecycle mutation. The shared lock serializes these multi-User operations.

| Path | Required order / transaction boundary |
| --- | --- |
| Login | Advisory → network Abuse → account Abuse → Context → previously bound User if any → submitted-email User → OTP; commit before email |
| R6/R7 PATCH | Advisory → actor Context → Admin User → ordinary target User → Invitation if present; eligibility/version/state checks, mutation and audit in the same transaction |
| OTP verify/resend | Existing Context → same User → OTP; no advisory or second User acquisition; commit before delivery. No new order needed |
| Session/logout | Existing Context → same User; no advisory or second User acquisition |
| Invitation prepare/accept/delivery completion | Existing advisory → User → Invitation; mail outside transactions |
| OTP delivery completion | Existing OTP only; late delivery may update an obsolete challenge but cannot restore its invalid User proof |

`main.endpoint_limit` completes its separate Abuse transaction before entering
these paths. Invitation inspect/accept route guards also commit before the
advisory-locked invitation service transaction. Error-handler denial audit runs
after the failed service transaction exits. Neither may hold locks into another transaction. Do not acquire advisory
after row locks or add target User → Context updates. No new lock framework.

The User row serializes authentication with lifecycle changes: if authentication
commits first, its resulting context becomes unusable when lifecycle commits;
if lifecycle commits first, authentication must reject the stale/inactive context
or establish a fresh challenge using the new role/version. Already completed work
is not undone. Any authorization after revocation commit must reject old privileges.

## 4. Authoritative eligibility without PTA tables

The current new-stack application has only six auth models, migrations through
`0003_a21`, auth/access/health routes, no imports and no business store. Therefore
absence can be established **only within this verified authentication-only world**;
email suffix, role, a client checkbox, missing table lookup or an empty query alone
is not evidence of eligibility.

Before enabling mutations, Engineering must verify the executable application's
writers and the disposable database provenance: created empty through existing
migrations, synthetic fixtures only, no legacy/external business associations,
imports or alternate business store. Unknown provenance keeps mutations disabled.
Do not run schema migrations or change deployed application capabilities while
lifecycle traffic is enabled; stop mutation traffic for those maintenance changes.

Inside every PATCH transaction, before mutation, require the existing isolated
synthetic policy AND a fixed database check:

- Exactly one Alembic version row, equal to `0003_a21`.
- Exactly these seven schema-qualified data relations in non-system schemas:
  `public.alembic_version`, `public.auth_user`, `public.auth_invitation`,
  `public.auth_audit`, `public.auth_context`, `public.auth_otp`, `public.auth_abuse`.
  They must be ordinary tables; reject extra tables, partitioned tables, views,
  materialized views or foreign tables in any non-system schema. Ignore system
  catalogs and indexes/sequences; do not build a general schema-drift scanner.
- The target is a current active ordinary synthetic User. Unknown/missing schema,
  multiple/unknown revision, unreadable evidence or policy mismatch denies the
  mutation. A readable mismatch returns 409 `eligibility_unverified`; database
  failure uses existing 503 handling. Neither changes target state/version or
  emits a success event. Existing unavailable-policy rejection remains unchanged.

This small fixed check is an environment-wide absence proof, not a per-account
assignment model. It supports all three ordinary roles equally. Do not add tables,
flags, configurable revision bypasses or a fabricated assignment service.

**Future PTA cannot inherit this permission:** any schema revision or business
relation makes the guard deny. Do not merely advance its allowed revision. Before
adding any assignment/workflow writer (including use of existing tables or another
store), disable this bounded guard and integrate authoritative checks for both
current assignments and outstanding responsibilities. Their check and mutation
must serialize with assignment/workflow creation. Missing/unavailable evidence
must deny. Assigned/responsible accounts remain deferred unless separately
approved; historical-contributor/no-self-validation checks must survive by stable
identity. Future integration tests must prove these conditions before re-enabling
lifecycle. A schema fingerprint alone cannot certify arbitrary future code or data.

## 5. Minimal API, persistence and UI

One `PATCH /api/v1/access/users/{id}` suffices: positive `expected_version` and
exactly one business `role` or `deactivate=true`; return existing safe User DTO.
Reject self/Admin target/promotion 403 (invalid role payload may fail DTO validation
422), missing target 404, stale/ineligible state or unverified eligibility 409,
invalid/extra/mixed input 422. Reuse Admin, CSRF, Origin/Host and error handling.
No separate action endpoints or invitation POST extension; inactive reinvite still
returns A2.1's conflict.

**Zero new tables, columns or migrations.** Reuse User version/state/role,
Invitation version/state, append-only Audit.details and A1 proof validation.
Extend the bounded audit facts allowlist only for necessary previous-role facts;
record real before/after snapshots. Audit/commit failure rolls back the entire
lifecycle transaction. These mutations send no email. Preserve sanitized denials
and secret-free lifecycle DTOs/audit/logs.

Extend existing `AccessView` rows with French role/deactivation confirmations;
reuse users design tokens/dialogs, Router filters and focus/responsive behavior.
Add explicit PATCH support to existing `apiRequest`. Query invalidates account and
invitation lists after success or uncertain outcome; refetch before retrying a
conflict. Retain 401 cache clearing, 403 privilege removal, session refresh and
late-response cancellation. No optimistic privileges, automatic mutation retry,
sensitive persistence or offline queue. Inactive reinvite controls stay absent.

## 6. Mandatory pre-mutation implementation gates

After a **separate implementation authorization**, complete these in order before
enabling lifecycle mutations in any development runtime:

1. Verify isolated auth-only provenance/writer scope and implement §4's fail-closed
   check. L05/L06 must pass, including unknown evidence and future-schema denial.
2. Correct login ordering in §3; L08 must pass against actual PostgreSQL connections
   before lifecycle route exposure, then verify through actual PATCH before enabling it. A disabled/test-only mutation path may exercise
   the transaction for these tests; no production feature-flag service is needed.
3. Verify atomic mutation/audit, version conflict and obsolete-context rejection
   with L01–L12. Do not enable a partial path lacking any guard.
4. Complete UI/contract/regression L13–L16 before claiming the slice complete.
   All sixteen are required; passing them authorizes no real accounts or next slice.

## 7. Focused acceptance checks

These are future oracles, not runtime checks executed during this review. Existing
16 IDs are retained; former R8 checks now cover eligibility and excluded behavior.

| ID | Concrete oracle |
| --- | --- |
| L01 | Direct PATCH rejects anonymous, pending-OTP, expired/inactive and all ordinary-role actors; verified Admin succeeds. Invalid CSRF/Origin/Host fails without mutation |
| L02 | Each distinct ordinary role transition on eligible active User leaves exactly one role and increments version once; self/Admin/promotion/extra/mixed input rejected; pending/inactive target conflicts; matching-version unchanged role is a no-op |
| L03 | Deactivation preserves id/email/role/history, sets inactive, increments User version and revokes outstanding prepared/delivered invitation with version increment. Consumed/revoked history unchanged; repeated/stale call conflicts without second success event |
| L04 | Multiple old verified cookies and pending OTP contexts fail after R6/R7 commit, including verify/resend and late OTP delivery. Inactive login fails; role change requires fresh password/OTP; returning to old role never revives old cookie |
| L05 | Migrated isolated auth-only database passes eligibility for each ordinary role. Changed/multiple/missing Alembic revision, extra relation (including another schema/view/foreign relation), missing expected table or evidence-read failure rejects before mutation; state/version and success-audit count unchanged |
| L06 | Unknown provenance or external/imported business source cannot enable lifecycle. Existing policy negatives still fail closed. Unverified/assignment-capable schema is denied even for apparently unassigned users; no client flag or synthetic email bypass. Test this boundary with a disposable minimal extra relation, not a PTA model |
| L07 | Two Admin writes sharing expected version produce one committed transition/success event and one 409; test role/role and role/deactivate in both orders, with no mixed state |
| L08 | With deterministic two-connection barriers (not sleeps) and bounded timeouts, test login/lifecycle in both orders, including pending ordinary Context submitting Admin credentials. Assert login waits at advisory before acquiring Abuse/Context/User locks; no deadlock/timeouts/500. Also race OTP verify/resend and session checks with R6/R7: auth-first contexts fail after mutation; mutation-first stale contexts fail before granting authority. Late OTP delivery cannot restore authority |
| L09 | No R8 or activation/Admin-management endpoint/control appears; existing invite of inactive email remains 409. Old consumed/revoked/superseded invitation proofs fail; late invitation delivery success/failure cannot restore eligibility; A2.1 accept/resend/revoke behavior remains |
| L10 | Inject lifecycle mutation/audit/commit failures: rollback User/Invitation/version changes, no success record or lifecycle email. Required security facts and state commit together |
| L11 | Audit records stable actor/target and actual old/new role/state/version plus invitation facts when changed; historical events unchanged and update/delete constraints hold. Lifecycle DTOs/logs/audit expose no password/OTP/verifier/session secrets; sensitive Query state is not persisted (existing in-memory CSRF token is allowed) |
| L12 | PostgreSQL identity uniqueness, one invitation per User, valid role/state/password constraints and monotonic version hold; no identity recreation or history deletion. All eligibility rejections leave these records unchanged |
| L13 | Browser Admin changes eligible role/deactivates; French dialogs trap/return focus, work at 375px, refresh both lists and explain conflict/unverified/failed/uncertain responses without automatic retry |
| L14 | Offline/expired/forbidden/cross-tab logout/account-switch paths prevent mutation/replay and clear protected state. Delayed responses cannot repopulate another identity's Query cache; focus refresh obtains authoritative state |
| L15 | OpenAPI documents the single PATCH exclusive payload, cookie/CSRF/Origin security, safe response and error statuses, including eligibility rejection. Existing invitation POST contract unchanged |
| L16 | Focused A1/A2.1 regressions retain bootstrap binding, password/OTP/session limits, invitation replay/version/late-mail protection and synthetic-only policy. Extend existing pytest/access unit/Playwright tests; disposable PostgreSQL/test mail torn down |

L05/L06 prove that environments capable of storing assignments/responsibilities are
denied, not that a nonexistent PTA model has been queried. Before PTA integration,
add real assignment/responsibility-bearing and historical-contributor negative
cases against its authoritative model; do not simulate those domain rules now.

## 8. Owners and decision timing

| Item | Timing | Status / owner |
| --- | --- | --- |
| Restricted scope | BEFORE_AUTHORIZATION | RESOLVED by user's DEC-098; implementation authorization still separate |
| Eligibility/order/mutation gates | BEFORE_AFFECTED_IMPLEMENTATION | Engineering must satisfy §6 before mutation exposure; these are mandatory engineering conditions, not pending business choices |
| Assigned/responsible accounts and handoff | DEFERRED_TO_PTA | Domain owner/RSSI; Engineering replaces guard before business integration and tests creation races/historical contributor restrictions |
| R8 and LA2 Admin lifecycle | BEFORE_AFFECTED_IMPLEMENTATION | Domain owner/Sponsor/RSSI decide before those separately authorized operations; excluded here |
| PC1/PC2, E1/E3 | BEFORE_REAL_ACCOUNT_ENABLEMENT | Sponsor/RSSI/legal/DSI/email operator; pending policy, privacy and identity assurance. Real accounts prohibited |
| E2/E4 environments; E5/E6 deliverables | BEFORE_AFFECTED_IMPLEMENTATION | Existing baseline owners retain sensitive-environment and contractual gates |
| PG1/PG2 release evidence | PRODUCTION_ONLY | Existing DSI/RSSI/host/client delivery owners; no deployment work authorized |

## 9. Verdict and review

**A2_2_READY_FOR_AUTHORIZATION**, for restricted R6/R7 only. Readiness depends on
implementing and verifying the exact pre-mutation conditions in §6; none is claimed
implemented by this documentation task. Unknown eligibility always denies.
PC1/PC2 remain pending. Stop before implementation.

Independent **Engineering: PASS** and **Security/Specification: PASS** on the final
document, including the bounded guard, lock correction and acceptance oracles.
Documentation diff checks passed; runtime suites and completed A1/A2.1 audits were
not rerun. No runtime behavior or production readiness is certified by this review.
