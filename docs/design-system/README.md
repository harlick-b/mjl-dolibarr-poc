# MJL Financement Design System

## Status

- Active approved design generation: v2.
- Design package: approved.
- Package status: `READY_WITH_ASSUMPTIONS`.
- Documentation transfer: authorized through user-supplied decision
  `PD-DEC-030`.
- Documentation transfer: completed manually by the user.
- UI implementation: separately authorized and completed through Phase 3.
- Application-code changes: separately authorized and completed through
  Phase 3.
- Phase 3 post-remediation evidence: current in
  `docs/implementation/mjl-design-system-v2-phase3-implementation-report.md`.
- Release readiness: blocked by unresolved-scope history, unsigned manual
  accessibility evidence, and outstanding production/operator confirmations.

This registration changes no application behavior. It does not establish
runtime accessibility conformance or production readiness.

## Authority

MJL business rules, permissions, workflows, and product meaning remain governed
by [`docs/mjl-authoritative-decisions.md`](../mjl-authoritative-decisions.md).
Within that boundary, the original `proj-design` generation v2 is the canonical
generation and approval record.

[`approved/v2/`](approved/v2/) is the immutable target-side reference copy.
This README is the active target-side entry point. The copied snapshot must not
be edited. Any material correction to its product definition, design direction,
assumptions, decisions, tokens, components, or implementation guidance requires
a new design generation, such as v3.

The older unversioned documents in this directory remain supporting guidance or
current-state evidence. They are not a second approved generated package and do
not override approved v2.

## Design Context Relationship

[`docs/design-context.md`](../design-context.md) is the evidence, requirements,
assumptions, and current-state context supplied as input to design generation.
Approved v2 is the generated and user-approved design output. They are related
but are not interchangeable.

Updating the context does not automatically alter approved v2. A material
context change may require a new generation. The context must not be merged
into or used to edit the immutable approved snapshot.

## Authoritative Paths

- [Product definition](approved/v2/PRODUCT.md)
- [Design system](approved/v2/DESIGN.md)
- [Design manifest](approved/v2/design-manifest.yaml)
- [Manual review](approved/v2/MANUAL-REVIEW.md)
- [Design assumptions](approved/v2/docs/design/design-assumptions.md)
- [Design decisions](approved/v2/docs/design/design-decisions.md)
- [Product model](approved/v2/docs/design/product-model.md)
- [Interaction flows](approved/v2/docs/design/interaction-flows.md)
- [Component inventory](approved/v2/docs/design/component-inventory.md)
- [Framework-neutral implementation plan](approved/v2/docs/design/implementation-plan.md)
- [Design validation report](approved/v2/docs/design/design-validation-report.md)
- [Base tokens](approved/v2/design-tokens/tokens.json)
- [Semantic tokens](approved/v2/design-tokens/semantic-tokens.json)
- [Token documentation](approved/v2/design-tokens/README.md)

## Active Assumptions

These eight assumptions remain active inputs for implementation-readiness
review and implementation planning. They are not confirmed business rules,
permissions, security guarantees, accessibility claims, or evidence of release
readiness.

- `ASM-002` — Donor/client report canevas, columns, order, and role-by-report
  rights remain provisional.
- `ASM-003` — Production email, URL, secrets, backup/restore, monitoring, and
  rehearsal are unconfirmed and block release readiness.
- `ASM-005` — Responsive layouts, keyboard operation, screen-reader behavior,
  contrast, and 200% zoom remain unproven.
- `ASM-006` — Final brand assets, formal tokens, palette approval, and icon
  policy remain pending.
- `ASM-008` — Whether user-facing inline document preview or removal should be
  introduced remains unresolved.
- `ASM-009` — General French microcopy may still require client review.
- `ASM-010` — A future dedicated read-only audit overlay remains unapproved.
- `ASM-011` — Desktop-first design, tablet/mobile adaptation, and no offline
  mode are valid targets; actual mobile/tablet usability and usage conditions
  remain unproven.

## Release Blocker

Traceability identifier: `FACT-001`.

> The unresolved-scope integrity failure remains an implementation and
> release-readiness blocker and must be resolved before production approval.

`FACT-001` is the approved package's authoritative traceability record for the
failing unresolved-scope audit. The package defines no separate `RB-*` blocker
identifier.

Design approval did not resolve this blocker. Documentation transfer did not
resolve it. It remains a release-readiness blocker, and UI implementation must
not silently bypass it.

## Usage Rules

- v2 is the approved design reference for future work.
- The package does not change current application behavior.
- The framework-neutral implementation plan is documentation only.
- The approved token files remain immutable documentation. Application mappings
  implemented through separately authorized phases remain code-owned.
- Skills recommendations authorize no installation or command execution.
- Routes and direct-request guards remain protected.
- Permissions and active-entity scope remain protected.
- Workflows, no-self-action, and approval logic remain protected.
- Business rules and database meanings remain protected.
- Export and report contracts remain protected.
- Existing tested behavior remains protected.
- Permission and audit rules must not be inferred from visual recommendations.
- Runtime accessibility conformance is not established by documentation alone.
- Production release remains blocked until the unresolved-scope integrity
  failure is resolved, alongside all other applicable readiness blockers.

## Chronological Authorization Note

Generation-time entries in the immutable manifest and validation report record
manual review as pending. The later immutable
[`MANUAL-REVIEW.md`](approved/v2/MANUAL-REVIEW.md) records the user's design
approval through user-supplied decision `PD-DEC-029`.

That manual review may show target documentation transfer as unauthorized
because it records the governance state when v2 was approved. The later
user-supplied decision `PD-DEC-030` authorized documentation transfer, which
was completed manually. The former standalone transfer-authorization record is
retained in Git history.

This is a chronological governance sequence, not a contradiction.
`PD-DEC-029` and `PD-DEC-030` did not authorize UI implementation or
application changes; later phase-specific user authorizations permitted
implementation through Phase 3. They do not authorize Phase 4, Phase 5,
production deployment, or release.
