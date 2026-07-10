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
alembic upgrade heads

GRAPH_PATH="/app/Pathfinding/better_path_graph.pkl"

if [ ! -f "$GRAPH_PATH" ]; then
    echo "Pathfinding graph ($GRAPH_PATH) is missing, downloading from github releases..."

    curl -L -o "$GRAPH_PATH" "https://github.com/abdlfc11/Crestr-Hiking-App/releases/download/v0.1.0/graph.pkl"

    echo "Pathfinding graph downloaded"
else
    echo "Pathfinding graph found locally"
fi



echo "Starting application..."
exec "$@"
