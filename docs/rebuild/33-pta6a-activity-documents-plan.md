# PTA-6A — Optional Activity attachments

Status: `PTA_6A_AUTHORIZED_FOR_IMPLEMENTATION` on 2026-11-02.

## Outcome and limits

An Agent or Validator can attach an optional PDF, JPEG or PNG to an Activity.
Every business role can list and download those attachments after a fresh
server-side Activity authorization check. Missing attachments never block a
workflow. Upload and successful download are audited.

This first slice is enabled only by the existing isolated synthetic-test gate.
It stores bounded bytes privately in the disposable PostgreSQL database so no
unapproved storage provider or key-custody choice is invented. The isolated
test scanner rejects the standard antivirus test signature; real-data use stays
blocked until a real scanner, retention and storage/key operations are approved.

The slice adds one append-only Activity-document table and three responsibilities:
cursor list, bounded binary upload and attachment download. Files are at most 20 MiB;
the server verifies extension, declared type, signature and parsed PDF/image
structure, trims and validates the display name and sends downloads as attachments with
`no-store` and `nosniff`. It adds a compact Activity-detail panel based on the
supplied file-list and upload-modal inspiration. Query state is principal scoped
and uploads do not replay offline.

Preview, replacement, withdrawal/deletion, versions, categories, mandatory
attachments, PTA/Operation/request-specific contexts, Partner/Admin access,
public or raw storage URLs, production storage, browser caching, bulk actions and
real accounts remain excluded.

## Verification

Focused PostgreSQL/API checks must prove role and resource authorization,
synthetic-only fail-closed gating, type/size/name/content rejection, append-only
history, cursor contract, CSRF, audited atomic upload, audited no-store download,
guessed-ID denial and migration downgrade protection. React checks cover list,
upload, Query invalidation, offline rejection and download composition. Run
OpenAPI, migration, lint, format, typing, build and focused adjacent regressions.

## Mandatory independent review

A separate review-only agent that did not implement the slice must inspect this
contract, the actual diff, surrounding authorization/storage code and evidence
without trusting implementation claims. It reports severity, file/line evidence,
impact, the smallest fix and missing verification. The implementer fixes accepted
findings and returns the same candidate to that reviewer. Completion is blocked
until the reviewer passes the corrected candidate.
