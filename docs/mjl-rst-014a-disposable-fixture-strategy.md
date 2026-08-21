# RST-014A Phase 1 Disposable Fixture Strategy

Status: `APPROVED` (implementation under review).

Approval provenance: the user explicitly approved RST-014A on 2026-08-19.
Execution discovered that the retained tenant uses Dolibarr's native SHA-256
password algorithm. A forced `password_hash` value is not verifiable by
Dolibarr 23 while that global remains active, and changing the global would
invalidate the preserved Admin credential. The native `dol_hash($password,
'0')` correction below preserves the approved per-run credential isolation,
Admin immutability, and native authentication contract.
On 2026-08-19 the user separately approved this native-hash correction,
authorized `tests/fixtures/auth-parallel-worker.php` inside the exact modify
boundary for canonical stdin-only secret transport, and authorized the
post-commit review corrections recorded by this revision.

This unit completes the existing disposable runner with one guarded Phase 1
record-factory interface. It creates no persistent sample dataset, changes no
shared tenant, and restores no legacy seed behavior.

## Corrected live inventory

Already present and retained:

- `tests/fixtures/disposable-compose.override.yml` provides unique named
  database, document, and configuration volumes with read-only source/test
  binds and a loopback-only random port.
- `tests/runner/disposable-policy.js`, `disposable-run.js`, and `run-suite.js`
  reject the shared port/binds, provision unique Compose projects, sanitize
  output, and normally destroy disposable resources after success or failure.
  Current non-`phase1-reset` failures may be retained when
  `MJL_TEST_RETAIN=1`; the new RST-014A mode must explicitly ignore that
  exception and always tear down.
- `tests/helpers/verify-disposable-environment.js` and
  `playwright-global-setup.js` validate the resolved Compose topology before a
  browser suite starts.
- `tests/helpers/mjl-test-runtime.js` exposes shallow raw SQL/scalar helpers;
  Phase 1 and manual-accessibility specs also duplicate direct fixture
  INSERT/DELETE logic.
- `tests/fixtures/auth-parallel-worker.php` and
  `rst010a-document-state.php` are focused failure/concurrency and containment
  fixtures, not a general Phase 1 record factory.
- `custom/mjlfinancement/scripts/bootstrap_poc.php` activates the module
  without seeding. The former seed script/library/package and
  `mjl_dolibarr_poc_sample_data` remain absent.
- Installed Dolibarr 23.0.2 exposes `dol_hash()`/`dol_verifyHash()` in
  `core/lib/security.lib.php`; native `llx_const` has the unique index
  `uk_const(name, entity)`. RST-014A uses those verified native seams without
  reading the Admin password hash.

RST-014A does not claim ownership of earlier runner creation or legacy-file
deletion. Its gap is centralized guarded creation of minimal Phase 1 accounts
and reference preconditions.

Its execution dependencies are executed RST-000A, RST-001, RST-002A, RST-003,
RST-004, RST-007A, RST-008, RST-009A, and RST-010A. A missing, rolled-back, or
unverified dependency blocks this unit.

## Deep fixture interface

Add `tests/helpers/phase1-fixture.js` as the only caller-facing seam:

```js
createPhase1FixtureSet({ namespace, entity, users, references })
  -> {
       users: { [key]: { id, login } },
       partners: { [key]: id },
       projects: { [key]: id },
       operationTypes: { [key]: id }
     }
```

The helper first calls `verifyDisposableEnvironment()` and then passes a JSON
request to `tests/fixtures/phase1-fixture.php`. Callers cannot provide SQL,
table names, passwords, hashes, administrator flags, document paths, ECM rows,
or cleanup statements.

The implementation contract is:

- The request has exactly four required top-level keys: `namespace`, `entity`,
  `users`, and `references`; null, scalar, or missing collections are rejected.
  The adapter emits at most 16 KiB of deterministic canonical UTF-8 JSON. PHP
  checks the byte limit before decoding and uses duplicate-member-aware parsing;
  it rejects duplicate JSON members, invalid UTF-8/JSON, excess nesting, and any
  byte sequence that is not the adapter's canonical encoding before evaluating
  fields. Canonical encoding has no insignificant whitespace, preserves array
  order, renders the integer in shortest decimal form, emits Unicode directly
  while escaping only JSON-required characters, and fixes object-member order
  as `namespace,entity,users,references`; user members as `key,role`;
  reference collections as `partners,projects,operationTypes`; ordinary
  reference members as `key,label`; and Project members as
  `key,label,partnerKey`.
- `namespace` is required, run-unique, 1-24 characters, and must match
  `/^[a-z0-9](?:[a-z0-9.-]{0,22}[a-z0-9])?$/`. Reuse fails; the factory never
  deletes an earlier namespace to make setup pass.
- `entity` is an explicit positive nonzero Dolibarr entity. Every created user,
  role, and business-reference row carries it; references may point only to rows
  created in the same request and entity. Only the two explicitly named
  control-row types use entity 0: one run sentinel and one reservation per
  successful namespace. The input must be a JavaScript safe integer no greater
  than 2147483647.
- `users` is at most eight `{ key, role }` records. Keys are unique safe ASCII
  identifiers matching `/^[a-z][a-z0-9-]{0,19}$/`; role is null or exactly
  `AGENT_SAISIE`, `AGENT_VERIFICATEUR`, or `VALIDATEUR_DEFINITIF`. Login and
  email values are exactly `<namespace>.<key>` (at most 45 bytes, within native
  `llx_user.login varchar(50)`) and `<namespace>.<key>@example.test` (at most
  58 bytes, within native `llx_user.email varchar(255)`). Every created
  user has `admin=0`; the factory never creates or mutates a native
  administrator.
- All user/reference keys additionally reject the reserved map names
  `constructor` and `prototype`. Returned keyed collections are null-prototype
  records; every returned ID is independently checked as a positive JavaScript
  safe integer before the whole result is recursively frozen.
- The top-level object and every nested object reject unknown keys. `users` is
  nonempty. If references are requested, at least one fixture Validator is
  required and the lexically first Validator key is their creator; native
  Admin is never read as a creator.
- The runner creates an independent password per run as the unpadded
  32-character base64url encoding of 24 cryptographically random bytes,
  exposes it to Playwright only as `MJL_TEST_USER_PASSWORD`, and supplies it to
  the disposable PHP factory only through environment fixed at container
  creation. PHP loads Dolibarr 23.0.2's authenticated CLI bootstrap and stores
  only `dol_hash($password, '0')` in `pass_crypted`, using the tenant's active
  native algorithm so Dolibarr can verify the disposable account without
  changing the preserved Admin's hash or the global algorithm; it leaves `pass`
  and `pass_temp` null. The value/hash is never accepted from factory callers,
  returned, logged, written to evidence, or read/copied from the native Admin.
  Sanitization treats it as a retained secret.
- `references` accepts at most eight each of `{ key, label }` Partenaires and
  Types d'Opération plus `{ key, label, partnerKey }` Projets. Keys are unique
  identifiers matching `/^[a-z][a-z0-9-]{0,19}$/`; labels must be valid UTF-8,
  already NFC-normalized, unchanged by Unicode-aware edge trimming, contain no
  C0/C1 control character, and contain 1-112 Unicode scalar values. For each
  reference, `suffix` is the first 12 lowercase hex characters of
  SHA-256 over the UTF-8 namespace, a single `0x00` separator byte, the ASCII
  kind, another `0x00`, and the UTF-8 key. Stored Partenaire names,
  Projet titles, and Type d'Opération labels are exactly
  `<label> [<suffix>]` (at most 127 Unicode scalar values); Partenaire
  `code_client` is `T` plus the first 23 digest characters (exactly 24 ASCII
  bytes), and Projet `ref` is `MJL-T-` plus the first 44 digest characters
  (exactly 50 ASCII bytes). Those bounds fit the inspected Dolibarr 23.0.2
  columns (`nom varchar(128)`, `code_client varchar(24)`, `title varchar(255)`,
  `ref varchar(50)`, operation-type `label varchar(255)`). A digest collision is
  rejected by native uniqueness constraints and rolls back; values are never
  truncated. No Activity, finance, document, ECM, invitation, credential,
  audit-history, or persistent sample row is a factory output.
- `references` contains exactly the keys `partners`, `projects`, and
  `operationTypes`; each array may be empty. A Project's `partnerKey` must
  resolve only to a Partenaire in the same request. Raw foreign IDs are
  forbidden.
- In the same transaction, creation reserves
  `MJL_TEST_FIXTURE_NAMESPACE_<sha256(namespace)>` in disposable `llx_const`
  under entity 0 as its first write. The existing unique constraint serializes
  concurrent identical, disjoint, cross-entity, and replayed namespaces across
  the whole run; every reuse fails generically without deleting or returning
  existing data.
- Creation is one database transaction using prepared statements and a fixed
  table/column allowlist. Failure rolls back the entire request and emits no
  secret or raw database diagnostic.
- Independent disposable evidence takes an all-column native-Admin digest
  immediately before and after every successful, rejected, failed, and
  concurrent factory call. Equality is mandatory; the factory source is also
  statically forbidden from selecting Admin authentication columns or using an
  Admin row as creator/source data.
- The exact return shape above contains only generated integer identifiers and
  derived test logins. It does not return namespace as a separate field and
  never returns entity, labels, roles, email addresses,
  credentials, hashes, SQL, paths, or raw diagnostics. The JS adapter recursively
  freezes it before delivery to callers.

Business journeys continue through HTTP/UI. Direct SQL remains permitted only
inside focused mutation, corruption, concurrency, or read-only evidence probes;
it is not a fixture-setup interface.

## Isolation, data, and teardown boundary

Protected assets are the shared tenant/port, the preserved native Admin,
database and document volumes, auth material, and the absence of persistent
fixtures. The JS helper independently validates the resolved Compose topology
before invoking PHP. During provisioning, the runner generates a 128-bit random
run sentinel. The Compose override injects
`MJL_DISPOSABLE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}` and
`MJL_DISPOSABLE_RUN_SENTINEL` at container creation—never through
`docker compose exec -e`—and provisioning writes the same sentinel to entity-0
`llx_const` as `MJL_DISPOSABLE_FIXTURE_SENTINEL` and to the root-owned mode-0444
file `/var/www/documents/.mjl-disposable-fixture-sentinel`. The file is created
only after the retained recursive document-tree ownership setup has completed.
The runner verifies UID 0 and mode 0444 immediately after creation and before
every call, and invokes the PHP factory only as `www-data`. Before a database
connection, PHP requires the marker, exact `mjl-test-` project name, configured
sentinel, matching sentinel file, UID 0, and exact non-writable 0444 mode. It
then performs a read-only query for
the matching database constant before opening any write transaction. The policy binds all values to
the expected project and dedicated database/document volumes. A forged marker
or environment value alone therefore cannot authorize a write. Sentinel values
are sanitized from all output and disappear only with tenant teardown. Any
failed, missing, or mismatched check blocks all writes.

The only support artifacts are the entity-0 `llx_const` run sentinel, one
entity-0 `llx_const` namespace reservation per successful factory call,
the exact document-volume sentinel above, and a MariaDB client defaults file at
`/run/mjl-test/client.cnf` in a dedicated 1 MiB `noexec,nosuid,nodev`, mode-0700
tmpfs mounted only in the disposable MariaDB service. After topology validation
and before the first SQL command, provisioning atomically creates that file as
root with mode 0600 from the container's existing database credential
environment. It contains separate fixed MariaDB option groups for the existing
application and root credentials, so reset rehearsals select a group without
putting either password in process arguments. It is never bind-mounted, copied to evidence, or exposed to the
Dolibarr service. The outer finalizer unlinks it when reachable; service removal
destroys the tmpfs unconditionally, including after interruption or crash.
This closed list governs only new RST-014A factory/support writes. Existing
RST-003, RST-007A, RST-008, RST-009A, RST-010A, and Phase 1 reset gates may
perform only their already approved disposable mutations, canaries, and outputs;
RST-014A does not take ownership of or broaden those contracts.

The factory performs no case-local teardown. The unique tenant is the cleanup
boundary so immutable audit history is never selectively deleted. Diagnostics
run only in a dedicated killable subprocess, are independently time-bounded to
10 seconds, and are terminated and awaited before the outermost cleanup
`finally`; even a diagnostics operation that never observes cancellation cannot
delay teardown or write a late artifact. The parent supplies its bounded
in-memory redaction set to that worker only through canonical stdin, never argv
or an artifact, so diagnostics are sanitized before their first write as well
as scanned afterward. The worker derives its sole output directory as
`<repository>/test-results/runs/<projectName>`, requires it to equal the
parent-provided identity and path, and rejects symlinked/non-directory
ancestors before creating or writing anything. Cleanup ignores
`MJL_TEST_RETAIN` in RST-014A/RST-013A proof
modes, retries `down -v` three times with bounded calls, and independently
enumerates the exact project-labelled containers/network and expected volumes
before returning. Each teardown attempt is capped at 30 seconds and the entire
cleanup/enumeration phase at 120 seconds; expiry or any surviving resource is a
blocking result naming only nonsensitive resource IDs. First and repeated
SIGINT/SIGTERM signals request abort but
do not bypass the same finalizer. This applies after success, provisioning or
setup failure, test failure, diagnostics failure/timeout, and interruption.

Retained evidence directories are mode 0700 and files mode 0600; they are not
tenant data. Before retaining any artifact or reporting any success, failure,
diagnostics-timeout, or handled-signal outcome, recursively scan logs, JSON, traces, and
other artifacts—including decompressed entries from Playwright trace/archive
formats—for the database/Admin/test credentials, run sentinel, captured
invitation/reset selectors and verifiers, observed token hashes, and their raw,
URL-encoded, and base64 variants. Any hit causes the scanner to delete the
contaminated artifact and any unpacked copy immediately, records only its
relative path and secret category (never the matched value), blocks the unit,
and still runs tenant and temporary-directory cleanup.
An unreadable/corrupt archive or scanner error is itself blocking and discards
the entire unpromoted artifact set rather than retaining unchecked evidence.

Dynamic test secrets are enrolled before first use through an authenticated
runner-owned registry bound to an ephemeral loopback TCP port. Its independent
128-bit per-run capability is inherited only by runner-owned test subprocesses, is
itself registered as a secret, and never appears in argv or an artifact. The
registry creates no filesystem path, rejects noncanonical/oversized requests,
returns a fixed success acknowledgment only after enrollment completes, fails
closed when its coordinates/capability are absent or rejected, times out silent
clients, destroys every accepted socket during bounded shutdown, and closes
before artifact scanning. A nested runner enrolls each generated secret with
both its own registry and its inherited parent registry before first use, so
the outer redactor/scanner remains authoritative if nested sanitization fails.

Because the Phase 1 and manual suites enter Admin, fixture, invitation, and
reset credentials, both Playwright configurations disable automatic trace and
video capture for these suites; a failure must not first serialize a secret and
rely on a later scanner to remove it. Screenshots remain disabled while a
credential field is populated. The archive scanner remains mandatory for any
explicitly produced archive or future configuration regression.

Every migrated caller listed in the exact path boundary removes its fixture-row
`beforeAll` cleanup and `afterAll` DELETE logic. It uses an unused namespace in
a fresh tenant and leaves created records/audit for tenant destruction. A focused failure probe may
restore its temporary trigger, lock, or failpoint in `finally` so later cases
can run, but it may not delete fixture principals, business rows, or immutable
audit history.

Before and after each RST-014A rehearsal, capture the shared tenant's canonical
all-table schema/data digest, exact native-Admin/business-row counts, ECM
all-column digest, complete document-tree root/path/type/mode/content digest, protected
source-tree path/type/mode/content digest, and Compose resource inventory. The
protected source tree is exactly `custom/`, `docs/`, `tests/`, `AGENTS.md`,
`CONTEXT.md`, `DESIGN.md`, `README.md`, `docker-compose.yml`, `package.json`,
`package-lock.json`, and `playwright.config.js`; nothing inside those paths is
excluded. Generated evidence remains confined to the separately enumerated
`test-results/runs/<projectName>/` boundary. The database capture uses one consistent transaction and
lossless canonical encoding of database defaults and every base table,
sequence, view, trigger, routine and routine parameter, event, column, and row in the
complete `dolidb` application database; no application field or row is
excluded. It includes an all-column fingerprint of the native Admin, including
authentication/status fields. `tests/fixtures/database-evidence.php` runs in a
read-only consistent transaction, feeds length-delimited and type-tagged schema,
column, and row bytes directly into SHA-256 contexts, and outputs only digests,
schema summaries, and nonsensitive counts. Plaintext database/Admin/auth/token
manifests are never materialized at a pathname, written to evidence, or emitted
on stdout/stderr. Filesystem/document canonical bytes likewise stream directly
into SHA-256 without a retained path/content manifest. All before/after values
must match. Normal local bootstrap
must still yield one native technical administrator and zero business/sample rows.
Preflight also requires the shared sentinel path and entity-0
`MJL_DISPOSABLE_FIXTURE_SENTINEL` constant to be absent; their presence blocks
the unit rather than being overwritten or excluded.

Affected SQL helpers stop placing the database password in process arguments.
All focused SQL probes use that file and pass statements through stdin. Every
stdout/stderr/exception path uses the central sanitizer.

Actual shared-tenant capture uses the same audited read-only PHP evidence source,
streamed over stdin to the shared Dolibarr container. It reads the already
container-owned `DOLI_DB_HOST`, `DOLI_DB_NAME`, `DOLI_DB_USER`, and
`DOLI_DB_PASSWORD` environment only inside that process; the host never
interpolates or passes a credential in argv, source, stdin, or an artifact.
Static and runtime probes inspect every shared and disposable database client
argv, output, and retained artifact and fail on a credential-bearing argument
or unsanitized value.

The evidence fixture accepts no caller argument, query, identifier, table list,
or payload. Before reading application data it requires the configured database
name to be exactly `dolidb`, starts a server-enforced read-only consistent
transaction, and enumerates only that database through fixed source logic;
identifiers come solely from its own `information_schema` result and are safely
quoted. Its fixed JSON response schema contains only algorithm/version,
digests, table/row counts, and nonsecret schema summaries. Unknown invocation
input, any attempted write, database mismatch, encoding ambiguity, or raw
database error fails generically through the sanitizer.

## Exact implementation paths

Create:

- `tests/helpers/phase1-fixture.js`;
- `tests/fixtures/phase1-fixture.php`;
- `tests/fixtures/phase1-fixture-preflight.php`;
- `tests/fixtures/database-evidence.php`;
- `tests/runner/disposable-evidence.js`;
- `tests/unit/phase1-fixture.test.js`;
- `tests/unit/disposable-evidence.test.js`;
- `tests/e2e/fixture-isolation.spec.js`.

Modify only as required:

- `tests/fixtures/disposable-compose.override.yml`;
- `tests/helpers/mjl-test-runtime.js`;
- `tests/helpers/verify-disposable-environment.js`;
- `tests/runner/disposable-policy.js`;
- `tests/runner/disposable-run.js`;
- `tests/runner/phase1-cutover-rehearsal.js`;
- `tests/runner/run-suite.js`;
- `tests/unit/disposable-policy.test.js`;
- `tests/unit/disposable-run.test.js`;
- `tests/e2e/phase1-reset.spec.js`;
- `tests/e2e/auth-concurrency.spec.js`;
- `tests/e2e/cases/partner-project.cases.js`;
- `tests/e2e/document-containment.spec.js`;
- `tests/fixtures/rst010a-document-state.php`;
- `tests/fixtures/auth-parallel-worker.php`;
- `tests/manual/accessibility-gate.spec.js`;
- `tests/manual/playwright.config.js`;
- `playwright.config.js`;
- `package.json`;
- `docs/mjl-acceptance-tests.md`;
- `docs/mjl-test-coverage-registry.md`;
- `docs/mjl-reset-manifest-v2.md`;
- `docs/mjl-implementation-roadmap-v2.md`;
- `docs/mjl-docs-index.md`;
- `docs/mjl-authoritative-decisions.md`;
- `docs/mjl-decision-register-v2.md`;
- `docs/mjl-rst-014a-disposable-fixture-strategy.md`;
- planned `docs/mjl-rst-014a-execution-report.md`.

Any implementation need outside this literal create/modify list stops the unit
for an amended strategy review and separate explicit approval.

Retain unchanged:

- `tests/helpers/playwright-global-setup.js`;
- non-seeding `custom/mjlfinancement/scripts/bootstrap_poc.php`;
- continued absence of `custom/mjlfinancement/scripts/seed_sample_data.php`,
  `custom/mjlfinancement/lib/mjl_sample_data.lib.php`,
  `custom/mjlfinancement/sample_data`, and
  `mjl_dolibarr_poc_sample_data`.

Once separately approved, implementation records the approval provenance and
unit status in the decision register and updates the authority's current reset
state. Execution records its verified result there as well. Rollback records a
new rolled-back status/provenance entry and updates current state; it never
erases the approval or execution history.

## Verification and rollback

Unit tests reject a missing/mismatched marker, project name, file sentinel, or
database sentinel; shared port/project/bind; entity 0, negative, fractional,
overflow, or non-safe entity; invalid/duplicate namespace; login/email derived
length overflow; non-NFC, edge-whitespace, control-bearing, invalid UTF-8, or
oversized label; derived reference overflow/collision; empty users;
unknown top-level/nested keys; duplicate/invalid keys; oversized arrays or
strings; missing Validator for references; native-admin request; unsupported
role; raw/cross-entity foreign ID; nonlocal `partnerKey`; arbitrary
SQL/table/path/credential field; secret-bearing output; and partial-transaction
result. Concurrent identical, disjoint-payload, and same-namespace/different-
entity reuse yields one complete winner and one generic loser. Wrong sentinel
owner, group/other writability, non-0444 mode, or non-`www-data` factory
execution is rejected. A valid request returns only the exact IDs/login shape
and is recursively frozen.

Artifact tests inject a secret-bearing file into each reachable success,
ordinary-failure, setup-failure, diagnostics-timeout, SIGINT, and SIGTERM
finalization path and prove it is deleted before the sanitized outcome is
reported or any other artifact is retained.
Acknowledgment tests prove a registration promise cannot resolve before the
runner has enrolled the value, and that missing coordinates, a wrong
capability, and malformed requests all fail closed. A nested-output probe emits
a registered child secret into the parent capture boundary and proves the outer
redactor/scanner recognizes it.

Disposable E2E uses distinct namespaces to prove role-less and each permitted
role can be created in two entities without cross-entity linkage; business reference prerequisites work
through existing UI journeys; no persistent seed source appears; and cleanup
is complete after success, setup failure, ordinary failure, diagnostics
failure, a never-resolving diagnostics stub, repeated SIGINT, and repeated
SIGTERM against real runner subprocesses. The complete write-capable fixture is
run with the sentinel absent only against a fresh disposable topology containing
synthetic nonsecret canaries and no copied shared row, file, credential, or
Admin authentication material; it must fail before database connection and the
canaries must remain unchanged. Against the actual
shared container, the runner invokes only the separately auditable
`phase1-fixture-preflight.php` guard entrypoint, which contains no database
bootstrap, client, query, or creation path and must fail on the absent file.
Static control-flow checks prove the write-capable fixture requires that exact
preflight before importing Dolibarr or opening a database connection. The full
shared digests/Admin fingerprint must remain equal.

Run focused RST-014A, unit, verification, and full E2E gates, plus PHP syntax
checks for both new PHP fixtures and the modified RST-010A PHP fixture.

Completion order is fixed: write the execution report with exact results;
commit the complete RST-014A unit; rerun any gate whose evidence did not come
from that committed source; then independently review the fixed baseline-to-unit
range on Standards and Spec axes. Apply only narrow fixes, rerun affected and
public gates, recommit, and repeat both full-range reviews until each reports
zero actionable findings. Only then may canon mark RST-014A executed and
RST-013A become executable.

The focused public command is `npm run test:rst014a`. Static/source checks also
prove no Phase 1 or document-containment fixture uses a password-bearing process
argument, reads/copies the native Admin password hash for fixture creation,
performs case-local fixture cleanup, or permits RST-014A retention. The retained
RST-010A fixture hashes `MJL_TEST_USER_PASSWORD` with native `dol_hash()` and its
browser case uses only that credential for its business user; native Admin
authentication remains confined to explicitly technical Admin journeys.

Rollback removes the general factory interface/adapter and its focused tests,
but the credential, safe SQL channel, central sanitizer/scanner, bounded
unconditional tenant teardown, RST-010A fixture credential separation, and
prohibition on case-local fixture/audit deletion are irreversible
containment/isolation hardening and remain. Caller-specific setup may be
restored only in a hardened form that hashes `MJL_TEST_USER_PASSWORD`, uses the
defaults-file/stdin SQL channel, creates no Admin-derived credential, and leaves
all records to tenant teardown. Rollback verification reruns static/runtime
no-Admin-hash, no-password-argv, no-selective-delete, secret-artifact, shared-
state equality, and teardown gates. It never restores a seed script, sample
package, persistent fixture, deleted business data, or legacy document behavior.
If RST-013A has executed, it must be rolled back first; RST-014A cannot be
removed while an approved downstream test suite depends on its interface.

The literal rollback disposition is:

- Remove `tests/helpers/phase1-fixture.js`,
  `tests/fixtures/phase1-fixture.php`,
  `tests/fixtures/phase1-fixture-preflight.php`, and
  `tests/unit/phase1-fixture.test.js`.
- Retain `tests/fixtures/database-evidence.php`,
  `tests/runner/disposable-evidence.js`, and
  `tests/unit/disposable-evidence.test.js` as isolation hardening. Retain
  `tests/e2e/fixture-isolation.spec.js`, but remove its factory-interface cases
  and retarget it to the hardened rollback/shared-state/cleanup contract.
- In `tests/fixtures/disposable-compose.override.yml`, remove only the
  factory-specific project-name/run-sentinel variables and document-sentinel
  provisioning; retain `MJL_TEST_USER_PASSWORD` and the MariaDB client-defaults
  tmpfs. Remove the entity-0 database run sentinel and every namespace
  reservation with disposable tenant teardown; never delete them selectively.
- In `tests/helpers/verify-disposable-environment.js`,
  `tests/runner/disposable-policy.js`, `tests/runner/disposable-run.js`,
  `tests/runner/run-suite.js`, `tests/unit/disposable-policy.test.js`, and
  `tests/unit/disposable-run.test.js`, remove only general-factory/sentinel and
  `rst014a`-mode dispatch. Retain topology isolation, non-Admin credential
  channel, safe client-defaults/stdin SQL, streaming shared evidence, bounded
  diagnostics, repeated-signal handling, secret scanning, unconditional
  teardown, and their tests.
- Retain all security changes in `tests/helpers/mjl-test-runtime.js`,
  `tests/runner/phase1-cutover-rehearsal.js`,
  `tests/e2e/document-containment.spec.js`,
  `tests/fixtures/rst010a-document-state.php`,
  `tests/manual/accessibility-gate.spec.js`, both Playwright configurations,
  and the Phase 1 E2E callers. Replace general-factory calls in
  `tests/e2e/phase1-reset.spec.js`, `tests/e2e/auth-concurrency.spec.js`, and
  `tests/e2e/cases/partner-project.cases.js`, plus
  `tests/manual/accessibility-gate.spec.js`, only with caller-specific hardened
  setup obeying the retained credential/SQL/no-delete rules.
- In `package.json` and active test docs, remove only the public RST-014A
  factory command/interface claims; retain the public isolation/evidence gates.
  Keep this strategy and the execution report as historical provenance, and
  append rollback status to `docs/mjl-decision-register-v2.md` while updating
  current state in `docs/mjl-authoritative-decisions.md`, the reset manifest,
  roadmap, docs index, acceptance guide, and coverage registry.

## Approval boundary

Only an explicit `I approve RST-014A` authorizes implementation. Approval of
RST-013A, Phase 1, Phase 4, this overall plan, or another reset ID is not a
substitute. Approval authorizes only the exact paths, data shapes, verification,
and rollback boundary above.
