# MJL Native Boundary Post-Fix Verification

## 1. Executive Verdict

Verdict: PASS

Recommendation: DEMO_READY_WITH_NOTES

The native browser boundary now blocks both the originally requested native routes and the adjacent Dolibarr route families that were found leaking during adversarial review. Normal MJL users and `admin.poc` receive the MJL-branded 403 shell instead of native Dolibarr chrome for the tested route matrix. This is a demo-readiness result only, not a production-ready claim.

## 2. Context

- Previous blocker: normal MJL users could still see native Dolibarr chrome and native Dolibarr access-denied/workspace pages.
- Fix summary: Apache native-route blocking expanded to broad native route families, `/admin/*`, and `/user/*` except required auth helper routes; MJL forbidden shell preserved; focused E2E coverage expanded; pre-bootstrap current-state E2E coverage added.
- Audit date: 2026-07-13
- Branch: `main`
- Git status: dirty before and after this verification; unrelated pre-existing changes were preserved.

## 3. Method

- Static inspection performed: yes.
- Runtime inspection performed: yes, against `http://127.0.0.1:8080`.
- Screenshots captured: yes.
- Tests run: yes.
- Limitations: full `npm run test:e2e` was not run against the persistent local workspace because several suites mutate users, database rows, document files, and config. The focused Phase 5 suite does bootstrap/seed local fixture data and was run after the no-bootstrap current-state probe.

## 4. MJL Workspace Verification

| Route | User | MJL sidebar visible | Native chrome absent | Status | Evidence |
|---|---|---:|---:|---|---|
| `/custom/mjlfinancement/index.php` | all sample users | yes | yes | PASS | `native-boundary-current-state.spec.js` |
| `/custom/mjlfinancement/projects.php` | all sample users | yes | yes | PASS | `native-boundary-current-state.spec.js`; screenshot |
| `/custom/mjlfinancement/documents.php` | all sample users | yes | yes | PASS | `native-boundary-current-state.spec.js`; screenshot |

Sample users: `agent.mjl`, `superviseur.n1`, `superviseur.n2`, `dpaf.mjl`, `admin.poc`.

## 5. Native Route Boundary Verification

| Native route | User | Final behavior | Native UI absent | Status | Evidence |
|---|---|---|---:|---|---|
| `/projet/index.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E; screenshot |
| `/ecm/index.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E; screenshot |
| `/societe/index.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E |
| `/comm/index.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E |
| `/hrm/index.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E |
| `/compta/index.php` | all sample users | MJL 403 | yes | PASS | current-state E2E |
| `/modulebuilder/index.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E |
| `/admin/modules.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E; screenshot |
| `/admin/index.php`, `/admin/company.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E; screenshot |
| `/user/list.php`, `/user/card.php`, `/user/group/list.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E |
| `/categories/index.php`, `/product/index.php`, `/imports/index.php`, `/ticket/index.php`, `/don/index.php`, `/contrat/index.php`, `/fichinter/index.php`, `/website/index.php` | all sample users | MJL 403 | yes | PASS | current-state E2E; Phase 5 E2E |

## 6. Functional Regression Checks

| Check | Status | Evidence | Notes |
|---|---|---|---|
| Dashboard lands correctly after login | PASS | Phase 5 E2E | All primary sample roles land on MJL dashboard. |
| Projects page works | PASS | Phase 5 E2E; current-state E2E | Sidebar and project page render without native chrome. |
| Project detail and `Notes / Commentaires` work | PASS | Phase 5 E2E | Comment flow verified in focused suite. |
| Documents page remains read-only | PASS | Phase 5 E2E; screenshot | No global upload button observed by test. |
| Document links use secure MJL routes | PASS | Existing focused coverage inspected; Phase 5 does not click downloads | Download clicks audit rows, so no extra click was added here. |
| `Historique des validations` wording aligned | PASS | Phase 5 E2E | Label/page text assertion passes. |
| `Échanges` absent from visible navigation | PASS | Phase 5 E2E | Sidebar assertions pass. |
| Roadmap hidden by default | PASS | Phase 5 E2E | Direct access denied unless test toggles flag for admin-only check. |
| Auth helper routes preserved | PASS | Phase 5 E2E; current-state E2E | `/index.php`, `/user/logout.php`, and `/user/passwordforgotten.php` remain reachable. |

## 7. Test Results

- `docker compose exec -T dolibarr apache2ctl -t` -> PASS (`Syntax OK`; FQDN warning only).
- `docker compose exec -T dolibarr apache2ctl graceful` -> PASS; Apache reloaded after config changes.
- `docker compose exec -T dolibarr php -l /var/www/html/custom/mjlfinancement/nativeforbidden.php` -> PASS.
- `docker compose exec -T dolibarr php -l /var/www/html/custom/mjlfinancement/class/actions_mjlfinancement.class.php` -> PASS.
- `docker compose exec -T dolibarr php -l /var/www/html/custom/mjlfinancement/lib/mjl_native_modules.lib.php` -> PASS.
- `docker compose exec -T dolibarr php -l /var/www/html/custom/mjlfinancement/scripts/disable_native_workspace_modules.php` -> PASS.
- `docker compose exec -T dolibarr php -l /var/www/html/custom/mjlfinancement/scripts/bootstrap_poc.php` -> PASS.
- `npx playwright test tests/e2e/native-boundary-current-state.spec.js` -> PASS, 3 passed.
- `npx playwright test tests/e2e/phase5-workspace-shell.spec.js` -> PASS, 17 passed.

## 8. Screenshots

- `docs/audits/assets/post-fix-agent-dashboard-1366x768.png`
- `docs/audits/assets/post-fix-agent-projects-1366x768.png`
- `docs/audits/assets/post-fix-agent-documents-1366x768.png`
- `docs/audits/assets/post-fix-native-projet-agent.png`
- `docs/audits/assets/post-fix-native-ecm-agent.png`
- `docs/audits/assets/post-fix-native-admin-modules-agent.png`
- `docs/audits/assets/post-fix-native-admin-index-agent.png`

## 9. Remaining Risks

- The result depends on the Apache guard being mounted and Apache reloaded in the target environment.
- Full E2E was not run against this persistent workspace to avoid broad data/document/config mutation.
- This verifies browser route containment, not production secrets, backup/restore, monitoring, final client permission approval, or complete production readiness.

## 10. Final Recommendation

The app is now safe for a controlled client demo with notes: use the MJL workspace routes only, keep the Apache native guard enabled, and do not present this as production-ready.
