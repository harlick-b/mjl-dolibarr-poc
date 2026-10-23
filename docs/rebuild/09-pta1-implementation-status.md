# PTA-1 Implementation Status

Status: **PTA_1_COMPLETE** on 2026-10-23. This records development evidence for
the user-authorized synthetic slice; it is not application acceptance,
compliance evidence or production readiness.

## Implemented boundary

Migration `0005_pta1` adds `auth_audit.business`, the singleton
`mjl_ownership_context`, and seven planning tables for Partners, Operation types,
Projects, annual PTAs, draft Activities, Operations and current Agent coordination
assignments. It creates no user or business seed data. A restricted CLI provisions
the single `MJL` context with one transactional audit.

The FastAPI router implements sixteen responsibilities: nine reads and seven
mutations. Collections use the DEC-102 cursor envelope. Server-established
relationships enforce the singleton context and ancestry; clients cannot submit a
context. Mutations recheck current session, role and state under the transaction,
use advisory/row locks, validate expected versions, write bounded exact business
audit facts atomically, and preserve request-key replay behavior.

The React application adds `/partners`, `/projects`,
`/projects/$projectId/ptas/$year`, its new-Activity route, and
`/activities/$activityId`. TanStack Router owns route/search state and TanStack
Query owns remote state. The French UI provides loading, empty, error, modal,
mobile and keyboard behavior, invalidates affected planning queries, masks stale
data when authorization is lost, and never queues offline mutations.

Activity assignments are coordination metadata. An unassigned Agent can still
read and edit drafts. Supervisor and Validator can replace the Agent coordination
set but cannot structurally edit Activities. No reviewer-assignment model, review
action, approval status or general workflow was added.

## Design and cutover gates

I1 froze the approved field limits, positive integer XOF representation,
date-only `+3 calendar months` clamp, cursor and request-key contracts, exact
bounded audit shapes, and the v3 planning visual mapping before affected code was
enabled.

The A2.2/A3 guard now accepts only the exact `0005_pta1` relation, constraint,
index and column manifest (digest
`65c3559d5276d42175e40bf664a884706afe4c6b9591e91f88c85a3b6df9b614`).
Missing, extra or weakened schema and a missing/different ownership context fail
closed. Current assignments block ordinary-account lifecycle changes; the exact
PTA schema still permits A3 reset while invalidating obsolete sessions.

C1 used the exact candidate backend image on a fresh `mjl_test_pta1_c1` database
with separate migrator, provisioning-operator and runtime credentials. The
predecessor had revision `0004_a3` and eight relations. Offline migration produced
revision `0005_pta1` and sixteen relations. Two restricted provisioning calls left
one context and one success audit. The runtime guard and readiness passed; both
operator and runtime roles lacked schema `CREATE`; the runtime served only on a
loopback verification port. The C1 database, roles, container, policy and mailbox
were task-owned disposable resources and were removed after evidence capture.

## Verification

All **24/24 P01–P24 checks passed**:

- P01–P10 cover provisioning, ancestry, automatic annual PTA creation,
  concurrency, replay, Project closure, invalid planning and exact XOF bounds.
- P11–P15 cover calendar clamping, the role/action matrix, coordination
  assignments, version conflicts, contributors and the absence of approval.
- P16–P19 inject audit, constraint and commit failures and exercise deterministic
  lifecycle, role, reset, login and OTP transaction races with immediate obsolete
  session denial.
- P20–P24 cover generated OpenAPI/cursors, the React journey and accessibility
  states, Query invalidation, stale-result masking, offline/lost-response behavior,
  exact-artifact cutover, guard failure modes and A1–A3 regressions.

Final suites recorded 55 focused PTA-1 PostgreSQL cases, 255 combined A1–A3 plus
PTA-1 PostgreSQL cases, 38 frontend unit cases, and the focused PTA-1 Playwright
journey. Ruff lint/format, mypy, ESLint, Prettier, Stylelint, Vite/PWA build and
repository whitespace checks passed.

The mandatory independent engineering reviewer and independent
security/specification reviewer each inspected the implementation rather than
trusting implementer reports. Their findings drove fixes to authorization-matrix
coverage, failure injection, exact removed-operation audit facts, Query refresh,
stale-result masking and dialog behavior. The same reviewers passed the corrected
tree on re-review.

PC1 and PC2 remain pending. Only synthetic identities and disposable isolated
resources are permitted. Real-account enablement, production deployment,
Activity reviewer assignments/actions, approval workflow, technical Admin
recovery, and all later PTA/A4 work remain deferred.
