# MJL Phase 14.9 Demo Data Hygiene

Target decisions come from `docs/mjl-authoritative-decisions.md`. This note
classifies remaining local/test vocabulary after the Phase 14.9 demo UI polish
pass.

## Verdict

`DEMO_DATA_READY_WITH_NOTES`

The production-facing UI labels touched in Phase 14.9 now prefer
`Enveloppe de financement`, `Partenaire / Programme`, `Fonds reçus`,
`Historique / Audit`, and production role wording. Remaining legacy terms are
fixture, compatibility, route, class, table, migration, or negative-test
guardrails and should not be presented as production terminology.

## Fixture-Only Data

- `dpaf.mjl`, `superviseur.n1`, `superviseur.n2`, `MJL POC - ...`, and
  `MJL_POC_DEFAULT_PASSWORD` remain local fixture/test compatibility names.
- Sample records with `CONV-*`, `PTF-*`, or titles containing `Convention`
  remain seed data identifiers and are not production wording approval.
- Placeholder documents that say `POC placeholder document` remain local test
  fixtures only.

## Compatibility Debt

- Route filenames such as `conventions.php`, `dpafdashboard.php`, and
  `exchangelogs.php` remain compatibility debt.
- Technical class names, table names, DB fields, report keys, migration names,
  and object types still use `MjlConvention` / `mjlfinancement_convention`.
- Legacy actor-role values such as `DPAF`, `SUPERVISEUR_N1`, and
  `SUPERVISEUR_N2` remain in compatibility mappings and tests.

## Demo Notes

- Do not show raw seed CSVs, migration files, fixture usernames, or technical
  route names as production evidence.
- Use the MJL workspace pages for the demo, not native Dolibarr screens.
- Global Documents remains read-only; uploads remain contextual.
- The expected Phase 14.9 verdict remains `DEMO_UI_READY_WITH_NOTES`, not
  client approval or production release readiness.
