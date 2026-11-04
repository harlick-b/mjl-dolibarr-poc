# Partner attachment sharing — DEC-136

Implementation authorized by the user on 2026-11-04: plan, implement, then
independent adversarial review. Synthetic identities/resources only.

## Outcome and boundaries

A Validator explicitly shares/unshares a current attachment on an approved,
Partner-visible Activity. All users bound to its Partner can list name/type/size,
download and preview images. Uploads/replacements are private by default.
Withdrawal or loss of Activity/Partner visibility denies subsequent access.
Unsharing remains available after closure. Downloaded copies cannot be recalled.
No new approval chain, folders, exports, PDF preview or production enablement.

## Smallest implementation

- Migration `0022_partner_documents`: add shared flag and optimistic version to
  existing attachment rows. Retain immutable content/metadata, prohibit deletion,
  and preserve audit history. No new table. Update exact schema verification.
- One validated PATCH responsibility for Validator sharing with expected version,
  existing advisory lock, current-state checks and atomic audit. Reject stale
  requests. Share only eligible current documents; permit unshare even if the
  parent has since become invisible. Existing withdrawal removes Partner access.
- Partner-scoped cursor list, download and image-preview GET responsibilities;
  project only approved public metadata. Reuse Partner binding/Activity visibility,
  protected response headers, session authorization and read locks. Never load
  file bodies for lists. No internal identity/reason exposure.
- Existing internal document panel gains sharing controls; existing Partner
  details gain a read-only shared-file panel. Router owns cursor, Query owns
  lists. Fresh guarded byte requests, preview cleanup on close/navigation/access
  loss, no offline mutation replay. Reuse existing visual components.

## Focused gates

1. Private upload/replacement defaults; Validator-only sharing, CSRF, stale-version
   rejection, sharing only approved/current files; unsharing after closure.
2. Own-Partner multi-user access; foreign/guessed/draft/withdrawn/unshared denial
   on list, download and preview; image-only preview and safe metadata/headers.
3. Cursor limits/envelope/isolation and metadata-only SQL; no content loading.
4. Atomic audit rollback and deterministic PostgreSQL unshare/read ordering;
   document bytes/metadata remain immutable under direct writes.
5. Migration upgrade/downgrade/re-upgrade compatibility and exact schema guard;
   downgrade refuses to discard nonzero sharing history.
6. React controls, Query invalidation, stale/offline failures; protected downloads
   and previews discard late bytes on access loss/navigation and clean object URLs.
7. Focused browser journey, document/Partner regressions, REST/OpenAPI, lint,
   formatting, typing/build and diff checks. Record actual candidate/results.
8. Separate engineering and security/specification reviewers inspect requirements,
   actual diff and evidence adversarially without editing or trusting implementer
   claims. Implementer fixes accepted findings and returns to the same reviewers.
   Completion requires resolved blocking findings and verification gaps.

## Evidence

Implemented on 2026-11-04; stop after this sharing slice. No production change.

Candidate: HEAD `ac6c1da` plus the 16 changed/new backend/frontend files in this
worktree. SHA-256 of the sorted manifest (`sha256(file)`, two spaces, path,
newline per file):
`d3061a16d9809c368268049ab450f1f5a6e71ff04c0f09e8ef601ea32a0e7591`.
Final browser artifact: `frontend/dist/assets/index-Br4FMLvu.js`.

- Backend command: `python -m pytest -p no:cacheprovider -q
  tests/test_partner_documents.py tests/test_documents.py
  tests/test_partner_portal.py tests/test_financial_returns.py`, mounted read-only
  in the existing backend image with a fresh disposable PostgreSQL 16 container.
  **45 passed / 5 failed**. Four failures were obsolete `0019` head expectations;
  the fifth combined too many scenarios for the unchanged synthetic abuse limit.
- After retaining all migration preservation/refusal assertions and using the
  actual migration head, and splitting withdrawal into a separate fixture,
  the final rerun passed **9/9** in 69.23 seconds: all five
  `test_partner_documents.py` tests plus `test_document_migration_round_trip_when_empty`,
  `test_predecessor_documents_survive_withdrawal_migration`,
  `test_used_withdrawal_migration_refuses_destructive_downgrade` and
  `test_used_document_migration_refuses_destructive_downgrade` from
  `test_documents.py`. No rate limit or acceptance condition was weakened.
  Disposable containers were removed. This is a focused correction rerun, not
  a claim that the earlier broad command passed.
- The new cases cover private/replacement defaults, Validator/CSRF/version checks,
  same-Partner multi-user access, foreign/draft/withdrawn denial, exact PDF/image
  bytes, image-only preview, sanitized metadata, pagination and metadata-only SQL,
  audit rollback, deterministic unshare/download serialization, immutable direct
  writes, closure sharing/revocation, migration preservation and schema tampering.
- Frontend: `npx vitest run src/partner-documents.test.jsx
  src/partner-portal.test.jsx src/planning.test.jsx`: **40 passed** in 9.62 seconds.
  New tests exercise sharing/unsharing, stale/offline behavior, Router pagination,
  foreign-link rejection, preview cleanup, navigation, fresh 403 denial and the
  two independently found timing bugs.
- `npx playwright test e2e/documents.spec.js e2e/partner-portal.spec.js` exercised
  the current Vite build. Internal documents passed; the Partner test initially
  used an exact filename locator that also contained metadata. Correcting that
  locator and rerunning `e2e/partner-portal.spec.js` passed. Final browser evidence:
  **1 internal document journey + 1 Partner desktop/mobile journey passed**,
  including image preview, Escape/focus return, download and mobile containment.
- ESLint, focused Prettier, Ruff check/format, mypy (32 source files), Vite/PWA
  build and `git diff --check` passed. Existing chunk-size and TestClient
  deprecation warnings remain; no bundling/dependency project was added.

## Independent adversarial review and corrections

Separate engineering and security/specification reviewers inspected actual
source without editing. They found two P2 browser races: an old preview error
could revoke a newer request, and successful list refresh after unsharing did
not revoke pending bytes. Both were reproduced by controlled-promise tests,
fixed with generation-specific cleanup and observed-file revocation, then
returned to the same reviewers. Both passed focused re-review; engineering
independently ran 12 existing/new UI tests and security ran the six tests then
present in the new document suite. Final evidence was supplied separately;
independent review does not imply production acceptance or another slice.

