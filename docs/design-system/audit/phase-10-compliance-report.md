# MJL Clarity System - Phase 10 Compliance Report

## Scope

Phase 10 implements shared MJL email templates and nonblocking activity workflow notifications. Changes stay inside `custom/mjlfinancement`, E2E tests, and this documentation.

## Safe Boundary Evidence

- Dolibarr core files are not modified.
- Email rendering and sending live in `custom/mjlfinancement/lib/mjl_email.lib.php`.
- Existing auth and activity workflow code is refactored only inside the MJL custom module.
- Dolibarr module triggers remain disabled with `module_parts['triggers'] = 0`.
- No schema migration is added.

## Implemented Surfaces

- Shared plain-text MJL email renderer for auth, workflow, and render-only alert templates.
- Invitation and password-reset emails now use the shared MJL template layer.
- Activity workflow notifications are sent after committed transitions for submitted, correction-requested, validated, and rejected states.
- Workflow email failures are best-effort and logged without rolling back business transitions.
- E2E email capture writes to `DOL_DATA_ROOT/mjlfinancement/email-test-outbox` when `MJL_AUTH_E2E_EXPOSE_TOKENS` is enabled.
- Email sent/failure events are logged in `llx_mjlfinancement_access_audit` without storing tokens or message bodies.

## Constraints Check

- French-first email content is preserved.
- Invitation-only access is preserved.
- No public registration flow is added.
- Activity workflow rules, no-self-validation, audit history, active-entity filtering, and existing exports are preserved.
- Alert email templates are renderable, but scheduled alert delivery remains deferred pending cadence and deduplication decisions.

## E2E Coverage Added

Playwright spec `tests/e2e/phase10-email-templates.spec.js` covers:

- Invitation email subject/body and invitation flow.
- Password-reset email subject/body and reset flow.
- Activity-submitted validator notifications with duplicate email deduplication.
- Correction-requested, validated, and rejected creator notifications.
- `$notrigger = 1` workflow calls not sending activity emails.
- Render-only alert templates without scheduled alert send audit rows.

## Known Limitations

- Alert email delivery is not implemented in this phase.
- Export-ready emails remain out of scope because asynchronous export generation is not implemented.
- Email templates are plain text only in this phase; no HTML email design is introduced.
