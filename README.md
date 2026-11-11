# MJL

MJL manages annual activity plans, approvals, execution, financial requests and
supporting documents. Internal teams plan and track work; partner organizations
have a separate read-only view of their approved activities and shared documents.
The interface is French-first, with amounts in XOF (F CFA).

The app uses **React/Vite**, **FastAPI** and **PostgreSQL**. It can be installed as
a PWA, but business operations require an internet connection. It is currently
under development; see [project status](docs/project-status.md) for available
features and remaining limits.

## Run locally

For an existing development setup, use the database already configured in `.env`.
If `DATABASE_URL` points to Supabase, follow **Use Supabase for the development
database** below. The Compose stack uses its own PostgreSQL volume and does not
use `.env`'s `DATABASE_URL`; a new Compose project starts with no existing accounts.
Changing the Compose project name also selects a separate database volume.

For the local container stack, use Docker with Compose v2. For host-side development, use Node **22.12+
within 22.x, or 24.x**, and Python **3.12 or 3.13** with **uv 0.9.26**.

Run these commands from the repository root:

```bash
cp .env.example .env
chmod 600 .env
```

Edit `.env` before starting:

- Generate `POSTGRES_PASSWORD` with `openssl rand -hex 24`.
- Generate `MJL_AUTH_KEY` with `openssl rand -hex 32`.
- Set your private `RESEND_API_KEY` and a verified `EMAIL_FROM` sender.
- Keep `APP_BASE_URL` aligned with the address you use to open the frontend.

Local authentication sends real invitations and login codes through Resend.
There is no public registration or default account. `.env` is ignored by Git.

Set the Compose options once in your terminal; use the same settings for all
commands below, including in any new terminal:

```bash
export COMPOSE_FILE=compose.rebuild.yaml
export COMPOSE_PROJECT_NAME=mjl-rebuild-dev
export COMPOSE_ENV_FILES=.env

docker compose config --quiet
docker compose up -d --build --wait
docker compose exec -T backend alembic upgrade head
```

| Service                       | Local address              |
| ----------------------------- | -------------------------- |
| Application                   | http://localhost:5173      |
| Interactive API documentation | http://127.0.0.1:8000/docs |

PostgreSQL is available only inside the Compose network. Migrations create the
schema without users or sample business data.

Invite the first administrator, replacing the example name and email with yours:

```bash
docker compose exec -T backend python -m app.auth.bootstrap \
  --email 'you@example.com' --name 'Your Name'
```

Follow the emailed invitation to set your password. The administrator can then
invite other users from the app.

## Day-to-day development

Install dependencies for local editors and development tools:

```bash
npm --prefix frontend ci
(cd backend && uv sync --frozen --python 3.13)
```

Start the complete app in development mode from the repository root:

```bash
./scripts/dev.sh
```

This command uses `DATABASE_URL`, `MJL_BACKEND_PORT`,
`MJL_FRONTEND_PORT` and the other application settings from `.env`. It applies
all committed migrations, checks that the SQLAlchemy models do not require a new
migration, then starts the FastAPI and Vite development servers together. Stop
both with `Ctrl+C`.

### Use Supabase for the development database

Disable the Supabase Data API, then set `DATABASE_URL` in your private `.env`
to the Direct connection URL (or Session pooler when IPv6 is unavailable).
Use the `postgresql+psycopg://` prefix, URL-encode the password, and include
`?sslmode=require` for encryption. Keep the local authentication and Resend
settings. This enables local development, not production hosting.

Run `./scripts/dev.sh` from the repository root. The Docker stack is not needed
for this mode; stop its services first if they already use the configured ports.
If this is a new empty database, initialize the single MJL ownership record once
with `uv run python -m app.planning.core.provision --reason 'Initialize local
development'` from `backend/` after loading `.env`. This does not create sample
business data. For the first Admin invitation, load `.env` and run `uv run python
-m app.auth.bootstrap --email 'you@example.com' --name 'Your Name'` from
`backend/`.

Keep integration tests on a separate disposable local PostgreSQL database.

### Develop with the local Docker stack

For frontend hot reload, keep the backend running and replace the containerized
frontend with Vite on your host:

```bash
docker compose stop frontend
npm --prefix frontend run dev
```

Vite forwards `/api` requests to the backend on port 8000. If you change that port,
set `API_PROXY_TARGET` when starting Vite.

Compose builds source into images; it does not mount your working tree. After
backend edits, rebuild it and apply any new migrations:

```bash
docker compose up -d --build backend
docker compose exec -T backend alembic upgrade head
```

Security events are concise JSON records in the backend log stream. Set
`MJL_SECURITY_LOG_MAX_PER_MINUTE` in the backend process environment to adjust
its per-worker volume cap (default 120, range 1–10000). This does not configure
retention. Container startup and the host command above disable routine Uvicorn
access logs to avoid recording every request and query string. The selected
hosting provider must separately enforce protected collection, persistence across
deployments and the retention/expiration policy once approved. No retention
duration or provider integration is configured by this change.

View logs with `docker compose logs -f backend`. Stop the stack with
`docker compose down`; the database volume is retained.

## Prepare a non-sensitive demo staging environment

The staging package builds the React frontend and FastAPI backend into one Render
web service. The browser and `/api` therefore keep the same HTTPS origin required
by the session-cookie, host, Origin and CSRF checks. This package is for disposable
demonstration data only. It does not authorize production or sensitive data, run
migrations automatically, create users, deploy anything, or configure backups.

Before creating a Render service, create a dedicated empty Supabase project. Do
not reuse a development or production database. Disable its Data API, require SSL,
and copy the **Session pooler** connection from Supabase's Connect dialog. Convert
the scheme to `postgresql+psycopg://`, URL-encode the password, keep port `5432`,
and append `?sslmode=require`.

Prepare private operator configuration without committing it:

```bash
cp .env.staging.example .env.staging.local
chmod 600 .env.staging.local
openssl rand -hex 32
```

Put the generated value in `MJL_AUTH_KEY`. Set `APP_BASE_URL` to the exact HTTPS
Render hostname that will serve the app, and fill in the dedicated Supabase and
verified Resend values. Replace the staging acknowledgment placeholder with the
exact value `non-sensitive-demo-only`; the process refuses to start until the
operator explicitly enters that non-sensitive-demo boundary.

Load the private values and initialize only that new empty database:

```bash
set -a
. ./.env.staging.local
set +a
(cd backend && .venv/bin/alembic upgrade head)
(cd backend && .venv/bin/python -m app.planning.core.provision \
  --reason 'Initialize non-sensitive demo staging')
(cd backend && .venv/bin/python -m app.auth.bootstrap \
  --email 'you@example.com' --name 'Your Name')
```

These are deliberate operator actions. Verify the database host and project before
each command. The bootstrap command sends a real invitation through Resend and is
single-use for an empty identity store.

`render.yaml` describes one free Docker web service in Frankfurt with automatic
deploys disabled. Importing that Blueprint is a separate, explicit deployment
action. In Render, enter the same private values for `DATABASE_URL`,
`MJL_AUTH_KEY`, `APP_BASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` and
`MJL_STAGING_ACK`; never store them in Git. The image uses Render's assigned port,
serves the immutable Vite build from `/`, and keeps API routes under `/api`. It
intentionally does not run Alembic or bootstrap on startup. Uvicorn does not trust
generic forwarded headers. In this staging policy, per-client abuse limits use
Cloudflare's validated single `CF-Connecting-IP` only when Render's `CF-Ray`
evidence is present; local and test modes keep the socket address.

After a future authorized deployment, check `/api/health/live`,
`/api/health/ready`, a direct browser deep link, invitation acceptance, password +
OTP login, logout, one small private document, and behavior after a Render restart.
Free Render services sleep and share the workspace's monthly free-instance hours;
free Supabase projects can pause and have no automatic backups. Those limits make
this staging package unsuitable for production or important data.

## Find your way around

| Location                       | Contents                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `backend/app/`                 | API and business logic: `auth`, `planning`, `partner_portal`, `audit`; shared infrastructure in `core` |
| `backend/migrations/versions/` | Ordered database migrations with descriptive filenames                                                 |
| `backend/tests/`               | Tests grouped by feature, with shared disposable fixtures in `conftest.py`                             |
| `frontend/src/app/`            | Routing, application setup, PWA updates and global styles                                              |
| `frontend/src/features/`       | Business screens and their unit tests                                                                  |
| `frontend/src/shared/`         | Reusable API client, UI controls and helpers                                                           |
| `frontend/e2e/`                | Browser journeys grouped by feature                                                                    |

Package-root files configure dependencies, builds, linting and tests. Keep
migration revision IDs and parent links unchanged when reorganizing files.

## Check your changes

Frontend checks:

```bash
npm --prefix frontend run lint
npm --prefix frontend run format:check
npm --prefix frontend run lint:css
npm --prefix frontend run test:unit
npm --prefix frontend run build
```

Backend checks:

```bash
(cd backend && uv run ruff check .)
(cd backend && uv run ruff format --check .)
(cd backend && uv run mypy app)
```

Backend integration tests need a **separate, disposable PostgreSQL database**
whose name starts with `mjl_test_`. Set `TEST_DATABASE_URL` to its connection URL;
the database user must be able to create and drop test databases. Never point
tests at your development data. From `backend/`, run `uv run pytest -q`, or a
focused group such as `uv run pytest tests/auth -q`.

For a Partner portal browser check using mocked API responses, build the frontend
first, then run:

```bash
cd frontend
npx playwright install chromium
npm run test:e2e -- e2e/partner-portal
```

Playwright starts its own preview server on port 4173. Some browser suites require
an isolated backend and synthetic mailbox configuration and otherwise skip;
check the run's skipped-test count. The GitHub Actions workflow runs quality
checks and tests against a disposable stack; it does not deploy the app.

## Contributing

Keep changes focused and include checks for the behavior you change. Use the
existing feature folders and shared helpers. Update the relevant guide when
changing a rule, interface or setup requirement:

- [Business rules](docs/business-rules.md): roles, approvals and workflows.
- [Engineering](docs/engineering.md): architecture, API contracts and code conventions.
- [Design](docs/design.md): interface patterns and visual standards.
- [Security](docs/security.md): authentication, authorization and data protection.
- [Project status](docs/project-status.md): implemented capabilities and open work.

Include a short explanation of the change and the checks you ran in your pull
request. Keep credentials, local configuration and test data out of commits.
