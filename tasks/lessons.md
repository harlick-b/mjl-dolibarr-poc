# Reusable Lessons

Update this file only after repeated mistakes, user corrections, or durable
debugging discoveries. Do not add one-off observations or generic advice.

- Dolibarr core files must not be edited for MJL work; use the custom module,
  documented setup scripts, documentation, disposable test-fixture locations, or a
  documented safe theme boundary.
- UI hiding is not access control. Direct URL and direct POST routes must stay
  guarded server-side.
- Active Dolibarr entity filtering is mandatory for custom objects, dashboards,
  exports, audit lists, document lookups, and workflow lookups.
- No-self-validation is a domain rule and must be enforced outside button
  visibility.
- Guarded ECM downloads must check entity, source type, source id, object
  access, and safe filesystem paths.
- Legacy POC roles, groups, and sample records are not target evidence and must
  not be mapped into the clean target model.
- Future-only or internal roadmap features must not appear as available user
  actions.
- `MjlConvention` is the current funding-envelope model unless confirmed
  business rules prove it insufficient.
- MJL exports should remain French-labeled, Excel-readable, filtered
  server-side, and stable in filename/format.
- Production readiness requires current evidence in the readiness matrix,
  deployment checks, and test results; historical pass counts are not current
  verification.
- Operational diagnostics must reference the maintained current-purpose
  verifier, not a deleted phase/version-era script. Cover the path statically so
  readiness checks cannot silently report a false missing-control failure.
- A CLI operational script under a web-published custom module needs both a
  server-level route-family deny and an in-script CLI guard. `NOLOGIN` is not a
  CLI boundary and can turn bootstrap, seed, or diagnostics into anonymous web
  entrypoints.
- Validation verdicts must name their evidence boundary. Automated responsive
  checks cannot stand in for a required signed human keyboard/reflow/real
  browser-zoom matrix; keep the verdict pending until that evidence exists.
- Dolibarr `fetchCommon()` object paths may expose `id` while SQL row arrays
  expose `rowid`; MJL access helpers that accept both objects and arrays should
  normalize the identifier before object-scope checks.
- Budget-line checks must distinguish committed budget consumption from actual
  disbursement: `committed_amount` follows final-validated/budget-consuming
  expenses, while `spent_amount` follows disbursed expenses.
- For Apache `ErrorDocument` pages that should use the authenticated Dolibarr
  session, prefer `NOREDIRECTBYMAINTOLOGIN` over `NOLOGIN`; `NOLOGIN` avoids a
  login redirect but does not hydrate the session user for MJL shell rendering.
- An Apache authorization `ErrorDocument` runs as an internal subrequest and
  can return HTTP 403 while its PHP page fatals after a partial Dolibarr
  bootstrap. For hard-containment denials, prefer a dependency-free error
  response and inspect fresh server logs in addition to status/body assertions.
- Native-boundary checks must probe adjacent Dolibarr route families, not only
  named blocker routes; `/admin/*`, native `/user/*`, and dormant module routes
  can render native chrome even when the first blocked routes pass.
- E2E assertions for dated activities must not assume a fixed fixture remains
  before its deadline. Assert persisted execution controls and workflow state
  separately from the date-sensitive overdue label.
- HTTP filter normalizers must treat absent and empty default controls
  consistently. Test the unfiltered route as well as malformed values; a
  fail-closed parser can otherwise turn every default list request into an
  empty result without exposing a syntax or runtime error.
- Polymorphic audit-target resolution needs one entity-matched registry shared
  by every diagnostic caller. When a new audited object type is introduced,
  update that registry and prove both a valid anchor and a missing target;
  duplicated join lists silently misclassify otherwise valid audit rows.
- Fresh Docker initialization and root-run fixture setup can leave disposable
  document or ECM subdirectories owned by root with mode `0755`, which blocks
  upload and test-outbox E2E despite correct application behavior. Normalize
  web-user ownership only inside verified disposable named volumes or binds,
  including after case-local root setup; never change shared workspace storage.
- A fresh Dolibarr Compose container can report `Up` while its installer is
  still importing tables and has not created the Admin user. Before running
  `bootstrap_poc.php`, verify installer completion through a read-only Admin
  user readiness check inside the named disposable database; container state
  alone is not a sufficient readiness signal.
- E2E journeys must resolve seeded business objects by stable entity/ref keys,
  not hard-coded row IDs. Auto-increment order on a clean database can map the
  same ID to a no-self or different-workflow fixture and make a UI assertion
  fail before the behavior under test is reached.
- Recovery fields that represent validated option selections must be alias-only:
  derive them server-side after authorization, never fall back to same-named
  request fields, and revalidate them against current scoped options before
  rendering. Cover both valid retention and request-injected aliases.
- A legacy E2E suite that bootstraps, seeds, cleans up, or changes document
  ownership must call the disposable Compose verifier before its first
  mutation. Supplying temporary environment variables during one run is not a
  safety boundary for future direct invocations.
- Presentation-copy convergence must include a repository-wide scan of exact
  E2E labels across every spec before the full disposable rerun. Updating only
  the feature's primary test file can leave equivalent auth, email, or shell
  selectors stale and force otherwise avoidable environment rebuilds.
- A presentation-wide French accent correction must classify every changed
  string before editing. Accent visible copy and presentation metadata only;
  never rewrite form keys, DOM/test identifiers, persistence literals, domain
  error classifiers, audit/ECM values, or historical compatibility mappings.
- A materially changed approved design package needs a clean next generation,
  not edits to an immutable snapshot or a wholesale copy. Migrate every useful
  artifact through a ledger, validate the candidate, update all active
  pointers, and remove the retired package so typography and token guidance do
  not remain split across stale authorities.
- A mounted Apache policy must not assume optional modules are enabled in the
  Dolibarr image. Validate server startup after every directive change; for a
  browser referrer boundary, a repository-owned HTML meta policy and per-link
  `referrerpolicy` can provide defense in depth while the production response
  header remains an explicit reverse-proxy gate.
- Role, scope, and account-deactivation changes must persist their access audit
  inside the same transaction. If audit insertion fails, roll back every
  authorization mutation and return only a safe user-facing failure.
- Backup/restore capture and comparison commands must use Bash fail-fast mode
  with `set -euo pipefail` and isolate directory changes in subshells (or use
  absolute paths). Apply pipefail inside helper-container shells too. Never
  print a PASS marker after unchecked `cmp`, `diff`, checksum, or piped capture
  commands; a changed working directory or successful final pipe stage can
  otherwise mask failed verification while leaving artifacts untouched.
- A checksum-approved clean reset must derive deletion predicates from every
  inventoried row's actual entity and identifier; do not assume custom rows
  all use the active entity. Keep the mutation transactional so a surviving
  foreign key fails closed, then prove every table count and file hash rolled
  back before correcting the plan.
- Dolibarr module activation can rerun historical update SQL even when the
  module is already installed. Removing seed scripts is insufficient if an old
  update file still contains data backfills. Run the non-seeding bootstrap and
  persistent-absence verifier in sequence, and strip obsolete backfills while
  retaining required schema/index/constraint operations.
- Manual targeted Playwright runs must satisfy the same disposable identity
  contract as the public runner: use an `mjl-test-` Compose project name and
  set the repository root, base URL, port, Compose files, and isolated output
  path explicitly. A container starting is not evidence that the disposable
  guard accepted the run; only test output after global setup is valid.
- When a reset contract retires an authorization helper or input, renaming it
  behind a compatibility shim does not remove the dependency. Delete both the
  definitions and callers, make each retained seam explicitly fail closed, and
  keep a runtime-wide structural test that rejects replacement-name families.
- Sequential browser submissions do not prove row-lock serialization. For a
  concurrency acceptance gate, use disposable-only deterministic barriers that
  hold the real native mutation inside its transaction, start the competing
  request while the lock is held, and verify both orderings plus teardown.
- Direct disposable inserts into native Dolibarr tables must include the exact
  current mandatory actor/entity fields and cleanup native relationship rows.
  Prefer native creation paths for journey fixtures; reserve raw poison rows
  for integrity/visibility cases backed by exact schema knowledge.
- Dolibarr's `accessforbidden()` can render a denial document without changing
  an already-successful HTTP status. Public controllers must set status 403
  explicitly before calling it, and browser tests must assert both the status
  and denial surface.
- A route can pass navigation smoke tests while failing after the shell starts
  because a presentation helper was only transitively available elsewhere.
  Exercise each newly exposed destination to its primary form/content, and
  treat PHP fatal-log scans as part of the route gate.
- Dolibarr may invalidate a deactivated user's session before a custom guard
  runs and redirect to a 200 login page. Immediate-access-loss tests must prove
  that no protected workspace rendered and that the response is either an
  explicit denial or the authenticated session returned to login; status alone
  is not the security property.
- Static inspection of a destructive executor is not execution evidence. A
  reset gate must start from the exact pre-cutover commit, capture checksummed
  source/database/schema/document evidence, stop traffic, exercise each
  interruption and activation window, perform the rollback, restore the full
  database into a freshly recreated schema, and compare a canonical dump.
- Explicitly passing a Playwright file does not override a restrictive
  `testMatch` allowlist. Every new E2E file must be added to discovery and the
  focused gate must assert the expected executed-test count before its result
  is accepted.
- Dolibarr 23's `activateModule()` returns an array with an `errors` member;
  comparing that result numerically can report failed activation as success.
  Treat a non-empty error array as failure, keep native activation idempotent,
  and force initialization only for the custom module that needs current SQL.
- A Compose one-off service normally runs the image entrypoint before its
  command. For stopped-traffic recovery rehearsals, share only the isolated
  generated configuration volume and override the entrypoint explicitly;
  otherwise even rejected evidence can mutate operational files such as
  `initdb.log` before the guarded script begins.
- MariaDB refuses `RENAME TABLE` while the same session owns explicit
  `LOCK TABLES`. A cutover that needs both a locked zero-row recheck and atomic
  rename must close the unlock boundary with a separately verified write-denial
  guard, model the guarded pre/post-rename states explicitly, and rehearse
  crash recovery from both.
- Restarting a disposable container clears tmpfs-backed client configuration.
  Crash/restart tests must reconstruct the hardened credential file from the
  container's already-scoped disposable secrets before readiness checks; a
  missing tmpfs file is not a database recovery failure.
- MariaDB can advance an `AUTO_INCREMENT` counter for a rejected insert. Tests
  that demand complete before/after database digest equality should give
  invalid probes explicit non-allocating technical IDs; row-count equality
  alone misses allocator drift.
- A launcher cannot determine whether an already-open inherited file descriptor
  was originally opened through a symlink. For protected operator inputs, open
  fixed custody names inside the launcher with no-follow semantics, validate
  canonical root-owned parent custody, and then use inherited descriptors only
  for onward secret transport.
- An interrupted synchronous Docker wrapper can leave both its operator
  container and nested nonce-scoped restore resources alive. Give every such
  resource an exact derivable name, handle termination through `finally`, remove
  and retry the exact names, and enumerate containers, networks, volumes, and
  custody roots before accepting teardown.
- `docker compose run -T` disables TTY allocation but does not reliably close
  stdin across a nested Docker-socket launcher. For evidence scripts that read
  stdin to reject unexpected input, also pass `--interactive=false`; otherwise
  they can block in `pipe_read` before opening a database connection.
- An inherited descriptor proves only that a process opened a lock inode, not
  that it owns an exclusive flock. Verify the descriptor's kernel lock record
  and an independent nonblocking contention probe. When Docker-daemon children
  can outlive the launcher, give mutating children a second stable lease that
  every new launcher checks before trusting the released outer lock.
- Mutable image validation before `compose run` leaves a tag check/use race.
  Create one-offs from the approved image ID with pulls disabled, inspect the
  still-created container's image, rootfs, capabilities, security options,
  mounts, network, and entrypoint, and only then start it.
- Durable hash chaining does not imply valid workflow ordering. Validate every
  record transition against an explicit crash-prefix grammar, make recovery and
  rollback resumable from their published checkpoints, and reject raw report
  copies that lack an identical durable record.
- Independently implemented evidence encoders must share byte-exact framing for
  nulls and delimiters, and their parity tests need nonempty retained rows with
  nullable fields. Empty disposable tables can make incompatible encoders
  appear identical until a shared-shaped backup is restored.
- Docker `--rm` completion and daemon list visibility are not atomic. Exact-name
  cleanup needs a bounded convergence window with immediate permission aborts;
  remove and confirm owner containers before removing their dependent networks
  or volumes. The test assertion should poll read-only categorical survivor
  queries while a separate finalizer remains responsible for exact removal.
- MariaDB `information_schema` ordering follows database collation, while PHP
  `SORT_STRING` is bytewise. Exact schema detectors must normalize and sort
  both expected and observed identifier sets in the same runtime before
  comparing them, and must compare index uniqueness plus ordered columns rather
  than names alone so same-name weakened indexes cannot pass verification.
