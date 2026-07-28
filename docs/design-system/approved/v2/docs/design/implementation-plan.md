# MJL Financement — Framework-Neutral Implementation Plan

Status: documentation only; implementation `NOT_AUTHORIZED`

## Confirmed technical fit

The future implementation may target the existing server-rendered Dolibarr 23.0.2/PHP custom module, custom CSS/JavaScript, reusable PHP helpers, Dolibarr pictos, MariaDB-backed business behavior, and Playwright-led UI journeys. This plan does not assume React, Tailwind, shadcn, a new component library, or a framework migration.

## Protected boundary

Do not change routes, APIs, schema, Dolibarr core, permission checks, role/scope rules, no-self-action, workflow transitions, business rules, document guards, export contracts, or audit behavior. Any such change needs a separate product/technical decision and implementation plan.

## Migration sequence

1. **Baseline and regression map**
   - Start from the user-reported baseline of 127 E2E passed, 1 failed, and 2 not run; resolve the failing unresolved-scope integrity audit and account for every not-run check.
   - Verify current routes, the pending role/action and role-by-report details, workflows, data volumes, and browser targets.
   - Capture desktop/tablet/mobile, keyboard, zoom, contrast, and screen-reader findings.
   - Establish rollback checkpoints without changing business behavior.

2. **Token mapping**
   - Map neutral base/semantic tokens to CSS custom properties or the existing styling mechanism inside approved custom boundaries.
   - Preserve the confirmed current values initially; mark final brand approval and formal token/icon policy as pending.
   - Add automated token reference and contrast checks.

3. **Shell and primitives**
   - Consolidate shell, page header, navigation, focus, buttons, fields, status badges, alerts, dialogs, loading, and empty/error states.
   - Verify direct-route and POST enforcement independently of visibility.

4. **Tables, search, filters, and exports**
   - Apply density, hierarchy, pagination, scoped filters, no-result recovery, responsive transformations, and export-selection summaries.
   - Preserve synchronous server-side POST/token exports, CSV/XLSX-only output, BOM, semicolon separation, French headers, stable filenames, and audit.

5. **Complex forms and decisions**
   - Group activity/expense/financing forms, distinguish draft from submission, add summaries/inline errors, preserve values, and use stage-specific confirmations.
   - Validate correction, rejection, prevalidation, final validation, and disbursement separately.

6. **Details, documents, and history**
   - Consolidate object summaries, document checklist/list, guarded links, comments, workflow events, and timelines.
   - Preserve read-only Global Documents, contextual upload, guarded/audited download, and non-disclosing missing/forbidden behavior.
   - Do not introduce inline preview or removal without an explicit capability, authorization, and audit decision.

7. **Role dashboards and supervision**
   - Prioritize role queues and actionable KPI blocks with scope, period, definition, freshness, and drill-down.
   - Degrade failed cards locally and avoid decorative charts.

8. **Authentication, invitations, and emails**
   - Apply consistent French content, non-enumerating recovery, token/account states, session expiry, and mobile/plain-text email structure.
   - Do not claim production delivery until transport/public URL configuration is verified.

9. **Responsive and accessibility hardening**
   - Test 390, 768, 1024, and 1366 review widths; 200% zoom; keyboard; focus order/restoration; screen reader; contrast; reflow; status messages; and reduced motion.
   - Treat automated tools as support, not conformance proof.

10. **End-to-end acceptance**
    - Run role/scope, activity, expense/disbursement, financing, document, report/export, invitation/auth, forbidden/not-found, empty/loading/partial-error, and responsive journeys.
    - Obtain client approval for branding, permissions, reports, wording, and any new capability before release.
    - Do not declare release readiness until production email, URL, secrets, backup/restore, monitoring, rehearsal, and all failing/not-run checks have evidence and sign-off.

## Regression protection

- Maintain route- and POST-level authorization tests.
- Preserve workflow actor-independence and distinct disbursement.
- Test scope tampering returns no data.
- Verify guarded documents and export audit.
- Snapshot semantic token resolution and critical contrast pairs.
- Test component states, not only happy paths.

## Rollback

Introduce changes in reversible slices behind the existing route/business contracts. Each slice must be independently revertible without schema rollback. Preserve the prior styling/helpers until its replacement passes role, workflow, accessibility, and responsive checks. A failed slice restores presentation only; it must not rewrite business data or permissions.
