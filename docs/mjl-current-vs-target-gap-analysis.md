# MJL Current vs Target Gap Analysis

This file tracks implementation debt against
`docs/mjl-authoritative-decisions.md`. It is not the source of target
decisions. `docs/mjl-current-app-functional-map.md` remains current-state
evidence only.

## Summary

The active documentation now points at the authority file, durable context,
current-state map, active design docs, and the kept navigation/UI evidence. The
cleanup removed historical prompt, phase, demo, UAT, and cleanup-history docs
as active guidance. No application business logic was changed.

## Current Gaps

| Target decision | Current code/doc status | Gap status | Risk | Next action | Evidence |
| --- | --- | --- | --- | --- | --- |
| Production-ready stance, not POC/MVP | Active authority and operational docs state production-ready. Code, bootstrap scripts, module descriptors, fixture names, and some labels still contain POC or legacy wording. | CODE_LEGACY_DEBT | Fresh work can confuse compatibility names with target behavior. | Rename production-facing code labels in a future source-code phase; keep fixture-only wording classified. | `docs/mjl-authoritative-decisions.md`, `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, `custom/mjlfinancement/scripts/bootstrap_poc.php` |
| Partenaires / Programmes terminology | Active docs use Partenaires / Programmes. Some adjacent screens and code still expose technical or legacy object labels such as Conventions and DPAF. | PARTIAL | User-facing adjacent screens may still expose older vocabulary. | Audit and rename production UI labels without changing schema unless a migration is explicitly planned. | `docs/mjl-authoritative-decisions.md`, `CONTEXT.md`, `docs/mjl-current-app-functional-map.md` |
| One global role plus many Partenaires / Programmes | Role/scope helpers and tables exist; legacy Dolibarr groups still backfill fixture roles. | PARTIAL | Legacy groups can obscure the production role model. | Keep one active MJL business role per user and treat old groups as migration/fixture compatibility only. | `custom/mjlfinancement/lib/mjl_scope.lib.php`, `custom/mjlfinancement/sql/update_0.8.0.sql` |
| Final route/action permission matrix | Durable principles are consolidated in `CONTEXT.md`, but final client-approved route/action permissions are not recorded. | PENDING_CLIENT_VALIDATION | Export, audit, and advanced read permissions can be over- or under-granted if guessed. | Obtain client approval for final route/action and report-export permissions. | `CONTEXT.md`, `docs/mjl-authoritative-decisions.md` |
| Non-admin scope filtering and unresolved-scope fail-closed | Scope helpers, dashboard filters, report filters, and guarded object helpers exist. Untouched routes still need route-by-route verification. | PARTIAL | Cross-scope leakage remains possible if any custom query misses entity/scope filters. | Continue query-by-query entity and scope audits on touched routes; keep unresolved rows hidden from non-admin users. | `custom/mjlfinancement/lib/mjl_scope.lib.php`, `docs/mjl-current-app-functional-map.md` |
| Admin plateforme differs from Validateur definitif | Active docs distinguish technical administration from business validation. Some compatibility surfaces still use DPAF/Admin labels. | PARTIAL | Business validation and platform administration can be confused. | Continue replacing DPAF/Admin-facing labels on touched routes while preserving migration mappings. | `docs/mjl-authoritative-decisions.md`, `CONTEXT.md`, `custom/mjlfinancement/index.php` |
| Final validation differs from disbursement | Expense workflow has separate final validation and disbursement states. | PARTIAL | Older labels can blur activity, expense, validation, and disbursement concepts. | Verify status displays and remove misleading labels on touched screens. | `custom/mjlfinancement/class/mjlexpense.class.php`, `custom/mjlfinancement/expenses.php` |
| No self-review | Activity and expense workflow code contains no-self checks and smoke tests exist. | PARTIAL | Needs current test evidence before production claims. | Run workflow smoke/E2E checks when workflow code changes. | `custom/mjlfinancement/class/mjlactivity.class.php`, `custom/mjlfinancement/class/mjlexpense.class.php`, `docs/mjl-acceptance-tests.md` |
| Project creation/editing inside MJL | MJL project route exists with direct POST token/role guards and audit rows. | UNKNOWN_REVIEW_REQUIRED | Incorrect guards could allow or block project management. | Browser-test project create/edit for Admin plateforme and Validateur definitif. | `custom/mjlfinancement/projects.php`, `docs/mjl-current-app-functional-map.md` |
| Native Dolibarr browser boundary | Apache native guard, MJL forbidden page, and header hook exist; the kept navigation audit remains historical evidence of the original blocker. | IMPLEMENTED_PENDING_RUNTIME_EVIDENCE | If deployment config is missing, native route families can reappear. | Run native-boundary E2E and deployment config checks after environment changes. | `custom/mjlfinancement/deployment/apache-native-guard.conf`, `custom/mjlfinancement/nativeforbidden.php`, `docs/audits/mjl-navigation-design-full-audit.md` |
| Global Documents read-only and contextual uploads | Current docs state the global library is read-only and uploads are contextual. | PARTIAL | Needs browser/runtime proof for every upload entrypoint. | Verify no global upload action is exposed or accepted; verify contextual upload routes and audit rows. | `custom/mjlfinancement/documents.php`, `custom/mjlfinancement/lib/mjl_document.lib.php` |
| Guarded document downloads and audit | Guarded download route exists and download audit rows are best-effort. | PARTIAL | Raw ECM links or missing audit outside verified paths can weaken controls. | Verify all document links use `documentdownload.php` and inspect workflow audit rows. | `custom/mjlfinancement/documentdownload.php`, `custom/mjlfinancement/lib/mjl_document.lib.php` |
| Contextual exchanges, no primary Echanges menu | Contextual comments exist on detail pages; global exchange search is advanced/read-only and hidden from primary navigation. | PARTIAL | Final production permission wording and full-suite runtime evidence still need approval. | Keep exchange creation contextual and direct-route guarded. | `custom/mjlfinancement/lib/mjl_timeline.lib.php`, `custom/mjlfinancement/exchangelogs.php` |
| Reports CSV/XLSX only | Report center provides CSV/XLSX only. CSV rules remain BOM, semicolon, French headers, and stable filenames. | FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION | Generic outputs cannot be called final official templates without canevas approval. | Approve final donor/client report canevas, required columns/order, and role export rights. | `custom/mjlfinancement/reports.php`, `custom/mjlfinancement/lib/mjl_csv_export.lib.php`, `CONTEXT.md` |
| Export audit | POST-only exports add `export_generated` workflow audit rows. Generic report audit rows do not yet resolve to a Partenaire / Programme. | PARTIAL | Scoped non-admin audit views intentionally hide generic report audit rows until a report-scope model exists. | Decide whether report exports need first-class scope anchors. | `custom/mjlfinancement/reports.php`, `docs/mjl-current-app-functional-map.md` |
| Dashboard/KPI model | Durable KPI families are consolidated in `CONTEXT.md`; final labels, exposure, and risk-threshold wording remain pending. | PENDING_CLIENT_VALIDATION | Dashboard wording may be treated as final before client approval. | Obtain final KPI labels, dashboard role exposure, and risk-threshold wording. | `CONTEXT.md`, `custom/mjlfinancement/lib/mjl_dashboard.lib.php` |
| Global funding envelopes | Fund receipts can attach to active global partner/programme envelopes with nullable `fk_project`; budget lines and expenses remain project-bound. | PARTIAL | Tenants with older NOT NULL schema may reject global receipts until migration. | Run schema audit and apply the guarded SQL update when needed. | `custom/mjlfinancement/class/mjlfundreceipt.class.php`, `custom/mjlfinancement/sql/update_0.11.0.sql` |
| Finance status formulas | Central finance metrics helper exists for submitted, prevalidated, final validated, disbursed, remaining, validation rate, and execution rate. | PARTIAL | Untouched queries may still use older naming or stored-field assumptions. | Route touched finance KPI/report calculations through the finance metrics helper. | `custom/mjlfinancement/lib/mjl_finance_metrics.lib.php`, `custom/mjlfinancement/lib/mjl_reporting.lib.php` |
| Invitation-only access and no public registration | Invitation route exists and active docs forbid public registration. | PARTIAL | Runtime auth/access still needs verification before production. | Keep testing invitation flow and absence of register route in E2E. | `custom/mjlfinancement/invitation.php`, `docs/mjl-acceptance-tests.md` |
| Production deployment readiness | Deployment checklist exists, but email/base URL/secrets/final permissions remain unconfirmed. | BLOCKED | Cannot claim production release readiness. | Resolve production email/base URL/secrets, final permissions, official report templates, backup/restore rehearsal, monitoring, and log retention. | `docs/mjl-deployment-checklist.md`, `docs/mjl-production-readiness-plan.md` |

## Code-Level Conflicts Not Fixed In Documentation Cleanup

- `bootstrap_poc.php`, sample-data CSVs, SQL migrations, and local fixture names
  use POC and legacy role terms for compatibility.
- Some PHP UI labels/routes still use `DPAF`, `Conventions`, `Depenses`, or
  `Echanges`.
- Module language/descriptor strings still say POC.
- Sample document placeholders say POC.
- Download and export audit coverage is not fully proven across every path.
- Project creation/editing inside the MJL workspace requires runtime
  verification before production claims.

## Deleted-Doc Content Consolidated Here

Historical phase, client-validation, demo, UAT, role-matrix, report-model, KPI
model, implementation-summary, cleanup-history, and prompt documents were
merged into the active docs where durable. They must not be used as active
implementation guidance after this cleanup.
