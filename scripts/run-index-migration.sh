#!/bin/bash

# Script to run database index migration
# Usage: ./scripts/run-index-migration.sh

set -e

echo "🔧 Running database index migration..."

# Check if database is running
if ! pg_isready -q -h localhost -p 5432; then
    echo "❌ PostgreSQL is not running. Please start the database first."
    exit 1
fi

# Get database name from environment or use default
DB_NAME=${FOREST_DB_NAME:-forest_db}
DB_USER=${FOREST_DB_USER:-postgres}
DB_HOST=${FOREST_DB_HOST:-localhost}
DB_PORT=${FOREST_DB_PORT:-5432}

echo "📊 Applying indexes to database: $DB_NAME"

# Run the index migration script
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/add-spatial-index.sql

echo "✅ Index migration completed successfully!"
echo ""
echo "📈 Performance improvements:"
echo "  - Spatial queries: GIST indexes on geometry columns"
echo "  - Administrative queries: B-tree indexes on region/department/commune"
echo "  - Species analysis: GIN index on essences array"
echo "  - User polygon queries: Indexes on user_id and status"
echo ""
echo "🔍 To verify indexes are being used, check the query execution plans:"
echo "  EXPLAIN ANALYZE SELECT * FROM forest_plots WHERE ST_Intersects(geom, ST_MakeEnvelope(...));"
echo "  EXPLAIN ANALYZE SELECT * FROM forest_plots WHERE code_departement = '088';"
