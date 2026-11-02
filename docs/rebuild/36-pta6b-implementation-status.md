# PTA-6B implementation status

**PTA_6B_COMPLETE** on 2026-11-02.

## Implemented boundary

`GET /api/v1/audit-events` exposes the existing append-only audit chronology to
Validateurs définitifs and Admins through the shared authenticated environment
guard and signed cursor contract. It returns newest-first bounded French action
labels, stable actor ID/email and an optional related Activity. Raw `details`,
`business`, request IDs, proofs and hashes are absent. Current mutable roles are
not presented as historical facts.

The `/history` React screen uses Router-owned cursor state and Query-owned server
state, shows Activity links only to the business-authorized Validator, and clears
protected history on offline, session expiry, cross-tab auth change or backend
denial. There is no migration, mutation, export, search engine or reporting
framework.

## Verification evidence

- Backend image
  `sha256:16ccacec12951c08d919c20ab23ac45e620482e9afa21fd66415fe09cded1b9c`:
  Ruff format/lint and strict mypy passed for 28 source files.
- Five disposable-PostgreSQL/API/OpenAPI checks passed in 49.38 seconds. They
  cover Validator/Admin authorization, Agent/Supervisor denial, sanitization,
  Activity projection, role-change history, newest-first and previous traversal,
  cursor signature/limit/resource binding and the generated response shape.
- Frontend ESLint, Stylelint and Prettier passed; all 63 Vitest tests passed and
  the production/PWA build completed with the existing chunk-size warning.
- The focused real-Chromium desktop/mobile history journey passed 1/1 in 2.4
  seconds. `git diff --check` passed.
- Only synthetic identities and the isolated `mjl-pta6b` PostgreSQL project were
  used. PC1/PC2 remain pending and real accounts remain prohibited.

## Independent review

The read-only independent reviewer initially returned `CHANGES_REQUIRED` for a
mutable current role shown as historical fact, incomplete French action labels
and missing endpoint-specific cache/cursor evidence. The implementation removed
the role claim, moved bounded French labels to the server with safe fallbacks and
added focused role-change, cursor, OpenAPI and offline-clearing checks. The same
reviewer returned **PASS** after focused re-review with no remaining correctness,
security/privacy, authorization, cache, pagination, design, scope or
overengineering finding. The reviewer modified no files.
