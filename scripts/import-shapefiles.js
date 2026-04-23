#!/usr/bin/env node

/**
 * Forest Shapefile Import Script
 * Imports French BD FORET shapefiles into PostgreSQL database
 */

const fs = require('fs');
const path = require('path');
const { DataSource } = require('typeorm');
const shapefile = require('shapefile');
const proj4 = require('proj4');

// Database configuration
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'forest_bd_viewer',
  synchronize: true,
  logging: true,
  entities: [
    require('@forest/database').User,
    require('@forest/database').ForestPlot,
    require('@forest/database').UserPolygon
  ]
});

// Define LAMB93 projection (EPSG:2154) manually
proj4.defs('EPSG:2154', '+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs');

// Coordinate system transformation
// LAMB93 (EPSG:2154) to WGS84 (EPSG:4326)
const lamb93ToWgs84 = proj4('EPSG:2154', 'EPSG:4326');

// Shapefile data directory
const shapefileDir = path.join(__dirname, '../data/bd-foret/raw');

class ShapefileImporter {
  constructor() {
    this.importedCount = 0;
    this.errorCount = 0;
    this.startTime = Date.now();
  }

  async initializeDatabase() {
    console.log('🔌 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected');
    
    // Get repository for forest plots
    this.forestPlotRepository = dataSource.getRepository('ForestPlot');
    
    // Clear existing data if needed
    const existingCount = await this.forestPlotRepository.count();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing forest plots`);
      console.log('🗑️  Clearing existing data...');
      await this.forestPlotRepository.clear();
    }
  }

  async findShapefiles() {
    console.log('🔍 Scanning for shapefiles...');
    
    const shapefiles = [];
    
    // Find all directories containing shapefiles
    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (item.endsWith('.shp')) {
          shapefiles.push(fullPath);
        }
      }
    };
    
    scanDirectory(shapefileDir);
    
    console.log(`📁 Found ${shapefiles.length} shapefile(s):`);
    shapefiles.forEach(file => console.log(`   - ${file}`));
    
    return shapefiles;
  }

  transformCoordinates(geometry) {
    try {
      if (geometry.type === 'MultiPolygon') {
        const transformedCoordinates = geometry.coordinates.map(polygon =>
          polygon.map(ring =>
            ring.map(coord => {
              const [x, y] = lamb93ToWgs84.forward(coord);
              return [x, y];
            })
          )
        );
        
        return {
          type: 'MultiPolygon',
          coordinates: transformedCoordinates
        };
      } else if (geometry.type === 'Polygon') {
        const transformedCoordinates = geometry.coordinates.map(ring =>
          ring.map(coord => {
            const [x, y] = lamb93ToWgs84.forward(coord);
            return [x, y];
          })
        );
        
        return {
          type: 'Polygon',
          coordinates: transformedCoordinates
        };
      }
      
      return geometry;
    } catch (error) {
      console.error('❌ Coordinate transformation error:', error);
      return null;
    }
  }

  mapShapefileToEntity(properties, geometry) {
    try {
      // Generate unique ID
      const id = `forest_${this.importedCount + 1}`;
      
      // Map shapefile properties to database fields
      // Note: These field names might need adjustment based on actual shapefile structure
      const entity = {
        id,
        codeRegion: properties.CODE_REG || properties.code_region || null,
        codeDepartement: properties.CODE_DEP || properties.code_departement || null,
        codeCommune: properties.CODE_COM || properties.code_commune || null,
        lieuDit: properties.LIEU_DIT || properties.lieu_dit || null,
        geom: geometry,
        essences: this.parseEssences(properties.ESSENCES || properties.essences),
        surfaceHectares: this.parseSurfaceArea(properties.SURFACE || properties.surface || properties.surface_hectares),
        typeForet: properties.TYPE_FORET || properties.type_foret || null
      };
      
      return entity;
    } catch (error) {
      console.error('❌ Entity mapping error:', error);
      return null;
    }
  }

  parseEssences(essencesField) {
    if (!essencesField) return null;
    
    // Handle different formats of essences data
    if (Array.isArray(essencesField)) {
      return essencesField;
    }
    
    if (typeof essencesField === 'string') {
      // Try to parse as JSON first
      try {
        const parsed = JSON.parse(essencesField);
        return Array.isArray(parsed) ? parsed : [essencesField];
      } catch {
        // Split by common delimiters
        return essencesField.split(/[,;|]/).map(s => s.trim()).filter(Boolean);
      }
    }
    
    return [String(essencesField)];
  }

  parseSurfaceArea(surfaceField) {
    if (!surfaceField) return null;
    
    const num = parseFloat(surfaceField);
    return isNaN(num) ? null : num;
  }

  async importShapefile(shapefilePath) {
    console.log(`📥 Importing: ${path.basename(shapefilePath)}`);
    
    try {
      const source = await shapefile.open(shapefilePath);
      const batch = [];
      const batchSize = 1000;
      
      let result = await source.read();
      
      while (!result.done) {
        if (result.value) {
          const { geometry, properties } = result.value;
          
          // Transform coordinates
          const transformedGeometry = this.transformCoordinates(geometry);
          if (!transformedGeometry) {
            this.errorCount++;
            result = await source.read();
            continue;
          }
          
          // Map to entity
          const entity = this.mapShapefileToEntity(properties, transformedGeometry);
          if (entity) {
            batch.push(entity);
            this.importedCount++;
            
            // Insert batch when full
            if (batch.length >= batchSize) {
              await this.insertBatch(batch);
              batch.length = 0;
              console.log(`📊 Imported ${this.importedCount} features...`);
            }
          } else {
            this.errorCount++;
          }
        }
        
        result = await source.read();
      }
      
      // Insert remaining batch
      if (batch.length > 0) {
        await this.insertBatch(batch);
      }
      
      console.log(`✅ Completed: ${path.basename(shapefilePath)}`);
      
    } catch (error) {
      console.error(`❌ Error importing ${shapefilePath}:`, error);
      this.errorCount++;
    }
  }

  async insertBatch(batch) {
    try {
      await this.forestPlotRepository.insert(batch);
    } catch (error) {
      console.error('❌ Batch insert error:', error);
      this.errorCount += batch.length;
    }
  }

  async finalizeImport() {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);
    
    console.log('\n🎉 Import Summary:');
    console.log(`   - Features imported: ${this.importedCount}`);
    console.log(`   - Errors: ${this.errorCount}`);
    console.log(`   - Duration: ${duration}s`);
    
    // Verify import
    const dbCount = await this.forestPlotRepository.count();
    console.log(`   - Database count: ${dbCount}`);
    
    if (this.importedCount > 0) {
      console.log('\n✅ Import completed successfully!');
      
      // Test spatial query
      console.log('🧪 Testing spatial query...');
      const testResult = await this.forestPlotRepository
        .createQueryBuilder('plot')
        .where('ST_Intersects(plot.geom, ST_MakeEnvelope(-1, 42, 3, 44, 4326))')
        .limit(5)
        .getMany();
      
      console.log(`📍 Found ${testResult.length} test features in bounding box`);
    }
  }

  async run() {
    try {
      await this.initializeDatabase();
      
      const shapefiles = await this.findShapefiles();
      
      if (shapefiles.length === 0) {
        console.log('❌ No shapefiles found');
        return;
      }
      
      for (const shapefile of shapefiles) {
        await this.importShapefile(shapefile);
      }
      
      await this.finalizeImport();
      
    } catch (error) {
      console.error('❌ Import failed:', error);
    } finally {
      await dataSource.destroy();
    }
  }
}

// Install required dependencies if not present
async function ensureDependencies() {
  const requiredPackages = ['shapefile', 'proj4'];
  
  for (const pkg of requiredPackages) {
    try {
      require.resolve(pkg);
    } catch {
      console.log(`📦 Installing required package: ${pkg}`);
      const { execSync } = require('child_process');
      execSync(`npm install ${pkg}`, { stdio: 'inherit' });
    }
  }
}

// Main execution
async function main() {
  console.log('🌲 Forest Shapefile Importer');
  console.log('=============================\n');
  
  await ensureDependencies();
  
  const importer = new ShapefileImporter();
  await importer.run();
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the importer
if (require.main === module) {
  main();
}

module.exports = ShapefileImporter;
