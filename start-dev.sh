#!/bin/bash

# Forest Data Viewer Development Launcher
# This script sets up and launches both frontend and backend services

set -e

echo "🌲 Forest Data Viewer Development Launcher"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    print_step "Checking dependencies..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed. Please install pnpm first."
        print_error "Run: npm install -g pnpm"
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        print_warning "PostgreSQL is not installed or not in PATH. Make sure PostgreSQL is running."
    fi
    
    print_status "Dependencies check completed"
}

# Setup environment files
setup_environment() {
    print_step "Setting up environment files..."
    
    # Setup API environment
    if [ ! -f "apps/api/.env" ]; then
        print_status "Creating API environment file from template..."
        cp apps/api/.env.example apps/api/.env
        print_warning "Please edit apps/api/.env and configure your database credentials and tokens"
    else
        print_status "API environment file already exists"
    fi
    
    # Setup Web environment
    if [ ! -f "apps/web/.env" ]; then
        print_status "Creating Web environment file from template..."
        cp apps/web/.env.example apps/web/.env
        print_warning "Please edit apps/web/.env and configure your API URL and Mapbox token"
    else
        print_status "Web environment file already exists"
    fi
}

# Install dependencies
install_dependencies() {
    print_step "Installing dependencies..."
    
    # Install root dependencies
    print_status "Installing root dependencies..."
    pnpm install
    
    # Install API dependencies
    print_status "Installing API dependencies..."
    cd apps/api && pnpm install && cd ../..
    
    # Install Web dependencies
    print_status "Installing Web dependencies..."
    cd apps/web && pnpm install && cd ../..
    
    print_status "Dependencies installation completed"
}

# Check database connection
check_database() {
    print_step "Checking database connection..."
    
    # Source the API environment to get database credentials
    if [ -f "apps/api/.env" ]; then
        export $(cat apps/api/.env | grep -v '^#' | xargs)
        
        if command -v psql &> /dev/null; then
            if PGPASSWORD=$DATABASE_PASSWORD psql -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USERNAME -d postgres -c "SELECT 1;" &> /dev/null; then
                print_status "Database connection successful"
                
                # Check if the database exists
                if PGPASSWORD=$DATABASE_PASSWORD psql -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USERNAME -d postgres -c "SELECT 1 FROM pg_database WHERE datname='$DATABASE_NAME';" | grep -q 1; then
                    print_status "Database '$DATABASE_NAME' exists"
                else
                    print_warning "Database '$DATABASE_NAME' does not exist. Creating it..."
                    PGPASSWORD=$DATABASE_PASSWORD psql -h $DATABASE_HOST -p $DATABASE_PORT -U $DATABASE_USERNAME -d postgres -c "CREATE DATABASE $DATABASE_NAME;"
                    print_status "Database '$DATABASE_NAME' created"
                fi
            else
                print_error "Cannot connect to database. Please check your configuration in apps/api/.env"
                print_error "Make sure PostgreSQL is running and credentials are correct"
                return 1
            fi
        else
            print_warning "psql command not found. Skipping database check"
        fi
    else
        print_warning "API environment file not found. Skipping database check"
    fi
}

# Start services
start_services() {
    print_step "Starting development services..."
    
    # Create a logs directory
    mkdir -p logs
    
    print_status "Starting Backend API (NestJS) on port 4000..."
    print_status "Starting Frontend (Next.js) on port 3000..."
    print_status "GraphQL Playground will be available at: http://localhost:4000/graphql"
    print_status "Frontend will be available at: http://localhost:3000"
    
    echo ""
    print_status "Press Ctrl+C to stop both services"
    echo ""
    
    # Start both services in parallel
    pnpm run dev &
    BACKEND_PID=$!
    
    # Wait a moment for backend to start
    sleep 3
    
    cd apps/web && pnpm run dev &
    FRONTEND_PID=$!
    cd ../..
    
    # Function to cleanup on exit
    cleanup() {
        print_status "Stopping services..."
        kill $BACKEND_PID 2>/dev/null || true
        kill $FRONTEND_PID 2>/dev/null || true
        wait $BACKEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
        print_status "All services stopped"
        exit 0
    }
    
    # Set up trap for cleanup
    trap cleanup INT TERM
    
    # Wait for both processes
    wait $BACKEND_PID $FRONTEND_PID
}

# Main execution
main() {
    echo ""
    print_status "Starting Forest Data Viewer development setup..."
    echo ""
    
    check_dependencies
    setup_environment
    install_dependencies
    
    if ! check_database; then
        print_error "Database setup failed. Please fix the configuration and try again."
        exit 1
    fi
    
    echo ""
    print_status "Setup completed successfully!"
    echo ""
    
    start_services
}

# Run main function
main "$@"
