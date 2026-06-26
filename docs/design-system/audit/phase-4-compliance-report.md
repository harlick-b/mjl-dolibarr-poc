# MJL Clarity System — Phase 4 Compliance Report

## Scope

Phase 4 implements auth and access UI only. Changes stay inside `custom/mjlfinancement`, setup/bootstrap support, SQL migration files, E2E harness files, and this documentation.

## Safe Boundary Evidence

- Dolibarr core files were not modified.
- Native `/index.php` remains the canonical login route.
- Native `/user/passwordforgotten.php` remains the canonical forgotten-password/reset route.
- MJL auth UI is supplied through module `tpl`, `hooks`, and `css` parts.
- Invitation acceptance and Admin access management are custom module pages.

## Implemented Surfaces

- MJL-branded login template with native login POST fields preserved.
- MJL forgotten-password template using neutral no-enumeration wording.
- MJL password-reset template where the user chooses and confirms a new password.
- `passwordforgottenpage` hook replaces Dolibarr's generated-temporary-password flow with MJL reset tokens and `User::setPassword()`.
- Admin-only invitation management page.
- Invitation acceptance page with invalid, expired, revoked, accepted, and valid states.
- Real invitation/reset email delivery through Dolibarr mail APIs when not running E2E token exposure.
- Access audit rows for invitation and reset lifecycle events.
- Test-only token outbox controlled by `MJL_AUTH_E2E_EXPOSE_TOKENS`, disabled by default.

## Constraints Check

- No public register page was created.
- Forbidden labels are not introduced intentionally in MJL auth UI.
- Access remains invitation-only for new users.
- Only Admin can send, resend by re-inviting, or revoke invitations.
- Plaintext invitation/reset tokens are not stored in database tables.
- Existing active, Admin, global, or unrelated users cannot be demoted or disabled by the invitation flow.
- Password-reset POST actions validate CSRF tokens explicitly and apply lightweight throttling.
- Existing workflow, export, active-entity, and no-self-validation logic is not intentionally changed.

## E2E Coverage Added

Playwright specs cover:

- MJL login and forgotten-password UI replacement.
- Neutral forgotten-password response for known and unknown email addresses.
- User-chosen password reset.
- Admin invitation and first access.
- Non-admin invitation-management blocking.
- Invalid invitation handling.
- Forbidden auth/register labels.
- Duplicate active/admin login and duplicate email rejection.
- Bad invitation password does not activate the user.
- Invalid reset CSRF does not create a reset token.
- E2E cleanup removes token exposure constants, temporary users, auth rows, outbox data, and browser artifacts.

## Known Limitations

- Real SMTP delivery depends on Dolibarr mail configuration. E2E uses the disabled-by-default local test outbox.
- Email template polish beyond invitation/reset messages remains outside Phase 4.
- Native menu hiding, dashboards, reports, and activity workflow redesign remain outside Phase 4.
