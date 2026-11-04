# Local Resend mail and real accounts — DEC-138

Authorized 2026-11-04 from the supplied implementation plan. This change enables
real local-development accounts and the five existing system emails through
Resend. Production enablement, scheduling, retries, inbound mail, queues,
webhooks and unrelated workflows remain excluded.

## Contract and implementation

- Local authentication requires an exact loopback `APP_BASE_URL`, a generated
  authentication key, `RESEND_API_KEY` and a validated `EMAIL_FROM` in the
  ignored root `.env`; `EMAIL_REPLY_TO` is optional. Compose passes these values
  only to FastAPI. There is no provider switch, disabled-mail mode or fallback.
- Migration `0023_real_mail_accounts` removes the synthetic-address database
  restriction and adds nullable `auth_user.full_name`. Existing unnamed fixture
  accounts survive and render `Bonjour,`; every new invitation and first-Admin
  bootstrap requires a trimmed, control-free Unicode name of at most 200
  characters. Admin projections show it; no profile editor or wider identity
  disclosure is added.
- The final approved HTML and new plain-text templates live in
  `backend/app/mail_templates/`; the source folder under `docs/` is ignored.
  Jinja2 renders with autoescaping and strict variables. Invitation and recovery
  links retain secrets in fragments. OTP leading zeros are preserved. Password
  change and Activity reminder notices have no action button. Reminder text names
  the actual French-formatted approved end date.
- The existing synchronous mail seam sends subject, HTML and text to Resend with
  a bounded timeout and no automatic retry. Provider acceptance IDs are stored
  in the existing protected delivery audit. Existing stale-proof, neutral
  recovery, reset-notice and one-attempt reminder behavior remains authoritative.

## Verification contract

- Validate configuration rejection, address/name normalization and persistence,
  existing-account migration, downgrade protection for real addresses and the
  final schema fingerprint.
- Render all five HTML/text pairs with names, fallback greeting, escaping, strict
  missing variables, leading-zero OTP, expiry labels, long Activity content,
  French dates and required button absence. Package and build without the ignored
  source folder.
- Mock Resend acceptance, HTTP rejection, timeout and malformed acceptance;
  verify safe failures and protected provider IDs.
- Exercise invitation/password/OTP, recovery and notice, Partner invitation and
  reminder delivery/deduplication on disposable PostgreSQL. Run focused React and
  browser invitation/authentication checks, shared backend regression, static
  checks and builds.
- A live Resend/inbox check and Gmail/Outlook rendering remain owner-directed
  evidence after private `.env` configuration. Provider-mock acceptance does not
  establish inbox delivery or email-client compatibility.

## Mandatory independent review

A separate review-only agent inspects this contract, governing requirements,
actual diff, surrounding authentication/reminder code, template fidelity,
migration compatibility and verification evidence. The implementer fixes accepted
findings and returns the candidate to the same reviewer. Completion requires its
focused re-review with no blocking finding or mandatory verification gap.

## Evidence

Evidence is recorded against the final candidate after the independent
correction/re-review cycle. No production deployment or live private-key delivery
is part of repository verification.


### Commit review — 2026-11-04

Independent engineering and security reviewers found and rechecked three focused
fixes: reject non-object provider JSON, enforce the existing 64-character audit
limit for provider IDs, and align the README browser origin with `APP_BASE_URL`.
New full-name labels now use localization. No source blocker remains.

Verification against the integrated mail/funding working candidate:

- Disposable PostgreSQL: `tests/test_mail_accounts.py tests/test_auth_policy.py
  tests/test_reminders.py tests/test_access.py tests/test_recovery.py --tb=short`
  through `/tmp/mjl_commit_check.py`: 96 passed; two fixture migration statement
  timeouts were not passes (`/tmp/mjl-commit-mail-tests.log`). Both exact cases
  (`test_withdrawn_activity_stops_reminders`,
  `test_openapi_and_access_endpoint_abuse`) passed on rerun, together with Partner
  invitation/binding/deactivation and recovery: **4 passed**, 40.82s
  (`/tmp/mjl-commit-regression-final.log`). An earlier Partner fixture omitted the
  now-required full name; the corrected fixture exercised its intended checks.
- Final malformed-provider/normalization/template unit tests: **18 passed**,
  0.55s, after the review fixes. Ruff passed for app/tests/new migrations,
  formatting passed for 41 selected files, mypy passed for 37 source files in
  `mjl-budget-test:local` (`/tmp/mjl-commit-quality-final.log`). A broad lint
  attempt exposed an unchanged historical migration 0013 line-length warning;
  no historical migration was rewritten for this slice.
- `npm run test:unit -- src/access.test.jsx`: **11 passed**;
  `npm run lint` and `npm run build`: passed, existing chunk warning only
  (`/tmp/mjl-commit-ui-final.log`, `mjl-commit-eslint.log`, `mjl-commit-build.log`).
- Initial browser commands either skipped without their required environment or
  failed temporary runner setup; those are not verification passes. Final actual
  browser evidence is recorded below after isolated setup correction.

All test data and captured mail were synthetic; no Resend credential or live inbox
was used. Live delivery/email-client acceptance remains deferred as above.

Final real-browser run: `python3 /tmp/mjl_commit_browser.py` provisioned fresh
PostgreSQL/backend resources and private synthetic mailboxes, then executed
`npx playwright test e2e/auth.spec.js` (**2 passed**, 16.0s) and
`npx playwright test e2e/access.spec.js` (**1 passed**, 12.9s). No skips; teardown
completed (`/tmp/mjl-commit-browser-final.log`). Final touched JSX/localization
Prettier and `git diff --check` passed.

Integrated backend/frontend changed-file identity (sorted path + NUL + bytes +
NUL), including prerequisite and funding source/tests/lockfile:
`43b86d3a9d11d5ab97947fe9155f16ddd98892e10beefcf1587772aa735e8e0d`.
The exact path manifest is `/tmp/mjl-commit-manifest.json`; the resulting commits
are the durable candidate reference. Funding runtime behavior was not changed
during this mail review; the shared localization file gained only the account-name
label. Contract 58 retains the earlier funding candidate's scoped evidence.

Both original independent reviewers rechecked the fixes, manifest and final
evidence and reported no remaining commit blocker. Live delivery and production
acceptance remain outside this signoff.

The commit hook required whitespace-only Prettier normalization of the existing
access browser test; it was applied without changing test behavior.
