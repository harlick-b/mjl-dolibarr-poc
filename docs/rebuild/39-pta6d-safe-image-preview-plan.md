# PTA-6D — Safe Activity image preview

## Outcome and boundary

Allow an authorized internal business user to open an uploaded JPEG or PNG in a
modal from the existing Activity attachment list. Reuse PTA-6A storage, Activity
authorization, lifecycle locking and audit. The server returns only the verified
stored image bytes with an inline filename, `no-store`, `nosniff` and a restrictive
content policy after fresh authorization; successful generation records one
`document.preview` event in the same transaction.

PDF remains download-only. This slice adds one GET responsibility and one existing
screen action. It adds no migration, table, conversion/sanitization service,
thumbnail, storage provider, deletion/versioning, broader document context,
Partner/Admin access or production enablement.

## Verification

Focused public-interface checks cover PNG/JPEG bytes and headers, PDF refusal,
parent/resource and role isolation, audit rollback, current-session revocation
serialization and OpenAPI media types. React and Chromium checks cover the
image-only action, accessible modal/close behavior, retained download action,
responsive containment and absence of a PDF preview action. Run affected backend
and frontend quality/regression checks with synthetic identities and disposable
PostgreSQL only.

## Mandatory independent review

A separate agent that did not implement the change performs a read-only review
of requirements, diff, surrounding code and evidence. The implementer fixes
accepted findings and returns the same candidate to that reviewer for focused
re-review. Completion is blocked until blocking findings and required evidence
gaps are resolved. Stop after PTA-6D.
