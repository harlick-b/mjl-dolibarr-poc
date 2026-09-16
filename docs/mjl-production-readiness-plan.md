# Deferred Production Readiness Questions

Production preparation and readiness assessment are outside the current
development scope. Do not run the production-readiness audit, configure a
production environment, or issue a readiness verdict unless the user explicitly
requests that work.

The existing CLI diagnostic is development tooling. Its output and any passing
tests do not mean the user accepted the application or that it is ready for
production.

## Unknown future inputs

- public hostname, TLS termination, and application base URL;
- mail transport and sender;
- secret custody and rotation;
- persistent database, document, and configuration storage;
- production backup, restore, monitoring, logging, and ownership;
- session and PHP error settings;
- accessibility acceptance by the user;
- final permissions and inclusion of Phases 4, 5, and 6;
- accounting rules and official Partner report templates if those phases are
  requested.

Keep each item `Needs confirmation`. Do not copy local Docker values or
disposable-test evidence into a future production configuration.
