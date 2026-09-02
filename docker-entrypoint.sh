#!/bin/sh
# Production container start: apply pending Prisma migrations, then boot the
# bundled server. Runs as the non-root `leadforge` user (see Dockerfile).
#
# If DATABASE_URL is unreachable, migrations fail fast with a clear error
# instead of leaving the app running against an uninitialized schema.

set -eu

echo "[leadforge] running database migrations..."
npx prisma migrate deploy

echo "[leadforge] migrations complete — starting server..."
exec node dist/server.mjs
