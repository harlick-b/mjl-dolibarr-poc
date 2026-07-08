# MJL Current vs Target Gap Analysis

This gap analysis is based on `docs/mjl-current-app-functional-map.md` and the
target decisions in `docs/mjl-target-client-spec.md`.

## Summary

The current app is a strong POC with guarded documents, activity and expense
workflows, dashboards, reports, exports, invitations, and audit helpers. The
main production gaps are role/scope normalization, partner/programme scoping,
project creation inside MJL, physical execution tracking, split
prevalidation/final-validation/disbursement workflows, contextual timelines,
download/export audit, and production readiness checks.

## Gap matrix

| Area | Current state | Target state | Required phase |
| --- | --- | --- | --- |
| Roles | POC groups such as AGENT, SUPERVISEUR_N1, SUPERVISEUR_N2, DPAF, ADMIN | Four global production business roles | Phase 1, Phase 2 |
| Scope | Ownership/reviewer/supervision helpers; no normalized user-to-partner scope | One global role and many assigned Partenaires / Programmes | Phase 1 |
| Admin vs validation | DPAF/Admin concepts mixed in helpers and labels | Admin plateforme separate from Validateur definitif | Phase 1, Phase 2 |
| Projects | MJL project list/detail exists; creation remains native/outside wrapper | Create/edit projects inside MJL for Admin plateforme and Validateur definitif | Phase 3 |
| Partenaires / Programmes | Native third parties used through conventions/funds | Dedicated scoped workspace page using `llx_societe` | Phase 3 |
| Funding envelopes | Conventions exist with POC labels | Enveloppes de financement terminology and partner/programme scope | Phase 3 |
| Activities | One-step validation-oriented workflow | Prevalidation, final validation, execution status, physical progress | Phase 4 |
| Expenses | One-step validation; no separate disbursement state | Prevalidation, final validation, disbursement, amount separation | Phase 5 |
| Documents | Contextual upload and guarded download exist; download audit incomplete | Contextual only, scoped lists, guarded download audit | Phase 6 |
| Exchanges | Hidden/advanced exchange log, activity-focused | Contextual timelines on object details; global search under audit only | Phase 6 |
| Alerts | Computed alerts for deadlines, pending review, missing evidence | Production role/scope alerts for workflow, budget, execution, and funding risk | Phase 7 |
| Reports/exports | Fixed CSV/XLSX reports; final official columns not confirmed | Scoped production CSV/XLSX reports, export audit | Phase 7 |
| Production checks | Readiness docs exist; runtime checks are incomplete | Admin-only readiness script/page with config and deployment checks | Phase 8 |
| Acceptance tests | Existing E2E suite covers POC workflows | Full production role/scope/workflow acceptance scenarios | Phase 9 |

## Compatibility risks

- Existing activity and expense `status` columns are integer-based. Later
  phases must not destructively repurpose these values.
- Existing POC users/groups may not map cleanly to production roles. Backfill
  must log unresolved users and avoid broad non-admin access.
- Existing projects may not have a direct partner/programme relationship.
  Object resolution must use conventions or other safe links and fail closed
  for non-admin users when unresolved.
- Current docs may lag code. Runtime behavior must be verified before marking a
  row complete.

