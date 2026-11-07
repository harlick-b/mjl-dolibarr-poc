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

### Use Supabase for the development database

Disable the Supabase Data API, then set `DATABASE_URL` in your private `.env`
to the Direct connection URL (or Session pooler when IPv6 is unavailable).
Use the `postgresql+psycopg://` prefix, URL-encode the password, and include
`?sslmode=require` for encryption. Keep the local authentication and Resend
settings. This enables local development, not production hosting.

Run from the repository root in Bash:

```bash
set -a
source .env
set +a
cd backend
uv run alembic upgrade head
uv run python -m app.planning.provision --reason 'Initialize local development'
uv run uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000 --no-proxy-headers --no-access-log
```

Provisioning creates the single MJL ownership record, not sample business data.
In a second terminal, run `npm --prefix frontend run dev` from the repository
root. The Docker stack is not needed for this mode; stop its frontend/backend
first if they already use ports 5173/8000. For the first Admin invitation, load
`.env` in another terminal and run `uv run python -m app.auth.bootstrap --email
'you@example.com' --name 'Your Name'` from `backend/`.

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
