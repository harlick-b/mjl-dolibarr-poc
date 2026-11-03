# MJL dedicated application

MJL is a dedicated React/Vite and FastAPI application backed by PostgreSQL. The
former Dolibarr proof of concept has been retired; its history remains available
through Git and the historical documents under `docs/`.

Read [the authority router](docs/mjl-authoritative-decisions.md) before changing
business behavior. The [implementation roadmap](docs/mjl-implementation-roadmap-v2.md)
records the current implemented boundary. Passing development checks does not
mean user acceptance or production readiness.

## Repository layout

- `frontend/`: React, TanStack Router/Query, Tailwind and the installable PWA.
- `backend/app/`: FastAPI routes, use cases and persistence.
- `backend/migrations/`: Alembic migrations; current head is `0019_pta7b`.
- `backend/tests/` and `frontend/e2e/`: focused backend and browser checks.
- `docs/rebuild/`: current architecture, security baseline, slice contracts and
  implementation evidence.
- `compose.rebuild.yaml`: isolated local development stack.

The application remains restricted to synthetic identities, isolated databases
and test mail. Do not seed persistent demo data or use the development setup for
real accounts or production operations.

## Local development

Prerequisites: Docker Compose v2, Node 22.12+ (22.x) or 24.x, and Python 3.12 or
3.13 with uv 0.9.26 for host-side backend commands.

```bash
cp .env.example .env
python3 -c "from pathlib import Path; import secrets; p=Path('.env'); p.write_text(p.read_text().replace('REPLACE_WITH_GENERATED_LOCAL_HEX', secrets.token_hex(24))); p.chmod(0o600)"
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev config --quiet
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev up -d --build --wait
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev exec -T backend alembic upgrade head
```

Frontend: <http://127.0.0.1:5173/>. Backend OpenAPI:
<http://127.0.0.1:8000/docs>. PostgreSQL is reachable only inside the Compose
network. Migrations do not create users, reference rows or sample business data.

Install host development dependencies when needed:

```bash
npm --prefix frontend ci
(cd backend && uv sync --frozen --python 3.13)
```

For frontend host development, stop the Compose frontend before using port 5173:

```bash
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev stop frontend
npm --prefix frontend run dev
```

Stop the local stack while retaining its PostgreSQL volume:

```bash
docker compose --env-file .env -f compose.rebuild.yaml -p mjl-rebuild-dev down
```

## Verification

Use an isolated PostgreSQL database whose name starts with `mjl_test_`. Backend
integration tests deliberately refuse other database names.

```bash
npm --prefix frontend run lint
npm --prefix frontend run format:check
npm --prefix frontend run lint:css
npm --prefix frontend run test:unit
npm --prefix frontend run build
(cd backend && uv run ruff check .)
(cd backend && uv run ruff format --check .)
(cd backend && uv run mypy app)
```

Run focused pytest and Playwright checks for the behavior changed. The GitHub
workflow uses `compose.rebuild.yaml` with a disposable PostgreSQL volume and runs
the full current backend, frontend and browser gates without deployment.
