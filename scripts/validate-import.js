#!/usr/bin/env node

/**
 * Forest Data Validation Script
 * Validates imported forest data and tests spatial queries
 */

const { DataSource } = require('typeorm');

// Database configuration
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'forest_bd_viewer',
  synchronize: false, // Don't modify schema
  logging: false,
  entities: [
    require('@forest/database').ForestPlot
  ]
});

class DataValidator {
  constructor() {
    this.results = {
      totalRecords: 0,
      validGeometry: 0,
      invalidGeometry: 0,
      regions: new Set(),
      departments: new Set(),
      communes: new Set(),
      essences: new Set(),
      surfaceStats: { min: null, max: null, avg: null },
      bbox: null
    };
  }

  async connect() {
    console.log('🔌 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected');
    
    this.forestPlotRepository = dataSource.getRepository('ForestPlot');
  }

  async validateGeometry() {
    console.log('🔍 Validating geometries...');
    
    // Check for invalid geometries
    const invalidGeometries = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .where('ST_IsValid(plot.geom) = false')
      .getCount();
    
    const validGeometries = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .where('ST_IsValid(plot.geom) = true')
      .getCount();
    
    this.results.validGeometry = validGeometries;
    this.results.invalidGeometry = invalidGeometries;
    
    console.log(`✅ Valid geometries: ${validGeometries}`);
    if (invalidGeometries > 0) {
      console.log(`❌ Invalid geometries: ${invalidGeometries}`);
    }
  }

  async calculateStatistics() {
    console.log('📊 Calculating statistics...');
    
    // Total records
    this.results.totalRecords = await this.forestPlotRepository.count();
    
    // Administrative divisions
    const regions = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .select('DISTINCT plot.codeRegion', 'region')
      .where('plot.codeRegion IS NOT NULL')
      .getRawMany();
    
    regions.forEach(r => this.results.regions.add(r.region));
    
    const departments = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .select('DISTINCT plot.codeDepartement', 'dept')
      .where('plot.codeDepartement IS NOT NULL')
      .getRawMany();
    
    departments.forEach(d => this.results.departments.add(d.dept));
    
    const communes = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .select('DISTINCT plot.codeCommune', 'commune')
      .where('plot.codeCommune IS NOT NULL')
      .getRawMany();
    
    communes.forEach(c => this.results.communes.add(c.commune));
    
    // Surface area statistics
    const surfaceStats = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .select('MIN(plot.surfaceHectares)', 'min')
      .addSelect('MAX(plot.surfaceHectares)', 'max')
      .addSelect('AVG(plot.surfaceHectares)', 'avg')
      .where('plot.surfaceHectares IS NOT NULL')
      .getRawOne();
    
    this.results.surfaceStats = surfaceStats;
    
    // Bounding box
    const bbox = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .select('ST_Extent(plot.geom)', 'bbox')
      .getRawOne();
    
    this.results.bbox = bbox.bbox;
    
    // Essences (tree species)
    const plotsWithEssences = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .where('plot.essences IS NOT NULL')
      .andWhere('array_length(plot.essences, 1) > 0')
      .getMany();
    
    plotsWithEssences.forEach(plot => {
      if (plot.essences) {
        plot.essences.forEach(essence => {
          if (essence) this.results.essences.add(essence);
        });
      }
    });
    
    console.log(`📈 Total records: ${this.results.totalRecords}`);
    console.log(`🗺️  Regions: ${this.results.regions.size}`);
    console.log(`🏢 Departments: ${this.results.departments.size}`);
    console.log(`🏘️  Communes: ${this.results.communes.size}`);
    console.log(`🌳 Tree species: ${this.results.essences.size}`);
    
    if (this.results.surfaceStats.min) {
      console.log(`📏 Surface area: ${this.results.surfaceStats.min.toFixed(2)} - ${this.results.surfaceStats.max.toFixed(2)} ha (avg: ${this.results.surfaceStats.avg.toFixed(2)} ha)`);
    }
    
    if (this.results.bbox) {
      console.log(`📍 Bounding box: ${this.results.bbox}`);
    }
  }

  async testSpatialQueries() {
    console.log('🧪 Testing spatial queries...');
    
    // Test 1: Bounding box query (France approximate)
    const franceBox = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .where('ST_Intersects(plot.geom, ST_MakeEnvelope(-5, 41, 10, 51, 4326))')
      .getCount();
    
    console.log(`🇫🇷 Features in France bounding box: ${franceBox}`);
    
    // Test 2: Area calculation
    const areaStats = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .select('COUNT(*)', 'count')
      .addSelect('SUM(ST_Area(plot.geom::geography))', 'total_area')
      .where('ST_IsValid(plot.geom) = true')
      .getRawOne();
    
    if (areaStats.total_area) {
      const areaHectares = parseFloat(areaStats.total_area) / 10000; // m² to ha
      console.log(`📐 Total forest area: ${areaHectares.toFixed(2)} hectares`);
    }
    
    // Test 3: Point-in-polygon test (center of France)
    const centerFrance = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .where('ST_Contains(plot.geom, ST_SetSRID(ST_MakePoint(2.5, 46.5), 4326))')
      .getCount();
    
    console.log(`🎯 Features containing center of France: ${centerFrance}`);
    
    // Test 4: Buffer query (10km around a point)
    const bufferTest = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .where('ST_Intersects(plot.geom, ST_Buffer(ST_SetSRID(ST_MakePoint(2.5, 46.5), 4326), 0.1))')
      .getCount();
    
    console.log(`🔍 Features within 10km of center: ${bufferTest}`);
  }

  async testSampleData() {
    console.log('🔎 Testing sample data...');
    
    // Get a few sample records
    const samples = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .limit(5)
      .getMany();
    
    console.log('\n📋 Sample records:');
    samples.forEach((sample, index) => {
      console.log(`\n${index + 1}. ID: ${sample.id}`);
      console.log(`   Region: ${sample.codeRegion || 'N/A'}`);
      console.log(`   Department: ${sample.codeDepartement || 'N/A'}`);
      console.log(`   Commune: ${sample.codeCommune || 'N/A'}`);
      console.log(`   Lieu-dit: ${sample.lieuDit || 'N/A'}`);
      console.log(`   Surface: ${sample.surfaceHectares || 'N/A'} ha`);
      console.log(`   Forest type: ${sample.typeForet || 'N/A'}`);
      if (sample.essences && sample.essences.length > 0) {
        console.log(`   Essences: ${sample.essences.join(', ')}`);
      }
      console.log(`   Geometry type: ${sample.geom?.type || 'N/A'}`);
      if (sample.geom?.coordinates) {
        console.log(`   Coordinate count: ${JSON.stringify(sample.geom.coordinates).length}`);
      }
    });
  }

  async generateReport() {
    console.log('\n📄 Validation Report');
    console.log('===================');
    
    const issues = [];
    
    if (this.results.invalidGeometry > 0) {
      issues.push(`${this.results.invalidGeometry} invalid geometries`);
    }
    
    if (this.results.totalRecords === 0) {
      issues.push('No records found in database');
    }
    
    if (this.results.regions.size === 0) {
      issues.push('No region codes found');
    }
    
    if (issues.length > 0) {
      console.log('\n❌ Issues found:');
      issues.forEach(issue => console.log(`   - ${issue}`));
    } else {
      console.log('\n✅ All validations passed!');
    }
    
    console.log('\n📊 Summary:');
    console.log(`   - Total forest plots: ${this.results.totalRecords}`);
    console.log(`   - Valid geometries: ${this.results.validGeometry}`);
    console.log(`   - Administrative regions: ${this.results.regions.size}`);
    console.log(`   - Departments: ${this.results.departments.size}`);
    console.log(`   - Communes: ${this.results.communes.size}`);
    console.log(`   - Tree species: ${this.results.essences.size}`);
    
    if (issues.length === 0) {
      console.log('\n🎉 Data is ready for use in the application!');
    }
  }

  async run() {
    try {
      await this.connect();
      await this.validateGeometry();
      await this.calculateStatistics();
      await this.testSpatialQueries();
      await this.testSampleData();
      await this.generateReport();
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
    } finally {
      await dataSource.destroy();
    }
  }
}

// Main execution
async function main() {
  console.log('🌲 Forest Data Validator');
  console.log('========================\n');
  
  const validator = new DataValidator();
  await validator.run();
}

// Run the validator
if (require.main === module) {
  main();
}

module.exports = DataValidator;
