#!/bin/bash

# Simple Forest Data Viewer Launcher
set -e

echo "🌲 Forest Data Viewer - Simple Launcher"
echo "======================================="

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

# Check environment files
if [ ! -f "apps/api/.env" ]; then
    print_warning "API environment file not found. Creating from template..."
    cp apps/api/.env.example apps/api/.env
    print_warning "Please edit apps/api/.env with your database credentials"
fi

if [ ! -f "apps/web/.env" ]; then
    print_warning "Web environment file not found. Creating from template..."
    cp apps/web/.env.example apps/web/.env
    print_warning "Please edit apps/web/.env with your Mapbox token"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -d "apps/api/node_modules" ] || [ ! -d "apps/web/node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    cd apps/api && npm install && cd ../..
    cd apps/web && npm install && cd ../..
fi

print_status "Starting services..."
print_status "Backend API: http://localhost:4000"
print_status "Frontend: http://localhost:3000"
print_status "GraphQL Playground: http://localhost:4000/graphql"
echo ""

# Start services
cd apps/api && npm run dev &
API_PID=$!

sleep 3

cd ../web && npm run dev &
WEB_PID=$!

cd ..

# Cleanup function
cleanup() {
    print_status "Stopping services..."
    kill $API_PID 2>/dev/null || true
    kill $WEB_PID 2>/dev/null || true
    exit 0
}

trap cleanup INT TERM

print_status "Both services started! Press Ctrl+C to stop."
wait $API_PID $WEB_PID
