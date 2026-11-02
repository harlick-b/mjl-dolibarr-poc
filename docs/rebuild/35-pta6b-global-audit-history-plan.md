# PTA-6B — Global audit history

Authority: the approved PTA brief, DEC-102, the security baseline and the
existing append-only audit representation.

## Outcome and boundary

Give the Validateur définitif and technical Admin a read-only, newest-first
global chronology of MJL actions. Each row shows when the action occurred, its
bounded action/outcome, the recorded actor identity and, when the existing audit
fact identifies one, the related Activity. The API never returns raw audit JSON,
request identifiers, credentials, invitation/recovery proofs or document hashes.

This slice adds one cursor-paginated read responsibility and one French history
screen. It adds no migration, mutation, export, search engine, generic reporting
framework, Partner access or document preview. Global audit export remains a
separate later slice.

## Verification

Focused PostgreSQL/API checks cover Validator/Admin access, denial to Agent and
Supervisor, newest-first signed cursors, invalid limits/cursors, Activity
projection and omission of raw details/business payloads. React checks cover the
role gate, French chronology, Activity links, pagination, offline/session cache
clearing and absence of an unauthorized export action. Run affected OpenAPI,
backend/frontend quality and focused browser checks.

## Mandatory independent review

After implementation, a separate agent that did not implement the change leads
a read-only review of the requirements, diff, surrounding code and verification
evidence. The implementer fixes accepted findings and returns the same candidate
to that reviewer for focused re-review. Completion is blocked until blocking
findings and mandatory evidence gaps are resolved. Stop after PTA-6B.
