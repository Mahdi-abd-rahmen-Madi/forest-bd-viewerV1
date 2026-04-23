#!/usr/bin/env node

/**
 * Sample Forest Data Creator
 * Creates sample forest plot data for testing the application
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
  synchronize: false,
  logging: false,
  entities: [
    require('@forest/database').ForestPlot
  ]
});

class SampleDataCreator {
  constructor() {
    this.sampleData = [
      {
        id: 'sample_1',
        codeRegion: 'NORMANDIE',
        codeDepartement: '014',
        codeCommune: '00141',
        lieuDit: 'Forêt de la Roche',
        geom: {
          type: 'MultiPolygon',
          coordinates: [[
            [[-0.1, 49.2], [-0.05, 49.2], [-0.05, 49.25], [-0.1, 49.25], [-0.1, 49.2]]
          ]]
        },
        essences: ['Chêne', 'Hêtre', 'Châtaignier'],
        surfaceHectares: 125.5,
        typeForet: 'Feuillu'
      },
      {
        id: 'sample_2',
        codeRegion: 'NORMANDIE',
        codeDepartement: '014',
        codeCommune: '00156',
        lieuDit: 'Bois du Marais',
        geom: {
          type: 'MultiPolygon',
          coordinates: [[
            [[-0.08, 49.18], [-0.03, 49.18], [-0.03, 49.22], [-0.08, 49.22], [-0.08, 49.18]]
          ]]
        },
        essences: ['Pin sylvestre', 'Chêne'],
        surfaceHectares: 87.3,
        typeForet: 'Mixte'
      },
      {
        id: 'sample_3',
        codeRegion: 'PAYS_DE_LA_LOIRE',
        codeDepartement: '044',
        codeCommune: '00109',
        lieuDit: 'Forêt d\'Ancenis',
        geom: {
          type: 'MultiPolygon',
          coordinates: [[
            [[-1.2, 47.3], [-1.15, 47.3], [-1.15, 47.35], [-1.2, 47.35], [-1.2, 47.3]]
          ]]
        },
        essences: ['Hêtre', 'Chêne', 'Bouleau'],
        surfaceHectares: 210.8,
        typeForet: 'Feuillu'
      },
      {
        id: 'sample_4',
        codeRegion: 'PAYS_DE_LA_LOIRE',
        codeDepartement: '053',
        codeCommune: '00039',
        lieuDit: 'Forêt de Mayenne',
        geom: {
          type: 'MultiPolygon',
          coordinates: [[
            [[-0.6, 48.0], [-0.55, 48.0], [-0.55, 48.05], [-0.6, 48.05], [-0.6, 48.0]]
          ]]
        },
        essences: ['Chêne pédonculé', 'Châtaignier', 'Erable'],
        surfaceHectares: 156.2,
        typeForet: 'Feuillu'
      },
      {
        id: 'sample_5',
        codeRegion: 'CENTRE_VAL_DE_LOIRE',
        codeDepartement: '018',
        codeCommune: '00033',
        lieuDit: 'Forêt de Barrière',
        geom: {
          type: 'MultiPolygon',
          coordinates: [[
            [[2.3, 47.8], [2.35, 47.8], [2.35, 47.85], [2.3, 47.85], [2.3, 47.8]]
          ]]
        },
        essences: ['Pin maritime', 'Chêne'],
        surfaceHectares: 95.7,
        typeForet: 'Mixte'
      },
      {
        id: 'sample_6',
        codeRegion: 'CENTRE_VAL_DE_LOIRE',
        codeDepartement: '045',
        codeCommune: '00201',
        lieuDit: 'Forêt d\'Orléans',
        geom: {
          type: 'MultiPolygon',
          coordinates: [[
            [[2.0, 47.9], [2.1, 47.9], [2.1, 48.0], [2.0, 48.0], [2.0, 47.9]]
          ]]
        },
        essences: ['Chêne', 'Hêtre', 'Pin sylvestre', 'Bouleau'],
        surfaceHectares: 345.6,
        typeForet: 'Mixte'
      },
      {
        id: 'sample_7',
        codeRegion: 'NORMANDIE',
        codeDepartement: '061',
        codeCommune: '00450',
        lieuDit: 'Forêt d\'Écouves',
        geom: {
          type: 'MultiPolygon',
          coordinates: [[
            [[0.1, 48.6], [0.15, 48.6], [0.15, 48.65], [0.1, 48.65], [0.1, 48.6]]
          ]]
        },
        essences: ['Hêtre', 'Chêne', 'Épicéa'],
        surfaceHectares: 178.9,
        typeForet: 'Mixte'
      },
      {
        id: 'sample_8',
        codeRegion: 'PAYS_DE_LA_LOIRE',
        codeDepartement: '072',
        codeCommune: '00185',
        lieuDit: 'Forêt de Perseigne',
        geom: {
          type: 'MultiPolygon',
          coordinates: [[
            [[0.3, 48.3], [0.35, 48.3], [0.35, 48.35], [0.3, 48.35], [0.3, 48.3]]
          ]]
        },
        essences: ['Chêne', 'Hêtre', 'Châtaignier', 'Erable sycomore'],
        surfaceHectares: 234.1,
        typeForet: 'Feuillu'
      }
    ];
  }

  async connect() {
    console.log('🔌 Connecting to database...');
    await dataSource.initialize();
    console.log('✅ Database connected');
    
    this.forestPlotRepository = dataSource.getRepository('ForestPlot');
  }

  async createSampleData() {
    console.log('🌳 Creating sample forest data...');
    
    // Clear existing data
    const existingCount = await this.forestPlotRepository.count();
    if (existingCount > 0) {
      console.log(`🗑️  Clearing ${existingCount} existing records...`);
      await this.forestPlotRepository.clear();
    }
    
    // Insert sample data
    console.log(`📥 Inserting ${this.sampleData.length} sample forest plots...`);
    await this.forestPlotRepository.insert(this.sampleData);
    
    console.log('✅ Sample data created successfully!');
    
    // Verify insertion
    const count = await this.forestPlotRepository.count();
    console.log(`📊 Total forest plots in database: ${count}`);
    
    // Test spatial query
    const testQuery = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .where('ST_Intersects(plot.geom, ST_MakeEnvelope(-2, 47, 3, 49, 4326))')
      .getCount();
    
    console.log(`🗺️  Features in test bounding box: ${testQuery}`);
    
    // Show sample records
    const samples = await this.forestPlotRepository
      .createQueryBuilder('plot')
      .limit(3)
      .getMany();
    
    console.log('\n📋 Sample records:');
    samples.forEach((sample, index) => {
      console.log(`${index + 1}. ${sample.lieuDit} (${sample.codeRegion}) - ${sample.surfaceHectares} ha`);
      console.log(`   Essences: ${sample.essences?.join(', ')}`);
    });
  }

  async run() {
    try {
      await this.connect();
      await this.createSampleData();
      
      console.log('\n🎉 Sample data setup complete!');
      console.log('🚀 You can now start the application with: ./start-simple.sh');
      
    } catch (error) {
      console.error('❌ Error creating sample data:', error);
    } finally {
      await dataSource.destroy();
    }
  }
}

// Main execution
async function main() {
  console.log('🌲 Forest Sample Data Creator');
  console.log('=============================\n');
  
  const creator = new SampleDataCreator();
  await creator.run();
}

// Run the creator
if (require.main === module) {
  main();
}

module.exports = SampleDataCreator;
