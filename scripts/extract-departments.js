#!/usr/bin/env node

/**
 * Department Extraction Utility
 * Extracts all BD FORET department archives to organized directories
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Department name mapping
const DEPARTMENT_NAMES = {
  'D014': 'Calvados',
  'D027': 'Eure', 
  'D050': 'Manche',
  'D061': 'Orne',
  'D076': 'SeineMaritime',
  'D040': 'Landes',
  'D088': 'Vosges'
};

class DepartmentExtractor {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.rawDir = path.join(__dirname, '../data/bd-foret/raw');
    this.extractedDepartments = [];
    this.failedDepartments = [];
    this.startTime = Date.now();
  }

  async ensureDependencies() {
    console.log('🔧 Checking dependencies...');
    
    try {
      // Check if 7z is available
      execSync('7z', { stdio: 'pipe' });
      console.log('✅ 7z is available');
    } catch (error) {
      console.log('📦 Installing p7zip-full...');
      try {
        execSync('sudo apt-get update && sudo apt-get install -y p7zip-full', { stdio: 'inherit' });
      } catch (installError) {
        console.error('❌ Failed to install 7z. Please install p7zip-full manually:');
        console.error('   sudo apt-get install p7zip-full');
        process.exit(1);
      }
    }
    
    // Ensure raw directory exists
    if (!fs.existsSync(this.rawDir)) {
      fs.mkdirSync(this.rawDir, { recursive: true });
      console.log('📁 Created raw directory');
    }
  }

  findDepartmentArchives() {
    console.log('🔍 Scanning for department archives...');
    
    const archives = [];
    const files = fs.readdirSync(this.dataDir);
    
    for (const file of files) {
      if (file.endsWith('.7z') && file.includes('BDFORET') && file.includes('D')) {
        const match = file.match(/D(\d{3})/);
        if (match) {
          const deptCode = `D${match[1]}`;
          const deptName = DEPARTMENT_NAMES[deptCode] || deptCode;
          const filePath = path.join(this.dataDir, file);
          const stats = fs.statSync(filePath);
          
          archives.push({
            code: deptCode,
            name: deptName,
            filename: file,
            filePath: filePath,
            size: stats.size,
            version: file.includes('2-0') ? '2.0' : '1.0'
          });
        }
      }
    }
    
    console.log(`📦 Found ${archives.length} department archives:`);
    archives.forEach(archive => {
      console.log(`   - ${archive.code} ${archive.name} (${archive.version}) - ${(archive.size / 1024 / 1024).toFixed(1)}MB`);
    });
    
    return archives.sort((a, b) => a.code.localeCompare(b.code));
  }

  getExtractionPath(deptCode, deptName) {
    return path.join(this.rawDir, `${deptCode}_${deptName}`);
  }

  async extractArchive(archive) {
    const extractPath = this.getExtractionPath(archive.code, archive.name);
    
    console.log(`\n📂 Extracting ${archive.code} ${archive.name}...`);
    
    // Check if already extracted
    if (fs.existsSync(extractPath)) {
      console.log(`⚠️  Directory already exists: ${extractPath}`);
      
      const confirmed = await this.confirmAction(
        `Delete existing ${archive.code} directory and re-extract?`
      );
      
      if (!confirmed) {
        console.log(`⏭️  Skipping ${archive.code}`);
        return false;
      }
      
      // Remove existing directory
      execSync(`rm -rf "${extractPath}"`, { stdio: 'inherit' });
    }
    
    // Create extraction directory
    fs.mkdirSync(extractPath, { recursive: true });
    
    try {
      // Extract using 7z
      console.log(`📦 Extracting ${archive.filename}...`);
      const startTime = Date.now();
      
      execSync(`7z x "${archive.filePath}" -o"${extractPath}" -y`, { 
        stdio: 'inherit',
        cwd: this.dataDir
      });
      
      const extractTime = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Extracted ${archive.code} in ${extractTime}s`);
      
      // Validate extraction
      if (await this.validateExtraction(extractPath, archive)) {
        this.extractedDepartments.push({
          ...archive,
          extractPath: extractPath,
          extractTime: extractTime
        });
        return true;
      } else {
        console.error(`❌ Validation failed for ${archive.code}`);
        this.failedDepartments.push(archive);
        return false;
      }
      
    } catch (error) {
      console.error(`❌ Failed to extract ${archive.code}:`, error.message);
      this.failedDepartments.push(archive);
      
      // Clean up failed extraction
      if (fs.existsSync(extractPath)) {
        execSync(`rm -rf "${extractPath}"`, { stdio: 'pipe' });
      }
      
      return false;
    }
  }

  async validateExtraction(extractPath, archive) {
    console.log(`🔍 Validating extraction for ${archive.code}...`);
    
    try {
      // Check for expected BD FORET structure
      const bdforetPath = path.join(extractPath, 'BDFORET');
      if (!fs.existsSync(bdforetPath)) {
        console.error(`❌ BDFORET directory not found in ${extractPath}`);
        return false;
      }
      
      // Look for shapefiles
      const shapefiles = this.findShapefilesInDirectory(bdforetPath);
      if (shapefiles.length === 0) {
        console.error(`❌ No shapefiles found in ${bdforetPath}`);
        return false;
      }
      
      console.log(`✅ Found ${shapefiles.length} shapefile(s) in ${archive.code}`);
      return true;
      
    } catch (error) {
      console.error(`❌ Validation error for ${archive.code}:`, error.message);
      return false;
    }
  }

  findShapefilesInDirectory(dir) {
    const shapefiles = [];
    
    const scanDirectory = (currentDir) => {
      try {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
          const fullPath = path.join(currentDir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (item.endsWith('.shp')) {
            // Check for required companion files
            const basePath = fullPath.replace('.shp', '');
            const dbfExists = fs.existsSync(`${basePath}.dbf`);
            const shxExists = fs.existsSync(`${basePath}.shx`);
            
            if (dbfExists && shxExists) {
              shapefiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    scanDirectory(dir);
    return shapefiles;
  }

  async confirmAction(message) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(`${message} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  async extractAllDepartments() {
    console.log('🌲 BD FORET Department Extractor');
    console.log('================================\n');
    
    try {
      await this.ensureDependencies();
      
      const archives = this.findDepartmentArchives();
      
      if (archives.length === 0) {
        console.log('❌ No department archives found');
        return;
      }
      
      console.log(`\n📋 Ready to extract ${archives.length} departments`);
      const confirmed = await this.confirmAction(
        'Proceed with extracting all departments?'
      );
      
      if (!confirmed) {
        console.log('❌ Operation cancelled by user');
        return;
      }
      
      // Extract each department
      for (const archive of archives) {
        await this.extractArchive(archive);
      }
      
      // Generate summary
      this.generateSummary();
      
    } catch (error) {
      console.error('❌ Extraction failed:', error);
      process.exit(1);
    }
  }

  generateSummary() {
    const endTime = Date.now();
    const totalTime = ((endTime - this.startTime) / 1000).toFixed(1);
    
    console.log('\n🎉 Extraction Summary');
    console.log('=====================');
    console.log(`✅ Successfully extracted: ${this.extractedDepartments.length} departments`);
    console.log(`❌ Failed extractions: ${this.failedDepartments.length} departments`);
    console.log(`⏱️  Total time: ${totalTime}s`);
    
    if (this.extractedDepartments.length > 0) {
      console.log('\n✅ Successfully Extracted:');
      this.extractedDepartments.forEach(dept => {
        console.log(`   - ${dept.code} ${dept.name} (${dept.version}) - ${dept.extractTime}s`);
      });
    }
    
    if (this.failedDepartments.length > 0) {
      console.log('\n❌ Failed Extractions:');
      this.failedDepartments.forEach(dept => {
        console.log(`   - ${dept.code} ${dept.name} (${dept.version})`);
      });
    }
    
    if (this.extractedDepartments.length > 0) {
      console.log('\n📁 Extraction directories:');
      this.extractedDepartments.forEach(dept => {
        console.log(`   ${dept.extractPath}`);
      });
      
      console.log('\n🚀 Ready for import! Run: node scripts/import-shapefiles.js');
    }
  }

  async showStatus() {
    console.log('📊 Extraction Status');
    console.log('====================\n');
    
    const archives = this.findDepartmentArchives();
    
    if (archives.length === 0) {
      console.log('❌ No department archives found');
      return;
    }
    
    console.log('📦 Available Archives:');
    archives.forEach(archive => {
      const extractPath = this.getExtractionPath(archive.code, archive.name);
      const isExtracted = fs.existsSync(extractPath);
      const status = isExtracted ? '✅ Extracted' : '❌ Not extracted';
      
      console.log(`   ${archive.code} ${archive.name} (${archive.version}) - ${(archive.size / 1024 / 1024).toFixed(1)}MB - ${status}`);
      
      if (isExtracted) {
        const shapefiles = this.findShapefilesInDirectory(path.join(extractPath, 'BDFORET'));
        console.log(`      └─ ${shapefiles.length} shapefile(s) found`);
      }
    });
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const extractor = new DepartmentExtractor();
  
  if (args.includes('--status') || args.includes('-s')) {
    await extractor.showStatus();
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log('🌲 BD FORET Department Extractor');
    console.log('Usage:');
    console.log('  node extract-departments.js         # Interactive extraction');
    console.log('  node extract-departments.js --status # Show extraction status');
    console.log('  node extract-departments.js --help   # Show this help');
  } else {
    await extractor.extractAllDepartments();
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

// Run the extractor
if (require.main === module) {
  main();
}

module.exports = DepartmentExtractor;
