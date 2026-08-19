# RST-010A Document Containment Strategy

Status: `EXECUTED` on 2026-08-19 after explicit RST-010A approval.

This unit hardens containment only. It implements no upload, download,
preview, category, version, retention, replacement, workflow dependency,
document audit, navigation, permission, or public-share behavior.

## Corrected live inventory

Before implementation, the live code/data boundary was:

- `custom/mjlfinancement/documents.php` and
  `custom/mjlfinancement/documentdownload.php` loaded Dolibarr before denying;
  an anonymous request therefore reached the login page with HTTP 200.
- Native `/ecm/*` was denied by Apache, but root `/document.php` and
  `/viewimage.php` were not explicitly denied.
- `llx_ecm_files` contained zero rows and `llx_ecm_directories` contained one
  retained legacy metadata row. `llx_mjlfinancement_exchange_log` was absent.
- The shared `data/documents` tree contained only operational directories,
  four native ODT templates, `install.lock`, `initdb.log`, and two user cache
  files. It contained no MJL business document.
- The former MJL document library, upload/download helpers, document-audit
  adapter, lifecycle tests, and exchange-log schema were already absent.
- `tests/evidence/inter-font-live.js` was stale: it used a deleted sample login
  and expected live controls on the containment route.

The pre-implementation shared filesystem manifest digest was
`c32eba620bf66b2afd603e3c286ccc0ebc319843c27ee55e2ca276c1cf542159`.
The ordered MariaDB dump digest covering every column and row of both ECM
tables was
`9ef36e1c6b9f119e5ab44d354a25a034f53a42673b2c9bb4b85206d451b395d8`.
These values record current state only; they do not amend DEC-039.

## Exact dormant seams retained

Only these document-related seams remain:

1. `documents.php` and `documentdownload.php`: dependency-free, request-agnostic
   French HTTP 403 responses with `text/plain`, `no-store`, `nosniff`, and no
   attachment header.
2. `apache-native-guard.conf` and `nativeforbidden.php`: browser denial for
   `/ecm/*`, `/document.php`, and `/viewimage.php`, including path-info variants
   and every HTTP method, with a dependency-free French error response.
3. `mjl_scope_document_pointer()` in `mjl_scope.lib.php`: an unused,
   entity-filtered ECM pointer lookup. RST-010A does not call or broaden it.
4. `modECM` activation in `bootstrap_poc.php`: storage capability remains
   installed for a later adapter, while browser delivery is denied.
5. The `documentdownload.php` asset-loader exclusion in
   `actions_mjlfinancement.class.php`: a passive defense-in-depth exclusion.
6. The `/ecm` redirect prefix in `js/native_guard.js.php` and native ECM menu
   hiding selectors in `css/mjl_app.css.php`: passive client-side defense in
   depth only, never access control. The CSS file also retains unreachable
   `.mjl-document-*` presentation rules; they expose no route or behavior.
7. Native ECM tables and the complete document-storage tree: retained exactly
   as data, never treated as approved business behavior.

No dormant seam is navigation-visible or an authorization grant.

## Denial contract and threat review

Both custom routes deny before Dolibarr bootstrap. They inspect no query,
form, cookie, session, database, ECM row, or filesystem path and produce no
audit event. This removes authentication-dependent redirects and makes GET,
POST, malformed identifiers, duplicate parameters, traversal strings,
encoded paths, cross-entity identifiers, orphan references, and public-share
tokens equivalent: HTTP 403 and no data access.

Apache denies native ECM browsing plus the two generic root delivery scripts
before native document resolution. The protected assets are document bytes,
ECM metadata, entity boundaries, authentication state, and the absence of
unapproved document behavior. Relevant actors are anonymous callers,
authenticated business users, native Admin, and callers using stale or forged
identifiers. No route-level authorization is delegated to UI hiding.

## Disposable verification and state proof

`npm run test:rst010a` provisions a unique isolated tenant and creates only
throwaway same-entity, cross-entity, orphan, and public-share ECM/file
canaries plus one authenticated business user. It logs in the native Admin and
business user before the baseline, then probes every listed route as those two
actors and anonymously using GET and POST. The matrix includes traversal,
backslash, absolute-path, encoded-path, duplicate-parameter, cross-entity,
orphan, share-token, native ECM, and generic native delivery cases.

The fixture refuses to run unless `MJL_DISPOSABLE_TEST_TENANT=1`. Before and
after the HTTP matrix it recursively records every filesystem path, type,
file size, file SHA-256, or symlink target and every column/value of every row
in `llx_ecm_files` and `llx_ecm_directories`, ordered canonically and encoded
losslessly. The complete manifests and individual plus aggregate SHA-256
digests must be exactly equal. The runner destroys all disposable containers,
networks, and volumes after success or failure.

## Rollback boundary

Rollback may restore only a previously reviewed denial-only implementation of
the same custom and native routes. It may not restore `mjl_document.lib.php`,
upload/download helpers, legacy ECM delivery, public shares, navigation,
document audit events, lifecycle tests, or any document business behavior.
If denial cannot be preserved, access remains closed and the unit is treated
as blocked; legacy behavior is never the fallback.

## Approval and result

The user explicitly approved RST-010A and Phase 4 separately on 2026-08-19.
Phase 4 approval does not broaden this unit. Execution evidence is recorded in
`docs/mjl-rst-010a-execution-report.md`.
