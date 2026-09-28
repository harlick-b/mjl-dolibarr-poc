# Deferred Deployment Checklist

Deployment work is outside the current development scope. This file records
future questions only; it authorizes no action. Do not execute this checklist
until the user explicitly requests deployment preparation.

Future work will need the user or operator to define the public hostname,
application base URL, TLS and proxy behavior, mail transport and sender, secret
custody and rotation, persistent database/document/configuration storage,
backup and restore ownership, monitoring and logging, session and PHP error
settings, accessibility acceptance, final permissions, and whether Phases 4,
5, and 6 are included. If accounting or official Partner reports are requested,
their rules and templates also need a decision. The future reverse proxy must
preserve `Referrer-Policy: same-origin` so application paths and query tokens
are not sent as cross-origin referrers.

All values remain `Needs confirmation`. Local Docker settings, disposable test
fixtures, implemented phases, and passing tests are not production evidence.
