#!/usr/bin/env bash
# Run the Playwright E2E suite against a throwaway Docker Postgres.
#
# Owns the container lifecycle so nothing lingers: the trap tears the database
# down (and removes its volume) on success, failure, or Ctrl-C. Playwright's
# globalSetup handles schema (`prisma migrate deploy`) + truncation once the DB
# is up. Any args are forwarded to `playwright test` (e.g. `--ui`, a spec path).
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE="docker compose -f docker-compose.e2e.yml"

cleanup() {
  echo "› Tearing down E2E Postgres…"
  $COMPOSE down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "› Starting E2E Postgres…"
$COMPOSE up -d --wait

npx playwright test "$@"
