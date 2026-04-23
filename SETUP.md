# Forest Data Viewer - Quick Setup Guide

## Prerequisites

1. **Node.js** (v18 or higher)
2. **pnpm** (package manager)
3. **PostgreSQL** with PostGIS extension
4. **Mapbox Token** (for map functionality)

## Quick Start

### 1. Run the Development Launcher

```bash
./start-dev.sh
```

This script will:
- ✅ Check dependencies
- ✅ Setup environment files from templates
- ✅ Install all npm packages
- ✅ Check/create database
- ✅ Start both frontend and backend services

### 2. Manual Setup (if needed)

If the script doesn't work or you prefer manual setup:

#### Environment Configuration

1. **Backend Environment** (`apps/api/.env`):
   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit apps/api/.env with your database credentials
   ```

2. **Frontend Environment** (`apps/web/.env`):
   ```bash
   cp apps/web/.env.example apps/web/.env
   # Edit apps/web/.env with your Mapbox token
   ```

#### Database Setup

Make sure PostgreSQL is running and PostGIS is enabled:

```sql
-- Create database
CREATE DATABASE forest_bd_viewer;

-- Enable PostGIS extension
\c forest_bd_viewer
CREATE EXTENSION IF NOT EXISTS postgis;
```

#### Install Dependencies

```bash
# Root dependencies
pnpm install

# API dependencies
cd apps/api && pnpm install && cd ../..

# Web dependencies
cd apps/web && pnpm install && cd ../..
```

#### Start Services

```bash
# Start both services (from root directory)
pnpm run dev

# Or start individually:
# Backend (terminal 1)
cd apps/api && pnpm run dev

# Frontend (terminal 2) 
cd apps/web && pnpm run dev
```

## Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **GraphQL Playground**: http://localhost:4000/graphql

## Environment Variables Required

### Backend (`apps/api/.env`)
```
PORT=4000
NODE_ENV=development
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=your_password
DATABASE_NAME=forest_bd_viewer
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRATION=7d
MAPBOX_TOKEN=your_mapbox_token_here
```

### Frontend (`apps/web/.env`)
```
NEXT_PUBLIC_API_URL=http://localhost:4000/graphql
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify credentials in `.env` files
- Check that PostGIS extension is enabled

### Port Conflicts
- Backend uses port 4000
- Frontend uses port 3000
- Change ports in `.env` files if needed

### Mapbox Token
- Get a free token from https://mapbox.com
- Required for map functionality

## Development Workflow

1. Run `./start-dev.sh` to start everything
2. Open http://localhost:3000 in your browser
3. Register/login to access the map interface
4. Start exploring the forest data viewer!
