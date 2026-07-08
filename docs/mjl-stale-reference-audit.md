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
| STALE_DOC_FIX | Active doc was normalized during cleanup. |
| STALE_DOC_DELETE | Stale doc was deleted. |
| CODE_LEGACY_DEBT | Code/data still contains legacy term; not fixed here. |
| AMBIGUOUS_REVIEW_REQUIRED | Needs future human review. |

## Remaining Stale-Term Classifications

| Term/pattern | Locations | Classification | Notes |
| --- | --- | --- | --- |
| `DPAF` | PHP routes/labels/helpers including `dpafdashboard.php`, `reports.php`, `conventions.php`, `exchangelogs.php`; SQL backfill; sample CSVs; docs that classify legacy terms | CODE_LEGACY_DEBT / LEGACY_MAPPING_OK | Route and labels are implementation debt; SQL/sample mappings are valid migration fixtures. |
| `SUPERVISEUR_N1`, `SUPERVISEUR_N2`, `N1`, `N2` | Bootstrap, seed scripts, SQL update `0.8.0`, sample CSVs, exchange actor-role options | LEGACY_MAPPING_OK / CODE_LEGACY_DEBT | Valid where mapping old fixture roles; actor-role UI/options remain code debt. |
| `MJL POC`, `POC` | Bootstrap/local fixture names, module descriptor/language, sample placeholders, sample-data package, stale-term audit itself | LEGACY_MAPPING_OK / CODE_LEGACY_DEBT / CURRENT_STATE_EVIDENCE_OK | Local fixture compatibility remains; production docs no longer use POC as product stance. |
| `MVP` | Deleted legacy docs or fixture background only after cleanup | STALE_DOC_DELETE | No active target guidance should use MVP. |
| `Bailleurs / Programmes` | Deleted docs only after cleanup | STALE_DOC_DELETE | Target term is `Partenaires / Programmes`. |
| `Tiers` | Technical Dolibarr explanations in authority/context/current-state docs | TECHNICAL_DOLIBARR_TERM_OK | Avoid in normal user-facing wording. |
| `Conventions` | Code route/labels, sample data, technical object docs | CODE_LEGACY_DEBT / CURRENT_STATE_EVIDENCE_OK | Current object exists; user-facing terminology may need future alignment. |
| `Depenses` / `Dépenses` | Code labels/routes/reports and docs describing current surfaces | TARGET_OK / CURRENT_STATE_EVIDENCE_OK | Expense wording is still acceptable; disbursement must remain separate. |
| `Echanges` / `Échanges` | Hidden exchange route, reports, current-state docs, audit | CODE_LEGACY_DEBT / CURRENT_STATE_EVIDENCE_OK | Route exists; target forbids primary top-level menu exposure. |
| `role per Tiers`, `role-per-Tiers` | No active references expected after cleanup | STALE_DOC_DELETE | Target is one global role plus many scopes. |

## Deleted Stale Documentation

The following stale result groups were removed from active documentation:

- numbered POC docs `docs/00-context.md` through `docs/15-production-menu-scope.md`;
- previous target spec and feature/deployment/readiness duplicates;
- navigation unification plans and trackers;
- implementation phase plans and trackers;
- design-system executed plans and phase compliance reports;
- duplicate generated sample-data prompt.

## Code-Level Conflicts Not Fixed

- Module descriptor/language still describes a POC.
- Bootstrap and seed scripts still create local fixture groups named
  `MJL POC - ...`.
- SQL migrations preserve legacy mappings for existing data.
- Some UI labels still say DPAF, Conventions, and Echanges.
- Sample-data CSVs and placeholder documents retain fixture-era vocabulary.

These are implementation debt to address in future source-code work.
