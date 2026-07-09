# MJL Post-Cleanup Alignment Report

## Executive Verdict

FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION

The repository now has a clear documentation authority chain and Phase 12R
client UAT/model documents for feature acceptance. The client-facing feature
set is documented for validation, but the status remains pending because final
client permission approval, final donor/client report templates, production
configuration, and historical code/fixture vocabulary debt are not closed here.

## Gate Results

### Gate 1 - Authority Gate

PASS

The active authority chain is explicit in `docs/mjl-authoritative-decisions.md`,
`AGENTS.md`, `README.md`, and `docs/mjl-docs-index.md`.

### Gate 2 - Stale-Doc Gate

PASS

Every current documentation/guidance file in the clean inventory is classified
in `docs/mjl-doc-cleanup-inventory.md`. Deleted and merged docs appear only as
cleanup history.

### Gate 3 - Product-Decision Gate

PASS

Active target docs consistently preserve:

- production-ready, not MVP/POC;
- `Partenaires / Programmes`;
- one global business role per user;
- many Partenaires / Programmes per user;
- no role-per-Partenaire model for now;
- `AGENT_SAISIE`, `AGENT_VERIFICATEUR`, `VALIDATEUR_DEFINITIF`,
  `ADMIN_PLATEFORME`;
- `ADMIN_PLATEFORME` distinct from `VALIDATEUR_DEFINITIF`;
- `Valide definitivement` distinct from `Decaisse`;
- project creation/editing inside MJL for Admin plateforme and Validateur
  definitif;
- global Documents read-only, contextual uploads, guarded downloads;
- contextual exchanges/timelines, not a primary Echanges menu;
- CSV/XLSX reports only;
- download/export audit expected;
- no self-prevalidation, self-final-validation, or self-disbursement.

### Gate 4 - Code-Debt Visibility Gate

PASS

Known code-level conflicts are recorded in
`docs/mjl-current-vs-target-gap-analysis.md` and classified in
`docs/mjl-stale-reference-audit.md`.

### Gate 5 - Fresh-Agent Gate

PASS

A fresh Codex session reading only repository docs is routed first to
`docs/mjl-authoritative-decisions.md`, then to gap/current-state evidence. The
docs index now marks current-state docs as evidence only, reducing the risk of
mistaking implementation debt for target behavior.

## Authority Files Checked

- `AGENTS.md`
- `README.md`
- `CONTEXT.md`
- `DESIGN.md`
- `docs/mjl-authoritative-decisions.md`
- `docs/mjl-current-app-functional-map.md`
- `docs/mjl-current-vs-target-gap-analysis.md`
- `docs/mjl-docs-index.md`
- `docs/mjl-stale-reference-audit.md`

## Final Decisions Verified

- Production-ready custom MJL workspace inside Dolibarr, not POC/MVP.
- Dolibarr provides authentication, users/groups/rights, third parties,
  projects, ECM/documents, and export support.
- MJL custom code provides the client-facing workspace, scope model, activities,
  expenses, validations, documents, exchanges/timelines, dashboards, alerts,
  audit, CSV/XLSX reports, and invitations.
- User-facing scope wording is `Partenaires / Programmes`.
- Role model is one global business role per user plus one or many assigned
  scopes.
- Required roles are `AGENT_SAISIE`, `AGENT_VERIFICATEUR`,
  `VALIDATEUR_DEFINITIF`, and `ADMIN_PLATEFORME`.
- Admin plateforme and Validateur definitif are different concepts.
- Final validation and disbursement are separate workflow states.
- No self-prevalidation, self-final-validation, or self-disbursement.
- Project creation/editing belongs inside MJL for Admin plateforme and
  Validateur definitif.
- Global Documents is read-only; uploads are contextual; downloads are guarded.
- Exchanges are contextual timelines or audit/supervision views, not a primary
  menu.
- Reports are CSV/XLSX only in this phase.
- Export/download audit is expected.

## Documentation Files Kept

- Root guidance and memory: `AGENTS.md`, `README.md`, `CONTEXT.md`, `DESIGN.md`.
- MJL authority/progress/evidence/operations/testing docs under `docs/`.
- Active design-system docs and current UI evidence docs.
- Agent support docs, ADR template, local skill docs, and `tasks/lessons.md`.
- Fixture-only docs in `mjl_dolibarr_poc_sample_data`.

The full per-file inventory is in `docs/mjl-doc-cleanup-inventory.md`.

## Documentation Files Created

- `docs/mjl-post-cleanup-alignment-report.md`
- `docs/mjl-client-uat-checklist.md`
- `docs/mjl-client-demo-scenario.md`
- `docs/mjl-roles-permissions-matrix.md`
- `docs/mjl-reports-exports-model.md`
- `docs/mjl-dashboard-kpi-model.md`

## Documentation Files Updated

- `docs/mjl-docs-index.md`
- `docs/mjl-current-vs-target-gap-analysis.md`
- `docs/mjl-stale-reference-audit.md`
- `docs/mjl-implementation-summary.md`
- `docs/mjl-post-cleanup-alignment-report.md`

Earlier cleanup updated:

- `docs/mjl-doc-cleanup-inventory.md`

## Documentation Files Deleted

No files were deleted during this alignment pass. Earlier cleanup records show
the stale/deleted groups in `docs/mjl-docs-index.md`.

## Documentation Files Merged Before Deletion

Earlier cleanup records identify these merged-and-deleted groups:

- `docs/mjl-target-client-spec.md`
- `docs/mjl-financement-feature-coverage.md`
- `docs/mjl-financement-production-deployment.md`
- `docs/mjl-financement-production-readiness.md`
- `docs/design-system/00_DESIGN_SYSTEM_PLAN.md`
- `docs/design-system/IMPLEMENTED_UI_RECAP_FOR_DESIGN_AGENT.md`
- `docs/design-system/MJL_CURRENT_NAVIGATION_STRUCTURE_FOR_AGENT.md`
- `docs/design-system/MJL_TEMPORARY_ACCESS_MODEL.md`

## Superseded Files Retained And Why

None. The current index records no superseded-but-retained files.

## Stale References Found

- Documentation warnings and legacy mappings for POC/DPAF/N1/N2 terms.
- Current-state evidence noting DPAF/Conventions/Echanges code debt.
- PHP routes, labels, helpers, module descriptors, and language strings using
  POC/DPAF/N1/N2-era vocabulary.
- SQL migrations and scripts preserving legacy mappings.
- Local fixture package data and placeholder documents using POC-era terms.

## Stale References Fixed

Documentation classification was tightened so stale references are no longer
unclassified broad summaries. The active target docs did not require product
decision rewrites during this pass.

## Remaining Stale References And Classification

Detailed classifications are in `docs/mjl-stale-reference-audit.md`:

- `CODE_LEGACY_DEBT`: production-facing code labels/routes/helpers still using
  DPAF, Conventions, Echanges, or POC wording.
- `LEGACY_MAPPING_OK`: bootstrap, seed, migration, and backfill paths that map
  old POC groups/roles to production roles.
- `FIXTURE_ONLY_OK`: local fixture package CSVs and placeholder documents.
- `CURRENT_STATE_EVIDENCE_OK`: current-state docs describing existing code debt.
- `CLEANUP_HISTORY_OK`: deleted doc names appearing only as cleanup records.
- `TECHNICAL_DOLIBARR_TERM_OK`: technical Dolibarr terms in explanatory docs.

## Broken References Fixed

No broken active implementation references were found in this pass. References
to deleted docs remain only as cleanup history in inventory/index/audit files.

## Code-Level Debts Discovered But Not Fixed

- POC wording in module descriptors, language files, bootstrap scripts, and
  fixture/sample data.
- DPAF/Admin wording in several UI labels and actor-role helpers.
- Legacy `SUPERVISEUR_N1`, `SUPERVISEUR_N2`, `DPAF`, `AGENT`, and `LECTEUR`
  actor-role values in compatibility paths.
- `Conventions` and `Echanges` routes/labels still need production wording and
  UX alignment.
- `roadmap.php` still describes POC limits and should not be production-facing.
- Download/export audit coverage is not fully proven across all paths.
- Project create/edit inside MJL still needs runtime verification.
- Production permission matrix, official report templates, email/base URL,
  secrets, storage, backup, restore, and deployment rehearsal remain blockers.

## Documentation Risks

- Future work can regress if agents read current-state evidence without the
  authority chain; the docs index and AGENTS instructions now reduce this risk.
- Fixture packages and compatibility code still contain POC-era vocabulary;
  they must remain clearly classified until renamed or retired.
- A production readiness claim would be premature until runtime verification and
  deployment blockers are resolved.

## Validation Commands

Validation commands and results from the latest Phase 12R pass:

- `git status --short --untracked-files=all`: current worktree includes
  Phase 10R/11R handoff changes and Phase 12R documentation/support-script
  changes.
- `git diff --check`: passed.
- `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`:
  passed.
- `npm run test:e2e`: passed with 125 tests after rerunning outside the
  sandbox because the specs execute Docker commands.
- `seed_sample_data.php`: passed.
- `acceptance_sample_data.php`: passed after aligning the script to current
  committed-vs-spent budget semantics.
- `smoke_scope_model.php`: passed.
- `smoke_activity_workflow.php`: passed.
- `smoke_expense_validation.php`: passed.
- `smoke_traceability_exports.php`: passed.
- `audit_schema_0.2.0.php`: passed.
- `audit_schema_0.3.0.php`: passed after aligning the script to current
  committed-vs-spent budget semantics.
- `audit_schema_0.4.0.php`: passed.
- `audit_schema_0.5.0.php`: passed.
- `audit_schema_0.8.0.php`: passed with legacy lecteur warnings.
- `audit_schema_0.9.0.php`: passed.
- `audit_schema_0.10.0.php`: passed.
- `audit_unresolved_scope.php`: failed on local workflow-action rows pointing
  to deleted test objects and generic report audit anchors; classified as
  existing local verification data debt.
- `check_production_readiness.php`: source-provable checks passed; production
  email transport, public base URL, production secrets, backup/restore, and
  monitoring/log retention remain `UNKNOWN`.

Earlier cleanup validation also ran:

- `git status --short`: pending documentation-only changes at that time.
- Raw `find` documentation inventory: completed with expected permission-denied
  noise under `data/`.
- Clean documentation inventory excluding `data`, `.git`, `vendor`, and
  `node_modules`: completed.
- Stale-term scan over requested paths: completed; remaining results
  classified.
- Expanded stale-term scan over `mjl_dolibarr_poc_sample_data`: completed;
  remaining results classified as fixture-only/legacy mapping.
- Deleted/stale doc reference scan: completed; remaining results are cleanup
  history only.
- Authority/reference scan: completed; active docs point to authority/gap/current
  evidence.
- Markdown lint: skipped because `markdownlint` is not installed locally.

## Phase 12R Client UAT Pack

Phase 12R created the client UAT checklist, demo scenario, roles/permissions
matrix, reports/exports model, and dashboard KPI model. These documents are
current implementation and acceptance artifacts, not final client approval of
permissions, KPI wording, or donor report templates.

Phase 12R also aligned sample-data acceptance and 0.3.0 schema audit scripts
with the current finance model: `committed_amount` is the budget-consuming
validated amount, while `spent_amount` is the disbursed amount.

## Recommended Next Implementation Phase

Run client UAT using the Phase 12R pack, then run a source-code production
wording and traceability phase:

1. Rename production-facing DPAF/POC/N1/N2 labels while preserving explicit
   migration compatibility.
2. Verify and complete download/export audit coverage.
3. Browser-test project create/edit inside MJL for Admin plateforme and
   Validateur definitif.
4. Confirm final permission matrix and official CSV/XLSX report templates with
   the client.
5. Run the relevant E2E, smoke, and schema checks from
   `docs/mjl-acceptance-tests.md`.
