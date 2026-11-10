#!/usr/bin/env bash

set -Eeuo pipefail

project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$project_root/.env"

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file. Copy .env.example to .env and configure it first." >&2
  exit 1
fi

unset DATABASE_URL MJL_BACKEND_PORT MJL_FRONTEND_PORT API_PROXY_TARGET
unset MJL_AUTH_MODE MJL_ENVIRONMENT MJL_AUTH_KEY MJL_AUTH_POLICY_FILE
unset MJL_SECURITY_LOG_MAX_PER_MINUTE APP_BASE_URL RESEND_API_KEY
unset EMAIL_FROM EMAIL_REPLY_TO

set -a
# shellcheck disable=SC1090
source "$env_file"
set +a

for name in DATABASE_URL MJL_BACKEND_PORT MJL_FRONTEND_PORT APP_BASE_URL; do
  if [[ -z "${!name:-}" ]]; then
    echo "$name must be set in $env_file." >&2
    exit 1
  fi
done

export API_PROXY_TARGET="http://127.0.0.1:${MJL_BACKEND_PORT}"

echo "Applying and checking database migrations..."
(
  cd "$project_root/backend"
  uv run alembic upgrade head
  uv run alembic check
)

backend_pid=""
frontend_pid=""

stop_services() {
  trap - EXIT INT TERM
  [[ -z "$frontend_pid" ]] || kill "$frontend_pid" 2>/dev/null || true
  [[ -z "$backend_pid" ]] || kill "$backend_pid" 2>/dev/null || true
  [[ -z "$frontend_pid" ]] || wait "$frontend_pid" 2>/dev/null || true
  [[ -z "$backend_pid" ]] || wait "$backend_pid" 2>/dev/null || true
}

trap stop_services EXIT INT TERM

echo "Starting API on http://127.0.0.1:${MJL_BACKEND_PORT}..."
(
  cd "$project_root/backend"
  exec uv run uvicorn app.main:create_app --factory --reload \
    --host 127.0.0.1 --port "$MJL_BACKEND_PORT" \
    --no-proxy-headers --no-access-log
) &
backend_pid=$!

echo "Starting frontend on ${APP_BASE_URL}..."
(
  cd "$project_root/frontend"
  exec ./node_modules/.bin/vite \
    --host 127.0.0.1 --port "$MJL_FRONTEND_PORT" --strictPort
) &
frontend_pid=$!

wait -n "$backend_pid" "$frontend_pid"
