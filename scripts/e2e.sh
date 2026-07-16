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

# The suite must run against a server *it* started, with E2E_FAKES=1 and the
# throwaway Postgres. Anything already on the port would be a foreign process
# holding the real `.env` (a stray `next start`, a second suite), and pointing
# the specs at it means real OpenAI/Blob calls. Refuse to start instead.
#
# Exported so e2e/support/constants.ts binds the very port checked here — the
# guard would be worthless if the two could disagree.
export E2E_PORT=3100
if lsof -nP -iTCP:"$E2E_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "✗ Port $E2E_PORT is already in use, so the E2E app server cannot start."
  echo "  E2E must own this port — it is the only way the fakes are guaranteed."
  echo "  Stop that process and re-run. (Your dev server on :3000 is fine.)"
  exit 1
fi

cleanup() {
  echo "› Tearing down E2E Postgres…"
  $COMPOSE down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "› Starting E2E Postgres…"
$COMPOSE up -d --wait

npx playwright test "$@"
