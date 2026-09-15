# MJL Deployment Decision Checklist

This checklist records inputs for a later deployment decision. Phase 3C does
not perform these actions and does not make the application production-ready.

## Evidence required from Phase 3C

- Exact RST-012 schema and empty-start diagnostic.
- Direct authorization, POST, active-entity and containment tests.
- Disposable database, implemented document/configuration storage restore.
- Reconciler pagination/idempotence, error paths and bounded-volume performance.
- Secret-free evidence, shared-state equality and complete disposable teardown.
- One of the canonical integration verdicts, always followed by: `This verdict
  does not authorize production launch.`

## Client and operator confirmations still required

- Choose the production hostname, TLS/reverse-proxy behavior and public/base
  URL used by invitations and password resets.
- Choose and prove the production mail transport and sender.
- Define secret custody, database/document/configuration persistence, backup
  schedule, retention, restore ownership and monitoring/logging procedures.
- Confirm production session, PHP error-display and log-access settings.
- Confirm the reverse proxy preserves `Referrer-Policy: same-origin` on login,
  invitation, password-reset and MJL pages so application paths and query
  tokens are not sent as cross-origin referrers.
- Decide the allowed Inter font delivery policy and matching CSP.
- Complete the named human keyboard, screen-reader, reflow and real 100%/200%
  browser-zoom review. Automated checks do not replace its signature.
- Decide which gated Phase 4–6 capabilities are part of the future launch.

Unknown values remain `Needs confirmation`. Do not copy local Docker values or
test evidence into production configuration.

## Later deployment sequence

Only after a separate go-live approval: take verified backups, deploy committed
source, activate the module through the documented guarded path, run the
read-only diagnostic against the intended environment, run approved smoke
checks, and retain sanitized evidence. Keep native workspace and operational
script HTTP guards active. Any schema, authorization, isolation, restore or
teardown failure blocks release.
