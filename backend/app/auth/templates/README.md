# MJL — Email templates (French)

Eleven email designs are consolidated for backend integration. Each `.html` file is a **standalone email document** with a consistent visual shell (600px content width, table layout, inline CSS and responsive enhancements). Keep the common shell in sync if a template changes.

## Shared variables

| Variable | Value / use |
| --- | --- |
| `{{app_name}}` | `MJL`; rendered in header and relevant prose |
| `{{email_title}}` | Per-message heading; HTML-escaped before rendering |
| `{{recipient_email}}` | Recipient address, transport context only; not displayed |
| `{{app_url}}` | Application URL from `APP_BASE_URL`, transport context only; not displayed |

`recipient_email` and `app_url` are part of the **send context**, not visible placeholders in the approved HTML. Do not inject an address or generic homepage link solely to consume them.

## Template contract

| File | `email_title` | Additional variables |
| --- | --- | --- |
| `invitation.html` | `Invitation à rejoindre MJL` | `recipient_name`, `action_url`, `action_label` = `Activer mon compte`, `expiration_text` |
| `login-code.html` | `Code de vérification` | `otp_code` (six digits), `expiration_text` |
| `password-recovery.html` | `Réinitialisation du mot de passe` | `recipient_name`, `action_url`, `action_label` = `Réinitialiser mon mot de passe`, `expiration_text` |
| `password-change-notice.html` | `Mot de passe modifié` | `recipient_name`. No CTA. |
| `activity-reminder.html` | `Rappel d’échéance` | `recipient_name`, `activity_reference`, `activity_name`, `activity_end_date` (French-formatted). No CTA. |
| `activity-review-supervisor.html` | `Activité à examiner` | `recipient_name`, optional `actor_name`, `activity_action`, Activity/Project/PTA facts and `action_url` |
| `activity-review-validator.html` | `Activité à approuver` | Same Activity facts, with the prevalidator as optional `actor_name` |
| `activity-correction.html` | `Activité retournée pour correction` | Same Activity facts, optional reviewer name, `reason` and `action_url` |
| `financial-review-supervisor.html` | `Demande à examiner` | `recipient_name`, optional `actor_name`, `request_label`, exact formatted `request_amount`, Activity facts and `action_url` |
| `financial-review-validator.html` | `Demande à approuver` | Same financial facts, with the prevalidator as optional `actor_name` |
| `financial-correction.html` | `Demande retournée pour correction` | Same financial facts, optional reviewer name, `reason` and `action_url` |

`expiration_text` is a **duration label** such as `10 minutes`, without a trailing period and without `pendant`. The template supplies the surrounding sentence. The backend is authoritative for the duration: OTP currently 10 minutes; password reset currently 10 minutes; invitation according to configured policy.

For the reminder, `activity_end_date` is already formatted in French (for example `25 novembre 2026`). The wording names that date because the existing dispatcher may run at any point from 21 days before the deadline through the deadline itself.

## Rendering and delivery

1. Resolve the recipient, event eligibility, URL and expiration on the server. Use the backend's existing invitation, OTP, reset and activity workflows; do not introduce new ones.
2. Render ordinary variables with **HTML escaping** (including `email_title`, activity names, labels, and email identity). Validate and encode action URLs for their `href` attribute; use only the configured application destination. HTTP is limited to the loopback local-development configuration. Never directly interpolate untrusted data or send URLs.
3. Jinja2 renders the `{{...}}` placeholders with HTML autoescaping and strict missing-variable handling. Avoid naïve global string replacement for untrusted values.
4. Produce a plain-text alternative and meaningful subject for each email. Do not expose OTPs, invitation tokens or reset tokens in logs.
5. The two notice-only emails intentionally have no action URL/button. No generic link, extra CTA, status badge, illustration or decorative panel should be added.
6. Test desktop/mobile display and real inbox delivery in Gmail and Outlook, including long activity names, expired links, and plain-text versions, before production release. HTML rendering has not been verified in live email clients in this artifact pass.

## Visual baseline

MJL v3: navy `#16324f`, action blue `#164f7a`, strong text `#202529`, secondary `#34414a`, muted `#5c6870`, subtle surface `#f5f7f8`, subtle border `#c8d0d5`, and Inter with Arial/Helvetica fallbacks. No remote fonts, external images or CSS frameworks.

## Status

The templates are integrated into the eleven backend mail workflows with plain-text alternatives. Live Resend inbox and Gmail/Outlook rendering checks remain an owner-directed local step and are required before any production decision.
