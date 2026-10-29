# PTA-3B implementation status

## Contract

DEC-116 authorizes synthetic disbursement authorization only. An Agent submits
the server-calculated finalized actual spending for a completed Activity; one
eligible Supervisor prevalidates and one distinct eligible Validator grants the
final administrative authorization. A returned request remains frozen until an
Agent cancels it with a reason, corrects the execution facts and submits a fresh
request. Approval records no payment or movement of funds.

Zero-total and insufficient-budget settlement, external payment/virement
confirmation, reversement, formal Activity closure, documents, notifications,
real accounts and production remain excluded.

## Implemented

- Migration `0011_pta3b` adds dedicated request and immutable decision tables,
  one-open-request enforcement, immutable basis/cancellation facts, and deferred
  transaction-level validation of the initial submitted state, snapshot total,
  submission/decision chronology, same-request prevalidation, cancellation
  chronology and distinct final reviewers.
- Five REST responsibilities provide cursor-paginated history, detail, Agent
  submission/cancellation and Supervisor/Validator decisions. The server owns
  amount calculation, role/resource checks, Activity versions, advisory-lock
  ordering and atomic audit.
- Submission verifies the approved revision, exact active Operation membership,
  final execution facts and the complete ordered execution/approval audit chain.
  It independently reconciles every approved revision decision with its approval
  audit before evaluating historical allocations.
  Missing or inconsistent history, current or historical overspending, incomplete
  Operations, stale commands and paused/inactive Activities fail closed.
- A noncancelled request freezes execution changes and planning amendments. Both
  read projections remove controls that cannot succeed and the execution view
  explains the freeze. Cancellation releases those seams; final approval keeps
  them frozen. Existing assignment coordination remains available.
- The French realization workspace shows amount, review progress, reasons,
  history and the freeze explanation. Router owns financial request selection
  and pagination; Query loads exact request detail, reconciles execution/planning
  state, and aborts and clears protected mutations on access loss. The interface
  explicitly says authorization does not mean payment occurred.

## Verification evidence

`PTA_3B_COMPLETE` on 2026-10-29.

- Final combined disposable PostgreSQL regression: **537 passed** in 1908.18
  seconds. Three dependency deprecation warnings remain non-blocking.
- Corrected focused PTA-3B PostgreSQL run: **28 passed** in 177.21 seconds.
  Coverage includes deterministic races, all mutation rollback failure classes,
  CSRF/role denials, stale cancellation, individual zero spending with a positive
  Activity total, frozen projections, missing revision-approval evidence and
  malformed initial/chronological database writes.
- Exact predecessor: image built from
  `9a5a726bd9d6efc6b9af9f5a371745f7325a4f5a` created approved PTA-3A execution
  history. The corrected candidate migration changed `0010_pta3a` to
  `0011_pta3b`, retained
  identical Activity (`2ac500d9268d6caa0d0ef22a4ed40d49`), Operation
  (`63a1a5f6ea2d9e9c96a72ae4c289532a`), revision
  (`f1407dc4926e3379eb335e69168c4876`) and audit
  (`9afbfceffede22e7ff1aa8f2377ff9be`) hashes, and created zero request/decision
  rows. The exact predecessor runtime refused the successor schema with
  `eligibility_unverified`. This oracle was rerun after the review corrections.
- Clean downgrade/re-upgrade generated exact schema fingerprint
  `3ea526420792d3057d00be796854045a1332a91afec7a2c0ee7e430b41edcb07`;
  financial evidence refuses destructive downgrade. Existing malformed-schema
  and candidate-guard cases pass, including replacement of the audit-immutability
  function while leaving its trigger definition intact.
- Backend Ruff lint/format and mypy passed. Frontend ESLint, Stylelint and
  Prettier passed; **48 Vitest tests** and the Vite/PWA production build passed
  with the existing chunk-size warning.
- Three real-Chrome journeys passed, including Agent submission, Supervisor
  return, reasoned cancellation, fresh submission, prevalidation, distinct final
  authorization, financial history pagination, PTA-3A
  correction, offline behavior and session invalidation.

The first independent engineering and security/specification reviews found
blocking gaps in the candidate. The implementer corrected them and returned the
candidate to the same reviewers. Both final read-only re-reviews passed with no
blocking, high or material medium findings.

PC1/PC2 remain pending. Synthetic identities and disposable resources only;
real accounts and production are prohibited. No later slice is authorized.
