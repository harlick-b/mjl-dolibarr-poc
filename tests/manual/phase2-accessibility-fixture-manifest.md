# Phase 2 manual accessibility fixture manifest

This manifest is test-only. It adds no production route, feature flag, or
failure injector. Run it only in the disposable local POC tenant.

## Fixture revision

- Source baseline: `mjl_dolibarr_poc_sample_data`
- Phase 2 automated decision marker: `P2DEC_E2E`
- UI fixture specification:
  `tests/e2e/phase2-v2-operational-components.spec.js`
- Approved visual snapshot tree:
  `98d0053a934b83b4a21a6c67207e86b3c89fe7d0`

## Idempotent preparation and verification

```bash
docker compose up -d
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/seed_sample_data.php
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/acceptance_sample_data.php
npm run test:e2e -- --reporter=line --timeout=120000 tests/e2e/phase2-v2-operational-components.spec.js
```

The focused spec performs reserved-marker cleanup before setup and in
`afterAll`. Its cleanup targets only rows carrying both `P2DEC-E2E-*` refs and
the `P2DEC_E2E` import marker, removes children first, and deletes only the
known evidence filenames. A rerun is the supported setup/cleanup/verify
command; do not hand-delete application rows.

Use the seeded users `agent.mjl`, `superviseur.n1`, `dpaf.mjl`, and
`admin.poc`. Use the guarded routes represented by activity `ACT-JE-002`,
project `PRJ-JE-2026`, partner `PTF-UNICEF`, and the seeded expense states.
The automated spec is the fixture integrity oracle; a failure blocks manual
evidence collection.

## Manual-only harness boundary

Launch the headed, unlimited-time harness with:

```bash
MJL_PHASE2_MANUAL=1 PWDEBUG=1 npx playwright test --config=tests/manual/playwright.config.js
```

It records the exact bundled Chromium version, OS, outer/inner dimensions, and
DPR in the console, injects the production-class partial-result component
from test code, and pauses in Playwright Inspector. This is the only
partial-error failure harness. It is not exposed through a production query
flag or route. Use the same live browser to navigate the remaining surfaces
listed in the evidence sheet.

Do not retain decision fixtures between runs and do not use this manifest in a
production tenant.
