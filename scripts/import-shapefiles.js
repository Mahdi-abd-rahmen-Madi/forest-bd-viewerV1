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
  logging: false, // Disable logging for performance
  entities: [],
  extra: {
    // Performance optimizations
    max: 20, // connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }
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
    
    // Create forest_plots table if not exists with performance optimizations
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS forest_plots (
        id VARCHAR PRIMARY KEY,
        code_region VARCHAR,
        code_departement VARCHAR,
        code_commune VARCHAR,
        lieu_dit VARCHAR,
        geom GEOMETRY(MULTIPOLYGON, 4326),
        essences VARCHAR[],
        surface_hectares DOUBLE PRECISION,
        type_foret VARCHAR
      )
    `);
    
    // Add performance indexes
    await dataSource.query(`
      CREATE INDEX IF NOT EXISTS idx_forest_plots_geom ON forest_plots USING GIST (geom);
      CREATE INDEX IF NOT EXISTS idx_forest_plots_region ON forest_plots (code_region);
      CREATE INDEX IF NOT EXISTS idx_forest_plots_dept ON forest_plots (code_departement);
    `);
    
    // Optimize for bulk loading (only safe runtime parameters)
    await dataSource.query(`
      SET work_mem = '256MB';
      SET maintenance_work_mem = '256MB';
      SET synchronous_commit = off;
    `);
    
    // Clear existing data if needed
    const existingCount = await dataSource.query('SELECT COUNT(*) FROM forest_plots');
    const count = parseInt(existingCount[0].count);
    if (count > 0) {
      console.log(`⚠️  Found ${count} existing forest plots`);
      console.log('🗑️  Clearing existing data...');
      await dataSource.query('TRUNCATE TABLE forest_plots'); // Faster than DELETE
    }
  }

  async findShapefiles() {
    console.log('🔍 Scanning for shapefiles...');
    
    const shapefiles = [];
    const processedDirs = new Set();
    
    // Find all directories containing shapefiles
    const scanDirectory = (dir) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip duplicate directories
          const dirKey = path.relative(shapefileDir, fullPath);
          if (processedDirs.has(dirKey)) {
            console.log(`⏭️  Skipping duplicate directory: ${dirKey}`);
            continue;
          }
          processedDirs.add(dirKey);
          scanDirectory(fullPath);
        } else if (item.endsWith('.shp')) {
          // Validate shapefile is not empty
          const shpStat = fs.statSync(fullPath);
          if (shpStat.size === 0) {
            console.log(`⚠️  Skipping empty shapefile: ${fullPath}`);
            continue;
          }
          
          // Check for required companion files
          const basePath = fullPath.replace('.shp', '');
          const dbfExists = fs.existsSync(`${basePath}.dbf`);
          const shxExists = fs.existsSync(`${basePath}.shx`);
          
          if (!dbfExists || !shxExists) {
            console.log(`⚠️  Skipping incomplete shapefile: ${fullPath}`);
            continue;
          }
          
          shapefiles.push(fullPath);
        }
      }
    };
    
    scanDirectory(shapefileDir);
    
    console.log(`📁 Found ${shapefiles.length} valid shapefile(s):`);
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
      // Updated to match actual BD FORET shapefile structure
      const entity = {
        id,
        codeRegion: properties.CODE_REG || null,
        codeDepartement: properties.CODE_DEP || null,
        codeCommune: properties.CODE_COM || null,
        lieuDit: properties.LIEU_DIT || null,
        geom: geometry,
        essences: this.parseEssences(properties.ESSENCE || properties.ESSENCES),
        surfaceHectares: this.parseSurfaceArea(properties.SURFACE || properties.surface_hectares),
        typeForet: properties.TYPE_FORET || properties.TFV || null,
        codeTfv: properties.CODE_TFV || null,
        tfvG11: properties.TFV_G11 || null
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
      const batchSize = 10000; // Increased batch size for better performance
      
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
      // Use prepared statement for better performance
      const values = batch.map(entity => {
        const essencesArray = entity.essences && Array.isArray(entity.essences) 
          ? `ARRAY[${entity.essences.map(e => `'${e.replace(/'/g, "''")}'`).join(',')}]`
          : 'NULL';
        
        return `('${entity.id}', 
         ${entity.codeRegion ? `'${entity.codeRegion.replace(/'/g, "''")}'` : 'NULL'}, 
         ${entity.codeDepartement ? `'${entity.codeDepartement.replace(/'/g, "''")}'` : 'NULL'}, 
         ${entity.codeCommune ? `'${entity.codeCommune.replace(/'/g, "''")}'` : 'NULL'}, 
         ${entity.lieuDit ? `'${entity.lieuDit.replace(/'/g, "''")}'` : 'NULL'}, 
         ST_GeomFromGeoJSON('${JSON.stringify(entity.geom).replace(/'/g, "''")}'),
         ${essencesArray}, 
         ${entity.surfaceHectares ? entity.surfaceHectares : 'NULL'}, 
         ${entity.typeForet ? `'${entity.typeForet.replace(/'/g, "''")}'` : 'NULL'})`;
      }).join(',');
      
      // Use UNLOGGED table temporarily for even faster inserts
      await dataSource.query(`
        INSERT INTO forest_plots (id, code_region, code_departement, code_commune, lieu_dit, geom, essences, surface_hectares, type_foret)
        VALUES ${values}
      `);
      
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
    const dbCount = await dataSource.query('SELECT COUNT(*) FROM forest_plots');
    console.log(`   - Database count: ${dbCount[0].count}`);
    
    if (this.importedCount > 0) {
      console.log('\n✅ Import completed successfully!');
      
      // Data validation
      console.log('🔍 Validating imported data...');
      
      // Check coordinate ranges
      const coordCheck = await dataSource.query(`
        SELECT 
          MIN(ST_XMin(ST_Envelope(geom))) as min_lon,
          MAX(ST_XMax(ST_Envelope(geom))) as max_lon,
          MIN(ST_YMin(ST_Envelope(geom))) as min_lat,
          MAX(ST_YMax(ST_Envelope(geom))) as max_lat
        FROM forest_plots
      `);
      
      const coords = coordCheck[0];
      console.log(`📍 Coordinate range: Lon(${coords.min_lon} to ${coords.max_lon}), Lat(${coords.min_lat} to ${coords.max_lat})`);
      
      // Validate geometry types
      const geomCheck = await dataSource.query(`
        SELECT ST_GeometryType(geom) as geom_type, COUNT(*) as count 
        FROM forest_plots 
        GROUP BY ST_GeometryType(geom)
      `);
      
      console.log('📐 Geometry types:');
      geomCheck.forEach(row => console.log(`   - ${row.geom_type}: ${row.count} features`));
      
      // Check forest types
      const forestTypes = await dataSource.query(`
        SELECT type_foret, COUNT(*) as count 
        FROM forest_plots 
        WHERE type_foret IS NOT NULL 
        GROUP BY type_foret 
        ORDER BY count DESC 
        LIMIT 5
      `);
      
      console.log('🌲 Top forest types:');
      forestTypes.forEach(row => console.log(`   - ${row.type_foret}: ${row.count} features`));
      
      // Test spatial query with correct bounding box for Vosges department
      console.log('🧪 Testing spatial query...');
      const testResult = await dataSource.query(`
        SELECT * FROM forest_plots 
        WHERE ST_Intersects(geom, ST_MakeEnvelope(5.5, 48.0, 7.5, 49.0, 4326))
        LIMIT 5
      `);
      
      console.log(`📍 Found ${testResult.length} test features in bounding box`);
      
      if (testResult.length > 0) {
        console.log('✅ Spatial validation passed - data is properly imported and queryable!');
      }
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
