# MJL Clarity System — Email System

MJL product decisions come from `docs/mjl-authoritative-decisions.md`; this
file covers email UX only.

## Purpose

Define system emails as part of the product experience, consistent with the app UI and official outputs.

## Baseline Constraints

- Dolibarr core files must not be modified.
- MJL-specific implementation must remain inside safe custom module/theme boundaries.
- The temporary access model is exactly Level 1, Level 2, Level 3, Admin.
- Access is invitation-only.
- Only Admin can send invitations for now.
- There is no public register page.
- The design system covers app UI, auth pages, system emails, official outputs, and E2E tests.
- E2E tests are the main validation method.

## Email Principles

Emails should be short, formal, French-first, action-oriented, consistent with MJL Clarity System, readable on mobile, and plain-text compatible.

## Required Templates

- Invitation email
- Password reset email
- Activity submitted
- Activity returned for correction
- Activity validated
- Activity rejected
- Approaching deadline
- Overdue activity
- Export ready, if implemented

## Structure

1. Header with MJL identity.
2. Clear title.
3. Short message.
4. Main action button.
5. Context details.
6. Security/support note.
7. Footer.

## Tone

Use:

```txt
Une action est requise sur une activité liée à un projet à financement extérieur.
```

Avoid promotional or urgent marketing tone.

## Audit Expectation

Important emails should be logged when possible, including invitation sent, invitation accepted, reset requested, activity returned, activity validated, and alert sent.
