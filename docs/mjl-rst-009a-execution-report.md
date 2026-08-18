# RST-009A Execution Report

- Status: `EXECUTED`; the combined operational-log checksum deviation was
  explicitly ratified by DEC-039 on 2026-08-18.

- Authorization: explicit user approval; execution followed completed RST-004
  and RST-008 gates.
- Date and target: 2026-08-14, local Docker Compose tenant.
- Result: the registry contains Accueil; Partenaires, Projets, and Types
  d’Opération; Audit; Utilisateurs et accès; and Administration technique.
- Projection: business roles receive references, Validator receives Audit,
  and native Admin receives technical access plus Audit. Role-less and
  inactive users fail closed.
- Verification: exact registry contract, HTTP 403 direct guards, obsolete
  route 404, native Admin entity-zero handling, and primary Admin form
  rendering passed in the disposable browser gate.

No Phase 2 Activity or Opération navigation was introduced.

Exact combined cutover evidence and exceptions are recorded in
`docs/mjl-phase1-reset-execution-report.md`.
