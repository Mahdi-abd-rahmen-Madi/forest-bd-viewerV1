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
    this.currentDepartment = null;
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
    console.log('🔍 Scanning for department directories...');
    
    const departments = [];
    const items = fs.readdirSync(shapefileDir);
    
    for (const item of items) {
      const fullPath = path.join(shapefileDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && item.startsWith('D')) {
        // Extract department code from directory name (e.g., D014_Calvados)
        const deptMatch = item.match(/^(D\d{3})/);
        if (deptMatch) {
          const deptCode = deptMatch[1];
          const deptName = item.replace(`${deptCode}_`, '') || deptCode;
          
          console.log(`📂 Scanning department: ${deptCode} ${deptName}`);
          
          const shapefiles = this.findShapefilesInDepartment(fullPath);
          
          if (shapefiles.length > 0) {
            departments.push({
              code: deptCode,
              name: deptName,
              path: fullPath,
              shapefiles: shapefiles
            });
            console.log(`✅ ${deptCode}: Found ${shapefiles.length} shapefile(s)`);
          } else {
            console.log(`⚠️  ${deptCode}: No valid shapefiles found`);
          }
        }
      }
    }
    
    // Sort by department code
    departments.sort((a, b) => a.code.localeCompare(b.code));
    
    console.log(`\n📁 Found ${departments.length} department(s) with shapefiles:`);
    departments.forEach(dept => {
      console.log(`   - ${dept.code} ${dept.name}: ${dept.shapefiles.length} shapefile(s)`);
    });
    
    return departments;
  }

  findShapefilesInDepartment(deptPath) {
    const shapefiles = [];
    
    const scanDirectory = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (item.endsWith('.shp')) {
            // Validate shapefile is not empty
            const shpStat = fs.statSync(fullPath);
            if (shpStat.size === 0) {
              console.log(`⚠️  Skipping empty shapefile: ${path.basename(fullPath)}`);
              continue;
            }
            
            // Check for required companion files
            const basePath = fullPath.replace('.shp', '');
            const dbfExists = fs.existsSync(`${basePath}.dbf`);
            const shxExists = fs.existsSync(`${basePath}.shx`);
            
            if (!dbfExists || !shxExists) {
              console.log(`⚠️  Skipping incomplete shapefile: ${path.basename(fullPath)}`);
              continue;
            }
            
            shapefiles.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
        console.log(`⚠️  Cannot read directory: ${dir}`);
      }
    };
    
    // Look for BDFORET directory first
    const bdforetPath = path.join(deptPath, 'BDFORET');
    if (fs.existsSync(bdforetPath)) {
      scanDirectory(bdforetPath);
    } else {
      // Scan department directory directly
      scanDirectory(deptPath);
    }
    
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

  mapShapefileToEntity(properties, geometry, departmentCode) {
    try {
      // Generate unique ID with department prefix
      const id = `forest_${departmentCode}_${this.importedCount + 1}`;
      
      // Calculate surface area from geometry in WGS84
      const surfaceHectares = this.calculateSurfaceArea(geometry);
      
      // Map shapefile properties to database fields
      // Updated to match actual BD FORET shapefile structure
      const entity = {
        id,
        codeRegion: properties.CODE_REG || null,
        codeDepartement: properties.CODE_DEP || departmentCode.replace('D', ''),
        codeCommune: properties.CODE_COM || null,
        lieuDit: properties.LIEU_DIT || null,
        geom: geometry,
        essences: this.parseEssences(properties.ESSENCE || properties.ESSENCES),
        surfaceHectares: surfaceHectares,
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

  calculateSurfaceArea(geometry) {
    try {
      // Use a simple approximation for area calculation
      // For more accurate results, we'd need to use proper geodesic calculations
      let totalArea = 0;
      
      if (geometry.type === 'MultiPolygon') {
        geometry.coordinates.forEach(polygon => {
          totalArea += this.calculatePolygonArea(polygon);
        });
      } else if (geometry.type === 'Polygon') {
        totalArea = this.calculatePolygonArea(geometry.coordinates);
      }
      
      // Convert from square degrees to hectares (rough approximation)
      // This is a simplified calculation - for production use, consider using proper geodesic libraries
      const squareMeters = totalArea * 111320 * 111320 * Math.cos(48 * Math.PI / 180); // Approximate for France
      const hectares = squareMeters / 10000;
      
      return Math.round(hectares * 100) / 100; // Round to 2 decimal places
    } catch (error) {
      console.error('❌ Area calculation error:', error);
      return null;
    }
  }
  
  calculatePolygonArea(coordinates) {
    // Use Shoelace formula for polygon area
    let area = 0;
    const ring = coordinates[0]; // Exterior ring
    
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[i + 1];
      area += x1 * y2 - x2 * y1;
    }
    
    return Math.abs(area) / 2;
  }

  parseSurfaceArea(surfaceField) {
    if (!surfaceField) return null;
    
    const num = parseFloat(surfaceField);
    return isNaN(num) ? null : num;
  }

  async importDepartment(department) {
    console.log(`\n🌲 Importing Department: ${department.code} ${department.name}`);
    console.log(`📂 Path: ${department.path}`);
    console.log(`📁 Shapefiles: ${department.shapefiles.length}`);
    
    const deptStartTime = Date.now();
    const deptImportedCount = this.importedCount;
    const deptErrorCount = this.errorCount;
    
    this.currentDepartment = department.code;
    
    try {
      for (const shapefilePath of department.shapefiles) {
        await this.importShapefile(shapefilePath);
      }
      
      const deptEndTime = Date.now();
      const deptDuration = ((deptEndTime - deptStartTime) / 1000).toFixed(1);
      const deptFeaturesImported = this.importedCount - deptImportedCount;
      const deptErrors = this.errorCount - deptErrorCount;
      
      console.log(`\n✅ Department ${department.code} completed:`);
      console.log(`   - Features imported: ${deptFeaturesImported.toLocaleString()}`);
      console.log(`   - Errors: ${deptErrors}`);
      console.log(`   - Duration: ${deptDuration}s`);
      
      return {
        success: true,
        department: department.code,
        featuresImported: deptFeaturesImported,
        errors: deptErrors,
        duration: deptDuration
      };
      
    } catch (error) {
      console.error(`❌ Failed to import department ${department.code}:`, error);
      
      return {
        success: false,
        department: department.code,
        error: error.message
      };
    } finally {
      this.currentDepartment = null;
    }
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
          const entity = this.mapShapefileToEntity(properties, transformedGeometry, this.currentDepartment);
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

  async finalizeImport(departmentResults) {
    const endTime = Date.now();
    const duration = ((endTime - this.startTime) / 1000).toFixed(2);
    
    console.log('\n🎉 Multi-Department Import Summary');
    console.log('===================================');
    
    // Department-level summary
    console.log('\n📊 Department Results:');
    departmentResults.forEach(result => {
      if (result.success) {
        console.log(`   ✅ ${result.department}: ${result.featuresImported.toLocaleString()} features, ${result.errors} errors, ${result.duration}s`);
      } else {
        console.log(`   ❌ ${result.department}: Failed - ${result.error}`);
      }
    });
    
    // Overall summary
    const successfulDepts = departmentResults.filter(r => r.success).length;
    const totalFeatures = departmentResults.reduce((sum, r) => sum + (r.featuresImported || 0), 0);
    
    console.log(`\n📈 Overall Summary:`);
    console.log(`   - Departments processed: ${successfulDepts}/${departmentResults.length}`);
    console.log(`   - Total features imported: ${this.importedCount.toLocaleString()}`);
    console.log(`   - Total errors: ${this.errorCount}`);
    console.log(`   - Total duration: ${duration}s`);
    
    // Verify import
    const dbCount = await dataSource.query('SELECT COUNT(*) FROM forest_plots');
    console.log(`   - Database count: ${dbCount[0].count}`);
    
    if (this.importedCount > 0) {
      console.log('\n✅ Multi-department import completed successfully!');
      
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
      
      // Department coverage
      const deptCoverage = await dataSource.query(`
        SELECT code_departement, COUNT(*) as count 
        FROM forest_plots 
        WHERE code_departement IS NOT NULL 
        GROUP BY code_departement 
        ORDER BY code_departement
      `);
      
      console.log('\n🏛️  Department Coverage:');
      deptCoverage.forEach(row => {
        console.log(`   - D${row.code_departement}: ${row.count.toLocaleString()} plots`);
      });
      
      // Validate geometry types
      const geomCheck = await dataSource.query(`
        SELECT ST_GeometryType(geom) as geom_type, COUNT(*) as count 
        FROM forest_plots 
        GROUP BY ST_GeometryType(geom)
      `);
      
      console.log('\n📐 Geometry types:');
      geomCheck.forEach(row => console.log(`   - ${row.geom_type}: ${row.count} features`));
      
      // Check forest types
      const forestTypes = await dataSource.query(`
        SELECT type_foret, COUNT(*) as count 
        FROM forest_plots 
        WHERE type_foret IS NOT NULL 
        GROUP BY type_foret 
        ORDER BY count DESC 
        LIMIT 10
      `);
      
      console.log('\n🌲 Top forest types:');
      forestTypes.forEach(row => console.log(`   - ${row.type_foret}: ${row.count} features`));
      
      console.log('\n✅ Multi-department import completed successfully!');
      console.log('� Ready for forest analysis across all imported departments!');
    }
  }

  async run() {
    try {
      await this.initializeDatabase();
      
      const departments = await this.findShapefiles();
      
      if (departments.length === 0) {
        console.log('❌ No department directories found');
        console.log('💡 Run: node scripts/extract-departments.js first');
        return;
      }
      
      console.log(`\n🚀 Starting import of ${departments.length} departments...\n`);
      
      const departmentResults = [];
      
      for (const department of departments) {
        const result = await this.importDepartment(department);
        departmentResults.push(result);
      }
      
      await this.finalizeImport(departmentResults);
      
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
