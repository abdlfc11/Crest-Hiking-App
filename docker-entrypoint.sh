#!/bin/sh
set -e

echo "Waiting for PostgreSQL to accept connections..."

# this allows the override of DB host for advanced / standalone run use cases
DB_HOST="${DB_HOST:-db}"

until pg_isready -h "$DB_HOST" -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; do 
    echo "Postgres is not ready yet, sleeping 1s"
    sleep 1
done

echo "PostgreSQL is ready. Running the database migration..."
flask --app app.py db upgrade

echo "Starting application..."
exec "$@"
