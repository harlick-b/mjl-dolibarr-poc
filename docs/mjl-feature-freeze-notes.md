# MJL Feature Freeze Notes

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Freeze status

Feature scope is frozen after 12R.

No new features are allowed before client validation.

Allowed changes:

- blocker fixes;
- high-priority UAT fixes;
- wording fixes;
- report column fixes;
- permission/scope bug fixes;
- workflow bug fixes;
- dashboard KPI bug fixes;
- test fixes;
- documentation corrections.

Not allowed:

- new modules;
- new workflow concepts;
- new report families unless replacing broken required reports;
- PDF/Word reports;
- SMS/OCR/bank API/public partner portal/offline mode;
- production infrastructure closure.

## Baseline result

Status at Phase 13 entry: `FEATURE_ALIGNED_PENDING_CLIENT_VALIDATION`.

Baseline checks completed on July 13, 2026:

- `git status --short --untracked-files=all`: only the new Phase 13 prompt was untracked at baseline.
- `git diff --check`: passed.
- `find custom/mjlfinancement -name "*.php" -print0 | xargs -0 -n1 php -l`: passed for all MJL PHP files.
- `npm run`: confirmed only `test:e2e` is available.
- `docker compose ps`: Dolibarr and MariaDB were running after Docker access was approved.

Unavailable commands documented:

- `composer test`: unavailable; no `composer.json`.
- `vendor/bin/phpunit`: unavailable.
- `npm test`: unavailable.
- `npm run test`: unavailable.
- `npm run e2e`: unavailable.

## Freeze conclusion

No new feature work was started in Phase 13. The phase proceeded as evidence capture, UAT verification, documentation, and readiness reporting.
