# MJL Financement v2 — Assumption Assessment

## Status

This is an implementation-readiness assessment, not a final resolution. All
eight assumptions from the immutable
[approved assumption record](../design-system/approved/v2/docs/design/design-assumptions.md)
remain visible.

Baseline: `main` at `e8bfb15b5c1f359f45824ff14f7d72e869386587`.
Working-tree overlay at audit start: none.

## Assessments

### ASM-002 — Donor/client report canevas, columns, order, and role-by-report rights remain provisional

- Current wording: “Those report-specific decisions are pending even though
  the export format invariants are authoritative.”
- Design impact: official report content, ordering, selection summaries, and
  role presentation cannot be finalized.
- Repository evidence: the generic report center implements 16 report keys,
  scoped previews, CSV/XLSX, and audited exports; active authority keeps final
  canevas and permissions pending.
- Test evidence: existing E2E files cover generic report access, filtering,
  filenames, CSV/XLSX structure, and audit. They were not rerun in this audit.
- Runtime evidence: not newly executed.
- Resolution status: `STILL_UNRESOLVED`
- Evidence classification: `APPROVED_DESIGN`, `CONFIRMED_PROJECT_DECISION`,
  `COMMITTED_IMPLEMENTATION`, `DOCUMENTED_HISTORICAL_RESULT`
- Confidence: HIGH
- Implementation consequence: preserve generic exports; block
  donor-specific templates and final role-by-report UI.
- Remaining decision: client approves each canevas and report-right matrix.
- Blocking scope: `BLOCKS_SPECIFIC_PHASE`
- Conservative default: no donor-specific template and no inferred right.

### ASM-003 — Production email, URL, secrets, backup/restore, monitoring, and rehearsal are unconfirmed and block release readiness

- Current wording: “No operational sign-off evidence was supplied.
  Unconfirmed does not mean unconfigured.”
- Design impact: auth/email designs can be implemented, but delivery,
  recovery, support, and production claims cannot be accepted.
- Repository evidence: deployment/readiness docs and
  `check_production_readiness.php` identify all five items as operator
  confirmations; no production values are committed.
- Test evidence: local E2E tests cover captured email content, not production
  transport or operations. They were not rerun.
- Runtime evidence: none for production.
- Resolution status: `STILL_UNRESOLVED`
- Evidence classification: `APPROVED_DESIGN`, `UNRESOLVED`
- Confidence: HIGH
- Implementation consequence: presentation work may proceed; release remains
  blocked.
- Remaining decision: operations/security evidence and sign-off.
- Blocking scope: `BLOCKS_RELEASE`
- Conservative default: local configuration is not production evidence.

### ASM-005 — Responsive layouts, keyboard operation, screen-reader behavior, contrast, and 200% zoom remain unproven

- Current wording: “The reported suite has no dedicated viewport, keyboard,
  axe, contrast, or zoom checks.”
- Design impact: shell, tables, forms, dialogs, dashboards, and auth may need
  revision after runtime validation.
- Repository evidence: CSS has 980px and 720px adaptations and selected focus
  rules, but no accessible drawer, skip access, complete focus contract, or
  full state behavior.
- Test evidence: the 130 current E2E tests contain no dedicated viewport,
  keyboard, accessibility-engine, screen-reader, contrast, or zoom journey.
- Runtime evidence: none newly executed.
- Resolution status: `STILL_UNRESOLVED`
- Evidence classification: `APPROVED_DESIGN`, `IMPLEMENTATION_OBSERVATION`
- Confidence: HIGH
- Implementation consequence: accessibility must be integrated from Phase 1
  and proven at Phase 4/5 gates.
- Remaining decision: automated and human responsive/accessibility matrix.
- Blocking scope: `BLOCKS_SPECIFIC_PHASE`
- Conservative default: make no WCAG or mobile-usability claim.

### ASM-006 — Final brand assets, formal tokens, palette approval, and icon policy remain pending

- Current wording: “Current visual patterns are confirmed, but final brand
  governance is not.”
- Design impact: brand-facing values remain replaceable.
- Repository evidence: current CSS and approved v2 share the main palette,
  Arial/Helvetica, compact density, and Dolibarr pictos; approved semantic
  tokens are not implemented as CSS variables.
- Test evidence: no current visual-regression or implemented contrast test.
- Runtime evidence: none newly executed.
- Resolution status: `SUPPORTED_BUT_NOT_CONFIRMED`
- Evidence classification: `APPROVED_DESIGN`,
  `CONFIRMED_IMPLEMENTATION_FACT`, `ASSUMPTION`
- Confidence: MEDIUM
- Implementation consequence: map the current values to semantic tokens and
  preserve replacement points.
- Remaining decision: client brand, palette, contrast, and icon approval.
- Blocking scope: `NON_BLOCKING`
- Conservative default: retain current palette/type/pictos; add no icon
  library.

### ASM-008 — Whether user-facing inline document preview or removal should be introduced remains unresolved

- Current wording: “Neither action currently exists, and no approval to add it
  was supplied.”
- Design impact: document components must not imply preview or deletion.
- Repository evidence: global Documents is read-only; uploads are contextual;
  guarded/audited downloads exist; no user preview/removal route exists.
- Test evidence: existing E2E covers guarded downloads, unsafe access,
  contextual uploads, and missing/unavailable states. It was not rerun.
- Runtime evidence: none newly executed.
- Resolution status: `STILL_UNRESOLVED`
- Evidence classification: `CONFIRMED_PROJECT_DECISION`,
  `COMMITTED_IMPLEMENTATION`, `TEST_SUPPORTED`, `UNRESOLVED`
- Confidence: HIGH
- Implementation consequence: consolidate existing document behavior only.
- Remaining decision: separately approve or reject preview and removal,
  including permission and audit rules.
- Blocking scope: `NON_BLOCKING`
- Conservative default: introduce neither capability.

### ASM-009 — General French microcopy may still require client review

- Current wording: “Protected terminology is authoritative, but other labels
  and messages are not finally signed off.”
- Design impact: non-protected wording remains reviewable.
- Repository evidence: protected terminology is active, but unaccented,
  legacy, compatibility, POC, and technical wording remains on some
  production-facing surfaces.
- Test evidence: some E2E checks exclude legacy dashboard/report wording; no
  complete content review exists.
- Runtime evidence: none newly executed.
- Resolution status: `STILL_UNRESOLVED`
- Evidence classification: `CONFIRMED_PROJECT_DECISION`,
  `COMMITTED_IMPLEMENTATION`, `ASSUMPTION`
- Confidence: MEDIUM
- Implementation consequence: fix wording with its journey/component, not as
  isolated label-only work.
- Remaining decision: client content review outside protected terminology.
- Blocking scope: `NON_BLOCKING`
- Conservative default: formal French, protected terms, no technical leakage.

### ASM-010 — A future dedicated read-only audit overlay remains unapproved

- Current wording: “Four production roles are authoritative; existing
  generic/legacy read-only mechanisms do not establish a fifth product role.”
- Design impact: navigation, audit tables, and exports cannot be designed for
  a fifth role.
- Repository evidence: generic readonly compatibility and a legacy `LECTEUR`
  fixture exist; advanced audit/search pages are guarded for current
  supervision capabilities.
- Test evidence: existing E2E verifies legacy reader restrictions on several
  journeys; it was not rerun.
- Runtime evidence: none newly executed.
- Resolution status: `STILL_UNRESOLVED`
- Evidence classification: `CONFIRMED_PROJECT_DECISION`,
  `COMMITTED_IMPLEMENTATION`, `UNRESOLVED`
- Confidence: HIGH
- Implementation consequence: preserve four roles and current guarded audit
  behavior; defer an overlay.
- Remaining decision: capability, scope, navigation, and export model within
  the four-role boundary.
- Blocking scope: `BLOCKS_SPECIFIC_PHASE`
- Conservative default: no fifth role or new overlay.

### ASM-011 — Desktop-first design, tablet/mobile adaptation, and no offline mode are valid targets; actual mobile/tablet usability and usage conditions remain unproven

- Current wording: “Browser mix, data volume, connectivity, usage frequency,
  and current mobile/tablet usability are unknown.”
- Design impact: breakpoints, table transformation, action priority, and
  performance thresholds remain subject to evidence.
- Repository evidence: desktop shell and two responsive CSS breakpoints exist;
  no offline feature or service worker was found.
- Test evidence: no dedicated viewport or device journey exists.
- Runtime evidence: none newly executed.
- Resolution status: `SUPPORTED_BUT_NOT_CONFIRMED`
- Evidence classification: `APPROVED_DESIGN`,
  `CONFIRMED_IMPLEMENTATION_FACT`, `ASSUMPTION`
- Confidence: MEDIUM
- Implementation consequence: implement desktop-first progressive adaptation,
  then validate 390/768/1024/1366 widths and representative data volumes.
- Remaining decision: device/browser/data-volume research and runtime testing.
- Blocking scope: `BLOCKS_SPECIFIC_PHASE`
- Conservative default: consultation and priority actions on small screens;
  no offline mode or assumed full mobile parity.

## FACT-001 relationship

`FACT-001` is not one of the eight remaining assumptions. Its exact approved
meaning is that unresolved scope must fail closed and that the unresolved-scope
integrity audit is failing.

Current reproduction used:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/audit_unresolved_scope.php
```

The script body contains `SELECT` queries and reporting logic. It returned 368
`workflow_action_without_resolvable_target` rows. The repository working tree
did not change. Transitive side effects of Dolibarr bootstrap were not
exhaustively proven.

Inspected aggregate `SELECT` evidence then established:

- 132 `mjlfinancement_report` audit rows have existing report targets and are
  false positives caused by the validator omitting the report-table join.
- 236 rows still lack supported targets: 94 convention events, 65 expense
  document events, 5 fund-receipt events, and 72 project events.

Status: open. Confidence: HIGH. The issue requires a validator correction,
separate investigation/remediation of genuine unresolved rows, and a clean
rerun. It blocks the integrity/release gate, not safe presentation-only shared
foundation work.
