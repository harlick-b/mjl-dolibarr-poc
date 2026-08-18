# RST-008 Execution Report

- Status: `EXECUTED`; the combined operational-log checksum deviation was
  explicitly ratified by DEC-039 on 2026-08-18.

- Authorization: explicit user approval received before mutation.
- Date and target: 2026-08-14, local Docker Compose tenant.
- Result: invitation and reset tables use unique public selectors, hash-only
  secret verifiers, unique live credentials, allowed-state checks, and
  entity/user triggers.
- Lifecycle: issue, accept, revoke, reset, role change, and deactivation use
  locks, transactions, credential invalidation, and audit writes.
- Security: only business roles may be invited; legacy groups and Partner
  scopes are not authorization inputs; reset requests are neutral and
  throttled; fragments are cleared before third-party requests.
- Verification: disposable browser acceptance covered issuance, fragment
  population/clearing, acceptance, replay state, hash nulling, reset
  consumption, and login with both changed passwords.

No production email was sent and no shared invitation/token row was created.

Exact combined cutover evidence and exceptions are recorded in
`docs/mjl-phase1-reset-execution-report.md`.
