# PTA-4B — Activity Fiche PDF readiness and implementation plan

Authority: DEC-122, the approved PTA brief, DEC-102, the security baseline and
completed PTA planning/execution through PTA-4A.

Historical implementation contract. PTA-4B completed on 2026-11-02; see
[status 28](28-pta4b-implementation-status.md).

## Audit verdict

`PTA_4B_READY_FOR_IMPLEMENTATION`

The approved brief supplies a complete bounded contract. A Fiche is a
regenerable administrative summary of current authoritative Activity data; the
immutable revisions, decisions and audit rows remain the proof history. It is
not the global audit export, a stored document, an electronic signature or a
substitute for optional supporting documents.

## Outcome and boundaries

Any verified internal business role may download the Fiche once an Activity has
an approved revision. Draft-only Activities fail closed. The Fiche remains
available while approved work is in progress and after withdrawal or closure,
using the current approved planning baseline and current authoritative execution,
settlement and chronology facts. Admin remains outside business records; future
Partner-scoped access is deferred.

Generate the PDF synchronously in memory and do not persist the binary or an
authenticated response. Record the successful generation/download in the
existing audit table. Show that no supporting documents are registered until the
separately authorized guarded-document slice exists; create no storage seam or
mandatory attachment rule.

Historical as-of regeneration, annual PDF/XLSX/CSV exports, global audit export,
document upload/preview, Partner access, signatures, notifications, real accounts
and production remain excluded.

## Smallest implementation

- Add one focused backend module with one authenticated PDF response. It owns the
  authoritative read projection and PDF rendering behind that single interface.
- Reuse the shared read lock, business principal, Activity/approved-revision
  models, exact XOF facts, financial rows and audit table. Add no migration.
- Include Activity/PTA/Project/Partner context; approved values and Operations;
  actual spending; revision, correction and decision chronology; décaissement and
  virement requests/decisions; current and corrected external confirmations;
  required/declared reversement; closure; supporting-document availability and
  server generation date.
- Add one French download action to the existing Activity screen. Use native
  guarded binary delivery rather than teaching the JSON RestClient about files.

## Verification

Focused disposable-PostgreSQL/API tests verify approved/in-progress and closed
Fiches, authoritative amounts and chronology, all three business roles, Admin and
guessed-ID denial, draft fail-closed behavior, PDF headers/no-store delivery and
the audit row. PDF extraction verifies the actual generated content. Frontend
tests and a real-Chromium journey verify the guarded French action, binary request,
offline masking and mobile visibility. Run focused adjacent workflow regression,
OpenAPI validation, Ruff/mypy, ESLint/Stylelint/Prettier, Vitest, build and
`git diff --check`.

## Mandatory independent review

After implementation and verification, a separate agent that did not implement
the change leads a read-only review of the requirements, diff, surrounding code,
PDF content/delivery, authorization, audit and actual evidence. It reports
findings with severity, file/line evidence, impact and the smallest correction.
The implementer fixes accepted findings and returns the candidate to the same
reviewer for focused re-review. Do not declare PTA-4B complete until that reviewer
returns PASS. Stop after PTA-4B.
