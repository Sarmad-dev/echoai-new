#!/usr/bin/env node

/**
 * Script to apply Enhanced Chatbot Intelligence Migration
 * This script applies the migration and validates the results
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { validateEnhancedIntelligenceMigration } = require('./validate-enhanced-intelligence-migration');

async function applyEnhancedIntelligenceMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🚀 Applying Enhanced Chatbot Intelligence Migration...\n');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'prisma', 'migrations', '008_add_enhanced_chatbot_intelligence.sql');
    
    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    console.log('🔧 Executing migration...\n');

    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        try {
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          await prisma.$executeRawUnsafe(statement);
        } catch (error) {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          console.error('Statement:', statement);
          throw error;
        }
      }
    }

    console.log('✅ Migration executed successfully!\n');

    // Validate the migration
    console.log('🔍 Validating migration results...\n');
    await validateEnhancedIntelligenceMigration();

    console.log('\n🎉 Enhanced Chatbot Intelligence Migration completed successfully!');
    
    // Generate Prisma client
    console.log('\n🔄 Regenerating Prisma client...');
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
      await execPromise('npx prisma generate', { cwd: path.join(__dirname, '..') });
      console.log('✅ Prisma client regenerated successfully');
    } catch (error) {
      console.warn('⚠️  Warning: Could not regenerate Prisma client automatically');
      console.warn('Please run "npx prisma generate" manually');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n🔄 To rollback this migration, run:');
    console.error('node scripts/rollback-enhanced-intelligence-migration.js');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  applyEnhancedIntelligenceMigration();
}

module.exports = { applyEnhancedIntelligenceMigration };