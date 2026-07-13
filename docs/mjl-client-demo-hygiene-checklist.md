# MJL Client Demo Hygiene Checklist

Target decisions come from `docs/mjl-authoritative-decisions.md`.

## Executive verdict

`DEMO_HYGIENE_READY_WITH_NOTES`

The demo is safe if the facilitator avoids local/test noise, separates
production-preparation blockers from business validation, and does not hide
real limitations.

## Data hygiene

- Use local/dev seeded data only.
- Confirm UNICEF and Programme Redevabilite are present before the session.
- Do not load fixture data into a production tenant.
- Treat historical unresolved local audit rows as data debt, not client
  business feedback.

## Audit/history hygiene

- Use object timelines and scoped audit views for traceability evidence.
- Avoid raw unresolved-scope diagnostics unless the client asks about
  technical controls.
- If unresolved local rows appear in an Admin-only view, explain that
  fail-closed access was verified and that cleanup is separate data debt.

## Demo users

- Use fixture/demo accounts only.
- Explain production roles, not fixture usernames.
- Confirm each demo browser session is logged in as the intended role.

## Demo credentials handling

- Do not show passwords on screen.
- Do not reuse sample passwords as production guidance.
- Do not expose secret values, tokens, `.env` content, or database credentials.

## Demo exports

- Generate only CSV/XLSX.
- Confirm filenames and downloaded files do not expose local paths.
- Show French headers, semicolon CSV, UTF-8 BOM compatibility, and scoped rows.

## Demo browser/session preparation

- Use separate browsers or private windows for each role.
- Clear unrelated tabs and previous downloads.
- Keep only the local demo URL visible.
- Prepare export download location before the session.

## Known local/test noise

- Historical unresolved local audit rows.
- Generic report audit anchors.
- Fixture names containing POC-era vocabulary.
- Test/dev credentials.
- Sample passwords.
- Local file paths in operator-only contexts.
- Debug output if server tooling is opened.
- Internal roadmap page when the feature flag is enabled.
- Admin-only unresolved-scope diagnostic output.
- Production-readiness `UNKNOWN` items.

## Items to clean before demo

- Browser tabs, downloaded files, and visible terminal history.
- Any stale failed-export files in the download folder.
- Any accidental debug output in the browser.
- Any browser autofill suggestions that reveal credentials.

## Items safe to explain if asked

- Fixture role names are local compatibility data.
- Historical unresolved audit rows are local verification data debt.
- Admin diagnostics exist to expose unresolved technical data, not to grant
  non-admin visibility.
- Production email, URL, secrets, backup/restore, monitoring, and hosting are
  production-preparation topics.

## Do-not-show list

- Raw database tables.
- Raw ECM file paths.
- Secrets or tokens.
- Production-like credentials.
- Internal roadmap unless explicitly requested as an operator-only artifact.
- Stale prompt/planning docs as product evidence.

## Do-not-promise list

- Production SMTP.
- Final public URL.
- Production secrets.
- Backup/restore.
- Monitoring/log retention.
- PDF/Word reports.
- SMS.
- OCR.
- Bank API.
- Public partner portal.
- Offline mode.
