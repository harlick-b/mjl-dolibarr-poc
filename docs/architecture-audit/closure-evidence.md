# Audit closure evidence

## Scope boundary

Closure was limited to four confirmed HIGH findings and their focused proof. It
did not reorganize modules, change product workflows, alter public routes, or
create a target architecture. The immutable audit snapshot remains commit
`ca6139b57597a4e9dc32216e167e57f8be53d7d4`; the pre-second-wave closure point
is `47426e71fe152ecb1a9ffb2dfae00d608d850a9b`.

Across both correction waves, five application files changed, one verification
contract was added, and four E2E/runner files changed. All were re-read. The
current application/test manifest is
`36e9bc9c2712df4222cc06bbcee171ebd493fcfc565f4142587b9c3e34783763`;
the application-only manifest is
`0a03b373302f8132d3ecf86ec69520bc1fcb027f033a176865992f8caeabfdbf`.
The current application tree is 157 files and 20,573 lines. The immutable
annexes remain the baseline inventory; this document records the reviewed
delta.

## HIGH findings resolved

### BC-001 — retained technical Admin password reset

Reset triggers and consumption admit only the entity-0 native Admin into an
active-entity reset while retaining exact same-entity rules for business users.
`npm run test:auth` passed 12/12 in a disposable tenant, including request,
consumption and entry into OTP verification with the new password.

### BC-002 — reference transaction outcomes

Reference create, rename and lifecycle writes stop on failed begin, reject
failed commits, attempt rollback, and close a connection whose rollback fails.
`php tests/contracts/reference_transaction_test.php` passed the direct begin,
commit and rollback-failure contract.

### BC-018 — legacy cleartext password persistence

The only MJL calls to native `User::setPassword()` pass through
`mjl_auth_set_password()`. The adapter now saves the current
`DATABASE_PWD_ENCRYPTED` runtime property, forces it to `1` for the native call,
and restores or unsets it in `finally`. This keeps the correction local to MJL
password mutations and preserves the caller's runtime configuration.

The auth E2E now asserts `llx_user.pass IS NULL` after both the retained Admin
reset and invitation acceptance. `npm run test:auth` passed 12/12 and removed
its containers, volumes and network.

### BC-019 — early RST-006B interruption recovery

`mjl_rst006b_detect_schema()` now returns `PARTIAL` for every exact state
accepted by `mjl_rst006b_is_known_prefix()`, after retaining the target and
predecessor fast paths. Unknown shapes still fail closed.

Four failure points cover the formerly unresumable stages: after dropping the
Phase 2 Operation check, and after adding the execution-status, spent-amount
and observation checks. `npm run test:phase3a` passed the complete interruption
apply/verify/rollback matrix and then 27/27 Playwright tests. Expected database
guards rejected invalid mutations. The disposable tenant, volumes and network
were removed.

## Preservation reverse links

| Requirement | Closure implementation/evidence |
| --- | --- |
| `SEC-AUTH-003`, `SEC-AUTHZ-001`, `DB-001`, `DB-003`, `LIFE-001` | reset trigger/consume guards and retained-Admin auth E2E |
| `DB-001`, `DB-002`, `RT-008`, `RT-014` | checked reference transactions and direct failure contract |
| `SEC-AUTH-006` | encrypted-only MJL password adapter and invitation/reset `pass IS NULL` assertions |
| `DB-004`, `LIFE-003`, `RT-011` | exact-prefix detection and complete RST-006B interruption matrix |

## Bounded nonblocking findings

The audit still records medium and low risks: password mutation method
enforcement, server-side export read failure, cron poison-row and entity
semantics, runner deadline/discovery and historical provisioning, auth-schema
exactness, deployment-specific Apache loaded state, and privacy/operator
configuration. These findings can affect later implementation or deployment,
but each is located and classified. None requires choosing a target
architecture boundary before proposal work begins.

## Gate rerun

| Gate | Result |
| --- | --- |
| application and verification populations remain classified | PASS |
| changed files re-audited and delta-manifested | PASS |
| request, database, authorization, workflow, frontend and current-architecture maps remain valid | PASS WITH RECORDED QUALIFICATIONS |
| technical Admin reset semantics resolved | PASS |
| reference transaction semantics resolved | PASS |
| encrypted-only MJL credential persistence resolved | PASS |
| RST-006B interruption recovery resolved | PASS |
| CRITICAL unresolved findings | PASS — 0 |
| HIGH unresolved architecture blockers | PASS — 0 |
| lifecycle sufficiently characterized | PASS WITH RECORDED MEDIUM RUNNER DEBT |
| authentication state sufficiently characterized | PASS |
| authorization fail-closed behavior sufficiently characterized | PASS |
| critical export and cron behavior sufficiently characterized | PASS WITH RECORDED MEDIUM RISKS |
| preservation ledger reconciled | PASS |
| regression baseline sufficient for the first architecture migration waves | PASS WITH QUALIFICATIONS |

## Required final report

```text
Starting verdict:
NOT_READY

Final verdict:
READY_FOR_PROPOSAL

HIGH findings at start:
2

HIGH findings discovered during closure:
2

HIGH findings resolved:
4

HIGH findings remaining:
0

CRITICAL findings:
0

Confirmed defects fixed:
4

False positives / audit misunderstandings closed:
0

New preservation requirements:
1

Regression tests added/updated:
focused reference, authentication and RST-006B/Phase 3A coverage

Verification suite:
PASS for all four focused corrections

Architecture gate:
PASS
```

No target-architecture proposal is included. The closure instruction reserves
that work for a separate subsequent task.
