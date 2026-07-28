---
transfer:
  method: MANUAL_USER_COPY
  transfer_date: "2026-07-28"
  source_project: proj-design
  source_generation: v2
  source_relative_path: outputs/mjl-financement/generations/v2/transfer/
  destination_path: docs/design-system/approved/v2/
  authorization_decision: PD-DEC-030
  authorization_verdict: MJL_V2_DOCUMENTATION_TRANSFER_AUTHORIZED
  documentation_transfer: AUTHORIZED
  documentation_transfer_status: COMPLETED
  agent_performed_transfer: false
  ui_implementation: NOT_AUTHORIZED
  application_changes: NOT_AUTHORIZED

approval:
  design_package: APPROVED
  approval_decision: PD-DEC-029
  package_status: READY_WITH_ASSUMPTIONS

assumptions:
  count: 8
  ids:
    - ASM-002
    - ASM-003
    - ASM-005
    - ASM-006
    - ASM-008
    - ASM-009
    - ASM-010
    - ASM-011

release_blocker:
  identifier: FACT-001
  exact_summary: >-
    The unresolved-scope integrity failure remains an implementation and
    release-readiness blocker and must be resolved before production approval.

immutability:
  approved_v2_copy: REQUIRED
  material_corrections_require_new_generation: true
---

# MJL Financement v2 Documentation Transfer Authorization

## Record

The user manually copied approved MJL Financement design generation v2 into
`docs/design-system/approved/v2/`. The target repository records the transfer
on 2026-07-28. This date is the target-side transfer and registration date; the
agent did not independently attest an external copy timestamp.

The original `proj-design` generation v2 remains the canonical generation and
approval record. This target record relies on the user-supplied approval
decision `PD-DEC-029` and transfer authorization decision `PD-DEC-030`, with
verdict `MJL_V2_DOCUMENTATION_TRANSFER_AUTHORIZED`. The agent did not access
`proj-design`, did not perform the copy, and did not verify byte-for-byte
identity against the external source.

Target-side validation confirms the copied package identifies MJL Financement
generation v2, records user approval, and has package status
`READY_WITH_ASSUMPTIONS`.

## Documentation-Only Scope

This authorization registers documentation only. It does not authorize:

- UI implementation or application-code changes;
- changes to PHP, templates, CSS, JavaScript, assets, or dependencies;
- route, API, authentication, email, permission, or active-entity changes;
- workflow, approval, no-self-action, business-rule, or database changes;
- export, report-contract, audit, test, environment, deployment, or runtime
  configuration changes;
- skill or dependency installation;
- execution of commands recorded in the immutable snapshot.

## Active Assumptions

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

These remain assumptions for later readiness and implementation planning. They
must not be reclassified as confirmed requirements.

## Release Blocker

`FACT-001` is the approved package's traceability identifier for the
unresolved-scope integrity audit. The package defines no separate `RB-*`
identifier.

> The unresolved-scope integrity failure remains an implementation and
> release-readiness blocker and must be resolved before production approval.

Design approval and documentation transfer do not resolve this blocker or
authorize an implementation to bypass it.

## Immutability and Chronology

The copied v2 directory is an immutable target-side reference. It must not be
edited, normalized, reformatted, regenerated, or corrected locally. A material
change to the product definition, design direction, assumptions, decisions,
tokens, components, or implementation guidance requires a new generation in
`proj-design`, such as v3.

The generation-time manifest and validation report record manual review as
pending. The later immutable `MANUAL-REVIEW.md` records user approval. That
manual review records target documentation transfer as unauthorized at the time
of design approval; the later user-supplied `PD-DEC-030` authorizes this manual
documentation transfer. This chronology does not authorize UI implementation
or application changes.
