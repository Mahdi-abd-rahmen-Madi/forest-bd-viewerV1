# System Architecture & Technical Details

Detailed breakdown of the platform architecture, database schema, and geospatial integrations.

## What We Built From Scratch

### 🏗️ Complete Infrastructure Transformation

**Original State (TALHA017 Repository):**
- Empty 0-byte shapefile placeholders
- Basic application skeleton
- Minimal database setup
- No functional data pipeline

**Our Implementation:**
- **Full PostgreSQL + PostGIS Database Setup**: Complete spatial database with proper indexing
- **Comprehensive ETL Pipeline**: 346-line shapefile import script with coordinate transformations
- **Exercise-Complete Backend**: NestJS GraphQL API with authentication and spatial queries
- **Interactive Frontend**: Next.js application with Mapbox integration and polygon analysis
- **Automated Setup Scripts**: One-command development environment setup

### 🌲 Official French Forest Data Integration

**BD FORET Dataset Source:**
- **Official Provider**: [IGN France](https://www.ign.fr/) (Institut National de l'Information Géographique et Forestière)
- **Data Portal**: [cartes.gouv.fr](https://cartes.gouv.fr/rechercher-une-donnee/dataset/IGNF_BD-FORET?redirected_from=geoservices.ign.fr)
- **Metadata API**: [CSW Service](https://data.geopf.fr/csw?REQUEST=GetRecordById&SERVICE=CSW&VERSION=2.0.2&OUTPUTSCHEMA=http://standards.iso.org/iso/19115/-3/mdb/2.0&elementSetName=full&ID=IGNF_BD-FORET)
- **Coordinate System**: EPSG:2154 (LAMB93) - Official French Lambert-93 projection
- **Coverage**: Metropolitan France with detailed forest classification

**Data Integration Process:**
```javascript
// Successfully imported 130,549 real forest plots from 13 departments across 4 regions
- Extracted from official BD FORET 7z archives (13 departments)
- Transformed from LAMB93 to WGS84 for web mapping
- Mapped French forest attributes to database schema
- Validated geometry types and spatial data integrity
- Performance: Complete import in 1m 54s with 0 errors
```

**Imported Forest Data Includes:**
- **Forest Types**: "Forêt fermée de feuillus purs en îlots", "Forêt fermée à mélange de conifères prépondérants et feuillus", etc.
- **Tree Species**: `{Feuillus}`, `{Mixte}`, detailed essences arrays
- **Administrative Codes**: French department, region, and commune codes
- **Spatial Data**: MultiPolygon geometries with proper PostGIS indexing

### 📊 Multi-Department Data Pipeline Architecture

**Complete Import System** (3 utility scripts):
```bash
# Single-command workflow for all departments
./scripts/import-all-departments.sh --auto

# Individual utilities
./scripts/clean-database.js          # Database cleanup
./scripts/extract-departments.js     # Archive extraction  
./scripts/import-shapefiles.js       # Multi-department import
```

**Key Features:**
- **13 Departments**: Complete coverage across 4 French regions
- **Automated Workflow**: Single command for clean → extract → import
- **Error Isolation**: Continue processing if individual departments fail
- **Progress Tracking**: Real-time progress per department and overall
- **Performance Optimized**: 130,549 plots in 1m 54s with 0 errors
- **Flexible Execution**: Interactive, auto, and dry-run modes

**Regional Coverage:**
- **Normandie**: D014, D027, D050, D061, D076 (5 departments)
- **Centre-Val de Loire**: D018, D028, D036, D037, D041, D045 (6 departments)  
- **Nouvelle-Aquitaine**: D040 (Landes - largest dataset)
- **Grand Est**: D088 (Vosges)

**Technical Implementation:**
- LAMB93 to WGS84 coordinate transformation (French projection to web mapping)
- Batch processing for large datasets (10,000 records per batch)
- Department-level error handling and validation
- Spatial indexing preparation
- Support for official French BD FORET v1.0 and v2.0 formats
- Performance optimizations: 130,549 plots in under 2 minutes

**Database Schema**:
- **ForestPlot Entity**: Spatial data with PostGIS geometry, administrative codes, species data
- **User Entity**: Authentication with map state persistence
- **UserPolygon Entity**: Saved analysis areas with results
- **Proper Indexes**: Spatial and administrative area optimization

### 🚀 Application Features

**Backend (NestJS + GraphQL)**:
- Authentication system with JWT tokens and development guards
- Geospatial query service with spatial filtering and enhanced error handling
- User management with map state persistence
- Complete GraphQL schema with proper types
- Development authentication with `NoAuthGuard` and `DevAuthGuard` for easier testing

**Frontend (Next.js + Mapbox)**:
- Interactive map with multiple base layers
- Polygon drawing and analysis tools with geometry serialization fixes
- Real-time feature querying
- User authentication flow with development mode support
- State management with persistence
- Enhanced geometry handling for Polygon to MultiPolygon conversion

**DevOps & Setup**:
- Automated database setup scripts
- Development environment launcher with mock authentication
- Complete documentation and troubleshooting guides
- Enhanced development workflow with dev-token authentication

## Architecture

### Technology Stack
- **Frontend**: Next.js 16, React 19, TypeScript, TailwindCSS, Mapbox GL
- **Backend**: NestJS, TypeScript, GraphQL, Apollo Server
- **Database**: PostgreSQL with PostGIS extension
- **Infrastructure**: pnpm workspaces, Turbo monorepo, Docker-ready

### Project Structure
```
forest-bd-viewer/
├── apps/
│   ├── api/          # NestJS GraphQL backend
│   │   ├── src/
│   │   │   ├── auth/          # Authentication system
│   │   │   │   ├── strategies/ # JWT and development auth strategies
│   │   │   │   └── ...
│   │   │   ├── common/        # Shared utilities
│   │   │   │   ├── guards/     # Authentication guards (NoAuthGuard, DevAuthGuard)
│   │   │   │   └── ...
│   │   │   ├── geospatial/    # Service boundary extraction
│   │   │   │   ├── geospatial-service.interface.ts
│   │   │   │   ├── geospatial-service.client.ts
│   │   │   │   ├── geospatial.service.ts
│   │   │   │   └── geospatial.module.ts
│   │   │   ├── polygons/      # Polygon analysis module
│   │   │   └── ...
│   └── web/          # Next.js frontend
├── packages/
│   └── database/     # Shared TypeORM entities
├── scripts/          # Database setup and data import
└── data/            # French forest shapefiles
```

## 🏛️ PLU/PCI Urban Planning Integration ✅ COMPLETED

### French Geoportal External Layer Integration

**Successfully Integrated**: External French urban planning and cadastral data from official geoportal services, providing comprehensive land use and cadastral information alongside forest data.

**External Data Sources**:
- **Provider**: [IGN France](https://www.ign.fr/) via [data.geopf.fr](https://data.geopf.fr/)
- **PLU Zoning**: Urban planning sectors (`zone_secteur`) from French urban planning documents
- **PLU Prescriptions**: Planning regulations and restrictions (`prescription`) from urban planning documents
- **PCI Parcels**: Cadastral parcels from French cadastral database via vector tiles
- **Coordinate System**: EPSG:3857 (Web Mercator) for web mapping compatibility

### 🗺️ Layer Implementation Details

**WMS Layer Integration**:
```typescript
// External WMS configuration for PLU layers
{
  id: 'plu-zoning',
  name: 'PLU Zoning Sectors',
  layerName: 'zone_secteur',
  externalUrl: 'https://data.geopf.fr/wms-v/ows',
  minZoom: 8, maxZoom: 20,
  visible: true
},
{
  id: 'plu-prescriptions', 
  name: 'PLU Prescriptions',
  layerName: 'prescription',
  externalUrl: 'https://data.geopf.fr/wms-v/ows',
  minZoom: 10, maxZoom: 20,
  visible: true
}
```

**Vector Tile Integration**:
```typescript
// PCI Parcels via vector tiles
{
  id: 'pci-parcels',
  name: 'PCI Parcels (Cadastral)',
  vectorTile: true,
  tiles: ['https://data.geopf.fr/tms/1.0.0/PCI/{z}/{x}/{y}.pbf'],
  minZoom: 14, maxZoom: 20,
  visible: true
}
```

### 🎛️ Unified Cadastre Control

**Cadastre Button Implementation**:
- **Single Control**: Unified "Cadastre" button toggles all PLU/PCI layers together
- **Smart Synchronization**: Individual layer toggles update cadastre button state
- **State Management**: Proper Zustand store integration with persistent state
- **Visual Feedback**: Red-themed button with active/inactive states

**User Experience**:
- **Quick Access**: One-click toggle for all urban planning layers
- **Individual Control**: Layer panel still allows fine-grained control
- **Zoom Awareness**: Layers automatically show/hide based on zoom requirements
- **Feature Queries**: Click-to-query functionality for all PLU/PCI layers

### 🔍 Feature Query Integration

**Enhanced Popup System**:
- **Multi-Layer Support**: Simultaneous queries for forest, PLU, and PCI data
- **Rich Information**: Detailed urban planning and cadastral information in popups
- **External Service Support**: Proper parameter formatting for French geoportal WMS
- **Vector Tile Queries**: Direct Mapbox feature queries for PCI parcels

**Query Architecture**:
```typescript
// Unified query system supporting multiple layer types
export const queryAllLayers = async (lng, lat, map) => {
  const [
    region, department, commune, forest,
    pluZoning, pluPrescriptions,
    pciParcels  // Vector tile features
  ] = await Promise.all([
    // WMS queries for administrative and forest layers
    // External WMS queries for PLU layers  
    // Vector tile queries for PCI parcels
  ]);
};
```

### 🛠️ Technical Implementation

**Key Features**:
- **External WMS Support**: Extended WMSLayerConfig interface for external services
- **Parameter Formatting**: Proper uppercase parameters for French geoportal compatibility
- **Vector Tile Handling**: Multiple source-layer fallbacks for PCI data robustness
- **Error Handling**: Comprehensive timeout and error management for external services
- **Performance**: Efficient layer loading with zoom-based visibility controls

**Architecture Enhancements**:
- **Service Abstraction**: Clean separation between WMS and vector tile handling
- **Type Safety**: Proper TypeScript interfaces for all layer configurations
- **State Synchronization**: Consistent state management between individual and combined controls
- **Zoom Optimization**: Progressive detail loading based on zoom levels

### 📊 Data Coverage and Usage

**Geographic Coverage**: Metropolitan France with complete urban planning and cadastral data
**Zoom Requirements**:
- **PLU Zoning**: Visible at zoom 8+ (urban planning overview)
- **PLU Prescriptions**: Visible at zoom 10+ (detailed regulations)
- **PCI Parcels**: Visible at zoom 14+ (parcel-level detail)

**Use Cases**:
- **Urban Planning Analysis**: Combine forest data with zoning regulations
- **Land Use Assessment**: Understand cadastral boundaries alongside forest coverage
- **Development Planning**: Comprehensive view of environmental and planning constraints
- **Research**: Multi-layer analysis for environmental and urban studies

**Current Status**: **Fully Functional** - All PLU/PCI layers integrated with unified control, feature queries working, and proper zoom-based visibility management.

---

## Technical Specifications

### Database Schema
- **Users**: Authentication and map state persistence
- **Forest Plots**: French forest data with PostGIS geometry
- **User Polygons**: Saved analysis areas with results

### API Endpoints
- **Authentication**: Login, logout, registration
- **Geospatial**: Forest plots, administrative areas, spatial queries
- **User Management**: Profile, map state, saved polygons

### Frontend Features
- **Interactive Mapping**: Mapbox integration with drawing tools
- **Data Visualization**: Forest plots with filtering and analysis
- **User Experience**: Authentication, state persistence, responsive design

### Performance Characteristics
- **Spatial Queries**: Optimized with PostGIS indexes
- **Data Loading**: Viewport-based filtering (planned)
- **State Management**: Efficient Zustand implementation
- **Memory Usage**: Optimized for large geospatial datasets

---

## WMS Layer Integration & Testing

### 🗺️ WMS Server Configuration

**Geoserver Endpoint**: `http://janazapro.com:8080/geoserver/prod/wms`  
**Workspace**: `prod`  
**Proxy Configuration**: Next.js rewrites `/geoserver/*` → `http://janazapro.com:8080/geoserver/*`

### 📋 Available Layers (Capabilities Analysis)

**✅ Working Layers (4/5 functional):**
- **`region`** - Administrative regions (Min zoom: 0, Max zoom: 8)
- **`department`** - Departments (Min zoom: 8, Max zoom: 10)  
- **`cummune`** - Communes (Min zoom: 10, Max zoom: 13) *[Note: Server has typo in layer name]*
- **`forest`** - Forest inventory data (Min zoom: 0, Max zoom: 22)

**❌ Unavailable Layers:**
- **`cadastre`** - Land parcels (LayerNotDefined error - does not exist on server)
- **`commune`** - Correct spelling doesn't exist (only `cummune` with typo available)

**🎨 Style Layers Available:**
- `f_cummine`, `f_administrative`, `f_forest`, `f_region` - Style definition layers

### 🔧 WMS Layer Fixes Implemented

#### Phase 1: Commune Layer Typo Resolution
**Issue**: Code used `commune` (correct spelling) but server only has `cummune` (with typo)  
**Solution**: Updated all references to use server's actual layer name
**Files Modified**:
- `apps/web/src/services/wmsLayers.ts` - Layer configuration
- `apps/web/src/services/wmsFeatureInfo.ts` - Feature query service
- `apps/web/src/components/map/ForestMap.tsx` - Map component preconnections

#### Phase 2: Cadastre Layer Handling
**Issue**: `cadastre` layer doesn't exist on Geoserver (LayerNotDefined error)  
**Solution**: Disabled layer with clear user indication
**Implementation**:
```typescript
{
    id: 'cadastre',
    name: 'Cadastre (Unavailable)',
    description: 'Land parcels (zoom > 15) - Layer not available on server',
    visible: false,  // Disabled by default
}
```

#### Phase 3: Error Handling & Monitoring
**Added comprehensive error handling**:
- WMS service exception detection and logging
- HTTP error status code handling
- Layer validation functions
- Performance monitoring integration

**New Validation Functions**:
```typescript
export const validateLayer = (layerConfig: WMSLayerConfig): { isValid: boolean; issues: string[] }
export const getWorkingLayers = (): WMSLayerConfig[]  // Filters out unavailable layers
```

### 🧪 Testing Results

**Layer Connectivity Tests**:
```bash
✅ region: PNG image data, 256 x 256, 8-bit/color RGBA, non-interlaced
✅ department: PNG image data, 256 x 256, 8-bit/color RGBA, non-interlaced  
✅ cummune: PNG image data, 256 x 256, 8-bit/color RGBA, non-interlaced
✅ forest: PNG image data, 256 x 256, 8-bit/color RGBA, non-interlaced
❌ cadastre: ServiceExceptionReport - LayerNotDefined
```

**Server Capabilities Verification**:
- Total layers available: 16 (including style layers)
- Working data layers: 4 (region, department, cummune, forest)
- Coordinate system: EPSG:3857 (Web Mercator)
- Image format: PNG with transparency support

### 🚀 Performance Optimizations

**WMS Preconnection System**:
- Automatic preconnection to WMS endpoints for improved loading
- Connection monitoring and cleanup
- Batch layer preconnection for optimal performance
- Error tracking and retry logic

**Caching Strategy**:
- WMS tile caching with TTL management
- Feature info query caching
- Connection pooling for Geoserver requests

### 📊 Current WMS Integration Status

**✅ Fully Functional**:
- 4 working WMS layers with proper error handling
- Automatic layer validation and monitoring
- Zoom-based visibility controls
- Feature querying with popup information
- Layer control panel with toggle functionality

**🔧 Configuration Files**:
- `apps/web/src/services/wmsLayers.ts` - Layer definitions and validation
- `apps/web/src/services/wmsFeatureInfo.ts` - Feature query service
- `apps/web/src/services/wmsPreconnection.ts` - Performance optimization
- `apps/web/src/services/wmsCache.ts` - Caching implementation

**🎯 User Experience**:
- Clear indication of unavailable layers
- Graceful error handling for failed requests
- Performance monitoring and logging
- Responsive layer controls with zoom restrictions

### 🔄 Future WMS Enhancements

**Potential Improvements**:
1. **Add Cadastre Layer**: If available on Geoserver or alternative endpoint
2. **Style Layer Integration**: Utilize `f_*` style layers for enhanced visualization
3. **Advanced Caching**: Redis-based tile caching for better performance
4. **Layer Grouping**: Organize layers hierarchically (administrative → thematic)
5. **Dynamic Loading**: Load layers based on viewport and zoom level

**Monitoring & Maintenance**:
- Automated layer availability checking
- Performance metrics collection
- Error rate monitoring and alerting
- Layer usage analytics

---

