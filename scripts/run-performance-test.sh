#!/bin/bash

# Script to run database performance tests
# Usage: ./scripts/run-performance-test.sh

set -e

echo "🚀 Running database performance tests..."

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

echo "📊 Testing performance on database: $DB_NAME"
echo ""

# Run the performance test script
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/test-index-performance.sql

echo ""
echo "✅ Performance test completed!"
echo ""
echo "📈 Look for these improvements:"
echo "  - Lower execution times on all queries"
echo "  - 'Index Scan' instead of 'Seq Scan' in query plans"
echo "  - Higher index usage counts in statistics"
echo ""
echo "🔍 To manually test specific queries:"
echo "  psql -h localhost -U postgres -d forest_db"
echo "  EXPLAIN ANALYZE SELECT * FROM forest_plots WHERE code_departement = '088';"
