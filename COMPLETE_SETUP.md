# Complete Forest Data Viewer Setup Guide

## 🚀 Quick Start

This guide will help you set up the complete forest data viewer with database and shapefile import.

## 📋 Prerequisites

1. **PostgreSQL** with PostGIS extension
2. **Node.js** (v18 or higher)
3. **Your Mapbox token** (already configured)

## 🗄️ Database Setup

### Step 1: Setup Database

```bash
# Run the database setup script
./scripts/setup-database.sh
```

This will:
- ✅ Create the `forest_bd_viewer` database
- ✅ Enable PostGIS extension
- ✅ Verify spatial functionality

### Step 2: Import Forest Data

```bash
# Import the French forest shapefiles
./scripts/import-shapefiles.js
```

This will:
- ✅ Find and process BD FORET shapefiles
- ✅ Transform coordinates from LAMB93 to WGS84
- ✅ Import forest plots into database
- ✅ Create spatial indexes

### Step 3: Validate Import

```bash
# Validate the imported data
./scripts/validate-import.js
```

This will:
- ✅ Check geometry validity
- ✅ Calculate statistics
- ✅ Test spatial queries
- ✅ Generate validation report

## 🌐 Start the Application

Once database setup is complete:

```bash
# Start both frontend and backend
./start-simple.sh
```

Access points:
- **Frontend**: http://localhost:3000
- **GraphQL Playground**: http://localhost:4000/graphql

## 📊 What You'll See

After successful setup, the application will display:

### Frontend Features
- 🗺️ Interactive map with French forest data
- 🔍 Polygon drawing and analysis tools
- 📊 Forest statistics and species information
- 🎛️ Layer controls and filtering

### Backend Features
- 🌐 GraphQL API for forest data queries
- 👤 User authentication and management
- 📍 Spatial queries and analysis
- 💾 Saved polygon analysis

## 🔧 Manual Setup (if needed)

### Database Setup Commands

```bash
# Create database
createdb forest_bd_viewer

# Enable PostGIS
psql -d forest_bd_viewer -c "CREATE EXTENSION IF NOT EXISTS postgis;"

# Verify installation
psql -d forest_bd_viewer -c "SELECT PostGIS_Version();"
```

### Environment Variables

Your `.env` files are already configured with:
- ✅ Mapbox token
- ✅ Database connection settings
- ✅ JWT configuration

## 📁 Data Structure

The imported forest data includes:

### Forest Plot Attributes
- **Geometry**: MultiPolygon coordinates (WGS84)
- **Administrative codes**: Region, Department, Commune
- **Forest information**: Tree species, surface area, forest type
- **Location data**: Lieu-dit (place name)

### Spatial Features
- **Coordinate system**: WGS84 (EPSG:4326) for web mapping
- **Source projection**: LAMB93 (EPSG:2154) - French national
- **Spatial indexing**: Optimized for interactive queries

## 🧪 Testing the Setup

### 1. Test Database Connection
```bash
psql -d forest_bd_viewer -c "SELECT COUNT(*) FROM forest_plots;"
```

### 2. Test Spatial Query
```sql
-- Find forest plots in a bounding box
SELECT COUNT(*) FROM forest_plots 
WHERE ST_Intersects(geom, ST_MakeEnvelope(-1, 42, 3, 44, 4326));
```

### 3. Test GraphQL API
Visit http://localhost:4000/graphql and try:
```graphql
query {
  forestPlots(filters: {bounds: {minLat: 42, maxLat: 44, minLng: -1, maxLng: 3}}) {
    id
    codeRegion
    surfaceHectares
  }
}
```

## 🔍 Troubleshooting

### Database Issues
- **PostgreSQL not running**: Start PostgreSQL service
- **PostGIS missing**: Install `postgresql-contrib` and `postgis` packages
- **Permission denied**: Check database user permissions

### Import Issues
- **Shapefile not found**: Check data directory structure
- **Coordinate transformation errors**: Verify LAMB93 projection data
- **Memory issues**: Shapefiles are processed in batches

### Application Issues
- **Map not loading**: Verify Mapbox token
- **API errors**: Check database connection
- **No data displayed**: Run validation script

## 📈 Performance Notes

### Database Optimization
- Spatial indexes automatically created on geometry column
- Administrative code indexes for fast filtering
- Bounding box queries for viewport rendering

### Frontend Performance
- Viewport-based data loading
- Progressive rendering of forest plots
- Optimized spatial queries

## 🎯 Next Steps

Once everything is running:

1. **Explore the map**: Navigate around France to see forest data
2. **Try polygon drawing**: Draw areas to analyze forest composition
3. **Test filtering**: Filter by regions, departments, or species
4. **Check GraphQL API**: Use the playground for custom queries

## 📚 For the Symbiose Exercise

This setup demonstrates:
- ✅ Database design with spatial data
- ✅ ETL pipeline for shapefile import
- ✅ Coordinate system transformations
- ✅ Full-stack geospatial application
- ✅ Performance optimization techniques

The application is now ready for the technical exercise improvements outlined in the plan!
