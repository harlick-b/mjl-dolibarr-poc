# MJL Financement v2 — Implementation-Readiness Audit

## Executive summary

- Audit baseline: `main` at
  `e8bfb15b5c1f359f45824ff14f7d72e869386587`
- Working-tree overlay at audit start: none
- Approved design: MJL Financement generation v2, approved,
  `READY_WITH_ASSUMPTIONS`
- Approved snapshot tree:
  `98d0053a934b83b4a21a6c67207e86b3c89fe7d0`
- Implementation readiness: `READY_WITH_PHASE_BLOCKERS`
- Release readiness: `BLOCKED`

The repository has a strong incremental foundation: a custom-module boundary,
a consistent MJL shell, centralized role/scope helpers, guarded routes,
contextual documents, audited CSV/XLSX exports, role dashboards, and tested
activity/expense/finance journeys. The approved v2 direction fits the current
server-rendered PHP/Dolibarr architecture and does not require a rewrite.

The principal implementation work is consolidation: semantic tokens, shared
headers/actions/forms/statuses/tables/system states/timelines, then
journey-level adoption. The main blockers are scoped rather than universal:
official report canevas and rights, responsive/accessibility proof, the
unapproved audit overlay, production operations evidence, and `FACT-001`.

All eight assumptions remain active. Two are supported by current
implementation facts but not confirmed decisions; none may be silently
removed. `FACT-001` remains open. Current runtime evidence separates a
132-row validator defect from 236 genuinely unresolved workflow targets.

Recommended approach: incremental consolidation in the custom module,
preserving routes, permissions, workflows, documents, exports, database
meanings, and E2E-covered behavior. The first implementation candidate is
Phase 1, shared visual foundation and application shell. It remains
unauthorized until separately approved.

## Separate readiness assessments

```yaml
implementation_readiness:
  status: READY_WITH_PHASE_BLOCKERS
  blockers:
    - GAP-021: donor/client report canevas and role-by-report rights
    - GAP-025: responsive evidence before responsive-hardening exit
    - GAP-026: accessibility evidence before accessibility/integration exit
    - GAP-028: dedicated read-only audit overlay decision
    - GAP-029: FACT-001 before integrity/release exit

release_readiness:
  status: BLOCKED
  blockers:
    - FACT-001 unresolved-scope integrity failure
    - ASM-002 final official report canevas and rights
    - ASM-003 production email, URL, secrets, backup/restore, monitoring, and rehearsal
    - ASM-005 runtime responsive and accessibility evidence
    - final client permission confirmations
```

No finding is `BLOCKS_IMPLEMENTATION`: safe, presentation-only shared
foundation work can begin after separate authorization. This does not
downgrade release or later-phase blockers.

## Authority and conflicts

The audit applied this order: direct current task, approved v2 decisions,
active MJL business authority, protected contracts, committed implementation,
tests, working-tree overlay, active documentation, historical documentation,
assumptions, general preference.

Material conflicts:

1. The active design README and transfer record describe `FACT-001` as an
   “implementation and release-readiness blocker”; the approved assumption
   record says to treat the failing audit as a release blocker; the current
   task explicitly requires independent implementation/release assessment.
   Current evidence supports `BLOCKS_SPECIFIC_PHASE`: Phase 1 presentation work
   is independent, while integrity and release gates remain blocked.
2. Older navigation/design evidence contains historical problems and
   DPAF/N1/N2 wording. Active authority and current implementation supersede
   those terms; the old audit remains historical evidence only.
3. Current code contains compatibility identifiers and status labels. They are
   implementation debt, not permission to change the four-role model or
   workflow meanings.

## Approved target versus current implementation

| Classification | Summary | Evidence |
| --- | --- | --- |
| Aligned | Custom module, native boundary, primary IA, four-role scope model, invitation-only access, contextual uploads, guarded downloads, contextual exchanges, separate final validation/disbursement, CSV/XLSX contracts | `CONFIRMED_PROJECT_DECISION`, `COMMITTED_IMPLEMENTATION`, `TEST_SUPPORTED`; HIGH |
| Partially aligned | Shell, headers, navigation semantics, tokens/focus, forms, tables, timelines, dashboards, auth states, emails, responsive CSS | `APPROVED_DESIGN`, `COMMITTED_IMPLEMENTATION`; HIGH |
| Misaligned | Legacy focus color, raw database errors, compatibility/POC wording on user-facing paths, technical audit density, implicit table truncation | `IMPLEMENTATION_OBSERVATION`; HIGH |
| Missing | Shared error summary, confirmation dialog, pagination, local loading/partial-error patterns, complete accessibility/responsive validation | `APPROVED_DESIGN`, `IMPLEMENTATION_OBSERVATION`; HIGH |
| Blocked | Report canevas/rights, production operations, audit overlay, integrity/release gate | `ASSUMPTION`, `UNRESOLVED`, `RUNTIME_VALIDATED`; HIGH |
| Deferred | Document preview/removal, fifth/audit role, offline mode, donor-specific outputs until decisions exist | `CONFIRMED_PROJECT_DECISION`, `ASSUMPTION`; HIGH |

Detailed classifications are in the
[gap matrix](mjl-design-system-v2-gap-matrix.md).

## Protected invariants

| Invariant | Status | Evidence and consequence |
| --- | --- | --- |
| MJL remains a custom Dolibarr module | Confirmed and implemented | Only custom/supporting repository paths are tracked; `COMMITTED_IMPLEMENTATION`, HIGH. Preserve. |
| Dolibarr core is not modified | Confirmed and implemented | Application code is under `custom/mjlfinancement`; `COMMITTED_IMPLEMENTATION`, HIGH. |
| Native Dolibarr UI remains hidden | Confirmed and implemented | Header hook, Apache guard, MJL forbidden page, and native-boundary E2E exist; `TEST_SUPPORTED`, HIGH. Deployment configuration still requires release verification. |
| MJL shell remains consistent | Confirmed and implemented | Every module page invokes the shared shell; `COMMITTED_IMPLEMENTATION`, HIGH. Consolidate without route changes. |
| Project creation/editing limited to authorized roles | Confirmed and implemented | MJL project route has token, capability, and scope checks; historical E2E exists; `TEST_SUPPORTED`, MEDIUM because not rerun. |
| `Historique des validations` terminology/location | Confirmed and implemented | Navigation and page title align under Supervision; `COMMITTED_IMPLEMENTATION`, HIGH. |
| `Partenaires / Programmes` terminology | Confirmed and implemented with adjacent debt | Primary IA is correct; compatibility/technical wording remains elsewhere; HIGH. |
| `Validé définitivement` differs from `Décaissé` | Confirmed and implemented | Separate expense states, amounts, actors, dates, and E2E journey; HIGH. Remove misleading compatibility wording only. |
| Global Documents read-only | Confirmed and implemented | Global route exposes filters/downloads, no upload; `COMMITTED_IMPLEMENTATION`, HIGH. |
| Document uploads contextual | Confirmed and implemented | Activity/expense/convention/receipt paths; `TEST_SUPPORTED`, HIGH. |
| Reports Excel/XLSX-first | Confirmed and implemented | CSV/XLSX only; no PDF/Word feature; HIGH. |
| Routes and permissions protected | Confirmed but partially verified | Central guards and extensive tests exist; final client matrix remains unresolved; HIGH for mechanisms, LOW for final policy. |
| Workflow meanings and no-self-action protected | Confirmed and implemented | Classes, access helpers, and E2E evidence; HIGH. |
| Database-field meanings protected | Confirmed and implemented | Current object classes/metrics distinguish submitted, prevalidated, final-validated, and disbursed values; HIGH. |
| Export contracts protected | Confirmed and implemented | BOM, semicolon, French headers, stable names, server filtering, audit; HIGH. |
| Existing tested business behavior protected | Confirmed | 130 journey tests exist, but current execution was intentionally skipped; `DOCUMENTED_HISTORICAL_RESULT`, MEDIUM. |
| Unresolved permissions not invented | Confirmed target; partially implemented | Compatibility readonly behavior exists, but no fifth role is exposed as approved; HIGH. |

## Audit dimensions

| Dimension | Assessment |
| --- | --- |
| Product structure / IA | Primary sections align with v2 and no primary Échanges item exists. Deep-page breadcrumbs and contextual hierarchy are incomplete. |
| Application shell | Shared across all MJL pages and technically feasible to deepen. Utility-header, action-slot, drawer, and current-location semantics need consolidation. |
| Visual foundation | Current palette/type/density substantially align. Literal CSS, legacy focus color, incomplete focus coverage, and provisional brand status remain. |
| Shared patterns | Strong recurring classes exist, but PHP renderers are duplicated across page files. Consolidate existing helpers before creating new abstractions. |
| Forms | Native semantics and labels exist. Error summaries, inline recovery, optional/required language, long-form grouping, and consequential confirmation are inconsistent. |
| Tables / operational data | Dense wrappers are common. Fixed limits hide pagination; sorting/search/counts and distinct filtered/error states are uneven. |
| Dashboards | Role-aware and actionable with scoped filters. Definition, freshness, local failures, and cross-card consistency need improvement. |
| Workflows / statuses | Business transitions are strong. Presentation maps are duplicated, and state domains are not centrally distinguished. |
| Permission presentation | Actions/navigation are capability-aware and routes enforce access. Unified read-only/forbidden/unavailable presentation is incomplete; final matrix is unresolved. |
| Authentication / communication | Invitation, recovery, workflow emails, and neutral wording exist. Token/account/session variants and mobile/plain-text email proof need consolidation. |
| Responsive behavior | Two CSS breakpoints exist. No drawer, table strategy, device research, or viewport/zoom evidence exists. Full mobile parity is not assumed. |
| Accessibility | Some semantic HTML and focus styling exist. Skip access, complete keyboard/focus, live states, dialogs, contrast, reflow, zoom, and screen-reader evidence are missing. No conformance claim is made. |
| Content / localization | French-first and protected terminology are established. Accents, compatibility labels, raw errors, and POC/technical wording need journey-level cleanup. |
| Technical feasibility | High. Existing PHP helpers and CSS can be incrementally deepened. React, Tailwind, shadcn, a new icon system, and rewrite are unnecessary. |

## Technical readiness

| Area | Readiness | Required treatment |
| --- | --- | --- |
| Architecture | Ready | Stay inside custom module; preserve backend contracts. |
| Token integration | Ready with assumption | Introduce semantic CSS variables mapped initially to current values. |
| Shared shell | Ready | Extend navigation/shell helpers in a reversible slice. |
| Shared components | Ready with consolidation | Deepen existing helpers; avoid a parallel component system. |
| Navigation | Ready | Add semantics and responsive behavior without inferring access. |
| Forms | Ready with regression risk | Centralize presentation only; retain POST payloads and validation. |
| Tables | Ready with scale work | Add server pagination and states without weakening scope filters. |
| Dashboards | Ready | Preserve formulas, role queues, filters, and drill-down contracts. |
| Authentication | Ready with security guardrails | Preserve native auth/invitation/token behavior and non-enumeration. |
| Emails | Implementation-ready; release-blocked | Consolidate templates, but do not claim production delivery. |
| Responsive | Phase-blocked at exit | Implement incrementally, then obtain runtime evidence. |
| Accessibility | Phase-blocked at exit | Integrate continuously and validate with automated plus human checks. |
| Testing | Strong journey base; stale runtime result | Reuse 130 tests selectively; add responsive/accessibility journeys; full suite at integration gates. |
| Rollback | Ready | Presentation-only commits/slices, no schema rollback, retain prior helper until gate passes. |

## FACT-001 assessment

- Identifier: `FACT-001`
- Exact approved rule: unresolved scope must fail closed; the unresolved-scope
  integrity audit is failing.
- Sources:
  [approved assumptions](../design-system/approved/v2/docs/design/design-assumptions.md),
  [active design README](../design-system/README.md), and
  [transfer authorization](../design-system/TRANSFER-AUTHORIZATION.md).
- Original evidence: user-reported runtime snapshot of 127 E2E passed, one
  failed, two not run; unresolved-scope audit failed.
- Affected data: workflow audit anchors for convention, expense, fund receipt,
  project, and report objects.
- Current reproduction:
  `docker compose exec -T dolibarr php
  /var/www/html/custom/mjlfinancement/scripts/audit_unresolved_scope.php`
- Direct-script safety: the inspected body uses `SELECT` and output only.
  Transitive Dolibarr bootstrap effects were not exhaustively proven.
- Current result: failed with 368 target findings.
- Corrected aggregate interpretation:
  - 132 existing report anchors are validator false positives;
  - 236 targets are genuinely unresolved in the current local dataset:
    94 convention, 65 expense, 5 fund-receipt, and 72 project events.
- Status: open.
- Implementation impact: does not block presentation-only Phase 1; blocks the
  integrity/release exit and any claim that advanced audit history is clean.
- Release impact: blocks release.
- Required remediation:
  1. make the validator recognize all supported target types, including reports;
  2. define intentional tombstone/history behavior for deleted parent objects;
  3. investigate and remediate or formally retain the 236 genuine unresolved rows;
  4. rerun the corrected validator and related scope/audit journeys.
- Recommended phase: start as a separate Phase 0 track; close at Phase 5.
- Evidence: `RUNTIME_VALIDATED`, `COMMITTED_IMPLEMENTATION`; HIGH.

This audit does not authorize the validator fix or data remediation.

## Risks

| Risk | Level | Control |
| --- | --- | --- |
| Business-rule regression | High | Presentation-only interfaces, journey tests, no status/transition changes. |
| Permission exposure | Critical | Direct URL/POST tests and scope-tampering tests remain mandatory; visibility never authorizes. |
| Navigation regression | High | Preserve capability data source and native-boundary tests. |
| CSS leakage | High | Scope tokens/components under MJL/auth boundaries; phase-by-phase visual review. |
| Dolibarr core coupling | High | No core edits; use module hooks/templates/custom CSS only. |
| Data-density regression | Medium | Preserve compact desktop tables and measure representative row/column sets. |
| Responsive regression | High | Explicit viewport, zoom, table, drawer, and touch scenarios. |
| Accessibility regression | High | Keyboard/focus/error/status checks in every phase plus human gate. |
| Test-suite noise | Medium | Targeted specs per slice; full suite only at integration gates. |
| Release-blocker bypass | Critical | Separate readiness fields and keep GAP-021/024/025/026/029 visible. |
| Uncommitted-work risk | Low at baseline | Baseline is clean; recapture before each authorized implementation phase. |

## Audit limitations

- No E2E, schema, smoke, seed, migration, or mutable browser journey was run.
- The 130-test inventory is current repository evidence, not a newly passing
  baseline.
- No runtime screenshot, screen-reader, keyboard, zoom, contrast, mobile,
  cross-browser, performance, or production email validation was performed.
- The local database is development/test state; its 236 genuine unresolved
  workflow targets do not establish production data condition.
- The approved package's external `proj-design` source was not accessed or
  byte-compared; target-side transfer evidence is relied upon.
- No working-tree overlay existed at audit start.
- Client decisions remain unresolved for report canevas/rights, final
  permission details, branding, microcopy, document preview/removal, audit
  overlay, and device/usage conditions.

## Invalidation

This audit is tied to the baseline commit, clean overlay, approved generation
v2, the eight assumption states, and the current `FACT-001` evidence. It
becomes stale after v3, protected-rule/permission/workflow changes, a material
shell redesign, `FACT-001` resolution/reclassification, or more than a small
implementation delta before Phase 1. Use a delta review for a limited scoped
change.
