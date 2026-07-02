#!/bin/sh
set -e

# Apply any pending database migrations before starting the server.
echo "Running database migrations..."
node_modules/.bin/tsx lib/db/migrate.ts

exec "$@"
