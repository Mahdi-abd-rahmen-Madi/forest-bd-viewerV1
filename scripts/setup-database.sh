#!/bin/bash

# Forest Database Setup Script
# Creates PostgreSQL database with PostGIS extension

set -e

echo "🌲 Forest Database Setup"
echo "========================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Database configuration
DB_NAME="forest_bd_viewer"
DB_USER="postgres"
DB_PASSWORD="password"
DB_HOST="localhost"
DB_PORT="5432"

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT; then
    print_error "PostgreSQL is not running on $DB_HOST:$DB_PORT"
    print_error "Please start PostgreSQL and try again"
    exit 1
fi

print_status "PostgreSQL is running"

# Check if database exists
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" | grep -q 1; then
    print_warning "Database '$DB_NAME' already exists"
    read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Dropping existing database..."
        PGPASSWORD=$DB_PASSWORD dropdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
        print_status "Database dropped"
    else
        print_status "Using existing database"
    fi
fi

# Create database if it doesn't exist
if ! PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME';" | grep -q 1; then
    print_status "Creating database '$DB_NAME'..."
    PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME
    print_status "Database created"
fi

# Enable PostGIS extension
print_status "Enabling PostGIS extension..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS postgis;" || {
    print_error "Failed to create PostGIS extension"
    print_error "Make sure PostGIS is installed for PostgreSQL"
    exit 1
}

print_status "PostGIS extension enabled"

# Verify PostGIS is working
print_status "Verifying PostGIS installation..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT PostGIS_Version();" > /dev/null || {
    print_error "PostGIS verification failed"
    exit 1
}

print_status "PostGIS verification successful"

# Create spatial indexes (these will be created when TypeORM syncs, but we can prepare them)
print_status "Database setup completed successfully!"
echo ""
print_status "Database Details:"
echo "  - Name: $DB_NAME"
echo "  - Host: $DB_HOST:$DB_PORT"
echo "  - User: $DB_USER"
echo "  - PostGIS: Enabled"
echo ""
print_status "You can now run the shapefile import script:"
echo "  ./scripts/import-shapefiles.js"
echo ""
print_status "Or start the application to let TypeORM create the tables:"
echo "  ./start-simple.sh"
