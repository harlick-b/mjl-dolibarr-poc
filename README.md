## MJL Dolibarr Workspace

## Dedicated application rebuild

The rebuild foundation, authorized A1–A3 access slices and PTA-1 contain a French
shell, service-health checks, first-Admin authentication, ordinary account
administration, synthetic password recovery, and draft Project/PTA/Activity
planning with Agent coordination assignments.
A1 is disabled by default and restricted to explicit isolated synthetic policy
and private fake-email capture. Real accounts and later business slices remain
unauthorized. See [authority](docs/mjl-authoritative-decisions.md)
and [verification state](docs/mjl-implementation-roadmap-v2.md).

### Rebuild development

Prerequisites: Docker Compose v2, Node 22.12+ (22.x) or 24.x, and uv 0.9.26 with
Python 3.13 for host-side backend commands. Lockfiles are committed.

```bash
cp .env.example .env
python3 -c "from pathlib import Path; import secrets; p=Path('.env'); p.write_text(p.read_text().replace('REPLACE_WITH_GENERATED_LOCAL_HEX', secrets.token_hex(24))); p.chmod(0o600)"
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev config --quiet
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev up -d --build --wait
```

Frontend: <http://127.0.0.1:5173/>. Backend OpenAPI: <http://127.0.0.1:8000/docs>
and `/openapi.json`. Vite forwards `/api` to the backend; no permissive CORS or
browser-held credentials are needed for these public endpoints. PostgreSQL is
reachable only inside this Compose network; it has no published host port.
Images run the application processes as non-root users. These are development
images, without production hosting or deployment configuration.

`frontend/` owns JSX routes, Query state, tokens, components and PWA assets.
`backend/app/` owns health and authentication routes, policy and PostgreSQL use cases;
`backend/migrations/` owns the foundation and A1 revisions. Backend and frontend
tests cover the foundation plus the explicitly isolated A1 journey.
`.github/workflows/foundation.yml` runs independent quality checks, with no deployment.
The existing root npm package and `docker-compose.yml` still belong to the POC.

Install host tooling and enable the lightweight staged-file hook:

```bash
npm --prefix frontend ci
(cd backend && uv sync --frozen --python 3.13)
```

For frontend editing, stop the Compose frontend before using the same port:

```bash
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev stop frontend
npm --prefix frontend run dev
```

For backend host development, stop the Compose backend first to free port 8000:

```bash
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev stop backend
```

Use the host frontend above with this alternative. From `backend/`, set `DATABASE_URL` to a complete
`postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE` URL for a separately
available local PostgreSQL instance, then run
`uv run uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000`.
The normal Compose setup supplies that URL internally; it does not expose its
database to enable host development. Rebuild the backend image after source edits
when using Compose. Neither startup path runs migrations automatically.

Apply migrations explicitly:

```bash
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev exec -T backend alembic upgrade head
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev exec -T backend alembic current
```

At head, Alembic creates its version table, seven auth tables, and eight PTA-1
relations. It creates no users, reference rows, Projects or other seed data.
The URL comes from the environment, and malformed configuration errors omit
credentials. Each request releases its session without implicit commit. Liveness
returns `{"status":"ok"}` without connecting to PostgreSQL. Readiness executes
`SELECT 1`, returning 200/`ok` or a sanitized 503/`unavailable`; both use `no-store`.

Stop development safely, retaining its database volume:

```bash
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev down
```

### Focused foundation verification

Use a separate disposable project and database. The commands below never target
the development or Dolibarr project. Integration tests refuse database names
without the `mjl_test_` prefix. Do not point them at shared or retained data.

```bash
sed -e 's/POSTGRES_DB=mjl_foundation/POSTGRES_DB=mjl_test_foundation/' -e 's/MJL_FRONTEND_PORT=5173/MJL_FRONTEND_PORT=5183/' -e 's/MJL_BACKEND_PORT=8000/MJL_BACKEND_PORT=8013/' .env > .env.foundation-test
chmod 600 .env.foundation-test
export COMPOSE_FILE=compose.rebuild.yaml COMPOSE_PROJECT_NAME=mjl-foundation-test COMPOSE_ENV_FILES=.env.foundation-test
docker compose config --quiet
docker compose up -d --build --wait
npm --prefix frontend run lint
npm --prefix frontend run format:check
npm --prefix frontend run lint:css
npm --prefix frontend run test:unit
npm --prefix frontend run build
docker compose exec -T backend ruff check .
docker compose exec -T backend ruff format --check .
docker compose exec -T backend mypy app
docker compose exec -T backend sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -q'
(cd frontend && npx playwright install chromium)
API_PROXY_TARGET=http://127.0.0.1:8013 npm --prefix frontend run test:e2e
curl -fsS http://127.0.0.1:8013/api/health/live
curl -fsS http://127.0.0.1:8013/api/health/ready
curl -fsS http://127.0.0.1:8013/openapi.json
```

Pytest validates the generated OpenAPI schema, response contracts, real database
connectivity, transaction cleanup and repeatable migration with no business
tables. Chromium checks routing, proxy, visual tokens, installability, offline
failure, cache contents and update confirmation. The PWA caches only built static
assets and the two public shell routes. API/auth/private responses are not
cached; no mutations are queued or replayed. Offline health never displays a
cached successful status. Installation is browser-dependent and requires a
secure context (localhost qualifies). New service workers wait for confirmation.
There is no generic “install” prompt or offline business mode.

ESLint checks JS/JSX and React Hooks; Prettier owns frontend formatting;
Stylelint checks CSS; Ruff owns Python lint/format; mypy checks application types.
Husky/lint-staged run changed frontend files only. CI runs full foundation checks
independently of hooks. No browser/container suite runs on commit.

After verifying that these resources belong to your disposable test project:

```bash
docker compose ps -a
docker volume inspect mjl-foundation-test_postgres_data --format '{{ index .Labels "com.docker.compose.project" }}'
# Proceed only if the label is exactly mjl-foundation-test.
docker compose down --volumes --remove-orphans
unset COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_ENV_FILES
```

Do not remove other projects, volumes or images. The dependency advisory tracked
in the [gap analysis](docs/mjl-current-vs-target-gap-analysis.md) concerns developer
CSS tooling; this foundation is not production approval.

## Retained Dolibarr POC

All remaining commands below apply to the historical POC only. It remains
available as behavioral reference and has never been deployed to production.

This repository contains a Dockerized Dolibarr 23.0.2 installation with the
custom MJL workspace module under `custom/mjlfinancement`.

## MJL Documentation Authority

For MJL work, read `docs/mjl-authoritative-decisions.md` first.

Do not follow older POC docs, executed plans, historical prompts, or stale
N1/N2/DPAF instructions.

Use `docs/mjl-current-app-functional-map.md` only as current-state evidence.

If code conflicts with authoritative decisions, treat the code as
implementation debt and record it in `docs/mjl-current-vs-target-gap-analysis.md`.

If a doc conflicts with authoritative decisions, update, merge, or delete the
stale doc.

## Local Runtime

Start Dolibarr:

```bash
docker compose up -d
```

Open:

```text
http://127.0.0.1:8080/
```

The retained `bootstrap_poc.php` only activates the approved module set and
disables unsafe native workspace modules. It creates no users, roles, groups,
Partners, Projects, business records, documents, or sample data. The shared
local tenant remains empty except for one native technical administrator.

The spending approval migration is installed locally and verified by six focused
workflow/export checks. Fresh module installation
includes its schema. Existing tenants must run the guarded migration before
reactivation:

```bash
docker compose exec -T dolibarr php /var/www/html/custom/mjlfinancement/scripts/install_spending.php
```

It refuses existing manually recorded spending rather than inventing approval.
The shared tenant retains one administrator and no business or sample records.

Target tests create their own minimal records only inside isolated disposable
tenants and remove those tenants after the run. A new persistent demonstration
dataset is deferred until all implementation phases are complete.

## Verification

Use `docs/mjl-acceptance-tests.md` to choose the smallest focused check for the
current change. `docs/mjl-deployment-checklist.md` records deferred questions
only and must not be executed until the user explicitly requests deployment
preparation.

For a fast source check:

```bash
npm run test:unit
```

Container-backed tests use isolated disposable tenants, create only the records
needed by each check, and tear down their tenants afterward. They do not use a
persistent sample-data seed.

### Isolated A1 browser verification and operator bootstrap

A1 is off in the ordinary development environment. Its test-only policy is
specified in [readiness §12](docs/rebuild/04-authentication-access-readiness.md).
Do not substitute real identities or SMTP. PC1/PC2 remain pending sponsor/RSSI
approval. `/login`, `/invitation`, `/verification` and `/identity` are the four
French UI routes. Invitation URLs use a fragment removed before inspection;
password setup does not log the user in. The login requires the six-digit email
code. Logout is confirmed only after the server revokes the context; after a
network interruption the user must deliberately retry.

The following creates only `mjl-a1-test` and private `/tmp/mjl-a1-*` fixtures.
First ensure that project name/ports 5183, 8013 and 4173 are unused. The private
mailbox is the test transport; there is no HTTP mail reader. Shell/container
execution access is required for bootstrap. The normal app cannot create an Admin.

```bash
python3 - <<'PY'
import json, os, secrets
from pathlib import Path
mail = Path('/tmp/mjl-a1-mail-browser')
mail.mkdir(mode=0o700)
env = Path('/tmp/mjl-a1.env')
env.write_text('POSTGRES_USER=mjl\nPOSTGRES_DB=mjl_test_a1\n'
               'MJL_FRONTEND_PORT=5183\nMJL_BACKEND_PORT=8013\n'
               'POSTGRES_PASSWORD=' + secrets.token_hex(24) + '\n')
env.chmod(0o600)
policy = dict(fixture='a1-synthetic-v1', password_min=8,
    invitation_seconds=604800, otp_seconds=600, otp_attempts=5,
    otp_lock_seconds=600, resend_seconds=60, resend_max=3,
    context_seconds=900, login_window_seconds=900, login_limit=10,
    ip_window_seconds=60, ip_limit=120,
    concurrent_sessions='independent-test-only',
    origin='http://127.0.0.1:4173', key=secrets.token_hex(32), mailbox=str(mail))
file = Path('/tmp/mjl-a1-policy.json')
file.write_text(json.dumps(policy)); file.chmod(0o600)
Path('/tmp/mjl-a1-compose.yaml').write_text(f'''services:
  backend:
    user: "{os.getuid()}:{os.getgid()}"
    environment:
      MJL_AUTH_MODE: synthetic
      MJL_ENVIRONMENT: isolated-test
      MJL_AUTH_POLICY_FILE: /tmp/mjl-a1-policy.json
    volumes:
      - /tmp/mjl-a1-policy.json:/tmp/mjl-a1-policy.json:ro
      - /tmp/mjl-a1-mail-browser:/tmp/mjl-a1-mail-browser
''')
PY
export COMPOSE_FILE=compose.rebuild.yaml:/tmp/mjl-a1-compose.yaml
export COMPOSE_PROJECT_NAME=mjl-a1-test COMPOSE_ENV_FILES=/tmp/mjl-a1.env
docker compose config --quiet
docker compose up -d --build --wait
docker compose exec -T backend alembic upgrade head
docker compose exec -T -e MJL_AUTH_MODE=off backend sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -q'
npm --prefix frontend run build
API_PROXY_TARGET=http://127.0.0.1:8013 MJL_A1_MAILBOX=/tmp/mjl-a1-mail-browser MJL_A1_CONTAINER=mjl-a1-test-backend-1 npm --prefix frontend run test:e2e
```

The two A1 browser tests run in order against an initially empty test database;
they execute restricted bootstrap themselves and later change that synthetic
identity directly as an isolated invalidation fixture. They do not implement
account administration. The normal foundation-only browser run explicitly skips
these two tests when the A1 environment variables are absent. Pytest creates and
drops its own randomly named child test databases, even when migration fails.

For a **separate fresh disposable environment**, an operator may instead run:

```bash
docker compose exec -T backend python -m app.auth.bootstrap --email operator@example.test
# Only when delivery/replacement is needed for that same still-pending identity:
docker compose exec -T backend python -m app.auth.bootstrap --email operator@example.test --reissue
```

Inspect the private synthetic capture locally to obtain the invitation/code;
never publish it or copy secrets into tickets/logs. A consumed invitation cannot
be reissued, and an accepted account cannot be bootstrapped again.

After confirming the volume label is exactly `mjl-a1-test`, remove only these
owned disposable resources and captures:

```bash
docker volume inspect mjl-a1-test_postgres_data --format '{{ index .Labels "com.docker.compose.project" }}'
docker compose down --volumes --remove-orphans
python3 - <<'PY'
from pathlib import Path
mail = Path('/tmp/mjl-a1-mail-browser')
for file in mail.glob('*.json'):
    file.unlink()
mail.rmdir()
for name in ('mjl-a1.env', 'mjl-a1-policy.json', 'mjl-a1-compose.yaml'):
    Path('/tmp', name).unlink()
PY
unset COMPOSE_FILE COMPOSE_PROJECT_NAME COMPOSE_ENV_FILES
```


### A2.1 Admin invitations and account listing

A2.1 extends A1 in the same isolated synthetic environment. After verified Admin
login, **Gérer les utilisateurs** opens `/access/users`: list/filter accounts and
invitations, invite one ordinary business role, deliberately resend or revoke a
pending invitation. Recipients use the existing password/email-OTP flow. Admin
creation, inactive-account restoration and recovery are unavailable. Restricted
role changes/deactivation are described below. PC1/PC2 remain pending; real identities and SMTP stay disabled.

Run `alembic upgrade head` explicitly in the disposable backend. Revision
`0003_a21` adds only invitation version and bounded audit facts; no new tables.
Existing active A1 accounts/sessions remain intact. Existing pending A1 proofs
without generation-binding facts fail closed: the operator must deliberately
reissue the original pending Admin invitation with the existing CLI. Audit rows
are never rewritten. A downgrade drops these new facts and version values; it
is not a history-preserving rollback and is not part of normal application use.

For the dedicated browser check, use the isolated setup recipe above with project
`mjl-a21-test`, `/tmp/mjl-a21.env`, `/tmp/mjl-a21-policy.json` and
`/tmp/mjl-a21-compose.yaml`; retain the required mailbox prefix, for example
`/tmp/mjl-a1-mail-a21-browser`. Keep ports 5183/8013/4173 free. The override must
mount that private policy/mailbox at their matching paths. Start with an empty
`mjl_test_a21` database; the test bootstraps its own synthetic Admin.

```bash
# After starting that explicitly named isolated project and migrating it:
docker exec -e MJL_AUTH_MODE=off mjl-a21-test-backend-1 sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -q -p no:cacheprovider tests/test_access.py tests/test_auth.py tests/test_auth_security.py tests/test_auth_policy.py'
npm --prefix frontend run build
API_PROXY_TARGET=http://127.0.0.1:8013 MJL_A21_MAILBOX=/tmp/mjl-a1-mail-a21-browser MJL_A21_CONTAINER=mjl-a21-test-backend-1 PLAYWRIGHT_BROWSERS_PATH=/tmp/mjl-playwright npm --prefix frontend run test:e2e -- e2e/access.spec.js
```

`test_access.py` covers the API, real PostgreSQL races/faults, audit and upgrade;
`access.test.jsx` covers UI state/denials/late responses; `access.spec.js` covers
real Admin/recipient journeys, keyboard dialogs, focus refresh, account switching,
network loss and cache/replay restrictions. The browser test adjusts only a
consumed synthetic OTP timestamp to exercise account switching without sleeping;
it changes no policy. Use the setup recipe's label-checked teardown, substituting
only this task's project/volume/private fixture paths. Never reset the shared POC.


### A2.2 restricted ordinary lifecycle

Admin can change an active ordinary user's role or deactivate it through
`PATCH /api/v1/access/users/{id}` (`expected_version` plus exactly one `role` or
`deactivate: true`). Both invalidate all old verified/pending OTP contexts. The
existing account view provides confirmations; unchanged role is a no-op. No
inactive reinvitation, Admin lifecycle, assignment handoff or business permissions.

**Disabled by default, even in synthetic mode.** Before enabling on a disposable
database, verify it was created empty by this task, has no imports/legacy
associations or external business store, and runs only the inspected writers.
Bind `lifecycle_database` to that exact verified `mjl_test_*` database. Omit the
field to keep lifecycle disabled. Do not run live DDL while mutations are enabled.

PTA-1 replaced the temporary auth-only predicate. Every mutation now verifies the
exact `0005_pta1` schema and singleton context, then rejects an account with a
current Activity coordination assignment. Unknown or weakened evidence fails
closed (409, or 503 on database failure). Future responsibility types must extend
this predicate atomically before their mutations are enabled. PC1/PC2 remain
pending; real accounts remain prohibited. A2.2 itself added no migration.

For verification, use the existing isolated setup recipe with project
`mjl-a22-test`, database `mjl_test_a22`, `/tmp/mjl-a22-*` private files and mailbox
`/tmp/mjl-a1-mail-a22-browser`. Verify fresh provenance before setting the binding.
Pytest's fixture independently creates/migrates/drops a fresh random database per
case; its lifecycle tests bind only that verified child. Run:

```bash
docker exec -e MJL_AUTH_MODE=off mjl-a22-test-backend-1 sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -q -p no:cacheprovider tests/test_lifecycle.py tests/test_access.py tests/test_auth.py tests/test_auth_security.py tests/test_auth_policy.py'
npm --prefix frontend run test:unit
npm --prefix frontend run build
API_PROXY_TARGET=http://127.0.0.1:8013 MJL_A21_MAILBOX=/tmp/mjl-a1-mail-a22-browser MJL_A21_CONTAINER=mjl-a22-test-backend-1 MJL_A22_MAILBOX=/tmp/mjl-a1-mail-a22-browser MJL_A22_CONTAINER=mjl-a22-test-backend-1 PLAYWRIGHT_BROWSERS_PATH=/tmp/mjl-playwright npm --prefix frontend run test:e2e -- e2e/access.spec.js e2e/lifecycle.spec.js
```

The two browser tests run in order: existing A2.1 establishes the synthetic Admin;
A2.2 adds its disposable ordinary identity and exercises real PATCH, schema denial,
conflict, session invalidation, Query refresh and offline/unknown outcomes. Test
fixture SQL affects only the explicitly named disposable database. Perform the
same label-checked teardown as A1, using only this project's volume/private files.

### A3 synthetic password recovery

A3 is disabled unless the private synthetic policy contains all six fields below
with these exact test values:

```json
{
  "recovery_fixture": "TEST_ONLY",
  "recovery_seconds": 600,
  "recovery_email_window_seconds": 600,
  "recovery_email_limit": 3,
  "recovery_ip_window_seconds": 60,
  "recovery_ip_limit": 20
}
```

Recovery also requires the existing `lifecycle_database` attestation to match the
verified disposable database. Missing, partial or altered recovery configuration
fails closed without disabling existing authentication. These are development
fixtures, not approved production policy. Only active ordinary `@example.test`
accounts qualify; Admin, pending, inactive, unknown and throttled requests receive
the same neutral response and no eligibility claim.

The three operations are `POST /api/v1/auth/password-reset/requests`, `/inspect`
and `/complete`. A link verifier exists only in the private mailbox fragment and
is scrubbed before inspection. Reset creates no authenticated session: the user
must sign in with the new password and complete fresh email OTP. The PTA-aware
guard now requires exactly migration `0005_pta1`, its complete schema manifest and
the singleton MJL context. Recovery remains allowed for an assigned ordinary
account while lifecycle changes remain blocked by a current coordination
assignment.

Use a fresh project such as `mjl-a3-test`, an empty `mjl_test_a3` database, private
`/tmp/mjl-a3-*` configuration and a mailbox beginning
`/tmp/mjl-a1-mail-a3-`. Run the focused evidence against that project:

```bash
docker exec -e MJL_AUTH_MODE=off mjl-a3-test-backend-1 sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -p no:cacheprovider tests/test_recovery.py tests/test_lifecycle.py tests/test_access.py tests/test_auth.py tests/test_auth_security.py tests/test_auth_policy.py'
docker exec -e MJL_AUTH_MODE=off mjl-a3-test-backend-1 ruff check --no-cache .
docker exec -e MJL_AUTH_MODE=off mjl-a3-test-backend-1 ruff format --check --no-cache .
docker exec -e MJL_AUTH_MODE=off mjl-a3-test-backend-1 mypy --cache-dir /tmp/mjl-a3-mypy app
npm --prefix frontend run test:unit
npm --prefix frontend run lint
npm --prefix frontend run format:check
npm --prefix frontend run lint:css
npm --prefix frontend run build
API_PROXY_TARGET=http://127.0.0.1:8016 MJL_A3_MAILBOX=/tmp/mjl-a1-mail-a3-browser MJL_A3_CONTAINER=mjl-a3-test-backend-1 PLAYWRIGHT_BROWSERS_PATH=/tmp/mjl-playwright npm --prefix frontend run test:e2e -- recovery.spec.js
```

Verify project and volume labels before project-scoped teardown. Remove only the
task-owned project, volume, policy, mailbox and test images. PC1/PC2 remain
pending; real accounts, Admin recovery, approval workflow, later PTA/A4 work,
production mail and deployment remain prohibited.

### PTA-1 synthetic planning

PTA-1 requires a fresh isolated `mjl_test_*` database migrated to `0005_pta1`,
the existing complete synthetic recovery policy, and `lifecycle_database` bound
to that exact database. Before starting a business-capable runtime, a restricted
operator provisions the singleton context once:

```bash
python -m app.planning.provision --reason "PTA-1 isolated setup"
```

The command is idempotent and writes one attributable audit with the first
successful provision. The operator needs read access to the exact schema, insert
and update on `mjl_ownership_context`, and insert plus sequence use on
`auth_audit`; it does not need schema creation. The runtime also must not have DDL
privileges. Missing context, a database-policy mismatch, or any missing, extra or
weakened relation/constraint/index/column fails planning and lifecycle operations
closed.

The authorized UI routes are `/partners`, `/projects`,
`/projects/:projectId/ptas/:year`, its Activity-creation child, and
`/activities/:activityId`. Only ordinary synthetic roles can access planning.
Validators manage references and Projects; Agents create/read/edit drafts;
Supervisors and Validators manage Agent coordination assignments. No review,
approval, document, reporting or later workflow action is present.

Use the isolated PTA-1 project and run the focused evidence with its database URL:

```bash
docker exec -e MJL_AUTH_MODE=off mjl-pta1-test-backend-1 sh -c 'TEST_DATABASE_URL="$DATABASE_URL" pytest -q tests/test_planning.py'
npm --prefix frontend run test:unit
API_PROXY_TARGET=http://127.0.0.1:8023 MJL_PTA1_CONTAINER=mjl-pta1-test-backend-1 PLAYWRIGHT_BROWSERS_PATH=/tmp/mjl-playwright npm --prefix frontend run test:e2e -- e2e/planning.spec.js
```

Use only synthetic identities and disposable resources. PC1/PC2 remain pending;
real accounts, reviewer assignments/actions, approval workflow, later PTA/A4
slices and production deployment remain prohibited.
