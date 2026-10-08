# MJL W4 Readiness Review

Status: `W4_READY_FOR_AUTHORIZATION`

This is a documentation-only pre-authorization review. It does not authorize
W4, runtime changes, test changes, schema changes, or any later wave.

## 1. Executive verdict

W4 is a bounded ownership refactor. It places invitation, reset, OTP, and
password effects behind one cohesive authentication command; places all
PHP/Dolibarr session mutation behind one private procedural session adapter;
preserves the existing routes, hooks, templates, policies, persistence, and
delivery ordering; and removes the email-to-auth test-capture dependency.

The scope is derivable from frozen authority and the post-W3 tree. Both W3
inputs are reconciled, all 35 preservation requirements are classified, every
transition has one owner, and recovery is credible. There are no authorization
blockers or current-state discrepancies.

Ten rows are `READY_WITH_CONSTRAINTS`. Their characterization and exact-schema
conditions are hard stops before movement or cutover, not conditions that must
exist before W4 may be authorized. This timing follows the frozen W4 text,
which requires the missing proofs in the disposable gate **before extraction**.
Authorization may permit creating those proofs; it may not permit moving code
until they pass.

```text
W4_READY_FOR_AUTHORIZATION
W4: NOT_AUTHORIZED
W5-W7: NOT_AUTHORIZED
```

## 2. Authority baseline

| Authority | Verified value |
| --- | --- |
| Frozen architecture | `b32655df213a5d5f8cc2e4b4cd1bf6f7aa4c6b6ec5d3ac4273ae9759ff6d9b9c` |
| Frozen Engineering Standard | `a47f2d942172a4685b02efce027ca04c0a2361f258ebd8c0b776117c97f8f62e` |
| Independent review | `3b0a4fe46a9ea5bc666c32d997ddb98ef430f47594bb152a738f1aa9d8f8919f` |
| W0 baseline | `bccf5a708aec25f98499bed6b7da3f607c0541d5` |
| W1 baseline | `03aad09` |
| W2 baseline | `143f89e2285e860cdaa45fd6d6580c74b39556aa` |
| W3 baseline | `ee4afa8d7b7ff6af98f0b5c7b70a071ce96c3dd6` |
| Preservation ledger | 35/35 |

The frozen architecture and Engineering Standard require no amendment.

## 3. Post-W3 baseline

W0, W1, W2, and W3 are complete. W3 remains authoritative for:

| W3 responsibility | W4 classification | Evidence / rule |
| --- | --- | --- |
| deep reference command and transaction owner | `MUST_REMAIN_UNCHANGED` | outside auth ownership |
| deep standalone access command and transaction owner | `MUST_REMAIN_UNCHANGED` | `MjlAccessCommand` |
| invitation access participant | `W4_DEPENDS_ON` | `assignProfileInTransaction()` remains non-owning |
| access/auth transaction composition | `W4_DEPENDS_ON` | auth owns the outer invitation transaction |
| effective-role/access vocabulary | `W4_DEPENDS_ON` | four stable role codes; semantics unchanged |
| W3 ownership source test | `PLANNED_W4_CHANGE` | update only the auth-owner location asserted |

No W3 business rule or write contract is reopened.

## 4. W3 to W4 dependency reconciliation

### Dependency A: access/auth transaction composition — `RECONCILED`

`mjl_auth_issue_invitation()` currently owns the outer transaction and calls
`MjlAccessCommand::assignProfileInTransaction()`. The participant does not
begin, commit, or roll back. W4 moves the auth owner but preserves the same
connection, ordering, failure propagation, and single transaction owner.

### Dependency B: effective-role/access vocabulary — `RECONCILED`

The codes remain `AGENT_SAISIE`, `AGENT_VERIFICATEUR`,
`VALIDATEUR_DEFINITIF`, and `ADMIN_PLATEFORME`. Active native Admin still maps
to `ADMIN_PLATEFORME`; a non-admin has exactly one active same-entity business
role. W4 may relocate the canonical policy seam but may not redefine it.

## 5. Exact W4 contract

1. One deep `MjlAuthCommand` owns invitation, reset, OTP, password effects,
   identity locks, credential state, orchestration, and auth transaction scope.
2. One private `lib/auth/mjl_auth_session.lib.php` adapter owns all session
   writes, clearing, identity regeneration, completion, and invalidation.
3. Session validity becomes a pure decision; it never mutates session state.
4. `auth.php`, `invitation.php`, native hooks, templates, action names, URLs,
   JS hooks, and visible behavior remain stable adapters.
5. Invitation/reset preparation commits before sending; delivery result is
   persisted separately while the identity lock remains held.
6. OTP issuance/resend commits before delivery; successful verification commits
   before authenticated-session completion and regeneration.
7. The W3 access participant remains non-owning inside invitation preparation.
8. The effective-role vocabulary and entity/Admin rules remain unchanged.
9. Email retains transport, rendering, safe URL construction, email audit, and
   disposable capture. The two guarded capture helpers move to email ownership
   with their procedural names unchanged.
10. Exact read-only auth-schema recognition fails closed; normal runtime does
    not perform DDL.
11. Existing audit, token, lifetime, throttle, single-use, and encrypted-only
    password invariants remain unchanged.
12. Old and new owners never coexist as reachable authorities after cutover.

The smallest adequate design is one cohesive command, not separate shallow
classes, a generic repository, a port hierarchy, a queue, or a new framework.

## 6. W4 exclusion ledger

| # | Exclusion | Disposition |
| --- | --- | --- |
| E01 | authentication product redesign | excluded |
| E02 | token, OTP, lifetime, counter, cooldown, or status changes | excluded |
| E03 | plaintext password fallback | forbidden |
| E04 | broader Admin/cross-entity exceptions | forbidden |
| E05 | public registration | forbidden |
| E06 | production SMTP, base URL, or secrets setup | excluded |
| E07 | queue, retry, or durable-outbox redesign | excluded |
| E08 | W3 access-command/transaction redesign | excluded |
| E09 | reference or Activity/W2 cleanup | excluded |
| E10 | schema/data migration or shared-tenant activation | excluded |
| E11 | dashboard, alert, report, export, or W5 frontend work | excluded |
| E12 | general lifecycle reorganization beyond BC-022 read-only detection | excluded |
| E13 | general `.lib.php`, duplication, formatting, or dead-code cleanup | excluded |
| E14 | broad runner repair or historical-suite adoption | excluded |
| E15 | PHPCS/PHPStan/ESLint/Stylelint rollout | excluded |
| E16 | dependency or CI changes | excluded |
| E17 | W5-W7 implementation | excluded |

## 7. Master W4 traceability ledger

Abbreviations: `R` = READY; `C` = READY_WITH_CONSTRAINTS; `NA` =
NOT_APPLICABLE; `CG-W4-nn` = cutover group; `SR` = whole-group source revert.
`PRE>TRANS>POST` describes the sole owner in each phase. All behavior-change
cells are `NO`, except the smallest BC-017 method guard if characterization
confirms it.

For compact master rows, `CG0` through `CG5` map exactly to `CG-W4-01`
through `CG-W4-06`; `CG1-CG5` therefore means `CG-W4-02` through
`CG-W4-06`. The named group table in section 17 is authoritative.

| ID | Type | Concern / authority | Current evidence / state / owner | Target / action | Preservation | Depends / precedes / group | Gates | Transition / recovery / W5 | Status / constraint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | DEPENDENCY | W3 access participant; W3/W4 composition | auth calls `assignProfileInTransaction`; VERIFIED_AT_HEAD; auth+access | auth command delegates; RETAIN | RT-004/008/014, DB-001/002 | none / T05 / CG2 | G05/G06 | auth+participant > same > same; SR; none | R |
| T02 | DEPENDENCY | stable role vocabulary | `mjl_scope.lib.php`; VERIFIED_AT_HEAD; access policy | explicit access policy; MOVE | SEC-AUTHZ-001/004, DB-003 | none / T05,T10-T17 / CG1 | G05 | scope policy > compatibility seam > access policy; SR; none | R |
| T03 | INVARIANT | W3 reference/access owners unchanged | W3 commands; VERIFIED_AT_HEAD | guard only; NONE | RT-004/014, DB-001/002 | none / all / none | G05/G06 | W3 > W3 > W3; N/A; none | R |
| T04 | RESPONSIBILITY | cohesive auth ownership; W4/TA-12 | mixed `mjl_auth.lib.php`; VERIFIED_AT_HEAD; procedures | `MjlAuthCommand`; EXTRACT | RT-002/004/014, DB-001/002 | T01,T02 / T05-T17 / CG2 | G01/G02 | procedures > caller-atomic switch > command; SR; none | R |
| T05 | DATA_FLOW | invitation issue/preparation | `mjl_auth_issue_invitation`; VERIFIED_AT_HEAD | auth command; MOVE | SEC-AUTH-001/002, SEC-AUTHZ-002, DB-001/002 | T01,T02,T04 / T24,T27 / CG2 | G02/G05 | procedure > command only > command; SR; none | R |
| T06 | DATA_FLOW | invitation acceptance | selector lock/transaction/password/activate; VERIFIED_AT_HEAD | auth command; MOVE | SEC-AUTH-001/002/006, DB-001/002 | T04,T11 / none / CG2 | G02 | procedure > command only > command; SR; none | R |
| T07 | DATA_FLOW | invitation revocation | auth procedure; VERIFIED_AT_HEAD | auth command; MOVE | SEC-AUTH-001/002, DB-001/002 | T04 / none / CG2 | G02/G04 | procedure > command only > command; SR; none | R |
| T08 | DATA_FLOW | neutral reset request/throttle | auth procedure+native hook; VERIFIED_AT_HEAD | auth command; MOVE | SEC-AUTH-001/003, DB-001/002 | T04 / T24 / CG2 | G02/G03 | procedure > command only > command; SR; none | R |
| T09 | FRONTEND_CONTRACT | selector-only reset email; AUTH-F04 | `mjl_auth_reset_email`; VERIFIED_AT_HEAD | preserve current exposure; GUARD | SEC-AUTH-003 | T08 / T23 / CG0 | G02 | current > characterized > preserved; SR; none | C: characterize before movement; not before authorization; complete before cutover |
| T10 | DATA_FLOW | reset consumption/Admin exception | auth procedure; VERIFIED_AT_HEAD | auth command; MOVE | SEC-AUTH-003/006, SEC-AUTHZ-001, DB-001/002 | T02,T04,T11 / none / CG2 | G02 | procedure > command only > command; SR; none | R |
| T11 | RESPONSIBILITY | encrypted-only native password write | `mjl_auth_set_password`; VERIFIED_AT_HEAD | private auth adapter; EXTRACT | SEC-AUTH-006, RT-014 | T04 / T06,T10 / CG2 | G02 | procedure > private adapter > private adapter; SR; none | R |
| T12 | DATA_FLOW | OTP issue/password verification | auth procedures; VERIFIED_AT_HEAD | auth command; MOVE | SEC-AUTH-004/006, DB-001/002 | T02,T04,T28 / T24 / CG2 | G02/G07 | procedures > command only > command; SR; none | R |
| T13 | DATA_FLOW | OTP verify commit before session completion | commit then `mjl_auth_complete_session`; VERIFIED_AT_HEAD | command then session adapter; DELEGATE | SEC-AUTH-004/005, DB-001/002 | T04,T17 / none / CG3 | G02 | procedure > command then adapter > same; SR; none | C: add explicit order oracle before movement; not before authorization |
| T14 | DATA_FLOW | OTP resend/counters | auth procedure; VERIFIED_AT_HEAD | auth command; MOVE | SEC-AUTH-004, DB-001/002 | T04,T28 / T24 / CG2 | G02 | procedure > command only > command; SR; none | R |
| T15 | RESPONSIBILITY | pure session-validity decision | mutating/read procedure; VERIFIED_AT_HEAD | pure policy; EXTRACT | SEC-AUTH-004/005, SEC-AUTHZ-001 | T02,T04 / T17,T21 / CG3 | G01/G02 | mixed > pure decision > pure policy; SR; none | R |
| T16 | RESPONSIBILITY | pending-session binding and form state | auth lib/root/template writes; VERIFIED_AT_HEAD | private session adapter; MOVE | SEC-AUTH-004/005, RT-014 | T04 / T18,T23 / CG3 | G01/G02 | scattered > adapter only > adapter; SR; none | R |
| T17 | RESPONSIBILITY | completion/invalidation keys and order | auth lib/hook/root/template writes; VERIFIED_AT_HEAD | private session adapter; MOVE | SEC-AUTH-004/005, RT-014 | T13,T15,T16 / T21,T23 / CG3 | G02 | scattered > adapter only > adapter; SR; none | C: exact keys/order/native-bypass oracle before movement; not before authorization |
| T18 | ROUTE | `auth.php` login/verify/resend/cancel | dispatch+inline render+session; VERIFIED_AT_HEAD | thin route/handler; DELEGATE | RT-001-003, SEC-AUTH-001/004 | T04,T16 / none / CG3 | G02 | root+procedures > thin root > thin root; SR; none | C: characterize dispatch/presentation/session order before movement |
| T19 | ROUTE | `invitation.php` view/accept and BC-017 | `GETPOST` action, no explicit method guard; VERIFIED_AT_HEAD | thin route + smallest confirmed guard; DELEGATE | RT-001-003, SEC-AUTH-001/002 | T06 / none / CG2 | G02 | root+procedure > thin root > thin root; SR; none | C: direct-GET proof before movement; guard only if confirmed |
| T20 | ROUTE | Admin invite/revoke callers | `admin/access.php`; VERIFIED_AT_HEAD | stable route delegates command; DELEGATE | RT-002/003, SEC-AUTHZ-002 | T05,T07 / none / CG2 | G04/G05 | route+procedure > route+command > same; SR; none | R |
| T21 | ROUTE | native login/updateSession hooks | hook mutates session; VERIFIED_AT_HEAD | hook -> pure policy/session adapter; DELEGATE | RT-001/003, SEC-AUTH-004/005 | T15,T17 / none / CG3 | G02 | hook+mutation > hook+adapter > same; SR; none | R |
| T22 | ROUTE | native forgot/reset actions and BC-017 | `doActions` action dispatch; VERIFIED_AT_HEAD | thin hook + confirmed method guard; DELEGATE | RT-001-003, SEC-AUTH-003 | T08,T10 / none / CG2 | G02 | hook+procedures > hook+command > same; SR; none | C: direct-GET/native-dispatch proof before movement |
| T23 | FRONTEND_CONTRACT | native templates and session-error lifecycle | login/reset templates query/read/unset; VERIFIED_AT_HEAD | view model + stable templates; EXTRACT | RT-001/003, SEC-AUTH-001/003/005 | T09,T16-T18,T22 / none / CG3 | G02/G04 | active templates > compatible templates > same; SR; none | C: dynamic hook/template locals and ordering before movement |
| T24 | DATA_FLOW | prepare-commit/send/result transaction | auth+email procedures; VERIFIED_AT_HEAD | auth orchestration + concrete email adapter; MOVE | SEC-AUTH-001-004, DB-001/002/004 | T05,T08,T12,T14 / T25 / CG2 | G02/G03 | current phases > identical phases > identical phases; SR/no email reversal; none | C: send and post-send persistence faults before movement |
| T25 | RESPONSIBILITY | auth capture predicate/writer reverse dependency | email calls auth helpers; VERIFIED_AT_HEAD | email owns same names; MOVE | SEC-AUTH-002/004, LIFE-002 | T24 / none / CG4 | G01-G03 | auth callback > atomic relocation > email only; SR; none | C: capture-failure/path/payload/flag oracle before movement |
| T26 | RESPONSIBILITY | identity locks and release | auth procedures; VERIFIED_AT_HEAD | auth command private mechanism; MOVE | RT-004/014, DB-001/002 | T04 / T05-T14 / CG2 | G02/G03 | procedure > command > command; SR; none | R |
| T27 | RESPONSIBILITY | transaction-bound auth audit/no secrets | auth and audit writer; VERIFIED_AT_HEAD | auth command + retained audit writer; DELEGATE | RT-014, SEC-AUTH-001-006, DB-002/004 | T04 / T05-T14 / CG2 | G02/G03 | current > same writer > same writer; SR; none | R |
| T28 | INVARIANT | BC-022 exact auth schema recognition | table/key existence check; VERIFIED_AT_HEAD | exact read-only detector/fail closed; EXTRACT | RT-011, SEC-AUTH-004, DB-003/004, LIFE-001 | T04 / T12-T15 / CG0 | G07 | weak check > exact proof > exact detector; SR; none | C: exact decision/proof before movement and completion; not before authorization |
| T29 | RESPONSIBILITY | effective-role policy relocation | `mjl_scope.lib.php`; VERIFIED_AT_HEAD | `lib/access/mjl_access_policy.lib.php` with compatibility seam; MOVE | SEC-AUTHZ-001/004, DB-003 | T02 / T05,T10,T12,T15 / CG1 | G05/G06 | scope lib > atomic seam > access policy; SR; none | R |
| T30 | FRONTEND_CONTRACT | URLs, fragment verifier, data hooks, assets | current routes/templates/JS; VERIFIED_AT_HEAD | unchanged contract; RETAIN | RT-001-003, SEC-AUTH-002/003 | T18-T23 / none / CG5 | G02/G04 | current > current > current; SR; none | R |
| T31 | INVARIANT | clean disposable lifecycle/empty tenant | isolated runner; VERIFIED_AT_HEAD | same; GUARD | LIFE-001-003 | T28 / all tests / CG0 | G02/G07 | isolated > isolated > isolated; teardown; none | R |
| T32 | TRANSITION | source recovery and irreversible email fact | current compatible rows/schema; VERIFIED_AT_HEAD | whole-group revert/forward fix; GUARD | DB-001-004 | T24 / all groups / CG1-CG5 | G01/G02 | old > one owner/group > new; SR; none | R |
| T33 | INVARIANT | W3 ownership proof after auth move | source contract hard-codes auth location; VERIFIED_AT_HEAD | adapt assertion, preserve semantics; GUARD | RT-004/008/014, DB-001/002 | T01,T04 / completion / CG5 | G05/G06 | old proof > updated proof > updated proof; SR; none | R |
| T34 | RISK | apparently unused auth compatibility helpers | three definitions, no static caller; VERIFIED_AT_HEAD | retain unless proved unreachable; GUARD | RT-014 | T04 / none / CG5 | G01 | retained > retained/proved removal > resolved; SR; none | R |
| T35 | W5_DEPENDENCY | W4-produced dependency for W5 | frozen W5 names none; VERIFIED_AT_HEAD | none; NONE | none | all / W5 / none | G09 | baseline auth remains; N/A; none | NA: 0 explicit W5 dependencies; evidence is frozen W5 contract |
| T36 | GOVERNANCE | architecture amendment | hashes and W4 contract; VERIFIED_AT_HEAD | none; NONE | all | none / authorization / none | G00/G09 | frozen > frozen > frozen; N/A | R: amendment NO |
| T37 | GOVERNANCE | Engineering Standard amendment | frozen standard; VERIFIED_AT_HEAD | none; NONE | all | none / authorization / none | G00/G09 | frozen > frozen > frozen; N/A | R: amendment NO |
| T38 | INVARIANT | invitation-only access/no registration | no public register route; VERIFIED_AT_HEAD | preserve; GUARD | SEC-AUTH-001, SEC-AUTHZ-002 | T04 / completion / CG5 | G01/G02 | absent > absent > absent; SR; none | R |

### Required-field audit view

The compact master rows above carry dependency, predecessor, group, gates,
transition, recovery, W5, status, and constraint fields. This linked view makes
the remaining required fields mechanically explicit. Authority references to
"frozen W4" mean `17-target-architecture-proposal.md` sections 9 and W4;
preservation references mean `14-preservation-ledger.md`.

| ID | Exact authority | Current evidence | Current state | Current owner | W4 target owner | W4 action | Behavior change allowed? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01 | frozen W3/W4 composition, TA-13 | `mjl_auth_issue_invitation`; `MjlAccessCommand::assignProfileInTransaction` | VERIFIED_AT_HEAD | auth procedure + access participant | auth command + same participant | RETAIN/DELEGATE | NO |
| T02 | permission matrix; frozen W4/TA-03 | `mjl_scope_role_codes`, `mjl_scope_effective_role` | VERIFIED_AT_HEAD | scope policy library | access policy library | MOVE | NO |
| T03 | DEC-064; frozen W3 exit | `MjlReferenceCommand`, `MjlAccessCommand` | VERIFIED_AT_HEAD | W3 commands | same W3 commands | GUARD/NONE | NO |
| T04 | frozen W4, TA-12 | `lib/mjl_auth.lib.php` functions | VERIFIED_AT_HEAD | mixed auth procedures | `MjlAuthCommand` | EXTRACT | NO |
| T05 | frozen auth composition phase 1 | `mjl_auth_issue_invitation` | VERIFIED_AT_HEAD | auth procedure | `MjlAuthCommand` | MOVE | NO |
| T06 | frozen W4 invitation owner | `mjl_auth_accept_invitation` | VERIFIED_AT_HEAD | auth procedure | `MjlAuthCommand` | MOVE | NO |
| T07 | frozen W4 invitation owner | `mjl_auth_revoke_invitation` | VERIFIED_AT_HEAD | auth procedure | `MjlAuthCommand` | MOVE | NO |
| T08 | functional spec reset rules; frozen W4 | `mjl_auth_create_password_reset` | VERIFIED_AT_HEAD | auth procedure/native hook | `MjlAuthCommand` | MOVE | NO |
| T09 | AUTH-F04; frozen BC table | `mjl_auth_reset_email` + reset template | VERIFIED_AT_HEAD | auth read/template | auth query/view model | GUARD | NO; masking excluded |
| T10 | functional spec Admin exception; frozen W4 | `mjl_auth_consume_password_reset` | VERIFIED_AT_HEAD | auth procedure | `MjlAuthCommand` | MOVE | NO |
| T11 | BC-018; frozen auth table | `mjl_auth_set_password` | VERIFIED_AT_HEAD | auth procedure/native API | private password adapter | EXTRACT | NO |
| T12 | frozen auth table/W4 | `mjl_auth_verify_password`, `mjl_auth_start_otp` | VERIFIED_AT_HEAD | auth procedures | `MjlAuthCommand` | MOVE | NO |
| T13 | frozen OTP completion ordering | `mjl_auth_verify_otp` commit then completion | VERIFIED_AT_HEAD | auth procedure | auth command then session adapter | DELEGATE | NO |
| T14 | frozen OTP rules | `mjl_auth_resend_otp` | VERIFIED_AT_HEAD | auth procedure | `MjlAuthCommand` | MOVE | NO |
| T15 | frozen pure validity policy, TA-12 | `mjl_auth_session_is_otp_verified` | VERIFIED_AT_HEAD | auth procedure | pure auth/session policy | EXTRACT | NO |
| T16 | frozen private session adapter | pending-key writes in auth lib/root | VERIFIED_AT_HEAD | scattered auth/session writers | private session adapter | MOVE | NO |
| T17 | AR-REV-005; frozen session adapter | completion/clear writes in auth lib/hooks/routes/templates | VERIFIED_AT_HEAD | scattered writers | private session adapter | MOVE | NO |
| T18 | RT-001-003; frozen W4 affected roots | `auth.php` | VERIFIED_AT_HEAD | root + procedures | thin route/handler + command/adapter | DELEGATE | NO |
| T19 | BC-017; frozen smallest method guard | `invitation.php` | VERIFIED_AT_HEAD | root + procedure | thin route + command | DELEGATE | only confirmed minimal method guard |
| T20 | permission matrix Admin actions; W4 | `admin/access.php` invite/revoke | VERIFIED_AT_HEAD | route + procedures | stable route + command | DELEGATE | NO |
| T21 | frozen native-login interception | `beforeLoginAuthentication`, `updateSession` | VERIFIED_AT_HEAD | hook + direct mutation | hook + pure policy/session adapter | DELEGATE | NO |
| T22 | BC-017; native reset integration | `doActions` forgot/reset branches | VERIFIED_AT_HEAD | hook + procedures | thin hook + command | DELEGATE | only confirmed minimal method guard |
| T23 | frozen keep-templates rule | login/forgot/reset templates | VERIFIED_AT_HEAD | templates + procedures/session | view model + stable templates | EXTRACT/RETAIN | NO |
| T24 | frozen auth delivery contract | prepare/send/finalize procedures | VERIFIED_AT_HEAD | auth procedures + email adapter | auth command + same email adapter | MOVE | NO |
| T25 | frozen reverse-call correction | email calls auth capture helpers | VERIFIED_AT_HEAD | auth-owned helpers | email module | MOVE | NO |
| T26 | frozen shared identity locks | named-lock helpers | VERIFIED_AT_HEAD | auth procedures | auth command private mechanism | MOVE | NO |
| T27 | Engineering Standard audit rules | auth audit helpers + audit writer | VERIFIED_AT_HEAD | auth procedures/audit writer | auth command + retained audit writer | DELEGATE | NO |
| T28 | BC-022; TA-14; runtime DDL ban | `mjl_auth_otp_table_ready` weak check | VERIFIED_AT_HEAD | auth procedure | exact read-only detector | EXTRACT | NO |
| T29 | frozen target access-policy seam | `mjl_scope.lib.php` | VERIFIED_AT_HEAD | scope policy | access policy + compatibility names | MOVE | NO |
| T30 | frozen keep hooks/templates/URLs | routes/templates/`auth_fragment.js` | VERIFIED_AT_HEAD | existing adapters/assets | same public contracts | RETAIN | NO |
| T31 | LIFE-001-003; acceptance guidance | disposable runner and activation | VERIFIED_AT_HEAD | lifecycle/runner | same lifecycle/runner | GUARD | NO |
| T32 | frozen W4 rollback rule | compatible credential rows/schema | VERIFIED_AT_HEAD | source + persistent rows | group source recovery | GUARD | NO |
| T33 | W3 exit and W4 caller relocation | `w3_write_ownership_test.php` | VERIFIED_AT_HEAD | W3 source contract | W4-aware W3 source contract | GUARD | NO |
| T34 | frozen conservative dead-code rule | three definitions, no static caller | VERIFIED_AT_HEAD | auth library | retained unless proved unreachable | GUARD | NO |
| T35 | frozen W5 contract | W5 names no W4-produced prerequisite | VERIFIED_AT_HEAD | none | none | NONE | NO |
| T36 | frozen architecture hash | architecture file/hash | VERIFIED_AT_HEAD | governance | governance | NONE | NO |
| T37 | frozen Standard hash | Standard file/hash | VERIFIED_AT_HEAD | governance | governance | NONE | NO |
| T38 | scope boundary; SEC-AUTH-001 | no public register route | VERIFIED_AT_HEAD | route set | same route set | GUARD | NO |

### Constrained-row timing

| ID | Constraint | Before authorization? | Before movement? | Before cutover? | Before completion? |
| --- | --- | --- | --- | --- | --- |
| T09 | selector-only AUTH-F04 characterization | NO | YES | YES | YES |
| T13 | explicit OTP commit-before-session oracle | NO | YES | YES | YES |
| T17 | exact invalidation keys/order and native-bypass oracle | NO | YES | YES | YES |
| T18 | route dispatch/presentation/session-order characterization | NO | YES | YES | YES |
| T19 | direct-GET invitation mutation proof and resulting minimal guard | NO | YES | YES | YES |
| T22 | direct-GET/native reset dispatcher proof and resulting minimal guard | NO | YES | YES | YES |
| T23 | dynamic hook/template locals and ordering characterization | NO | YES | YES | YES |
| T24 | send and post-send persistence failure oracles | NO | YES | YES | YES |
| T25 | capture failure/path/payload/flag oracle | NO | YES | YES | YES |
| T28 | exact auth-schema decision, detector, and weakened-schema proof | NO | YES | YES | YES |

No constrained row requires resolution before authorization. No row is
`BLOCKED`.

## 8. Coverage reconciliation

| Coverage | Result |
| --- | --- |
| authoritative W4 scope items | 12/12 mapped |
| current responsibilities in scope | 25/25 mapped |
| target responsibilities | 12/12 mapped |
| affected routes/actions | 13/13 mapped |
| affected DB/query/write paths | 9/9 mapped |
| affected transaction boundaries | 8/8 mapped |
| affected frontend contracts | 8/8 mapped |
| affected Dolibarr seams | 7/7 mapped |
| preservation requirements | 35/35 classified |
| required verification gates | 10/10 mapped |
| cutover groups | 6/6 mapped |
| explicit W5 dependencies | 0/0; frozen contract names none |
| explicit exclusions | 17/17 reconciled |

The zero W5 denominator is known, not unknown: W5 names no W4-produced
prerequisite. Preserved authentication is baseline behavior, not a new output.

### Denominator evidence

| Denominator | Enumerated set |
| --- | --- |
| 12 authoritative scope items | T04 cohesive owner; T16-T17 session adapter; T15 pure policy; T05-T14 auth flows; T18-T23 stable adapters; T24 delivery phases; T25 callback removal; T01 W3 composition; T02 role vocabulary; T28 exact readiness; T27 audit/security invariants; T32 atomic recovery |
| 25 current responsibilities | identity validation; user lookup; audit; locks; invitation issue; invitation reads; acceptance; revocation; reset throttle; reset issue; reset reads; reset consumption; native password write; OTP readiness; password verification; OTP issue; pending lookup; OTP verification; resend; session validity; session mutation; route dispatch; hook dispatch; template effects; email delivery/capture |
| 12 target responsibilities | auth command; private password adapter; pure validity policy; private session adapter; thin auth route; thin invitation route; thin Admin caller; thin native hooks; prepared templates; concrete email adapter; exact schema detector; retained audit/access participants |
| 13 routes/actions | login; verify; resend; cancel; invitation view; accept; invite; revoke; reset request; reset consume; native interception; session revalidation; session invalidation |
| 9 DB/query/write paths | the nine rows in section 11; eight mutate/own transaction boundaries and the validity/throttle/readiness row is read-only |
| 8 transaction boundaries | invitation preparation/result/accept/revoke; reset preparation-result/consume; OTP issue-resend/verify |
| 8 frontend contracts | five stable root/native URLs; native template filenames/locals; fragment-only verifier; established assets and `data-mjl-*` hooks |
| 7 Dolibarr seams | hook registration/dispatch; native template override; `User` create/update; native password API; native session identity; `CMailFile`; native login event/date |
| 10 verification gates | G00-G09 in section 14 |
| 6 cutover groups | CG-W4-01 through CG-W4-06 in section 17 |
| 0 W5 dependencies | T35 and frozen W5 contract name none |
| 17 exclusions | E01-E17 in section 6 |

## 9. Preservation view

Current enforcement is grouped here and linked to the 35-row target table
below; no current-enforcement cell is implicit.

| Preservation IDs | Current enforcement at post-W3 HEAD |
| --- | --- |
| RT-001-003 | stable roots/hooks/templates, CSRF tokens, route guards, and direct authorization |
| RT-004 | command/identity locks and rechecks in auth/W2/W3 owners |
| RT-005-010 | W2 Activity command, immutable revisions, transitions, document/monitoring seams |
| RT-011 | current runtime readiness checks and guarded lifecycle operations; BC-022 weakness recorded |
| RT-012-013 | existing reporting/export owners, excluded from W4 |
| RT-014 | current native `User`, password, email, session, and DB adapters |
| RT-015 | current frontend assets/contracts, excluded except named auth contracts |
| SEC-AUTH-001-006 | auth routes/hooks, selector/verifier rows, reset/OTP state, session fingerprint, encrypted-only password adapter |
| SEC-AUTHZ-001-004 | effective-role policy, Admin/access routes, Activity assignment policy, W3 access command and DB guards |
| SEC-DOC-001-002 | guarded document routes/storage, excluded from W4 |
| DB-001-004 | current command/auth transactions, audit writer, SQL constraints, entity filters |
| LIFE-001-004 | guarded activation, disposable runner/teardown, empty tenant, retaining removal |

| Preservation ID | Classification | Ledger / target enforcement | Verification | Status |
| --- | --- | --- | --- | --- |
| RT-001 | DIRECTLY_AFFECTED | T18-T23,T30 thin stable adapters | G02/G04 | mapped |
| RT-002 | DIRECTLY_AFFECTED | T04-T10,T18-T22 command authorization | G02 | mapped |
| RT-003 | DIRECTLY_AFFECTED | T18-T23,T30 CSRF/method/route behavior | G02/G04 | mapped |
| RT-004 | DIRECTLY_AFFECTED | T01,T04,T26 lock-time reauthorization | G02/G05 | mapped |
| RT-005 | NOT_TOUCHED | W2 workflow ownership retained | not selected; exclusion guard | mapped |
| RT-006 | NOT_TOUCHED | W2 Activity revisions retained | not selected; exclusion guard | mapped |
| RT-007 | NOT_TOUCHED | W2 transitions retained | not selected; exclusion guard | mapped |
| RT-008 | INDIRECTLY_AT_RISK | T01,T33 W3/auth composition remains current | G05/G06 | mapped |
| RT-009 | NOT_TOUCHED | W2 document behavior retained | not selected; exclusion guard | mapped |
| RT-010 | NOT_TOUCHED | W2 monitoring reads retained | not selected; exclusion guard | mapped |
| RT-011 | INDIRECTLY_AT_RISK | T28 exact read-only auth readiness | G07 | mapped |
| RT-012 | NOT_TOUCHED | reporting/export excluded | not selected; exclusion guard | mapped |
| RT-013 | NOT_TOUCHED | reporting/export excluded | not selected; exclusion guard | mapped |
| RT-014 | DIRECTLY_AFFECTED | T01,T04,T11,T17,T26,T27 private adapters | G01/G02 | mapped |
| RT-015 | NOT_TOUCHED | frontend W5 scope excluded | not selected; exclusion guard | mapped |
| SEC-AUTH-001 | DIRECTLY_AFFECTED | T04-T10,T18-T24,T38 | G02/G04 | mapped |
| SEC-AUTH-002 | DIRECTLY_AFFECTED | T05-T07,T19,T25,T30 | G02 | mapped |
| SEC-AUTH-003 | DIRECTLY_AFFECTED | T08-T10,T22-T24,T30 | G02/G03 | mapped |
| SEC-AUTH-004 | DIRECTLY_AFFECTED | T12-T18,T21,T24-T25,T28 | G02/G07 | mapped |
| SEC-AUTH-005 | DIRECTLY_AFFECTED | T13,T15-T17,T21,T27 | G02 | mapped |
| SEC-AUTH-006 | DIRECTLY_AFFECTED | T06,T10-T12,T27 | G02; both `pass IS NULL` assertions | mapped |
| SEC-AUTHZ-001 | DIRECTLY_AFFECTED | T02,T10,T15,T29 | G02/G05 | mapped |
| SEC-AUTHZ-002 | DIRECTLY_AFFECTED | T01,T05,T20,T38 | G02/G04/G05 | mapped |
| SEC-AUTHZ-003 | NOT_TOUCHED | Activity visibility retained | not selected; exclusion guard | mapped |
| SEC-AUTHZ-004 | DIRECTLY_AFFECTED | T01-T03,T29,T33 | G05/G06 | mapped |
| SEC-DOC-001 | NOT_TOUCHED | document routes excluded | not selected; exclusion guard | mapped |
| SEC-DOC-002 | NOT_TOUCHED | document storage excluded | not selected; exclusion guard | mapped |
| DB-001 | DIRECTLY_AFFECTED | T01,T04-T17,T24,T26,T32 | G02/G03/G05 | mapped |
| DB-002 | DIRECTLY_AFFECTED | T01,T04-T17,T24,T26-T27,T32 | G02/G03/G05 | mapped |
| DB-003 | DIRECTLY_AFFECTED | T02,T28-T29,T32 | G05/G07 | mapped |
| DB-004 | DIRECTLY_AFFECTED | T24,T27-T28,T32 | G02/G07 | mapped |
| LIFE-001 | DIRECTLY_AFFECTED | T28,T31 clean activation/exact readiness | G07 | mapped |
| LIFE-002 | INDIRECTLY_AT_RISK | T25,T31 disposable isolation/teardown | G02/G03/G07 | mapped |
| LIFE-003 | DIRECTLY_AFFECTED | T31 empty tenant/no seed | G02/G07 | mapped |
| LIFE-004 | NOT_TOUCHED | module-removal retention unchanged | not selected; exclusion guard | mapped |

Totals: 20 directly affected, 3 indirectly at risk, 12 not touched; 35/35.

## 10. Request/action ownership view

| Ledger ID | Root/endpoint | Method | Action | PRE owner | TRANSITION owner | POST owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T18 | `auth.php` | GET | OTP view/redirect | root + auth reads/session | root with prepared view; one active backend | thin root/handler | TARGET_OWNED |
| T18 | `auth.php` | POST | `login` | root + auth procedures | root -> command/session adapter | thin root -> command/adapter | TARGET_OWNED |
| T18 | `auth.php` | POST | `verify` | root + auth procedures | root -> command then adapter | thin root -> command/adapter | TARGET_OWNED |
| T18 | `auth.php` | POST | `resend` | root + auth procedure | root -> command | thin root -> command | TARGET_OWNED |
| T18 | `auth.php` | POST | `cancel` | root + direct session mutation | root -> session adapter | thin root -> adapter | TARGET_OWNED |
| T19 | `invitation.php` | GET | selector view | root + auth reads | root with prepared view | thin root/query/view | TARGET_OWNED |
| T19 | `invitation.php` | characterized GET; form POST | `accept` | root + auth procedure | exactly one old/new executor; minimal confirmed guard | thin root -> command | TARGET_OWNED |
| T20 | `admin/access.php` | POST | `invite` | route + auth procedure | route -> new command only | stable route -> command | TARGET_OWNED |
| T20 | `admin/access.php` | POST | `revoke` | route + auth procedure | route -> new command only | stable route -> command | TARGET_OWNED |
| T21 | native `/index.php` | POST/native hook | login interception | hook/template/auth procedure | hook -> command/policy/adapter | stable hook/template -> target owners | LEGACY_RETAINED adapter |
| T21 | native hook | request lifecycle | revalidate/invalidate | hook + direct session mutation | hook -> pure policy/adapter only | stable hook -> policy/adapter | LEGACY_RETAINED adapter |
| T22 | native password-forgotten | characterized GET; form POST | reset request | hook + auth procedure | hook -> command only | stable hook -> command | LEGACY_RETAINED adapter |
| T22 | native password-forgotten | characterized GET; form POST | reset consume | hook + auth procedure/session | hook -> command/adapter only | stable hook -> command/adapter | LEGACY_RETAINED adapter |

Affected action denominator: login, verify, resend, cancel, invitation view,
accept, invite, revoke, reset request, reset consume, native interception,
session revalidation, and invalidation = 13/13.

### Authorization and access/auth composition

| Ledger | Authorization impact | Caller | Transaction owner | Participant / authorization owner | Auth/session owner | Failure propagation |
| --- | --- | --- | --- | --- | --- | --- |
| T01,T05 | STRUCTURAL_OWNERSHIP_CHANGE | `admin/access.php` -> auth command | auth command | W3 access participant; stable Admin/effective-role policy | auth command; session N/A | participant false/exception fails preparation; one outer rollback |
| T06-T10 | STRUCTURAL_OWNERSHIP_CHANGE | invitation/native reset adapters | auth command | stable role/entity/Admin policy | auth command then adapter where needed | rejection/DB/commit errors preserve current route result; no false success |
| T12-T17,T21 | STRUCTURAL_OWNERSHIP_CHANGE | auth/native hook adapters | auth command | stable active/entity/effective-role policy | pure policy + private adapter | policy denial invokes adapter; command failure never authenticates |
| T02,T29 | STRUCTURAL_OWNERSHIP_CHANGE | all auth/access consumers | existing command owner | canonical access policy | N/A | invalid/ambiguous role fails closed; no new alias |
| T03,T20 | NONE | W3/reference/Admin access callers | unchanged W3 owner | unchanged W3 policy/command | N/A | unchanged |

There is no semantic authorization change. Entity isolation, Activity
assignment, Admin behavior, no-self-validation, and resource scope remain
unchanged; Activity-specific policies are not moved by W4.

## 11. Database and transaction view

| Ledger | Table/query/write | Current owner | Target owner | Impact | Transaction owner | State compatibility | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T01,T05 | native user, role/right, invitation/reset revoke, audit writes | auth procedure + access participant | auth command + same participant | WRITE_OWNERSHIP_CHANGE | auth command owns begin/commit/rollback; participant joins native depth | YES | READY |
| T24 | invitation status/hash and audit | auth procedure | auth command | WRITE_OWNERSHIP_CHANGE | separate auth delivery-result transaction | YES | CONSTRAINED fault proof |
| T06,T11 | user password/activation, invitation, audit | auth procedure | auth command/private adapter | WRITE_OWNERSHIP_CHANGE | auth command owns begin/commit/rollback and native call | YES | READY |
| T07 | invitation status/audit | auth procedure | auth command | WRITE_OWNERSHIP_CHANGE | auth command owns begin/commit/rollback | YES | READY |
| T08,T24 | reset credential/audit preparation and result | auth procedure | auth command | WRITE_OWNERSHIP_CHANGE | auth command owns preparation and separate result transactions | YES | CONSTRAINED fault proof |
| T10,T11 | user password, reset credential, audit | auth procedure | auth command/private adapter | WRITE_OWNERSHIP_CHANGE | auth command owns begin/commit/rollback and native call | YES | READY |
| T12,T14,T24 | OTP challenge/audit issue/resend | auth procedure | auth command | WRITE_OWNERSHIP_CHANGE | auth command commits before concrete email adapter | YES | READY |
| T13,T17 | OTP challenge/audit verify | auth procedure | auth command then session adapter | WRITE_OWNERSHIP_CHANGE | auth command commits before non-DB session mutation | YES | CONSTRAINED order proof |
| T08,T15,T28 | user/role/credential/audit/schema reads | auth procedures | query/pure policy/exact detector | QUERY_RELOCATION_ONLY | none; read only | YES | CONSTRAINED exact detector |

| Mutation | Begin / commit / rollback owner | Native depth / audit relationship | Last safe rollback | Backward compatible? | Forward recovery after point? |
| --- | --- | --- | --- | --- | --- |
| invitation preparation | auth command / auth command / auth command | W3 participant joins; issuance/access audit in same transaction | before successful preparation commit | YES | YES after commit; preserve credential/user/role rows |
| invitation result | auth command / auth command / auth command | separate result audit transaction | before result commit; email fact may already exist | YES | YES; record/surface result, no resend |
| invitation accept | auth command / auth command / auth command | native password call inside owner; acceptance audit bound | before commit | YES | YES after commit; do not reverse password |
| invitation revoke | auth command / auth command / auth command | revocation audit bound | before commit | YES | YES after commit |
| reset preparation/result | auth command for each transaction | request/result audit bound; email between commits | before preparation commit, then before result commit | YES | YES; neutral response retained, no silent retry |
| reset consume | auth command / auth command / auth command | native password call; completion audit bound | before commit | YES | YES after commit; do not reverse password |
| OTP issue/resend | auth command / auth command / auth command | issuance audit bound; delivery after commit | before challenge commit | YES | YES; never resurrect prior code |
| OTP verify | auth command / auth command / auth command | verification audit bound; session outside DB after commit | before credential commit | YES | YES; fail closed/re-authenticate if session step fails |

SMTP never enters a DB transaction. A sent email cannot be rolled back. A
post-send result-persistence failure is surfaced with no silent retry or false
claim that preparation/email rolled back. W4 does not silently strengthen the
existing general auth transaction mechanics beyond the frozen requirements.
Failed begin must fail closed; failed commit cannot return success; rollback
failure is surfaced. W4 preserves the current native transaction-depth
exception and does not claim unapproved reference-command hardening.

## 12. Frontend contract view

| Ledger | Contract | Producer | Consumer | PRE | POST | Verification | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T18,T30 | `auth.php` URL, action/form names, token, redirect | root/auth procedures | browser/native shell | current values | same values from thin handler/view | G02 | RETAINED |
| T19,T30 | `invitation.php`, selector and fragment verifier | root/auth read + `auth_fragment.js` | browser | selector query, verifier fragment | same | G02/G04 | RETAINED |
| T20,T30 | Admin access invite/revoke forms | Admin route/template | browser/Admin | current URLs/names/token | same | G04 | RETAINED |
| T21,T23 | native login URL/template locals/messages | hook/auth/template/session | Dolibarr login template/browser | dynamic native locals | prepared compatible locals; no template mutation | G02/G04 | CONSTRAINED characterization |
| T22,T23 | native forgot/reset actions, form names, messages | hook/auth/templates | Dolibarr/browser | current actions/locals | same through handler/view | G02 | CONSTRAINED characterization |
| T09,T23 | selector-only displayed email | auth read/template | browser | full email before verifier proof | same until separately authorized | G02 | CONSTRAINED characterization |
| T23,T30 | IDs, ARIA, `data-mjl-*`, CSS classes/selectors | templates | `auth_fragment.js`/auth UI JS/CSS/browser | current hooks | unchanged | G02/G04 | RETAINED |
| T30 | CSS/JS public paths and JSON/AJAX absence | module assets/routes | browser | current paths; no auth AJAX/JSON contract | unchanged | G01/G04 | RETAINED |

There is no frontend redesign. Templates receive view data and do not own query
or session mutation after cutover. AUTH-F04 masking is not authorized by W4.

## 13. Dolibarr integration notes

Hook registration and native invocation are dynamic seams. W4 keeps
`main.inc.php`, `$db`, `$user`, `$conf`, `$langs`, `$hookmanager`, `GETPOST()`,
CSRF tokens, rights, active entity, Dolibarr DB abstraction, module paths,
class loading, and callback/resource ownership inside established Dolibarr
seams. It preserves hook method names/results, action names, template locals,
redirect timing, native password API behavior, `CMailFile`, native login
dates/events, and session keys. Includes become explicit: W4 must not rely on
incidental access-policy loading before `MjlAccessCommand`. No request,
authentication, authorization, transaction, ORM, or autoloading framework is
introduced. No request-selected arbitrary function, class, method, callback,
file, or include path is permitted.

Validation, authorization, not-found, and business rejection remain owned by
the command/policy and mapped by the stable adapters. DB/transaction failures
remain owned and surfaced by the transaction owner. Unexpected exceptions and
legacy-delegation failures fail closed without changing visible neutral-reset
or invitation error semantics. T27 keeps actor, entity/context, safe details,
transaction relationship, and failure audit explicit; technical logging never
replaces business audit.

## 14. Verification matrix

These are future W4 gates; none is executed by this documentation-only review.
Future paths are fixed here so an authorization cannot substitute an unnamed
test. A new focused contract may be created at the stated path only during an
authorized W4.

| Gate ID | Ledger IDs protected | Exact command/test | Oracle | Failure proven | Execution path | Stage | Environment | Mutation class | Blocking? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G00 | T36,T37 | `sha256sum` on the three frozen files; `git merge-base --is-ancestor` for W0-W3; `git status --short` | exact hashes, reachable baselines, clean entry | governance/baseline drift | host command -> Git/files | PRE_W4_BASELINE | host, read-only | none | YES |
| G01 | T04,T15,T16,T17,T18,T25,T34,T38 | `php tests/contracts/w4_auth_ownership_test.php` | exactly one command owner/session mutator/helper definition; no reverse callback, legacy writer, or public register route | duplicate/unowned/reverse/public authority | PHP CLI -> named source contract -> production files | FOCUSED_IMPLEMENTATION | host, read-only source contract | source ownership only | YES |
| G02 | T04-T25,T27-T28,T30-T32,T38 | `npm run test:auth` -> `tests/runner/run-suite.js auth` -> `tests/e2e/authentication.spec.js` | 13 current behaviors plus all named W4 characterizations; both `llx_user.pass IS NULL` | direct GET, disclosure, send/result/capture/schema/order/key/native-bypass failures | npm -> disposable runner -> Playwright auth spec -> real routes/DB | PRE_MOVE_CHARACTERIZATION, CUTOVER, POST_CUTOVER_REGRESSION | isolated disposable tenant with teardown | minimal isolated auth fixtures and injected faults | YES |
| G03 | T08,T14,T24,T25,T26,T27 | `npm run test:rst008` -> runner `rst008` -> `tests/e2e/auth-concurrency.spec.js` and reset-boundary selection | concurrent single-use, delivery-capture failure, rows/audit/locks remain correct | race, replay, capture failure, boundary rollback | npm -> disposable runner -> selected E2E specs -> real routes/workers/DB | POST_CUTOVER_REGRESSION | isolated disposable tenant with teardown | minimal credentials, injected barrier/failure | YES |
| G04 | T07,T20,T23,T30 | `npm run test:vui11` -> runner `vui11` -> VUI-11 Playwright selection | Admin invitation/access UI, feedback, hooks, templates, and URLs unchanged | UI/redirect/action regression | npm -> disposable runner -> VUI-11 spec -> browser routes | POST_CUTOVER_REGRESSION | isolated disposable tenant with teardown | minimal access/invitation fixture | YES |
| G05 | T01,T02,T03,T20,T29,T33 | `php tests/contracts/access_command_test.php` | access participant remains non-owning; role and standalone access behavior unchanged | participant transaction takeover or vocabulary drift | PHP CLI -> fake DB/native adapters -> `MjlAccessCommand` | CUTOVER | host direct contract | in-memory/fake mutation only | YES |
| G06 | T01,T03,T29,T33 | `php tests/contracts/w3_write_ownership_test.php` | one W3 reference/access writer; relocated auth owner invokes the same participant | legacy/duplicate W3 writer or missing participant call | PHP CLI -> source ownership contract -> production files | CUTOVER | host, read-only source contract | source ownership only | YES |
| G07 | T12,T14,T28,T31 | G02's `npm run test:auth`, with weakened-schema fixture in `tests/runner/run-suite.js` auth setup and assertions in `tests/e2e/authentication.spec.js` | exact target accepted; weakened auth table refused; no normal-runtime DDL | partial/wrong columns, keys, checks, FK/index/invariant accepted | npm -> disposable lifecycle setup -> real readiness detector -> auth route | PRE_MOVE_CHARACTERIZATION | isolated disposable tenant with teardown | disposable schema weakening/restoration only | YES |
| G08 | T04-T30 | `php -l` on every PHP path reported by `git diff --name-only --diff-filter=ACMR` under `custom/mjlfinancement` | every changed PHP file parses | syntax/load failure before runtime | host file list -> PHP CLI parser | FOCUSED_IMPLEMENTATION | host, read-only | none | YES |
| G09 | T30,T31,T32,T35,T36,T37 | frozen hashes; `rg` ownership/exclusion references; `git diff --check`; `git status --short` | governance unchanged, exclusions/W5 status retained, no whitespace error, clean exit | scope/governance drift or residual worktree | host commands -> Git/docs/source | DOCUMENTATION_DIFF | host, read-only | none | YES |

G02 must explicitly add: direct GET/native dispatch; invitation/reset send
failure; post-send result-persistence failure; capture failure; selector-only
email disclosure; exact weakened schema; OTP commit before session completion;
exact invalidation keys/order; and native-login bypass. A passing count alone
is not an oracle.

## 15. Deferred-debt view

| Debt / risk | W4 relationship | Disposition | Blocks |
| --- | --- | --- | --- |
| W2-RSK-007 broad legacy-suite cost | focused W4 gates cover moved seams | `DEFERRED` | no |
| BC-005 unit command stalls | G02-G08 use exact commands | `DEFERRED` | no |
| BC-006 incomplete test discovery | every selected command/file is named | `W4_GUARD` | no |
| BC-007 dormant shared-port test | no selected gate resolves through it | `NOT_RELEVANT` / deferred | no |
| AUTH-F04 privacy improvement | preserve and characterize exposure | deferred product decision | no |
| general auth transaction hardening | not authorized structural scope | deferred | no |
| unused compatibility helpers | retain absent reachability proof | guarded, not cleanup scope | no |

### Duplication and historical/dead-code control

| Item | Class | W4 disposition |
| --- | --- | --- |
| auth business-role list versus canonical access-role vocabulary | D3 semantic | T02/T29 establish one policy owner; no parallel vocabulary |
| scattered session-key mutation in auth/root/hook/templates | D2 structural | T16/T17/CG-W4-04 consolidate mutation behind one adapter |
| route authorization plus locked command reauthorization | D4 intentional defense-in-depth | retain both; UI hiding remains non-authoritative |
| auth capture helpers called back from email | D1 exact ownership duplication/cycle | T25/CG-W4-05 retain names but place one definition in email |
| `mjl_auth_token`, `mjl_auth_absolute_url`, `mjl_auth_mail_from` | unresolved reachability, not proven dead | T34 retains unless repository and dynamic-seam proof supports atomic retirement |

No `HISTORICAL`, `MIGRATION_ONLY`, or `UNRESOLVED` code is removed merely
because responsibility moves. General dead-code cleanup is excluded by E13.

## 16. Dependency graph validation

```text
T36/T37 governance + T01/T02 W3 inputs + T28 schema proof
        -> T04 cohesive command
        -> T05-T14 auth flows
        -> T24 delivery phases -> T25 email helper relocation
        -> T15 pure validity -> T16/T17 session adapter
        -> T18-T23 routes/hooks/templates
        -> T30 contracts + T33 ownership proof
        -> T31/T32/T38 exit guards
```

The graph is acyclic. Email no longer calls into auth after T25. There are no
unowned PRE/TRANSITION/POST states and no permissible long-lived dual owner.

## 17. Coexistence and cutover view

| Group | Ledger IDs / atomic content | Atomicity required? | Coexistence | Last safe rollback | Persistent compatibility | Forward recovery |
| --- | --- | --- | --- | --- | --- | --- |
| CG-W4-01 | T09,T13,T17-T19,T22-T25,T28 characterization and exact-detector proof | YES | SAFE_TEMPORARY_COEXISTENCE: proof code only; no production-owner change | revert proof/detector unit before CG-W4-02 | no business-row change; disposable schema only | correct failing proof/detector, rerun G02/G07 |
| CG-W4-02 | T02,T29 role/access policy and explicit includes | YES | COEXISTENCE_WITH_CONSTRAINTS: procedural compatibility name delegates to one semantic owner only | revert complete policy/caller/include group | no schema/data change | restore explicit includes or finish switch; retire wrapper in CG-W4-06 absent dynamic consumer |
| CG-W4-03 | T04-T14,T26-T27 command plus invitation/reset/OTP/password callers | YES | NO_COEXISTENCE for mutation execution | revert complete command/caller replacement | credential/user/role/audit rows readable by both source versions | fix group forward; never reverse committed credentials |
| CG-W4-04 | T15-T23 pure validity, session adapter, roots/hooks/templates | YES | NO_COEXISTENCE for session mutation | revert adapter/policy/root/hook/template group | sessions may invalidate/re-authenticate; credentials unchanged | complete missed writer switch or fail closed/logout |
| CG-W4-05 | T24-T25 capture helpers, includes, definitions, callers | YES | NO_COEXISTENCE: exactly one definition/owner | revert entire relocation before later source changes | email/credential rows and path/payload compatible | restore one known owner; surface sent-email result failures without retry |
| CG-W4-06 | T30-T38 contracts, regression, stale helper/wrapper retirement, docs | YES | SAFE_TEMPORARY_COEXISTENCE only for proven non-executing compatibility names until retirement | restore complete last retired compatibility unit | no schema/data change | reintroduce proven required name, rerun G01-G09 |

### Ledger-level coexistence

| Ledger IDs | PRE owner | TRANSITION owner | POST owner | Coexistence | Cutover condition | Legacy disposition | Atomic group |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T02,T29 | scope policy | one target policy behind transitional names | access policy | COEXISTENCE_WITH_CONSTRAINTS | every include/caller resolves to one semantic owner; G05/G06 pass | wrapper retired unless dynamic consumer proved | CG-W4-02 |
| T04-T14,T26-T27 | auth procedures | command is sole executor for switched callers | auth command/private password adapter | NO_COEXISTENCE | all callers switched; old writer definitions unreachable/retired; G01-G03 pass | RETIRE | CG-W4-03 |
| T15-T23 | mixed procedure/root/hook/template writers | private adapter is sole mutation executor | pure policy + private session adapter | NO_COEXISTENCE | direct session writes absent outside adapter; G01/G02/G04 pass | RETIRE writers; RETAIN adapters/templates | CG-W4-04 |
| T24,T25 | auth/email with reverse callback | one helper definition during atomic include/caller switch | auth orchestration + email-owned helpers | NO_COEXISTENCE | exactly one definition; callback absent; G01-G03 pass | RETIRE auth-owned definitions | CG-W4-05 |
| T30-T38 | current contracts/governance | unchanged contracts while obsolete names are proven | retained contracts/governance | SAFE_TEMPORARY_COEXISTENCE | all G00-G09 pass and no executing duplicate | RETIRE only proven obsolete names | CG-W4-06 |

### Ledger-level rollback and forward recovery

| Ledger IDs | Persistent impact | Last safe rollback point | Rollback model | Backward-compatible state? | Forward recovery | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T02,T29 | none | before/after source switch | SOURCE_REVERT_SAFE | YES | finish caller/include switch | CREDIBLE |
| T04,T08,T12,T14,T26,T27 | pending credentials/audit may commit | before each command transaction commits | SOURCE_REVERT_WITH_CONSTRAINTS | YES | keep committed rows; fix source forward | CREDIBLE |
| T05,T01 | user/role/right/invitation/audit may commit | before invitation preparation commit | SOURCE_REVERT_WITH_CONSTRAINTS | YES | preserve W3 composition and committed preparation | CREDIBLE |
| T06,T10,T11 | password/activation/consumption may commit | before transaction commit | FORWARD_FIX_PREFERRED | YES | never reverse password/credential use; restore compatible source | CREDIBLE |
| T07 | revocation/audit may commit | before commit | SOURCE_REVERT_WITH_CONSTRAINTS | YES | retain revocation fact; fix forward | CREDIBLE |
| T13,T15-T23 | OTP verify may commit; sessions ephemeral | before credential commit; otherwise after session invalidation | FORWARD_FIX_PREFERRED | YES | reauthenticate/fail closed; never undo consumed OTP | CREDIBLE |
| T24,T25 | email may be sent; result row/audit may lag | before send; after send source rollback cannot erase fact | FORWARD_FIX_PREFERRED | YES | record/surface result, no silent retry | CREDIBLE |
| T28,T31 | disposable schema mutation only; runtime detector reads | before disposable weakening/restoration | SOURCE_REVERT_SAFE | YES | restore disposable tenant/teardown; correct detector | CREDIBLE |
| T30-T38 | no new persistent state | before retiring each compatibility unit | SOURCE_REVERT_SAFE | YES | restore proven required name, rerun gates | CREDIBLE |

## 18. Rollback and forward recovery view

The group table is the ledger-linked recovery plan. Schema and credential rows
remain compatible, so no data reversal is authorized. If a send already
occurred, recovery records or surfaces the result failure and proceeds forward;
it never pretends the email can be unsent. Unsafe partial rollback, credential
row deletion, replay, or silent retry is forbidden.

## 19. Request and failure simulations

- Invitation: Admin route -> auth command -> outer transaction -> W3 access
  participant -> audit -> commit -> email -> result transaction. Any pre-commit
  failure rolls back preparation; send/result failures follow T24.
- Reset request: native hook -> neutral auth command -> preparation commit ->
  email -> result transaction. Unknown/throttled users retain neutral output.
- Reset consume: native hook -> lock -> exact row/entity/Admin/role checks ->
  encrypted password -> consume/audit/commit -> session adapter feedback.
- OTP login: password check -> challenge commit -> delivery -> verify lock ->
  consume/audit/commit -> session adapter completion/regeneration.
- Native bypass: hook asks pure validity policy; denial invokes the adapter to
  clear exact keys/regenerate/redirect. Policy itself does not mutate.
- Failure cases: failed send, failed post-send persistence, failed capture,
  weakened schema, concurrent token use, and post-role invitation audit failure
  all have named oracles in G02/G03/G05/G07.

## 20. W5 dependency view

| W5 dependency | Ledger | Required outcome | Proof | Blocking |
| --- | --- | --- | --- | --- |
| none explicitly named by frozen W5 | T35 | ordinary auth/access behavior remains baseline | G09 plus W4 exit | no new dependency |

Coverage is 0/0, complete. W5 remains separately unauthorized.

## 21. W4 implementation skeleton

| Step | Ledger | Action | Likely files | Preconditions | Gates | Group / recovery |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | constrained rows,T28 | add characterization and exact refusal proof | auth E2E/runner lifecycle only | authorization + G00 | G02/G07 | CG-W4-01; revert proofs/detector unit |
| 2 | T02,T29 | relocate policy with explicit includes and only demonstrated compatibility names | access policy/scope/access command | step 1 | G05/G06/G08 | CG-W4-02; SR |
| 3 | T04-T14,T26-T27 | create cohesive command/private password adapter; switch callers | auth class/lib/routes/hook | steps 1-2 | G01-G03,G05,G08 | CG-W4-03; SR |
| 4 | T15-T23 | create pure policy/session adapter; switch all writers/templates | session lib/routes/hook/templates | step 3 | G01/G02/G04/G08 | CG-W4-04; SR |
| 5 | T24-T25 | relocate capture helpers and remove reverse dependency | email/auth includes/callers | capture oracle | G01-G03/G08 | CG-W4-05; SR |
| 6 | T30-T38 | retire superseded owners/wrappers, update contracts/docs, final regression | contracts/docs and touched auth files | steps 1-5 | G01-G09 | CG-W4-06; whole-wave source revert |

Stop if any step introduces a second public auth abstraction, repository/port
framework, queue, retry engine, schema migration, or later-wave mechanism.

## 22. Change-budget estimate

Expected, not authorized: 3 focused files added (command, session adapter, and
access policy), approximately 7-10 runtime files modified, 0 schema files, 0-1 superseded auth
library files removed or reduced, 3-5 focused test/contract files modified, and
2-4 status/architecture-index documents updated. Material growth beyond this
range requires an immediate lean-scope reassessment, not automatic expansion.

## 23. Cross-cutting risk register

| Risk | Ledger | Likelihood | Impact | Mitigation | Blocks authorization |
| --- | --- | --- | --- | --- | --- |
| dual auth/session authority | T04,T16-T23 | medium | high | atomic groups + G01/G02 | no |
| W3 composition regression | T01,T05,T33 | low | high | G02/G05/G06 | no |
| role vocabulary drift | T02,T29 | low | high | explicit policy owner/includes + G05 | no |
| SMTP moved into transaction or false rollback claim | T24,T32 | low | high | fault oracles + phase contract | no |
| weakened schema accepted | T28,T31 | medium | high | exact fail-closed detector + G07 | no |
| dynamic hook/template break | T18,T21-T23,T30 | medium | medium | pre-move characterization + G02/G04 | no |
| email/auth callback cycle or duplicate helper | T25 | medium | medium | atomic relocation + G01/G03 | no |
| scope drift into W5/deferred debt | T34-T38 | low | medium | exclusions/change budget/G09 | no |

Non-blocking risks: 8. Cross-cutting blocking risks: 0.

## 24. Mechanical readiness gate

| Condition | Result |
| --- | --- |
| coverage reconciliation | COMPLETE |
| blocked ledger rows | 0 |
| constrained rows requiring pre-authorization resolution | 0 |
| authority conflicts / current-state discrepancies | 0 / 0 |
| W3 dependencies A/B | RECONCILED / RECONCILED |
| unexplained cycles | 0 |
| unowned or dual-authority transition states | 0 / 0 |
| unsafe atomic cutovers / coexistence rows | 0 / 0 |
| affected preservation items without enforcement/verification | 0 / 0 |
| mandatory gates without oracle/execution path | 0 / 0 |
| non-credible recovery / ambiguous transaction owner | 0 / 0 |
| authorization/vocabulary/composition conflicts | 0 / 0 / 0 |
| architecture / standard amendment | NO / NO |
| cross-cutting blocking risks | 0 |
| W4 scope / entry / exit / W5 dependencies | CLEAR / DERIVABLE / DERIVABLE / COMPLETE |

Entry requires the frozen governance, W0-W3 completion, both reconciled W3
inputs, clean worktree, 35/35 preservation classification, complete coverage,
and this mechanical gate. Authorization still requires a separate user action.

Future W4 exit requires all constrained rows resolved; all CG-W4-01 through CG-W4-06 groups
complete; one reachable auth owner and one private session mutator; old writers
retired; all G00-G09 gates passing; both W3 inputs preserved; compatible rows,
routes, hooks, templates, and URLs; governance unchanged; no W5 work; and a
clean documented worktree.

## 25. Final verdict

The frozen contract says missing characterization is added before extraction,
and every such condition has a hard pre-movement gate. The actual post-W3
owners and W3 inputs are reconciled. No blocker requires an architecture or
Engineering Standard amendment, and no authorization condition is missing.

```text
W4_READY_FOR_AUTHORIZATION
W4: NOT_AUTHORIZED
W5-W7: NOT_AUTHORIZED
```
