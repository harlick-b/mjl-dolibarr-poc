# PTA-3E implementation status

## Implemented boundary

DEC-119 authorizes synthetic reversement declaration only. After the current
external-virement confirmation, MJL derives
`max(0, approved Activity allocation - final spending)`. An active Agent records
one external return for the exact positive server-owned amount, its effective date
and an optional reference/comment. Reasoned date/note corrections append immutable
revisions. A zero result is settled without a declaration or audit row. MJL does
not execute or independently verify banking activity.

Migration `0014_pta3e` adds one append-only declaration table and freezes later
PTA-3D confirmation corrections once reversement begins. Three REST
responsibilities provide declaration, correction and cursor history. The existing
French realization workspace shows the reconciliation, zero/positive states,
Agent controls and read-only reviewer evidence. Advisory-lock ordering, Activity
versions, current-role/CSRF/origin checks, exact schema provenance, transactional
audit, absolute cursor links and online-only Query reconciliation are retained.

Partial or different amounts, instalments, discrepancy or insufficiency handling,
declaration cancellation, formal Activity closure, documents, notifications,
banking integration, real accounts and production remain excluded.

## Verification evidence

`PTA_3E_COMPLETE` on 2026-10-30.

- The tested final backend image is
  `sha256:2396dd1ec3d001bafe175bf32131e5d50de4c4e1b1e2761a93346c5206927c1c`.
  The disposable-PostgreSQL focused module passed **20 tests** in 177.50
  seconds. It covers the exact formula and zero/overspend cases, server-owned XOF,
  Agent-only authorization, Admin/reviewer/origin/CSRF/resource/inactive denials,
  absolute bidirectional cursor history, immutable corrections, stale financial
  and confirmation bases, schema tamper, audit/constraint/commit rollback,
  deterministic declaration/confirmation/deactivation races and destructive
  downgrade refusal.
- The exact final-candidate backend regression passed **597 tests** in 2785.01
  seconds. Its three warnings are existing Starlette/httpx and OpenAPI-validator
  deprecations. Backend Ruff lint/format and mypy passed.
- Migration compatibility used the byte-identical `0013_pta3d` predecessor from
  `4cd704a`. Existing facts survived upgrade, zero reversement rows were seeded,
  and the first valid declaration succeeded. The exact predecessor image
  `sha256:c704062295538e8ed54d3118c38a5774f15f67cea6268efd20f60979fe10775d`
  rejected the successor schema with `409 eligibility_unverified`.
- Frontend ESLint, Stylelint, Prettier, **55 Vitest tests** and the Vite/PWA build
  passed; the build retains the existing chunk-size warning. Three focused
  real-Chromium journeys passed, including positive/zero reconciliation,
  declaration, correction/history, reviewer read-only behavior and offline
  non-replay.
- The independent reviewer initially found four blocking API-contract and
  evidence gaps. After correction, the same reviewer independently reran the
  focused PostgreSQL module (**20 passed** in 163.51 seconds), inspected the diff
  and issued PASS with no remaining blocking finding or mandatory evidence gap.

PC1/PC2 remain pending. Only synthetic identities, test mail and task-owned
disposable resources were used. Real accounts and production remain prohibited;
no later slice is authorized.
