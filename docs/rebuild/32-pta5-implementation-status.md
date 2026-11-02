# PTA-5 — Implementation status

Status: `PTA_5_COMPLETE` on 2026-11-02.

## Delivered boundary

MJL now creates one durable 21-day reminder cycle for each currently assigned,
active Agent using the Activity's approved end date. Each cycle provides an
in-app notification and one synthetic email attempt. New assignments receive the
current cycle; an approved new end date creates a new cycle while history remains.
Failed and unconfirmed email outcomes are not retried automatically, and a
successful outcome is never resent.

Migration `0016_pta5` adds one reminder table. A focused dispatcher shares the
existing lifecycle advisory lock and synthetic provenance guard. Recipient-only
cursor APIs list notifications and mark one read with version/replay protection.
The responsive MJL workspace sidebar exposes the notification centre and unread
badge with principal-scoped TanStack Query state and online-only mutations.

No browser push, generic notification platform, queue, production scheduler,
SMTP, manual resend or additional business workflow was added.

## Verification

- Exact final Docker image `78d8f3dba65b0c58de86c570c18c7388bc97ba6477278f647fb6321bb0b9f295`:
  `pytest -q tests/test_reminders.py` — **12 passed** in 66.73 seconds.
- Review-corrected Docker candidate: reminders, database provenance/migration and
  OpenAPI inventory — **15 passed** in 61.74 seconds. An earlier adjacent run of
  reminders, metrics, closure and withdrawal — **12 passed** in 70.11 seconds.
- Focused coverage proves exact/already-due/past boundaries, approved rather than
  pending dates, assignment changes, inactive/ended/unassigned recipients,
  closed/withdrawn stops, one-attempt success/failure/unconfirmed outcomes,
  concurrent dispatch and lifecycle ordering, recipient isolation, read replay,
  cursor traversal and protected downgrade.
- Frontend: **61 unit tests passed**; ESLint, Stylelint, Prettier and Vite/PWA build
  passed. Offline read mutation does not reach `fetch`; protected notification
  caches are principal-scoped and cleared on authorization/offline expiry events.
- Backend Ruff lint/format, strict mypy and `git diff --check` passed. The only
  warning is the existing Starlette/httpx test dependency deprecation.
- A later independent committed-change review found and corrected two focused
  races: reads now take the lifecycle lock before authentication, and an
  approved same-date amendment keeps its existing delivery cycle. The corrected
  disposable-PostgreSQL suite passed **14 tests**; both reviewers returned PASS.

## Independent review

A separate review-only agent inspected authority, the actual diff, surrounding
code and evidence without modifying files. It initially found protected-cache,
lifecycle-lock, pagination and test-oracle gaps. The implementer corrected them
and returned the same candidate twice. Final focused re-review returned **PASS**
with no blocking defect or overengineering concern.

PC1/PC2 remain pending. Only synthetic identities, disposable PostgreSQL and the
private test mailbox were used. Real mail, production scheduling, documents,
Partner access, real accounts and later slices remain unauthorized.
