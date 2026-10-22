## MJL Dolibarr Workspace

## Dedicated application rebuild

The first technical foundation is implemented under DEC-092. It contains a
French neutral shell and public service-health checks only. Authentication and
business features require separate authorization. See [authority](docs/mjl-authoritative-decisions.md)
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
`backend/app/` owns settings, health routes and request-scoped sessions;
`backend/migrations/` owns the empty Alembic revision. `backend/tests/` and
`frontend/src/*.test.jsx`/`frontend/e2e/` cover only this foundation.
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

Apply the bookkeeping revision explicitly:

```bash
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev exec -T backend alembic upgrade head
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev exec -T backend alembic current
```

Only `alembic_version` is created; there are no business tables or seed data.
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
