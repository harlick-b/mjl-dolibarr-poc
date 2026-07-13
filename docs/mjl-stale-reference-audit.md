# MJL Stale Reference Audit

MJL product decisions come from `docs/mjl-authoritative-decisions.md`.

This audit classifies stale vocabulary that remains after documentation
cleanup. Zero results are not required. Code and fixture compatibility terms
were not changed in this documentation-only task.

## Classification Rules

| Classification | Meaning |
| --- | --- |
| TARGET_OK | Matches authoritative target wording. |
| TECHNICAL_DOLIBARR_TERM_OK | Technical Dolibarr explanation may use the term. |
| LEGACY_MAPPING_OK | Legacy migration/backfill/sample mapping is explicit. |
| CURRENT_STATE_EVIDENCE_OK | Current-state evidence describes existing code only. |
| FIXTURE_ONLY_OK | Local development/test fixture data only; not production guidance. |
| CLEANUP_HISTORY_OK | Deleted/merged document names appear only as cleanup records. |
| STALE_DOC_FIX | Active doc was normalized during cleanup. |
| STALE_DOC_DELETE | Stale doc was deleted. |
| CODE_LEGACY_DEBT | Code/data still contains legacy term; not fixed here. |
| AMBIGUOUS_REVIEW_REQUIRED | Needs future human review. |

## Remaining Documentation References

| File/result group | Classification | Notes |
| --- | --- | --- |
| `AGENTS.md`, `README.md`: POC/N1/N2/DPAF warnings | STALE_DOC_FIX | These are negative instructions telling agents not to follow stale concepts. |
| `docs/mjl-authoritative-decisions.md`: POC/MVP, Bailleurs, Tiers, DPAF, N1/N2 mappings, Echanges | TARGET_OK / LEGACY_MAPPING_OK / TECHNICAL_DOLIBARR_TERM_OK | The authority file uses these only to define prohibited terms, legacy mappings, or technical Dolibarr wording. |
| `CONTEXT.md`: Bailleurs/Tiers avoidance and legacy role mappings | TARGET_OK / LEGACY_MAPPING_OK / TECHNICAL_DOLIBARR_TERM_OK | Domain glossary explicitly marks these as avoid/migration-only terms. |
| `docs/mjl-current-app-functional-map.md`: POC/DPAF/Conventions current-state notes | CURRENT_STATE_EVIDENCE_OK | Describes existing implementation debt without making it target behavior. |
| `docs/mjl-current-vs-target-gap-analysis.md`: POC/DPAF/Conventions/Echanges debt | CURRENT_STATE_EVIDENCE_OK | Tracks code-vs-target debt and required next actions. |
| `docs/mjl-implementation-summary.md`: POC/DPAF/Conventions/Depenses/Echanges compatibility debt | CURRENT_STATE_EVIDENCE_OK | Summary of implemented state and known compatibility debt. |
| `docs/design-system/audit/current-ui-audit.md`, `docs/design-system/audit/current-screen-inventory.md`: DPAF/Convention notes | CURRENT_STATE_EVIDENCE_OK | UI evidence identifies labels that need future production wording cleanup. |
| `docs/design-system/*.md`: old temporary Level 1/2/3 access model | STALE_DOC_FIX | Phase 10R normalized active design-system guidance to the production role model. |
| `docs/mjl-doc-cleanup-inventory.md`, `docs/mjl-docs-index.md`: deleted doc names and stale-doc history | CLEANUP_HISTORY_OK | These are historical cleanup records, not active implementation guidance. |
| `docs/mjl-client-uat-checklist.md`, `docs/mjl-client-demo-scenario.md`, `docs/mjl-roles-permissions-matrix.md`, `docs/mjl-reports-exports-model.md`, `docs/mjl-dashboard-kpi-model.md`: Phase 12R UAT/model docs | TARGET_OK | These documents use production role and Partenaires / Programmes vocabulary and mark client decisions as pending validation. |
| `docs/prompts/mjl-feature-alignment-rebased-prompt.md`, `docs/prompts/mjl-phase-13-feature-freeze-uat-client-validation-readiness-prompt.md`: active saved prompts | STALE_DOC_FIX / LEGACY_MAPPING_OK | The prompts mention POC/MVP/Bailleurs/DPAF/N1/N2 only as prohibited concepts, legacy context, or stale-term scan examples. They are task evidence, not target wording. |
| `docs/mjl-feature-freeze-notes.md`, `docs/mjl-uat-data-readiness.md`, `docs/mjl-internal-uat-dry-run-plan.md`, `docs/mjl-internal-uat-results.md`, `docs/mjl-client-validation-pack.md`, `docs/mjl-phase-13-final-report.md`: Phase 13 readiness docs | TARGET_OK / CURRENT_STATE_EVIDENCE_OK | Phase 13 docs use production target wording; any DPAF references are fixture-login or historical test-output evidence, not target roles. |
| `tasks/lessons.md`: sample POC role lesson | LEGACY_MAPPING_OK | Durable lesson warning that sample POC roles are not production permissions. |
| `docs/agents/issue-tracker.md`: `Conventions` heading | TARGET_OK | Generic issue-tracker convention wording, unrelated to MJL funding-envelope UI terminology. |

## Remaining Code And Fixture References

| File/result group | Classification | Notes |
| --- | --- | --- |
| `custom/mjlfinancement/core/modules/modMjlFinancement.class.php`, language files | CODE_LEGACY_DEBT | Module descriptor still describes a POC. |
| `custom/mjlfinancement/scripts/bootstrap_poc.php` | LEGACY_MAPPING_OK / CODE_LEGACY_DEBT | Local bootstrap name and messages are fixture-era compatibility; not production target wording. |
| `custom/mjlfinancement/scripts/seed_sample_data.php` | LEGACY_MAPPING_OK / CODE_LEGACY_DEBT | Maps old fixture roles into production role table and still uses POC comments/labels. |
| `custom/mjlfinancement/sql/update_0.8.0.sql`, `audit_schema_0.8.0.php` | LEGACY_MAPPING_OK | Migration/backfill evidence for old POC groups. |
| `custom/mjlfinancement/lib/mjl_scope.lib.php`, `mjl_auth.lib.php`, `admin/access.php` | LEGACY_MAPPING_OK / CODE_LEGACY_DEBT | Reads legacy `MJL POC - %` Dolibarr groups for compatibility. |
| `custom/mjlfinancement/dpafdashboard.php` | LEGACY_MAPPING_OK / CODE_LEGACY_DEBT | The filename remains a compatibility route, but Phase 10R removed DPAF wording from the dashboard UI. |
| `custom/mjlfinancement/budgetlines.php`, `fundreceipts.php`, `conventions.php`, related classes | CODE_LEGACY_DEBT | Production-facing labels and some actor-role helpers still expose DPAF/Admin wording. |
| `custom/mjlfinancement/class/mjlactivity.class.php`, `activities.php`, `smoke_activity_workflow.php` | CODE_LEGACY_DEBT / LEGACY_MAPPING_OK | Legacy `SUPERVISEUR_N1`, `SUPERVISEUR_N2`, `DPAF`, and `AGENT` actor-role values remain in workflow compatibility paths. |
| `custom/mjlfinancement/roadmap.php` | CODE_LEGACY_DEBT | Internal roadmap still describes POC limits and should be retired or rewritten before production exposure. |
| `custom/mjlfinancement/sample_data/**` | FIXTURE_ONLY_OK / LEGACY_MAPPING_OK | Local development/test sample data only; not production guidance. Fixed-report fixture formats are CSV/XLSX, not PDF/Word. |
| `mjl_dolibarr_poc_sample_data/seed/*.csv` | FIXTURE_ONLY_OK / LEGACY_MAPPING_OK | External fixture package still contains legacy roles for sample import tests. Fixed-report fixture formats are CSV/XLSX, not PDF/Word. |
| `mjl_dolibarr_poc_sample_data/documents_placeholders/*.txt` | FIXTURE_ONLY_OK | Placeholder text says POC and is local fixture data only. |
| `custom/mjlfinancement/*`, report/export labels containing `Depenses` or `Dépenses` | TARGET_OK | Expense wording remains acceptable; final validation and disbursement must stay separate. |
| `custom/mjlfinancement/exchangelogs.php`, report scope `Échanges` | CODE_LEGACY_DEBT / CURRENT_STATE_EVIDENCE_OK | The route exists, but target says exchanges should be contextual or audit/supervision-only. |
| `custom/mjlfinancement/conventions.php`, navigation/report references to Conventions | CODE_LEGACY_DEBT / CURRENT_STATE_EVIDENCE_OK | Current object exists; user-facing production wording may need alignment. |
| Technical `Tiers` references in docs | TECHNICAL_DOLIBARR_TERM_OK | Allowed only in Dolibarr technical explanations. |

## Deleted Stale Documentation

The following stale result groups were removed from active documentation before
this audit pass and now appear only as cleanup history:

- numbered POC docs `docs/00-context.md` through
  `docs/15-production-menu-scope.md`;
- previous target spec and feature/deployment/readiness duplicates;
- navigation unification plans and trackers;
- implementation phase plans and trackers;
- design-system executed plans and phase compliance reports;
- duplicate generated sample-data prompt.

## Code-Level Conflicts Not Fixed

- Module descriptor/language still describes a POC.
- Bootstrap and seed scripts still create or read local fixture groups named
  `MJL POC - ...`.
- SQL migrations preserve legacy mappings for existing data.
- Some UI labels still say DPAF, Conventions, and Echanges. Phase 10R cleaned
  dashboard-facing wording but did not rename the compatibility
  `dpafdashboard.php` route.
- Sample-data CSVs and placeholder documents retain fixture-era vocabulary.
- Download/export audit coverage is broadly covered by Phase 13 E2E, but
  historical unresolved local audit rows remain data debt.

These are implementation debt to address in future source-code work.
