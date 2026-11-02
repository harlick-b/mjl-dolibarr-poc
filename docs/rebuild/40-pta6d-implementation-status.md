# PTA-6D implementation status

**PTA_6D_COMPLETE** on 2026-11-02.

## Implemented boundary

`GET /api/v1/activities/{activity_id}/documents/{document_id}/preview` returns
only stored JPEG/PNG bytes after the shared lifecycle lock, current internal-role
authorization and Activity/document binding checks. Successful delivery records
`document.preview` in the same transaction. Responses are inline, non-cacheable,
same-origin isolated and protected by nosniff and a restrictive content policy.
PDF remains download-only.

The existing Activity evidence panel exposes image-only preview actions. It loads
the protected image as a cancellable blob through RestClient, blocks offline
attempts without replay, clears the workspace on authorization loss, ignores late
responses and revokes temporary object URLs on close or unmount. No migration,
table, conversion service, thumbnail, Partner/Admin access or production document
infrastructure was added.

## Verification evidence

- The complete affected backend suite passed 21 PostgreSQL/API/OpenAPI checks on
  the final candidate. It covers PNG/JPEG delivery and headers, PDF refusal,
  anonymous/Admin and parent-resource denial, Validator access, real audit-write
  failure returning 503 without bytes, deactivation serialization and adjacent
  attachment/audit-history regressions.
- Ruff formatting/lint passed and strict mypy found no issue in 28 source files.
- Frontend ESLint, Stylelint and Prettier passed; all 63 Vitest tests passed and
  the production/PWA build completed with the existing chunk-size warning.
- The focused Chromium image-preview journey passed 1/1, including mobile
  containment, modal close behavior, retained download and no PDF preview action.
  `git diff --check` passed.
- Only synthetic identities and the disposable `mjl-pta6d` PostgreSQL stack were
  used. PC1/PC2 remain pending and real accounts remain prohibited.

## Independent review

The read-only reviewer initially blocked completion because a raw image URL
bypassed RestClient authorization-loss/offline handling, the rollback test did
not exercise a real database failure, and role/header coverage and formatting
were incomplete. The implementation added cancellable blob loading and cleanup,
a real PostgreSQL audit-write failure oracle, the missing access/header checks
and formatting corrections. The same reviewer rechecked the final candidate and
returned **PASS** without modifying implementation files.
