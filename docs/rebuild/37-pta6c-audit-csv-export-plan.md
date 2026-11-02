# PTA-6C — Audited global-history CSV export

Authority: DEC-102, the approved PTA brief, the security baseline, the export
integrity rules and completed PTA-6B.

## Outcome and boundary

Allow a Validateur définitif or Admin to download the complete sanitized global
history as the CSV action shown in the approved history design. The server takes
one bounded snapshot, generates a UTF-8 BOM, semicolon-separated, French-headed,
formula-safe attachment, rechecks authorization under the shared lifecycle lock,
and records export ID, snapshot time, row count, byte count and SHA-256 evidence
in the existing append-only audit transaction before delivery.

The export contains the same bounded facts as PTA-6B and never raw audit JSON,
request identifiers, proofs, hashes from source events or mutable current roles.
The export-generation event occurs after the snapshot and is not included in its
own file. This slice adds no migration, export table, job, storage URL, historical
download, generic report framework or Partner access. PDF and XLSX audit exports
remain future required formats; this slice does not simulate them.

## Verification

Focused PostgreSQL/API checks cover Validator/Admin access, Agent/Supervisor and
CSRF denial, complete bounded ordering, French/BOM/semicolon/formula-safe bytes,
stable attachment headers, sanitized columns, transactional evidence/hash facts,
rollback and over-limit refusal. React checks cover the approved CSV action,
online-only non-retrying POST, safe browser download, Query invalidation and
authorization/cache loss. Run affected OpenAPI, backend/frontend quality, focused
regressions and the Chromium journey.

## Mandatory independent review

A separate agent that did not implement the change performs a read-only review
of requirements, diff, surrounding code and evidence. The implementer fixes
accepted findings and returns the same candidate to that reviewer for focused
re-review. Completion is blocked until blocking findings and required evidence
gaps are resolved. Stop after PTA-6C.
