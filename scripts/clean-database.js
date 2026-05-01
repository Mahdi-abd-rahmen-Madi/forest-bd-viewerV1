#!/usr/bin/env node

/**
 * Database Cleanup Utility
 * Completely resets the forest database by clearing all data and recreating indexes
 */

const readline = require('readline');
const { DataSource } = require('typeorm');

// Database configuration
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'forest_bd_viewer',
  synchronize: false,
  logging: false,
  entities: [],
});

class DatabaseCleaner {
  constructor() {
    this.autoMode = process.argv.includes('--auto');
    this.rl = null;
    if (!this.autoMode) {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
    }
  }

  async confirmAction(message) {
    if (this.autoMode) {
      console.log(`${message} (y/N): y`);
      return true;
    }
    
    return new Promise((resolve) => {
      this.rl.question(`${message} (y/N): `, (answer) => {
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  async initializeDatabase() {
    console.log('🔌 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected');
  }

  async cleanForestPlots() {
    console.log('\n🗑️  Cleaning forest_plots table...');
    
    // Get current count
    const countResult = await dataSource.query('SELECT COUNT(*) FROM forest_plots');
    const currentCount = parseInt(countResult[0].count);
    console.log(`📊 Current records: ${currentCount}`);
    
    if (currentCount === 0) {
      console.log('✅ Table is already empty');
      return;
    }

    // Clear data
    console.log('🧹 Truncating table...');
    await dataSource.query('TRUNCATE TABLE forest_plots RESTART IDENTITY CASCADE');
    
    // Verify cleanup
    const afterCount = await dataSource.query('SELECT COUNT(*) FROM forest_plots');
    console.log(`✅ Table cleared. Records remaining: ${afterCount[0].count}`);
  }

  async recreateIndexes() {
    console.log('\n🔧 Recreating indexes...');
    
    // Drop existing indexes
    await dataSource.query('DROP INDEX IF EXISTS idx_forest_plots_geom');
    await dataSource.query('DROP INDEX IF EXISTS idx_forest_plots_region');
    await dataSource.query('DROP INDEX IF EXISTS idx_forest_plots_dept');
    
    // Recreate indexes
    console.log('📈 Creating spatial index...');
    await dataSource.query('CREATE INDEX idx_forest_plots_geom ON forest_plots USING GIST (geom)');
    
    console.log('📈 Creating region index...');
    await dataSource.query('CREATE INDEX idx_forest_plots_region ON forest_plots (code_region)');
    
    console.log('📈 Creating department index...');
    await dataSource.query('CREATE INDEX idx_forest_plots_dept ON forest_plots (code_departement)');
    
    console.log('✅ All indexes recreated');
  }

  async optimizeDatabase() {
    console.log('\n⚡ Optimizing database...');
    
    // Update statistics
    await dataSource.query('ANALYZE forest_plots');
    
    // Vacuum the table
    await dataSource.query('VACUUM forest_plots');
    
    console.log('✅ Database optimized');
  }

  async resetDatabase() {
    console.log('🌲 Forest Database Cleaner');
    console.log('========================\n');
    
    try {
      await this.initializeDatabase();
      
      // Safety confirmation
      const confirmed = await this.confirmAction(
        '⚠️  This will completely delete all forest data and reset the database.\n' +
        'Are you sure you want to continue?'
      );
      
      if (!confirmed) {
        console.log('❌ Operation cancelled by user');
        return;
      }
      
      // Perform cleanup operations
      await this.cleanForestPlots();
      await this.recreateIndexes();
      await this.optimizeDatabase();
      
      console.log('\n🎉 Database cleanup completed successfully!');
      console.log('✅ Database is ready for fresh import');
      
    } catch (error) {
      console.error('❌ Database cleanup failed:', error);
      throw error;
    } finally {
      await dataSource.destroy();
      if (this.rl) {
        this.rl.close();
      }
    }
  }

  async showStatus() {
    console.log('📊 Database Status');
    console.log('==================\n');
    
    try {
      await this.initializeDatabase();
      
      // Check if table exists
      const tableExists = await dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'forest_plots'
        );
      `);
      
      if (!tableExists[0].exists) {
        console.log('❌ forest_plots table does not exist');
        return;
      }
      
      // Get record count
      const countResult = await dataSource.query('SELECT COUNT(*) FROM forest_plots');
      const count = parseInt(countResult[0].count);
      
      // Get table size
      const sizeResult = await dataSource.query(`
        SELECT pg_size_pretty(pg_total_relation_size('forest_plots')) as size
      `);
      
      // Check indexes
      const indexResult = await dataSource.query(`
        SELECT indexname FROM pg_indexes 
        WHERE tablename = 'forest_plots' AND indexname LIKE 'idx_forest_plots_%'
      `);
      
      console.log(`📊 Records: ${count.toLocaleString()}`);
      console.log(`💾 Size: ${sizeResult[0].size}`);
      console.log(`📈 Indexes: ${indexResult.length} spatial/administrative indexes`);
      
      if (count > 0) {
        // Get coordinate range
        const coordResult = await dataSource.query(`
          SELECT 
            MIN(ST_XMin(ST_Envelope(geom))) as min_lon,
            MAX(ST_XMax(ST_Envelope(geom))) as max_lon,
            MIN(ST_YMin(ST_Envelope(geom))) as min_lat,
            MAX(ST_YMax(ST_Envelope(geom))) as max_lat
          FROM forest_plots
          WHERE geom IS NOT NULL
        `);
        
        const coords = coordResult[0];
        if (coords.min_lon) {
          console.log(`📍 Coordinate Range: Lon(${coords.min_lon}° to ${coords.max_lon}°), Lat(${coords.min_lat}° to ${coords.max_lat}°)`);
        }
        
        // Get department coverage
        const deptResult = await dataSource.query(`
          SELECT code_departement, COUNT(*) as count 
          FROM forest_plots 
          WHERE code_departement IS NOT NULL 
          GROUP BY code_departement 
          ORDER BY count DESC
        `);
        
        if (deptResult.length > 0) {
          console.log('🏛️  Departments covered:');
          deptResult.forEach(row => {
            console.log(`   - D${row.code_departement}: ${row.count.toLocaleString()} plots`);
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to get database status:', error);
    } finally {
      await dataSource.destroy();
      if (this.rl) {
        this.rl.close();
      }
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const cleaner = new DatabaseCleaner();
  
  if (args.includes('--status') || args.includes('-s')) {
    await cleaner.showStatus();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log('🌲 Forest Database Cleaner');
    console.log('Usage:');
    console.log('  node clean-database.js         # Interactive cleanup');
    console.log('  node clean-database.js --status # Show database status');
    console.log('  node clean-database.js --help   # Show this help');
  } else {
    await cleaner.resetDatabase();
  }
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

// Run the cleaner
if (require.main === module) {
  main();
}

module.exports = DatabaseCleaner;
