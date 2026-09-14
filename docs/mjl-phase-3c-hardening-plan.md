# Phase 3C Hardening and Integration-Readiness Draft

Status: **DRAFT — RST-013E and RST-015 remain `PENDING_APPROVAL`**.

Authority: the canonical v2 documents routed by
`docs/mjl-authoritative-decisions.md`. Historical implementation prompts are
context only. This draft authorizes no implementation or production launch.

## Goal and verdict boundary

Phase 3C will harden the implemented core through Phase 3B and decide whether
it is ready for integration. Its verdict is exactly one of
`CORE_SCOPE_READY_FOR_INTEGRATION`, `CORE_SCOPE_READY_WITH_NOTES`, or
`CORE_SCOPE_BLOCKED`, followed by: `This verdict does not authorize production
launch.` The client and project owner retain the Phase 4–6 go-live decision.

## Fresh inventory and corrections

- The shared tenant is now the empty RST-012 target; Phase 3B functionality and
  its hourly reconciler are active.
- `custom/mjlfinancement/scripts/check_production_readiness.php` is absent, so
  `npm run audit:production-readiness` currently provisions a disposable tenant
  and then fails at an absent entrypoint.
- The manifest also names absent `scripts/verification/runner.php`,
  `tests/contracts/verification_runner_test.php`, and
  `tests/unit/verification-entrypoints.test.js`. A separate verification
  framework is unnecessary: the maintained seam is
  `tests/runner/run-suite.js` plus current unit/E2E suites.
- `custom/mjlfinancement/roadmap.php` is intentionally removed and guarded as
  absent. Phase 3C must keep roadmap authority in documentation and must not
  recreate a browser roadmap.
- `docs/mjl-production-readiness-plan.md` and
  `docs/mjl-deployment-checklist.md` contain stale expenses/disbursement,
  Partenaire/Programme, Admin business-management, document, and output claims.
  RST-015 must replace these with the canonical Phase 3B core boundary.

The reset manifest is amended alongside this draft to record the real seams and
the files that must remain absent. Both units remain approval-gated.

## RST-015 — read-only readiness model rewrite

Implement one CLI-only `check_production_readiness.php` diagnostic, invoked by
the existing disposable runner. It reads configuration and installed state but
does not change constants, users, business data, documents, jobs, or schema.

Its machine-readable result contains only named control status
(`OK`, `UNKNOWN`, or `BLOCKED`) and a final Phase 3C verdict. It must not print
secret values. Controls cover exact RST-012 schema and empty-start behavior,
module/native-route containment, active-entity guards, invitation-only access,
Porto-Novo timezone, XOF/French configuration, enabled unique reconciler,
base URL, mail transport, session/error/logging posture, persistent storage,
backup/restore evidence, and the signed accessibility gate. Missing
environment/client decisions remain `UNKNOWN` or `BLOCKED`; they are never
fabricated as passes.

Verdict rules must distinguish integration controls from production/release
controls. Unsigned human accessibility, final mail/base URL values, and other
client-owned release settings remain visible blockers for release without
forcing a technically sound local core to `CORE_SCOPE_BLOCKED`. A failed
authorization, isolation, schema, data-integrity, teardown, or restore control
does block the Phase 3C integration verdict.

Rewrite the readiness plan, deployment checklist, acceptance guide, coverage
registry, and package command description around that result. Keep the removed
roadmap route absent. Produce a client-owned Phase 4–6 matrix with columns for
input availability, go-live requirement, dependency, blocker, owner, decision
date, and status; initialize undecided client fields as `Needs confirmation`.

## RST-013E — disposable verification reset

Add a `phase3c` runner mode that uses the current RST-012 clean installation
and existing disposable isolation, secret registry, shared-evidence comparison,
and unconditional teardown. Do not introduce another runner.

The gate must prove:

- startup creates no business/sample records and retains no generated report;
- direct authorization and POST guards cover all four roles, no-role,
  unassigned/removed Agents, contributor separation, entity isolation, stale
  versions, CSRF, replay, and malformed identifiers;
- current database/service guards preserve role uniqueness, immutable
  revisions/audit/export evidence, balanced submissions, nullable spending,
  valid transitions, one pending request of each type, optimistic locking,
  stable references, and cancellation amounts;
- the reconciler uses Africa/Porto-Novo, is unique, bounded, idempotent,
  retryable after failure, and creates no duplicate transition evidence;
- database plus implemented document/config storage can be backed up and
  restored into a new disposable project, preserving identifiers, revisions,
  audit, requests, export evidence, and exact RST-012 verification;
- current Phase 3B bounded-volume performance, accessibility smoke,
  responsive/no-JavaScript behavior, export recovery, and error paths remain
  green.

Reuse current public commands where they already prove a rule. Add cases only
for uncovered behavior; do not duplicate Phase 1–3B matrices or recreate
retired suites. Signed human accessibility remains a separate release gate.

## Acceptance and rollback

Required committed-source gates are PHP syntax checks for new PHP, Node syntax
checks for runner changes, `npm run test:unit`, repaired `npm run test:phase2`,
`npm run audit:production-readiness`, the new `npm run test:phase3c`,
`npm run test:verify`, and `npm test`. Each container-backed command must prove
shared-state equality, secret-free evidence, and complete teardown.

Before implementation, capture the Phase 3B source commit, sanitized
configuration control names, and runner configuration digest. Rollback restores
only RST-013E/RST-015 source and documentation. It changes no shared business
rows or configuration. Any restore rehearsal is restricted to a new disposable
project; shared restore requires separate explicit authorization.

Approval must name both `RST-013E` and `RST-015`. Approval of this draft does
not authorize Phase 4, 5, 6, production deployment, persistent sample data, or
shared restoration.

## Review closure

The planning review found no need for a second runner, a web roadmap, shared
test data, or shared restore machinery. The protected assets are credentials,
configuration, business rows, audit/export evidence, and document storage;
the trust boundaries are public/authenticated HTTP, CLI-only operations, the
active entity, disposable Compose projects, and the shared local tenant.

The implementation review must reject any diagnostic reachable over HTTP,
secret-bearing output, UI-only permission assertion, cross-entity query,
unguarded document path, retained disposable resource, or restore into the
shared tenant. The acceptance section above covers these risks through the
existing operational-script boundary, direct URL/POST cases, entity/role
matrices, secret scan, before/after shared evidence, and exact teardown. The
remaining confirmations are the separately approved implementation scope and
the client-owned production settings; neither is inferred by this draft.
